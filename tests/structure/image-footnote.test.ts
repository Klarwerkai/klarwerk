// @vitest-environment jsdom
// JOB 509 / D5: Diese Datei trägt zusätzlich den ECHTEN Client-Editor-Roundtrip (Server-Sanitize →
// Client-Sanitize → Editor-Verankerung → Save → Reload). Deshalb jsdom für die ganze Datei — dasselbe
// Muster wie tests/capture/editor-figure-caption.test.ts. Die übrigen Fälle sind DOM-frei und laufen
// unter jsdom unverändert. (BEN-D4, Punkt 3, Variante 2: die Roundtrip-Kausalität wird vollständig
// hier belegt, ein sechster Testpfad ist damit nicht nötig.)
// WP-BILD-1a (Pedi 20.07.): Bild-Fußnoten-Fundament. Jedes importierte Inline-Bild bekommt beim
// DOCX-Import eine <figure> mit <figcaption data-image-id="…">. WP-D10: die Fußnote startet LEER —
// ein Platzhalter ist KEIN Inhalt (Einladung nur visuell im Editor via data-kw-placeholder/CSS).
// Getestet: DOM-freier Kern (wrapImagesInFigures + extractDocxRich), die
// Byte-Budget-Interaktion (Notbremse droppt das GANZE figure-Element), beide Sanitizer (Client richText +
// Server services/structure) erhalten figure/figcaption/data-image-id und strippen böse Attribute,
// shouldPreserveRichBody wertet figure als reich, i18n-Platzhalter DE/EN/NL.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { shouldPreserveRichBody } from "../../apps/web/src/lib/bodyAiAssist";
import {
  type DocxEngine,
  IMAGE_ID_PREFIX,
  applyInlineImageBudget,
  extractDocxRich,
  newImageRunToken,
  utf8ByteLength,
  wrapImagesInFigures,
} from "../../apps/web/src/lib/docx";
import type { EditableElement } from "../../apps/web/src/lib/editorFigures";
import { enhanceFiguresForEditing } from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const PLACEHOLDER = "Noch keine Bildbeschreibung";

// JOB 509 / D5: schmaler, DOM-lib-freier Zugriff auf das von jsdom bereitgestellte document —
// der Gate-tsc läuft ohne DOM-lib (gleiches Vorgehen wie im Editor-Test).
interface CaptionLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
// 10.08.2026: `querySelectorAll` war hier mit einem eigenen, schmaleren Elementtyp beschrieben
// ({textContent, setAttribute}). Damit erfuellte `DivLike` den Vertrag `EditableFigureRoot` nicht
// mehr, den `enhanceFiguresForEditing` verlangt — zwei Typfehler, obwohl zur Laufzeit ein ECHTES
// DOM-Element uebergeben wird, das alles davon kann. Der Behelf beschreibt jetzt den echten
// Elementtyp, statt einen zweiten daneben zu erfinden.
interface DivLike {
  innerHTML: string;
  querySelector(selectors: string): CaptionLike | null;
  querySelectorAll(selectors: string): Iterable<EditableElement>;
}
interface DocumentLike {
  createElement(tag: string): DivLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

// JOB 509 / D5: Alle drei Träger einer figure müssen denselben Token führen.
const ANCHOR_RE = /data-image-id="([^"]*)"/;
function anchorOf(html: string, tag: string): string | null {
  const open = new RegExp(`<${tag}\\b[^>]*>`).exec(html)?.[0] ?? "";
  return ANCHOR_RE.exec(open)?.[1] ?? null;
}
function tripleAnchorOf(html: string): string {
  const figure = anchorOf(html, "figure");
  expect(figure).toMatch(/^[\w-]{1,64}$/);
  expect(anchorOf(html, "img")).toBe(figure);
  expect(anchorOf(html, "figcaption")).toBe(figure);
  return String(figure);
}

function engineOf(html: string, text = "Text"): DocxEngine {
  return {
    convertToHtml: async () => ({ value: html, messages: [] }),
    extractRawText: async () => ({ value: text, messages: [] }),
  };
}

