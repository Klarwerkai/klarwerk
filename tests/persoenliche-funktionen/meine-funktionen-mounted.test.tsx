// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine · BES-07 — „MEINE FUNKTIONEN" AN DER ECHTEN FLÄCHE.
// ================================================================================================
//
// Die ECHTE Hülle (`AppShell`), die ECHTE Profilseite und der ECHTE Server (`buildApp(buildServices())`,
// In-Memory). Ersetzt ist allein der Transport (`fetch` → `app.inject`), wie in
// `tests/assistenz-profil/assistenz-mounted.test.tsx`. Fiktive Konten und Inhalte.
//
//   M1  K08/K01 — „Meine Funktionen" steht als Zeile im Profil; ein Satz ergibt einen lesbaren
//       Entwurf samt Grenzen; Beispielwerte werden als „nicht gespeichert" gezeigt.
//   M2  K04/K08 — Speichern legt nur die Funktion an (kein Lauf, keine Serie); sie zeigt ehrlich,
//       was zum Ausführen fehlt.
//   M3  K05/K07 — ein neuer Fall mit eigenen Werten; Pausieren nimmt den Aufruf weg; nach erneutem
//       Laden über `/profil?bereich=funktionen` ist die Pause noch da.
//   M4  Nacharbeit 3 (Ben, BES-S13/K01/K05/K07) — der ganze Bedienweg: echtes Assistenzgespräch,
//       „So wie eben speichern" übernimmt Ablauf und Quelle, die Quelle steht an der Funktion und
//       wird beim nächsten Fall gelesen; „Bearbeiten" ändert Name und Quellen als neue Fassung;
//       ohne Quelle zeigt der Fall den Klärungsbedarf; nach Neuladen bleiben Fassung 2/3, die Quelle
//       und die alten Fälle mit ihrer Fassung erhalten.
//   M5  Nacharbeit 4 (Ben, BES-S13/K01/K03) — zwei Beschaffungsfälle im Gespräch: die Fläche fragt,
//       welcher gemeint ist, und speichert nur den gewählten Fall mit seiner Quelle.
//   M6  Nacharbeit 5 (Ben, K01/K03) — ein Diktat nach der Vorschau verwirft sie wie Tippen;
//       gespeichert wird nur die danach neu gezeigte Definition (Spracherkennung nachgebildet).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { Profile } from "../../apps/web/src/pages/Profile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@funktionen-ui.test", password: "ada-geheim-1" };
const SATZ =
  "So möchte ich künftig Angebote für Faltschachteln einholen – diesmal 500 Stück bis 30.11.2026.";

let app: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
const anfragen: { methode: string; pfad: string }[] = [];

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    anfragen.push({ methode, pfad: url.split("?")[0] ?? url });
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

async function vorrichtung(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode, "Ersteinrichtung (Ada)").toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  expect(login.statusCode, login.body).toBe(200);
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  const hinweis = await app.inject({
    method: "POST",
    url: "/api/auth/notice",
    headers: { cookie },
  });
  expect(hinweis.statusCode).toBeLessThan(300);
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(route: string, seite: ReactNode): Promise<void> {
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
                  { initialEntries: [route] },
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
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
}

/** Tippt in ein kontrolliertes Mehrzeilenfeld wie ein Mensch. */
async function tippeMehrzeilig(feld: HTMLTextAreaElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(3);
}

const zaehle = (methode: string, teil: string): number =>
  anfragen.filter((a) => a.methode === methode && a.pfad.includes(teil)).length;

async function gespeicherteRoh(): Promise<string> {
  const r = await (app as FastifyInstance).inject({
    method: "GET",
    url: "/api/me/funktionen",
    headers: { cookie: cookie ?? "" },
  });
  expect(r.statusCode).toBe(200);
  return r.body;
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  verwerfeAssistenzProfil();
  setzeKlaraVorschauAktiv(false);
  medienStub();
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  anfragen.length = 0;
  await vorrichtung();
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  zuruecksetzenGanz();
  verwerfeAssistenzProfil();
  await app?.close();
  app = null;
  cookie = null;
});

