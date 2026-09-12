// ================================================================================================
// JOB 3784 · N1 — ZWEI HERABSTUFUNGEN IM SELBEN MOMENT
// ================================================================================================
//
// Der Fall, den Pedi bei der Vorführung nicht erleben soll: zwei Administratoren stufen im selben
// Moment je einen anderen Admin herab. Beide lesen dieselbe Liste mit zwei unbefristeten Admins,
// beide halten sich für erlaubt, beide schreiben — danach hat die Instanz keinen Verwaltungszugang
// mehr, und niemand kann sich selbst wieder hereinlassen.
//
// GEMESSEN WIRD DAS ERGEBNIS, NICHT DIE BAUART: wie viele unbefristete, freigegebene Admins nach
// beiden Vorgängen übrig sind. Ob dabei `withPgTx` im Diff steht, sagt darüber nichts.
import { describe, expect, it } from "vitest";
import {
  AnhaltendesUserRepo,
  Treffpunkt,
  baueKreis,
  legeBestandAn,
  stillstand,
  unbefristeteAdmins,
} from "./aufbau";

describe("JOB 3784 N1 · zwei gleichzeitige Herabstufungen können die Instanz nicht aussperren", () => {
  it("genau eine gewinnt, die andere liest denselben Satz wie bei sequenzieller Arbeit", async () => {
    const treffpunkt = new Treffpunkt(2);
    const k = baueKreis(new AnhaltendesUserRepo(treffpunkt));
    const bestand = await legeBestandAn(k);

    // Beide Vorgänge starten, bevor einer von ihnen geschrieben hat.
    const laeufe = Promise.allSettled([
      k.service.changeRole(bestand.a.id, "viewer", bestand.h.id),
      k.service.changeRole(bestand.b.id, "viewer", bestand.h.id),
    ]);
    await stillstand();
    // Die Zahl der Ankünfte IST der Befund: kommen beide an die Lesung, gibt es keine Sperre.
    const angekommenVorFreigabe = treffpunkt.angekommen;
    treffpunkt.freigeben();
    const ergebnisse = await laeufe;

    const abgelehnt = ergebnisse.filter((e) => e.status === "rejected");
    expect(abgelehnt).toHaveLength(1);
    expect((abgelehnt[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });

    const alle = await k.service.listUsers();
    expect(unbefristeteAdmins(alle)).toHaveLength(1);

    // Das Konto des Abgewiesenen ist unverändert — keine halbe Schreibung, kein stiller Vermerk.
    const abgewiesenesKonto = ergebnisse[0].status === "rejected" ? bestand.a : bestand.b;
    expect(await k.users.findById(abgewiesenesKonto.id)).toEqual(abgewiesenesKonto);

    // Die Bauart hinter dem Ergebnis: nur EINER kam überhaupt an die Lesung. Kämen beide an,
    // gäbe es keine Sperre — dann wäre das Ergebnis oben nur Glück der Reihenfolge.
    expect(angekommenVorFreigabe).toBe(1);
  });
});
