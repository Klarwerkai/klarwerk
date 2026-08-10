// @vitest-environment jsdom
// AUFTRAG-huelle Block A — EINE TABELLE IST KEINE HÜLLE.
//
// DER BEFUND (ben in sammel92, der letzte Ship-Blocker). Der Behälter-Zweig in `einheitenVon`
// (`editorFigures.ts`) leitete die Durchlässigkeit einer Hülle aus ZWEI Eigenschaften ab: das
// Element trägt kein einziges Attribut, und seine Einheiten sind ausschließlich Bild, Fußnote oder
// figure. Diese zwei Bedingungen beweisen NICHT, dass die Hülle bedeutungslos ist. Eine attributlose
// Tabelle mit einem Bild in einer Zelle erfüllt beide auf JEDER Ebene (table → tbody → tr → td) und
// wurde rekursiv bis auf das Bild abgeräumt — die ganze Tabelle verschwand. Dasselbe galt für eine
// attributlose Liste und einen attributlosen Zitatblock.
//
// DER BELEG LAG IM EIGENEN VERTRAG: `richText.ts` führt `table`, `ul`, `li`, `blockquote` und die
// übrigen Struktur-Tags ausdrücklich als erhaltenswerte Struktur („Tabellen aus Import/Paste
// ERHALTEN"). Und der bestehende Test wich der Kante aus: `TABELLE_ZWISCHEN_BILDERN` trug
// `class="kw-tabelle"` — genau dieses Attribut verhinderte die fehlerhafte Auflösung.
//
// EINE PRÄZISIERUNG ZU BENS BEFUND, am Quelltext nachgemessen und für die Bühnen entscheidend: der
// Schaden trat NICHT bei jeder figure mit Tabelle auf. `flacheFigurenHtml` läuft nur für eine
// NICHT-FLACHE figure (`istFlacheFigur`: höchstens ein Bild und keine innere figure). Bens
// Minimalbeispiel — eine figure mit genau einem Bild in einer Tabelle — gilt als flach und wurde gar
// nicht umgebaut; die Tabelle überlebte dort zufällig. Der Schaden brauchte ein ZWEITES Bild (oder
// eine innere figure) in derselben figure. Genau so sind die Bühnen hier gebaut: jede trägt ein
// direktes Bild NEBEN der Struktur, damit der Umbau wirklich läuft. Eine Bühne mit nur einem Bild
// hätte grün gemessen, ohne die Kante je zu berühren.
//
// WAS HIER GEMESSEN WIRD:
//   · JE STRUKTUR-TAG DES VERTRAGS: die Struktur steht nach der Normalisierung unverändert da, das
//     Bild in ihr hat seinen Anker, und ein zweiter Durchlauf ändert nichts mehr (Fixpunkt).
//   · Die Grundmenge wird AUTORITATIV aus `RICH_TEXT_ALLOWED_TAGS` erhoben, nicht hier aufgezählt.
//     Kommt ein Tag in die Allowlist, ohne dass jemand hier eine Bühne dafür baut, wird dieser Test
//     ROT — er lässt sich nicht dadurch umgehen, dass man ihn übersieht.
//   · UND DIE GRENZE IN DIE ANDERE RICHTUNG: das nackte `<p><img></p>` aus Word-Markup wird
//     weiterhin aufgelöst. Eine Grenze, die nur eine Richtung misst, ist keine Grenze.
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  captionForImage,
  ensureImageAnchors,
} from "../../apps/web/src/lib/editorFigures";
import { FLAT_BODY_TAGS, RICH_TEXT_ALLOWED_TAGS } from "../../apps/web/src/lib/richText";

