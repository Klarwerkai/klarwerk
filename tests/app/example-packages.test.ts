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
      // WP-SAMMEL21 (Fix 1): die Bilanz trägt zusätzlich die Konflikt-Zähler (nur das
      // konflikte-Paket erzeugt welche — drei Paare; sonst 0/0/0).
      expect(res.json()).toEqual({
        package: pkg.id,
        created: pkg.kos.length,
        skipped: 0,
        conflicts: {
          created: pkg.id === "konflikte" ? 3 : 0,
          skipped: 0,
          failed: 0,
        },
      });
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
    expect(second.json()).toEqual({
      package: "konflikte",
      created: 0,
      skipped: 6,
      conflicts: { created: 0, skipped: 3, failed: 0 },
    });
    expect((await services.ko.list()).length).toBe(6);
    const audit = await services.audit.list();
    const entries = audit.filter((e) => e.action === "examples.load");
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.payload)).toEqual([
      { created: 6, skipped: 0, conflicts: { created: 3, skipped: 0, failed: 0 } },
      { created: 0, skipped: 6, conflicts: { created: 0, skipped: 3, failed: 0 } },
    ]);
  });

  // WP-SAMMEL21-FIX (bens Fix 1, ROT — Pflicht-Pin in bens Formulierung): das Laden des
  // Konflikt-Pakets ergibt EXAKT drei unresolved Konflikte mit den richtigen KO-Paaren;
  // ein zweites Laden lässt sie unverändert bei drei (stabiler Paar-Anker, keine Duplikate).
  it("PFLICHT-PIN: Konflikt-Paket → EXAKT drei unresolved Konflikte mit den richtigen KO-Paaren; zweites Laden → unverändert drei", async () => {
    const { app, services, headers } = await adminApp();
    const first = await load(app, headers, "konflikte");
    expect(first.statusCode).toBe(200);
    const open = await services.conflicts.unresolved();
    expect(open.length).toBe(3);
    // Die richtigen Paare: je Konflikt verweisen koA/koB auf die beiden Partner-KOs des Paars.
    const kos = await services.ko.list();
    const idByKey = new Map(
      kos.map((k) => [k.sources?.[0]?.externalId?.replace("beispiel-konflikte-", ""), k.id]),
    );
    const pair = (a: string, b: string) =>
      open.find(
        (c) =>
          (c.koA === idByKey.get(a) && c.koB === idByKey.get(b)) ||
          (c.koA === idByKey.get(b) && c.koB === idByKey.get(a)),
      );
    expect(pair("anzug-a", "anzug-b")).toBeDefined();
    expect(pair("kuehl-a", "kuehl-b")).toBeDefined();
    expect(pair("schmier-a", "schmier-b")).toBeDefined();
    // Echte Board-Konflikte: origin auto (createAuto-Muster wie der Demo-Seed), Status offen.
    for (const c of open) {
      expect(c.origin).toBe("auto");
      expect(c.status).toBe("offen");
    }
    // Zweites Laden: weder KO- noch Konflikt-Duplikate.
    const second = await load(app, headers, "konflikte");
    expect(second.statusCode).toBe(200);
    expect((await services.conflicts.unresolved()).length).toBe(3);
    expect((await services.ko.list()).length).toBe(6);
  });

  // WP-SAMMEL21-FIX (bens GELB, Idempotenz-Atomik): check-then-create ist per catch-and-recheck
  // gehärtet — ein werfendes createAuto kippt den Lauf nicht, die Teilbilanz bleibt ehrlich.
  it("TEILBILANZ: wirft createAuto, zählt das Paar als failed (bzw. skipped, wenn es parallel doch entstand)", async () => {
    const { app, services, headers } = await adminApp();
    const realCreateAuto = services.conflicts.createAuto.bind(services.conflicts);
    // Fall A: EIN Paar scheitert wirklich (nichts angelegt) → failed:1, die anderen laufen weiter.
    let failNext = true;
    services.conflicts.createAuto = async (input, detector, actor) => {
      if (failNext) {
        failNext = false;
        throw new Error("Konflikt-Repo nicht erreichbar");
      }
      return realCreateAuto(input, detector, actor);
    };
    const res = await load(app, headers, "konflikte");
    expect(res.statusCode).toBe(200);
    expect((res.json() as { conflicts: unknown }).conflicts).toEqual({
      created: 2,
      skipped: 0,
      failed: 1,
    });
    expect((await services.conflicts.unresolved()).length).toBe(2);
    // Fall B (catch-and-recheck): createAuto legt an UND wirft (Parallel-Lauf-Simulation) —
    // der Recheck findet das Paar und zählt ehrlich skipped statt failed.
    services.conflicts.createAuto = async (input, detector, actor) => {
      const created = await realCreateAuto(input, detector, actor);
      void created;
      throw new Error("Antwort ging verloren (Parallelkonflikt)");
    };
    const retry = await load(app, headers, "konflikte");
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as { conflicts: unknown }).conflicts).toEqual({
      created: 0,
      skipped: 3,
      failed: 0,
    });
    expect((await services.conflicts.unresolved()).length).toBe(3);
  });

  it("KONSISTENZ zum Aufräumen: D-CLEAN zählt/entfernt Beispiele NICHT — der Demo-Purge entfernt sie", async () => {
    const { app, services, headers } = await adminApp();
    await load(app, headers, "qualitaet");
    // Import-Aufräumen (WP-D-CLEAN) sieht KEINE Import-Provenienz (Confluence/Jira) — Beispiele
    // bleiben von diesem Weg unberührt (die UI sagt das ehrlich dazu).
    // (Digest reist seit WP-SHIP8-FIX F2 mit — hier zählt nur der leere Umfang.)
    expect(await services.library.importCleanupPreview()).toMatchObject({
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
