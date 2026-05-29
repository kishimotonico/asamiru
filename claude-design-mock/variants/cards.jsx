// Variant B — "Soft Cards"
// Module-as-tile dashboard with rounded cards, subtle borders, paper-warm background.
// Each module is a self-contained card; reorderable in spirit.

const CardsDashboard = ({ data, density = "regular", accent = "#3a6b8a" }) => {
  const D = data;
  const pad = density === "compact" ? 40 : density === "comfy" ? 72 : 56;
  const gap = density === "compact" ? 16 : density === "comfy" ? 32 : 22;

  return (
    <div className="cards" style={{
      width: 1920, height: 1080,
      background: "#eeece4",
      color: "#1f2024",
      fontFamily: "'Noto Sans JP', 'Inter', system-ui, sans-serif",
      padding: pad,
      boxSizing: "border-box",
      display: "grid",
      gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr) minmax(0, 7fr)",
      gridTemplateRows: "auto 1fr",
      gap,
      "--accent": accent,
      "--bg": "#eeece4",
      "--card": "#ffffff",
      "--ink": "#1f2024",
      "--ink-2": "#5a5f69",
      "--ink-3": "#9aa0aa",
      "--rule": "#e8e6df",
      "--rule-strong": "#d8d5cc",
      "--warn": "#c14b3a",
      "--warn-bg": "#fbece8",
      "--ok": "#5d8b6e",
    }}>
      {/* col1, row1: Date/Time card */}
      <CardsClock data={D.now} />

      {/* col2, full height: Weather card */}
      <CardsWeather data={D.weather} style={{ gridRow: "1 / span 2" }} />

      {/* col3, full height: Trains card (含む運行状況) */}
      <CardsTrains data={D.trains} style={{ gridRow: "1 / span 2" }} />

      {/* col1, row2: Schedule card */}
      <CardsSchedule data={D.schedule} />
    </div>
  );
};

// ───────── Card shell ─────────
const Card = ({ children, style, label, kicker, right }) => (
  <section style={{
    background: "var(--card)",
    borderRadius: 18,
    padding: "28px 32px",
    boxShadow: "0 1px 0 rgba(20,20,20,0.04), 0 6px 24px -16px rgba(20,20,20,0.18)",
    display: "flex", flexDirection: "column",
    minHeight: 0, minWidth: 0,
    ...style,
  }}>
    {(label || kicker || right) && (
      <header style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          {label && <h2 style={{
            margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)",
          }}>{label}</h2>}
          {kicker && <span style={{
            fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.16em", textTransform: "uppercase",
          }}>{kicker}</span>}
        </div>
        {right && <div style={{ fontSize: 14, color: "var(--ink-3)" }}>{right}</div>}
      </header>
    )}
    {children}
  </section>
);

// ───────── Module: Clock ─────────
const CardsClock = ({ data }) => (
  <Card style={{ alignItems: "stretch" }}>
    <div style={{
      fontSize: 17, color: "var(--ink-3)", letterSpacing: "0.18em",
      display: "flex", justifyContent: "space-between",
    }}>
      <span>{data.date.y}.{String(data.date.m).padStart(2,"0")}.{String(data.date.d).padStart(2,"0")}</span>
      <span>{data.date.weekday}</span>
    </div>

    <div style={{
      fontFamily: "'JetBrains Mono', 'Roboto Mono', ui-monospace, monospace",
      fontSize: 168, fontWeight: 300, lineHeight: 1, letterSpacing: "-0.04em",
      marginTop: 6, marginBottom: 4, color: "var(--ink)",
    }}>
      {data.time}
    </div>

    {data.holiday && (
      <div style={{
        marginTop: "auto", display: "inline-flex", alignSelf: "flex-start",
        alignItems: "center", gap: 8,
        padding: "8px 14px",
        background: "var(--warn-bg)",
        color: "var(--warn)",
        borderRadius: 999,
        fontSize: 15,
        letterSpacing: "0.04em",
      }}>
        <span style={{
          display: "inline-block", width: 6, height: 6, borderRadius: 99,
          background: "var(--warn)",
        }} />
        祝日 · {data.holiday}
      </div>
    )}
  </Card>
);

