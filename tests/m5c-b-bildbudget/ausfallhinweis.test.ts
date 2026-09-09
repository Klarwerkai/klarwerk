// ================================================================================================
// JOB 3400 · M5c-b-R2 · RUNDE 3 — DER AUSFALL STEHT AM BILD, IM GESPEICHERTEN ENTWURF
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (BEN, Runde 2, Korrekturpflicht 2): Ein Bild, das die
// Ableitung nicht lesen konnte, behielt zwar seine Originalquelle — aber im GESPEICHERTEN Entwurf
// stand darüber kein Wort. Die drei neuen Antwortfelder (`imagesShrunk`, `imagesKeptOriginal`,
// `imageSkipReasons`) sind eine SUMME in der Importantwort; sie sagen „ein Bild ist defekt", nicht
// WELCHES. Wer den Entwurf später öffnet — im Web oder im Panel —, sieht nur ein Bild, das
// vielleicht angezeigt wird und vielleicht nicht, und erfährt den Grund nirgends. BENs Wortlaut:
// „ausschliesslich neue POST-Antwortfelder erfüllen diese Pflicht nicht".
//
// WO DER HINWEIS STEHT UND WARUM DORT: im `<figure>` des betroffenen Bildes, unmittelbar hinter dem
// `<img>`. Das figure IST die Bildeinheit des Imports (docx.ts:279), und das `<img>` darin trägt die
// Bildkennung `kw-img-<token>-N` — der Hinweis ist damit genau EINEM Bild zugeordnet, auch wenn im
// Dokument fünf Bilder stehen.
//
// WARUM NICHT IN DIE `<figcaption>`: Die Fussnote trägt die Beschriftung aus dem Word-Dokument und
// ist die Quelle der Bildsuche (`services/structure/src/captions.ts`). Maschinentext hineinzumischen
// hiesse, die Suchtexte des Anwenders mit unseren Sätzen zu verunreinigen. Der Hinweis steht deshalb
// NEBEN der Fussnote, nicht in ihr — und H3 unten misst genau das an einem Bild ohne Beschriftung.
//
// WARUM DER SATZ HIER AUSGESCHRIEBEN STEHT und nicht aus dem Modul importiert wird: Ein Test, der
// die Konstante importiert, bleibt grün, wenn aus dem Satz eines Tages „xyz" wird. Geprüft wird, was
// ein Mensch liest, also steht es hier als Text.
import { describe, expect, it } from "vitest";
import type { Absatz } from "../m5-docx-bildunterschriften/docx-bauen";
import { defektesPng, grossesPng } from "./bilder";
import { bildquellen, figuren, kennung, rumpf, uebernehmen } from "./uebernahme";

/** Das gute Nachbarbild: über der Zielkante, echtes Rauschen — es MUSS abgeleitet werden. */
const GUTES_PNG = grossesPng(1600, 1200).toString("base64");

/** Der Kern des Satzes, den ein Mensch am defekten Bild lesen soll. */
const HINWEIS_DEFEKT = "nicht gelesen werden";

