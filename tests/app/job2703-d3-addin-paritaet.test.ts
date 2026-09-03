// @vitest-environment jsdom
// ================================================================================================
// JOB 2703 · D3 — DER DRITTE WEG IM ADD-IN: kommt der ganze Text an, oder schneidet das Add-in ab?
// ================================================================================================
//
// PEDIS FRAGE: „Wenn ich im Word-Add-in einen langen Text eintippe — kommt er ganz an, oder
// schneidet das Add-in ihn vorher ab?"
//
// BEN zu D2: das Add-in kuerzte hart auf 500 Zeichen, IM CLIENT — `taskpane.html`
// (prepareWordDraftRequest und der Weg „offene Frage senden") und sein Zwilling `wordAddin.ts`.
// Was der Client abschneidet, sieht der Server nie; keine kanonische Funktion holt es zurueck.
//
// WAS HIER ECHT IST: das AUSGELIEFERTE Aufgabenfenster (taskpane.html, ausgefuehrt ueber die
// Fixture `createKlaraPanel`), das ECHTE Office-Ereignis „Markierung senden" (`sendSelection`), die
// ECHTE App (`buildApp(buildServices())`) hinter einer Transportbruecke `fetch → app.inject`, die
// ECHTE Persistenz (`GET /api/drafts`) und der ECHTE Confluence-Mapper. Kein direkter
// `POST /api/drafts` — BEN schliesst das ausdruecklich aus; der Rumpf, der hier gemessen wird, ist
// der, den das Panel selbst gebaut und abgeschickt hat.
//
//   a) am Servereingang liegt der VOLLSTAENDIGE Text (nicht 500 Zeichen)
//   b) das gespeicherte `statement` ist zeichengenau gleich dem Confluence-Ergebnis
//   c) es ist die kanonische Kernaussage (Satzgrenze), keine harte Abschneidung
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { KERNAUSSAGE_MAX, kernaussageAusKlartext } from "../../services/structure";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";
import { type KlaraPanel, createKlaraPanel } from "./klara-panel-fixture";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

// Ein Text weit ueber 500 Zeichen, mit Satzgrenzen — die Kernaussage endet an einer davon.
const SAETZE = [
  "Bei Ueberdruck ueber 6 bar ist Ventil X sofort zu schliessen und der Vorgang zu melden.",
  "Danach wird der Druck am Manometer M4 abgelesen, im Schichtbuch vermerkt und die Ursache gesucht.",
  "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren; vorher bleibt sie stehen.",
  "Die Freigabe wird mit Datum und Handzeichen im Anlagenbuch eingetragen und dem Meister gemeldet.",
  "Bei wiederholtem Ueberdruck innerhalb einer Woche ist die Instandhaltung einzuschalten und die Anlage zu pruefen.",
  "Diese Regel gilt fuer alle Schichten und alle Anlagen des Werks ohne Ausnahme und wird jaehrlich unterwiesen.",
  "Abweichungen werden im Schichtbuch begruendet und vom Schichtleiter gegengezeichnet.",
];
const TEXT = SAETZE.join(" ");
const LETZTER_SATZ = SAETZE[SAETZE.length - 1] ?? "";

