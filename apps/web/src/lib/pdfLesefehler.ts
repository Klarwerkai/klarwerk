// ================================================================================================
// Aufnahme `gesamt-ocr` (R-0138) — DIE MELDUNG ZU EINER PDF, DIE ZU GROSS IST ODER ZU LANGE BRAUCHT.
// ================================================================================================
//
// JOB 2700 hat die Groessenkante vor dem Parser gebaut, aber nur an den zwei Eingaengen des
// Erfassens. Der dritte Eingang, der eine PDF liest — „Aus Dokument ergaenzen" (BodyExtractPanel,
// im Erfassen UND im Editor des Wissensobjekts) — rief `readPdfFile` ohne Kante: das gescannte
// Handbuch ueber 50 MB ging dort weiter ungebremst in den Parser. Damit beide Wege DENSELBEN Satz
// zeigen, steht er hier einmal und nicht als Abschrift in zwei Komponenten.
import type { TFunction } from "i18next";
import { PdfTooLargeError } from "./files";
import { PdfTimeoutError } from "./pdf";

/** Der ehrliche Satz zu einer PDF, die zu gross ist oder zu lange braucht — sonst `null`. */
export function pdfLesefehlerSatz(error: unknown, name: string, t: TFunction): string | null {
  if (error instanceof PdfTooLargeError) {
    // Die Grenze ABGERUNDET (14,9 statt 15,0): was angezeigt wird, muss real durchgehen — dieselbe
    // Regel wie maxRawAttachmentMb in uploadLimits.ts.
    return t("capture.file.pdfTooLarge", {
      name,
      mb: (error.size / 1_000_000).toFixed(1),
      limitMb: (Math.floor(error.limit / 100_000) / 10).toFixed(1),
    });
  }
  if (error instanceof PdfTimeoutError) {
    return t("capture.file.pdfTimeout", { name, s: Math.round(error.timeoutMs / 1000) });
  }
  return null;
}
