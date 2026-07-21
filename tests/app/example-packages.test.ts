// WP-B6 (Pedis Wunsch für die VIP-2-Tester): modulare Beispielpakete. Paket-Definitionen sind
// valide Daten (Konflikt-Paar-Struktur, Größenrahmen, Beispiel-Kennzeichnung), jedes Paket lädt
// fehlerfrei über die bestehenden Anlege-Wege, das Laden ist IDEMPOTENT (ehrliche Bilanz), der
// Guard greift (403 ohne users.manage), Audit wird geschrieben — und der Entfernen-Weg ist der
// BESTEHENDE Demo-Purge (demoSeed), NICHT das Import-Aufräumen (eigene Provenienz).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE_PACKAGES_ALL_KEYS } from "../../apps/web/src/lib/examplePackages";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  EXAMPLE_PACKAGES,
  EXAMPLE_PROVIDER,
  EXAMPLE_TITLE_PREFIX,
} from "../../services/app/src/example-packages";

async function adminApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

const load = (
  app: Awaited<ReturnType<typeof adminApp>>["app"],
  headers: Record<string, string>,
  pkg: string,
) =>
  app.inject({
    method: "POST",
    url: "/api/admin/examples/load",
    headers,
    payload: { package: pkg },
  });

describe("WP-B6: Paket-Definitionen sind valide Daten", () => {
  it("drei Pakete im vereinbarten Größenrahmen; Konflikt-Paare sind vollständig und gegenseitig", () => {
    expect(EXAMPLE_PACKAGES.map((p) => p.id)).toEqual(["konflikte", "bilder", "qualitaet"]);
    const byId = new Map(EXAMPLE_PACKAGES.map((p) => [p.id, p]));
    expect((byId.get("konflikte")?.kos.length ?? 0) >= 4).toBe(true);
    expect((byId.get("konflikte")?.kos.length ?? 0) <= 6).toBe(true);
    expect((byId.get("bilder")?.kos.length ?? 0) >= 3).toBe(true);
    expect((byId.get("bilder")?.kos.length ?? 0) <= 4).toBe(true);
    expect((byId.get("qualitaet")?.kos.length ?? 0) >= 4).toBe(true);
    expect((byId.get("qualitaet")?.kos.length ?? 0) <= 6).toBe(true);
    // Konflikt-Paar-Struktur: JEDER Eintrag hat einen Partner, der zurückverweist.
    const konflikte = byId.get("konflikte")?.kos ?? [];
    const byKey = new Map(konflikte.map((k) => [k.key, k]));
    for (const ko of konflikte) {
      expect(ko.conflictsWith, ko.key).toBeDefined();
      expect(byKey.get(ko.conflictsWith as string)?.conflictsWith).toBe(ko.key);
    }
    // Bilder-Paket: jeder Eintrag bringt mindestens eine Bild-Fußnote mit.
    for (const ko of byId.get("bilder")?.kos ?? []) {
      expect((ko.images?.length ?? 0) > 0, ko.key).toBe(true);
    }
  });
});

describe("WP-B6: POST /api/admin/examples/load", () => {
  it("jedes Paket lädt fehlerfrei; Beispiel-Kennzeichnung + eigene Provenienz; Bilder-Paket ist such-/galeriefähig", async () => {
    const { app, services, headers } = await adminApp();
    for (const pkg of EXAMPLE_PACKAGES) {
      const res = await load(app, headers, pkg.id);
      expect(res.statusCode, pkg.id).toBe(200);
      expect(res.json()).toEqual({ package: pkg.id, created: pkg.kos.length, skipped: 0 });
    }
    const kos = await services.ko.list();
    expect(kos.length).toBe(EXAMPLE_PACKAGES.reduce((n, p) => n + p.kos.length, 0));
    for (const ko of kos) {
      expect(ko.title.startsWith(EXAMPLE_TITLE_PREFIX)).toBe(true);
      expect(ko.sources?.[0]?.provider).toBe(EXAMPLE_PROVIDER);
      expect(ko.demoSeed).toBe(true); // Entfernen-Weg: der bestehende Demo-Purge
    }
    // Bilder-Paket: figures haben den create-Pfad überlebt (Galerie) und die Fußnoten stehen im
    // persistierten Suchfeld (Fußnoten-Suche findet sie).
    const bild = kos.find((k) => k.title.includes("Führungsschiene"));
    expect(bild?.bodyHtml).toContain("<figure>");
    expect(bild?.bodyHtml).toContain("data-image-id");
    expect((bild?.captionTexts ?? []).some((c) => c.includes("Riefen"))).toBe(true);
    expect((await services.library.search("Zugentlastung")).length).toBe(1);
    // Unbekanntes Paket → ehrlicher 400.
    const unknown = await load(app, headers, "gibt-es-nicht");
    expect(unknown.statusCode).toBe(400);
  });

  it("IDEMPOTENT: zweites Laden desselben Pakets dupliziert nichts (ehrliche Bilanz); Audit geschrieben", async () => {
    const { app, services, headers } = await adminApp();
    const first = await load(app, headers, "konflikte");
    expect(first.json()).toMatchObject({ created: 6, skipped: 0 });
    const second = await load(app, headers, "konflikte");
    expect(second.json()).toEqual({ package: "konflikte", created: 0, skipped: 6 });
    expect((await services.ko.list()).length).toBe(6);
    const audit = await services.audit.list();
    const entries = audit.filter((e) => e.action === "examples.load");
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.payload)).toEqual([
      { created: 6, skipped: 0 },
      { created: 0, skipped: 6 },
    ]);
  });

  it("KONSISTENZ zum Aufräumen: D-CLEAN zählt/entfernt Beispiele NICHT — der Demo-Purge entfernt sie", async () => {
    const { app, services, headers } = await adminApp();
    await load(app, headers, "qualitaet");
    // Import-Aufräumen (WP-D-CLEAN) sieht KEINE Import-Provenienz (Confluence/Jira) — Beispiele
    // bleiben von diesem Weg unberührt (die UI sagt das ehrlich dazu).
    expect(await services.library.importCleanupPreview()).toEqual({
      candidates: 0,
      importedKos: 0,
    });
    // Der dokumentierte Entfernen-Weg: bestehender Demo-Purge (demoSeed-Markierung).
    const purge = await app.inject({ method: "DELETE", url: "/api/admin/demo-seed", headers });
    expect(purge.statusCode).toBe(200);
    expect(await services.ko.list()).toEqual([]);
  });

  it("GUARD: ohne users.manage → 403 (nichts angelegt)", async () => {
    const { app, services } = await adminApp();
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Normalo", email: "n@x.de", password: "secret123" },
    });
    const admin = (await services.auth.listUsers()).find((u) => u.role === "admin");
    await services.auth.approveUser(
      (second.json() as { id: string }).id,
      (admin as { id: string }).id,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "n@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/examples/load",
      headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
      payload: { package: "konflikte" },
    });
    expect(res.statusCode).toBe(403);
    expect(await services.ko.list()).toEqual([]);
  });

  it("die Beispielpaket-Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of EXAMPLE_PACKAGES_ALL_KEYS) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
