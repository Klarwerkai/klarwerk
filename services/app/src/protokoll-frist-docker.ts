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
//   · `<id>-json.log` (die aktive Datei) eines LAUFENDEN Containers wird nie angefasst. Nur wenn
//     Docker den Container ausdrücklich als gestoppt führt, entfernt die Pflege daraus die Zeilen ab
//     14 Tagen (Nacharbeit 18, `kuerzeGestoppteAktiveDatei`) — dann schreibt Docker nicht hinein.
//   · Gelöscht werden nur Dockers EIGENE, abgeschlossene Rotationen (`<id>-json.log.N`) — dieselben
//     Dateien, die Docker beim Rotieren selbst entfernt —, sobald ihre älteste Zeile 14 Tage alt ist
//     (Dockers `"time"` je Zeile), dazu Reste der ersten Fassung (Archive `<id>-json.<stempel>.log`
//     nach derselben Frist, `<id>-json.log.beginn` sofort).
//   · Dass die aktive Datei eines laufenden Containers nicht über die Frist altert, leistet Dockers
//     eigene Rotation nach Menge (`max-size`), täglich angestossen durch den Rotationsimpuls der App
//     (protokoll-rotationsimpuls.ts). Der Bericht weist ihr Alter GETRENNT aus (Runbook §8).
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
import {
  existsSync,
  linkSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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
  State?: { Running?: unknown; Paused?: unknown; Restarting?: unknown };
}

/**
 * Steht der Container laut Docker sicher still? Nur dann schreibt Docker nicht in die aktive Datei.
 * Im Zweifel (keine lesbare Konfiguration, fehlender Zustand, Pause, Neustart): NEIN.
 */
function istGestoppt(konfiguration: DockerKonfiguration | null): boolean {
  const zustand = konfiguration?.State;
  return (
    zustand !== undefined &&
    zustand.Running === false &&
    zustand.Paused !== true &&
    zustand.Restarting !== true
  );
}

/**
 * PAUSIERT (Ben, Nacharbeit 19): Der Prozess ist eingefroren, aber Docker hält den Schreiber der
 * aktiven Datei OFFEN — jeder Eingriff in die Datei verschöbe Dockers Schreibposition, genau der
 * Lesefehler aus Nacharbeit 15. Und weil der Prozess steht, kommt auch kein Rotationsimpuls.
 * Docker-verträglich liesse sich die Frist hier nur über den LEBENSZYKLUS durchsetzen (den Container
 * fortsetzen, damit Impuls und Docker-Rotation greifen, oder eine lange Pause wie einen Stopp
 * behandeln). Beides greift in den Betrieb ein und ist eine offene BETREIBER-/PRODUKTENTSCHEIDUNG.
 * Bis dahin: kein Dateieingriff, aber automatische Erkennung — der Lauf meldet einen pausierten
 * ausgewählten Container mit überfälligem Inhalt und endet mit eigenem Exit-Code (3).
 */
function istPausiert(konfiguration: DockerKonfiguration | null): boolean {
  return konfiguration?.State?.Paused === true;
}

/** Das Ergebnis je Container. */
export interface DockerPflegeErgebnis extends ProtokollPflegeErgebnis {
  /** Aus der aktiven Datei eines gestoppten Containers entfernte Zeilen. */
  aktiveZeilenEntfernt: number;
  /** Was mit einem Austausch aus dem vorigen Lauf geschah (s. `klaereAustausch`). */
  austausch: "keiner" | "abgeschlossen" | "zurueckgenommen";
  /** Pausiert und mit Inhalt älter als die Frist — die offene Entscheidung (s. `istPausiert`). */
  pausiertUeberfaellig: boolean;
}

