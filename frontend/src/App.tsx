import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./lib/auth";
import { DemoProvider } from "./lib/demo";
import { ClientesDiaPage } from "./pages/ClientesDiaPage";
import { ConfigBancoPage } from "./pages/ConfigBancoPage";
import { ConfigStatusPage } from "./pages/ConfigStatusPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FinalizadosPage } from "./pages/FinalizadosPage";
import { ImportarPage } from "./pages/ImportarPage";
import { LoginPage } from "./pages/LoginPage";
import { RecuperacaoPage } from "./pages/RecuperacaoPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { RotasPage } from "./pages/RotasPage";
import { ScriptCursorPage } from "./pages/ScriptCursorPage";

function Guard({ admin }: { admin?: boolean }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/" replace />;
  if (admin && role !== "adm") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <DemoProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<Guard />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/clientes-do-dia" element={<ClientesDiaPage />} />
              <Route path="/clientes-recuperacao" element={<RecuperacaoPage />} />
              <Route path="/finalizados" element={<FinalizadosPage />} />
              <Route path="/rotas" element={<RotasPage />} />
              <Route element={<Guard admin />}>
                <Route path="/relatorios" element={<RelatoriosPage />} />
                <Route path="/config-status" element={<ConfigStatusPage />} />
                <Route path="/config-banco" element={<ConfigBancoPage />} />
                <Route path="/importar-planilha" element={<ImportarPage />} />
                <Route path="/script-cursor" element={<ScriptCursorPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </DemoProvider>
    </AuthProvider>
  );
}
