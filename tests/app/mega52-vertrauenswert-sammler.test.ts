import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// AUFTRAG-mega52 BLOCK E5 — DER SAMMLER FÜR DEN VERTRAUENSWERT.
// ================================================================================================
//
// DER VORFALL. 'Trust' stand als englisches Fachwort mitten im deutschen und niederländischen
// Anzeigetext — 'Hoher Trust', 'Ø Trust', 'Was bedeutet Trust?'. Im ENGLISCHEN ist 'trust' ein
// normales Wort; im Deutschen und Niederländischen ist es Jargon, den ein Werkstattmeister oder
// eine Pflegedienstleitung nicht liest, sondern überliest. Das ist der ganze Punkt der Umbenennung:
// sie gilt für zwei Sprachen und ausdrücklich NICHT für die dritte.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM, NICHT DIE LISTE DER HEUTIGEN FÄLLE. Es steht hier bewusst keine Aufzählung der 48
// deutschen und 46 niederländischen Schlüssel vom 29.07. Der Sammler erhebt die Sprachblöcke des
// i18n aus der DATEI (die `const de = {` / `const en` / `const nl`-Grenzen) und liest je Block
// ALLE Anzeigewerte. Ein Schlüssel, den jemand morgen anlegt, ist ohne Zutun Gegenstand.
//
// GEPRÜFT WIRD DER WERT, NIE DER SCHLÜSSELNAME. E3 ist unverhandelbar: technische Bezeichner,
// Feldnamen, Testids und `data-*` bleiben unangetastet. `lib.facet.trustBucket.t70` heißt weiter so
// — nur was dort STEHT, ist Gegenstand. Der letzte Fall unten belegt das ausdrücklich, damit eine
// spätere Verschärfung nicht versehentlich über die Bezeichner rutscht.
//
// DER PLATZHALTER `{{trust}}` IST EIN BEZEICHNER, KEIN ANZEIGEWORT. Er benennt die Variable, die
// i18next einsetzt; ihn umzubenennen bräche die Aufrufer, ohne dass ein Nutzer je etwas anderes
// sähe. Er wird deshalb vor der Prüfung maskiert — dieselbe Trennung, die auch die Umbenennung
// selbst gemacht hat.
//
// MITGENOMMEN WIRD DIE ZWEITE ÜBERSETZUNGSTABELLE. Das Word-Add-in
// (`apps/web/public/word-addin/taskpane.html`) führt ein eigenes, vom i18n unabhängiges Dictionary
// mit de/en/nl-Blöcken. Ein Sammler, der nur `i18n.ts` liest, hätte 'Trust {n}' dort stehen lassen
// — und Pedis Befund kam aus genau diesem Add-in.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//
//  1. SIE SIEHT NUR ÜBERSETZUNGSTABELLEN. Ein deutscher Anzeigetext, der irgendwo im Quellcode
//     hart kodiert ist, fällt durch — die Anwendung hat solche Stellen (z. B. Formeln in
//     `lib/knowledgeValuation.ts`), und sie sind bei dieser Umbenennung von Hand mitgezogen worden.
//     Der strukturelle Wächter dagegen ist die i18n-Pflicht selbst, nicht diese Datei.
//  2. SIE PRÜFT EIN WORT, KEINE BEDEUTUNG. 'Vertrauensscore' wäre grün und trotzdem Jargon.
//  3. SIE SIEHT NUR DE UND NL. Das ist keine Lücke, sondern E2: Englisch behält 'trust' bewusst.
//     Ein Fall unten hält das ausdrücklich fest, damit niemand die Regel 'aus Symmetrie' ausweitet.
// ================================================================================================

const WURZEL = process.cwd();
const I18N = join("apps", "web", "src", "i18n.ts");
const WORD_ADDIN = join("apps", "web", "public", "word-addin", "taskpane.html");

// E2: hier wird umbenannt — und nur hier.
const UEBERSETZTE_SPRACHEN = ["de", "nl"] as const;
// E2: hier ausdrücklich NICHT — 'trust' ist im englischen Text ein normales Wort.
const UNBERUEHRTE_SPRACHE = "en";

