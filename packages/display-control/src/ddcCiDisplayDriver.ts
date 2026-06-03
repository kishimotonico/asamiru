import { execFile } from "node:child_process";
import type { DisplayDriver, ConnectionResult, PowerResult } from "./displayDriver.js";
import { readConnectorStatus } from "./drmConnector.js";

const DEFAULT_TIMEOUT_MS = 4_000;

export type DdcCiDriverOptions = {
  /** ddcutil の --bus 番号。display 番号より安定 */
  ddcBus: string;
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
  readonly #bus: string;
  readonly #connector: string;
  readonly #timeoutMs: number;

  constructor({ ddcBus, connector, timeoutMs }: DdcCiDriverOptions) {
    this.#bus = ddcBus;
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
        ["getvcp", "D6", "--bus", this.#bus, "--terse"],
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
    await execFileResult(
      "ddcutil",
      ["setvcp", "D6", "05", "--bus", this.#bus],
      this.#timeoutMs,
    );
  }

  async setPowerOn(): Promise<void> {
    await execFileResult(
      "ddcutil",
      ["setvcp", "D6", "01", "--bus", this.#bus],
      this.#timeoutMs,
    );
  }
}
