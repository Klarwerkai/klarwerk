// @vitest-environment jsdom
// ================================================================================================
// JOB 1154 D2 — D-030: DIE KONDITIONALEN TEXTTRAEGER VON /erfassen IN DE, EN UND NL.
// ================================================================================================
//
// KONDITIONALER TEXTTRAEGER heisst hier — Definition aus D1, hier unveraendert uebernommen und
// am heutigen Stand nachgemessen: ein sichtbarer Text im Standardweg von `/erfassen`, den der
// Renderer nur unter einer Bedingung ausgibt.
//
// GEMESSEN AM 04.09.2026 (JOB 3062 · H3, `pages/Capture.tsx`): **14 Traeger** — vorher 19.
// D1 und D2 hatten 19 gemessen; die Zahl ist hier nicht fortgeschrieben, sondern neu erhoben.
//
//   3 UEBERSETZT — sie werden POSITIV abgenommen: gemountet, je Sprache, gegen den Katalogtext
//     genau dieser Sprache (Block K).
//   11 EHEMALS HART DEUTSCH — sie sind von der Flaeche GENOMMEN. Block S prueft jetzt regulaer
//     gruen, dass keiner von ihnen wieder erscheint (Rueckfallwaechter statt `it.fails`).
//   5 frueher uebersetzte Traeger sind mit ihren Flaechen entfallen; sie stehen mit Begruendung
//     bei `VORLAUF` (Schrittleiste, Erzaehl-Kicker, Zurueck-Knopf).
//
// WAS SICH GEGENUEBER D2 GRUNDSAETZLICH GEAENDERT HAT: D-030 war ein gemeldeter, ungeloester
// Mangel — elf sichtbare Texte ohne jeden Katalogeintrag, gefuehrt als `it.fails`, weil ihre
// Behebung ausserhalb der damaligen Lease lag. JOB 3062 hat ihn geloest, aber anders als erwartet:
// nicht durch Uebersetzen, sondern durch Entfernen ihrer Traeger (Standardweg-Kasten, Aufklapper
// „Weitere Wege", Karte „Entwurf gespeichert"). Ein `it.fails`, das nicht mehr fehlschlaegt, meldet
// vitest selbst als Fehler — genau das ist eingetreten und war der Anlass dieses Umbaus. Aus dem
// Mangelbericht ist damit ein Schutz geworden: Wer eines der elf Literale zurueckschreibt, faellt
// in Block S auf.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      // JOB 3062: Die drei verbliebenen Traeger haengen an einer NICHT LEEREN Entwurfsliste
      // (`Capture.tsx:3988`: `draftsOpen && (drafts.data?.length ?? 0) > 0`). Mit einer leeren
      // Liste rendert ihr Bereich gar nicht, und K2 pruefte ein Element, das es nie gab.
      drafts: {
        list: ok([
          {
            id: "d-1",
            updatedAt: "2026-09-04T08:00:00.000Z",
            payload: { title: "Dosierventil DP-4", bodyHtml: "<p>Ventil klemmt.</p>" },
          },
        ]),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({
          title: "Dosierventil bei Kaltstart vorwaermen",
          statement: "Nach Stillstand klemmt das Ventil DP-4 sporadisch.",
          conditions: ["Nach Wochenendstillstand"],
          measures: ["Ventil DP-4 vor dem Anfahren vorwaermen"],
          tags: ["ventil"],
        })),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const CAPTURE_PFAD = resolve(__dirname, "../../apps/web/src/pages/Capture.tsx");

// ================================================================================================
// DAS INVENTAR — GESCHLOSSENE LISTE, 14 TRAEGER (gemessen 04.09.2026).
// ================================================================================================
// Jede Zeile nennt ihre Fundstelle. Die Identitaet eines harten Traegers ist sein LITERAL, nicht
// seine Zeilennummer: Zeilennummern verschieben sich beim naechsten Umbau, das Literal nicht.

/** Die uebersetzten Traeger, die es HEUTE noch gibt — positiv abzunehmen. */
const UEBERSETZT: ReadonlyArray<{ ort: string; key: string; was: string }> = [
  { ort: "Capture.tsx:3830", key: "capture.draftScope.noteAdmin", was: "Entwurfsliste (Admin)" },
  { ort: "Capture.tsx:3831", key: "capture.draftScope.note", was: "Entwurfsliste (Nutzer)" },
  { ort: "Capture.tsx:3838", key: "capture.draftScope.toLibrary", was: "Link in die Bibliothek" },
];

