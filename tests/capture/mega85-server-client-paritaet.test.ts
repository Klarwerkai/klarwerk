// AUFTRAG-mega85 Block B — DIE PARITÄT WIRD DIREKT GEBUNDEN, NICHT JEDE SEITE MIT SICH SELBST.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 2): `mega84-caption-formatierung.test.ts` prüft
//   expect(imageCaptionTexts(formatiert)).toEqual(imageCaptionTexts(schlicht));
//   expect(serverCaptionTexts(formatiert)).toEqual(serverCaptionTexts(schlicht));
// — zweimal „jede Seite ist mit sich selbst konsistent". Beide Zeilen blieben grün, wenn die
// Serverseite ab morgen etwas ANDERES als die Clientseite liefert, solange sie es nur einheitlich
// tut. Genau das ist die Drift, gegen die es die Parität überhaupt gibt.
//
// DIESE DATEI FÄHRT DEN DIREKTEN VERGLEICH: dasselbe bodyHtml durch beide Extraktionen, und die
// beiden ERGEBNISSE müssen gleich sein.
//
// MÜSSEN DIE KOPIEN BLEIBEN? JA — und das ist keine Bequemlichkeit, sondern eine harte Grenze:
// der webbuild-Stage im Dockerfile kopiert NUR `apps/web`, ein Import nach `services/` bricht
// deshalb den Produktions-Build (AUFTRAG-mega8 Block A, dokumentiert in
// `tests/capture/draft-limits-shared.test.ts`). Derselbe Test scannt `apps/web/src` und wird rot,
// sobald eine Produktdatei doch aus `services/` importiert. Umgekehrt kann `services/` nicht aus
// `apps/web` importieren, ohne die Modulrichtung umzudrehen. Die Kopien bleiben also stehen, und
// dieser Test tritt an die Stelle des unmöglichen Imports — dieselbe Bauform, die das Projekt für
// die Entwurfsgrenzen schon benutzt. Ein TEST darf beide Seiten importieren; nur der Produktpfad
// nicht.
import { describe, expect, it } from "vitest";
import { imageCaptionTexts as clientCaptionTexts } from "../../apps/web/src/lib/librarySearch";
import { htmlToPlainText as clientPlainText } from "../../apps/web/src/lib/richText";
import { htmlToPlainText as serverPlainText } from "../../services/structure";
import { imageCaptionTexts as serverCaptionTexts } from "../../services/structure/src/captions";

const figur = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" data-image-id="kw-a"><figcaption data-image-id="kw-a">${caption}</figcaption></figure>`;

// Die Fälle sind bewusst auf das gebaut, was mega84 neu erlaubt hat (Auszeichnung in der Fußnote)
// — plus die Ränder, an denen zwei getrennt gepflegte Kopien am ehesten auseinanderlaufen.
const KORPUS: readonly { name: string; html: string }[] = [
  { name: "unformatiert", html: figur("Der Dichtring am Ventil V2, sichtbar gerissen.") },
  {
    name: "fett + kursiv + Satzzeichen",
    html: figur("Der <strong>Dichtring</strong> am <em>Ventil V2</em>, sichtbar gerissen."),
  },
  { name: "Zeilenumbruch", html: figur("Erste Zeile<br>zweite Zeile") },
  { name: "Umbruch am Rand", html: figur("<br>Text<br>") },
  { name: "verschachtelt", html: figur("<strong>fett und <em>kursiv</em></strong>!") },
  { name: "Entities", html: figur("Gr&ouml;&szlig;e &amp; Ma&szlig;: 5&nbsp;mm") },
  { name: "leere Fußnote", html: figur("") },
  { name: "nur Auszeichnung ohne Text", html: figur("<strong></strong>") },
  { name: "Alt-Platzhalter", html: figur("Noch keine Bildbeschreibung") },
  {
    name: "zwei Bilder",
    html: `${figur("<em>Erstes</em>, links")}<p>Dazwischen.</p>${figur("Zweites<br>rechts")}`,
  },
  {
    name: "Fließtext um die Figur",
    html: `<h2>Überschrift</h2><p>Absatz <strong>eins</strong>.</p>${figur("<em>Fußnote</em>, dazu")}<ul><li>Punkt</li></ul>`,
  },
  { name: "kaputtes Markup (unfertige Fußnote)", html: "<figure><figcaption>ohne Ende" },
  { name: "gar keine Figur", html: "<p>Nur Text, <em>ausgezeichnet</em>, sonst nichts.</p>" },
];

describe("mega85 Block B: Server- und Client-Extraktion liefern für DASSELBE bodyHtml DASSELBE", () => {
  it("die Fußnoten-Extraktion ist Zeichen für Zeichen dieselbe", () => {
    for (const fall of KORPUS) {
      expect(
        serverCaptionTexts(fall.html),
        `„${fall.name}“: Server- und Client-Extraktion der Bild-Fußnoten sind auseinandergelaufen. Beide Kopien MÜSSEN getrennt bleiben (apps/web darf services/ nicht importieren, sonst bricht der Docker-Build) — deshalb hält dieser Vergleich sie zusammen.`,
      ).toEqual(clientCaptionTexts(fall.html));
    }
  });

  it("die Klartext-Ableitung des ganzen Bodys ist Zeichen für Zeichen dieselbe", () => {
    for (const fall of KORPUS) {
      expect(
        serverPlainText(fall.html),
        `„${fall.name}“: htmlToPlainText liefert auf Server und Client verschiedene Texte.`,
      ).toBe(clientPlainText(fall.html));
    }
  });

  it("der Vergleich ist echt: er würde einen Unterschied auch sehen", () => {
    // Negativ-Sonde. Ohne sie wäre nicht belegt, dass die Gleichheit oben etwas kostet — zwei
    // Funktionen, die beide immer [] liefern, wären auch „paritätisch“.
    expect(clientCaptionTexts(KORPUS[1]?.html ?? "")).not.toEqual([]);
    expect(clientPlainText(KORPUS[1]?.html ?? "")).not.toBe("");
    expect(serverCaptionTexts(figur("A"))).not.toEqual(serverCaptionTexts(figur("B")));
  });
});
