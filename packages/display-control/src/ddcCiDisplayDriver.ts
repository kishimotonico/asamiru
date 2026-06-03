import { execFile } from "node:child_process";
import type { DisplayDriver, ConnectionResult, PowerResult } from "./displayDriver.js";
import { readConnectorStatus } from "./drmConnector.js";

const DEFAULT_TIMEOUT_MS = 4_000;

/** ddcutil の対象指定。bus（--bus、安定）か display（--display、検出順）のいずれか */
export type DdcSelector = { kind: "bus" | "display"; value: string };

export type DdcCiDriverOptions = {
  /** ddcutil の対象指定 */
  selector: DdcSelector;
  /** DRM connector 名（例: HDMI-A-1） */
  connector: string;
  /** ddcutil コマンドタイムアウト ms（既定 4000） */
  timeoutMs?: number;
};

function execFileResult(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export class DdcCiDisplayDriver implements DisplayDriver {
  /** ddcutil に渡す対象指定の引数（例: ["--bus", "10"] / ["--display", "1"]）*/
  readonly #selectorArgs: string[];
  readonly #connector: string;
  readonly #timeoutMs: number;

  constructor({ selector, connector, timeoutMs }: DdcCiDriverOptions) {
    this.#selectorArgs =
      selector.kind === "bus" ? ["--bus", selector.value] : ["--display", selector.value];
    this.#connector = connector;
    this.#timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async readConnection(): Promise<ConnectionResult> {
    const result = readConnectorStatus(this.#connector);
    if (!result) {
      return { connection: "unknown", error: `DRM connector not found: ${this.#connector}` };
    }
    return { connection: result.status, error: null };
  }

  async readPower(): Promise<PowerResult> {
    try {
      const { stdout } = await execFileResult(
        "ddcutil",
        ["getvcp", "D6", ...this.#selectorArgs, "--terse"],
        this.#timeoutMs,
      );
      const match = /\bVCP\s+D6\s+SNC\s+x([0-9a-fA-F]{2})\b/.exec(stdout);
      if (!match) {
        return { power: "unknown", error: `unexpected_output: ${stdout.trim()}` };
      }
      const raw = match[1].toLowerCase();
      const power = raw === "01" ? "on" : raw === "04" ? "off" : "unknown";
      return { power, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // "Display not found" は過渡状態として unknown
      if (/display not found/i.test(message)) {
        return { power: "unknown", error: `display_not_found: ${message}` };
      }
      return { power: "unknown", error: `ddc_failed: ${message}` };
    }
  }

  async setStandby(): Promise<void> {
    await execFileResult("ddcutil", ["setvcp", "D6", "05", ...this.#selectorArgs], this.#timeoutMs);
  }

  async setPowerOn(): Promise<void> {
    await execFileResult("ddcutil", ["setvcp", "D6", "01", ...this.#selectorArgs], this.#timeoutMs);
  }
}
