// SCRUM-435: eine (oder mehrere) aus einem Dokument extrahierte Erkenntnis(se) an einen BESTEHENDEN
// Artikel anhängen — statt nur zu einem neuen Eintrag zu verbinden.
//
// AUFTRAG-mega18 Block A-3: DIESER WEG GEHT DURCH DIE VERBUND-OPERATION. Bis mega17 orchestrierte
// die Komponente drei Serveraufrufe (attach → n× add-source → revise) und kompensierte bei einem
// Fehlschlag per remove-source. Beides ist weg. Jetzt: das Original in den Objektspeicher, dann EIN
// Aufruf, der Anker, Belege und Inhalt gemeinsam committet — und ein Ergebnis, das sagt, was gilt.
// Die Begründung steht bei `commitDocumentAppend` (lib/appendToArticle.ts) und bei
// `DocumentAppendInput` (services/knowledge-object/src/service.ts).
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useKos } from "../api/hooks";
import type { ExtractedPoint } from "../api/types";
import {
  type AppendDocumentOutcome,
  commitDocumentAppend,
  filterArticlesByTitle,
  newAppendOperationId,
} from "../lib/appendToArticle";
import { appendExtractSections, normalizeExtractLocale } from "../lib/bodyExtract";
import type { OriginalDocument, OriginalRefCache } from "../lib/captureAttachments";
import { fileSourcePayload } from "../lib/captureFromFile";
import { Modal } from "./Modal";
import { QueryState, TextInput } from "./ui";

// Der Aufrufer meldet eine misslungene Übernahme; diese Klasse trägt den EHRLICHEN AUSGANG —
// „abgelehnt, Artikel unverändert" ist eine andere Aussage als „unklar, bitte nachsehen", und die
// Oberfläche darf sie nicht vermischen.
class AppendFailedError extends Error {
  constructor(readonly outcome: AppendDocumentOutcome) {
    super("APPEND_FAILED");
    this.name = "AppendFailedError";
  }
}

