// ================================================================================================
// JOB 2442 · D1 — WER EINE DARSTELLUNG HAT, MUSS DURCHS SANITIZING KOMMEN.
// ================================================================================================
//
// HERKUNFT: JOB 2427 hat festgehalten, dass eine Scroll-Hülle beim Sanitizing ihre Klasse verliert,
// weil `ALLOWED_DIV_CLASSES` sie nicht führt — und dass eine AUFNAHME in diese Liste auffallen
// muss, weil sie eine Sicherheitsgrenze für fremden Inhalt verschiebt.
//
// DIESE DATEI SICHERT DIE GEGENRICHTUNG, und die war bisher unbewacht: Was passiert, wenn eine
// Klasse aus der Liste FÄLLT, die eine Darstellung hat? Dann bleibt ihre CSS-Regel stehen und
// greift ins Leere. Der Sanitizer wirft die Klasse weg, das Stilblatt findet nichts mehr, und der
// Block wird als nackter Kasten gerendert. Kein Test schlägt an — sichtbar wird es erst an einer
// Wissensseite, an der ein Warnblock plötzlich wie Fließtext aussieht.
//
// DIE KOPPLUNG, die hier entsteht: Die Klassenliste wird NICHT abgeschrieben, sondern aus der
// echten `index.css` erhoben — jede Klasse, für die es im Lesepfad eine Regel gibt, muss den
// echten Sanitizer überleben. Kommt eine Regel hinzu, ohne dass die Klasse erlaubt wird, fällt es
// hier auf; fällt eine Klasse aus der Liste, während ihre Regel bleibt, ebenso.
//
// DER ZWEITE TEIL sichert eine Drift, die keiner der beiden Orte allein bemerken kann: Dieselbe
// Liste steht ZWEIMAL im Bestand — clientseitig in `apps/web/src/lib/richText.ts:109` und
// serverseitig in `services/structure/src/sanitize.ts:112`. Beide sanitisieren denselben Body auf
// verschiedenen Wegen (Editor/Anzeige bzw. Import/Server). Laufen sie auseinander, hängt die
// Darstellung davon ab, welchen Weg ein Inhalt genommen hat.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasBodyBlocks } from "../../apps/web/src/lib/bodyReadMode";
import { sanitizeHtml as sanitizeClient } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as sanitizeServer } from "../../services/structure/src/sanitize";

// Relativ zur Testdatei aufgelöst, nicht über `process.cwd()`: Der Pfad muss auch dann stimmen,
// wenn vitest von ausserhalb der Klonwurzel mit `--root` gestartet wird (Zwischenschritt nach E-06).
const CSS_PFAD = fileURLToPath(new URL("../../apps/web/src/index.css", import.meta.url));

/**
 * Erhebt aus der echten `index.css` jede Klasse, die im Lesepfad (`.prose-kw`) eine eigene Regel
 * hat. Aus der Produktdatei gelesen, nicht abgeschrieben — sonst prüfte die Datei ihre eigene
 * Abschrift.
 */
function klassenMitDarstellung(): string[] {
  const css = readFileSync(CSS_PFAD, "utf8");
  const treffer = new Set<string>();
  const re = /\.prose-kw\s+\.([a-z][\w-]*)/gi;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    if (m[1]) {
      treffer.add(m[1]);
    }
  }
  return [...treffer].sort();
}

/** Überlebt die Klasse den Sanitizer? Geprüft am Ergebnis, nicht an einer Liste. */
function ueberlebt(sanitize: (s: string) => string, klasse: string): boolean {
  const raus = sanitize(`<div class="${klasse}"><p>Inhalt</p></div>`);
  return new RegExp(`class="[^"]*\\b${klasse}\\b`).test(raus);
}

describe("A · jede Klasse mit Darstellung im Lesepfad überlebt das Sanitizing", () => {
  it("die Erhebung findet überhaupt Klassen — sonst sagt der Rest nichts", () => {
    const klassen = klassenMitDarstellung();
    expect(
      klassen.length,
      "keine `.prose-kw .klasse`-Regel gefunden — Erhebung kaputt?",
    ).toBeGreaterThan(3);
  });

  it("DIE KOPPLUNG: was `index.css` gestaltet, lässt `richText.ts` durch", () => {
    // Der Fall, der rot wird, wenn eine gebrauchte Klasse aus ALLOWED_DIV_CLASSES fällt.
    const ohneDurchlass = klassenMitDarstellung().filter((k) => !ueberlebt(sanitizeClient, k));

    expect(
      ohneDurchlass,
      "diese Klassen haben eine CSS-Regel im Lesepfad, überleben den Sanitizer aber nicht — " +
        "ihre Darstellung greift ins Leere",
    ).toEqual([]);
  });

  it("dasselbe für den SERVER-Sanitizer — derselbe Body nimmt beide Wege", () => {
    const ohneDurchlass = klassenMitDarstellung().filter((k) => !ueberlebt(sanitizeServer, k));

    expect(ohneDurchlass).toEqual([]);
  });
});

describe("B · Client- und Server-Sanitizer lassen dasselbe durch", () => {
  it("keine Drift: für jede gestaltete Klasse entscheiden beide gleich", () => {
    // Die Liste steht zweimal im Bestand (richText.ts:109, structure/sanitize.ts:112). Läuft sie
    // auseinander, hängt die Darstellung vom Weg ab, den ein Inhalt genommen hat — Import über den
    // Server oder Eingabe im Editor.
    for (const klasse of klassenMitDarstellung()) {
      expect(ueberlebt(sanitizeServer, klasse), `„${klasse}" · Server`).toBe(
        ueberlebt(sanitizeClient, klasse),
      );
    }
  });

  it("und beide werfen dieselbe fremde Klasse weg", () => {
    // Die Gegenprobe auf die Probe: Ohne sie wäre „beide entscheiden gleich" auch dann erfüllt,
    // wenn beide alles durchliessen.
    expect(ueberlebt(sanitizeClient, "voellig-fremd")).toBe(false);
    expect(ueberlebt(sanitizeServer, "voellig-fremd")).toBe(false);
  });
});

describe("C · der Blöcke-Chip erkennt die Panel-Typen, die er erkennen soll", () => {
  it("die fünf Panel-Klassen lösen den Chip aus", () => {
    // `KoRead.tsx:62` zeigt den Chip über `bodyReadMode(...).hasBlocks`. Bricht diese Erkennung,
    // verschwindet die Orientierung im Lesekopf, ohne dass der Body sich ändert.
    for (const klasse of ["panel", "panel-info", "panel-note", "panel-warning", "panel-success"]) {
      expect(hasBodyBlocks(`<div class="${klasse}"><p>Text</p></div>`), klasse).toBe(true);
    }
  });

  it("Fließtext ohne Block löst ihn NICHT aus", () => {
    expect(hasBodyBlocks("<p>Nur Text.</p>")).toBe(false);
    // Und ein blosser Wortlaut im Text ist kein Block (der Kommentar in bodyReadMode.ts:15 nennt
    // genau diesen Fall: „nicht beliebigen Text wie ‚Panel im Auto‘").
    expect(hasBodyBlocks("<p>Das Panel im Auto klemmt.</p>")).toBe(false);
  });
});
