import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  AskError,
  type AskService,
  GESPRAECHSFADEN_MAX_FRAGEN,
  answerEvidence,
  isGapPriority,
  redactGapForViewer,
} from "../../../ask";
import type { ConflictService } from "../../../conflicts";
import {
  GELTUNG_TEXT_MAX,
  type KnowledgeObject,
  type KoService,
  normalizeFragekontext,
} from "../../../knowledge-object";
import { can } from "../../../rbac";
import { bindeAnbieter, bindeZustimmung, imBindungsrahmen } from "../../../reasoner";
import { authorizesAsk } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type Guards, type SessionUser, sendError } from "../http";
import type { KlaraAufgabe } from "../services/klara-session-service";
// JOB 1591 D1 (W5): NUR gelesen — das bestehende Praedikat, kein zweites.
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// SCRUM-498 B1 (ben-Review): bewusste Eingabe-Härtung von POST /api/ask, definiert über die GÜLTIGE
// HÜLLE eines Requests:
//   - Body MUSS ein JSON-Objekt sein.
//   - question: optional; wenn vorhanden string, ≤ 8.000 Codepoints (ajv zählt Codepoints). Fehlt/leer/
//     null → Handler normalisiert auf "" → 200 (wie Parent e6abb25).
//   - locale: optional; string oder skalar-coercierbar; der Handler normalisiert auf de/en/nl.
//   - additionalProperties erlaubt.
//   - Gesamt-Body ≤ 128 KiB (sonst 413).
// Alles AUSSERHALB dieser Hülle → kontrolliertes 400 (413 bei Größe), nie 500. Gegenüber dem Parent
// bewusst gehärtet: nicht-objektförmiger Body, question > 8.000, locale nicht-coercierbar, Body > 128 KiB,
// fehlender Body (Crash-Fix). Kein legitimer Klara-Traffic ist davon betroffen.
const askBodySchema = {
  type: "object",
  properties: {
    question: { type: "string", maxLength: 8_000 },
    locale: { type: "string" },
    // WP-KLARA-ASK-FIX (bens Fix 1, P0): optionaler, SERVER-garantierter Modus. "retrieval-only"
    // erzwingt serverseitig: NUR validierte KOs als Grundlage, NULL Modell- und NULL Embedder-
    // Aufrufe (rein deterministisches Retrieval, Antwort = woertliche validierte Aussage +
    // Quellen, keine Synthese). Anderer Wert → Schema-400. Ohne Feld: Konsolen-Bestandsverhalten.
    mode: { type: "string", enum: ["retrieval-only"] },
    // R-0348 — DER GESPRÄCHSFADEN: die vorangegangenen Fragen derselben Fragestrecke, älteste
    // zuerst, je Frage dasselbe Maß wie `question`. Mehr als `GESPRAECHSFADEN_MAX_FRAGEN` ist 400
    // aus dem Schema. Wirksam NUR im Konsolenzweig (s. Handler); Add-on- und `retrieval-only`-Wege
    // lassen ihn liegen, ihre Egress-Verträge bleiben damit unverändert.
    thread: {
      type: "array",
      maxItems: GESPRAECHSFADEN_MAX_FRAGEN,
      items: { type: "string", maxLength: 8_000 },
    },
    // R-1633 — WOFÜR GEFRAGT WIRD: Werk, Schicht, Rolle (je optional, ≤ GELTUNG_TEXT_MAX). Wirkt
    // wie der Faden NUR im Konsolenzweig: es ordnet gleich relevante Quellen nach ihrer Geltung und
    // liefert die Auskunft `geltung`. Add-on- und Word-Wege lassen es liegen.
    fragekontext: {
      type: "object",
      properties: {
        werk: { type: "string", maxLength: GELTUNG_TEXT_MAX },
        schicht: { type: "string", maxLength: GELTUNG_TEXT_MAX },
        rolle: { type: "string", maxLength: GELTUNG_TEXT_MAX },
      },
      additionalProperties: false,
    },
  },
} as const;

// ================================================================================================
// R-0700 · DIE KLARA-FELDER GEHÖREN NICHT MEHR ZUM ALLGEMEINEN FRAGEWEG.
// ================================================================================================
//
// Bis hierher trug `POST /api/ask` neben `question`/`locale`/`mode`/`thread` auch `selection`,
// `selectionConfidentiality` und `questionSource` — Felder, die nur das Word-Seitenfenster schickt
// — und dazu die drei Bindungskopfzeilen `x-klara-*`. Der Originalauftrag (R-0700, KW-S4-24) sagt:
// Klara bekommt einen EIGENEN, an die Sitzung gebundenen Ausführungszugang, und der allgemeine
// Frageweg wird NICHT um Klara-Felder erweitert. Die Felder stehen deshalb hier, im Schema von
// `POST /api/klara/sessions/{sessionId}/execute` (`klaraAusfuehrungRoutes` unten). Der allgemeine
// Weg weist eine Anfrage mit Klara-Bindung oder Klara-Feldern ab (400 `KLARA_EIGENER_WEG`), statt
// sie still anders zu behandeln.
const klaraExecuteBodySchema = {
  type: "object",
  properties: {
    question: { type: "string", maxLength: 8_000 },
    locale: { type: "string" },
    // ============================================================================================
    // JOB 3006 (KA5) — DIE MARKIERTE PASSAGE. EIN EIGENES FELD, KEIN ZWEITER FRAGETEXT.
    // ============================================================================================
    //
    // Dasselbe Maß wie `question` (string, ≤ 8.000 Codepoints): ein längerer Wert ergibt 400 AUS DEM
    // SCHEMA, bevor der Handler ihn je sieht. Der Name ist bewusst englisch wie `question`, `locale`
    // und `mode` — ein Transportvertrag, eine Schreibweise.
    //
    // WAS DIESES FELD BEWIRKT UND WAS NICHT: Es schärft ausschließlich die lokale, lexikalische
    // Kandidatensuche (`AskService.ask` → `sucheterme`). Der markierte Dokumenttext erreicht KEIN
    // Modell, KEINEN Embedder, KEINEN Antwortkörper, KEINEN Auditeintrag, KEIN Protokoll und KEINE
    // Ablage — auch nicht mit gültiger KA4-Einwilligung. Der externe Zweig von KA5 (die dokument-
    // bezogene Antwort einer externen KI) ist seit F-0295 / R-0639 GEBAUT, aber hinter seinem
    // eigenen Riegel (`KLARA_DOCUMENT_TEXT_EGRESS_ENABLED`, AUS) und seiner eigenen Deckungsprüfung
    // (`dokumenttextFreigabe` unten). Ihn zu öffnen braucht eine eigene, ausdrückliche Entscheidung.
    selection: { type: "string", maxLength: 8_000 },
    // F-0295 / R-0639 — DIE STUFE DER MARKIERTEN PASSAGE, wie das Aufgabenfenster sie kennt.
    // Bewusst OHNE `enum`: ein unbekannter Wert ist kein 400, sondern zählt als vertraulich
    // (`markierungVertraulich`). Sie kann den Dokumenttext nur ZURÜCKHALTEN, nie freigeben — die
    // Freigabe entscheidet allein `pruefeDokumenttextFreigabe` im Sitzungsdienst.
    selectionConfidentiality: { type: "string" },
    // R-0639, BENS BEFUND B1 (Runde 1) — WOHER DER FRAGETEXT STAMMT.
    // Das Aufgabenfenster schickt die Word-Markierung auf zwei Wegen ALS `question` statt als
    // `selection`: „Klara fragen" bei leerem Eingabefeld (`prepareAskQuestion`, Lage `selection`)
    // und jeder Zuruf über einer Markierung (`ka6Absenden`). Dann IST die Frage Dokumenttext, und
    // die Klasse `question` deckt sie nicht. Das Fenster sagt es mit `questionSource: "selection"`.
    // Ohne `enum`. Mit Klara-Bindung ist NUR `manual` getippt — auch „fehlt" zählt dort als
    // Dokumenttext (Bens Befund B1, Runde 2: ältere Fenster melden nichts). Begründung an
    // `frageAusDokument`.
    questionSource: { type: "string" },
  },
} as const;

// Route-bodyLimit (bewusster milder Cap, runter von global 1 MiB): deckt eine escaped 8.000-Codepoint-
// Frage (roh bis ~96 KiB) plus Envelope/locale/moderate Extras. Bodies über 128 KiB liegen außerhalb der
// gültigen Hülle → kontrolliertes 413.
const ASK_BODY_LIMIT = 128 * 1024; // 128 KiB

