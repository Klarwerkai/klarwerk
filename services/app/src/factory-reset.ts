import { writeFileSync } from "node:fs";

// Pedi 05.07. (Beta): „Werkseinstellungen zurücksetzen" — im Desktop/Dev-Journal-Modus den
// kompletten lokalen Bestand löschen und den Prozess beenden. Nach dem Neustart ist das Journal
// leer → Ersteinrichtung greift (der erste Anwender wird wieder Admin). Das ermöglicht wiederholtes
// Testen ohne manuellen Aufwand.
//
// Sicherheitsriegel: Die Fähigkeit wird NUR verdrahtet, wenn die Desktop-Dev-Persistenz aktiv ist
// (Journal-Datei vorhanden, siehe `waehleWerksreset` unten). In Produktion (Postgres) bleibt sie bewusst
// unverfügbar — der Endpunkt antwortet dort mit „nicht verfügbar". So kann ein Werksreset niemals
// echte, produktive Kundendaten löschen.
export interface FactoryReset {
  // true nur im Desktop/Dev-Journal-Modus; sonst false (Endpunkt lehnt dann ab).
  readonly available: boolean;
  // Löscht den lokalen Bestand und beendet den Prozess (Neustart = Ersteinrichtung).
  run(): Promise<void>;
}

// Standard außerhalb des Desktop/Dev-Modus: nicht verfügbar. Der Endpunkt gibt „forbidden" zurück.
export const factoryResetUnavailable: FactoryReset = {
  available: false,
  run: async () => {
    throw new Error("Factory-Reset ist in diesem Betriebsmodus nicht verfügbar.");
  },
};

// R-1154 / R-0537: die Betriebsmodus-Entscheidung als EINE prüfbare Funktion (bis dahin inline in
// server.ts und damit ungetestet). Mit DATABASE_URL ist der Werksreset IMMER unverfügbar — auch
// wenn zusätzlich ein Journal konfiguriert ist —, ohne Journal (reiner In-Memory-Betrieb) ebenso.
// Nur der Desktop/Dev-Journal-Modus bekommt die Fähigkeit: Journal leeren (nächster Start = leere
// Instanz → needsSetup() → Ersteinrichtung, der erste Anwender wird wieder Admin), dann beenden.
// `beenden` ist injizierbar, damit der Test den Weg ohne echtes process.exit durchlaufen kann.
export function waehleWerksreset(opts: {
  databaseUrl: string | undefined;
  journal: string | undefined;
  beenden?: () => void;
}): FactoryReset {
  const { databaseUrl, journal } = opts;
  if (databaseUrl || !journal) {
    return factoryResetUnavailable;
  }
  // Kurzer Aufschub, damit die HTTP-Antwort noch flusht, dann den Prozess beenden.
  const beenden = opts.beenden ?? (() => setTimeout(() => process.exit(0), 250));
  return {
    available: true,
    run: async () => {
      writeFileSync(journal, "", "utf8");
      beenden();
    },
  };
}