// E3: der i18next-Platzhalter benennt eine Variable, keinen Anzeigewert.
function ohnePlatzhalter(wert: string): string {
  return wert.replace(/\{\{\s*trust\s*\}\}/g, "");
}

function traegtTrust(wert: string): boolean {
  return /\btrust\b/i.test(ohnePlatzhalter(wert));
}

interface Fund {
  quelle: string;
  sprache: string;
  schluessel: string;
  wert: string;
}

const SPRACHEN = ["de", "en", "nl"] as const;

function i18nBloecke(): Map<string, string> {
  const quelle = readFileSync(join(WURZEL, I18N), "utf8");
  const grenzen: Array<[string, number]> = [];
  for (const sprache of SPRACHEN) {
    const m = new RegExp(`^const ${sprache}(: typeof de)? = \\{$`, "m").exec(quelle);
    if (m) {
      grenzen.push([sprache, m.index]);
    }
  }
  grenzen.sort((a, b) => a[1] - b[1]);
  const bloecke = new Map<string, string>();
  for (const [i, [sprache, start]] of grenzen.entries()) {
    bloecke.set(sprache, quelle.slice(start, grenzen[i + 1]?.[1] ?? quelle.length));
  }
  return bloecke;
}

const I18N_EINTRAG = /^ {2}"([\w.]+)":\s*\n?\s*"((?:[^"\\]|\\.)*)"/gm;

function i18nWerte(sprache: string): Fund[] {
  const block = i18nBloecke().get(sprache) ?? "";
  return [...block.matchAll(I18N_EINTRAG)].map((m) => ({
    quelle: "apps/web/src/i18n.ts",
    sprache,
    schluessel: m[1] as string,
    wert: m[2] as string,
  }));
}

// Die zweite Übersetzungstabelle: das Word-Add-in mit eigenen de/en/nl-Blöcken.
const ADDIN_EINTRAG = /^\s+(\w+):\s*"((?:[^"\\]|\\.)*)",?$/gm;

function addinWerte(sprache: string): Fund[] {
  const quelle = readFileSync(join(WURZEL, WORD_ADDIN), "utf8");
  const grenzen: Array<[string, number]> = [];
  for (const s of SPRACHEN) {
    const m = new RegExp(`^\\s+${s}:\\s*\\{`, "m").exec(quelle);
    if (m) {
      grenzen.push([s, m.index]);
    }
  }
  grenzen.sort((a, b) => a[1] - b[1]);
  const i = grenzen.findIndex(([s]) => s === sprache);
  if (i < 0) {
    return [];
  }
  const start = grenzen[i]?.[1] ?? 0;
  const block = quelle.slice(start, grenzen[i + 1]?.[1] ?? quelle.length);
  return [...block.matchAll(ADDIN_EINTRAG)].map((m) => ({
    quelle: "apps/web/public/word-addin/taskpane.html",
    sprache,
    schluessel: m[1] as string,
    wert: m[2] as string,
  }));
}

function alleWerte(sprache: string): Fund[] {
  return [...i18nWerte(sprache), ...addinWerte(sprache)];
}

describe("mega52 E5: die Erhebung greift", () => {
  it("beide Übersetzungstabellen werden wirklich gelesen", () => {
    for (const sprache of SPRACHEN) {
      expect(i18nWerte(sprache).length, `i18n-Block "${sprache}" leer`).toBeGreaterThan(2000);
      expect(addinWerte(sprache).length, `Add-in-Block "${sprache}" leer`).toBeGreaterThan(20);
    }
    // Die drei i18n-Blöcke sind wirklich getrennt — sonst prüfte man dreimal denselben Text und
    // der englische Block färbte alles rot.
    const de = new Set(i18nWerte("de").map((f) => f.wert));
    expect(de.has("Vertrauen"), "der deutsche Block ist nicht sauber geschnitten").toBe(true);
    expect(i18nWerte("en").some((f) => f.wert === "Trust")).toBe(true);
  });

  it("das Muster erkennt den Jargon und verwechselt ihn nicht mit dem Platzhalter", () => {
    expect(traegtTrust("Hoher Trust: mehrfach positiv geprüft.")).toBe(true);
    expect(traegtTrust("Ø trust")).toBe(true);
    expect(traegtTrust("Trust 70+")).toBe(true);
    // E3: der i18next-Platzhalter ist ein Bezeichner — er darf NICHT rot machen.
    expect(traegtTrust("Basis: {{n}} validierte Objekte · Ø Vertrauen {{trust}}")).toBe(false);
    // Und ein sauber übersetzter Wert ebenso wenig.
    expect(traegtTrust("Hohes Vertrauen: mehrfach positiv geprüft.")).toBe(false);
    expect(traegtTrust("Hoog vertrouwen: meermaals positief gecontroleerd.")).toBe(false);
  });
});

