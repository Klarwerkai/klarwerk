// ================================================================================================
// R-1398 — VOR DER AUSLIEFERUNG: HABEN DIE EINGEBUNDENEN FREMDBIBLIOTHEKEN BEKANNTE SCHWACHSTELLEN?
// ================================================================================================
//
// WAS ES BIS HIERHER GAB, UND WARUM DAS NICHT REICHTE. `tests/produktionsabhaengigkeiten/`
// (JOB 4272) hält die am 17.09.2026 gemeldeten Advisories gegen die Lockdatei: ändert sich eine
// gebundene Version, wird ein Test rot und verlangt die Einordnung neu. Das fängt eine
// VERSIONSÄNDERUNG. Es fängt NICHT die zweite, häufigere Klasse: eine NEU veröffentlichte Advisory
// gegen eine
// unveränderte Version. Dafür muss jemand die Advisory-Datenbank fragen — und bis hierher fragte
// sie kein Schritt vor der Auslieferung.
//
// WARUM NICHT IN `tools/check`. Das Tor ist bewusst hermetisch (kein Modell, kein Schlüssel, kein
// Egress — `tools/check`, Abschnitt zum UI-Smoke). `npm audit` braucht die Registry. Im Tor wäre
// die Prüfung entweder netzabhängig rot oder still übersprungen — beides falsch. Der Weg, der
// ohnehin ins Netz geht und unmittelbar vor der Auslieferung steht, ist
// `scripts/deploy/klarwerk-ship.command`; dort ruft der Starter `tools/abhaengigkeiten-audit.sh`
// diese Prüfung, BEVOR irgendetwas hochgezählt, committet, gepusht oder deployt wird.
//
// ZWEI BESTÄNDE, weil zwei ausgeliefert werden (Dockerfile):
//   wurzel  `package-lock.json`          — `npm ci --omit=dev` im Laufzeit-Image (Dockerfile:34)
//   web     `apps/web/package-lock.json` — in `apps/web/dist` gebündelt (Dockerfile:13, :38)
// Je Bestand `npm audit --omit=dev --json`: Werkzeugkette und Testbibliotheken liegen nicht im
// ausgelieferten Stand.
//
// EIN GRÜNER SCANNER IST NICHT DAS ZIEL. Gemeldet bleiben darf, was BEWERTET ist — mit konkreter
// Exposition, an genau der Version, an der bewertet wurde
// (`tests/abhaengigkeiten-vor-auslieferung/bewertete-meldungen.json`; die Urteile dort hält ein
// Test gleich mit dem Expositionsbericht `tests/produktionsabhaengigkeiten/README.md`). Die
// Prüfung sperrt, wenn
//   · eine Meldung keine Bewertung hat (neu veröffentlicht, neues Paket, neuer Ort), oder
//   · die Bewertung an einer anderen Version hängt als der heute gebundenen (veraltet).
// Eine Bewertung „exponiert" sperrt nicht, sie wird bei JEDEM Lauf laut ausgegeben: sie ist eine
// bewusst offene, vorgelegte Entscheidung (z. B. `nodemailer`, Hauptwechsel 6 → 9), kein Freibrief.
//
// RÜCKGABEWERTE:
//   0 = jede Meldung bewertet, an der gebundenen Version
//   1 = unbewertete oder veraltete Meldung, oder das Register selbst ist ungültig
//   2 = nicht geprüft (Registry nicht erreichbar, npm-Fehler, unbekanntes Berichtsformat)
// Der Ship-Weg bricht bei 1 UND 2 ab: „nicht geprüft" ist nicht lieferbar.
//
// RUNNER: `node`, nicht `tsx`/`npx` — wie `tools/zentrale-drift.sh` (Type-Stripping, kein
// Nachladen aus dem Netz).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WURZEL = join(import.meta.dirname, "..");

export const REGISTER_DATEI = "tests/abhaengigkeiten-vor-auslieferung/bewertete-meldungen.json";

export const BESTAENDE = {
  wurzel: { verzeichnis: ".", lockdatei: "package-lock.json" },
  web: { verzeichnis: "apps/web", lockdatei: "apps/web/package-lock.json" },
} as const;

export type Bestand = keyof typeof BESTAENDE;

export const BESTANDSNAMEN = Object.keys(BESTAENDE) as Bestand[];

export const URTEILE: readonly string[] = ["nicht exponiert", "exponiert"];

/** Eine gemeldete Advisory an genau einem Ort der Lockdatei. */
export interface Meldung {
  readonly kennung: string;
  readonly paket: string;
  readonly schwere: string;
  readonly titel: string;
  readonly bereich: string;
  readonly ort: string;
}

