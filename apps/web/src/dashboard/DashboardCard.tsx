import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

type DashboardCardProps = PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
  label?: string;
  kicker?: string;
  right?: ReactNode;
}>;

export function DashboardCard({ children, className = "", style, label, kicker, right }: DashboardCardProps) {
  const hasHeader = label || kicker || right;

  return (
    <section className={`flex min-h-0 min-w-0 flex-col rounded-lg bg-surface p-5 shadow-card sm:p-7 lg:p-8 ${className}`} style={style}>
      {hasHeader ? (
        <header className="mb-5 flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-3">
            {label ? (
              <h2 className="truncate text-[17px] font-semibold tracking-[0.04em] text-ink">{label}</h2>
            ) : null}
            {kicker ? (
              <span className="truncate text-xs uppercase tracking-[0.16em] text-ink-subtle">{kicker}</span>
            ) : null}
          </div>
          {right ? <div className="shrink-0 text-sm text-ink-subtle">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