describe("Meine Funktionen in den persönlichen Einstellungen", () => {
  it("M1–M3 · Satz → Entwurf → speichern ohne Lauf → neuer Fall → Pause bleibt nach Neuladen", async () => {
    await montiere("/profil", createElement(Profile));
    await bis(() => Boolean(q(document, "zeile-funktionen")), 160);
    await klick(q(document, "zeile-funktionen"));
    await bis(() => Boolean(q(document, "detail-funktionen")), 160);

    // M1 · aus einem Satz ein lesbarer Entwurf — noch nichts gespeichert.
    const satzfeld = q<HTMLTextAreaElement>(document, "funktion-satz");
    if (!satzfeld) {
      throw new Error("Satzfeld fehlt");
    }
    await tippeMehrzeilig(satzfeld, SATZ);
    await klick(q(document, "funktion-entwurf"));
    await bis(() => Boolean(q(document, "funktion-entwurf-ansicht")), 160);
    const ansicht = q(document, "funktion-entwurf-ansicht")?.textContent ?? "";
    expect(ansicht).toContain("Angebote für Faltschachteln einholen");
    expect(ansicht).toContain("Bestellen und Bezahlen: nie.");
    expect(q(document, "funktion-beispielwerte")?.textContent).toContain("500 Stück");
    expect(zaehle("POST", "/api/me/funktionen/entwurf")).toBe(1);
    const speichernAnfragen = anfragen.filter((a) => a.pfad === "/api/me/funktionen");
    expect(speichernAnfragen.filter((a) => a.methode === "POST")).toEqual([]);

    // M2 · Speichern — eine Funktion, kein Lauf, keine Serie; offen ist, was fehlt.
    await klick(q(document, "funktion-speichern"));
    await bis(() => Boolean(q(document, "funktion")), 160);
    expect(q(document, "funktion-gespeichert")?.textContent).toContain("Ausgeführt wurde nichts.");
    expect(q(document, "funktion-stand")?.textContent).toContain("Aktiv");
    expect(q(document, "funktion-offen")?.textContent).toContain(
      "Begrenzten mehrstufigen Auftrag führen",
    );
    expect(zaehle("POST", "/laeufe")).toBe(0);
    expect(zaehle("PUT", "/zeitauftrag")).toBe(0);
    const roh = await gespeicherteRoh();
    expect(roh).not.toContain("500");
    expect(roh).not.toContain("30.11.2026");

    // M3 · ein neuer Fall mit eigenen Werten — nach außen geschieht nichts.
    await klick(q(document, "funktion-aufrufen"));
    await bis(() => Boolean(q(document, "funktion-parameter-produkt")), 160);
    const werte: Array<[string, string]> = [
      ["produkt", "Versandkarton VK-3"],
      ["menge", "40 Paletten"],
      ["termin", "2027-01-15"],
    ];
    for (const [name, wert] of werte) {
      const feld = q<HTMLInputElement>(document, `funktion-parameter-${name}`);
      if (!feld) {
        throw new Error(`Feld ${name} fehlt`);
      }
      await tippe(feld, wert);
    }
    await klick(q(document, "funktion-fall-starten"));
    await bis(() => Boolean(q(document, "funktion-fall-ergebnis")), 160);
    const ergebnis = q(document, "funktion-fall-ergebnis")?.textContent ?? "";
    expect(ergebnis).toContain("Nach außen ist nichts geschehen.");
    expect(ergebnis).toContain("BES-02");
    await bis(() => Boolean(q(document, "funktion-laeufe")), 160);
    expect(q(document, "funktion-laeufe")?.textContent).toContain("Versandkarton VK-3");

    await klick(q(document, "funktion-stand-pausiert"));
    await bis(() => (q(document, "funktion-stand")?.textContent ?? "").includes("Pausiert"), 160);
    expect(q(document, "funktion-aufrufen")).toBeNull();

    // Neu laden über den direkten Weg: die Pause ist gespeichert, nicht nur angezeigt.
    abbauen();
    await montiere("/profil?bereich=funktionen", createElement(Profile));
    await bis(() => Boolean(q(document, "funktion-stand")), 160);
    expect(q(document, "detail-funktionen")).not.toBeNull();
    expect(q(document, "funktion-stand")?.textContent).toContain("Pausiert");
    expect(q(document, "funktion-aufrufen")).toBeNull();
    expect(q(document, "funktion-laeufe")?.textContent).toContain("Versandkarton VK-3");
  });
});

// ------------------------------------------------------------------------------------------------
// M4 · Nacharbeit 3 — Übernahme-, Quellen- und Änderungsweg an der Fläche.
// ------------------------------------------------------------------------------------------------

async function serverAuf(methode: "POST" | "PUT", url: string, payload: Record<string, unknown>) {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie: cookie ?? "" },
    payload,
  });
  expect(r.statusCode, `${methode} ${url}: ${r.body}`).toBeLessThan(300);
  return r.json() as Record<string, unknown>;
}

