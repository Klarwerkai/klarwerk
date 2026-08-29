// ================================================================================================
// JOB 2686 D1 — WER DIE MAILADRESSE HAT, IST NOCH NICHT DER MENSCH
// ================================================================================================
//
// Pedis Frage, woertlich: „Kann jemand mit einer fremden Mailadresse als Admin hereinkommen?"
//
// Die Faelle stehen DORT, WO DER MENSCH HANDELT: an der Route `POST /api/auth/oidc`, die der
// Browser nach dem Klick auf „Mit SSO anmelden" aufruft — mit echten Cookies, echtem
// State/Nonce-Abgleich und echter Signaturpruefung (lokales JWKS, kein Netz). BEN in 2614 D4:
// ein Beleg am Dienst allein ist ein Scheinbeleg.
//
// DIE EHRLICHE GRENZE: SSO ist heute nicht in Betrieb. Gegen einen ECHTEN Identitaetsanbieter ist
// hier nichts gemessen. Was gemessen ist: die Strecke von einem signierten Token bis zur Sitzung —
// gegen den Fake-Verifier, den der Befund selbst als Nachweis nennt.

import Fastify, { type FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  type OidcConfig,
  type User,
  authRoutes,
  createOidcProvider,
  oidcSessionTtlMs,
} from "../../services/auth";

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";
const NONCE = "nonce-fest";
const STATE = "state-fest";

// Ein Schluesselpaar fuer alle Faelle — die Signatur ist echt, der Schluessel liegt lokal.
const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
jwk.alg = "RS256";
const JWKS = createLocalJWKSet({ keys: [jwk] });

async function idToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT({ nonce: NONCE, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(privateKey);
}

function oidcConfig(over: Partial<OidcConfig> = {}): OidcConfig {
  return {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUri: "x",
    authorizeUrl: "https://idp.example.com/authorize",
    tokenUrl: "https://idp.example.com/token",
    clientId: AUDIENCE,
    redirectUri: "https://app.klarwerk.ai/sso/callback",
    autoProvision: true,
    roles: { roleClaim: "roles", adminGroup: "kw-admin", controllerGroup: "kw-ctrl" },
    ...over,
  };
}

interface Aufbau {
  app: FastifyInstance;
  users: InMemoryUserRepo;
  audit: AuditService;
  auditRepo: InMemoryAuditRepo;
  anmelden: (token: string) => Promise<{ status: number; body: Record<string, unknown> }>;
}

async function baueApp(over: Partial<OidcConfig> = {}): Promise<Aufbau> {
  const users = new InMemoryUserRepo();
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo });
  const service = new AuthService({ users, sessions: new InMemorySessionRepo(), audit });

  // Der Tausch am Token-Endpoint ist ersetzt (kein Netz); die VERIFIKATION laeuft echt gegen das
  // lokale JWKS — Signatur, Issuer, Audience und Nonce werden wirklich geprueft.
  let ausgegeben = "";
  const provider = createOidcProvider(oidcConfig(over), {
    keyResolver: JWKS,
    tokenExchanger: async () => ausgegeben,
  });

  const app = Fastify();
  await app.register(authRoutes(service, { oidc: provider }));
  await app.ready();

  return {
    app,
    users,
    audit,
    auditRepo,
    anmelden: async (token: string) => {
      ausgegeben = token;
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/oidc",
        headers: {
          cookie: `kw_oidc_state=${STATE}; kw_oidc_nonce=${NONCE}; kw_oidc_verifier=verifier-fest`,
        },
        payload: { code: "der-code", state: STATE },
      });
      return { status: res.statusCode, body: res.json() as Record<string, unknown> };
    },
  };
}

function kontoAus(over: Partial<User> = {}): User {
  return {
    id: "u-admin",
    name: "Die Chefin",
    email: "admin@firma.de",
    passwordSalt: "salt",
    passwordHash: "hash",
    role: "admin",
    approved: true,
    createdAt: new Date(0).toISOString(),
    ...over,
  };
}

