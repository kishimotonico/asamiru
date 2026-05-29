import { Dashboard } from "./dashboard/Dashboard";
import { useDashboardData } from "./dashboard/useDashboardData";
import { DebugOverlay } from "./debug/DebugOverlay";

export default function App() {
  const dashboardData = useDashboardData();

  return (
    <>
      <Dashboard data={dashboardData} />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
