import { describe, expect, it } from "vitest";
import { buildServices } from "./build-app";
import { seedDemo } from "./seed";

describe("SCRUM-156: seedDemo", () => {
  it("erzeugt die zentralen Stage-1-Mindestsignale über echte Services", async () => {
    const services = buildServices();
    const r = await seedDemo(services);

    expect(r.skipped).toBe(false);
    expect(r.users).toBeGreaterThanOrEqual(3);
    expect(r.kos).toBeGreaterThanOrEqual(5);
    expect(r.validated).toBeGreaterThanOrEqual(1); // mindestens ein validiertes KO
    expect(r.gaps).toBeGreaterThanOrEqual(1); // mindestens eine Wissenslücke
    expect(r.conflicts).toBeGreaterThanOrEqual(1); // mindestens eine Konfliktlage
    expect(r.pendingRevalidation).toBeGreaterThanOrEqual(1); // mindestens ein Revalidierungssignal
    expect(r.attachments).toBeGreaterThanOrEqual(1); // mindestens ein Anhang/Quelle

    // Audit entsteht über echte Aktionen (nicht gefälscht): Einträge müssen existieren + verifizierbar.
    const audit = await services.audit.list();
    expect(audit.length).toBeGreaterThan(0);
    expect(await services.audit.verify()).toBe(true);

    // Es gibt sowohl ein validiertes als auch ein offenes KO (Validierungsaufgabe).
    const kos = await services.ko.list();
    expect(kos.some((k) => k.status === "validiert")).toBe(true);
    expect(kos.some((k) => k.status === "offen")).toBe(true);
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
