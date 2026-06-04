import { ControlOverlay } from "./controls/ControlOverlay";
import { useIdleCursor } from "./controls/useIdleCursor";
import { Dashboard } from "./dashboard/Dashboard";
import { DebugOverlay } from "./debug/DebugOverlay";
import { SleepScreen } from "./sleep/SleepScreen";
import { useSleepController } from "./sleep/useSleepController";
import { useApplyTheme } from "./theme/useApplyTheme";

export default function App() {
  const { sleeping, now, sleepNow } = useSleepController();
  const effectiveTheme = useApplyTheme();
  useIdleCursor(!sleeping);

  return (
    <>
      {sleeping ? <SleepScreen now={now} /> : <Dashboard />}
      {!sleeping ? <ControlOverlay effective={effectiveTheme} onSleepClick={sleepNow} /> : null}
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
