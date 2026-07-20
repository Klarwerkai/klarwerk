// WP-D7 (Pedi-Live-Test nach Deploy 45a6bb8, 0,5/4): vier Integrationslücken zwischen Unit-Ebene und
// echter UI. Diese Tests sichern die Behebung: (1) EINE zentrale accept-Konstante inkl. .pptx, kein
// hartkodierter Dokument-Dialog mehr; (2) Bild-Fußnoten im Editor editierbar verankert (Source-Pin +
// CSS-Pin); (3) KI-Vorschlag zeigt bei reichem Body nur den Titel + Prompt-Kappung gegen FALLBACK/Latenz;
// (4) ehrliches Ladefeedback beim Einreichen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  shouldPreserveRichBody,
  structureProposalTitleOnly,
} from "../../apps/web/src/lib/bodyAiAssist";
import { FILE_CAPTURE_ACCEPT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import {
  FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS,
  buildFrontDoorStructureInput,
} from "../../apps/web/src/lib/captureFrontDoor";

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOC_INPUT_FILES = [
  "apps/web/src/pages/Capture.tsx",
  "apps/web/src/components/BodyExtractPanel.tsx",
  "apps/web/src/components/KnowledgeInputStudio.tsx",
];

describe("WP-D7 Befund 1: zentrale accept-Konstante inkl. .pptx", () => {
  it("beide Konstanten enthalten .pptx UND den PPTX-MIME; Capture-Variante leitet sich ab", () => {
    for (const accept of [FILE_IMPORT_ACCEPT, FILE_CAPTURE_ACCEPT]) {
      expect(accept).toContain(".pptx");
      expect(accept).toContain(PPTX_MIME);
      expect(accept).toContain(".docx");
      expect(accept).toContain("image/*");
    }
    // FILE_CAPTURE_ACCEPT = Dokument-Import + Video/Audio → pptx bleibt ohne Drift automatisch dabei.
    expect(FILE_CAPTURE_ACCEPT.startsWith(FILE_IMPORT_ACCEPT)).toBe(true);
    expect(FILE_CAPTURE_ACCEPT).toContain("video/*");
    expect(FILE_CAPTURE_ACCEPT).toContain("audio/*");
    // Der reine Dokument-Import trägt KEIN Video/Audio (Text-Extraktion).
    expect(FILE_IMPORT_ACCEPT).not.toContain("video/*");
  });

  it("kein Dokument-file-input trägt mehr eine hartkodierte accept-Liste (grep-Source-Pin)", () => {
    for (const file of DOC_INPUT_FILES) {
      const src = readSource(file);
      // Die alte hartkodierte Liste beginnt mit .txt und führt .docx/.pdf — darf nicht mehr vorkommen.
      expect(src.includes('accept=".txt')).toBe(false);
      expect(src.includes(".docx,.pdf")).toBe(false);
    }
    // Stattdessen referenzieren sie die zentrale Konstante.
    const capture = readSource("apps/web/src/pages/Capture.tsx");
    expect(capture).toContain("accept={FILE_CAPTURE_ACCEPT}");
    expect(capture).toContain("accept={FILE_IMPORT_ACCEPT}");
    expect(readSource("apps/web/src/components/BodyExtractPanel.tsx")).toContain(
      "accept={FILE_IMPORT_ACCEPT}",
    );
    expect(readSource("apps/web/src/components/KnowledgeInputStudio.tsx")).toContain(
      "accept={FILE_CAPTURE_ACCEPT}",
    );
  });

  it("die reinen Bild-Inputs bleiben unangetastet (image/*)", () => {
    // Der Bild-Upload und der Editor-Bild-Input dürfen NICHT auf die Dokumentliste umgestellt werden.
    expect(readSource("apps/web/src/pages/Capture.tsx")).toContain('accept="image/*"');
    expect(readSource("apps/web/src/components/RichTextEditor.tsx")).toContain(
      'accept="image/png,image/jpeg,image/gif,image/webp"',
    );
  });
});

describe("WP-D7 Befund 2: Bild-Fußnote im Editor editierbar", () => {
  const rte = () => readSource("apps/web/src/components/RichTextEditor.tsx");

  it("verankert figcaption editierbar und img nicht editierbar (Source-Pin)", () => {
    // WP-D7b: die DOM-Logik lebt jetzt in editorFigures.ts (DOM-lib-frei, testbar); der Editor ruft sie auf.
    const lib = readSource("apps/web/src/lib/editorFigures.ts");
    expect(lib).toContain('caption.setAttribute("contenteditable", "true")');
    expect(lib).toContain('img.setAttribute("contenteditable", "false")');
    // figcaption wird NIE auf contenteditable=false gesetzt.
    expect(lib).not.toContain('figcaption.setAttribute("contenteditable", "false")');

    const src = rte();
    expect(src).toContain("enhanceFiguresForEditing");
    // Die Editier-Verankerung läuft nach jedem innerHTML-Setzen.
    expect(src).toContain("el.innerHTML = safe");
  });

  it("die figcaption-CSS-Regel blockiert weder Klick noch Auswahl (kein pointer-events/user-select:none)", () => {
    const css = readSource("apps/web/src/index.css");
    const start = css.indexOf(".prose-kw figcaption");
    expect(start).toBeGreaterThanOrEqual(0);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).not.toContain("pointer-events");
    expect(rule).not.toContain("user-select");
  });
});

