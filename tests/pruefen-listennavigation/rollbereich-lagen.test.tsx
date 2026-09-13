// @vitest-environment jsdom
// ================================================================================================
// JOB 3593 · DER EIGENE ROLLBEREICH DER LISTE — in welchen Lagen es ihn gibt, und in welchen nicht.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. JOB 3593 hat der Warteschlange einen eigenen Rollbereich gegeben, damit
// beim Durchgehen der Artikel rechts im Bild bleibt (gemessen in Pixeln in
// `tests/design/job2935-validierung-fussband.test.ts`, Block L). Das ist eine SICHTBARE Änderung —
// bei mehr als rund vierzehn Einträgen steht jetzt ein Rollbalken an der Liste. Der Auftrag verlangt
// für eine sichtbare Änderung, dass sie für JEDE Lage der Fläche einzeln beantwortet wird (§9).
//
// DIE ANTWORT IST IN ALLEN LAGEN DIESELBE, und sie ist strukturell: die zwei neuen Regeln hängen am
// `<ul>` der Warteschlange, und das `<ul>` gibt es ausschliesslich, wenn wirklich Einträge da sind
// (`Validation.tsx`, `visible.length > 0`). In den vier Lagen ohne Bestand steht kein `<ul>` — also
// auch kein Rollbereich, kein Balken, keine Deckelung. Das ist hier gemessen und nicht behauptet.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT MISST: die Wirkung. jsdom rechnet kein Layout, dort rollt
// nichts und hat nichts eine Höhe. Ob die Karte im Fenster bleibt, misst der Browserblock; diese
// Datei misst, WO die Regeln hängen und in welchen Lagen sie überhaupt vorkommen. Dieselbe
// Arbeitsteilung wie zwischen `pfeiltasten.test.tsx` (Verhalten) und `sichtregel.ts` (Geometrie).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { type Brett, eintrag, flush, kartenTitel, klick, mounteBrett, mounteLage } from "./kulisse";

const TITEL = ["A", "B", "C", "D", "E", "F"] as const;
const SCHLANGE = '[data-testid="pruefen-warteschlange"]';
/**
 * Die Bruchstelle, ab der `lg:`-Regeln greifen (Tailwind-Vorgabe, keine eigene Einstellung in
 * `apps/web/tailwind.config.ts`). Sie liegt über der Schmal-Grenze des Produkts
 * (`NARROW_QUERY`, `useMediaQuery.ts:35` — 899 px); der schmale Weg kann von diesen Regeln also
 * gar nicht getroffen werden, und genau das hält F2 fest.
 */
const BREITE_STUFE = "lg:";

let brett: Brett;

