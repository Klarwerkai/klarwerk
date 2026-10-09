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
//
// R-0507 „… oder freigeben": der benannte Eigentümer, der zugleich freigabeberechtigt ist
// (`darfFreigeben` = Recht `ko.validate`), gibt das Objekt hier inhaltlich frei
// (`owner-validate`). Liegt eine offene Dublette vor, antwortet der Server 409
// `DUPLICATE_ACK_REQUIRED`; dann steht die ausdrückliche Bestätigung als zweiter Knopf da —
// derselbe Vertrag wie auf der Prüfkarte.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  darfFreigeben = false,
}: {
  ko: Pick<KnowledgeObject, "id" | "author" | "ownership" | "status">;
  nameOf: (id: string) => string;
  /** Kennung der angemeldeten Person — `undefined`, solange keine Sitzung bekannt ist. */
  angemeldet: string | undefined;
  /** Trägt die angemeldete Rolle das Freigaberecht (`ko.validate`)? Der Server prüft es ohnehin. */
  darfFreigeben?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const owner = ko.ownership?.owner;
  const reviewers = ko.ownership?.reviewers ?? [];
  const validators = ko.ownership?.validators ?? [];
  const istEigentuemer = owner !== undefined && angemeldet !== undefined && owner === angemeldet;
  const [dubletteOffen, setDubletteOffen] = useState(false);
  const auffrischen = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", ko.id] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
  };
  const fehler = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));
  const zurueckgeben = useMutation({
    mutationFn: () => endpoints.ko.act(ko.id, { action: "ownership-release" }),
    onSuccess: () => {
      auffrischen();
      push("success", t("verantwortung.zurueckgegeben"));
    },
    onError: fehler,
  });
  const freigeben = useMutation({
    mutationFn: (dubletteGesehen: boolean) =>
      endpoints.ko.act(
        ko.id,
        dubletteGesehen
          ? { action: "owner-validate", duplicateAcknowledged: true }
          : { action: "owner-validate" },
      ),
    onSuccess: () => {
      setDubletteOffen(false);
      auffrischen();
      push("success", t("verantwortung.freigegeben"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "DUPLICATE_ACK_REQUIRED") {
        setDubletteOffen(true);
      }
      fehler(e);
    },
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
      {istEigentuemer ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {darfFreigeben && ko.status !== "validiert" ? (
            <Button
              variant="primary"
              disabled={freigeben.isPending}
              onClick={() => freigeben.mutate(false)}
            >
              {t("verantwortung.freigeben")}
            </Button>
          ) : null}
          {darfFreigeben && dubletteOffen ? (
            <Button
              variant="ghost"
              disabled={freigeben.isPending}
              onClick={() => freigeben.mutate(true)}
            >
              {t("verantwortung.freigebenDublette")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            disabled={zurueckgeben.isPending}
            onClick={() => zurueckgeben.mutate()}
          >
            {t("verantwortung.zurueckgeben")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
