// R-0664 · DIE 14-TAGE-FRIST AM SPEICHERORT DER DOCKER-PROTOKOLLE (Entscheidung 2, 12.10.2026).
//
// Im Docker-Betrieb (Ein-Befehl-Weg `docker-compose.prod.yml`, Coolify) schreibt die App auf die
// Standardausgabe, und der Docker-Dienst legt sie auf dem HOST ab:
//     /var/lib/docker/containers/<id>/<id>-json.log      die aktive Datei
//     /var/lib/docker/containers/<id>/<id>-json.log.1 …  Dockers eigene Rotationen (max-file)
// Docker löscht nur nach Menge, nie nach Alter. Die App selbst kommt an diese Dateien nicht heran.
//
// DIESER LAUF wendet dieselbe Pflege wie auf der Insel (`pflegeProtokolle`, protokoll-frist.ts) auf
// die Klarwerk-Container an: die aktive Datei täglich rotieren (Kopie + Kürzen; Docker hängt weiter
// an), Rotationen und Archive löschen, sobald ihre älteste Zeile 14 Tage alt ist (Dockers `"time"` je
// Zeile). Optional dazu ein Diagnoseordner auf dem Host, in dem jede Datei nach derselben Frist fällt.
//
// NUR DIE AUSGEWÄHLTEN CONTAINER (Ben, Nacharbeit 12). Auf einem Host laufen auch fremde Container —
// deren Protokolle, womöglich Sicherheits-/Auditnachweise mit eigener Regel, gehen diesen Lauf nichts
// an. Bearbeitet wird deshalb NUR ein Container, dessen Docker-Konfiguration (`config.v2.json`,
// `Config.Labels`) das verlangte Label mit dem verlangten Wert trägt. Das `Dockerfile` setzt
// `de.klarwerk.protokollpflege=app` auf das App-Abbild — damit trägt jeder daraus gestartete Container
// es, unter Compose wie unter Coolify. OHNE AUSWAHL WIRD KEIN CONTAINER BEARBEITET; die Kommandozeile
// bricht dann ab.
//
// ER LÄUFT IM VORHANDENEN APP-ABBILD, mit dem Containerordner des Hosts eingehängt:
//     npx tsx services/app/src/protokoll-frist-docker.ts <containerordner> --auswahl <label>=<wert> [--diagnose <ordner>]
// Ein-Befehl-Weg: der Dienst `protokollpflege` in docker-compose.prod.yml ruft ihn stündlich.
// Coolify: derselbe Aufruf als geplanter Lauf auf dem Host (docs/operations/monitoring-logging.md §8).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ProtokollPflegeErgebnis,
  pflegeDiagnoseordner,
  pflegeProtokolle,
} from "./protokoll-frist";

/** Wo der Docker-Dienst die Containerprotokolle ablegt (Vorgabe von dockerd). */
export const DOCKER_CONTAINER_ORDNER = "/var/lib/docker/containers";

/** Das Label, das das `Dockerfile` auf das App-Abbild setzt — die vorgesehene Auswahl. */
export const KLARWERK_AUSWAHL = "de.klarwerk.protokollpflege=app";

/** Container-Kennungen sind Hex-Zeichenketten; alles andere im Ordner wird nicht angefasst. */
const CONTAINER_ID = /^[0-9a-f]{12,64}$/;

/** Welche Container bearbeitet werden: genau die mit diesem Label und Wert. */
export interface ContainerAuswahl {
  label: string;
  wert: string;
}

/** `label=wert` → Auswahl; alles andere (leer, ohne `=`, leere Hälfte) → `null`. */
export function leseAuswahl(roh: string | undefined): ContainerAuswahl | null {
  const teil = roh?.trim() ?? "";
  const trenner = teil.indexOf("=");
  if (trenner <= 0 || trenner === teil.length - 1) {
    return null;
  }
  return { label: teil.slice(0, trenner), wert: teil.slice(trenner + 1) };
}

/** Trägt der Container laut seiner Docker-Konfiguration das verlangte Label? Im Zweifel: nein. */
function gehoertZurAuswahl(verzeichnis: string, auswahl: ContainerAuswahl): boolean {
  try {
    const konfiguration = JSON.parse(readFileSync(join(verzeichnis, "config.v2.json"), "utf8")) as {
      Config?: { Labels?: Record<string, unknown> | null };
    };
    return konfiguration.Config?.Labels?.[auswahl.label] === auswahl.wert;
  } catch {
    return false;
  }
}

/** Ein Lauf über die ausgewählten Container — je Container das Ergebnis der Pflege. */
export function pflegeDockerProtokolle(opts: {
  ordner?: string;
  /** Ohne Auswahl wird KEIN Container bearbeitet. */
  auswahl: ContainerAuswahl | null;
  diagnoseordner?: string;
  jetzt?: number;
}): { container: Record<string, ProtokollPflegeErgebnis>; diagnose: string[] } {
  const ordner = opts.ordner ?? DOCKER_CONTAINER_ORDNER;
  const zeit = opts.jetzt === undefined ? {} : { jetzt: opts.jetzt };
  const container: Record<string, ProtokollPflegeErgebnis> = {};
  const auswahl = opts.auswahl;
  if (auswahl && existsSync(ordner)) {
    for (const id of readdirSync(ordner)) {
      const verzeichnis = join(ordner, id);
      const aktiv = join(verzeichnis, `${id}-json.log`);
      if (
        !CONTAINER_ID.test(id) ||
        !statSync(verzeichnis).isDirectory() ||
        !existsSync(aktiv) ||
        !gehoertZurAuswahl(verzeichnis, auswahl)
      ) {
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

/** Der Wert hinter einer Option (`--auswahl x`), sonst `undefined`. */
function option(argumente: readonly string[], name: string): string | undefined {
  const stelle = argumente.indexOf(name);
  return stelle === -1 ? undefined : argumente[stelle + 1];
}

// Als Programm gestartet: ein Lauf, eine Zusammenfassung ohne Inhalte (nur Zahlen).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumente = process.argv.slice(2);
  const auswahl = leseAuswahl(option(argumente, "--auswahl"));
  if (!auswahl) {
    process.stderr.write(
      `Protokollpflege (Docker): keine Containerauswahl — es wird nichts bearbeitet. Aufruf mit --auswahl ${KLARWERK_AUSWAHL}.\n`,
    );
    process.exit(2);
  }
  const ordner =
    argumente[0] && !argumente[0].startsWith("--") ? argumente[0] : DOCKER_CONTAINER_ORDNER;
  const diagnoseordner = option(argumente, "--diagnose");
  const lauf = pflegeDockerProtokolle({
    ordner,
    auswahl,
    ...(diagnoseordner ? { diagnoseordner } : {}),
  });
  const ergebnisse = Object.values(lauf.container);
  const rotiert = ergebnisse.filter((e) => e.rotiertNach !== null).length;
  const geloescht = ergebnisse.reduce((summe, e) => summe + e.geloescht.length, 0);
  process.stdout.write(
    `Protokollpflege (Docker): ${ergebnisse.length} Container, ${rotiert} rotiert, ${geloescht} Dateien gelöscht, ${lauf.diagnose.length} Diagnosekopien gelöscht.\n`,
  );
}
