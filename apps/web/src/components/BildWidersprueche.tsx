// OCR-E05 · Mögliche Abweichungen zwischen Dokumenttext und erkanntem Bildtext — beide Angaben mit
// ihren Fundstellen nebeneinander (Logik in `lib/bildWidersprueche.ts`).
//
//   · Eine unsicher gelesene Bildzahl steht als „unsichere Erkennung“ da, nie als Widerspruch.
//   · Die Art steht als Wort, nicht nur als Farbe; beide Wortlaute bleiben unverändert.
//   · Die Anzeige schreibt nichts: weder Text noch Bild noch Befund werden geändert, und keine der
//     Angaben wird als die richtige ausgegeben.
import { useTranslation } from "react-i18next";
import { type Angabe, type BildTextAbweichung, angabeOrt } from "../lib/bildWidersprueche";
import type { Uebersetze } from "../lib/klaraBildKontext";

function Seite({
  titel,
  angabe,
  ort,
  testid,
  unsicherText,
}: {
  titel: string;
  angabe: Angabe;
  ort: string;
  testid: string;
  unsicherText: string;
}) {
  return (
    <div data-testid={testid} className="min-w-0 rounded-btn border border-hairline p-2">
      <div className="font-mono text-klein uppercase tracking-wider text-muted-2">{titel}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-text">
        <span data-testid={`${testid}-wert`}>{angabe.wortlaut}</span>
        {angabe.unsicher ? (
          <span className="font-normal text-trust-warn-text"> ({unsicherText})</span>
        ) : null}
      </div>
      <div data-testid={`${testid}-ort`} className="text-muted">
        {ort}
      </div>
      <div className="mt-0.5 break-words text-muted-2">{angabe.fundstelle.auszug}</div>
    </div>
  );
}

export function BildWidersprueche({
  abweichungen,
}: {
  abweichungen: readonly BildTextAbweichung[];
}): JSX.Element | null {
  const { t } = useTranslation();
  if (abweichungen.length === 0) {
    return null;
  }
  const ue: Uebersetze = (schluessel, werte) => String(t(schluessel, werte ?? {}));
  return (
    <section
      data-testid="bild-widersprueche"
      className="mt-2 rounded-card border border-hairline px-3 py-2"
    >
      <div className="text-[12.5px] font-semibold text-ink">{t("bildwidersprueche.titel")}</div>
      <p className="mt-0.5 text-muted">{t("bildwidersprueche.erklaerung")}</p>
      <ul className="mt-2 space-y-2">
        {abweichungen.map((a) => {
          const unsicher = a.art === "unsichere-erkennung";
          const textOrt = angabeOrt(a.text, ue);
          const bildOrt = angabeOrt(a.bild, ue);
          return (
            <li
              key={`${textOrt}|${bildOrt}|${a.text.wert}|${a.bild.wert}`}
              data-testid="bild-widerspruch"
              data-art={a.art}
              data-angabe={a.angabeArt}
            >
              <div className="font-semibold text-trust-warn-text">
                {unsicher
                  ? t("bildwidersprueche.art.unsicher")
                  : t("bildwidersprueche.art.moeglich")}
              </div>
              <p data-testid="bild-widerspruch-beschreibung" className="text-text">
                {t(
                  unsicher
                    ? "bildwidersprueche.beschreibung.unsicher"
                    : "bildwidersprueche.beschreibung.moeglich",
                  { sachverhalt: a.sachverhalt, text: a.text.wortlaut, bild: a.bild.wortlaut },
                )}
              </p>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Seite
                  titel={t("bildwidersprueche.seite.text")}
                  angabe={a.text}
                  ort={textOrt}
                  testid="bild-widerspruch-text"
                  unsicherText={t("bildwidersprueche.wert.unsicher")}
                />
                <Seite
                  titel={t("bildwidersprueche.seite.bild")}
                  angabe={a.bild}
                  ort={bildOrt}
                  testid="bild-widerspruch-bild"
                  unsicherText={t("bildwidersprueche.wert.unsicher")}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
