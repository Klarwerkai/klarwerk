// ==================================================================================================
// AUFNAHME 20260922 · confluence-import-rechte (R-0549) — DIE LESERLISTE AUS DER QUELLE, ALS SQL.
// ==================================================================================================
//
// `darfSehen` hat einen neuen ersten Zweig: trägt ein Objekt `quellrechte.leser`, entscheidet nur
// diese Liste (seit Nacharbeit 3 ohne Autorausnahme). `sqlSichtbarkeitFuer` trägt denselben Zweig
// als CASE im Prädikat. Zwei Formen derselben Regel brauchen denselben Beleg wie BASIC 380: ein
// ECHTES Postgres und Mengengleichheit über den vollständigen Kreuzbestand, nicht eine Stichprobe.
//
//   {ohne Quellrechte, leere Liste, [Lea], [Lea, Carl]} × {intern, vertraulich} × {Admin, leer}
//   × {lebend, getrasht} — gelesen von {Lea, Carl, Otto, Admin} × {viewer, controller, admin}
//
// P3: die Quellrechte überstehen einen NEUEN Pool unverändert (Ablage im JSONB-Dokument).
//
// W1 (Nacharbeit 3, Ben, K4/K5): der REGULÄRE Weg — Import, Annahme, Versionsabgleich über die
// Postgres-Komposition der App in diesem Prozess; danach wird diese Anwendung beendet und ein
// EIGENER Serverprozess (`node … services/app/src/server.ts`, Bauform
// `tests/wiki-bearbeitungsreservierung/zwei-prozesse-pg-im-browser.integration.test.ts`) gegen
// DIESELBE Datenbank gestartet. Verglichen werden KO-Identität, Quellanker, Version, Einstufung,
// Leserliste und die erlaubten/verweigerten Lesezugriffe vor und nach dem Neustart.
//
// Braucht Docker (Testcontainers); läuft unter `npm run test:integration`.
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import {
  type Confidentiality,
  type KnowledgeObject,
  type KoQuellrechte,
  PgKoRepo,
} from "../../services/knowledge-object";
import { adapterFromConfig } from "../support/confluence-adapter";

const LEA = "u-lea";
const CARL = "u-carl";
const OTTO = "u-otto";
const ADMIN = "u-admin";

const RECHTE: readonly (Omit<KoQuellrechte, "stufe"> | undefined)[] = [
  undefined,
  { leser: [] },
  { leser: [LEA] },
  { leser: [LEA, CARL] },
];
const STUFEN: readonly Confidentiality[] = ["intern", "vertraulich"];
const AUTOREN: readonly string[] = [ADMIN, ""];
const ROLLEN: readonly Role[] = ["viewer", "controller", "admin"];
const BETRACHTER: readonly string[] = [LEA, CARL, OTTO, ADMIN];

function kreuzbestand(): KnowledgeObject[] {
  const out: KnowledgeObject[] = [];
  for (const [ri, rechte] of RECHTE.entries()) {
    for (const stufe of STUFEN) {
      for (const [ai, autor] of AUTOREN.entries()) {
        for (const getrasht of [false, true]) {
          out.push({
            id: `q-${ri}-${stufe}-${ai}-${getrasht ? "trash" : "live"}`,
            title: "Seite",
            statement: "Inhalt.",
            conditions: [],
            measures: [],
            type: "best_practice",
            category: "K",
            tags: [],
            confidence: 50,
            trust: 50,
            status: "offen",
            version: 1,
            originalAuthor: autor,
            author: autor,
            neededValidations: 1,
            assignments: [],
            asset: null,
            createdAt: "2026-10-03T10:00:00.000Z",
            history: [],
            comments: [],
            attachments: [],
            sources: [],
            confidentiality: stufe,
            ...(rechte ? { quellrechte: { stufe, ...rechte } } : {}),
            ...(getrasht ? { deletedAt: "2026-10-03T11:00:00.000Z" } : {}),
          } as KnowledgeObject);
        }
      }
    }
  }
  return out;
}

