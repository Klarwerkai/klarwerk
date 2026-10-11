// @vitest-environment jsdom
// ================================================================================================
// KLARA 04 (produkt:20261008:klara-vorschlaege) — VORSCHLAG UND BEWUSSTE ÜBERNAHME GEGEN DEN
// ECHTEN SERVER, AUF DER ECHTEN LESEFLÄCHE MIT DEM ECHTEN EDITOR.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten Klara und der echten Lesefläche `KnowledgeDetail`
// (`/wissen/:id`, darin der Editor aus `BibliothekLesen`), verbunden über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts` mit der ECHTEN App im selben Prozess: Anmeldung, Rollen,
// Sichtbarkeit, Formulierungsweg (`POST /api/reasoner`, Aufgabe `assist`) und Speichern (`revise`).
// Am Modellweg antwortet ein kontrollierter Adapter: für die Formulierungsaufgabe einen festen Satz
// (`NEU`), sonst wie in der Kette. Eine tatsächliche Modellantwort ist das nicht.
//
//   V1 · K1/K3 — Umformulieren zeigt Original und Vorschlag mit Ziel, Quelle und KI-Kennzeichen; am
//        Server, in der Lesefläche und im Editor bleibt alles unverändert — auch nach „Verwerfen“.
//   V2 · K2    — „Übernehmen“ setzt den Vorschlag in die Bearbeitungsfassung des Editors; erst das
//        Speichern dort ändert den Beitrag. Klara liest die neue Fassung am Server nach, und nach
//        Wiederöffnen steht der neue Wortlaut in der Lesefläche.
//   V3 · K4    — mehrdeutiges Ziel: Rückfrage mit allen Stellen, nichts geändert; die gewählte Stelle
//        und nur sie landet nach dem Speichern im Beitrag.
//   V4 · K4    — anderes Objekt geöffnet bzw. keins: Rückfrage statt Änderung am falschen Objekt.
//   V5 · K4    — ohne Bearbeitungsrecht (Rolle „viewer“): verständlicher Fehler, nichts geändert.
//   V6 · K3    — Produktbetrieb: Notizentwurf aus der Markierung sichtbar mit Herkunft; die
//        Bedienhinweise beschreiben Umformulieren und Notizentwurf als geliefert.
//
// Echte Maus, echtes Layout und echte Tastatur misst diese Datei nicht (jsdom); die Fläche einer
// Markierung (`Range.getBoundingClientRect`) wird mit festen Zahlen ergänzt, sonst nichts.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { alle, bis, klick, medienStub, q, ruhe } from "../fe003-tutorial-fragen/huelle";
import {
  ADAPTER_URL,
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  type Eintrag,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Was der kontrollierte Adapter für die Formulierungsaufgabe liefert. */
const NEU = "Vor dem Wechsel wird die Zylinderkopfdichtung XQ42 zuerst entlastet.";

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let drahtFetch: typeof globalThis.fetch;
const formulierungen: { text: string; koId: unknown }[] = [];

beforeAll(() => {
  draht = drahtAufbauen();
  drahtFetch = globalThis.fetch;
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 120,
        left: 40,
        top: 120,
        right: 240,
        bottom: 140,
        width: 200,
        height: 20,
        toJSON: () => ({}),
      }) as DOMRect;
  }
});

afterAll(() => {
  draht.abbauen();
});

/**
 * Der Adapter für die Formulierungsaufgabe (`assistSystem`, provider-model.ts: „Du präzisierst und
 * glättest …“) — alles andere geht unverändert an den Draht. Dazu ein Mitschnitt dessen, was der
 * Browser an den Formulierungsweg schickt.
 */
