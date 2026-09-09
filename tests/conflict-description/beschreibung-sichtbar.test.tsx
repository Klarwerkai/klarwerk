// @vitest-environment jsdom
// ================================================================================================
// JOB 3406 · KONFLIKTBESCHREIBUNG-SICHTBAR — DER VON HAND ERFASSTE SATZ STEHT WIEDER AM KONFLIKT.
// ================================================================================================
//
// DER VERLUST, gemessen: Der Altstand `c4a166ba` zeigte in `Conflicts.tsx:371-372` den Absatz
// `{c.description}`. Der heutige Stand liest `description` im ganzen Web-Modul nicht mehr — die
// Fläche leitet ihre Überschrift aus Streitpunkt/Objekttitel ab (`Conflicts.tsx:256-260`) und zeigt
// unter „Mehr" `origin.rationale` (`:298-302`). `origin.rationale` entsteht AUSSCHLIESSLICH im
// Zweig `conflict.origin === "auto" && d` (`lib/conflictBoard.ts:28-38`); ein von Hand angelegter
// Konflikt hat dort systematisch NICHTS. Wer ihn öffnete, las den Titel eines Beitrags und erfuhr
// nirgends, WARUM ein Mensch die zwei Aussagen für widersprüchlich hielt.
//
// WARUM DER AUTOMATISCHE FALL DIE BESCHREIBUNG NICHT ZEIGT (F3/F3b) — das ist keine Vorsicht,
// sondern eine Messung: `service.ts:404` schreibt bei der Erkennung `autoDescription(verdict)`, und
// `detect.ts:216-227` bildet daraus wörtlich `"Automatisch erkannt: " + verdict.begruendung`.
// Genau dieselbe `verdict.begruendung` steht als `detector.rationale` (`service.ts:391`) im „Mehr".
// Beide Felder tragen dort also DENSELBEN Satz — einmal mit fest deutschem Vorspann, eingefroren in
// der Sprache des Erkennungslaufs. Ihn ein zweites Mal hinzuschreiben wäre keine zusätzliche
// Auskunft, sondern eine verdoppelte; die Fläche des automatischen Falls bleibt deshalb Zeichen für
// Zeichen die alte.
//
// GEMOUNTET UND OHNE PLAYWRIGHT: die Browsergruppe wird aus dem Importgraphen berechnet
// (`tests/tor-inventar/browser-gruppe.ts:15-18`) — ein Playwright-Import zöge diese Datei in die
// serielle Gruppe, ohne hier etwas zu belegen. Gerüst und Mock-Bauform folgen dem direkten Nachbarn
// `tests/app/nebenweg-redaktion-mounted.test.tsx`, der dieselbe echte Seite fährt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Konfliktliste ist der einzige bewegliche Teil — die Fälle unten setzen sie, sonst nichts.
const daten = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      conflicts: { list: ok(() => daten.konflikte) },
      duplicates: { list: ok(() => []), settings: ok(() => ({ minConfidence: 0.5 })) },
      // JOB 3061 · H2: der gemeinsame Reiterkopf zählt alle vier Reiter aus echten Abrufen.
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: { list: ok(() => KOS) },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Volle Objektform, kein verkürztes Attrappenobjekt: `conflictKoPair`/`metaVon`/`SourceEvidence`
// lesen `status`, `category`, `createdAt`, `conditions`, `measures`, `sources` ohne Absicherung.
const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  category: "Technik",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [ko("ko-a", "Beitrag A"), ko("ko-b", "Beitrag B")];

/** Der Satz, den ein Mensch bei der Anlage getippt hat — wörtlich aus dem Auftrag. */
const SATZ =
  "Die eine Angabe nennt 14 Tage Frist, die andere 30 — beide berufen sich auf denselben Vertrag.";

/**
 * Der von Hand angelegte Konflikt. `origin` und `detector` fehlen BEWUSST: genau so sieht der
 * manuelle Datensatz aus (`services/conflicts/src/types.ts:63-65` — additiv/optional, Altbestand
 * ohne die Felder gilt als manuell), und genau in diesem Zweig gibt `conflictOriginInfo` keine
 * `rationale` heraus (`lib/conflictBoard.ts:39`).
 */
const KONFLIKT_MANUELL = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  type: "truth",
  description: SATZ,
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-08-01T06:00:00.000Z",
};