/**
 * Fuenf frueher hier gefuehrte uebersetzte Traeger sind mit JOB 3062 · H3 VON DER FLAECHE GENOMMEN
 * und stehen deshalb nicht mehr im Inventar (gemessen an `pages/Capture.tsx`, je null Vorkommen):
 *
 *     capture.flow.step.raw.label     Schrittleiste 1  }  Die sichtbare Schritt-Leiste ist fort;
 *     capture.flow.step.studio.label  Schrittleiste 2  }  das Blatt hat keine Schritte, es hat
 *     capture.flow.step.review.label  Schrittleiste 3  }  ein Blatt (Auftrag §5).
 *     capture.entry.narrateKicker     Erzaehl-Kicker      Ueberschrift der Modus-Leiste, fort.
 *     capture.wizard.back             Zurueck-Knopf       „Zurueck" liegt im Menue (§5a).
 *
 * Die KATALOGEINTRAEGE bleiben bestehen — §5a verlangt ausdruecklich, dass Textschluessel nicht
 * geloescht werden. Ungenutzt ist nicht dasselbe wie entfernt.
 */
const VORLAUF: ReadonlyArray<{ ort: string; key: string; was: string }> = [];

/**
 * Die Teilmenge, die sich fuer DIESEN Nutzer wirklich rendern laesst.
 *
 * `capture.draftScope.noteAdmin` und `capture.draftScope.note` sind die beiden ROLLENZWEIGE EINER
 * Stelle (`Capture.tsx:3991-3993`: `user?.role === "admin" ? … : …`). Der hier gemockte Nutzer ist
 * `editor`, also erscheint nur der zweite. Beide gemountet abzunehmen hiesse, den Rollen-Mock
 * mitten in der Datei umzuhaengen — dafuer waere ein zweites Modul-Mock noetig, und der Gewinn
 * waere gering: Beide Schluessel werden von K1 gegen alle drei Kataloge geprueft, und E1/E2 belegen,
 * dass die Kataloge wirklich verschieden sind. Was hier zusaetzlich gemessen wird, ist das
 * RENDERN — und dafuer genuegt der Zweig, den dieser Nutzer sieht. Das steht hier, statt still
 * einen Traeger zu ueberspringen.
 */
const SICHTBAR_FUER_DIESEN_NUTZER = UEBERSETZT.filter(
  (z) => z.key !== "capture.draftScope.noteAdmin",
);

/**
 * ================================================================================================
 * DIE 11 HART DEUTSCHEN TRAEGER — HEUTE ALLE FORT. DIESE LISTE IST JETZT EIN RUECKFALLWAECHTER.
 * ================================================================================================
 *
 * D-030s Befund war: elf sichtbare Texte im Standardweg von `/erfassen` erscheinen in de, en UND nl
 * unveraendert auf Deutsch, weil es fuer sie gar keinen Katalogeintrag gibt. Sie standen hier als
 * `it.fails` — als ehrlich benannter, ungeloester Mangel ausserhalb der damaligen Lease.
 *
 * MIT JOB 3062 · H3 IST DER MANGEL ERLEDIGT, ABER NICHT SO, WIE D-030 ES ERWARTET HAT: Nicht durch
 * Uebersetzen, sondern weil ihre TRAEGER von der Flaeche genommen sind — der Standardweg-Kasten,
 * sein Aufklapper „Weitere Wege" und die Karte „Entwurf gespeichert" nach der Rueckkehr von der
 * Vordertuer. Ein Text, den niemand mehr sieht, kann in keiner Sprache falsch dastehen.
 *
 * NACHGEMESSEN AM 04.09.2026 an `apps/web/src/pages/Capture.tsx`: neun der elf Literale kommen
 * dort gar nicht mehr vor; „Entwurf fortsetzen" und „Neuer leerer Eintrag" kommen je EINMAL vor —
 * beide ausschliesslich in einem KOMMENTAR (`:792-797`), der festhaelt, warum die Karte weg ist.
 * Kein einziges wird gerendert.
 *
 * WARUM DIE LISTE TROTZDEM STEHEN BLEIBT und nicht mit der Karte geloescht wird: Sie ist ab jetzt
 * ein Rueckfallwaechter. Wer eines dieser elf Literale wieder auf die Flaeche schreibt, hat damit
 * genau den unuebersetzten Zustand wiederhergestellt, den D-030 aufgedeckt hat — und faellt in
 * Block S auf. Eine geloeschte Liste haette diesen Schutz weggeworfen.
 */
