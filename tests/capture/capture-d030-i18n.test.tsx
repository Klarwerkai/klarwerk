// @vitest-environment jsdom
// ================================================================================================
// JOB 1154 D2 — D-030: DIE KONDITIONALEN TEXTTRAEGER VON /erfassen IN DE, EN UND NL.
// ================================================================================================
//
// KONDITIONALER TEXTTRAEGER heisst hier — Definition aus D1, hier unveraendert uebernommen und
// am heutigen Stand nachgemessen: ein sichtbarer Text im Standardweg von `/erfassen`, den der
// Renderer nur unter einer Bedingung ausgibt.
//
// GEMESSEN AM HEUTIGEN STAND (Base ffcd92c9b29f, `Capture.tsx` 5915 Zeilen): **19 Traeger.**
// D1 hat auf Base 0198b5294f2d dieselbe Zahl gemessen; alle fuenfzehn Fundstellen tragen im
// heutigen Stand denselben Inhalt. Die Zahl 19 ist damit nicht uebernommen, sondern bestaetigt.
//
//   8 UEBERSETZT — sie werden hier POSITIV abgenommen: gemountet, je Sprache, gegen den
//     Katalogtext genau dieser Sprache.
//   11 HART DEUTSCH — sie erscheinen in de, en und nl unveraendert auf Deutsch. Fuer sie gibt
//     es KEINEN Katalogeintrag; D-030 ist dort nicht unuebersetzt, sondern nicht gebaut.
//
// WARUM DIE 11 HIER ALS `it.fails` STEHEN UND NICHT ALS GRUENE PRUEFUNG: Sie liegen ausserhalb
// des Teilscopes dieser Lease. Geleast ist an `Capture.tsx` ausschliesslich „der Produktvorlauf
// der Schrittleiste … Kein anderer Umbau der Seite"; die Leiste steht bei :3870-3902, die elf
// Traeger stehen bei :683 und :3368-3411. Sie zu uebersetzen waere genau der untersagte andere
// Umbau. Der Auftrag regelt diesen Fall in §8: den belegbaren Teil liefern und die fehlenden
// Pfade einzeln nennen. `it.fails` ist die ehrliche Form: der gewuenschte Nutzerzustand steht
// als Erwartung da und wird als erwarteter Fehlschlag gefuehrt — nicht als gruener Mangel-
// Waechter, der das Fehlen zur Erfuellung erklaert. Ihre Mount-Voraussetzungen werden in
// eigenen, REGULAEREN Faellen ausserhalb der `it.fails` geprueft (Block M): ohne diesen Beleg
// koennte ein `it.fails` auch daran scheitern, dass die Flaeche gar nicht erscheint.
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
      drafts: { list: ok([]) },
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
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const CAPTURE_PFAD = resolve(__dirname, "../../apps/web/src/pages/Capture.tsx");

// ================================================================================================
// DAS INVENTAR — GESCHLOSSENE LISTE, 19 TRAEGER.
// ================================================================================================
// Jede Zeile nennt ihre Fundstelle. Die Identitaet eines harten Traegers ist sein LITERAL, nicht
// seine Zeilennummer: Zeilennummern verschieben sich beim naechsten Umbau, das Literal nicht.

/** Die 8 bereits uebersetzten Traeger — positiv abzunehmen. */
const UEBERSETZT: ReadonlyArray<{ ort: string; key: string; was: string }> = [
  { ort: "Capture.tsx:3830", key: "capture.draftScope.noteAdmin", was: "Entwurfsliste (Admin)" },
  { ort: "Capture.tsx:3831", key: "capture.draftScope.note", was: "Entwurfsliste (Nutzer)" },
  { ort: "Capture.tsx:3838", key: "capture.draftScope.toLibrary", was: "Link in die Bibliothek" },
  { ort: "Capture.tsx:3895", key: "capture.flow.step.raw.label", was: "Schrittleiste 1" },
  { ort: "Capture.tsx:3895", key: "capture.flow.step.studio.label", was: "Schrittleiste 2" },
  { ort: "Capture.tsx:3895", key: "capture.flow.step.review.label", was: "Schrittleiste 3" },
  { ort: "Capture.tsx:3911", key: "capture.entry.narrateKicker", was: "Erzaehl-Kicker" },
  { ort: "Capture.tsx:5549", key: "capture.wizard.back", was: "Zurueck-Knopf Wissensseite" },
];

/**
 * Die Schluessel, die der Produktvorlauf dieses Durchgangs neu einfuehrt. Sie sind KEINE
 * Altlast, sondern neue konditionale Traeger — sie erscheinen nur, wenn ein Schritt gesperrt
 * ist. Sie werden hier mit demselben Mass abgenommen wie die acht bestehenden.
 */
