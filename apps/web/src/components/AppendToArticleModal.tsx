// SCRUM-435: eine (oder mehrere) aus einem Dokument extrahierte Erkenntnis(se) an einen BESTEHENDEN
// Artikel anhängen — statt nur zu einem neuen Eintrag zu verbinden. Nutzt ausschließlich vorhandene
// Endpunkte: Zielartikel laden (ko.get), ausgewählte Punkte als Abschnitt an den Body anhängen
// (revise, statement bewusst erhalten) und die Quelle je Punkt vermerken (add-source). Bewusster
// Klick-Schritt, kein Auto-Save. Der Zielartikel muss danach neu geprüft werden (revise-Semantik).
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useKos } from "../api/hooks";
import type { ExtractedPoint } from "../api/types";
import { filterArticlesByTitle } from "../lib/appendToArticle";
import { appendExtractSections, normalizeExtractLocale } from "../lib/bodyExtract";
import { fileSourcePayload } from "../lib/captureFromFile";
import { Modal } from "./Modal";
import { QueryState, TextInput } from "./ui";

export function AppendToArticleModal({
  open,
  points,
  fileName,
  onClose,
  onDone,
}: {
  open: boolean;
  points: ExtractedPoint[];
  fileName: string;
  onClose: () => void;
  // Erfolgs-Rückmeldung an den Aufrufer (Titel des Zielartikels).
  onDone: (title: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const kos = useKos();
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
      // statement bewusst erhalten: sonst würde revise die Kurzfassung aus dem ganzen Body neu ableiten.
      await endpoints.ko.act(targetId, {
        action: "revise",
        changes: { bodyHtml: nextBody, statement: target.statement },
      });
      for (const p of points) {
        await endpoints.ko.act(targetId, {
          action: "add-source",
          source: fileSourcePayload(fileName, p),
        });
      }
      return target.title;
    },
    onSuccess: (title) => {
      setErr(null);
      setQuery("");
      onDone(title);
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
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
