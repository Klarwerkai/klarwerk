// OCR-02 · Bilder im Text eines Entwurfs oder Wissensobjekts automatisch lesen.
//
// Der Editor ist der Ort, an dem Bilder Klara im Text bereitgestellt werden: eingefügt, abgelegt,
// aus Word („Klara in Word", H02) oder der Browser-Erweiterung (H04) als Entwurf übernommen, oder
// im gespeicherten Wissensobjekt (Objektspeicher). Diese Komponente hängt an JEDEM RichTextEditor
// und liest die Bilder ohne Klick — Text über W01, Bildinhalt über den Beschreibungsweg der Fläche
// (W02, `useImageDescribe`, mit deren Herkunft und Vertraulichkeitsregel).
//
// Gelesen wird erst, wenn der Text kurz still steht (`RUHE_MS`), damit nicht jeder Tastendruck einen
// Lauf startet; unveränderte Bilder werden wiedererkannt und nicht erneut gelesen. Ein Lauf, der von
// einem neueren überholt wurde, wird verworfen.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribe } from "../app/ImageDescribeContext";
import {
  BILD_AUTOMATIK_VOREINSTELLUNG,
  type QuellenBefund,
  bildBeschreiberAus,
  rumpfBildEingang,
} from "../lib/bildAutomatik";
import { neueBildAnalyse } from "../lib/bildAutomatikLauf";
import { BildBefundListe } from "./BildBefundListe";

/** So lange muss der Text still stehen, bevor seine Bilder gelesen werden. */
export const RUHE_MS = 1500;

export function BildBefundeImRumpf({ html }: { html: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { available, describe } = useImageDescribe();
  // Ein Exemplar je Editor: dort werden unveränderte Bilder wiedererkannt.
  const [analyse] = useState(neueBildAnalyse);
  const [befund, setBefund] = useState<{ lauf: number; befund: QuellenBefund } | null>(null);
  const laufRef = useRef(0);
  const beschreibe = useMemo(
    () => bildBeschreiberAus({ available, describe }),
    [available, describe],
  );
  const name = t("bildautomatik.quelle.rumpf");
  const hatBilder = /<img\b/i.test(html);

  useEffect(() => {
    laufRef.current += 1;
    const lauf = laufRef.current;
    if (!hatBilder) {
      setBefund(null);
      return;
    }
    const uhr = setTimeout(() => {
      void analyse.analysiereQuelle(rumpfBildEingang(name, html), {
        automatik: BILD_AUTOMATIK_VOREINSTELLUNG,
        beschreibe,
        onFortschritt: (stand) => {
          if (laufRef.current === lauf) {
            setBefund({ lauf, befund: stand });
          }
        },
      });
    }, RUHE_MS);
    return () => clearTimeout(uhr);
  }, [analyse, beschreibe, hatBilder, html, name]);

  if (!befund) {
    return null;
  }
  return (
    <div data-testid="rumpf-bild-befunde" className="border-t border-hairline p-2">
      <BildBefundListe befund={befund.befund} lauf={befund.lauf} />
    </div>
  );
}