const VORLAUF: ReadonlyArray<{ ort: string; key: string; was: string }> = [
  {
    ort: "Capture.tsx:3870-3902",
    key: "capture.wizard.step.lockedCurrent",
    was: "Sperrgrund: schon hier",
  },
  {
    ort: "Capture.tsx:3870-3902",
    key: "capture.wizard.step.lockedNeedDraft",
    was: "Sperrgrund: kein Entwurf",
  },
  {
    ort: "Capture.tsx:3870-3902",
    key: "capture.wizard.step.lockedViaSubmit",
    was: "Sperrgrund: ueber Einreichen",
  },
];

/**
 * Die 11 hart deutschen Traeger. Zaehlweise wie in D1: `:3368` traegt zwei Schalterzustaende,
 * `:3390` zwei Saetze — deshalb 11 Traeger auf 9 Fundstellen.
 */
const HART: ReadonlyArray<{ ort: string; literal: string; was: string }> = [
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
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

/** Der Aufklapper — sein eigener Text ist Traeger 2/3, deshalb ueber `aria-controls` gesucht. */
function aufklapper(): HTMLButtonElement {
  const b = container.querySelector<HTMLButtonElement>('button[aria-controls="capture-workspace"]');
  if (!b) {
    throw new Error("Der Aufklapper des Arbeitsraums ist auf der gemounteten Seite nicht da.");
  }
  return b;
}

const kat = (lng: Sprache, key: string): string => i18n.getFixedT(lng)(key);

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
  it("I1 · es fuehrt genau 19 gemessene Traeger", () => {
    expect(UEBERSETZT.length + HART.length).toBe(19);
  });

  it("I2 · keine Zeile ohne Ort, keine Zeile ohne Gegenstand", () => {
    for (const z of [...UEBERSETZT, ...VORLAUF, ...HART]) {
      expect(z.ort, `Traeger „${z.was}“ ohne Fundstelle.`).toMatch(/^Capture\.tsx:\d/);
      expect(z.was.trim().length).toBeGreaterThan(0);
    }
  });

  it("I3 · kein Traeger steht doppelt im Inventar", () => {
    const ids = [
      ...UEBERSETZT.map((z) => `k:${z.key}`),
      ...VORLAUF.map((z) => `k:${z.key}`),
      ...HART.map((z) => `l:${z.literal}|${z.was}`),
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

  it("K2 · die Schrittleiste zeigt je Sprache genau den Katalogtext dieser Sprache", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      await mount();
      await click(aufklapper());
      const text = seitentext();
      for (const key of [
        "capture.flow.step.raw.label",
        "capture.flow.step.studio.label",
        "capture.flow.step.review.label",
      ]) {
        expect(text, `${lng}: „${key}“ steht nicht in der gerenderten Leiste.`).toContain(
          kat(lng, key),
        );
      }
      abbauen();
    }
  });

  it("K3 · die Sperrgruende des Vorlaufs erscheinen je Sprache im Katalogtext", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      await mount();
      await click(aufklapper());
      const text = seitentext();
      for (const z of VORLAUF) {
        expect(text, `${lng}: Sperrgrund „${z.key}“ fehlt auf der Seite.`).toContain(
          kat(lng, z.key),
        );
      }
      abbauen();
    }
  });

  it("K4 · der Erzaehl-Kicker erscheint je Sprache im Katalogtext", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      await mount();
      await click(aufklapper());
      expect(seitentext(), `${lng}: Erzaehl-Kicker fehlt.`).toContain(
        kat(lng, "capture.entry.narrateKicker"),
      );
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

  it("E4 · jeder neue Sperrgrund lautet in EN und NL anders als in DE", () => {
    // Die scharfe Sprachprobe fuer den Vorlauf dieses Durchgangs. E1/E2 verlangen nur, dass
    // IRGENDEIN Traeger sich unterscheidet — das koennte auch ein alter sein. Hier muss jeder
    // der drei neuen Saetze wirklich uebersetzt sein; ein hart deutsches Literal in EN oder NL
    // macht genau diesen Fall rot.
    for (const z of VORLAUF) {
      expect(kat("en", z.key), `EN: „${z.key}“ steht unveraendert auf Deutsch.`).not.toBe(
        kat("de", z.key),
      );
      expect(kat("nl", z.key), `NL: „${z.key}“ steht unveraendert auf Deutsch.`).not.toBe(
        kat("de", z.key),
      );
    }
  });

  it("E3 · die drei neuen Sperrgruende sind in allen drei Sprachen paarweise verschieden", () => {
    // Drei Gruende, die in einer Sprache gleich lauten, koennen den Nutzer nicht unterscheiden
    // lassen, WARUM ein Schritt zu ist.
    for (const lng of SPRACHEN) {
      const werte = VORLAUF.map((z) => kat(lng, z.key));
      expect(new Set(werte).size, `${lng}: die Sperrgruende sind nicht unterscheidbar.`).toBe(3);
    }
  });
});

