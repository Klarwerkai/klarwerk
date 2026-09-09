// ================================================================================================
// JOB 3357 · RUNDE 3 — DIE KLASSENBINDUNG DES VORBEHALTS BLEIBT AUFLÖSBAR.
// ================================================================================================
//
// DER BEFUND, der diesen Test erzwungen hat (Tor R2, `tor.1.err:11027`):
// `tests/app/mega47-modale-flaechen-sammler.test.tsx` zählt die className-Bindungen aller
// erhobenen Flächen und meldet die, in denen ein Bezeichner steht, dessen Wert er nicht kennt.
// Der Zählstand ist auf 219 festgenagelt; Runde 2 machte 220 daraus. Ursache war EIGEN und genau
// eine Stelle in `apps/web/src/components/ImportGroups.tsx`:
//
//     className={cx("mt-1 text-[12px]", vorbehalt.dringend ? "text-trust-warn-text" : "text-muted-2")}
//
// `vorbehalt` entsteht aus einem Ternär über Objektliterale; unter seinem Initialisierer steht
// keine einzige Klassen-Zeichenkette, also bleibt der Bezeichner für den Sammler offen.
//
// DIE AUFLAGE aus JOB 3267 (im Sammler wörtlich hinterlegt) lautet: die Klassen AUFLÖSBAR
// schreiben, nicht den Zählstand hochsetzen. Genau das ist geschehen — der Ton steht jetzt als
// eigener lokaler Wert `vorbehaltTon` mit zwei literalen Zweigen da, und die Bindung heißt
// `cx("mt-1 text-[12px]", vorbehaltTon)`.
//
// WARUM DIESER TEST UND NICHT NUR DER PIN IN mega47: der Pin sagt „219" und nennt beim Bruch die
// Zahl, nicht die Ursache — Runde 2 hat eine ganze Runde gekostet, um von „220 statt 219" zurück
// auf diese eine Zeile zu kommen. Dieser Test misst dieselbe Stelle mit derselben Regel und sagt
// beim Bruch, WELCHE Bindung wieder unauflösbar geworden ist.
//
// KEIN VORBEISCHREIBEN, und dieser Test hält es fest: er verlangt ausdrücklich, dass die Bindung
// weiterhin ein AUSDRUCK ist (`className={…}`), den der Sammler überhaupt einsammelt, und dass
// BEIDE Klassenketten in seinem aufgelösten Teil landen. Wer die Klassen in ein blosses
// `className="…"` oder in ein Attributobjekt schöbe, nähme sie dem Sammler weg — und macht damit
// diesen Test rot, nicht grün.
//
// ARIA/SICHTBARKEIT: hier wird kein DOM gelesen, sondern Quelltext. Die Frage „ist es sichtbar"
// stellt sich in dieser Datei nicht; sie ist Gegenstand der gemounteten Flächentests dieses
// Ordners (`bilanz-zeigt-die-laufkennung.test.tsx` und die anderen), die verborgene Teilbäume
// ausdrücklich NICHT mitlesen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "../..");
const ZIEL = "apps/web/src/components/ImportGroups.tsx";

/** Die Fügernamen, die der Sammler als klassenlos kennt — `cx(…)` trägt selbst keine Klasse. */
const KLASSENFUEGER = new Set(["cx", "cn", "clsx", "classNames", "twMerge", "join"]);

type Bindung = { zeile: number; ausdruck: string; aufgeloest: string[]; offen: string[] };

/** Alle Zeichenketten unter einem Knoten — dieselbe Regel, mit der der Sammler lokale Werte liest. */
function zeichenkettenUnter(n: ts.Node): string[] {
  const gefunden: string[] = [];
  const gehe = (k: ts.Node): void => {
    if (ts.isStringLiteral(k) || k.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      gefunden.push((k as ts.StringLiteral).text);
    } else if (
      k.kind === ts.SyntaxKind.TemplateHead ||
      k.kind === ts.SyntaxKind.TemplateMiddle ||
      k.kind === ts.SyntaxKind.TemplateTail
    ) {
      gefunden.push((k as ts.TemplateHead).text);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(n);
  return gefunden;
}

/**
 * Die className-Bindungen einer Quelle, nach der Regel des Sammlers: literale Teile sind aufgelöst,
 * ein Bezeichner mit literalem Wert IN DERSELBEN DATEI ebenfalls, alles andere bleibt offen.
 *
 * Modulübergreifende Auflösung lässt diese Nachbildung bewusst weg: sie kann die Lage nur
 * PESSIMISTISCHER einschätzen als der Sammler, nie günstiger. Ein „offen: []" hier ist deshalb
 * auch dort eines — die Richtung, auf die es ankommt.
 */
function klassenbindungen(datei: string, quelle: string): Bindung[] {
  const sf = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lokal = new Map<string, string[]>();
  const gehe1 = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      lokal.set(n.name.text, zeichenkettenUnter(n.initializer));
    }
    ts.forEachChild(n, gehe1);
  };
  gehe1(sf);

  const funde: Bindung[] = [];
  const gehe2 = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === "className") {
      const init = n.initializer;
      if (init && ts.isJsxExpression(init) && init.expression) {
        const aufgeloest: string[] = [];
        const offen: string[] = [];
        const gehe = (k: ts.Node): void => {
          if (ts.isStringLiteral(k) || k.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
            aufgeloest.push((k as ts.StringLiteral).text);
            return;
          }
          if (
            k.kind === ts.SyntaxKind.TemplateHead ||
            k.kind === ts.SyntaxKind.TemplateMiddle ||
            k.kind === ts.SyntaxKind.TemplateTail
          ) {
            aufgeloest.push((k as ts.TemplateHead).text);
            return;
          }
          if (ts.isIdentifier(k)) {
            if (KLASSENFUEGER.has(k.text)) {
              return;
            }
            const wert = lokal.get(k.text);
            if (wert !== undefined && wert.length > 0) {
              aufgeloest.push(...wert);
              return;
            }
            offen.push(k.text);
            return;
          }
          ts.forEachChild(k, gehe);
        };
        gehe(init.expression);
        funde.push({
          zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          ausdruck: init.expression.getText(sf).replace(/\s+/g, " ").slice(0, 120),
          aufgeloest,
          offen,
        });
      }
    }
    ts.forEachChild(n, gehe2);
  };
  gehe2(sf);
  return funde;
}

