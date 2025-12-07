// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ControllerPage from "./pages/ControllerPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ControllerPage layout="s4" />} />

        <Route path="/ps" element={<ControllerPage layout="ps2" />} />

        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
