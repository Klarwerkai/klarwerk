// ================================================================================================
// JOB 3400 · M5c-b-R2 — DER ADD-IN-IMPORT VERKLEINERT, STATT ROH DURCHZUREICHEN
// ================================================================================================
//
// WO GEMESSEN WIRD, und warum nicht an `extractDocxRich`: Der Befund, den dieser Auftrag behebt,
// wurde am GESPEICHERTEN Entwurf erhoben (BEN, 3229 R2: `bodyHtml` mit 4.666.955 Bytes). Genau
// dort entsteht der Zustand, den ein Mensch später sieht. Jeder Fall geht deshalb durch die echte
// Route `POST /api/drafts/from-docx` und liest den Entwurf frisch über GET zurück — Route,
// Sanitizer und Speicher sind Teil der Messung, nicht davor abgeschnitten.
//
// DIE ZWEI HÄLFTEN STEHEN GETRENNT (Auftrag §8.1): Fall A misst, dass der Entwurf KLEIN wird;
// Fall B misst, dass das Bild DA BLEIBT. Ein Stand, der nur die Zahl drückt (Bilder weg — genau
// das, was `imageBudgetBytes` täte), macht B rot; ein Stand, der nur die Bilder rettet (Grösse
// unverändert — der heutige Stand), macht A rot. Kein einzelner Trick macht beide grün.
import { describe, expect, it } from "vitest";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import { type Absatz, alsPuffer, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { grossesPng } from "./bilder";
import { bildquellen, rumpf, uebernehmen } from "./uebernahme";

/**
 * Das Prüfbild: 1600×1200 Pixel Rauschen. Über der Zielkante der Ableitung und mit rund 5,7 MB
 * Rohgrösse deutlich über jeder Bytegrenze — an einem 1×1-Pixel-Bild wäre keine Verkleinerung
 * messbar.
 */
const GROSSES_BILD = grossesPng(1600, 1200).toString("base64");

/** Derselbe Platzhalterschalter, den die Route setzt (sein Text wird nie gespeichert). */
const PLATZHALTER = "enabled";

/**
 * Die Grösse, die der UNVERÄNDERTE Weg erzeugt hätte — im selben Lauf gemessen, nicht als Zahl
 * abgeschrieben. `mapImage: async (src) => src` ist wörtlich die Identitätsabbildung, die vor
 * diesem Auftrag in `capture-routes.ts` stand; `imageCaptionPlaceholder` steht wie dort.
 */
async function groesseOhneVerkleinerung(absaetze: readonly Absatz[]): Promise<number> {
  const { bytes } = await baueDocx(absaetze);
  const reich = await extractDocxRich(alsPuffer(bytes), {
    mapImage: async (src) => src,
    imageCaptionPlaceholder: PLATZHALTER,
  });
  return Buffer.byteLength(reich.html);
}

describe("JOB 3400 · Add-in-Import: Bilder kommen an, aber verkleinert", () => {
  it("A · der gespeicherte Entwurf ist ein Vielfaches kleiner — bei unveränderter Bildzahl", async () => {
    const dokument: Absatz[] = [
      { art: "text", text: "Der Rahmen wird aus zwei Profilen gefügt." },
      { art: "bild", png: GROSSES_BILD, alt: "profil.png" },
    ];
    const ohne = await groesseOhneVerkleinerung(dokument);
    const g = await uebernehmen(dokument);
    const mit = Buffer.byteLength(g.bodyHtml);

    // Erste Hälfte: das Bild ist NICHT verschwunden — genau eine Quelle, und sie ist eingebettet.
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen, "Die Zahl der Bilder im Entwurf weicht vom Dokument ab").toHaveLength(1);
    expect(quellen[0], "Die Bildquelle ist keine eingebettete data:-Quelle").toMatch(
      /^data:image\/[a-z0-9.+-]+;base64,/i,
    );

    // Zweite Hälfte: der Entwurf ist DEUTLICH kleiner als der unveränderte Weg ihn anlegen würde.
    // Die Hälfte ist die Schwelle, nicht das Ziel: gemessen wird ein Vielfaches (s. Protokollzeile).
    console.log(
      `A: bodyHtml ohne Verkleinerung=${ohne} Bytes, mit=${mit} Bytes, Faktor=${(ohne / mit).toFixed(1)}`,
    );
    expect(mit, `Der Entwurf ist nicht kleiner geworden (ohne=${ohne}, mit=${mit})`).toBeLessThan(
      ohne / 2,
    );
  });

  it("B · das Bild ist nicht weggelassen — kein Reststummel wie bei der Byte-Notbremse", async () => {
    // Die Gegenprobe gegen genau das, was BEN mit `imageBudgetBytes: 3500000` gemessen hat: ein
    // `bodyHtml` von 7 Bytes, „das Bild ist restlos weg". Eine Verkleinerung, die das Bild
    // weglässt, wäre in Fall A ununterscheidbar von einer echten Verkleinerung.
    const g = await uebernehmen([{ art: "bild", png: GROSSES_BILD, alt: "profil.png" }]);
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen, "Das Bild wurde weggelassen statt verkleinert").toHaveLength(1);
    const daten = rumpf(quellen[0] ?? "");
    // Eine Ableitung eines 1600×1200-Bildes trägt Zehntausende Bytes. Diese Untergrenze schliesst
    // den Reststummel und ein untergeschobenes 1×1-Ersatzbild aus.
    expect(
      daten.length,
      `Die gespeicherte Bildquelle ist zu klein für eine echte Ableitung (${daten.length} Zeichen)`,
    ).toBeGreaterThan(20_000);
    expect(g.bilanz).toEqual({ imagesTotal: 1, imagesEmbedded: 1, imagesDropped: 0 });
    expect(g.sourceImageCount).toBe(1);
  });

  it("C · Beschriftung, Bildkennung und Reihenfolge überleben die Verkleinerung", async () => {
    const g = await uebernehmen([
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "bild", png: GROSSES_BILD, alt: "profil.png" },
      { art: "text", text: "Die Verschraubung erfolgt von unten." },
      { art: "beschriftung", text: "Figure 2: Bolted connection" },
      { art: "bild", png: grossesPng(1600, 1200, 4711).toString("base64"), alt: "schraube.png" },
    ]);
    // Die Fussnoten stehen gefüllt und in Dokumentreihenfolge am jeweils eigenen Bild.
    const figuren = [...g.bodyHtml.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    expect(figuren, "Es entstanden nicht zwei figure-Elemente").toHaveLength(2);
    const erwartet = ["Figure 1: Profiles", "Figure 2: Bolted connection"];
    figuren.forEach((figur, i) => {
      const kennung = /<img\b[^>]*data-image-id="([^"]+)"/.exec(figur)?.[1];
      expect(kennung, "Die Bildkennung fehlt nach der Verkleinerung").toMatch(
        /^kw-img-[a-z0-9]+-\d+$/,
      );
      expect(figur, "Die Fussnote hängt nicht mehr an ihrem Bild").toContain(
        `<figcaption data-image-id="${kennung}">${erwartet[i]}</figcaption>`,
      );
      expect(figur, "Die Bildquelle ist keine eingebettete data:-Quelle").toMatch(
        /<img\b[^>]*\bsrc="data:image\/[a-z0-9.+-]+;base64,/i,
      );
    });
    // Zwei verschiedene Quellbilder bleiben zwei verschiedene Ableitungen — die Verkleinerung hat
    // nicht ein Bild auf beide Plätze kopiert.
    const quellen = bildquellen(g.bodyHtml);
    expect(new Set(quellen).size, "Beide Fussnoten zeigen auf dasselbe Bild").toBe(2);
    expect(g.bodyHtml).toContain("Die Verschraubung erfolgt von unten.");
  });
});
