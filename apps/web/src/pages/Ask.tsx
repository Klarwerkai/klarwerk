import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, FileDown, Printer, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos, useReasonerStatus } from "../api/hooks";
import type { AnswerResult } from "../api/types";
import { useToast } from "../app/ToastContext";
// AUFTRAG-mega69 B1 (bens sammel65-Auflage 1): der Kostenhinweis der Beispiel-Chips läuft über
// DASSELBE zentrale Bauteil und DIESELBE Ableitung wie alle anderen Auslösestellen — bedingt an
// `billable` der Aufgabe „answer", nicht mehr als unbedingter eigener Wortlaut.
import { AiCostHint } from "../components/AiCostHint";
import { AiGeneratedNotice } from "../components/AiGeneratedNotice";
import { AiUnavailableHint } from "../components/AiUnavailableHint";
// WP-UX-WOW-1 U1: sichere Markdown-Darstellung der Antwort (React-Elemente, kein HTML-Sink).
import { AnswerMarkdown } from "../components/AnswerMarkdown";
import { AnswerSourceDetails } from "../components/AnswerSourceDetails";
import { DemoBanner } from "../components/DemoBanner";
import { HelpTip } from "../components/HelpTip";
// AUFTRAG-mega71 BLOCK E (Befund aus mega70 Block E, jetzt frei): diese Fläche trug dieselbe
// Sackgassen-Fehlerklasse FÜNFFACH — zweimal /validierung (Führungskarte + Prüfvorbehalt-CTA),
// dazu /konflikte, /risiko und /erfassen?gap=… — und kannte keine einzige Rollenabfrage.
// /fragen ist ab viewer sichtbar; /validierung, /konflikte, /risiko verlangen controller,
// /erfassen experte. Ein Ziel, das die Rolle nicht erreicht, wird als Lage gezeigt, nicht als
// Weg — dasselbe EINE Tor wie auf Start/Library/Capture (mega51/mega70), keine zweite
// Rollenlogik; erhoben wird das vom mega70-Rohlink-Sammler, der seit mega71 auch hier hinsieht.
import { RoleLink } from "../components/RoleLink";
import { ConfidenceBar } from "../components/trust";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";
import { answerExportFilename, buildAnswerMarkdown } from "../lib/answerExport";
import {
  ANSWER_CONTRACT_TRUST_NOTE_KEY,
  answerContract,
  answerSourceSummary,
} from "../lib/askAnswerContract";
// AUFTRAG-mega39 BLOCK D2: die zweite Liste erscheint nur noch, wenn sie etwas Eigenes trägt.
import { attributeSources, canThank, citationState } from "../lib/askCitedSources";
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
import { answerReviewGuard } from "../lib/askView";
import { captureGapHref, gapPrivacyNoticeKey } from "../lib/captureFromGap";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
// AUFTRAG-mega33 A: die EINE effektive Antwort-Einstufung — Quelle jeder Einstufungs-Anzeige.
import { conflictKnowledge, effectiveAnswer } from "../lib/effectiveAnswer";
import { helpfulDisabled, helpfulLabel } from "../lib/helpfulSignal";
import type { EvidenceTone } from "../lib/knowledgeClass";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { type ReasonerBadgeTone, reasonerBadge } from "../lib/reasonerBadge";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { useAiAvailable } from "../lib/useAiAvailable";
import { useAiBillable } from "../lib/useAiBillable";
import { useAuthorName } from "../lib/useAuthorName";
import { useReadiness } from "../lib/useReadiness";

// Tone → Badge-Stil (Tailwind-Tokens), bewusst in der Komponente gehalten.
const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  neutral: "bg-page text-muted",
};

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
// NICHT ANGEFASST: `AnswerMarkdown` (rendert nur Textknoten, sicher — R2-20 selbst belegt).
// `knowledgeClass` wird mit auf „unbekannt" gesetzt, damit kein späterer Leser dieses Zustands
// eine Klasse für eine Antwort findet, die es nicht gibt.
function leereAntwortAlsLuecke(result: AnswerResult): AnswerResult {
  if (!result.answered) {
    return result;
  }
  if ((result.answer ?? "").trim().length > 0) {
    return result;
  }
  return { ...result, answered: false, answer: null, knowledgeClass: "unbekannt" };
}

