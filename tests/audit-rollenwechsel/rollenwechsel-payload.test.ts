// JOB 3140 · UX-11 — WAS DER ROLLENWECHSEL WIRKLICH INS PROTOKOLL SCHREIBT.
//
// Bis hierher schrieb `AuthService.changeRole` genau `{ role }` — die NEUE Rolle. Wer den Eintrag
// später las, sah zwei UUIDs und einen Rollenwert, und die alte Rolle war unwiederbringlich weg
// (sie stand als `user.role` noch im Speicher und wurde überschrieben). Die Anzeige kann nur
// zeigen, was gespeichert ist; deshalb ist der Speicherweg der Anfang dieser Kette.
//
// Der Nachweis läuft ausdrücklich über den LAUFZEITFALL (LEHRE JOB 3125 R2): geschrieben wird über
// den echten Auth-Dienst mit echtem Audit, gelesen wird der geschriebene Eintrag. Ein
// Quelltext-Wächter, der nur prüft, DASS „previousRole" irgendwo vorkommt, würde einen falschen
// Wert nicht bemerken.
//
// Die Kette wird im selben Lauf mitgeprüft: ein größerer Payload verändert das Hashmaterial NEUER
// Einträge; Alteinträge dürfen davon nicht berührt werden und werden auch nicht nachträglich
// angereichert.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { AuditEntry } from "../../services/audit/src/types";
import { AuthService, InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth";

function bau(): { service: AuthService; audit: AuditService } {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    audit,
    // Der Vorgabe-Schutz erlaubt jede Änderung ausser dem Selbst-Entzug der Admin-Rolle; genau das
    // brauchen wir hier (Admin hebt ein fremdes Konto).
  });
  return { service, audit };
}

/** Der jüngste Eintrag zu einer Aktion — gelesen, nicht angenommen. */
async function juengster(audit: AuditService, action: string): Promise<AuditEntry> {
  const eintraege = await audit.list({ action });
  const letzter = eintraege.at(-1);
  if (!letzter) {
    throw new Error(`kein Eintrag mit action="${action}" im Protokoll`);
  }
  return letzter;
}

describe("JOB 3140 · der Rollenwechsel speichert alte Rolle und beide Namen", () => {
  let service: AuthService;
  let audit: AuditService;

  beforeEach(async () => {
    ({ service, audit } = bau());
  });

  it("1 der jüngste Eintrag trägt previousRole, role und beide Namen", async () => {
    const ada = await service.register({
      name: "Ada Admin",
      email: "ada@x.de",
      password: "secret123",
    });
    const tom = await service.register({
      name: "Tom Test",
      email: "tom@x.de",
      password: "secret123",
    });
    // Ausgangslage messen, nicht annehmen: das zweite Konto ist Experte (FR-AUTH-02).
    expect(tom.role).toBe("experte");

    const nachher = await service.changeRole(tom.id, "controller", ada.id);
    expect(nachher.role).toBe("controller");

    const eintrag = await juengster(audit, "user.role-change");
    expect(eintrag.action).toBe("user.role-change");
    expect(eintrag.actor).toBe(ada.id);
    expect(eintrag.target).toBe(tom.id);
    expect(eintrag.payload.previousRole).toBe("experte");
    expect(eintrag.payload.role).toBe("controller");
    expect(eintrag.payload.actorName).toBe("Ada Admin");
    expect(eintrag.payload.targetName).toBe("Tom Test");
  });

  it("2 die Kette bleibt nach dem erweiterten Payload lückenlos (verifyReport ok)", async () => {
    const ada = await service.register({
      name: "Ada Admin",
      email: "ada@x.de",
      password: "secret123",
    });
    const tom = await service.register({
      name: "Tom Test",
      email: "tom@x.de",
      password: "secret123",
    });
    await service.changeRole(tom.id, "controller", ada.id);
    await service.changeRole(tom.id, "viewer", ada.id);

    const bericht = await audit.verifyReport();
    expect(bericht.ok).toBe(true);
    // Der zweite Wechsel kennt die Rolle des ERSTEN als Vorrolle — nicht die ursprüngliche.
    const eintrag = await juengster(audit, "user.role-change");
    expect(eintrag.payload.previousRole).toBe("controller");
    expect(eintrag.payload.role).toBe("viewer");
  });

  it("3 ein Alteintrag ohne previousRole bleibt gültig und wird nicht nachträglich ergänzt", async () => {
    // Ein Eintrag in der Form, die der Bestand hat: nur { role }, keine Namen.
    const alt = await audit.record({
      actor: "alter-admin",
      action: "user.role-change",
      target: "altes-konto",
      payload: { role: "admin" },
    });
    expect(alt.payload).toEqual({ role: "admin" });

    const ada = await service.register({
      name: "Ada Admin",
      email: "ada@x.de",
      password: "secret123",
    });
    const tom = await service.register({
      name: "Tom Test",
      email: "tom@x.de",
      password: "secret123",
    });
    await service.changeRole(tom.id, "controller", ada.id);

    const alle = await audit.list({ action: "user.role-change" });
    const wieder = alle.find((e) => e.seq === alt.seq);
    expect(wieder?.payload).toEqual({ role: "admin" });
    expect(wieder?.hash).toBe(alt.hash);
    // Beide Formen zugleich in einer Kette: der Bericht bleibt ok.
    expect((await audit.verifyReport()).ok).toBe(true);
  });

  it("4 die übrigen Schreibwege des Dienstes bleiben unverändert", async () => {
    const ada = await service.register({
      name: "Ada Admin",
      email: "ada@x.de",
      password: "secret123",
    });
    const tom = await service.register({
      name: "Tom Test",
      email: "tom@x.de",
      password: "secret123",
    });
    await service.approveUser(tom.id, ada.id);
    await service.login({ email: "ada@x.de", password: "secret123" });

    // `user.approve` und `auth.login` schreiben weiterhin OHNE Nutzlast — dieser Auftrag erweitert
    // ausschliesslich den Rollenwechsel.
    expect((await juengster(audit, "user.approve")).payload).toEqual({});
    expect((await juengster(audit, "auth.login")).payload).toEqual({});
  });
});
