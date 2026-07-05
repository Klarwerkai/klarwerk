// Pedi 05.07. (Beta): „Werkseinstellungen zurücksetzen" — im Desktop/Dev-Journal-Modus den
// kompletten lokalen Bestand löschen und den Prozess beenden. Nach dem Neustart ist das Journal
// leer → Ersteinrichtung greift (der erste Anwender wird wieder Admin). Das ermöglicht wiederholtes
// Testen ohne manuellen Aufwand.
//
// Sicherheitsriegel: Die Fähigkeit wird NUR verdrahtet, wenn die Desktop-Dev-Persistenz aktiv ist
// (Journal-Datei vorhanden, siehe server.ts). In Produktion (Postgres) bleibt sie bewusst
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
