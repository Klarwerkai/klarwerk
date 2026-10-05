// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSBLICK — DER BESTANDSBLICK FRAGT MIT DEM AKTUELLEN DOKUMENT.
// ================================================================================================
//
// Bens Befunde aus Runde 1, beide am vollständigen ausgelieferten Panel reproduziert:
//   1. Nach Schreibruhe fragte der Bestandsblick mit den Begriffen der START-Lesung — das Dokument
//      wurde nie neu gelesen (`ka1Aktualisieren` lief nur beim Laden).
//   2. Der Öffnungsanlass wartete nicht auf die asynchrone Startlesung: mit verzögertem
//      `context.sync` fragte KA2 mit leeren Begriffen, ging gar nicht hinaus, und die Karte blieb
//      verborgen.
//
// Die vorhandenen Prüfstände sahen beides nicht: `ka2-vertrag-bestandsblick.test.ts` löst
// `context.sync` sofort auf und ändert den Text nie, `ka3-fokusverhalten.test.tsx` ersetzt den
// Vertrag durch eine Attrappe. Diese Datei fährt den GANZEN Ablauf — echtes Inline-Skript, echter
// KA1→KA3→KA2-Weg, nur Word, Office und `fetch` sind Attrappen — mit verzögertem Lesen und
// geändertem Dokumenttext. Die Fokusprüfungen bleiben in ihrer eigenen Datei unverändert.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { panelQuelleAus } from "../support/panelquelle";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
// Das Fenster liegt in mehreren Dateien (R-1611: taskpane.html/.css/.js; dazu marke.js). Gelesen
// wird es als EIN Dokument — `panelQuelleAus` setzt Stil, Skript und den Markenblock an ihre Stellen.
const HTML = panelQuelleAus(TASKPANE);
const RUECKWEG_QUELLE = readFileSync(
  resolve(process.cwd(), "apps/web/public/word-addin/rueckweg.js"),
  "utf8",
);

function ausPanel(name: string): number {
  const treffer = new RegExp(`var ${name} = (\\d+);`).exec(HTML);
  if (!treffer) {
    throw new Error(`${TASKPANE}: ${name} ist nicht auffindbar`);
  }
  return Number(treffer[1]);
}
const TASTENRUHE_MS = ausPanel("KA3_TASTENRUHE_MS");
const OFFICE_FRIST = ausPanel("OFFICE_READY_TIMEOUT_MS");
/** Die Verzögerung von `context.sync` — Bens Gegenprobe benutzte 25 ms. */
const SYNC_MS = 25;

const ALT = "Kuehlmittelpumpe entlueften nach Wartung.";
const NEU = "Reisekostenabrechnung Hotelkosten Belege einreichen.";

const EREIGNISSE = { DocumentSelectionChanged: "documentSelectionChanged" } as const;
const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;

let dokument = ALT;
let lesungen = 0;
let leseFehler = false;
let fragen: string[] = [];
let officeHandler: Array<{ typ: string; fn: () => void }> = [];
/** R-0427: in welchem Absatz die Markierung steht (0-basiert) — und wie oft das gelesen wurde. */
let absatzIndex = 0;
let absatzLesungen = 0;

function antwort(koerper: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(koerper),
  };
}

function fetchAttrappe(url: string, init?: Record<string, unknown>): Promise<unknown> {
  if (url === "/api/ask") {
    const koerper = JSON.parse(String(init?.body ?? "{}")) as { question?: string };
    fragen.push(String(koerper.question ?? ""));
    return Promise.resolve(
      antwort({
        result: { answered: true, answer: "Dazu gibt es etwas.", sources: ["ko-1"], trust: 0.9 },
      }),
    );
  }
  if (url === "/api/kos/ko-1") {
    return Promise.resolve(
      antwort({ id: "ko-1", title: "Vorhandene Anweisung", status: "validiert" }),
    );
  }
  return Promise.resolve(antwort({}));
}

function wordEinbauen(): void {
  (window as unknown as { Word?: unknown }).Word = {
    run: (fn: (ctx: unknown) => unknown) => {
      lesungen += 1;
      const text = dokument;
      // R-0427: die Absaetze vom Dokumentanfang bis zur Markierung — eine Sammlung ohne Text, deren
      // Laenge beim `load` aus der aktuellen Absatzlage entsteht (wie Word sie beim sync fuellt).
      const absaetze = {
        items: [] as unknown[],
        load: () => {
          absatzLesungen += 1;
          absaetze.items = Array.from({ length: absatzIndex + 1 }, () => ({}));
        },
      };
      const body = {
        text,
        load: () => undefined,
        getHtml: () => ({ value: `<p>${text}</p>` }),
        getRange: () => ({ expandTo: () => ({ paragraphs: absaetze }) }),
      };
      const context = {
        document: { body, getSelection: () => ({ getRange: () => ({}) }) },
        sync: () =>
          new Promise<void>((fertig, fehler) =>
            setTimeout(() => (leseFehler ? fehler(new Error("Word-API")) : fertig()), SYNC_MS),
          ),
      };
      return Promise.resolve().then(() => fn(context));
    },
  };
}

