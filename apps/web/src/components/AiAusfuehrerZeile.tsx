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
// WARUM EINE ZEILE UND NICHT `AiModelInfo`: `AiModelInfo` bringt den KI-Satz und den Kostenhinweis
// mit — im Blatt stehen beide schon (Vorschlagskarten, Lagezeile `blatt-lage`). In der Palette
// kosteten sie drei bis vier Zeilen, und die Palette muss am Handy ohne Rollen ins Fenster passen
// (`tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`, B6). Diese Zeile bleibt EINE Zeile
// (`truncate`, voller Wortlaut im `title`).
//
// DIESELBE ABLEITUNG, KEINE ZWEITE WAHRHEIT: `aiTaskInfo`/`aiTaskInfoPublic` wie `AiModelInfo`.
// Der Anbietername steht — wie dort — nur in der Adminsicht; alle anderen sehen die Stufe
// (Cloud/Lokal/Regelbasiert). Das ist die bestehende Grenze aus WP-VIP2-GATE-2 (Anbieter- und
// Modellnamen nur für `users.manage`); ob Nicht-Admins den Anbieternamen sehen sollen, ist eine
// offene Produktentscheidung und wird hier NICHT getroffen.
import { useTranslation } from "react-i18next";
import { useReasonerConfig, useReasonerStatus } from "../api/hooks";
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
  const status = useReasonerStatus();
  const wer = ausfuehrerWer({
    tasks,
    istAdmin,
    config: config.data,
    status: status.data,
    t: (schluessel) => t(schluessel),
  });
  const satz = t(AI_AUSFUEHRER_KEY, { wer });
  return (
    <p
      data-testid="ki-ausfuehrer"
      title={satz}
      className="mb-1.5 truncate text-[11.5px] text-muted"
    >
      {satz}
    </p>
  );
}
