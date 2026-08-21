// @vitest-environment jsdom
// ================================================================================================
// JOB 1581 · D2 · KA3 — DIE KARTE KOMMT UND GEHT, UND DER CURSOR BLEIBT.
// ================================================================================================
//
// PEDIS AUFLAGE, WOERTLICH (Auftrag §2.3): „Gebaut, wenn: die Karte kommt und geht, ohne dass der
// Anwender je den Cursor verliert. Kein Popup, kein Fokusraub … Hilfe wird angeboten, nie
// aufgedraengt." Und: „Eine Karte, die den Fokus zieht, ist schlimmer als keine."
//
// WARUM DIESE DATEI NEBEN `ka3-angebotskarten.test.ts` STEHT UND KEIN ZWEITER WEG IST.
// BASIC5 hat in JOB 1581 D1 den QUELLTEXT gepruft: elf Fokusraub-Formen einzeln verboten
// (`focus()`, `blur()`, `select()`, `setSelectionRange`, `scrollIntoView`, `alert(`, `confirm(`,
// `prompt(`, `window.open`, `showModal`, `autofocus`), mit Kalibrierung. Das ist stark und bleibt
// unangetastet — es faengt jede BENANNTE Form.
//
// Es kann aber prinzipiell nicht faengen, was niemand benannt hat: einen Fokuswechsel ueber eine
// Variable (`el[name]()`), ein spaeter ergaenztes `tabindex`, ein `<dialog>` im erzeugten Markup,
// ein `aria-live="assertive"`, das den Screenreader unterbricht — oder schlicht eine kuenftige
// zwoelfte Form. Eine Textsuche kennt nur ihre eigene Liste.
//
// DIESE DATEI FRAGT STATTDESSEN NACH DER WIRKUNG: sie laedt das ausgelieferte Aufgabenfenster in
// jsdom, setzt den Cursor in ein Feld, laesst die Karte WIRKLICH erscheinen und wieder
// verschwinden — und misst `document.activeElement`. Damit ist Pedis Satz zum ersten Mal eine
// Messung statt einer Zusicherung ueber Zeichenketten.
//
// ZUM VERTRAG: `window.klaraBestandsblick` gehoert PRO3 (KA2, JOB 1571), und die Lease sagt „du
// rufst auf, du setzt nicht". Das gilt dem PRODUKTCODE — und BASIC5s Fall C haelt genau das fest
// (`not.toMatch(/window\.klaraBestandsblick\s*=/)` gegen `taskpane.html`). Hier wird er als
// PRUEFSTANDS-ATTRAPPE gestellt, in der jsdom-Welt eines Testfalls. Ohne ihn tut KA3 fail-closed
// NICHTS (`ka3Vertrag()` liefert `null`), es gaebe keine Karte — und Pedis Auflage waere gar nicht
// pruefbar. Die Attrappe ist die Vorrichtung, nicht der Vertrag.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

/**
 * Die Ruhefrist wird AUS dem Aufgabenfenster gelesen, nicht hier abgeschrieben. Waere sie als Zahl
 * kopiert, pruefte der Test seine eigene Annahme — dieselbe Vorsicht wie bei `OFFICE_READY_TIMEOUT_MS`
 * in `w1-klara-lifecycle-taskpane.test.tsx:66-73`.
 */