describe("WP-BILD-1a: wrapImagesInFigures", () => {
  it("hüllt jedes Bild in <figure> mit LEERER <figcaption> + kollisionsfester, fortlaufender ID", () => {
    const out = wrapImagesInFigures(
      `<img src="${PNG}"><p>x</p><img src="${PNG}">`,
      PLACEHOLDER,
      "tok123",
    );
    expect(out).toContain("<figure>");
    // WP-D10: die Fußnote startet LEER — der Platzhalter ist ein reines Editor-Render-Artefakt und
    // steht NIE als echter Text im Body.
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}tok123-1"></figcaption>`);
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}tok123-2"></figcaption>`);
    // WP-BILD-1b: beidseitige Verankerung — auch das img trägt dieselbe ID.
    expect(out).toContain(`<img data-image-id="${IMAGE_ID_PREFIX}tok123-1"`);
    expect(out).toContain(`<img data-image-id="${IMAGE_ID_PREFIX}tok123-2"`);
    expect(out).not.toContain(PLACEHOLDER);
    expect((out.match(/<figure>/g) ?? []).length).toBe(2);
  });

  it("WP-D10: der Platzhalter-Parameter landet NIE im Body; Bilder ohne data:image bleiben unberührt", () => {
    const out = wrapImagesInFigures('<img src="/api/objects/x/raw">', "<b>böse</b>");
    // Object-Store-Bild (kein data:image) wird NICHT umhüllt.
    expect(out).toBe('<img src="/api/objects/x/raw">');
    // Auch ein bösartiger Platzhalter-Text kann nichts injizieren — er wird gar nicht geschrieben.
    const wrapped = wrapImagesInFigures(`<img src="${PNG}">`, "<b>böse</b>");
    expect(wrapped).not.toContain("böse");
    expect(wrapped).toContain("></figcaption>");
  });
});

describe("WP-BILD-1a: extractDocxRich erzeugt Bild-Fußnoten", () => {
  it("mit Platzhalter-Option → figure mit LEERER figcaption/data-image-id im bodyHtml; Zähler stimmen", async () => {
    const { html, totalImages } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineOf(`<p>Text</p><img src="${PNG}">`),
      mapImage: async (src) => src,
      imageBudgetBytes: 3_500_000,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "run001",
    });
    expect(html).toContain("<figure>");
    expect(html).toContain(`data-image-id="${IMAGE_ID_PREFIX}run001-1"`);
    // WP-D10: Import erzeugt eine LEERE Fußnote — der Platzhaltertext steht nie im bodyHtml.
    expect(html).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}run001-1"></figcaption>`);
    expect(html).not.toContain(PLACEHOLDER);
    expect(html).toContain(PNG);
    expect(totalImages).toBe(1);
  });

  it("ohne Platzhalter → rückwärtskompatibel bare <img> (keine figure)", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineOf(`<img src="${PNG}">`),
      mapImage: async (src) => src,
      imageBudgetBytes: 3_500_000,
    });
    expect(html).not.toContain("<figure>");
    expect(html).toContain(PNG);
  });
});

describe("WP-BILD-1a: Byte-Budget droppt das GANZE figure-Element", () => {
  it("figure-umhülltes Bild wird als Einheit gemessen und bei Überlauf komplett entfernt", async () => {
    const two = wrapImagesInFigures(`<img src="${PNG}"><img src="${PNG}">`, PLACEHOLDER);
    const oneFigure = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER);
    // Budget = genau eine figure-Einheit → das zweite Bild fällt komplett (samt Fußnote).
    const budget = utf8ByteLength(oneFigure);
    const res = await applyInlineImageBudget(two, async (src) => src, budget);
    expect(res.total).toBe(2);
    expect(res.kept).toBe(1);
    expect(res.dropped).toBe(1);
    // Keine verwaiste Fußnote: genau eine figcaption bleibt, kein loses </figure>.
    expect((res.html.match(/<figcaption/g) ?? []).length).toBe(1);
    expect((res.html.match(/<figure>/g) ?? []).length).toBe(1);
    expect((res.html.match(/<\/figure>/g) ?? []).length).toBe(1);
  });

  it("re-encodiert die Bild-src innerhalb der figure (compressed zählt korrekt)", async () => {
    const one = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER);
    const res = await applyInlineImageBudget(
      one,
      async () => "data:image/jpeg;base64,SCALED",
      3_500_000,
    );
    expect(res.kept).toBe(1);
    expect(res.compressed).toBe(1);
    expect(res.html).toContain("data:image/jpeg;base64,SCALED");
    expect(res.html).toContain("<figcaption");
    expect(res.html).not.toContain(PNG);
  });
});

