// ================================================================================================
// JOB 2613 · D3 — STATION 1: KOMMEN DIE BILDER AUS WORD IM ENTWURF AN?
// ================================================================================================
//
// PEDIS SATZ IST DIE ABNAHME: „Pedi übernimmt sein BAADER-Dokument aus Word und findet alle Bilder
// im Entwurf." An seinem Word kann dieser Test nichts prüfen. Was er prüft, ist die Kette
// dahinter — und zwar mit einer ECHTEN `.docx`, nicht mit einer Attrappe:
//
//     .docx-Bytes (Zip mit PNGs)  →  extractDocxRich  →  bodyHtml mit data:image
//
// WARUM EINE ECHTE DATEI UND KEINE FAKE-ENGINE: Der Konsolenweg wird bereits mit einer injizierten
// `DocxEngine` geprüft (`tests/structure/docx-rich-import.test.ts`). Genau das würde hier die Frage
// verfehlen — die Frage ist ja, ob mammoth SERVERSEITIG läuft und ob die Bilder aus dem Zip
// ankommen. Eine Fake-Engine würde das wegdefinieren.
//
// WARUM DIE DATEIEN EINGEBETTET SIND: `jszip` liegt wie `mammoth` bei `apps/web`, diese Testdatei
// im Wurzelpaket. Ein Bauen zur Laufzeit scheiterte an der Paketauflösung („Failed to load url
// jszip"). Die beiden Konstanten unten sind deshalb fertige, deterministisch erzeugte `.docx`.
//
// BILD FÜR BILD, NICHT „NICHT LEER": Die beiden PNGs sind UNTERSCHIEDLICH (rot/blau). Der Test
// zählt nicht nur zwei `<img>`, sondern belegt, dass beide Bilddaten VERSCHIEDEN sind und jedes
// einzelne ankommt. Ein Weg, der dasselbe Bild zweimal einbettet, fällt durch.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER (Machart JOB 2617 D3): Ein Zähler, der bei kaputtem
// Aufbau 0 findet und „0 === 0" grün erfüllt, misst nichts. W0 prüft deshalb zuerst, dass die
// Prüfdatei die Bildteile überhaupt trägt; W3 zeigt, dass der Zähler ohne Bilder auch 0 meldet.
import { describe, expect, it } from "vitest";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import { zaehleEingebetteteBilder } from "../../services/app/src/routes/capture-routes";

/** 1×1-PNG, rot. */
const PNG_ROT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** 1×1-PNG, blau — bewusst ANDERE Bytes, damit „zwei Bilder" nicht „zweimal dasselbe" heissen kann. */
const PNG_BLAU =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Echte .docx: ein Textabsatz und zwei eingebettete PNGs (rot, blau). */
const DOCX_MIT_ZWEI_BILDERN =
  "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";

/** Dieselbe Bauart, aber OHNE Bildteile — die Gegenprobe. */
const DOCX_OHNE_BILDER =
  "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";

