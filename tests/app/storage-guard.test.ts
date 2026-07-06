import { describe, expect, it } from "vitest";
import {
  StoragePersistenceError,
  assertPersistentStore,
} from "../../services/app/src/storage-guard";

// Betriebssicherheit (06.07.): In Produktion darf die App NIE still In-Memory starten — sonst
// gehen bei jedem Neustart/Deploy alle Daten (inkl. Konten) verloren. Der Guard bricht dann laut ab.
describe("assertPersistentStore — kein stiller In-Memory-Betrieb in Produktion", () => {
  it("wirft in Produktion ohne DATABASE_URL und ohne Journal", () => {
    expect(() =>
      assertPersistentStore({ databaseUrl: undefined, journal: undefined, nodeEnv: "production" }),
    ).toThrow(StoragePersistenceError);
    // leere/whitespace-Werte zählen NICHT als gesetzt
    expect(() =>
      assertPersistentStore({ databaseUrl: "  ", journal: "", nodeEnv: "production" }),
    ).toThrow(StoragePersistenceError);
  });

  it("die Fehlermeldung nennt den Grund und die Lösung (DATABASE_URL)", () => {
    try {
      assertPersistentStore({ databaseUrl: undefined, journal: undefined, nodeEnv: "production" });
      throw new Error("hätte werfen müssen");
    } catch (e) {
      expect((e as Error).message).toContain("DATABASE_URL");
      expect((e as Error).message).toMatch(/verlör|Datenverlust|verlöre|verlieren|Daten/);
    }
  });

  it("erlaubt Produktion MIT Postgres (DATABASE_URL) oder MIT Dev-Journal", () => {
    expect(() =>
      assertPersistentStore({
        databaseUrl: "postgres://u:p@h:5432/db",
        journal: undefined,
        nodeEnv: "production",
      }),
    ).not.toThrow();
    expect(() =>
      assertPersistentStore({
        databaseUrl: undefined,
        journal: "/repo/.localdb/state.jsonl",
        nodeEnv: "production",
      }),
    ).not.toThrow();
  });

  it("erlaubt In-Memory außerhalb der Produktion (lokale Entwicklung/Tests)", () => {
    expect(() =>
      assertPersistentStore({ databaseUrl: undefined, journal: undefined, nodeEnv: "development" }),
    ).not.toThrow();
    expect(() =>
      assertPersistentStore({ databaseUrl: undefined, journal: undefined, nodeEnv: undefined }),
    ).not.toThrow();
  });
});
