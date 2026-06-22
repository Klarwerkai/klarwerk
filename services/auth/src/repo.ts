import type { Session, User } from "./types";

// Persistenz-Schnittstellen. Die In-Memory-Implementierung dient Tests und Dev;
// der Postgres-Adapter (Testcontainers-Integrationstests) folgt, sobald Docker bereitsteht.
export interface UserRepo {
  count(): Promise<number>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SessionRepo {
  create(session: Session): Promise<void>;
  find(token: string): Promise<Session | undefined>;
  delete(token: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

export class InMemoryUserRepo implements UserRepo {
  private readonly users = new Map<string, User>();

  count(): Promise<number> {
    return Promise.resolve(this.users.size);
  }

  findByEmail(email: string): Promise<User | undefined> {
    const target = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(undefined);
  }

  findById(id: string): Promise<User | undefined> {
    return Promise.resolve(this.users.get(id));
  }

  insert(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  update(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.users.delete(id);
    return Promise.resolve();
  }
}

export class InMemorySessionRepo implements SessionRepo {
  private readonly sessions = new Map<string, Session>();

  create(session: Session): Promise<void> {
    this.sessions.set(session.token, session);
    return Promise.resolve();
  }

  find(token: string): Promise<Session | undefined> {
    return Promise.resolve(this.sessions.get(token));
  }

  delete(token: string): Promise<void> {
    this.sessions.delete(token);
    return Promise.resolve();
  }

  deleteByUser(userId: string): Promise<void> {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(token);
      }
    }
    return Promise.resolve();
  }
}