/** Ein Eintrag des Registers — die Bewertung EINER Advisory an EINEM Ort in EINER Version. */
export interface Bewertung {
  readonly bestand: Bestand;
  readonly kennung: string;
  readonly paket: string;
  readonly ort: string;
  readonly version: string;
  readonly urteil: string;
  readonly begruendung: string;
  readonly beleg: string;
  readonly bewertet_am: string;
}

export interface Fund extends Meldung {
  readonly bestand: Bestand;
  /** Die heute gebundene Version an `ort`; `null`, wenn der Ort in der Lockdatei fehlt. */
  readonly version: string | null;
  readonly zustand: "bewertet" | "unbewertet" | "veraltet";
  readonly bewertung: Bewertung | null;
}

export interface Lockdatei {
  readonly packages?: Readonly<Record<string, { readonly version?: string }>>;
}

export type Bericht =
  | { readonly art: "gelesen"; readonly meldungen: readonly Meldung[] }
  | { readonly art: "fehler"; readonly grund: string };

const GHSA = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;

interface ViaObjekt {
  readonly source?: number;
  readonly name?: string;
  readonly title?: string;
  readonly url?: string;
  readonly severity?: string;
  readonly range?: string;
}

interface AuditEintrag {
  readonly name?: string;
  readonly nodes?: readonly string[];
  readonly via?: readonly unknown[];
}

interface AuditRoh {
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly auditReportVersion?: number;
  readonly vulnerabilities?: Readonly<Record<string, AuditEintrag>>;
}

function kennungVon(via: ViaObjekt): string {
  const ghsa = GHSA.exec(via.url ?? "")?.[0];
  if (ghsa) {
    return ghsa;
  }
  return via.source !== undefined ? `npm-${via.source}` : `ohne-kennung:${via.title ?? "?"}`;
}

/**
 * Liest die Ausgabe von `npm audit --json` (Format `auditReportVersion: 2`).
 *
 * Nur OBJEKT-Einträge in `via` sind Advisories. Ein Zeichenketten-Eintrag nennt bloss ein anderes
 * verwundbares Paket, über das dieses mitgemeldet wird (z. B. `fastify` über `find-my-way`) —
 * die eigentliche Meldung steht beim genannten Paket selbst und wird dort gezählt.
 */
export function liesAuditBericht(text: string): Bericht {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    const anfang = text.trim().slice(0, 200) || "(leer)";
    return { art: "fehler", grund: `keine JSON-Ausgabe von npm audit: ${anfang}` };
  }
  if (typeof roh !== "object" || roh === null) {
    return { art: "fehler", grund: "Ausgabe von npm audit ist kein Objekt" };
  }
  const bericht = roh as AuditRoh;
  if (bericht.error) {
    const code = bericht.error.code ?? "unbekannt";
    return { art: "fehler", grund: `npm audit meldet ${code}: ${bericht.error.summary ?? ""}` };
  }
  if (bericht.auditReportVersion !== 2 || typeof bericht.vulnerabilities !== "object") {
    const version = String(bericht.auditReportVersion);
    return { art: "fehler", grund: `unbekanntes Format (auditReportVersion ${version})` };
  }
  const meldungen: Meldung[] = [];
  const gesehen = new Set<string>();
  for (const [schluessel, eintrag] of Object.entries(bericht.vulnerabilities)) {
    for (const via of eintrag.via ?? []) {
      if (typeof via !== "object" || via === null) {
        continue;
      }
      const v = via as ViaObjekt;
      const kennung = kennungVon(v);
      const paket = v.name ?? eintrag.name ?? schluessel;
      for (const ort of eintrag.nodes ?? []) {
        const fundSchluessel = `${kennung}|${paket}|${ort}`;
        if (gesehen.has(fundSchluessel)) {
          continue;
        }
        gesehen.add(fundSchluessel);
        meldungen.push({
          kennung,
          paket,
          schwere: v.severity ?? "unbekannt",
          titel: v.title ?? "",
          bereich: v.range ?? "",
          ort,
        });
      }
    }
  }
  return { art: "gelesen", meldungen };
}

