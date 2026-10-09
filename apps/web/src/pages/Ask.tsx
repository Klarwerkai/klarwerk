import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, ThumbsUp, Volume2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos, useReasonerStatus } from "../api/hooks";
import type {
  AnswerResult,
  AskGeltungsauskunft,
  AskPruefrahmen,
  Fragekontext,
  VerschlossenHinweis,
} from "../api/types";
import { useToast } from "../app/ToastContext";
// AUFTRAG-mega69 B1 (bens sammel65-Auflage 1): der Kostenhinweis der Beispiel-Chips läuft über
// DASSELBE zentrale Bauteil und DIESELBE Ableitung wie alle anderen Auslösestellen — bedingt an
// `billable` der Aufgabe „answer", nicht mehr als unbedingter eigener Wortlaut.
import { AiCostHint } from "../components/AiCostHint";
import { AiGeneratedNotice, AiSurfaceNotice } from "../components/AiGeneratedNotice";
import { Bedingungswechsel } from "../components/Bedingungswechsel";
import { DemoBanner } from "../components/DemoBanner";
import { FragekontextWahl, GeltungsAuskunft, fragekontextZumSenden } from "../components/Geltung";
import { HelpTip } from "../components/HelpTip";
// AUFTRAG-mega71 BLOCK E (Befund aus mega70 Block E, jetzt frei): diese Fläche trug dieselbe
// Sackgassen-Fehlerklasse FÜNFFACH — zweimal /validierung (Führungskarte + Prüfvorbehalt-CTA),
// dazu /konflikte, /risiko und /erfassen?gap=… — und kannte keine einzige Rollenabfrage.
// /fragen ist ab viewer sichtbar; /validierung, /konflikte, /risiko verlangen controller,
// /erfassen experte. Ein Ziel, das die Rolle nicht erreicht, wird als Lage gezeigt, nicht als
// Weg — dasselbe EINE Tor wie auf Start/Library/Capture (mega51/mega70), keine zweite
// Rollenlogik; erhoben wird das vom mega70-Rohlink-Sammler, der seit mega71 auch hier hinsieht.
import { RoleLink } from "../components/RoleLink";
// FE-003: die Bausteine, die das Tutorial „Fragen“ mit dieser Seite TEILT — Fragefeld, Quellenchip
// und Plaketten, Warte- und KI-aus-Zustand. Sie standen bis dahin inline hier.
import { AntwortPlatzhalter, KiNichtVerfuegbar } from "../components/fragen/Antwortbausteine";
import { Belastbarkeit, PruefrahmenSatz } from "../components/fragen/Belastbarkeit";
import { FrageFeld } from "../components/fragen/FrageFeld";
import { NichtHilfreichKarte } from "../components/fragen/NichtHilfreichKarte";
import { EVIDENCE_TONE, QuellenListe } from "../components/fragen/QuellenListe";
import {
  QUELLEN_CHIP_KLASSE,
  QuellenChipInhalt,
  VERWENDUNG_BADGE,
  type Verwendung,
  chipPunkt,
} from "../components/fragen/Quellenplaketten";
import { ANTWORT_MENUEPUNKTE } from "../components/fragen/antwortMenue";
import { useVorlesen } from "../components/fragen/useVorlesen";
import { FRAGEN_ZIEL } from "../components/fragen/ziele";
// WP-UX-WOW-1 U1 / JOB 3064 §5: sichere Markdown-Darstellung der Antwort (React-Elemente, kein
// HTML-Sink) — mit den Fussnotenmarken des H5-Zielbilds. Derselbe Parser wie `AnswerMarkdown`.
import { AntwortText } from "../components/start/AntwortText";
import { OverflowMenu } from "../components/start/OverflowMenu";
import { Seitenblatt } from "../components/start/Seitenblatt";
import { useDiktat } from "../components/start/useDiktat";
import { ConfidenceBar, ErgebnisStufeMarke } from "../components/trust";
import { Button, Card, SectionLabel } from "../components/ui";
import {
  type AnswerExportInput,
  answerExportFilename,
  buildAnswerMarkdown,
} from "../lib/answerExport";
import {
  ANTWORT_DATEI_TYP,
  type AntwortDateiformat,
  PdfZeichenNichtDarstellbar,
  antwortDateiname,
  buildAnswerDatei,
} from "../lib/antwortDateien";
import {
  ANSWER_CONTRACT_TRUST_NOTE_KEY,
  answerContract,
  answerSourceSummary,
} from "../lib/askAnswerContract";
// AUFTRAG-mega39 BLOCK D2: die zweite Liste erscheint nur noch, wenn sie etwas Eigenes trägt.
import { attributeSources, citationState } from "../lib/askCitedSources";
// WP-UX-WOW-1 U2/U3: ehrliche Beispiel-Chips aus dem ECHTEN validierten Bestand (+ Lücken-Frage).
import { buildAskExampleChips } from "../lib/askExampleChips";
import { type AskExpectationTone, askExpectation } from "../lib/askExamples";
import { GAP_RESCUE_STEPS, GAP_RESCUE_TEXT } from "../lib/askGapRescue";
import {
  isConfidentialAskPrefill,
  isPrefilledAskQuestion,
  readAskQuestion,
  shouldAutoAskFromSearch,
} from "../lib/askQuestion";
import { selectAnswer } from "../lib/askResponse";
import { stepsBeyondSources, stepsWorthShowing } from "../lib/askSteps";
import { answerReviewGuard, evidenzWiederholtStatus } from "../lib/askView";
import { belegstelleHref } from "../lib/belegstelle";
import { captureGapHref, gapPrivacyNoticeKey } from "../lib/captureFromGap";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
// JOB 3267 Q1: der Prüfstand einer Quelle kommt aus der EINEN Ableitung, die auch Bibliothek und
// KO-Detail lesen (JOB 3072 N4) — kein zweites Statusvokabular an der Fragenfläche.
import { anzeigestatusAus } from "../lib/displayStatus";
// AUFTRAG-mega33 A: die EINE effektive Antwort-Einstufung — Quelle jeder Einstufungs-Anzeige.
import { conflictKnowledge, effectiveAnswer } from "../lib/effectiveAnswer";
// Pedi 28.09.2026 · Ergänzung 1: Entwurf und zuletzt angezeigte Antwort bleiben dem Konto erhalten.
import {
  type QuellenStand,
  antwortFrische,
  arbeitsstandLesen,
  arbeitsstandSchreiben,
  belegNochGueltig,
  beobachtungAus,
  fragenSpeicher,
  quellenStandAus,
  startadresseMarke,
  startadresseMerken,
  wiederaufnahmeAus,
} from "../lib/fragenArbeitsstand";
// R-0348: Nachfragen im Gesprächsfaden statt Einzelschüssen.
import { fadenFuerAnfrage, fadenNachAntwort } from "../lib/gespraechsfaden";
import { helpfulDisabled, helpfulLabel } from "../lib/helpfulSignal";
// R-0625 / R-1020 / R-1695: Herkunft und Stufe der Antwort aus EINER Ableitung.
import { ergebnisStufeFuerAntwort, kiHerkunftAus } from "../lib/kiHerkunft";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { formatKoTimestamp } from "../lib/koDates";
import { erkenneNichtHilfreich } from "../lib/nichtHilfreich";
import { type ReasonerBadgeTone, reasonerBadge } from "../lib/reasonerBadge";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { istIosGeraet } from "../lib/speechSupport";
import { useAiAvailable } from "../lib/useAiAvailable";
import { useAiBillable } from "../lib/useAiBillable";
import { useAuthorName } from "../lib/useAuthorName";
import { useKontoKennung } from "../lib/useKontoKennung";
import { useReadiness } from "../lib/useReadiness";

// Tone → Badge-Stil: seit FE-003 (Runde 2) `EVIDENCE_TONE` aus `components/fragen/QuellenListe.tsx`,
// derselben Tabelle, die die Quellenzeilen tönt.

// SCRUM-233: Modus-Badge-Tönung (eigene Skala, neutral inklusive Lade-/Unbekannt-Zustand).
const REASONER_TONE: Record<ReasonerBadgeTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// SCRUM-266: Tönung der Ergebnis-Erwartung je Beispiel (quellengebundene Antwort vs. Wissenslücke).
const EXPECT_TONE: Record<AskExpectationTone, string> = {
  answer: "bg-trust-pos-bg text-trust-pos-text",
  gap: "bg-trust-warn-bg text-trust-warn-text",
};

// ================================================================================================
// JOB 3267 · Q1 — ZWEI FRAGEN, ZWEI ANTWORTEN: „VERWENDET?" IST NICHT „GEPRÜFT?".
// ================================================================================================
//
// DER BEFUND (Codex 037f24c7, Live 1.174, m2-homeoffice-browser-en.json). Die englische Antwort
// übernahm die Homeoffice-Regel samt Fußnote 1 — und der einzige Quelllink sagte im Tooltip
// „Consulted but not used". Die Ursache war NICHT die Attribution: der gelbe Punkt am Chip zeigt
// einen PRÜFSTAND (`validated === false`), und er bekam bedingungslos den Hinweis der
// NICHTVERWENDUNG (`ask.attribution.consulted.hint`) — ohne `carrying` auch nur anzusehen. Zwei
// verschiedene Fragen teilten sich ein Wort, und das Wort war für die tragende Quelle falsch.
//
// AB HIER SIND ES DREI ZUSTÄNDE, und der dritte ist der wichtige:
//
//   verwendet       Der Server nennt diese Quelle in `citedSources` (→ `carrying`).
//   nichtVerwendet  Der Server hat eine TRAGFÄHIGE Zuordnung geliefert, diese Quelle steht nicht
//                   darin — UND im Antworttext ist kein Referenzanker zu ihr gerendert.
//   unbekannt       Alles andere: keine/leere Zuordnung (alter Server, Modell ohne verwertbare
//                   Marke) ODER ein WIDERSPRUCH — im Text steht eine gerenderte Fußnote zu dieser
//                   Quelle, die Zuordnung nennt sie aber nicht.
//
// WARUM DER WIDERSPRUCH NICHT ZU „NICHT VERWENDET" WIRD, sondern zu „unbekannt": eine sichtbare
// Fußnote ist für den Leser eine Verwendung. Sagt die Auskunft daneben „nicht verwendet",
// widerspricht die Seite sich selbst — genau der Fehler, den dieser Auftrag beseitigt. Umgekehrt
// wäre „verwendet" eine Behauptung, die die Zuordnung nicht deckt. Bleibt die ehrliche dritte
// Aussage. Sie ist ERREICHBAR und kein Papierfall: liefert der Server `citedSources` mit
// Kennungen, die in `sources` nicht vorkommen, ist `tragend` undefiniert, `AntwortText` fällt auf
// die Marken AUS DEM TEXT zurück (lib/answerMarkdown.ts, „DER DECKUNGSRÜCKFALL") — und die Chips
// sagten bis hierher pauschal „angesehen".
//
// EINE FEHLENDE FUSSNOTE ALLEIN BEWEIST NICHTS (Codex 65f00f4e). Sie macht aus einer tragfähigen
// „nicht genannt"-Zuordnung kein „unbekannt" — sonst wäre der Deckungsrückfall (tragende Quelle
// ohne Klammer im Text) nicht mehr darstellbar. Deshalb steht die Fußnote nur auf der Seite des
// WIDERSPRUCHS, nie als eigener Beweis.
//
// KEINE ZIFFERN- ODER TEXTHEURISTIK: die Zuordnung läuft über den GERENDERTEN Anker
// (`sup[data-fussnote]`, gemessen am DOM) und die Stelle der Quell-ID in `result.sources` — dieselbe
// Nummer, die der Chip trägt. Der Rohtext wird nicht durchsucht.
//
// Der Typ `Verwendung` steht seit FE-003 bei den gemeinsamen Plaketten
// (`components/fragen/Quellenplaketten.tsx`).

// NICHTLEER IST NICHT TRAGFÄHIG (Ben, Runde 2 · Korrekturpflicht 1). `citationState` prüft nur, ob
// `citedSources` überhaupt etwas enthält. Nennt der Server ausschliesslich Kennungen, die zu KEINER
// Quelle dieser Antwort gehören, war das bis hierher „attributed" — und jede Quelle ohne Anker hiess
// „nicht verwendet", obwohl keine einzige Kennung auflösbar ist. Das ist eine Negativaussage ohne
// Beleg. Tragfähig ist die Zuordnung erst, wenn MINDESTENS EINE genannte Kennung eine Stelle in
// `result.sources` hat — genau die Bedingung, die `tragendeNummern` (JOB 3064) schon zieht; sie wird
// hier gelesen und nicht ein zweites Mal gerechnet. Eine gemischte Liste (eine gültige Kennung, eine
// fremde) bleibt tragfähig: die Zuordnung ist dann nachweislich lesbar, und die fremde Kennung sagt
// über die übrigen Zeilen nichts — deren Anker entscheidet weiter (der Widerspruchsfall unten).
function verwendungsZustand(lage: {
  /** Tragfähig = mindestens eine genannte Kennung ist eine Quelle dieser Antwort. */
  zuordnungTragfaehig: boolean;
  /** Diese Quelle steht in `citedSources` (aus `attributeSources`). */
  carrying: boolean;
  /** Die Chip-Nummer (Stelle in `result.sources`, 1-basiert); 0 = nicht auflösbar. */
  nummer: number;
  /** Wurden die gerenderten Marken schon gemessen? Vorher gibt es keine Grundlage. */
  gemessen: boolean;
  /** Die Nummern, die im Antworttext WIRKLICH als Fußnote stehen. */
  marken: ReadonlySet<number>;
}): Verwendung {
  if (!lage.gemessen || !lage.zuordnungTragfaehig) {
    return "unbekannt";
  }
  if (lage.carrying) {
    return "verwendet";
  }
  // Ohne auflösbare Nummer lässt sich kein Anker gegen diese Quelle prüfen — dann wird die
  // Negativaussage nicht behauptet.
  if (lage.nummer < 1) {
    return "unbekannt";
  }
  // DIE KONSISTENZREGEL, UND WAS SIE HEUTE WIRKLICH IST — ein ZWEITES Schloss, kein erstes.
  //
  // Steht im Antworttext eine gerenderte Fußnote zu dieser Quelle, während die Zuordnung sie nicht
  // nennt, widerspräche „nicht verwendet" dem, was der Leser sieht. Dann gilt die schwächere,
  // wahre Aussage.
  //
  // EHRLICH GEMESSEN (R3): mit dem heutigen Textsatz kann dieser Fall die Fläche nicht erreichen.
  // `markiereFussnoten` (lib/answerMarkdown.ts:229–230) setzt eine Marke nur, wenn ihre Nummer in
  // `tragend` steht — und `tragend` ist genau dann gesetzt, wenn die Zuordnung tragfähig ist. Über
  // dieser Zeile ist sie das; also gehört jede gerenderte Marke einer genannten Quelle, und die
  // Bedingung ist heute nie wahr. Sie bleibt trotzdem stehen: sie ist die Absicherung gegen eine
  // Änderung an einem Textsatz, der NICHT dieser Fläche gehört. Der laufende Wächter dafür ist Q7
  // in `tests/q1-quellen-wahrheit` — er misst die gerenderten Marken gegen das Wort am Chip über
  // alle Lagen und wird rot, sobald der Textsatz eine nicht genannte Marke durchlässt.
  return lage.marken.has(lage.nummer) ? "unbekannt" : "nichtVerwendet";
}

// Die Anker der Quellenliste (`VERWENDUNG_ANKER`) stehen seit FE-003 (Runde 2) am Baustein
// `components/fragen/QuellenListe.tsx`.

// DIE PLAKETTEN (JOB 3267 Q1) und der Chip-Inhalt sind seit FE-003 gemeinsame Bausteine in
// `components/fragen/Quellenplaketten.tsx` — das Tutorial „Fragen“ führt den Quellenweg mit
// denselben Bauteilen vor. Die Begründung der ausgeschriebenen Zweige steht dort.

// SCRUM-289: Ask-Führung — quellengebunden antworten, offene Quellen prüfen lassen.
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// ================================================================================================
// JOB 2694 D1 (Review-Befund R2-20) — EINE ANTWORT OHNE TEXT IST EINE WISSENSLÜCKE.
// ================================================================================================
//
// DER BEFUND, gemessen an 71d3c2b: `answered: true` mit leerem `answer` rendert unten eine LEERE
// Antwortkarte — samt Einordnung „Quellengebundene Antwort", Quellenliste, Kopieren/Download/Druck
// und Danke-Knopf. „Gesichert" über nichts. Nebenan prüft `KlaraAssistant.tsx` `answered && answer`,
// das Word-Add-in (`taskpane.html`, Ergebnisvertrag) sogar `answer.trim().length > 0`; diese Seite
// prüfte gar nicht. Zuschlagen kann das bei einem Provider-Fehler, der `""` liefert.
//
// DIE ENTSCHEIDUNG: ALS LÜCKE BEHANDELN, nicht als eigene Meldung. Eine Antwort ohne Text IST
// keine Antwort; der Mensch sieht dann exakt das, was er bei „keine Antwort gefunden" sieht —
// denselben Kasten, denselben Wortlaut (`ask.contract.gap.*`), keinen Stempel, keine Werkzeuge.
// Eine Meldung „Antwort ohne Inhalt geliefert" klänge nach einem Fehler des Fragenden und wäre ein
// zweiter Text für denselben Zustand. Die Lücke ist die Wahrheit, und das Produkt führt sie schon.
//
// WARUM AM EINGANG UND NICHT AN DER RENDER-BEDINGUNG: Einordnung (`effectiveAnswer`, `contract`),
// Quellenbilanz, Export (`buildExport`) und Danke-Knopf hängen ALLE an `result.answered`. Ein Guard
// nur an der Karte ließe den Rest weiter „gesichert" rechnen. Wird das Ergebnis hier normalisiert,
// gibt es nur EINE Lesart im ganzen Bauteil — und Kopieren/Export sind zwangsläufig gesperrt, weil
// die Werkzeuge nur mit `answered` überhaupt entstehen und `buildExport` ohne `answered` `null`
// liefert. Die Regel selbst: `answered && answer` (Klara) mit dem Trim des Word-Add-ins — das
// Strengere von beiden; nur Leerraum ist genauso nichts wie ein Leerstring.
//
// NICHT ANGEFASST: der Textsatz der Antwort (`AntwortText`, rendert nur Textknoten, sicher —
// R2-20 selbst belegt; bis JOB 3064 stand hier `AnswerMarkdown`, dieselbe Zusage aus demselben
// Parser).
// `knowledgeClass` wird mit auf „unbekannt" gesetzt, damit kein späterer Leser dieses Zustands
// eine Klasse für eine Antwort findet, die es nicht gibt.
// R-0310: „Unter der Antwort … höchstens drei Quellen, weitere als Chip '+N'."
const QUELLEN_CHIPS_SICHTBAR = 3;

function leereAntwortAlsLuecke(result: AnswerResult): AnswerResult {
  if (!result.answered) {
    return result;
  }
  if ((result.answer ?? "").trim().length > 0) {
    return result;
  }
  return { ...result, answered: false, answer: null, knowledgeClass: "unbekannt" };
}

/**
 * Die Einordnung DER FLÄCHE (nicht einer einzelnen Antwort): Kicker, Titel, Quellen-Hilfe,
 * Einleitungssatz, Modus-Chip, KI-Kennzeichnung, der Satz ohne Spracherkennung und die
 * Erklär-Fläche „warum Klarwerk kein generischer Chat ist".
 *
 * KORREKTURPFLICHT 2 (Ben, Runde 3): sie steht in GENAU EINEM Seitenblatt — und weil dieses Blatt
 * je nach Lage an zwei Stellen im Baum hängt (mit Antwort in der Kartenregion, ohne Antwort
 * daneben), ist ihr Inhalt hier EIN Bauteil statt zweier Abschriften. Eine Kopie wäre die Drift,
 * gegen die dieses Haus mehrfach angetreten ist.
 */