// Request-lokal getragener Session-User (analog authContext): in preValidation aufgelöst, im Handler
// nur gelesen — kein zweiter Guard-Aufruf.
declare module "fastify" {
  interface FastifyRequest {
    askSessionUser?: SessionUser | null;
    // D5 (Lauf 5 Runde 2/3, Bens B1/B2): die Abschalt-Epoche beim EINGANG der Frage, festgehalten im
    // ersten globalen onRequest-Hook (`buildApp`) — vor jedem Anmelde-Hook und vor der Einwilligung.
    askKiBeginn?: number | null;
  }
}

// ================================================================================================
// AUFTRAG-mega34 BLOCK B1 — DER EVIDENZZUSTAND WIRD HIER ZUSAMMENGESETZT.
// ================================================================================================
//
// Die REGEL steht in services/ask/src/answer-evidence.ts. Diese Route beschafft nur ihre Eingaben:
// die Antwort (hat sie schon), die Quell-KOs und die offenen Konflikte. Beide Dienste liegen an der
// Kompositionswurzel ohnehin vor — das ist das Hausmuster (s. livewallRoutes, impactRoutes).
//
// FAIL-SAFE, ausdrücklich: reißt der Konfliktabruf ab, wird `null` weitergereicht — „unbekannt",
// nicht „keine". Ein Fehler im Konfliktdienst darf eine Antwort nicht zu stark aussehen lassen; er
// darf die Antwort aber auch nicht verhindern, denn die Antwort selbst ist bereits fertig.
//
// KEIN NEUER EGRESS: `ko.get` und `conflicts.unresolved()` sind bestehende, interne Lesewege,
// dieselben, die `GET /api/kos/:id` und `GET /api/conflicts` seit jeher benutzen.
export interface AskRouteDeps {
  ask: AskService;
  ko: KoService;
  conflicts: ConflictService;
  /**
   * KW-KA4: das bestehende Ausführungstor aus `services/klara-session-service.ts`.
   * R-0700: gelesen NUR vom eigenen Klara-Zugang (`klaraAusfuehrungRoutes`). Der allgemeine
   * Frageweg `POST /api/ask` fragt es nicht mehr — er nimmt keine Klara-Bindung an.
   */
  klaraSessions?: Ka4Freigabepruefer | undefined;
  /**
   * produkt:20261007:spaces — die Spaces mit Zugang „alle". Nur der Add-on-Zweig braucht sie: dort
   * gibt es keinen Sitzungsnutzer, also darf nur Inhalt ohne Space oder aus offenen Spaces Grundlage
   * werden. Fehlt die Quelle, fällt dort JEDES Objekt mit führendem Space weg (fail-closed).
   */
  offeneSpaces?: (() => Promise<ReadonlySet<string>>) | undefined;
  /**
   * R-1649: legt den abweichenden Weg aus „nicht hilfreich, ich habe es so gemacht …" als Entwurf
   * an. Eine schmale Funktion statt des Erfassungsdienstes (dieselbe Bauart wie `hilfreich` in
   * `ko-routes.ts`); die Composition-Root verdrahtet `CaptureService.createDraft`. Fehlt sie, wird
   * ein mitgeschickter Weg ehrlich mit 400 abgewiesen statt still verworfen.
   */
  alternativeAlsEntwurf?:
    | ((entwurf: { title: string; statement: string }, author: string) => Promise<{ id: string }>)
    | undefined;
}

// R-1649: Hülle von POST /api/ask/not-helpful — der abweichende Weg und der Titelvorschlag im selben
// Maß wie eine Frage (der Titel wird danach gekürzt). Geprüft im Handler, NACH dem Rechtetor (ein
// Fastify-Schema liefe davor und antwortete Unangemeldeten mit 400 statt 401).
interface NichtHilfreichRumpf {
  koId: string;
  receipt?: string;
  alternative?: string;
  entwurfTitel?: string;
}

function nichtHilfreichRumpf(roh: unknown): NichtHilfreichRumpf | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    return null;
  }
  const { koId, receipt, alternative, entwurfTitel } = roh as Record<string, unknown>;
  const text = (wert: unknown, max: number): boolean =>
    wert === undefined || (typeof wert === "string" && [...wert].length <= max);
  if (typeof koId !== "string" || koId.length === 0 || koId.length > 200) {
    return null;
  }
  // Der Beleg ist opak und wird vom Dienst geprüft; hier zählt nur, dass er Text ist.
  if (!text(receipt, Number.POSITIVE_INFINITY)) {
    return null;
  }
  if (!text(alternative, 8_000) || !text(entwurfTitel, 8_000)) {
    return null;
  }
  return {
    koId,
    ...(typeof receipt === "string" ? { receipt } : {}),
    ...(typeof alternative === "string" ? { alternative } : {}),
    ...(typeof entwurfTitel === "string" ? { entwurfTitel } : {}),
  };
}

// ================================================================================================
// KW-KA4-DOKUMENT-CONSENT — DIE EINWILLIGUNG JE DOKUMENT ENTSCHEIDET, NICHT DER CLIENT.
// ================================================================================================
//
// PEDIS WEICHE (Werkstattbeschluss 18.08.2026): „Externe KI mit Dokumenttext: JA, aber nie still.
// Je Dokument eine ausdrückliche Einwilligung … Vertraulich Markiertes bleibt IMMER draußen."
//
// WAS HIER STEHT UND WAS AUSDRÜCKLICH NICHT. Hier steht die ANWENDUNG des Tors, nicht das Tor
// selbst. Ob eine Zustimmung trägt, entscheidet allein `KlaraSessionService.pruefeExterneAusfuehrung`
// — dieselbe Prüfung, die neun Bindungen einzeln vergleicht (`klara-session-service.ts:243-261`),
// frisch liest, nicht deckende Zustimmungen entwertet und die Auflösung selbst befragt. Eine
// zweite Auslegung dieser Regel an dieser Stelle wäre genau der Fehler, den KW-S4-23 abstellt.
//
// DREI EIGENSCHAFTEN, die diesen Weg zu einer Sicherheitsgrenze machen:
//
//   1. FAIL-CLOSED IN JEDER RICHTUNG. Kein Dienst, fehlende Kopfzeile, leerer Wert, geworfener
//      Fehler, `erlaubt: false` — jeder dieser Fälle endet in der unveränderten Enge. Es gibt
//      keinen Zweig, in dem ein unklarer Zustand zur Freigabe führt.
//   2. DIE KOPFZEILEN AUTORISIEREN NICHT. Sie sind Lookup (`klara-ai-routes.ts:36-38`: „Die Werte
//      sind OPAK — der Server interpretiert sie nie, er prüft nur Gleichheit"). Wer fremde Werte
//      schickt, bekommt dieselbe Absage wie bei einer fremden Sitzung: der Dienst wirft `NOT_FOUND`,
//      und der Fang unten macht daraus eine Nichtfreigabe. Ein Client-Bool gibt es nicht und darf
//      es nie geben.
//   3. DER VERTRAULICHKEITSFILTER HÄNGT NICHT DARAN. `dropConfidential` läuft in
//      `services/ask/src/service.ts:275` VOR der Kandidatenauswahl und unabhängig von jeder
//      Option — er kann durch eine Freigabe strukturell nicht ausgeschaltet werden. Das ist keine
//      Zusage dieser Datei, sondern eine Eigenschaft des Bestands, und sie ist der Grund, warum
//      KA4 die Vertraulichkeit nicht eigens erzwingen muss.
//
// WAS DIE FREIGABE BEWIRKT — SEIT DEM 05.09.2026 WIRKLICH ETWAS (JOB 3079).
//
// Bis dahin stand hier: „nichts, und das ist richtig so". `KLARA_EXTERNAL_EXECUTION_MIGRATED`
// (`services/reasoner/src/klara-policy.ts`) stand auf `false`, jede externe Auflösung wurde mit
// `external_not_migrated` blockiert, und `pruefeExterneAusfuehrung` konnte gar kein `erlaubt: true`
// liefern. JOB 3033 hatte den Grund dafür in vier Sperrgründen festgehalten; JOB 3079 hat sie
// behoben (Frist, Empfänger, Nutzlastumfang, Panelvertrag — einzeln benannt im Kopf von
// `klara-policy.ts`) und den Schalter danach umgelegt. Der Zweig unten öffnet sich also jetzt
// wirklich, und dann läuft die Frage über den normalen Antwortweg — mit Modell.
//
// DIE ZWEI ZWEIGE UNTEN SIND DABEI UNVERÄNDERT GEBLIEBEN. Sie waren richtig und geprüft; ihnen
// fehlte nur die Freigabe, die sie öffnet. VIER Bedingungen gelten weiter, und jede für sich
// schliesst den Weg: eine Admin-Auswahl, die `external` ergibt; ein verdrahteter Cloud-Anbieter MIT
// Bezeichnung; eine Auflösung, die sich nicht selbst widerspricht (JOB 3079 R2: eine effektive
// Cloud-Bindung ohne beides ist `policy_incomplete` und wird gesperrt, nicht ausgeführt); und eine
// Einwilligung für GENAU diese Sitzung und GENAU dieses Dokument, die nicht älter als
// `KLARA_RESOLUTION_TTL_MS` ist.
//
// GEMESSEN, nicht behauptet: `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts` misst je
// Sperrgrund BEIDE Zustände des Schalters, `tests/klara-freigabe/` fährt die ganze Kette vom
// Consent über HTTP bis zu dem Satz, den der Mensch im Aufgabenfenster liest.

