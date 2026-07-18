import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { KnowledgeObject, KoSource } from "../api/types";
import i18n from "../i18n";

// SCRUM-513/486 (Design-Batch A): schlanke, DOM-freie Render-Hilfen. Die apps/web-Testumgebung läuft in
// `node` (kein jsdom/RTL) → wir rendern Komponenten mit react-dom/server zu statischem Markup und prüfen
// den erzeugten HTML-String (Sichtvertrag: welche Inhalte/Labels erscheinen). i18n wird über die echte
// App-Instanz initialisiert (Seiteneffekt-Import); die Sprache lässt sich je Test umschalten.

// Rendert ein Element zu HTML-Markup (aktuelle i18n-Sprache).
export function renderMarkup(el: ReactElement): string {
  return renderToStaticMarkup(el);
}

// Setzt die i18n-Sprache für nachfolgende Renders (DE/EN/NL). Deterministisch awaitbar.
export async function setLanguage(lng: "de" | "en" | "nl"): Promise<void> {
  await i18n.changeLanguage(lng);
}

// Vollständiges Test-KO mit sinnvollen Defaults; einzelne Felder per `over` überschreibbar.
export function makeKo(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 84,
    trust: 80,
    status: "validiert",
    version: 3,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-05-01T09:00:00.000Z",
    history: [],
    sources: [],
    ...over,
  };
}

// Test-Quelle mit Defaults (externe, verlinkbare Quelle mit Datum).
export function makeSource(over: Partial<KoSource> = {}): KoSource {
  return {
    id: "src-1",
    label: "Herstellerhandbuch, Kap. 4",
    url: "https://example.com/handbuch",
    excerpt: "Ventil bei Überdruck schließen.",
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    author: "anna",
    at: "2026-04-20T10:00:00.000Z",
    ...over,
  };
}