describe("JOB 3400 R3 · der Ausfall wird am betroffenen Bild benannt", () => {
  it("H1 · das defekte Bild trägt den Hinweis, das gute daneben nicht", async () => {
    const dokument: Absatz[] = [
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "bild", png: defektesPng().toString("base64"), alt: "kaputt.png" },
      { art: "text", text: "Die Verschraubung erfolgt von unten." },
      { art: "beschriftung", text: "Figure 2: Bolted connection" },
      { art: "bild", png: GUTES_PNG, alt: "heil.png" },
    ];
    const g = await uebernehmen(dokument);
    const [defekt, heil] = figuren(g.bodyHtml);
    expect(figuren(g.bodyHtml), "Es entstanden nicht zwei figure-Elemente").toHaveLength(2);

    // 1. DER HINWEIS STEHT AM RICHTIGEN BILD — im figure des defekten, nicht irgendwo im Rumpf.
    expect(
      defekt,
      "Im gespeicherten Entwurf steht am defekten Bild kein Wort über den Ausfall",
    ).toContain(HINWEIS_DEFEKT);
    expect(heil, "Auch das heile Bild bekam einen Ausfallhinweis").not.toContain(HINWEIS_DEFEKT);

    // 2. DIE BILDKENNUNG IST DA — ohne sie wäre die Zuordnung eine Behauptung über die Reihenfolge.
    expect(kennung(defekt ?? ""), "Die Bildkennung des defekten Bildes fehlt").toMatch(
      /^kw-img-[a-z0-9]+-1$/,
    );

    // 3. DIE BESCHRIFTUNG IST UNBERÜHRT — der Hinweis steht neben ihr, nicht in ihr.
    expect(defekt, "Die Fussnote des defekten Bildes hat ihren Text verloren").toContain(
      `<figcaption data-image-id="${kennung(defekt ?? "")}">Figure 1: Profiles</figcaption>`,
    );
    expect(heil, "Die Fussnote des heilen Bildes hat ihren Text verloren").toContain(
      `<figcaption data-image-id="${kennung(heil ?? "")}">Figure 2: Bolted connection</figcaption>`,
    );

    // 4. KEIN BILD IST VERSCHWUNDEN, das defekte steht mit seiner Originalquelle da, das gute ist
    //    abgeleitet — der Hinweis ersetzt kein Bild, er begleitet es.
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen, "Ein Bild ist still verschwunden").toHaveLength(2);
    expect(quellen[0]).toBe(`data:image/png;base64,${defektesPng().toString("base64")}`);
    expect(
      Buffer.from(rumpf(quellen[1] ?? ""), "base64").byteLength,
      "Das gute Bild wurde wegen des defekten Nachbarn nicht abgeleitet",
    ).toBeLessThan(Buffer.from(GUTES_PNG, "base64").byteLength);

    // 5. DER FLIESSTEXT STEHT UNVERÄNDERT, und die Antwort bleibt bei ihrer bisherigen Auskunft.
    expect(g.bodyHtml).toContain("Die Verschraubung erfolgt von unten.");
    expect(g.bilanz).toEqual({ imagesTotal: 2, imagesEmbedded: 2, imagesDropped: 0 });
    expect(g.ableitung).toEqual({
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
  });

  it("H2 · ein Dokument ohne Ausfall bekommt keinen einzigen Hinweis", async () => {
    // Die Gegenprobe zum Hinweis selbst: er darf nicht bei jedem Import mitlaufen. Ein Entwurf, in
    // dem alles gutging, ist zeichengleich zu dem, den es ohne diese Runde gegeben hätte.
    const g = await uebernehmen([
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "bild", png: GUTES_PNG, alt: "profil.png" },
    ]);
    expect(g.bodyHtml, "Ein heiler Import trägt einen Ausfallhinweis").not.toContain(
      HINWEIS_DEFEKT,
    );
    expect(g.bodyHtml, "Ein heiler Import trägt einen Warnkasten").not.toContain("panel-warning");
    expect(g.ableitung).toEqual({
      imagesShrunk: 1,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
  });

  it("H3 · ohne Beschriftung bleibt die Fussnote leer — der Hinweis kriecht nicht hinein", async () => {
    // Die Bildsuche liest ihre Suchtexte aus `figcaption` (services/structure/src/captions.ts). Ein
    // Hinweis, der sich dort einnistet, machte aus jedem defekten Bild einen Treffer für unsere
    // eigenen Worte. Deshalb: Fussnote leer wie bisher, Hinweis daneben.
    const g = await uebernehmen([
      { art: "bild", png: defektesPng().toString("base64"), alt: "kaputt.png" },
    ]);
    const [figur] = figuren(g.bodyHtml);
    expect(figur, "Es entstand kein figure-Element").toBeDefined();
    expect(figur, "Der Ausfall wird nicht benannt").toContain(HINWEIS_DEFEKT);
    expect(figur, "Der Hinweis ist in die Fussnote gekrochen").toContain(
      `<figcaption data-image-id="${kennung(figur ?? "")}"></figcaption>`,
    );
    expect(g.ableitung.imageSkipReasons).toEqual(["nicht-dekodierbar"]);
  });
});
