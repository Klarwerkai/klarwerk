// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-bestand (AA-01) · DER BESTAND HÄLT SEINE FUNDSTELLEN.
// ================================================================================================
//
//   F1  Jede Fundstelle eines gelieferten Eintrags existiert im Arbeitsbaum und enthält ihren
//       wörtlichen Anker — die Liste behauptet nichts, was der Quellcode nicht trägt (K1).
//   F2  Stände sind sauber getrennt: geliefert mit Fundstellen, Kandidat nur mit Zweig und Commit,
//       beauftragt nur mit AA-ID und ohne Code (K1).
//   F3  Jede ID der Liste steht in BESTAND.md; Integrationsplan und Entscheidungsvorlage liegen vor
//       und nennen den offenen Status der systemweiten Frage (K2).
//   F4  Integrationsplan und Entscheidungsvorlage setzen nur IDs voraus, die im Bestand stehen —
//       keine zusätzlichen Einstellungen oder Aktionen (K3).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

interface Fundstelle {
  pfad: string;
  anker: string;
}

interface Eintrag {
  id: string;
  art: string;
  name: string;
  stand: "geliefert" | "kandidat" | "beauftragt";
  fundstellen?: Fundstelle[];
  zweig?: string;
  commit?: string;
  aa?: string;
  host?: string[];
  speicher?: string;
}

const ORDNER = "docs/klara-setup-shortcuts";
const lies = (datei: string): string => readFileSync(repoPfad(`${ORDNER}/${datei}`), "utf8");

const liste = JSON.parse(lies("fundstellen.json")) as { eintraege: Eintrag[] };
const eintraege = liste.eintraege;
const ids = new Set(eintraege.map((e) => e.id));

describe("F1 · gelieferte Einträge sind im Quellcode belegt", () => {
  const geliefert = eintraege.filter((e) => e.stand === "geliefert");

  it("es gibt gelieferte Einstellungen, Aktionen, Kürzel und Hosts", () => {
    for (const art of ["einstellung", "aktion", "kuerzel", "host"]) {
      expect(
        geliefert.some((e) => e.art === art),
        art,
      ).toBe(true);
    }
  });

  for (const e of geliefert) {
    it(`${e.id} · ${e.name}`, () => {
      expect(e.fundstellen?.length ?? 0, `${e.id} ohne Fundstelle`).toBeGreaterThan(0);
      expect(e.host?.length ?? 0, `${e.id} ohne Hostkontext`).toBeGreaterThan(0);
      expect(e.speicher ?? "", `${e.id} ohne Speicherzuständigkeit`).not.toBe("");
      for (const f of e.fundstellen ?? []) {
        const pfad = repoPfad(f.pfad);
        expect(existsSync(pfad), `${e.id}: ${f.pfad} fehlt`).toBe(true);
        const inhalt = readFileSync(pfad, "utf8");
        expect(inhalt, `${e.id}: Anker fehlt in ${f.pfad}`).toContain(f.anker);
      }
    });
  }
});

describe("F2 · geliefert, Kandidat und beauftragt bleiben getrennt", () => {
  it("IDs sind eindeutig und jeder Stand ist einer der drei", () => {
    expect(ids.size).toBe(eintraege.length);
    for (const e of eintraege) {
      expect(["geliefert", "kandidat", "beauftragt"], e.id).toContain(e.stand);
    }
  });

  it("Kandidaten nennen Zweig und Commit und keine Fundstelle im Hauptstand", () => {
    const kandidaten = eintraege.filter((e) => e.stand === "kandidat");
    expect(kandidaten.length).toBeGreaterThan(0);
    for (const e of kandidaten) {
      expect(e.zweig ?? "", e.id).toMatch(/^codex\/auftrag-[0-9a-f]{20}$/);
      expect(e.commit ?? "", e.id).toMatch(/^[0-9a-f]{7,40}$/);
      expect(e.fundstellen, e.id).toBeUndefined();
    }
  });

  it("beauftragte Pakete sind genau AA-02 bis AA-05, ohne Code", () => {
    const beauftragt = eintraege.filter((e) => e.stand === "beauftragt");
    expect(beauftragt.map((e) => e.aa).sort()).toEqual(["AA-02", "AA-03", "AA-04", "AA-05"]);
    for (const e of beauftragt) {
      expect(e.fundstellen, e.id).toBeUndefined();
    }
  });
});

describe("F3 · Bestand, Integrationsplan und Entscheidungsvorlage liegen vor", () => {
  it("jede ID der Liste steht in BESTAND.md", () => {
    const bestand = lies("BESTAND.md");
    const fehlend = [...ids].filter((id) => !new RegExp(`\\b${id}\\b`).test(bestand));
    expect(fehlend).toEqual([]);
  });

  it("der Integrationsplan behandelt AA-02, AA-03 und AA-04", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    for (const aa of ["AA-02", "AA-03", "AA-04"]) {
      expect(plan).toMatch(new RegExp(`^## \\d\\. ${aa} `, "m"));
    }
  });

  it("die Entscheidungsvorlage stellt beide Optionen und bleibt offen", () => {
    const vorlage = lies("ENTSCHEIDUNG-SYSTEMWEIT.md");
    expect(vorlage).toContain("**Status: offen");
    expect(vorlage).toContain("A · nur innerhalb Klarwerks");
    expect(vorlage).toContain("B · zusätzlich systemweit");
  });
});

describe("F4 · der Plan setzt nur erfasste Einstellungen und Aktionen voraus", () => {
  for (const datei of ["INTEGRATIONSPLAN.md", "ENTSCHEIDUNG-SYSTEMWEIT.md"]) {
    it(datei, () => {
      const genannt = [...lies(datei).matchAll(/\b[EOATHC]\d{2}\b/g)].map((m) => m[0]);
      expect(genannt.length).toBeGreaterThan(0);
      expect(genannt.filter((id) => !ids.has(id))).toEqual([]);
    });
  }

  it("die Kürzelaktionen des Plans sind gelieferte Aktionen", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    const abschnitt = plan.slice(plan.indexOf("## 2. AA-03"), plan.indexOf("## 3. AA-04"));
    const aktionen = [...abschnitt.matchAll(/\bA\d{2}\b/g)].map((m) => m[0]);
    expect(new Set(aktionen)).toEqual(new Set(["A01", "A02"]));
    for (const id of aktionen) {
      const e = eintraege.find((x) => x.id === id);
      expect(e?.art, id).toBe("aktion");
      expect(e?.stand, id).toBe("geliefert");
    }
  });
});