function officeEinbauen(): void {
  (window as unknown as { Office?: unknown }).Office = {
    context: {
      document: {
        get url() {
          return "";
        },
        addHandlerAsync(typ: string, fn: () => void) {
          officeHandler.push({ typ, fn });
        },
        getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
          fn({ status: ASYNC_STATUS.Succeeded, value: "" });
        },
      },
    },
    EventType: EREIGNISSE,
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void) => cb(),
  };
}

async function ladePanel(): Promise<void> {
  const skriptStart = HTML.lastIndexOf("<script>");
  const skriptEnde = HTML.lastIndexOf("</script>");
  expect(skriptStart).toBeGreaterThan(0);
  const skript = `${RUECKWEG_QUELLE}\n${HTML.slice(skriptStart + "<script>".length, skriptEnde)}`;
  const markup = HTML.slice(HTML.indexOf("<body>") + "<body>".length, skriptStart);
  expect(markup.length).toBeGreaterThan(2000);
  document.body.innerHTML = markup;
  wordEinbauen();
  officeEinbauen();
  new Function(skript)();
}

async function zeitVergehtUm(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

function markierungGeaendert(): void {
  const treffer = officeHandler.filter((h) => h.typ === EREIGNISSE.DocumentSelectionChanged);
  expect(treffer.length, "KA3 hat sich nicht an DocumentSelectionChanged gebunden").toBeGreaterThan(
    0,
  );
  for (const h of treffer) {
    h.fn();
  }
}

function karteSichtbar(): boolean {
  const karte = document.getElementById("ka3-karten");
  return karte !== null && karte.className.indexOf("hidden") === -1;
}

/** Nach dem Laden: Startlesung, Öffnungsabruf und Office-Erkennung ablaufen lassen. */
async function geoeffnet(): Promise<void> {
  await ladePanel();
  await zeitVergehtUm(OFFICE_FRIST + 50);
  window.dispatchEvent(new Event("focus"));
  await zeitVergehtUm(10);
}

beforeEach(() => {
  vi.useFakeTimers();
  dokument = ALT;
  lesungen = 0;
  leseFehler = false;
  fragen = [];
  officeHandler = [];
  absatzIndex = 0;
  absatzLesungen = 0;
  (window as unknown as { fetch: unknown }).fetch = fetchAttrappe;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  (window as unknown as { Word?: unknown }).Word = undefined;
  (window as unknown as { Office?: unknown }).Office = undefined;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

describe("Aufnahme 20260922 · der Bestandsblick fragt mit dem aktuellen Dokument", () => {
  it("A1 · Öffnen mit verzögertem Lesen: der Abruf wartet auf die Begriffe und die Karte kommt", async () => {
    await ladePanel();
    // Vor Ablauf der Lesezeit darf NICHT gefragt worden sein — sonst mit leeren Begriffen.
    expect(fragen).toEqual([]);
    await zeitVergehtUm(SYNC_MS + 100);

    expect(fragen.length, "der Öffnungsabruf blieb aus").toBe(1);
    expect(fragen[0]).toContain("kuehlmittelpump");
    expect(karteSichtbar(), "die Karte blieb verborgen").toBe(true);
    // Der Öffnungsanlass teilt sich die Startlesung — keine zweite Lesung dafür.
    expect(lesungen).toBe(1);
  });

  it("A2 · Dokument geändert, Markierung gewechselt, Schreibruhe: neu gelesen, neue Begriffe gefragt", async () => {
    await geoeffnet();
    const lesungenVorher = lesungen;
    fragen = [];

    dokument = NEU;
    markierungGeaendert();
    await zeitVergehtUm(TASTENRUHE_MS + SYNC_MS + 100);

    expect(lesungen, "das Dokument wurde vor dem Bestandsblick nicht neu gelesen").toBe(
      lesungenVorher + 1,
    );
    expect(fragen.length).toBe(1);
    expect(fragen[0], `alte Begriffe gefragt: ${fragen[0]}`).not.toContain("kuehlmittelpump");
    expect(fragen[0]).toContain("reisekost");
    expect(karteSichtbar()).toBe(true);
  });

  it("A3 · vor Ablauf der Schreibruhe wird weder gelesen noch gefragt", async () => {
    await geoeffnet();
    const lesungenVorher = lesungen;
    fragen = [];

    dokument = NEU;
    markierungGeaendert();
    await zeitVergehtUm(TASTENRUHE_MS - 1000);

    expect(lesungen).toBe(lesungenVorher);
    expect(fragen).toEqual([]);
  });

  it("A4 · scheitert die Neulesung, wird nicht mit alten Begriffen gefragt und die Karte geht", async () => {
    await geoeffnet();
    expect(karteSichtbar(), "Vorbedingung: die Karte war da").toBe(true);
    fragen = [];

    leseFehler = true;
    markierungGeaendert();
    await zeitVergehtUm(TASTENRUHE_MS + SYNC_MS + 100);

    expect(fragen, "mit Begriffen eines nicht mehr gelesenen Dokuments gefragt").toEqual([]);
    expect(karteSichtbar()).toBe(false);
    // Ein Hintergrundlesefehler schreibt keine Sendemeldung in die Erfassen-Fläche.
    const status = document.getElementById("send-status");
    expect(status?.textContent ?? "").not.toContain("Word-API");
  });

  it("A5 · der KA2-Vertrag selbst liest weiterhin nicht — die Neulesung gehört dem Anlass", async () => {
    await geoeffnet();
    const lesungenVorher = lesungen;
    const vertrag = (window as unknown as { klaraBestandsblick: (g: string) => Promise<unknown> })
      .klaraBestandsblick;
    await vertrag("tastenruhe");
    expect(lesungen).toBe(lesungenVorher);
  });
});

// ================================================================================================
// R-0427 — BESTANDSBLICK BEIM ABSATZWECHSEL, NUR NACH BEWUSSTEM JA (Bens Befund, Nacharbeit 3).
// ================================================================================================
// Derselbe ganze Ablauf wie oben (echtes Fensterskript, KA1→KA3→KA2), dazu die Absatzlage der
// Markierung. Gemessen wird jeweils VOR Ablauf der Schreibruhe — ein Abruf in diesem Fenster kann
// also nur vom Absatzwechselweg kommen, nicht vom Ruhefristweg.
const KURZ = SYNC_MS * 4 + 200;

function absatzSchalter(): HTMLElement {
  const schalter = document.getElementById("einst-absatzblick");
  expect(schalter, "der Schalter #einst-absatzblick fehlt im Markup").not.toBeNull();
  return schalter as HTMLElement;
}

function cursorFeld(): HTMLElement {
  const feld = document.querySelector("textarea, input[type='text'], input:not([type])");
  expect(feld, "kein fokussierbares Eingabefeld im Markup").not.toBeNull();
  return feld as HTMLElement;
}

describe("R-0427 · Bestandsblick beim Absatzwechsel — erst nach bewusstem Ja", () => {
  it("B1 · ohne Ja: der Schalter steht aus, ein Absatzwechsel liest nichts und fragt nichts", async () => {
    await geoeffnet();
    expect(absatzSchalter().getAttribute("aria-checked")).toBe("false");
    // Beschriftet in der Sprache des Fensters — kein roher Schlüssel, Zeile und Schalter gleich.
    const zeile = document.getElementById("einst-absatzblick-text")?.textContent ?? "";
    expect(zeile.length).toBeGreaterThan(10);
    expect(zeile).not.toBe("einstAbsatzblick");
    expect(absatzSchalter().getAttribute("aria-label")).toBe(zeile);
    fragen = [];

    dokument = NEU;
    absatzIndex = 3;
    markierungGeaendert();
    await zeitVergehtUm(KURZ);

    expect(absatzLesungen, "ohne Zustimmung wurde die Absatzlage gelesen").toBe(0);
    expect(fragen, "ohne Zustimmung wurde beim Absatzwechsel gefragt").toEqual([]);
  });

  it("B2 · nach Ja: der Absatzwechsel ruft den Bestandsblick sofort — mit dem aktuellen Dokument, ohne Fokusraub", async () => {
    await geoeffnet();
    absatzSchalter().click();
    expect(absatzSchalter().getAttribute("aria-checked")).toBe("true");
    await zeitVergehtUm(KURZ);
    // Das Ja merkt sich nur den Ausgangsabsatz — es fragt nicht selbst.
    expect(absatzLesungen).toBe(1);
    fragen = [];

    const feld = cursorFeld();
    feld.focus();
    expect(document.activeElement).toBe(feld);
    dokument = NEU;
    absatzIndex = 1;
    markierungGeaendert();
    await zeitVergehtUm(KURZ);

    expect(fragen.length, "der Absatzwechsel hat keinen Bestandsblick ausgelöst").toBe(1);
    expect(fragen[0]).toContain("reisekost");
    expect(karteSichtbar()).toBe(true);
    expect(document.activeElement, "der Absatzwechselweg hat den Fokus bewegt").toBe(feld);
  });

  it("B3 · nach Ja, aber im selben Absatz: kein Abruf vor der Schreibruhe", async () => {
    await geoeffnet();
    absatzSchalter().click();
    await zeitVergehtUm(KURZ);
    fragen = [];

    dokument = NEU;
    markierungGeaendert();
    await zeitVergehtUm(KURZ);

    expect(absatzLesungen, "die Absatzlage wurde nach dem Ja nicht gelesen").toBe(2);
    expect(fragen).toEqual([]);
  });

  it("B4 · das Ja ist zurücknehmbar: wieder aus, und der Absatzwechsel bleibt stumm", async () => {
    await geoeffnet();
    absatzSchalter().click();
    await zeitVergehtUm(KURZ);
    absatzSchalter().click();
    expect(absatzSchalter().getAttribute("aria-checked")).toBe("false");
    const lesungenNachJa = absatzLesungen;
    fragen = [];

    absatzIndex = 2;
    markierungGeaendert();
    await zeitVergehtUm(KURZ);

    expect(absatzLesungen).toBe(lesungenNachJa);
    expect(fragen).toEqual([]);
  });
});
