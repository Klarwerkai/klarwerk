// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — R-1660: DIE SCHAUFENSTER-FÄLLE IM ECHTEN BESTAND.
// ================================================================================================
//
// Die Roadmap-Quelle nennt für den Schaufenster-Modus zwei Fälle: „Schweißnaht V1/V2/V3“ und
// „Lager-Fall Karl/Tom“. Dieser Test belegt ihren zusammenhängenden Ablauf an den ECHTEN Diensten,
// in der Reihenfolge, in der der Vorführweg sie zeigt:
//   1. „Demodaten laden“ (derselbe Seed, den `POST /api/admin/demo-seed` ruft),
//   2. die Schweißnaht ist EIN Objekt in drei Fassungen — Verlauf 1→2→3, Schnappschüsse der
//      früheren Stände, heutiger Stand = V3,
//   3. Toms Frage geht durch den echten Frageweg (`AskService.ask`) und wird aus Karls geprüftem
//      Eintrag beantwortet — mit Karls Eintrag als tragender Quelle, ohne Wissenslücke.
// GRENZE: hier antwortet der deterministische Rückfall des Reasoners (kein Modell). Was ein
// freigeschaltetes Modell formuliert, belegt dieser Test nicht; er belegt, dass der Bestand die
// Frage trägt und welche Quelle sie trägt.
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { DEMO_TEXTS } from "../../services/app/src/demo-content";
import { seedDemo } from "../../services/app/src/seed-demo";

const SPRACHEN = ["de", "en"] as const;

/** Ein Merkmal aus Karls Aussage, das nur dort steht (nicht in der Frage, nicht in koPresse). */
const KARLS_GRIFF = { de: "handwarm", en: "hand-warm" } as const;

async function geladen(sprache: (typeof SPRACHEN)[number]) {
  const services = buildServices();
  // Wie in `seed.test.ts`: die Standardsuche wird über den Produktpfad in Betrieb genommen.
  await services.ko.activateSearchProjectionV2();
  const ergebnis = await seedDemo(services, sprache);
  expect(ergebnis.skipped).toBe(false);
  return services;
}

describe("R-1660 · Schweißnaht V1/V2/V3 — eine Lernkurve in drei Fassungen", () => {
  for (const sprache of SPRACHEN) {
    it(`[${sprache}] ein Objekt, Verlauf 1→2→3, frühere Stände erhalten, heute V3`, async () => {
      const services = await geladen(sprache);
      const t = DEMO_TEXTS[sprache];
      const kos = await services.ko.list();
      const naht = kos.find((k) => k.title === t.koSchweiss.title);
      expect(naht, "Schweißnaht (V3) fehlt im Bestand").toBeDefined();
      if (!naht) return;
      expect(naht.version).toBe(3);
      expect(naht.type).toBe("lernkurve");
      expect(naht.statement).toBe(t.koSchweiss.statement);
      expect(naht.history.map((h) => h.version)).toEqual([1, 2, 3]);
      // Kein zweites oder drittes Objekt: V1 und V2 leben nur im Verlauf.
      const frueher = [t.koSchweissV1.title, t.koSchweissV2.title];
      expect(kos.filter((k) => frueher.includes(k.title))).toEqual([]);
      // Die Schnappschüsse der Fassungen tragen ihren damaligen Titel.
      const titel = new Map<number, string>();
      const fassungen = await services.ko.versionsOf(naht.id);
      for (const f of fassungen) titel.set(f.version, f.snapshot.title);
      expect(titel.get(2)).toBe(t.koSchweissV2.title);
      expect(titel.get(3)).toBe(t.koSchweiss.title);
      if (titel.has(1)) {
        expect(titel.get(1)).toBe(t.koSchweissV1.title);
      }
    });
  }
});

describe("R-1660 · Lager-Fall Karl/Tom — Toms Frage trifft Karls geprüftes Wissen", () => {
  for (const sprache of SPRACHEN) {
    it(`[${sprache}] Karls Eintrag ist validiert und trägt die Antwort auf Toms Frage`, async () => {
      const services = await geladen(sprache);
      const t = DEMO_TEXTS[sprache];
      const karl = (await services.ko.list()).find((k) => k.title === t.koLagerKarl.title);
      expect(karl, "Karls Lager-Fall fehlt im Bestand").toBeDefined();
      if (!karl) return;
      expect(karl.status).toBe("validiert");
      expect(karl.demoSeed).toBe(true);

      const admin = (await services.auth.listUsers()).find(
        (u) => u.email === "admin@demo.klarwerk",
      );
      expect(admin, "Demo-Admin fehlt").toBeDefined();
      const antwort = await services.ask.ask(t.lagerFrage, admin?.id, sprache);
      expect(antwort.gap, "Toms Frage endet als Wissenslücke").toBeNull();
      expect(antwort.result.answered).toBe(true);
      expect(antwort.result.sources[0], "tragende Quelle ist nicht Karls Eintrag").toBe(karl.id);
      expect(antwort.result.answer ?? "").toContain(KARLS_GRIFF[sprache]);
    });
  }
});