const FRUEHER_HART: ReadonlyArray<{ ort: string; literal: string; was: string }> = [
  {
    ort: "Capture.tsx:683",
    literal: "Entwurf gespeichert:",
    was: "Hinweis nach Vordertuer-Rueckkehr",
  },
  { ort: "Capture.tsx:3368", literal: "Weitere Wege anzeigen", was: "Aufklapper, zugeklappt" },
  { ort: "Capture.tsx:3368", literal: "Weitere Wege einklappen", was: "Aufklapper, aufgeklappt" },
  { ort: "Capture.tsx:3382", literal: "Entwurf gespeichert", was: "Karten-Ueberschrift" },
  { ort: "Capture.tsx:3385", literal: "fortsetzen bereit", was: "Karten-Pille" },
  {
    ort: "Capture.tsx:3389",
    literal: "ist unter Entwürfe fortsetzen sichtbar",
    was: "Kartensatz 1",
  },
  {
    ort: "Capture.tsx:3390",
    literal: "Der gespeicherte Entwurf ist in der Liste hervorgehoben",
    was: "Kartensatz 2a",
  },
  { ort: "Capture.tsx:3390", literal: "der Dokument-Editor startet", was: "Kartensatz 2b" },
  { ort: "Capture.tsx:3401", literal: "Entwurf fortsetzen", was: "Karten-Knopf 1" },
  { ort: "Capture.tsx:3408", literal: "Neuer leerer Eintrag", was: "Karten-Knopf 2" },
  { ort: "Capture.tsx:3411", literal: "Hinweis ausblenden", was: "Karten-Knopf 3" },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Montiert `/erfassen`. Mit `mitGespeichertemEntwurf` wird der Router-State gesetzt, den die
 * Vordertuer beim Zurueckspringen mitgibt — nur dann rendert die Karte mit den harten Traegern.
 */
async function mount(mitGespeichertemEntwurf = false): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const eintrag = mitGespeichertemEntwurf
    ? [
        {
          pathname: "/erfassen",
          state: { frontDoorDraftSaved: { id: "d-1", title: "Dosierventil DP-4" } },
        },
      ]
    : ["/erfassen"];
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: eintrag },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

// Der Helfer `aufklapper()` ist mit JOB 3062 entfallen: Er suchte den Umschalter des
// Arbeitsraums ueber `button[aria-controls="capture-workspace"]`, und diesen Aufklapper gibt es
// nicht mehr (Auftrag §5 — das Blatt ist immer offen). Sein einziger Aufrufer war der frühere
// Fall S3.

const kat = (lng: Sprache, key: string): string => i18n.getFixedT(lng)(key);

/**
 * Die Entwurfsliste aufklappen — sie startet zugeklappt (`Capture.tsx:773`), und erst aufgeklappt
 * rendert der Bereich mit den drei verbliebenen Traegern (`:3988`). Der Umschalter traegt
 * `capture.resumeExpand` (`components/CaptureDraftList.tsx:120`), also je Sprache einen anderen
 * Text — gesucht wird deshalb ueber den Katalogwert der GERADE eingestellten Sprache.
 */
async function entwurfslisteAufklappen(): Promise<void> {
  const beschriftung = String(i18n.t("capture.resumeExpand", { count: 1 }));
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(beschriftung),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Der Umschalter „${beschriftung}" ist nicht auf der Seite.`);
  }
  await click(knopf);
}

/** Baut die aktuelle Montage ab. Wird in den Sprachschleifen zwischen den Sprachen gebraucht. */
function abbauen(): void {
  if (root) {
    act(() => root.unmount());
    root = undefined as unknown as ReturnType<typeof createRoot>;
  }
  container?.remove();
}

