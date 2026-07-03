import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryLifecycleRepo } from "./repo";
import { LifecycleService } from "./service";

async function setup() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const ko = await koService.create({
    title: "Ventil schließen",
    statement: "Bei Überdruck schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  const lifecycle = new LifecycleService({ koService, repo: new InMemoryLifecycleRepo() });
  return { koService, lifecycle, ko };
}

describe("LifecycleService", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("FR-LIF-01: Anlagenänderung markiert gekoppelte KOs, Bestätigung erzeugt Version", async () => {
    await ctx.lifecycle.couple("anlage-1", ctx.ko.id);
    const affected = await ctx.lifecycle.assetChanged("anlage-1");
    expect(affected).toEqual([ctx.ko.id]);
    expect(await ctx.lifecycle.pendingRevalidation()).toContain(ctx.ko.id);

    const confirmed = await ctx.lifecycle.confirmStillValid(ctx.ko.id, "controller");
    expect(confirmed.version).toBe(2);
    expect(await ctx.lifecycle.pendingRevalidation()).not.toContain(ctx.ko.id);
  });

  it("Audit B1: couplingsForKo liefert die gekoppelten Anlagen eines KOs (Rück-Richtung)", async () => {
    expect(await ctx.lifecycle.couplingsForKo(ctx.ko.id)).toEqual([]);
    await ctx.lifecycle.couple("anlage-1", ctx.ko.id);
    await ctx.lifecycle.couple("anlage-2", ctx.ko.id);
    expect((await ctx.lifecycle.couplingsForKo(ctx.ko.id)).sort()).toEqual([
      "anlage-1",
      "anlage-2",
    ]);
    // Fremdes KO bleibt unberührt.
    expect(await ctx.lifecycle.couplingsForKo("gibt-es-nicht")).toEqual([]);
  });

  // SCRUM-420 (Pedi 03.07.): Geister-Karten im Validierungsboard — Re-Validierungs-Einträge
  // gelöschter KOs zeigten nur eine UUID und führten ins Leere. pendingRevalidation heilt
  // sich jetzt selbst: Einträge ohne lebendes KO werden entfernt statt angezeigt.
  it("SCRUM-420: Re-Validierung gelöschter KOs verschwindet (Selbstheilung)", async () => {
    const repo = new InMemoryLifecycleRepo();
    const lifecycle = new LifecycleService({ koService: ctx.koService, repo });
    await lifecycle.couple("anlage-9", ctx.ko.id);
    await lifecycle.assetChanged("anlage-9");
    expect(await lifecycle.pendingRevalidation()).toContain(ctx.ko.id);

    await ctx.koService.delete(ctx.ko.id, "tester");
    expect(await lifecycle.pendingRevalidation()).toEqual([]);
    // Auch der Vormerk-Eintrag selbst ist aufgeräumt, nicht nur ausgeblendet.
    expect(await repo.pending()).toEqual([]);
  });

  it("FR-LIF-02: Autor-Übergabe ändert Autor, Originalautor bleibt", async () => {
    const updated = await ctx.lifecycle.transferAuthor(ctx.ko.id, "bob");
    expect(updated.author).toBe("bob");
    expect(updated.originalAuthor).toBe("anna");
  });

  it("FR-LIF-03: Lernpfad mit Fortschritt", async () => {
    const path = await ctx.lifecycle.createPath("experte", [
      { title: "Sicherheitseinweisung" },
      { title: "Erfassung üben" },
    ]);
    expect(path.steps).toHaveLength(2);
    const firstStep = path.steps[0];
    if (!firstStep) {
      throw new Error("Schritt fehlt.");
    }

    const done = await ctx.lifecycle.completeStep(path.id, "u1", firstStep.id);
    expect(done).toEqual([firstStep.id]);
    // Idempotent: erneut abhaken ändert nichts.
    await ctx.lifecycle.completeStep(path.id, "u1", firstStep.id);
    expect(await ctx.lifecycle.progress(path.id, "u1")).toHaveLength(1);

    const byRole = await ctx.lifecycle.getPath("experte");
    expect(byRole?.id).toBe(path.id);
  });
});
