// ================================================================================================
// JOB 4325 · DER ANTRIEB DER GLEICHZEITIGKEIT — ZWEI DIENSTINSTANZEN, ZWEI SOCKETS, EINE DATENBANK.
// ================================================================================================
//
// WARUM ZWEI INSTANZEN UND NICHT ZWEI SITZUNGEN AN EINER. `KoService` serialisiert jede KO-Mutation
// per Objekt IM PROZESS (`services/knowledge-object/src/service.ts:746-757`, `withKoLock`). Zwei
// Sitzungen an EINER Instanz treffen deshalb immer den Lock, und der Compare-and-Set in der
// Datenbank (`services/knowledge-object/src/repo-pg.ts:424-440`) käme nie zum Zug. ZWEI Instanzen
// teilen diesen Lock NICHT — sie haben je eine eigene `koWriteLocks`-Karte. Damit entscheidet, wer
// gewinnt, genau die Stelle, die auch zwischen zwei echten Prozessen entscheidet: der bedingte
// UPDATE auf `rowVersion`. Der Dienst sagt das über sich selbst (`service.ts:761-765`): „Ein
// (seltener) prozessübergreifender STALE_WRITE wird ehrlich geworfen, nicht geraten."
//
// WAS DAMIT NICHT GEMESSEN IST, und es steht hier und nicht nur in der Rückgabe: zwei Instanzen im
// SELBEN Node-Prozess sind das Modell zweier Prozesse, nicht zwei Prozesse. Alles, was der Prozess
// teilt (Ereignisschleife, Modulzustand ausserhalb des Dienstes, Uhr), ist hier geteilt.
//
// EIGENE DATENBANK, KEIN EIGENES SCHEMA (Lehre JOB 4321 R1, `LEHREN.md`): `CREATE EXTENSION IF NOT
// EXISTS pg_trgm` läuft je DATENBANK, nicht je Schema. Zwei Dateien, die im gemeinsamen Lauf gegen
// dieselbe Datenbank migrieren, brechen sporadisch am `pg_extension_name_index`. Eine eigene
// Wegwerf-Datenbank schliesst diesen Wettlauf aus — nicht, weil hier sorgfältiger migriert wird,
// sondern weil es in ihr genau EINEN Anleger gibt (`migrate()`, einmal, auf EINEM Pool, VOR jeder
// Parallelität).
//
// NICHTS AUS `tests/office-pg-abnahme/` WIRD IMPORTIERT: JOB 4321 hält diesen Ordner. Die Konten,
// der Antrieb und die Erwartungswerte hier sind eigene und berühren ihn nicht.
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import type { AuditEntry } from "../../services/audit";
import { GENESIS, hashEntryV2 } from "../../services/audit";
import type { Role } from "../../services/auth";
import { PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { TRUST_MAX } from "../../services/validation/src/trust";
import {
  FASSUNGSBELEG,
  FREIGABEBELEG,
  belegeFuer,
  erwarteFassung,
  erwarteKeineFassung,
  pruefeBelegvollstaendigkeit,
} from "./kette";

export const JOB = "[KLARWERK][JOB 4325]";

// ------------------------------------------------------------------------------------------------
// DIE INHALTE — UNTERSCHEIDBAR, WEIL DER UNTERSCHIED DAS MESSINSTRUMENT IST.
// ------------------------------------------------------------------------------------------------

/** Der freigegebene Inhalt VOR dem Rennen — das Vergleichsmass für „nichts still überschrieben". */
export const RUMPF_BESTAND = "<p>Der freigegebene ausführliche Inhalt des Eintrags.</p>";

/** Ein Satz, der NUR in der Fassung von A vorkommt. Fehlt er beim Gewinner A, ist Text verloren. */
export const MERKMAL_A = "im Schichtbuch protokolliert";
/** Ein Satz, der NUR in der Fassung von B vorkommt. Steht er beim Gewinner A, hat B durchgeschrieben. */
export const MERKMAL_B = "die Leitwarte meldet den Vollzug";

export const STATEMENT_A = "Fassung A: Ventil X wird von Hand geschlossen.";
export const STATEMENT_B = "Fassung B: Ventil X wird über die Leitwarte geschlossen.";
export const RUMPF_A = `<p>Fassung A: Ventil X wird von Hand geschlossen; der Vorgang wird ${MERKMAL_A}.</p>`;
export const RUMPF_B = `<p>Fassung B: Ventil X wird über die Leitwarte geschlossen; ${MERKMAL_B}.</p>`;

/** Welche Seite trägt welches Merkmal — für die Fehlermeldungen und die Kreuzprobe. */
export const MERKMAL: Readonly<Record<"A" | "B", string>> = { A: MERKMAL_A, B: MERKMAL_B };

// ------------------------------------------------------------------------------------------------
// DIE KONTEN
// ------------------------------------------------------------------------------------------------

export const PASSWORT = "geheim12345";

export interface Konto {
  readonly name: string;
  readonly email: string;
  readonly rolle: Role;
}

/** Das ERSTE Konto der leeren Ablage — nur dieses wird Admin von selbst (FR-AUTH-01). */
export const ENTSCHEIDER: Konto = {
  name: "Entscheidung",
  email: "entscheider@job4325.test",
  rolle: "admin",
};

// ================================================================================================
// WARUM DIE ZWEI RÜCKGEBER ADMINS SIND — EINE ENTSCHEIDUNG, KEIN VERSEHEN.
// ================================================================================================
//
// Der Auftrag nennt in §5.2 zwei `experte`-Konten und verlangt in §5.3 (a)/(d), dass BEIDE Seiten
// `action: "revise-release"` senden. Am Quelltext nachgeschlagen verlangt diese Aktion aber
// `users.manage` (`services/app/src/routes/ko-routes.ts:2460`), und `users.manage` hat laut
// `services/rbac/src/policy.ts:34-42` allein `admin`. Zwei Experten hätten also nicht um die Fassung
// gerannt, sondern zweimal 403 bekommen — der Fall hätte über Gleichzeitigkeit nichts gesagt.
//
// Gemessen wird deshalb die Matrix, WIE SIE STEHT: zwei Menschen, die beide zurückgeben DÜRFEN.
// Die `experte`-Konten bleiben und tragen den Einreichweg (`propose`, Recht `ko.create`), auf dem
// Fall (b) beruht. Die Abweichung steht in der Rückgabe.
export const RUECKGEBER_A: Konto = {
  name: "Rueckgabe A",
  email: "rueckgeber-a@job4325.test",
  rolle: "admin",
};
export const RUECKGEBER_B: Konto = {
  name: "Rueckgabe B",
  email: "rueckgeber-b@job4325.test",
  rolle: "admin",
};
export const EINREICHER_A: Konto = {
  name: "Einreichung A",
  email: "einreicher-a@job4325.test",
  rolle: "experte",
};
export const EINREICHER_B: Konto = {
  name: "Einreichung B",
  email: "einreicher-b@job4325.test",
  rolle: "experte",
};

export const NEBENKONTEN: readonly Konto[] = [
  RUECKGEBER_A,
  RUECKGEBER_B,
  EINREICHER_A,
  EINREICHER_B,
];

// ------------------------------------------------------------------------------------------------
// DER DRAHT — ECHTE SOCKETS, UND DIE ZEITSPANNE JEDES AUFRUFS WIRD MITGEMESSEN.
// ------------------------------------------------------------------------------------------------

export type Kopf = Readonly<Record<string, string>>;

/**
 * Eine Antwort samt ihrer Zeitspanne.
 *
 * `begonnen`/`beendet` sind KEINE Zierde: die Lehre aus JOB 4151/4203 (`LEHREN.md`) lautet wörtlich
 * „Ein zufällig grünes `Promise.all` genügt nicht als Parallelitätsnachweis." Mit den beiden
 * Zeitmarken lässt sich je Wiederholung BELEGEN, dass die zwei Aufrufe einander wirklich
 * überlappten — statt es aus der Schreibweise zu folgern.
 */
export interface Antwort {
  readonly status: number;
  readonly text: string;
  readonly json: unknown;
  readonly begonnen: number;
  readonly beendet: number;
}

/** Der Fehlerkörper, wie ihn `sendError`/`rueckwegFehler` schreiben. */
export interface Fehlerkoerper {
  readonly error?: string;
  readonly message?: string;
  readonly currentVersion?: number;
}

export function alsFehler(antwort: Antwort): Fehlerkoerper {
  return (antwort.json ?? {}) as Fehlerkoerper;
}

export function alsKo(antwort: Antwort): KnowledgeObject | undefined {
  return antwort.json === undefined || antwort.json === null
    ? undefined
    : (antwort.json as KnowledgeObject);
}

/** Überlappten die beiden Aufrufe wirklich in der Zeit? */
export function ueberlappt(a: Antwort, b: Antwort): boolean {
  return a.begonnen < b.beendet && b.begonnen < a.beendet;
}

export async function sende(
  basis: string,
  verfahren: string,
  pfad: string,
  opts: { kopf?: Kopf; rumpf?: unknown } = {},
): Promise<Antwort> {
  const kopf: Record<string, string> = { ...(opts.kopf ?? {}) };
  if (opts.rumpf !== undefined) {
    kopf["content-type"] = "application/json";
  }
  // `exactOptionalPropertyTypes` ist an: ein `body: undefined` ist nicht dasselbe wie kein Feld.
  const anfrage: RequestInit = { method: verfahren, headers: kopf };
  if (opts.rumpf !== undefined) {
    anfrage.body = JSON.stringify(opts.rumpf);
  }
  const begonnen = performance.now();
  const antwort = await fetch(`${basis}${pfad}`, anfrage);
  const text = await antwort.text();
  const beendet = performance.now();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: antwort.status, text, json, begonnen, beendet };
}

