import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// AUFTRAG-PRO-337 — DER SAMMLER FÜR DEN GALERIEEINSTIEG.
//
// DER BEFUND, den dieser Auftrag geschlossen hat: `apps/web/src/pages/Capture.tsx` band die
// Bildergalerie an ZWEI Stellen ein (`:5283`, `:5519` vor der Korrektur) und übergab beide Male
// KEIN `onEditCaption`. Der Prop ist optional — also erschien in der Großansicht schlicht kein
// Knopf „Bildbeschreibung bearbeiten". Kein Fehler, keine Konsole, nichts. Der Editorweg (Klick auf
// die Beschreibung) trug dort, der Galerieeinstieg fehlte lautlos.
//
// Das ist DIESELBE KLASSE wie mega50 (`onDescribeImage` auf zwei von vier Flächen vergessen) und
// wie bens sammel45-Befund (`FacetFilter` ohne `backgroundRef`). Dreimal derselbe Mechanismus:
// ein optionaler Vertrag, den man vergessen kann, wird vergessen — und der Ausfall ist stumm.
//
// Nach der Regel dieses Projekts bekommt die KLASSE einen Wächter, nicht der einzelne Fall eine
// Korrektur. Genau das ist diese Datei.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM: erhoben wird aus dem QUELLBAUM, nicht aus einer Liste der heutigen Flächen. Eine
// vierte Fläche morgen ist ohne Zutun Gegenstand dieser Datei.
//
//   (1) DIE GALERIE-BAUTEILE sind `BodyImageGallery` (die Galerie selbst) und `DraftBodyGallery`
//       (ihr entprellter Mantel für den Entwurf). Beide werden aus ihren Definitionsdateien
//       gelesen, nicht als Zeichenfolge geraten — verschwindet oder wandert eines, wird das hier
//       rot statt still wahr zu bleiben.
//   (2) DIE AUFRUFER sind alle Quelldateien, die eines dieser Bauteile im JSX EINBINDEN.
//
// WAS VERLANGT WIRD: jeder Aufrufer reicht `onEditCaption` herein. Anders als beim describe-Weg
// kann die Galerie sich den Weg NICHT selbst holen — sie steht als Blatt neben dem Editor, und die
// Bitte muss an genau DEN Editor gehen, der auf derselben Fläche montiert ist. Ein Kontext müsste
// über beiden sitzen und wäre wieder ein Vertrag, den die Fläche stiften muss. Deshalb bleibt die
// Übergabe beim Aufrufer — und deshalb braucht sie diesen Wächter.
//
// Eine Fläche, die den Weg fachlich NICHT anbieten soll (reine Leseansicht ohne Editierrecht),
// trägt die Ausnahme SICHTBAR im Code als `KEIN-GALERIEEINSTIEG:` mit Begründung — dasselbe Muster
// wie `KEINE-BILDBESCHREIBUNG:` in mega50. Sie wird nicht durch Weglassen erreicht.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG — verschwiegen würde sie zur Falle:
//
//  1. ALIAS UND `createElement` GREIFEN. Gesehen wird nur, was im JSX beim Namen genannt wird. Die
//     gemounteten Tests binden über `createElement` ein; der Produktbaum tut das heute nirgends.
//  2. SPREAD GREIFT. Käme `onEditCaption` über `{...props}` herein, sähe diese Erhebung ihn nicht
//     und würde die Fläche fälschlich als nackt melden — sie wäre dann rot, nicht falsch grün.
//     Die Richtung des Irrtums ist bewusst so gewählt.
//  3. SIE PRÜFT DIE ANWESENHEIT DER VERDRAHTUNG, NICHT IHRE WIRKUNG. Dass die Bitte im Editor
//     wirklich ankommt und dasselbe Formular öffnet, belegt der gemountete Test
//     `tests/capture/pro337-bildbeschreibung-endtoend.test.tsx`; für die Erfassen-Seite zusätzlich
//     `tests/capture/pro337-capture-galerieweg-mounted.test.tsx`. Dieser Sammler ist der Wächter
//     gegen das VERGESSEN, nicht der Beweis der Funktion.

const WEB_SRC = join(process.cwd(), "apps", "web", "src");

const GALERIE_DATEIEN = [
  join(WEB_SRC, "components", "BodyImageGallery.tsx"),
  join(WEB_SRC, "components", "DraftBodyGallery.tsx"),
];

const AUSNAHME_MARKE = "KEIN-GALERIEEINSTIEG:";

