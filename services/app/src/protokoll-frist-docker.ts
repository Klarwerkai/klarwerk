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
//   · `<id>-json.log` (die aktive Datei) wird nie gekürzt, umbenannt oder ersetzt. Führt Docker den
//     Container als gestoppt oder pausiert (dann kommt kein Rotationsimpuls), werden überfällige
//     Zeilen AN ORT UND STELLE mit gleicher Byte-Länge geschwärzt (Nacharbeit 20,
//     `schwaerzeUeberfaelligeZeilen`) — Inode, Grösse und Dockers Positionen bleiben unverändert.
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
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROTOKOLL_FRIST_TAGE,
  type ProtokollPflegeErgebnis,
  aeltesterInhalt,
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

/** Laut Docker pausiert: der Prozess ist eingefroren, Docker hält den Schreiber offen. */
function istPausiert(konfiguration: DockerKonfiguration | null): boolean {
  return konfiguration?.State?.Paused === true;
}

/** Das Ergebnis je Container. */
export interface DockerPflegeErgebnis extends ProtokollPflegeErgebnis {
  /** In der aktiven Datei eines gestoppten oder pausierten Containers geschwärzte Zeilen. */
  aktiveZeilenGeschwaerzt: number;
}

/**
 * DIE AKTIVE DATEI EINES GESTOPPTEN ODER PAUSIERTEN APP-CONTAINERS (Ben, Nacharbeiten 18–20).
 *
 * Ein solcher Container schreibt keinen Rotationsimpuls; seine aktive Datei bliebe ohne Grenze stehen.
 * Austausch (Umbenennen, Nacharbeit 18/19) und Kürzen (copytruncate, Nacharbeit 15) sind dabei nicht
 * Docker-verträglich: Docker kann die Datei jederzeit offen haben (pausiert ohnehin, gestoppt beim
 * gleichzeitigen Start) und führt eigene Byte-Positionen und eine eigene Grössenzählung.
 *
 * DESHALB SCHWÄRZEN AN ORT UND STELLE, GLEICHE BYTE-LÄNGE. Jede überfällige Zeile wird an ihrer Stelle
 * durch eine inhaltsfreie JSON-Zeile genau gleicher Länge überschrieben. Datei, Inode, Grösse und jede
 * Byte-Position bleiben, wie sie waren: Dockers Schreiber (er hängt nur am Ende an) und seine
 * Grössenzählung bleiben gültig — gleich ob der Container steht, pausiert oder genau jetzt startet;
 * es gibt keinen Zeitpunkt, an dem Docker eine Datei offen hätte, die der Pfad nicht mehr meint. Neue
 * Zeilen liegen immer HINTER dem gelesenen Bereich und werden nie berührt.
 *
 * Was bleibt, ist je überfälliger Zeile ein inhaltsloses Gerüst (Zeit, Strom) — kein Protokollinhalt.
 * Diese Gerüste verschwinden mit Dockers nächster Rotation bzw. dem Entfernen des Containers.
 *
 * Gibt die Zahl der geschwärzten Zeilen zurück.
 */
function schwaerzeUeberfaelligeZeilen(aktiv: string, jetzt: number, fristMs: number): number {
  const fd = openSync(aktiv, "r+");
  try {
    // Gelesen wird der Stand JETZT. Was Docker danach anhängt, liegt hinter diesem Bereich und wird
    // nicht berührt; was Docker davor schon geschrieben hatte, ist im gelesenen Bereich und wird
    // genauso behandelt wie jede andere Zeile — es gibt keine Grössennotiz, die veralten könnte.
    const groesse = fstatSync(fd).size;
    const inhalt = Buffer.alloc(groesse);
    readSync(fd, inhalt, 0, groesse, 0);
    let geschwaerzt = 0;
    let anfang = 0;
    while (anfang < groesse) {
      const ende = inhalt.indexOf(0x0a, anfang);
      if (ende === -1) {
        break; // eine unvollständige letzte Zeile schreibt Docker gerade — nicht anfassen
      }
      const laenge = ende - anfang;
      const ersatz = ersatzZeile(
        inhalt.subarray(anfang, ende).toString("utf8"),
        laenge,
        jetzt,
        fristMs,
      );
      if (ersatz !== null) {
        writeSync(fd, ersatz, 0, laenge, anfang);
        geschwaerzt += 1;
      }
      anfang = ende + 1;
    }
    return geschwaerzt;
  } finally {
    closeSync(fd);
  }
}

