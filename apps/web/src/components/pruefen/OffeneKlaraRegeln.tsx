import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";

export function OffeneKlaraRegeln({ konto }: { konto: string }): JSX.Element | null {
  const { t } = useTranslation();
  const regeln = useQuery({
    queryKey: ["validation", "klara-regelvorschlaege", konto],
    queryFn: endpoints.validation.klaraRegelvorschlaege,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
  if (regeln.isError) {
    return (
      <output className="mb-2 text-[12.5px] text-muted">
        {t("pruefboard.klara.fehler")}{" "}
        <button type="button" className="underline" onClick={() => void regeln.refetch()}>
          {t("pruefboard.klara.erneut")}
        </button>
      </output>
    );
  }
  if (!regeln.isFetchedAfterMount || !regeln.data?.length) return null;
  return (
    <details className="mb-2 rounded-card border border-hairline bg-surface px-3 py-2 text-[13px]">
      <summary className="cursor-pointer font-semibold text-text">
        {t("pruefboard.klara.titel")} ({regeln.data.length})
      </summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {regeln.data.map((p) => (
          <li key={p.vorschlagId}>
            <Link
              className="font-semibold underline"
              to={`/wissen/${encodeURIComponent(p.koId)}?vorschlag=${encodeURIComponent(p.vorschlagId)}`}
            >
              {p.titel}
            </Link>{" "}
            <span className="text-muted">
              · {t("pruefboard.klara.basis", { n: p.basis })}
              {p.bezug ? ` · ${t(`pruefboard.klara.${p.bezug}`)}` : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
