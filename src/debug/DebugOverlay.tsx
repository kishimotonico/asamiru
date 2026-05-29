import { useState, useEffect } from "react";

type Info = {
  w: number;
  h: number;
  dpr: number;
  scrollY: number;
};

function snapshot(): Info {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio,
    scrollY: Math.round(window.scrollY),
  };
}

function breakpoint(w: number): string {
  if (w >= 1536) return "2xl";
  if (w >= 1280) return "xl";
  if (w >= 1024) return "lg";
  if (w >= 768) return "md";
  if (w >= 640) return "sm";
  return "xs";
}

export function DebugOverlay() {
  const [visible, setVisible] = useState(true);
  const [info, setInfo] = useState<Info>(snapshot);

  useEffect(() => {
    const update = () => setInfo(snapshot());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`") setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] select-none rounded bg-black/80 px-3 py-2.5 backdrop-blur-sm"
      style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, pointerEvents: "none" }}
    >
      <Row label="SIZE" value={`${info.w} × ${info.h}`} highlight />
      <Row label=" TW " value={breakpoint(info.w)} />
      <Row label="DPR " value={info.dpr.toFixed(1)} />
      <Row label="SCR " value={`${info.scrollY}px`} />
      <div className="mt-1.5 border-t border-white/10 pt-1 text-[10px] text-white/20">
        ` to hide
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-white/30">{label}</span>
      <span className={highlight ? "text-green-400" : "text-white/60"}>{value}</span>
    </div>
  );
}