export function AppendToArticleModal({
  open,
  points,
  fileName,
  original,
  originalCache,
  onClose,
  onDone,
}: {
  open: boolean;
  points: ExtractedPoint[];
  fileName: string;
  // Die Quelldatei selbst. Sie wird zum ANKER der Belegstellen. Ohne sie bricht die Übernahme ab —
  // auf JEDER Stufe (interne Belegpflicht), und das ist kein Rückschritt, sondern die Regel.
  original?: OriginalDocument | null;
  // Ref-Cache des Aufrufers: dieselbe Datei wird über mehrere Übernahmen hinweg höchstens EINMAL in
  // den Objektspeicher geladen (WP-D2-Muster). Das Binden an das Ziel-KO macht die Operation.
  originalCache?: OriginalRefCache;
  onClose: () => void;
  // Erfolgs-Rückmeldung an den Aufrufer (Titel des Zielartikels).
  onDone: (title: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const kos = useKos();
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const [followUps, setFollowUps] = useState<string[] | null>(null);

  const append = useMutation({
    mutationFn: async (targetId: string): Promise<string> => {
      // Frischen Stand laden (Body + statement), damit nichts überschrieben wird.
      const target = await endpoints.ko.get(targetId);
      const nextBody = appendExtractSections(
        target.bodyHtml ?? "",
        points,
        fileName,
        normalizeExtractLocale(i18n.language),
      );
      // 1. DAS ORIGINAL IN DEN OBJEKTSPEICHER. Nur der Upload — das BINDEN an den Zielartikel
      //    macht die Operation, gemeinsam mit Belegen und Inhalt. Ohne gesicherte objectId gibt es
      //    keinen Anker, und ohne Anker keine Übernahme: das wird hier ehrlich abgebrochen, nicht
      //    (wie bis mega17) mit `anchor = undefined` weitergeführt.
      const cache = originalCache ?? { ref: null };
      if (!cache.ref) {
        if (!original) {
          throw new AppendFailedError({ kind: "rejected", reason: "MISSING_DOCUMENT_ANCHOR" });
        }
        cache.ref = await endpoints.objects.upload({
          name: original.name,
          mime: original.mime,
          data: original.data,
          kind: "document",
          // AUFTRAG-mega20 Block C: dieses Original wird Anker einer Übernahme.
          purpose: "anchor",
        });
      }
      const anchorRef = cache.ref;
      const anchorName = original?.name ?? fileName;
      const anchorMime = original?.mime ?? "application/octet-stream";
      // 2. EIN AUFRUF. Die Kennung entsteht EINMAL je Übernahme und gilt auch für den
      //    Wiederholversuch, den `commitDocumentAppend` bei unklarem Ausgang unternimmt — daran
      //    hängt die Idempotenz und damit die ganze Zusage.
      const operationId = newAppendOperationId();
      const outcome = await commitDocumentAppend(
        {
          append: (opId) =>
            endpoints.ko.appendDocument(targetId, {
              operationId: opId,
              anchor: { objectId: anchorRef.id, name: anchorName, mime: anchorMime },
              points: points.map((p) => fileSourcePayload(fileName, p)),
              // statement bewusst erhalten: sonst würde die Revision die Kurzfassung aus dem
              // ganzen Body neu ableiten.
              changes: { bodyHtml: nextBody, statement: target.statement },
            }),
        },
        operationId,
      );
      if (outcome.kind !== "committed") {
        throw new AppendFailedError(outcome);
      }
      setFollowUps(outcome.commit?.followUpsFailed ?? null);
      return target.title;
    },
    onSuccess: (title) => {
      setErr(null);
      setUnchanged(false);
      setQuery("");
      onDone(title);
      onClose();
    },
    onError: (e) => {
      setFollowUps(null);
      if (e instanceof AppendFailedError) {
        const { kind, reason } = e.outcome;
        // ABGELEHNT heißt: der Server hat verarbeitet und nichts geschrieben. Nur DANN darf die
        // Zusage „der Artikel ist unverändert" fallen — sie ist der wichtigste Satz und sie muss
        // stimmen. Bei UNKLAREM Ausgang fällt sie nicht, weil sie dort nicht zu belegen ist.
        setUnchanged(kind === "rejected");
        if (kind === "unknown") {
          setErr(t("xtr.append.unclear"));
          return;
        }
        setErr(
          t(
            reason === "EXTERNAL_ATTACH_BLOCKED"
              ? "xtr.append.blockedByStage"
              : reason === "MISSING_DOCUMENT_ANCHOR"
                ? "xtr.append.missingAnchor"
                : "state.error",
          ),
        );
        return;
      }
      setUnchanged(false);
      setErr(e instanceof ApiError ? e.message : t("state.error"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("xtr.append.title")}>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        {t("xtr.append.intro", { count: points.length, name: fileName })}
      </p>
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("xtr.append.searchPlaceholder")}
        aria-label={t("xtr.append.searchPlaceholder")}
      />
      {err ? (
        <div className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {err}
          {/* AUFTRAG-mega18 Block A: „Der Artikel wurde nicht verändert" steht NUR bei einer
              belegten Ablehnung. Bei unklarem Ausgang wäre derselbe Satz eine Behauptung — und
              genau diese Behauptung war der Schaden, den mega17 hinterließ. */}
          {unchanged ? (
            <p className="mt-1 leading-relaxed">{t("xtr.append.stateUnchanged")}</p>
          ) : null}
        </div>
      ) : null}
      {/* Committet, aber ein Folgeschritt lief nicht. Die Übernahme GILT — das steht im Text zuerst. */}
      {followUps && followUps.length > 0 ? (
        <div className="mt-2 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
          {t("xtr.append.followUpsFailed", { steps: followUps.join(", ") })}
        </div>
      ) : null}
      <div className="mt-3 max-h-[45vh] space-y-1.5 overflow-auto">
        <QueryState query={kos} emptyText={t("xtr.append.none")}>
          {(list) => {
            const matches = filterArticlesByTitle(list, query);
            if (matches.length === 0) {
              return <p className="py-3 text-[12.5px] text-muted-2">{t("xtr.append.none")}</p>;
            }
            return (
              <>
                {matches.map((ko) => (
                  <button
                    key={ko.id}
                    type="button"
                    disabled={append.isPending}
                    onClick={() => append.mutate(ko.id)}
                    className="block w-full truncate rounded-card border border-hairline bg-surface px-3 py-2 text-left text-[13px] font-medium text-text transition-colors hover:border-ink/30 disabled:opacity-50"
                  >
                    {ko.title}
                  </button>
                ))}
              </>
            );
          }}
        </QueryState>
      </div>
      {append.isPending ? (
        <p className="mt-2 text-[12px] text-muted-2">{t("xtr.append.busy")}</p>
      ) : null}
    </Modal>
  );
}
