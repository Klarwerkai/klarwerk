import type { TxContext } from "../../db-tx";
import type { Session, User } from "./types";

// Persistenz-Schnittstellen. Die In-Memory-Implementierung dient Tests und Dev;
// der Postgres-Adapter (Testcontainers-Integrationstests) folgt, sobald Docker bereitsteht.
export interface UserRepo {
  count(): Promise<number>;
  list(): Promise<User[]>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  /**
   * JOB 2686 (R2-7): Auflösung über die Identität aus dem Anbieter statt über die Mailadresse.
   *
   * BEIDE Teile sind Teil des Schlüssels. `sub` ist nur innerhalb eines Ausstellers eindeutig —
   * wer nur danach sucht, lässt einen zweiten (etwa versehentlich mitkonfigurierten) Anbieter
   * fremde Konten treffen. Ein Konto ohne gespeicherte Verknüpfung wird von dieser Methode NIE
   * geliefert; für das erste Verknüpfen ist ausdrücklich `findByEmail` zuständig, und nur unter
   * der Bedingung `email_verified` (s. AuthService.loginWithOidc).
   */
  findByOidcSubject(issuer: string, subject: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  /**
   * AUFTRAG-mega62 Block B: `tx` ist ein OPTIONALER, opaker Transaktionskontext (services/db-tx) —
   * additiv, abwärtskompatibel (alle bestehenden Aufrufer ohne tx bleiben unverändert). Zweck: die
   * Kenntnisnahme des Hinweises schreibt Konto UND Prüfprotokoll; beides muss gemeinsam committen
   * oder gemeinsam zurückrollen, sonst gäbe es einen Vermerk am Konto ohne Nachweis im Protokoll —
   * genau den Zustand, den der Nachweis ausschließen soll. Dasselbe Muster wie AuditRepo.append
   * und KoRepo.delete.
   */
  update(user: User, tx?: TxContext): Promise<void>;
  /**
   * JOB 3784: `tx` aus demselben Grund wie an `update` — der Aussperrschutz löscht INNERHALB seines
   * Rahmens (s. `withAdminGuard`). Ohne den Kontext liefe das DELETE über eine zweite Verbindung,
   * ausserhalb der Transaktion, deren Zeilensperre es gerade schützen soll.
   */
  delete(id: string, tx?: TxContext): Promise<void>;
  /**
   * JOB 3784: DER RAHMEN, IN DEM PRÜFUNG UND SCHREIBEN EINES VORGANGS LIEGEN.
   *
   * Der Aussperrschutz las bis hierher die Kontoliste und schrieb danach. Zwischen beidem liegt
   * eine `await`-Grenze, an der die Ereignisschleife eine zweite Anfrage bedient: zwei
   * Administratoren, die im selben Moment je einen anderen Admin herabstufen, lasen dieselbe Liste
   * mit zwei unbefristeten Admins, hielten sich beide für erlaubt und schrieben beide. Danach hatte
   * die Instanz keinen Verwaltungszugang mehr, und niemand konnte sich selbst wieder hereinlassen.
   *
   * Der Kontext ist OPTIONAL, weil ihn nur die Datenbank wirklich erzeugt — dieselbe Form wie
   * `update(user, tx?)`. Im Speicher gibt es keine Transaktion, wohl aber dieselbe Zusage
   * (s. `InMemoryUserRepo.withAdminGuard`).
   */
  withAdminGuard<T>(fn: (tx?: TxContext) => Promise<T>): Promise<T>;
  /**
   * JOB 3784: alle Konten mit `role === "admin"` und `approved === true`.
   *
   * SIE IST AUSSCHLIESSLICH EINE VERENGUNG DER SPERRE, KEINE ZWEITE WAHRHEIT ÜBER DEN SCHUTZ — die
   * vollständige Bedingung (zusätzlich `istUnbefristet`) bleibt im Dienst. Gesperrt werden soll,
   * was die Antwort ändern könnte; entschieden wird an einer Stelle, und die liegt in
   * `AuthService.isLastApprovedAdmin`. Stünde die Regel hier ein zweites Mal, könnten „gesperrt"
   * und „gezählt" auseinanderlaufen, und der Schutz hinge an der schwächeren der beiden Fassungen.
   */
  listAdminsForGuard(tx?: TxContext): Promise<User[]>;
  // SCRUM-504: atomarer Bootstrap-Claim. Fügt `user` als DEN Bootstrap-Admin ein und liefert true; ist
  // der einzige Bootstrap-Slot schon belegt (partieller Unique-Index / paralleler Gewinner), wird NICHTS
  // eingefügt und false geliefert (der Aufrufer legt dann ein normales Konto an). Schließt die
  // COUNT+INSERT-Race: egal wie viele parallele Ersteinrichtungen laufen, genau einer bekommt true.
  tryClaimBootstrapAdmin(user: User): Promise<boolean>;
}

export interface SessionRepo {
  create(session: Session): Promise<void>;
  find(token: string): Promise<Session | undefined>;
  delete(token: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

// FR-AUTH-08: kurzlebige Reset-Token (E-Mail-Passwort-Reset).
export interface ResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface PasswordResetRepo {
  create(entry: ResetToken): Promise<void>;
  find(token: string): Promise<ResetToken | undefined>;
  delete(token: string): Promise<void>;
}

export class InMemoryUserRepo implements UserRepo {
  private readonly users = new Map<string, User>();
  // SCRUM-504: Spiegel des partiellen Unique-Index — die ids der aktuell als Bootstrap-Admin markierten
  // Konten (höchstens eines). Als Set geführt, damit ein Löschen den Slot wieder freigibt (identisch zur
  // DB, wo das Löschen der Zeile den Index-Eintrag entfernt → wieder leere-Tabelle-Semantik).
  private readonly bootstrapAdminIds = new Set<string>();
  // JOB 3784: die Warteschlange des Aussperrschutzes (s. withAdminGuard).
  private sperre: Promise<void> = Promise.resolve();

  count(): Promise<number> {
    return Promise.resolve(this.users.size);
  }

  // Atomar im Single-Thread-Modell von JS: die Prüfung „Slot frei?" und das Setzen laufen ohne
  // dazwischenliegendes await, daher kann kein zweiter paralleler register/OIDC-Aufruf denselben Slot
  // beanspruchen. Freier Slot → einfügen + markieren + true; sonst nichts einfügen + false.
  tryClaimBootstrapAdmin(user: User): Promise<boolean> {
    if (this.bootstrapAdminIds.size > 0) {
      return Promise.resolve(false);
    }
    this.users.set(user.id, user);
    this.bootstrapAdminIds.add(user.id);
    return Promise.resolve(true);
  }

  list(): Promise<User[]> {
    return Promise.resolve([...this.users.values()]);
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

  // JOB 2686 (R2-7): Spiegel des partiellen Unique-Index aus AUTH_SCHEMA. Konten OHNE Verknüpfung
  // sind hier unsichtbar — ein leeres oder fehlendes Feld darf niemals auf ein leeres Suchargument
  // passen, sonst träfe die erste unverknüpfte Zeile jede Anfrage.
  findByOidcSubject(issuer: string, subject: string): Promise<User | undefined> {
    if (!issuer || !subject) {
      return Promise.resolve(undefined);
    }
    for (const user of this.users.values()) {
      if (user.oidcIssuer === issuer && user.oidcSubject === subject) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(undefined);
  }

  insert(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  // AUFTRAG-mega62 Block B: `_tx` wird bewusst ignoriert — im Speicher gibt es kein I/O-Fenster
  // zwischen zwei Schreibern, und ein nachgebautes Rollback wäre eine Kulisse, die eine Zusage
  // vortäuscht, die nur die Datenbank halten kann. Die Reihenfolge im Dienst (Protokoll ZUERST)
  // trägt den Speicherfall (s. AuthService.acknowledgeNotice).
  update(user: User, _tx?: TxContext): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  // JOB 3784: `_tx` ignoriert, aus demselben Grund wie an `update` darüber.
  delete(id: string, _tx?: TxContext): Promise<void> {
    this.users.delete(id);
    this.bootstrapAdminIds.delete(id); // SCRUM-504: Löschen gibt den Bootstrap-Slot wieder frei.
    return Promise.resolve();
  }

  /**
   * JOB 3784: DIESELBE ZUSAGE WIE `SELECT … FOR UPDATE`, OHNE DATENBANK.
   *
   * Solange `fn` läuft, kommt kein zweiter Vorgang an die Prüfung des Aussperrschutzes. Gebaut wie
   * `InMemoryKoSearchProjectionRepo.withExclusiveControlLock` (services/knowledge-object): eine
   * Promise-Kette, an die sich jeder Aufrufer hinten anhängt.
   *
   * DIE KETTE LÄUFT AUCH DANN WEITER, WENN `fn` WIRFT — und das ist hier kein Randfall, sondern der
   * Normalfall: eine berechtigte Ablehnung („Der letzte Administrator kann nicht herabgestuft
   * werden.") IST ein Wurf. Wer die Kette nur im Erfolgsfall weiterreicht, sperrt die Instanz nach
   * der ersten Ablehnung dauerhaft zu; aus dem Aussperrschutz würde eine Aussperrung.
   *
   * DAS TRÄGT DER ZWEITE HANDLER AN DER ZUWEISUNG UNTEN, und nur er: `this.sperre` wird dadurch
   * NIE abgelehnt, egal wie `fn` ausgeht. Beim Warten oben braucht es deshalb keinen zweiten
   * Handler — er wäre eine Zeile, die kein Fall je erreichen kann. (Das Vorbild
   * `withExclusiveControlLock` führt ihn dort mit; gemessen ist er wirkungslos, solange die
   * Zuweisung beide Ausgänge abfängt.) Ohne den Handler unten trüge `this.sperre` die Ablehnung
   * weiter: der nächste Vorgang bekäme den Fehler des vorigen, ohne selbst gelaufen zu sein.
   *
   * WARUM HIER KEIN ROLLBACK NACHGEBAUT WIRD: aus demselben Grund, aus dem `update` seinen `_tx`
   * ignoriert (Kommentar oben) — ein nachgebautes Rollback wäre eine Kulisse, die eine Zusage
   * vortäuscht, die nur die Datenbank halten kann. Was diese Sperre zusagt, ist nicht Atomarität,
   * sondern Ausschluss: zwischen Prüfung und Schreiben liegt kein fremder Schreiber. Genau das ist
   * die Lücke, die JOB 3784 schliesst, und für sie reicht die Kette.
   */
  withAdminGuard<T>(fn: (tx?: TxContext) => Promise<T>): Promise<T> {
    const lauf = this.sperre.then(() => fn(undefined));
    this.sperre = lauf.then(
      () => undefined,
      () => undefined,
    );
    return lauf;
  }

  // JOB 3784: die Verengung der Sperre — Admins mit Freigabe. Die vollständige Bedingung des
  // Schutzes (zusätzlich „unbefristet") steht im Dienst, s. UserRepo.listAdminsForGuard.
  listAdminsForGuard(_tx?: TxContext): Promise<User[]> {
    return Promise.resolve(
      [...this.users.values()].filter((u) => u.role === "admin" && u.approved),
    );
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

export class InMemoryPasswordResetRepo implements PasswordResetRepo {
  private readonly tokens = new Map<string, ResetToken>();

  create(entry: ResetToken): Promise<void> {
    this.tokens.set(entry.token, entry);
    return Promise.resolve();
  }

  find(token: string): Promise<ResetToken | undefined> {
    return Promise.resolve(this.tokens.get(token));
  }

  delete(token: string): Promise<void> {
    this.tokens.delete(token);
    return Promise.resolve();
  }
}
