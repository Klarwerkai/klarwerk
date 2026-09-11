// ==================================================================================================
// JOB 3606 · Pflichtlieferung 4 — DIE RUHIGERE, KOMPAKTERE FLÄCHE. GEMESSEN AN DER DATEI, DIE CHROME LÄDT.
// ==================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die Rettungsfassung 0.4.1, die Codex am 11.09. im echten Chrome gebaut
// und gemessen hat, bringt ihre Kompaktheit ausschliesslich in `panel.css` unter (+88 Zeilen). Die
// Runden 1–3 dieses Jobs haben `panel.css` NICHT angefasst — die Datei stand bis 17:5x nicht in den
// Zielpfaden, ein Zugriff machte Runde 1 rot. Die Funktionsreparatur war damit belegt, die Fläche
// nicht: `#content` trug weiter `max-height: 460px` statt `26vh`, und die Speicherzeile
// (`panel.html:170`, Klasse `save-actions`) hatte überhaupt keine Regel. BEN hat das zur
// Korrekturpflicht gemacht, Codex ausdrücklich zur Nachbesserung „nicht erst durch grünes Tor
// erledigt zählen".
//
// WAS DIESE DATEI PRÜFT — und in welchen Grenzen. Sie liest die ausgelieferten Dateien und prüft den
// VERTRAG zwischen ihnen: jede Kompaktregel ist da, sie hat in `panel.html` einen Nutzer, und für die
// Höhe des Inhaltsfeldes gibt es GENAU EINE Wahrheit. Das ist bewusst mehr als „steht drin":
//
//   · Ohne den Nutzer-Nachweis dürfte eine Regel auf Vorrat stehen und nichts treffen.
//   · Ohne die Einzigkeit der Höhenwahrheit bliebe `.content { max-height: 460px }` daneben stehen,
//     von `#content` zwar überstimmt, aber als zweite Wahrheit in derselben Datei — genau der
//     Fehler, den der Kopfkommentar von `panel.css` seit JOB 3278 verbietet.
//
// WAS SIE AUSDRÜCKLICH NICHT LEISTET: sie rechnet KEINE Geometrie. jsdom legt kein Layout aus und
// lädt dieses Stylesheet nicht; „passt in eine 340-px-Leiste" kann hier niemand messen. Ob die
// Fläche wirklich ruhiger ist, entscheidet das Auge im echten Chrome (Auftrag §5). Diese Datei
// verhindert nur, dass die gemessenen Regeln unbemerkt wieder verschwinden.
import { describe, expect, it } from "vitest";
import { read } from "../klara-browser/harness";

const PANEL_CSS = read("panel.css");
const PANEL_HTML = read("panel.html");

/** Der Block einer Regel, ohne Kommentare und ohne Umbrüche — so vergleicht sich eine Deklaration. */
function regel(selektor: string): string {
  const ohneKommentar = PANEL_CSS.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Der Selektor steht am Zeilenanfang, damit `#content` nicht in `#content h2` hineinliest.
  const treffer = ohneKommentar.match(
    new RegExp(`(?:^|\\n)${selektor.replace(/[.#*+?^$()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`),
  );
  expect(treffer, `panel.css führt keine Regel „${selektor}"`).not.toBeNull();
  return (treffer?.[1] ?? "").replace(/\s+/g, " ").trim();
}

