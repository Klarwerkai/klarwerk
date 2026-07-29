import { useTranslation } from "react-i18next";
import { AuthProvider, useSession } from "./app/AuthContext";
// AUFTRAG-mega50 Block A: der Weg zur Bildbeschreibung für die ganze App. Er steht hier und nicht in
// der AppShell, weil er — anders als die Modalgrenze — keinen DOM-Anker braucht: `AppShell` hat drei
// Rückgaben (/mobile, schmal, breit), das wären drei Montagen und damit wieder drei Wahrheiten.
// Hier ist es eine, neben den übrigen App-Kontexten, und sie deckt AUCH die shell-lose Route.
import { ImageDescribeProvider } from "./app/ImageDescribeContext";
import { NavGuardProvider } from "./app/NavGuardContext";
import { RoleProvider } from "./app/RoleContext";
import { ToastProvider } from "./app/ToastContext";
import { AuthScreens } from "./auth/AuthScreens";
import { ResetScreen } from "./auth/ResetScreen";
import { SsoCallback } from "./auth/SsoCallback";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
  // FR-AUTH-07: SSO-Callback liegt vor dem Auth-Gate (Code/State → Sitzung).
  if (window.location.pathname === "/sso/callback") {
    return <SsoCallback />;
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
          {/* AUFTRAG-mega50 Block A: der Weg zur Bildbeschreibung, einmal für die ganze App. Ohne
              Provenienz-Angabe gilt die fail-safe Vorgabe („vertraulich"); Flächen, die die Herkunft
              ihres Inhalts kennen (Capture, KnowledgeDetail), schachteln ihre eigene darunter. */}
          <ImageDescribeProvider>
            {/* Navigations-Wächter (Pedi 04.07.): fragt bei ungespeicherter Eingabe vor dem
                In-App-Seitenwechsel nach. Außerhalb der Fehlergrenze, damit er auch bei einem
                Seiten-Absturz noch trägt. */}
            <NavGuardProvider>
              {/* Bug (Pedi 04.07.): letzte Auffanglinie — kein weißer Vollbild-Absturz mehr. */}
              <ErrorBoundary>
                <Gate />
              </ErrorBoundary>
            </NavGuardProvider>
          </ImageDescribeProvider>
        </ToastProvider>
      </RoleProvider>
    </AuthProvider>
  );
}
