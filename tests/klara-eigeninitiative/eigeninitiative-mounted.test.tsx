// @vitest-environment jsdom
// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) — UNTERSTÜTZUNG UND EIGENINITIATIVE, IN DER
// ECHTEN KLARA GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten Klara, über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts` verbunden mit der ECHTEN App im selben Prozess:
// Anmeldung, Assistenzprofil mit Unterstützungsmodus, Gesprächsablage und Auftragsgrenze (Klara 05).
//
// „NEULADEN“ heisst hier: Klara wird abgebaut, alles im Browserspeicher Gehaltene vergessen
// (Gespräch, Klara-Zustand, Modus samt Tab-Speicher) und neu montiert — mit derselben oder einer
// NEUEN Anmeldung. Was danach dasteht, kam vom Server. Echtes Layout, echte Zeitabläufe über Stunden
// und eine echte Person misst diese Datei nicht.
//
//   M1 · K1/K4  Die drei Modi sind mit Erklärung wählbar; die Wahl wird gespeichert und gilt nach
//               Neuladen und neuer Anmeldung; ein zweites Konto sieht seine eigene Vorgabe.
//   M2 · K2     „Nur auf Nachfrage“: kein Hinweis, keine Anfrage, die etwas schreibt. „Passende
//               Hinweise“: ein Hinweis aus dem Kontext, der selbst nichts ausführt — erst der Klick
//               auf das Angebot öffnet Klara mit der vorhandenen Hilfe.
//   M3 · K3     „Später“ und „Nicht mehr anbieten“ lassen den Hinweis ruhen — auch nach Neuladen;
//               ein unbeantworteter Hinweis kommt in derselben Sitzung nicht wieder.
//   M4 · K2/K4  „Ausdrücklich übertragene Aufgaben“: kein Hinweis; die selbst erteilte Aufgabe steht
//               sichtbar mit ihrem Stand da, die Figur zählt offene — auch nach dem Neuladen.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeEigeninitiative } from "../../apps/web/src/lib/klaraEigeninitiative";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import {
  alle,
  bis,
  klick,
  medienStub,
  q,
  ruhe,
  tippe,
  warte,
} from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASIS = "/api/me/assistenz/eigeninitiative";
/** Länger als der Verzug, nach dem ein Hinweis erscheint (`HINWEIS_VERZUG_MS`, 1,5 s). */
const UEBER_VERZUG_MS = 2200;

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let drahtFetch: typeof globalThis.fetch;
/** Jede schreibende Anfrage des Browsers an die eigene App: „METHODE /api/…“. */
let schreibend: string[] = [];

beforeAll(() => {
  draht = drahtAufbauen();
  drahtFetch = globalThis.fetch;
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterAll(() => {
  draht.abbauen();
});

function netzMitProtokoll(): void {
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode !== "GET" && url.startsWith("/api/")) {
      schreibend.push(`${methode} ${url}`);
    }
    return drahtFetch(eingabe as RequestInfo, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = neu;
  window.fetch = neu;
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  verwerfeEigeninitiative();
  setzeKlaraVorschauAktiv(true);
  medienStub();
  schreibend = [];
  netzMitProtokoll();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = drahtFetch;
  window.fetch = drahtFetch;
  vergiss();
  verwerfeEigeninitiative();
  setzeKlaraVorschauAktiv(false);
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

/** Neuladen: nichts aus dem Browserspeicher bleibt, nur der Server. */
function neuLaden(): void {
  abbauen();
  vergiss();
  zuruecksetzenGanz();
  verwerfeEigeninitiative();
  sessionStorage.clear();
}

async function app(): Promise<Aufbau> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  return a;
}

function alsKonto(k: Konto): void {
  draht.setzeCookie(`kw_session=${k.token}`);
}

/** Eine NEUE Anmeldung desselben Kontos (zweites Gerät, nächster Tag). */
async function neuAnmelden(a: Aufbau, k: Konto): Promise<Konto> {
  const r = await a.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: k.email, password: "geheim12345" },
  });
  expect(r.statusCode, r.body).toBe(200);
  const token = (r.json() as { token: string }).token;
  expect(token).not.toBe(k.token);
  return { email: k.email, token, kopf: { authorization: `Bearer ${token}` } };
}