// Die Kompaktregeln der gemessenen 0.4.1 — Selektor, die Deklarationen, auf die es ankommt, und der
// Nutzer in `panel.html`, ohne den die Regel niemanden träfe.
const KOMPAKT: { selektor: string; deklarationen: string[]; nutzer: string }[] = [
  // Der Inhalt bekommt einen Anteil des FENSTERS statt 460 fester Pixel: in einer 700 px hohen
  // Leiste bleiben darunter Titel, Vertraulichkeit und die Speicherzeile ohne Scrollen erreichbar.
  {
    selektor: "#content",
    deklarationen: ["min-height: 120px", "max-height: 26vh", "overflow: auto", "padding: 10px"],
    nutzer: 'id="content"',
  },
  // Speichern und Verwerfen kleben am unteren Rand des Scrollfeldes — die eine Handlung, die man
  // nach dem Lesen braucht, wandert nicht unter den Fensterrand.
  {
    selektor: ".save-actions",
    deklarationen: ["position: sticky", "bottom: 0", "border-top: 1px solid var(--hairline)"],
    nutzer: "save-actions",
  },
  // Der Konto-Block ist ein zugeklappter Kasten, keine Formularwand.
  {
    selektor: ".account-details",
    deklarationen: ["padding: 8px 10px", "font-size: 12px"],
    nutzer: "account-details",
  },
  // Die Umfangswahl trägt die Polsterung eines Kastens, nicht die einer Karte (fieldset: 12px 16px).
  {
    selektor: "#scope-box",
    deklarationen: ["margin: 0 0 8px", "padding: 6px 8px"],
    nutzer: 'id="scope-box"',
  },
  // Die Vorschau-Karte ebenso (section: 12px / 12px).
  {
    selektor: "#preview",
    deklarationen: ["padding: 10px", "margin-top: 8px"],
    nutzer: 'id="preview"',
  },
  // Die Quellenzeile ist eine Fusszeile, kein Absatz.
  {
    selektor: ".source-line",
    deklarationen: ["font-size: 11px", "color: var(--muted)"],
    nutzer: "source-line",
  },
  // Überschriften, die nur für Screenreader zählen: sie kosten keine Zeile Fläche.
  {
    selektor: ".sr-only",
    deklarationen: ["position: absolute", "clip-path: inset(50%)"],
    nutzer: "sr-only",
  },
];

describe("JOB 3606 · Lieferung 4 — die Kompaktregeln der gemessenen Rettungsfassung sind da", () => {
  for (const { selektor, deklarationen, nutzer } of KOMPAKT) {
    it(`${selektor} trägt die gemessenen Werte und hat einen Nutzer in panel.html`, () => {
      const block = regel(selektor);
      for (const deklaration of deklarationen) {
        expect(block, `${selektor} ohne „${deklaration}"`).toContain(deklaration);
      }
      expect(PANEL_HTML, `${selektor}: keine Stelle in panel.html nutzt „${nutzer}"`).toContain(
        nutzer,
      );
    });
  }

  it("für die Höhe des Inhaltsfeldes gibt es genau eine Wahrheit", () => {
    // `.content` und `#content` sind dasselbe Element (`panel.html`: class UND id). Stünde die alte
    // Pixelgrenze noch in `.content`, wäre sie zwar von `#content` überstimmt — aber wer die Datei
    // liest, fände zwei Antworten auf dieselbe Frage. Der Kopfkommentar von `panel.css` nennt genau
    // das die „zweite Wahrheit", die JOB 3278 abgeschafft hat.
    const hoehen = [...PANEL_CSS.matchAll(/max-height:\s*([^;\n]+)/g)].map((t) => t[1]?.trim());
    expect(hoehen, "mehr als eine Höhengrenze in panel.css").toEqual(["26vh"]);
    expect(PANEL_CSS).not.toContain("460px");
  });

  it("jede sr-only-Überschrift der Leiste ist im Stylesheet gedeckt", () => {
    // Ein `class="sr-only"` ohne Regel wäre nicht „unsichtbar", sondern eine ganz normale, sichtbare
    // Überschrift — die Fläche wüchse still um drei Zeilen. Deshalb: es gibt Nutzer, und es gibt die
    // Regel (oben geprüft).
    const nutzer = [...PANEL_HTML.matchAll(/class="sr-only"/g)].length;
    expect(nutzer, "keine sr-only-Überschrift mehr — dann ist die Regel Vorrat").toBeGreaterThan(0);
    // Und sie stehen an Überschriften, nicht an Inhalt: eine sr-only-Warnung wäre eine verschwiegene.
    for (const treffer of PANEL_HTML.matchAll(/<(\w+)[^>]*class="sr-only"/g)) {
      expect(["h2", "h3"], `sr-only an <${treffer[1]}>`).toContain(treffer[1]);
    }
  });
});
