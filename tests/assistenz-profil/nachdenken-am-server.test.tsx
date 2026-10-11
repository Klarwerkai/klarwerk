// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:assistenz-avatarzustaende · NACHDENKEN, ABBRUCH UND VERSPÄTETE ERGEBNISSE AM
// ECHTEN FRAGEWEG (Ben, nacharbeit-1).
// ================================================================================================
//
// Die echte Hülle mit der echten Assistenz gegen die ECHTE App im selben Prozess (Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts`, wie `tests/klara-basis/klara-echt-am-server.test.tsx`).
// Gemessen wird der Zustand der Figur (`data-zustand`) an den tatsächlichen Phasen des Fragewegs:
//
//   N1  Frage wird am Server abgelegt → „warten“; erst wenn die abgelegte Frage am Frageweg
//       (`POST /api/ask`) bearbeitet wird → „nachdenken“ (Text „Verarbeitet die Anfrage“);
//       „Anfrage stoppen“ beendet das Nachdenken → „pause“.
//   N2  Nachdenken endet mit dem Ergebnis: Antwort ohne geprüfte Quelle → Fehler „quelle“.
//   N3  Nachdenken endet mit dem Ergebnis: belegte KI-Antwort → Freude → von selbst Bereit.
//   N4  Nachdenken endet mit einem Fehler des Fragewegs → Fehler „technisch“.
//   N5  Schnelle Folgeaktion: Frage 1 gestoppt, ihr Abschluss am Server verspätet sich; Frage 2
//       läuft schon. Das späte Ende von Frage 1 überschreibt weder Status noch Ausdruck von
//       Frage 2 (kein „pause“), Frage 2 bestimmt ihr eigenes Ergebnis.
//
// TRANSPORT-ATTRAPPEN, ausdrücklich: Riegel halten einzelne Anfragen an (Ablage der Frage,
// `/api/ask`, der Abschlussschritt von Frage 1) und reichen sie danach an den ECHTEN Server weiter;
// ein Frageweg reagiert erst auf den Abbruch; einer antwortet mit 500. Zeitpunkte lassen sich am
// echten Server nicht auf Kommando herstellen. Nichts ist zeitgesteuert vorgetäuscht.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import { meldeErgebnis } from "../../apps/web/src/components/assistenz/ausdruck";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { leseEcht, vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

/** Wie in `klara-echt-am-server.test.tsx`: eine Frage, deren Begriffe der Ketteneintrag trägt. */
const GEDECKTE_FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?";

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  meldeErgebnis(null);
  setzeKlaraVorschauAktiv(true);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  meldeErgebnis(null);
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
  draht.aufrufe.length = 0;
});

async function vorrichtung(mitEintrag: boolean): Promise<Aufbau> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  if (mitEintrag) {
    await eintragMitOriginal(a.app, a.admin);
  }
  const leser = await neuesKonto(a.app, "assistenz-nachdenken", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return a;
}

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    r.render(
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
                  { initialEntries: ["/klara-vorschau"] },
                  createElement(AppShell, null, createElement("div", { "data-testid": "seite" })),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "klara-figur")), 200);
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
  await klick(q(document, "klara-einwilligung-erteilen"));
  await bis(() => Boolean(q(document, "klara-einwilligung-erteilt")), 120);
  expect(q(document, "klara-einwilligung-erteilt"), "Einwilligung nicht bestätigt").not.toBeNull();
}

async function fragen(text: string): Promise<void> {
  const eingabe = q<HTMLInputElement>(document, "klara-eingabe");
  if (!eingabe) {
    throw new Error("Eingabe fehlt");
  }
  await tippe(eingabe, text);
  await bis(() => !q<HTMLButtonElement>(document, "klara-senden")?.disabled, 120);
  await klick(q(document, "klara-senden"));
}

const zustand = (): string | undefined => q(document, "klara-figur")?.dataset.zustand;
const fehlerart = (): string | undefined => q(document, "klara-figur")?.dataset.fehlerart;
const status = (): string | undefined => q(document, "klara-figur")?.dataset.status;
const zustandText = (): string => q(document, "klara-figur-zustand")?.textContent ?? "";

