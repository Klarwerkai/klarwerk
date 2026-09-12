// ================================================================================================
// JOB 3665 T1 · C — EIN ABLAUF, DEN NIEMAND SETZEN KANN, IST KEIN ABLAUF
// ================================================================================================
//
// Die zweite Halbheit dieses Auftrags wäre eine Sperre ohne Schalter: die Regel wirkt, aber die
// Befristung entsteht nur von Hand in der Datenbank. `setAccessExpiry` ist der Schalter, gebaut
// nach dem Vorbild von `approveUser`.
//
// DIE EHRLICHE REICHWEITENGRENZE DIESER DATEI, und sie gehört hierher und nicht in eine Fußnote:
// geprüft wird der DIENST. Es gibt heute keine HTTP-Route und keine Fläche für diesen Schalter —
// `services/auth/src/routes.ts`, `services/auth/index.ts` und `apps/web/**` gehören in diesem Takt
// anderen Jobs und sind ausdrücklich nicht Teil des Auftrags. Ein Mensch sieht die Wirkung also
// über einen Dienstaufruf, nicht über einen Knopf. Das ist ein belegter Teil eines Nutzerwegs,
// kein vollständiger.
import { describe, expect, it } from "vitest";
import {
  GAST_PASSWORT,
  STUNDE,
  adminUndGast,
  baueKreis,
  befriste,
  vorgaenge,
  zweiAdmins,
} from "./aufbau";

