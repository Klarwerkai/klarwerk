#!/usr/bin/env node
// ================================================================================================
// tools/check-cwd-contract.mjs — DER CWD-WÄCHTER (JOB 943, BEN D1 Korrekturpflichten 1–3)
// ================================================================================================
//
// DER BEFUND (Register I14): „Kein Kopf-Befehl ohne cd." Ein ausführender Weg, der ein relatives
// Verzeichnis annimmt und im falschen Ordner startet, arbeitet still am falschen Bestand.
//
// WARUM DIESER WÄCHTER NICHT NACH `cd` SUCHT — das ist der ganze Punkt, und D1 ist genau daran
// gescheitert (BEN Korrekturpflicht 2):
//
//   Das bloße FEHLEN von `cd` ist KEIN Mangel. `tools/seed-sim-corpus` arbeitet ausschließlich
//   gegen `KLARWERK_BACKEND_URL`, `scripts/deploy/klarwerk-live-update.command` gegen feste URLs
//   und Systemwerkzeuge. Beide haben kein `cd` — und beide sind völlig in Ordnung. Ein Wächter,
//   der Namen oder Abwesenheiten zählt, meldet sie fälschlich und wird deshalb abgeschaltet.
//
// DIE REGEL, SEMANTISCH:
//
//   Ein Weg ist cwd-ABHÄNGIG, wenn er eine KONKRETE RELATIVE PFADOPERATION ausführt —
//   `./x`, `../x`, `source x`, eine Umleitung auf einen relativen Pfad. Nur dann braucht er eine
//   Verankerung. Führt er keine aus, ist er cwd-UNABHÄNGIG, ganz gleich wie er geschrieben ist.
//
// DIE DREI ZULÄSSIGEN ZUSTÄNDE, und die Bilanz muss aufgehen (BEN Korrekturpflicht 1):
//
//   verankert     — hat eine relative Operation UND verankert sich vorher
//   unabhaengig   — hat keine relative Operation
//   ausgenommen   — trägt die maschinenlesbare Ausnahme MIT Begründung
//
// FAIL-CLOSED AN JEDER STELLE: eine Wurzel ohne beide Marker, ein unlesbares Verzeichnis, ein
// unbekannter Zustand — nichts davon endet grün. Ein Wächter, der im Zweifel schweigt, ist keiner.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ------------------------------------------------------------------------------------------------
// DIE WURZELMARKER. Beide sind Pflicht — `package.json` allein trägt nicht, weil jedes
// Unterprojekt eine hat; `.git` allein trägt nicht, weil auch ein fremdes Repository eines hat.
// Erst beide zusammen sagen „das ist DIESE Arbeitswurzel".
// ------------------------------------------------------------------------------------------------
const WURZELMARKER = ["package.json", ".git"];

/** Die Verzeichnisse, in denen ausführende Wege wohnen. */
const FLAECHEN = ["tools", "scripts"];

// ------------------------------------------------------------------------------------------------
// WAS ÜBERHAUPT EIN AUSFÜHRENDER WEG IST. Eine Anleitung führt nichts aus: `scripts/backup/RESTORE.md`
// nennt `./scripts/backup/backup.sh` in Prosa und ist trotzdem kein Weg. Der erste Entwurf dieses
// Wächters hat sie gemeldet — ein Fehlbefund der Erhebung, nicht des Bestands.
// ------------------------------------------------------------------------------------------------
const AUSFUEHRENDE_ENDUNGEN = new Set([
  "",
  ".sh",
  ".command",
  ".mjs",
  ".js",
  ".ts",
  ".applescript",
]);

function fuehrtAus(pfad) {
  const name = pfad.slice(pfad.lastIndexOf("/") + 1);
  const punkt = name.lastIndexOf(".");
  return AUSFUEHRENDE_ENDUNGEN.has(punkt <= 0 ? "" : name.slice(punkt));
}

