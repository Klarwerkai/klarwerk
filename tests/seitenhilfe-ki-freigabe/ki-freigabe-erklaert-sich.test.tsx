// @vitest-environment jsdom
// ================================================================================================
// JOB 3863 — DIE KI-FLÄCHE ERKLÄRT IM ZAHNRAD IHRE FREIGABE.
// ================================================================================================
//
// Seit JOB 3783 (LIVE 1.0.0-beta.1.360) trägt `AdminKiDetails.tsx` die zentrale KI-Freigabe mit
// zwei Schaltern. JOB 3670 hat die Seitenhilfe auf vier Verwaltungsflächen gebracht und genau
// diese Datei ausgelassen, weil dort gebaut wurde — im Zahnrad stand zur Freigabe nichts.
//
// GEMESSEN WIRD AM SICHTBAREN ENDE, nicht am Kontext: die ECHTE Seite `Admin` in der ECHTEN Hülle
// (`AppShell` mit `SeitenhilfeProvider` und Zahnrad), unter der ECHTEN Adresse
// `/admin?bereich=ki&detail=ki`. Ein `HelpTip` ausserhalb des Anbieters meldete sich beim stummen
// Sammler (`shell/SeitenhilfeContext.tsx:37`) — ein Fall gegen den Kontext allein wäre falsches Grün.
//
// VIER GRUPPEN, und nur die erste fragt nach WÖRTERN. Die drei anderen sind der eigentliche Punkt —
// jede Verhaltensaussage der Hilfe hängt an einer Messung, nicht an einem Wortvergleich (Weisung der
// Steuerung für Runde 4: „Jede Verhaltensaussage in der Hilfe muss auf eine Stelle im Produktcode
// oder einen bestehenden Test zeigen"):
//
//   F — DIE HILFE STEHT DA. F1 in der Liste · F2 in DE/EN/NL gegen die EIGENE Sprachressource
//       statt gegen `t()` mit seinem deutschen Rückfall (Korrekturpflicht des Prüfers an JOB 3742
//       R1, LEHREN 12.09. 09:51) · F3 sie benennt die beiden Schalter WÖRTLICH so, wie sie auf der
//       Fläche heissen · F4 sie nennt die Folge ohne Freigabe und die eine benannte Ursache für
//       wirkungslose Schalter · F5 sie steht nicht im Sichtfeld · F6 die Rolle.
//
//   W — DIE HILFE SAGT DIE WAHRHEIT. Jede Zusage der beiden Texte wird an der gemounteten Karte
//       mit geladenen Daten nachgemessen: der Hinweis unter dem zweiten Schalter, die Rückfrage
//       vor dem Einschalten und ihr Fehlen bei der Rücknahme, die Sperre im ENV-Fall, die
//       Standzeile aus dem bestätigten Stand. JOB 3669 (BEN_ROT 12.09. 10:18) und JOB 3741
//       (BEN_ROT 10:21) sind mit vollständig grünen Läufen daran gescheitert, dass ihre Texte
//       etwas versprachen, das die Fläche nicht tut. F allein wäre derselbe Fehler.
//
//   V — DIE FOLGE OHNE FREIGABE, am ECHTEN Kern (`Reasoner.publicStatus()`) und an einer ECHTEN
//       Verbraucherfläche (`AiAssistBox`). Nachgetragen in Runde 2, nachdem BEN den Satz „die
//       KI-Knöpfe bleiben bedienbar" mit einem eigenen Lauf widerlegt hatte (ROT R1, Pflicht 1).
//
//   P — DAS PROTOKOLL UND DIE PERSISTENZ, am ECHTEN Adminweg (`PUT /api/reasoner/config`) mit
//       echtem Protokoll und echtem Policy-Speicher. P1–P3 kamen in Runde 4, nachdem BEN den Satz
//       „eine Rücknahme wird ebenso protokolliert" widerlegt (ROT R3, Pflicht 1) und den
//       Quellen-Pin als Verhaltensbeleg verworfen hatte (Pflicht 2). P4 kam in Runde 5, nachdem BEN
//       auch die Nachfolgefassung „eine Rücknahme wird nie abgewiesen" widerlegt hatte (ROT R4,
//       Pflichten 1 und 3): belegt war nur der AUDIT-Ausfall, und für den Fehler der PERSISTENZ
//       selbst ist „nie" falsch. Viermal derselbe Fehler — eine Zusage, die weiter reicht als ihr
//       Beleg — und viermal dieselbe Abhilfe: die Zusage wird gefahren, nicht gelesen.
//         P1 Erweiterung, Protokoll aus  → 503, nichts erteilt.
//         P2 Rücknahme, Protokoll aus    → 200, wirksam, kein Eintrag.
//         P3 Rücknahme, Protokoll an     → 200, wirksam, Eintrag da (Gegenlage zu P2).
//         P4 Rücknahme, SPEICHER aus     → 400, alter Stand gilt weiter (die Grenze von „wirksam").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

/**
 * Der Halter, aus dem die Attrappe der Schnittstelle liest.
 *
 * `konfig === null` heisst: die Abfrage der KI-Konfiguration wird NIE beantwortet — das ist die
 * Lage der F-Gruppe, denn die Seitenhilfe beschreibt den BILDSCHIRM und muss auch dann dastehen,
 * wenn noch keine Zahl da ist. Die W-Gruppe legt einen Stand hinein und misst die Karte selbst.
 * `puts` sammelt jeden Schreibversuch — daran hängt „fragt vor dem Einschalten nach".
 */
const halter = vi.hoisted(() => ({
  konfig: null as Record<string, unknown> | null,
  puts: [] as Array<Record<string, unknown>>,
  // JOB 3863 RUNDE 2 (BEN-Korrekturpflicht 1): der ÖFFENTLICHE Status, aus dem jede KI-Fläche ihr
  // Ausgrauen ableitet (`useAiAvailable` → `endpoints.reasoner.status`). `null` = die Abfrage wird
  // nie beantwortet, genau wie bisher — die F- und W-Gruppen merken davon nichts. Die V-Gruppe
  // legt hier den ECHTEN `publicStatus()` einer echten `Reasoner`-Verdrahtung hinein.
  status: null as Record<string, unknown> | null,
}));

// Jede nicht eigens versorgte Endpunktfunktion gibt ein Versprechen, das NIE erfüllt wird.
// `new Proxy` über einer Funktion, damit auch tief verschachtelte Namensketten auflösen.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const nie = (): Promise<never> => new Promise(() => {});
  const zweig = (): unknown =>
    new Proxy(vi.fn(nie), {
      get(ziel, name, empf) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empf);
        }
        return zweig();
      },
    });
  const reasoner = new Proxy(vi.fn(nie), {
    get(ziel, name, empf) {
      if (name === "config") {
        return async () => (halter.konfig === null ? nie() : halter.konfig);
      }
      if (name === "status") {
        return async () => (halter.status === null ? nie() : halter.status);
      }
      if (name === "updateConfig") {
        return async (rumpf: Record<string, unknown>) => {
          halter.puts.push(rumpf);
          return halter.konfig === null ? nie() : halter.konfig;
        };
      }
      if (name in ziel || typeof name === "symbol") {
        return Reflect.get(ziel, name, empf);
      }
      return zweig();
    },
  });
  const wurzel = new Proxy(vi.fn(nie), {
    get(ziel, name, empf) {
      if (name === "reasoner") {
        return reasoner;
      }
      if (name in ziel || typeof name === "symbol") {
        return Reflect.get(ziel, name, empf);
      }
      return zweig();
    },
  });
  return { endpoints: wurzel };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, ROLES, type Role, roleAllows } from "../../apps/web/src/app/navigation";
import { isAdminDetailId } from "../../apps/web/src/app/navigationGliederung";
// JOB 3863 RUNDE 2: die ECHTE Verbraucherfläche mit den KI-Knöpfen — an ihr misst die V-Gruppe,
// was die Hilfe über die Web-Folge ohne Freigabe zusagt (`AiAssistBox.tsx:62-64,121`).
import { AiAssistBox } from "../../apps/web/src/components/AiAssistBox";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";
import { KiDetail } from "../../apps/web/src/pages/AdminKiDetails";
import { AppShell } from "../../apps/web/src/shell/AppShell";
// JOB 3863 RUNDE 4 (BEN-Korrekturpflicht 2): die Gruppe P fährt den ECHTEN Adminweg
// (`PUT /api/reasoner/config`) samt echtem Protokoll — ein Quellen-Pin ist kein Verhaltensbeleg.
// Dasselbe Haus, das der Kern in `tests/admin-ki-freigabe/rollen-und-protokoll.test.ts` baut.
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { type AuditRepo, AuditService, InMemoryAuditRepo } from "../../services/audit";
// F6 misst das Schreibrecht an seiner Quelle: der Satz „Schalten darf nur ein Administrator" ist
// eine Aussage über den SERVER (`reasoner-routes.ts:753`, `users.manage`), nicht über die
// Oberfläche. Deshalb wird die Rechtetabelle selbst gelesen und nicht nachgebaut.
import { ROLE_PERMISSIONS } from "../../services/rbac/src/policy";
// JOB 3863 RUNDE 2 (BEN-Korrekturpflicht 1): die V-Gruppe misst die Zusage „ohne Freigabe" nicht an
// einem hingeschriebenen Status, sondern am ECHTEN Kern. `Reasoner` wird wie in der
// Kompositionswurzel verdrahtet, `publicStatus()` daraus gelesen und GENAU DIESE Antwort in die
// montierte Verbraucherfläche gegeben. Kein Feld der Freigabe wird dabei angefasst — „nicht
// gesetzt" IST der Auslieferungszustand (`service.ts:658-664`), und deshalb bleibt diese Datei
// auch weiterhin ausserhalb des Freigabe-Registers (JOB 3550 F1/F2).
import {
  InMemoryReasonerPolicyRepo,
  ModelProvider,
  Reasoner,
  type ReasonerPolicyRepo,
} from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
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

