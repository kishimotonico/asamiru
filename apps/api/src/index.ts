import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDisplayServiceFromEnv } from "./displayRoutes.js";
import { recordDebugEvent } from "./metrics.js";
import { checkTimetableFreshness, getTimetableGeneratedAt } from "./timetable.js";

const PORT = Number(process.env.PORT ?? 8787);
const EXPECTED_TIME_ZONE = "Asia/Tokyo";
const SYSTEM_API = "system";

const displayService = createDisplayServiceFromEnv();
const app = createApp(displayService);

checkServerTimeZone();
checkTimetableFreshnessAtStartup();

serve({ fetch: app.fetch, port: PORT }, async (info) => {
  console.log(`asamiru api listening on http://localhost:${info.port}`);
  await displayService.start();
  if (!displayService.enabled) {
    console.log("[display] disabled: set ASAMIRU_DISPLAY_ENABLED=true to enable monitor integration");
  }
});

// シグナルでモニター制御サービスを停止してから終了する
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    displayService.stop();
    process.exit(0);
  });
}

/**
 * 運行日計算（serviceDateKey / currentServiceDayMinutes）と祝日ダイヤ判定（selectDiakind）は
 * サーバーのローカルタイムに依存するため、JST 以外の TZ では起動時に警告する。
 * クラッシュはさせない。
 */
function checkServerTimeZone(): void {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone === EXPECTED_TIME_ZONE) {
    return;
  }

  console.warn(
    `[startup] サーバーのタイムゾーンが ${EXPECTED_TIME_ZONE} ではありません (実際: ${timeZone})。` +
      "運行日の判定や祝日ダイヤの選択がローカルタイムに依存しているため、表示がずれる可能性があります。",
  );
  recordDebugEvent({
    kind: "error",
    api: SYSTEM_API,
    target: "timezone",
    summary: `Server time zone is ${timeZone}, expected ${EXPECTED_TIME_ZONE}`,
    detail: { timeZone, expected: EXPECTED_TIME_ZONE },
  });
}

/**
 * timetable.json は年1回未満の手動スクレイプ更新が前提。
 * generatedAt からの経過日数が閾値を超えたらダイヤ改定見落としの疑いとして警告する。
 */
function checkTimetableFreshnessAtStartup(): void {
  const freshness = checkTimetableFreshness(getTimetableGeneratedAt(), new Date());
  if (!freshness.stale) {
    return;
  }

  console.warn(
    `[startup] timetable.json が古い可能性があります (generatedAt: ${freshness.generatedAt}, ` +
      `${freshness.daysSinceGenerated}日経過)。ダイヤ改定が反映されていない場合は ` +
      "pnpm --filter api scrape:timetable で再生成してください。",
  );
  recordDebugEvent({
    kind: "error",
    api: SYSTEM_API,
    target: "timetable.json",
    summary: `timetable.json may be stale (${freshness.daysSinceGenerated} days since generatedAt)`,
    detail: {
      generatedAt: freshness.generatedAt,
      daysSinceGenerated: freshness.daysSinceGenerated,
    },
  });
}
