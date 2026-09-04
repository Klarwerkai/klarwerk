// @vitest-environment jsdom
// ================================================================================================
// JOB 3045 — DER LIVE-CHECK SAGT AUCH, WO DER TREFFER LIEGT.
// ================================================================================================
//
// Der Server liefert `koStatus`/`koCategory` seit JOB 3031 an POST /api/knowledge/check
// (services/app/src/knowledge-check.ts:31-44). Der Client warf beide Felder bis heute im Typ weg
// (apps/web/src/api/types.ts) — die Information kam am Draht an und sah nie ein Mensch.
//
// Diese Datei prüft die GANZE Kette und nicht ihre Mitte:
//   Draht → Client-Typ → mapKnowledgeCheck → LiveVerdict → LiveReactionZone → sichtbarer Text.
// Fall E ist deshalb der tragende Fall: er mockt die Antwort des Endpunkts und liest das Ergebnis
// am gemounteten DOM ab. Die reinen Präsentationsfälle A–D/F allein könnten eine abgeschnittene
// Durchreichung im Hook nicht bemerken.
//
// DIE NULL-REGEL IST HIER DER EIGENTLICHE VERTRAG: `null` heißt „der Bestand sagt dazu nichts".
// Es heißt NICHT „offen" und NICHT „keine Kategorie". Fall C hält fest, dass die Fläche dann
// SCHWEIGT — keine Zeile, kein „—", kein „unbekannt".
//
// Gemessen wird am sichtbaren Text (`textContent`), nicht am rohen HTML: Klassennamen und
// Attribute sind keine Aussage an den Menschen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draht = vi.hoisted(() => ({
  antwort: { status: "done", similar: [], conflicts: [] } as unknown,
  aufrufe: 0,
}));

// Nur der eine Endpunkt, den der Hook ruft. Kein Netz, keine zweite Quelle.
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    knowledge: {
      check: vi.fn(async () => {
        draht.aufrufe += 1;
        return draht.antwort;
      }),
    },
  },
}));

import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KoStatus } from "../../apps/web/src/api/types";
import { LiveReactionZone } from "../../apps/web/src/components/capture/intake/LiveReactionZone";
import { useLiveKnowledgeCheck } from "../../apps/web/src/components/capture/intake/useLiveKnowledgeCheck";
import i18n from "../../apps/web/src/i18n";
import type { LiveVerdict } from "../../apps/web/src/lib/intakeSimilarity";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function inRouter(el: ReactElement): ReactElement {
  return createElement(MemoryRouter, null, el);
}

async function render(el: ReactElement): Promise<void> {
  await act(async () => {
    root.render(inRouter(el));
    await flush();
  });
  // Zweiter Durchlauf: die Effekte des ersten Commits (u. a. der debounced Endpunktlauf des Hooks)
  // starten erst, wenn der erste `act`-Rahmen geschlossen ist — sonst bliebe es bei „checking".
  await act(flush);
}

// Der Anzeigeweg, wie ihn KnowledgeIntake.tsx:41/:146 fährt: Hook → Verdict → Zone. Nur hier
// zusammengesetzt, damit Fall E die echte Kette misst und nicht einen handgebauten Verdict.
function Sonde({ text, debounceMs }: { text: string; debounceMs: number }): ReactElement {
  const verdict = useLiveKnowledgeCheck(text, debounceMs);
  return createElement(LiveReactionZone, { verdict });
}

// Rendert, ohne auf irgendetwas zu warten (die Effekte laufen erst danach).
async function zeigen(el: ReactElement): Promise<void> {
  await act(async () => {
    root.render(inRouter(el));
  });
}

