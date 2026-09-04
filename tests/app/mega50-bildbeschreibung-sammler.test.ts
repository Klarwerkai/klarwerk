import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// AUFTRAG-mega50 Block B — DER SAMMLER FÜR DIE BILDBESCHREIBUNG.
//
// DER VORFALL (Pedi, mehrfach, 29.07.): auf der Vordertür fehlten am Bild das Eingabeformular
// (mega9 Block F) und der KI-Vorschlag (WP-BILD-1c). Beides gebaut, beides getestet, beides dort
// unsichtbar. Die Ursache war ein OPTIONALER PROP — `onDescribeImage` am RichTextEditor. Zwei der
// vier Flächen übergaben ihn, zwei nicht; ohne ihn rendert der Editor den Knopf gar nicht und
// `captionSuggestVisible` gibt false zurück. GERÄUSCHLOS.
//
// Es ist dieselbe Klasse wie bens sammel45-Befund vom Vortag (`FacetFilter` ohne `backgroundRef`).
// Zweimal in zwei Tagen derselbe Mechanismus heißt: die Klasse braucht einen Wächter, nicht die
// beiden Fälle eine Korrektur.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM, NICHT DIE HEUTIGEN FÄLLE. Es steht hier bewusst keine Liste der vier Flächen. Der
// Sammler erhebt in zwei Stufen aus dem Quellbaum, beide über die tatsächlichen AUFRUFER und keine
// über eine Zeichenfolge, die jemand freiwillig setzt (bens Nachschärfung aus sammel45):
//
//   (1) DIE BAUTEILE: jede Quelldatei, die die Bildbeschreibung ANBIETET — erkannt daran, dass sie
//       die Texte des Merkmals rendert (`CAPTION_AI_TEXT.…`). Das ist bewusst der Anker: er hängt
//       an der Behauptung „hier gibt es eine Bildbeschreibung", nicht daran, ob jemand sie auch
//       richtig verdrahtet hat. Das Modul, das diese Texte DEFINIERT (`lib/captionAiSuggest.ts`),
//       ist ausgenommen — sonst fände sich der Sammler an seiner eigenen Quelle.
//       Aus jeder Bauteil-Datei werden die EXPORTIERTEN Komponenten gelesen (heute:
//       `RichTextEditor`).
//   (2) DIE AUFRUFER: jede Quelldatei, die eines dieser Bauteile im JSX EINBINDET. Weglassen kann
//       man hier nichts mehr — wer das Bauteil benutzt, steht im Fund, mit oder ohne Props. Eine
//       fünfte Fläche morgen ist ohne Zutun Gegenstand dieser Datei.
//
// WAS VERLANGT WIRD: dass der Weg zur Bildbeschreibung JEDEN Aufrufer erreicht. Erreichen kann er
// ihn auf genau zwei Arten — das Bauteil HOLT ihn sich selbst (seit mega50 der Fall,
// `app/ImageDescribeContext.tsx`), oder der Aufrufer reicht ihn herein (der alte, vergessliche
// Weg). Eine Fläche, die ihn fachlich NICHT anbieten soll, trägt die Ausnahme sichtbar im Code
// (`KEINE-BILDBESCHREIBUNG:` mit Begründung) — sie wird nicht durch Weglassen erreicht.
//
// Zwei Regeln bleiben auch nach mega50 lebendig und können morgen wieder rot werden:
//   · Kein Aufrufer verdrahtet den describe-Aufruf SELBST (Regel „kein zweiter Weg"). Genau daran
//     ist dieser Auftrag entstanden: derselbe sechszeilige Block stand zweimal im Produktcode.
//   · Wer die Bildbeschreibung anbietet, benutzt die EINE Quelle — eine zweite, selbstgebaute
//     Bauform ist rot, statt unsichtbar zu sein.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle). ben hat
// zu mega48 dieselbe Grenze bei einem statischen Musterwächter benannt — hier greifen davon:
//
//  1. ALIAS/INDIREKTION GREIFT. Sie sieht nur, was im JSX beim Namen genannt wird. Ein Bauteil, das
//     über eine Variable (`const E = RichTextEditor; <E/>`) oder über `createElement(RichTextEditor,
//     …)` eingebunden wird, fällt durch. Die Tests tun genau das (`createElement`) — der Produktbaum
//     heute nirgends. Eine Wrapper-Komponente wäre wieder ein Fund, sobald sie das Bauteil im JSX
//     nennt; die Kette bricht erst bei bewusster Indirektion.
//  2. SPREAD GREIFT. Käme der Weg über ein Spread-Objekt (`<RichTextEditor {...props} />`) herein,
//     sähe die Regel „kein zweiter Weg" ihn nicht.
//  3. `createElement` GREIFT AUCH IN DER ANDEREN RICHTUNG: eine Fläche, die den Editor so montiert,
//     ist kein Aufrufer im Sinne dieser Erhebung. Aufgefangen wird sie nicht hier, sondern zur
//     LAUFZEIT: `useImageDescribe()` wirft ohne Provider (Pflichtvertrag). Das ist der Grund, warum
//     der Weg fail-closed gebaut ist und nicht nur von diesem Sammler gehütet wird; den Beweis dafür
//     führt `tests/capture/bildbeschreibung-pflichtvertrag-mounted.test.tsx`.
//  4. SIE LIEST QUELLTEXT, KEIN VERHALTEN. Dass Formular und Vorschlagsleiste auf einer Fläche
//     WIRKLICH erscheinen, belegen die gemounteten Fälle unter `tests/capture/`, nicht diese Datei.
//  5. SIE SIEHT NUR `apps/web/src`. Ein Editor außerhalb des Web-Produktbaums ist nicht Gegenstand.
// ================================================================================================

