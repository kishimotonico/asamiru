import { Dashboard } from "./dashboard/Dashboard";
import { dashboardData } from "./dashboard/data";

export default function App() {
  return <Dashboard data={dashboardData} />;
}
