// Variant A — "Editorial Minimal"
// Tightly typographic, hairline dividers, no card containers.
// Reads as a single composed page rather than a tile dashboard.

const EditorialDashboard = ({ data, density = "regular", accent = "#1a1a1a" }) => {
  const D = data;
  const pad = density === "compact" ? 64 : density === "comfy" ? 112 : 88;
  const gap = density === "compact" ? 48 : density === "comfy" ? 96 : 72;

  return (
    <div className="editorial" style={{
      width: 1920, height: 1080,
      background: "#fbfaf7",
      color: "#1a1a1a",
      fontFamily: "'Noto Sans JP', system-ui, sans-serif",
      padding: `${pad}px ${pad}px`,
      boxSizing: "border-box",
      display: "grid",
      gridTemplateRows: "auto 1px 1fr",
      rowGap: gap * 0.6,
      "--accent": accent,
      "--rule": "#d8d3c8",
      "--ink": "#1a1a1a",
      "--ink-2": "#5a564e",
      "--ink-3": "#a39d8e",
      "--warn": "#b0422d",
    }}>

      {/* ────────── HEADER ────────── */}
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: 48 }}>
        <div>
          <div style={{
            fontFamily: "'Noto Serif JP', 'Cormorant Garamond', serif",
            fontSize: 44, fontWeight: 400, letterSpacing: "0.04em",
            color: "var(--ink-2)", lineHeight: 1, marginBottom: 18,
          }}>
            {D.now.date.y} <span style={{ color: "var(--ink-3)" }}>·</span> February
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 168, fontWeight: 300, lineHeight: 0.85, letterSpacing: "-0.02em",
            }}>
              {String(D.now.date.d).padStart(2, "0")}
            </div>
            <div style={{ paddingBottom: 18, lineHeight: 1.3 }}>
              <div style={{ fontSize: 36, fontWeight: 500, letterSpacing: "0.02em" }}>
                {D.now.date.weekday}曜日
              </div>
              {D.now.holiday && (
                <div style={{ fontSize: 22, color: "var(--warn)", marginTop: 6, letterSpacing: "0.06em" }}>
                  ◦ {D.now.holiday}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', 'Roboto Mono', ui-monospace, monospace",
            fontSize: 220, fontWeight: 200, lineHeight: 0.85,
            letterSpacing: "-0.04em",
          }}>
            {D.now.time}
          </div>
          <div style={{ marginTop: 14, fontSize: 18, color: "var(--ink-3)", letterSpacing: "0.3em", textTransform: "uppercase" }}>
            おはようございます
          </div>
        </div>
      </header>

      <div style={{ height: 1, background: "var(--rule)" }} />

      {/* ────────── BODY GRID ────────── */}
      <main style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 1px 1fr 1px 0.9fr",
        columnGap: gap * 0.55,
        alignItems: "start",
      }}>
        <EditorialWeather data={D.weather} />
        <div style={{ height: "100%", width: 1, background: "var(--rule)" }} />
        <EditorialTrains data={D.trains} />
        <div style={{ height: "100%", width: 1, background: "var(--rule)" }} />
        <EditorialSchedule data={D.schedule} />
      </main>
    </div>
  );
};