describe("WP-D7 Befund 3: KI-Vorschlag bei reichem Body nur Titel + Prompt-Kappung", () => {
  it("structureProposalTitleOnly folgt exakt shouldPreserveRichBody (keine zweite Liste)", () => {
    const rich = '<figure><img src="/api/objects/x/raw"><figcaption>c</figcaption></figure>';
    const richStruct = "<p>Absatz</p><h2>Überschrift</h2>";
    const flat = "<p>nur flacher Text</p><p>noch einer</p>";
    for (const html of [rich, richStruct, flat, "", "<p><br></p>"]) {
      expect(structureProposalTitleOnly(html)).toBe(shouldPreserveRichBody(html));
    }
    expect(structureProposalTitleOnly(rich)).toBe(true);
    expect(structureProposalTitleOnly(flat)).toBe(false);
  });

  it("die Vorschlags-Anzeige verzweigt auf proposalTitleOnly und nutzt den ehrlichen Erklär-Key", () => {
    const page = readSource("apps/web/src/pages/CaptureFrontDoor.tsx");
    expect(page).toContain("structureProposalTitleOnly");
    expect(page).toContain("proposalTitleOnly");
    expect(page).toContain("fd.structureRichTitleOnly");
  });

  it("kappt einen zu großen Prompt an der Wortgrenze mit ehrlichem Kürzungshinweis", () => {
    const longBody = `<p>${"wort ".repeat(6000)}</p>`; // ~30.000 Zeichen Klartext
    const out = buildFrontDoorStructureInput({ title: "Titel", bodyHtml: longBody });
    expect(out.length).toBeLessThanOrEqual(FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS + 8);
    expect(out.endsWith("[…]")).toBe(true);
    // Kurzer Body bleibt unverändert (kein Marker, keine Kappung).
    expect(buildFrontDoorStructureInput({ title: "Titel", bodyHtml: "<p>kurz</p>" })).toBe(
      "Titel\n\nkurz",
    );
  });

  it("der Erklär-Text existiert in DE/EN/NL und behauptet nur einen Titel-Vorschlag", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", "fd.structureRichTitleOnly"));
      expect(msg.length, lng).toBeGreaterThan(0);
    }
    expect(String(i18n.getResource("de", "translation", "fd.structureRichTitleOnly"))).toMatch(
      /Titel/,
    );
  });
});

describe("WP-D7 Befund 4: ehrliches Ladefeedback beim Einreichen", () => {
  it("beide Einreichen-Knöpfe zeigen bei submit.isPending Spinner + Busy-Text (Source-Pin)", () => {
    const src = readSource("apps/web/src/pages/Capture.tsx");
    // WP-D7b: beide Knöpfe nutzen den mehrstufigen submitBusyLabel (Fallback = capture.submitBusy).
    const occurrences = (src.match(/\{submitBusyLabel\}/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(src).toContain('t("capture.submitBusy")');
    // Spinner an den Einreichen-Knöpfen (Loader2 animate-spin) beim Pending-Zustand.
    expect(src).toContain("submit.isPending ? (");
    expect(src).toContain('<Loader2 size={15} className="animate-spin" />');
  });

  it("der Busy-Text existiert in DE/EN/NL", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", "capture.submitBusy"));
      expect(msg.length, lng).toBeGreaterThan(0);
    }
  });
});