function alleQuellen(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) {
      out.push(...alleQuellen(pfad));
    } else if (eintrag.name.endsWith(".tsx")) {
      out.push(pfad);
    }
  }
  return out;
}

/** Die exportierten Komponenten der Galerie-Dateien — gelesen, nicht geraten. */
function galerieBauteile(): string[] {
  const namen = new Set<string>();
  for (const datei of GALERIE_DATEIEN) {
    const quelle = readFileSync(datei, "utf8");
    for (const treffer of quelle.matchAll(/export function ([A-Z][A-Za-z0-9]*)\s*\(/g)) {
      const name = treffer[1];
      if (name) {
        namen.add(name);
      }
    }
  }
  return [...namen];
}

/**
 * Jede JSX-Einbindung eines Bauteils, mit dem vollständigen Attributblock bis zum schließenden
 * `>` beziehungsweise `/>`. Mehrzeilige Einbindungen sind der Normalfall — eine zeilenweise
 * Betrachtung hätte genau den Fund dieses Auftrags übersehen.
 */
function einbindungen(quelle: string, bauteil: string): string[] {
  const funde: string[] = [];
  const muster = new RegExp(`<${bauteil}(\\s|/|>)`, "g");
  for (const treffer of quelle.matchAll(muster)) {
    const start = treffer.index ?? 0;
    let tiefe = 0;
    for (let i = start; i < quelle.length; i += 1) {
      const z = quelle[i];
      if (z === "{") {
        tiefe += 1;
      } else if (z === "}") {
        tiefe -= 1;
      } else if (z === ">" && tiefe === 0) {
        funde.push(quelle.slice(start, i + 1));
        break;
      }
    }
  }
  return funde;
}

interface Fund {
  datei: string;
  bauteil: string;
  verdrahtet: boolean;
  ausgenommen: boolean;
}

function erhebe(): Fund[] {
  const bauteile = galerieBauteile();
  const funde: Fund[] = [];
  for (const datei of alleQuellen(WEB_SRC)) {
    // Die Definitionsdateien selbst sind keine Aufrufer.
    if (GALERIE_DATEIEN.includes(datei)) {
      continue;
    }
    const quelle = readFileSync(datei, "utf8");
    for (const bauteil of bauteile) {
      for (const block of einbindungen(quelle, bauteil)) {
        funde.push({
          datei: datei.split(`apps${sep}web${sep}src${sep}`)[1] ?? datei,
          bauteil,
          verdrahtet: block.includes("onEditCaption"),
          ausgenommen: block.includes(AUSNAHME_MARKE),
        });
      }
    }
  }
  return funde;
}

describe("PRO 337 · der Galerieeinstieg erreicht JEDE Fläche, die eine Bildergalerie einbindet", () => {
  it("die Galerie-Bauteile werden aus ihren Definitionsdateien gelesen — nicht geraten", () => {
    const bauteile = galerieBauteile();
    // Verschwindet oder wandert eines der beiden, wird DAS hier rot, statt dass die Erhebung
    // stillschweigend nichts mehr findet und alles grün meldet.
    expect(bauteile).toContain("BodyImageGallery");
    expect(bauteile).toContain("DraftBodyGallery");
  });

  it("es gibt überhaupt Aufrufer — eine leere Erhebung wäre kein Beleg", () => {
    const funde = erhebe();
    // Der eigentliche Selbstschutz des Sammlers: fände er nichts, wäre die Zusicherung unten
    // trivial erfüllt. Vier Einbindungen sind heute belegt (KoRead, Capture ×2, CaptureFrontDoor).
    expect(funde.length).toBeGreaterThanOrEqual(4);
  });

  it("KEINE Einbindung steht ohne onEditCaption da — außer mit sichtbar begründeter Ausnahme", () => {
    const nackt = erhebe().filter((f) => !f.verdrahtet && !f.ausgenommen);
    const liste = nackt.map((f) => `  · ${f.datei} <${f.bauteil}>`).join("\n");
    expect(
      nackt,
      `Diese Einbindungen der Bildergalerie haben keinen Weg zur Bildbeschreibung. Der Prop ist optional — der Ausfall ist deshalb STUMM (genau der Befund aus PRO 337). Entweder onEditCaption übergeben oder die Ausnahme mit "${AUSNAHME_MARKE} <Grund>" sichtbar begründen:\n${liste}`,
    ).toEqual([]);
  });
});
