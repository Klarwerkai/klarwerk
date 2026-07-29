// ================================================================================================
// AUFTRAG-mega46 BLOCK F — DER SAMMLER: EIN SCHALTER, EIN LESER.
// ================================================================================================
//
// Die Gefahr, gegen die dieser Test steht, ist keine hypothetische: Vor mega46 lasen FÜNF Stellen
// dieselben drei Schalter, jede mit ihrer eigenen abgeschriebenen Regel (provenance-routes,
// library-routes zweimal, build-app zweimal). Solange nur der Server sie las, war das lästig. Seit
// GET /api/features existiert, ist es gefährlich — denn die Auskunft an die Oberfläche und die
// Entscheidung, ob eine Route überhaupt registriert wird, MÜSSEN dieselbe Regel benutzen. Tun sie
// es nicht, rendert die Anwendung eine Fläche, deren Route es nicht gibt (oder verbirgt eine, die
// da ist), und der Anwender bekommt einen Fehler, den niemand erklären kann.
//
// Der Sammler prüft deshalb nicht die heutigen fünf Stellen, sondern die BAUFORM: Kein Produktcode
// außerhalb des Registrys liest einen REGISTRIERTEN Schalter direkt aus der Umgebung. Wer künftig
// `process.env.KLARWERK_PROVENANCE_ENABLED` irgendwo einstreut, wird rot — auch in einer Datei, die
// es heute noch nicht gibt.
//
// AUSDRÜCKLICH NICHT GEPRÜFT: Schalter, die WERTE tragen (URLs, Schlüssel, Grenzen). Die dürfen
// weiterhin dort gelesen werden, wo sie gebraucht werden — sie gehen die Oberfläche nichts an und
// stehen deshalb gar nicht erst im Registry.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHALTER_NAMEN, SCHALTER_REGISTRY } from "../../services/app/src/feature-flags";

const WURZEL = join(__dirname, "..", "..");

// Der EINE erlaubte Leser.
const REGISTRY_DATEI = join("services", "app", "src", "feature-flags.ts");

// Produktcode — Tests dürfen die Umgebung selbstverständlich setzen und lesen.
const PRODUKT_WURZELN = [join("services"), join("apps", "web", "src")];

// BENANNTE AUSNAHMEN, je mit Grund. Eine pauschale Ausnahme („services/confluence/**") gibt es
// bewusst nicht, und eine Ausnahme, die niemand mehr braucht, ist unten ROT — sonst wächst hier
// still eine Liste, die den Sammler aushöhlt.
const AUSNAHMEN: Record<string, string> = {
  [join("services", "confluence", "src", "adapter.ts")]:
    "Anderes Modul. `services/confluence` darf `services/app` nicht importieren (Modulgrenze, " +
    "dependency-cruiser) und bekommt die Umgebung deshalb als PARAMETER gereicht. Es entscheidet " +
    "damit nicht über eine Fläche, sondern nur darüber, ob es sich selbst überhaupt baut.",
};

// Ein echter LESEZUGRIFF, nicht die bloße Erwähnung: `process.env.X`, `process.env["X"]`, `env.X`.
// Kommentare werden vorher entfernt — die Schalternamen stehen zu Recht in vielen Erklärtexten.
function leseZugriffe(inhalt: string, variable: string): number[] {
  const muster = new RegExp(
    String.raw`\benv\s*(?:\.\s*${variable}\b|\[\s*["'\`]${variable}["'\`])`,
  );
  const zeilen: number[] = [];
  let imBlockKommentar = false;
  inhalt.split("\n").forEach((zeile, index) => {
    let code = zeile;
    if (imBlockKommentar) {
      const ende = code.indexOf("*/");
      if (ende === -1) {
        return;
      }
      code = code.slice(ende + 2);
      imBlockKommentar = false;
    }
    const blockStart = code.indexOf("/*");
    if (blockStart !== -1) {
      imBlockKommentar = code.indexOf("*/", blockStart) === -1;
      code = code.slice(0, blockStart);
    }
    const zeilenKommentar = code.indexOf("//");
    if (zeilenKommentar !== -1) {
      code = code.slice(0, zeilenKommentar);
    }
    if (muster.test(code)) {
      zeilen.push(index + 1);
    }
  });
  return zeilen;
}

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Alle direkten Lesezugriffe auf registrierte Schalter, außerhalb des Registrys. */
function direkteLeser(): Map<string, string[]> {
  const treffer = new Map<string, string[]>();
  for (const datei of PRODUKT_WURZELN.flatMap(quelldateien)) {
    if (datei === REGISTRY_DATEI) {
      continue;
    }
    const inhalt = readFileSync(join(WURZEL, datei), "utf8");
    for (const name of SCHALTER_NAMEN) {
      for (const zeile of leseZugriffe(inhalt, SCHALTER_REGISTRY[name])) {
        const liste = treffer.get(datei) ?? [];
        liste.push(`${datei}:${zeile} liest ${SCHALTER_REGISTRY[name]} selbst`);
        treffer.set(datei, liste);
      }
    }
  }
  return treffer;
}

