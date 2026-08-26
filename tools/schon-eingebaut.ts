// ================================================================================================
// tools/schon-eingebaut.ts — WELCHE STAENDE LIEGEN IM HAUPTSTAND, UND WAS SAGT IHR URTEIL?
// ================================================================================================
//
// JOB 2511 D1 (BASIC3), fortgeschrieben in JOB 2532 D1. Die Fassung aus JOB 2500 D1 trug zwei
// Fehler, die in JOB 2511 gefunden wurden und die Zahlen deutlich verschoben haben; ein dritter
// kam in JOB 2524 dazu. Alle drei sind unten als eigene Regel benannt.
//
// PRUEFABDECKUNG in diesem Klon: `tests/structure/job2532-raster-repariert.test.ts`.
// Die Pruefaelle zu den Regeln (1)–(4) stehen in `job2511-eingebaut-vor-dem-urteil.test.ts` —
// diese Datei liegt NICHT im Basisklon `51dbc9a` und ist deshalb hier nicht als Verweis genannt.
// Das ist keine Nachlaessigkeit, sondern der belegte Zustand: **kein Werkzeug dieser Reihe ist je
// im Basisklon angekommen** (JOB 2532, §2).
//
// DAS VERFAHREN: Der ENDHASH aus der Rueckgabe wird gegen die Datei im Hauptstand gerechnet.
// Stimmen sie, liegt der Stand byteidentisch im Produkt — ganz gleich, was Register oder
// Urteilslage behaupten.
//
// ================================================================================================
// DIE VIER SCHAERFEN. Jede einzelne entscheidet ueber die Zahl, und jede stammt aus einem eigenen
// Fehlschlag — zwei aus JOB 2500, zwei aus diesem Durchgang.
//
//   (1) STARTPIN = ENDHASH IST KEIN WRITE.  [JOB 2500]
//       Nulldiff-Tabellen fuehren UNVERAENDERTE Dateien mit gleichem Start- und Endhash.
//
//   (2) EIN `-CODE.md` IST EIN TEILURTEIL, NIE EIN SACHURTEIL.  [JOB 2500]
//       `kw_pruefer.py` schreibt dort `GESAMTURTEIL: GRUEN` — „ein Skript, kein Chat".
//
//   (3) `NEU` IST EINE SPALTENANGABE, NICHT DAS DEUTSCHE ADJEKTIV.  [NEU in JOB 2511]
//       Der alte Marker lautete `/…|\bNEU\b|…/i`. Das abschliessende `i` machte ihn zum Wort
//       „neu" im Fliesstext: „baut das Rueckgabeobjekt neu" (PRO, JOB 724 D5, Z. 275) galt damit
//       als ausgewiesener Write. **13 Staende weniger, nachdem der Marker sitzt.**
//
//   (4) DIE RUECKGABE SAGT SELBST, OB SIE GESCHRIEBEN HAT.  [NEU in JOB 2511]
//       25 Rueckgaben erklaeren `PRODUKTWRITES: 0` und wurden trotzdem als eingebaut gezaehlt —
//       ihre Hashtabellen stammen aus Nulldiff-Belegen, Mutationsprotokollen und Zielpfad-
//       Inventaren. **Eine Rueckgabe, die null Writes erklaert, HAT keine.** Das ist die
//       staerkste verfuegbare Auskunft, und die erste Fassung hat sie uebergangen.
//
// WIRKUNG DER ZWEI NEUEN REGELN, gemessen am 26.08.2026 gegen `51dbc9a`:
//     vollstaendig eingebaut     141  →  116
//     eingebaut vor dem Urteil    49  →   35
//     ohne jedes Sachurteil       36  →   30
//
// Beide Fehler zeigten in dieselbe Richtung: ZU VIEL melden. Ein Stand, der faelschlich als
// „erledigt" gilt, wird abgehakt — und dann fehlt er wirklich.
//
// ================================================================================================
//   (5) EIN SPERRWORT IM FLIESSTEXT IST KEINE ZUSTELLSPERRE.  [NEU in JOB 2532]
//       Bis hierher stand in dieser Datei:
//
//         const SPERRE = /NICHT BEURTEILT|ZUSTELLUNG UNVOLLST|…|NICHT ABGEGEBEN/i;
//
//       Das abschliessende `i` macht aus dem Formularwort `NICHT BEURTEILT` die gewoehnliche
//       deutsche Wendung „nicht beurteilt" — und die steht im Standardabschnitt `NICHT GEPRÜFT:`
//       sehr vieler Berichte: „Nicht beurteilt sind Produktzustände ausserhalb des gebundenen
//       D1-Prüfpakets." Ergebnis: **313 von 492 Treffern waren Prosa, 63,6 %** (JOB 2524).
//
//       ES IST DIESELBE FEHLERART WIE (3), zum zweiten Mal in derselben Datei. Deshalb steht die
//       Regel jetzt nicht mehr hier, sondern an EINER Stelle in `tools/urteilslage.ts`, wo sie
//       eigene Pruefaellen hat. Eine Regel, die an zwei Orten steht, wird an einem repariert.
//
// WIRKUNG DER FUENFTEN REGEL, gemessen am 26.08.2026 gegen `51dbc9a`, beide Raster im selben Lauf:
//     vollstaendig eingebaut     116  →  116   (haengt an Hashes, nicht am Raster)
//     eingebaut vor dem Urteil    36  →   42
//     ohne jedes Sachurteil       29  →   17
//
// Dieser Fehler zeigte in die ANDERE Richtung als (1)–(4): Er meldete Staende als unbeurteilt,
// die laengst ein Urteil hatten. Zwoelf Bahnen bekamen dadurch Arbeit zugewiesen, die getan war.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hatZustellsperre, istTeilurteil } from "./urteilslage";

