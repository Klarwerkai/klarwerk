import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { useDrafts, useKos } from "../../api/hooks";
import type {
  AssistResult,
  Confidentiality,
  DraftPayload,
  KnowledgeObject,
  StructureResult,
} from "../../api/types";
import { useSession } from "../../app/AuthContext";
import { ImageDescribeProvider } from "../../app/ImageDescribeContext";
import { useNavGuard, useUnloadGuard } from "../../app/NavGuardContext";
import { useToast } from "../../app/ToastContext";
import {
  applyBodyAssist,
  applySpellingAssistPreservingHtml,
  applyStructureProposal,
  bodyTextForAssist,
  structureProposalTitleOnly,
} from "../../lib/bodyAiAssist";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../../lib/captureAiAssist";
import {
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  submitFrontDoorDraft,
  withFrontDoorSaveTimeout,
} from "../../lib/captureFrontDoor";
import { CONFIDENTIALITY_LEVELS, confidentialityOf } from "../../lib/confidentiality";
import {
  createConflictOffersRestart,
  createOperationIsSettled,
  newCreateOperationId,
} from "../../lib/createOperation";
import { isDemoContext } from "../../lib/demoPilotPath";
import { CLEARED_DRAFT_BODY_HTML } from "../../lib/draftBody";
import { dominantCategory, pickExampleKo } from "../../lib/intakeExample";
import { INTAKE_STARTERS, type IntakeStarter } from "../../lib/intakeStarters";
import { deriveIntakeSuggestion } from "../../lib/intakeSuggestion";
// JOB 3266 (D1): dasselbe Datumsformat wie überall sonst in der Oberfläche — und dieselbe
// Ehrlichkeit: ein fehlender oder unlesbarer Zeitwert wird `null`, nicht ein erfundenes Datum.
import { formatKoTimestamp } from "../../lib/koDates";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { draftProvenance } from "../../lib/reasonerProvenance";
import { isEmptyHtml } from "../../lib/richText";
import { type SpeechRec, diktatSprache, makeRec } from "../../lib/speechDictation";
import { hasSpeechRecognition } from "../../lib/speechSupport";
import type { TitelMitQuelle } from "../../lib/titelRangfolge";
import { useAiBillable } from "../../lib/useAiBillable";
import { AiCostHint } from "../AiCostHint";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { DemoBanner } from "../DemoBanner";
import { DraftBodyGallery } from "../DraftBodyGallery";
import { HelpTip } from "../HelpTip";
import { RichTextEditor } from "../RichTextEditor";
import { RoleLink } from "../RoleLink";
import { LiveReactionZone } from "../capture/intake/LiveReactionZone";
import { useLiveKnowledgeCheck } from "../capture/intake/useLiveKnowledgeCheck";
import { Menue, MenueEintrag, MenueFlaeche, MenueTrenner } from "./Menue";
import {
  SymbolBild,
  SymbolDatei,
  SymbolHilfe,
  SymbolKi,
  SymbolMehr,
  SymbolMikrofon,
} from "./Symbole";
import { BLATT_HILFE_THEMEN } from "./hilfe";
import { BLATT_WEGE, blattWegLabelKey } from "./wege";

// ================================================================================================
// JOB 3062 · H3 — EIN BLATT WIE IN PAGES.
// ================================================================================================
//
// PEDIS URTEIL ZUM ALTEN STAND (04.09. 06:50): „Das Erfassen von Wissen schreckt jeden ab … Text
// über Text über Text." Drei Flächen für einen Zweck (Capture 6297 Zeilen, CaptureFrontDoor 1686,
// KnowledgeIntake 175), ein Standardweg-Kasten, eine Modus-Leiste, Status- und Bereitschaftskarten,
// 42 Hilfe-Tipps — und der Mensch wollte nur einen Satz aufschreiben.
//
// PEDIS VORGABE (04.09. 07:58): „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere
// dich an Pages, arbeite mit Untermenüs. Behalte die klare Linie bei."
//
// DIESE DATEI IST DIE FLÄCHE: eine Werkzeugzeile, ein weißes Blatt mit Titel und Text, unten rechts
// zwei Knöpfe. Alles, was die drei Seiten konnten, liegt in den Untermenüs der Zeile — der Ort je
// Funktion steht im Funktionsinventar des Auftrags (§5a) und wird von
// `tests/design/h3-funktionsinventar.test.ts` an der GEBAUTEN Seite nachgefahren.
//
// SIE ERSETZT, SIE ERGÄNZT NICHT: Die gesamte Logik der Vordertür (Entwurf laden/speichern,
// Einreichen, Vorgangsschlüssel, Standkonflikt, KI-Vorschlag, Navigations- und Entladewächter) ist
// hierher UMGEZOGEN — `CaptureFrontDoor.tsx` hat sie nicht mehr, sondern rendert dieses Blatt. Die
// Kommentare der einzelnen Entscheidungen sind mitgezogen, weil ihre Begründung unverändert gilt.
//
// DER ARBEITSRAUM KOMMT ALS BAUTEIL VON AUSSEN (`arbeitsraum`), nicht per Import: Interview,
// Dateiimport und Expertenformular leben weiter in `pages/Capture.tsx`, und ein Import von dort
// würde einen Ring bauen (Capture → Blatt → Capture). Die drei Seiten reichen das Bauteil herein.

export type ArbeitsraumModus = "interview" | "datei" | "formular";

export type ArbeitsraumFabrik = (args: {
  modus: ArbeitsraumModus;
  /** Der Arbeitsraum hat einen Entwurf gesichert — das Blatt übernimmt ihn und kommt zurück. */
  onEntwurfInsBlatt: (entwurfId: string) => void;
}) => ReactNode;

type Ansicht = "blatt" | ArbeitsraumModus;

/**
 * Die zuletzt versuchte Handlung (Auftrag §9) — das, was „Erneut versuchen" wiederholt.
 *
 * Die KI-Hilfe führt ihre Handlung MIT: ohne sie wäre „wiederhole die letzte KI-Hilfe" eine
 * Handlung, die der Mensch nicht bestellt hat. Struktur und Assistent sind getrennte Fälle, weil
 * sie getrennte Wege sind (`task: "structure"` bzw. `task: "assist"`).
 */
type LetzteAktion =
  | { art: "laden" | "speichern" | "einreichen" | "struktur" }
  | { art: "assist"; aktion: AssistAction };

function fehlerMeldung(err: unknown, rueckfall: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return err instanceof Error ? err.message : rueckfall;
}

// JOB 2705 (R2-23 b), unverändert übernommen: Der LADEPFAD meldet einen LADEFEHLER. Eine fachliche
// Servermeldung gewinnt; alles Technische („Failed to fetch") bekommt den ehrlichen Satz.
function ladeFehlerMeldung(err: unknown, rueckfall: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return rueckfall;
}

