import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Paperclip, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import {
  useAudit,
  useConflicts,
  useDirectory,
  useExternalPolicy,
  useKoEvidence,
  useKoNeighbors,
  useKoVersions,
  useKos,
  useLifecyclePending,
} from "../../api/hooks";
import type {
  Confidentiality,
  ConflictType,
  ExternalResult,
  KnowledgeObject,
} from "../../api/types";
import { useRole } from "../../app/RoleContext";
import { useToast } from "../../app/ToastContext";
import { auditActionLabel } from "../../lib/auditAction";
import { objectRawHref } from "../../lib/bodyFileLink";
import {
  CONFIDENTIALITY_LEVELS,
  abfrageMitBestand,
  confidentialityOf,
} from "../../lib/confidentiality";
import { conflictImpact, conflictLimitedUsability } from "../../lib/conflictImpact";
import { isDemoKnowledge } from "../../lib/demoKnowledge";
import { deriveStatus } from "../../lib/displayStatus";
import { groupEvidenceByVersion } from "../../lib/evidenceByVersion";
import { analyzeEvidenceConsistency } from "../../lib/evidenceConsistency";
import { analyzeEvidenceFreshness } from "../../lib/evidenceFreshness";
import { evidenceFreshnessLabelKey } from "../../lib/evidenceFreshnessView";
import { validityProtectionView } from "../../lib/extConcept";
import {
  SOURCE_ATTACH_HINT_KEYS,
  canAttachExternalResult,
  canSearchExternal,
  sourceAttachCertainlyDenied,
  sourceAttachHint,
} from "../../lib/externalAttachGate";
import { containsExternalUnchecked } from "../../lib/externalProvenance";
import { toSourcePayload as externalToSourcePayload } from "../../lib/externalSearch";
import { fileToThumbDataUrl, readFileAsDataUrl } from "../../lib/files";
import { belegOriginal, evidenceRows } from "../../lib/koEvidence";
import { koHistoryNote } from "../../lib/koHistoryNote";
import { koAuditEvents, lineageSummary } from "../../lib/koLineage";
import { koOverview } from "../../lib/koOverview";
import {
  EMPTY_SOURCE_FORM,
  type SourceFormInput,
  isSourceFormValid,
  sourceBadgeKey,
  toAddSourceRequest,
  toSourcePayload,
} from "../../lib/koSource";
import { diffForVersion } from "../../lib/koVersionDiff";
import { koVersionRows } from "../../lib/koVersionSnapshots";
import {
  type SourceContributionInput,
  formatSourceComment,
  isSourceContributionValid,
} from "../../lib/sourceContribution";
import { trustExplainer } from "../../lib/trustExplainer";
import { useAuthorName } from "../../lib/useAuthorName";
import { useReadiness } from "../../lib/useReadiness";
import { AiCheckCoverageNotes } from "../AiCheckCoverageHint";
import { ConflictTargetPicker } from "../ConflictTargetPicker";
import { ExternalUrlText } from "../ExternalUrlText";
import { KnowledgeNeighborhood } from "../KnowledgeNeighborhood";
import { RoleLink } from "../RoleLink";
import { SanitizedHtml } from "../SanitizedHtml";
import { UploadLimitsHint } from "../UploadLimitsHint";
import { ConfidenceBar, KnowledgeTypeTag, ProvenanceLine } from "../trust";
import { Button, Field, TextInput, cx } from "../ui";
import { AuffrischungHinweis } from "./AuffrischungHinweis";

// ==================================================================================================
// JOB 3063 · H4 — „MEHR": DIE DREIZEHN ABSCHNITTE, ZUGEKLAPPT ALS VORGABE.
// ==================================================================================================
//
// Bis zu diesem Auftrag war jeder dieser dreizehn Abschnitte eine eigene `<Card>` auf der
// Detailseite — dreizehn Karten mit Einleitungssätzen und vier Hilfe-Tipps, 3.082 Zeichen sichtbarer
// Text an einem frisch erfassten Objekt (gemessen 04.09. in Chromium). Pedis Urteil dazu: „Text über
// Text über Text."
//
// JETZT: EINE Zeile „Mehr", darunter dreizehn schlichte Zeilen mit Titel. KEINE Hilfe-Tipps, KEINE
// Einleitungssätze — die FUNKTIONEN darin sind unverändert (Quelle anlegen, extern suchen und
// anhängen, Beitrag melden, Vertraulichkeit ändern, Autor übertragen, Anlage koppeln, kommentieren,
// Anhang hochladen, Konflikt melden, Nachbarschaft erkunden).
//
// DIESE KOMPONENTE WIRD ERST BEIM AUFKLAPPEN GEMOUNTET (s. `BibliothekLesen`). Damit laufen ihre
// zehn Abfragen (Belege, Fassungen, Audit, Nachbarschaft, Kopplungen, Verzeichnis, …) nur dann, wenn
// jemand sie sehen will — auf der Lesefläche selbst kostet „Mehr" nichts.

// ==================================================================================================
// JOB 3108 · UX-03 — DER AUF/ZU-ZUSTAND WOHNT AB JETZT IN DER MUTTER, NICHT IN JEDER ZEILE.
// ==================================================================================================
//
// Bis zu diesem Auftrag hielt `Abschnitt` sein `offen` in einem EIGENEN `useState`. Damit gab es
// keinen Weg, einen bestimmten Abschnitt von außen zu öffnen — der Sprung vom Berichtskopf
// (`BibliothekLesen`, `bib-kopf-spruenge`) scheiterte nicht an einem fehlenden Link, sondern an
// dieser gekapselten Zustandshaltung. Jetzt trägt `MehrAbschnitte` EINE Menge der offenen
// Schlüssel, und `Abschnitt` ist gesteuert. Das lokale `useState` ist ERSETZT und nicht daneben
// belassen: zwei Quellen für denselben Auf/Zu-Zustand wären genau die Drift, gegen die dieses Haus
// mehrfach angetreten ist.

/**
 * Wohin gesprungen werden soll. `nonce`, damit derselbe Abschnitt zweimal anspringbar bleibt.
 *
 * JOB 3272 · UX-25: dazu kommt OPTIONAL, WELCHES Element im Abschnitt den Fokus bekommt
 * (`data-bib-anhang`). Ohne diese Angabe bleibt es beim Verhalten des Kopfzugangs (UX-03): der
 * Fokus landet auf dem `<summary>` des Abschnitts. Der Sprung selbst ist derselbe — es gibt keinen
 * zweiten Sprungweg.
 */
export interface Sprungziel {
  schluessel: string;
  nonce: number;
  anhangId?: string;
}

/**
 * Eine der dreizehn Zeilen. Der Inhalt wird ERST BEIM AUFKLAPPEN gezeichnet (`offen`), nicht nur
 * versteckt: ein `<details>` rendert seine Kinder auch zugeklappt, und dann liefe hinter jeder
 * zugeklappten Zeile ihre Arbeit weiter — Bilder, Nachbarschaftszeichnung, Listen. Zugeklappt steht
 * hier deshalb wirklich nur der Titel.
 *
 * GESTEUERT (JOB 3108): `offen` kommt von außen, `aufWechsel` meldet jedes Auf- und Zuklappen
 * zurück. Am Verhalten der Zeile ändert das nichts — nur daran, WO ihr Zustand liegt.
 */
function Abschnitt({
  schluessel,
  titel,
  offen,
  aufWechsel,
  children,
}: {
  schluessel: string;
  titel: string;
  offen: boolean;
  aufWechsel: (offen: boolean) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <details
      data-bib-abschnitt={schluessel}
      open={offen}
      onToggle={(e) => aufWechsel((e.currentTarget as HTMLDetailsElement).open)}
      className="border-b border-hairline-soft last:border-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-[13px] text-muted">
        <span>{titel}</span>
        <span aria-hidden className="text-[11px] text-muted-2">
          ›
        </span>
      </summary>
      {offen ? <div className="pb-4 text-[12.5px] text-text">{children}</div> : null}
    </details>
  );
}

// UX-24: Ein Ladefehler gehört zur konkreten Vorschau. Der key am Aufrufer setzt den
// Fehlerzustand zurück, sobald eine andere Vorschau geliefert wird.
function AnhangVorschau({ src }: { src: string | undefined }): JSX.Element {
  const { t } = useTranslation();
  const [fehlgeschlagen, setFehlgeschlagen] = useState(false);
  return (
    <span className="flex min-h-20 items-center justify-center rounded-card border border-hairline bg-page p-2">
      {src && !fehlgeschlagen ? (
        <img
          src={src}
          alt=""
          onError={() => setFehlgeschlagen(true)}
          className="h-auto max-h-48 w-full object-contain"
        />
      ) : (
        <span className="text-center text-[12px] text-muted">
          {t("ko.attachmentPreviewUnavailable")}
        </span>
      )}
    </span>
  );
}

