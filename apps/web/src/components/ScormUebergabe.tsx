// produkt:wettbewerb:20261003:lernplattform — der kurze Bedienweg der Übergabe an eine Lernplattform.
//
// Er sitzt in der Output Factory unter der Reihenfolge der gewählten Bausteine und nimmt GENAU diese
// Reihenfolge. Zwei Schritte, beide gegen den Server: „Export prüfen" (zeigt Befunde, erzeugt
// nichts) und „SCORM-Paket herunterladen" (nur, wenn die Prüfung nichts blockiert). Ob der Export
// zulässig ist, entscheidet ausschliesslich der Server — dieser Baustein zeigt nur sein Urteil.
import { useMutation } from "@tanstack/react-query";
import { Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ScormBefund, ScormExportBody, ScormPruefung, ScormSprache } from "../api/types";
import { useToast } from "../app/ToastContext";
import { Button, Card, SectionLabel } from "./ui";

export function ScormUebergabe({ koIds }: { koIds: string[] }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const [sprache, setSprache] = useState<ScormSprache>(i18n.language === "en" ? "en" : "de");
  const [empfaenger, setEmpfaenger] = useState("");
  const [liste, setListe] = useState<{ id: string; label: string }[]>([]);
  const [urteil, setUrteil] = useState<{ fuer: string; p: ScormPruefung } | null>(null);

  // Ein Urteil gilt nur für genau die Eingabe, für die es gefällt wurde: jede Änderung an Auswahl,
  // Reihenfolge, Sprache oder Empfänger blendet es aus, bis erneut geprüft wurde.
  const schluesselVon = (b: ScormExportBody): string =>
    `${b.koIds.join(",")}|${b.sprache}|${b.empfaenger}`;
  const body: ScormExportBody = { koIds, sprache, empfaenger };
  const pruefung = urteil?.fuer === schluesselVon(body) ? urteil.p : null;

  const pruefen = useMutation({
    mutationFn: (b: ScormExportBody) => endpoints.output.scormPruefen(b),
    onError: () => push("error", t("lmsexport.fehler")),
  });

  const pruefeMit = async (b: ScormExportBody): Promise<void> => {
    try {
      let geprueft = b;
      let p = await pruefen.mutateAsync(b);
      // Noch kein Empfänger gewählt: den ersten freigegebenen nehmen und für IHN prüfen — das
      // Urteil ohne Empfänger wäre für keine wählbare Eingabe gültig.
      const erster = p.empfaenger[0];
      if (!b.empfaenger && erster) {
        geprueft = { ...b, empfaenger: erster.id };
        setEmpfaenger(erster.id);
        p = await pruefen.mutateAsync(geprueft);
      }
      setListe(p.empfaenger);
      setUrteil({ fuer: schluesselVon(geprueft), p });
    } catch {
      // Gemeldet hat bereits `onError`; ein Urteil gibt es in diesem Fall nicht.
    }
  };

  const herunterladen = useMutation({
    mutationFn: (b: ScormExportBody) => endpoints.output.scormPaket(b),
    onSuccess: ({ blob, dateiname }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dateiname;
      a.click();
      URL.revokeObjectURL(url);
      push("success", t("lmsexport.heruntergeladen", { datei: dateiname }));
    },
    onError: (err, b) => {
      const p =
        err instanceof ApiError ? (err.details.pruefung as ScormPruefung | undefined) : undefined;
      if (p) {
        setUrteil({ fuer: schluesselVon(b), p });
      }
      push("error", t("lmsexport.fehler"));
    },
  });

  const blockiert = pruefung?.befunde.filter((b) => b.schwere === "blockiert") ?? [];
  const hinweise = pruefung?.befunde.filter((b) => b.schwere === "hinweis") ?? [];
  const zeile = (b: ScormBefund, i: number): JSX.Element => (
    <li key={`${b.code}-${b.koId ?? ""}-${i}`} className="text-[12px] text-muted">
      <span className="font-semibold text-ink">{t(`lmsexport.bereich.${b.bereich}`)}</span>
      {" · "}
      {t(`lmsexport.befund.${b.code}`)}
      {b.detail ? <span className="text-muted-2"> ({b.detail})</span> : null}
    </li>
  );

  return (
    <Card className="mb-4" data-testid="scorm-uebergabe">
      <SectionLabel>{t("lmsexport.titel")}</SectionLabel>
      <p className="mt-1 text-[12.5px] text-muted">{t("lmsexport.einleitung")}</p>
      <p className="mt-1 text-[11.5px] text-muted-2">{t("lmsexport.grenzen")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] text-muted">
          {t("lmsexport.sprache")}
          <select
            className="mt-1 block w-full rounded-input border border-hairline px-2 py-1.5 text-[13px]"
            value={sprache}
            onChange={(e) => setSprache(e.target.value === "en" ? "en" : "de")}
          >
            <option value="de">{t("lmsexport.sprache.de")}</option>
            <option value="en">{t("lmsexport.sprache.en")}</option>
          </select>
        </label>
        <label className="text-[12px] text-muted">
          {t("lmsexport.empfaenger")}
          <select
            className="mt-1 block w-full rounded-input border border-hairline px-2 py-1.5 text-[13px]"
            value={empfaenger}
            onChange={(e) => setEmpfaenger(e.target.value)}
          >
            {liste.length === 0 ? <option value="">{t("lmsexport.keineEmpfaenger")}</option> : null}
            {liste.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          disabled={koIds.length === 0 || pruefen.isPending}
          onClick={() => void pruefeMit(body)}
        >
          <ShieldCheck size={14} />
          {t("lmsexport.pruefen")}
        </Button>
        <Button
          variant="primary"
          disabled={!pruefung?.exportierbar || herunterladen.isPending}
          onClick={() => herunterladen.mutate(body)}
        >
          <Download size={14} />
          {t("lmsexport.herunterladen")}
        </Button>
      </div>

      {pruefung ? (
        <output className="mt-3 block rounded-card bg-page p-3">
          <p className="text-[12.5px] text-text">
            {pruefung.exportierbar && pruefung.fassung
              ? t("lmsexport.exportierbar", { kennung: pruefung.fassung.kennung })
              : t("lmsexport.blockiert")}
          </p>
          {blockiert.length > 0 ? (
            <>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                {t("lmsexport.befunde")}
              </div>
              <ul className="mt-1 space-y-1">{blockiert.map(zeile)}</ul>
            </>
          ) : null}
          {hinweise.length > 0 ? (
            <>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                {t("lmsexport.hinweise")}
              </div>
              <ul className="mt-1 space-y-1">{hinweise.map(zeile)}</ul>
            </>
          ) : null}
        </output>
      ) : null}
    </Card>
  );
}