// ───────── Module: Weather ─────────
const CardsWeather = ({ data, style }) => {
  const t = data.today;
  return (
    <Card label="天気" kicker={data.location} style={style}>
      {/* Today summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{
          width: 132, height: 132, borderRadius: 24,
          background: "linear-gradient(160deg, #f3efe2, #e8e4d3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <WeatherIcon kind={t.hourly[1].icon} size={84} strokeWidth={1.2} color="var(--ink)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, color: "var(--ink-3)", letterSpacing: "0.06em" }}>今日</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 96, fontWeight: 300, lineHeight: 1, letterSpacing: "-0.03em" }}>{t.high}</span>
            <span style={{ fontSize: 32, color: "var(--ink-3)" }}>°/</span>
            <span style={{ fontSize: 42, fontWeight: 300, color: "var(--ink-2)" }}>{t.low}°</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 20, color: "var(--ink-2)" }}>
            {t.label}　<span style={{ color: "var(--accent)" }}>降水 {t.pop}%</span>
          </div>
        </div>
      </div>

      {/* Hourly */}
      <div style={{
        marginTop: 26,
        background: "#f6f5ef",
        borderRadius: 14,
        padding: "18px 14px",
        display: "grid",
        gridTemplateColumns: `repeat(${t.hourly.length}, 1fr)`,
      }}>
        {t.hourly.map((h, i) => (
          <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, color: "var(--ink-3)", letterSpacing: "0.06em" }}>{h.h}:00</div>
            <WeatherIcon kind={h.icon} size={30} color="var(--ink-2)" />
            <div style={{ fontSize: 22, fontWeight: 500 }}>{h.temp}°</div>
            <div style={{
              fontSize: 12,
              color: h.pop > 20 ? "var(--accent)" : "var(--ink-3)",
              fontWeight: h.pop > 20 ? 500 : 400,
            }}>
              {h.pop > 0 ? `${h.pop}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Coming days */}
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
        {[
          { ...data.tomorrow, label0: "明日" },
          { ...data.dayAfter, label0: "明後日" },
        ].map((d, i) => (
          <div key={i} style={{
            background: "#f9f8f3",
            borderRadius: 14,
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <WeatherIcon kind={d.icon} size={42} color="var(--ink-2)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--ink-3)" }}>{d.label0} · {d.weekday}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 26, fontWeight: 500 }}>{d.high}°</span>
                <span style={{ fontSize: 16, color: "var(--ink-3)" }}>/ {d.low}°</span>
                <span style={{ fontSize: 13, color: d.pop > 20 ? "var(--accent)" : "var(--ink-3)", marginLeft: 4 }}>
                  {d.pop}%
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 1 }}>{d.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ───────── Module: Trains (含む 路線運行状況) ─────────
const CardsTrains = ({ data, style }) => {
  return (
    <Card label="交通" kicker={data.station + " 駅"} style={style}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 0 }}>
        {Object.entries(data.departures).map(([dir, list]) => (
          <div key={dir}>
            <div style={{
              fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.14em",
              paddingBottom: 10, marginBottom: 8, borderBottom: "1px solid var(--rule)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 4, height: 14, background: "var(--accent)", borderRadius: 1 }} />
              {dir}
            </div>
            {list.map((t, i) => (
              <div key={i} style={{
                padding: "12px 0",
                borderBottom: i < list.length - 1 ? "1px solid var(--rule)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em",
                    color: t.delay > 0 ? "var(--warn)" : "var(--ink)",
                  }}>
                    {t.delay > 0 ? (
                      <>
                        <span style={{ textDecoration: "line-through", color: "var(--ink-3)", fontSize: 20, marginRight: 4, fontWeight: 400 }}>
                          {t.scheduled}
                        </span>
                        {t.time}
                      </>
                    ) : t.time}
                  </div>
                  {t.delay > 0 && (
                    <span style={{
                      fontSize: 12, padding: "3px 8px", borderRadius: 99,
                      background: "var(--warn-bg)", color: "var(--warn)", fontWeight: 600,
                    }}>+{t.delay}分</span>
                  )}
                </div>
                <div style={{ fontSize: 16, color: "var(--ink-2)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    padding: "2px 7px", borderRadius: 4,
                    background: "#f0eee5", color: "var(--ink-2)",
                    letterSpacing: "0.04em",
                  }}>{t.kind}</span>
                  <span>{t.dest}行</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 路線運行状況 — 交通カード内のセクション */}
      <div style={{ marginTop: "auto", paddingTop: 22 }}>
        <div style={{
          fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.16em",
          marginBottom: 12, paddingTop: 20, borderTop: "1px solid var(--rule)",
        }}>
          運行状況
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {data.lines.map((l, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: l.level === "warn" ? "var(--warn-bg)" : "#f6f5ef",
            }}>
              <StatusDot level={l.level} size={9} />
              <span style={{ fontSize: 15, fontWeight: 600, flexShrink: 0 }}>{l.name}</span>
              <span style={{
                fontSize: 13, marginLeft: "auto", textAlign: "right",
                color: l.level === "warn" ? "var(--warn)" : "var(--ink-2)",
                fontWeight: l.level === "warn" ? 600 : 400,
              }}>
                {l.status}
                {l.note && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {l.note}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

// ───────── Module: Schedule ─────────
const CardsSchedule = ({ data }) => (
  <Card label="予定" kicker="Today" right={data.today.length === 0 ? "予定なし" : `${data.today.length} 件`}>
    {data.today.length === 0 ? (
      <div style={{ fontSize: 22, color: "var(--ink-3)", marginTop: 12 }}>
        今日の予定はありません
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {data.today.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <span style={{
              fontSize: 17, fontWeight: 600, color: "var(--accent)",
              minWidth: 64, flexShrink: 0, letterSpacing: "0.04em",
            }}>
              {e.when || e.time}
            </span>
            <span style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.25, textWrap: "pretty" }}>
              {e.title}
            </span>
          </div>
        ))}
      </div>
    )}

    {data.upcoming.length > 0 && (
      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px dashed var(--rule-strong)" }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.16em", marginBottom: 10 }}>
          このさき
        </div>
        {data.upcoming.map((e, i) => (
          <div key={i} style={{
            fontSize: 15, color: "var(--ink-2)", padding: "5px 0",
            display: "flex", gap: 12, alignItems: "baseline",
          }}>
            <span style={{ color: "var(--ink-3)", minWidth: 84, flexShrink: 0 }}>{e.date}</span>
            <span style={{ color: "var(--ink-3)", minWidth: 38, flexShrink: 0 }}>{e.when || e.time}</span>
            <span style={{ color: "var(--ink)" }}>{e.title}</span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

window.CardsDashboard = CardsDashboard;