// ------------------------------------------------------------------------------------------------
// DIE ZWEI EINTRÄGE, die dieser Job liefert — und die Adresse, unter der sie stehen.
// ------------------------------------------------------------------------------------------------
/** Die Adresse der KI-Karte mit der Freigabe (`Admin.tsx:370-371`). */
const KI_DETAIL = "ki";
const KI_ADRESSE = `/admin?bereich=ki&detail=${KI_DETAIL}`;

interface Eintrag {
  key: string;
  titelKey: string;
  textKey: string;
}

const EINTRAEGE: readonly Eintrag[] = [
  {
    key: "schalter",
    titelKey: "seitenhilfe.admin.kiFreigabe.titel",
    textKey: "seitenhilfe.admin.kiFreigabe.text",
  },
  {
    key: "ohneFreigabe",
    titelKey: "seitenhilfe.admin.kiOhneFreigabe.titel",
    textKey: "seitenhilfe.admin.kiOhneFreigabe.text",
  },
];

const SPRACHEN = ["de", "en", "nl"] as const;

// ------------------------------------------------------------------------------------------------
// Der Prüfstand.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
            createElement(MemoryRouter, { initialEntries: [url] }, kind),
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

/** Die ECHTE KI-Karte in der ECHTEN Hülle, unter der Adresse, die auch ein Mensch aufruft. */
async function montiereKiKarte(): Promise<void> {
  await mount(KI_ADRESSE, createElement(AppShell, null, createElement(Admin)));
}

/** Nur die Karte, ohne Hülle — für die W-Gruppe, die die Fläche misst und nicht das Zahnrad. */
async function montiereNurKarte(): Promise<void> {
  await mount(KI_ADRESSE, createElement(KiDetail, { onZurueck: () => {} }));
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

function listentext(): string {
  return gestrafft(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent);
}

function sichtfeldtext(): string {
  return gestrafft(container.querySelector("main")?.textContent);
}

/**
 * Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de".
 *
 * `i18n.ts` setzt `fallbackLng: "de"`. Fehlte ein NL-Schlüssel, lieferten Erwartung UND Oberfläche
 * denselben deutschen Satz, und der Fall bliebe grün (LEHREN, JOB 3742 R1).
 */
function sprachressource(sprache: string, key: string): unknown {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  return bundle?.[key];
}

function satz(sprache: string, key: string): string {
  const wert = sprachressource(sprache, key);
  expect(
    typeof wert === "string" && wert.trim().length > 0,
    `${key} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(wert)}) — der deutsche Rückfall zählt hier nicht`,
  ).toBe(true);
  return wert as string;
}

/**
 * Ein vollständiger Serverstand OHNE jede Freigabe — der Auslieferungszustand.
 *
 * Er ist so gebaut, wie die Route ihn liefert (`ReasonerConfigStatus`, `api/types.ts:1835`).
 * `taskConfig` trägt hier bewusst KEIN `kiFreigabe`: „fehlt" ist die eine Darstellung von
 * „gesperrt" (`service.ts:658-664`), und die Karte liest sie so (`AdminKiDetails.tsx:400-408`).
 *
 * JEDER andere Freigabestand dieser Datei entsteht durch BEDIENUNG, nicht durch ein hier
 * hingeschriebenes Feld. Das hat zwei Gründe, und beide sind gut: der Wächter
 * `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:2735` (F2) verbietet jeder Testdatei, die
 * Freigabefelder von Hand zu schreiben — und ein Stand, den die Fläche selbst erzeugt hat, ist der
 * härtere Beleg als einer, den der Prüfstand behauptet.
 */
function konfigOhneFreigabe(
  opts: { policySource?: "env" | "db" | "default" } = {},
): Record<string, unknown> {
  const tasks = [
    "structure",
    "assist",
    "interview",
    "answer",
    "select",
    "extract",
    "describe",
    "group",
  ] as const;
  const je = <T,>(wert: T): Record<string, T> =>
    Object.fromEntries(tasks.map((t) => [t, wert])) as Record<string, T>;
  return {
    provider: "anthropic",
    model: "anthropic:claude-sonnet-4-6",
    configured: true,
    mode: "model",
    fallbackAvailable: true,
    supportsLocales: ["de", "en", "nl"],
    tasks: [...tasks],
    taskConfig: { global: "auto", perTask: {} },
    effective: je("model"),
    cloudConfigured: true,
    localConfigured: false,
    effectiveProvider: je("cloud"),
    persisted: true,
    policySource: opts.policySource ?? "db",
  };
}

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    container.remove();
    root = null;
  }
  halter.konfig = null;
  halter.puts.length = 0;
  halter.status = null;
  vi.clearAllMocks();
});

beforeEach(async () => {
  halter.konfig = null;
  halter.puts.length = 0;
  halter.status = null;
  // Der Schreibweg der FREIGABE geht bewusst nicht über `endpoints`, sondern über den rohen
  // Client (`AdminKiDetails.tsx:642-652`: `api.put("/reasoner/config")`, weil
  // `endpoints.reasoner.updateConfig` das Feld `kiFreigabe` nicht kennt). Gemessen wird deshalb
  // dort, wo dieser Weg endet — an `fetch`. Ein Mock auf `endpoints` sähe den Schreibversuch
  // NICHT und hielte „es wurde nicht geschrieben" für wahr.
  //
  // UND ER ANTWORTET WIE EIN SERVER: der geschriebene Rumpf wird ÜBERNOMMEN und mit der Antwort
  // zurückgegeben (`reasoner-routes.ts:832` liefert den frischen `configStatus`). Ein Prüfstand,
  // der stattdessen den alten Stand zurückgäbe, machte jede Folgemessung wertlos — und ein
  // Prüfstand, der den neuen Stand selbst hinschriebe, prüfte seine eigene Behauptung.
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    eingabe: unknown,
    init: { method?: string; body?: string } = {},
  ) => {
    const url = String(eingabe);
    const methode = (init.method ?? "GET").toUpperCase();
    if (methode === "PUT" && url.includes("/reasoner/config")) {
      const rumpf = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
      halter.puts.push(rumpf);
      const alt = (halter.konfig?.taskConfig ?? {}) as Record<string, unknown>;
      halter.konfig = {
        ...(halter.konfig ?? {}),
        taskConfig: {
          ...alt,
          global: rumpf.global ?? alt.global,
          perTask: rumpf.perTask ?? alt.perTask,
          kiFreigabe: rumpf.kiFreigabe,
        },
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(halter.konfig ?? {}),
    };
  };
  await i18n.changeLanguage("de");
});

// ================================================================================================
// F — DIE HILFE STEHT DA.
// ================================================================================================

describe("JOB 3863 · F0 · die Adresse trifft wirklich die Karte mit der Freigabe", () => {
  it("die Detailkennung kommt durch die Weiche des Routers", () => {
    expect(
      isAdminDetailId(KI_DETAIL),
      `„${KI_DETAIL}" passiert die Weiche nicht — die Adresse führte auf die Übersicht, und jeder Fall dieser Datei hätte still die Übersicht gemessen`,
    ).toBe(true);
  });

  it("unter der Adresse steht die KI-Karte, und in ihr die Freigabe", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereKiKarte();
    expect(
      container.querySelector('[data-testid="detail-ki"]'),
      "die KI-Karte fehlt — die Seitenhilfe dieser Datei hinge an einem anderen Bildschirm",
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ki-freigabe-oeffentlich"]'),
      "der Grundfreigabe-Schalter fehlt — dann erklärt die Hilfe etwas, das es nicht gibt",
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ki-freigabe-vertraulich"]'),
      "der Vertraulich-Schalter fehlt — dann erklärt die Hilfe etwas, das es nicht gibt",
    ).not.toBeNull();
  });
});

