// ================================================================================================
// tools/fassung-pruefen.ts — KAM DIE FASSUNG AN, DIE DIE MASCHINE TRÄGT?
// ================================================================================================
//
// REGISTER I17 (R-2033, R-0969, R-0128). Der Befund, wörtlich: *„Die Dateiübertragung liefert
// Altfassungen — jede gestagte Datei gegen die gemeldete Bytezahl prüfen."* Am 29.07. beim
// Nachrechnen von mega58 real passiert: `provider.ts` kam mit 64.256 Bytes und altem Code an,
// während die Maschine 65.655 Bytes und den neuen trug. Dieselbe Ursache hatte vorher schon vier
// falsche „erledigt" erzeugt.
//
// DAS VERFAHREN hat zwei Hälften, und beide stehen in DIESER Datei, damit Melden und Prüfen nicht
// auseinanderlaufen können:
//
//   melden   Auf der Maschine, die die gültige Fassung trägt: je Datei Bytezahl UND SHA-256 des
//            Inhalts. Die Ausgabe ist ein JSON-Manifest, das mit der Übertragung mitreist.
//   pruefen  Dort, wo die Dateien angekommen sind: jede Datei gegen ihre Zeile im Manifest.
//
// WARUM DIE PRÜFSUMME DAZU MUSS (R-0969): die Bytezahl allein entlarvt den Fall vom 29.07., aber
// nicht jede Altfassung. Eine Änderung, die nur Zeichen austauscht („<" → ">", `true` → `fals`
// plus ein Zeichen anderswo), lässt die Länge gleich. Erst der Inhalts-Hash trennt das sicher.
// Die Bytezahl bleibt trotzdem ein eigener Befund: sie ist der billige, sofort lesbare Hinweis,
// und die Meldung nennt beide Zahlen, damit der Mensch die Abweichung selbst nachrechnen kann.
//
// WAS ES NICHT IST: kein Übertragungsweg und kein Ersatz für „direkt auf der Maschine lesen" —
// es macht nur sichtbar, OB das Gelesene die gemeldete Fassung ist. Es schreibt nichts.
//
// AUFRUF (Node führt TypeScript direkt aus; kein `npx`, kein Nachladen aus dem Netz):
//
//   node tools/fassung-pruefen.ts melden <wurzel> <pfad> [<pfad> …]   > manifest.json
//   node tools/fassung-pruefen.ts pruefen <wurzel> <manifest.json>
//
// EXITCODES von `pruefen`:
//   0 = jede Datei ist byte- und hashgleich zur gemeldeten Fassung
//   1 = mindestens eine Datei fehlt oder weicht ab (die Ausgabe nennt jede einzeln)
//   2 = Manifest unlesbar oder Aufruf falsch (nichts geprüft)

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";

/** Eine gemeldete Fassung: so sah die Datei auf der Maschine aus. */
export interface GemeldeteFassung {
  /** Relativ zur Wurzel, mit `/` getrennt. */
  pfad: string;
  bytes: number;
  sha256: string;
}

export interface FassungsManifest {
  dateien: GemeldeteFassung[];
}

export type FassungsBefund =
  | { pfad: string; zustand: "gleich"; bytes: number }
  | { pfad: string; zustand: "fehlt" }
  // Die Länge weicht ab — der Fall vom 29.07. Beide Zahlen stehen in der Meldung.
  | {
      pfad: string;
      zustand: "bytes_abweichend";
      gemeldet: number;
      angekommen: number;
    }
  // Gleiche Länge, anderer Inhalt — nur die Prüfsumme sieht es.
  | {
      pfad: string;
      zustand: "inhalt_abweichend";
      bytes: number;
      gemeldet: string;
      angekommen: string;
    };

/**
 * Ein Manifestpfad darf die Wurzel nicht verlassen. Ein Manifest ist Fremdeingabe — wer `../`
 * oder einen absoluten Pfad hineinschreibt, soll nicht beliebige Dateien „prüfen" lassen.
 */
export function sichererPfad(pfad: string): boolean {
  if (pfad.length === 0 || isAbsolute(pfad) || pfad.includes("\0")) {
    return false;
  }
  const n = normalize(pfad.split("/").join(sep));
  return n !== ".." && !n.startsWith(`..${sep}`);
}

function sha256(inhalt: Buffer): string {
  return createHash("sha256").update(inhalt).digest("hex");
}

