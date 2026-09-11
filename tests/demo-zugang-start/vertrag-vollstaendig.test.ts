// ================================================================================================
// JOB 3655 · D — DER VERTRAG FÜHRT *ALLE* UMGEBUNGSWERTE. GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// Auftrag §3.1 verlangt „eine Stelle, die ALLE Umgebungswerte namentlich führt". Ein von Hand
// gepflegter Katalog erfüllt das am Tag seiner Entstehung und danach nie wieder — die nächste
// Umgebungsvariable kommt irgendwo in `services/**` dazu, und niemand denkt an den Katalog.
//
// Diese Datei ist deshalb ein SAMMLER, kein zweiter Katalog: Sie liest den Produktionsquelltext
// unter `services/`, erhebt jeden Lesezugriff auf eine Umgebungsvariable und verlangt, dass jeder
// gefundene Name entweder im Startvertrag steht oder hier BENANNT und BEGRÜNDET ausgenommen ist.
//
// GRENZE, ausdrücklich benannt: Erhoben werden `process.env.NAME`, `env.NAME` (der durchgereichte
// Umgebungssatz, die zweite verbreitete Form in diesem Haus) und die Namenskonstanten der Form
// `…_ENV = "NAME"`. Ein dynamischer Zugriff über eine berechnete Zeichenkette (wie
// `process.env[SCHALTER_REGISTRY[name]]` in feature-flags.ts) ist hier NICHT erfassbar — er ist
// über den Registry-Umweg aber bereits von `mega46-schalter-eine-wahrheit.test.ts` gedeckt, und
// die Schaltereinträge des Vertrags werden genau aus diesem Registry erzeugt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";

const WURZEL = join(__dirname, "..", "..");

/**
 * BENANNTE AUSNAHMEN, jede mit Grund. Keine pauschale Ausnahme, kein Platzhalter — wer hier
 * etwas einträgt, erklärt, warum es den Betreiber einer Instanz nichts angeht.
 */