function MehrFlaechenInfo({
  badge,
  guide,
  speechSupported,
  vorlesenMoeglich,
}: {
  badge: ReturnType<typeof reasonerBadge>;
  guide: ReturnType<typeof knowledgeGuidance>;
  speechSupported: boolean;
  vorlesenMoeglich: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
            {t("ask.kicker")}
          </div>
          <h2 className="mt-1 text-[15px] font-semibold text-ink">{t("ask.title")}</h2>
        </div>
        <HelpTip title={t("ask.help.sources.title")} body={t("ask.help.sources.body")} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{t("ask.intro")}</p>
        {/* ==========================================================================
            SCHEIBE D-034 (JOB 1106) — DER MODUS-CHIP ERKLÄRT SICH NICHT MEHR NUR DER MAUS.
            ==========================================================================
            Der `title` bleibt der kürzeste Weg für die Maus; daneben steht das vorhandene
            Bauteil `HelpTip` als echter, per Tabulator erreichbarer Knopf, der denselben Satz
            als LESBAREN Text öffnet. Kein neuer Text, kein neuer Schlüssel, kein neues Bauteil. */}
        <span className="inline-flex shrink-0 items-center gap-1">
          <span
            data-testid="ask-reasoner-mode"
            title={t("ask.reasoner.hint")}
            className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${REASONER_TONE[badge.tone]}`}
          >
            {t(badge.labelKey)}
          </span>
          <span data-testid="ask-reasoner-help" className="inline-flex">
            <HelpTip title={t(badge.labelKey)} body={t("ask.reasoner.hint")} />
          </span>
        </span>
      </div>
      {/* AUFTRAG-mega61 Block E: hier stand der KI-Hinweis VOR der ersten Frage. Seit JOB 3064 (H5)
          lag er damit hinter „…" → „Mehr" — genau hinter dem Aufklapp-Knopf, den R-0603
          ausschliesst. Er steht jetzt dauerhaft über dem Fragefeld (`ask-ki-flaechensatz`). */}
      {/* JOB 3038 · „Ehrlichkeit vor Optik": statt eines toten Mikrofonknopfes der Satz, der den
          Zustand nennt. §6 des Auftrags nimmt ihn aus dem Sichtfeld — ohne Spracherkennung fehlt
          das Mikrofon einfach; WARUM es fehlt, steht hier. */}
      {speechSupported ? null : (
        <p
          data-testid="ask-diktat-na"
          className="mb-3 rounded-btn bg-trust-warn-bg px-2.5 py-2 text-[12px] text-trust-warn-text"
        >
          {t("ask.diktatUnsupported")}
          {/* FR-CAP-03: auf iPhone/iPad ist der Ausweg das Mikrofon der Bildschirmtastatur. */}
          {istIosGeraet(window) ? ` ${t("diktat.iosTastatur")}` : null}
        </p>
      )}
      {/* R-1053: dieselbe Ehrlichkeit für die Sprachausgabe — ohne sie fehlt der Vorlese-Knopf. */}
      {vorlesenMoeglich ? null : (
        <p
          data-testid="ask-vorlesen-na"
          className="mb-3 rounded-btn bg-trust-warn-bg px-2.5 py-2 text-[12px] text-trust-warn-text"
        >
          {t("diktat.antwortVorlesenNa")}
        </p>
      )}
      {/* SCRUM-289 / D-034: warum Klarwerk kein generischer Chat ist — Titel, Fliesstext und
          beide Kacheln unverändert, der Titel bleibt die sichtbare Kopfzeile der Faltung. */}
      <details data-testid="ask-guide">
        <summary className="cursor-pointer">
          <h2 className="inline text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h2>
        </summary>
        <Card className="mt-2 border-dashed">
          <p className="text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* AUFTRAG-mega71 BLOCK E (Stelle 1): der Eintrag „prüfen lassen" führt auf
                /validierung (controller) — für Betrachter und Experten eine Lage, keine stille
                Sackgasse. Die Erklärung selbst bleibt für alle stehen. */}
            {guide.items.map((item) => (
              <RoleLink
                key={item.id}
                to={item.to}
                className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2"
                hoverClassName="hover:border-ink/30"
              >
                {() => (
                  <>
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                    >
                      {t(item.labelKey)}
                    </span>
                    <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                      {t(item.bodyKey)}
                    </span>
                  </>
                )}
              </RoleLink>
            ))}
          </div>
        </Card>
      </details>
    </>
  );
}

/**
 * DIE EINORDNUNG EINER LÜCKE — Vertrag, Quellenbilanz, verschlossene Tore und der geführte
 * Rettungsweg.
 *
 * KORREKTURPFLICHT 1 (Ben, Runde 5). Im Lückenfall standen ZWEI Karten nebeneinander: der
 * Vertragskasten und die Lückenkarte. Und das sichtbare „…" → „Mehr" öffnete nichts, weil die
 * Weiche `mehr && !karteSichtbar` in dieser Lage BEIDE Blätter ausschloss — ein Menüpunkt ohne
 * Wirkung, also genau die Scheinfunktion, die §7 der Regeln verbietet.
 *
 * Auftrag §6 lässt im Lückenfall EINE Karte übrig: Lückensatz und „Wissen erfassen". Alles, was
 * diese Lücke EINORDNET, steht seither hier — und dieses Bauteil hängt im Info-Blatt „Mehr",
 * genau wie die Einordnung einer beantworteten Frage. Kein Text ist gestrichen; jeder steht
 * weiterhin genau einmal, nur nicht mehr als zweite Karte im Sichtfeld.
 */
function MehrLueckenInfo({
  contract,
  sourceSummary,
}: {
  contract: NonNullable<ReturnType<typeof answerContract>>;
  sourceSummary: ReturnType<typeof answerSourceSummary> | null;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="ask-mehr-luecke" className="mt-4 border-t border-hairline pt-3">
      {/* SCRUM-366 / AG-P2-2 / AG-P2-3 / PI-K2: Antwortvertrag — quellengebunden, ehrlich
          (gesichert vs. ungeprüft vs. Wissenslücke), kein generischer Chatbot. */}
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
        {t("ask.contract.label")}
      </span>
      <p
        className={`mt-0.5 text-[13px] font-semibold ${
          contract.tone === "pos" ? "text-trust-pos-text" : "text-trust-warn-text"
        }`}
      >
        {t(contract.titleKey)}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(contract.bodyKey)}</p>
      {sourceSummary && sourceSummary.total > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-pill bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-text">
            {t("ask.contract.sumTotal", { count: sourceSummary.total })}
          </span>
          {sourceSummary.validated > 0 ? (
            <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-pos-text">
              {t("ask.contract.sumValidated", { count: sourceSummary.validated })}
            </span>
          ) : null}
          {sourceSummary.open > 0 ? (
            <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text">
              {t("ask.contract.sumOpen", { count: sourceSummary.open })}
            </span>
          ) : null}
          {sourceSummary.conflictLimited > 0 ? (
            <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-crit-text">
              {t("ask.contract.sumConflict", { count: sourceSummary.conflictLimited })}
            </span>
          ) : null}
        </div>
      ) : null}
      {contract.sourceBound ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-2">
          {t(ANSWER_CONTRACT_TRUST_NOTE_KEY)}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] font-medium text-text">{t(contract.nextStepKey)}</p>
      {/* SCRUM-369 / AG-12/13/P2-4: der geführte „Wissenslücke retten"-Einstieg — Story,
          Beitragswert, ehrlich „keine Antwort erfunden" und die Schrittfolge. Der KNOPF dazu steht
          auf der Karte im Sichtfeld (§6); hier steht, was er bedeutet. */}
      <div className="mt-3 rounded-card border border-ai/30 bg-ai/5 px-3 py-2.5">
        <div className="text-[13px] font-semibold text-ai">{t(GAP_RESCUE_TEXT.storyTitle)}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
          {t(GAP_RESCUE_TEXT.impact)}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
          {t(GAP_RESCUE_TEXT.noInvent)}
        </p>
        <div className="mt-2 border-t border-hairline pt-2">
          <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
            {t(GAP_RESCUE_TEXT.stepsTitle)}
          </div>
          <ol className="space-y-1">
            {GAP_RESCUE_STEPS.map((step, i) => (
              <li key={step.id} className="text-[11.5px] leading-relaxed text-muted">
                <span className="font-semibold text-text">
                  {i + 1}. {t(step.labelKey)}
                </span>{" "}
                {t(step.hintKey)}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {/* SCRUM-283: ehrlich + datensparsam — die Frage wird als Lücke gespeichert, keine Antwort,
          keine sensiblen Details; geprüfte Erfahrung später ergänzen. */}
      <p className="mt-2 rounded-btn bg-page px-2.5 py-2 text-[12px] text-muted-2">
        {t(gapPrivacyNoticeKey())}
      </p>
      {/* AUFTRAG-mega71 BLOCK E (Stelle 5): /risiko verlangt controller. */}
      <div className="mt-3">
        <RoleLink
          to="/risiko"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-text"
        >
          {(erreichbar) => (
            <>
              {t("ask.toGaps")}
              {erreichbar ? <ArrowRight size={15} /> : null}
            </>
          )}
        </RoleLink>
      </div>
    </div>
  );
}

/** Eine Anfrage und die Kontogeneration der Fläche, unter der sie gestellt wurde (Ben R1, F1). */
interface AskAnfrage {
  frage: string;
  generation: number;
  // R-0348: die vorangegangenen Fragen, zu denen diese eine Nachfrage ist (ohne sie selbst).
  faden: string[];
  // Ben, Nacharbeit 2: die Fadengeneration beim Absenden — „Neues Thema" zählt sie hoch.
  fadenGeneration: number;
  // R-1633: der Fragekontext beim Absenden; fehlt er, ist der Aufruf der bisherige.
  kontext?: Fragekontext;
}

// R-1649: die erkannte, noch nicht bestätigte Rückmeldung und ihr Ergebnis (s. `Ask`).
interface NichtHilfreichOffen {
  koId: string;
  alternative: string;
}
interface NichtHilfreichErledigt {
  entwurfId: string | null;
}

export function Ask(): JSX.Element {
  const { t, i18n } = useTranslation();
  // SCRUM-272: optionale Startfrage aus der URL (/fragen?q=…) — nur vorbefüllen, kein Auto-Ask.
  const [params] = useSearchParams();
  // ==============================================================================================
  // PEDI 28.09.2026 · ERGÄNZUNG 1 — WEITERARBEITEN, WO MAN AUFGEHÖRT HAT.
  // ==============================================================================================
  // Der Arbeitsstand dieses Kontos (Entwurf + zuletzt angezeigte Antwort) wird beim Aufbau EINMAL
  // gelesen und füllt die Anfangswerte — es geht dafür keine Modellanfrage hinaus.
  // `standFuer` sagt, WESSEN Stand die Fläche gerade zeigt; geschrieben wird nur, solange er zur
  // angemeldeten Kennung passt (s. die beiden Effekte unter `ask`).
  //
  // DIE STARTADRESSE (`?q=`, `?ask=1`) IST EIN AUSDRÜCKLICHER WUNSCH — ABER NUR EINMAL (Ben R1,
  // F2/F3). Sie gewann bis Runde 1 bei JEDEM Aufbau: Neuladen derselben Adresse holte die Startfrage
  // über einen weitergeschriebenen oder bewusst geleerten Entwurf zurück, und `?ask=1` fragte das
  // Modell ein zweites Mal. Jetzt merkt sich der Stand die übernommene Adresse samt
  // Navigationskennung (`startadresseMarke`); dieselbe Adresse erneut ist verbraucht, ein neuer Weg
  // auf die Seite (neue Kennung) gilt wieder.
  const location = useLocation();
  const navigationsSchluessel = location.key;
  const konto = useKontoKennung();
  const [anfang] = useState(() => arbeitsstandLesen(fragenSpeicher(), konto));
  const [adresse, setAdresse] = useState(() => {
    const frage = readAskQuestion(params);
    const autoFrage = shouldAutoAskFromSearch(params);
    return { frage, autoFrage, marke: startadresseMarke(location.key, frage, autoFrage) };
  });
  const [startfrageGilt, setStartfrageGilt] = useState(
    adresse.marke !== null && !(anfang?.startadressen ?? []).includes(adresse.marke),
  );
  // Die Marke, die mit dem Stand gespeichert wird: die eben übernommene Adresse oder, ohne
  // Startfrage, die zuletzt übernommene.
  const [gemerkteStartadressen, setGemerkteStartadressen] = useState(() =>
    startadresseMerken(anfang?.startadressen ?? [], adresse.marke),
  );
  const [standFuer, setStandFuer] = useState(konto);
  const [q, setQ] = useState(() =>
    startfrageGilt ? (adresse.frage ?? "") : (anfang?.entwurf ?? ""),
  );
  // Der sichtbare Hinweis „hier kannst du weitermachen" — nur, wenn wirklich etwas aufgenommen
  // wurde. Er geht, sobald eine neue Frage gestellt wird.
  const [wiederaufnahme, setWiederaufnahme] = useState(() =>
    wiederaufnahmeAus(anfang, startfrageGilt),
  );
  // Der Zeitpunkt der stehenden Antwort — gespeichert mit ihr, genannt im Hinweis.
  const [antwortAm, setAntwortAm] = useState<string | null>(anfang?.antwort?.angezeigtAm ?? null);
  // R-0338: der Quellenstand der stehenden Antwort, wie der SERVER ihn meldete, und die Fassungen,
  // die diese Fläche beim Eintreffen kannte — s. den Auffrischen-Vertrag in
  // `lib/fragenArbeitsstand.ts` (Regeln 3 und 4).
  const [quellenStand, setQuellenStand] = useState<QuellenStand | undefined>(
    anfang?.antwort?.serverQuellenStand,
  );
  const [beobachtet, setBeobachtet] = useState<QuellenStand | undefined>(
    anfang?.antwort?.beobachtet,
  );
  // R-0474 (Ben, Runde 1, B1): der Router montiert `/fragen` bei einem Wechsel NUR der Adresszeile
  // nicht neu — der Anfangswert oben sah eine zweite Übergabe (`/fragen?q=Alt` → Palette/Hilfe →
  // `/fragen?q=Neu`) also nie, im Feld blieb die alte Frage stehen. Jede NAVIGATION mit `?q=`
  // übernimmt deshalb ihre Frage ins Feld. Gebunden an den Navigationsschlüssel, nicht an den
  // Text: auch ein zweites Anbieten derselben Frage nach eigenem Tippen kommt an. Ohne `?q=` bleibt
  // das Feld, wie es ist.
  // Ergänzung 1: dieselbe Regel wie beim Aufbau — eine schon übernommene Adresse (gleiche Marke)
  // ist verbraucht und überschreibt den Arbeitsstand nicht noch einmal.
  const ersteNavigation = useRef(navigationsSchluessel);
  const gemerkteJetzt = useRef(gemerkteStartadressen);
  gemerkteJetzt.current = gemerkteStartadressen;
  useEffect(() => {
    if (navigationsSchluessel === ersteNavigation.current) {
      return;
    }
    ersteNavigation.current = navigationsSchluessel;
    const frage = readAskQuestion(params);
    const autoFrage = shouldAutoAskFromSearch(params);
    const marke = startadresseMarke(navigationsSchluessel, frage, autoFrage);
    if (frage === null || marke === null || gemerkteJetzt.current.includes(marke)) {
      // Ben L2 R2, B1: wer die Navigation einer Startfrage VERLÄSST (hierher ohne neue Startfrage),
      // nimmt ihren noch wartenden Antwortwunsch nicht mit — sonst ginge er nach Ende einer
      // laufenden Anfrage doch noch hinaus, obwohl die Seite längst woanders steht.
      setStartfrageGilt(false);
      return;
    }
    setAdresse({ frage, autoFrage, marke });
    setQ(frage);
    setStartfrageGilt(true);
    setGemerkteStartadressen((liste) => startadresseMerken(liste, marke));
    // Im Feld steht jetzt die angebotene Frage, nicht mehr der aufgenommene Entwurf.
    setWiederaufnahme((w) => (w?.antwortAm ? { entwurf: false, antwortAm: w.antwortAm } : null));
  }, [navigationsSchluessel, params]);
  // Ben L2 R2, B1: ändert der Nutzer die angebotene Startfrage im Feld (leeren = verwerfen,
  // umschreiben, diktieren), ist sie nicht mehr der Wunsch der Adresse. Ein noch wartender
  // Antwortwunsch verfällt damit; gesendet wird dann nur, was er selbst absendet.
  useEffect(() => {
    if (startfrageGilt && adresse.frage !== null && q !== adresse.frage) {
      setStartfrageGilt(false);
    }
  }, [q, startfrageGilt, adresse.frage]);
  // AUFTRAG-mega38 BLOCK J2: „Bitte gib zuerst eine Frage ein." stand auf `/fragen`, BEVOR die
  // Leserin irgendetwas getan hatte — eine Zurechtweisung als Begrüssung. Der Satz ist richtig,
  // sein Zeitpunkt war es nicht. Er erscheint jetzt erst, wenn wirklich leer abgesendet wurde.
  const [emptyAttempted, setEmptyAttempted] = useState(false);
  // ==============================================================================================
  // JOB 3038 — DAS FRAGEFELD HÖRT ZU. · JOB 3064 — UND ZWAR AN BEIDEN FELDERN GLEICH.
  // ==============================================================================================
  // Die Verdrahtung stand bis JOB 3064 hier inline. Das Zielbild gibt auch dem Startfeld ein
  // Mikrofon (`Main.dc.html` Z.41); eine zweite Abschrift wäre genau die Drift, gegen die JOB 3038
  // die Rekorder-Fabrik zusammengezogen hat. Sie ist deshalb in `components/start/useDiktat.ts`
  // UMGEZOGEN — mit beiden Eigenschaften, die sie brauchbar machen (identitätsgebundener Abschluss
  // gegen verspätete Rückläufe, Abbau der Fläche beendet die laufende Aufnahme). Erkanntes wird
  // ANGEHÄNGT, und das Stoppen löst KEINE Modellanfrage aus.
  const diktat = useDiktat((text: string) => setQ((prev) => (prev ? `${prev} ${text}` : text)));
  const speechSupported = diktat.moeglich;
  // R-1053: die Antwort auf Klick vorlesen — Browser-Sprachausgabe, kein Auto-Play.
  const vorlesen = useVorlesen();
  // JOB 3064 §5: zwei Schalter der Fläche — das Info-Blatt („…" → „Mehr") und die Beispielliste
  // im leeren Frage-Feld. Beide sind reine Anzeige-Zustände; keiner löst eine Modellanfrage aus.
  const [mehr, setMehr] = useState(false);
  // JOB 3102 UX-06 · KORREKTURPFLICHT 1 (Ben, Runde 1): DER Griff, an den das Blatt die Bedienung
  // zurückgibt. Diese Fläche hat das „…" an ZWEI Orten — in der Antwortkarte (`:1216`) und, solange
  // es keine gibt, oben in der Kopfzeile (`:811`). Sie schliessen einander aus, es steht also immer
  // GENAU EINER da; welcher, kann sich aber ändern, während das Blatt offen ist (Auffrischung
  // trifft als Wissenslücke ein). Deshalb hält beide Menüorte derselbe Ref, und das Blatt liest ihn
  // erst beim Schliessen — nicht beim Öffnen.
  const menuGriffRef = useRef<HTMLButtonElement | null>(null);
  const [beispiele, setBeispiele] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(anfang?.antwort?.result ?? null);
  // Eine neue (oder keine) Antwort: was gerade vorgelesen wird, gilt nicht mehr.
  const vorlesenStoppen = vorlesen.stoppen;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Absichts-Abhängigkeit — genau beim Antwortwechsel stoppen.
  useEffect(() => {
    vorlesenStoppen();
  }, [result, vorlesenStoppen]);
  // Ergänzung 1: welche Antwort aus dem Arbeitsstand kam (s. das Anspringen unter `revealResult`).
  const aufgenommeneAntwort = useRef<AnswerResult | null>(result);
  // JOB 2626 D1: die Torlage einer Nicht-Antwort — welche gefundenen Dokumente NICHT antworten
  // konnten und welches Tor bei ihnen zu ist (Freigabe/Stufe/Volltext). „Keine belastbare
  // Grundlage" war ehrlich und unbrauchbar; R3 des Design-Leads gilt auch hier: Störung sieht
  // niemals aus wie Leere. Kommt vom Server nur bei Nicht-Antwort und nur mit Betrachterfilter.
  const [verschlossen, setVerschlossen] = useState<VerschlossenHinweis[]>(
    anfang?.antwort?.verschlossen ?? [],
  );
  // AUFNAHME 20260922 · R-0284: wogegen DIESE Frage geprüft wurde — dieselbe Bindung an genau eine
  // Frage wie die Torlage. Nicht im Arbeitsstand: nach dem Neuladen steht ehrlich kein Satz, statt
  // eines Rahmens, den niemand mehr bestätigt hat.
  const [pruefrahmen, setPruefrahmen] = useState<AskPruefrahmen | null>(null);
  // FUNKE-FIX P0 (bens ROT-1): der Answer-Receipt DIESES Antwortvorgangs — das „Danke" je Quelle
  // reicht ihn zurück, damit der Server die Quellen-Bindung serverseitig belegen kann.
  const [receipt, setReceipt] = useState(anfang?.antwort?.receipt ?? "");
  // SCRUM-264: zuletzt gestellte Frage festhalten → für die Anzeige des Rescue-Blocks.
  const [asked, setAsked] = useState(anfang?.antwort?.frage ?? "");
  // R-0348: der Gesprächsfaden — die zuletzt beantworteten Fragen dieser Fragestrecke. Eine
  // wiederaufgenommene Antwort beginnt ihn; „Neues Thema" und ein Kontowechsel leeren ihn.
  const [faden, setFaden] = useState<string[]>(
    anfang?.antwort?.frage ? [anfang.antwort.frage] : [],
  );
  // Die zuletzt gestellte Frage steht schon in der Fragezeile; aufgezählt werden die früheren.
  const fadenFrueher = faden.filter((frage) => frage !== asked);
  // R-1633: wofür gefragt wird (Werk/Schicht/Rolle) und die Auskunft des Servers, wofür die
  // stehende Antwort gewichtet wurde. Die Angabe gilt für diese Sitzung der Seite; sie wird nicht
  // gespeichert.
  const [fragekontext, setFragekontext] = useState<Fragekontext>({});
  const [geltungsAuskunft, setGeltungsAuskunft] = useState<AskGeltungsauskunft | null>(null);
  // Ben, Nacharbeit 2: „Neues Thema" während einer laufenden Nachfrage. Die später eintreffende
  // Antwort darf ihre Frage nicht wieder in den geleerten Faden tragen — sie gehört zum alten
  // Thema. Jede Anfrage trägt die Generation, unter der sie startete (wie `kontoGeneration`).
  const fadenGeneration = useRef(0);
  const neuesThema = (): void => {
    fadenGeneration.current += 1;
    setFaden([]);
  };
  // FUNKE-FIX2 P0 (bens Erforderlich 4): die vom Server erzeugte Wissenslücke (mit ID) — der Capture-
  // Einstieg trägt die GAP-ID (kein Fragetext in der URL); Capture lädt den Text nach Berechtigung.
  const [gapId, setGapId] = useState<string | null>(anfang?.antwort?.gapId ?? null);
  const qc = useQueryClient();
  const guide = knowledgeGuidance("ask");

  // SCRUM-233: ehrlicher Reasoner-Modus aus vorhandenem read-only Status (kein Backend-Umbau).
  const reasonerStatus = useReasonerStatus();
  // PAKET 1 (D-AISTATE, Pedi 23.07.): die KI-Antwort (Reasoner-Task „answer") ohne nutzbares Modell
  // HART ausgrauen — kein stiller deterministischer Fallback, der „KI antwortet" vortäuscht.
  const answerAi = useAiAvailable("answer");
  const aiHintKey = answerAi.statusUnknown ? "ai.statusUnknown.hint" : "ai.unavailable.hint";
  // D5: hat der ADMINISTRATOR die KI abgeschaltet, sagt die Fläche das so — und nicht „nicht
  // verfügbar", was eine Störung meint. Die Absendesperre selbst bleibt `answerAi.available`: eine
  // abgeschaltete Aufgabe `answer` hat keinen nutzbaren Modellweg, der Server meldet sie `false`.
  const kiAbgeschaltet = reasonerStatus.data?.kiAbgeschaltet === true;
  // AUFTRAG-mega69 B1: kann ein Klick auf DIESE Aufgabe („answer") wirklich etwas kosten? Dieselbe
  // zentrale Ableitung (deriveAiBillable) wie an allen anderen Auslösestellen; ohne Auskunft
  // schweigt der Hinweis (AiCostHint rendert nur bei `true`).
  const answerBillable = useAiBillable("answer");
  const badge = reasonerBadge({
    status: reasonerStatus.data,
    isLoading: reasonerStatus.isLoading,
    isError: reasonerStatus.isError,
  });

  // SCRUM-250: KO-Bestand für lesbare Quellen-Titel (kein neuer Endpoint).
  const kos = useKos();
  // FUNKE F1 (nacht24): Wissensträger-Namen für die Quellen-Würdigung (Directory EINMAL je Seite;
  // Fallback bleibt ehrlich die Autor-Id).
  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts). Die
  // abgeschriebene Zeile hier sagte „Unbekannte Person", sobald das Verzeichnis nur NICHT DA war —
  // eine Aussage über die Person, wo gar keine feststand.
  const authorNameOf = useAuthorName();
  // SCRUM-357 / AG-14: konfliktbewusste Quellen — ein konfliktbetroffenes Quell-KO erscheint NICHT
  // als uneingeschränkt nutzbar/gesichert (effektive, konfliktbegrenzte Nutzbarkeit + Konflikt-Chip).
  const conflicts = useConflicts();
  // ==============================================================================================
  // AUFTRAG-mega33 BLOCK A (Pedi 27.07.) — HIER ENTSTEHT DIE EINSTUFUNG. GENAU EINMAL.
  // ==============================================================================================
  // Vorher bildeten sechs Stellen auf dieser Seite ihr eigenes Urteil aus der rohen Klasse; mega32
  // senkte nur den Vertragskasten ab, und darunter stand weiter „Gesichert" (bens ROT 3). Ab hier
  // gibt es EIN Ergebnis, und jede Anzeige, jeder Wächter und jeder Ausgabeweg liest ausschließlich
  // daraus — auch die mobile Seite, über dieselbe Funktion.
  // AUFTRAG-mega34 BLOCK A1 (bens schwerster Befund) — `conflicts.data ?? []` ist weg.
  // Der Vorgabewert las „noch nicht geladen" und „Abruf fehlgeschlagen" als „keine Konflikte" und
  // konnte eine Antwort dadurch fail-open als gesichert ausgeben. Jetzt reist der Konfliktstand mit
  // seiner Herkunft; unbelegt ⇒ nie „verified", dafür ein benannter Hinweis.
  const conflictKnown = conflictKnowledge(conflicts);
  const effective = result ? effectiveAnswer(result, kos.data ?? [], conflictKnown) : null;
  // R-0625 / R-1020 / R-1695: belegte Herkunft und daraus die Stufe dieser Antwort. „Validiert"
  // nur bei belegt modellfreier Herkunft UND belegter Einstufung — nie für einen Modelltext.
  const antwortHerkunft = result ? kiHerkunftAus(result) : "unbekannt";
  const antwortStufe = ergebnisStufeFuerAntwort(antwortHerkunft, effective?.grade === "verified");
  // AUFTRAG-mega52 A3: die Quellenliste bekommt eine Ordnung und ein Kennzeichen — tragende zuerst,
  // die übrigen als das, was sie sind. Ist die Zuordnung unbekannt (A5), bleibt alles in Ranking-
  // Reihenfolge und ohne Kennzeichen; der Hinweis darüber sagt dann warum. Eine Quelle, eine Regel
  // (lib/askCitedSources.ts) — Desktop, Mobil und Export lesen dieselbe.
  const answerSources = attributeSources(effective?.sources ?? [], result?.citedSources);
  // NUR die Rohauskunft „hat der Server überhaupt etwas gemeldet?". Sie ist bewusst so benannt,
  // seit sie NICHT mehr die Anzeige steuert: was die Fläche sagt, hängt an `zuordnungTragfaehig`
  // (unten) — nichtleer ist kein Beleg (Ben, Runde 2).
  const attributionRoh = citationState(result?.citedSources);
  // JOB 3064 · KORREKTURPFLICHT 1 (Ben, Runde 9): DIE TRAGENDEN QUELLEN ALS CHIP-NUMMERN.
  //
  // Bis hierher band die Antwortkarte ihre Fussnoten allein aus dem, was im Antworttext stand. Der
  // Deckungsrückfall des Reasoners („EINE MARKE IST KEIN BELEG", provider-model.ts) liefert aber
  // `answered:true` mit `citedSources` und einem Antworttext OHNE jede Klammer — dem Wortlaut der
  // tragenden Quelle. Bens Messung: ein Chip trug die Antwort, im Text stand keine Ziffer dazu.
  // Deshalb reicht die Karte die Zuordnung des SERVERS herein, statt sie aus dem Text zu erraten.
  // Die Nummer ist dieselbe wie am Chip (Stelle in `result.sources`, s. dort). Ist die Zuordnung
  // unbekannt (`unattributed`: alter Server oder Modell ohne verwertbare Marke) oder trägt keine
  // gemeldete Quelle eine Stelle in `sources`, bleibt sie `undefined` — dann gibt es keine Zusage,
  // gegen die man messen könnte, und es gilt die alte Regel aus dem Text.
  const tragendeNummern = ((): number[] | undefined => {
    if (attributionRoh !== "attributed" || !result) {
      return undefined;
    }
    const nummern = (result.citedSources ?? [])
      .map((id) => result.sources.indexOf(id) + 1)
      .filter((n) => n > 0);
    return nummern.length > 0 ? nummern : undefined;
  })();
  // JOB 3267 R3 · KORREKTURPFLICHT 1 (Ben, Runde 2) — DIE EINE FRAGE: TRÄGT DIE ZUORDNUNG?
  //
  // `tragendeNummern` ist genau dann gesetzt, wenn mindestens eine gemeldete Kennung eine Stelle in
  // `result.sources` hat. Das ist dieselbe Prüfung, die die Quellenauskunft braucht — deshalb steht
  // sie hier EINMAL und wird von Chip, Quellenliste, Hinweistext und Export gemeinsam gelesen. Bens
  // Gegenfall (`citedSources: ["ko-gibt-es-nicht"]`, zwei vorhandene Quellen) lief bis hierher als
  // „attributed" durch und liess beide Quellen „nicht verwendet" heissen; ab hier ist er das, was er
  // ist: keine verwertbare Zuordnung, also „Zuordnung unbekannt".
  const zuordnungTragfaehig = tragendeNummern !== undefined;
  const checkCaveat = effective?.caveat ?? null;
  const conflictCaveat = effective?.conflictCaveat ?? null;
  // AUFTRAG-mega53 B6 (beim Bauen des Sammlers gefunden, über ben's vier Stellen hinaus): der
  // Wächter beschriftete sich aus ALLEN herangezogenen Quellen — `sources.some(validated === false)`.
  // Eine bloß angesehene offene Quelle ließ ihn damit „stützt sich auf offene Quellen" sagen,
  // obwohl die TRAGENDE Quelle validiert war. Auch das ist eine Aussage über die Antwort und
  // gehört deshalb auf die tragende Teilmenge. Bei unbekannter Zuordnung ist sie leer — dann sagt
  // er die allgemeine, nicht die quellenbezogene Fassung.
  const reviewGuard = effective
    ? answerReviewGuard(effective.grade, effective.carryingSources)
    : null;
  // R-0287: wie viele Warnkästen zu dieser Antwort gelten. Steht einer da, trägt die Antwortkarte
  // den Warnblock `ask-warnungen` direkt hinter der Antwort.
  const vorbehalte = [
    reviewGuard !== null,
    effective?.sourcesConflicted === true,
    conflictCaveat !== null,
    checkCaveat !== null,
  ].filter(Boolean).length;
  // SCRUM-366 / FR-ASK-02 / PI-K2: Antwortvertrag — quellengebunden, ehrlich (gesichert vs. ungeprüft
  // vs. Wissenslücke), kein generischer Chatbot. Nur noch die Beschriftung der Einstufung.
  const contract = effective ? answerContract(effective.grade) : null;
  const sourceSummary = result?.answered ? answerSourceSummary(answerSources) : null;

  // WP-UX-WOW-1 U3/U5: die Frage reist als Mutations-PARAMETER — Chips/Direkt-Sender rufen
  // ask.mutate(frage) im selben Handler wie setQ auf, ohne auf den nächsten Render zu warten
  // (der alte q-Closure hätte sonst die VORHERIGE Eingabe gesendet).
  // KORREKTURPFLICHT 2 (Ben, Runde 5): die Frage, zu der die STEHENDE Antwort gehört. Bewusst ein
  // Ref und kein Zustand: es steuert keine Darstellung, sondern beantwortet beim Absenden die eine
  // Frage „ist das dieselbe wie eben?" — ein Zustand würde dafür einen Renderdurchlauf erzwingen,
  // der genau zwischen `setAsked` und `mutate` fiele.
  // Ergänzung 1: eine wiederaufgenommene Antwort gehört zu ihrer gespeicherten Frage — dieselbe
  // Frage erneut zu stellen ist damit eine Auffrischung, wie bei einer eben angekommenen Antwort.
  const antwortFrage = useRef(anfang?.antwort?.frage ?? "");
  // Ergänzung 1 · Ben R1, F1 — EINE ANFRAGE GEHÖRT DEM KONTO, FÜR DAS SIE GESTELLT WURDE.
  // Bis Runde 1 schrieb eine noch laufende Anfrage ihre Antwort nach einem Kontowechsel in die
  // Fläche — und damit in den Stand — des NEUEN Kontos. Jede Anfrage trägt jetzt die Generation
  // der Fläche mit, unter der sie startete; ein echter Kontowechsel zählt sie hoch (s. den Effekt
  // „DIE KENNUNG KOMMT ODER WECHSELT"), und eine Antwort aus einer älteren Generation wird
  // verworfen, bevor sie irgendeinen Zustand berührt. Das erste Bekanntwerden der Kennung ist
  // kein Wechsel: dieselbe Person, keine neue Generation.
  const kontoGeneration = useRef(0);
  const ask = useMutation({
    mutationFn: (anfrage: AskAnfrage) =>
      // R-1633: mit Fragekontext reist er mit; ohne bleibt es bei den bisherigen Aufrufen.
      anfrage.kontext
        ? endpoints.ask.ask(
            anfrage.frage,
            toReasonerLocale(i18n.language),
            anfrage.faden,
            anfrage.kontext,
          )
        : // R-0348: ohne Faden genau der bisherige Aufruf.
          anfrage.faden.length > 0
          ? endpoints.ask.ask(anfrage.frage, toReasonerLocale(i18n.language), anfrage.faden)
          : endpoints.ask.ask(anfrage.frage, toReasonerLocale(i18n.language)),
    // D5: eine schon offene Fläche kennt die Abschaltung noch nicht — der Server hat sie eben
    // gemeldet. Der Status wird neu gelesen, damit der Absendeknopf danach gesperrt ist und der
    // Hinweis dasteht, statt dass der Mensch dieselbe Absage ein zweites Mal abholt.
    onError: (fehler: unknown) => {
      if (fehler instanceof ApiError && fehler.code === "KI_ABGESCHALTET") {
        void qc.invalidateQueries({ queryKey: ["reasoner", "status"] });
      }
    },
    // ============================================================================================
    // AUFTRAG-mega39 BLOCK C (ben, sammel37-mega38) — DAS ERGEBNIS GEHÖRT ZU GENAU EINER FRAGE.
    // ============================================================================================
    // Bis mega38 ersetzte nur `onSuccess` den Zustand. Während des Ladens war die alte Antwort
    // korrekt ausgeblendet (`!ask.isPending && result`) — nach einem FEHLER aber nicht: `result`
    // trug noch die vorige Antwort, `asked` schon die neue Frage, und beides stand mit dem
    // Fehlerkasten gleichzeitig auf dem Bildschirm. Der Export hätte dieselbe Verwechslung
    // mitgenommen. Für Vertrauen ist das schlimmer als eine reine Fehlermeldung.
    //
    // Die Bindung entsteht hier, beim START: eine neue Frage räumt alles ab, was zur VORIGEN
    // gehört — Antwort, Answer-Receipt und die Lücken-Id. Damit gibt es keinen Zustand mehr, in
    // dem ein Ergebnis zu einer anderen Frage gerendert oder exportiert werden könnte; ein
    // fehlgeschlagener Ask endet zwangsläufig bei „kein Ergebnis + Meldung".
    // KORREKTURPFLICHT 2 (Ben, Runde 5): DIESELBE Frage erneut zu stellen ist eine AUFFRISCHUNG,
    // kein Themenwechsel. Bis Runde 5 räumte `onMutate` bedingungslos ab — wer dieselbe Frage noch
    // einmal absendete, sah seine Antwort verschwinden und eine leere Fläche, bis die neue kam.
    // §9 des Auftrags verlangt genau umgekehrt: „Cache mit laufender Auffrischung = alte Antwort
    // bleibt, Sendeknopf zeigt Spinner."
    //
    // Die Zusage von mega39 Block C („das Ergebnis gehört zu genau einer Frage") bleibt dabei
    // vollständig in Kraft — sie wird sogar hier, an der Wurzel, durchgesetzt: abgeräumt wird
    // immer dann, wenn die neue Frage eine ANDERE ist als die, zu der die stehende Antwort gehört.
    // `antwortFrage` ist der Beleg dafür, welche Frage das ist; es wird ausschliesslich in
    // `onSuccess` gesetzt, also nur von einer wirklich angekommenen Antwort.
    onMutate: ({ frage: question }: AskAnfrage) => {
      if (question === antwortFrage.current) {
        return;
      }
      antwortFrage.current = "";
      setResult(null);
      setReceipt("");
      setGapId(null);
      setThankedSources(new Set());
      // JOB 2626 D1: dieselbe Bindung wie für Antwort/Receipt/Lücke — die Torlage gehört zu genau
      // einer Frage und darf nie neben dem Ergebnis einer anderen stehen.
      setVerschlossen([]);
      setPruefrahmen(null);
      // R-1633: dieselbe Bindung — die Gewichtungsauskunft gehört zu genau einer Antwort.
      setGeltungsAuskunft(null);
    },
    // SCRUM-138: Backend liefert { result, gap, receipt } — Antwort + Answer-Receipt entpacken.
    onSuccess: (r, { frage: question, generation, fadenGeneration: fadenStand }) => {
      // Ben R1, F1: die Antwort eines anderen (früheren) Kontos berührt nichts.
      if (generation !== kontoGeneration.current) {
        return;
      }
      // Der Beleg für „zu welcher Frage gehört das, was da steht" — s. `onMutate`.
      antwortFrage.current = question;
      // R-0348: die angekommene Frage wird Teil des Fadens, an den die nächste Frage anknüpft.
      // Nicht, wenn inzwischen ein neues Thema begonnen wurde (Ben, Nacharbeit 2).
      if (fadenStand === fadenGeneration.current) {
        setFaden((vorher) => fadenNachAntwort(vorher, question));
      }
      setAntwortAm(new Date().toISOString());
      // JOB 2694 D1: eine Antwort ohne Text kommt hier als Lücke an — Begründung am Helfer oben.
      // R-0310: `selectAnswer` lässt nur die belegten Absätze stehen (Marke je Absatz; ohne belegten
      // Absatz die Lücke). Anzeige, Export, Kopieren, Druck und Vorlesen lesen alle diesen Stand.
      const angekommen = leereAntwortAlsLuecke(selectAnswer(r));
      setResult(angekommen);
      // R-0338 (Ben, Nacharbeit 3): die Fassung ihrer Quellen, wie der SERVER sie zu dieser Antwort
      // gelesen hat — und daneben, getrennt, was diese Fläche gerade von ihnen kennt (nur Untergrenze
      // für spätere Änderungen, Regel 4 an `antwortFrische`).
      setQuellenStand(quellenStandAus(angekommen.sources, r.quellenStand));
      setBeobachtet(beobachtungAus(angekommen.sources, kos.data));
      setReceipt(r.receipt);
      // JOB 2626 D1: abwesend heißt „nicht gefragt oder nichts zu melden" — beides fällt ehrlich
      // auf die leere Liste und damit auf die generische Leermeldung zurück.
      setVerschlossen(r.verschlossen ?? []);
      setPruefrahmen(r.pruefrahmen ?? null);
      // R-1633: abwesend heißt „ohne Fragekontext gefragt" — dann steht keine Auskunft da.
      setGeltungsAuskunft(r.geltung ?? null);
      // FUNKE-FIX2 P0: die neue Lücke merken (ID für den Capture-Einstieg) und die Gap-Liste
      // invalidieren, damit Capture die frisch erzeugte Lücke über ihre ID auflösen kann (der Ersteller
      // ist berechtigt → Volltext). Kein Fragetext in der URL.
      setGapId(r.gap?.id ?? null);
      if (r.gap) {
        void qc.invalidateQueries({ queryKey: ["gaps"] });
      }
    },
  });
  // Ben R1, F8: eine abgelehnte Rückmeldung (etwa ein inzwischen abgelaufener Beleg) wird gesagt,
  // nicht verschluckt — sonst sah der Klick aus, als sei nichts geschehen.
  const { push } = useToast();
  const rueckmeldungAbgelehnt = (): void => push("error", t("ask.rueckmeldungAbgelehnt"));
  const helpful = useMutation({
    mutationFn: (koId: string) => endpoints.ask.helpful(koId, receipt),
    onError: rueckmeldungAbgelehnt,
  });
  // FUNKE F2 (nacht24 Paket 6): „Das hat mir geholfen" je QUELLE — Ein-Klick, einmal je
  // Nutzer+Ziel (der Server ist idempotent; die Sitzung merkt sich bedankte Quellen). FUNKE-FIX P0:
  // der Klick reicht den Answer-Receipt zurück (Quellen-Bindung serverseitig belegt).
  const [thankedSources, setThankedSources] = useState<ReadonlySet<string>>(new Set());
  const thankSource = useMutation({
    mutationFn: (koId: string) => endpoints.ask.helpful(koId, receipt),
    onSuccess: (_data, koId) => setThankedSources((prev) => new Set(prev).add(koId)),
    onError: rueckmeldungAbgelehnt,
  });
  // Ben R1, F8: eine WIEDERAUFGENOMMENE Antwort trägt ihren alten Beleg. Ist er abgelaufen, bietet
  // die Fläche die Rückmeldung nicht mehr an, sondern sagt, warum — und wie es wieder geht.
  const belegGueltig = belegNochGueltig(receipt, antwortAm, Date.now());
  // R-1649: „Das war nicht hilfreich, ich habe es so gemacht …" ins Fragefeld gesprochen — erkannt
  // beim Absenden (`lib/nichtHilfreich.ts`), gespeichert erst nach der Bestätigung in der Karte.
  // Ziel ist dieselbe tragende Quelle wie beim „Hat geholfen", mit demselben Beleg.
  const [nichtHilfreich, setNichtHilfreich] = useState<NichtHilfreichOffen | null>(null);
  const [nichtHilfreichErledigt, setNichtHilfreichErledigt] =
    useState<NichtHilfreichErledigt | null>(null);
  const quelleTitel = (koId: string): string =>
    (kos.data ?? []).find((ko) => ko.id === koId)?.title ?? koId;
  const nichtHilfreichMelden = useMutation({
    mutationFn: ({ koId, alternative }: { koId: string; alternative: string | null }) =>
      endpoints.ask.notHelpful({
        koId,
        receipt,
        ...(alternative
          ? {
              alternative,
              entwurfTitel: t("sprachfeedback.entwurfTitel", {
                titel: quelleTitel(koId),
              }),
            }
          : {}),
      }),
    onSuccess: (r) => {
      setNichtHilfreich(null);
      setNichtHilfreichErledigt({ entwurfId: r.entwurfId });
      setQ("");
    },
    onError: rueckmeldungAbgelehnt,
  });

  // Ergänzung 1 · SCHREIBEN: jede Änderung an Entwurf oder stehender Antwort geht in den Stand
  // DIESES Kontos. Eine neue Frage räumt die alte Antwort in `onMutate` ab — damit ist auch der
  // Wiederherstellungsstand sofort der neue. Ein geleertes Feld ist ein verworfener Entwurf.
  // Kein Schreiben ohne Kennung und keines, solange die Fläche noch den Stand eines anderen Kontos
  // zeigt (`standFuer`) — sonst landete fremde Arbeit unter der neuen Kennung.
  useEffect(() => {
    if (konto === null || konto !== standFuer) {
      return;
    }
    const frage = antwortFrage.current;
    arbeitsstandSchreiben(fragenSpeicher(), konto, {
      entwurf: q,
      antwort:
        result && frage
          ? {
              frage,
              result,
              receipt,
              verschlossen,
              gapId,
              angezeigtAm: antwortAm ?? new Date().toISOString(),
              ...(quellenStand ? { serverQuellenStand: quellenStand } : {}),
              ...(beobachtet ? { beobachtet } : {}),
            }
          : null,
      startadressen: gemerkteStartadressen,
    });
  }, [
    konto,
    standFuer,
    q,
    result,
    receipt,
    verschlossen,
    gapId,
    antwortAm,
    quellenStand,
    beobachtet,
    gemerkteStartadressen,
  ]);

  // Ergänzung 1 · DIE KENNUNG KOMMT ODER WECHSELT bei stehender Fläche.
  //   · WECHSEL (vorher ein anderes Konto): der Stand des neuen Kontos ersetzt den alten
  //     vollständig — fremde Arbeit bleibt nicht auf dem Bildschirm stehen. Eine noch laufende
  //     Anfrage des alten Kontos wird abgehängt (`reset`) und ihre Generation ungültig (Ben R1, F1);
  //     die Startadresse gilt für das neue Konto nicht.
  //   · ERSTES BEKANNTWERDEN (vorher keine Kennung, etwa weil `/auth/me` noch lief): es wird nur
  //     aufgefüllt, was leer ist. Steht noch die unveränderte Startfrage im Feld und hat dieser
  //     Stand die Adresse schon übernommen (Neuladen), gewinnt der Stand (Ben R1, F2). Schon
  //     Getipptes und eine stehende oder laufende Antwort bleiben.
  //   · Wird die Kennung nur kurz unbekannt (Auffrischung, Netzlücke), bleibt alles stehen — es
  //     wird dann bloss nicht geschrieben.
  // Der aktuelle Stand wird über einen Ref gelesen: der Effekt soll auf die KENNUNG reagieren,
  // nicht auf jeden Tastendruck.
  const flaecheJetzt = useRef({ q, result, wartet: ask.isPending, startfrageGilt });
  flaecheJetzt.current = { q, result, wartet: ask.isPending, startfrageGilt };
  const askZuruecksetzen = ask.reset;
  useEffect(() => {
    if (konto === null || konto === standFuer) {
      return;
    }
    const gelesen = arbeitsstandLesen(fragenSpeicher(), konto);
    const wechsel = standFuer !== null;
    const jetzt = flaecheJetzt.current;
    if (wechsel) {
      kontoGeneration.current += 1;
      askZuruecksetzen();
    }
    const adresseVerbraucht =
      adresse.marke !== null && (gelesen?.startadressen ?? []).includes(adresse.marke);
    const startfrageUnberuehrt = jetzt.startfrageGilt && jetzt.q === (adresse.frage ?? "");
    const entwurfNehmen =
      wechsel || jetzt.q.trim() === "" || (startfrageUnberuehrt && adresseVerbraucht);
    const antwortNehmen = wechsel || (jetzt.result === null && !jetzt.wartet);
    const startfrageBleibt = !wechsel && jetzt.startfrageGilt && !entwurfNehmen;
    const entwurf = entwurfNehmen ? (gelesen?.entwurf ?? "") : jetzt.q;
    const antwort = antwortNehmen ? (gelesen?.antwort ?? null) : null;
    if (entwurfNehmen) {
      setQ(entwurf);
    }
    if (antwortNehmen) {
      antwortFrage.current = antwort?.frage ?? "";
      aufgenommeneAntwort.current = antwort?.result ?? null;
      setResult(antwort?.result ?? null);
      setReceipt(antwort?.receipt ?? "");
      setVerschlossen(antwort?.verschlossen ?? []);
      setPruefrahmen(null);
      setGapId(antwort?.gapId ?? null);
      setAsked(antwort?.frage ?? "");
      // R-0348: der Faden gehört zum Konto — er beginnt bei der übernommenen Antwort neu.
      setFaden(antwort?.frage ? [antwort.frage] : []);
      setAntwortAm(antwort?.angezeigtAm ?? null);
      setQuellenStand(antwort?.serverQuellenStand);
      setBeobachtet(antwort?.beobachtet);
      setThankedSources(new Set());
    }
    setStartfrageGilt(startfrageBleibt);
    setGemerkteStartadressen(
      wechsel
        ? (gelesen?.startadressen ?? [])
        : startadresseMerken(gelesen?.startadressen ?? [], adresse.marke),
    );
    setWiederaufnahme(
      wiederaufnahmeAus(
        gelesen && {
          entwurf: entwurfNehmen ? entwurf : "",
          antwort,
          startadressen: gelesen.startadressen,
        },
        !entwurfNehmen,
      ),
    );
    setStandFuer(konto);
  }, [konto, standFuer, adresse, askZuruecksetzen]);

  // ==============================================================================================
  // AUFTRAG-mega38 BLOCK A (Pedi 27.07.) — DIE ANTWORT MUSS ANKOMMEN.
  // ==============================================================================================
  // Live gemessen: der Antwortblock beginnt bei 674 px in einem 678 px hohen Sichtbereich. Bis
  // mega37 setzte `onSuccess` nur Zustand — kein Ref, kein `scrollIntoView`, kein Fokuswechsel —
  // und am künftigen Ergebnisort stand nichts, solange `ask.isPending` galt. Auf dem Bildschirm
  // passierte nach dem Klick also NICHTS ausser einem grau werdenden Knopf; Pedi hat selbst zweimal
  // geklickt. Ein Fehlerfall war überhaupt nicht dargestellt.
  //
  // Der Anker ist BEWUSST immer im DOM (auch vor der ersten Frage): sonst wäre `resultRef.current`
  // in genau dem Moment leer, in dem der Ladezustand beginnt — und dann käme der Leser erst beim
  // Ergebnis mit, nicht schon beim Warten.
  // KORREKTURPFLICHT 2 (Ben, Runde 3): DIE Bedingung, unter der die Antwortkarte steht — und damit
  // die Weiche, welches der beiden Seitenblätter „Mehr" rendert. Sie steht EINMAL hier, damit
  // „Karte sichtbar" und „Blatt hängt in der Karte" nicht auseinanderlaufen können: genau ein
  // Blatt ist sichtbar, nie zwei und nie keines.
  // KORREKTURPFLICHT 2 (Ben, Runde 5): `!ask.isPending` ist hier WEG. Eine laufende Anfrage blendete
  // die vorhandene Antwort aus — auch dann, wenn es DIESELBE Frage war, also eine blosse
  // Auffrischung. §9 verlangt das Gegenteil: „Cache mit laufender Auffrischung = alte Antwort
  // bleibt, Sendeknopf zeigt Spinner."
  // Die Bindung an genau eine Frage (mega39 Block C) bleibt trotzdem lückenlos, und zwar an ihrer
  // Wurzel: `onMutate` räumt `result` ab, sobald eine ANDERE Frage startet. Steht während eines
  // laufenden Asks also noch ein `result`, dann kann es nur zur laufenden Frage gehören — eine
  // fremde Antwort ist hier strukturell unerreichbar, nicht bloss unwahrscheinlich.
  // R-0330 (Ben R1, F5): „Kann Klara Wissen oder Rechte gerade nicht sicher prüfen, erscheint keine
  // Teilantwort." Bis hierher stand die Antwort bei einem abgerissenen Konflikt- oder
  // Bestandsabruf weiter da, nur mit Vorbehalt (mega34). Ohne Konfliktstand ist nicht prüfbar, ob
  // die tragende Quelle umstritten ist; ohne Bestand nicht, was sie ist und ob sie gilt. Dann steht
  // statt der Antwort EIN Satz mit EINER Aktion — und die Aktion holt genau das nach, was fehlte,
  // statt das Modell erneut zu fragen. Ein Abruf, der NOCH LÄUFT, ist keine Störung: dort bleibt
  // der benannte Vorbehalt aus mega34 (er schweigt, sobald der Abruf durch ist).
  //
  // Ben R2, F5 — ZWEI LÜCKEN DIESER REGEL GESCHLOSSEN:
  //   · Sie galt nur für `answered: true`. Eine Nicht-Antwort bei abgerissenem Abruf sah wie eine
  //     Wissenslücke aus — die Störung als Leere, genau das, was R-0330 verbietet. Sie gilt jetzt
  //     für JEDES Ergebnis.
  //   · „Erneut versuchen" startet die Abrufe neu; react-query setzt einen Abruf ohne Altdaten dabei
  //     auf „pending", und `pending` war hier keine Störung — die gesperrte Antwort erschien, bevor
  //     irgendetwas geprüft war. Nach einem Wiederholversuch bleibt die Sperre deshalb stehen, bis
  //     BEIDE Abrufe erfolgreich durch sind (`pruefungWiederholt`).
  const [pruefungWiederholt, setPruefungWiederholt] = useState(false);
  const pruefungBelegt = conflictKnown.state === "loaded" && kos.isSuccess;
  useEffect(() => {
    if (pruefungWiederholt && pruefungBelegt) {
      setPruefungWiederholt(false);
    }
  }, [pruefungWiederholt, pruefungBelegt]);
  const pruefungGestoert =
    Boolean(result) &&
    (conflictKnown.state === "failed" || kos.isError || (pruefungWiederholt && !pruefungBelegt));
  // R-0338 — DER AUFFRISCHEN-VERTRAG (Regeln an `antwortFrische`, lib/fragenArbeitsstand.ts): hat
  // sich eine Quelle der stehenden Antwort seither geändert, steht sie nicht mehr da. Geprüft wird
  // gegen denselben Bestand, aus dem die Quellenzeilen ihre Titel lesen; er lädt beim Öffnen und
  // bei Fensterfokus neu. Neu erzeugt wird nichts von selbst — „Neu fragen" stellt die Frage.
  const antwortUeberholt =
    result !== null &&
    antwortFrische(
      { quellen: result.sources, stand: quellenStand, beobachtet, am: antwortAm },
      kos.data,
      // Ben, Nacharbeit 5: wann der Bestand zuletzt erfolgreich geladen wurde (0 = noch nie).
      kos.dataUpdatedAt,
    ) === "ueberholt";
  const karteSichtbar =
    Boolean(result) && Boolean(contract) && !pruefungGestoert && !antwortUeberholt;
  // Ben R2, F10: welche Sperrgründe liegen in der Torlage WIRKLICH vor — in fester Reihenfolge —,
  // und welcher Prüfweg passt dazu (nur Freigabe und Stufe entstehen in der Prüfung).
  const verschlossenGruende = (["freigabe", "stufe", "volltext"] as const).filter((grund) =>
    verschlossen.some((h) =>
      grund === "freigabe" ? h.freigabeFehlt : grund === "stufe" ? h.stufeFehlt : h.volltextFehlt,
    ),
  );
  const pruefFreigabe = verschlossenGruende.includes("freigabe");
  const pruefStufe = verschlossenGruende.includes("stufe");
  const verschlossenPruefweg =
    pruefFreigabe && pruefStufe
      ? "ask.verschlossen.pruefPfad.beides"
      : pruefFreigabe
        ? "ask.verschlossen.pruefPfad.freigabe"
        : pruefStufe
          ? "ask.verschlossen.pruefPfad.stufe"
          : null;
  // Die Antwortkarte im engeren Sinn — die Weiche, welches der beiden „Mehr"-Blätter rendert.
  // KORREKTURPFLICHT 1 (Ben, Runde 5): bis hierher hing sie an `karteSichtbar`, und im LÜCKENFALL
  // war das wahr, ohne dass die Antwortkarte (und damit ihr Blatt) existierte — das sichtbare
  // „Mehr" öffnete nichts. Jetzt fragt die Weiche genau das, was sie meint.
  const antwortkarteSichtbar = karteSichtbar && Boolean(result?.answered);
  // Läuft eine Auffrischung DERSELBEN Frage? Genau dann steht schon eine Antwort da.
  const auffrischungLaeuft = ask.isPending && Boolean(result);
  // Ist eine Auffrischung GESCHEITERT, während die alte Antwort steht? §9: „ein Satz unter der
  // Karte" — nicht der Fehlerkasten, der „es gibt kein Ergebnis" bedeutet.
  const auffrischungGescheitert = ask.isError && Boolean(result);
  // D5: die Absage kam, weil der Administrator die KI abgeschaltet hat — nicht, weil etwas hakte.
  // Sie bekommt ihren eigenen Wortlaut und keinen „Erneut versuchen"-Knopf.
  const abgeschaltetAbgewiesen =
    ask.error instanceof ApiError && ask.error.code === "KI_ABGESCHALTET";
  // R-0842: die KI-Bremse hat abgewiesen. Das ist kein Hängenbleiben — der Server nennt in seinem
  // Satz die Wartezeit, und genau dieser Satz steht da statt des allgemeinen Fehlertexts.
  // Der Satz wird hier aus dem verengten `ApiError` gelesen: der Fehlertyp der Mutation ist in
  // dieser App `{}` (kein `message` ohne Verengung).
  const gebremstSatz =
    ask.error instanceof ApiError && ask.error.code === "KI_ANFRAGEN_GEBREMST"
      ? ask.error.message
      : null;
  const gebremstAbgewiesen = gebremstSatz !== null;

  const resultRef = useRef<HTMLDivElement | null>(null);
  // ==============================================================================================
  // JOB 3102 UX-06 · KORREKTURPFLICHT 1 (Ben, Runde 1) — DIE ERGEBNISFLÄCHE HOLT DEN FOKUS NICHT
  // AUS DEM OFFENEN BLATT HERAUS.
  // ==============================================================================================
  // GEMESSEN (bens Gegenprobe): Auffrischung starten, „Mehr" öffnen, Auffrischung als Wissenslücke
  // eintreffen lassen — der Fokus stand danach auf `ask-result-anchor`, und zwar mit einem
  // `[inert]`-Vorfahren. Also genau dort, wo mit der Tastatur nichts mehr geht: A2 unten holte den
  // Fokus in einen Bereich, den das offene Blatt gerade gesperrt hatte.
  // „Die Antwort muss ankommen" (mega38) bleibt in Kraft — was bleibt, ist das ANSPRINGEN; nur der
  // Fokus wandert nicht, solange das Blatt die Bedienung hält. Es ist keine zweite Fokusverwaltung:
  // hier wird kein Fokus gesetzt, sondern einer unterlassen.
  // Als Ref gelesen, NICHT als Abhängigkeit: hinge `revealResult` an `mehr`, liefe A2 beim
  // SCHLIESSEN erneut und risse den eben zurückgegebenen Fokus wieder vom „…"-Knopf weg.
  const mehrRef = useRef(mehr);
  mehrRef.current = mehr;
  const revealResult = useCallback((withFocus: boolean): void => {
    const el = resultRef.current;
    if (!el) {
      return;
    }
    // `block: "start"` — kein Sprung mitten in den Text; der Kopf der Ergebnisfläche steht oben.
    // Die Existenzprüfung ist kein Test-Zugeständnis: `scrollIntoView` fehlt in jsdom UND in
    // eingeschränkten Einbettungen. Fehlt es, bleibt wenigstens der Fokuswechsel — die Antwort
    // darf nicht daran scheitern, dass die Seite nicht scrollen kann.
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (withFocus && !mehrRef.current) {
      // `preventScroll`, damit der Fokus die eben gesetzte Position nicht zweitens verschiebt.
      el.focus({ preventScroll: true });
    }
  }, []);
  // A1: der Ladezustand rückt selbst ins Bild — sonst wartet der Leser vor einer Stelle, die er
  // gar nicht sieht. Ohne Fokuswechsel: hier ist noch nichts zu lesen.
  useEffect(() => {
    if (ask.isPending) {
      revealResult(false);
    }
  }, [ask.isPending, revealResult]);
  // A2: Antwort UND Wissenslücke — beide setzen `result`, beide sind ein Ergebnis. Der Fokus geht
  // mit, damit Tastatur und Screenreader an derselben Stelle weiterlesen wie das Auge.
  // Ergänzung 1: eine WIEDERAUFGENOMMENE Antwort ist nicht angekommen, sie stand schon da — sie
  // holt weder Fokus noch Bildlauf, damit das Fragefeld beim Öffnen an seinem Platz bleibt.
  useEffect(() => {
    if (result && result !== aufgenommeneAntwort.current) {
      revealResult(true);
    }
  }, [result, revealResult]);
  // A3: der Fehlerfall ist derselbe Mangel — eine Meldung unterhalb des Randes ist keine Meldung.
  useEffect(() => {
    if (ask.isError) {
      revealResult(true);
    }
  }, [ask.isError, revealResult]);

  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): der EINE zentrale Submit für Formular, Chips UND
  // Auto-Ask — mit Availability- UND Pending-Guard. Ohne nutzbares Modell löst KEIN Weg (auch kein
  // programmatischer) eine Mutation aus; ein laufender Ask wird nie doppelt gefeuert.
  const submitAsk = useCallback(
    (question: string): void => {
      const trimmed = question.trim();
      if (!trimmed || !answerAi.available || ask.isPending) {
        return;
      }
      setAsked(trimmed);
      setStartfrageGilt(false);
      // Ergänzung 1: wer eine Frage stellt, arbeitet weiter — der Wiederaufnahme-Hinweis hat
      // seinen Zweck erfüllt.
      setWiederaufnahme(null);
      // R-0286 (Ben, Nacharbeit 6): die Beispielliste steht zwischen Feld und Ergebnis. Bliebe sie
      // nach dem Absenden offen, stünden Beispieltexte und Hinweise zwischen Feld und Antwort. Sie
      // schliesst deshalb hier — nur bei einem ANGENOMMENEN Absenden, für Feld, Chip und Auto-Ask.
      setBeispiele(false);
      // R-1649: eine neue Frage beendet eine offene oder erledigte „nicht hilfreich"-Rückmeldung.
      setNichtHilfreich(null);
      setNichtHilfreichErledigt(null);
      const kontext = fragekontextZumSenden(fragekontext);
      ask.mutate({
        frage: trimmed,
        generation: kontoGeneration.current,
        faden: fadenFuerAnfrage(faden, trimmed),
        fadenGeneration: fadenGeneration.current,
        ...(kontext ? { kontext } : {}),
      });
    },
    [answerAi.available, ask.isPending, ask.mutate, faden, fragekontext],
  );

  // WP-UX-WOW-1 U2/U3: Beispiel-Chip → Frage setzen UND direkt senden (ein Klick → Antwort).
  const askExample = (question: string): void => {
    setQ(question);
    submitAsk(question);
  };
  // Ergänzung 1: „Entwurf verwerfen" leert das Feld — und weil der Arbeitsstand dem Feld folgt,
  // ist der Entwurf damit auch aus dem Speicher fort. Eine stehende Antwort bleibt.
  const entwurfVerwerfen = (): void => {
    setQ("");
    setEmptyAttempted(false);
    setWiederaufnahme((w) => (w?.antwortAm ? { entwurf: false, antwortAm: w.antwortAm } : null));
  };
  // Chips stabil je Bestand memoisiert (die Zufallswahl würfelt sonst bei jedem Render neu).
  const exampleChips = useMemo(() => buildAskExampleChips(kos.data ?? []), [kos.data]);

  // SCRUM-460: Kommt der Nutzer aus der Bibliothek-Suche mit ausdrücklichem Antwort-Wunsch
  // (?ask=1), wird die vorbefüllte Frage EINMAL automatisch beantwortet — so liefert die Suche
  // eine echte Antwort mit Quellen. Sonst (SCRUM-272) bleibt es beim reinen Vorbefüllen.
  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): der Auto-Ask läuft über DENSELBEN zentralen Submit
  // wie Formular und Chips (kein ask.mutate-Direktaufruf mehr — bens Rest-Bypass 6.2). Er wartet,
  // bis der Verfügbarkeits-Status GELADEN ist, und verbraucht seinen Ein-Schuss dann GENAU EINMAL:
  // Modell nutzbar → automatisch fragen; kein Modell → KEINE Mutation (die Frage bleibt nur
  // vorbefüllt, der Hinweis erklärt es).
  //
  // R-0474 · Ben B3 (Runde 2): EIN SCHUSS JE NAVIGATION, UND ER FEUERT DIE FRAGE DER ADRESSE.
  // Bis hierher las der Auto-Ask den Feldzustand `q` und hatte einen Schuss je MONTAGE. Seit
  // `/fragen` bei einem Adresswechsel seine Frage übernimmt (Effekt oben), kam `?q=Neu&ask=1` auf
  // der offenen Seite in einem Durchlauf an, in dem `params` schon neu, `q` aber noch alt war — und
  // gesendet wurde die ALTE Frage, während das Feld danach die neue zeigte. Jetzt lesen Vorbefüllung
  // und Auto-Ask dieselbe Quelle (`readAskQuestion(params)`), und verbraucht wird der Schuss der
  // jeweiligen Navigation (`location.key`). Ohne `ask=1` wird weiterhin nichts gesendet (SCRUM-272).
  // Läuft gerade eine Anfrage, wartet der Schuss, statt still zu verfallen.
  // Ergänzung 1 (Ben R1, F3): der Antwortwunsch gilt nur, solange die Adresse nicht schon übernommen
  // wurde (`startfrageGilt`) — eine wiederaufgenommene Antwort wird gezeigt, nicht neu erfragt. Der
  // Schuss hängt an der Marke der Adresse (Navigationsschlüssel + Frage + Wunsch).
  const autoAskedFuer = useRef<string | null>(null);
  useEffect(() => {
    if (autoAskedFuer.current === adresse.marke || answerAi.isLoading || ask.isPending) {
      return;
    }
    // Nur der Wunsch DER Navigation, auf der die Seite gerade steht (Ben L2 R2, B1).
    const zurNavigation = adresse.marke?.startsWith(`${navigationsSchluessel}:`) === true;
    if (
      zurNavigation &&
      adresse.autoFrage &&
      startfrageGilt &&
      adresse.frage !== null &&
      adresse.frage.trim()
    ) {
      autoAskedFuer.current = adresse.marke;
      // WP-UX-WOW-1 U5: die Startfrage auch als Lücken-/Capture-Kontext festhalten (wie Submit) —
      // das übernimmt submitAsk; ohne nutzbares Modell passiert bewusst NICHTS.
      submitAsk(adresse.frage);
    }
  }, [
    adresse,
    navigationsSchluessel,
    startfrageGilt,
    answerAi.isLoading,
    ask.isPending,
    submitAsk,
  ]);

  // SCRUM-430 (VIP): beantwortete Frage inkl. Quellen exportieren/teilen. Quellen bleiben klar
  // ausgewiesen (Status/Trust/Nutzbarkeit). Markdown wird erst beim Klick gebaut (frischer Zeitstempel).
  const kosById = new Map((kos.data ?? []).map((k) => [k.id, k]));
  // ==============================================================================================
  // JOB 3267 Q1 — DIE GERENDERTEN FUSSNOTEN, AM DOM GEMESSEN.
  // ==============================================================================================
  // Die Konsistenzregel darf sich nicht auf eine ZWEITE Rechnung stützen, welche Marken wohl
  // entstehen werden (`markiereFussnoten` noch einmal aufrufen wäre genau das, und es liefe still
  // weg, sobald `AntwortText` seine Regeln ändert). Gemessen wird deshalb, was WIRKLICH im Baum
  // steht — derselbe Anker, an dem `tests/design/zielbild-h5-fragen.test.ts` (V18) die Marken in
  // Chromium abliest.
  //
  // `useLayoutEffect` OHNE Abhängigkeitsliste: die Messung soll jedem Renderdurchlauf folgen
  // (neuer Antworttext, neue Zuordnung, geöffnetes Blatt), und sie muss VOR dem Bild fallen —
  // sonst zeigte die Fläche für einen Frame „unbekannt" und korrigierte sich danach. Keine
  // Schleife: der Zustand ist ein Schlüssel-String, und ein gleicher Wert lässt React abbrechen.
  const antwortRef = useRef<HTMLDivElement | null>(null);
  const [markenSchluessel, setMarkenSchluessel] = useState<string | null>(null);
  useLayoutEffect(() => {
    const wurzel = antwortRef.current;
    const naechster =
      wurzel === null
        ? null
        : [...wurzel.querySelectorAll(".ask-answer-body sup[data-fussnote]")]
            .map((e) => Number(e.getAttribute("data-fussnote")))
            .filter((n) => Number.isInteger(n) && n > 0)
            .sort((a, b) => a - b)
            .join(",");
    setMarkenSchluessel((vorher) => (vorher === naechster ? vorher : naechster));
  });
  const gerenderteMarken = new Set(
    (markenSchluessel ?? "")
      .split(",")
      .filter((s) => s !== "")
      .map(Number),
  );
  // ==============================================================================================
  // JOB 3267 Q1 — EINE AUSKUNFT JE QUELLE, VON CHIP, LISTE UND EXPORT GEMEINSAM GELESEN.
  // ==============================================================================================
  // Vorher entschied jede der drei Stellen für sich, was sie über eine Quelle sagt — und genau so
  // konnte der Punkt am Chip etwas anderes behaupten als die Plakette in der Liste. Ab hier fällt
  // die Entscheidung einmal. Der PRÜFSTAND kommt aus `anzeigestatusAus` (die Ableitung der
  // Bibliothek), die VERWENDUNG aus `verwendungsZustand` — zwei Felder, weil es zwei Fragen sind.
  const quellenAuskunft = answerSources.map((s) => {
    const ko = kosById.get(s.id);
    const nummer = result ? result.sources.indexOf(s.id) + 1 : 0;
    const stand = ko ? anzeigestatusAus(ko, { konflikt: s.conflictLimited }).status : null;
    const standWort = stand ? t(`status.${stand}`) : t("ask.pruefstand.unbekannt");
    return {
      ...s,
      nummer,
      verwendung: verwendungsZustand({
        zuordnungTragfaehig,
        carrying: s.carrying,
        nummer,
        gemessen: markenSchluessel !== null,
        marken: gerenderteMarken,
      }),
      pruefstand: stand,
      pruefstandWort: standWort,
      // Der Satz am gelben Punkt und an der Prüfstand-Plakette: er sagt, was er zeigt, und sagt
      // ausdrücklich dazu, dass er über die Verwendung NICHTS aussagt.
      pruefstandHinweis: t("ask.pruefstand.hint", { stand: standWort }),
    };
  });
  // Aufnahme 20260922 · R-0310/R-0325 (Ben zu 8e6c9d73) — DIE QUELLENREIHE UNTER DER ANTWORT.
  // Sie nennt nur, worauf die Antwort steht: bei tragfähiger Zuordnung die tragenden Quellen (und
  // jede, deren Marke sichtbar im Text steht — Marke und Chip fallen nie auseinander, JOB 3267 Q7).
  // Ist die Zuordnung unbekannt, gibt es keine solche Teilmenge; dann bleiben alle mit dem
  // Kennzeichen „unbekannt" stehen (R-0325: ehrlich benennen). Höchstens drei unmittelbar, weitere
  // über „+N" (dieselbe Bauform wie das Word-Panel). Die ausführliche Auskunft über ALLE
  // herangezogenen Quellen bleibt getrennt in der Quellenliste unter „Mehr" (`QuellenListe`).
  const chipQuellen = zuordnungTragfaehig
    ? quellenAuskunft.filter((s) => s.carrying || gerenderteMarken.has(s.nummer))
    : quellenAuskunft;
  const [alleChips, setAlleChips] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Absichts-Abhängigkeit — je Antwort wieder kurz.
  useEffect(() => {
    setAlleChips(false);
  }, [result]);
  const sichtbareChips = alleChips ? chipQuellen : chipQuellen.slice(0, QUELLEN_CHIPS_SICHTBAR);
  const weitereChips = chipQuellen.length - sichtbareChips.length;
  // Aufnahme 20260922 · antwort-quellenanzeige (R-0326): der Weg aus der Antwort an die Belegstelle.
  // Eine TRAGENDE Quelle führt auf `/wissen/:id?stelle=…&fassung=…` (lib/belegstelle.ts) — Passage
  // ist, was der Server als Beleg dieser Quelle zitiert (`steps[].snippet`, sonst ihre Aussage),
  // Fassung ihre Inhaltsversion; die Lesefläche sucht, markiert und springt dorthin. Eine nur
  // herangezogene Quelle hat keine tragende Passage und führt auf die blosse Objektadresse.
  const quellenHref = (id: string): string => {
    const quelle = quellenAuskunft.find((q) => q.id === id);
    const ko = kosById.get(id);
    const zitiert = result?.steps.find((st) => st.sourceId === id)?.snippet ?? ko?.statement ?? "";
    const stelle =
      quelle?.carrying && zitiert.trim() !== ""
        ? { passage: zitiert, fassung: ko?.version ?? null }
        : null;
    return demoHref(belegstelleHref(id, stelle), params);
  };
  // R-0703 / R-0625 (Ben Nacharbeit 2): EINE Exporteingabe für Markdown, Word, PowerPoint und PDF —
  // mit der DREIWERTIGEN Herkunft. Bis hierher machte die Fragenseite aus „unbekannt" ein `false`.
  const exportEingabe = (): AnswerExportInput | null => {
    if (!result?.answered || !effective) {
      return null;
    }
    const generatedAt = new Date().toISOString();
    const sources = quellenAuskunft.map((s) => {
      const ko = kosById.get(s.id);
      return {
        // JOB 502 (Klara-Export, Quellidentität): die Kennung, mit der diese Seite direkt darunter
        // auf `/wissen/${s.id}` verlinkt, reist jetzt MIT in den Export. Bis hierher wurde sie hier
        // weggeworfen — im Markdown blieben von zwei Fassungen desselben Dokuments zwei
        // buchstabengleiche Zeilen übrig, und die Fundstelle war nicht mehr auffindbar. Bewusst
        // OHNE Ersatzwert: `s.id` ist die reale Bestands-Id (aus `sourceRefs()`, gespeist aus
        // `AnswerResult.sources`) und immer vorhanden; ein Fallback würde eine Kennung erfinden,
        // wo gerade keine feststeht — genau der Fehler, den mega34 an anderer Stelle beseitigt hat.
        sourceId: s.id,
        title: s.label,
        ...(ko ? { statusLabel: t(`status.${ko.status}`), trust: ko.trust } : {}),
        ...(s.usability ? { usabilityLabel: t(useReadiness(s.usability).labelKey) } : {}),
        // AUFTRAG-mega62 Block E (Register F29): das Kennzeichen reist jetzt MIT. Bis mega61 wurde
        // hier nur die Reihenfolge exportiert — tragende Quellen standen oben, aber nichts sagte
        // das, und im Markdown sah eine nur konsultierte Quelle aus wie eine tragende.
        // JOB 3267 Q1: das Kennzeichen ist jetzt der DREIWERTIGE Zustand, also auch „unbekannt" für
        // die einzelne widersprüchliche Quelle. Die Gesamtbedingung bleibt bewusst stehen: ist die
        // Zuordnung INSGESAMT nicht tragfähig, trägt keine Zeile ein Kennzeichen — und genau daran
        // erkennt `buildAnswerMarkdown` (answerExport.ts:164), dass es den Erklärsatz
        // `attributionUnknown` ÜBER die Liste setzen muss. Ein Wort je Zeile und der Satz darüber
        // wären zwei Aussagen zur selben Sache.
        // R3 (Ben): geprüft wird die TRAGFÄHIGKEIT, nicht mehr die blosse Nichtleerheit — sonst
        // trüge der Export bei einer unauflösbaren Zuordnung „nicht verwendet" in die Datei, die das
        // Haus verlässt.
        ...(zuordnungTragfaehig ? { attributionLabel: t(VERWENDUNG_BADGE[s.verwendung]) } : {}),
      };
    });
    return {
      question: asked || q,
      answer: result.answer ?? "",
      // AUFTRAG-mega33 A2: Kopieren und Markdown-Download exportieren die EFFEKTIVE Einstufung.
      // Vorher stand im Export weiter „Gesichert", während die Seite bereits einen Prüfvorbehalt
      // zeigte — der Export ist die Form, die das Haus verlässt und am längsten überlebt.
      statusLabel: t(`ask.status.${effective.status.key}`),
      evidenceLabel: t(effective.evidence.labelKey),
      trust: result.trust,
      steps: result.steps.map((s) => ({ description: s.description, snippet: s.snippet })),
      sources,
      generatedAt,
      // R-0625: belegt KI / belegt modellfrei / unbekannt — nur „ohne-ki" schaltet die Kennzeichnung
      // in der Datei aus (`exportKennzeichnen`).
      kiHerkunft: kiHerkunftAus(result),
      labels: {
        answer: t("ask.export.answer"),
        evidence: t("ask.evidence"),
        trust: t("val.trust"),
        steps: t("ask.steps"),
        sources: t("ask.sources"),
        footer: t("ask.export.footer"),
        // AUFTRAG-mega62 Block E: die KI-Kennzeichnung im Wortlaut aus Abschnitt 8 des
        // Rechtsdokuments — mit eingesetzter Aufgabe und Datum, damit sie sagt, WAS wann erzeugt
        // wurde, statt nur „irgendwas mit KI".
        aiNotice: t("ai.exportNotice", {
          task: t("ai.task.answer"),
          date: generatedAt.slice(0, 10),
        }),
        ...(zuordnungTragfaehig ? {} : { attributionUnknown: t("ask.attribution.unknown") }),
      },
    };
  };
  const buildExport = (): { markdown: string; filename: string } | null => {
    const eingabe = exportEingabe();
    if (!eingabe) {
      return null;
    }
    return {
      markdown: buildAnswerMarkdown(eingabe),
      filename: answerExportFilename(eingabe.generatedAt),
    };
  };
  const herunterladen = (inhalt: Blob, dateiname: string): void => {
    const url = URL.createObjectURL(inhalt);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    a.click();
    URL.revokeObjectURL(url);
  };
  // R-0703: Word, PowerPoint und PDF als echte Dateien — mit der Kennzeichnung in ihren
  // Eigenschaften (lib/antwortDateien.ts). Der Druckweg bleibt unverändert daneben.
  const dateiHerunterladen = (format: AntwortDateiformat): void => {
    const eingabe = exportEingabe();
    if (!eingabe) {
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = buildAnswerDatei(eingabe, format);
    } catch (fehler) {
      // Ben Nacharbeit 4: lieber KEINE PDF-Datei als eine mit verändertem Inhalt. Die Meldung
      // nennt die Zeichen und den verlustfreien Weg (Word, Markdown).
      if (fehler instanceof PdfZeichenNichtDarstellbar) {
        push("error", t("ask.export.pdfZeichen", { zeichen: fehler.zeichen.join(" ") }));
        return;
      }
      throw fehler;
    }
    const inhalt = new Blob([bytes.buffer as ArrayBuffer], { type: ANTWORT_DATEI_TYP[format] });
    herunterladen(inhalt, antwortDateiname(eingabe.generatedAt, format));
  };
  const copyAnswer = (): void => {
    const ex = buildExport();
    if (!ex) {
      return;
    }
    void navigator.clipboard?.writeText(ex.markdown).then(
      () => push("success", t("ask.export.copied")),
      () => push("error", t("state.error")),
    );
  };
  const downloadAnswer = (): void => {
    const ex = buildExport();
    if (!ex) {
      return;
    }
    herunterladen(new Blob([ex.markdown], { type: "text/markdown;charset=utf-8" }), ex.filename);
  };
  // SCRUM-440-Muster: nur den markierten Auszug (.print-area) drucken; Klasse nach dem Druck entfernen.
  const printAnswer = (): void => {
    document.body.classList.add("printing-extract");
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("printing-extract"),
      {
        once: true,
      },
    );
    window.print();
  };

  return (
    // ==============================================================================================
    // JOB 3064 · H5 — DIE FRAGENFLÄCHE NACH DEM ZIELBILD `design/klarwerk/Fragen.dc.html`.
    // ==============================================================================================
    // Bis hierher standen VOR dem Eingabefeld: Kicker, Titel, Hilfe-Knopf, Einleitungssatz,
    // Modus-Chip mit zweitem Hilfe-Knopf, Beispiel-Etikett, Sofort-Hinweis, Kostenhinweis und acht
    // Beispiel-Chips — und NACH der Antwort Vertragskasten, Zählzeile, Wissensklassen, drei
    // Vorbehalte, zwei Quellenlisten und drei Werkzeugknöpfe. Das Zielbild lässt vier Dinge übrig:
    // die Frage als gedämpfte Zeile, EINE Antwortkarte, zwei Knöpfe, das Feld unten. Die Lage des
    // Feldes folgt seit Nacharbeit 2 NICHT mehr dem Zielbild, sondern R-0286: Feld, darunter die
    // Antwort (Begründung bei `FrageFeld` unten).
    //
    // NICHTS DAVON IST GESTRICHEN. Alles Übrige liegt hinter „…" → „Mehr" im Info-Blatt weiter
    // unten (`ask-mehr`) — mit denselben Wortlauten, denselben Testankern und derselben
    // Ableitung. Das Blatt steht im Quelltext NACH dem Feld: D-034 („erst fragen, dann erklären")
    // gilt weiter, und die Ergebnisfläche drängt sich nicht dazwischen.
    <div
      data-testid="page-fragen"
      className="mx-auto flex min-h-full w-[800px] max-w-full flex-col gap-[22px] pb-8 pt-9"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Zielbild Z.38: die gestellte Frage als gedämpfte Zeile — 14 px, Tinte-2. */}
        <p data-testid="ask-fragezeile" className="min-w-0 flex-1 text-[14px] text-muted-2">
          {asked}
        </p>
        {/* Das „…" gehört an die Antwortkarte (§5). Solange es keine gibt, steht es hier — genau
            EIN Menü ist zu jeder Zeit auf der Fläche, und „Mehr" ist von Anfang an erreichbar. */}
        {karteSichtbar && result?.answered ? null : (
          <OverflowMenu
            label={t("ask.menu.label")}
            testId="ask-menu"
            griffRef={menuGriffRef}
            punkte={[{ id: "mehr", label: t("ask.menu.mehr") }]}
            onWahl={() => setMehr(true)}
          />
        )}
      </div>
      {/* Ergänzung 1 (Pedi 28.09.2026): beim Wiederkommen steht OBEN, was aufgenommen wurde und wo
          es weitergeht — ein Satz, keine Karte, damit das Fragefeld ohne Bildlauf sichtbar bleibt.
          Die Antwort wird ausdrücklich als NICHT neu erzeugt benannt, mit ihrem Zeitpunkt. */}
      {/* R-0338: ist die aufgenommene Antwort überholt, steht sie nicht „darunter" — der Satz nennt
          dann nur den Entwurf, und ohne Entwurf entfällt er (der Überholt-Hinweis sagt den Rest). */}
      {wiederaufnahme && (wiederaufnahme.entwurf || !antwortUeberholt) ? (
        <div
          data-testid="ask-wiederaufnahme"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn bg-page px-3 py-2 text-[12.5px] text-muted"
        >
          <p className="min-w-0 flex-1">
            {wiederaufnahme.entwurf && wiederaufnahme.antwortAm && !antwortUeberholt
              ? // R-0286: die Antwort steht jetzt UNTER dem Feld — der alte Satz sagte „darüber".
                t("fragenseite.wiederaufnahmeBeides", {
                  zeit: formatKoTimestamp(wiederaufnahme.antwortAm, i18n.language),
                })
              : wiederaufnahme.entwurf
                ? t("ask.wiederaufnahme.entwurf")
                : t("ask.wiederaufnahme.antwort", {
                    zeit: formatKoTimestamp(wiederaufnahme.antwortAm, i18n.language),
                  })}
          </p>
          {wiederaufnahme.entwurf ? (
            <button
              type="button"
              data-testid="ask-entwurf-verwerfen"
              onClick={entwurfVerwerfen}
              className="shrink-0 text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
            >
              {t("ask.wiederaufnahme.verwerfen")}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="ask" /> : null}

      {/* SCRUM-295: im Demo-/Use-Kontext mit vorbefüllter Startfrage (z. B. aus KO-Detail „Wissen
          nutzen") ehrlich führen: Frage ist nur Startpunkt, kein Auto-Submit; Antwort bleibt
          quellengebunden, Status/Trust entscheiden. Ohne Demo-Kontext unverändert. */}
      {isDemoContext(params) && isPrefilledAskQuestion(params) && !result ? (
        <p className="mb-2 rounded-btn bg-page px-2.5 py-2 text-[12px] text-muted-2">
          {t("ask.demoPrefillHint")}
        </p>
      ) : null}

      {/* WP-POLISH-CLOSE (bens Punkt 1): Frage zu einem VERTRAULICHEN KO wurde nur vorbefüllt
          (kein Auto-Send) — nüchterner Hinweis, der Nutzer sendet bewusst selbst. */}
      {isConfidentialAskPrefill(params) && !result ? (
        <p className="mb-2 rounded-btn bg-trust-warn-bg px-2.5 py-2 text-[12px] text-trust-warn-text">
          {t("ask.confidentialPrefillHint")}
        </p>
      ) : null}

      {/* ============================================================================================
          DIE REIHENFOLGE: FRAGE → FELD → ERGEBNIS, IM QUELLTEXT UND AUF DEM BILDSCHIRM.
          ============================================================================================
          R-0286 (Originalauftrag, Ben Nacharbeit 2): „Nach dem Absenden einer Frage ist die Antwort
          das erste, was der Nutzer liest — direkt unter dem Eingabefeld." Bis hierher setzte das
          Zielbild H5 (`Fragen.dc.html` Z.45, `margin-top: auto`) das Feld per `order` sichtbar UNTER
          die Antwortkarte. Das Feld steht jetzt an seiner Quelltextstelle; D-034 („erst fragen,
          dann erklären") und die Tastaturfolge Feld → Antwort bleiben, und die sichtbare Lage
          stimmt mit ihr überein. Gemessen als Geometrie in `tests/design/zielbild-h5-fragen.test.ts`
          (V16: das Feld liegt ÜBER der Antwortkarte, die Antwort folgt direkt darunter).
          Feld und seine Hinweise stehen in EINEM Block: leere Hinweise kosten so keinen eigenen
          Flex-Abstand zwischen Feld und Antwort. */}
      <div>
        {/* FE-003: das Formular ist der gemeinsame Baustein `FrageFeld` — dasselbe Bauteil führt das
          Tutorial „Fragen“ vor. Hier bleibt, was nur DIESE Seite entscheidet: was ein Absenden
          auslöst, wann ein leerer Versuch vermerkt wird und ob ein Modell nutzbar ist.
          Zielbild Z.48 (runder Sendeknopf, Spinner als Wartezustand), JOB 3038 (Mikrofon im Feld)
          und §5 (Beispiele im leeren Feld) stehen am Baustein. */}
        {/* R-0348: der Gesprächsfaden steht ÜBER dem Feld — die nächste Frage knüpft sichtbar an
            die vorigen an und fängt nicht bei null an. Ein Klick beginnt ein neues Thema. Die
            Antwort bleibt quellengebunden (R-0345: kein offener Chatbot). */}
        {faden.length > 0 ? (
          <div
            data-testid="ask-gespraechsfaden"
            className="mb-2 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-btn bg-page px-3 py-2 text-[12.5px] text-muted"
          >
            <div className="min-w-0 flex-1">
              <p>{t("fragenseite.fadenTitel")}</p>
              {fadenFrueher.length > 0 ? (
                <ol className="mt-1 list-decimal pl-5 text-muted-2">
                  {fadenFrueher.map((frage) => (
                    <li key={frage} data-testid="ask-gespraechsfaden-frage" className="break-words">
                      {frage}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
            <button
              type="button"
              data-testid="ask-gespraechsfaden-neu"
              onClick={neuesThema}
              className="shrink-0 text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
            >
              {t("fragenseite.fadenNeu")}
            </button>
          </div>
        ) : null}
        {/* R-0603: der KI-Hinweis DIESER Fläche — dauerhaft, ohne Griff, vor der ersten Frage.
            Er behauptet keine Erzeugung (R-0604); die steht an der Antwort, gebunden an die
            Servermarke. ÜBER dem Feld, weil zwischen Feld und Antwort nichts stehen darf (R-0286). */}
        <p data-testid="ask-ki-flaechensatz" className="m-0 mb-2">
          <AiSurfaceNotice />
        </p>
        {/* R-1633: „Ich frage für" Werk/Schicht/Rolle — gleich passende Quellen dieses Orts
            stehen vorn; nichts wird ausgeblendet. Zugeklappt, solange niemand es braucht. */}
        <FragekontextWahl wert={fragekontext} onWert={setFragekontext} kos={kos.data ?? []} />
        {/* R-1628: „Was wäre, wenn …" — welche Wissensobjekte an die bisherige Bedingung gebunden
            sind, welche die neue ausschließen und welche für beide belegt sind (ohne KI, aus dem
            geladenen Bestand; zugeklappt). „Mit Klara durchspielen" stellt den Wechsel als Frage
            über DENSELBEN Submit wie Feld und Chips — Quellenpflicht und KI-Sperre inklusive. */}
        <Bedingungswechsel
          kos={kos.data}
          fehler={kos.isError}
          onDurchspielen={askExample}
          kiVerfuegbar={answerAi.available}
          kiSperrHinweis={!answerAi.available ? t(aiHintKey) : undefined}
          wartet={ask.isPending}
        />
        <FrageFeld
          wert={q}
          onWert={setQ}
          onAbsenden={() => {
            // PAKET 3.1 (D-AISTATE, bens V4): Enter/Formular läuft über DENSELBEN zentralen Submit wie
            // Chips und Auto-Ask — die harte KI-Sperre (Availability + Pending) sitzt in submitAsk;
            // kein Weg umgeht die ausgegraute Schaltfläche (bens Bypass-Befund 6.2).
            // AUFTRAG-mega38 BLOCK J2: der Fehlversuch wird HIER vermerkt — der Knopf ist bei leerer
            // Frage gesperrt, per Eingabetaste kommt man aber sehr wohl bis hierher.
            setEmptyAttempted(q.trim().length === 0);
            // R-1649: steht eine belegte Antwort mit tragender Quelle da und sagt der Text „nicht
            // hilfreich", wird nicht gefragt, sondern die Bestätigung gezeigt. Ohne gültigen Beleg
            // bleibt es eine gewöhnliche Frage — eine Rückmeldung ginge dann ohnehin ins 403.
            // Das Diktat HÄNGT AN: nach einer Antwort steht deren Frage noch im Feld, und der
            // gesprochene Satz folgt dahinter. Gelesen wird deshalb nur, was neu dazukam.
            const tragend = result?.answered ? (result.citedSources ?? [])[0] : undefined;
            const frageVorher = antwortFrage.current;
            const gesagt =
              frageVorher && q.trimStart().startsWith(frageVorher)
                ? q.trimStart().slice(frageVorher.length)
                : q;
            const erkannt = tragend && belegGueltig ? erkenneNichtHilfreich(gesagt) : null;
            if (tragend && erkannt) {
              setNichtHilfreichErledigt(null);
              setNichtHilfreich({ koId: tragend, alternative: erkannt.alternative });
              return;
            }
            submitAsk(q);
          }}
          // E2E-018 / AUFTRAG-mega39 BLOCK G: „ungültig" erst NACH dem Fehlversuch — im Takt mit der
          // sichtbaren Meldung (mega38 J2), nicht ab dem ersten Bildaufbau.
          ungueltig={emptyAttempted && q.trim().length === 0}
          beschreibungId="ask-empty-hint"
          beispieleOffen={beispiele}
          onBeispiele={() => setBeispiele((v) => !v)}
          diktat={speechSupported ? diktat : null}
          wartet={ask.isPending}
          gesperrt={!answerAi.available}
          sperrHinweis={!answerAi.available ? t(aiHintKey) : undefined}
          lage="oben"
        />
        {/* E2E-018: zugängliche Inline-Meldung — nur wenn ein Modell da ist (sonst greift der
          Unavailable-Hinweis), damit klar ist, warum der Knopf gesperrt ist.
          R-0286 (Nacharbeit 5): ein LEERER Hinweis trägt keinen Abstand — gemessen standen sonst
          50 px zwischen Feld und Antwort, ohne dass dort etwas zu lesen war. Der Live-Bereich bleibt
          immer im Baum, damit ein später gesetzter Satz angesagt wird. */}
        <output
          id="ask-empty-hint"
          aria-live="polite"
          className="block text-[12px] text-muted [&:not(:empty)]:mt-3"
        >
          {answerAi.available && emptyAttempted && q.trim().length === 0 ? t("ask.emptyHint") : ""}
        </output>
        {nichtHilfreich ? (
          <NichtHilfreichKarte
            key={`${nichtHilfreich.koId}:${nichtHilfreich.alternative}`}
            quelleTitel={quelleTitel(nichtHilfreich.koId)}
            alternative={nichtHilfreich.alternative}
            laeuft={nichtHilfreichMelden.isPending}
            onBestaetigen={(alternative) =>
              nichtHilfreichMelden.mutate({ koId: nichtHilfreich.koId, alternative })
            }
            onAlsFrage={() => {
              setNichtHilfreich(null);
              submitAsk(q);
            }}
            onVerwerfen={() => setNichtHilfreich(null)}
          />
        ) : null}
        {nichtHilfreichErledigt ? (
          <output
            data-testid="ask-nicht-hilfreich-erledigt"
            className="mt-3 block text-[13px] text-muted"
          >
            {nichtHilfreichErledigt.entwurfId
              ? t("sprachfeedback.erledigtMitEntwurf")
              : t("sprachfeedback.erledigt")}{" "}
            {nichtHilfreichErledigt.entwurfId ? (
              <RoleLink
                to={`/erfassen?draft=${encodeURIComponent(nichtHilfreichErledigt.entwurfId)}`}
                testId="ask-nicht-hilfreich-entwurf"
                className="inline-flex items-center gap-1 font-semibold text-brand-text"
                hoverClassName="hover:underline"
              >
                {() => t("sprachfeedback.entwurfOeffnen")}
              </RoleLink>
            ) : null}
          </output>
        ) : null}
        <span className="block [&:not(:empty)]:mt-3">
          {/* ====================================================================================
            JOB 4224 · D5, LIEFERUNG 5 — DIE LAGE ZU NENNEN IST NICHT DASSELBE WIE EINEN WEG ZU
            ZEIGEN.
            ====================================================================================
            Bis hierher stand hier GENAU EIN Satz: „KI nicht verfügbar — für diese Aufgabe ist kein
            Modell aktiv." Er ist wahr und er ist eine Sackgasse; gemessen im Cloud-Lauf
            dd9ef2e8… (Fall A1: kein einziger erlaubter Weg im Baum). Daneben steht jetzt, was
            OHNE Modell trotzdem geht — der Bestand durchsuchen und Wissen erfassen.

            ES WIRD NICHTS FREIGEGEBEN UND NICHTS GESENDET: hier stehen zwei Verweise auf
            vorhandene Seiten, kein Schalter, kein Abruf. Der Sendeknopf bleibt gesperrt (die
            Bedingung darüber ist unverändert), und der Satz sagt das ausdrücklich — sonst läse
            sich ein Angebot wie eine stille Ersatzfreigabe.

            ÜBER `RoleLink`, nicht über `Link`: /erfassen verlangt „experte". Ein Ziel, das die
            Rolle nicht erreicht, wird als Lage gezeigt, nicht als Weg — dasselbe EINE Tor wie
            überall auf dieser Fläche (AUFTRAG-mega71 Block E). */}
          {/* FE-003: Satz und Alternativen sind der gemeinsame Baustein `KiNichtVerfuegbar` — das
            Tutorial „Fragen“ erklärt genau diesen Zustand (Schritt 6) mit demselben Bauteil.
            D5: hat der Administrator die KI abgeschaltet, nennt der Satz DIESE Lage
            (`d5kiaus.hinweis`) statt „nicht verfügbar"; die Alternativen bleiben dieselben. */}
          {!answerAi.available ? (
            kiAbgeschaltet ? (
              <KiNichtVerfuegbar
                hinweisKey="d5kiaus.hinweis"
                hinweisTestId="ask-ki-abgeschaltet-hinweis"
              />
            ) : (
              <KiNichtVerfuegbar hinweisKey={aiHintKey} />
            )
          ) : null}
        </span>

        {/* WP-UX-WOW-1 U2/U3 (statt SCRUM-265-Statik): ehrliche Beispiel-Chips. Antwort-Beispiele
          kommen aus dem ECHTEN validierten Bestand (Badge damit ehrlich korrekt), dazu EINE bewusste
          Lücken-Frage; ohne validierten Bestand neutrale statische Beispiele ohne Behauptung.
          Klick sendet DIREKT — kein zweiter Klick nötig.
          JOB 3064 §5: sie stehen nicht mehr dauerhaft unter dem Feld, sondern hinter dem Knopf
          „Beispiele" IM leeren Feld. Sie bleiben im DOM und an ihrer Stelle gebunden; `hidden` nimmt
          sie aus Fluss, `innerText` und Zugänglichkeitsbaum. */}
        {/* `hidden` UND die Anzeigeklasse: das HTML-Attribut allein reicht nicht, sobald am selben
          Element eine Tailwind-Display-Klasse steht — `.flex { display: flex }` gewinnt gegen die
          `[hidden]`-Regel des Browsers, und der Block bliebe sichtbar. Gemessen: der Textmesser hat
          genau das gefunden („Ein Klick fragt sofort …" stand im Sichtfeld von /fragen). */}
        <div
          data-testid="ask-beispiele"
          hidden={!beispiele}
          className={`mt-3 flex-wrap items-center gap-1.5 ${beispiele ? "flex" : "hidden"}`}
        >
          {/* AUFTRAG-mega51 BLOCK H: ein Klick auf ein Beispiel löst SOFORT eine Modellanfrage aus
            (`askExample` → `submitAsk`). Das soll so sein — ein Beispiel, das nur das Feld füllt,
            wäre kein Beispiel. Aber es muss VORHER erkennbar sein. Kein Bestätigungsdialog: ein
            Halbsatz an der Beschriftung und derselbe Hinweis als `title` an jedem Chip.
            AUFTRAG-mega69 B1 (bens sammel65-Auflage 1): der Halbsatz trägt nur noch die
            SOFORT-Zusage; die KOSTEN-Hälfte steht daneben als zentraler, BEDINGTER AiCostHint —
            derselbe Schlüssel, dieselbe Ableitung (billable je Aufgabe) wie überall sonst. Läuft
            „answer" lokal/deterministisch oder fehlt die Auskunft noch, schweigt der Kostensatz. */}
          <span className="text-[10.5px] text-muted-2">{t("ask.examplesSendHint")}</span>
          <AiCostHint billable={answerBillable} className="text-[10.5px]" />
          {exampleChips.map((chip) => {
            const question =
              chip.kind === "ko" ? t("ask.koQuestion", { title: chip.title }) : t(chip.questionKey);
            const expect =
              chip.kind === "ko"
                ? askExpectation("answerable")
                : chip.expectation === "gap"
                  ? askExpectation("gap")
                  : null;
            return (
              <button
                key={question}
                type="button"
                disabled={ask.isPending || !answerAi.available}
                onClick={() => askExample(question)}
                title={t("ask.examplesSendHint")}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-pill border border-hairline px-2.5 py-1 text-[12px] text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
              >
                {/* Das Zeichen sagt vor dem Klick: hier geht etwas raus. */}
                <span aria-hidden="true" className="shrink-0 text-muted-2">
                  ↵
                </span>
                <span className="min-w-0 max-w-[16rem] truncate">{question}</span>
                {expect ? (
                  <span
                    className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${EXPECT_TONE[expect.tone]}`}
                  >
                    {t(expect.labelKey)}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
                    {t("ask.expect.neutral")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* AUFTRAG-mega38 BLOCK A: DIE Ergebnisfläche. Sie ist immer im DOM (s. revealResult) und
          trägt alles, was auf eine Frage folgen kann — Warten, Fehler, Antwort, Wissenslücke.
          `scroll-mt-*` hält beim Anspringen etwas Luft über dem Kopf. */}
      <div
        ref={resultRef}
        tabIndex={-1}
        data-testid="ask-result-anchor"
        className="scroll-mt-6 outline-none"
      >
        {/* A1 (mega38) · JOB 3064 §9: der Wartezustand ist KEINE Karte mehr — der Spinner sitzt im
            Sendeknopf, und hier stehen nur die ruhigen Platzhalterzeilen, die die FORM der
            kommenden Antwort zeigen, ohne etwas über ihren Inhalt zu behaupten.
            Der Ladetext BLEIBT — er ist der Katalogtext der Ansage-Region (A18,
            `tests/app/a18-ansagen-ereignisse.test.tsx`) und muss vom Vorleseprogramm gehört
            werden. Er steht deshalb als `sr-only` am busy-Träger: gesagt, nicht gemalt. */}
        {/* JOB 3064 §9 / KORREKTURPFLICHT 4 (Ben, Runde 3): OFFLINE IST KEIN FEHLSCHLAG.
            react-query haelt eine Mutation ohne Verbindung an (`isPaused`) — sie ist dann zugleich
            `isPending`, ohne dass je etwas losgegangen waere. Bis hierher lief dieser Fall in die
            Warteflaeche: die Seite zeigte Platzhalterzeilen fuer eine Antwort, auf die niemand
            wartete. Der Satz nennt stattdessen den Grund, und der Fehlersatz („unterwegs
            steckengeblieben") bleibt dem echten Fehlschlag vorbehalten — er waere hier unwahr. */}
        {ask.isPaused ? (
          <output data-testid="ask-offline" className="mt-5 block text-[13px] text-trust-warn-text">
            {t("ask.offline")}
          </output>
        ) : null}
        {/* KORREKTURPFLICHT 2 (Ben, Runde 5): DER TRÄGER BLEIBT, DIE PLATZHALTER GEHEN.
            Zwei Zusagen treffen sich hier, und beide gelten:
              · A18 (`tests/ask/job2064-a18-ask-ladetext-mounted.test.tsx` G5): JEDER Abruf kündigt
                sich an — auch der zweite auf dieselbe Frage. Der busy-Träger mit dem Ladetext ist
                also Pflicht, sonst hört ein Vorleseprogramm nichts.
              · §9: frischt dieselbe Frage auf, BLEIBT die alte Antwort stehen. Vier graue
                Platzhalterzeilen DARUNTER wären die Ankündigung einer zweiten Antwort, die es
                nicht gibt — sichtbar wartet in diesem Fall allein der Spinner im Sendeknopf.
            Deshalb: Träger und Ansage immer, die gemalten Zeilen nur beim ERSTEN Abruf. */}
        {ask.isPending && !ask.isPaused ? (
          <div
            data-testid="ask-pending"
            aria-busy="true"
            aria-live="polite"
            className={auffrischungLaeuft ? undefined : "min-h-[8rem]"}
          >
            <span className="sr-only">
              {t("ask.contract.label")} {t("ask.pending.title")} {t("ask.pending.body")}
            </span>
            {/* FE-003: die Zeilen sind der gemeinsame Baustein `AntwortPlatzhalter`. */}
            {auffrischungLaeuft ? null : <AntwortPlatzhalter />}
          </div>
        ) : null}
        {/* A3: bis mega37 hinterließ eine abgewiesene Anfrage eine völlig unveränderte Seite —
            kein Toast, keine Meldung, nichts. Jetzt steht sie an derselben Stelle wie die Antwort.
            KORREKTURPFLICHT 2 (Ben, Runde 5): NUR wenn nichts dasteht. Der Kasten sagt „die Anfrage
            ist steckengeblieben, es gibt kein Ergebnis" — über einer sichtbaren Antwort wäre das
            unwahr. Für den Fall „Antwort steht, Auffrischung gescheitert" steht der Satz unter der
            Karte (§9), nicht dieser Kasten. */}
        {ask.isError && !auffrischungGescheitert ? (
          <div
            data-testid="ask-error"
            role="alert"
            className="mt-5 rounded-card border border-trust-crit-fill bg-trust-crit-bg p-5"
          >
            {abgeschaltetAbgewiesen ? (
              <div data-testid="ask-ki-abgeschaltet">
                <p className="text-[13px] font-semibold text-trust-crit-text">
                  {t("d5kiaus.titel")}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-trust-crit-text">
                  {t("d5kiaus.text")}
                </p>
              </div>
            ) : gebremstAbgewiesen ? (
              <div data-testid="ask-ki-gebremst">
                <p className="text-[13px] font-semibold text-trust-crit-text">
                  {t("ask.gebremst.titel")}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-trust-crit-text">
                  {gebremstSatz}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-trust-crit-text">
                  {t("ask.error.title")}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-trust-crit-text">
                  {t("ask.error.body")}
                </p>
                <Button className="mt-3" variant="ghost" onClick={() => submitAsk(asked || q)}>
                  {t("ask.error.retry")}
                  <ArrowRight size={14} />
                </Button>
              </>
            )}
          </div>
        ) : null}
        {/* R-0330 (Ben R1, F5): die Störung sieht nie wie Leere aus — und nie wie eine Antwort. */}
        {pruefungGestoert ? (
          <div
            data-testid="ask-pruefung-gestoert"
            role="alert"
            className="mt-5 rounded-card border border-trust-crit-fill bg-trust-crit-bg p-5"
          >
            <p className="text-[13px] font-semibold text-trust-crit-text">
              {t("ask.pruefungGestoert")}
            </p>
            <Button
              className="mt-3"
              variant="ghost"
              onClick={() => {
                setPruefungWiederholt(true);
                void conflicts.refetch();
                void kos.refetch();
              }}
            >
              {t("ask.error.retry")}
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : null}
        {/* R-0338: eine überholte Antwort wird nicht gezeigt — ein Satz und genau eine Aktion. */}
        {antwortUeberholt && !pruefungGestoert ? (
          // `<output>` statt `role="status"` (a11y/useSemanticElements) — wie die übrigen Live-Sätze
          // dieser Seite; Inhalt deshalb als Fließinhalt (`span` statt `p`).
          <output
            data-testid="ask-antwort-ueberholt"
            className="mt-5 block rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-5"
          >
            <span className="block text-[13px] text-trust-warn-text">
              {t("fragenseite.antwortUeberholt", {
                zeit: antwortAm ? formatKoTimestamp(antwortAm, i18n.language) : "",
              })}
            </span>
            <Button
              className="mt-3"
              variant="ghost"
              data-testid="ask-neu-fragen"
              disabled={!answerAi.available || ask.isPending}
              onClick={() => submitAsk(asked)}
            >
              {t("fragenseite.neuFragen")}
              <ArrowRight size={14} />
            </Button>
          </output>
        ) : null}
        {/* Eine ANDERE Frage räumt die alte Antwort ab (`onMutate`) — sie gehört zu einer anderen
            Frage, und stehenzubleiben hieße, sie als Antwort auf die neue auszugeben. DIESELBE
            Frage frischt nur auf: dann bleibt die Antwort stehen (Korrekturpflicht 2). */}
        {karteSichtbar && result && contract ? (
          <>
            {/* KORREKTURPFLICHT 1 (Ben, Runde 5) — HIER STAND DIE ZWEITE KARTE.
                Der Vertragskasten rahmte im Lückenfall dieselbe Lage ein zweites Mal: neben der
                Lückenkarte, auf demselben Bildschirm, mit eigenem Rahmen und eigener Farbe. Ben hat
                zwei Ergebniskarten gemessen (`{"ergebniskarten":2}`), Auftrag §6 lässt EINE übrig.
                D-047 hatte den Kasten im ANTWORTFALL schon abgelöst; H5 löst ihn jetzt auch im
                Lückenfall ab — nach demselben Muster und aus demselben Grund.
                NICHTS IST GESTRICHEN: Etikett, Kernsatz, Erläuterung, Quellenbilanz, Trust-Notiz,
                nächster Schritt und die verschlossenen Tore stehen vollständig in
                `MehrLueckenInfo` und damit im Info-Blatt „…" → „Mehr" — jeder Text genau einmal.
                Gemessen von `tests/app/job3064-fragen-zustaende-mounted.test.tsx` (W-Fälle). */}
            {result.answered ? (
              // ==========================================================================
              // SCHEIBE D-047 (JOB 1022) — DIE ANTWORT STEHT VORN.
              // ==========================================================================
              // Live gemessen (mega38 A, dieselbe Messung): der Antwortblock begann bei 674 px in
              // einem 678 px hohen Sichtbereich. Wer eine Frage stellte, bekam zuerst Kennzeichnung,
              // Einordnung, Status, Evidenz und Werkzeuge zu lesen — und die Antwort selbst gar
              // nicht zu sehen. Fünf Vorworte vor der Auskunft.
              // Sie ist ab hier das ERSTE Inhaltselement dieser Karte; alles, was sie einordnet,
              // steht dahinter. Erst die Sache, dann ihre Rahmung.
              // WP-UX-WOW-1 U1 bleibt unangetastet: Markdown wird SICHER als React-Elemente
              // gerendert (kein HTML-Sink); Kopieren/Download/Druck nutzen weiter den ROHEN Text
              // über `buildExport`.
              // Die Klasse `ask-answer-body` ist kein Stil, sondern der Anker, an dem
              // `tests/app/job1022-antwort-steht-vorn.test.tsx` die Erstplatzierung am GERENDERTEN
              // DOM misst — Quelltextreihenfolge wäre hier kein Beleg.
              //
              // WARUM DIESE ERKLÄRUNG VOR DER KARTE STEHT UND NICHT DARIN: mega62 E1 prüft, dass
              // `<AiGeneratedNotice` innerhalb der ersten 2000 Zeichen nach `className="print-area`
              // steht — sonst wäre die Kennzeichnung ans Kartenende gerutscht. Ein Kommentarblock
              // in der Karte verbraucht dieses Budget, ohne etwas zu rendern. Gekürzt wird deshalb
              // nicht die Begründung, sondern ihr Ort.
              // AUFTRAG-mega52: stabiler Anker des ERGEBNISBEREICHS fuer die Browser-Sonde.
              // JOB 3064 §5: Maße aus `Fragen.dc.html` Z.39/40/44 (Polster, Radius, 17 px/1.6).
              // JOB 3267 Q1: der Messpunkt für die gerenderten Fussnoten. Der Haken sitzt HIER und
              // nicht um `AntwortText`: die Karte darunter zählt ihr Kommentar-/Quelltextbudget
              // bis `<AiGeneratedNotice` (mega62 E1, 2000 Zeichen ab `className="print-area`), und
              // ein Wrapper drinnen zehrte davon. Gemessen wird ohnehin gezielt über
              // `.ask-answer-body sup[data-fussnote]`.
              <div ref={antwortRef} className="flex flex-col gap-[22px]">
                <Card
                  // `!rounded-[14px]`: `Card` bringt `rounded-card` (13px) mit, und beide Klassen
                  // stehen dann am selben Element — welche gewinnt, entschiede die Reihenfolge im
                  // erzeugten Stylesheet, nicht die Absicht. Der Zielbildwert (Z.39) wird deshalb
                  // ausdrücklich gesetzt.
                  className="print-area relative mt-0 flex flex-col gap-4 !rounded-[14px] border-hairline px-7 py-6 shadow-tile"
                  data-testid="ask-answer"
                  {...(antwortStufe === "entwurf" ? { "data-reasoner-entwurf": "" } : {})}
                >
                  {/* D-047: die Antwort zuerst — Begründung unmittelbar über dieser Karte. */}
                  <AntwortText
                    text={result.answer ?? ""}
                    quellen={result.sources.length}
                    tragend={tragendeNummern}
                    className="ask-answer-body text-[17px] leading-[1.6] text-text"
                  />
                  {/* JOB 3366: nur bei belegtem Abbruch (Serverfeld), nie geraten. Begründung an
                    `AbbruchBefund` in api/types.ts. */}
                  {result.abgeschnitten ? (
                    <p
                      data-testid="ask-abgeschnitten"
                      className="m-0 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text"
                    >
                      {t("ai.truncated.hint")}
                    </p>
                  ) : null}
                  {/* mega62 E / D-047: Stufe (R-1695) und KI-Satz direkt nach der Antwort, in der
                    Druckfläche. Der Satz nur mit gültiger Servermarke (R-0604). */}
                  <p className="m-0 flex flex-wrap items-center gap-1.5">
                    <ErgebnisStufeMarke stufe={antwortStufe} />
                    {antwortHerkunft === "ki" ? <AiGeneratedNotice /> : null}
                  </p>
                  {/* ==========================================================================
                    R-0287 / R-0286 — DIE WARNUNG STEHT VOLLSTÄNDIG DIREKT HINTER DER ANTWORT.
                    ==========================================================================
                    „Die eigentliche Warnung bleibt vollständig und unübersehbar." Seit H5 standen
                    Review-Hinweis, Konflikt-Hinweis, unbekannter Konfliktstand und Prüfvorbehalt
                    nur im Blatt „Mehr" — ohne Griff sah sie niemand (Ben, Nacharbeit 2). Sie stehen
                    jetzt hier, jeder zutreffende genau einmal, mit Wortlaut, Ableitung und Ankern
                    wie bisher; im Blatt steht keiner mehr ein zweites Mal. Reihenfolge nach R-0286:
                    Antwort → KI-Kennzeichnung → Warnkästen → Quellen → Werkzeuge. */}
                  {vorbehalte > 0 ? (
                    <div data-testid="ask-warnungen" className="flex flex-col gap-2">
                      {reviewGuard ? (
                        <div
                          data-testid="ask-review-guard"
                          className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
                        >
                          <div className="font-semibold">{t(reviewGuard.labelKey)}</div>
                          <p className="mt-0.5">{t(reviewGuard.hintKey)}</p>
                          {/* AUFTRAG-mega71 BLOCK E (Stelle 2): der Prüfvorbehalt-CTA zeigt auf
                            /validierung (controller). Der Hinweis „gehört in Review" bleibt für alle
                            wahr — nur der WEG dorthin gehört den Rollen, die ihn gehen dürfen; der
                            Pfeil (das Versprechen „hier geht es weiter") fehlt an der Lage. */}
                          <RoleLink
                            to={demoHref(reviewGuard.ctaTo, params)}
                            className="mt-2 inline-flex items-center gap-1 rounded-btn bg-surface px-2.5 py-1 text-[12px] font-semibold text-text"
                            hoverClassName="hover:opacity-90"
                          >
                            {(erreichbar) => (
                              <>
                                {t(reviewGuard.ctaKey)}
                                {erreichbar ? <ArrowRight size={13} /> : null}
                              </>
                            )}
                          </RoleLink>
                        </div>
                      ) : null}
                      {/* SCRUM-357 / AG-14 / VC-P1-1: mind. eine Antwortquelle hat einen offenen
                        Konflikt → ehrlicher Hinweis, dass die Antwort trotz Status nicht
                        uneingeschränkt gesichert ist. */}
                      {effective?.sourcesConflicted ? (
                        <div className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2">
                          <p className="text-[12.5px] font-semibold text-trust-warn-text">
                            {t("conflict.impact.title")}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                            {t("conflict.impact.hint")}
                          </p>
                          {/* AUFTRAG-mega71 BLOCK E (Stelle 3): /konflikte verlangt controller.
                            Der Unterstrich (Link-Versprechen) gehört nur zur begehbaren Fassung. */}
                          <RoleLink
                            to="/konflikte"
                            className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-trust-warn-text"
                            hoverClassName="underline"
                          >
                            {() => <>{t("conflict.impact.cta")}</>}
                          </RoleLink>
                        </div>
                      ) : null}
                      {/* AUFTRAG-mega34 BLOCK A2 — der unbekannte Konfliktstand: die Konfliktliste
                        lädt noch oder ihr Abruf ist abgerissen. Ohne ihn läse sich ein Netzfehler
                        als „keine Konflikte" und damit als Sicherheit. */}
                      {conflictCaveat ? (
                        <div
                          data-testid="ask-conflict-caveat"
                          className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
                        >
                          <p className="text-[12.5px] font-semibold text-trust-warn-text">
                            {t("ask.conflictCaveat.title")}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                            {t(`ask.conflictCaveat.${conflictCaveat.reason}`)}
                          </p>
                        </div>
                      ) : null}
                      {/* AUFTRAG-mega32 BLOCK E (Pedi 27.07.) — der Prüfvorbehalt: er benennt, wie
                        viele der herangezogenen Quellen betroffen sind, von wie vielen, und mit
                        welcher Ursache. */}
                      {checkCaveat ? (
                        <div
                          data-testid="ask-check-caveat"
                          className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
                        >
                          <p className="text-[12.5px] font-semibold text-trust-warn-text">
                            {t("ask.checkCaveat.title")}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                            {t(`ask.checkCaveat.${checkCaveat.reason}`, {
                              unproven: checkCaveat.unproven,
                              total: checkCaveat.total,
                            })}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {/* AUFNAHME 20260922 · R-0318/R-0321/R-0322/R-0335: die Belastbarkeit VOM SERVER
                    direkt an der Antwort — Lage, Begründung, Vertrauenswert mit Herleitung, je
                    tragender Quelle Stand und Verantwortung, bei Widerspruch beide Seiten. Eine zur
                    Lücke herabgestufte leere Antwort (`leereAntwortAlsLuecke`) trägt sie nicht. */}
                  {result.answered &&
                  result.belastbarkeit &&
                  result.belastbarkeit.lage !== "wissensluecke" ? (
                    <Belastbarkeit b={result.belastbarkeit} />
                  ) : null}
                  {/* ==========================================================================
                    DIE QUELLEN-CHIPS (Zielbild Z.42) — „n · Titel", getrennt durch eine Linie.
                    ==========================================================================
                    Die Ziffer ist KEINE neue Nummerierung: sie ist die Position der Quelle in
                    `result.sources`, und genau diese Position markiert das Modell im Antworttext
                    (`citedSourceIds`, services/reasoner/src/provider-model.ts:450 liest `[n]`
                    gegen dieselbe Reihenfolge zurück). Chip und Fußnote im Text meinen dasselbe.
                    §6 — DER ZUSTAND HÄNGT AM CHIP, NICHT AN EINEM SATZ: ein ungelöster Konflikt
                    färbt den Punkt rot, eine nicht validierte Quelle gelb. Ist der Status der
                    Quelle UNBEKANNT (das Wissensobjekt liegt der Fläche nicht vor), steht KEIN
                    Punkt — „unbekannt" ist etwas anderes als „in Ordnung", und die volle Auskunft
                    dazu steht im Info-Blatt unter „Mehr". */}
                  {chipQuellen.length > 0 ? (
                    <div
                      data-testid="ask-quellen-chips"
                      className="flex flex-wrap gap-2 border-t border-hairline pt-3.5"
                    >
                      {sichtbareChips.map((s) => {
                        const punkt = chipPunkt(s);
                        return (
                          <Link
                            key={s.id}
                            to={quellenHref(s.id)}
                            data-testid="ask-quellen-chip"
                            data-tutorial-ziel={FRAGEN_ZIEL.quellenchip}
                            className={QUELLEN_CHIP_KLASSE}
                          >
                            {/* JOB 3267 Q1 — DER PUNKT SAGT, WAS ER ZEIGT: er nennt den Prüfstand
                              mit seinem eigenen Wort; die Verwendung steht daneben in der
                              Plakette. Seit FE-003 der gemeinsame Baustein `QuellenChipInhalt`
                              (Begründung dort) — das Tutorial zeigt denselben Chip. */}
                            <QuellenChipInhalt
                              punkt={punkt}
                              punktHinweis={
                                s.conflictLimited ? t("conflict.impact.hint") : s.pruefstandHinweis
                              }
                              pruefstand={s.pruefstand}
                              nummer={s.nummer}
                              label={s.label}
                              verwendung={s.verwendung}
                            />
                          </Link>
                        );
                      })}
                      {weitereChips > 0 ? (
                        <button
                          type="button"
                          data-testid="ask-quellen-chip-mehr"
                          aria-label={t("ask.quellen.weitere", { count: weitereChips })}
                          onClick={() => setAlleChips(true)}
                          className={QUELLEN_CHIP_KLASSE}
                        >
                          +{weitereChips}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {/* R-1633 — „Sichtbar im UI": wofür gewichtet wurde und wie jede herangezogene
                    Quelle dazu passt. Nur wenn mit Fragekontext gefragt wurde; die Passung sagt
                    der Server (dieselbe Rechnung, die die Reihenfolge bestimmt hat). */}
                  {geltungsAuskunft ? (
                    <GeltungsAuskunft
                      auskunft={geltungsAuskunft}
                      titelVon={(id) => quellenAuskunft.find((s) => s.id === id)?.label ?? id}
                    />
                  ) : null}
                  {/* §5: das „…" rechts oben IN der Antwortkarte. Absolut gesetzt, damit es die
                    Reihenfolge der Inhaltselemente nicht verschiebt (D-047). */}
                  <div
                    className="print-hide absolute right-3 top-3"
                    data-tutorial-ziel={FRAGEN_ZIEL.menue}
                  >
                    <OverflowMenu
                      label={t("ask.menu.label")}
                      testId="ask-menu"
                      griffRef={menuGriffRef}
                      punkte={ANTWORT_MENUEPUNKTE.map((p) => ({ id: p.id, label: t(p.labelKey) }))}
                      onWahl={(id) => {
                        if (id === "print") {
                          printAnswer();
                          return;
                        }
                        if (id === "download") {
                          downloadAnswer();
                          return;
                        }
                        if (id === "docx" || id === "pptx" || id === "pdf") {
                          dateiHerunterladen(id);
                          return;
                        }
                        setMehr(true);
                      }}
                    />
                  </div>
                  {/* ==========================================================================
                    „MEHR" — DIE EINORDNUNG DIESER ANTWORT, AN IHRER KARTE.
                    ==========================================================================
                    Vertrag, Zählzeile, Einstufung, Vertrauenswert, Vorbehalte, Kontextquellen und
                    die vollständige Quellenliste standen bis JOB 3064 dauerhaft unter jeder
                    Antwort. Sie stehen ab hier hinter „…" → „Mehr" — WÖRTLICH unverändert, mit
                    denselben Ankern und derselben Ableitung.
                    SIE BLEIBEN IN DIESER KARTE, auch wenn das Blatt zu ist: es ist die Einordnung
                    GENAU DIESER Antwort. Ein zweiter Ort dafür wäre die konkurrierende
                    Parallelstruktur, die D-047 gerade beseitigt hat. `hidden` nimmt sie aus Fluss,
                    `innerText` und Zugänglichkeitsbaum — nicht aus ihrer Bindung. */}
                  {mehr ? (
                    <Seitenblatt
                      titel={t("ask.menu.label")}
                      testId="ask-mehr"
                      onSchliessen={() => setMehr(false)}
                      ausloeser={() => menuGriffRef.current}
                    >
                      <MehrFlaechenInfo
                        badge={badge}
                        guide={guide}
                        speechSupported={speechSupported}
                        vorlesenMoeglich={vorlesen.moeglich}
                      />
                      <div
                        data-testid="ask-mehr-antwort"
                        className="mt-4 border-t border-hairline pt-3"
                      >
                        {/* D-047 — DIE EINORDNUNG ALS ZEILE STATT ALS KASTEN: Kernsatz und Quellenbilanz
                    kompakt unter der Antwort, Erläuterung/Trust-Notiz/nächster Schritt als
                    Nachlauf. Derselbe Inhalt wie im abgelösten Kasten, kein Text gestrichen,
                    keiner doppelt. */}
                        <div
                          data-testid="ask-contract-line"
                          className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1"
                        >
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                            {t("ask.contract.label")}
                          </span>
                          <span
                            className={`text-[12.5px] font-semibold ${
                              contract.tone === "pos"
                                ? "text-trust-pos-text"
                                : "text-trust-warn-text"
                            }`}
                          >
                            {t(contract.titleKey)}
                          </span>
                          {sourceSummary && sourceSummary.total > 0 ? (
                            <>
                              <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold text-text">
                                {t("ask.contract.sumTotal", { count: sourceSummary.total })}
                              </span>
                              {sourceSummary.validated > 0 ? (
                                <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-pos-text">
                                  {t("ask.contract.sumValidated", {
                                    count: sourceSummary.validated,
                                  })}
                                </span>
                              ) : null}
                              {sourceSummary.open > 0 ? (
                                <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text">
                                  {t("ask.contract.sumOpen", { count: sourceSummary.open })}
                                </span>
                              ) : null}
                              {sourceSummary.conflictLimited > 0 ? (
                                <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-crit-text">
                                  {t("ask.contract.sumConflict", {
                                    count: sourceSummary.conflictLimited,
                                  })}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        <div className="mt-1.5 border-t border-hairline pt-1.5">
                          <p className="text-[12.5px] leading-relaxed text-muted">
                            {t(contract.bodyKey)}
                          </p>
                          {contract.sourceBound ? (
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
                              {t(ANSWER_CONTRACT_TRUST_NOTE_KEY)}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[12px] font-medium text-text">
                            {t(contract.nextStepKey)}
                          </p>
                        </div>
                        <div className="mb-3 mt-3 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* SCRUM-250 / AUFTRAG-mega33 A2: Status und Evidenz kommen aus der EINEN
                      effektiven Einstufung — nicht mehr je einzeln aus der rohen Knowledge-Class.
                      Deshalb kann hier kein „Gesichert" mehr stehen, während oben ein
                      Prüfvorbehalt sitzt (bens ROT 3). */}
                            <span
                              className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[effective?.status.tone ?? "warn"]}`}
                            >
                              {t(`ask.status.${effective?.status.key ?? "unverified"}`)}
                            </span>
                            {/* SCHEIBE D-048 (1) — NICHT AUSGEFÜHRT, und das ist ein Befund, kein Versäumnis.
                      Die Scheibe will dieses Evidenz-Etikett streichen („zwei Kästchen, eine
                      Tatsache"). Gemessen ist es jedoch TRAGEND für eine bestehende Zusage:
                      `tests/ask/ask-check-caveat-mounted.test.tsx:207` und `:216` pinnen wörtlich
                      „Evidenz: Ungeprüft" — als Beleg aus mega32 E/mega33 A, dass die Antwortansicht
                      NIRGENDS „Gesichert" sagt, wenn sie es nicht weiß, weder sichtbar noch im
                      Export. Sein Entfernen macht diesen Wächter rot (in diesem Durchgang gemessen).
                      Die Testdatei liegt außerhalb der Lease dieses Auftrags; ein Eingriff dort wäre
                      ein LEASE-VERSTOSS. Gemeldet unter BLOCKIERT in der Rückgabe. */}
                            {/* R-0287 (Ben R1, F6): D-048 (1) ist jetzt ausgeführt — die Plakette
                      entfällt, wenn sie nur die Statusplakette wiederholt. Die Zusage von mega32/33
                      („nirgends Gesichert, wenn es nicht belegt ist") hängt an der Statusplakette
                      und am Export; beide bleiben. `ask-check-caveat-mounted` A4 prüft jetzt die
                      EINE Plakette. */}
                            {effective &&
                            evidenzWiederholtStatus(
                              effective.status,
                              effective.evidence.labelKey,
                            ) ? null : (
                              <span
                                data-testid="ask-evidenz-plakette"
                                className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[effective?.evidence.tone ?? "neutral"]}`}
                              >
                                {t("ask.evidence")}:{" "}
                                {t(effective?.evidence.labelKey ?? "ask.knowledgeClass.unbekannt")}
                              </span>
                            )}
                          </div>
                          {/* AUFTRAG-mega33 A4 (beim Bauen des Wortnachweises gefunden): der Trust-Balken
                    beschriftet seinen Wert ab 85 mit dem Qualitätswort „Gesichert" — eine SIEBTE
                    Stelle, die neben derselben Antwort Sicherheit behauptet, nur auf einer anderen
                    Achse. Die ZAHL bleibt in jedem Fall stehen (sie ist eine Messung); das
                    URTEILSWORT steht nur, wenn die Einstufung es trägt. Ob das Wort auch in
                    KO-Detail/Bibliothek/Validierung anders lauten soll, ist eine Produkt-
                    entscheidung und hier bewusst NICHT getroffen — s. Bericht. */}
                          {/* AUFTRAG-mega53 B2 — DIE ZAHL MUSS ZUR ZUORDNUNG PASSEN.
                    Bis mega53 stand hier IMMER ein Vertrauenswert, gebildet aus dem bestgerankten
                    Kandidaten. Lieferte das Modell keine Marke, sagte die Quellenliste darunter
                    korrekt „Zuordnung unbekannt" — und daneben stand trotzdem eine hohe Zahl aus
                    einer bloß angesehenen Quelle. Der Vertrauenswert ist ein QUELLENBEZOGENER
                    Wert; ohne bekannte tragende Quelle gibt es ihn nicht. Es steht hier bewusst
                    auch keine 0: 0 wäre die Behauptung „nichts wert", und behauptet wird gerade
                    nichts. Der Balken kommt zurück, sobald eine Marke da ist.
                    JOB 3267 R3: „Marke da" heisst TRAGFÄHIG. Eine Marke, die auf keine Quelle
                    dieser Antwort zeigt, ist keine — sonst stünde die Zahl einer bloss angesehenen
                    Quelle neben einer Zuordnung, die nichts trägt. Genau der Fehler von B2. */}
                          {!zuordnungTragfaehig ? (
                            <span
                              data-testid="ask-trust-unattributed"
                              className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-muted-2"
                            >
                              {t("ask.trust.unattributed")}
                            </span>
                          ) : (
                            /* SCHEIBE D-048 (2): Der Balken trug seinen Wert SICHTBAR unbeschriftet — aus
                      der Ansicht heraus war nicht erkennbar, was dort null ist. Er bekommt das
                      Wort davor. NACHGEMESSENE PRAEZISIERUNG zur Scheibe: ganz ohne Beschriftung
                      war er nicht — `ConfidenceBar` fuehrt seit mega51 D1 `title` und `aria-label`
                      (`evidence.confidenceLabel`). Fuer die Vorlesehilfe war der Wert also benannt,
                      fuer das AUGE nicht; genau diese Luecke schliesst die Zeile hier.
                      KEIN neuer i18n-Schluessel: `val.trust` traegt das Wort in DE/EN/NL bereits —
                      und in DE/NL ohne das Fachwort „Trust", wie es der Sammler
                      `tests/app/mega52-vertrauenswert-sammler.test.ts` verlangt.
                      `showLabel` bleibt unangetastet: das QUALITAETSWORT („Gesichert" ab 85) darf
                      weiterhin nur stehen, wenn die Einstufung es traegt (mega33 A4/mega35 E). */
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono text-[10.5px] font-semibold uppercase text-muted-2">
                                {t("val.trust")}
                              </span>
                              <ConfidenceBar
                                value={result.trust}
                                showLabel={effective?.grade === "verified"}
                              />
                            </span>
                          )}
                        </div>
                        {/* SCRUM-430 (VIP): Antwort inkl. Quellen exportieren/teilen. JOB 3064 §5: der
                    Knopf „Kopieren" steht als einer von ZWEI Knöpfen unter der Karte (Zielbild
                    Z.44); „Als Markdown" und „Drucken" sind Punkte des „…"-Menüs oben rechts.
                    Alle drei rufen unverändert `copyAnswer` / `downloadAnswer` / `printAnswer`.
                    R-0287 (Nacharbeit 2): Review-Hinweis, Konflikt-Hinweis, unbekannter
                    Konfliktstand und Prüfvorbehalt standen hier im Blatt. Sie stehen jetzt
                    vollständig und genau einmal in der Antwortkarte direkt hinter der Antwort
                    (`ask-warnungen`) — hier steht keiner mehr ein zweites Mal. */}
                        {/* AUFTRAG-mega39 BLOCK D2: die Liste erschien bis mega38 IMMER — und wiederholte
                  dabei Eintrag für Eintrag die Quellenliste darunter, unter einem Namen
                  („Argumentationsschritte"), den es nicht gibt: es existiert keine protokollierte
                  Herleitung. Sie erscheint jetzt nur noch, wenn sie eine Fundstelle trägt, die in
                  der Quellenliste NICHT steht (lib/askSteps.ts). */}
                        {stepsWorthShowing(result.steps, answerSources) ? (
                          <div className="mt-4">
                            <SectionLabel>{t("ask.steps")}</SectionLabel>
                            {/* R-0888 (gesamt-hilfen, Nacharbeit 13): Abschnittserklärung in der
                                Seitenhilfe, solange der Abschnitt steht. */}
                            <HelpTip title={t("ask.steps")} body={t("shelp.ask.steps")} />
                            <ul className="space-y-2">
                              {stepsBeyondSources(result.steps, answerSources).map((s) => (
                                <li
                                  key={s.description}
                                  className="rounded-btn bg-page p-2.5 text-[13px] text-text"
                                >
                                  {/* Pedi 05.07.: Die Quellen-Headline verlinkt direkt auf das Wissensobjekt in
                            der Bibliothek — so kommt man aus der Antwort schnell zum Artikel. */}
                                  {s.sourceId ? (
                                    <Link
                                      to={quellenHref(s.sourceId)}
                                      className="inline-flex items-center gap-1 font-medium text-brand-text hover:underline"
                                    >
                                      <span className="text-text">{s.description}</span>
                                      <ArrowRight size={12} className="shrink-0 text-muted-2" />
                                    </Link>
                                  ) : (
                                    s.description
                                  )}
                                  {s.snippet ? (
                                    <span className="mt-1 block font-mono text-[11px] text-muted-2">
                                      “{s.snippet}”
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {/* FE-003 (Runde 2): die Quellenliste ist der gemeinsame Baustein
                            `QuellenListe` — das Tutorial führt genau diesen Weg („…“ → „Mehr …“ →
                            Quellenliste) mit demselben Bauteil vor. Die Seite entscheidet weiter,
                            was je Quelle gilt (`quellenAuskunft`), wohin der Titel führt und ob
                            „Danke“ angeboten wird. */}
                        {result.sources.length > 0 ? (
                          <QuellenListe
                            quellen={quellenAuskunft}
                            zuordnungTragfaehig={zuordnungTragfaehig}
                            wissenHref={quellenHref}
                            bildfundstelle={(id) => result.captionSources?.includes(id) ?? false}
                            koVon={(id) => (kos.data ?? []).find((k) => k.id === id)}
                            autorVon={authorNameOf}
                            // JOB 4224 R3 (Ben-Korrekturpflicht 1): ist die Auffrischung
                            // gescheitert, ist der Quellenstand UNBEKANNT (§9) — das Angebot „öffne
                            // das Original" entfällt. Begründung am Vertrag von AnswerSourceDetails.
                            standBestaetigt={!auffrischungGescheitert}
                            // Ben R1, F8: ohne gültigen Beleg kein Dank-Knopf — er liefe in 403.
                            dank={
                              belegGueltig
                                ? {
                                    bedankt: (id) => thankedSources.has(id),
                                    laeuft: thankSource.isPending,
                                    danken: (id) => thankSource.mutate(id),
                                  }
                                : null
                            }
                          />
                        ) : null}
                      </div>
                    </Seitenblatt>
                  ) : null}
                </Card>
                {/* Zielbild Z.44: zwei ruhige Knöpfe, 10/20 Polster, Radius 10, 14 px.
                  „Kopieren" kopiert unverändert die EFFEKTIVE Fassung (`buildExport` → derselbe
                  Markdown wie der Download, mit Einstufung, Quellen und KI-Kennzeichnung).
                  AUFTRAG-mega52 A4: „Hat geholfen" zielt auf die TRAGENDE Quelle, nicht blind auf
                  `result.sources[0]` — bei unbekannter Zuordnung gibt es keine, und der Knopf
                  bleibt gesperrt, statt in den serverseitigen 403 zu laufen. */}
                <div className="print-hide flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyAnswer}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft"
                  >
                    <Copy size={14} aria-hidden="true" />
                    {t("ask.export.copy")}
                  </button>
                  {/* R-1053: die Antwort vorlesen — nur wo der Browser sprechen kann; sonst nennt
                      das „Mehr"-Blatt den Grund (`ask-vorlesen-na`), kein toter Knopf. Vorgelesen
                      wird der Antworttext selbst, ohne Markdown-Zeichen und Fussnotenmarken. */}
                  {vorlesen.moeglich ? (
                    <button
                      type="button"
                      data-testid="ask-vorlesen"
                      aria-pressed={vorlesen.liest}
                      onClick={() => vorlesen.umschalten(result.answer ?? "")}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft"
                    >
                      <Volume2 size={14} aria-hidden="true" />
                      {vorlesen.liest
                        ? t("diktat.antwortVorlesenStop")
                        : t("diktat.antwortVorlesen")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={helpfulDisabled(
                      { pending: helpful.isPending, success: helpful.isSuccess },
                      (result.citedSources ?? []).length === 0 || !belegGueltig,
                    )}
                    aria-describedby={belegGueltig ? undefined : "ask-rueckmeldung-abgelaufen"}
                    onClick={() => {
                      const carrying = (result.citedSources ?? [])[0];
                      if (carrying) {
                        helpful.mutate(carrying);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ThumbsUp size={14} aria-hidden="true" />
                    {helpfulLabel(
                      { success: helpful.isSuccess },
                      t("ask.helpful"),
                      t("ask.thanked"),
                    )}
                  </button>
                  {/* Ben R1, F8: eine nicht ausführbare Aktion wird erklärt, nicht bloss gesperrt. */}
                  {belegGueltig || helpful.isSuccess ? null : (
                    <p
                      id="ask-rueckmeldung-abgelaufen"
                      data-testid="ask-rueckmeldung-abgelaufen"
                      className="basis-full text-[12px] text-muted-2"
                    >
                      {t("ask.rueckmeldungAbgelaufen")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Card className="mt-3 border-dashed" data-testid="ask-gap">
                {/* R-0310/R-0325 (Ben zu 8e6c9d73): die Antwort ist zurückgehalten, weil sich keine
                  tragende Quelle zuordnen ließ — das wird gesagt, der unbelegte Text nicht gezeigt. */}
                {result.zuordnungUnbekannt ? (
                  <p data-testid="ask-zuordnung-unbekannt" className="mb-3 text-sm text-muted">
                    {t("ask.zuordnungUnbekannt")}
                  </p>
                ) : null}
                {verschlossen.length > 0 ? (
                  <>
                    <div className="mb-3" data-testid="ask-verschlossen">
                      {/* N-0009 (Ben R1, F10): ZUERST DIE LAGE, DANN DIE LÜCKE. Gibt es passende
                        Dokumente, die nur noch nicht für Antworten freigegeben sind, ist „keine
                        belastbare Grundlage" nicht das Erste, was stimmt — das Erste ist: der
                        Inhalt ist da. Der Lückensatz und die Neuerfassung folgen darunter. */}
                      <p
                        data-testid="ask-verschlossen-titel"
                        className="text-[15px] font-semibold text-text"
                      >
                        {t("ask.verschlossen.titel")}
                      </p>
                      {/* Ben R2, F10: die Erklärung nennt die Gründe, die WIRKLICH vorliegen —
                          nicht pauschal „nicht freigegeben". Ein validiertes, eingestuftes
                          Dokument ohne durchsuchbaren Text ist kein Prüffall. */}
                      {verschlossenGruende.map((grund) => (
                        <p
                          key={grund}
                          data-testid={`ask-verschlossen-grund-${grund}`}
                          className="mt-1 text-sm text-muted"
                        >
                          {t(`ask.verschlossen.grund.${grund}`)}
                        </p>
                      ))}
                      <p className="mt-2 text-[11.5px] font-medium text-muted-2">
                        {t("ask.verschlossen.label")}
                      </p>
                      {/* ============================================================================
                        JOB 3109 UX-09 §5 — HIER WIRD NICHT GEFILTERT. Die Liste ist GENAU die, die
                        der Server geschickt hat: keine Rollenabfrage, kein Sortieren, kein
                        Ausblenden, kein Nachladen. Die Sperre trägt der Server, zweifach und vor
                        dem Feld: `dropConfidential(prefilteredRaw).filter(verschlossenSicht)`
                        (services/ask/src/service.ts:829-833), und `verschlossenSicht` ist
                        `darfSehen(user, ko)` (services/app/src/sichtbarkeit.ts:108-110) — dieselbe
                        Funktion, die auch den Leseweg des einzelnen Objekts bewacht. DARAUS folgt
                        der Leselink unten: jeder Titel, der hier steht, gehört zu einem Dokument,
                        das dieser Mensch ohnehin öffnen darf; der Link spart den Umweg über die
                        Bibliothekssuche, er öffnet nichts Neues. Wer hier eine Rechteprüfung
                        „nachrüsten" will, baut eine zweite Wahrheit neben die des Servers — genau
                        das ist verboten. Fehlt das Feld (älterer Server / Weg ohne Betrachter,
                        api/types.ts:1190-1191), ist die Liste leer und es steht nichts da.
                        ============================================================================ */}
                      <ul className="mt-1 space-y-1">
                        {verschlossen.map((h) => (
                          <li
                            key={h.id}
                            className="flex flex-wrap items-center gap-1.5 text-[12px]"
                            data-testid="ask-verschlossen-eintrag"
                          >
                            {/* JOB 3109 UX-09 §1: derselbe Weg wie die tragenden Quellen oben
                              (`ask-quellen-chip`, :1202-1206) — ein `<Link>` auf `/wissen/:id` mit
                              demselben `demoHref`, kein zweiter Linkbauer. §2: der zugängliche Name
                              sagt, WOHIN er führt; ein Vorleseprogramm liest sonst nur einen
                              nackten Dokumenttitel vor. Sichtbar bleibt genau der Titel. */}
                            <Link
                              to={demoHref(`/wissen/${h.id}`, params)}
                              data-testid="ask-verschlossen-link"
                              aria-label={t("ask.verschlossen.lesen", { titel: h.title })}
                              className="font-medium text-text underline decoration-hairline underline-offset-2 hover:decoration-ink"
                            >
                              {h.title}
                            </Link>
                            {/* JOB 3109 UX-09 §3 — DER SPERRGRUND OHNE MAUS. Die drei Sätze gab es
                              schon, sie hingen aber ALLEIN im `title=` und sind damit nur beim
                              Verweilen mit dem Zeiger erreichbar. Sie stehen jetzt zusätzlich im
                              zugänglichen Namen der Plakette. `role="note"` ist dabei nicht Zierde:
                              ein `aria-label` an einem nackten `<span>` (Rolle `generic`) wird von
                              Vorleseprogrammen ignoriert und wäre ein Name nur auf dem Papier. Das
                              `title=` bleibt für die Maus stehen — es ist nur nicht mehr der
                              einzige Träger. Sichtbar bleibt der Kurztext, damit der Wortlaut von
                              Station 3 (JOB 2623) unverändert lesbar ist. */}
                            {h.freigabeFehlt ? (
                              <span
                                role="note"
                                title={t("ask.verschlossen.freigabeHint")}
                                aria-label={t("ask.verschlossen.freigabeHint")}
                                className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text"
                              >
                                {t("ask.verschlossen.freigabe")}
                              </span>
                            ) : null}
                            {h.stufeFehlt ? (
                              <span
                                role="note"
                                title={t("ask.verschlossen.stufeHint")}
                                aria-label={t("ask.verschlossen.stufeHint")}
                                className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text"
                              >
                                {t("ask.verschlossen.stufe")}
                              </span>
                            ) : null}
                            {h.volltextFehlt ? (
                              <span
                                role="note"
                                title={t("ask.verschlossen.volltextHint")}
                                aria-label={t("ask.verschlossen.volltextHint")}
                                className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text"
                              >
                                {t("ask.verschlossen.volltext")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {/* JOB 3109 UX-09 §4: „fachlich freigegeben" und „durfte diese Antwort tragen"
                        sind zwei verschiedene Fragen. Wer das nicht liest, hält den Leselink für
                        einen Widerspruch („ich darf es öffnen, aber es war gesperrt?"). EINMAL je
                        Liste, nicht je Eintrag — je Eintrag wäre derselbe Satz zweimal und läse
                        sich als Eigenschaft des einzelnen Dokuments. Ist die Liste leer, steht er
                        nicht da: die bestehende Regel „kein Grund wird erfunden" gilt auch für
                        diesen Satz. */}
                      <p
                        data-testid="ask-verschlossen-trennung"
                        className="mt-2 text-[11.5px] text-muted-2"
                      >
                        {t("ask.verschlossen.trennung")}
                      </p>
                    </div>
                    {/* N-0009 (Ben R1, F10): der Prüf-/Einstufungsweg NEBEN dem Lesen. Freigabe
                      und Einstufung entstehen in der Prüfung (`/validierung`, Rolle
                      `controller`, dort auch die Vertraulichkeitsstufe); über `RoleLink` sieht,
                      wer sie nicht erreicht, die Lage ohne toten Link. Die Neuerfassung bleibt
                      unten als weitere Möglichkeit.
                      Ben R2, F10: der Weg steht NUR, wenn er zum Grund passt — fehlt allein der
                      durchsuchbare Text, hilft keine Prüfung; der Weg ist dann das Dokument
                      selbst (der Leselink oben, dort wird Text ergänzt), und der Grund-Satz sagt
                      das. */}
                    {verschlossenPruefweg ? (
                      <div className="-mt-1 mb-3 text-[12px] text-muted-2">
                        {t(verschlossenPruefweg)}{" "}
                        <RoleLink
                          to="/validierung"
                          testId="ask-verschlossen-pruefen"
                          className="font-semibold text-brand-text"
                        >
                          {() => t("ask.verschlossen.zurPruefung")}
                        </RoleLink>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                  {t("ask.gapBadge")}
                </span>
                <p className="mt-2 text-[15px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
                <p className="mt-1 text-sm text-muted">{t("ask.noBasisBody")}</p>
                {/* R-0284: wogegen geprüft wurde — sonst weiss niemand, ob die Null etwas bedeutet. */}
                {pruefrahmen ? <PruefrahmenSatz rahmen={pruefrahmen} /> : null}
                {/* KORREKTURPFLICHT 1 (Ben, Runde 5) / Auftrag §6: DIESE KARTE TRÄGT DEN
                    LÜCKENSATZ, DEN GRUND UND DEN KNOPF. Die Rettungs-Geschichte (Story,
                    Beitragswert, „keine Antwort erfunden", Schrittfolge), der Datenschutzsatz, der
                    Vertragsrahmen und der Weg zum Risiko-Board standen bis Runde 5 hier UND im
                    Vertragskasten daneben — zwei Karten, viel Text, eine Lage. Sie stehen jetzt im
                    Info-Blatt „…" → „Mehr" (`MehrLueckenInfo`).
                    JOB 2626 D1 — WELCHES TOR IST ZU? Pedis Frage vom 27.08. bekam „Keine
                    belastbare Grundlage": ehrlich, aber ohne den Grund. Die Torlage ist der GRUND
                    dieser Lücke und bleibt deshalb HIER, im Sichtfeld — sie hinter einen Griff zu
                    legen hiesse, Pedis Befund von damals wiederherzustellen. Sie ist keine zweite
                    Karte, sondern die Begründung der einen. Ist die Liste leer, wird KEIN Grund
                    erfunden (§4 des Auftrags 2626). */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* SCRUM-264: direkt Wissen erfassen — die gestellte Frage als Capture-Kontext (kein Auto-KO). */}
                  {/* AUFTRAG-mega71 BLOCK E (Stelle 4): /erfassen verlangt experte — die Expertin
                      der Vortest-Aufgabe geht hier durch, die Betrachterin sieht die Lage. */}
                  {gapId ? (
                    <RoleLink
                      to={captureGapHref(gapId)}
                      testId="ask-luecke-erfassen"
                      className="inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[13px] font-semibold text-white"
                      hoverClassName="hover:opacity-90"
                    >
                      {(erreichbar) => (
                        <>
                          {t(GAP_RESCUE_TEXT.cta)}
                          {erreichbar ? <ArrowRight size={15} /> : null}
                        </>
                      )}
                    </RoleLink>
                  ) : null}
                </div>
              </Card>
            )}
            {/* §9 / KORREKTURPFLICHT 2 (Ben, Runde 5): „Cache mit gescheiterter Auffrischung = ein
                Satz unter der Karte." Die Antwort BLEIBT stehen — sie war einmal richtig und ist
                nicht dadurch falsch geworden, dass die Leitung eben nicht antwortete. Der Satz sagt
                genau das und nicht mehr; der Fehlerkasten oben bleibt dem Fall vorbehalten, in dem
                es überhaupt kein Ergebnis gibt. */}
            {auffrischungGescheitert ? (
              <output
                data-testid="ask-auffrischung-fehlgeschlagen"
                className="mt-2 block text-[12.5px] text-trust-warn-text"
              >
                {abgeschaltetAbgewiesen ? (
                  <span data-testid="ask-ki-abgeschaltet">{t("d5kiaus.text")}</span>
                ) : (
                  t("ask.refreshFailed")
                )}
              </output>
            ) : null}
          </>
        ) : null}
      </div>

      {/* ============================================================================================
          „MEHR" — DASSELBE SEITENBLATT, WENN ES (NOCH) KEINE ANTWORT GIBT.
          ============================================================================================
          KORREKTURPFLICHT 2 (Ben, Runde 3): das Blatt oben hängt in der Antwortkarte und wird
          deshalb nur mit einer Antwort gerendert. Ohne Antwort — vor der ersten Frage, während
          des Ladens, im Fehler- und im Lückenfall — steht die Einordnung DIESER FLÄCHE hier, im
          GLEICHEN Bauteil und mit demselben Anker. Die beiden Bedingungen schliessen einander aus
          (`mehr && !antwortkarteSichtbar` gegen `mehr` innerhalb der Karte), es ist also immer
          GENAU EIN Blatt sichtbar; `tests/design/zielbild-h5-fragen.test.ts` misst genau das.
          Der Inhalt ist EIN Bauteil (`MehrFlaechenInfo`), keine zweite Abschrift.

          KORREKTURPFLICHT 1 (Ben, Runde 5): die Weiche fragt jetzt nach der ANTWORTKARTE, nicht
          mehr nach `karteSichtbar`. Im Lückenfall war Letzteres wahr, ohne dass es eine
          Antwortkarte (und damit ihr Blatt) gab — beide Bedingungen waren falsch, das sichtbare
          „Mehr" öffnete nichts. Im Lückenfall trägt das Blatt zusätzlich die Einordnung DIESER
          LÜCKE (`MehrLueckenInfo`), die bis Runde 5 als zweite Karte im Sichtfeld stand. */}
      {mehr && !antwortkarteSichtbar ? (
        <Seitenblatt
          titel={t("ask.menu.label")}
          testId="ask-mehr"
          onSchliessen={() => setMehr(false)}
          ausloeser={() => menuGriffRef.current}
        >
          <MehrFlaechenInfo
            badge={badge}
            guide={guide}
            speechSupported={speechSupported}
            vorlesenMoeglich={vorlesen.moeglich}
          />
          {karteSichtbar && result && contract && !result.answered ? (
            <MehrLueckenInfo contract={contract} sourceSummary={sourceSummary} />
          ) : null}
        </Seitenblatt>
      ) : null}
    </div>
  );
}
