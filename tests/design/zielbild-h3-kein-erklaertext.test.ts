// ================================================================================================
// JOB 3062 · H3 — DER TEXTMESSER: auf dem Blatt steht kein Erklärtext.
// ================================================================================================
//
// PEDI, 04.09. 06:50: „Das Erfassen von Wissen schreckt jeden ab … Text über Text über Text."
// Und 04.09. 07:58: „Orientiere dich an Pages … Behalte die klare Linie bei."
//
// WAS GEMESSEN WIRD — und warum genau das:
//
//   Gemessen wird die PROSA der Fläche unterhalb des Kopfbands: jeder sichtbare Textknoten, der
//   NICHT in einem Bedienelement steckt. Bedienelemente sind `button`, `a`, `select`, `option`,
//   `label`, `summary`, `input`, `[role=menuitem]` und das Textfeld selbst (`[role=textbox]`,
//   `[contenteditable]`). Das ist wörtlich der Abzug, den der Auftrag §7 nennt — „abzüglich Titel,
//   Text, Menüwerten und Knopfwörtern" — und es ist der einzige Schnitt, der die Frage beantwortet,
//   die Pedi gestellt hat: nicht „wie viele Knöpfe", sondern „wie viele SÄTZE".
//
// ================================================================================================
// JOB 3062 R6 — DER EDITOR IST NICHT MEHR AUSGENOMMEN. (bens Korrekturpflicht 3)
// ================================================================================================
//
// BIS R5 nahm dieser Messer `[data-testid="blatt-text"]` PAUSCHAL aus der Messung und erlaubte die
// Sätze des Editors danach in einer Ausnahmeliste (Fall „E"). Damit war die Zusage „auf dem Blatt
// steht kein Erklärtext" für den grössten Teil der Fläche gar nicht geprüft — ben hat das gemessen
// und den Freibrief zu Recht kassiert: „Textmeter über das gesamte sichtbare Blatt, ausgenommen
// ausschließlich echte Nutzereingaben sowie zulässige Bedienwörter."
//
// AB R6 LÄUFT DER MESSER ÜBER DAS GANZE BLATT, das Schreibfeld eingeschlossen. Ausgenommen bleibt
// nur, was der Auftrag ausnimmt: Bedienelemente (oben) und der Inhalt des Schreibfeldes selbst —
// also das, was der Mensch geschrieben hat. Die Ausnahmeliste ist ersatzlos weg; die beiden Sätze,
// die sie deckte, sind aus dem Blatt verschwunden und leben an ihren neuen Orten weiter
// (Titel-Menü und „?"-Menü, s. `Blatt.tsx`, `BLATT_EDITOR_CSS`).
//
// DER FALL „E" IST DAMIT KEIN OFFENER POSTEN MEHR, sondern die Gegenprobe dazu: er misst das
// Schreibfeld EINZELN und verlangt, dass ausser dem Platzhalter und dem eigenen Text NICHTS
// darin steht.
//
//   Übrig bleiben genau die Dinge, die verschwinden sollten: der Absatz des Standardweg-Kastens,
//   die Fußzeile „Weitere Wege: …", der Erklärsatz der Status-Karte, `fd.moreWaysBody`,
//   `fd.optionalAiHint`, `fd.writeToSubmit`, `intake.calming`, die Kicker und Überschriften der
//   drei alten Flächen. Am Basisstand 237b44c sind das mehrere hundert Zeichen; die Grenze ist 40.
//
// WARUM 40 UND NICHT 0: Der Rumpf des Blattes ist ein `contentEditable`, und sobald der Mensch
//   schreibt, kann jede Umgebung einen Rest führen (Trennzeichen, Aufzählungsmarken der Galerie).
//   40 Zeichen sind weniger als EIN Satz — die Grenze trifft Prosa und nicht Interpunktion.
//
// DER ZWEITE MESSPUNKT, DEN DIE ZEICHENZAHL NICHT LEISTEN KANN: Ein geschlossener `HelpTip` ist
//   ein Knopf mit einem SVG und OHNE Text — er trägt null Zeichen bei. Eine reine Zeichenzählung
//   würde 42 wieder eingebaute Hilfe-Tipps also nicht bemerken. Deshalb zählt der Fall H sie
//   ausdrücklich über ihr unverwechselbares Merkmal (`aria-label` = `help.open`). Genau das ist die
//   Gegenprobe aus §6: „einen Hilfe-Tipp wieder einfügen → Textmesser rot".
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Buehne, MOCKUP, buehneAufbauen, fn } from "./h3-blatt-buehne";

