// ================================================================================================
// JOB 3784 · N5 — DIE SPERRE ÖFFNET SICH NACH EINER ABLEHNUNG
// ================================================================================================
//
// Die naheliegende Halbheit beim Bau der Speicher-Sperre ist, die Promise-Kette nur im Erfolgsfall
// weiterzureichen. Sie sieht in allen Erfolgsfällen richtig aus — und lässt die Instanz nach der
// ERSTEN berechtigten Ablehnung stehen: jede weitere Verwaltungsaktion wartet dann für immer auf
// eine Sperre, die nie wieder aufgeht. Aus einem Aussperrschutz würde eine Aussperrung.
//
// Vorbild und Gegenstück ist der Kommentar an `search-projection-repo.ts`
// (`withExclusiveControlLock`): „Die Kette wird IMMER weitergereicht — auch wenn `fn` wirft."
import { describe, expect, it } from "vitest";
import { SPAETER, baueKreis, konto, mitFrist } from "./aufbau";

describe("JOB 3784 N5 · nach einer Ablehnung läuft der nächste zulässige Vorgang normal", () => {
  it("die abgelehnte Herabstufung hält die Sperre nicht fest", async () => {
    const k = baueKreis();
    // Genau EIN unbefristeter Admin: jede Berührung von `a` wird abgewiesen.
    const a = konto("a");
    const h = konto("h", { accessExpiresAt: SPAETER });
    const gast = konto("gast", { role: "experte" });
    const zweiter = konto("zweiter", { role: "experte" });
    for (const eintrag of [a, h, gast, zweiter]) {
      await k.users.insert({ ...eintrag });
    }

    await expect(k.service.changeRole(a.id, "viewer", h.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });

    // Erster zulässiger Vorgang danach: läuft er nicht durch, ist die Sperre nach der Ablehnung zu.
    const danach = await mitFrist(k.service.changeRole(gast.id, "controller", h.id));
    expect(danach.role).toBe("controller");

    // Und ein zweiter, über eine andere Tür — die Kette trägt weiter, nicht nur einmal.
    await mitFrist(k.service.deleteUser(zweiter.id, h.id));
    expect(await k.users.findById(zweiter.id)).toBeUndefined();

    // Der Schutz selbst steht danach unverändert.
    await expect(k.service.deleteUser(a.id, h.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DELETION",
    });
  });
});
