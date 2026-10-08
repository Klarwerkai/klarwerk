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
//   1. OHNE BESTAETIGTE EINWILLIGUNG KEIN EXTERNER AUFRUF (KA4). Fehlt sie, wird
//      `Formulierer.formuliere` NICHT gerufen — nicht „mit leerem Text", nicht „mit Platzhalter":
//      gar nicht. ENTSCHIEDEN WIRD DAS NICHT HIER (JOB 3026, KA6 Stufe 2): dieses Modul FRAGT
//      ueber den Port `Ka6Einwilligungspruefer` das serverseitige Sitzungstor
//      (`KlaraSessionService.pruefeExterneAusfuehrung`) und wertet allein dessen Antwort aus; eine
//      zweite Auslegung der Regel an dieser Stelle waere genau der Fehler, den
//      `ask-routes.ts:120-124` benennt. Ein Aufrufer kann die Einwilligung deshalb nicht mehr
//      BEHAUPTEN: `ZurufEingabe` hat kein Feld dafuer, sondern nur die Bindung, mit der gefragt
//      wird.
//   2. VERTRAULICHES WIRD ABGESTREIFT, bevor irgendetwas nach draussen geht — mit `dropConfidential`
//      (`knowledge-object/src/confidentiality.ts:49`), demselben Egress-Filter, den `ask` und der
//      Output-Export benutzen. Kein zweites Praedikat.
//   3. HERKUNFT IST PFLICHT, nicht Zierde. Jeder Vorschlag traegt `aiGenerated` — dasselbe Feld,
//      an dem `mega81-ki-kennzeichnung-am-verhalten.test.ts` die Anzeige der KI-Behauptung
//      festmacht — und die Liste der validierten Quellen, auf die er sich stuetzt. Seit JOB 3091
//      (M2, Memo im Word-Panel) auch WER formuliert hat: `anbieter` und `modell` kommen aus der
//      Aufloesung, gegen die das Sitzungstor die Einwilligung geprueft hat — nicht aus einem
//      Feld des Aufrufers. Die erste HTTP-Route auf diesen Dienst ist
//      `POST /api/klara/sessions/{id}/zuruf` (`services/app/src/routes/klara-session-routes.ts`);
//      sie serialisiert nur und entscheidet nichts.
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
import { type AuditLeser, pruefnachweiseFuer } from "./pruefnachweis";
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
  /**
   * gesamt-dokumenterzeugung (R-0349/R-0414, Nacharbeit 7): die Marke dieses Belegs („Q1" …) —
   * dieselbe wie in `provenance[].marke`. Der Formulierer setzt sie hinter jeden Absatz, der sich
   * auf den Beleg stützt; der Erzeuger liest sie daraus zurück (`passagenAus`).
   */
  marke: string;
}

/**
 * Eine Passage des Vorschlags und die Marken der Belege, auf die sie sich stützt. `marken` leer
 * heißt: der Formulierer hat für diese Passage KEINE (gültige) Quelle genannt — das wird am Panel
 * ausdrücklich so gekennzeichnet, nicht einer Quelle zugeschlagen.
 */
export interface ZurufPassage {
  text: string;
  marken: string[];
}

/** `[Q1]`, `[Q1, Q2]` — die Belegmarken, die der Formulierer setzen soll. */
const ZURUF_MARKE_RE = /\[(Q\d+(?:\s*,\s*Q\d+)*)\]/g;

/**
 * Zerlegt den Vorschlag in Passagen (eine je nichtleerer Zeile) und liest je Passage die
 * Belegmarken heraus. Nur Marken, die es wirklich gibt (`Q1` … `Q<anzahl>`), zählen; eine erfundene
 * Marke wird verworfen und lässt die Passage ohne Quellenbezug, statt eine Zuordnung zu behaupten.
 */