describe("JOB 3863 · F1 · die KI-Fläche erklärt ihre Freigabe unter „Seitenhilfe“", () => {
  for (const e of EINTRAEGE) {
    it(`${e.key} · Titel und Text stehen in der Liste, die Leermeldung nicht`, async () => {
      const titel = i18n.t(e.titelKey);
      const text = i18n.t(e.textKey);
      expect(titel, `${e.key}: ${e.titelKey} löst nicht auf`).not.toBe(e.titelKey);
      expect(text, `${e.key}: ${e.textKey} löst nicht auf`).not.toBe(e.textKey);

      await montiereKiKarte();
      await seitenhilfeOeffnen();

      const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
      expect(liste, `${e.key}: es gibt gar keine Seitenhilfe-Liste`).not.toBeNull();
      const inhalt = listentext();
      expect(inhalt, `${e.key}: der Titel fehlt in der Liste`).toContain(titel);
      expect(inhalt, `${e.key}: der Text fehlt in der Liste`).toContain(text);
      const menue = gestrafft(
        container.querySelector('[data-testid="zahnrad-menue"]')?.textContent,
      );
      expect(menue, `${e.key}: die Leermeldung steht immer noch da`).not.toContain(
        i18n.t("menue.seitenhilfe.leer"),
      );
    });
  }

  it("beide Texte beantworten mehr als einen Halbsatz und sind nicht derselbe", () => {
    const gesehen = new Map<string, string>();
    for (const e of EINTRAEGE) {
      const text = i18n.t(e.textKey);
      expect(
        text.length,
        `${e.key}: der Text ist zu kurz, um Schalter, Wirkung und nächsten Schritt zu tragen`,
      ).toBeGreaterThan(200);
      const zwilling = gesehen.get(text);
      expect(zwilling, `${e.key}: wörtlich derselbe Text wie „${zwilling}"`).toBeUndefined();
      gesehen.set(text, e.key);
    }
  });

  it("die Hilfe steht auch dann, wenn die Konfiguration noch gar nicht geladen ist", async () => {
    // `halter.konfig` bleibt `null`: die Abfrage antwortet nie. Hinge die Anmeldung am geladenen
    // Stand, stünde im Zahnrad genau dann die Leermeldung, wenn jemand wissen will, wo er ist
    // (die Lehre, die JOB 3670 in `AdminKontenDetails.tsx:84-95` aufgeschrieben hat).
    expect(halter.konfig).toBeNull();
    await montiereKiKarte();
    await seitenhilfeOeffnen();
    const inhalt = listentext();
    for (const e of EINTRAEGE) {
      expect(inhalt, `${e.key}: fehlt, solange die Konfiguration lädt`).toContain(
        i18n.t(e.textKey),
      );
    }
  });
});

describe("JOB 3863 · F2 · die Seitenhilfe spricht Deutsch, Englisch und Niederländisch", () => {
  for (const sprache of SPRACHEN) {
    for (const e of EINTRAEGE) {
      it(`${e.key} · ${sprache}: der Text DIESER Sprache steht in der Liste`, async () => {
        const titel = satz(sprache, e.titelKey);
        const text = satz(sprache, e.textKey);
        const deTitel = satz("de", e.titelKey);
        const deText = satz("de", e.textKey);
        if (sprache !== "de") {
          expect(titel, `${e.key}/${sprache}: der Titel ist wörtlich der deutsche`).not.toBe(
            deTitel,
          );
          expect(text, `${e.key}/${sprache}: der Text ist wörtlich der deutsche`).not.toBe(deText);
        }

        await i18n.changeLanguage(sprache);
        await montiereKiKarte();
        await seitenhilfeOeffnen();
        const inhalt = listentext();
        expect(inhalt, `${e.key}/${sprache}: der Titel fehlt in der Liste`).toContain(titel);
        expect(inhalt, `${e.key}/${sprache}: der Text fehlt in der Liste`).toContain(text);
        if (sprache !== "de") {
          expect(
            inhalt,
            `${e.key}/${sprache}: in der Liste steht der DEUTSCHE Text — die Fläche ist auf den Rückfall „de" gefallen`,
          ).not.toContain(deText);
        }
      });
    }
  }
});

describe("JOB 3863 · F3 · die Hilfe benennt die beiden Schalter so, wie sie auf der Fläche heissen", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache} · beide Beschriftungen stehen wörtlich im Text`, () => {
      // Die Erwartung wird nicht abgeschrieben, sondern aus der Fläche GELESEN
      // (`AdminKiDetails.tsx:452-505`, Ressourcenbündel je Sprache). Wird eine Beschriftung
      // umbenannt, ohne dass die Hilfe folgt, ist dieser Fall rot — genau dafür steht er hier.
      const text = satz(sprache, "seitenhilfe.admin.kiFreigabe.text");
      for (const key of ["adm.ai.freigabe.oeffentlich", "adm.ai.freigabe.vertraulich"] as const) {
        const beschriftung = satz(sprache, key);
        expect(
          text,
          `${sprache}: die Hilfe nennt den Schalter „${beschriftung}" nicht wörtlich — wer sucht, findet ihn dann nicht`,
        ).toContain(beschriftung);
      }
    });
  }
});

describe("JOB 3863 · F4 · die Hilfe nennt die Folge ohne Freigabe und die EINE benannte Ursache", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache} · Web-Fläche, Klara/Word und die Deploy-Variable stehen im Text`, () => {
      const text = satz(sprache, "seitenhilfe.admin.kiOhneFreigabe.text");
      // Die Deploy-Variable wird aus dem Satz gelesen, den die Karte im gesperrten Fall selbst
      // anzeigt (`ki-env-gesperrt`, `adm.ai.envLocked`) — nicht aus dem Gedächtnis. Es ist die
      // EINZIGE im Bestand benannte Ursache für wirkungslose Schalter (`AdminKiDetails.tsx:903-911`).
      const envSatz = satz(sprache, "adm.ai.envLocked");
      const variable = /KLARWERK_[A-Z_]+/.exec(envSatz)?.[0];
      expect(
        variable,
        `${sprache}: aus „${envSatz}" lässt sich keine Deploy-Variable lesen — dann ist die Kalibrierung dieses Falls kaputt, nicht die Hilfe`,
      ).toBeTruthy();
      expect(
        text,
        `${sprache}: die Hilfe nennt „${variable}" nicht — dann bleibt der gesperrte Fall ohne nächsten Schritt`,
      ).toContain(variable);
      for (const wort of ["Klara", "Word"]) {
        expect(
          text,
          `${sprache}: die Hilfe sagt nichts über „${wort}" — die Folge ohne Freigabe ist dort eine andere als auf der Web-Fläche`,
        ).toContain(wort);
      }
      // JOB 3863 RUNDE 2 (BEN-Korrekturpflicht 1): die Web-Folge wird nicht mehr behauptet, sondern
      // WÖRTLICH aus dem Satz zitiert, den der ausgegraute Knopf selbst trägt (`ai.unavailable.hint`,
      // `components/AiUnavailableHint.tsx:11`). Wird dieser Satz umformuliert, ist die Hilfe rot —
      // und nicht erst der Mensch, der ihn auf der Fläche sucht und nicht findet. Dass er
      // tatsächlich erscheint, misst V1; dieser Fall misst nur, dass die Hilfe ihn nennt.
      const knopfsatz = satz(sprache, "ai.unavailable.hint");
      expect(
        text,
        `${sprache}: die Hilfe zitiert „${knopfsatz}" nicht — dann beschreibt sie die Web-Folge ohne Freigabe nicht so, wie die Fläche sie zeigt`,
      ).toContain(knopfsatz);
    });
  }
});