/** Wo die Rueckgaben und Pruefberichte liegen. Ueberschreibbar, damit das Werkzeug ohne KLARWERK laeuft. */
export const OUTBOX =
  process.env.KLARWERK_OUTBOX ??
  "/Users/peterkohnert/Documents/Projekt_klarwerk/_relay/kopf/outbox";

/** Die Arbeitswurzel aus dem DATEIORT, nicht aus dem Prozessverzeichnis (cwd-Vertrag). */
export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PFAD_MUSTER =
  /\b((?:tests|tools|services|apps|scripts)\/[\w./-]+\.(?:tsx?|mjs|sh|py|json|md))\b/g;
const HEX64 = /\b[0-9a-f]{64}\b/g;

export type WriteArt = "NEU" | "GEAENDERT";

export interface Write {
  pfad: string;
  art: WriteArt;
  endhash: string;
}

/**
 * SCHAERFE (3): Weist diese Zeile eine NEU angelegte Datei aus?
 *
 * `ABSENT`/`ABWESEND` duerfen beliebig geschrieben sein — es sind distinktive Fachwoerter.
 * `NEU` dagegen NUR grossgeschrieben: klein ist es das gewoehnliche deutsche Adjektiv und steht in
 * jedem zweiten Fliesstext. Genau daran ist die Fassung aus JOB 2500 gescheitert.
 */
export function istNeuZeile(zeile: string): boolean {
  return /ABSENT|ABWESEND/i.test(zeile) || /\bNEU\b/.test(zeile) || /\(neu\)|— neu/.test(zeile);
}

/**
 * SCHAERFE (4): Erklaert die Rueckgabe selbst, dass sie nichts geschrieben hat?
 *
 * Traegt JEDE `PRODUKTWRITES: <n>`-Angabe des Dokuments n = 0, sind es null Writes. Steht
 * irgendwo eine Zahl groesser null, wird normal erhoben — eine Rueckgabe kann fremde Nullwrites
 * zitieren, und dann darf ihre eigene Zahl nicht davon verdeckt werden.
 */
export function erklaertNullWrites(text: string): boolean {
  const zahlen = [...text.matchAll(/PRODUKTWRITES:?\s*\*{0,2}\s*(\d+)/g)].map((m) => Number(m[1]));
  return zahlen.length > 0 && zahlen.every((n) => n === 0);
}

/**
 * Die ECHTEN Writes einer Rueckgabe.
 *
 *   (a) Pfad + ZWEI Hashes in einer Zeile, die sich UNTERSCHEIDEN → `GEAENDERT`
 *   (b) Pfad + EIN Hash in einer Neu-Zeile → `NEU`
 *   (X) Pfad + zwei GLEICHE Hashes → unveraendert ausgewiesen, kein Write  [Schaerfe 1]
 *   (X) die Rueckgabe erklaert null Writes → gar nichts                     [Schaerfe 4]
 * Eine Zeile mit mehreren Pfaden wird uebergangen: die Zuordnung waere geraten.
 */
