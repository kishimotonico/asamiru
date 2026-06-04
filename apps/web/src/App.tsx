import { ControlOverlay } from "./controls/ControlOverlay";
import { useCursorToggle } from "./controls/useCursorToggle";
import { Dashboard } from "./dashboard/Dashboard";
import { DebugOverlay } from "./debug/DebugOverlay";
import { SleepScreen } from "./sleep/SleepScreen";
import { useSleepController } from "./sleep/useSleepController";
import { useApplyTheme } from "./theme/useApplyTheme";

export default function App() {
  const { sleeping, now, sleepNow } = useSleepController();
  const effectiveTheme = useApplyTheme();
  useCursorToggle(!sleeping);

  return (
    <>
      {sleeping ? <SleepScreen now={now} /> : <Dashboard />}
      {!sleeping ? <ControlOverlay effective={effectiveTheme} onSleepClick={sleepNow} /> : null}
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