/**
 * DIE AKTIVE DATEI EINES GESTOPPTEN APP-CONTAINERS (Ben, Nacharbeit 18).
 *
 * Ein gestoppter Container schreibt nichts — auch keinen Rotationsimpuls —, seine aktive Datei bliebe
 * ohne Grenze stehen. Da Docker in diesem Zustand NICHT in sie schreibt, gibt es keine Schreibposition,
 * die ein Eingriff verschieben könnte (der Lesefehler aus Nacharbeit 15 entstand am LAUFENDEN Schreiber).
 * Die Zeilen, die die Frist noch nicht erreicht haben, kommen in eine Nachbardatei, die dann ATOMAR an
 * die Stelle der aktiven tritt. `docker logs` liest danach genau diese jüngeren Zeilen; beim nächsten
 * Start öffnet Docker die Datei neu und misst ihre Grösse frisch. Zeilen ohne lesbare Zeitangabe fallen
 * mit (Docker schreibt jede Zeile mit `time`). Unmittelbar vor dem Austausch wird der Zustand erneut
 * gelesen; läuft der Container inzwischen, unterbleibt der Austausch.
 *
 * DER KONKURRIERENDE START (Ben, Nacharbeit 19). Startet Docker den Container genau zwischen dieser
 * Prüfung und dem Umbenennen, hält Docker die ALTE Datei offen und schreibt in sie; der Pfad zeigte
 * dann auf die neue. Eine Sperre gegen Dockers Start gibt es nicht — deshalb wird der Austausch so
 * gebaut, dass er sich ERKENNEN UND ZURÜCKNEHMEN lässt:
 *   · vor dem Austausch hält ein fester Verweis (Hardlink `….frist-alt`) die alte Datei fest, und
 *     ihre Grösse wird notiert (`….frist-pruefung`);
 *   · der NÄCHSTE Lauf (`klaereAustausch`) misst die alte Datei: Ist sie gewachsen, schreibt Docker
 *     in sie — die App schreibt beim Start sofort (Startbericht, Gesundheitsabfragen). Dann tritt sie
 *     wieder an ihren Pfad; Dockers Schreibposition stimmt damit wieder, nichts ist verloren, und die
 *     Frist greift über den Rotationsimpuls des nun laufenden Containers. Ist sie NICHT gewachsen, hat
 *     Docker sie nicht geöffnet, und der Verweis fällt.
 *
 * Gibt die Zahl der entfernten Zeilen zurück (0: nichts überfällig, nichts geändert).
 */
function kuerzeGestoppteAktiveDatei(
  verzeichnis: string,
  aktiv: string,
  jetzt: number,
  fristMs: number,
): number {
  const zeilen = readFileSync(aktiv, "utf8").split("\n");
  const behalten: string[] = [];
  let entfernt = 0;
  for (const zeile of zeilen) {
    if (zeile.length === 0) {
      continue;
    }
    const zeit = /"time":"([^"]+)"/.exec(zeile)?.[1];
    const ms = zeit ? Date.parse(zeit) : Number.NaN;
    if (Number.isFinite(ms) && jetzt - ms < fristMs) {
      behalten.push(zeile);
    } else {
      entfernt += 1;
    }
  }
  if (entfernt === 0 || !istGestoppt(leseKonfiguration(verzeichnis))) {
    return 0;
  }
  const alt = `${aktiv}${ALT_ENDUNG}`;
  linkSync(aktiv, alt);
  writeFileSync(`${aktiv}${PRUEF_ENDUNG}`, `${statSync(alt).size}\n`, "utf8");
  const neu = `${aktiv}.frist-neu`;
  writeFileSync(neu, behalten.length > 0 ? `${behalten.join("\n")}\n` : "", "utf8");
  renameSync(neu, aktiv);
  return entfernt;
}

/** Der feste Verweis auf die abgelöste Datei und die notierte Grösse (s. oben). */
const ALT_ENDUNG = ".frist-alt";
const PRUEF_ENDUNG = ".frist-pruefung";

/**
 * Klärt einen offenen Austausch aus dem vorigen Lauf. Ergebnis:
 *   `keiner`        — es gab keinen;
 *   `abgeschlossen` — Docker hat die alte Datei nicht beschrieben; Verweis und Notiz sind gelöscht;
 *   `zurueckgenommen` — Docker schreibt in die alte Datei; sie steht wieder an ihrem Pfad.
 */