describe("JOB 3863 · F4b · die Hilfe verspricht die Protokollpflicht nur so weit, wie sie gilt", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache} · keine unbedingte Zusage „jede Änderung wird protokolliert"`, () => {
      // DREI RUNDEN SIND AN DIESEM EINEN SATZ GESCHEITERT, und jedes Mal war der Fehler derselbe:
      // die Zusage reichte WEITER als die Stelle, die sie tragen sollte.
      //   Runde 1: „jede Änderung geht ins Prüfprotokoll" (BEN_ROT, Pflicht 2) — gilt nur für die
      //            Erweiterung.
      //   Runde 3: „eine Rücknahme wird ebenso protokolliert" (BEN_ROT, Pflicht 1) — schwächer,
      //            aber immer noch eine Garantie. BEN hat sie mit einem eigenen Lauf widerlegt:
      //            „Rücknahme HTTP 200; Freigabe entfernt; Audit vorher=1 nachher=1".
      //   Runde 4: „eine Rücknahme wird NIE abgewiesen und gilt sofort" (BEN_ROT, Pflicht 1) —
      //            belegt war nur der AUDIT-Ausfall. Scheitert die PERSISTENZ selbst, antwortet die
      //            Route mit 400/409 (`reasoner-routes.ts:795-829`) und der alte Stand gilt weiter
      //            (`service.ts:1032-1033`, WRITE-THEN-RUNTIME). „Nie" war dort falsch.
      // Der Server kennt also DREI Lagen, und der Text muss alle drei auseinanderhalten:
      //   ERWEITERUNG ohne Beleg → 503, nichts erteilt (`reasoner-routes.ts:766-791`; P1).
      //   RÜCKNAHME, Persistenz OK, Protokoll fällt aus → 200, wirksam (`:849-863`; P2).
      //   RÜCKNAHME, PERSISTENZ fällt aus → 400, alter Stand gilt weiter (`:795-829`; P4).
      // Diese Lagen misst die Gruppe P am echten Adminweg; dieser Fall hält den TEXT daran: keine
      // der drei alten Fassungen kommt zurück, und die wahren Aussagen stehen da.
      const text = satz(sprache, "seitenhilfe.admin.kiFreigabe.text");
      // Schlüssel an SPRACHEN gebunden, nicht `Record<string, …>`: unter `noUncheckedIndexedAccess`
      // wäre der Zugriff sonst `RegExp | undefined` (TS2532, Tor JOB 3863 R2) — und eine fehlende
      // Sprache fiele erst zur Laufzeit auf statt beim Typprüfer.
      const unbedingt: Record<(typeof SPRACHEN)[number], RegExp> = {
        de: /jede\s+Änderung\s+geht\s+ins\s+Prüfprotokoll/i,
        en: /every\s+change\s+goes\s+into\s+the\s+audit\s+log/i,
        nl: /elke\s+wijziging\s+gaat\s+het\s+auditlogboek\s+in/i,
      };
      expect(
        unbedingt[sprache].test(text),
        `${sprache}: die Hilfe sagt unbedingt zu, dass jede Änderung protokolliert wird — die Rücknahme gilt aber auch ohne Eintrag`,
      ).toBe(false);
      // RUNDE 4 (BEN-Korrekturpflicht 1): auch die ZWEITE, schwächere Fassung ist eine Garantie und
      // darf nicht zurückkommen. Sie ist der Wortlaut, den BEN widerlegt hat.
      const auchNicht: Record<(typeof SPRACHEN)[number], RegExp> = {
        de: /Rücknahme\s+wird\s+ebenso\s+protokolliert/i,
        en: /withdrawal\s+is\s+logged\s+just\s+as\s+much/i,
        nl: /terugname\s+wordt\s+eveneens\s+vastgelegd/i,
      };
      expect(
        auchNicht[sprache].test(text),
        `${sprache}: die Hilfe sagt zu, dass die Rücknahme protokolliert wird — P2 misst, dass sie auch OHNE Eintrag wirksam bleibt`,
      ).toBe(false);
      // RUNDE 5 (BEN-Korrekturpflicht 2): auch die DRITTE Fassung ist verboten, und zwar als
      // MUSTER und nicht als Wortlaut — „nie abgewiesen" ist in jeder Einkleidung falsch, solange
      // P4 zeigt, dass der Server eine Rücknahme abweisen KANN. Das ist die Mutation, mit der BEN
      // diese Zeile prüft (seine Gegenprobe 87d78a67 traf noch die Fassung von Runde 3).
      const absolut: Record<(typeof SPRACHEN)[number], RegExp> = {
        de: /nie(mals)?\s+abgewiesen/i,
        en: /never\s+(refused|rejected|declined)/i,
        nl: /nooit\s+afgewezen/i,
      };
      expect(
        absolut[sprache].test(text),
        `${sprache}: die Hilfe sagt absolut zu, die Rücknahme werde nie abgewiesen — P4 misst das Gegenteil (HTTP 400, Freigabe bleibt gesetzt)`,
      ).toBe(false);
      // Und an der Stelle der gestrichenen Garantien stehen die zwei gemessenen AUSGÄNGE, getrennt:
      //   (a) Protokollfehler NACH erfolgreicher Rücknahme → sie bleibt wirksam (P2).
      //   (b) die Rücknahme lässt sich gar nicht speichern → abgewiesen, alter Stand gilt (P4).
      // Ohne (a) fehlte dem Administrator die Auskunft zum Ausnahmefall; ohne (b) stünde die
      // Zusage aus (a) wieder als die ganze Wahrheit da — genau der Fehler von Runde 4.
      const ausgangAudit: Record<(typeof SPRACHEN)[number], RegExp> = {
        de: /Scheitert\s+nach\s+einer\s+erfolgreichen\s+Rücknahme\s+deren\s+Protokollierung,\s+bleibt\s+die\s+Rücknahme\s+trotzdem\s+wirksam/i,
        en: /if\s+logging\s+fails\s+after\s+a\s+withdrawal\s+has\s+gone\s+through,\s+the\s+withdrawal\s+still\s+takes\s+effect/i,
        nl: /mislukt\s+na\s+een\s+geslaagde\s+terugname\s+het\s+vastleggen\s+ervan,\s+dan\s+blijft\s+de\s+terugname\s+toch\s+van\s+kracht/i,
      };
      expect(
        ausgangAudit[sprache].test(text),
        `${sprache}: die Hilfe nennt den Ausgang der nicht protokollierbaren Rücknahme nicht — dann bleibt der Ausnahmefall aus P2 unbeschrieben`,
      ).toBe(true);
      const ausgangSpeicher: Record<(typeof SPRACHEN)[number], RegExp> = {
        de: /gar\s+nicht\s+speichern,\s+meldet\s+der\s+Server\s+den\s+Fehler,\s+und\s+der\s+bisher\s+gespeicherte\s+Stand\s+gilt\s+weiter/i,
        en: /cannot\s+be\s+saved\s+at\s+all,\s+the\s+server\s+reports\s+the\s+error\s+and\s+the\s+state\s+stored\s+so\s+far\s+continues\s+to\s+apply/i,
        nl: /helemaal\s+niet\s+worden\s+opgeslagen,\s+dan\s+meldt\s+de\s+server\s+de\s+fout\s+en\s+blijft\s+de\s+tot\s+dan\s+opgeslagen\s+stand\s+gelden/i,
      };
      expect(
        ausgangSpeicher[sprache].test(text),
        `${sprache}: die Hilfe verschweigt, dass eine Rücknahme auch abgewiesen werden kann — dann liest der Administrator die Zusage aus P2 als die ganze Wahrheit (der Fehler von Runde 4)`,
      ).toBe(true);
      // Und die schwächere, wahre Aussage steht wirklich da: beide Richtungen benannt.
      const beide: Record<(typeof SPRACHEN)[number], readonly RegExp[]> = {
        de: [/Erweiterung/i, /Rücknahme/i],
        en: [/extension/i, /withdrawal/i],
        nl: [/uitbreiding/i, /terugname/i],
      };
      for (const muster of beide[sprache]) {
        expect(
          muster.test(text),
          `${sprache}: die Hilfe unterscheidet Erweiterung und Rücknahme nicht (${String(muster)}) — dann steht dort wieder eine Zusage für beide`,
        ).toBe(true);
      }
    });
  }

  it("die beiden Fälle des Kerns, auf die sich diese Zusage stützt, sagen noch, was sie sagen", () => {
    // DIESER PIN IST NICHT DER VERHALTENSBELEG — das war der Irrtum von Runde 3. BEN, wörtlich:
    // „Das Verbot eines früheren Satzes und ein Quellen-Pin gelten nicht als Verhaltensbeleg."
    // Den Beleg führt jetzt die Gruppe P, die den echten Adminweg fährt. Dieser Fall bleibt
    // daneben stehen und tut genau eine kleinere Sache: er BINDET die zwei Fälle des Kerns
    // (JOB 3549), auf deren Aussage die Hilfe aufbaut. Verschwinden R5 oder R6, oder drehen sie
    // ihre Aussage um, ist diese Zeile rot — und dann gehört der Hilfetext neu geprüft, auch wenn
    // P an diesem Tag noch grün wäre.
    const quelle = readFileSync(
      join(process.cwd(), "tests/admin-ki-freigabe/rollen-und-protokoll.test.ts"),
      "utf8",
    );
    const erwartet: ReadonlyArray<readonly [string, readonly string[]]> = [
      // R5: die ERWEITERUNG ohne Beleg wird abgewiesen — und bleibt auch wirkungslos.
      [
        "R5 · lässt sich eine ERWEITERUNG nicht protokollieren, wird sie NICHT erteilt (503)",
        ["expect(antwort.statusCode).toBe(503);", "expect(cloud.rufe()).toBe(0);"],
      ],
      // R6: die RÜCKNAHME wird protokolliert und NICHT abgewiesen.
      [
        "R6 · eine RÜCKNAHME wird protokolliert, aber nie blockiert — sie führt in die sichere Richtung",
        ["expect(zurueck.statusCode).toBe(200);", "expect(eintraege).toHaveLength(2);"],
      ],
    ];
    for (const [name, zeilen] of erwartet) {
      const von = quelle.indexOf(name);
      expect(von, `der Fall „${name}" steht nicht mehr in seiner Datei`).toBeGreaterThan(-1);
      const bis = quelle.indexOf("\n  it(", von);
      const rumpf = quelle.slice(von, bis === -1 ? undefined : bis);
      for (const zeile of zeilen) {
        expect(rumpf, `„${name}" prüft „${zeile}" nicht mehr`).toContain(zeile);
      }
    }
  });
});

