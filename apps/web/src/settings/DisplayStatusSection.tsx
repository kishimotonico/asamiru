import { useEffect, useState } from "react";
import type { DisplayInfoResponse } from "@asamiru/shared";
import { fetchDisplayStatus } from "../data/display";

export function DisplayStatusSection() {
  const [info, setInfo] = useState<DisplayInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDisplayStatus()
      .then((res) => setInfo(res))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return <div className="text-sm text-danger">モニター情報の取得に失敗しました: {error}</div>;
  }

  if (!info) {
    return <div className="text-sm text-ink-subtle">取得中...</div>;
  }

  if (!info.enabled) {
    return (
      <div className="text-sm text-ink-subtle">
        モニター制御は無効です（ASAMIRU_DISPLAY_ENABLED=false）
      </div>
    );
  }

  const powerLabel: Record<string, string> = {
    on: "オン",
    off: "待機中",
    unknown: "不明",
  };

  const connectionLabel: Record<string, string> = {
    connected: "接続済み",
    disconnected: "未接続",
    unknown: "不明",
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-ink-subtle">コネクタ</span>
        <span className="font-mono text-xs text-ink">{info.connector}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-ink-subtle">接続状態</span>
        <span className="text-ink">{connectionLabel[info.connection] ?? info.connection}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-ink-subtle">電源状態</span>
        <span className="text-ink">{powerLabel[info.power] ?? info.power}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-ink-subtle">希望電源</span>
        <span className="text-ink">{info.desiredPower ?? "—"}</span>
      </div>
      {info.error && (
        <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
          <span className="font-mono">{info.error.code}</span>: {info.error.message}
        </div>
      )}
    </div>
  );
}
