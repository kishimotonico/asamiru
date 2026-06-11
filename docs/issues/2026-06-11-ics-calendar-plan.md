# ICS カレンダー予定連携 実装計画

CalendarCard の「予定なし」プレースホルダーを実データ化する。[プロジェクト分析](2026-06-11-project-analysis.md) の課題5。

## 方針

Google Calendar API（OAuth）ではなく **ICS 非公開 URL の購読**にする。理由: 認証レスで秘密はURLのみ、Google 以外のカレンダーも同じ仕組みで扱える、既存の rail 系と同じ「API が取得・正規化・TTL キャッシュ、Web は POST で受ける」パターンに乗る。

## 設計

### packages/shared

```ts
// calendar.ts（新規、index.ts から re-export）
export type CalendarEvent = {
  title: string;
  start: string;      // ISO 8601（JST オフセット付き）
  end: string;
  allDay: boolean;
};
export type CalendarEventsRequest = { icsUrls: string[]; days?: number };
export type CalendarEventsResponse = { events: CalendarEvent[]; checkedAt: string };
```

### apps/api

- `calendar.ts`（新規）: ICS の取得・パース・正規化。`node-ical` を依存追加（RRULE 展開を自前実装しない）。URL ごとに TTL キャッシュ（10分）。`withUpstream` で計測、既存の debug イベント記録パターンに従う
- URL 検証: `https:` のみ許可。不正は throw（フォールバック禁止の方針どおり）
- 範囲: 今日の 00:00（JST）から `days`（既定7日、上限14日）先まで。繰り返し予定は展開、終日判定は DATE 型 or 00:00-00:00
- ルート: `railRoutes.ts` と同様に `calendarRoutes.ts` を新設し `POST /api/calendar/events`。空の `icsUrls` は 400 ではなく `{ events: [] }` を返す（設定未入力は正常系）
- テスト: 固定 ICS フィクスチャ（単発・繰り返し・終日・タイムゾーン付き）でパーサーをテスト、ルートテストも既存パターンで

### apps/web

- `settings/calendarSettingsAtom.ts`（新規）: `{ icsUrls: string[] }` を mergedStorage で永続化
- `settings/CalendarSettingsSection.tsx`（新規）: URL の追加・削除（1〜3件想定）。SettingsModal に組み込み
- `data/calendarEvents.ts`（新規）: POST フェッチの薄い関数
- `dashboardQueries.ts`: `calendarEventsQueryOptions`（refetchInterval 10分、queryKey に icsUrls）
- `CalendarDataCard.tsx`（新規）: Weather/Trains と同じ「データ取得ラッパー＋表示専用」分離。AsyncCardBoundary で境界化
- `CalendarCard.tsx`: 予定欄に「今日・明日の予定」を時刻付きで表示（終日は時刻なし）。icsUrls 未設定時は現行の「予定なし」を維持
- 見た目は docs/frontend-design.md の規約に従う

## 注意

- ICS URL は秘密情報。デバッグイベント・ログに **URL 全文を残さない**（ホスト名のみ可）
- 月グリッド部分（buildMonth）は既存テストで固定済み。予定欄の追加でグリッドの挙動を変えない
- node-ical の型は粗いので、正規化層で必ず検証してから CalendarEvent に変換する