export function passagenAus(vorschlag: string, anzahlQuellen: number): ZurufPassage[] {
  const raus: ZurufPassage[] = [];
  for (const zeile of vorschlag.split(/\r?\n/)) {
    const roh = zeile.trim();
    if (roh.length === 0) {
      continue;
    }
    const marken: string[] = [];
    const text = roh
      .replace(ZURUF_MARKE_RE, (_treffer: string, gruppe: string) => {
        for (const teil of gruppe.split(",")) {
          const nummer = Number(teil.trim().slice(1));
          const marke = `Q${nummer}`;
          if (nummer >= 1 && nummer <= anzahlQuellen && !marken.includes(marke)) {
            marken.push(marke);
          }
        }
        return "";
      })
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text.length > 0) {
      raus.push({ text, marken });
    }
  }
  return raus;
}

/**
 * Die Bindung, an der die KA4-Einwilligung haengt — Sitzung, Mensch, Add-in-Instanz und Dokument.
 *
 * Sie ist der ERSATZ fuer das frueher hier stehende `einwilligung: boolean` (JOB 3026). Ein
 * Aufrufer bringt damit keine Erlaubnis mehr mit, sondern nur die vier opaken Kennungen, unter
 * denen das Sitzungstor nachsehen kann. Alle vier sind Pflicht und muessen Inhalt haben: eine
 * unvollstaendige Bindung deckt nie eine Einwilligung, deshalb wird bei ihr gar nicht erst
 * gefragt.
 */
export interface ZurufBindung {
  sessionId: string;
  actorId: string;
  addinInstanceId: string;
  documentContextId: string;
}

/**
 * DER PORT ZUM SITZUNGSTOR — die Regel reist als Frage herein, nicht als Import.
 *
 * Strukturgleich zu `Ka4Freigabepruefer` (`services/app/src/routes/ask-routes.ts:165-180`) und
 * ABSICHTLICH NICHT von dort importiert: `output` duerfte `app` nicht kennen. Modulgrenzen laufen
 * in diesem Haus nur ueber `index.ts`, und eine Kante `output -> app` gaebe es nicht —
 * `dependency-cruiser` verboete sie zu Recht. Dasselbe Muster hat JOB 3023 fuer
 * `library-analytics -> conflicts` entschieden.
 *
 * WAS HIER AUSDRUECKLICH NICHT ENTSTEHT: eine zweite Auslegung der Einwilligungsregel. Dieser Port
 * ENTSCHEIDET nichts, er FRAGT. Ob eine Zustimmung traegt, entscheidet allein
 * `KlaraSessionService.pruefeExterneAusfuehrung` — dieselbe Pruefung, die die Bindungen einzeln
 * vergleicht, frisch liest und nicht deckende Zustimmungen entwertet.
 */
export interface Ka6Einwilligungspruefer {
  pruefeExterneAusfuehrung(
    sessionId: string,
    bindung: { actorId: string; addinInstanceId: string; documentContextId: string },
  ): Promise<{
    readonly erlaubt: boolean;
    readonly grund?: string;
    /**
     * JOB 3091 (KA6 Panelhaelfte): die Aufloesung, GEGEN DIE das Tor geprueft hat — daraus nimmt der
     * Vorschlag Anbieter und Modell. Sie kommt vom Tor, nicht vom Aufrufer: dieselbe Auflösung, an
     * die die Zustimmung gebunden ist (`KlaraAusfuehrungsfreigabe.resolution`), nennt den Empfaenger,
     * der ausfuehrt. Ein Feld, das der Aufrufer selbst fuellte, waere ein zweiter Client-Wert.
     * Optional, weil aeltere Tor-Attrappen es nicht tragen — dann bleibt der Vorschlag ehrlich
     * ohne Anbieterangabe (`null`), nie mit einem Ersatzwert.
     */
    readonly resolution?: { readonly provider: string; readonly model: string };
    /**
     * Auftrag gesamt-ki-einwilligung (Bens B3, Runde 2): der externe Anbieter, dem die Zustimmung
     * gilt (`openai`/`anthropic`). Dieser Dienst liest ihn nicht; die Route bindet damit den Lauf
     * des Formulierers an genau diesen Anbieter.
     */
    readonly anbieter?: string;
    /** Lauf 2 · Bens B5: gilt die tragende Zustimmung noch? Die Route bindet den Lauf daran. */
    readonly giltNoch?: () => boolean;
  }>;
}

