import { describe, expect, it } from "vitest";
import { befund, belege, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 — DIE GEGENPROBE ZUM KERNFALL: EINE FREMDE LÖSCHUNG BLEIBT EINE FREMDE LÖSCHUNG.
// ================================================================================================
//
// Der neue Grund `withdrawn_own` sagt: „ein Mensch hat SEIN EIGENES Wissen zurückgezogen". Löscht
// ein Controller oder Admin einen fremden Beitrag, ist das eine andere Aussage — dann steht das
// Objekt unter fremder Entscheidung, und der Befund schliesst systemisch (`participant_deleted`,
// `by: null`). Ohne diesen Fall wäre die neue Auskunft nicht belegt, sondern nur behauptet: eine
// Ableitung, die IMMER die Autorschaft schriebe, käme durch den Kernfall unbemerkt durch.
describe("JOB 3071: eine fremde Löschung schliesst weiter systemisch", () => {
  it("Admin löscht den Beitrag einer anderen → participant_deleted, by === null", async () => {
    const { services, app, admin, autorin } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    const eintrag = await befund(services, a, b);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: admin.headers,
    });
    expect(del.statusCode).toBe(204);

    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();

    // Und der Beleg bleibt der systemische.
    expect(await belege(services, "overlap.participant-removed", eintrag.id)).toHaveLength(1);
    expect(await belege(services, "overlap.withdrawn-own", eintrag.id)).toHaveLength(0);
  });
});