function seite(bodyHtml: string): ConfluencePage {
  return {
    id: "2703",
    title: "Ueberdruck an Ventil X",
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: "/spaces/K/pages/2703/x" },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

interface Entwurf {
  id: string;
  payload: { title?: string; statement?: string; bodyHtml?: string };
}

let b: Bruecke;
let panel: KlaraPanel | null = null;
/** Jeder Rumpf, den das Panel an POST /api/drafts geschickt hat — das ist der Servereingang. */
let eingaenge: Array<{ statement?: string; bodyHtml?: string; title?: string }> = [];

beforeEach(async () => {
  eingaenge = [];
  b = await bruecke();
});

afterEach(async () => {
  if (panel) {
    await panel.flush();
    panel.restore();
    panel = null;
  }
  b.abbauen();
});

/**
 * Das ausgelieferte Panel starten und seinen `fetch` auf die Bruecke zur echten App legen. Die
 * Fixture setzt beim Start ihren eigenen Fake-Fetch; hier wird er durch die Bruecke ersetzt und
 * jeder Anlage-Rumpf mitgeschrieben. `restore()` der Fixture stellt danach den Vorzustand her.
 */
function panelAnDieEchteApp(selectionHtml: string): KlaraPanel {
  const bridge = globalThis.fetch;
  const p = createKlaraPanel({ selectionHtml });
  const mitschrift = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if ((init?.method ?? "GET").toUpperCase() === "POST" && url === "/api/drafts") {
      eingaenge.push(JSON.parse(String(init?.body ?? "{}")));
    }
    return bridge(eingabe as string, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = mitschrift;
  (globalThis as unknown as { window: { fetch: unknown } }).window.fetch = mitschrift;
  return p;
}

async function entwuerfe(): Promise<Entwurf[]> {
  const res = await b.a.inject({ method: "GET", url: "/api/drafts", headers: b.kopf });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Entwurf[];
}

async function abwarten(p: KlaraPanel, bis: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    await p.flush();
    if (bis()) {
      return;
    }
  }
  throw new Error(`nie eingetreten: ${was} — Status ›${p.text("#send-status")}‹`);
}

describe("JOB 2703 · D3 · der ausgelieferte Add-in-Weg kuerzt nicht mehr — der Server kuerzt kanonisch", () => {
  it("K0 · Kalibrierung: der Text ist laenger als 500 Zeichen, und die kanonische Kernaussage ist KEINE harte Abschneidung", () => {
    expect(TEXT.length).toBeGreaterThan(KERNAUSSAGE_MAX);
    const kanon = kernaussageAusKlartext(TEXT);
    expect(kanon.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(kanon.endsWith(".")).toBe(true);
    expect(kanon).not.toBe(TEXT.slice(0, 500));
  });

  it("W1 · ›Markierung senden‹ im echten Panel: (a) voller Text am Servereingang, (b) statement zeichengenau = Confluence-Mapper, (c) kanonisch, nicht hart", async () => {
    // DERSELBE Ausgangstext auf beiden Wegen: ein Absatz. (Mit sieben Absaetzen liefert das
    // Panel Zeilenumbrueche als Trenner — gemessen im ersten Lauf, alle 693 Zeichen kamen an —,
    // waehrend der Mapper den ersten Block nimmt; das waere ein anderer Ausgangstext, keine
    // andere Kuerzung.)
    const html = `<html><body><p>${TEXT}</p></body></html>`;
    panel = panelAnDieEchteApp(html);
    await panel.flush();
    panel.sendSelection();
    await abwarten(panel, () => eingaenge.length > 0, "das Panel schickt POST /api/drafts");
    await panel.flush();
    await panel.flush();

    // (a) DER SERVEREINGANG: der Rumpf, den das Panel gebaut hat, traegt den ganzen Text.
    const eingang = eingaenge[0];
    const amEingang = eingang?.statement ?? "";
    console.info(
      `JOB 2703 · D3 · W1 · am Servereingang ${amEingang.length} Zeichen (Text ${TEXT.length}) · Status ›${panel.text("#send-status")}‹`,
    );
    expect(
      amEingang.length,
      "(a) der Client hat den Text vor dem Server abgeschnitten",
    ).toBeGreaterThan(500);
    expect(amEingang, "(a) am Servereingang liegt nicht der vollstaendige Text").toBe(TEXT);
    expect(amEingang).toContain(LETZTER_SATZ);

    // (b) DIE PERSISTENZ: das gespeicherte statement ist zeichengenau das Confluence-Ergebnis.
    const gespeichert = (await entwuerfe()).find((d) => d.payload.statement !== undefined);
    expect(gespeichert, "kein Entwurf angelegt").toBeDefined();
    const item = mapConfluencePageToImportItem(seite(`<p>${TEXT}</p>`), OPTS);
    expect(
      gespeichert?.payload.statement,
      "(b) Add-in-Persistenz und Confluence-Mapper kuerzen verschieden",
    ).toBe(item.statement);

    // (c) KANONISCH, nicht hart: Satzgrenze, unter der Kante, und der Volltext lebt im Body weiter.
    expect(gespeichert?.payload.statement).toBe(kernaussageAusKlartext(TEXT));
    expect(gespeichert?.payload.statement).not.toBe(TEXT.slice(0, 500));
    expect((gespeichert?.payload.statement ?? "").length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(gespeichert?.payload.bodyHtml ?? "").toContain(LETZTER_SATZ);
  });

  it("W2 · ›offene Frage senden‹ im echten Panel (zweite Stelle): (a) volle Frage am Servereingang, (b) statement = Confluence-Mapper", async () => {
    panel = panelAnDieEchteApp("<html><body><p>x</p></body></html>");
    await panel.flush();
    const eingabe = panel.q("#ask-input");
    if (!eingabe) {
      throw new Error("Panel ohne Fragefeld");
    }
    eingabe.value = TEXT;
    panel.askKlara(); // echte App ohne Wissen → Wissensluecke → Textlink „offene Frage geben"
    // JOB 3046 D2: der Weg ist ein Textlink (<a>, Zielbild KeinWissen Z.31) — ein <a> kennt kein
    // `disabled`; frei ist er, sobald die Lueckenflaeche steht und er nicht `aria-disabled` traegt.
    await abwarten(
      panel,
      () =>
        panel?.q("#ask-gap-block")?.className === "" &&
        panel.q("#ask-gap-send-btn")?.getAttribute("aria-disabled") !== "true",
      "der Textlink ›offene Frage geben‹ wird frei",
    );
    (panel.q("#ask-gap-send-btn") as unknown as { click(): void }).click();
    await abwarten(panel, () => eingaenge.length > 0, "das Panel schickt die offene Frage");
    await panel.flush();

    const amEingang = eingaenge[0]?.statement ?? "";
    console.info(`JOB 2703 · D3 · W2 · am Servereingang ${amEingang.length} Zeichen`);
    expect(amEingang.length, "(a) die Frage wurde im Client abgeschnitten").toBeGreaterThan(500);
    expect(amEingang).toBe(TEXT);

    const gespeichert = (await entwuerfe()).find((d) => d.payload.statement !== undefined);
    const item = mapConfluencePageToImportItem(seite(`<p>${TEXT}</p>`), OPTS);
    expect(gespeichert?.payload.statement, "(b) verschieden gekuerzt").toBe(item.statement);
  });

  it("W3 · kein Kuerzungsort mehr im Client: taskpane.html und wordAddin.ts tragen keine 500er-Kante", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const wurzel = join(__dirname, "..", "..");
    const taskpane = await readFile(
      join(wurzel, "apps/web/public/word-addin/taskpane.html"),
      "utf8",
    );
    const modul = await readFile(join(wurzel, "apps/web/src/lib/wordAddin.ts"), "utf8");
    expect(taskpane.match(/\.slice\(0, 500\)/g) ?? []).toHaveLength(0);
    expect(modul.match(/\.slice\(0, 500\)/g) ?? []).toHaveLength(0);
  });
});
