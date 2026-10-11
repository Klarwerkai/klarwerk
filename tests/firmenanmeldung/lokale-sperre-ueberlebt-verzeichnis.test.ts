// ================================================================================================
// P05 (Peters Entscheidung 11.10.2026) · RF-10 / B-10 — EINE LOKALE SPERRE ÜBERSTEHT SSO-ABGLEICH
// UND REIMPORT. Nur eine befugte Änderung in Klara hebt sie auf.
// ================================================================================================
//
// Die lokale Sperre ist die Befristung (`accessExpiresAt`, gesetzt vom Admin). Gemessen am echten
// Draht (SCIM 2.0 `verzeichnis-routes.ts`, `/api/auth/me`) und am Firmen-Login des Dienstes:
//   S1  SCIM `active=true`, `active` aus und wieder ein, Gruppenwechsel und PUT heben sie nicht auf;
//       eine laufende Sitzung bleibt beendet, der Firmen-Login scheitert.
//   S2  Reimport: erneutes Anlegen derselben Adresse über das Verzeichnis ist 409 und ändert nichts;
//       der Firmen-Login mit Rollenclaims stellt den Zugang nicht wieder her.
//   S3  Gegenprobe: nimmt der Admin die Befristung (befugte Änderung), kommt das Konto wieder herein.
// Synthetische Konten, In-Memory-Repos; kein echter Identitätsanbieter.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { verzeichnisRoutes } from "../../services/app/src/routes/verzeichnis-routes";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";

const SCHLUESSEL = "verzeichnisschluessel-fuer-den-test-0123456789";
const SCIM = { authorization: `Bearer ${SCHLUESSEL}`, "content-type": "application/scim+json" };
const ADMIN = { name: "Erste Admin", email: "admin@firma.test", password: "geheim12345" };
const VERGANGEN = "2020-01-01T00:00:00.000Z";
const EMAIL = "paula@firma.test";

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

type Buehne = Awaited<ReturnType<typeof buehne>>;

function patch(operationen: Record<string, unknown>[]): string {
  return JSON.stringify({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    Operations: operationen,
  });
}

function scimNutzer(gruppen: string[], active = true): string {
  return JSON.stringify({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    userName: EMAIL,
    displayName: "Paula Prüferin",
    active,
    roles: gruppen.map((value) => ({ value })),
  });
}

function firmenLogin(service: AuthService, rollen: string[] = []) {
  return service.loginWithOidc(
    {
      sub: `sub-${EMAIL}`,
      email: EMAIL,
      name: EMAIL,
      roles: rollen,
      iss: "https://idp.firma.test",
      emailVerified: true,
      rolesClaimPresent: rollen.length > 0,
    },
    true,
  );
}

async function me(app: Buehne["app"], token: string): Promise<number> {
  const res = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.statusCode;
}

/** Verzeichniskonto mit laufender Sitzung, danach vom Admin lokal gesperrt (Befristung vergangen). */
async function gesperrtesVerzeichniskonto(b: Buehne) {
  const neu = await b.app.inject({
    method: "POST",
    url: "/scim/v2/Users",
    headers: SCIM,
    payload: scimNutzer(["klara-pruefer"]),
  });
  expect(neu.statusCode, neu.body).toBe(201);
  const id = String(neu.json().id);
  const { token } = await firmenLogin(b.service);
  expect(await me(b.app, token)).toBe(200);

  await b.service.setAccessExpiry(id, VERGANGEN, b.admin.id);
  expect(await me(b.app, token)).toBe(401);
  return { id, token };
}

async function bleibtGesperrt(b: Buehne, id: string, token: string): Promise<void> {
  const konto = await b.service.kontoLesen(id);
  expect(konto?.accessExpiresAt).toBe(VERGANGEN);
  expect(await me(b.app, token)).toBe(401);
  await expect(firmenLogin(b.service, ["klara-admins"])).rejects.toMatchObject({
    code: "NOT_APPROVED",
  });
  expect((await b.service.kontoLesen(id))?.accessExpiresAt).toBe(VERGANGEN);
}

describe("P05 · lokale Sperre gegen Verzeichnis und Firmen-Login", () => {
  it("S1 SCIM-Abgleich (active=true, aus/ein, Gruppenwechsel, PUT) hebt die lokale Sperre nicht auf", async () => {
    const b = await buehne();
    try {
      const { id, token } = await gesperrtesVerzeichniskonto(b);
      const schritte: { method: "PATCH" | "PUT"; payload: string }[] = [
        { method: "PATCH", payload: patch([{ op: "replace", path: "active", value: true }]) },
        { method: "PATCH", payload: patch([{ op: "Replace", path: "active", value: "False" }]) },
        { method: "PATCH", payload: patch([{ op: "replace", path: "active", value: true }]) },
        {
          method: "PATCH",
          payload: patch([{ op: "replace", path: "roles", value: [{ value: "klara-admins" }] }]),
        },
        { method: "PUT", payload: scimNutzer(["klara-pruefer"], true) },
      ];
      for (const schritt of schritte) {
        const res = await b.app.inject({
          method: schritt.method,
          url: `/scim/v2/Users/${id}`,
          headers: SCIM,
          payload: schritt.payload,
        });
        expect(res.statusCode, `${schritt.method} ${schritt.payload}: ${res.body}`).toBe(200);
        await bleibtGesperrt(b, id, token);
      }
    } finally {
      await b.app.close();
    }
  });

  it("S2 Reimport derselben Adresse ist 409 und stellt den gesperrten Zugang nicht wieder her", async () => {
    const b = await buehne();
    try {
      const { id, token } = await gesperrtesVerzeichniskonto(b);
      const erneut = await b.app.inject({
        method: "POST",
        url: "/scim/v2/Users",
        headers: SCIM,
        payload: scimNutzer(["klara-admins"]),
      });
      expect(erneut.statusCode, erneut.body).toBe(409);
      expect((await b.service.kontoLesen(id))?.role).toBe("controller");
      await bleibtGesperrt(b, id, token);
    } finally {
      await b.app.close();
    }
  });

  it("S3 Gegenprobe: erst die befugte Änderung des Admins (Befristung nehmen) öffnet wieder", async () => {
    const b = await buehne();
    try {
      const { id } = await gesperrtesVerzeichniskonto(b);
      await b.service.setAccessExpiry(id, undefined, b.admin.id);
      expect((await b.service.kontoLesen(id))?.accessExpiresAt).toBeUndefined();
      const { token } = await firmenLogin(b.service);
      expect(await me(b.app, token)).toBe(200);
    } finally {
      await b.app.close();
    }
  });
});
