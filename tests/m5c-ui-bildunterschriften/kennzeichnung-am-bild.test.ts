// @vitest-environment jsdom
// ================================================================================================
// JOB 3254 · M5c-UI — „KEINE ORIGINALBESCHRIFTUNG" IST NICHT DASSELBE WIE „MEHRDEUTIG, LEER GELASSEN"
// ================================================================================================
//
// DER BEFUND, den diese Datei rot gemacht hat: JOB 3210 lässt bei Mehrdeutigkeit bewusst NICHT
// raten (`docx.ts:471-508`). Diese Entscheidung war unsichtbar — eine Fussnote, die WEGEN
// Mehrdeutigkeit leer blieb, sah Zeichen für Zeichen aus wie die Fussnote eines Bildes, zu dem das
// Dokument nie eine Beschriftung hatte. Der Mensch las „hier fehlt etwas", wo „hier ist eine offene
// Frage, die nur du beantworten kannst" gemeint war.
//
// ── RUNDE 2: WAS SICH GEGENÜBER RUNDE 1 GEÄNDERT HAT UND WARUM ──────────────────────────────────
//
// Runde 1 schrieb den Kennzeichnungstext als data-Attribut IN DEN RUMPF. Gemessen wurde damals nur,
// dass beide Sanitizer ihn strippen — nicht gemessen wurde, dass der reale Weg /erfassen GENAU
// DURCH sie führt (Server beim Sichern, Editor beim Laden). Die Kennzeichnung erreichte den
// Menschen also nie; sie zu retten hätte geheissen, an einem der Sanitizer vorbeizugehen, und das
// ist kein Ausweg, sondern der Schaden.
//
// Seit Runde 2 verlässt die Mehrdeutigkeit `docx.ts` als BILDKENNUNG (`captionsAmbiguousImageIds`)
// — dieselben `data-image-id`-Werte, die in der Sanitizer-Allowlist stehen und den Rundlauf
// überleben. Den sichtbaren Text setzt erst der Editor am lebenden DOM, NACH jeder Sanitisierung.
// Genau diese Kette misst B3 unten, in ihrer echten Reihenfolge.
//
// GEMESSEN WIRD AM ECHTEN WEG: synthetische .docx (echtes OOXML, kein injizierter `DocxEngine`) →
// `extractDocxRich` mit dem echten mammoth → Server-Sanitizer → Client-Sanitizer →
// `enhanceFiguresForEditing` (dieselbe Verankerung, die der Editor an genau einer Stelle ruft).
// Keine Echtdaten; alle Dokumente sind erfunden und im Test erzeugt.
//
// KEIN CHROMIUM: alles läuft in jsdom. Die CSS-Wirkung wird als PIN an `index.css` geprüft —
// dieselbe Bauform wie `tests/capture/editor-figure-caption.test.ts:242`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import {
  CAPTION_AMBIGUOUS_ATTR,
  type EditableElement,
  type EditableFigureRoot,
  enhanceFiguresForEditing,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";
import {
  type Absatz,
  PNG_BLAU,
  PNG_ROT,
  alsPuffer,
  baueDocx,
} from "../m5-docx-bildunterschriften/docx-bauen";

/** Der Platzhaltertext, den `files.ts` im Betrieb durchreicht — sein Text landet nie im Body (WP-D10). */
const PLATZHALTER = "Bildbeschreibung hinzufügen";
/** Die Kennzeichnung, die der Editor im Betrieb aus `editor.captionAmbiguous` einsetzt. */
const KENNZEICHNUNG = "Beschriftung im Dokument, aber nicht eindeutig zuordenbar";

/**
 * Das Prüfdokument beider Kernfälle in EINEM Dokument — anders wäre der Unterschied nicht zu
 * zeigen: (a) ein Bild ohne jeden Beschriftungs-Anwärter, (b) zwei Bilder um eine Legende herum.
 * Alle drei Fussnoten bleiben leer; nur die von (b) haben eine offene Frage.
 */
const DOKUMENT_A_UND_B: Absatz[] = [
  { art: "bild", png: PNG_ROT, alt: "ohne-anwaerter.png" },
  { art: "text", text: "Dieser Absatz ist keine Beschriftung, sondern ein Satz." },
  { art: "bild", png: PNG_BLAU, alt: "detail-a.png" },
  { art: "beschriftung", text: "Abbildung 1: Offen" },
  { art: "bild", png: PNG_ROT, alt: "detail-b.png" },
];

