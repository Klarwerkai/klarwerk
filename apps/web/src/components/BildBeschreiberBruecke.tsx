// OCR-02 · Der Weg zur Bildbeschreibung (W02) für das automatische Bildlesen einer Fläche, deren
// Logik AUSSERHALB ihres eigenen `ImageDescribeProvider` steht (Erfassen: Dateiimport und
// Bildanhänge laufen in Ereignis-Handlern des Arbeitsraums). Die Brücke sitzt INNERHALB des
// Providers, holt den einen Weg (`useImageDescribe`, mit der Herkunft und Vertraulichkeit des
// Entwurfs) und legt daraus den Beschreiber in `ziel` ab. Kein eigener describe-Aufruf, keine zweite
// Verdrahtung (mega50).
import { type MutableRefObject, useEffect } from "react";
import { useImageDescribe } from "../app/ImageDescribeContext";
import { type BildBeschreiber, bildBeschreiberAus } from "../lib/bildAutomatik";

export function BildBeschreiberBruecke({
  ziel,
}: {
  ziel: MutableRefObject<BildBeschreiber | undefined>;
}): null {
  const { available, describe } = useImageDescribe();
  useEffect(() => {
    ziel.current = bildBeschreiberAus({ available, describe });
  }, [available, describe, ziel]);
  return null;
}
