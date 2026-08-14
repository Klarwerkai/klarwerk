import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { AssistResult, Confidentiality, KnowledgeObject, StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { ImageDescribeProvider } from "../app/ImageDescribeContext";
// AUFTRAG-mega9 Block B (KW-E2E-002): DERSELBE Navigations-Wächter, den /erfassen schon nutzt —
// kein zweiter Wächter, keine kopierte Logik, nur ein weiterer Anmelder an derselben Vorrichtung.
import { GuardedLink, useNavGuard, useUnloadGuard } from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { AiCostHint } from "../components/AiCostHint";
import { AiGeneratedNotice } from "../components/AiGeneratedNotice";
import { DraftBodyGallery } from "../components/DraftBodyGallery";
import { HelpTip } from "../components/HelpTip";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  applyBodyAssist,
  applySpellingAssistPreservingHtml,
  applyStructureProposal,
  bodyTextForAssist,
  structureProposalTitleOnly,
} from "../lib/bodyAiAssist";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
// JOB 530: die weiteren Eingabeoptionen dieser Seite — Liste, Copy-Schlüssel und der gemerkte
// Aufklappzustand kommen aus DEM Helfer, den auch der Erfassen-Bereich benutzt (Begründung dort).
import {
  FRONT_DOOR_OPTIONS_TEXT,
  FRONT_DOOR_OPTION_MODES,
  frontDoorOptionHintKey,
  frontDoorOptionLabelKey,
  frontDoorOptionsOpen,
  rememberFrontDoorOptionsOpen,
} from "../lib/captureEntry";
import {
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  submitFrontDoorDraft,
  withFrontDoorSaveTimeout,
} from "../lib/captureFrontDoor";
import { type CaptureHelpId, captureHelp } from "../lib/captureHelp";
import { CONFIDENTIALITY_LEVELS, confidentialityOf } from "../lib/confidentiality";
// AUFTRAG-mega23 Block A: DIESELBE Quelle wie der Erfassen-Weg — Erzeugung des Schlüssels, wann er
// fällt, und welcher 409 einen neuen Vorgang rechtfertigt. Kein zweiter Mechanismus, keine eigene
// Auslegung an dieser Tür.
import {
  createConflictOffersRestart,
  createOperationIsSettled,
  newCreateOperationId,
} from "../lib/createOperation";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { draftProvenance } from "../lib/reasonerProvenance";
import { isEmptyHtml } from "../lib/richText";
import { useAiBillable } from "../lib/useAiBillable";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function CaptureFrontDoor(): JSX.Element {
  const { i18n, t } = useTranslation();
  const { user } = useSession();
  // AUFTRAG-mega67 Block G: der EINE Kostenhinweis dieses Kastens deckt BEIDE Auslöser darin
  // („Vorschlag strukturieren" und „KI-Hilfe anwenden"). Kostet einer von beiden, muss er stehen —
  // nur „structure" zu fragen ließe einen teuren Assist-Klick unangekündigt.
  const strukturKostet = useAiBillable(["structure", "assist"]);
  const { push } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  // AUFTRAG-mega12 Block A: `guard` wird hier nicht mehr von Hand gerufen — der eine verbliebene
  // geschützte Ausgang läuft über `GuardedLink`. Die Anmeldung (`setGuard`) bleibt unverändert.
  const { setGuard } = useNavGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeDraftId = searchParams.get("draft");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // JOB 512 (R5): die Quellbildzahl des geladenen Entwurfs. Sie stammt aus der Entwurfsnutzlast und
  // NICHT aus einem Importzustand — der Ganzdokument-Import räumt seinen Dateizustand direkt nach
  // dem Speichern (Capture.tsx:1041-1049) und verlinkt erst danach hierher (`?draft=<id>`). `null`
  // heisst „dieser Entwurf kennt seine Quellzahl nicht" und führt zu KEINER Verlustaussage.
  const [quellBildzahl, setQuellBildzahl] = useState<number | null>(null);
  // AUFTRAG-mega69 Block A: Bitte der Galerie, das Bildbeschreibungs-Formular des Editors für ein
  // bestimmtes Bild zu öffnen (Pedis Weg: importiertes Bild → Großansicht → Beschreibung). Der
  // nonce macht jede Bitte zu einem neuen Ereignis — dasselbe Bild kann erneut geöffnet werden.
  const [captionRequest, setCaptionRequest] = useState<{ imageId: string; nonce: number } | null>(
    null,
  );
  // SCRUM-502 Schicht 2 (Round 3): Vertraulichkeit auch im Front-Door erfassen — steuert den
  // Reasoner-Egress (source:"draft") UND fließt in den Entwurf/das spätere KO. Standard „intern".
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("intern");
  // JOB 504 D2: der ROHE Herkunftswert — `undefined` heisst „der fortgesetzte Entwurf trug KEINE
  // Stufe". Er steuert AUSSCHLIESSLICH die Modell-Provenienz und wird bewusst NICHT auf "intern"
  // geglaettet: `failSafeConfidentiality` (lib/reasonerProvenance.ts) muss den fehlenden Wert selbst
  // sehen, sonst wird aus einem UNGESETZTEN Feld eine ausdrueckliche Cloud-Freigabe. Der
  // Formularstandard "intern" bleibt davon unberuehrt (bewusste Auswahl, s. `confidentiality`).
  const [declaredConfidentiality, setDeclaredConfidentiality] = useState<
    Confidentiality | undefined
  >("intern");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [structureProposal, setStructureProposal] = useState<StructureResult | null>(null);
  const [structureErr, setStructureErr] = useState<string | null>(null);
  const [structureAccepted, setStructureAccepted] = useState(false);
  // WP-D6/WP-D6b: true, wenn beim Übernehmen des Struktur-Vorschlags der reiche Body (Bilder/Struktur/
  // Formatierung) BEWUSST erhalten wurde (nicht ersetzt). structureTitleAdopted unterscheidet die ehrliche
  // Meldung: Titel war leer und wurde gesetzt (a) vs. Titel war bereits vorhanden (b). Kernaussage wird nie
  // in den Inhalt übernommen.
  const [structureKeptRichBody, setStructureKeptRichBody] = useState(false);
  const [structureTitleAdopted, setStructureTitleAdopted] = useState(false);
  const [assistAction, setAssistAction] = useState<AssistAction>("clarify");
  const [assistProposal, setAssistProposal] = useState<
    (AssistResult & { action: AssistAction }) | null
  >(null);
  const [assistErr, setAssistErr] = useState<string | null>(null);
  const [assistAccepted, setAssistAccepted] = useState(false);
  const [submittedKo, setSubmittedKo] = useState<Pick<KnowledgeObject, "id" | "title"> | null>(
    null,
  );
  // AUFTRAG-mega9 Block A (KW-E2E-001): true, sobald ein Einreichversuch an einer Inhaltsbedingung
  // gescheitert ist — dann steht die Begründung SICHTBAR am Feld statt nur im grauen Knopf.
  const [submitValidation, setSubmitValidation] = useState(false);
  const proposalRef = useRef<HTMLDivElement | null>(null);
  // AUFTRAG-mega9 Block A: Anker der sichtbaren Feldvalidierung. scrollIntoView wird wie im R7-Muster
  // per ?.() aufgerufen — Umgebungen ohne die API dürfen keine Exception werfen.
  const validationRef = useRef<HTMLDivElement | null>(null);
  // AUFTRAG-mega9 Block B (KW-E2E-002): der GESICHERTE Stand, gegen den „ungespeichert" gemessen wird.
  // Ein Vergleich gegen „ist gesetzt" (wie hasDiscardRisk) wäre hier falsch: das bloße ÖFFNEN eines
  // gespeicherten Entwurfs ist keine ungespeicherte Änderung und darf keine Warnung auslösen. Der
  // Bezugspunkt wird beim Laden, Speichern und Einreichen fortgeschrieben — dasselbe „gegen frische
  // Defaults, nicht gegen ist-gesetzt"-Prinzip wie hasUnsavedMeta im Erfassen-Weg (mega3).
  const savedStateRef = useRef<{
    title: string;
    bodyHtml: string;
    confidentiality: Confidentiality;
  }>({ title: "", bodyHtml: "", confidentiality: "intern" });
  const saveRequestedRef = useRef(false);
  const submitRequestedRef = useRef(false);
  // AUFTRAG-mega9 Block B: true, während der Wächter-Dialog das Speichern angestoßen hat — dann
  // navigiert der Wächter, nicht die Seite (siehe save.onSuccess).
  const guardSaveRef = useRef(false);
  // ============================================================================================
  // AUFTRAG-mega23 Block A — DER VORGANG DIESER VORDERTÜR.
  // ============================================================================================
  // Beide Refs gehören zusammen und beide leben AUSSERHALB der Mutationsfunktion, damit sie die
  // Wiederholung überleben: der Schlüssel sagt dem Server „derselbe Vorgang", der gemerkte Entwurf
  // sorgt dafür, dass der Serverabdruck (er enthält die Entwurfskennung) über die Wiederholung
  // hinweg gleich bleibt. Die Begründung im Ganzen steht in lib/captureFrontDoor.ts.
  const submitOperationRef = useRef<string | null>(null);
  const submitDraftRef = useRef<string | null>(null);
  // Steht hier eine Meldung, hat der Server einen 409 mit einem Code geliefert, für den ein NEUER
  // Vorgang der richtige Ausweg ist. Die Oberfläche BIETET die Handlung sichtbar an — sie führt sie
  // nicht hinter dem Rücken des Nutzers aus (mega22 Block E, dieselbe Regel).
  const [restartOffer, setRestartOffer] = useState<string | null>(null);
  // JOB 530: Aufklappzustand der weiteren Eingabeoptionen. Zwei bewusste Entscheidungen:
  //  · EIGENER Seitenzustand — deshalb setzt ihn kein Tippen, kein KI-Vorschlag und kein geladener
  //    Entwurf zurück. Ein aus dem Render abgeleiteter Wert (etwa „offen, solange leer") hätte genau
  //    das getan und die Fläche unter der Hand wieder zugeklappt.
  //  · Lazy-Initialisierung aus dem Browser, gleiche Bauart wie `firstRun` im Erfassen-Bereich
  //    (Capture.tsx): einmal beim Betreten gelesen, nicht bei jedem Render.
  const [optionsOpen, setOptionsOpen] = useState<boolean>(() =>
    frontDoorOptionsOpen(window.localStorage),
  );

  // Der Wechsel wird sofort gemerkt — die Wahl gilt beim nächsten Besuch weiter. Bewusst NICHT im
  // Zustandsaktualisierer: der darf keine Nebenwirkung haben (React ruft ihn doppelt auf).
  const toggleOptions = (): void => {
    const next = !optionsOpen;
    setOptionsOpen(next);
    rememberFrontDoorOptionsOpen(window.localStorage, next);
  };

  // SCRUM-474 P1: ausführliche ?-Hilfen aus der zentralen Erfassen-Hilfekarte (lib/captureHelp),
  // gleiches Muster wie im Prüfbereich (reviewHelp) und im geführten Erfassen (Capture.tsx).
  const chelp = (id: CaptureHelpId): { title: string; body: string } => {
    const topic = captureHelp(id);
    return { title: t(topic.titleKey), body: t(topic.bodyKey) };
  };

  const authorName = user?.name ?? user?.email ?? "-";
  // SCRUM-487 (i18n): lokalisierter Fallback-Titel — folgt der UI-Sprache und wird als echter
  // KO-Titel gespeichert (nicht nur Anzeige). Wird an alle Payload-Builder durchgereicht.
  const fallbackTitle = t("cfd.fallbackTitle");
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml, fallbackTitle);
  const hasBody = !isEmptyHtml(bodyHtml);
  // AUFTRAG-mega9 Block A (KW-E2E-001): „wird ein BESTEHENDER Entwurf aktualisiert" ist die Kante,
  // an der sich Speicherbarkeit und Leerwert-Semantik entscheiden — dieselbe Unterscheidung, die
  // buildFrontDoorPayload/draftBodyPatch (mega7) für den Transportweg treffen. Hier oben einmal
  // benannt, damit Knopf und Payload nicht auseinanderlaufen können.
  const isDraftUpdate = activeDraftId !== null;
  const hasTitle = title.trim().length > 0;
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;
  // WP-D7 (Befund 3): reicher Body erhalten → Vorschlag-Panel zeigt NUR den Titel (kein Fließtext-Dump).
  const proposalTitleOnly = structureProposalTitleOnly(bodyHtml);
  const assistInput = bodyTextForAssist(bodyHtml);
  const hasAssistInput = assistInput.trim().length > 0;
  const submitComplete = submittedKo !== null;
  const hasPendingProposal = structureProposal !== null || assistProposal !== null;
  const hasDiscardRisk =
    title.trim().length > 0 ||
    hasBody ||
    hasPendingProposal ||
    structureAccepted ||
    assistAccepted ||
    activeDraftId !== null;

  const clearStructureState = useCallback((): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
    setStructureKeptRichBody(false);
    setStructureTitleAdopted(false);
  }, []);

  const clearAssistState = useCallback((): void => {
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(false);
  }, []);

  const changeTitle = (next: string): void => {
    if (submitComplete) {
      return;
    }
    setTitle(next);
    setSubmittedKo(null);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    clearStructureState();
    clearAssistState();
  };

  const changeBodyHtml = (next: string): void => {
    if (submitComplete) {
      return;
    }
    setBodyHtml(next);
    setSubmittedKo(null);
    // AUFTRAG-mega9 Block A: der Nutzer hat auf die Begründung reagiert — die Validierungsmeldung
    // gehört weg, sobald wieder am Inhalt gearbeitet wird (kein stehender roter Rest).
    setSubmitValidation(false);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    clearStructureState();
    clearAssistState();
  };

  const resetForNewEntry = (): void => {
    setTitle("");
    setBodyHtml("");
    // JOB 512: ein neuer, leerer Vorgang erbt die Quellzahl des vorigen Entwurfs NICHT — sonst
    // meldete das leere Formular einen Verlust aus einem Dokument, mit dem es nichts zu tun hat.
    setQuellBildzahl(null);
    // AUFTRAG-mega9 Block B: bewusst geleertes Formular = neuer, sauberer Bezugspunkt.
    savedStateRef.current = { title: "", bodyHtml: "", confidentiality };
    setSubmittedKo(null);
    setActiveDraftId(null);
    setSubmitValidation(false);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    setSearchParams({}, { replace: true });
    clearStructureState();
    clearAssistState();
    setErr(null);
  };

  // AUFTRAG-mega12 Block A: beide `navigate` hier bleiben BEWUSST roh.
  //  · Erster Zweig: `!hasDiscardRisk` — es gibt nichts zu verlieren, der Wächter würde durchlaufen.
  //  · Zweiter Zweig: der Nutzer hat das Verwerfen GERADE ausdrücklich bestätigt und der Zustand ist
  //    eine Zeile darüber geräumt. Ein Wächter würde direkt nach dem Bestätigen ein ZWEITES Mal
  //    fragen — zwei Dialoge hintereinander sind für den Nutzer ein Fehlerbild, nicht mehr Sicherheit.
  const discardInputAndReturn = (): void => {
    if (!hasDiscardRisk) {
      navigate("/erfassen");
      return;
    }
    if (!window.confirm(t("fd.confirmDiscard"))) {
      return;
    }
    resetForNewEntry();
    navigate("/erfassen");
  };

  useEffect(() => {
    if (!resumeDraftId) {
      setActiveDraftId(null);
      setQuellBildzahl(null);
      return;
    }

    let cancelled = false;
    setLoadingDraft(true);
    setErr(null);

    endpoints.drafts
      .get(resumeDraftId)
      .then((draft) => {
        if (cancelled) {
          return;
        }
        const loadedTitle = draft.payload.title ?? "";
        const loadedBody = frontDoorBodyFromDraft(draft.payload);
        // JOB 504 D2: der Rohwert bleibt roh (kann fehlen); die Formularanzeige normalisiert wie
        // bisher auf "intern" — jetzt ueber den geteilten Helfer statt eines eigenen `??`-Vorschalters.
        const declared = draft.payload.confidentiality;
        const loadedConfidentiality = confidentialityOf(declared);
        setActiveDraftId(draft.id);
        setTitle(loadedTitle);
        setBodyHtml(loadedBody);
        // JOB 512 (R5): der Rohwert bleibt roh. Ob er brauchbar ist, entscheidet fail-closed
        // `bildverlust` — eine Altladung mit kaputtem Feld darf keine Meldung erzeugen.
        setQuellBildzahl(draft.payload.sourceImageCount ?? null);
        setConfidentiality(loadedConfidentiality);
        setDeclaredConfidentiality(declared);
        // AUFTRAG-mega9 Block B: der geladene Stand IST der gesicherte Stand — ein gerade geöffneter
        // Entwurf ist nicht „ungespeichert" und löst keine Warnung aus.
        savedStateRef.current = {
          title: loadedTitle,
          bodyHtml: loadedBody,
          confidentiality: loadedConfidentiality,
        };
        setSubmitValidation(false);
        setSubmittedKo(null);
        saveRequestedRef.current = false;
        submitRequestedRef.current = false;
        clearStructureState();
        clearAssistState();
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return;
        }
        setActiveDraftId(null);
        setErr(errorMessage(e, t("fd.errSaveFailed")));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resumeDraftId, clearStructureState, clearAssistState, t]);

  // WP-UX-WOW-1 U8 (Kopfs Freeze-Befund, gehärteter Verwerfen-Pfad): der Scroll läuft NUR beim
  // ERSCHEINEN eines Vorschlags (Übergang kein-Panel → Panel), nie bei Folge-Renders oder beim
  // Verwerfen — und scrollIntoView wird wie im R7-Muster per ?.() aufgerufen: der alte, ungeschützte
  // Aufruf warf in Umgebungen ohne die API eine UNBEHANDELTE asynchrone Exception aus dem
  // setTimeout (nachgewiesen im Mounted-Test), an jedem ErrorBoundary vorbei.
  const proposalVisibleRef = useRef(false);
  useEffect(() => {
    const visible = structureProposal !== null || assistProposal !== null;
    if (!visible) {
      proposalVisibleRef.current = false;
      return;
    }
    if (proposalVisibleRef.current) {
      return;
    }
    proposalVisibleRef.current = true;
    const timeout = window.setTimeout(() => {
      proposalRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [structureProposal, assistProposal]);

  const structure = useMutation({
    mutationFn: () =>
      endpoints.reasoner.structure(structureInput, locale, draftProvenance(confidentiality)),
    onMutate: () => {
      setErr(null);
      setStructureErr(null);
      setStructureProposal(null);
      setStructureAccepted(false);
      setAssistProposal(null);
      setAssistErr(null);
      setAssistAccepted(false);
    },
    onSuccess: (proposal) => {
      setStructureProposal(proposal);
      setStructureErr(null);
    },
    onError: () => {
      setStructureErr(t(FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY));
    },
  });

  const assist = useMutation({
    mutationFn: (action: AssistAction) =>
      endpoints.reasoner.assist(
        assistInput,
        locale,
        t(assistActionInstructionKey(action)),
        draftProvenance(confidentiality),
      ),
    onMutate: () => {
      setErr(null);
      setAssistErr(null);
      setAssistProposal(null);
      setAssistAccepted(false);
      setStructureProposal(null);
      setStructureErr(null);
      setStructureAccepted(false);
    },
    onSuccess: (proposal, action) => {
      setAssistProposal({ ...proposal, action });
      setAssistErr(null);
    },
    onError: () => {
      setAssistErr(t("fd.errAssist"));
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (activeDraftId) {
        return withFrontDoorSaveTimeout(
          endpoints.drafts.update(
            activeDraftId,
            // AUFTRAG-mega7 Block A: Speichern auf einen BESTEHENDEN Entwurf ist ein PUT über den
            // Bestand — die Entwurfs-Id mitgeben, damit ein bewusst geleerter Body als Löschmarker
            // reist statt vom partiellen Merge durch den Altwert ersetzt zu werden.
            buildFrontDoorPayload({
              title,
              bodyHtml,
              fallbackTitle,
              confidentiality,
              activeDraftId,
            }),
          ),
        );
      }
      return createFrontDoorDraft({ title, bodyHtml, fallbackTitle, confidentiality }, (payload) =>
        endpoints.drafts.create(payload),
      );
    },
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
    },
    onSuccess: (draft) => {
      const savedTitle = draft.payload.title ?? derivedTitle;
      setActiveDraftId(draft.id);
      setErr(null);
      // AUFTRAG-mega9 Block B: der eben gespeicherte Stand ist der neue Bezugspunkt — die Seite ist
      // ab hier sauber und der Wächter fragt beim Wechsel nicht mehr nach.
      savedStateRef.current = { title, bodyHtml, confidentiality };
      setSubmitValidation(false);
      push("success", t("fd.toastSaved"));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      // AUFTRAG-mega9 Block B: Läuft das Speichern AUS DEM Wächter-Dialog („Entwurf speichern und
      // wechseln"), navigiert der Wächter anschließend selbst an das vom Nutzer gewählte Ziel. Ohne
      // diese Unterdrückung liefen zwei Navigationen gegeneinander und /erfassen hätte das
      // eigentliche Ziel überschrieben.
      if (guardSaveRef.current) {
        guardSaveRef.current = false;
        return;
      }
      // AUFTRAG-mega12 Block A: bleibt BEWUSST roh. Das läuft im `onSuccess` eines ERFOLGREICHEN
      // Speicherns — der Entwurf ist persistiert, es kann nichts verloren gehen. Ein Wächter hier wäre
      // zudem gefährlich: er könnte den Nutzer nach dem Speichern auf der Vordertür festhalten.
      navigate("/erfassen", {
        replace: true,
        state: {
          frontDoorDraftSaved: {
            id: draft.id,
            title: savedTitle,
          },
        },
      });
    },
    onError: (e) => {
      saveRequestedRef.current = false;
      setErr(errorMessage(e, t("fd.errSaveFailed")));
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      // AUFTRAG-mega23 Block A: EIN Vorgang, EIN Schlüssel — über alle Wiederholungen hinweg, bis er
      // eindeutig erledigt ist. Er entsteht HIER, vor dem ersten Aufruf, und nicht in
      // `submitFrontDoorDraft`: entstünde er dort, bekäme jeder Klick einen neuen, der Server sähe
      // zwei Vorgänge statt einer Wiederholung, und die Dublette entstünde trotzdem.
      if (!submitOperationRef.current) {
        submitOperationRef.current = newCreateOperationId();
      }
      return submitFrontDoorDraft(
        { title, bodyHtml, activeDraftId, fallbackTitle, confidentiality },
        {
          createDraft: (payload) => endpoints.drafts.create(payload),
          // Kein vorgeschaltetes `endpoints.drafts.update` mehr: der Stand reist IM Promote, also
          // HINTER dem serverseitigen Nachschlag. Ein Wiederholversuch fasst damit keinen Entwurf
          // an, den der eigene erste Lauf gerade gelöscht hat (sonst 404 auf einen GELUNGENEN
          // Vorgang — derselbe Mangel wie mega21 Block B / mega22 Block H).
          promoteDraft: (id, vorgang) => endpoints.drafts.promote(id, vorgang),
        },
        { id: submitOperationRef.current, draftRef: submitDraftRef },
      );
    },
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
    },
    onSuccess: (ko) => {
      // Der Vorgang ist abgeschlossen — das nächste Einreichen ist ein anderes.
      submitOperationRef.current = null;
      submitDraftRef.current = null;
      setRestartOffer(null);
      setSubmittedKo({ id: ko.id, title: ko.title });
      setTitle("");
      setBodyHtml("");
      setActiveDraftId(null);
      // AUFTRAG-mega9 Block B: eingereicht = nichts Ungesichertes mehr. Bezugspunkt auf den
      // geleerten Zustand, damit die Erfolgsansicht ohne Warnung verlassen werden kann.
      savedStateRef.current = { title: "", bodyHtml: "", confidentiality };
      setSubmitValidation(false);
      setSearchParams({}, { replace: true });
      clearStructureState();
      clearAssistState();
      setErr(null);
      push("success", t("fd.toastSubmitted"));
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => {
      submitRequestedRef.current = false;
      // AUFTRAG-mega23 Block A: den Schlüssel NUR fallen lassen, wenn der Server EINDEUTIG
      // geantwortet hat, dass nichts entstanden ist. Bei Netzabbruch, Zeitüberschreitung oder 5xx
      // bleibt er stehen — genau dann ist der nächste Klick eine WIEDERHOLUNG und keine zweite
      // Anlage. Dieselben Regeln wie im Erfassen-Weg, dieselbe Quelle (lib/createOperation.ts).
      // Mit dem Schlüssel fällt auch der gemerkte Entwurf: er gehörte zu genau diesem Vorgang.
      if (createOperationIsSettled(e instanceof ApiError ? e.status : undefined)) {
        submitOperationRef.current = null;
        submitDraftRef.current = null;
      }
      // AUFTRAG-mega23 Block A: der Rückweg aus dem 409 — dieselbe Unterscheidung nach Fehlercode
      // wie in mega22 Block E. Ändert der Nutzer seinen Text NACH einem Antwortverlust, ist sein
      // neuer Inhalt ein NEUER Vorgang; ohne dieses Angebot wiederholte jeder weitere Klick
      // denselben 409. `CREATE_REPAIR_REQUIRED` ist ausdrücklich NICHT dabei (fail-closed) —
      // dort wartet ein Objekt auf Prüfung, das ein neuer Vorgang zurückliesse.
      setRestartOffer(
        e instanceof ApiError && createConflictOffersRestart(e.status, e.code) ? e.message : null,
      );
      setErr(errorMessage(e, t("fd.errSaveFailed")));
    },
  });

  // AUFTRAG-mega9 Block A (KW-E2E-001): laufende Vorgänge — der Anteil der Knopfsperre, der NICHTS
  // mit Inhalt zu tun hat und deshalb für Speichern und Einreichen gleich gilt.
  const busy = save.isPending || submit.isPending || loadingDraft || submittedKo !== null;
  // AUFTRAG-mega9 Block A (KW-E2E-001): Der Speichern-Knopf hing an `hasBody` und sperrte damit
  // ausgerechnet die bewusste Löschung, für die mega7 den Transportweg gebaut hat: draftBodyPatch
  // erzeugt für einen geleerten Body eines FORTGESETZTEN Entwurfs den ausdrücklichen Leerwert —
  // erreicht wurde er nie, weil der Knopf vorher sperrte. Der Fix war da, nur unerreichbar.
  //
  // Bei einem fortgesetzten Entwurf IST der geleerte Body die Änderung → immer speicherbar.
  // Beim ANLEGEN bleibt die Sperre richtig, mit derselben Regel wie im geführten Erfassen
  // (Capture.tsx: Rohtext ODER Aussage ODER Titel): Titel ohne Body ist speicherbar, ein
  // vollständig leeres Formular nicht.
  const hasSavableContent = isDraftUpdate || hasBody || hasTitle;
  const canSave = hasSavableContent && !busy;
  // AUFTRAG-mega9 Block A (KW-E2E-001, zweiter Teil): Einreichen ohne Inhalt ist nicht falsch, sondern
  // war STUMM — ein grauer Knopf ohne Begründung. Die Inhaltsbedingung wird deshalb zu einem
  // BENANNTEN Grund, den die Oberfläche am Feld zeigt (dasselbe Muster wie unsavableDirtyReasons im
  // Erfassen-Weg). Der Knopf bleibt erreichbar und löst die Validierung aus; gesperrt ist er nur,
  // solange ein Vorgang läuft.
  const submitBlockReasons = hasBody ? [] : [t("fd.validate.needBody")];
  // AUFTRAG-mega9 Block A: Die KI-Knöpfe bleiben BEWUSST an ihrer Inhaltsbedingung (hasStructureInput /
  // hasAssistInput) — ein Struktur- oder Hilfe-Vorschlag über einen leeren Text hat keinen Gegenstand,
  // hier ist die Sperre die Wahrheit und nicht eine verdeckte Blockade. Sie ist zudem am Feld erklärt
  // (fd.needContentFirst). Nur die doppelte Vorgangs-Bedingung wandert in das gemeinsame `busy`.
  const canStructure = hasStructureInput && !structure.isPending && !busy;
  const canAssist = hasAssistInput && !assist.isPending && !busy;

  const acceptStructureProposal = (): void => {
    if (!structureProposal) {
      return;
    }
    // WP-D6/WP-D6b (Pedi-LIVE-BEFUND + bens GELB-Fix 3): „Original ist heilig" gilt auch für den
    // KI-Struktur-Vorschlag. Die gesamte Übernahme-Entscheidung liegt in der PUREN, getesteten
    // applyStructureProposal — der Handler macht nur noch setState aus dem Ergebnis (keine Logik-Kopie).
    // Reicher Body (Bilder/Struktur/Formatierung) bleibt byte-identisch erhalten; der Titel wird nur
    // gesetzt, wenn er vorher leer war; die Kernaussage wird nie in den Body übernommen.
    const result = applyStructureProposal({
      currentTitle: title,
      currentBodyHtml: bodyHtml,
      proposal: structureProposal,
    });
    setTitle(result.title);
    setBodyHtml(result.bodyHtml);
    setStructureKeptRichBody(result.preserved);
    setStructureTitleAdopted(result.titleAdopted);
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(true);
  };

  const discardStructureProposal = (): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
  };

  const acceptAssistProposal = (): void => {
    if (!assistProposal) {
      return;
    }
    if (assistProposal.action === "spelling") {
      const result = applySpellingAssistPreservingHtml(bodyHtml, assistProposal.text);
      if (!result.applied) {
        setAssistErr(t("fd.errSpelling"));
        setAssistAccepted(false);
        return;
      }
      setBodyHtml(result.html);
    } else {
      setBodyHtml(applyBodyAssist("replace", bodyHtml, assistProposal.text));
    }
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(true);
    clearStructureState();
  };

  const discardAssistProposal = (): void => {
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(false);
  };

  // AUFTRAG-mega9 Block B (KW-E2E-002): das ehrliche Dirty-Prädikat der Vordertür — Abweichung des
  // TATSÄCHLICHEN Formularinhalts (Titel, Body, Vertraulichkeit) vom gesicherten Stand, plus ein
  // offener KI-Vorschlag. Bewusst NICHT hasDiscardRisk: das enthält `activeDraftId !== null` und
  // hielte damit jeden nur GEÖFFNETEN Entwurf für ungespeichert (Warnung ohne Verlust).
  //
  // Wechselwirkung mit Block A, ausdrücklich geprüft: ein geleerter Body weicht vom gesicherten
  // (nicht leeren) Stand ab ⇒ dirty. Genau die Löschung, die Block A speicherbar macht, ist damit
  // auch die Löschung, die der Wächter schützt — sonst hätten wir sie speicherbar gemacht und
  // gleichzeitig weiter still verlieren lassen.
  const isFrontDoorDirty =
    title !== savedStateRef.current.title ||
    bodyHtml !== savedStateRef.current.bodyHtml ||
    confidentiality !== savedStateRef.current.confidentiality ||
    hasPendingProposal;
  // AUFTRAG-mega9 Block B: die EHRLICHE GRENZE des Speicher-Vertrags, gleiche Bauart wie
  // unsavableDirtyReasons im Erfassen-Weg (mega5). Für jeden Dirty-Zustand gilt genau eines von
  // beidem: der Entwurf sichert ihn vollständig, ODER er steht hier namentlich.
  const frontDoorUnsavableReasons = useMemo<string[]>(
    () => [
      // Ein angezeigter, noch nicht übernommener KI-Vorschlag reist in keinem Entwurf mit.
      ...(hasPendingProposal ? [t("fd.unsavable.proposal")] : []),
      // Nur die Vertraulichkeit umgestellt, ohne Titel/Body und ohne bestehenden Entwurf: es gibt
      // nichts, woran der Entwurf diese Wahl festmachen könnte (Block A sperrt hier bewusst).
      ...(!hasSavableContent && confidentiality !== savedStateRef.current.confidentiality
        ? [t("fd.unsavable.confidentialityOnly")]
        : []),
    ],
    [hasPendingProposal, hasSavableContent, confidentiality, t],
  );

  const requestSave = (): void => {
    if (!canSave || saveRequestedRef.current) {
      return;
    }
    saveRequestedRef.current = true;
    save.mutate();
  };

  const requestSubmit = (): void => {
    if (busy || submitRequestedRef.current) {
      return;
    }
    // AUFTRAG-mega9 Block A (KW-E2E-001): fehlt Inhalt, wird der Versuch nicht still verschluckt —
    // die benannte Begründung erscheint am Inhaltsfeld und der Fokus geht dorthin.
    if (submitBlockReasons.length > 0) {
      setSubmitValidation(true);
      validationRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    submitRequestedRef.current = true;
    submit.mutate();
  };

  // AUFTRAG-mega11 Block B-1 (bens SB-2): Der In-App-Wächter unten fängt nur den clientseitigen
  // Seitenwechsel. Neuladen und Tab-Schließen gehen an ihm vorbei — `/erfassen` hatte dafür seit je
  // einen beforeunload-Handler, die Vordertür nicht. Dieselbe Vorrichtung (useUnloadGuard, EINE
  // Mechanik für beide Seiten), gebunden an dasselbe Dirty-Prädikat wie der Wächter: was hier warnt,
  // warnt auch dort — kein zweiter Begriff von „ungespeichert".
  useUnloadGuard(isFrontDoorDirty);

  // AUFTRAG-mega9 Block B (KW-E2E-002): Der Prüfer hat den Wächter auf /erfassen ausdrücklich als
  // vorbildlich bestätigt — die Vordertür war schlicht nie angemeldet. Ein Wechsel über „Alle
  // Erfassungs-Modi", Sidebar oder Command-Palette ging deshalb ohne jede Warnung und nahm die
  // Änderung mit. Hier meldet sich dieselbe Vorrichtung an, mit den Feldern DIESER Seite.
  useEffect(() => {
    setGuard({
      isDirty: () => isFrontDoorDirty,
      unsavableDirtyReasons: () => frontDoorUnsavableReasons,
      save: async () => {
        // Nichts Sicherbares (leeres Formular, nur Vertraulichkeit gewählt): dann gibt es hier auch
        // nichts zu speichern — der Dialog bietet in diesem Fall über die Gründe oben ohnehin kein
        // „Speichern und wechseln" an.
        if (!hasSavableContent) {
          return;
        }
        guardSaveRef.current = true;
        try {
          await save.mutateAsync();
        } catch (e) {
          // Fehlgeschlagen: Dialog bleibt offen (der Wächter wechselt nicht), die Seite zeigt den
          // Fehler aus save.onError. Die Unterdrückung zurücknehmen, sonst verschluckte ein späterer
          // Knopf-Save seine Navigation.
          guardSaveRef.current = false;
          throw e;
        }
      },
    });
    return () => setGuard(null);
  }, [setGuard, isFrontDoorDirty, frontDoorUnsavableReasons, hasSavableContent, save]);

  if (submittedKo) {
    // AUFTRAG-mega12 Block A: die drei Links dieser Erfolgsansicht bleiben BEWUSST rohe <Link>.
    // Begründung nachgerechnet, nicht angenommen: `submit.onSuccess` leert Titel und Body und setzt
    // `savedStateRef.current` auf genau diesen geleerten Stand (siehe dort, mega9). Damit ist
    // `isFrontDoorDirty` in diesem Zweig beweisbar false und der Wächter würde nie auslösen. Ein
    // GuardedLink wäre hier eine Vorrichtung ohne Wirkung — und würde vortäuschen, dass es an dieser
    // Stelle etwas zu verlieren gäbe.
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          kicker={t("fd.kicker")}
          title={t("fd.title")}
          actions={
            <Link className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
              {t("fd.backToCapture")}
            </Link>
          }
        />
        <Card className="space-y-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex items-center gap-1.5 font-semibold text-trust-pos-text">
            <CheckCircle2 size={16} />
            {t("fd.submitted")} <strong>{submittedKo.title}</strong>
            {/* SCRUM-474 P1: was „eingereicht/Validierung" heißt und was jetzt (nicht automatisch) passiert. */}
            <HelpTip {...chelp("savedNext")} />
          </div>
          <p className="text-sm leading-relaxed text-trust-pos-text/90">{t("fd.submittedBody")}</p>
          {/* AUFTRAG-196 (U1 A2, Pedi JA): `fd.submittedBody` spricht über den EDITOR („abgeschlossen
              und geleert"). Was mit dem WISSENSOBJEKT geschieht, stand bisher nur auf der zweiten
              Erfassungsfläche (`Capture.tsx:3430`). Derselbe dreisprachige Satz wird hier ZUSÄTZLICH
              gerendert — kein neuer Schlüssel, kein neuer Zustand, keine zweite Wahrheit. Ersetzen
              wäre falsch: `capture-front-door.test.ts:376-377` pinnt `fd.submittedBody` zweimal im
              Quelltext. */}
          <p className="text-sm leading-relaxed text-trust-pos-text/90">{t("capture.savedBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
              to="/validierung"
            >
              {t("fd.openValidation")}
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-btn border border-hairline bg-page px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
              to={`/wissen/${submittedKo.id}`}
            >
              {t("fd.viewObject")}
            </Link>
            <Button type="button" variant="ghost" onClick={resetForNewEntry}>
              {t("fd.newEntry")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* SCRUM-488: Migrationssprache raus — der Link sagt, was ihn erwartet (nicht die interne Historie). */}
      <PageHeader
        kicker={t("fd.kicker")}
        title={t("fd.title")}
        actions={
          // AUFTRAG-mega9 Block B (KW-E2E-002): GENAU der Weg aus dem Prüferbefund — der Wächter greift
          // nur, wenn die Navigationsquelle guard() aufruft; ein blanker <Link> tut das nicht.
          // AUFTRAG-mega12 Block A: UMGESTELLT auf `GuardedLink`. Die Wirkung ist unverändert (auch die
          // Modifikator-Ausnahme steckt dort), aber die von Hand abgeschriebene Klick-Behandlung
          // entfällt — genau die Doppelung, die mega11 mit den gemeinsamen Bauteilen beenden wollte.
          <GuardedLink className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
            {t("fd.allModes")}
          </GuardedLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              // SCRUM-474 P0: Der Primär-Pfad (Enter/Form-Submit + prominenter Button) REICHT EIN
              // (promote → KO), nicht nur Entwurf speichern.
              // AUFTRAG-mega9 Block A: ohne Vorbedingung aufrufen — requestSubmit entscheidet selbst
              // zwischen Einreichen und sichtbarer Feldvalidierung. Ein stiller Abbruch wie vorher
              // (`if (canSubmit)`) ließ den Nutzer ohne jede Rückmeldung zurück.
              requestSubmit();
            }}
          >
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="block text-[12.5px] font-medium text-muted">
                  {t("fd.titleOptional")}
                </span>
                <HelpTip {...chelp("captureTitle")} />
              </div>
              <TextInput
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
                placeholder={fallbackTitle}
              />
            </div>

            {/* SCRUM-502 Schicht 2 (Round 3): Vertraulichkeit im Front-Door. Vertrauliche Inhalte
                nutzen nie die Cloud-KI (nur lokal/deterministisch) und fließen in den Entwurf. */}
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="block text-[12.5px] font-medium text-muted">
                  {t("conf.field")}
                </span>
                <HelpTip title={t("conf.field")} body={t("conf.help")} />
              </div>
              <select
                value={confidentiality}
                onChange={(event) => {
                  const gewaehlt = event.target.value as Confidentiality;
                  setConfidentiality(gewaehlt);
                  // Eine bewusste Auswahl IST eine Deklaration — ab hier gilt sie auch fuer den Egress.
                  setDeclaredConfidentiality(gewaehlt);
                }}
                aria-label={t("conf.field")}
                className="h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] text-text"
              >
                {CONFIDENTIALITY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`conf.level.${lvl}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <SectionLabel>{t("fd.content")}</SectionLabel>
                <HelpTip {...chelp("tellRaw")} />
              </div>
              {loadingDraft ? (
                <div className="rounded-card border border-hairline bg-page p-3 text-sm text-muted">
                  {t("fd.draftLoading")}
                </div>
              ) : null}
              {activeDraftId ? (
                <div className="rounded-card border border-ai/30 bg-ai/5 p-3 text-sm text-text">
                  {t("fd.draftOpen")}
                </div>
              ) : null}
              {/* SCRUM-474 P1: aktive Einladung statt leerer weißer Fläche. */}
              <ImageDescribeProvider provenance={draftProvenance(declaredConfidentiality)}>
                <RichTextEditor
                  value={bodyHtml}
                  onChange={changeBodyHtml}
                  placeholder={t("fd.editorPlaceholder")}
                  captionFormRequest={captionRequest ?? undefined}
                  /* AUFTRAG-mega84 Block C: der Titel gehört zum Dokument-Kontext des
                     KI-Bildbeschreibungs-Vorschlags — er fehlte hier. `derivedTitle` und nicht das
                     rohe Feld: die Vordertür leitet den Titel ab, solange der Nutzer keinen tippt,
                     und genau der abgeleitete ist der, unter dem der Beitrag später steht. */
                  documentTitle={derivedTitle}
                />
              </ImageDescribeProvider>
              {/* Teil B (Pedis Befund): Galerie schon im Entwurf — live aus dem Editor-HTML.
                  AUFTRAG-mega69 Block A: aus der Großansicht führt „Bildbeschreibung bearbeiten"
                  in das EINE Formular des Editors (kein zweites Formular, kein zweiter Egress). */}
              <DraftBodyGallery
                bodyHtml={bodyHtml}
                onEditCaption={(imageId) =>
                  setCaptionRequest((prev) => ({ imageId, nonce: (prev?.nonce ?? 0) + 1 }))
                }
                /* JOB 512 (R5): der Vergleichswert für den Bildverlust — aus der Nutzlast des
                   geladenen Entwurfs. Ohne ihn kann die Galerie einen Verlust nicht erkennen. */
                quellBildzahl={quellBildzahl}
              />
              {/* AUFTRAG-mega9 Block A (KW-E2E-001): die sichtbare Feldvalidierung AM Inhaltsfeld.
                  Der Prüfer hat den wunden Punkt benannt: „eine etwaige Einreichsperre braucht eine
                  sichtbare Feldvalidierung statt still deaktivierter Aktionen." Gleiches Listen-Muster
                  wie unsavableDirtyReasons im Erfassen-Weg — kein zweites erfunden. */}
              {submitValidation && submitBlockReasons.length > 0 ? (
                <div
                  ref={validationRef}
                  role="alert"
                  aria-live="polite"
                  data-testid="frontdoor-submit-validation"
                  className="rounded-card border border-trust-crit-fill/40 bg-trust-crit-bg p-3 text-sm text-trust-crit-text"
                >
                  <p className="font-semibold">{t("fd.validate.lead")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                    {submitBlockReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  {/* Ehrlicher Ausweg: was der Nutzer stattdessen tun kann. */}
                  <p className="mt-1.5 text-[12px] leading-relaxed">{t("fd.validate.hint")}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-card border border-dashed border-ai/30 bg-ai/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canStructure}
                  onClick={() => structure.mutate()}
                >
                  {structure.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  {t("fd.structureSuggest")}
                </Button>
                <HelpTip {...chelp("structureNow")} />
                {/* AUFTRAG-mega61 Block E: dieselbe Aufgabe wie in Capture, aber hier fehlte der
                    Hinweis — die Fläche ist eine eigene und muss ihn eigenständig tragen.
                    AUFTRAG-mega62 Block F: und derselbe Grund gilt für den Kostenhinweis. Er deckt
                    beide Auslöser dieses Kastens — „Vorschlag strukturieren" hier oben und
                    „KI-Hilfe anwenden" darunter; sie liegen in derselben umrandeten Fläche. */}
                <AiGeneratedNotice />
                {/* AUFTRAG-mega67 Block G: dieser eine Hinweis deckt BEIDE Auslöser des Kastens
                    (s. oben) — deshalb beide Aufgaben. Kostet einer von beiden, muss er stehen;
                    nur „structure" zu nennen würde einen teuren „KI-Hilfe anwenden"-Klick
                    unangekündigt lassen. */}
                <AiCostHint billable={strukturKostet} />
                {!hasStructureInput ? (
                  <span className="text-[12.5px] text-muted">{t("fd.needContentFirst")}</span>
                ) : (
                  <span className="text-[12.5px] text-muted">{t("fd.optionalAiHint")}</span>
                )}
              </div>
              <div className="mt-3 border-t border-ai/10 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className="text-[12px] font-semibold uppercase text-muted-2"
                    htmlFor="frontdoor-ai-assist"
                  >
                    {t("fd.aiHelp")}
                  </label>
                  <select
                    id="frontdoor-ai-assist"
                    value={assistAction}
                    onChange={(event) => setAssistAction(event.target.value as AssistAction)}
                    className="h-9 rounded-card border border-hairline bg-surface px-2 text-sm text-ink shadow-sm focus:border-ai focus:outline-none focus:ring-2 focus:ring-ai/20"
                    disabled={assist.isPending || loadingDraft || save.isPending}
                  >
                    {ASSIST_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {t(assistActionLabelKey(action))}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canAssist}
                    onClick={() => assist.mutate(assistAction)}
                  >
                    {assist.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    {t("fd.aiHelpApply")}
                  </Button>
                  <span className="text-[12.5px] text-muted">{t("fd.aiHelpModes")}</span>
                </div>
              </div>
              {structure.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">{t("fd.structureGenerating")}</p>
              ) : null}
              {assist.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">{t("fd.assistGenerating")}</p>
              ) : null}
              {structureErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {structureErr} {t("fd.originalUnchanged")}
                </div>
              ) : null}
              {assistErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {assistErr} {t("fd.originalUnchanged")}
                </div>
              ) : null}
              {structureAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  {/* WP-D6b: zustandsabhängige, ehrliche Meldung. Bei erhaltenem reichem Body zwei Varianten:
                      (a) Titel war leer und wurde übernommen; (b) Titel war schon da → nur Inhalt bleibt.
                      Keine Kernaussage-Behauptung. Sonst (flacher Body strukturiert) die Standard-Meldung. */}
                  {structureKeptRichBody
                    ? structureTitleAdopted
                      ? t("fd.structureKeptRichBodyTitle")
                      : t("fd.structureKeptRichBodyNoTitle")
                    : t("fd.structureAccepted")}
                </div>
              ) : null}
              {assistAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  {t("fd.assistAccepted")}
                </div>
              ) : null}
            </div>

            {structureProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>{t("fd.aiProposal")}</SectionLabel>
                    <p className="text-sm font-semibold text-ink">{t("fd.aiProposalCheck")}</p>
                  </div>
                  {structureProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      {t("fd.fallback")}
                    </span>
                  ) : null}
                </div>
                {/* WP-D8 (Pedis Live-ROT B): das FALLBACK-Badge allein erklärte nichts. Hier steht ehrlich,
                    WARUM der Vorschlag eine einfache Ableitung ist (kein Modell aktiv vs. Modell-Fehler). */}
                {structureProposal.demo ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-trust-warn-text">
                    {/* WP-D10 (Fix 3): Zeitüberschreitung als eigene, ehrliche Ursache.
                        WP-SHIP9-S2 (bens Folgeschnitt B4): vertraulichkeitsbedingter Cloud-Ausschluss
                        als eigener, wahrer Grund — vorher als „no-model" dargestellt. */}
                    {structureProposal.fallbackReason === "model-timeout"
                      ? t("fd.fallbackModelTimeout")
                      : structureProposal.fallbackReason === "model-error"
                        ? t("fd.fallbackModelError")
                        : structureProposal.fallbackReason === "confidential"
                          ? t("fd.fallbackConfidential")
                          : t("fd.fallbackNoModel")}
                  </p>
                ) : null}
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">
                      {t("fd.fieldTitle")}
                    </div>
                    <p className="mt-0.5 text-text">{structureProposal.title}</p>
                  </div>
                  {/* WP-D7 (Befund 3): reicher Body erhalten → NUR Titel + ehrliche Kurz-Erklärung, KEIN
                      Aussage-/Bedingungen-/Maßnahmen-Dump (der wäre nur der ganze Dokument-Fließtext). */}
                  {proposalTitleOnly ? (
                    <p className="text-[12.5px] leading-relaxed text-muted">
                      {t("fd.structureRichTitleOnly")}
                    </p>
                  ) : (
                    <>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldStatement")}
                        </div>
                        <p className="mt-0.5 text-text">{structureProposal.statement}</p>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldConditions")}
                        </div>
                        {structureProposal.conditions.length > 0 ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                            {structureProposal.conditions.map((condition) => (
                              <li key={condition}>{condition}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-muted">{t("fd.noConditions")}</p>
                        )}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldMeasures")}
                        </div>
                        {structureProposal.measures.length > 0 ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                            {structureProposal.measures.map((measure) => (
                              <li key={measure}>{measure}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-muted">{t("fd.noMeasures")}</p>
                        )}
                      </div>
                      {structureProposal.tags.length > 0 ? (
                        <div>
                          <div className="text-[12px] font-semibold uppercase text-muted-2">
                            {t("fd.fieldTags")}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {structureProposal.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-pill bg-hairline-soft px-2 py-0.5 text-[11px] text-muted"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptStructureProposal}>
                    {t("fd.accept")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardStructureProposal}>
                    {t("fd.discardProposal")}
                  </Button>
                </div>
              </div>
            ) : null}

            {assistProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>{t("fd.aiHelpProposal")}</SectionLabel>
                    <p className="text-sm font-semibold text-ink">
                      {t("fd.assistProposalCheck", {
                        action: t(assistActionLabelKey(assistProposal.action)),
                      })}
                    </p>
                  </div>
                  {assistProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      {t("fd.fallback")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-card border border-hairline bg-page p-3 text-sm leading-relaxed text-text">
                  {assistProposal.text}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptAssistProposal}>
                    {t("fd.accept")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardAssistProposal}>
                    {t("fd.discardProposal")}
                  </Button>
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {/* ====================================================================================
                AUFTRAG-mega23 Block A — DER RÜCKWEG AUS DEM ABDRUCKKONFLIKT.
                ====================================================================================
                Ohne ihn wäre der neue Schlüssel eine Sackgasse: geht die Antwort verloren und
                ÄNDERT der Nutzer danach seinen Text, antwortet der Server zu Recht
                IDEMPOTENCY_PAYLOAD_MISMATCH — und jeder weitere Klick wiederholte denselben 409.
                Derselbe Knopf, dieselbe Entscheidungsregel und dieselben Texte wie im
                Erfassen-Weg (mega22 Block E); die Meldung des Servers steht wörtlich dabei, weil
                sie genauer ist als jeder Text, den diese Seite raten könnte. */}
            {restartOffer ? (
              <div className="rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3">
                <p className="text-[13px] font-semibold text-trust-warn-text">
                  {t("capture.restartOfferTitle")}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-trust-warn-text/90">
                  {restartOffer}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-trust-warn-text">
                  {t("capture.restartOfferBody")}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      // DIE HANDLUNG, DIE WIRKT: der nächste Einreich-Versuch trägt einen ANDEREN
                      // Vorgangsschlüssel — und einen frisch angelegten Entwurf, weil der gemerkte
                      // zum alten Vorgang gehörte.
                      //
                      // AUCH DER FORTGESETZTE ENTWURF WIRD GELÖST, und das ist kein Beifang: einen
                      // Abdruckkonflikt kann es nur geben, wenn der erste Vorgang serverseitig
                      // GELUNGEN ist — dann ist genau dieser Entwurf bereits verbraucht und
                      // gelöscht. Bliebe er stehen, liefe der neue Vorgang in ein 404 auf einen
                      // Entwurf, den es nicht mehr gibt, statt in die gewollte zweite Anlage.
                      submitOperationRef.current = null;
                      submitDraftRef.current = null;
                      setActiveDraftId(null);
                      setSearchParams({}, { replace: true });
                      setRestartOffer(null);
                      setErr(null);
                    }}
                  >
                    {t("capture.restartOfferAction")}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* SCRUM-474 P0: „Prüfen / Einreichen" ist der prominente Haupt-CTA (type=submit). */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                {/* AUFTRAG-mega9 Block A (KW-E2E-001): NICHT `!canSubmit` — der Knopf bleibt bei
                    fehlendem Inhalt erreichbar und löst die sichtbare Feldvalidierung aus. Gesperrt
                    ist er nur, solange ein Vorgang läuft (`busy`). Kein grauer Knopf ohne Begründung. */}
                <Button type="submit" variant="primary" disabled={busy}>
                  {submit.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {t("fd.submitReview")}
                </Button>
                <HelpTip {...chelp("submitReview")} />
              </span>
              <span className="inline-flex items-center gap-1">
                <Button type="button" variant="outline" disabled={!canSave} onClick={requestSave}>
                  {save.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {t("fd.saveDraft")}
                </Button>
                <HelpTip {...chelp("saveDraftHelp")} />
              </span>
              <Button type="button" variant="ghost" onClick={discardInputAndReturn}>
                <ArrowLeft size={15} />
                {hasDiscardRisk ? t("fd.discardInput") : t("fd.back")}
              </Button>
              {!hasBody ? (
                <span className="text-[12.5px] text-muted">{t("fd.writeToSubmit")}</span>
              ) : null}
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3">
            {/* SCRUM-488: Status-Karte mit ?-Hilfe — erklärt Entwurf vs. Einreichen (was passiert, was NICHT). */}
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("fd.statusLabel")}</SectionLabel>
              <HelpTip {...chelp("savedNext")} />
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.titleOnSave")}</div>
              <div className="mt-1 text-sm font-semibold text-ink">{derivedTitle}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.author")}</div>
              <div className="mt-1 text-sm text-text">{authorName}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.whatOnSave")}</div>
              {/* SCRUM-488: Klartext statt kryptisch „Entwurf / fortsetzen". */}
              <div className="mt-1 text-sm text-text">{t("fd.whatOnSaveBody")}</div>
            </div>
          </Card>
          <Card className="space-y-2">
            {/* SCRUM-488: keine interne Migrationssprache — was der vollständige Bereich dem Nutzer bietet. */}
            <SectionLabel>{t("fd.moreWays")}</SectionLabel>
            <p className="text-sm leading-relaxed text-muted">{t("fd.moreWaysBody")}</p>
            {/* ============================================================================
                JOB 530 — DIE WEITEREN EINGABEOPTIONEN SIND JETZT WEGE, NICHT NUR EIN SATZ.
                ============================================================================
                Der Absatz darüber sagte, dass es „alle Wege" gibt, und zeigte keinen einzigen.
                Hier stehen sie einzeln — hinter GENAU dem Aufklappmuster, das der Erfassen-Bereich
                für „Weitere Wege" schon benutzt (Knopf mit aria-expanded/aria-controls, zugeklappter
                Start). Zugeklappt bleibt der Erfassungsstart ruhig; aufgeklappt fällt die Wahl
                sichtbar, bevor der Nutzer die Seite verlässt.

                GuardedLink, nicht <Link>: das Verlassen der Vordertür MIT ungespeichertem Inhalt ist
                genau der Verlustpfad aus KW-E2E-002. Diese fünf Ausgänge melden sich an derselben
                Vorrichtung an wie „Alle Erfassungs-Modi" oben — kein sechster Ausgang am Wächter
                vorbei. Ziel ist `/erfassen`; der Modus wird dort gewählt, denn die Erfassen-Seite
                nimmt (Bestand, unverändert) keinen Modus aus der Adresse entgegen. */}
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between"
              onClick={toggleOptions}
              aria-expanded={optionsOpen}
              aria-controls="frontdoor-more-options"
              data-testid="frontdoor-more-options-toggle"
            >
              {optionsOpen
                ? `${t(FRONT_DOOR_OPTIONS_TEXT.hide)} ▴`
                : `${t(FRONT_DOOR_OPTIONS_TEXT.show)} ▾`}
            </Button>
            {optionsOpen ? (
              <ul id="frontdoor-more-options" className="space-y-1.5 border-t border-hairline pt-2">
                {FRONT_DOOR_OPTION_MODES.map((mode) => (
                  <li key={mode}>
                    <GuardedLink
                      className="block rounded-card border border-hairline px-2.5 py-1.5 hover:border-ink/30 hover:bg-page"
                      to="/erfassen"
                    >
                      <span className="block text-[13px] font-semibold text-ink">
                        {t(frontDoorOptionLabelKey(mode))}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                        {t(frontDoorOptionHintKey(mode))}
                      </span>
                    </GuardedLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
