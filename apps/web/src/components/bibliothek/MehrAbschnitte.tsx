import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Paperclip, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { type KoDiskussionsbeitrag, endpoints } from "../../api/endpoints";
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
  quellennachweis,
  sourceBadgeKey,
  toAddSourceRequest,
  toSourcePayload,
} from "../../lib/koSource";
import { diffForVersion, paarDiff } from "../../lib/koVersionDiff";
import { koVersionRows, uebernahmeHerkunft } from "../../lib/koVersionSnapshots";
import { useNetzOnline } from "../../lib/netzzustand";
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

// JOB 4146: die kleinen Handlungen am Faden (antworten, klären, wieder öffnen). Dieselbe Bauform
// wie der Rückweg an einer Fassungskarte weiter unten — kein zweiter Knopfstil für dieselbe Grösse.
const diskussionsKnopfCls =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

/** JOB 4146: ein Faden — der Wurzelbeitrag und alles, was daran hängt, in Schreibreihenfolge. */
interface Diskussionsfaden {
  wurzel: KoDiskussionsbeitrag;
  antworten: KoDiskussionsbeitrag[];
}

// ==================================================================================================
// JOB 4146 — AUS DER FLACHEN LISTE WIRD DER FADEN.
// ==================================================================================================
//
// ZWEI ENTSCHEIDUNGEN, und beide folgen „Wissenslücke statt Erfindung":
//
//  1. EIN BEITRAG, DESSEN BEZUG HIER NICHT LIEGT, VERSCHWINDET NICHT. Er wird als Anfang seines
//     eigenen sichtbaren Fadens gezeigt. Ihn wegzulassen hiesse, einen geschriebenen Beitrag zu
//     unterschlagen, weil die Fläche seinen Zusammenhang nicht auflösen kann.
//  2. EINE ANTWORT AUF EINE ANTWORT landet unter DERSELBEN Wurzel, nicht in einer dritten Ebene.
//     Der Klärungsstand gehört dem Faden, und eine Verschachtelung ohne Ende wäre eine Gliederung,
//     die niemand mehr überblickt.
//
// DIESELBE REGEL STEHT IM DIENST (`KoService`, `fadenWurzel`) — dort ENTSCHEIDET sie, hier ZEIGT sie.
// Über die Modulgrenze hinweg ist sie nicht teilbar; dass beide Seiten dieselbe Auskunft geben,
// misst `tests/wiki-diskussion/diskussion-in-der-flaeche.test.tsx` gegen die Daten des Servers.
function diskussionsfaeden(beitraege: readonly KoDiskussionsbeitrag[]): Diskussionsfaden[] {
  const nachId = new Map(beitraege.map((b) => [b.id, b]));
  const wurzelVon = (b: KoDiskussionsbeitrag): string => {
    let aktuell = b;
    const gesehen = new Set<string>([aktuell.id]);
    while (aktuell.replyTo) {
      const eltern = nachId.get(aktuell.replyTo);
      if (!eltern || gesehen.has(eltern.id)) {
        return aktuell.id;
      }
      gesehen.add(eltern.id);
      aktuell = eltern;
    }
    return aktuell.id;
  };
  // ZWEI DURCHGÄNGE, damit die Reihenfolge der Fäden die Schreibreihenfolge ihrer WURZELN ist —
  // und nicht davon abhängt, ob eine Antwort zufällig vor ihrer Wurzel in der Liste steht.
  const faeden = new Map<string, Diskussionsfaden>();
  for (const b of beitraege) {
    if (wurzelVon(b) === b.id) {
      faeden.set(b.id, { wurzel: b, antworten: [] });
    }
  }
  for (const b of beitraege) {
    const wurzelId = wurzelVon(b);
    if (wurzelId !== b.id) {
      faeden.get(wurzelId)?.antworten.push(b);
    }
  }
  return [...faeden.values()];
}

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

  // ================================================================================================
  // JOB 4146 · DIE DISKUSSION — FRAGE, ANTWORT, KLÄRUNGSSTAND.
  // ================================================================================================
  //
  // DER EINGEGEBENE TEXT GEHT NIE VERLOREN. Er wird ausschliesslich im ERFOLGSFALL geleert; scheitert
  // das Absenden (409, Netz, 403), steht er weiter im Feld, und daneben erscheint ein Satz in
  // Anwendersprache mit dem nächsten Schritt (`diskussionsFehler`).
  //
  // DER TOAST IST FÜR DIESEN WEG ABGELÖST, nicht ergänzt: eine Meldung, die nach Sekunden
  // verschwindet, ist für „dein Text ist noch da, versuch es gleich nochmal" die falsche Bauform —
  // und zwei Meldungen über denselben Fehlschlag wären zwei Stellen, an denen er anders lautet.
  //
  // DER BEITRAGSSCHLÜSSEL (Vertrag Fall 5) GEHÖRT ZUM ENTWURF, nicht zum Absenden: er entsteht mit
  // dem Feld und bleibt derselbe, solange derselbe Entwurf offen ist. Genau das macht die
  // WIEDERHOLUNG nach einer unklaren Übertragung idempotent — mit einem je Klick neu gewürfelten
  // Schlüssel wäre er wirkungslos. Erst der Erfolg holt einen neuen.
  //
  // DASS DER SCHLÜSSEL EINEN GEÄNDERTEN TEXT ÜBERLEBT, IST ABSICHT UND KEIN LOCH: der Dienst
  // vergleicht seit R5 die ganze Absendung (Verfasser, Text, Antwortbezug) und nicht nur den
  // Schlüssel (`service.ts`, `gleicheAbsendung`). Eine nachgebesserte Absendung ist dort eine eigene
  // und wird geschrieben; nur die wortgleiche Wiederholung bleibt ein einziger Beitrag.
  //
  // DIE ANTWORTENTWÜRFE LIEGEN JE FADEN, nicht in einem gemeinsamen Feld. Ein gemeinsames Feld
  // gehört keinem der Fäden: es wurde beim Öffnen geleert (und nahm den Entwurf mit) oder es wanderte
  // beim Fadenwechsel in den fremden Faden. Beides ist verlorene oder verlegte Arbeit eines Menschen.
  //
  // DER ERFOLG RÄUMT NUR WEG, WAS ER MITGENOMMEN HAT (R6, BEN-Korrekturpflicht 1). Das Feld bleibt
  // während des Absendens bearbeitbar — mit Absicht, denn eine hängende Antwort darf niemanden am
  // Weiterschreiben hindern. Also muss die Bereinigung den ABGESENDETEN Stand kennen und mit dem
  // heutigen vergleichen; sonst löscht ein spät eintreffender Erfolg Text, den der Server nie gesehen
  // hat. Deshalb liegt neben jedem Entwurf ein Spiegel als `ref`: `onSuccess` läuft ausserhalb des
  // Renderns und bekäme aus dem Zustand nur den Stand von vorhin.
  const [commentText, setCommentText] = useState("");
  const commentTextSpiegel = useRef("");
  const [commentKey, setCommentKey] = useState(() => crypto.randomUUID());
  const [antwortAn, setAntwortAn] = useState<string | null>(null);
  const [antwortEntwuerfe, setAntwortEntwuerfe] = useState<Record<string, string>>({});
  const antwortEntwuerfeSpiegel = useRef<Record<string, string>>({});
  const antwortSchluessel = useRef<Record<string, string>>({});
  const [diskussionsFehler, setDiskussionsFehler] = useState<string | null>(null);
  // Woran ein „Erneut senden" anknüpft. `null` heisst: nichts ist schiefgegangen, es gibt nichts zu
  // wiederholen — der Knopf steht dann gar nicht da.
  const [letzterFehlschlag, setLetzterFehlschlag] = useState<
    { art: "beitrag" } | { art: "antwort"; bezug: string } | null
  >(null);

  const antwortEntwurf = (bezug: string): string => antwortEntwuerfe[bezug] ?? "";

  const beitragSetzen = (wert: string): void => {
    commentTextSpiegel.current = wert;
    setCommentText(wert);
  };

  const antwortSetzen = (bezug: string, wert: string): void => {
    antwortEntwuerfeSpiegel.current = { ...antwortEntwuerfeSpiegel.current, [bezug]: wert };
    setAntwortEntwuerfe((v) => ({ ...v, [bezug]: wert }));
  };

  /** Der Schlüssel des Entwurfs zu diesem Faden — einmal gewürfelt, bis dieser Entwurf durch ist. */
  const antwortSchluesselFuer = (bezug: string): string => {
    const vorhanden = antwortSchluessel.current[bezug];
    if (vorhanden) {
      return vorhanden;
    }
    const neu = crypto.randomUUID();
    antwortSchluessel.current[bezug] = neu;
    return neu;
  };

  /**
   * Der eine Satz, der bei einem gescheiterten Absenden neben dem Feld steht. Er nennt ZUERST den
   * nächsten Schritt (der Text ist erhalten, erneut senden) und hängt die Auskunft des Servers an,
   * wo es eine gibt — ein nackter technischer Fehler hilft niemandem, ein verschwiegener auch nicht.
   *
   * DREI LAGEN, UND SIE WISSEN VERSCHIEDEN VIEL (R5, BEN-Korrekturpflicht 3):
   *
   *  · KEINE ANTWORT ANGEKOMMEN (kein `ApiError`) oder ein Serverfehler ab 500 — dann ist der
   *    SPEICHERSTAND UNKLAR. Der Server kann geschrieben und nur die Antwort verloren haben; genau
   *    diese Lage misst `tests/wiki-diskussion/wiederholung-verliert-nichts.test.ts` am Bestand.
   *    „Der Beitrag wurde nicht gespeichert" wäre hier eine Tatsachenaussage ohne ihre Voraussetzung.
   *  · 409 — eine gleichzeitige Schreibung wurde ABGELEHNT. Das ist belegt und kein Datenverlust.
   *  · jede andere beantwortete Ablehnung (400/403/404) — der Server hat geprüft und nicht
   *    geschrieben. Hier darf der Satz bestimmt sein, denn hier ist er belegt.
   */
  const diskussionsFehlerSatz = (e: unknown): string => {
    if (!(e instanceof ApiError)) {
      return t("ko.diskussion.sendeFehlerUnklar");
    }
    const satz = t(
      e.status >= 500
        ? "ko.diskussion.sendeFehlerUnklar"
        : e.status === 409
          ? "ko.diskussion.sendeFehlerVeraltet"
          : "ko.diskussion.sendeFehler",
    );
    return e.message ? `${satz} ${e.message}` : satz;
  };

  // Die abgesendete Fassung reist als Veränderliche mit, damit `onSuccess` sie noch hat. Sie aus dem
  // Zustand zu lesen wäre genau der Fehler, um den es hier geht.
  const comment = useMutation({
    mutationFn: (gesendet: string) =>
      endpoints.ko.act(id, {
        action: "comment",
        text: gesendet,
        clientKey: commentKey,
      }),
    onSuccess: (_daten, gesendet) => {
      invalidate();
      setDiskussionsFehler(null);
      setLetzterFehlschlag(null);
      // Steht im Feld noch dasselbe, ist es erledigt und darf weg. Steht etwas anderes da, hat der
      // Mensch weitergeschrieben — dieser Text war nie unterwegs und bleibt unangetastet stehen.
      if (commentTextSpiegel.current.trim() !== gesendet) {
        return;
      }
      beitragSetzen("");
      setCommentKey(crypto.randomUUID());
    },
    onError: (e) => {
      setDiskussionsFehler(diskussionsFehlerSatz(e));
      setLetzterFehlschlag({ art: "beitrag" });
    },
  });

  const antwort = useMutation({
    mutationFn: (v: { bezug: string; gesendet: string }) =>
      endpoints.ko.act(id, {
        action: "comment",
        text: v.gesendet,
        replyTo: v.bezug,
        clientKey: antwortSchluesselFuer(v.bezug),
      }),
    // NUR DER ERFOLG RÄUMT AUF, und er räumt genau den einen Entwurf weg, der durchgegangen ist —
    // und auch den nur, wenn seither niemand weitergeschrieben hat.
    onSuccess: (_daten, v) => {
      invalidate();
      setDiskussionsFehler(null);
      setLetzterFehlschlag(null);
      if ((antwortEntwuerfeSpiegel.current[v.bezug] ?? "").trim() !== v.gesendet) {
        return;
      }
      const { [v.bezug]: _durch, ...rest } = antwortEntwuerfeSpiegel.current;
      antwortEntwuerfeSpiegel.current = rest;
      setAntwortEntwuerfe(({ [v.bezug]: _erledigt, ...uebrig }) => uebrig);
      delete antwortSchluessel.current[v.bezug];
      setAntwortAn(null);
    },
    onError: (e, v) => {
      setDiskussionsFehler(diskussionsFehlerSatz(e));
      setLetzterFehlschlag({ art: "antwort", bezug: v.bezug });
    },
  });

  /**
   * DER WEG ZURÜCK NACH EINEM FEHLSCHLAG (R6, BEN-Korrekturpflicht 2). Er schickt den Entwurf, wie er
   * jetzt im Feld steht, mit DEMSELBEN Beitragsschlüssel noch einmal los: die wortgleiche Wiederholung
   * bleibt beim Dienst ein einziger Beitrag (`service.ts`, `gleicheAbsendung`).
   *
   * WARUM ÜBERHAUPT EIN KNOPF: vorher stand in den Fehlersätzen „bitte die Seite neu laden". Die
   * Entwürfe leben im Zustand dieser Komponente — wer der Aufforderung folgte, verlor genau den Text,
   * den derselbe Satz als erhalten bezeichnete. Der Knopf ist der Weg, der das nicht kostet.
   */
  const erneutSenden = (): void => {
    if (!letzterFehlschlag) {
      return;
    }
    if (letzterFehlschlag.art === "beitrag") {
      comment.mutate(commentTextSpiegel.current.trim());
      return;
    }
    const bezug = letzterFehlschlag.bezug;
    antwort.mutate({
      bezug,
      gesendet: (antwortEntwuerfeSpiegel.current[bezug] ?? "").trim(),
    });
  };

  const klaerung = useMutation({
    mutationFn: (eingabe: { commentId: string; erledigt: boolean }) =>
      endpoints.ko.act(
        id,
        eingabe.erledigt
          ? { action: "comment-resolve", commentId: eingabe.commentId }
          : { action: "comment-reopen", commentId: eingabe.commentId },
      ),
    onSuccess: () => {
      invalidate();
      setDiskussionsFehler(null);
    },
    onError: (e) => setDiskussionsFehler(diskussionsFehlerSatz(e)),
  });

  const diskussionsFaeden = diskussionsfaeden(ko.comments ?? []);

  /**
   * Der Fassungsbezug EINES Beitrags, in drei ehrlichen Lagen:
   *   · keine Angabe → „unbekannt". Vertrag Fall 1: die aktuelle Fassung wird NICHT als seine Basis
   *     erfunden, auch nicht als Anzeigebequemlichkeit.
   *   · älter als der heutige Stand → beide Zahlen („stammt aus Version 3, der Eintrag steht auf 5",
   *     `types.ts` zu `KoProposal.baseVersion`). Vertrag Fall 2: der alte Bezug bleibt sichtbar.
   *   · auf dem heutigen Stand → nur die eine Zahl; eine Abweichung zu behaupten, die es nicht gibt,
   *     wäre derselbe Fehler in die andere Richtung.
   */
  const versionsbezug = (b: KoDiskussionsbeitrag): string => {
    if (b.koVersion === undefined) {
      return t("ko.diskussion.versionUnbekannt");
    }
    return b.koVersion < ko.version
      ? t("ko.diskussion.versionVeraltet", { version: b.koVersion, aktuell: ko.version })
      : t("ko.diskussion.version", { version: b.koVersion });
  };

  /** Kopf, Fassungsbezug und Text eines Beitrags — für Wurzel und Antwort dieselbe Bauform. */
  const beitragsInhalt = (b: KoDiskussionsbeitrag): JSX.Element => (
    <>
      <div className="font-mono text-[11px] text-muted-2">
        {nameOf(b.author)} · {new Date(b.at).toLocaleDateString(i18n.language)}
      </div>
      <div data-bib-diskussion-version={b.id} className="text-[11px] text-muted-2">
        {versionsbezug(b)}
      </div>
      <div className="text-[13px] text-text">{b.text}</div>
    </>
  );

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

  // ================================================================================================
  // JOB 4213 · WIKI-NACHVOLLZIEHEN — VERGLEICHEN UND ZURÜCKHOLEN.
  // ================================================================================================
  //
  // ZWEI ZUSTÄNDE, und beide gehören hierher und nicht in die Karte: die Vergleichsauswahl gilt für
  // den ganzen Abschnitt (sie vergleicht ZWEI Fassungen, keine gehört ihr allein), und die Lage der
  // Übernahme muss eine Auffrischung der Fassungsliste überleben — sonst verschwände die
  // Konfliktauskunft in dem Augenblick, in dem sie gebraucht wird.
  //
  // `null` HEISST „NOCH NICHTS GEWÄHLT" und nicht „v0": solange der Abruf läuft, gibt es keine
  // Fassungen, auf die eine Vorauswahl zeigen könnte. Die Vorbelegung entsteht deshalb erst unten
  // aus dem geladenen Bestand und ist hier ausdrücklich keine Behauptung.
  const [vergleichVon, setVergleichVon] = useState<number | null>(null);
  const [vergleichBis, setVergleichBis] = useState<number | null>(null);
  /**
   * Was die letzte Übernahme ergeben hat — je Lage ein Satz, und jeder nennt die FOLGE.
   *
   * `stale` ist der Konfliktfall: fremde Arbeit wurde NICHT überschrieben. Die Version, die
   * übernommen werden sollte, bleibt in der Lage stehen — das ist die Absicht des Menschen, und sie
   * geht durch den Konflikt nicht verloren. KEINE NEULADEAUFFORDERUNG (Korrekturpflicht JOB 4146
   * R6/R7): wer neu lädt, verliert, was er gerade tun wollte.
   */
  const [uebernahmeLage, setUebernahmeLage] = useState<
    | null
    | { art: "fertig"; version: number }
    | { art: "stale"; version: number }
    | { art: "offline"; version: number }
    | { art: "fehler"; version: number; text: string }
  >(null);
  const netzOnline = useNetzOnline();

  // DER SCHREIBWEG IST DER VORHANDENE `revise` — keine neue Route, keine zweite Schreibtür.
  //
  // JOB 4213 R3 · ES GEHT KEIN INHALT MEHR MIT, NUR DIE FASSUNGSNUMMER. Bis hierher schickte diese
  // Fläche die Felder der alten Fassung selbst mit; der Server hat sie geglaubt und die Herkunft
  // daneben geschrieben. BEN hat gemessen, was daraus folgt: mit `restoredFromVersion: 1` liess sich
  // beliebiger Text speichern und wurde danach als „aus Fassung v1 übernommen" gelesen. Jetzt sagt
  // dieser Aufruf nur noch, WELCHE Fassung gemeint ist — den Inhalt holt der Dienst aus seiner
  // eigenen Ablage. Damit kann die Herkunftsauskunft gar nicht mehr falsch werden.
  //
  // `expectedVersion` ist der Stand, den der Mensch vor sich hatte: hat inzwischen jemand anders
  // geschrieben, antwortet der Server 409 und es wurde nichts überschrieben.
  const fassungUebernehmen = useMutation({
    mutationFn: (v: { version: number; erwartet: number }) =>
      endpoints.ko.act(id, {
        action: "revise",
        changes: { restoredFromVersion: v.version },
        expectedVersion: v.erwartet,
      }),
    // `invalidate()` trifft die Fassungsliste MIT: ihr Schlüssel ist `["ko", id, "versions"]`
    // (`api/hooks.ts`), und TanStack Query vergleicht Schlüssel als Präfix. Ein zweiter Aufruf
    // daneben wäre derselbe Griff zweimal.
    onSuccess: (_daten, v) => {
      invalidate();
      setUebernahmeLage({ art: "fertig", version: v.version });
    },
    // DER 409 IST KEIN EINGABEFEHLER, SONDERN EINE TATSACHE ÜBER DIE ZEIT (Bauform aus
    // `BibliothekLesen.tsx`, JOB 4075). Er steht VOR dem Sammelzweig und fängt nur sich selbst —
    // ein Netzausfall ist kein Konflikt und dürfte den Konfliktsatz nicht auslösen.
    onError: (e, v) => {
      if (e instanceof ApiError && e.status === 409) {
        setUebernahmeLage({ art: "stale", version: v.version });
        invalidate();
        return;
      }
      setUebernahmeLage({
        art: "fehler",
        version: v.version,
        text: e instanceof ApiError ? e.message : t("state.error"),
      });
    },
  });

  /**
   * Der eine Ort, an dem eine Übernahme losgeht — vom Knopf an der Karte UND vom Wiederholungsweg
   * nach einem Konflikt. Zwei Aufrufer, eine Regel; ein zweiter Rumpf liefe unweigerlich an der
   * Offline-Prüfung oder am `expectedVersion` vorbei.
   *
   * OFFLINE WIRD NICHT GESENDET, und zwar bevor etwas losgeht: ein Schreibversuch, den TanStack
   * Query anhält, sähe für den Menschen aus wie ein Knopf, der nichts tut. Seine Auswahl bleibt
   * dabei unangetastet stehen.
   */
  const uebernahmeStarten = (version: number): void => {
    if (!netzOnline) {
      setUebernahmeLage({ art: "offline", version });
      return;
    }
    setUebernahmeLage(null);
    fassungUebernehmen.mutate({ version, erwartet: ko.version });
  };

  // ================================================================================================
  // JOB 4213 R3 · DER ÜBERNAHMEKNOPF STEHT NUR, WO DIE ROUTE IHN AUCH ANNIMMT.
  // ================================================================================================
  //
  // BENs Befund an Runde 2 (`BEN Rechte {"rolle":"experte","http":403,"error":"PROPOSAL_REQUIRED"}`):
  // an einem FREIGEGEBENEN Wissensobjekt zeichnete die Fläche den Knopf für jede Rolle ausser
  // `viewer`, obwohl `ko-routes.ts` dort zwingend 403 antwortet. Ein Knopf, der nur zu einer Absage
  // führen kann, ist eine Sackgasse — dieselbe Klasse Fehler, gegen die UX-25 und UX-26 stehen.
  //
  // DIE REGEL DER ROUTE, gespiegelt: `bestand?.status === "validiert" && !can(user.role,
  // "users.manage")` → 403 `PROPOSAL_REQUIRED`. Gelesen wird `ko.status`, NICHT `deriveStatus(ko)`:
  // die Route liest den gespeicherten Wert, und eine Anzeigeableitung daneben wäre genau die zweite
  // Wahrheit, an der Fläche und API auseinanderlaufen.
  //
  // WARUM EINE ROLLENLISTE IM CLIENT UND WARUM SIE TROTZDEM KEINE ZWEITE WAHRHEIT IST: `can()` liegt
  // im rbac-Modul hinter einer Modulgrenze, die `apps/web` nicht überschreitet — dieselbe Lage und
  // dieselbe Bauform wie `RW_FREIGABE_ROLLEN` in `BibliothekLesen.tsx` (JOB 3667 R3). Gehalten wird
  // sie nicht von einer Abschrift, sondern von einer MESSUNG: `tests/wiki-nachvollziehen/
  // uebernahme-folgt-dem-schreibrecht.test.tsx` mountet die Fläche für JEDE Rolle und hält das
  // Ergebnis gegen `can(rolle, "users.manage")` aus dem echten Modul. Wer die Matrix ändert, wird
  // dort rot.
  //
  // NICHT `canReview` (controller + admin) wiederverwendet: das ist das Recht zu BEWERTEN, nicht das
  // Recht, einen freigegebenen Stand direkt zu ersetzen.
  const darfFreigegebenesDirektAendern = role === "admin";
  const uebernahmeGesperrt = ko.status === "validiert" && !darfFreigegebenesDirektAendern;

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
            {(ko.sources ?? []).map((s) => {
              // JOB 4095: DIESELBE ABLEITUNG WIE AUF DER PRÜFKARTE (`Validation.tsx:1590`) — die
              // Autorin, die hier liest, soll an der Quelle nicht WENIGER erfahren als der Prüfer.
              // Sie wird GERUFEN, nicht nachgebaut: keine zweite Zeitformatierung, keine zweite
              // Anker-Auflösung. Die Anhangsliste kommt aus dem BEREITS geladenen Objekt — keine
              // zweite Abfrage, und offline bleibt die Aussage tragfähig (dieselbe Hausregel wie am
              // Belegabschnitt weiter unten).
              const nachweis = quellennachweis(s, ko.attachments ?? [], i18n.language);
              return (
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
                        {/* WANN die Quelle ans Objekt kam — in der Kopfzeile, wie am Prüfchip.
                            KEINE NEUE BESCHRIFTUNG: ein Datum ist als Datum erkennbar, und ein nur
                            auf Deutsch existierendes Wort wäre schlimmer als keines.
                            Ohne lesbares `at` steht hier NICHTS (kein „Invalid Date", kein „—"). */}
                        {nachweis.zeit ? (
                          <span
                            data-testid="bib-quelle-zeit"
                            className="font-mono text-[10px] text-muted-2"
                          >
                            {nachweis.zeit}
                          </span>
                        ) : null}
                        {/* JOB 4360 — WELCHE FASSUNG DER QUELLE HIER ANGEKOMMEN IST.
                            Neben der Aufnahmezeit, weil beide dieselbe Frage beantworten („wie alt
                            ist das hier?") und ein Mensch sie zusammen liest: die Zeit sagt, WANN
                            die Quelle ans Objekt kam, der Stand sagt, WELCHE Fassung dabei
                            übernommen wurde. Nach einem Wiederholimport ändert sich der Stand, die
                            Zeit allein sagte darüber nichts.
                            DIE BESCHRIFTUNG STEHT DABEI, und sie ist die VORHANDENE (`w2.source.version`,
                            de/en/nl gepflegt): anders als ein Datum ist eine nackte Zahl nicht aus
                            sich heraus lesbar — „1757668500" ohne Wort davor wäre ein Rätsel. Eine
                            NEUE Beschriftung gibt es dafür nicht; der Import-Ergebnisbericht nennt
                            denselben Wert schon unter demselben Schlüssel (`lib/importResultView.ts`).
                            FEHLEN HEISST FEHLEN: eine Quelle ohne gespeicherten Stand zeigt hier
                            NICHTS — kein „—", keine geratene 1 (`lib/koSource.ts`, `quellstand`). */}
                        {nachweis.stand ? (
                          <span
                            data-testid="bib-quelle-stand"
                            className="font-mono text-[10px] text-muted-2"
                          >
                            {`${t("w2.source.version")} ${nachweis.stand}`}
                          </span>
                        ) : null}
                      </div>
                      {/* DIE DATEI, AUS DER DIE BELEGSTELLE STAMMT — unter dem Namen und damit
                          unmittelbar über der Adresse, dieselbe Reihenfolge wie an der Prüfkarte
                          (`Validation.tsx:1612-1619`). Der Name wird AUFGELÖST, nie an die Quelle
                          kopiert; ein kopierter Name würde durch eine Umbenennung des Anhangs zur
                          Lüge. FEHLEN HEISST FEHLEN: ohne Anker, ohne passenden Anhang oder ohne
                          brauchbaren Namen steht hier keine Zeile.
                          `break-all` statt `truncate`: ein Dateiname ist lang, und bei 360 px soll
                          er umbrechen statt abgeschnitten zu werden. */}
                      {nachweis.datei ? (
                        <span
                          data-testid="bib-quelle-datei"
                          className="mt-0.5 block break-all text-[11px] text-muted"
                        >
                          {nachweis.datei}
                        </span>
                      ) : null}
                      <ExternalUrlText
                        url={s.url}
                        className="block truncate font-mono text-[11px] text-ai hover:underline"
                      />
                      {s.excerpt ? (
                        <p className="mt-1 text-[12px] text-muted">{s.excerpt}</p>
                      ) : null}
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
              );
            })}
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
              {/* JOB 4213 · UND WOHER DIESER STAND KAM, WENN ER ZURÜCKGEHOLT WURDE. Der Vermerk
                  selbst bleibt unangetastet („überarbeitet", über den Katalog); die Herkunft ist ein
                  EIGENER Satz mit eigenem Schlüssel, weil sie eine Versionszahl trägt und ein
                  Vermerk mit Zahl durch den zeichengenauen Vermerkkatalog nicht hindurchkäme. Die
                  Zahl kommt über den EINEN Draht-Leser (`uebernahmeHerkunft`), denselben, den die
                  Fassungskarte unten benutzt. Der Rückfall auf den Autornamen bleibt Zeichen für
                  Zeichen: er gilt dem leeren Vermerk. */}
              <div data-bib-historie-vermerk={h.version} className="text-[12.5px] text-text">
                {koHistoryNote(h.note, t) || nameOf(h.author)}
                {((): JSX.Element | null => {
                  const herkunft = uebernahmeHerkunft(h);
                  return herkunft === null ? null : (
                    <span className="ml-1.5 text-muted">
                      {t("ko.snapshotRestoredFrom", { version: herkunft })}
                    </span>
                  );
                })()}
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
            <>
              {((): JSX.Element => {
                // ====================================================================================
                // JOB 4213 · ZWEI FREI GEWÄHLTE FASSUNGEN GEGENÜBERSTELLEN.
                // ====================================================================================
                //
                // ER STEHT ÜBER DER LISTE UND NICHT IN DER KARTE: verglichen werden ZWEI Fassungen,
                // keine von beiden ist der Ort dafür. (Und die geöffnete Karte bleibt damit frei von
                // Auswahlfeldern — `tests/ux28-fassungen/rueckweg-zur-aktuellen-fassung.test.tsx` C
                // nagelt fest, dass der historische Inhalt nicht bearbeitbar AUSSIEHT.)
                //
                // WENIGER ALS ZWEI FASSUNGEN: ein Satz, kein gesperrter Knopf und keine Auswahl mit
                // einem einzigen Eintrag (Muster des Belegleerstands `:1794-1800`). Dass es nichts zu
                // vergleichen gibt, ist hier eine WAHRE Aussage — die Liste ist erfolgreich geladen.
                if (zeilen.length < 2) {
                  return (
                    <p className="mb-3 text-[12.5px] text-muted">
                      {t("ko.snapshotCompareNeedsTwo")}
                    </p>
                  );
                }
                // ES GIBT KEINE VORBELEGUNG, und das ist eine Entscheidung gegen die bequemere
                // Bauform. Eine Vorauswahl (etwa „vorletzte gegen letzte") stellte beim blossen
                // Aufklappen des Abschnitts ungefragt zwei Fassungsinhalte nebeneinander —
                // einschliesslich eines alten Berichts, den niemand angefordert hat. Genau das
                // misst `tests/ux28-fassungen/fassung-per-tastatur-oeffnen.test.tsx` B als Fehler:
                // „der alte Bericht steht schon vor dem Öffnen da". Solange nicht BEIDE Fassungen
                // gewählt sind, steht hier deshalb nur, was zu tun ist.
                const vorhandene = zeilen.map((z) => z.version);
                const gewaehlt = (wahl: number | null): number | null =>
                  wahl !== null && vorhandene.includes(wahl) ? wahl : null;
                const von = gewaehlt(vergleichVon);
                const bis = gewaehlt(vergleichBis);
                const gegenueber =
                  von === null || bis === null ? null : paarDiff(fassungen, von, bis);
                const auswahl = (
                  welche: "von" | "bis",
                  wert: number | null,
                  setzen: (n: number | null) => void,
                ): JSX.Element => (
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    {t(welche === "von" ? "ko.snapshotCompareFrom" : "ko.snapshotCompareTo")}
                    {/* Ein natives `<select>`: Tabulator, Pfeiltasten und Eingabetaste wirken ohne
                        `tabIndex`-Nachbau und ohne Tastenbehandlung von Hand (Lehre `:1847-1863`). */}
                    <select
                      data-bib-fassung-vergleich={welche}
                      value={wert === null ? "" : String(wert)}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setzen(e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="rounded-btn border border-hairline bg-surface px-1.5 py-1 text-[12px] text-text"
                    >
                      {/* Der leere Eintrag ist der EHRLICHE Ausgangszustand: „noch nicht gewählt"
                          ist etwas anderes als „die neueste Fassung". */}
                      <option value="">{t("ko.snapshotCompareChoose")}</option>
                      {zeilen.map((z) => (
                        <option key={z.key} value={String(z.version)}>
                          {`v${z.version} · ${new Date(z.at).toLocaleDateString(i18n.language)}`}
                        </option>
                      ))}
                    </select>
                  </label>
                );
                return (
                  <div
                    data-bib-fassung-vergleich-flaeche
                    className="mb-3 rounded-input border border-hairline bg-surface p-2.5"
                  >
                    <div className="text-[12.5px] font-semibold text-text">
                      {t("ko.snapshotCompareTitle")}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      {auswahl("von", von, setVergleichVon)}
                      {auswahl("bis", bis, setVergleichBis)}
                    </div>
                    {von === null || bis === null ? (
                      // NOCH NICHTS GEWÄHLT — und deshalb steht hier auch keine Aussage über
                      // irgendein Fassungspaar, sondern der nächste Schritt.
                      <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareHint")}</p>
                    ) : gegenueber === null ? (
                      // WISSENSLÜCKE STATT ERFINDUNG: „keine Änderung" wäre hier eine Aussage über
                      // einen Stand, der gar nicht vorliegt. Erreichbar ist der Zweig nur, wenn eine
                      // gewählte Fassung zwischen Auswahl und Zeichnen aus dem Bestand fällt.
                      <p className="mt-2 text-[12.5px] text-muted">
                        {t("ko.snapshotCompareUnknown")}
                      </p>
                    ) : gegenueber.von === gegenueber.bis ? (
                      <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareSame")}</p>
                    ) : gegenueber.felder.length === 0 ? (
                      <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareNone")}</p>
                    ) : (
                      <dl className="mt-2 grid gap-2">
                        {gegenueber.felder.map((f) => {
                          // Die Werte kommen als GESPEICHERTE Werte aus `koVersionDiff.ts`; Art und
                          // Prüfstand sind dort Schlüssel. Eingesetzt werden sie über DIESELBEN
                          // Kataloge, die die Karte oben schon benutzt — kein zweites Verzeichnis.
                          const lesbar = (wert: string): JSX.Element =>
                            wert.length === 0 ? (
                              <span className="text-muted-2">{t("ko.snapshotFieldEmpty")}</span>
                            ) : f.feld === "type" ? (
                              <>{t(`ktype.${wert}`)}</>
                            ) : f.feld === "status" ? (
                              <>{t(`status.${wert}`)}</>
                            ) : f.feld === "bodyHtml" ? (
                              // DERSELBE EINE ZEICHENWEG wie am geöffneten Bericht (`:1962-1966`):
                              // kein `dangerouslySetInnerHTML`, keine zweite Allowlist.
                              <SanitizedHtml html={wert} className="prose-kw text-[12.5px]" />
                            ) : (
                              <>{wert}</>
                            );
                          return (
                            <div key={f.feld} data-bib-fassung-vergleich-feld={f.feld}>
                              <dt className="font-mono text-[10.5px] text-muted-2">
                                {t(`ko.snapshotField.${f.feld}`)}
                              </dt>
                              <dd className="mt-0.5 grid gap-1 text-[12.5px] text-text">
                                <div data-bib-vergleich-alt={f.feld}>
                                  <span className="mr-1 font-mono text-[10.5px] text-muted-2">
                                    {`v${gegenueber.von}`}
                                  </span>
                                  {lesbar(f.alt)}
                                </div>
                                <div data-bib-vergleich-neu={f.feld}>
                                  <span className="mr-1 font-mono text-[10.5px] text-muted-2">
                                    {`v${gegenueber.bis}`}
                                  </span>
                                  {lesbar(f.neu)}
                                </div>
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                );
              })()}
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
                    <li
                      key={v.key}
                      className="rounded-input border border-hairline bg-surface p-2.5"
                    >
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
                      {/* JOB 4213: der Vermerk und — wenn diese Fassung aus einer Übernahme entstand
                        — die Herkunft, in DEMSELBEN Satz wie in der Historie (`ko.snapshotRestoredFrom`).
                        Der Vermerk selbst bleibt der des Dienstes über den Katalog; die Herkunft
                        trägt eine Versionszahl und käme durch den zeichengenauen Vermerkkatalog
                        nicht hindurch. `v.herkunft` kommt aus `koVersionRows`, also aus demselben
                        Draht-Leser wie oben. */}
                      <p
                        data-bib-fassung-vermerk={v.key}
                        className="mt-1 font-mono text-[10.5px] text-muted-2"
                      >
                        {koHistoryNote(v.note, t)}
                        {v.herkunft === null
                          ? null
                          : ` · ${t("ko.snapshotRestoredFrom", { version: v.herkunft })}`}
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
                          {/* JOB 4213 · DER SATZ SAGT JETZT NUR NOCH, WAS WEITERHIN WAHR IST. Bis
                            hierher stand hier „nur lesbar" — als Auskunft über den ganzen Abschnitt.
                            Seit dieser Fassung kann ein Mensch den Stand zurückholen; „nur lesbar"
                            wäre damit eine Behauptung über einen Weg, den es gibt. Wahr bleibt, was
                            der Satz jetzt sagt: DIESE Fassung selbst ändert sich nicht — eine
                            Übernahme KOPIERT sie in eine neue, sie bewegt sie nicht. */}
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
                          {((): JSX.Element | null => {
                            // ============================================================================
                            // JOB 4213 · „ALS ARBEITSFASSUNG ÜBERNEHMEN" — DER WEG ZURÜCK.
                            // ============================================================================
                            //
                            // ER STEHT HINTER DEM RÜCKWEG, und das ist kein Schönheitsentscheid: der
                            // Rückweg muss der ERSTE Tabulatoranschlag hinter seiner Fassungskarte
                            // bleiben. Das ist am echten Browser gemessen und festgenagelt
                            // (`tests/ux28-fassungen/tastatur-im-browser-chromium.test.tsx` T4: „wer
                            // sie aufgemacht hat, tabbt EINEN Anschlag weiter und steht auf dem
                            // Rückweg"). Ein Übernahmeknopf davor schöbe sich dazwischen.
                            //
                            // VIER LAGEN, VIER EHRLICHE AUSKÜNFTE, und KEINE davon ist ein gesperrter
                            // Knopf ohne Erklärung (Muster `:1794-1800`):
                            //   · kein Bearbeitungsrecht  → der Satz sagt, warum hier nichts steht.
                            //   · freigegeben, und dieses Konto darf einen freigegebenen Stand nicht
                            //     direkt ersetzen → der Satz nennt den Grund UND den Weg, den es
                            //     gibt (JOB 4213 R3, BENs Korrekturpflicht 3).
                            //   · es IST der aktuelle Stand → es gibt nichts zurückzuholen, und der
                            //     Satz sagt genau das, statt einen Knopf anzubieten, der nichts ändert.
                            //   · der Schnappschuss dieser Fassung liegt nicht vor → kein Knopf, der
                            //     ins Leere griffe. Erreichbar ist das nicht, solange die Zeile aus
                            //     eben diesem Schnappschuss entsteht; der Zweig behauptet nichts
                            //     anderes, als dass ohne Inhalt nichts übernommen wird.
                            const stand = fassungen.find((f) => f.version === v.version)?.snapshot;
                            const lage =
                              uebernahmeLage?.version === v.version ? uebernahmeLage : null;
                            const laeuft =
                              fassungUebernehmen.isPending &&
                              fassungUebernehmen.variables?.version === v.version;
                            if (!canEdit) {
                              return (
                                <p className="mt-2 text-[12.5px] text-muted">
                                  {t("ko.snapshotRestoreNoRight")}
                                </p>
                              );
                            }
                            if (uebernahmeGesperrt) {
                              return (
                                <p
                                  data-bib-fassung-uebernahme-gesperrt={v.key}
                                  className="mt-2 text-[12.5px] text-muted"
                                >
                                  {t("ko.snapshotRestoreNeedsRelease")}
                                </p>
                              );
                            }
                            if (v.version >= ko.version) {
                              return (
                                <p className="mt-2 text-[12.5px] text-muted">
                                  {t("ko.snapshotRestoreIsCurrent")}
                                </p>
                              );
                            }
                            if (!stand) {
                              return (
                                <p className="mt-2 text-[12.5px] text-muted">
                                  {t("ko.snapshotRestoreNoContent")}
                                </p>
                              );
                            }
                            return (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  data-bib-fassung-uebernehmen={v.key}
                                  // Der zugängliche Name nennt die Fassung UND was aus dem Klick wird —
                                  // sonst hörte ein Vorleseprogramm bei zehn Karten zehnmal dasselbe
                                  // Wort (Muster `:1924-1927`).
                                  aria-label={`v${v.version} — ${t("ko.snapshotRestore")} · ${t("ko.snapshotRestoreHint")}`}
                                  // GESPERRT NUR, SOLANGE DIESER SCHREIBVORGANG LÄUFT. Es ist die eine
                                  // Lage, in der ein zweiter Druck wirklich schadet: aus zwei Aufrufen
                                  // entstünden zwei Fassungen. Der Knopf sagt dabei, was los ist — er
                                  // steht nicht stumm da.
                                  disabled={laeuft}
                                  onClick={() => uebernahmeStarten(v.version)}
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text disabled:cursor-default disabled:text-muted-2"
                                >
                                  {laeuft
                                    ? t("ko.snapshotRestoreRunning")
                                    : t("ko.snapshotRestore")}
                                </button>
                                {/* DIE AUSKUNFT STEHT IN EINER LIVE-REGION: wer mit einem
                                    Vorleseprogramm arbeitet, erführe sonst nichts vom Ausgang. Die
                                    Bauform ist die des Hauses — ein `<output aria-live="polite">`
                                    wie am Diskussionsfehler (`:2488`), kein `role="status"` an einem
                                    `<div>`. */}
                                {lage === null ? null : (
                                  <output
                                    aria-live="polite"
                                    data-bib-fassung-uebernahme-lage={v.key}
                                    className={cx(
                                      "mt-1.5 block text-[12.5px]",
                                      lage.art === "fertig"
                                        ? "text-trust-pos-text"
                                        : lage.art === "offline"
                                          ? "text-muted"
                                          : "text-trust-crit-text",
                                    )}
                                  >
                                    {lage.art === "fertig"
                                      ? t("ko.snapshotRestoreDone", { version: lage.version })
                                      : lage.art === "offline"
                                        ? t("ko.snapshotRestoreOffline")
                                        : lage.art === "stale"
                                          ? t("ko.snapshotRestoreStale")
                                          : lage.text}
                                  </output>
                                )}
                                {/* KEIN NEULADEN (Korrekturpflicht JOB 4146 R6/R7): der einzige Weg
                                    nach einem Konflikt erhält die Absicht — dieselbe Fassung, bezogen
                                    auf den Stand, der JETZT wirklich gespeichert ist. Er steht
                                    NEBEN dem Satz und ist ein AUSDRÜCKLICHER zweiter Griff; eine
                                    frisch gelesene Versionszahl allein rechtfertigt kein
                                    Überschreiben (Lehre JOB 4163 R1). */}
                                {lage?.art === "stale" ? (
                                  <button
                                    type="button"
                                    data-bib-fassung-uebernehmen-erneut={v.key}
                                    aria-label={`v${v.version} — ${t("ko.snapshotRestoreAgain")}`}
                                    onClick={() => uebernahmeStarten(v.version)}
                                    className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                                  >
                                    {t("ko.snapshotRestoreAgain")}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          );
        })()}
      </Abschnitt>

      {/* 11 — Diskussion (bis JOB 4146: eine flache Kommentarliste) */}
      <Abschnitt
        schluessel="kommentare"
        titel={t("ko.diskussion.titel")}
        offen={offene.has("kommentare")}
        aufWechsel={(o) => abschnittUmschalten("kommentare", o)}
      >
        {diskussionsFaeden.length === 0 ? (
          // §9: der Leersatz gilt NUR nach einem erfolgreichen Abruf — dieser Abschnitt wird erst
          // gezeichnet, wenn das Wissensobjekt geladen ist (`BibliothekLesen`), und behauptet
          // deshalb nie „keine Beiträge", bevor jemand nachgesehen hat.
          <p className="text-[12.5px] text-muted">{t("ko.commentsEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {diskussionsFaeden.map((faden) => {
              const wurzel = faden.wurzel;
              const erledigt = wurzel.resolution?.state === "erledigt";
              return (
                <li
                  key={wurzel.id}
                  data-bib-diskussion-beitrag={wurzel.id}
                  className="border-l-2 border-hairline pl-3"
                >
                  {beitragsInhalt(wurzel)}
                  {wurzel.resolution ? (
                    <div
                      data-bib-diskussion-klaerung={wurzel.id}
                      className="mt-1 text-[11px] font-semibold text-muted"
                    >
                      {t(
                        erledigt ? "ko.diskussion.erledigtVon" : "ko.diskussion.wiederGeoeffnetVon",
                        {
                          name: nameOf(wurzel.resolution.by),
                          datum: new Date(wurzel.resolution.at).toLocaleDateString(i18n.language),
                        },
                      )}
                    </div>
                  ) : null}
                  {/* Antworten stehen IM Bezugsbeitrag, nicht daneben: der Faden ist die Struktur,
                      nicht die Sortierung. */}
                  {faden.antworten.length > 0 ? (
                    <ul className="mt-2 space-y-2 border-l border-hairline-soft pl-3">
                      {faden.antworten.map((a) => (
                        <li key={a.id} data-bib-diskussion-beitrag={a.id}>
                          {beitragsInhalt(a)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-bib-diskussion-antworten={wurzel.id}
                      // ÖFFNEN IST KEIN AUFRÄUMEN: der Entwurf dieses Fadens bleibt stehen, auch
                      // beim zweiten Klick und nach einem Ausflug in einen anderen Faden.
                      onClick={() => {
                        setAntwortAn(wurzel.id);
                        setDiskussionsFehler(null);
                      }}
                      className={diskussionsKnopfCls}
                    >
                      {t("ko.diskussion.antworten")}
                    </button>
                    {erledigt ? (
                      <button
                        type="button"
                        data-bib-diskussion-oeffnen={wurzel.id}
                        disabled={klaerung.isPending}
                        onClick={() => klaerung.mutate({ commentId: wurzel.id, erledigt: false })}
                        className={diskussionsKnopfCls}
                      >
                        {t("ko.diskussion.wiederOeffnen")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-bib-diskussion-erledigen={wurzel.id}
                        disabled={klaerung.isPending}
                        onClick={() => klaerung.mutate({ commentId: wurzel.id, erledigt: true })}
                        className={diskussionsKnopfCls}
                      >
                        {t("ko.diskussion.alsGeklaertMarkieren")}
                      </button>
                    )}
                  </div>
                  {antwortAn === wurzel.id ? (
                    <div className="mt-2 space-y-2">
                      {/* KEIN `placeholder`: die Beschriftung steht als `aria-label` am Feld. Der
                          Abschnitt trägt genau EINEN Platzhalter — den des neuen Beitrags
                          (`tests/bibliothek-mehr-platzhalter`), und ein zweiter wäre an dieser
                          Stelle auch fachlich nur eine flüchtige Beschriftung. */}
                      <textarea
                        data-bib-diskussion-antwortfeld={wurzel.id}
                        aria-label={t("ko.diskussion.antwortAn", { name: nameOf(wurzel.author) })}
                        value={antwortEntwurf(wurzel.id)}
                        onChange={(e) => antwortSetzen(wurzel.id, e.target.value)}
                        rows={2}
                        className={textareaCls}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          data-bib-diskussion-antwortsenden={wurzel.id}
                          disabled={
                            antwort.isPending || antwortEntwurf(wurzel.id).trim().length === 0
                          }
                          onClick={() =>
                            antwort.mutate({
                              bezug: wurzel.id,
                              gesendet: antwortEntwurf(wurzel.id).trim(),
                            })
                          }
                        >
                          {t("ko.diskussion.antwortSenden")}
                        </Button>
                        <Button variant="ghost" onClick={() => setAntwortAn(null)}>
                          {t("ko.diskussion.antwortAbbrechen")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          <textarea
            value={commentText}
            onChange={(e) => beitragSetzen(e.target.value)}
            rows={2}
            placeholder={t("ko.commentPlaceholder")}
            className={textareaCls}
          />
          <Button
            variant="primary"
            data-bib-diskussion-senden=""
            disabled={comment.isPending || commentText.trim().length === 0}
            onClick={() => comment.mutate(commentText.trim())}
          >
            {t("ko.commentAdd")}
          </Button>
        </div>
        {/* Der Satz steht am ENDE des Abschnitts und bleibt stehen, bis der nächste Versuch
            gelingt — anders als ein Toast, der verschwindet, während der Text noch im Feld wartet.
            Der Weg zurück steht DANEBEN und nicht im Satz: eine Handlungsanweisung, die den
            erhaltenen Text kostet, wäre schlechter als keine (R6). */}
        {diskussionsFehler ? (
          <div className="mt-2 space-y-1">
            <output
              aria-live="polite"
              data-testid="bib-diskussion-fehler"
              className="block text-[12.5px] text-trust-crit-text"
            >
              {diskussionsFehler}
            </output>
            {letzterFehlschlag ? (
              <Button
                variant="ghost"
                data-bib-diskussion-erneut=""
                disabled={comment.isPending || antwort.isPending}
                onClick={() => erneutSenden()}
              >
                {t("ko.diskussion.erneutSenden")}
              </Button>
            ) : null}
          </div>
        ) : null}
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
