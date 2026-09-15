#!/usr/bin/env node
// ================================================================================================
// JOB 4012 — DER SCHEMA-VERTRAG: was ein Release über die Daten weiß, BEVOR es startet.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT. `scripts/insel/build-current-release.mjs` legt heute
// Code und Oberfläche in ein Release und schreibt eine `ROLLBACK.md` mit Handgriffen. Was NICHT
// im Release steht, ist die eine Angabe, die vor dem Umschalten zählt: welche Migrationsstufen
// dieses Release kennt. Der Server ruft `migrate()` beim Start, und `migrate()` fährt, was es
// findet — auch dann, wenn die Daten längst weiter sind als der Code. Ein Release, das eine Stufe
// NICHT kennt, die die Daten schon tragen, ist ein Downgrade; es startet trotzdem und liest gegen
// Spalten, von denen es nichts weiß.
//
// DER VERTRAG IST DESHALB EINE DATEI IM RELEASE und eine zweite NEBEN DEN DATEN:
//
//     <release>/SCHEMA-VERTRAG      was dieses Release kann          (beim Bauen geschrieben)
//     <daten>/SCHEMA-STAND          was die Daten schon gesehen haben (beim Update fortgeschrieben)
//
// Beide tragen dasselbe Format. Der Vergleich ist eine Mengenfrage und keine Zahlenfrage: eine
// blosse Stufenzahl („37 gegen 39") sagt nicht, WELCHE fehlt, und zwei verschiedene Reihen gleicher
// Länge sähen gleich aus.
//
// WAS DIESER VERTRAG AUSDRÜCKLICH NICHT IST — dieselbe Grenze, die `migrationsbeleg.ts` im Kopf
// zieht und die hier nicht verwischt werden darf: Der `SCHEMA-STAND` ist KEIN Migrationsjournal
// der Datenbank. Er wird von `update-einspielen.sh` fortgeschrieben und sagt: „so weit ist ein
// Release an diesen Daten gefahren worden". Er fragt die Datenbank nicht. Genau deshalb trägt er
// `bestaetigt=nein`, solange der Lauf nicht mit grünem Health bestätigt ist — ein unbestätigter
// Stand wird beim Vergleich trotzdem als VORHANDEN gewertet, weil `migrate()` schon gelaufen sein
// KANN, bevor der Health-Check rot wurde. Die Unsicherheit fällt damit auf die sichere Seite.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Die Fassung des Dateiformats. Eine unbekannte Fassung wird abgelehnt, nicht geraten. */
export const VERTRAGSFASSUNG = "1";

/** Die Risikoklassen aus `services/app/src/migrationsbeleg.ts`. Wörtlich dieselben Namen. */
const RISIKOKLASSEN = new Set(["ADDITIV", "TRANSFORMIEREND", "IRREVERSIBEL"]);

/**
 * Liest die Stufen aus dem Quelltext des Migrationsbelegs.
 *
 * WARUM ÜBER DEN QUELLTEXT UND NICHT ÜBER EINEN IMPORT: `build-current-release.mjs` läuft mit
 * blossem `node`, und `migrationsbeleg.ts` ist TypeScript. Ein Import bräuchte `tsx` im Baupfad und
 * damit eine Abhängigkeit, die es heute nicht gibt.
 *
 * FAIL-CLOSED: findet die Erhebung KEINE Stufe, ist das ein Fehler und keine leere Liste. Eine
 * leere Stufenmenge würde jeden Vergleich still grün machen — der teuerste Ausgang von allen.
 */
