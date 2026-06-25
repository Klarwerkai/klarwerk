import { useTranslation } from "react-i18next";
import { AuthProvider, useSession } from "./app/AuthContext";
import { RoleProvider } from "./app/RoleContext";
import { ToastProvider } from "./app/ToastContext";
import { AuthScreens } from "./auth/AuthScreens";
import { ResetScreen } from "./auth/ResetScreen";
import { AppRoutes } from "./routes";
import { AppShell } from "./shell/AppShell";

function Splash(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid h-full place-items-center text-sm text-muted">{t("state.loading")}</div>
  );
}

// Login-Gate: Ersteinrichtung → Login → Shell. Im Dev wird bei nicht
// erreichbarem Backend die Shell direkt gezeigt (Vorschau ohne Login).
function Gate(): JSX.Element {
  const s = useSession();
  const devPreview = import.meta.env.DEV && s.error && !s.user;

  // Passwort-Reset (E-Mail-Link) ist ohne Anmeldung erreichbar.
  if (window.location.pathname === "/reset") {
    return <ResetScreen />;
  }
  if (s.isLoading) {
    return <Splash />;
  }
  if (!devPreview && s.needsSetup) {
    return <AuthScreens needsSetup />;
  }
  if (!devPreview && !s.user) {
    return <AuthScreens needsSetup={false} />;
  }
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <RoleProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </RoleProvider>
    </AuthProvider>
  );
}
