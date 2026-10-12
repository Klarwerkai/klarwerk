// ================================================================================================
// DER GEHEIMNIS-SCAN — ZUGANGSDATEN GELANGEN NICHT UNBEMERKT IN DEN QUELLCODE (R-1420 / F-1420).
// ================================================================================================
//
// HERKUNFT: `docs/operations/secrets-management.md` §10 empfahl seit dem 28.06. einen Prüfschritt
// „vor der Uebernahme oder im automatischen Lauf" und hielt fest, dass er in jenem Ticket NICHT
// installiert war. Dieses Modul ist dieser Prüfschritt. Er steht in `tools/check` (Zeile mit
// `geheimnis-scan`) und läuft damit überall, wo das Gesamttor läuft — lokal von Hand und im
// `check`-Job von `.github/workflows/ci.yml`, der `./tools/check` als einen Schritt fährt.
//
// WAS GELESEN WIRD: jede Datei, die übernommen werden KANN — `git ls-files --cached --others
// --exclude-standard`, also versionierte UND neue, nicht ignorierte Dateien. Eine frisch angelegte
// Datei mit einem Schlüssel wird damit rot, BEVOR sie committet ist. Ignoriertes (`.gitignore`)
// liegt ausserhalb: es kann nicht versehentlich übernommen werden.
//
// WAS ALS FUND ZÄHLT — bewusst eng: nur Formate, die praktisch nur echte Zugangsdaten haben
// (Anbieter-Präfixe, private Schlüssel) und Dateien, die ihrer Art nach Geheimnisse tragen
// (`.env`, Schlüsseldateien). Eine allgemeine Regel „passwort = '…'" wurde am Bestand gemessen
// (08.10.) und verworfen: sie trifft Dutzende bewusst gesetzter Testkennwörter
// (`tests/**`, `services/**/*.test.ts`). Ein Tor, das bei jeder Attrappe rot wird, wird
// abgeschaltet — dann meldet gar nichts mehr (dieselbe Lehre wie `tools/zentrale-drift.ts`).
//
// WAS ER NICHT KANN — die Grenze gehört an dieselbe Stelle wie die Zusage: ein Geheimnis ohne
// erkennbares Format (frei gewähltes Kennwort, Hex-Token ohne Präfix) erkennt er nicht. Dafür
// bleiben PR-Review und `.env.example` mit Platzhaltern (secrets-management.md §10).
//
// ER GIBT KEIN GEHEIMNIS AUS: ein Fund nennt Datei, Zeile, Regel und einen maskierten Auszug.
// Der Wert selbst landet weder im Terminal noch im CI-Protokoll.
//
// KEINE LAUFZEITABHÄNGIGKEIT, KEIN NETZ, KEINE INSTALLATION: nur `node:`-Module und `git`.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, sep } from "node:path";

/** Eine bewusste Attrappe (Testfall, Beispiel) wird mit dieser Marke IN DERSELBEN ZEILE erlaubt. */
export const ERLAUBT_MARKE = "geheimnis-scan: erlaubt";

// KEINE GRÖSSENGRENZE (Nacharbeit 1, Bens Befund): bis hierher wurden Dateien über 5 MB nur
// benannt und nicht gelesen — ein Schlüssel in einer grossen JSON-Datei kam damit bei Exit 0
// durch. Jede Textdatei wird jetzt vollständig gelesen, gleich wie gross.

export interface InhaltsRegel {
  kennung: string;
  beschreibung: string;
  muster: RegExp;
}