export function stufenAusQuelle(quelltext) {
  const stufen = [];
  for (const listenname of ["MIGRATIONS_SOLLLISTE", "IRREVERSIBLE_DATENMIGRATIONEN"]) {
    const anfang = quelltext.indexOf(`export const ${listenname}`);
    if (anfang === -1) {
      throw new Error(`Migrationsbeleg: Liste ${listenname} nicht gefunden.`);
    }
    const ende = quelltext.indexOf("\n];", anfang);
    if (ende === -1) {
      throw new Error(`Migrationsbeleg: Liste ${listenname} ist nicht abgeschlossen.`);
    }
    const block = quelltext.slice(anfang, ende);
    // Die Einträge beider Listen enthalten keine verschachtelten Klammern; `[^{}]*` trifft deshalb
    // genau einen Eintrag und läuft nicht über seinen Rand hinaus.
    for (const eintrag of block.match(/\{[^{}]*\}/g) ?? []) {
      const stufe = /\bstufe:\s*"([A-Za-z0-9_]+)"/.exec(eintrag)?.[1];
      const risiko = /\brisiko:\s*"([A-Z]+)"/.exec(eintrag)?.[1];
      if (stufe === undefined || risiko === undefined) {
        continue;
      }
      if (!RISIKOKLASSEN.has(risiko)) {
        throw new Error(`Migrationsbeleg: unbekannte Risikoklasse ${risiko} bei ${stufe}.`);
      }
      stufen.push({ stufe, risiko });
    }
  }
  if (stufen.length === 0) {
    throw new Error("Migrationsbeleg: keine einzige Stufe erhoben — Erhebung gebrochen.");
  }
  return stufen;
}

/** Die kanonische Zeile der Stufenmenge: `NAME:KLASSE`, durch Leerzeichen getrennt, in Reihenfolge. */
export function stufenzeile(stufen) {
  return stufen.map((s) => `${s.stufe}:${s.risiko}`).join(" ");
}

/** SHA-256 über die Stufenzeile. Gleiche Stufen, gleicher Hash. */
export function stufenhash(stufen) {
  return createHash("sha256").update(stufenzeile(stufen), "utf8").digest("hex");
}

/**
 * Der Vertragstext. Ein Schlüssel je Zeile, `schluessel=wert` — lesbar für einen Menschen und für
 * `grep`, und ohne Werkzeug parsbar (die Insel hat kein `jq`).
 */
export function vertragstext({ release, appVersion, commit, stufen, bestaetigt }) {
  const zeilen = [
    `vertrag=${VERTRAGSFASSUNG}`,
    `release=${release}`,
    `app_version=${appVersion}`,
    `commit=${commit}`,
    `stufen=${stufenzeile(stufen)}`,
    `stufenhash=${stufenhash(stufen)}`,
  ];
  if (bestaetigt !== undefined) {
    zeilen.push(`bestaetigt=${bestaetigt}`);
  }
  return `${zeilen.join("\n")}\n`;
}

/**
 * Liest einen Vertrags- oder Standtext. Wirft bei jeder Unklarheit — ein halb gelesener Vertrag
 * ist schlimmer als keiner, weil er wie ein geprüfter aussieht.
 */
export function leseVertrag(text, herkunft) {
  const felder = new Map();
  for (const zeile of text.split("\n")) {
    const schnitt = zeile.indexOf("=");
    if (schnitt > 0) {
      felder.set(zeile.slice(0, schnitt).trim(), zeile.slice(schnitt + 1).trim());
    }
  }
  const fassung = felder.get("vertrag");
  if (fassung !== VERTRAGSFASSUNG) {
    throw new Error(
      `${herkunft}: Vertragsfassung ${fassung ?? "fehlt"}, erwartet ${VERTRAGSFASSUNG}.`,
    );
  }
  const roh = felder.get("stufen") ?? "";
  const stufen = roh
    .split(/\s+/)
    .filter((s) => s !== "")
    .map((paar) => {
      const [stufe, risiko] = paar.split(":");
      if (!stufe || !risiko || !RISIKOKLASSEN.has(risiko)) {
        throw new Error(`${herkunft}: Stufenangabe „${paar}" ist unlesbar.`);
      }
      return { stufe, risiko };
    });
  if (stufen.length === 0) {
    throw new Error(`${herkunft}: keine Stufen genannt.`);
  }
  if (felder.get("stufenhash") !== stufenhash(stufen)) {
    throw new Error(`${herkunft}: stufenhash passt nicht zur Stufenliste.`);
  }
  return {
    release: felder.get("release") ?? "",
    appVersion: felder.get("app_version") ?? "",
    commit: felder.get("commit") ?? "",
    stufen,
    bestaetigt: felder.get("bestaetigt") ?? "",
  };
}

