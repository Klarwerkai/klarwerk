// OCR-E01 · Die Fundstelle einer erkannten Textstelle direkt am Original (Auftrag
// produkt:20261012:klara-ocr-fundstellen-korrekturen).
//
// Öffnet das Originalbild genau der Quelle und Stelle (Folie/Bild), aus der der Text stammt, und
// markiert den Bereich, den die Texterkennung für das Wort gemessen hat (`lib/bildFundstelle.ts`).
//
//   · Bild und Markierung liegen im SELBEN Rahmen. Gedreht (Drehangabe des Fotos oder „Ansicht
//     drehen“) und vergrößert wird dieser Rahmen — die Markierung bleibt deshalb auf ihrer Stelle.
//   · Die Markierung ist nicht nur Farbe: gestrichelter Rahmen, Nummer und ein Satz, was markiert ist.
//   · Gibt es keine verlässliche Position, zeigt die Ansicht das ganze Bild und sagt, warum nichts
//     markiert ist — es wird keine Position erfunden.
//   · Bedienbar per Tastatur (vorhandener Dialog: Fokus, Escape, Schließen); das Original wird nur
//     angezeigt, nie verändert.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Drehung,
  type Markierung,
  type OhnePositionGrund,
  ansichtsMasse,
  gesamtDrehung,
} from "../lib/bildFundstelle";
import { Modal } from "./Modal";

/** Was die Ansicht zeigt: das Original, seine Stelle in der Quelle und die gewählte Textstelle. */
export interface FundstellenZiel {
  /** Kennung für den Neuaufbau der Ansicht (Befund und Stelle). */
  schluessel: string;
  src: string | null;
  quelle: string;
  /** Die Fundstelle im Wortlaut der Oberfläche („Folie 2, Bild 1“). */
  ort: string;
  /** Die gewählte Stelle, wie sie angezeigt wird. */
  wort: string;
  /** Das ursprünglich erkannte Wort an dieser Stelle, wenn die Stelle davon abweicht. */
  roh: string | null;
  markierung: Markierung;
}

const GRUND_SCHLUESSEL: Record<OhnePositionGrund, string> = {
  "keine-positionen": "bildfundstelle.grund.keinePositionen",
  "ohne-zuordnung": "bildfundstelle.grund.ohneZuordnung",
  "keine-masse": "bildfundstelle.grund.keineMasse",
  "drehung-unklar": "bildfundstelle.grund.drehungUnklar",
  ausserhalb: "bildfundstelle.grund.ausserhalb",
};

const MAX_BREITE = 640;
const ZOOM_SCHRITTE = [0.5, 0.75, 1, 1.5, 2, 3] as const;

const KNOPF =
  "inline-flex h-8 items-center rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40";

