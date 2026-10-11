// @vitest-environment jsdom
// ================================================================================================
// ASSISTENZ IM PRODUKT (produkt:20261010:assistenz-produkteinstieg) — DER NORMALE EINSTIEG GEGEN DEN
// ECHTEN SERVER, OHNE VORSCHAU-AUFRUF.
// ================================================================================================
//
// Dieselbe Montage wie `tests/klara-basis/klara-echt-am-server.test.tsx` (echte Hülle, echte App im
// selben Prozess über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts`, echte Anmeldung, echte
// Gesprächsablage `/api/me/klara/...`) — mit EINEM Unterschied: Der Vorschau-Schalter bleibt aus,
// und im Sitzungsspeicher steht nichts. Gemessen wird, was eine normal angemeldete Person sieht.
//
// „Neuladen“ ist hier wie dort: Hülle abbauen, den Gesprächsspeicher des Browsers vergessen, neu
// montieren. Ein echtes Neuladen des Browsers, Layout, 390 × 844 und die Tastatur misst
// `tests-smoke/assistenz-produkteinstieg-browser.spec.ts`. Alle Konten und Inhalte sind fiktiv.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { eingabeZuruecksetzen } from "../../apps/web/src/components/klara-vorschau/eingabe";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import {
  ANFANG,
  aendere,
  leseZustand,
  nachVorschauEnde,
  zuruecksetzenGanz,
} from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { alle, bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";
import { hilfePanelLabel, hilfeknopfLabel } from "../support/hilfeknopf";

adapterUmgebungSetzen();

/** Trägt nur Begriffe, die der Ketteneintrag wirklich führt (siehe klara-echt-am-server.test.tsx). */
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
  eingabeZuruecksetzen();
  vergiss();
  // Ausdrücklich: KEIN Vorschau-Schalter, kein Profil.
  setzeKlaraVorschauAktiv(false);
  setzeAssistenzProfil(null);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  setzeAssistenzProfil(null);
  eingabeZuruecksetzen();
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

async function vorrichtung(): Promise<void> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  await eintragMitOriginal(a.app, a.admin);
  const leser = await neuesKonto(a.app, "assistenz-produkt", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
}

/** Die echte Hülle mit einer Seite und einem Link zu Fragen — für den Seitenwechsel. */
async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const testkennung: object = { "data-testid": "zu-fragen" };
  const seite = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(Link, { to: "/fragen", ...testkennung }, "Zu Fragen"),
  );
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
                  { initialEntries: [pfad] },
                  createElement(AppShell, null, seite),
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
}

async function gespraechOeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
}

function hilfeKnopf(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `button[data-klara="1"][aria-label="${hilfeknopfLabel()}"]`,
  );
}

function hilfeFlaeche(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `section[data-klara="1"][aria-label="${hilfePanelLabel()}"]`,
  );
}

function eingabe(): HTMLInputElement {
  const e = q<HTMLInputElement>(document, "klara-eingabe");
  if (!e) {
    throw new Error("Eingabe der Assistenz fehlt");
  }
  return e;
}

function nachrichten(): HTMLElement[] {
  return alle(document, "klara-nachricht");
}

