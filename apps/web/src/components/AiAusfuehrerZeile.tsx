// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · N-0070 — WER FÜHRT DAS AUS? EINE ZEILE, VOR DEM KLICK.
// ================================================================================================
//
// ORIGINALPUNKT (wörtlich): „Einen gut benannten Zugang zu KI, freier Anweisung und Vorlagen direkt
// an der Editorleiste anbieten; den jeweiligen Anbieter dort vor Ausführen anzeigen."
//
// Der Zugang an der Editorleiste ist geliefert (Menü „KI" im Blatt mit Strukturieren, Werksaktionen,
// freier Anweisung und Vorlagen — JOB 3062/3584). Die Anbieterangabe fehlte dort: jede andere
// KI-Fläche trägt sie über `AiModelInfo` („(!)"), die Palette des Blattes nicht.
//
// WARUM EIN SATZ UND NICHT `AiModelInfo`: `AiModelInfo` bringt den KI-Satz und den Kostenhinweis
// mit — im Blatt stehen beide schon (Vorschlagskarten, Lagezeile `blatt-lage`). In der Palette
// kosteten sie drei bis vier Zeilen, und Vorlagen, freie Eingabe und Ausführen-Knopf müssen am
// Handy ohne Rollen im Fenster stehen (`tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`,
// B5a/B6). Gemessen (Nacharbeit 4): schon EINE Zeile OBERHALB davon schob die freie Eingabe in der
// höchsten Lage B5a 31,3 px unter den Rand. Der Satz steht deshalb im Blatt UNTER Eingabe und Knopf
// — beim Öffnen da, also vor dem Ausführen — und bricht um statt abzuschneiden (`break-words`),
// damit der Anbietername nie hinter einer Auslassung verschwindet.
//
// NUR AUS EINER AUFGABENBEZOGENEN AUSKUNFT (Nacharbeit 5, BEN): die Adminsicht nennt je Aufgabe
// Stufe und Anbieter/Modell (`aiTaskInfo`). Für alle anderen gibt es keine aufgabenbezogene Auskunft
// — der öffentliche `mode` ist hausweit und wäre bei lokal gestellter Aufgabe falsch. Dann sagt der
// Satz „hier nicht bekannt" (Begründung in `lib/aiAusfuehrer.ts`). Namen bleiben wie bisher der
// Adminsicht vorbehalten (WP-VIP2-GATE-2); ob Nicht-Admins Stufe oder Anbieter je Aufgabe sehen
// sollen, ist eine offene Produktentscheidung und wird hier NICHT getroffen.
import { useTranslation } from "react-i18next";
import { useReasonerConfig } from "../api/hooks";
import type { ReasonerTask } from "../api/types";
import { useRoleOptional } from "../app/RoleContext";
import { ausfuehrerWer } from "../lib/aiAusfuehrer";

/** Der Satz, einmal — Test und Fläche lesen ihn hier. */
export const AI_AUSFUEHRER_KEY = "erfassen.ki.ausfuehrer";

/** Eine Zeile für die Aufgaben, die DIESE Fläche auslöst (Ableitung: `lib/aiAusfuehrer.ts`). */
export function AiAusfuehrerZeile({ tasks }: { tasks: readonly ReasonerTask[] }): JSX.Element {
  const { t } = useTranslation();
  const istAdmin = useRoleOptional()?.role === "admin";
  const config = useReasonerConfig(istAdmin);
  const wer = ausfuehrerWer({
    tasks,
    istAdmin,
    config: config.data,
    t: (schluessel) => t(schluessel),
  });
  const satz = t(AI_AUSFUEHRER_KEY, { wer });
  return (
    <p data-testid="ki-ausfuehrer" className="mt-1.5 break-words text-[11.5px] text-muted">
      {satz}
    </p>
  );
}
