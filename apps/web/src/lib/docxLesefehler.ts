import type { TFunction } from "i18next";
import { DocxImportError } from "./docxArchive";

/** Derselbe verständliche DOCX-Satz an beiden bestehenden Datei-Eingängen. */
export function docxLesefehlerSatz(error: unknown, name: string, t: TFunction): string | null {
  if (!(error instanceof DocxImportError)) return null;
  return t(
    error.reason === "invalid-archive" ? "officeimport.docxArchiv" : "officeimport.docxGrenze",
    { name },
  );
}