/** Formfehler des Registers. Eine Bewertung ohne Begründung oder Beleg ist ein Freibrief. */
export function registerFehler(register: readonly Bewertung[]): string[] {
  const fehler: string[] = [];
  const gesehen = new Set<string>();
  for (const [i, b] of register.entries()) {
    const wo = `Eintrag ${i + 1} (${b.kennung} ${b.paket})`;
    const pruefungen: ReadonlyArray<readonly [boolean, string]> = [
      [b.bestand in BESTAENDE, `unbekannter Bestand „${b.bestand}"`],
      [GHSA.test(b.kennung) || /^npm-\d+$/.test(b.kennung), "Kennung ist weder GHSA noch npm"],
      [String(b.ort).startsWith("node_modules/"), "Ort liegt nicht in der Lockdatei"],
      [Boolean(b.version), "ohne bewertete Version"],
      [URTEILE.includes(b.urteil), `unerlaubtes Urteil „${b.urteil}"`],
      [Boolean(b.begruendung?.trim()), "ohne Begründung"],
      [Boolean(b.beleg?.trim()), "ohne Beleg"],
      [/^\d{4}-\d{2}-\d{2}$/.test(b.bewertet_am ?? ""), "ohne Datum"],
    ];
    for (const [ok, text] of pruefungen) {
      if (!ok) {
        fehler.push(`${wo}: ${text}`);
      }
    }
    const schluessel = `${b.bestand}|${b.kennung}|${b.paket}|${b.ort}`;
    if (gesehen.has(schluessel)) {
      fehler.push(`${wo}: doppelt`);
    }
    gesehen.add(schluessel);
  }
  return fehler;
}

function gleicherOrt(a: Meldung | Bewertung, b: Meldung | Bewertung): boolean {
  return a.kennung === b.kennung && a.paket === b.paket && a.ort === b.ort;
}

/** Ordnet jede Meldung eines Bestands ihrer Bewertung zu — an der HEUTE gebundenen Version. */
export function ordneZu(
  bestand: Bestand,
  meldungen: readonly Meldung[],
  register: readonly Bewertung[],
  lock: Lockdatei,
): Fund[] {
  return meldungen.map((m) => {
    const version = lock.packages?.[m.ort]?.version ?? null;
    const bewertung = register.find((b) => b.bestand === bestand && gleicherOrt(b, m)) ?? null;
    let zustand: Fund["zustand"] = "unbewertet";
    if (bewertung !== null) {
      zustand = bewertung.version === version ? "bewertet" : "veraltet";
    }
    return { ...m, bestand, version, zustand, bewertung };
  });
}

/** Registereinträge, zu denen das Audit nichts mehr meldet — Hinweis, keine Sperre. */
export function nichtMehrGemeldet(
  bestand: Bestand,
  funde: readonly Fund[],
  register: readonly Bewertung[],
): Bewertung[] {
  return register.filter((b) => b.bestand === bestand && !funde.some((f) => gleicherOrt(f, b)));
}

export interface Ergebnis {
  readonly code: 0 | 1 | 2;
  readonly zeilen: readonly string[];
}

function fundZeile(f: Fund): { readonly sperrt: boolean; readonly zeile: string } {
  const version = f.version ?? "fehlt in der Lockdatei";
  const was = `${f.kennung} ${f.paket}@${version} (${f.ort}, ${f.schwere})`;
  const b = f.bewertung;
  if (f.zustand === "unbewertet") {
    const bereich = f.bereich ? ` [betroffen ${f.bereich}]` : "";
    return { sperrt: true, zeile: `  ✖ unbewertet: ${was} — ${f.titel}${bereich}` };
  }
  if (f.zustand === "veraltet") {
    const alt = `bewertet war ${b?.version} am ${b?.bewertet_am}`;
    return { sperrt: true, zeile: `  ✖ Bewertung veraltet: ${was} — ${alt}` };
  }
  if (b?.urteil === "exponiert") {
    const grund = `${b.begruendung} (${b.beleg})`;
    return { sperrt: false, zeile: `  ⚠ exponiert, bewusst offen: ${was} — ${grund}` };
  }
  return { sperrt: false, zeile: `  · nicht exponiert: ${was} — ${b?.beleg}` };
}

/**
 * Die ganze Prüfung ohne Prozess und ohne Netz: Berichte, Register und Lockdateien hinein,
 * Rückgabewert und Ausgabezeilen heraus. Der CLI-Teil unten beschafft nur die Eingaben.
 */