interface ElementLike extends EditableElement {
  innerHTML: string;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
interface DocumentLike {
  createElement(tag: string): ElementLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

function wurzelMit(html: string): ElementLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";

/** Trägt dieses Bild einen vollständigen Anker (figure + Fußnote mit derselben Kennung)? */
function verankert(img: ElementLike): boolean {
  const figure = img.closest("figure");
  const cap = figure?.querySelector(":scope > figcaption") ?? null;
  const id = img.getAttribute("data-image-id");
  return cap !== null && id !== null && id !== "" && cap.getAttribute("data-image-id") === id;
}

// ── Die Grundmenge: autoritativ aus dem Tag-Vertrag, nicht hier aufgezählt ─────────────────────────
//
// Aus `RICH_TEXT_ALLOWED_TAGS` fallen genau zwei Gruppen heraus, und beide aus einem Grund, der im
// Produktcode steht:
//   · `FLAT_BODY_TAGS` (`p`, `br`) — der Vertrag selbst erklärt sie für strukturlos. Das IST die
//     auflösbare Menge; sie darf hier nicht als erhaltenswert gemessen werden.
//   · `img`, `figure`, `figcaption` — sie sind in `einheitenVon` keine Behälter, sondern eigene
//     Einheiten mit eigener Behandlung. Der Behälter-Zweig sieht sie nie.
const EIGENE_EINHEITEN: ReadonlySet<string> = new Set(["img", "figure", "figcaption"]);
const STRUKTUR_TAGS: readonly string[] = Array.from(RICH_TEXT_ALLOWED_TAGS)
  .filter((tag) => !FLAT_BODY_TAGS.has(tag) && !EIGENE_EINHEITEN.has(tag))
  .sort();

// Die Bühnen, und jede einzelne Entscheidung daran ist nötig, damit die Kante wirklich berührt wird.
// Beim ersten Anlauf war dieser Test in 18 von 19 Fällen GRÜN, obwohl der Fehler noch drin war —
// weil in jeder Zelle ein Wort Text stand. Das ist derselbe Selbstschutz wie das `class="kw-tabelle"`
// im alten Test, nur unauffälliger, und er ist hier ausgeräumt:
//   · EIN DIREKTES BILD NEBEN DER STRUKTUR. Sonst gälte die figure als flach (`istFlacheFigur`:
//     höchstens ein Bild) und `flacheFigurenHtml` liefe nie — der fehlerhafte Zweig würde gar nicht
//     erreicht.
//   · KEIN TEXT UND KEIN FREMDES ELEMENT IN DER STRUKTUR. Beides macht eine Einheit `roh` und damit
//     `nurBildhaft` falsch — die Hülle bliebe schon vor dem Fix erhalten, aus dem falschen Grund.
//   · KEIN EINZIGES ATTRIBUT, auf keiner Ebene. Genau das ist die Kante.
// Ein Eintrag deckt mehrere Tags ab, wo das Markup sie ohnehin zusammen verlangt (eine Tabellenzeile
// gibt es nicht ohne Tabelle) — die Rekursion steigt durch jede Ebene und misst damit jede.
const TABELLE = `<table><tbody><tr><td><img src="${B}"></td></tr></tbody></table>`;
const KOPFTABELLE = `<table><thead><tr><th><img src="${B}"></th></tr></thead></table>`;
const LISTE = `<ul><li><img src="${B}"></li></ul>`;

// Die Struktur JE TAG, roh — damit dieselbe Bühne in beiden Reihenfolgen gebaut werden kann.
const STRUKTUR: Readonly<Record<string, string>> = {
  table: TABELLE,
  tbody: TABELLE,
  tr: TABELLE,
  td: TABELLE,
  thead: KOPFTABELLE,
  th: KOPFTABELLE,
  tfoot: `<table><tfoot><tr><td><img src="${B}"></td></tr></tfoot></table>`,
  // Eine `caption` gibt es nur in einer Tabelle, und sie muss das Bild SELBST tragen: stünde das Bild
  // in einer Zelle daneben, wäre die leere caption eine `roh`-Einheit und schützte die Tabelle schon
  // vor dem Fix — die Kante bliebe unberührt.
  caption: `<table><caption><img src="${B}"></caption></table>`,
  ul: LISTE,
  li: LISTE,
  ol: `<ol><li><img src="${B}"></li></ol>`,
  blockquote: `<blockquote><img src="${B}"></blockquote>`,
  div: `<div><img src="${B}"></div>`,
  a: `<a><img src="${B}"></a>`,
  strong: `<strong><img src="${B}"></strong>`,
  em: `<em><img src="${B}"></em>`,
  u: `<u><img src="${B}"></u>`,
  h2: `<h2><img src="${B}"></h2>`,
  h3: `<h3><img src="${B}"></h3>`,
};

function buehne(struktur: string): string {
  return `<figure><img src="${A}">${struktur}<figcaption>Beschreibung A</figcaption></figure>`;
}

const BUEHNE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STRUKTUR).map(([tag, struktur]) => [tag, buehne(struktur)]),
);