describe("K1/K5 · ohne Vorschau-Aufruf sichtbar, verständlich und neutral beschriftet", () => {
  it.each(["/", "/fragen", "/wissen"])(
    "auf %s steht die Assistenz im Produktbetrieb — neben dem Hilfeknopf",
    async (pfad) => {
      await vorrichtung();
      await montiere(pfad);
      expect(sessionStorage.getItem("klarwerk.klaraVorschau.aktiv")).toBeNull();
      const f = q<HTMLButtonElement>(document, "klara-figur");
      expect(f?.dataset.betriebsart).toBe("produkt");
      expect(f?.dataset.betrieb).toBe("echt");
      expect(q(document, "klara-figur-name")?.textContent).toBe("Deine Assistenz");
      expect(f?.getAttribute("aria-label")).toBe(
        "Deine Assistenz – persönliches Gespräch öffnen oder schließen",
      );
      expect(q(document, "klara-figur-demo")).toBeNull();
      expect(hilfeKnopf()).not.toBeNull();
    },
  );

  it("ein vorhandenes Profil liefert Name und Avatar; eine fremde Avataradresse wird nicht geladen", async () => {
    await vorrichtung();
    setzeAssistenzProfil({ name: "  Mira  ", avatarUrl: "/klara/klara-avatar-v1.png" });
    await montiere("/");
    expect(q(document, "klara-figur-name")?.textContent).toBe("Mira");
    expect(q(document, "klara-figur")?.getAttribute("aria-label")).toContain("Mira");
    expect(q(document, "klara-avatar")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");
    await gespraechOeffnen();
    expect(q(document, "klara-panel-titel")?.textContent).toBe("Mira");

    await act(async () => {
      setzeAssistenzProfil({ name: "Mira", avatarUrl: "https://fremd.example/bild.png" });
    });
    expect(q(document, "klara-avatar")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");
    await act(async () => {
      setzeAssistenzProfil({ name: "Mira", avatarUrl: "//fremd.example/bild.png" });
    });
    expect(q(document, "klara-avatar")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");

    // Kein Profil (mehr): neutral.
    await act(async () => {
      setzeAssistenzProfil(null);
    });
    expect(q(document, "klara-panel-titel")?.textContent).toBe("Deine Assistenz");
  });
});

describe("K2/K4 · echtes persönliches Gespräch: Öffnen, Seitenwechsel, Minimieren, Neuladen", () => {
  it("das bestehende Gespräch kommt vom Server zurück; Bezug und angefangene Eingabe bleiben", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    expect(q(document, "klara-echt-hinweis")?.dataset.laden).toBe("bereit");

    // Ein persönliches Gespräch entsteht über den echten Frageweg.
    await klick(q(document, "klara-einwilligung-erteilen"));
    await bis(() => Boolean(q(document, "klara-einwilligung-erteilt")), 120);
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await bis(() => {
      const klara = nachrichten().filter((n) => n.dataset.von === "klara");
      const letzte = klara[klara.length - 1];
      return Boolean(letzte && letzte.dataset.gespeichert === "ja");
    }, 240);
    expect(nachrichten()).toHaveLength(2);
    expect(draht.aufrufe.some((x) => x.url === "/api/ask")).toBe(true);

    // Neuladen: das bestehende Gespräch öffnet wieder — dieselben zwei Nachrichten vom Server.
    abbauen();
    vergiss();
    await montiere("/");
    await gespraechOeffnen();
    expect(q(document, "klara-echt-hinweis")?.dataset.laden).toBe("bereit");
    expect(nachrichten()).toHaveLength(2);
    expect(nachrichten()[0]?.textContent).toContain(GEDECKTE_FRAGE);
    // Die Antwort trägt den neutralen Namen, nicht „Klara“ (kein Profil).
    expect(nachrichten()[1]?.textContent).toContain("Deine Assistenz");

    // Auswahl des Bezugs und eine angefangene Eingabe.
    await klick(q(document, "klara-bezug-frei"));
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("frei");
    await tippe(eingabe(), "Angefangene Frage, noch nicht gesendet");

    // Seitenwechsel: dieselbe Fläche, derselbe Verlauf, neuer Seitenkontext.
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen");
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Fragen");
    expect(nachrichten()).toHaveLength(2);
    expect(eingabe().value).toBe("Angefangene Frage, noch nicht gesendet");

    // Minimieren und erneut öffnen.
    await klick(q(document, "klara-minimieren"));
    expect(q(document, "klara-gespraech")).toBeNull();
    expect(q(document, "klara-figur")?.dataset.minimiert).toBe("true");
    await gespraechOeffnen();
    expect(eingabe().value).toBe("Angefangene Frage, noch nicht gesendet");
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("frei");

    // Schliessen, Neuladen, wieder öffnen: Gespräch, Bezug und Eingabe sind noch da.
    await klick(q(document, "klara-schliessen"));
    abbauen();
    vergiss();
    await montiere("/fragen");
    await gespraechOeffnen();
    expect(nachrichten()).toHaveLength(2);
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("frei");
    expect(eingabe().value).toBe("Angefangene Frage, noch nicht gesendet");
    // Es gibt genau EIN Gespräch in der Oberfläche.
    expect(alle(document, "klara-gespraech")).toHaveLength(1);
  });
});

describe("K2/K6 · nie zwei offene Flächen: Assistenz und Hilfeknopf schliessen einander", () => {
  it("Hilfe öffnen schliesst das Gespräch und lässt die Figur zurücktreten; danach öffnet das Gespräch wieder mit der Eingabe", async () => {
    await vorrichtung();
    await montiere("/fragen");
    await gespraechOeffnen();
    await tippe(eingabe(), "Bleibt stehen");

    await klick(hilfeKnopf());
    await bis(() => Boolean(hilfeFlaeche()));
    expect(hilfeFlaeche()).not.toBeNull();
    expect(q(document, "klara-gespraech")).toBeNull();
    // Die Figur liegt nicht über der Hilfefläche.
    await bis(() => q(document, "klara-figur-huelle")?.dataset.zurueckgetreten === "true");
    expect(q(document, "klara-figur-huelle")?.dataset.zurueckgetreten).toBe("true");

    // Hilfe schliessen (derselbe Knopf) — die Figur ist wieder da.
    await klick(hilfeKnopf());
    await bis(() => !hilfeFlaeche());
    await bis(() => q(document, "klara-figur-huelle")?.dataset.zurueckgetreten === "false");
    expect(q(document, "klara-figur-huelle")?.dataset.zurueckgetreten).toBe("false");

    await gespraechOeffnen();
    expect(alle(document, "klara-gespraech")).toHaveLength(1);
    expect(eingabe().value).toBe("Bleibt stehen");

    // Und umgekehrt: Hilfe öffnen, während das Gespräch offen ist — es schliesst sich.
    await klick(hilfeKnopf());
    await bis(() => Boolean(hilfeFlaeche()));
    expect(q(document, "klara-gespraech")).toBeNull();
  });
});

describe("K2/K3 · Vorschau-Ende verwirft nur den Vorschau-Anteil (nachVorschauEnde)", () => {
  const seite = { pfad: "/wissen/ko-1", seite: "wissen" as const, seitenName: "W", objekt: "O" };
  const fiktiv = {
    pfad: "/klara-vorschau/a",
    seite: "artikel" as const,
    seitenName: "A",
    objekt: "F",
  };

  it("eine echte Markierung, ihr Bezug und das Konto bleiben; Demo-Verlauf, Entwurf und Demo-Betrieb gehen", () => {
    const z = nachVorschauEnde({
      ...ANFANG,
      kontoId: "u-1",
      betrieb: "demo",
      bezug: "markierung",
      auswahl: { id: "a", text: "echt", herkunft: seite },
      verlauf: [{ id: "d", von: "klara", text: "x", herkunft: fiktiv, demo: true }],
      entwurf: {
        id: "e",
        art: "notiz",
        inhalt: "x",
        herkunft: fiktiv,
        erinnerung: "",
        termin: "",
        gespeichert: false,
      },
      artikelText: { "a#1": "x" },
      geparkt: { artikelId: "a", absatz: 1 },
    });
    expect(z.kontoId).toBe("u-1");
    expect(z.auswahl?.text).toBe("echt");
    expect(z.bezug).toBe("markierung");
    expect(z.betrieb).toBe("echt");
    expect(z.verlauf).toEqual([]);
    expect(z.entwurf).toBeNull();
    expect(z.artikelText).toEqual({});
    expect(z.geparkt).toBeNull();
  });

  it("eine Markierung aus einem fiktiven Artikel geht — der Bezug fällt dann gültig auf „Seite“; „frei“ bleibt „frei“", () => {
    const mitFiktiv = { ...ANFANG, bezug: "markierung" as const };
    const z = nachVorschauEnde({ ...mitFiktiv, auswahl: { id: "a", text: "f", herkunft: fiktiv } });
    expect(z.auswahl).toBeNull();
    expect(z.bezug).toBe("seite");
    expect(nachVorschauEnde({ ...ANFANG, bezug: "frei" }).bezug).toBe("frei");
  });
});

describe("K3/K4 · Produktbetrieb ohne Demo; offene Ausbaustufen benannt; Vorschau getrennt", () => {
  it("kein Demo-Schalter, kein Vorschau-Ende, keine vorgefertigten Aktionen — dafür ein Link in die gekennzeichnete Vorschau", async () => {
    await vorrichtung();
    // Selbst ein in der Vorschau gewählter Demo-Betrieb gilt im Produkt nicht.
    aendere((z) => ({ ...z, betrieb: "demo" }));
    await montiere("/");
    await gespraechOeffnen();
    expect(q(document, "klara-betrieb")?.dataset.betrieb).toBe("echt");
    expect(q(document, "klara-betrieb-demo")).toBeNull();
    expect(q(document, "klara-betrieb-echt")).toBeNull();
    expect(q(document, "klara-demo-hinweis")).toBeNull();
    expect(q(document, "klara-beenden")).toBeNull();
    expect(q(document, "klara-entwurf")).toBeNull();
    expect(q(document, "klara-panel-titel")?.textContent).toBe("Deine Assistenz");
    expect(eingabe().placeholder).toBe("Frag etwas …");
    expect(document.querySelector(`label[for="${eingabe().id}"]`)?.textContent).toBe("Deine Frage");
    expect(q(document, "klara-echt-leer")).not.toBeNull();
    expect(q(document, "klara-echt-leer")?.textContent ?? "").not.toContain("Klara");
    expect(q(document, "klara-offen")?.textContent).toContain("noch in Arbeit");
    const link = q<HTMLAnchorElement>(document, "klara-zur-vorschau");
    expect(link?.getAttribute("href")).toBe("/klara-vorschau");
    // Gelieferte Funktionen bleiben erreichbar: Bezug, Hilfe zur Seite, Sprache, Bedienhilfe.
    for (const id of ["klara-bezug", "klara-modi", "klara-bedienhilfe", "klara-eingabe-form"]) {
      expect(q(document, id), id).not.toBeNull();
    }
    expect(q(document, "klara-bedienhilfe-sprache")).not.toBeNull();
    // Die Bedienhilfe sagt nicht, „Demo“ sei hier ein Betrieb.
    expect(q(document, "klara-bedienhilfe")?.textContent).not.toContain("„Demo“ zeigt");
  });

  it("mit eingeschalteter Vorschau bleibt alles wie geliefert: Demo-Schalter und „Vorschau beenden“", async () => {
    await vorrichtung();
    setzeKlaraVorschauAktiv(true);
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    expect(q(document, "klara-figur")?.dataset.betriebsart).toBe("vorschau");
    expect(q(document, "klara-betrieb-demo")).not.toBeNull();
    expect(q(document, "klara-beenden")).not.toBeNull();
    expect(hilfeKnopf()).toBeNull();

    // „Vorschau beenden“ führt in den Produktbetrieb zurück — die Assistenz bleibt sichtbar.
    await klick(q(document, "klara-beenden"));
    await bis(() => q(document, "klara-figur")?.dataset.betriebsart === "produkt", 200);
    expect(q(document, "klara-figur")?.dataset.betriebsart).toBe("produkt");
    expect(sessionStorage.getItem("klarwerk.klaraVorschau.aktiv")).toBeNull();
    expect(hilfeKnopf()).not.toBeNull();
  });

  it("Produkt → Vorschau → „Vorschau beenden“: angefangene Frage und Bezugsauswahl bleiben, auch nach Neuladen; Demo-Anteil geht", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await klick(q(document, "klara-bezug-frei"));
    await tippe(eingabe(), "Persönliche Frage, noch nicht gesendet");

    // In die Vorschau wechseln (wie der Link im Fuss) und dort einen Demo-Verlauf anlegen.
    abbauen();
    setzeKlaraVorschauAktiv(true);
    aendere((z) => ({
      ...z,
      betrieb: "demo",
      verlauf: [
        {
          id: "demo-1",
          von: "klara",
          text: "Demo-Antwort",
          herkunft: { pfad: "/klara-vorschau", seite: "uebersicht", seitenName: "V", objekt: "O" },
          demo: true,
        },
      ],
    }));
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    expect(eingabe().value).toBe("Persönliche Frage, noch nicht gesendet");

    await klick(q(document, "klara-beenden"));
    await bis(() => q(document, "klara-figur")?.dataset.betriebsart === "produkt", 200);
    await gespraechOeffnen();
    expect(eingabe().value).toBe("Persönliche Frage, noch nicht gesendet");
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("frei");
    expect(leseZustand().verlauf).toEqual([]);
    expect(leseZustand().betrieb).toBe("echt");

    // Neuladen: der Sitzungsspeicher trägt beides weiter.
    expect(sessionStorage.getItem("klarwerk.assistenz.eingabe")).toContain(
      "Persönliche Frage, noch nicht gesendet",
    );
    abbauen();
    vergiss();
    await montiere("/");
    await gespraechOeffnen();
    expect(eingabe().value).toBe("Persönliche Frage, noch nicht gesendet");
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("frei");
  });
});
