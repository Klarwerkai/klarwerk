// ================================================================================================
// AUFNAHME gesamt-sso · R-0556 / R-0571 — DAS UNTERNEHMENSVERZEICHNIS PFLEGT KONTEN, ROLLEN UND
// PRÜFZUSTÄNDIGKEITEN, OHNE HANDGRIFF IN KLARA.
// ================================================================================================
//
// Gemessen am echten Draht (`services/app/src/routes/verzeichnis-routes.ts`, SCIM 2.0) und am
// Dienst (`AuthService.verzeichnisAnlegen/verzeichnisAendern/pruefzustaendigeFuer`):
//   V1  ohne, mit falschem und mit einem Sitzungsschlüssel: 401 — nur der Verzeichnisschlüssel öffnet.
//   V2  Eintritt: POST legt das Konto an, die Rolle folgt den Gruppen, der Filter findet es.
//   V3  Austritt WIRKT SOFORT: eine laufende Sitzung endet, eine neue Anmeldung scheitert.
//   V4  DELETE sperrt und löscht nicht: das Konto bleibt mit seinen Spuren bestehen.
//   V5  Abteilungswechsel: Gruppen ersetzen, entfernen — die Rolle zieht mit, hinauf und hinunter.
//   V6  der letzte Administrator kann über das Verzeichnis nicht gesperrt werden (409).
//   V7  R-0571: Prüfzuständigkeit aus Verzeichnisgruppen — nur freigegebene Mitglieder, und die
//       Zuordnung folgt jedem Wechsel.
//   V8  R-0571 an der echten Kompositionswurzel: kommt ein Wissensobjekt in den Space, wird die im
//       Verzeichnis Zuständige Prüferin — nicht die Autorin.
//   V9  gefilterter Rollenpfad: `remove roles[value eq "…"]` nimmt NUR diese Gruppe, `replace`
//       tauscht nur sie; jeder andere Rollenpfad wird mit 400 invalidPath abgewiesen und ändert nichts.
//   V10 R-0571 für BESTEHENDE Objekte: Eintritt, Gruppenwechsel und Austritt im Verzeichnis gleichen
//       die offenen Prüfzuweisungen eines schon im Space liegenden Objekts ab; eine Hand-Zuweisung
//       bleibt.
//   V11 der Abgleich am Dienst: nur offene Verzeichnis-Zuweisungen werden entzogen — Hand-Zuweisungen
//       und erledigte Prüfungen bleiben, ein zweiter Lauf ändert nichts.
//   V12 fällt beim Eintritt der Mailversand aus: 201, alle Objekte zugewiesen, eine wiederholte
//       Anlage bleibt 409, und die Wiederholung holt die Benachrichtigung ohne Anstoß nach.
//   V13 Absturz zwischen Kontoanlage und Abgleich: der nächste Start der Instanz holt ihn nach.
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  lesePruefzustaendigkeit,
  verzeichnisRoutes,
} from "../../services/app/src/routes/verzeichnis-routes";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "../../services/validation/src/repo";
import { ValidationService } from "../../services/validation/src/service";

const SCHLUESSEL = "verzeichnisschluessel-fuer-den-test-0123456789";
const SCIM = { authorization: `Bearer ${SCHLUESSEL}`, "content-type": "application/scim+json" };
const ADMIN = { name: "Erste Admin", email: "admin@firma.test", password: "geheim12345" };

async function buehne() {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  const admin = await service.register(ADMIN);
  const app = Fastify();
  app.register(authRoutes(service));
  app.register(
    verzeichnisRoutes({
      auth: service,
      schluessel: SCHLUESSEL,
      rollen: { adminGroup: "klara-admins", controllerGroup: "klara-pruefer" },
    }),
  );
  return { app, service, admin };
}