// ==================================================================================================
// JOB 3430 · Q1c — EIN ABSCHNITT HOLT SEINEN STAND SELBST NACH.
// ==================================================================================================
//
// DER BEFUND (Codex, 05.09. gegen 1.0.0-beta.1.102, `R-1613-20260905T193615162865`): an frische
// Fassungen und Belege kam der Leser NUR über „Mehr zuklappen und wieder aufklappen" — erst das
// Abmelden des letzten Beobachters und das erneute Montieren lösten einen Abruf aus. Ein Weg, der
// verlangt, die halbe Seite wegzuklappen, ist keiner.
//
// `invalidate()` (`:283-289`) ist dafür ausdrücklich NICHT der Weg: sie hängt an den SCHREIBaktionen,
// wirft fünf fremde Schlüssel zugleich weg (`ko`, `validation`, `kos`, `library`, `conflicts`) und
// trifft genau diese beiden Abfragen nicht einmal.
//
// DAS MITTEL BRINGT DIE ABFRAGE SCHON MIT: `refetch()` ihres eigenen `useQuery`. Damit ist die
// Reichweite von selbst genau ein Abschnitt — kein zweiter Schlüssel, keine zweite Datenquelle,
// keine neue Route. `cancelRefetch: false` wie beim Wiederholknopf der Fläche
// (`BibliothekFlaeche.tsx`, `alleAuffrischen`): ein bereits laufender Abruf wird nicht abgebrochen
// und neu gestartet, sein Ergebnis kommt an (Lehre JOB 3088 R2, Fall E).
//
// KEINE NEUEN WÖRTER: der Knopf trägt den Bestandstext `lib.liste.erneut`, der Ladezustand
// `state.loading`. Der zugängliche Name nennt zusätzlich den Abschnitt — sonst hießen zwei Wege auf
// derselben Fläche für ein Vorleseprogramm gleich (Muster `:1417`).
//
// EINE BAUFORM, ZWEI AUFRUFER: stünde derselbe Knopf zweimal als Literal da, würden aus einer
// Aussage über kurz oder lang zwei — dieselbe Begründung, mit der `AuffrischungHinweis`
// (JOB 3063 R6) den Satz daneben aus zwei Flächen in eine Bauform geholt hat.
function AbschnittNachladen<T>({
  abschnitt,
  bezeichnung,
  query,
}: {
  abschnitt: string;
  bezeichnung: string;
  query: UseQueryResult<T>;
}): JSX.Element {
  const { t } = useTranslation();
  // WÄHREND ein Abruf läuft, ist der Weg beschäftigt und nicht auslösbar: das ist der sichtbare
  // Ladezustand UND der Schutz vor dem zweiten Ruf auf denselben Abschnitt. Ein Abruf entsteht hier
  // ausschließlich durch den Klick — kein Intervall, kein Effekt, keine Schleife.
  const laeuft = query.isFetching;
  return (
    <button
      type="button"
      data-bib-nachladen={abschnitt}
      disabled={laeuft}
      aria-busy={laeuft}
      aria-label={`${t("lib.liste.erneut")} — ${bezeichnung}`}
      onClick={() => {
        void query.refetch({ cancelRefetch: false });
      }}
      className="mb-3 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft disabled:cursor-default disabled:text-muted-2"
    >
      {laeuft ? t("state.loading") : t("lib.liste.erneut")}
    </button>
  );
}

/**
 * Einen Schlüssel in einer Menge setzen oder entfernen — und die ALTE Menge zurückgeben, wenn sich
 * nichts ändert (React zeichnet dann nicht neu).
 *
 * JOB 3475 · UX-28: diese Regel stand als Rumpf in `abschnittUmschalten`. Seit die Fassungskarten
 * dieselbe Frage stellen („welche sind offen?"), wäre sie zweimal dagestanden — und aus einer Regel
 * würden über kurz oder lang zwei. Ein Bauteil ist das nicht (kleingeschrieben, gibt kein JSX
 * zurück): es ist die eine Mengenregel dieser Fläche.
 */
function mengeMitSchluessel(
  vorher: ReadonlySet<string>,
  schluessel: string,
  drin: boolean,
): ReadonlySet<string> {
  if (vorher.has(schluessel) === drin) {
    return vorher;
  }
  const naechste = new Set(vorher);
  if (drin) {
    naechste.add(schluessel);
  } else {
    naechste.delete(schluessel);
  }
  return naechste;
}

const CONFLICT_TYPES: readonly ConflictType[] = [
  "truth",
  "experience",
  "context",
  "temporal",
  "role",
];

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