// ------------------------------------------------------------------------------------------------
// DIE INSTANZEN
// ------------------------------------------------------------------------------------------------

export interface Instanz {
  /** „A" oder „B" — in Fehlermeldungen sagt der Name mehr als ein Port. */
  readonly name: string;
  readonly app: FastifyInstance;
  readonly basis: string;
  readonly port: number;
  readonly pool: Pool;
  /** Die Fehlerzeilen, die DIESE Instanz selbst geschrieben hat (s. `starteInstanz`). */
  readonly protokoll: string[];
  schliessen(): Promise<void>;
}

/**
 * Eine echte App auf einem echten Port, mit EIGENEM Pool auf dieselbe Datenbank.
 *
 * `max: 4` und nicht der Vorgabewert 10: der Prüfcluster des Wrappers steht auf `max_connections=100`
 * (`register/cloud/remote_job.py:33`), und `gatedPool` nimmt sich für JEDE Abfrage einen eigenen
 * Client. Zwei Instanzen mit je vier Verbindungen plus die Leseverbindungen dieser Datei bleiben
 * weit darunter.
 *
 * ── WARUM DIE LOGSENKE HIER HÄNGT ────────────────────────────────────────────────────────────────
 * Ein 500 dieses Hauses ist nach aussen MASKIERT: `sendError` sendet `{"error":"INTERNAL"}` und
 * schreibt die Ursache ausschliesslich ins Log (`services/app/src/http.ts:173-179,193`). Ohne
 * Zugriff darauf könnte diese Abnahme über einen Serverfehler nur sagen „500", und jede Aussage über
 * seine Ursache wäre geraten. `buildApp` hat dafür einen vorgesehenen Prüfeinstieg (JOB 2661,
 * `opts.log.senke`); er wird hier benutzt, damit ein Befund die Zeile des Servers ZITIEREN kann,
 * statt sie zu erfinden. Stufe `error`: nur Fehlerzeilen, kein Zugriffsrauschen.
 */