describe("R-0549 · SQL-Trim und darfSehen sind auch mit Quelllesern dieselbe Regel", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
      await pool.query("DELETE FROM kos");
      for (const k of kreuzbestand()) {
        await pool.query("INSERT INTO kos(id,type,status,category,data) VALUES($1,$2,$3,$4,$5)", [
          k.id,
          k.type,
          k.status,
          k.category,
          JSON.stringify(k),
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("P1 · Listen- und Suchweg liefern für jeden Betrachter genau die Menge von darfSehen", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.list({});
      expect(alle).toHaveLength(RECHTE.length * STUFEN.length * AUTOREN.length * 2);
      let geprueft = 0;
      for (const role of ROLLEN) {
        for (const id of BETRACHTER) {
          const user: SessionUser = { id, role };
          const ausRegel = alle
            .filter((k) => !k.deletedAt && darfSehen(user, k))
            .map((k) => k.id)
            .sort();
          const ausListe = (await repo.list({}, sqlSichtbarkeitFuer(user))).map((k) => k.id).sort();
          const ausSuche = (await repo.listForSearch({}, sqlSichtbarkeitFuer(user)))
            .map((k) => k.id)
            .sort();
          expect(ausListe, `Liste — ${role}/${id}`).toEqual(ausRegel);
          expect(ausSuche, `Suche — ${role}/${id}`).toEqual(ausRegel);
          geprueft += 1;
        }
      }
      expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length);
    } finally {
      await pool.end();
    }
  });

  it("P2 · Anti-Vakuum: die Leserliste schliesst den Controller aus und lässt die Leserin ein", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const id = "q-2-vertraulich-0-live"; // Leser [Lea], vertraulich, Autor Admin, lebend
      const carl = await repo.list({}, sqlSichtbarkeitFuer({ id: CARL, role: "controller" }));
      const lea = await repo.list({}, sqlSichtbarkeitFuer({ id: LEA, role: "viewer" }));
      expect(carl.map((k) => k.id)).not.toContain(id);
      expect(lea.map((k) => k.id)).toContain(id);
      // Ohne Leserliste bleibt die Stufenregel: dieselbe Stufe, der Controller sieht sie.
      expect(carl.map((k) => k.id)).toContain("q-0-vertraulich-0-live");
      // Nacharbeit 3 (Befund F2): der AUTOR ohne Quellrecht sieht das Objekt auch im SQL nicht.
      const autor = await repo.list({}, sqlSichtbarkeitFuer({ id: ADMIN, role: "admin" }));
      expect(autor.map((k) => k.id)).not.toContain(id);
    } finally {
      await pool.end();
    }
  });

  it("P3 · die Quellrechte stehen nach einem neuen Pool unverändert im Dokument", async () => {
    const pool = createPool(url);
    try {
      const geladen = await new PgKoRepo(pool).findById("q-3-vertraulich-0-live");
      expect(geladen?.quellrechte).toEqual({ stufe: "vertraulich", leser: [LEA, CARL] });
    } finally {
      await pool.end();
    }
  });
});

// ==================================================================================================
// W1 · DER REGULÄRE WEG ÜBER EINEN ECHTEN NEUSTART DES SERVERPROZESSES (K4/R-0182, K5/R-0649).
// ==================================================================================================

const WURZEL = join(__dirname, "..", "..");
const BASIS_CONFLUENCE = "https://acme.atlassian.net/wiki";
const PASSWORT = "geheim-1234";