async function eintritt(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  email: string,
  gruppen: string[],
): Promise<{ id: string; status: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: "POST",
    url: "/scim/v2/Users",
    headers: SCIM,
    payload: JSON.stringify({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: email,
      displayName: "Paula Prüferin",
      active: true,
      roles: gruppen.map((value) => ({ value })),
    }),
  });
  const body = res.json() as Record<string, unknown>;
  return { id: String(body.id ?? ""), status: res.statusCode, body };
}

/** Eine echte Sitzung für ein Verzeichniskonto: der Firmen-Login verknüpft über die Adresse. */
async function anmeldenPerFirmenLogin(service: AuthService, email: string): Promise<string> {
  const { token } = await service.loginWithOidc(
    {
      sub: `sub-${email}`,
      email,
      name: email,
      roles: [],
      iss: "https://idp.firma.test",
      emailVerified: true,
      rolesClaimPresent: false,
    },
    false,
  );
  return token;
}

function patch(operationen: Record<string, unknown>[]): string {
  return JSON.stringify({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    Operations: operationen,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("R-0556 · Verzeichnispflege über SCIM", () => {
  it("V1 nur der Verzeichnisschlüssel öffnet — keine Sitzung, auch nicht die des Admins", async () => {
    const { app } = await buehne();
    try {
      const anmeldung = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: ADMIN,
      });
      const sitzung = anmeldung.json().token as string;
      const koepfe = [
        {},
        { authorization: "Bearer falsch" },
        { authorization: `Bearer ${sitzung}` },
      ];
      for (const kopf of koepfe) {
        const res = await app.inject({ method: "GET", url: "/scim/v2/Users", headers: kopf });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: "SCIM_UNAUTHORIZED", status: "401" });
      }
      const mitSchluessel = await app.inject({
        method: "GET",
        url: "/scim/v2/Users",
        headers: SCIM,
      });
      expect(mitSchluessel.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("V2 Eintritt: das Konto entsteht mit der Rolle aus den Gruppen, der Filter findet es", async () => {
    const { app, service } = await buehne();
    try {
      const neu = await eintritt(app, "paula@firma.test", ["klara-pruefer"]);
      expect(neu.status, JSON.stringify(neu.body)).toBe(201);
      expect(neu.body).toMatchObject({ userName: "paula@firma.test", active: true });
      const konto = await service.kontoLesen(neu.id);
      expect(konto).toMatchObject({ role: "controller", approved: true });
      expect(konto?.verzeichnisGruppen).toEqual(["klara-pruefer"]);

      const gefunden = await app.inject({
        method: "GET",
        url: `/scim/v2/Users?filter=${encodeURIComponent('userName eq "paula@firma.test"')}`,
        headers: SCIM,
      });
      expect(gefunden.json()).toMatchObject({ totalResults: 1 });
      expect(gefunden.json().Resources[0].id).toBe(neu.id);

      const doppelt = await eintritt(app, "paula@firma.test", []);
      expect(doppelt.status).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("V3 Austritt wirkt sofort: die laufende Sitzung endet, eine neue Anmeldung scheitert", async () => {
    const { app, service } = await buehne();
    try {
      const neu = await eintritt(app, "paula@firma.test", []);
      const token = await anmeldenPerFirmenLogin(service, "paula@firma.test");
      const vorher = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(vorher.statusCode).toBe(200);

      // So schickt Entra ID den Austritt: Replace auf `active` mit dem Wert als Zeichenkette.
      const austritt = await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
        payload: patch([{ op: "Replace", path: "active", value: "False" }]),
      });
      expect(austritt.statusCode, austritt.body).toBe(200);
      expect(austritt.json().active).toBe(false);

      const nachher = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(nachher.statusCode).toBe(401);
      await expect(anmeldenPerFirmenLogin(service, "paula@firma.test")).rejects.toMatchObject({
        code: "NOT_APPROVED",
      });

      // Wiedereintritt hebt die Sperre auf.
      await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
        payload: patch([{ op: "replace", path: "active", value: true }]),
      });
      expect((await service.kontoLesen(neu.id))?.approved).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("V4 DELETE sperrt und löscht nicht — das Konto bleibt mit seinen Spuren", async () => {
    const { app, service } = await buehne();
    try {
      const neu = await eintritt(app, "paula@firma.test", ["klara-pruefer"]);
      const weg = await app.inject({
        method: "DELETE",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
      });
      expect(weg.statusCode).toBe(204);
      const konto = await service.kontoLesen(neu.id);
      expect(konto).toMatchObject({ id: neu.id, approved: false, email: "paula@firma.test" });
    } finally {
      await app.close();
    }
  });

  it("V5 Abteilungswechsel: die Rolle folgt den Gruppen, hinauf und hinunter", async () => {
    const { app, service } = await buehne();
    try {
      const neu = await eintritt(app, "paula@firma.test", ["klara-pruefer"]);
      const hinauf = await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
        payload: patch([{ op: "replace", path: "roles", value: [{ value: "klara-admins" }] }]),
      });
      expect(hinauf.statusCode, hinauf.body).toBe(200);
      expect((await service.kontoLesen(neu.id))?.role).toBe("admin");

      const hinunter = await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
        payload: patch([{ op: "remove", path: "roles" }]),
      });
      expect(hinunter.statusCode, hinunter.body).toBe(200);
      const konto = await service.kontoLesen(neu.id);
      expect(konto).toMatchObject({ role: "viewer", verzeichnisGruppen: [] });

      // Schweigt das Verzeichnis zu den Gruppen, bleibt die Rolle, wie sie ist.
      await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${neu.id}`,
        headers: SCIM,
        payload: patch([{ op: "replace", path: "displayName", value: "Paula P." }]),
      });
      expect(await service.kontoLesen(neu.id)).toMatchObject({ role: "viewer", name: "Paula P." });
    } finally {
      await app.close();
    }
  });

  it("V6 der letzte Administrator kann über das Verzeichnis nicht gesperrt werden", async () => {
    const { app, service, admin } = await buehne();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${admin.id}`,
        headers: SCIM,
        payload: patch([{ op: "replace", path: "active", value: false }]),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ scimType: "mutability" });
      expect((await service.kontoLesen(admin.id))?.approved).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("V9 gefilterter Rollenpfad ändert nur den gewählten Eintrag, Unbekanntes wird abgewiesen", async () => {
    const { app, service } = await buehne();
    try {
      const neu = await eintritt(app, "paula@firma.test", ["QM-Pruefung", "klara-pruefer"]);
      const pfad = (operationen: Record<string, unknown>[]) =>
        app.inject({
          method: "PATCH",
          url: `/scim/v2/Users/${neu.id}`,
          headers: SCIM,
          payload: patch(operationen),
        });

      // So entfernt Entra EINE Rolle: Filter im Pfad, kein Wert.
      const entfernt = await pfad([{ op: "remove", path: 'roles[value eq "QM-Pruefung"]' }]);
      expect(entfernt.statusCode, entfernt.body).toBe(200);
      expect(await service.kontoLesen(neu.id)).toMatchObject({
        role: "controller",
        verzeichnisGruppen: ["klara-pruefer"],
      });

      // replace mit Filter tauscht nur diesen Eintrag.
      const getauscht = await pfad([
        { op: "replace", path: 'roles[value eq "klara-pruefer"]', value: [{ value: "Recht" }] },
      ]);
      expect(getauscht.statusCode, getauscht.body).toBe(200);
      expect((await service.kontoLesen(neu.id))?.verzeichnisGruppen).toEqual(["Recht"]);

      // Nicht auswertbare Rollenpfade: 400 invalidPath — und die Gruppen bleiben, wie sie sind.
      for (const operation of [
        { op: "remove", path: 'roles[type eq "work"]' },
        { op: "remove", path: "roles.value" },
        { op: "add", path: 'roles[value eq "Recht"]', value: [{ value: "klara-admins" }] },
      ]) {
        const res = await pfad([operation]);
        expect(res.statusCode, JSON.stringify(operation)).toBe(400);
        expect(res.json()).toMatchObject({ scimType: "invalidPath", status: "400" });
      }
      // Ersetzen über einen Filter ohne Treffer: 400 noTarget (RFC 7644 §3.5.2.3).
      const ohneTreffer = await pfad([
        { op: "replace", path: 'roles[value eq "QM-Pruefung"]', value: [{ value: "Neu" }] },
      ]);
      expect(ohneTreffer.statusCode).toBe(400);
      expect(ohneTreffer.json()).toMatchObject({ scimType: "noTarget" });
      expect(await service.kontoLesen(neu.id)).toMatchObject({
        role: "viewer",
        verzeichnisGruppen: ["Recht"],
      });
    } finally {
      await app.close();
    }
  });
});

describe("R-0571 · Prüfzuständigkeit aus dem Verzeichnis", () => {
  it("V7 die Zuordnung Gruppe → Space wird gelesen und folgt jedem Wechsel", async () => {
    const zuordnung = lesePruefzustaendigkeit(
      "QM-Pruefung=space-qm, space-labor; Recht=space-recht; kaputt; =space-x",
    );
    expect([...zuordnung]).toEqual([
      ["QM-Pruefung", ["space-qm", "space-labor"]],
      ["Recht", ["space-recht"]],
    ]);
    const { app, service } = await buehne();
    try {
      const paula = await eintritt(app, "paula@firma.test", ["QM-Pruefung"]);
      const rita = await eintritt(app, "rita@firma.test", ["Recht"]);
      expect(await service.pruefzustaendigeFuer("space-qm", zuordnung)).toEqual([paula.id]);
      expect(await service.pruefzustaendigeFuer("space-recht", zuordnung)).toEqual([rita.id]);
      expect(await service.pruefzustaendigeFuer("space-ohne", zuordnung)).toEqual([]);

      // Wechsel: Paula verlässt die Gruppe — sie ist nicht mehr zuständig.
      await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${paula.id}`,
        headers: SCIM,
        payload: patch([{ op: "remove", path: "roles", value: [{ value: "QM-Pruefung" }] }]),
      });
      expect(await service.pruefzustaendigeFuer("space-qm", zuordnung)).toEqual([]);

      // Austritt: Rita ist gesperrt — gesperrte Konten sind nie zuständig.
      await app.inject({ method: "DELETE", url: `/scim/v2/Users/${rita.id}`, headers: SCIM });
      expect(await service.pruefzustaendigeFuer("space-recht", zuordnung)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("V8 an der echten App: kommt ein Objekt in den Space, wird die Zuständige Prüferin", async () => {
    const { app, services, erika, koAnlegen, verschieben } = await appBuehne();
    try {
      // Das Verzeichnis meldet die Prüferin mit ihrer Gruppe.
      const paula = await app.inject({
        method: "POST",
        url: "/scim/v2/Users",
        headers: SCIM,
        payload: JSON.stringify({
          userName: "paula@firma.test",
          displayName: "Paula Prüferin",
          roles: [{ value: "QM-Pruefung" }],
        }),
      });
      expect(paula.statusCode, paula.body).toBe(201);
      const paulaId = String(paula.json().id);

      const koId = await koAnlegen();
      // Vor dem Spacewechsel: keine Zuweisung an die Prüferin.
      const offenVorher = await services.validation.openAssignmentsFor(paulaId);
      expect(offenVorher.map((a) => a.koId)).toEqual([]);

      const wechsel = await verschieben(koId, "space-qm", erika);
      expect(wechsel.statusCode, wechsel.body).toBe(200);
      expect(wechsel.json().pruefzuweisung).toEqual([paulaId]);
      const offenNachher = await services.validation.openAssignmentsFor(paulaId);
      expect(offenNachher.map((a) => a.koId)).toEqual([koId]);
    } finally {
      await app.close();
    }
  });

  it("V10 bestehende Objekte folgen dem Verzeichnis: Eintritt, Gruppenwechsel, Austritt", async () => {
    const { app, services, adminId, erika, koAnlegen, verschieben } = await appBuehne();
    try {
      // Das Objekt liegt SCHON im Space, bevor irgendwer im Verzeichnis zuständig ist.
      const koId = await koAnlegen();
      const wechsel = await verschieben(koId, "space-qm", erika);
      expect(wechsel.json().pruefzuweisung).toEqual([]);

      // Von Hand zugewiesen: Rita, ohne Prüfgruppe — sie bleibt, was immer das Verzeichnis tut.
      const rita = await app.inject({
        method: "POST",
        url: "/scim/v2/Users",
        headers: SCIM,
        payload: JSON.stringify({ userName: "rita@firma.test", displayName: "Rita" }),
      });
      const ritaId = String(rita.json().id);
      await services.validation.assign(koId, [ritaId], adminId);
      const offen = async (id: string) =>
        (await services.validation.openAssignmentsFor(id)).map((a) => a.koId);

      // Eintritt in die Prüfgruppe → Zuweisung am BESTEHENDEN Objekt.
      const paula = await app.inject({
        method: "POST",
        url: "/scim/v2/Users",
        headers: SCIM,
        payload: JSON.stringify({
          userName: "paula@firma.test",
          displayName: "Paula Prüferin",
          roles: [{ value: "QM-Pruefung" }, { value: "klara-pruefer" }],
        }),
      });
      expect(paula.statusCode, paula.body).toBe(201);
      const paulaId = String(paula.json().id);
      expect(await offen(paulaId)).toEqual([koId]);

      // Gruppenwechsel (so schickt Entra das Entfernen EINER Rolle) → die offene Zuweisung endet.
      const wechselGruppe = await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${paulaId}`,
        headers: SCIM,
        payload: patch([{ op: "remove", path: 'roles[value eq "QM-Pruefung"]' }]),
      });
      expect(wechselGruppe.statusCode, wechselGruppe.body).toBe(200);
      expect(wechselGruppe.json().roles).toEqual([{ value: "klara-pruefer" }]);
      expect(await offen(paulaId)).toEqual([]);
      expect(await offen(ritaId)).toEqual([koId]);

      // Zurück in die Gruppe → wieder zuständig; Austritt → die Zuweisung endet erneut.
      await app.inject({
        method: "PATCH",
        url: `/scim/v2/Users/${paulaId}`,
        headers: SCIM,
        payload: patch([{ op: "add", path: "roles", value: [{ value: "QM-Pruefung" }] }]),
      });
      expect(await offen(paulaId)).toEqual([koId]);
      const austritt = await app.inject({
        method: "DELETE",
        url: `/scim/v2/Users/${paulaId}`,
        headers: SCIM,
      });
      expect(austritt.statusCode).toBe(204);
      expect(await offen(paulaId)).toEqual([]);
      expect(await offen(ritaId)).toEqual([koId]);
    } finally {
      await app.close();
    }
  });

  it("V11 der Abgleich entzieht nur offene Verzeichnis-Zuweisungen — Hand und Erledigtes bleiben", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const assignments = new InMemoryAssignmentRepo();
    const validation = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments,
    });
    const ko = await koService.create({
      title: "Aussage",
      statement: "Inhalt.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
      neededValidations: 2,
    });
    await validation.assign(ko.id, ["hand"], "controller");
    expect(await validation.verzeichnisAbgleichen(ko.id, ["paula", "hugo"])).toEqual({
      neu: ["paula", "hugo"],
      entzogen: [],
    });
    // Hugo prüft — seine Zuweisung ist erledigt, eine Prüfspur.
    await validation.rate(ko.id, "hugo", "up");
    expect((await assignments.find(ko.id, "hugo"))?.status).toBe("done");

    // Niemand mehr zuständig: nur Paulas OFFENE Verzeichnis-Zuweisung geht.
    expect(await validation.verzeichnisAbgleichen(ko.id, [])).toEqual({
      neu: [],
      entzogen: ["paula"],
    });
    expect(await assignments.find(ko.id, "paula")).toBeUndefined();
    expect(await assignments.find(ko.id, "hand")).toMatchObject({ status: "open" });
    expect(await assignments.find(ko.id, "hugo")).toMatchObject({
      status: "done",
      quelle: "verzeichnis",
    });
    // Idempotent — und eine erledigte Prüfung wird nicht wieder geöffnet.
    expect(await validation.verzeichnisAbgleichen(ko.id, [])).toEqual({ neu: [], entzogen: [] });
    expect(await validation.verzeichnisAbgleichen(ko.id, ["hugo"])).toEqual({
      neu: [],
      entzogen: [],
    });
    expect(await assignments.find(ko.id, "hugo")).toMatchObject({ status: "done" });
  });

  it("V12 fällt der Mailversand beim Eintritt aus, bleibt die Anlage gültig und der Abgleich holt nach", async () => {
    const { app, services, erika, koAnlegen, verschieben } = await appBuehne({
      verzeichnisAbgleichWiederholungMs: 20,
    });
    try {
      const erstes = await koAnlegen();
      const zweites = await koAnlegen();
      for (const koId of [erstes, zweites]) {
        const wechsel = await verschieben(koId, "space-qm", erika);
        expect(wechsel.statusCode, wechsel.body).toBe(200);
      }
      // Der Mailserver fällt beim ersten Versand aus.
      const senden = vi.spyOn(services.mailer, "send");
      senden.mockRejectedValueOnce(new Error("SMTP nicht erreichbar"));
      const anlage = {
        method: "POST" as const,
        url: "/scim/v2/Users",
        headers: SCIM,
        payload: JSON.stringify({
          userName: "paula@firma.test",
          displayName: "Paula Prüferin",
          roles: [{ value: "QM-Pruefung" }],
        }),
      };
      const eintritt = await app.inject(anlage);
      // Die Anlage ist gespeichert — die Antwort sagt das, statt das Verzeichnis in eine
      // Wiederholung zu schicken, die nur noch 409 bekäme.
      expect(eintritt.statusCode, eintritt.body).toBe(201);
      const paulaId = String(eintritt.json().id);
      // Beide Objekte sind zugewiesen: der Fehler am einen hat das andere nicht aufgehalten.
      const offen = (await services.validation.openAssignmentsFor(paulaId)).map((a) => a.koId);
      expect(offen.sort()).toEqual([erstes, zweites].sort());

      // Eine wiederholte Anlage bleibt 409 — ein bestehendes Konto ist keine „dieselbe Anlage".
      expect((await app.inject(anlage)).statusCode).toBe(409);

      // Ohne weiteren Anstoß von außen holt die Wiederholung die ausgefallene Benachrichtigung nach.
      await vi.waitFor(async () => {
        for (const koId of [erstes, zweites]) {
          const ausstehend = await services.validation.nochZuBenachrichtigen(koId, [paulaId], {
            altbestandBenachrichtigt: false,
          });
          expect(ausstehend, koId).toEqual([]);
        }
      });
      // Ein gescheiterter Versand, zwei zugestellte — niemand doppelt benachrichtigt.
      const anPaula = senden.mock.calls.filter(([mail]) => mail.to === "paula@firma.test");
      expect(anPaula).toHaveLength(3);
    } finally {
      await app.close();
    }
  });

  it("V13 bricht die Instanz zwischen Kontoanlage und Abgleich ab, holt der nächste Start ihn nach", async () => {
    appUmgebung();
    const services = buildServices();
    // Der Stand vor dem Absturz: ein Objekt im zugeordneten Space, das Konto aus dem Verzeichnis
    // gespeichert — der Abgleich ist nie gelaufen.
    const ko = await services.ko.create({
      title: "Messschieber vor jeder Schicht prüfen",
      statement: "Der Messschieber wird vor jeder Schicht gegen das Endmaß geprüft.",
      type: "best_practice",
      category: "Prüfmittel",
      author: "erika",
    });
    await services.ko.setLeadingSpace(ko.id, "space-qm", "erika", null);
    const paula = await services.auth.verzeichnisAnlegen({
      email: "paula@firma.test",
      name: "Paula Prüferin",
      aktiv: true,
      gruppen: ["QM-Pruefung"],
    });
    expect(await services.validation.openAssignmentsFor(paula.id)).toEqual([]);

    const app = buildApp(services);
    try {
      await app.ready();
      await vi.waitFor(async () => {
        const offen = await services.validation.openAssignmentsFor(paula.id);
        expect(offen.map((a) => a.koId)).toEqual([ko.id]);
      });
    } finally {
      await app.close();
    }
  });
});

