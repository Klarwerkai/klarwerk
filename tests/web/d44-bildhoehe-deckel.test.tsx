// @vitest-environment jsdom
// ================================================================================================
// JOB 1880 · D1 (M-4, Anker D44-BILDHOEHE) — DER DECKEL WIRD ANGEWANDT, NICHT BEHAUPTET.
// ================================================================================================
//
// BEN heute Nacht, woertlich: „Ein Dateihash oder Grep-Treffer ersetzt diesen Verhaltensbeleg
// nicht."
//
// Deshalb prueft diese Datei KEINE Zeichenfolge in `index.css`. Sie laedt die ECHTE Datei aus dem
// Produkt, haengt sie als Stilblatt in ein Dokument und misst danach am DOM, was die Kaskade
// daraus macht — `getComputedStyle`. Wer den Deckel entfernt, macht diese Faelle rot; wer ihn nur
// umbenennt oder auskommentiert, ebenfalls.
//
// DIE ZWEI FLAECHEN, um die es geht, stehen in `RichTextEditor.tsx` untereinander:
//   :1804-1824  das contenteditable beim BEARBEITEN   -> hier deckelt der Deckel
//   :1843-1846  die Vorschau darunter (SanitizedHtml) -> hier NICHT, dort ist die Hoehe Inhalt
// Beide tragen `.prose-kw`. Der Unterschied ist das Attribut `contenteditable`, und genau daran
// haengt die Regel.
//
// WARUM DIE DATEI GEFILTERT WIRD, BEVOR SIE INS DOKUMENT GEHT: `index.css` ist eine
// Tailwind-Quelle mit `@tailwind` und `@apply`. Der CSS-Parser von jsdom kennt diese At-Regeln
// nicht und wirft beim Einlesen einen Teil des Blatts weg. Gefiltert wird deshalb NUR nach
// At-Regeln und `@apply`-Zeilen — die Selektoren und Eigenschaften, um die es hier geht, kommen
// UNVERAENDERT aus der Produktdatei. Was gemessen wird, ist der Text des Produkts, nicht eine
// Abschrift.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CSS_PFAD = resolve(process.cwd(), "apps/web/src/index.css");

/** Die Produktdatei, um die At-Regeln erleichtert, die jsdom nicht lesen kann. */
function stilblattAusDemProdukt(): string {
  const roh = readFileSync(CSS_PFAD, "utf8");
  return roh
    .split("\n")
    .filter((z) => !z.trim().startsWith("@"))
    .join("\n");
}

let stil: HTMLStyleElement;

beforeEach(() => {
  stil = document.createElement("style");
  stil.textContent = stilblattAusDemProdukt();
  document.head.appendChild(stil);
});

afterEach(() => {
  stil.remove();
  document.body.innerHTML = "";
});

/** Baut eine Flaeche mit `.prose-kw` und einem Bild darin; `editierend` setzt contenteditable. */
function flaecheMitBild(editierend: boolean): HTMLImageElement {
  const flaeche = document.createElement("div");
  flaeche.className = "prose-kw min-h-[260px] p-4";
  if (editierend) {
    flaeche.setAttribute("contenteditable", "true");
  }
  const bild = document.createElement("img");
  bild.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAAAAACw=");
  bild.setAttribute("alt", "hohes Bild");
  flaeche.appendChild(bild);
  document.body.appendChild(flaeche);
  return bild;
}

describe("JOB 1880 · D44-BILDHOEHE · der Deckel gilt beim Bearbeiten und nur dort", () => {
  it("B0 · VORAUSSETZUNG: das Stilblatt ist im Dokument angekommen", () => {
    // Ohne diesen Fall koennten B1 und B2 gruen sein, weil GAR NICHTS geladen wurde — dann
    // waere `maxHeight` ueberall leer und die Behauptung „draussen nicht gedeckelt" wertlos.
    const bild = flaecheMitBild(false);
    expect(
      getComputedStyle(bild).height,
      "die Regel `.prose-kw img { height: auto }` kommt nicht an — das Blatt fehlt",
    ).toBe("auto");
  });

  it("B1 · DER KERNFALL: im editierenden Bereich deckelt die Regel auf 320px", () => {
    const bild = flaecheMitBild(true);
    expect(
      getComputedStyle(bild).maxHeight,
      "im contenteditable `.prose-kw` fehlt der Deckel",
    ).toBe("320px");
  });

  it("B2 · DIE GRENZE: dasselbe Bild ausserhalb des editierenden Bereichs bleibt ungedeckelt", () => {
    const bild = flaecheMitBild(false);
    const gemessen = getComputedStyle(bild).maxHeight;
    expect(
      gemessen === "" || gemessen === "none",
      `in der Lesefassung darf kein Deckel stehen, gemessen: ${gemessen || "(leer)"}`,
    ).toBe(true);
  });

  it("B3 · die beiden Flaechen unterscheiden sich WIRKLICH — derselbe Bau, ein Attribut", () => {
    // Beide Baeume sind identisch bis auf `contenteditable`. Faellt dieser Fall, deckelt die Regel
    // entweder ueberall oder nirgends.
    const drinnen = getComputedStyle(flaecheMitBild(true)).maxHeight;
    const draussen = getComputedStyle(flaecheMitBild(false)).maxHeight;
    expect(drinnen, "drinnen ist nicht gedeckelt").toBe("320px");
    expect(draussen, "draussen ist gedeckelt — die Regel greift zu weit").not.toBe("320px");
  });

  it("B4 · die Zusicherung bleibt: der Deckel haengt an `.prose-kw`, nicht an der Oberflaeche", () => {
    // Ein contenteditable OHNE `.prose-kw` ist Oberflaeche, kein sanitisierter Fremdinhalt.
    // Der Kommentar bei `index.css:73` haelt genau diese Grenze fest.
    const flaeche = document.createElement("div");
    flaeche.setAttribute("contenteditable", "true");
    const bild = document.createElement("img");
    flaeche.appendChild(bild);
    document.body.appendChild(flaeche);
    expect(
      getComputedStyle(bild).maxHeight,
      "der Deckel greift ausserhalb von .prose-kw — die Begrenzung ist verletzt",
    ).not.toBe("320px");
  });
});