const WURZEL = process.cwd();
const WEB_SRC = join("apps", "web", "src");

// Das Modul, das die Texte des Merkmals DEFINIERT — es bietet nichts an, es liefert nur die Namen.
const TEXT_MODUL = "apps/web/src/lib/captionAiSuggest.ts";
// Das Modul, das den EINEN Weg definiert — es benutzt sich selbst, das ist keine Fundstelle.
const WEG_MODUL = "apps/web/src/app/ImageDescribeContext.tsx";
// Die Wurzel, in der der Weg für die ganze App montiert wird.
const APP_WURZEL = "apps/web/src/App.tsx";

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// Kommentare zählen nicht: der Umbau von mega50 ist im Produktcode ausführlich erklärt, und eine
// Erwähnung des alten Props in einer Erklärung ist keine Verdrahtung. Gespiegelt aus mega47.
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

interface Fund {
  datei: string;
  // Ohne Kommentare — für alle Fragen nach VERDRAHTUNG.
  quelle: string;
  // Mit Kommentaren — nur für die ausdrückliche Ausnahme, die bewusst ein Kommentar ist.
  roh: string;
}

const ALLE_QUELLEN: Fund[] = quelldateien(WEB_SRC).map((datei) => {
  const roh = readFileSync(join(WURZEL, datei), "utf8");
  return { datei: posix(datei), quelle: ohneKommentare(roh), roh };
});