// Wartet echte Zeit ab. React führt seine Effekte über den Scheduler in einem Makrotask aus —
// deshalb braucht auch das bloße Sichtbarwerden von „checking" einen Tick.
async function warten(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

// Ein Sprachwechsel rendert bereits montierte Bäume neu → in `act` einfassen.
async function spracheSetzen(lng: "de" | "en" | "nl"): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const fundortZeile = (): Element | null => container.querySelector('[data-testid="live-fundort"]');
// Der ZUSAMMENGESETZTE sichtbare Text der Fundortzeile. Genau er ist das, was ein Mensch liest —
// nicht die einzelnen Stücke. Fall G/H messen daran, weil der Fehler aus Runde 2 erst im
// Zusammenspiel entstand: Label und Zustand waren je für sich richtig, zusammen gelesen falsch.
const fundortText = (): string | null => {
  const z = fundortZeile();
  return z === null ? null : (z.textContent ?? "").replace(/\s+/g, " ").trim();
};

// Ein Verdict der Lage „Treffer" mit frei gesetztem Fundort — für die Kombinationstabelle.
const treffer = (koCategory: string | null, koStatus: KoStatus | null): LiveVerdict => ({
  status: "similar",
  match: { koId: "k1", title: "Not-Aus vor Wartung", score: 0.6, koStatus, koCategory },
});

beforeEach(() => {
  draht.antwort = { status: "done", similar: [], conflicts: [] };
  draht.aufrufe = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 3045 · Fundort in der Live-Zone", () => {
  it("A · similar mit Kategorie UND Zustand: beides steht auf der Fläche", async () => {
    const verdict: LiveVerdict = {
      status: "similar",
      match: {
        koId: "k1",
        title: "Not-Aus vor Wartung",
        score: 0.6,
        koStatus: "validiert",
        koCategory: "Arbeitssicherheit",
      },
    };
    await render(createElement(LiveReactionZone, { verdict }));
    expect(fundortZeile()).not.toBeNull();
    expect(text()).toContain("Arbeitssicherheit");
    expect(text()).toContain("Validiert");
    // Der bestehende Titel-/Linkvertrag bleibt unangetastet.
    expect(text()).toContain("Not-Aus vor Wartung");
    expect(container.querySelector('a[href="/wissen/k1"]')).not.toBeNull();
  });

  it("B · Zustand null: die Kategorie steht da, ein Zustandswort wird NICHT erfunden", async () => {
    const verdict: LiveVerdict = {
      status: "similar",
      match: {
        koId: "k1",
        title: "Not-Aus vor Wartung",
        score: 0.6,
        koStatus: null,
        koCategory: "Arbeitssicherheit",
      },
    };
    await render(createElement(LiveReactionZone, { verdict }));
    expect(fundortZeile()).not.toBeNull();
    expect(text()).toContain("Arbeitssicherheit");
    // Weder der Standardwert „Offen" noch irgendein anderes Zustandswort.
    expect(text()).not.toContain("Offen");
    expect(text()).not.toContain("Validiert");
  });

  it("C · beides null: die Fundortzeile entsteht gar nicht — kein Platzhalter", async () => {
    const verdict: LiveVerdict = {
      status: "similar",
      match: {
        koId: "k1",
        title: "Not-Aus vor Wartung",
        score: 0.6,
        koStatus: null,
        koCategory: null,
      },
    };
    await render(createElement(LiveReactionZone, { verdict }));
    expect(fundortZeile()).toBeNull();
    expect(text()).not.toContain("—");
    expect(text()).not.toContain("unbekannt");
    expect(text()).not.toContain("Offen");
    expect(text()).not.toContain("Validiert");
    // Der Treffer selbst bleibt vollständig sichtbar: nur der ORT fehlt, nicht der Fund.
    expect(text()).toContain("Not-Aus vor Wartung");
    expect(container.querySelector('a[href="/wissen/k1"]')).not.toBeNull();
  });

  it("D · conflict trägt den Fundort ebenso (nicht nur similar)", async () => {
    const verdict: LiveVerdict = {
      status: "conflict",
      match: {
        koId: "k9",
        title: "Alte Regel",
        score: 1,
        koStatus: "offen",
        koCategory: "Verwaltung",
      },
    };
    await render(createElement(LiveReactionZone, { verdict }));
    expect(fundortZeile()).not.toBeNull();
    expect(text()).toContain("Verwaltung");
    expect(text()).toContain("Offen");
    expect(text()).toContain("könnte widersprechen");
  });

  it("E · DURCHREICHUNG: was der Endpunkt sendet, steht auf der Fläche", async () => {
    draht.antwort = {
      status: "done",
      similar: [
        { id: "k1", title: "T", score: 0.7, koStatus: "validiert", koCategory: "Verwaltung" },
      ],
      conflicts: [],
    };
    await render(
      createElement(Sonde, {
        text: "Vor jeder Wartung den Not-Aus ziehen und sichern.",
        debounceMs: 0,
      }),
    );
    expect(draht.aufrufe).toBe(1);
    expect(fundortZeile()).not.toBeNull();
    expect(text()).toContain("Verwaltung");
    expect(text()).toContain("Validiert");
  });

  it("E2 · tippt der Mensch weiter, verschwindet der Fundort mit dem Treffer", async () => {
    draht.antwort = {
      status: "done",
      similar: [
        { id: "k1", title: "T", score: 0.7, koStatus: "validiert", koCategory: "Verwaltung" },
      ],
      conflicts: [],
    };
    // Bewusst grober Debounce (300 ms): so lässt sich das Fenster zwischen „neuer Text" und
    // „neue Antwort" sauber betreten, ohne auf Zufälle der Ereignisschleife zu bauen.
    await zeigen(
      createElement(Sonde, { text: "Vor jeder Wartung den Not-Aus ziehen.", debounceMs: 300 }),
    );
    await warten(600);
    expect(fundortZeile()).not.toBeNull();

    // Neuer Text → der Hook setzt sofort „checking". Nach 20 ms ist der Effekt gelaufen, der
    // Debounce aber noch lange nicht abgelaufen: genau das Fenster, in dem die alte Aussage
    // stehenbleiben könnte. Ein Fundort zu einem Text, der so nicht mehr dasteht, wäre falsch.
    await zeigen(
      createElement(Sonde, { text: "Vor jeder Wartung den Hauptschalter.", debounceMs: 300 }),
    );
    await warten(20);
    expect(text()).toContain("Prüfe gegen euren Wissensstand");
    expect(fundortZeile()).toBeNull();
    expect(text()).not.toContain("Verwaltung");

    // Und nach der neuen Antwort ist er wieder da — er bleibt nicht dauerhaft weg.
    await warten(600);
    expect(fundortZeile()).not.toBeNull();
    expect(text()).toContain("Verwaltung");
  });

  it("F · der Zustand spricht die Sprache der Oberfläche (en/nl), nicht Deutsch", async () => {
    const verdict: LiveVerdict = {
      status: "similar",
      match: {
        koId: "k1",
        title: "Not-Aus vor Wartung",
        score: 0.6,
        koStatus: "validiert",
        koCategory: "Arbeitssicherheit",
      },
    };

    await spracheSetzen("en");
    await render(createElement(LiveReactionZone, { verdict }));
    expect(text()).toContain("Sits in:");
    expect(text()).toContain("Validated");
    expect(text()).not.toContain("Validiert");

    await spracheSetzen("nl");
    await render(createElement(LiveReactionZone, { verdict }));
    expect(text()).toContain("Staat in:");
    expect(text()).toContain("Gevalideerd");
    expect(text()).not.toContain("Validiert");
  });

  // ── DER FALL, DEN RUNDE 2 ÜBERSEHEN HAT (BEN, Korrekturpflicht 1+2) ──────────────────────────
  //
  // Der Server erzeugt diese Lage wirklich: `koStatus` kommt vom getroffenen Objekt, eine leere
  // Kategorie wird davon unabhängig zu `null` (services/app/src/knowledge-check.ts). In Runde 2
  // stand das Ortslabel fest am Zeilenanfang, also las die Fläche „Liegt in: Offen" — der Zustand
  // wurde als ORT beschriftet. Das ist keine Formsache: es ist eine Aussage, die der Bestand nie
  // gemacht hat, und damit genau der Fehler, den die null-Regel verhindern soll.
  //
  // Gemessen wird deshalb am ZUSAMMENGESETZTEN Zeilentext, nicht an einzelnen Stücken — der Fehler
  // war ja, dass Label und Zustand je für sich richtig waren und nur zusammen falsch.
  it("G · Kategorie null, Zustand belegt: der Zustand steht da, aber NIE als Ort — de/en/nl", async () => {
    const erwartet: { lng: "de" | "en" | "nl"; label: string; wort: string }[] = [
      { lng: "de", label: "Liegt in:", wort: "Offen" },
      { lng: "en", label: "Sits in:", wort: "Open" },
      { lng: "nl", label: "Staat in:", wort: "Open" },
    ];
    for (const f of erwartet) {
      await spracheSetzen(f.lng);
      await render(createElement(LiveReactionZone, { verdict: treffer(null, "offen") }));
      // Der Zustand geht NICHT verloren — die Zeile ist da und nennt ihn.
      expect(fundortZeile(), f.lng).not.toBeNull();
      expect(fundortText(), f.lng).toContain(f.wort);
      // Aber das Ortslabel fällt mit der Kategorie weg: kein „Liegt in: Offen" in keiner Sprache.
      expect(fundortText(), f.lng).not.toContain(f.label);
      expect(text(), f.lng).not.toContain(f.label);
      // Und der ganze sichtbare Zeilentext ist exakt das Zustandswort — nichts davor, nichts
      // dahinter, kein Platzhalter für die fehlende Kategorie.
      expect(fundortText(), f.lng).toBe(f.wort);
    }
  });

  // Die vier Kombinationen aus (Kategorie vorhanden|null) × (Zustand vorhanden|null), jede gegen
  // den vollständigen sichtbaren Zeilentext. Erst die Tabelle schließt die Lücke wirklich: ein Test
  // je Einzelfeld hätte den Fehler aus Runde 2 wieder durchgelassen.
  it("H · alle vier Null-Kombinationen ergeben je einen Satz, der stimmt", async () => {
    const faelle: {
      name: string;
      kategorie: string | null;
      zustand: KoStatus | null;
      zeile: string | null;
    }[] = [
      {
        name: "beides belegt",
        kategorie: "Arbeitssicherheit",
        zustand: "validiert",
        zeile: "Liegt in:ArbeitssicherheitValidiert",
      },
      {
        name: "nur Kategorie",
        kategorie: "Arbeitssicherheit",
        zustand: null,
        zeile: "Liegt in:Arbeitssicherheit",
      },
      { name: "nur Zustand", kategorie: null, zustand: "offen", zeile: "Offen" },
      { name: "nichts belegt", kategorie: null, zustand: null, zeile: null },
    ];
    for (const f of faelle) {
      await render(createElement(LiveReactionZone, { verdict: treffer(f.kategorie, f.zustand) }));
      expect(fundortText(), f.name).toBe(f.zeile);
      // In keiner der vier Lagen ein Platzhalter für das fehlende Stück.
      expect(text(), f.name).not.toContain("—");
      expect(text(), f.name).not.toContain("unbekannt");
      // Und der Treffer selbst bleibt in jeder Lage vollständig sichtbar.
      expect(text(), f.name).toContain("Not-Aus vor Wartung");
    }
  });
});