// ───────── Module: Weather ─────────
const EditorialWeather = ({ data }) => {
  const t = data.today;
  return (
    <section>
      <ModuleLabel kana="てんき" en="Weather" right={data.location} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 28, marginTop: 28 }}>
        <WeatherIcon kind={t.hourly[1].icon} size={108} strokeWidth={1.1} color="var(--ink)" />
        <div style={{ lineHeight: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 88, fontWeight: 300, letterSpacing: "-0.02em" }}>{t.high}</span>
            <span style={{ fontSize: 36, color: "var(--ink-3)" }}>°/</span>
            <span style={{ fontSize: 44, fontWeight: 300, color: "var(--ink-2)" }}>{t.low}°</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 22, color: "var(--ink-2)", letterSpacing: "0.04em" }}>
            {t.label} <span style={{ color: "var(--ink-3)", marginLeft: 12 }}>降水 {t.pop}%</span>
          </div>
        </div>
      </div>

      {/* Hourly */}
      <div style={{
        marginTop: 36,
        display: "grid",
        gridTemplateColumns: `repeat(${t.hourly.length}, 1fr)`,
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
        padding: "18px 0",
      }}>
        {t.hourly.map((h, i) => (
          <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 16, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{h.h}</div>
            <WeatherIcon kind={h.icon} size={32} color="var(--ink-2)" />
            <div style={{ fontSize: 22, fontWeight: 400 }}>{h.temp}°</div>
            <div style={{ fontSize: 13, color: h.pop > 20 ? "var(--accent)" : "var(--ink-3)" }}>
              {h.pop > 0 ? `${h.pop}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Coming days */}
      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {[data.tomorrow, data.dayAfter].map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <WeatherIcon kind={d.icon} size={40} color="var(--ink-2)" />
            <div>
              <div style={{ fontSize: 14, color: "var(--ink-3)", letterSpacing: "0.14em" }}>
                {i === 0 ? "TOMORROW" : "DAY AFTER"} · {d.weekday}
              </div>
              <div style={{ fontSize: 24, marginTop: 4 }}>
                <span style={{ fontWeight: 500 }}>{d.high}°</span>
                <span style={{ color: "var(--ink-3)" }}> / {d.low}°</span>
                <span style={{ color: "var(--ink-2)", marginLeft: 12, fontSize: 18 }}>{d.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ───────── Module: Trains ─────────
const EditorialTrains = ({ data }) => {
  return (
    <section>
      <ModuleLabel kana="でんしゃ" en="Trains" right={data.station + " 駅"} />

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 28, rowGap: 0 }}>
        {Object.entries(data.departures).map(([dir, list]) => (
          <div key={dir}>
            <div style={{
              fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.18em",
              borderBottom: "1px solid var(--rule)", paddingBottom: 10, marginBottom: 12,
            }}>
              {dir.toUpperCase().slice(0,0)}{dir}
            </div>
            {list.map((t, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                columnGap: 14,
                alignItems: "baseline",
                padding: "10px 0",
                borderBottom: i < list.length - 1 ? "1px dashed #e8e3d7" : "none",
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em",
                  color: t.delay > 0 ? "var(--warn)" : "var(--ink)",
                }}>
                  {t.delay > 0 ? (
                    <>
                      <span style={{ textDecoration: "line-through", color: "var(--ink-3)", fontSize: 20, marginRight: 6 }}>
                        {t.scheduled}
                      </span>
                      {t.time}
                    </>
                  ) : t.time}
                </div>
                <div style={{ fontSize: 17, color: "var(--ink-2)", display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{
                    fontSize: 13, padding: "2px 6px", border: "1px solid var(--rule)",
                    color: "var(--ink-2)", borderRadius: 2,
                  }}>{t.kind}</span>
                  <span>{t.dest}行</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Line status */}
      <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--rule)" }}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.18em", marginBottom: 14 }}>運行状況</div>
        <div style={{ display: "grid", gap: 10 }}>
          {data.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 18 }}>
              <StatusDot level={l.level} size={7} />
              <span style={{ minWidth: 130 }}>{l.name}</span>
              <span style={{ color: l.level === "warn" ? "var(--warn)" : "var(--ink-2)" }}>{l.status}</span>
              {l.note && <span style={{ color: "var(--ink-3)", fontSize: 14 }}>· {l.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── Module: Schedule ─────────
const EditorialSchedule = ({ data }) => {
  return (
    <section>
      <ModuleLabel kana="よてい" en="Schedule" right={data.today.length === 0 ? "予定なし" : `${data.today.length} 件`} />

      <div style={{ marginTop: 24 }}>
        {data.today.length === 0 ? (
          <div style={{ fontSize: 26, color: "var(--ink-3)", marginTop: 28, letterSpacing: "0.08em" }}>
            今日の予定はありません
          </div>
        ) : data.today.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "baseline", gap: 22,
            padding: "20px 0",
            borderBottom: i < data.today.length - 1 ? "1px solid var(--rule)" : "none",
          }}>
            <span style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 26, fontWeight: 400, color: "var(--accent)",
              minWidth: 88, letterSpacing: "0.06em", flexShrink: 0,
            }}>
              {e.when || (e.time ?? "—")}
            </span>
            <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.3, textWrap: "pretty" }}>
              {e.title}
            </span>
          </div>
        ))}
      </div>

      {data.upcoming.length > 0 && (
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.18em", marginBottom: 14 }}>
            このさき
          </div>
          {data.upcoming.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "baseline",
              columnGap: 14, fontSize: 17, color: "var(--ink-2)", padding: "8px 0",
            }}>
              <span style={{ color: "var(--ink-3)", minWidth: 104, flexShrink: 0 }}>{e.date}</span>
              <span style={{ color: "var(--ink-3)", minWidth: 44, flexShrink: 0 }}>{e.when || e.time}</span>
              <span style={{ color: "var(--ink)" }}>{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

// ───────── Shared label ─────────
const ModuleLabel = ({ kana, en, right }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 28, fontWeight: 500, letterSpacing: "0.04em",
      }}>{en}</span>
      <span style={{ fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.2em" }}>
        {kana}
      </span>
    </div>
    {right && (
      <span style={{ fontSize: 15, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
        {right}
      </span>
    )}
  </div>
);

window.EditorialDashboard = EditorialDashboard;
