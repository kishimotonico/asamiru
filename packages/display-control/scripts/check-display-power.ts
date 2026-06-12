/**
 * Raspberry Pi 上で DRM hotplug event と DDC/CI Power mode (VCP D6) を観測する。
 *
 * 通常実行ではモニターを制御しない。物理ボタンで OFF/ON し、時系列ログを確認する。
 * 実行: pnpm --filter @asamiru/display-control check -- --display 1
 */

import { execFile, spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DRM_ROOT = "/sys/class/drm";
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const HOTPLUG_DEBOUNCE_MS = 1_000;
const HOTPLUG_RETRY_MS = 1_000;
const HOTPLUG_RETRY_COUNT = 3;

type Options = {
  selector: { kind: "display" | "bus"; value: string };
  connector: string | null;
  pollMs: number;
  timeoutMs: number;
  once: boolean;
  controlTest: boolean;
};

type ConnectorStatus = {
  name: string;
  id: string | null;
  status: string;
};

type DdcStatus = {
  rawValue: string | null;
  power: "on" | "off" | "unknown";
  error: string | null;
};

function usage(): string {
  return `Usage:
  pnpm --filter @asamiru/display-control check -- [options]

Options:
  --display <number>   ddcutil display number (default: 1)
  --bus <number>       ddcutil I2C bus number. Prefer this for stable selection.
  --connector <name>   DRM connector name, e.g. card1-HDMI-A-1
  --poll-ms <ms>       DDC polling interval (default: ${DEFAULT_POLL_MS})
  --timeout-ms <ms>    ddcutil command timeout (default: ${DEFAULT_TIMEOUT_MS})
  --once               Print one snapshot and exit
  --control-test       Send D6=05, observe, then send D6=01 and exit
  --help               Show this help

Normal observation mode does not change monitor power. Press Ctrl-C to stop.`;
}

function parsePositiveInteger(raw: string | undefined, option: string): number {
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${option} requires a positive integer`);
  }
  return value;
}

function parseArgs(args: string[]): Options {
  let selector: Options["selector"] = { kind: "display", value: "1" };
  let connector: string | null = null;
  let pollMs = DEFAULT_POLL_MS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let once = false;
  let controlTest = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--":
        break;
      case "--display":
        selector = { kind: "display", value: String(parsePositiveInteger(args[++i], "--display")) };
        break;
      case "--bus":
        selector = { kind: "bus", value: String(parsePositiveInteger(args[++i], "--bus")) };
        break;
      case "--connector":
        connector = args[++i] ?? null;
        if (!connector || connector.includes("/")) {
          throw new Error("--connector requires a connector name without '/'");
        }
        break;
      case "--poll-ms":
        pollMs = parsePositiveInteger(args[++i], "--poll-ms");
        break;
      case "--timeout-ms":
        timeoutMs = parsePositiveInteger(args[++i], "--timeout-ms");
        break;
      case "--once":
        once = true;
        break;
      case "--control-test":
        controlTest = true;
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (once && controlTest) {
    throw new Error("--once and --control-test cannot be used together");
  }

  return { selector, connector, pollMs, timeoutMs, once, controlTest };
}

function commandExists(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function readTrimmed(path: string): string | null {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

function readConnectors(connectorName: string | null): ConnectorStatus[] {
  let names: string[];
  try {
    names = readdirSync(DRM_ROOT).filter((name) => /-HDMI-A-\d+$/.test(name));
  } catch {
    return [];
  }

  if (connectorName) {
    names = names.filter((name) => name === connectorName);
  }

  return names.sort().map((name) => ({
    name,
    id: readTrimmed(join(DRM_ROOT, name, "connector_id")),
    status: readTrimmed(join(DRM_ROOT, name, "status")) ?? "unknown",
  }));
}

function selectorArgs(options: Options): string[] {
  return options.selector.kind === "display"
    ? ["--display", options.selector.value]
    : ["--bus", options.selector.value];
}

function execFileResult(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function readDdcStatus(options: Options): Promise<DdcStatus> {
  try {
    const { stdout } = await execFileResult(
      "ddcutil",
      ["getvcp", "D6", ...selectorArgs(options), "--terse"],
      options.timeoutMs,
    );
    const match = /\bVCP\s+D6\s+SNC\s+x([0-9a-fA-F]{2})\b/.exec(stdout);
    if (!match) {
      return { rawValue: null, power: "unknown", error: `Unexpected output: ${stdout.trim()}` };
    }
    const rawValue = `x${match[1].toLowerCase()}`;
    const power = rawValue === "x01" ? "on" : rawValue === "x04" ? "off" : "unknown";
    return { rawValue, power, error: null };
  } catch (error) {
    return {
      rawValue: null,
      power: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function now(): string {
  return new Date().toISOString();
}

function connectorSummary(connectors: ConnectorStatus[]): string {
  if (connectors.length === 0) return "none";
  return connectors
    .map((connector) => `${connector.name}:${connector.status}${connector.id ? `(id=${connector.id})` : ""}`)
    .join(",");
}

let lastSnapshotSignature: string | null = null;

async function printSnapshot(reason: string, options: Options): Promise<DdcStatus> {
  const connectors = readConnectors(options.connector);
  const ddc = await readDdcStatus(options);
  const signature = JSON.stringify({ connectors, ddc });
  const changed = lastSnapshotSignature !== null && signature !== lastSnapshotSignature;
  lastSnapshotSignature = signature;

  const error = ddc.error ? ` error=${JSON.stringify(ddc.error)}` : "";
  console.log(
    `${now()} snapshot reason=${reason} changed=${changed ? "yes" : "no"} drm=${connectorSummary(connectors)} ddc=${ddc.rawValue ?? "unknown"} power=${ddc.power}${error}`,
  );
  return ddc;
}

async function setPower(value: "01" | "05", options: Options): Promise<void> {
  console.log(`${now()} command D6=${value}`);
  await execFileResult("ddcutil", ["setvcp", "D6", value, ...selectorArgs(options)], options.timeoutMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runControlTest(options: Options): Promise<void> {
  console.log("Control test will turn the display off, wait, then attempt to turn it on.");
  await printSnapshot("control-before", options);
  try {
    await setPower("05", options);
    await sleep(2_000);
    await printSnapshot("control-after-off", options);
  } finally {
    await setPower("01", options);
  }
  await sleep(2_000);
  await printSnapshot("control-after-on", options);
}

function parseUdevBlock(block: string[]): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const line of block) {
    const index = line.indexOf("=");
    if (index > 0) {
      properties[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  return properties;
}

function startUdevMonitor(onHotplug: (connectorId: string | null) => void): ChildProcessWithoutNullStreams {
  const child = spawn("udevadm", ["monitor", "--kernel", "--subsystem-match=drm", "--property"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end();
  let buffer = "";
  let block: string[] = [];

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        block.push(line);
        continue;
      }
      const properties = parseUdevBlock(block);
      block = [];
      if (properties.HOTPLUG === "1") {
        const connectorId = properties.CONNECTOR ?? null;
        console.log(`${now()} drm-hotplug connector_id=${connectorId ?? "unknown"}`);
        onHotplug(connectorId);
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    const message = chunk.trim();
    if (message) console.error(`${now()} udevadm-error ${message}`);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`${now()} udevadm-exit code=${code ?? "null"} signal=${signal ?? "null"}`);
    }
  });

  return child;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!commandExists("ddcutil")) {
    throw new Error("ddcutil was not found");
  }
  if (!options.once && !options.controlTest && !commandExists("udevadm")) {
    throw new Error("udevadm was not found");
  }

  const selection = `${options.selector.kind}=${options.selector.value}`;
  console.log(
    `${now()} start selection=${selection} connector=${options.connector ?? "all-hdmi"} poll_ms=${options.pollMs} timeout_ms=${options.timeoutMs}`,
  );

  if (options.once) {
    await printSnapshot("once", options);
    return;
  }
  if (options.controlTest) {
    await runControlTest(options);
    return;
  }

  let queue = Promise.resolve();
  let hotplugTimer: NodeJS.Timeout | null = null;
  const enqueueSnapshot = (reason: string) => {
    queue = queue.then(async () => {
      await printSnapshot(reason, options);
    }).catch((error) => {
      console.error(`${now()} snapshot-error ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const enqueueHotplugSnapshot = () => {
    queue = queue.then(async () => {
      for (let attempt = 0; attempt <= HOTPLUG_RETRY_COUNT; attempt += 1) {
        const reason = attempt === 0 ? "drm-hotplug" : `drm-hotplug-retry-${attempt}`;
        const ddc = await printSnapshot(reason, options);
        if (ddc.power !== "unknown") return;
        if (attempt < HOTPLUG_RETRY_COUNT) await sleep(HOTPLUG_RETRY_MS);
      }
    }).catch((error) => {
      console.error(`${now()} snapshot-error ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const udev = startUdevMonitor(() => {
    if (hotplugTimer) clearTimeout(hotplugTimer);
    hotplugTimer = setTimeout(enqueueHotplugSnapshot, HOTPLUG_DEBOUNCE_MS);
  });
  const poll = setInterval(() => enqueueSnapshot("poll"), options.pollMs);

  const stop = () => {
    clearInterval(poll);
    if (hotplugTimer) clearTimeout(hotplugTimer);
    udev.kill("SIGTERM");
  };
  process.once("SIGINT", () => {
    stop();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    stop();
    process.exit(0);
  });

  enqueueSnapshot("initial");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