afterEach(async () => {
  // Defensiv: die Katalog-, Inventar- und Sammlerfaelle mounten bewusst nichts. Ein hartes
  // `root.unmount()` haette sie mit einem TypeError rot gemacht — und zwar aus einem Grund,
  // der mit ihrer Aussage nichts zu tun hat.
  if (root) {
    act(() => root.unmount());
    root = undefined as unknown as ReturnType<typeof createRoot>;
  }
  container?.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

// ================================================================================================
// BLOCK I — DAS INVENTAR IST GESCHLOSSEN UND VOLLSTAENDIG BESCHRIFTET
// ================================================================================================
describe("JOB 1154 D2 · D-030 Block I: das Inventar", () => {
  it("I1 · es fuehrt genau die 14 heute gemessenen Traeger", () => {
    // Die Zahl war 19 und ist 14: drei uebersetzte Traeger stehen noch auf der Flaeche, elf
    // Literale werden nur noch als Rueckfallwaechter gefuehrt, und fuenf frueher uebersetzte
    // Traeger sind mit JOB 3062 · H3 ersatzlos von der Flaeche genommen (Begruendung je Zeile
    // oben bei `VORLAUF`). Eine Zahl, die stehen bleibt, waehrend die Flaeche sich aendert, ist
    // keine Messung mehr, sondern ein Erbstueck.
    expect(UEBERSETZT.length + FRUEHER_HART.length).toBe(14);
  });

  it("I2 · keine Zeile ohne Ort, keine Zeile ohne Gegenstand", () => {
    for (const z of [...UEBERSETZT, ...VORLAUF, ...FRUEHER_HART]) {
      // Die Datei heisst `Capture.tsx`; `CaptureArbeitsraum` ist die KOMPONENTE darin. Beides zu
      // verwechseln machte diesen Fall rot, obwohl jede Zeile des Inventars eine Fundstelle trug.
      expect(z.ort, `Traeger „${z.was}“ ohne Fundstelle.`).toMatch(/^Capture\.tsx:\d/);
      expect(z.was.trim().length).toBeGreaterThan(0);
    }
  });

  it("I3 · kein Traeger steht doppelt im Inventar", () => {
    const ids = [
      ...UEBERSETZT.map((z) => `k:${z.key}`),
      ...VORLAUF.map((z) => `k:${z.key}`),
      ...FRUEHER_HART.map((z) => `l:${z.literal}|${z.was}`),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ================================================================================================
// BLOCK K — POSITIVE KATALOGABNAHME DER UEBERSETZTEN TRAEGER
// ================================================================================================
describe("JOB 1154 D2 · D-030 Block K: uebersetzte Traeger in DE/EN/NL", () => {
  it("K1 · alle drei Kataloge fuehren jeden dieser Schluessel wirklich", () => {
    // Ohne diesen Fall waere ein fehlender Eintrag unsichtbar: i18next gibt dann den
    // SCHLUESSELNAMEN zurueck, und ein Vergleich „gerendert == Katalog" waere trotzdem gruen.
    for (const z of [...UEBERSETZT, ...VORLAUF]) {
      for (const lng of SPRACHEN) {
        const wert = kat(lng, z.key);
        expect(wert, `${lng}: „${z.key}“ fehlt im Katalog (${z.ort}).`).not.toBe(z.key);
        expect(wert.trim().length, `${lng}: „${z.key}“ ist leer.`).toBeGreaterThan(0);
      }
    }
  });

  it("K2 · jeder verbliebene Traeger zeigt je Sprache genau den Katalogtext dieser Sprache", async () => {
    // Bis JOB 3062 standen hier drei Faelle: Schrittleiste (K2), Sperrgruende (K3) und
    // Erzaehl-Kicker (K4). Ihre Traeger sind von der Flaeche genommen (Auftrag §5); ein Fall, der
    // auf ein verschwundenes Element zielt, prueft nichts mehr. An ihre Stelle tritt EIN Fall
    // ueber die drei Traeger, die es wirklich noch gibt — mit demselben Mass wie bisher: gemountet,
    // je Sprache, gegen den Katalogtext GENAU dieser Sprache.
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      await mount();
      // Der Traegerbereich haengt an der AUFGEKLAPPTEN Entwurfsliste — sie startet zugeklappt
      // (`Capture.tsx:773`). Ein Mensch klickt sie auf; der Test tut dasselbe.
      await entwurfslisteAufklappen();
      const text = seitentext();
      // KALIBRIERUNG in der Schleife: eine leere Flaeche liesse jede `toContain`-Pruefung
      // sinnlos werden — deshalb erst der Beleg, dass ueberhaupt etwas gerendert ist.
      expect(text.length, `${lng}: die Erfassungsflaeche rendert keinen Text.`).toBeGreaterThan(50);
      for (const z of SICHTBAR_FUER_DIESEN_NUTZER) {
        expect(
          text,
          `${lng}: „${z.was}“ (${z.key}) steht nicht im Katalogtext dieser Sprache.`,
        ).toContain(kat(lng, z.key));
      }
      abbauen();
    }
  });
});

// ================================================================================================
// BLOCK E — DIE ECHTHEITSPROBE
// ================================================================================================
describe("JOB 1154 D2 · D-030 Block E: die Kataloge sind wirklich verschieden", () => {
  it("E1 · mindestens ein abgenommener Traeger lautet in EN anders als in DE", () => {
    // Ohne diesen Fall saehe ein Katalog, der ueberall Deutsch zurueckgibt, genauso gruen aus
    // wie ein uebersetzter. Er ist die Kalibrierung der gesamten Katalogabnahme.
    const verschieden = [...UEBERSETZT, ...VORLAUF].filter(
      (z) => kat("en", z.key) !== kat("de", z.key),
    );
    expect(
      verschieden.length,
      "Kein einziger abgenommener Traeger unterscheidet sich zwischen DE und EN — die " +
        "Katalogabnahme misst dann nur sich selbst.",
    ).toBeGreaterThan(0);
  });

  it("E2 · dasselbe gilt fuer NL", () => {
    const verschieden = [...UEBERSETZT, ...VORLAUF].filter(
      (z) => kat("nl", z.key) !== kat("de", z.key),
    );
    expect(verschieden.length).toBeGreaterThan(0);
  });

  // E3 und E4 sind mit JOB 3062 entfallen: Beide pruefen die drei Sperrgruende der Schrittleiste
  // (`VORLAUF`), und die Schrittleiste ist von der Flaeche genommen (Auftrag §5). Ihre
  // Katalogeintraege bleiben bestehen, aber ein Sperrgrund, der nirgends erscheinen kann, hat keine
  // Sprachzusage mehr zu erfuellen. E1/E2 oben tragen die Kalibrierung weiter.
});

// ================================================================================================
// BLOCK M — DIE MOUNT-KALIBRIERUNG
// ================================================================================================
// Bis JOB 3062 belegte dieser Block, dass die Traeger der harten Texte ueberhaupt erscheinen
// koennen (Aufklapper, Karte nach Vordertuer-Rueckkehr) — ohne ihn haette ein `it.fails` auch
// daran scheitern koennen, dass die Flaeche gar nicht rendert. Beide Traeger sind fort; was BLEIBT,
// ist der Grund fuer diesen Block: Block S unten sagt „diese Texte stehen NICHT da", und eine
// Flaeche, die gar nichts rendert, erfuellt das mühelos und falsch.
describe("JOB 1154 D2 · D-030 Block M: die Flaeche rendert wirklich", () => {
  it("M1 · die Erfassungsflaeche montiert und traegt Text", async () => {
    await mount();
    expect(seitentext().length, "Die Erfassungsflaeche rendert keinen Text.").toBeGreaterThan(50);
  });

  it("M2 · auch mit dem alten Vordertuer-Router-State montiert sie und traegt Text", async () => {
    // Der `state` wird nicht mehr gelesen (sein Erzeuger ist fort, `Capture.tsx:792-797`). Genau
    // deshalb steht der Fall hier: er belegt, dass ein ALTER Zustand aus einer laufenden Sitzung
    // die Flaeche nicht kippt — und er ist die Montage-Voraussetzung fuer S1/S2, die in genau
    // dieser Lage messen.
    await mount(true);
    expect(seitentext().length).toBeGreaterThan(50);
  });
});

// ================================================================================================
// BLOCK S — DER RUECKFALLWAECHTER DER 11 EHEMALS HARTEN TRAEGER
// ================================================================================================
// Diese Faelle waren `it.fails`: Sie beschrieben den GEWUENSCHTEN Zustand, waehrend das Produkt den
// mangelhaften zeigte. Mit JOB 3062 · H3 ist der gewuenschte Zustand eingetreten — die elf Texte
// sind von der Flaeche genommen. Damit muessen sie REGULAER gruen sein: ein `it.fails`, das nicht
// mehr fehlschlaegt, meldet vitest selbst als Fehler, und genau das ist hier eingetreten.
//
// Sie bleiben aber stehen, und zwar als Waechter in die andere Richtung: Wer eines dieser Literale
// wieder auf die Flaeche schreibt, stellt den unuebersetzten Zustand wieder her, den D-030
// aufgedeckt hat — und faellt hier auf. Aus einem gemeldeten Mangel ist ein Schutz geworden.
describe("JOB 1154 D2 · D-030 Block S: kein Rueckfall in unuebersetzte Traeger", () => {
  it("S1 · keiner der elf Texte erscheint in der englischen Ansicht", async () => {
    await i18n.changeLanguage("en");
    await mount(true);
    const text = seitentext();
    const gefunden = FRUEHER_HART.filter((z) => text.includes(z.literal));
    expect(
      gefunden.map((z) => `${z.ort} „${z.literal}“`),
      "Diese deutschen Texte stehen unveraendert in der englischen Ansicht.",
    ).toEqual([]);
  });

  it("S2 · keiner der elf Texte erscheint in der niederlaendischen Ansicht", async () => {
    await i18n.changeLanguage("nl");
    await mount(true);
    const text = seitentext();
    const gefunden = FRUEHER_HART.filter((z) => text.includes(z.literal));
    expect(gefunden.map((z) => `${z.ort} „${z.literal}“`)).toEqual([]);
  });

  it("S3 · auch die deutsche Ansicht zeigt sie nicht mehr", async () => {
    // Der schaerfste der drei: In DE waeren die Texte ja „richtig" gewesen. Dass sie AUCH hier
    // fehlen, belegt, dass die Traeger wirklich entfernt und nicht nur uebersetzt wurden — sonst
    // waeren S1/S2 auch dann gruen, wenn der Kasten in DE weiter stuende.
    await i18n.changeLanguage("de");
    await mount(true);
    const text = seitentext();
    expect(FRUEHER_HART.filter((z) => text.includes(z.literal)).map((z) => z.literal)).toEqual([]);
  });

  it("S4 · KALIBRIERUNG: der Sammler wuerde einen Rueckfall wirklich bemerken", () => {
    // Ohne diesen Fall koennten S1-S3 gruen sein, WEIL der Vergleich nichts findet — der
    // Scheinbeleg, gegen den es diese Datei gibt. Hier bekommt derselbe Vergleich einen Text, der
    // die Literale ENTHAELT: findet er sie dann nicht, ist er kaputt.
    const alsWaereEsZurueck = FRUEHER_HART.map((z) => z.literal).join(" · ");
    const gefunden = FRUEHER_HART.filter((z) => alsWaereEsZurueck.includes(z.literal));
    expect(gefunden.length, "Der Sammler findet die Literale nicht einmal im Klartext.").toBe(
      FRUEHER_HART.length,
    );
  });
});

// ================================================================================================
// BLOCK V — VOLLSTAENDIGKEIT UND INVENTARKALIBRIERUNG
// ================================================================================================
// BEN woertlich: „Eine handgefuehrte Traegerliste braucht eine Gegenmutation, die einen neuen,
// nicht inventarisierten konditionalen Traeger einfuegt und den Vollstaendigkeitstest rot
// macht." Ohne diese Kalibrierung misst die Liste nur sich selbst.

/** Entfernt Zeilen- und Blockkommentare, damit die vielen deutschen Kommentare nicht mitzaehlen. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * Sammelt sichtbare deutsche Klartexte aus dem Renderer: JSX-Textknoten ohne Ausdruck sowie
 * die beiden Zweige eines Bedingungsoperators mit Stringliteralen. Erfasst wird, was einen
 * deutschen Marker traegt (Umlaut oder haeufiges deutsches Wort) und lang genug ist, um Text
 * und nicht Satzzeichen zu sein.
 */
function deutscheKlartexte(quelle: string): string[] {
  const rein = ohneKommentare(quelle);
  const treffer = new Set<string>();

  // Was als sichtbarer Klartext zaehlt: mindestens vier Zeichen, mindestens ein Buchstabe und
  // entweder ein Leerzeichen (also mehr als ein Wort) oder ein Umlaut. Bewusst KEINE
  // Stoppwortliste: der erste Entwurf pruefte auf „der/die/das …" und fand deshalb nur 3 der 11
  // bekannten Traeger — „Entwurf gespeichert", „fortsetzen bereit" und „Hinweis ausblenden"
  // enthalten weder Umlaut noch Stoppwort. Eine Liste, die den halben Bestand uebersieht, kann
  // auch einen Neuzugang uebersehen; genau das soll die Kalibrierung ausschliessen.
  const klartext = (s: string): boolean =>
    s.length >= 4 && /[A-Za-zÄÖÜäöüß]{2}/.test(s) && (/\s/.test(s) || /[äöüÄÖÜß]/.test(s));

  // JSX-Textknoten: alles zwischen > und <, ohne eingebetteten Ausdruck.
  for (const m of rein.matchAll(/>([^<>{}]{4,})</g)) {
    const s = (m[1] ?? "").replace(/\s+/g, " ").trim();
    if (klartext(s)) {
      treffer.add(s);
    }
  }
  // Stringliterale — die beiden Zweige des Aufklappers stehen als "…" im Bedingungsoperator.
  for (const m of rein.matchAll(/"([^"\\\n]{4,})"/g)) {
    const s = (m[1] ?? "").trim();
    if (klartext(s) && !s.includes("/") && !/^[a-z]+\.[a-zA-Z.]+$/.test(s)) {
      treffer.add(s);
    }
  }
  // Templateliterale — der Hinweis aus `setNotice` steht als `Entwurf gespeichert: ${…}`.
  for (const m of rein.matchAll(/`([^`\\\n]{4,}?)\$\{/g)) {
    const s = (m[1] ?? "").trim();
    if (klartext(s)) {
      treffer.add(s);
    }
  }
  return [...treffer];
}

/**
 * Nur echte JSX-Textknoten — das, was der Nutzer wirklich liest. Bewusst OHNE Stringliterale:
 * `className="inline-flex items-center gap-1.5"` besteht ebenfalls aus Buchstaben und
 * Leerzeichen und landete im ersten Entwurf als vermeintlicher Textträger im Ergebnis (16
 * Fehltreffer). Eine Klassenliste ist kein sichtbarer Text und gehoert in keine Traegerzaehlung.
 */
function sichtbareTextknoten(quelle: string): string[] {
  const treffer = new Set<string>();
  for (const m of quelle.matchAll(/>([^<>{}]{4,})</g)) {
    const s = (m[1] ?? "").replace(/\s+/g, " ").trim();
    // `>` ist in TypeScript auch Vergleichsoperator: der erste Entwurf fing so das Codestueck
    // „g !== null), ), ]; return (" als vermeintlichen Textträger. Was Semikolon, Gleichheits-
    // oder Ausrufezeichen enthaelt, ist Code und kein Satz, den jemand liest.
    if (/[;=!]/.test(s)) {
      continue;
    }
    if (s.length >= 4 && /[A-Za-zÄÖÜäöüß]{2}/.test(s) && /\s|[äöüÄÖÜß]/.test(s)) {
      treffer.add(s);
    }
  }
  return [...treffer];
}

/** Ein Fund gilt als inventarisiert, wenn ein Inventarliteral in ihm steckt oder umgekehrt. */
function istInventarisiert(fund: string): boolean {
  return FRUEHER_HART.some((z) => fund.includes(z.literal) || z.literal.includes(fund));
}

describe("JOB 1154 D2 · D-030 Block V: Vollstaendigkeit und Kalibrierung", () => {
  it("V1 · keiner der elf Texte steht noch als sichtbarer Textknoten im Quelltext", () => {
    // DIE RICHTUNG HAT SICH UMGEDREHT, UND ZWAR MIT DEM PRODUKT. Bis JOB 3062 belegte V1, dass
    // jedes Inventarliteral im Quelltext WIRKLICH vorkommt — sonst haette das Inventar Traeger
    // behauptet, die es nicht gibt. Heute ist die Aussage die umgekehrte und ebenso pruefbare:
    // keiner der elf Texte wird noch gerendert.
    //
    // GEMESSEN WIRD AN SICHTBAREN TEXTKNOTEN, NICHT AM ROHEN DATEIINHALT: „Entwurf fortsetzen"
    // und „Neuer leerer Eintrag" stehen weiter in der Datei — in dem Kommentar, der festhaelt,
    // warum die Karte weg ist. Ein `toContain` ueber den Rohtext waere hier rot, ohne dass ein
    // Mensch je etwas davon saehe. Ein Kommentar ist kein Traeger.
    const sichtbar = sichtbareTextknoten(ohneKommentare(readFileSync(CAPTURE_PFAD, "utf8")));
    const rueckfaellig = FRUEHER_HART.filter((z) =>
      sichtbar.some((f) => f.includes(z.literal) || z.literal.includes(f)),
    );
    expect(
      rueckfaellig.map((z) => `${z.was}: „${z.literal}“`),
      "Diese frueher hart deutschen Texte werden wieder gerendert — D-030 waere zurueck.",
    ).toEqual([]);
  });

  it("V2 · KALIBRIERUNG: der Sammler wuerde jeden der elf Texte finden, stuende er wieder da", () => {
    // Ohne diesen Fall koennte V1 gruen sein, WEIL der Sammler nichts findet — genau der
    // Scheinbeleg, gegen den BEN diese Kalibrierungen verlangt hat.
    //
    // GEMESSEN UND VERWORFEN: Der erste Entwurf dieser Kalibrierung zaehlte einfach die Funde im
    // echten `Capture.tsx` und verlangte „mehr als 20". Das war falsch angesetzt — die Datei
    // rendert ihren Text fast vollstaendig ueber `t(...)`, und der Sammler findet dort nur FUENF
    // Zeichenketten, von denen vier Codebruchstuecke sind (`): Promise`, `exampleInForm ? (` …).
    // Eine Kalibrierung an einer Zahl, die vom Zufall der verbliebenen Rohtexte abhaengt, sagt
    // nichts ueber den Sammler.
    //
    // DESHALB WIRD ER AN DEM GEMESSEN, WAS ER FINDEN SOLL: einem synthetischen Quelltext, in dem
    // alle elf Literale als JSX-Textknoten stehen — also genau so, wie sie im Rueckfall wieder
    // dastuenden. Findet er sie dort nicht, ist V1 ein leeres Versprechen.
    const alsWaereEsZurueck = FRUEHER_HART.map((z) => `<p>${z.literal}</p>`).join("\\n");
    const gefunden = sichtbareTextknoten(alsWaereEsZurueck);
    const uebersehen = FRUEHER_HART.filter(
      (z) => !gefunden.some((f) => f.includes(z.literal) || z.literal.includes(f)),
    );
    expect(
      uebersehen.map((z) => z.literal),
      "Der Sammler uebersieht diese Texte selbst dann, wenn sie als Textknoten dastehen.",
    ).toEqual([]);
  });

  // V4 ist mit JOB 3062 entfallen. Er suchte in ZWEI benannten Bereichen des Quelltexts nach
  // nicht inventarisiertem Text — „{frontDoorDraftSaved ? (" (die Vordertuer-Karte) und
  // "{captureWorkspaceOpen && !expertView" (die Schrittleiste). Beide Bereiche gibt es nicht
  // mehr; ihre Ankerzeichenketten kommen in `Capture.tsx` null Mal vor. Ein Bereichstest ohne
  // Bereich ist kein Test, sondern eine Suche, die immer leer ausgeht. Die Aussage „kein
  // Rueckfall" traegt jetzt V1 ueber die ganze Datei, und zwar schaerfer als vorher: nicht mehr
  // nur in zwei Bereichen, sondern in jedem sichtbaren Textknoten.

  it("V3 · KALIBRIERUNG: ein neuer, nicht inventarisierter Traeger macht die Pruefung rot", () => {
    const quelle = readFileSync(CAPTURE_PFAD, "utf8");
    // Der Fremdtraeger wird dem Quelltext NUR IM SPEICHER angehaengt — kein Productwrite.
    // Genau so verlangt es BEN: die Vollstaendigkeit darf nicht allein von der Pflege der
    // Liste abhaengen, sondern muss einen echten Neuzugang bemerken.
    const fremd = "Dieser Hinweis ist neu und steht bewusst nicht im Inventar.";
    const mutiert = `${quelle}\n<p>${fremd}</p>\n`;

    const vorher = deutscheKlartexte(quelle).filter((f) => !istInventarisiert(f) && f === fremd);
    expect(vorher, "Der Fremdtraeger steckt schon im echten Quelltext.").toEqual([]);

    const nachher = deutscheKlartexte(mutiert).filter((f) => f === fremd);
    expect(
      nachher,
      "Der Sammler bemerkt einen neu eingefuegten deutschen Textträger nicht — die " +
        "Vollstaendigkeitsaussage haengt dann allein an der handgepflegten Liste.",
    ).toEqual([fremd]);
    expect(istInventarisiert(fremd), "Der Fremdtraeger gilt faelschlich als inventarisiert.").toBe(
      false,
    );
  });
});
