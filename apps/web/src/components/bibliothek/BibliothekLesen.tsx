import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Paperclip, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { type KoAction, endpoints } from "../../api/endpoints";
import {
  useAudit,
  useConflicts,
  useEigeneBefunde,
  useKo,
  useKoBeziehungen,
  useKos,
} from "../../api/hooks";
import type { ExtractedPoint, KnowledgeObject, KnowledgeType, KoProposal } from "../../api/types";
import { useSession } from "../../app/AuthContext";
import { ImageDescribeProvider } from "../../app/ImageDescribeContext";
import { useRole } from "../../app/RoleContext";
import { useToast } from "../../app/ToastContext";
import {
  type AppendDocumentOutcome,
  commitDocumentAppend,
  newAppendOperationId,
} from "../../lib/appendToArticle";
import { applyBodyAssist, applyBodyAssistBlock, bodyTextForAssist } from "../../lib/bodyAiAssist";
import { appendExtractSections, normalizeExtractLocale } from "../../lib/bodyExtract";
import {
  bodyFileLinksFromHtml,
  editorFilesFromAttachments,
  objectRawHref,
} from "../../lib/bodyFileLink";
import type { OriginalDocument, OriginalRefCache } from "../../lib/captureAttachments";
import { fileSourcePayload } from "../../lib/captureFromFile";
import {
  CONF_TONE_CLASS,
  abfrageMitBestand,
  auffrischungGescheitert,
  vertraulichkeitsAuskunft,
} from "../../lib/confidentiality";
import { conflictImpact, conflictNotice } from "../../lib/conflictImpact";
import { anzeigestatusAnker, anzeigestatusAus } from "../../lib/displayStatus";
import { studioSaveConfidence } from "../../lib/editorApplySafety";
import { EDITOR_BLOCKS } from "../../lib/editorBlocks";
import { eigeneKollisionDetail } from "../../lib/eigeneKollision";
import { formatKoTimestamp } from "../../lib/koDates";
import { type KoRevisionItemId, koRevisionSummary } from "../../lib/koRevisionSummary";
import { sprachcode, useFrischeLesevariante } from "../../lib/lesevariante";
import type { MatchField } from "../../lib/librarySearch";
import { useNetzOnline } from "../../lib/netzzustand";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { draftProvenance } from "../../lib/reasonerProvenance";
import { canRevalidate } from "../../lib/revalidation";
import {
  isReviewReworkContext,
  reworkNextSteps,
  reworkValidationHref,
} from "../../lib/reviewReworkContext";
import { useAuthorName } from "../../lib/useAuthorName";
import { isStaleKoDeleteError } from "../../lib/validationDelete";
import {
  type FeedbackVerdict,
  buildValidationFeedback,
  isFeedbackSubmittable,
  latestValidationFeedback,
} from "../../lib/validationFeedback";
import { isReturnedForRework } from "../../lib/validationStatus";
import { AiAssistBox } from "../AiAssistBox";
import { BodyExtractPanel } from "../BodyExtractPanel";
import { BodyImageGallery } from "../BodyImageGallery";
import { BodyTemplateChooser } from "../BodyTemplateChooser";
import { EditorAttachmentContext } from "../EditorAttachmentContext";
import { EditorContentQuality } from "../EditorContentQuality";
import { KnowledgeInputStudio } from "../KnowledgeInputStudio";
import { KoRevisionSummary } from "../KoRevisionSummary";
import { LesevarianteHinweis } from "../LesevarianteHinweis";
import { Modal } from "../Modal";
import { RichTextEditor } from "../RichTextEditor";
import { RoleLink } from "../RoleLink";
import { SanitizedHtml } from "../SanitizedHtml";
import { WissensbeziehungenBereich } from "../WissensbeziehungenBereich";
// JOB 4145 R3 · WIKI-ORIENTIERUNG: die ANZEIGE- UND STRUKTURREGELN der Gliederung kommen weiter aus
// der EINEN Stelle des Hauses und werden nicht nachgebaut — `d44LeisteZeigen` („ohne Überschrift
// keine Leiste, aber KEINE Mindestzahl") und `d44SichtbareEintraege` („gezählt wird alles, gezeigt
// wird, was Text hat"). NICHT mehr geholt wird `d44Gliederung`: diese Regex liest HTML als TEXT, und
// genau daran sind Runde 1 und 2 gescheitert. Die Marken kommen jetzt aus dem gerenderten Baum, das
// Sprungziel ist die Elementreferenz selbst. `tests/wiki-orientierung/…` (O9) hält beides fest.
import { type D44Eintrag, d44LeisteZeigen, d44SichtbareEintraege } from "../d44Struktur";
import { ListEditor, TagEditor } from "../editors";
import { KNOWLEDGE_TYPES } from "../trust";
import { Button, Field, TextInput, cx } from "../ui";
import { AuffrischungHinweis } from "./AuffrischungHinweis";
import { MehrAbschnitte, type Sprungziel } from "./MehrAbschnitte";
import { Menue, MenuePunkt, MenueTrenner } from "./Menue";
import { fragenHref } from "./fragen";
import { type ZustandsTon, zustandsTon } from "./zustand";

// ==================================================================================================
// JOB 3063 · H4 — DIE LESEFLÄCHE. SIE IST JETZT AUCH DAS WISSENSOBJEKT-DETAIL.
// ==================================================================================================
//
// Maßstab `design/klarwerk/Bibliothek.dc.html` Z.102-113: 720 px Lesespalte, 36 px oben, 18 px
// zwischen den Teilen. Status-Pille · Meta-Zeile · „Fragen" und „…" · Titel · Text · Quellen-Chip ·
// Bilder-Chip. SONST NICHTS — die dreizehn Abschnitte der alten Detailseite liegen hinter der EINEN
// Zeile „Mehr" (`MehrAbschnitte`), zugeklappt als Vorgabe.
//
// EHRLICHKEIT BLEIBT LAGEBEZOGEN (Auftrag §5/§9):
//   · Der Konflikt-Satz steht NUR, wenn der Server einen offenen Konflikt ausweist — ein Schweigen
//     behauptet nichts. „Keine Konflikte" steht nirgends.
//   · Fehler beim Laden = EIN Satz plus Knopf; Laden = leere Fläche, kein „Lädt …".
//   · Fehlt das Erstelldatum, fällt es aus der Meta-Zeile — kein Ersatzdatum.
//   · JOB 3034 R2 · KONFLIKTRUNDE 2 (nachgezogen): scheitert die Auffrischung eines schon
//     geholten Eintrags, bleibt der Eintrag samt Stufenkennzeichen stehen — der Fehler steht als
//     Hinweis über der Fläche, aus derselben Quelle wie auf der (frueheren) Detailseite
//     (`lib/confidentiality.ts`, `abfrageMitBestand`/`auffrischungGescheitert`).
//
// ==================================================================================================
// JOB 3068 · N5 — DER EIGENE BEFUND STEHT HIER, DAUERHAFT, UND NICHT MEHR HINTER „MEHR".
// ==================================================================================================
//
// Pedis Zeile N5: „Der Autor sieht DAUERHAFT, dass sein Beitrag kollidiert … mit ehrlichem Satz,
// gegen wie viel geprüft wurde." Seit JOB 3063 saß die Auskunft im Abschnitt „Konflikt" hinter der
// zugeklappten Zeile „Mehr" (`MehrAbschnitte.tsx`) — eine Autorin, deren Gegenseite sie nicht sehen
// darf, sah damit GAR NICHTS, denn `conflictNotice` spricht nur über SICHTBARE Konfliktpaare,
// während `/api/duplicate-signal` auch dann spricht, wenn die Gegenseite unsichtbar ist
// (`lib/eigeneKollision.ts:329-334`). Jetzt steht sie in der Lesespalte, ohne einen Klick.
//
// EINE ZEILE, KEIN KARTENBLOCK: Befundsatz · Deckungssatz · (Vorbehalt) · (Weg) · (Wiederholen) —
// die letzten drei nur in ihrer jeweiligen Lage. Sie trägt `data-bib-text`, weil sie INHALT ist:
// eine Tatsachenaussage über DIESEN Eintrag, in derselben Gattung wie die Meta-Zeile, und kein
// Erklärtext über die Bedienung (`tests/design/zielbild-h4-kein-erklaertext.test.ts`).
//
// SIE STEHT NUR AM EIGENEN OBJEKT. Der `conflictNotice`-Satz darüber bleibt unverändert: er spricht
// zum LESER über die Nutzbarkeit und gilt an jedem Objekt, diese Zeile spricht zur VERFASSERIN über
// ihren eigenen Eintrag. Dass das zwei Aussagen sind und nicht zweimal dieselbe, ist gemessen
// (`tests/ko/job3025-a27-mounted.test.tsx` R-i3/R-i4) und wird von diesem Auftrag nicht angetastet.
//
// ABGELÖST WIRD DER ALTE ORT: `MehrAbschnitte` ruft `useEigeneBefunde`/`eigeneKollisionDetail` nicht
// mehr. Zwei Flächen, die denselben Befund verschieden auslegen, sind der Fehler, gegen den
// `eigeneKollision.ts:15-17` steht — nach diesem Umbau gibt es die Auskunft an genau einer Stelle.

// ==================================================================================================
// JOB 4155 · WG-LUECKEN — DIE GESETZTEN BEZIEHUNGEN STEHEN IN DER LESESPALTE, OHNE EINEN KLICK.
// ==================================================================================================
//
// DER BEFUND, den dieser Auftrag schliesst: Seit JOB 4153 gibt es den `WissensbeziehungenBereich`,
// und er hing ausschliesslich in `KnowledgeNeighborhood` — also im Abschnitt 13 hinter der
// zugeklappten Zeile „Mehr" (`MehrAbschnitte.tsx:1853-1860`, `:2869` weiter unten). Codex hat das
// gemessen (2df61f13) und festgelegt: dieser Einbau zählt NICHT als App-Anzeige. Eine Anwenderin
// sah ihre eigene, ausdrücklich gesetzte Fachbeziehung nur, wenn sie vorher etwas aufklappte.
//
// ABLÖSUNG, NICHT ERGÄNZUNG (Lieferung 6): Der Aufruf in `KnowledgeNeighborhood.tsx` ist mit
// diesem Auftrag ENTFERNT. Abschnitt 13 zeigt danach ausschliesslich die ABGELEITETE
// Schlagwort-Nachbarschaft (`herkunft: "abgeleitet"`), die kuratierten Beziehungen stehen hier
// oben. Zwei Flächen, die dieselben Beziehungen zeigen, wären zwei Stände desselben Bestands —
// derselbe Fehlertyp, gegen den `eigeneKollision.ts:15-17` steht.
//
// ------------------------------------------------------------------------------------------------
// DAS ZUSTANDSMODELL DIESER STELLE (Auftrag §9) — und warum es HIER steht und nicht im Bereich.
// ------------------------------------------------------------------------------------------------
//
// `WissensbeziehungenBereich` gehört JOB 4153 und wird von diesem Auftrag NICHT umgeschrieben. Was
// er selbst trägt, bleibt seins: erfolgreich leer (mit dem Satz, was „keine Beziehung" nicht
// heisst), Cache mit laufender und mit gescheiterter Auffrischung (`AuffrischungHinweis`,
// dieselbe Bauform wie oben in dieser Datei), die Schreibwege und ihre Fehler.
//
// Was die LESESPALTE beisteuert, sind genau die zwei Lagen, in denen ihre Hausform eine andere ist
// als die des Bereichs — und je Lage steht die Auskunft danach an GENAU EINER Stelle:
//
//   · LADEN (noch keine Antwort)  → leere Fläche, kein Wort. Die Hausform dieser Datei
//                                   (`:1566`, „Ein Wort hier wäre der Erklärtext, den diese Seite
//                                   abschafft"). Der Bereich wird gar nicht erst gerendert.
//   · KEINE RECHTE (403)          → der Bereich erscheint NICHT. Kein gesperrter Platzhalter,
//                                   keine Zahl, kein Fehlersatz: ein Platzhalter wäre eine
//                                   Existenzauskunft über Beziehungen, die dieser Mensch nicht
//                                   sehen darf (dieselbe Regel wie `ko-routes.ts`, mega74 B).
//   · FEHLER OHNE BESTAND         → der Bereich sagt seinen einen Satz; die Lesespalte hängt den
//                                   ERNEUTEN VERSUCH daneben, den §9 verlangt und den der Bereich
//                                   nicht hat. Kein zweiter Fehlersatz — der Satz bleibt seiner.
//
// OFFLINE ist hier ausdrücklich KEIN eigener Zweig: ein abgebrochener Abruf kommt als Fehler an und
// geht denselben Weg. Ein eigener Offline-Text wäre ein Urteil über die Ursache ohne Beleg (Lehre
// JOB 3037 R4/R5) — mit Bestand bleibt der Stand stehen und der Bereich sagt „Auffrischung
// fehlgeschlagen", ohne Bestand steht der Fehlersatz mit dem Knopf.
//
// ES GIBT KEINE ZWEITE ABFRAGE: `useKoBeziehungen` ist derselbe Hook mit demselben Schlüssel
// (`koBeziehungenQueryKey`), den der Bereich selbst benutzt — React Query liefert beiden dieselbe
// Beobachtung desselben Eintrags. Eine eigene Abfrage hier wäre ein zweiter Stand desselben
// Bestands.
function Beziehungsbereich({ koId }: { koId: string }): JSX.Element | null {
  const { t } = useTranslation();
  // ALLE Felder in EINEM Zugriff. React Query merkt sich je Render, WELCHE Felder eine Komponente
  // gelesen hat, und weckt sie nur bei deren Änderung; eine Komponente, die in einem frühen
  // Ausgang nur eines liest, verpasst danach die Änderung der anderen.
  const { data, error: fehler, isError, refetch } = useKoBeziehungen(koId);
  // KEINE RECHTE: der Server sagt 403. Der Bereich verschwindet ganz — ein Platzhalter „nicht
  // sichtbar" wäre die Auskunft, dass es hier etwas zu sehen gäbe.
  const keinRecht = fehler instanceof ApiError && fehler.status === 403;
  // ================================================================================================
  // EINE ANTWORT, DIE DIESE FLÄCHE NICHT LESEN KANN, IST EIN FEHLER — UND KEIN ABSTURZ.
  // ================================================================================================
  //
  // `WissensbeziehungenBereich` liest `data.kanten` ohne Rückfrage (JOB 4153) — richtig, denn der
  // Vertrag sagt `{ koId, kanten, total }` zu. Kommt aber etwas anderes zurück (ein Server ohne
  // diesen Endpunkt, ein Proxy mit eigener Fehlerseite, eine ältere Fassung), dann wirft die
  // Komponente WÄHREND DES RENDERNS — und ein Wurf im Render nimmt in React nicht den Bereich mit,
  // sondern die GANZE Eintragsansicht. Der Mensch sähe statt seines Wissensobjekts eine leere
  // Seite, und zwar wegen einer Nebenauskunft.
  //
  // GEMESSEN, nicht vorsorglich: der erste vollständige Torlauf dieses Auftrags fiel in zwölf
  // Prüfständen mit `TypeError: Cannot read properties of undefined (reading 'length')` aus
  // `WissensbeziehungenBereich.tsx` — überall dort, wo die Gegenseite eine leere Liste statt der
  // Vertragsform liefert. Vor diesem Auftrag fiel das niemandem auf, weil der Bereich zugeklappt
  // hinter „Mehr" hing und gar nicht erst gerendert wurde.
  //
  // DIE ANTWORT DARAUF IST NICHT SCHWEIGEN: eine unlesbare Auskunft wird wie ein Abrufscheitern
  // behandelt — ein Satz und ein erneuter Versuch. „Keine Beziehungen" wäre die falscheste aller
  // Antworten, denn darüber ist an dieser Stelle NICHTS bekannt.
  const lesbar = data !== undefined && Array.isArray((data as { kanten?: unknown }).kanten);
  const unlesbar = data !== undefined && !lesbar;
  // Der Server HAT geantwortet — mit lesbaren Daten oder mit einem Fehler. Vorher ist die Fläche
  // leer. Eine unlesbare Antwort zählt als Fehler, nicht als Antwort.
  const antwortDa = !keinRecht && (lesbar || isError || unlesbar);

  // ================================================================================================
  // DER RIEGEL — UND DER WETTLAUF, DEN ER BEENDET (gemessen, nicht vorsorglich).
  // ================================================================================================
  //
  // OHNE IHN LIEF DIESE STELLE IM KREIS, und zwar aus einem Grund, der nur entsteht, weil hier ZWEI
  // Leser an DERSELBEN Abfrage hängen — dieser Bereich und der `WissensbeziehungenBereich` darin:
  //
  //   1. Beim ersten Rendern liegt noch keine Antwort vor → der Bereich gibt nichts aus, der
  //      Unterbau ist also NICHT eingehängt.
  //   2. Der Abruf scheitert → der Bereich rendert → der Unterbau wird eingehängt und meldet sich
  //      als ZWEITER Beobachter an. React Query frischt eine gescheiterte Abfrage beim Anmelden
  //      eines neuen Beobachters auf (`refetchOnMount`).
  //   3. Bei dieser Auffrischung setzt React Query den Zustand OHNE Daten auf `pending` zurück
  //      (`fetchState`: `data === undefined` → `status: "pending"`, `error: null`) → der Bereich
  //      gibt wieder nichts aus → der Unterbau wird ausgehängt.
  //   4. Der Abruf scheitert erneut → zurück zu Schritt 2.
  //
  // GEMESSEN am 16.09.2026 in `tests/wissensgraph-abnahme/eintragsansicht-direkt.test.tsx`: eine
  // Kette aus abwechselnd `[true/…/500]` und `[false/…/undefined]`, so lange der Prüfstand lief —
  // und am Ende stand die Fläche LEER da, obwohl der Server längst geantwortet hatte. Ein Mensch
  // hätte eine flackernde, dauerhaft ladende Stelle gesehen und nie den Fehlersatz.
  //
  // DER RIEGEL BRICHT DEN KREIS AN SCHRITT 3: Hat der Server EINMAL geantwortet, bleibt der Bereich
  // stehen — auch während einer späteren Auffrischung. Das ist dieselbe Regel, nach der diese Datei
  // ihren ganzen Bestand hält (`abfrageMitBestand`: ein laufender oder gescheiterter Nachschlag
  // leert nie, was schon da war), nur eine Ebene höher angewandt.
  //
  // ER GILT JE EINTRAG: der Aufrufer setzt `key={ko.id}`, ein anderer Eintrag beginnt also mit einem
  // frischen Riegel und nicht mit dem Gedächtnis des vorigen.
  const [antwortWarSchonDa, setAntwortWarSchonDa] = useState(false);
  useEffect(() => {
    if (antwortDa && !antwortWarSchonDa) {
      setAntwortWarSchonDa(true);
    }
  }, [antwortDa, antwortWarSchonDa]);

  if (keinRecht) {
    return null;
  }
  // LADEN: noch nie eine Antwort da und auch kein Fehler — leere Fläche, kein „Lädt …".
  if (!antwortDa && !antwortWarSchonDa) {
    return null;
  }
  return (
    // `data-bib-text` — DIESELBE Begründung wie an der Kollisionszeile dieser Datei (JOB 3068 N5,
    // Kopf oben): der Block ist INHALT, nämlich eine Tatsachenaussage über DIESEN Eintrag, die ein
    // Mensch verantwortet hat — und kein Erklärtext über die Bedienung. Der Textmesser
    // (`tests/design/zielbild-h4-kein-erklaertext.test.ts`) zieht ihn deshalb ab, wie er die
    // Meta-Zeile, die Chips und die Kollisionszeile abzieht. Die Marke sitzt an der HÜLLE und nicht
    // im Bereich selbst: der gehört JOB 4153 und wird hier nicht umgeschrieben.
    <div data-testid="bib-beziehungen" data-bib-text="beziehungen">
      {/* Die UNLESBARE Antwort bekommt denselben Satz wie ein gescheiterter Abruf — und der Bereich
          selbst wird dann gar nicht erst gerendert, weil er an dieser Auskunft zerbräche. */}
      {unlesbar ? (
        <p
          className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
          data-testid="bib-beziehungen-unlesbar"
        >
          {t("wb.fehler")}
        </p>
      ) : (
        <WissensbeziehungenBereich koId={koId} />
      )}
      {/* FEHLER OHNE BESTAND: der Satz steht im Bereich (`wb-fehler`), der Weg zurück hier. Mit
          Bestand gibt es ihn nicht — dann steht der bekannte Stand und der Bereich sagt selbst,
          dass die Auffrischung fehlschlug. */}
      {(isError && data === undefined) || unlesbar ? (
        <button
          type="button"
          onClick={() => void refetch()}
          data-testid="bib-beziehungen-erneut"
          className="mt-2 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
        >
          {/* EIN EIGENER WORTLAUT, und das ist kein Geschmack. Der erste Entwurf nahm
              `lib.liste.erneut` („Erneut versuchen") — denselben Text, den die Lesefläche für
              ihren eigenen Wiederholweg benutzt. Auf einer Fläche, auf der beide zugleich stehen
              können, standen damit ZWEI Knöpfe mit demselben Namen und verschiedener Wirkung: ein
              Vorleser nennt beide gleich, und wer den falschen drückt, holt den falschen Bestand.
              Gemessen hat es der Prüfstand `tests/q6d-keim-offline` („genau ein Wiederholknopf",
              2 statt 1). Dieser Knopf sagt jetzt, WAS er wiederholt. */}
          {t("wb.erneut")}
        </button>
      ) : null}
    </div>
  );
}

const PILLEN_TON: Record<ZustandsTon, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

interface EditState {
  title: string;
  statement: string;
  bodyHtml: string;
  type: KnowledgeType;
  category: string;
  conditions: string[];
  measures: string[];
  tags: string[];
  // ================================================================================================
  // JOB 4075 · DIE FASSUNG, DIE BEIM ÖFFNEN AUF DEM BILDSCHIRM STAND.
  // ================================================================================================
  //
  // Sie ist der bedingte Schreibzugriff des Direktwegs: `save` schickt sie als `expectedVersion` mit,
  // und der Dienst schreibt nur, wenn sie noch gilt (Compare-and-Set, `ko-routes.ts:2079-2096`).
  // Sie wird während des Tippens NICHT nachgeführt — genau das ist ihr Zweck: sie bezeugt, worauf
  // dieser Mensch seine Änderung aufgebaut hat.
  //
  // `null` heisst „unbekannt", nicht „egal": kommt die Fassung in der Antwort nicht als Zahl an,
  // wird das Feld weggelassen statt geraten (s. `save`).
  version: number | null;
  // ================================================================================================
  // JOB 4251 · DER STAND DER EINORDNUNG, DER BEIM ÖFFNEN AUF DEM BILDSCHIRM STAND.
  // ================================================================================================
  //
  // Dieselbe Rolle wie `version` eine Zeile höher, nur für Kategorie und Schlagwörter: `save`
  // schickt ihn als `expectedMetadataRevision` mit, und der Dienst schreibt die Einordnung nur,
  // wenn er noch gilt. Eine EIGENE Zahl ist nötig, weil `version` bei einer Einordnungsänderung
  // nicht klettert (`api/types.ts`, `KnowledgeObject.metadataRevision`).
  //
  // `null` heisst „unbekannt" — und dann geht das Feld nicht hinaus: entweder trägt die Antwort den
  // Stand nicht (Altbestand ohne Projektionszeile), oder der gezeigte Eintrag stammt aus einer
  // GESCHEITERTEN Auffrischung. Ohne frische Grundlage wird nichts behauptet.
  einordnung: number | null;
}

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

// ==================================================================================================
// JOB 3667 R3 · DER EINREICHWEG IM BROWSER — WAS RUNDE 2 OFFEN GELASSEN HAT.
// ==================================================================================================
//
// DIE LAGE, DIE DIESE ZEILEN SCHLIESSEN. Runde 2 hat Pedis Accountregel am SERVER durchgesetzt: wer
// ein FREIGEGEBENES Wissensobjekt nicht auch freigeben darf, kann seinen Text dort nicht mehr
// ersetzen — `ko-routes.ts:2062` antwortet 403 `PROPOSAL_REQUIRED`. Das Word-Fenster bietet für
// diesen Fall seit Runde 2 den Einreichweg an. DIESE Fläche bot ihn NICHT: wer im Browser arbeitete,
// bekam eine Sperre ohne Ausweg. Eine Regel mit Sackgasse ist keine Regel, sondern ein Defekt.
//
// DIE DREI FÄLLE, UND SIE SIND NICHT GLEICH (Pedi, SICHTBARES-GESPRAECH.jsonl:693):
//   1. BERECHTIGT, LEGT DIREKT AB — unverändert der bisherige Weg dieser Fläche (`revise`, und für
//      ein freigegebenes Objekt lässt der Server ihn genau diesem Konto durch).
//   2. NICHT BERECHTIGT — sein Text wird als an DASSELBE Objekt GEBUNDENER Vorschlag eingereicht und
//      gilt erst nach fremder Freigabe. HIER IST DIE PRÜFUNG PFLICHT, keine Wahl: es gibt keinen
//      Haken, mit dem er sie abwählen könnte, und der Speichern-Knopf wird ihm nicht angeboten —
//      er könnte nur zu einer Absage führen, und ein Knopf, der nur absagen kann, ist eine
//      Scheinfunktion.
//   3. BERECHTIGT, WÄHLT FALL 2 FREIWILLIG — der Haken „erst jemand anderen ansehen lassen".
//      NUR HIER ist etwas freiwillig.
//
// WAS DIESE FLÄCHE NICHT ENTSCHEIDET: ob es gilt. Sie wählt den WEG; der Server hält die Regel. Liegt
// sie falsch (das Objekt wurde freigegeben, während jemand tippte), antwortet die Route 403 — und
// dann führt `save.onError` in denselben Einreichweg, statt den Menschen stehen zu lassen. Deshalb
// gibt es beide Wege: den vorausgewählten UND den nachträglichen. Geschrieben wird in keinem Fall
// etwas, das der Mensch nicht angetippt hat.

