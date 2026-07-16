import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Globe } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { HelpTip } from "../components/HelpTip";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { buildExternalSearchView } from "../lib/externalKnowledge";

// SCRUM-225: eigenständiger External-Knowledge-Einstieg. Schließt die Lücke aus SCRUM-224 —
// externe Quellen ohne vorher geöffnetes KO durchsuchbar. Nutzt ausschließlich die vorhandene
// external.search-API (Server-Proxy, SCRUM-118). KEIN Anhängen, KEIN Auto-Import ohne KO-Kontext;
// EXTERNAL_SEARCH=off / 501 wird ehrlich angezeigt. Keine Peer-Validierungsbehauptung.
export function ExternalKnowledge(): JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const search = useMutation({
    mutationFn: (q: string) => endpoints.external.search(q),
  });

  const err = search.error;
  const view = buildExternalSearchView({
    pending: search.isPending,
    hasSearched,
    error: err
      ? {
          status: err instanceof ApiError ? err.status : undefined,
          code: err instanceof ApiError ? err.code : undefined,
          message: err instanceof Error ? err.message : t("ext.unavailable"),
        }
      : null,
    results: search.data,
  });

  function submit(e: FormEvent): void {
    e.preventDefault();
    const q = query.trim();
    if (q.length === 0) {
      return;
    }
    setHasSearched(true);
    search.mutate(q);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t("extpage.kicker")}
        title={t("extpage.title")}
        actions={
          <HelpTip title={t("extpage.help.scope.title")} body={t("extpage.help.scope.body")} />
        }
      />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("extpage.intro")}</p>

      <Card className="space-y-2">
        <form className="flex gap-2" onSubmit={submit}>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ext.placeholder")}
          />
          <Button type="submit" disabled={search.isPending || query.trim().length === 0}>
            {t("ext.search")}
          </Button>
        </form>
        <p className="text-[11.5px] text-muted-2">{t("extpage.note")}</p>
      </Card>

      <div className="mt-4">
        {view.kind === "disabled" ? (
          <Card className="border-dashed text-center text-sm text-muted">
            {t("extpage.disabled")}
          </Card>
        ) : null}

        {view.kind === "error" ? (
          <Card className="border-dashed text-center text-sm text-danger">{view.message}</Card>
        ) : null}

        {view.kind === "loading" ? (
          <Card className="text-center text-sm text-muted">{t("state.loading")}</Card>
        ) : null}

        {view.kind === "empty" ? (
          <Card className="border-dashed text-center text-sm text-muted">
            {t("extpage.noResults")}
          </Card>
        ) : null}

        {view.kind === "results" ? (
          <div className="space-y-3">
            <SectionLabel>{t("extpage.resultsTitle", { n: view.results.length })}</SectionLabel>
            <ul className="space-y-2">
              {view.results.map((r) => (
                <li key={r.url} className="rounded-input border border-hairline p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-medium text-text">{r.title}</span>
                    <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                      {r.provider}
                    </span>
                  </div>
                  {r.snippet ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{r.snippet}</p>
                  ) : null}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 truncate font-mono text-[10.5px] text-ai hover:underline"
                  >
                    <ExternalLink size={11} />
                    {r.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.kind === "idle" ? (
          <Card className="border-dashed text-center text-sm text-muted-2">
            <Globe size={18} className="mx-auto mb-1.5 opacity-60" />
            {t("extpage.idle")}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
