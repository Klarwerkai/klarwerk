// @vitest-environment jsdom
// AUFTRAG-mega85 Block D — DER TITEL IST NICHT MEHR VERGESSBAR.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 4): `documentTitle` stand als OPTIONALER Prop an
// `RichTextEditor` (Zeile 124) und an `KnowledgeInputStudio` (Zeile 80). mega84 hat alle heutigen
// Einbindungen versorgt — acht Vorkommen in vier Dateien. Aber „heute versorgt" ist nicht
// „baulich ausgeschlossen": eine fünfte Fläche morgen wäre vom Typsystem zu nichts gezwungen
// gewesen, und der KI-Vorschlag entstünde dort ohne den stärksten Fachbegriff-Anker des Dokuments.
// Das ist wörtlich die mega50-Fehlerklasse, ein zweites Mal.
//
// DIE ENTSCHEIDUNG: PFLICHTPARAMETER, nicht Kontext. Begründung, nachgemessen statt vermutet:
// `ImageDescribeProvider` — die vorhandene „nicht vergessbare Quelle" dieses Projekts — wird auch
// als WURZEL im Anwendungsrahmen montiert (`App.tsx`, Zeile 95), also über Flächen, zu denen es kein
// Dokument gibt. Ein Titel in diesem Kontext wäre für die Wurzel eine Lüge. Der Kontext trägt eine
// FÄHIGKEIT (der describe-Weg, die Verfügbarkeit); der Titel ist INHALT genau einer Einbindung.
// Inhalt gehört an den Prop. Und dort ist der Compiler der billigste Wächter, den es gibt — dieselbe
// Lösung wie bei den vier Zugängen in mega76.
//
// WAS DIESE DATEI BELEGT UND WAS NICHT: sie belegt den VERTRAG zur Übersetzungszeit — eine
// Einbindung ohne Titel compiliert nicht. Dass die Produktflächen wirklich einen Titel FÜHREN, ist
// eine andere Frage und steht je Instanz in `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` (Stufe 1+2, seit mega85 fundgenau).
import { describe, expect, it } from "vitest";
import type { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import type { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";

type EditorProps = Parameters<typeof RichTextEditor>[0];
type StudioProps = Parameters<typeof KnowledgeInputStudio>[0];

// ── Der Vertrag zur ÜBERSETZUNGSZEIT ────────────────────────────────────────────────────────────
//
// `@ts-expect-error` ist hier die eigentliche Prüfung, und sie läuft im Tor (`tools/build` →
// `tsc -p tsconfig.tests-tsx.json`). Die Zeile verlangt, dass DIESE Zuweisung einen Typfehler
// erzeugt. Würde `documentTitle` wieder optional, verschwände der Fehler — und dann wird
// `@ts-expect-error` SELBST zum Fehler und das Tor rot. Ein Wächter, der genau dann anschlägt, wenn
// der Schutz weggenommen wird.

// @ts-expect-error AUFTRAG-mega85 Block D: eine Einbindung OHNE documentTitle darf nicht compilieren.
const editorOhneTitel: EditorProps = { value: "", onChange: () => undefined };

// @ts-expect-error AUFTRAG-mega85 Block D: dasselbe für den zweiten Träger der Bildbeschreibung.
const studioOhneTitel: StudioProps = {
  open: false,
  onClose: () => undefined,
  bodyHtml: "",
  onApply: () => undefined,
};

// Mit Titel muss es dagegen sehr wohl compilieren — sonst wäre der Vertrag nicht erfüllbar.
const editorMitTitel: EditorProps = {
  value: "",
  onChange: () => undefined,
  documentTitle: "Wartungsnotiz",
};

describe("mega85 Block D: der Dokument-Titel ist Pflicht, nicht Höflichkeit", () => {
  it("die Einbindung ohne Titel existiert nur als Typfehler (belegt durch @ts-expect-error oben)", () => {
    // Zur Laufzeit sind die drei Objekte nur Zeugen dafür, dass die Zeilen oben wirklich übersetzt
    // werden und nicht wegoptimiert sind. Die Aussage selbst trifft der Compiler.
    expect(editorOhneTitel).not.toHaveProperty("documentTitle");
    expect(studioOhneTitel).not.toHaveProperty("documentTitle");
    expect(editorMitTitel.documentTitle).toBe("Wartungsnotiz");
  });

  it("ein leerer Titel ist erlaubt — als ENTSCHEIDUNG, die dasteht", () => {
    // Ein Dokument ohne Titel gibt es (ein frischer Entwurf). Der Vertrag verlangt nicht, dass
    // immer ein Titel DA ist, sondern dass jede Fläche den Fall entschieden hat.
    const leer: EditorProps = { value: "", onChange: () => undefined, documentTitle: "" };
    expect(leer.documentTitle).toBe("");
  });
});
