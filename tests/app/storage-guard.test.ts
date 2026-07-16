import { describe, expect, it } from "vitest";
import {
  StoragePersistenceError,
  assertPersistentStore,
} from "../../services/app/src/storage-guard";

// SCRUM-498 B3: In Produktion darf die App NIE still auf InMemory/Journal starten — ohne DATABASE_URL
// (→ PgKoRepo) fiele sie auf nicht-dauerhaften, nicht quell-gebundenen Speicher zurück. Der Guard bricht
// dann fail-closed ab; ein expliziter Override (KLARWERK_ALLOW_INMEMORY_PROD=1) erlaubt es bewusst mit
// lauter Warnung. Nicht-Produktion bleibt unverändert (In-Memory erlaubt).
describe("SCRUM-498 B3: assertPersistentStore — fail-closed in Produktion ohne DATABASE_URL", () => {
  it("Produktion ohne DATABASE_URL und ohne Override → fail-closed (auch das Journal rettet nicht)", () => {
    // Ein gesetztes KLARWERK_DEV_PERSIST-Journal zählt bewusst NICHT als prod-tauglich → hier nur der
    // Guard-relevante Zustand: kein DATABASE_URL, kein Override.
    expect(() =>
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "production",
        allowInMemoryProd: undefined,
      }),
    ).toThrow(StoragePersistenceError);
    // Leere/whitespace-Werte zählen NICHT als gesetzt.
    expect(() =>
      assertPersistentStore({
        databaseUrl: "  ",
        nodeEnv: "production",
        allowInMemoryProd: "  ",
      }),
    ).toThrow(StoragePersistenceError);
  });

  it("die Fehlermeldung nennt Grund und Lösung (DATABASE_URL + Override)", () => {
    try {
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "production",
        allowInMemoryProd: undefined,
      });
      throw new Error("hätte werfen müssen");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("DATABASE_URL");
      expect(msg).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
      expect(msg).toMatch(/Datenverlust|verlör|verlieren|Daten/);
    }
  });

  it("Produktion ohne DATABASE_URL MIT Override → erlaubt, aber laute Warnung (kein Abbruch)", () => {
    const decision = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: "1",
    });
    expect(decision.warning).toBeDefined();
    expect(decision.warning).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
    expect(decision.warning).toMatch(/In-Memory|nicht-dauerhaft/);
  });

  it("Produktion MIT DATABASE_URL → erlaubt, keine Warnung (Live-Pfad PgKoRepo, unverändert)", () => {
    const decision = assertPersistentStore({
      databaseUrl: "postgres://u:p@h:5432/db",
      nodeEnv: "production",
      allowInMemoryProd: undefined,
    });
    expect(decision.warning).toBeUndefined();
  });

  it("außerhalb der Produktion (development/undefined) → In-Memory erlaubt, keine Warnung", () => {
    expect(
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "development",
        allowInMemoryProd: undefined,
      }).warning,
    ).toBeUndefined();
    expect(
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: undefined,
        allowInMemoryProd: undefined,
      }).warning,
    ).toBeUndefined();
  });
});