const AUSNAHMEN: Record<string, string> = {
  // KEIN Eintrag für PATH: die Erhebung hat gezeigt, dass `process.env.PATH` in slide-converter.ts
  // NUR in einem Kommentar steht („bewusst NICHT process.env.PATH"). Gelesen wird er nicht — der
  // Konverter bekommt einen fest verdrahteten Systempfad (CONVERTER_PATH). Eine Ausnahme dafür wäre
  // eine Unwahrheit gewesen, und D2 hätte sie als unbenutzt gemeldet.
  KLARWERK_PG_TEST_URL:
    "Nur Testläufe: die Wegwerf-Datenbank der Integrationstests. Eine laufende Instanz liest sie nie.",
  KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE:
    "Nur Testläufe: erlaubt den zerstörenden Zugriff auf die Wegwerf-Datenbank. Gehört nicht in den Start einer Instanz.",
};

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag === "dist") {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (eintrag.endsWith(".ts") && !eintrag.includes(".test.")) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Kommentarzeilen zählen nicht: eine Erwähnung ist kein Lesezugriff. */
function istKommentar(zeile: string): boolean {
  const t = zeile.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

const MUSTER = [
  // `process.env.NAME` — der Punkt vor `env` gehört dazu und darf nicht mit ausgeschlossen werden.
  /process\.env\.([A-Z][A-Z0-9_]{2,})\b/g,
  // `env.NAME` auf einem durchgereichten Umgebungssatz (die zweite verbreitete Form in diesem Haus).
  /(?:^|[^A-Za-z0-9_$.])env\.([A-Z][A-Z0-9_]{2,})\b/g,
  // `const X_ENV = "NAME";` — die Namenskonstanten, über die der Reasoner seine Werte liest.
  /_ENV\s*=\s*"([A-Z][A-Z0-9_]{2,})"/g,
];

/** Name → Fundstellen (Datei:Zeile). */
function erhobeneNamen(): Map<string, string[]> {
  const treffer = new Map<string, string[]>();
  for (const datei of quelldateien("services")) {
    const zeilen = readFileSync(join(WURZEL, datei), "utf8").split("\n");
    zeilen.forEach((zeile, index) => {
      if (istKommentar(zeile)) {
        return;
      }
      for (const muster of MUSTER) {
        muster.lastIndex = 0;
        let fund = muster.exec(zeile);
        while (fund !== null) {
          const name = fund[1];
          if (name !== undefined) {
            const liste = treffer.get(name) ?? [];
            liste.push(`${datei}:${index + 1}`);
            treffer.set(name, liste);
          }
          fund = muster.exec(zeile);
        }
      }
    });
  }
  return treffer;
}

describe("JOB 3655 D · der Startvertrag deckt den gesamten Produktionsquelltext", () => {
  it("D0 · die Erhebung greift überhaupt", () => {
    expect(quelldateien("services").length).toBeGreaterThan(100);
    const namen = erhobeneNamen();
    // Vier Werte, die dieser Sammler zwingend finden MUSS — findet er sie nicht, misst er nichts.
    for (const pflicht of ["DATABASE_URL", "APP_BASE_URL", "SMTP_HOST", "KLARWERK_ADDON_API_KEY"]) {
      expect([...namen.keys()], `${pflicht} nicht erhoben`).toContain(pflicht);
    }
    // Und Kommentare sind wirklich ausgenommen.
    expect(istKommentar("  // process.env.KLARWERK_ERFUNDEN")).toBe(true);
  });

  it("D1 · jeder gelesene Umgebungswert steht im Vertrag oder ist benannt ausgenommen", () => {
    const imVertrag = new Set(STARTVERTRAG.map((w) => w.name));
    const ungedeckt = [...erhobeneNamen()]
      .filter(([name]) => !imVertrag.has(name) && !(name in AUSNAHMEN))
      .map(([name, orte]) => `${name} (${orte.slice(0, 3).join(", ")})`);
    expect(ungedeckt).toEqual([]);
  });

  it("D2 · jede Ausnahme ist begründet — und wird noch gebraucht", () => {
    const erhoben = erhobeneNamen();
    for (const [name, grund] of Object.entries(AUSNAHMEN)) {
      expect(grund.length, `Ausnahme ${name} ohne echten Grund`).toBeGreaterThan(40);
      // Eine Ausnahme für etwas, das niemand mehr liest, verschleiert nur den Stand.
      expect(erhoben.has(name), `Ausnahme ${name} wird nicht mehr gelesen — streichen`).toBe(true);
      // Und keine Ausnahme darf gleichzeitig im Vertrag stehen.
      expect(STARTVERTRAG.map((w) => w.name)).not.toContain(name);
    }
  });

  it("D3 · jeder Vertragseintrag ist vollständig ausgefüllt und eindeutig", () => {
    const gesehen = new Set<string>();
    for (const wert of STARTVERTRAG) {
      expect(wert.name, "Name nicht in Variablenform").toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(gesehen.has(wert.name), `${wert.name} steht doppelt im Vertrag`).toBe(false);
      gesehen.add(wert.name);
      expect(wert.bereich.length, `${wert.name} ohne Bereich`).toBeGreaterThan(0);
      expect(wert.wofuer.length, `${wert.name} ohne „wofür"`).toBeGreaterThan(20);
      expect(wert.ohneIhn.length, `${wert.name} ohne Folgesatz`).toBeGreaterThan(20);
    }
  });

  it("D4 · jeder Wert, der ein Geheimnis tragen kann, ist als geheim gekennzeichnet", () => {
    // Der Katalog entscheidet, ob ein Wert je in eine Beispieldatei darf. Diese Probe hält die
    // naheliegenden Namensmuster fest, damit ein künftiger Schlüssel nicht als harmlos durchrutscht.
    const verdaechtig = STARTVERTRAG.filter((w) =>
      /(_KEY|_TOKEN|_SECRET|_PASS|DATABASE_URL)$/.test(w.name),
    );
    expect(verdaechtig.length).toBeGreaterThan(4);
    for (const wert of verdaechtig) {
      expect(wert.geheim, `${wert.name} ist nicht als geheim gekennzeichnet`).toBe(true);
    }
  });
});