describe("JOB 3863 · F5 · der Hilfetext steht NICHT im gezeichneten Seiteninhalt", () => {
  it("keiner der beiden Texte erscheint in <main>", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereKiKarte();
    const sicht = sichtfeldtext();
    for (const e of EINTRAEGE) {
      expect(
        sicht,
        `${e.key}: der Erklärsatz steht im Sichtfeld — die Seitenhilfe ist der Ort, nicht die Karte`,
      ).not.toContain(i18n.t(e.textKey));
    }
  });
});

describe("JOB 3863 · F6 · diese Texte sprechen nur zu Administratoren", () => {
  it("`/admin` bleibt für jede Rolle unterhalb von Admin verschlossen", () => {
    const item = ALL_ITEMS.find((i) => i.path === "/admin");
    expect(item, "der Navigationseintrag `/admin` ist verschwunden").toBeDefined();
    if (!item) {
      return;
    }
    for (const rolle of ROLES) {
      expect(
        roleAllows(item, rolle as Role),
        `${rolle}: die Sichtbarkeit der Verwaltung hat sich geändert — dann muss die Zusage „Schalten darf nur ein Administrator" neu geprüft werden`,
      ).toBe(rolle === "admin");
    }
  });

  it("das Schreibrecht der Freigabe hat wirklich nur „admin“", () => {
    // Die Oberfläche kann nichts erzwingen; die Route verlangt `users.manage`
    // (`services/app/src/routes/reasoner-routes.ts:753`). Gelesen wird die Rechtetabelle selbst.
    for (const [rolle, rechte] of Object.entries(ROLE_PERMISSIONS)) {
      expect(
        rechte.includes("users.manage"),
        `${rolle}: darf ${rechte.includes("users.manage") ? "" : "nicht "}schreiben — erwartet war nur „admin"`,
      ).toBe(rolle === "admin");
    }
  });
});

// ================================================================================================
// W — DIE HILFE SAGT DIE WAHRHEIT. Jede Zusage einmal an der gemounteten Karte nachgemessen.
// ================================================================================================
//
// JEDER STAND WIRD ERSCHALTET, NICHT HINGESCHRIEBEN. Die Montage beginnt immer im
// Auslieferungszustand (keine Freigabe), und was danach gilt, hat die Fläche selbst geschrieben;
// der Prüfstand gibt es nur zurück. Das ist zugleich die Bedingung des Wächters F2
// (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:2735`: keine Testdatei schreibt die
// Freigabefelder von Hand) und der schärfere Beleg — ein erschalteter Zustand beweist die
// Bedienfolge mit, ein eingespeister behauptet nur seinen Endpunkt.

/** Das Wörterbuch der Schalter aus dem ZULETZT geschriebenen Rumpf — Namen von der Fläche, nicht von hier. */
function letzteFreigabe(): Record<string, unknown> {
  return (halter.puts.at(-1)?.kiFreigabe ?? {}) as Record<string, unknown>;
}

/** Wie viele Schalter dieser Rumpf auf „an" stellt. */
function anzahlAn(freigabe: Record<string, unknown>): number {
  return Object.values(freigabe).filter((v) => v === true).length;
}

const OEFFENTLICH = '[data-testid="ki-freigabe-oeffentlich"]';
const VERTRAULICH = '[data-testid="ki-freigabe-vertraulich"]';

/** Die Grundfreigabe erteilen — ein Klick, keine Rückfrage (das misst W3). */
async function grundfreigabeErteilen(): Promise<void> {
  await click(container.querySelector(OEFFENTLICH), "Grundfreigabe");
}

/** Die vertrauliche Freigabe erteilen — Klick, Warnung, ausdrückliches Ja. */
async function vertraulichErteilen(): Promise<void> {
  await click(container.querySelector(VERTRAULICH), "Vertraulich");
  await click(container.querySelector('[data-testid="ki-freigabe-vertraulich-ja"]'), "Ja");
}

describe("JOB 3863 · W · was die Hilfe zusagt, tut die Fläche auch", () => {
  it("W1 · Einschalten fragt zuerst nach und schreibt noch nicht", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await click(container.querySelector(VERTRAULICH), "Vertraulich");
    expect(
      container.querySelector('[data-testid="ki-freigabe-vertraulich-frage"]'),
      "die Rückfrage bleibt aus — dann behauptet die Hilfe eine Sicherung, die es nicht gibt",
    ).not.toBeNull();
    expect(
      halter.puts,
      "es wurde schon geschrieben, bevor jemand bestätigt hat — dann ist die Rückfrage Zierde",
    ).toEqual([]);
  });

  it("W2 · erst das ausdrückliche Ja schreibt — und dann steht der Wirkungslos-Hinweis", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await vertraulichErteilen();
    expect(halter.puts.length, "das Ja hat nichts geschrieben").toBe(1);
    expect(
      anzahlAn(letzteFreigabe()),
      `geschrieben wurde ${JSON.stringify(letzteFreigabe())} — erwartet war genau EIN erteilter Schalter`,
    ).toBe(1);
    const hinweis = container.querySelector('[data-testid="ki-freigabe-wirkungslos"]');
    expect(
      hinweis,
      "der Hinweis fehlt — dann verspricht die Hilfe eine Aussage der Karte, die es nicht gibt",
    ).not.toBeNull();
    expect(gestrafft(hinweis?.textContent)).toBe(i18n.t("adm.ai.freigabe.wirkungslos"));
  });

  it("W3 · mit der Grundfreigabe verschwindet der Hinweis — und sie kommt ohne Rückfrage", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await vertraulichErteilen();
    await grundfreigabeErteilen();
    expect(
      container.querySelector('[data-testid="ki-freigabe-vertraulich-frage"]'),
      "die Grundfreigabe fragt nach — die Hilfe schreibt die Rückfrage dem ZWEITEN Schalter zu",
    ).toBeNull();
    expect(halter.puts.length, "die Grundfreigabe wurde nicht geschrieben").toBe(2);
    expect(anzahlAn(letzteFreigabe()), "jetzt müssten beide Schalter an sein").toBe(2);
    expect(
      container.querySelector('[data-testid="ki-freigabe-wirkungslos"]'),
      "der Hinweis steht auch mit Grundfreigabe da — dann sagt er nichts aus und die Hilfe erklärt ihn falsch",
    ).toBeNull();
  });

  it("W4 · Zurücknehmen fragt nicht und schreibt sofort", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await vertraulichErteilen();
    await grundfreigabeErteilen();
    const vorher = { ...letzteFreigabe() };
    await click(container.querySelector(VERTRAULICH), "Vertraulich zurücknehmen");
    expect(
      container.querySelector('[data-testid="ki-freigabe-vertraulich-frage"]'),
      "die Rücknahme fragt nach — die Hilfe sagt, sie tut es nicht",
    ).toBeNull();
    expect(halter.puts.length, "die Rücknahme wurde nicht geschrieben").toBe(3);
    const nachher = letzteFreigabe();
    expect(anzahlAn(nachher), "die Rücknahme hat nicht genau einen Schalter zurückgenommen").toBe(
      anzahlAn(vorher) - 1,
    );
    // Und sie nimmt den ZWEITEN zurück, nicht den ersten: der zurückgenommene Schlüssel ist genau
    // der, den das ausdrückliche Ja erteilt hatte (`halter.puts[0]`).
    const zuerstErteilt = Object.keys(halter.puts[0]?.kiFreigabe as Record<string, unknown>).filter(
      (k) => (halter.puts[0]?.kiFreigabe as Record<string, unknown>)[k] === true,
    );
    for (const k of zuerstErteilt) {
      expect(nachher[k], `${k}: die Rücknahme hat den falschen Schalter getroffen`).toBe(false);
    }
  });

  it("W5 · die Standzeile zeigt den bestätigten Stand, nicht das Kästchen", async () => {
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await grundfreigabeErteilen();
    const stand = gestrafft(
      container.querySelector('[data-testid="ki-freigabe-stand"]')?.textContent,
    );
    expect(stand, "die Standzeile fehlt").not.toBe("");
    expect(stand).toBe(
      i18n.t("adm.ai.freigabe.stand", {
        oeffentlich: i18n.t("adm.ai.freigabe.an"),
        vertraulich: i18n.t("adm.ai.freigabe.aus"),
      }),
    );
  });

  it("W6 · im ENV-Fall sind beide Schalter gesperrt", async () => {
    halter.konfig = konfigOhneFreigabe({ policySource: "env" });
    await montiereNurKarte();
    for (const wahl of [OEFFENTLICH, VERTRAULICH]) {
      const kasten = container.querySelector(wahl);
      expect(
        (kasten as HTMLInputElement | null)?.disabled,
        `${wahl}: bedienbar, obwohl die Deploy-Konfiguration gilt — dann stimmt „ohne Wirkung" nicht`,
      ).toBe(true);
    }
    expect(
      container.querySelector('[data-testid="ki-env-gesperrt"]'),
      "die Karte nennt die Deploy-Konfiguration nicht — dann zeigt der nächste Schritt der Hilfe ins Leere",
    ).not.toBeNull();
  });

  it("W7 · schmal wie breit: der Freigabeblock wird unbedingt gezeichnet", async () => {
    // Die Hilfe spricht über „die Zeile unter den Schaltern" und über den Hinweis unter dem
    // zweiten Schalter. Verschwände einer davon bei kleiner Breite, wäre das ein Verweis ins
    // Leere — derselbe Fehler, an dem JOB 3741 gescheitert ist. Dieser Fall pinnt die BAUART:
    // kein Teil des Blocks hängt an einem Breitenvorsatz. Er ist KEINE Messung an gebautem CSS;
    // stünde hier eine Breitenzahl, wäre sie erfunden. Die Geometrie misst
    // `tests/einstellungen-schmal/**` am gebauten Produkt.
    halter.konfig = konfigOhneFreigabe();
    await montiereNurKarte();
    await vertraulichErteilen();
    const teile = [
      "ki-freigabe-oeffentlich",
      "ki-freigabe-vertraulich",
      "ki-freigabe-wirkungslos",
      "ki-freigabe-stand",
    ];
    for (const id of teile) {
      const el = container.querySelector(`[data-testid="${id}"]`);
      expect(el, `${id} fehlt`).not.toBeNull();
      for (
        let knoten: Element | null = el;
        knoten && knoten !== container;
        knoten = knoten.parentElement
      ) {
        const klassen = knoten.getAttribute("class") ?? "";
        expect(
          /(^|\s)(hidden|sm:hidden|md:hidden|lg:hidden)(\s|$)/.test(klassen),
          `${id}: ein Vorfahre blendet aus („${klassen}") — dann steht die Hilfe über etwas, das nicht in jeder Breite da ist`,
        ).toBe(false);
      }
    }
  });
});