export function pruefe(
  berichte: Readonly<Record<Bestand, Bericht>>,
  register: readonly Bewertung[],
  locks: Readonly<Record<Bestand, Lockdatei>>,
): Ergebnis {
  const zeilen: string[] = [];
  const formfehler = registerFehler(register);
  if (formfehler.length > 0) {
    zeilen.push(`✖ Register ${REGISTER_DATEI} ist ungültig:`);
    for (const f of formfehler) {
      zeilen.push(`  · ${f}`);
    }
    return { code: 1, zeilen };
  }
  let nichtGeprueft = false;
  let sperre = false;
  for (const bestand of BESTANDSNAMEN) {
    const lockdatei = BESTAENDE[bestand].lockdatei;
    const bericht = berichte[bestand];
    if (bericht.art === "fehler") {
      nichtGeprueft = true;
      zeilen.push(`✖ Bestand ${bestand} (${lockdatei}): NICHT GEPRÜFT — ${bericht.grund}`);
      continue;
    }
    const funde = ordneZu(bestand, bericht.meldungen, register, locks[bestand]);
    const zahl = (z: Fund["zustand"]) => funde.filter((f) => f.zustand === z).length;
    const bilanz =
      `${funde.length} Meldungen · ${zahl("bewertet")} bewertet · ` +
      `${zahl("unbewertet")} unbewertet · ${zahl("veraltet")} veraltet`;
    zeilen.push(`  Bestand ${bestand} (${lockdatei}): ${bilanz}`);
    for (const f of funde) {
      const { sperrt, zeile } = fundZeile(f);
      sperre ||= sperrt;
      zeilen.push(zeile);
    }
    for (const b of nichtMehrGemeldet(bestand, funde, register)) {
      const was = `${b.kennung} ${b.paket} (${b.ort})`;
      zeilen.push(`  ⓘ nicht mehr gemeldet: ${was} — der Registereintrag kann entfallen`);
    }
  }
  if (nichtGeprueft) {
    zeilen.push("✖ Abhängigkeitsprüfung NICHT durchgeführt — ohne Prüfung keine Auslieferung.");
    return { code: 2, zeilen };
  }
  if (sperre) {
    zeilen.push("✖ Abhängigkeitsprüfung ROT. Jede ✖-Meldung braucht eine gezielte Behebung");
    zeilen.push("  oder eine Bewertung mit konkreter Exposition an der gebundenen Version:");
    zeilen.push(`  ${REGISTER_DATEI}`);
    return { code: 1, zeilen };
  }
  zeilen.push("✓ Abhängigkeitsprüfung: jede gemeldete Advisory ist an der gebundenen");
  zeilen.push("  Version bewertet.");
  return { code: 0, zeilen };
}

/** `npm audit --omit=dev --json` in einem Bestand. Exit 1 heisst bei npm „Meldungen da". */
export function fuehreAuditAus(verzeichnis: string): Bericht {
  const r = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: verzeichnis,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    return { art: "fehler", grund: `npm nicht ausführbar: ${r.error.message}` };
  }
  return liesAuditBericht(r.stdout ?? "");
}

function liesJson<T>(pfad: string): T {
  return JSON.parse(readFileSync(pfad, "utf8")) as T;
}

if (process.argv[1]?.endsWith("abhaengigkeiten-audit.ts")) {
  // `--bericht-wurzel <datei>` / `--bericht-web <datei>` lesen einen gespeicherten Bericht, statt
  // die Registry zu fragen — für den Aufrufertest und zum Nachvollziehen eines früheren Laufs. Die
  // Quelle steht in der Ausgabe; der Ship-Weg übergibt keine Datei.
  const argv = process.argv.slice(2);
  const wert = (name: string): string | undefined => {
    const stelle = argv.indexOf(name);
    return stelle === -1 ? undefined : argv[stelle + 1];
  };
  const wurzel = wert("--wurzel") ?? WURZEL;
  const berichte = {} as Record<Bestand, Bericht>;
  const locks = {} as Record<Bestand, Lockdatei>;
  console.log("Abhängigkeitsprüfung vor der Auslieferung (npm audit --omit=dev, R-1398)");
  for (const bestand of BESTANDSNAMEN) {
    const datei = wert(`--bericht-${bestand}`);
    const quelle = datei ? `gespeicherter Bericht ${datei}` : "npm audit, jetzt";
    console.log(`  Quelle ${bestand}: ${quelle}`);
    berichte[bestand] = datei
      ? liesAuditBericht(readFileSync(datei, "utf8"))
      : fuehreAuditAus(join(wurzel, BESTAENDE[bestand].verzeichnis));
    locks[bestand] = liesJson<Lockdatei>(join(wurzel, BESTAENDE[bestand].lockdatei));
  }
  const register = liesJson<Bewertung[]>(join(wurzel, REGISTER_DATEI));
  const ergebnis = pruefe(berichte, register, locks);
  for (const z of ergebnis.zeilen) {
    console.log(z);
  }
  process.exit(ergebnis.code);
}