export function Ask(): JSX.Element {
  const { t, i18n } = useTranslation();
  // SCRUM-272: optionale Startfrage aus der URL (/fragen?q=…) — nur vorbefüllen, kein Auto-Ask.
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => readAskQuestion(params) ?? "");
  // AUFTRAG-mega38 BLOCK J2: „Bitte gib zuerst eine Frage ein." stand auf `/fragen`, BEVOR die
  // Leserin irgendetwas getan hatte — eine Zurechtweisung als Begrüssung. Der Satz ist richtig,
  // sein Zeitpunkt war es nicht. Er erscheint jetzt erst, wenn wirklich leer abgesendet wurde.
  const [emptyAttempted, setEmptyAttempted] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  // FUNKE-FIX P0 (bens ROT-1): der Answer-Receipt DIESES Antwortvorgangs — das „Danke" je Quelle
  // reicht ihn zurück, damit der Server die Quellen-Bindung serverseitig belegen kann.
  const [receipt, setReceipt] = useState("");
  // SCRUM-264: zuletzt gestellte Frage festhalten → für die Anzeige des Rescue-Blocks.
  const [asked, setAsked] = useState("");
  // FUNKE-FIX2 P0 (bens Erforderlich 4): die vom Server erzeugte Wissenslücke (mit ID) — der Capture-
  // Einstieg trägt die GAP-ID (kein Fragetext in der URL); Capture lädt den Text nach Berechtigung.
  const [gapId, setGapId] = useState<string | null>(null);
  const qc = useQueryClient();
  const guide = knowledgeGuidance("ask");

  // SCRUM-233: ehrlicher Reasoner-Modus aus vorhandenem read-only Status (kein Backend-Umbau).
  const reasonerStatus = useReasonerStatus();
  // PAKET 1 (D-AISTATE, Pedi 23.07.): die KI-Antwort (Reasoner-Task „answer") ohne nutzbares Modell
  // HART ausgrauen — kein stiller deterministischer Fallback, der „KI antwortet" vortäuscht.
  const answerAi = useAiAvailable("answer");
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
  // AUFTRAG-mega52 A3: die Quellenliste bekommt eine Ordnung und ein Kennzeichen — tragende zuerst,
  // die übrigen als das, was sie sind. Ist die Zuordnung unbekannt (A5), bleibt alles in Ranking-
  // Reihenfolge und ohne Kennzeichen; der Hinweis darüber sagt dann warum. Eine Quelle, eine Regel
  // (lib/askCitedSources.ts) — Desktop, Mobil und Export lesen dieselbe.
  const answerSources = attributeSources(effective?.sources ?? [], result?.citedSources);
  const attribution = citationState(result?.citedSources);
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
  // SCRUM-366 / FR-ASK-02 / PI-K2: Antwortvertrag — quellengebunden, ehrlich (gesichert vs. ungeprüft
  // vs. Wissenslücke), kein generischer Chatbot. Nur noch die Beschriftung der Einstufung.
  const contract = effective ? answerContract(effective.grade) : null;
  const sourceSummary = result?.answered ? answerSourceSummary(answerSources) : null;

  // WP-UX-WOW-1 U3/U5: die Frage reist als Mutations-PARAMETER — Chips/Direkt-Sender rufen
  // ask.mutate(frage) im selben Handler wie setQ auf, ohne auf den nächsten Render zu warten
  // (der alte q-Closure hätte sonst die VORHERIGE Eingabe gesendet).
  const ask = useMutation({
    mutationFn: (question: string) => endpoints.ask.ask(question, toReasonerLocale(i18n.language)),
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
    onMutate: () => {
      setResult(null);
      setReceipt("");
      setGapId(null);
      setThankedSources(new Set());
    },
    // SCRUM-138: Backend liefert { result, gap, receipt } — Antwort + Answer-Receipt entpacken.
    onSuccess: (r) => {
      // JOB 2694 D1: eine Antwort ohne Text kommt hier als Lücke an — Begründung am Helfer oben.
      setResult(leereAntwortAlsLuecke(selectAnswer(r)));
      setReceipt(r.receipt);
      // FUNKE-FIX2 P0: die neue Lücke merken (ID für den Capture-Einstieg) und die Gap-Liste
      // invalidieren, damit Capture die frisch erzeugte Lücke über ihre ID auflösen kann (der Ersteller
      // ist berechtigt → Volltext). Kein Fragetext in der URL.
      setGapId(r.gap?.id ?? null);
      if (r.gap) {
        void qc.invalidateQueries({ queryKey: ["gaps"] });
      }
    },
  });
  const helpful = useMutation({
    mutationFn: (koId: string) => endpoints.ask.helpful(koId, receipt),
  });
  // FUNKE F2 (nacht24 Paket 6): „Das hat mir geholfen" je QUELLE — Ein-Klick, einmal je
  // Nutzer+Ziel (der Server ist idempotent; die Sitzung merkt sich bedankte Quellen). FUNKE-FIX P0:
  // der Klick reicht den Answer-Receipt zurück (Quellen-Bindung serverseitig belegt).
  const [thankedSources, setThankedSources] = useState<ReadonlySet<string>>(new Set());
  const thankSource = useMutation({
    mutationFn: (koId: string) => endpoints.ask.helpful(koId, receipt),
    onSuccess: (_data, koId) => setThankedSources((prev) => new Set(prev).add(koId)),
  });

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
  const resultRef = useRef<HTMLDivElement | null>(null);
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
    if (withFocus) {
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
  useEffect(() => {
    if (result) {
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
      ask.mutate(trimmed);
    },
    [answerAi.available, ask.isPending, ask.mutate],
  );

  // WP-UX-WOW-1 U2/U3: Beispiel-Chip → Frage setzen UND direkt senden (ein Klick → Antwort).
  const askExample = (question: string): void => {
    setQ(question);
    submitAsk(question);
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
  const autoAsked = useRef(false);
  useEffect(() => {
    if (autoAsked.current || answerAi.isLoading) {
      return;
    }
    if (shouldAutoAskFromSearch(params) && q.trim().length > 0) {
      autoAsked.current = true;
      // WP-UX-WOW-1 U5: die Startfrage auch als Lücken-/Capture-Kontext festhalten (wie Submit) —
      // das übernimmt submitAsk; ohne nutzbares Modell passiert bewusst NICHTS.
      submitAsk(q);
    }
  }, [params, q, answerAi.isLoading, submitAsk]);

  // SCRUM-430 (VIP): beantwortete Frage inkl. Quellen exportieren/teilen. Quellen bleiben klar
  // ausgewiesen (Status/Trust/Nutzbarkeit). Markdown wird erst beim Klick gebaut (frischer Zeitstempel).
  const { push } = useToast();
  const kosById = new Map((kos.data ?? []).map((k) => [k.id, k]));
  const buildExport = (): { markdown: string; filename: string } | null => {
    if (!result?.answered || !effective) {
      return null;
    }
    const generatedAt = new Date().toISOString();
    const sources = answerSources.map((s) => {
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
        // das, und im Markdown sah eine nur konsultierte Quelle aus wie eine tragende. Bei
        // UNBEKANNTER Zuordnung bleibt das Feld bewusst leer (genau wie die Plakette unten): eine
        // erfundene Einordnung wäre schlimmer als keine.
        ...(attribution === "attributed"
          ? {
              attributionLabel: t(
                s.carrying ? "ask.attribution.carrying.badge" : "ask.attribution.consulted.badge",
              ),
            }
          : {}),
      };
    });
    const markdown = buildAnswerMarkdown({
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
        ...(attribution === "attributed"
          ? {}
          : { attributionUnknown: t("ask.attribution.unknown") }),
      },
    });
    return { markdown, filename: answerExportFilename(generatedAt) };
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
    const blob = new Blob([ex.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ex.filename;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t("ask.kicker")}
        title={t("ask.title")}
        actions={<HelpTip title={t("ask.help.sources.title")} body={t("ask.help.sources.body")} />}
      />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="ask" /> : null}
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{t("ask.intro")}</p>
        {/* ==========================================================================
            SCHEIBE D-034 (JOB 1106) — DER MODUS-CHIP ERKLÄRT SICH NICHT MEHR NUR DER MAUS.
            ==========================================================================
            Der Chip trug seine Erklärung ausschliesslich als `title`: ein `<span>` ohne Fokus,
            ohne `aria-label`. Für Touch, Tastatur und Vorleseprogramm stand dort ein Fachwort
            ohne jede Auflösung. Der `title` BLEIBT — er ist der kürzeste Weg für die Maus und
            nimmt niemandem etwas. Daneben steht ab hier das VORHANDENE Bauteil `HelpTip`: ein
            echter Knopf, per Tabulator erreichbar, der denselben Satz (`ask.reasoner.hint`) als
            LESBAREN Text öffnet — überschrieben mit genau dem Modus, um den es geht, damit die
            Zuordnung auch ohne Blick auf den Chip eindeutig ist. Kein neuer Text, kein neuer
            i18n-Schlüssel, kein neues Bauteil.
            Gehütet von `tests/app/ask-fragt-zuerst-mounted.test.tsx`. */}
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

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // PAKET 3.1 (D-AISTATE, bens V4): Enter/Formular läuft über DENSELBEN zentralen Submit wie
          // Chips und Auto-Ask — die harte KI-Sperre (Availability + Pending) sitzt in submitAsk;
          // kein Weg umgeht die ausgegraute Schaltfläche (bens Bypass-Befund 6.2).
          // AUFTRAG-mega38 BLOCK J2: der Fehlversuch wird HIER vermerkt — der Knopf ist bei leerer
          // Frage gesperrt, per Eingabetaste kommt man aber sehr wohl bis hierher.
          setEmptyAttempted(q.trim().length === 0);
          submitAsk(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("ask.placeholder")}
          // E2E-018: leere/Whitespace-Frage ist ungültig — für Screenreader auszeichnen.
          // AUFTRAG-mega39 BLOCK G: erst NACH dem Fehlversuch. mega38 J2 hat den sichtbaren Tadel
          // zeitlich richtiggestellt (die Meldung erscheint erst, wenn jemand tatsächlich abzuschicken
          // versucht hat) — das Signal daneben stand weiter ab dem ersten Bildaufbau auf „ungültig".
          // Für eine Screenreader-Nutzerin hiess das: das leere Feld, das sie gerade erst gefunden
          // hat, meldet sich als fehlerhaft, bevor sie etwas getan hat. Dieselbe Zurechtweisung wie
          // J2, nur für jemanden, der den Bildschirm nicht sieht. Jetzt laufen beide im Takt.
          aria-invalid={emptyAttempted && q.trim().length === 0}
          aria-describedby="ask-empty-hint"
          className="h-11 flex-1 rounded-input border border-hairline bg-surface px-3.5 text-sm outline-none focus:border-ink/30"
        />
        <Button
          type="submit"
          variant="primary"
          // PAKET 1 (D-AISTATE): hart ausgrauen, wenn kein Modell für „answer" nutzbar ist.
          // E2E-018: zusätzlich sperren, solange die Frage leer/Whitespace-only ist.
          disabled={ask.isPending || !answerAi.available || q.trim().length === 0}
          title={!answerAi.available ? t("ai.unavailable.hint") : undefined}
        >
          {t("ask.submit")}
          <ArrowRight size={15} />
        </Button>
      </form>
      {/* E2E-018: zugängliche Inline-Meldung — nur wenn ein Modell da ist (sonst greift der
          Unavailable-Hinweis), damit klar ist, warum der Knopf gesperrt ist. */}
      <output
        id="ask-empty-hint"
        aria-live="polite"
        className="mt-1.5 block text-[12px] text-muted"
      >
        {answerAi.available && emptyAttempted && q.trim().length === 0 ? t("ask.emptyHint") : ""}
      </output>
      <AiUnavailableHint show={!answerAi.available} />
      {/* AUFTRAG-mega61 Block E: die Fragenfläche trug bisher KEINEN dauerhaft sichtbaren
          KI-Hinweis — nur eine Pille mit `title`, also erst nach dem Zeigen mit der Maus. Der Satz
          steht jetzt ohne Interaktion da, direkt am Eingabefeld und damit VOR der ersten Frage. */}
      <p className="mt-1.5">
        <AiGeneratedNotice />
      </p>

      {/* WP-UX-WOW-1 U2/U3 (statt SCRUM-265-Statik): ehrliche Beispiel-Chips. Antwort-Beispiele
          kommen aus dem ECHTEN validierten Bestand (Badge damit ehrlich korrekt), dazu EINE bewusste
          Lücken-Frage; ohne validierten Bestand neutrale statische Beispiele ohne Behauptung.
          Klick sendet DIREKT — kein zweiter Klick nötig. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
          {t("ask.examplesLabel")}
        </span>
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

      {/* AUFTRAG-mega38 BLOCK A: DIE Ergebnisfläche. Sie ist immer im DOM (s. revealResult) und
          trägt alles, was auf eine Frage folgen kann — Warten, Fehler, Antwort, Wissenslücke.
          `scroll-mt-*` hält beim Anspringen etwas Luft über dem Kopf. */}
      <div
        ref={resultRef}
        tabIndex={-1}
        data-testid="ask-result-anchor"
        className="scroll-mt-6 outline-none"
      >
        {/* A1: der Ladezustand steht DORT, wo die Antwort erscheinen wird — nicht am Knopf. Die
            Mindesthöhe ist der Punkt: die Seite muss sich sichtbar verändern, sonst klickt der
            Leser ein zweites Mal, weil er den ersten Klick für verloren hält. */}
        {ask.isPending ? (
          <div
            data-testid="ask-pending"
            aria-busy="true"
            aria-live="polite"
            className="mt-5 min-h-[13rem] rounded-card border border-dashed border-hairline bg-surface p-5"
          >
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
              {t("ask.contract.label")}
            </span>
            <p className="mt-0.5 text-[13px] font-semibold text-text">{t("ask.pending.title")}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              {t("ask.pending.body")}
            </p>
            {/* Ruhige Platzhalterzeilen: sie zeigen die FORM der kommenden Antwort, ohne etwas
                über ihren Inhalt zu behaupten. */}
            <div aria-hidden="true" className="mt-4 space-y-2">
              <div className="h-3 w-11/12 animate-pulse rounded-pill bg-page" />
              <div className="h-3 w-9/12 animate-pulse rounded-pill bg-page" />
              <div className="h-3 w-10/12 animate-pulse rounded-pill bg-page" />
              <div className="h-3 w-6/12 animate-pulse rounded-pill bg-page" />
            </div>
          </div>
        ) : null}
        {/* A3: bis mega37 hinterließ eine abgewiesene Anfrage eine völlig unveränderte Seite —
            kein Toast, keine Meldung, nichts. Jetzt steht sie an derselben Stelle wie die Antwort. */}
        {ask.isError ? (
          <div
            data-testid="ask-error"
            role="alert"
            className="mt-5 rounded-card border border-trust-crit-fill bg-trust-crit-bg p-5"
          >
            <p className="text-[13px] font-semibold text-trust-crit-text">{t("ask.error.title")}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-trust-crit-text">
              {t("ask.error.body")}
            </p>
            <Button className="mt-3" variant="ghost" onClick={() => submitAsk(asked || q)}>
              {t("ask.error.retry")}
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : null}
        {/* Solange eine neue Frage läuft, bleibt die ALTE Antwort nicht stehen: sie gehört zu einer
            anderen Frage, und stehenzubleiben hieße, sie als Antwort auf die neue auszugeben. */}
        {!ask.isPending && result && contract ? (
          <>
            {/* SCRUM-366 / AG-P2-2 / AG-P2-3 / PI-K2: Antwortvertrag — ruhige Karte, die vor dem Lesen
              klar macht: Worauf basiert die Antwort? Gesichert, ungeprüft oder Wissenslücke? Quellen-
              bilanz + ehrliche Trust-Notiz (kein Wahrheitsversprechen) + sicherer nächster Schritt.

              SCHEIBE D-047 (JOB 1022) — DIESE KASTENFORM GILT NUR NOCH FÜR DIE WISSENSLÜCKE.
              Im beantworteten Zustand stand sie VOR der Antwort und war damit eine zweite, mit der
              Antwortkarte konkurrierende Einordnungsfläche: dieselbe Tatsache, zweimal gerahmt.
              Genau diese Parallelstruktur löst D-047 ab. Ihre Texte sind NICHT gestrichen — sie
              stehen im Antwortfall als kompakte Einordnungs-/Nachlaufstruktur unter der Antwort
              (`ask-contract-line` weiter unten), jeder genau einmal.
              Im LÜCKENFALL bleibt der Kasten unverändert: dort gibt es keine Antwort, unter die
              etwas rücken könnte, und ein Wegfall wäre eine ersatzlose Textstreichung — die Falle,
              in die eine unbedachte Ablösung hier läuft, weil kein Antwort-Test sie sehen würde. */}
            {!result.answered ? (
              <Card
                className={`mt-5 ${
                  contract.tone === "pos"
                    ? "border-trust-pos-fill bg-trust-pos-bg"
                    : "border-trust-warn-fill bg-trust-warn-bg"
                }`}
              >
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
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t(contract.bodyKey)}
                </p>
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
              </Card>
            ) : null}
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
              <Card className="print-area mt-3" data-testid="ask-answer">
                {/* D-047: die Antwort zuerst — Begründung unmittelbar über dieser Karte. */}
                <AnswerMarkdown
                  text={result.answer ?? ""}
                  className="ask-answer-body text-[15px] leading-relaxed text-text"
                />
                {/* mega62 Block E: der KI-Satz gehört IN die Druckfläche (sonst fehlt er im PDF).
                    D-047: er folgt UNMITTELBAR auf die Antwort statt ihr voranzugehen — Artikel 50
                    verlangt die Kennzeichnung an der erzeugten Ausgabe, nicht vor ihr. Wortlaut,
                    Bauteil und Druckfläche unverändert. */}
                <p className="mt-2">
                  <AiGeneratedNotice />
                </p>
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
                      contract.tone === "pos" ? "text-trust-pos-text" : "text-trust-warn-text"
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
                    </>
                  ) : null}
                </div>
                <div className="mt-1.5 border-t border-hairline pt-1.5">
                  <p className="text-[12.5px] leading-relaxed text-muted">{t(contract.bodyKey)}</p>
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
                    <span
                      className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[effective?.evidence.tone ?? "neutral"]}`}
                    >
                      {t("ask.evidence")}:{" "}
                      {t(effective?.evidence.labelKey ?? "ask.knowledgeClass.unbekannt")}
                    </span>
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
                    nichts. Der Balken kommt zurück, sobald eine Marke da ist. */}
                  {attribution === "unattributed" ? (
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
                {/* SCRUM-430 (VIP): Antwort inkl. Quellen exportieren/teilen — Kopieren, Markdown-Download,
                  Druck/PDF. Beim Drucken über die Body-Klasse isoliert (nur diese Karte). */}
                <div className="print-hide mb-3 flex flex-wrap items-center gap-1.5">
                  <Button variant="ghost" onClick={copyAnswer}>
                    <Copy size={14} />
                    {t("ask.export.copy")}
                  </Button>
                  <Button variant="ghost" onClick={downloadAnswer}>
                    <FileDown size={14} />
                    {t("ask.export.download")}
                  </Button>
                  <Button variant="ghost" onClick={printAnswer}>
                    <Printer size={14} />
                    {t("ask.export.print")}
                  </Button>
                </div>
                {reviewGuard ? (
                  <div className="mt-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
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
                {/* AUFTRAG-mega39 BLOCK D2: die Liste erschien bis mega38 IMMER — und wiederholte
                  dabei Eintrag für Eintrag die Quellenliste darunter, unter einem Namen
                  („Argumentationsschritte"), den es nicht gibt: es existiert keine protokollierte
                  Herleitung. Sie erscheint jetzt nur noch, wenn sie eine Fundstelle trägt, die in
                  der Quellenliste NICHT steht (lib/askSteps.ts). */}
                {stepsWorthShowing(result.steps, answerSources) ? (
                  <div className="mt-4">
                    <SectionLabel>{t("ask.steps")}</SectionLabel>
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
                              to={demoHref(`/wissen/${s.sourceId}`, params)}
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
                {/* SCRUM-357 / AG-14 / VC-P1-1: mind. eine Antwortquelle hat einen offenen Konflikt →
                ehrlicher Hinweis, dass die Antwort trotz Status nicht uneingeschränkt gesichert ist. */}
                {effective?.sourcesConflicted ? (
                  <div className="mt-3 rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2">
                    <p className="text-[12.5px] font-semibold text-trust-warn-text">
                      {t("conflict.impact.title")}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                      {t("conflict.impact.hint")}
                    </p>
                    {/* AUFTRAG-mega71 BLOCK E (Stelle 3): /konflikte verlangt controller. Der
                        Unterstrich (Link-Versprechen) gehört nur zur begehbaren Fassung. */}
                    <RoleLink
                      to="/konflikte"
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-trust-warn-text"
                      hoverClassName="underline"
                    >
                      {() => <>{t("conflict.impact.cta")}</>}
                    </RoleLink>
                  </div>
                ) : null}
                {/* ==========================================================================
                  AUFTRAG-mega32 BLOCK E (Pedi 27.07.) — DER PRÜFVORBEHALT.
                  ==========================================================================
                  Der Hinweis oben spricht über GEFUNDENE Konflikte. Dieser hier spricht über
                  das, was gar nicht erst vollständig gesucht wurde — und er benennt, worauf er
                  sich bezieht: wie viele der herangezogenen Quellen betroffen sind, von wie
                  vielen, und mit welcher Ursache. Ohne ihn läse sich eine Antwort als gesichert,
                  obwohl unbekannte Konflikte nicht ausgeschlossen sind. */}
                {/* ==========================================================================
                  AUFTRAG-mega34 BLOCK A2 — DER HINWEIS AUF DEN UNBEKANNTEN KONFLIKTSTAND.
                  ==========================================================================
                  Der Vorbehalt darunter spricht über Prüf-Läufe, die es nicht vollständig gab.
                  Dieser hier spricht über die Konfliktliste, die diese Seite gerade GAR NICHT
                  kennt — weil sie noch lädt oder weil ihr Abruf abgerissen ist. Ohne ihn läse
                  sich ein Netzfehler als „keine Konflikte" und damit als Sicherheit. */}
                {conflictCaveat ? (
                  <div
                    data-testid="ask-conflict-caveat"
                    className="mt-3 rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
                  >
                    <p className="text-[12.5px] font-semibold text-trust-warn-text">
                      {t("ask.conflictCaveat.title")}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                      {t(`ask.conflictCaveat.${conflictCaveat.reason}`)}
                    </p>
                  </div>
                ) : null}
                {checkCaveat ? (
                  <div
                    data-testid="ask-check-caveat"
                    className="mt-3 rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
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
                {result.sources.length > 0 ? (
                  <div className="mt-4">
                    <SectionLabel>{t("ask.sources")}</SectionLabel>
                    {/* SCRUM-300: ehrliche Kernaussage — die Antwort ist quellengebunden und nur so
                    belastbar wie die genutzte Quelle (Status/Trust/Nutzbarkeit). */}
                    <p className="mt-0.5 text-[12px] text-muted-2">{t("ask.sourcesHint")}</p>
                    {/* AUFTRAG-mega52 A5 — DIE REISSLEINE, SICHTBAR.
                      Liefert das Modell keine oder unbrauchbare Fußnotenmarken, wird NICHT geraten
                      und NICHT stillschweigend auf alle Quellen zurückgefallen. Stattdessen steht
                      hier, dass die Zuordnung nicht möglich war — und keine Zeile unten trägt ein
                      Kennzeichen. „Unbekannt" ist eine andere Aussage als „keine". */}
                    {attribution === "unattributed" ? (
                      <p
                        data-testid="ask-attribution-unknown"
                        className="mt-1.5 rounded-card border border-hairline bg-page px-2.5 py-1.5 text-[12px] leading-relaxed text-muted"
                      >
                        {t("ask.attribution.unknown")}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        {t("ask.attribution.known")}
                      </p>
                    )}
                    {/* SCRUM-250: Quellen handlungsnah — KO-Titel statt roher ID, Link zum Detail.
                    SCRUM-300: je Quelle die kanonische Nutzbarkeit (gleiche Sprache wie KO-Detail/
                    Library) + Demo-Kontext am Link weitertragen (kein Auto-Use). */}
                    <ul className="mt-1.5 space-y-1.5">
                      {answerSources.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            to={demoHref(`/wissen/${s.id}`, params)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-brand-text hover:underline"
                          >
                            <ArrowRight size={12} className="shrink-0 text-muted-2" />
                            <span className="text-text">{s.label}</span>
                          </Link>
                          {/* AUFTRAG-mega52 A3: das Kennzeichen, das die Liste erst zu einer Aussage
                            macht. Tragende Quellen stehen oben und heißen so; die übrigen heißen,
                            was sie sind — angesehen, nicht verwendet. Bei unbekannter Zuordnung
                            trägt KEINE Zeile ein Kennzeichen (der Hinweis oben sagt warum). */}
                          {attribution === "attributed" ? (
                            <span
                              data-testid={
                                s.carrying ? "ask-source-carrying" : "ask-source-consulted"
                              }
                              title={t(
                                s.carrying
                                  ? "ask.attribution.carrying.hint"
                                  : "ask.attribution.consulted.hint",
                              )}
                              className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                                s.carrying
                                  ? "bg-trust-pos-bg text-trust-pos-text"
                                  : "bg-hairline-soft text-muted-2"
                              }`}
                            >
                              {t(
                                s.carrying
                                  ? "ask.attribution.carrying.badge"
                                  : "ask.attribution.consulted.badge",
                              )}
                            </span>
                          ) : null}
                          {s.usability ? (
                            <span
                              title={t(useReadiness(s.usability).hintKey)}
                              className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${EVIDENCE_TONE[useReadiness(s.usability).tone]}`}
                            >
                              {t(useReadiness(s.usability).labelKey)}
                            </span>
                          ) : null}
                          {/* AUFTRAG-mega32 E: die Quelle, deren Prüf-Lauf die Vollständigkeit nicht
                            belegt. Der Vorbehalt oben nennt die Zahl — hier steht, WELCHE es sind. */}
                          {s.checkState !== "proven" ? (
                            <span
                              data-testid="ask-source-unproven"
                              title={t(`ask.checkCaveat.${s.checkState}`, {
                                unproven: 1,
                                total: 1,
                              })}
                              className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text"
                            >
                              {t("ask.checkCaveat.badge")}
                            </span>
                          ) : null}
                          {/* SCRUM-357 / AG-14: konfliktbetroffene Quelle ehrlich kennzeichnen. */}
                          {s.conflictLimited ? (
                            <span
                              title={t("conflict.impact.hint")}
                              className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text"
                            >
                              {t("conflict.impact.badge")}
                            </span>
                          ) : null}
                          {/* WP-RETEST7 R5: Treffer kam über die Bild-Fußnote — gleiche Fundstellen-
                            Kennzeichnung wie in der Bibliothek. */}
                          {result.captionSources?.includes(s.id) ? (
                            <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
                              {t("lib.match.caption")}
                            </span>
                          ) : null}
                          {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral, kein Statussignal). */}
                          {s.demo ? (
                            <span
                              title={t("demo.badge.hint")}
                              className="shrink-0 rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2"
                            >
                              {t("demo.badge.label")}
                            </span>
                          ) : null}
                          {/* FUNKE F2 (nacht24): Danke je Quelle — Ein-Klick, idempotent je
                            Nutzer+Ziel; fließt in die Wirkung des Autors + dezente Glocke. */}
                          {/* AUFTRAG-mega52 A4: gedankt wird nur, was die Antwort GETRAGEN hat.
                            Der Answer-Receipt bindet serverseitig genau diese Quellen — ein Danke
                            auf eine bloß angesehene Quelle endete dort mit 403. Statt den Nutzer
                            hineinlaufen zu lassen, gibt es den Knopf hier gar nicht. Das ist keine
                            Kosmetik: bis mega52 bekam JEDES angesehene Objekt ein Vertrauensplus. */}
                          {canThank(s) ? (
                            <button
                              type="button"
                              disabled={thankedSources.has(s.id) || thankSource.isPending}
                              onClick={() => thankSource.mutate(s.id)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-hairline px-2 py-0.5 text-[10.5px] font-semibold text-muted hover:text-text disabled:opacity-60"
                            >
                              <ThumbsUp size={11} />
                              {thankedSources.has(s.id) ? t("ask.thanked") : t("ask.helpful")}
                            </button>
                          ) : null}
                          {/* Paket 4 (nacht24, C1/C2/E1): je Quelle Status/Trust-Badge, Pulldown-
                            Summary (E2-Baustein) und Auszug im DOKUMENT-Format (SanitizedHtml-
                            Kette) — nur aus bereits geladenen, berechtigten KO-Daten. */}
                          {(() => {
                            const sourceKo = (kos.data ?? []).find((k) => k.id === s.id);
                            return sourceKo ? (
                              <AnswerSourceDetails
                                ko={sourceKo}
                                authorName={authorNameOf(sourceKo.author)}
                              />
                            ) : null;
                          })()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {/* AUFTRAG-mega52 A4: auch der große Knopf zielt jetzt auf die TRAGENDE Quelle,
                  nicht mehr blind auf `result.sources[0]` — bei unbekannter Zuordnung gibt es keine,
                  und er bleibt gesperrt, statt in den serverseitigen 403 zu laufen. */}
                <Button
                  className="print-hide mt-4"
                  disabled={helpfulDisabled(
                    { pending: helpful.isPending, success: helpful.isSuccess },
                    (result.citedSources ?? []).length === 0,
                  )}
                  onClick={() => {
                    const carrying = (result.citedSources ?? [])[0];
                    if (carrying) {
                      helpful.mutate(carrying);
                    }
                  }}
                >
                  <ThumbsUp size={15} />
                  {helpfulLabel({ success: helpful.isSuccess }, t("ask.helpful"), t("ask.thanked"))}
                </Button>
              </Card>
            ) : (
              <Card className="mt-3 border-dashed" data-testid="ask-gap">
                <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                  {t("ask.gapBadge")}
                </span>
                <p className="mt-2 text-[15px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
                <p className="mt-1 text-sm text-muted">{t("ask.noBasisBody")}</p>
                {/* SCRUM-369 / AG-12/13/P2-4: die Lücke als geführter „Wissenslücke retten"-Einstieg —
                  Story + Beitragswert + ehrlich „keine Antwort erfunden" + geführte Schrittfolge. */}
                <div className="mt-3 rounded-card border border-ai/30 bg-ai/5 px-3 py-2.5">
                  <div className="text-[13px] font-semibold text-ai">
                    {t(GAP_RESCUE_TEXT.storyTitle)}
                  </div>
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
                {/* AUFTRAG-mega54 BLOCK E1: hier stand ein ZWEITER „Nächster Schritt:" — er schickte
                    zum Risiko-Board, während der Vertragskasten weiter oben auf demselben Bildschirm
                    zum kostenlosen Umformulieren riet. Zwei widersprüchliche nächste Schritte sind
                    schlechter als einer. Der eine Schritt steht jetzt ausschließlich im
                    Vertragskasten (`answerContract("gap").nextStepKey`, gerendert weiter oben) —
                    diese Karte wiederholt ihn nicht. */}
                {/* SCRUM-283: ehrlich + datensparsam — Frage wird als Lücke gespeichert, keine Antwort,
                keine sensiblen Details; geprüfte Erfahrung später ergänzen. */}
                <p className="mt-2 rounded-btn bg-page px-2.5 py-2 text-[12px] text-muted-2">
                  {t(gapPrivacyNoticeKey())}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* SCRUM-264: direkt Wissen erfassen — die gestellte Frage als Capture-Kontext (kein Auto-KO). */}
                  {/* AUFTRAG-mega71 BLOCK E (Stelle 4): /erfassen verlangt experte — die Expertin
                      der Vortest-Aufgabe geht hier durch, die Betrachterin sieht die Lage. */}
                  {gapId ? (
                    <RoleLink
                      to={captureGapHref(gapId)}
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
                  {/* AUFTRAG-mega71 BLOCK E (Stelle 5): /risiko verlangt controller. */}
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
              </Card>
            )}
          </>
        ) : null}
      </div>

      {/* ==========================================================================
          SCHEIBE D-034 (JOB 1106) — ERST FRAGEN, DANN ERKLÄREN.
          ==========================================================================
          Diese Erklär-Karte (SCRUM-289: warum Klarwerk kein generischer Chat ist) stand VOR dem
          Eingabefeld — als dritter von vier Textblöcken, die eine Leserin durchqueren musste,
          bevor sie ihre Frage tippen konnte, und mit einer Kachel, die auf diese Seite selbst
          verlinkt. D-034 lässt ausdrücklich beides zu: „hinter das Eingabefeld verschieben ODER
          in ein `<details>` falten (Kopfzeile bleibt sichtbar)". Hier steht beides zusammen, und
          zwar aus einem Grund: nur gefaltet bliebe sie das oberste Element (dieselbe Falle, die
          D-035 für Admin/Lebenszyklus ausdrücklich benennt), nur verschoben stünde sie als volle
          Karte am Seitenende.
          IHR ORT IST BEWUSST HINTER DER ERGEBNISFLÄCHE. Wartezustand und Antwort sind erklärte
          Nicht-Ziele dieser Scheibe — mega38 Block A hat sie mühsam nach oben gebracht, und
          nichts von hier darf sich zwischen Frage und Antwort schieben. Solange keine Frage
          gestellt ist, ist die Ergebnisfläche leer; die Erklärung steht dann optisch unmittelbar
          unter den Beispiel-Chips, also genau dort, wo sie beim ersten Besuch gebraucht wird.
          KEIN TEXT ENTFÄLLT: Titel, Fliesstext und beide Kacheln sind unverändert; der Titel ist
          jetzt zusätzlich die sichtbare Kopfzeile der Faltung.
          Gehütet von `tests/app/ask-fragt-zuerst-mounted.test.tsx`. */}
      <details data-testid="ask-guide" className="mt-5">
        <summary className="cursor-pointer">
          <h2 className="inline text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h2>
        </summary>
        <Card className="mt-2 border-dashed">
          <p className="text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* AUFTRAG-mega71 BLOCK E (Stelle 1): der Eintrag „prüfen lassen" führt auf
                /validierung (controller) — für Betrachter und Experten eine Lage, keine stille
                Sackgasse. Die Erklärung selbst bleibt für alle stehen (dieselbe Entscheidung wie
                Library). */}
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
    </div>
  );
}
