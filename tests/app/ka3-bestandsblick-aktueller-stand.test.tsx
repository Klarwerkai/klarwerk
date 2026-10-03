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

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const RUECKWEG_QUELLE = readFileSync(
  resolve(process.cwd(), "apps/web/public/word-addin/rueckweg.js"),
  "utf8",
);
// Zerlegungsauftrag Bestandsblick (Nacharbeit 2): der Block KW-MARKE wohnt in `marke.js`, die
// `taskpane.html` mit `defer` NACH dem Inline-Skript laedt. Geladen wird deshalb in der Reihenfolge
// der Auslieferung: rueckweg.js, Inline-Skript, marke.js.
const MARKE_QUELLE = readFileSync(
  resolve(process.cwd(), "apps/web/public/word-addin/marke.js"),
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
      const body = { text, load: () => undefined, getHtml: () => ({ value: `<p>${text}</p>` }) };
      const context = {
        document: { body },
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
  const skript = `${RUECKWEG_QUELLE}\n${HTML.slice(skriptStart + "<script>".length, skriptEnde)}\n${MARKE_QUELLE}`;
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
