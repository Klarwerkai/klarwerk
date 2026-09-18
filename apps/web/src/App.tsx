// JOB 3030: DIE ÜBERSETZUNGEN WERDEN HIER AUSDRÜCKLICH GEHOLT, NICHT MEHR NEBENBEI.
// Bis zur Umstellung auf nachgeladene Seiten zog `routes.tsx` alle 24 Seitenmodule statisch mit, und
// eines davon holte `./i18n` — die Anwendung bekam ihre Sprache also über eine Nebenwirkung der
// Seitenimporte. Werden die Seiten nachgeladen, entfällt diese Kette: `useTranslation` fand keine
// i18next-Instanz mehr (`NO_I18NEXT_INSTANCE`), und `LangPill` (`shell/Topbar.tsx:42`) fiel über
// `i18n.language` — gemessen an mega63/64/65. In der ausgelieferten Anwendung war das nie sichtbar,
// weil `main.tsx:6` `./i18n` selbst holt; wer aber `App` OHNE `main.tsx` montiert, stand ohne
// Sprache da. Die Abhängigkeit ist real und gehört an die Wurzel der Anwendung, nicht an eine Seite.
import "./i18n";
import { useLocation } from "react-router-dom";
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
// JOB 3030: die Ladefläche wohnt seit dem Nachladen der Seiten in components/Splash.tsx — dieselbe
// Fläche für den Anmeldeweg hier und für den Suspense-Rückfall in routes.tsx.
import { Splash } from "./components/Splash";
// JOB 3268 (D1-R): der Hinweis auf eine neue Lieferung. Er steht hier und nicht in der Shell, weil
// er JEDE Lage betrifft — auch den Anmeldeweg, die Rechtsseiten und die shell-lose Route /mobile:
// ein Tab, der seit Stunden offen ist, ist auf allen dreien gleich alt.
import { VersionsHinweis } from "./components/VersionsHinweis";
// AUFTRAG-mega61 Block A: die beiden Rechtsseiten liegen VOR dem Anmeldetor, wie /reset und
// /sso/callback — deshalb hier und nicht in routes.tsx (das läuft erst innerhalb der Shell).
import { LegalScreen, legalPageForPath, useRechtsseitenTor } from "./legal/LegalPages";
// AUFTRAG-mega62 Block C: die Sperrfläche nach einem gescheiterten strengen Abmelden.
import { SignOutBlocked } from "./legal/SignOutBlocked";
// JOB 4333: die Zahl der noch nicht übertragenen Vorgänge auf DIESEM Gerät — kontounabhängig,
// nur lesend. Sie entscheidet, ob es überhaupt einen Grund gibt, die Erfassung ohne beantwortete
// Sitzungsfrage zu zeigen.
import { offeneVorgaengeAmGeraet } from "./lib/sessionState";
import { AppRoutes } from "./routes";
import { AppShell } from "./shell/AppShell";

// JOB 4333: die shell-lose Erfassungsroute. Dieselbe Zeichenkette entscheidet in
// `shell/AppShell.tsx` („/mobile OHNE Shell") und in `routes.tsx` über die Route; sie steht hier
// als benannte Konstante, damit der Zweck an der Torentscheidung lesbar ist.
const MOBILE_ROUTE = "/mobile";

