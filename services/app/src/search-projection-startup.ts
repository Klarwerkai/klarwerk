import {
  type ProjectionControlState,
  type SearchProjectionReadiness,
  integritaetsMarkerGueltig,
} from "../../knowledge-object";

// ================================================================================================
// G27 R2 — DER EINE KANONISCHE STARTUPVERTRAG DER SUCHPROJEKTION
// (KW-ARCH-G27-SEED-UND-SCHEMAVERTRAG-15 §A, auf Grundlage von KW-ARCH-G27-BETRIEBSORCHESTRIERUNG-06)
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. In R1 stand die Betriebsfolge als private Funktion in
// `build-app.ts` — richtig für die App, unerreichbar für alles andere. Der CLI-Seed baut seine
// Dienste selbst (`runSeed` → `buildServices()`/`buildPgServices()`) und lief deshalb gegen eine
// NICHT in Betrieb genommene Instanz: `seedDemo()` braucht die Standardsuche, die Suche ist seit R1
// fail-closed, und der Seed brach mit `SEARCH_PROJECTION_NOT_READY (UNINITIALIZED)` ab. Das war
// kein Testbefund, sondern ein echter Betriebsbefund — der ausgelieferte CLI-Seed war kaputt.
//
// DIE ANTWORT IST EINE GEMEINSAME WAHRHEIT, KEIN ZWEITER WEG (Entscheidung 15 §A, No-Gos):
// weder eine zweite Seed-Zustandsmaschine noch ein unbedingter Aktivierungs-Sonderpfad in
// `seed.ts`. Beide Einstiege — App-Ready und CLI-Seed — rufen genau `stelleSuchprojektionBereit`.
// Gäbe es zwei Folgen, liefen sie garantiert irgendwann auseinander, und die eine, die seltener
// läuft, wäre die falsche.
//
// DER PERSISTIERTE ZUSTAND ENTSCHEIDET, NIE DER BESTAND (06 §2, letzter Satz). Es wird nichts aus
// Projektionszeilen rekonstruiert und nichts „repariert", weil es plausibel aussieht.

/**
 * GENAU die fünf Operationen, die der Zustandsvertrag braucht — nicht der ganze `KoService`.
 *
 * Die schmale Sicht ist Absicht: sie sagt an dieser Stelle vollständig, was die Startorchestrierung
 * darf, und macht die sechs Zustandsfälle einzeln prüfbar, ohne dass eine Gegenprobe den kompletten
 * Dienst samt Repositories aufbauen müsste. `KoService` erfüllt sie strukturell; es gibt keine
 * zweite Implementierung im Produktpfad.
 */
export interface SuchprojektionStartDienst {
  searchProjectionControl(): Promise<ProjectionControlState>;
  activateSearchProjectionV2(): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }>;
  continueSearchProjectionBuild(): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }>;
  releaseSearchProjectionVersion(erwarteteGeneration?: number): Promise<ProjectionControlState>;
  recoverSearchProjectionV2(grund: string): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }>;
  /**
   * G27 R3: die VOLLSTÄNDIGE Prüfung des tatsächlichen Bestands — Vollständigkeit, Fassung,
   * Pflichtfelder, Hash, Lifecycle und Generation. Sie existiert im Dienst bereits und ist die
   * Prüfung, die das Freigabe-Gate fährt; der Start benutzt beim Zustand `V2_ACTIVE` genau sie und
   * keine zweite.
   */
  searchProjectionReadiness(): Promise<SearchProjectionReadiness>;
}

/**
 * DIE ZUSTANDSABHÄNGIGE BETRIEBSFOLGE (Entscheidung 15 §A, Tabelle).
 *
 * Rein orchestrierend: jeder einzelne Schritt bleibt im Knowledge-Object-Dienst, wo er hingehört.
 * Hier steht nur, WAS diese Instanz beim Start tut, je nachdem was sie vorfindet.
 *
 * Der Rückgabewert ist der Zustand NACH dem Lauf — frisch gelesen, nicht der erwartete. Wer
 * „bereit?" beantworten will, fragt `stelleSuchprojektionBereit`.
 */
