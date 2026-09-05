import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { type KoAction, endpoints } from "../../api/endpoints";
import { useAudit, useConflicts, useEigeneBefunde, useKo, useKos } from "../../api/hooks";
import type { ExtractedPoint, KnowledgeObject, KnowledgeType } from "../../api/types";
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
import { editorFilesFromAttachments } from "../../lib/bodyFileLink";
import type { OriginalDocument, OriginalRefCache } from "../../lib/captureAttachments";
import { fileSourcePayload } from "../../lib/captureFromFile";
import {
  CONF_TONE_CLASS,
  abfrageMitBestand,
  vertraulichkeitsAuskunft,
} from "../../lib/confidentiality";
import { conflictImpact, conflictNotice } from "../../lib/conflictImpact";
import { anzeigestatusAnker, anzeigestatusAus } from "../../lib/displayStatus";
import { studioSaveConfidence } from "../../lib/editorApplySafety";
import { EDITOR_BLOCKS } from "../../lib/editorBlocks";
import { eigeneKollisionDetail } from "../../lib/eigeneKollision";
import { formatKoTimestamp } from "../../lib/koDates";
import type { MatchField } from "../../lib/librarySearch";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { draftProvenance } from "../../lib/reasonerProvenance";
import { canRevalidate } from "../../lib/revalidation";
import {
  isReviewReworkContext,
  reworkNextSteps,
  reworkValidationHref,
} from "../../lib/reviewReworkContext";
import { useAuthorName } from "../../lib/useAuthorName";
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
import { RichTextEditor } from "../RichTextEditor";
import { RoleLink } from "../RoleLink";
import { SanitizedHtml } from "../SanitizedHtml";
import { ListEditor, TagEditor } from "../editors";
import { KNOWLEDGE_TYPES } from "../trust";
import { Button, Field, TextInput, cx } from "../ui";
import { AuffrischungHinweis } from "./AuffrischungHinweis";
import { MehrAbschnitte } from "./MehrAbschnitte";
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
}

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

export function BibliothekLesen({
  koId,
  suchtext,
  treffer,
  onGeloescht,
  hinweisSchonGesagt,
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
  const { role } = useRole();
  const { user } = useSession();
  const { push } = useToast();
  const qc = useQueryClient();
  const nameOf = useAuthorName();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  const reviewReworkContext = isReviewReworkContext(params);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioApplied, setStudioApplied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mehrOffen, setMehrOffen] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [reworkSavedFor, setReworkSavedFor] = useState<string | null>(null);
  const reworkSaved = reviewReworkContext && reworkSavedFor === koId;
  const [detailFeedback, setDetailFeedback] = useState<FeedbackVerdict | null>(null);
  const [detailFeedbackText, setDetailFeedbackText] = useState("");
  const [appendUnclear, setAppendUnclear] = useState(false);
  const appendOriginalRef = useRef<OriginalRefCache>({ ref: null });
  const [captionRequest, setCaptionRequest] = useState<{
    imageId: string;
    src: string;
    index: number;
    nonce: number;
  } | null>(null);
  // SCRUM-417: der Deep-Link `?edit=1` öffnet den Bearbeiten-Modus genau EINMAL je Eintrag.
  const autoEditDone = useRef(false);

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
  const removeKo = useMutation({
    mutationFn: () => endpoints.ko.remove(koId),
    onSuccess: () => {
      setLoeschenOffen(false);
      invalidate();
      push("success", t("ko.deleteDone"));
      onGeloescht();
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!edit) {
        throw new Error("no edit");
      }
      await endpoints.ko.act(koId, {
        action: "revise",
        changes: {
          title: edit.title,
          statement: edit.statement,
          bodyHtml: edit.bodyHtml,
          type: edit.type,
          conditions: edit.conditions.filter((x) => x.trim()),
          measures: edit.measures.filter((x) => x.trim()),
        },
      });
      await endpoints.ko.act(koId, { action: "tags", tags: edit.tags.filter((x) => x.trim()) });
      if (edit.category.trim()) {
        await endpoints.ko.act(koId, { action: "category", category: edit.category.trim() });
      }
    },
    onSuccess: () => {
      invalidate();
      setEdit(null);
      setErr(null);
      if (reviewReworkContext) {
        setReworkSavedFor(koId);
      }
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

  const startEdit = (ko: KnowledgeObject): void => {
    setErr(null);
    setCaptionRequest(null);
    setEdit({
      title: ko.title,
      statement: ko.statement,
      bodyHtml: ko.bodyHtml ?? "",
      type: ko.type,
      category: ko.category,
      conditions: [...ko.conditions],
      measures: [...ko.measures],
      tags: [...ko.tags],
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
  const kollision = eigeneKollisionDetail({
    koId: ko.id,
    befunde: eigeneBefunde,
    konflikte: conflicts,
    kos: koListe,
  });
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
  const bilder = (ko.attachments ?? []).filter((a) => a.mime.startsWith("image/")).length;
  const quellen = ko.sources ?? [];
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
            <Field label={t("capture.fTitle")}>
              <TextInput
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
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
            {err ? (
              <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                {err}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={
                  save.isPending ||
                  appendDocument.isPending ||
                  appendUnclear ||
                  edit.title.trim().length === 0
                }
                onClick={() => save.mutate()}
              >
                {t("ko.saveEdit")}
              </Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                {t("ko.cancelEdit")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1
              data-testid="bib-titel"
              data-bib-text="titel"
              className="text-[24px] font-[650] leading-[1.3] tracking-[-0.3px] text-text"
            >
              {ko.title}
            </h1>
            <div
              data-testid="bib-text"
              data-bib-text="text"
              className="text-[15.5px] leading-[1.7] text-text"
            >
              {ko.bodyHtml ? (
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

            {/* Die EINE Zeile „Mehr" — dahinter die dreizehn Abschnitte, zugeklappt als Vorgabe. */}
            <div className="rounded-card border border-hairline bg-surface px-4 shadow-tile">
              <button
                type="button"
                data-testid="bib-mehr"
                aria-expanded={mehrOffen}
                onClick={() => setMehrOffen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-[13px] font-semibold text-text outline-none"
              >
                {t("lib.lesen.mehr")}
                <span aria-hidden className="text-[11px] text-muted-2">
                  {mehrOffen ? "▴" : "▾"}
                </span>
              </button>
              {mehrOffen ? (
                <div className="border-t border-hairline-soft">
                  <MehrAbschnitte ko={ko} />
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
            {loeschenOffen ? (
              <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page p-4">
                <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-text">
                  {t("ko.deleteQ")}
                </span>
                <Button variant="ghost" onClick={() => setLoeschenOffen(false)}>
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
            ) : null}
            {err ? (
              <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                {err}
              </div>
            ) : null}
          </>
        )}
      </div>
    </ImageDescribeProvider>
  );
}
