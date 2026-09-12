// ================================================================================================
// JOB 3784 · N6 — DER SEQUENZIELLE BESTAND ÄNDERT SICH NICHT
// ================================================================================================
//
// Dieser Fall ist heute grün und muss grün bleiben. Er ist die Kalibrierung der übrigen fünf: eine
// Sperre, die den Gleichlauf schliesst und dabei die drei bekannten Ablehnungen oder die
// Nutzerliste beschädigt, hätte den Fehler nur verschoben.
//
// BESONDERS `listUsers`: sie liest weiterhin über `list()` und liefert ALLE Konten. Die neue,
// verengte Lesung des Aussperrschutzes (`listAdminsForGuard`, nur Admins) darf sie nicht ersetzen —
// sonst verschwänden in der Admin-Verwaltung alle Nicht-Admins von der Fläche.
import { describe, expect, it } from "vitest";
import { SPAETER, baueKreis, konto } from "./aufbau";

describe("JOB 3784 N6 · die drei bekannten Ablehnungen und die vollständige Nutzerliste", () => {
  it("herabstufen, löschen und befristen des letzten unbefristeten Admins werfen unverändert", async () => {
    const k = baueKreis();
    const a = konto("a");
    const h = konto("h", { accessExpiresAt: SPAETER });
    const gast = konto("gast", { role: "experte", approved: false });
    for (const eintrag of [a, h, gast]) {
      await k.users.insert({ ...eintrag });
    }

    await expect(k.service.changeRole(a.id, "viewer", h.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });
    await expect(k.service.deleteUser(a.id, h.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DELETION",
    });
    await expect(k.service.setAccessExpiry(a.id, SPAETER, h.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });

    // Nach drei Ablehnungen steht das Konto unverändert da.
    expect(await k.users.findById(a.id)).toEqual(a);
  });

  it("`listUsers` liefert ALLE Konten, nicht nur die Admins", async () => {
    const k = baueKreis();
    const a = konto("a");
    const gast = konto("gast", { role: "experte", approved: false });
    const viewer = konto("viewer", { role: "viewer" });
    for (const eintrag of [a, gast, viewer]) {
      await k.users.insert({ ...eintrag });
    }

    const alle = await k.service.listUsers();
    expect(alle.map((u) => u.id).sort()).toEqual(["a", "gast", "viewer"]);
  });

  it("die zulässigen Vorgänge bleiben zulässig — Befristung setzen und wieder nehmen", async () => {
    const k = baueKreis();
    const a = konto("a");
    const b = konto("b");
    for (const eintrag of [a, b]) {
      await k.users.insert({ ...eintrag });
    }

    // Zwei unbefristete Admins: EINEN zu befristen ist erlaubt, es bleibt ja einer übrig.
    const befristet = await k.service.setAccessExpiry(b.id, SPAETER, a.id);
    expect(befristet.accessExpiresAt).toBe(SPAETER);

    // Und das NEHMEN einer Befristung kann niemanden aussperren — es bleibt ungeprüft erlaubt.
    const wiederFrei = await k.service.setAccessExpiry(b.id, undefined, a.id);
    expect(wiederFrei.accessExpiresAt).toBeUndefined();
  });
});
