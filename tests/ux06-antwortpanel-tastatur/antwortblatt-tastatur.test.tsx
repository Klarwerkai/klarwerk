// @vitest-environment jsdom
// ================================================================================================
// JOB 3102 · UX-06 (Befund N-0010) — DAS „MEHR"-BLATT DER FRAGENFLÄCHE MIT DER TASTATUR.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND, nicht der vermutete
// (`gespraech/nutzerpruefung/ergebnisse/2026-09-05T22-21-40+02-00-gegenpruefung-N-0010.json:4`,
// Chromium 149, 05.09.2026 22:26):
//   „Direkt nach Öffnen lag der Fokus auf BODY. Tab 1 erreichte Kopieren, Tab 2 Hat geholfen,
//    Tab 3 Klara öffnen in der Hauptfläche hinter der Überlagerung; erst Tab 4 erreichte Schließen
//    im Panel … Escape ließ das Panel offen … danach lag der Fokus wieder auf BODY, nicht auf dem
//    auslösenden Knopf."
//
// Vier Aussagen, vier Fälle — jeder fällt für sich, damit „Escape eingebaut, fertig" nicht als
// erfüllt durchgeht:
//   A1 Anfangsfokus IM Blatt          (heute: body)
//   A2 Escape schliesst               (heute: ohne Wirkung)
//   A3 Fokus zurück auf den Auslöser  (heute: body) — über Escape, X-Knopf UND Klickfänger
//   A4 kein Tab hinter das Blatt      (heute: Kopieren/Hat geholfen/Klara erreichbar)
//   A5 ohne Grenze bleibt das Blatt heil — die Gegenprobe in die andere Richtung
//   A7 der Wechsel bei offenem Blatt  (Ben, Runde 1: Fokus landete im gesperrten Bereich)
//
// GEMOUNTET AN DER ECHTEN VERDRAHTUNG: die Seite `/fragen` in der echten `AppShell` mit der echten
// Provider-Kette, dieselbe Reihenfolge wie in `App.tsx`. Nur so steht die Modalgrenze wirklich da
// (`ModalBoundaryProvider` samt der angemeldeten Bereiche Kopfband, Inhalt, Palette, Toasts,
// Klara) — eine nachgebaute Grenze würde die Frage beantworten, die sie selbst gestellt hat.
//
// BENANNTE PRÜFLÜCKE: jsdom setzt `inert` NICHT durch. A4 belegt die STRUKTUR (der Knopf hat einen
// `[inert]`-Vorfahren, das Blatt hat keinen), nicht die WIRKUNG im Browser. Dass ein `inert`-Baum
// dort wirklich tot ist, belegt `tests-smoke/ui-smoke.spec.ts`; hier wird es nicht behauptet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  lage: "antwort" as "antwort" | "luecke",
  aufrufe: [] as string[],
  // KORREKTURPFLICHT 2 (Ben, Runde 1): eine Auffrischung, die HÄNGT, bis der Fall sie eintreffen
  // lässt. Ohne sie liesse sich der Ablauf „Auffrischung läuft schon, DANN wird ‚Mehr‘ geöffnet"
  // nicht bauen — und genau in ihm fiel die Fokusrückgabe aus.
  halten: false,
  loesen: null as null | (() => void),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die HTTP-Grenze stillgelegt (Bauform aus `tests/app/mega47-modale-flaechen-sammler.test.tsx`):
// jeder Endpunkt liefert eine leere Liste, ausser den wenigen, die diese Fläche entstehen lassen.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORT = {
    result: {
      answered: true,
      answer: "Ventil V4 wird jährlich geprüft.",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
      captionSources: [],
    },
    gap: null,
    receipt: "r",
  };
  const LUECKE = {
    result: {
      answered: false,
      answer: null,
      knowledgeClass: "unbekannt",
      trust: 0,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
      captionSources: [],
    },
    gap: { id: "g1" },
    receipt: "r",
  };
  const ANTWORTEN: Record<string, unknown> = {
    "reasoner.status": {
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { answer: true },
    },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async (arg: unknown) => {
        if (pfad === "ask.ask") {
          bestand.aufrufe.push(String(arg));
          // Erst BEIM EINTREFFEN gelesen: so entscheidet der Fall, was die schon laufende
          // Auffrischung am Ende bringt.
          const antwort = (): unknown => (bestand.lage === "luecke" ? LUECKE : ANTWORT);
          if (bestand.halten) {
            return new Promise((res) => {
              bestand.loesen = () => res(antwort());
            });
          }
          return antwort();
        }
        return ANTWORTEN[pfad] ?? [];
      }),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Seitenblatt } from "../../apps/web/src/components/start/Seitenblatt";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const FRAGE = "Wie oft wird Ventil V4 geprüft?";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

