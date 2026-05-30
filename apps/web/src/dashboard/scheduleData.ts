import type { DashboardData } from "./types";

export const scheduleData: DashboardData["schedule"] = {
  today: [
    { when: "夕方", title: "保育園おむかえ 当番" },
    { when: "夜", title: "燃えるゴミ 出す" },
  ],
  upcoming: [
    { date: "2/12（水）", when: "終日", title: "有給休暇" },
    { date: "2/15（土）", when: "午後", title: "美容院" },
  ],
};