describe("mega46 F · der Sammler über die eine Schalter-Wahrheit", () => {
  it("das Registry ist nicht leer und führt nur Ja/Nein-Schalter", () => {
    // Ein leerer Sammler ist ein grüner Sammler, der nichts bewacht — deshalb diese Untergrenze.
    expect(SCHALTER_NAMEN.length).toBeGreaterThan(0);
    for (const name of SCHALTER_NAMEN) {
      expect(SCHALTER_REGISTRY[name]).toMatch(/^KLARWERK_[A-Z0-9_]+$/);
    }
  });

  it("die Erhebung greift überhaupt", () => {
    // Ein kaputter Datei-Lauf darf nicht still grün sein.
    expect(PRODUKT_WURZELN.flatMap(quelldateien).length).toBeGreaterThan(100);
    // Und das Muster muss echte Zugriffe von bloßen Erwähnungen unterscheiden können.
    expect(leseZugriffe("const a = process.env.KLARWERK_X;", "KLARWERK_X")).toEqual([1]);
    expect(leseZugriffe("// nur ein Hinweis auf process.env.KLARWERK_X", "KLARWERK_X")).toEqual([]);
  });

  it("KEIN Produktcode außerhalb des Registrys liest einen registrierten Schalter selbst", () => {
    const verstoesse = [...direkteLeser()]
      .filter(([datei]) => !(datei in AUSNAHMEN))
      .flatMap(([, meldungen]) => meldungen);
    expect(verstoesse).toEqual([]);
  });

  it("jede benannte Ausnahme ist begründet — und wird noch gebraucht", () => {
    const leser = direkteLeser();
    for (const [datei, grund] of Object.entries(AUSNAHMEN)) {
      // Keine leere oder pauschale Ausnahme.
      expect(grund.length, `Ausnahme ${datei} ohne echten Grund`).toBeGreaterThan(40);
      expect(datei).not.toContain("*");
      // Keine unbenutzte Ausnahme: Wer nicht mehr direkt liest, gehört aus der Liste gestrichen.
      expect(leser.has(datei), `Ausnahme ${datei} wird nicht mehr gebraucht`).toBe(true);
    }
  });

  it("jeder registrierte Schalter wird auch wirklich BENUTZT", () => {
    // Die Gegenrichtung: Ein Schalter, den niemand abfragt, ist eine Auskunft über nichts — die
    // Oberfläche würde eine Fläche schalten, die es nirgends gibt.
    const inhalte = PRODUKT_WURZELN.flatMap(quelldateien)
      .filter((d) => d !== REGISTRY_DATEI)
      .map((d) => readFileSync(join(WURZEL, d), "utf8"));
    for (const name of SCHALTER_NAMEN) {
      const benutzt = inhalte.some((inhalt) => inhalt.includes(`schalterAn("${name}")`));
      expect(benutzt, `Schalter „${name}“ steht im Registry, wird aber nirgends abgefragt`).toBe(
        true,
      );
    }
  });
});
