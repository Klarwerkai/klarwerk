import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../knowledge-object";
import { type RiskHorizonInput, currentHorizonOf, riskHorizon } from "./horizon";
import {
  type CategoryProfile,
  ManagementProfileError,
  type RetirementEntry,
  normalizeCategoryProfile,
  normalizeRetirementHorizon,
  retirementDueAt,
} from "./profiles";

// R-1639 · R-2183 (Nacharbeit 3): der Bereichsblick je Manager mit Ruhestandshorizonten und dem
// Arbeitsvorrat bis zur Frist — reine Ableitung, und die Pflege-Normalisierung ihrer Eingänge.
const NOW = Date.parse("2026-10-04T00:00:00Z");

function ko(id: string, category: string, urheber: string, status = "validiert"): KnowledgeObject {
  return {
    id,
    title: id,
    category,
    originalAuthor: urheber,
    author: "erfasser",
    status,
  } as KnowledgeObject;
}

function profil(category: string, managerId: string | null): CategoryProfile {
  return {
    category,
    managerId,
    criticality: "hoch",
    processProximity: null,
    repetition: null,
    damagePotential: null,
    updatedAt: "2026-10-01T00:00:00.000Z",
    updatedBy: "admin",
  };
}

function ruhestand(userId: string, horizonMonths: 24 | 36): RetirementEntry {
  return {
    userId,
    horizonMonths,
    dueAt: retirementDueAt(NOW, horizonMonths),
    updatedAt: new Date(NOW).toISOString(),
    updatedBy: "admin",
  };
}

const BASIS: RiskHorizonInput = {
  kos: [
    ko("p1", "Presse", "rosa"),
    ko("p2", "Presse", "rosa", "offen"),
    ko("l1", "Lack", "rosa"),
    ko("l2", "Lack", "tom"),
    ko("g1", "Guss", "ida"),
  ],
  busFactor: [
    { category: "Presse", koCount: 2, authorCount: 1, singleSource: true },
    { category: "Lack", koCount: 2, authorCount: 2, singleSource: false },
    { category: "Guss", koCount: 1, authorCount: 1, singleSource: true },
  ],
  profiles: [profil("Presse", "mara"), profil("Lack", "mara"), profil("Guss", "otto")],
  retirement: [ruhestand("rosa", 24), ruhestand("tom", 36), ruhestand("ida", 36)],
  gaps: [
    { status: "offen", assignee: "rosa" },
    { status: "offen", assignee: "rosa" },
    { status: "geschlossen", assignee: "rosa" },
  ],
  viewer: { userId: "mara", seesAll: false },
  now: NOW,
};

