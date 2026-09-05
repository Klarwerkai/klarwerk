import { describe, expect, it } from "vitest";
import { befund, belege, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 · KERNFALL — WER SEINEN EIGENEN BEITRAG ZURÜCKZIEHT, STEHT MIT NAMEN IM BEFUND.
// ================================================================================================
//
// Bis hierher schloss ein Rückzug den offenen Dublettenbefund wie ein Serverlauf: Grund
// `participant_deleted`, Entscheider `by: null` — niemand. Danach stand in Befund, Audit und jeder
// späteren Auskunft eine Unwahrheit über den Vorgang: es war die Entscheidung eines Menschen über
// SEIN EIGENES Wissen, und sie war im Protokoll nicht wiederzufinden.
//
// WARUM DIESER FALL ÜBER DIE ECHTE HTTP-ROUTE LÄUFT und nicht über den Dienst allein: der Nachlauf
// der Löschroute (ko-routes.ts:1683-1688) läuft NACH `ko.delete`. Zu diesem Zeitpunkt liegt das
// Objekt bereits im Papierkorb, und `KoService.get` liefert getrashte Objekte grundsätzlich nicht
// (service.ts:2753-2756). Eine Ableitung, die über `ko.get` fragte, bekäme `undefined` und fiele
// still auf den alten Grund zurück — gebaut und wirkungslos. Nur der Lauf über die Route misst
// diese Reihenfolgefalle mit.
describe("JOB 3071: die eigene Rücknahme trägt den Namen der Autorin", () => {
  it("Autorin löscht ihren eigenen Beitrag → withdrawn_own mit ihrer Kennung", async () => {
    const { services, app, autorin } = await welt();
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
    expect(eintrag.status).toBe("offen");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("withdrawn_own");
    expect(stored?.resolution?.by).toBe(autorin.id);
    expect(stored?.resolution?.note).toBeNull();
  });

  it("der Beleg unterscheidet den Rückzug vom Serverlauf — genau einer je Befund", async () => {
    const { services, app, autorin } = await welt();
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
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const zurueckgezogen = await belege(services, "overlap.withdrawn-own", eintrag.id);
    expect(zurueckgezogen).toHaveLength(1);
    expect(zurueckgezogen[0]?.actor).toBe(autorin.id);
    expect(zurueckgezogen[0]?.payload).toMatchObject({ koId: a });
    // Und der systemische Beleg entsteht für diesen Vorgang NICHT mehr.
    expect(await belege(services, "overlap.participant-removed", eintrag.id)).toHaveLength(0);
  });
});
