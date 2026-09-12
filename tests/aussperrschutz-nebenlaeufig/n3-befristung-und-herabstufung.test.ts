// ================================================================================================
// JOB 3784 · N3 — BEFRISTUNG UND HERABSTUFUNG IM SELBEN MOMENT
// ================================================================================================
//
// Die dritte Tür. Eine Befristung auf dem letzten unbefristeten Admin ist heimtückischer als eine
// Herabstufung — sie fiele erst auf, wenn niemand mehr hereinkäme, der sie zurücknehmen könnte
// (`service.ts`, JOB 3665). Gleichzeitig mit einer Herabstufung darf sie deshalb genauso wenig
// durchkommen.
import { describe, expect, it } from "vitest";
import {
  AnhaltendesUserRepo,
  SPAETER,
  Treffpunkt,
  baueKreis,
  legeBestandAn,
  stillstand,
  unbefristeteAdmins,
} from "./aufbau";

describe("JOB 3784 N3 · Befristung gegen Herabstufung", () => {
  it("mindestens ein unbefristeter, freigegebener Admin bleibt übrig", async () => {
    const treffpunkt = new Treffpunkt(2);
    const k = baueKreis(new AnhaltendesUserRepo(treffpunkt));
    const bestand = await legeBestandAn(k);

    const laeufe = Promise.allSettled([
      k.service.setAccessExpiry(bestand.a.id, SPAETER, bestand.h.id),
      k.service.changeRole(bestand.b.id, "viewer", bestand.h.id),
    ]);
    await stillstand();
    const angekommenVorFreigabe = treffpunkt.angekommen;
    treffpunkt.freigeben();
    const [befristung, herabstufung] = await laeufe;

    const abgelehnt = [befristung, herabstufung].filter((e) => e.status === "rejected");
    expect(abgelehnt).toHaveLength(1);
    // Beide Türen tragen denselben Katalogschlüssel — kein neuer Text für den Gleichlauf.
    expect((abgelehnt[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });

    const alle = await k.service.listUsers();
    expect(unbefristeteAdmins(alle).length).toBeGreaterThanOrEqual(1);

    // Der abgewiesene Vorgang hat NICHTS geschrieben.
    if (befristung.status === "rejected") {
      expect(await k.users.findById(bestand.a.id)).toEqual(bestand.a);
    } else {
      expect(await k.users.findById(bestand.b.id)).toEqual(bestand.b);
    }

    // Auch die dritte Tür liegt in derselben Sperre: nur EINER kam an die Lesung.
    expect(angekommenVorFreigabe).toBe(1);
  });
});