function klaereAustausch(aktiv: string): "keiner" | "abgeschlossen" | "zurueckgenommen" {
  const alt = `${aktiv}${ALT_ENDUNG}`;
  const pruefung = `${aktiv}${PRUEF_ENDUNG}`;
  if (!existsSync(alt)) {
    if (existsSync(pruefung)) {
      unlinkSync(pruefung);
    }
    return "keiner";
  }
  const notiert = Number(existsSync(pruefung) ? readFileSync(pruefung, "utf8").trim() : Number.NaN);
  // Ohne lesbare Notiz im Zweifel ZURÜCK: das bewahrt Dockers Datei und schiebt die Frist nur auf.
  const gewachsen = !Number.isFinite(notiert) || statSync(alt).size > notiert;
  if (gewachsen) {
    renameSync(alt, aktiv);
  } else {
    unlinkSync(alt);
  }
  if (existsSync(pruefung)) {
    unlinkSync(pruefung);
  }
  return gewachsen ? "zurueckgenommen" : "abgeschlossen";
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
  /** Laut Docker sicher gestoppt — dann kürzt die Pflege auch die aktive Datei (Nacharbeit 18). */
  gestoppt: boolean;
  /** Laut Docker pausiert — dann kein Dateieingriff; überfälliger Inhalt wird gemeldet (Nacharbeit 19). */
  pausiert: boolean;
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
      // Die abgelöste Datei eines offenen Austauschs (`….frist-alt`) zählt mit — ihr Inhalt besteht
      // noch; Notiz und Zwischendatei tragen keinen Protokollinhalt.
      const protokolle = readdirSync(verzeichnis).filter(
        (n) =>
          n.startsWith(`${id}-json.`) &&
          !n.endsWith(".beginn") &&
          !n.endsWith(PRUEF_ENDUNG) &&
          !n.endsWith(".frist-neu"),
      );
      container.push({
        id,
        name: typeof konfiguration?.Name === "string" ? konfiguration.Name : "",
        abbild: typeof konfiguration?.Config?.Image === "string" ? konfiguration.Config.Image : "",
        ausgewaehlt: opts.auswahl !== null && gehoertZurAuswahl(verzeichnis, opts.auswahl),
        gestoppt: istGestoppt(konfiguration),
        pausiert: istPausiert(konfiguration),
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
}): {
  container: Record<string, DockerPflegeErgebnis>;
  diagnose: string[];
} {
  const ordner = opts.ordner ?? DOCKER_CONTAINER_ORDNER;
  const zeit = opts.jetzt === undefined ? {} : { jetzt: opts.jetzt };
  const jetzt = opts.jetzt ?? Date.now();
  const fristMs = PROTOKOLL_FRIST_TAGE * 86_400_000;
  const container: Record<string, DockerPflegeErgebnis> = {};
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
      const aktiv = join(verzeichnis, `${id}-json.log`);
      // Zuerst ein offener Austausch aus dem vorigen Lauf (Nacharbeit 19).
      const austausch = klaereAustausch(aktiv);
      const konfiguration = leseKonfiguration(verzeichnis);
      const aktiveZeilenEntfernt =
        austausch !== "zurueckgenommen" && istGestoppt(konfiguration)
          ? kuerzeGestoppteAktiveDatei(verzeichnis, aktiv, jetzt, fristMs)
          : 0;
      // Pausiert: Docker hält den Schreiber offen — kein Dateieingriff (s. `istPausiert`).
      const pausiertUeberfaellig =
        istPausiert(konfiguration) && jetzt - (ersteZeitImInhalt(aktiv) ?? jetzt) >= fristMs;
      container[id] = {
        rotiertNach: null,
        geloescht,
        aktiveZeilenEntfernt,
        austausch,
        pausiertUeberfaellig,
      };
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
  // Nacharbeit 19: ein pausierter ausgewählter Container mit überfälligem Inhalt ist eine offene
  // Entscheidung, kein stiller Erfolg — der geplante Lauf endet sichtbar mit Exit 3.
  const pausiert = Object.entries(lauf.container).filter(([, e]) => e.pausiertUeberfaellig);
  if (pausiert.length > 0) {
    process.stderr.write(
      `Protokollpflege (Docker): ${pausiert.length} pausierte(r) Container mit Protokoll älter als die Frist — ohne Fortsetzen nicht Docker-verträglich löschbar: ${pausiert.map(([id]) => id.slice(0, 12)).join(", ")}\n`,
    );
    process.exit(3);
  }
}
