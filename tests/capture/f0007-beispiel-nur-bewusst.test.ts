// ==================================================================================================
// F-0007 · JOB 2942 · D1 — EIN GELADENES BEISPIEL DARF NICHT UNBEMERKT ECHTES WISSEN WERDEN
// ==================================================================================================
//
// DER BEFUND, gemessen am Produktstand `6d574fce`. `loadExample()` (Capture.tsx) fuellt raw,
// category, asset und tags, klappt die erweiterten Felder auf und setzt einen Hinweistext. Danach
// war das Beispiel von echtem Wissen NICHT mehr unterscheidbar: die Markersuche in derselben Datei
// fand weder `isExample` noch `exampleLoaded`, `fromExample` oder `demoData`. Wer „Beispiel laden"
// drueckte und weiterklickte, legte einen Demo-Datensatz als echtes Wissensobjekt in den Bestand —
// ungewarnt.
//
// Das Produkt VERSPRACH das Gegenteil bereits woertlich, an zwei Stellen:
//   · Funktionsregister F-0007: „Eingereicht wird auch ein Beispiel nur bewusst."
//   · Hilfetext `chelp.loadExample.body` (i18n.ts): „Eingereicht wird auch ein Beispiel erst,
//     wenn du es bewusst einreichst."
// Gebaut war nur die erste Haelfte — das Laden.
//
// --------------------------------------------------------------------------------------------
// WIE DIESER TEST AN DIE ECHTE LOGIK KOMMT — UND WARUM NICHT PER IMPORT ODER MOUNT
// --------------------------------------------------------------------------------------------
// Der Auftrag schreibt den Testpfad als `.test.ts` fest. Damit sind zwei naheliegende Wege zu:
//
//   · MOUNT. Gemountete React-Tests heissen in diesem Repo `.test.tsx`, weil nur
//     `tsconfig.tests-tsx.json` jsx und die DOM-lib mitbringt. Der Root-Check (`tsconfig.json`,
//     `lib: ["ES2022"]`) ist Node-rein; ein Mount-Geruest in einer `.ts` waere dort nicht
//     typisierbar.
//   · IMPORT der Seite. GEMESSEN, nicht vermutet — beide Formen scheitern, und zwar an zwei
//     Waechtern, die einander ausschliessen:
//       - statisch: `tsc --noEmit` (Wurzel) → TS6142 „Module … was resolved to …/Capture.tsx,
//         but '--jsx' is not set."
//       - dynamisch ueber eine Pfadkonstante: gruen im Typprueferm aber ROT bei
//         `tests/legal/mega61-rechtsseiten.test.tsx` — „kein Test unter tests/** verbirgt seinen
//         Modulpfad hinter einem Platzhalter". Dessen Ausweg (Eintrag in `BEKANNT_UNAUFLOESBAR`)
//         liegt in einer fremden Datei und ist fuer diesen Durchgang gesperrt.
//
// Der Weg hier umgeht keinen der beiden, sondern erfuellt beide: die drei reinen, DOM-freien
// Funktionen werden AUS DER ECHTEN DATEI ausgeschnitten, mit esbuild uebersetzt und ECHT
// AUSGEFUEHRT. Kein Modulpfad wird versteckt, keine `.tsx` geraet in den Node-reinen Typpruefer,
// und geprueft wird der Produktcode selbst — nicht seine Beschreibung. Faellt der Block weg oder
// aendert er seinen Namen, schlaegt das Ausschneiden fehl und der Test wird rot.
//
// Die zweite Haelfte des Beweises — dass die Oberflaeche diese Funktionen auch WIRKLICH benutzt und
// nicht daran vorbei einreicht — traegt der Verdrahtungsblock am Ende. Beides zusammen ist der
// Vertrag; die Logik allein waere toter Code, die Pins allein waeren eine Behauptung.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";
import { CAPTURE_EXAMPLE } from "../../apps/web/src/lib/captureExample";

/** Grenzen des Logikblocks in Capture.tsx — beide Marken sind Teil des Vertrags. */
const BLOCK_START = "export interface BeispielFelder {";
const BLOCK_ENDE = "const BEISPIEL_TOR_TEXT = {";

interface BeispielFelder {
  raw: string;
  category: string;
  asset: string;
  tags: string[];
}

interface CaptureTor {
  beispielRestVorhanden(felder: BeispielFelder): boolean;
  beispielImFormular(geladen: boolean, felder: BeispielFelder): boolean;
  beispielEinreichSchritt(args: { beispielImFormular: boolean; bestaetigt: boolean }):
    | "einreichen"
    | "rueckfrage";
}

