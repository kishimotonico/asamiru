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
    return <div className="text-sm text-[#c14b3a]">モニター情報の取得に失敗しました: {error}</div>;
  }

  if (!info) {
    return <div className="text-sm text-[#9aa0aa]">取得中...</div>;
  }

  if (!info.enabled) {
    return (
      <div className="text-sm text-[#9aa0aa]">
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
        <span className="text-[#9aa0aa]">コネクタ</span>
        <span className="font-mono text-xs text-[#1f2024]">{info.connector}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[#9aa0aa]">接続状態</span>
        <span className="text-[#1f2024]">{connectionLabel[info.connection] ?? info.connection}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[#9aa0aa]">電源状態</span>
        <span className="text-[#1f2024]">{powerLabel[info.power] ?? info.power}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[#9aa0aa]">希望電源</span>
        <span className="text-[#1f2024]">{info.desiredPower ?? "—"}</span>
      </div>
      {info.error && (
        <div className="rounded-md bg-[#fef2f2] px-3 py-2 text-xs text-[#c14b3a]">
          <span className="font-mono">{info.error.code}</span>: {info.error.message}
        </div>
      )}
    </div>
  );
}