describe("WP-BILD-1a: Sanitizer erhalten figure/figcaption/data-image-id, strippen Böses", () => {
  // JOB 509 / D5: Der Vertrag ist jetzt der DREIFACHANKER. Geprüft wird die ERHALTUNG durch BEIDE
  // Sanitizer — das ist die Parität, auf die es ankommt. Die ERZEUGUNG eines fehlenden Ankers bleibt
  // serverautoritativ (eigener Fall unten); der Client erfindet weiterhin keine Identität.
  const evil =
    '<figure data-image-id="kw-img-1"><img src="/api/objects/abc/raw" data-image-id="kw-img-1"><figcaption data-image-id="kw-img-1" onclick="x()" style="color:red">Beschreibung</figcaption></figure>';

  for (const [label, sanitize] of [
    ["Client (richText)", clientSanitize],
    ["Server (services/structure)", serverSanitize],
  ] as const) {
    it(`${label}: Dreifachanker bleibt vollständig, on*/style raus`, () => {
      const clean = sanitize(evil);
      expect(clean).toContain('<figure data-image-id="kw-img-1">');
      expect(clean).toContain('<figcaption data-image-id="kw-img-1">');
      // Alle drei Träger — nicht zwei (das war der D3-Zweifachanker).
      expect(clean.split('data-image-id="kw-img-1"').length - 1).toBe(3);
      expect(clean).toContain("Beschreibung");
      expect(clean).not.toContain("onclick");
      expect(clean).not.toContain("style");
    });

    it(`${label}: ungültiger Token am figure wird verworfen (kein Schlupfloch am Container)`, () => {
      const clean = sanitize(
        '<figure data-image-id="evil id spaces"><img src="/api/objects/x/raw"></figure>',
      );
      expect(clean).not.toContain("evil id spaces");
    });

    it(`${label}: figure bekommt KEINE allgemeine Attributfreigabe`, () => {
      const clean = sanitize(
        '<figure style="color:red" onclick="x()" class="panel" id="f1"><img src="/api/objects/x/raw"></figure>',
      );
      const open = /<figure\b[^>]*>/.exec(clean)?.[0] ?? "";
      expect(open).not.toContain("style");
      expect(open).not.toContain("onclick");
      expect(open).not.toContain("class=");
      // Eigenständiges id-Attribut (nicht das Teilstück in data-image-id) bleibt gesperrt.
      expect(open).not.toMatch(/\sid=/);
      // Am Container ist ausschließlich der Anker zulässig — sonst gar nichts.
      expect(open).toMatch(/^<figure( data-image-id="[\w-]{1,64}")?>$/);
    });

    it(`${label}: ungültige data-image-id (Leerzeichen) wird verworfen`, () => {
      const clean = sanitize('<figcaption data-image-id="evil id spaces">x</figcaption>');
      expect(clean).toContain("<figcaption>");
      expect(clean).not.toContain("data-image-id");
    });

    it(`${label}: <script> in der Fußnote wird komplett entfernt`, () => {
      const clean = sanitize(
        '<figcaption data-image-id="kw-img-1">Text<script>alert(1)</script></figcaption>',
      );
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("alert(1)");
      expect(clean).toContain("Text");
    });
  }
});

describe("WP-BILD-1a: Rich-Body + i18n", () => {
  it("shouldPreserveRichBody wertet einen figure-Body als reich (Original ist heilig)", () => {
    expect(
      shouldPreserveRichBody(
        `<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-1">c</figcaption></figure>`,
      ),
    ).toBe(true);
  });

  it("Platzhalter-Key existiert DE/EN/NL und ist ehrlich (keine erfundene Beschreibung)", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(
        i18n.getResource(lng, "translation", "capture.file.imageCaptionPlaceholder"),
      );
      expect(msg.length, lng).toBeGreaterThan(0);
    }
    expect(
      String(i18n.getResource("de", "translation", "capture.file.imageCaptionPlaceholder")),
    ).toMatch(/Noch keine/);
  });
});

