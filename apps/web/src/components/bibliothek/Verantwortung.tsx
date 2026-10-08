// ================================================================================================
// R-0507 / R-0546 — WER VERANTWORTLICH IST, WER GEPRÜFT UND WER FREIGEGEBEN HAT.
// ================================================================================================
//
// Das Aggregat (`ownership`: owner, reviewers, validators) gibt es seit JOB 557 am Objekt; gezeigt
// wurde es bis hierher nirgends. Diese Zeile macht es lesbar — und sagt ehrlich, wenn KEIN
// Verantwortlicher benannt ist: dann gilt der Autor (benannter Rückfall, `ownership.ts`
// `responsibleOf`), und genau das steht da, statt den Autor als Eigentümer auszugeben.
//
// Der benannte Eigentümer selbst sieht „Verantwortung zurückgeben". Ob er es DARF, entscheidet der
// Server (`NOT_OWNER`); der Knopf erscheint nur, damit niemand einen Weg angeboten bekommt, der
// sicher scheitert.
//
// R-0546: der Hinweissatz darunter trennt Bearbeitung und Verantwortung ausdrücklich — Ursprung,
// Übergabe und Historie nennen Bearbeiter, nicht Verantwortliche.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { KnowledgeObject } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { Button } from "../ui";

export function Verantwortung({
  ko,
  nameOf,
  angemeldet,
}: {
  ko: Pick<KnowledgeObject, "id" | "author" | "ownership">;
  nameOf: (id: string) => string;
  /** Kennung der angemeldeten Person — `undefined`, solange keine Sitzung bekannt ist. */
  angemeldet: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const owner = ko.ownership?.owner;
  const reviewers = ko.ownership?.reviewers ?? [];
  const validators = ko.ownership?.validators ?? [];
  const zurueckgeben = useMutation({
    mutationFn: () => endpoints.ko.act(ko.id, { action: "ownership-release" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ko", ko.id] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      push("success", t("verantwortung.zurueckgegeben"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const namen = (ids: readonly string[]): string =>
    ids.length > 0 ? ids.map(nameOf).join(", ") : t("verantwortung.niemand");

  return (
    <div data-ko-verantwortung className="mt-3 border-t border-hairline pt-3 text-[12.5px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-2">{t("verantwortung.eigentuemer")}</dt>
        <dd data-ko-verantwortung-eigentuemer className="text-text">
          {owner !== undefined ? nameOf(owner) : t("verantwortung.eigentuemerFehlt")}
        </dd>
        <dt className="text-muted-2">{t("verantwortung.geprueftVon")}</dt>
        <dd data-ko-verantwortung-geprueft className="text-text">
          {namen(reviewers)}
        </dd>
        <dt className="text-muted-2">{t("verantwortung.freigegebenVon")}</dt>
        <dd data-ko-verantwortung-freigegeben className="text-text">
          {namen(validators)}
        </dd>
      </dl>
      <p data-ko-verantwortung-hinweis className="mt-2 text-[11.5px] text-muted">
        {t("verantwortung.bearbeiterHinweis")}
      </p>
      {owner !== undefined && angemeldet !== undefined && owner === angemeldet ? (
        <Button
          variant="ghost"
          className="mt-2"
          disabled={zurueckgeben.isPending}
          onClick={() => zurueckgeben.mutate()}
        >
          {t("verantwortung.zurueckgeben")}
        </Button>
      ) : null}
    </div>
  );
}