export async function starteSuchprojektion(
  ko: SuchprojektionStartDienst,
): Promise<ProjectionControlState> {
  const control = await ko.searchProjectionControl();
  switch (control.projectionState) {
    // Neue Instanz, Legacy-Migration und Wiederinbetriebnahme nach einem Fehlschlag führen über
    // DENSELBEN vollständigen Weg — der Unterschied liegt im Bestand, nicht in der Behandlung.
    case "UNINITIALIZED":
    case "V1_ACTIVE":
    case "FAILED":
      await ko.activateSearchProjectionV2();
      break;
    // Abgestürzt im Bau: DIESELBE Generation idempotent fortsetzen, keine neue aufmachen. Ein
    // Neustart, der neu begänne, würde bei wiederholtem Absturz nie ankommen.
    case "V2_BUILDING":
      await ko.continueSearchProjectionBuild();
      break;
    // Gebaut und geprüft, aber nicht mehr freigegeben: das Gate läuft unter der Sperre erneut und
    // schaltet atomar um. Kein Rebuild — der Bestand dieser Generation ist fertig.
    case "V2_READY":
      await ko.releaseSearchProjectionVersion(control.buildGeneration);
      break;
    // ============================================================================================
    // `V2_ACTIVE` — GENERATION, MARKER **UND INTEGRITÄT** (Entscheidung 15 §A, 09 §3)
    // ============================================================================================
    //
    // WAS HIER GEFEHLT HAT (BEN ROT-1 der R2-Nachprüfung, gegen echtes PostgreSQL belegt). Bis R2
    // stand hier ausschliesslich die Markerprüfung. Sie liest NUR Felder der Control-Zeile —
    // Fassung, Generation, Markertext. Wer eine bedienende Projektionszeile am Repository-Adapter
    // VORBEI entfernt (ein `DELETE` direkt in der Datenbank, ein Restore, ein fremdes Werkzeug),
    // lässt die Control-Zeile unberührt: der Marker bleibt formal gültig, der Start akzeptiert den
    // Bestand als gesund, und die Standardsuche antwortet danach still mit `[]`. Genau die
    // Leermenge, die 09 §3 verbietet — nur diesmal ohne jede Spur im Control-State.
    //
    // Der Adapterweg fällt den Marker weiterhin selbst (R1); er ist damit die schnelle, laufende
    // Sicherung. DIESE Prüfung hier ist die zweite, langsame: sie fragt beim Start einmal, ob der
    // freigegebene Bestand wirklich noch der ist, für den der Marker ausgestellt wurde.
    //
    // SIE IST KEINE ZWEITE PRÜFUNG UND KEINE ZWEITE ZUSTANDSMASCHINE. `searchProjectionReadiness()`
    // ist dieselbe Prüfung, die das Freigabe-Gate fährt (Vollständigkeit, Fassung, Pflichtfelder,
    // Hash, Lifecycle, Generation). Der Start benutzt sie, statt eine eigene zu erfinden.
    //
    // KEIN VOLLSCAN JE SUCHANFRAGE: sie läuft GENAU EINMAL je App-/Seed-Initialisierung im
    // `onReady`-Pfad, nie auf einem Suchweg. Die Suche prüft unverändert nur die vier konstanten
    // Felder der Steuerzeile.
    //
    // UND SIE LÖST BEI GESUNDEM BESTAND NICHTS AUS (06 §6, Akzeptanz 4): sie ist rein lesend;
    // besteht sie, geschieht nichts — kein Rebuild, keine neue Generation.
    case "V2_ACTIVE": {
      if (!integritaetsMarkerGueltig(control)) {
        await ko.recoverSearchProjectionV2("Integritätsmarker beim Start ungültig");
        break;
      }
      // Strukturell unmöglich, aber billig zu prüfen: die Freigabe schreibt `activeGeneration` aus
      // `buildGeneration`, beide MÜSSEN in `V2_ACTIVE` gleich sein. Fallen sie auseinander, prüfte
      // die Readiness unten die falsche Generation — dann ist der Zustand selbst beschädigt.
      if (control.activeGeneration !== control.buildGeneration) {
        await ko.recoverSearchProjectionV2(
          `Generationen beim Start uneinheitlich (aktiv ${control.activeGeneration}, Bau ${control.buildGeneration})`,
        );
        break;
      }
      const readiness = await ko.searchProjectionReadiness();
      if (!readiness.alle) {
        // Fail-closed über den EINEN vorhandenen Weg: `V2_ACTIVE → FAILED → vollständiger
        // V2-Rebuild → V2_READY → V2_ACTIVE` (Entscheidung 08 §1). Kein Reparaturversuch an
        // einzelnen Zeilen, keine heuristische Rekonstruktion des Zustands aus dem Bestand.
        // Der Befund reist mit, damit „warum?" für den Betreiber beantwortbar bleibt.
        await ko.recoverSearchProjectionV2(
          `Bestandsintegrität beim Start verletzt: ${readiness.befunde.join("; ")}`,
        );
      }
      break;
    }
  }
  return ko.searchProjectionControl();
}

/**
 * DER EINE EINSTIEG FÜR APP-READY UND CLI-SEED (Entscheidung 15 §A).
 *
 * Er führt die Betriebsfolge aus und macht daraus eine Ja/Nein-Aussage: entweder die Instanz ist
 * fachlich betriebsbereit (`V2_ACTIVE`), oder dieser Aufruf WIRFT. Ein Rückgabewert „nicht bereit"
 * gibt es bewusst nicht — er wäre die Einladung, ihn zu ignorieren, und genau das ist der Fehler,
 * den diese Welle schliesst.
 *
 * FÜR DIE APP heisst das: `onReady` schlägt fehl, die App wird nie ready, die Suche bleibt
 * fail-closed (06 §3).
 * FÜR DEN SEED heisst das: der Lauf endet VOR `seedDemo()`. Es gibt keinen partiellen Seed-Erfolg
 * (15 §A) — Demodaten, die auf einer nicht suchbereiten Instanz entstehen, sähen aus wie ein
 * gelungener Lauf und wären beim ersten Suchversuch wertlos.
 */
export async function stelleSuchprojektionBereit(
  ko: SuchprojektionStartDienst,
): Promise<ProjectionControlState> {
  const control = await starteSuchprojektion(ko);
  if (control.projectionState !== "V2_ACTIVE") {
    // Die Meldung trägt den Zustand — sie geht an den Betreiber, nicht an einen HTTP-Client. Der
    // äussere Fehlerweg maskiert generisch (s. `modelBusyErrorHandler` in `build-app.ts`).
    throw new Error(
      `Suchprojektion nicht betriebsbereit (Zustand ${control.projectionState}). Start bleibt fail-closed.`,
    );
  }
  return control;
}