// Jedes Muster trägt das Flag `g` (für `matchAll`). Die Quelltexte der Muster treffen sich selbst
// nicht — hinter jedem Präfix steht im Quelltext eine Klammer, die keine Zeichenklasse zulässt.
export const INHALTSREGELN: readonly InhaltsRegel[] = [
  {
    kennung: "privater-schluessel",
    beschreibung: "privater Schlüssel (PEM/OpenSSH/PGP)",
    muster: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    kennung: "aws-zugangsschluessel",
    beschreibung: "AWS-Zugangsschlüssel",
    muster: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    kennung: "github-token",
    beschreibung: "GitHub-Token",
    muster: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g,
  },
  {
    kennung: "anthropic-schluessel",
    beschreibung: "Anthropic-API-Schlüssel",
    muster: /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  },
  {
    kennung: "openai-schluessel",
    beschreibung: "OpenAI-API-Schlüssel",
    muster: /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,}\b)/g,
  },
  {
    kennung: "slack-token",
    beschreibung: "Slack-Token",
    muster: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  },
  {
    kennung: "google-api-schluessel",
    beschreibung: "Google-API-Schlüssel",
    muster: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    kennung: "stripe-live-schluessel",
    beschreibung: "Stripe-Live-Schlüssel",
    muster: /\b[rs]k_live_[A-Za-z0-9]{16,}/g,
  },
  {
    kennung: "npm-token",
    beschreibung: "npm-Zugangstoken",
    muster: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
];

/** `.env.example` & Co. sind Vorlagen mit Platzhaltern — ihr INHALT wird trotzdem gelesen. */
const VORLAGEN_ENDUNG = /\.(?:example|sample|template|beispiel|vorlage)$/i;
const ENV_NAME = /^\.env(?:\..+)?$|\.env$/;
const SCHLUESSEL_ENDUNG = /\.(?:pem|key|p12|pfx|jks|keystore)$/i;
const SSH_SCHLUESSEL = /^id_(?:rsa|dsa|ecdsa|ed25519)$/;

export function istEnvDatei(name: string): boolean {
  return ENV_NAME.test(name) && !VORLAGEN_ENDUNG.test(name);
}

export function istSchluesselDatei(name: string): boolean {
  return SCHLUESSEL_ENDUNG.test(name) || SSH_SCHLUESSEL.test(name);
}

/**
 * Begründete Ausnahmen für Dateinamen-Funde (etwa ein öffentliches CA-Zertifikat als `.pem`).
 * Heute leer — eine Datei, die hier stehen soll, braucht einen Grund, keinen Sammelschlüssel.
 */
export const DATEI_AUSNAHMEN = new Map<string, string>();

export interface Fund {
  datei: string;
  zeile: number;
  regel: string;
  beschreibung: string;
  /** Maskiert — nie der volle Wert. */
  auszug: string;
}

/** Vier Zeichen und die Länge: genug zum Wiederfinden, zu wenig zum Benutzen. */
export function maskiere(wert: string): string {
  return `${wert.slice(0, 4)}…(${wert.length} Zeichen)`;
}

export function pruefeDateiname(datei: string): Fund[] {
  if (DATEI_AUSNAHMEN.has(datei)) {
    return [];
  }
  const name = basename(datei);
  if (istEnvDatei(name)) {
    return [
      {
        datei,
        zeile: 0,
        regel: "env-datei",
        beschreibung: "Umgebungsdatei — ins Repo gehören nur Vorlagen wie .env.example",
        auszug: name,
      },
    ];
  }
  if (istSchluesselDatei(name)) {
    return [
      {
        datei,
        zeile: 0,
        regel: "schluesseldatei",
        beschreibung: "Schlüssel-/Zertifikatsdatei",
        auszug: name,
      },
    ];
  }
  return [];
}

export function pruefeText(datei: string, text: string): Fund[] {
  const funde: Fund[] = [];
  const zeilen = text.split("\n");
  for (const regel of INHALTSREGELN) {
    for (const treffer of text.matchAll(regel.muster)) {
      const zeile = text.slice(0, treffer.index).split("\n").length;
      if (zeilen[zeile - 1]?.includes(ERLAUBT_MARKE)) {
        continue;
      }
      funde.push({
        datei,
        zeile,
        regel: regel.kennung,
        beschreibung: regel.beschreibung,
        auszug: maskiere(treffer[0]),
      });
    }
  }
  return funde.sort((a, b) => a.zeile - b.zeile);
}

const NIE_DURCHLAUFEN = new Set([
  ".git",
  "node_modules",
  "dist",
  ".local",
  "test-results",
  "playwright-report",
]);

