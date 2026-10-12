// ================================================================================================
// OCR-03 · SETUP › KLARA „BILDER AUTOMATISCH ANALYSIEREN UND TEXT ERKENNEN“ (Auftrag
// produkt:20261012:klara-bildanalyse-ocr-kontext-setup).
// ================================================================================================
//
// Die Einstellung liegt im vorhandenen Assistenzprofil des eigenen Kontos (W17, `/api/me/assistenz`,
// Feld `bildAutomatik`) — kein zweiter Speicherort, keine neue Route. Gelesen wird sie aus dem
// bestätigten Stand des Browsers (`lib/assistenzProfil.ts`), der an die Kontokennung gebunden ist.
//
// DIE LAGE, die jede Fläche mit automatischem Bildlesen kennt:
//   · `an`        — Voreinstellung; gilt, solange keine abweichende Wahl gespeichert ist.
//   · `aus`       — bewusst ausgeschaltet: keine neue automatische Auswertung. Vorhandene Ergebnisse
//                   derselben Fläche bleiben lesbar und als vorhanden gekennzeichnet.
//   · `laedt`     — das Profil des Kontos wird gerade gelesen: die Fläche WARTET. Sie startet nichts,
//                   was eine ausgeschaltete Automatik verbieten würde.
//   · `unbekannt` — das Profil konnte nicht gelesen werden: die Fläche liest nicht automatisch und
//                   sagt das sichtbar (`einstellungUnbekannt`), statt die Wahl zu übergehen.
// Ohne angemeldetes Konto im Browserstand (`leer`) gilt die Voreinstellung.
import { assistenzProfilApi } from "../api/assistenzProfil";
import { ApiError } from "../api/client";
import {
  type AssistenzStand,
  abonniereAssistenzStand,
  assistenzStand,
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  useAssistenzStand,
} from "./assistenzProfil";
import { BILD_AUTOMATIK_VOREINSTELLUNG } from "./bildAutomatik";

export type BildAutomatikLage = "an" | "aus" | "laedt" | "unbekannt";

export function bildAutomatikLage(s: AssistenzStand): BildAutomatikLage {
  if (s.status === "leer") {
    return BILD_AUTOMATIK_VOREINSTELLUNG ? "an" : "aus";
  }
  if (s.status === "laedt") {
    return "laedt";
  }
  if (s.status === "fehler" || !s.antwort) {
    return "unbekannt";
  }
  const gewaehlt = s.antwort.profil?.bildAutomatik;
  return (gewaehlt ?? BILD_AUTOMATIK_VOREINSTELLUNG) ? "an" : "aus";
}

export function useBildAutomatikLage(): BildAutomatikLage {
  return bildAutomatikLage(useAssistenzStand());
}

/**
 * Für Abläufe, die NICHT auf einen erneuten Render warten können (Dateiimport): die Lage, sobald
 * sie feststeht. Solange das Profil lädt, wird gewartet — höchstens `fristMs`, danach `unbekannt`.
 */
export function bildAutomatikAbwarten(
  fristMs = 15_000,
): Promise<Exclude<BildAutomatikLage, "laedt">> {
  const jetzt = bildAutomatikLage(assistenzStand());
  if (jetzt !== "laedt") {
    return Promise.resolve(jetzt);
  }
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (lage: Exclude<BildAutomatikLage, "laedt">): void => {
      if (fertig) {
        return;
      }
      fertig = true;
      clearTimeout(uhr);
      abmelden();
      resolve(lage);
    };
    const abmelden = abonniereAssistenzStand(() => {
      const lage = bildAutomatikLage(assistenzStand());
      if (lage !== "laedt") {
        ende(lage);
      }
    });
    const uhr = setTimeout(() => ende("unbekannt"), fristMs);
  });
}

export type BildAutomatikSpeichern = "gespeichert" | "konflikt" | "fehler" | "ohne-konto";

/**
 * Speichert die Wahl im eigenen Assistenzprofil (dieselbe Fassungsprüfung wie Name und Avatar). Bei
 * einem Konflikt wird der Stand neu gelesen; gespeichert ist dann nichts.
 */
export async function speichereBildAutomatik(an: boolean): Promise<BildAutomatikSpeichern> {
  const s = assistenzStand();
  if (!s.kontoId || s.status !== "bereit") {
    return "ohne-konto";
  }
  const kontoId = s.kontoId;
  try {
    const antwort = await assistenzProfilApi.speichern({
      bildAutomatik: an,
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
