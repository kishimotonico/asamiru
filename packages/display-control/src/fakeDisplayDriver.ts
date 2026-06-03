import type { DisplayDriver, ConnectionResult, PowerResult } from "./displayDriver.js";
import type { DisplayPower } from "@asamiru/shared";

/** ハードウェアなしで動作するドライバー。WSL 開発環境・テスト用 */
export class FakeDisplayDriver implements DisplayDriver {
  #power: DisplayPower;
  #connection: "connected" | "disconnected";
  /** simulateExternal 呼出時に通知されるリスナー */
  readonly #listeners: Array<(power: DisplayPower) => void> = [];

  constructor(initialPower: DisplayPower = "on") {
    this.#power = initialPower;
    this.#connection = initialPower === "on" ? "connected" : "connected"; // 接続は常に connected
  }

  async readConnection(): Promise<ConnectionResult> {
    return { connection: this.#connection, error: null };
  }

  async readPower(): Promise<PowerResult> {
    return { power: this.#power, error: null };
  }

  async setStandby(): Promise<void> {
    this.#power = "off";
  }

  async setPowerOn(): Promise<void> {
    this.#power = "on";
  }

  /** 物理ボタン操作のシミュレーション。DisplayService に外部変化として認識させる */
  simulateExternal(power: DisplayPower): void {
    this.#power = power;
    for (const cb of this.#listeners) cb(power);
  }

  /** simulateExternal の通知を受け取るリスナーを登録する（DisplayService 内部用）*/
  onSimulate(cb: (power: DisplayPower) => void): () => void {
    this.#listeners.push(cb);
    return () => {
      const idx = this.#listeners.indexOf(cb);
      if (idx !== -1) this.#listeners.splice(idx, 1);
    };
  }
}
