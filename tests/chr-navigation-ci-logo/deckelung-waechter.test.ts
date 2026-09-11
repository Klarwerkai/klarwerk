// ================================================================================================
// JOB 3582 · W · DER WÄCHTER ÜBER DIE DECKELUNG — NAMENTLICH, UND MIT SICH SELBST GEGENGEPRÜFT.
// ================================================================================================
//
// WAS ER BEWACHT. Die Breite des Firmenlogos im Kopfband hat seit JOB 3582 eine Obergrenze. Sie ist
// der Grund, aus dem der Konto-Kreis bei 390 px wieder im Fenster steht. Fiele sie weg — beim
// nächsten Umbau von `Logo.tsx`, beim nächsten Firmenprofil —, käme der Befund von JOB 3571 zurück.
//
// WAS ER AUSDRÜCKLICH NICHT TUT: zählen. Die Lehren JOB 3564 R2, 3565 R1, 3570 R1 und 3579 haben
// dieselbe Krankheit viermal beschrieben — ein Wächter, der „es gibt N Vorkommen" misst, ist am Tag
// seiner Entstehung richtig und danach beliebig. Hier wird NAMENTLICH geprüft: die zwei benannten
// Stufen (`LOGO_MAX_BREITE_PX` für die schmale, `LOGO_MAX_BREITE_BREIT_PX` für die breite Zeile),
// jede an ihrem Ort (im `style`-Ausdruck INNERHALB des Logokastens), und die zwei Breitenzusagen,
// die sagen, wo welche gilt.
//
// WARUM DAS NICHT DURCH EINEN KOMMENTAR ODER EINE ZEICHENKETTE ZU ERFÜLLEN IST, steht im Kopf von
// `deckelung-quelle.ts` — und wird hier nicht geglaubt, sondern GEMESSEN: W2 und W3 füttern den
// Prüfer mit genau solchen Quelltexten und verlangen, dass er rot bleibt. Das ist die Gegenprobe L8
// des Auftrags, als Testfall statt als Behauptung in einer Rückgabe.
//
// DIE ZWEITE HÄLFTE DER ZUSAGE — dass der Browser die Zahl WIRKLICH durchsetzt — steht bewusst
// nicht hier, sondern in `logokasten-chromium.test.ts` (Fall L6). Ein Wächter über den
// Quelltext kann sagen, dass eine Regel dasteht; ob sie wirkt, sagt nur die Messung am gebauten
// Produkt. Beide Hälften lesen dieselbe Zahl aus derselben Quelle.
import { describe, expect, it } from "vitest";
import {
  BREITE_ZEILE_NAME,
  DECKELUNG_BREIT_NAME,
  DECKELUNG_NAME,
  LOGO_TESTID,
  SPANNE_NAME,
  liesDeckelung,
  pruefeQuelle,
} from "./deckelung-quelle";

/** Der `style`-Ausdruck der echten Form: die zwei Stufen, gewählt von der Breitenzusage. */
const ECHTER_STIL = `style={{ maxWidth: \`\${breiteZeile ? ${DECKELUNG_BREIT_NAME} : ${DECKELUNG_NAME}}px\` }}`;

/**
 * Ein Quelltext in der Bauform von `Logo.tsx` — die vier Regeln werden je Fall anders eingesetzt.
 *
 * Er ist absichtlich kurz und trägt trotzdem alles, woran die Prüfung hängt: den Logokasten mit
 * seiner Kennung, ein Bild darin und die zwei Breitenzusagen. Ein Nachbau der ganzen Datei wäre eine
 * zweite Wahrheit über `Logo.tsx`; ein Nachbau der geprüften FORM ist eine Kalibrierung.
 *
 * `spanne` und `breiteZeile` sind vorbelegt, damit die Fälle W2–W4 AUSSCHLIESSLICH an der
 * Obergrenze scheitern — ein Fall, der aus zwei Gründen zugleich rot ist, belegt keinen von beiden.
 */
function bauQuelle(teile: {
  vorspann: string;
  bild: string;
  spanne?: string;
  breiteZeile?: string;
}): string {
  const spanne =
    teile.spanne ?? `const ${SPANNE_NAME} = "(min-width: 900px) and (max-width: 999px)";`;
  const breiteZeile = teile.breiteZeile ?? `const ${BREITE_ZEILE_NAME} = "(min-width: 1280px)";`;
  return `import { GuardedLink } from "../app/NavGuardContext";
import { useMediaQuery } from "./useMediaQuery";
${spanne}
${breiteZeile}
${teile.vorspann}
export function Logo(): JSX.Element {
  const ohnePlatz = useMediaQuery(${SPANNE_NAME});
  const breiteZeile = useMediaQuery(${BREITE_ZEILE_NAME});
  return (
    <GuardedLink to="/start" className="kw-kopfband-marke shrink-0">
      KLARWERK
      {ohnePlatz ? null : (
        <span data-testid="${LOGO_TESTID}" className="ml-2.5 inline-grid h-7">
          ${teile.bild}
        </span>
      )}
    </GuardedLink>
  );
}
`;
}

