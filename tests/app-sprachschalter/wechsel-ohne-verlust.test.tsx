// @vitest-environment jsdom
// ================================================================================================
// JOB 3323 · B/C/D — DER WECHSEL MITTEN IN DER SZENE: NICHTS GEHT VERLOREN, NICHTS WIRD ÜBERSETZT,
// WAS INHALT IST.
// ================================================================================================
//
// Das ist die eigentliche Zusage des Auftrags, und sie zerfällt in drei Fragen, die hier getrennt
// gemessen werden:
//
//   B  BLEIBT DER ZUSTAND?  Ein ungesicherter Entwurfstitel im Erfassen-Blatt, eine ausgewählte
//      Zeile in der Prüf-Warteschlange, ein aufgeklapptes „Mehr", ein getippter Bibliotheksfilter.
//      Gemessen wird nicht nur der WERT, sondern die KNOTENIDENTITÄT: nach dem Wechsel muss es
//      DASSELBE DOM-Element sein. Ein gleicher Wert in einem neuen Knoten hieße „neu montiert" —
//      und dann wären Cursor, Auswahl und Scrollposition in Wahrheit weg, obwohl der Text stimmt.
//      Genau diesen Unterschied verschweigt ein reiner Wertvergleich.
//
//   C  BLEIBT DER INHALT UNANGETASTET?  Titel und Aussage des geprüften Objekts werden VOR und NACH
//      dem Wechsel zeichenweise verglichen. Übersetzt werden dürfen ausschließlich Beschriftungen
//      der Oberfläche — dass die sich WIRKLICH ändern, steht als eigene Zusicherung daneben; ohne
//      sie wäre „Inhalt unverändert" auch dann grün, wenn der Wechsel gar nichts getan hätte.
//
//   D  KOSTET DER WECHSEL ETWAS?  Kein Netzabruf, kein Modellaufruf, kein Neuladen. Gemessen wird
//      an einem Zähler über der stillgelegten HTTP-Grenze und an `fetch` — beide dürfen über den
//      Wechsel hinweg NICHT wachsen.
//
// GEGENPROBEN (in der Rückgabe protokolliert): (1) `<SprachSchalter/>` aus `KontoEintraege`
// entfernt → die Fälle finden den Schalter nicht mehr; (2) in `shell/AppShell.tsx` die Inhaltsfläche
// mit `key={i18n.language}` versehen (samt `useTranslation`, sonst rendert die Shell beim Wechsel
// gar nicht neu und die Gegenprobe wäre wirkungslos) → 4 von 5 Fällen rot: Titel weg, `<details>`
// zugeklappt, Knoten neu — UND drei zusätzliche Endpunktaufrufe, weil ein Neuaufbau neu lädt.
// Genau das ist der Preis, den ein Neuladen hätte; (3) `window.location.assign` in den Schalter
// gesetzt → der Quelltextfall unten wird rot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia Klar", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die HTTP-Grenze ist stillgelegt UND GEZÄHLT. Der Zähler ist der Beleg für Lieferpunkt 5: der
// Sprachwechsel darf keinen einzigen Abruf auslösen — weder einen Datenabruf noch einen
// Modellaufruf (jeder Modellweg dieses Produkts läuft über `endpoints`).
const { AUFRUFE, ANTWORTEN } = vi.hoisted(() => ({
  AUFRUFE: [] as string[],
  ANTWORTEN: {} as Record<string, unknown>,
}));
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => ANTWORTEN[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
        apply(target, self, args) {
          AUFRUFE.push(pfad);
          return Reflect.apply(target as never, self, args);
        },
      },
    );
  return { endpoints: make("") };
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { Library } from "../../apps/web/src/pages/Library";
import { Validation } from "../../apps/web/src/pages/Validation";
import {
  type Montage,
  breite,
  flush,
  klick,
  kontoMenueOeffnen,
  montiere,
  schreibeInRumpf,
  sprachKnopf,
} from "./huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Ein echtes, offenes Wissensobjekt für den Prüfstand — die Form, die der Server liefert. */
const KO = {
  id: "a",
  title: "PROBE-TITEL-A",
  statement: "PROBE-AUSSAGE-A",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Anlage 1",
  tags: [],
  confidence: 50,
  trust: 0,
  status: "offen",
  version: 1,
  originalAuthor: "u9",
  author: "u9",
  neededValidations: 2,
  assignments: ["u1"],
  reviewVotes: { up: 0, warn: 0, down: 0 },
  staleVotes: 0,
  asset: null,
  createdAt: "2026-07-20T00:00:00.000Z",
  history: [],
};

