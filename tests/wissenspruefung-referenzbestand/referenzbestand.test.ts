// ================================================================================================
// AUFNAHME 20260922 · REFERENZBESTAND-SOLLURTEILE — DER BESTAND HÄLT, WAS ER ÜBER SICH SAGT.
// ================================================================================================
//
// `referenzbestand.ts` legt Paar- und Mehrfachurteile vorab fest. Diese Datei hält fest:
//   · Q   jede Quelle liegt im Arbeitsbaum, jede Wertstelle steht wörtlich in ihrer Aussage, jeder
//         Fall urteilt über jedes seiner Paare genau einmal mit Begründung und nennt seine Herkunft;
//         übernommene Sollangaben (Demo-Korpus, PX-17) stimmen mit der Quelle überein  (Kriterium 1)
//   · A   Zahlen, Einheiten, Varianten, Ausnahmen und bewusst unklare Fälle sind vertreten  (K2)
//   · U   der Bestand hängt an keinem Modell: kein Import, keine Modellfelder, eine Bestätigung nur
//         durch eine Person mit Datum und Beleg — und in dieser Fassung ist noch nichts bestätigt (K3)
//   · D   das Dokument nennt Fassung, Fälle, Fragen und Originalkriterien des Bestands.
//
// WAS DIESE DATEI NICHT BELEGT: die fachliche Richtigkeit der Urteile. Die bestätigt nur Pedi bzw.
// eine benannte Fachperson; wie gut ein Modell gegen diese Urteile abschneidet, misst der gesonderte
// Auftrag `aufnahme:20260922:paarurteile-qualitaet`.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIM_CORPUS } from "../../services/app/src/sim-corpus";
import { QUELLEN } from "../beschaffung-px17/sollbestand";
import { DEMO_CORPUS } from "../demo-korpus/demo-corpus";
import {
  BESTANDSDATEI,
  ELEMENTE,
  FAELLE,
  FRAGEN_AN_PEDI,
  MERKMALE,
  ORIGINALKRITERIEN,
  REFERENZBESTAND_FASSUNG,
  SOLLURTEILE,
} from "./referenzbestand";

const DATEI = "tests/wissenspruefung-referenzbestand/referenzbestand.ts";
const DOKUMENT = "docs/entscheidungen/wissenspruefung-referenzbestand.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

interface ProbeEintrag {
  title: string;
  statement: string;
}

const PROBE = JSON.parse(lies(BESTANDSDATEI["probe-smoke"])) as ProbeEintrag[];

type Element = (typeof ELEMENTE)[number];
type Fall = (typeof FAELLE)[number];
type Merkmal = Fall["merkmale"][number];

const ELEMENT = new Map(ELEMENTE.map((e) => [e.id, e]));

/** Die Aussage eines Elements, gelesen aus genau der Bestandsdatei, die es nennt. */
function aussage(e: Element): string | undefined {
  switch (e.bestand) {
    case "sim-korpus":
      return SIM_CORPUS.find((k) => k.key === e.schluessel)?.statement;
    case "demo-korpus":
      return DEMO_CORPUS.find((p) => p.pageId === e.schluessel)?.text.de.statement;
    case "probe-smoke":
      return PROBE.find((p) => p.title === e.schluessel)?.statement;
    case "px17-sollbestand":
      return QUELLEN.find((q) => q.quellId === e.schluessel)?.aussage;
  }
}

function aussageVon(id: string): string {
  const e = ELEMENT.get(id);
  return (e && aussage(e)) ?? "";
}

const paarSchluessel = (a: string, b: string): string => [a, b].sort().join("|");

function allePaare(elemente: readonly string[]): string[] {
  const paare: string[] = [];
  for (let i = 0; i < elemente.length; i++) {
    for (let j = i + 1; j < elemente.length; j++) {
      paare.push(paarSchluessel(elemente[i] ?? "", elemente[j] ?? ""));
    }
  }
  return paare.sort();
}

const PAARURTEILE = FAELLE.flatMap((f) => f.paare.map((p) => ({ fall: f, ...p })));
type Paarurteil = (typeof PAARURTEILE)[number];

const faelle = (urteile: readonly Paarurteil[]): string[] => urteile.map((p) => p.fall.id);
const hat = (f: Fall, m: Merkmal): boolean => f.merkmale.includes(m);
const zeigtZahl = (f: Fall): boolean => f.wertstellen.some((w) => /\d|\bvier\b/.test(w.text));

const PFAD = /(?:services|tests|demo|docs)\/[\w./-]+\.(?:ts|md|json)/g;

// Was in einer Bestätigung auf einen Modelllauf statt auf ein menschliches Urteil zeigt.
const MODELLSPUR = /modell|model|reasoner|ki-lauf|ki-prüf|aicheck|claude|gpt|llm|ko_overlaps/i;

function bestaetigungsFehler(b: Fall["bestaetigung"]): string[] {
  if (b.stand === "vorgeschlagen") {
    return [];
  }
  const fehler: string[] = [];
  if (b.durch.trim() === "" || MODELLSPUR.test(b.durch)) {
    fehler.push("durch");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.am)) {
    fehler.push("am");
  }
  if (b.beleg.trim() === "" || MODELLSPUR.test(b.beleg)) {
    fehler.push("beleg");
  }
  return fehler;
}