// ── AUFTRAG-huelle2 Block B — UND JETZT DIE ANDERE RICHTUNG ───────────────────────────────────────
//
// DIESE BÜHNEN HABEN NUR EINE RICHTUNG GEPRÜFT, UND DAS WAR DER FEHLER DIESER RUNDE. `buehne` setzt
// das direkte Bild A AUSNAHMSLOS VOR die Struktur mit Bild B. In dieser Richtung geht die
// unmarkierte Fußnote ohnehin an A — ob die Paarung die Bilder in der Struktur überhaupt SIEHT,
// kann hier gar nicht auffallen. Genau deshalb blieb der Zuordnungsfehler aus sammel96 unsichtbar:
// `paare()` sammelte nur direkte Bilder, und die Bühne vermied die einzige Lage, in der das zählt.
//
// Eine Bühne, die nur die günstige Richtung baut, gilt als nicht gebaut. Jede Struktur steht
// deshalb jetzt AUCH VOR dem direkten Bild: dann muss die Fußnote an das Bild IN der Struktur
// gehen, weil es in Dokumentreihenfolge das erste ist.
const TEXT_STRUKTUR = "Beschreibung für das Bild in der Struktur";

function buehneRueck(struktur: string): string {
  return `<figure>${struktur}<img src="${A}"><figcaption>${TEXT_STRUKTUR}</figcaption></figure>`;
}

const BUEHNE_RUECK: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STRUKTUR).map(([tag, struktur]) => [tag, buehneRueck(struktur)]),
);

// ── Die Zusicherungen ─────────────────────────────────────────────────────────────────────────────

describe("AUFTRAG-huelle Block A: die Grundmenge kommt aus dem Tag-Vertrag", () => {
  it("jedes Struktur-Tag der Allowlist hat eine Bühne — ein neues Tag kann nicht ungemessen bleiben", () => {
    const ohneBuehne = STRUKTUR_TAGS.filter((tag) => BUEHNE[tag] === undefined);
    expect(
      ohneBuehne,
      "Ein Tag steht in RICH_TEXT_ALLOWED_TAGS, wird hier aber nicht gemessen — die Grenze ist für dieses Tag unbelegt",
    ).toEqual([]);
    // Und andersherum: keine Bühne für ein Tag, das der Vertrag gar nicht kennt (sonst misst dieser
    // Test etwas, das es im Produkt nicht gibt).
    const ohneVertrag = Object.keys(BUEHNE).filter((tag) => !STRUKTUR_TAGS.includes(tag));
    expect(ohneVertrag, "Eine Bühne misst ein Tag, das nicht im Tag-Vertrag steht").toEqual([]);
    expect(STRUKTUR_TAGS.length, "Die Grundmenge ist leer — der Test misst nichts").toBeGreaterThan(
      0,
    );
  });
});

describe("AUFTRAG-huelle Block A: attributlose Struktur überlebt den Umbau", () => {
  for (const tag of STRUKTUR_TAGS) {
    const html = BUEHNE[tag] ?? "";

    it(`<${tag}> ohne jedes Attribut bleibt stehen, und sein Bild bekommt einen Anker`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);

      const treffer = Array.from(root.querySelectorAll(tag));
      expect(
        treffer.length,
        `Das attributlose <${tag}> wurde als bedeutungslose Hülle aufgelöst — die Struktur, die jemand gemacht hat, ist weg`,
      ).toBe(1);
      const struktur = treffer[0];
      expect(
        Array.from(struktur?.querySelectorAll(`img[src="${B}"]`) ?? []).length,
        `Das Bild wurde aus dem <${tag}> herausgerissen, statt an Ort und Stelle verankert zu werden`,
      ).toBe(1);

      const bilder = Array.from(root.querySelectorAll("img"));
      expect(bilder.length, "Ein Bild ist beim Umbau verloren gegangen").toBe(2);
      for (const img of bilder) {
        expect(
          verankert(img),
          `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker — der Nutzer klickt auf die Bildbeschreibung, und es passiert nichts`,
        ).toBe(true);
      }
    });

    it(`<${tag}>: ein zweiter Lauf ändert nichts mehr (Fixpunkt)`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      const einmal = root.innerHTML;
      const nochmal = ensureImageAnchors(root);
      expect(
        root.innerHTML,
        `Der zweite Lauf hat den Inhalt um <${tag}> erneut verändert — bei jedem Öffnen des Entwurfs verschiebt sich etwas`,
      ).toBe(einmal);
      expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
    });
  }
});

