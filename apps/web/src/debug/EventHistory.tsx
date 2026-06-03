import type { ApiDebugEvent, ApiDebugMetrics } from "@asamiru/shared";
import { formatTime, formatDateTime, formatDuration, formatJson, kindLabel, kindClassName } from "./format";

type EventHistoryProps = {
  metrics: ApiDebugMetrics;
  expandedEventId: string | null;
  onToggleEvent: (id: string) => void;
};

export function EventHistory({ metrics, expandedEventId, onToggleEvent }: EventHistoryProps) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <div className="text-sm font-semibold tracking-[0.08em]">EVENT HISTORY</div>
          <div className="mt-1 text-xs text-white/35">
            1行はバックエンド内で発生したイベントです。フロントからのAPI 1件は backend_request と同じ correlation の関連イベントで追います。
          </div>
        </div>
        <div className="text-xs text-white/35">{metrics.events.length} recent</div>
      </div>
      <div className="max-h-[52vh] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[#191c22] text-white/40">
            <tr>
              <th className="w-24 px-4 py-2 font-medium">Time</th>
              <th className="w-32 px-4 py-2 font-medium">Kind</th>
              <th className="w-36 px-4 py-2 font-medium">API</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="w-20 px-4 py-2 text-right font-medium">Status</th>
              <th className="w-24 px-4 py-2 text-right font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {metrics.events.map((event) => {
              const expanded = expandedEventId === event.id;
              const relatedEvents = event.correlationId
                ? metrics.events.filter((candidate) => candidate.correlationId === event.correlationId)
                : [];
              return (
                <EventRows
                  key={event.id}
                  event={event}
                  expanded={expanded}
                  relatedEvents={relatedEvents}
                  onToggle={() => onToggleEvent(event.id)}
                />
              );
            })}
            {metrics.events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/35">
                  まだ backend debug event はありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventRows({
  event,
  expanded,
  relatedEvents,
  onToggle,
}: {
  event: ApiDebugEvent;
  expanded: boolean;
  relatedEvents: ApiDebugEvent[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-t border-white/[0.06] odd:bg-white/[0.02] hover:bg-white/[0.07] ${
          expanded ? "bg-white/[0.09]" : ""
        }`}
      >
        <td className="whitespace-nowrap px-4 py-2 text-white/55">{formatTime(event.at)}</td>
        <td className="px-4 py-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${kindClassName(event.kind)}`}>
            {kindLabel(event.kind)}
          </span>
        </td>
        <td className="px-4 py-2 text-white/55">{event.api}</td>
        <td className="min-w-0 px-4 py-2">
          <div className="truncate font-mono text-white/80">{event.target}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">{event.summary}</div>
        </td>
        <td className="px-4 py-2 text-right text-white/55">{event.status ?? "-"}</td>
        <td className="px-4 py-2 text-right text-white/55">{formatDuration(event.durationMs)}</td>
      </tr>
      {expanded ? (
        <tr className="border-t border-white/[0.06] bg-black/15">
          <td colSpan={6} className="px-4 py-4">
            <EventDetail event={event} relatedEvents={relatedEvents} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EventDetail({ event, relatedEvents }: { event: ApiDebugEvent; relatedEvents: ApiDebugEvent[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <dl className="grid gap-x-4 gap-y-2 text-xs md:grid-cols-[112px_minmax(0,1fr)_112px_minmax(0,1fr)]">
        <DetailRow label="ID" value={event.id} mono />
        <DetailRow label="Kind" value={kindLabel(event.kind)} />
        <DetailRow label="Target" value={event.target} mono />
        <DetailRow label="Time" value={formatDateTime(event.at)} />
        <DetailRow label="Correlation" value={event.correlationId ?? "-"} mono />
        <DetailRow label="Status" value={String(event.status ?? "-")} />
        <DetailRow label="Duration" value={formatDuration(event.durationMs)} />
        <DetailRow label="Summary" value={event.summary} />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Detail</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/65">
            {formatJson(event.detail ?? {})}
          </pre>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Related Events</div>
          <div className="mb-2 text-[11px] text-white/35">
            同じ backend request の中で発生した cache / upstream / calculation / error です。
          </div>
          <div className="max-h-48 space-y-1.5 overflow-auto">
            {relatedEvents.length > 0 ? (
              relatedEvents.map((related) => (
                <div key={related.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/35">{formatTime(related.at)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="text-white/70">{kindLabel(related.kind)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="font-mono text-white/55">{related.target}</span>
                </div>
              ))
            ) : (
              <div className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-white/35">関連イベントはありません。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-white/35">{label}</dt>
      <dd className={`min-w-0 break-words text-white/70 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </>
  );
}
