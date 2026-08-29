// ================================================================================================
// JOB 2686 D3 — DER ECHTE SERVER FÜR DIE UI-KETTE
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist ein eigenständiger Serverprozess, den der gemountete
// UI-Test startet — so, wie im Betrieb ein Browser gegen einen Serverprozess läuft.
//
// WARUM ALS EIGENER PROZESS UND NICHT ALS IMPORT: Der Wächter
// `tests/capture/draft-limits-shared.test.ts` verlangt „keine Datei unter apps/web/src importiert
// aus services/" — mit der Begründung, dass rollup diese Pfade beim Bündeln der Weboberfläche
// nicht auflösen kann. Ein gemounteter UI-Test darf den Serverweg also nicht importieren. Und
// unter `tests/` ist `react` nicht auflösbar (React liegt in `apps/web/node_modules`).
//
// Zwischen beiden Seiten liegt damit genau eine erlaubte Verbindung: DIE, DIE ES IM BETRIEB AUCH
// GIBT — eine HTTP-Grenze. Der UI-Test startet diesen Prozess und spricht ihn über echtes HTTP an.
// Er importiert nichts aus `services/`; er kennt nur einen Port.
//
// WAS HIER ECHT IST: `authRoutes`, `AuthService`, `AuditService`, der OIDC-Verifier samt
// Signaturprüfung über ein lokales JWKS, alle Repos, alle Cookies, alle Statuscodes.
// WAS ERSETZT IST: der Identitätsanbieter. Er läuft nicht im Netz, sondern hier — er nimmt den
// `nonce` aus dem Autorisierungsaufruf entgegen und gibt ihn im signierten Token zurück, genau wie
// ein echter. Die SIGNATUR ist echt und wird vom Produktcode geprüft.
//
// Aufruf: node_modules/.bin/tsx tests/helpers/job2686-sso-server.ts <szenario>
// Ausgabe auf stdout: PORT=<nummer>

import Fastify from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  type User,
  authRoutes,
  createOidcProvider,
} from "../../services/auth";

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";

interface Szenario {
  konten: User[];
  claims: Record<string, unknown>;
}

function konto(over: Partial<User>): User {
  return {
    id: "u",
    name: "Mensch",
    email: "mensch@firma.de",
    passwordSalt: "salt",
    passwordHash: "hash",
    role: "viewer",
    approved: true,
    createdAt: new Date(0).toISOString(),
    ...over,
  };
}

const SZENARIEN: Record<string, Szenario> = {
  // Die Chefin hat ein Bestandskonto aus der Zeit vor der Migration: SSO-Konto (kein Passwort),
  // noch ohne `sub`. Ihr Anbieter sendet `email_verified` NICHT — Entra ID, Keycloak.
  bestandskonto: {
    konten: [
      konto({
        id: "u-chefin",
        name: "Die Chefin",
        email: "chefin@firma.de",
        passwordSalt: "",
        passwordHash: "",
        role: "controller",
      }),
    ],
    claims: { sub: "chefin-idp", email: "chefin@firma.de", name: "Die Chefin" },
  },
  // Der Angreifer traegt die Adresse der Chefin UNVERIFIZIERT im eigenen Anbieter.
  angreifer: {
    konten: [
      konto({
        id: "u-admin",
        name: "Die Chefin",
        email: "admin@firma.de",
        role: "admin",
      }),
    ],
    claims: {
      sub: "angreifer",
      email: "admin@firma.de",
      name: "Nicht die Chefin",
      email_verified: false,
    },
  },
  // Bob war Admin und ist im Anbieter aus der Admin-Gruppe geflogen. Das erste Konto ist ein
  // Passwortkonto, damit Bob nicht der Bootstrap-Admin ist.
  herabgestuft: {
    konten: [
      konto({ id: "u-erst", name: "Erst", email: "erst@firma.de", role: "admin" }),
      konto({
        id: "u-bob",
        name: "Bob",
        email: "bob@firma.de",
        passwordSalt: "",
        passwordHash: "",
        role: "admin",
        oidcIssuer: ISSUER,
        oidcSubject: "bob",
      }),
    ],
    claims: {
      sub: "bob",
      email: "bob@firma.de",
      name: "Bob",
      email_verified: true,
      roles: ["gast"],
    },
  },
};

async function start(): Promise<void> {
  const name = process.argv[2] ?? "";
  const szenario = SZENARIEN[name];
  if (!szenario) {
    process.stderr.write(`Unbekanntes Szenario: ${name}\n`);
    process.exit(2);
  }

  const users = new InMemoryUserRepo();
  for (const k of szenario.konten) {
    await users.insert(k);
  }
  const auditRepo = new InMemoryAuditRepo();
  const service = new AuthService({
    users,
    sessions: new InMemorySessionRepo(),
    audit: new AuditService({ repo: auditRepo }),
  });

  // Echtes Schluesselpaar, lokales JWKS. Der Produktcode prueft die Signatur wirklich.
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  const jwks = createLocalJWKSet({ keys: [jwk] });

  // Der Anbieter merkt sich den `nonce` aus dem Autorisierungsaufruf und gibt ihn im Token
  // zurueck — genau das tut ein echter IdP. Ohne diese Rueckgabe schluege die Nonce-Pruefung des
  // Produktcodes fehl, und die waere dann nicht geprueft, sondern umgangen.
  let letzterNonce = "";

  const basis = createOidcProvider(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUri: "x",
      authorizeUrl: `${ISSUER}/authorize`,
      tokenUrl: `${ISSUER}/token`,
      clientId: AUDIENCE,
      redirectUri: "http://127.0.0.1/sso/callback",
      autoProvision: true,
      roles: { roleClaim: "roles", adminGroup: "kw-admin", controllerGroup: "kw-ctrl" },
    },
    {
      keyResolver: jwks,
      tokenExchanger: async () =>
        new SignJWT({ nonce: letzterNonce, ...szenario.claims })
          .setProtectedHeader({ alg: "RS256", kid: "test-key" })
          .setIssuer(ISSUER)
          .setAudience(AUDIENCE)
          .setExpirationTime("1h")
          .sign(privateKey),
    },
  );

  const provider = {
    ...basis,
    authorizeUrl: (p: { state: string; nonce: string; codeChallenge: string }) => {
      letzterNonce = p.nonce;
      return basis.authorizeUrl(p);
    },
  };

  const app = Fastify();
  await app.register(authRoutes(service, { oidc: provider }));

  // Ein Fenster in das Pruefprotokoll — NUR fuer den Test, deshalb hier und nicht im Produktcode.
  // Der UI-Test belegt damit, dass die Verknuepfung ohne bestaetigte Adresse eine Spur hinterlaesst.
  app.get("/pruefprotokoll", async () => ({
    aktionen: (await auditRepo.all()).map((e) => e.action),
  }));

  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address();
  const port = typeof adresse === "object" && adresse ? adresse.port : 0;
  process.stdout.write(`PORT=${port}\n`);
}

start().catch((fehler: unknown) => {
  process.stderr.write(`Serverstart gescheitert: ${String(fehler)}\n`);
  process.exit(1);
});