interface Import {
  html: string;
  assigned: number;
  ambiguous: number;
  ids: readonly string[];
}

async function importiere(absaetze: readonly Absatz[]): Promise<Import> {
  const { bytes } = await baueDocx(absaetze);
  const reich = await extractDocxRich(alsPuffer(bytes), {
    mapImage: async (s) => s,
    imageCaptionPlaceholder: PLATZHALTER,
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    // Festes Token: die Bildkennungen sollen im Test benennbar sein.
    imageRunToken: "pruef01",
  });
  return {
    html: reich.html,
    assigned: reich.captionsAssigned,
    ambiguous: reich.captionsAmbiguous,
    ids: reich.captionsAmbiguousImageIds,
  };
}

// Der Gate-tsc läuft ohne DOM-lib (`tsconfig.json:6`, „Der Root-Check bleibt Node-rein"). Das von
// der jsdom-Umgebung bereitgestellte `document` wird deshalb über schmale, DOM-lib-freie Typen
// abgegriffen — dieselbe Bauform wie `tests/capture/editor-figure-caption.test.ts:31-42`.
interface FussnoteLike extends EditableElement {
  innerHTML: string;
  matches(selectors: string): boolean;
  getAttributeNames(): string[];
}
interface DivLike extends EditableFigureRoot {
  innerHTML: string;
  querySelector(selectors: string): FussnoteLike | null;
  querySelectorAll(selectors: string): Iterable<FussnoteLike>;
}
const doc = (globalThis as unknown as { document: { createElement(tag: string): DivLike } })
  .document;

function alsBaum(html: string): DivLike {
  const wurzel = doc.createElement("div");
  wurzel.innerHTML = html;
  return wurzel;
}

/** Die Fussnoten des Rumpfes in Dokumentreihenfolge: Bildkennung → trägt sie die Kennzeichnung? */
function fussnoten(html: string): { id: string; kennzeichnung: string | null; inhalt: string }[] {
  return [...alsBaum(html).querySelectorAll("figcaption")].map((f) => ({
    id: f.getAttribute("data-image-id") ?? "",
    kennzeichnung: f.getAttribute(CAPTION_AMBIGUOUS_ATTR),
    inhalt: f.innerHTML,
  }));
}

/** Eine verankerte Figur, wie sie der Import erzeugt — ein Bild, eine Fussnote, dieselbe Kennung. */
function figur(id: string, inhalt = "", extra = ""): string {
  return `<figure><img data-image-id="${id}" src="data:image/png;base64,AAA"><figcaption data-image-id="${id}"${extra}>${inhalt}</figcaption></figure>`;
}

/** Die Verankerung so rufen, wie `RichTextEditor.tsx` sie ruft — mit der Menge und dem Text. */
function verankere(baum: DivLike, ids: Iterable<string>, text = KENNZEICHNUNG): void {
  enhanceFiguresForEditing(
    baum,
    "✎ Bildbeschreibung hinzufügen …",
    "Bildbeschreibung öffnen",
    "noch keinem Bild zugeordnet",
    "Bildbeschreibung, noch keinem Bild zugeordnet",
    { bildkennungen: new Set(ids), text },
  );
}

