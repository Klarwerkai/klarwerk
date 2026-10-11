// ================================================================================================
// JOB B4-INSEL-RELEASE · RUNDE 2 — DAS URTEIL ÜBER DEN GESPEICHERTEN BESTAND, OHNE BROWSER.
// ================================================================================================
//
// BENS BEFUND (Runde 1): Die Bestandsprüfung verlangte vom Dokumenttext nur den EINEN Satz
// `DOKUMENTSATZ`. Ein Befund mit ausschließlich diesem Absatz und leerem Titel ging als vollständig
// durch, und nach K3/K4 wurde kein vollständiger Text mit dem Stand aus K2 verglichen. Das war eine
// Lücke im Nachweis „unveränderte, vollständige Inhalte".
//
// DESHALB ZWEI URTEILE, beide hier und beide ohne Playwright — damit die Gegenproben dazu
// (`bestandsurteil.test.ts`) im gewöhnlichen Tor laufen und nicht nur im Integrationslauf:
//
//   bestandsmaengel   Ist der Eintrag VOLLSTÄNDIG? Nicht leerer Titel, JEDER Absatz der Prüfdatei
//                     im Rumpf, der Quellenvermerk, die heruntergeladene Originaldatei mit dem
//                     Abdruck genau der Bytes, die hineingingen.
//   bestandsvergleich Ist er UNVERÄNDERT gegenüber dem in K2 festgestellten Bestand? Titel,
//                     vollständiger Rumpftext, Quellenvermerk, Adresse und Abdruck der Originaldatei.
import type { Absatz } from "../m5-docx-bildunterschriften/docx-bauen";

/** Die eigene synthetische Prüfdatei: echte .docx-Bytes mit Sätzen, die nur in ihr stehen. */
export const DATEI_NAME = "inselprobe-stellwerk.docx";
export const ERSTER_SATZ =
  "Diese Anweisung regelt den Wechsel der Inselanlage auf eine neue Fassung.";
export const ZWEITER_SATZ = "Der Betreiber spielt das Paket ueber den dokumentierten Weg ein.";
export const KENNWORT = "Stellwerkprobe4B";
export const DOKUMENTSATZ = `Vor dem Umschalten sichert das ${KENNWORT} den Bestand mit Pruefsumme.`;

/** JEDER Absatz der Prüfdatei — und damit jeder Satz, der nach Update und Rückfall da sein muss. */
export const ABSATZTEXTE: readonly string[] = [ERSTER_SATZ, ZWEITER_SATZ, DOKUMENTSATZ];

export const ABSAETZE: readonly Absatz[] = ABSATZTEXTE.map(
  (text): Absatz => ({ art: "text", text }),
);

/** Was ein Mensch am gespeicherten Eintrag liest — und die Datei, die er herunterlädt. */
export interface Bestandsbefund {
  readonly adresse: string;
  readonly angemeldet: boolean;
  readonly titel: string;
  readonly text: string;
  readonly quelle: string;
  readonly originalHref: string;
  readonly download: {
    readonly name: string;
    readonly sha256: string;
    readonly bytes: number;
  } | null;
  readonly downloadFehler: string;
  readonly inselmarke: string;
}

export interface Bestandserwartung {
  /** Die Quellenzeile, wie der Rumpfbauer des Produkts sie schreibt. */
  readonly quellenzeile: string;
  /** Der Abdruck der Prüfdatei, die hochgeladen wurde. */
  readonly dateiSha256: string;
}

/** Leer heisst: Titel, jeder Absatz, Quellenbezug und Originaldatei sind vollständig da. */
export function bestandsmaengel(befund: Bestandsbefund, e: Bestandserwartung): string[] {
  const maengel: string[] = [];
  if (!befund.angemeldet) {
    maengel.push(`${befund.adresse}: der Eintrag erscheint nicht (kein bib-text)`);
  }
  if (befund.titel.trim() === "") {
    maengel.push("Titel: leer");
  }
  for (const satz of ABSATZTEXTE) {
    if (!befund.text.includes(satz)) {
      maengel.push(`Inhalt: der Absatz «${satz}» fehlt im Rumpf`);
    }
  }
  if (!befund.quelle.includes(e.quellenzeile)) {
    maengel.push(`Quellenbezug: «${e.quellenzeile}» fehlt (gelesen: «${befund.quelle}»)`);
  }
  if (befund.download === null) {
    maengel.push(`Originaldatei: ${befund.downloadFehler}`);
  } else if (befund.download.sha256 !== e.dateiSha256) {
    maengel.push(
      `Originaldatei: heruntergeladen ${befund.download.bytes} Bytes mit anderem Abdruck (${befund.download.sha256})`,
    );
  }
  return maengel;
}

/**
 * Leer heisst: der Eintrag liest sich GENAU wie beim ersten Wiederlesen (K2). Verglichen wird der
 * vollständige Rumpftext — ein fehlender, ein zusätzlicher oder ein veränderter Absatz schlägt an.
 * Die Inselmarke gehört nicht dazu: sie nennt die laufende Fassung und SOLL sich ändern.
 */
export function bestandsvergleich(referenz: Bestandsbefund, jetzt: Bestandsbefund): string[] {
  const unterschiede: string[] = [];
  const feld = (name: string, vorher: string, nachher: string) => {
    if (vorher !== nachher) {
      unterschiede.push(`${name}: vorher «${vorher}», jetzt «${nachher}»`);
    }
  };
  feld("Titel", referenz.titel, jetzt.titel);
  feld("Rumpftext", referenz.text, jetzt.text);
  feld("Quellenvermerk", referenz.quelle, jetzt.quelle);
  feld("Link der Originaldatei", referenz.originalHref, jetzt.originalHref);
  feld(
    "Abdruck der Originaldatei",
    referenz.download?.sha256 ?? "(kein Download)",
    jetzt.download?.sha256 ?? "(kein Download)",
  );
  return unterschiede;
}