function confluenceSeite(
  id: string,
  version: number,
  inhalt: string,
  leserEmails?: string[],
): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>${inhalt}</p>` } },
    version: { number: version },
    _links: { webui: `/spaces/K/pages/${id}` },
    ancestors: [],
    ...(leserEmails
      ? {
          restrictions: {
            read: {
              restrictions: {
                user: { results: leserEmails.map((email) => ({ accountId: email, email })) },
                group: { results: [] },
              },
            },
          },
        }
      : {}),
  };
}

/** Fixture-Confluence: anonym lesbarer Space, Listing liefert `seiten`. */
function adapterFuer(seiten: ConfluencePage[]) {
  const antwort = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
  const fetchFn = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    const einzeln = /\/rest\/api\/content\/([^/]+)$/.exec(u.pathname);
    if (einzeln) {
      const s = seiten.find((p) => p.id === decodeURIComponent(einzeln[1] ?? ""));
      return s ? antwort(200, s) : antwort(404, {});
    }
    if (u.pathname.endsWith("/rest/api/space/K")) {
      return antwort(200, {
        permissions: [
          {
            operation: { operation: "read", targetType: "space" },
            anonymousAccess: true,
            subjects: { user: { results: [] }, group: { results: [] } },
          },
        ],
      });
    }
    return antwort(200, { results: seiten });
  }) as unknown as typeof fetch;
  return adapterFromConfig({
    baseUrl: BASIS_CONFLUENCE,
    email: "svc@acme.test",
    apiToken: "fixture-token",
    spaceKey: "K",
    fetchFn,
  });
}

function freierPort(): Promise<number> {
  return new Promise((ok, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "127.0.0.1", () => {
      const adresse = s.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      s.close(() => ok(port));
    });
  });
}

/** Der echte Serverprozess — `server.ts` wie im Betrieb, nur Datenbank und Port gesetzt. */
async function starteServer(
  datenbankUrl: string,
  port: number,
): Promise<{ kind: ChildProcess; basis: string }> {
  let puffer = "";
  const kind = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: WURZEL,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      KLARWERK_SKIP_KEYCHAIN: "1",
      NODE_ENV: "test",
      DATABASE_URL: datenbankUrl,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const nimm = (d: Buffer): void => {
    puffer = `${puffer}${d.toString("utf8")}`.slice(-6000);
  };
  kind.stdout?.on("data", nimm);
  kind.stderr?.on("data", nimm);
  const basis = `http://127.0.0.1:${port}`;
  const ende = Date.now() + 120_000;
  while (Date.now() < ende) {
    if (kind.exitCode !== null) {
      throw new Error(`Serverprozess endete beim Start (Code ${kind.exitCode}):\n${puffer}`);
    }
    try {
      if ((await fetch(`${basis}/health`)).status === 200) {
        return { kind, basis };
      }
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  kind.kill("SIGKILL");
  throw new Error(`Serverprozess wurde in 120 s nicht bereit:\n${puffer}`);
}

async function beendeServer(kind: ChildProcess | undefined): Promise<void> {
  if (!kind || kind.exitCode !== null) {
    return;
  }
  const weg = new Promise<void>((ok) => kind.once("exit", () => ok()));
  kind.kill("SIGTERM");
  const frist = setTimeout(() => kind.kill("SIGKILL"), 10_000);
  await weg;
  clearTimeout(frist);
}

/** Was über ein Objekt nach dem Neustart gleich sein muss. */
interface Objektstand {
  id: string;
  version: number | undefined;
  confidentiality: unknown;
  leser: string[] | null;
}

function standAus(ko: {
  id: string;
  confidentiality?: unknown;
  sources?: { externalId?: string; sourceVersion?: number }[];
  quellrechte?: { leser?: string[] };
}): Objektstand {
  return {
    id: ko.id,
    version: ko.sources?.find((s) => s.externalId !== undefined)?.sourceVersion,
    confidentiality: ko.confidentiality,
    leser: ko.quellrechte?.leser ? [...ko.quellrechte.leser].sort() : null,
  };
}

describe("K4/K5 · Import, Annahme und Versionsabgleich überstehen den Neustart des Serverprozesses", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("W1 · offene und eingeschränkte Seite, Versionsabgleich, Neustart: gleiche Identität, gleiche Rechte, gleiche Zugriffe", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const konten = {
      lea: { name: "Lea", email: "lea@example.com", role: "viewer" },
      carl: { name: "Carl", email: "carl@example.com", role: "controller" },
      otto: { name: "Otto", email: "otto@example.com", role: "viewer" },
    } as const;
    const admin = { name: "Admin W1", email: "admin-w1@example.com", password: PASSWORT };

    // ---------------- PHASE 1 · Anwendung (Postgres-Komposition) in DIESEM Prozess ----------------
    const pool = createPool(url);
    const dienste = buildPgServices(pool);
    const app = buildApp(dienste);
    const ids: Record<string, string> = {};
    const stand: Record<string, Objektstand> = {};
    const zugriffVorher: Record<string, number> = {};
    let koOffen = "";
    let koZu = "";
    try {
      await app.inject({ method: "POST", url: "/api/auth/register", payload: admin });
      const adminLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: admin.email, password: admin.password },
      });
      const adminHeaders = {
        authorization: `Bearer ${(adminLogin.json() as { token: string }).token}`,
      };
      const nutzer = await app.inject({ method: "GET", url: "/api/users", headers: adminHeaders });
      ids.admin = (nutzer.json() as { id: string }[])[0]?.id ?? "";
      for (const [schluessel, konto] of Object.entries(konten)) {
        const angelegt = await app.inject({
          method: "POST",
          url: "/api/users",
          headers: adminHeaders,
          payload: { ...konto, password: PASSWORT },
        });
        expect(angelegt.statusCode, angelegt.body).toBe(201);
        ids[schluessel] = (angelegt.json() as { id: string }).id;
      }

      // v1: „700" offen, „701" nur für Lea.
      const v1 = await adapterFuer([
        confluenceSeite("700", 1, "Offen, Stand 1."),
        confluenceSeite("701", 1, "Nur Lea, Stand 1.", ["lea@example.com"]),
      ]).collectAll();
      for (const k of await dienste.library.createImportCandidates(v1.items, ids.admin ?? "")) {
        const r = await dienste.library.reviewImportCandidate(k.id, "accept", ids.admin ?? "");
        if (k.item.externalId === "700") {
          koOffen = r.koId ?? "";
        } else {
          koZu = r.koId ?? "";
        }
      }
      // v2: „700" wird auf Otto beschränkt und bekommt neuen Inhalt — der Versionsabgleich.
      const v2 = await adapterFuer([
        confluenceSeite("700", 2, "Jetzt nur Otto, Stand 2.", ["otto@example.com"]),
      ]).collectAll();
      const [k2] = await dienste.library.createImportCandidates(v2.items, ids.admin ?? "");
      const r2 = await dienste.library.reviewImportCandidate(k2!.id, "accept", ids.admin ?? "");
      expect(r2.koId).toBe(koOffen);

      for (const koId of [koOffen, koZu]) {
        const ko = await dienste.ko.get(koId);
        expect(ko, koId).toBeDefined();
        stand[koId] = standAus(ko as Parameters<typeof standAus>[0]);
      }
      expect(stand[koOffen]).toEqual({
        id: koOffen,
        version: 2,
        confidentiality: "vertraulich",
        leser: [ids.otto],
      });
      expect(stand[koZu]).toEqual({
        id: koZu,
        version: 1,
        confidentiality: "vertraulich",
        leser: [ids.lea],
      });

      for (const schluessel of ["lea", "carl", "otto"] as const) {
        const login = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: konten[schluessel].email, password: PASSWORT },
        });
        const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
        for (const koId of [koOffen, koZu]) {
          const r = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
          zugriffVorher[`${schluessel}:${koId}`] = r.statusCode;
        }
      }
      for (const koId of [koOffen, koZu]) {
        const r = await app.inject({
          method: "GET",
          url: `/api/kos/${koId}`,
          headers: adminHeaders,
        });
        zugriffVorher[`admin:${koId}`] = r.statusCode;
      }
    } finally {
      // Die Anwendung dieses Prozesses wird BEENDET — danach hält nur noch die Datenbank den Stand.
      await app.close();
      await pool.end();
    }
    expect(zugriffVorher).toEqual({
      [`lea:${koOffen}`]: 404,
      [`lea:${koZu}`]: 200,
      [`carl:${koOffen}`]: 404,
      [`carl:${koZu}`]: 404,
      [`otto:${koOffen}`]: 200,
      [`otto:${koZu}`]: 404,
      [`admin:${koOffen}`]: 404,
      [`admin:${koZu}`]: 404,
    });

    // ---------------- PHASE 2 · EIGENER Serverprozess gegen DIESELBE Datenbank -------------------
    const server = await starteServer(url, await freierPort());
    try {
      const anmelden = async (email: string, password: string) => {
        const antwort = await fetch(`${server.basis}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        expect(antwort.status, `Anmeldung ${email} nach dem Neustart`).toBe(200);
        return { authorization: `Bearer ${((await antwort.json()) as { token: string }).token}` };
      };
      const zugriffNachher: Record<string, number> = {};
      const gelesen: Record<string, Objektstand> = {};
      const anmeldungen: [string, string][] = [
        ["lea", konten.lea.email],
        ["carl", konten.carl.email],
        ["otto", konten.otto.email],
        ["admin", admin.email],
      ];
      for (const [schluessel, email] of anmeldungen) {
        const headers = await anmelden(email, PASSWORT);
        for (const koId of [koOffen, koZu]) {
          const antwort = await fetch(`${server.basis}/api/kos/${koId}`, { headers });
          zugriffNachher[`${schluessel}:${koId}`] = antwort.status;
          if (antwort.status === 200) {
            gelesen[koId] = standAus((await antwort.json()) as Parameters<typeof standAus>[0]);
          }
        }
      }
      expect(zugriffNachher).toEqual(zugriffVorher);
      expect(gelesen[koOffen]).toEqual(stand[koOffen]);
      expect(gelesen[koZu]).toEqual(stand[koZu]);
    } finally {
      await beendeServer(server.kind);
    }
  }, 300_000);
});

// ==================================================================================================
// U1–U3 · DER KANDIDATEN-RECHTEABGLEICH GEGEN ECHTES POSTGRES, MIT KONTROLLIERTEN ÜBERSCHNEIDUNGEN.
// ==================================================================================================
//
// Nacharbeit 8 (Ben, Befund F2): der Abgleich schrieb einen offenen Kandidaten als Ganzes zurück
// (`update`, ohne Bedingung). Ein Review-Claim oder eine abgeschlossene Annahme dazwischen wurde
// dadurch auf `neu` zurückgesetzt; zwei überlappende Abgleiche konnten die neuere Beobachtung durch
// die ältere ersetzen. Gemessen wird an der echten Ablage (`PgCandidateRepo` über
// `buildPgServices`): `claim`/`resolveClaim` der Review-Aktion von Hand, dazwischen der Abgleich.

/** Eine Beobachtung derselben Seite und Version — mit eigenem Zeitpunkt, kurz nach der vorigen. */
async function beobachtung(id: string, version: number, leserEmails?: string[]) {
  await new Promise((weiter) => setTimeout(weiter, 15));
  const { items } = await adapterFuer([
    confluenceSeite(id, version, `Inhalt ${id}.`, leserEmails),
  ]).collectAll();
  const item = items[0];
  expect(item, `Beobachtung ${id}`).toBeDefined();
  return item!;
}

type KandidatMitRechten = {
  status: string;
  koId: string | null;
  opId?: string | null;
  item: { quellrechte?: { emails?: string[]; beobachtetAm?: string } };
};

describe("K1 · Kandidaten-Rechteabgleich: atomar gegen Claim, Abschluss und zweiten Abgleich", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  async function dienste() {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const pool = createPool(url);
    return { pool, d: buildPgServices(pool) };
  }

  async function lies(d: ReturnType<typeof buildPgServices>, id: string) {
    return (await d.candidates.findById(id)) as unknown as KandidatMitRechten | undefined;
  }

  it("U1 · ein Review-Claim dazwischen bleibt, und seine Annahme auch", async () => {
    const { pool, d } = await dienste();
    try {
      const [k] = await d.library.createImportCandidates([await beobachtung("810", 1)], "admin");
      expect(k).toBeDefined();
      // Die Review-Aktion claimt — und hält den Claim, während der Abgleich kommt.
      const geclaimt = await d.candidates.claim(
        k!.id,
        "op-review-u1",
        new Date().toISOString(),
        "reviewerin",
        "accept",
      );
      expect(geclaimt?.status).toBe("in_bearbeitung");

      const neuer = await beobachtung("810", 1, ["lea@example.com"]);
      await expect(d.library.gleicheQuellrechteFuerAnkerAb(neuer, "admin")).rejects.toThrow();
      const waehrend = await lies(d, k!.id);
      expect(waehrend?.status).toBe("in_bearbeitung");
      expect(waehrend?.opId).toBe("op-review-u1");
      expect(waehrend?.item.quellrechte?.emails).toBeUndefined();

      // Die Review-Aktion schließt ab — ihr Abschluss ist nicht verloren gegangen.
      const abgeschlossen = await d.candidates.resolveClaim(k!.id, "op-review-u1", {
        status: "abgelehnt",
        reviewedBy: "reviewerin",
      });
      expect(abgeschlossen?.status).toBe("abgelehnt");

      // Ein Abgleich NACH dem Abschluss fasst den Kandidaten nicht an.
      const danach = await d.library.gleicheQuellrechteFuerAnkerAb(
        await beobachtung("810", 1, ["otto@example.com"]),
        "admin",
      );
      expect(danach.kandidaten).toBe(0);
      const ende = await lies(d, k!.id);
      expect(ende?.status).toBe("abgelehnt");
      expect(ende?.item.quellrechte?.emails).toBeUndefined();
    } finally {
      await pool.end();
    }
  }, 60_000);

  it("U2 · Abgleich mitten in einer laufenden Annahme: die Annahme setzt sich durch, nichts fällt auf neu zurück", async () => {
    const { pool, d } = await dienste();
    try {
      const [k] = await d.library.createImportCandidates([await beobachtung("811", 1)], "admin");
      await d.candidates.claim(k!.id, "op-review-u2", new Date().toISOString(), "rev", "accept");
      const neuer = await beobachtung("811", 1, ["lea@example.com"]);
      // Der Abgleich wartet auf den fremden Claim; die Review-Aktion schließt währenddessen ab.
      const abgleich = d.library.gleicheQuellrechteFuerAnkerAb(neuer, "admin");
      await new Promise((weiter) => setTimeout(weiter, 60));
      await d.candidates.resolveClaim(k!.id, "op-review-u2", {
        status: "angenommen",
        koId: "ko-u2",
        reviewedBy: "rev",
      });
      const ergebnis = await abgleich;
      expect(ergebnis.kandidaten).toBe(0);
      const ende = await lies(d, k!.id);
      expect(ende?.status).toBe("angenommen");
      expect(ende?.koId).toBe("ko-u2");
    } finally {
      await pool.end();
    }
  }, 60_000);

  it("U3 · zwei überlappende Abgleiche: die neuere Beobachtung gewinnt, in beiden Reihenfolgen", async () => {
    const { pool, d } = await dienste();
    try {
      const [k] = await d.library.createImportCandidates([await beobachtung("812", 1)], "admin");
      // Ältere (t2: Lea) und neuere (t3: Otto) Beobachtung — die NEUERE kommt zuerst an.
      const t2 = await beobachtung("812", 1, ["lea@example.com"]);
      const t3 = await beobachtung("812", 1, ["otto@example.com"]);
      expect((await d.library.gleicheQuellrechteFuerAnkerAb(t3, "admin")).kandidaten).toBe(1);
      expect((await d.library.gleicheQuellrechteFuerAnkerAb(t2, "admin")).kandidaten).toBe(0);
      expect((await lies(d, k!.id))?.item.quellrechte?.emails).toEqual(["otto@example.com"]);

      // GLEICHZEITIG: zwei frische Beobachtungen, beide gestartet, bevor eine fertig ist.
      const t4 = await beobachtung("812", 1, ["lea@example.com"]);
      const t5 = await beobachtung("812", 1, ["eva@example.com"]);
      await Promise.all([
        d.library.gleicheQuellrechteFuerAnkerAb(t5, "admin"),
        d.library.gleicheQuellrechteFuerAnkerAb(t4, "admin"),
      ]);
      const ende = await lies(d, k!.id);
      expect(ende?.status).toBe("neu");
      // Kein liegengebliebener Claim (fehlend oder null — beides heißt „kein Claim").
      expect(ende?.opId ?? undefined).toBeUndefined();
      expect(ende?.item.quellrechte?.emails).toEqual(["eva@example.com"]);
    } finally {
      await pool.end();
    }
  }, 60_000);
});