/** Die schmale Sicht auf das bestehende Tor — mehr braucht diese Route nicht zu kennen. */
export interface Ka4Freigabepruefer {
  pruefeExterneAusfuehrung(
    sessionId: string,
    bindung: { actorId: string; addinInstanceId: string; documentContextId: string },
    aufgabe?: KlaraAufgabe,
  ): Promise<{
    readonly erlaubt: boolean;
    readonly grund?: string;
    readonly anbieter?: string;
    readonly giltNoch?: () => boolean;
  }>;
  /**
   * F-0295 / R-0639 — die eigene Deckungsprüfung des markierten Dokumenttexts
   * (`KlaraSessionService.pruefeDokumenttextFreigabe`). OPTIONAL: ein Prüfer ohne sie gibt den
   * Dokumenttext nie frei (`dokumenttextFreigabe` unten).
   */
  pruefeDokumenttextFreigabe?(
    sessionId: string,
    bindung: { actorId: string; addinInstanceId: string; documentContextId: string },
    lage: { readonly vertraulich: boolean },
  ): Promise<{ readonly erlaubt: boolean; readonly grund?: string }>;
}

/**
 * Bens B3/B4 (Runde 2): das Ergebnis des Tors OHNE Verdichtung auf einen Boolean. `grund` erlaubt
 * der Route, die richtige Ursache zu nennen (B4); `anbieter` ist der externe Anbieter, an den der
 * anschliessende Lauf gebunden wird (B3, `bindeAnbieter`).
 */
export interface Ka4Entscheidung {
  readonly erlaubt: boolean;
  readonly grund?: string;
  readonly anbieter?: string;
  /** Lauf 2 · Bens B5: gilt die Zustimmung, auf die sich die Freigabe stützt, noch? */
  readonly giltNoch?: () => boolean;
}

// Dieselben Kopfzeilen wie der Klara-Sitzungsweg (`klara-ai-routes.ts:40-42`) — eine Schreibweise,
// kein zweiter Transportvertrag.
const KLARA_SESSION_HEADER = "x-klara-session";
const KLARA_INSTANCE_HEADER = "x-klara-instance";
const KLARA_DOCUMENT_HEADER = "x-klara-document";

function klaraKopf(headers: Record<string, unknown>, name: string): string {
  const wert = headers[name];
  return typeof wert === "string" ? wert.trim() : "";
}

/**
 * Darf dieser Ask die erzwungene Enge verlassen?
 *
 * PROTOKOLL AUSDRÜCKLICH METADATA-ONLY: geloggt werden Entscheidung und Grund — nie die Frage, nie
 * ein Dokumentinhalt, nie eine Kopfzeile. Die Kennungen sind zwar opak, aber ein Protokoll, das
 * sie mitschreibt, wäre eine Verknüpfungsspur über Dokumente hinweg; sie bleibt deshalb draußen.
 */
// JOB 2692 D1: exportiert, weil der Reasoner-Weg (`reasoner-routes.ts`) DENSELBEN Riegel braucht —
// eine zweite Auslegung dort wäre genau der Fehler, den der Kommentar oben benennt. `ereignis` ist
// nur der Protokollname; ohne Angabe bleibt der Ask-Weg byteweise wie vor 2692.
export async function ka4Freigabe(
  pruefer: Ka4Freigabepruefer | undefined,
  headers: Record<string, unknown>,
  actorId: string,
  log: { info: (obj: unknown, msg: string) => void },
  ereignis = "ask.ka4.dokument-consent",
  // Bens B3: die Aufgabe, die gleich ein Modell ruft. Die Zustimmung trägt nur Aufgaben, die an
  // denselben Anbieter gehen wie `answer` — entschieden im Tor, hier nur durchgereicht.
  aufgabe: KlaraAufgabe = "answer",
): Promise<boolean> {
  return (await ka4Entscheidung(pruefer, headers, actorId, log, ereignis, aufgabe)).erlaubt;
}

/** Dieselbe Prüfung wie `ka4Freigabe`, mit Grund und gebundenem Anbieter (Bens B3/B4). */
export async function ka4Entscheidung(
  pruefer: Ka4Freigabepruefer | undefined,
  headers: Record<string, unknown>,
  actorId: string,
  log: { info: (obj: unknown, msg: string) => void },
  ereignis = "ask.ka4.dokument-consent",
  aufgabe: KlaraAufgabe = "answer",
): Promise<Ka4Entscheidung> {
  const entscheidung = await ka4Pruefen(pruefer, headers, actorId, log, ereignis, aufgabe);
  // Bens B3 (Runde 2): DAS ERGEBNIS GILT FÜR DEN REST DER ANFRAGE, NICHT NUR FÜR DIESEN AUGENBLICK.
  // Eine Anfrage MIT Klara-Bindung hält es im Anfragerahmen fest (`bindeAnbieter`): bei Freigabe den
  // Anbieter, dem die Zustimmung gilt — der Reasoner lässt beim Kettenbau keinen anderen zu, auch
  // keinen, auf den nach dem Tor umgestellt wurde; bei Absage `null` — dann keinen. Ohne Rahmen
  // lässt sich eine Freigabe nicht an den Lauf binden, und dann gilt sie nicht (fail-closed).
  // Anfragen OHNE Klara-Bindung (Konsole) bleiben unberührt.
  if (!klaraBindungVorhanden(headers)) {
    return entscheidung;
  }
  if (!entscheidung.erlaubt) {
    bindeAnbieter(null);
    return entscheidung;
  }
  // Lauf 2 · Bens B5: auch die Zustimmung selbst wird gebunden — ein danach abgeschlossener Widerruf
  // nimmt den externen Anbieter aus der Kette und sperrt ihn vor der Übertragung.
  if (
    (entscheidung.giltNoch !== undefined && !bindeZustimmung(entscheidung.giltNoch)) ||
    (entscheidung.anbieter !== undefined && !bindeAnbieter(entscheidung.anbieter))
  ) {
    log.info({ ka4: { entscheidung: "blockiert", grund: "anbieterbindung_fehlt" } }, ereignis);
    return { erlaubt: false, grund: "anbieterbindung_fehlt" };
  }
  return entscheidung;
}

async function ka4Pruefen(
  pruefer: Ka4Freigabepruefer | undefined,
  headers: Record<string, unknown>,
  actorId: string,
  log: { info: (obj: unknown, msg: string) => void },
  ereignis: string,
  aufgabe: KlaraAufgabe,
): Promise<Ka4Entscheidung> {
  if (!pruefer || typeof pruefer.pruefeExterneAusfuehrung !== "function") {
    return { erlaubt: false };
  }
  const sessionId = klaraKopf(headers, KLARA_SESSION_HEADER);
  const addinInstanceId = klaraKopf(headers, KLARA_INSTANCE_HEADER);
  const documentContextId = klaraKopf(headers, KLARA_DOCUMENT_HEADER);
  if (!sessionId || !addinInstanceId || !documentContextId) {
    // Kein Protokolleintrag: eine Anfrage ganz ohne Klara-Bindung ist der Normalfall und keine
    // Entscheidung über eine Einwilligung.
    return { erlaubt: false };
  }
  try {
    const freigabe = await pruefer.pruefeExterneAusfuehrung(
      sessionId,
      { actorId, addinInstanceId, documentContextId },
      aufgabe,
    );
    const erlaubt = freigabe?.erlaubt === true;
    log.info(
      { ka4: { entscheidung: erlaubt ? "freigegeben" : "blockiert", grund: freigabe?.grund } },
      ereignis,
    );
    return {
      erlaubt,
      ...(typeof freigabe?.grund === "string" ? { grund: freigabe.grund } : {}),
      ...(erlaubt && typeof freigabe?.anbieter === "string" ? { anbieter: freigabe.anbieter } : {}),
      ...(erlaubt && typeof freigabe?.giltNoch === "function"
        ? { giltNoch: freigabe.giltNoch }
        : {}),
    };
  } catch (err) {
    // Fremde/abgelaufene/geschlossene Sitzung wirft (NOT_FOUND/CONFLICT). Das ist eine Absage,
    // kein Serverfehler — der Ask läuft in der unveränderten Enge weiter.
    log.info({ ka4: { entscheidung: "blockiert", grund: "bindung_ungueltig" } }, ereignis);
    return { erlaubt: false, grund: "bindung_ungueltig" };
  }
}