/** Die Grenze aus Auftrag §7. */
const GRENZE = 40;

const HUELLE = '[data-testid="blatt-huelle"]';

/** Der `aria-label` des Hilfe-Tipps (i18n `help.open`, Deutsch — die Bühne läuft auf Deutsch). */
const HILFE_MARKE = "Hilfe öffnen";

/**
 * In der Seite: die PROSA unterhalb des Kopfbands. Läuft den Baum ab `[data-testid="blatt-huelle"]`
 * ab und sammelt jeden Textknoten, dessen Vorfahren KEIN Bedienelement enthalten. Unsichtbare
 * Knoten (display:none, hidden) zählen nicht — sie stehen nicht auf der Fläche.
 */
const PROSA = `([wurzelSel, ausSel]) => {
  const wurzel = document.querySelector(wurzelSel);
  if (!wurzel) return null;
  const BEDIENT = 'button, a, select, option, label, summary, input, textarea, [role=menuitem], [role=textbox], [contenteditable], [data-testid="blatt-titel"]';
  const stuecke = [];
  const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let k = lauf.nextNode(); k !== null; k = lauf.nextNode()) {
    const text = (k.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text) continue;
    const el = k.parentElement;
    if (!el) continue;
    if (el.closest(BEDIENT)) continue;
    if (ausSel && el.closest(ausSel)) continue;
    // SICHTBAR heisst: das Element hat eine Flaeche. display:none an IRGENDEINEM Vorfahren
    // erzeugt keine Rechtecke — die reine Pruefung des eigenen Stils wuerde verborgene Zweige
    // mitzaehlen und den Messer kuenstlich rot machen.
    if (el.getClientRects().length === 0) continue;
    const stil = getComputedStyle(el);
    if (stil.visibility === 'hidden' || stil.opacity === '0') continue;
    stuecke.push(text);
  }
  return stuecke;
}`;

const HILFEN = `(marke) => document.querySelectorAll('button[aria-label="' + marke + '"]').length`;

const mockupDa = existsSync(MOCKUP);