function alsPuffer(b64: string): ArrayBuffer {
  const bytes = Buffer.from(b64, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Die einzelnen eingebetteten Bilddaten — Base64-Rumpf je `<img>`, in Dokumentreihenfolge. */
function bilddaten(html: string): string[] {
  return [...html.matchAll(/<img[^>]+src="data:image\/[a-zA-Z0-9.+-]+;base64,([^"]+)"/g)].map(
    (t) => t[1] ?? "",
  );
}

describe("JOB 2613 · W0 · Kalibrierung: die Prüfdatei trägt die Bilder wirklich", () => {
  it("das Zip enthält beide Bildteile und das Dokument", () => {
    // Ohne diesen Fall wären alle folgenden überbestimmt: Ein leeres Zip erfüllte „keine Bilder
    // verloren" mühelos, ohne dass irgendetwas geleistet wäre. Die Teilnamen stehen im
    // ZIP-Verzeichnis im Klartext — dafür braucht es keine Zip-Bibliothek.
    const roh = Buffer.from(DOCX_MIT_ZWEI_BILDERN, "base64");
    expect(roh.includes(Buffer.from("word/media/bild1.png")), "Bildteil 1 fehlt im Zip").toBe(true);
    expect(roh.includes(Buffer.from("word/media/bild2.png")), "Bildteil 2 fehlt im Zip").toBe(true);
    expect(roh.includes(Buffer.from("word/document.xml"))).toBe(true);
  });

  it("die Gegenprobe-Datei trägt KEINE Bildteile", () => {
    const roh = Buffer.from(DOCX_OHNE_BILDER, "base64");
    expect(roh.includes(Buffer.from("word/media/")), "Die Gegenprobe trägt doch Bilder").toBe(
      false,
    );
    expect(roh.includes(Buffer.from("word/document.xml"))).toBe(true);
  });
});

describe("JOB 2613 · W1 · der DOM-freie Kern läuft SERVERSEITIG und bringt die Bilder mit", () => {
  it("beide Bilder kommen als data:image an — einzeln belegt", async () => {
    // Kein Fake, keine injizierte Engine: das echte mammoth, unter Node, mit einer echten Datei.
    const reich = await extractDocxRich(alsPuffer(DOCX_MIT_ZWEI_BILDERN));
    const daten = bilddaten(reich.html);

    expect(daten, "Es kam kein einziges eingebettetes Bild an").toHaveLength(2);
    // BILD FÜR BILD, nicht „zwei Stück": jedes einzelne muss da sein.
    expect(daten[0], "Das erste Bild (rot) fehlt oder wurde ersetzt").toBe(PNG_ROT);
    expect(daten[1], "Das zweite Bild (blau) fehlt oder wurde ersetzt").toBe(PNG_BLAU);
    // Und sie sind verschieden — ein Weg, der dasselbe Bild zweimal einbettet, fällt hier durch.
    expect(new Set(daten).size, "Beide <img> tragen dieselben Bytes").toBe(2);
  });

  it("der Text reist mit — der Entwurf ist nicht nur eine Bildergalerie", async () => {
    const reich = await extractDocxRich(alsPuffer(DOCX_MIT_ZWEI_BILDERN));
    expect(reich.text).toContain("BAADER Sonde Station 1");
  });

  it("die Bildbilanz zählt die Quellbilder — und zwar im EHRLICHEN Feld", async () => {
    // `sourceImageCount` reist mit dem Entwurf, damit ein Verlust später überhaupt erkennbar ist
    // (JOB 512 R5). Ohne diese Zahl könnte die Oberfläche einen Verlust nur raten.
    //
    // DIESER FALL HAT EINEN ECHTEN FEHLER GEFANGEN (JOB 2613 D3, erster Lauf): Die Route nahm
    // zunächst `reich.totalImages`. Jenes Feld ist „aus Rueckwaertskompatibilitaet an den
    // Budgetlauf gebunden" (`docx.ts:657-658`) und bleibt **0**, wenn ohne `mapImage` extrahiert
    // wird — obwohl zwei Bilder in der Quelle stehen. Der Vertrag `imageTransfer` „zaehlt IMMER
    // ehrlich" (ebenda). Beide Werte stehen hier nebeneinander, damit die Wahl gepinnt ist und
    // niemand sie „vereinfacht".
    const reich = await extractDocxRich(alsPuffer(DOCX_MIT_ZWEI_BILDERN));
    expect(
      reich.imageTransfer.totalImages,
      "Der ehrliche Vertrag zählt die Quellbilder nicht mehr",
    ).toBe(2);
    expect(
      reich.totalImages,
      "`totalImages` ist NICHT mehr an den Budgetlauf gebunden — dann darf die Route es wieder nutzen",
    ).toBe(0);
  });
});

describe("JOB 2613 · W2 · der Zähler der Route zählt EINGEBETTETE Bilder, nicht <img>-Tags", () => {
  it("er zählt genau die data:image-Quellen", () => {
    expect(zaehleEingebetteteBilder('<img src="data:image/png;base64,AAA" />')).toBe(1);
    expect(
      zaehleEingebetteteBilder(
        '<p><img src="data:image/png;base64,AAA" /><img src="data:image/jpeg;base64,BBB" /></p>',
      ),
    ).toBe(2);
  });

  it("ein VERLINKTES Bild zählt NICHT als übernommen", () => {
    // Der Unterschied ist der ganze Punkt dieses Jobs: ein `<img>` mit fremder Adresse ist genau
    // das, was der heutige Weg liefert — ein Verweis ohne Bytes. Er darf nicht als Erfolg zählen.
    expect(zaehleEingebetteteBilder('<img src="https://example.invalid/bild.png" />')).toBe(0);
    expect(zaehleEingebetteteBilder('<img src="cid:bild1" />')).toBe(0);
  });

  it("ohne Bilder meldet er 0", () => {
    expect(zaehleEingebetteteBilder("<p>Nur Text.</p>")).toBe(0);
  });
});

describe("JOB 2613 · W3 · die Gegenprobe: ein Dokument OHNE Bilder", () => {
  it("liefert Text, aber keine eingebetteten Bilder", async () => {
    // Wäre der Zähler blind für den Unterschied, wäre W1 wertlos. Hier zeigt sich, dass er
    // zwischen „zwei Bilder" und „keins" tatsächlich unterscheidet.
    const reich = await extractDocxRich(alsPuffer(DOCX_OHNE_BILDER));
    expect(reich.text).toContain("BAADER Sonde Station 1");
    expect(bilddaten(reich.html)).toHaveLength(0);
    expect(zaehleEingebetteteBilder(reich.html)).toBe(0);
    expect(reich.totalImages).toBe(0);
  });
});