describe("AUFTRAG-huelle2 Block B: die Struktur steht VOR dem direkten Bild", () => {
  for (const tag of STRUKTUR_TAGS) {
    const html = BUEHNE_RUECK[tag] ?? "";

    it(`<${tag}> vor dem direkten Bild: die Fußnote gehört dem Bild IN der Struktur`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);

      // Der Strukturgewinn gilt unverändert — sonst wäre die Zuordnung mit einer zerstörten
      // Struktur erkauft, und die Probe belegte den falschen Handel.
      expect(
        Array.from(root.querySelectorAll(tag)).length,
        `Das attributlose <${tag}> wurde aufgelöst, um die Zuordnung hinzubekommen — die Struktur, die jemand gemacht hat, ist weg`,
      ).toBe(1);
      expect(
        Array.from(root.querySelectorAll(`${tag} img[src="${B}"]`)).length,
        `Das Bild wurde aus dem <${tag}> herausgerissen, statt die Fußnote zu ihm zu bewegen`,
      ).toBe(1);

      const bilder = Array.from(root.querySelectorAll("img"));
      expect(
        bilder.map(
          (img) =>
            `${img.getAttribute("src")}|${(captionForImage(img, root)?.textContent ?? "").trim()}`,
        ),
        `Die Beschriftung ist zum falschen Bild gewandert: Bild B steht in <${tag}> VOR dem direkten Bild A und muss die unmarkierte Fußnote bekommen. Steht sie bei A, liest der Nutzer die Beschreibung unter dem falschen Bild — und nichts im Dokument sagt ihm das.`,
      ).toEqual([`${B}|${TEXT_STRUKTUR}`, `${A}|`]);

      for (const img of bilder) {
        expect(
          verankert(img),
          `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker — der Nutzer klickt auf die Bildbeschreibung, und es passiert nichts`,
        ).toBe(true);
      }
      // Der Text ist VERSCHOBEN, nicht kopiert, und keine Kennung steht doppelt.
      const mitText = Array.from(root.querySelectorAll("figcaption")).filter(
        (cap) => (cap.textContent ?? "").trim() === TEXT_STRUKTUR,
      );
      expect(mitText.length, "Der Beschreibungstext steht doppelt oder ist verloren").toBe(1);
      const kennungen = Array.from(root.querySelectorAll("figcaption[data-image-id]")).map((cap) =>
        cap.getAttribute("data-image-id"),
      );
      expect(new Set(kennungen).size, "Zwei Fußnoten tragen dieselbe data-image-id").toBe(
        kennungen.length,
      );
    });

    it(`<${tag}> vor dem direkten Bild: ein zweiter Lauf ändert nichts mehr (Fixpunkt)`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      const einmal = root.innerHTML;
      const nochmal = ensureImageAnchors(root);
      expect(
        root.innerHTML,
        `Der zweite Lauf hat den Inhalt um <${tag}> erneut verändert — bei jedem Öffnen des Entwurfs verschiebt sich etwas`,
      ).toBe(einmal);
      expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
    });
  }
});

describe("AUFTRAG-huelle Block A: die Grenze misst auch die andere Richtung", () => {
  it("das nackte <p><img></p> aus Word-Markup wird weiterhin aufgelöst", () => {
    const root = wurzelMit(
      `<figure><p><img src="${A}"></p><p><img src="${B}"></p><figcaption>Beschreibung A</figcaption></figure>`,
    );
    ensureImageAnchors(root);
    expect(
      Array.from(root.querySelectorAll("p")).length,
      "Die durchlässige Hülle wird nicht mehr aufgelöst — die vorhandene Fußnote fände ihr Bild nicht mehr",
    ).toBe(0);
    const figuren = Array.from(root.querySelectorAll("figure"));
    expect(figuren.length, "Es ist nicht je eine flache figure je Bild entstanden").toBe(2);
    expect(
      (figuren[0]?.querySelector(":scope > figcaption")?.textContent ?? "").trim(),
      "Die vorhandene Beschreibung hat ihr Bild verloren",
    ).toBe("Beschreibung A");
  });

  it("`p` ist die auflösbare Menge — und sie steht nicht als zweite Liste daneben", () => {
    // Kein Namenstest: gemessen wird, dass genau die Tags, die der Vertrag für strukturlos erklärt,
    // auch am VERHALTEN als durchlässig erscheinen. `br` ist ein Void-Tag und kann nie ein Bild
    // umschließen — der Behälter-Zweig sieht es nie, deshalb ist es hier nicht messbar.
    const auflösbar = Array.from(FLAT_BODY_TAGS).filter((tag) => tag !== "br");
    expect(auflösbar, "Die flache Menge des Vertrags hat sich geändert").toEqual(["p"]);
    for (const tag of auflösbar) {
      const root = wurzelMit(
        `<figure><${tag}><img src="${A}"></${tag}><${tag}><img src="${B}"></${tag}><figcaption>x</figcaption></figure>`,
      );
      ensureImageAnchors(root);
      expect(
        Array.from(root.querySelectorAll(tag)).length,
        `<${tag}> gilt im Vertrag als strukturlos, wird aber erhalten — Bild und Fußnote finden einander dadurch nicht`,
      ).toBe(0);
    }
  });
});