export function echteWrites(text: string): Write[] {
  if (erklaertNullWrites(text)) {
    return [];
  }
  const raus: Write[] = [];
  for (const zeile of text.split("\n")) {
    const hashes = [...zeile.matchAll(HEX64)].map((m) => m[0]);
    if (hashes.length === 0) {
      continue;
    }
    const pfade = [...zeile.matchAll(PFAD_MUSTER)].map((m) => m[1]).filter(Boolean) as string[];
    if (pfade.length !== 1) {
      continue;
    }
    const pfad = pfade[0] as string;
    if (hashes.length >= 2) {
      const start = hashes[0] as string;
      const ende = hashes[hashes.length - 1] as string;
      if (start === ende) {
        continue;
      }
      raus.push({ pfad, art: "GEAENDERT", endhash: ende });
    } else if (istNeuZeile(zeile)) {
      raus.push({ pfad, art: "NEU", endhash: hashes[0] as string });
    }
  }
  return raus;
}

/**
 * SCHAERFE (2): Ein `-CODE.md` ist ein Teilurteil des Skripts, nie das Sachurteil des Pruefers.
 * Seit JOB 2532 lebt die Regel in `tools/urteilslage.ts` und wird hier nur weitergereicht, damit
 * bestehende Aufrufer sie unveraendert finden.
 */
export { istTeilurteil };

export interface Urteil {
  sachurteil: boolean;
  /** Der Spruch des GESAMTURTEILs, gross: `GRÜN` oder `ROT`. */
  spruch: string | null;
  /** Das PRODUKT-Urteil getrennt — ein ROT kann die FORM treffen und das Produkt freigeben. */
  produkt: string | null;
}

/**
 * Das Urteil eines Berichts.
 *
 * Kein Sachurteil, wenn es ein Teilurteil ist oder eine Zustellsperre darauf steht. Sonst ja,
 * sobald ein `GESAMTURTEIL` vorkommt — ob gruen oder rot, ist fuer die Frage „beurteilt?"
 * gleichgueltig. **Fuer die Frage „ist es schlimm?" ist es der ganze Unterschied**, deshalb wird
 * `PRODUKT` getrennt gelesen.
 *
 * SCHAERFE (5): „Zustellsperre" wird von `hatZustellsperre` entschieden, nicht mehr von einem
 * Raster in dieser Datei. Der Unterschied ist nicht kosmetisch — er betraegt 313 Berichte.
 */
export function urteilVon(dateiname: string, text: string): Urteil {
  if (istTeilurteil(dateiname) || !/GESAMTURTEIL/i.test(text) || hatZustellsperre(text)) {
    return { sachurteil: false, spruch: null, produkt: null };
  }
  return {
    sachurteil: true,
    spruch: /GESAMTURTEIL:?\s*([A-ZÄÖÜ]+)/.exec(text)?.[1] ?? null,
    produkt: /^PRODUKT:?\s*([A-ZÄÖÜ]+)/m.exec(text)?.[1] ?? null,
  };
}

export interface Herkunft {
  bahn: string;
  job: string;
  durchgang: string;
}

export function herkunftVon(dateiname: string): Herkunft | null {
  const t = /^RUECKGABE-([A-Z0-9]+)-JOB-(\d+)-D(\d+)/.exec(dateiname);
  if (!t?.[1] || !t[2] || !t[3]) {
    return null;
  }
  return { bahn: t[1], job: t[2], durchgang: t[3] };
}

/** Betrifft dieser Pfad eine Testdatei? Ein PRODUKT-ROT auf einem Test ist etwas anderes als auf Produktlogik. */
export function istTestpfad(pfad: string): boolean {
  return pfad.startsWith("tests/") || /\.test\.tsx?$/.test(pfad);
}

export interface Stand {
  datei: string;
  herkunft: Herkunft;
  writes: Write[];
  imBaum: number;
  urteil: Urteil;
}

const hashCache = new Map<string, string | null>();
function hashImBaum(pfad: string, wurzel: string): string | null {
  const schluessel = `${wurzel}::${pfad}`;
  const bekannt = hashCache.get(schluessel);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const voll = join(wurzel, pfad);
  let h: string | null = null;
  if (existsSync(voll)) {
    try {
      h = createHash("sha256").update(readFileSync(voll)).digest("hex");
    } catch {
      h = null;
    }
  }
  hashCache.set(schluessel, h);
  return h;
}

