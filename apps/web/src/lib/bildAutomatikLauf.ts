// OCR-02 · Die eine Bildanalyse der Web-App: die vorhandene Texterkennung (W01, `runImageOcr`)
// hinter der Automatik aus `bildAutomatik.ts`. Ein Exemplar je geöffneter App — damit erkennt sie
// unveränderte Bilder über alle Eingänge (Dateiimport, Bildanhang) wieder und liest sie nicht
// erneut. Die Befunde bleiben im Browser; das Bild verlässt ihn dabei nicht.
import { createBildAnalyse } from "./bildAutomatik";
import { runImageOcr } from "./files";

export const bildAnalyse = createBildAnalyse({ erkenne: (src) => runImageOcr(src) });
