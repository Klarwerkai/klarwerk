// ================================================================================================
// AUFNAHME gesamt-peer-validierung · Nutzerentscheid Antwort 18 (11.10.2026) — DIE WEISUNGSBEFUGNIS
// AM KONTO.
// ================================================================================================
//
// „Weisungsbefugnis ausdrücklich im Benutzerkonto und Zuständigkeitsbereich; technische
// Administration genügt nicht." Diese Karte steht in der Kontoverwaltung neben Rolle und
// Befristung: sie zeigt, für welche Bereiche das Konto eigene Weisungen unmittelbar gültig
// einstellen darf, und vergibt oder entzieht die Befugnis. `*` steht für das ganze Unternehmen
// (Geschäftsführung). Die Rolle des Kontos spielt dafür keine Rolle — auch ein Admin hat die
// Befugnis nur, wenn sie hier vergeben ist. Der Server vermerkt jede Änderung
// (`user.weisungsbefugnis-set`).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { PublicUser } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { Button, Field, TextInput } from "../ui";

/** Die Eingabe „Wartung, Qualität" → `["Wartung", "Qualität"]` (leer → keine Bereiche). */
export function bereicheAusEingabe(eingabe: string): string[] {
  const teile = eingabe.split(",").map((b) => b.trim());
  return [...new Set(teile.filter((b) => b.length > 0))];
}

export function Weisungsbefugnis({
  nutzer,
}: {
  nutzer: Pick<PublicUser, "id" | "weisungsbefugnis">;
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const bisher = nutzer.weisungsbefugnis?.bereiche ?? [];
  const [eingabe, setEingabe] = useState(bisher.join(", "));
  const speichern = useMutation({
    mutationFn: (bereiche: string[] | null) =>
      endpoints.users.setWeisungsbefugnis(nutzer.id, bereiche),
    onSuccess: (konto) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setEingabe((konto?.weisungsbefugnis?.bereiche ?? []).join(", "));
      push("success", t("pruefablauf.befugnis.gespeichert"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const bereiche = bereicheAusEingabe(eingabe);
  const stand = bisher.map((b) => (b === "*" ? t("pruefablauf.befugnis.alle") : b)).join(", ");
  return (
    <div data-testid="konto-weisungsbefugnis" className="space-y-2 border-t border-hairline pt-4">
      <div className="text-[12.5px] font-medium text-muted">{t("pruefablauf.befugnis.titel")}</div>
      <div data-testid="konto-weisungsbefugnis-stand" className="text-[13px] text-text">
        {bisher.length === 0
          ? t("pruefablauf.befugnis.keine")
          : t("pruefablauf.befugnis.bereiche", { bereiche: stand })}
      </div>
      <p className="text-[12px] text-muted-2">{t("pruefablauf.befugnis.hinweis")}</p>
      <Field label={t("pruefablauf.befugnis.eingabe")}>
        <TextInput
          data-testid="konto-weisungsbefugnis-eingabe"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          className="h-9"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          data-testid="konto-weisungsbefugnis-speichern"
          disabled={speichern.isPending || bereiche.length === 0}
          onClick={() => speichern.mutate(bereiche)}
        >
          {t("pruefablauf.befugnis.speichern")}
        </Button>
        {bisher.length === 0 ? null : (
          <Button
            variant="ghost"
            data-testid="konto-weisungsbefugnis-entziehen"
            disabled={speichern.isPending}
            onClick={() => speichern.mutate(null)}
          >
            {t("pruefablauf.befugnis.entziehen")}
          </Button>
        )}
      </div>
    </div>
  );
}
