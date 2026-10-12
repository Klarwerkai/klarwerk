import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNetzOnline } from "../lib/netzzustand";
import { useSession } from "./AuthContext";

// ================================================================================================
// R-1029 / R-1674 (FE-FND-08, N-3) — GETEILTE STÄNDE KOMMEN VON SELBST NACH, SOLANGE DIE SITZUNG STEHT.
// ================================================================================================
//
// SCRUM-152 hat die SITZUNG frisch gehalten (`AuthContext`: `refetchInterval` + Fokus-Abruf). Die
// geteilten Stände daneben nicht: die Zähler im Kopfband, die Meldungen und die geteilten Listen
// (Bibliothek, Wissensbestand) holte react-query nur beim Aufbau, beim Fokus und bei der
// Wiederverbindung. Eine offen stehende Seite bekam so nie mit, was andere inzwischen geändert haben —
// seit JOB 3113 H1b verschwindet die Zahl nach der Frist zwar ehrlich, aber sie kam nicht wieder.
//
// ZWEI GRUPPEN, EIN WEG:
//   · Die Stände der HÜLLE (`GETEILTE_STAENDE`) — klein, auf jeder Seite sichtbar — im Takt
//     `GETEILTER_STAND_TAKT_MS`.
//   · Die geteilten LISTEN (`GETEILTE_LISTEN`, Nacharbeit 2/3, Bens Befunde) — Bibliothekssuche,
//     Wissensbestand (`BibliothekFlaeche.tsx:551/573`), Lückenliste (`Risk.tsx`, `MyTasks.tsx`)
//     und die übrigen geteilten Bestandslisten aus `api/hooks.ts` — im ruhigeren
//     Takt `GETEILTE_LISTEN_TAKT_MS`. Ruhiger, weil sie GROSS sind: `/api/kos` trug bei 10.001
//     Objekten 19,3 MB, `/api/library/search` 6,8 MB (K1 / NFR-PERF-01, `BibliothekFlaeche.tsx:556`).
//     Im Hüllentakt hiesse das gut 1 MB/s je offenem Tab.
//
// FÜR BEIDE GILT DERSELBE RAHMEN:
//   · Nur was gerade jemand zeigt (`type: "active"`): eine abgeschaltete Abfrage (etwa der Bestand,
//     bevor die Suche der Bibliothek geantwortet hat) bleibt abgeschaltet.
//   · Editor-, Entwurfs- und Detailabfragen (`["ko", id]`, `["drafts"]` …) stehen in KEINER Gruppe.
//     Lokale Bearbeitungen leben dort bzw. im Zustand der Fläche — ein Listenabruf berührt sie nicht.
//   · NUR bei bestätigter Sitzung (`sitzungslage === "bestaetigt"`). Ohne Antwort des Servers oder
//     ohne Sitzung gibt es nichts Geteiltes abzugleichen; die Gate-Zweige ohne Sitzung
//     (Offline-Erfassung, Dev-Vorschau) bleiben dadurch ohne Abrufe.
//   · Pause offline (`useNetzOnline`, die eine Quelle des Onlinezustands) und im verdeckten Tab.
//     Das Zurückkommen deckt react-query selbst ab (Fokus-/Wiederverbindungsabruf, `main.tsx`).
//   · Aussetzen, solange eine Änderung läuft (`isMutating`). Eine sofortige Rückmeldung
//     (optimistische Markierung, Cache-Schreiben wie `Validation.tsx` `removeDeletedKoFromCaches`)
//     darf nicht von einem Abruf überholt werden, der VOR der Bestätigung beim Server war. Der
//     nächste Takt gleicht danach ab — der Server bleibt die Quelle der Wahrheit.
//
// DER HÜLLENTAKT LIEGT UNTER DER FRIST DER ZÄHLER (`ZAEHLER_FRISCHE_MS`, 30 s): so wird eine geteilte
// Zahl bestätigt, bevor sie ungedeckt wäre. Scheitert der Abruf, greift die Frist unverändert — der
// Nachlader ersetzt die ehrliche Anzeige nicht, er versorgt sie.
export const GETEILTER_STAND_TAKT_MS = 20_000;

/** Die Listen tragen keine Frist-Anzeige; eine Minute ist spürbar „von selbst" und netzschonend. */
export const GETEILTE_LISTEN_TAKT_MS = 60_000;

/** Die geteilten Stände der Hülle — Präfixe der Abfrageschlüssel aus `api/hooks.ts`. */
export const GETEILTE_STAENDE: readonly (readonly string[])[] = [
  ["validation", "board"],
  ["conflicts"],
  ["duplicates"],
  ["gaps", "summary"],
  ["lifecycle", "pending"],
  ["notifications"],
];

