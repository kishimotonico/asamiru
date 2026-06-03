export function SummaryTile({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs text-white/40">{detail}</div>
    </div>
  );
}