// ================================================================================================
describe("JOB 2686 · R2-7 — die E-Mail-Adresse allein ist keine Identitaet", () => {
  let a: Aufbau;
  beforeEach(async () => {
    a = await baueApp();
  });

  it("unverifizierte admin@-Adresse kommt NICHT als Admin herein (401)", async () => {
    // Das Konto der echten Chefin — Passwortkonto, Admin.
    await a.users.insert(kontoAus());

    // Der Angreifer traegt dieselbe Adresse UNVERIFIZIERT im eigenen Identitaetsanbieter.
    const antwort = await a.anmelden(
      await idToken({ sub: "attacker", email: "admin@firma.de", email_verified: false }),
    );

    expect(antwort.status).toBe(401);
    expect(antwort.body.token).toBeUndefined();
    expect(antwort.body.user).toBeUndefined();
  });

  it("ein fremdes sub erbt kein bereits verknuepftes Konto (401)", async () => {
    // Das Konto ist bereits an eine Identitaet gebunden.
    await a.users.insert(kontoAus({ oidcIssuer: ISSUER, oidcSubject: "alice" }));

    // Selbe Adresse, VERIFIZIERT — aber eine andere Person dahinter.
    const antwort = await a.anmelden(
      await idToken({ sub: "mallory", email: "admin@firma.de", email_verified: true }),
    );

    expect(antwort.status).toBe(401);
    expect(antwort.body.user).toBeUndefined();
  });

  it("ein fehlendes sub wird abgewiesen (401)", async () => {
    // Ohne `sub` faellt `String(payload.sub ?? "")` heute auf den leeren String — und der galt
    // bisher als gueltige Identitaet.
    await a.users.insert(kontoAus());
    const antwort = await a.anmelden(
      await idToken({ email: "admin@firma.de", email_verified: true }),
    );
    expect(antwort.status).toBe(401);
  });

  it("fehlt der email_verified-Claim ganz, bleibt die Anmeldung moeglich", async () => {
    // Nicht jeder Anbieter sendet den Claim. Wer ihn nicht sendet, wird nicht ausgesperrt.
    await a.users.insert(kontoAus({ oidcIssuer: ISSUER, oidcSubject: "chefin" }));
    const antwort = await a.anmelden(
      await idToken({ sub: "chefin", email: "admin@firma.de", roles: ["kw-admin"] }),
    );
    expect(antwort.status).toBe(200);
    expect((antwort.body.user as { role: string }).role).toBe("admin");
  });

  it("UEBERGANGSWEG: ein Bestandskonto ohne sub wird beim ersten Anmelden verknuepft", async () => {
    // Genau die Menschen, die der Fix schuetzen soll, duerfen nicht ausgesperrt werden.
    await a.users.insert(kontoAus({ passwordHash: "", passwordSalt: "" }));

    const antwort = await a.anmelden(
      await idToken({ sub: "chefin-neu", email: "admin@firma.de", email_verified: true }),
    );

    expect(antwort.status).toBe(200);
    const konto = await a.users.findByEmail("admin@firma.de");
    expect(konto?.oidcSubject).toBe("chefin-neu");
    expect(konto?.oidcIssuer).toBe(ISSUER);
  });

  // JOB 2686 D2: DER NAME DIESES FALLS WAR FALSCH und hat eine Abdeckung behauptet, die es nicht
  // gab. Er hiess „greift NICHT ohne email_verified", uebergibt aber `email_verified: false` — den
  // VORHANDENEN und falschen Claim. Der FEHLENDE Claim war nie geprueft, obwohl der Name das
  // versprach. Die Aussage unten stimmt und bleibt; nur heisst der Fall jetzt, was er tut.
  it("UEBERGANGSWEG greift NICHT bei email_verified: false", async () => {
    await a.users.insert(kontoAus({ passwordHash: "", passwordSalt: "" }));
    const antwort = await a.anmelden(
      await idToken({ sub: "wer-auch-immer", email: "admin@firma.de", email_verified: false }),
    );
    expect(antwort.status).toBe(401);
    const konto = await a.users.findByEmail("admin@firma.de");
    expect(konto?.oidcSubject).toBeUndefined();
  });

  // JOB 2686 D2 — Pedis Entscheidung vom 29.08., Ownerfrage 3:
  // „Ein fehlender Claim ist keine Aussage ueber die Adresse."
  //
  // Der Angriff aus R2-7 braucht eine UNVERIFIZIERTE Adresse. Ein Anbieter, der den Claim gar
  // nicht fuehrt (Entra ID, Keycloak in Standardkonfiguration), vergibt Adressen durch die IT —
  // dort gibt es den Angreifer nicht, den die strenge Auslegung abwehren soll. Den fehlenden
  // Claim wie ein `false` zu behandeln sperrt ausgerechnet im sichersten Fall alle aus.
  it("UEBERGANGSWEG: fehlt der Claim ganz, wird verknuepft — mit Spur im Pruefprotokoll", async () => {
    await a.users.insert(kontoAus({ passwordHash: "", passwordSalt: "" }));

    const antwort = await a.anmelden(
      await idToken({ sub: "chefin-ohne-claim", email: "admin@firma.de" }),
    );

    expect(antwort.status).toBe(200);
    const konto = await a.users.findByEmail("admin@firma.de");
    expect(konto?.oidcSubject).toBe("chefin-ohne-claim");
    expect(konto?.oidcIssuer).toBe(ISSUER);

    // Der Preis der Nachsicht: die Verknuepfung ohne bestaetigte Adresse ist nachlesbar. Wer
    // spaeter merkt, dass sein Anbieter doch freie Adressen erlaubte, findet die Liste.
    const spur = await a.audit.list({ action: "user.oidc-linked-unverified" });
    expect(spur).toHaveLength(1);
    expect(await a.audit.list({ action: "user.oidc-linked" })).toHaveLength(0);
  });

  it("mit bestaetigter Adresse entsteht die gewoehnliche Verknuepfungsspur", async () => {
    // Die Gegenprobe zum Fall darueber: mit `true` darf NICHT der Unverified-Eintrag entstehen,
    // sonst waere die Liste wertlos, weil alles darin steht.
    await a.users.insert(kontoAus({ passwordHash: "", passwordSalt: "" }));
    await a.anmelden(
      await idToken({ sub: "chefin-neu", email: "admin@firma.de", email_verified: true }),
    );

    expect(await a.audit.list({ action: "user.oidc-linked" })).toHaveLength(1);
    expect(await a.audit.list({ action: "user.oidc-linked-unverified" })).toHaveLength(0);
  });
});

