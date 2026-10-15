// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten — WAS DER FRAGENDE BEI EINEM KI-AUSFALL LIEST.
// ================================================================================================
//
// Die PURE, DOM-freie Ableitung hinter den Ausfallsätzen der Fragenseite (Texte: `texte/kiausfall.ts`).
// Drei Fragen, jede aus einer TATSÄCHLICHEN Auskunft, nie aus Meldungstext geraten (PV-03-01):
//
//   1. Warum ist die KI-Antwort gesperrt?  → öffentlicher KI-Status (`kiausfall.status.*`, R-1040).
//   2. Warum ist DIESE Anfrage gescheitert? → Fehlercode der Antwort von `/api/ask`.
//   3. Warum hat der Ersatz geantwortet?   → `AnswerResult.ersatzGrund` vom Server.
//
// GRENZE (PV-03-02): ein Netzfehler beim Abruf selbst (`TypeError`, kein Code) betrifft die ganze
// Anwendung, nicht die KI. Er bleibt beim allgemeinen Satz und wird nie „KI nicht erreichbar".
//
// Dazu (PV-03-03): wo der Fragen-Entwurf liegt. Er liegt im Browser je Konto
// (`lib/fragenArbeitsstand.ts`) — gesagt wird das nur, wenn er dort NACHGELESEN wurde.
import type { KiErsatzGrund, ReasonerStatus } from "../api/types";
import { type AiSperrHinweisKey, aiSperrHinweisKey } from "./aiAvailability";
import { arbeitsstandLesen } from "./fragenArbeitsstand";

/** Ursachen einer gescheiterten Frage, die eine eigene Erklärung tragen. */
export type KiFehlerUrsache = "abgeschaltet" | "gebremst" | "kapazitaet" | "verweigert";

/**
 * Ordnet den Fehler von `/api/ask` einer benannten Ursache zu — am Code, den der Server sendet
 * (`ApiError.code`), nie an Meldungstext. `null` = keine KI-Ursache belegt: allgemeiner Satz.
 */
export function kiFehlerUrsache(fehler: unknown): KiFehlerUrsache | null {
  const code =
    typeof fehler === "object" && fehler !== null && "code" in fehler
      ? String((fehler as { code: unknown }).code)
      : "";
  switch (code) {
    case "KI_ABGESCHALTET":
      return "abgeschaltet";
    case "KI_ANFRAGEN_GEBREMST":
      return "gebremst";
    // services/app/src/build-app.ts `modelBusyErrorHandler`: die bestehende Grenze gleichzeitiger
    // Modellaufrufe (ModelCapacityError) ist erschöpft.
    case "MODEL_BUSY":
      return "kapazitaet";
    // Ebd.: unter einer Klara-Zustimmung für genau einen Anbieter wird nicht ausgewichen.
    case "KLARA_AUSWEICHWEG_GESPERRT":
      return "verweigert";
    default:
      return null;
  }
}

/**
 * Lohnt „Erneut versuchen"? Nicht nach einer Abschaltung oder verweigerten Verarbeitung: dieselbe
 * Anfrage endete wieder gleich. Bei Kapazität und allgemeinem Fehler ja — die bestehenden Grenzen
 * (Anfragebremse, Kapazität) gelten für den neuen Versuch unverändert serverseitig.
 */
export function erneutVersuchenSinnvoll(ursache: KiFehlerUrsache | null): boolean {
  return ursache !== "abgeschaltet" && ursache !== "verweigert";
}

/**
 * Der Satz zur Ursache des Ersatzwegs — oder `null`, wenn der Server keine genannt hat. Ben
 * (nacharbeit-2): die Erfolgsaussage hängt am TATSÄCHLICHEN Antwortstatus. Hat auch der Ersatz
 * keine Antwort gefunden, heisst der Satz „keine Antwort" (`kiausfall.ohneAntwort.*`), nie
 * „beantwortet"; die Ursache steht in beiden Fällen da.
 */
export function ersatzGrundKey(
  grund: KiErsatzGrund | undefined,
  beantwortet: boolean,
): string | null {
  if (!grund) {
    return null;
  }
  return beantwortet ? `kiausfall.ersatz.${grund}` : `kiausfall.ohneAntwort.${grund}`;
}

/**
 * PV-03-01 / R-1040: der Sperrsatz der Fragenseite aus dem Status — DIESELBE Regel wie im
 * Klara-Panel (`aiSperrHinweisKey`), nur ohne die Abschaltung, die die Fragenseite selbst benennt.
 * Getrennt wird: Status unbekannt, eingerichtet aber zuletzt nicht erreichbar, kein Modell.
 */
export function kiStoerungHinweisKey(
  status: Pick<ReasonerStatus, "reachable"> | undefined,
  statusUnknown: boolean,
): AiSperrHinweisKey {
  return aiSperrHinweisKey(
    status?.reachable !== undefined ? { reachable: status.reachable } : undefined,
    "answer",
    statusUnknown,
  );
}

/** Kann ein erneuter Statusabruf die Lage ändern? Nur bei einer Störung, nicht bei Nicht-Einrichtung. */
export function statusErneutPruefbar(hinweisKey: AiSperrHinweisKey): boolean {
  return (
    hinweisKey === "ai.statusUnknown.hint" || hinweisKey === "kiausfall.status.nichtErreichbar"
  );
}

type LesbarerSpeicher = Parameters<typeof arbeitsstandLesen>[0];

/**
 * PV-03-03: wo die gerade sichtbare Frage gesichert ist. `browser` NUR, wenn derselbe Text im
 * Arbeitsstand dieses Kontos NACHGELESEN wurde — ein sichtbares Feld allein ist keine Speicherung.
 * Sonst `nurSeite`: der Text lebt dann nur so lange wie die Seite.
 */
export function entwurfSpeicherort(
  speicher: LesbarerSpeicher,
  konto: string | null,
  frage: string,
): "browser" | "nurSeite" {
  const text = frage.trim();
  if (text === "") {
    return "nurSeite";
  }
  const stand = arbeitsstandLesen(speicher, konto);
  return stand?.entwurf.trim() === text ? "browser" : "nurSeite";
}