export async function starteInstanz(name: string, url: string): Promise<Instanz> {
  const pool = new Pool({ connectionString: url, max: 4 });
  const protokoll: string[] = [];
  const app = buildApp(buildPgServices(pool), {
    log: {
      senke: {
        write: (zeile: string): void => {
          protokoll.push(zeile.trimEnd());
        },
      },
      stufe: "error",
    },
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    await pool.end();
    throw new Error(`${JOB}: Instanz ${name} hat keinen Port gemeldet — sie steht nicht.`);
  }
  return {
    name,
    app,
    basis: `http://127.0.0.1:${adresse.port}`,
    port: adresse.port,
    pool,
    protokoll,
    schliessen: async () => {
      await app.close();
      await pool.end();
    },
  };
}

// ------------------------------------------------------------------------------------------------
// ANMELDUNG UND KONTEN — ÜBER DEN ECHTEN WEG, NICHT ÜBER DIE ABLAGE.
// ------------------------------------------------------------------------------------------------

function gekuerzt(text: string): string {
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

/**
 * Das erste Konto über die Selbstregistrierung (nur so entsteht ein Admin), die übrigen über
 * `POST /api/users`.
 *
 * Wird das erste Konto NICHT Admin, war die Nutzerablage nicht leer. Das ist kein milder Ausfall,
 * sondern der Boden dieser Abnahme — deshalb wirft es hier laut.
 */
/**
 * Die Kennungen der angelegten Konten — der Bezugspunkt jeder Aussage über den Akteur eines Belegs.
 *
 * WARUM SIE UNABHÄNGIG GEHOLT WERDEN: der Beleg nennt eine Nutzerkennung, und ob sie zur richtigen
 * Person gehört, lässt sich nur mit einer Quelle beantworten, die NICHT das Protokoll ist. Diese
 * Quelle ist die Kontenliste selbst (`GET /api/users`, `services/auth/src/routes.ts:844`).
 */
export interface Kontenbuch {
  /** Die Nutzerkennung des Kontos — wirft, wenn es sie nicht gibt (das wäre kein milder Ausfall). */
  kennung(konto: Konto): string;
}

export async function richteKontenEin(basis: string): Promise<Kontenbuch> {
  const registriert = await sende(basis, "POST", "/api/auth/register", {
    rumpf: { name: ENTSCHEIDER.name, email: ENTSCHEIDER.email, password: PASSWORT },
  });
  if (registriert.status !== 201) {
    throw new Error(
      `${JOB}: Entscheiderkonto nicht angelegt (${registriert.status}) — ${gekuerzt(registriert.text)}`,
    );
  }
  const rolle = (registriert.json as { role?: unknown }).role;
  if (rolle !== ENTSCHEIDER.rolle) {
    throw new Error(
      `${JOB}: das erste Konto wurde „${String(rolle)}" statt „${ENTSCHEIDER.rolle}" — die Nutzerablage war nicht leer.`,
    );
  }
  const admin = await anmeldung(basis, ENTSCHEIDER);
  for (const konto of NEBENKONTEN) {
    const angelegt = await sende(basis, "POST", "/api/users", {
      kopf: admin,
      rumpf: { name: konto.name, email: konto.email, password: PASSWORT, role: konto.rolle },
    });
    if (angelegt.status !== 201) {
      throw new Error(
        `${JOB}: Konto ${konto.email} (${konto.rolle}) nicht angelegt (${angelegt.status}) — ${gekuerzt(angelegt.text)}`,
      );
    }
  }
  // Die Kennungen kommen aus der KONTENLISTE, nicht aus den Antworten der Anlage: gelesen wird der
  // Bestand, den der Server selbst führt.
  const liste = await sende(basis, "GET", "/api/users", { kopf: admin });
  if (liste.status !== 200) {
    throw new Error(
      `${JOB}: Kontenliste nicht lesbar (${liste.status}) — ${gekuerzt(liste.text)}; ohne sie ist keine Aussage über den Akteur eines Belegs möglich.`,
    );
  }
  const karte = new Map<string, string>();
  for (const eintrag of liste.json as { id?: unknown; email?: unknown }[]) {
    if (typeof eintrag.id === "string" && typeof eintrag.email === "string") {
      karte.set(eintrag.email, eintrag.id);
    }
  }
  for (const konto of [ENTSCHEIDER, ...NEBENKONTEN]) {
    if (!karte.has(konto.email)) {
      throw new Error(
        `${JOB}: die Kontenliste nennt keine Kennung für ${konto.email} — der Akteurvergleich hätte keinen Boden.`,
      );
    }
  }
  return {
    kennung: (konto: Konto): string => {
      const id = karte.get(konto.email);
      if (id === undefined) {
        throw new Error(`${JOB}: keine Kennung für ${konto.email}.`);
      }
      return id;
    },
  };
}

/** Anmeldung am echten Weg; der Kopf trägt danach den echten Zugangsschlüssel. */
export async function anmeldung(basis: string, konto: Konto): Promise<Kopf> {
  const antwort = await sende(basis, "POST", "/api/auth/login", {
    rumpf: { email: konto.email, password: PASSWORT },
  });
  if (antwort.status !== 200) {
    throw new Error(
      `${JOB}: Anmeldung ${konto.email} fehlgeschlagen (${antwort.status}) — ${gekuerzt(antwort.text)}`,
    );
  }
  const token = (antwort.json as { token?: unknown }).token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`${JOB}: Anmeldung ${konto.email} ohne Zugangsschlüssel.`);
  }
  return { authorization: `Bearer ${token}` };
}

// ------------------------------------------------------------------------------------------------
// DIE DREI SCHREIBWEGE DES RÜCKWEGS — WÖRTLICH DIE, DIE DAS AUFGABENFENSTER UND DIE FLÄCHE SENDEN.
// ------------------------------------------------------------------------------------------------

