import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { PublicUser } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { Button, Field, TextInput } from "../ui";

// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidung 18 — DIE WEISUNGSBEFUGNIS AM KONTO PFLEGEN.
// ================================================================================================
//
// „Dieses muss mit in den User-Account eingearbeitet werden." Die Karte zeigt die Befugnis des
// Kontos und lässt sie erteilen, ändern oder entziehen — über DENSELBEN Verwaltungsweg wie Rolle
// und Befristung (`PUT /api/users/:id`). Sie folgt nie aus der Rolle; ein Konto ohne Vermerk ist
// nicht weisungsbefugt, auch ein Admin nicht. Bereiche sind die Kategorien der Wissensobjekte;
// „Alle Bereiche" ist die Geschäftsführung.

export function WeisungsbefugnisPflege({ nutzer }: { nutzer: PublicUser }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const befugnis = nutzer.weisungsbefugnis;
  const [bereiche, setBereiche] = useState((befugnis?.bereiche ?? []).join(", "));
  const [gesamt, setGesamt] = useState(befugnis?.gesamt === true);

  const speichern = useMutation({
    mutationFn: (wert: { bereiche: string[]; gesamt: boolean } | null) =>
      endpoints.users.setWeisungsbefugnis(nutzer.id, wert),
    onSuccess: (_stand, wert) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      push("success", wert === null ? t("weisung.admin.entzogen") : t("weisung.admin.gespeichert"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const stand = !befugnis
    ? t("weisung.admin.keine")
    : `${
        befugnis.gesamt
          ? t("weisung.admin.gesamt")
          : t("weisung.admin.bereiche", { bereiche: befugnis.bereiche.join(", ") })
      } · ${t("weisung.admin.erteilt", {
        datum: new Date(befugnis.erteiltAm).toLocaleDateString(i18n.language),
      })}`;

  return (
    <div data-testid="weisungsbefugnis-pflege" className="space-y-2 border-t border-hairline pt-4">
      <div className="text-[12.5px] font-medium text-muted">{t("weisung.admin.titel")}</div>
      <div data-einst="weisungsbefugnis-stand" className="text-[13px] text-text">
        {stand}
      </div>
      <Field label={t("weisung.admin.feldBereiche")}>
        <TextInput
          value={bereiche}
          onChange={(e) => setBereiche(e.target.value)}
          disabled={gesamt}
          className="h-9"
        />
      </Field>
      <label className="inline-flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={gesamt} onChange={(e) => setGesamt(e.target.checked)} />
        <span>{t("weisung.admin.feldGesamt")}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={speichern.isPending}
          onClick={() => {
            const liste = bereiche
              .split(",")
              .map((b) => b.trim())
              .filter((b) => b.length > 0);
            if (!gesamt && liste.length === 0) {
              push("error", t("weisung.admin.leer"));
              return;
            }
            speichern.mutate({ bereiche: gesamt ? [] : liste, gesamt });
          }}
        >
          {t("weisung.admin.speichern")}
        </Button>
        {befugnis ? (
          <Button
            variant="ghost"
            disabled={speichern.isPending}
            onClick={() => speichern.mutate(null)}
          >
            {t("weisung.admin.entziehen")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
