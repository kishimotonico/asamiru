import { Dashboard } from "./dashboard/Dashboard";
import { DebugOverlay } from "./debug/DebugOverlay";

export default function App() {
  return (
    <>
      <Dashboard />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