/** `PUT /api/kos/:id` mit `revise-release` — überarbeiten und freigeben in EINEM Aufruf. */
export function gibZurueck(
  basis: string,
  kopf: Kopf,
  id: string,
  inhalt: { statement: string; bodyHtml: string },
  expectedVersion?: number,
): Promise<Antwort> {
  return sende(basis, "PUT", `/api/kos/${id}`, {
    kopf,
    rumpf: {
      action: "revise-release",
      changes: { statement: inhalt.statement, bodyHtml: inhalt.bodyHtml },
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    },
  });
}

/** `PUT /api/kos/:id` mit `propose` — der Vorschlag aus Word oder aus dem Browser. */
export function reicheEin(
  basis: string,
  kopf: Kopf,
  id: string,
  vorschlag: { statement: string; bodyHtml: string; baseVersion: number },
): Promise<Antwort> {
  return sende(basis, "PUT", `/api/kos/${id}`, {
    kopf,
    rumpf: {
      action: "propose",
      proposal: {
        statement: vorschlag.statement,
        bodyHtml: vorschlag.bodyHtml,
        baseVersion: vorschlag.baseVersion,
        origin: "word_addin",
      },
    },
  });
}

/** `PUT /api/kos/:id` mit `decide-proposal` — die fremde Freigabe. */
export function entscheide(
  basis: string,
  kopf: Kopf,
  id: string,
  proposalId: string,
  expectedVersion?: number,
): Promise<Antwort> {
  return sende(basis, "PUT", `/api/kos/${id}`, {
    kopf,
    rumpf: {
      action: "decide-proposal",
      proposalId,
      decision: "uebernehmen",
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    },
  });
}

/** Die Kennung des zuletzt angenommenen Vorschlags aus der Antwort von `propose`. */
export function vorschlagsKennung(antwort: Antwort, statement: string): string | undefined {
  const ko = alsKo(antwort);
  const treffer = (ko?.proposals ?? []).filter(
    (p) => p.statement === statement && p.status === "offen",
  );
  return treffer[treffer.length - 1]?.id;
}

// ------------------------------------------------------------------------------------------------
// DER BESTAND — ANGELEGT UND GELESEN AN DER DATENBANK, NICHT AM DIENST, DER GERADE GESCHRIEBEN HAT.
// ------------------------------------------------------------------------------------------------