/** Der automatisch erkannte Konflikt, so wie ihn `service.ts:389-404` schreibt. */
const BEGRUENDUNG = "Beide Aussagen nennen unterschiedliche Fristen für denselben Vorgang.";
const KONFLIKT_AUTO = {
  ...KONFLIKT_MANUELL,
  // WÖRTLICH die Form aus `detect.ts:216-227`: Vorspann plus dieselbe Begründung.
  description: `Automatisch erkannt: ${BEGRUENDUNG}`,
  origin: "auto",
  detector: {
    trigger: "background",
    method: "model",
    confidence: 0.9,
    rationale: BEGRUENDUNG,
    quotes: { a: "ZITAT-A", b: "ZITAT-B" },
  },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/konflikte"] },
                createElement(Conflicts),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

/** Der ganze sichtbare Text der Fläche — inklusive der ZUGEKLAPPTEN „Mehr"-Inhalte, die im DOM
 *  stehen. Für den Negativwächter F4 ist das die schärfere Messung: was gar nicht im Baum steht,
 *  kann auch ein neugieriger Betrachter nicht aufklappen. */
const flaeche = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[data-testid="pruefen-flaeche"]');
  if (!el) {
    throw new Error("Konfliktfläche nicht gefunden — die Seite hat gar nicht gerendert.");
  }
  return el;
};

const text = (): string => flaeche().textContent ?? "";

/** Wie oft `nadel` im Text der Fläche steht. Ein `toContain` würde die Doppelung nicht sehen. */
const treffer = (nadel: string): number => text().split(nadel).length - 1;

/** Der Anzeigeknoten der Beschreibung, oder `null`, wenn die Fläche ihn gar nicht zeichnet. */
const beschreibungsKnoten = (): HTMLElement[] => [
  ...flaeche().querySelectorAll<HTMLElement>('[data-testid="konflikt-beschreibung"]'),
];

/**
 * Der VOLLSTÄNDIGE, geordnete Umriss der Fläche: je Element eine Zeile mit Einrückung (also der
 * Verschachtelung), Tag, `data-testid` und dem EIGENEN Text des Elements — Kinder stehen darunter,
 * in Dokumentreihenfolge.
 *
 * WARUM ES DEN BRAUCHT (Korrekturpflicht 1 aus bens Prüfung der Runde 1): F3 zählte bis hierher nur
 * Treffer einzelner Texte. Ben hat gemessen, dass ein ZUSÄTZLICHER sichtbarer Absatz im automatischen
 * Fall damit unbemerkt durchgeht (`Tests 12 passed` trotz Verstellung) — eine Trefferzahl sieht weder
 * neuen Text an neuer Stelle noch VERTAUSCHTE Blöcke. Der Umriss sieht beides, weil jede Zeile an
 * ihrer Position steht und der Vergleich die ganze Zeichenkette prüft.
 *
 * BEWUSST NICHT DRIN: Klassen und Stile (Umgestaltung bleibt erlaubt) und die Innereien von `svg`
 * (Symbolpfade der Symbolbibliothek wären Beiwerk und machten den Pin ohne Aussagegewinn brüchig).
 */
