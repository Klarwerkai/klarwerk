import { describe, expect, it } from "vitest";
import { fehlendePflichtwerte } from "../../services/app/src/start-vertrag";
import { assertPersistentStore, normalizeEnv } from "../../services/app/src/storage-guard";

// SCRUM-498 B3 (+ ben-Review-Fix): In Produktion darf die App NIE still auf InMemory/Journal starten —
// ohne DATABASE_URL (→ PgKoRepo) fiele sie auf nicht-dauerhaften, nicht quell-gebundenen Speicher
// zurück. DATABASE_URL wird an EINER Stelle normalisiert (normalizeEnv), sodass Guard-Entscheid und
// Pg-/InMemory-Verzweigung nie auseinanderlaufen.
//
// ================================================================================================
// JOB 3776 RUNDE 2 — DIE ABSAGE KOMMT JETZT VOM STARTVERTRAG, NICHT MEHR VON DIESER FUNKTION.
// ================================================================================================
//
// WAS SICH GEÄNDERT HAT UND WARUM. Bis JOB 3776 warf `assertPersistentStore` in Produktion ohne
// DATABASE_URL und ohne Override eine `StoragePersistenceError` — das war der fail-closed-Riegel.
// Seit JOB 3776 ruft `server.ts` den Startvertrag als ERSTE Anweisung von `start()`, und der führt
// `DATABASE_URL` als Pflichtwert in Produktion mit exakt derselben Ausnahme
// (`KLARWERK_ALLOW_INMEMORY_PROD=1`). Gemessen über acht Umgebungen am echten Prozess: der Vertrag
// bricht in JEDER Lage vorher ab, der Wurf wurde nie mehr erreicht. Zwei Wege zur selben Absage
// sind genau das, was Prüfpunkt 7 verbietet — der tote Weg ist deshalb entfernt (BEN, Runde 1,
// Korrekturpflicht 2).
//
// WAS BLEIBT, UND DAS IST DER KERN: Die Absage selbst ist NICHT verschwunden, sie ist umgezogen.
// Dieser Block prüft deshalb BEIDES — dass diese Funktion nicht mehr wirft UND dass der Vertrag
// genau die Lage verweigert, in der früher der Wurf stand. Fiele das auseinander, könnte Produktion
// still auf In-Memory hochkommen; der letzte Fall unten ist der Wächter dagegen.
describe("SCRUM-498 B3: normalizeEnv — eine Quelle der Wahrheit für DATABASE_URL", () => {
  it("leerer/whitespace-only String → undefined; echter Wert wird getrimmt", () => {
    expect(normalizeEnv(undefined)).toBeUndefined();
    expect(normalizeEnv("")).toBeUndefined();
    expect(normalizeEnv("   ")).toBeUndefined();
    expect(normalizeEnv("  postgres://u:p@h:5432/db  ")).toBe("postgres://u:p@h:5432/db");
  });
});

describe("JOB 3776: assertPersistentStore — warnt laut, verweigert aber nicht mehr selbst", () => {
  it("Produktion ohne DATABASE_URL und ohne Override → KEIN Wurf mehr, aber eine laute Warnung", () => {
    const entscheidung = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: undefined,
      journalActive: false,
    });
    // Der alte Weg ist weg: diese Funktion bricht den Start nicht mehr ab.
    expect(entscheidung.warning).toBeDefined();
    // Und sie schweigt auch nicht — ein stiller Durchlass wäre hier der eigentliche Schaden.
    expect(entscheidung.warning).toContain("DATABASE_URL");
    expect(entscheidung.warning).toContain("KLARWERK_ALLOW_INMEMORY_PROD");
    // Sie sagt ausserdem, WER diesen Start in Wahrheit abweist — sonst läse sich die Zeile wie ein
    // erlaubter Zustand.
    expect(entscheidung.warning).toMatch(/Startvertrag/);
  });

  it("Whitespace-only zählt weiterhin NICHT als gesetzt", () => {
    const entscheidung = assertPersistentStore({
      databaseUrl: "  ",
      nodeEnv: "production",
      allowInMemoryProd: "  ",
      journalActive: false,
    });
    expect(entscheidung.warning).toBeDefined();
    expect(entscheidung.warning).toMatch(/In-Memory/);
  });

  it("DIE ABSAGE IST NICHT WEG, SIE IST UMGEZOGEN: der Startvertrag verweigert genau diese Lage", () => {
    // Der Wächter gegen das eigentliche Risiko dieser Runde. Würde der Vertrag `DATABASE_URL`
    // künftig durchlassen, gäbe es NIEMANDEN mehr, der den Start abbricht — und Produktion käme
    // still auf In-Memory hoch. Genau dann wird dieser Fall rot.
    expect(
      fehlendePflichtwerte({
        NODE_ENV: "production",
        APP_BASE_URL: "https://demo.example",
      }),
      "Der Startvertrag verlangt DATABASE_URL in Produktion nicht mehr — seit JOB 3776 bricht damit " +
        "NICHTS mehr ab (assertPersistentStore wirft nicht mehr). Produktion liefe still auf " +
        "In-Memory: Datenverlust bei jedem Deploy, Konten eingeschlossen.",
    ).toEqual(["DATABASE_URL"]);
    // Und die benannte Ausnahme hebt sie auf — dieselbe, die unten die Override-Warnung auslöst.
    expect(
      fehlendePflichtwerte({
        NODE_ENV: "production",
        APP_BASE_URL: "https://demo.example",
        KLARWERK_ALLOW_INMEMORY_PROD: "1",
      }),
    ).toEqual([]);
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

  it("die zwei Warnungen sind unterscheidbar — bewusster Override gegen umgangenen Vertrag", () => {
    // Ohne diesen Fall könnten beide Lagen denselben Satz tragen, und der Betreiber wüsste nicht,
    // ob er selbst überstimmt hat oder ob etwas am Vertrag vorbeigelaufen ist.
    const bewusst = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: "1",
      journalActive: false,
    }).warning;
    const ohne = assertPersistentStore({
      databaseUrl: undefined,
      nodeEnv: "production",
      allowInMemoryProd: undefined,
      journalActive: false,
    }).warning;
    expect(bewusst).toBeDefined();
    expect(ohne).toBeDefined();
    expect(bewusst).not.toBe(ohne);
    expect(bewusst).not.toMatch(/Startvertrag/);
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
