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

    // KEIN AUTOSTART — praezisiert in JOB 1571 D13 (Chefentscheidung 22.08. 05:15).
    //
    // Bis KA2 gebaut war, lief der zugesicherte Oeffnungsanlass (`taskpane.html`,
    // `ka3Ausfuehren("oeffnen")`) ins Leere: `ka3Vertrag()` fand nichts, also entstand keine
    // Karte, und „nach dem Laden ist nichts da" war zufaellig dasselbe wie „kein Autostart".
    // Mit Regel A steht der Vertrag beim Laden IMMER — der Anlass feuert erfolgreich, und die
    // Karte entsteht, bevor dieser Fall seine erste Zeile ausfuehrt. Ein `toBeNull()` haette
    // damit den zugesicherten Anlass aus `JOB 1151` gemessen, nicht den Autostart.
    //
    // Gemessen wird deshalb ab HIER, nach dem Anlass: ohne ein weiteres Ereignis darf NICHTS
    // NEUES entstehen. Das ist die Zusage, die dieser Fall meint — und sie ist schaerfer als
    // vorher, weil sie zwei Groessen festhaelt statt einer.
    const nachAnlass = document.getElementById("ka3-karten");
    const aufrufeNachAnlass = vertragsAufrufe;

    await warteAufKarte();
    expect(
      document.getElementById("ka3-karten"),
      "ohne Ereignis ist eine NEUE Karte entstanden — Autostart",
    ).toBe(nachAnlass);
    expect(vertragsAufrufe, "ohne Ereignis wurde der Vertrag erneut gerufen — Autostart").toBe(
      aufrufeNachAnlass,
    );

    // Erst das Ereignis loest aus — und dann genau einmal.
    markierungGeaendert();
    expect(await warteAufKarte(), "Vorbedingung: jetzt ist die Karte da").not.toBeNull();
    expect(vertragsAufrufe, "das Ereignis hat den Vertrag nicht gerufen").toBe(
      aufrufeNachAnlass + 1,
    );

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

    // Praezisiert in JOB 1571 D13: Gemessen wird ab NACH dem zugesicherten Oeffnungsanlass.
    // Die Frist zeigt sich am VERTRAGSAUFRUF, nicht am blossen Fehlen der Karte — seit Regel A
    // steht nach dem Laden ohnehin eine, und ein `toBeNull()` haette den Anlass gemessen statt
    // die Ruhefrist. Der Aufrufzaehler ist die schaerfere Groesse: er faellt auch dann auf,
    // wenn die Karte zufaellig gleich aussieht.
    const aufrufeNachAnlass = vertragsAufrufe;

    markierungGeaendert();
    // Kurz VOR Ablauf: noch nichts. Ohne diesen Fall waere „Debounce" nur ein Wort.
    await vi.advanceTimersByTimeAsync(TASTENRUHE_MS - 100);
    expect(vertragsAufrufe, "die Frist lief zu frueh ab").toBe(aufrufeNachAnlass);

    // Neue Aktivitaet kurz vor Ablauf: die Frist beginnt von vorn — sonst flackerte die Karte
    // waehrend des Tippens, und genau das verbietet Pedis Auflage.
    markierungGeaendert();
    await vi.advanceTimersByTimeAsync(200);
    expect(vertragsAufrufe, "die Frist wurde nicht zurueckgesetzt").toBe(aufrufeNachAnlass);

    // Und nach der vollen Ruhe erscheint sie — genau einmal, nicht zweimal.
    expect(await warteAufKarte(), "nach der Ruhe fehlt die Karte").not.toBeNull();
    expect(vertragsAufrufe, "die Ruhe hat den Vertrag nicht genau einmal gerufen").toBe(
      aufrufeNachAnlass + 1,
    );
  });

  it("OHNE Vertrag bleibt es still — fail-closed, und auch dann kein Fokuswechsel", async () => {
    await ladeTaskpane();

    // Praezisiert in JOB 1571 D13 (Auflage 2) — ein ECHTER vertragsfreier Zustand.
    //
    // „Kein `stelleVertrag(...)`" genuegt seit Regel A nicht mehr: Das Panel setzt
    // `window.klaraBestandsblick` beim Laden unbedingt, `ka3Vertrag()` findet also IMMER etwas.
    // Den Ort VOR dem Laden zu raeumen wirkt ebenfalls nicht — Regel A ueberschreibt es; in
    // JOB 1571 D9 dreimal gemessen. Der einzige Zeitpunkt, an dem der Vertragsort wirklich leer
    // ist, liegt NACH dem Laden. Genau hier wird er geraeumt, und ab hier prueft der Fall, was
    // er behauptet: KA3 schweigt ohne Anbieter.
    // JOB 1571 D14: Der Vertragsort wird geraeumt UND beobachtet.
    //
    // In D13 mass dieser Fall nur das ERGEBNIS: entsteht eine Karte? Ohne Anbieter entsteht
    // keine — also blieb er gruen, obwohl der Autostart-VERSUCH stattgefunden hatte. Genau das
    // hat KA2 sichtbar gemacht: Der Oeffnungsanlass lief jahrelang ins Leere, weil
    // `ka3Vertrag()` nichts fand, und war die ganze Zeit da. **Ein Versuch, der ins Leere
    // laeuft, ist trotzdem ein Versuch.**
    //
    // Deshalb ein Zaehler am Vertragsort selbst: `ka3Ausfuehren` liest ihn als ERSTES
    // (`taskpane.html`, `var vertrag = ka3Vertrag();`) — noch VOR der Anbieterpruefung. Jeder
    // Lesezugriff ist damit ein Ausfuehrungsversuch, unabhaengig davon, ob ein Anbieter da ist
    // und ob eine Karte entsteht. Der Wert bleibt `undefined`: der Zustand ist weiterhin
    // vertragsfrei, die fail-closed-Zusage unveraendert.
    let hinterlegt: unknown;
    let versuche = 0;
    Object.defineProperty(window, "klaraBestandsblick", {
      configurable: true,
      get() {
        versuche += 1;
        return hinterlegt;
      },
      set(wert: unknown) {
        hinterlegt = wert;
      },
    });
    expect(
      (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick,
      "Vorbedingung: der Vertragsort ist wirklich leer",
    ).toBeUndefined();
    versuche = 0;

    const nachAnlass = document.getElementById("ka3-karten");
    // NICHT nur die Elementidentitaet festhalten, sondern den INHALT: `ka3KarteElement()`
    // verwendet einen vorhandenen Kasten wieder (`taskpane.html`, „wird beim ersten Bedarf
    // erzeugt"), also bliebe `toBe(nachAnlass)` auch dann wahr, wenn KA3 die Karte neu
    // beschriebe. In D13 gemessen: mit einem erfundenen Ersatzanbieter blieb der Fall gruen,
    // solange nur die Identitaet geprueft wurde — der Inhalt entlarvt ihn.
    const inhaltNachAnlass = nachAnlass?.textContent ?? null;
    const aufrufeNachAnlass = vertragsAufrufe;

    const feld = cursorFeld();
    feld.focus();
    markierungGeaendert();
    await warteAufKarte();

    // DER KERN: GENAU EIN Ausfuehrungsversuch — der des Markierungsereignisses. Jeder weitere
    // waere ein Autostart, auch wenn er mangels Anbieter folgenlos bleibt.
    expect(versuche, "es gab mehr Ausfuehrungsversuche als das eine Ereignis — Autostart").toBe(1);

    // Fail-closed: kein Aufruf, kein neuer Kasten, kein neuer Inhalt — und der Cursor bleibt.
    expect(vertragsAufrufe, "ohne Vertrag wurde trotzdem gerufen").toBe(aufrufeNachAnlass);
    expect(
      document.getElementById("ka3-karten"),
      "ohne Vertrag ist eine neue Karte entstanden",
    ).toBe(nachAnlass);
    expect(
      document.getElementById("ka3-karten")?.textContent ?? null,
      "ohne Vertrag wurde die Karte neu beschrieben — fail-open",
    ).toBe(inhaltNachAnlass);
    expect(document.activeElement).toBe(feld);

    // Den Beobachter wieder abbauen, damit er nicht in den naechsten Fall leckt.
    Reflect.deleteProperty(window, "klaraBestandsblick");
  });

  // ==============================================================================================
  // C3 und C4 (JOB 1963 · D2) — DIE WERTUNG WIRD SICHTBAR.
  //
  // WARUM DIESE FAELLE HIER STEHEN und nicht in einer neuen Datei: sie brauchen genau das, was
  // dieser Pruefstand schon aufbaut — das GEMOUNTETE Fenster, den echten Anlass
  // (`DocumentSelectionChanged`) und den echten Weg `ka3Planen -> ka3Ausfuehren -> ka3Zeichnen`.
  // Ein Quelltext-Pin wuerde nur belegen, dass etwas dasteht; hier zeichnet der Renderer wirklich.
  // (Und: der Inventar-Waechter zaehlt Dateien im Baum — eine neue Datei waere ein zweiter Preis
  // fuer denselben Beleg.)
  //
  // DIE FUELLSTELLE IST HEUTE LEER: kein Anbieter im Produkt schickt `deviatesFrom`. Der Renderer
  // ist gebaut und wird gerufen; was fehlt, ist die Wertung selbst. Die Attrappe stellt sie —
  // genau wie sie den Vertrag stellt, den KA2 im Produkt haelt.
  // ==============================================================================================

  it("C3-1 · die Wertung erscheint im Wortlaut des Registers, mit der validierten Anweisung darin", async () => {
    await ladeTaskpane();
    stelleVertrag({
      treffer: [
        {
          id: "ko-1",
          title: "Wartungsplan Halle 2",
          deviatesFrom: "Ventil vor jeder Wartung drucklos schalten.",
        },
      ],
    });

    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    expect(karte, "die Karte ist nicht erschienen — der Fall waere leer").not.toBeNull();
    const text = karte?.textContent ?? "";
    // Der Wortlaut steht im Register und ist deshalb hier woertlich erwartet, nicht sinngemaess.
    expect(text, "der Wortlaut des Registers steht nicht auf der Karte").toContain(
      "Deine Formulierung weicht ab von: Ventil vor jeder Wartung drucklos schalten.",
    );
    // Und kein roher Schluessel — die Fuellstelle wurde wirklich ersetzt.
    expect(text).not.toContain("{anweisung}");
    expect(text).not.toMatch(/\bklaraOffer[A-Z]/);
  });

  it("C3-2 · sie folgt der Sprache — de, en und nl, ohne rohen Schluessel", async () => {
    await ladeTaskpane();
    stelleVertrag({
      treffer: [{ id: "ko-1", title: "Wartungsplan Halle 2", deviatesFrom: "Anweisung A" }],
    });
    cursorFeld().focus();
    markierungGeaendert();
    expect(await warteAufKarte(), "Vorbedingung: die Karte war da").not.toBeNull();

    const erwartet: Record<string, string> = {
      de: "Deine Formulierung weicht ab von: Anweisung A",
      en: "Your wording deviates from: Anweisung A",
      nl: "Je formulering wijkt af van: Anweisung A",
    };
    for (const sprache of ["en", "nl", "de"]) {
      (document.getElementById(`lang-${sprache}`) as HTMLElement).click();
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve();
      }
      const text = document.getElementById("ka3-karten")?.textContent ?? "";
      expect(text, `${sprache}: die Wertung steht nicht in dieser Sprache da`).toContain(
        erwartet[sprache],
      );
      expect(text, `${sprache}: ein roher Schluessel ist sichtbar`).not.toMatch(
        /\bklaraOffer[A-Z]/,
      );
    }
  });

  it("C4-1 · OHNE Wertung sieht die Karte aus wie heute — kein leeres Feld, keine Platzhalterzeile", async () => {
    // Der teuerste der vier Faelle: er haelt fest, dass der Bau NICHTS an der heutigen Karte
    // aendert. Verglichen wird der vollstaendige Text, nicht ein Ausschnitt.
    await ladeTaskpane();
    stelleVertrag({ treffer: [{ id: "ko-1", title: "Wartungsplan Halle 2" }] });
    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    expect(karte).not.toBeNull();
    const text = karte?.textContent ?? "";
    expect(text, "ohne Wertung steht trotzdem eine Wertungszeile da").not.toContain("weicht ab");
    expect(text, "ein roher Schluessel ist sichtbar").not.toMatch(/\bklaraOffer[A-Z]/);
    // Und struktrell: die Zeile traegt keinen zusaetzlichen Block.
    const zeile = karte?.querySelector("li");
    expect(zeile?.querySelector("div"), "ohne Wertung ist ein leeres Feld entstanden").toBeNull();
  });

  it("C4-2 · die Wertung kommt ZUSAETZLICH — Titel, Status und Weg bleiben, wo sie waren", async () => {
    await ladeTaskpane();
    stelleVertrag({
      treffer: [
        {
          id: "ko-1",
          title: "Wartungsplan Halle 2",
          // Das Vokabular ist das VORHANDENE der Quellen-Ampel (`ASK_STATUS_KEYS`,
          // taskpane.html:3759-3764) — `validiert`, nicht `validated`.
          status: "validiert",
          deviatesFrom: "Anweisung A",
        },
      ],
    });
    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();

    const zeile = karte?.querySelector("li");
    expect(zeile, "die Trefferzeile fehlt").not.toBeNull();
    // Der Titel steht weiterhin da …
    expect(zeile?.textContent ?? "").toContain("Wartungsplan Halle 2");
    // … die Statuspille auch …
    expect(zeile?.querySelector(".src-badge"), "die Statuspille ist verschwunden").not.toBeNull();
    // … und der Weg zum Objekt ebenso, mit unveraendertem Ziel und Schutz.
    const weg = zeile?.querySelector("a");
    expect(weg, "der Weg zum Objekt ist verschwunden").not.toBeNull();
    expect(weg?.getAttribute("rel")).toBe("noopener noreferrer");
    // Die Wertung steht darunter, nicht an ihrer Stelle.
    expect(zeile?.textContent ?? "").toContain("Deine Formulierung weicht ab von: Anweisung A");
  });

  it("C4-3 · FAIL-CLOSED: was kein nichtleerer Text ist, wird keine Wertung", async () => {
    // Leerzeichen, leerer String, Zahl, Objekt — keiner davon darf eine Zeile erzeugen. Eine
    // Wertung, die niemand geschickt hat, waere eine Behauptung ueber den Bestand.
    for (const wert of ["   ", "", 42, { text: "x" }, null]) {
      document.body.innerHTML = "";
      Reflect.deleteProperty(window, "klaraBestandsblick");
      await ladeTaskpane();
      stelleVertrag({
        treffer: [{ id: "ko-1", title: "Wartungsplan Halle 2", deviatesFrom: wert }],
      });
      cursorFeld().focus();
      markierungGeaendert();
      const karte = await warteAufKarte();

      const text = karte?.textContent ?? "";
      expect(text, `aus ${JSON.stringify(wert)} wurde eine Wertung`).not.toContain("weicht ab");
      expect(text, `${JSON.stringify(wert)}: der Rohwert steht auf der Karte`).not.toContain("42");
    }
  });

  // ==============================================================================================
  // C5 (JOB 1963 · D4) — DER ERZEUGER DER WERTUNG, AM GERENDERTEN ERGEBNIS GEMESSEN.
  //
  // §RENDER: nicht „Zeile X setzt das Feld", sondern die Kette laeuft und der Text steht in der
  // AUSGABE. Diese Faelle fahren deshalb den WIRKLICHEN Erzeuger:
  //
  //   Antwort von /api/check-text  ->  w6DublettenAusCheckText (aus der ausgelieferten Datei
  //   geschnitten und ausgefuehrt)  ->  ka3Normalisieren  ->  ka3Zeichnen  ->  Text der Karte
  //
  // Nichts davon wird gestellt ausser der HTTP-Antwort selbst. Der Erzeuger wird nicht
  // nachgebaut und die Trefferform nicht von Hand gesetzt — sonst pruefte der Fall seine eigene
  // Annahme statt den Bau.
  // ==============================================================================================

  type W6Weg = (
    grund: string,
    leseText: (grund: string) => unknown,
    fetchFn: (url: string, init: Record<string, unknown>) => Promise<unknown>,
    sprache?: string,
  ) => Promise<{ treffer: { id: string; title: string; deviatesFrom: string | null }[] }>;

  /** Der ausgelieferte Erzeuger — geschnitten und ausgefuehrt, nicht gelesen. */
  function ausgelieferterW6Weg(): W6Weg {
    const start = HTML.indexOf("// KW-KLARA-W6-CHECKTEXT-START");
    const ende = HTML.indexOf("// KW-KLARA-W6-CHECKTEXT-END");
    expect(start, `${TASKPANE}: der W6-Block ist nicht auffindbar`).toBeGreaterThan(0);
    expect(ende, `${TASKPANE}: das Ende des W6-Blocks fehlt`).toBeGreaterThan(start);
    const block = HTML.slice(start, ende);
    // Die zwei Laengengrenzen stehen ausserhalb der Schnittmarken (sie tragen die Begruendung mit
    // den Zeilennummern der Route); fuer den Schnitt werden sie hier gestellt.
    const fabrik = new Function(
      `var W6_MINDESTZEICHEN = 40; var W6_HOECHSTZEICHEN = 8000;${block} return w6DublettenAusCheckText;`,
    );
    return fabrik() as W6Weg;
  }

  const NUTZERTEXT =
    "Ventil vor jeder Wartung drucklos schalten und gegen Wiedereinschalten sichern.";

  /** Eine Antwort der Route stellen — mehr wird nicht gestellt. */
  function routenAntwort(duplicates: unknown[]) {
    return (_url: string, _init: Record<string, unknown>) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ duplicates, conflicts: [] }) });
  }

  /**
   * Die ganze Kette bis zum gerenderten Text. Der Rueckgabewert des ECHTEN Erzeugers wird als
   * KA2-Attrappe gestellt — genau die Uebergabestelle, die KA3 im Betrieb konsumiert.
   */
  async function karteAusRoutenantwort(duplicates: unknown[]): Promise<string> {
    const ergebnis = await ausgelieferterW6Weg()(
      "tastenruhe",
      () => NUTZERTEXT,
      routenAntwort(duplicates),
      "de",
    );
    await ladeTaskpane();
    stelleVertrag(ergebnis);
    cursorFeld().focus();
    markierungGeaendert();
    const karte = await warteAufKarte();
    expect(karte, "die Karte ist nicht erschienen — der Fall waere leer").not.toBeNull();
    return karte?.textContent ?? "";
  }

  it("C5-1 · RENDERBELEG: aus einer echten Routenantwort entsteht die sichtbare Wertung", async () => {
    const text = await karteAusRoutenantwort([
      {
        koId: "ko-1",
        koTitle: "Wartungsplan Halle 2",
        relation: "teilweise",
        method: "deterministic",
      },
    ]);

    // Gelesen wird die AUSGABE der Karte, nicht der Quelltext.
    expect(text, "die Wertung steht nicht auf der gezeichneten Karte").toContain(
      "Deine Formulierung weicht ab von: Wartungsplan Halle 2",
    );
    expect(text, "ein roher Schluessel ist sichtbar").not.toMatch(/\bklaraOffer[A-Z]/);
    expect(text).not.toContain("{anweisung}");
  });

  it("C5-2 · `identisch` erzeugt KEINE Wertung — der Text IST die Anweisung", async () => {
    const text = await karteAusRoutenantwort([
      {
        koId: "ko-1",
        koTitle: "Wartungsplan Halle 2",
        relation: "identisch",
        method: "deterministic",
      },
    ]);

    // Der Treffer steht auf der Karte …
    expect(text, "der Treffer selbst ist verschwunden").toContain("Wartungsplan Halle 2");
    // … aber „weicht ab" waere hier eine Falschaussage.
    expect(text, "aus `identisch` wurde eine Abweichung").not.toContain("weicht ab");
  });

  it("C5-3 · alle vier benannten Abweichungen erzeugen sie, ein unbekannter Wert nicht", async () => {
    for (const relation of ["a_enthaelt_b", "b_enthaelt_a", "teilweise", "verwandt"]) {
      document.body.innerHTML = "";
      Reflect.deleteProperty(window, "klaraBestandsblick");
      const text = await karteAusRoutenantwort([
        { koId: "ko-1", koTitle: "Anweisung A", relation, method: "deterministic" },
      ]);
      expect(text, `${relation}: keine Wertung gezeichnet`).toContain(
        "Deine Formulierung weicht ab von: Anweisung A",
      );
    }

    // Fail-closed: ein Wert, den das Vokabular nicht kennt, behauptet nichts.
    for (const relation of ["unsicher", "verschieden", "", undefined]) {
      document.body.innerHTML = "";
      Reflect.deleteProperty(window, "klaraBestandsblick");
      const text = await karteAusRoutenantwort([
        { koId: "ko-1", koTitle: "Anweisung A", relation, method: "deterministic" },
      ]);
      expect(text, `aus ${JSON.stringify(relation)} wurde eine Wertung`).not.toContain("weicht ab");
    }
  });

  it("C5-4 · ohne benennbare Anweisung bleibt der Satz ungesagt statt angefangen", async () => {
    // Ein Treffer ohne Titel: „weicht ab von: " mit leerem Ende waere ein angefangener Satz.
    const text = await karteAusRoutenantwort([
      { koId: "ko-1", koTitle: "   ", relation: "teilweise", method: "deterministic" },
    ]);

    expect(text, "ein angefangener Satz steht auf der Karte").not.toContain("weicht ab");
  });
});