// ================================================================================================
// V — DIE WEB-FOLGE OHNE FREIGABE, AM ECHTEN KERN UND AN EINER ECHTEN FLÄCHE GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE GRUPPE GIBT. Runde 1 schrieb in die Hilfe: „Auf der Web-Fläche bleiben die
// KI-Knöpfe bedienbar." Das war grün geprüft — und falsch. BEN hat es mit einem eigenen Lauf
// widerlegt (ROT, 13.09.): Cloud eingerichtet, keine Freigabe ⇒ `publicStatus().tasks` ist Feld für
// Feld `false`, und `deriveAiAvailable(status, "answer")` ergibt `false`. Der Fehler war nicht der
// Satz allein, sondern die Prüfart: F3/F4 vergleichen WÖRTER. Ein Wort kann jede Unwahrheit tragen.
//
// DESHALB MISST DIESE GRUPPE DIE KETTE, die die Zusage wirklich trägt, und zwar ganz:
//   echter `Reasoner` (wie in der Kompositionswurzel verdrahtet)
//     → sein echter `publicStatus()`
//       → die Antwort, die `endpoints.reasoner.status` liefert
//         → `useAiAvailable` in einer ECHTEN Verbraucherfläche (`AiAssistBox`)
//           → `disabled` am Knopf und der Satz darunter.
// Kein Glied wird übersprungen, keines behauptet.
//
// KEIN FREIGABEFELD WIRD DABEI GESCHRIEBEN — und das ist keine Sparsamkeit, sondern der Gegenstand:
// „nicht gesetzt" IST der Auslieferungszustand und sperrt wie „nein" (`service.ts:658-664`). Diese
// Datei bleibt damit ausserhalb des Freigabe-Registers aus JOB 3550 (F1/F2).

/** Ein Cloud-Anbieter, wie ihn die Kompositionswurzel verdrahtet — er wird hier nie gerufen. */
function cloudClient(): ModelClient {
  return { name: "anthropic:claude-sonnet-4-6", complete: async () => "{}" };
}

/** Ein EIGENES INTERNES Modell (Secondary). Sein Name trägt keinen Cloud-Anbieter. */
function internerClient(): ModelClient {
  return { name: "local:eigenes-modell", complete: async () => "{}" };
}

/**
 * Der öffentliche Status, wie ihn der Server rechnet — aus einem echten `Reasoner`.
 *
 * `intern: true` hängt zusätzlich das eigene interne Modell als Secondary ein. Die Freigabe bleibt
 * in beiden Fällen unberührt (Auslieferungszustand).
 */
function echterStatus(opts: { intern: boolean }): {
  status: Record<string, unknown>;
  reasoner: Reasoner;
} {
  const reasoner = new Reasoner(
    new ModelProvider(cloudClient()),
    undefined,
    undefined,
    undefined,
    opts.intern ? new ModelProvider(internerClient()) : undefined,
  );
  return { status: reasoner.publicStatus() as unknown as Record<string, unknown>, reasoner };
}

/** Die ECHTE Verbraucherfläche mit den KI-Knöpfen (`AiAssistBox`, Aufgabe „assist"). */
async function montiereAssistBox(): Promise<void> {
  await mount(
    "/erfassen",
    createElement(AiAssistBox, {
      text: "Die Pumpe P2 wird alle 200 Betriebsstunden geschmiert.",
      runAssist: async () => "unverändert",
      onApply: () => {},
    }),
  );
}

/** Die geführten KI-Knöpfe der Palette — an ihnen hängt `disabled` (`AiAssistBox.tsx:110-116`). */
function assistKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((b) =>
    /rounded-pill/.test(b.getAttribute("class") ?? ""),
  ) as HTMLButtonElement[];
}

describe("JOB 3863 · V · was die Hilfe über die Web-Fläche sagt, misst der echte Kern nach", () => {
  it("V1 · nur öffentliche KI, keine Freigabe: der Kern meldet für JEDE Aufgabe „nicht nutzbar“", () => {
    const { status } = echterStatus({ intern: false });
    const tasks = status.tasks as Record<string, boolean>;
    // Die Zahl steht ausdrücklich da: eine LEERE Karte ergäbe unten dieselbe leere Liste.
    expect(Object.keys(tasks).length).toBeGreaterThan(0);
    expect(
      Object.entries(tasks).filter(([, nutzbar]) => nutzbar !== false),
      "eine Aufgabe gilt ohne Freigabe als nutzbar — dann ist die Sperre nicht die, die die Hilfe beschreibt",
    ).toEqual([]);
  });

  it("V2 · und die Fläche graut aus — mit genau dem Satz, den die Hilfe zitiert", async () => {
    halter.status = echterStatus({ intern: false }).status;
    await montiereAssistBox();
    const knoepfe = assistKnoepfe();
    expect(
      knoepfe.length,
      "die Palette hat keine KI-Knöpfe — dann misst dieser Fall nichts",
    ).toBeGreaterThan(0);
    for (const knopf of knoepfe) {
      expect(
        knopf.disabled,
        `„${gestrafft(knopf.textContent)}" ist bedienbar, obwohl kein Modell nutzbar ist — genau das versprach Runde 1 fälschlich`,
      ).toBe(true);
    }
    expect(
      gestrafft(container.textContent),
      "der Satz am ausgegrauten Knopf fehlt — dann zitiert die Hilfe etwas, das niemand zu sehen bekommt",
    ).toContain(satz("de", "ai.unavailable.hint"));
  });

  it("V3 · mit eigenem internem Modell bleibt dieselbe Fläche bedienbar — ohne jede Freigabe", async () => {
    const { status } = echterStatus({ intern: true });
    expect(
      (status.tasks as Record<string, boolean>).assist,
      "auch mit internem Modell gilt die Aufgabe als nicht nutzbar — dann ist die zweite Hälfte der Hilfe falsch",
    ).toBe(true);
    halter.status = status;
    await montiereAssistBox();
    const knoepfe = assistKnoepfe();
    expect(knoepfe.length).toBeGreaterThan(0);
    for (const knopf of knoepfe) {
      expect(
        knopf.disabled,
        `„${gestrafft(knopf.textContent)}" ist ausgegraut, obwohl das interne Modell verbunden ist`,
      ).toBe(false);
    }
    expect(
      gestrafft(container.textContent),
      "der Satz über das fehlende Modell steht da, obwohl eines verbunden ist — das wäre die umgekehrte Unwahrheit",
    ).not.toContain(satz("de", "ai.unavailable.hint"));
  });

  it("V4 · die Ursache ist wirklich die Freigabe: derselbe Anbieter ist eingerichtet und gewählt", () => {
    // Die KALIBRIERUNG, ohne die V1 auch „kein Anbieter verdrahtet" bedeuten könnte. Beide Zahlen
    // kommen aus DEMSELBEN Reasoner: `effectiveAnbieter` beantwortet die Konfigurationsfrage und
    // hebt dabei AUSSCHLIESSLICH den Freigabe-Riegel auf (`service.ts:727-734`, `fuerAnzeige`),
    // `tasks` beantwortet die Egressfrage. Der Anbieter steht also da — nutzbar ist er trotzdem
    // nicht, und der einzige Unterschied zwischen beiden Rechnungen ist die fehlende Freigabe.
    const { status, reasoner } = echterStatus({ intern: false });
    const cfg = reasoner.configStatus();
    expect(
      cfg.effectiveAnbieter.assist,
      "der Anbieter ist gar nicht eingerichtet — dann misst V1 eine andere Ursache als die Hilfe nennt",
    ).toBe("anthropic");
    expect(cfg.cloudConfigured).toBe(true);
    expect((status.tasks as Record<string, boolean>).assist).toBe(false);
  });
});