describe("mega52 E5: kein deutscher oder niederlaendischer Anzeigewert traegt Trust", () => {
  for (const sprache of UEBERSETZTE_SPRACHEN) {
    it(`Sprachblock ${sprache}`, () => {
      const funde = alleWerte(sprache)
        .filter((f) => traegtTrust(f.wert))
        .map((f) => `${f.quelle} · ${f.sprache}.${f.schluessel}: ${f.wert}`);

      const erwartet = sprache === "de" ? "Vertrauen" : "vertrouwen";
      expect(
        funde,
        `Trust ist im Sprachblock ${sprache} Fachjargon, den die Zielgruppe ueberliest — Werkstattmeister, Pflegedienstleitung, Kanzlei. Der Anzeigewert heisst ${erwartet}. Der SCHLUESSELNAME bleibt unberuehrt (E3): Bezeichner, Feldnamen und Testids werden NICHT umbenannt, und der i18next-Platzhalter {{trust}} auch nicht.`,
      ).toEqual([]);
    });
  }
});

describe("mega52 E2: Englisch bleibt bewusst unberuehrt", () => {
  it("der englische Block traegt Trust weiterhin — das ist kein Versehen", () => {
    // Ohne diesen Fall waere die Umbenennung eine Einladung, aus Symmetrie auch Englisch zu
    // ziehen. Im englischen Text ist trust ein normales Wort; genau darauf beruht E2.
    const englisch = alleWerte(UNBERUEHRTE_SPRACHE).filter((f) => traegtTrust(f.wert));
    expect(
      englisch.length,
      "Der englische Block traegt trust nicht mehr — E2 verlangt ausdruecklich, ihn zu belassen.",
    ).toBeGreaterThan(10);
  });
});

describe("mega52 E3: die Bezeichner sind unberührt geblieben", () => {
  it("Schlüsselnamen mit 'trust' existieren weiterhin in allen drei Sprachen", () => {
    // Der Beleg, dass die Umbenennung wirklich nur den WERT getroffen hat. Wäre jemand über die
    // Schlüssel gegangen, bräche jeder `t("lib.facet.trustBucket.t70")`-Aufrufer geräuschlos.
    const PFLICHT = [
      "lib.facet.trust",
      "lib.facet.trustBucket.t70",
      "lib.sort.trust",
      "val.trust",
      "ko.ovTrust",
      "trust.explain.title",
      "answerSource.trust",
      "dcmp.trustStatus",
      "mgmt.kpiTrust",
    ];
    for (const sprache of SPRACHEN) {
      const namen = new Set(i18nWerte(sprache).map((f) => f.schluessel));
      for (const pflicht of PFLICHT) {
        expect(namen.has(pflicht), `${sprache}: Schlüssel ${pflicht} fehlt`).toBe(true);
      }
    }
  });

  it("der Platzhalter {{trust}} steht weiterhin in allen drei Sprachen", () => {
    for (const sprache of SPRACHEN) {
      const mitPlatzhalter = i18nWerte(sprache).filter((f) => /\{\{\s*trust\s*\}\}/.test(f.wert));
      expect(
        mitPlatzhalter.length,
        `${sprache}: der Platzhalter {{trust}} ist verschwunden — die Aufrufer setzen ihn weiterhin.`,
      ).toBeGreaterThan(0);
    }
  });
});