/** Die Fassung, die diese Maschine trägt — für jede genannte Datei. */
export function meldeFassungen(wurzel: string, pfade: readonly string[]): FassungsManifest {
  const dateien: GemeldeteFassung[] = [];
  for (const pfad of pfade) {
    if (!sichererPfad(pfad)) {
      throw new Error(`Pfad verlässt die Wurzel: ${pfad}`);
    }
    const inhalt = readFileSync(join(wurzel, pfad));
    dateien.push({ pfad, bytes: inhalt.length, sha256: sha256(inhalt) });
  }
  return { dateien };
}

/** Liest und prüft ein Manifest. Wirft bei jeder Formabweichung, statt etwas zu raten. */
export function liesManifest(text: string): FassungsManifest {
  const roh: unknown = JSON.parse(text);
  const dateien = (roh as { dateien?: unknown } | null)?.dateien;
  if (!Array.isArray(dateien)) {
    throw new Error("Manifest ohne Liste `dateien`.");
  }
  return {
    dateien: dateien.map((d, i) => {
      const e = d as Partial<GemeldeteFassung> | null;
      if (
        typeof e?.pfad !== "string" ||
        !sichererPfad(e.pfad) ||
        typeof e.bytes !== "number" ||
        !Number.isInteger(e.bytes) ||
        e.bytes < 0 ||
        typeof e.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(e.sha256)
      ) {
        throw new Error(`Manifestzeile ${i + 1} ist unvollständig oder ungültig.`);
      }
      return { pfad: e.pfad, bytes: e.bytes, sha256: e.sha256 };
    }),
  };
}

/** Jede angekommene Datei gegen ihre gemeldete Fassung — vollständig, nicht beim ersten Fund. */
export function pruefeFassungen(wurzel: string, manifest: FassungsManifest): FassungsBefund[] {
  return manifest.dateien.map((soll): FassungsBefund => {
    const ziel = join(wurzel, soll.pfad);
    if (!existsSync(ziel) || !statSync(ziel).isFile()) {
      return { pfad: soll.pfad, zustand: "fehlt" };
    }
    const inhalt = readFileSync(ziel);
    if (inhalt.length !== soll.bytes) {
      return {
        pfad: soll.pfad,
        zustand: "bytes_abweichend",
        gemeldet: soll.bytes,
        angekommen: inhalt.length,
      };
    }
    const ist = sha256(inhalt);
    if (ist !== soll.sha256) {
      return {
        pfad: soll.pfad,
        zustand: "inhalt_abweichend",
        bytes: inhalt.length,
        gemeldet: soll.sha256,
        angekommen: ist,
      };
    }
    return { pfad: soll.pfad, zustand: "gleich", bytes: inhalt.length };
  });
}

/** Eine Zeile je Datei, so dass die Abweichung ohne weiteres Werkzeug nachrechenbar ist. */
export function befundZeile(b: FassungsBefund): string {
  switch (b.zustand) {
    case "gleich":
      return `GLEICH      ${b.pfad} (${b.bytes} Bytes)`;
    case "fehlt":
      return `FEHLT       ${b.pfad}`;
    case "bytes_abweichend":
      return `ALTFASSUNG? ${b.pfad}: gemeldet ${b.gemeldet} Bytes, angekommen ${b.angekommen} Bytes`;
    case "inhalt_abweichend":
      return `ALTFASSUNG? ${b.pfad}: gleiche Länge (${b.bytes} Bytes), Prüfsumme gemeldet ${b.gemeldet}, angekommen ${b.angekommen}`;
  }
}

if (process.argv[1]?.endsWith("fassung-pruefen.ts")) {
  const [befehl, wurzel, ...rest] = process.argv.slice(2);
  if (befehl === "melden" && wurzel && rest.length > 0) {
    process.stdout.write(`${JSON.stringify(meldeFassungen(wurzel, rest), null, 2)}\n`);
    process.exit(0);
  }
  if (befehl === "pruefen" && wurzel && rest.length === 1) {
    let manifest: FassungsManifest;
    try {
      manifest = liesManifest(readFileSync(rest[0] as string, "utf-8"));
    } catch (e) {
      process.stderr.write(`Manifest unlesbar: ${String(e)}\n`);
      process.exit(2);
    }
    const befunde = pruefeFassungen(wurzel, manifest);
    for (const b of befunde) {
      process.stdout.write(`${befundZeile(b)}\n`);
    }
    process.exit(befunde.every((b) => b.zustand === "gleich") ? 0 : 1);
  }
  process.stderr.write(
    "Aufruf: fassung-pruefen.ts melden <wurzel> <pfad…> | pruefen <wurzel> <manifest.json>\n",
  );
  process.exit(2);
}
