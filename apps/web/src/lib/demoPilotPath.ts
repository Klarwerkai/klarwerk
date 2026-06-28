// SCRUM-290: DOM-freier Demo-/Pilotpfad durch Stage-1. Führt Pilot-/Demo-Nutzer in wenigen
// Schritten durch einen kleinen, realen Ablauf und macht sichtbar, dass Klarwerk KEIN Chatbot ist,
// sondern ein Knowledge OS: quellengebunden fragen → Quelle/Trust/Status/Version sehen → bei
// ungeprüftem Wissen zur Validierung. Verweist AUSSCHLIESSLICH auf vorhandene Routen — keine neue
// Navigation, keine Suche, kein Backend, keine Engine, kein neues Statusmodell. Reine, testbare
// Datenbeschreibung; baut auf der SCRUM-289-Guidance (gesichert vs. zu prüfen) auf.
import { askQuestionHref } from "./askQuestion";

// SCRUM-275/290: demo-sichere Startfrage — trifft das validierte Seed-Wissen (Ventil X / Überdruck)
// → quellengebundene Antwort statt Lücke. Ask füllt damit nur das Eingabefeld vor (kein Auto-Submit).
const DEMO_QUESTION = "Wann muss Ventil X bei Überdruck geschlossen werden?";

// SCRUM-291: Demo-Kontext als Query-Parameter, damit der Pfad auf den Zielseiten wiedererkennbar
// ist (?demo=stage1). Reine, DOM-freie Logik. OHNE diesen Parameter ist die normale Nutzung
// vollständig unverändert (keine Banner, kein Effekt). Keine neue Route, kein Backend.
export const DEMO_PARAM = "demo";
export const DEMO_VALUE = "stage1";

// Hängt den Demo-Kontext an einen vorhandenen Href an und bewahrt eine bestehende Query
// (z. B. /fragen?q=… → /fragen?q=…&demo=stage1).
export function withDemo(href: string): string {
  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const [base, query = ""] = pathAndQuery.split("?");
  const queryParts = query ? query.split("&").filter(Boolean) : [];
  const withoutExistingDemo = queryParts.filter((part) => !part.startsWith(`${DEMO_PARAM}=`));
  const nextQuery = [...withoutExistingDemo, `${DEMO_PARAM}=${DEMO_VALUE}`].join("&");
  return `${base}?${nextQuery}${hash}`;
}

// Erkennt den Demo-Kontext aus den Query-Parametern der Zielseite.
export function isDemoContext(params: URLSearchParams): boolean {
  return params.get(DEMO_PARAM) === DEMO_VALUE;
}

export type DemoPilotStepId = "ask" | "library" | "validation";

export interface DemoPilotStep {
  id: DemoPilotStepId;
  n: number; // 1-basierte Schrittnummer (für die Anzeige)
  labelKey: string;
  descKey: string;
  to: string; // vorhandene Route
}

// Schritt 1 Ask (quellengebunden) → Schritt 2 Library/KO-Detail (Quelle/Trust/Status/Version)
// → Schritt 3 Validation (offenes/ungeprüftes Wissen prüfen). Start ist der Einstieg (diese Karte).
// SCRUM-291: Jeder Schritt trägt den Demo-Kontext (?demo=stage1) weiter → die Zielseite erkennt ihn.
export const DEMO_PILOT_PATH: readonly DemoPilotStep[] = [
  {
    id: "ask",
    n: 1,
    labelKey: "demo.ask.label",
    descKey: "demo.ask.desc",
    to: withDemo(askQuestionHref(DEMO_QUESTION)),
  },
  {
    id: "library",
    n: 2,
    labelKey: "demo.library.label",
    descKey: "demo.library.desc",
    to: withDemo("/bibliothek"),
  },
  {
    id: "validation",
    n: 3,
    labelKey: "demo.validation.label",
    descKey: "demo.validation.desc",
    to: withDemo("/validierung"),
  },
];

export function demoPilotPath(): readonly DemoPilotStep[] {
  return DEMO_PILOT_PATH;
}

// SCRUM-291: kompakte, wiedererkennbare Hinweisbox je Zielseite. Reine i18n-Schlüssel + optionaler
// nächster Schritt auf eine VORHANDENE Route (mit weitergetragenem Demo-Kontext). KO-Detail bewusst
// nicht enthalten (kein stabiler statischer Demo-Link ohne KO-ID) — Ask/Library/Validation reichen.
export type DemoSurface = "ask" | "library" | "validation";

export interface DemoBannerNext {
  labelKey: string;
  to: string; // vorhandene Route, Demo-Kontext erhalten
}

export interface DemoBanner {
  surface: DemoSurface;
  n: number; // Schrittnummer im Pfad (1..3)
  titleKey: string;
  bodyKey: string;
  next?: DemoBannerNext; // optionaler „nächster Schritt"
}

const BANNERS: Record<DemoSurface, DemoBanner> = {
  ask: {
    surface: "ask",
    n: 1,
    titleKey: "demo.banner.ask.title",
    bodyKey: "demo.banner.ask.body",
    next: { labelKey: "demo.banner.ask.next", to: withDemo("/bibliothek") },
  },
  library: {
    surface: "library",
    n: 2,
    titleKey: "demo.banner.library.title",
    bodyKey: "demo.banner.library.body",
    next: { labelKey: "demo.banner.library.next", to: withDemo("/validierung") },
  },
  validation: {
    surface: "validation",
    n: 3,
    titleKey: "demo.banner.validation.title",
    bodyKey: "demo.banner.validation.body",
  },
};

export function demoSurfaceBanner(surface: DemoSurface): DemoBanner {
  return BANNERS[surface];
}