// WP-BILD-1b (bens Auflage 1): bodyweit kollisionsfeste IDs. kw-img-N allein kollidiert, sobald zwei Importe
// in DENSELBEN Body fließen — der runToken (kw-img-<token>-N) verhindert das.
describe("WP-BILD-1b: kollisionsfeste Bild-IDs (runToken)", () => {
  function idsOf(html: string): string[] {
    return [...html.matchAll(/data-image-id="([^"]+)"/g)].map((m) => m[1] ?? "");
  }

  it("zwei Import-Läufe in EINEN Body → alle Bild-IDs eindeutig, keine Überschneidung", () => {
    const runA = wrapImagesInFigures(`<img src="${PNG}"><img src="${PNG}">`, PLACEHOLDER, "aaaaaa");
    const runB = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "bbbbbb");
    const body = `${runA}${runB}`;
    const ids = idsOf(body);
    // 3 Bilder × 2 Anker (img + figcaption) = 6 Vorkommen, aber nur 3 verschiedene IDs.
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(3);
    // Kein Lauf-Token überschneidet sich — jede ID gehört eindeutig zu genau einem Import-Lauf.
    for (const id of new Set(ids)) {
      const fromA = id.startsWith(`${IMAGE_ID_PREFIX}aaaaaa-`);
      const fromB = id.startsWith(`${IMAGE_ID_PREFIX}bbbbbb-`);
      expect(fromA !== fromB).toBe(true);
    }
  });

  it("Einfügen in einen Body mit vorhandenen figures überschreibt bestehende IDs nie", () => {
    // Bestehender Body (früherer Import) mit fester ID; neuer Import wird nur an die ROH-Fragmente angelegt.
    const existing = `<figure><img data-image-id="${IMAGE_ID_PREFIX}old99-1" src="/api/objects/x/raw"><figcaption data-image-id="${IMAGE_ID_PREFIX}old99-1">alt</figcaption></figure>`;
    const fresh = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "new77");
    const merged = `${existing}${fresh}`;
    // Die bestehende ID bleibt unverändert erhalten …
    expect(merged).toContain(`${IMAGE_ID_PREFIX}old99-1`);
    // … und die neue ID kollidiert nicht mit ihr.
    expect(idsOf(fresh).every((id) => id !== `${IMAGE_ID_PREFIX}old99-1`)).toBe(true);
  });

  it("newImageRunToken liefert genau 6 Zeichen aus [a-z0-9] (Sanitizer-Token-Vertrag)", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(newImageRunToken()).toMatch(/^[a-z0-9]{6}$/);
    }
  });
});

// WP-BILD-1b (bens Auflage 2): beidseitige Verankerung — img UND figcaption tragen dieselbe data-image-id.
describe("WP-BILD-1b: img und figcaption teilen dieselbe ID", () => {
  it("pro Bild trägt sowohl <img> als auch <figcaption> exakt dieselbe data-image-id", () => {
    const out = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "share1");
    const id = `${IMAGE_ID_PREFIX}share1-1`;
    expect(out).toContain(`<img data-image-id="${id}"`);
    expect(out).toContain(`<figcaption data-image-id="${id}">`);
    // Genau zwei Anker mit dieser ID (Bild + Fußnote), gegenseitig auffindbar.
    expect(out.split(`data-image-id="${id}"`).length - 1).toBe(2);
  });

  it("beide Sanitizer erhalten den Token an figure, img UND figcaption (drei Vorkommen)", () => {
    const id = `${IMAGE_ID_PREFIX}s2-1`;
    const markup = `<figure data-image-id="${id}"><img data-image-id="${id}" src="/api/objects/x/raw"><figcaption data-image-id="${id}">c</figcaption></figure>`;
    for (const sanitize of [clientSanitize, serverSanitize]) {
      const clean = sanitize(markup);
      expect(clean.split(`data-image-id="${id}"`).length - 1).toBe(3);
    }
    // Böses Token am img wird verworfen (Vertrag gewahrt).
    const evilImg = '<img data-image-id="böse id" src="/api/objects/x/raw">';
    for (const sanitize of [clientSanitize, serverSanitize]) {
      expect(sanitize(evilImg)).not.toContain("data-image-id");
    }
  });

  // JOB 509 / D5: Der Server ERZEUGT die fehlende Container-Identität — genau hier lag die D3-Lücke.
  it("Server hebt eine zweifach verankerte Altlast auf den Dreifachanker (Client erfindet nichts)", () => {
    const id = `${IMAGE_ID_PREFIX}alt1-1`;
    const zweifach = `<figure><img data-image-id="${id}" src="/api/objects/x/raw"><figcaption data-image-id="${id}">c</figcaption></figure>`;
    const saved = serverSanitize(zweifach);
    expect(saved.split(`data-image-id="${id}"`).length - 1).toBe(3);
    expect(saved).toContain(`<figure data-image-id="${id}">`);
    // Der Client verankert von sich aus nicht — er erhält nur, was da ist (Identität ist serverautoritativ).
    expect(clientSanitize(zweifach).split(`data-image-id="${id}"`).length - 1).toBe(2);
  });
});