// Ein BAUTEIL bietet die Bildbeschreibung an — es rendert ihre Texte.
const ANGEBOT_MUSTER = /CAPTION_AI_TEXT\s*\./;
// … und muss dafür den EINEN Weg holen.
const WEG_MUSTER = /useImageDescribe\s*\(/;
// Der alte, vergessliche Vertrag: ein Weg, den ein Aufrufer hereinreicht — oder eben nicht.
const PROP_MUSTER = /onDescribeImage/;
// Ein zweiter Weg: eine Fläche, die den Modellaufruf selbst zusammensetzt.
const EIGENER_AUFRUF = /\breasoner\s*\.\s*describeImage\s*\(/;
// Eine exportierte Komponente ist das, was ein Aufrufer einbinden kann.
const EXPORT_MUSTER = /export function ([A-Z]\w*)/g;
// Die ausdrückliche, im Code sichtbare Ausnahme (bewusst im Kommentar, deshalb gegen `roh` geprüft).
const AUSNAHME_MUSTER = /KEINE-BILDBESCHREIBUNG:/;

// Ein AUFRUFER nennt das Bauteil im JSX beim Namen.
function einbindeMuster(komponente: string): RegExp {
  return new RegExp(`<\\s*${komponente}[\\s/>]`);
}

interface Bauteil {
  datei: string;
  komponente: string;
}

const BAUTEIL_DATEIEN: Fund[] = ALLE_QUELLEN.filter(
  (f) => f.datei !== TEXT_MODUL && f.datei !== WEG_MODUL && ANGEBOT_MUSTER.test(f.quelle),
);

const BAUTEILE: Bauteil[] = BAUTEIL_DATEIEN.flatMap((f) =>
  [...f.quelle.matchAll(EXPORT_MUSTER)].map((m) => ({
    datei: f.datei,
    komponente: m[1] as string,
  })),
);

interface Paar {
  einbinder: Fund;
  bauteil: Bauteil;
}

const AUFRUFER: Paar[] = BAUTEILE.flatMap((bauteil) =>
  ALLE_QUELLEN.filter(
    (f) => f.datei !== bauteil.datei && einbindeMuster(bauteil.komponente).test(f.quelle),
  ).map((einbinder) => ({ einbinder, bauteil })),
);

function schluessel(p: Paar): string {
  return `${p.einbinder.datei} → <${p.bauteil.komponente}>`;
}

// Holt sich DIESES Bauteil den Weg selbst? Dann erreicht er jeden seiner Aufrufer, ohne dass einer
// von ihnen etwas dafür tun muss — das ist der ganze Punkt von mega50.
function bauteilHoltSelbst(bauteil: Bauteil): boolean {
  const datei = BAUTEIL_DATEIEN.find((f) => f.datei === bauteil.datei);
  return datei !== undefined && WEG_MUSTER.test(datei.quelle);
}

describe("mega50 Block B: die Erhebung greift", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(100);

    // Positiv-Sonde: das heute einzige Bauteil muss im Fund liegen …
    const komponenten = BAUTEILE.map((b) => b.komponente);
    expect(komponenten).toContain("RichTextEditor");

    // … das Textmodul und das Wegmodul sind KEINE Bauteile (sonst fände sich der Sammler selbst) …
    const bauteilDateien = BAUTEILE.map((b) => b.datei);
    expect(bauteilDateien).not.toContain(TEXT_MODUL);
    expect(bauteilDateien).not.toContain(WEG_MODUL);

    // … Negativ-Sonde: eine unbeteiligte Datei darf nicht hineinrutschen …
    expect(bauteilDateien).not.toContain("apps/web/src/lib/editorBlocks.ts");

    // … und die Aufrufer-Stufe findet die vier bekannten Flächen. Das ist KEINE Liste, gegen die
    // geprüft wird — es ist die Kalibrierung, dass die Erhebung nicht ins Leere greift. Die Regeln
    // unten laufen über `AUFRUFER`, nicht über diese Namen.
    const einbinder = AUFRUFER.map((p) => p.einbinder.datei);
    expect(einbinder).toContain("apps/web/src/pages/Capture.tsx");
    // JOB 3063 (H4): der Editor des Wissensobjekts steht nicht mehr in `pages/KnowledgeDetail.tsx`
    // (die Seite ist zum Adress-Adapter geworden), sondern in der Lesefläche der Bibliothek —
    // dieselbe Fläche, die `/bibliothek` und `/wissen/:id` zeigen.
    expect(einbinder).toContain("apps/web/src/components/bibliothek/BibliothekLesen.tsx");
    expect(einbinder).toContain("apps/web/src/pages/CaptureFrontDoor.tsx");
    expect(einbinder).toContain("apps/web/src/components/KnowledgeInputStudio.tsx");
    expect(AUFRUFER.length).toBeGreaterThanOrEqual(4);
  });
});

