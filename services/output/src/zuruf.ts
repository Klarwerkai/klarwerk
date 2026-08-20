// ================================================================================================
// KA6 STUFE 1 · SCHREIBEN AUF ZURUF — DIE ERZEUGUNG, DIE NICHTS SCHREIBT.
// ================================================================================================
//
// OFFEN.md, KA6 im Wortlaut: „das Ergebnis erscheint IMMER als Vorschlag im Panel und wird erst auf
// Klick eingefuegt … Klara schreibt NIE selbsttaetig ins Dokument."
//
// DIESE DATEI IST DIE SERVERSEITE DIESER ZUSAGE, und sie haelt sie auf die einzige Art, die
// tragfaehig ist: **Der Server kann gar nicht schreiben.** Er gibt einen `ZurufVorschlag` zurueck —
// eine Zeichenkette und ihre Herkunft. Es gibt in diesem Modul keinen Rueckgabewert, kein Feld und
// keinen Seiteneffekt, der ein Dokument veraendert; auch keinen, der das Panel dazu anweisen
// koennte. Wer hier einen Schreibweg einbauen wollte, muesste die Signatur aendern, und dann roetet
// `ka6-zuruf.test.ts`.
//
// WARUM DAS NICHT NUR EINE KONVENTION IST: Eine Zusage der Form „das Panel schreibt erst auf Klick"
// haengt allein am Panel. Ein zweiter Aufrufer — ein Skript, ein Test, ein spaeterer Endpunkt —
// haette sie umgehen koennen. Liegt die Grenze dagegen im Erzeuger, gilt sie fuer JEDEN Aufrufer.
//
// DREI WEITERE GRENZEN, alle aus dem Bestand uebernommen und nicht neu erfunden:
//
//   1. OHNE EINWILLIGUNG KEIN EXTERNER AUFRUF (KA4). Fehlt sie, wird `Formulierer.formuliere`
//      NICHT gerufen — nicht „mit leerem Text", nicht „mit Platzhalter": gar nicht. Der Dienst
//      verhaelt sich dann bytegleich wie vor diesem Bau, weil er denselben Weg nimmt wie ein
//      Aufruf, den es nicht gibt.
//   2. VERTRAULICHES WIRD ABGESTREIFT, bevor irgendetwas nach draussen geht — mit `dropConfidential`
//      (`knowledge-object/src/confidentiality.ts:49`), demselben Egress-Filter, den `ask` und der
//      Output-Export benutzen. Kein zweites Praedikat.
//   3. HERKUNFT IST PFLICHT, nicht Zierde. Jeder Vorschlag traegt `aiGenerated` — dasselbe Feld,
//      an dem `mega81-ki-kennzeichnung-am-verhalten.test.ts` die Anzeige der KI-Behauptung
//      festmacht — und die Liste der validierten Quellen, auf die er sich stuetzt.
//
// ZUM VERHAELTNIS ZU `service.ts`: Der OutputService erzeugt GANZE Dokumente aus validierten KOs.
// Der Zuruf erzeugt eine PASSAGE zu einem Text, den der Mensch mitbringt. Beide teilen den
// Vertraulichkeitsfilter und die Herkunftsform (`OutputProvenance`), aber nicht den Rumpf: ein Zuruf
// hat keinen Exportkopf und keinen Adressaten. Deshalb eine eigene Datei und kein Zweig in
// `generate()`.

import {
  type Confidentiality,
  type KnowledgeObject,
  type KoService,
  dropConfidential,
} from "../../knowledge-object";
import { toProvenance } from "./render";
import type { OutputProvenance } from "./types";

/**
 * Die drei Zurufe. Die Namen sind dieselben wie die Textschluessel der Flaeche
 * (`ka6ZurufVervollstaendigen`, `ka6AuftragUmformulieren` … in `taskpane.html`), damit Panel und
 * Server dieselbe Sache gleich nennen.
 */
export type ZurufArt = "erstellen" | "vervollstaendigen" | "umformulieren";

