import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type HotplugEvent = { connectorId: string | null };

function parseUdevBlock(block: string[]): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of block) {
    const idx = line.indexOf("=");
    if (idx > 0) props[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return props;
}

/** udevadm monitor --kernel --subsystem-match=drm --property を起動し、
 *  DRM hotplug event 受信ごとに onHotplug を呼ぶ。
 *  返値の stop() で子プロセスを終了する。 */
export function startUdevMonitor(onHotplug: (event: HotplugEvent) => void): {
  stop: () => void;
  onExit: Promise<void>;
} {
  const child: ChildProcessWithoutNullStreams = spawn(
    "udevadm",
    ["monitor", "--kernel", "--subsystem-match=drm", "--property"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
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
      const props = parseUdevBlock(block);
      block = [];
      if (props.HOTPLUG === "1") {
        onHotplug({ connectorId: props.CONNECTOR ?? null });
      }
    }
  });

  const onExit = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  return {
    stop: () => child.kill("SIGTERM"),
    onExit,
  };
}
