// ================================================================================================
// R-1054 · DER WIRKUNGSLOSE TOPK-REGLER BLEIBT AUS DER OBERFLÄCHE — UND DER DECKEL BLEIBT, WO ER IST.
// ================================================================================================
//
// Entscheidungsakte J19/JOB 591 vom 13.08.: „Entfernen — was nicht wirkt, gehört nicht in die
// Oberfläche." Gemessen lieferten die Werte 3, 500 und 7 dasselbe Ergebnis. Verdrahten hätte
// Messungen zu Datenbankwirkung, Trefferquote, Antwortzeit und Goldlabels verlangt — es gibt keine.
//
// STAND AM 08.10. (Quelleninspektion vor diesem Test): In `apps/web/src` steht kein Regler, kein
// Eingabefeld und kein Wörterbuchtext mit TopK mehr; die drei Treffer sind Kommentare in den
// Wörterbüchern. Die Ask-Route kennt kein `topK`-Feld, die Kandidatenauswahl rechnet fest mit
// `DEFAULT_TOP_K`. Der Auftrag ist damit in der Oberfläche bereits erfüllt; dieser Test hält ihn fest.
//
// ZWEI NACHWEISE:
//   OBERFLÄCHE — kein Code (Kommentare ausgenommen) in der Web-App nennt TopK.
//   SERVER — der Deckel ist unverändert 8, und die Ask-Route liest kein TopK aus der Anfrage. Ein
//   still mitgeschicktes `topK` darf die serverseitige Kandidatenauswahl nicht verstellen.
//
// GEGENPROBE: in `apps/web/src/pages/AdminKiDetails.tsx` ein `<label>TopK</label>` einfügen → der
// erste Fall wird namentlich rot. `DEFAULT_TOP_K` auf 10 setzen → der zweite Fall wird rot.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_TOP_K } from "../../services/reasoner";

const WURZEL = join(__dirname, "..", "..");
const WEB_QUELLE = join(WURZEL, "apps", "web", "src");

/** „TopK", „top-k", „top_k", „Top K" — nicht aber „topKnowledge" oder „desktop". */
const TOPK = /(?<![a-z])top[\s_-]?k(?![a-z])/i;

function istKommentar(zeile: string): boolean {
  const t = zeile.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
}

function quelldateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      aus.push(...quelldateien(pfad));
    } else if (/\.(ts|tsx|css|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      aus.push(pfad);
    }
  }
  return aus;
}

function codeTreffer(datei: string): string[] {
  return readFileSync(datei, "utf8")
    .split("\n")
    .map((zeile, i) => ({ zeile, nr: i + 1 }))
    .filter(({ zeile }) => !istKommentar(zeile) && TOPK.test(zeile))
    .map(({ zeile, nr }) => `${relative(WURZEL, datei)}:${nr}: ${zeile.trim()}`);
}

describe("R-1054 · TopK-Regler", () => {
  it("die Web-Oberfläche bietet keinen TopK-Regler an", () => {
    const dateien = quelldateien(WEB_QUELLE);
    expect(dateien.length).toBeGreaterThan(100);
    expect(dateien.flatMap(codeTreffer)).toEqual([]);
  });

  it("die serverseitige Kandidatenauswahl bleibt bei ihrem Deckel und liest kein TopK aus der Anfrage", () => {
    expect(DEFAULT_TOP_K).toBe(8);
    expect(codeTreffer(join(WURZEL, "services", "app", "src", "routes", "ask-routes.ts"))).toEqual(
      [],
    );
  });
});
