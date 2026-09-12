// @vitest-environment jsdom
// ================================================================================================
// JOB 3669 — DER WÄCHTER: DIE VIER SEITEN DES ERSTEN WEGS ERKLÄREN SICH IM ZAHNRAD-MENÜ.
// ================================================================================================
//
// Pedi (11.09., `SICHTBARES-GESPRAECH.jsonl:695`): „damit wir einen Demo-Account aushändigen können
// und eine Person, die damit noch nie gearbeitet hat, sich relativ schnell einarbeitet … unsere
// Hilfe muss auch sauber ausgearbeitet werden."
//
// Gemessen am Basisstand `ec1d872`: `/start`, `/bibliothek`, `/aufgaben` und `/wissen/:id` meldeten
// KEINEN eigenen Erklärtext an. `/bibliothek` und `/aufgaben` trugen immerhin den Nav-Erklärsatz
// ihres Hilfekapitels; `/start` und `/wissen/:id` zeigten unter „Seitenhilfe" den Leersatz „Zu
// dieser Seite gibt es keine Erklärung."
//
// WAS DIESER WÄCHTER FESTHÄLT — und warum er an der ECHTEN HÜLLE misst und nicht an der Quelle:
// die Zusage ist nicht „im Quelltext steht ein HelpTip", sondern „wer die Seite öffnet und das
// Zahnrad aufklappt, FINDET dort die Erklärung". Gemessen wird deshalb der Weg, den auch der Mensch
// geht: Seite montieren → Zahnrad → „Seitenhilfe" → der Text steht in der Liste. Fällt die
// Anmeldung an einer Seite weg, ist dieser Fall rot (Gegenprobe des Auftrags, §4.4).
//
// UND DIE ANDERE RICHTUNG (§5 des Auftrags): derselbe Text darf NICHT im Sichtfeld stehen. Pedi hat
// die Sprechblase am 04.09. abgelehnt, JOB 3060 hat sie ausgebaut. Der Wächter prüft beides an
// derselben Montage — sonst wäre ein Rückbau in Richtung Popover grün.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RUNDE 2 · die Rolle der angemeldeten Person — als GETTER in die Attrappe gereicht.
 *
 * Ben hat den Wächter von Runde 1 zu Recht als halb gemessen bezeichnet: er kannte nur `admin` und
 * nur die breite Ansicht. Eine Hilfe, die einem Betrachter einen gesperrten Knopf als Weg verkauft,
 * blieb dabei grün. Ab hier stellt jeder Fall die Rolle selbst ein.
 */
