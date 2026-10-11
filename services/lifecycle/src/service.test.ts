import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryLifecycleRepo } from "./repo";
import { LifecycleService, REVALIDIERUNG_ANGEFORDERT } from "./service";

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

    // produkt:20261010:aenderungsfolgen-sichtbar (Nacharbeit 4): ein offener Fall wird nur mit
    // seinem angezeigten Stand abgeschlossen.
    const confirmed = await ctx.lifecycle.confirmStillValid(ctx.ko.id, "controller", 1);
    expect(confirmed.version).toBe(2);
    expect(await ctx.lifecycle.pendingRevalidation()).not.toContain(ctx.ko.id);
  });

  it("R-0203: die Meldung über ein Objekt markiert alle Objekte an seinen Anlagen", async () => {
    const nachbar = await ctx.koService.create({
      title: "Druck prüfen",
      statement: "Vor dem Anfahren den Druck prüfen.",
      type: "technik",
      category: "Anlage 1",
      author: "bert",
    });
    const fremd = await ctx.koService.create({
      title: "Band spannen",
      statement: "Förderband nach Schichtwechsel spannen.",
      type: "technik",
      category: "Anlage 2",
      author: "bert",
    });
    await ctx.lifecycle.couple("anlage-1", ctx.ko.id);
    await ctx.lifecycle.couple("anlage-1", nachbar.id);
    await ctx.lifecycle.couple("anlage-2", fremd.id);

    const markiert = await ctx.lifecycle.neighborsChanged(ctx.ko.id);
    expect(markiert.sort()).toEqual([ctx.ko.id, nachbar.id].sort());
    const faellig = await ctx.lifecycle.pendingRevalidation();
    expect(faellig).toContain(nachbar.id);
    expect(faellig).not.toContain(fremd.id);
  });

  it("R-0203 GEGENPROBE: ohne Kopplung wird nichts markiert", async () => {
    expect(await ctx.lifecycle.neighborsChanged(ctx.ko.id)).toEqual([]);
    expect(await ctx.lifecycle.pendingRevalidation()).toEqual([]);
  });

  it("R-1732: erneute Prüfung gezielt anstossen; „Noch gültig“ räumt den Merker", async () => {
    await ctx.lifecycle.requestRevalidation(ctx.ko.id);
    expect(await ctx.lifecycle.pendingRevalidation()).toEqual([ctx.ko.id]);
    await ctx.lifecycle.confirmStillValid(ctx.ko.id, "controller", 1);
    expect(await ctx.lifecycle.pendingRevalidation()).toEqual([]);
  });

  it("R-1635: jede Markierung hinterlässt je Objekt einen Beleg mit Grund und Auslöser", async () => {
    const belege: { actor: string; action: string; target: string; payload: unknown }[] = [];
    const lifecycle = new LifecycleService({
      koService: ctx.koService,
      repo: new InMemoryLifecycleRepo(),
      audit: {
        record: async (eintrag) => {
          belege.push(eintrag);
          return eintrag;
        },
      },
    });
    const nachbar = await ctx.koService.create({
      title: "Druck prüfen",
      statement: "Vor dem Anfahren den Druck prüfen.",
      type: "technik",
      category: "Anlage 1",
      author: "bert",
    });
    await lifecycle.couple("anlage-1", ctx.ko.id);
    await lifecycle.couple("anlage-1", nachbar.id);

    await lifecycle.assetChanged("anlage-1", "carla");
    expect(belege.map((b) => [b.action, b.target, b.actor])).toEqual([
      [REVALIDIERUNG_ANGEFORDERT, ctx.ko.id, "carla"],
      [REVALIDIERUNG_ANGEFORDERT, nachbar.id, "carla"],
    ]);
    expect(belege[0]?.payload).toEqual({ grund: "anlage", assetRef: "anlage-1" });

    belege.length = 0;
    await lifecycle.neighborsChanged(ctx.ko.id, "dora");
    expect(belege.map((b) => b.target).sort()).toEqual([ctx.ko.id, nachbar.id].sort());
    expect(belege[0]?.payload).toEqual({
      grund: "nachbar",
      ausgeloestVon: ctx.ko.id,
      assetRef: "anlage-1",
    });

    belege.length = 0;
    await lifecycle.requestRevalidation(nachbar.id, "emil");
    expect(belege).toEqual([
      {
        actor: "emil",
        action: REVALIDIERUNG_ANGEFORDERT,
        target: nachbar.id,
        payload: { grund: "bibliothek" },
      },
    ]);
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