async function montiere(pfad = "/fragen"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const inhalt = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/fragen",
        element: createElement("div", { "data-testid": "seite-fragen" }),
      }),
      createElement(Route, {
        path: "/erfassen",
        element: createElement("div", { "data-testid": "seite-erfassen" }),
      }),
    ),
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
                  createElement(AppShell, null, inhalt),
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

/**
 * Was im Namen der Person etwas am Bestand oder im Gespräch ändern würde: Klara-Gespräch und
 * -Aufträge, Assistenzprofil samt Modus und Hinweisablage, Entwürfe.
 */
function handlungen(): string[] {
  return schreibend.filter((s) => /\/api\/(me\/klara|me\/assistenz|drafts)/.test(s));
}

async function gespraechAmServer(a: Aufbau, k: Konto): Promise<{ nachrichten: unknown[] } | null> {
  const r = await a.app.inject({ method: "GET", url: "/api/me/klara/gespraech", headers: k.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { gespraech: { nachrichten: unknown[] } | null }).gespraech;
}

async function klaraOeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => q(document, "klara-echt-hinweis")?.dataset.laden === "bereit", 200);
}

/** Wartet, bis der Modus vom Server gelesen ist (Wahl im geöffneten Gespräch). */
async function bisModusGelesen(): Promise<void> {
  await bis(() => q(document, "klara-eigeninitiative")?.dataset.stand === "bereit", 200);
}

function modus(): string {
  return q(document, "klara-eigeninitiative")?.dataset.modus ?? "";
}

async function waehle(m: "nachfrage" | "hinweise" | "auftraege"): Promise<void> {
  const knopf = q(document, `klara-eigeninitiative-${m}`)?.querySelector("input");
  await klick(knopf);
  await bis(() => modus() === m, 200);
}