/** Die Exitcodes des Vertragsprüfers. Jeder Ausgang hat seinen eigenen — ein Downgrade ist kein Lesefehler. */
export const VERTRAG_OK = 0;
export const VERTRAG_AUFRUF = 1;
export const VERTRAG_DOWNGRADE = 3;
export const VERTRAG_NICHT_UMKEHRBAR = 4;
export const VERTRAG_UNLESBAR = 5;
/**
 * Es GIBT Daten, aber niemand weiss, wie weit ein Release an ihnen gefahren ist.
 *
 * DER FALL, DEN RUNDE 1 UEBERSEHEN HAT (Ben, Gegenprobe BEN2): Jede Insel, die heute laeuft, wurde
 * mit dem alten `install.command` eingespielt. Ihr Release traegt keinen `SCHEMA-VERTRAG`, und
 * neben ihren Daten liegt kein `SCHEMA-STAND`. Runde 1 las daraus „kein Vorstand" und schloss
 * „nichts zu schuetzen" — und liess eine irreversible Stufe ueber echte Daten laufen. Ein
 * unbekannter Stand ist kein leerer Stand; er ist der einzige, bei dem gar nichts gesagt werden kann.
 */
export const VERTRAG_UNBEKANNT = 10;

/**
 * Der Vergleich. `stand` ist `null`, wenn neben den Daten nichts steht — und das heisst zweierlei,
 * je nachdem, ob es ueberhaupt Daten gibt. Genau diese Unterscheidung hat in Runde 1 gefehlt.
 *
 * DIE VIER URTEILE:
 *   ERSTSTAND        — kein Stand UND keine Daten. Da ist nichts zu schützen, der Vertrag trägt.
 *   UNBEKANNT        — kein Stand, aber Daten. Es ist NICHT sagbar, welche Stufen an ihnen gelaufen
 *                      sind; jede Aussage über Downgrade oder Umkehrbarkeit wäre geraten. Abbruch
 *                      VOR dem Umschalten. Der Mensch kommt mit `--unbekannten-stand-uebernehmen`
 *                      darüber hinweg — und zwar sehenden Auges: ab da gilt JEDE Stufe des
 *                      Releases als neu, eine irreversible braucht also zusätzlich ihre Zustimmung.
 *   DOWNGRADE        — die Daten tragen Stufen, die das neue Release nicht kennt. Es würde gegen
 *                      eine Struktur lesen, von der es nichts weiss. Abbruch VOR dem Umschalten.
 *   NICHT_UMKEHRBAR  — das neue Release bringt eine Stufe mit, die Daten wegnimmt oder umschreibt
 *                      (`IRREVERSIBEL`). Nach dem Start trägt der Rückfall nur noch mit der
 *                      Sicherung; das ist eine MENSCHLICHE Entscheidung, kein Automatismus.
 *                      Zustimmung: `--nicht-umkehrbar-einspielen`.
 *   OK               — alles Neue läuft additiv oder transformierend in `migrate()` beim Start mit.
 */
