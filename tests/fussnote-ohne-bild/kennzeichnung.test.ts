// @vitest-environment jsdom
// ================================================================================================
// JOB 3041 (Register I50, VIERTENS) — EINE BILDBESCHREIBUNG OHNE BILD SAGT ES SELBST
// ================================================================================================
//
// DER BEFUND (`OFFEN.md:379`, vierter Punkt): „die Stufe-3-Fußnote außerhalb der Figure ist nicht
// bedienbar". Stufe 3 entsteht in `flacheFigurenHtml`, wenn Bild-, Anker- und Fußnotenkennung sich
// widersprechen: die Zuordnung wird ZURÜCKGENOMMEN (nicht geraten), und die Fußnote bleibt sichtbar
// stehen — AUSSERHALB jeder figure. Dort sah sie bis heute aus wie eine ganz normale
// Bildbeschreibung, war für die Tastatur unerreichbar, und leer war sie sogar unsichtbar
// (`index.css`: `figcaption:empty:not([data-kw-caption-open])`).
//
// GEMESSEN WIRD AN DER WIRKUNG, NICHT AM NAMEN: das Markup läuft durch die echte Verankerung
// (`enhanceFiguresForEditing` → `ensureImageAnchors` → Stufe 3), und geprüft wird, was danach am
// echten jsdom-Knoten steht. Kein Nachbau der Stufenlogik, keine handgesetzte Vorbedingung.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS BEN AN RUNDE 1 BEANSTANDET HAT, UND WAS SICH DESHALB HIER GEÄNDERT HAT
// ------------------------------------------------------------------------------------------------
//   (a) Der zu prüfende Knoten wurde über `imageForCaption` AUSGEWÄHLT — also über genau die
//       Funktion, deren Fehlklassifikation der Test hätte finden sollen. Ein Test, der seine
//       Vorbedingung aus dem Prüfgegenstand zieht, kann dessen Irrtum nicht sehen. Die Fußnoten
//       werden ab jetzt KONKRET ausgewählt: über ihren sichtbaren Text, sonst über ihre Stellung
//       im Baum (in einer figure oder nicht). Beides ist von der Paarungslogik unabhängig.
//   (b) Alle Körper trugen Kennungen, zu denen es GAR KEIN Bild gab — der leichte Fall. Der harte
//       Fall stand längst im Haus: JOB 3035 FALL C2, wo die verwaiste Fußnote DIESELBE Kennung
//       trägt wie eine vollständige Einheit. Er ist jetzt Fall H, und er war vor der Symmetrie-
//       Korrektur rot.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 — DIE SYMMETRIE WOHNT JETZT IN `imageForCaption` SELBST
// ------------------------------------------------------------------------------------------------
// Runde 2 hatte sie in eine eigene Funktion gelegt, die nur die Kennzeichnung steuerte. Damit sagte
// die Fußnote „noch keinem Bild zugeordnet", während das Formular dahinter weiter das fremde Bild
// zeigte und der KI-Vorschlag es beschrieben hätte. H3 pinnte diesen Zustand sogar ausdrücklich als
// „Kalibrierung" fest — ein Test, der den Befund konserviert. Beides ist behoben: die Sonderfunktion
// ist entfernt, die Regel steht in der einen Auskunft, die alle Wege benutzen, und H3 misst jetzt
// BEIDE Richtungen statt der Asymmetrie.
//
// DIE KALIBRIERUNG DIESER DATEI — jeder Fall hängt an genau einer Ursache:
//   · A/A2/D hängen an der Kennzeichnung selbst. Nimmt man das `setAttribute` zurück, werden sie rot.
//   · H hängt an der SYMMETRIE in `imageForCaption`. Nimmt man die Rückzeige-Bedingung dort heraus,
//     werden genau H1/H2/H3 (und A2) rot; alles andere bleibt grün.
//   · C hängt daran, dass NUR die Fußnote ohne Bild gekennzeichnet wird. Markiert man alle, wird
//     genau C rot — A bliebe grün. Ohne C wäre A wertlos.
//   · B hängt an der Sanitizer-Allowlist (`figcaption` erlaubt nur `data-image-id`). Nimmt man das
//     neue Attribut dort auf, wird genau B rot.
//   · E hängt am CSS: eine gesetzte Kennzeichnung, die niemand sieht, wäre keine Kennzeichnung.
//
// Bewusst DOM-lib-FREI typisiert wie `tests/capture/editor-figure-caption.test.ts`: der Wurzel-tsc
// läuft ohne DOM-lib; das jsdom-Element erfüllt den schmalen Modultyp `EditableElement`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTION_UNASSIGNED_ATTR,
  type EditableElement,
  type EditableFigureRoot,
  captionForImage,
  enhanceFiguresForEditing,
  imageForCaption,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeCaptionHtml, sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

