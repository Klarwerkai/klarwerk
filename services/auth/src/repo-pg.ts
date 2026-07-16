import type { Pool } from "pg";
import type { PasswordResetRepo, ResetToken, SessionRepo, UserRepo } from "./repo";
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

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_salt: string;
  password_hash: string;
  role: string;
  approved: boolean;
  created_at: string;
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

  async update(user: User): Promise<void> {
    await this.pool.query(
      "UPDATE users SET name=$2,email=$3,password_salt=$4,password_hash=$5,role=$6,approved=$7,created_at=$8 WHERE id=$1",
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