function tor(): CaptureTor {
  const quelle = captureQuelle();
  const start = quelle.indexOf(BLOCK_START);
  const ende = quelle.indexOf(BLOCK_ENDE);
  if (start < 0 || ende <= start) {
    throw new Error(
      `Der Beispiel-Tor-Block steht nicht mehr in Capture.tsx (gesucht: „${BLOCK_START}" … ` +
        `„${BLOCK_ENDE}"). Ohne ihn gibt es nichts zu pruefen.`,
    );
  }
  // `export` faellt weg — der Block wird hier nicht als Modul geladen, sondern ausgefuehrt.
  const block = quelle.slice(start, ende).replace(/^export /gm, "");
  const js = transformSync(block, { loader: "ts" }).code;
  const fabrik = new Function(
    "CAPTURE_EXAMPLE",
    `${js}\nreturn { beispielRestVorhanden, beispielImFormular, beispielEinreichSchritt };`,
  ) as (beispiel: typeof CAPTURE_EXAMPLE) => CaptureTor;
  const gebaut = fabrik(CAPTURE_EXAMPLE);
  if (
    typeof gebaut.beispielRestVorhanden !== "function" ||
    typeof gebaut.beispielImFormular !== "function" ||
    typeof gebaut.beispielEinreichSchritt !== "function"
  ) {
    throw new Error(
      "Capture.tsx fuehrt das Beispiel-Tor nicht mehr: erwartet werden die reinen Funktionen " +
        "`beispielRestVorhanden`, `beispielImFormular` und `beispielEinreichSchritt`.",
    );
  }
  return gebaut;
}

/** Genau der Formularstand, den `loadExample()` herstellt — aus derselben Quelle wie das Produkt. */
const geladenerStand: BeispielFelder = {
  raw: CAPTURE_EXAMPLE.raw,
  category: CAPTURE_EXAMPLE.category,
  asset: CAPTURE_EXAMPLE.asset,
  tags: [...CAPTURE_EXAMPLE.tags],
};

function captureQuelle(): string {
  return readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
}

describe("F-0007 (a): nach `loadExample` ist der Beispielzustand gesetzt", () => {
  it("erkennt den geladenen Stand als Beispiel", () => {
    const { beispielImFormular } = tor();
    expect(beispielImFormular(true, geladenerStand)).toBe(true);
  });

  it("`loadExample()` setzt den Zustand — und zwar an derselben Stelle, die die Felder fuellt", () => {
    const quelle = captureQuelle();
    const start = quelle.indexOf("const loadExample = (): void => {");
    expect(start).toBeGreaterThan(0);
    const rumpf = quelle.slice(start, quelle.indexOf("};", start));
    // Ohne diese Zeile faellt das Produkt auf den gemessenen Stand zurueck: Felder gefuellt,
    // Herkunft vergessen.
    expect(rumpf).toContain("setExampleLoaded(true)");
  });

  it("ohne geladenes Beispiel ist der Zustand auch bei zufaelliger Textgleichheit nicht gesetzt", () => {
    const { beispielImFormular } = tor();
    // Das Merkmal ist die HERKUNFT, nicht der Text: wer denselben Satz selbst tippt, hat kein
    // Beispiel geladen und bekommt keine Rueckfrage.
    expect(beispielImFormular(false, geladenerStand)).toBe(false);
  });
});

describe("F-0007 (b): Einreichen ohne Bestaetigung erreicht den Bestand NICHT", () => {
  it("der erste Griff fuehrt zur Rueckfrage, nicht zum Bestand", () => {
    const { beispielEinreichSchritt } = tor();
    expect(beispielEinreichSchritt({ beispielImFormular: true, bestaetigt: false })).toBe(
      "rueckfrage",
    );
  });
});

describe("F-0007 (c): nach Bestaetigung erreicht das Einreichen den Bestand", () => {
  it("der zweite, ausdrueckliche Griff reicht ein — die Sperre ist Ruecksprache, kein Verbot", () => {
    const { beispielEinreichSchritt } = tor();
    expect(beispielEinreichSchritt({ beispielImFormular: true, bestaetigt: true })).toBe(
      "einreichen",
    );
  });
});

describe("F-0007 (d): vollstaendiges Ueberschreiben hebt den Zustand auf", () => {
  it("ein Beispiel, das der Mensch ganz ersetzt hat, ist kein Beispiel mehr", () => {
    const { beispielImFormular } = tor();
    const eigenerStand: BeispielFelder = {
      raw: "An Presse P2 reisst die Folie, wenn die Vorheizung unter 60 Grad steht.",
      category: "Sicherheit",
      asset: "Presse P2",
      tags: ["Folie", "Vorheizung"],
    };
    expect(beispielImFormular(true, eigenerStand)).toBe(false);
  });

  it("solange auch nur ein Feld noch Beispielinhalt traegt, bleibt der Zustand stehen", () => {
    const { beispielImFormular } = tor();
    // Teilweise ueberschrieben ist NICHT ueberschrieben: der Rest des Demo-Datensatzes wuerde
    // sonst still in den Bestand wandern — genau der Schaden, den F-0007 beschreibt.
    const halbUeberschrieben: BeispielFelder = {
      raw: "Komplett neuer, selbst getippter Text ohne jeden Bezug zum Beispiel.",
      category: "Sicherheit",
      asset: CAPTURE_EXAMPLE.asset,
      tags: ["Folie"],
    };
    expect(beispielImFormular(true, halbUeberschrieben)).toBe(true);
  });

  it("ein geleertes Formular traegt kein Beispiel mehr", () => {
    const { beispielImFormular } = tor();
    expect(beispielImFormular(true, { raw: "", category: "", asset: "", tags: [] })).toBe(false);
  });
});