async function serverModus(a: Aufbau, k: Konto): Promise<{ modus: string; hinweise: unknown[] }> {
  const r = await a.app.inject({ method: "GET", url: BASIS, headers: k.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { modus: string; hinweise: unknown[] };
}

async function setzeServerModus(a: Aufbau, k: Konto, m: string): Promise<void> {
  const payload = { modus: m };
  const r = await a.app.inject({ method: "PUT", url: BASIS, headers: k.kopf, payload });
  expect(r.statusCode, r.body).toBe(200);
}

/** Wartet so lange, wie ein Hinweis höchstens bräuchte, bis er erscheint. */
async function bisHinweis(): Promise<HTMLElement | null> {
  await bis(() => Boolean(q(document, "klara-hinweis")), 160);
  return q(document, "klara-hinweis");
}

const text = (id: string): string => q(document, id)?.textContent ?? "";

// ================================================================================================
describe("M1 · K1/K4 — drei Modi, verständlich wählbar, persönlich gespeichert", () => {
  it("Wahl mit Erklärung, gespeichert am Konto, gilt nach Neuladen und neuer Anmeldung", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-wahl", a.admin);
    alsKonto(ich);
    await montiere();
    await klaraOeffnen();
    await bisModusGelesen();

    // Drei Modi, jeder mit Namen UND einem Satz, was er bedeutet; Vorgabe: still.
    const optionen = ["nachfrage", "hinweise", "auftraege"].map((m) =>
      q(document, `klara-eigeninitiative-${m}`),
    );
    expect(optionen.every(Boolean)).toBe(true);
    expect(optionen[0]?.textContent).toContain("Nur auf Nachfrage");
    expect(optionen[0]?.textContent).toContain("bleibt still");
    expect(optionen[1]?.textContent).toContain("Passende Hinweise anbieten");
    expect(optionen[1]?.textContent).toContain("Ein Hinweis tut selbst nichts");
    expect(optionen[2]?.textContent).toContain("Ausdrücklich übertragene Aufgaben");
    expect(optionen[2]?.textContent).toContain("mit deinen Rechten");
    expect(modus()).toBe("nachfrage");
    expect(text("klara-eigeninitiative-stand")).toContain("Vorgabe");
    // Bedienhilfe zu dieser Fähigkeit — direkt in Klara.
    expect(text("klara-bedienhilfe-eigeninitiative")).toContain("Wann ich mich melde");

    await waehle("auftraege");
    await bis(() => text("klara-eigeninitiative-stand").includes("gespeichert"), 200);
    expect(text("klara-eigeninitiative-stand")).toContain("Für dein Konto gespeichert");
    expect((await serverModus(a, ich)).modus).toBe("auftraege");
    expect(schreibend.filter((s) => s.includes("/eigeninitiative"))).toEqual([`PUT ${BASIS}`]);

    // Neuladen mit derselben Anmeldung.
    neuLaden();
    await montiere();
    await klaraOeffnen();
    await bisModusGelesen();
    expect(modus()).toBe("auftraege");

    // Neue Anmeldung (zweites Gerät): derselbe Modus.
    neuLaden();
    alsKonto(await neuAnmelden(a, ich));
    await montiere();
    await klaraOeffnen();
    await bisModusGelesen();
    expect(modus()).toBe("auftraege");

    // Ein anderes Konto hat seine eigene Vorgabe.
    neuLaden();
    alsKonto(await neuesKonto(a.app, "initiative-andere", a.admin));
    await montiere();
    await klaraOeffnen();
    await bisModusGelesen();
    expect(modus()).toBe("nachfrage");
  });
});

describe("M2 · K2 — still ohne Auftrag; Hinweise bieten an und führen nichts aus", () => {
  it("„Nur auf Nachfrage“: nach der Wartezeit kein Hinweis und keine schreibende Anfrage", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-still", a.admin);
    await setzeServerModus(a, ich, "nachfrage");
    alsKonto(ich);
    await montiere();
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();
    expect(q(document, "klara-gespraech")).toBeNull();
    expect(handlungen()).toEqual([]);
    expect((await gespraechAmServer(a, ich))?.nachrichten ?? []).toEqual([]);
  });

  it("„Passende Hinweise“: Hinweis aus dem Kontext — ausgeführt wird erst nach dem Klick", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-hinweis", a.admin);
    await setzeServerModus(a, ich, "hinweise");
    alsKonto(ich);
    await montiere("/fragen");
    const h = await bisHinweis();
    expect(h, "kein Hinweis erschienen").not.toBeNull();
    // Abgeleitet aus dem Ort: Anleitung der Fragen-Seite oder deren Erklärung.
    expect(["tutorial:fragen", "seite:fragen"]).toContain(h?.dataset.hinweis);
    expect(text("klara-hinweis-text")).toContain("Fragen");
    expect(text("klara-hinweis")).toContain("es passiert nichts ohne deinen Klick");
    // Der Hinweis allein hat nichts gesendet, nichts gespeichert und nichts geöffnet.
    await warte(500);
    expect(handlungen()).toEqual([]);
    expect((await gespraechAmServer(a, ich))?.nachrichten ?? []).toEqual([]);
    expect(q(document, "klara-gespraech")).toBeNull();

    // Erst das Angebot öffnet Klara mit der vorhandenen Hilfe (Klarwerk-Hilfe, ohne KI).
    await klick(q(document, "klara-hinweis-angebot"));
    await bis(() => Boolean(q(document, "klara-gespraech")));
    expect(q(document, "klara-gespraech")).not.toBeNull();
    expect(q(document, "klara-hinweis")).toBeNull();
    // Kein Auftrag, kein Entwurf ist entstanden — die Hilfe ist keine Aktion am Bestand.
    await warte(600);
    expect(alle(document, "klara-ausfuehrung")).toHaveLength(0);
    const amBestand = handlungen().filter((s) => /\/auftraege|\/drafts/.test(s));
    expect(amBestand).toEqual([]);
    const entwuerfe = await a.app.inject({ method: "GET", url: "/api/drafts", headers: ich.kopf });
    expect(entwuerfe.json()).toEqual([]);
  });
});