const QUELLE = readFileSync(join(WURZEL, ZIEL), "utf8");
const BINDUNGEN = klassenbindungen(ZIEL, QUELLE);
/** Die eine Bindung, um die es geht: die Kennzeichnung „das ist nicht der aktuelle Stand". */
const VORBEHALT = BINDUNGEN.filter((b) => b.aufgeloest.includes("mt-1 text-[12px]"));

describe("JOB 3357 · die Vorbehalts-Klassen bleiben für den Sammler auflösbar", () => {
  it("K1 · die Bindung ist ein AUSDRUCK und wird eingesammelt — nicht am Sammler vorbeigeschrieben", () => {
    const diagnose = BINDUNGEN.map((b) => `${ZIEL}:${b.zeile} ${b.ausdruck}`).join("\n");
    expect(VORBEHALT.length, `genau eine Vorbehalts-Bindung erwartet:\n${diagnose}`).toBe(1);
  });

  it("K2 · sie ist vollständig aufgelöst, und BEIDE Klassenketten liegen offen", () => {
    const b = VORBEHALT[0];
    expect({
      offen: b?.offen ?? ["BINDUNG FEHLT"],
      dringend: b?.aufgeloest.includes("text-trust-warn-text") ?? false,
      ruhig: b?.aufgeloest.includes("text-muted-2") ?? false,
    }).toEqual({ offen: [], dringend: true, ruhig: true });
  });

  it("K3 · GEGENPROBE: die Bauform der Runde 2 wäre nach derselben Regel WIEDER offen", () => {
    // Ohne diesen Zwilling bewiese K2 nur, dass irgendetwas grün ist. Er zeigt: die Regel hat
    // Zähne, und die verworfene Schreibweise ist wirklich die Ursache der 220 gewesen.
    // Gemessen, nicht gerechnet: OFFEN sind hier ZWEI Bezeichner — `vorbehalt` (Ternär über
    // Objektliterale, kein Klassentext darunter) UND der Eigenschaftsname `dringend`, den der
    // Sammler an einem Zugriff `x.y` ebenfalls als Bezeichner sieht. Das ist der zweite Grund,
    // warum der Ton nicht als Feld im Vorbehalts-Objekt stehen kann, sondern als eigener Wert:
    // ein Zugriff bliebe auch dann offen, wenn das Feld literal wäre. Für den Zählstand macht es
    // keinen Unterschied — EINE offene Bindung ist eine offene Bindung, egal wie viele Namen.
    const alt = [
      "const vorbehalt = a ? { grund: T.stalePaused, dringend: true } : null;",
      'export const F = <p className={cx("mt-1 text-[12px]",',
      '  vorbehalt.dringend ? "text-trust-warn-text" : "text-muted-2")} />;',
    ].join("\n");
    const b = klassenbindungen("apps/web/src/components/SynthAlt.tsx", alt)[0];
    expect({ offen: b?.offen, dringend: b?.aufgeloest.includes("text-trust-warn-text") }).toEqual({
      offen: ["vorbehalt", "dringend"],
      dringend: true,
    });
  });

  it('K4 · GEGENPROBE: ein blosses `className="…"` wäre dem Sammler ganz entzogen', () => {
    // Die zweite verbotene Ausweichform. Sie machte den Zählstand grün, ohne dass der Sammler die
    // Klassen je gesehen hätte — dieser Fall belegt, dass K1 genau darauf schaut.
    const weg = 'export const F = <p className="mt-1 text-[12px] text-muted-2" />;';
    expect(klassenbindungen("apps/web/src/components/SynthWeg.tsx", weg)).toEqual([]);
  });
});
