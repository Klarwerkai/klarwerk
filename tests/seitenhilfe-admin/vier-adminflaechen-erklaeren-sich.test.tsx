// @vitest-environment jsdom
// ================================================================================================
// JOB 3670 — DIE VIER VERWALTUNGSFLÄCHEN ERKLÄREN SICH IM ZAHNRAD.
// ================================================================================================
//
// Wer einen Demo-Zugang herrichtet, arbeitet zuerst im Admin: Konten anlegen, Daten einstellen,
// Sicherheit prüfen. Im Zahnrad stand unter „Seitenhilfe" auf `Admin.tsx`, `AdminKontenDetails.tsx`,
// `AdminDatenDetails.tsx` und `AdminSicherheitDetails.tsx` bis hierher die Leermeldung — die
// Mechanik von JOB 3060 war fertig, sie war auf diesen Flächen nur nie benutzt worden.
//
// GEMESSEN WIRD AM SICHTBAREN ENDE, nicht am Kontext: jeder der zwölf Bildschirme wird in der
// ECHTEN Hülle (`AppShell` mit `SeitenhilfeProvider` und Zahnrad) über die ECHTE Seite `Admin`
// montiert — also über dieselbe Adresse (`/admin?bereich=…&detail=…`), die auch ein Mensch
// aufruft. Ein `HelpTip` außerhalb des Anbieters meldete sich beim stummen Sammler
// (`shell/SeitenhilfeContext.tsx:37`); ein Fall gegen den Kontext allein wäre falsches Grün.
//
// OHNE GELADENE DATEN. Die gemockte Schnittstelle antwortet nie; alle Abfragen bleiben in „lädt".
// Das ist Absicht: die Seitenhilfe beschreibt den BILDSCHIRM, nicht seinen Inhalt, und muss
// deshalb auch dann dastehen, wenn noch keine Zahl da ist.
//
// SIEBEN FALLGRUPPEN. S1 der Eintrag steht in der Liste (und die Leermeldung nicht) · S2 dasselbe
// in DE, EN und NL, gemessen gegen die EIGENE Ressource der Sprache statt gegen `t()` mit seinem
// deutschen Rückfall (Korrekturpflicht des Prüfers an JOB 3742 R1, LEHREN 12.09. 09:51) · S2b der
// Sprachwechsel an der schon montierten Fläche · S3 derselbe Text steht NICHT im Sichtfeld · S4 der
// Bildschirmwechsel nimmt den Eintrag mit — und zwar zum richtigen Nachbarn · S5 die ROLLE: keine
// dieser Zusagen erreicht je jemanden, der sie nicht einlösen darf · S6 die BREITE: die
// Themenleiste, über die die Übersichtshilfe spricht, verschwindet schmal nicht.
//
// S5 UND S6 SIND DIE ZWEI FALLEN, an denen JOB 3669 (BEN_ROT 10:18) und JOB 3741 (BEN_ROT 10:21)
// am selben Vormittag mit vollständig grünen Testläufen gescheitert sind. Sie messen nicht die
// Mechanik, sondern die WAHRHEIT der Zusage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Endpunktfunktion gibt ein Versprechen, das NIE erfüllt wird: die Flächen montieren ohne
// Daten. `new Proxy` über einer Funktion, damit auch tief verschachtelte Namensketten
// (`endpoints.admin.demoPackages.list`) auflösen, ohne dass sie hier aufgezählt werden.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(() => new Promise(() => {})),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useNavigate } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, ROLES, type Role, roleAllows } from "../../apps/web/src/app/navigation";
import { isAdminDetailId } from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// Die Flächen messen ihre Fläche (ResizeObserver) und fragen die Fensterbreite (matchMedia) —
// jsdom kennt beides nicht. Beide Attrappen sind ruhig: sie melden nie.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
(globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
  ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

/**
 * Ein BILDSCHIRM der Verwaltung: seine Adresse und die beiden Schlüssel seiner Seitenhilfe.
 *
 * Es sind zwölf, nicht vier: die vier Dateien tragen zusammen zwölf Bildschirme, und man steht
 * immer auf genau einem von ihnen. Ein gemeinsamer Text je Datei stünde auf allen ihren Karten
 * gleich und erklärte keine — dieselbe Überlegung, aus der JOB 3742 die vier Stufe-2-Flächen
 * einzeln versorgt hat (`pages/Stufe2.tsx` in einer Datei, vier eigene Texte).
 *
 * `datei` ist keine Zierde, sondern die Zählung aus Auftrag §6(f): keine der vier Zieldateien darf
 * ohne Fall bleiben. Fall S0 zählt sie nach.
 */
interface Bildschirm {
  key: string;
  /** Der Query-Anteil hinter `/admin` — leer für die Übersicht. */
  query: string;
  datei: string;
  titelKey: string;
  textKey: string;
}

const BILDSCHIRME: readonly Bildschirm[] = [
  {
    key: "uebersicht",
    query: "",
    datei: "apps/web/src/pages/Admin.tsx",
    titelKey: "seitenhilfe.admin.uebersicht.titel",
    textKey: "seitenhilfe.admin.uebersicht.text",
  },
  // ---- AdminKontenDetails.tsx ---------------------------------------------------------------
  {
    key: "nutzer",
    // Eine formgültige Kennung; ob es das Konto WIRKLICH gibt, entscheidet die Karte am Bestand
    // (`navigationGliederung.ts:134-136`). Ohne Bestand steht der „nicht mehr vorhanden"-Zweig —
    // und genau dort muss die Hilfe ebenfalls stehen, sonst fehlt sie im Zweifelsfall.
    query: "?bereich=konten&detail=nutzer:u1",
    datei: "apps/web/src/pages/AdminKontenDetails.tsx",
    titelKey: "seitenhilfe.admin.nutzer.titel",
    textKey: "seitenhilfe.admin.nutzer.text",
  },
  {
    key: "nutzerNeu",
    query: "?bereich=konten&detail=nutzerNeu",
    datei: "apps/web/src/pages/AdminKontenDetails.tsx",
    titelKey: "seitenhilfe.admin.nutzerNeu.titel",
    textKey: "seitenhilfe.admin.nutzerNeu.text",
  },
  {
    key: "ansichtRolle",
    query: "?bereich=konten&detail=ansichtRolle",
    datei: "apps/web/src/pages/AdminKontenDetails.tsx",
    titelKey: "seitenhilfe.admin.ansichtRolle.titel",
    textKey: "seitenhilfe.admin.ansichtRolle.text",
  },
  {
    key: "rolle",
    query: "?bereich=konten&detail=rolle:controller",
    datei: "apps/web/src/pages/AdminKontenDetails.tsx",
    titelKey: "seitenhilfe.admin.rolle.titel",
    textKey: "seitenhilfe.admin.rolle.text",
  },
  // ---- AdminDatenDetails.tsx ------------------------------------------------------------------
  {
    key: "demo",
    query: "?bereich=vorfuehrdaten&detail=demo",
    datei: "apps/web/src/pages/AdminDatenDetails.tsx",
    titelKey: "seitenhilfe.admin.demo.titel",
    textKey: "seitenhilfe.admin.demo.text",
  },
  {
    key: "werk",
    query: "?bereich=system&detail=werk",
    datei: "apps/web/src/pages/AdminDatenDetails.tsx",
    titelKey: "seitenhilfe.admin.werk.titel",
    textKey: "seitenhilfe.admin.werk.text",
  },
  {
    key: "papierkorb",
    query: "?bereich=quellen&detail=papierkorb",
    datei: "apps/web/src/pages/AdminDatenDetails.tsx",
    titelKey: "seitenhilfe.admin.papierkorb.titel",
    textKey: "seitenhilfe.admin.papierkorb.text",
  },
  {
    key: "audit",
    query: "?bereich=sicherheit&detail=audit",
    datei: "apps/web/src/pages/AdminDatenDetails.tsx",
    titelKey: "seitenhilfe.admin.audit.titel",
    textKey: "seitenhilfe.admin.audit.text",
  },
  // ---- AdminSicherheitDetails.tsx --------------------------------------------------------------
  {
    key: "protokoll",
    query: "?bereich=sicherheit&detail=protokoll",
    datei: "apps/web/src/pages/AdminSicherheitDetails.tsx",
    titelKey: "seitenhilfe.admin.protokoll.titel",
    textKey: "seitenhilfe.admin.protokoll.text",
  },
  {
    key: "datenschutz",
    query: "?bereich=sicherheit&detail=datenschutz",
    datei: "apps/web/src/pages/AdminSicherheitDetails.tsx",
    titelKey: "seitenhilfe.admin.datenschutz.titel",
    textKey: "seitenhilfe.admin.datenschutz.text",
  },
  {
    key: "bereitschaft",
    query: "?bereich=system&detail=bereitschaft",
    datei: "apps/web/src/pages/AdminSicherheitDetails.tsx",
    titelKey: "seitenhilfe.admin.bereitschaft.titel",
    textKey: "seitenhilfe.admin.bereitschaft.text",
  },
];

/** Die vier Zieldateien des Auftrags — jede muss mindestens einen Bildschirm beisteuern. */
const ZIELDATEIEN: readonly string[] = [
  "apps/web/src/pages/Admin.tsx",
  "apps/web/src/pages/AdminKontenDetails.tsx",
  "apps/web/src/pages/AdminDatenDetails.tsx",
  "apps/web/src/pages/AdminSicherheitDetails.tsx",
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Der Griff an den Router DIESER Montage — für S4.
 *
 * S4 muss den Bildschirm wechseln, OHNE die Hülle neu aufzubauen: gemessen wird ja gerade, dass der
 * Sammler (`SeitenhilfeProvider`, in `AppShell`) den alten Eintrag loswird. Ein zweites `render()`
 * mit anderen `initialEntries` täte das nicht — React gleicht den `MemoryRouter` nach Typ ab, und
 * `initialEntries` wirkt nur bei seiner ERSTEN Montage; die Adresse bliebe stehen. Ein neuer `key`
 * wiederum baute Router UND Sammler neu auf, und der Fall wäre trivial grün.
 *
 * Deshalb navigiert S4 wie ein Mensch: durch den Router, über `useNavigate`. Dieses stumme Bauteil
 * hängt im Router und legt die Funktion hier ab.
 */
let navigiere: ((url: string) => void) | null = null;

function Routergriff(): null {
  const navigate = useNavigate();
  navigiere = (url) => navigate(url);
  return null;
}

function huelle(url: string, kind: ReactElement): ReactElement {
  return createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
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
              { initialEntries: [url] },
              createElement(Routergriff),
              kind,
            ),
          ),
        ),
      ),
    ),
  );
}