/** Ein Riegel: hält eine Anfrage an, bis `auf()` gerufen wird. */
function riegel(): { auf: () => void; offen: Promise<void> } {
  let auf = (): void => {};
  const offen = new Promise<void>((r) => {
    auf = r;
  });
  return { auf, offen };
}

type Regel = (
  url: string,
  init: RequestInit | undefined,
  weiter: () => Promise<Response>,
) => Promise<Response> | null;

/** Fängt einzelne Anfragen ab; alles andere geht unverändert an den echten Server. */
function abfangen(regel: Regel): void {
  const vorher = globalThis.fetch;
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    const weiter = (): Promise<Response> => vorher(eingabe as RequestInfo, init);
    return regel(String(eingabe), init, weiter) ?? weiter();
  }) as typeof globalThis.fetch;
  globalThis.fetch = neu;
  window.fetch = neu;
}

function rumpf(init: RequestInit | undefined): string {
  return typeof init?.body === "string" ? init.body : "";
}

/** Ein Abbruch des Fragewegs wie im Browser: der Abruf scheitert mit AbortError. */
function beiAbbruch(init: RequestInit | undefined, ablehnen: (e: unknown) => void): void {
  init?.signal?.addEventListener("abort", () =>
    ablehnen(new DOMException("abgebrochen", "AbortError")),
  );
}

describe("N1 · Warten → Nachdenken → Abbruch", () => {
  it("Nachdenken erst, wenn die abgelegte Frage am Frageweg bearbeitet wird; Stopp beendet es", async () => {
    await vorrichtung(true);
    await montiere();
    const ablage = riegel();
    let askGerufen = false;
    abfangen((url, init, weiter) => {
      if (url.endsWith("/nachrichten") && rumpf(init).includes('"modus":"frage"')) {
        return ablage.offen.then(weiter);
      }
      if (url === "/api/ask") {
        askGerufen = true;
        return new Promise<Response>((_, ablehnen) => beiAbbruch(init, ablehnen));
      }
      return null;
    });
    await fragen("Eine Frage, die lange bearbeitet wird");
    // Die Frage wird noch abgelegt: Warten, nicht Nachdenken.
    await bis(() => zustand() === "warten", 120);
    expect(zustand()).toBe("warten");
    expect(askGerufen).toBe(false);
    expect(leseEcht().verarbeitetSeit).toBeNull();

    ablage.auf();
    await bis(() => askGerufen && zustand() === "nachdenken", 160);
    expect(zustand()).toBe("nachdenken");
    expect(leseEcht().verarbeitetSeit).not.toBeNull();
    expect(zustandText()).toBe("Verarbeitet die Anfrage");
    expect(status()).toBe("laeuft");

    await klick(q(document, "klara-stoppen"));
    await bis(() => zustand() === "pause", 160);
    expect(zustand()).toBe("pause");
    expect(leseEcht().verarbeitetSeit).toBeNull();
    expect(zustandText()).toBe("Pausiert");
  });
});