// ================================================================================================
describe("JOB 2686 · R2-8 — ein Claim darf Rechte nehmen, nie geben", () => {
  it("wer im Anbieter herabgestuft wird, ist beim naechsten Anmelden auch in Klara Betrachter", async () => {
    const a = await baueApp();
    // Ein zweites Konto vorweg, damit das SSO-Konto NICHT der Bootstrap-Admin wird.
    await a.users.insert(kontoAus({ id: "u-erst", email: "erst@firma.de" }));

    // Erste Anmeldung: der Anbieter meldet die Admin-Gruppe.
    const erste = await a.anmelden(
      await idToken({
        sub: "bob",
        email: "bob@firma.de",
        email_verified: true,
        roles: ["kw-admin"],
      }),
    );
    expect(erste.status).toBe(200);
    expect((erste.body.user as { role: string }).role).toBe("admin");

    // Zweite Anmeldung: im Anbieter aus der Admin-Gruppe entfernt.
    const zweite = await a.anmelden(
      await idToken({ sub: "bob", email: "bob@firma.de", email_verified: true, roles: [] }),
    );

    expect(zweite.status).toBe(200);
    expect((zweite.body.user as { role: string }).role).toBe("viewer");

    // Und es bleibt eine Spur — sonst merkt es in der Nutzerverwaltung niemand.
    const spur = await a.audit.list({ action: "user.role-synced" });
    expect(spur).toHaveLength(1);
    expect(spur[0]?.payload).toMatchObject({ von: "admin", nach: "viewer" });
  });

  it("NIE HOCHSTUFEN: ein Admin-Claim hebt ein Betrachterkonto nicht an", async () => {
    const a = await baueApp();
    await a.users.insert(kontoAus({ id: "u-erst", email: "erst@firma.de" }));
    await a.users.insert(
      kontoAus({
        id: "u-view",
        email: "view@firma.de",
        role: "viewer",
        passwordHash: "",
        passwordSalt: "",
        oidcIssuer: ISSUER,
        oidcSubject: "view",
      }),
    );

    const antwort = await a.anmelden(
      await idToken({
        sub: "view",
        email: "view@firma.de",
        email_verified: true,
        roles: ["kw-admin"],
      }),
    );

    expect(antwort.status).toBe(200);
    expect((antwort.body.user as { role: string }).role).toBe("viewer");
    expect(await a.audit.list({ action: "user.role-synced" })).toHaveLength(0);
  });

  it("ein Passwortkonto wird vom Claim NICHT angetastet", async () => {
    // Nur SSO-Konten (passwordHash === "") folgen dem Anbieter. Ein vom Admin von Hand
    // vergebenes Passwortkonto behaelt seine Rolle.
    const a = await baueApp();
    await a.users.insert(kontoAus({ id: "u-erst", email: "erst@firma.de" }));
    await a.users.insert(
      kontoAus({ id: "u-pw", email: "pw@firma.de", oidcIssuer: ISSUER, oidcSubject: "pw" }),
    );

    const antwort = await a.anmelden(
      await idToken({ sub: "pw", email: "pw@firma.de", email_verified: true, roles: [] }),
    );

    expect(antwort.status).toBe(200);
    expect((antwort.body.user as { role: string }).role).toBe("admin");
  });

  it("die Sitzungsdauer bleibt in der Vorgabe unveraendert bei 14 Tagen", async () => {
    // Der Befund schlaegt 12 Stunden vor. Das ist eine Produktentscheidung — sie aendert, wie oft
    // sich ein Mensch anmelden muss. Der Schalter ist gebaut, die VORGABE aendert nichts, und
    // genau das nagelt dieser Fall fest: dieser Bau verkuerzt niemandem still die Sitzung.
    const vierzehnTage = 14 * 24 * 60 * 60 * 1000;
    expect(oidcSessionTtlMs({})).toBe(vierzehnTage);
    expect(oidcSessionTtlMs({ OIDC_SESSION_TTL_HOURS: "" })).toBe(vierzehnTage);
    // Unbrauchbare Angaben fallen auf die Vorgabe zurueck, statt eine Sitzung zu bauen, die
    // sofort abgelaufen ist — das saehe wie ein kaputtes Anmelden aus, nicht wie ein Tippfehler.
    expect(oidcSessionTtlMs({ OIDC_SESSION_TTL_HOURS: "0" })).toBe(vierzehnTage);
    expect(oidcSessionTtlMs({ OIDC_SESSION_TTL_HOURS: "-3" })).toBe(vierzehnTage);
    expect(oidcSessionTtlMs({ OIDC_SESSION_TTL_HOURS: "keine-zahl" })).toBe(vierzehnTage);
    // Und wenn Pedi sich entscheidet, wirkt er.
    expect(oidcSessionTtlMs({ OIDC_SESSION_TTL_HOURS: "12" })).toBe(12 * 60 * 60 * 1000);
  });

  it("fehlt der Rollen-Claim ganz, entsteht ein Hinweis statt Schweigen", async () => {
    const a = await baueApp();
    await a.users.insert(kontoAus({ id: "u-erst", email: "erst@firma.de" }));
    await a.users.insert(
      kontoAus({
        id: "u-sso",
        email: "sso@firma.de",
        role: "controller",
        passwordHash: "",
        passwordSalt: "",
        oidcIssuer: ISSUER,
        oidcSubject: "sso",
      }),
    );

    await a.anmelden(await idToken({ sub: "sso", email: "sso@firma.de", email_verified: true }));

    const hinweis = await a.audit.list({ action: "user.role-claim-missing" });
    expect(hinweis).toHaveLength(1);
  });
});