/** Die Urteilslage je `job|durchgang`. */
export function urteilslage(outbox: string = OUTBOX): Map<string, Urteil> {
  const raus = new Map<string, Urteil>();
  let namen: string[];
  try {
    namen = readdirSync(outbox);
  } catch {
    return raus;
  }
  for (const name of namen) {
    const t = /^BEN-PRUEFUNG-JOB-(\d+)-D(\d+)(-CODE)?\.md$/.exec(name);
    if (!t) {
      continue;
    }
    let text: string;
    try {
      text = readFileSync(join(outbox, name), "utf8");
    } catch {
      continue;
    }
    const u = urteilVon(name, text);
    if (u.sachurteil) {
      raus.set(`${t[1]}|${t[2]}`, u);
    } else if (!raus.has(`${t[1]}|${t[2]}`)) {
      raus.set(`${t[1]}|${t[2]}`, u);
    }
  }
  return raus;
}

export function erhebe(outbox: string = OUTBOX, wurzel: string = WURZEL): Stand[] {
  let namen: string[];
  try {
    namen = readdirSync(outbox);
  } catch {
    return [];
  }
  const lage = urteilslage(outbox);
  const raus: Stand[] = [];
  for (const name of namen) {
    if (!name.startsWith("RUECKGABE-") || !name.endsWith(".md")) {
      continue;
    }
    const h = herkunftVon(name);
    if (!h) {
      continue;
    }
    let text: string;
    try {
      text = readFileSync(join(outbox, name), "utf8");
    } catch {
      continue;
    }
    const writes = echteWrites(text);
    if (writes.length === 0) {
      continue;
    }
    raus.push({
      datei: name,
      herkunft: h,
      writes,
      imBaum: writes.filter((w) => hashImBaum(w.pfad, wurzel) === w.endhash).length,
      urteil: lage.get(`${h.job}|${h.durchgang}`) ?? {
        sachurteil: false,
        spruch: null,
        produkt: null,
      },
    });
  }
  return raus;
}

// Direktaufruf: `node tools/schon-eingebaut.ts` — beim Import passiert hier nichts.
if (process.argv[1]?.endsWith("schon-eingebaut.ts")) {
  const staende = erhebe();
  if (staende.length === 0) {
    console.log(`KEINE AUSKUNFT: unter ${OUTBOX} liegen keine lesbaren Rueckgaben.`);
    console.log("Das ist kein 'nichts eingebaut' — es ist 'nicht nachgesehen'.");
    process.exit(2);
  }
  const ganz = staende.filter((s) => s.imBaum === s.writes.length);
  const ohneUrteil = ganz.filter((s) => !s.urteil.sachurteil);
  const produktRot = ganz.filter((s) => s.urteil.produkt === "ROT");
  const rotMitProduktcode = produktRot.filter((s) => !s.writes.every((w) => istTestpfad(w.pfad)));

  console.log(`Rueckgaben mit echtem Write:                 ${staende.length}`);
  console.log(`  davon vollstaendig im Hauptstand:          ${ganz.length}`);
  console.log(`  davon OHNE Sachurteil:                     ${ohneUrteil.length}`);
  console.log(`  davon mit PRODUKT: ROT:                    ${produktRot.length}`);
  console.log(`     davon auf echtem Produktcode:           ${rotMitProduktcode.length}\n`);

  console.log("PRODUKT-ROT AUF PRODUKTCODE, IM HAUPTSTAND — die dringendsten Zeilen:");
  for (const s of rotMitProduktcode) {
    const h = s.herkunft;
    console.log(`  ${h.bahn.padEnd(7)} JOB ${h.job.padStart(4)} D${h.durchgang}`);
    for (const w of s.writes.filter((x) => !istTestpfad(x.pfad))) {
      console.log(`     ${w.art.padEnd(10)} ${w.pfad}`);
    }
  }
  console.log("\nGrundmenge: alle RUECKGABE-*.md im Postfach, verglichen gegen");
  console.log(`${WURZEL}`);
  console.log("Untergrenze: Rueckgaben ohne Endhash und mehrdeutige Zeilen sind NICHT gezaehlt.");
}
