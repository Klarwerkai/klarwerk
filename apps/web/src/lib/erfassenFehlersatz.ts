// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg` (R-0080, R-1002, R-0101) — DER SATZ IM ROTEN KASTEN.
// ================================================================================================
//
// Bis hierher reichten Blatt und Arbeitsraum jede `ApiError`-Meldung unverändert in den roten
// Kasten. Für fachliche Auskünfte des Servers ist das richtig (JOB 2690 F5: „Entwurf nicht
// gefunden" kommt übersetzt aus dem Meldungskatalog). Für drei Lagen war es falsch:
//
//   · FORMFEHLER (400 `BAD_REQUEST`, Meldung `draftPayload.<feld> muss …`): Der Mensch las einen
//     deutschen Techniksatz mit einem internen Feldnamen — auch in einer EN/NL-Sitzung (R-0080:
//     „der rote Kasten muss den richtigen Satz zeigen", R-0101: keine technischen Beschriftungen).
//   · ZU GROSS (413): je nach Weg eine deutsche Servermeldung oder Fastifys rohes „Request body is
//     too large". R-1002: „Zu lang ist nicht kaputt" — es wird als zu lang gemeldet.
//   · FRIST (408 `TIMEOUT` aus `api/client.ts`, `FrontDoorSaveTimeoutError`): Der Satz entsteht in
//     der eigenen Fläche, nicht am Server, und war nur deutsch.
//
// Alles andere bleibt, wie es war: eine fachliche Servermeldung gewinnt.
import type { TFunction } from "i18next";
import { ApiError } from "../api/client";
import { FrontDoorSaveTimeoutError } from "./captureFrontDoor";

/** Der Schlüssel für die drei übersetzten Lagen — oder `null`, wenn die Servermeldung gilt. */
export function erfassenFehlerSchluessel(err: unknown): string | null {
  if (err instanceof FrontDoorSaveTimeoutError) {
    return "einstieg.fehler.frist";
  }
  if (!(err instanceof ApiError)) {
    return null;
  }
  if (err.status === 413) {
    return "einstieg.fehler.zuLang";
  }
  if (err.status === 408 && err.code === "TIMEOUT") {
    return "einstieg.fehler.frist";
  }
  if (err.status === 400 && err.code === "BAD_REQUEST" && err.message.startsWith("draftPayload.")) {
    return "einstieg.fehler.form";
  }
  return null;
}

/** Der Satz für den roten Kasten beim Speichern und Einreichen. */
export function erfassenFehlersatz(err: unknown, t: TFunction, rueckfall: string): string {
  const schluessel = erfassenFehlerSchluessel(err);
  if (schluessel) {
    return t(schluessel);
  }
  if (err instanceof Error) {
    return err.message;
  }
  return rueckfall;
}