export function MehrAbschnitte({
  ko,
  sprungZiel,
}: { ko: KnowledgeObject; sprungZiel?: Sprungziel | undefined }): JSX.Element {
  const { t, i18n } = useTranslation();
  const id = ko.id;
  const { role } = useRole();
  const { push } = useToast();
  const qc = useQueryClient();
  const nameOf = useAuthorName();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  const canTransfer = role === "admin";

  const evidence = useKoEvidence(id);
  const versions = useKoVersions(id);
  const audit = useAudit();
  const neighborhood = useKoNeighbors(id);
  const koList = useKos();
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const dir = useDirectory();
  const extPolicy = useExternalPolicy();
  const extStage = extPolicy.data?.stage ?? null;
  const extAttachAllowed = canAttachExternalResult(extStage);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", id] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["library"] });
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
  };
  const fehlerToast = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  // ---- Quellen ---------------------------------------------------------------------------------
  const [sourceForm, setSourceForm] = useState<SourceFormInput>({ ...EMPTY_SOURCE_FORM });
  // ================================================================================================
  // JOB 3133 · UX-22 — DER HINWEIS VERSPRACH EINEN WEG, DEN DAS FORMULAR NICHT ANBOT.
  // ================================================================================================
  //
  // Auf `blocked`/`search_on_click` sagt der Grund unter dem Formular: eine Quelle ohne Adresse
  // wird nur als BELEGSTELLE aus einem an diesem Objekt hinterlegten Dokument angenommen. Der
  // Server kann das (ko-routes.ts:1926-1930 schlägt den Anker in der eigenen Anhangsliste nach) —
  // das Formular konnte es nicht: es kannte nur Bezeichnung, Adresse, Auszug.
  //
  // ANKERFÄHIG ist nur ein Anhang MIT `objectId` (SCRUM-121, api/types.ts:70-80). Ein alter
  // Inline-Anhang (nur `dataUrl`) liegt zwar am Objekt, aber die Route fände ihn nicht — er darf
  // deshalb gar nicht zur Wahl stehen. Die Liste kommt aus dem BEREITS GELADENEN Objekt; es
  // entsteht keine zweite Abfrage und offline bleibt das Feld bedienbar.
  const ankerAnhaenge = (ko.attachments ?? []).filter((a) => (a.objectId ?? "").trim().length > 0);
  const sourceAnker = (sourceForm.objectId ?? "").trim();
  // Der Anker gilt NUR, wenn er auf einen Anhang zeigt, den dieses Objekt wirklich trägt — genau
  // die Frage, die der Server stellt. Eine großzügigere Vorhersage nähme er gleich darauf zurück.
  const sourceAnkerGueltig =
    sourceAnker.length > 0 && ankerAnhaenge.some((a) => a.objectId === sourceAnker);
  const sourceGateHint = sourceAttachHint(extStage, sourceForm.url, sourceAnkerGueltig);
  // RUNDE 4 (Codex R3): der GRUND wird bei jedem Hinweis gezeigt, die SPERRE nur dort, wo die
  // Oberfläche das Urteil des Servers sicher vorhersagt — `sourceAttachCertainlyDenied` begründet,
  // warum das genau der adresslose Fall ohne Anker ist und warum eine http(s)-Adresse es nicht ist
  // (der Client kennt die Origin-Allowlist des Betreibers nicht und würde sonst interne Quellen
  // sperren, die der Server annimmt). Zwei Anzeigen, EIN Urteil: beide hängen an `sourceGateHint`.
  const sourceGateSperre = sourceAttachCertainlyDenied(sourceGateHint);
  // Der sichtbare Grund braucht eine Kennung, damit der gesperrte Knopf mit `aria-describedby`
  // darauf zeigen kann: ein abgewiesener Knopf ohne verbundenen Grund ist eine Sackgasse, keine
  // Erklärung (externalAttachGate.ts:9-12).
  const sourceGateHintId = useId();
  const addSource = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "add-source", source: toSourcePayload(sourceForm) }),
    onSuccess: () => {
      invalidate();
      setSourceForm({ ...EMPTY_SOURCE_FORM });
      push("success", t("ko.sourceAdded"));
    },
    onError: fehlerToast,
  });
  const removeSource = useMutation({
    mutationFn: (sourceId: string) => endpoints.ko.act(id, { action: "remove-source", sourceId }),
    onSuccess: invalidate,
    onError: fehlerToast,
  });

  // ---- Externes Wissen -------------------------------------------------------------------------
  const [extQuery, setExtQuery] = useState("");
  const [extResults, setExtResults] = useState<ExternalResult[]>([]);
  const extSearch = useMutation({
    mutationFn: (q: string) => endpoints.external.search(q),
    onSuccess: (results) => setExtResults(results),
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("ext.unavailable")),
  });
  const attachExternal = useMutation({
    mutationFn: (result: ExternalResult) =>
      endpoints.ko.act(id, {
        action: "add-source",
        source: toAddSourceRequest(externalToSourcePayload(result)),
      }),
    onSuccess: () => {
      invalidate();
      push("success", t("ko.sourceAdded"));
    },
    onError: fehlerToast,
  });

  // ---- Quelle/Beitrag melden -------------------------------------------------------------------
  const [source, setSource] = useState<SourceContributionInput>({ contribution: "", source: "" });
  const sourceContribution = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "comment", text: formatSourceComment(source) }),
    onSuccess: () => {
      invalidate();
      setSource({ contribution: "", source: "" });
      push("success", t("ko.sourceSaved"));
    },
    onError: fehlerToast,
  });

  // ---- Provenienz: Stufe ändern, Autor übertragen ----------------------------------------------
  const act = useMutation({
    mutationFn: (body: Parameters<typeof endpoints.ko.act>[1]) => endpoints.ko.act(id, body),
    onSuccess: invalidate,
    onError: fehlerToast,
  });
  const [newAuthor, setNewAuthor] = useState("");
  const transfer = useMutation({
    mutationFn: (next: string) =>
      endpoints.ko.act(id, { action: "transfer-author", newAuthor: next }),
    onSuccess: () => {
      invalidate();
      setNewAuthor("");
      push("success", t("ko.transferDone"));
    },
    onError: fehlerToast,
  });

  // ---- Kopplung --------------------------------------------------------------------------------
  const [coupleAsset, setCoupleAsset] = useState("");
  const couplings = useQuery({
    queryKey: ["couplings", id],
    queryFn: () => endpoints.lifecycle.couplingsFor(id),
  });
  const couple = useMutation({
    mutationFn: (assetRef: string) => endpoints.lifecycle.couple(assetRef, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["couplings", id] });
      setCoupleAsset("");
      push("success", t("ko.couple.done"));
    },
    onError: fehlerToast,
  });

  // ---- Kommentare ------------------------------------------------------------------------------
  const [commentText, setCommentText] = useState("");
  const comment = useMutation({
    mutationFn: () => endpoints.ko.act(id, { action: "comment", text: commentText.trim() }),
    onSuccess: () => {
      invalidate();
      setCommentText("");
    },
    onError: fehlerToast,
  });

  // ---- Anhänge ---------------------------------------------------------------------------------
  const attach = useMutation({
    mutationFn: async (input: {
      name: string;
      mime: string;
      thumbnail: string;
      original: string;
    }) => {
      const ref = await endpoints.objects.upload({
        name: input.name,
        mime: input.mime,
        data: input.original,
        kind: "image",
        purpose: "attachment",
      });
      return endpoints.ko.act(id, {
        action: "attach",
        attachment: {
          name: input.name,
          mime: input.mime,
          objectId: ref.id,
          thumbnail: input.thumbnail,
          size: ref.size,
        },
      });
    },
    onSuccess: invalidate,
    onError: fehlerToast,
  });
  const detach = useMutation({
    mutationFn: (attachmentId: string) => endpoints.ko.act(id, { action: "detach", attachmentId }),
    onSuccess: invalidate,
    onError: fehlerToast,
  });
  const onPickFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const [thumbnail, original] = await Promise.all([
        fileToThumbDataUrl(file),
        readFileAsDataUrl(file),
      ]);
      attach.mutate({ name: file.name, mime: file.type || "image/jpeg", thumbnail, original });
    } catch {
      push("error", t("state.error"));
    }
  };
  // ================================================================================================
  // JOB 3126 · UX-23 — DER AUSLÖSER „FOTO ANHÄNGEN" IST EIN KNOPF, KEIN SCHILD.
  // ================================================================================================
  //
  // BEFUND (Live 1.124, gemessen 06.09. in Chromium, `16-upload-tastatur.json:4`): der sichtbare
  // Auslöser war ein `<label>` (`tabIndex: -1`, `role: null`), das ein `display:none`-Dateifeld
  // umschloss. Ein `<label>` ist nicht fokussierbar, ein `display:none`-Feld liegt nicht in der
  // Tab-Folge — die gemessene Tab-Kette sprang von „Anhang entfernen" direkt zu „Nachbarschaft".
  // Es gab damit KEINEN Tastaturweg zu dieser Aktion; nur die Maus kam hin.
  //
  // JETZT: ein echter `<button>` mit denselben sichtbaren Bestandteilen, der den Dateidialog über
  // diese Referenz öffnet. Enter und Leertaste leistet der Knopf von selbst (native Aktivierung,
  // keine eigene Tastenbehandlung nötig), den sichtbaren Fokus bringt die globale Regel
  // `*:focus-visible` mit (Scheibe D-024, `index.css:58`).
  //
  // DAS DATEIFELD BLEIBT, VERLIERT ABER SEINE BEDIENROLLE (`tabIndex={-1}`, `aria-hidden`): es ist
  // das technische Mittel, nicht ein zweiter, unsichtbarer Weg zur selben Aktion.
  const dateiFeld = useRef<HTMLInputElement | null>(null);
  const openAttachment = (a: { dataUrl?: string; objectId?: string }): void => {
    const href = objectRawHref(a.objectId) || a.dataUrl;
    if (href) {
      window.open(href, "_blank", "noopener");
    }
  };

  // ---- Konflikt melden -------------------------------------------------------------------------
  const [conflict, setConflict] = useState({ koB: "", type: "truth" as ConflictType, desc: "" });
  const [pickOpen, setPickOpen] = useState(false);
  const conflictTitle = (koList.data ?? []).find((k) => k.id === conflict.koB)?.title ?? "";
  const report = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, {
        action: "conflict",
        conflict: {
          koA: id,
          koB: conflict.koB,
          type: conflict.type,
          description: conflict.desc,
        },
      }),
    onSuccess: () => {
      invalidate();
      setConflict({ koB: "", type: "truth", desc: "" });
    },
    onError: fehlerToast,
  });

  // A27 · JOB 3025 · JOB 3068 (N5): DIE AUSKUNFT AN DIE VERFASSERIN STEHT NICHT MEHR HIER.
  //
  // Sie hing bis zu diesem Auftrag im Abschnitt „Konflikt" — also hinter der zugeklappten Zeile
  // „Mehr" und damit hinter einem Klick. N5 verlangt „DAUERHAFT"; sie ist deshalb in die Lesespalte
  // gezogen (`BibliothekLesen.tsx`, Kopf „DER EIGENE BEFUND"). Der Aufruf ist hier VOLLSTÄNDIG
  // entfernt und nicht daneben belassen: zwei Flächen, die denselben Befund je eigen auslegen, sind
  // genau die Drift, gegen die `lib/eigeneKollision.ts:15-17` gebaut ist.

  // SCRUM-357 / AG-14: ein offener Konflikt begrenzt die Nutzbarkeit ehrlich (ready → in Prüfung).
  const usability = conflictLimitedUsability(
    koOverview(ko).usability,
    conflictImpact(ko.id, conflicts.data ?? []),
  );
  const lineage = lineageSummary(ko, neighborhood.data?.total ?? 0);
  const auditEvents = koAuditEvents(audit.data ?? [], ko.id)
    .slice(-6)
    .reverse();
  const gueltigkeit = validityProtectionView(ko, pending.data ?? [], conflicts.data ?? []);

  // ---- JOB 3108 · UX-03: die EINE Menge der offenen Abschnitte, und der Sprung hinein -----------
  const [offene, setOffene] = useState<ReadonlySet<string>>(() => new Set<string>());
  const wurzel = useRef<HTMLDivElement | null>(null);
  /**
   * Der Sprung läuft in ZWEI Zügen: erst öffnen, dann hinführen. In EINEM Zug ginge es nicht — im
   * selben Effekt steht der Abschnitt noch zu, `scrollIntoView` und `focus` träfen ein `<summary>`,
   * das React erst im nächsten Zeichnen anlegt.
   */
  const [hinfuehren, setHinfuehren] = useState<Sprungziel | null>(null);

  const abschnittUmschalten = (schluessel: string, offen: boolean): void => {
    setOffene((vorher) => mengeMitSchluessel(vorher, schluessel, offen));
  };

  // ---- JOB 3475 · UX-28: die offenen FASSUNGEN — dieselbe Haltung, ein Stockwerk tiefer ---------
  //
  // Der Zustand wohnt hier und NICHT in der Karte: eine Karte, die ihr `offen` selbst hielte, fiele
  // bei jeder Auffrischung der Fassungsabfrage zu (react-query liefert eine neue Liste, React
  // zeichnet die Karten neu) — genau das, was Abschnitt 9 des Auftrags ausschließt. Der Schlüssel
  // ist `koId:version` aus `koVersionRows`, also stabil über eine Auffrischung hinweg.
  const [offeneFassungen, setOffeneFassungen] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const fassungUmschalten = (schluessel: string, offen: boolean): void => {
    setOffeneFassungen((vorher) => mengeMitSchluessel(vorher, schluessel, offen));
  };

  /**
   * RUNDE 2 (BEN, Prüflücke 6): DER RÜCKWEG GIBT DEN FOKUS ZURÜCK, STATT IHN FALLEN ZU LASSEN.
   *
   * Der Rückweg-Knopf verschwindet mit dem Inhalt, den er zuklappt. Ohne diese Rückgabe steht der
   * Fokus danach auf `document.body` (von BEN gemessen) — wer mit der Tastatur liest, verlöre
   * seinen Ort in der Liste und müsste sich neu durch den Abschnitt tabben. Dieselbe Regel, die
   * dieses Haus schon für das „Mehr"-Blatt und den Anhang-Upload hält (JOB 3102, JOB 3126).
   *
   * Der Knopf der Fassung bleibt gemountet (nur der Inhalt darunter fällt weg), deshalb genügt das
   * Suchen im schon gezeichneten Baum. Gesucht wird über die Marke statt über einen
   * zusammengesetzten Selektor — dieselbe Vorsicht wie beim Anhangsprung weiter unten.
   */
  const fassungZurueck = (schluessel: string): void => {
    fassungUmschalten(schluessel, false);
    Array.from(wurzel.current?.querySelectorAll<HTMLElement>("[data-bib-fassung]") ?? [])
      .find((e) => e.dataset.bibFassung === schluessel)
      ?.focus();
  };

  // Der Effekt hängt an den WERTEN, nicht an der Kennung des Objekts. Deshalb trägt das Sprungziel
  // einen `nonce`: derselbe Abschnitt muss zweimal hintereinander anspringbar sein (zwischendurch
  // von Hand zugeklappt), und ohne die zweite, wechselnde Angabe liefe der Effekt dann nicht erneut.
  const sprungSchluessel = sprungZiel?.schluessel;
  const sprungNonce = sprungZiel?.nonce;
  const sprungAnhang = sprungZiel?.anhangId;
  useEffect(() => {
    if (sprungSchluessel === undefined || sprungNonce === undefined) {
      return;
    }
    // Nur ÖFFNEN, nie schließen: was jemand selbst aufgemacht hat, bleibt offen.
    setOffene((vorher) =>
      vorher.has(sprungSchluessel) ? vorher : new Set(vorher).add(sprungSchluessel),
    );
    setHinfuehren({
      schluessel: sprungSchluessel,
      nonce: sprungNonce,
      ...(sprungAnhang ? { anhangId: sprungAnhang } : {}),
    });
  }, [sprungSchluessel, sprungNonce, sprungAnhang]);

  useEffect(() => {
    if (!hinfuehren) {
      return;
    }
    setHinfuehren(null);
    const ziel = wurzel.current?.querySelector(`[data-bib-abschnitt="${hinfuehren.schluessel}"]`);
    if (!(ziel instanceof HTMLDetailsElement)) {
      return;
    }
    // Die Existenzprüfung ist kein Zugeständnis an den Prüfstand: `scrollIntoView` fehlt in jsdom
    // UND in älteren Browsern (dieselbe Vorsicht wie `pages/Ask.tsx:628`).
    if (typeof ziel.scrollIntoView === "function") {
      ziel.scrollIntoView({ block: "start" });
    }
    // JOB 3272 · UX-25: Der Fokus landet auf dem BENANNTEN Element, wenn eines mitkam — sonst wie
    // seit UX-03 auf dem Abschnittskopf. EINE Regel, nicht zwei: ein Sprung, der nur aufklappt und
    // den Nutzer dann unter vielen Anhängen suchen lässt, ist genau die Zumutung, die UX-25
    // beseitigt. Gesucht wird über die Anker, nicht über einen zusammengesetzten Selektor:
    // Anhangskennungen sind fremde Zeichenketten, und `CSS.escape` ist nicht überall da.
    const anker = hinfuehren.anhangId;
    const benannt = anker
      ? Array.from(ziel.querySelectorAll<HTMLElement>("[data-bib-anhang]")).find(
          (e) => e.dataset.bibAnhang === anker,
        )
      : undefined;
    // Der Fokus landet im Ziel, nicht nur das Bild: sonst läse ein Vorleseprogramm weiter oben.
    (benannt ?? ziel.querySelector("summary"))?.focus();
  }, [hinfuehren]);

  // JOB 3272 · UX-25: der Weg von der Belegkarte zum Original — über GENAU das Werk oben. Der
  // Zähler ist der `nonce`-Vertrag aus `:491-493`: derselbe Anhang muss zweimal hintereinander
  // anspringbar sein, auch wenn der Abschnitt dazwischen von Hand zugeklappt wurde.
  //
  // JOB 3384 · UX-26: dieselbe Funktion führt jetzt auch OHNE Anker in einen Abschnitt (der Weg aus
  // dem leeren Belegabschnitt zum Quellenformular). Sie ist dafür VERALLGEMEINERT, nicht kopiert:
  // ein zweiter Sprungweg neben diesem wäre genau die Doppelung, gegen die UX-03 und UX-25
  // angetreten sind — und er liefe unweigerlich am `nonce`-Vertrag vorbei.
  const sprungZaehler = useRef(0);
  const zumAbschnittSpringen = (schluessel: string, anhangId?: string): void => {
    sprungZaehler.current += 1;
    abschnittUmschalten(schluessel, true);
    setHinfuehren({
      schluessel,
      nonce: sprungZaehler.current,
      ...(anhangId ? { anhangId } : {}),
    });
  };

  return (
    <div data-testid="bib-mehr-abschnitte" ref={wurzel} className="flex flex-col">
      {/* 1 — Konflikt */}
      <Abschnitt
        schluessel="konflikt"
        titel={t("ko.mehr.konflikt")}
        offen={offene.has("konflikt")}
        aufWechsel={(o) => abschnittUmschalten("konflikt", o)}
      >
        {/* mega29 C1: die Deckung des KI-Laufs schränkt jede Konfliktaussage ein — sie steht
            deshalb hier, direkt bei ihr. */}
        <AiCheckCoverageNotes coverage={ko.aiCheck?.coverage} />
        {canReview ? (
          <div className="mt-2 space-y-2">
            <div className="space-y-1.5">
              <span className="block text-[12.5px] font-medium text-muted">
                {t("ko.conflictTarget")}
              </span>
              <button
                type="button"
                onClick={() => setPickOpen(true)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-input border border-hairline bg-surface px-3 text-left text-sm hover:border-ink/30"
              >
                <span className={conflict.koB ? "truncate text-text" : "text-muted"}>
                  {conflictTitle || t("ko.conflictTargetPlaceholder")}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-2">
                  {t("ko.conflictTargetChoose")}
                </span>
              </button>
            </div>
            <Field label={t("ko.conflictType")}>
              <select
                value={conflict.type}
                onChange={(e) => setConflict({ ...conflict, type: e.target.value as ConflictType })}
                className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
              >
                {CONFLICT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`con.type.${ct}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ko.conflictDesc")}>
              <textarea
                value={conflict.desc}
                onChange={(e) => setConflict({ ...conflict, desc: e.target.value })}
                rows={2}
                className={textareaCls}
              />
            </Field>
            <Button
              variant="primary"
              disabled={report.isPending || !conflict.koB}
              onClick={() => report.mutate()}
            >
              {t("ko.conflictSubmit")}
            </Button>
            <ConflictTargetPicker
              open={pickOpen}
              onClose={() => setPickOpen(false)}
              candidates={(koList.data ?? []).filter((k) => k.id !== id)}
              onSelect={(koId) => {
                setConflict({ ...conflict, koB: koId });
                setPickOpen(false);
              }}
            />
          </div>
        ) : null}
      </Abschnitt>

      {/* 2 — Quellen & Belege */}
      <Abschnitt
        schluessel="quellen"
        titel={t("ko.mehr.quellen")}
        offen={offene.has("quellen")}
        aufWechsel={(o) => abschnittUmschalten("quellen", o)}
      >
        {(ko.sources ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.sourcesEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {(ko.sources ?? []).map((s) => (
              <li key={s.id} className="rounded-input bg-page p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13.5px] font-medium text-text">{s.label}</span>
                      <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                        {t(sourceBadgeKey(s))}
                      </span>
                      {s.provider ? (
                        <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted">
                          {s.provider}
                        </span>
                      ) : null}
                    </div>
                    <ExternalUrlText
                      url={s.url}
                      className="block truncate font-mono text-[11px] text-ai hover:underline"
                    />
                    {s.excerpt ? <p className="mt-1 text-[12px] text-muted">{s.excerpt}</p> : null}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      title={t("ko.sourceRemove")}
                      disabled={removeSource.isPending}
                      onClick={() => removeSource.mutate(s.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="mt-3 space-y-2 border-t border-hairline pt-3">
            <TextInput
              value={sourceForm.label}
              onChange={(e) => setSourceForm((s) => ({ ...s, label: e.target.value }))}
              placeholder={t("ko.sourceLabel")}
            />
            <TextInput
              value={sourceForm.url}
              onChange={(e) => setSourceForm((s) => ({ ...s, url: e.target.value }))}
              placeholder={t("ko.sourceUrl")}
            />
            <TextInput
              value={sourceForm.excerpt}
              onChange={(e) => setSourceForm((s) => ({ ...s, excerpt: e.target.value }))}
              placeholder={t("ko.sourceExcerpt")}
            />
            {/* JOB 3133 · UX-22: DER WEG, DEN DER GRUND DARUNTER NENNT — die Belegstelle aus einem
                hier hinterlegten Dokument. Ohne ankerfähigen Anhang steht KEIN leeres Auswahlfeld
                da, sondern der vorhandene Leersatz: ein Feld ohne Inhalt verspräche einen Weg, den
                dieses Objekt nicht hat („Ehrlichkeit vor Optik"). */}
            {ankerAnhaenge.length === 0 ? (
              <p className="text-[12.5px] text-muted">{t("ko.attachmentsEmpty")}</p>
            ) : (
              <Field label={t("ko.mehr.anhaenge")}>
                <select
                  value={sourceForm.objectId ?? ""}
                  onChange={(e) => {
                    const wahl = e.target.value;
                    const gewaehlt = ankerAnhaenge.find((a) => a.objectId === wahl);
                    setSourceForm((s) => ({
                      ...s,
                      objectId: wahl,
                      // Eine bereits getippte Bezeichnung bleibt stehen — der Dateiname belegt nur
                      // ein leeres Feld vor, er überschreibt nie eine Eingabe.
                      label: s.label.trim().length === 0 && gewaehlt ? gewaehlt.name : s.label,
                    }));
                  }}
                  className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                >
                  {/* Sprachneutral: „keine Auswahl" braucht keinen übersetzten Satz. */}
                  <option value="">—</option>
                  {ankerAnhaenge.map((a) => (
                    <option key={a.id} value={a.objectId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {/* mega16 A: die Stufe ist eine echte Grenze — der Grund steht VOR dem Absenden da. */}
            {sourceGateHint ? (
              <output
                id={sourceGateHintId}
                className="block rounded-btn border border-hairline bg-page px-2.5 py-2 text-[11.5px] leading-relaxed text-muted"
              >
                {t(SOURCE_ATTACH_HINT_KEYS[sourceGateHint].body)}{" "}
                {t(SOURCE_ATTACH_HINT_KEYS[sourceGateHint].how)}
              </output>
            ) : null}
            {/* JOB 3133 · UX-22 (N-0047): DER KNOPF KENNT DIE SPERRE JETZT. Bis hierher prüfte er
                nur `isSourceFormValid` — ein Klick setzte die unzulässige Aktion ab, der Server
                antwortete 403, und der Nutzer las eine ZWEITE Ablehnung. Bauform wie in JOB 3126
                abgenommen (s. Abschnitt 12): `aria-disabled` statt `disabled`, damit der Knopf in
                der Tab-Folge bleibt und der daneben stehende Grund erreichbar ist; der
                `onClick`-Rumpf steigt bei gesetzter Sperre wirkungslos aus. Das bestehende
                `disabled` (läuft gerade / kein Titel) bleibt daneben unverändert.

                RUNDE 4 (Codex R3): gesperrt wird nur der SICHER abgewiesene Fall
                (`sourceGateSperre`), nicht jeder Hinweis. Bei einer http(s)-Adresse weiss die
                Oberfläche nicht, ob der Betreiber diesen Host als intern eingetragen hat — sie
                zeigt den Grund, lässt den Nutzer aber entscheiden und den Server prüfen. Sonst
                nähme sie ihm einen Weg, den er hat. Der Grund bleibt in BEIDEN Fällen verbunden. */}
            <Button
              variant="primary"
              aria-disabled={sourceGateSperre}
              {...(sourceGateHint ? { "aria-describedby": sourceGateHintId } : {})}
              disabled={addSource.isPending || !isSourceFormValid(sourceForm)}
              onClick={() => {
                if (sourceGateSperre) {
                  return;
                }
                addSource.mutate();
              }}
            >
              {t("ko.sourceAdd")}
            </Button>
          </div>
        ) : null}
      </Abschnitt>

      {/* 3 — Externes Wissen */}
      <Abschnitt
        schluessel="extern"
        titel={t("ko.mehr.extern")}
        offen={offene.has("extern")}
        aufWechsel={(o) => abschnittUmschalten("extern", o)}
      >
        {canEdit && canSearchExternal(extStage) ? (
          <div className="space-y-2">
            {extAttachAllowed ? null : (
              <p
                data-testid="ext-attach-blocked"
                className="rounded-input bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] text-trust-warn-text"
              >
                {t("ext.attachBlocked")}
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (extQuery.trim()) {
                  extSearch.mutate(extQuery.trim());
                }
              }}
            >
              <TextInput
                value={extQuery}
                onChange={(e) => setExtQuery(e.target.value)}
                placeholder={t("ext.placeholder")}
              />
              <Button
                type="submit"
                variant="ghost"
                disabled={extSearch.isPending || extQuery.trim().length === 0}
              >
                {t("ext.search")}
              </Button>
            </form>
            {extResults.length > 0 ? (
              <ul className="space-y-1.5">
                {extResults.map((r) => (
                  <li key={r.url} className="rounded-input border border-hairline p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium text-text">{r.title}</span>
                          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                            {r.provider}
                          </span>
                        </div>
                        {r.snippet ? (
                          <p className="mt-0.5 text-[11.5px] text-muted">{r.snippet}</p>
                        ) : null}
                        <ExternalUrlText
                          url={r.url}
                          className="block truncate font-mono text-[10.5px] text-ai hover:underline"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        disabled={attachExternal.isPending || !extAttachAllowed}
                        title={extAttachAllowed ? undefined : t("ext.attachBlocked")}
                        onClick={() => attachExternal.mutate(r)}
                      >
                        {t("ext.attach")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">{t("ext.attachBlocked")}</p>
        )}
      </Abschnitt>

      {/* 4 — Quelle/Beitrag melden */}
      <Abschnitt
        schluessel="beitrag"
        titel={t("ko.mehr.beitrag")}
        offen={offene.has("beitrag")}
        aufWechsel={(o) => abschnittUmschalten("beitrag", o)}
      >
        <div className="space-y-2">
          <textarea
            value={source.contribution}
            onChange={(e) => setSource((s) => ({ ...s, contribution: e.target.value }))}
            placeholder={t("ko.sourceContribution")}
            rows={3}
            className={textareaCls}
          />
          <TextInput
            value={source.source ?? ""}
            onChange={(e) => setSource((s) => ({ ...s, source: e.target.value }))}
            placeholder={t("ko.sourceRef")}
          />
          <Button
            variant="primary"
            disabled={sourceContribution.isPending || !isSourceContributionValid(source)}
            onClick={() => sourceContribution.mutate()}
          >
            {t("ko.sourceSubmit")}
          </Button>
        </div>
      </Abschnitt>

      {/* 5 — Provenienz (samt Herkunfts-Kennzeichnungen, Wissensart, Stufe, Autorenübergabe) */}
      <Abschnitt
        schluessel="provenienz"
        titel={t("ko.mehr.provenienz")}
        offen={offene.has("provenienz")}
        aufWechsel={(o) => abschnittUmschalten("provenienz", o)}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <KnowledgeTypeTag type={ko.type} />
          {isDemoKnowledge(ko) ? (
            <span
              title={t("demo.badge.hint")}
              className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
            >
              {t("demo.badge.label")}
            </span>
          ) : null}
          {/* SCRUM-438: der Artikel enthält übernommenes externes, ungeprüftes Wissen — ein
              Herkunfts-Chip, keine Qualitätsaussage. */}
          {containsExternalUnchecked(ko.bodyHtml) ? (
            <span
              title={t("ko.externalUnchecked.hint")}
              className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai"
            >
              {t("ko.externalUnchecked.label")}
            </span>
          ) : null}
          {/* JOB 679 D2: Herkunfts-Chip „Aus Word" — fehlt `origin`, erscheint nichts. */}
          {ko.origin === "word_addin" ? (
            <span
              data-testid="ko-origin-word-addin"
              title={t("ko.originWordAddin.hint")}
              className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
            >
              {t("ko.originWordAddin.label")}
            </span>
          ) : null}
        </div>
        <ProvenanceLine
          author={nameOf(ko.author)}
          originalAuthor={nameOf(ko.originalAuthor)}
          domain={ko.category}
          version={ko.version}
        />
        {canEdit ? (
          <label className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <span>{t("conf.field")}</span>
            <select
              value={confidentialityOf(ko.confidentiality)}
              disabled={act.isPending}
              onChange={(e) =>
                act.mutate({ action: "confidentiality", level: e.target.value as Confidentiality })
              }
              aria-label={t("conf.field")}
              className="rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px] text-text"
            >
              {CONFIDENTIALITY_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {t(`conf.level.${lvl}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canTransfer ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            <select
              aria-label={t("ko.transferTitle")}
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              className="h-9 flex-1 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
            >
              <option value="">{t("ko.transferPick")}</option>
              {(dir.data ?? [])
                .filter((d) => d.id !== ko.author)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            <Button
              variant="primary"
              disabled={transfer.isPending || !newAuthor}
              onClick={() => transfer.mutate(newAuthor)}
            >
              {t("ko.transfer")}
            </Button>
          </div>
        ) : null}
      </Abschnitt>

      {/* 6 — Kopplung und Anlagen */}
      <Abschnitt
        schluessel="kopplung"
        titel={t("ko.mehr.kopplung")}
        offen={offene.has("kopplung")}
        aufWechsel={(o) => abschnittUmschalten("kopplung", o)}
      >
        {couplings.data && couplings.data.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {couplings.data.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-pill bg-page px-2.5 py-1 text-[12px] font-medium text-text"
              >
                <Link2 size={12} className="text-muted-2" />
                {a}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-2">{t("ko.couple.empty")}</p>
        )}
        {role !== "viewer" ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5">
            <TextInput
              value={coupleAsset}
              onChange={(e) => setCoupleAsset(e.target.value)}
              placeholder={ko.asset ? ko.asset : t("ko.couple.placeholder")}
              className="h-9 min-w-[10rem] flex-1"
            />
            <Button
              variant="ghost"
              disabled={couple.isPending || !(coupleAsset.trim() || ko.asset?.trim())}
              onClick={() => couple.mutate((coupleAsset.trim() || ko.asset || "").trim())}
            >
              <Link2 size={14} />
              {t("ko.couple.cta")}
            </Button>
          </div>
        ) : null}
      </Abschnitt>

      {/* 7 — Herkunftskette */}
      <Abschnitt
        schluessel="herkunftskette"
        titel={t("ko.mehr.herkunftskette")}
        offen={offene.has("herkunftskette")}
        aufWechsel={(o) => abschnittUmschalten("herkunftskette", o)}
      >
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.lineageOrigin")}
            </div>
            <div className="text-text">{nameOf(ko.originalAuthor)}</div>
            {lineage.authorTransferred ? (
              <div className="text-[11px] text-muted">
                → {nameOf(ko.author)} {t("ko.lineageTransferred")}
              </div>
            ) : null}
          </div>
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.lineageVersions")}
            </div>
            <div className="text-text">
              {/* mega51 F1: Zahl und Wort werden NICHT von Hand zusammengesetzt — i18next
                  pluralisiert über `count`, sonst stünde bei genau einer Änderung „1 Änderungen". */}
              v{lineage.versions} · {t("ko.lineageChanges", { count: lineage.historyCount })}
            </div>
          </div>
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.sourcesTitle")}
            </div>
            <div className="text-text">{lineage.sourceCount}</div>
          </div>
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.lineageRelated")}
            </div>
            <div className="text-text">{lineage.relatedCount}</div>
          </div>
        </div>
        {/* JOB 3384 · UX-26 — AUS DEM STUMMEN `null` WIRD EIN ZUSTAND.
            Bis hierher stand hier `auditEvents.length > 0 ? <ul> : null`: bei null Ereignissen
            erschien GAR NICHTS — kein Satz, kein Grund, kein Unterschied zwischen „noch nichts
            verzeichnet", „wird noch geladen" und „der Abruf ist gescheitert". Die Trennung wird
            NICHT neu erfunden: sie ist die der Nachbarabschnitte (`:1315-1320`) und die des
            Belegabschnitts (`:1243-1251`), und die Regel für den überlebenden Bestand wohnt in
            `abfrageMitBestand` / `AuffrischungHinweis` (JOB 3034/3063/3272) — hier wird sie nur
            aufgerufen.
            EIN GESCHEITERTER ABRUF IST KEIN BEWEIS FÜR LEERE: der Leersatz steht ausschliesslich
            im Erfolgszweig. Nach einer gescheiterten AUFFRISCHUNG bleibt der zuletzt geholte Stand
            samt Hinweis stehen (REGELN Punkt 7). */}
        <AuffrischungHinweis query={audit} />
        {((): JSX.Element => {
          const ereignisLage = abfrageMitBestand(audit);
          return ereignisLage.isLoading ? (
            <p className="mt-2 text-[12.5px] text-muted">{t("state.loading")}</p>
          ) : ereignisLage.isError ? (
            <p className="mt-2 text-[12.5px] text-danger">{t("state.error")}</p>
          ) : auditEvents.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">{t("ko.lineageEventsEmpty")}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {auditEvents.map((e) => (
                <li key={e.seq} className="flex items-center gap-2 text-[11.5px] text-muted">
                  <span className="font-mono text-muted-2">
                    {new Date(e.at).toLocaleDateString(i18n.language)}
                  </span>
                  {/* Der fachliche Name des Ereignisses — die EINE Beschriftungsfunktion
                      (`auditAction.ts:16`), die bei unbekanntem Code auf ihre neutrale
                      Humanisierung zurückfällt. Es entsteht keine zweite daneben. */}
                  <span className="font-semibold text-text">{auditActionLabel(e.action, t)}</span>
                  <span className="ml-auto font-mono text-muted-2">{nameOf(e.actor)}</span>
                </li>
              ))}
            </ul>
          );
        })()}
        {/* mega70 B3: `/graph` verlangt `admin` — die gesperrte Fassung verliert Link und Pfeil. */}
        <RoleLink
          to="/graph"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ai"
          hoverClassName="hover:underline"
        >
          {(erreichbar) => (
            <>
              {t("ko.lineageGraphLink")}
              {erreichbar ? <span aria-hidden="true">→</span> : null}
            </>
          )}
        </RoleLink>
      </Abschnitt>

      {/* 8 — Historie */}
      <Abschnitt
        schluessel="historie"
        titel={t("ko.mehr.historie")}
        offen={offene.has("historie")}
        aufWechsel={(o) => abschnittUmschalten("historie", o)}
      >
        <ol className="space-y-3">
          {ko.history.map((h) => (
            <li key={h.version} className="border-l-2 border-hairline pl-3">
              <div className="font-mono text-[11px] text-muted-2">
                v{h.version} · {new Date(h.at).toLocaleDateString(i18n.language)}
              </div>
              {/* JOB 3627: der Vermerk geht durch den EINEN Ort, der ihn anzeigbar macht
                  (`koHistoryNote.ts`) — feste Dienst-Vermerke über den Katalog, fremder Text
                  wörtlich. Der Rückfall auf den Autornamen bleibt Zeichen für Zeichen: leer
                  kommt leer zurück. */}
              <div className="text-[12.5px] text-text">
                {koHistoryNote(h.note, t) || nameOf(h.author)}
              </div>
            </li>
          ))}
        </ol>
      </Abschnitt>

      {/* 9 — Belege (samt Vertrauen, Konsistenz, Frische, Gültigkeit) */}
      <Abschnitt
        schluessel="belege"
        titel={t("ko.mehr.belege")}
        offen={offene.has("belege")}
        aufWechsel={(o) => abschnittUmschalten("belege", o)}
      >
        {/* AUFTRAG-mega51 D2 (unverändert übernommen): „Validiert" NEBEN einer 0-Leiste verwirrt —
            Bedingung und Anzeige lesen deshalb DENSELBEN Wert (`confidence`), und bei validiert +
            Sicherheit 0 steht statt der leeren Leiste der nüchterne Hinweis. */}
        <div className="mb-3">
          {deriveStatus(ko) === "validiert" && ko.confidence === 0 ? (
            <span title={t("lib.confidenceNoneHint")} className="text-[12px] text-muted-2">
              {t("lib.confidenceNone")}
            </span>
          ) : (
            <ConfidenceBar value={ko.confidence} showLabel={false} percentPhrase />
          )}
        </div>
        {/* SCRUM-359 / AG-05 / PI-K2: Trust ist ein Review-/Evidenzsignal, KEINE Wahrheitsgarantie —
            die Grundaussage steht ohne Klick bei der Zahl; nur die Vertiefung ist aufklappbar. */}
        {(() => {
          const ex = trustExplainer({ trustBand: koOverview(ko).trustBand, usability });
          return (
            <>
              <p className="mb-2 text-[12px] leading-relaxed text-muted">{t(ex.metaKey)}</p>
              <details className="mb-2 text-[12px] text-muted">
                <summary className="cursor-pointer select-none text-muted-2">
                  {t(ex.titleKey)}
                </summary>
                <p className="mt-1 leading-relaxed">{t(ex.bandKey)}</p>
                {ex.reviewHintKey ? (
                  <p className="mt-1 leading-relaxed text-trust-warn-text">{t(ex.reviewHintKey)}</p>
                ) : null}
              </details>
            </>
          );
        })()}
        <dl className="mb-3 space-y-1.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ko.ovTrust")}</dt>
            <dd className="font-mono text-text">{ko.trust}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("lib.facet.maturity")}</dt>
            <dd className="font-mono text-text">{t(useReadiness(usability).labelKey)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.validity.freshness")}</dt>
            <dd className="font-mono text-text">
              {t(`ext.freshness.${gueltigkeit.freshnessStatus}`)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.validity.outputEligible")}</dt>
            <dd
              className={cx(
                "font-mono",
                gueltigkeit.outputEligible ? "text-trust-pos-text" : "text-muted-2",
              )}
            >
              {t(gueltigkeit.outputEligible ? "ext.outputEligible.yes" : "ext.outputEligible.no")}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.protection.ip")}</dt>
            <dd className="font-mono text-muted-2">{t("ext.protection.notRated")}</dd>
          </div>
        </dl>
        {/* SCRUM-168/175/170: Konsistenz, Frische und Gruppierung nach Fassung — nur bei
            erfolgreich geladenem Bestand, auch bei gescheiterter Auffrischung.
            Ein offline pausierter Erstabruf ist noch kein Bestand. */}
        {abfrageMitBestand(evidence).isSuccess
          ? (() => {
              const consistency = analyzeEvidenceConsistency(ko, evidence.data ?? []);
              const fresh = analyzeEvidenceFreshness({ kos: [ko], evidence: evidence.data ?? [] })
                .rows[0];
              const byVersion = groupEvidenceByVersion(evidence.data ?? [], versions.data ?? []);
              return (
                <>
                  {fresh ? (
                    <dl className="mb-3 text-[12.5px]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <dt className="text-muted">{t("ko.evFresh.title")}</dt>
                        <dd className="text-text">
                          {t(evidenceFreshnessLabelKey(fresh.status))}
                          <span className="ml-2 font-mono text-[10.5px] text-muted-2">
                            {t("ko.evFresh.counts", {
                              version: String(fresh.version),
                              current: String(fresh.currentCount),
                              older: String(fresh.olderCount),
                            })}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                  <div className="mb-3 space-y-1.5 font-mono text-[10.5px] text-muted-2">
                    <div>
                      {t(`ko.evCons.status.${consistency.status}`)} ·{" "}
                      {t("ko.evCons.counts", {
                        sources: String(consistency.sourceCount),
                        attachments: String(consistency.attachmentCount),
                        evidence: String(consistency.evidenceCount),
                      })}
                    </div>
                    {consistency.findings.length > 0 ? (
                      <ul className="space-y-1">
                        {consistency.findings.map((f) => (
                          <li key={`${f.kind}:${f.ref}`} className="break-words">
                            {t(`ko.evCons.finding.${f.kind}`)} — {f.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {byVersion.groups.map((g) => (
                      <div key={g.version}>
                        {t("ko.evVer.version", { n: String(g.version) })} ·{" "}
                        {t("ko.evVer.counts", {
                          sources: String(g.sourceCount),
                          attachments: String(g.attachmentCount),
                        })}
                        {g.latestAt
                          ? ` · ${t("ko.evVer.latest", { at: new Date(g.latestAt).toLocaleDateString(i18n.language) })}`
                          : ""}
                      </div>
                    ))}
                    {byVersion.versionsWithoutEvidence.length > 0 ? (
                      <div>
                        {t("ko.evVer.without", {
                          versions: byVersion.versionsWithoutEvidence
                            .map((v) => `v${v}`)
                            .join(", "),
                        })}
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()
          : null}
        {/* JOB 3272 · RUNDE 2 — BEN, Prüflücke 6: SCHEITERT DIE AUFFRISCHUNG, BLEIBEN DIE BELEGE
            STEHEN. Vorher stand hier `evidence.isError ? <Fehler>` ohne Blick auf den Bestand: nach
            einem gescheiterten HINTERGRUNDabruf (react-query: `isError` UND `data` zugleich) fielen
            alle Belegkarten samt Weg zum Original weg und wurden durch eine Fehlerzeile ersetzt —
            genau der Fehler aus REGELN Punkt 7 und Abschnitt 9 des Auftrags. Die Regel dafür ist
            NICHT hier neu erfunden: `abfrageMitBestand` und `AuffrischungHinweis` (JOB 3034/3063)
            sind der eine Ort, an dem dieses Haus sie hält. Ein ERSTabruf ohne Bestand bleibt der
            Fehlerfall — dann gibt es nichts zu zeigen, und es entsteht auch kein „Original nicht
            mehr an diesem Objekt" aus einem Abrufscheitern. */}
        <AuffrischungHinweis query={evidence} />
        {/* JOB 3430 · Q1c: der eigene Nachladeweg dieses Abschnitts. Er steht NEBEN dem datierten
            Satz, weil beide dieselbe Lage bedienen — der Satz sagt, wie alt der Stand ist, der Weg
            holt ihn. Er betrifft NUR die Belegabfrage; die Fassungen daneben rührt er nicht an. */}
        <AbschnittNachladen abschnitt="belege" bezeichnung={t("ko.mehr.belege")} query={evidence} />
        {((): JSX.Element => {
          const belegLage = abfrageMitBestand(evidence);
          const belegZeilen = evidenceRows(belegLage.data ?? []);
          return belegLage.isLoading ? (
            <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
          ) : belegLage.isError ? (
            <p className="text-[12.5px] text-danger">{t("state.error")}</p>
          ) : belegZeilen.length === 0 ? (
            // JOB 3384 · UX-26 — DER LEERSTAND NENNT EINEN WEG, DER FÜR DIESE ROLLE WIRKLICH TRÄGT.
            // Der Weg ist GEMESSEN, nicht erfunden: `addSource` legt zu jeder Quelle einen
            // Belegdatensatz an (`knowledge-object/src/service.ts:2864-2874`, `kind: "source"`) —
            // aus diesem Schritt entsteht also wirklich der erste Beleg. Der Anhang-Upload täte es
            // auch, verlangt aber zusätzlich eine Datei; deshalb führt der Satz zum kürzeren Weg.
            // FÜR `viewer` STEHT DER SATZ ALLEIN: das Quellenformular hängt an `canEdit` (`:684`).
            // Ein Knopf, der dorthin führte, endete vor einem Abschnitt ohne Formular — dieselbe
            // Sackgasse, die UX-25 an der Belegkarte beseitigt hat (`:1294-1295`).
            <>
              <p className="text-[12.5px] text-muted">{t("ko.evidenceEmpty")}</p>
              {canEdit ? (
                <button
                  type="button"
                  data-bib-beleg-leer-weg="quellen"
                  // Der zugängliche Name nennt das Ziel UND was daraus entsteht — Muster `:1285`.
                  aria-label={`${t("ko.evidenceEmptyCta")} — ${t("ko.evidenceEmptyCtaHint")}`}
                  onClick={() => zumAbschnittSpringen("quellen")}
                  className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                >
                  {/* Zierde, kein Name. */}
                  <Link2 size={13} aria-hidden />
                  {t("ko.evidenceEmptyCta")}
                </button>
              ) : null}
            </>
          ) : (
            <ul className="space-y-2.5">
              {belegZeilen.map((ev) => {
                // JOB 3272 · UX-25: die EINE Zuordnungsregel (koEvidence.ts) entscheidet, ob hier ein
                // Weg, ein ehrlicher Satz oder nichts steht. Die Anhangsliste kommt aus dem BEREITS
                // geladenen Objekt — keine zweite Abfrage, und offline bleibt die Aussage tragfähig
                // (dieselbe Begründung wie beim Quellenanker, `:236-238`).
                const original = belegOriginal(ev, ko.attachments ?? []);
                return (
                  <li
                    key={ev.key}
                    className="rounded-input border border-hairline bg-surface p-2.5"
                  >
                    {/* Der Belegname bricht um, statt abzuschneiden: sein unterscheidendes Ende ist
                      oft der Dateiname (Lehre JOB 3266 R2/R3). */}
                    <div className="break-words text-[13px] font-semibold text-text">
                      {ev.title}
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] text-muted-2">
                      {t(`ko.evidenceKind.${ev.kind}`)} · {nameOf(ev.createdBy)} ·{" "}
                      {new Date(ev.createdAt).toLocaleDateString(i18n.language)}
                    </div>
                    {ev.meta.length > 0 ? (
                      <div className="mt-1 font-mono text-[10px] text-muted-2">
                        {ev.meta.join(" · ")}
                      </div>
                    ) : null}
                    {original.art === "vorhanden" ? (
                      <button
                        type="button"
                        data-bib-beleg-sprung={ev.key}
                        // Der zugängliche Name nennt den Beleg UND den Zweck — sonst hörte ein
                        // Vorleseprogramm bei mehreren Karten dreimal dasselbe Wort (Muster `:1330`).
                        aria-label={`${ev.title} — ${t("ko.evidenceToOriginalHint")}`}
                        onClick={() => zumAbschnittSpringen("anhaenge", original.anhangId)}
                        className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                      >
                        {/* Zierde, kein Name. */}
                        <Paperclip size={13} aria-hidden />
                        {t("ko.evidenceToOriginal")}
                      </button>
                    ) : original.art === "fehlt" ? (
                      // KEIN Knopf und kein `aria-disabled`-Knopf: ein Weg, der ins Leere führt, ist
                      // eine Sackgasse. Der Satz sagt statt dessen, was der Fall ist (N-0052).
                      <p className="mt-1.5 text-[12px] text-muted">
                        {t("ko.evidenceOriginalDetached")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </Abschnitt>

      {/* 10 — Schnappschüsse */}
      <Abschnitt
        schluessel="schnappschuesse"
        titel={t("ko.mehr.schnappschuesse")}
        offen={offene.has("schnappschuesse")}
        aufWechsel={(o) => abschnittUmschalten("schnappschuesse", o)}
      >
        {/* JOB 3430 · Q1c — DIE FASSUNGEN BEKOMMEN DENSELBEN ZUSTANDSVERTRAG WIE DIE BELEGE.
            Bis hierher stand hier `versions.isError ? <Fehler>` OHNE Blick auf den Bestand: nach
            einem gescheiterten HINTERGRUNDabruf (react-query: `isError` UND `data` zugleich) fielen
            alle Schnappschüsse weg und wurden durch eine Fehlerzeile ersetzt. Mit einem Nachladeweg
            daneben wäre das kein Schönheitsfehler mehr, sondern die Falle: ein Klick, der bei
            weggebrochenem Netz die Liste leert. Die Regel ist NICHT hier neu erfunden —
            `abfrageMitBestand` und `AuffrischungHinweis` sind der eine Ort, an dem dieses Haus sie
            hält (JOB 3034/3063, s. den Belegabschnitt `:1337-1352`). Ein ERSTabruf ohne Bestand
            bleibt der Fehlerfall: dann gibt es wirklich nichts zu zeigen. */}
        <AuffrischungHinweis query={versions} />
        <AbschnittNachladen
          abschnitt="schnappschuesse"
          bezeichnung={t("ko.mehr.schnappschuesse")}
          query={versions}
        />
        {((): JSX.Element => {
          const fassungsLage = abfrageMitBestand(versions);
          const fassungen = fassungsLage.data ?? [];
          // EINMAL abgeleitet, nicht zweimal: bis hierher stand `koVersionRows(fassungen)` zweimal
          // in diesem Block. Seit die Zeile den Bericht mitführt (`koVersionSnapshots.ts`), wäre das
          // zweimal derselbe Klartext-Durchlauf über einen Bericht, der megabytegroß sein kann.
          const zeilen = koVersionRows(fassungen);
          return fassungsLage.isLoading ? (
            <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
          ) : fassungsLage.isError ? (
            <p className="text-[12.5px] text-danger">{t("state.error")}</p>
          ) : zeilen.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("ko.snapshotsEmpty")}</p>
          ) : (
            <ol className="space-y-3">
              {zeilen.map((v) => {
                // ============================================================================
                // JOB 3475 · UX-28 — DIE FASSUNGSKARTE IST EIN WEG, KEIN STUMMES `<li>` MEHR.
                // ============================================================================
                //
                // Bis hierher war diese Karte ein `<li>` OHNE Knopf, ohne `onClick`, ohne
                // `tabIndex` — Pedis Befund „Klick öffnet nichts, Tab überspringt die Karten"
                // (N-0055/N-0057) stand als Code da. Jetzt trägt sie EINEN nativen
                // `<button type="button" aria-expanded>` in der Bauform dieses Hauses (Muster: der
                // Belegsprung `:1449-1461`, der Anhangknopf): damit wirken Tabulator, Eingabe- und
                // Leertaste OHNE `tabIndex`-Nachbau und ohne Tastenbehandlung von Hand.
                //
                // KEIN `disabled` UND KEIN `aria-disabled`: der Knopf führt in JEDEM Fall zu einer
                // Aussage — auch die Fassung ohne gespeicherten Bericht hat einen Inhalt zu zeigen
                // (ihre Felder) und sagt dort ehrlich, dass kein ausführlicher Inhalt gespeichert
                // ist. Ein gesperrter Knopf wäre hier also keine Sackgassenvermeidung, sondern eine
                // verschlossene Tür (Muster `:1462-1468`: WO ein Weg ins Leere führt, steht ein
                // Satz statt eines Knopfes — hier führt er nicht ins Leere).
                const offen = offeneFassungen.has(v.key);
                const aktion = offen ? t("ko.snapshotClose") : t("ko.snapshotOpen");
                // Die GEMESSENE Größe des gespeicherten Berichts — die Angabe, an der sich zwei
                // Fassungen mit gleicher Kernaussage unterscheiden. Sie steht nur da, wo wirklich
                // ein Bericht mit Text liegt; „0 Zeichen" wäre eine Aussage über einen Bericht, den
                // es nicht gibt.
                const groesse =
                  v.berichtZeichen > 0
                    ? t("ko.snapshotBodyChars", {
                        anzahl: v.berichtZeichen.toLocaleString(i18n.language),
                      })
                    : null;
                // Die gespeicherten Felder DIESER Fassung. Titel und Status stehen schon im Kopf
                // der Karte; sie hier zu wiederholen wäre dieselbe Aussage zweimal.
                const felder: [string, string][] = [
                  ["statement", v.statement],
                  ["conditions", v.conditions.join(" · ")],
                  ["measures", v.measures.join(" · ")],
                  ["type", t(`ktype.${v.type}`)],
                ];
                return (
                  <li key={v.key} className="rounded-input border border-hairline bg-surface p-2.5">
                    <div className="font-mono text-[11px] text-muted-2">
                      v{v.version} · {new Date(v.at).toLocaleDateString(i18n.language)} ·{" "}
                      {nameOf(v.author)} · {t(`status.${v.status}`)}
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-text">{v.title}</div>
                    <p className="mt-1 text-[12.5px] text-muted">{v.excerpt}</p>
                    {(() => {
                      // DER EINE ORT FÜR DIE ÄNDERUNGSANGABE (Auftrag 4e). Mit dem siebten Feld aus
                      // `koVersionDiff.ts` liest sich die Zeile jetzt als „Aussage · Ausführlicher
                      // Inhalt" — und „Keine Änderung in den Hauptfeldern" steht nur noch da, wenn
                      // ALLE sieben Felder gleich sind, den Bericht eingeschlossen.
                      const diff = diffForVersion(fassungen, v.version);
                      if (!diff || diff.fromVersion === null) {
                        return (
                          <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                            {t("ko.snapshotInitial")}
                          </p>
                        );
                      }
                      return diff.changed.length === 0 ? (
                        <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                          {t("ko.snapshotNoChanges")}
                        </p>
                      ) : (
                        <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                          {diff.changed.map((f) => t(`ko.snapshotField.${f}`)).join(" · ")}
                        </p>
                      );
                    })()}
                    {/* JOB 3627: derselbe eine Ort wie in der Historie (`:1238`) — keine zweite
                        Tabelle, kein zweites `t(…)` daneben. */}
                    <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                      {koHistoryNote(v.note, t)}
                    </p>
                    <button
                      type="button"
                      data-bib-fassung={v.key}
                      aria-expanded={offen}
                      // Der zugängliche Name nennt die Fassung, die Handlung UND die gemessene
                      // Größe — sonst hörte ein Vorleseprogramm bei zehn Karten zehnmal dasselbe
                      // Wort (Muster `:1452-1453`).
                      aria-label={`v${v.version} — ${aktion}${groesse ? ` · ${groesse}` : ""}`}
                      onClick={() => fassungUmschalten(v.key, !offen)}
                      className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                    >
                      {aktion}
                      {groesse ? (
                        <span className="font-mono text-[10.5px] text-muted-2">· {groesse}</span>
                      ) : null}
                    </button>
                    {offen ? (
                      <div
                        data-bib-fassung-inhalt={v.key}
                        className="mt-2 border-t border-hairline pt-2"
                      >
                        {/* WELCHE Fassung hier steht und dass sie nur lesbar ist — kein Erklärkasten,
                            eine Zeile in derselben Machart wie die Kopfzeile der Karte. Ohne sie
                            läse jemand einen alten Bericht als aktuellen Stand. */}
                        <p className="font-mono text-[10.5px] text-muted-2">
                          {t("ko.snapshotReadOnly", { version: v.version })}
                        </p>
                        <dl className="mt-1.5 grid gap-1.5">
                          {felder
                            .filter(([, wert]) => wert.trim().length > 0)
                            .map(([feld, wert]) => (
                              <div key={feld}>
                                <dt className="font-mono text-[10.5px] text-muted-2">
                                  {t(`ko.snapshotField.${feld}`)}
                                </dt>
                                <dd className="text-[12.5px] text-text">{wert}</dd>
                              </div>
                            ))}
                        </dl>
                        {/* Der Bericht dieser Fassung — über den EINEN Zeichenweg des Hauses
                            (`SanitizedHtml`, dieselbe Bauform wie die Lesefläche selbst). Kein
                            `dangerouslySetInnerHTML` von Hand, keine zweite Allowlist. */}
                        {v.berichtHtml ? (
                          <SanitizedHtml
                            html={v.berichtHtml}
                            className="prose-kw mt-2 text-[12.5px]"
                          />
                        ) : (
                          // WISSENSLÜCKE STATT ERFINDUNG: der Satz sagt, dass für DIESE Fassung
                          // nichts gespeichert ist — nicht, dass der Bericht leer WAR, und
                          // ausdrücklich nichts aus einer anderen Fassung.
                          <p className="mt-2 text-[12.5px] text-muted">
                            {t("ko.snapshotBodyMissing")}
                          </p>
                        )}
                        <button
                          type="button"
                          data-bib-fassung-zurueck={v.key}
                          aria-label={`v${v.version} — ${t("ko.snapshotBackToCurrent")}`}
                          onClick={() => fassungZurueck(v.key)}
                          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                        >
                          {t("ko.snapshotBackToCurrent")}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          );
        })()}
      </Abschnitt>

      {/* 11 — Kommentare */}
      <Abschnitt
        schluessel="kommentare"
        titel={t("ko.mehr.kommentare")}
        offen={offene.has("kommentare")}
        aufWechsel={(o) => abschnittUmschalten("kommentare", o)}
      >
        {(ko.comments ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.commentsEmpty")}</p>
        ) : (
          <ul className="space-y-2.5">
            {(ko.comments ?? []).map((cm) => (
              <li key={cm.id} className="border-l-2 border-hairline pl-3">
                <div className="font-mono text-[11px] text-muted-2">
                  {nameOf(cm.author)} · {new Date(cm.at).toLocaleDateString(i18n.language)}
                </div>
                <div className="text-[13px] text-text">{cm.text}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            placeholder={t("ko.commentPlaceholder")}
            className={textareaCls}
          />
          <Button
            variant="primary"
            disabled={comment.isPending || commentText.trim().length === 0}
            onClick={() => comment.mutate()}
          >
            {t("ko.commentAdd")}
          </Button>
        </div>
      </Abschnitt>

      {/* 12 — Anhänge */}
      <Abschnitt
        schluessel="anhaenge"
        titel={t("ko.mehr.anhaenge")}
        offen={offene.has("anhaenge")}
        aufWechsel={(o) => abschnittUmschalten("anhaenge", o)}
      >
        {(ko.attachments ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.attachmentsEmpty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(ko.attachments ?? []).map((a) => {
              const kannOeffnen = Boolean(objectRawHref(a.objectId) || a.dataUrl);
              const hinweis = t(
                kannOeffnen ? "ko.attachmentOpenNewTab" : "ko.attachmentOriginalUnavailable",
              );
              const vorschau = a.thumbnail || a.dataUrl;
              return (
                <div key={a.id} className="min-w-0">
                  <button
                    type="button"
                    // JOB 3272 · UX-25: der ANKER, über den ein Beleg genau diesen Anhang anspringt.
                    // Rein additiv — Name, `aria-disabled` und der Öffnen-Weg bleiben, wie sie sind.
                    data-bib-anhang={a.id}
                    className="block w-full text-left"
                    aria-label={`${a.name} — ${hinweis}`}
                    aria-disabled={!kannOeffnen}
                    onClick={() => {
                      // Wie beim Upload: fokussierbar bleiben, fehlenden Weg vor dem Aufruf abfangen.
                      if (!kannOeffnen) {
                        return;
                      }
                      openAttachment(a);
                    }}
                  >
                    <AnhangVorschau key={vorschau} src={vorschau} />
                    <span className="mt-1 block truncate text-[12px] text-text" title={a.name}>
                      {a.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted">{hinweis}</span>
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={t("ko.attachmentRemove")}
                      onClick={() => detach.mutate(a.id)}
                      className="ml-auto mt-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {canEdit ? (
          <>
            {/* JOB 3126 · UX-23: `aria-disabled` STATT `disabled` — ein `disabled`-Knopf fällt aus
                der Tab-Folge, und wer mit der Tastatur bedient, verlöre mitten im Hochladen seinen
                Ort. Der Knopf bleibt deshalb fokussierbar und fängt das Auslösen wirkungslos ab;
                das Dateifeld behält sein echtes `disabled`. */}
            <button
              type="button"
              aria-disabled={attach.isPending}
              onClick={() => {
                if (attach.isPending) {
                  return;
                }
                dateiFeld.current?.click();
              }}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text"
            >
              {/* Zierde, kein Name: das Symbol darf den zugänglichen Namen nicht verfälschen. */}
              <Paperclip size={14} aria-hidden />
              {attach.isPending ? t("ko.attachmentUploading") : t("ko.attachmentAdd")}
            </button>
            <input
              ref={dateiFeld}
              type="file"
              accept="image/*"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              disabled={attach.isPending}
              onChange={(e) => void onPickFile(e)}
            />
            {/* AUFTRAG-mega14 Block E (SCRUM-421): die geltenden Grenzen stehen AN der
                Auswahlstelle, und sie kommen vom Server. */}
            <UploadLimitsHint />
          </>
        ) : null}
      </Abschnitt>

      {/* 13 — Nachbarschaft */}
      <Abschnitt
        schluessel="nachbarschaft"
        titel={t("ko.mehr.nachbarschaft")}
        offen={offene.has("nachbarschaft")}
        aufWechsel={(o) => abschnittUmschalten("nachbarschaft", o)}
      >
        <KnowledgeNeighborhood key={ko.id} koId={ko.id} koTitle={ko.title} />
      </Abschnitt>
    </div>
  );
}
