import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  FilePlus2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useDrafts, useKos, useLibrarySearch } from "../api/hooks";
import type { AnswerResult } from "../api/types";
import {
  GuardedLink,
  NavGuardSaveError,
  useNavGuard,
  useUnloadGuard,
} from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { HOME_ROUTE } from "../app/navigation";
import {
  type NeuerVorgang,
  type SyncResult,
  type VorgangMitStand,
  useOfflineQueue,
} from "../app/useOfflineQueue";
// WP-UX-WOW-1 U1: Antwort-Markdown sicher rendern (React-Subset, kein HTML-Sink).
import { AnswerMarkdown } from "../components/AnswerMarkdown";
// JOB 3786: die Seitenhilfe dieser Fläche. `HelpTip` ZEICHNET NICHTS — er meldet Titel und Text
// beim Sammler an (`shell/SeitenhilfeContext.tsx`), und das Zahnrad-Menü listet sie unter
// „Seitenhilfe". Pedi (04.09.): „Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld."
import { HelpTip } from "../components/HelpTip";
import { ConfidenceBar, KnowledgeTypeTag, StatusPill } from "../components/trust";
import { selectAnswer } from "../lib/askResponse";
import { deriveStatus } from "../lib/displayStatus";
import {
  type DraftFeld,
  type DraftFormState,
  EMPTY_DRAFT_FORM,
  abweichendeFelder,
  draftTitle,
  draftToForm,
  formToPayload,
  formToUpdate,
  isDraftFormChanged,
  isDraftFormFillable,
} from "../lib/draftForm";
import { conflictKnowledge } from "../lib/effectiveAnswer";
import type { EvidenceTone } from "../lib/knowledgeClass";
// D-036 (JOB 1118): derselbe Dreiphasenvertrag, den Start und Analytics schon fahren —
// `loading | loaded | error`. Er ist der Grund, warum unten keine Leerbehauptung mehr aus
// fehlenden Daten entsteht und ein dauerhaft gescheiterter Abruf nicht als „lädt" endet.
import { isGroupError, isGroupLoading } from "../lib/loadingState";
import { summarizeAnswer } from "../lib/mobileAsk";
import {
  type ConfirmState,
  NO_CONFIRM,
  clearConfirm,
  isPending,
  requestConfirm,
} from "../lib/mobileConfirm";
import type { QueueStatus } from "../lib/offlineQueue";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";

type MobileTab = "capture" | "ask" | "lookup";

const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  neutral: "bg-page text-muted",
};

const QUEUE_TONE: Record<QueueStatus, string> = {
  queued: "bg-page text-muted",
  pending: "bg-trust-warn-bg text-trust-warn-text",
  synced: "bg-trust-pos-bg text-trust-pos-text",
  failed: "bg-trust-crit-bg text-trust-crit-text",
};

// ================================================================================================
// JOB 4193 — DER VERALTETE STAND FRAGT NACH, STATT STILL ZU ÜBERSCHREIBEN.
// ================================================================================================
//
// Die LAGE der Rückfrage folgt dem Zustandsmodell und nicht der Bequemlichkeit: solange der
// Serverstand geholt wird, sagt die Fläche, dass sie ihn holt; scheitert das Holen, behauptet sie
// den Vergleich NICHT (weder „kein Unterschied" noch eine Rückfrage auf halbem Datenstand);
// und findet der Vergleich nichts, schweigt sie ganz.
type StandLage =
  | { art: "laedt" }
  | { art: "fehler" }
  | {
      art: "unterschied";
      /** Die Fassung, die JETZT auf dem Server steht — frisch geholt, nicht aus dem Listen-Cache. */
      server: DraftFormState;
      /** Ihr Stand. Gegen ihn schreibt der nächste Versuch. */
      serverStand: string;
      felder: DraftFeld[];
    };

interface StandKonflikt {
  entwurfId: string;
  /**
   * `speichern` · der Server hat den Aktualisierungsversuch mit 409 DRAFT_STALE abgewiesen.
   * `wiedereroeffnen` · für diesen Entwurf liegt noch eine offline gespeicherte Fassung.
   */
  quelle: "speichern" | "wiedereroeffnen";
  /** Der offline liegende Vorgang — nur beim Wiederöffnen, sonst `null`. */
  opId: string | null;
  /** Die offline gespeicherte Fassung, damit der Kasten BEIDE nebeneinander zeigen kann. */
  offline: DraftFormState | null;
  lage: StandLage;
}

/** Was im Textfeld steht — dieselbe Unterscheidung wie `bodyMode` (JOB 3377). */
function formText(form: DraftFormState): string {
  return form.segments !== undefined ? (form.body ?? "") : form.statement;
}

/**
 * JOB 4193 R6: „Dieser Entwurf soll aktualisiert werden, aber es gibt keine Voraussetzung, gegen
 * die das gelten könnte." Kein Fehler des Servers und keiner des Menschen — ein Zustand, aus dem
 * heraus nicht geschrieben werden DARF, weil der Schreibvorgang sonst eine fremde Fassung
 * überschreibt, von der die Fläche nichts weiss. Er endet nicht in einer Meldung, sondern im
 * Vergleich (s. `speicherfehler`).
 */
class StandFehltError extends Error {
  constructor() {
    super("Kein gesehener Stand — es wird zuerst verglichen.");
    this.name = "StandFehltError";
  }
}

