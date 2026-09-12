// ================================================================================================
// JOB 3784 · N2 — HERABSTUFUNG UND LÖSCHUNG IM SELBEN MOMENT
// ================================================================================================
//
// Die naheliegende Halbheit ist, nur `changeRole` abzusichern. Genau die hat JOB 3665 R3 schon
// einmal ausdrücklich ausgeschlossen (`service.ts`: „hätte die Instanz an zwei von drei Türen
// weiter aussperrbar gelassen"). Dieser Fall stellt die zweite Tür daneben: eine Herabstufung
// gegen eine Löschung.
import { describe, expect, it } from "vitest";
import {
  AnhaltendesUserRepo,
  Treffpunkt,
  baueKreis,
  legeBestandAn,
  stillstand,
  unbefristeteAdmins,
} from "./aufbau";

describe("JOB 3784 N2 · Herabstufung gegen Löschung", () => {
  it("einer gewinnt, der andere wird abgewiesen — und ein abgewiesenes Löschen löscht nichts", async () => {
    const treffpunkt = new Treffpunkt(2);
    const k = baueKreis(new AnhaltendesUserRepo(treffpunkt));
    const bestand = await legeBestandAn(k);

    const laeufe = Promise.allSettled([
      k.service.changeRole(bestand.a.id, "viewer", bestand.h.id),
      k.service.deleteUser(bestand.b.id, bestand.h.id),
    ]);
    await stillstand();
    const angekommenVorFreigabe = treffpunkt.angekommen;
    treffpunkt.freigeben();
    const [herabstufung, loeschung] = await laeufe;

    const abgelehnt = [herabstufung, loeschung].filter((e) => e.status === "rejected");
    expect(abgelehnt).toHaveLength(1);
    expect((abgelehnt[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "FORBIDDEN",
      message: loeschung.status === "rejected" ? "LAST_ADMIN_DELETION" : "LAST_ADMIN_DEMOTION",
    });

    // War die Löschung die abgewiesene, existiert B noch — unverändert.
    if (loeschung.status === "rejected") {
      expect(await k.users.findById(bestand.b.id)).toEqual(bestand.b);
    }

    const alle = await k.service.listUsers();
    expect(unbefristeteAdmins(alle)).toHaveLength(1);

    // Nur EINER kam an die Lesung — die zweite Tür liegt in derselben Sperre wie die erste.
    expect(angekommenVorFreigabe).toBe(1);
  });
});
