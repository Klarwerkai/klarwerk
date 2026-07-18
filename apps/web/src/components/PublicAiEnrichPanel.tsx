import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { EnrichResult, ExternalKnowledgeStage, ExternalResult } from "../api/types";
import { safeHttpUrl } from "../lib/safeUrl";
import { ExternalUrlText } from "./ExternalUrlText";
import { HelpTip } from "./HelpTip";
import { Button, SectionLabel, TextInput } from "./ui";

// SCRUM-426 (Pedi 03.07.): Public-KI-Anreicherung im Rohwissen-Erfassen + Studio.
// Zwei Quellen, umschaltbar: Modellwissen (Cloud/lokal, generativ) ODER belegte Web-Suche.
// Nur sichtbar, wenn der Admin-Regler „externe Wissensabfrage" (SCRUM-414) auf „offen" steht;
// der Server setzt das zusätzlich durch. Ergebnisse sind IMMER klar als „extern · ungeprüft"
// gekennzeichnet und werden NUR auf bewussten Klick in den Entwurf übernommen (nie automatisch,
// nie validiert).
type EnrichMode = "model" | "web";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function PublicAiEnrichPanel({
  stage,
  locale,
  onAppendHtml,
}: {
  stage: ExternalKnowledgeStage;
  locale: "de" | "en";
  onAppendHtml: (html: string) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EnrichMode>("model");
  const [query, setQuery] = useState("");
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [webResults, setWebResults] = useState<ExternalResult[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const externLabel = t("enrich.externBadge");

  const runModel = useMutation({
    mutationFn: () => endpoints.reasoner.enrich(query.trim(), locale),
    onSuccess: (r) => {
      setEnriched(r);
      setWebResults([]);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const runWeb = useMutation({
    mutationFn: () => endpoints.external.search(query.trim()),
    onSuccess: (r) => {
      setWebResults(r);
      setEnriched(null);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // Selbst-Gate NACH allen Hooks (Rules of Hooks): die volle Anreicherung nur bei „offen";
  // der Server (SCRUM-414-Gate) setzt es zusätzlich durch.
  // SCRUM-433 (Pedi 03.07., VIP): nicht mehr spurlos unsichtbar — ein ruhiger Hinweis macht
  // die Funktion auffindbar und sagt, wo ein Admin sie freischaltet.
  if (stage !== "open") {
    return (
      <div className="mt-3 rounded-card border border-dashed border-ai/30 bg-ai-surface-1/25 p-2.5">
        <div className="flex items-center gap-1.5">
          <SectionLabel>{t("enrich.title")}</SectionLabel>
          <HelpTip title={t("enrich.title")} body={t("enrich.help")} />
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
          {t("enrich.disabledHint")}
        </p>
        {/* SCRUM-434 (Pedi 03.07., VIP): Ein-Klick-Sprung zum Regler — spart dem Admin das Suchen.
            /admin ist geschützt; wer keine Rechte hat, landet ehrlich auf dem Start. */}
        <Link
          to="/admin"
          className="mt-1.5 inline-block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ai hover:underline"
        >
          {t("enrich.openAdmin")} →
        </Link>
      </div>
    );
  }

  const busy = runModel.isPending || runWeb.isPending;
  const run = (): void => {
    if (query.trim().length === 0) {
      return;
    }
    if (mode === "model") {
      runModel.mutate();
    } else {
      runWeb.mutate();
    }
  };

  // SCRUM-438: übernommener Block trägt die stabile Herkunfts-Marke `panel-external` (überlebt die
  // Sanitisierung) — daraus leitet die Lese-Ansicht das Chip „Enthält externes, ungeprüftes Wissen" ab.
  const takeModel = (text: string): void => {
    onAppendHtml(
      `<div class="panel panel-external"><p><strong>[${externLabel}]</strong> ${escapeHtml(text)}</p></div>`,
    );
  };
  const takeWeb = (r: ExternalResult): void => {
    // SCRUM-527 (WP2): nur eine sichere absolute http/https-URL wird zum Anker im übernommenen HTML;
    // sonst (javascript:/data:/relativ) erscheint die URL als reiner Text — escapeHtml allein prüft
    // KEIN Schema. Zusätzlich greift die Body-Sanitisierung, dies ist die Egress-seitige Absicherung.
    const href = safeHttpUrl(r.url);
    const linkHtml = href
      ? `<a href="${escapeHtml(href)}">${escapeHtml(r.url)}</a>`
      : escapeHtml(r.url);
    onAppendHtml(
      `<div class="panel panel-external"><p><strong>[${externLabel}]</strong> ${escapeHtml(r.title)} — ${linkHtml}</p></div>`,
    );
  };

  return (
    <div className="mt-3 space-y-2 rounded-card border border-dashed border-ai/40 bg-ai-surface-1/40 p-3">
      <div className="flex items-center gap-1.5">
        <SectionLabel>{t("enrich.title")}</SectionLabel>
        <HelpTip title={t("enrich.title")} body={t("enrich.help")} />
      </div>
      <p className="text-[11.5px] text-muted-2">{t("enrich.disclaimer")}</p>

      {/* Quelle umschalten: Modellwissen ODER belegte Web-Suche. */}
      <div className="flex flex-wrap gap-1.5">
        {(["model", "web"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={
              mode === m
                ? "rounded-pill border border-ink bg-ink px-2.5 py-1 text-[12px] font-semibold text-white"
                : "rounded-pill border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
            }
          >
            {m === "model" ? t("enrich.modeModel") : t("enrich.modeWeb")}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("enrich.placeholder")}
        />
        <Button type="submit" variant="ghost" disabled={busy || query.trim().length === 0}>
          {busy ? t("enrich.running") : t("enrich.run")}
        </Button>
      </form>

      {err ? (
        <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12px] text-trust-crit-text">
          {err}
        </div>
      ) : null}

      {/* Modellwissen-Ergebnis (extern/ungeprüft). demo=true → kein Modell verbunden. */}
      {mode === "model" && enriched ? (
        enriched.demo || enriched.text.trim().length === 0 ? (
          <p className="text-[12px] text-muted-2">{t("enrich.noModel")}</p>
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-2.5">
            <span className="mb-1 inline-block rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-ai">
              {externLabel}
            </span>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
              {enriched.text}
            </p>
            <div className="mt-2">
              <Button variant="ghost" onClick={() => takeModel(enriched.text)}>
                {t("enrich.take")}
              </Button>
            </div>
          </div>
        )
      ) : null}

      {/* Web-Suche-Ergebnisse (mit Quelle/Link, extern/ungeprüft). */}
      {mode === "web" && webResults.length > 0 ? (
        <ul className="space-y-1.5">
          {webResults.map((r) => (
            <li key={r.url} className="rounded-card border border-hairline bg-surface p-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="mb-1 inline-block rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-ai">
                    {externLabel}
                  </span>
                  <div className="text-[13px] font-medium text-text">{r.title}</div>
                  {r.snippet ? (
                    <p className="mt-0.5 text-[11.5px] text-muted">{r.snippet}</p>
                  ) : null}
                  <ExternalUrlText
                    url={r.url}
                    className="block truncate font-mono text-[10.5px] text-ai hover:underline"
                  />
                </div>
                <Button variant="ghost" onClick={() => takeWeb(r)}>
                  {t("enrich.take")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === "web" && runWeb.isSuccess && webResults.length === 0 ? (
        <p className="text-[12px] text-muted-2">{t("enrich.empty")}</p>
      ) : null}
    </div>
  );
}