/**
 * JOB 2692 D1: Trägt die Anfrage überhaupt eine Klara-Bindung (mindestens eine der drei Kopfzeilen)?
 * Der Reasoner-Weg braucht diese Unterscheidung, weil dort — anders als beim Ask — eine Anfrage
 * OHNE Bindung der Konsolen-Normalfall ist und unverändert bleibt, während eine Anfrage MIT
 * (auch unvollständiger) Bindung ohne bestätigte Einwilligung die Cloud nicht erreichen darf.
 * Dieselben drei Kopfzeilen wie `ka4Freigabe` — eine Schreibweise, kein zweiter Transportvertrag.
 */
export function klaraBindungVorhanden(headers: Record<string, unknown>): boolean {
  return (
    klaraKopf(headers, KLARA_SESSION_HEADER).length > 0 ||
    klaraKopf(headers, KLARA_INSTANCE_HEADER).length > 0 ||
    klaraKopf(headers, KLARA_DOCUMENT_HEADER).length > 0
  );
}

// ================================================================================================
// F-0295 / R-0639 — DARF DIE MARKIERTE PASSAGE ZUSÄTZLICH ZUR FRAGE AN DIE EXTERNE KI?
// ================================================================================================
//
// Pedi, 18.08.2026: „Externe KI mit Dokumenttext: JA, aber nie still. Je Dokument eine
// ausdrückliche Einwilligung … Vertraulich Markiertes bleibt IMMER draußen."
//
// Gefragt wird NUR, nachdem `ka4Freigabe` den Antwortweg für genau diese Sitzung und genau dieses
// Dokument bestätigt hat (die Route ruft es nur in diesen beiden Zweigen). Entschieden wird im
// Sitzungsdienst — hier steht dieselbe fail-closed-Anwendung wie bei `ka4Freigabe`: kein Prüfer,
// keine Methode, fehlende Kopfzeile, Wurf, alles ausser `erlaubt === true` heisst NEIN.
//
// HEUTE IST DIE ANTWORT IMMER NEIN, und zwar mit dem Grund `riegel_aus`
// (`KLARA_DOCUMENT_TEXT_EGRESS_ENABLED` in `services/reasoner/src/klara-policy.ts`). Das Protokoll
// nennt Entscheidung und Grund — nie die Passage, nie die Frage, nie eine Kopfzeile.

/**
 * R-0639 — trägt `question` Dokumenttext?
 *
 * MIT KLARA-BINDUNG (Bens Befund B1, Runde 2): getippt ist NUR, was das Fenster ausdrücklich als
 * `manual` meldet. Ein noch geladenes älteres Fenster schickt die Markierung ohne jede Angabe als
 * Frage — „fehlt" darf dort deshalb nicht „getippt" heissen. Eine solche Anfrage verlässt die Enge
 * erst mit bestandener Dokumenttext-Prüfung; bei geschlossenem Riegel antwortet sie ohne Modell.
 *
 * OHNE KLARA-BINDUNG (Konsole, Systemaufrufe): es gibt kein Dokument und keine Markierung; „fehlt"
 * bleibt getippt. Wer dort ausdrücklich eine andere Herkunft meldet, wird ebenso eingeengt.
 */
export function frageAusDokument(herkunft: unknown, gebunden: boolean): boolean {
  if (herkunft === "manual") {
    return false;
  }
  return gebunden || herkunft !== undefined;
}

/** Nur ein fehlendes Feld oder ausdrücklich `intern` ist NICHT vertraulich — alles andere sperrt. */
export function markierungVertraulich(stufe: unknown): boolean {
  return !(stufe === undefined || stufe === "intern");
}

export async function dokumenttextFreigabe(
  pruefer: Ka4Freigabepruefer | undefined,
  headers: Record<string, unknown>,
  actorId: string,
  vertraulich: boolean,
  log: { info: (obj: unknown, msg: string) => void },
): Promise<boolean> {
  if (!pruefer || typeof pruefer.pruefeDokumenttextFreigabe !== "function") {
    return false;
  }
  const sessionId = klaraKopf(headers, KLARA_SESSION_HEADER);
  const addinInstanceId = klaraKopf(headers, KLARA_INSTANCE_HEADER);
  const documentContextId = klaraKopf(headers, KLARA_DOCUMENT_HEADER);
  if (!sessionId || !addinInstanceId || !documentContextId) {
    return false;
  }
  try {
    const freigabe = await pruefer.pruefeDokumenttextFreigabe(
      sessionId,
      { actorId, addinInstanceId, documentContextId },
      { vertraulich },
    );
    const erlaubt = freigabe?.erlaubt === true;
    log.info(
      {
        ka4: {
          nutzlast: "document_text",
          entscheidung: erlaubt ? "freigegeben" : "blockiert",
          grund: freigabe?.grund,
        },
      },
      "ask.ka4.dokumenttext",
    );
    return erlaubt;
  } catch {
    log.info(
      { ka4: { nutzlast: "document_text", entscheidung: "blockiert", grund: "bindung_ungueltig" } },
      "ask.ka4.dokumenttext",
    );
    return false;
  }
}
// KW-KA4-DOKUMENT-CONSENT-END

// ================================================================================================
// D5 · DIE ABSCHALTAUSKUNFT — VERSTÄNDLICH, OHNE KUNDENINHALT, GLEICH AN JEDER TÜR.
// ================================================================================================
//
// Hat der Administrator die KI abgeschaltet (`Reasoner.kiAbschaltung()`), bricht der Frageweg vor
// dem ersten inhaltlesenden Schritt ab (`AskService`, `AskError("KI_ABGESCHALTET")`). Hier wird
// daraus die Antwort an den Menschen: 503 mit dem Code `KI_ABGESCHALTET` und einem Satz in seiner
// Sprache. Der Satz nennt WAS gilt und WAS weiter geht — und nichts aus dem Bestand: keine Frage,
// keinen Titel, keine Quelle. Er ist bewusst unabhängig von der Frage, damit zwei Anfragen mit
// verschiedenem Inhalt bytegleich abgewiesen werden.
//
// Exportiert, weil `POST /api/reasoner` (Aufgabe `ask`) denselben Dienst ruft und dieselbe
// Auskunft geben muss — ein zweiter Wortlaut dort wäre ein zweiter Vertrag.
const KI_ABGESCHALTET_MELDUNG: Record<"de" | "en" | "nl", string> = {
  de: "Der Administrator hat die KI abgeschaltet. Fragen an Klara werden derzeit nicht beantwortet, und es werden dafür keine Inhalte gelesen. Die Bibliothek und die Originale bleiben nach Ihren Leserechten nutzbar.",
  en: "The administrator has switched AI off. Questions to Klara are currently not answered, and no content is read for them. The library and the originals remain available according to your read permissions.",
  nl: "De beheerder heeft AI uitgeschakeld. Vragen aan Klara worden momenteel niet beantwoord, en er wordt daarvoor geen inhoud gelezen. De bibliotheek en de originelen blijven beschikbaar volgens uw leesrechten.",
};

export function kiAbgeschaltetSenden(
  reply: { code(status: number): { send(body: unknown): unknown } },
  fehler: unknown,
  locale: string,
): boolean {
  if (!(fehler instanceof AskError) || fehler.code !== "KI_ABGESCHALTET") {
    return false;
  }
  const sprache = locale === "en" || locale === "nl" ? locale : "de";
  reply.code(503).send({ error: "KI_ABGESCHALTET", message: KI_ABGESCHALTET_MELDUNG[sprache] });
  return true;
}