interface WurzelLike extends EditableFigureRoot {
  innerHTML: string;
  querySelector(selectors: string): EditableElement | null;
}
interface DocumentLike {
  createElement(tag: string): WurzelLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

/**
 * Der Modultyp ist bewusst schmal (DOM-lib-frei) und führt `innerHTML` nicht — der Formularweg
 * liest die Fußnote aber genau darüber (`sanitizeCaptionHtml(caption.innerHTML)`). Das jsdom-
 * Element hat die Eigenschaft; hier wird nur ausgesprochen, was zur Laufzeit ohnehin gilt.
 */
interface FussnoteLike extends EditableElement {
  innerHTML: string;
}

/** Die Texte, die der Editor durchreicht — hier festgenagelt, damit der Test die WERTE prüft. */
const KENNZEICHNUNG = "noch keinem Bild zugeordnet";
const KENNZEICHNUNG_LABEL =
  "Bildbeschreibung, noch keinem Bild zugeordnet — öffnet das Beschreibungsformular";
const PLATZHALTER = "✎ Bildbeschreibung hinzufügen …";
const OEFFNEN_LABEL = "Bildbeschreibung bearbeiten";

/**
 * DER STUFE-3-KÖRPER. Zwei Bilder in einer nicht flachen figure, dazu zwei Fußnoten: die erste
 * trägt die Kennung von Bild eins (Stufe 1 paart sie), die zweite trägt eine Kennung, zu der es in
 * dieser Einheit KEIN Bild gibt. Stufe 2 nimmt nur unmarkierte Fußnoten, Stufe 2b ist seit JOB 916
 * abgelöst — die zweite Fußnote bleibt also übrig und wird von `flacheFigurenHtml` am Ende
 * unverändert ausgegeben, außerhalb jeder figure. Genau der Zustand, um den es geht.
 */
const STUFE_DREI =
  "<figure>" +
  '<img src="data:image/png;base64,AAAA" data-image-id="kw-img-eins">' +
  '<img src="data:image/png;base64,BBBB" data-image-id="kw-img-zwei">' +
  '<figcaption data-image-id="kw-img-eins">Zu Bild eins</figcaption>' +
  '<figcaption data-image-id="kw-img-fremd">Gehört keinem Bild in diesem Text</figcaption>' +
  "</figure>";

/**
 * Derselbe Zustand über die DRITTE Kennungsquelle: der innere Anker in einer erhaltenen Struktur
 * widerspricht seinem Bild, der Platz ist damit geschlossen, und die äußere Fußnote fällt in
 * Stufe 3. Zwei Wege in denselben Zustand — die Kennzeichnung darf an keinem von beiden hängen.
 */
const STUFE_DREI_UEBER_ANKER =
  "<figure>" +
  "<table><tbody><tr><td>" +
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-img-eins">' +
  '<figcaption data-image-id="kw-img-anders"></figcaption></figure>' +
  "</td></tr></tbody></table>" +
  '<figcaption data-image-id="kw-img-frei">Text ohne Bild</figcaption>' +
  "</figure>";

/**
 * DER HARTE FALL — wörtlich der Körper aus JOB 3035 FALL C2
 * (`tests/bildkennung-eindeutig/doppelte-kennung.test.ts`). Dort ist die äußere Fußnote
 * ausdrücklich als „verwaist" benannt, und dort ist auch belegt, dass `captionForImage` dem Bild
 * die INNERE Fußnote zuordnet. Die Kennungen sind hier alle gleich (`kw-x`) — deshalb sieht die
 * verwaiste Fußnote rückwärts wie zugeordnet aus und wurde in Runde 1 nicht gekennzeichnet.
 */
const VERWAISTE_DOPPELKENNUNG =
  '<figcaption data-image-id="kw-x">Verwaist</figcaption>' +
  '<figure data-image-id="kw-x"><img src="/api/objects/echtes/raw" data-image-id="kw-x">' +
  '<figcaption data-image-id="kw-x">Echte</figcaption></figure>';

/**
 * DIE MENGENLAGE — wörtlich die aus `tests/capture/huelle4-nachnormalisierung.test.ts` (Probe 2).
 * EINE figure, EIN Bild `kw-img-bild-7`, ZWEI direkte Fußnoten: eine leere und eine mit der
 * widersprechenden Kennung `kw-img-zweite-3`. `ensureImageAnchors` schreibt hier bewusst NICHTS —
 * dort steht wörtlich: „Es gibt keine Antwort auf die Frage, welche zum Bild gehört."
 *
 * Genau daran hing bens Befund an Runde 3: der Kennungszweig lehnte die zweite Fußnote ab, aber der
 * ungeprüfte Direktzweig (`:scope > img`) gab ihr das Bild trotzdem zurück. Beide Reihenfolgen, weil
 * „die erste" die Frage ist — steht die widersprechende Fußnote hinten, sieht ein Blick auf den
 * ersten Treffer sie nicht; steht sie vorne, sieht er die andere nicht.
 */
const MENGENLAGE_WIDERSPRUCH_HINTEN = [
  '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-bild-7">',
  "<figcaption>Erste Beschreibung</figcaption>",
  '<figcaption data-image-id="kw-img-zweite-3">Zweite Beschreibung</figcaption></figure>',
].join("");

const MENGENLAGE_WIDERSPRUCH_VORNE = [
  '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-bild-7">',
  '<figcaption data-image-id="kw-img-zweite-3">Zweite Beschreibung</figcaption>',
  "<figcaption>Erste Beschreibung</figcaption></figure>",
].join("");

function wurzelMit(html: string): WurzelLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

/** Verankert wie der Editor: alle vier Texte, an der einen Stelle. */
function verankert(html: string): WurzelLike {
  const el = wurzelMit(html);
  enhanceFiguresForEditing(el, PLATZHALTER, OEFFNEN_LABEL, KENNZEICHNUNG, KENNZEICHNUNG_LABEL);
  return el;
}

function fussnoten(root: EditableFigureRoot): FussnoteLike[] {
  return Array.from(root.querySelectorAll("figcaption")) as FussnoteLike[];
}

/**
 * DER KONKRETE KNOTEN, über seinen sichtbaren Text — unabhängig von jeder Paarungslogik.
 * (bens Korrekturpflicht: der Test darf sein Ziel nicht über `imageForCaption` auswählen.)
 */
function fussnoteMitText(root: EditableFigureRoot, text: string): FussnoteLike {
  const treffer = fussnoten(root).filter((f) => (f.textContent ?? "").trim() === text);
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

/** Der konkrete Knoten über seine STELLUNG: außerhalb jeder figure. Für leere Fußnoten. */
function fussnoteAusserhalbFigure(root: EditableFigureRoot): FussnoteLike {
  const treffer = fussnoten(root).filter((f) => f.closest("figure") === null);
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten außerhalb einer figure statt genau einer`);
  }
  return eine;
}

/** Was eine gekennzeichnete Fußnote tragen muss — an einer Stelle, nicht viermal abgeschrieben. */
function erwarteGekennzeichnet(cap: FussnoteLike, wo: string): void {
  expect(cap.getAttribute(CAPTION_UNASSIGNED_ATTR), `${wo}: keine Kennzeichnung`).toBe(
    KENNZEICHNUNG,
  );
  // Bedienbar wie jede andere Fußnote: angekündigt, fokussierbar, kein Editing-Host.
  expect(cap.getAttribute("role"), wo).toBe("button");
  expect(cap.getAttribute("tabindex"), wo).toBe("0");
  expect(cap.getAttribute("contenteditable"), wo).toBe("false");
  // `data-kw-caption-open` gehört dazu: erst es macht die LEERE Fußnote im Editor wieder sichtbar
  // (index.css) — und der Klickweg, den es ankündigt, existiert wirklich.
  expect(cap.getAttribute("data-kw-caption-open"), wo).toBe("");
  // Die EIGENE Beschriftung, nicht die allgemeine „Bildbeschreibung bearbeiten".
  expect(cap.getAttribute("aria-label"), wo).toBe(KENNZEICHNUNG_LABEL);
  expect(cap.getAttribute("aria-label"), wo).not.toBe(OEFFNEN_LABEL);
}

/** Was eine ZUGEORDNETE Fußnote tragen muss — bytegleich wie vor diesem Auftrag. */
function erwarteUnveraendert(cap: FussnoteLike, wo: string): void {
  expect(
    cap.getAttribute(CAPTION_UNASSIGNED_ATTR),
    `${wo}: eine Fußnote MIT Bild trägt die Kennzeichnung — dann sagt sie nichts mehr aus`,
  ).toBeNull();
  expect(cap.getAttribute("aria-label"), wo).toBe(OEFFNEN_LABEL);
  expect(cap.getAttribute("role"), wo).toBe("button");
  expect(cap.getAttribute("tabindex"), wo).toBe("0");
  expect(cap.getAttribute("contenteditable"), wo).toBe("false");
  expect(cap.getAttribute("data-kw-caption-open"), wo).toBe("");
  expect(cap.getAttribute("data-kw-placeholder"), wo).toBe(PLATZHALTER);
}

describe("JOB 3041 · A — die Fußnote ohne Bild ist gekennzeichnet und bedienbar", () => {
  it("A · über die Fußnotenkennung: Kennzeichnung, Rolle, Fokus und eigene Beschriftung", () => {
    const el = verankert(STUFE_DREI);
    const cap = fussnoteMitText(el, "Gehört keinem Bild in diesem Text");
    // Vorbedingung, die den Fall überhaupt erst zum Fall macht: sie steht außerhalb jeder figure.
    expect(cap.closest("figure"), "die Stufe-3-Fußnote steht nicht mehr außerhalb").toBeNull();
    erwarteGekennzeichnet(cap, "Stufe 3 über die Fußnotenkennung");
  });

  it("A · über den inneren Anker: derselbe Zustand auf dem zweiten Weg", () => {
    const el = verankert(STUFE_DREI_UEBER_ANKER);
    const cap = fussnoteMitText(el, "Text ohne Bild");
    expect(cap.closest("figure")).toBeNull();
    erwarteGekennzeichnet(cap, "Stufe 3 über den inneren Anker");
  });

  it("A2 · auch die LEERE Fußnote ohne Bild wird gekennzeichnet (sonst wäre sie unsichtbar)", () => {
    // Ausgewählt über die STELLUNG, nicht über den Text (den gibt es hier nicht) und nicht über
    // die Paarungslogik: die einzige Fußnote außerhalb jeder figure.
    const el = verankert(VERWAISTE_DOPPELKENNUNG.replace(">Verwaist<", "><"));
    const cap = fussnoteAusserhalbFigure(el);
    expect((cap.textContent ?? "").trim()).toBe("");
    erwarteGekennzeichnet(cap, "leere Stufe-3-Fußnote");
  });
});

describe("JOB 3041 · H — der harte Fall: dieselbe Kennung, und trotzdem verwaist (JOB 3035 C2)", () => {
  // DER FALL, DEN RUNDE 1 LIEGEN LIESS. Beide Fußnoten und das Bild tragen `kw-x`. Rückwärts
  // („welches Bild hat meine Kennung?") findet die verwaiste Fußnote GENAU EIN Bild und sah damit
  // zugeordnet aus. Vorwärts gehört dem Bild aber die INNERE Fußnote — das ist in JOB 3035 FALL C2
  // eigens gepinnt. Erst die Symmetriebedingung IN `imageForCaption` löst den Widerspruch auf —
  // und weil sie dort wohnt, sagen Kennzeichnung, Formular und KI-Vorschlag ab jetzt dasselbe.
  it("H1 · genau die verwaiste äußere Fußnote wird gekennzeichnet", () => {
    const el = verankert(VERWAISTE_DOPPELKENNUNG);
    erwarteGekennzeichnet(fussnoteMitText(el, "Verwaist"), "die verwaiste äußere Fußnote");
  });

  it("H2 · und die echte Fußnote derselben Kennung bleibt unangetastet", () => {
    const el = verankert(VERWAISTE_DOPPELKENNUNG);
    erwarteUnveraendert(fussnoteMitText(el, "Echte"), "die echte Fußnote des Bildes");
    // Genau EINE Kennzeichnung im ganzen Baum — nicht beide, nicht keine.
    const markiert = fussnoten(el).filter((f) => f.getAttribute(CAPTION_UNASSIGNED_ATTR) !== null);
    expect(markiert.map((f) => (f.textContent ?? "").trim())).toEqual(["Verwaist"]);
  });

  it("H3 · die Zuordnung selbst ist symmetrisch — in BEIDEN Richtungen gemessen", () => {
    // RUNDE 3, bens Korrekturpflicht 1: hier stand bis Runde 2 die Zusicherung, dass
    // `imageForCaption` der verwaisten Fußnote das Bild LIEFERT — der Test pinnte also den
    // fehlerhaften Zustand fest und erklärte ihn zur Kalibrierung. Die Asymmetrie ist keine
    // Eigenschaft, die man festhält, sondern der Befund selbst. Gemessen wird jetzt, dass sie weg
    // ist: die eine Auskunft, die Marker, Formular, Geltungsprüfung und KI-Vorschlag gemeinsam
    // benutzen, sagt für die verwaiste Fußnote NICHTS und für die echte ihr Bild.
    const el = verankert(VERWAISTE_DOPPELKENNUNG);
    const verwaist = fussnoteMitText(el, "Verwaist");
    const echte = fussnoteMitText(el, "Echte");

    // Vorbedingung, ohne die der Fall nicht der gemeinte wäre: alle drei tragen DIESELBE Kennung.
    const bild = el.querySelector("img");
    expect(bild, "Vorbedingung: es gibt ein Bild").not.toBeNull();
    const kennung = bild === null ? null : bild.getAttribute("data-image-id");
    expect(kennung).not.toBe("");
    expect(verwaist.getAttribute("data-image-id"), "die Doppelkennung ist verschwunden").toBe(
      kennung,
    );
    expect(echte.getAttribute("data-image-id")).toBe(kennung);

    // HINRICHTUNG: dem Bild gehört genau EINE der beiden — die direkte (JOB 3035 FALL C2).
    expect(bild === null ? null : captionForImage(bild, el)).toBe(echte);
    // RÜCKRICHTUNG: und beide sagen dasselbe wie die Hinrichtung.
    expect(imageForCaption(echte, el), "die echte Fußnote findet ihr Bild nicht mehr").toBe(bild);
    expect(
      imageForCaption(verwaist, el),
      "die verwaiste Fußnote bekommt weiterhin ein fremdes Bild — genau der Befund an Runde 2",
    ).toBeNull();
  });
});

describe("JOB 3041 · J — die Mengenlage: EIN Bild, ZWEI direkte Fußnoten (huelle4 Probe 2)", () => {
  // RUNDE 4, bens Korrekturpflicht 1. Runde 3 prüfte die Rückzeige nur am KENNUNGSTREFFER; der
  // Direktzweig `:scope > img` antwortete danach unbesehen und stellte die eben abgelehnte
  // Zuordnung strukturell wieder her. `huelle4` erklärt diese Lage ausdrücklich für unbelegbar —
  // die Kennzeichnung muss das sagen, statt es zu überspielen.
  for (const [name, koerper] of [
    ["widersprechende Kennung HINTEN", MENGENLAGE_WIDERSPRUCH_HINTEN],
    ["widersprechende Kennung VORNE", MENGENLAGE_WIDERSPRUCH_VORNE],
  ] as const) {
    it(`J · ${name}: genau die Fußnote ohne Paarung wird gekennzeichnet`, () => {
      const el = verankert(koerper);
      const bild = el.querySelector("img");
      expect(bild, "Vorbedingung: es gibt genau ein Bild").not.toBeNull();
      const direkte = fussnoten(el);
      expect(direkte.length, "Vorbedingung: zwei direkte Fußnoten").toBe(2);

      // Die HINRICHTUNG entscheidet, welche der beiden dem Bild gehört. Welche das ist, hängt an
      // der vorhandenen Regel in `captionForImage` und wird hier NICHT neu festgelegt — geprüft
      // wird, dass die Kennzeichnung ihr folgt statt eine zweite Antwort zu geben.
      const gepaart = bild === null ? null : captionForImage(bild, el);
      expect(gepaart, "die Hinrichtung nennt gar keine Fußnote").not.toBeNull();
      const verwaist = direkte.filter((f) => f !== gepaart);
      expect(verwaist.length).toBe(1);
      const eine = verwaist[0];
      if (eine === undefined) {
        throw new Error("unerreichbar");
      }

      erwarteGekennzeichnet(eine, `${name}: die Fußnote ohne Paarung`);
      // Und sie bekommt auch KEIN Bild mehr — genau das war die Restkante: der Direktzweig gab ihr
      // das Bild der figure zurück, nachdem die Kennung abgelehnt worden war.
      expect(
        imageForCaption(eine, el),
        "die Fußnote ohne Paarung bekommt über :scope > img weiterhin das fremde Bild",
      ).toBeNull();
      // Die gepaarte behält alles, was sie hatte.
      if (gepaart !== null) {
        erwarteUnveraendert(gepaart as FussnoteLike, `${name}: die gepaarte Fußnote`);
        expect(imageForCaption(gepaart, el)).toBe(bild);
      }
    });
  }

  it("J2 · im Fall aus bens Messung ist es namentlich die zweite Fußnote", () => {
    // Ohne diese Zeile bliebe J auch dann grün, wenn `captionForImage` seine Antwort umdrehte.
    const el = verankert(MENGENLAGE_WIDERSPRUCH_HINTEN);
    expect(fussnoteMitText(el, "Zweite Beschreibung").getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe(
      KENNZEICHNUNG,
    );
    expect(
      fussnoteMitText(el, "Erste Beschreibung").getAttribute(CAPTION_UNASSIGNED_ATTR),
    ).toBeNull();
  });
});

describe("JOB 3041 · B — die Kennzeichnung kann nicht gespeichert werden", () => {
  it("B · beide Body-Sanitizer strippen das Attribut; data-image-id bleibt", () => {
    const el = verankert(STUFE_DREI);
    // Vorbedingung: es gibt überhaupt etwas zu strippen.
    expect(el.innerHTML).toContain(CAPTION_UNASSIGNED_ATTR);

    // Client- UND Server-Sanitizer: `figcaption` erlaubt in BEIDEN genau `data-image-id`
    // (richText.ts, services/structure). Die Nichtpersistenz folgt daraus — sie wird nicht erkauft.
    for (const sanitize of [sanitizeHtml, serverSanitize]) {
      const gespeichert = sanitize(el.innerHTML);
      expect(gespeichert).not.toContain(CAPTION_UNASSIGNED_ATTR);
      expect(gespeichert).not.toContain(KENNZEICHNUNG);
      expect(gespeichert).not.toContain(KENNZEICHNUNG_LABEL);
      // Die ZUORDNUNGSWAHRHEIT bleibt: die Kennungen überleben unverändert.
      expect(gespeichert).toContain('data-image-id="kw-img-eins"');
      expect(gespeichert).toContain('data-image-id="kw-img-fremd"');
    }
  });

  it("B2 · der Fußnoten-Sanitizer (Formularweg) trägt die Kennzeichnung ebenfalls nicht weiter", () => {
    const el = verankert(STUFE_DREI);
    const cap = fussnoteMitText(el, "Gehört keinem Bild in diesem Text");
    // So liest das Formular die Fußnote: `sanitizeCaptionHtml(caption.innerHTML)`
    // (RichTextEditor.tsx). Zusätzlich der schärfere Schnitt über das GANZE Element — dort fällt
    // sogar das `figcaption`-Tag selbst, weil nur strong/em/br erlaubt sind. In beiden Fällen kann
    // die Kennzeichnung den Weg ins Formular nicht antreten.
    for (const roh of [cap.innerHTML, cap.outerHTML]) {
      const gefiltert = sanitizeCaptionHtml(roh);
      expect(gefiltert).not.toContain(CAPTION_UNASSIGNED_ATTR);
      expect(gefiltert).not.toContain(KENNZEICHNUNG);
    }
    // Und der Text, den der Nutzer geschrieben hat, kommt trotzdem an.
    expect(sanitizeCaptionHtml(cap.innerHTML)).toContain("Gehört keinem Bild");
  });
});

describe("JOB 3041 · C — die Gegenprobe: eine ZUGEORDNETE Fußnote wird nicht gekennzeichnet", () => {
  it("C · sie bleibt bytegleich wie bisher — inklusive der allgemeinen Beschriftung", () => {
    const el = verankert(STUFE_DREI);
    // KONKRET benannt statt über die Paarungslogik gefiltert: die Fußnote von Bild eins und die
    // leere, die `ensureImageAnchors` für Bild zwei anlegt (die einzige leere in einer figure).
    erwarteUnveraendert(fussnoteMitText(el, "Zu Bild eins"), "Fußnote von Bild eins");
    const leereInFigure = fussnoten(el).filter(
      (f) => f.closest("figure") !== null && (f.textContent ?? "").trim() === "",
    );
    expect(leereInFigure.length, "Vorbedingung: Bild zwei hat eine leere Fußnote bekommen").toBe(1);
    const eine = leereInFigure[0];
    if (eine === undefined) {
      throw new Error("unerreichbar");
    }
    erwarteUnveraendert(eine, "angelegte Fußnote von Bild zwei");
  });

  it("C2 · eine stehengebliebene Kennzeichnung wird beim nächsten Lauf ENTFERNT, nicht ignoriert", () => {
    // Eine Aussage, die nicht mehr gilt, muss verschwinden. Sonst behauptete die Fußnote „ohne
    // Bild", während sie längst eines hat — die schlimmere Hälfte des Befunds, nur andersherum.
    const el = verankert(STUFE_DREI);
    const zugeordnet = fussnoteMitText(el, "Zu Bild eins");
    zugeordnet.setAttribute(CAPTION_UNASSIGNED_ATTR, KENNZEICHNUNG);
    enhanceFiguresForEditing(el, PLATZHALTER, OEFFNEN_LABEL, KENNZEICHNUNG, KENNZEICHNUNG_LABEL);
    expect(zugeordnet.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBeNull();
  });
});

describe("JOB 3041 · D — eine figure MIT Fußnote, aber OHNE Bild gilt als ohne Bild", () => {
  it("D · die Entscheidung wird hier benannt, nicht stillschweigend getroffen", () => {
    // BEGRÜNDUNG, ausdrücklich: die Regel ist die Paarung in beiden Richtungen und sonst nichts.
    // Eine figure ohne Bild hat kein Bild — die Hülle allein stiftet keine Zugehörigkeit. Hier
    // ANDERS zu entscheiden hieße, einen zweiten Begriff von „zugeordnet" einzuführen (liegt in
    // einer figure), und genau das verbietet dieser Auftrag.
    const el = verankert("<figure><figcaption>Beschreibung ohne Bild</figcaption></figure>");
    const cap = fussnoteMitText(el, "Beschreibung ohne Bild");
    expect(cap.closest("figure"), "der Fall wäre sonst nicht der gemeinte").not.toBeNull();
    erwarteGekennzeichnet(cap, "figure ohne Bild");
  });
});

describe("JOB 3041 · E — die Kennzeichnung ist wirklich zu SEHEN", () => {
  const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");

  it("E · index.css rendert den Attributwert — ::after, weil ::before der Platzhalter ist", () => {
    const start = css.indexOf(`.prose-kw figcaption[${CAPTION_UNASSIGNED_ATTR}]::after`);
    expect(start, "keine Regel, die die Kennzeichnung anzeigt").toBeGreaterThanOrEqual(0);
    const regel = css.slice(start, css.indexOf("}", start));
    expect(regel).toContain(`content: attr(${CAPTION_UNASSIGNED_ATTR})`);
    // Der Platzhalter behält ::before — die zwei Aussagen verdrängen einander nicht.
    expect(css).toContain(".prose-kw figcaption[data-kw-caption-open]:empty::before");
  });

  it("E2 · KEINE Regel versteckt eine so gekennzeichnete Fußnote", () => {
    // Jede Regel, deren Selektor die Kennzeichnung erwähnt, wird ganz gelesen; und die eine
    // vorhandene Versteck-Regel darf sie nicht treffen können.
    const versteck = ["hidden", "display: none", "pointer-events", "user-select", "h-0"];
    let i = css.indexOf(CAPTION_UNASSIGNED_ATTR);
    let gefunden = 0;
    while (i >= 0) {
      const zeilenAnfang = css.lastIndexOf("\n", i) + 1;
      const regel = css.slice(zeilenAnfang, css.indexOf("}", i));
      for (const schlecht of versteck) {
        expect(regel, `${schlecht} in einer Regel über ${CAPTION_UNASSIGNED_ATTR}`).not.toContain(
          schlecht,
        );
      }
      gefunden += 1;
      i = css.indexOf(CAPTION_UNASSIGNED_ATTR, i + 1);
    }
    expect(gefunden, "die Kennzeichnung kommt im CSS gar nicht vor").toBeGreaterThan(0);
    // Die eine Versteck-Regel des Hauses greift nur ohne Editor-Marker — und den trägt jede
    // gekennzeichnete Fußnote (Fall A). Sie kann sie deshalb nicht erwischen.
    expect(css).toContain(".prose-kw figcaption:empty:not([data-kw-caption-open])");
  });
});