function liste(b: Brett): HTMLElement | null {
  return b.container.querySelector<HTMLElement>(SCHLANGE);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

describe("JOB 3593 · der eigene Rollbereich der Warteschlange", () => {
  it("F1 · Bestand: die Liste trägt einen eigenen, gedeckelten Rollbereich", async () => {
    brett = await mounteBrett(TITEL);
    const ul = liste(brett);
    expect(ul, "die Warteschlange steht").not.toBeNull();
    const klassen = (ul?.className ?? "").split(/\s+/);
    // Beide Teile sind nötig und tun Verschiedenes: die Deckelung schafft den Überlauf, erst die
    // Rollregel macht das Element zu einem Rollbereich. Ohne eines von beiden sucht
    // `scrollIntoView` weiter nach aussen und bewegt wieder die Hülle samt Karte.
    //
    // JOB 3625: Der Deckel ist keine Prozentzahl mehr (`max-h-[70vh]` rechnete den Kopf über der
    // Liste nicht mit, gemessen in `tests/design/job2935-validierung-fussband.test.ts`). Er
    // entsteht jetzt aus dem Flex-Kasten der Spalte: `min-h-0` erlaubt der Liste — und nur ihr —,
    // unter ihre Inhaltshöhe zu schrumpfen, und der Rest der Spalte behält seine natürliche Höhe.
    expect(klassen).toContain(`${BREITE_STUFE}min-h-0`);
    expect(klassen).toContain(`${BREITE_STUFE}overflow-y-auto`);
    // Ohne die Spalte darüber wäre `min-h-0` wirkungslos: Schrumpfen kann nur, was in einer
    // Flex-Spalte mit begrenzter Höhe steht. Deshalb hängt die Zusage an BEIDEN Stellen, und
    // beide stehen hier.
    const spalte = ul?.parentElement;
    const spaltenKlassen = (spalte?.className ?? "").split(/\s+/);
    for (const k of ["flex", "h-full", "min-h-0", "flex-col"]) {
      expect(spaltenKlassen, `der Spalte fehlt ${BREITE_STUFE}${k}`).toContain(
        `${BREITE_STUFE}${k}`,
      );
    }
  });

  it("F2 · und keine dieser Regeln gilt im schmalen Fenster — jede trägt die Breitenstufe", async () => {
    brett = await mounteBrett(TITEL);
    const klassen = (liste(brett)?.className ?? "").split(/\s+/).filter(Boolean);
    // Nicht die zwei Namen von F1 noch einmal, sondern die REGEL dahinter: was an dieser Liste
    // Höhe deckelt oder Überlauf regelt, gilt nur in der breiten Bauform. Käme später eine dritte
    // Rollregel ohne `lg:` dazu, fiele dieser Fall — der schmale Weg soll unberührt bleiben
    // (dort führt die bewusste Auswahl den Blick zur Karte, `Validation.tsx:1127-1137`).
    // JOB 3625: `min-h-` gehört seit der Ablösung von `70vh` in dieselbe Reihe — es ist jetzt der
    // Teil, der die Höhe der Liste überhaupt deckelbar macht.
    const rollend = klassen.filter((k) => /(^|:)(max-h-|min-h-|overflow-)/.test(k));
    expect(rollend.length, "keine einzige Rollregel gefunden — F2 prüfte nichts").toBeGreaterThan(
      0,
    );
    expect(rollend.filter((k) => !k.startsWith(BREITE_STUFE))).toEqual([]);
  });

  it("F3 · leer: es gibt keine Liste und damit keinen Rollbereich", async () => {
    brett = await mounteLage({ art: "leer" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-satz-leer"]'),
      "der Leer-Satz der Fläche steht",
    ).not.toBeNull();
  });

  it("F4 · lädt: es gibt keine Liste und damit keinen Rollbereich", async () => {
    brett = await mounteLage({ art: "laedt" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-platzhalter"]'),
      "der Platzhalter der Ladelage steht",
    ).not.toBeNull();
  });

  it("F5 · Erstfehler: es gibt keine Liste, aber den Wiederholweg", async () => {
    brett = await mounteLage({ art: "erstfehler" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-erstfehler"]'),
      "die Erstfehlerlage steht",
    ).not.toBeNull();
  });

  it("F6 · Bestand mit gescheiterter Auffrischung: die Liste bleibt stehen — samt Rollbereich und Hinweis", async () => {
    brett = await mounteBrett(TITEL);
    // Die Lage entsteht nur so: eine erfolgreiche Antwort liegt im Cache, die NÄCHSTE scheitert
    // (`zaehler.ts:131,145`). Genau dann darf nichts geleert werden — weder die Liste noch ihre
    // Bedienbarkeit; sie sagt nur zusätzlich, dass sie nicht frisch ist.
    (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Auffrischung gescheitert"),
    );
    await act(async () => {
      await brett.qc.invalidateQueries({ queryKey: ["validation", "board"] });
    });
    await flush();

    const ul = liste(brett);
    expect(ul, "die Liste ist beim Auffrischungsfehler verschwunden").not.toBeNull();
    expect(
      brett.container.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]'),
    ).toHaveLength(TITEL.length);
    expect((ul?.className ?? "").split(/\s+/)).toContain(`${BREITE_STUFE}overflow-y-auto`);
    expect(
      brett.container.querySelector('[data-testid="pruefen-nicht-frisch"]'),
      "der Hinweis auf den nicht frischen Stand steht",
    ).not.toBeNull();
  });
});

// ================================================================================================
// JOB 3812 · DIE RECHTE SPALTE — dieselben Fragen, für den Rollbereich des Artikels.
// ================================================================================================
//
// Auch das ist eine SICHTBARE Änderung (bei flachen Fenstern steht jetzt ein Rollbalken an der
// Karte), und §9 des Auftrags verlangt für jede Lage eine Antwort. Die Wirkung misst der
// Browserblock (L15/L17); hier steht, WO die Regeln hängen und was in den Lagen ohne Artikel
// geschieht — die Frage, die jsdom beantworten kann und der Browser nur mit einem Bühnenumbau.
describe("JOB 3812 · der eigene Rollbereich der Artikelspalte", () => {
  const SPALTE = '[data-testid="pruefen-artikelspalte"]';
  const spalte = (b: Brett): HTMLElement | null => b.container.querySelector<HTMLElement>(SPALTE);

  it("F7 · Bestand: die Artikelspalte trägt einen eigenen Rollbereich — und jede Regel nur in der breiten Bauform", async () => {
    brett = await mounteBrett(TITEL);
    const el = spalte(brett);
    expect(el, "die Artikelspalte steht").not.toBeNull();
    const klassen = (el?.className ?? "").split(/\s+/).filter(Boolean);
    // Dieselben drei Teile wie an der Liste, aus demselben Grund: `h-full` holt die Höhe der
    // Fläche in die Spalte (`items-start` streckt sie nicht), `min-h-0` erlaubt ihr, unter die
    // Höhe der Karte zu schrumpfen, und erst dann bewegt `overflow-y-auto` etwas.
    for (const k of ["h-full", "min-h-0", "overflow-y-auto"]) {
      expect(klassen, `der Artikelspalte fehlt ${BREITE_STUFE}${k}`).toContain(
        `${BREITE_STUFE}${k}`,
      );
    }
    // Und die Regel dahinter (wie F2): was hier Höhe deckelt oder Überlauf regelt, gilt NUR breit.
    // Der schmale Weg führt den Blick bewusst zur Karte; eine gedeckelte Karte wäre dort eine
    // Verschlechterung.
    const rollend = klassen.filter((k) => /(^|:)(max-h-|min-h-|h-full|overflow-)/.test(k));
    expect(rollend.length, "keine einzige Rollregel gefunden — F7 prüfte nichts").toBeGreaterThan(
      0,
    );
    expect(rollend.filter((k) => !k.startsWith(BREITE_STUFE))).toEqual([]);
    // Kein Prozentdeckel: `vh` rechnet den Kopf über der Fläche nicht mit (Lehre aus JOB 3625).
    expect(klassen.filter((k) => /\[\d+vh\]/.test(k))).toEqual([]);
  });

  it("F8 · Bestand: die Spalte ist in der breiten Bauform ein Halt in der Tabreihenfolge", async () => {
    brett = await mounteBrett(TITEL);
    // Die Kulisse montiert in der BREITEN Lage (`kulisse.tsx:10`: kein `matchMedia`-Stub,
    // `useMediaQuery` liefert `false`) — gemessen wird hier also der breite Wert. Ein Rollbereich,
    // in den die Tastatur nicht kommt, ist keiner; dass ein Tabschritt aus der Liste wirklich
    // dorthin führt und „Ende" wirklich rollt, misst L17 im echten Browser.
    //
    // GRENZE, ausdrücklich: der SCHMALE Wert (-1, damit der Klick den Blick führen kann, ohne
    // einen Tabstopp zu erzeugen) ist hier nicht gemessen — diese Kulisse kennt die schmale Lage
    // nicht. Er steht unverändert im Quelltext (`Validation.tsx`, `tabIndex={schmal ? -1 : 0}`).
    expect(spalte(brett)?.getAttribute("tabindex")).toBe("0");
  });

  for (const [name, antwort] of [
    ["leer", { art: "leer" } as const],
    ["lädt", { art: "laedt" } as const],
    ["Erstfehler", { art: "erstfehler" } as const],
  ] as const) {
    it(`F9 · ${name}: die Artikelspalte steht, ist aber leer — kein Artikel, also auch kein Rollbalken`, async () => {
      brett = await mounteLage(antwort);
      const el = spalte(brett);
      expect(el, "die Artikelspalte steht auch ohne Artikel").not.toBeNull();
      // §9 des Auftrags: „die rechte Spalte ist leer und darf keinen leeren Rollbalken zeigen."
      // Der Rollbalken hängt am ÜBERLAUF, und ohne Kind gibt es keinen — das ist hier kein
      // Argument, sondern der gemessene Zustand: die Spalte hat kein einziges Kind.
      expect(el?.querySelector('[data-testid="pruefen-karte"]')).toBeNull();
      expect(el?.childElementCount, "in der leeren Spalte steht etwas").toBe(0);
    });
  }

  /**
   * JOB 3812 · RUNDE 2 — DIE ROLLSTELLUNG MESSBAR MACHEN, WO ES KEIN LAYOUT GIBT.
   *
   * Der Prüfbericht der Runde 1 hat F10 zu Recht als zu schwach bezeichnet: „beweist nur
   * Elementidentität, keine stabile Rollstellung". jsdom rechnet kein Layout, `scrollTop` ist dort
   * immer 0 und lässt sich nicht rollen — die ZAHL ist hier also nicht zu messen.
   *
   * WAS SICH MESSEN LÄSST, ist der einzige Weg, auf dem die Rollstellung überhaupt springen kann:
   * ein SCHREIBZUGRIFF auf `scrollTop`. Dieser Zähler hängt sich an genau dieses eine Element und
   * schreibt jeden Zugriff mit. Damit sagt F10 „bei einer Auffrischung schreibt niemand" und F11
   * „bei einem Artikelwechsel schreibt genau einer, und zwar eine Null" — beides Tatsachen über das
   * Produkt und nicht über jsdom. Die WIRKUNG in Pixeln misst L19 im echten Browser.
   */
  const rollzaehler = (el: HTMLElement): { schreibt: number[]; setze: (v: number) => void } => {
    let wert = 0;
    const schreibt: number[] = [];
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => wert,
      set: (v: number) => {
        wert = v;
        schreibt.push(v);
      },
    });
    return {
      schreibt,
      setze: (v: number) => {
        wert = v;
        schreibt.length = 0;
      },
    };
  };

  it("F10 · Auffrischung: die Spalte bleibt dieselbe, und niemand verstellt ihre Rollstellung", async () => {
    brett = await mounteBrett(TITEL);
    const vorher = spalte(brett);
    expect(vorher, "die Artikelspalte steht").not.toBeNull();
    if (!vorher) return;
    // §9: „die Rollstellung darf durch eine eintreffende Auffrischung nicht springen." Zwei Gründe,
    // beide hier gemessen: (1) die Spalte wird nicht neu gehängt — die Karte ist eine
    // ZEICHENFUNKTION und keine innere Komponente (`Validation.tsx`, `karte(aktiv)`), und die
    // Spalte steht ausserhalb jeder Lagen-Verzweigung; ein neu gehängtes Element fienge bei 0 an.
    // (2) Der Nullsteller der Spalte hängt an der `id` des gezeigten Artikels und NICHT am Objekt:
    // eine Auffrischung liefert ein neues Objekt für denselben Artikel, und daran darf sich nichts
    // entscheiden. Ohne (2) spränge die Rollstellung bei jeder Auffrischung auf null.
    const zaehler = rollzaehler(vorher);
    zaehler.setze(120);
    await act(async () => {
      await brett.qc.invalidateQueries({ queryKey: ["validation", "board"] });
    });
    await flush();
    expect(spalte(brett), "die Artikelspalte ist nach der Auffrischung eine andere").toBe(vorher);
    expect(
      zaehler.schreibt,
      `die Auffrischung hat die Rollstellung verstellt (Schreibzugriffe: ${zaehler.schreibt.join(", ")})`,
    ).toEqual([]);
    expect(vorher.scrollTop, "die Rollstellung steht nicht mehr da, wo sie stand").toBe(120);
  });

  it("F11 · Artikelwechsel: der neue Artikel fängt oben an — die Rollstellung wird genau einmal genullt", async () => {
    brett = await mounteBrett(TITEL);
    const el = spalte(brett);
    expect(el, "die Artikelspalte steht").not.toBeNull();
    if (!el) return;
    expect(kartenTitel(brett), "rechts steht der erste Artikel").toBe(TITEL[0]);
    const zaehler = rollzaehler(el);
    zaehler.setze(120);
    // Der Weg eines Menschen: ein Klick auf den nächsten Eintrag der Liste.
    await klick(eintrag(brett, 1));
    expect(kartenTitel(brett), "rechts steht jetzt der zweite Artikel").toBe(TITEL[1]);
    // Genau EINE Null, nicht zwei und nicht keine: keine sagt, der neue Artikel begänne in der
    // Mitte des alten; mehrere sagen, dass hier mehr als eine Stelle an derselben Zahl dreht.
    expect(
      zaehler.schreibt,
      `beim Artikelwechsel wurde die Rollstellung nicht genau einmal genullt (Schreibzugriffe: ${zaehler.schreibt.join(", ")})`,
    ).toEqual([0]);
  });
});

// ================================================================================================
// JOB 3812 · RUNDE 3 — WOGEGEN DER ORT DES MENÜBLATTS GEKLEMMT IST, UND WER IHM ZUHÖRT.
// ================================================================================================
//
// DER BEFUND, DER HIERHER FÜHRT (Prüfbericht der Runde 2, Korrekturpflichten 1–3): Das Blatt hängt
// seit Runde 1 am Fenster (`position: fixed`), und Runde 2 hat seine Lage bei jedem `resize` neu
// aus dem Rechteck des Auslösers gerechnet. Mit einem langen Artikel gemessen: Blatt bei 1280×900
// geöffnet, Fenster auf 420 verkleinert, Artikelspalte 713 px ans Ende gerollt, dann die
// Fensterbreite geändert — der Auslöser stand da bei `top` −549,5 px, und das Blatt landete bei
// −517,5 bis −269,5 px, also vollständig über dem Fenster und an keinem Punkt mehr bedienbar.
//
// ZWEI FRAGEN, DIE JSDOM BEANTWORTEN KANN, und die zusammen genau diese Klasse schliessen:
//   F12 · WAS geschrieben wird — eine Zahl von früher oder ein Ausdruck gegen das laufende Fenster.
//   F13 · WER zuhört, solange das Blatt offen ist. Pedis Grenze (HINWEIS 4) lautet „kein neuer
//         Handler überhaupt"; diese Frage ist eine Tatsache über das Produkt, keine Absichtserklärung.
//
// DIE WIRKUNG IN PIXELN misst weiterhin der Browserblock (L16/L18/L18b/L18c in
// `tests/design/job2935-validierung-fussband.test.ts`) — hier steht, WAS an der Fläche hängt.
describe("JOB 3812 · Runde 3 · der Ort des Menüblatts", () => {
  const AUSLOESER = '[data-testid="pruefen-menue-karte"]';
  const BLATT = '[data-testid="pruefen-menue-panel-karte"]';

  /**
   * Fenster und Auslöser stellen — jsdom rechnet kein Layout, also kommen beide Zahlen von hier.
   * Genau das macht diesen Fall erst möglich: die Lage aus dem Prüfbericht (ein Auslöser weit
   * ÜBER dem Fenster) ist im Browser nur mit einem langen Artikel und drei Schritten herzustellen,
   * hier ist sie eine Angabe. Beide Wege messen dieselbe Rechnung.
   */
  const stellen = (el: HTMLElement, kasten: { top: number; right: number }): void => {
    for (const [name, wert] of [
      ["clientHeight", 420],
      ["clientWidth", 1280],
    ] as const) {
      Object.defineProperty(document.documentElement, name, { value: wert, configurable: true });
    }
    el.getBoundingClientRect = () =>
      ({
        top: kasten.top,
        bottom: kasten.top + 28,
        left: kasten.right - 32,
        right: kasten.right,
        width: 32,
        height: 28,
        x: kasten.right - 32,
        y: kasten.top,
        toJSON: () => ({}),
      }) as DOMRect;
  };

  afterEach(() => {
    for (const name of ["clientHeight", "clientWidth"]) {
      Reflect.deleteProperty(document.documentElement, name);
    }
  });

  it("F12 · ein weggerollter Auslöser zieht das Blatt nicht aus dem Fenster — die Klemme hängt am Fenster", async () => {
    brett = await mounteBrett(TITEL);
    const knopf = brett.container.querySelector<HTMLElement>(AUSLOESER);
    expect(knopf, "das Handlungsmenü der Karte steht").not.toBeNull();
    if (!knopf) return;
    // Die Lage des Prüfberichts: der Auslöser ist mit der Artikelspalte aus dem Bild gerollt.
    stellen(knopf, { top: -549.5, right: 1160 });
    await klick(knopf);
    const blatt = brett.container.querySelector<HTMLElement>(BLATT);
    expect(blatt, "das Blatt des Menüs steht").not.toBeNull();
    if (!blatt) return;
    const ort = blatt.style.getPropertyValue("--kw-blatt-ort");
    // DIE EIGENTLICHE AUSSAGE. Ohne Klemme stünde hier `-517.5px` (−549,5 + 32) — die Zahl, mit
    // der das Blatt im Prüfbericht über dem Fenster landete. Mit Klemme steht ein Ausdruck da,
    // dessen Untergrenze die Randluft ist (8 px = BLATT_RAND_PX) und dessen Obergrenze am FENSTER
    // hängt (`100%` ist bei `position: fixed` dessen Höhe, 72 px = BLATT_MINDEST_PX + BLATT_RAND_PX).
    // Dass er gegen das Fenster rechnet und nicht gegen eine Zahl von früher, ist der ganze
    // Unterschied: nur so gilt er auch nach der nächsten Fensteränderung noch.
    expect(
      ort,
      `der Ort des Blatts ist „${ort}" — ohne Fensterbezug (100 %) ist er eine Zahl von früher, und ein weggerollter Auslöser zieht das Blatt mit sich`,
    ).toBe("clamp(8px, -517.5px, calc(100% - 72px))");
    // Und der Deckel hängt am selben Fenster: der kleinere aus dem Anteil zur Zeit des Klicks
    // (0,7 × 420) und dem freien Platz unter dem Ort. L18 misst, dass er sich dabei WIRKLICH
    // ändert (im flachen Fenster kürzer als im hohen).
    expect(blatt.style.getPropertyValue("--kw-blatt-deckel")).toBe(
      "min(294px, calc(100% - var(--kw-blatt-ort) - 8px))",
    );
    // Die zwei Klassen, die diese Werte lesen. Ohne sie stünden zwei richtige Zahlen an einer
    // Fläche, die sie nicht benutzt — deshalb gehören sie in dieselbe Zusicherung.
    const klassen = blatt.className.split(/\s+/);
    expect(klassen, "das Blatt liest den Ort nicht").toContain("[top:var(--kw-blatt-ort)]");
    expect(klassen, "das Blatt liest den Deckel nicht").toContain(
      "[max-height:var(--kw-blatt-deckel)]",
    );
  });

  /**
   * Wer hängt sich während EINER Handlung ans Fenster? Gezählt werden die Arten, nicht die Zahl
   * der Aufrufe — zweimal derselbe Zuhörer ist derselbe Zuhörer.
   */
  const zuhoerer = async (tun: () => Promise<void>): Promise<string[]> => {
    const spion = vi.spyOn(window, "addEventListener");
    await tun();
    const typen = [...new Set(spion.mock.calls.map((c) => String(c[0])))].sort();
    spion.mockRestore();
    return typen;
  };

  it("F13 · solange das Blatt offen ist, hängt genau EIN Zuhörer am Fenster — der für Escape", async () => {
    brett = await mounteBrett(TITEL);
    // ERST EINE KONTROLLMESSUNG, und zwar mit einem Klick, der KEIN Menü öffnet: die Umgebung
    // (jsdom, React, der Testlauf) hängt selbst etwas ans Fenster — gemessen ein `error`-Zuhörer.
    // Was in beiden Messungen vorkommt, gehört nicht dem Menü und wird abgezogen. Ohne diesen
    // Abzug müsste die Zusicherung Fremdnamen aufzählen und wäre nach dem nächsten Versionssprung
    // der Umgebung falsch, ohne dass sich am Produkt etwas geändert hätte.
    const fremd = await zuhoerer(() => klick(eintrag(brett, 1)));
    const knopf = brett.container.querySelector<HTMLElement>(AUSLOESER);
    expect(knopf, "das Handlungsmenü der Karte steht").not.toBeNull();
    if (!knopf) return;
    const beimOeffnen = await zuhoerer(() => klick(knopf));
    expect(
      brett.container.querySelector(BLATT),
      "das Blatt ist gar nicht aufgegangen — F13 prüfte nichts",
    ).not.toBeNull();
    expect(
      beimOeffnen,
      `beim Öffnen kam kein Zuhörer für Escape dazu (gemessen: ${beimOeffnen.join(", ") || "keine"})`,
    ).toContain("keydown");
    // DIE EIGENTLICHE AUSSAGE. Runde 2 hatte hier einen zweiten Zuhörer (`resize`), der die Lage
    // nachrechnete: er war die Ursache des Befunds (F12) UND ein Verstoss gegen Pedis Grenze
    // „kein neuer Handler überhaupt". Seit Runde 3 rechnet das CSS, und hier hängt nichts mehr.
    const eigene = beimOeffnen.filter((t) => !fremd.includes(t));
    expect(
      eigene,
      `das Öffnen des Menüs hängt diese Zuhörer ans Fenster: ${eigene.join(", ") || "keine"} (Kontrollmessung ohne Menü: ${fremd.join(", ") || "keine"})`,
    ).toEqual(["keydown"]);
  });
});