function formulierungsAdapter(): void {
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const rumpf = typeof init?.body === "string" ? init.body : "";
    if (url.startsWith(ADAPTER_URL) && rumpf.includes("präzisierst und glättest")) {
      const nutzlast = { choices: [{ message: { content: NEU }, finish_reason: "stop" }] };
      return {
        status: 200,
        statusText: "200",
        ok: true,
        json: async () => nutzlast,
        text: async () => JSON.stringify(nutzlast),
      } as unknown as Response;
    }
    if (url === "/api/reasoner") {
      const r = JSON.parse(rumpf || "{}") as { task?: string; text?: string; koId?: unknown };
      if (r.task === "assist") {
        formulierungen.push({ text: r.text ?? "", koId: r.koId });
      }
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
  setzeKlaraVorschauAktiv(true);
  medienStub();
  formulierungen.length = 0;
  formulierungsAdapter();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = drahtFetch;
  window.fetch = drahtFetch;
  vergiss();
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

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
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

interface KoStand {
  version: number;
  title: string;
  statement: string;
  bodyHtml?: string | null;
}

async function koLesen(a: Aufbau, k: Konto, koId: string): Promise<KoStand> {
  const r = await a.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: k.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as KoStand;
}

function klartext(html: string | null | undefined): string {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

function vorkommen(text: string, teil: string): number {
  return text.split(teil).length - 1;
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const zuFragen: object = { "data-testid": "zu-fragen" };
  const inhalt = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(Link, { to: "/fragen", ...zuFragen }, "Zu Fragen"),
    createElement(
      Routes,
      null,
      createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
      createElement(Route, {
        path: "/fragen",
        element: createElement("div", { "data-testid": "seite-fragen" }),
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

async function gespraechOeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === "bereit" || laden === "fehler";
  }, 160);
}

async function einwilligen(): Promise<void> {
  if (q(document, "klara-einwilligung-erteilt")) {
    return;
  }
  await klick(q(document, "klara-einwilligung-erteilen"));
  await bis(() => Boolean(q(document, "klara-einwilligung-erteilt")), 120);
  expect(q(document, "klara-einwilligung-erteilt"), "Einwilligung nicht bestätigt").not.toBeNull();
}

const text = (id: string): string => q(document, id)?.textContent ?? "";
const stand = (): string | undefined => q(document, "klara-textvorschlag")?.dataset.stand;

/** Der Absatz der echten Lesefläche, der GENAU diesen Wortlaut trägt (sonst der erste mit ihm). */
function absatzMit(wortlaut: string): HTMLElement {
  const flaeche = q(document, "bib-text");
  const absaetze = Array.from(flaeche?.querySelectorAll<HTMLElement>("p") ?? []);
  const p =
    absaetze.find((el) => (el.textContent ?? "").trim() === wortlaut) ??
    absaetze.find((el) => (el.textContent ?? "").includes(wortlaut));
  if (!p) {
    throw new Error(`Absatz mit „${wortlaut}“ fehlt in der Lesefläche`);
  }
  return p;
}

async function markiere(el: HTMLElement): Promise<void> {
  const knoten = el.firstChild ?? el;
  await act(async () => {
    const range = document.createRange();
    range.selectNodeContents(knoten);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

async function artikelOeffnen(eintrag: Eintrag): Promise<void> {
  await montiere(`/wissen/${eintrag.koId}`);
  await gespraechOeffnen();
  await bis(() => text("klara-ort-objekt").includes(eintrag.titel), 240);
  await bis(() => Boolean(q(document, "bib-text")), 240);
}

async function markierungUebernehmen(wortlaut: string): Promise<void> {
  await markiere(absatzMit(wortlaut));
  await bis(() => Boolean(q(document, "klara-auswahl-knopf")), 80);
  await klick(q(document, "klara-auswahl-knopf"));
  await bis(() => Boolean(q(document, "klara-auswahl")));
}

async function umformulieren(): Promise<void> {
  await klick(q(document, "klara-aktion-umformulieren"));
  await bis(() => {
    const s = stand();
    return s !== undefined && s !== "wartet";
  }, 240);
}

async function uebernehmen(): Promise<void> {
  await klick(q(document, "klara-textvorschlag-uebernehmen"));
  await bis(() => stand() !== "wartet", 240);
}

const editorOffen = (): boolean =>
  Boolean(q(document, "bib-speichern") || q(document, "bib-einreichen"));

describe("V1 · K1/K3 — Original und Vorschlag, Quelle und KI-Kennzeichen; nichts geändert", () => {
  it("der Vorschlag steht neben dem unveränderten Original — am Server, im Lesebild, ohne Editor", async () => {
    const a = await app();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    const leser = await neuesKonto(a.app, "klara-vorschlag", a.admin);
    alsKonto(leser);
    const vorher = await koLesen(a, leser, eintrag.koId);

    await artikelOeffnen(eintrag);
    // Bedienhilfe dieser Fähigkeit — direkt in Klara.
    expect(text("klara-bedienhilfe-vorschlag")).toContain("Umformulieren");
    await einwilligen();
    await markierungUebernehmen(BELEGSTELLE);
    await umformulieren();

    expect(stand(), text("klara-textvorschlag")).toBe("offen");
    // K1 · Original und Vorschlag nebeneinander.
    expect(text("klara-textvorschlag-original")).toBe(BELEGSTELLE);
    expect(text("klara-textvorschlag-neu")).toBe(NEU);
    // K3 · bezogen auf DIESE Markierung, über den vorhandenen Formulierungsweg mit Objektbezug.
    expect(formulierungen).toEqual([{ text: BELEGSTELLE, koId: eintrag.koId }]);
    // K3 · Quelle (Objekt, Fassung, Prüfstatus, Absatz) und KI-Formulierung erkennbar.
    const ziel = text("klara-textvorschlag-ziel");
    expect(ziel).toContain(eintrag.titel);
    expect(ziel).toContain(`Fassung ${vorher.version}`);
    expect(ziel).toContain("geprüft");
    expect(ziel).toMatch(/Absatz \d+/);
    expect(q(document, "klara-textvorschlag-quelle")?.getAttribute("href")).toContain(eintrag.koId);
    expect(q(document, "klara-textvorschlag-ki")?.dataset.ki).toBe("ki");
    expect(text("klara-textvorschlag-ki")).toBe("KI-Formulierung · nicht geprüft");
    expect(text("klara-textvorschlag-fassung")).toContain("Bearbeitungsfassung");

    // K1 · das Original ist unverändert: am Server, in der Lesefläche, kein Editor offen.
    const danach = await koLesen(a, leser, eintrag.koId);
    expect(danach.version).toBe(vorher.version);
    expect(danach.statement).toBe(BELEGSTELLE);
    expect(absatzMit(BELEGSTELLE).textContent?.trim()).toBe(BELEGSTELLE);
    expect(editorOffen()).toBe(false);

    // Verwerfen ändert ebenfalls nichts.
    await klick(q(document, "klara-textvorschlag-verwerfen"));
    expect(stand()).toBe("verworfen");
    expect(text("klara-textvorschlag-stand")).toContain("Original bleibt unverändert");
    const verworfen = await koLesen(a, leser, eintrag.koId);
    expect(verworfen.version).toBe(vorher.version);
    expect(verworfen.statement).toBe(BELEGSTELLE);
    expect(editorOffen()).toBe(false);
  });
});

describe("V2 · K2 — Übernahme in die Bearbeitungsfassung, Speichern im Editor, Wiederöffnen", () => {
  it("wirkt erst über den Editor, steht danach am Server und nach Wiederöffnen im Lesebild", async () => {
    const a = await app();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    alsKonto(a.admin);
    const vorher = await koLesen(a, a.admin, eintrag.koId);

    await artikelOeffnen(eintrag);
    await einwilligen();
    await markierungUebernehmen(BELEGSTELLE);
    await umformulieren();
    expect(stand(), text("klara-textvorschlag")).toBe("offen");
    expect(editorOffen()).toBe(false);

    await uebernehmen();
    expect(stand(), text("klara-textvorschlag")).toBe("in_bearbeitung");
    expect(text("klara-textvorschlag-fassung")).toContain("Kernaussage");
    // Der bestehende Editor ist offen und trägt den Vorschlag in der Bearbeitungsfassung …
    await bis(editorOffen, 120);
    expect(q(document, "bib-speichern"), "der Editor mit direktem Speichern fehlt").not.toBeNull();
    expect(q<HTMLTextAreaElement>(document, "bib-aussage")?.value).toBe(NEU);
    // … der Beitrag selbst noch nicht.
    const ungespeichert = await koLesen(a, a.admin, eintrag.koId);
    expect(ungespeichert.version).toBe(vorher.version);
    expect(ungespeichert.statement).toBe(BELEGSTELLE);

    // Speichern über den vorhandenen Speicherweg des Editors.
    await klick(q(document, "bib-speichern"));
    await bis(() => stand() === "gespeichert" || stand() === "nicht_gespeichert", 320);
    expect(stand(), text("klara-textvorschlag")).toBe("gespeichert");
    const gespeichert = await koLesen(a, a.admin, eintrag.koId);
    expect(gespeichert.version).toBeGreaterThan(vorher.version);
    expect(gespeichert.statement).toBe(NEU);
    expect(text("klara-textvorschlag-stand")).toContain(`Fassung ${gespeichert.version}`);

    // Wiederöffnen: neu montiert, neu vom Server gelesen.
    abbauen();
    vergiss();
    await artikelOeffnen(eintrag);
    await bis(() => (q(document, "bib-text")?.textContent ?? "").includes(NEU), 240);
    expect(q(document, "bib-text")?.textContent).toContain(NEU);
    await bis(() => text("klara-ort-fassung") === `Fassung ${gespeichert.version}`, 120);
    expect(text("klara-ort-fassung")).toBe(`Fassung ${gespeichert.version}`);
  });
});

describe("V3 · K4 — mehrdeutiges Ziel führt zur Rückfrage; nur die gewählte Stelle ändert sich", () => {
  it("Rückfrage mit allen Stellen ohne Änderung; danach genau die gewählte Stelle", async () => {
    const a = await app();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    // Derselbe Wortlaut steht in der Kernaussage und zweimal im Inhalt.
    const ZWEITER = `Danach prüfen. ${BELEGSTELLE}`;
    const ueberarbeitet = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${eintrag.koId}`,
      headers: a.admin.kopf,
      payload: {
        action: "revise",
        changes: {
          title: eintrag.titel,
          statement: BELEGSTELLE,
          bodyHtml: `<p>Vorbemerkung zur Wartung.</p><p>${BELEGSTELLE}</p><p>${ZWEITER}</p>`,
          type: "best_practice",
          conditions: [],
          measures: [],
        },
      },
    });
    expect(ueberarbeitet.statusCode, ueberarbeitet.body).toBe(200);
    alsKonto(a.admin);
    const vorher = await koLesen(a, a.admin, eintrag.koId);
    expect(vorkommen(`${vorher.statement} ${klartext(vorher.bodyHtml)}`, BELEGSTELLE)).toBe(3);

    await artikelOeffnen(eintrag);
    await einwilligen();
    await markierungUebernehmen(BELEGSTELLE);
    await umformulieren();
    await uebernehmen();

    // Rückfrage: drei Stellen, nichts geändert, kein Editor geöffnet.
    expect(stand(), text("klara-textvorschlag")).toBe("rueckfrage");
    expect(text("klara-textvorschlag-meldung")).toContain("3-mal");
    const stellen = alle(document, "klara-textvorschlag-stelle");
    expect(stellen.map((s) => s.dataset.feld)).toEqual(["aussage", "inhalt", "inhalt"]);
    expect(stellen[2]?.textContent).toContain("Danach prüfen.");
    expect(editorOffen()).toBe(false);
    const unveraendert = await koLesen(a, a.admin, eintrag.koId);
    expect(unveraendert.version).toBe(vorher.version);

    // Die Person wählt die dritte Stelle („Danach prüfen. …“).
    await klick(stellen[2]);
    await bis(() => stand() !== "wartet", 240);
    expect(stand(), text("klara-textvorschlag")).toBe("in_bearbeitung");
    expect(text("klara-textvorschlag-fassung")).toContain("Inhalt");
    await bis(editorOffen, 120);
    expect(q<HTMLTextAreaElement>(document, "bib-aussage")?.value).toBe(BELEGSTELLE);

    await klick(q(document, "bib-speichern"));
    await bis(() => stand() === "gespeichert" || stand() === "nicht_gespeichert", 320);
    expect(stand(), text("klara-textvorschlag")).toBe("gespeichert");
    const nachher = await koLesen(a, a.admin, eintrag.koId);
    const inhalt = klartext(nachher.bodyHtml);
    expect(nachher.statement).toBe(BELEGSTELLE);
    expect(inhalt).toContain(`Danach prüfen. ${NEU}`);
    expect(vorkommen(inhalt, BELEGSTELLE)).toBe(1);
    expect(vorkommen(inhalt, NEU)).toBe(1);
  });
});

describe("V4 · K4 — ein anderes oder kein Objekt geöffnet: Rückfrage, keine Änderung", () => {
  it("ändert weder das geöffnete noch das gemeinte Objekt", async () => {
    const a = await app();
    const gemeint = await eintragMitOriginal(a.app, a.admin);
    const anderes = await eintragMitOriginal(a.app, a.admin, {
      titel: "Hydraulikfilter H7 tauschen",
      kernaussage: "Der Hydraulikfilter H7 wird nach 500 Stunden getauscht.",
    });
    alsKonto(a.admin);
    const gemeintVorher = await koLesen(a, a.admin, gemeint.koId);
    const anderesVorher = await koLesen(a, a.admin, anderes.koId);

    await artikelOeffnen(gemeint);
    await einwilligen();
    await markierungUebernehmen(BELEGSTELLE);
    await umformulieren();
    expect(stand(), text("klara-textvorschlag")).toBe("offen");

    // Jetzt ist ein ANDERER Beitrag geöffnet.
    abbauen();
    await artikelOeffnen(anderes);
    await bis(() => Boolean(q(document, "klara-textvorschlag")), 80);
    await uebernehmen();
    expect(stand(), text("klara-textvorschlag")).toBe("rueckfrage");
    const meldung = text("klara-textvorschlag-meldung");
    expect(meldung).toContain(gemeint.titel);
    expect(meldung).toContain(anderes.titel);
    expect(meldung).toContain("nicht das falsche Objekt");
    expect(q(document, "klara-textvorschlag-zum-objekt")?.getAttribute("href")).toContain(
      gemeint.koId,
    );
    expect(editorOffen()).toBe(false);

    // Kein Beitrag geöffnet (Seite „Fragen“): ebenfalls Rückfrage.
    await klick(q(document, "zu-fragen"));
    await bis(() => Boolean(q(document, "seite-fragen")), 80);
    await uebernehmen();
    expect(stand()).toBe("rueckfrage");
    expect(text("klara-textvorschlag-meldung")).toContain("gerade nicht geöffnet");

    const gemeintNachher = await koLesen(a, a.admin, gemeint.koId);
    const anderesNachher = await koLesen(a, a.admin, anderes.koId);
    expect(gemeintNachher.version).toBe(gemeintVorher.version);
    expect(gemeintNachher.statement).toBe(BELEGSTELLE);
    expect(anderesNachher.version).toBe(anderesVorher.version);
    expect(anderesNachher.statement).toBe(anderesVorher.statement);
  });
});

// Bens Befund (Nacharbeit 4): im integrierten Produktbetrieb (`AppShell` ohne Vorschau-Aufruf →
// `betriebsart="produkt"`) muss der echte Notizentwurf sichtbar sein und die Bedienhilfe die
// angeschlossenen Funktionen erklären, statt sie „nicht freigegeben“ zu nennen.
describe("V6 · Produktbetrieb — Markierung → Notizentwurf sichtbar mit Herkunft; Hinweise stimmen", () => {
  it("der echte Notizentwurf erscheint mit Inhalt, Herkunft und Rücklink; kein Demo-Feld", async () => {
    setzeKlaraVorschauAktiv(false);
    const a = await app();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    const leser = await neuesKonto(a.app, "klara-produkt-notiz", a.admin);
    alsKonto(leser);
    const vorher = await koLesen(a, leser, eintrag.koId);

    await artikelOeffnen(eintrag);
    expect(q(document, "klara-figur")?.dataset.betriebsart).toBe("produkt");

    // Die Hinweise im Produktbetrieb beschreiben den gelieferten Umfang.
    const offen = text("klara-offen");
    expect(offen).toContain("noch in Arbeit");
    expect(offen).not.toContain("Umformulieren");
    expect(offen).not.toContain("Notizen");
    expect(text("klara-bedienhilfe-vorschlag")).toContain("Umformulieren");

    await markierungUebernehmen(BELEGSTELLE);
    const hinweis = text("klara-aktion-nur-demo");
    expect(hinweis).toContain("Umformulieren");
    expect(hinweis).toContain("Notizentwurf");
    expect(hinweis).not.toContain("nicht freigegeben");
    expect(q(document, "klara-aktion-umformulieren")).not.toBeNull();

    await klick(q(document, "klara-aktion-notiz"));
    await bis(() => Boolean(q(document, "klara-entwurf")), 80);
    const entwurf = q(document, "klara-entwurf");
    expect(entwurf, "der Notizentwurf ist im Produktbetrieb unsichtbar").not.toBeNull();
    expect(entwurf?.dataset.echt).toBe("true");
    expect(q<HTMLTextAreaElement>(document, "klara-entwurf-inhalt")?.value).toBe(BELEGSTELLE);
    const herkunft = text("klara-entwurf-herkunft");
    expect(herkunft).toContain(eintrag.titel);
    expect(herkunft).toContain(`Fassung ${vorher.version}`);
    expect(herkunft).toMatch(/Absatz \d+/);
    expect(q(document, "klara-entwurf-ruecklink")?.getAttribute("href")).toContain(eintrag.koId);
    expect(text("klara-entwurf-sitzung")).toBe("Nur in dieser Sitzung");
    // Keine Demo-Felder (Aufgabe, Erinnerung, Termin, Demo-Speichern) im echten Entwurf.
    expect(q(document, "klara-entwurf-demo")).toBeNull();
    expect(q(document, "klara-entwurf-erinnerung")).toBeNull();
    expect(q(document, "klara-entwurf-termin")).toBeNull();
    expect(q(document, "klara-entwurf-speichern")).toBeNull();
    // Am Beitrag ändert der Notizentwurf nichts.
    const nachher = await koLesen(a, leser, eintrag.koId);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.statement).toBe(BELEGSTELLE);
  });
});

describe("V5 · K4 — ohne Bearbeitungsrecht: verständlicher Fehler statt Änderung", () => {
  it("die Rolle „viewer“ bekommt den Vorschlag zu lesen, aber keine Übernahme", async () => {
    const a = await app();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    const betrachter = await neuesKonto(a.app, "klara-betrachter", a.admin);
    const ich = await a.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: betrachter.kopf,
    });
    expect(ich.statusCode, ich.body).toBe(200);
    const id = (ich.json() as { id: string }).id;
    const rolle = await a.app.inject({
      method: "PUT",
      url: `/api/users/${id}`,
      headers: a.admin.kopf,
      payload: { role: "viewer" },
    });
    expect(rolle.statusCode, rolle.body).toBe(200);
    // Neu anmelden — die Rolle gilt für die Sitzung, die danach beginnt.
    const anmeldung = await a.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: betrachter.email, password: "geheim12345" },
    });
    expect(anmeldung.statusCode, anmeldung.body).toBe(200);
    const token = (anmeldung.json() as { token: string }).token;
    const viewer: Konto = {
      email: betrachter.email,
      token,
      kopf: { authorization: `Bearer ${token}` },
    };
    alsKonto(viewer);
    const vorher = await koLesen(a, viewer, eintrag.koId);

    await artikelOeffnen(eintrag);
    await einwilligen();
    await markierungUebernehmen(BELEGSTELLE);
    await umformulieren();
    expect(stand(), text("klara-textvorschlag")).toBe("offen");

    await uebernehmen();
    expect(stand(), text("klara-textvorschlag")).toBe("fehler");
    const meldung = q(document, "klara-textvorschlag-meldung");
    expect(meldung?.getAttribute("role")).toBe("alert");
    // produkt:20261010:assistenz-name-avatar (K6): ohne gespeicherten Namen die neutrale Bezeichnung.
    expect(meldung?.textContent).toBe(
      `Du darfst „${eintrag.titel}“ nicht bearbeiten. Assistenz hat nichts geändert.`,
    );
    expect(editorOffen()).toBe(false);
    const nachher = await koLesen(a, viewer, eintrag.koId);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.statement).toBe(BELEGSTELLE);
  });
});
