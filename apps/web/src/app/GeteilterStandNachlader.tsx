import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNetzOnline } from "../lib/netzzustand";
import { useSession } from "./AuthContext";

// ================================================================================================
// R-1029 / R-1674 (FE-FND-08, N-3) — GETEILTE STÄNDE KOMMEN VON SELBST NACH, SOLANGE DIE SITZUNG STEHT.
// ================================================================================================
//
// SCRUM-152 hat die SITZUNG frisch gehalten (`AuthContext`: `refetchInterval` + Fokus-Abruf). Die
// geteilten Stände daneben nicht: die Zähler im Kopfband (Prüfen, Konflikte, Dubletten, offene
// Lücken, Lebenszyklus) und die Meldungen holte react-query nur beim Aufbau, beim Fokus und bei der
// Wiederverbindung. Eine offen stehende Seite bekam so nie mit, was andere inzwischen geändert haben —
// seit JOB 3113 H1b verschwindet die Zahl nach der Frist zwar ehrlich, aber sie kam nicht wieder.
//
// DIESER NACHLADER SCHLIESST GENAU DIESE LÜCKE, UND NUR DIESE:
//   · Er fragt NUR die geteilten Stände der Hülle nach (`GETEILTE_STAENDE`) und davon nur die, die
//     gerade jemand zeigt (`type: "active"`). Editor-, Entwurfs- und Detailabfragen bleiben, wie sie
//     sind — ein Abruf mitten in die Bearbeitung wäre genau der Datenverlust, gegen den sie gebaut sind.
//   · Er läuft NUR bei bestätigter Sitzung (`sitzungslage === "bestaetigt"`). Ohne Antwort des
//     Servers oder ohne Sitzung gibt es nichts Geteiltes abzugleichen; die Gate-Zweige ohne Sitzung
//     (Offline-Erfassung, Dev-Vorschau) bleiben dadurch ohne Abrufe.
//   · Er pausiert offline (`useNetzOnline`, die eine Quelle des Onlinezustands) und im verdeckten Tab.
//     Das Zurückkommen deckt react-query selbst ab (Fokus-/Wiederverbindungsabruf, `main.tsx`).
//   · Er setzt aus, solange eine Änderung läuft (`isMutating`). Eine sofortige Rückmeldung
//     (optimistische Markierung, Cache-Schreiben) darf nicht von einem Abruf überholt werden, der VOR
//     der Bestätigung beim Server war. Der nächste Takt gleicht danach ab — der Server bleibt die
//     Quelle der Wahrheit.
//
// DER TAKT LIEGT UNTER DER FRIST DER ZÄHLER (`ZAEHLER_FRISCHE_MS`, 30 s): so wird eine geteilte
// Zahl bestätigt, bevor sie ungedeckt wäre. Scheitert der Abruf, greift die Frist unverändert — der
// Nachlader ersetzt die ehrliche Anzeige nicht, er versorgt sie.
export const GETEILTER_STAND_TAKT_MS = 20_000;

/** Die geteilten Stände der Hülle — Präfixe der Abfrageschlüssel aus `api/hooks.ts`. */
export const GETEILTE_STAENDE: readonly (readonly string[])[] = [
  ["validation", "board"],
  ["conflicts"],
  ["duplicates"],
  ["gaps", "summary"],
  ["lifecycle", "pending"],
  ["notifications"],
];

/** Darf in diesem Takt nachgeladen werden? Reine Ableitung, damit die Regel an einer Stelle steht. */
export function nachladenFaellig(lage: {
  sitzungBestaetigt: boolean;
  online: boolean;
  sichtbar: boolean;
  laufendeAenderungen: number;
}): boolean {
  return lage.sitzungBestaetigt && lage.online && lage.sichtbar && lage.laufendeAenderungen === 0;
}

export function GeteilterStandNachlader(): null {
  const queryClient = useQueryClient();
  const { sitzungslage } = useSession();
  const online = useNetzOnline();
  const sitzungBestaetigt = sitzungslage === "bestaetigt";

  useEffect(() => {
    if (!sitzungBestaetigt || !online) {
      return undefined;
    }
    const uhr = setInterval(() => {
      const faellig = nachladenFaellig({
        sitzungBestaetigt,
        online,
        sichtbar: document.visibilityState !== "hidden",
        laufendeAenderungen: queryClient.isMutating(),
      });
      if (!faellig) {
        return;
      }
      for (const queryKey of GETEILTE_STAENDE) {
        // `cancelRefetch: false`: ein noch laufender Abruf wird nicht abgebrochen und neu gestartet.
        void queryClient.refetchQueries(
          { queryKey: [...queryKey], type: "active" },
          { cancelRefetch: false },
        );
      }
    }, GETEILTER_STAND_TAKT_MS);
    return () => clearInterval(uhr);
  }, [queryClient, sitzungBestaetigt, online]);

  return null;
}