describe("JOB 3665 C · der Admin setzt und nimmt die Befristung", () => {
  it("C1 — setzen: das Datum steht am Konto, in der Liste und im Prüfprotokoll", async () => {
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const zurueck = await k.service.setAccessExpiry(gast.id, ablauf, admin.id);
    expect(zurueck.accessExpiresAt).toBe(ablauf);

    const liste = await k.service.listUsers();
    expect(liste.find((u) => u.id === gast.id)?.accessExpiresAt).toBe(ablauf);

    const eintraege = await k.audit.list({ action: "user.access-expiry-set", target: gast.id });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe(admin.id);
    expect(eintraege[0]?.payload).toMatchObject({ expiresAt: ablauf });
  });

  it("C2 — nehmen: ohne Befristung meldet sich der Gast wieder an", async () => {
    // Der Weg zurück gehört zur Lieferung. Eine Befristung, die nur in eine Richtung geht, wäre
    // eine Falle: der Admin müsste das Konto löschen und neu anlegen, um jemanden wieder
    // hereinzulassen.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() - STUNDE).toISOString());
    await expect(
      k.service.login({ email: "gast@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    const zurueck = await k.service.setAccessExpiry(gast.id, undefined, admin.id);
    expect(zurueck.accessExpiresAt).toBeUndefined();
    // Nicht `null` und kein leerer String: „nie befristet" ist ein Zustand des Kontos, kein Wert
    // an ihm — sonst gäbe es ein drittes „ausdrücklich leer", das nur die Datenhaltung kennt.
    expect(Object.hasOwn(zurueck, "accessExpiresAt")).toBe(false);

    const angemeldet = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });
    expect(angemeldet.token).toBeTruthy();
  });

  it("C3 — der letzte freigegebene Admin darf nicht befristet werden", async () => {
    // Derselbe Aussperrschutz und dieselbe Begründung wie bei der Herabstufung: die Instanz darf
    // nie ohne Verwaltungsrecht dastehen. Eine Befristung auf dem letzten Admin wäre eine
    // Zeitbombe — sie fiele erst auf, wenn niemand mehr hereinkäme, der sie zurücknehmen kann.
    const k = baueKreis();
    const admin = await k.service.register({
      name: "Admin",
      email: "admin@x.de",
      password: GAST_PASSWORT,
    });
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    await expect(k.service.setAccessExpiry(admin.id, ablauf, admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DEMOTION",
    });

    const liste = await k.service.listUsers();
    expect(liste.find((u) => u.id === admin.id)?.accessExpiresAt).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expiry-set", admin.id)).toBe(0);
  });

  it("C3b — mit einem zweiten freigegebenen Admin ist die Befristung möglich", async () => {
    // Ohne diesen Fall wäre C3 auch von einer Regel erfüllt, die JEDEN Admin schützt — und dann
    // ließe sich ein Admin-Demozugang nie befristen.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);
    await k.service.changeRole(gast.id, "admin", admin.id);
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const zurueck = await k.service.setAccessExpiry(gast.id, ablauf, admin.id);
    expect(zurueck.accessExpiresAt).toBe(ablauf);
  });

  it("C4 — ein unlesbares Datum kommt gar nicht erst in die Datenhaltung", async () => {
    // Die Entsprechung zu A5, von der anderen Seite: Lesend ist ein kaputter Wert nachsichtig zu
    // behandeln (er darf niemanden aussperren), schreibend gar nicht — wer ihn hineinließe,
    // erzeugte genau den Bestand, den A5 nur noch ertragen kann.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);

    await expect(k.service.setAccessExpiry(gast.id, "morgen", admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "INTERNAL",
    });

    const gespeichert = await k.users.findById(gast.id);
    expect(gespeichert?.accessExpiresAt).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expiry-set", gast.id)).toBe(0);
  });

  it("C6 — ein ABGELAUFENER Admin deckt den letzten zugänglichen nicht mehr", async () => {
    // DER BEFUND AUS RUNDE 1, und er ist der schwerste des Jobs: Der Schutz zählte jeden Admin mit
    // `approved: true`. Läuft der erste ab, galt der zweite nicht mehr als der letzte — er durfte
    // befristet werden, und danach kam NIEMAND mehr herein. Der Schutz hat genau den Zustand
    // zugelassen, den er verhindern soll.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await befriste(k, ersterAdmin.id, new Date(k.jetzt() + STUNDE).toISOString());
    k.vorstellen(2 * STUNDE);

    // Der erste ist jetzt tatsächlich draußen — die Voraussetzung des Falls, nicht seine Behauptung.
    await expect(
      k.service.login({ email: "admin1@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    await expect(
      k.service.setAccessExpiry(
        zweiterAdmin.id,
        new Date(k.jetzt() + STUNDE).toISOString(),
        zweiterAdmin.id,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "LAST_ADMIN_DEMOTION" });

    // Und die Instanz ist nicht verwaist: der zweite Admin kommt weiterhin herein.
    const angemeldet = await k.service.login({ email: "admin2@x.de", password: GAST_PASSWORT });
    expect(angemeldet.token).toBeTruthy();
    const liste = await k.service.listUsers();
    expect(liste.find((u) => u.id === zweiterAdmin.id)?.accessExpiresAt).toBeUndefined();
  });

  it("C6b — dieselbe Lücke stand an den beiden anderen Türen: Herabstufen und Löschen", async () => {
    // `isLastApprovedAdmin` trägt drei Schutzstellen. Wäre nur die Befristung berichtigt worden,
    // bliebe die Instanz an zwei von drei Türen aussperrbar — mit demselben Handgriff.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await befriste(k, ersterAdmin.id, new Date(k.jetzt() + STUNDE).toISOString());
    k.vorstellen(2 * STUNDE);

    await expect(
      k.service.changeRole(zweiterAdmin.id, "viewer", ersterAdmin.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "LAST_ADMIN_DEMOTION" });
    await expect(k.service.deleteUser(zweiterAdmin.id, ersterAdmin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DELETION",
    });
  });

  it("C6c — ohne Befristung zählen beide Admins wie bisher", async () => {
    // Die Kalibrierung gegen einen Schutz, der plötzlich JEDEN Admin festhält: solange niemand
    // abgelaufen ist, bleibt das Verhalten des Bestands unverändert.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const zurueck = await k.service.setAccessExpiry(zweiterAdmin.id, ablauf, ersterAdmin.id);
    expect(zurueck.accessExpiresAt).toBe(ablauf);
  });

  it("C7 — ein parsbares, aber mehrdeutiges Datum wird abgewiesen", async () => {
    // `Date.parse("09/12/2026")` liefert eine gültige Zahl, und das Laufzeitsystem entscheidet
    // selbst, ob der 9. Dezember oder der 12. September gemeint ist. Bei einem Wert, der einen
    // Menschen aussperrt, sind das drei Monate Unterschied.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);

    for (const mehrdeutig of [
      "09/12/2026",
      "2026-09-11", // ohne Uhrzeit: welcher Moment des Tages?
      "2026-09-11T12:00:00", // ohne Zone: JavaScript liest Ortszeit — hinge am Server
      "Fri, 11 Sep 2026 12:00:00 GMT",
      "2026-02-30T00:00:00Z", // passt auf die Form und ist trotzdem kein Tag
    ]) {
      await expect(
        k.service.setAccessExpiry(gast.id, mehrdeutig, admin.id),
        `„${mehrdeutig}" wurde angenommen`,
      ).rejects.toMatchObject({ code: "FORBIDDEN", message: "INTERNAL" });
    }

    const gespeichert = await k.users.findById(gast.id);
    expect(gespeichert?.accessExpiresAt).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expiry-set", gast.id)).toBe(0);
  });

  it("C7b — gültige ISO-Schreibweisen bleiben möglich", async () => {
    // Die Gegenrichtung zu C7: eine Regel, die alles abweist, wäre ebenso falsch. Sekunden und
    // Millisekunden dürfen fehlen, ein Zonenversatz statt „Z" ist erlaubt — dasselbe Kalenderbild,
    // nur anders notiert.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);

    for (const gueltig of [
      "2026-12-24T18:00:00.000Z",
      "2026-12-24T18:00:00Z",
      "2026-12-24T18:00Z",
      "2026-12-24T19:00:00+01:00",
      "2026-12-24T17:00:00-01:00",
    ]) {
      const zurueck = await k.service.setAccessExpiry(gast.id, gueltig, admin.id);
      expect(zurueck.accessExpiresAt, `„${gueltig}" wurde abgewiesen`).toBe(gueltig);
    }
  });

  it("C8 — zwei künftige Befristungen nacheinander sperren die Instanz nicht zu", async () => {
    // DER BEFUND AUS RUNDE 2, und er braucht keine Nebenläufigkeit — nur Geduld. Solange gezählt
    // wurde, wer JETZT hereinkommt, ging jeder einzelne Schritt durch: beim Befristen des ersten
    // war der zweite noch da, beim Befristen des zweiten der erste auch noch. Erst drei Stunden
    // später fiel auf, dass niemand mehr hineinkam — und dann war es nicht mehr zu ändern.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);

    // Schritt eins bleibt erlaubt: danach gibt es noch einen Admin OHNE Ende.
    await k.service.setAccessExpiry(
      ersterAdmin.id,
      new Date(k.jetzt() + STUNDE).toISOString(),
      ersterAdmin.id,
    );

    // Schritt zwei ist der, der die Instanz zusperren würde.
    await expect(
      k.service.setAccessExpiry(
        zweiterAdmin.id,
        new Date(k.jetzt() + 2 * STUNDE).toISOString(),
        ersterAdmin.id,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "LAST_ADMIN_DEMOTION" });

    // Die eigentliche Zusage, und sie wird nach dem Zeitsprung gemessen, nicht davor: nach Ablauf
    // ALLER gesetzten Fristen kommt weiterhin jemand herein.
    k.vorstellen(3 * STUNDE);
    await expect(
      k.service.login({ email: "admin1@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    const angemeldet = await k.service.login({ email: "admin2@x.de", password: GAST_PASSWORT });
    expect(angemeldet.token).toBeTruthy();
    expect(angemeldet.user.role).toBe("admin");
  });

  it("C8b — der letzte UNBEFRISTETE Admin darf nicht gelöscht werden", async () => {
    // Ein befristeter Admin ist kein Ersatz: er deckt die Zählung nur, bis seine Frist abläuft.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await k.service.setAccessExpiry(
      ersterAdmin.id,
      new Date(k.jetzt() + STUNDE).toISOString(),
      ersterAdmin.id,
    );

    await expect(k.service.deleteUser(zweiterAdmin.id, ersterAdmin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LAST_ADMIN_DELETION",
    });

    k.vorstellen(3 * STUNDE);
    const angemeldet = await k.service.login({ email: "admin2@x.de", password: GAST_PASSWORT });
    expect(angemeldet.token).toBeTruthy();
  });

  it("C8c — und er darf auch nicht herabgestuft werden", async () => {
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await k.service.setAccessExpiry(
      ersterAdmin.id,
      new Date(k.jetzt() + STUNDE).toISOString(),
      ersterAdmin.id,
    );

    await expect(
      k.service.changeRole(zweiterAdmin.id, "controller", ersterAdmin.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "LAST_ADMIN_DEMOTION" });

    k.vorstellen(3 * STUNDE);
    const angemeldet = await k.service.login({ email: "admin2@x.de", password: GAST_PASSWORT });
    expect(angemeldet.user.role).toBe("admin");
  });

  it("C8d — umgekehrt darf der BEFRISTETE Admin weiterhin gehen", async () => {
    // Die Kalibrierung gegen einen Schutz, der einfach jeden Admin festhält: solange ein
    // unbefristeter bleibt, sind Löschen, Herabstufen und Befristen des anderen erlaubt. Ohne
    // diesen Fall wären C8b und C8c auch von einem Dauer-Nein erfüllt.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await k.service.setAccessExpiry(
      ersterAdmin.id,
      new Date(k.jetzt() + STUNDE).toISOString(),
      zweiterAdmin.id,
    );

    const herabgestuft = await k.service.changeRole(ersterAdmin.id, "controller", zweiterAdmin.id);
    expect(herabgestuft.role).toBe("controller");
    await k.service.deleteUser(ersterAdmin.id, zweiterAdmin.id);
    const liste = await k.service.listUsers();
    expect(liste.find((u) => u.id === ersterAdmin.id)).toBeUndefined();
  });

  it("C8e — die Befristung nehmen gibt die Deckung zurück", async () => {
    // Der Weg aus der Enge heraus: Wer den ersten Admin entfristet, darf danach den zweiten
    // befristen. Eine Sperre ohne Ausweg wäre eine Falle.
    const k = baueKreis();
    const { ersterAdmin, zweiterAdmin } = await zweiAdmins(k);
    await k.service.setAccessExpiry(
      ersterAdmin.id,
      new Date(k.jetzt() + STUNDE).toISOString(),
      ersterAdmin.id,
    );
    await expect(
      k.service.setAccessExpiry(
        zweiterAdmin.id,
        new Date(k.jetzt() + 2 * STUNDE).toISOString(),
        ersterAdmin.id,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await k.service.setAccessExpiry(ersterAdmin.id, undefined, ersterAdmin.id);

    const zurueck = await k.service.setAccessExpiry(
      zweiterAdmin.id,
      new Date(k.jetzt() + 2 * STUNDE).toISOString(),
      ersterAdmin.id,
    );
    expect(zurueck.accessExpiresAt).toBeTruthy();
  });

  it("C5 — ein unbekanntes Konto geht denselben Weg wie überall sonst", async () => {
    const k = baueKreis();
    const { admin } = await adminUndGast(k);

    await expect(
      k.service.setAccessExpiry("gibt-es-nicht", new Date(k.jetzt()).toISOString(), admin.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "USER_NOT_FOUND" });
  });
});