// WP-BILD-1b (bens Auflage 3): echter Save-/Reload-Roundtrip durch den SERVER-Sanitizer.
describe("WP-BILD-1b: Save-/Reload-Roundtrip (Server-Sanitizer)", () => {
  it("figure/img/figcaption mit editierter Caption bleibt beim Speichern und erneuten Laden erhalten", () => {
    const id = `${IMAGE_ID_PREFIX}round1-1`;
    const imported = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "round1");
    // WP-D10: Import liefert eine LEERE Fußnote; der Nutzer tippt die echte Beschreibung hinein.
    const edited = imported.replace("></figcaption>", ">Diagramm der Quartalszahlen</figcaption>");
    // Speichern = durch den autoritativen Server-Sanitizer.
    const saved = serverSanitize(edited);
    // Erneutes Laden = erneut sanitisieren → byte-gleich (idempotent, kein Verlust).
    const reloaded = serverSanitize(saved);
    expect(reloaded).toBe(saved);
    // Struktur + ALLE DREI Anker + editierte Caption bleiben erhalten.
    expect(saved).toContain(`<figure data-image-id="${id}">`);
    expect(saved).toContain("Diagramm der Quartalszahlen");
    expect(saved).not.toContain(PLACEHOLDER);
    expect(saved.split(`data-image-id="${id}"`).length - 1).toBe(3);
    expect(tripleAnchorOf(saved)).toBe(id);
  });
});

// JOB 509 / D5 (BEN-D4 Punkt 3, Variante 2): DER vollständige Produktbeweis — Server → Client →
// Editor → Save → Reload. Ohne Clientparität würde der Container-Anker beim ersten Speichern aus dem
// Editor verschwinden und der Dreifachanker wäre wieder ein Zweifachanker.
describe("JOB 509 / D5: Dreifachanker überlebt den echten Editor-Roundtrip (jsdom)", () => {
  it("Server→Client→Editor→Save→Reload: derselbe Token bleibt auf allen drei Trägern", () => {
    // 1) Import ohne Container-Anker → Server verankert autoritativ alle drei Träger.
    const imported = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "rt5");
    const stored = serverSanitize(imported);
    const id = tripleAnchorOf(stored);

    // 2) Laden in den Editor: Client-Sanitize + Editor-Verankerung (echtes DOM).
    const editor = doc.createElement("div");
    editor.innerHTML = clientSanitize(stored);
    enhanceFiguresForEditing(editor);
    const caption = editor.querySelector("figcaption");
    if (!caption) {
      throw new Error("figcaption fehlt im Editor");
    }
    expect(caption.getAttribute("data-image-id")).toBe(id);

    // 3) Nutzer tippt die Beschreibung; Speichern = Client-emit, danach Server-Sanitize.
    caption.textContent = "Aufbau des Pruefstands";
    const emitted = clientSanitize(editor.innerHTML);
    expect(emitted).not.toContain("contenteditable");
    const saved = serverSanitize(emitted);

    // 4) Erneutes Laden: byte-gleich und weiterhin dreifach verankert.
    const reloaded = serverSanitize(saved);
    expect(reloaded).toBe(saved);
    expect(tripleAnchorOf(reloaded)).toBe(id);
    expect(reloaded.split(`data-image-id="${id}"`).length - 1).toBe(3);
    expect(reloaded).toContain("Aufbau des Pruefstands");
  });

  it("zwei gleiche Bilder mit gleichem Text bleiben über den Roundtrip unterscheidbar", () => {
    const one = `<figure><img src="/api/objects/x/raw"><figcaption>Ventil</figcaption></figure>`;
    const stored = serverSanitize(`${one}${one}`);
    const editor = doc.createElement("div");
    editor.innerHTML = clientSanitize(stored);
    enhanceFiguresForEditing(editor);
    const reloaded = serverSanitize(clientSanitize(editor.innerHTML));
    const ids = [...reloaded.matchAll(/<figure data-image-id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });
});