// ================================================================================================
// P — DAS PROTOKOLL DER FREIGABE, AM ECHTEN ADMINWEG GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE GRUPPE GIBT. Runde 3 schrieb in die Hilfe „eine Rücknahme wird ebenso
// protokolliert" und belegte das mit einem PIN auf die Fälle R5/R6 des Kerns. BEN hat die Zusage mit
// einem eigenen Lauf widerlegt („Rücknahme HTTP 200; Freigabe entfernt; Audit vorher=1 nachher=1")
// und die Prüfart verworfen (Korrekturpflicht 2, wörtlich: „Das Verbot eines früheren Satzes und
// ein Quellen-Pin gelten nicht als Verhaltensbeleg"). Er hat recht: R6 prüft den GELINGENDEN
// Protokolleintrag. Der Ausnahmefall — die Rücknahme, deren Eintrag SCHEITERT — stand in keinem
// Fall, und genau er ist der interessante: `reasoner-routes.ts:849-861` hängt das `audit?.record`
// der Rücknahme in ein `.catch()`, das nur noch ins Log schreibt; danach antwortet die Route mit 200
// (`:863`), ohne den Ausgang des Eintrags überhaupt anzusehen.
//
// GEMESSEN WIRD AM ECHTEN WEG, UND DER RUMPF KOMMT VON DER ECHTEN FLÄCHE. Die zwei Nutzlasten
// (erteilen, zurücknehmen) werden nicht hier hingeschrieben, sondern der gemounteten Karte
// ABGENOMMEN: `rumpfPaarVonDerFlaeche` klickt den Schalter an und wieder aus und nimmt, was die
// Karte an `PUT /reasoner/config` geschickt hat (`AdminKiDetails.tsx:646-656`). Erst diese Bytes
// gehen in den echten Server. Das hat zwei Wirkungen, und beide sind beabsichtigt:
//   1. Die Kette ist vollständig — Fläche → Rumpf → Route → Protokoll → Wirkung. Kein Glied ist
//      nachgebaut, keines behauptet. Weicht die Karte künftig vom Vertrag der Route ab, ist P rot.
//   2. Der Freigabe-Wächter aus JOB 3550 bleibt gewahrt. F2 verbietet JEDER Testdatei ausserhalb
//      von `tests/admin-ki-freigabe/**` und `tests/admin-ki-oberflaeche/**`, die Freigabefelder von
//      Hand zu schreiben — „auch in der Nutzlast des echten Adminwegs"
//      (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:663`). Diese Datei nennt die beiden
//      Feldnamen deshalb an keiner Stelle; sie liest die Schlüssel aus dem, was die Fläche schrieb.
//      Das ist nicht der billigere Weg, sondern der schärfere: was der Wächter verhindern will, ist
//      der Aufbau, der sich still selbst eine Freigabe erteilt, um eine FREMDE Messung grün zu
//      bekommen. Hier IST die Freigabe der Gegenstand, und sie entsteht durch Bedienung.

/** Der Rumpf, den die ECHTE Karte schreibt — einmal für „erteilen", einmal für „zurücknehmen". */
async function rumpfPaarVonDerFlaeche(): Promise<{
  erteilen: Record<string, unknown>;
  zuruecknehmen: Record<string, unknown>;
}> {
  halter.konfig = konfigOhneFreigabe();
  await montiereNurKarte();
  await grundfreigabeErteilen();
  await click(container.querySelector(OEFFENTLICH), "Grundfreigabe zurücknehmen");
  expect(
    halter.puts.length,
    `die Karte hat nicht zwei Rümpfe geschrieben (${halter.puts.length}) — dann misst P nicht die Fläche`,
  ).toBe(2);
  const erteilen = halter.puts[0] ?? {};
  const zuruecknehmen = halter.puts[1] ?? {};
  // Die Kalibrierung des Paars: der erste Rumpf stellt genau einen Schalter an, der zweite keinen.
  // Ohne sie könnte P1/P2 denselben Rumpf zweimal fahren und wäre trotzdem grün.
  expect(anzahlAn((erteilen.kiFreigabe ?? {}) as Record<string, unknown>)).toBe(1);
  expect(anzahlAn((zuruecknehmen.kiFreigabe ?? {}) as Record<string, unknown>)).toBe(0);
  return { erteilen, zuruecknehmen };
}

/** Ein Protokoll, das auf Kommando nicht mehr schreibt — der Ausnahmefall, der der Hilfe fehlte. */
function schaltbaresProtokoll(): {
  repo: AuditRepo;
  brichAb: () => void;
  anzahl: () => Promise<number>;
} {
  const echt = new InMemoryAuditRepo();
  let kaputt = false;
  const nichtSchreibbar = (): never => {
    throw new Error("Protokoll nicht schreibbar");
  };
  return {
    repo: {
      append: async (eintrag, tx) => (kaputt ? nichtSchreibbar() : echt.append(eintrag, tx)),
      appendOnce: async (eintrag, tx) =>
        kaputt ? nichtSchreibbar() : echt.appendOnce(eintrag, tx),
      all: () => echt.all(),
      last: (tx) => echt.last(tx),
    },
    brichAb: () => {
      kaputt = true;
    },
    anzahl: async () =>
      (await echt.all()).filter((e) => e.action.startsWith("reasoner.ki-freigabe")).length,
  };
}

/**
 * Ein Policy-SPEICHER, der auf Kommando nicht mehr schreibt — RUNDE 5 (BEN-Korrekturpflicht 3).
 *
 * Der Unterschied zu `schaltbaresProtokoll` ist der ganze Punkt dieser Runde: dort scheitert der
 * BELEG, nachdem die Rücknahme schon gilt; hier scheitert die WIRKUNG selbst. `setTaskConfig`
 * schreibt ZUERST ins Repo und setzt die Laufzeit erst nach Erfolg (`service.ts:1032-1033`) — der
 * Fehler wird also geworfen, BEVOR irgendetwas gilt, und die Route macht daraus 400
 * (`reasoner-routes.ts:825-829`).
 */
function schaltbarerPolicySpeicher(): { repo: ReasonerPolicyRepo; brichAb: () => void } {
  const echt = new InMemoryReasonerPolicyRepo();
  let kaputt = false;
  return {
    repo: {
      get: () => echt.get(),
      set: async (config) => {
        if (kaputt) {
          throw new Error("Policy-Speicher nicht schreibbar");
        }
        return echt.set(config);
      },
    },
    brichAb: () => {
      kaputt = true;
    },
  };
}

/**
 * Ein vollständiges Haus: echte Routen, echter Reasoner mit Cloud-Anbieter, echtes Protokoll.
 *
 * `policyRepo` ist der SECHSTE positionale Parameter des `Reasoner` (`service.ts:526`); ohne ihn
 * nimmt er seinen eigenen In-Memory-Speicher, und P1–P3 brauchen nichts anderes.
 */
function echterServer(
  repo: AuditRepo,
  policyRepo?: ReasonerPolicyRepo,
): ReturnType<typeof buildApp> {
  const services: AppServices = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider(cloudClient()),
    undefined,
    undefined,
    undefined,
    undefined,
    policyRepo,
  );
  services.audit = new AuditService({ repo });
  return buildApp(services);
}

