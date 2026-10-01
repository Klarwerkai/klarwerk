// R-0794 (deploy-health-commit, Ben B8): /health ist die EINE feste Adresse, die Laufzustand,
// Version, Auslieferungsstand, KI-Modus UND die letzten KI-Läufe gemeinsam nennt. Diese Datei baut
// den Teil „letzte KI-Läufe" — abstrahiert, weil /health öffentlich und ohne Anmeldung lesbar ist.
//
// WAS HINEINKOMMT: je Lauf nur Aufgabe, Ausgang, Betriebsmodus (Modell/deterministisch), ob der
// deterministische Rückfall griff, und das Ende. Das sind dieselben groben Angaben, die die
// maschinenlesbare Kennzeichnung (`aiGeneratedMark`) ohnehin an jede Ausgabe hängt.
//
// WAS BEWUSST FEHLT: Anbieter, Modell, Fehlertext, Laufkennung, Anfragender, Gegenstand und
// Verbrauch. Anbieter/Modell liefert ausschließlich die Admin-Sicht (FR-RSN-05, WP-VIP2-GATE);
// Anfragender und Gegenstand wären Nutzer- bzw. Wissensobjekt-Kennungen an einer anonymen Adresse.
//
// /health DARF DARAN NICHT KRANK WERDEN: der Container-Healthcheck (`Dockerfile`, HEALTHCHECK
// `--timeout=4s`) prüft nur `r.ok`. Ein hängendes oder fehlerndes Laufprotokoll macht deshalb nur
// diese Teilauskunft ehrlich „nicht verfügbar" — nie die Antwort als Ganzes rot oder langsam.
//
// UND ES DARF DIE NACHBARN NICHT KRANK MACHEN (Ben B9): Die Frist begrenzt nur das WARTEN der
// Antwort, nicht die Datenbankarbeit — eine gestartete Abfrage hält ihren Platz im gemeinsamen
// Pool (`createPool`, geteilt von allen Modulen), bis sie zurückkommt. Startete jeder Aufruf eine
// eigene Abfrage, belegten wiederholte Healthchecks bei hängendem Laufprotokoll den ganzen Pool.
// Deshalb EINE Abfrage im Flug je Auskunft: gleichzeitige und folgende Aufrufe hängen sich an die
// laufende an, statt eine neue zu starten. Eine neue beginnt erst, wenn die vorige zurück ist
// (Erfolg oder Fehler). /health belegt damit höchstens einen Poolplatz — auch wenn er hängt.
import type {
  AiOutputMode,
  ModelRunRecord,
  ModelRunService,
  ModelRunStatus,
  ModelRunTask,
} from "../../model-runs";

/** Wie viele jüngste Läufe /health nennt. Klein: die Adresse wird alle 30 s abgefragt. */
export const HEALTH_KI_LAEUFE_ANZAHL = 5;

/** Obergrenze für das Lesen des Laufprotokolls — deutlich unter dem Healthcheck-Timeout (4 s). */
export const HEALTH_KI_LAEUFE_FRIST_MS = 1500;

export interface HealthKiLauf {
  task: ModelRunTask;
  status: ModelRunStatus;
  mode: AiOutputMode;
  fallback: boolean;
  finishedAt: string;
}

export type HealthKiLaeufe =
  | { available: true; recent: HealthKiLauf[] }
  | { available: false; recent: [] };

const NICHT_VERFUEGBAR: HealthKiLaeufe = { available: false, recent: [] };

/**
 * Baut die Auskunft „letzte KI-Läufe" für EINE App-Instanz. Der Rückgabewert trägt den Zustand
 * „Abfrage im Flug" — pro App genau einmal erzeugen, nicht pro Anfrage.
 */
export function kiLaeufeAuskunft(
  modelRuns: Pick<ModelRunService, "recent">,
  fristMs: number = HEALTH_KI_LAEUFE_FRIST_MS,
): () => Promise<HealthKiLaeufe> {
  let imFlug: Promise<ModelRunRecord[]> | null = null;

  const abfrage = (): Promise<ModelRunRecord[]> => {
    if (imFlug === null) {
      let neu: Promise<ModelRunRecord[]>;
      try {
        neu = modelRuns.recent(HEALTH_KI_LAEUFE_ANZAHL);
      } catch (fehler) {
        neu = Promise.reject(fehler);
      }
      const freigeben = () => {
        if (imFlug === neu) {
          imFlug = null;
        }
      };
      neu.then(freigeben, freigeben);
      imFlug = neu;
    }
    return imFlug;
  };

  return () => mitFrist(abfrage(), fristMs);
}

async function mitFrist(
  laufend: Promise<ModelRunRecord[]>,
  fristMs: number,
): Promise<HealthKiLaeufe> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const frist = new Promise<null>((fertig) => {
    uhr = setTimeout(() => fertig(null), fristMs);
    uhr.unref?.();
  });
  try {
    const laeufe = await Promise.race([laufend, frist]);
    if (laeufe === null) {
      return NICHT_VERFUEGBAR;
    }
    return {
      available: true,
      recent: laeufe.map((lauf) => ({
        task: lauf.task,
        status: lauf.status,
        mode: lauf.demo ? "deterministic" : "model",
        fallback: lauf.fallback,
        finishedAt: lauf.finishedAt,
      })),
    };
  } catch {
    return NICHT_VERFUEGBAR;
  } finally {
    clearTimeout(uhr);
  }
}