export const ZURUF_ARTEN: readonly ZurufArt[] = ["erstellen", "vervollstaendigen", "umformulieren"];

export type ZurufFehlerCode =
  /** KA4: keine gueltige Einwilligung fuer dieses Dokument. */
  | "CONSENT_MISSING"
  /** Weder markierter Text noch Themenangabe — es gibt nichts zu formulieren. */
  | "NO_INPUT"
  /** Unbekannter Zuruf. */
  | "UNKNOWN_ART"
  /** Kein Formulierer verdrahtet — der Dienst kann in dieser Aufstellung nichts erzeugen. */
  | "NO_FORMULIERER"
  /** Der Formulierer lieferte nichts Brauchbares. Erfunden wird nichts. */
  | "NO_BASIS";

export class ZurufError extends Error {
  readonly code: ZurufFehlerCode;
  constructor(code: ZurufFehlerCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ZurufError";
  }
}

/**
 * Der externe Formulierer. Bewusst eine schmale Schnittstelle und eine INJIZIERTE Abhaengigkeit —
 * genau wie `koService` in `OutputService`: Damit ist im Test beweisbar, ob er gerufen wurde, und
 * der Dienst bindet keinen Anbieter.
 */
export interface Formulierer {
  formuliere(auftrag: ZurufAuftrag): Promise<string>;
}

/** Was dem Formulierer uebergeben wird — und sonst nichts. */
export interface ZurufAuftrag {
  art: ZurufArt;
  /** Der Text des Menschen: markierte Passage oder Themenangabe. */
  text: string;
  /**
   * Belegstellen aus validierten, NICHT vertraulichen Wissensobjekten. Kann leer sein; dann
   * formuliert der Zuruf ohne Bestandsbezug und sagt genau das ueber `herkunft`.
   */
  belege: readonly ZurufBeleg[];
}

export interface ZurufBeleg {
  koId: string;
  title: string;
  text: string;
}

export interface ZurufEingabe {
  art: ZurufArt;
  text: string;
  /** KA4-Einwilligung fuer GENAU dieses Dokument. Fehlt sie, geht nichts nach draussen. */
  einwilligung: boolean;
  /** Optionale Auswahl validierter Quellen, auf die sich der Vorschlag stuetzen soll. */
  koIds?: readonly string[];
}

/**
 * Das Ergebnis eines Zurufs.
 *
 * **Es gibt hier absichtlich kein Feld, das eine Schreibung ausdrueckt** — kein `insert`, kein
 * `apply`, kein `target`, keine Position. Der Vorschlag ist Text plus Herkunft. Was damit geschieht,
 * entscheidet der Mensch am Panel.
 */
export interface ZurufVorschlag {
  art: ZurufArt;
  /** Der Formulierungsvorschlag. Reiner Text, keine Anweisung. */
  vorschlag: string;
  /**
   * `true`, sobald der Text von einem Modell formuliert wurde. Dasselbe Feld, das die Anzeige der
   * KI-Kennzeichnung traegt (siehe `tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts`).
   */
  aiGenerated: boolean;
  /**
   * `bestand` — der Vorschlag stuetzt sich auf validierte Wissensobjekte, die in `provenance`
   * stehen. `frei` — er tut es nicht; dann ist er reine KI-Formulierung ohne Bestandsbezug.
   */
  herkunft: "bestand" | "frei";
  /** Die validierten Quellen, in der Form, die der Output-Export schon benutzt. */
  provenance: OutputProvenance[];
  /** Erzeugungszeitpunkt, ISO — wie in `OutputDocument`. */
  generatedAt: string;
}

export interface ZurufServiceDeps {
  koService: KoService;
  /** Fehlt er, gibt es keinen Weg nach draussen — der Dienst antwortet `NO_FORMULIERER`. */
  formulierer?: Formulierer;
  now?: () => number;
}

export class ZurufService {
  private readonly koService: KoService;
  private readonly formulierer: Formulierer | undefined;
  private readonly now: () => number;