// AUFTRAG-mega53 B4 — DIE ZWEITE DER VIER STELLEN.
//
// Diese Route beschafft nur die Eingaben; entschieden wird in `answerEvidence`. Neu ist, dass sie
// `citedSources` MITREICHT. Ohne dieses Feld rechnete die Regel serverseitig weiter auf allen
// herangezogenen Quellen — die Signatur macht das Weglassen jetzt unmöglich (Pflichtfeld).
//
// Aufgelöst werden weiterhin ALLE herangezogenen Quellen, nicht nur die tragenden: die Karte ist
// ein Nachschlagewerk, und die Regel greift daraus die tragende Teilmenge. So bleibt der
// Auflösungs-Warnpfad für jede ausgelieferte Quelle erhalten, ohne dass eine bloß angesehene
// Quelle die Einstufung berührt.
async function evidenceFor(
  deps: AskRouteDeps,
  result: {
    answered: boolean;
    knowledgeClass: string;
    sources: string[];
    citedSources: string[];
  },
  log: { warn: (obj: unknown, msg: string) => void },
  // D5 (KI aus): vor jedem Lesevorgang gerufen, AUSSERHALB der Fangzweige unten — eine Abschaltung
  // ist kein „nicht auflösbar" und kein „Konfliktabruf gescheitert", sie wird durchgereicht.
  pruefen: () => void,
): Promise<ReturnType<typeof answerEvidence>> {
  const sourceKos = new Map<string, KnowledgeObject>();
  // Höchstens DEFAULT_TOP_K Quellen (8) — dieselbe N+1-Runde, die das Add-in heute schon für
  // Titel und Datum fährt, nur einmal statt clientseitig.
  await Promise.all(
    result.sources.map(async (id) => {
      pruefen();
      try {
        // D5: die Sperre auch IN `get` — nach dem Objekt liest dessen Lesefassung noch weiter.
        const ko = await deps.ko.get(id, pruefen);
        if (ko) {
          sourceKos.set(id, ko);
        }
      } catch (err) {
        if (err instanceof AskError && err.code === "KI_ABGESCHALTET") {
          throw err;
        }
        // Nicht auflösbar ⇒ die Regel führt sie als `unknown`. Genau das ist gewollt.
        log.warn({ err, koId: id }, "ask.evidence: Quell-KO nicht auflösbar");
      }
    }),
  );
  let openConflicts: Awaited<ReturnType<ConflictService["unresolved"]>> | null = null;
  pruefen();
  try {
    // D5: `pruefen` auch INNERHALB der Konfliktabfrage — vor jeder Versionsabfrage, die ein
    // Wissensobjekt liest (ConflictService.unresolved → isBoundToCurrentVersions → ko.get).
    openConflicts = await deps.conflicts.unresolved(pruefen);
  } catch (err) {
    // Eine Abschaltung ist kein gescheiterter Konfliktabruf: sie geht an die Route durch.
    if (err instanceof AskError && err.code === "KI_ABGESCHALTET") {
      throw err;
    }
    log.warn({ err }, "ask.evidence: Konfliktabruf gescheitert — Einstufung bleibt unbelegt");
  }
  return answerEvidence({
    answer: result as Parameters<typeof answerEvidence>[0]["answer"],
    sourceKos,
    openConflicts,
  });
}

type AskOptionen = NonNullable<Parameters<AskService["ask"]>[3]>;

/**
 * R-0700: DER EINE ANTWORTLAUF beider Zugänge — des allgemeinen Fragewegs und des Klara-Zugangs.
 *
 * Er ist wörtlich die bisherige `answer`-Closure der Ask-Route, nur herausgehoben: Grundlage nach
 * Sichtbarkeit des Fragenden, KI-Sperre gegen die Eingangsepoche (D5), Evidenzzustand
 * (mega34 B1), eine Abschaltauskunft für alle Zweige. Zwei Zugänge, EIN Lauf — eine zweite Kopie
 * dieser Prüfreihenfolge wäre eine zweite Gelegenheit, eine davon zu vergessen.
 *
 * `zusatz` sind die zweigeigenen Optionen (Gesprächsfaden der Konsole; markierte Passage und
 * Dokumenttextfreigabe des Klara-Zugangs). Fehlt er, bleibt `opts` unangetastet, auch als
 * `undefined` — daran hängt der Vertrag von `KA4-E1`.
 */
async function antwortLauf(
  deps: AskRouteDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  lauf: {
    readonly question: string;
    readonly locale: "de" | "en" | "nl";
    readonly actorId: string;
    readonly opts?: AskOptionen;
    readonly zusatz?: Partial<AskOptionen>;
  },
): Promise<void> {
  const ask = deps.ask;
  const optionen: AskOptionen | undefined = lauf.zusatz
    ? { ...lauf.opts, ...lauf.zusatz }
    : lauf.opts;
  const betrachter = request.askSessionUser;
  let grundlage: (ko: KnowledgeObject) => boolean;
  if (betrachter) {
    grundlage = sichtbarkeitsfilterFuer(betrachter);
  } else {
    const offen = (await deps.offeneSpaces?.()) ?? new Set<string>();
    grundlage = (ko) => typeof ko.spaceId !== "string" || offen.has(ko.spaceId);
  }
  // D5: die Abschalt-Epoche beim EINGANG dieser Frage (onRequest). Jede Prüfung bis zur
  // Auslieferung vergleicht mit ihr — auch eine Aus-/Wiedereinschaltung dazwischen entwertet die
  // Frage, und zwar auch dann, wenn sie VOR dem Dienst (Einwilligungsprüfung) stand.
  const kiBeginn = request.askKiBeginn ?? undefined;
  const pruefen = (): void => ask.kiSperreVorAuslieferung(kiBeginn);
  let out: Awaited<ReturnType<AskService["ask"]>>;
  let evidence: ReturnType<typeof answerEvidence>;
  try {
    // D5 (Bens B1): nach dem letzten Warten VOR dem Dienst gegen die Eingangsepoche prüfen.
    // Zwischen dieser Prüfung und dem Einstieg in `ask.ask` liegt kein `await` — also kein Fenster.
    ask.kiSperreVorFrage(kiBeginn);
    // produkt:20261007:spaces — die Grundlage ist, was DIESER Fragende sehen darf.
    out = await ask.ask(lauf.question, lauf.actorId, lauf.locale, optionen, grundlage);
    // D5: `evidenceFor` liest die Quellobjekte und die offenen Konflikte nach — vor JEDEM dieser
    // Lesevorgänge wird erneut geprüft, und nach dem letzten Warten noch einmal.
    pruefen();
    evidence = await evidenceFor(deps, out.result, request.log, pruefen);
    pruefen();
  } catch (fehler) {
    // D5: beide Zugänge laufen hier durch — die Abschaltauskunft ist überall dieselbe.
    if (kiAbgeschaltetSenden(reply, fehler, lauf.locale)) {
      return;
    }
    throw fehler;
  }
  reply.code(200).send({ ...out, result: { ...out.result, evidence } });
}

/** Die Abschalt-Epoche beim Eingang festhalten — nur, wo `buildApp` es nicht schon getan hat. */
function kiBeginnHook(ask: AskService) {
  return async (request: FastifyRequest): Promise<void> => {
    if (request.askKiBeginn == null) {
      request.askKiBeginn = ask.kiStand() ?? null;
    }
  };
}

/** R-0700: trägt der Körper eines der Felder, die allein der Klara-Zugang kennt? */
function klaraFelderVorhanden(body: Record<string, unknown> | null | undefined): boolean {
  if (!body) {
    return false;
  }
  return (
    body.selection !== undefined ||
    body.selectionConfidentiality !== undefined ||
    body.questionSource !== undefined
  );
}