// SCRUM-113: echte mobile Erfassung (FE-MOB-02/04/06) + Fragen (FE-MOB-03) + Wissenszugriff
// (FE-MOB-05) + PWA/Offline-Queue (FE-MOB-01/07). Offline werden nur Draft-Saves gequeued;
// Ask/Library zeigen offline eine ehrliche Meldung (kein Fake-Offline).
export function Mobile(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  // WP-SAMMEL20-FIX (bens Fix 4, B1b): der Rückweg führt zur VORHERIGEN Route zurück (die der
  // Topbar-Hinweg als state.from mitgibt) — nur bei Direkteinstieg (Deep-Link/Reload ohne State)
  // fällt er auf die Startseite zurück.
  const backTo = (location.state as { from?: string } | null)?.from ?? HOME_ROUTE;
  const { setGuard, guard } = useNavGuard();
  const [tab, setTab] = useState<MobileTab>("capture");

  const notifySync = (r: SyncResult): void => {
    // JOB 4193: „durfte nicht überschreiben" ist etwas anderes als „ging nicht raus" — und der
    // Satz sagt auch, wo es weitergeht (beim Wiederöffnen des Entwurfs).
    if (r.stale > 0) {
      push("error", `${t("mob.stand.syncAbgewiesen")} (${r.stale})`);
    }
    // JOB 4193 R5: Reste ohne Voraussetzung werden weder gesendet noch gelöscht — und das wird
    // gesagt, statt sie stumm liegen zu lassen.
    if (r.ohneVoraussetzung > 0) {
      push("error", `${t("mob.stand.syncBrauchtStand")} (${r.ohneVoraussetzung})`);
    }
    if (r.failed > 0) {
      push("error", `${t("mob.syncFail")} (${r.failed})`);
    } else if (r.synced > 0) {
      push("success", `${t("mob.syncOk")} (${r.synced})`);
    }
  };
  const queue = useOfflineQueue(notifySync);

  // --- Erfassen (FE-MOB-02/04) ---
  const drafts = useDrafts();
  const [form, setForm] = useState<DraftFormState>({ ...EMPTY_DRAFT_FORM });
  const [baseline, setBaseline] = useState<DraftFormState>({ ...EMPTY_DRAFT_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const isDirty = isDraftFormChanged(form, baseline);
  // JOB 4193: der Standvergleich läuft ASYNCHRON (er holt den Serverstand nach). Ohne diesen Ref
  // vergliche er gegen den Formularstand von vor dem Absenden — wer während des Speicherns
  // weitergetippt hat, bekäme eine Feldangabe über einen Text, der so nicht mehr im Feld steht.
  const formRef = useRef(form);
  formRef.current = form;
  const [konflikt, setKonflikt] = useState<StandKonflikt | null>(null);
  /**
   * Die eigene Fassung, die „Neuen Stand holen" aus dem Feld verdrängt hat. Sie bleibt SICHTBAR,
   * bis der Mensch sie ausdrücklich verwirft — ein Ausweg, der den eigenen Text wegwirft, ist
   * kein Ausweg.
   */
  const [beiseite, setBeiseite] = useState<{ titel: string; text: string } | null>(null);
  const resetForm = (): void => {
    setForm({ ...EMPTY_DRAFT_FORM });
    setBaseline({ ...EMPTY_DRAFT_FORM });
    setEditingId(null);
    setKonflikt(null);
  };
  const invalidateDrafts = (): void => void qc.invalidateQueries({ queryKey: ["drafts"] });
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  // ============================================================================================
  // JOB 3377 — DAS HANDY BEARBEITET DENSELBEN TEXT WIE DIE VOLLVERSION.
  // ============================================================================================
  //
  // DER BEFUND (A08): eine am Handy gespeicherte Ergänzung war am Desktop nicht da. Das Handy
  // schrieb `statement`, der Desktop-Editor zeigt `bodyHtml` (`Capture.tsx`, `setBodyHtml(p.bodyHtml ?? "")`
  // — z. Zt. :2146) — zwei Felder, zwei Wahrheiten, und der partielle Merge liess den alten Body
  // pflichtgemäss stehen.
  //
  // AB HIER GIBT ES NUR EINEN TEXT: trägt der fortgesetzte Entwurf einen Body, steht seine
  // Textfassung im Feld unten, und beim Speichern geht er als `bodyHtml` zurück — Bilder, Tabellen
  // und Auszeichnung wörtlich an ihrem Platz (`draftBodyFromText`). Der Desktop braucht dafür KEINE
  // Änderung.
  //
  // Der Schalter dafür ist `form.segments` und NICHTS daneben: er reist im Formularzustand mit,
  // damit es keinen Speicherweg geben kann, der ihn vergisst (s. `formToPayload`).
  const bodyMode = form.segments !== undefined;

  // JOB 4193: der Anzeigetitel wird jetzt zu einer ÜBERGEBENEN Fassung gebildet und nicht mehr nur
  // zum aktuellen Formular — die Auflösung eines Konflikts beschriftet den Warteschlangeneintrag
  // mit genau der Fassung, die der Mensch gewählt hat.
  const titelVon = (f: DraftFormState): string =>
    f.title.trim() || formText(f).trim().slice(0, 60) || t("capture.draftFallbackTitle");

  // ============================================================================================
  // JOB 4193 — EIN AKTUALISIERUNGSWEG FÜR BEIDE KNÖPFE, UND EIN EHRLICHER AUSGANG.
  // ============================================================================================
  //
  // Der Vorgang wird an genau einer Stelle gebaut (`formToUpdate`) und trägt den gesehenen Stand
  // NEBEN der Nutzlast. Der Formularstand reist als MUTATIONSVARIABLE mit und wird nicht aus dem
  // Abschluss gelesen: der Weg „Meine Fassung behalten" schickt eine Fassung mit FRISCHEM Stand
  // los, und ein `setForm` davor wäre zum Absendezeitpunkt noch nicht angekommen.
  // ============================================================================================
  // JOB 4193 R6, BENs Korrekturpflicht 1 — DER ENGPASS SELBST VERWEIGERT DAS UNGESCHÜTZTE SCHREIBEN.
  // ============================================================================================
  //
  // DER BEFUND (BEN R5): die Sperre aus R5 hing am KONFLIKTZUSTAND (`konflikt !== null`). Ein alter
  // Warteschlangeneintrag OHNE `seenUpdatedAt`, OFFLINE geöffnet, setzt diesen Zustand aber auf
  // `null` — es gibt ja nichts zu vergleichen, solange keine Verbindung besteht. Wer danach online
  // ging und speicherte, schrieb ohne Voraussetzung: gemessen `Handy nach Wiederöffnung` statt
  // `Fassung Desktop`, über den Knopf UND über den Weggeh-Wächter.
  //
  // DIE LEHRE: eine Sperre, die einen ZUSTAND DANEBEN abfragt, deckt nur die Wege ab, an die man
  // gedacht hat. Die Bedingung gehört an die Stelle, an der geschrieben wird. `sendeEntwurf` ist
  // der EINZIGE Ort, der `drafts.update` ruft — hier kann kein Aufrufer mehr vorbei, auch kein
  // künftiger. Fehlt die Voraussetzung, wird nicht geschrieben, sondern der Vergleich ANGESTOSSEN
  // (`speicherfehler` → `konfliktOeffnen`): dieselbe eine Konfliktlogik, kein zweiter Mechanismus.
  const sendeEntwurf = (f: DraftFormState): Promise<unknown> => {
    const { payload, expectedUpdatedAt } = formToUpdate(f);
    if (!editingId) {
      return endpoints.drafts.create(payload);
    }
    if (!expectedUpdatedAt) {
      return Promise.reject(new StandFehltError());
    }
    return endpoints.drafts.update(editingId, payload, { expectedUpdatedAt });
  };

  /**
   * Derselbe Vorgang für die Warteschlange — aus DERSELBEN Funktion. Sonst gäbe es zwei Orte, an
   * denen der gesehene Stand vergessen werden kann, und der offline gespeicherte Vorgang ginge
   * beim Nachsenden wieder nach „letzter Schreiber gewinnt" raus.
   */
  const neuerVorgang = (f: DraftFormState): NeuerVorgang => {
    const { payload, expectedUpdatedAt } = formToUpdate(f);
    return {
      id: crypto.randomUUID(),
      kind: editingId ? "draft.update" : "draft.create",
      draftId: editingId,
      payload,
      title: titelVon(f),
      createdAt: new Date().toISOString(),
      ...(expectedUpdatedAt ? { seenUpdatedAt: expectedUpdatedAt } : {}),
    };
  };

  /**
   * Genau EIN selbsttätiger zweiter Versuch je Klick. Er greift nur im Fall „der Entwurf hat sich
   * geändert, aber in keinem Feld, das hier zu sehen ist" — eine Rückfrage ohne Unterschied wäre
   * eine Frage ohne Gegenstand (Zustandsmodell §9), und ein unbegrenzter Nachschlag wäre eine
   * Schleife.
   */
  const wiederholtRef = useRef(false);

  const save = useMutation({
    mutationFn: sendeEntwurf,
    onSuccess: () => {
      invalidateDrafts();
      push("success", editingId ? t("mob.updated") : t("mob.saved"));
      setBeiseite(null);
      resetForm();
    },
    onError: (e: unknown) => void speicherfehler(e),
  });

  /**
   * JOB 4193 Lieferung 4 (Lehre JOB 4153 R2, 15.09.): DREI Ausgänge, drei verschiedene Sätze.
   *
   *   409 DRAFT_STALE      · der Entwurf ist inzwischen woanders geändert → Rückfrage, nichts
   *                          überschrieben, nichts zurückgesetzt.
   *   kein ApiError/TIMEOUT · die Antwort fehlt. Ob gespeichert wurde, WEISS die Fläche nicht —
   *                          also behauptet sie weder das eine noch das andere.
   *   sonst                 · der Server hat ausdrücklich abgelehnt und gesagt, warum.
   */
  const speicherfehler = async (e: unknown): Promise<void> => {
    const id = editingId;
    // JOB 4193 R6: FEHLENDE VORAUSSETZUNG ist kein Fehler, sondern ein Auftrag — hole den Stand und
    // vergleiche. Danach steht entweder die Rückfrage (Unterschied) oder es wird gegen den frischen
    // Stand gespeichert (kein Unterschied). Geschrieben wird in keinem Fall ungeprüft.
    // JOB 4193 R6: OHNE VORAUSSETZUNG WIRD GEFRAGT, NICHT GERATEN.
    //
    // Ich habe hier zuerst versucht, die Rückfrage zu vermeiden, indem der Stand, mit dem das
    // Formular geöffnet wurde, gegen den Server gehalten wird — „hat jemand ANDERES geschrieben?".
    // Das trägt nicht: dieser Fall entsteht nur bei einem Altvorgang, und dessen Nutzlast ist
    // PARTIELL (sie führt nur die Felder, die das Handy schreibt). Eine daraus gebaute Grundlage
    // hat dort leere Felder, wo der Entwurf längst Inhalt hat — der Vergleich meldete prompt einen
    // Unterschied im Titel, den es gar nicht gab. Gemessen im eigenen Lauf 0663f3eb…
    //
    // Es gibt für diesen Vorgang also KEINEN verlässlichen Maßstab. Dann wird gefragt: die Fläche
    // legt beide Fassungen nebeneinander und lässt den Menschen entscheiden, statt eine
    // Gleichheit zu behaupten, die sie nicht prüfen kann.
    if (id && e instanceof StandFehltError) {
      await konfliktOeffnen(id, "speichern", null);
      return;
    }
    if (id && e instanceof ApiError && e.status === 409 && e.code === "DRAFT_STALE") {
      await konfliktOeffnen(id, "speichern", null);
      return;
    }
    if (!(e instanceof ApiError) || e.code === "TIMEOUT") {
      push("error", t("mob.ausgangUnklar"));
      return;
    }
    push("error", e.message);
  };

  /**
   * Den Serverstand FRISCH holen und gegen die eigene Fassung halten. Der Listen-Cache taugt dafür
   * nicht: er kann selbst der veraltete Stand sein, gegen den hier gerade abgewiesen wurde.
   */
  const konfliktOeffnen = async (
    id: string,
    quelle: StandKonflikt["quelle"],
    op: VorgangMitStand | null,
  ): Promise<void> => {
    const offline = op ? draftToForm({ payload: op.payload }) : null;
    const rumpf = { entwurfId: id, quelle, opId: op?.id ?? null, offline };
    setKonflikt({ ...rumpf, lage: { art: "laedt" } });
    let frisch: Awaited<ReturnType<typeof endpoints.drafts.get>>;
    try {
      frisch = await endpoints.drafts.get(id);
    } catch {
      // Der Vergleich wird NICHT behauptet — weder in die eine noch in die andere Richtung.
      setKonflikt({ ...rumpf, lage: { art: "fehler" } });
      return;
    }
    const server = draftToForm(frisch);
    const meins = offline ?? formRef.current;
    const felder = abweichendeFelder(meins, server);
    if (felder.length > 0) {
      setKonflikt({
        ...rumpf,
        lage: { art: "unterschied", server, serverStand: frisch.updatedAt, felder },
      });
      return;
    }
    // KEIN sichtbarer Unterschied. Beim Wiederöffnen heisst das: schweigen und weiterschreiben.
    setKonflikt(null);
    const neu: DraftFormState = { ...meins, gesehenerStand: frisch.updatedAt };
    setForm(neu);
    setBaseline(neu);
    setEditingId(id);
    if (op) {
      queue.replace(op.id, formToPayload(neu), titelVon(neu), frisch.updatedAt);
      return;
    }
    // Beim SPEICHERN heisst es: der fremde Schreiber hat etwas geändert, das dieses Formular gar
    // nicht führt (z. B. Schlagworte). Der partielle Merge lässt das stehen — also noch einmal
    // gegen den frischen Stand senden, statt den Menschen mit einer leeren Frage aufzuhalten.
    if (wiederholtRef.current) {
      push("error", t("mob.ausgangUnklar"));
      return;
    }
    wiederholtRef.current = true;
    save.mutate(neu);
  };

  // FE-MOB-07: offline → in die lokale Queue statt direkter API-Aufruf.
  //
  // JOB 4193: die Warteschlange trägt den gesehenen Stand jetzt MIT (`seenUpdatedAt`,
  // app/useOfflineQueue.ts) und gibt ihn beim Nachsenden als `expectedUpdatedAt` weiter. Der alte
  // Satz „letzter Schreiber gewinnt" gilt hier damit nicht mehr; ein inzwischen fremd geänderter
  // Entwurf weist das Nachsenden ab (409 DRAFT_STALE, der Vorgang bleibt in der Warteschlange
  // stehen) und wird beim Wiederöffnen dieses Entwurfs mit dem Menschen aufgelöst (`resume`).
  // ============================================================================================
  // JOB 4193 R5, BENs Korrekturpflicht 2 — EIN UNGELÖSTER VERGLEICH SPERRT JEDEN SCHREIBWEG.
  // ============================================================================================
  //
  // DER BEFUND (BEN R4): bei sichtbarer Rückfrage blieb der normale Speicherknopf bedienbar. Wer
  // ihn drückte, schrieb an der Rückfrage VORBEI — gemessen: `Fassung Handy` statt
  // `Fassung Desktop`, ohne dass ein Konfliktweg gewählt wurde. Dieselbe Lücke gilt für die beiden
  // Zwischenlagen, in denen noch gar kein Vergleich vorliegt: während der Serverstand GEHOLT wird
  // (`laedt`) und wenn das Holen GESCHEITERT ist (`fehler`).
  //
  // DIE REGEL IST EINE, NICHT DREI: solange ein Konfliktzustand steht, schreibt kein Weg. Der
  // Mensch entscheidet zuerst — genau das ist die Zusage dieses Auftrags („die Maschine zeigt nur,
  // was auseinanderläuft"). Die Sperre hängt am Zustand und nicht am Knopf, damit sie für Tastatur,
  // Klick im selben Tick und den Weggeh-Wächter gleichermassen gilt (Bauform wie `verlassenGesperrt`
  // in Capture.tsx, JOB 3526/3572).
  const schreibenGesperrt = konflikt !== null;

  const onSave = (): void => {
    if (schreibenGesperrt) {
      push("error", t("mob.stand.erstAufloesen"));
      return;
    }
    wiederholtRef.current = false;
    if (!queue.online) {
      queue.enqueue(neuerVorgang(form));
      push("info", t("mob.queued"));
      setBeiseite(null);
      resetForm();
      return;
    }
    save.mutate(form);
  };

  // WP-SAMMEL20-FIX bleibt erhalten: der bestehende NavGuard schützt ungespeicherte Eingaben und
  // speichert über den normalen Draft-Weg (offline: die Offline-Queue).
  // JOB 3463: Anlass ist der Nutzerbefund vom 08.09.2026 — bloßes Fortsetzen fragte fälschlich nach
  // Verwerfen; deshalb gilt jetzt „verändert gegenüber dem Ausgangsstand“ statt „befüllt“.
  // Neue Eingaben vergleichen gegen das leere Formular und bleiben geschützt.
  // Bewusst OHNE Dep-Array: jeder Render meldet den frischen Stand (setGuard ist ein Ref-Setter).
  //
  // JOB 4193 Lieferung 4: DERSELBE Aktualisierungsweg wie am Knopf — `sendeEntwurf` baut den
  // Vorgang, `speicherfehler` deutet den Ausgang. Zwei Speicherwege, die sich in der Frage „was
  // ist eigentlich passiert?" unterscheiden, sind genau die Halbheit, gegen die dieser Auftrag
  // steht. Der Fehler wird danach WEITERGEWORFEN: der Wächterdialog bleibt offen, es wird nicht
  // gewechselt, und die Rückfrage steht auf der Seite, die man gerade behalten hat.
  useEffect(() => {
    setGuard({
      isDirty: () => isDirty,
      save: async () => {
        // JOB 4193 R5 (BEN Korrekturpflicht 2): auch der Weggeh-Wächter schreibt nicht an einer
        // ungelösten Rückfrage vorbei. Der GRUND reist in der Hülle mit (`NavGuardSaveError`,
        // JOB 3572 R2) — der Dialog liegt über der gesperrten Seite, ein Satz im Fehlerkasten der
        // Fläche wäre für Tastatur und Vorlesehilfe nicht vorhanden. Der Dialog bleibt offen, es
        // wird nicht gewechselt, und nichts wird geschrieben.
        if (schreibenGesperrt) {
          throw new NavGuardSaveError(t("mob.stand.erstAufloesen"));
        }
        wiederholtRef.current = false;
        if (!queue.online) {
          // Vor dem anschließenden Seitenwechsel muss auch der Persistenzeffekt der Queue laufen.
          // Sonst kann React enqueue und Navigation bündeln und Mobile vorher aushängen.
          flushSync(() => {
            queue.enqueue(neuerVorgang(form));
          });
          push("info", t("mob.queued"));
          setBeiseite(null);
          resetForm();
          return;
        }
        try {
          await sendeEntwurf(form);
        } catch (e) {
          await speicherfehler(e);
          // JOB 4193 R6: fehlt die Voraussetzung, steht jetzt der Vergleich auf der Fläche. Der
          // Dialog sagt das mit demselben Satz wie die Sperre — und wechselt nicht, damit der
          // Mensch die Rückfrage auch sieht.
          throw e instanceof StandFehltError
            ? new NavGuardSaveError(t("mob.stand.erstAufloesen"))
            : e;
        }
        invalidateDrafts();
        setBeiseite(null);
        resetForm();
      },
    });
    return () => setGuard(null);
  });

  // AUFTRAG-mega14 Block B (bens SB-2, mein O-3 aus mega13): der In-App-Wächter oben fängt nur
  // SPA-Navigation. Neuladen, Tab-Schließen und ein Dokumentwechsel liefen hier bis eben still an
  // ihm vorbei — derselbe Datenverlusttyp, den der History-Wächter gerade schließt. Es ist DIESELBE
  // Vorrichtung wie in Erfassen (`Capture.tsx:1790`) und Vordertür (`CaptureFrontDoor.tsx:591`),
  // keine zweite Autorität: `useUnloadGuard` hängt genau einen `beforeunload`-Handler ans Fenster
  // und nimmt ihn wieder ab. Dasselbe Dirty-Prädikat wie der In-App-Wächter — beide können nicht
  // auseinanderlaufen.
  useUnloadGuard(isDirty);

  // SCRUM-87 / FR-MOB-03: Inline-Bestätigung statt nativem Dialog.
  const [confirm, setConfirm] = useState<ConfirmState>(NO_CONFIRM);
  const discard = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: (_d, id) => {
      invalidateDrafts();
      push("success", t("mob.discarded"));
      setConfirm(clearConfirm());
      if (editingId === id) {
        resetForm();
      }
    },
    onError: fail,
  });
  // ============================================================================================
  // JOB 4193 Lieferung 3 — WIEDERÖFFNEN MIT OFFLINE LIEGENDER FASSUNG: erst vergleichen, dann
  // weiterschreiben.
  // ============================================================================================
  //
  // Liegt für DIESEN Entwurf noch ein Vorgang in der Warteschlange, ist der Listen-Cache die
  // falsche Quelle: er zeigt weder die offline gespeicherte Fassung noch verlässlich den
  // Serverstand. Geholt wird deshalb FRISCH — und bis er da ist, steht die eigene, offline
  // gespeicherte Fassung schon im Feld (verloren geht sie nie).
  //
  // OHNE VERBINDUNG wird nicht verglichen, sondern gesagt, dass nicht verglichen werden kann: eine
  // Rückfrage, die eine Serverantwort voraussetzt, die es gerade nicht gibt, wäre erfunden.
  const resume = (id: string): void => {
    const op = queue.queue.find(
      (q) => q.draftId === id && (q.status === "queued" || q.status === "failed"),
    );
    if (op) {
      // ==========================================================================================
      // JOB 4193 R5, BENs Korrekturpflicht 1 — DER STAND DES VORGANGS REIST MIT INS FORMULAR.
      // ==========================================================================================
      //
      // DER BEFUND (BEN R4, an unverändertem Code gemessen): hier stand `draftToForm({ payload })`
      // allein. Eine Nutzlast trägt keinen Stand — das Formular kam also OHNE `gesehenerStand`
      // zurück, obwohl der liegende Vorgang einen hat. Ohne Verbindung gab es auch keinen frischen
      // Abgleich, der ihn nachgereicht hätte. Wer denselben Entwurf offline ein ZWEITES Mal
      // speicherte, legte damit einen Vorgang OHNE Voraussetzung an, und `standNachfuehren` strich
      // den alten Stand am selben Eintrag mit weg. Beim Nachsenden ging er ohne `expectedUpdatedAt`
      // raus: „letzter Schreiber gewinnt", und die Desktop-Fassung war still weg. BENs Messung:
      // „BEN vor Sync: Versionsstand FEHLT", danach `Handy zweiter Wurf` statt `Fassung Desktop`.
      //
      // DIE VORAUSSETZUNG GEHÖRT ZUM ENTWURF, NICHT ZUM EINZELNEN SPEICHERN. Sie reist deshalb aus
      // dem Vorgang ins Formular und von dort in jeden weiteren Speicherweg (`formToUpdate`).
      const offline: DraftFormState = {
        ...draftToForm({ payload: op.payload }),
        ...(op.seenUpdatedAt ? { gesehenerStand: op.seenUpdatedAt } : {}),
      };
      setForm(offline);
      setBaseline(offline);
      setEditingId(id);
      setBeiseite(null);
      if (queue.online) {
        void konfliktOeffnen(id, "wiedereroeffnen", op);
      } else {
        setKonflikt(null);
      }
      return;
    }
    const d = (drafts.data ?? []).find((x) => x.id === id);
    if (d) {
      const resumed = draftToForm(d);
      setForm(resumed);
      setBaseline(resumed);
      setEditingId(id);
      setKonflikt(null);
      setBeiseite(null);
    }
  };

  /** „Neuen Stand holen": der Serverstand kommt ins Feld — und die eigene Fassung bleibt sichtbar. */
  const neuenStandHolen = (): void => {
    if (konflikt?.lage.art !== "unterschied") {
      return;
    }
    const { server, serverStand } = konflikt.lage;
    const meins = konflikt.offline ?? form;
    setBeiseite({ titel: meins.title, text: formText(meins) });
    const neu: DraftFormState = { ...server, gesehenerStand: serverStand };
    setForm(neu);
    setBaseline(neu);
    setEditingId(konflikt.entwurfId);
    if (konflikt.opId) {
      queue.replace(konflikt.opId, formToPayload(neu), titelVon(neu), serverStand);
    }
    setKonflikt(null);
  };

  /** „Meine Fassung behalten": erneut speichern — diesmal gegen den frisch geholten Stand. */
  const meineFassungBehalten = (): void => {
    if (konflikt?.lage.art !== "unterschied") {
      return;
    }
    const { serverStand } = konflikt.lage;
    const neu: DraftFormState = {
      ...(konflikt.offline ?? form),
      gesehenerStand: serverStand,
    };
    setForm(neu);
    setKonflikt(null);
    if (konflikt.opId) {
      // Die Wahl ERSETZT den Vorgang in der Warteschlange (und seine Voraussetzung); gelöscht
      // wird er nie — nachgesendet wird er wie bisher, sobald Verbindung besteht.
      setBaseline(neu);
      queue.replace(konflikt.opId, formToPayload(neu), titelVon(neu), serverStand);
      return;
    }
    save.mutate(neu);
  };

  // --- Fragen (FE-MOB-03) ---
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  // WP-SHIP9-S2 Paket 4 (W4): geteilter KO-Bestand (react-query, i. d. R. bereits geladen/gecacht) für
  // die Titel-Auflösung der Quellen — KEIN neuer Ask-Roundtrip, die Ask-Antwort liefert nur IDs.
  const kos = useKos();
  // AUFTRAG-mega33 BLOCK A2 (bens ROT 4): die mobile Antwort leitete ihre Evidenz noch einmal
  // eigenständig aus `answer.knowledgeClass` ab und zeigte deshalb „Gesichert", wo der Desktop
  // längst einen Prüfvorbehalt trug. Sie speist sich jetzt aus derselben einen Einstufung — dafür
  // braucht sie neben dem Bestand auch die bekannten Konflikte. Bestehende Route, bestehender
  // Hook, geteilter react-query-Cache: KEIN neuer Egress.
  const conflicts = useConflicts();
  const ask = useMutation({
    mutationFn: (question: string) => endpoints.ask.ask(question, toReasonerLocale(i18n.language)),
    onSuccess: (res) => setAnswer(selectAnswer(res)),
    onError: (e) => {
      setAnswer(null);
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });

  // --- Suchen (FE-MOB-05) ---
  // WP-BILD-1g (bens Klein-Fix 3): live getippte Suche DEBOUNCED wie auf dem Desktop (gleicher
  // Hook, kein Duplikat); latest-wins über den react-query-Parameter-Key (s. useDebouncedValue).
  const [sq, setSq] = useState("");
  const debouncedSq = useDebouncedValue(sq, LIBRARY_SEARCH_DEBOUNCE_MS);
  const search = useLibrarySearch(debouncedSq.trim() ? { q: debouncedSq.trim() } : {});

  const tabCls = (active: boolean): string =>
    `flex-1 rounded-btn py-1.5 text-[12px] font-semibold ${
      active ? "bg-ink text-white" : "text-muted"
    }`;

  return (
    <div className="flex min-h-[520px] flex-col items-center gap-3 rounded-card bg-page p-6">
      {/* JOB 3786 — DIE ERKLÄRUNG DIESER FLÄCHE, hinter dem Zahnrad statt im Sichtfeld.
          Sie beantwortet die drei Fragen (was ist das hier · was kann ich tun · was geht hier
          NICHT und wo geht es) und nennt die Berechtigung, weil die drei Reiter NICHT dasselbe
          dürfen: Entwürfe brauchen `ko.create`, Fragen und Suchen nur `ko.read`.

          BENANNTE GRENZE, gemessen und nicht behauptet (Beleg: tests/seitenhilfe-mobil/
          handyflaeche-erklaert-sich.test.tsx, Fall M4): auf DIESER Route erreicht die Anmeldung
          heute noch keinen Leser. `shell/AppShell.tsx:65-79` kehrt für `/mobile` VOR dem
          `SeitenhilfeProvider` und vor dem Kopfband zurück — der Tipp meldet sich also beim
          stummen Sammler (`SeitenhilfeContext.tsx:37`), und ein Zahnrad gibt es hier nicht.
          Das Endglied der Kette gehört nach `shell/AppShell.tsx` und damit ausserhalb der
          Zielpfade dieses Auftrags; es ist in der Rückgabe als offener Punkt benannt. */}
      <HelpTip title={t("seitenhilfe.mobil.titel")} body={t("seitenhilfe.mobil.text")} />
      {/* B1b: /mobile wird OHNE AppShell/Topbar gerendert — ohne diesen Ausgang gäbe es keinen Weg
          zurück zur Vollversion. Immer sichtbar, oberhalb des Telefon-Rahmens.
          WP-SAMMEL20-FIX (bens Fix 4): der Rückweg läuft durch den NavGuard (ungespeicherte
          Eingabe → Dialog) und führt zur VORHERIGEN Route zurück (backTo), nicht hart auf /start. */}
      <button
        type="button"
        onClick={() => guard(() => navigate(backTo))}
        className="inline-flex items-center gap-1.5 self-start rounded-btn border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text"
      >
        <ArrowLeft size={15} />
        {t("topbar.toDesktop")}
      </button>
      <div className="w-[340px] overflow-hidden rounded-[34px] border-4 border-ink bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-sans text-[15px] font-bold tracking-[2px] text-ink">KLARWERK</span>
          {queue.online ? (
            <span className="flex items-center gap-1 font-mono text-[11px] text-trust-pos-text">
              <span className="h-1.5 w-1.5 rounded-full bg-trust-pos-fill" />
              {t("mob.online")}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-[11px] text-trust-warn-text">
              <WifiOff size={12} />
              {t("mob.offline")}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-3 flex gap-1 rounded-btn bg-page p-1">
          <button
            type="button"
            className={tabCls(tab === "capture")}
            onClick={() => setTab("capture")}
          >
            {t("mob.tabCapture")}
          </button>
          <button type="button" className={tabCls(tab === "ask")} onClick={() => setTab("ask")}>
            {t("mob.tabAsk")}
          </button>
          <button
            type="button"
            className={tabCls(tab === "lookup")}
            onClick={() => setTab("lookup")}
          >
            {t("mob.tabLookup")}
          </button>
        </div>

        {tab === "capture" ? (
          <div>
            <p className="mb-2 text-[13px] text-muted">
              {editingId ? t("mob.editing") : t("mob.sub")}
            </p>
            <div className="space-y-2">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("mob.formTitle")}
                className="h-10 w-full rounded-input border border-hairline bg-page px-3 text-sm outline-none focus:border-ink/30"
              />
              {/* JOB 3377: EIN Textfeld, zwei mögliche Quellen. Trägt der fortgesetzte Entwurf
                  einen Body, steht hier DERSELBE Fliesstext, den die Vollversion im Editor zeigt
                  (feste Blöcke als nummerierte Platzhalter an ihrer Stelle); sonst wie bisher die
                  Kernaussage. Die gespeicherte Kernaussage wird dabei nicht überschrieben — sie
                  bleibt aus der Nutzlast (`formToPayload`). */}
              <textarea
                data-testid={bodyMode ? "mob-body" : "mob-statement"}
                value={bodyMode ? (form.body ?? "") : form.statement}
                onChange={(e) =>
                  setForm((f) =>
                    bodyMode ? { ...f, body: e.target.value } : { ...f, statement: e.target.value },
                  )
                }
                placeholder={t("mob.formStatement")}
                rows={bodyMode ? 6 : 3}
                className="w-full resize-y rounded-input border border-hairline bg-page p-2.5 text-sm outline-none focus:border-ink/30"
              />
              <div className="flex gap-2">
                {/* JOB 4193 R5 (BEN Korrekturpflicht 2): AN BEIDEN ENDEN gesperrt — sichtbar hier
                    und wirksam im Handler (`onSave`), aus EINEM Wahrheitsort (`schreibenGesperrt`).
                    Ein Knopf, der bei offener Rückfrage bedienbar aussieht, ist genau der Weg, auf
                    dem BEN die fremde Fassung überschrieben hat. */}
                <button
                  type="button"
                  disabled={save.isPending || !isDraftFormFillable(form) || schreibenGesperrt}
                  title={schreibenGesperrt ? t("mob.stand.erstAufloesen") : undefined}
                  onClick={onSave}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-btn bg-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  <Check size={15} />
                  {editingId ? t("mob.update") : t("mob.save")}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center gap-1.5 rounded-btn border border-hairline px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text"
                  >
                    <FilePlus2 size={15} />
                    {t("mob.new")}
                  </button>
                ) : null}
              </div>
              {!queue.online ? (
                <p className="flex items-center gap-1.5 text-[11.5px] text-trust-warn-text">
                  <CloudOff size={12} />
                  {t("mob.offlineSaveHint")}
                </p>
              ) : null}
              {/* JOB 4193, Zustandsmodell „offline": der Serverstand ist unbekannt. Das sagt die
                  Fläche — statt einen Abgleich zu behaupten oder still zu überschreiben. */}
              {!queue.online && editingId ? (
                <p className="text-[11.5px] leading-relaxed text-muted">
                  {t("mob.stand.offlineHinweis")}
                </p>
              ) : null}
            </div>

            {/* ================================================================================
                JOB 4193 — DIE RÜCKFRAGE BEI VERALTETEM STAND.
                ================================================================================
                Sie ersetzt den stummen Fehlerweg (`onError: fail`) für genau diesen einen Fall.
                Was hier NICHT passiert, ist so wichtig wie das, was passiert: kein
                „gespeichert", kein roter Sammelfehler, kein `resetForm()`. Der getippte Text
                steht weiter im Feld darüber. */}
            {konflikt ? (
              <div
                data-testid="mob-stand-konflikt"
                className="mt-3 rounded-card border border-hairline bg-trust-warn-bg p-2.5"
              >
                {konflikt.lage.art === "laedt" ? (
                  <p className="text-[12px] leading-relaxed text-trust-warn-text">
                    {t("mob.stand.laedt")}
                  </p>
                ) : konflikt.lage.art === "fehler" ? (
                  <>
                    <p className="text-[12px] leading-relaxed text-trust-warn-text">
                      {t("mob.stand.pruefungFehlt")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const op = queue.queue.find((q) => q.id === konflikt.opId) ?? null;
                        void konfliktOeffnen(konflikt.entwurfId, konflikt.quelle, op);
                      }}
                      className="mt-2 rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-text"
                    >
                      {t("mob.stand.erneutPruefen")}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[12.5px] font-semibold text-trust-warn-text">
                      {konflikt.quelle === "speichern"
                        ? t("mob.stand.titelSpeichern")
                        : t("mob.stand.titelOffline")}
                    </p>
                    {/* DER FELDSTEMPEL dieses Auftrags: welches Feld weicht ab, in Worten, die
                        einem Menschen etwas sagen — nicht „alle Felder". */}
                    <p
                      data-testid="mob-stand-felder"
                      className="mt-1 text-[11.5px] leading-relaxed text-trust-warn-text"
                    >
                      {t("mob.stand.felder")}:{" "}
                      {konflikt.lage.felder.map((f) => t(`mob.stand.feld.${f}`)).join(" · ")}
                    </p>
                    {konflikt.offline ? (
                      <div className="mt-2 space-y-1.5">
                        <div
                          data-testid="mob-stand-offline"
                          className="rounded-input border border-hairline bg-surface p-2"
                        >
                          <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                            {t("mob.stand.offlineFassung")}
                          </div>
                          <div className="break-words text-[12px] text-text">
                            {konflikt.offline.title}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-[11.5px] text-muted">
                            {formText(konflikt.offline)}
                          </div>
                        </div>
                        <div
                          data-testid="mob-stand-server"
                          className="rounded-input border border-hairline bg-surface p-2"
                        >
                          <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                            {t("mob.stand.serverFassung")}
                          </div>
                          <div className="break-words text-[12px] text-text">
                            {konflikt.lage.server.title}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-[11.5px] text-muted">
                            {formText(konflikt.lage.server)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={neuenStandHolen}
                        className="flex-1 rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-text"
                      >
                        {t("mob.stand.holen")}
                      </button>
                      <button
                        type="button"
                        onClick={meineFassungBehalten}
                        className="flex-1 rounded-btn bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white"
                      >
                        {t("mob.stand.behalten")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* Die eigene Fassung, die „Neuen Stand holen" verdrängt hat — sie bleibt lesbar (und
                kopierbar), bis der Mensch sie selbst verwirft. Nichts wird still weggeworfen. */}
            {beiseite ? (
              <div
                data-testid="mob-stand-meine-fassung"
                className="mt-3 rounded-card border border-dashed border-hairline p-2.5"
              >
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("mob.stand.meineFassung")}
                </div>
                <div className="break-words text-[12px] text-text">{beiseite.titel}</div>
                <div className="whitespace-pre-wrap break-words text-[11.5px] text-muted">
                  {beiseite.text}
                </div>
                <button
                  type="button"
                  onClick={() => setBeiseite(null)}
                  className="mt-2 rounded-btn border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
                >
                  {t("mob.stand.verwerfen")}
                </button>
              </div>
            ) : null}

            {/* Offline-Warteschlange (FE-MOB-07) */}
            {queue.queue.length > 0 ? (
              <div className="mt-4 rounded-card border border-hairline p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                    {t("mob.queue")} · {queue.pending}
                  </span>
                  <button
                    type="button"
                    disabled={!queue.online || queue.syncing || queue.pending === 0}
                    onClick={() => void queue.syncNow().then(notifySync)}
                    className="flex items-center gap-1 rounded-btn bg-ink px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    <RefreshCw size={12} className={queue.syncing ? "animate-spin" : ""} />
                    {t("mob.syncNow")}
                  </button>
                </div>
                <ul className="space-y-1">
                  {queue.queue.map((op) => (
                    <li key={op.id} className="flex items-center gap-2 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-text">{op.title}</span>
                      <span
                        className={`rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${QUEUE_TONE[op.status]}`}
                      >
                        {t(`mob.status.${op.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                {t("mob.drafts")}
              </div>
              {/* D-036: „keine Entwürfe" ist eine AUSSAGE ÜBER DEN BESTAND — sie darf erst
                  fallen, wenn der Bestand bekannt ist. Bis dahin sagt die Fläche, dass sie lädt;
                  bei einem dauerhaft gescheiterten Abruf sagt sie das, statt weiter „lädt" zu
                  behaupten (Fehler und Laden bleiben getrennt). Die Reihenfolge ist die Aussage:
                  erst lädt, dann Fehler, dann — und nur dann — die Leerbehauptung. */}
              {isGroupLoading([drafts]) ? (
                <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
              ) : isGroupError([drafts]) ? (
                <p className="text-[12.5px] text-trust-crit-text">{t("state.error")}</p>
              ) : (drafts.data ?? []).length === 0 ? (
                <p className="text-[12.5px] text-muted">{t("mob.draftsEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {(drafts.data ?? []).map((d) => (
                    <li
                      key={d.id}
                      className={`flex items-center gap-2 rounded-input border px-2.5 py-2 ${
                        editingId === d.id ? "border-ink bg-page" : "border-hairline"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                        {draftTitle(d, t("capture.draftFallbackTitle"))}
                      </span>
                      {/* SCRUM-412 (CI): Hinweis in Textfarbe — Rot nur am destruktiven Knopf. */}
                      {isPending(confirm, d.id) ? (
                        <>
                          <span className="text-[11px] text-text">
                            {t("mob.discardConfirmHint")}
                          </span>
                          <button
                            type="button"
                            title={t("mob.confirmDiscard")}
                            disabled={discard.isPending}
                            onClick={() => discard.mutate(d.id)}
                            className="grid h-7 w-7 place-items-center rounded-btn bg-trust-crit-bg text-trust-crit-text hover:opacity-80"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            title={t("mob.cancelDiscard")}
                            onClick={() => setConfirm(clearConfirm())}
                            className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title={t("mob.resume")}
                            onClick={() => resume(d.id)}
                            className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            title={t("mob.discard")}
                            onClick={() => setConfirm(requestConfirm(d.id))}
                            className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {tab === "ask" ? (
          <div>
            {!queue.online ? (
              <div className="rounded-card border border-dashed border-hairline p-3">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                  <WifiOff size={14} />
                  {t("mob.offlineAsk")}
                </p>
                <p className="mt-1 text-[12px] text-muted">{t("mob.offlineNeedsConn")}</p>
              </div>
            ) : (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (q.trim()) {
                      ask.mutate(q.trim());
                    }
                  }}
                >
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("ask.placeholder")}
                    className="h-10 flex-1 rounded-input border border-hairline bg-page px-3 text-sm outline-none focus:border-ink/30"
                  />
                  <button
                    type="submit"
                    disabled={ask.isPending || q.trim().length === 0}
                    className="grid h-10 w-10 place-items-center rounded-btn bg-ink text-white disabled:opacity-50"
                  >
                    <ArrowRight size={16} />
                  </button>
                </form>

                {answer
                  ? (() => {
                      // AUFTRAG-mega34 A1: der leere Vorgabewert ist weg — der Konfliktstand reist
                      // mit seiner Herkunft, damit ein hängender oder abgerissener Abruf hier
                      // nicht als „keine Konflikte" ankommt (bens schwerster Befund). Der Wächter
                      // in tests/app/paket4-w3-w4.test.ts prüft das Verbot wörtlich am Quelltext;
                      // deshalb darf der alte Ausdruck auch als Zitat nicht mehr hier stehen.
                      const s = summarizeAnswer(
                        answer,
                        kos.data ?? [],
                        conflictKnowledge(conflicts),
                      );
                      return s.answered ? (
                        <div className="mt-3 rounded-card border border-hairline p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            {/* AUFTRAG-mega33 A2: die EFFEKTIVE Evidenz — dieselbe Einstufung wie
                                auf dem Desktop, nicht mehr die rohe Klasse. */}
                            <span
                              className={`rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${EVIDENCE_TONE[s.evidence.tone]}`}
                            >
                              {t("ask.evidence")}: {t(s.evidence.labelKey)}
                            </span>
                            <span className="shrink-0">
                              <ConfidenceBar value={s.trust} showLabel={false} />
                            </span>
                          </div>
                          {/* AUFTRAG-mega34 A3: derselbe Hinweis auf den unbekannten Konfliktstand
                              wie auf dem Desktop — aus derselben Ableitung, Wort für Wort. */}
                          {s.conflictCaveat ? (
                            <div
                              data-testid="mob-conflict-caveat"
                              className="mb-2 rounded-btn bg-trust-warn-bg px-2.5 py-2"
                            >
                              <p className="text-[12px] font-semibold text-trust-warn-text">
                                {t("ask.conflictCaveat.title")}
                              </p>
                              <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text">
                                {t(`ask.conflictCaveat.${s.conflictCaveat.reason}`)}
                              </p>
                            </div>
                          ) : null}
                          {/* AUFTRAG-mega33 A2: derselbe benannte Prüfvorbehalt wie auf dem Desktop
                              — er sagt, worauf er sich bezieht, und schweigt, sobald jede
                              herangezogene Quelle einen belegten Lauf hat. */}
                          {s.caveat ? (
                            <div
                              data-testid="mob-check-caveat"
                              className="mb-2 rounded-btn bg-trust-warn-bg px-2.5 py-2"
                            >
                              <p className="text-[12px] font-semibold text-trust-warn-text">
                                {t("ask.checkCaveat.title")}
                              </p>
                              <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text">
                                {t(`ask.checkCaveat.${s.caveat.reason}`, {
                                  unproven: s.caveat.unproven,
                                  total: s.caveat.total,
                                })}
                              </p>
                            </div>
                          ) : null}
                          {/* WP-UX-WOW-1 U1: Antwort-Markdown sicher rendern (React-Subset). */}
                          <AnswerMarkdown
                            text={s.text ?? ""}
                            className="text-[14px] leading-relaxed text-text"
                          />
                          {s.sources.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] uppercase text-muted-2">
                                {t("ask.sources")}
                              </span>
                              {/* WP-SHIP9-S2 Paket 4 (W4): KO-Titel statt roher UUID (Titel aus dem
                                  vorhandenen Bestand — nie eine ID zeigen, wenn ein KO bekannt ist);
                                  line-clamp gegen Überlauf, Volltitel im Tooltip. */}
                              {s.sources.map((ref) => (
                                // AUFTRAG-mega12 Block C (echter Treffer, gefunden beim Bauen der
                                // Architekturprüfung): Mobile MELDET einen Wächter an
                                // (Standvergleich), hatte hier aber rohe <Link>. Die Erfassungs-
                                // Karteikarte und diese Quellen-Verweise leben in DERSELBEN
                                // Komponente — ein getippter Entwurf überlebt den Tab-Wechsel und
                                // ging bei einem Tipp auf diesen Verweis still verloren. Dieselbe
                                // Fehlerklasse wie bens SB-2-Befund in Capture.tsx.
                                <GuardedLink
                                  key={ref.id}
                                  to={`/wissen/${ref.id}`}
                                  title={ref.label}
                                  className="line-clamp-1 max-w-[220px] text-[12px] font-semibold text-brand-text hover:underline"
                                >
                                  {ref.label}
                                </GuardedLink>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-card border border-dashed border-hairline p-3">
                          <p className="text-[14px] font-semibold text-text">
                            {t("ask.noBasisTitle")}
                          </p>
                          <p className="mt-1 text-[12.5px] text-muted">{t("ask.noBasisBody")}</p>
                          {/* AUFTRAG-mega54 BLOCK E4: Mobile trägt DENSELBEN ersten Schritt. Bis
                              hierher kannte diese Fläche den kostenlosen Schritt gar nicht — sie
                              zeigte Titel, Text und direkt den Weg ins Risiko-Board, also genau den
                              teuersten zuerst. Der Vertragskasten, der ihn auf dem Desktop nennt,
                              existiert hier nicht; deshalb steht er hier ausgeschrieben. Kein neuer
                              Weg, keine neue Route, keine neue Ansicht — derselbe eine Schlüssel. */}
                          <p className="mt-2 text-[12.5px] font-medium text-text">
                            {t("ask.gapNext")}
                          </p>
                          {/* AUFTRAG-mega12 Block C: derselbe Befund, zweiter Ausgang. */}
                          <GuardedLink
                            to="/risiko"
                            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-text"
                          >
                            {t("ask.toGaps")}
                            <ArrowRight size={14} />
                          </GuardedLink>
                        </div>
                      );
                    })()
                  : null}
              </>
            )}
          </div>
        ) : null}

        {tab === "lookup" ? (
          <div>
            {!queue.online ? (
              <div className="rounded-card border border-dashed border-hairline p-3">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                  <WifiOff size={14} />
                  {t("mob.offlineSearch")}
                </p>
                <p className="mt-1 text-[12px] text-muted">{t("mob.offlineNeedsConn")}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-input border border-hairline bg-page px-3">
                  <Search size={15} className="text-muted-2" />
                  <input
                    value={sq}
                    onChange={(e) => setSq(e.target.value)}
                    placeholder={t("mob.searchPlaceholder")}
                    className="h-10 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="mt-3">
                  {/* D-036: dieselbe Trennung wie bei den Entwürfen. „Kein Treffer" ist eine
                      Aussage über den Bestand und nicht über den Abrufstand — sie wartet, bis der
                      Bestand bekannt ist. Das gilt auch nach jedem neuen Suchwort: der debounced
                      Parameter erzeugt eine neue Abfrage, und die fällt wieder in `loading`. */}
                  {isGroupLoading([search]) ? (
                    <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
                  ) : isGroupError([search]) ? (
                    <p className="text-[12.5px] text-trust-crit-text">{t("state.error")}</p>
                  ) : (search.data ?? []).length === 0 ? (
                    <p className="text-[12.5px] text-muted">{t("mob.searchEmpty")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(search.data ?? []).slice(0, 20).map((k) => (
                        <li key={k.id}>
                          {/* AUFTRAG-mega12 Block C: derselbe Befund, dritter Ausgang — der
                              Trefferliste-Tipp im Nachschlagen-Tab. */}
                          <GuardedLink
                            to={`/wissen/${k.id}`}
                            className="block rounded-input border border-hairline p-2.5 hover:bg-hairline-soft"
                          >
                            <div className="mb-1 flex items-center gap-1.5">
                              <StatusPill status={deriveStatus(k)} />
                              <KnowledgeTypeTag type={k.type} />
                              <span className="ml-auto font-mono text-[10px] text-muted-2">
                                T{k.trust}
                              </span>
                            </div>
                            <div className="truncate text-[13px] text-text">{k.title}</div>
                          </GuardedLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
