import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("複数のクラスを結合する", () => {
    expect(cn("flex", "min-h-0")).toBe("flex min-h-0");
  });

  it("falsy な値を無視する", () => {
    expect(cn("flex", false, null, undefined, "")).toBe("flex");
  });

  it("条件付きクラスを展開する", () => {
    expect(cn("base", true && "on", false && "off")).toBe("base on");
  });

  it("標準ユーティリティの競合は後勝ちでマージする", () => {
    expect(cn("min-h-0", "min-h-[28rem]")).toBe("min-h-[28rem]");
    expect(cn("p-5", "p-8")).toBe("p-8");
  });

  it("variant が異なる場合は競合とみなさず両方残す", () => {
    expect(cn("min-h-0", "2xl:min-h-[28rem]")).toBe("min-h-0 2xl:min-h-[28rem]");
  });

  it("カスタムカラートークン（bg-*/text-*）も標準の競合グループとして後勝ちになる", () => {
    // twMerge は bg-surface/bg-canvas を任意値クラスとして同一グループに解決する想定。
    // 実挙動をテストで固定し、docs の記述根拠とする。
    expect(cn("bg-surface", "bg-canvas")).toBe("bg-canvas");
    expect(cn("text-ink", "text-ink-muted")).toBe("text-ink-muted");
  });
});