// ================================================================================================
// JOB 4333 — DIE ADRESSE MUSS AUS DEM ROUTER KOMMEN, UND DESHALB STEHT SIE IN EINEM EIGENEN BAUTEIL.
// ================================================================================================
//
// WARUM NICHT `window.location.pathname` WIE IN DEN DREI ZWEIGEN OBEN: Jene drei sind
// Einstiegsadressen — wer dorthin wechselt, lädt ohnehin neu. Dieser Zweig muss den Wechsel WEG
// von `/mobile` bemerken, und `window.location.pathname` löst kein Rendern aus. `Gate` hängt als
// unverändertes Element unter `BrowserRouter` (`main.tsx`); React überspringt seinen Teilbaum bei
// einer Navigation, weil das Element dasselbe bleibt. Die Entscheidung von vorhin bliebe stehen,
// und `AppRoutes` zeigte die nächste Seite ohne bestätigte Sitzung. `useLocation` rendert bei jedem
// Wechsel neu — und es ist dieselbe Quelle, aus der `shell/AppShell.tsx` seine shell-lose Route
// ableitet.
//
// WARUM ALS EIGENES BAUTEIL UND NICHT ALS HOOK IN `Gate`: Ein Hook in `Gate` liefe in JEDER Lage,
// auch dort, wo gar keine Anwendung montiert ist. `apps/web/src/legal/mega61-rechtsseiten.test.tsx`
// montiert `App` bewusst OHNE Router (die Rechtsseiten liegen vor jeder Route) — ein
// unbedingtes `useLocation` dort wäre ein Absturz in einem Fall, der mit dieser Zusage nichts zu
// tun hat. Hier wird die Adresse genau dann gelesen, wenn sie gebraucht wird.
//
// Die ANWENDUNG wird durchgereicht und nicht ein zweites Mal aufgebaut: Es ist dieselbe Hülle mit
// denselben Routen, nicht eine zweite Routentabelle für `/mobile`.
function OfflineErfassungsTor({ anwendung }: { anwendung: JSX.Element }): JSX.Element {
  const { pathname } = useLocation();
  if (pathname !== MOBILE_ROUTE) {
    return <AuthScreens needsSetup={false} />;
  }
  return anwendung;
}