export function BildFundstelleAnsicht({
  ziel,
  onClose,
}: {
  ziel: FundstellenZiel;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [nutzerDrehung, setNutzerDrehung] = useState<Drehung>(0);
  const [zoomStufe, setZoomStufe] = useState(2);
  // Ohne gemessenen Rahmen (kein Bereich) bestimmt das geladene Bild die Größe der Bühne.
  const [natur, setNatur] = useState<{ breite: number; hoehe: number } | null>(null);
  const m = ziel.markierung;
  const zoom = ZOOM_SCHRITTE[zoomStufe] ?? 1;
  const rahmen = m.art === "bereich" ? m.rahmen : (natur ?? { breite: MAX_BREITE, hoehe: 360 });
  const drehung = gesamtDrehung(m.art === "bereich" ? m.drehung : 0, nutzerDrehung);
  const masse = ansichtsMasse(rahmen, drehung, zoom, MAX_BREITE);
  // Die Drehangabe der Datei: bei gemessenem Rahmen genau so wie gemessen, sonst wie der Browser.
  const drehangabe: "from-image" | "none" =
    m.art === "bereich" && !m.drehangabeAnwenden ? "none" : "from-image";
  const fotoGedreht = m.art === "bereich" && (m.drehangabeAnwenden || m.drehung !== 0);
  const markiertSatz =
    m.art !== "bereich"
      ? t("bildfundstelle.dialog.ohnePosition", { wort: ziel.wort })
      : ziel.roh !== null
        ? t("bildfundstelle.dialog.markiertErsetzt", { wort: ziel.wort, roh: ziel.roh })
        : t("bildfundstelle.dialog.markiert", { wort: ziel.wort });

  return (
    <Modal open onClose={onClose} title={t("bildfundstelle.dialog.titel", { ort: ziel.ort })} wide>
      <div
        data-testid="bild-fundstelle-ansicht"
        data-art={m.art}
        data-grund={m.art === "ohne-position" ? m.grund : ""}
        className="space-y-2 text-[12.5px] leading-relaxed"
      >
        <p className="text-muted">
          {t("bildfundstelle.dialog.quelle", { quelle: ziel.quelle, ort: ziel.ort })}
        </p>
        <p
          data-testid="bild-fundstelle-beschreibung"
          className={m.art === "bereich" ? "font-semibold text-text" : "text-trust-warn-text"}
        >
          {markiertSatz}
        </p>
        {m.art === "ohne-position" ? (
          <p data-testid="bild-fundstelle-ohne-position" className="text-trust-warn-text">
            {t(GRUND_SCHLUESSEL[m.grund])}
          </p>
        ) : null}
        {fotoGedreht ? <p className="text-muted">{t("bildfundstelle.dialog.gedreht")}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="bild-fundstelle-drehen"
            className={KNOPF}
            onClick={() => setNutzerDrehung((d) => gesamtDrehung(d, 90))}
          >
            {t("bildfundstelle.dialog.drehen")}
          </button>
          <button
            type="button"
            data-testid="bild-fundstelle-kleiner"
            className={KNOPF}
            disabled={zoomStufe === 0}
            onClick={() => setZoomStufe((z) => Math.max(0, z - 1))}
          >
            {t("bildfundstelle.dialog.kleiner")}
          </button>
          <button
            type="button"
            data-testid="bild-fundstelle-groesser"
            className={KNOPF}
            disabled={zoomStufe === ZOOM_SCHRITTE.length - 1}
            onClick={() => setZoomStufe((z) => Math.min(ZOOM_SCHRITTE.length - 1, z + 1))}
          >
            {t("bildfundstelle.dialog.groesser")}
          </button>
          <button
            type="button"
            className={KNOPF}
            onClick={() => {
              setNutzerDrehung(0);
              setZoomStufe(2);
            }}
          >
            {t("bildfundstelle.dialog.zuruecksetzen")}
          </button>
          <output className="text-muted">
            {t("bildfundstelle.dialog.ansicht", {
              drehung: nutzerDrehung,
              zoom: Math.round(zoom * 100),
            })}
          </output>
        </div>
        {ziel.src ? (
          <div className="max-h-[60vh] overflow-auto rounded-card border border-hairline bg-hairline-soft p-2">
            <div
              data-testid="bild-fundstelle-buehne"
              data-drehung={drehung}
              data-zoom={zoom}
              className="relative"
              style={{ width: masse.aussenBreite, height: masse.aussenHoehe }}
            >
              <div
                data-testid="bild-fundstelle-rahmen"
                className="absolute left-1/2 top-1/2"
                style={{
                  width: masse.innenBreite,
                  height: masse.innenHoehe,
                  transform: `translate(-50%, -50%) rotate(${drehung}deg)`,
                }}
              >
                <img
                  data-testid="bild-fundstelle-bild"
                  src={ziel.src}
                  alt={t("bildfundstelle.dialog.bildAlt", { quelle: ziel.quelle, ort: ziel.ort })}
                  className="block h-full w-full select-none"
                  style={{ imageOrientation: drehangabe }}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setNatur({ breite: img.naturalWidth, hoehe: img.naturalHeight });
                    }
                  }}
                />
                {m.art === "bereich"
                  ? m.bereiche.map((b, i) => (
                      <div
                        key={`${b.links}:${b.oben}:${b.breite}:${b.hoehe}`}
                        data-testid="bild-fundstelle-markierung"
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-sm border-[3px] border-dashed border-ai shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                        style={{
                          left: `${b.links}%`,
                          top: `${b.oben}%`,
                          width: `${b.breite}%`,
                          height: `${b.hoehe}%`,
                        }}
                      >
                        <span className="absolute -left-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        ) : (
          <p data-testid="bild-fundstelle-kein-bild" className="text-trust-warn-text">
            {t("bildfundstelle.dialog.keinBild")}
          </p>
        )}
        <p className="text-muted">{t("bildfundstelle.dialog.original")}</p>
      </div>
    </Modal>
  );
}