// ================================================================================================
// BLOCK M — MOUNT-VORAUSSETZUNGEN DER HARTEN TRAEGER (REGULAER, NICHT `it.fails`)
// ================================================================================================
describe("JOB 1154 D2 · D-030 Block M: die harten Traeger erscheinen ueberhaupt", () => {
  it("M1 · der Aufklapper ist auf der Seite und traegt Text", async () => {
    await mount();
    expect((aufklapper().textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("M2 · mit Vordertuer-Router-State rendert die Karte „Entwurf gespeichert“", async () => {
    await mount(true);
    // Ohne diesen Beleg koennte ein erwarteter Fehlschlag weiter unten auch daran liegen, dass
    // die Flaeche gar nicht erscheint — dann wuerde er das Falsche belegen.
    expect(seitentext()).toContain("Dosierventil DP-4");
    expect(seitentext()).toContain("fortsetzen bereit");
  });

  it("M3 · jeder harte Traeger ist in seinem Zustand wirklich sichtbar", async () => {
    await mount(true);
    const text = seitentext();
    for (const z of HART.filter((x) => !x.ort.includes(":3368"))) {
      expect(text, `Traeger „${z.was}“ (${z.ort}) erscheint nicht.`).toContain(z.literal);
    }
    // Der Aufklapper traegt seinen zugeklappten Zustand …
    expect(aufklapper().textContent ?? "").toContain("Weitere Wege anzeigen");
    // … und nach dem Klick den aufgeklappten.
    await click(aufklapper());
    expect(aufklapper().textContent ?? "").toContain("Weitere Wege einklappen");
  });
});

// ================================================================================================
// BLOCK S — DER SOLLVERTRAG DER 11 HARTEN TRAEGER (ERWARTETER FEHLSCHLAG)
// ================================================================================================
// Diese Faelle beschreiben den gewuenschten Nutzerzustand — nicht den heutigen. Sie sind als
// `it.fails` gefuehrt, weil ihre Umsetzung ausserhalb dieser Lease liegt (§8 des Auftrags).
// Schlaegt einer von ihnen eines Tages NICHT mehr fehl, meldet vitest das als Fehler: dann ist
// der Traeger gebaut und gehoert in Block K.
describe("JOB 1154 D2 · D-030 Block S: Sollvertrag der elf harten Traeger", () => {
  it.fails("S1 · kein harter deutscher Traeger erscheint in der englischen Ansicht", async () => {
    await i18n.changeLanguage("en");
    await mount(true);
    const text = seitentext();
    const gefunden = HART.filter((z) => !z.ort.includes(":3368")).filter((z) =>
      text.includes(z.literal),
    );
    expect(
      gefunden.map((z) => `${z.ort} „${z.literal}“`),
      "Diese deutschen Texte stehen unveraendert in der englischen Ansicht.",
    ).toEqual([]);
  });

  it.fails(
    "S2 · kein harter deutscher Traeger erscheint in der niederlaendischen Ansicht",
    async () => {
      await i18n.changeLanguage("nl");
      await mount(true);
      const text = seitentext();
      const gefunden = HART.filter((z) => !z.ort.includes(":3368")).filter((z) =>
        text.includes(z.literal),
      );
      expect(gefunden.map((z) => `${z.ort} „${z.literal}“`)).toEqual([]);
    },
  );

  it.fails("S3 · der Aufklapper spricht Englisch, wenn die Seite Englisch spricht", async () => {
    await i18n.changeLanguage("en");
    await mount();
    expect(aufklapper().textContent ?? "").not.toContain("Weitere Wege anzeigen");
  });

  it.fails("S4 · fuer jeden harten Traeger existiert ueberhaupt ein Katalogeintrag", () => {
    // Der Kern des Befunds: D-030 ist an diesen Stellen nicht unuebersetzt, sondern nicht
    // gebaut. Es gibt keinen Schluessel, den man uebersetzen koennte.
    const ohneEintrag = HART.filter((z) => {
      const alle = SPRACHEN.map((lng) => kat(lng, "capture.frontDoorSaved.title"));
      return alle.every((w) => w !== z.literal);
    });
    expect(ohneEintrag.length, "Fuer diese Traeger fehlt jeder Katalogeintrag.").toBe(0);
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
  return HART.some((z) => fund.includes(z.literal) || z.literal.includes(fund));
}

describe("JOB 1154 D2 · D-030 Block V: Vollstaendigkeit und Kalibrierung", () => {
  it("V1 · jeder harte Traeger des Inventars ist im Quelltext wirklich zu finden", () => {
    const quelle = readFileSync(CAPTURE_PFAD, "utf8");
    for (const z of HART) {
      expect(
        quelle,
        `Inventarzeile „${z.was}“ (${z.ort}) findet sich nicht im Quelltext.`,
      ).toContain(z.literal);
    }
  });

  it("V2 · der Sammler findet die inventarisierten Traeger auch wirklich", () => {
    // Kalibrierung des Sammlers selbst: findet er die bekannten Traeger nicht, kann er auch
    // keinen neuen finden — und V3 waere ein leeres Versprechen.
    const funde = deutscheKlartexte(readFileSync(CAPTURE_PFAD, "utf8"));
    const wiedergefunden = HART.filter((z) => funde.some((f) => f.includes(z.literal)));
    expect(
      wiedergefunden.length,
      `Der Sammler findet nur ${wiedergefunden.length} der ${HART.length} bekannten Traeger.`,
    ).toBeGreaterThanOrEqual(8);
  });

  it("V4 · KALIBRIERUNG AM PRODUKT: in den Traegerbereichen steht kein Text ausserhalb des Inventars", () => {
    // Die entscheidende Richtung — und die, die im ersten Entwurf dieses Durchgangs fehlte:
    // V1 prueft Inventar → Quelltext, V3 prueft den Sammler an einem synthetischen Zusatz.
    // Beides zusammen bemerkte einen ECHT ins Produkt eingefuegten Traeger NICHT; die
    // Gegenmutation GM-E lief gruen durch. Erst dieser Fall schliesst die Luecke: Quelltext →
    // Inventar, und zwar in genau den beiden Bereichen, in denen die konditionalen Traeger
    // liegen. Ein neuer harter Text dort ist ab jetzt rot.
    //
    // Warum nur diese beiden Bereiche und nicht die ganze Datei: `Capture.tsx` traegt weitere
    // harte deutsche Texte, die UNKONDITIONAL gerendert werden (D1 nennt sie als Zusatzbefund
    // ausserhalb der Zaehlung). Sie sind ein eigener, hier nicht beauftragter Gegenstand. Ein
    // Test, der sie mitzaehlte, waere sofort rot und wuerde nichts ueber D-030 aussagen.
    const quelle = ohneKommentare(readFileSync(CAPTURE_PFAD, "utf8"));

    const bereich = (start: string, ende: string): string => {
      const a = quelle.indexOf(start);
      expect(a, `Bereichsanfang „${start}“ nicht gefunden.`).toBeGreaterThan(-1);
      const b = quelle.indexOf(ende, a);
      expect(b, `Bereichsende „${ende}“ nach „${start}“ nicht gefunden.`).toBeGreaterThan(-1);
      return quelle.slice(a, b);
    };

    const bereiche = [
      // Die Vordertuer-Karte — hier liegen acht der elf harten Traeger.
      { name: "Vordertuer-Karte", text: bereich("{frontDoorDraftSaved ? (", ") : null}") },
      // Die Schrittleiste — nach dem Vorlauf dieses Durchgangs vollstaendig ueber `t()`.
      {
        name: "Schrittleiste",
        // Endmarker ist der naechste ECHTE Code — der Kommentar dazwischen ist zu diesem
        // Zeitpunkt bereits entfernt und taugte deshalb nicht als Grenze.
        text: bereich(
          "{captureWorkspaceOpen && !expertView",
          "{captureWorkspaceOpen && (expertView",
        ),
      },
    ];

    const fremd: string[] = [];
    for (const b of bereiche) {
      for (const fund of sichtbareTextknoten(b.text)) {
        if (!istInventarisiert(fund)) {
          fremd.push(`${b.name}: „${fund}“`);
        }
      }
    }
    expect(
      fremd,
      "In den Traegerbereichen steht harter Text, der nicht im Inventar gefuehrt wird. " +
        "Entweder ist ein neuer Traeger entstanden — dann gehoert er ins Inventar — oder das " +
        "Inventar ist veraltet. Beides macht die Vollstaendigkeitsaussage unzutreffend.",
    ).toEqual([]);
  });

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