export function pruefeVertrag(stand, vertrag, optionen = {}) {
  const {
    nichtUmkehrbarErlaubt = false,
    datenVorhanden = false,
    unbekanntUebernehmen = false,
  } = optionen;
  if (stand === null && !datenVorhanden) {
    return {
      code: VERTRAG_OK,
      urteil: "ERSTSTAND",
      meldung: `Vertrag trägt: kein Vorstand und keine Daten, ${vertrag.stufen.length} Stufen laufen beim Start an.`,
    };
  }
  if (stand === null && !unbekanntUebernehmen) {
    return {
      code: VERTRAG_UNBEKANNT,
      urteil: "UNBEKANNT",
      meldung:
        "Unbekannter Datenstand: es liegen Daten vor, aber kein SCHEMA-STAND und kein Vertrag der laufenden Fassung. Welche Stufen an diesen Daten gelaufen sind, ist nicht sagbar — Downgrade und Umkehrbarkeit wären geraten. Zustimmung mit --unbekannten-stand-uebernehmen (dann gilt jede Stufe des Releases als neu).",
    };
  }
  // Ein übernommener unbekannter Stand wird als LEER gerechnet — nicht, weil er leer wäre, sondern
  // weil das die vorsichtige Seite ist: jede Stufe des Releases gilt damit als neu und läuft durch
  // dieselbe Umkehrbarkeitsprüfung wie bei einer Erstinstallation.
  const bisher = stand ?? { stufen: [], appVersion: "unbekannt" };
  const uebernommen = stand === null;
  const imRelease = new Map(vertrag.stufen.map((s) => [s.stufe, s.risiko]));
  const imStand = new Map(bisher.stufen.map((s) => [s.stufe, s.risiko]));

  const fehlend = bisher.stufen.filter((s) => !imRelease.has(s.stufe)).map((s) => s.stufe);
  if (fehlend.length > 0) {
    return {
      code: VERTRAG_DOWNGRADE,
      urteil: "DOWNGRADE",
      meldung: `Downgrade: die Daten tragen ${fehlend.length} Stufe(n), die ${vertrag.appVersion} nicht kennt — ${fehlend.join(", ")}.`,
    };
  }

  // Neu ist eine Stufe, die im Stand fehlt — UND eine, die dort steht, aber inzwischen eine höhere
  // Klasse trägt: dann hat sich ihr Quelltext geändert und sie wirkt anders als beim letzten Lauf.
  const neu = vertrag.stufen.filter((s) => !imStand.has(s.stufe));
  const umgestuft = vertrag.stufen.filter(
    (s) => imStand.get(s.stufe) !== undefined && imStand.get(s.stufe) !== s.risiko,
  );
  const nichtUmkehrbar = [...neu, ...umgestuft]
    .filter((s) => s.risiko === "IRREVERSIBEL")
    .map((s) => s.stufe);

  if (nichtUmkehrbar.length > 0 && !nichtUmkehrbarErlaubt) {
    return {
      code: VERTRAG_NICHT_UMKEHRBAR,
      urteil: "NICHT_UMKEHRBAR",
      meldung: `Nicht umkehrbare Migration: ${nichtUmkehrbar.join(", ")} läuft beim Start und nimmt Daten weg oder schreibt sie um. Nach dem Umschalten trägt der Rückfall nur noch mit der Sicherung. Zustimmung mit --nicht-umkehrbar-einspielen.`,
    };
  }
  const zusatz = nichtUmkehrbar.length > 0 ? ` (davon nicht umkehrbar: ${nichtUmkehrbar.join(", ")}, ausdrücklich zugestimmt)` : "";
  const herkunft = uebernommen
    ? " — gerechnet gegen einen ausdrücklich übernommenen, unbekannten Vorstand"
    : "";
  return {
    code: VERTRAG_OK,
    urteil: uebernommen ? "UEBERNOMMEN" : "OK",
    meldung: `Vertrag trägt: ${neu.length} neue Stufe(n)${neu.length > 0 ? ` — ${neu.map((s) => s.stufe).join(", ")}` : ""}${zusatz}${herkunft}.`,
  };
}