// ================================================================================================
// B1 · DER KERN — ZWEI LEERE FUSSNOTEN IM SELBEN DOKUMENT, EINE MIT OFFENER FRAGE
// ================================================================================================
describe("JOB 3254 · B1 · nur die MEHRDEUTIG leer gebliebene Fussnote wird gekennzeichnet", () => {
  it("B1 · die gemeldeten Kennungen sind GENAU die der Bilder um die Legende, nicht die von (a)", async () => {
    const b = await importiere(DOKUMENT_A_UND_B);
    const caps = fussnoten(b.html);

    expect(caps, "Es kamen nicht drei Bilder mit Fussnote an").toHaveLength(3);
    // Alle drei Fussnoten sind LEER — daran ändert dieser Auftrag nichts (es wird nicht geraten).
    for (const c of caps) {
      expect(c.inhalt, `Fussnote ${c.id} hat plötzlich Inhalt`).toBe("");
    }
    // (a) ohne jeden Anwärter steht NICHT drin, (b) beide Bilder um die Legende stehen drin — und
    // zwar als die Kennungen, die im Rumpf wirklich vorkommen (sonst wäre die Liste unerreichbar).
    expect([...b.ids]).toEqual([caps[1]?.id, caps[2]?.id]);
    expect(b.ids, "Das Bild ohne jeden Anwärter behauptet eine offene Frage").not.toContain(
      caps[0]?.id,
    );
    // Und die Zähler sagen dasselbe wie die Liste — eine Wahrheit, zwei Ausgaben.
    expect(b.assigned).toBe(0);
    expect(b.ambiguous).toBe(2);
    expect(b.ids).toHaveLength(b.ambiguous);
    // Die offene Legende steht weiter im Fliesstext; sie ist nicht still verschwunden (JOB 3210).
    expect(b.html).toContain("Abbildung 1: Offen");
  });

  it("B1b · ein EINDEUTIG zugeordnetes Bild wird nicht gemeldet — die Fussnote trägt ja den Text", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Abbildung 1: Profile" },
      { art: "text", text: "Ein trennender Absatz." },
      { art: "bild", png: PNG_BLAU },
      { art: "beschriftung", text: "Abbildung 2: Übergänge" },
    ]);
    expect(b.assigned).toBe(2);
    expect(b.ambiguous).toBe(0);
    expect(b.ids).toEqual([]);
  });

  it("B1c · ein Dokument ohne jede Word-Beschriftung meldet nichts", async () => {
    const b = await importiere([
      { art: "text", text: "Zwei Ansichten ohne jede Beschriftung." },
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Und noch ein Satz dazwischen." },
      { art: "bild", png: PNG_BLAU },
    ]);
    expect(b.assigned).toBe(0);
    expect(b.ambiguous).toBe(0);
    expect(b.ids).toEqual([]);
  });
});

// ================================================================================================
// B2 · ZEICHENGLEICHHEIT — DER RUMPF TRÄGT KEINE ANSICHT
// ================================================================================================
// In Runde 1 hing die Zeichengleichheit an einem fehlenden Argument („ohne die neue Zeichenkette
// ändert sich nichts"). Seit Runde 2 gibt es dieses Argument nicht mehr: der Rumpf trägt die
// Kennzeichnung NIE, es gibt also keinen Lauf, in dem er sich unterscheiden könnte. Gemessen wird
// deshalb die stärkere Aussage — an der Fussnote steht genau ein Attribut, und das ist der Anker.
describe("JOB 3254 · B2 · der importierte Rumpf trägt keinerlei Ansichts-Attribut", () => {
  it("B2 · jede Fussnote trägt GENAU `data-image-id` — kein `data-kw-*` irgendwo im Rumpf", async () => {
    const b = await importiere(DOKUMENT_A_UND_B);
    expect(b.ids.length, "Die Vorbedingung fehlt: es gibt gar keine mehrdeutige Fussnote").toBe(2);

    expect(b.html).not.toContain(CAPTION_AMBIGUOUS_ATTR);
    expect(b.html, "Ein editorseitiges Attribut ist in den Rumpf gelangt").not.toContain(
      "data-kw-",
    );
    for (const f of alsBaum(b.html).querySelectorAll("figcaption")) {
      expect(f.getAttributeNames()).toEqual(["data-image-id"]);
    }
  });
});

