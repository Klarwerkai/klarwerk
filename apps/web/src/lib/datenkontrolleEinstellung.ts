// ================================================================================================
// PP-03 · SETUP › KLARA „OFFENE DATENPUNKTE IN DER DATENLAGE“ (Auftrag
// produkt:20261015:klara-powerpoint-validierung, Paket Abschnitt 7).
// ================================================================================================
//
// Die Einstellung liegt im vorhandenen Assistenzprofil des eigenen Kontos (`/api/me/assistenz`,
// Feld `datenkontrolleOffenePunkte`) — derselbe Weg wie OCR-03 (`bildAutomatikEinstellung.ts`),
// kein zweiter Speicherort, keine neue Route.
//
// DIE WAHL:
//   · `alle`         — Voreinstellung: die Datenlage führt jede nicht bestandene Prüfung einzeln.
//   · `nur_klaerung` — Klärungen, überholte und wieder geöffnete Prüfungen einzeln; noch nie
//                      geprüfte offene Prüfungen als Anzahl, die sich einblenden lässt.
// Solange das Profil lädt, nicht gelesen werden konnte oder keine Wahl trägt, gilt `alle`: im
// Zweifel wird mehr gezeigt, nie weniger. Eine Anzeigeregel ändert keinen Prüfstand.
import { assistenzProfilApi } from "../api/assistenzProfil";
import { ApiError } from "../api/client";
import {
  type AssistenzStand,
  assistenzStand,
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  useAssistenzStand,
} from "./assistenzProfil";

/** Welche offenen Punkte die Datenlage einzeln aufführt (Voreinstellung `alle`). */
export type OffenePunkteWahl = "alle" | "nur_klaerung";

export function offenePunkteWahl(s: AssistenzStand): OffenePunkteWahl {
  return s.status === "bereit" ? (s.antwort?.profil?.datenkontrolleOffenePunkte ?? "alle") : "alle";
}

export function useOffenePunkteWahl(): OffenePunkteWahl {
  return offenePunkteWahl(useAssistenzStand());
}

export type OffenePunkteSpeichern = "gespeichert" | "konflikt" | "fehler" | "ohne-konto";

/** Speichert die Wahl im eigenen Assistenzprofil (dieselbe Fassungsprüfung wie OCR-03). */
export async function speichereOffenePunkte(
  wahl: OffenePunkteWahl,
): Promise<OffenePunkteSpeichern> {
  const s = assistenzStand();
  if (!s.kontoId || s.status !== "bereit") {
    return "ohne-konto";
  }
  const kontoId = s.kontoId;
  try {
    const antwort = await assistenzProfilApi.speichern({
      datenkontrolleOffenePunkte: wahl,
      fassung: s.antwort?.profil?.fassung ?? 0,
    });
    bestaetigeAssistenzProfil(kontoId, antwort);
    return "gespeichert";
  } catch (fehler) {
    if (fehler instanceof ApiError && fehler.status === 409) {
      void ladeAssistenzProfil(kontoId);
      return "konflikt";
    }
    return "fehler";
  }
}
