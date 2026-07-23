// @vitest-environment jsdom
// WP-BILD-1f (Pedi 22.07.): der KI-Fußnoten-Vorschlag bekommt den umgebenden Dokument-Kontext mit
// (Titel + nächstliegende Überschrift + umgebende Absätze), damit die Fußnote fachsprachlich passt.
// Diese Suite prüft die reine Extraktions-/Budget-Logik: korrektes Einsammeln aus dem DOM, HTML wird
// gestrippt (nur Text), und das HARTE Zeichenbudget kürzt Überschuss ehrlich ab. Der Egress-Beweis
// (vertraulich → kein Kontext) liegt im Reasoner-Test (tests/reasoner/describe-image.test.ts).
import { describe, expect, it } from "vitest";
import {
  CONTEXT_PARAGRAPHS_EACH_SIDE,
  MAX_IMAGE_CONTEXT_CHARS,
  buildImageContext,
  collectImageContext,
} from "../../apps/web/src/lib/captionContext";

describe("buildImageContext: Zusammenstellung + Budget", () => {
  it("setzt Titel, Überschrift und Absätze in fester Reihenfolge zusammen", () => {
    const ctx = buildImageContext({
      title: "Pumpenwartung",
      heading: "Dichtungen",
      paragraphs: ["Die Gleitringdichtung wird geprüft.", "Danach folgt der Probelauf."],
    });
    expect(ctx).toBe(
      "Titel: Pumpenwartung\nAbschnitt: Dichtungen\nDie Gleitringdichtung wird geprüft.\nDanach folgt der Probelauf.",
    );
  });

  it("lässt leere/fehlende Teile ehrlich weg", () => {
    expect(buildImageContext({})).toBe("");
    expect(buildImageContext({ title: "   ", paragraphs: ["", "  "] })).toBe("");
    expect(buildImageContext({ heading: "Nur Abschnitt" })).toBe("Abschnitt: Nur Abschnitt");
  });

  it("normalisiert Whitespace (kein verschwendetes Budget an Layout-Leerraum)", () => {
    expect(buildImageContext({ paragraphs: ["viel   \n\n  Leerraum\tdazwischen"] })).toBe(
      "viel Leerraum dazwischen",
    );
  });

  it("kürzt HART auf das Budget (Überschuss abgeschnitten)", () => {
    const ctx = buildImageContext({ paragraphs: ["9".repeat(MAX_IMAGE_CONTEXT_CHARS + 200)] });
    expect(ctx.length).toBe(MAX_IMAGE_CONTEXT_CHARS);
  });
});

describe("collectImageContext: aus dem Editor-DOM (jsdom)", () => {
  function editorWith(html: string): { root: HTMLElement; figure: HTMLElement } {
    const root = document.createElement("div");
    root.innerHTML = html;
    const figure = root.querySelector("figure");
    if (!figure) {
      throw new Error("Testfixture ohne <figure>");
    }
    return { root, figure: figure as HTMLElement };
  }

  it("zieht die nächstliegende Überschrift und die umgebenden Absätze (HTML gestrippt)", () => {
    const { root, figure } = editorWith(`
      <h2>Einleitung</h2>
      <p>Weit weg, wird nicht erwartet.</p>
      <h3>Dichtungen</h3>
      <p>Absatz <strong>eins</strong> mit Fettung.</p>
      <figure><img src="data:image/png;base64,AA"><figcaption>alt</figcaption></figure>
      <p>Absatz zwei danach.</p>
      <p>Absatz drei danach.</p>
      <p>Absatz vier danach.</p>
    `);
    const ctx = collectImageContext(root, figure, "Pumpenwartung");
    expect(ctx).toContain("Titel: Pumpenwartung");
    expect(ctx).toContain("Abschnitt: Dichtungen");
    expect(ctx).toContain("Absatz eins mit Fettung."); // <strong> gestrippt
    expect(ctx).toContain("Absatz zwei danach.");
    expect(ctx).toContain("Absatz drei danach.");
    // Nur CONTEXT_PARAGRAPHS_EACH_SIDE (=2) Absätze je Seite: der vierte fällt raus.
    expect(CONTEXT_PARAGRAPHS_EACH_SIDE).toBe(2);
    expect(ctx).not.toContain("Absatz vier danach.");
    // Über die nächstliegende Überschrift hinaus wird nicht gesammelt.
    expect(ctx).not.toContain("Weit weg");
    expect(ctx).not.toContain("Einleitung");
  });

  it("stoppt nach unten am nächsten Abschnitt (folgende Überschrift begrenzt)", () => {
    const { root, figure } = editorWith(`
      <p>Direkt davor.</p>
      <figure><img src="x"><figcaption>c</figcaption></figure>
      <h3>Nächster Abschnitt</h3>
      <p>Gehört nicht mehr dazu.</p>
    `);
    const ctx = collectImageContext(root, figure, null);
    expect(ctx).toContain("Direkt davor.");
    expect(ctx).not.toContain("Gehört nicht mehr dazu.");
    expect(ctx).not.toContain("Nächster Abschnitt");
  });

  it("ohne Titel und ohne Umgebung: leerer Kontext (nie erfunden)", () => {
    const { root, figure } = editorWith(`<figure><img src="x"><figcaption>c</figcaption></figure>`);
    expect(collectImageContext(root, figure, null)).toBe("");
  });

  it("Figur nicht im Baum → nur der Titel", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>irgendwas</p>";
    const detached = document.createElement("figure");
    expect(collectImageContext(root, detached, "Nur Titel")).toBe("Titel: Nur Titel");
  });
});