/**
 * Spiegel von `ROLE_PERMISSIONS[...].includes("users.manage")` (`services/rbac/src/policy.ts`) —
 * genau die Rollen, die eine Änderung GLEICH als geprüft ablegen dürfen.
 *
 * WARUM ÜBERHAUPT EINE LISTE IM CLIENT: die Fläche muss VOR dem Aufruf wissen, welchen Weg der Griff
 * geht, und `can()` liegt im rbac-Modul hinter einer Modulgrenze, die `apps/web` nicht überschreitet.
 * WARUM DAS TROTZDEM KEINE ZWEITE WAHRHEIT IST: `tests/word-rueckweg/accountregel-spiegel.test.ts`
 * LIEST diese Zeile und hält sie gegen die Matrix. Wer die Rechte ändert, wird dort rot und
 * entscheidet bewusst — dieselbe Bauform wie `KW_RW_FREIGABE_ROLLEN` im Word-Fenster.
 *
 * NICHT `canReview` (`controller` + `admin`) WIEDERVERWENDET: das ist das Recht zu BEWERTEN
 * (`ko.validate`, eine Stimme von `neededValidations`), nicht das Recht, sofort gültig zu machen.
 * Wer die beiden hier zusammenlegte, gäbe einem `controller` einen Knopf, den die Route ihm verwehrt.
 */
const RW_FREIGABE_ROLLEN = ["admin"];

/**
 * Der EINE Satz, den die Fläche über den Einreichweg sagt — oder keiner.
 *
 * `art` trägt die LAGE, nicht die Formulierung: so kann ein Prüfstand den Fall festhalten, ohne an
 * einem Wortlaut zu hängen, und die Fläche kann je Lage entscheiden, welche Griffe daneben stehen.
 * `version` steht NUR bei `stale` und ist dort die Fassung, die beim Nachlesen wirklich da war —
 * keine aus der Fehlerantwort geratene Zahl (s. „DIE GRENZE DES 409" unten).
 */
type EinreichLage =
  | { art: "pflicht"; text: string }
  | { art: "eingereicht" }
  | { art: "stale"; version: number | null }
  | { art: "fehler"; text: string };

/**
 * JOB 4075 · Der EINE Satz über den letzten SPEICHERversuch — und es gibt ihn nur im Konfliktfall.
 *
 * EIGENER ZUSTAND, NICHT `einreichLage` MITBENUTZT: die beiden Wege stehen auf derselben Fläche und
 * dürfen sich nicht gegenseitig überschreiben. Ein „eingereicht" über einem gescheiterten Speichern
 * (oder umgekehrt) wäre eine Auskunft über einen Vorgang, den es nicht gab.
 *
 * WARUM NUR EINE LAGE: Erfolg ist eine Bestätigung über die Toast-Fläche und kein Satz im Formular;
 * jeder andere Fehler geht unverändert nach `err`. Übrig bleibt der Fall, für den es hier keinen
 * anderen Ort gibt — und `version` steht darin genauso wie bei `EinreichLage`: `null`, bis das
 * Nachlesen eine Fassung WIRKLICH gezeigt hat.
 */
/**
 * JOB 4163 R2 · WAS VON DIESER BEARBEITUNG SCHON AM SERVER STEHT — DIE BUCHFÜHRUNG.
 *
 * Der Speicherweg besteht aus drei nacheinander abgesetzten Schreibaufrufen (s. `save` unten), und
 * bis zu diesem Auftrag wusste niemand, an welcher Stelle die Kette gerissen war.
 *
 * RUNDE 1 FÜHRTE JE SCHRITT NUR „gelungen ja/nein" MIT, UND DAS WAR ZU WENIG — BEN hat drei Fälle
 * gemessen, in denen es Arbeit verschluckt oder gelogen hat:
 *   · BEN1: nach einem Kategorieabbruch ein Schlagwort ergänzt → der `tags`-Schritt galt als
 *     „gelungen" und ging nicht noch einmal hinaus. Die Fläche meldete Erfolg, der Nachtrag fehlte.
 *   · BEN2/BEN3: ein weiterer Fehlschlag setzte die Buchführung auf `null` zurück — der schon
 *     gespeicherte Text war damit vergessen, und der nächste Griff lief in einen erfundenen
 *     Fremdkonflikt.
 *
 * DESHALB STEHT HIER JE SCHRITT DER GESCHRIEBENE WERT, nicht sein Erfolg: eine Vergleichsmarke des
 * Inhalts, den der gelungene Aufruf WIRKLICH abgesetzt hat. Ein Schritt ist genau dann offen, wenn
 * der Wert im Formular von der Marke abweicht — das umfasst „noch nie geschrieben" (`null`) UND
 * „inzwischen geändert" in derselben Regel. `null` heisst nie „gelungen"; es heisst „von dieser
 * Bearbeitung steht dort nichts".
 *
 * `fassung` ist die Versionsnummer, die die ANTWORT des eigenen gelungenen `revise` getragen hat.
 * Sie ist der Bezugspunkt des nächsten bedingten Schreibzugriffs — s. `save`, „DIE FASSUNG".
 */
/*
 * JOB 4251 · `stempel` — DASSELBE FÜR DIE EINORDNUNG, UND AUS DEMSELBEN GRUND.
 *
 * Der Stand der Einordnung (`metadataRevision`), den die ANTWORT des eigenen gelungenen `tags`- bzw.
 * `category`-Aufrufs getragen hat. Er ist der Bezugspunkt des NÄCHSTEN bedingten Einordnungs-
 * Schreibzugriffs — und er muss mitgeführt werden, weil die beiden Aufrufe NACHEINANDER laufen: der
 * gelungene `tags`-Aufruf dreht den Stempel weiter, und ein `category`-Aufruf mit dem Stand von
 * VORHER liefe in einen Konflikt mit dem eigenen Schreibvorgang von einer Zeile zuvor.
 *
 * `null` heisst hier wie überall UNBEKANNT, nie „egal": kommt der Stand in der Antwort nicht als
 * Zahl an, geht der nächste Einordnungsaufruf gar nicht erst hinaus (s. `save`).
 */
/*
 * JOB 4251 R4 · `einordnungGeschrieben` — ZWEI FRAGEN, ZWEI FELDER (BEN, Runde 3).
 *
 * DIE VERWECHSLUNG, DIE DIESE ZEILE BEENDET. Runde 3 las die Frage „habe ICH die Einordnung dieser
 * Bearbeitung schon einmal geschrieben?" aus den Marken `tags`/`category` ab. Die Marken beantworten
 * aber eine ANDERE Frage: „ist dieser Schritt JETZT noch offen?" — und genau deshalb lässt Runde 3
 * die Marke des gescheiterten Aufrufs verfallen (s. `save`, `catch`). Mit dem Verfall verschwand
 * lautlos auch der BEZUGSPUNKT: beide Marken `null` hiess wieder „ich habe hier noch nie
 * geschrieben", der nächste Griff schickte den Stand vom ÖFFNEN, und der Server wies ihn mit 409 ab.
 *
 * BENS MESSUNG (Runde 3, Gegenprobe, `expected 1 to be 2`), ohne jeden fremden Schreiber: Schlagworte
 * gespeichert (Quittung 2) · Kategorie scheitert am Netz · Schlagwort-Nachtrag scheitert am Netz ·
 * dritter, gewöhnlicher Griff schickt Stempel 1 → 409, und die Fläche behauptet, jemand anderes habe
 * eingeordnet. Dazwischengekommen war der eigene Schreibvorgang von vorhin; der Satz war unwahr —
 * derselbe Fehler, den JOB 4163 (BEN2/BEN3) am TEXT beseitigt hat, hier an der Einordnung.
 *
 * DIE TRENNUNG IST DIE GANZE KORREKTUR: die MARKE verfällt (ein gescheiterter Aufruf ist nicht
 * erledigt, K12), die HERKUNFT der Quittung verfällt NICHT (was am Server steht, hört durch einen
 * späteren Fehlschlag nicht auf, dort zu stehen, K13). Das Feld sagt nur „in dieser Bearbeitung ist
 * mindestens ein eigener Einordnungsaufruf durchgegangen" — es sagt NICHTS über den Wert und ersetzt
 * `stempel` nicht: ist die Quittung trotzdem unbekannt (`stempel === null`, Antwort ohne Stand), geht
 * der nächste Aufruf gar nicht erst hinaus, statt sich unbedingt durchzuschreiben (K14).
 */
type Teilstand = {
  text: string | null;
  tags: string | null;
  category: string | null;
  fassung: number | null;
  stempel: number | null;
  einordnungGeschrieben: boolean;
};

/** Die Marken, die der aktuelle Formularinhalt ergibt — der Vergleichspunkt gegen die Buchführung. */
type Speichermarken = { text: string; tags: string; category: string; schlagworte: string[] };

/**
 * Welche Folgeschritte JETZT noch abgesetzt werden müssen. Eine leere Kategorie wird gar nicht erst
 * geschickt (die Route verlangt einen Wert) — sie ist deshalb kein offener Schritt, und ein Satz
 * darüber wäre eine Auskunft ohne Gegenstand.
 */
function offeneSchritte(buch: Teilstand, marken: Speichermarken): Array<"tags" | "category"> {
  const offen: Array<"tags" | "category"> = [];
  if (buch.tags !== marken.tags) {
    offen.push("tags");
  }
  if (marken.category !== "" && buch.category !== marken.category) {
    offen.push("category");
  }
  return offen;
}

/**
 * Der Satz zum Teilabbruch — FESTE WORTLAUTE statt einer zusammengesetzten Aufzählung. Eine Liste,
 * die im Satz gefügt wird, liest sich in einer der drei Sprachen immer falsch; jeder dieser
 * Schlüssel steht in DE/EN/NL als ganzer Satz da und benennt BEIDE Hälften — was gespeichert ist
 * und was nicht.
 *
 * `textAktuell` IST DER ERSTE SCHNITT, und er ist die Antwort auf BEN2/BEN3: steht am Server ein
 * FRÜHERER Stand des Textes, dann ist „dein Text ist gespeichert" unwahr. Dieser Fall bekommt einen
 * eigenen Satz, statt den Menschen in Sicherheit zu wiegen.
 */
function teilSatzSchluessel(textAktuell: boolean, offen: Array<"tags" | "category">): string {
  if (!textAktuell) {
    return "ko.revise.partialOlder";
  }
  if (offen.length === 2) {
    return "ko.revise.partialTagsCategory";
  }
  return offen[0] === "tags" ? "ko.revise.partialTags" : "ko.revise.partialCategory";
}

/**
 * JOB 4251 R2 · DER KONFLIKTSATZ ZUR EINORDNUNG — UND ZWAR DER WAHRE.
 *
 * DER FEHLER AUS RUNDE 1 (BEN, Korrekturpflicht 3, Gegenprobe B): es gab EINEN Satz für jede
 * Einordnungslage, und er erklärte „deine Schlagworte und deine Kategorie" pauschal für nicht
 * durchgekommen. Wer seine Schlagworte gerade erfolgreich gespeichert hatte und nur an der
 * Kategorie abgewiesen wurde, las damit eine Unwahrheit über die eigene Arbeit — genau die
 * Glättung, die „Ehrlichkeit vor Optik" verbietet.
 *
 * DIESELBE BAUFORM WIE `teilSatzSchluessel` DARÜBER, und aus demselben Grund: feste Wortlaute statt
 * einer im Satz gefügten Aufzählung, und jeder nennt BEIDE Hälften — was steht und was nicht.
 *
 * DER ERSTE HALBSATZ („dein Text ist gespeichert") STIMMT IMMER: die beiden Einordnungsaufrufe
 * sind erst NACH einem gelungenen `revise` erreichbar (s. `save`); ein Inhaltskonflikt bricht die
 * Kette vorher ab und bekommt `ko.revise.stale`.
 */
function staleEinordnungSchluessel(offen: Array<"tags" | "category">): string {
  if (offen.length >= 2) {
    return "ko.revise.staleEinordnungTagsCategory";
  }
  return offen[0] === "category"
    ? "ko.revise.staleEinordnungCategory"
    : "ko.revise.staleEinordnungTags";
}

/**
 * JOB 4163 · Der Abbruch MIT SEINEM VERLAUF. `useMutation` reicht an `onError` nur den Fehler
 * durch; wie weit die Kette gekommen war, stünde sonst nirgends. Die Ursache reist mit und wird in
 * `onError` ausgepackt — die bestehenden Zweige (409, `PROPOSAL_REQUIRED`) lesen weiter genau den
 * Fehler, den der Server geschickt hat, nicht diese Hülle.
 */
class SpeicherAbbruch extends Error {
  readonly ursache: unknown;
  /** Steht der Text, der JETZT im Formular steht, am Server? */
  readonly textAktuell: boolean;
  readonly offen: Array<"tags" | "category">;
  /**
   * JOB 4251 · AN WELCHEM GEGENSTAND die Kette gerissen ist — am Inhalt oder an der Einordnung.
   *
   * Ohne diese Angabe wäre der 409 nicht zu unterscheiden, und die Fläche sagte dem Menschen bei
   * einem Einordnungskonflikt „gespeichert wurde nichts" — obwohl sein Text in genau diesem Fall
   * gespeichert IST. Sie steht hier und wird nicht aus `offen` erraten: `offen` sagt, was noch
   * fehlt, nicht, woran es gescheitert ist.
   */
  readonly schritt: "text" | "einordnung";

  constructor(
    ursache: unknown,
    textAktuell: boolean,
    offen: Array<"tags" | "category">,
    schritt: "text" | "einordnung",
  ) {
    super("Speichern unterwegs abgebrochen");
    this.name = "SpeicherAbbruch";
    this.ursache = ursache;
    this.textAktuell = textAktuell;
    this.offen = offen;
    this.schritt = schritt;
  }
}

/**
 * JOB 4163 · DREI LAGEN, DREI TATSACHEN — und keine zweite Aussage über dieselbe.
 *
 * `stale`     — jemand ANDERES hat geschrieben (JOB 4075). `teilVorher` sagt, ob von dieser
 *               Bearbeitung schon ein Stand am Server liegt: dann ist der alte Wortlaut
 *               („gespeichert wurde nichts") unwahr und ein eigener tritt an seine Stelle. Ohne
 *               Teilabbruch bleibt alles, wie JOB 4075 es gebaut hat.
 * `teil`      — der EIGENE Speichervorgang ist zwischen zwei Aufrufen gerissen. `textAktuell`
 *               unterscheidet „dein Text ist gespeichert" von „ein früherer Stand ist gespeichert".
 *               `meldung` ist die rohe Servermeldung; sie darf DANEBEN stehen, nie allein.
 *               `rechtEntzogen` nennt die Ursache, wenn der Server sie mit 403 genannt hat — ohne
 *               sie stünde dort „drück noch einmal", was nichts bringen würde (BEN, Prüflücke 6).
 * `keinRecht` — 403 ohne `PROPOSAL_REQUIRED` und ohne dass etwas geschrieben wurde: das
 *               Schreibrecht ist ganz entzogen. Das ist kein Einreichfall — dort gäbe es einen Weg,
 *               hier gibt es keinen.
 */
/*
 * JOB 4251 · `feld` AN DER STALE-LAGE — WORÜBER der fremde Schreiber dazwischengekommen ist.
 *
 * `"text"` ist die Lage aus JOB 4075/4163, Wort für Wort unverändert. `"einordnung"` ist die neue:
 * der `revise` ist durch, der Text steht am Server, und abgewiesen wurde der Schlagwort- oder
 * Kategorieaufruf. Ihn mit demselben Satz zu melden („gespeichert wurde nichts") wäre die
 * Unwahrheit, die dieser Auftrag beseitigt — und die Fassungszahl, die zum Satz über den INHALT
 * gehört, sagt über die Einordnung ohnehin nichts (sie klettert bei ihr gar nicht).
 */
type SpeicherLage =
  | {
      art: "stale";
      feld: "text" | "einordnung";
      version: number | null;
      teilVorher: boolean;
      /**
       * RUNDE 2 · WELCHE Einordnungsschritte der fremde Schreiber wirklich abgewiesen hat. Bei
       * `feld: "text"` ist die Liste ohne Bedeutung — dort ist gar nichts geschrieben worden.
       */
      offen: Array<"tags" | "category">;
    }
  | {
      art: "teil";
      textAktuell: boolean;
      offen: Array<"tags" | "category">;
      meldung: string;
      rechtEntzogen: boolean;
    }
  | { art: "keinRecht"; meldung: string };

// Die drei Töne des Einreich-Satzes als FLACHE Konstanten — dieselbe Bauform wie `LAGE_SPALTE` &c.
// in `BibliothekListe.tsx` (JOB 3335). Der Sammler `tests/app/mega47-modale-flaechen-sammler.test.tsx`
// liest sie damit; offen bleibt allein die Entscheidung dazwischen, und die gehört an den einen
// Knoten, der den Satz trägt — nicht in drei Abschriften desselben Markups.
const EINREICH_ZEILE = "rounded-btn px-3 py-2 text-[12.5px] leading-relaxed";
const EINREICH_GUT = "bg-trust-pos-bg text-trust-pos-text";
const EINREICH_WARN = "bg-trust-warn-bg text-trust-warn-text";
const EINREICH_SCHLECHT = "bg-trust-crit-bg text-trust-crit-text";

// ================================================================================================
// JOB 3667 R4 · BEFUND 1 — WAS ÜBERNOMMEN WIRD, STEHT VORHER LESBAR DA.
// ================================================================================================
//
// DER FEHLER, DEN DIESE RUNDE BEHEBT (Prüferbefund 13.09.): die Vorschlagsanzeige zeigte allein
// `v.statement`. Der Übernehmen-Knopf genehmigte aber den GANZEN Vorschlag, und
// `KoService.decideProposal` (`service.ts:3891`) schreibt daraus `statement` UND `bodyHtml` in die
// neue Fassung. Ein Fließtext, den niemand gesehen hat, wurde also mitfreigegeben — genau das
// verbietet „Sichtbarkeit ist Pflicht".
//
// DIE ZWEITE FOLGE STAND IN DERSELBEN ZEILE DES DIENSTES, und sie war die grössere: er übergab
// `bodyHtml: vorschlag.bodyHtml ?? null` — AUSDRÜCKLICH `null`, nicht `undefined`. In
// `naechsteFassung` heisst `null` „leeren". Ein Vorschlag OHNE Fließtext — und genau so reicht das
// Word-Fenster ein — hätte bei der Übernahme den Fließtext des Eintrags ENTFERNT.
//
// RUNDE 5 ÄNDERT DIE WIRKUNG, NICHT NUR IHRE ANZEIGE (Steuerung 14.09.): ausgelassen ist nicht
// gelöscht. Der Dienst lässt den bestehenden Fließtext stehen, wenn der Vorschlag keinen mitbringt
// (`service.ts`, `rumpfAusVorschlag`), und leert ihn nur auf das ausdrückliche `clearBody`. Diese
// Fläche rechnet DIESELBE Regel — was hier als Ergebnis steht, ist, was die Übernahme schreibt.
type RumpfLage = "neu" | "gleich" | "bleibt" | "entfernt" | "keiner";

/**
 * Was die Übernahme dieses Vorschlags mit dem Fließtext des Eintrags TUT — aus dem Vorschlag und
 * dem jetzigen Stand gerechnet, nicht behauptet. Getrimmt verglichen, wie überall sonst im Produkt
 * (`koRevisionSummary`): Leerraum am Rand ist keine Änderung.
 *
 * DIE FÜNF LAGEN SIND DIE DREI ZWEIGE DES DIENSTES, je aufgeteilt nach dem, was der Eintrag hat:
 * `clearBody` → „entfernt" (oder „keiner", wenn es nichts zu entfernen gibt); ein Rumpf im
 * Vorschlag → „neu"/„gleich"; kein Rumpf → „bleibt" (oder „keiner").
 */
function rumpfLage(vorschlag: KoProposal, stand: string | null | undefined): RumpfLage {
  const v = (vorschlag.bodyHtml ?? "").trim();
  const s = (stand ?? "").trim();
  if (vorschlag.clearBody === true) {
    return s.length === 0 ? "keiner" : "entfernt";
  }
  if (v.length === 0) {
    return s.length === 0 ? "keiner" : "bleibt";
  }
  return v === s ? "gleich" : "neu";
}

// ================================================================================================
// JOB 3667 R4 · BEFUND 2 — WAS DER PRÜFWEG NICHT TRÄGT, BIETET ER AUCH NICHT AN.
// ================================================================================================
//
// Ein `KoProposal` trägt `statement` und `bodyHtml`, sonst nichts (`api/types.ts:61`), und die
// Übernahme schreibt auch nur diese beiden (`service.ts:3891`). Titel, Art, Kategorie, Bedingungen,
// Maßnahmen und Schlagworte gingen auf diesem Weg NIE hinaus — der direkte Speicherweg schickt sie
// (`revise` plus `tags`/`category`), der Einreich-Aufruf nicht. Ein Formular, das sie im Prüfweg als
// bearbeitbar anbietet, verspricht ein „eingereicht", das der Server nie bekommen hat.
//
// DIE KENNUNGEN SIND DIE VON `koRevisionSummary` — dieselbe Vergleichslogik, die der
// Änderungsüberblick schon benutzt. Eine zweite Abschrift wäre die zweite Wahrheit.
const EINGEREICHTE_FELDER: readonly KoRevisionItemId[] = ["statement", "body"];

// ==================================================================================================
// JOB 4145 R3 · DAS SPRUNGZIEL IST DAS ELEMENT SELBST — ES GIBT KEINE POSITION MEHR.
// ==================================================================================================
//
// ZWEIMAL ROT MIT DEMSELBEN BEFUND, und beide Male war die Angleichung einer TEXT-Auswertung an den
// Baum die Wette, die verloren ging:
//
//   R1  `d44Gliederung(gezeichneterText)` — der HTML-String. BEN:
//       `<h2>Eins<h2>Zwei</h2><p>Absatz</p><h2>Drei</h2>` → die Regex schliesst am ERSTEN `</h2>`
//       und zählt ZWEI, der Browser schliesst das offene `<h2>` und hat DREI.
//   R2  `d44Gliederung(knoten.innerHTML)` — die Rückserialisierung. BEN:
//       `<h2>Eins<strong><h2>Zwei</h2></strong></h2><p>Absatz</p><h2>Drei</h2>` → hier schliesst der
//       Browser NICHT (die Regel greift nur, wenn das offene Element selbst eine Überschrift ist;
//       hier steht `<strong>` dazwischen). Die Verschachtelung BLEIBT im Baum, `innerHTML` gibt sie
//       so zurück, und die Regex liest wieder „EinsZwei" als EINEN Eintrag — drei Elemente, zwei
//       Einträge, „Drei" trifft „Zwei".
//
// `innerHTML` GARANTIERT ALSO KEINE FLACHE ÜBERSCHRIFTENSTRUKTUR. Jede weitere Angleichung des
// Textlesens wäre die dritte Wette auf dasselbe Blatt.
//
// ==================================================================================================
// DESHALB WIRD HIER NICHT MEHR GEZÄHLT, SONDERN GEZEIGT.
// ==================================================================================================
//
// Die Marken kommen aus dem GERENDERTEN BAUM: `querySelectorAll` über den Inhaltscontainer liefert
// die Überschriftenelemente in Dokumentreihenfolge; Ebene aus dem Tag, Text aus `textContent` — und
// das SPRUNGZIEL IST DIE ELEMENTREFERENZ SELBST. Damit gibt es zwischen „was die Leiste zeigt" und
// „wohin sie springt" nichts mehr, das auseinanderlaufen könnte: kein Index, keine Position, keine
// zweite Zählung. Positionsgleichheit durch Konstruktion statt durch Angleichung.
//
// KEINE `id` UND KEIN ANKER: die Referenz trägt das Ziel schon. Eine vergebene `id` wäre ein
// zweiter Schlüssel auf denselben Knoten — und sie müsste in fremdes, sanitisiertes HTML
// geschrieben werden, genau das, was `d44Struktur.ts:40-41` für die Studio-Leiste vermeidet.
//
// DIE GEMEINSAME D44-AUSWERTUNG BLEIBT IN GEBRAUCH — für ANZEIGE und STRUKTUR, nicht mehr für die
// Ziele (Auftrag der Steuerung, 15.09. 20:08): `d44LeisteZeigen` entscheidet, ob die Leiste
// überhaupt steht, `d44SichtbareEintraege` hält die Regel „gezählt wird alles, GEZEIGT wird, was
// Text hat" (`d44Struktur.ts:85-94`). Beide bekommen die aus dem Baum gebauten `D44Eintrag`. Die
// Zuordnung Eintrag → Element läuft über OBJEKTIDENTITÄT (`Set.has`), nicht über `position` —
// `d44SichtbareEintraege` filtert und gibt dieselben Objekte zurück. `d44Gliederung`, die
// Regex-Auswertung, wird hier NICHT mehr gerufen; sie bleibt unverändert und ist weiterhin die
// Auswertung der Studio-Leiste (`D44Gliederung.tsx:44`).
//
// GESAMMELT WIRD `h1…h6` UND NICHT NUR `h2, h3`: der Client-Sanitizer bildet `h1 → h2` und
// `h4/h5/h6 → h3` ab (`lib/richText.ts:51-57`), im Baum stehen also normalerweise nur h2 und h3 —
// aber die Lesespalte zeichnet nicht nur sanitisiertes Body-HTML, und eine Überschrift, die dasteht
// und nicht in der Leiste auftaucht, wäre wieder eine stille Lücke. `[role=heading]` steht
// ABSICHTLICH NICHT im Selektor: `role` ist in keiner Attribut-Freigabe des Sanitizers
// (`richText.ts:58-75`), kann aus dem Body also gar nicht kommen — ein Selektor für einen Fall, den
// kein Test erreichen kann, wäre unbelegter Code.
//
// WARUM EIN EIGENES BAUTEIL UND NICHT EIN HOOK IN DER LESEFLÄCHE: `BibliothekLesen` kehrt vorher
// zurück (Fehler- und Ladezweig); ein Hook an jener Stelle verstiesse gegen die Hook-Regel. Das
// Bauteil steht in derselben Datei, wird nicht exportiert und hat genau einen Aufrufer.

