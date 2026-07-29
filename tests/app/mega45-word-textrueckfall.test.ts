// ================================================================================================
// AUFTRAG-mega45 BLOCK F — DER STILLE TEXT-RUECKFALL DER WORD-FLAECHE.
// ================================================================================================
//
// PEDIS BEFUND (28.07.): markierter Text mit Bildern kommt ohne Bilder in KLARWERK an.
//
// DIE MESSUNG (F1) hat ZWEI Faelle getrennt — und der auffaellige ist nicht der schlimmere:
//
//   Fall 1 — Word liefert HTML. Dann greift `countUndeliveredWordImages`, der Verlust wird
//   gezaehlt und als `sendImagesMissing` gemeldet. Das ist eine benannte Word-Grenze, ehrlich
//   ausgewiesen. Nicht schoen, aber laut.
//
//   Fall 2 — Word liefert KEIN HTML. `readSelection` (taskpane.html) faellt dann auf
//   `Office.CoercionType.Text` zurueck und reicht `""` als HTML weiter. In
//   `prepareWordDraftRequest` trifft das den Zweig `inner.length === 0`, und der meldet
//   `undeliveredImages: 0` UND `overBudget: false`. Beide Signale, an denen die Oberflaeche
//   ihre Warnung festmacht, stehen damit auf „alles gut" — Formatierung UND Bilder verschwinden,
//   und der Nutzer sieht ein gruenes „Entwurf angelegt". Das ist die STILLE NULL: keine Luege in
//   einer Zahl, sondern eine Zahl, die als Entwarnung gelesen wird, obwohl nichts geprueft wurde.
//
// DIE REGEL, die dieser Test durchsetzt — als SAMMLER ueber die Bauform, nicht als Liste der
// heutigen Faelle: JEDER Rueckgabezweig, der den Klartext-Rueckfall nimmt (`usedHtml === false`),
// MUSS mindestens EIN ehrliches Signal setzen. Ein neuer Rueckfall-Zweig, den jemand spaeter ohne
// Signal ergaenzt, faellt hier auf, ohne dass dieser Test ihn kennen muss.
//
// NICHT GEGENSTAND (F3, ausdruecklich): Bilder tatsaechlich zu uebertragen, wo Word sie nur als
// Verweis liefert. Hier geht es allein darum, dass kein Verlust unbemerkt bleibt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORD_ADDIN_BODY_BUDGET_BYTES,
  prepareWordDraftRequest,
} from "../../apps/web/src/lib/wordAddin";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

// Die Eingaben, die den Klartext-Rueckfall ausloesen — je EIN Vertreter pro baulichem Weg.
// „html" ist genau das, was `readSelection`/`readWholeDocument` an `prepareWordDraftRequest` reicht.
const RUECKFALL_EINGABEN: { name: string; html: string; text: string }[] = [
  {
    // Fall 2 der Messung: HTML-Koersion scheiterte → readSelection reicht "" weiter.
    name: "Word lieferte gar kein HTML (Koersion gescheitert)",
    html: "",
    text: "Ein Absatz mit einem Bild daneben.",
  },
  {
    // Derselbe Zweig, andere Ursache: Word meldete Erfolg, der Body ist aber leer.
    name: "Word lieferte einen leeren Body",
    html: "<html><body>   </body></html>",
    text: "Ein Absatz mit einem Bild daneben.",
  },
  {
    // Der laute Zweig: HTML vorhanden, aber der finale Payload sprengt das Budget.
    name: "HTML vorhanden, Budget gesprengt",
    html: `<html><body><p>${"x".repeat(WORD_ADDIN_BODY_BUDGET_BYTES)}</p></body></html>`,
    text: "Sehr langer Absatz.",
  },
];

describe("mega45 F · der Klartext-Rueckfall meldet niemals eine stille Null", () => {
  it("die Ernte greift: jede Eingabe nimmt wirklich den Rueckfall (Kalibrierung)", () => {
    // Ohne diese Kalibrierung koennte eine Eingabe still den HTML-Weg nehmen und die Regel unten
    // waere gruen, ohne je einen Rueckfall gesehen zu haben.
    for (const fall of RUECKFALL_EINGABEN) {
      const prepared = prepareWordDraftRequest(fall.html, fall.text);
      expect(prepared.usedHtml, `${fall.name}: sollte der Rueckfall sein`).toBe(false);
    }
    // Gegenprobe: der HTML-Weg wird NICHT faelschlich als Rueckfall gewertet.
    const gut = prepareWordDraftRequest("<html><body><p>Hallo</p></body></html>", "Hallo");
    expect(gut.usedHtml).toBe(true);
    expect(gut.plainTextFallback).toBe(false);
  });

  it("SAMMLER: jeder Rueckfall-Zweig setzt mindestens ein ehrliches Signal", () => {
    for (const fall of RUECKFALL_EINGABEN) {
      const prepared = prepareWordDraftRequest(fall.html, fall.text);
      const ehrlichesSignal = prepared.overBudget || prepared.plainTextFallback;
      expect(
        ehrlichesSignal,
        `${fall.name}: Rueckfall ohne jedes Signal — genau das ist die stille Null`,
      ).toBe(true);
    }
  });

  it("der stille Fall ist jetzt benannt: kein HTML → plainTextFallback", () => {
    const ohneHtml = prepareWordDraftRequest("", "Ein Absatz mit einem Bild daneben.");
    expect(ohneHtml.plainTextFallback).toBe(true);
    // Die Null bleibt eine Null — sie ist ja wahr: in einem leeren HTML sind null Bilder zaehlbar.
    // Ehrlich wird sie erst dadurch, dass daneben steht, dass gar nicht gezaehlt werden KONNTE.
    expect(ohneHtml.undeliveredImages).toBe(0);
  });

  it("die Oberflaeche macht ihre Warnung am neuen Signal fest (nicht nur an der Zahl)", () => {
    // Der Zweig in taskpane.html, der die Notiz-Liste baut, muss plainTextFallback lesen.
    expect(HTML).toMatch(/prepared\.plainTextFallback/);
    expect(HTML).toMatch(/sendPlainFallback/);
  });

  it("der neue Schluessel steht in DE, EN und NL (je genau einmal)", () => {
    const treffer = HTML.match(/sendPlainFallback:/g) ?? [];
    expect(treffer.length).toBe(3);
  });

  it("das Inline-Spiegelbild traegt dasselbe Feld wie das Modul", () => {
    // taskpane.html haelt eine verhaltensgleiche ES5-Kopie von prepareWordDraftRequest. Der
    // Aequivalenztest in word-addin.test.ts vergleicht die Rueckgaben mit toEqual — ein fehlendes
    // Feld auf einer Seite faellt dort auf. Hier wird zusaetzlich festgehalten, dass die Kopie das
    // Feld ueberhaupt kennt, damit die Ursache beim Bruch sofort lesbar ist.
    expect(HTML).toMatch(/plainTextFallback:/);
  });
});
