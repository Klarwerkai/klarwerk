import { ApiError } from "./client";

// ================================================================================================
// JOB 577 — ABWESENHEIT IST EIN DATENZUSTAND, KEIN FEHLER.
// ================================================================================================
//
// DAS PROBLEM, mechanisch: `retry: false` unterdrückt die WIEDERHOLUNG einer Abfrage. Der Query
// endet trotzdem in `isError`. Was daraus sichtbar wird, entscheidet danach JEDER RENDERER FÜR
// SICH — und wer die Unterscheidung vergisst, zeigt eine Fehlermeldung.
//
// Diese Meldung IST SELBST DIE AUSKUNFT: „hier gibt es etwas, das du nicht sehen darfst." Das ist
// fail-OPEN, und es ist genau der Datenschutzfehler, um den dieser Job geht. Drei Hooks trugen
// dazu je einen Kommentar, der die Absicht richtig benannte — und keiner setzte sie durch. Die
// Durchsetzung lag beim Renderer, also bei der Disziplin.
//
// DIE ANTWORT IST EINE SCHICHTVERSCHIEBUNG, KEINE RENDERREGEL. `data === null` heißt „keine
// Fläche". Ein Verbraucher, der NICHTS TUT, zeigt NICHTS. Vorher musste er aktiv daran denken,
// `isError` zu unterdrücken; jetzt müsste er aktiv etwas erfinden, um Abwesenheit sichtbar zu
// machen. Aus einer Prüfliste wird eine Eigenschaft.
//
// ------------------------------------------------------------------------------------------------
// WARUM NUR 404 UND NICHT 403 — der Punkt, an dem eine Bequemlichkeit alles kaputt machen würde.
// ------------------------------------------------------------------------------------------------
//
// Die Routen dieses Hauses beantworten „nicht vorhanden", „nicht sichtbar" und „gehört dir nicht"
// mit DERSELBEN Antwort. `services/app/src/routes/object-routes.ts` sagt den Grund wörtlich: „Ein
// 403 würde die Existenz des Anhangs bestätigen."
//
// Ein 403, das dennoch beim Client ankommt, ist deshalb ein ECHTER Fehler und bleibt sichtbar — er
// zeigt eine Route an, die sich nicht an die Hausform hält. Ihn hier mitzuverschlucken wäre
// bequem und würde genau die Abweichung verbergen, die man sehen will. Dasselbe gilt für 408
// (Zeitablauf) und 5xx: Sie bleiben im Fehlerkanal, und die Tests binden das.
//
// `retry: false` BLEIBT an den Hooks stehen. Die beiden lösen verschiedene Probleme —
// Wiederholung gegen Sichtbarkeit. Hier wird nichts ersetzt, was funktioniert.

// Ist dieser Fehler die Abwesenheit einer Fläche? Nur ein echter `ApiError` mit genau 404.
// Bewusst `instanceof` statt einer Formprüfung auf `.status`: Ein beliebiges Objekt, das zufällig
// ein Feld `status: 404` trägt, ist keine Antwort dieses Clients.
export function istAbwesend(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.status === 404;
}

// Hebt 404 aus dem FEHLERkanal in den DATENkanal. Alles andere wird unverändert weitergeworfen —
// der Fehlerkanal bleibt für echte Fehler offen.
//
// Die Hülle nimmt eine Abruffunktion und gibt eine Abruffunktion zurück, statt einen Query-Zustand
// nachträglich zu deuten: So gibt es keinen Zwischenzustand, in dem der Fehler schon existiert und
// jemand ihn sehen könnte. Der Aufrufer schreibt `queryFn: alsAbwesenheit(() => …)` und ändert
// sonst nichts.
export function alsAbwesenheit<T>(abruf: () => Promise<T>): () => Promise<T | null> {
  return async (): Promise<T | null> => {
    try {
      return await abruf();
    } catch (fehler) {
      if (istAbwesend(fehler)) {
        return null;
      }
      throw fehler;
    }
  };
}
