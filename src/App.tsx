import { CardsDashboard } from "./components/dashboard/CardsDashboard";
import { dashboardData } from "./data/dashboardData";

export default function App() {
  return <CardsDashboard data={dashboardData} />;
}
