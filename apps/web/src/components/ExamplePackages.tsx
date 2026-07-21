// WP-B6 (Pedis Wunsch für die VIP-2-Tester): Kasten „Beispielpakete" im Admin-/Import-Bereich.
// Drei kuratierte Szenarien als Karten (Daten aus examplePackages.ts, kein UI-Hardcode): Titel,
// 1-Satz-Beschreibung, Laden-Knopf, ehrliche Bilanz (angelegt/übersprungen — idempotent, zweites
// Laden dupliziert nichts). Ehrlicher Hinweis zum Entfernen: das Import-Aufräumen (D-CLEAN)
// entfernt die Beispiele NICHT (eigene Provenienz) — sie verschwinden über den bestehenden
// Demo-Daten-entfernen-Weg.
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ExampleLoadResponse } from "../api/types";
import { EXAMPLE_PACKAGES_TEXT, EXAMPLE_PACKAGE_CARDS } from "../lib/examplePackages";
import { Button, Card, SectionLabel } from "./ui";

export function ExamplePackages(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExampleLoadResponse>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async (pkg: string): Promise<void> => {
    setBusy(pkg);
    setError(null);
    try {
      const result = await endpoints.admin.import.loadExamples(pkg);
      setResults((prev) => ({ ...prev, [pkg]: result }));
      // Neuer Bestand — Bibliothek/KO-Ansichten frisch laden.
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-5">
      <SectionLabel>{t(EXAMPLE_PACKAGES_TEXT.title)}</SectionLabel>
      <p className="mb-3 text-[13px] text-muted">{t(EXAMPLE_PACKAGES_TEXT.hint)}</p>

      {error ? (
        <p className="mb-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {EXAMPLE_PACKAGE_CARDS.map((card) => {
          const result = results[card.id];
          return (
            <div key={card.id} className="rounded-card border border-hairline bg-page p-3">
              <p className="text-[13.5px] font-semibold text-text">{t(card.titleKey)}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{t(card.descKey)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="ghost" disabled={busy !== null} onClick={() => void load(card.id)}>
                  {busy === card.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <PackagePlus size={15} />
                  )}
                  {busy === card.id
                    ? t(EXAMPLE_PACKAGES_TEXT.loading)
                    : t(EXAMPLE_PACKAGES_TEXT.load)}
                </Button>
                {result ? (
                  <span className="text-[12.5px] text-muted">
                    {t(EXAMPLE_PACKAGES_TEXT.result, {
                      created: result.created,
                      skipped: result.skipped,
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