/** Ein FREIGEGEBENES Objekt in Fassung 1 mit bekanntem Fließtext. */
export function bestandsObjekt(id: string, bodyHtml: string): KnowledgeObject {
  return {
    id,
    title: `Ventil X schließt bei Überdruck (${id})`,
    statement: "Bei Überdruck Ventil X manuell schließen.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 99,
    trust: TRUST_MAX,
    status: "validiert",
    version: 1,
    originalAuthor: "admin-1",
    author: "admin-1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as KnowledgeObject;
}

export async function legeObjektAn(pool: Pool, id: string, bodyHtml: string): Promise<void> {
  await new PgKoRepo(pool).insert(bestandsObjekt(id, bodyHtml));
}

/**
 * Das Zurücklesen über eine NEUE Verbindung mit einem NEUEN Adapter.
 *
 * Ein Lesen über einen der beiden Dienstpools könnte einen Wert zeigen, der nie in der Datenbank
 * ankam. Eine frische Verbindung kennt nur, was wirklich gespeichert ist.
 */
export async function nachNeuerVerbindung(
  url: string,
  id: string,
): Promise<KnowledgeObject | undefined> {
  const zweiter = new Pool({ connectionString: url, max: 1 });
  try {
    return await new PgKoRepo(zweiter).findById(id);
  } finally {
    await zweiter.end();
  }
}

/** Die Fassungs-Snapshots eines Objekts, aufsteigend — gelesen an der Spalte, nicht am Dienst. */
export async function fassungen(
  pool: Pool,
  koId: string,
): Promise<{ version: number; statement: string | null; bodyHtml: string | null }[]> {
  const res = await pool.query<{ version: number; statement: string | null; body: string | null }>(
    `SELECT version, snapshot->>'statement' AS statement, snapshot->>'bodyHtml' AS body
       FROM ko_versions WHERE ko_id = $1 ORDER BY version`,
    [koId],
  );
  return res.rows.map((z) => ({ version: z.version, statement: z.statement, bodyHtml: z.body }));
}

/**
 * Der Fassungs-Schnappschuss der wirksamen Fassung — genau eine Zeile, mit genau dem gespeicherten
 * Inhalt, und keine Zeile darüber hinaus.
 *
 * SIE STEHT ALS EIGENE FUNKTION DA, damit die Kalibrierung sie nach einer gezielten Verstellung an
 * der Tabelle ERNEUT aufrufen kann — derselbe Erwartungssatz, nicht eine Nachbildung. Runde 1 zählte
 * in Fall (c) nur die Zeilen und verglich ihren Inhalt nicht (Prüferbefund zu Prüfpunkt 6); Fall (b)
 * prüfte den Schnappschuss gar nicht.
 */
export async function pruefeSchnappschuss(
  pool: Pool,
  koId: string,
  fassung: number,
  erwarteterRumpf: string | null,
): Promise<string[]> {
  const maengel: string[] = [];
  const abgelegt = await fassungen(pool, koId);
  const treffer = abgelegt.filter((z) => z.version === fassung);
  const erste = treffer[0];
  if (treffer.length !== 1 || erste === undefined) {
    maengel.push(
      `ko_versions trägt ${treffer.length} Zeilen für Fassung ${fassung}, erwartet genau 1 — die Fassung ist ${treffer.length === 0 ? "NICHT abgelegt" : "mehrfach abgelegt"}.`,
    );
  } else if (erste.bodyHtml !== erwarteterRumpf) {
    maengel.push(
      `der abgelegte Schnappschuss der Fassung ${fassung} ist nicht der gespeicherte Stand (abgelegt ${JSON.stringify((erste.bodyHtml ?? "").slice(0, 120))}, gespeichert ${JSON.stringify((erwarteterRumpf ?? "").slice(0, 120))}).`,
    );
  }
  const zuviel = abgelegt.filter((z) => z.version > fassung);
  if (zuviel.length > 0) {
    maengel.push(
      `ko_versions trägt Fassungen über ${fassung} hinaus: ${zuviel.map((z) => z.version).join(", ")}.`,
    );
  }
  return maengel;
}

/** Der instanzweite Schreibzähler (`ko_schreibstand`) — er steigt mit JEDEM wirksamen KO-Write. */
export async function schreibstand(pool: Pool): Promise<number> {
  const res = await pool.query<{ stand: string }>(
    "SELECT stand::text AS stand FROM ko_schreibstand WHERE id = 1",
  );
  return Number(res.rows[0]?.stand ?? "0");
}

interface AuditZeile {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  event_id: string | null;
  hash_version: number | null;
}

/**
 * Der ganze Audit-Bestand, aufsteigend nach `seq` — mit EIGENEM SQL statt über `PgAuditRepo`.
 *
 * Der Auftrag nennt in §5.4 `seq, prev_hash, hash, action, target`. Gelesen werden zusätzlich
 * `at`, `actor`, `payload`, `event_id` und `hash_version`: ohne sie liesse sich der Hash jedes
 * Eintrags nicht NACHRECHNEN, sondern nur die Verkettung ansehen. Der Leseweg ist bewusst nicht der
 * Adapter des Dienstes, der gerade geschrieben hat.
 */
export async function auditBestand(pool: Pool): Promise<AuditEntry[]> {
  const res = await pool.query<AuditZeile>(
    `SELECT seq, at, actor, action, target, payload, prev_hash, hash, event_id, hash_version
       FROM audit ORDER BY seq`,
  );
  return res.rows.map((z) => ({
    seq: z.seq,
    at: z.at,
    actor: z.actor,
    action: z.action,
    target: z.target,
    payload: z.payload,
    prevHash: z.prev_hash,
    hash: z.hash,
    ...(z.event_id ? { eventId: z.event_id } : {}),
    hashVersion: z.hash_version ?? 1,
  }));
}

/**
 * Die Zähler der Datenbank selbst — DIE unabhängige Auskunft über einen maskierten Serverfehler.
 *
 * Ein 500 dieses Hauses nennt seine Ursache nach aussen nicht (`services/app/src/http.ts:190-193`),
 * und der Auffangzweig von `sendError` schreibt — anders als der Maskierungszweig darüber
 * (`http.ts:173-179`) — auch KEINE Logzeile. Über die Ursache liesse sich damit nur mutmassen.
 * `pg_stat_database` mutmasst nicht: sie zählt, was in DIESER Wegwerf-Datenbank wirklich geschah.
 * Steigt `deadlocks` in genau der Runde, in der ein 500 auftrat, ist das ein gemessener Hinweis —
 * und er wird in der Rückgabe auch nur als solcher berichtet.
 */
export async function datenbankZaehler(
  pool: Pool,
): Promise<{ deadlocks: number; rollbacks: number }> {
  const res = await pool.query<{ deadlocks: string; rollbacks: string }>(
    `SELECT deadlocks::text AS deadlocks, xact_rollback::text AS rollbacks
       FROM pg_stat_database WHERE datname = current_database()`,
  );
  return {
    deadlocks: Number(res.rows[0]?.deadlocks ?? "0"),
    rollbacks: Number(res.rows[0]?.rollbacks ?? "0"),
  };
}

/**
 * DIE TESTVORRICHTUNG FÜR DIE AKTEUR-GEGENPROBE: fremder Name in den Belegen, Kette KORREKT NEU
 * BERECHNET.
 *
 * WARUM NEU BERECHNET UND NICHT EINFACH ÜBERSCHRIEBEN: der Prüfer verlangt „falscher Akteur bei
 * intakter Hashkette". Ein blosses `UPDATE audit SET actor=…` bräche jeden Hash, und dann fände die
 * INTEGRITÄTSprüfung den Fehler — über die Identitätsprüfung wäre damit nichts gesagt. Hier werden
 * die betroffenen Einträge deshalb mit dem produktiven `hashEntryV2` neu gehasht und ab der ersten
 * Änderung neu verkettet: danach ist die Kette nach jedem Massstab der Integrität heil, und NUR der
 * Name ist falsch. Genau so hat der Prüfer es im Dienst nachgestellt.
 *
 * Gibt zurück, wie viele Belege den fremden Namen bekommen haben — die Kalibrierung prüft das, bevor
 * sie irgendetwas behauptet.
 */
export async function verstelleBelegAkteur(
  pool: Pool,
  koId: string,
  fremderAkteur: string,
): Promise<number> {
  const bestand = await auditBestand(pool);
  const betroffen = new Set(
    [...belegeFuer(bestand, koId, FASSUNGSBELEG), ...belegeFuer(bestand, koId, FREIGABEBELEG)].map(
      (e) => e.seq,
    ),
  );
  if (betroffen.size === 0) {
    return 0;
  }
  const ab = Math.min(...betroffen);
  let vorgaenger = bestand.find((e) => e.seq === ab - 1)?.hash ?? GENESIS;
  let geaendert = 0;
  for (const eintrag of bestand.filter((e) => e.seq >= ab)) {
    const neu: Omit<AuditEntry, "hash"> = {
      ...eintrag,
      ...(betroffen.has(eintrag.seq) ? { actor: fremderAkteur } : {}),
      prevHash: vorgaenger,
    };
    const hash = hashEntryV2(neu);
    await pool.query("UPDATE audit SET actor = $2, prev_hash = $3, hash = $4 WHERE seq = $1", [
      eintrag.seq,
      neu.actor,
      neu.prevHash,
      hash,
    ]);
    vorgaenger = hash;
    if (betroffen.has(eintrag.seq)) {
      geaendert += 1;
    }
  }
  return geaendert;
}

/** Die PostgreSQL-Version, gelesen statt abgeschrieben. */
export async function pgVersion(pool: Pool): Promise<string> {
  const res = await pool.query<{ version: string }>("SELECT version() AS version");
  return res.rows[0]?.version ?? "(PostgreSQL-Version nicht lesbar)";
}

/** Die Quelle darf genannt werden, das Passwort nicht. */
export function ohneGeheimnis(url: string): string {
  return url.replace(/:\/\/([^/@]*)@/, (_treffer, anmeldedaten: string) => {
    const benutzer = anmeldedaten.split(":")[0] ?? "";
    return `://${benutzer}:***@`;
  });
}

/** Aus `postgres://…/klarwerk_test` wird `postgres://…/<datenbank>`. */
export function mitDatenbank(url: string, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite legt ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  return url.replace(/\/[^/?#]*(\?[^#]*)?$/, `/${datenbank}$1`);
}

// ------------------------------------------------------------------------------------------------
// DIE WIEDERHOLUNG — DAS GERÜST, DAS ALLE VIER FÄLLE TEILEN.
// ------------------------------------------------------------------------------------------------

/**
 * Was eine einzelne Überlappung ergeben hat.
 *
 * `maengel` wird GESAMMELT statt geworfen: eine Runde, die beim ersten Fehlschlag abbricht, sagt
 * über die übrigen 19 nichts — und genau die Verteilung über viele Wiederholungen ist der
 * Gegenstand dieser Abnahme. Geurteilt wird am Ende, über alle Runden zusammen.
 */
export interface Runde {
  readonly lauf: number;
  readonly koId: string;
  readonly ueberlappt: boolean;
  readonly status: readonly [number, number];
  readonly gewinner: "A" | "B" | "keiner" | "beide";
  readonly maengel: readonly string[];
}

export interface Fallbefund {
  readonly runden: readonly Runde[];
  readonly maengel: readonly string[];
  readonly ueberlappungen: number;
  readonly verteilung: Readonly<Record<"A" | "B" | "keiner" | "beide", number>>;
}

export function fasseZusammen(runden: readonly Runde[]): Fallbefund {
  const verteilung = { A: 0, B: 0, keiner: 0, beide: 0 };
  const maengel: string[] = [];
  let ueberlappungen = 0;
  for (const runde of runden) {
    verteilung[runde.gewinner] += 1;
    if (runde.ueberlappt) {
      ueberlappungen += 1;
    } else {
      maengel.push(
        `Lauf ${runde.lauf} (${runde.koId}): die zwei Aufrufe überlappten NICHT in der Zeit — diese Runde belegt keine Gleichzeitigkeit.`,
      );
    }
    for (const mangel of runde.maengel) {
      maengel.push(`Lauf ${runde.lauf} (${runde.koId}): ${mangel}`);
    }
  }
  return { runden, maengel, ueberlappungen, verteilung };
}

/** Wer hat geschrieben? Genau eine 2xx ist der Normalfall; alles andere trägt einen eigenen Namen. */
export function gewinnerAus(a: Antwort, b: Antwort): "A" | "B" | "keiner" | "beide" {
  const aOk = a.status >= 200 && a.status < 300;
  const bOk = b.status >= 200 && b.status < 300;
  if (aOk && bOk) {
    return "beide";
  }
  if (aOk) {
    return "A";
  }
  if (bOk) {
    return "B";
  }
  return "keiner";
}

/**
 * Die Deutung eines Verlierer-Status in Klartext — sie WIRD IN DIE MELDUNG GESCHRIEBEN und ersetzt
 * die Erwartung nicht.
 *
 * Ein 400 an dieser Stelle ist der belegte Verdacht des Auftrags (§2.3): `STALE_WRITE` steht weder
 * in `rueckwegFehler` (`services/app/src/routes/ko-routes.ts:2114-2144`) noch in `STATUS_BY_CODE`
 * (`services/app/src/http.ts:43-100`) und fällt deshalb in den Auffangwert `?? 400`
 * (`services/app/src/http.ts:187`). Ein 500 ist maskiert (`http.ts:193`) und nennt seine Ursache
 * nicht — er wird als das gemeldet, was er ist: ein unerklärter Serverfehler.
 */
export function deuteVerlierer(antwort: Antwort): string {
  const fehler = alsFehler(antwort);
  if (antwort.status === 400) {
    return `400 ${String(fehler.error)} — ein Konflikt als Eingabefehler; Auffangwert in services/app/src/http.ts:187, weil STALE_WRITE weder in rueckwegFehler (ko-routes.ts:2114-2144) noch in STATUS_BY_CODE (http.ts:43-100) steht. Körper: ${gekuerzt(antwort.text)}`;
  }
  if (antwort.status >= 500) {
    return `${antwort.status} — Serverfehler, Ursache maskiert (services/app/src/http.ts:193). Körper: ${gekuerzt(antwort.text)}`;
  }
  return `${antwort.status} ${String(fehler.error)} — ${gekuerzt(antwort.text)}`;
}

/**
 * Wie weit der Schreibzähler bei EINER wirksamen Rückgabe steigt — GEMESSEN und danach im Quelltext
 * nachgeschlagen, nicht angenommen.
 *
 * Der Auftrag (§5.3 a) erwartete 1. Der erste Lauf maß in 40 von 40 Runden 2, und der Grund steht im
 * Produkt: `ko_schreibstand` zählt JEDEN wirksamen KO-Schreibvorgang, und eine `revise-release`
 * schreibt in ihrer einen Transaktion ZWEI — den bedingten UPDATE am Bestand
 * (`services/knowledge-object/src/repo-pg.ts:438`) und die Zeile der neuen Fassung
 * (`PgKoVersionRepo.append`, `repo-pg.ts:807`). 2 ist damit der Wert EINES Gewinners, kein Befund;
 * die Erwartung wurde berichtigt, nicht abgeschwächt. Ihre Aussage bleibt dieselbe und ist sogar
 * schärfer: ein zweiter, stiller Gewinner stünde als 4 da, ein wirkungsloser als 0.
 */
export const SCHREIBSTAND_JE_RUECKGABE = 2;

/** Ein Befund darf das Serverprotokoll ZITIEREN — erfinden darf er nichts. */
export function mitServerzeilen(text: string, zeilen: readonly string[]): string {
  return zeilen.length === 0
    ? `${text} (der Server hat dazu nichts protokolliert)`
    : `${text} Serverprotokoll: ${zeilen.join(" | ")}`;
}

/** Was die beiden Instanzen seit den gemerkten Ständen an Fehlerzeilen geschrieben haben. */
export function neueServerzeilen(
  instanzen: readonly Instanz[],
  staende: readonly number[],
): string[] {
  const zeilen: string[] = [];
  const gesehen = new Set<string[]>();
  for (const [i, instanz] of instanzen.entries()) {
    if (gesehen.has(instanz.protokoll)) {
      continue;
    }
    gesehen.add(instanz.protokoll);
    zeilen.push(...instanz.protokoll.slice(staende[i] ?? 0));
  }
  return zeilen;
}

// ================================================================================================
// DAS RENNEN UM DIE FASSUNG — EIN ERWARTUNGSSATZ, VON DER ABNAHME UND VON DER KALIBRIERUNG GEFAHREN.
// ================================================================================================
//
// WARUM DIESE FUNKTION HIER STEHT UND NICHT IN DER TESTDATEI. Die Kalibrierung (§6 des Auftrags)
// muss belegen, dass GENAU DIESER Erwartungssatz rot wird, wenn man ihm den Boden entzieht — einmal
// durch Weglassen von `expectedVersion` (dann schreibt der zweite Schreiber durch), einmal durch
// eine verstellte Konfliktfassung. Eine nachgebaute zweite Fassung der Erwartung würde das nicht
// belegen, sondern nur, dass die Nachbildung rot wird. Deshalb gibt es sie genau einmal, und die
// Kalibrierung dreht an ihren zwei Knöpfen.
//
// GEURTEILT WIRD TROTZDEM IN DEN TESTDATEIEN: diese Funktion wirft nicht und behauptet nichts. Sie
// SAMMELT Mängel — die `expect`-Zeilen stehen in den beiden Läufen.
export interface RennenOptionen {
  /** Der eigene Lesepool — er gehört keiner der beiden Instanzen. */
  readonly lese: Pool;
  /** Die URL der Wegwerf-Datenbank, für das Zurücklesen über eine NEUE Verbindung. */
  readonly url: string;
  /** Die zwei Instanzen — für Fall (d) zweimal DIESELBE (eine Instanz, zwei Sitzungen). */
  readonly a: Instanz;
  readonly b: Instanz;
  readonly kopfA: Kopf;
  readonly kopfB: Kopf;
  /**
   * Die Nutzerkennungen hinter `kopfA`/`kopfB` — der Bezugspunkt des Akteurvergleichs.
   *
   * Sie stehen als PFLICHTFELDER hier, damit kein Aufrufer die Identitätsprüfung durch Weglassen
   * abschalten kann; genau das war der Befund des Prüfers zu Runde 2.
   */
  readonly akteurA: string;
  readonly akteurB: string;
  readonly praefix: string;
  readonly wiederholungen: number;
  /**
   * `true` = mit `expectedVersion: 1` (der bedingte Schreibzugriff, JOB 3667).
   * `false` = ohne — dann ändert sich laut `service.ts:4015` „NICHTS am Altverhalten", der zweite
   * Schreiber schreibt durch, und derselbe Erwartungssatz MUSS scheitern.
   */
  readonly bedingt: boolean;
  /** Welche Fassung der 409 nennen muss. Die Kalibrierung verstellt sie auf 3. */
  readonly erwarteteKonfliktVersion: number;
  /**
   * DIE TESTVORRICHTUNG DER KALIBRIERUNG — sie läuft NACH dem Rennen und VOR jeder Prüfung.
   *
   * Der Prüfer zu Runde 1 verlangt wörtlich: „Unterdrücke zur Kalibrierung sämtliche
   * Audit-Schreibvorgänge einer ansonsten erfolgreichen Rückgabe: Derselbe Abnahmefall muss fehlende
   * Belege erkennen, obwohl die verbleibende Hashkette lückenlos ist." Der Produktcode liegt
   * ausserhalb der Zielpfade; dieselbe Lage entsteht deshalb an der Ablage der eigenen
   * Wegwerf-Datenbank. Entscheidend ist, dass danach GENAU DIESER Erwartungssatz weiterläuft und
   * nicht eine Nachbildung — die Abnahme lässt den Haken weg und misst damit Zeichen für Zeichen
   * dasselbe.
   */
  readonly vorDerPruefung?: (koId: string) => Promise<void>;
}

export async function rennenUmDieFassung(opts: RennenOptionen): Promise<Fallbefund> {
  const runden: Runde[] = [];
  const bedingung = opts.bedingt ? 1 : undefined;
  for (let lauf = 1; lauf <= opts.wiederholungen; lauf += 1) {
    const koId = `${opts.praefix}-${lauf}`;
    await legeObjektAn(opts.lese, koId, RUMPF_BESTAND);
    const standVor = await schreibstand(opts.lese);
    const logstaende = [opts.a.protokoll.length, opts.b.protokoll.length];
    const [ra, rb] = await Promise.all([
      gibZurueck(
        opts.a.basis,
        opts.kopfA,
        koId,
        { statement: STATEMENT_A, bodyHtml: RUMPF_A },
        bedingung,
      ),
      gibZurueck(
        opts.b.basis,
        opts.kopfB,
        koId,
        { statement: STATEMENT_B, bodyHtml: RUMPF_B },
        bedingung,
      ),
    ]);
    const serverzeilen = neueServerzeilen([opts.a, opts.b], logstaende);
    await opts.vorDerPruefung?.(koId);
    const gewinner = gewinnerAus(ra, rb);
    const maengel: string[] = [];
    let siegerKo: KnowledgeObject | undefined;

    if (gewinner === "beide") {
      maengel.push(
        `BEIDE Rückgaben wurden mit 2xx quittiert — es sind zwei Gewinner entstanden (A ${ra.status}, B ${rb.status}).`,
      );
    } else if (gewinner === "keiner") {
      maengel.push(
        mitServerzeilen(
          `KEINE der beiden Rückgaben kam durch — A: ${deuteVerlierer(ra)} | B: ${deuteVerlierer(rb)}`,
          serverzeilen,
        ),
      );
    } else {
      const sieger = gewinner === "A" ? ra : rb;
      const verlierer = gewinner === "A" ? rb : ra;
      siegerKo = alsKo(sieger);
      // ── DER VERLIERER BEKOMMT EINEN KONFLIKT, DEN EIN MENSCH VERSTEHT. ────────────────────────
      if (verlierer.status !== 409) {
        maengel.push(
          verlierer.status >= 500
            ? mitServerzeilen(
                `der Verlierer antwortet ${deuteVerlierer(verlierer)} statt 409 KO_STALE.`,
                serverzeilen,
              )
            : `der Verlierer antwortet ${deuteVerlierer(verlierer)} statt 409 KO_STALE.`,
        );
      } else {
        const fehler = alsFehler(verlierer);
        if (fehler.error !== "KO_STALE") {
          maengel.push(`der 409 nennt „${String(fehler.error)}" statt „KO_STALE".`);
        }
        if (fehler.currentVersion !== opts.erwarteteKonfliktVersion) {
          maengel.push(
            `der 409 nennt currentVersion ${String(fehler.currentVersion)} statt ${opts.erwarteteKonfliktVersion} — ohne sie kann niemand weiterentscheiden.`,
          );
        }
        if ((fehler.message ?? "").trim().length === 0) {
          maengel.push("der 409 trägt keinen Satz — eine Absage ohne Auskunft.");
        }
      }
    }

    // ── DIE ENDLAGE, ÜBER EINE NEUE VERBINDUNG GELESEN. ─────────────────────────────────────────
    const gespeichert = await nachNeuerVerbindung(opts.url, koId);
    if (gespeichert === undefined) {
      maengel.push("das Wissensobjekt ist nach dem Rennen gar nicht mehr da.");
    } else {
      if (gespeichert.version !== 2) {
        maengel.push(`gespeichert ist Version ${gespeichert.version}, erwartet 2.`);
      }
      const rumpf = gespeichert.bodyHtml ?? "";
      if (siegerKo !== undefined) {
        const erwartet = siegerKo.bodyHtml ?? "";
        if (rumpf !== erwartet) {
          maengel.push(
            `der gespeicherte Fließtext ist nicht Zeichen für Zeichen der des Gewinners (gespeichert ${JSON.stringify(rumpf.slice(0, 120))}, Gewinner ${JSON.stringify(erwartet.slice(0, 120))}).`,
          );
        }
        const eigenes = MERKMAL[gewinner === "A" ? "A" : "B"];
        const fremdes = MERKMAL[gewinner === "A" ? "B" : "A"];
        if (!rumpf.includes(eigenes)) {
          maengel.push(
            `das Merkmal des Gewinners („${eigenes}") fehlt im gespeicherten Fließtext.`,
          );
        }
        if (rumpf.includes(fremdes)) {
          maengel.push(
            `das Merkmal des Verlierers („${fremdes}") steht im gespeicherten Fließtext.`,
          );
        }
        if (gespeichert.statement !== siegerKo.statement) {
          maengel.push("die gespeicherte Kernaussage ist nicht die des Gewinners.");
        }
      }
      // ── DER SCHNAPPSCHUSS: GENAU EINE ZEILE FÜR FASSUNG 2, UND SIE IST DER GESPEICHERTE STAND. ─
      maengel.push(
        ...(await pruefeSchnappschuss(opts.lese, koId, 2, gespeichert.bodyHtml ?? null)),
      );
    }
    // ── UND DER BELEG: VOLLSTÄNDIGKEIT UND IDENTITÄT, NICHT NUR INTEGRITÄT. ───────────────────────
    //
    // Bezugspunkt ist der ZURÜCKGELESENE Zustand, nicht das Protokoll: genau ein Gewinner heisst,
    // dass Fassung 2 wirklich entstanden ist, und dann MUSS das Belegpaar dastehen — auf den Namen
    // dessen, der wirklich zurückgegeben hat. Auf diesem Weg (`revise-release`) ist das für beide
    // Belege dieselbe Person (`service.ts:4549-4558`).
    const bestand = await auditBestand(opts.lese);
    const gewonnen = gewinner === "A" || gewinner === "B";
    const akteur = gewinner === "A" ? opts.akteurA : opts.akteurB;
    maengel.push(
      ...pruefeBelegvollstaendigkeit(
        bestand,
        gewonnen && gespeichert?.version === 2
          ? erwarteFassung(koId, 2, akteur, akteur)
          : erwarteKeineFassung(koId),
      ),
    );
    const standNach = await schreibstand(opts.lese);
    if (standNach - standVor !== SCHREIBSTAND_JE_RUECKGABE) {
      maengel.push(
        `der Schreibstand stieg um ${standNach - standVor}, erwartet genau ${SCHREIBSTAND_JE_RUECKGABE} (EINE wirksame Rückgabe).`,
      );
    }
    runden.push({
      lauf,
      koId,
      ueberlappt: ueberlappt(ra, rb),
      status: [ra.status, rb.status],
      gewinner,
      maengel,
    });
  }
  return fasseZusammen(runden);
}