async function mount(url: string, kind: ReactElement): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  await act(async () => {
    r.render(huelle(url, kind));
    await flush();
  });
  await act(flush);
  await act(flush);
}

/** Die ECHTE Seite in der ECHTEN Hülle, unter der Adresse dieses Bildschirms. */
async function montiere(b: Bildschirm): Promise<void> {
  await mount(`/admin${b.query}`, createElement(AppShell, null, createElement(Admin)));
}

async function click(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Zahnrad auf, „Seitenhilfe" aufklappen — der Weg, den ein Mensch geht. */
async function seitenhilfeOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'), "Zahnrad");
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'), "Seitenhilfe");
}

const gestrafft = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** Der gezeichnete Text der Seitenhilfe-Liste (nicht des ganzen Menüs). */
function listentext(): string {
  return gestrafft(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent);
}

/** Der gezeichnete Seiteninhalt — `<main>` ohne das Zahnrad-Menü, das im Kopfband hängt. */
function sichtfeldtext(): string {
  return gestrafft(container.querySelector("main")?.textContent);
}

/**
 * Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de".
 *
 * `i18n.ts` setzt `fallbackLng: "de"`. Fehlte ein NL-Schlüssel, lieferten Erwartung UND Oberfläche
 * denselben deutschen Satz, und der Fall bliebe grün. Genau diese Lücke hat der Prüfer an JOB 3742
 * Runde 1 gefunden; sie wird hier von Anfang an vermieden.
 */
