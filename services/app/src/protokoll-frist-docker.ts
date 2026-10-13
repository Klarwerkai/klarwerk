// R-0664 · DIE 14-TAGE-FRIST AM SPEICHERORT DER DOCKER-PROTOKOLLE (Entscheidung 2, 12.10.2026).
//
// Im Docker-Betrieb (Ein-Befehl-Weg `docker-compose.prod.yml`, Coolify) schreibt die App auf die
// Standardausgabe, und der Docker-Dienst legt sie auf dem HOST ab:
//     /var/lib/docker/containers/<id>/<id>-json.log      die aktive Datei
//     /var/lib/docker/containers/<id>/<id>-json.log.1 …  Dockers eigene Rotationen (max-file)
// Docker löscht nur nach Menge, nie nach Alter. Die App selbst kommt an diese Dateien nicht heran.
//
// DIE AKTIVE DATEI GEHÖRT DOCKER (Ben, Nacharbeit 15). Die erste Fassung kürzte sie wie auf der Insel
// („copytruncate"). Eine echte Docker-Probe hat gezeigt: Docker schreibt danach weiter, aber
// `docker logs` liest die neuen Zeilen nicht mehr — der Dienst führt eigene Byte-Positionen. Docker
// selbst warnt, diese Dateien von aussen zu bearbeiten (docs.docker.com, json-file-Treiber).
// DESHALB GILT JETZT:
//   · `<id>-json.log` (die aktive Datei) wird NIE geöffnet, gekürzt, umbenannt oder gelöscht.
//   · Gelöscht werden nur Dockers EIGENE, abgeschlossene Rotationen (`<id>-json.log.N`) — dieselben
//     Dateien, die Docker beim Rotieren selbst entfernt —, sobald ihre älteste Zeile 14 Tage alt ist
//     (Dockers `"time"` je Zeile), dazu Reste der ersten Fassung (Archive `<id>-json.<stempel>.log`
//     nach derselben Frist, `<id>-json.log.beginn` sofort).
//   · Dass die aktive Datei nicht über die Frist altert, leistet Dockers eigene Rotation nach Menge
//     (`max-size`, docker-compose.prod.yml). Der Bericht weist ihr Alter GETRENNT aus; ist es ≥ 14 Tage,
//     hat Docker in der Frist nicht rotiert, und das steht dann offen da (Runbook §8).
// Optional dazu ein Diagnoseordner auf dem Host, in dem jede Datei nach derselben Frist fällt.
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
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROTOKOLL_FRIST_TAGE,
  type ProtokollPflegeErgebnis,
  aeltesterInhalt,
  ersteZeitImInhalt,
  pflegeDiagnoseordner,
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

interface DockerKonfiguration {
  Name?: unknown;
  Config?: { Image?: unknown; Labels?: Record<string, unknown> | null };
}

function leseKonfiguration(verzeichnis: string): DockerKonfiguration | null {
  try {
    return JSON.parse(
      readFileSync(join(verzeichnis, "config.v2.json"), "utf8"),
    ) as DockerKonfiguration;
  } catch {
    return null;
  }
}

/** Trägt der Container laut seiner Docker-Konfiguration das verlangte Label? Im Zweifel: nein. */
function gehoertZurAuswahl(verzeichnis: string, auswahl: ContainerAuswahl): boolean {
  return leseKonfiguration(verzeichnis)?.Config?.Labels?.[auswahl.label] === auswahl.wert;
}

/** Eine Zeile des Berichts — nur Kennungen, Namen und Zahlen, nie ein Protokollinhalt. */
export interface ContainerBericht {
  id: string;
  name: string;
  abbild: string;
  ausgewaehlt: boolean;
  protokolldateien: number;
}

/**
 * Das Alter des Protokollinhalts einer Dateimenge — Inhaltszeit und Dateidatum GETRENNT
 * (Ben, Nacharbeit 14). Das Anlagedatum einer Datei sagt nichts über ihre Zeilen: Nach dem Kürzen
 * („copytruncate") bleibt eine alte aktive Datei alt, obwohl sie leer ist oder nur neue Zeilen trägt.
 *
 *   aeltesteZeileTage   Alter der ältesten ZEILE laut Zeitangabe im Inhalt (`time`); leere Dateien
 *                       und Dateien ohne Zeitangabe zählen hier nicht. `null`: keine solche Zeile.
 *   ohneZeitangabe      nicht leere Dateien, in deren Kopf keine Zeitangabe erkennbar ist — ihr
 *                       Inhaltszeitpunkt ist UNBEKANNT.
 *   ohneZeitangabeDateidatumTage  für genau diese: das Alter des älteren Dateidatums (Änderung/
 *                       Anlage) — ein Hilfswert, ausdrücklich keine Inhaltszeit.
 */
export interface InhaltsAlter {
  aeltesteZeileTage: number | null;
  ohneZeitangabe: number;
  ohneZeitangabeDateidatumTage: number | null;
}

/**
 * DER BETRIEBSNACHWEIS (Ben, Nacharbeit 13): ändert NICHTS, sondern zeigt am echten Host, welche
 * Container die Auswahl trifft (Name, Abbild, Label) und wie alt die älteste Protokollzeile je
 * Container und im Diagnoseordner ist. Vor und nach der Einrichtung des geplanten Laufs ausgeführt,
 * belegt er Zuordnung und Löschwirkung: danach darf bei keinem ausgewählten Container eine Rotation
 * und keine Diagnosekopie eine Zeile älter als 14 Tage tragen. Die aktive Datei steht getrennt
 * (`aktiveDatei`): sie hält Docker, nicht diese Pflege. Gemessen wird das INHALTSalter (`InhaltsAlter`).
 */
