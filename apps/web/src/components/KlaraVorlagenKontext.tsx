// Klaras Vorlagenkontext (produkt:20261007:templates-default): mit welcher Vorlage gerade
// geschrieben wird, welche Felder sie hat und welche davon Pflicht sind — gelesen aus DEMSELBEN
// Stand, den der Editor setzt (`lib/aktiveVorlage.ts`). Kein Klara-Ausbau: Klara nennt nur, was der
// Editor verwendet und der Server beim Einreichen prüft, und dass freie Eingabe erreichbar bleibt.
import { useTranslation } from "react-i18next";
import { useAktiveVorlage } from "../lib/aktiveVorlage";
import { feldText, vorlagenName, vorlagenSprache } from "../lib/vorlagenStruktur";

export function KlaraVorlagenKontext({ pfad }: { pfad: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const aktiv = useAktiveVorlage();
  if (!pfad.startsWith("/erfassen") || aktiv === null) {
    return null;
  }
  const sprache = vorlagenSprache(i18n.language);
  const v = aktiv.vorlage;
  const pflicht = [
    ...(v?.felder ?? []),
    ...(aktiv.verbindlich && aktiv.verbindlich.id !== v?.id ? aktiv.verbindlich.felder : []),
  ]
    .filter((f) => f.pflicht)
    .map((f) => feldText(f, sprache).titel);
  return (
    <div data-testid="klara-vorlagen-kontext">
      <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("vorlagen.klara.label")}
      </div>
      <p className="text-[12px] leading-relaxed text-muted">
        {v
          ? t("vorlagen.klara.mit", { name: vorlagenName(v, sprache), version: v.version })
          : t("vorlagen.klara.frei")}
      </p>
      {v ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {t("vorlagen.klara.felder", {
            liste: v.felder.map((f) => feldText(f, sprache).titel).join(", "),
          })}
        </p>
      ) : null}
      {pflicht.length > 0 ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {t("vorlagen.klara.pflicht", { liste: [...new Set(pflicht)].join(", ") })}
        </p>
      ) : null}
      {aktiv.space ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {t("vorlagen.klara.space", { space: aktiv.space.name })}
        </p>
      ) : null}
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
        {t("vorlagen.klara.freiBleibt")}
      </p>
    </div>
  );
}