// Diktiertes reist als Absatz in den Rumpf — derselbe Weg, den jeder getippte Absatz nimmt.
function diktatAnhaengen(bodyHtml: string, text: string): string {
  const satz = text.trim();
  if (!satz) {
    return bodyHtml;
  }
  const abschnitt = `<p>${satz
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
  return isEmptyHtml(bodyHtml) ? abschnitt : `${bodyHtml}${abschnitt}`;
}

/**
 * JOB 3114 (UX-05): Die `id` des Erklärsatzes am Vertraulichkeits-Menü. Sie steht als Konstante,
 * weil sie an ZWEI Stellen dieselbe sein muss — am Satz selbst und im `aria-describedby` des
 * Menüknopfs. Zwei getippte Zeichenketten wären die Bauform, in der ein Verweis ins Leere zeigt.
 */
const BLATT_VERTRAULICHKEIT_HINWEIS_ID = "blatt-vertraulichkeit-hinweis";

/**
 * JOB 3141 (CAP-P1): Die `id` des Satzes, der sagt, warum das Blatt gerade nichts annimmt. Aus
 * demselben Grund eine Konstante wie oben: sie steht am Satz UND im `aria-describedby` des
 * Titelfeldes — der eine Grund gilt für beide Felder, also darf er nicht zweimal getippt werden.
 */
const BLATT_LADEN_HINWEIS_ID = "blatt-laden-hinweis";

/**
 * Die zwei Regeln, mit denen das Blatt den `RichTextEditor` von aussen auf Blatt-Maß bringt.
 * Sie stehen bewusst als benannte Konstante und nicht als Zeichenkette im JSX — was sie tun und
 * warum, steht an ihrer Verwendungsstelle.
 */
const BLATT_EDITOR_CSS = `
.blatt-text div:has(> [data-testid^="caption-form-title-"]) { display: none; }
.blatt-text > div > div:last-child > p { display: none; }
`;

export function Blatt({
  arbeitsraum,
  startText,
}: {
  arbeitsraum: ArbeitsraumFabrik;
  /** `/erfassen/neu?text=…` — ein Deep-Link-Inhalt startet als Text im Blatt (Lieferung 1). */
  startText?: string | undefined;
}): JSX.Element {
  const { i18n, t } = useTranslation();
  const { user } = useSession();
  const strukturKostet = useAiBillable(["structure", "assist"]);
  const { push } = useToast();
  const qc = useQueryClient();
  const { setGuard } = useNavGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeDraftId = searchParams.get("draft");

  // ---- Inhalt des Blattes ----------------------------------------------------------------------
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState(() =>
    startText?.trim() ? diktatAnhaengen("", startText) : "",
  );
  const [kategorie, setKategorie] = useState("");
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("intern");
  // JOB 504 D2 (übernommen): der ROHE Herkunftswert — `undefined` heisst „der fortgesetzte Entwurf
  // trug KEINE Stufe". Er steuert die Modell-Provenienz und wird bewusst NICHT geglättet.
  //
  // JOB 3082 (Q3 a): ER BEGINNT LEER. Bis hierher startete er auf „intern" — das Menü zeigte
  // deshalb auf einem frischen Blatt „Öffentlich-intern" an, obwohl niemand das gewählt hatte.
  // Eine Vorbelegung, die wie eine Entscheidung aussieht, ist eine erfundene Einstufung; dieselbe
  // Grenze zieht die Anzeigeseite schon (`lib/confidentiality.ts:126-134`, „Nicht eingestuft").
  const [declaredConfidentiality, setDeclaredConfidentiality] = useState<
    Confidentiality | undefined
  >(undefined);

  // ---- Fläche ----------------------------------------------------------------------------------
  const [offenesMenue, setOffenesMenue] = useState<string | null>(null);
  // Die zweite Ebene des „…"-Menüs (Pages-Art): welche FLÄCHE darin gerade offen steht.
  const [mehrFlaeche, setMehrFlaeche] = useState<
    "entwuerfe" | "anhaenge" | "status" | "beispiel" | "klara" | null
  >(null);
  const [ansicht, setAnsicht] = useState<Ansicht>("blatt");
  // Der stille Chip unter dem Blatt: zu = eine Zeile, offen = die bestehende Live-Zone (JOB 3045).
  const [liveOffen, setLiveOffen] = useState(false);

  // ---- Entwurf ---------------------------------------------------------------------------------
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // ==============================================================================================
  // JOB 3106 (UX-01) — DER ENTWURF, DEN DER SERVER GERADE QUITTIERT HAT.
  // ==============================================================================================
  // Kennung und Titel stammen aus der ANTWORT, nicht aus dem Blattzustand: die Bestätigungszeile
  // unter den Knöpfen behauptet nur, was der Server bestätigt hat. `null` heisst „es gibt keine
  // quittierte Sicherung, über die zu sprechen wäre" — vor dem ersten Speichern, nach dem
  // Einreichen und nach jedem Blattwechsel.
  const [gesicherterEntwurf, setGesicherterEntwurf] = useState<{
    id: string;
    titel: string;
  } | null>(null);
  const [quellBildzahl, setQuellBildzahl] = useState<number | null>(null);
  // ==============================================================================================
  // JOB 3141 (CAP-P1) — DAS LADEN BEGINNT MIT DEM ERSTEN BILDAUFBAU, NICHT ERST MIT DEM EFFEKT.
  // ==============================================================================================
  // Trägt die Adresse beim Aufbau einen Entwurf, dann WIRD er geholt — der Effekt unten hat auf
  // diesem Weg keinen Zweig, der das unterliesse. Stünde hier `false`, gäbe es genau einen
  // Bildaufbau lang eine aufnahmebereite Schreibfläche, deren Inhalt der Ladevorgang unmittelbar
  // danach ersetzte: das Fenster aus §2 des Auftrags, nur kürzer.
  const [loadingDraft, setLoadingDraft] = useState(() => resumeDraftId !== null);
  const [err, setErr] = useState<string | null>(null);
  const [staleConflict, setStaleConflict] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadedUpdatedAtRef = useRef<string | null>(null);
  // JOB 3106 (UX-01): der Merker des Speicherweges für den Ladeeffekt — `<kennung>#<reloadNonce>`.
  // Seine Begründung steht am Ladeeffekt, wo er gelesen wird.
  const speicherAdresseRef = useRef<string | null>(null);
  const bodyNieGeliefertRef = useRef(false);
  const savedStateRef = useRef<{
    title: string;
    bodyHtml: string;
    confidentiality: Confidentiality;
    // JOB 3062 R6 (bens Befund 1): der BEREICH gehört in den gesicherten Stand. Ohne ihn galt eine
    // geänderte Bereichswahl nicht als ungespeicherte Änderung — der Navigationswächter liess den
    // Menschen ziehen, und die Wahl war weg.
    kategorie: string;
  }>({ title: "", bodyHtml: "", confidentiality: "intern", kategorie: "" });

  // ---- KI --------------------------------------------------------------------------------------
  const [structureProposal, setStructureProposal] = useState<StructureResult | null>(null);
  const [structureErr, setStructureErr] = useState<string | null>(null);
  const [structureAccepted, setStructureAccepted] = useState(false);
  const [structureKeptRichBody, setStructureKeptRichBody] = useState(false);
  const [structureTitleAdopted, setStructureTitleAdopted] = useState(false);
  const [assistProposal, setAssistProposal] = useState<
    (AssistResult & { action: AssistAction }) | null
  >(null);
  const [assistErr, setAssistErr] = useState<string | null>(null);
  const [assistAccepted, setAssistAccepted] = useState(false);

  // ---- Vorgang ---------------------------------------------------------------------------------
  const [submittedKo, setSubmittedKo] = useState<Pick<KnowledgeObject, "id" | "title"> | null>(
    null,
  );
  const [submitValidation, setSubmitValidation] = useState(false);
  const [restartOffer, setRestartOffer] = useState<string | null>(null);
  // JOB 3062 R6 (Auftrag §9): welche Handlung zuletzt versucht wurde — sie und keine andere
  // wiederholt „Erneut versuchen".
  //
  // JOB 3062 R7 (bens Korrekturpflicht 2): SIE KENNT JETZT AUCH DIE KI-WEGE. Bis R6 führte sie nur
  // Laden, Speichern und Einreichen — der erste KI-Fehler einer frischen Sitzung stand deshalb ohne
  // Wiederholweg da (ben hat genau das in Chromium gemessen), und nach einem früheren Speichern
  // hätte der Knopf sogar die FALSCHE Handlung ausgelöst. Die KI-Hilfe trägt ihre Handlung mit:
  // „Erneut versuchen" nach einem misslungenen „Klarer" wiederholt „Klarer" und nicht „Erweitern".
  const [letzteAktion, setLetzteAktion] = useState<LetzteAktion | null>(null);
  const saveRequestedRef = useRef(false);
  const submitRequestedRef = useRef(false);
  const guardSaveRef = useRef(false);
  const submitOperationRef = useRef<string | null>(null);
  const submitDraftRef = useRef<string | null>(null);
  const saveOperationRef = useRef<string | null>(null);

  // ---- Bild und Diktat -------------------------------------------------------------------------
  const [captionRequest, setCaptionRequest] = useState<{
    imageId: string;
    src: string;
    index: number;
    nonce: number;
  } | null>(null);
  const [diktatLaeuft, setDiktatLaeuft] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const diktatMoeglich = hasSpeechRecognition(window);

  // ---- Bestand für Bereich, Entwürfe, Beispiel -------------------------------------------------
  const kos = useKos();
  const drafts = useDrafts();

  const authorName = user?.name ?? user?.email ?? "-";
  // JOB 3062 R6 (Auftrag §5a, Zeile „Struktur-Chips"): die VERMUTETE QUELLE. Dieselbe Ableitung wie
  // im Intake — nicht abgeschrieben, sondern aufgerufen.
  const quellenVorschlag = deriveIntakeSuggestion("", authorName).source;
  const fallbackTitle = t("cfd.fallbackTitle");
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml, fallbackTitle);
  const hasBody = !isEmptyHtml(bodyHtml);
  const isDraftUpdate = activeDraftId !== null;
  const hasTitle = title.trim().length > 0;
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;
  const proposalTitleOnly = structureProposalTitleOnly(bodyHtml);
  const assistInput = bodyTextForAssist(bodyHtml);
  const hasAssistInput = assistInput.trim().length > 0;
  const submitComplete = submittedKo !== null;
  const hasPendingProposal = structureProposal !== null || assistProposal !== null;

  // ================================================================================================
  // JOB 3062 R6 (bens Befund 3, Korrekturpflicht 3) — DER TITELVORSCHLAG ZIEHT INS TITEL-MENÜ.
  // ================================================================================================
  //
  // Der `RichTextEditor` trägt über dem Schreibfeld eine gerahmte Karte mit dem Titelvorschlag
  // (JOB 2954 D3). Auf dem Blatt war sie das, was Pedi „Text über Text" nennt: ein Kasten mit
  // Beschriftung, Herkunftssatz — und im Normalfall dem SATZ „Aus diesem Bild ließ sich kein Titel
  // ableiten", also einer Erklärung dafür, dass es nichts zu sagen gibt.
  //
  // NACH PAGES-ART GEHÖRT ER AN DEN TITEL: Wer den Titel anfasst, bekommt dort angeboten, was das
  // Haus über den Titel weiß. Die RANGFOLGE bleibt, wo sie hingehört (`lib/titelRangfolge.ts`) —
  // seit R8 ruft das Blatt sie nicht einmal mehr selbst auf, sondern zeigt die Entscheidung, die
  // der Editor daraus gebildet hat. Es entsteht keine zweite Ableitung und kein zweiter Wortlaut:
  // auch die Beschriftungen sind die Schlüssel des Editors (`editor.titleSuggest.*`).
  //
  // ================================================================================================
  // JOB 3062 R8 (bens Korrekturpflichten 1 und 2) — EIN EINZIGER, AUTORITATIVER TITELKANAL.
  // ================================================================================================
  //
  // WAS R7 FALSCH GEMACHT HAT, und ben hat es in Chromium gemessen: Das Blatt schachtelte einen
  // zweiten Anbieter in den Bildkanal und hörte die `describe`-ANTWORT mit. Damit lief es der
  // Gültigkeitsprüfung des Editors DAVOR. Wer den Vorschlag anfordert und das Formular abbricht,
  // bevor die Antwort kommt, bekam den Titel trotzdem angeboten: `stillCurrent()` verwarf die
  // Antwort im Editor (`RichTextEditor.tsx:854`), im Blatt war sie da schon im Zustand. Ein
  // Vorschlag aus einer Handlung, die der Mensch zurückgenommen hat.
  //
  // DIE PRÜFUNG IST NICHT NACHBAUBAR, UND SIE SOLL ES AUCH NICHT SEIN. `captionFormResponseApplicable`
  // vergleicht Bild-Kennung, Bildquelle, Formularlauf, Generation und die Identität des Fußnoten-
  // Knotens (`lib/captionAiSuggest.ts:176`) — alles Zustand, der IM Editor lebt. Eine zweite Kopie
  // davon im Blatt wäre eine zweite Wahrheit über dieselbe Frage; genau davor warnt Auftrag §7.
  //
  // DESHALB IST DER KANAL JETZT DER EDITOR SELBST. Er rendert seine geprüfte Entscheidung ohnehin:
  // `caption-form-title-text` trägt den Titel, `caption-form-title-quelle` trägt über `data-quelle`
  // die Herkunft (JOB 2489 D1, Rang 1 „objekttext" vor Rang 2 „bild"). Diese Knoten entstehen ERST
  // NACH `stillCurrent()` und verschwinden mit `setCaptionFormAi(null)` — also bei Abbruch
  // (`closeCaptionForm`), beim Speichern, beim Bildwechsel und beim Entwurfswechsel. Das Blatt liest
  // sie, statt sie zu erraten: EINE Rangfolge, EINE Gültigkeitsprüfung, EIN veröffentlichter Titel.
  //
  // WARUM ÜBER DEN DOM UND NICHT ÜBER EINEN PROP: `components/RichTextEditor.tsx` liegt nicht in den
  // ZIELPFADEN dieses Auftrags — ein neuer Rückgabe-Prop wäre eine Änderung an fremdem Code. Der
  // Griff in den Editor-DOM ist an dieser Fläche kein neues Mittel: das Werkzeug „Bild" löst den
  // vorhandenen Einfügeknopf genauso aus (`bildEinfuegen`). Und er ist hier der ehrlichere Weg,
  // weil er DAS ergebnis liest, das der Mensch sähe, wenn die Karte nicht verborgen wäre.
  //
  // DIE KARTE IST VERBORGEN, NICHT ENTFERNT (`BLATT_EDITOR_CSS`): `display: none` nimmt sie von der
  // Fläche, lässt den Textinhalt aber im Baum — genau das, was hier gelesen wird.
  const [titelVorschlag, setTitelVorschlag] = useState<TitelMitQuelle | null>(null);
  const editorHuelleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const huelle = editorHuelleRef.current;
    if (ansicht !== "blatt" || !huelle) {
      // Im Arbeitsraum gibt es kein Schreibfeld und damit keine geprüfte Entscheidung. Einen alten
      // Vorschlag weiterzuführen hiesse, über etwas zu sprechen, das gerade niemand ansieht.
      setTitelVorschlag(null);
      return;
    }
    const lesen = (): void => {
      const titel = (
        huelle.querySelector('[data-testid="caption-form-title-text"]')?.textContent ?? ""
      ).trim();
      const quelle = huelle
        .querySelector('[data-testid="caption-form-title-quelle"]')
        ?.getAttribute("data-quelle");
      const gelesen: TitelMitQuelle | null =
        titel.length > 0 && (quelle === "objekttext" || quelle === "bild")
          ? { titel, quelle }
          : null;
      // Identität halten, wenn sich nichts geändert hat: sonst erzeugte jeder Tastendruck im
      // Schreibfeld ein neues Objekt und mit ihm ein überflüssiges Rendern des Titel-Menüs.
      setTitelVorschlag((vorher) =>
        vorher?.titel === gelesen?.titel && vorher?.quelle === gelesen?.quelle ? vorher : gelesen,
      );
    };
    lesen();
    const beobachter = new MutationObserver(lesen);
    beobachter.observe(huelle, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-quelle"],
    });
    return () => beobachter.disconnect();
  }, [ansicht]);

  // Die stille Live-Reaktion (§5): sie hört auf den Klartext des Blattes, nicht auf ein zweites Feld.
  const liveText = useMemo(() => bodyTextForAssist(bodyHtml), [bodyHtml]);
  const verdict = useLiveKnowledgeCheck(liveText);

  // Die Bereiche kommen aus dem BESTAND, nicht aus einer erfundenen Liste: was es im Haus gibt,
  // steht zur Wahl. Fehlt der Bestand noch, sagt das Menü das (Zustandsmodell §9), statt eine
  // vollständige Liste vorzutäuschen.
  const bereiche = useMemo(() => {
    const gesehen = new Set<string>();
    for (const ko of kos.data ?? []) {
      const wert = (ko.category ?? "").trim();
      if (wert) {
        gesehen.add(wert);
      }
    }
    return [...gesehen].sort((a, b) => a.localeCompare(b));
  }, [kos.data]);

  // SCRUM-527, hierher mitgezogen: das Beispiel ist DOMÄNENNAH, nicht irgendeines. Die bevorzugte
  // Kategorie kommt aus den EIGENEN KOs des Nutzers; hat er keine, bleibt sie undefined und
  // `pickExampleKo` nimmt den Org-Bestand — nie ein fachfremdes Muster. Ohne diesen Schritt (so
  // stand es bis hierher: `pickExampleKo(kos.data, undefined)`) verlöre „Beispiel ansehen" die
  // Domänennähe, die `KnowledgeIntake.tsx:43-50` heute liefert — ein stiller Funktionsverlust.
  const preferCategory = useMemo(() => {
    const mine = (kos.data ?? []).filter((k) => user?.id && k.author === user.id);
    return dominantCategory(mine.length > 0 ? mine : undefined);
  }, [kos.data, user?.id]);

  const beispiel = useMemo(
    () => pickExampleKo(kos.data, preferCategory),
    [kos.data, preferCategory],
  );

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

  // ================================================================================================
  // JOB 3062 R6 (bens Befund 1) — DER BEREICH REIST MIT. AN GENAU EINER STELLE.
  // ================================================================================================
  //
  // DER SCHADEN, gemessen von ben: Das Menü „Bereich" schrieb seine Wahl in den Zustand — und
  // niemand las sie je wieder. Weder das Anlegen noch das Aktualisieren noch das Einreichen gab sie
  // weiter; `buildFrontDoorPayload` setzt beim Neuanlegen hart `category: "Allgemein"`, und genau
  // das kam am Server an. Wer „Konstruktion" wählte, bekam „Allgemein" — eine Scheinwahl.
  //
  // WARUM DIESE FUNKTION UND NICHT DER PAYLOAD-BAUER: Der richtige Ort wäre
  // `lib/captureFrontDoor.ts` (dort steht die Voreinstellung). Diese Datei liegt NICHT in den
  // ZIELPFADEN dieses Auftrags; sie zu ändern wäre ungeprüfter Code (Regel 3). Deshalb sitzt der
  // Bereich hier an EINER Stelle, durch die JEDER der drei Schreibwege läuft — Anlegen,
  // Aktualisieren, Einreichen. Eine zweite Ableitung gibt es nicht; die Auslassung des Payload-
  // Bauers steht in der Rückgabe unter ABWEICHUNGEN.
  //
  // LEER HEISST NICHT LEEREN: Ohne Wahl bleibt der Schlüssel WEG. Über einem bestehenden Entwurf
  // liest der Merge einen mitgeschickten Leerwert als LÖSCHUNG (`services/capture/src/service.ts`,
  // zitiert in `captureFrontDoor.ts`) — ein Blatt ohne Bereichswahl würde sonst die Kategorie eines
  // fremden Entwurfs beim ersten Speichern austragen.
  const mitBereich = useCallback(
    (rumpf: DraftPayload): DraftPayload =>
      kategorie.trim() ? { ...rumpf, category: kategorie.trim() } : rumpf,
    [kategorie],
  );

  const changeKategorie = (next: string): void => {
    setKategorie(next);
    // Wie bei Titel und Rumpf: eine neue Wahl ist eine neue Absicht — ein bereits eingereichtes
    // Ergebnis steht ihr nicht mehr im Weg, und ein zweiter Klick auf „Entwurf sichern" ist wieder
    // erlaubt (die Sperren sind Doppelklick-Schutz, keine Zustandswahrheit).
    setSubmittedKo(null);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
  };

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
    // JOB 2705 (R2-23 a): Ab hier hat der Mensch den Rumpf selbst in der Hand. Leert er ihn jetzt,
    // ist das eine echte Löschung und muss als Löschmarker reisen.
    bodyNieGeliefertRef.current = false;
    setSubmittedKo(null);
    setSubmitValidation(false);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    clearStructureState();
    clearAssistState();
  };

  const resetForNewEntry = (): void => {
    setTitle("");
    setBodyHtml("");
    setQuellBildzahl(null);
    // Ein neuer Eintrag ist eine NEUE Entscheidung über den Egress: die Stufe des eben
    // eingereichten Objekts darf nicht stillschweigend auf den nächsten Text übergehen. Das Blatt
    // startet deshalb wie frisch geöffnet — Stufe zurück auf den Anfangswert, Wahl wieder offen
    // (Auftrag §4 und §8.5: Vertraulichkeit vor Egress bleibt Pflicht).
    setConfidentiality("intern");
    setDeclaredConfidentiality(undefined);
    setVertraulichkeitMarkiert(false);
    setKategorie("");
    savedStateRef.current = { title: "", bodyHtml: "", confidentiality: "intern", kategorie: "" };
    bodyNieGeliefertRef.current = false;
    setSubmittedKo(null);
    setActiveDraftId(null);
    // JOB 3106 (UX-01): ein neues Blatt spricht nicht mehr über die Sicherung des alten.
    setGesicherterEntwurf(null);
    setSubmitValidation(false);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    setSearchParams({}, { replace: true });
    clearStructureState();
    clearAssistState();
    setErr(null);
  };

  // ================================================================================================
  // JOB 3256 (CAP-P1-R, Lieferung 4) — DIE EINE TRENNUNG, DREI AUFRUFER.
  // ================================================================================================
  //
  // WAS EINE TRENNUNG LEISTEN MUSS, hat JOB 3141 R2 gemessen (die Begründung im Langen steht am
  // Diktat-Werkzeug weiter unten): `stop()` ist nach Web-Speech §4.1.4 eine BITTE um Abschluss —
  // das laufende Ergebnis kommt noch, `end` folgt danach. Die Grenze ist deshalb der Merker
  // `recRef.current` (die Identität des Rekorders, der das Blatt gerade FÜHRT), nicht der Anruf.
  // Die Reihenfolge ist die ganze Wirkung:
  //   1. den Merker leeren — ab hier fallen beide Rückrufe in `diktatUmschalten` von selbst durch;
  //   2. den Läuft-Zustand selbst zurücksetzen — der Rekorder darf ihn nicht mehr melden, also muss
  //      es der tun, der ihn getrennt hat;
  //   3. `stop()` — das Mikrofon geht aus. Was danach gemeldet wird, gehört keinem Blatt mehr.
  //
  // WARUM SIE HIER STEHT UND NICHT DREIMAL (Auftrag 3256, Prüfpunkt 7): bis dahin stand diese Folge
  // INLINE im Ladeeffekt und war damit an das Ladefenster gebunden. Die zwei anderen Wege, die dem
  // Blatt seinen Rumpf wegnehmen — einen anderen Entwurf öffnen und „Eingabe verwerfen" —, hatten
  // sie nicht; auf einem Blatt OHNE `?draft` läuft der Ladeeffekt gar nicht, und der Nachzügler der
  // verworfenen Sitzung schrieb in das gerade leergeräumte Blatt. Drei Kopien wären drei
  // Gelegenheiten zum Auseinanderlaufen: der Merker wird im ganzen Blatt an genau EINER Stelle
  // geleert, nämlich in der ersten Zeile unten.
  //
  // NICHT GETRENNT WIRD BEIM MANUELLEN STOPP über den Diktat-Knopf. Wer selbst anhält, nimmt sich
  // seinen Rumpf ja nicht weg — sein Abschlussergebnis gehört ihm und soll noch ankommen.
  const diktatVomBlattTrennen = useCallback((): void => {
    const getrennt = recRef.current;
    if (!getrennt) {
      return;
    }
    recRef.current = null;
    setDiktatLaeuft(false);
    getrennt.stop();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadNonce erzwingt das Neuladen nach einem Standkonflikt (JOB 2684 D1)
  useEffect(() => {
    if (!resumeDraftId) {
      setActiveDraftId(null);
      setQuellBildzahl(null);
      // JOB 3106 R3 (bens Korrekturpflicht 1): HIER ENDET DER MERKER, UND ZWAR IMMER. Trägt die
      // Adresse keinen Entwurf mehr, hält das Blatt auch keinen — jede Aussage „diesen Entwurf
      // haben wir schon" ist ab hier falsch. Dieser Zweig ist der EINE Ort, durch den alle drei
      // Verlassenswege laufen (`resetForNewEntry`, `submit.onSuccess`, „neuer Vorgang"): sie alle
      // setzen `setSearchParams({})`. Ohne diese Zeile überlebte der Merker das Verwerfen — und
      // das erneute Öffnen DESSELBEN Entwurfs übersprang dann das Laden (bens Messung: richtige
      // Adresse, leeres Blatt, danach `create` statt `update` und ein zweiter Entwurf).
      speicherAdresseRef.current = null;
      // JOB 3141 (CAP-P1, Lieferung 6): UND HIER ENDET DIE SPERRE. Dieser Zweig ist der eine Ort,
      // an dem ein LAUFENDES Laden nicht durch sein eigenes `.finally` beendet wird: die Aufräumung
      // des vorigen Effekts setzt `cancelled = true`, das angehaltene Versprechen kommt also
      // wortlos nirgends mehr an. Ohne diese Zeile bliebe das Blatt für immer gesperrt — vor JOB
      // 3141 fiel das kaum auf (nur das Titelfeld war gesperrt), seit die Schreibfläche derselben
      // Regel folgt, wäre es eine tote Seite. Gemessen in F3b: von `/erfassen?draft=…` mitten im
      // Laden auf `/erfassen` zurück.
      //
      // ES IST KEINE ZWEITE ABSICHERUNG DESSELBEN LOCHS, sondern die Zustandsaussage DIESES
      // Zweiges: die Adresse nennt keinen Entwurf, es ist also nichts zu laden — und ein Blatt ohne
      // Ladevorgang ist bereit.
      setLoadingDraft(false);
      return;
    }
    // ============================================================================================
    // JOB 3106 (UX-01) — DAS FESTHALTEN DER KENNUNG IST KEIN LADEBEFEHL.
    // ============================================================================================
    // Seit diesem Auftrag schreibt der Speicherweg die Kennung des gerade gesicherten Entwurfs in
    // die Adresse (`save.onSuccess`), damit ein Neuladen denselben Text wiederfindet. Ohne diese
    // Bewachung liefe dieser Effekt daraufhin los und HOLTE denselben Entwurf noch einmal vom
    // Server — und was der Mensch während dieser Runde tippt, wäre von der Antwort überschrieben.
    // Zu laden gibt es hier nichts: der Blattinhalt IST der Stand, den der Server eben quittiert
    // hat.
    //
    // DER MERKER TRÄGT DIE LADERUNDE MIT (`#<reloadNonce>`), nicht nur die Kennung. Sonst bliebe
    // „Neu laden" nach einem Standkonflikt (JOB 2684 D1) wirkungslos: dort ändert sich allein der
    // Nonce, die Kennung nicht. Gelöscht wird er erst auf dem Weg, der WIRKLICH lädt — damit ein
    // späteres Zurückkehren zu demselben Entwurf (über die Fläche „Entwürfe") wieder lädt und ein
    // doppelt ausgeführter Effekt (React StrictMode) nicht doch noch einen Ladevorgang auslöst.
    //
    // UND ER ENDET, SOBALD DIE ADRESSE KEINEN ENTWURF MEHR NENNT (Zweig oben, JOB 3106 R3). Das ist
    // die zweite Hälfte seines Lebenslaufs und der Grund, warum es hier bei EINER Bedingung bleibt:
    // eine zusätzliche Prüfung auf `activeDraftId` wäre eine zweite Absicherung derselben Lücke —
    // und keine der beiden liesse sich dann noch einzeln messen (jede allein hielte den Fall grün).
    if (speicherAdresseRef.current === `${resumeDraftId}#${reloadNonce}`) {
      return;
    }
    speicherAdresseRef.current = null;
    // JOB 2974 D3 (F-0040): die Kennung, die VOR diesem Ladeversuch aktiv war.
    const vorherigeKennung = activeDraftId;
    let cancelled = false;
    setLoadingDraft(true);
    // JOB 3141 (CAP-P1, Lieferung 1 und 4): DER DRITTE EINGABEWEG WIRD MIT ANGEHALTEN. Tastatur und
    // Einfügen laufen über die Schreibfläche, die es ab jetzt während des Ladens nicht gibt — das
    // Diktat läuft daran vorbei: sein Rückruf schreibt über `setBodyHtml` unmittelbar in den
    // Blattzustand (`diktatUmschalten`). Ein weiterlaufendes Diktat hängte also Absätze an einen
    // Rumpf, den `:645` gleich darauf ersetzt.
    //
    // JOB 3141 R2 (bens Korrekturpflicht 1) — GETRENNT WIRD ZUERST, ANGEHALTEN DANACH. Runde 1 rief
    // nur `stop()`, und das ist nach der Web-Speech-Spezifikation eine Bitte um Abschluss: das
    // laufende Ergebnis kommt noch. ben hat es gemessen — der Satz landete IM frisch geladenen
    // Entwurf.
    //
    // JOB 3256: die Folge selbst steht seit CAP-P1-R oben in `diktatVomBlattTrennen` — dieselbe
    // Trennung, die auch das Öffnen eines anderen Entwurfs und „Eingabe verwerfen" rufen. Hier wird
    // sie nur noch ausgelöst, nicht mehr beschrieben.
    diktatVomBlattTrennen();
    setLetzteAktion({ art: "laden" });
    setErr(null);

    endpoints.drafts
      .get(resumeDraftId)
      .then((draft) => {
        if (cancelled) {
          return;
        }
        const loadedTitle = draft.payload.title ?? "";
        const loadedBody = frontDoorBodyFromDraft(draft.payload);
        // JOB 2705 (R2-23 a): `null` IST NICHT `""` — der Unterschied, den der String nicht trägt.
        bodyNieGeliefertRef.current = draft.payload.bodyHtml === null;
        // JOB 3082 (Q3 a): NUR EINE GÜLTIGE STUFE ZÄHLT ALS WAHL. Was hier ankommt, ist Drahtwert
        // — ein fehlendes Feld, `null` oder ein unbekannter String sind KEINE Einstufung. Dieselbe
        // Prüfung wie in `vertraulichkeitsAuskunft` (lib/confidentiality.ts:119-121) und wie
        // serverseitig `discloseConfidentiality`: gültig oder gar nichts, nie geraten.
        const declared = CONFIDENTIALITY_LEVELS.includes(
          draft.payload.confidentiality as Confidentiality,
        )
          ? (draft.payload.confidentiality as Confidentiality)
          : undefined;
        const loadedConfidentiality = confidentialityOf(declared);
        setActiveDraftId(draft.id);
        setTitle(loadedTitle);
        setBodyHtml(loadedBody);
        setKategorie(draft.payload.category ?? "");
        loadedUpdatedAtRef.current = draft.updatedAt ?? null;
        setStaleConflict(false);
        setQuellBildzahl(draft.payload.sourceImageCount ?? null);
        setConfidentiality(loadedConfidentiality);
        // JOB 3082 (Q3 a): DAS IST DER EINE ORT, an dem ein Ladevorgang über die Wahl entscheidet
        // — und er entscheidet nach dem, was WIRKLICH im Entwurf steht. Trägt die Nutzlast eine
        // gültige Stufe, gilt sie als gewählt (auch das ausdrückliche „intern"); trägt sie keine,
        // bleibt die Wahl offen und das Einreichen gesperrt. Ein `setVertraulichkeitGewaehlt(true)`
        // ohne Bedingung stand hier bis JOB 3082 und war der Befund R-1560.
        setDeclaredConfidentiality(declared);
        setVertraulichkeitMarkiert(false);
        savedStateRef.current = {
          title: loadedTitle,
          bodyHtml: loadedBody,
          confidentiality: loadedConfidentiality,
          kategorie: draft.payload.category ?? "",
        };
        setSubmitValidation(false);
        setSubmittedKo(null);
        // JOB 3106 (UX-01): ein GELADENER Entwurf ist keine frische Sicherung. Die
        // Bestätigungszeile spräche sonst über einen Speichervorgang, der zu diesem Blattinhalt
        // gar nicht gehört.
        setGesicherterEntwurf(null);
        saveRequestedRef.current = false;
        submitRequestedRef.current = false;
        clearStructureState();
        clearAssistState();
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return;
        }
        // JOB 2974 D3 (F-0040, Variante A): Eine abgelehnte FREMDE Kennung darf den eigenen Entwurf
        // nicht mitnehmen — die eigene bleibt aktiv, die Adresse wird zurückgesetzt, die Meldung
        // reist als Toast (ein zweiter Lauf würde ein `setErr` sofort wieder löschen).
        if (vorherigeKennung && vorherigeKennung !== resumeDraftId) {
          push("error", ladeFehlerMeldung(e, t("fd.errLoadFailed")));
          setSearchParams({ draft: vorherigeKennung }, { replace: true });
          return;
        }
        setActiveDraftId(null);
        setErr(ladeFehlerMeldung(e, t("fd.errLoadFailed")));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resumeDraftId, reloadNonce, clearStructureState, clearAssistState, diktatVomBlattTrennen, t]);

  const structure = useMutation({
    mutationFn: () =>
      endpoints.reasoner.structure(structureInput, locale, draftProvenance(confidentiality)),
    onMutate: () => {
      // JOB 3062 R7: HIER und nicht am Menüeintrag — dann merkt sich das Blatt die Handlung auch
      // dann, wenn „Erneut versuchen" sie auslöst, und der Auslöser steht nur an einer Stelle.
      setLetzteAktion({ art: "struktur" });
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
    onMutate: (action: AssistAction) => {
      // Die KONKRETE Handlung, nicht „KI": sie ist es, die wiederholt werden muss.
      setLetzteAktion({ art: "assist", aktion: action });
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
        // AUFTRAG-mega7 Block A: Speichern auf einen BESTEHENDEN Entwurf ist ein PUT über den
        // Bestand — die Entwurfs-Id mitgeben, damit ein bewusst geleerter Rumpf als Löschmarker
        // reist statt vom partiellen Merge durch den Altwert ersetzt zu werden.
        const rumpf = buildFrontDoorPayload({
          title,
          bodyHtml,
          fallbackTitle,
          // JOB 3082: NUR eine getroffene Wahl reist mit. Sichern bleibt ohne Stufe erlaubt (ein
          // halber Gedanke muss sich wegspeichern lassen) — der Entwurf trägt dann kein Feld, und
          // das Fortsetzen fragt wieder nach.
          gewaehlteVertraulichkeit: declaredConfidentiality,
          activeDraftId,
        });
        // JOB 2705 (R2-23 a): DER LÖSCHMARKER AUS DEM NICHTS. Hat der Server den Rumpf nie
        // geliefert und hat der Mensch ihn seither nicht angefasst, geht der Schlüssel GAR NICHT
        // mit — der partielle Merge lässt den Altwert stehen.
        if (bodyNieGeliefertRef.current && rumpf.bodyHtml === CLEARED_DRAFT_BODY_HTML) {
          // biome-ignore lint/performance/noDelete: Schluessel muss fehlen, nicht leer sein
          delete rumpf.bodyHtml;
        }
        return withFrontDoorSaveTimeout(
          endpoints.drafts.update(
            activeDraftId,
            mitBereich(rumpf),
            loadedUpdatedAtRef.current
              ? { expectedUpdatedAt: loadedUpdatedAtRef.current }
              : undefined,
          ),
        );
      }
      // JOB 2697 — DER SCHLÜSSEL ENTSTEHT BEIM ERSTEN KLICK UND ÜBERLEBT DIE WIEDERHOLUNG.
      if (!saveOperationRef.current) {
        saveOperationRef.current = newCreateOperationId();
      }
      return createFrontDoorDraft(
        { title, bodyHtml, fallbackTitle, gewaehlteVertraulichkeit: declaredConfidentiality },
        (payload, operationId) => endpoints.drafts.create(mitBereich(payload), operationId),
        undefined,
        saveOperationRef.current,
      );
    },
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
      // JOB 2705 (R2-23 c): DER STAND, DER WIRKLICH ABGESENDET WIRD — festgehalten VOR dem Aufruf.
      return { abgesendet: { title, bodyHtml, confidentiality, kategorie } };
    },
    onSuccess: (draft, _variablen, kontext) => {
      setActiveDraftId(draft.id);
      saveOperationRef.current = null;
      loadedUpdatedAtRef.current = draft.updatedAt ?? null;
      setStaleConflict(false);
      setErr(null);
      // JOB 2705 (R2-23 c): der ABGESENDETE Stand ist der Bezugspunkt, nicht der aktuelle — sonst
      // gälte als „gesichert", was der Mensch während des Speicherns getippt hat.
      const abgesendet = kontext?.abgesendet ?? { title, bodyHtml, confidentiality, kategorie };
      savedStateRef.current = abgesendet;
      setSubmitValidation(false);
      push("success", t("fd.toastSaved"));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      if (guardSaveRef.current) {
        guardSaveRef.current = false;
      }
      // ==========================================================================================
      // JOB 3106 (UX-01) — DIE ADRESSE HÄLT DEN GERADE GESICHERTEN ENTWURF FEST.
      // ==========================================================================================
      //
      // WAS HIER BIS JETZT STAND und was daran falsch war: „Das Blatt BLEIBT stehen … ein Sprung
      // auf dieselbe Adresse wäre eine Bewegung ohne Ziel." Der erste Halbsatz gilt weiter — das
      // Blatt springt nirgendwohin. Der zweite hat die Frage verwechselt: es geht nicht um einen
      // SPRUNG, sondern darum, WAS die Adresse trägt. Sie trug nichts, und deshalb war nach einem
      // Neuladen von `/erfassen` das eben gesicherte Blatt leer (Codex' Live-Befund N-0005:
      // „URL bleibt /erfassen. Nach Reload ist das Blatt leer.").
      //
      // ES IST DERSELBE WEG, DEN `entwurfOeffnen` GEHT — nicht ein zweiter: die Kennung steht in
      // `?draft=`, der Ladeweg liest sie beim nächsten Aufbau (`resumeDraftId`), und weil sie
      // `activeDraftId` wieder füllt, aktualisiert auch das nächste Speichern denselben Entwurf,
      // statt einen zweiten anzulegen.
      //
      // `replace: true` wie dort: das Festhalten der Kennung ist kein Schritt, den der Mensch
      // gegangen ist — der Zurück-Weg des Browsers bekommt davon keinen Zwischenhalt.
      //
      // NUR, WENN DIE ADRESSE SIE NOCH NICHT TRÄGT: beim Aktualisieren eines offenen Entwurfs
      // steht sie schon dort, und ein erneutes Setzen wäre ein Navigationsvorgang ohne Wirkung.
      if (resumeDraftId !== draft.id) {
        speicherAdresseRef.current = `${draft.id}#${reloadNonce}`;
        setSearchParams({ draft: draft.id }, { replace: true });
      }
      // Die Bestätigungszeile (Lieferung 2) nennt den Titel, den der SERVER quittiert hat. Fehlt
      // er in der Antwort, steht der Titel da, unter dem gerade abgesendet wurde — dieselbe
      // Ableitung, die die Nutzlast gebaut hat (`buildFrontDoorPayload`), keine zweite Regel.
      setGesicherterEntwurf({
        id: draft.id,
        titel:
          draft.payload?.title?.trim() ||
          deriveFrontDoorTitle(abgesendet.title, abgesendet.bodyHtml, fallbackTitle),
      });
    },
    onError: (e) => {
      saveRequestedRef.current = false;
      // JOB 2697: den Schlüssel NUR fallen lassen, wenn der Server EINDEUTIG geantwortet hat.
      if (createOperationIsSettled(e instanceof ApiError ? e.status : undefined)) {
        saveOperationRef.current = null;
      }
      if (e instanceof ApiError && e.code === "DRAFT_STALE") {
        setStaleConflict(true);
        setErr(null);
        return;
      }
      setRestartOffer(
        e instanceof ApiError && createConflictOffersRestart(e.status, e.code) ? e.message : null,
      );
      setErr(fehlerMeldung(e, t("fd.errSaveFailed")));
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      // AUFTRAG-mega23 Block A: EIN Vorgang, EIN Schlüssel — über alle Wiederholungen hinweg.
      if (!submitOperationRef.current) {
        submitOperationRef.current = newCreateOperationId();
      }
      return submitFrontDoorDraft(
        {
          title,
          bodyHtml,
          activeDraftId,
          fallbackTitle,
          // JOB 3082: hier steht die Wahl, die der Mensch getroffen hat — und `requestSubmit` unten
          // lässt diesen Weg gar nicht erst laufen, solange sie fehlt.
          gewaehlteVertraulichkeit: declaredConfidentiality,
          expectedUpdatedAt: activeDraftId ? loadedUpdatedAtRef.current : null,
        },
        {
          // JOB 3062 R6: DERSELBE Bereich auf BEIDEN Wegen dieses Vorgangs. Der Rumpf reist zweimal
          // — einmal beim Anlegen des Entwurfs, einmal als `draftPayload` IM Promote, aus dem das
          // Wissensobjekt entsteht (`toKoInput`). Bekäme nur einer der beiden den Bereich, hinge das
          // Ergebnis davon ab, ob gerade ein Entwurf vorlag; und der Serverabdruck des Vorgangs
          // (`createOperationFingerprint`) enthält den Payload — zwei verschieden gebaute Rümpfe
          // wären für den Server zwei Vorgänge und die Wiederholung liefe ins IDEMPOTENCY-Nein.
          createDraft: (payload) => endpoints.drafts.create(mitBereich(payload)),
          promoteDraft: (id, vorgang) =>
            endpoints.drafts.promote(id, {
              ...vorgang,
              draftPayload: mitBereich(vorgang.draftPayload),
            }),
        },
        { id: submitOperationRef.current, draftRef: submitDraftRef },
      );
    },
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
    },
    onSuccess: (ko) => {
      submitOperationRef.current = null;
      submitDraftRef.current = null;
      setRestartOffer(null);
      setSubmittedKo({ id: ko.id, title: ko.title });
      setTitle("");
      setBodyHtml("");
      setActiveDraftId(null);
      // JOB 3106 (UX-01): der Entwurf ist im Einreichen aufgegangen — es gibt ihn nicht mehr, und
      // die Erfolgszeile des Vorgangs ist ab hier die eine Auskunft (`BlattLage`).
      setGesicherterEntwurf(null);
      loadedUpdatedAtRef.current = null;
      setStaleConflict(false);
      setKategorie("");
      savedStateRef.current = { title: "", bodyHtml: "", confidentiality, kategorie: "" };
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
      if (createOperationIsSettled(e instanceof ApiError ? e.status : undefined)) {
        submitOperationRef.current = null;
        submitDraftRef.current = null;
      }
      setRestartOffer(
        e instanceof ApiError && createConflictOffersRestart(e.status, e.code) ? e.message : null,
      );
      if (e instanceof ApiError && e.code === "DRAFT_STALE") {
        setStaleConflict(true);
        setErr(null);
        return;
      }
      setErr(fehlerMeldung(e, t("fd.errSaveFailed")));
    },
  });

  const busy = save.isPending || submit.isPending || loadingDraft || submittedKo !== null;

  // ================================================================================================
  // JOB 3141 (CAP-P1) — EINE REGEL FÜR TITEL UND RUMPF: NIMMT DAS BLATT GERADE ETWAS AN?
  // ================================================================================================
  //
  // PEDIS BEFUND: Wer `/erfassen?draft=<id>` öffnet und sofort losschreibt, sah seinen Satz
  // verschwinden — der Ladeweg setzt Titel und Rumpf bedingungslos auf den Serverstand (`:611-612`).
  // Die Sperre dagegen war HALB da: `disabled={loadingDraft}` am Titelfeld, NICHTS an der
  // Schreibfläche. Genau diese Ungleichbehandlung ist der Fehler, nicht ihr Fehlen an einer Stelle.
  //
  // GEWÄHLT IST WEG B — „Bedienung bis Bereitschaft verhindern", und zwar ganz. Der andere Weg aus
  // dem Auftrag („frühe Eingaben erhalten") ist geprüft und verworfen: Er müsste entscheiden, was
  // mit dem gerade geholten Entwurfstext geschieht, dem der eigene Satz gegenübersteht — also
  // zusammenführen oder eines von beidem verwerfen. Das ist eine Konfliktzusammenführung, und die
  // ist in §10 ausdrücklich NICHT Teil dieses Auftrags. Ausserdem hinge dann `savedStateRef` (`:625`)
  // an einem Stand, den der Server nicht kennt: das Blatt hielte den fremden Entwurf für
  // gespeichert, obwohl es den eigenen Text zeigt — genau die Unwahrheit, die Lieferung 5 verbietet.
  // Weg B braucht keine dieser Entscheidungen: was nie entstehen konnte, muss auch nicht gerettet
  // werden.
  //
  // DIESE EINE ABLESUNG IST DIE GANZE REGEL. Sie wird an JEDEM Eingabeweg gelesen und nirgends
  // nachgebaut: Titelfeld (`disabled`), Schreibfläche (sie wird gar nicht erst gerendert),
  // Diktat-Knopf und Bild-Knopf. Die KI-Wege hängen über `busy` schon daran. Der frühere
  // Einzelausdruck `disabled={loadingDraft}` am Titelfeld ist damit ERSETZT, nicht ergänzt.
  //
  // WARUM DIE SCHREIBFLÄCHE NICHT „NUR" GESPERRT WIRD: `RichTextEditor` ist ein unkontrolliertes
  // `contentEditable` (`RichTextEditor.tsx:2972`) ohne Sperr-Eingang, und seine Datei liegt nicht in
  // den Zielpfaden. Die naheliegenden Alternativen sind gemessen und untauglich: ein `inert` oder
  // `aria-disabled` an einer Hülle ändert in jsdom NICHTS am Tastatur- und Einfügeweg (der Test F2
  // fügt HTML über den echten `onPaste`-Weg ein und misst, dass es ankommt) — die Sperre wäre also
  // eine Behauptung, die kein Test halten kann; `pointer-events: none` liesse die Tastatur ganz
  // offen. Bleibt das VERZÖGERTE MONTIEREN: solange geladen wird, gibt es keinen Editor und damit
  // keinen Empfänger. Das ist keine halbe Sperre, sondern die vollständige — und sie ist messbar.
  const blattNimmtAn = !loadingDraft;
  const hasSavableContent = isDraftUpdate || hasBody || hasTitle;
  const canSave = hasSavableContent && !busy;
  const canStructure = hasStructureInput && !structure.isPending && !busy;
  const canAssist = hasAssistInput && !assist.isPending && !busy;

  // §5.4: Vertraulichkeit bleibt Pflicht vor dem Einreichen. Ist sie nicht gewählt, bekommt das
  // Menü einen Rand, den Fokus — und seit JOB 3114 (UX-05, Befund N-0017) einen Erklärsatz am Feld,
  // der über `aria-describedby` am Menüknopf hängt. Rand und Fokus allein sind für einen Menschen,
  // der die Farbe nicht sieht oder den Sprung nicht bemerkt, ein Knopf, der wortlos nichts tut.
  // ==============================================================================================
  // WANN IST DIE VERTRAULICHKEIT „NICHT GEWÄHLT"? (Auftrag §4)
  // ==============================================================================================
  // ==============================================================================================
  // JOB 3082 (Q3 a) — DIE FRAGE HAT EINEN EINZIGEN TRÄGER: `declaredConfidentiality`.
  // ==============================================================================================
  //
  // WAS VORHER FALSCH WAR, und Codex hat es am lebenden System gemessen (Befund R-1560, 05.09.):
  // Ein zweites Feld (`vertraulichkeitGewaehlt`) führte dieselbe Tatsache noch einmal — und der
  // Ladeweg setzte es BEDINGUNGSLOS auf „gewählt", auch für eine Entwurfsnutzlast ganz ohne Feld
  // `confidentiality`. Ein fortgesetzter Entwurf, bei dem die Frage übersprungen worden war, kam
  // damit durch die Pflicht hindurch: „Fortsetzen und Einreichen führt zu POST promote … GET KO
  // confidentiality null."
  //
  // Die damalige Begründung („ein fehlendes Drahtfeld IST die Kodierung für intern") hing an genau
  // der Sonderregel, die dieser Auftrag abschafft: der Client sendet ein ausdrückliches „intern"
  // ab jetzt mit (`lib/captureFrontDoor.ts`). Ein fehlendes Feld heisst deshalb wieder das, was es
  // sagt — NIEMAND HAT GEWÄHLT. Für Entwürfe aus der Zeit davor ist das die ausdrücklich
  // angenommene Folge: sie fragen beim Fortsetzen erneut, statt eine Einstufung zu behaupten.
  //
  // EIN ZUSTAND STATT ZWEI: „gewählt" ist keine eigene Flagge mehr, sondern die Ablesung des
  // einen Wertes. Zwei Felder für dieselbe Tatsache waren die Bauform, in der der Fehler überhaupt
  // erst möglich war — eines konnte „gewählt" sagen, während das andere leer stand.
  // `declaredConfidentiality` bleibt dabei der UNGEGLÄTTETE Wert für die Modell-Provenienz
  // (JOB 504 D2): er trägt nur gültige Stufen oder gar nichts.
  const vertraulichkeitGewaehlt = declaredConfidentiality !== undefined;
  const vertraulichkeitOffen = !vertraulichkeitGewaehlt;
  const [vertraulichkeitMarkiert, setVertraulichkeitMarkiert] = useState(false);
  const vertraulichkeitRef = useRef<HTMLDivElement | null>(null);
  // JOB 3114 (UX-05): DER HINWEIS IST KEIN ZUSTAND, SONDERN EINE ABLESUNG. Rand (`markiert`),
  // `aria-invalid` und der Erklärsatz lesen denselben einen Ausdruck — deshalb erlischt der Satz
  // an JEDER heute schon vorhandenen Rücksetzung (Menüauswahl unten) und braucht keine eigene.
  // Eine zweite Flagge daneben wäre genau die Bauform, die JOB 3082 hier abgeschafft hat.
  const vertraulichkeitHinweisSteht = vertraulichkeitMarkiert && vertraulichkeitOffen;

  const discardStructureProposal = (): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
  };

  const discardAssistProposal = (): void => {
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(false);
  };

  const acceptStructureProposal = (): void => {
    if (!structureProposal) {
      return;
    }
    // WP-D6/WP-D6b: „Original ist heilig" — die gesamte Übernahme-Entscheidung liegt in der puren,
    // getesteten `applyStructureProposal`; hier steht nur setState.
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

  // AUFTRAG-mega9 Block B: das ehrliche Dirty-Prädikat — Abweichung des TATSÄCHLICHEN Inhalts vom
  // gesicherten Stand plus ein offener KI-Vorschlag. Bewusst nicht „ist gesetzt": das bloße Öffnen
  // eines gespeicherten Entwurfs ist keine ungespeicherte Änderung.
  const istSchmutzig =
    title !== savedStateRef.current.title ||
    bodyHtml !== savedStateRef.current.bodyHtml ||
    confidentiality !== savedStateRef.current.confidentiality ||
    // JOB 3062 R6 (bens Befund 1): eine geänderte Bereichswahl IST eine ungespeicherte Änderung.
    kategorie !== savedStateRef.current.kategorie ||
    hasPendingProposal;

  // JOB 3106 (UX-01): die Bestätigungszeile steht, SOLANGE das Blatt dem gesicherten Stand
  // entspricht. Sie hängt bewusst am vorhandenen Dirty-Prädikat und nicht an einem zweiten
  // Vergleich derselben Felder: wer weiterschreibt, hat einen Stand, den der Server nicht
  // quittiert hat — und über den darf die Zeile nicht mehr „gesichert" sagen.
  const gesichertZeile = gesicherterEntwurf !== null && !istSchmutzig ? gesicherterEntwurf : null;

  const unsicherbareGruende = useMemo<string[]>(
    () => [
      ...(hasPendingProposal ? [t("fd.unsavable.proposal")] : []),
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
    setLetzteAktion({ art: "speichern" });
    saveRequestedRef.current = true;
    save.mutate();
  };

  const requestSubmit = (): void => {
    if (busy || submitRequestedRef.current) {
      return;
    }
    // §5.4: fehlt der Inhalt oder die Vertraulichkeit, wird der Versuch nicht still verschluckt —
    // das betroffene Feld wird markiert und fokussiert. JOB 3114 (UX-05): bei der Vertraulichkeit
    // trägt genau diese Markierung zusätzlich den Erklärsatz an der Wahl (s. Werkzeugzeile). Hier
    // ändert sich dafür NICHTS: kein zweiter Zustand, keine zweite Bedingung, dieselbe Fokuszeile.
    if (!hasBody || vertraulichkeitOffen) {
      setSubmitValidation(true);
      if (vertraulichkeitOffen) {
        setVertraulichkeitMarkiert(true);
        vertraulichkeitRef.current?.querySelector("button")?.focus();
      }
      return;
    }
    setLetzteAktion({ art: "einreichen" });
    submitRequestedRef.current = true;
    submit.mutate();
  };

  // ================================================================================================
  // JOB 3062 R6 (bens Befund 4 / Auftrag §9) — „ERNEUT VERSUCHEN" AM FEHLER, NICHT NUR EIN SATZ.
  // ================================================================================================
  //
  // §9 verlangt beim Fehler „EIN Satz unter den Knöpfen + ,Erneut versuchen'". Bis R5 stand nur der
  // Satz da: wem das Speichern wegen einer abgerissenen Verbindung misslang, der hatte kein Mittel
  // ausser einem zweiten Klick auf denselben Knopf — und beim LADEFEHLER nicht einmal das, denn
  // dort gibt es keinen Knopf, der den Ladeweg noch einmal anstiesse.
  //
  // WAS WIEDERHOLT WIRD, IST DIE ZULETZT VERSUCHTE HANDLUNG — nicht „irgendetwas". Deshalb merkt
  // sich das Blatt sie ausdrücklich, statt sie aus `isError`-Flaggen zu raten: nach einem
  // fehlgeschlagenen Einreichen wiederholt der Knopf das EINREICHEN, nicht das Speichern. Ein
  // Wiederholversuch, der stillschweigend etwas anderes täte, wäre schlimmer als keiner.
  //
  // DIE VORGANGSSCHLÜSSEL BLEIBEN UNBERÜHRT: `saveOperationRef`/`submitOperationRef` werden hier
  // NICHT zurückgesetzt. Genau darin liegt der Sinn der Wiederholung — derselbe Schlüssel, derselbe
  // Vorgang, keine zweite Anlage (`lib/createOperation.ts`).
  //
  // JOB 3062 R7 (bens Korrekturpflicht 2): DIE BEIDEN KI-WEGE GEHÖREN DAZU. Sie wiederholen NICHT
  // über `requestSave`, sondern über dieselbe Mutation mit denselben Eingaben — bei der KI-Hilfe
  // mit derselben Handlung. Der Request ist damit Zeichen für Zeichen derselbe: gleicher Text,
  // gleiche Anweisung, gleiche Provenienz.
  const wiederholen = (): void => {
    if (letzteAktion === null) {
      return;
    }
    switch (letzteAktion.art) {
      case "laden":
        setErr(null);
        setReloadNonce((n) => n + 1);
        return;
      case "einreichen":
        requestSubmit();
        return;
      case "struktur":
        structure.mutate();
        return;
      case "assist":
        assist.mutate(letzteAktion.aktion);
        return;
      default:
        requestSave();
    }
  };

  useUnloadGuard(istSchmutzig);

  useEffect(() => {
    setGuard({
      isDirty: () => istSchmutzig,
      unsavableDirtyReasons: () => unsicherbareGruende,
      save: async () => {
        if (!hasSavableContent) {
          return;
        }
        guardSaveRef.current = true;
        try {
          await save.mutateAsync();
        } catch (e) {
          guardSaveRef.current = false;
          throw e;
        }
      },
    });
    return () => setGuard(null);
  }, [setGuard, istSchmutzig, unsicherbareGruende, hasSavableContent, save]);

  // ==============================================================================================
  // EINE LAGE, EIN SATZ (Zustandsmodell §9).
  // ==============================================================================================
  // Die Vordertür hatte fünf Kästen nebeneinander: KI-Fehler, Standkonflikt, Speicherfehler,
  // Abdruckkonflikt und die Feldvalidierung. Auf dem Blatt steht davon EINE Zeile — in der
  // Reihenfolge, in der der Mensch reagieren muss.
  //
  // ==============================================================================================
  // JOB 3062 R7 (bens Korrekturpflicht 2 / Auftrag §9) — DER KI-FEHLER STEHT IN DER KARTE.
  // ==============================================================================================
  //
  // §9 trennt die beiden Lagen ausdrücklich: „Fehler = EIN Satz unter den Knöpfen" gilt für den
  // Blattweg (Laden, Speichern, Einreichen) — für die KI heisst es „Fehler = ein Satz IN DER
  // VORSCHLAGSKARTE". Bis R6 lief der KI-Fehler in dieselbe Zeile unter den Knöpfen; er stand damit
  // weit weg von dem Menü, das ihn ausgelöst hat, und teilte sich den Wiederholweg mit dem
  // Speichern. Jetzt hat er seine eigene Karte, an der Stelle, an der sonst der Vorschlag steht —
  // mit dem Satz, warum nichts passiert ist, und mit dem Knopf, der genau diese Handlung wiederholt.
  //
  // BEIM KI-FEHLER GEHÖRT DER ZUSATZ DAZU: „Originaltext bleibt unverändert." ist die eigentliche
  // Auskunft (es ist NICHTS mit dem Text passiert), nicht Beiwerk. Ohne ihn läse sich ein
  // KI-Fehler wie ein Schaden am eigenen Absatz.
  const kiFehler = structureErr ?? assistErr;
  const kiFehlerSatz = kiFehler ? `${kiFehler} ${t("fd.originalUnchanged")}` : null;
  const blattFehler: string | null =
    (staleConflict ? t("fd.draftStale") : null) ?? err ?? restartOffer;

  // ---- Werkzeuge ------------------------------------------------------------------------------

  // ================================================================================================
  // JOB 3141 R2 (bens Korrekturpflicht 1) — `recRef.current` IST DIE GRENZE, NICHT `stop()`.
  // ================================================================================================
  //
  // BENS MESSUNG an Runde 1, wörtlich: „`stop()` kehrt zurück, Entwurf wird geladen, anschließend
  // trifft das abschließende Diktatergebnis ein" — Editorinhalt danach: „Vor jedem Anlauf die
  // Schmierstellen prüfen.BEN verspätetes Ergebnis aus dem alten Blatt". Ein fremder Satz IM
  // geladenen Entwurf, also schlimmer als der Verlust, den dieser Auftrag schliesst.
  //
  // WARUM `stop()` DAS NICHT LEISTEN KANN: Die Web-Speech-Spezifikation sagt zu `stop()` ausdrücklich
  // zu, dass die laufende Erkennung noch ZU ENDE GEFÜHRT und ihr Ergebnis noch gemeldet wird (§4.1.4;
  // `end` folgt danach, §4.1.5). `stop()` ist eine Bitte um Abschluss, keine Trennung. Runde 1 hat
  // eine Bitte für eine Zusage gehalten.
  //
  // DIE GRENZE IST DESHALB DIE IDENTITÄT: `recRef.current` ist der Rekorder, der das Blatt GERADE
  // FÜHRT. Beide Rückrufe fragen zuerst, ob sie das noch sind — der Ladeweg trennt die alte Sitzung,
  // indem er den Merker leert (`:619` ff.). Danach schreibt sie nichts mehr, gleich wie spät sie
  // kommt, und gleich ob das Laden gelingt oder scheitert.
  //
  // AUCH DAS ENDE FRAGT (`beendet`), und das ist genau der Absender, den `makeRec` seit JOB 3038 R3
  // mitgibt: Ein spät gemeldetes `end` der ALTEN Sitzung nähme einem inzwischen NEU gestarteten
  // Diktat sonst den Läuft-Zustand — der Stoppknopf verschwände, während das Mikrofon läuft. Der
  // Kommentar in `lib/speechDictation.ts:83-98` beschreibt genau diesen Fall; das Blatt liest den
  // Absender bis hierher nicht.
  const diktatUmschalten = (): void => {
    setOffenesMenue(null);
    if (diktatLaeuft) {
      // Der Mensch selbst hält an: hier wird NICHT getrennt, also NICHT `diktatVomBlattTrennen`.
      // Sein Abschlussergebnis gehört ihm und soll noch ankommen — das ist der Unterschied zu den
      // drei Wegen, die ihm den Rumpf WEGNEHMEN (Laden, einen anderen Entwurf öffnen, „Eingabe
      // verwerfen"). Dort wäre ein nachgeliefertes Ergebnis eine fremde Beimischung, hier ist es
      // das Ende seines eigenen Satzes.
      recRef.current?.stop();
      return;
    }
    const rec = makeRec(
      (text) => {
        if (recRef.current !== rec) {
          return;
        }
        setBodyHtml((prev) => diktatAnhaengen(prev, text));
      },
      (beendet) => {
        if (recRef.current !== beendet) {
          return;
        }
        setDiktatLaeuft(false);
      },
      diktatSprache(i18n.language),
    );
    if (!rec) {
      return;
    }
    recRef.current = rec;
    rec.start();
    setDiktatLaeuft(true);
  };

  // „Bild" führt in den EINEN Bildweg des Produkts — den des Editors (Rasterprüfung, Verankerung,
  // Beschreibungspflicht). Kein zweiter Einfügepfad: das Werkzeug löst den vorhandenen aus.
  const bildEinfuegen = (): void => {
    setOffenesMenue(null);
    const knopf = editorHuelleRef.current?.querySelector<HTMLButtonElement>(
      `button[title="${t("editor.image")}"]`,
    );
    knopf?.click();
  };

  // ================================================================================================
  // JOB 3256 (CAP-P1-R, Lieferungen 2-4) — ÖFFNEN NIMMT NICHTS MEHR OHNE ZUSTIMMUNG WEG.
  // ================================================================================================
  //
  // WAS HIER VORHER STAND und warum es ERSETZT und nicht umgangen ist: drei bedingungslose Zeilen
  // (Menü zu, Ansicht „blatt", `?draft=<id>`). Danach lief der Ladeeffekt und setzte Titel und
  // Rumpf auf den Serverstand — der eigene, ungesicherte Satz war wortlos weg. Drei Bildschirm-
  // seiten weiter unten fragt „Eingabe verwerfen" im GLEICHEN Menü bei genau demselben Verlust sehr
  // wohl nach. Dasselbe Blatt behandelte zwei gleichwertige Verluste ungleich.
  //
  // WARUM NICHT DER VORHANDENE WÄCHTER, gemessen statt vermutet:
  //   · `useUnloadGuard` (`app/NavGuardContext.tsx:115-127`) hängt allein am `beforeunload` des
  //     Browsers. Hier wird kein Dokument entladen, das Ereignis entsteht gar nicht.
  //   · Der Router-Wächter ist QUELLENBASIERT: `guard()` (`NavGuardContext.tsx:202-212`) wird nur
  //     von `useGuardedNavigate` und den beiden `Guarded…`-Verweisen gerufen (`:428-519`). Dieser
  //     Weg ruft keinen davon — er ändert über `useSearchParams` nur die Suchparameter.
  //   · Und selbst über den Zurück-Wächter griffe er nicht: `shouldBlock` (`:237-242`, „Kante 8")
  //     verlangt ausdrücklich einen PFADwechsel. Ein reiner Query-Wechsel auf derselben Route ist
  //     für ihn bewusst KEIN Wechsel — die Seite bleibt eingehängt, durch die Navigation selbst
  //     geht nichts verloren.
  // Alle drei Entscheidungen sind richtig und bleiben, wie sie sind (Auftrag §10): der Verlust
  // entsteht hier nicht durch den Ortswechsel, sondern durch den LADEEFFEKT, der auf den neuen
  // Parameter reagiert. Deshalb fragt der Auslöser — an derselben Stelle und in derselben Form wie
  // beim Verwerfen.
  //
  // GEFRAGT WIRD NUR, WENN ES ETWAS ZU VERLIEREN GIBT — an `istSchmutzig`, derselben einen
  // Ablesung, an der schon der Entlade- und der Routenwächter hängen (`useUnloadGuard(istSchmutzig)`
  // und `isDirty` weiter oben). Eine zweite Schmutzigkeitsrechnung entsteht hier nicht.
  //
  // BEWUSST NICHT `hasSavableContent` DAZU, obwohl der Verwerfen-Eintrag beide liest: dort geht es
  // um „gibt es überhaupt etwas zurückzusetzen", hier um „geht etwas verloren". `hasSavableContent`
  // ist auch bei einem GESPEICHERTEN, unveränderten Entwurf wahr (`isDraftUpdate`) — die Rückfrage
  // erschiene dann ausgerechnet auf dem häufigsten Weg, dem Blättern zwischen Entwürfen, und hätte
  // dort nichts zu melden. Am sauberen Blatt bleibt der Ein-Klick-Weg Zeichen für Zeichen erhalten.
  //
  // UND WENN DER MENSCH ZUSTIMMT, IST DER VERLUST SEINE ENTSCHEIDUNG — auch dann, wenn der
  // Ladeversuch gleich darauf scheitert (der `.catch`-Zweig des Ladeeffekts, etwa ohne Netz) und er
  // mit einem leeren Blatt dasteht. Die Rückfrage ist rein örtlich und braucht kein Netz; dass
  // danach nichts mehr da ist,
  // ist die bestätigte Folge seiner Zusage und kein stiller Verlust. Zusammengeführt wird nichts:
  // die Begründung dafür steht bei `blattNimmtAn` und gilt hier gleichlautend.
  const entwurfOeffnen = (entwurfId: string): void => {
    setOffenesMenue(null);
    if (istSchmutzig && !window.confirm(t("fd.confirmOpenDraft"))) {
      return;
    }
    // Lieferung 4: auch dieser Weg nimmt dem Blatt den Rumpf — also gilt für eine laufende
    // Diktatsitzung dieselbe Trennung wie im Ladeeffekt, und zwar VOR dem Adresswechsel.
    diktatVomBlattTrennen();
    setAnsicht("blatt");
    setSearchParams({ draft: entwurfId }, { replace: true });
  };

  // ==============================================================================================
  // JOB 3266 (D1) — DIE EINE HANDBEWEGUNG, DIE DIE ENTWURFSLISTE AUFKLAPPT.
  // ==============================================================================================
  // Drei Auslöser führen zu DERSELBEN Fläche: das benannte Werkzeug „Meine Entwürfe" der
  // Werkzeugzeile, der Weg in der Bestätigungszeile nach dem Sichern (JOB 3106) und die Adresse
  // `?entwuerfe=1`, mit der die Startseite hierher führt. Sie stehen deshalb nicht dreimal
  // nebeneinander: eine zweite Auffassung davon, was „Entwürfe zeigen" heisst, wäre genau die
  // Drift, an der die Fläche später auseinanderliefe.
  //
  // SIE ÖFFNET NUR — sie lädt nichts, sie setzt keine Kennung, sie fasst den Blattinhalt nicht an.
  // Das Öffnen eines Entwurfs bleibt `entwurfOeffnen` oben, der eine Weg über die Adresse.
  const entwuerfeAufklappen = useCallback((): void => {
    setOffenesMenue("mehr");
    setMehrFlaeche("entwuerfe");
  }, []);

  // ==============================================================================================
  // JOB 3266 (D1) — VON DER STARTSEITE HIERHER, MIT OFFENER LISTE.
  // ==============================================================================================
  // PEDIS BEFUND (Vorführung 07.09.): Der gespeicherte Entwurf war beim späteren Besuch nicht zu
  // finden. Die Startseite trägt seit diesem Auftrag den benannten Zugang „Meine Entwürfe"; er
  // führt auf `/erfassen?entwuerfe=1`, und dieses Zeichen ist der Öffnungsbefehl für die Liste.
  //
  // WARUM EIN ADRESSZEICHEN UND KEINE ZWEITE LISTE AUF START: Die Titel, ihr Pool, der
  // Eigentumsfilter des Servers und der Weg ins Blatt liegen HIER. Eine zweite Liste auf der
  // Startseite wäre ein zweiter Abruf, ein zweiter Leerzustand und ein zweiter Öffnungsweg —
  // dreimal dieselbe Zusage, die auseinanderlaufen kann.
  //
  // EINMAL, NICHT BEI JEDEM BILDAUFBAU: Der Merker hält fest, dass dieser Aufbau den Befehl schon
  // ausgeführt hat. Ohne ihn klappte die Liste bei jedem Zustandswechsel wieder auf und der Mensch
  // könnte sie nicht schliessen. Die Adresse selbst bleibt stehen: sie beschreibt, womit diese
  // Seite geöffnet wurde, und ein „Zurück" darauf tut wieder dasselbe.
  const entwuerfeBefehlRef = useRef(false);
  const entwuerfeBefehl = searchParams.get("entwuerfe") === "1";
  useEffect(() => {
    if (!entwuerfeBefehl || entwuerfeBefehlRef.current) {
      return;
    }
    entwuerfeBefehlRef.current = true;
    entwuerfeAufklappen();
  }, [entwuerfeBefehl, entwuerfeAufklappen]);

  // Was das Titel-Menü zu bieten hat: die vier Starter nur am wirklich leeren Blatt (so misst es
  // `h3-funktionsinventar.test.ts`: genau vier Einträge), den Vorschlag, sobald es einen gibt.
  const starterZeigen = !title && !hasBody;
  const titelMenueHatEtwas = starterZeigen || titelVorschlag !== null;

  const arbeitsraumOeffnen = (modus: ArbeitsraumModus): void => {
    setOffenesMenue(null);
    setAnsicht(modus);
  };

  // ---- Werkzeugzeile ---------------------------------------------------------------------------

  const werkzeugzeile = (
    <div
      data-testid="blatt-werkzeugzeile"
      // `flex-wrap`, KEIN zweiter Abstand: Die Zeile trägt bei 1280 px alle Werkzeuge nebeneinander
      // (so misst sie `tests/design/zielbild-h3-erfassen.test.ts` V17 gegen das Mockup, gap 22 px in
      // beide Richtungen). Bei 390 px ist die Summe ihrer Werkzeuge breiter als das Fenster; ohne
      // Umbruch schöben sie waagerecht über den Rand hinaus — genau der Überlauf, den
      // `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` (Fall 5) bei 390×844 und 768×1024 misst.
      // Ein Pages-Werkzeugkasten bricht um, er schiebt nicht.
      className="flex flex-wrap items-center gap-[22px] px-1"
      // Ein Klick in die Zeile schließt kein Menü — das erledigt der Hörer in `Menue`.
    >
      {/* ============================================================================================
          JOB 3062 · NACHZUG 1 — DIESELBEN HILFETEXTE AUCH IN DER SEITENHILFE DER HÜLLE.
          ============================================================================================
          JOB 3060 (H1) hat parallel zu diesem Auftrag den `HelpTip` umgebaut: er rendert nichts mehr,
          sondern meldet Titel und Text bei `shell/SeitenhilfeContext` an, und das Zahnrad-Menü zeigt
          sie unter „Seitenhilfe" für die aktuelle Seite. Sein Inventar (`tests/design/h1-funktions-
          inventar.test.ts`, Zeile Z-helptips) nennt „Erfassen 33" ausdrücklich — und stand nach dem
          Umbau dieser Fläche auf /erfassen leer da, weil hier kein `HelpTip` mehr montiert ist.

          KEINE ZWEITE FLÄCHE UND KEIN ZWEITER TEXTBESTAND: gemeldet wird genau das Register
          `BLATT_HILFE_THEMEN` aus `./hilfe.ts`, dasselbe, das auch das „?"-Werkzeug rechts zeigt
          (Auftrag §5a: „Alle 33 Hilfe-Tipps … → „?"-Menü der Seite"). Eine Quelle, zwei Türen —
          die des Blattes und die der Hülle. `HelpTip` rendert `null`; im Sichtfeld ändert sich nichts,
          der Textmesser bleibt bei seinen 4 Zeichen. */}
      {BLATT_HILFE_THEMEN.map((thema) => (
        <HelpTip key={thema.id} title={t(thema.titleKey)} body={t(thema.bodyKey)} />
      ))}
      <button
        type="button"
        data-testid="blatt-werkzeug-diktieren"
        // JOB 3141 (CAP-P1): dieselbe eine Regel. Diktiertes reist über `setBodyHtml` in den Rumpf —
        // es wäre der eine Eingabeweg, der die fehlende Schreibfläche umginge.
        disabled={!diktatMoeglich || !blattNimmtAn}
        title={
          diktatMoeglich
            ? blattNimmtAn
              ? undefined
              : t("erfassen.laden.nichtBereit")
            : t("capture.diktatUnsupported")
        }
        onClick={diktatUmschalten}
        className={`inline-flex items-center gap-1.5 text-[13px] ${
          !diktatMoeglich || !blattNimmtAn
            ? "text-muted-2 opacity-50"
            : diktatLaeuft
              ? "font-semibold text-text"
              : "text-muted-2 hover:text-text"
        }`}
      >
        <SymbolMikrofon />
        {t("erfassen.werkzeug.diktieren")}
      </button>

      <button
        type="button"
        data-testid="blatt-werkzeug-bild"
        // JOB 3141 (CAP-P1): dieselbe eine Regel. „Bild" löst den Einfügeknopf IM Editor aus
        // (`bildEinfuegen`); ohne montierten Editor fände der Griff ins Leere und der Knopf täte
        // wortlos nichts — eine Scheinfläche. Gesperrt sagt er, dass er gerade nicht kann.
        disabled={!blattNimmtAn}
        title={blattNimmtAn ? undefined : t("erfassen.laden.nichtBereit")}
        onClick={bildEinfuegen}
        className={`inline-flex items-center gap-1.5 text-[13px] ${
          blattNimmtAn ? "text-muted-2 hover:text-text" : "text-muted-2 opacity-50"
        }`}
      >
        <SymbolBild />
        {t("erfassen.werkzeug.bild")}
      </button>

      <Menue
        name="datei"
        offen={offenesMenue}
        setOffen={setOffenesMenue}
        wort={t("erfassen.werkzeug.datei")}
        symbol={<SymbolDatei />}
      >
        {/* Die drei Wege kommen aus `./wege.ts` und stehen hier nicht ein zweites Mal: ein neuer
            Erzählweg erscheint ohne Nacharbeit im Menü. */}
        {BLATT_WEGE.map((weg) => (
          <MenueEintrag key={weg} onClick={() => arbeitsraumOeffnen(weg as ArbeitsraumModus)}>
            {t(blattWegLabelKey(weg))}
          </MenueEintrag>
        ))}
      </Menue>

      <Menue
        name="ki"
        offen={offenesMenue}
        setOffen={setOffenesMenue}
        wort={t("erfassen.werkzeug.ki")}
        symbol={<SymbolKi />}
        gesperrt={structure.isPending || assist.isPending}
      >
        <MenueEintrag
          gesperrt={!canStructure}
          onClick={() => {
            setOffenesMenue(null);
            structure.mutate();
          }}
        >
          {t("erfassen.ki.struktur")}
        </MenueEintrag>
        <MenueTrenner />
        {ASSIST_ACTIONS.map((action) => (
          <MenueEintrag
            key={action}
            gesperrt={!canAssist}
            onClick={() => {
              setOffenesMenue(null);
              assist.mutate(action);
            }}
          >
            {t(assistActionLabelKey(action))}
          </MenueEintrag>
        ))}
      </Menue>

      {/* Auch die rechte Hälfte bricht um, statt zu schieben — sie ist bei 390 px für sich allein
          schon breiter als das Fenster. */}
      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <Menue
          name="bereich"
          offen={offenesMenue}
          setOffen={setOffenesMenue}
          wort={kategorie || t("erfassen.werkzeug.bereich")}
          gerahmt
        >
          {kos.isLoading ? (
            <MenueEintrag gesperrt onClick={() => undefined}>
              {t("state.loading")}
            </MenueEintrag>
          ) : null}
          {bereiche.map((wert) => (
            <MenueEintrag
              key={wert}
              gewaehlt={wert === kategorie}
              onClick={() => {
                changeKategorie(wert);
                setOffenesMenue(null);
              }}
            >
              {wert}
            </MenueEintrag>
          ))}
          {kategorie ? (
            <>
              <MenueTrenner />
              <MenueEintrag
                onClick={() => {
                  changeKategorie("");
                  setOffenesMenue(null);
                }}
              >
                {t("erfassen.bereich.leeren")}
              </MenueEintrag>
            </>
          ) : null}
        </Menue>

        <div ref={vertraulichkeitRef} className="max-w-full">
          <Menue
            name="vertraulichkeit"
            offen={offenesMenue}
            setOffen={setOffenesMenue}
            wort={
              declaredConfidentiality
                ? t(`conf.level.${declaredConfidentiality}`)
                : t("erfassen.werkzeug.vertraulichkeit")
            }
            gerahmt
            markiert={vertraulichkeitHinweisSteht}
            // JOB 3114 (UX-05): Der Verweis steht nur, SOLANGE der Satz steht — sonst zeigte
            // `aria-describedby` auf eine `id`, die es im Dokument nicht gibt.
            beschriebenVon={
              vertraulichkeitHinweisSteht ? BLATT_VERTRAULICHKEIT_HINWEIS_ID : undefined
            }
            ungueltig={vertraulichkeitHinweisSteht}
          >
            {CONFIDENTIALITY_LEVELS.map((lvl) => (
              <MenueEintrag
                key={lvl}
                gewaehlt={lvl === declaredConfidentiality}
                onClick={() => {
                  setConfidentiality(lvl);
                  // Eine bewusste Auswahl IST eine Deklaration — ab hier gilt sie auch für den
                  // Egress. Und sie ist zugleich die Wahl selbst: seit JOB 3082 gibt es keine
                  // zweite Flagge daneben, die „gewählt" auch ohne Wert behaupten könnte.
                  setDeclaredConfidentiality(lvl);
                  setVertraulichkeitMarkiert(false);
                  setOffenesMenue(null);
                }}
              >
                {t(`conf.level.${lvl}`)}
              </MenueEintrag>
            ))}
          </Menue>
          {/* ======================================================================================
              JOB 3114 (UX-05, Befund N-0017) — DER SATZ AM FELD, NICHT NUR DIE FARBE.
              ======================================================================================
              Er steht UNTER dem Menü und damit in derselben Hülle, auf die `vertraulichkeitRef`
              zeigt: Die Fokuszeile in `requestSubmit` sucht dort das ERSTE `<button>` — das ist
              weiterhin der Menüknopf, denn der Satz ist ein `<span>` und steht dahinter.

              `role="alert"` und nicht bloß Text: Der Fokussprung allein kündigt nichts an; ohne
              Live-Region liest ein Screenreader den Satz erst, wenn jemand ihn zufällig ansteuert.
              Genau das hat Codex gemessen — „status/alert sind leer".

              `max-w` und Umbruch, damit die Werkzeugzeile bei 320 px umbricht statt zu schieben
              (dieselbe Regel wie `flex-wrap` an der Zeile selbst). */}
          {vertraulichkeitHinweisSteht ? (
            <span
              id={BLATT_VERTRAULICHKEIT_HINWEIS_ID}
              role="alert"
              data-testid="blatt-vertraulichkeit-hinweis"
              className="mt-1 block max-w-[260px] break-words text-[12px] leading-snug text-trust-crit-text"
            >
              {t("conf.requiredHint")}
            </span>
          ) : null}
        </div>

        {/* ==========================================================================================
            DAS „…"-MENÜ — ZWEI EBENEN WIE IN PAGES.
            ==========================================================================================
            Erste Ebene: die fünf Orte als Liste. Zweite Ebene: die gewählte FLÄCHE im selben Menü,
            mit einem Rückweg nach oben.

            WARUM NICHT FÜNF MENÜS NEBENEINANDER (der erste Bauversuch dieses Auftrags): Dann trüge
            die Werkzeugzeile fünf zusätzliche gerahmte Knöpfe — „Entwürfe · Anhänge · Status ·
            Beispiel · Klara" — und wäre genau das Gegenteil dessen, was Pedi verlangt hat. Ein
            Untermenü hat EINEN Zugang; was dahinter liegt, liegt DAHINTER. */}
        {/* ==========================================================================================
            JOB 3266 (D1) — DER DAUERHAFTE, BENANNTE ZUGANG ZU DEN EIGENEN ENTWÜRFEN.
            ==========================================================================================
            PEDI, Vorführung 07.09.: Er hatte ein Dokument importiert und als Entwurf gesichert —
            und fand es beim nächsten Besuch nicht wieder. Der Weg gab es (im „…"-Menü), aber er
            trug kein Wort: ein Symbolknopf, hinter dem sich fünf Flächen verbergen.

            DIESES WERKZEUG IST DAS WORT DAZU. Es steht IMMER da — nicht nur nach einer Sicherung
            wie die Bestätigungszeile unten (JOB 3106), die ihren Weg nur so lange nennt, wie
            gerade etwas gesichert wurde. Wer den Zugang braucht, hat in aller Regel NICHTS gerade
            gesichert; er kommt neu auf die Seite.

            ES ÖFFNET DIE VORHANDENE FLÄCHE, ES BAUT KEINE ZWEITE: derselbe Aufruf wie die
            Bestätigungszeile (`entwuerfeAufklappen`), dieselbe Liste im „…"-Menü daneben. Ein
            zweiter Ort für dieselben Titel wäre ein zweiter Zustand — und der wäre irgendwann der
            falsche. */}
        <button
          type="button"
          data-testid="blatt-werkzeug-entwuerfe"
          onClick={entwuerfeAufklappen}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-2 hover:text-text"
        >
          {t("fd.saved.toDrafts")}
        </button>

        <Menue
          name="mehr"
          offen={offenesMenue}
          setOffen={(name) => {
            setOffenesMenue(name);
            if (name === null) {
              setMehrFlaeche(null);
            }
          }}
          wort=""
          // JOB 3266 (D1): Der Knopf trägt nur ein Symbol — sein NAME steht deshalb hier, übersetzt
          // (DE „Mehr", EN „More"). Bis hierher meldete ein Screenreader eine namenlose
          // Schaltfläche, und Pedi las auf der Fläche nichts, was ihm sagte, was dahinter liegt.
          beschriftung={t("erfassen.werkzeug.mehr")}
          symbol={<SymbolMehr />}
          gerahmt
        >
          {mehrFlaeche === null ? (
            <>
              <MenueEintrag onClick={() => setMehrFlaeche("entwuerfe")}>
                {t("erfassen.mehr.entwuerfe")}
              </MenueEintrag>
              <MenueEintrag onClick={() => setMehrFlaeche("anhaenge")}>
                {t("erfassen.mehr.anhaenge")}
              </MenueEintrag>
              <MenueEintrag onClick={() => setMehrFlaeche("status")}>
                {t("erfassen.mehr.status")}
              </MenueEintrag>
              <MenueEintrag onClick={() => setMehrFlaeche("beispiel")}>
                {t("erfassen.mehr.beispiel")}
              </MenueEintrag>
              <MenueTrenner />
              <MenueEintrag onClick={() => setMehrFlaeche("klara")}>
                {t("erfassen.mehr.klara")}
              </MenueEintrag>
              {/* Der Knopf „Eingabe verwerfen" der Vordertür. Er bleibt ein BEWUSSTER Schritt mit
                  Rückfrage — nur seine Prominenz auf der Fläche ist weg (Auftrag §5a: „Zurück"
                  wandert ins Menü). */}
              <MenueEintrag
                gesperrt={!istSchmutzig && !hasSavableContent}
                onClick={() => {
                  setOffenesMenue(null);
                  if (window.confirm(t("fd.confirmDiscard"))) {
                    // JOB 3256 (CAP-P1-R, Lieferung 5): ERST TRENNEN, DANN LEEREN. `resetForNewEntry`
                    // räumt den Rumpf; eine laufende Diktatsitzung schrieb bis dahin gleich wieder
                    // hinein — auf einem Blatt OHNE `?draft` läuft der Ladeeffekt nicht, es gab hier
                    // also gar keine Trennung. Dieselbe eine Funktion wie dort.
                    diktatVomBlattTrennen();
                    resetForNewEntry();
                  }
                }}
              >
                {t("fd.discardInput")}
              </MenueEintrag>
            </>
          ) : (
            <>
              <MenueEintrag onClick={() => setMehrFlaeche(null)}>
                {`\u2039 ${t("erfassen.mehr.zurueck")}`}
              </MenueEintrag>
              <MenueTrenner />
              {mehrFlaeche === "entwuerfe" ? (
                <MenueFlaeche>
                  {/* Auftrag §5: Das Banner „Vordertür-Entwurf geöffnet" stand als Kasten auf der
                      Fläche. Es verschwindet von dort, aber NICHT aus dem Produkt — es wird diese
                      eine Zeile unter „Entwürfe". Sie sagt dem Menschen, was die fette Zeile in
                      der Liste darunter bedeutet: er schreibt in einen bestehenden Entwurf, nicht
                      in ein neues Blatt. Ohne sie wäre die Hervorhebung eine Auszeichnung ohne
                      Auskunft. Sie steht nur, wenn wirklich ein Entwurf offen ist. */}
                  {activeDraftId ? (
                    <p
                      data-testid="blatt-entwurf-offen"
                      className="px-2 py-1 text-[12.5px] text-muted"
                    >
                      {t("fd.draftOpen")}
                    </p>
                  ) : null}
                  {/* JOB 3266 (D1): Die drei Lagen tragen je einen eigenen Anker und ihren eigenen
                      Satz — „lädt", „leer" und „gestört" sind drei verschiedene Auskünfte und
                      dürfen nicht als dieselbe stille Fläche enden. Ein Fehler zeigt zusätzlich
                      seinen Rückweg: ohne ihn wäre die Liste nach einem Netzabriss eine
                      Sackgasse. */}
                  {drafts.isLoading ? (
                    <p data-testid="blatt-entwuerfe-laedt" className="text-[12.5px] text-muted">
                      {t("state.loading")}
                    </p>
                  ) : null}
                  {drafts.isError ? (
                    <p data-testid="blatt-entwuerfe-fehler" className="text-[12.5px] text-muted">
                      {t("state.error")}
                      <button
                        type="button"
                        data-testid="blatt-entwuerfe-erneut"
                        onClick={() => {
                          void drafts.refetch();
                        }}
                        className="ml-2 font-semibold underline"
                      >
                        {t("erfassen.erneutVersuchen")}
                      </button>
                    </p>
                  ) : null}
                  {(drafts.data ?? []).length === 0 && !drafts.isLoading && !drafts.isError ? (
                    <p data-testid="blatt-entwuerfe-leer" className="text-[12.5px] text-muted">
                      {t("erfassen.entwuerfe.keine")}
                    </p>
                  ) : null}
                  {(drafts.data ?? []).map((d) => {
                    // Einmal gelesen, einmal entschieden: ob das Datum steht und was dort steht,
                    // ist dieselbe Frage — zwei Aufrufe wären zwei Antworten auf sie.
                    const datum = formatKoTimestamp(d.updatedAt, i18n.language);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        data-testid="blatt-entwurf-eintrag"
                        // WELCHEN Entwurf diese Zeile öffnet, steht an ihr selbst — dieselbe Kennung,
                        // die gleich in die Adresse geht. Ohne sie liesse sich „der Titel öffnet
                        // GENAU diesen Entwurf" nur behaupten, nicht messen.
                        data-entwurf={d.id}
                        // JOB 3256 (CAP-P1-R, Zustandsmodell §9 „laden"): dieselbe eine Regel wie am
                        // Diktat- und am Bild-Werkzeug. Während geladen wird, gibt es hier nichts
                        // Ungesichertes zu retten (`blattNimmtAn` ist falsch) — ein Klick würde also
                        // ohne Rückfrage ein ZWEITES Laden anstoßen, während das erste noch läuft.
                        // Gesperrt sagt der Eintrag, dass er gerade nicht kann, statt es wortlos zu
                        // tun; den Grund nennt er im selben Satz wie das Blatt darüber.
                        disabled={!blattNimmtAn}
                        title={blattNimmtAn ? undefined : t("erfassen.laden.nichtBereit")}
                        onClick={() => entwurfOeffnen(d.id)}
                        className={`block w-full rounded-[7px] px-2 py-1.5 text-left text-[13px] ${
                          blattNimmtAn ? "hover:bg-hairline-soft" : "opacity-50"
                        } ${d.id === activeDraftId ? "font-semibold text-text" : "text-text"}`}
                      >
                        {/* ==========================================================================
                            JOB 3266 R3 (bens Korrekturpflicht 2) — DER TITEL STEHT GANZ DA.
                            ==========================================================================
                            Hier stand `truncate` (`white-space: nowrap`, `overflow: hidden`,
                            `text-overflow: ellipsis`). Bens Messung: 506 px Text auf 262 px Fläche
                            bei 320 px Fenster — der Titel brach mit Auslassungspunkten ab, und zwar
                            AM ENDE. Genau dort stehen aber die Wörter, die zwei Entwürfe desselben
                            Vorhabens unterscheiden („… Ausgabe Nord 2026" gegen „… Süd 2026"). Eine
                            Liste, in der zwei Zeilen gleich aussehen, ist keine Auswahl.

                            `break-words` (`overflow-wrap: break-word`) statt einer festen Zeile: Der
                            Titel bricht wie gewöhnlicher Text um, und ein einzelnes überlanges Wort
                            (eine Kennung, ein Dateiname ohne Leerzeichen) bricht innerhalb statt
                            über den Rand hinauszuschieben. Die Höhe darf wachsen — die Liste ist
                            genau dafür rollbar (`MenueFlaeche`, `max-h-[420px] overflow-auto`).

                            Der Anker `…-eintrag-titel` ist der Messpunkt des Lesbarkeitsmessers
                            (`tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`): er vergleicht
                            `scrollWidth`/`scrollHeight` gegen die sichtbare Fläche. Ohne benannten
                            Knoten müsste der Messer raten, welches Kind der Titel ist. */}
                        <span
                          data-testid="blatt-entwurf-eintrag-titel"
                          className="block break-words"
                        >
                          {d.payload.title || fallbackTitle}
                        </span>
                        {/* JOB 3266 (D1), Lieferung 3: das DATUM neben dem Titel — bei mehreren
                          Entwürfen desselben Vorhabens ist der Titel allein nicht unterscheidbar.
                          Es ist der Stand, den der Server führt (`updatedAt`), gelesen mit
                          derselben Funktion wie jedes andere Datum der Oberfläche. Fehlt oder
                          bricht der Wert, steht KEINE Zeile da statt eines erfundenen Datums —
                          das ist die Zusage von `formatKoTimestamp` selbst. */}
                        {datum ? (
                          <span
                            data-testid="blatt-entwurf-eintrag-datum"
                            className="mt-0.5 block text-[11.5px] font-normal text-muted"
                          >
                            {datum}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </MenueFlaeche>
              ) : null}
              {mehrFlaeche === "anhaenge" ? (
                <MenueFlaeche>
                  <AnhangListe bodyHtml={bodyHtml} />
                  {/* Das Hochladen und Verwalten von Anhängen lebt unverändert im Arbeitsraum
                      (Belegprüfung, Grenzen, Ankerbindung). Dieser Eintrag führt dorthin, statt
                      einen zweiten Uploadweg zu bauen. */}
                  <button
                    type="button"
                    onClick={() => arbeitsraumOeffnen("formular")}
                    className="mt-1 block w-full rounded-[7px] px-2 py-1.5 text-left text-[13px] font-semibold text-text hover:bg-hairline-soft"
                  >
                    {t("erfassen.anhaenge.verwalten")}
                  </button>
                </MenueFlaeche>
              ) : null}
              {mehrFlaeche === "status" ? (
                <MenueFlaeche>
                  <dl className="space-y-2 text-[13px]">
                    <div>
                      <dt className="text-[12px] text-muted">{t("fd.titleOnSave")}</dt>
                      <dd className="mt-0.5 font-semibold text-text">{derivedTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">{t("fd.author")}</dt>
                      <dd className="mt-0.5 text-text">{authorName}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">{t("fd.whatOnSave")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-text">{t("fd.whatOnSaveBody")}</dd>
                    </div>
                    {/* JOB 3062 R6 (bens Befund 4 / Auftrag §5a): DIE QUELLENZEILE.
                        Der Struktur-Chip „Vermutete Quelle" aus dem Intake hatte laut Inventar hier
                        seinen Ort — und stand bis R5 nirgends. Die Ableitung ist DIESELBE Funktion
                        wie im Intake (`deriveIntakeSuggestion`, Kommentar dort: „die vermutete
                        Quelle ist die erfassende Person"), nicht eine zweite Regel neben ihr; auch
                        die Beschriftung ist der Intake-Schlüssel. */}
                    <div>
                      <dt className="text-[12px] text-muted">{t("intake.structure.source")}</dt>
                      <dd data-testid="blatt-status-quelle" className="mt-0.5 text-text">
                        {quellenVorschlag}
                      </dd>
                    </div>
                    {/* Und die LEISE Hälfte der Live-Prüfung: `pending` (nicht geprüft, z. B. ohne
                        Modell) und `unavailable` (Prüfung nicht erreichbar) bekommen keinen Chip auf
                        der Fläche, verschwinden aber auch nicht. Wer wissen will, woran er ist,
                        findet es hier — mit den Worten der bestehenden Live-Zone, nicht mit neuen. */}
                    {verdict.status === "pending" || verdict.status === "unavailable" ? (
                      <div>
                        <dt className="text-[12px] text-muted">
                          {t("erfassen.status.livePruefung")}
                        </dt>
                        <dd data-testid="blatt-status-livepruefung" className="mt-0.5 text-text">
                          {verdict.status === "pending"
                            ? t("intake.live.pending")
                            : t("intake.live.unavailable")}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-[12px] text-muted">{t("chelp.savedNext.title")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-text">{t("capture.savedBody")}</dd>
                    </div>
                  </dl>
                </MenueFlaeche>
              ) : null}
              {mehrFlaeche === "beispiel" ? (
                <MenueFlaeche>
                  {/* JOB 1118 · D-036 (A4) GILT HIER WEITER. „Im Bestand liegt noch kein passendes
                      Beispiel" ist eine TATSACHENAUSSAGE über den Bestand; sie setzt voraus, dass
                      der Bestand geladen ist. `pickExampleKo` liefert auch beim Laden `null` —
                      ohne diese Unterscheidung sähe ein wartender Mensch denselben Satz wie bei
                      einem wirklich leeren Bestand. Erst laden, dann behaupten; scheitert es,
                      steht der Fehler da und nicht die Leerbehauptung. */}
                  {kos.isPending ? (
                    <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
                  ) : kos.isError ? (
                    <p className="text-[12.5px] text-muted">{t("state.error")}</p>
                  ) : beispiel ? (
                    <>
                      <p className="text-[13px] font-semibold text-text">{beispiel.title}</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                        {beispiel.statement}
                      </p>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-muted">{t("erfassen.beispiel.keins")}</p>
                  )}
                </MenueFlaeche>
              ) : null}
              {mehrFlaeche === "klara" ? (
                <MenueFlaeche>
                  {/* Der Klara-Teaser hatte auf der Fläche einen eigenen Kasten
                      (`Capture.tsx:3592`). Sein Inhalt lebt hier weiter — dieselben Schlüssel,
                      kein zweiter Textbestand. */}
                  <p className="text-[13px] font-semibold text-text">
                    {t("klara.path.capture.title")}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                    {t("klara.path.capture.body")}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                    {t("klara.path.m365.body")}
                  </p>
                </MenueFlaeche>
              ) : null}
            </>
          )}
        </Menue>

        <Menue
          name="hilfe"
          offen={offenesMenue}
          setOffen={setOffenesMenue}
          wort={t("erfassen.werkzeug.hilfe")}
          symbol={<SymbolHilfe />}
          pruefname="blatt-werkzeug-hilfe"
        >
          <MenueFlaeche>
            {/* ======================================================================================
                §5 — DIE HILFE-TEXTE ALLER `HelpTip`s, AN EINEM ORT, NIE AUF DER FLÄCHE.
                ======================================================================================
                JOB 3062 R7 (bens Korrekturpflicht 1): Bis R6 stand hier NUR die Hilfekarte
                `lib/captureHelp.ts` — 23 Themen. Am Basisstand tragen aber acht `HelpTip`s ihre
                Schlüssel unmittelbar am Aufruf (`capture.help.category.*` und sieben weitere); sie
                waren nach dem Umbau nirgends mehr erreichbar. Das Register in `./hilfe.ts` führt
                jetzt BEIDE Herkünfte zusammen, und der Inventartest fährt jede einzelne Kennung des
                Basisstandes hier nach. Kein abgeschriebener Wortlaut: jedes Thema nennt seinen
                i18n-Schlüssel, keinen Text. */}
            {BLATT_HILFE_THEMEN.map((thema) => (
              <details
                key={thema.id}
                data-testid={`blatt-hilfe-${thema.id}`}
                className="border-b border-hairline last:border-b-0"
              >
                <summary className="cursor-pointer py-1.5 text-[13px] font-semibold text-text">
                  {t(thema.titleKey)}
                </summary>
                <p className="pb-2 text-[12.5px] leading-relaxed text-muted">{t(thema.bodyKey)}</p>
              </details>
            ))}
          </MenueFlaeche>
        </Menue>
      </div>
    </div>
  );

  // ---- Der Arbeitsraum als Blatt-Ansicht -------------------------------------------------------
  if (ansicht !== "blatt") {
    return (
      <div className="mx-auto flex w-[820px] max-w-full flex-col gap-3.5 pt-6">
        {werkzeugzeile}
        <div
          data-testid="blatt-arbeitsraum"
          className="min-h-[60vh] flex-grow rounded-t-[14px] border border-hairline bg-surface px-9 py-8 shadow-tile"
        >
          {arbeitsraum({
            modus: ansicht,
            onEntwurfInsBlatt: entwurfOeffnen,
          })}
        </div>
      </div>
    );
  }

  // ---- Das Blatt --------------------------------------------------------------------------------
  return (
    <ImageDescribeProvider
      provenance={draftProvenance(declaredConfidentiality, undefined, activeDraftId ?? undefined)}
    >
      {/* ============================================================================================
          JOB 3062 R6 (bens Korrekturpflicht 3) — DIE ZWEI SÄTZE, DIE DER EDITOR MITBRINGT.
          ============================================================================================

          BEFUND: Der Textmesser der Runde 5 nahm `[data-testid="blatt-text"]` PAUSCHAL aus der
          Messung und erlaubte die Editor-Prosa danach in einer Ausnahmeliste. Das war ein Freibrief
          für genau die Sätze, die auf dem Blatt stehen bleiben sollten — und ben hat ihn zu Recht
          kassiert. Gemessen wird ab R6 die GANZE Fläche; ausgenommen bleiben nur Bedienelemente und
          der Text, den der Mensch selbst geschrieben hat.

          DAMIT DAS EHRLICH GEHT, MÜSSEN DIE SÄTZE WIRKLICH WEG. Es sind zwei, und beide gehören dem
          `RichTextEditor`, dessen Datei NICHT in den ZIELPFADEN dieses Auftrags liegt:

            1. DIE TITELZEILE über dem Schreibfeld (JOB 2954 D3) — eine gerahmte Karte mit
               Beschriftung, Herkunftssatz und im Normalfall dem Satz „Aus diesem Bild ließ sich kein
               Titel ableiten". Ihre FUNKTION ist nicht verschwunden, sie ist UMGEZOGEN: das
               Titel-Menü des Blattes bietet denselben Vorschlag aus derselben Rangfolge an
               (`titelVorschlag`, oben). Das hier ist die zweite Hälfte desselben Umzugs — ohne sie
               stünde die Karte doppelt da.
            2. DER ABLAGEHINWEIS „Bilder hierher ziehen oder einfügen" in der Fußzeile des Editors.
               Sein TEXT ist nicht gelöscht: er steht als eigener Eintrag im „?"-Menü, mit DEMSELBEN
               i18n-Schlüssel — der Ort, an den §5 alle Erklärtexte verweist.

          WAS AUSDRÜCKLICH STEHEN BLEIBT: `editor-anchor-notice` in derselben Fußzeile. Das ist keine
          Erklärung, sondern eine MELDUNG über einen konkreten Vorfall („zu diesem Bild liess sich
          kein Anker herstellen", AUFTRAG-mega88 Block C). Sie zu verstecken hiesse, einen stillen
          Ausfall wiederherzustellen. Deshalb trifft die zweite Regel `> p` und nicht die Fußzeile —
          die Meldung ist ein `div` und bleibt sichtbar.

          DIE SELEKTOREN SIND AM GEBAUTEN DOM ABGELESEN, nicht geraten: Die Titelkarte ist der
          Eltern-`div` von `caption-form-title-none` bzw. `caption-form-title-suggestion`; die
          Fußzeile ist der LETZTE Kindknoten der Editor-Wurzel (davor: die versteckten Dateifelder,
          die Werkzeugleiste, die Titelkarte, die Schreibfeld-Hülle). Ausdrücklich NICHT
          `[role=textbox] + div`: dieser Geschwisterknoten ist der PLATZHALTER des Schreibfeldes,
          und ihn zu treffen hätte „Text" von der leeren Seite genommen.

          WARUM EIN STYLESHEET UND KEINE TAILWIND-VARIANTE: Die Titelkarte trägt selbst keinen Anker;
          erreichbar ist sie nur über `:has()` an ihrem Kind. Das als Tailwind-Klasse zu schreiben
          wäre eine unlesbare Zeichenkette — hier steht es als CSS, das man lesen kann. */}
      <style>{BLATT_EDITOR_CSS}</style>
      <div
        data-testid="blatt-huelle"
        className="relative mx-auto flex w-[820px] max-w-full flex-col gap-3.5 pt-6"
      >
        {/* ==========================================================================================
            JOB 3062 R6 (bens Befund 3) — DER DEMO-PFAD ERREICHT DAS BLATT WIEDER.
            ==========================================================================================
            SCRUM-296 hatte das Banner auf der Erfassungsseite; seit R5 rendert `/erfassen` aber das
            BLATT, und das Banner lag im alten Arbeitsraum, den diese Adresse nicht mehr betritt.
            `/erfassen?demo=stage1` zeigte deshalb NICHTS — ein stiller Verlust genau auf dem Weg,
            den eine Vorführung geht. Die Bedingung ist unverändert `isDemoContext` (ein Ort, eine
            Regel), das Bauteil unverändert `DemoBanner`: ohne `?demo=` bleibt die Fläche leer, und
            der Textmesser misst weiterhin das ruhende Blatt. */}
        {isDemoContext(searchParams) ? <DemoBanner surface="capture" /> : null}
        {werkzeugzeile}

        <div
          data-testid="blatt"
          // `px-6 sm:px-[72px]`: 72 px sind der Mockup-Wert und gelten ab 640 px Fensterbreite —
          // dort misst `zielbild-h3-erfassen.test.ts` V13 (1280×800). Auf einem 390-px-Telefon
          // blieben von 390 px abzüglich 2 × 72 px nur 246 px für Titel, Text und Editorleiste; das
          // Blatt wäre dann Rand statt Blatt. Ein Pages-Blatt behält seinen Rand nicht um jeden Preis.
          className="flex min-h-[60vh] flex-grow flex-col gap-[22px] rounded-t-[14px] border border-hairline bg-surface px-6 pt-[56px] shadow-tile sm:px-[72px]"
        >
          <div className="relative">
            <input
              data-testid="blatt-titel"
              value={title}
              // JOB 3141 (CAP-P1): DIESELBE Ablesung wie die Schreibfläche darunter. Hier stand
              // `disabled={loadingDraft}` — die eine Hälfte einer Regel, die es nur an diesem Feld
              // gab. Sie ist ersetzt, nicht ergänzt.
              disabled={!blattNimmtAn}
              // Ein gesperrtes Feld schweigt von sich aus. Der Verweis steht nur, solange der Satz
              // steht — sonst zeigte `aria-describedby` auf eine `id`, die es nicht gibt.
              aria-describedby={blattNimmtAn ? undefined : BLATT_LADEN_HINWEIS_ID}
              onChange={(event) => changeTitle(event.target.value)}
              onFocus={() => {
                // Das Menü öffnet, wenn es etwas anzubieten hat: die vier Starter am LEEREN Blatt,
                // den Titelvorschlag, sobald Text da ist. Hat es beides nicht, bleibt es zu — ein
                // leeres Menü wäre wieder eine Fläche, die spricht, ohne etwas zu sagen.
                if (titelMenueHatEtwas) {
                  setOffenesMenue("titel");
                }
              }}
              placeholder={t("erfassen.platzhalter.titel")}
              aria-label={t("erfassen.platzhalter.titel")}
              className="w-full bg-transparent text-[28px] font-[650] leading-tight tracking-[-0.3px] text-text outline-none placeholder:text-muted-2/60"
            />
            {/* §5: Die vier Starter-Chips leben im Titel-Menü des LEEREN Blattes — und seit R6 auch
                der Titelvorschlag, der bis dahin als gerahmte Karte über dem Schreibfeld stand. */}
            {offenesMenue === "titel" && titelMenueHatEtwas ? (
              <div
                role="menu"
                data-testid="blatt-menue-titel"
                className="absolute left-0 top-full z-40 mt-1 min-w-[260px] rounded-[10px] border border-hairline bg-surface p-1 shadow-tile"
              >
                {titelVorschlag ? (
                  <MenueEintrag
                    titel={t(
                      titelVorschlag.quelle === "objekttext"
                        ? "editor.titleSuggest.sourceText"
                        : "editor.titleSuggest.sourceImage",
                    )}
                    onClick={() => {
                      changeTitle(titelVorschlag.titel);
                      setOffenesMenue(null);
                    }}
                  >
                    <span
                      data-testid="blatt-titelvorschlag"
                      data-quelle={titelVorschlag.quelle}
                      className="truncate"
                    >
                      {t("editor.titleSuggest.label")}: {titelVorschlag.titel}
                    </span>
                  </MenueEintrag>
                ) : null}
                {starterZeigen
                  ? INTAKE_STARTERS.map((starter: IntakeStarter) => (
                      <MenueEintrag
                        key={starter.id}
                        onClick={() => {
                          changeTitle(t(starter.labelKey));
                          setOffenesMenue(null);
                        }}
                      >
                        {t(starter.labelKey)}
                      </MenueEintrag>
                    ))
                  : null}
              </div>
            ) : null}
          </div>

          {/* §5.4: Fehlt der Inhalt beim Einreichversuch, bekommt das FELD den Rand — hier ohne
              Erklärsatz. Das war bis JOB 3114 auch beim Vertraulichkeits-Menü so; dort trägt die
              Markierung jetzt zusätzlich einen Satz (UX-05, Befund N-0017). Für den leeren Text ist
              das NICHT nachgezogen: N-0017 nennt die Vertraulichkeit, und der leere Rahmen sagt
              anders als eine ungestellte Frage von selbst, was fehlt. Eine eigene Zeile — nicht
              „dieselbe Sprache". */}
          {/* DAS BLATT IST DER RAHMEN, NICHT DER EDITOR (Mockup Z.46-52). Der `RichTextEditor` bringt
              seine eigene Karte mit (Radius, Haarlinie, Fläche) und schreibt 14,5 px auf 1,5 — auf
              dem Blatt wäre das ein Kasten im Kasten und die falsche Schriftgröße. Die Umgebung
              räumt beides von aussen ab, statt eine zweite Editorfassung zu bauen: die Datei
              `components/RichTextEditor.tsx` bleibt unberührt (sie liegt nicht in den Zielpfaden
              dieses Auftrags) und trägt weiterhin genau EINEN Bildweg, EINE Beschreibungspflicht
              und EINE Verankerung.
              Seine Werkzeugleiste (H2 · B · I · Listen · Link · Bild · Callouts) BLEIBT sichtbar —
              sie ist die Formatleiste des Blattes, wie Pages sie hat. Sie zu verbergen hiesse,
              Auszeichnen, Listen und Links ersatzlos zu verlieren. */}
          <div
            ref={editorHuelleRef}
            data-testid="blatt-text"
            className={`blatt-text flex-grow text-[16px] leading-[1.75] [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!bg-transparent [&_[role=textbox]+div]:!p-0 [&_[role=textbox]+div]:!text-[16px] [&_[role=textbox]+div]:!leading-[1.75] [&_[role=textbox]]:!p-0 [&_[role=textbox]]:!text-[16px] [&_[role=textbox]]:!leading-[1.75] ${
              submitValidation && !hasBody ? "rounded-[10px] ring-1 ring-trust-crit-fill" : ""
            }`}
          >
            {/* ======================================================================================
                JOB 3141 (CAP-P1) — SOLANGE GELADEN WIRD, GIBT ES HIER KEINE SCHREIBFLÄCHE.
                ======================================================================================
                Der Grund für diese Bauform steht bei `blattNimmtAn` oben. Kurz: der Editor ist ein
                unkontrolliertes `contentEditable` ohne Sperr-Eingang, seine Datei ist gesperrt, und
                eine Hülle mit `inert`/`aria-disabled` hält weder Tastatur noch Einfügen auf. Was
                nicht montiert ist, nimmt nichts an — und genau das ist hier die Zusage.

                AN SEINER STELLE STEHT DER GRUND, nicht eine leere Fläche: Zustandsmodell §9 verlangt
                „ausdrücklich nicht bereit mit sichtbarem, übersetztem Grund". `role="status"` sagt
                ihn auch der Vorlesehilfe an; die `id` trägt zugleich das `aria-describedby` des
                Titelfeldes, damit BEIDE Felder denselben einen Grund nennen.

                DER EDITOR VERLIERT DABEI NICHTS: Sein Inhalt lebt in `bodyHtml`, nicht in ihm. Nach
                dem Laden montiert er frisch auf dem geladenen Rumpf — dieselbe Fassung, die er sonst
                über den Wert-Effekt geschrieben bekäme. */}
            {blattNimmtAn ? (
              <RichTextEditor
                value={bodyHtml}
                onChange={changeBodyHtml}
                placeholder={t("erfassen.platzhalter.text")}
                captionFormRequest={captionRequest ?? undefined}
                documentTitle={derivedTitle}
                onTitelVorschlag={changeTitle}
              />
            ) : (
              // `<output>` statt `<p role="status">`: dieselbe Ansage an die Vorlesehilfe, aber als
              // semantisches Element — so verlangt es die a11y-Regel `useSemanticElements`, und so
              // steht es schon an der Verlustmeldung der Galerie (`DraftBodyGallery.tsx:52`).
              <output
                id={BLATT_LADEN_HINWEIS_ID}
                data-testid="blatt-nicht-bereit"
                className="block rounded-[10px] border border-dashed border-hairline px-3 py-6 text-[13px] leading-relaxed text-muted"
              >
                {t("erfassen.laden.nichtBereit")}
              </output>
            )}
          </div>

          {/* Die Galerie steht UNTER dem Text im Blatt (§5.2). */}
          <DraftBodyGallery
            bodyHtml={bodyHtml}
            onEditCaption={(imageId, src, index) =>
              setCaptionRequest((prev) => ({
                imageId,
                src,
                index,
                nonce: (prev?.nonce ?? 0) + 1,
              }))
            }
            quellBildzahl={quellBildzahl}
          />

          {/* ==========================================================================================
              §5 — EIN STILLER CHIP UNTER DEM BLATT, NUR IM FALL, AUFKLAPPBAR.
              ==========================================================================================
              Die alte Live-Reaktionszone stand IMMER da und sprach auch dann, wenn sie nichts zu
              sagen hatte („hört zu", „prüft"). Auf dem Blatt erscheint sie nur noch, wenn es
              wirklich einen Treffer gibt — als ein Chip in einer Zeile.

              AUFGEKLAPPT IST ES DIE BESTEHENDE ZONE, nicht ein Nachbau: `LiveReactionZone` trägt
              seit JOB 3045 die FUNDORTZEILE (Kategorie und Zustand des getroffenen Objekts) samt
              ihrer null-Regeln. Sie hier nachzubauen hiesse, diese Arbeit wegzuwerfen und eine
              zweite Wahrheit über denselben Befund zu schreiben. */}
          {/* JOB 3062 R6 (bens Befund 4): „DAS IST NEU" FEHLTE — und das war ein echter Verlust.
              Auftrag §5 nennt DREI Fälle für den Chip: „Ähnliches existiert schon", „könnte
              widersprechen", „Das ist neu". R5 kannte nur die ersten beiden; die Auskunft, dass die
              Prüfung wirklich lief und NICHTS fand, kam nirgends mehr an. Sie ist die wertvollste
              der drei — sie ist der Grund, überhaupt weiterzuschreiben.

              STILL BLEIBEN NUR `idle` UND `checking` — „hört zu"/„prüft" sind genau das Geplapper,
              das §5 von der Fläche nimmt. Und `pending`/`unavailable` bekommen KEINEN Chip, sondern
              eine Zeile im Menü … → „Status": sie sind Aussagen über die PRÜFUNG, nicht über den
              Text, und ohne Modell wäre `pending` der Dauerzustand — ein Chip, der immer da steht,
              ist wieder Text über Text. Was sie nie werden dürfen, ist „neu"; genau das hält
              `mapKnowledgeCheck` fest, und daran ändert diese Fläche nichts. */}
          {verdict.status === "new" ||
          verdict.status === "similar" ||
          verdict.status === "conflict" ? (
            <div data-testid="blatt-live-chip" data-lage={verdict.status} className="w-fit">
              <button
                type="button"
                aria-expanded={liveOffen}
                onClick={() => setLiveOffen((v) => !v)}
                className="inline-flex w-fit items-center gap-1.5 rounded-[999px] border border-hairline bg-page px-2.5 py-1 text-[12px] text-muted hover:text-text"
              >
                {verdict.status === "conflict"
                  ? t("erfassen.live.widerspruch")
                  : verdict.status === "similar"
                    ? t("erfassen.live.aehnlich")
                    : t("erfassen.live.neu")}
                {verdict.status === "new" ? null : (
                  <span className="font-medium">{verdict.match.title}</span>
                )}
              </button>
              {liveOffen ? (
                <div className="mt-1.5">
                  <LiveReactionZone verdict={verdict} />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ==========================================================================================
              §9 — DER KI-FEHLER: EIN SATZ IN DER VORSCHLAGSKARTE, MIT DEM WEG ZURÜCK.
              ==========================================================================================
              Die Karte steht dort, wo der Vorschlag gestanden hätte — und sie sagt beides: dass es
              nicht geklappt hat, und dass am eigenen Text nichts geschehen ist. „Erneut versuchen"
              wiederholt DIESELBE Handlung (`letzteAktion`), nicht irgendeine; während der Wiederholung
              ist der Knopf gesperrt, damit kein zweiter Lauf danebenläuft. */}
          {kiFehlerSatz ? (
            <div
              data-testid="blatt-ki-fehler"
              className="rounded-[10px] border border-ai/30 bg-surface p-3"
            >
              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-ai">
                {t("erfassen.ki.pille")}
              </span>
              <p className="mt-1.5 text-[13px] leading-relaxed text-trust-crit-text">
                {kiFehlerSatz}
              </p>
              <button
                type="button"
                data-testid="blatt-ki-erneut"
                disabled={structure.isPending || assist.isPending}
                onClick={wiederholen}
                className="mt-2 rounded-[8px] border border-hairline bg-page px-2.5 py-1 text-[13px] font-semibold text-text disabled:opacity-50"
              >
                {t("erfassen.erneutVersuchen")}
              </button>
            </div>
          ) : null}

          {/* Der KI-Vorschlag als Karte im Blatt: „Übernehmen"/„Verwerfen", Pille „KI", nie
              automatisch übernommen (§5.2). */}
          {structureProposal ? (
            <div
              data-testid="blatt-ki-vorschlag"
              className="rounded-[10px] border border-ai/30 bg-surface p-3"
            >
              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-ai">
                {t("erfassen.ki.pille")}
              </span>
              {/* WP-D8 (Pedis Live-ROT B) / WP-D10 Fix 3 / WP-SHIP9-S2: Ein Fallback-Kennzeichen
                  allein erklärt nichts. Hier steht ehrlich, WARUM dieser Vorschlag eine einfache
                  Ableitung ist — kein Modell, Modellfehler, Zeitüberschreitung oder
                  vertraulichkeitsbedingter Cloud-Ausschluss. Vier Ursachen, vier Sätze. */}
              {structureProposal.demo ? (
                <>
                  <span className="ml-1.5 rounded-pill bg-trust-warn-bg px-2 py-0.5 text-[10.5px] font-semibold uppercase text-trust-warn-text">
                    {t("fd.fallback")}
                  </span>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-trust-warn-text">
                    {structureProposal.fallbackReason === "model-timeout"
                      ? t("fd.fallbackModelTimeout")
                      : structureProposal.fallbackReason === "model-error"
                        ? t("fd.fallbackModelError")
                        : structureProposal.fallbackReason === "confidential"
                          ? t("fd.fallbackConfidential")
                          : t("fd.fallbackNoModel")}
                  </p>
                </>
              ) : null}
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                {t("fd.aiProposalCheck")}
              </p>
              <p className="mt-2 text-[13.5px] font-semibold text-text">
                {structureProposal.title}
              </p>
              {/* WP-D7 (Befund 3): Bleibt der reiche Rumpf erhalten, zeigt die Karte NUR den Titel —
                  und sagt WARUM. Der Satz ist keine Zierde: ohne ihn sähe der Mensch einen
                  Vorschlag, dessen Übernahme an seinem Text scheinbar nichts tut. */}
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {proposalTitleOnly ? t("fd.structureRichTitleOnly") : structureProposal.statement}
              </p>
              {/* mega61 Block E: der dauerhaft sichtbare KI-Satz (Art. 50 Abs. 1 und 5 KI-VO). Er
                  stand an der Vordertür und gehört an JEDE Modellfläche — diese Karte IST die
                  Modellfläche des Blattes. Er steht IN der Karte, nicht auf dem ruhenden Blatt:
                  sichtbar, sobald ein Vorschlag da ist, und ohne Erklärtext auf dem leeren Blatt. */}
              <AiGeneratedNotice className="mt-1.5 block" />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={acceptStructureProposal}
                  className="rounded-[8px] border border-hairline bg-page px-2.5 py-1 text-[13px] font-semibold text-text"
                >
                  {t("fd.accept")}
                </button>
                <button
                  type="button"
                  onClick={discardStructureProposal}
                  className="rounded-[8px] px-2.5 py-1 text-[13px] text-muted"
                >
                  {t("fd.discardProposal")}
                </button>
              </div>
            </div>
          ) : null}

          {assistProposal ? (
            <div
              data-testid="blatt-ki-vorschlag"
              className="rounded-[10px] border border-ai/30 bg-surface p-3"
            >
              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-ai">
                {t("erfassen.ki.pille")}
              </span>
              {assistProposal.demo ? (
                <span className="ml-1.5 rounded-pill bg-trust-warn-bg px-2 py-0.5 text-[10.5px] font-semibold uppercase text-trust-warn-text">
                  {t("fd.fallback")}
                </span>
              ) : null}
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                {t("fd.assistProposalCheck", {
                  action: t(assistActionLabelKey(assistProposal.action)),
                })}
              </p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed text-text">
                {assistProposal.text}
              </p>
              {/* mega61 Block E — wie oben: auch die KI-Hilfe ist eine Modellfläche. */}
              <AiGeneratedNotice className="mt-1.5 block" />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={acceptAssistProposal}
                  className="rounded-[8px] border border-hairline bg-page px-2.5 py-1 text-[13px] font-semibold text-text"
                >
                  {t("fd.accept")}
                </button>
                <button
                  type="button"
                  onClick={discardAssistProposal}
                  className="rounded-[8px] px-2.5 py-1 text-[13px] text-muted"
                >
                  {t("fd.discardProposal")}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ============================================================================================
            §5.4 UND §9 — DIE BEIDEN KNÖPFE, UND DARUNTER DIE EINE ZEILE.
            ============================================================================================
            JOB 3062 R6: Die Lagezeile stand bis hierher IM Blatt, oberhalb der Knöpfe. §9 sagt aber
            wörtlich „Fehler = EIN Satz UNTER den Knöpfen + ,Erneut versuchen'", und das ist kein
            Formalismus: wer gerade geklickt hat, sieht auf den Knopf. Antwort und Handlung stehen
            jetzt beieinander — Fehler und Wiederholung, Erfolg und Weiterweg. */}
        <div className="pointer-events-none sticky bottom-0 flex flex-col items-end gap-1.5 pb-7 pr-0">
          {/* `pointer-events-none` an der Leiste, `pointer-events-auto` an JEDEM Kind, das man
              anfassen soll: Die Leiste liegt über dem Blatt und dürfte sonst das Schreiben in der
              letzten Zeile blockieren. Beim Umzug der Lagezeile hierher war das in R6 einen Lauf
              lang vergessen — die Links der Erfolgszeile („Objekt ansehen", „Validierung öffnen")
              nahmen keinen Klick mehr an, und `demo-ux-v1-capture-frontdoor.spec.ts` (Fall 4) lief
              genau deshalb in den Zeitablauf. Gemessen, nicht überlegt. */}
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              data-testid="blatt-entwurf-sichern"
              disabled={!canSave}
              onClick={requestSave}
              className="rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text disabled:opacity-50"
            >
              {t("erfassen.entwurfSichern")}
            </button>
            <button
              type="button"
              data-testid="blatt-einreichen"
              disabled={busy}
              onClick={requestSubmit}
              className="rounded-[10px] bg-[#C2500A] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {t("erfassen.einreichen")}
            </button>
          </div>
          {/* ========================================================================================
              JOB 3106 (UX-01) — DIE BESTÄTIGUNG NENNT DIE WEGE, STATT ZU VERWEHEN.
              ========================================================================================
              Bis hierher war die einzige Antwort auf „Entwurf sichern" ein Toast („Entwurf
              gespeichert."), der nach ein paar Sekunden weg ist und keinen Weg nennt — Codex'
              Befund N-0018: „Über … → Entwürfe ist der gespeicherte Text vollständig erreichbar.
              Die Speicherbestätigung nennt diesen Weg nicht."

              SIE STEHT, SIE BLINKT NICHT: Die Zeile bleibt, solange das Blatt dem gesicherten
              Stand entspricht, und verschwindet in dem Moment, in dem der Mensch weiterschreibt —
              dann ist „gesichert" nicht mehr wahr. Der Toast bleibt unverändert daneben; er ist
              die flüchtige Quittung, das hier ist der Weg.

              KEIN SECHSTER GERAHMTER KNOPF (Lieferung 3): Der Knopf öffnet den EINEN vorhandenen
              Zugang zu den eigenen Entwürfen — dasselbe „…"-Menü, dieselbe Fläche, dieselbe Liste.
              Er ist ein echtes `<button>`: Tab erreicht ihn, Enter löst ihn aus, und den sichtbaren
              Fokusring bringt die globale `*:focus-visible`-Regel mit (index.css, Scheibe D-024). */}
          {gesichertZeile ? (
            <div
              data-testid="blatt-entwurf-gespeichert"
              // WELCHER Entwurf gemeint ist, steht an der Zeile selbst — dieselbe Kennung, die die
              // Adresse trägt. Ohne sie wäre „gesichert" eine Aussage ohne Gegenstand.
              data-entwurf={gesichertZeile.id}
              className="pointer-events-auto text-[13px] text-trust-pos-text"
            >
              {t("fd.saved.line", { titel: gesichertZeile.titel })}
              <button
                type="button"
                data-testid="blatt-entwurf-gespeichert-entwuerfe"
                // JOB 3266 (D1): derselbe Aufruf wie das benannte Werkzeug oben — ein Weg, eine
                // Fläche. Vorher stand die Handbewegung hier ein zweites Mal ausgeschrieben.
                onClick={entwuerfeAufklappen}
                className="ml-2 font-semibold underline"
              >
                {t("fd.saved.toDrafts")}
              </button>
            </div>
          ) : null}
          <BlattLage
            fehler={blattFehler}
            erfolg={submittedKo}
            kostet={strukturKostet && (structure.isPending || assist.isPending)}
            uebernommen={structureAccepted || assistAccepted}
            keptRichBody={structureKeptRichBody}
            titleAdopted={structureTitleAdopted}
            aufNeuLaden={
              staleConflict
                ? () => {
                    setStaleConflict(false);
                    setReloadNonce((n) => n + 1);
                  }
                : null
            }
            aufNeuerVorgang={
              restartOffer
                ? () => {
                    submitOperationRef.current = null;
                    submitDraftRef.current = null;
                    saveOperationRef.current = null;
                    setActiveDraftId(null);
                    // JOB 3106 (UX-01): ein neuer Vorgang lässt den alten Entwurf hinter sich —
                    // die Bestätigungszeile spräche sonst über eine Sicherung, zu der die Adresse
                    // gerade nicht mehr führt.
                    setGesicherterEntwurf(null);
                    setSearchParams({}, { replace: true });
                    setRestartOffer(null);
                    setErr(null);
                  }
                : null
            }
            aufNeuerEintrag={submittedKo ? resetForNewEntry : null}
            // JOB 3062 R7: Der Knopf UNTER den Knöpfen wiederholt nur BLATTWEGE. Wäre er auch für
            // die KI zuständig, könnte er nach einem KI-Lauf und einem späteren Speicherfehler die
            // falsche Handlung auslösen — genau der Fehler, den ben an R6 beschrieben hat. Der
            // KI-Fehler hat seinen eigenen Knopf in seiner eigenen Karte.
            aufWiederholen={
              blattFehler &&
              letzteAktion &&
              letzteAktion.art !== "struktur" &&
              letzteAktion.art !== "assist" &&
              !busy
                ? wiederholen
                : null
            }
          />
        </div>
      </div>
    </ImageDescribeProvider>
  );
}

// ------------------------------------------------------------------------------------------------
// Die Anhangsliste des „…"-Menüs: die Bilder und Dateien, die WIRKLICH im Rumpf hängen. Sie wird
// aus dem Rumpf abgeleitet und nicht zweitgeführt — eine zweite Liste liefe auseinander.
// ------------------------------------------------------------------------------------------------
function AnhangListe({ bodyHtml }: { bodyHtml: string }): JSX.Element {
  const { t } = useTranslation();
  const anzahl = (bodyHtml.match(/<img\b/gi) ?? []).length;
  if (anzahl === 0) {
    return <p className="text-[12.5px] text-muted">{t("erfassen.anhaenge.keine")}</p>;
  }
  return <p className="text-[12.5px] text-text">{t("erfassen.anhaenge.anzahl", { n: anzahl })}</p>;
}

// ------------------------------------------------------------------------------------------------
// Die Lage des Blattes — EIN Satz, nie eine Karte (Zustandsmodell §9). Fehler bekommt seinen Weg
// zurück, Erfolg eine Zeile mit Link. „Gespeichert"/„eingereicht" steht nur nach Serverbestätigung.
// ------------------------------------------------------------------------------------------------
function BlattLage({
  fehler,
  erfolg,
  kostet,
  uebernommen,
  keptRichBody,
  titleAdopted,
  aufNeuLaden,
  aufNeuerVorgang,
  aufNeuerEintrag,
  aufWiederholen,
}: {
  fehler: string | null;
  erfolg: Pick<KnowledgeObject, "id" | "title"> | null;
  kostet: boolean;
  uebernommen: boolean;
  keptRichBody: boolean;
  titleAdopted: boolean;
  aufNeuLaden: (() => void) | null;
  aufNeuerVorgang: (() => void) | null;
  aufNeuerEintrag: (() => void) | null;
  /** §9: der Wiederholweg jedes Fehlers — auch dessen, für den es keinen eigenen Rückweg gibt. */
  aufWiederholen: (() => void) | null;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (erfolg) {
    // ============================================================================================
    // EINE ZEILE — MIT ALLEN DREI WEGEN DER ALTEN ERFOLGSKARTE.
    // ============================================================================================
    // Die Karte der Vordertür bot „Validierung öffnen", „Objekt ansehen" und „Neuer Eintrag" an,
    // dazu zwei Erklärabsätze. Die Absätze fallen (Auftrag §9: EINE Zeile), die drei WEGE nicht —
    // sonst wäre aus dem Aufräumen ein Funktionsverlust geworden.
    //
    // `RoleLink` bei der Validierung, nicht `Link`: `/validierung` verlangt die Rolle `controller`.
    // Wer hier einreicht, darf ihr in aller Regel NICHT folgen; der Weg bleibt sichtbar, hört aber
    // auf, ein Weg zu sein (dieselbe Bauform wie AUFTRAG-mega70 Block B an der alten Karte).
    // JOB 3062 R6 (bens Hinweis): `div` STATT `p`. `RoleLink` rendert die NICHT begehbare Fassung
    // bewusst als `<div data-role-no-reach>` (RoleLink.tsx) — in einem `<p>` ist das ungültige
    // Verschachtelung, und React meldete das in jedem Testlauf. Der Browser bricht ein solches `<p>`
    // an der Stelle auf; die „eine Zeile" wäre dann genau bei der Rolle, die den Weg NICHT gehen
    // darf, zwei Zeilen gewesen. `inline-flex` an beiden Fassungen hält sie in der Zeile.
    return (
      <div data-testid="blatt-lage" className="pointer-events-auto text-[13px] text-trust-pos-text">
        {t("erfassen.eingereicht")}{" "}
        <Link className="font-semibold underline" to={`/wissen/${erfolg.id}`}>
          {erfolg.title}
        </Link>
        <RoleLink
          className="ml-2 inline-flex items-center gap-1 font-semibold underline"
          hoverClassName="hover:opacity-80"
          to="/validierung"
        >
          {() => t("fd.openValidation")}
        </RoleLink>
        {aufNeuerEintrag ? (
          <button type="button" onClick={aufNeuerEintrag} className="ml-2 font-semibold underline">
            {t("fd.newEntry")}
          </button>
        ) : null}
      </div>
    );
  }
  if (fehler) {
    return (
      <p data-testid="blatt-lage" className="pointer-events-auto text-[13px] text-trust-crit-text">
        {fehler}
        {aufNeuLaden ? (
          <button type="button" onClick={aufNeuLaden} className="ml-2 font-semibold underline">
            {t("fd.draftStaleReload")}
          </button>
        ) : null}
        {aufNeuerVorgang ? (
          <button type="button" onClick={aufNeuerVorgang} className="ml-2 font-semibold underline">
            {t("capture.restartOfferAction")}
          </button>
        ) : null}
        {/* §9: JEDER Fehler bekommt seinen Wiederholweg. Die beiden Knöpfe darüber sind die
            SPEZIELLEN Rückwege (Standkonflikt, Abdruckkonflikt); dieser hier ist der allgemeine
            und deckt genau die Fälle, die bis R5 in einer Sackgasse endeten — Netzabriss beim
            Speichern, Zeitüberschreitung beim Einreichen, fehlgeschlagenes Laden eines Entwurfs. */}
        {aufWiederholen ? (
          <button
            type="button"
            data-testid="blatt-erneut"
            onClick={aufWiederholen}
            className="ml-2 font-semibold underline"
          >
            {t("erfassen.erneutVersuchen")}
          </button>
        ) : null}
      </p>
    );
  }
  if (uebernommen) {
    return (
      <p data-testid="blatt-lage" className="pointer-events-auto text-[13px] text-muted">
        {keptRichBody
          ? titleAdopted
            ? t("fd.structureKeptRichBodyTitle")
            : t("fd.structureKeptRichBodyNoTitle")
          : t("fd.structureAccepted")}
      </p>
    );
  }
  if (kostet) {
    // mega62: der Kostenhinweis kommt aus SEINER Komponente, nicht aus einem zweiten `t()`-Aufruf.
    // Ein abgeschriebener Wortlaut wäre eine zweite Wahrheit über dieselben Kosten — und der
    // Sammler, der jede Auslösestelle prüft, sähe diese Fläche gar nicht.
    // `billable` ist hier definitionsgemäß wahr: `kostet` IST `useAiBillable([...]) && läuft`.
    return (
      <p data-testid="blatt-lage" className="pointer-events-auto text-[13px] text-muted">
        <AiCostHint billable />
      </p>
    );
  }
  return null;
}
