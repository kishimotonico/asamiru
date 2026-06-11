import { describe, expect, it } from "vitest";
import { normalizeYahooTransitInfoUrl, parseYahooTrainInfo } from "../lineStatus.js";

function buildHtml({
  title,
  status,
  notes,
}: {
  title?: string;
  status?: string;
  notes?: string[];
}): string {
  const noteHtml = (notes ?? []).map((note) => `<p>${note}</p>`).join("");
  return `
    <html>
      <body>
        ${title !== undefined ? `<div class="labelLarge"><h1 class="title">${title}</h1></div>` : ""}
        ${
          status !== undefined
            ? `<div id="mdServiceStatus">
                <dl>
                  <dt>${status}</dt>
                  <dd>${noteHtml}</dd>
                </dl>
              </div>`
            : ""
        }
      </body>
    </html>
  `;
}

describe("parseYahooTrainInfo", () => {
  it("平常運転のとき level が ok になる", () => {
    const html = buildHtml({ title: "京王線", status: "平常運転" });
    const result = parseYahooTrainInfo(html);
    expect(result.sourceName).toBe("京王線");
    expect(result.status).toBe("平常運転");
    expect(result.level).toBe("ok");
    expect(result.note).toBeUndefined();
  });

  it("平常運転以外は level が warn になる", () => {
    const html = buildHtml({ title: "京王線", status: "遅延" });
    const result = parseYahooTrainInfo(html);
    expect(result.level).toBe("warn");
  });

  it("status と重複する備考は note から除外される", () => {
    const html = buildHtml({
      title: "京王線",
      status: "遅延",
      notes: ["遅延", "信号機故障の影響で遅れが発生しています。"],
    });
    const result = parseYahooTrainInfo(html);
    expect(result.note).toBe("信号機故障の影響で遅れが発生しています。");
  });

  it("複数の備考はスペース区切りで連結される", () => {
    const html = buildHtml({
      title: "京王線",
      status: "遅延",
      notes: ["備考1", "備考2"],
    });
    const result = parseYahooTrainInfo(html);
    expect(result.note).toBe("備考1 備考2");
  });

  it("備考がすべて status と重複する場合 note は undefined になる", () => {
    const html = buildHtml({
      title: "京王線",
      status: "遅延",
      notes: ["遅延"],
    });
    const result = parseYahooTrainInfo(html);
    expect(result.note).toBeUndefined();
  });

  it("タイトルが取得できない場合は throw する", () => {
    const html = buildHtml({ status: "平常運転" });
    expect(() => parseYahooTrainInfo(html)).toThrow("Yahoo transit response is not parseable");
  });

  it("#mdServiceStatus が存在しない場合は throw する", () => {
    const html = buildHtml({ title: "京王線" });
    expect(() => parseYahooTrainInfo(html)).toThrow("Yahoo transit response is not parseable");
  });

  it("status (dt) が空の場合は throw する", () => {
    const html = `
      <html>
        <body>
          <div class="labelLarge"><h1 class="title">京王線</h1></div>
          <div id="mdServiceStatus">
            <dl>
              <dt></dt>
              <dd></dd>
            </dl>
          </div>
        </body>
      </html>
    `;
    expect(() => parseYahooTrainInfo(html)).toThrow("Yahoo transit response has no status: 京王線");
  });
});

describe("normalizeYahooTransitInfoUrl", () => {
  it("数字/数字 形式の diainfo URL を許可する", () => {
    expect(normalizeYahooTransitInfoUrl("https://transit.yahoo.co.jp/diainfo/102/0")).toBe(
      "https://transit.yahoo.co.jp/diainfo/102/0",
    );
  });

  it("末尾スラッシュを除去する", () => {
    expect(normalizeYahooTransitInfoUrl("https://transit.yahoo.co.jp/diainfo/102/0/")).toBe(
      "https://transit.yahoo.co.jp/diainfo/102/0",
    );
  });

  it("http スキームは拒否する", () => {
    expect(() => normalizeYahooTransitInfoUrl("http://transit.yahoo.co.jp/diainfo/102/0")).toThrow(
      "Unsupported Yahoo transit URL",
    );
  });

  it("transit.yahoo.co.jp 以外のホストは拒否する", () => {
    expect(() => normalizeYahooTransitInfoUrl("https://example.com/diainfo/102/0")).toThrow(
      "Unsupported Yahoo transit URL",
    );
  });

  it("diainfo 以外のパスは拒否する", () => {
    expect(() => normalizeYahooTransitInfoUrl("https://transit.yahoo.co.jp/traininfo/102/0")).toThrow(
      "Unsupported Yahoo transit URL",
    );
  });

  it("数字以外を含む diainfo パスは拒否する", () => {
    expect(() => normalizeYahooTransitInfoUrl("https://transit.yahoo.co.jp/diainfo/abc/0")).toThrow(
      "Unsupported Yahoo transit URL",
    );
  });

  it("不正な URL 文字列は拒否する", () => {
    expect(() => normalizeYahooTransitInfoUrl("not-a-url")).toThrow("Invalid Yahoo transit URL");
  });
});