const sitzung = vi.hoisted(() => ({ rolle: "admin" as "admin" | "viewer" }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: sitzung.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Datenquelle antwortet leer — die Seitenhilfe ist eine Aussage über die SEITE, nicht über
// ihren Bestand. Genau so sieht ein frisch ausgehändigter Demo-Zugang beim ersten Öffnen auch aus.
//
// DIE ATTRAPPE KENNT DEN VOLLEN PFAD DES AUFRUFS, weil das Produkt drei Antwortformen hat und eine
// pauschale nicht für alle drei passt: die meisten Quellen dieser vier Seiten sind LISTEN (`[]`);
// `learningPaths.byRole` (`endpoints.ts:669`) und `ko.get` liefern EIN Objekt oder nichts;
// `gaps.summary` liefert reine Zähler, aus denen die Startseite `byPriority.hoch` liest
// (`pages/Start.tsx:160`). Eine Liste an diesen drei Stellen wäre ein Fehler der ATTRAPPE — sie
// bräche das Rendern, bevor die Seitenhilfe überhaupt gemessen werden kann.
//
// RUNDE 2: EINE Quelle ist von aussen setzbar — die Konflikte. Der Aufgaben-Text sagt „klick die
// oberste Zeile an, sie führt an die Stelle, an der du sie erledigst". Ob das auch für einen
// Betrachter gilt, ist erst zu sehen, wenn wirklich eine Zeile da ist (`bestand.konflikte`).
const bestand = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORTEN: Record<string, unknown> = {
    "learningPaths.byRole": null,
    "ko.get": null,
    "gaps.summary": { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () =>
        pfad === "conflicts.list" ? bestand.konflikte : pfad in ANTWORTEN ? ANTWORTEN[pfad] : [],
      ),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
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
import { routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Start } from "../../apps/web/src/pages/Start";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// jsdom kennt `scrollTo` nicht; `MyTasks` stellt die gemerkte Listenposition wieder her.
window.scrollTo = () => {};

/**
 * Die vier Seiten des ersten Wegs — ankommen, Bestand ansehen, eigene Aufgaben, ein Objekt lesen.
 *
 * „Meine Entwürfe" (`pages/MeineEntwuerfe.tsx`) gehört zu diesem Weg, steht aber nicht in dieser
 * Tabelle: die Datei lag während dieses Auftrags bei JOB 3668 (Entwurfs-Papierkorb), und die
 * Steuerung hat sie deshalb am 12.09. ausdrücklich herausgenommen. Sie kommt als eigener Auftrag —
 * dann gehört sie HIER hinein, nicht in einen zweiten Wächter.
 */
const SEITEN = [
  { id: "start", pfad: "/start", muster: "/start", seite: Start, schluessel: "seitenhilfe.start" },
  {
    id: "bibliothek",
    pfad: "/bibliothek",
    muster: "/bibliothek",
    seite: Library,
    schluessel: "seitenhilfe.bibliothek",
  },
  {
    id: "aufgaben",
    pfad: "/aufgaben",
    muster: "/aufgaben",
    seite: MyTasks,
    schluessel: "seitenhilfe.aufgaben",
  },
  {
    id: "wissen",
    pfad: "/wissen/ko-1",
    muster: "/wissen/:id",
    seite: KnowledgeDetail,
    schluessel: "seitenhilfe.wissen",
  },
] as const;

const SPRACHEN = ["de", "en", "nl"] as const;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function text(sprache: string, schluessel: string): string {
  const wert = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Kein Text für ${schluessel} in ${sprache}`);
  }
  return wert;
}

// ================================================================================================
// RUNDE 2 · DIE BREITE IST EINE ZAHL, KEIN SCHALTER.
// ================================================================================================
//
// Runde 1 stellte `matchMedia` pauschal auf „alles trifft zu" oder „nichts trifft zu". Damit war
// die schmale Bibliothek nicht messbar: dort entscheiden ZWEI Abfragen gegeneinander — die
// Telefonschwelle `(max-width: 759px)` und das Tablet-Band `(min-width: 760px) and (max-width:
// 899px)` (`components/bibliothek/BibliothekFlaeche.tsx:196`, `shell/useMediaQuery.ts`). „Alles
// trifft zu" macht ein Gerät, das gleichzeitig Telefon und Tablet ist — das gibt es nicht.
//
// Deshalb steht hier eine echte Breite, und die Abfrage wird gegen sie ausgewertet.
const TELEFON = 390;
// Das Lese-Tablet liegt zwischen 760 und 899 px (`shell/useMediaQuery.ts`, `TABLET_LESE_QUERY`) —
// dort trägt der Bericht die Fläche, und die Liste lässt sich daneben holen. Genau diese dritte
// Lage nennt die Bibliothekshilfe; ohne eine Breite in diesem Band wäre der Satz unbelegt.
const TABLET = 768;
const BREIT = 1280;

function trifftZu(abfrage: string, breite: number): boolean {
  const teile = abfrage.split(" and ");
  return teile.every((teil) => {
    const max = /\(max-width:\s*(\d+)px\)/.exec(teil);
    if (max?.[1] !== undefined) {
      return breite <= Number(max[1]);
    }
    const min = /\(min-width:\s*(\d+)px\)/.exec(teil);
    if (min?.[1] !== undefined) {
      return breite >= Number(min[1]);
    }
    // Eine Abfrage, die dieser Prüfstand nicht versteht, wird NICHT stillschweigend zu „trifft zu":
    // sonst behauptete er eine Lage, die er gar nicht eingestellt hat.
    return false;
  });
}

function setBreite(breite: number): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: trifftZu(q, breite),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

async function mount(seite: {
  pfad: string;
  muster: string;
  seite: () => JSX.Element;
}): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [seite.pfad] },
                  createElement(
                    AppShell,
                    null,
                    // Mit echter Route: `/wissen/:id` liest seine Kennung aus den Routenparametern.
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: seite.muster,
                        element: createElement(seite.seite),
                      }),
                    ),
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
  // Zwei Durchläufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/**
 * Der Weg des Menschen: Zahnrad → „Seitenhilfe". Gibt den Text der aufgeklappten Liste zurück.
 *
 * SCHMAL LIEGT DERSELBE EINTRAG IM SCHUBFACH (`shell/AppShell.tsx`, ≤ 899 px): kein Zahnrad im
 * Kopfband, sondern der Hamburger und dahinter dieselben Zeilen. Der Helfer nimmt den Weg, den es
 * gerade gibt — sonst wäre der schmale Fall nicht messbar, obwohl er der wichtigere ist.
 */
async function seitenhilfe(): Promise<string> {
  const zahnrad = container.querySelector('[data-testid="kopfband-zahnrad"]');
  if (zahnrad) {
    await click(zahnrad);
  } else {
    await click(container.querySelector(`[aria-label="${i18n.t("topbar.openMenu")}"]`));
  }
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
  const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
  if (!liste) {
    // Ohne Liste steht dort der Leersatz — genau der Zustand, den dieser Auftrag beseitigt hat.
    const menue = container.querySelector('[data-testid="zahnrad-menue"]')?.textContent ?? "";
    throw new Error(`Keine Seitenhilfe-Liste. Menü sagt: ${menue.replace(/\s+/g, " ").trim()}`);
  }
  return (liste.textContent ?? "").replace(/\s+/g, " ").trim();
}

function normal(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  setBreite(BREIT);
  sitzung.rolle = "admin";
  bestand.konflikte = [];
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("JOB 3669 · der erste Weg erklärt sich selbst — im Zahnrad-Menü, nicht im Sichtfeld", () => {
  for (const seite of SEITEN) {
    it(`${seite.pfad}: das Zahnrad zeigt unter „Seitenhilfe" Titel UND Text der Seite (de)`, async () => {
      await mount(seite);
      const liste = await seitenhilfe();
      expect(liste).toContain(normal(text("de", `${seite.schluessel}.title`)));
      expect(liste).toContain(normal(text("de", `${seite.schluessel}.body`)));
      // Der Leersatz ist damit weg — auf jeder der vier Seiten.
      expect(liste).not.toContain(normal(text("de", "menue.seitenhilfe.leer")));
    });

    it(`${seite.pfad}: derselbe Text auf Englisch — und es ist wirklich der englische`, async () => {
      await i18n.changeLanguage("en");
      await mount(seite);
      const liste = await seitenhilfe();
      expect(liste).toContain(normal(text("en", `${seite.schluessel}.title`)));
      expect(liste).toContain(normal(text("en", `${seite.schluessel}.body`)));
      // Kein deutscher Rückfall: der deutsche Text steht auf der englischen Fläche NICHT.
      expect(liste).not.toContain(normal(text("de", `${seite.schluessel}.body`)));
    });

    it(`${seite.pfad}: der Erklärtext steht NICHT im Sichtfeld (§5: keine Sprechblase, keine Tour)`, async () => {
      await mount(seite);
      const main = container.querySelector("main");
      expect(main).not.toBeNull();
      const sichtbar = normal(main?.textContent ?? "");
      expect(sichtbar).not.toContain(normal(text("de", `${seite.schluessel}.body`)));
      expect(sichtbar).not.toContain(normal(text("de", `${seite.schluessel}.title`)));
    });
  }

  it("jede der vier Seiten hat ihren Text in ALLEN drei Sprachen — und keine Sprache erbt eine andere", () => {
    for (const seite of SEITEN) {
      const koerper = SPRACHEN.map((s) => text(s, `${seite.schluessel}.body`));
      const titel = SPRACHEN.map((s) => text(s, `${seite.schluessel}.title`));
      // Ein abgeschriebener deutscher Text unter „en" wäre eine Übersetzung, die keine ist.
      expect(new Set(koerper).size).toBe(SPRACHEN.length);
      expect(new Set(titel).size).toBe(SPRACHEN.length);
      // Der Text beantwortet die dritte Frage des Auftrags ausdrücklich: „was ist der nächste
      // Schritt". Ohne sie ist es eine Beschreibung, keine Einarbeitung.
      expect(koerper[0]).toContain("Nächster Schritt:");
      expect(koerper[1]).toContain("Next step:");
      expect(koerper[2]).toContain("Volgende stap:");
    }
  });
});

// ================================================================================================
// RUNDE 2 · DIE ZUSAGE UND DIE FLÄCHE WERDEN IM SELBEN LAUF VERGLICHEN.
// ================================================================================================
//
// BENS BEFUND AN RUNDE 1 (Korrekturpflichten 1 und 2): der Wächter verglich Text mit Text. Dass der
// Text stimmt, prüfte niemand — und zweimal stimmte er nicht: als Betrachter ist der „Erfassen"-Weg
// gesperrt, und schmal gibt es das „links die Liste" nicht.
//
// Ab hier stellt jeder Fall Rolle UND Breite ein, liest die Seitenhilfe aus dem echten Menü und
// misst im SELBEN gemounteten Baum, was die Zusage behauptet. Fällt eine der beiden Seiten um —
// der Text oder die Fläche —, ist der Fall rot.
const ROLLENVORBEHALT = { de: "Kein Zugriff", en: "No access", nl: "Geen toegang" } as const;
const RUECKWEG = {
  de: "Zurück zu Bibliothek",
  en: "Back to Library",
  nl: "Terug naar Bibliotheek",
} as const;

describe("JOB 3669 R2 · was die Seitenhilfe zusagt, hält die Seite — je Rolle und je Breite", () => {
  it('B1 · /bibliothek als BETRACHTER: der „Erfassen"-Knopf ist kein Weg — und die Hilfe sagt genau das', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[1]);
    const knopf = container.querySelector('[data-testid="bib-leer-erfassen"]');
    expect(knopf).not.toBeNull();
    // Die FLÄCHE: kein Link, sondern die gesperrte Fassung von `RoleLink` mit ihrem Wort.
    expect(knopf?.tagName).toBe("DIV");
    expect(knopf?.getAttribute("aria-disabled")).toBe("true");
    expect(normal(knopf?.textContent ?? "")).toContain(ROLLENVORBEHALT.de);
    // Die ZUSAGE: sie nennt den Vorbehalt mit demselben Wort, das dort steht.
    const liste = await seitenhilfe();
    expect(liste).toContain(ROLLENVORBEHALT.de);
    expect(normal(text("de", "seitenhilfe.bibliothek.body"))).toContain(ROLLENVORBEHALT.de);
  });

  it("B2 · dieselbe Zusage auf Englisch und Niederländisch trägt denselben Vorbehalt", async () => {
    sitzung.rolle = "viewer";
    await i18n.changeLanguage("en");
    await mount(SEITEN[1]);
    expect(
      normal(container.querySelector('[data-testid="bib-leer-erfassen"]')?.textContent ?? ""),
    ).toContain(ROLLENVORBEHALT.en);
    expect(await seitenhilfe()).toContain(ROLLENVORBEHALT.en);
    // NL wird am Bestand gemessen, nicht an einer zweiten Montage: dieselbe Zusage, dieselbe Regel.
    expect(normal(text("nl", "seitenhilfe.bibliothek.body"))).toContain(ROLLENVORBEHALT.nl);
  });

  it("B3 · GEGENPROBE zur Rolle: als ADMIN ist derselbe Knopf ein echter Weg nach /erfassen", async () => {
    sitzung.rolle = "admin";
    await mount(SEITEN[1]);
    const knopf = container.querySelector('[data-testid="bib-leer-erfassen"]');
    expect(knopf?.tagName).toBe("A");
    expect(knopf?.getAttribute("href")).toBe("/erfassen");
    expect(normal(knopf?.textContent ?? "")).not.toContain(ROLLENVORBEHALT.de);
  });

  it('S1 · /start als BETRACHTER: „Meine Entwürfe" ist kein Weg — die Hilfe hat den Vorbehalt schon', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[0]);
    const verweis = container.querySelector('[data-testid="h5-start-entwuerfe"]');
    expect(verweis).not.toBeNull();
    expect(verweis?.getAttribute("data-role-no-reach")).toBe("true");
    expect(normal(text("de", "seitenhilfe.start.body"))).toContain("nur wenn du erfassen darfst");
    expect(await seitenhilfe()).toContain("nur wenn du erfassen darfst");
  });

  it('A1 · /aufgaben als BETRACHTER mit leerem Bestand: „Nichts offen." und der Knopf stehen wirklich da', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[2]);
    const flaeche = normal(container.querySelector("main")?.textContent ?? "");
    expect(flaeche).toContain(normal(text("de", "task.none")));
    expect(container.querySelector('[data-testid="task-wie-weiter"]')).not.toBeNull();
    // Die Zusage nennt beides wörtlich — sie ist also nachprüfbar und nicht bloss plausibel.
    const zusage = normal(text("de", "seitenhilfe.aufgaben.body"));
    expect(zusage).toContain(normal(text("de", "task.none")));
    expect(zusage).toContain(normal(text("de", "task.weiter")));
  });

  // ------------------------------------------------------------------------------------------------
  // A2 — DER EIGENE BEFUND DIESER RUNDE, gefunden mit Bens Methode an einer Seite, die er nicht nannte.
  // ------------------------------------------------------------------------------------------------
  // Ben prüfte die Bibliothek als Betrachter. Dieselbe Frage an `/aufgaben` gestellt (Rolle einstellen,
  // eine echte Zeile hineingeben, dann die Zusage mit der Fläche vergleichen) ergibt: der Betrachter
  // SIEHT die Konfliktzeile, und ihr Ziel `/konflikte` verlangt „controller" (`app/navigation.ts:228`).
  // Die Zeile ist ein `<Link>`, kein `RoleLink` — sie sagt dem Betrachter also nicht, dass der Weg zu
  // ist. Der Hilfetext von Runde 1 („führt direkt an die Stelle, an der du die Aufgabe erledigst")
  // wäre für ihn dieselbe falsche Zusage wie die Bibliothekshilfe. Deshalb trägt er jetzt den
  // Vorbehalt — die Fläche selbst zu ändern wäre `MyTasks.tsx` UND `navigation.ts`, das ist ein
  // eigener Auftrag und steht in der Rückgabe unter REST.
  it("A2 · /aufgaben MIT einer Zeile als BETRACHTER: das Ziel ist gesperrt — und die Hilfe sagt es", async () => {
    sitzung.rolle = "viewer";
    bestand.konflikte = [
      { id: "c1", description: "Zwei Aussagen widersprechen sich", status: "offen" },
    ];
    await mount(SEITEN[2]);
    const zeile = container.querySelector('[data-testid="task-zeile"] a');
    expect(zeile).not.toBeNull();
    const ziel = zeile?.getAttribute("href") ?? "";
    expect(ziel).toBe("/konflikte");
    // `routePathAllows` ist dieselbe Quelle, aus der der Router sein Tor zieht (`navigation.ts:561`).
    expect(routePathAllows(ziel, "viewer")).toBe(false);
    // Also MUSS die Zusage den Vorbehalt tragen — in der Sprache, in der sie dasteht.
    const liste = await seitenhilfe();
    expect(liste).toContain("sofern diese Fläche für deine Rolle freigegeben ist");
  });

  it("A3 · GEGENPROBE zu A2: für den Admin ist dasselbe Ziel offen — der Vorbehalt ist keine Ausrede", async () => {
    sitzung.rolle = "admin";
    bestand.konflikte = [
      { id: "c1", description: "Zwei Aussagen widersprechen sich", status: "offen" },
    ];
    await mount(SEITEN[2]);
    const ziel =
      container.querySelector('[data-testid="task-zeile"] a')?.getAttribute("href") ?? "";
    expect(ziel).toBe("/konflikte");
    expect(routePathAllows(ziel, "admin")).toBe(true);
    // Und der Erklärsatz je Zeile, den die Hilfe nennt („das i"), steht wirklich an der Zeile.
    expect(container.querySelector('[data-testid="task-erklaerung-knopf"]')).not.toBeNull();
  });

  it(`W1 · /wissen/:id bei ${TELEFON} px: die Liste ist NICHT da, der Rückweg ist da — und die Hilfe sagt es so`, async () => {
    setBreite(TELEFON);
    await mount(SEITEN[3]);
    // Die FLÄCHE: schmal trägt der Eintrag die Seite allein (BibliothekFlaeche.tsx:942).
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    const zurueck = container.querySelector('[data-testid="bib-zurueck"]');
    expect(zurueck).not.toBeNull();
    expect(normal(zurueck?.textContent ?? "")).toContain("Zurück zu");
    // Die ZUSAGE: sie verspricht schmal keine Liste links, sondern nennt diesen Rückweg.
    const zusage = normal(text("de", "seitenhilfe.wissen.body"));
    expect(zusage).toContain(RUECKWEG.de);
    expect(await seitenhilfe()).toContain(RUECKWEG.de);
  });

  it(`W2 · GEGENPROBE zur Breite: bei ${BREIT} px steht die Liste wirklich neben dem Eintrag`, async () => {
    setBreite(BREIT);
    await mount(SEITEN[3]);
    expect(container.querySelector('[data-testid="bib-liste"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).toBeNull();
  });

  it(`L1 · /bibliothek mit gewähltem Eintrag bei ${TELEFON} px: auch hier keine Liste, aber der Rückweg`, async () => {
    setBreite(TELEFON);
    await mount({ pfad: "/bibliothek?eintrag=ko-1", muster: "/bibliothek", seite: Library });
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).not.toBeNull();
    const zusage = normal(text("de", "seitenhilfe.bibliothek.body"));
    expect(zusage).toContain(RUECKWEG.de);
    expect(await seitenhilfe()).toContain(RUECKWEG.de);
  });

  it("L2 · und ohne Wahl trägt schmal die LISTE die Fläche — die dritte Aussage desselben Satzes", async () => {
    setBreite(TELEFON);
    await mount(SEITEN[1]);
    expect(container.querySelector('[data-testid="bib-liste"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).toBeNull();
  });

  // ------------------------------------------------------------------------------------------------
  // T1 — RUNDE 3: DER SCHALTER WIRD GEDRÜCKT, NICHT GEZÄHLT.
  // ------------------------------------------------------------------------------------------------
  // Bens Prüflücke an Runde 2, wörtlich: „Tablet-Fall T1 prüft jedoch nur den geschlossenen Schalter
  // und dessen Beschriftung. Seine Wirkung wird nicht geprüft; deshalb bleibt die falsche Ortsangabe
  // grün." Genau so war es: der Text sagte „daneben", die Liste kommt aber als Schublade ÜBER den
  // Eintrag — und ein Fall, der nur das Vorhandensein des Schalters misst, merkt den Unterschied nie.
  //
  // Ab hier wird beides gedrückt: einblenden (Lage `darueber`, `absolute`, `z-20`) und ausblenden
  // (die Liste geht wieder aus dem Baum). Die GEOMETRIE — dass sich die Rechtecke wirklich
  // überlappen — kann jsdom nicht messen; das tut der Chromium-Fall nebenan
  // (`tablet-schublade-chromium.test.ts`) an der gebauten Seite, mit Eichung bei 1620 px.
  it(`T1 · im Tablet-Band (${TABLET} px): der Schalter legt die Liste ÜBER den Eintrag — und wieder weg`, async () => {
    setBreite(TABLET);
    await mount({ pfad: "/bibliothek?eintrag=ko-1", muster: "/bibliothek", seite: Library });
    const schalter = container.querySelector('[data-testid="bib-liste-schalter"]');
    expect(schalter).not.toBeNull();
    // Zugeklappt als Vorgabe — genau deshalb steht der Satz überhaupt in der Hilfe.
    expect(schalter?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    const einblenden = normal(text("de", "lib.lesemodus.listeEinblenden"));
    const ausblenden = normal(text("de", "lib.lesemodus.listeAusblenden"));
    expect(normal(schalter?.textContent ?? "")).toContain(einblenden);

    // ---- EINBLENDEN: die Wirkung, nicht nur der Knopf -------------------------------------------
    await click(schalter);
    const liste = container.querySelector('[data-testid="bib-liste"]');
    expect(liste).not.toBeNull();
    // `darueber` ist die dritte Lage der Liste (`BibliothekListe.tsx:93`); „daneben" wäre `spalte`.
    expect(liste?.getAttribute("data-lage")).toBe("darueber");
    const klassen = liste?.getAttribute("class") ?? "";
    expect(klassen).toContain("absolute");
    expect(klassen).toContain("z-20");
    // Der Eintrag ist NICHT gewichen — er liegt unter der Schublade, also weiter im Baum.
    expect(container.querySelector('[data-testid="bib-lesen"]')).not.toBeNull();
    // Der Schalter sagt jetzt selbst, dass er offen ist, und nennt den Weg zurück.
    const offen = container.querySelector('[data-testid="bib-liste-schalter"]');
    expect(offen?.getAttribute("aria-expanded")).toBe("true");
    expect(offen?.getAttribute("aria-controls")).toBe("bib-liste");
    expect(normal(offen?.textContent ?? "")).toContain(ausblenden);

    // ---- UND WIEDER WEG: auch das sagt die Hilfe zu ---------------------------------------------
    await click(offen);
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();

    // ---- DIE ZUSAGE nennt beide Beschriftungen UND die richtige Lage ----------------------------
    const zusage = normal(text("de", "seitenhilfe.bibliothek.body"));
    expect(zusage).toContain(einblenden);
    expect(zusage).toContain(ausblenden);
    expect(zusage).toContain("ÜBER den Eintrag");
    expect(zusage).not.toContain("daneben");
    expect(await seitenhilfe()).toContain(einblenden);
  });

  it("T2 · in allen drei Sprachen steht die Lage als ÜBER dem Eintrag, nicht als daneben", () => {
    // Die drei Wörter für dieselbe Tatsache — und in keiner Sprache das Nebeneinander, das es dort
    // nicht gibt. Ohne diesen Fall bliebe eine Sprache beim alten Satz stehen, unbemerkt.
    const lage = { de: "ÜBER den Eintrag", en: "OVER the entry", nl: "OVER het item" } as const;
    const falsch = { de: "daneben", en: "alongside", nl: "ernaast" } as const;
    for (const sprache of SPRACHEN) {
      const zusage = String(
        i18n.getResource(sprache, "translation", "seitenhilfe.bibliothek.body"),
      );
      expect(zusage).toContain(lage[sprache]);
      expect(zusage).not.toContain(falsch[sprache]);
      // Und beide Beschriftungen des Schalters — der Weg hin UND zurück.
      for (const schluessel of ["lib.lesemodus.listeEinblenden", "lib.lesemodus.listeAusblenden"]) {
        expect(zusage).toContain(String(i18n.getResource(sprache, "translation", schluessel)));
      }
    }
  });

  it("Ü1 · der Rückweg heisst in allen drei Sprachen so, wie ihn die Hilfe nennt", () => {
    for (const [sprache, wort] of Object.entries(RUECKWEG)) {
      // `nb.back` ist die Quelle der Knopfbeschriftung; die Hilfe darf ihn nicht anders taufen.
      const knopf = String(i18n.getResource(sprache, "translation", "nb.back"));
      const bibliothek = String(i18n.getResource(sprache, "translation", "nav.library"));
      // Beschriftung ohne Anführungszeichen: „Zurück zu „Bibliothek“" → „Zurück zu Bibliothek".
      const schlicht = knopf.replace("{{title}}", bibliothek).replace(/[„“”"]/g, "");
      expect(schlicht).toBe(wort);
      for (const schluessel of ["seitenhilfe.bibliothek.body", "seitenhilfe.wissen.body"]) {
        expect(String(i18n.getResource(sprache, "translation", schluessel))).toContain(wort);
      }
    }
  });

  it("R1 · der Rollenvorbehalt der Hilfe trägt in allen drei Sprachen das Wort der gesperrten Fassung", () => {
    for (const [sprache, wort] of Object.entries(ROLLENVORBEHALT)) {
      expect(String(i18n.getResource(sprache, "translation", "roleLink.noReach"))).toBe(wort);
      expect(
        String(i18n.getResource(sprache, "translation", "seitenhilfe.bibliothek.body")),
      ).toContain(wort);
    }
  });
});