describe("R-1639 / R-2183: Bereichsblick je Manager (Nacharbeit 3)", () => {
  it("H1 · ein Manager sieht nur seine Bereiche — fremde Bereiche und deren Träger nicht", () => {
    const v = riskHorizon(BASIS);
    expect(v.areas.map((a) => a.category)).toEqual(["Lack", "Presse"]);
    // Gegenprobe: Ida (Guss, Otto) taucht für Mara nirgends auf.
    expect(v.areas.flatMap((a) => a.bearers.map((b) => b.userId))).not.toContain("ida");
    expect(v.seesAll).toBe(false);
  });

  it("H2 · Bus-Faktor 1, Kritikalität und Träger mit Horizont und Frist je Bereich", () => {
    const presse = riskHorizon(BASIS).areas.find((a) => a.category === "Presse");
    expect(presse?.singleSource).toBe(true);
    expect(presse?.criticality).toBe("hoch");
    expect(presse?.managerId).toBe("mara");
    const [rosa] = presse?.bearers ?? [];
    expect(rosa?.userId).toBe("rosa");
    expect(rosa?.horizonMonths).toBe(24);
    expect(rosa?.dueAt).toBe("2028-10-04T00:00:00.000Z");
  });

  it("H3 · Arbeitsvorrat: einziger Träger, ungeprüfte eigene Objekte, offene zugewiesene Lücken", () => {
    const v = riskHorizon(BASIS);
    const presse = v.areas.find((a) => a.category === "Presse")?.bearers[0];
    expect(presse?.soleBearer).toBe(true);
    expect(presse?.openKoIds).toEqual(["p2"]);
    expect(presse?.koCount).toBe(2);
    expect(presse?.openGaps).toBe(2); // die geschlossene Lücke zählt nicht
    // Gegenprobe Lack: zwei Träger ⇒ kein „einziger Träger"; nach Frist geordnet (24 vor 36).
    const lack = v.areas.find((a) => a.category === "Lack")?.bearers ?? [];
    expect(lack.map((b) => b.userId)).toEqual(["rosa", "tom"]);
    expect(lack.every((b) => b.soleBearer === false)).toBe(true);
  });

  it("H4 · Träger ohne gepflegten Horizont stehen nicht im Blick; die Pflegerolle sieht alle Bereiche", () => {
    const ohneTom = riskHorizon({ ...BASIS, retirement: [ruhestand("rosa", 24)] });
    const lack = ohneTom.areas.find((a) => a.category === "Lack");
    expect(lack?.bearers.map((b) => b.userId)).toEqual(["rosa"]);
    const alle = riskHorizon({ ...BASIS, viewer: { userId: "admin", seesAll: true } });
    expect(alle.areas.map((a) => a.category)).toEqual(["Guss", "Lack", "Presse"]);
  });

  it("H6 (Nacharbeit 5) · die heutige Zugehörigkeit folgt der Frist, nicht der gepflegten Klasse", () => {
    // Derselbe unveränderte 36-Monats-Eintrag (Frist 04.10.2029) zu zwei Bezugszeiten.
    const zu = (bezug: string) =>
      riskHorizon({ ...BASIS, retirement: [ruhestand("tom", 36)], now: Date.parse(bezug) })
        .areas.find((a) => a.category === "Lack")
        ?.bearers.find((b) => b.userId === "tom");
    const heute = zu("2026-10-04T00:00:00Z");
    expect(heute?.horizonMonths).toBe(36);
    expect(heute?.currentHorizon).toBe(36);
    const spaeter = zu("2028-01-04T00:00:00Z");
    expect(spaeter?.horizonMonths, "die gepflegte Klasse bleibt erhalten").toBe(36);
    expect(spaeter?.currentHorizon, "21 Monate bis zur Frist").toBe(24);
    expect(spaeter?.dueAt, "die Frist bleibt unverändert").toBe("2029-10-04T00:00:00.000Z");
    // Grenzen: genau 24 Monate gehören dazu; eine verstrichene Frist bleibt im 24-Monats-Blick.
    expect(currentHorizonOf("2028-10-04T00:00:00.000Z", NOW)).toBe(24);
    expect(currentHorizonOf("2026-01-01T00:00:00.000Z", NOW)).toBe(24);
    expect(currentHorizonOf("2030-01-01T00:00:00.000Z", NOW)).toBeNull();
  });

  it("H5 · ohne zugeordneten Bereich ist der Blick leer, nicht der des ganzen Hauses", () => {
    const v = riskHorizon({ ...BASIS, viewer: { userId: "niemand", seesAll: false } });
    expect(v.areas).toEqual([]);
  });
});

describe("Pflege-Normalisierung (Nacharbeit 3)", () => {
  it("N1 · Bereichsprofil: Stufen und Verantwortung, leer bleibt null", () => {
    const p = normalizeCategoryProfile(
      { category: " Presse ", managerId: "mara", criticality: "hoch", repetition: "" },
      "admin",
      NOW,
    );
    expect(p).toMatchObject({
      category: "Presse",
      managerId: "mara",
      criticality: "hoch",
      processProximity: null,
      repetition: null,
      damagePotential: null,
      updatedBy: "admin",
    });
  });

  it("N2 · unbekannte Stufe, fehlende Kategorie und falscher Horizont sind Bedienfehler", () => {
    const falscheStufe = { category: "X", criticality: "extrem" };
    const ohneKategorie = { category: "  " };
    expect(() => normalizeCategoryProfile(falscheStufe, "a", NOW)).toThrow(ManagementProfileError);
    expect(() => normalizeCategoryProfile(ohneKategorie, "a", NOW)).toThrow(ManagementProfileError);
    expect(() => normalizeRetirementHorizon(12)).toThrow(ManagementProfileError);
    expect(() => normalizeRetirementHorizon(undefined)).toThrow(ManagementProfileError);
    expect(normalizeRetirementHorizon(null)).toBeNull();
    expect(normalizeRetirementHorizon(36)).toBe(36);
  });
});