/** Der erste Registrierte ist der Bootstrap-Admin — die einzige Rolle mit `users.manage`. */
async function alsAdmin(app: ReturnType<typeof buildApp>): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "admin@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  const token = (login.json() as { token?: string }).token;
  expect(typeof token, "der Admin ist nicht angemeldet — dann misst P gar nichts").toBe("string");
  return { authorization: `Bearer ${token ?? ""}` };
}

const schreibe = (
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) => app.inject({ method: "PUT", url: "/api/reasoner/config", headers, payload });

/** Wie viele Schalter der Server als GELTEND zurückgibt — „fehlt" ist dabei dasselbe wie „keiner". */
function geltendeSchalter(antwort: { json: () => unknown }): number {
  const konfig = (antwort.json() as { taskConfig?: Record<string, unknown> }).taskConfig ?? {};
  return anzahlAn((konfig.kiFreigabe ?? {}) as Record<string, unknown>);
}

describe("JOB 3863 · P · was die Hilfe über das Protokoll sagt, misst der echte Adminweg nach", () => {
  it("P1 · Erweiterung ohne Protokolleintrag: abgewiesen, und NICHTS ist erteilt", async () => {
    // Die erste Hälfte der Zusage: „Eine Erweiterung wird nur erteilt, wenn sie sich auch
    // protokollieren lässt — sonst weist der Server sie ab, statt sie still zu erteilen."
    const paar = await rumpfPaarVonDerFlaeche();
    const protokoll = schaltbaresProtokoll();
    protokoll.brichAb();
    const app = echterServer(protokoll.repo);
    const admin = await alsAdmin(app);

    const antwort = await schreibe(app, admin, paar.erteilen);
    expect(
      antwort.statusCode,
      `der Server hat mit ${antwort.statusCode} geantwortet — die Hilfe sagt, er weist ab`,
    ).toBe(503);
    // Und zwar nicht nur im Statuscode: der Stand danach ist der Auslieferungszustand.
    const danach = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: admin,
    });
    expect(
      geltendeSchalter(danach),
      "es gilt eine Freigabe, obwohl der Server abgewiesen hat — dann wäre sie still erteilt",
    ).toBe(0);
    expect(await protokoll.anzahl()).toBe(0);
  });

  it("P2 · Rücknahme mit AUSGEFALLENEM Protokoll: 200, Freigabe weg, kein neuer Eintrag", async () => {
    // DER FALL, DEN RUNDE 3 VERSPROCHEN UND NICHT GEMESSEN HAT. Erst erteilen, solange das
    // Protokoll schreibt — dann fällt es aus, und die Rücknahme kommt trotzdem durch.
    const paar = await rumpfPaarVonDerFlaeche();
    const protokoll = schaltbaresProtokoll();
    const app = echterServer(protokoll.repo);
    const admin = await alsAdmin(app);

    const erteilt = await schreibe(app, admin, paar.erteilen);
    expect(
      erteilt.statusCode,
      "die Freigabe liess sich nicht erteilen — dann misst P2 nichts",
    ).toBe(200);
    expect(geltendeSchalter(erteilt), "die erteilte Freigabe gilt nicht").toBe(1);
    const vorher = await protokoll.anzahl();
    expect(vorher, "die Erteilung hat keinen Protokolleintrag hinterlassen").toBe(1);

    protokoll.brichAb();
    const zurueck = await schreibe(app, admin, paar.zuruecknehmen);
    // 1. KEIN BELEG IM VORAUS VERLANGT — der Ausgang ist 200 und nicht der 503 der Erweiterung.
    //    RUNDE 5: dieser Fall sagt NICHT „nie abgewiesen". Er sagt: DIESER Fehler weist nicht ab.
    //    Dass ein anderer es tut, misst P4 — genau die Grenze, die die Hilfe seit Runde 5 zieht.
    expect(
      zurueck.statusCode,
      `der Server hat die Rücknahme mit ${zurueck.statusCode} abgewiesen, obwohl nur ihr PROTOKOLL ausgefallen ist — dann gilt die Zusage aus dem Hilfetext nicht`,
    ).toBe(200);
    // 2. SIE GILT SOFORT — in der Antwort und im nächsten Abruf, nicht nur im Statuscode.
    expect(geltendeSchalter(zurueck), "die Antwort trägt noch eine geltende Freigabe").toBe(0);
    const danach = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: admin,
    });
    expect(
      geltendeSchalter(danach),
      "die Freigabe gilt weiter — dann wäre die Rücknahme nur eine Antwort und keine Wirkung",
    ).toBe(0);
    // 3. UND DAS PROTOKOLL IST UNVERÄNDERT. Genau deshalb steht in der Hilfe keine
    //    Protokollzusage mehr für die Rücknahme, sondern ihr Ausgang: sie bleibt wirksam.
    expect(
      await protokoll.anzahl(),
      "es kam doch ein Eintrag dazu — dann ist dieser Prüfstand kaputt und nicht der Server ehrlich",
    ).toBe(vorher);
  });

  it("P3 · dieselbe Rücknahme mit laufendem Protokoll: 200, Freigabe weg, Eintrag da", async () => {
    // DIE GEGENLAGE ZU P2, und sie ist Pflicht: ohne sie bewiese P2 vielleicht nur, dass dieser
    // Prüfstand überhaupt nie protokolliert. Derselbe Rumpf, dasselbe Haus, nur ein Protokoll, das
    // schreibt — und dann zählt der Eintrag der Rücknahme mit.
    const paar = await rumpfPaarVonDerFlaeche();
    const protokoll = schaltbaresProtokoll();
    const app = echterServer(protokoll.repo);
    const admin = await alsAdmin(app);

    expect((await schreibe(app, admin, paar.erteilen)).statusCode).toBe(200);
    const zurueck = await schreibe(app, admin, paar.zuruecknehmen);
    expect(zurueck.statusCode).toBe(200);
    expect(geltendeSchalter(zurueck)).toBe(0);
    expect(
      await protokoll.anzahl(),
      "die Rücknahme hat auch bei laufendem Protokoll keinen Eintrag erzeugt — dann misst P2 keinen Ausfall, sondern den Normalfall",
    ).toBe(2);
  });

  it("P4 · Rücknahme, die sich nicht speichern lässt: ABGEWIESEN (400), und die Freigabe gilt weiter", async () => {
    // DER FALL, DEN RUNDE 4 MIT „NIE ABGEWIESEN" ÜBERSCHRIEBEN HAT (BEN_ROT R4, Pflichten 1 und 3).
    // P2 misst den Fehler des BELEGS, nachdem die Rücknahme schon gilt. Hier scheitert die WIRKUNG:
    // `setTaskConfig` schreibt zuerst ins Policy-Repo und setzt die Laufzeit erst nach Erfolg
    // (`service.ts:1032-1033`). Der Wurf kommt also VOR jeder Wirkung, die Route fängt ihn
    // (`reasoner-routes.ts:803`) und macht daraus 400 (`:825-829`) — und die erteilte Freigabe
    // steht danach unverändert da.
    // Das ist die Grenze, die der Hilfetext seit Runde 5 ausdrücklich zieht: „Lässt sich die
    // Rücknahme dagegen gar nicht speichern, meldet der Server den Fehler, und der bisher
    // gespeicherte Stand gilt weiter."
    const paar = await rumpfPaarVonDerFlaeche();
    const protokoll = schaltbaresProtokoll();
    const speicher = schaltbarerPolicySpeicher();
    const app = echterServer(protokoll.repo, speicher.repo);
    const admin = await alsAdmin(app);

    // Erst erteilen, solange der Speicher schreibt — sonst gäbe es nichts zurückzunehmen.
    const erteilt = await schreibe(app, admin, paar.erteilen);
    expect(
      erteilt.statusCode,
      "die Freigabe liess sich nicht erteilen — dann misst P4 nichts",
    ).toBe(200);
    expect(geltendeSchalter(erteilt), "die erteilte Freigabe gilt nicht").toBe(1);

    speicher.brichAb();
    const zurueck = await schreibe(app, admin, paar.zuruecknehmen);
    // 1. ABGEWIESEN. Genau das, was „nie abgewiesen" geleugnet hätte.
    expect(
      zurueck.statusCode,
      `der Server hat die nicht speicherbare Rücknahme mit ${zurueck.statusCode} beantwortet — erwartet war eine Abweisung`,
    ).toBe(400);
    expect((zurueck.json() as { error?: string }).error).toBe("BAD_REQUEST");
    // 2. UND DER ALTE STAND GILT WEITER — in der Karte hätte der Administrator sonst eine
    //    Rücknahme vor sich, die es nicht gibt. Gelesen über den echten Abruf, nicht aus dem Repo.
    const danach = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: admin,
    });
    expect(
      geltendeSchalter(danach),
      "die Freigabe ist trotz der abgewiesenen Rücknahme verschwunden — dann gilt der bisher gespeicherte Stand eben NICHT weiter, und der Hilfetext sagt das Falsche",
    ).toBe(1);
  });
});
