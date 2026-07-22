import { afterEach, describe, expect, it, vi } from "vitest";
import { guardedLocalPgTestUrl } from "./pg-test-guard";

// WP-SHIP8-CLOSE-6 (bens GELB): die destruktive Pg-Suite darf NIE eine echte DB treffen — die
// Freigabelogik läuft deshalb im schnellen Gate (die Integrationssuiten selbst brauchen Docker/PG).
describe("guardedLocalPgTestUrl — harte Sicherung der destruktiven Pg-Integrationssuite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ohne KLARWERK_PG_TEST_URL: keine lokale Instanz (undefined, kein Log)", () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(guardedLocalPgTestUrl({})).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("Datenbankname enthält test (case-insensitiv) → freigegeben, auch als Socket-URL", () => {
    expect(
      guardedLocalPgTestUrl({
        KLARWERK_PG_TEST_URL: "postgres://u:p@localhost:5432/klarwerk_test",
      }),
    ).toBe("postgres://u:p@localhost:5432/klarwerk_test");
    expect(
      guardedLocalPgTestUrl({
        KLARWERK_PG_TEST_URL: "postgres://postgres@/klarwerk_TEST?host=/tmp/klarwerk-pgsock",
      }),
    ).toBe("postgres://postgres@/klarwerk_TEST?host=/tmp/klarwerk-pgsock");
  });

  it("Datenbankname OHNE test → abgelehnt mit Klartext-Grund auf stderr", () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(
      guardedLocalPgTestUrl({ KLARWERK_PG_TEST_URL: "postgres://u:p@db.prod.local:5432/klarwerk" }),
    ).toBeUndefined();
    const logged = warnSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(logged).toContain("ÜBERSPRUNGEN");
    expect(logged).toContain("klarwerk");
    expect(logged).toContain("KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1");
  });

  it("unlesbare URL → abgelehnt (nie ein stiller Lauf gegen Unbekanntes)", () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(guardedLocalPgTestUrl({ KLARWERK_PG_TEST_URL: "kein-url" })).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1 → ausdrücklich freigegeben, auch ohne test im Namen", () => {
    expect(
      guardedLocalPgTestUrl({
        KLARWERK_PG_TEST_URL: "postgres://u:p@localhost:5432/klarwerk",
        KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE: "1",
      }),
    ).toBe("postgres://u:p@localhost:5432/klarwerk");
  });
});
