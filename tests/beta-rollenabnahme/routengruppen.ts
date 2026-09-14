// ================================================================================================
// JOB 4015 · LIEFERUNG 1 — DIE ERHEBUNG: WELCHE TÜREN HAT DIE APP ÜBERHAUPT?
// ================================================================================================
//
// DIE LISTE WIRD ERMITTELT, NICHT ABGESCHRIEBEN. Eine im Test abgetippte Aufzählung wäre am Tag
// ihrer Entstehung richtig und ab der nächsten registrierten Routengruppe still falsch — und genau
// „still" ist die Lücke, die dieser Auftrag schliesst. Deshalb liest dieses Modul die
// Kompositionswurzel `services/app/src/build-app.ts` als TEXT und zählt, was dort tatsächlich
// registriert wird.
//
// WARUM STATISCH UND NICHT AM LAUFENDEN FASTIFY: Fastify kennt zur Laufzeit ROUTEN (Methode+Pfad),
// nicht die GRUPPEN, aus denen sie stammen — `app.printRoutes()` wüsste nicht mehr, dass
// `/api/kos` aus `koRoutes` kommt. Die Frage dieses Auftrags ist aber die nach den Gruppen: sie ist
// die Einheit, in der das Produkt Türen hinzufügt.
//
// DIE RICHTUNG IST „IM ZWEIFEL AUFNEHMEN". Jeder `app.register(X)` zählt als Routengruppe, ES SEI
// DENN `X` steht namentlich und mit Grund in `AUSGENOMMEN`. Eine Regel wie „alles, was auf `Routes`
// endet" wäre die umgekehrte Richtung: eine künftig anders benannte Gruppe fiele lautlos aus der
// Abnahme. So muss sie stattdessen in die Tabelle — oder jemand schreibt hier auf, warum nicht.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Die Kompositionswurzel — die EINE Stelle, an der die App ihre Routen bekommt. */
export const WURZEL = join(process.cwd(), "services/app/src/build-app.ts");

/**
 * Was bei `app.register` KEINE Routengruppe ist. Jeder Eintrag trägt seinen Grund; ein neuer
 * Eintrag ohne Grund ist eine Lücke in der Abnahme und wird vom Wächter benannt.
 */
export const AUSGENOMMEN: Record<string, string> = {
  cors: "@fastify/cors — eine Fastify-Erweiterung für Antwortköpfe; sie legt keine Route an.",
  rateLimit:
    "@fastify/rate-limit — Drossel über bestehenden Routen (`global: false`); sie legt keine Route an.",
};

export interface Routengruppe {
  /** Der Name, unter dem `build-app.ts` sie registriert, z. B. `koRoutes`. */
  registrar: string;
  /** Das Modul, aus dem sie importiert wird, z. B. `./routes/ko-routes`. */
  modul: string;
  /** Die Zeile in `build-app.ts`, in der `app.register(...)` steht. */
  zeile: number;
  /**
   * Die Bedingung, unter der sie überhaupt registriert wird (Schalter) — oder `undefined` für
   * „immer". Ohne diese Auskunft sähe „nicht registriert" in der Abnahme aus wie „gesperrt".
   */
  bedingung?: string;
}

export interface DirekteRoute {
  methode: string;
  pfad: string;
  zeile: number;
}

export interface Erhebung {
  gruppen: Routengruppe[];
  /** Routen, die `buildApp` unmittelbar selbst anlegt (`app.get(...)`), ohne Gruppe darum. */
  direkt: DirekteRoute[];
  /** Die `app.register`-Aufrufe, die laut `AUSGENOMMEN` keine Routengruppe sind. */
  ausgenommen: string[];
}

/**
 * Entfernt Kommentare, ohne die Zeilennummern zu verschieben.
 *
 * Ohne diesen Schritt zählte ein `app.register(...)`, das in einem Begründungsblock ZITIERT wird,
 * als echte Registrierung — `build-app.ts` ist voll solcher Blöcke. Die Zeilen werden durch
 * Leerzeilen ERSETZT und nicht gelöscht, damit `zeile` weiter auf die Datei zeigt, die ein Mensch
 * aufschlägt.
 */
