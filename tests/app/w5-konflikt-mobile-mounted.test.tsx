// @vitest-environment jsdom
// ================================================================================================
// JOB 1157 D1 · W5 — DIE GEMOUNTETE MOBILE-DARSTELLUNG DES KONFLIKTZUSTANDS.
// ================================================================================================
//
// Die Deckung gab es einmal (JOB 547, `tests/app/w5-konflikt-mobile-mounted.test.tsx`); sie fehlt
// im Produkt. Dieser Durchgang baut sie neu — gegen das heutige Verhalten.
//
// GEMESSENER PRODUKTSTAND (Base 3a980881, in diesem Durchgang gelesen):
//   Renderer   apps/web/src/pages/Ask.tsx:953-971 — die Warnkarte an `effective?.sourcesConflicted`
//   Ableitung  apps/web/src/lib/effectiveAnswer.ts:162 (`carryingSources.some(s => s.conflictLimited)`)
//   Quelle     apps/web/src/api/hooks.ts:71-75 (`useConflicts` → `endpoints.conflicts.list`)
//
// ================================================================================================
// D2 — WAS BEN AN D1 ZU RECHT BEANSTANDET HAT, UND WAS DARAUS FOLGT.
// ================================================================================================
//
// D1 stellte hier eine „schmale Umgebung" her, indem es `window.innerWidth` setzte und
// `matchMedia` stubte. BENs Urteil: „Ein `matchMedia`-Stub in jsdom zaehlt nur, wenn der gepruefte
// Renderpfad ihn nachweislich auswertet." Das tut er nicht. In D2 nachgemessen, im ganzen Client:
//
//   · `matchMedia` wird an GENAU EINER Stelle gelesen — `apps/web/src/shell/useMediaQuery.ts:11`.
//   · `useMediaQuery` hat GENAU ZWEI Verbraucher — `apps/web/src/shell/AppShell.tsx:27` und
//     `apps/web/src/components/FacetFilter.tsx:105`.
//   · `apps/web/src/pages/Ask.tsx` enthaelt WEDER `matchMedia` NOCH `useMediaQuery` NOCH
//     `innerWidth` NOCH einen `resize`-Horcher — kein einziger Treffer.
//   · Die Warnkarte (`Ask.tsx:953-971`) haengt allein an `effective?.sourcesConflicted`; sie ist
//     rein CSS-responsiv, es gibt keinen Breitenzweig.
//   · Diese Datei mountet `Ask` ausserdem OHNE `AppShell` — selbst dessen `useMediaQuery` liegt
//     also nicht im gepruefen Pfad.
//
// Der Stub war damit ein Scheinbeleg: er setzte ein Signal, das niemand liest. Er ist in D2
// ERSATZLOS ENTFERNT. Eine schmale Umgebung vorzutaeuschen, die nichts bewirkt, ist schlimmer als
// gar keine — sie liest sich im Dateinamen wie eine mobile Zusage.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI KANN — UND WAS SIE AUSDRUECKLICH AN DIE BROWSERSONDE ABGIBT.
// ------------------------------------------------------------------------------------------------
//
// KANN sie: den gerenderten DOM messen. Ob die Karte da ist, ob ihr Text lesbar im `textContent`
// steht (nicht nur in einem `title`), ob der Ausweg ein echter Anker mit `href` ist, und ob kein
// Vorfahre sie per Klasse versteckt. Diese Zusagen gelten breitenunabhaengig, weil das Produkt
// keine Breite unterscheidet — genau das ist oben gemessen.
//
// KANN sie NICHT: „nicht abgeschnitten" im Sinne von Geometrie. jsdom rechnet kein Layout,
// `getBoundingClientRect` liefert dort durchweg Nullen, und `vitest.config.ts` kennt keinen
// Browsermodus. Ein gruener Fall daraus waere eine Falschaussage — dieselbe Sorte, die BEN gerade
// beanstandet hat.
//
// DESHALB ABGEGEBEN: Die Clipping-/Sichtbarkeitszusage am Telefon-Viewport gehoert in eine
// CSS-faehige Playwright-Sonde unter `tests-smoke/` (dort setzen die Bestandssonden ihren
// Viewport, z. B. `tests-smoke/ui-smoke.spec.ts:256` mit 390x844). Dieser Pfad liegt AUSSERHALB
// der D2-Lease; die fertige Sonde liegt in der Arbeitsspur und ist in der Rueckgabe als Blocker
// mit Pfadangabe benannt.
//
// Damit diese Abgabe ehrlich bleibt, steht unten der Fall „KEIN BREITENZWEIG": er misst die
// Voraussetzung, auf der die Abgabe ruht. Baut jemand einen mobilen Renderzweig in `Ask.tsx`,
// wird er ROT — und dann muss neu entschieden werden, was hier und was in der Sonde geprueft wird.
// Er ist NICHT der CSS-Beleg und gibt sich auch nicht dafuer aus.
//
// NICHT FESTGELEGT wird irgendein Sollverhalten. JOB 547 D4 wurde ROT, weil die Rueckgabe selbst
// einen Konfliktvertrag und eine `AnswerGrade`-Semantik bestimmte — Ownersache. Diese Datei
// deckt nur ab, was IST; offene Fragen stehen als solche in der Rueckgabe.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  konflikte: [] as unknown[],
  // Die Rolle reist mit, weil der Ausweg der Warnkarte rollenabhaengig gerendert wird
  // (`RoleLink` nach `/konflikte`, Ask.tsx:961-969). Beide Zweige werden unten gemessen.
  rolle: "experte" as string,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: bestand.rolle }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => bestand.konflikte) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: "Die Querstromventilhaube wird vor jeder Wartung entlastet.",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          // Die TRAGENDE Quelle — nur ueber sie kann ein Konflikt die Antwort begrenzen.
          citedSources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r",
      })),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/**
 * Der Telefon-Viewport, den die CSS-faehige Sonde setzt — hier nur als BEZUG, nicht als Wirkung.
 *
 * Er steht in dieser Datei, damit beide Belege dieselbe Zahl nennen und niemand sie auseinander
 * laufen laesst. Gesetzt wird er NICHT: jsdom leitet daraus kein Layout ab, und ein Wert, der
 * nichts bewirkt, gehoert nicht in den Aufbau (das war der D1-Fehler).
 */