export interface ZurufEingabe {
  art: ZurufArt;
  text: string;
  /**
   * Wonach das Sitzungstor gefragt wird. **Kein Feld dieser Eingabe drueckt eine Einwilligung
   * aus** — wer eine behaupten wollte, faende keinen Platz dafuer.
   */
  bindung: ZurufBindung;
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
  /**
   * Die validierten Quellen, in der Form, die der Output-Export schon benutzt — mit allen
   * Pflichtangaben, das Prüfdatum aus dem geprüften Validierungsnachweis (Nacharbeit 7).
   */
  provenance: OutputProvenance[];
  /** R-0349/R-0414 (Nacharbeit 7): der Vorschlag je Passage, mit den Marken ihrer Quellen. */
  passagen: ZurufPassage[];
  /** Erzeugungszeitpunkt, ISO — wie in `OutputDocument`. */
  generatedAt: string;
  /**
   * JOB 3091: WER formuliert hat — Anbieter und Modell aus der Aufloesung, gegen die das Sitzungstor
   * die Einwilligung geprueft hat (`Ka6Einwilligungspruefer.resolution`). Das ist die Herkunft der
   * Formulierung, so wie `provenance` die Herkunft der Sachaussagen ist; ohne sie stuende am Panel
   * „KI-formuliert" ohne Empfaenger. `null`, wenn das Tor keine Aufloesung mitgab — dann steht auch
   * am Panel „unbekannt", kein Ersatzname (JOB 3036: ein Modellname entsteht nur aus dem Lauf).
   */
  anbieter: string | null;
  modell: string | null;
}

export interface ZurufServiceDeps {
  koService: KoService;
  /** Fehlt er, gibt es keinen Weg nach draussen — der Dienst antwortet `NO_FORMULIERER`. */
  formulierer?: Formulierer;
  /**
   * Das Sitzungstor. Fehlt es, ist der Riegel ZU — nicht offen: ohne befragbares Tor gibt es keine
   * bestaetigte Einwilligung. Injiziert wie `formulierer`, damit im Test messbar ist, OB und
   * WOMIT gefragt wurde.
   */
  einwilligungspruefer?: Ka6Einwilligungspruefer;
  now?: () => number;
  /**
   * gesamt-dokumenterzeugung (R-0337, Nacharbeit 7): derselbe Leseweg zum Validierungsnachweis wie
   * im `OutputService`. Fehlt er, steht das Prüfdatum als „nicht belegt" da — nie als Annahme.
   */
  audit?: AuditLeser;
}

export class ZurufService {
  private readonly koService: KoService;
  private readonly formulierer: Formulierer | undefined;
  private readonly einwilligungspruefer: Ka6Einwilligungspruefer | undefined;
  private readonly now: () => number;
  private readonly audit: AuditLeser | undefined;