/** Meldet die aktuelle Adresse in den Baum — so ist „kein Routenwechsel" wirklich gemessen. */
function Ortsmelder(): JSX.Element {
  const ort = useLocation();
  return createElement("span", {
    "data-testid": "ort",
    children: `${ort.pathname}${ort.search}`,
  });
}

let montage: Montage | null = null;

function neueQc(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function ort(c: HTMLElement): string {
  return c.querySelector('[data-testid="ort"]')?.textContent ?? "";
}

/** Text wie ein Mensch setzen: nativer Value-Setter + input-Event (React-onChange). */
async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Der Wechsel, so wie Pedi ihn macht: Konto-Kreis, dann der Sprachknopf. */
async function wechsleAuf(c: HTMLElement, sprache: string): Promise<void> {
  await kontoMenueOeffnen(c);
  await klick(sprachKnopf(c, sprache));
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  breite(1280);
  AUFRUFE.length = 0;
  for (const k of Object.keys(ANTWORTEN)) {
    delete ANTWORTEN[k];
  }
});

afterEach(() => {
  montage?.abbauen();
  montage = null;
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("JOB 3323 B · /erfassen — der ungesicherte Entwurf überlebt den Wechsel", () => {
  it("Titel, RUMPF und SCROLLPOSITION bleiben, im DEMSELBEN Feld — und die Beschriftungen wechseln", async () => {
    montage = await montiere(
      "/erfassen",
      createElement("div", null, createElement(Capture), createElement(Ortsmelder)),
      neueQc(),
    );
    const c = montage.container;

    const feldVorher = c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
    expect(feldVorher, "Titelfeld des Erfassen-Blatts fehlt").toBeTruthy();
    const TEXT = "Halterungen ohne waagerechte Oberseiten — noch nicht gespeichert";
    await tippe(feldVorher as HTMLInputElement, TEXT);
    expect((feldVorher as HTMLInputElement).value).toBe(TEXT);

    // ==============================================================================================
    // JOB 3323 R2 (Codex-Vorprüfung, Prüflücke 1) — NICHT NUR DER TITEL.
    // ==============================================================================================
    // Runde 1 hat hier ausschliesslich das Titelfeld gemessen. Der Titel ist aber das EINFACHSTE
    // Stück Zustand des Blattes: ein kontrolliertes `<input>`, das ein Neurendern ohnehin übersteht.
    // Die beiden Stücke, an denen ein Verlust wirklich weh tut, standen nicht im Fall:
    //   · DER RUMPF — ein unkontrolliertes `contentEditable` (`RichTextEditor.tsx`), dessen Inhalt
    //     im DOM lebt. Wird es neu montiert, ist der ungesicherte Text weg, und zwar restlos.
    //   · DIE SCROLLPOSITION — sie hängt am KNOTEN, nicht am Zustand. Ein neu montierter Knoten
    //     beginnt bei 0; genau deshalb ist sie der schärfste Zeuge gegen einen stillen Neuaufbau.
    const RUMPF = "UNGESICHERTER RUMPF — mitten im Satz";
    await schreibeInRumpf(c, RUMPF);
    const schreibflaecheVorher = c.querySelector('[data-testid="blatt-text"] [role="textbox"]');
    expect(schreibflaecheVorher?.textContent).toContain(RUMPF);

    // jsdom rechnet kein Layout, merkt sich einen gesetzten `scrollTop` aber sehr wohl (gemessen).
    // Damit ist die Zusicherung echt: überlebt der Wert den Wechsel, wurde der Knoten NICHT ersetzt.
    const scrollflaeche = c.querySelector("main");
    expect(scrollflaeche, "Inhaltsfläche der Hülle fehlt").toBeTruthy();
    (scrollflaeche as HTMLElement).scrollTop = 240;
    expect((scrollflaeche as HTMLElement).scrollTop).toBe(240);

    // Vor dem Wechsel: die Hülle spricht Deutsch.
    const suche = () =>
      c.querySelector<HTMLInputElement>('[data-testid="kopfband"] input[type="search"]');
    expect(suche()?.getAttribute("placeholder")).toBe("Suchen");

    await wechsleAuf(c, "en");

    // 1. DIE SPRACHE IST WIRKLICH GEWECHSELT — sonst wäre alles Weitere trivial grün.
    expect(i18n.language).toBe("en");
    expect(suche()?.getAttribute("placeholder")).toBe("Search");
    expect(c.querySelector('[data-testid="kopfband-konto"]')?.getAttribute("aria-label")).toBe(
      "Account",
    );

    // 2. DER TEXT IST DA — und zwar im SELBEN Knoten. Ein neuer Knoten mit gleichem Wert hieße:
    //    neu montiert, also Cursor und Auswahl in Wahrheit verloren.
    const feldNachher = c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
    expect(feldNachher).toBe(feldVorher);
    expect(feldNachher?.value).toBe(TEXT);

    // 2b. DER RUMPF STEHT — im SELBEN contentEditable, mit demselben Text.
    const schreibflaecheNachher = c.querySelector('[data-testid="blatt-text"] [role="textbox"]');
    expect(schreibflaecheNachher, "die Schreibfläche wurde neu montiert").toBe(
      schreibflaecheVorher,
    );
    expect(
      schreibflaecheNachher?.textContent,
      "der ungesicherte Rumpf ist beim Sprachwechsel verloren gegangen",
    ).toContain(RUMPF);

    // 2c. DIE SCROLLPOSITION STEHT — derselbe Knoten, derselbe Wert.
    expect(c.querySelector("main")).toBe(scrollflaeche);
    expect(
      (scrollflaeche as HTMLElement).scrollTop,
      "die Scrollposition wurde durch den Sprachwechsel zurückgesetzt",
    ).toBe(240);

    // 3. KEIN ROUTENWECHSEL.
    expect(ort(c)).toBe("/erfassen");

    // 4. Und zurück auf Deutsch, mitten in derselben Szene — alles drei steht immer noch.
    await wechsleAuf(c, "de");
    expect(i18n.language).toBe("de");
    expect(suche()?.getAttribute("placeholder")).toBe("Suchen");
    expect(c.querySelector('[data-testid="blatt-titel"]')).toBe(feldVorher);
    expect((feldVorher as HTMLInputElement).value).toBe(TEXT);
    expect(c.querySelector('[data-testid="blatt-text"] [role="textbox"]')).toBe(
      schreibflaecheVorher,
    );
    expect(schreibflaecheVorher?.textContent).toContain(RUMPF);
    expect((scrollflaeche as HTMLElement).scrollTop).toBe(240);
    expect(ort(c)).toBe("/erfassen");
  });
});

describe("JOB 3323 B/C · /validierung — geöffnete Prüfung bleibt offen, der Inhalt bleibt Inhalt", () => {
  beforeEach(() => {
    // Ein echtes offenes Objekt im Prüfboard — sonst gäbe es gar nichts zu öffnen.
    ANTWORTEN["validation.board"] = [KO];
  });

  it("Auswahl und aufgeklappter Bereich überstehen den Wechsel; Titel und Aussage sind byteweise gleich", async () => {
    montage = await montiere(
      "/validierung",
      createElement("div", null, createElement(Validation), createElement(Ortsmelder)),
      neueQc(),
    );
    const c = montage.container;

    const eintrag = c.querySelector('[data-testid="pruefen-warteschlange-eintrag"]');
    expect(eintrag, "Warteschlangen-Eintrag fehlt").toBeTruthy();
    await klick(eintrag);

    // Der Prüfstand steht offen: das Objekt ist geladen, seine Entscheidungsknöpfe sind da.
    const freigeben = c.querySelector('[data-testid="pruefen-entscheidung-up"]');
    expect(freigeben).toBeTruthy();
    expect(freigeben?.textContent?.trim()).toBe(i18n.t("val.actionApprove"));

    // Ein echter, lokaler Aufklappzustand: das <details> „Mehr" am Objekt.
    const details = c.querySelector("main details");
    expect(details, "Aufklapper „Mehr“ fehlt").toBeTruthy();
    await act(async () => {
      (details as HTMLDetailsElement).open = true;
      details?.dispatchEvent(new Event("toggle", { bubbles: false }));
      await flush();
    });
    expect((details as HTMLDetailsElement).open).toBe(true);

    // ============================================================================================
    // DER INHALT, VOR DEM WECHSEL — und zwar an den BLATTKNOTEN, nicht an ihren Vorfahren.
    // ============================================================================================
    // Ein Vorfahr trägt neben dem Objekttext auch jede Beschriftung darum herum; er ändert sich
    // beim Wechsel notwendig und sagt über den INHALT nichts aus. Gemessen wird deshalb an den
    // Elementen ohne Kindelemente: dort steht Inhalt und nur Inhalt.
    const inhaltsknoten = (): Element[] =>
      [...c.querySelectorAll("main *")].filter(
        (e) => e.children.length === 0 && (e.textContent ?? "").includes("PROBE-"),
      );
    const knotenVorher = inhaltsknoten();
    const inhaltVorher = knotenVorher.map((e) => e.textContent ?? "");
    expect(inhaltVorher.length).toBeGreaterThan(0);

    await wechsleAuf(c, "en");

    // 1. Beschriftungen sind übersetzt — der Wechsel hat wirklich stattgefunden.
    expect(i18n.language).toBe("en");
    expect(c.querySelector('[data-testid="pruefen-entscheidung-up"]')?.textContent?.trim()).toBe(
      i18n.getFixedT("en")("val.actionApprove"),
    );

    // 2. Der Prüfstand ist NICHT zugeklappt und NICHT neu montiert.
    expect(c.querySelector("main details")).toBe(details);
    expect((details as HTMLDetailsElement).open).toBe(true);
    expect(c.querySelector('[data-testid="pruefen-warteschlange-eintrag"]')).toBe(eintrag);

    // 3. Der INHALT ist zeichengleich — kein Wort daran ist übersetzt worden, und er steht in
    //    denselben Knoten wie vorher (also auch nicht neu aufgebaut).
    const knotenNachher = inhaltsknoten();
    expect(knotenNachher.map((e) => e.textContent ?? "")).toEqual(inhaltVorher);
    expect(knotenNachher).toEqual(knotenVorher);
    expect(c.querySelector("main")?.textContent).toContain("PROBE-TITEL-A");
    expect(c.querySelector("main")?.textContent).toContain("PROBE-AUSSAGE-A");

    // 4. Keine Route hat sich bewegt.
    expect(ort(c)).toBe("/validierung");
  });
});

describe("JOB 3323 B · /bibliothek — der getippte Filter bleibt stehen", () => {
  it("Suchtext in der Bibliothek überlebt DE→EN→DE im selben Feld", async () => {
    montage = await montiere(
      "/bibliothek",
      createElement("div", null, createElement(Library), createElement(Ortsmelder)),
      neueQc(),
    );
    const c = montage.container;
    const feld = c.querySelector<HTMLInputElement>('[data-testid="bib-suche"]');
    expect(feld, "Suchfeld der Bibliothek fehlt").toBeTruthy();
    await tippe(feld as HTMLInputElement, "Halterung");

    await wechsleAuf(c, "en");
    expect(c.querySelector('[data-testid="bib-suche"]')).toBe(feld);
    expect(feld?.value).toBe("Halterung");

    await wechsleAuf(c, "de");
    expect(c.querySelector('[data-testid="bib-suche"]')).toBe(feld);
    expect(feld?.value).toBe("Halterung");
    expect(ort(c)).toBe("/bibliothek");
  });
});

describe("JOB 3323 D · der Wechsel kostet nichts: kein Abruf, kein Modell, kein Neuladen", () => {
  it("über den Wechsel hinweg wächst weder der Endpunkt-Zähler noch fetch", async () => {
    const fetchSpion = vi.fn(async () => new Response("[]"));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpion;
    montage = await montiere(
      "/erfassen",
      createElement("div", null, createElement(Capture), createElement(Ortsmelder)),
      neueQc(),
    );
    const c = montage.container;
    // Die Seite hat beim Aufbau abgerufen — das ist normal. Ab HIER wird gezählt.
    await kontoMenueOeffnen(c);
    const vorher = [...AUFRUFE];
    const fetchVorher = fetchSpion.mock.calls.length;

    await klick(sprachKnopf(c, "en"));
    await act(flush);

    expect(i18n.language).toBe("en");
    expect(
      AUFRUFE,
      `Der Sprachwechsel hat abgerufen: ${AUFRUFE.slice(vorher.length).join(", ")}`,
    ).toEqual(vorher);
    expect(fetchSpion.mock.calls.length).toBe(fetchVorher);
  });

  it("der Schalter kennt keinen Neulade- und keinen Navigationsweg (Quelltext, nicht Absicht)", () => {
    const quelle = readFileSync(
      join(__dirname, "..", "..", "apps/web/src/components/SprachSchalter.tsx"),
      "utf8",
    );
    // Kommentare heraus, sonst zählte die Begründung als Befund.
    const code = quelle
      .split("\n")
      .filter((z) => !z.trimStart().startsWith("//"))
      .join("\n");
    for (const verboten of [
      "location.reload",
      "location.assign",
      "location.replace",
      "window.location",
      "useNavigate",
      "<a ",
      "href",
    ]) {
      expect(code, `Der Sprachschalter darf ${verboten} nicht benutzen`).not.toContain(verboten);
    }
    // Und der EINE Weg, den er benutzt, ist der bestehende — derselbe wie in Profil und Anmeldung.
    expect(code).toContain("i18n.changeLanguage(l)");
  });
});
