import { describe, expect, it } from "vitest";
import {
  StoragePersistenceError,
  assertPersistentStore,
  normalizeEnv,
} from "../../services/app/src/storage-guard";

// SCRUM-498 B3 (+ ben-Review-Fix): In Produktion darf die App NIE still auf InMemory/Journal starten —
// ohne DATABASE_URL (→ PgKoRepo) fiele sie auf nicht-dauerhaften, nicht quell-gebundenen Speicher
// zurück. fail-closed; ein expliziter Override (KLARWERK_ALLOW_INMEMORY_PROD=1) erlaubt es bewusst mit
// lauter, PFAD-GENAUER Warnung. DATABASE_URL wird an EINER Stelle normalisiert (normalizeEnv), sodass
// Guard-Entscheid und Pg-/InMemory-Verzweigung nie auseinanderlaufen.
describe("SCRUM-498 B3: normalizeEnv — eine Quelle der Wahrheit für DATABASE_URL", () => {
  it("leerer/whitespace-only String → undefined; echter Wert wird getrimmt", () => {
    expect(normalizeEnv(undefined)).toBeUndefined();
    expect(normalizeEnv("")).toBeUndefined();
    expect(normalizeEnv("   ")).toBeUndefined();
    expect(normalizeEnv("  postgres://u:p@h:5432/db  ")).toBe("postgres://u:p@h:5432/db");
  });
});

describe("SCRUM-498 B3: assertPersistentStore — fail-closed in Produktion ohne DATABASE_URL", () => {
  it("Produktion ohne DATABASE_URL und ohne Override → fail-closed", () => {
    expect(() =>
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "production",
        allowInMemoryProd: undefined,
        journalActive: false,
      }),
    ).toThrow(StoragePersistenceError);
    // Whitespace-only zählt NICHT als gesetzt (Guard trimmt idempotent, auch wenn server.ts bereits
    // normalizeEnv nutzt).
    expect(() =>
      assertPersistentStore({
        databaseUrl: "  ",
        nodeEnv: "production",
        allowInMemoryProd: "  ",
        journalActive: false,
      }),
    ).toThrow(StoragePersistenceError);
  });

  it("die Fehlermeldung nennt Grund und Lösung (DATABASE_URL + Override)", () => {
    try {
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "production",
        allowInMemoryProd: undefined,
        journalActive: false,
      });
      throw new Error("hätte werfen müssen");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("DATABASE_URL");
      expect(msg).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
      expect(msg).toMatch(/Datenverlust|verlör|verlieren|Daten/);
    }
  });

  it("Override + InMemory (kein Journal) → Warnung: Zustand geht bei Neustart verloren", () => {
    const decision = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: "1",
      journalActive: false,
    });
    expect(decision.warning).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
    expect(decision.warning).toMatch(/In-Memory/);
    expect(decision.warning).toMatch(/Neustart\/Deploy verloren/);
  });

  it("Override + Journal (KLARWERK_DEV_PERSIST) → Warnung: übersteht Neustart, aber nicht prod-tauglich", () => {
    const decision = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: "1",
      journalActive: true,
    });
    expect(decision.warning).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
    expect(decision.warning).toMatch(/übersteht/);
    expect(decision.warning).toMatch(/nicht prod-tauglich|quell-gebunden|Volume/);
  });

  it("Produktion MIT DATABASE_URL → erlaubt, keine Warnung (Live-Pfad PgKoRepo, unverändert)", () => {
    const decision = assertPersistentStore({
      databaseUrl: "postgres://u:p@h:5432/db",
      nodeEnv: "production",
      allowInMemoryProd: undefined,
      journalActive: false,
    });
    expect(decision.warning).toBeUndefined();
  });

  it("außerhalb der Produktion (development/undefined) → In-Memory erlaubt, keine Warnung", () => {
    expect(
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: "development",
        allowInMemoryProd: undefined,
        journalActive: false,
      }).warning,
    ).toBeUndefined();
    expect(
      assertPersistentStore({
        databaseUrl: undefined,
        nodeEnv: undefined,
        allowInMemoryProd: undefined,
        journalActive: false,
      }).warning,
    ).toBeUndefined();
  });

  it("ROT-1-Konsistenz: DATABASE_URL='   ' + Override → wie server.ts (normalizeEnv → kein Pg-Pfad)", () => {
    // So verdrahtet server.ts: der normalisierte Wert speist Guard UND Verzweigung. Whitespace → undefined
    // → InMemory/Journal-Pfad, NICHT pgServices. Der Guard sieht dasselbe undefined → Override-Warnung
    // (kein "ok, Postgres"). Guard-Entscheid und Verzweigung können nicht mehr widersprechen.
    const databaseUrl = normalizeEnv("   ");
    expect(databaseUrl).toBeUndefined();
    const decision = assertPersistentStore({
      databaseUrl,
      nodeEnv: "production",
      allowInMemoryProd: "1",
      journalActive: false,
    });
    expect(decision.warning).toMatch(/In-Memory/); // InMemory-Pfad, nicht Postgres
  });
});