function sprachressource(sprache: string, key: string): unknown {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  return bundle?.[key];
}

afterEach(() => {
  // S0 und ein Teil von S5 montieren nichts — sie lesen die Quelle. Der Abbau läuft deshalb nur,
  // wenn es etwas abzubauen gibt; ein blindes `root.unmount()` wäre dort ein Fehler des PRÜFSTANDS
  // und hätte fünf Fälle rot gefärbt, die ihre Sache korrekt gemessen haben.
  if (root) {
    const r = root;
    act(() => r.unmount());
    container.remove();
    root = null;
  }
  navigiere = null;
  vi.clearAllMocks();
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

// ------------------------------------------------------------------------------------------------
// S0 — DIE ZÄHLUNG: keine der vier Zieldateien bleibt ohne Fall, und jede Adresse ist gültig.
// ------------------------------------------------------------------------------------------------
// Auftrag §6(f): „eine Datei mit null Fällen färbt das Tor rot, ohne dass ein Fall rot ist." Dieser
// Fall ist der Wächter dagegen. Er prüft zugleich, dass jede hier benutzte Detailkennung durch die
// Weiche `isAdminDetailId` kommt — eine Adresse, die sie nicht passiert, führte auf die Übersicht,
// und alle Fälle dieses Bildschirms hätten dann still die Übersicht gemessen.
describe("JOB 3670 · S0 · die Zählung je Zieldatei und die Gültigkeit der Adressen", () => {
  it("jede der vier Zieldateien trägt mindestens einen Bildschirm", () => {
    for (const datei of ZIELDATEIEN) {
      const treffer = BILDSCHIRME.filter((b) => b.datei === datei);
      expect(
        treffer.length,
        `${datei}: kein einziger Bildschirm — die Datei bliebe ohne Fall`,
      ).toBeGreaterThan(0);
    }
    // Und umgekehrt: kein Bildschirm zeigt auf eine Datei, die gar nicht im Auftrag steht.
    for (const b of BILDSCHIRME) {
      expect(ZIELDATEIEN, `${b.key}: Datei ${b.datei} steht nicht in den Zielpfaden`).toContain(
        b.datei,
      );
    }
  });

  it("jede Detailkennung kommt durch die Weiche des Routers", () => {
    for (const b of BILDSCHIRME) {
      if (b.query === "") {
        continue;
      }
      const detail = new URLSearchParams(b.query.slice(1)).get("detail") ?? "";
      expect(
        isAdminDetailId(detail),
        `${b.key}: „${detail}" kommt nicht durch \`isAdminDetailId\` — die Adresse landete auf der Übersicht, und jeder Fall dieses Bildschirms hätte still etwas anderes gemessen`,
      ).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S1 — DER HAUPTFALL: jeder der zwölf Bildschirme erklärt sich unter „Seitenhilfe".
// ------------------------------------------------------------------------------------------------
describe("JOB 3670 · S1 · jeder Bildschirm erklärt sich unter „Seitenhilfe“", () => {
  for (const b of BILDSCHIRME) {
    it(`${b.key} · Titel und Text stehen in der Liste, die Leermeldung nicht`, async () => {
      const titel = i18n.t(b.titelKey);
      const text = i18n.t(b.textKey);
      expect(titel, `${b.key}: ${b.titelKey} löst nicht auf`).not.toBe(b.titelKey);
      expect(text, `${b.key}: ${b.textKey} löst nicht auf`).not.toBe(b.textKey);

      await montiere(b);
      await seitenhilfeOeffnen();

      const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
      expect(liste, `${b.key}: es gibt gar keine Seitenhilfe-Liste`).not.toBeNull();
      const inhalt = listentext();
      expect(inhalt, `${b.key}: der Titel der Seitenhilfe fehlt in der Liste`).toContain(titel);
      expect(inhalt, `${b.key}: der Text der Seitenhilfe fehlt in der Liste`).toContain(text);
      // Die Leermeldung ist der heutige Zustand — sie darf danach nirgends im Menü mehr stehen.
      const menue = gestrafft(
        container.querySelector('[data-testid="zahnrad-menue"]')?.textContent,
      );
      expect(menue, `${b.key}: die Leermeldung steht immer noch da`).not.toContain(
        i18n.t("menue.seitenhilfe.leer"),
      );
    });
  }

  it("die zwölf Texte beantworten drei Fragen — und keiner ist die Kopie eines anderen", () => {
    const gesehen = new Map<string, string>();
    for (const b of BILDSCHIRME) {
      const text = i18n.t(b.textKey);
      // Drei Fragen (Auftrag §4.1) brauchen mehr als einen Halbsatz. Die Schranke ist bewusst
      // grob: sie fängt den Platzhalter, nicht den Stil.
      expect(
        text.length,
        `${b.key}: der Text ist zu kurz, um „was stelle ich ein / was bewirkt es / was ist der nächste Schritt" zu beantworten`,
      ).toBeGreaterThan(200);
      const zwilling = gesehen.get(text);
      expect(
        zwilling,
        `${b.key}: wörtlich derselbe Text wie „${zwilling}" — ein Text, der auf zwei Bildschirmen gleich steht, erklärt keinen von beiden`,
      ).toBeUndefined();
      gesehen.set(text, b.key);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S2 — DREI SPRACHEN: jede Sprache hat einen EIGENEN Text, nicht den deutschen aus dem Rückfall.
// ------------------------------------------------------------------------------------------------
describe("JOB 3670 · S2 · die Seitenhilfe spricht Deutsch, Englisch und Niederländisch", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    for (const b of BILDSCHIRME) {
      it(`${b.key} · ${sprache}: der Text DIESER Sprache steht in der Liste`, async () => {
        // 1. Die Sprache hat einen eigenen Eintrag — direkt aus ihrer Ressource gelesen.
        const roherTitel = sprachressource(sprache, b.titelKey);
        const roherText = sprachressource(sprache, b.textKey);
        expect(
          typeof roherTitel === "string" && roherTitel.trim().length > 0,
          `${b.key}/${sprache}: ${b.titelKey} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherTitel)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);
        expect(
          typeof roherText === "string" && roherText.trim().length > 0,
          `${b.key}/${sprache}: ${b.textKey} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherText)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);
        const titel = roherTitel as string;
        const text = roherText as string;

        // 2. Es ist wirklich übersetzt und nicht der deutsche Satz zweimal abgelegt.
        const deTitel = sprachressource("de", b.titelKey) as string;
        const deText = sprachressource("de", b.textKey) as string;
        if (sprache !== "de") {
          expect(titel, `${b.key}/${sprache}: der Titel ist wörtlich der deutsche`).not.toBe(
            deTitel,
          );
          expect(text, `${b.key}/${sprache}: der Text ist wörtlich der deutsche`).not.toBe(deText);
        }

        // 3. Genau dieser Satz steht auch in der gezeichneten Liste.
        await i18n.changeLanguage(sprache);
        await montiere(b);
        await seitenhilfeOeffnen();
        const inhalt = listentext();
        expect(inhalt, `${b.key}/${sprache}: der Titel fehlt in der Liste`).toContain(titel);
        expect(inhalt, `${b.key}/${sprache}: der Text fehlt in der Liste`).toContain(text);
        // 4. Und der deutsche Satz steht dort NICHT — das ist der Rückfall, sichtbar gemacht.
        if (sprache !== "de") {
          expect(
            inhalt,
            `${b.key}/${sprache}: in der Liste steht der DEUTSCHE Text — die Fläche ist auf den Rückfall „de" gefallen`,
          ).not.toContain(deText);
        }
      });
    }
  }
});

// ------------------------------------------------------------------------------------------------
// S2b — SPRACHWECHSEL AN DER BEREITS MONTIERTEN FLÄCHE, bei offenem Menü.
// ------------------------------------------------------------------------------------------------
// S2 schaltet vor der Montage um. Ein Mensch schaltet aber im Kopfband um, während er auf der
// Fläche steht — der Eintrag ist dann schon angemeldet. Meldete eine Karte ihren Text einmalig an
// (etwa in einem `useEffect` ohne Abhängigkeit auf `t`), bliebe die Liste danach deutsch.
describe("JOB 3670 · S2b · der Sprachwechsel erreicht die schon angemeldete Seitenhilfe", () => {
  for (const b of BILDSCHIRME) {
    it(`${b.key} · de → nl bei offenem Menü`, async () => {
      const deText = sprachressource("de", b.textKey) as string;
      const nlText = sprachressource("nl", b.textKey) as string;
      await montiere(b);
      await seitenhilfeOeffnen();
      expect(listentext(), `${b.key}: der deutsche Text stand nie in der Liste`).toContain(deText);

      await act(async () => {
        await i18n.changeLanguage("nl");
        await flush();
      });
      await act(flush);

      const inhalt = listentext();
      expect(
        inhalt,
        `${b.key}/nl: nach dem Sprachwechsel fehlt der niederländische Text`,
      ).toContain(nlText);
      expect(
        inhalt,
        `${b.key}/nl: nach dem Sprachwechsel steht immer noch der deutsche Text da`,
      ).not.toContain(deText);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S3 — NICHTS IM SICHTFELD.
// ------------------------------------------------------------------------------------------------
// Pedi 04.09., wörtlich im Quelltext (`shell/SeitenhilfeContext.tsx:16-20`): „Text über Text über
// Text." Die naheliegende Fehllieferung dieses Auftrags wäre ein sichtbarer Erklärabsatz auf der
// Karte — und die Verwaltung hat einen eigenen, schärferen Wächter dagegen
// (`tests/design/zielbild-h6-kein-erklaertext.test.ts`), den JOB 3636 schon einmal rot gefahren hat.
//
// GEMESSEN WIRD DER TEXT, NICHT DER TITEL — und das ist keine Abschwächung, sondern die richtige
// Grenze. Der Titel eines Hilfeeintrags ist der NAME des Bildschirms („Papierkorb", „Bereitschaft"),
// und der steht selbstverständlich als Überschrift auf der Karte; genau so führen es auch die
// vorhandenen „?"-Menüs der Verwaltung (`AdminSicherheitDetails.tsx:349`: `titel:
// t("adm.ready.title")` — derselbe Schlüssel wie der Kartentitel). Verboten ist der ERKLÄRSATZ im
// Sichtfeld, und den misst dieser Fall. Die erste Fassung verlangte auch die Abwesenheit des
// Titels; sie fiel an fünf Bildschirmen, weil dort die Überschrift der Karte stand — eine Zusage
// des Prüfstands, die das Produkt zu Recht nicht einhält.
describe("JOB 3670 · S3 · der Hilfetext steht NICHT im gezeichneten Seiteninhalt", () => {
  for (const b of BILDSCHIRME) {
    it(`${b.key} · der Erklärsatz erscheint nicht in <main>`, async () => {
      const text = i18n.t(b.textKey);
      await montiere(b);
      const sichtfeld = sichtfeldtext();
      expect(sichtfeld, `${b.key}: der Hilfetext steht im Sichtfeld`).not.toContain(text);
      // Auch kein Stück davon: ein „gekürzter Erklärabsatz" wäre dieselbe Fehllieferung. Gemessen
      // am ersten Satz, der für sich schon eine Aussage ist.
      const ersterSatz = `${text.split(". ")[0] ?? text}.`;
      expect(
        sichtfeld,
        `${b.key}: der erste Satz des Hilfetextes steht im Sichtfeld`,
      ).not.toContain(ersterSatz);
      // Kalibrierung: das Sichtfeld wurde überhaupt gelesen (eine leere Messung wäre trivial grün).
      expect(
        sichtfeldtext().length,
        `${b.key}: <main> ist leer — S3 hat nichts gemessen`,
      ).toBeGreaterThan(0);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S4 — DER BILDSCHIRMWECHSEL NIMMT DEN EINTRAG MIT, UND ZWAR ZUM RICHTIGEN NACHBARN.
// ------------------------------------------------------------------------------------------------
// Alle zwölf Bildschirme wohnen auf EINER Route. Ohne Abmeldung sammelten sich die Einträge aller
// besuchten Karten in der Liste an, und das Zahnrad zeigte die Hilfe einer Karte, auf der man gar
// nicht mehr steht. Der Fall prüft deshalb beides in einem Zug: der alte Text ist weg, der neue da.
describe("JOB 3670 · S4 · beim Wechsel geht der alte Eintrag, der neue kommt", () => {
  for (const [i, b] of BILDSCHIRME.entries()) {
    const nachbar = BILDSCHIRME[(i + 1) % BILDSCHIRME.length] as Bildschirm;
    it(`${b.key} → ${nachbar.key}`, async () => {
      const alt = i18n.t(b.textKey);
      const neu = i18n.t(nachbar.textKey);
      await montiere(b);
      await seitenhilfeOeffnen();
      expect(listentext(), `${b.key}: der Text stand nie in der Liste`).toContain(alt);

      // DIESELBE Hülle, derselbe Sammler, nur eine andere Adresse — wie ein Klick auf eine andere
      // Zeile. Der Pfad bleibt dabei `/admin`, das Zahnrad-Menü schliesst also NICHT
      // (`shell/ZahnradMenue.tsx` schliesst nur bei Pfadwechsel): die Liste wird wirklich neu
      // gelesen und nicht bloss zugeklappt und wieder aufgemacht.
      const gehe = navigiere;
      expect(gehe, "der Routergriff fehlt — S4 könnte gar nicht navigieren").not.toBeNull();
      await act(async () => {
        gehe?.(`/admin${nachbar.query}`);
        await flush();
      });
      await act(flush);
      if (container.querySelector('[data-testid="seitenhilfe-liste"]') === null) {
        await seitenhilfeOeffnen();
      }

      const inhalt = listentext();
      expect(inhalt, `${nachbar.key}: der Text des neuen Bildschirms fehlt`).toContain(neu);
      expect(
        inhalt,
        `${b.key}: der Eintrag blieb stehen, obwohl die Karte weg ist — die Liste erklärt eine Fläche, auf der niemand steht`,
      ).not.toContain(alt);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S5 — DIE ROLLE: keine dieser Zusagen erreicht je jemanden, der sie nicht einlösen darf.
// ------------------------------------------------------------------------------------------------
// DIE FALLE, AN DER JOB 3669 GESCHEITERT IST (BEN_ROT 12.09. 10:18): sein Bibliothekstext versprach
// einen Erfassungsweg, den `viewer` nicht gehen darf. Hier ist die Antwort strenger und sie liegt
// eine Ebene höher: `/admin` trägt `minRole: "admin"`, und `Guarded` in `routes.tsx` gibt jeder
// anderen Rolle `RoleNotice` STATT der Seite. Es gibt also gar keine Rolle unterhalb von Admin, die
// einen dieser zwölf Texte je zu Gesicht bekommt.
//
// GEMESSEN, NICHT BEHAUPTET: dieser Fall rechnet `roleAllows` für JEDE der vier Rollen am echten
// Navigationseintrag nach. Verschöbe jemand `minRole` auf „controller", fiele er sofort — und dann
// stimmten die Texte über die Verwaltung tatsächlich nicht mehr für jeden, der sie liest.
describe("JOB 3670 · S5 · diese Texte sprechen nur zu Administratoren", () => {
  it("`/admin` bleibt für jede Rolle unterhalb von Admin verschlossen", () => {
    const item = ALL_ITEMS.find((i) => i.path === "/admin");
    expect(item, "der Navigationseintrag `/admin` ist verschwunden").toBeDefined();
    if (!item) {
      return;
    }
    for (const rolle of ROLES) {
      const darf = roleAllows(item, rolle as Role);
      expect(
        darf,
        `${rolle}: darf die Verwaltung ${darf ? "sehen" : "nicht sehen"} — erwartet war „${rolle === "admin" ? "sehen" : "nicht sehen"}". Ändert sich das, muss jede der zwölf Seitenhilfen daraufhin geprüft werden, ob ihre Handlungszusagen für diese Rolle noch stimmen.`,
      ).toBe(rolle === "admin");
    }
  });

  it("die Übersichtshilfe nennt als Grund für einen fehlenden Bereich NICHT die Rolle", () => {
    // JOB 3741 ist genau hieran gescheitert (BEN_ROT 12.09. 10:21): „Fehlen dir Bereiche im Menü,
    // liegt das an deiner Rolle" war falsch — `canSee` (`app/navigation.ts:492-497`) blendet auch
    // bei ausreichender Rolle aus, wenn Stufe 2 aus ist. Der Text muss die ANDERE Ursache nennen.
    for (const sprache of ["de", "en", "nl"] as const) {
      const text = sprachressource(sprache, "seitenhilfe.admin.uebersicht.text") as string;
      const modulAus = sprachressource(sprache, "einst.modul.aus") as string;
      const stufe2 = sprachressource(sprache, "role.stage2") as string;
      expect(
        text,
        `uebersicht/${sprache}: der Text nennt „${modulAus}" nicht — dann erklärt er den Zustand nicht, den die Zeile wirklich zeigt`,
      ).toContain(modulAus);
      // Der Schaltername steht in `role.stage2` mit seinem Zusatz („· Stufe 2"); genannt werden
      // muss der Teil davor, unter dem der Schalter auf der Fläche steht.
      const schalterName = (stufe2.split("·")[0] ?? stufe2).trim();
      expect(
        text,
        `uebersicht/${sprache}: der Text nennt den Schalter „${schalterName}" nicht — dann fehlt die wahre Ursache`,
      ).toContain(schalterName);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S6 — DIE BREITE: die Themenleiste, über die die Übersichtshilfe spricht, verschwindet schmal nicht.
// ------------------------------------------------------------------------------------------------
// DIE FALLE, AN DER JOB 3741 EBENFALLS GESCHEITERT IST: sein Text nannte eine Seitenleiste, die bei
// kleiner Breite gar nicht da ist. Hier ist es umgekehrt — die Themenleiste BLEIBT, sie wandert nur
// nach oben (`components/einstellungen/Seite.tsx:41-44`: bis `sm` eine umbrechende Zeile über die
// volle Breite, ab `sm` die 200-px-Spalte). Deshalb sagt die Hilfe „über dem Inhalt statt links
// daneben" und nicht „links".
//
// WAS DIESER FALL IST UND WAS NICHT: er pinnt die BAUART — dass die Leiste unbedingt gerendert wird
// und ihre schmale Grundform eine Zeile ist. Er ist KEINE Messung an gebautem CSS; die leistet
// `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts` bei 320/390/1280 px.
// Stünde hier eine Breitenzahl, wäre sie erfunden.
describe("JOB 3670 · S6 · die Themenleiste ist auch schmal da — sie steht nur woanders", () => {
  it("die Leiste wird unbedingt gerendert und trägt schmal die Zeilenform", async () => {
    await montiere(BILDSCHIRME[0] as Bildschirm);
    const leiste = container.querySelector('[data-einst="reiterspalte"]');
    expect(
      leiste,
      "die Themenleiste fehlt ganz — dann spricht die Übersichtshilfe über etwas, das es nicht gibt",
    ).not.toBeNull();
    const klassen = leiste?.getAttribute("class") ?? "";
    // Die schmale Grundform (ohne `sm:`-Vorsatz) ist eine umbrechende ZEILE über die volle Breite.
    expect(klassen, `schmale Grundform fehlt (gelesen: „${klassen}")`).toContain("flex-row");
    expect(klassen, `schmale Grundform bricht nicht um (gelesen: „${klassen}")`).toContain(
      "flex-wrap",
    );
    // Und ab `sm` wird daraus die Spalte des Zielbilds — wäre sie unbedingt, stimmte „über dem
    // Inhalt" nicht; wäre sie gar nicht da, stimmte „links daneben" nie.
    expect(klassen, `die Spaltenform ab \`sm\` fehlt (gelesen: „${klassen}")`).toContain(
      "sm:flex-col",
    );
  });

  it("auf einer Detailkarte gibt es die Leiste ebenfalls — der Weg zurück ins Thema bleibt", async () => {
    // Die Übersichtshilfe spricht über die Leiste; die Kartenhilfen verweisen auf Themen
    // („unter System", „unter Vorführdaten"). Wäre die Leiste in der Detailansicht weg, wäre das
    // ein Verweis auf etwas Unsichtbares — dieselbe Klasse von Fehler wie bei JOB 3741.
    const karte = BILDSCHIRME.find((b) => b.key === "werk") as Bildschirm;
    await montiere(karte);
    expect(
      container.querySelector('[data-einst="reiterspalte"]'),
      "auf der Detailkarte fehlt die Themenleiste — die Verweise der Kartenhilfen zeigten ins Leere",
    ).not.toBeNull();
  });
});
