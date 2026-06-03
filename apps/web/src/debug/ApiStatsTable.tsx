import type { ApiDebugMetrics } from "@asamiru/shared";
import { formatTime } from "./format";

type Props = {
  metrics: ApiDebugMetrics;
};

export function ApiStatsTable({ metrics }: Props) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="text-sm font-semibold tracking-[0.08em]">API STATS</div>
        <div className="mt-1 text-xs text-white/35">
          外部APIへの負荷は Upstream と Cache Hit / Miss を見ます。Upstream は外部APIへ送信を試みた回数です。
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[#191c22] text-white/40">
            <tr>
              <th className="px-4 py-2 font-medium">API</th>
              <th className="px-4 py-2 text-right font-medium">Backend</th>
              <th className="px-4 py-2 text-right font-medium">Upstream</th>
              <th className="px-4 py-2 text-right font-medium">Cache Hit</th>
              <th className="px-4 py-2 text-right font-medium">Cache Miss</th>
              <th className="px-4 py-2 text-right font-medium">Errors</th>
              <th className="px-4 py-2 font-medium">Last</th>
            </tr>
          </thead>
          <tbody>
            {metrics.apiStats.map((stat) => (
              <tr key={stat.api} className="border-t border-white/[0.06] odd:bg-white/[0.02]">
                <td className="px-4 py-2">
                  <div className="font-semibold text-white/80">{stat.label}</div>
                  <div className="text-[11px] text-white/35">{stat.api}</div>
                </td>
                <td className="px-4 py-2 text-right text-white/65">{stat.backendRequests}</td>
                <td className="px-4 py-2 text-right text-white/80">{stat.upstreamRequests}</td>
                <td className="px-4 py-2 text-right text-emerald-200/80">{stat.cacheHits}</td>
                <td className="px-4 py-2 text-right text-amber-200/80">{stat.cacheMisses}</td>
                <td className="px-4 py-2 text-right text-red-200/80">{stat.errors}</td>
                <td className="whitespace-nowrap px-4 py-2 text-white/45">{formatTime(stat.lastEventAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