function appUmgebung(): void {
  vi.stubEnv("KLARWERK_SCIM_TOKEN", SCHLUESSEL);
  vi.stubEnv("KLARWERK_PRUEFZUSTAENDIGKEIT", "QM-Pruefung=space-qm");
  vi.stubEnv("OIDC_GROUP_CONTROLLER", "klara-pruefer");
}

/** Die echte Kompositionswurzel mit Verzeichnis, Zuordnung `QM-Pruefung → space-qm` und Autorin. */
async function appBuehne(opts: Parameters<typeof buildApp>[1] = {}) {
  appUmgebung();
  const services = buildServices();
  const app = buildApp(services, opts);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const adminLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN });
  const admin = { authorization: `Bearer ${adminLogin.json().token}` };
  const adminId = String(adminLogin.json().user.id);
  const autorin = { name: "Erika Autorin", email: "erika@firma.test", password: "geheim12345" };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { ...autorin, role: "experte" },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const erikaLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: autorin });
  const erika = { authorization: `Bearer ${erikaLogin.json().token}` };

  // Der Space mit der Kennung, auf die die Zuordnung zeigt — offen für alle mit Schreibrecht.
  const am = new Date().toISOString();
  await services.spaces.lege({
    id: "space-qm",
    version: 1,
    name: "Qualität",
    zweck: "Prüfmittel und Prüfanweisungen.",
    verantwortlich: adminId,
    zugang: "alle",
    mitglieder: [],
    ansichten: [],
    angelegtVon: adminId,
    angelegtAm: am,
    geaendertVon: adminId,
    geaendertAm: am,
  });

  const koAnlegen = async (): Promise<string> => {
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erika,
      payload: {
        confidentiality: "intern",
        title: "Messschieber vor jeder Schicht prüfen",
        statement: "Der Messschieber wird vor jeder Schicht gegen das Endmaß geprüft.",
        type: "best_practice",
        category: "Prüfmittel",
        tags: ["pruefmittel"],
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    return String(ko.json().id);
  };

  const verschieben = async (koId: string, zielSpaceId: string, wer: Record<string, string>) => {
    const vorschau = await app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung/vorschau",
      headers: wer,
      payload: { koId, zielSpaceId },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    const v = vorschau.json();
    return app.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: wer,
      payload: {
        koId,
        zielSpaceId,
        basis: {
          quelleId: v.quelle?.id ?? null,
          quelleVersion: v.quelle?.version ?? null,
          zielId: v.ziel?.id ?? null,
          zielVersion: v.ziel?.version ?? null,
          grundlage: v.grundlage,
        },
      },
    });
  };

  return { app, services, adminId, erika, koAnlegen, verschieben };
}
