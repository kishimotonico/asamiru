import { Dashboard } from "./dashboard/Dashboard";
import { dashboardData } from "./dashboard/data";
import { DebugOverlay } from "./debug/DebugOverlay";

export default function App() {
  return (
    <>
      <Dashboard data={dashboardData} />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