describe("M3 · K3 — geschlossene oder zurückgestellte Hinweise ruhen", () => {
  it("„Später“ und „Nicht mehr anbieten“ lassen ihn ruhen — auch nach Neuladen", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-spaeter", a.admin);
    await setzeServerModus(a, ich, "hinweise");
    alsKonto(ich);
    await montiere("/fragen");
    const h = await bisHinweis();
    const schluessel = h?.dataset.hinweis ?? "";
    expect(schluessel).not.toBe("");

    await klick(q(document, "klara-hinweis-spaeter"));
    expect(q(document, "klara-hinweis")).toBeNull();
    await bis(() => schreibend.includes(`POST ${BASIS}/hinweise`), 120);
    expect(text("klara-ansage")).toContain("zurückgestellt");
    const amServer = (await serverModus(a, ich)).hinweise;
    expect(amServer).toEqual([expect.objectContaining({ schluessel, stand: "zurueckgestellt" })]);

    // Neuladen OHNE Tab-Speicher: der Server hält ihn zurück.
    neuLaden();
    await montiere("/fragen");
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();

    // „Nicht mehr anbieten“ auf einer anderen Seite: ebenso.
    abbauen();
    await montiere("/erfassen");
    const zweiter = await bisHinweis();
    expect(zweiter?.dataset.hinweis).not.toBe(schluessel);
    await klick(q(document, "klara-hinweis-schliessen"));
    await bis(() => schreibend.filter((s) => s.endsWith("/hinweise")).length === 2, 120);
    neuLaden();
    await montiere("/erfassen");
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();
    const ruhend = (await serverModus(a, ich)).hinweise as { stand: string }[];
    expect(ruhend.map((x) => x.stand).sort()).toEqual(["geschlossen", "zurueckgestellt"]);
  });

  it("ein unbeantworteter Hinweis erscheint in derselben Sitzung nicht noch einmal", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-einmal", a.admin);
    await setzeServerModus(a, ich, "hinweise");
    alsKonto(ich);
    await montiere("/fragen");
    expect(await bisHinweis()).not.toBeNull();
    // Die Person arbeitet weiter, ohne zu antworten: Klara öffnen und wieder schliessen.
    await klaraOeffnen();
    expect(q(document, "klara-hinweis")).toBeNull();
    await klick(q(document, "klara-schliessen"));
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();
    // Auch ein Neuaufbau der Fläche in derselben Sitzung (Tab-Speicher bleibt) bringt ihn nicht.
    abbauen();
    await montiere("/fragen");
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();
    expect(schreibend.filter((s) => s.endsWith("/hinweise"))).toEqual([]);
  });
});

describe("M4 · K2/K4 — übertragene Aufgaben sichtbar geführt, auch nach Neuladen", () => {
  it("kein Hinweis; die erteilte Aufgabe steht mit Stand da und bleibt nach dem Neuladen", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "initiative-aufgaben", a.admin);
    await setzeServerModus(a, ich, "auftraege");
    alsKonto(ich);
    await montiere("/fragen");
    await warte(UEBER_VERZUG_MS);
    expect(q(document, "klara-hinweis")).toBeNull();

    await klaraOeffnen();
    await bisModusGelesen();
    expect(q(document, "klara-aufgaben")).not.toBeNull();
    expect(q(document, "klara-aufgaben-leer")).not.toBeNull();

    const feld = q<HTMLInputElement>(document, "klara-eingabe");
    if (!feld) {
      throw new Error("Eingabefeld fehlt");
    }
    await tippe(feld, "Lege den Entwurf „Initiative Probe“ an");
    await klick(q(document, "klara-senden"));
    await bis(() => q(document, "klara-ausfuehrung")?.dataset.phase === "fertig", 400);
    const kartenStand = q(document, "klara-ausfuehrung")?.dataset.stand ?? "";
    expect(kartenStand).not.toBe("");
    await bis(() => alle(document, "klara-aufgabe").length === 1, 120);
    const zeile = alle(document, "klara-aufgabe")[0];
    expect(zeile?.textContent).toContain("Initiative Probe");
    // Derselbe Stand wie auf der Auftragskarte (Klara 05) — eine Wahrheit, vom Server.
    expect(zeile?.dataset.stand).toBe(kartenStand);
    expect(zeile?.dataset.offen).toBe("false");
    // Abgeschlossen: an der Figur steht keine offene Aufgabe.
    expect(q(document, "klara-figur-aufgaben")).toBeNull();

    // Neuladen und neue Anmeldung: Modus und Aufgabe kommen vom Server zurück.
    neuLaden();
    alsKonto(await neuAnmelden(a, ich));
    await montiere("/fragen");
    await klaraOeffnen();
    await bisModusGelesen();
    expect(modus()).toBe("auftraege");
    await bis(() => alle(document, "klara-aufgabe").length === 1, 200);
    expect(alle(document, "klara-aufgabe")[0]?.textContent).toContain("Initiative Probe");
    expect(text("klara-aufgaben")).toContain("mit deinen Rechten");

    // Im Modus „Nur auf Nachfrage“ steht die Aufgabenübersicht nicht da.
    await waehle("nachfrage");
    expect(q(document, "klara-aufgaben")).toBeNull();
  });
});