/**
 * Die geteilten Listen — Präfixe der Lese-Haken aus `api/hooks.ts`, deren Inhalt ANDERE Personen
 * verändern (Nacharbeit 3, Bens Befund: u. a. die Lückenliste auf Risiko- und Aufgabenfläche).
 *
 * BEWUSST NICHT DARIN, je mit Grund:
 *   · `["drafts"]`, `["me", …]`, `["learning-progress", …]` — eigene Stände, keine geteilten.
 *   · `["ko", id, …]`, `["ko-neighbors", …]` — Detail/Lesefläche; dort hängt die Bearbeitung.
 *   · `["features"]`, `["auth", …]`, `["reasoner", …]`, `["external", …]`, `["upload-limits"]`,
 *     `["import-access", …]` — Konfiguration, die sich im Betrieb nicht ändert oder eigene Wege hat.
 *   · `["livewall", …]`, `["import-run", …]` — tragen bereits ihren eigenen Takt (`hooks.ts`).
 *   · `[…, "settings"]` (`Capture.tsx:773`, `AdminKiDetails.tsx:1368/1617`, `Admin.tsx:315`) —
 *     Einstellungsformulare mit örtlicher Bearbeitung. Sie liegen unter `["duplicates"]`; deshalb
 *     schließt `keineEinstellung` sie an JEDEM Präfix aus, nicht nur durch Weglassen.
 *   · Abfragen außerhalb von `hooks.ts`, die den Fokusabruf ausdrücklich abschalten
 *     (`AdminDatenDetails.tsx:138`, `ImportExplore.tsx:146`) — ihre Entscheidung bleibt stehen.
 */
export const GETEILTE_LISTEN: readonly (readonly string[])[] = [
  ["library", "search"],
  ["kos"],
  ["gaps"],
  ["validation", "board"],
  ["validation", "overview"],
  ["conflicts"],
  ["duplicates"],
  ["duplicate-signal"],
  ["lifecycle"],
  ["wissensnetz", "luecken"],
  ["import-candidates"],
  ["output", "sources"],
  ["evidence", "index"],
  ["management"],
  ["analytics"],
  ["busfactor"],
  ["graph"],
  ["model-runs"],
  ["audit"],
  ["users"],
  ["directory"],
];

/** Einstellungsabfragen (`[…, "settings"]`) speisen Formulare und werden nie nachgeladen. */
export function keineEinstellung(queryKey: readonly unknown[]): boolean {
  return queryKey[1] !== "settings";
}

/** Darf in diesem Takt nachgeladen werden? Reine Ableitung, damit die Regel an einer Stelle steht. */
export function nachladenFaellig(lage: {
  sitzungBestaetigt: boolean;
  online: boolean;
  sichtbar: boolean;
  laufendeAenderungen: number;
}): boolean {
  return lage.sitzungBestaetigt && lage.online && lage.sichtbar && lage.laufendeAenderungen === 0;
}

/** Ein Takt über eine Gruppe von Schlüsseln. Liefert die Aufräumfunktion des Zeitgebers. */
function taktStarten(
  queryClient: QueryClient,
  gruppe: readonly (readonly string[])[],
  takt: number,
): () => void {
  const uhr = setInterval(() => {
    const faellig = nachladenFaellig({
      sitzungBestaetigt: true,
      online: true,
      sichtbar: document.visibilityState !== "hidden",
      laufendeAenderungen: queryClient.isMutating(),
    });
    if (!faellig) {
      return;
    }
    for (const queryKey of gruppe) {
      // `cancelRefetch: false`: ein noch laufender Abruf wird nicht abgebrochen und neu gestartet.
      void queryClient.refetchQueries(
        {
          queryKey: [...queryKey],
          type: "active",
          predicate: (abfrage) => keineEinstellung(abfrage.queryKey),
        },
        { cancelRefetch: false },
      );
    }
  }, takt);
  return () => clearInterval(uhr);
}

export function GeteilterStandNachlader(): null {
  const queryClient = useQueryClient();
  const { sitzungslage } = useSession();
  const online = useNetzOnline();
  const sitzungBestaetigt = sitzungslage === "bestaetigt";

  useEffect(() => {
    // Sitzung und Netz werden HIER entschieden: ändert sich eines davon, wird der Effekt neu
    // ausgewertet und die Zeitgeber stehen still, statt in jedem Takt nachzufragen.
    if (!sitzungBestaetigt || !online) {
      return undefined;
    }
    const huelleStoppen = taktStarten(queryClient, GETEILTE_STAENDE, GETEILTER_STAND_TAKT_MS);
    const listenStoppen = taktStarten(queryClient, GETEILTE_LISTEN, GETEILTE_LISTEN_TAKT_MS);
    return () => {
      huelleStoppen();
      listenStoppen();
    };
  }, [queryClient, sitzungBestaetigt, online]);

  return null;
}