const TELEFON_VIEWPORT = { breite: 390, hoehe: 844 } as const;

function ko() {
  return {
    id: "k1",
    title: "Wartung Querstromventilhaube",
    statement: "Die Querstromventilhaube wird vor jeder Wartung entlastet.",
    type: "best_practice",
    category: "Anlage 1",
    status: "validiert",
    trust: 90,
    version: 1,
    confidence: 0.9,
    tags: [],
    sources: [],
    attachments: [],
    author: "u1",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

/** Ein OFFENER Wahrheitskonflikt, der die tragende Quelle referenziert. */
function konflikt(over: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    koA: "k1",
    koB: "k2",
    type: "truth",
    description: "Widerspruch zur Entlastungsreihenfolge",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    ...over,
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountMobil(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          // `?ask=1` beantwortet die vorbefuellte Frage EINMAL automatisch (Ask.tsx:299-318) —
          // so entsteht ohne Tastatureingabe eine echte Antwort mit tragender Quelle.
          { initialEntries: ["/fragen?ask=1&q=Querstromventilhaube%20Wartung%20entlasten"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  // ============================================================================================
  // JOB 3064 H5 NACHGEFÜHRT, nicht gelockert.
  // ============================================================================================
  // Die Einordnung einer Antwort — und damit der Konflikt-Vorbehalt — steht seit dem Umbau nach
  // `design/klarwerk/Fragen.dc.html` hinter „…" → „Mehr" an der Antwortkarte (Auftrag §5). W5
  // fragt „ist der Konfliktzustand MOBIL sichtbar?", und die Antwort bleibt ja: über einen Griff,
  // der auf dem Telefon genauso zu bedienen ist wie am Schreibtisch. Die Zusagen unten sind
  // unverändert — Karte da, Text lesbar (kein Maus-Tooltip), Ausweg rollenrichtig, nichts durch
  // einen Breakpoint versteckt. Geöffnet wird über das ECHTE Menü, nicht über den Zustand.
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
    await flush();
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function seite(
  mitKonflikt: boolean,
): Promise<{ container: HTMLElement; unmount: () => void }> {
  await i18n.changeLanguage("de");
  bestand.rolle = "experte";
  bestand.kos = [ko()];
  bestand.konflikte = mitKonflikt ? [konflikt()] : [];
  return mountMobil();
}

// Beide Sonden lesen ab JOB 3064 an `document`/`document.body` statt am Mount-Knoten: das
// Info-Blatt wird nach `document.body` portaliert, damit seine Geometrie nicht davon abhängt, an
// welcher Stelle im Baum es gerufen wird (s. `Seitenblatt.tsx`). Der Mount-Knoten hängt selbst an
// `document.body`, `document.body` ist also die Obermenge — es geht nichts aus der Messung
// verloren, es kommt nur das Blatt hinzu.
function text(_container: HTMLElement): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

/** Die Warnkarte ueber ihren echten i18n-Text gefunden, nicht ueber eine testeigene Marke. */
function warnkarte(_container: HTMLElement): HTMLElement | null {
  const titel = i18n.t("conflict.impact.title");
  const treffer = [...document.querySelectorAll("p")].find(
    (p) => (p.textContent ?? "").trim() === titel,
  );
  return treffer?.parentElement ?? null;
}

let offen: { unmount: () => void } | null = null;

afterEach(() => {
  offen?.unmount();
  offen = null;
  bestand.rolle = "experte";
  vi.clearAllMocks();
});

describe("JOB1157 W5 · der Konfliktzustand ist mobil sichtbar", () => {
  it("die Warnkarte erscheint, sobald eine tragende Quelle im offenen Konflikt steht", async () => {
    const s = await seite(true);
    offen = s;

    const karte = warnkarte(s.container);
    expect(
      karte,
      "Die Antwort steht auf einer konfliktbehafteten Quelle — mobil erscheint dazu nichts",
    ).not.toBeNull();
  });

  it("ihr Text steht LESBAR im Dokument, nicht nur in einem Maus-Tooltip", async () => {
    const s = await seite(true);
    offen = s;

    // `textContent` sieht bewusst keine `title`-Attribute. Genau darin liegt der Unterschied
    // zwischen „erklaert" und „erklaert nur der Maus" — auf einem Telefon gibt es kein Hovern.
    const gelesen = text(s.container);
    expect(gelesen).toContain(i18n.t("conflict.impact.title"));
    expect(gelesen).toContain(i18n.t("conflict.impact.hint"));
    expect(gelesen).toContain(i18n.t("conflict.impact.cta"));
  });

  it("fuer eine Rolle MIT Zugang ist der Ausweg ein echter Anker auf die Konfliktliste", async () => {
    await i18n.changeLanguage("de");
    bestand.rolle = "controller";
    bestand.kos = [ko()];
    bestand.konflikte = [konflikt()];
    const s = await mountMobil();
    offen = s;

    const karte = warnkarte(s.container) as HTMLElement;
    const anker = [...karte.querySelectorAll("a")].find((a) =>
      (a.textContent ?? "").includes(i18n.t("conflict.impact.cta")),
    );
    expect(
      anker,
      "Der Hinweis nennt einen Ausweg, bietet aber kein anklickbares Ziel",
    ).toBeInstanceOf(HTMLAnchorElement);
    expect((anker as HTMLAnchorElement).getAttribute("href")).toBe("/konflikte");
  });

  it("fuer eine Rolle OHNE Zugang bleibt der Ausweg lesbarer Text statt eines toten Links", async () => {
    // GEMESSENES IST-VERHALTEN, keine Bewertung: `/konflikte` verlangt `controller`, und
    // `RoleLink` gibt fuer andere Rollen bewusst keinen Anker aus (Ask.tsx:961-963). Der
    // Hinweistext bleibt trotzdem stehen — er ist die eigentliche Auskunft.
    const s = await seite(true); // Rolle „experte"
    offen = s;

    const karte = warnkarte(s.container) as HTMLElement;
    expect(karte).not.toBeNull();
    expect(text(s.container)).toContain(i18n.t("conflict.impact.cta"));
    expect(
      [...karte.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/konflikte"),
      "Ohne Rollenzugang darf kein begehbarer Link entstehen",
    ).toBe(false);
  });

  it("die Karte steht im normalen Fluss — keine Klasse blendet sie schmal aus", async () => {
    const s = await seite(true);
    offen = s;

    // Das ist die pruefbare Ursache hinter „mobil nicht abgeschnitten": Kein Vorfahre der Karte
    // versteckt sie unterhalb eines Breakpoints. Pixel misst dieser Fall NICHT (siehe Kopf).
    let el: HTMLElement | null = warnkarte(s.container);
    const versteckt = /(^|\s)(hidden|sr-only)(\s|$)/;
    while (el && el !== s.container) {
      expect(
        versteckt.test(el.className ?? ""),
        `Ein Vorfahre der Warnkarte traegt eine versteckende Klasse: ${el.className}`,
      ).toBe(false);
      el = el.parentElement;
    }
  });

  it("GEGENPROBE: ohne offenen Konflikt erscheint die Karte NICHT", async () => {
    const s = await seite(false);
    offen = s;

    // Ohne diesen Fall koennte die Karte immer stehen — und alle vier Faelle oben waeren gruen,
    // ohne dass der Konflikt irgendetwas bewirkt haette.
    expect(warnkarte(s.container)).toBeNull();
    expect(text(s.container)).not.toContain(i18n.t("conflict.impact.title"));
  });

  it("KEIN BREITENZWEIG: der gepruefte Renderpfad liest ueberhaupt kein Breitensignal", () => {
    // DIE VORAUSSETZUNG DER ABGABE, nicht der CSS-Beleg. Diese Datei darf nur deshalb
    // breitenunabhaengig zusichern, WEIL das Produkt keine Breite unterscheidet. Genau das wird
    // hier gemessen — an der Quelle, nicht an einer Annahme.
    //
    // Entsteht eines Tages ein mobiler Renderzweig in `Ask.tsx`, wird dieser Fall ROT. Dann ist
    // neu zu entscheiden, was hier und was in der CSS-faehigen Sonde bei
    // ${TELEFON_VIEWPORT.breite}x${TELEFON_VIEWPORT.hoehe} geprueft wird — statt dass die
    // Abgabe still falsch wird.
    const quelle = readFileSync(resolve(__dirname, "../../apps/web/src/pages/Ask.tsx"), "utf8");
    for (const signal of ["matchMedia", "useMediaQuery", "innerWidth"]) {
      expect(
        quelle.includes(signal),
        `Ask.tsx liest jetzt „${signal}". Damit unterscheidet der Renderpfad Breiten, und die breitenunabhaengige Zusicherung dieser Datei traegt nicht mehr. Der Telefonfall gehoert dann in die CSS-faehige Sonde (${TELEFON_VIEWPORT.breite}x${TELEFON_VIEWPORT.hoehe}).`,
      ).toBe(false);
    }

    // KALIBRIERUNG: ohne sie waere die Schleife auch dann gruen, wenn die Datei leer gelesen
    // wuerde — der Fall pruefte dann nichts.
    expect(quelle.length, "Ask.tsx wurde nicht wirklich gelesen").toBeGreaterThan(10_000);
    expect(quelle, "der gemessene Renderpfad muss die Warnkarte ueberhaupt enthalten").toContain(
      "conflict.impact.title",
    );
  });

  it("ABGRENZUNG: ein GELOESTER Konflikt an derselben Quelle begrenzt die Antwort nicht", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko()];
    bestand.konflikte = [konflikt({ status: "geloest" })];
    const s = await mountMobil();
    offen = s;

    expect(
      warnkarte(s.container),
      "Ein geloester Konflikt darf die Antwort nicht mehr als begrenzt zeigen",
    ).toBeNull();
  });
});