describe.runIf(mockupDa)("JOB 3062 · H3 · Textmesser — auf dem Blatt steht kein Erklärtext", () => {
  let leer: Buehne;
  let voll: Buehne;
  const INHALT = "Hohlprofile in Spritzzonen sind zu vermeiden.";

  beforeAll(async () => {
    leer = await buehneAufbauen("/erfassen");
    // Das Blatt MIT INHALT entsteht über den echten Deep-Link des Produkts (`?text=`), nicht über
    // eine nachgestellte Tastatureingabe — gemessen wird, was ein Mensch wirklich sieht.
    voll = await buehneAufbauen(`/erfassen/neu?text=${encodeURIComponent(INHALT)}`);
  }, 180_000);

  afterAll(async () => {
    await leer?.schliessen();
    await voll?.schliessen();
  }, 60_000);

  /**
   * Die Prosa der GANZEN Fläche — Schreibfeld eingeschlossen (R6). Der zweite Parameter des
   * Messers, mit dem R5 den Editor pauschal ausnahm, bleibt bewusst `null`: es gibt keinen
   * ausgenommenen Bereich mehr.
   */
  async function prosa(b: Buehne): Promise<string[]> {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    const stuecke = await b.seite.evaluate<string[] | null>(fn(PROSA), [HUELLE, null]);
    expect(stuecke, "Blatt-Hülle nicht gefunden").not.toBeNull();
    return stuecke ?? [];
  }

  /** Die Prosa IM Schreibfeld allein — die Gegenprobe zum Umzug der zwei Editor-Sätze (Fall E). */
  async function prosaImFeld(b: Buehne): Promise<string[]> {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    const stuecke = await b.seite.evaluate<string[] | null>(fn(PROSA), [
      '[data-testid="blatt-text"]',
      null,
    ]);
    return stuecke ?? [];
  }

  it("T1 · LEERES Blatt: die Prosa unterhalb des Kopfbands ist höchstens 40 Zeichen lang", async () => {
    const stuecke = await prosa(leer);
    const laenge = stuecke.join(" ").length;
    console.info(`JOB 3062 H3 · Textmesser leer · ${laenge} Zeichen · ${JSON.stringify(stuecke)}`);
    expect(laenge, `Prosa auf dem leeren Blatt: ${JSON.stringify(stuecke)}`).toBeLessThanOrEqual(
      GRENZE,
    );
  });

  it("T2 · Blatt MIT INHALT: die Prosa unterhalb des Kopfbands ist höchstens 40 Zeichen lang", async () => {
    const stuecke = await prosa(voll);
    const laenge = stuecke.join(" ").length;
    console.info(`JOB 3062 H3 · Textmesser voll · ${laenge} Zeichen · ${JSON.stringify(stuecke)}`);
    expect(laenge, `Prosa auf dem gefüllten Blatt: ${JSON.stringify(stuecke)}`).toBeLessThanOrEqual(
      GRENZE,
    );
  });

  it("T3 · der Deep-Link-Inhalt steht wirklich IM Blatt (sonst misst T2 ein leeres Blatt)", async () => {
    expect(voll.fehler).toBeNull();
    const imFeld = await voll.seite.evaluate<string>(
      fn(
        `() => (document.querySelector('[data-testid="blatt-text"] [role=textbox]') || {}).textContent || ''`,
      ),
    );
    expect(imFeld).toContain(INHALT);
  });

  it("E · das Schreibfeld trägt nur noch, was der Mensch selbst hineinschreibt", async () => {
    // ============================================================================================
    // DIE GEGENPROBE ZUM UMZUG — UND DER PIN, DER IHN HÄLT.
    // ============================================================================================
    //
    // Das Schreibfeld des Blattes IST der vorhandene `RichTextEditor` — bewusst, denn er trägt den
    // einen Bildweg des Produkts (Rasterprüfung, Verankerung, Beschreibungspflicht, Galerie). Eine
    // zweite Editorfassung wäre eine zweite Wahrheit.
    //
    // Er brachte aber zwei eigene Sätze mit, und `apps/web/src/components/RichTextEditor.tsx` liegt
    // NICHT in den Zielpfaden von JOB 3062. Beide sind deshalb VON AUSSEN aus dem Blatt genommen
    // (`Blatt.tsx`, `BLATT_EDITOR_CSS`) und leben an ihrem neuen Ort weiter:
    //
    //   · `editor.titleSuggest.*` — die gerahmte Titelzeile über dem Schreibfeld (JOB 2954 D3).
    //     Ihre Funktion steht jetzt im TITEL-MENÜ des Blattes, aus derselben Rangfolge
    //     (`lib/titelRangfolge.ts`) und mit denselben Schlüsseln. Gemessen in
    //     `h3-funktionsinventar.test.ts` (Fall „Titelvorschlag").
    //   · `editor.drop.hintImagesOnly` — der Ablagehinweis. Sein Text steht im „?"-Menü, mit
    //     demselben Schlüssel (Fall H3 unten).
    //
    // WAS HIER ÜBRIG BLEIBEN DARF, ist genau zweierlei: der Platzhalter des leeren Blattes und der
    // Text, den der Mensch geschrieben hat. Kommt EIN Satz zurück, wird dieser Fall rot — und mit
    // ihm T1/T2, denn seit R6 misst der Messer auch hier.
    const erlaubt = new Set(["Text", INHALT.replace(/\.$/, "")]);
    for (const b of [leer, voll]) {
      const stuecke = await prosaImFeld(b);
      console.info(`JOB 3062 H3 · Schreibfeld · ${JSON.stringify(stuecke)}`);
      expect(
        stuecke.filter((x) => !erlaubt.has(x)),
        "Satz im Schreibfeld, der weder Platzhalter noch eigener Text ist",
      ).toEqual([]);
    }
  });

  it("H3 · der Ablagehinweis ist nicht gelöscht — er steht im „?“-Menü, mit demselben Schlüssel", async () => {
    // Ehrlichkeit vor Optik: „weg von der Fläche" darf nicht „weg aus dem Produkt" heissen. Der Satz
    // wird deshalb DORT gesucht, wo §5 ihn hinverweist — und zwar als sichtbarer Text, nicht als
    // vorhandener Schlüssel.
    expect(leer.fehler).toBeNull();
    // `await` zwischen Klick und Messung: React rendert erst nach dem Klick-Handler. Ohne die
    // Pause misst dieser Fall den Zustand VOR dem Öffnen — und liesse das Menü offen zurück,
    // was den Ruhezustand der folgenden Fälle verfälschte (in R6 einmal passiert, deshalb hier).
    const gefunden = await leer.seite.evaluate<string>(
      fn(`async () => {
        const warte = () => new Promise((r) => setTimeout(r, 50));
        const w = document.querySelector('[data-testid="blatt-werkzeug-hilfe"]');
        w.click();
        await warte();
        const d = document.querySelector('[data-testid="blatt-hilfe-ablage"]');
        const text = d ? (d.textContent || '') : '';
        w.click();
        await warte();
        return text;
      }`),
    );
    expect(gefunden).toContain("Bilder hierher ziehen");
  });

  it("H · KEIN EINZIGER Hilfe-Tipp steht auf der Fläche — weder leer noch gefüllt", async () => {
    expect(leer.fehler).toBeNull();
    expect(voll.fehler).toBeNull();
    expect(await leer.seite.evaluate<number>(fn(HILFEN), HILFE_MARKE)).toBe(0);
    expect(await voll.seite.evaluate<number>(fn(HILFEN), HILFE_MARKE)).toBe(0);
  });

  it("H2 · und die Hilfe ist trotzdem da: das „?“-Werkzeug öffnet sie als Menüfläche", async () => {
    expect(leer.fehler).toBeNull();
    const themenVorher = await leer.seite.evaluate<number>(
      fn(`() => document.querySelectorAll('[data-testid="blatt-menue-hilfe"] details').length`),
    );
    await leer.seite.evaluate(
      fn(`() => document.querySelector('[data-testid="blatt-werkzeug-hilfe"]').click()`),
    );
    const themenNachher = await leer.seite.evaluate<number>(
      fn(`() => document.querySelectorAll('[data-testid="blatt-menue-hilfe"] details').length`),
    );
    // Zu = keine Themen; offen = das ganze Register (`components/erfassen/hilfe.ts`): die 23 Themen
    // der Hilfekarte, die acht Themen mit eigenen Schlüsseln und der Ablagehinweis = 32.
    // WELCHE Themen es sind, misst `h3-funktionsinventar.test.ts` einzeln gegen die Kennungen des
    // Basisstandes; hier steht nur, dass das Menü die Hilfe erst auf Klick zeigt.
    expect(themenVorher).toBe(0);
    expect(themenNachher).toBe(32);
    // Wieder schliessen, damit die übrigen Fälle die Ruhelage messen.
    await leer.seite.evaluate(
      fn(`() => document.querySelector('[data-testid="blatt-werkzeug-hilfe"]').click()`),
    );
  });

  it("K · KALIBRIERUNG: der Messer findet Prosa, wenn welche da ist", async () => {
    expect(leer.fehler).toBeNull();
    const vorher = (await prosa(leer)).join(" ").length;
    await leer.seite.evaluate(
      fn(`() => {
        const p = document.createElement('p');
        p.id = 'h3-kalibrier-satz';
        p.textContent = 'Dieser eingeschmuggelte Erklärsatz muss den Textmesser rot machen, sonst misst er nichts.';
        document.querySelector('[data-testid="blatt-huelle"]').appendChild(p);
      }`),
    );
    const nachher = (await prosa(leer)).join(" ").length;
    await leer.seite.evaluate(fn(`() => document.getElementById('h3-kalibrier-satz')?.remove()`));
    expect(nachher).toBeGreaterThan(GRENZE);
    expect(nachher).toBeGreaterThan(vorher);
    expect((await prosa(leer)).join(" ").length).toBe(vorher);
  });
});

describe.runIf(!mockupDa)("JOB 3062 · H3 · Textmesser übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