  constructor(deps: ZurufServiceDeps) {
    this.koService = deps.koService;
    this.formulierer = deps.formulierer;
    this.einwilligungspruefer = deps.einwilligungspruefer;
    this.now = deps.now ?? (() => Date.now());
    this.audit = deps.audit;
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
    const freigabe = await this.einwilligungLiegtVor(eingabe.bindung);
    if (!freigabe) {
      // DERSELBE FESTE SATZ WIE BISHER, und kein Wort mehr: Der `grund` des Sitzungstors bleibt im
      // Erzeuger. Dieselbe Metadata-only-Haltung wie `ask-routes.ts:196-198` — die Kennungen sind
      // opak, und eine Meldung, die sie oder ihren Ablehnungsgrund weiterreichte, waere eine
      // Verknuepfungsspur ueber Dokumente hinweg.
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
      belege: quellen.map((ko, i) => ({
        koId: ko.id,
        title: ko.title,
        text: ko.statement,
        marke: `Q${i + 1}`,
      })),
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

    const pruefungen = await pruefnachweiseFuer(this.audit, quellen);
    return {
      art: eingabe.art,
      vorschlag,
      aiGenerated: true,
      herkunft: quellen.length > 0 ? "bestand" : "frei",
      provenance: quellen.map((ko, i) =>
        toProvenance(ko, { marke: `Q${i + 1}`, pruefung: pruefungen[i] ?? { zustand: "MISSING" } }),
      ),
      passagen: passagenAus(vorschlag, quellen.length),
      generatedAt: new Date(this.now()).toISOString(),
      anbieter: freigabe.anbieter,
      modell: freigabe.modell,
    };
  }

  /**
   * Liegt fuer GENAU dieses Dokument eine bestaetigte Einwilligung vor?
   *
   * FAIL-CLOSED IN JEDER RICHTUNG. Es gibt hier keinen Zweig, in dem ein unklarer Zustand zur
   * Freigabe fuehrt: unvollstaendige Bindung, kein Tor, ein Tor ohne die Methode, ein geworfener
   * Fehler, `erlaubt: false`, eine Antwort ohne `erlaubt` — jeder dieser Faelle endet geschlossen.
   * Nur genau `erlaubt === true` oeffnet. Der geschlossene Zustand ist der Ruhezustand.
   *
   * Der bequeme Kurzschluss `if (!pruefer) return true` waere genau die Luecke, die dieser Bau
   * schliesst — er stuende hier fuer „unbekannt, also durchlassen".
   *
   * JOB 3091: Der Rueckgabewert ist kein Boolean mehr, sondern `null` (geschlossen) oder die
   * Freigabe mit Anbieter und Modell aus der Aufloesung des Tors. Die Regel selbst ist unveraendert:
   * offen ist es NUR bei genau `erlaubt === true`; Anbieter und Modell sind Beiwerk der Freigabe,
   * nie ihre Bedingung. Nennt das Tor keine Aufloesung, bleiben beide `null` — kein Ersatzwert.
   */
  private async einwilligungLiegtVor(
    bindung: ZurufBindung | undefined,
  ): Promise<{ anbieter: string | null; modell: string | null } | null> {
    const sessionId = (bindung?.sessionId ?? "").trim();
    const actorId = (bindung?.actorId ?? "").trim();
    const addinInstanceId = (bindung?.addinInstanceId ?? "").trim();
    const documentContextId = (bindung?.documentContextId ?? "").trim();
    if (!sessionId || !actorId || !addinInstanceId || !documentContextId) {
      // Gar nicht erst fragen: eine unvollstaendige Bindung kann keine Einwilligung decken, und
      // eine halbe Frage an das Sitzungstor waere eine Anfrage nach einer fremden Sitzung.
      return null;
    }
    const pruefer = this.einwilligungspruefer;
    if (!pruefer || typeof pruefer.pruefeExterneAusfuehrung !== "function") {
      return null;
    }
    try {
      const freigabe = await pruefer.pruefeExterneAusfuehrung(sessionId, {
        actorId,
        addinInstanceId,
        documentContextId,
      });
      if (freigabe?.erlaubt !== true) {
        return null;
      }
      const aufloesung = freigabe.resolution;
      const anbieter =
        typeof aufloesung?.provider === "string" && aufloesung.provider.trim().length > 0
          ? aufloesung.provider
          : null;
      const modell =
        typeof aufloesung?.model === "string" && aufloesung.model.trim().length > 0
          ? aufloesung.model
          : null;
      return { anbieter, modell };
    } catch {
      // Fremde/abgelaufene/geschlossene Sitzung wirft (NOT_FOUND/CONFLICT). Das ist eine Absage,
      // kein Serverfehler — genau wie bei `ka4Freigabe` (`ask-routes.ts:233-238`).
      return null;
    }
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
