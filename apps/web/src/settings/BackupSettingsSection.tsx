import { useRef, useState, type ChangeEvent } from "react";
import { ActionButton, SettingField } from "./components/FormControls";
import { applySettingsBackup, createSettingsBackup, parseSettingsBackup } from "./settingsBackup";

export function BackupSettingsSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [importing, setImporting] = useState(false);

  const exportSettings = () => {
    setError(undefined);

    try {
      const exportedAt = new Date();
      const backup = createSettingsBackup(localStorage, exportedAt);
      const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `asamiru-settings-${formatDate(exportedAt)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "設定のエクスポートに失敗しました。");
    }
  };

  const importSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError(undefined);
    setImporting(true);

    try {
      const settings = parseSettingsBackup(await file.text());
      applySettingsBackup(localStorage, settings);
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "設定のインポートに失敗しました。");
      input.value = "";
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingField
        label="エクスポート"
        description="このブラウザに保存されている設定を JSON ファイルとしてダウンロードします。"
      >
        <ActionButton onClick={exportSettings}>JSON をダウンロード</ActionButton>
      </SettingField>

      <SettingField
        label="インポート"
        description="バックアップ JSON に含まれる設定を復元し、画面を再読み込みします。"
        error={error}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={importSettings}
          className="hidden"
        />
        <ActionButton onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "読み込み中..." : "JSON を選択"}
        </ActionButton>
      </SettingField>
    </div>
  );
}

function formatDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
