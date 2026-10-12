// R-0664 · DIE 14-TAGE-FRIST AM SPEICHERORT DER DOCKER-PROTOKOLLE (Entscheidung 2, 12.10.2026).
//
// Im Docker-Betrieb (Ein-Befehl-Weg `docker-compose.prod.yml`, Coolify) schreibt die App auf die
// Standardausgabe, und der Docker-Dienst legt sie auf dem HOST ab:
//     /var/lib/docker/containers/<id>/<id>-json.log      die aktive Datei
//     /var/lib/docker/containers/<id>/<id>-json.log.1 …  Dockers eigene Rotationen (max-file)
// Docker löscht nur nach Menge, nie nach Alter. Die App selbst kommt an diese Dateien nicht heran.
//
// DIESER LAUF wendet dieselbe Pflege wie auf der Insel (`pflegeProtokolle`, protokoll-frist.ts) auf
// jeden Container an: die aktive Datei täglich rotieren (Kopie + Kürzen; Docker hängt weiter an),
// Rotationen und Archive löschen, sobald ihre älteste Zeile 14 Tage alt ist (Dockers `"time"` je
// Zeile). Optional dazu ein Diagnoseordner auf dem Host, in dem jede Datei nach derselben Frist fällt.
//
// ER LÄUFT IM VORHANDENEN APP-ABBILD, mit dem Containerordner des Hosts eingehängt:
//     npx tsx services/app/src/protokoll-frist-docker.ts <containerordner> [<diagnoseordner>]
// Ein-Befehl-Weg: der Dienst `protokollpflege` in docker-compose.prod.yml ruft ihn stündlich.
// Coolify: derselbe Aufruf als geplanter Lauf auf dem Host (docs/operations/monitoring-logging.md §8).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ProtokollPflegeErgebnis,
  pflegeDiagnoseordner,
  pflegeProtokolle,
} from "./protokoll-frist";

/** Wo der Docker-Dienst die Containerprotokolle ablegt (Vorgabe von dockerd). */
export const DOCKER_CONTAINER_ORDNER = "/var/lib/docker/containers";

/** Container-Kennungen sind Hex-Zeichenketten; alles andere im Ordner wird nicht angefasst. */
const CONTAINER_ID = /^[0-9a-f]{12,64}$/;

/** Ein Lauf über alle Container — je Container das Ergebnis der Pflege. */
export function pflegeDockerProtokolle(opts: {
  ordner?: string;
  diagnoseordner?: string;
  jetzt?: number;
}): { container: Record<string, ProtokollPflegeErgebnis>; diagnose: string[] } {
  const ordner = opts.ordner ?? DOCKER_CONTAINER_ORDNER;
  const zeit = opts.jetzt === undefined ? {} : { jetzt: opts.jetzt };
  const container: Record<string, ProtokollPflegeErgebnis> = {};
  if (existsSync(ordner)) {
    for (const id of readdirSync(ordner)) {
      const verzeichnis = join(ordner, id);
      const aktiv = join(verzeichnis, `${id}-json.log`);
      if (!CONTAINER_ID.test(id) || !statSync(verzeichnis).isDirectory() || !existsSync(aktiv)) {
        continue;
      }
      // Dockers Rotationen (`<id>-json.log.N`) und die Archive dieser Pflege (`<id>-json.<stempel>.log`).
      const rotation = new RegExp(`^${id}-json\\.(?:log\\.\\d+|\\d{8}T\\d{6}Z\\.log)$`);
      container[id] = pflegeProtokolle({
        datei: aktiv,
        ...zeit,
        istKandidat: (name) => rotation.test(name),
      });
    }
  }
  const diagnose = opts.diagnoseordner
    ? pflegeDiagnoseordner({ ordner: opts.diagnoseordner, ...zeit })
    : [];
  return { container, diagnose };
}

// Als Programm gestartet: ein Lauf, eine Zusammenfassung ohne Inhalte (nur Zahlen).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lauf = pflegeDockerProtokolle({
    ordner: process.argv[2] ?? DOCKER_CONTAINER_ORDNER,
    ...(process.argv[3] ? { diagnoseordner: process.argv[3] } : {}),
  });
  const ergebnisse = Object.values(lauf.container);
  const rotiert = ergebnisse.filter((e) => e.rotiertNach !== null).length;
  const geloescht = ergebnisse.reduce((summe, e) => summe + e.geloescht.length, 0);
  process.stdout.write(
    `Protokollpflege (Docker): ${ergebnisse.length} Container, ${rotiert} rotiert, ${geloescht} Dateien gelöscht, ${lauf.diagnose.length} Diagnosekopien gelöscht.\n`,
  );
}