function breit(): void {
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
}

/** Die echte Shell mit der echten Provider-Kette — dieselbe Reihenfolge wie in `App.tsx`. */
async function render(inhalt: unknown, pfad = "/fragen"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root?.render(
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
                  { initialEntries: [pfad] },
                  createElement(AppShell, null, inhalt as never),
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

async function klick(el: Element | null | undefined): Promise<void> {
  expect(el, "Klickziel fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function taste(key: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await flush();
  });
}

/**
 * Stellt eine Frage über das ECHTE Formular — kein Hineinschreiben in den Zustand.
 *
 * AUSDRÜCKLICH auf `page-fragen` eingegrenzt: in der echten Shell steht VOR dem Fragefeld das
 * Suchfeld des Kopfbands. Ein `container.querySelector("input")` traf dieses — die Frage ging nie
 * ab, die Fläche blieb in ihrem Ausgangszustand, und die Fälle hätten eine ANDERE Lage geprüft als
 * die, die in ihrem Namen steht (beim Bauen gemessen).
 */
async function fragen(): Promise<void> {
  const seite = container.querySelector('[data-testid="page-fragen"]');
  expect(seite, "die Fragenfläche steht nicht in der Shell").not.toBeNull();
  const feld = seite?.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, FRAGE);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (seite?.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

const menuKnopf = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
const blatt = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="ask-mehr"]');

/** Der Klickfänger des Blatts: die Vollfläche unmittelbar VOR dem `<aside>` im selben Portal. */
function faenger(): HTMLElement | null {
  const b = blatt();
  const vor = b?.previousElementSibling;
  return vor instanceof HTMLElement ? vor : null;
}

/** Das „…" öffnen und „Mehr" wählen — der produktive Weg in das Blatt. */
async function blattOeffnen(): Promise<void> {
  const griff = menuKnopf();
  expect(griff, "es gibt keinen „…“-Griff").not.toBeNull();
  if (griff?.getAttribute("aria-expanded") !== "true") {
    await klick(griff);
  }
  await klick(container.querySelector('[data-testid="ask-menu-punkt-mehr"]'));
  expect(blatt(), "das Blatt ist nicht aufgegangen").not.toBeNull();
}

function knopfMitText(teil: string): HTMLElement | null {
  return (
    [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(teil)) ??
    null
  );
}

/**
 * Baut die verlangte Lage über den produktiven Weg auf und BELEGT sie: ohne diese Sonde wäre eine
 * Fläche, die stumm im Ausgangszustand stehen bleibt, von der geprüften Lage nicht zu unterscheiden.
 */
async function lageAufbauen(lage: "antwort" | "luecke"): Promise<void> {
  bestand.lage = lage;
  await render(createElement(Ask));
  await fragen();
  expect(bestand.aufrufe, "die Frage ist nie abgegangen").toEqual([FRAGE]);
  const karte = lage === "antwort" ? "ask-answer" : "ask-gap";
  expect(
    container.querySelector(`[data-testid="${karte}"]`),
    `Lage „${lage}“ nicht aufgebaut: keine Karte ${karte}`,
  ).not.toBeNull();
}

/** Lässt die zurückgehaltene Auffrischung eintreffen — mit der Lage, die gerade eingestellt ist. */
async function auffrischungEintreffen(): Promise<void> {
  expect(bestand.loesen, "es läuft gar keine zurückgehaltene Auffrischung").not.toBeNull();
  await act(async () => {
    bestand.loesen?.();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  breit();
  bestand.lage = "antwort";
  bestand.aufrufe = [];
  bestand.halten = false;
  bestand.loesen = null;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

// ================================================================================================
// A1–A4 · beide Lagen: die Antwortkarte (`Ask.tsx:1246`) UND der Lückenfall (`Ask.tsx:1831`).
// Es ist dasselbe Bauteil an zwei Orten; wäre das Verhalten nur an einem richtig, hinge es am Ort
// und nicht am Blatt.
// ================================================================================================
describe.each(["antwort", "luecke"] as const)("UX-06 · /fragen · Lage „%s“", (lage) => {
  it("A1: nach dem Öffnen steht der Fokus IM Blatt (heute: body)", async () => {
    await lageAufbauen(lage);
    await blattOeffnen();
    const b = blatt();
    expect(
      b?.contains(document.activeElement),
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> statt im Blatt — genau der Befund N-0010`,
    ).toBe(true);
    // Und zwar auf dem ERSTEN bedienbaren Element des Blatts, dem Schliessen-Knopf: im Befund war
    // das der VIERTE Tab-Halt.
    expect(document.activeElement?.getAttribute("aria-label")).toBe(i18n.t("cmd.close"));
  });

  it("A2: Escape schliesst das Blatt", async () => {
    await lageAufbauen(lage);
    await blattOeffnen();
    await taste("Escape");
    expect(blatt(), "Escape liess das Blatt offen").toBeNull();
  });

  it("A3a: nach Escape steht der Fokus wieder auf dem „…“-Knopf", async () => {
    await lageAufbauen(lage);
    const griffVorher = menuKnopf();
    await blattOeffnen();
    await taste("Escape");
    expect(document.activeElement).toBe(griffVorher);
  });

  it("A3b: dasselbe über den X-Knopf im Blatt", async () => {
    await lageAufbauen(lage);
    const griffVorher = menuKnopf();
    await blattOeffnen();
    const x = blatt()?.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`);
    await klick(x);
    expect(blatt()).toBeNull();
    expect(document.activeElement).toBe(griffVorher);
  });

  it("A3c: dasselbe über den Klickfänger", async () => {
    await lageAufbauen(lage);
    const griffVorher = menuKnopf();
    await blattOeffnen();
    await klick(faenger());
    expect(blatt()).toBeNull();
    expect(document.activeElement).toBe(griffVorher);
  });

  it("A4: solange das Blatt offen ist, liegt der übrige Bedienbereich inert — das Blatt nicht", async () => {
    await lageAufbauen(lage);
    // Kalibrierung: die Shell steht wirklich mit ihren Bereichen da, sonst prüfte der Fall eine
    // leere Menge.
    const bereiche = [...container.querySelectorAll<HTMLElement>("[data-modal-region]")];
    expect(bereiche.length, "keine angemeldeten Bereiche — die Grenze steht nicht").toBeGreaterThan(
      0,
    );
    expect(bereiche.every((r) => r.hasAttribute("inert"))).toBe(false);

    await blattOeffnen();
    expect(
      bereiche.every((r) => r.hasAttribute("inert")),
      "nicht jeder angemeldete Bereich ist gesperrt",
    ).toBe(true);
    expect(blatt()?.closest("[inert]"), "das Blatt selbst liegt im gesperrten Teilbaum").toBeNull();
    // Der Auslöser gehört zum Hintergrund und ist mit gesperrt.
    expect(menuKnopf()?.closest("[inert]")).not.toBeNull();

    await taste("Escape");
    expect(
      bereiche.some((r) => r.hasAttribute("inert")),
      "nach dem Schliessen bleibt eine Sperre hängen",
    ).toBe(false);
  });
});

// ================================================================================================
// A4 · DIE DREI KNÖPFE AUS DEM BEFUND. Sie gibt es nur mit einer Antwort — deshalb ein eigener Fall
// statt einer Zeile in der Matrix oben.
// ================================================================================================
describe("UX-06 · die im Befund N-0010 erreichbaren Knöpfe liegen hinter der Grenze", () => {
  it("Kopieren, Hat geholfen und Klara haben einen [inert]-Vorfahren, solange das Blatt offen ist", async () => {
    await lageAufbauen("antwort");
    const kopieren = knopfMitText(i18n.t("ask.export.copy"));
    const geholfen = knopfMitText(i18n.t("ask.helpful"));
    const klara = container.querySelector<HTMLElement>('[data-klara="1"]');
    expect(kopieren, "„Kopieren“ steht nicht auf der Fläche").not.toBeNull();
    expect(geholfen, "„Hat geholfen“ steht nicht auf der Fläche").not.toBeNull();
    expect(klara, "Klara steht nicht in der Shell").not.toBeNull();
    expect(kopieren?.closest("[inert]")).toBeNull();

    await blattOeffnen();
    expect(
      kopieren?.closest("[inert]"),
      "Tab 1 (Kopieren) ist weiterhin erreichbar",
    ).not.toBeNull();
    expect(
      geholfen?.closest("[inert]"),
      "Tab 2 (Hat geholfen) ist weiterhin erreichbar",
    ).not.toBeNull();
    expect(klara?.closest("[inert]"), "Tab 3 (Klara) ist weiterhin erreichbar").not.toBeNull();

    await taste("Escape");
    expect(kopieren?.closest("[inert]"), "die Sperre bleibt nach dem Schliessen hängen").toBeNull();
    expect(geholfen?.closest("[inert]")).toBeNull();
    expect(klara?.closest("[inert]")).toBeNull();
  });
});

// ================================================================================================
// §9 · WECHSEL BEI OFFENEM BLATT — A7.
// ================================================================================================
// KORREKTURPFLICHT 1 UND 2 (Ben, Runde 1). Runde 1 erklärte diesen Wechsel für „mit Maus und
// Tastatur nicht mehr auslösbar", weil das Fragefeld bei offenem Blatt gesperrt ist. DAS WAR
// FALSCH, und die falsche Begründung hielt einen echten Ausfall grün: eine Auffrischung, die VOR
// dem Öffnen gestartet wurde, läuft weiter und trifft ein, während das Blatt offen steht. Kein
// Eingriff von aussen, keine mechanische Nachhilfe — der Nutzer drückt Senden, sieht die alte
// Antwort stehen (§9: „Cache mit laufender Auffrischung"), öffnet „…" → „Mehr", und dann kommt die
// Wissenslücke.
//
// Gemessen (bens Gegenprobe an Runde 1): „BEN pending-first focus: ask-result-anchor inert: true",
// danach „BEN restore: DIV ask-result-anchor". Der Fokus lag also im GESPERRTEN Bereich, und Escape
// gab ihn dorthin zurück statt an das „…" — der Nutzer war mit der Tastatur draussen.
//
// Der Fall prüft deshalb VIER Dinge auf einmal, weil sie in diesem Ablauf zusammenhängen: genau ein
// Blatt, keine hängende Sperre, Fokus IM Blatt, und Rückgabe an den Menüknopf, den es JETZT gibt.
describe("UX-06 · A7: eine vor dem Öffnen gestartete Auffrischung trifft als Wissenslücke ein", () => {
  it("der Wechsel ist über Maus und Tastatur erreichbar — und danach ist alles noch bedienbar", async () => {
    await lageAufbauen("antwort");

    // 1. Auffrischung DERSELBEN Frage anstossen und in der Luft halten. Die Antwortkarte bleibt
    //    stehen (§9), das „…" der Karte ist der Auslöser.
    bestand.halten = true;
    bestand.lage = "luecke";
    await fragen();
    expect(bestand.aufrufe, "die Auffrischung ist nie abgegangen").toEqual([FRAGE, FRAGE]);
    expect(
      container.querySelector('[data-testid="ask-answer"]'),
      "die alte Antwort ist während der Auffrischung verschwunden",
    ).not.toBeNull();
    const griffVorher = menuKnopf();
    // DER ERREICHBARKEITSBELEG: nichts ist gesperrt, das „…" ist ganz normal anklickbar. Genau das
    // hatte Runde 1 bestritten.
    expect(
      griffVorher?.closest("[inert]"),
      "der „…“-Knopf wäre gar nicht erreichbar — dann wäre der Ablauf wirklich unauslösbar",
    ).toBeNull();

    // 2. Blatt über den produktiven Weg öffnen.
    await blattOeffnen();
    const bereiche = [...container.querySelectorAll<HTMLElement>("[data-modal-region]")];
    expect(bereiche.length, "keine angemeldeten Bereiche — die Grenze steht nicht").toBeGreaterThan(
      0,
    );

    // 3. Und JETZT trifft die Wissenslücke ein: das Blatt der Antwortkarte (`Ask.tsx:1246`) baut ab,
    //    das des Lückenfalls (`Ask.tsx:1831`) baut auf, und mit ihm wechselt der Menüort.
    await auffrischungEintreffen();
    expect(
      container.querySelector('[data-testid="ask-gap"]'),
      "die Wissenslücke ist nicht angekommen — der Wechsel hat gar nicht stattgefunden",
    ).not.toBeNull();

    expect(document.querySelectorAll('[data-testid="ask-mehr"]').length, "genau EIN Blatt").toBe(1);
    expect(blatt()?.closest("[inert]"), "das neue Blatt liegt im gesperrten Teilbaum").toBeNull();
    expect(
      bereiche.filter((r) => r.isConnected).every((r) => r.hasAttribute("inert")),
      "die Sperre ist beim Umzug verloren gegangen — die Grenze hat abgemeldet und nicht wieder an",
    ).toBe(true);
    // KORREKTURPFLICHT 1, erste Hälfte: der Fokus bleibt IM Blatt. Bis zur Korrektur holte ihn die
    // eingetroffene Antwort auf `ask-result-anchor` (`Ask.tsx`, „die Antwort muss ankommen") — in
    // einen Bereich, der in derselben Runde gesperrt wurde.
    expect(
      blatt()?.contains(document.activeElement),
      `Fokus liegt auf [data-testid="${document.activeElement?.getAttribute("data-testid")}"] statt im Blatt`,
    ).toBe(true);

    // 4. Der Menüknopf ist ein ANDERER als der, von dem aus geöffnet wurde — das ist der Kern.
    const griffJetzt = menuKnopf();
    expect(griffJetzt, "es gibt keinen „…“-Knopf mehr").not.toBeNull();
    expect(griffJetzt, "der Menüort hat gar nicht gewechselt — der Fall prüft nichts").not.toBe(
      griffVorher,
    );
    expect(griffVorher?.isConnected, "der alte Menüknopf steht noch im Baum").toBe(false);

    // KORREKTURPFLICHT 1, zweite Hälfte: Escape gibt die Bedienung an den Knopf zurück, den es
    // JETZT gibt.
    await taste("Escape");
    expect(blatt(), "Escape liess das Blatt offen").toBeNull();
    expect(document.activeElement).toBe(griffJetzt);
    expect(
      [...container.querySelectorAll("[inert]")],
      "nach dem Schliessen bleibt eine Sperre hängen",
    ).toEqual([]);
  });
});

// ================================================================================================
// A5 · DIE GEGENPROBE IN DIE ANDERE RICHTUNG.
// ================================================================================================
describe("UX-06 · das Blatt ohne Modalgrenze", () => {
  it("A5: nackt gemountet rendert, fokussiert und schliesst es ohne Wurf", async () => {
    let zu = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(Seitenblatt, {
          titel: "Nackt",
          testId: "nacktes-blatt",
          onSchliessen: () => {
            zu += 1;
          },
          children: createElement("p", null, "Inhalt"),
        }),
      );
      await flush();
    });
    const b = document.querySelector<HTMLElement>('[data-testid="nacktes-blatt"]');
    expect(b, "ohne Grenze rendert das Blatt gar nicht").not.toBeNull();
    // Der Anfangsfokus hängt NICHT an der Grenze: er ist die Sache des Blatts selbst.
    expect(b?.contains(document.activeElement)).toBe(true);
    await taste("Escape");
    expect(zu, "Escape wirkt ohne Grenze nicht").toBe(1);
    // Und der Abbau wirft nicht (`useModalBoundary` würde hier werfen — deshalb die Optional-Form).
    await act(async () => {
      root?.unmount();
      await flush();
    });
    root = null;
    container.remove();
  });
});
