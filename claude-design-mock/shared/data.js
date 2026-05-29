// Mock data for the dashboard. Centralized so both variants share identical info.
window.DASHBOARD_DATA = {
  now: {
    time: "07:24",
    date: { y: 2025, m: 2, d: 11, weekday: "火" },
    holiday: "建国記念の日",
  },
  weather: {
    location: "東京",
    today: {
      label: "晴れのち曇り",
      high: 11,
      low: 2,
      pop: 10, // precipitation %
      hourly: [
        { h: "06", icon: "sun",   temp: 3,  pop: 0 },
        { h: "09", icon: "sun",   temp: 7,  pop: 0 },
        { h: "12", icon: "cloud", temp: 11, pop: 10 },
        { h: "15", icon: "cloud", temp: 10, pop: 20 },
        { h: "18", icon: "cloud", temp: 6,  pop: 20 },
        { h: "21", icon: "cloud", temp: 4,  pop: 10 },
      ],
    },
    tomorrow:    { label: "雨", icon: "rain",  high: 9,  low: 3, pop: 80, weekday: "水" },
    dayAfter:    { label: "晴れ", icon: "sun",  high: 12, low: 2, pop: 0,  weekday: "木" },
  },
  trains: {
    station: "きさらぎ",
    departures: {
      東京方面: [
        { time: "07:32", kind: "快速",     dest: "東京",     delay: 0 },
        { time: "07:38", kind: "各停",     dest: "大島",     delay: 0 },
        { time: "07:47", kind: "区間急行", dest: "東京",     delay: 0 },
      ],
      沖ノ鳥方面: [
        { time: "07:35", kind: "各停", dest: "沖ノ鳥",   delay: 0 },
        { time: "07:41", kind: "各停", dest: "沖ノ鳥",   delay: 2, scheduled: "07:39" },
        { time: "07:48", kind: "快速", dest: "沖ノ鳥",   delay: 0 },
      ],
    },
    lines: [
      { name: "柚子線",             status: "平常運転",   level: "ok" },
      { name: "まど線",             status: "平常運転",   level: "ok" },
      { name: "七風曲芸ライン",     status: "遅延 約15分", level: "warn", note: "人身事故の影響" },
      { name: "みのりエクスプレス", status: "平常運転",   level: "ok" },
    ],
  },
  // 予定はざっくり・少数想定。when は「終日 / 午前 / 午後 / 夕方 / 夜」など曖昧表現か、
  // ピンポイントなら time を持つ。多くは時刻なしのおおまかな予定。
  schedule: {
    today: [
      { when: "夕方", title: "保育園おむかえ 当番" },
      { when: "夜",   title: "燃えるゴミ 出す" },
    ],
    upcoming: [
      { date: "明日 (水)", when: "終日", title: "有給休暇" },
      { date: "土 2/15",  when: "午後", title: "美容院" },
    ],
  },
};
