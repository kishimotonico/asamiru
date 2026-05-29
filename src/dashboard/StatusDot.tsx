type StatusDotProps = {
  level: "ok" | "warn" | "info";
};

const levelClassName = {
  ok: "bg-[#5d8b6e]",
  warn: "bg-[#c14b3a]",
  info: "bg-slate-500",
};

export function StatusDot({ level }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${levelClassName[level]}`}
    />
  );
}
