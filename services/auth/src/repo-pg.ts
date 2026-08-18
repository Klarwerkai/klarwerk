import type { Pool } from "pg";
import { type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { PasswordResetRepo, ResetToken, SessionRepo, UserRepo } from "./repo";
import { TOKEN_HASH_PREFIX, hashTokenAtRest } from "./service";
import type { Role, Session, User } from "./types";

// Postgres-Adapter für auth. Das Modul besitzt seine Tabellen (keine geteilten Tabellen).
export const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at text NOT NULL,
  -- SCRUM-504: markiert das EINE Bootstrap-Admin-Konto (erstes Konto bei leerer Tabelle). Der partielle
  -- Unique-Index unten erzwingt DB-nativ „höchstens ein Bootstrap-Admin" → zwei parallele Ersteinrichtungen
  -- (setup/register/OIDC) können nicht beide Admin werden (TOCTOU geschlossen). ALTER für Bestands-DBs.
  bootstrap_admin boolean NOT NULL DEFAULT false
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bootstrap_admin boolean NOT NULL DEFAULT false;
-- AUFTRAG-mega61 Block C: Kenntnisnahme des Hinweises am Konto (Zeitpunkt + gelesene Textfassung).
-- Bewusst NULL-bar und ohne Vorgabewert: „kein Vermerk" ist ein gültiger Zustand und heißt
-- „Hinweis erscheint". Ein Vorgabewert würde jedem Bestandskonto eine Quittung andichten, die es
-- nie gegeben hat.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notice_ack_at text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notice_ack_version text;
CREATE UNIQUE INDEX IF NOT EXISTS ko_users_one_bootstrap ON users (bootstrap_admin) WHERE bootstrap_admin;
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at bigint NOT NULL
);
`;

// WP-VIP2-GATE (bens P1, Token-at-Rest): ADDITIVE Einmal-Migration des Klartext-Bestands.
// WP-VIP2-GATE-2 (bens Fix 2, DEPLOY-VERTRAG) — SINGLE-INSTANZ IST EINE ANNAHME UEBER DIE
// BETRIEBSUMGEBUNG, KEINE GEMESSENE EIGENSCHAFT DIESES PRODUKTS.
//
// ANGENOMMEN wird: das Deployment laeuft als EINE Instanz (Coolify) — die Start-Migration liefe
// also ohne parallelen Neuprozess. Diese Voraussetzung liegt AUSSERHALB des Codes und ist im Repo
// nirgends belegt: sie ist NICHT gemessen. JOB 947 fuehrt sie als U1 unter den unbelegten
// Behauptungen und haelt fest, warum das hier schwerer wiegt als anderswo — es ist die einzige
// Stelle, an der eine solche Annahme als VERTRAG im Produktcode steht.
//
// WAS BEI MEHR ALS EINER INSTANZ GESCHIEHT: zwei Prozesse starten gleichzeitig und fahren die
// Migration unten zeitgleich; sie lesen dieselben Klartext-Zeilen und schreiben parallel ihre
// Hashes. Der Vertrag „laeuft ohne parallelen Neuprozess" bricht dann — und zwar STILL, weil
// nichts im Code das bemerkt.
//
// WAS DIE ANNAHME DESHALB TRAEGT — UND WAS NICHT: sie traegt die REIHENFOLGE-Zusage („kein
// paralleler Neuprozess"), nicht die Datensicherheit. Die faengt der Dual-Read ab, der unmittelbar
// unten beschrieben ist; er ist der Grund, warum ein zweiter Prozess kein Lockout-Fenster erzeugt.
// Die Einschraenkung ist also benannt, ohne die vorhandene Absicherung kleinzureden.
//
// ZU BESTAETIGEN durch Ops/Pedi: die tatsaechliche Instanzzahl steht in der Coolify-Konfiguration
// und ist eine Owner-Auskunft, kein Bau (JOB 947, Ownerfrage O-1). Solange sie aussteht, bleibt
// diese Zeile eine Annahme mit benanntem Restrisiko — nach dem Muster, das `docs/TEAM6_UPDATE.md`
// fuer `pg_trgm` bereits verwendet.
//
// ZUSAETZLICH faehrt der
// AuthService uebergangsweise Dual-Read (Hash zuerst, dann Klartext mit In-Place-Rehashing, s.
// findSessionDualRead): selbst ein Rolling-Deploy mit kurzzeitigem Altprozess erzeugt damit KEIN
// Lockout-Fenster (Klartext-Zeilen des Altprozesses werden beim ersten Zugriff gefunden und
// rehasht). Der Dual-Read ist nach der VIP2-Phase entfernbar.
// Bewusst eine Node-seitige Schleife statt pgcrypto (encode(digest(...))): die Extension ist nicht
// auf jeder Ziel-DB verfügbar/erlaubt (Hetzner/Managed-Pg), und der Bestand ist klein (aktive
// Sitzungen + offene Resets). IDEMPOTENT über die Format-Erkennung: gehashte Zeilen tragen das
// Präfix "sha256:" (Klartext-Tokens sind präfixlose 64-Hex — Länge allein unterscheidet nicht,
// da SHA-256-Hex ebenfalls 64 Zeichen hat) und werden übersprungen. Läuft bei jedem Start nach
// migrate() — der zweite Lauf findet nichts mehr. Abgelaufene Einträge werden dabei aufgeräumt
// (statt sie sinnlos zu hashen).
export async function migrateAuthTokensAtRest(
  pool: Pool,
  nowMs: number = Date.now(),
): Promise<{ hashedSessions: number; hashedResets: number }> {
  await pool.query("DELETE FROM sessions WHERE expires_at <= $1", [nowMs]);
  await pool.query("DELETE FROM password_resets WHERE expires_at <= $1", [nowMs]);
  const counts = { hashedSessions: 0, hashedResets: 0 };
  for (const table of ["sessions", "password_resets"] as const) {
    const plain = await pool.query<{ token: string }>(
      `SELECT token FROM ${table} WHERE token NOT LIKE $1`,
      [`${TOKEN_HASH_PREFIX}%`],
    );
    for (const row of plain.rows) {
      await pool.query(`UPDATE ${table} SET token=$2 WHERE token=$1`, [
        row.token,
        hashTokenAtRest(row.token),
      ]);
      if (table === "sessions") {
        counts.hashedSessions += 1;
      } else {
        counts.hashedResets += 1;
      }
    }
  }
  return counts;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_salt: string;
  password_hash: string;
  role: string;
  approved: boolean;
  created_at: string;
  notice_ack_at: string | null;
  notice_ack_version: string | null;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    role: row.role as Role,
    approved: row.approved,
    createdAt: row.created_at,
    // mega61 Block C: NULL → Feld fehlt (nicht `null`). Der Typ kennt nur „da" oder „nicht da";
    // ein drittes „ausdrücklich leer" gäbe es sonst nur in der Datenbank und nirgends sonst.
    ...(row.notice_ack_at ? { noticeAckAt: row.notice_ack_at } : {}),
    ...(row.notice_ack_version ? { noticeAckVersion: row.notice_ack_version } : {}),
  };
}

export class PgUserRepo implements UserRepo {
  constructor(private readonly pool: Pool) {}

  async count(): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users",
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async list(): Promise<User[]> {
    const res = await this.pool.query<UserRow>("SELECT * FROM users ORDER BY created_at");
    return res.rows.map(toUser);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const res = await this.pool.query<UserRow>("SELECT * FROM users WHERE LOWER(email)=LOWER($1)", [
      email,
    ]);
    return res.rows[0] ? toUser(res.rows[0]) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const res = await this.pool.query<UserRow>("SELECT * FROM users WHERE id=$1", [id]);
    return res.rows[0] ? toUser(res.rows[0]) : undefined;
  }

  async insert(user: User): Promise<void> {
    await this.pool.query(
      "INSERT INTO users(id,name,email,password_salt,password_hash,role,approved,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        user.id,
        user.name,
        user.email,
        user.passwordSalt,
        user.passwordHash,
        user.role,
        user.approved,
        user.createdAt,
      ],
    );
  }

  // SCRUM-504: EIN INSERT, das den Claim UND die Admin-Zeile atomar zusammenfasst (kein Split-Brain).
  // bootstrap_admin=true trifft den partiellen Unique-Index; läuft parallel ein zweiter Aufruf, verliert
  // er per ON CONFLICT DO NOTHING und bekommt keine Zeile (rowCount 0) → der Service legt ein normales
  // Konto an. Die Konflikt-Zielangabe nennt Spalte + Index-Prädikat, damit NUR der Bootstrap-Index
  // (nicht etwa die E-Mail-Unique) den DO-NOTHING-Pfad auslöst.
  async tryClaimBootstrapAdmin(user: User): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO users(id,name,email,password_salt,password_hash,role,approved,created_at,bootstrap_admin)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)
       ON CONFLICT (bootstrap_admin) WHERE bootstrap_admin DO NOTHING
       RETURNING id`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordSalt,
        user.passwordHash,
        user.role,
        user.approved,
        user.createdAt,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // AUFTRAG-mega62 Block B: ohne tx die normale Pool-Query (heutiges Verhalten unverändert); MIT tx
  // (von AuthService.acknowledgeNotice über die Kompositionswurzel gereicht) läuft das UPDATE auf
  // DEMSELBEN Client wie der Prüfprotokoll-Eintrag — beide committen oder beide rollbacken
  // (services/db-tx). Identisches Muster wie PgAuditRepo.
  async update(user: User, tx?: TxContext): Promise<void> {
    const ziel = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    await ziel.query(
      "UPDATE users SET name=$2,email=$3,password_salt=$4,password_hash=$5,role=$6,approved=$7,created_at=$8,notice_ack_at=$9,notice_ack_version=$10 WHERE id=$1",
      [
        user.id,
        user.name,
        user.email,
        user.passwordSalt,
        user.passwordHash,
        user.role,
        user.approved,
        user.createdAt,
        // mega61 Block C: `?? null` und nicht weglassen — sonst könnte ein Aufrufer, der den Nutzer
        // ohne die beiden Felder gelesen hat, einen bestehenden Vermerk nicht mehr überschreiben.
        user.noticeAckAt ?? null,
        user.noticeAckVersion ?? null,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM users WHERE id=$1", [id]);
  }
}

interface SessionRow {
  token: string;
  user_id: string;
  expires_at: string;
}

export class PgSessionRepo implements SessionRepo {
  constructor(private readonly pool: Pool) {}

  async create(session: Session): Promise<void> {
    await this.pool.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)", [
      session.token,
      session.userId,
      session.expiresAt,
    ]);
  }

  async find(token: string): Promise<Session | undefined> {
    const res = await this.pool.query<SessionRow>("SELECT * FROM sessions WHERE token=$1", [token]);
    const row = res.rows[0];
    return row
      ? { token: row.token, userId: row.user_id, expiresAt: Number(row.expires_at) }
      : undefined;
  }

  async delete(token: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token=$1", [token]);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  }
}

interface ResetRow {
  token: string;
  user_id: string;
  expires_at: string;
}

export class PgPasswordResetRepo implements PasswordResetRepo {
  constructor(private readonly pool: Pool) {}

  async create(entry: ResetToken): Promise<void> {
    await this.pool.query(
      "INSERT INTO password_resets(token,user_id,expires_at) VALUES($1,$2,$3)",
      [entry.token, entry.userId, entry.expiresAt],
    );
  }

  async find(token: string): Promise<ResetToken | undefined> {
    const res = await this.pool.query<ResetRow>("SELECT * FROM password_resets WHERE token=$1", [
      token,
    ]);
    const row = res.rows[0];
    return row
      ? { token: row.token, userId: row.user_id, expiresAt: Number(row.expires_at) }
      : undefined;
  }

  async delete(token: string): Promise<void> {
    await this.pool.query("DELETE FROM password_resets WHERE token=$1", [token]);
  }
}
