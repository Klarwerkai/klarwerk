// ADMIN-15 · Der Kopf der Unternehmensfläche: Name und Logo auf der gewählten Akzentfarbe.
//
// DIESELBE KOMPONENTE IN VORSCHAU UND ECHTER SEITE. Die Verwaltung zeigt vor dem Speichern genau
// diesen Kopf (einmal in voller Breite, einmal in 390 px), und `/richtlinien` rendert ihn mit dem
// gespeicherten Profil. Eine nachgebaute Vorschau könnte etwas anderes zeigen als die Seite.
//
// LESBARKEIT: Das Logo steht auf einer hellen Platte — so bleibt es auf jeder Akzentfarbe sichtbar,
// egal welche Farben die Datei selbst hat. Der Name bricht um statt abgeschnitten zu werden; seine
// Farbe ist das kontrastgeprüfte Paar der Akzentfarbe (`AKZENTE`, mindestens 7:1).
//
// Das Kopfband der App und die feste Markenwahl bleiben davon unberührt.
import { useTranslation } from "react-i18next";
import { type ProfilAnzeige, logoSrc } from "../../api/unternehmen";

export function UnternehmensKopf({
  profil,
  testId = "unternehmen-kopf",
}: {
  profil: ProfilAnzeige;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      data-akzent={profil.akzent.id}
      className="flex min-w-0 items-center gap-3 rounded-card border border-hairline px-4 py-3"
      style={{ backgroundColor: profil.akzent.flaeche, color: profil.akzent.schrift }}
    >
      {profil.logo ? (
        <span className="grid h-12 shrink-0 place-items-center rounded-[8px] bg-white px-2">
          <img
            data-testid={`${testId}-logo`}
            src={logoSrc(profil.logo)}
            alt={t("unternehmen.kopf.logoAlt", { name: profil.name })}
            className="h-9 w-auto max-w-[120px] object-contain"
          />
        </span>
      ) : null}
      <p
        data-testid={`${testId}-name`}
        className="min-w-0 break-words text-[18px] font-semibold leading-snug"
      >
        {profil.name}
      </p>
    </div>
  );
}