async function fuelleFall(produkt: string, menge: string): Promise<void> {
  const werte: Array<[string, string]> = [
    ["produkt", produkt],
    ["menge", menge],
    ["termin", "2026-11-30"],
  ];
  for (const [name, wert] of werte) {
    const feld = q<HTMLInputElement>(document, `funktion-parameter-${name}`);
    if (!feld) {
      throw new Error(`Feld ${name} fehlt`);
    }
    await tippe(feld, wert);
  }
}

const inhalt = (testId: string): string => q(document, testId)?.textContent ?? "";

describe("Meine Funktionen · der Weg „So wie eben speichern“ bis zur geänderten Fassung", () => {
  it("M4 · Vorgang und Quelle übernehmen, Fall lesen, bearbeiten, Klärung, Neuladen", async () => {
    const QUELLTITEL = "Spezifikation Faltschachtel FS-12 (fiktiv)";
    const ko = await serverAuf("POST", "/api/kos", {
      confidentiality: "intern",
      title: QUELLTITEL,
      statement: "Faltschachteln FS-12 aus 400 g/m² Karton (fiktiv).",
      type: "best_practice",
      category: "Beschaffung Beispiel",
    });
    const koId = String(ko.id);
    const ort = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: QUELLTITEL, koId };
    const begonnen = await serverAuf("POST", "/api/me/klara/gespraeche", { objektbezug: ort });
    const gespraechId = String((begonnen.gespraech as { id: string }).id);
    await serverAuf("PUT", `/api/me/klara/gespraeche/${gespraechId}/einwilligung`, {
      erteilt: true,
    });
    await serverAuf("POST", `/api/me/klara/gespraeche/${gespraechId}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "Bitte hole Angebote für Faltschachteln FS-12 ein, 500 Stück bis 30.11.2026.",
      objektbezug: ort,
    });

    // Übernahme: der Vorgang des letzten Gesprächs ist vorausgewählt; „So wie eben" genügt.
    await montiere("/profil?bereich=funktionen", createElement(Profile));
    await bis(() => Boolean(q(document, "funktion-aus-gespraech")), 160);
    expect(q<HTMLInputElement>(document, "funktion-aus-gespraech")?.checked).toBe(true);
    const satzfeld = q<HTMLTextAreaElement>(document, "funktion-satz");
    if (!satzfeld) {
      throw new Error("Satzfeld fehlt");
    }
    await tippeMehrzeilig(satzfeld, "So wie eben speichern.");
    await klick(q(document, "funktion-entwurf"));
    await bis(() => Boolean(q(document, "funktion-entwurf-ansicht")), 160);
    expect(inhalt("funktion-entwurf-ansicht")).toContain(
      "Angebote für Faltschachteln FS-12 einholen",
    );
    await bis(() => inhalt("funktion-entwurf-quellen").includes(QUELLTITEL), 160);

    await klick(q(document, "funktion-speichern"));
    await bis(() => inhalt("funktion-quellen").includes(QUELLTITEL), 160);
    expect(inhalt("funktion-stand")).toContain("Fassung 1");

    // Nächster manueller Aufruf: die gebundene Quelle wird gelesen, nichts ist zu klären.
    await klick(q(document, "funktion-aufrufen"));
    await bis(() => Boolean(q(document, "funktion-parameter-produkt")), 160);
    await fuelleFall("Faltschachtel FS-12", "500 Stück");
    await klick(q(document, "funktion-fall-starten"));
    await bis(() => inhalt("funktion-fall-ergebnis").includes("Vorbereitet nach Fassung 1"), 160);
    expect(inhalt("funktion-fall-ergebnis")).toContain("1 Quelle(n) neu gelesen");
    expect(q(document, "funktion-klaerung")).toBeNull();

    // Bearbeiten: neuer Name, Quelle entfernt — eine neue Fassung.
    await klick(q(document, "funktion-bearbeiten"));
    await bis(() => Boolean(q(document, "funktion-bearbeiten-name")), 160);
    const namensfeld = q<HTMLInputElement>(document, "funktion-bearbeiten-name");
    if (!namensfeld) {
      throw new Error("Namensfeld fehlt");
    }
    await tippe(namensfeld, "Verpackungsangebote FS");
    await klick(q(document, `funktion-quelle-entfernen-${koId}`));
    await klick(q(document, "funktion-bearbeiten-speichern"));
    await bis(() => inhalt("funktion-stand").includes("Fassung 2"), 160);
    expect(inhalt("funktion-name")).toBe("Verpackungsangebote FS");
    expect(inhalt("funktion-quellen")).toContain("Noch keine Quelle");

    // Ohne Quelle zeigt der nächste Fall gezielt, was zu klären ist.
    await fuelleFall("Karton B", "10 Stück");
    await klick(q(document, "funktion-fall-starten"));
    await bis(() => Boolean(q(document, "funktion-klaerung")), 160);
    expect(inhalt("funktion-klaerung")).toContain("Diese Funktion hat keine Quelle.");
    expect(inhalt("funktion-fall-ergebnis")).toContain("Nach außen ist nichts geschehen.");

    // Neu laden: Fassung 2 ist die geltende, beide Fassungen und beide Fälle bleiben unterscheidbar.
    abbauen();
    await montiere("/profil?bereich=funktionen", createElement(Profile));
    await bis(() => inhalt("funktion-stand").includes("Fassung 2"), 160);
    expect(q(document, "funktion-fassungen")?.querySelectorAll("li").length).toBe(2);
    expect(inhalt("funktion-fassungen")).toContain("Angebote für Faltschachteln FS-12 einholen");
    const faelle = inhalt("funktion-laeufe");
    expect(faelle).toContain("Fassung 1 · Faltschachtel FS-12");
    expect(faelle).toContain("Fassung 2 · Karton B");
    expect(faelle).toContain("Klärung nötig");
  });

  // Nacharbeit 4 (Ben): zwei Beschaffungsfälle im Gespräch — die Fläche fragt, welcher gemeint ist,
  // und speichert genau die gezeigte Vorschau mit nur den Quellen dieses Falls.
  it("M5 · zwei Fälle: Auswahl an der Fläche, gespeichert nur der gewählte Fall mit seiner Quelle", async () => {
    const neuesKo = async (titel: string): Promise<string> =>
      String(
        (
          await serverAuf("POST", "/api/kos", {
            confidentiality: "intern",
            title: titel,
            statement: `${titel} — Beispielinhalt (fiktiv).`,
            type: "best_practice",
            category: "Beschaffung Beispiel",
          })
        ).id,
      );
    const kartonTitel = "Spezifikation Faltschachtel FS-12 (fiktiv)";
    const etikettTitel = "Etikettennorm E7 (fiktiv)";
    const kartonId = await neuesKo(kartonTitel);
    const etikettId = await neuesKo(etikettTitel);
    const ort = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: "Bibliothek" };
    const begonnen = await serverAuf("POST", "/api/me/klara/gespraeche", { objektbezug: ort });
    const gespraechId = String((begonnen.gespraech as { id: string }).id);
    const pfad = `/api/me/klara/gespraeche/${gespraechId}`;
    await serverAuf("PUT", `${pfad}/einwilligung`, { erteilt: true });
    for (const [frage, koId] of [
      ["Bitte hole Angebote für Faltschachteln FS-12 ein.", kartonId],
      ["Und jetzt bitte Angebote für Etiketten E7 anfragen.", etikettId],
    ] as const) {
      await serverAuf("POST", `${pfad}/nachrichten`, {
        von: "du",
        modus: "frage",
        text: frage,
        objektbezug: { ...ort, koId },
      });
    }

    await montiere("/profil?bereich=funktionen", createElement(Profile));
    await bis(() => Boolean(q(document, "funktion-aus-gespraech")), 160);
    const satzfeld = q<HTMLTextAreaElement>(document, "funktion-satz");
    if (!satzfeld) {
      throw new Error("Satzfeld fehlt");
    }
    await tippeMehrzeilig(satzfeld, "So wie eben speichern.");
    await klick(q(document, "funktion-entwurf"));
    await bis(() => Boolean(q(document, "funktion-fallwahl")), 160);
    const wahl = q(document, "funktion-fallwahl");
    expect(wahl?.querySelectorAll("button").length).toBe(2);
    expect(q(document, "funktion-entwurf-ansicht")).toBeNull();

    const zweiter = Array.from(wahl?.querySelectorAll("button") ?? []).find((b) =>
      (b.textContent ?? "").includes("Etiketten E7"),
    );
    await klick(zweiter);
    await bis(() => inhalt("funktion-entwurf-quellen").includes(etikettTitel), 160);
    expect(inhalt("funktion-entwurf-ansicht")).toContain("Angebote für Etiketten E7 einholen");
    expect(inhalt("funktion-entwurf-quellen")).not.toContain(kartonTitel);

    await klick(q(document, "funktion-speichern"));
    await bis(() => inhalt("funktion-quellen").includes(etikettTitel), 160);
    expect(inhalt("funktion-name")).toBe("Angebote für Etiketten E7 einholen");
    expect(inhalt("funktion-quellen")).not.toContain(kartonTitel);
  });

  // Nacharbeit 5 (Ben): ein Diktat NACH der Vorschau verwirft sie wie Tippen. Gespeichert wird nur,
  // was zuletzt angezeigt war. Die Browser-Spracherkennung ist nachgebildet (jsdom hat keine);
  // die ECHTE Spracheingabe im Browser bleibt ungeprüft.
  it("M6 · Diktat nach der Vorschau verwirft sie; gespeichert wird nur die neu gezeigte Definition", async () => {
    const aufnahme: {
      rec: { onresult: ((e: unknown) => void) | null; onend: (() => void) | null } | null;
    } = { rec: null };
    class NachgebildeteErkennung {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start(): void {
        aufnahme.rec = this;
      }
      stop(): void {
        this.onend?.();
      }
    }
    const fenster = window as unknown as { SpeechRecognition?: unknown };
    fenster.SpeechRecognition = NachgebildeteErkennung;
    try {
      const kartonTitel = "Spezifikation Faltschachtel FS-12 (fiktiv)";
      const ko = await serverAuf("POST", "/api/kos", {
        confidentiality: "intern",
        title: kartonTitel,
        statement: "Faltschachteln FS-12 aus 400 g/m² Karton (fiktiv).",
        type: "best_practice",
        category: "Beschaffung Beispiel",
      });
      const ort = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: kartonTitel };
      const begonnen = await serverAuf("POST", "/api/me/klara/gespraeche", { objektbezug: ort });
      const pfad = `/api/me/klara/gespraeche/${String((begonnen.gespraech as { id: string }).id)}`;
      await serverAuf("PUT", `${pfad}/einwilligung`, { erteilt: true });
      await serverAuf("POST", `${pfad}/nachrichten`, {
        von: "du",
        modus: "frage",
        text: "Bitte hole Angebote für Faltschachteln FS-12 ein.",
        objektbezug: { ...ort, koId: String(ko.id) },
      });

      await montiere("/profil?bereich=funktionen", createElement(Profile));
      await bis(() => Boolean(q(document, "funktion-aus-gespraech")), 160);
      const satzfeld = q<HTMLTextAreaElement>(document, "funktion-satz");
      if (!satzfeld) {
        throw new Error("Satzfeld fehlt");
      }
      await tippeMehrzeilig(satzfeld, "So wie eben speichern.");
      await klick(q(document, "funktion-entwurf"));
      await bis(() => Boolean(q(document, "funktion-entwurf-ansicht")), 160);
      expect(inhalt("funktion-entwurf-ansicht")).toContain(
        "Angebote für Faltschachteln FS-12 einholen",
      );

      // Jetzt diktiert die Person einen ANDEREN Ablauf dazu.
      await klick(q(document, "funktion-sprechen"));
      expect(aufnahme.rec).not.toBeNull();
      const diktat = " Bitte Angebote für Etiketten E7 anfragen.";
      await act(async () => {
        const ergebnis = Object.assign([{ transcript: diktat }], { isFinal: true });
        aufnahme.rec?.onresult?.({ resultIndex: 0, results: [ergebnis] });
      });
      await ruhe();
      expect(satzfeld.value).toContain("Etiketten E7");
      // Die alte Vorschau ist weg — und mit ihr der Speichern-Knopf.
      expect(q(document, "funktion-entwurf-ansicht")).toBeNull();
      expect(q(document, "funktion-speichern")).toBeNull();
      const vorherGespeichert = zaehle("POST", "/api/me/funktionen");
      expect(vorherGespeichert).toBe(zaehle("POST", "/api/me/funktionen/entwurf"));

      // Neue Vorschau für den neuen Eingabestand — gespeichert wird genau sie.
      await klick(q(document, "funktion-sprechen"));
      await klick(q(document, "funktion-entwurf"));
      await bis(() => Boolean(q(document, "funktion-entwurf-ansicht")), 160);
      expect(inhalt("funktion-entwurf-ansicht")).toContain("Angebote für Etiketten E7 einholen");
      await klick(q(document, "funktion-speichern"));
      await bis(() => Boolean(q(document, "funktion-name")), 160);
      expect(inhalt("funktion-name")).toBe("Angebote für Etiketten E7 einholen");
    } finally {
      fenster.SpeechRecognition = undefined;
    }
  });
});