// ================================================================================================
// B3 · DER REALE RUNDLAUF — DIE KENNZEICHNUNG ÜBERLEBT DIE SANITIZER NICHT, DIE KENNUNG SCHON
// ================================================================================================
// Das ist die Zusicherung, an der Runde 1 gescheitert ist, und sie läuft hier in der Reihenfolge
// des echten Weges: importieren → sichern (Server-Sanitizer) → laden (Client-Sanitizer des
// Editors) → verankern. Erst danach steht die Kennzeichnung da — und ein erneutes Sichern nimmt
// sie wieder mit, denn sie ist eine Ansicht und kein Inhalt.
describe("JOB 3254 · B3 · die Kennung trägt durch beide Sanitizer, der Anzeigetext nie", () => {
  it("B3 · nach Server- und Client-Sanitizer setzt die Verankerung die Kennzeichnung am RICHTIGEN Bild", async () => {
    const b = await importiere(DOKUMENT_A_UND_B);
    const gespeichert = serverSanitize(b.html);
    const geladen = clientSanitize(gespeichert);

    // Die Kennungen haben den Rundlauf unverändert überstanden — sie sind der Transport.
    for (const id of b.ids) {
      expect(geladen, `Die Bildkennung ${id} hat den Rundlauf nicht überlebt`).toContain(
        `data-image-id="${id}"`,
      );
    }
    expect(fussnoten(geladen), "Eine Fussnote ist im Rundlauf verloren gegangen").toHaveLength(3);

    const baum = alsBaum(geladen);
    verankere(baum, b.ids);
    const nachher = fussnoten(baum.innerHTML);
    expect(nachher[0]?.kennzeichnung, "Das Bild ohne Anwärter wurde gekennzeichnet").toBeNull();
    expect(nachher[1]?.kennzeichnung).toBe(KENNZEICHNUNG);
    expect(nachher[2]?.kennzeichnung).toBe(KENNZEICHNUNG);
    // Und die Verankerung hat wirklich gearbeitet (sonst wäre der Befund oben trivial).
    expect(baum.querySelector("figcaption")?.getAttribute("data-kw-caption-open")).toBe("");
  });

  it("B3b · was der Editor danach abgibt, trägt die Kennzeichnung NICHT mehr — sie ist unspeicherbar", async () => {
    const b = await importiere(DOKUMENT_A_UND_B);
    const baum = alsBaum(clientSanitize(serverSanitize(b.html)));
    verankere(baum, b.ids);
    expect(baum.innerHTML, "Die Vorbedingung fehlt — es gibt nichts zu strippen").toContain(
      CAPTION_AMBIGUOUS_ATTR,
    );

    for (const [name, sanitize] of [
      ["client (richText.ts)", clientSanitize],
      ["server (services/structure)", serverSanitize],
    ] as const) {
      const abgegeben = sanitize(baum.innerHTML);
      expect(abgegeben, `${name} hat die Kennzeichnung gespeichert`).not.toContain(
        CAPTION_AMBIGUOUS_ATTR,
      );
      expect(abgegeben, `${name} hat auch den Anker verloren`).toContain(
        'data-image-id="kw-img-pruef01-2"',
      );
      expect(fussnoten(abgegeben)).toHaveLength(3);
    }
  });

  it("B3c · die Allowlist für figcaption bleibt bei GENAU einem Attribut", () => {
    for (const pfad of ["apps/web/src/lib/richText.ts", "services/structure/src/sanitize.ts"]) {
      const src = readFileSync(resolve(process.cwd(), pfad), "utf8");
      expect(src, `${pfad}: die Allowlist wurde geöffnet`).toContain(
        'figcaption: new Set(["data-image-id"])',
      );
    }
  });
});