export function berichteDockerProtokolle(opts: {
  ordner?: string;
  auswahl: ContainerAuswahl | null;
  diagnoseordner?: string;
  jetzt?: number;
}): {
  container: (ContainerBericht & { aktiveDatei: InhaltsAlter; rotationen: InhaltsAlter })[];
  diagnose: InhaltsAlter;
} {
  const ordner = opts.ordner ?? DOCKER_CONTAINER_ORDNER;
  const jetzt = opts.jetzt ?? Date.now();
  const tage = (zeit: number) => Math.round(((jetzt - zeit) / 86_400_000) * 10) / 10;
  const aeltestes = (pfade: string[]): InhaltsAlter => {
    const zeilen: number[] = [];
    const daten: number[] = [];
    for (const pfad of pfade) {
      const stand = statSync(pfad);
      if (stand.size === 0) {
        continue; // leer: kein Protokollinhalt
      }
      const imInhalt = ersteZeitImInhalt(pfad);
      if (imInhalt === null) {
        daten.push(
          Math.min(stand.mtimeMs, stand.birthtimeMs > 0 ? stand.birthtimeMs : stand.mtimeMs),
        );
      } else {
        zeilen.push(imInhalt);
      }
    }
    return {
      aeltesteZeileTage: zeilen.length === 0 ? null : tage(Math.min(...zeilen)),
      ohneZeitangabe: daten.length,
      ohneZeitangabeDateidatumTage: daten.length === 0 ? null : tage(Math.min(...daten)),
    };
  };
  const container: (ContainerBericht & { aktiveDatei: InhaltsAlter; rotationen: InhaltsAlter })[] =
    [];
  if (existsSync(ordner)) {
    for (const id of readdirSync(ordner)) {
      const verzeichnis = join(ordner, id);
      if (!CONTAINER_ID.test(id) || !statSync(verzeichnis).isDirectory()) {
        continue;
      }
      const konfiguration = leseKonfiguration(verzeichnis);
      const aktiv = `${id}-json.log`;
      const protokolle = readdirSync(verzeichnis).filter(
        (n) => n.startsWith(`${id}-json.`) && !n.endsWith(".beginn"),
      );
      container.push({
        id,
        name: typeof konfiguration?.Name === "string" ? konfiguration.Name : "",
        abbild: typeof konfiguration?.Config?.Image === "string" ? konfiguration.Config.Image : "",
        ausgewaehlt: opts.auswahl !== null && gehoertZurAuswahl(verzeichnis, opts.auswahl),
        protokolldateien: protokolle.length,
        // Die aktive Datei verwaltet Docker; ihr Alter steht GETRENNT — die Pflege fasst sie nicht an.
        aktiveDatei: aeltestes(
          protokolle.filter((n) => n === aktiv).map((n) => join(verzeichnis, n)),
        ),
        rotationen: aeltestes(
          protokolle.filter((n) => n !== aktiv).map((n) => join(verzeichnis, n)),
        ),
      });
    }
  }
  const diagnose =
    opts.diagnoseordner && existsSync(opts.diagnoseordner)
      ? readdirSync(opts.diagnoseordner)
          .map((n) => join(opts.diagnoseordner as string, n))
          .filter((p) => statSync(p).isFile())
      : [];
  return { container, diagnose: aeltestes(diagnose) };
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
  const jetzt = opts.jetzt ?? Date.now();
  const fristMs = PROTOKOLL_FRIST_TAGE * 86_400_000;
  const container: Record<string, ProtokollPflegeErgebnis> = {};
  const auswahl = opts.auswahl;
  if (auswahl && existsSync(ordner)) {
    for (const id of readdirSync(ordner)) {
      const verzeichnis = join(ordner, id);
      if (
        !CONTAINER_ID.test(id) ||
        !statSync(verzeichnis).isDirectory() ||
        !existsSync(join(verzeichnis, `${id}-json.log`)) ||
        !gehoertZurAuswahl(verzeichnis, auswahl)
      ) {
        continue;
      }
      // Dockers eigene, abgeschlossene Rotationen und die Archive der ersten Fassung. Die aktive
      // Datei `<id>-json.log` passt auf keines der beiden Muster — sie wird nicht angefasst.
      const rotation = new RegExp(`^${id}-json\\.log\\.\\d+(?:\\.gz)?$`);
      const altarchiv = new RegExp(`^${id}-json\\.\\d{8}T\\d{6}Z\\.log$`);
      const marke = `${id}-json.log.beginn`;
      const geloescht: string[] = [];
      for (const name of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, name);
        if (!statSync(pfad).isFile()) {
          continue;
        }
        const faellig =
          name === marke ||
          ((rotation.test(name) || altarchiv.test(name)) &&
            jetzt - aeltesterInhalt(pfad) >= fristMs);
        if (faellig) {
          unlinkSync(pfad);
          geloescht.push(name);
        }
      }
      container[id] = { rotiertNach: null, geloescht };
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
  if (argumente.includes("--bericht")) {
    // Nur lesen, nichts ändern — der Nachweis für Zuordnung und Wirkung (siehe berichteDockerProtokolle).
    const bericht = berichteDockerProtokolle({
      ordner,
      auswahl,
      ...(diagnoseordner ? { diagnoseordner } : {}),
    });
    process.stdout.write(`${JSON.stringify(bericht, null, 2)}\n`);
    process.exit(0);
  }
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