function durchlaufe(wurzel: string, verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(wurzel, verzeichnis), { withFileTypes: true })) {
    if (NIE_DURCHLAUFEN.has(eintrag.name)) {
      continue;
    }
    const relativ = verzeichnis === "" ? eintrag.name : join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...durchlaufe(wurzel, relativ));
    } else if (eintrag.isFile()) {
      gefunden.push(relativ.split(sep).join("/"));
    }
  }
  return gefunden;
}

/**
 * Die Dateien, die übernommen werden können. Im Repo fragt er `git`; ohne `.git` (synthetischer
 * Bestand im Test) durchläuft er das Verzeichnis — das liest mehr, nie weniger.
 */
export function kandidatenDateien(wurzel: string): {
  dateien: string[];
  quelle: "git" | "verzeichnis";
} {
  if (!existsSync(join(wurzel, ".git"))) {
    return { dateien: durchlaufe(wurzel, ""), quelle: "verzeichnis" };
  }
  const ausgabe = execFileSync(
    "git",
    ["-C", wurzel, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const dateien = [...new Set(ausgabe.split("\0").filter((d) => d !== ""))];
  return { dateien, quelle: "git" };
}

export interface Ergebnis {
  funde: Fund[];
  gelesen: number;
  quelle: "git" | "verzeichnis";
}

export function pruefeBestand(wurzel: string = process.cwd()): Ergebnis {
  const { dateien, quelle } = kandidatenDateien(wurzel);
  const funde: Fund[] = [];
  let gelesen = 0;
  for (const datei of dateien) {
    funde.push(...pruefeDateiname(datei));
    const pfad = join(wurzel, datei);
    // Im Arbeitsbaum gelöscht, aber noch im Index — oder zwischen Liste und Lesen verschwunden
    // (eine flüchtige Datei eines parallelen Laufs): kein Inhalt, den man übernehmen könnte.
    // Ein Symlink ist ein Verweis, kein Inhalt — sein Ziel liest der Scan dort, wo es liegt.
    let inhalt: Buffer;
    try {
      const art = lstatSync(pfad);
      if (!art.isFile()) {
        continue;
      }
      inhalt = readFileSync(pfad);
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw fehler;
    }
    // Binärdateien (Bilder, DOCX, PDF) tragen ein Nullbyte; ihr Inhalt ist kein Quelltext.
    if (inhalt.subarray(0, 8000).includes(0)) {
      continue;
    }
    gelesen += 1;
    funde.push(...pruefeText(datei, inhalt.toString("utf8")));
  }
  return { funde, gelesen, quelle };
}

// ================================================================================================
// DER AUFRUFER — `tools/geheimnis-scan.sh`, gerufen von `tools/check`.
// ================================================================================================
//
// EXITCODES: 0 = kein Fund · 1 = Fund (Datei:Zeile, maskiert) · 2 = nichts gelesen (fail-closed:
// ein Scan über null Dateien ist kein grüner Scan). Optionales Argument $1 = Wurzel (nur Test).
if (process.argv[1]?.endsWith("geheimnis-scan.ts")) {
  const wurzel = process.argv[2] ?? process.cwd();
  const { funde, gelesen, quelle } = pruefeBestand(wurzel);
  if (gelesen === 0) {
    console.error(`✖ Geheimnis-Scan: keine Datei gelesen (${quelle}) — nichts geprüft`);
    process.exit(2);
  }
  if (funde.length > 0) {
    console.error(`✖ Geheimnis-Scan: ${funde.length} Fund(e) in ${gelesen} gelesenen Dateien:`);
    for (const f of funde) {
      const ort = f.zeile > 0 ? `${f.datei}:${f.zeile}` : f.datei;
      console.error(`   ${ort} — ${f.beschreibung} [${f.regel}] ${f.auszug}`);
    }
    console.error("   Zugangsdaten gehören in die Umgebung bzw. den Secret-Store, nicht ins Repo");
    console.error("   (docs/operations/secrets-management.md). Eine bewusste Attrappe trägt in");
    console.error(`   derselben Zeile die Marke „${ERLAUBT_MARKE}" mit Grund.`);
    process.exit(1);
  }
  console.log(`✓ Geheimnis-Scan: ${gelesen} Dateien gelesen (${quelle}), kein Fund`);
}