/** Die zwei Stufen, wie das Produkt sie trägt — Vorspann für jeden Fall, der sie nicht verstellt. */
const ECHTER_VORSPANN = `const ${DECKELUNG_NAME} = 44;\nconst ${DECKELUNG_BREIT_NAME} = 132;`;

const ECHTE_FORM = bauQuelle({
  vorspann: ECHTER_VORSPANN,
  bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" ${ECHTER_STIL} />`,
});

describe("JOB 3582 · W · die Deckelung des Logokastens steht als Code an ihrer Stelle", () => {
  it("W1 · im Produkt: zwei benannte Stufen, beide im `style` des Logokastens verwendet", () => {
    const d = liesDeckelung();
    expect(
      d.fehler,
      `die Deckelung des Logokastens fehlt oder wirkt nicht:\n  ${d.fehler.join("\n  ")}`,
    ).toEqual([]);
    expect(d.wert, "die schmale Obergrenze ist keine Zahl").not.toBeNull();
    expect(d.wertBreit, "die breite Obergrenze ist keine Zahl").not.toBeNull();
    expect(d.spanne, "die Breitenspanne ohne Logokasten fehlt").not.toBeNull();
    expect(d.breiteZeile, "die Breitenzusage der breiten Zeile fehlt").not.toBeNull();
    console.log(
      `JOB 3582 · W1 · ${DECKELUNG_NAME} = ${String(d.wert)} px · ${DECKELUNG_BREIT_NAME} = ${String(d.wertBreit)} px · ` +
        `${SPANNE_NAME} = „${String(d.spanne)}“ · ${BREITE_ZEILE_NAME} = „${String(d.breiteZeile)}“ (gelesen aus apps/web/src/shell/Logo.tsx)`,
    );
  });

  it("W2 · KALIBRIERUNG: dieselben Wörter NUR im Kommentar — der Wächter bleibt rot", () => {
    // Genau die Gegenprobe, die §5.6 des Auftrags verlangt. Ein Wächter, der hierauf grün würde,
    // bewachte einen Satz und keine Regel.
    const nurKommentar = bauQuelle({
      vorspann: `// Die Breite des Logokastens ist gedeckelt: ${DECKELUNG_NAME} = 44 px und ${DECKELUNG_BREIT_NAME} = 132 px, damit der Konto-Kreis im Fenster bleibt.`,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" />`,
    });
    const d = pruefeQuelle(nurKommentar, "nur-kommentar.tsx");
    expect(d.wert, "aus einem Kommentar wurde eine Zahl gelesen").toBeNull();
    expect(d.wertBreit, "aus einem Kommentar wurde die breite Zahl gelesen").toBeNull();
    expect(d.fehler.join(" "), "der Wächter liess sich von einem Kommentar befriedigen").toContain(
      "ausführbaren Code",
    );
  });

  it("W3 · KALIBRIERUNG: dieselben Wörter NUR in Zeichenketten — der Wächter bleibt rot", () => {
    // Der gefährlichere der beiden Fälle: eine Tailwind-Klasse SIEHT aus wie eine Deckelung
    // (`max-w-[44px]`), und der Name kann in derselben Zeichenkette stehen. Beides ist Inhalt eines
    // `StringLiteral` und damit kein Identifier — der Prüfer sieht es gar nicht.
    const nurZeichenkette = bauQuelle({
      vorspann: `const hinweis = "${DECKELUNG_NAME} = 44, ${DECKELUNG_BREIT_NAME} = 132";`,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto max-w-[44px] xl:max-w-[132px] object-contain" />`,
    });
    const d = pruefeQuelle(nurZeichenkette, "nur-zeichenkette.tsx");
    expect(d.wert, "aus einer Zeichenkette wurde eine Zahl gelesen").toBeNull();
    expect(d.wertBreit, "aus einer Zeichenkette wurde die breite Zahl gelesen").toBeNull();
    expect(
      d.fehler.join(" "),
      "der Wächter liess sich von einer Klassen-Zeichenkette befriedigen",
    ).toContain("ausführbaren Code");
  });

  it("W4 · KALIBRIERUNG: die Zahlen stehen da, werden aber nicht benutzt — der Wächter bleibt rot", () => {
    // Die dritte Halbheit: die benannten Stellen existieren, das Bild trägt sie nicht. Ohne diesen
    // Fall genügten tote Konstanten.
    const totesMass = bauQuelle({
      vorspann: ECHTER_VORSPANN,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" />`,
    });
    const d = pruefeQuelle(totesMass, "totes-mass.tsx");
    expect(d.wert, "die Zahl wurde nicht gelesen").toBe(44);
    expect(d.wertBreit, "die breite Zahl wurde nicht gelesen").toBe(132);
    expect(d.fehler.join(" "), "tote Konstanten genügten dem Wächter").toContain(
      "wirkt aber nicht",
    );
  });

  it("W5 · KALIBRIERUNG: die Breitenspanne NUR im Kommentar — der Wächter bleibt rot", () => {
    // Dieselbe Gegenprobe für die dritte Regel. Ohne sie könnte jemand die Spanne entfernen und
    // ihren Satz als Kommentar stehenlassen; das Logo stünde dann wieder an einer Breite, die es
    // nicht trägt, und niemand würde es merken.
    const nurSatz = bauQuelle({
      vorspann: ECHTER_VORSPANN,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" ${ECHTER_STIL} />`,
      spanne: `// Zwischen 900 und 999 px steht das Logo nicht: ${SPANNE_NAME} = "(min-width: 900px) and (max-width: 999px)".\nconst ${SPANNE_NAME} = 0;`,
    });
    const d = pruefeQuelle(nurSatz, "nur-satz.tsx");
    expect(d.spanne, "aus einem Kommentar wurde eine Medienabfrage gelesen").toBeNull();
    expect(d.fehler.join(" "), "der Wächter liess sich von einem Kommentar befriedigen").toContain(
      SPANNE_NAME,
    );
  });

  // ==============================================================================================
  // W7–W9 — DIE DREI GEGENPROBEN DER ZWEITEN STUFE (Runde 2, nach ROT).
  // ==============================================================================================
  //
  // Der Prüfer hat in Runde 1 gefunden, dass eine EINSTUFIGE Deckelung die breite Bauform bei
  // 1280 px verändert — das Logo stand dort mit 44 statt 88,3 px. Genau diese Rückfallform muss der
  // Wächter ablehnen können, sonst bewacht er die Korrektur nicht.
  it("W7 · KALIBRIERUNG: die Breitenzusage der breiten Zeile NUR im Kommentar — der Wächter bleibt rot", () => {
    const nurSatz = bauQuelle({
      vorspann: ECHTER_VORSPANN,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" ${ECHTER_STIL} />`,
      breiteZeile: `// Ab 1280 px gilt die breite Stufe: ${BREITE_ZEILE_NAME} = "(min-width: 1280px)".\nconst ${BREITE_ZEILE_NAME} = 0;`,
    });
    const d = pruefeQuelle(nurSatz, "nur-satz-breit.tsx");
    expect(d.breiteZeile, "aus einem Kommentar wurde eine Medienabfrage gelesen").toBeNull();
    expect(d.fehler.join(" "), "der Wächter liess sich von einem Kommentar befriedigen").toContain(
      BREITE_ZEILE_NAME,
    );
  });

  it("W8 · KALIBRIERUNG: die Rückfallform aus Runde 1 — eine Stufe für jede Breite — bleibt rot", () => {
    // Der `style` benutzt nur die schmale Stufe; die breite steht daneben und wirkt nicht. Das ist
    // Wort für Wort die Form, die bei 1280 px in die Mockup-Bauform hineinregiert hat.
    const eineStufe = bauQuelle({
      vorspann: ECHTER_VORSPANN,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" style={{ maxWidth: \`\${${DECKELUNG_NAME}}px\` }} />`,
    });
    const d = pruefeQuelle(eineStufe, "eine-stufe.tsx");
    expect(d.wertBreit, "die breite Zahl wurde nicht gelesen").toBe(132);
    expect(d.fehler.join(" "), "eine Deckelung ohne zweite Stufe genügte dem Wächter").toContain(
      DECKELUNG_BREIT_NAME,
    );
  });

  it("W9 · KALIBRIERUNG: die breite Stufe kleiner als die schmale — der Wächter bleibt rot", () => {
    // Die Regel stünde dann auf dem Kopf: die enge Zeile trüge mehr als die weite. Ohne diesen Fall
    // liesse sich §5.4 mit zwei Zahlen „erfüllen", von denen die falsche greift.
    const verdreht = bauQuelle({
      vorspann: `const ${DECKELUNG_NAME} = 44;\nconst ${DECKELUNG_BREIT_NAME} = 20;`,
      bild: `<img src={marke.logo} alt="x" className="h-5 w-auto" ${ECHTER_STIL} />`,
    });
    const d = pruefeQuelle(verdreht, "verdreht.tsx");
    expect(d.wertBreit, "die breite Zahl wurde nicht gelesen").toBe(20);
    expect(d.fehler.join(" "), "eine verdrehte Stufenfolge genügte dem Wächter").toContain(
      "kleiner als",
    );
  });

  it("W10 · KALIBRIERUNG: die vollständige Form ist grün — sonst misst W1 nur seine eigene Strenge", () => {
    // Ohne diesen Fall wäre ein Prüfer, der IMMER rot sagt, in W2–W9 nicht von einem richtigen zu
    // unterscheiden. Er ist die Gegenrichtung der acht Gegenproben.
    const d = pruefeQuelle(ECHTE_FORM, "echte-form.tsx");
    expect(d.fehler, `die vollständige Form wurde abgelehnt: ${d.fehler.join(" · ")}`).toEqual([]);
    expect(d.wert).toBe(44);
    expect(d.wertBreit).toBe(132);
    expect(d.spanne).toBe("(min-width: 900px) and (max-width: 999px)");
    expect(d.breiteZeile).toBe("(min-width: 1280px)");
  });
});
