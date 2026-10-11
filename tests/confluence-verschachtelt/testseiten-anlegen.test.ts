// R-1126 / R-1800 (E6): das Werkzeug, das die verschachtelten Testseiten in einer echten
// Confluence-Testinstanz anlegt — gegen einen aufgezeichneten fetch, ohne Netz.
import { describe, expect, it } from "vitest";
import { BAUM } from "./bereich";
import { PRAEFIX, legeTestseitenAn, planeTestseiten } from "./testseiten-anlegen";

describe("E6 · Testseiten anlegen", () => {
  it("der Plan legt Eltern vor Kindern an und macht Titel je Space eindeutig", () => {
    const plan = planeTestseiten();
    expect(plan).toHaveLength(BAUM.length);
    const position = new Map(plan.map((s, i) => [s.fixtureId, i]));
    for (const s of plan) {
      if (s.elternFixtureId) {
        expect(position.get(s.elternFixtureId)).toBeLessThan(position.get(s.fixtureId) ?? -1);
      }
      expect(s.titel.startsWith(PRAEFIX)).toBe(true);
    }
    const titel = plan.map((s) => s.titel);
    expect(new Set(titel).size).toBe(titel.length);
    expect(titel).toContain(`${PRAEFIX}Wartung (Linie B)`);
    expect(titel).toContain(`${PRAEFIX}Checkliste (Linie A / Wartung)`);
    expect(titel).toContain(`${PRAEFIX}Checkliste (Linie B / Wartung)`);
  });

  it("sendet je Seite ein POST mit Elternteil, Labels und Gruppenrestriktion — nur an die eine Adresse", async () => {
    const aufrufe: { url: string; body: unknown; redirect?: string | undefined }[] = [];
    let naechste = 5000;
    const fetchFn = (async (url: string, init: RequestInit) => {
      aufrufe.push({ url, body: JSON.parse(String(init.body)), redirect: init.redirect });
      const id = url.endsWith("/rest/api/content") ? String(naechste++) : undefined;
      return { ok: true, status: 200, json: async () => (id ? { id } : {}) } as Response;
    }) as unknown as typeof fetch;

    const { angelegt } = await legeTestseitenAn(planeTestseiten(), {
      baseUrl: "https://baader-test.atlassian.net/wiki",
      spaceKey: "E6",
      authorization: "Bearer x",
      fetchFn,
    });

    expect(angelegt).toHaveLength(BAUM.length);
    expect(aufrufe.every((a) => a.url.startsWith("https://baader-test.atlassian.net/wiki/"))).toBe(
      true,
    );
    expect(aufrufe.every((a) => a.redirect === "error")).toBe(true);
    const neueId = new Map(angelegt.map((a) => [a.fixtureId, a.confluenceId]));
    const seiten = aufrufe.filter((a) => a.url.endsWith("/rest/api/content"));
    const schmierplan = seiten.find(
      (a) => (a.body as { title: string }).title === `${PRAEFIX}Schmierplan`,
    );
    expect((schmierplan?.body as { ancestors: { id: string }[] }).ancestors).toEqual([
      { id: neueId.get("1111") },
    ]);
    const restriktionen = aufrufe.filter((a) => a.url.endsWith("/restriction"));
    expect(restriktionen).toHaveLength(BAUM.filter((s) => s.gruppe).length);
    expect(aufrufe.filter((a) => a.url.endsWith("/label")).length).toBe(
      BAUM.filter((s) => (s.labels ?? []).length > 0).length,
    );
  });

  it("verweigert http ohne einen einzigen Aufruf", async () => {
    let aufgerufen = false;
    const fetchFn = (async () => {
      aufgerufen = true;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    await expect(
      legeTestseitenAn(planeTestseiten(), {
        baseUrl: "http://intern.example/wiki",
        spaceKey: "E6",
        authorization: "Bearer x",
        fetchFn,
      }),
    ).rejects.toThrow(/https/);
    expect(aufgerufen).toBe(false);
  });
});