/** Die maschinenlesbare Ausnahme. Die Begründung dahinter ist Pflicht — sonst ist sie ein Freibrief. */
// `[^\S\n]` statt `\s`: `\s` schliesst den Zeilenumbruch ein — eine begruendungslose Ausnahme
// haette sich sonst die naechste Zeile als Begruendung geholt. Der eigene Fall `C2` hat es gefunden.
const AUSNAHME = /^[^\S\n]*(?:#|\/\/)[^\S\n]*cwd-unabhaengig:[^\S\n]*(\S.*)$/m;

// ------------------------------------------------------------------------------------------------
// DIE ERKENNUNG. Jedes Muster steht für eine KONKRETE Operation, nicht für ein Stichwort.
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// WAS EINE CWD-OPERATION IST — und was nur so aussieht. Das ist die semantische Mitte des Wächters
// (BEN Korrekturpflicht 2), und der erste Entwurf lag hier dreimal daneben:
//
//   · `import … from "../services/audit/src/chain"` — der Modullader löst das gegen die DATEI auf,
//     nicht gegen das Arbeitsverzeichnis. Keine cwd-Operation.
//   · `"  → ./tools/build   (oder: …)"` — ein Hinweistext, der GEDRUCKT wird. Keine Ausführung.
//   · `#   DATABASE_URL=… ./scripts/backup/backup.sh` — ein Kommentar. Keine Ausführung.
//
// Deshalb: Kommentare fallen weg, Modulangaben fallen weg, und in JS/TS zählt ein relativer Pfad
// nur, wenn er an eine AUSFÜHRUNG oder einen DATEIZUGRIFF geht.
// ------------------------------------------------------------------------------------------------

/** Node-Aufrufe, bei denen ein relativer Pfad wirklich gegen das Arbeitsverzeichnis aufgelöst wird. */
const NODE_SENKEN =
  /\b(?:execFileSync|execFile|execSync|exec|spawnSync|spawn|readFileSync|readFile|writeFileSync|writeFile|appendFileSync|existsSync|statSync|readdirSync|mkdirSync|rmSync|copyFileSync|createReadStream|createWriteStream)\s*\(\s*[^)]*?["'`]\.\.?\//;

/**
 * Shell: JEDE Erwähnung von `./` oder `../` im CODE ist eine Pfadangabe gegen das
 * Arbeitsverzeichnis — Kommentare sind vorher entfernt, also bleibt nur Ausführbares übrig.
 * Bewusst breit: `DEST="${1:-${BACKUP_DIR:-./backups}}"` ist keine Ausführung, aber sehr wohl
 * eine cwd-Operation — das Sicherungsziel hängt am Startverzeichnis. Ein Muster, das nur
 * Befehlspositionen kennt, hätte genau diesen Fall verloren.
 */
const SHELL_OPERATION = [
  /\.\.?\//m, //  ./x  bzw.  ../x, an jeder Stelle im Code
  /^\s*(?:source|\.)\s+[^/\s"'][^\s"']*/m, //  source datei  (ohne führenden Slash)
];

/**
 * Ein `../` HINTER einer Variablen oder einem absoluten Pfad ist bereits verankert:
 * `"$REPO/../KLARWERK-Insel/App-bauen.command"` löst gegen `$REPO` auf, nicht gegen das
 * Arbeitsverzeichnis. Diese Fälle werden vor der Prüfung entfernt — sonst meldet der Wächter
 * genau die Sorgfalt, die er verlangt.
 */
function ohneVerankerteRelativpfade(inhalt) {
  return inhalt.replace(/(?:\$\{?\w+\}?|\/[\w.-]+)\/\.\.?\//g, "/");
}

/** Entfernt Zeilenkommentare, damit eine Erwähnung nicht als Operation zählt. */
function ohneKommentare(inhalt, istNode) {
  return inhalt
    .split("\n")
    .map((z) => (istNode ? z.replace(/\/\/.*$/, "") : z.replace(/(^|\s)#.*$/, "$1")))
    .join("\n");
}

/** Entfernt Modulangaben — sie werden dateirelativ aufgelöst, nie gegen das Arbeitsverzeichnis. */
function ohneModulangaben(inhalt) {
  return inhalt
    .replace(/^\s*(?:import|export)\s[^;\n]*?from\s*["'][^"']*["']/gm, "")
    .replace(/^\s*import\s*["'][^"']*["']/gm, "")
    .replace(/\brequire\s*\(\s*["'][^"']*["']\s*\)/g, "");
}

/** Verankerung: der Weg stellt seine Wurzel her, BEVOR er relativ arbeitet. */
const VERANKERUNG = [
  /cd\s+"?\$\(\s*dirname\s+"?\$\{?(?:0|BASH_SOURCE\[0\])\}?"?\s*\)"?/, // cd "$(dirname "$0")…"
  /cd\s+"?\$\(\s*git\s+rev-parse\s+--show-toplevel\s*\)"?/, //           cd "$(git rev-parse …)"
  /process\.chdir\s*\(/, //                                              Node: chdir
  /fileURLToPath\s*\(\s*import\.meta\.url/, //                           Node: Pfad aus dem Modul
  /__dirname/, //                                                        Node: Pfad aus dem Modul
];

/**
 * Prüft eine Wurzel gegen die Marker. Fail-closed: fehlt einer, ist es NICHT die Wurzel.
 * Gibt erwartete und gefundene Lage sichtbar aus (BEN Korrekturpflicht 3).
 */
function wurzelPruefen(wurzel) {
  if (!existsSync(wurzel) || !statSync(wurzel).isDirectory()) {
    return { ok: false, grund: "Verzeichnis existiert nicht oder ist keines" };
  }
  const fehlend = WURZELMARKER.filter((m) => !existsSync(join(wurzel, m)));
  if (fehlend.length > 0) {
    return { ok: false, grund: `Wurzelmarker fehlen: ${fehlend.join(", ")}` };
  }
  return { ok: true };
}

/** Alle Dateien der Flächen, rekursiv. Nicht lesbare Flächen sind ein Abbruch, kein Überspringen. */
function wegeSammeln(wurzel) {
  const wege = [];
  for (const flaeche of FLAECHEN) {
    const start = join(wurzel, flaeche);
    if (!existsSync(start)) {
      continue; // eine Fläche darf fehlen; eine VORHANDENE, unlesbare nicht (s. catch unten)
    }
    const stapel = [start];
    while (stapel.length > 0) {
      const ort = stapel.pop();
      for (const eintrag of readdirSync(ort, { withFileTypes: true })) {
        const voll = join(ort, eintrag.name);
        if (eintrag.isDirectory()) {
          stapel.push(voll);
        } else if (eintrag.isFile() && fuehrtAus(voll)) {
          wege.push(voll);
        }
      }
    }
  }
  return wege.sort();
}

/** Die Einstufung eines einzelnen Weges. Genau ein Urteil je Weg. */
function einstufen(pfad, roh) {
  const ausnahme = AUSNAHME.exec(roh);
  if (ausnahme) {
    return { klasse: "ausgenommen", grund: ausnahme[1].trim() };
  }
  const istNode = /\.(?:mjs|js|ts)$/.test(pfad);
  const inhalt = istNode
    ? ohneModulangaben(ohneKommentare(roh, true))
    : ohneVerankerteRelativpfade(ohneKommentare(roh, false));
  const relativ = istNode ? NODE_SENKEN.test(inhalt) : SHELL_OPERATION.some((m) => m.test(inhalt));
  if (!relativ) {
    return { klasse: "unabhaengig" };
  }
  return VERANKERUNG.some((m) => m.test(roh)) ? { klasse: "verankert" } : { klasse: "unverankert" };
}

// ------------------------------------------------------------------------------------------------
// Lauf
// ------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const wurzel = argv.includes("--wurzel") ? argv[argv.indexOf("--wurzel") + 1] : process.cwd();
const erklaere = argv.includes("--erklaere");

const pruefung = wurzelPruefen(wurzel);
if (!pruefung.ok) {
  console.error("✖ cwd-Vertrag: die Wurzel trägt den Vertrag nicht.");
  console.error(`  erwartet  : ein Verzeichnis mit ${WURZELMARKER.join(" UND ")}`);
  console.error(`  gefunden  : ${wurzel}`);
  console.error(`  Grund     : ${pruefung.grund}`);
  process.exit(2);
}

let wege;
try {
  wege = wegeSammeln(wurzel);
} catch (err) {
  console.error("✖ cwd-Vertrag: eine Fläche ist nicht lesbar — fail-closed.");
  console.error(`  erwartet  : lesbare Verzeichnisse ${FLAECHEN.join(", ")}`);
  console.error(`  gefunden  : ${String(err)}`);
  process.exit(2);
}

const bilanz = { verankert: 0, unabhaengig: 0, ausgenommen: 0 };
const befunde = [];
for (const weg of wege) {
  let inhalt;
  try {
    inhalt = readFileSync(weg, "utf8");
  } catch {
    continue; // Binärdatei o. ä. — sie führt keine Befehle aus
  }
  const urteil = einstufen(weg, inhalt);
  const kurz = relative(wurzel, weg);
  if (urteil.klasse === "unverankert") {
    befunde.push(kurz);
    continue;
  }
  bilanz[urteil.klasse] += 1;
  if (erklaere) {
    console.log(`  ${kurz} · ${urteil.klasse}${urteil.grund ? ` — ${urteil.grund}` : ""}`);
  }
}

const geprueft = bilanz.verankert + bilanz.unabhaengig + bilanz.ausgenommen + befunde.length;
console.log(
  `cwd-Vertrag: geprueft ${geprueft} · verankert ${bilanz.verankert} · ` +
    `unabhaengig ${bilanz.unabhaengig} · ausgenommen ${bilanz.ausgenommen} · ` +
    `unverankert ${befunde.length}`,
);
console.log(`  Wurzel: ${wurzel}`);

if (befunde.length > 0) {
  console.error("✖ cwd-Vertrag: unverankerte relative Ausführung.");
  for (const b of befunde) {
    console.error(`  · ${b}`);
  }
  console.error('  Abhilfe: entweder verankern (cd "$(dirname "$0")/..") oder, wenn der Weg');
  console.error("  wirklich keine relative Pfadoperation braucht, die Ausnahme MIT Begründung");
  console.error("  setzen: # cwd-unabhaengig: <warum>");
  process.exit(1);
}

console.log("✓ cwd-Vertrag grün");