describe("Referenzbestand · Q — Quellen, Urteile, Begründung, Herkunft (K1)", () => {
  it("Q1: jede Quelle liegt im Bestand und trägt eine Aussage", () => {
    expect(new Set(ELEMENTE.map((e) => e.id)).size).toBe(ELEMENTE.length);
    expect(Object.values(BESTANDSDATEI).filter((pfad) => !existsSync(pfad))).toEqual([]);
    expect(ELEMENTE.filter((e) => !aussage(e)).map((e) => e.id)).toEqual([]);
  });

  it("Q2: jede Wertstelle steht wörtlich in der Aussage ihres Elements", () => {
    const fehler: string[] = [];
    for (const fall of FAELLE) {
      for (const w of fall.wertstellen) {
        if (!fall.elemente.includes(w.element) || !aussageVon(w.element).includes(w.text)) {
          fehler.push(`${fall.id}: ${w.element} „${w.text}“`);
        }
      }
    }
    expect(fehler).toEqual([]);
  });

  it("Q3: jeder Fall urteilt über jedes seiner Paare genau einmal, mit Begründung", () => {
    expect(new Set(FAELLE.map((f) => f.id)).size).toBe(FAELLE.length);
    for (const fall of FAELLE) {
      if (fall.art === "paar") {
        expect(fall.elemente.length, fall.id).toBe(2);
      } else {
        expect(fall.elemente.length, fall.id).toBeGreaterThanOrEqual(3);
      }
      expect(new Set(fall.elemente).size, fall.id).toBe(fall.elemente.length);
      expect(
        fall.elemente.filter((id) => !ELEMENT.has(id)),
        fall.id,
      ).toEqual([]);
      const geurteilt = fall.paare.map((p) => paarSchluessel(p.a, p.b)).sort();
      expect(geurteilt, fall.id).toEqual(allePaare(fall.elemente));
      for (const p of fall.paare) {
        expect(SOLLURTEILE, fall.id).toContain(p.soll);
        expect(p.begruendung.length, `${fall.id} ${p.a}|${p.b}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("Q4: jede Herkunft nennt eine vorhandene Datei; jede Quelle wird beurteilt", () => {
    const fehler: string[] = [];
    for (const fall of FAELLE) {
      const pfade = [...fall.herkunft.matchAll(PFAD)].map((t) => t[0]);
      if (pfade.length === 0 || pfade.some((pfad) => !existsSync(pfad))) {
        fehler.push(fall.id);
      }
    }
    expect(fehler).toEqual([]);
    const beurteilt = new Set(FAELLE.flatMap((f) => f.elemente));
    expect(ELEMENTE.filter((e) => !beurteilt.has(e.id)).map((e) => e.id)).toEqual([]);
  });

  it("Q5: übernommene Sollangaben stimmen mit ihrer Quelle überein", () => {
    // Demo-Korpus: zwei Seiten mit demselben `conflictKey` sind ein eingebauter Widerspruch.
    const konfliktKey = (id: string): string | undefined => {
      const e = ELEMENT.get(id);
      return e?.bestand === "demo-korpus"
        ? DEMO_CORPUS.find((p) => p.pageId === e.schluessel)?.conflictKey
        : undefined;
    };
    const demo = PAARURTEILE.filter((p) => {
      const k = konfliktKey(p.a);
      return k !== undefined && k === konfliktKey(p.b);
    });
    expect(demo.length).toBeGreaterThanOrEqual(2);
    expect(faelle(demo.filter((p) => p.soll !== "widerspruch"))).toEqual([]);

    // PX-17: Entwurf, künftige Fassung oder Altstand ist heute kein Widerspruch (Geltungsausnahme);
    // eine zu klärende gegen eine gültige Quelle ist einer.
    const pxUrteil = (id: string) => {
      const e = ELEMENT.get(id);
      return e?.bestand === "px17-sollbestand"
        ? QUELLEN.find((q) => q.quellId === e.schluessel)?.sollurteil
        : undefined;
    };
    const beide = (p: Paarurteil) => [pxUrteil(p.a), pxUrteil(p.b)];
    const HEUTE_NICHT = new Set(["nicht_heute_gueltig", "historisch"]);
    const px = PAARURTEILE.filter((p) => beide(p).every((u) => u !== undefined));
    const nichtHeute = px.filter((p) => beide(p).some((u) => HEUTE_NICHT.has(u ?? "")));
    const klaeren = px.filter((p) => beide(p).includes("klaeren"));
    expect(nichtHeute.length).toBeGreaterThanOrEqual(3);
    expect(klaeren.length).toBeGreaterThanOrEqual(1);
    expect(faelle(nichtHeute.filter((p) => p.soll === "widerspruch"))).toEqual([]);
    expect(faelle(klaeren.filter((p) => p.soll !== "widerspruch"))).toEqual([]);
  });
});

describe("Referenzbestand · A — Abdeckung der schweren Fälle (K2)", () => {
  it("A1: jedes Merkmal und jedes Sollurteil kommt vor", () => {
    const merkmale = new Set(FAELLE.flatMap((f) => f.merkmale));
    expect(MERKMALE.filter((m) => !merkmale.has(m))).toEqual([]);
    const urteile = new Set(PAARURTEILE.map((p) => p.soll));
    expect(SOLLURTEILE.filter((s) => !urteile.has(s))).toEqual([]);
  });

  it("A2: Mehrfachfälle: eine reine Dublettengruppe und eine gemischte Gruppe", () => {
    const mehrfach = FAELLE.filter((f) => f.art === "mehrfach");
    const arten = mehrfach.map((f) => new Set(f.paare.map((p) => p.soll)));
    expect(arten.some((s) => s.size === 1 && s.has("duplikat"))).toBe(true);
    expect(arten.some((s) => s.size > 1)).toBe(true);
  });

  it("A3: Zahlenfälle zeigen ihre Zahl; „unklar“ und „offen“ gehören zusammen", () => {
    const ohneZahl = FAELLE.filter((f) => hat(f, "zahl") && !zeigtZahl(f));
    expect(ohneZahl.map((f) => f.id)).toEqual([]);
    const einheitOhneZahl = FAELLE.filter((f) => hat(f, "einheit") && !hat(f, "zahl"));
    expect(einheitOhneZahl.map((f) => f.id)).toEqual([]);
    const unklar = FAELLE.filter((f) => hat(f, "unklar")).map((f) => f.id);
    const offen = FAELLE.filter((f) => f.paare.some((p) => p.soll === "offen")).map((f) => f.id);
    expect(unklar.length).toBeGreaterThanOrEqual(1);
    expect(unklar).toEqual(offen);
  });

  it("A4: Zahlenfallen: andere Schreibweise, gleiche Einheit, echter Widerspruch", () => {
    const mitZahl = PAARURTEILE.filter((p) => hat(p.fall, "zahl"));
    expect(mitZahl.some((p) => p.soll === "duplikat")).toBe(true);
    expect(mitZahl.some((p) => p.soll === "kein_befund")).toBe(true);
    expect(mitZahl.some((p) => p.soll === "widerspruch")).toBe(true);
    const ausnahme = mitZahl.some((p) => p.soll === "variante" && hat(p.fall, "ausnahme"));
    expect(ausnahme).toBe(true);
  });
});

describe("Referenzbestand · U — unabhängig vom Modellergebnis (K3)", () => {
  it("U1: der Bestand importiert nichts und trägt keine Felder eines Modellurteils", () => {
    const quelle = lies(DATEI);
    expect(/^import\s/m.test(quelle)).toBe(false);
    expect(quelle).not.toMatch(/\bconfidence\b|zitat_a|zitat_b|\brelation:/);
  });

  it("U2: bestätigt nur eine Person mit Datum und Beleg — nie ein Modelllauf", () => {
    // Kalibrierung: die Regel greift.
    const pedi = {
      stand: "bestaetigt",
      durch: "Pedi",
      am: "2026-10-20",
      beleg: "gespraech/wissenspruefung-referenzbestand/sitzung-1.md",
    } as const;
    expect(bestaetigungsFehler(pedi)).toEqual([]);
    expect(bestaetigungsFehler({ ...pedi, durch: "Reasoner" })).toEqual(["durch"]);
    expect(bestaetigungsFehler({ ...pedi, beleg: "Modelllauf 14.10." })).toEqual(["beleg"]);
    expect(bestaetigungsFehler({ ...pedi, am: "" })).toEqual(["am"]);

    const fehler: string[] = [];
    for (const fall of FAELLE) {
      for (const feld of bestaetigungsFehler(fall.bestaetigung)) {
        fehler.push(`${fall.id}: ${feld}`);
      }
    }
    expect(fehler).toEqual([]);
  });

  it("U3: Entwurfsfassung — kein Urteil ist bestätigt, die Bestätigung steht aus", () => {
    expect(REFERENZBESTAND_FASSUNG).toContain("ENTWURF");
    expect(FAELLE.filter((f) => f.bestaetigung.stand !== "vorgeschlagen")).toEqual([]);
    expect(FRAGEN_AN_PEDI.map((f) => f.id)).toContain("F4");
  });
});

describe("Referenzbestand · D — Dokument und Bestand stimmen überein", () => {
  it("D1: das Dokument nennt Fassung, Fälle, Fragen und Originalkriterien", () => {
    const dokument = lies(DOKUMENT);
    expect(dokument).toContain(REFERENZBESTAND_FASSUNG);
    expect(dokument).toContain(DATEI);
    expect(FAELLE.filter((f) => !dokument.includes(`| ${f.id} |`)).map((f) => f.id)).toEqual([]);
    expect(FRAGEN_AN_PEDI.filter((f) => !dokument.includes(`**${f.id}**`))).toEqual([]);
    expect(ORIGINALKRITERIEN.filter((k) => !dokument.includes(k))).toEqual([]);
  });
});