const umriss = (): string => {
  const zeilen: string[] = [];
  const lauf = (el: Element, tiefe: number): void => {
    const kennung = el.getAttribute("data-testid");
    const eigen = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? "").trim())
      .filter(Boolean)
      .join(" ");
    zeilen.push(
      `${"  ".repeat(tiefe)}${el.tagName.toLowerCase()}${kennung ? `#${kennung}` : ""}${
        eigen ? ` "${eigen}"` : ""
      }`,
    );
    // In Symbole wird nicht abgestiegen — siehe Kopfkommentar.
    if (el.tagName.toLowerCase() === "svg") {
      return;
    }
    for (const kind of [...el.children]) {
      lauf(kind, tiefe + 1);
    }
  };
  lauf(flaeche(), 0);
  return zeilen.join("\n");
};

/**
 * DER VORSTAND — gemessen, nicht abgeschrieben.
 *
 * So ist dieser Wert entstanden: `apps/web/src/pages/Conflicts.tsx` wurde im Arbeitsbaum auf den
 * Basisstand `883db64` zurückgesetzt (Nachweis: `git diff --stat 883db64 -- apps/web/src/pages/Conflicts.tsx`
 * war LEER, die Datei also byteweise die des Vorstands), dieselbe Vorlage `KONFLIKT_AUTO` gemountet
 * und `umriss()` gedruckt. Danach wurde die Lieferung wieder eingesetzt. F3 vergleicht die heutige
 * Ausgabe gegen genau diesen Wert: der automatische Fall muss Zeichen für Zeichen der alte sein.
 *
 * WENN DIESER PIN EINMAL ROT WIRD, ist das kein Wartungsärgernis, sondern die Frage, die er stellen
 * soll: Ist die Konfliktfläche im AUTOMATISCHEN Fall absichtlich anders geworden? Dann gehört der
 * neue Umriss hier hinein — und in die Rückgabe des ändernden Jobs, mit Begründung. Wer ihn ohne
 * diese Frage überschreibt, hebt den Wächter auf.
 */
const AUTOMATIK_UMRISS_BASIS = `div#pruefen-flaeche
  div
    div "Beitrag A"
    span#pruefen-pille-lauf "1 von 1"
    span#pruefen-pille-art "Wahrheit"
  div#pruefen-paar
    div#pruefen-paar-karte-a
      div
        div
          div "Beitrag A"
          div "Validiert · Technik · 2026"
        span
          button#pruefen-menue-konflikt-a
            svg
      p#pruefen-paar-text-a
        span "Aussage ko-a"
      div
        details#pruefen-mehr-konflikt-a
          summary "Mehr"
            svg
          div
            div
              div "Herkunft"
              div "Konflikt · mit KI · Automatisch erkannt · Sicherheit 90 %"
            div
              div "KI-Sicherheit der Erkennung — kein bewiesener Widerspruch"
              div "Offen · Wahrheit · Erkannt am 1.8.2026"
            div
              div "Begründung"
              div "Beide Aussagen nennen unterschiedliche Fristen für denselben Vorgang."
            div
              div "Beleg A"
              div
                span "„ ZITAT-A “"
            div
              div "Beleg dieser Seite"
              div
                div
                  span "keine Quelle hinterlegt"
                  span "·"
                  span "kein Quelldatum"
            div
              div "Beweislage"
              div
                span#conflict-evidence-balance "Keine der beiden Aussagen ist mit einer Quelle belegt. Dieser Widerspruch lässt sich deshalb nicht am Wortlaut entscheiden, sondern nur an Belegen — der nächste Schritt ist, für mindestens eine Seite eine Quelle nachzutragen."
            div
              div "Nächster Schritt"
              div "An einen Menschen eskalieren (Wahrheitskonflikt)."
            div
              div "Wirkung der Entscheidung"
              div "Die Entscheidung wird dokumentiert und protokolliert. Vertrauen/Status der Objekte werden NICHT automatisch geändert (kein stilles Überschreiben). Betroffene Objekte ggf. manuell re-validieren."
    div#pruefen-paar-karte-b
      div
        div
          div "Beitrag B"
          div "Validiert · Technik · 2026"
        span
          button#pruefen-menue-konflikt-b
            svg
      p#pruefen-paar-text-b
        span "Aussage ko-b"
      div
        details#pruefen-mehr-konflikt-b
          summary "Mehr"
            svg
          div
            div
              div "Herkunft"
              div "Konflikt · mit KI · Automatisch erkannt · Sicherheit 90 %"
            div
              div "KI-Sicherheit der Erkennung — kein bewiesener Widerspruch"
              div "Offen · Wahrheit · Erkannt am 1.8.2026"
            div
              div "Begründung"
              div "Beide Aussagen nennen unterschiedliche Fristen für denselben Vorgang."
            div
              div "Beleg B"
              div
                span "„ ZITAT-B “"
            div
              div "Beleg dieser Seite"
              div
                div
                  span "keine Quelle hinterlegt"
                  span "·"
                  span "kein Quelldatum"
            div
              div "Beweislage"
              div
                span#conflict-evidence-balance "Keine der beiden Aussagen ist mit einer Quelle belegt. Dieser Widerspruch lässt sich deshalb nicht am Wortlaut entscheiden, sondern nur an Belegen — der nächste Schritt ist, für mindestens eine Seite eine Quelle nachzutragen."
            div
              div "Nächster Schritt"
              div "An einen Menschen eskalieren (Wahrheitskonflikt)."
            div
              div "Wirkung der Entscheidung"
              div "Die Entscheidung wird dokumentiert und protokolliert. Vertrauen/Status der Objekte werden NICHT automatisch geändert (kein stilles Überschreiben). Betroffene Objekte ggf. manuell re-validieren."
  div#pruefen-aktionsband
    button#pruefen-knopf-links-gilt "Links gilt"
    button#pruefen-knopf-rechts-gilt "Rechts gilt"
    button#pruefen-knopf-beide-gelten "Beide gelten, je nach Kontext"
    button#pruefen-knopf-kein-widerspruch "Kein Widerspruch"
    button#pruefen-knopf-zweitmeinung "Zweitmeinung"`;

