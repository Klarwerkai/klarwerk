import { useQueryClient } from "@tanstack/react-query";
// WP-D-CLEAN (Pedis Entscheid HEUTE: alle Testdaten löschen, auch Confluence und Jira): klar
// abgesetzter Aufräum-Kasten im Import-Bereich. ZWEISTUFIG und NIE automatisch: (1) Knopf lädt die
// ehrliche VORSCHAU (n Kandidaten, m importierte Beiträge — serverseitig gezählt, nichts passiert),
// (2) expliziter Bestätigen-Schritt mit den Zahlen und dem ehrlichen Hinweis (Kandidatenliste wird
// endgültig geleert, Beiträge wandern in den PAPIERKORB — kein Endgültig-Löschen der KOs),
// (3) Ausführung + Bilanz (entfernt/Papierkorb/übersprungen mit Anzahl).
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportCleanupPreview, ImportCleanupResult } from "../api/types";
import { IMPORT_CLEANUP_TEXT } from "../lib/importCleanup";
import { Button, Card, SectionLabel } from "./ui";

export function ImportCleanup(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ImportCleanupPreview | null>(null);
  const [result, setResult] = useState<ImportCleanupResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async (): Promise<void> => {
    setBusy("preview");
    setError(null);
    setResult(null);
    try {
      setPreview(await endpoints.admin.import.cleanupPreview());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  const runCleanup = async (digest: string): Promise<void> => {
    setBusy("run");
    setError(null);
    try {
      // WP-SHIP8-FIX (bens F2): die Bestätigung schickt den Vorschau-Digest mit — der Server
      // vergleicht gegen den aktuellen Bestand und lehnt bei Drift ab (409, nichts verändert).
      setResult(await endpoints.admin.import.cleanupConfirm(digest));
      setPreview(null);
      // Queue und Bestand haben sich geändert — alle betroffenen Ansichten frisch laden.
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      if (err instanceof ApiError && err.code === "CLEANUP_DRIFT") {
        // Drift: ehrliche Meldung + Vorschau AUTOMATISCH neu laden (die Meldung bleibt stehen,
        // damit klar ist, warum die Zahlen gerade gewechselt haben).
        setError(t(IMPORT_CLEANUP_TEXT.drift));
        try {
          setPreview(await endpoints.admin.import.cleanupPreview());
        } catch {
          setPreview(null);
        }
      } else {
        setError(err instanceof ApiError ? err.message : t("state.error"));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-5 border-trust-warn-fill/40">
      <SectionLabel>{t(IMPORT_CLEANUP_TEXT.title)}</SectionLabel>
      <p className="mb-3 text-[13px] text-muted">{t(IMPORT_CLEANUP_TEXT.desc)}</p>

      {error ? (
        <p className="mb-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {error}
        </p>
      ) : null}

      {preview === null && result === null ? (
        <Button variant="ghost" disabled={busy !== null} onClick={() => void loadPreview()}>
          {busy === "preview" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
          {busy === "preview"
            ? t(IMPORT_CLEANUP_TEXT.previewLoading)
            : t(IMPORT_CLEANUP_TEXT.previewCta)}
        </Button>
      ) : null}

      {preview !== null ? (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-text">
            {t(IMPORT_CLEANUP_TEXT.previewResult, {
              n: preview.candidates,
              m: preview.importedKos,
            })}
          </p>
          {/* Ehrlich: KOs wandern in den Papierkorb (wiederherstellbar), die Queue wird geleert. */}
          <p className="text-[12.5px] text-muted">{t(IMPORT_CLEANUP_TEXT.confirmHint)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={busy !== null}
              onClick={() => void runCleanup(preview.digest)}
            >
              {busy === "run" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              {busy === "run" ? t(IMPORT_CLEANUP_TEXT.running) : t(IMPORT_CLEANUP_TEXT.confirmCta)}
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={() => setPreview(null)}>
              {t(IMPORT_CLEANUP_TEXT.cancel)}
            </Button>
          </div>
        </div>
      ) : null}

      {result !== null ? (
        <ul className="space-y-0.5 text-[12.5px] text-text">
          <li>· {t(IMPORT_CLEANUP_TEXT.doneCandidates, { n: result.removedCandidates })}</li>
          <li>· {t(IMPORT_CLEANUP_TEXT.doneKos, { n: result.trashedKos })}</li>
          {result.skipped.length > 0 ? (
            <li className="text-trust-warn-text">
              · {t(IMPORT_CLEANUP_TEXT.doneSkipped, { n: result.skipped.length })}
            </li>
          ) : null}
          {result.auditFailed ? (
            <li className="text-trust-warn-text">· {t(IMPORT_CLEANUP_TEXT.auditFailed)}</li>
          ) : null}
          {result.newCandidates > 0 ? (
            <li>· {t(IMPORT_CLEANUP_TEXT.newSince, { n: result.newCandidates })}</li>
          ) : null}
        </ul>
      ) : null}
    </Card>
  );
}
