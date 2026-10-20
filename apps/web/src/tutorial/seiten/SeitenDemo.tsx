import { useTranslation } from "react-i18next";
import type { TutorialDemoProps, TutorialUebergangProps } from "../typen";
import type { SeitenEintrag } from "./typen";
import { echtesZiel } from "./ziele";
export function SeitenDemo({
  seite,
  anhalten,
  reduziert,
}: TutorialDemoProps & { seite: SeitenEintrag }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-[13px] leading-relaxed">
      <p className="font-semibold">{t("seitentutorial.demo")}</p>
      <p>{t("seitentutorial.grenze")}</p>
      {seite.hilfeKeys?.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
      <button
        type="button"
        data-testid="seitentutorial-zeigen"
        className="rounded-btn border border-hairline px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        onClick={() => {
          anhalten();
          const el = echtesZiel(seite.ziel);
          if (el) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: "center", behavior: reduziert ? "auto" : "smooth" });
          }
        }}
      >
        {t("seitentutorial.zeigen")}
      </button>
    </div>
  );
}
export function SeitenUebergang({
  zurEchtenSeite,
  zielGefunden,
}: TutorialUebergangProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-[13px]">
      <p>{t("seitentutorial.grenze")}</p>
      <button
        type="button"
        data-testid="seitentutorial-uebergang"
        className="rounded-btn bg-ink px-3 py-2 font-semibold text-white"
        onClick={zurEchtenSeite}
      >
        {t("seitentutorial.uebergang")}
      </button>
      {!zielGefunden ? <output>{t("seitentutorial.fehlend")}</output> : null}
    </div>
  );
}