// Fragen & Wissenslücken (§2.4 / FR-ASK).
export function askRoutes(deps: AskRouteDeps, guards: Guards): FastifyPluginAsync {
  const ask = deps.ask;
  return async (app) => {
    // Bens B3 (Runde 2): je Anfrage ein Rahmen für die Klara-Anbieterbindung
    // (`services/reasoner/src/anbieterbindung.ts`) — das Tor hält sein Ergebnis darin fest, der
    // Reasoner liest es beim Kettenbau. `run(…, done)` ist das Muster von `@fastify/request-context`.
    app.addHook("onRequest", (_request, _reply, done) => {
      imBindungsrahmen(() => done());
    });
    app.decorateRequest("askSessionUser", null);
    // D5: in der App dekoriert `buildApp` (erster onRequest-Hook); hier nur für eigenständige Aufbauten.
    if (!app.hasRequestDecorator("askKiBeginn")) {
      app.decorateRequest("askKiBeginn", null);
    }
    app.post<{
      Body: {
        question?: string;
        locale?: string;
        mode?: string;
        thread?: string[];
        fragekontext?: unknown;
      } & Record<string, unknown>;
    }>(
      "/api/ask",
      {
        // SCRUM-490 D3: Drossel NUR für den addon-Pfad. Bei Flag AUS ist das @fastify/rate-limit-Plugin
        // nicht registriert → diese config.rateLimit ist inert (Fastify ignoriert unbekannte route-config)
        // → /api/ask exakt wie heute. Bei Flag AN drosselt sie nur den Add-on-Principal (allowList
        // exempt-iert Session-Requests der Live-App), gekeyt auf den stabilen addon-Actor.
        config: { rateLimit: addonRateLimit() },
        bodyLimit: ASK_BODY_LIMIT,
        schema: { body: askBodySchema },
        // D5 (Lauf 5 Runde 2, Bens B1): die Epoche gilt vom EINGANG, nicht erst vom Einstieg in den
        // Dienst. Dazwischen liegen Wartepunkte (Anmeldung, `ka4Freigabe`); wer dort während einer
        // Aus-/Wiedereinschaltung stand, übernahm vorher die NEUE Epoche und las weiter.
        // Runde 3 (Bens B2): festgehalten wird sie im ERSTEN globalen onRequest-Hook (`buildApp`),
        // also auch vor dem Anmelde-Hook der Add-on-API. Dieser Routen-Hook füllt sie nur, wo jener
        // fehlt (eigenständige Aufbauten ohne `buildApp`) — er überschreibt sie nie.
        onRequest: kiBeginnHook(ask),
        // SCRUM-498 B1: Auth VOR der Body-Validierung (wie check-text). Der Add-on-Pfad ist bereits im
        // onRequest-Hook autorisiert (401/403 vor der validation-Phase); den Session-Pfad prüfen wir
        // hier in preValidation, damit ein anonymer Request 401 bekommt, BEVOR die Schema-400 greift
        // (kein Reihenfolge-Oracle). Der aufgelöste User wird request-lokal für den Handler getragen.
        preValidation: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind === "addon") {
            // Defense-in-Depth (ben-Review): nur ein Principal mit Capability ask.validated erreicht den
            // Ask-Pfad; sonst fail-closed (403).
            if (!authorizesAsk(auth.principal)) {
              reply
                .code(403)
                .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
              return reply;
            }
            return;
          }
          // Live-App unverändert: Session-Guard mit ko.read — jetzt vor der Body-Validierung.
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
          request.askSessionUser = user;
        },
      },
      async (request, reply) => {
        // Der fehlende Body ist bereits durch das Schema (type:object) mit 400 abgefangen; ab hier ist
        // request.body ein Objekt. question kann fehlen/leer sein → wie im Parent auf "" normalisieren
        // (kein neuer 500). FR-I18N-01: UI-Sprache an den Reasoner; ungültig → "de".
        const question = request.body.question ?? "";
        // mega52 D1: die Route reicht Niederländisch durch, statt es auf Deutsch zu werfen.
        // Unbekannte Werte fallen weiterhin auf den sicheren Default "de".
        const locale: "de" | "en" | "nl" =
          request.body.locale === "en" ? "en" : request.body.locale === "nl" ? "nl" : "de";
        // ==========================================================================================
        // R-0700 — DER ALLGEMEINE FRAGEWEG NIMMT KEINE KLARA-BINDUNG AN.
        // ==========================================================================================
        //
        // Bis hierher prüfte diese Route die drei Bindungskopfzeilen, die Herkunft der Frage, die
        // markierte Passage und die KA4-Einwilligung — die ganze Klara-Ausführung stand im
        // allgemeinen Frageweg. Sie steht jetzt im eigenen, sitzungsgebundenen Zugang
        // `POST /api/klara/sessions/{sessionId}/execute` (`klaraAusfuehrungRoutes` unten), mit
        // DENSELBEN Prüfungen (`ka4Freigabe`, `dokumenttextFreigabe`). Eine Anfrage, die hier noch
        // eine Klara-Bindung oder ein Klara-Feld trägt, wird ABGEWIESEN — nicht still in die Konsole
        // gelassen (dann ginge Dokumenttext womöglich ans Modell) und nicht still eingeengt (dann
        // stünde die Klara-Behandlung wieder hier). Fail-closed, und der Grund steht im Körper.
        // Ausnahme R-0688 (Integrations-API): ein DIENST-Schlüssel hat keine Klara-Sitzung; schickt er
        // Klara-Köpfe mit, bekommt er wie zugesagt den engen Zweig unten (validiert, kein Modell) —
        // die Köpfe wirken dort nicht. Klara-Felder im Körper weist auch er ab.
        const dienstSchluessel =
          request.authContext?.authKind === "addon" &&
          request.authContext.principal.dienst !== undefined;
        if (
          (klaraBindungVorhanden(request.headers) && !dienstSchluessel) ||
          klaraFelderVorhanden(request.body as Record<string, unknown>)
        ) {
          reply.code(400).send({
            error: "KLARA_EIGENER_WEG",
            message:
              "Klara fragt über POST /api/klara/sessions/{sessionId}/execute; der allgemeine Frageweg nimmt keine Klara-Bindung an.",
          });
          return;
        }
        // R-0348: der Gesprächsfaden der Konsole — nur im Konsolenzweig unten wirksam.
        const faden = (request.body.thread ?? []).filter((frage) => frage.trim().length > 0);
        // R-1633: der Fragekontext — geprüft hier, wirksam nur dort, wo auch der Faden wirkt.
        const fragekontext = normalizeFragekontext(request.body.fragekontext);
        if (fragekontext === null) {
          reply.code(400).send({ error: "INVALID", message: "fragekontext ist ungültig." });
          return;
        }
        const auth = request.authContext;
        if (auth?.authKind === "addon") {
          // Aufnahme gesamt-integrations-api (R-0688) × R-0700: ein Schlüsselzugang — Klara- wie
          // DIENST-Schlüssel — bekommt hier ausschließlich den engen Zweig (validiertes Wissen, kein
          // Modell). Eine Einwilligung hebt die Enge nur an Klaras eigenem Zugang auf, und der weist
          // Schlüsselzugänge ab (403). Ein Dienst-Schlüssel, der Klara-Köpfe mitschickt, landet
          // deshalb hier (die Abweisung oben nimmt ihn aus) — nie bei einer Einwilligung.
          // SCRUM-490 D1/D2: validated-only + count_only für den Nur-Lese-Add-on-Key. R2 (B1):
          // retrievalOnly → der vertrauliche Dokumenttext wird NIE ans Modell/den Embedder gegeben; die
          // Antwort ist rein Retrieval gegen validierte, nicht-vertrauliche KOs (kein Egress).
          await antwortLauf(deps, request, reply, {
            question,
            locale,
            actorId: auth.principal.id,
            opts: { validatedOnly: true, gapPolicy: "count_only", retrievalOnly: true },
          });
          return;
        }
        // Session: in preValidation autorisiert, User request-lokal getragen.
        const user = request.askSessionUser;
        if (!user) {
          // Defense-in-Depth: erreichbar nur, wenn preValidation nichts gesetzt hätte (soll nie sein).
          reply.code(401).send({ error: "UNAUTHENTICATED", message: "Session erforderlich." });
          return;
        }
        // WP-KLARA-ASK-FIX (bens Fix 1, P0-Kern): "retrieval-only" — ein server-erzwungener Modus
        // des allgemeinen Fragewegs: ask.ask mit validatedOnly (nur validierte KOs als Grundlage) +
        // retrievalOnly (answerRetrievalOnly = deterministischer Pfad; kein Modell-, kein
        // Embedder-Aufruf erreichbar — exakt der seit SCRUM-490 R2 bestehende Add-on-Vertrag).
        // Die Antwort ist die WOERTLICHE validierte Aussage + Quellen, keine Synthese. Die
        // Wissensluecke wird weiter vermerkt (Session-Nutzer, bestehende gap-Semantik).
        // R-0700: eine Einwilligung hebt diese Enge HIER nicht mehr auf — das tut allein der
        // Klara-Zugang, für genau seine Sitzung und genau sein Dokument.
        if (request.body.mode === "retrieval-only") {
          // JOB 1591 D1 (W5): die Enge bleibt (`validatedOnly`, `retrievalOnly`); dazu kommt allein
          // die MELDUNG, dass es Ungeprüftes gibt — gefiltert durch die Sichtbarkeit DIESES
          // Nutzers. Der Add-on-Zweig oben bekommt diesen Filter NICHT (kein `SessionUser`; eine
          // Meldung ohne Betrachter wäre das Abfrageorakel, das AUFTRAG-mega77 entfernt hat).
          await antwortLauf(deps, request, reply, {
            question,
            locale,
            actorId: user.id,
            opts: {
              validatedOnly: true,
              retrievalOnly: true,
              ungeprueftSichtbarFuer: sichtbarkeitsfilterFuer(user),
              // JOB 2626 D1: derselbe Betrachter, zweite Meldung — die Torlage der Kandidaten.
              verschlossenSichtbarFuer: sichtbarkeitsfilterFuer(user),
            },
          });
          return;
        }
        // JOB 2626 D1: Auch die Konsole (Ask-Seite) erfaehrt bei einer Nicht-Antwort die Torlage —
        // hier gibt es einen SessionUser und damit den Sichtbarkeitsvertrag, den mega77 fuer jede
        // Meldung verlangt. Der Add-on-Zweig oben bekommt den Filter weiterhin NICHT (kein
        // SessionUser, kein Vertrag — dort bleibt alles, wie mega77 es hinterlassen hat).
        //
        // R-0584 (DS10, Auftrag gesamt-datenschutz-voreinstellung): auch die Konsole antwortet
        // standardmäßig NUR aus geprüftem Wissen. Bis hierher lief dieser Zweig ohne
        // `validatedOnly` — der einzige Frageweg, auf dem Ungeprüftes Grundlage einer Antwort werden
        // konnte. Das ersetzt die Abwägung aus mega52 C (Juli: „Text auf die Wahrheit ziehen statt
        // Filter") durch den jüngeren Auftrag. Was die Enge verschluckt, wird wie im Panel-Weg
        // (JOB 1591 W5) GEMELDET, nicht verwendet — gefiltert durch die Sichtbarkeit DIESES Nutzers.
        // R-0348: nur hier — getippte Fragen eines Sitzungsnutzers ohne Dokumentbezug — reist der
        // Gesprächsfaden mit (Wirkung und Grenzen an `fadenfragen` im Fragedienst).
        // R-1633: dieselbe Grenze für den Fragekontext — nur hier, sonst unangetastet.
        const konsolenZusatz = {
          ...(faden.length > 0 ? { gespraechsfaden: faden } : {}),
          ...(fragekontext ? { fragekontext } : {}),
        };
        await antwortLauf(deps, request, reply, {
          question,
          locale,
          actorId: user.id,
          opts: {
            validatedOnly: true,
            ungeprueftSichtbarFuer: sichtbarkeitsfilterFuer(user),
            verschlossenSichtbarFuer: sichtbarkeitsfilterFuer(user),
          },
          ...(Object.keys(konsolenZusatz).length > 0 ? { zusatz: konsolenZusatz } : {}),
        });
      },
    );

    // FR-ASK-04: „Hat geholfen" — Bewährung durch Nutzung.
    // FUNKE-FIX P0 (bens ROT-1): Das „Danke" verlangt den opaken Answer-Receipt aus dem echten
    // Antwortvorgang (POST /api/ask liefert ihn). Der Server verifiziert damit, dass GENAU dieses KO
    // diesem Nutzer als Quelle ausgeliefert wurde — eine frei gewählte/unbelegte KO-ID ⇒ 403. Die
    // Genau-einmal-Garantie (recordOnce-CAS) und der atomare Trust-Bump liegen im Service.
    app.post<{ Body: { koId: string; receipt?: string } }>(
      "/api/ask/helpful",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.markHelpful(request.body.receipt ?? "", request.body.koId, user.id);
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // R-1649 (ROADMAP 7.3): „Das war nicht hilfreich, ich habe es so gemacht …" — die Negativ-
    // Bewährung an der tragenden Quelle, optional verbunden mit dem abweichenden Weg als Entwurf.
    // Erkannt wird der Satz in der Fläche (Diktat ins Fragefeld, `apps/web/src/lib/nichtHilfreich.ts`);
    // hier gilt dieselbe Bindung wie beim „Danke": Recht `ko.read` und der Answer-Receipt. Wer einen
    // Weg mitschickt, legt einen Entwurf an und braucht dafür dasselbe Recht wie jeder Entwurfsweg
    // (`ko.create`) — fehlt es, wird VOR jedem Schreiben abgewiesen, auch der Vermerk entsteht nicht.
    app.post<{ Body: unknown }>("/api/ask/not-helpful", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // Die Gestalt erst NACH dem Tor: ein Unangemeldeter erfährt 401, nichts über den Rumpf.
      const body = nichtHilfreichRumpf(request.body);
      if (!body) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message: "koId fehlt, oder receipt, alternative oder entwurfTitel ist ungültig.",
        });
        return;
      }
      const alternative = body.alternative?.trim() ?? "";
      if (alternative && !can(user.role, "ko.create")) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: "Einen Entwurf anlegen darf diese Rolle nicht.",
        });
        return;
      }
      const anlegen = deps.alternativeAlsEntwurf;
      if (alternative && !anlegen) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message: "Ein Entwurf aus der Rückmeldung ist in diesem Aufbau nicht verfügbar.",
        });
        return;
      }
      // Der Titel nennt die Quelle, deren Titel beliebig lang sein kann — gekürzt, nicht abgewiesen.
      const titel = [...(body.entwurfTitel?.trim() || alternative)].slice(0, 200).join("");
      try {
        const ergebnis = await ask.markNotHelpful(
          body.receipt ?? "",
          body.koId,
          user.id,
          alternative && anlegen
            ? async () => (await anlegen({ title: titel, statement: alternative }, user.id)).id
            : undefined,
        );
        reply.code(200).send(ergebnis);
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FUNKE-FIX2 P0 (bens Erforderlich 1): rein aggregierte Zähler — KEIN Fragetext. Die Startseite
    // nutzt AUSSCHLIESSLICH diesen Endpunkt (kein Volltext-Fetch der Lücken mehr auf /start).
    app.get("/api/gaps/summary", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.gapsSummary());
    });

    // FUNKE-FIX2 P0 (bens Erforderlich 2): Detail-Endpunkt liefert den Fragetext ADRESSATENGERECHT.
    // R-0585 (Auftrag gesamt-datenschutz-voreinstellung): Volltext sehen nur der Ersteller/Owner
    // (der Fragende) und der Assignee (der Zuständige). Bis hierher sah ihn zusätzlich jede Rolle
    // mit `ko.validate` (Controller/Admin) — das Rollenrecht ist entfernt. Alle anderen erhalten eine
    // REDIGIERTE Sicht (Kategorie/Neutralbezeichnung, Zähler, KEIN Fragetext); zuweisen können
    // Berechtigte weiterhin (PUT /api/gaps/:id, `ko.assign`). Fail-closed: im Zweifel redigiert
    // (redactGapForViewer entscheidet zentral).
    app.get("/api/gaps", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const gaps = await ask.listGaps();
      reply.code(200).send(gaps.map((gap) => redactGapForViewer(gap, { viewerId: user.id })));
    });

    app.put<{
      Params: { id: string };
      Body: {
        expertId?: string;
        close?: boolean;
        action?: string;
        priority?: string;
        koId?: unknown;
      };
    }>("/api/gaps/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-115: Priorität setzen.
        if (request.body.priority !== undefined) {
          if (!isGapPriority(request.body.priority)) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "Ungültige Priorität." });
            return;
          }
          reply
            .code(200)
            .send(await ask.setGapPriority(request.params.id, request.body.priority, user.id));
          return;
        }
        // Close akzeptiert sowohl { close:true } als auch { action:"close" } (FE-Kopplung).
        if (request.body.close === true || request.body.action === "close") {
          // R-0846 / L6: der Objektbezug. Hier wird nur die Form geprüft; ob das Objekt existiert
          // und ob ohne mitgeschickten Bezug ein gültiger an der Lücke steht, entscheidet
          // `AskService.closeGap` — fehlt beides, bleibt die Lücke offen (400).
          const roh = request.body.koId;
          if (roh !== undefined && (typeof roh !== "string" || roh.trim() === "")) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "koId muss eine Kennung sein." });
            return;
          }
          const bezug = typeof roh === "string" ? roh.trim() : undefined;
          reply.code(200).send(await ask.closeGap(request.params.id, bezug));
          return;
        }
        if (request.body.expertId) {
          reply.code(200).send(await ask.assignGap(request.params.id, request.body.expertId));
          return;
        }
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "expertId, close oder priority erforderlich." });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>(
      "/api/gaps/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.deleteGap(request.params.id, request.query.confirm === "true");
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

// ================================================================================================
// R-0700 (KW-S4-24) · DER EIGENE, AN DIE SITZUNG GEBUNDENE AUSFÜHRUNGSZUGANG FÜR KLARA.
// ================================================================================================
//
// `POST /api/klara/sessions/{sessionId}/execute` — der Pfad, den die kanonische
// Architekturentscheidung KW-S4-24 nennt. Hier steht, was bis R-0700 im allgemeinen Frageweg
// stand; die Prüfungen sind DIESELBEN, nicht nachgebaut:
//
//   1. ANGEMELDETER BENUTZER (`ko.read`, wie `klara-ai-routes.ts`). Ein Add-on-Schlüssel ist kein
//      Sitzungsnutzer und bekommt 403 — Klaras Sitzungen gehören angemeldeten Menschen.
//   2. GÜLTIGE ZUORDNUNG. Die Sitzung steht im PFAD; Add-in-Instanz und Dokumentkontext kommen aus
//      denselben Kopfzeilen wie am Statusweg (`x-klara-instance`, `x-klara-document`). Der
//      Sitzungsdienst prüft die Bindung (`pruefeBindung`: fremde, abgelaufene oder geschlossene
//      Sitzung ⇒ `NOT_FOUND`/`CONFLICT`, ohne die Sitzung zu verlängern). Ohne gültige Zuordnung
//      gibt es KEINE Antwort — auch keine eingeengte. Eine abweichende `x-klara-session`-Kopfzeile
//      ist dieselbe Absage.
//   3. EINWILLIGUNG UND DOKUMENTTEXT. `ka4Freigabe` und `dokumenttextFreigabe` — unverändert —
//      entscheiden, ob die Enge (validiert, ohne Modell) verlassen werden darf.
//
// Danach läuft DERSELBE `antwortLauf` wie im allgemeinen Weg: dieselbe KI-Sperre, dieselbe
// Evidenz, dieselbe Abschaltauskunft. Zwei Zugänge, ein Lauf.
/** Das Sitzungstor, wie der Klara-Zugang es braucht: Freigabeprüfung UND Bindungsprüfung. */
export interface KlaraAusfuehrungstor extends Ka4Freigabepruefer {
  pruefeBindung(
    sessionId: string,
    bindung: { actorId: string; addinInstanceId: string; documentContextId: string },
  ): Promise<unknown>;
}

export interface KlaraAusfuehrungDeps extends Omit<AskRouteDeps, "klaraSessions"> {
  klaraSessions: KlaraAusfuehrungstor;
}

export function klaraAusfuehrungRoutes(
  deps: KlaraAusfuehrungDeps,
  guards: Guards,
): FastifyPluginAsync {
  const ask = deps.ask;
  return async (app) => {
    // Bens B3 (Runde 2): je Anfrage ein Rahmen für die Klara-Anbieterbindung — das Tor hält sein
    // Ergebnis darin fest, der Reasoner liest es beim Kettenbau.
    app.addHook("onRequest", (_request, _reply, done) => {
      imBindungsrahmen(() => done());
    });
    if (!app.hasRequestDecorator("askSessionUser")) {
      app.decorateRequest("askSessionUser", null);
    }
    if (!app.hasRequestDecorator("askKiBeginn")) {
      app.decorateRequest("askKiBeginn", null);
    }
    app.post<{
      Params: { sessionId: string };
      Body: {
        question?: string;
        locale?: string;
        selection?: string;
        selectionConfidentiality?: string;
        questionSource?: string;
      };
    }>(
      "/api/klara/sessions/:sessionId/execute",
      {
        bodyLimit: ASK_BODY_LIMIT,
        schema: { body: klaraExecuteBodySchema },
        onRequest: kiBeginnHook(ask),
        // Anmeldung VOR der Body-Validierung — wie am allgemeinen Weg (kein Reihenfolge-Orakel).
        preValidation: async (request, reply) => {
          if (request.authContext?.authKind === "addon") {
            reply.code(403).send({
              error: "FORBIDDEN",
              message: "Klara führt nur für eine angemeldete Sitzung aus.",
            });
            return reply;
          }
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
          request.askSessionUser = user;
        },
      },
      async (request, reply) => {
        const user = request.askSessionUser;
        if (!user) {
          reply.code(401).send({ error: "UNAUTHENTICATED", message: "Session erforderlich." });
          return;
        }
        const sessionId = request.params.sessionId.trim();
        const addinInstanceId = klaraKopf(request.headers, KLARA_INSTANCE_HEADER);
        const documentContextId = klaraKopf(request.headers, KLARA_DOCUMENT_HEADER);
        const kopfSitzung = klaraKopf(request.headers, KLARA_SESSION_HEADER);
        if (
          !sessionId ||
          !addinInstanceId ||
          !documentContextId ||
          (kopfSitzung.length > 0 && kopfSitzung !== sessionId)
        ) {
          // Fail-safe und generisch wie am Statusweg: kein Hinweis darauf, WELCHE Angabe fehlt.
          reply.code(404).send({
            error: "NOT_FOUND",
            message: "Keine gültige Klara-Sitzungszuordnung für diese Anfrage.",
          });
          return;
        }
        const bindung = { actorId: user.id, addinInstanceId, documentContextId };
        try {
          await deps.klaraSessions.pruefeBindung(sessionId, bindung);
        } catch (fehler) {
          sendError(reply, fehler);
          return;
        }
        // Die Prüfungen unten lesen die Bindung aus Kopfzeilen; die Sitzung kommt dabei aus dem
        // PFAD — er ist hier die maßgebliche Angabe.
        const bindungsKopf: Record<string, unknown> = {
          [KLARA_SESSION_HEADER]: sessionId,
          [KLARA_INSTANCE_HEADER]: addinInstanceId,
          [KLARA_DOCUMENT_HEADER]: documentContextId,
        };
        const question = request.body.question ?? "";
        const locale: "de" | "en" | "nl" =
          request.body.locale === "en" ? "en" : request.body.locale === "nl" ? "nl" : "de";
        // JOB 3006 (KA5): die markierte Passage — EINMAL gelesen, EINMAL normalisiert. Sie wird
        // NICHT in `question` gemischt und NICHT protokolliert. Eine leere Markierung ist keine.
        const markiert = (request.body.selection ?? "").trim();
        const markierung: { selection: string } | undefined =
          markiert.length > 0 ? { selection: markiert } : undefined;
        const vertraulich = markierungVertraulich(request.body.selectionConfidentiality);
        // R-0639, Befund B1: STAMMT DIE FRAGE SELBST AUS DEM DOKUMENT, verlässt sie die Enge nur mit
        // bestandener Dokumenttext-Prüfung. An diesem Zugang ist die Bindung immer da: getippt ist
        // nur, was das Fenster ausdrücklich als `manual` meldet.
        const frageIstDokument = frageAusDokument(request.body.questionSource, true);
        const freigegeben =
          (await ka4Freigabe(deps.klaraSessions, bindungsKopf, user.id, request.log)) &&
          (!frageIstDokument ||
            (await dokumenttextFreigabe(
              deps.klaraSessions,
              bindungsKopf,
              user.id,
              vertraulich,
              request.log,
            )));
        const answer = async (actorId: string, opts?: AskOptionen): Promise<void> => {
          // F-0295 / R-0639: die Passage darf ZUSÄTZLICH ans Modell nur, wenn die KA4-Freigabe
          // bestätigt ist, nie in der Enge — und nur mit eigener Deckungsprüfung.
          const dokumenttextFeld =
            markierung &&
            freigegeben &&
            opts?.retrievalOnly !== true &&
            (await dokumenttextFreigabe(
              deps.klaraSessions,
              bindungsKopf,
              actorId,
              vertraulich,
              request.log,
            ))
              ? { dokumenttextFreigegeben: true as const }
              : {};
          // gesamt-ki-freigaberegeln (Ben Nacharbeit 2, aus main integriert): geht vertraulich
          // markierter Dokumenttext hinaus — als Markierung oder als Frage selbst —, dann nur, weil
          // die zweite zentrale Adminfreigabe ihn gedeckt hat. Die EINSTUFUNG reist dann mit bis in
          // den Reasoner, damit der Kern und der Chokepoint dieselbe Freigabe noch einmal fragen.
          // Sonst fehlt das Feld. (`freigegeben` ist hier, was im früheren Klara-Zweig des
          // allgemeinen Wegs `ka4Bestaetigt` hieß.)
          const vertraulichHinaus =
            vertraulich &&
            ("dokumenttextFreigegeben" in dokumenttextFeld || (freigegeben && frageIstDokument));
          const vertraulichFeld = vertraulichHinaus
            ? { dokumenttextVertraulich: true as const }
            : {};
          const zusatz = markierung
            ? { ...markierung, ...dokumenttextFeld, ...vertraulichFeld }
            : vertraulichHinaus
              ? vertraulichFeld
              : undefined;
          await antwortLauf(deps, request, reply, {
            question,
            locale,
            actorId,
            ...(opts ? { opts } : {}),
            ...(zusatz ? { zusatz } : {}),
          });
        };
        if (freigegeben) {
          // Der normale Answerweg — `validatedOnly`/`retrievalOnly` entfallen, alles andere bleibt.
          await answer(user.id);
          return;
        }
        // JOB 1591 D1 (W5): ohne Freigabe die unveränderte Enge — validiert, ohne Modell; dazu
        // allein die MELDUNG, dass es Ungeprüftes gibt, gefiltert durch die Sichtbarkeit DIESES
        // Nutzers (JOB 2626 D1: ebenso die Torlage der Kandidaten).
        await answer(user.id, {
          validatedOnly: true,
          retrievalOnly: true,
          ungeprueftSichtbarFuer: sichtbarkeitsfilterFuer(user),
          verschlossenSichtbarFuer: sichtbarkeitsfilterFuer(user),
        });
      },
    );
  };
}