/** Eine Überschrift der Lesespalte: was sie anzeigt, und der Knoten, zu dem sie führt. */
interface Sprungmarke {
  /** Für Anzeige und Struktur — gelesen von `d44SichtbareEintraege`/`d44LeisteZeigen`. */
  readonly eintrag: D44Eintrag;
  /** Das Ziel. Kein Index, keine Kennung: der Knoten selbst. */
  readonly ziel: HTMLElement;
}

/**
 * Die Überschriften des gerenderten Inhalts, in Dokumentreihenfolge.
 *
 * `position` ist der Index in GENAU DIESER Liste — sie wird nirgends zum Nachschlagen benutzt
 * (dafür gibt es `ziel`), sondern trägt nur die Zusage von `d44SichtbareEintraege`, dass eine leere
 * Überschrift mitzählt, ohne angezeigt zu werden. Der Text wird auf einfache Leerzeichen
 * zusammengezogen — dieselbe Reduktion, die `htmlToPlainText` für die Studio-Leiste leistet
 * (`d44-gliederung.test.ts` B3: „Erste\n   Zeile" → „Erste Zeile").
 */
function sprungmarken(knoten: HTMLElement | null): Sprungmarke[] {
  if (!knoten) {
    return [];
  }
  const gefunden = knoten.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
  return [...gefunden].map((ziel, position) => ({
    ziel,
    eintrag: {
      ebene: Number(ziel.tagName.slice(1)) >= 3 ? 3 : 2,
      text: (ziel.textContent ?? "").replace(/\s+/g, " ").trim(),
      position,
    },
  }));
}

/**
 * R4 · Das Ersatzziel, wenn die gespeicherte Referenz nicht mehr am Baum hängt.
 *
 * Gesucht wird ZUERST an derselben Position und nur, wenn dort derselbe Text steht — so trifft es
 * auch bei zwei gleich benannten Abschnitten den richtigen. Steht dort etwas anderes (die Reihe hat
 * sich verschoben), gilt der Text als zweiter Anker. Findet sich beides nicht, gibt es kein Ziel,
 * und der Aufrufer tut nichts: lieber ein wirkungsloser Knopf als ein Sprung irgendwohin.
 */
function ersatzziel(knoten: HTMLElement | null, eintrag: D44Eintrag): HTMLElement | null {
  const frisch = sprungmarken(knoten);
  const anPosition = frisch[eintrag.position];
  if (anPosition && anPosition.eintrag.text === eintrag.text) {
    return anPosition.ziel;
  }
  return frisch.find((marke) => marke.eintrag.text === eintrag.text)?.ziel ?? null;
}

/**
 * Zwei Markenlisten beschreiben denselben Baum.
 *
 * Verglichen wird die ELEMENTIDENTITÄT, nicht der Text: genau daran hängt der Befund aus Runde 3.
 * Beim Wechsel Übersetzung → Original ist das HTML Zeichen für Zeichen dasselbe, aber React baut
 * den Teilbaum neu — die Texte gleichen sich, die Knoten sind andere. Ein Textvergleich sähe
 * „unverändert" und liesse die alten, abgehängten Knoten stehen.
 */
function markenGleich(a: readonly Sprungmarke[], b: readonly Sprungmarke[]): boolean {
  return (
    a.length === b.length &&
    a.every((marke, i) => marke.ziel === b[i]?.ziel && marke.eintrag.text === b[i]?.eintrag.text)
  );
}

function Lesegliederung({
  flaeche,
  beschriftung,
  onSprung,
}: {
  /**
   * Der Knoten, in dem gezeichnet wird. Aus ihm kommen die Marken — und ihre Ziele.
   *
   * R5 · DER KNOTEN SELBST, NICHT DAS `ref`-OBJEKT, IN DEM ER IRGENDWANN STEHT. Der Grund steht bei
   * `textKnotenSetzen` in `BibliothekLesen`: beim ersten Einbau ist das `ref` hier noch leer.
   */
  readonly flaeche: HTMLDivElement | null;
  readonly beschriftung: string;
  readonly onSprung: (marke: Sprungmarke) => void;
}): JSX.Element | null {
  const [marken, setMarken] = useState<Sprungmarke[]>([]);
  // ================================================================================================
  // R4 · GESAMMELT WIRD NACH JEDEM RENDER DES INHALTS — OHNE ABHÄNGIGKEIT VOM HTML-STRING.
  // ================================================================================================
  //
  // BENS BEFUND AN RUNDE 3: Übersetzung → Original mit IDENTISCHEM `bodyHtml`. Der String ändert
  // sich nicht, der Zweig aber schon (`gelesen ? … : …`), und React baut den Teilbaum neu. Die in
  // Runde 3 gespeicherten Elementreferenzen zeigten danach auf abgehängte Knoten; `isConnected`
  // machte jeden Knopf wirkungslos — ein stiller Totalausfall der Leiste.
  //
  // KEINE ABHÄNGIGKEITSLISTE. Der Effekt läuft nach JEDEM Renderdurchlauf und sammelt neu; geprüft
  // wird am Ergebnis, nicht an einem Merkmal: nur wenn sich die ELEMENTE unterscheiden, wird der
  // Zustand gesetzt. Damit endet die Schleife nach höchstens einem zusätzlichen Durchlauf, und es
  // gibt kein Merkmal mehr, das „unverändert" sagen könnte, während der Baum ein anderer ist.
  //
  // `useLayoutEffect` UND NICHT `useEffect`: er läuft nach den DOM-Änderungen, aber VOR dem
  // Zeichnen. Die Leiste kann deshalb gar nicht erst für einen Bildaufbau mit alten Einträgen neben
  // neuem Text stehen — die Zusage aus §9 („nie vorab, immer mit dem Text zusammen") hängt seitdem
  // nicht mehr an einem String-Vergleich, sondern am Renderzyklus selbst.
  //
  // R5 · UND DER KNOTEN KOMMT ALS WERT HEREIN, NICHT ALS `ref`-OBJEKT. Warum das kein Geschmack
  // ist, steht bei `textKnotenSetzen`: als `ref` gelesen war dieser Effekt beim ERSTEN Einbau
  // regelmässig zu früh dran und fand `null` — und weil er dann nichts setzte, zeichnete auch nichts
  // nach. Als Wert kann das gar nicht mehr passieren: ein Knoten ist da oder nicht, und wenn er
  // dazukommt, ist das ein Renderdurchlauf.
  useLayoutEffect(() => {
    const frisch = sprungmarken(flaeche);
    setMarken((vorher) => (markenGleich(vorher, frisch) ? vorher : frisch));
  });
  const alle = marken.map((m) => m.eintrag);
  if (!d44LeisteZeigen(alle)) {
    // Ohne Überschrift steht hier GAR NICHTS — kein Rahmen, kein Satz „keine Überschriften". Ein
    // leerer Rahmen wäre eine Zusage ohne Gegenstand, ein Satz wäre Erklärtext in der Lesespalte
    // (`tests/design/zielbild-h4-kein-erklaertext.test.ts`). Das ist der eine Unterschied zur
    // Studio-Leiste, die an ihrem Ort den Satz zeigt: dort ist sie das Werkzeug des Prüfers, hier
    // ist die Spalte der Inhalt.
    return null;
  }
  // Über OBJEKTIDENTITÄT, nicht über `position`: `d44SichtbareEintraege` filtert und liefert
  // dieselben Objekte zurück. Ein Nachschlagen über eine Zahl wäre wieder die Naht, an der die
  // letzten zwei Runden gebrochen sind.
  const sichtbar = new Set(d44SichtbareEintraege(alle));
  // Die Beschriftungen sind die Überschriften SELBST und werden nicht übersetzt; nur der
  // zugängliche Name des Bereichs kommt aus `i18n.ts`. Beide `className` sind reine Literale —
  // `mega47-modale-flaechen-sammler` zählt jede unauflösbare Klassenbindung und pinnt ihre Zahl;
  // die Einrückung der Unterpunkte trägt deshalb ein Abstandhalter im Kindbereich, kein Ausdruck
  // in der Klasse (Bauform aus `D44Gliederung.tsx:98-108`).
  return (
    <nav
      aria-label={beschriftung}
      data-testid="bib-gliederung"
      className="max-h-40 overflow-y-auto rounded-card border border-hairline bg-page px-2.5 py-2"
    >
      <ul className="space-y-0.5 text-[12.5px]">
        {marken
          .filter((marke) => sichtbar.has(marke.eintrag))
          .map((marke) => (
            <li key={`${marke.eintrag.position}-${marke.eintrag.text}`}>
              <button
                type="button"
                data-testid={`bib-gliederung-sprung-${marke.eintrag.position}`}
                onClick={() => onSprung(marke)}
                className="block w-full truncate text-left text-muted hover:text-text"
              >
                {marke.eintrag.ebene === 3 ? <span className="inline-block w-4" /> : null}
                {marke.eintrag.text}
              </button>
            </li>
          ))}
      </ul>
    </nav>
  );
}