describe("F-0007 (e): ohne geladenes Beispiel bleibt der Weg unveraendert einschrittig", () => {
  it("der normale Erfassungsweg bekommt keinen zusaetzlichen Klick", () => {
    const { beispielEinreichSchritt } = tor();
    expect(beispielEinreichSchritt({ beispielImFormular: false, bestaetigt: false })).toBe(
      "einreichen",
    );
    // Auch ein stehengebliebenes Bestaetigungs-Flag darf am normalen Weg nichts aendern.
    expect(beispielEinreichSchritt({ beispielImFormular: false, bestaetigt: true })).toBe(
      "einreichen",
    );
  });
});

describe("F-0007 · Verdrahtung: die Oberflaeche reicht nicht am Tor vorbei ein", () => {
  it("kein Einreich-Knopf ruft `submit.mutate()` mehr unmittelbar auf", () => {
    const quelle = captureQuelle();
    // Der gemessene Ausgangszustand hatte GENAU DAS an beiden Einreich-Knoepfen (Z. 5702, 6092).
    // Bliebe auch nur einer davon stehen, waere die Rueckfrage am zweiten Knopf umgehbar.
    expect(quelle).not.toContain("onClick={() => submit.mutate()}");
  });

  it("jeder Weg in den Bestand laeuft ueber denselben Torschritt", () => {
    const quelle = captureQuelle();
    // Drei Stellen, und genau drei: die zwei Einreich-Knoepfe (Entwurfs- und Wizard-Ansicht) rufen
    // `requestSubmit()` OHNE Argument, der Bestaetigungsknopf der Rueckfrage mit `true`.
    //
    // JOB 2942 D2: bis dahin riefen alle drei `onClick={requestSubmit}`, und `bestaetigt` kam aus
    // dem Anzeigezustand. Der gemountete UI-Test hat gezeigt, dass damit ein ZWEITER Klick auf
    // denselben Einreichknopf als Bestaetigung durchging. Seither entscheidet der Klickweg — und
    // dieser Pin haelt die Trennung fest: zwei fragende Wege, genau ein bestaetigender.
    expect(quelle.split("onClick={() => requestSubmit()}").length - 1).toBe(2);
    expect(quelle.split("onClick={() => requestSubmit(true)}").length - 1).toBe(1);
    // Und kein Knopf reicht die Funktion mehr direkt als Ereignis-Empfaenger herein: React gaebe
    // das Klick-Ereignis als `bestaetigt` weiter, und jeder erste Griff waere eine Bestaetigung.
    expect(quelle).not.toContain("onClick={requestSubmit}");
  });

  it("der Torschritt entscheidet mit der importierten reinen Funktion", () => {
    const quelle = captureQuelle();
    const start = quelle.indexOf("const requestSubmit = (bestaetigt = false): void => {");
    expect(start).toBeGreaterThan(0);
    const rumpf = quelle.slice(start, quelle.indexOf("};", start));
    expect(rumpf).toContain("beispielEinreichSchritt");
    expect(rumpf).toContain("submit.mutate()");
    // Der Anzeigezustand darf die Entscheidung nicht mehr treffen — genau das war das Leck.
    expect(rumpf).not.toContain("bestaetigt: confirmExampleSubmit");
  });

  it("der Zustand ist im Formular sichtbar und nicht nur intern", () => {
    const quelle = captureQuelle();
    // Sichtbarkeit haengt am abgeleiteten Zustand, nicht am rohen Flag: ein vollstaendig
    // ueberschriebenes Beispiel traegt auch keine Markierung mehr.
    expect(quelle).toContain("exampleInForm");
    expect(quelle).toContain('t("demo.badge.label")');
  });

  it("das Verwerfen des Formulars raeumt den Beispielzustand mit", () => {
    const quelle = captureQuelle();
    const start = quelle.indexOf("const resetCaptureForm = (): void => {");
    expect(start).toBeGreaterThan(0);
    const rumpf = quelle.slice(start, quelle.indexOf("\n  };", start));
    // Sonst haengt die Rueckfrage am naechsten, voellig frischen Wissensobjekt.
    expect(rumpf).toContain("setExampleLoaded(false)");
  });
});
