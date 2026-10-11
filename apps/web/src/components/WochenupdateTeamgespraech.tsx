// RECHERCHE:pmo-fea-0004 — das Wissensupdate fürs Teamgespräch, abrufbar in der Output Factory.
//
// Ein Knopf, ein Dokument. Welche Objekte hineingehören und wie es aussieht, entscheidet allein der
// Server (`services/output/src/wochenupdate.ts`); dieser Baustein zeigt das Ergebnis und gibt es
// zum Kopieren oder Herunterladen her. Es gibt hier bewusst KEINEN Empfänger, keinen Zeitplan und
// kein „jede Woche automatisch": der Auftrag schliesst einen ungefragt eingerichteten Versand aus.
import { useMutation } from "@tanstack/react-query";
import { Copy, Download, FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import type { Wochenupdate } from "../api/types";
import { useToast } from "../app/ToastContext";
import { Button, Card, SectionLabel } from "./ui";

export function WochenupdateTeamgespraech(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  // Leer = der Server nimmt den heutigen Tag; ein gewähltes Datum geht unverändert hinaus.
  const [bis, setBis] = useState("");
  const [update, setUpdate] = useState<Wochenupdate | null>(null);

  const erzeugen = useMutation({
    mutationFn: () => endpoints.output.wochenupdate(bis || undefined),
    onSuccess: (u) => setUpdate(u),
    onError: () => push("error", t("wochenupdate.fehler")),
  });

  const kopieren = (): void => {
    if (update) {
      void navigator.clipboard
        ?.writeText(update.markdown)
        .then(() => push("success", t("out.copied")));
    }
  };
  const herunterladen = (): void => {
    if (!update) {
      return;
    }
    const blob = new Blob([update.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klarwerk-wissensupdate-${update.von}-bis-${update.bis}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const neu = update?.eintraege.filter((e) => e.art === "neu").length ?? 0;
  const ueberarbeitet = update?.eintraege.filter((e) => e.art === "ueberarbeitet").length ?? 0;

  return (
    <Card className="mb-4">
      <SectionLabel>{t("wochenupdate.titel")}</SectionLabel>
      <p className="mt-1 text-[12.5px] text-muted">{t("wochenupdate.einleitung")}</p>
      <p className="mt-1 text-[11.5px] text-muted-2">{t("wochenupdate.aufnahme")}</p>
      <p className="mt-1 text-[11.5px] text-muted-2">{t("wochenupdate.keinVersand")}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11.5px] text-muted">
          {t("wochenupdate.bis")}
          <input
            type="date"
            value={bis}
            onChange={(e) => setBis(e.target.value)}
            className="mt-0.5 rounded-input border border-hairline px-2 py-1 text-[13px] text-text"
          />
        </label>
        <Button variant="primary" disabled={erzeugen.isPending} onClick={() => erzeugen.mutate()}>
          <FileText size={15} />
          {t("wochenupdate.erzeugen")}
        </Button>
      </div>

      {update ? (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12.5px] text-text">
              {update.eintraege.length === 0
                ? t("wochenupdate.leer")
                : t("wochenupdate.zusammenfassung", {
                    von: update.von,
                    bis: update.bis,
                    neu,
                    ueberarbeitet,
                  })}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={kopieren}>
                <Copy size={14} />
                {t("out.copy")}
              </Button>
              <Button variant="ghost" onClick={herunterladen}>
                <Download size={14} />
                {t("out.download")}
              </Button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-card bg-page p-3 text-[12.5px] leading-relaxed text-text">
            {update.markdown}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
