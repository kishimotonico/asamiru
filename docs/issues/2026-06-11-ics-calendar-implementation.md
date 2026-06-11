# ICS カレンダー予定連携 実装記録

## 対象

[ICS カレンダー予定連携 実装計画](2026-06-11-ics-calendar-plan.md) に基づき、shared 型、API の ICS 取得・正規化・キャッシュ、Web の設定・取得・表示を実装する。

## 実装状況

- shared のカレンダー型を追加
- API の ICS 取得・繰り返し展開・JST 正規化・10分キャッシュとルートを追加
- Web の ICS URL 設定、TanStack Query、CalendarCard の今日・明日表示を追加
- API と Web の固定データテストを追加

## 検証

- `pnpm test`: 成功
- `pnpm build`: 成功（Vite の既存チャンクサイズ警告のみ）