/**
 * Die Ersatzzeile GLEICHER Byte-Länge für eine überfällige Zeile — oder `null`, wenn die Zeile bleibt
 * (jünger als die Frist, schon geschwärzt, nur Leerraum).
 *
 *   überfällig, lesbar  → `{"log":"\n","stream":…,"time":…}` + Leerzeichen bis zur alten Länge.
 *                         Die Zeitangabe bleibt — sie trägt keinen Inhalt und hält die Reihenfolge.
 *   nicht lesbar        → nur Leerzeichen (für Dockers JSON-Leser blosser Zwischenraum). Im Zweifel
 *                         geht die Abweichung zur Löschung, nie zum Erhalt.
 */
function ersatzZeile(zeile: string, laenge: number, jetzt: number, fristMs: number): Buffer | null {
  if (zeile.trim().length === 0) {
    return null;
  }
  let eintrag: Record<string, unknown> | null = null;
  try {
    const wert: unknown = JSON.parse(zeile);
    eintrag =
      wert !== null && typeof wert === "object" && !Array.isArray(wert)
        ? (wert as Record<string, unknown>)
        : null;
  } catch {
    eintrag = null;
  }
  const zeitRoh = eintrag?.time;
  const zeit = typeof zeitRoh === "string" ? Date.parse(zeitRoh) : Number.NaN;
  if (eintrag !== null && Number.isFinite(zeit)) {
    if (jetzt - zeit < fristMs || istErsatzgeruest(eintrag)) {
      return null;
    }
    const huelle = JSON.stringify({
      log: "\n",
      stream: eintrag.stream === "stderr" ? "stderr" : "stdout",
      time: eintrag.time,
    });
    if (Buffer.byteLength(huelle) <= laenge) {
      return Buffer.from(huelle.padEnd(laenge, " "), "utf8").subarray(0, laenge);
    }
  }
  return Buffer.alloc(laenge, 0x20);
}

/**
 * Ist das GENAU das Ersatzgerüst, das `ersatzZeile` schreibt? (Ben, Nacharbeit 22)
 *
 * Nur dann gilt eine Zeile als bereits geschwärzt — vollständig geprüft: genau die drei Schlüssel
 * `log`, `stream`, `time`, `log` ist nur der Zeilenumbruch, `stream` ist `stdout`/`stderr`, `time`
 * eine Zeichenkette. Ein leerer `log` neben weiteren Feldern (etwa `attrs` mit Personenangaben) ist
 * KEIN Gerüst, sondern Inhalt — und wird geschwärzt wie jede andere überfällige Zeile.
 */
function istErsatzgeruest(eintrag: Record<string, unknown>): boolean {
  const schluessel = Object.keys(eintrag).sort();
  return (
    schluessel.length === 3 &&
    schluessel[0] === "log" &&
    schluessel[1] === "stream" &&
    schluessel[2] === "time" &&
    eintrag.log === "\n" &&
    (eintrag.stream === "stdout" || eintrag.stream === "stderr") &&
    typeof eintrag.time === "string"
  );
}

/**
 * Das Inhaltsalter EINER Datei für den Bericht — über ALLE Zeilen (Ben, Nacharbeit 23).
 *
 *   zeit        die ÄLTESTE gültige Zeitangabe einer Zeile mit Inhalt (Minimum, nicht die erste —
 *               eine junge Zeile darf eine spätere alte nicht verdecken); `null`: keine.
 *   inhalt      ob überhaupt eine Zeile Inhalt trägt. Geschwärzte Gerüste und Leerraum zählen nicht.
 *   ungeklaert  Inhaltsreste OHNE gültige Zeitangabe: unlesbare Zeilen, Zeilen ohne `time` und eine
 *               unvollständige Endzeile (ohne abschliessenden Zeilenumbruch — Docker schreibt sie
 *               womöglich gerade weiter; die Pflege lässt sie deshalb unberührt). Ihr Alter ist
 *               unbekannt; der Bericht bestätigt die Frist dann NICHT (`fristBestaetigt`).
 */
