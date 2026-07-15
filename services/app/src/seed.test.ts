import { describe, expect, it } from "vitest";
import { buildServices } from "./build-app";
import { seedDemo } from "./seed";
import { purgeDemoSeed, seedDemoForAdmin } from "./seed-demo";

describe("SCRUM-156: seedDemo", () => {
  it("erzeugt die zentralen Stage-1-Mindestsignale über echte Services", async () => {
    const services = buildServices();
    const r = await seedDemo(services);

    expect(r.skipped).toBe(false);
    expect(r.users).toBeGreaterThanOrEqual(3);
    expect(r.kos).toBeGreaterThanOrEqual(5);
    // SCRUM-244: mindestens ZWEI validierte, output-fähige KOs.
    expect(r.validated).toBeGreaterThanOrEqual(2);

    // Pedi 02.07. (Positionierung): die Beta-Beispiele decken JEDE Organisationsform ab —
    // nicht nur Industrie. Kategorien vorhanden + ein validiertes nicht-industrielles Beispiel.
    const seededKos = await services.ko.list();
    const cats = new Set(seededKos.map((k) => k.category));
    for (const c of [
      "Pflege & Gesundheit",
      "Kanzlei & Beratung",
      "Verein & Ehrenamt",
      "Versicherung",
    ]) {
      expect(cats.has(c)).toBe(true);
    }
    expect(seededKos.find((k) => k.category === "Pflege & Gesundheit")?.status).toBe("validiert");

    // SCRUM-385 Teil B (PMO-TODO-0002): kuratierte Breite — JEDE der fünf Wissensarten mit
    // mindestens drei Beispielen, inkl. Schweißnaht-Lernkurve (die Demo-Lücke bleibt dabei
    // eine Lücke — Wortwahl ohne Inhaltstoken der Demo-Frage, s. seed-demo.ts).
    for (const type of [
      "bauchgefuehl",
      "best_practice",
      "lernkurve",
      "technik",
      "negativwissen",
    ] as const) {
      expect(seededKos.filter((k) => k.type === type).length, type).toBeGreaterThanOrEqual(3);
    }
    expect(
      seededKos.some((k) => k.type === "lernkurve" && /schweiß/i.test(`${k.title} ${k.statement}`)),
    ).toBe(true);
    expect(r.gaps).toBeGreaterThanOrEqual(1); // mindestens eine Wissenslücke

    // Stage-1 Produktnähe: die Wissenslücke ist eine industrielle Betriebsfrage,
    // KEIN generisches Testbeispiel (keine „Australien/Hauptstadt"-Lücke mehr).
    const gaps = await services.ask.listGaps();
    expect(gaps.some((g) => /Dosierwert|Linie L4|Schichtwechsel/.test(g.question))).toBe(true);
    expect(gaps.some((g) => /Australien|Hauptstadt/i.test(g.question))).toBe(false);
    // Industrielle Lücke ist priorisiert (wie geseedet auf „hoch").
    expect(gaps.some((g) => g.priority === "hoch")).toBe(true);

    expect(r.conflicts).toBeGreaterThanOrEqual(1); // mindestens eine Konfliktlage
    expect(r.pendingRevalidation).toBeGreaterThanOrEqual(1); // mindestens ein Revalidierungssignal
    expect(r.attachments).toBeGreaterThanOrEqual(1); // mindestens ein Anhang
    expect(r.sources).toBeGreaterThanOrEqual(1); // mindestens eine Quelle

    // Audit entsteht über echte Aktionen (nicht gefälscht): Einträge müssen existieren + verifizierbar.
    const audit = await services.audit.list();
    expect(audit.length).toBeGreaterThan(0);
    expect(await services.audit.verify()).toBe(true);

    // Es gibt sowohl validierte als auch offene KOs (Validierungsaufgabe) — und echte Trust-Varianz.
    const kos = await services.ko.list();
    expect(kos.filter((k) => k.status === "validiert").length).toBeGreaterThanOrEqual(2);
    expect(kos.some((k) => k.status === "offen")).toBe(true);
    expect(kos.some((k) => k.trust > 0 && k.trust < 100)).toBe(true); // Teil-Review (in Prüfung)

    // SCRUM-308: alle geseedeten KOs tragen den Demo-Herkunfts-Tag (sichtbar als Beispielwissen
    // markierbar); muss mit DEMO_TAG in apps/web/src/lib/demoKnowledge.ts übereinstimmen.
    expect(kos.length).toBeGreaterThan(0);
    expect(kos.every((k) => (k.tags ?? []).includes("pilot-demo"))).toBe(true);

    // SCRUM-244: mindestens ein KO trägt Quelle UND Anhang → beide Evidence-Arten sichtbar.
    const rich = kos.find((k) => (k.sources?.length ?? 0) > 0 && (k.attachments?.length ?? 0) > 0);
    expect(rich).toBeDefined();
    const evidence = await services.ko.evidenceOf((rich as { id: string }).id);
    expect(evidence.some((e) => e.kind === "source")).toBe(true);
    expect(evidence.some((e) => e.kind === "attachment")).toBe(true);
  });

  it("SCRUM-492: Showcase-Konflikte tragen kollision mit wörtlich belegten Streitwerten", async () => {
    const services = buildServices();
    await seedDemo(services);
    const open = await services.conflicts.unresolved();

    // Firmenwagenfarbe blau ↔ rot: die zentrale Gegenüberstellung fürs Board.
    const car = open.find((c) => c.detector?.kollision?.streitpunkt === "Firmenwagenfarbe");
    expect(car, "Firmenwagen-Kollision fehlt im Seed").toBeDefined();
    const k = car?.detector?.kollision;
    expect(k?.seiteA.streitwert).toBe("blau");
    expect(k?.seiteB.streitwert).toBe("Rot");
    // Ehrlichkeit: die Streitwerte stehen WÖRTLICH im jeweiligen Belegzitat (kein erfundener Wert).
    expect(car?.detector?.quotes?.a.includes("blau")).toBe(true);
    expect(car?.detector?.quotes?.b.includes("Rot")).toBe(true);
    expect(k?.seiteA.streitwertWoertlich).toBe(true);
    expect(k?.seiteB.streitwertWoertlich).toBe(true);

    // Auch der Vorwärmung-Showcase bleibt strukturiert (Regressionsschutz beider Kacheln).
    expect(
      open.some((c) => c.detector?.kollision?.streitpunkt === "Vorwärmung bei Kaltstart"),
    ).toBe(true);
  });

  it("Pedi 02.07.: purgeDemoSeed entfernt ALLE Demodaten — auch nach Tester-Bearbeitung", async () => {
    const services = buildServices();
    await seedDemo(services);
    const before = await services.ko.list({});
    const demoBefore = before.filter(
      (k) => k.demoSeed === true || (k.tags ?? []).includes("pilot-demo"),
    );
    expect(demoBefore.length).toBeGreaterThan(0);
    // Tester „verändert" ein Demo-KO und entfernt sogar den Demo-Tag → Feld-Merker bleibt.
    const victim = demoBefore.find((k) => k.demoSeed === true);
    expect(victim).toBeDefined();
    if (victim) {
      await services.ko.revise(victim.id, { title: "Vom Tester umbenannt" }, "tester");
    }
    const result = await purgeDemoSeed(services, "admin-test");
    expect(result.kos).toBe(demoBefore.length);
    const after = await services.ko.list({});
    expect(after.filter((k) => k.demoSeed === true)).toHaveLength(0);
    expect(after.filter((k) => (k.tags ?? []).includes("pilot-demo"))).toHaveLength(0);
  });

  it("Pedi 05.07.: purgeDemoSeed entfernt auch die Demo-Anwender (Demo-Domain)", async () => {
    const services = buildServices();
    await seedDemo(services); // legt admin@/carla@/erik@demo.klarwerk an
    // Realer Admin, damit der Demo-Admin nicht als letzter aktiver Admin geschützt bleibt.
    const real = await services.auth.register({
      name: "Echter Admin",
      email: "real@firma.example",
      password: "real-admin-pass-123",
    });
    const demoAdmin = (await services.auth.listUsers()).find(
      (u) => u.email === "admin@demo.klarwerk",
    );
    expect(demoAdmin).toBeDefined();
    if (demoAdmin) {
      await services.auth.approveUser(real.id, demoAdmin.id);
      await services.auth.changeRole(real.id, "admin", demoAdmin.id);
    }

    const result = await purgeDemoSeed(services, real.id);
    // admin@ + carla@ + erik@demo.klarwerk
    expect(result.users).toBeGreaterThanOrEqual(3);
    const remaining = await services.auth.listUsers();
    expect(remaining.some((u) => u.email.toLowerCase().endsWith("@demo.klarwerk"))).toBe(false);
    // Der reale (ausführende) Admin bleibt bestehen.
    expect(remaining.some((u) => u.id === real.id)).toBe(true);
  });

  it("Pedi 05.07. (Beta): force lädt Demo-Set trotz vorhandener Daten, ohne echte Daten zu verlieren", async () => {
    const services = buildServices();
    // Realer Admin richtet ein und erfasst ein EIGENES (echtes) Wissensobjekt.
    const admin = await services.auth.register({
      name: "Echter Admin",
      email: "real@firma.example",
      password: "real-admin-pass-123",
    });
    const realKo = await services.ko.create({
      title: "Echtes Betriebswissen",
      statement: "Von einem echten Anwender erfasst — darf nie durch Demo-Aktionen verschwinden.",
      type: "technik",
      category: "Eigene Erfassung",
      author: admin.id,
      confidence: 50,
      neededValidations: 2,
    });

    // Ohne force: übersprungen, weil die Instanz nicht leer ist.
    const skipped = await seedDemoForAdmin(services, admin.id);
    expect(skipped.skipped).toBe(true);
    expect((await services.ko.list()).some((k) => k.id === realKo.id)).toBe(true);

    // Mit force: Demo-Set wird geladen; das echte KO bleibt erhalten.
    const forced = await seedDemoForAdmin(services, admin.id, { force: true });
    expect(forced.skipped).toBe(false);
    const demoAfterFirst = (await services.ko.list()).filter((k) =>
      (k.tags ?? []).includes("pilot-demo"),
    ).length;
    expect(demoAfterFirst).toBeGreaterThanOrEqual(5);
    expect((await services.ko.list()).some((k) => k.id === realKo.id)).toBe(true);

    // Zweiter force-Lauf verdoppelt das Demo-Set NICHT (erst aufräumen, dann frisch seeden).
    const forced2 = await seedDemoForAdmin(services, admin.id, { force: true });
    expect(forced2.skipped).toBe(false);
    const demoAfterSecond = (await services.ko.list()).filter((k) =>
      (k.tags ?? []).includes("pilot-demo"),
    ).length;
    expect(demoAfterSecond).toBe(demoAfterFirst);
    // Und das echte KO ist weiterhin da.
    expect((await services.ko.list()).some((k) => k.id === realKo.id)).toBe(true);
  });

  it("ist idempotent: zweiter Lauf überspringt, keine Duplikate", async () => {
    const services = buildServices();
    const first = await seedDemo(services);
    const before = (await services.ko.list()).length;

    const second = await seedDemo(services);
    expect(second.skipped).toBe(true);
    expect((await services.ko.list()).length).toBe(before);
    expect(first.kos).toBe(before);
  });
});