describe("mega50 Block B: der Weg zur Bildbeschreibung erreicht jede Fläche", () => {
  it("wer die Bildbeschreibung ANBIETET, holt sich den EINEN Weg (keine zweite Bauform)", () => {
    const ohneWeg = BAUTEIL_DATEIEN.filter((f) => !WEG_MUSTER.test(f.quelle)).map((f) => f.datei);
    expect(
      ohneWeg,
      "Diese Datei rendert die Bildbeschreibung, holt sich den Weg aber nicht aus " +
        "app/ImageDescribeContext.tsx — damit hängt er wieder an dem, was ein Aufrufer mitgibt.",
    ).toEqual([]);
  });

  it("der alte, vergessliche Vertrag existiert nicht mehr (kein optionaler Weg als Prop)", () => {
    const mitProp = ALLE_QUELLEN.filter((f) => PROP_MUSTER.test(f.quelle)).map((f) => f.datei);
    expect(
      mitProp,
      "`onDescribeImage` ist der Prop, dessen Weglassen Formular und Vorschlag geräuschlos " +
        "verschwinden ließ. Ein Weg, den ein Aufrufer hereinreichen KANN, wird vergessen.",
    ).toEqual([]);
  });

  it("JEDER Aufrufer hat den Weg — oder eine ausdrückliche, sichtbare Ausnahme", () => {
    const blind = AUFRUFER.filter((p) => {
      if (bauteilHoltSelbst(p.bauteil)) {
        return false; // Das Bauteil holt ihn selbst → er erreicht diesen Aufrufer ohne dessen Zutun.
      }
      if (PROP_MUSTER.test(p.einbinder.quelle)) {
        return false; // Der Aufrufer reicht ihn herein (der alte Weg) → vorhanden, aber vergesslich.
      }
      return !AUSNAHME_MUSTER.test(p.einbinder.roh);
    }).map(schluessel);

    expect(
      blind,
      "Diese Flächen binden einen Editor ein, auf dem man ein Bild einsetzen kann, und haben " +
        "keinen Weg zur Bildbeschreibung — ohne dass irgendetwas rot wird. Soll eine Fläche sie " +
        "fachlich nicht anbieten, gehört das als `KEINE-BILDBESCHREIBUNG: <Grund>` in den Code.",
    ).toEqual([]);
  });

  it("kein Aufrufer verdrahtet den describe-Aufruf selbst (kein zweiter, dritter, vierter Weg)", () => {
    const eigenbau = AUFRUFER.filter((p) => EIGENER_AUFRUF.test(p.einbinder.quelle)).map(
      schluessel,
    );
    expect(
      eigenbau,
      "Genau hieran ist mega50 entstanden: derselbe sechszeilige Verdrahtungsblock stand zweimal " +
        "im Produktcode. Zwei Kopien sind zwei Wahrheiten; die dritte und vierte fehlten ganz.",
    ).toEqual([]);
  });
});

describe("mega50 Block B: die eine Quelle ist montiert und fail-closed", () => {
  it("der Weg wird in der App-Wurzel montiert (und nicht je Fläche nachgebaut)", () => {
    const wurzel = ALLE_QUELLEN.find((f) => f.datei === APP_WURZEL);
    expect(wurzel, `${APP_WURZEL} nicht gefunden`).toBeDefined();
    // Auf den Wahrheitswert geprüft und nicht auf die Quelle: sonst druckt ein roter Lauf die
    // gesamte Datei in den Bericht und begräbt die eigentliche Aussage.
    expect(
      /<\s*ImageDescribeProvider[\s/>]/.test(wurzel?.quelle ?? ""),
      `${APP_WURZEL} montiert den Weg zur Bildbeschreibung nicht`,
    ).toBe(true);
  });

  it("der Zugriff auf den Weg wirft ohne Provider (Bauform von useModalBoundary/useRole)", () => {
    const modul = ALLE_QUELLEN.find((f) => f.datei === WEG_MODUL);
    expect(modul, `${WEG_MODUL} nicht gefunden`).toBeDefined();
    // Fail-closed statt fail-open: eine Fläche mit Bildern ohne Weg darf gar nicht erst entstehen.
    // Dass der Wurf zur LAUFZEIT wirklich passiert, belegt der gemountete Pflichtvertrag-Fall.
    expect(
      /export function useImageDescribe[\s\S]*?throw new Error\(/.test(modul?.quelle ?? ""),
      `${WEG_MODUL} lässt den Zugriff ohne Provider durch (fail-open)`,
    ).toBe(true);
  });
});
