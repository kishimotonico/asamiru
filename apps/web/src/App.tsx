import { Dashboard } from "./dashboard/Dashboard";
import { DebugOverlay } from "./debug/DebugOverlay";
import { SleepScreen } from "./sleep/SleepScreen";
import { useSleepController } from "./sleep/useSleepController";

export default function App() {
  const { sleeping, now, sleepNow } = useSleepController();

  return (
    <>
      {sleeping ? <SleepScreen now={now} /> : <Dashboard onSleepClick={sleepNow} />}
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