function ohneKommentare(quelle: string): string[] {
  const zeilen = quelle.split("\n");
  let imBlock = false;
  return zeilen.map((zeile) => {
    const roh = zeile.trim();
    if (imBlock) {
      if (roh.includes("*/")) {
        imBlock = false;
      }
      return "";
    }
    if (roh.startsWith("/*")) {
      imBlock = !roh.includes("*/");
      return "";
    }
    if (roh.startsWith("//") || roh.startsWith("*")) {
      return "";
    }
    return zeile;
  });
}

/** Bezeichner → Modulpfad, aus allen `import { … } from "…"` der Datei (auch mehrzeiligen). */
function importe(quelle: string): Map<string, string> {
  const karte = new Map<string, string>();
  const muster = /import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)"/g;
  let treffer = muster.exec(quelle);
  while (treffer) {
    const modul = treffer[2] ?? "";
    for (const roh of (treffer[1] ?? "").split(",")) {
      const name = roh
        .replace(/\btype\b/, "")
        .replace(/\bas\b[\s\S]*$/, "")
        .trim();
      if (name.length > 0) {
        karte.set(name, modul);
      }
    }
    treffer = muster.exec(quelle);
  }
  return karte;
}

/**
 * Die Bedingung, in deren Block die Registrierung in Zeile `index` steht — oder `undefined`.
 *
 * Gelesen wird rückwärts über die Blockklammern auf Einrückungsstufe 2 (dem Rumpf von `buildApp`):
 * jede geschlossene Klammer auf dem Weg nach oben verbraucht ein `if` davor. Das trägt genau so
 * weit, wie die Datei einheitlich formatiert ist — und das erzwingt Biome bei jedem Lauf.
 */
function bedingungFuer(zeilen: string[], index: number): string | undefined {
  let offen = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const zeile = zeilen[i] ?? "";
    if (/^ {2}\}/.test(zeile)) {
      offen += 1;
      continue;
    }
    const treffer = zeile.match(/^ {2}if \((.+)\) \{$/);
    if (treffer) {
      if (offen === 0) {
        return treffer[1];
      }
      offen -= 1;
    }
  }
  return undefined;
}

/** Liest die Kompositionswurzel und liefert, was dort registriert wird. */
export function erhebeRoutengruppen(datei: string = WURZEL): Erhebung {
  const quelle = readFileSync(datei, "utf8");
  const zeilen = ohneKommentare(quelle);
  const karte = importe(quelle);
  const gruppen: Routengruppe[] = [];
  const ausgenommen: string[] = [];
  const direkt: DirekteRoute[] = [];

  // Gesucht wird im ZUSAMMENHÄNGENDEN Text und nicht Zeile für Zeile: Biome bricht lange Aufrufe um,
  // und `app.register(\n  koRoutes(` ist die häufigere Form als die einzeilige. Eine zeilenweise
  // Suche fände genau die grossen Gruppen nicht — also die, auf die es ankommt.
  const text = zeilen.join("\n");
  const zeileVon = (stelle: number): number => text.slice(0, stelle).split("\n").length;

  const registrierungen = /app\.register\(\s*([A-Za-z_$][\w$]*)?/g;
  let treffer = registrierungen.exec(text);
  while (treffer) {
    const index = zeileVon(treffer.index) - 1;
    // `app.register(` mit einem Ausdruck statt eines Bezeichners dahinter gäbe es heute nicht;
    // käme er, stünde er hier als `?` und fiele dem Wächter auf, statt lautlos zu fehlen.
    const name = treffer[1] ?? `?zeile-${index + 1}`;
    if (name in AUSGENOMMEN) {
      ausgenommen.push(name);
    } else {
      const bedingung = bedingungFuer(zeilen, index);
      gruppen.push({
        registrar: name,
        modul: karte.get(name) ?? "(nicht importiert — im Modul selbst gebaut)",
        zeile: index + 1,
        ...(bedingung ? { bedingung } : {}),
      });
    }
    treffer = registrierungen.exec(text);
  }

  const direkteRouten = /app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
  let direkterTreffer = direkteRouten.exec(text);
  while (direkterTreffer) {
    direkt.push({
      methode: (direkterTreffer[1] ?? "").toUpperCase(),
      pfad: direkterTreffer[2] ?? "",
      zeile: zeileVon(direkterTreffer.index),
    });
    direkterTreffer = direkteRouten.exec(text);
  }

  return { gruppen, direkt, ausgenommen };
}