describe("N2/N3/N4 · Nachdenken endet mit Ergebnis oder Fehler", () => {
  it("N2 · Antwort ohne geprüfte Quelle: Nachdenken endet, Fehler „quelle“, keine Freude", async () => {
    await vorrichtung(false);
    await montiere();
    const frageweg = riegel();
    abfangen((url, _init, weiter) => (url === "/api/ask" ? frageweg.offen.then(weiter) : null));
    // Ohne jeden Eintrag hat der Frageweg keine Grundlage (`answered: false`).
    await fragen("Welche Farbe hat das Leitblech VZ17 im Lager Nord?");
    await bis(() => zustand() === "nachdenken", 160);
    expect(zustand()).toBe("nachdenken");
    frageweg.auf();
    await bis(() => zustand() !== "nachdenken" && zustand() !== "warten", 200);
    const letzte = leseEcht()
      .nachrichten.filter((n) => n.von === "klara")
      .slice(-1)[0];
    expect(letzte?.modus, "der Frageweg hat ohne Grundlage geantwortet").toBe("ohne_ki");
    expect(zustand()).toBe("fehler");
    expect(fehlerart()).toBe("quelle");
    expect(zustandText()).toContain("Keine geprüfte Quelle");
    expect(leseEcht().verarbeitetSeit).toBeNull();
  });

  it("N3 · belegte KI-Antwort: Nachdenken endet mit Freude, danach von selbst Bereit", async () => {
    await vorrichtung(false);
    await montiere();
    if (aufbau) {
      await eintragMitOriginal(aufbau.app, aufbau.admin);
    }
    const frageweg = riegel();
    abfangen((url, _init, weiter) => (url === "/api/ask" ? frageweg.offen.then(weiter) : null));
    await fragen(GEDECKTE_FRAGE);
    await bis(() => zustand() === "nachdenken", 160);
    expect(zustand()).toBe("nachdenken");
    frageweg.auf();
    await bis(() => zustand() === "freude", 200);
    expect(zustand(), `Antwortart: ${leseEcht().nachrichten.slice(-1)[0]?.modus}`).toBe("freude");
    await bis(() => zustand() === "bereit", 160);
    expect(zustand()).toBe("bereit");
  });

  it("N4 · Fehler des Fragewegs: Nachdenken endet, Fehler „technisch“ mit Text", async () => {
    await vorrichtung(true);
    await montiere();
    const frageweg = riegel();
    abfangen((url) =>
      url === "/api/ask"
        ? frageweg.offen.then(
            () =>
              new Response(JSON.stringify({ error: "INTERNAL", message: "kaputt" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }),
          )
        : null,
    );
    await fragen("Eine Frage, die scheitert");
    await bis(() => zustand() === "nachdenken", 160);
    expect(zustand()).toBe("nachdenken");
    frageweg.auf();
    await bis(() => zustand() === "fehler", 200);
    expect(fehlerart()).toBe("technisch");
    expect(zustandText()).toContain("Fehlgeschlagen");
    expect(leseEcht().verarbeitetSeit).toBeNull();
  });
});

describe("N5 · schnelle Folgeaktion: das späte Ende einer alten Frage überschreibt die neue nicht", () => {
  it("Frage 1 gestoppt, ihr Abschluss verspätet; Frage 2 denkt nach und endet mit eigenem Ergebnis", async () => {
    await vorrichtung(true);
    await montiere();
    const abschlussFrage1 = riegel();
    const frageweg2 = riegel();
    let askAufrufe = 0;
    let abschlussGehalten = false;
    abfangen((url, init, weiter) => {
      if (url.endsWith("/schritt") && rumpf(init).includes('"stand":"abgebrochen"')) {
        abschlussGehalten = true;
        return abschlussFrage1.offen.then(weiter);
      }
      if (url === "/api/ask") {
        askAufrufe += 1;
        if (askAufrufe === 1) {
          return new Promise<Response>((_, ablehnen) => beiAbbruch(init, ablehnen));
        }
        return frageweg2.offen.then(
          () =>
            new Response(JSON.stringify({ error: "INTERNAL", message: "kaputt" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
        );
      }
      return null;
    });

    await fragen("Frage eins");
    await bis(() => zustand() === "nachdenken", 160);
    await klick(q(document, "klara-stoppen"));
    // Frage 1 ist abgebrochen und im Gespräch abgelegt; ihr Abschlussschritt hängt noch am Server.
    await bis(() => abschlussGehalten, 160);
    expect(abschlussGehalten).toBe(true);

    // Sofort die nächste Frage.
    await fragen("Frage zwei");
    await bis(() => askAufrufe === 2 && zustand() === "nachdenken", 160);
    expect(zustand()).toBe("nachdenken");

    // Jetzt endet Frage 1 verspätet — ihr Ergebnis (Pause) darf Frage 2 nicht überschreiben.
    abschlussFrage1.auf();
    await ruhe(40);
    expect(zustand(), "das späte Ende von Frage 1 überschreibt Frage 2").toBe("nachdenken");
    expect(status()).toBe("laeuft");

    // Frage 2 bestimmt ihr eigenes Ergebnis.
    frageweg2.auf();
    await bis(() => zustand() === "fehler", 200);
    expect(zustand()).toBe("fehler");
    expect(fehlerart()).toBe("technisch");
    await ruhe(20);
    expect(zustand()).toBe("fehler");
  });
});