/**
 * DIE APP-VERSION EINES RELEASE-VERZEICHNISSES — die, die `/health` melden wird.
 *
 * DER FEHLER AUS RUNDE 1 (Ben, Gegenprobe BEN3): Fehlte der Vertrag, nahm der Rückfall den
 * VERZEICHNISNAMEN als erwartete Version. Eine Altinstallation antwortete daraufhin sauber mit
 * `1.0.0`, und der Rückfall meldete „gescheitert" — ein falscher Alarm auf genau dem Weg, dem man
 * im Ernstfall glauben muss.
 *
 * ZWEI QUELLEN, in dieser Reihenfolge, und keine dritte:
 *   1. `SCHEMA-VERTRAG` (`app_version`) — geschrieben beim Bauen.
 *   2. `package.json` (`version`) — DIESELBE Datei, aus der `/health` liest
 *      (`services/app/src/build-app.ts:buildVersion`). Jedes Release trägt sie, auch jede
 *      Altinstallation.
 * Trägt keine von beiden, ist die Antwort LEER. Ein Verzeichnisname ist keine Version, und eine
 * geratene wäre schlimmer als eine fehlende.
 *
 * Gelesen wird hier bewusst schmal (eine Zeile, ein Feld) und nicht über `leseVertrag`: die Frage
 * „welche Version läuft gleich" muss auch dann beantwortbar sein, wenn am Vertrag etwas ANDERES
 * nicht stimmt.
 */
export function appVersionAusRelease(verzeichnis) {
  const vertrag = resolve(verzeichnis, "SCHEMA-VERTRAG");
  if (existsSync(vertrag)) {
    const wert = /^app_version=(.*)$/m.exec(readFileSync(vertrag, "utf8"))?.[1]?.trim();
    if (wert !== undefined && wert !== "") {
      return wert;
    }
  }
  const paket = resolve(verzeichnis, "package.json");
  if (existsSync(paket)) {
    try {
      const gelesen = JSON.parse(readFileSync(paket, "utf8"));
      if (typeof gelesen.version === "string" && gelesen.version.trim() !== "") {
        return gelesen.version.trim();
      }
    } catch {
      // Eine kaputte package.json ist keine Version. Sie wird nicht repariert und nicht geraten.
    }
  }
  return "";
}

// ------------------------------------------------------------------------------------------------
// Der Aufruf von der Kommandozeile. `update-einspielen.sh` und `build-current-release.mjs` sind die
// Aufrufer; beim Import aus einem Test läuft hier nichts.
// ------------------------------------------------------------------------------------------------

function wurzelDesBaums() {
  return resolve(fileURLToPath(import.meta.url), "..", "..", "..");
}

/** Erhebt die Stufen aus dem Quelltext des Baums, in dem diese Datei liegt. */
export function stufenAusBaum(wurzel = wurzelDesBaums()) {
  const quelle = resolve(wurzel, "services/app/src/migrationsbeleg.ts");
  if (!existsSync(quelle)) {
    throw new Error(`Migrationsbeleg nicht gefunden: ${quelle}`);
  }
  return stufenAusQuelle(readFileSync(quelle, "utf8"));
}

