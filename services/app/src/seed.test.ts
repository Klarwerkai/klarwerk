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
    // SCRUM-244: mindestens ZWEI validierte, output-fähige KOs.
    expect(r.validated).toBeGreaterThanOrEqual(2);
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