const TASTENRUHE_MS = (() => {
  const treffer = /var KA3_TASTENRUHE_MS = (\d+);/.exec(HTML);
  if (!treffer) {
    throw new Error(`${TASKPANE}: KA3_TASTENRUHE_MS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

/**
 * Die Office-Erkennungsfrist, ebenfalls AUS dem Panel gelesen. Sie ist hier noetig, weil
 * `ka3EreignisBinden()` an `officeUsable()` haengt (`taskpane.html:5136`) und das wiederum an
 * `officeReady` (`:2390-2392`) — vor Ablauf der Frist bindet sich KA3 also gar nicht.
 */
const OFFICE_FRIST = (() => {
  const treffer = /var OFFICE_READY_TIMEOUT_MS = (\d+);/.exec(HTML);
  if (!treffer) {
    throw new Error(`${TASKPANE}: OFFICE_READY_TIMEOUT_MS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

const EREIGNISSE = { DocumentSelectionChanged: "documentSelectionChanged" } as const;
const COERCION = { Text: "text" } as const;
const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;

let officeHandler: Array<{ typ: string; fn: () => void }> = [];
/** Was die Attrappe des KA2-Vertrags zurueckgeben soll. */
let vertragsAntwort: unknown = null;
let vertragsAufrufe = 0;

/** Laedt das VOLLSTAENDIGE Aufgabenfenster: Markup, dann das unveraenderte Inline-Skript. */
async function ladeTaskpane(): Promise<void> {
  const skriptStart = HTML.lastIndexOf("<script>");
  const skriptEnde = HTML.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = HTML.slice(skriptStart + "<script>".length, skriptEnde);

  const bodyStart = HTML.indexOf("<body>");
  expect(bodyStart, `${TASKPANE}: <body> nicht gefunden`).toBeGreaterThan(0);
  const markup = HTML.slice(bodyStart + "<body>".length, skriptStart);
  // Fail-closed: waere das Markup leer, pruefte dieser Test ein leeres Dokument.
  expect(markup.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  document.body.innerHTML = markup;

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
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
    // OHNE `onReady` ruft das Panel `markOfficeChecked` nie (`taskpane.html:4489`), `officeReady`
    // bliebe `false` — und `ka3EreignisBinden()` kaeme nie durch `officeUsable()`. Der echte
    // Word-Host liefert `onReady`; die Attrappe bildet ihn ab, wie es `mega35/36/38` im Bestand tun.
    onReady: (cb: () => void) => cb(),
  };

  new Function(skript)();

  // Die Office-Erkennung ablaufen lassen: erst danach ist `officeUsable()` wahr. Ohne diesen
  // Schritt bindet sich KA3 nie, und jeder Fall unten pruefte ein totes Panel.
  await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 50);
  // Das Panel bindet zusaetzlich beim Fokus nach (`taskpane.html:5156`) — derselbe Weg, den ein
  // Anwender ausloest, wenn er ins Aufgabenfenster zurueckkehrt.
  window.dispatchEvent(new Event("focus"));
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
  }
}

/** Setzt die Vertragsattrappe — siehe Kopf: Vorrichtung, nicht Produktweg. */
function stelleVertrag(antwort: unknown): void {
  vertragsAntwort = antwort;
  vertragsAufrufe = 0;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = () => {
    vertragsAufrufe += 1;
    return Promise.resolve(vertragsAntwort);
  };
}

/** Das Markierungsereignis wirklich ausloesen — der einzige Aktivitaetsweg, den Word anbietet. */
function markierungGeaendert(): void {
  const treffer = officeHandler.filter((h) => h.typ === EREIGNISSE.DocumentSelectionChanged);
  expect(treffer.length, "KA3 hat sich nicht an DocumentSelectionChanged gebunden").toBeGreaterThan(
    0,
  );
  for (const h of treffer) {
    h.fn();
  }
}

/** Ein fokussierbares Feld aus dem ausgelieferten Markup — der „Cursor des Anwenders". */
function cursorFeld(): HTMLElement {
  const feld = document.querySelector("textarea, input[type='text'], input:not([type])");
  expect(feld, `${TASKPANE}: kein fokussierbares Eingabefeld im Markup`).not.toBeNull();
  return feld as HTMLElement;
}

async function warteAufKarte(): Promise<HTMLElement | null> {
  await vi.advanceTimersByTimeAsync(TASTENRUHE_MS + 50);
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
  return document.getElementById("ka3-karten");
}

beforeEach(() => {
  vi.useFakeTimers();
  officeHandler = [];
  vertragsAufrufe = 0;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

describe("KA3 · Pedis Auflage am VERHALTEN: die Karte kommt und geht, der Cursor bleibt", () => {
  it("DER KERNFALL: waehrend die Karte erscheint, wandert der Fokus nicht", async () => {
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });

    const feld = cursorFeld();
    feld.focus();
    expect(document.activeElement, "Vorbedingung: der Cursor sitzt im Feld").toBe(feld);

    markierungGeaendert();
    const karte = await warteAufKarte();

    // Die Karte ist wirklich da — sonst pruefte der Fall nichts.
    expect(karte, "die Karte ist nicht erschienen — der Fall waere leer").not.toBeNull();
    expect(vertragsAufrufe, "der Vertrag wurde nicht gerufen").toBeGreaterThan(0);
    // UND der Cursor steht unveraendert.
    expect(document.activeElement).toBe(feld);
  });

  it("und wenn sie GEHT, ebenfalls nicht — der zweite Halbsatz der Auflage", async () => {
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });

    const feld = cursorFeld();
    feld.focus();
    markierungGeaendert();
    expect(await warteAufKarte(), "Vorbedingung: die Karte war da").not.toBeNull();

    // Kein Treffer mehr → die Karte raeumt sich ab.
    stelleVertrag({ treffer: [] });
    markierungGeaendert();
    await warteAufKarte();

    expect(document.activeElement).toBe(feld);
  });

  it("KALIBRIERUNG: der Pruefstand KANN einen Fokuswechsel ueberhaupt sehen", async () => {
    await ladeTaskpane();
    const feld = cursorFeld();
    feld.focus();
    expect(document.activeElement).toBe(feld);

    // Ohne diesen Fall waere „der Fokus blieb" auch dann gruen, wenn jsdom Fokus gar nicht fuehrt.
    const anderes = document.createElement("input");
    document.body.appendChild(anderes);
    anderes.focus();
    expect(document.activeElement).not.toBe(feld);
  });

  it("die Karte meldet sich hoeflich: role=region und aria-live=polite, nie assertive", async () => {
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });
    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    expect(karte).not.toBeNull();
    expect(karte?.getAttribute("role")).toBe("region");
    // `polite` meldet, `assertive` unterbricht — Letzteres waere Fokusraub fuer Screenreader.
    expect(karte?.getAttribute("aria-live")).toBe("polite");
  });

  it("die erzeugte Karte enthaelt nichts, was den Fokus an sich zieht", async () => {
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });
    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    expect(karte).not.toBeNull();
    // Am ERZEUGTEN Baum gemessen, nicht am Quelltext: ein spaeter ergaenztes `tabindex` oder ein
    // `<dialog>` faellt hier auf, auch wenn es in keiner Verbotsliste steht.
    expect(karte?.querySelector("[autofocus]")).toBeNull();
    expect(karte?.querySelector("dialog")).toBeNull();
    expect(karte?.querySelector("[aria-live='assertive']")).toBeNull();
    expect(karte?.hasAttribute("tabindex")).toBe(false);
  });

  it("DER LEISE WEG: kein Popup, kein Autostart — und kein setInterval ausser dem Debounce", async () => {
    // §3.3 des Auftrags, am VERHALTEN gemessen: die Spione sitzen auf den globalen Funktionen und
    // zaehlen echte Aufrufe. Eine Quelltextsuche kann nur benannte Formen finden; hier faellt auch
    // ein Aufruf ueber eine Variable auf.
    const popup = {
      open: vi.spyOn(window, "open").mockReturnValue(null),
      alert: vi.spyOn(window, "alert").mockImplementation(() => {}),
      confirm: vi.spyOn(window, "confirm").mockReturnValue(false),
    };
    const takt = vi.spyOn(globalThis, "setInterval");

    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });
    const feld = cursorFeld();
    feld.focus();

    // KEIN AUTOSTART: ohne Markierungsereignis darf nie eine Karte entstehen — auch nicht, wenn
    // die Zeit vergeht und der Vertrag laengst steht.
    await warteAufKarte();
    expect(document.getElementById("ka3-karten"), "die Karte startet von selbst").toBeNull();

    // Erst das Ereignis loest aus.
    markierungGeaendert();
    expect(await warteAufKarte(), "Vorbedingung: jetzt ist die Karte da").not.toBeNull();

    expect(popup.open, "window.open gerufen").not.toHaveBeenCalled();
    expect(popup.alert, "alert gerufen").not.toHaveBeenCalled();
    expect(popup.confirm, "confirm gerufen").not.toHaveBeenCalled();
    expect(takt, "setInterval gerufen — KA3 haelt eine Frist, keinen Takt").not.toHaveBeenCalled();
    expect(document.activeElement, "und der Cursor sitzt weiterhin im Feld").toBe(feld);
  });

  it("DIE TASTENRUHE WIRKT: vor Ablauf der Frist erscheint nichts, und neue Aktivitaet setzt sie zurueck", async () => {
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", titel: "Wartungsplan Halle 2" }] });
    cursorFeld().focus();

    markierungGeaendert();
    // Kurz VOR Ablauf: noch nichts. Ohne diesen Fall waere „Debounce" nur ein Wort.
    await vi.advanceTimersByTimeAsync(TASTENRUHE_MS - 100);
    expect(document.getElementById("ka3-karten"), "die Karte kam zu frueh").toBeNull();

    // Neue Aktivitaet kurz vor Ablauf: die Frist beginnt von vorn — sonst flackerte die Karte
    // waehrend des Tippens, und genau das verbietet Pedis Auflage.
    markierungGeaendert();
    await vi.advanceTimersByTimeAsync(200);
    expect(
      document.getElementById("ka3-karten"),
      "die Frist wurde nicht zurueckgesetzt",
    ).toBeNull();

    // Und nach der vollen Ruhe erscheint sie.
    expect(await warteAufKarte(), "nach der Ruhe fehlt die Karte").not.toBeNull();
  });

  it("OHNE Vertrag bleibt es still — fail-closed, und auch dann kein Fokuswechsel", async () => {
    await ladeTaskpane();
    // Kein `stelleVertrag(...)`: `ka3Vertrag()` liefert null.
    const feld = cursorFeld();
    feld.focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    expect(karte, "ohne Vertrag darf keine Karte entstehen").toBeNull();
    expect(document.activeElement).toBe(feld);
  });
});