function inhaltsalterDerDatei(pfad: string): {
  zeit: number | null;
  inhalt: boolean;
  ungeklaert: number;
} {
  const zeilen = readFileSync(pfad, "utf8").split("\n");
  // Was nach dem letzten Zeilenumbruch steht, ist eine unvollständige Endzeile.
  const endzeile = zeilen.pop() ?? "";
  let aeltestes: number | null = null;
  let inhalt = false;
  let ungeklaert = 0;
  for (const zeile of zeilen) {
    if (zeile.trim().length === 0) {
      continue;
    }
    let eintrag: Record<string, unknown> | null = null;
    try {
      const wert: unknown = JSON.parse(zeile);
      eintrag =
        wert !== null && typeof wert === "object" && !Array.isArray(wert)
          ? (wert as Record<string, unknown>)
          : null;
    } catch {
      eintrag = null;
    }
    // Nur das vollständig geprüfte Ersatzgerüst gilt als inhaltsfrei (Nacharbeit 22).
    if (eintrag !== null && istErsatzgeruest(eintrag)) {
      continue;
    }
    inhalt = true;
    // Docker schreibt `time` als ISO-Angabe, pino (Diagnosekopien) als Millisekunden.
    const zeitWert = eintrag?.time;
    const zeit =
      typeof zeitWert === "string"
        ? Date.parse(zeitWert)
        : typeof zeitWert === "number"
          ? zeitWert
          : Number.NaN;
    if (Number.isFinite(zeit)) {
      aeltestes = aeltestes === null ? zeit : Math.min(aeltestes, zeit);
    } else {
      ungeklaert += 1;
    }
  }
  if (endzeile.trim().length > 0) {
    inhalt = true;
    ungeklaert += 1;
  }
  return { zeit: aeltestes, inhalt, ungeklaert };
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
  /** Laut Docker sicher gestoppt — dann schwärzt die Pflege überfällige Zeilen der aktiven Datei. */
  gestoppt: boolean;
  /** Laut Docker pausiert — ebenso (Nacharbeit 20). */
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
 *   ungeklaerteReste    Inhaltszeilen ohne gültige Zeitangabe ÜBER ALLE Dateien — unlesbar, ohne
 *                       `time` oder eine unvollständige Endzeile —, auch wenn andere Zeilen datiert
 *                       sind (Nacharbeit 23).
 *   fristBestaetigt     nur wahr, wenn keine Inhaltszeile 14 Tage oder älter ist UND nichts ungeklärt
 *                       ist (keine Datei ohne Zeitangabe, kein ungeklärter Rest).
 */
export interface InhaltsAlter {
  aeltesteZeileTage: number | null;
  ohneZeitangabe: number;
  ohneZeitangabeDateidatumTage: number | null;
  ungeklaerteReste: number;
  fristBestaetigt: boolean;
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
    let ungeklaerteReste = 0;
    for (const pfad of pfade) {
      const stand = statSync(pfad);
      if (stand.size === 0) {
        continue; // leer: kein Protokollinhalt
      }
      // Nacharbeit 20: geschwärzte Zeilen tragen nur noch ihre Zeit — sie zählen nicht als Inhalt.
      // Nacharbeit 23: ALLE Zeilen, das Minimum, und ungeklärte Reste gesondert.
      const { zeit, inhalt, ungeklaert } = inhaltsalterDerDatei(pfad);
      ungeklaerteReste += ungeklaert;
      if (zeit !== null) {
        zeilen.push(zeit);
      } else if (inhalt) {
        daten.push(
          Math.min(stand.mtimeMs, stand.birthtimeMs > 0 ? stand.birthtimeMs : stand.mtimeMs),
        );
      }
    }
    const aeltesteZeileTage = zeilen.length === 0 ? null : tage(Math.min(...zeilen));
    return {
      aeltesteZeileTage,
      ohneZeitangabe: daten.length,
      ohneZeitangabeDateidatumTage: daten.length === 0 ? null : tage(Math.min(...daten)),
      ungeklaerteReste,
      fristBestaetigt:
        (aeltesteZeileTage === null || aeltesteZeileTage < PROTOKOLL_FRIST_TAGE) &&
        daten.length === 0 &&
        ungeklaerteReste === 0,
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
      // Gestoppt oder pausiert: kein Rotationsimpuls — überfällige Zeilen der aktiven Datei werden an
      // Ort und Stelle geschwärzt (s. `schwaerzeUeberfaelligeZeilen`). Laufend: Impuls und Rotation.
      const konfiguration = leseKonfiguration(verzeichnis);
      const aktiveZeilenGeschwaerzt =
        istGestoppt(konfiguration) || istPausiert(konfiguration)
          ? schwaerzeUeberfaelligeZeilen(join(verzeichnis, `${id}-json.log`), jetzt, fristMs)
          : 0;
      container[id] = { rotiertNach: null, geloescht, aktiveZeilenGeschwaerzt };
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
  const geschwaerzt = ergebnisse.reduce((summe, e) => summe + e.aktiveZeilenGeschwaerzt, 0);
  process.stdout.write(
    `Protokollpflege (Docker): ${ergebnisse.length} Container, ${rotiert} rotiert, ${geloescht} Dateien gelöscht, ${geschwaerzt} Zeilen geschwärzt, ${lauf.diagnose.length} Diagnosekopien gelöscht.\n`,
  );
}