// Login-Gate: Ersteinrichtung → Login → Shell. Im Dev wird bei nicht
// erreichbarem Backend die Shell direkt gezeigt (Vorschau ohne Login).
function Gate(): JSX.Element {
  const s = useSession();
  // AUFTRAG-mega61 Block A: der Schalter der Rechtsseiten. Er wird UNBEDINGT gelesen (Regel der
  // Hooks), ausgewertet wird er nur auf den beiden Pfaden unten.
  const rechtsseiten = useRechtsseitenTor();
  const devPreview = import.meta.env.DEV && s.error && !s.user;
  // JOB 4333: die Anwendung selbst — EINMAL gebildet, damit der neue Zweig unten sie durchreichen
  // kann, statt eine zweite Hülle daneben aufzubauen.
  const anwendung = (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );

  // Passwort-Reset (E-Mail-Link) ist ohne Anmeldung erreichbar.
  if (window.location.pathname === "/reset") {
    return <ResetScreen />;
  }
  // FR-AUTH-07: SSO-Callback liegt vor dem Auth-Gate (Code/State → Sitzung).
  if (window.location.pathname === "/sso/callback") {
    return <SsoCallback />;
  }
  // AUFTRAG-mega61 Block A: DER DRITTE ZWEIG DERSELBEN ART — Impressum und Datenschutzerklärung
  // ohne Anmeldung. Sie MÜSSEN hier liegen: eine Datenschutzerklärung, die man erst nach der
  // Kontoanlage lesen kann, kommt nach der ersten Datenerhebung und ist damit wertlos.
  // Die Reihenfolge der bestehenden Zweige bleibt unangetastet — dieser steht dahinter, und die
  // drei Pfade sind zueinander fremd, also entscheidet die Reihenfolge ohnehin nichts.
  // Steht der Schalter auf aus, wird NICHT umgeleitet: der Ablauf läuft unverändert weiter, und
  // die Seite verhält sich damit wie jede andere unbekannte Adresse.
  const legalPage = legalPageForPath(window.location.pathname);
  if (legalPage) {
    if (!rechtsseiten.geklaert) {
      return <Splash />;
    }
    if (rechtsseiten.an) {
      return <LegalScreen page={legalPage} />;
    }
  }
  // AUFTRAG-mega62 Block C: HIER ist die Sperre, und sie steht bewusst VOR jedem geschützten
  // Zweig. Hat ein strenges Abmelden (Ablehnung des Hinweises) keine Bestätigung vom Server
  // bekommen, besteht die Sitzung womöglich fort — dann darf die Anwendung nichts Geschütztes
  // mehr zeigen, egal was `s.user` gerade sagt. Die Rechtsseiten oben bleiben erreichbar: sie
  // sind Pflichtangaben und stehen auch Unangemeldeten offen.
  if (s.signOutFailed) {
    return <SignOutBlocked />;
  }
  if (s.isLoading) {
    return <Splash />;
  }
  if (!devPreview && s.needsSetup) {
    return <AuthScreens needsSetup />;
  }
  // ==============================================================================================
  // JOB 4333 — „KEIN NUTZER" IST NICHT MEHR GLEICHBEDEUTEND MIT „ABGEMELDET".
  // ==============================================================================================
  //
  // Hier stand `if (!devPreview && !s.user) return <AuthScreens …>` — die zweiwertige Auslegung,
  // die JOB 4322 im echten Chromium gemessen hat: Nach einem Neuladen OHNE Netz verschwand die
  // eigene, noch nicht übertragene Arbeit hinter der Anmeldemaske („Station (b) Zähler sichtbar:
  // nein", `jobs/4322/runde-2/ben.md:20`). Kein Server hatte „keine Sitzung" gesagt — es konnte nur
  // niemand gefragt werden.
  //
  // DER NEUE ZWEIG IST ENG, UND JEDE SEINER DREI BEDINGUNGEN TRÄGT:
  //   1. `sitzungslage === "unbeantwortet"` — der Server hat NICHT geantwortet. Ein 401/403 (oder
  //      jeder andere echte HTTP-Status) ist eine Antwort und führt unverändert zur Anmeldemaske.
  //   2. Es liegt wirklich unübertragene Arbeit auf diesem Gerät. Ohne sie gibt es keinen Grund,
  //      die Maske zu übergehen — dann bleibt alles wie bisher.
  //   3. Die Adresse ist GENAU die shell-lose Erfassungsfläche (`OfflineErfassungsTor` oben, dort
  //      auch die Begründung, warum sie aus dem Router kommen muss). Ihre Route trägt als einzige
  //      kein Rollen-Gate (`routes.tsx`), und sie zeigt ohne Antwort des Servers auch nichts
  //      Serverseitiges: geholt wird nichts, aus einem Zwischenspeicher kommt nichts
  //      (`public/sw.js`: `/api` wird ausdrücklich NIE gecacht).
  //
  // WAS DIESER ZWEIG NICHT TUT: Er meldet niemanden an, er stellt keine Kennung wieder her und er
  // gibt keinen fremden Vorgang heraus. Wem die liegende Arbeit gehört, bleibt unbekannt, solange
  // niemand geantwortet hat — die Eigentümerbindung aus JOB 4249 gilt unverändert weiter
  // (`useOfflineQueue`: ohne bestätigtes Konto wird nichts angenommen, nichts gesendet, nichts
  // zugeordnet, nichts gelöscht). Die Fläche sagt das auch (`pages/Mobile.tsx`).
  //
  // Und er steht BEWUSST HINTER `signOutFailed` und `needsSetup`: Wer streng abgemeldet hat und
  // keine Bestätigung bekam, sieht auch ohne Netz nichts — das ist die Zusage aus AUFTRAG-mega62
  // Block C und hat Vorrang vor der eigenen Arbeit.
  if (!devPreview && !s.user) {
    if (s.sitzungslage === "unbeantwortet" && offeneVorgaengeAmGeraet() > 0) {
      return <OfflineErfassungsTor anwendung={anwendung} />;
    }
    return <AuthScreens needsSetup={false} />;
  }
  return anwendung;
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
              {/* JOB 3268 (D1-R): INNERHALB des Ungespeichert-Wächters, weil der Knopf „Neu laden"
                  genau dessen Frage stellt — und AUSSERHALB der Fehlergrenze, damit der Ausweg zur
                  neuen Version auch dann noch dasteht, wenn die Seite darunter abgestürzt ist. */}
              <VersionsHinweis />
            </NavGuardProvider>
          </ImageDescribeProvider>
        </ToastProvider>
      </RoleProvider>
    </AuthProvider>
  );
}
