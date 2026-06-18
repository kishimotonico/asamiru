import { useState } from "react";
import { ControlOverlay } from "./controls/ControlOverlay";
import { DemoBadge } from "./controls/DemoBadge";
import { useIdleCursor } from "./controls/useIdleCursor";
import { Dashboard } from "./dashboard/Dashboard";
import { DebugOverlay } from "./debug/DebugOverlay";
import { SleepScreen } from "./sleep/SleepScreen";
import { useSleepController } from "./sleep/useSleepController";
import { useApplyTheme } from "./theme/useApplyTheme";

// 開発サーバーに加え、デモ（MSW で /api/debug/metrics をモック）でもデバッグパネルを出す。
const debugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";

export default function App() {
  const { sleeping, now, sleepNow } = useSleepController();
  const effectiveTheme = useApplyTheme();
  const [debugOpen, setDebugOpen] = useState(false);
  useIdleCursor(!sleeping);

  return (
    <>
      {sleeping ? <SleepScreen now={now} /> : <Dashboard />}
      {!sleeping ? (
        <ControlOverlay
          effective={effectiveTheme}
          onSleepClick={sleepNow}
          debugOpen={debugEnabled ? debugOpen : undefined}
          onDebugClick={debugEnabled ? () => setDebugOpen((current) => !current) : undefined}
        />
      ) : null}
      {debugEnabled && <DebugOverlay open={debugOpen} onOpenChange={setDebugOpen} />}
      {import.meta.env.VITE_DEMO_MODE === "true" && <DemoBadge />}
    </>
  );
}