beforeEach(async () => {
  daten.konflikte = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ------------------------------------------------------------------------------------------------

describe("JOB 3406 · F1 — der erfasste Satz steht an der Konfliktfläche, in DE und EN", () => {
  it("F1a: DE — der wörtlich erfasste Satz ist im Baum der Fläche auffindbar", async () => {
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    expect(text()).toContain(SATZ);
  });

  it("F1b: EN — derselbe Satz steht da; er ist Nutzertext und wird nicht übersetzt", async () => {
    // Die Beschriftungen der Fläche wechseln (Kontrolle: „Truth" statt „Wahrheit"), der erfasste
    // Satz selbst bleibt wörtlich stehen. Ohne die Kontrolle wäre nicht belegt, dass EN wirklich
    // greift und der Fall nicht bloß dieselbe deutsche Fläche ein zweites Mal misst.
    daten.konflikte = [KONFLIKT_MANUELL];
    await i18n.changeLanguage("en");
    await mount();
    expect(text()).toContain("Truth");
    expect(text()).toContain(SATZ);
  });

  it("F1c: der Satz sitzt FLACH in der Fläche — ohne eine einzige Bedienung sichtbar", async () => {
    // Pflichtlieferung 7: der gewählte Tastaturweg wird gefahren, nicht behauptet. Hier ist er
    // trivial und genau deshalb belegt: der Knoten liegt in KEINEM <details>, es gibt also nichts
    // aufzuklappen — weder mit der Maus noch mit der Tastatur.
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    const knoten = beschreibungsKnoten();
    expect(knoten).toHaveLength(1);
    expect(knoten[0]?.closest("details")).toBeNull();
    expect(knoten[0]?.textContent).toBe(SATZ);
  });

  it("F1d: er gehört zum KONFLIKT, nicht zu einer der beiden Seiten", async () => {
    // Die Begründung der gewählten Stelle, als Messung: er steht ausserhalb beider Karten. Sässe er
    // in einer, behauptete die Fläche, ein Mensch habe SEITE A oder SEITE B beschrieben — er hat
    // aber den Widerspruch zwischen beiden beschrieben.
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    const knoten = beschreibungsKnoten()[0];
    expect(knoten?.closest('[data-testid="pruefen-paar-karte-a"]')).toBeNull();
    expect(knoten?.closest('[data-testid="pruefen-paar-karte-b"]')).toBeNull();
    expect(knoten?.closest('[data-testid="pruefen-paar"]')).toBeNull();
  });
});

describe("JOB 3406 · F2 — genau einmal je Konflikt", () => {
  it("F2: der Satz kommt in der ganzen Fläche EINMAL vor, nicht je Karte", async () => {
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    expect(treffer(SATZ)).toBe(1);
    expect(beschreibungsKnoten()).toHaveLength(1);
  });
});

describe("JOB 3406 · F3 — der automatische Fall bleibt Zeichen für Zeichen der alte", () => {
  it("F3: die VOLLSTÄNDIGE geordnete Ausgabe ist die des Vorstands — Zeichen für Zeichen", async () => {
    // DER eigentliche Vergleich gegen den Vorstand (Pflichtlieferung 3, Korrekturpflicht 1 aus
    // Runde 1). Nicht „diese drei Texte kommen so oft vor", sondern: die GANZE Fläche, in der
    // GANZEN Reihenfolge, gleicht dem am Basisstand `883db64` gemessenen Umriss. Ein zusätzlicher
    // Absatz irgendwo, ein vertauschtes Blockpaar, ein weggefallener Block — jedes davon macht
    // diesen Fall rot, und zwar mit lesbarem Zeilenunterschied statt einer nackten Zahl.
    daten.konflikte = [KONFLIKT_AUTO];
    await mount();
    expect(umriss()).toBe(AUTOMATIK_UMRISS_BASIS);
  });

  it("F3a: die Begründung steht wie bisher — und die Beschreibung nirgends", async () => {
    // Die gezielte Aussage zusätzlich zum Gesamtvergleich: sie benennt beim Bruch sofort, WORUM es
    // ging, während der Umriss oben sagt, WO genau sich etwas verschoben hat.
    daten.konflikte = [KONFLIKT_AUTO];
    await mount();
    // Die Begründung steht wie bisher im „Mehr" beider Karten (je Karte einmal = zweimal).
    expect(treffer(BEGRUENDUNG)).toBe(2);
    // Kein zusätzlicher Block: der Vorspann aus `detect.ts:222-225` taucht nirgends auf, die
    // gespeicherte Beschreibung wird also nicht ein zweites Mal danebengestellt.
    expect(text()).not.toContain("Automatisch erkannt:");
    expect(beschreibungsKnoten()).toHaveLength(0);
  });

  it("F3c: KALIBRIERUNG — der Umriss reagiert überhaupt auf eine Änderung der Fläche", async () => {
    // Ohne diesen Fall wäre F3 auch dann grün, wenn `umriss()` aus Versehen etwas Konstantes
    // lieferte (etwa nach einem Umbau von `flaeche()`). Der MANUELLE Konflikt unterscheidet sich
    // vom automatischen genau um die Beschreibung und die Herkunftszeile — der Umriss MUSS das
    // sehen. Er misst also nachweislich die Fläche und nicht Dauerstille.
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    expect(umriss()).not.toBe(AUTOMATIK_UMRISS_BASIS);
    expect(umriss()).toContain("p#konflikt-beschreibung");
  });

  it("F3b: auch ohne `rationale` erzeugt der automatische Zweig keinen Beschreibungsblock", async () => {
    // Der Zwischenfall: `detector` ohne Begründung. `conflictOriginInfo` lässt `rationale` dann weg
    // (`conflictBoard.ts:35`) — eine Anzeige, die nur auf `rationale` prüfte, schriebe hier den
    // nackten Vorspann „Automatisch erkannt:" als vermeintliche Menschenauskunft hin.
    daten.konflikte = [
      {
        ...KONFLIKT_AUTO,
        description: "Automatisch erkannt: ",
        detector: { trigger: "background", method: "model", confidence: 0.9 },
      },
    ];
    await mount();
    expect(text()).not.toContain("Automatisch erkannt:");
    expect(beschreibungsKnoten()).toHaveLength(0);
  });
});

describe("JOB 3406 · F4 — Redaktion und Recht gehen vor", () => {
  it("F4: bei `redacted` taucht der Satz in KEINEM Knoten auf, der Hinweis bleibt", async () => {
    // Der Server liefert die Beschreibung eines redigierten Konflikts schon gar nicht aus
    // (`services/app/src/sichtbarkeit.ts:486` setzt `description: ""`). Die Anzeige verlässt sich
    // NICHT darauf: hier kommt der Satz trotz `redacted: true` am Draht an, und die Fläche hält
    // ihn selbst zurück. Ein Riegel, der nur bei artigem Server hält, ist keiner.
    daten.konflikte = [{ ...KONFLIKT_MANUELL, redacted: true }];
    await mount();
    expect(flaeche().textContent).not.toContain(SATZ);
    expect(beschreibungsKnoten()).toHaveLength(0);
    expect(text()).toContain("Belege zurückgehalten");
  });

  it("F4b: ohne Marker steht derselbe Satz da — der Riegel ist kein Dauerzustand", async () => {
    // Die Kalibrierung zu F4. Ohne sie wäre F4 auch dann grün, wenn die Beschreibung NIE erschiene.
    daten.konflikte = [KONFLIKT_MANUELL];
    await mount();
    expect(text()).toContain(SATZ);
    expect(text()).not.toContain("Belege zurückgehalten");
  });
});

describe("JOB 3406 · F5 — kein leerer Rahmen, keine negative Aussage", () => {
  it("F5: nur Zwischenraum → kein Block, keine Beschriftung, kein Trennstrich", async () => {
    daten.konflikte = [{ ...KONFLIKT_MANUELL, description: "   " }];
    await mount();
    expect(beschreibungsKnoten()).toHaveLength(0);
  });

  it("F5b: die Fläche behauptet nirgends, dass eine Beschreibung fehlt", async () => {
    // REGELN §7: Nichtwissen wird nicht zu einer Auskunft. Gemessen gegen die zwei Wortstämme, mit
    // denen ein solcher Satz in DE unweigerlich anfinge.
    daten.konflikte = [{ ...KONFLIKT_MANUELL, description: "" }];
    await mount();
    expect(beschreibungsKnoten()).toHaveLength(0);
    expect(text()).not.toContain("Keine Beschreibung");
    expect(text()).not.toContain("keine Beschreibung");
  });
});

describe("JOB 3406 · F6 — der Satz ist Text, nicht Markup", () => {
  it("F6: eingebettetes Markup wird als Zeichen gezeigt, nicht als Knoten gebaut", async () => {
    // Codex' Auflage („untrusted HTML als Text behandeln"). React entschärft das von sich aus; der
    // Fall hält das fest, damit ein späterer Umbau auf `dangerouslySetInnerHTML` auffliegt.
    const boes = '<img src=x onerror="1"> Frist strittig';
    daten.konflikte = [{ ...KONFLIKT_MANUELL, description: boes }];
    await mount();
    const knoten = beschreibungsKnoten()[0];
    expect(knoten?.textContent).toBe(boes);
    expect(knoten?.querySelector("img")).toBeNull();
  });
});