export function BibliothekLesen({
  koId,
  suchtext,
  treffer,
  onGeloescht,
  hinweisSchonGesagt,
  lesevarianteSchonGesagt,
}: {
  koId: string;
  // Der Text aus dem Suchfeld — er belegt die Frage auf der Fragen-Seite vor (5a: die frühere Karte
  // „Antwort statt nur Treffer?" ist dieser Knopf).
  suchtext: string;
  // SCRUM-245: WARUM dieser Eintrag zur Suche passt. Nur bei aktiver Suche — ohne Suche gibt es
  // keinen Treffergrund, und ein leerer Chip-Streifen wäre Rauschen im Ruhezustand.
  treffer: readonly MatchField[];
  onGeloescht: () => void;
  // JOB 3063 R6: sagt die LISTE schon, dass ihr Bestand nicht frisch ist, wiederholt die Lesefläche
  // es nicht. Es ist EINE Aussage über EINE Fläche; zweimal derselbe Satz wäre die zweite Auslegung
  // derselben Tatsache (und `stufe-im-klartext` misst auf `/wissen/:id` genau einen).
  hinweisSchonGesagt: boolean;
  // ================================================================================================
  // JOB 3362 · LESEVARIANTE-FLAECHEN — DIESELBE REGEL WIE BEIM AUFFRISCHUNGSSATZ: GENAU EINMAL.
  // ================================================================================================
  // Auf `/wissen/:id` steht die übersetzte Leseansicht seit JOB 3326 SCHON über dieser Fläche
  // (`pages/KnowledgeDetail.tsx:90-113`, eigene Karte mit Hinweis und Umschalter). Zeigte die
  // Lesefläche sie dort ein zweites Mal, stünde dieselbe Übersetzung zweimal untereinander, mit zwei
  // Umschaltern, die verschiedene Dinge tun — und der frische Abruf liefe zweimal je Öffnen.
  // Der Aufrufer sagt deshalb, ob die Aussage schon dasteht; dann schweigt diese Fläche dazu UND
  // fragt gar nicht erst (`koId: undefined` ⇒ kein GET, s. `useFrischeLesevariante`).
  //
  // WARUM NICHT DIE KARTE IN `KnowledgeDetail` ENTFERNEN — das wäre der bessere Weg und ist als
  // Restschuld benannt: `pages/KnowledgeDetail.tsx` gehört nicht zu den Zielpfaden dieses Auftrags
  // (REGELN §3). Die Kennzeichnung ist an beiden Orten dieselbe (`LesevarianteHinweis`).
  lesevarianteSchonGesagt?: boolean | undefined;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const query = useKo(koId);
  const conflicts = useConflicts();
  const audit = useAudit();
  // JOB 3068 · N5: die zwei weiteren Quellen der Kollisions-Auskunft. Beide sind auf dieser Fläche
  // KOSTENLOS: `useKos` teilt sich den Schlüssel `["kos"]` mit der Liste links
  // (`BibliothekFlaeche.tsx:235`), und `useEigeneBefunde` ist eine einzige, kleine Antwort ohne
  // Objektdaten. Sie stehen HIER und nicht mehr in `MehrAbschnitte`, weil die Auskunft dauerhaft
  // sichtbar sein muss — s. den Abschnitt „DER EIGENE BEFUND" im Kopf.
  const koListe = useKos();
  const eigeneBefunde = useEigeneBefunde();
  // JOB 3084 · Q6: die dritte Voraussetzung dieser Auskunft — kann gerade überhaupt geprüft werden?
  // Aus der EINEN Quelle (`lib/netzzustand.ts`, `onlineManager`), nicht aus `navigator.onLine`.
  const netzOnline = useNetzOnline();
  const { role } = useRole();
  const { user } = useSession();
  const { push } = useToast();
  const qc = useQueryClient();
  const nameOf = useAuthorName();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  // JOB 3667 R3: „darf gleich als geprüft ablegen" — der Spiegel von `users.manage`, s. oben.
  const darfFreigeben = RW_FREIGABE_ROLLEN.includes(role);
  const reviewReworkContext = isReviewReworkContext(params);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioApplied, setStudioApplied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mehrOffen, setMehrOffen] = useState(false);
  // JOB 3108 · UX-03: wohin die Sprungzeile am Kopf führt. `nonce`, damit derselbe Abschnitt
  // zweimal hintereinander anspringbar bleibt (zwischendurch von Hand zugeklappt).
  const [sprungZiel, setSprungZiel] = useState<Sprungziel | null>(null);
  const mehrId = useId();
  // JOB 3474 · REVIEW26: der Fließtext als Sprungziel — der Kopfknopf zur Originaldatei holt IHREN
  // Link (er steht schon im Text) ins Bild und gibt ihm den Fokus. Der Bezug geht über den
  // gezeichneten Baum, nicht über eine zweite Adressrechnung.
  const textRef = useRef<HTMLDivElement | null>(null);
  // ================================================================================================
  // JOB 4145 R5 · DER KNOTEN DES FLIESSTEXTS IST EIN ZUSTAND, KEIN STILLES `ref`.
  // ================================================================================================
  //
  // WAS IM TOR VOM 15.09. 23:05 GESCHAH: `gliederung-mit-tastatur-chromium.test.ts` kam über den
  // Seitenaufbau nicht hinaus — `[data-testid="bib-gliederung"]` stand 30 s lang NICHT im Baum. Die
  // Leiste war nicht falsch, sie war NICHT DA.
  //
  // DIE URSACHE IST DIE REIHENFOLGE DES EINBAUS. `<Lesegliederung>` steht im Baum VOR
  // `<div ref={textRef}>` — so verlangt es Lieferung 3, damit die Knöpfe in der
  // Tabulatorreihenfolge vor dem Fliesstext liegen. React geht den Baum beim Einbau EINMAL in
  // Dokumentreihenfolge durch und erledigt je Knoten das Seine: `ref` anhängen, Layouteffekte
  // laufen lassen. Das Bauteil kommt in dieser Reihe VOR dem `div`; als es `textRef.current` las,
  // war die `ref` noch nicht gesetzt. Es sammelte nichts — und weil es nichts sammelte, setzte es
  // auch keinen Zustand und stiess keinen zweiten Durchlauf an. (Der Kommentar, der bis R4 hier
  // stand, hat genau das verwechselt: React legt die KNOTEN wirklich alle vorher an, aber die `ref`
  // wird erst in diesem Durchgang gefüllt.)
  //
  // Die Leiste erschien deshalb nur, wenn ZUFÄLLIG etwas anderes noch einmal zeichnete — eine
  // nachlaufende Abfrage, eine Meldung. Kommen die Antworten aus dem Vorrat (derselbe Eintrag ein
  // zweites Mal geöffnet), bleibt der Einbau der LETZTE Durchlauf, und die Leiste fehlt dauerhaft:
  // kein Fehler, keine Meldung, nichts. Gemessen in `tests/wiki-orientierung/…lesespalte.test.tsx`
  // (Y1) — am Stand vor dieser Zeile stand dort `null`, während der Text schon seine drei
  // Überschriften trug.
  //
  // DER RÜCKRUF SCHLIESST DAS BAULICH. Er läuft, wenn React den Knoten anhängt, und macht daraus
  // einen ZUSTAND; die Änderung eines Zustands ist ein Renderdurchlauf, und den kann kein Zufall
  // mehr ausbleiben lassen. `textRef` bleibt daneben stehen: `springeZurUeberschrift` und
  // `springeZurDatei` brauchen den Knoten ausserhalb des Zeichnens, und ein `ref` ist dafür das
  // Richtige. Beide zeigen auf denselben Knoten, gesetzt in derselben Zeile.
  const [textKnoten, setTextKnoten] = useState<HTMLDivElement | null>(null);
  const textKnotenSetzen = useCallback((knoten: HTMLDivElement | null): void => {
    textRef.current = knoten;
    setTextKnoten(knoten);
  }, []);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [reworkSavedFor, setReworkSavedFor] = useState<string | null>(null);
  const reworkSaved = reviewReworkContext && reworkSavedFor === koId;
  const [detailFeedback, setDetailFeedback] = useState<FeedbackVerdict | null>(null);
  const [detailFeedbackText, setDetailFeedbackText] = useState("");
  const [appendUnclear, setAppendUnclear] = useState(false);
  // ================================================================================================
  // JOB 3667 R3 · DER ZUSTAND DES EINREICHWEGS. VIER GRÖSSEN, JEDE MIT EINEM GRUND.
  // ================================================================================================
  //
  // `pruefwegHaken`  — FALL 3, und nur er: der Berechtigte wählt die fremde Prüfung freiwillig. Beim
  //                    nicht Berechtigten wird der Haken gar nicht gezeichnet; dort ist die Prüfung
  //                    Pflicht, und ein abwählbarer Haken wäre die Unwahrheit.
  // `einreichLage`   — der EINE Satz über den letzten Einreichversuch (`EinreichLage` oben). Er steht
  //                    getrennt von `err`, weil `err` das Speichern betrifft: „eingereicht" ist kein
  //                    Fehler, und „gesperrt" ist keine gescheiterte Eingabe.
  // `sperreGemeldet` — die Route hat 403 `PROPOSAL_REQUIRED` geantwortet. Dann steht der Einreichweg
  //                    auch dann zur Verfügung, wenn die Fläche ihn NICHT vorausgewählt hatte (das
  //                    Objekt wurde freigegeben, während jemand tippte). Das ist der Riegel gegen die
  //                    Sackgasse — und er reicht NICHT von selbst ein: der Mensch greift noch einmal.
  // `ablehnung`      — über welchen Vorschlag gerade eine Ablehnung geschrieben wird, samt Begründung.
  //                    Ohne sie wäre „abgelehnt" eine Tatsache ohne Auskunft.
  const [pruefwegHaken, setPruefwegHaken] = useState(false);
  const [einreichLage, setEinreichLage] = useState<EinreichLage | null>(null);
  // JOB 4075: der Konflikt des DIREKTEN Speicherwegs, getrennt von `einreichLage` (s. `SpeicherLage`).
  const [speicherLage, setSpeicherLage] = useState<SpeicherLage | null>(null);
  const [sperreGemeldet, setSperreGemeldet] = useState(false);
  const [ablehnung, setAblehnung] = useState<{ id: string; grund: string } | null>(null);
  const appendOriginalRef = useRef<OriginalRefCache>({ ref: null });
  const [captionRequest, setCaptionRequest] = useState<{
    imageId: string;
    src: string;
    index: number;
    nonce: number;
  } | null>(null);
  // SCRUM-417: der Deep-Link `?edit=1` öffnet den Bearbeiten-Modus genau EINMAL je Eintrag.
  const autoEditDone = useRef(false);

  // ================================================================================================
  // JOB 3362 · LESEVARIANTE-FLAECHEN — DIE LESEFLÄCHE LIEST IN DER LESESPRACHE.
  // ================================================================================================
  //
  // Derselbe Weg wie auf `/wissen/:id` (JOB 3326 R3): ein FRISCHER Abruf je Öffnen, kein Vorrat.
  // Was hier steht, stammt ausschliesslich aus dieser einen Antwort — die ausgeschriebene Begründung
  // (zwei gemessene Befunde) steht in `lib/lesevariante.ts`. Der Vorrat bleibt der LISTE links
  // vorbehalten, wo ein Abruf je Zeile ein Anfragesturm wäre.
  //
  // ÜBERSETZT WERDEN GENAU DREI DINGE: Titel, Kernaussage und Fließtext. Alles andere auf dieser
  // Fläche — Kennung, Bereich, Zustandspille, Vertraulichkeit, Quellen, Anhänge, Prüfung, Freigabe,
  // Historie, der Weg nach „Fragen" — bleibt WÖRTLICH am Original. Das Bearbeiten-Formular sieht die
  // Übersetzung nie: `startEdit` liest `ko`, und gespeichert wird immer das Original.
  const sprache = sprachcode(i18n.language);
  const leselage = useFrischeLesevariante(lesevarianteSchonGesagt ? undefined : koId, sprache);
  const lesevariante = leselage.zustand === "da" ? leselage.variante : undefined;
  const [zeigtOriginal, setZeigtOriginal] = useState(false);
  // Ein Sprachwechsel setzt die Wahl „Original anzeigen" zurück — sie gehörte zur vorherigen
  // Anzeige. `koId` steht mit in den Abhängigkeiten, obwohl die Fläche diese Komponente je Eintrag
  // mit `key={koId}` neu montiert: die Rücksetzung soll nicht davon abhängen, dass ein Aufrufer
  // diesen Schlüssel setzt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sprache`/`koId` sind der AUSLÖSER, nicht gelesene Größen.
  useEffect(() => {
    setZeigtOriginal(false);
  }, [sprache, koId]);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", koId] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["library"] });
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
    void qc.invalidateQueries({ queryKey: ["lifecycle"] });
  };

  const act = useMutation({
    mutationFn: (body: KoAction) => endpoints.ko.act(koId, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });
  const detailReview = useMutation({
    mutationFn: async ({ verdict, text }: { verdict: FeedbackVerdict; text: string }) => {
      await endpoints.ko.act(koId, {
        action: "comment",
        text: buildValidationFeedback(verdict, text),
      });
      await endpoints.ko.act(koId, { action: "rate", verdict });
    },
    onSuccess: () => {
      invalidate();
      setDetailFeedback(null);
      setDetailFeedbackText("");
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });
  // JOB 3637: der ECHTE Fehlschlag wird NICHT als Toast in die untere rechte Ecke geschoben,
  // sondern steht in der Rückfrage selbst — dort, wo geklickt wurde, und er bleibt stehen, statt
  // nach ein paar Sekunden zu verfallen. Deshalb meldet `onError` ihn NICHT weg, sondern lässt ihn
  // bei der Mutation liegen; gelesen wird er unten aus `removeKo.error`.
  //
  // ================================================================================================
  // JOB 3777 · EIN SCHON GELÖSCHTES WISSENSOBJEKT IST KEIN FEHLSCHLAG.
  // ================================================================================================
  //
  // Antwortet der Server mit 404, war das Objekt zwischen Öffnen der Rückfrage und dem Bestätigen
  // schon weg — jemand anderes (oder ein zweites Fenster) war schneller. Der Wunsch des Nutzers ist
  // damit erfüllt, nicht gescheitert: er bekommt denselben Abschluss wie beim Löschen, nur mit dem
  // ehrlicheren Satz (`ko.deleteAlreadyGone` sagt „war bereits nicht mehr vorhanden", nicht
  // „gelöscht" — DIESER Aufruf hat nichts gelöscht).
  //
  // DIE ENTSCHEIDUNG „schon weg?" HAT GENAU EINE QUELLE IM HAUS: `isStaleKoDeleteError`
  // (`lib/validationDelete.ts:32`). Dieselbe Funktion beantwortet den 404 in der Prüfliste seit
  // jeher als Erfolg (`pages/Validation.tsx:296`) — bis JOB 3777 war die Bibliothek die einzige
  // Fläche, die dieselbe Tatsache gegenteilig las. Hier steht deshalb KEINE eigene Statusabfrage.
  const removeKo = useMutation({
    mutationFn: () => endpoints.ko.remove(koId),
    onSuccess: () => {
      setLoeschenOffen(false);
      invalidate();
      push("success", t("ko.deleteDone"));
      onGeloescht();
    },
    onError: (e) => {
      if (!isStaleKoDeleteError(e)) {
        return; // echter Fehlschlag: bleibt liegen und wird unten am Bedienort gelesen.
      }
      // Zeichengleich zum Erfolgsweg oben — nur der Satz ist ein anderer. `invalidate()` ist der
      // Grund, aus dem der zweite Halbsatz („Liste aktualisiert.") überhaupt zulässig ist, und
      // `onGeloescht()` nimmt die jetzt tote Kennung aus der Adresse (`BibliothekFlaeche.tsx:1889`).
      setLoeschenOffen(false);
      invalidate();
      push("success", t("ko.deleteAlreadyGone"));
      onGeloescht();
    },
  });
  // DIE HALBHEIT, DIE HIER AUSGESCHLOSSEN WIRD: ein `onError`, das nur meldet, reicht NICHT. Der
  // Fehler bleibt an der Mutation liegen, `removeKo.isError` bliebe wahr — und damit hielte
  // `loeschenOffenEffektiv` (unten) die Rückfrage offen. Der Nutzer stünde vor einer Erfolgsmeldung
  // UND einem Dialog, den er selbst wegklicken muss; genau das, was dieser Auftrag beseitigt.
  //
  // ABGELEITET statt `removeKo.reset()` im Zweig oben, aus zwei Gründen: (1) `reset()` innerhalb
  // des eigenen `useMutation`-Aufrufs griffe auf `removeKo` zu, bevor die Bindung steht — TypeScript
  // kann den Typ dann nicht mehr schliessen. (2) Die Ableitung sagt die Sache selbst: ein „war schon
  // weg" IST kein Fehlerzustand dieser Fläche, es ist nur der andere Ausgang.
  //
  // Der 404 bleibt danach an der Mutation liegen, und das schadet nichts: er zeichnet keinen roten
  // Satz mehr und hält nichts offen. `loeschenSchliessen` setzt ihn zurück, sobald jemand die
  // Rückfrage wieder bewusst schliesst, und beim Wechsel des Eintrags baut `key={gewaehltEffektiv}`
  // die Fläche ohnehin neu (`BibliothekFlaeche.tsx:1870`).
  const schonWeg = isStaleKoDeleteError(removeKo.error);
  const loeschFehler =
    removeKo.error && !schonWeg
      ? removeKo.error instanceof ApiError
        ? removeKo.error.message
        : t("state.error")
      : null;
  // ================================================================================================
  // JOB 3637 R2 · BEN-KORREKTURPFLICHT 1 — EIN LAUFENDER LÖSCHAUFRUF GEHT NICHT MEHR VERLOREN.
  // ================================================================================================
  //
  // DER FEHLER AUS RUNDE 1, gemessen von BEN: `loeschenSchliessen` setzte die Mutation IMMER zurück.
  // Escape, der Schliessen-Knopf und der Klick auf den Hintergrund laufen alle drei durch `onClose`
  // von `Modal` — wer also bestätigte und dann Escape drückte, warf den Sperrzustand (`isPending`)
  // UND die spätere Fehlerantwort weg. BENs Gegenprobe wörtlich: `{"gesperrt":false,"fehlerSichtbar":false}`.
  // Der Aufruf war längst beim Server; die Fläche behauptete, es sei nichts los.
  //
  // DIE ABHILFE STEHT AN ZWEI STELLEN, UND BEIDE SIND NÖTIG:
  //   1. ZURÜCKGESETZT WIRD NUR, WENN NICHTS UNTERWEGS IST. Ein `reset()` mitten im Aufruf ist das
  //      Vergessen einer Tatsache, nicht das Schliessen einer Fläche.
  //   2. OFFEN IST DIE RÜCKFRAGE AUCH DANN, WENN EIN AUFRUF LÄUFT ODER GESCHEITERT IST. Deshalb ist
  //      `offen` hier ABGELEITET und nicht bloss der Schalter `loeschenOffen`.
  //
  // WARUM ABGELEITET UND NICHT „Schliessen einfach verbieten": ein Schliessen-Knopf, der nichts tut,
  // wäre eine Scheinfunktion. Escape und der Knopf WIRKEN weiter — sie setzen den Schalter um. Die
  // Fläche bleibt nur so lange stehen, wie es etwas zu sagen gibt: der Aufruf läuft (beide Knöpfe
  // sind sichtbar gesperrt), oder er ist gescheitert (der Grund steht da). Danach schliesst
  // derselbe Handgriff sie wirklich — dann greift `reset()`, `offen` wird falsch, die Fläche geht.
  //
  // Was daraus FOLGT und der Grund für Korrekturpflicht 1 war: eine zweite Freigabe ist während des
  // Aufrufs nicht möglich. Der Bestätigungsknopf hängt an `removeKo.isPending`, und der Weg zum
  // Menü liegt hinter der offenen, gesperrten Fläche.
  //
  // JOB 3777 · UND `schonWeg` IST HIER AUSGENOMMEN. „Gescheitert" heisst: es gibt etwas zu sagen,
  // das der Nutzer noch nicht weiss. Beim 404 weiss er es schon — er hat gerade die Meldung
  // bekommen, die Liste ist frisch, die Adresse zeigt nicht mehr auf die tote Kennung. Bliebe die
  // Fläche auch dann stehen, wäre aus der Reparatur genau die Falle geworden, die L10 verbietet.
  const loeschenOffenEffektiv =
    loeschenOffen || removeKo.isPending || (removeKo.isError && !schonWeg);
  /**
   * Die Rückfrage schliessen. Solange der Löschaufruf unterwegs ist, nimmt das NUR den Schalter
   * zurück — die Fläche bleibt stehen (s. `loeschenOffenEffektiv`) und die Mutation behält ihren
   * Zustand. Erst wenn nichts mehr läuft, verfällt auch der Fehlschlag der letzten Runde.
   */
  const loeschenSchliessen = (): void => {
    setLoeschenOffen(false);
    if (!removeKo.isPending) {
      removeKo.reset();
    }
  };
  /**
   * JOB 3667 R3: das Bearbeiten verlassen — und dabei ALLES zurücknehmen, was zum vorigen Versuch
   * gehörte. Ein „eingereicht" oder eine gemeldete Sperre, die über dem nächsten, frisch geöffneten
   * Formular stehenbliebe, wäre eine Auskunft über einen Vorgang, den es nicht mehr gibt.
   */
  const bearbeitenBeenden = (): void => {
    setEdit(null);
    setEinreichLage(null);
    setSpeicherLage(null);
    setSperreGemeldet(false);
    setPruefwegHaken(false);
    // JOB 4163: die Buchführung gehört zu DIESEM Formular. Ist es zu — weil alles angekommen ist
    // oder weil abgebrochen wurde —, gibt es nichts mehr nachzuholen; sie über ein neues Formular
    // hinweg stehenzulassen, hiesse einen Schritt zu überspringen, den niemand gemacht hat.
    teilstandRef.current = null;
  };

  // ================================================================================================
  // JOB 4075 · DER DIREKTWEG SCHREIBT BEDINGT — UND SAGT, WENN JEMAND DAZWISCHENGEKOMMEN IST.
  // ================================================================================================
  //
  // DIE LAGE, DIE DIESE ZEILEN SCHLIESSEN. Der Dienst kann den bedingten Schreibzugriff seit JOB 3667
  // (Compare-and-Set in `KoService.revise`), die Route nimmt ihn seit Runde 2 an
  // (`ko-routes.ts:2079-2096`, 409 `KO_STALE`), und der Client-Vertrag führt ihn
  // (`endpoints.ts`, `expectedVersion?`). NUR diese Fläche benutzte ihn nicht — zwei Fenster, zwei
  // Bearbeiter, und der Zweite überschrieb den Ersten, ohne dass irgendwo etwas aufschlug. Pedis
  // Zusage aus JOB 3667 („Hat sich das Objekt zwischenzeitlich geändert, wird NICHT stillschweigend
  // überschrieben") galt im Word-Fenster und im Einreichweg, hier nicht.
  //
  // DIE FASSUNG KOMMT ALS ARGUMENT, NICHT AUS `edit`. Dieselbe Bauform wie `baseVersion` bei
  // `einreichen`, und aus demselben Grund: der Knopf „Auf dem jetzigen Stand speichern" schickt die
  // Fassung, die JETZT im Bild steht (`ko.version`) — nicht die, an der der Versuch gescheitert ist.
  // Über `setEdit` ginge das nicht: der Zustand stünde erst im nächsten Rendern, der Aufruf ginge
  // mit der alten Zahl hinaus.
  //
  // ================================================================================================
  // JOB 4251 · UND SEIT DIESEM AUFTRAG SCHREIBEN AUCH DIE BEIDEN FOLGEAUFRUFE BEDINGT.
  // ================================================================================================
  //
  // BIS HIERHER STAND AN DIESER STELLE, sie blieben unbedingt, weil die Route `expectedVersion` an
  // `tags` und `category` mit 400 abwies. Das stimmte — und die Lücke dahinter war trotzdem offen:
  // eine zehn Minuten alte Schlagwort- oder Kategorieabsicht ging mit 200 durch und ersetzte die
  // jüngere Einordnung eines anderen Menschen, ohne dass irgendwo etwas aufschlug.
  //
  // `expectedVersion` WÄRE DAFÜR AUCH DER FALSCHE SCHUTZ GEWESEN, und das ist der Kern: eine
  // Metadatenänderung erhöht die Inhaltsfassung ausdrücklich NICHT (KW-ARCH-G27). Hat der andere
  // NUR Schlagwörter geändert — genau der Fall, um den es geht —, steht die Version unverändert da,
  // und ein Vergleich gegen sie liesse den alten Stand anstandslos durch. Der autoritative Stempel
  // der Einordnung ist die `metadata_revision` der Metadatenprojektion; sie klettert genau dann,
  // wenn sich Kategorie oder Schlagwörter fachlich wirklich ändern.
  //
  // Die Aufrufe laufen weiterhin erst NACH einem erfolgreichen `revise`; ein Inhaltskonflikt bricht
  // die Kette vorher ab, es geht also nichts hinaus.
  //
  // ================================================================================================
  // JOB 4163 · DIE KETTE WEISS, WIE WEIT SIE GEKOMMEN IST — UND DER ZWEITE GRIFF HOLT NUR NACH.
  // ================================================================================================
  //
  // DER FEHLER, DEN DIESE ZEILEN SCHLIESSEN, und er war rechnerisch zwingend: brach die Kette nach
  // dem gelungenen `revise` ab, lief `onSuccess` nicht, `bearbeitenBeenden()` lief nicht, und
  // `edit.version` blieb die ALTE Zahl — während das Objekt am Server bereits eine Fassung weiter
  // war. Der Mensch sah nur die rohe Servermeldung und erfuhr NICHT, dass sein Text schon
  // gespeichert ist. Drückte er erneut „Speichern", ging die alte Fassung hinaus, der Server
  // antwortete 409, und die Fläche erzählte ihm von einem FREMDEN Schreiber. Dazwischengekommen war
  // sein eigener halb gelungener Speichervorgang; der Satz war unwahr.
  //
  // `teilstandRef` IST BUCHFÜHRUNG, KEIN ANZEIGEWERT — und deshalb eine `ref` und kein Zustand:
  // gezeichnet wird aus ihr nichts (dafür steht `speicherLage`), gelesen wird sie im Augenblick des
  // Aufrufs, und sie darf `onMutate` ÜBERLEBEN. §9 verlangt, dass die Auskunft des vorigen Versuchs
  // über einem laufenden neuen verschwindet — die TATSACHE, dass der Text schon am Server steht,
  // verschwindet damit nicht: sie gilt weiter, sonst schickte der nächste Versuch wieder die
  // überholte Fassung. Genommen wird sie zurück, wenn alles angekommen ist (`onSuccess` über
  // `bearbeitenBeenden`) oder wenn ein Formular neu aufgeht (`startEdit`).
  const teilstandRef = useRef<Teilstand | null>(null);
  const save = useMutation({
    mutationFn: async (v: {
      expectedVersion: number | null;
      /** JOB 4251: der Stand der Einordnung, den die Fläche GESEHEN hat (`null` = unbekannt). */
      einordnung: number | null;
      ueberschreiben?: boolean;
    }) => {
      if (!edit) {
        throw new Error("no edit");
      }
      const changes = {
        title: edit.title,
        statement: edit.statement,
        bodyHtml: edit.bodyHtml,
        type: edit.type,
        conditions: edit.conditions.filter((x) => x.trim()),
        measures: edit.measures.filter((x) => x.trim()),
      };
      const schlagworte = edit.tags.filter((x) => x.trim());
      const marken: Speichermarken = {
        text: JSON.stringify(changes),
        tags: JSON.stringify(schlagworte),
        category: edit.category.trim(),
        schlagworte,
      };
      // DIE BUCHFÜHRUNG WIRD FORTGESCHRIEBEN, NIE ZURÜCKGESETZT (BEN2/BEN3). Was am Server steht,
      // hört durch einen weiteren Fehlschlag nicht auf, dort zu stehen; ein `null` hier hiesse,
      // dem nächsten Griff eine Tatsache zu verschweigen, die er braucht.
      const buch: Teilstand = teilstandRef.current
        ? { ...teilstandRef.current }
        : {
            text: null,
            tags: null,
            category: null,
            fassung: null,
            stempel: null,
            einordnungGeschrieben: false,
          };
      const buchen = (): void => {
        teilstandRef.current = buch.text === null ? null : buch;
      };
      // ==========================================================================================
      // JOB 4251 · DIE BEDINGUNG DES NÄCHSTEN EINORDNUNGSAUFRUFS — GENAU DIESELBE REGEL WIE BEIM
      // TEXT (`eigeneFassung`), NUR AM ANDEREN GEGENSTAND.
      // ==========================================================================================
      //
      // DREI LAGEN, IN DIESER RANGFOLGE — und die Reihenfolge ist die ganze Regel:
      //
      //   1. IN DIESEM LAUF IST SCHON EIN EIGENER EINORDNUNGSAUFRUF DURCHGEGANGEN → es gilt DESSEN
      //      Quittung. Sie schlägt alles andere, auch den ausdrücklichen Entscheid: der eigene
      //      `tags`-Aufruf von einer Zeile zuvor hat den Stempel gerade selbst weitergedreht, und
      //      der `category`-Aufruf liefe sonst in einen Konflikt mit dem eigenen Schreibvorgang.
      //   2. DER MENSCH HAT AUSDRÜCKLICH ENTSCHIEDEN (`ueberschreiben`) → es gilt der Stand, den er
      //      JETZT sieht. Genau das verspricht der Knopf.
      //   3. SONST: hat eine FRÜHERE Runde dieser Bearbeitung schon eine Einordnung geschrieben,
      //      gilt deren Quittung (ein nachgelesener Stand wäre falsch — eine frische Zahl sagt nur,
      //      WIE OFT die Einordnung bewegt wurde, nicht, WER sie bewegt hat; BEN4 am Textweg).
      //      Sonst der Stand, den der Mensch beim Öffnen gesehen hat.
      //
      // WORAN PUNKT 3 „FRÜHER GESCHRIEBEN" ABLIEST, UND DAS WAR DER FEHLER AUS RUNDE 3: an
      // `einordnungGeschrieben`, NICHT an den Marken `tags`/`category`. Die Marken sagen, ob ein
      // Schritt JETZT offen ist, und sie verfallen bei jedem gescheiterten Aufruf (s. `catch`) —
      // wer aus ihnen die HERKUNFT der Quittung ableitet, verliert sie beim zweiten Fehlschlag und
      // schickt wieder den Stand vom Öffnen. BEN hat genau das gemessen (`expected 1 to be 2`), und
      // der Mensch las danach von einem fremden Schreiber, den es nicht gab. Zwei Fragen, zwei
      // Felder (s. `Teilstand`).
      //
      // WARUM PUNKT 2 ÜBER PUNKT 3 STEHT, und das war der Fehler aus Runde 1 (BEN, Korrekturpflicht
      // 2, Gegenprobe A, wörtlich `expected 2 to be 3`): dort galt die Quittung der früheren Runde
      // IMMER. Wer also seine Schlagworte gespeichert hatte, an der Kategorie in einen fremden
      // Schreibvorgang lief und danach ausdrücklich „auf dem jetzigen Stand speichern" drückte,
      // schickte weiter die alte eigene Zahl — und lief zuverlässig in denselben 409. Ein Knopf,
      // der nichts tun KANN, ist eine Scheinfunktion, und sein Versprechen war unwahr.
      //
      // WAS `ueberschreiben` TROTZDEM NICHT TUT, IST DIE BEDINGUNG AUFHEBEN: der gesehene Stand
      // reist mit. Wer zwischen Meldung und Knopf überholt wird, bekommt denselben ehrlichen
      // Konflikt noch einmal (dieselbe Zusage wie B15 am Textweg, gemessen in K10b).
      //
      // IST DER EIGENE STAND UNBEKANNT, GEHT DER AUFRUF NICHT HINAUS. Eine geratene Zahl schützte
      // vor nichts und wiese rechtmässige Schreibvorgänge ab; ganz ohne Feld wäre es das stille
      // Überschreiben, das dieser Auftrag beseitigt. Wissenslücke statt Erfindung.
      let quittungDiesesLaufs: number | null = null;
      let eigenerAufrufDiesesLaufs = false;
      const einordnungsBedingung = (): { expectedMetadataRevision?: number } => {
        const frueherGeschrieben = buch.einordnungGeschrieben;
        const stempel = eigenerAufrufDiesesLaufs
          ? quittungDiesesLaufs
          : v.ueberschreiben
            ? v.einordnung
            : frueherGeschrieben
              ? buch.stempel
              : v.einordnung;
        if (
          (eigenerAufrufDiesesLaufs || (!v.ueberschreiben && frueherGeschrieben)) &&
          typeof stempel !== "number"
        ) {
          throw new Error("Stand der eigenen Einordnung unbekannt");
        }
        return typeof stempel === "number" ? { expectedMetadataRevision: stempel } : {};
      };
      /**
       * Die Quittung des eigenen Einordnungsaufrufs übernehmen — für den nächsten Schritt.
       *
       * `einordnungGeschrieben` wird hier gesetzt und NIRGENDS zurückgenommen: dass dieser Mensch
       * die Einordnung dieses Eintrags schon einmal bewegt hat, ist eine Tatsache, die ein späterer
       * Fehlschlag nicht ungeschehen macht. Auch dann, wenn die Antwort den Stand NICHT trug
       * (`stand === null`): dann ist die Quittung unbekannt, und genau deshalb darf der nächste
       * Aufruf nicht auf den Stand vom Öffnen zurückfallen — er geht gar nicht hinaus (K14).
       */
      const quittieren = (geschrieben: { metadataRevision?: number } | undefined): void => {
        eigenerAufrufDiesesLaufs = true;
        const stand =
          typeof geschrieben?.metadataRevision === "number" ? geschrieben.metadataRevision : null;
        quittungDiesesLaufs = stand;
        buch.stempel = stand;
        buch.einordnungGeschrieben = true;
      };
      // Woran die Kette gerissen ist. Der `revise` steht am Anfang; ab dem ersten Folgeaufruf geht
      // es um die Einordnung (s. `SpeicherAbbruch.schritt`).
      //
      // RUNDE 3: der Schritt wird FEINER geführt als die Lage, die er später ergibt — nicht nur
      // „Einordnung", sondern welcher der beiden Aufrufe gerade unterwegs ist. Ohne diese
      // Unterscheidung lässt sich die Marke des GESCHEITERTEN Aufrufs nicht von der des gelungenen
      // trennen, und genau daran ist Runde 2 gescheitert (s. `markeVerfaellt`).
      let laufend: "text" | "tags" | "category" = "text";
      try {
        // EIN SCHRITT IST OFFEN, WENN SEIN WERT IM FORMULAR VON DEM ABWEICHT, DER AM SERVER STEHT.
        // Diese EINE Regel deckt beides ab: „noch nie geschickt" (`null`) und „seither geändert".
        // Runde 1 fragte stattdessen nach dem Erfolg des letzten Aufrufs — und verschluckte damit
        // jedes Schlagwort, das nach einem Kategorieabbruch ergänzt wurde (BEN1).
        //
        // ============================================================================================
        // `ueberschreiben` HEBT DIESEN VERGLEICH AUF — UND DAS IST DIE LÜCKE AUS RUNDE 2 (BEN-R2-B).
        // ============================================================================================
        //
        // DIE MARKE SAGT NICHT, WAS AM SERVER STEHT. Sie sagt: „diesen Text habe ICH einmal
        // hinausgeschickt". Solange nur die eigene Kette läuft, ist das dasselbe. Sobald jemand
        // FREMDES geschrieben hat, ist es das nicht mehr — und genau dann steht der Konfliktknopf da.
        //
        // WAS RUNDE 2 DARAUS MACHTE, war ein stiller Betrug: Stellt der Mensch nach der
        // Konfliktmeldung seinen Text auf genau den zurück, den er vorhin schon einmal gespeichert
        // hatte („ich nehme meinen Nachtrag zurück und speichere den Stand von vorhin"), dann
        // stimmten Formular und Marke wieder überein, der Aufruf wurde übersprungen — und die Fläche
        // meldete Erfolg über einen Schreibvorgang, den es nie gegeben hat. BEN hat es gemessen:
        // „Trotz bewusster Konfliktentscheidung wurde der Formulartext nicht gespeichert."
        //
        // Der Knopf verspricht, den Text auf dem jetzigen Stand zu speichern. Also geht er hinaus,
        // ohne Vergleich. Was er NICHT aufhebt, ist die Bedingung: `expectedVersion` reist weiter
        // mit (s. `eigeneFassung`), damit auch diese Entscheidung einen zwischenzeitlichen zweiten
        // fremden Schreiber nicht überfährt — gemessen in B15.
        if (v.ueberschreiben || buch.text !== marken.text) {
          // ============================================================================
          // DIE FASSUNG — UND WARUM SIE NACH EINEM TEILABBRUCH NICHT NACHGELESEN WIRD.
          // ============================================================================
          //
          // Beim ERSTEN Versuch ist es die GESEHENE Fassung vom Aufrufer (JOB 4075).
          //
          // Nach einem Teilabbruch ist die gesehene durch den eigenen halben Speichervorgang
          // überholt. Runde 1 las die gültige Fassung nach und schrieb mit ihr — und genau das war
          // falsch: eine frische Versionsnummer sagt nur, WIE VIELE Fassungen es gibt, nicht, WER
          // sie geschrieben hat. Hat inzwischen jemand Fremdes geschrieben, überschrieb der zweite
          // Griff ihn lautlos (BEN4).
          //
          // RICHTIG IST DIE FASSUNG, DIE DIE ANTWORT DES EIGENEN `revise` GETRAGEN HAT. Sie ist
          // gelesen, nicht geraten — und sie ist der einzige Stand, von dem dieser Client WEISS,
          // dass er sein eigener ist. Kommt jemand Fremdes dazwischen, weist der Server den Aufruf
          // mit 409 ab, und der Konfliktweg aus JOB 4075 greift: der Mensch entscheidet, nicht die
          // Fläche. Es entsteht KEINE zweite Konflikterkennung im Browser.
          //
          // `ueberschreiben` ist genau diese Entscheidung, wenn sie gefallen ist: der Knopf
          // „Auf dem jetzigen Stand speichern" schickt die Fassung, die im Bild steht.
          const eigeneFassung =
            v.ueberschreiben || buch.text === null ? v.expectedVersion : buch.fassung;
          if (!v.ueberschreiben && buch.text !== null && typeof eigeneFassung !== "number") {
            // Die eigene Fassung ist unbekannt. Ohne sie ginge der Aufruf entweder mit einer
            // geratenen Zahl (falscher Konflikt) oder ganz ohne Schutz (stilles Überschreiben)
            // hinaus. Also gar nicht — Wissenslücke statt Erfindung.
            throw new Error("Fassung des eigenen Schreibvorgangs unbekannt");
          }
          const geschrieben = await endpoints.ko.act(koId, {
            action: "revise",
            changes,
            // WISSENSLÜCKE STATT ERFINDUNG: ohne bekannte Fassung wird das Feld WEGGELASSEN, nicht
            // geraten. Der Aufruf verhält sich dann wie vor JOB 4075 — eine falsche Zahl wäre
            // schlimmer als keine: sie schützte vor nichts und wiese dafür rechtmässige
            // Schreibvorgänge ab (`route-bedingter-schreibzugriff.test.ts` F4 hält fest, was ohne
            // das Feld gilt).
            ...(typeof eigeneFassung === "number" ? { expectedVersion: eigeneFassung } : {}),
          });
          buch.text = marken.text;
          // Die Fassung kommt aus der ANTWORT des Schreibvorgangs, nicht aus einer zweiten Abfrage.
          buch.fassung = typeof geschrieben?.version === "number" ? geschrieben.version : null;
        }
        laufend = "tags";
        // JOB 4251 · `ueberschreiben` GILT AUCH HIER, und aus demselben Grund wie beim Text
        // (BEN-R2-B): die Marke sagt „diesen Wert habe ICH einmal hinausgeschickt", nicht „er steht
        // am Server". Nach einem fremden Schreibvorgang fallen die beiden auseinander — wer dann
        // seine Einordnung auf den Stand von vorhin zurückstellt, träfe die Marke wieder, der
        // Aufruf würde übersprungen, und die Fläche meldete Erfolg über einen Schreibvorgang, den
        // es nie gegeben hat. Die BEDINGUNG bleibt trotzdem: der Stempel reist mit.
        if (v.ueberschreiben || buch.tags !== marken.tags) {
          const geschrieben = await endpoints.ko.act(koId, {
            action: "tags",
            tags: marken.schlagworte,
            ...einordnungsBedingung(),
          });
          buch.tags = marken.tags;
          // Der Stand kommt aus der ANTWORT des eigenen Schreibvorgangs, nicht aus einer zweiten
          // Abfrage — sonst wanderte ein fremder Schreibvorgang in den eigenen Bezugspunkt.
          quittieren(geschrieben);
        }
        if (marken.category !== "" && (v.ueberschreiben || buch.category !== marken.category)) {
          laufend = "category";
          const geschrieben = await endpoints.ko.act(koId, {
            action: "category",
            category: marken.category,
            ...einordnungsBedingung(),
          });
          buch.category = marken.category;
          quittieren(geschrieben);
        }
      } catch (e) {
        // ==========================================================================================
        // RUNDE 3 · EINE ALTE QUITTUNG IST KEINE QUITTUNG DIESES VERSUCHS (BEN, Korrekturpflicht 1).
        // ==========================================================================================
        //
        // DER FEHLER, DEN DIESE ZEILEN SCHLIESSEN, gemessen von BEN: A speichert die Schlagworte
        // erfolgreich, jemand Fremdes ändert die Kategorie, As Kategorieaufruf wird abgewiesen.
        // Danach überschreibt ein WEITERER Schreiber die Schlagworte, und A entscheidet bewusst
        // erneut — der Schlagwortaufruf geht hinaus und wird abgewiesen. Die Marke aus dem ERSTEN
        // Versuch stand aber noch und stimmte mit dem Formular überein; der Schritt galt damit als
        // erledigt, fiel aus `offeneSchritte` heraus, und die Fläche meldete „deine Schlagworte
        // sind gespeichert" — während sie soeben abgewiesen worden waren und am Server fremde
        // Schlagworte standen. BENs Wortlaut: „Tags wurden gerade abgewiesen; Kategorie wurde in
        // diesem Versuch gar nicht aufgerufen."
        //
        // DIE REGEL IST EINE ZEILE UND GILT FÜR BEIDE FEHLERARTEN: was DIESER Versuch abgesetzt hat
        // und was nicht angekommen ist, ist offen. Beim 409 ist die alte Marke ohnehin verdächtig —
        // jemand Fremdes hat nachweislich geschrieben. Beim NETZABBRUCH ist sie das nicht: am
        // Server steht womöglich noch genau das, was sie sagt. Trotzdem verfällt sie, und das ist
        // die schwächere, WAHRE Aussage: dieser Aufruf ist nicht durchgekommen. „Erledigt" wäre
        // eine Auskunft über einen Vorgang, den es nicht gegeben hat (K12).
        //
        // WAS NICHT VERFÄLLT, ist die Buchführung der GELUNGENEN Schritte — insbesondere `text`
        // (BEN2/BEN3 aus JOB 4163: was am Server steht, hört durch einen weiteren Fehlschlag nicht
        // auf, dort zu stehen). Es verfällt AUSSCHLIESSLICH die Marke des einen Aufrufs, der gerade
        // gescheitert ist.
        //
        // RUNDE 4 · UND ES VERFÄLLT NICHT DER BEZUGSPUNKT (`stempel`, `einordnungGeschrieben`).
        // Runde 3 hat das nicht getrennt — mit der Marke ging die eigene Quittung mit, und der
        // nächste gewöhnliche Griff lief mit dem Stand vom Öffnen in einen erfundenen Fremdkonflikt
        // (BEN R3). Eine verfallene Marke heisst „dieser Aufruf ist nicht durchgekommen", sie heisst
        // NICHT „ich habe hier nie geschrieben". Die beiden Zeilen unten fassen deshalb nur die
        // Marken an; `stempel` und `einordnungGeschrieben` bleiben unberührt stehen (K13).
        if (laufend === "tags") {
          buch.tags = null;
        }
        if (laufend === "category") {
          buch.category = null;
        }
        buchen();
        throw new SpeicherAbbruch(
          e,
          buch.text === marken.text,
          offeneSchritte(buch, marken),
          laufend === "text" ? "text" : "einordnung",
        );
      }
      // Alles angekommen: es gibt nichts mehr nachzuholen.
      teilstandRef.current = null;
    },
    // Solange nichts zurück ist, wird nichts behauptet (§9 „laden"): die Auskunft des VORIGEN
    // Versuchs gehört nicht über einen laufenden neuen.
    onMutate: () => {
      setSpeicherLage(null);
    },
    onSuccess: () => {
      invalidate();
      bearbeitenBeenden();
      setErr(null);
      // JOB 4075: bis hierher schloss sich das Formular kommentarlos — der Mensch wusste nicht, ob
      // etwas angekommen ist. Der Satz kommt über die vorhandene Toast-Fläche, dieselbe, die das
      // Löschen und das Anhängen schon benutzen; eine zweite Mechanik daneben wäre eine stille
      // Ablösung.
      push("success", t("ko.revise.saved"));
      if (reviewReworkContext) {
        setReworkSavedFor(koId);
      }
    },
    // ==============================================================================================
    // JOB 3667 R3 · KEINE SACKGASSE: DER 403 FÜHRT IN DEN EINREICHWEG, NICHT IN EINE ABSAGE.
    // ==============================================================================================
    //
    // `PROPOSAL_REQUIRED` ist die Antwort der Route, wenn dieses Konto ein FREIGEGEBENES Objekt nicht
    // direkt ersetzen darf (`ko-routes.ts:2064`). Er entsteht auch dann, wenn die Fläche den
    // Einreichweg NICHT vorausgewählt hatte — das Objekt kann freigegeben worden sein, während jemand
    // tippte, oder die Rolle hat sich geändert. Ohne diesen Zweig stünde dort ein roter Satz und
    // sonst nichts.
    //
    // ER REICHT NICHTS VON SELBST EIN. Einreichen ist ein bewusster Schritt (Lieferung 5): hier wird
    // nur der Weg SICHTBAR gemacht, gegriffen wird noch einmal. Ein `save`, das bei einem 403
    // stillschweigend etwas anderes täte als der Knopf verspricht, wäre genau die Nebenwirkung, die
    // dieser Auftrag verbietet.
    //
    // UND DER TEXT BLEIBT STEHEN: `setEdit(null)` steht ALLEIN im Erfolgszweig. Das Formular behält
    // seinen Inhalt, unverändert und weiter bearbeitbar — bei diesem 403 wie bei jedem anderen Fehler.
    //
    // ==============================================================================================
    // JOB 4075 · DER 409 IST KEIN FEHLER DER EINGABE, SONDERN EINE TATSACHE ÜBER DIE ZEIT.
    // ==============================================================================================
    //
    // ER STEHT VOR DEN BEIDEN ANDEREN ZWEIGEN UND FÄNGT NUR SICH SELBST. Die naheliegende Halbheit
    // wäre, `expectedVersion` zu schicken und den 409 im allgemeinen `setErr`-Zweig landen zu lassen:
    // dann stünde dort eine Servermeldung, und aus dem stillen Überschreiber wäre eine Sackgasse
    // geworden — der Mensch wüsste nicht, was er tun soll.
    //
    // DIE ZAHL WIRD NACHGELESEN, NICHT AUS DEM FEHLER GENOMMEN. Der Server sendet sie im
    // Antwortkörper mit (`currentVersion`), `ApiError` trägt sie nicht (`api/client.ts:7-17`,
    // `client.ts` ist kein Zielpfad — die Grenze ist in
    // `tests/word-rueckweg/web-einreichweg-vertrag.test.tsx` W6b eigens festgehalten). Bis das
    // Nachlesen etwas gebracht hat, steht die zahlenlose Aussage da: sie ist wahr, eine erfundene
    // Zahl wäre es nicht. Scheitert das Nachlesen, bleibt es dabei.
    //
    // DIE ARBEIT ÜBERLEBT: `setEdit` wird nicht angefasst, `bearbeitenBeenden` läuft NICHT. Das
    // Formular steht mit unverändertem Text da und bleibt bearbeitbar — anpassen braucht keinen
    // Knopf, die beiden anderen Wege stehen daneben.
    //
    // ==============================================================================================
    // JOB 4163 · DER TEILABBRUCH STEHT VOR ALLEN ANDEREN ZWEIGEN — ER IST DIE GRÖSSERE TATSACHE.
    // ==============================================================================================
    //
    // „Dein Text ist gespeichert" muss der Mensch erfahren, bevor irgendetwas über die Ursache des
    // Abbruchs gesagt wird: sonst sucht er nach seiner Arbeit, die längst am Server liegt. Der
    // Zweig fängt NUR sich selbst — er greift ausschliesslich, wenn ein `revise` dieser Bearbeitung
    // gelungen ist UND noch ein Folgeschritt offen steht. Ein 409 am `revise` selbst (B5) und ein
    // 403 am `revise` selbst (B4) kommen hier gar nicht an: dann steht nichts in der Buchführung.
    //
    // UND ES GIBT KEINE ZWEITE AUSSAGE ÜBER DIESELBE TATSACHE: `err` wird ausdrücklich geräumt. Der
    // Sammelzweig unten ist für diesen Fall abgelöst, nicht ergänzt — stünden beide Sätze da, wäre
    // aus einer Reparatur ein zweiter Erklärungsweg geworden.
    onError: (e) => {
      const abbruch = e instanceof SpeicherAbbruch ? e : null;
      const ursache = abbruch ? abbruch.ursache : e;
      // Von dieser Bearbeitung steht schon etwas am Server — die Buchführung ist der EINE Beleg
      // dafür, und sie überlebt jeden weiteren Fehlschlag (BEN2/BEN3).
      const teilVorher = teilstandRef.current !== null;
      // ============================================================================================
      // DER 409 STEHT VOR DEM TEILABBRUCH — ER IST DIE STÄRKERE TATSACHE (BEN4).
      // ============================================================================================
      //
      // „Jemand anderes hat geschrieben" muss der Mensch erfahren, BEVOR ihm etwas über den eigenen
      // halben Vorgang gesagt wird: nur er entscheidet, ob der fremde Stand überschrieben werden
      // darf. Liegt von dieser Bearbeitung schon etwas am Server, ist der alte Wortlaut
      // („gespeichert wurde nichts") allerdings unwahr — dafür steht `teilVorher`.
      if (ursache instanceof ApiError && ursache.status === 409) {
        // ==========================================================================================
        // JOB 4251 · WORÜBER der fremde Schreiber dazwischengekommen ist — Inhalt oder Einordnung.
        // ==========================================================================================
        //
        // Ein 409 am `tags`- oder `category`-Aufruf heisst NICHT „gespeichert wurde nichts": der
        // `revise` davor ist in diesem Fall durch, der Text des Menschen steht am Server. Der alte
        // Wortlaut wäre dort die Unwahrheit — und die Fassungszahl, die zu ihm gehört, sagt über
        // die Einordnung nichts, weil sie bei einer Einordnungsänderung gar nicht klettert.
        const feld = abbruch?.schritt === "einordnung" ? "einordnung" : "text";
        // Erst die WAHRE, noch zahlenlose Aussage — sie gilt sofort.
        // RUNDE 2: WELCHE Einordnungsschritte wirklich abgewiesen wurden, steht in der Buchführung
        // des Abbruchs — nicht in einer pauschalen Annahme. Ein Schlagwortaufruf, der VORHER durch
        // war, ist auch nach dem Konflikt gespeichert, und der Satz darf ihn nicht für verloren
        // erklären (BEN, Korrekturpflicht 3).
        setSpeicherLage({
          art: "stale",
          feld,
          version: null,
          teilVorher,
          offen: abbruch?.offen ?? [],
        });
        invalidate();
        if (feld === "einordnung") {
          // KEIN NACHLESEN EINER ZAHL, DIE NICHTS ERKLÄRT. `invalidate()` oben holt den Eintrag
          // ohnehin frisch — damit steht die EINORDNUNG des anderen Menschen gleich auf der Fläche,
          // und der Knopf „Auf dem jetzigen Stand speichern" hat den Stempel, den er braucht.
          return;
        }
        // Und dann die Fassung, die das Nachlesen WIRKLICH gezeigt hat. Der Rückruf überschreibt nur
        // eine noch offene Stale-Lage: wer inzwischen erneut gespeichert hat, soll seine neue
        // Auskunft nicht von einer alten Antwort zurückgedreht bekommen.
        void query.refetch().then((r) => {
          // JOB 4075 R2 · `r.data` IST KEIN BELEG FÜR EIN GELUNGENES NACHLESEN. Scheitert der
          // Leseversuch, hält react-query den ZULETZT geholten Stand weiter in `data` (genau die
          // Bauform, auf der `abfrageMitBestand` aufsetzt: der Bestand bleibt sichtbar). Die Zahl
          // darin ist dann die ALTE — dieselbe, die der Mensch beim Öffnen sah, und über die der
          // Server soeben mit 409 gesagt hat, dass sie nicht mehr gilt. Sie hier zu nennen wäre die
          // schlimmste Auskunft von allen: eine Zahl, die aussieht wie nachgelesen und falsch ist
          // (Prüfbefund R1, Fall B1 — nach 503 stand „er steht jetzt auf Version 1", während der
          // Server auf 2 stand). §9 sagt es wörtlich: „Konflikt, Nachlesen scheitert: es bleibt beim
          // zahlenlosen Satz. Keine Zahl aus dem Cache." Also zählt der ERFOLG des Leseversuchs,
          // nicht das Vorhandensein von Daten.
          if (!r.isSuccess) {
            return;
          }
          const jetzt = r.data?.version;
          setSpeicherLage((vorher) =>
            // JOB 4251: und nur eine Lage über den INHALT bekommt diese Zahl. Wer inzwischen in
            // einen Einordnungskonflikt gelaufen ist, soll keine Fassungszahl an einen Satz
            // geheftet bekommen, der von Schlagwörtern handelt.
            vorher?.art === "stale" && vorher.feld === "text" && typeof jetzt === "number"
              ? {
                  art: "stale",
                  feld: "text",
                  version: jetzt,
                  teilVorher: vorher.teilVorher,
                  offen: vorher.offen,
                }
              : vorher,
          );
        });
        return;
      }
      if (ursache instanceof ApiError && ursache.code === "PROPOSAL_REQUIRED") {
        setSperreGemeldet(true);
        setEinreichLage({ art: "pflicht", text: ursache.message });
        return;
      }
      // ============================================================================================
      // JOB 4163 · DER TEILABBRUCH — DIE ZWEITE TATSACHE, UND SIE GILT AUCH NACH WEITEREN FEHLERN.
      // ============================================================================================
      //
      // „Dein Text ist gespeichert" (oder, nach einer weiteren Änderung, „ein früherer Stand deines
      // Textes") muss der Mensch erfahren, bevor irgendetwas über die Ursache gesagt wird: sonst
      // sucht er nach Arbeit, die längst am Server liegt. Der Zweig greift, sobald die Buchführung
      // etwas trägt — auch wenn DIESER Lauf schon am `revise` gescheitert ist (BEN2/BEN3).
      //
      // UND ES GIBT KEINE ZWEITE AUSSAGE ÜBER DIESELBE TATSACHE: `err` wird ausdrücklich geräumt.
      // Der Sammelzweig unten ist für diesen Fall abgelöst, nicht ergänzt.
      if (abbruch !== null && teilVorher && (!abbruch.textAktuell || abbruch.offen.length > 0)) {
        setErr(null);
        setSpeicherLage({
          art: "teil",
          textAktuell: abbruch.textAktuell,
          offen: abbruch.offen,
          // Die rohe Meldung reist MIT, aber sie trägt den Satz nicht: was der Server sagt, ist
          // eine Auskunft über seine Lage, nicht über die Arbeit des Menschen.
          meldung: ursache instanceof ApiError ? ursache.message : "",
          // BEN, Prüflücke 6: wurde das Recht MITTEN in der Kette entzogen, stünde ohne diesen
          // Hinweis nur „drück noch einmal" da — eine Zusage, die nichts einlöst.
          rechtEntzogen:
            ursache instanceof ApiError &&
            ursache.status === 403 &&
            ursache.code !== "PROPOSAL_REQUIRED",
        });
        // Am Objekt HAT sich etwas geändert — der Text steht dort. Die Fläche darunter zeigt sonst
        // weiter den Stand von vorhin.
        invalidate();
        return;
      }
      // ============================================================================================
      // JOB 4163 · RECHTEENTZUG IST KEIN EINGABEFEHLER — UND KEIN EINREICHFALL.
      // ============================================================================================
      //
      // ER STEHT NACH `PROPOSAL_REQUIRED` UND FÄNGT NUR DEN REST: dort ist das Objekt freigegeben
      // und es gibt einen Weg (einreichen); hier ist das Schreibrecht ganz entzogen, und es gibt
      // keinen. Ein Satz, der trotzdem einen Weg verspräche, wäre die Scheinfunktion; die rohe
      // Servermeldung allein war die Sackgasse. Also: eigener Satz in Anwendersprache, die Meldung
      // des Servers daneben — und der Text bleibt unverändert im Formular stehen.
      if (ursache instanceof ApiError && ursache.status === 403) {
        setErr(null);
        setSpeicherLage({ art: "keinRecht", meldung: ursache.message });
        return;
      }
      // Jeder andere Fehler — auch der Netzausfall — geht unverändert hierher. Ein Netzfehler ist
      // kein Konflikt, und der Konfliktsatz stünde dort falsch.
      setErr(ursache instanceof ApiError ? ursache.message : t("state.error"));
    },
  });

  // ================================================================================================
  // JOB 3667 R3 · FALL 2 UND 3 — DEN ÄNDERUNGSVORSCHLAG EINREICHEN.
  // ================================================================================================
  //
  // AM OBJEKT ÄNDERT DAS NICHTS. `action: "propose"` legt einen an DIESES Objekt gebundenen
  // `KoProposal` an; Inhalt, Version und Prüfstand bleiben, wie sie sind (`service.ts:3798`). Wer das
  // Objekt liest, sieht weiter den freigegebenen Stand — das ist keine Zusage dieser Fläche, sondern
  // die Bauform des Schreibvorgangs, und genau deshalb ist es belegbar.
  //
  // `baseVersion` KOMMT ALS ARGUMENT, NICHT AUS DEM ABSCHLUSS: `ko` steht erst unterhalb der
  // Abbruchzweige zur Verfügung (`abfrageMitBestand`), Haken dürfen dort nicht mehr stehen. Der
  // Aufrufer übergibt die Fassung, die er IM BILD hatte — und genau die soll der Server prüfen.
  //
  // `bodyHtml` REIST NUR MIT, WENN ES EINEN RUMPF GIBT — und ein LEERES Feld ist seit R5 kein
  // Zufall mehr, sondern eine Frage mit zwei verschiedenen Antworten:
  //   · der Eintrag hatte keinen Fließtext  → es liegt schlicht keiner bei, nichts reist mit;
  //   · der Eintrag HATTE einen und der Mensch hat ihn geleert → das ist eine ABSICHT, und sie geht
  //     als `clearBody` hinaus. Ohne dieses Feld würde der Server die Löschung nicht ausführen
  //     (ausgelassen ist nicht gelöscht) — der Mensch sähe seine Arbeit wirkungslos verpuffen.
  // `bestehenderRumpf` kommt deshalb vom Aufrufer: erst er kennt den geladenen Stand (`ko` steht
  // hier oben noch nicht zur Verfügung, s. `baseVersion`).
  const einreichen = useMutation({
    mutationFn: (v: {
      baseVersion: number;
      statement: string;
      bodyHtml: string;
      bestehenderRumpf: string | null;
    }) =>
      endpoints.ko.act(koId, {
        action: "propose",
        proposal: {
          statement: v.statement,
          ...(v.bodyHtml.trim().length > 0
            ? { bodyHtml: v.bodyHtml }
            : (v.bestehenderRumpf ?? "").trim().length > 0
              ? { clearBody: true as const }
              : {}),
          baseVersion: v.baseVersion,
          // Dieselbe Stelle, an der der Word-Weg `word_addin` trägt. Wer den Vorschlag später
          // ansieht, erfährt, wo er entstand — statt es aus dem Namen zu raten.
          origin: "klarwerk_web",
        },
      }),
    onSuccess: () => {
      // DAS FORMULAR BLEIBT OFFEN UND BEHÄLT DEN TEXT. Eingereicht ist nicht übernommen: der Mensch
      // soll sehen, was er geschickt hat, und der Eintrag darunter trägt weiter den alten Stand.
      // `invalidate()` holt das Objekt samt der jetzt eingereichten Fassung nach.
      invalidate();
      setErr(null);
      setSperreGemeldet(false);
      setEinreichLage({ art: "eingereicht" });
    },
    // ==============================================================================================
    // DIE GRENZE DES 409 — HIER STEHT KEINE ZAHL, DIE WIR NICHT HABEN.
    // ==============================================================================================
    //
    // Der Server sendet zum `KO_STALE` die jetzt gültige Version MIT (`ko-routes.ts:1922`,
    // `currentVersion`). Diese Oberfläche bekommt sie NICHT zu sehen: `ApiError` trägt nur `status`,
    // `code` und `message` — der übrige Antwortkörper wird in `api/client.ts:38-43` verworfen, und
    // `client.ts` ist kein Zielpfad dieses Auftrags (namentlich gemeldet, s. RUECKGABE).
    //
    // WAS STATT DESSEN GESCHIEHT, und es ist ehrlich statt geraten: die Fläche LIEST NACH
    // (`invalidate()`) und nennt die Fassung, die sie dabei wirklich gesehen hat. Bis sie da ist,
    // steht `version: null` — „der Stand hat sich bewegt" ohne Zahl ist wahr; eine erfundene Zahl
    // wäre es nicht.
    //
    // DER TEXT ÜBERLEBT AUCH DAS. Ein 409, der die Arbeit verschluckt, wäre schlimmer als ein stilles
    // Überschreiben: `setEdit` wird hier nicht angefasst, und die Griffe daneben lassen den Menschen
    // entscheiden — neu lesen, anpassen, oder auf der jetzt gültigen Fassung erneut einreichen.
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        // Erst die WAHRE, noch zahlenlose Aussage — sie gilt sofort und ist nicht falsch.
        setEinreichLage({ art: "stale", version: null });
        invalidate();
        // Und dann, wenn der Nachlesevorgang etwas gebracht hat, die Fassung, die dabei WIRKLICH
        // dastand. Der Rückruf überschreibt nur eine noch offene Stale-Lage: wer inzwischen erneut
        // eingereicht hat, soll seine neue Auskunft nicht von einer alten Antwort verlieren.
        void query.refetch().then((r) => {
          const jetzt = r.data?.version;
          setEinreichLage((vorher) =>
            vorher?.art === "stale" && typeof jetzt === "number"
              ? { art: "stale", version: jetzt }
              : vorher,
          );
        });
        return;
      }
      setEinreichLage({
        art: "fehler",
        text: e instanceof ApiError ? e.message : t("state.error"),
      });
    },
  });

  // ================================================================================================
  // JOB 3667 R3 · DIE FREMDE ENTSCHEIDUNG — ÜBERNEHMEN ODER ABLEHNEN.
  // ================================================================================================
  //
  // ES GEHT KEIN INHALT HINAUS, NUR DIE KENNUNG DES VORSCHLAGS. Übernommen wird, was IM VORSCHLAG
  // steht — der Dienst liest `vorschlag.statement`/`vorschlag.bodyHtml` (`service.ts:3891`). Damit
  // kann eine Entscheidung gar nicht einen zwischenzeitlich veränderten Entwurf, einen nachgeladenen
  // Stand oder den aktuellen Inhalt des Objekts treffen (Lieferung 8). Der Client trägt diese Zusage
  // nicht, er kann sie nicht einmal brechen: der Vertrag hat kein Inhaltsfeld.
  //
  // `expectedVersion` IST DIE FASSUNG, DIE DER ENTSCHEIDER IM BILD HATTE. Hat ein Fremder dazwischen
  // geschrieben, gilt die Freigabe nicht (409) — das war der dritte der vier gemessenen Defekte.
  //
  // DASS DER EINREICHER NICHT SEIN EIGENER PRÜFER SEIN DARF, HÄLT DER SERVER (`PROPOSAL_OWN`,
  // `service.ts:3855`). Diese Fläche bietet den Knopf am eigenen Vorschlag nur nicht an — sie macht
  // die Regel SICHTBAR, sie ist nicht die Regel. Wer die Route direkt aufruft, läuft in dieselbe 403.
  const entscheiden = useMutation({
    mutationFn: (v: {
      proposalId: string;
      decision: "uebernehmen" | "ablehnen";
      expectedVersion: number;
      note?: string;
    }) =>
      endpoints.ko.act(koId, {
        action: "decide-proposal",
        proposalId: v.proposalId,
        decision: v.decision,
        expectedVersion: v.expectedVersion,
        ...(v.note && v.note.trim().length > 0 ? { note: v.note.trim() } : {}),
      }),
    onSuccess: () => {
      invalidate();
      setAblehnung(null);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const runAssist = (input: string, instruction?: string): Promise<string> =>
    endpoints.reasoner
      .assist(input, toReasonerLocale(i18n.language), instruction, draftProvenance(undefined, koId))
      .then((r) => r.text);

  // AUFTRAG-mega18 A-3 (unverändert übernommen): EIN Upload, EIN Aufruf, EIN Commit. Der lokale Body
  // zieht erst NACH dem Commit nach; ein unklarer Ausgang sperrt das Speichern.
  const appendDocument = useMutation({
    mutationFn: async (input: {
      points: ExtractedPoint[];
      fileName: string;
      original: OriginalDocument | null;
      nextBody: string;
    }): Promise<AppendDocumentOutcome> => {
      if (!appendOriginalRef.current.ref) {
        if (!input.original) {
          return { kind: "rejected", reason: "MISSING_DOCUMENT_ANCHOR" };
        }
        appendOriginalRef.current.ref = await endpoints.objects.upload({
          name: input.original.name,
          mime: input.original.mime,
          data: input.original.data,
          kind: "document",
          purpose: "anchor",
        });
      }
      const anchor = appendOriginalRef.current.ref;
      return commitDocumentAppend(
        {
          append: (opId) =>
            endpoints.ko.appendDocument(koId, {
              operationId: opId,
              anchor: {
                objectId: anchor.id,
                name: input.original?.name ?? input.fileName,
                mime: input.original?.mime ?? "application/octet-stream",
              },
              points: input.points.map((p) => fileSourcePayload(input.fileName, p)),
              changes: {
                bodyHtml: input.nextBody,
                statement: edit?.statement ?? "",
                ...(edit?.title ? { title: edit.title } : {}),
              },
            }),
        },
        newAppendOperationId(),
      );
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const runDocumentAppend = async (
    points: ExtractedPoint[],
    fileName: string,
    original: OriginalDocument | null,
  ): Promise<boolean> => {
    if (!edit) {
      return false;
    }
    const nextBody = appendExtractSections(
      edit.bodyHtml,
      points,
      fileName,
      normalizeExtractLocale(i18n.language),
    );
    let outcome: AppendDocumentOutcome;
    try {
      outcome = await appendDocument.mutateAsync({ points, fileName, original, nextBody });
    } catch {
      return false;
    }
    if (outcome.kind === "committed") {
      setAppendUnclear(false);
      setEdit((prev) => (prev ? { ...prev, bodyHtml: nextBody } : prev));
      invalidate();
      const failedFollowUps = outcome.commit?.followUpsFailed ?? [];
      push(
        failedFollowUps.length > 0 ? "error" : "success",
        failedFollowUps.length > 0
          ? t("xtr.append.followUpsFailed", { steps: failedFollowUps.join(", ") })
          : t("ko.sourceAdded"),
      );
      return true;
    }
    if (outcome.kind === "unknown") {
      setAppendUnclear(true);
      invalidate();
      push("error", t("xtr.append.unclear"));
      return false;
    }
    setAppendUnclear(false);
    push(
      "error",
      t(
        outcome.reason === "EXTERNAL_ATTACH_BLOCKED"
          ? "xtr.append.blockedByStage"
          : outcome.reason === "MISSING_DOCUMENT_ANCHOR"
            ? "xtr.append.missingAnchor"
            : "state.error",
      ),
    );
    return false;
  };

  // ================================================================================================
  // JOB 4251 · DER STEMPEL GEHT NUR HINAUS, WENN ER AUS EINER FRISCHEN ANTWORT STAMMT.
  // ================================================================================================
  //
  // Zwei Lagen lassen ihn WEGFALLEN, und beide sind die ehrliche Auskunft, keine Nachlässigkeit:
  //   · DER EINTRAG TRÄGT IHN NICHT (Altbestand ohne Projektionszeile, `METADATA_REVISION_NONE`) —
  //     dann gibt es keinen Stand, den man erwarten könnte.
  //   · DER GEZEIGTE EINTRAG STEHT AUS EINER GESCHEITERTEN AUFFRISCHUNG DA (`abfrageMitBestand`
  //     hält den Bestand sichtbar, `auffrischungGescheitert` sagt es). Dann ist die Zahl darin die
  //     ALTE — dieselbe Falle wie bei der Fassungszahl nach einem 409 (JOB 4075 R2).
  //
  // OHNE STEMPEL VERHÄLT SICH DER AUFRUF WIE VOR DIESEM AUFTRAG: unbedingt. Das ist die schwächere
  // Zusage, aber die WAHRE — eine geratene Zahl wiese rechtmässige Schreibvorgänge ab, ohne je
  // einen fremden zu schützen.
  const gesehenerEinordnungsstand = (stand: KnowledgeObject): number | null =>
    auffrischungGescheitert(query) || typeof stand.metadataRevision !== "number"
      ? null
      : stand.metadataRevision;

  const startEdit = (ko: KnowledgeObject): void => {
    setErr(null);
    setEinreichLage(null);
    setSpeicherLage(null);
    setSperreGemeldet(false);
    setPruefwegHaken(false);
    setCaptionRequest(null);
    // JOB 4163: ein frisch aufgehendes Formular hat nichts nachzuholen — die Buchführung des
    // vorigen Versuchs gehörte zu einem anderen Text und einer anderen Fassung.
    teilstandRef.current = null;
    setEdit({
      title: ko.title,
      statement: ko.statement,
      bodyHtml: ko.bodyHtml ?? "",
      type: ko.type,
      category: ko.category,
      conditions: [...ko.conditions],
      measures: [...ko.measures],
      tags: [...ko.tags],
      // JOB 4075: die Fassung, die in DIESEM Moment auf dem Bildschirm stand. Sie ist der Bezug des
      // bedingten Schreibzugriffs (s. `EditState.version`) und wird beim Tippen nicht nachgeführt.
      version: typeof ko.version === "number" ? ko.version : null,
      // JOB 4251: dasselbe für die Einordnung — der Stand, der in DIESEM Moment auf dem Bildschirm
      // stand (s. `gesehenerEinordnungsstand`).
      einordnung: gesehenerEinordnungsstand(ko),
    });
  };

  // KEIN Aufräum-Effekt beim Wechsel des Eintrags: die Fläche montiert diese Komponente mit
  // `key={koId}` neu (s. `BibliothekFlaeche`). Ein offenes Formular des vorigen Objekts kann
  // deshalb gar nicht über dem neuen stehenbleiben — der Zustand entsteht mit dem Eintrag.

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref-Guard verhindert Mehrfachlauf.
  useEffect(() => {
    if (!autoEditDone.current && params.get("edit") === "1" && canEdit && query.data) {
      autoEditDone.current = true;
      startEdit(query.data);
    }
  }, [query.data, params, canEdit]);

  // JOB 3034 R2 · KONFLIKTRUNDE 2 (nachgezogen): scheitert die Auffrischung eines schon geholten
  // Eintrags, bleiben Eintrag und Stufenkennzeichen stehen — der Fehler wird als Hinweis über der
  // Fläche gesagt, nicht als Verlust des Bestands (`lib/confidentiality.ts`, `abfrageMitBestand`).
  const bestand = abfrageMitBestand(query);
  if (bestand.isError) {
    return (
      <div data-testid="bib-lesen" className="w-[720px] max-w-full py-9">
        <p className="text-[13px] leading-relaxed text-muted">{t("lib.lesen.fehler")}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-2 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
        >
          {t("lib.liste.erneut")}
        </button>
      </div>
    );
  }
  const ko = bestand.data;
  if (!ko) {
    // Laden: leere Fläche. Ein Wort hier wäre der Erklärtext, den diese Seite abschafft.
    return <div data-testid="bib-lesen" className="w-[720px] max-w-full py-9" />;
  }

  // JOB 3362: WAS in der Lesespalte steht — die Übersetzung oder das Original. EINE Ableitung, von
  // Titel und Fließtext gemeinsam gelesen; `undefined` heisst „das Original". Der Leser hat mit
  // „Original anzeigen" das letzte Wort, und ohne Variante gibt es diese Frage gar nicht.
  const gelesen = zeigtOriginal ? undefined : lesevariante;

  // ================================================================================================
  // JOB 3667 R3 · WELCHER DER DREI WEGE HIER GILT — DREI ABLEITUNGEN, KEINE VIERTE.
  // ================================================================================================
  //
  // `einreichPflicht` (FALL 2) IST BEWUSST ENG: nur ein FREIGEGEBENES Objekt (`status === "validiert"`)
  // ist geschützt. Genau so steht es an der Route (`ko-routes.ts:2062`) — ein Objekt, das nie
  // freigegeben wurde oder nach einer Revision wieder offen steht, bearbeitet die Expertin weiter wie
  // bisher. Eine breitere Regel hier als dort hiesse: die Fläche verweigert etwas, das der Server
  // erlaubt, und nähme dem Erfassungs- und Nacharbeitsweg die Grundlage.
  //
  // `sperreGemeldet` STEHT MIT IN `pruefwegAktiv`, DAMIT DIE ABLEITUNG NICHT LÜGT: die Route hat den
  // direkten Weg gerade abgewiesen. Was diese Fläche vorher glaubte, ist damit widerlegt — der
  // Einreichweg ist der einzige, der noch offensteht.
  //
  // `offeneVorschlaege` LIEST `status`, NICHT DIE LISTENLÄNGE. Ein übernommener oder abgelehnter
  // Vorschlag ist entschieden und steht nicht mehr zur Entscheidung an; er verschwindet aus dem Bild,
  // sobald er es ist. Fehlt das Feld ganz (Lesewege, die es nicht mitschicken — s. `api/types.ts`),
  // ist die Liste leer und die Fläche sagt NICHTS über Vorschläge, statt „keine" zu behaupten.
  const einreichPflicht = ko.status === "validiert" && !darfFreigeben;
  const pruefwegAktiv = einreichPflicht || sperreGemeldet || (darfFreigeben && pruefwegHaken);
  const offeneVorschlaege = (ko.proposals ?? []).filter((p) => p.status === "offen");
  // JOB 3667 R4 · BEFUND 2 — DER FALL, IN DEM DAS VERSTECKEN ALLEIN NICHT REICHT.
  //
  // Der Prüfweg kann MITTEN IM BEARBEITEN gelten: der Berechtigte setzt den Haken (Fall 3), oder die
  // Route meldet 403 `PROPOSAL_REQUIRED`, nachdem jemand längst am Titel gearbeitet hat. Dann stehen
  // Änderungen im Zustand, die der Einreich-Aufruf nicht mitnimmt. Sie wortlos verschwinden zu
  // lassen wäre dasselbe irreführende „eingereicht" in Grün. Also werden sie BENANNT — mit denselben
  // Feldnamen, die der Änderungsüberblick verwendet.
  const nichtEingereichteAenderungen = koRevisionSummary(ko, edit).items.filter(
    (i) => !EINGEREICHTE_FELDER.includes(i.id),
  );

  const impact =
    conflicts.data === undefined
      ? conflictImpact(ko.id, [])
      : conflictImpact(ko.id, conflicts.data);
  const notice = conflictNotice(impact);
  // JOB 3072 · N4: der Zustand kommt aus DERSELBEN Stelle wie in der Liste links — der vom Server
  // erhobene `anzeigestatus` dieses Objekts (`GET /api/kos/:id`, ko-routes.ts:902), mit dem
  // Konfliktvorrang der Oberfläche davor und dem benannten Rückfall dahinter. Vorher rechnete diese
  // Fläche mit `deriveStatus` selbst und konnte „In Prüfung", „Abgelehnt" und „Re-Validierung"
  // nicht erreichen, obwohl der Server sie mitschickte.
  const zustand = anzeigestatusAus(ko, { konflikt: impact.limited });
  const status = zustand.status;
  // JOB 3068 · N5: die Auskunft an die VERFASSERIN. Sie entsteht in `lib/eigeneKollision.ts` und
  // nirgends sonst; hier wird sie nur gezeichnet. `eigenesObjekt` ist dieselbe Bedingung, unter der
  // sie bis JOB 3063 in `MehrAbschnitte` stand — das Signal hängt am eigenen Bestand (A28).
  const eigenesObjekt = ko.author === user?.id;
  // JOB 3084 · Q6: der Onlinezustand wird GEREICHT, nicht gedeutet. Hier entsteht keine einzige
  // neue Bedingung — was dasteht, entscheidet weiterhin allein `lib/eigeneKollision.ts`. Ohne diese
  // Zeile stand nach „frisch laden, Netz trennen, zurückkommen" innerhalb der `staleTime` von 30 s
  // (`main.tsx:21`) die Verneinung da, obwohl gerade nichts geprüft werden konnte (Befund R-1585).
  const kollision = eigeneKollisionDetail(
    {
      koId: ko.id,
      befunde: eigeneBefunde,
      konflikte: conflicts,
      kos: koListe,
    },
    netzOnline,
  );
  const kollisionsWeg = kollision.weg;
  // WANN DIE ZEILE STEHT — die einzige Ausnahme ist `laedt` OHNE Befund, und sie ist keine Willkür:
  // dort ist NICHTS bekannt, und diese Fläche schweigt beim Laden, statt „Lädt …" zu schreiben
  // (Kopf §5, ebenso die leere Lesefläche :388). Liegt dagegen ein Befund vor, wird er in JEDER
  // Lage genannt — das ist die Regel aus `eigeneKollision.ts:245` und Pedis Ausgangsbefund A27.
  const kollisionZeigen =
    eigenesObjekt && (kollision.art !== "keine" || kollision.lage !== "laedt");
  // Der Konflikt steht seit JOB 3072 schon IM Zustand — ein zweites `impact.limited` hier wäre die
  // zweite Statusrechnung, die dieser Auftrag abschafft.
  const ton = zustandsTon(status);
  const erstellt = formatKoTimestamp(ko.createdAt, i18n.language);
  // JOB 3034: die Vertraulichkeitsstufe im Klartext — JEDE Stufe, und die fehlende sagt, dass sie
  // fehlt (`vertraulichkeitsAuskunft`). Dieselbe Funktion und derselbe Tönungssatz wie auf jeder
  // anderen Fläche, damit hier keine zweite Auslegung derselben Aussage entsteht.
  const auskunft = vertraulichkeitsAuskunft(ko);
  const meta = [ko.category, nameOf(ko.author), erstellt].filter(Boolean).join(" · ");
  // Auftrag §5.3/§5a: EINE verbindliche Aktion, für jeden gewählten Eintrag dieselbe — „Fragen",
  // mit der Herkunft dieses Eintrags (`ko=<id>`, ein Marker — kein Filter, s. `fragen.ts`),
  // vorbelegt mit dem aktuellen Suchtext. Der frühere
  // Weg über `libraryUseCta` verzweigte über die Reife und schickte offene Einträge nach
  // `/validierung`; das war die zweite Wahrheit, die dieser Umbau abschafft (Codex an Runde 4).
  const fragen = fragenHref(ko.id, suchtext.trim() || ko.title, ko.confidentiality);
  // JOB 3108 · UX-03 — EINE Zählung, zwei Ansichten, und keine zweite Wahrheit: beide Zahlen
  // kommen aus DEMSELBEN `ko.attachments`, in benachbarten Zeilen.
  //   · Chip: Bilder im Text · Sprung: Anhänge insgesamt.
  const anhaenge = ko.attachments ?? [];
  const bilder = anhaenge.filter((a) => a.mime.startsWith("image/")).length;
  const quellen = ko.sources ?? [];
  // ================================================================================================
  // JOB 3474 · REVIEW26 — DIE DRITTE MENGE, DIE DER KOPF BISHER NICHT KANNTE.
  // ================================================================================================
  //
  // Prüferbefund (NUTZERBEFUNDE-AN-CLAUDE-20260908.md:47-51, Posten 4): „Am Kopf … Anhänge · keine
  // … Eine funktionierende Original-DOCX ist erst nach dem langen Text verlinkt."
  //
  // GEMESSENE URSACHE: der Ganzdokument-Import legt das Original in den Object-Store und hängt es
  // als Body-Datei-Referenz an den Text (`pages/Capture.tsx:1336-1349`); ein `KoAttachment` entsteht
  // dabei NICHT — `finalizeCaptureSubmit` bekommt sein `original` nur im Warteschlangen-Weg
  // (`Capture.tsx:1810-1812`). Die beiden Zeilen darüber können diese Datei also gar nicht sehen.
  //
  // GELESEN WIRD DER TEXT, DER WIRKLICH DASTEHT: bei aktiver Lesevariante ist das ihr Fließtext,
  // sonst das Original. Sonst zeigte der Kopf auf einen Link, den die Fläche gerade nicht zeichnet.
  const gezeichneterText = gelesen ? (gelesen.bodyHtml ?? null) : ko.bodyHtml;
  const originalDateien = bodyFileLinksFromHtml(gezeichneterText);
  /**
   * JOB 4145 R3: der Sprung an eine Ueberschrift des LESETEXTS.
   *
   * ES WIRD NICHTS MEHR GESUCHT. `ziel` IST die Ueberschrift — dieselbe Elementreferenz, die
   * `Lesegliederung` beim Sammeln in die Marke gelegt hat. Zwei Runden lang stand hier ein
   * `querySelectorAll(...)[position]`, und zweimal zaehlte die Leiste anders als der Baum; jetzt
   * gibt es keine Zahl mehr, die falsch sein koennte (s. Kopf von `Lesegliederung`).
   *
   * DER FOKUS WANDERT MIT. Ohne ihn landet ein Mensch ohne Maus nach dem Klick wieder am
   * Seitenanfang und liest die gesuchte Stelle nie. `tabIndex = -1` macht die Ueberschrift
   * fokussierbar, ohne sie in die Tabulatorreihenfolge zu stellen; der Knoten stammt aus
   * `dangerouslySetInnerHTML` und wird von React nicht nachgefuehrt, das Attribut bleibt also
   * stehen, bis der Text selbst ausgetauscht wird.
   *
   * R4 · UND WENN DER KNOTEN DOCH ABGEHAENGT IST, WIRD NEU GESAMMELT STATT STILLGEHALTEN.
   *
   * Seit R4 sammelt `Lesegliederung` nach jedem Render neu, der Fall sollte also nicht mehr
   * auftreten. „Sollte nicht" ist aber keine Zusage: aendert sich der Baum OHNE Renderdurchlauf
   * (fremdes Skript, Browsererweiterung, eine kuenftige Flaeche, die im Lesetext schreibt), zeigt
   * die Marke auf einen toten Knoten. In Runde 3 blieb der Knopf dann wirkungslos — ein stiller
   * Ausfall, und genau die Gattung Fehler, gegen die dieser Auftrag steht. Jetzt wird frisch
   * gesammelt und der Eintrag an DERSELBEN Position mit DEMSELBEN Text angesprungen; nur wenn es
   * ihn wirklich nicht mehr gibt, geschieht nichts — wie beim Dateisprung daneben.
   */
  const springeZurUeberschrift = (marke: Sprungmarke): void => {
    const ziel = marke.ziel.isConnected ? marke.ziel : ersatzziel(textRef.current, marke.eintrag);
    if (!ziel) {
      return;
    }
    ziel.tabIndex = -1;
    ziel.scrollIntoView({ block: "start" });
    ziel.focus();
  };
  /**
   * JOB 3474: der Weg vom Kopf zur Originaldatei. Ihr Link steht schon im Fließtext (er kommt aus
   * `fileLinkHtml` und wird von `SanitizedHtml` gezeichnet) — der Knopf holt ihn ins Bild und gibt
   * ihm den Fokus. Kein zweiter Download-Weg und keine zweite Adresse: von dort führt derselbe
   * Link weiter, den ein Mensch am Textende auch angeklickt hätte.
   *
   * Findet sich der Link nicht (der Sanitizer hat ihn verworfen), geschieht NICHTS — lieber ein
   * wirkungsloser Knopf als ein Sprung, der irgendwohin führt.
   */
  const springeZurDatei = (objectId: string): void => {
    const href = objectRawHref(objectId);
    if (!href) {
      return;
    }
    const ziel = textRef.current?.querySelector<HTMLAnchorElement>(`.attachment a[href="${href}"]`);
    if (!ziel) {
      return;
    }
    ziel.scrollIntoView({ block: "start" });
    ziel.focus();
  };
  /**
   * Der Sprung vom Kopf in einen Abschnitt hinter „Mehr". Erst aufklappen — `MehrAbschnitte` ist
   * sonst gar nicht gemountet —, dann das Ziel setzen. Der `nonce` zählt hoch, damit derselbe
   * Abschnitt auch beim zweiten Mal wieder angesprungen wird.
   */
  const springeZu = (schluessel: string): void => {
    setMehrOffen(true);
    setSprungZiel((vorher) => ({ schluessel, nonce: (vorher?.nonce ?? 0) + 1 }));
  };
  /**
   * Die Zeile „Mehr" von Hand auf- und zuklappen. Beim ZUKLAPPEN verfällt das Sprungziel: sonst
   * spränge das nächste Aufklappen ungefragt wieder dorthin und nähme den Fokus mit.
   */
  const mehrUmschalten = (): void => {
    setMehrOffen((v) => !v);
    if (mehrOffen) {
      setSprungZiel(null);
    }
  };
  const darfLoeschen = role === "admin" || role === "controller" || ko.author === user?.id;
  const fb = latestValidationFeedback(ko.comments);

  return (
    <ImageDescribeProvider provenance={draftProvenance(ko.confidentiality, koId)}>
      <div data-testid="bib-lesen" className="flex w-[720px] max-w-full flex-col gap-[18px] py-9">
        {/* JOB 3034 R2 · KONFLIKTRUNDE 2: derselbe Hinweis wie auf jeder anderen Fläche, aus
          derselben Quelle — seit JOB 3063 R6 auch in DERSELBEN Bauform (`AuffrischungHinweis`),
          nicht mehr als abgeschriebener Zwilling. Er schweigt, wenn die Liste es schon sagt. */}
        {hinweisSchonGesagt ? null : <AuffrischungHinweis query={query} />}
        {/* Kopfzeile: Pille · Meta · Fragen · „…" */}
        <div className="flex items-center gap-2">
          <span
            data-testid="bib-pille"
            data-bib-text="pille"
            // JOB 3072 · N4: worauf dieses Wort steht — `server` oder `bestand`, und welche Eingänge
            // der Server für diese Antwort nicht erhoben hat. Rein maschinenlesbar: kein neuer Satz,
            // kein neuer Übersetzungsschlüssel, kein Erklärtext auf der Lesefläche (H4).
            {...anzeigestatusAnker(zustand)}
            className={cx(
              "rounded-[999px] px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.3px]",
              PILLEN_TON[ton],
            )}
          >
            {t(`status.${status}`)}
          </span>
          <span
            data-testid="ko-vertraulichkeitsstufe"
            title={t("conf.field")}
            aria-label={`${t("conf.field")}: ${t(auskunft.labelKey)}`}
            className={cx(
              "rounded-pill px-1.5 py-0.5 font-semibold",
              CONF_TONE_CLASS[auskunft.tone],
            )}
          >
            {t(auskunft.labelKey)}
          </span>
          <span data-testid="bib-meta" data-bib-text="meta" className="text-[12.5px] text-muted">
            {meta}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <RoleLink
              to={fragen}
              className="rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text"
              hoverClassName="hover:bg-hairline-soft"
              testId="bib-fragen"
            >
              {() => t("lib.ask")}
            </RoleLink>
            <Menue
              beschriftung="…"
              ariaLabel={t("lib.menue.weitere")}
              testId="bib-eintrag-menue"
              ausrichtung="rechts"
              breite="w-[220px]"
            >
              {(schliessen) => (
                <>
                  {canEdit ? (
                    <MenuePunkt
                      testId="bib-menue-bearbeiten"
                      onClick={() => {
                        startEdit(ko);
                        schliessen();
                      }}
                    >
                      {t("ko.edit")}
                    </MenuePunkt>
                  ) : null}
                  {canReview ? (
                    <>
                      <MenuePunkt
                        onClick={() => {
                          act.mutate({ action: "rate", verdict: "up" });
                          schliessen();
                        }}
                      >
                        {t("ko.validate")}
                      </MenuePunkt>
                      <MenuePunkt
                        onClick={() => {
                          setErr(null);
                          setDetailFeedbackText("");
                          setDetailFeedback("warn");
                          schliessen();
                        }}
                      >
                        {t("ko.conditional")}
                      </MenuePunkt>
                      <MenuePunkt
                        onClick={() => {
                          setErr(null);
                          setDetailFeedbackText("");
                          setDetailFeedback("down");
                          schliessen();
                        }}
                      >
                        {t("ko.reject")}
                      </MenuePunkt>
                    </>
                  ) : null}
                  {/* „Noch gültig" und „Re-Validierung starten" waren zwei Beschriftungen für
                      dieselbe Handlung (`action: "revalidate"`). Hier steht sie EINMAL, mit dem
                      Wort der Bibliothek. */}
                  {canRevalidate(ko.status) ? (
                    <MenuePunkt
                      testId="bib-menue-revalidieren"
                      disabled={act.isPending}
                      onClick={() => {
                        act.mutate({ action: "revalidate" });
                        push("success", t("lib.revalidateDone"));
                        schliessen();
                      }}
                    >
                      {t("lib.revalidate")}
                    </MenuePunkt>
                  ) : null}
                  {darfLoeschen ? (
                    <>
                      <MenueTrenner />
                      <MenuePunkt
                        testId="bib-menue-loeschen"
                        onClick={() => {
                          // Frisch beginnen — aber NIE einen laufenden Aufruf vergessen (R2,
                          // Korrekturpflicht 1). Erreichbar ist dieser Punkt währenddessen ohnehin
                          // nicht (die Rückfrage steht davor); die Bedingung hält die Regel trotzdem
                          // an der Stelle fest, an der zurückgesetzt wird.
                          if (!removeKo.isPending) {
                            removeKo.reset();
                          }
                          setLoeschenOffen(true);
                          schliessen();
                        }}
                      >
                        {t("ko.deleteButton")}
                      </MenuePunkt>
                    </>
                  ) : null}
                </>
              )}
            </Menue>
          </div>
        </div>

        {/* SCRUM-245: der Treffergrund — nur bei aktiver Suche, sonst steht hier nichts. */}
        {suchtext.trim().length > 0 && treffer.length > 0 ? (
          <p
            data-testid="bib-treffergrund"
            data-bib-text="treffer"
            className="text-[12px] text-muted-2"
          >
            {`${t("lib.matchIn")} ${treffer.map((f) => t(`lib.match.${f}`)).join(" · ")}`}
          </p>
        ) : null}

        {/* Der Konflikt-Satz — NUR im Fall, EIN Satz, über dem Titel. Er spricht zum LESER über die
            Nutzbarkeit und gilt für jedes Objekt; die Zeile darunter spricht zur VERFASSERIN über
            ihren eigenen Eintrag. Zwei Aussagen, nicht zweimal dieselbe — gemessen in
            `tests/ko/job3025-a27-mounted.test.tsx` R-i3/R-i4. */}
        {notice ? (
          <p data-testid="bib-konfliktsatz" className="text-[13px] text-muted">
            {t(notice.hintKey)}
          </p>
        ) : null}

        {/* JOB 3068 · N5 — DER EIGENE BEFUND UND SEIN DECKUNGSSATZ. EINE Zeile, ohne einen Klick. */}
        {kollisionZeigen ? (
          // `<div>` und nicht `<p>`: die gesperrte Fassung von `RoleLink` ist ein `<div>`
          // (`RoleLink.tsx:91-103`), und ein `<div>` in einem `<p>` ist ungültiges HTML — React
          // meldete es als `validateDOMNesting`, der Browser hätte den Absatz vorzeitig geschlossen
          // und die Zeile zerrissen. Am Aussehen ändert sich nichts (dieselben Klassen), an der
          // Messung auch nicht: `data-bib-text` und der Testanker sitzen weiter hier.
          <div
            data-testid="job3025-kollision"
            data-bib-text="kollision"
            className="text-[13px] leading-relaxed text-muted"
          >
            {t(kollision.satzKey)}
            {/* Der Deckungssatz. Welcher Satz das ist, entscheidet die Ableitung — und sie wählt
                einen Satz MIT Platzhaltern nur, wenn beide Zahlen vorliegen (`DECKUNG_SATZ`,
                eigeneKollision.ts). Hier wird deshalb blind eingesetzt: es kann kein Loch
                entstehen, und `null` wird nirgends zu `0`. */}
            {kollision.deckung ? (
              <span data-testid="bib-deckungssatz">
                {" "}
                {t(kollision.deckung.satzKey, {
                  geprueft: kollision.deckung.geprueft,
                  bestand: kollision.deckung.bestand,
                })}
              </span>
            ) : null}
            {/* Der Vorbehalt über die Datenlage — nur NEBEN einem Befund. Ohne Befund trägt ihn
                `satzKey` bereits selbst (`eigeneKollision.ts:263-264`), er stünde sonst doppelt. */}
            {kollision.art !== "keine" && kollision.datenlageKey ? (
              <span data-testid="bib-kollision-lage"> {t(kollision.datenlageKey)}</span>
            ) : null}
            {kollisionsWeg ? (
              <>
                {" "}
                <RoleLink
                  to={kollisionsWeg.to}
                  className="font-semibold text-brand-text underline"
                  testId="bib-kollision-weg"
                >
                  {() => t(kollisionsWeg.textKey)}
                </RoleLink>
              </>
            ) : null}
            {/* Kein Knopf ohne Wirkung: nur wo ein neuer Versuch etwas ändern kann (REGELN.md §7). */}
            {kollision.wiederholenMoeglich ? (
              <>
                {" "}
                <button
                  type="button"
                  data-testid="bib-kollision-wiederholen"
                  onClick={kollision.erneutPruefen}
                  className="font-semibold text-brand-text underline"
                >
                  {t("kollision.wiederholen")}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {/* SCRUM-124/330/331: Rückgabe- und Nacharbeitslage — nur im jeweiligen Fall, je EIN Satz. */}
        {reworkSaved ? (
          <p className="text-[13px] text-muted">
            {t("ko.rework.savedTitle")}{" "}
            {/* mega70 B: `/validierung` verlangt `controller`. Eine Expertin, die gerade
                nachgearbeitet hat, darf hier keinen Weg sehen, der sie auf `/start` zurückwirft —
                die gesperrte Fassung behält den Text und verliert Link und Pfeil. */}
            <RoleLink
              to={reworkValidationHref()}
              className="font-semibold text-brand-text underline"
            >
              {() => t("ko.rework.toValidation")}
            </RoleLink>
          </p>
        ) : null}
        {reviewReworkContext && !reworkSaved ? (
          <div data-testid="bib-rework" className="text-[13px] text-muted">
            {/* SCRUM-332: das konkrete jüngste Validierungsfeedback — der Grund der Nacharbeit. */}
            {fb ? (
              <p>
                {t(`ko.rework.feedback.${fb.verdict}`)}: {fb.body}
              </p>
            ) : null}
            {/* SCRUM-336: die Schrittfolge der Nacharbeit. Sie steht NUR im Nacharbeitskontext —
                dort ist sie die Arbeitsanweisung, nicht Erklärtext auf einer Lesefläche. */}
            <ol className="mt-1 space-y-0.5 text-[12.5px]">
              {reworkNextSteps().map((step, idx) => (
                <li key={step.key}>
                  {idx + 1}. {t(step.labelKey)}
                </li>
              ))}
            </ol>
            {/* mega70 Block B (JOB 1973 · B2): der Rückweg aus der Nacharbeit. Er hängt an
                `canEdit = role !== "viewer"`, `/validierung` verlangt aber `controller` — eine
                Expertin darf hier deshalb keinen begehbaren Weg sehen, sondern die gesperrte
                Fassung mit Text ohne Pfeil. Genau diese Lage misst
                `tests/capture/mega70-block-b3-herkunft-render.test.tsx`. */}
            <RoleLink
              to="/validierung"
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-text underline"
              testId="bib-rework-zurueck"
            >
              {(erreichbar) => (
                <>
                  {t("ko.rework.back")}
                  {erreichbar ? <span aria-hidden="true">→</span> : null}
                </>
              )}
            </RoleLink>
          </div>
        ) : null}
        {/* SCRUM-124: Rückgabe zur Nacharbeit — ein Satz, nur im Fall. */}
        {isReturnedForRework(audit.data ?? [], ko.id) ? (
          <p data-testid="bib-zurueckgegeben" className="text-[13px] text-trust-warn-text">
            {t("ko.returnedBanner")}
          </p>
        ) : null}

        {edit ? (
          // ---- Bearbeiten: dasselbe Formular wie bisher, an derselben Stelle -------------------
          <div className="space-y-3">
            {/* ==========================================================================
                JOB 3667 R4 · BEFUND 2 — DAS FORMULAR SAGT, WAS DIESER WEG TRÄGT.
                ==========================================================================

                Im Prüfweg geht ein `KoProposal` hinaus, und der trägt `statement` und `bodyHtml`,
                sonst nichts. Deshalb stehen die übrigen Felder hier NICHT als Eingabe: ein Titelfeld,
                dessen Inhalt nie beim Server ankommt, wäre eine Scheinfunktion, und der Satz
                „Eingereicht" darüber eine Unwahrheit über Felder, die der Server nie bekam.

                DER ZWEITE SATZ nennt die Änderungen, die beim Umschalten schon im Zustand standen
                (s. `nichtEingereichteAenderungen`) — sonst verschwänden sie wortlos mit ihren
                Feldern. */}
            {pruefwegAktiv ? (
              <div
                data-testid="bib-pruefweg-felder"
                className="rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] leading-relaxed text-muted"
              >
                {t("ko.propose.onlyFields")}
                {nichtEingereichteAenderungen.length > 0 ? (
                  <span
                    data-testid="bib-pruefweg-felder-verworfen"
                    className="mt-1 block text-text"
                  >
                    {t("ko.propose.droppedFields", {
                      felder: nichtEingereichteAenderungen.map((i) => t(i.labelKey)).join(", "),
                    })}
                  </span>
                ) : null}
              </div>
            ) : null}
            {pruefwegAktiv ? null : (
              <Field label={t("capture.fTitle")}>
                <TextInput
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
            )}
            <Field label={t("capture.fStatement")}>
              <textarea
                value={edit.statement}
                onChange={(e) => setEdit({ ...edit, statement: e.target.value })}
                rows={3}
                className={textareaCls}
              />
              <AiAssistBox
                text={edit.statement}
                runAssist={runAssist}
                onApply={(next) => setEdit({ ...edit, statement: next })}
              />
            </Field>
            <Field label={t("capture.fBody")}>
              <button
                type="button"
                onClick={() => {
                  setStudioApplied(false);
                  setStudioOpen(true);
                }}
                className="mb-2 inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
              >
                <Sparkles size={14} /> {t("studio.open")}
              </button>
              <KnowledgeInputStudio
                open={studioOpen}
                onClose={() => setStudioOpen(false)}
                bodyHtml={edit.bodyHtml}
                documentTitle={edit.title}
                onApply={(bodyHtml) => {
                  setEdit({ ...edit, bodyHtml });
                  setStudioApplied(true);
                }}
                runAssist={runAssist}
                images={(ko.attachments ?? [])
                  .filter((a) => a.objectId && a.mime.startsWith("image/"))
                  .map((a) => ({ objectId: a.objectId as string, name: a.name }))}
                files={editorFilesFromAttachments(ko.attachments ?? [])}
                attachments={ko.attachments ?? []}
              />
              {studioApplied ? (
                <p className="mb-2 rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[11.5px] text-trust-pos-text">
                  {t("studio.applied")}
                </p>
              ) : null}
              <EditorAttachmentContext attachments={ko.attachments ?? []} />
              <EditorContentQuality bodyHtml={edit.bodyHtml} attachments={ko.attachments ?? []} />
              <BodyTemplateChooser
                bodyHtml={edit.bodyHtml}
                onApply={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
              />
              <RichTextEditor
                value={edit.bodyHtml}
                onChange={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
                images={(ko.attachments ?? [])
                  .filter((a) => a.objectId && a.mime.startsWith("image/"))
                  .map((a) => ({ objectId: a.objectId as string, name: a.name }))}
                files={editorFilesFromAttachments(ko.attachments ?? [])}
                documentTitle={edit.title}
                captionFormRequest={captionRequest ?? undefined}
                onTitelVorschlag={(titel) => setEdit({ ...edit, title: titel })}
              />
              <AiAssistBox
                text={bodyTextForAssist(edit.bodyHtml)}
                runAssist={runAssist}
                applyFn={(mode, _original, suggestion) =>
                  applyBodyAssist(mode, edit.bodyHtml, suggestion)
                }
                onApply={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
                hintKey="capture.ai.bodyHint"
                extraApplyActions={EDITOR_BLOCKS.map((block) => ({
                  labelKey: `capture.ai.applyAs.${block}`,
                  apply: (_original, suggestion) =>
                    applyBodyAssistBlock(edit.bodyHtml, suggestion, block),
                }))}
              />
              <BodyExtractPanel koId={koId} onAppend={runDocumentAppend} />
            </Field>
            {/* Bedingungen, Maßnahmen, Schlagworte, Art und Kategorie: derselbe Grund wie beim
                Titel — der Einreich-Aufruf trägt sie nicht, die Übernahme schreibt sie nicht. */}
            {pruefwegAktiv ? null : (
              <>
                <ListEditor
                  label={t("capture.fConditions")}
                  items={edit.conditions}
                  onChange={(conditions) => setEdit({ ...edit, conditions })}
                />
                <ListEditor
                  label={t("capture.fMeasures")}
                  items={edit.measures}
                  onChange={(measures) => setEdit({ ...edit, measures })}
                />
                <TagEditor tags={edit.tags} onChange={(tags) => setEdit({ ...edit, tags })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("capture.fType")}>
                    <select
                      value={edit.type}
                      onChange={(e) => setEdit({ ...edit, type: e.target.value as KnowledgeType })}
                      className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                    >
                      {KNOWLEDGE_TYPES.map((k) => (
                        <option key={k} value={k}>
                          {t(`ktype.${k}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("capture.fCategory")}>
                    <TextInput
                      value={edit.category}
                      onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                    />
                  </Field>
                </div>
              </>
            )}
            <KoRevisionSummary original={ko} edit={edit} />
            {/* SCRUM-344: nach einer Übernahme aus dem Studio ehrlich klarmachen, dass der Inhalt
                im Revisionsentwurf liegt — Speichern erzeugt eine neue Version und eine erneute
                Prüfung, keine Freigabe. */}
            {studioApplied
              ? (() => {
                  const conf = studioSaveConfidence("revision");
                  return (
                    <div className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-2.5">
                      <p className="text-[12.5px] font-semibold text-trust-warn-text">
                        {t(conf.titleKey)}
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                        {t(conf.hintKey)}
                      </p>
                      <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-trust-warn-text">
                        {t(conf.nextStepKey)}
                      </p>
                    </div>
                  );
                })()
              : null}
            {appendUnclear ? (
              <div className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                {t("xtr.append.unclear")}
              </div>
            ) : null}
            {/* JOB 4163: der SAMMELZWEIG des Speicherwegs, jetzt benennbar. Er bleibt für alles
                Übrige unverändert (Netzabbruch vor dem ersten Aufruf, 500 am `revise` selbst) —
                die Marke steht hier, damit ein Prüfstand belegen kann, dass Teilabbruch und
                entzogenes Recht ihn NICHT mehr benutzen. */}
            {err ? (
              <div
                data-testid="bib-speichern-fehler"
                className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
              >
                {err}
              </div>
            ) : null}
            {/* ==========================================================================
                JOB 3667 R3 · DIE ACCOUNTREGEL AM BEDIENORT — DREI FÄLLE, DREI BILDER.
                ==========================================================================

                FALL 2 (`einreichPflicht`) und die nachträglich gemeldete Sperre: der Satz steht, und
                er sagt die Folge, nicht bloss das Verbot — der Text wird eingereicht und gilt erst
                nach fremder Freigabe. KEIN HAKEN daneben: hier ist die Prüfung Pflicht, und ein
                abwählbarer Haken wäre die Unwahrheit.

                FALL 3 (`darfFreigeben`): der Haken. NUR hier ist etwas freiwillig. */}
            {einreichPflicht || sperreGemeldet ? (
              <p
                data-testid="bib-einreichen-pflicht"
                className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text"
              >
                {t("ko.propose.mustReview")}
              </p>
            ) : darfFreigeben ? (
              <label
                data-testid="bib-pruefweg-haken"
                className="flex items-center gap-2 text-[12.5px] text-muted"
              >
                <input
                  type="checkbox"
                  checked={pruefwegHaken}
                  onChange={(e) => {
                    setPruefwegHaken(e.target.checked);
                    // Die Auskunft des vorigen Versuchs gehört nicht zum neu gewählten Weg.
                    setEinreichLage(null);
                  }}
                />
                {t("ko.propose.optIn")}
              </label>
            ) : null}
            {/* ==========================================================================
                JOB 4075 · DER KONFLIKT DES DIREKTEN SPEICHERWEGS — EIN SATZ, ZWEI WEGE.
                ==========================================================================

                DIESELBE BAUFORM WIE DER EINREICHWEG DARUNTER, und das ist Absicht: es ist dieselbe
                Tatsache („jemand war schneller") an einem anderen Vorgang. Ein zweites Aussehen für
                dieselbe Lage wäre eine zweite Auslegung.

                DER SATZ SITZT IN EINEM EIGENEN KNOTEN, damit er ohne die Knopfbeschriftungen
                messbar ist — sonst liesse sich „steht hier schon eine Zahl?" (§9) nicht von der
                Zeile darunter trennen.

                DRITTER WEG OHNE KNOPF: anpassen. Der Text steht unverändert im Formular darüber,
                der Mensch tippt einfach weiter. */}
            {/* ==========================================================================
                JOB 4163 · DIE ZWEI NEUEN LAGEN STEHEN IM SELBEN KNOTEN WIE DER KONFLIKT.
                ==========================================================================

                EIN ORT FÜR DIE EINE AUSKUNFT ÜBER DEN LETZTEN SPEICHERVERSUCH, unterschieden
                allein durch `data-lage` — ein zweiter Kasten daneben wäre eine zweite Mechanik
                für dieselbe Sache, und ein Prüfstand könnte „steht hier schon etwas?" nicht mehr
                an einer Stelle beantworten.

                KEINE KNÖPFE BEIM TEILABBRUCH. Der Griff, der nachholt, ist der Speicherknopf
                darunter — er steht schon da und trägt bereits die richtige Beschriftung. Ein
                zweiter Knopf mit derselben Wirkung wäre die zweite Aussage über dieselbe
                Tatsache. Beim entzogenen Recht steht gar kein Griff: es gibt keinen Weg, und
                einen anzubieten wäre die Scheinfunktion. */}
            {speicherLage ? (
              <div
                data-testid="bib-speichern-lage"
                data-lage={speicherLage.art}
                // JOB 4163 · EIN TON FÜR ALLE DREI LAGEN, und das ist eine Entscheidung, keine
                // Nachlässigkeit: alle drei sagen dieselbe Art von Sache — „etwas ist nicht
                // durchgekommen, deine Arbeit steht noch hier". Unterschieden werden sie durch
                // den SATZ, nicht durch die Farbe; eine zweite Farbe wäre eine zweite Auslegung
                // derselben Lage. Die Kette bleibt damit literal — der Klassenbindungs-Sammler
                // `tests/app/mega47-modale-flaechen-sammler.test.tsx` zählt sie nicht zu den
                // unauflösbaren Bindungen, und sein Pin (221) bleibt unberührt.
                className={cx(EINREICH_ZEILE, EINREICH_WARN)}
              >
                {speicherLage.art === "stale" ? (
                  <>
                    {/* JOB 4163 R2 · DER KONFLIKTSATZ KENNT ZWEI LAGEN. Ohne eigenen Teilabbruch
                        steht der Wortlaut aus JOB 4075 unverändert da. Liegt von dieser
                        Bearbeitung schon ein Stand am Server, wäre sein Halbsatz „gespeichert
                        wurde nichts" unwahr — dann tritt ein eigener Satz an seine Stelle, der
                        beides sagt: der fremde Schreiber UND der eigene frühere Stand. */}
                    {/* JOB 4251 · UND DER KONFLIKT AN DER EINORDNUNG BEKOMMT SEINEN EIGENEN SATZ,
                        nicht den über den Inhalt. Es ist GENAU EIN Satz, und er handelt von der
                        Einordnung: der Text ist in dieser Lage gespeichert, „gespeichert wurde
                        nichts" wäre die Unwahrheit. Eine Fassungszahl steht nicht darin — die
                        Einordnung hat keine (sie klettert bei ihr nicht).

                        RUNDE 2 · UND ER NENNT NUR, WAS WIRKLICH NICHT ANGEKOMMEN IST. Ein
                        Schlagwortaufruf, der vor dem Konflikt durchging, IST gespeichert; ihn
                        pauschal mitzuverlieren wäre die Unwahrheit, die BEN gemessen hat
                        (Korrekturpflicht 3). Welche Schritte offen sind, sagt die Buchführung des
                        Abbruchs — es wird nicht geraten.

                        KEINE TEILLOSE FASSUNG DANEBEN: die beiden Einordnungsaufrufe sind erst NACH
                        einem gelungenen `revise` erreichbar (s. `save`), der erste Halbsatz „dein
                        Text ist gespeichert" stimmt hier also immer. Ein Satz für eine Lage, die es
                        nicht gibt, wäre die Scheinfunktion. */}
                    <span data-testid="bib-speichern-satz">
                      {speicherLage.feld === "einordnung"
                        ? t(staleEinordnungSchluessel(speicherLage.offen))
                        : speicherLage.teilVorher
                          ? speicherLage.version === null
                            ? t("ko.revise.stalePartial")
                            : t("ko.revise.stalePartialVersion", {
                                n: String(speicherLage.version),
                              })
                          : speicherLage.version === null
                            ? t("ko.revise.stale")
                            : t("ko.revise.staleVersion", { n: String(speicherLage.version) })}
                    </span>
                    <span className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        data-testid="bib-speichern-neu-lesen"
                        onClick={() => {
                          void query.refetch();
                          setSpeicherLage(null);
                        }}
                        className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                      >
                        {t("ko.revise.reload")}
                      </button>
                      <button
                        type="button"
                        data-testid="bib-speichern-trotzdem"
                        disabled={save.isPending}
                        onClick={() =>
                          // Die Fassung, die JETZT im Bild steht — nicht die, auf der der
                          // gescheiterte Versuch beruhte. Sonst führte der Knopf zuverlässig in
                          // denselben 409.
                          //
                          // JOB 4163 R2 · `ueberschreiben` IST DIE AUSDRÜCKLICHE ENTSCHEIDUNG des
                          // Menschen, und nur sie hebt den Bezug auf die eigene Fassung auf: nach
                          // einem Teilabbruch schreibt der Speicherweg sonst gegen die Fassung,
                          // die sein eigener `revise` erzeugt hat, und liefe hier wieder in
                          // denselben 409 — ein Knopf, der zuverlässig nichts tut.
                          // JOB 4251: und der Stand der EINORDNUNG, der jetzt im Bild steht, reist
                          // genauso mit. Er hebt die Entscheidung nicht auf — er sorgt dafür, dass
                          // sie nicht einen ZWEITEN fremden Schreiber überfährt, der zwischen
                          // Meldung und Knopf dazugekommen ist.
                          save.mutate({
                            expectedVersion: ko.version,
                            einordnung: gesehenerEinordnungsstand(ko),
                            ueberschreiben: true,
                          })
                        }
                        className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                      >
                        {t("ko.revise.again")}
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <span data-testid="bib-speichern-satz">
                      {speicherLage.art === "teil"
                        ? t(teilSatzSchluessel(speicherLage.textAktuell, speicherLage.offen))
                        : t("ko.revise.forbidden")}
                    </span>
                    {/* DER HINWEIS SAGT NUR ETWAS ZU, WAS EINZULÖSEN IST. Ist das Recht mitten in
                        der Kette entzogen worden, hilft ein erneuter Griff nicht — dann steht der
                        Grund da statt der Aufforderung (BEN, Prüflücke 6). */}
                    {speicherLage.art === "teil" ? (
                      <span className="mt-1 block">
                        {speicherLage.rechtEntzogen
                          ? t("ko.revise.partialForbidden")
                          : t("ko.revise.partialAgain", { knopf: t("ko.saveEdit") })}
                      </span>
                    ) : null}
                    {speicherLage.meldung ? (
                      <span data-testid="bib-speichern-meldung" className="mt-1 block opacity-80">
                        {t("ko.revise.serverNote", { text: speicherLage.meldung })}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            {/* Der EINE Satz über den letzten Einreichversuch — samt der Griffe, die zu seiner Lage
                gehören. Er steht GETRENNT von `err` oben: „eingereicht" ist kein Fehler, und eine
                Sperre ist keine gescheiterte Eingabe. */}
            {einreichLage && einreichLage.art !== "pflicht" ? (
              <div
                data-testid="bib-einreichen-lage"
                data-lage={einreichLage.art}
                className={cx(
                  EINREICH_ZEILE,
                  einreichLage.art === "eingereicht"
                    ? EINREICH_GUT
                    : einreichLage.art === "stale"
                      ? EINREICH_WARN
                      : EINREICH_SCHLECHT,
                )}
              >
                {einreichLage.art === "eingereicht"
                  ? t("ko.propose.done")
                  : einreichLage.art === "stale"
                    ? einreichLage.version === null
                      ? t("ko.propose.stale")
                      : t("ko.propose.staleVersion", { n: String(einreichLage.version) })
                    : einreichLage.text}
                {/* LIEFERUNG 7: ein 409 verschluckt die Arbeit nicht. Der Text steht unverändert im
                    Formular darüber; hier stehen die beiden Wege, die der Mensch WÄHLEN kann —
                    nachlesen, oder auf der jetzt gültigen Fassung erneut einreichen. Anpassen
                    braucht keinen Knopf: er tippt einfach weiter. */}
                {einreichLage.art === "stale" ? (
                  <span className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      data-testid="bib-einreichen-neu-lesen"
                      onClick={() => {
                        void query.refetch();
                        setEinreichLage(null);
                      }}
                      className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                    >
                      {t("ko.propose.reload")}
                    </button>
                    <button
                      type="button"
                      data-testid="bib-einreichen-trotzdem"
                      disabled={einreichen.isPending}
                      onClick={() =>
                        einreichen.mutate({
                          // Die Fassung, die JETZT im Bild steht — nicht die, auf der der
                          // gescheiterte Versuch beruhte.
                          baseVersion: ko.version,
                          statement: edit.statement,
                          bodyHtml: edit.bodyHtml,
                          bestehenderRumpf: ko.bodyHtml ?? null,
                        })
                      }
                      className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                    >
                      {t("ko.propose.again")}
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex gap-2">
              {/* DER GRIFF WECHSELT MIT DEM WEG, UND ES GIBT IMMER GENAU EINEN.

                  Wo der Einreichweg gilt, wird „Speichern" NICHT angeboten: der Server würde ihn
                  abweisen (403 `PROPOSAL_REQUIRED`), und ein Knopf, der nur zu einer Absage führen
                  kann, ist eine Scheinfunktion. Umgekehrt steht „Einreichen" nicht daneben, wo direkt
                  gespeichert werden darf — sonst wäre die Pflicht aus Fall 2 eine Auswahl. */}
              {pruefwegAktiv ? (
                <Button
                  variant="primary"
                  data-testid="bib-einreichen"
                  disabled={
                    einreichen.isPending ||
                    appendDocument.isPending ||
                    appendUnclear ||
                    edit.statement.trim().length === 0
                  }
                  onClick={() =>
                    einreichen.mutate({
                      baseVersion: ko.version,
                      statement: edit.statement,
                      bodyHtml: edit.bodyHtml,
                      bestehenderRumpf: ko.bodyHtml ?? null,
                    })
                  }
                >
                  {t("ko.propose.submit")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={
                    save.isPending ||
                    appendDocument.isPending ||
                    appendUnclear ||
                    edit.title.trim().length === 0
                  }
                  // JOB 4075: die Fassung, die beim Öffnen des Formulars dastand — nicht die, die
                  // inzwischen geladen wurde. Genau daran erkennt der Dienst, ob jemand
                  // dazwischengekommen ist.
                  onClick={() =>
                    save.mutate({ expectedVersion: edit.version, einordnung: edit.einordnung })
                  }
                >
                  {t("ko.saveEdit")}
                </Button>
              )}
              <Button variant="ghost" onClick={bearbeitenBeenden}>
                {t("ko.cancelEdit")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* JOB 3362: die Kennzeichnung steht ÜBER dem Titel, den sie betrifft — mit dem
                Umschalter zurück zum Original. Derselbe Baustein wie auf `/wissen/:id` und in
                keiner zweiten Fassung. Ohne Variante steht hier nichts. */}
            {lesevariante ? (
              <LesevarianteHinweis
                variante={lesevariante}
                zeigtOriginal={zeigtOriginal}
                onUmschalten={() => setZeigtOriginal((v) => !v)}
              />
            ) : null}
            {/* Der Abruf ist gescheitert (Netz, Zugriff, Serverfehler). Dann steht das ORIGINAL da —
                und dass die Übersetzung fehlt, wird gesagt statt verschwiegen. „Es gibt keine
                Übersetzung" ist dieser Fall ausdrücklich NICHT (s. `useFrischeLesevariante`). */}
            {leselage.zustand === "fehlt" ? (
              <p
                data-testid="bib-lesevariante-fehler"
                className="text-[12.5px] text-trust-warn-text"
              >
                {t("lesevariante.abrufFehler")}
              </p>
            ) : null}
            {/* ==========================================================================
                JOB 3667 R3 · DER KREIS VON FALL 2 — DER BERECHTIGTE ENTSCHEIDET IM BROWSER.
                ==========================================================================

                ER STEHT NUR, WO ES ETWAS ZU ENTSCHEIDEN GIBT: ohne Freigaberecht und ohne offenen
                Vorschlag steht hier NICHTS. Kein „keine Vorschläge" — das wäre eine Auskunft über
                eine Liste, die manche Lesewege gar nicht mitschicken (s. `api/types.ts`).

                WAS ENTSCHIEDEN WIRD, IST DER EINGEREICHTE TEXT. Hier steht `v.statement` aus dem
                Vorschlag, und der Aufruf trägt NUR dessen Kennung — den Inhalt nimmt der Dienst aus
                dem gespeicherten Vorschlag. Was man liest, ist deshalb genau das, was gilt, wenn man
                übernimmt (Lieferung 8).

                AM EIGENEN VORSCHLAG STEHT KEIN KNOPF, sondern der Grund. Die Regel selbst hält der
                Server (`PROPOSAL_OWN`); diese Fläche bietet nur nichts an, was sicher abgewiesen
                würde. Ein ausgegrauter Knopf wäre die Scheinfunktion, ein fehlender ohne Satz ein
                stilles Verschwinden. */}
            {darfFreigeben && offeneVorschlaege.length > 0 ? (
              <section
                data-testid="bib-vorschlaege"
                className="rounded-card border border-hairline bg-hairline-soft/40 p-3"
              >
                <h3 className="text-[12.5px] font-semibold text-text">
                  {t("ko.propose.openTitle", { n: String(offeneVorschlaege.length) })}
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {offeneVorschlaege.map((v) => {
                    const eigen = Boolean(user?.id) && v.author === user?.id;
                    // Was die Übernahme mit dem Fließtext TUT — gerechnet, bevor ein Knopf steht.
                    const rumpf = rumpfLage(v, ko.bodyHtml);
                    // Und WELCHER Fließtext danach im Eintrag stünde. „bleibt" zeigt den jetzigen:
                    // er ist das Ergebnis der Übernahme, nicht bloss der Stand davor (Lieferung 2).
                    const rumpfErgebnis =
                      rumpf === "neu" || rumpf === "gleich"
                        ? (v.bodyHtml ?? "")
                        : rumpf === "bleibt"
                          ? (ko.bodyHtml ?? "")
                          : null;
                    return (
                      <li
                        key={v.id}
                        data-testid="bib-vorschlag"
                        data-vorschlag-id={v.id}
                        data-eigen={eigen ? "ja" : "nein"}
                        className="border-hairline border-t pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <p className="text-[11.5px] text-muted">
                          {nameOf(v.author)} ·{" "}
                          {t("ko.propose.fromVersion", { n: String(v.baseVersion) })}
                          {v.origin ? ` · ${v.origin}` : ""}
                        </p>
                        <p
                          data-testid="bib-vorschlag-text"
                          className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text"
                        >
                          {v.statement}
                        </p>
                        {/* DER FLIESSTEXT NACH DER ÜBERNAHME — DAS ZWEITE, WAS SIE SCHREIBT.

                            Er steht IMMER da, in jeder der fünf Lagen, und der Satz sagt die Folge
                            statt nur den Befund: „ersetzt den jetzigen", „gleicht dem jetzigen",
                            „der jetzige bleibt", „entfernt den jetzigen", „es gibt keinen". Ohne
                            diesen Block genehmigte der Knopf darunter etwas, das niemand gesehen hat.

                            GEZEIGT WIRD DAS ERGEBNIS, NICHT DER VORSCHLAG (R5, Lieferung 2): bei
                            „bleibt" bringt der Vorschlag keinen Rumpf mit, und der Eintrag behält
                            seinen — also steht genau dieser da. Vorschau und Übernahme sagen
                            denselben Satz, weil sie dieselbe Regel rechnen.

                            GEZEICHNET WIRD MIT `SanitizedHtml` — derselbe Baustein, der den
                            Fließtext des Eintrags zeichnet. Benannte Prüflücke: die Säuberung der
                            Fläche und die des Servers (`cleanBody`) sind zwei Verfahren; was der
                            Server behielte und diese Fläche verwirft, stünde hier nicht. */}
                        <div
                          data-testid="bib-vorschlag-rumpf"
                          data-rumpf={rumpf}
                          className="mt-1.5"
                        >
                          <p className="text-[11.5px] leading-relaxed text-muted">
                            {t(`ko.propose.body.${rumpf}`)}
                          </p>
                          {rumpfErgebnis === null ? null : (
                            <SanitizedHtml
                              html={rumpfErgebnis}
                              className="prose-kw mt-1 rounded-card border border-hairline bg-surface p-2 text-[12.5px]"
                            />
                          )}
                        </div>
                        {eigen ? (
                          <p
                            data-testid="bib-vorschlag-eigen"
                            className="mt-1.5 text-[11.5px] leading-relaxed text-muted"
                          >
                            {t("ko.propose.own")}
                          </p>
                        ) : ablehnung?.id === v.id ? (
                          // Die Ablehnung SCHREIBT IHREN GRUND. Ohne ihn wäre „abgelehnt" eine
                          // Tatsache ohne Auskunft — und der Einreicher erführe nie, warum.
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              data-testid="bib-vorschlag-grund"
                              value={ablehnung.grund}
                              onChange={(e) => setAblehnung({ id: v.id, grund: e.target.value })}
                              rows={2}
                              className={textareaCls}
                              placeholder={t("ko.propose.rejectReason")}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                data-testid="bib-vorschlag-ablehnen-ab"
                                disabled={
                                  entscheiden.isPending || ablehnung.grund.trim().length === 0
                                }
                                onClick={() =>
                                  entscheiden.mutate({
                                    proposalId: v.id,
                                    decision: "ablehnen",
                                    expectedVersion: ko.version,
                                    note: ablehnung.grund,
                                  })
                                }
                              >
                                {t("ko.propose.rejectConfirm")}
                              </Button>
                              <Button variant="ghost" onClick={() => setAblehnung(null)}>
                                {t("ko.cancelEdit")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex gap-2">
                            <Button
                              variant="primary"
                              data-testid="bib-vorschlag-uebernehmen"
                              disabled={entscheiden.isPending}
                              onClick={() =>
                                entscheiden.mutate({
                                  proposalId: v.id,
                                  decision: "uebernehmen",
                                  // Die Fassung, die dieser Mensch im Bild hat. Hat ein Fremder
                                  // dazwischen geschrieben, gilt die Freigabe nicht (409).
                                  expectedVersion: ko.version,
                                })
                              }
                            >
                              {t("ko.propose.take")}
                            </Button>
                            <Button
                              variant="ghost"
                              data-testid="bib-vorschlag-ablehnen"
                              disabled={entscheiden.isPending}
                              onClick={() => setAblehnung({ id: v.id, grund: "" })}
                            >
                              {t("ko.propose.reject")}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {/* JOB 3108 · UX-03 — DER KOPF SAGT, WO QUELLEN UND ANHÄNGE LIEGEN, UND FÜHRT HIN.
                Zwei echte `<button>`: damit wirken Tabulator, Eingabe- und Leertaste ohne
                `tabIndex`-Nachbau. Die Zahl steht IM Knopf, bei null die Leerfassung („keine") —
                der Knopf bleibt aktiv und führt in den Abschnitt mit dem ehrlichen Leersatz
                (`ko.sourcesEmpty` / `ko.attachmentsEmpty`). Kein Erklärsatz daneben: der
                Textmesser (`tests/design/zielbild-h4-kein-erklaertext.test.ts`) zieht Knopftexte
                ab, freien Text nicht.

                JOB 3474 · REVIEW26 — DIE REGEL „NUR ZAHLEN" IST PRÄZISIERT, NICHT AUFGEHOBEN.
                Sie lautete: „keine Quellentitel, keine Dateinamen". Der Prüferbefund hat gezeigt,
                wo sie zu weit ging: über eine Originaldatei, die IM Text hängt und in KEINER der
                beiden Mengen steht, sagte der Kopf mit „Anhänge · keine" etwas Falsches — und eine
                blosse Zahl hätte den Befund nicht behoben („eindeutig benennen"). Deshalb gilt
                jetzt: über Quellen und Anhänge stehen weiter NUR Zahlen (das hält
                tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx, Fall A8,
                unverändert fest), und daneben stehen — nur wenn es sie wirklich gibt — die Dateien
                mit Namen, die es sonst nirgends am Kopf gäbe. */}
            <div data-testid="bib-kopf-spruenge" className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="bib-sprung-quellen"
                aria-controls={mehrId}
                onClick={() => springeZu("quellen")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-[5px] text-[12px] font-semibold text-text hover:bg-hairline-soft"
              >
                <FileText size={13} aria-hidden className="text-muted" />
                {quellen.length > 0
                  ? t("lib.lesen.sprung.quellen", { count: quellen.length })
                  : t("lib.lesen.sprung.quellenLeer")}
              </button>
              {/* JOB 3474 · REVIEW26: die Originaldatei im Bericht — dieselbe Bauform, damit
                  Tabulator, Eingabe- und Leertaste ohne `tabIndex`-Nachbau wirken. Sie steht VOR
                  dem Anhangknopf (Variante A des Auftrags), weil sie die Aussage daneben
                  einschränkt. Ohne Datei-Referenz erscheint sie GAR NICHT — „Originaldatei · keine"
                  wäre über einen Eintrag ohne Dateiimport eine Aussage ohne Gegenstand. */}
              {originalDateien.length > 0 ? (
                <button
                  type="button"
                  data-testid="bib-sprung-originaldatei"
                  onClick={() => springeZurDatei(originalDateien[0]?.objectId ?? "")}
                  // Bei mehreren steht die Zahl im Knopf; der zugängliche Name UNTERSCHEIDET sie,
                  // damit ohne Sicht nicht nur „zwei Dateien" ankommt. Bei genau einer trägt der
                  // sichtbare Text den Namen schon — dann kein zweiter, abweichender Name.
                  {...(originalDateien.length > 1
                    ? {
                        "aria-label": t("lib.lesen.sprung.originaldateienNamen", {
                          count: originalDateien.length,
                          names: originalDateien.map((d) => d.name).join(", "),
                        }),
                      }
                    : {})}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-[5px] text-[12px] font-semibold text-text hover:bg-hairline-soft"
                >
                  <FileText size={13} aria-hidden className="text-muted" />
                  {originalDateien.length > 1
                    ? t("lib.lesen.sprung.originaldateien", { count: originalDateien.length })
                    : t("lib.lesen.sprung.originaldatei", { name: originalDateien[0]?.name ?? "" })}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="bib-sprung-anhaenge"
                aria-controls={mehrId}
                onClick={() => springeZu("anhaenge")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-[5px] text-[12px] font-semibold text-text hover:bg-hairline-soft"
              >
                <Paperclip size={13} aria-hidden className="text-muted" />
                {/* JOB 3474 · Lieferung 4: solange eine Originaldatei im Text hängt, steht hier
                    NICHT die unqualifizierte Leerfassung. Der Knopf spricht dann enger — über die
                    WEITEREN Anhänge — und behauptet nicht mehr, es gebe nichts. Eine Zahl braucht
                    diese Einschränkung nicht: sie ist keine Verneinung. */}
                {anhaenge.length > 0
                  ? t("lib.lesen.sprung.anhaenge", { count: anhaenge.length })
                  : originalDateien.length > 0
                    ? t("lib.lesen.sprung.anhaengeLeerNebenDatei")
                    : t("lib.lesen.sprung.anhaengeLeer")}
              </button>
            </div>
            <h1
              data-testid="bib-titel"
              data-bib-text="titel"
              className="text-[24px] font-[650] leading-[1.3] tracking-[-0.3px] text-text"
            >
              {gelesen ? gelesen.title : ko.title}
            </h1>
            {/* JOB 4145 · WIKI-ORIENTIERUNG — DIE GLIEDERUNG STEHT VOR DEM TEXT, DEN SIE ERSCHLIESST.

                SIE STEHT IM DOM VOR `bib-text`, damit sie in der Tabulatorreihenfolge VOR dem
                Fliesstext liegt: wer mit der Tastatur liest, erreicht die Sprungziele, bevor er
                mehrere Bildschirmhoehen durchlaufen hat.

                R5: GENAU DARAUS kam der Fehler des Torlaufs 23:05 — wer im Baum vorne steht, ist
                beim Einbau auch zuerst an der Reihe, und da war die `ref` des Fliesstextes noch
                leer. Das Bauteil bekommt deshalb den KNOTEN (`textKnoten`), den der Rueckruf
                `textKnotenSetzen` in einen Zustand legt; die Begruendung steht dort.

                R4: das Bauteil bekommt den HTML-String NICHT mehr. Es haengt an nichts als am
                Knoten und am Renderzyklus — der Grund steht im Kopf von `Lesegliederung`. */}
            <Lesegliederung
              flaeche={textKnoten}
              beschriftung={t("lib.lesen.gliederung.titel")}
              onSprung={springeZurUeberschrift}
            />
            <div
              ref={textKnotenSetzen}
              data-testid="bib-text"
              data-bib-text="text"
              className="text-[15.5px] leading-[1.7] text-text"
            >
              {/* JOB 3362: die übersetzte Lesart des FLIESSTEXTS. Die Bildergalerie darunter bleibt
                  dem Original vorbehalten: sie ist der Weg zum Bearbeiten der Bildunterschriften,
                  und bearbeitet wird immer das Original (ein Klick auf „Original anzeigen" führt
                  hin). Fehlt der übersetzte Fließtext, steht die übersetzte Kernaussage da —
                  dieselbe Reihenfolge wie beim Original. */}
              {gelesen ? (
                gelesen.bodyHtml ? (
                  <SanitizedHtml html={gelesen.bodyHtml} className="prose-kw" />
                ) : (
                  <p>{gelesen.statement}</p>
                )
              ) : ko.bodyHtml ? (
                <>
                  <SanitizedHtml html={ko.bodyHtml} className="prose-kw" />
                  <BodyImageGallery
                    bodyHtml={ko.bodyHtml}
                    onEditCaption={
                      canEdit
                        ? (imageId, src, index) => {
                            startEdit(ko);
                            setCaptionRequest((prev) => ({
                              imageId,
                              src,
                              index,
                              nonce: (prev?.nonce ?? 0) + 1,
                            }));
                          }
                        : undefined
                    }
                  />
                </>
              ) : (
                <p>{ko.statement}</p>
              )}
              {ko.conditions.length > 0 || ko.measures.length > 0 ? (
                <>
                  {ko.conditions.map((c) => (
                    <p key={`c-${c}`}>{c}</p>
                  ))}
                  {ko.measures.map((m) => (
                    <p key={`m-${m}`}>{m}</p>
                  ))}
                </>
              ) : null}
            </div>

            {/* Chips: Quellen und Bilder. Die Zahl steht vorn, wie in der Vorlage („1 · Titel"). */}
            <div
              data-testid="bib-chips"
              className="flex flex-wrap gap-2 border-t border-hairline pt-1.5"
            >
              {quellen.map((s, i) => (
                <span
                  key={s.id}
                  data-testid="bib-quellen-chip"
                  data-bib-text="quellenchip"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-page px-2.5 py-[5px]"
                >
                  <FileText size={13} aria-hidden className="text-muted" />
                  <span className="text-[12px] font-semibold text-text">{`${i + 1} · ${s.label}`}</span>
                </span>
              ))}
              {bilder > 0 ? (
                <span
                  data-testid="bib-bilder-chip"
                  data-bib-text="bilderchip"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-page px-2.5 py-[5px]"
                >
                  <ImageIcon size={13} aria-hidden className="text-muted" />
                  <span className="text-[12px] text-muted">
                    {t("lib.lesen.bilder", { count: bilder })}
                  </span>
                </span>
              ) : null}
            </div>

            {/* JOB 4155 (Lieferung 5): die GESETZTEN Fachbeziehungen — SOFORT sichtbar, oberhalb
                der Zeile „Mehr", im Maßstab der Lesespalte (720 px, 18 px Abstand über `space-y`
                der Hülle, s. Kopf dieser Datei). Der Bereich hängt am gelesenen Eintrag; sein
                Zustandsmodell steht an `Beziehungsbereich` oben. */}
            <Beziehungsbereich key={ko.id} koId={ko.id} />

            {/* Die EINE Zeile „Mehr" — dahinter die dreizehn Abschnitte, zugeklappt als Vorgabe. */}
            <div
              id={mehrId}
              className="rounded-card border border-hairline bg-surface px-4 shadow-tile"
            >
              <button
                type="button"
                data-testid="bib-mehr"
                aria-expanded={mehrOffen}
                onClick={mehrUmschalten}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-[13px] font-semibold text-text outline-none"
              >
                {t("lib.lesen.mehr")}
                <span aria-hidden className="text-[11px] text-muted-2">
                  {mehrOffen ? "▴" : "▾"}
                </span>
              </button>
              {mehrOffen ? (
                <div className="border-t border-hairline-soft">
                  <MehrAbschnitte ko={ko} sprungZiel={sprungZiel ?? undefined} />
                </div>
              ) : null}
            </div>

            {/* Auf Anforderung geöffnete Flächen: Pflicht-Feedback und Löschbestätigung. */}
            {detailFeedback ? (
              <div className="space-y-2 rounded-card border border-hairline bg-page p-4">
                <div className="text-[12.5px] font-semibold text-text">
                  {detailFeedback === "warn"
                    ? t("val.feedback.condTitle")
                    : t("val.feedback.rejTitle")}
                </div>
                <textarea
                  value={detailFeedbackText}
                  onChange={(e) => setDetailFeedbackText(e.target.value)}
                  placeholder={t("val.feedback.placeholder")}
                  rows={3}
                  className={textareaCls}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    disabled={detailReview.isPending}
                    onClick={() => {
                      setDetailFeedback(null);
                      setDetailFeedbackText("");
                    }}
                  >
                    {t("val.feedback.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={detailReview.isPending || !isFeedbackSubmittable(detailFeedbackText)}
                    onClick={() =>
                      detailReview.mutate({
                        verdict: detailFeedback,
                        text: detailFeedbackText,
                      })
                    }
                  >
                    {t("val.feedback.submit")}
                  </Button>
                </div>
              </div>
            ) : null}
            {err ? (
              <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                {err}
              </div>
            ) : null}
          </>
        )}
        {/* ============================================================================================
            JOB 3637 · DIE RÜCKFRAGE ZUM LÖSCHEN STEHT DA, WO GEKLICKT WURDE.
            ============================================================================================
            Pedis Befund (11.09.): „wissensprojekt loeschen geht nicht" — das Menü schliesst sich,
            sonst nichts. Gemessen (`tests/wissensobjekt-loeschen/rueckfrage-im-blick-mounted.test.tsx`)
            war es zweierlei, und BEIDES an DIESER Stelle:

              1. Die Rückfrage stand im Textfluss der Lesespalte, mit 2.614 Zeichen Text vor ihr —
                 auf einem langen Objekt mehrere Bildschirmhöhen unterhalb des Menüs. Gerendert
                 wurde sie also; gesehen hat sie niemand.
              2. Sie stand INNERHALB des Sonst-Zweigs von `edit ? … : …`, der Menükopf aber
                 ausserhalb. Im Bearbeiten-Modus erzeugte der Menüpunkt deshalb GAR NICHTS.

            Beides erledigt derselbe Umzug: die Rückfrage hängt jetzt an der Wurzel dieser Fläche —
            also in JEDER Lage, nicht nur im Lesemodus — und in der Overlay-Ebene der App
            (`components/Modal.tsx`: `fixed inset-0 z-50`, portiert in den Modalgrenzen-Anker).
            Kein zweiter Löschweg, keine neue Berechtigung: `darfLoeschen` entscheidet weiter
            allein über den Menüpunkt, und es gibt genau einen Aufruf von `endpoints.ko.remove`.

            `Modal` statt einer eigenen Overlay-Bauform, weil daran die eine Modalgrenze hängt
            (Esc, gesperrter Hintergrund, Fokus in die Fläche und beim Schliessen zurück auf den
            Auslöser). Eine zweite Mechanik daneben ist keine Doppelung, sondern eine stille
            Ablösung — die Begründung steht ausgeschrieben in `Modal.tsx:12-21`. */}
        <Modal
          open={loeschenOffenEffektiv}
          onClose={loeschenSchliessen}
          title={t("ko.deleteButton")}
          panelMarker="data-bib-loeschen"
        >
          {/* `aria-busy` trägt den laufenden Aufruf maschinenlesbar — zusammen mit den beiden
              gesperrten Knöpfen ist das der sichtbare Beleg, dass gerade etwas läuft. Ein
              AUSGESCHRIEBENER Satz („Wird gelöscht …") bräuchte einen neuen Katalogeintrag in
              `i18n.ts`, und die Datei steht nicht in den Zielpfaden dieser Runde; ein Text aus einer
              fremden Gattung („Lädt …", „Wird angehängt …") wäre geborgt und falsch. Die Lücke ist
              in der Rückgabe benannt, nicht verschwiegen. */}
          <div
            data-testid="bib-loeschen-rueckfrage"
            aria-busy={removeKo.isPending}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-text">
              {t("ko.deleteQ")}
            </span>
            <Button variant="ghost" disabled={removeKo.isPending} onClick={loeschenSchliessen}>
              {t("ko.deleteKeep")}
            </Button>
            <Button
              variant="danger"
              disabled={removeKo.isPending}
              onClick={() => removeKo.mutate()}
            >
              {t("ko.deleteYes")}
            </Button>
          </div>
          {/* Der Grund am Bedienort. Er steht NUR beim ECHTEN Fehlschlag (403, 500, ein Fehler
              ohne Antwort) und behauptet nichts darüber hinaus: gescheitert ist das Löschen, der
              Eintrag ist unverändert da, die Rückfrage bleibt offen. Keine Ersatzmeldung, wenn der
              Server keine mitgibt — dann der allgemeine Satz aus dem Katalog.
              JOB 3777 · DER 404 GEHÖRT NICHT MEHR HIERHER: dort ist der Eintrag gerade NICHT
              unverändert da, er ist weg. Dieser Fall verlässt die Fläche oben über den
              `onError`-Zweig von `removeKo` — Rückfrage zu, Meldung `ko.deleteAlreadyGone`. */}
          {loeschFehler ? (
            <p
              data-testid="bib-loeschen-fehler"
              className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            >
              {loeschFehler}
            </p>
          ) : null}
        </Modal>
      </div>
    </ImageDescribeProvider>
  );
}