// ================================================================================================
// B4 · DER EDITOR — DIE KENNZEICHNUNG BLEIBT AM SELBEN BILD
// ================================================================================================
describe("JOB 3254 · B4 · die Verankerung trägt die Kennzeichnung nie an ein anderes Bild", () => {
  it("B4a · beim Flachmachen (`<figure><img><img><figcaption>`) landet sie an IHREM Bild", () => {
    // Genau die Form, die das Umhüllen/Flachmachen erzwingt (mega89): zwei Bilder in EINER figure.
    // Die Fussnote gehört über ihre Kennung dem ZWEITEN Bild — die Reihenfolge darf sie nicht an
    // das erste geben, und das Flachmachen darf ihre Kennung nicht verwechseln.
    const baum = alsBaum(
      '<figure><img data-image-id="kw-img-x-1" src="data:image/png;base64,AAA">' +
        '<img data-image-id="kw-img-x-2" src="data:image/png;base64,BBB">' +
        '<figcaption data-image-id="kw-img-x-2"></figcaption></figure>',
    );
    verankere(baum, ["kw-img-x-2"]);

    const caps = fussnoten(baum.innerHTML);
    expect(caps, "Nicht jedes Bild hat nach dem Flachmachen eine Fussnote").toHaveLength(2);
    expect(
      caps.find((c) => c.id === "kw-img-x-2")?.kennzeichnung,
      "Die Kennzeichnung ist beim Flachmachen verloren gegangen",
    ).toBe(KENNZEICHNUNG);
    expect(
      caps.find((c) => c.id === "kw-img-x-1")?.kennzeichnung,
      "Die Kennzeichnung ist an ein FREMDES Bild gewandert",
    ).toBeNull();
  });

  it("B4b · ohne passende Kennung setzt die Verankerung nichts — sie erhebt den Zustand nicht", () => {
    const baum = alsBaum(figur("kw-img-y-1"));
    // Eine Kennung aus einem ANDEREN Import — sie passt auf nichts und darf nichts kennzeichnen.
    verankere(baum, ["kw-img-fremd-1"]);
    expect(baum.innerHTML).not.toContain(CAPTION_AMBIGUOUS_ATTR);
  });

  it("B4c · eine Kennzeichnung, die nicht mehr gilt, wird WEGGERÄUMT statt stehen gelassen", () => {
    const baum = alsBaum(figur("kw-img-z-1", "", ` ${CAPTION_AMBIGUOUS_ATTR}="${KENNZEICHNUNG}"`));
    // Der nächste Import kennt dieses Bild nicht mehr (leere Menge = keine offene Frage).
    verankere(baum, []);
    expect(
      baum.innerHTML,
      "Eine überholte Kennzeichnung blieb am Bild stehen (Lehre JOB 3239)",
    ).not.toContain(CAPTION_AMBIGUOUS_ATTR);
  });

  it("B4d · der Sprachwechsel frischt den TEXT auf, ohne die Kennzeichnung zu erfinden", () => {
    const baum = alsBaum(`${figur("kw-img-z-1")}${figur("kw-img-z-2")}`);
    verankere(baum, ["kw-img-z-1"]);
    expect(fussnoten(baum.innerHTML)[0]?.kennzeichnung).toBe(KENNZEICHNUNG);

    const englisch = "Caption in the document, but not clearly assignable";
    verankere(baum, ["kw-img-z-1"], englisch);
    const caps = fussnoten(baum.innerHTML);
    expect(caps[0]?.kennzeichnung, "Der Sprachwechsel hat den Text nicht mitgenommen").toBe(
      englisch,
    );
    expect(caps[1]?.kennzeichnung, "Der Sprachwechsel hat eine Kennzeichnung ERFUNDEN").toBeNull();
  });
});

// ================================================================================================
// B5 · BEIDE AUSPRÄGUNGEN — LEER UND VOM NUTZER GEFÜLLT
// ================================================================================================
describe("JOB 3254 · B5 · eine gefüllte Fussnote zeigt die Kennzeichnung nicht mehr", () => {
  it("B5 · der Text des Nutzers bleibt vollständig; die Anzeige hängt an `:empty`", () => {
    const geschrieben = "Schnitt <strong>A–A</strong> durch den Rahmen";
    const baum = alsBaum(figur("kw-img-v-1", geschrieben));
    verankere(baum, ["kw-img-v-1"]);
    const cap = baum.querySelector("figcaption");
    expect(cap?.innerHTML, "Der geschriebene Text wurde beschädigt").toBe(geschrieben);
    // Die Fussnote ist nicht mehr leer — genau daran hängt die Anzeige (Pin unten).
    expect(cap?.matches(":empty")).toBe(false);
  });

  it("B5b · CSS-Pin: die Kennzeichnung rendert NUR bei leerer Fussnote und schlägt den Platzhalter", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");
    const selektor = `.prose-kw figcaption[data-kw-caption-open][${CAPTION_AMBIGUOUS_ATTR}]:empty::before`;
    const start = css.indexOf(selektor);
    expect(start, "Die Kennzeichnung hat keine Renderzeile").toBeGreaterThan(0);
    const regel = css.slice(start, css.indexOf("}", start));
    expect(regel).toContain(`content: attr(${CAPTION_AMBIGUOUS_ATTR})`);
    // Sie steht HINTER der Platzhalter-Regel und ist spezifischer (zwei Attribute) — anderer TEXT,
    // nicht nur andere Farbe. Stünde sie davor, gewönne bei gleicher Spezifität die spätere Regel;
    // hier gewinnt sie ohnehin, aber die Reihenfolge wird mitgepinnt, damit niemand sie umsortiert.
    const platzhalter = css.indexOf(".prose-kw figcaption[data-kw-caption-open]:empty::before");
    expect(platzhalter).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(platzhalter);
  });
});
