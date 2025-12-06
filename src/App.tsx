import ControllerPage from "./pages/ControllerPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const p = location.pathname;
  if (p.startsWith("/admin")) return <AdminPage />;
  return <ControllerPage />;
}
