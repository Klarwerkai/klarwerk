import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { funktionskatalog } from "../../services/app/src/funktionskatalog/katalog";

describe("Redaktioneller Produktkatalog", () => {
  it("enthält alle 375 Produktfunktionen des Registers und die späteren belegten Ergänzungen", () => {
    const { entries, groups } = funktionskatalog;
    const ids = new Set(entries.map((e) => e.id));
    const gruppen = new Set(groups.map((g) => g.id));
    expect(ids.size).toBe(entries.length);
    const ursprung = entries.map((e) => e.id).filter((id) => /^\d+$/.test(id));
    expect(ursprung.sort()).toEqual(
      [...Array.from({ length: 373 }, (_, i) => i + 1), 425, 426].map((n) =>
        String(n).padStart(3, "0"),
      ),
    );
    for (const e of entries) {
      expect(gruppen.has(e.group), e.id).toBe(true);
      expect(e.platforms.length, e.id).toBeGreaterThan(0);
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const feld of [
        e.title,
        e.description,
        e.input,
        e.output,
        e.scope,
        ...e.sources.map((s) => s.label),
      ]) {
        for (const sprache of ["de", "en", "nl"] as const)
          expect(feld?.[sprache]?.trim(), e.id).toBeTruthy();
      }
    }
    expect(JSON.stringify(funktionskatalog)).not.toMatch(
      /\/Users\/|\/private\/|source_id|CODEX_HOME/,
    );
  });

  it("trennt Erstumfang, spätere Betriebsstufe, Idee und tatsächlich vorgeführte Funktion", () => {
    const eintraege = new Map(funktionskatalog.entries.map((e) => [e.id, e]));
    for (const id of ["140", "235"]) expect(eintraege.get(id)?.status).toBe("excluded");
    expect(eintraege.get("193")?.status).toBe("deferred");
    expect(eintraege.get("260")?.status).toBe("idea");
    expect(eintraege.get("P01")?.sources[0].reference).toContain("05.11.2026");
    for (const id of ["425", "426"]) expect(eintraege.get(id)?.status).toBe("planned");
    expect(eintraege.get("V05")?.sources[0].reference).toContain(".1138");
    expect(eintraege.get("V05")?.title.nl).toMatch(/bron/);
    expect(eintraege.get("V04")?.platforms).toEqual(["app"]);
    expect(eintraege.get("321")?.status).toBe("available");
    expect(eintraege.get("324")?.status).not.toBe("available");
  });

  it("liefert den identischen Katalog erst nach Anmeldung mit Verwaltungsrecht aus", async () => {
    const app = buildApp(buildServices());
    const url = "/api/admin/funktionen";
    async function anmelden(email: string) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      });
      expect(res.statusCode).toBe(200);
      return { authorization: `Bearer ${res.json().token}` };
    }
    try {
      expect((await app.inject({ url })).statusCode).toBe(401);
      const registrieren = (email: string) =>
        app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Katalog Test", email, password: "secret123" },
        });
      await registrieren("katalog-admin@example.test");
      const admin = await anmelden("katalog-admin@example.test");
      const registriert = await registrieren("katalog-leser@example.test");
      await app.inject({
        method: "POST",
        url: `/api/auth/users/${registriert.json().id}/approve`,
        headers: admin,
      });
      const leser = await anmelden("katalog-leser@example.test");
      expect((await app.inject({ url, headers: leser })).statusCode).toBe(403);
      const antwort = await app.inject({ url, headers: admin });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.headers["cache-control"]).toContain("no-store");
      expect(antwort.json()).toEqual(funktionskatalog);
    } finally {
      await app.close();
    }
  });
});
