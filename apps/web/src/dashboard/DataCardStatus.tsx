export function dataCardStatus(refreshing?: boolean, error?: Error | null): string | undefined {
  if (refreshing) {
    return "更新中";
  }
  if (error) {
    return "前回更新失敗";
  }
  return undefined;
}

export function DataUpdateWarning({ error }: { error: Error }) {
  return <div className="mb-4 rounded-lg bg-[#fbece8] px-3 py-2 text-sm font-medium text-[#c14b3a]">前回更新失敗: {error.message}</div>;
}

export function RetryButton({ onRetry }: { onRetry?: () => void }) {
  if (!onRetry) {
    return null;
  }

  return (
    <button type="button" onClick={onRetry} className="mt-4 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
      再試行
    </button>
  );
}
