import { describe, expect, it } from "vitest";
import { befund, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 — EINE GETROFFENE ENTSCHEIDUNG WIRD NICHT NACHTRÄGLICH UMGESCHRIEBEN.
// ================================================================================================
//
// `onKoRemoved` war schon vor diesem Auftrag idempotent gegenüber bereits geschlossenen Einträgen
// (das mengenbasierte `closeOpenForKo` fasst nur an, was NICHT geschlossen ist). Der neue Grund
// ändert daran nichts — und das ist keine Formalie: hätte die spätere Rücknahme Vorrang, verlöre
// eine kuratorische Entscheidung („Fehlalarm", „getrennt lassen") mit ihrem Entscheider ihren
// Eintrag im Protokoll. Der Rückzug schliesst OFFENE Befunde, er überschreibt keine Urteile.
describe("JOB 3071: ein bereits menschlich geschlossener Befund bleibt, wie er ist", () => {
  it("nach dismiss durch die Kuratorin ändert die spätere Rücknahme nichts", async () => {
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

    const geschlossen = await app.inject({
      method: "POST",
      url: `/api/duplicates/${eintrag.id}/dismiss`,
      headers: admin.headers,
      payload: { note: "Kein echtes Duplikat." },
    });
    expect(geschlossen.statusCode).toBe(200);
    const vorher = await services.overlaps.get(eintrag.id);
    expect(vorher?.resolution?.reason).toBe("dismissed");
    expect(vorher?.resolution?.by).toBe(admin.id);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const nachher = await services.overlaps.get(eintrag.id);
    expect(nachher).toEqual(vorher);
    expect(nachher?.resolution?.reason).toBe("dismissed");
    expect(nachher?.resolution?.by).toBe(admin.id);
  });
});
