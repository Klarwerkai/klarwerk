// produkt:20261010:assistenz-name-avatar — DIE AUSWAHL DER DREIZEHN MOTIVE.
//
// Eine Radiogruppe in zwei beschrifteten Abschnitten (je ein `<fieldset>` mit `<legend>`) („Ausdrucksstark" mit dem Original vorn,
// „Sachlich"). Jede Option ist ein echter Radioknopf: Tab erreicht die Gruppe, Pfeiltasten wechseln
// die Wahl, der Fokus ist als dicker Rahmen sichtbar, die gewählte Option trägt Rahmen, Haken und
// „Ausgewählt" — nicht nur eine Farbe. Die Vorschau zeigt das ganze Motiv (nichts abgeschnitten).
import { useTranslation } from "react-i18next";
import {
  ASSISTENZ_AVATAR_KATALOG,
  AVATAR_GRUPPEN,
  type AssistenzAvatarMotiv,
} from "../../lib/assistenzAvatare";
import { AvatarBild } from "./AvatarBild";

export function AvatarAuswahl({
  idBasis,
  wert,
  onWahl,
  fehler,
}: {
  idBasis: string;
  wert: string | null;
  onWahl: (id: string) => void;
  /** Feldfehler (z. B. „Bitte wähle ein Motiv."), direkt an der Gruppe erklärt. */
  fehler: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  const fehlerId = `${idBasis}-fehler`;
  return (
    <fieldset
      data-testid="assistenz-avatar-auswahl"
      aria-describedby={fehler ? fehlerId : undefined}
      className="m-0 min-w-0 space-y-3 border-0 p-0"
    >
      <legend className="block p-0 text-[12.5px] font-medium text-muted">
        {t("assistenz.avatar.legende")}
      </legend>
      {fehler ? (
        <p
          id={fehlerId}
          data-testid="assistenz-avatar-fehler"
          className="text-[12.5px] font-semibold text-trust-crit-text"
        >
          {fehler}
        </p>
      ) : null}
      {AVATAR_GRUPPEN.map((gruppe) => (
        <fieldset
          key={gruppe}
          className="m-0 min-w-0 space-y-1.5 border-0 p-0"
          data-avatar-gruppe={gruppe}
        >
          <legend className="block p-0 text-[12px] font-semibold text-text">
            {t(`assistenz.avatar.gruppe.${gruppe}`)}
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {ASSISTENZ_AVATAR_KATALOG.filter((m) => m.gruppe === gruppe).map((m) => (
              <AvatarOption
                key={m.id}
                motiv={m}
                name={`${idBasis}-avatar`}
                gewaehlt={wert === m.id}
                onWahl={onWahl}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  );
}

function AvatarOption({
  motiv,
  name,
  gewaehlt,
  onWahl,
}: {
  motiv: AssistenzAvatarMotiv;
  name: string;
  gewaehlt: boolean;
  onWahl: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const titel = t(`assistenz.avatar.name.${motiv.id}`);
  return (
    <label
      data-testid={`assistenz-avatar-${motiv.id}`}
      data-gewaehlt={gewaehlt ? "true" : "false"}
      className="relative block min-w-0 cursor-pointer"
    >
      {/* Der echte Radioknopf: unsichtbar, aber fokussierbar; sein Fokus und seine Wahl zeichnen
          die Karte daneben (`peer-…`). Der zugängliche Name ist der Motivname. */}
      <input
        type="radio"
        name={name}
        value={motiv.id}
        checked={gewaehlt}
        onChange={() => onWahl(motiv.id)}
        className="peer sr-only"
      />
      <span
        className={`flex h-full flex-col items-center gap-1 rounded-card border-2 p-1.5 text-center peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
          gewaehlt
            ? "border-ink bg-hairline-soft"
            : "border-hairline bg-surface hover:border-ink/40"
        }`}
      >
        <span className="grid aspect-square w-full max-w-[72px] place-items-center rounded-full bg-page p-1">
          <AvatarBild
            motiv={motiv}
            alt=""
            ersatzBeschriftung=""
            className="h-full w-full rounded-full"
          />
        </span>
        <span className="text-[11.5px] font-semibold leading-tight text-text">{titel}</span>
        {motiv.id === "original" ? (
          <span aria-hidden="true" className="text-[10.5px] leading-tight text-muted">
            {t("assistenz.avatar.originalHinweis")}
          </span>
        ) : null}
      </span>
      {gewaehlt ? (
        <span
          aria-hidden="true"
          title={t("assistenz.avatar.gewaehlt")}
          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white"
        >
          ✓
        </span>
      ) : null}
    </label>
  );
}