function argwert(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function hauptlauf(argv) {
  const befehl = argv[0];
  if (befehl === "erzeugen") {
    const ziel = argv[1];
    if (ziel === undefined) {
      process.stderr.write("[vertrag] Nutzung: schema-vertrag.mjs erzeugen <ziel> [--release n]\n");
      return VERTRAG_AUFRUF;
    }
    const wurzel = wurzelDesBaums();
    const stufen = stufenAusBaum(wurzel);
    const paket = JSON.parse(readFileSync(resolve(wurzel, "package.json"), "utf8"));
    writeFileSync(
      ziel,
      vertragstext({
        release: argwert(argv, "--release") ?? "unbekannt",
        appVersion: typeof paket.version === "string" ? paket.version : "unbekannt",
        commit: argwert(argv, "--commit") ?? "unbekannt",
        stufen,
      }),
    );
    process.stdout.write(`[vertrag] geschrieben: ${ziel} (${stufen.length} Stufen)\n`);
    return VERTRAG_OK;
  }

  if (befehl === "stand-schreiben") {
    const [, quelle, ziel] = argv;
    if (quelle === undefined || ziel === undefined) {
      process.stderr.write(
        "[vertrag] Nutzung: schema-vertrag.mjs stand-schreiben <vertrag> <ziel> --bestaetigt ja|nein\n",
      );
      return VERTRAG_AUFRUF;
    }
    const bestaetigt = argwert(argv, "--bestaetigt");
    if (bestaetigt !== "ja" && bestaetigt !== "nein") {
      process.stderr.write("[vertrag] --bestaetigt muss ja oder nein sein.\n");
      return VERTRAG_AUFRUF;
    }
    let gelesen;
    try {
      gelesen = leseVertrag(readFileSync(quelle, "utf8"), quelle);
    } catch (fehler) {
      process.stderr.write(`[vertrag] ${fehler.message}\n`);
      return VERTRAG_UNLESBAR;
    }
    writeFileSync(ziel, vertragstext({ ...gelesen, bestaetigt }));
    process.stdout.write(`[vertrag] Stand fortgeschrieben: ${ziel} (bestaetigt=${bestaetigt})\n`);
    return VERTRAG_OK;
  }

  if (befehl === "pruefen") {
    const [, standPfad, vertragPfad] = argv;
    if (standPfad === undefined || vertragPfad === undefined) {
      process.stderr.write("[vertrag] Nutzung: schema-vertrag.mjs pruefen <stand> <vertrag>\n");
      return VERTRAG_AUFRUF;
    }
    let vertrag;
    let stand = null;
    try {
      vertrag = leseVertrag(readFileSync(vertragPfad, "utf8"), vertragPfad);
      if (existsSync(standPfad)) {
        stand = leseVertrag(readFileSync(standPfad, "utf8"), standPfad);
      }
    } catch (fehler) {
      process.stderr.write(`[vertrag] ${fehler.message}\n`);
      return VERTRAG_UNLESBAR;
    }
    const urteil = pruefeVertrag(stand, vertrag, {
      nichtUmkehrbarErlaubt: argv.includes("--nicht-umkehrbar-einspielen"),
      datenVorhanden: argv.includes("--daten-vorhanden"),
      unbekanntUebernehmen: argv.includes("--unbekannten-stand-uebernehmen"),
    });
    const strom = urteil.code === VERTRAG_OK ? process.stdout : process.stderr;
    strom.write(`[vertrag] ${urteil.urteil}: ${urteil.meldung}\n`);
    return urteil.code;
  }

  // Die App-Version eines Release-Verzeichnisses, für `rueckfall.sh` und `update-einspielen.sh`.
  // Leere Ausgabe und ein Code ungleich 0 heissen: nicht belegbar — nicht „irgendetwas".
  if (befehl === "app-version") {
    const verzeichnis = argv[1];
    if (verzeichnis === undefined) {
      process.stderr.write("[vertrag] Nutzung: schema-vertrag.mjs app-version <release>\n");
      return VERTRAG_AUFRUF;
    }
    const version = appVersionAusRelease(verzeichnis);
    if (version === "") {
      process.stderr.write(
        `[vertrag] ${verzeichnis}: App-Version nicht belegbar (weder SCHEMA-VERTRAG noch package.json).\n`,
      );
      return VERTRAG_UNLESBAR;
    }
    process.stdout.write(version);
    return VERTRAG_OK;
  }

  process.stderr.write(`[vertrag] Unbekannter Befehl: ${befehl ?? "(keiner)"}\n`);
  return VERTRAG_AUFRUF;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = hauptlauf(process.argv.slice(2));
  } catch (fehler) {
    process.stderr.write(`[vertrag] ${fehler instanceof Error ? fehler.message : fehler}\n`);
    process.exitCode = VERTRAG_UNLESBAR;
  }
}