  constructor(deps: ZurufServiceDeps) {
    this.koService = deps.koService;
    this.formulierer = deps.formulierer;
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Erzeugt einen Vorschlag — und schreibt nichts.
   *
   * Die Reihenfolge der Pruefungen ist Teil der Zusage: **Die Einwilligung wird geprueft, BEVOR
   * irgendetwas eingesammelt wird.** Ohne sie beruehrt dieser Aufruf weder den KO-Bestand noch den
   * Formulierer.
   */
  async schlageVor(eingabe: ZurufEingabe): Promise<ZurufVorschlag> {
    if (!ZURUF_ARTEN.includes(eingabe.art)) {
      throw new ZurufError("UNKNOWN_ART", `Unbekannter Zuruf: ${eingabe.art}.`);
    }

    // KA4 zuerst. Kein Bestandszugriff, kein externer Aufruf, kein Nebeneffekt ohne Einwilligung.
    if (!eingabe.einwilligung) {
      throw new ZurufError(
        "CONSENT_MISSING",
        "Ohne Einwilligung fuer dieses Dokument wird nichts formuliert und nichts gesendet.",
      );
    }

    const text = eingabe.text.trim();
    if (text.length === 0) {
      throw new ZurufError(
        "NO_INPUT",
        "Kein markierter Text und keine Themenangabe — es gibt nichts zu formulieren.",
      );
    }

    if (!this.formulierer) {
      throw new ZurufError(
        "NO_FORMULIERER",
        "Kein Formulierer verdrahtet — dieser Dienst kann derzeit keinen Vorschlag erzeugen.",
      );
    }

    const quellen = await this.sammleQuellen(eingabe.koIds ?? []);

    const auftrag: ZurufAuftrag = {
      art: eingabe.art,
      text,
      // `statement` ist die Plaintext-Kurzfassung, die auch Output, Ask und Suche lesen
      // (`knowledge-object/src/types.ts:193`) — kein `bodyHtml`, damit nichts Ausgezeichnetes
      // in einen Formulierungsauftrag geraet.
      belege: quellen.map((ko) => ({ koId: ko.id, title: ko.title, text: ko.statement })),
    };

    const roh = await this.formulierer.formuliere(auftrag);
    const vorschlag = roh.trim();
    if (vorschlag.length === 0) {
      // Erfunden wird nichts — dieselbe Haltung wie `ka6NoBasis` auf der Flaeche.
      throw new ZurufError(
        "NO_BASIS",
        "Kein Vorschlag: Es gibt dazu keine belastbare Grundlage. Erfunden wird nichts.",
      );
    }

    return {
      art: eingabe.art,
      vorschlag,
      aiGenerated: true,
      herkunft: quellen.length > 0 ? "bestand" : "frei",
      provenance: quellen.map(toProvenance),
      generatedAt: new Date(this.now()).toISOString(),
    };
  }

  /**
   * Holt die gewaehlten Quellen und laesst nur durch, was ein Zuruf sehen darf: **validiert** und
   * **nicht vertraulich**.
   *
   * Unbekannte oder nicht validierte Kennungen sind hier KEIN Fehler, sondern werden ausgelassen —
   * anders als in `OutputService.generate`, und das ist Absicht: Ein Export steht und faellt mit
   * seiner Quellenliste, ein Formulierungsvorschlag nicht. Er wird dann eben `frei` statt
   * `bestand` — und sagt das im Ergebnis.
   */
  private async sammleQuellen(koIds: readonly string[]): Promise<KnowledgeObject[]> {
    if (koIds.length === 0) {
      return [];
    }
    const gefunden: KnowledgeObject[] = [];
    for (const id of koIds) {
      const ko = await this.koService.get(id);
      if (ko && ko.status === "validiert") {
        gefunden.push(ko);
      }
    }
    // SCRUM-502: derselbe Egress-Filter wie ueberall. Vertrauliches geht nicht nach draussen.
    return dropConfidential<KnowledgeObject & { confidentiality?: Confidentiality | null }>(
      gefunden,
    );
  }
}
