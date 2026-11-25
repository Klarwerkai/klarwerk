import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { Button, Field, TextInput } from "../ui";

export function QuellenAuswahl({
  ids,
  kontext,
  setIds,
}: { ids: string[]; kontext: string; setIds: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [suche, setSuche] = useState("");
  const q = suche.trim();
  const treffer = useQuery({
    queryKey: ["teamassistenten", kontext, "quellensuche", q],
    queryFn: () => endpoints.library.search({ q, status: "validiert" }),
    enabled: q.length >= 2,
    retry: false,
    gcTime: 0,
  });
  const gewaehlt = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["teamassistenten", kontext, "quelle", id],
      queryFn: () => endpoints.ko.get(id),
      retry: false,
      gcTime: 0,
    })),
  });
  return (
    <div className="space-y-3">
      <Field label={t("teamassistenten.quellenSuche")}>
        <TextInput
          data-testid="teamassistent-quellensuche"
          type="search"
          value={suche}
          maxLength={200}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t("teamassistenten.suchHinweis")}
        />
      </Field>
      {q.length >= 2 ? (
        <div aria-live="polite" className="space-y-1">
          {treffer.isError ? (
            <span role="alert">{t("teamassistenten.fehler")}</span>
          ) : treffer.isPending ? (
            <span>{t("teamassistenten.laden")}</span>
          ) : null}
          {treffer.isSuccess && !treffer.data.length ? (
            <span className="text-sm text-muted">{t("teamassistenten.keinTreffer")}</span>
          ) : null}
          {treffer.isSuccess
            ? treffer.data
                .filter((ko) => ko.status === "validiert" && !ids.includes(ko.id))
                .slice(0, 20)
                .map((ko) => (
                  <Button
                    className="block text-left"
                    key={ko.id}
                    disabled={ids.length >= 20}
                    aria-label={t("teamassistenten.hinzufuegen", { titel: ko.title })}
                    onClick={() => setIds([...ids, ko.id])}
                  >
                    + {ko.title}
                  </Button>
                ))
            : null}
        </div>
      ) : null}
      {ids.length ? (
        <ul className="divide-y divide-hairline rounded-input border border-hairline">
          {ids.map((id, index) => {
            const quelle = gewaehlt[index];
            const titel = quelle?.isPending
              ? t("teamassistenten.laden")
              : quelle?.isSuccess && quelle.data.status === "validiert"
                ? quelle.data.title
                : t("teamassistenten.quelleFehlt");
            return (
              <li key={id} className="flex items-center justify-between gap-2 px-3 py-1 text-sm">
                <span>{titel}</span>
                <Button
                  variant="ghost"
                  aria-label={t("teamassistenten.entfernen", { titel })}
                  onClick={() => setIds(ids.filter((wert) => wert !== id))}
                >
                  {t("teamassistenten.entfernenKurz")}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
