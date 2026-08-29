import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { TxContext } from "../../db-tx";
import type { OidcClaims } from "./oidc";
import { hashPassword, verifyPassword } from "./password";
import {
  InMemoryPasswordResetRepo,
  type PasswordResetRepo,
  type SessionRepo,
  type UserRepo,
} from "./repo";
import { AuthError, type PublicUser, type Role, type Session, type User } from "./types";

const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 Tage
const RESET_TTL_MS = 60 * 60 * 1000; // FR-AUTH-08: Reset-Token 1 Stunde gültig

// JOB 2686 (R2-8): die Rangfolge der Rollen, EINMAL und an einer Stelle. Sie ist dieselbe, die
// `mapOidcRole` als Präzedenz fährt (admin > controller > experte > viewer) — dort als
// Reihenfolge von if-Zweigen, hier als vergleichbare Zahl. Zwei Darstellungen derselben Ordnung;
// liefen sie auseinander, könnte eine Herabstufung zur Anhebung werden.
const ROLLEN_RANG: Record<Role, number> = { viewer: 0, experte: 1, controller: 2, admin: 3 };

/**
 * JOB 2686 (R2-8): eigene Sitzungsdauer für SSO-Anmeldungen.
 *
 * VORGABE IST DAS HEUTIGE VERHALTEN (14 Tage) — ausdrücklich, nicht aus Bequemlichkeit. Der
 * Review schlägt 12 Stunden vor, und das ist gut begründet: ohne Back-Channel-Logout ist die
 * Sitzungsdauer die einzige Obergrenze dafür, wie lange jemand nach seiner Abschaltung im
 * Anbieter noch handeln kann. Aber sie ändert, wie oft sich ein Mensch anmelden muss, und das ist
 * eine Produktentscheidung. Der Schalter steht bereit; die Zahl gehört Pedi.
 *
 * Der Wert wird hier gelesen und nicht in der Kompositionswurzel — dasselbe Muster wie
 * `selfRegistrationEnabled` in routes.ts, und es hält die Entscheidung im Modul, das sie betrifft.
 */
export function oidcSessionTtlMs(env: Record<string, string | undefined> = process.env): number {
  const roh = env.OIDC_SESSION_TTL_HOURS;
  if (roh === undefined || roh.trim() === "") {
    return SESSION_TTL_MS;
  }
  const stunden = Number(roh);
  // Unbrauchbare Angabe ⇒ heutiges Verhalten. Eine `0` oder ein Tippfehler darf keine Sitzung
  // erzeugen, die sofort abgelaufen ist — das sähe wie ein kaputtes Anmelden aus, nicht wie eine
  // Fehlkonfiguration, und niemand fände die Ursache.
  if (!Number.isFinite(stunden) || stunden <= 0) {
    return SESSION_TTL_MS;
  }
  return Math.round(stunden * 60 * 60 * 1000);
}

// WP-VIP2-GATE (bens P1, Token-at-Rest): Session- und Reset-Tokens werden NUR noch als
// SHA-256-Hash gespeichert — der Klartext existiert ausschließlich beim Client (Cookie/Bearer/
// Mail-Link). Ein DB-Leak (Dump, Backup, Log) liefert damit keine verwendbaren Sitzungen mehr.
// Das Präfix "sha256:" ist die FORMAT-ERKENNUNG der Migration (Klartext-Tokens sind 64-Hex OHNE
// Präfix — Länge allein würde nicht unterscheiden, da SHA-256-Hex ebenfalls 64 Zeichen hat).
// Gehasht wird zentral HIER im Service — InMemory- und Pg-Repo speichern identisch nur den Hash.
export const TOKEN_HASH_PREFIX = "sha256:";

export function hashTokenAtRest(token: string): string {
  return `${TOKEN_HASH_PREFIX}${createHash("sha256").update(token).digest("hex")}`;
}

// SCRUM-443 (Berater-Audit): serverseitige Rollenwechsel-Prüfung. Wird von build-app mit der
// echten rbac.canChangeRole verdrahtet (FR-RBAC-03). auth importiert rbac NICHT direkt
// (rbac hängt von auth ab → Zyklus); die Regel kommt als injizierte Funktion herein.
export type RoleChangePolicy = (
  actor: { id: string; role: Role },
  targetUserId: string,
  newRole: Role,
) => boolean;

// Fallback ohne Wiring (Unit-Tests): FR-RBAC-03 minimal — ein Admin kann sich die Admin-Rolle
// nicht selbst entziehen. In Produktion injiziert build-app die vollständige rbac.canChangeRole.
const defaultCanChangeRole: RoleChangePolicy = (actor, targetUserId, newRole) =>
  !(actor.id === targetUserId && newRole !== "admin");

// AUFTRAG-mega62 Block B: die Fähigkeit der Kompositionswurzel, EINE echte Transaktion zu öffnen —
// storage-neutral, mit dem opaken TxContext aus services/db-tx (KEIN Pg-Typ in dieser Signatur).
// Dieselbe Form, die KoService und AskService schon führen; build-app bindet sie an denselben Pool,
// mit dem PgUserRepo und PgAuditRepo verdrahtet sind. Ohne Injektion (InMemory, Dev-Journal) bleibt
// der sequentielle Weg — abgesichert über die Schreibreihenfolge, s. acknowledgeNotice.
export type WithTx = <T>(fn: (tx: TxContext) => Promise<T>) => Promise<T>;

export interface AuthServiceDeps {
  users: UserRepo;
  sessions: SessionRepo;
  resetTokens?: PasswordResetRepo;
  audit?: AuditService;
  // AUFTRAG-mega62 Block B: optionale echte DB-Transaktion für die Kenntnisnahme des Hinweises
  // (Konto-Vermerk + Prüfprotokoll-Eintrag committen/rollbacken gemeinsam).
  withTx?: WithTx;
  now?: () => number;
  genId?: () => string;
  genToken?: () => string;
  // SCRUM-443: injizierte Rollenwechsel-Regel (Default: nur Selbst-Entzug-Schutz).
  canChangeRole?: RoleChangePolicy;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toPublic(user: User): PublicUser {
  const { passwordSalt: _salt, passwordHash: _hash, ...rest } = user;
  return rest;
}

export class AuthService {
  private readonly users: UserRepo;
  private readonly sessions: SessionRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly genToken: () => string;
  private readonly resetTokens: PasswordResetRepo;
  private readonly canChangeRolePolicy: RoleChangePolicy;
  // AUFTRAG-mega62 Block B: nur gesetzt, wenn die Kompositionswurzel einen echten Pg-Pool hat.
  private readonly withTx: WithTx | undefined;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.sessions = deps.sessions;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.genToken = deps.genToken ?? (() => randomBytes(32).toString("hex"));
    this.resetTokens = deps.resetTokens ?? new InMemoryPasswordResetRepo();
    this.canChangeRolePolicy = deps.canChangeRole ?? defaultCanChangeRole;
    this.withTx = deps.withTx;
  }

  // FR-AUTH-01: Ist noch kein Konto vorhanden? Dann ist Ersteinrichtung nötig (Setup-Screen).
  async needsSetup(): Promise<boolean> {
    return (await this.users.count()) === 0;
  }

  // FR-RBAC-01: Nutzerliste (ohne Passwort-Hash) für die Admin-Verwaltung.
  async listUsers(): Promise<PublicUser[]> {
    const users = await this.users.list();
    return users.map(toPublic);
  }

  // FR-AUTH-01 (erstes Konto = Admin) + FR-AUTH-02 (Selbstregistrierung, gesperrt bis Freigabe).
  async register(input: RegisterInput): Promise<PublicUser> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    if (await this.users.findByEmail(input.email)) {
      throw new AuthError("EMAIL_TAKEN", "E-Mail ist bereits vergeben.");
    }
    const { salt, hash } = await hashPassword(input.password);
    const base = {
      id: this.genId(),
      name: input.name,
      email: input.email,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date(this.now()).toISOString(),
    };
    // SCRUM-504: Bootstrap NUR bei leerer Tabelle versuchen (bestehende Systeme legen nie einen zweiten
    // Admin an). Die Atomarität liefert der DB-Index in tryClaimBootstrapAdmin: bei paralleler
    // Ersteinrichtung gewinnt genau EIN Aufruf den Admin, alle anderen fallen auf ein normales Konto
    // zurück (kein Fehler, wie ein regulärer Nicht-Erst-Register).
    if ((await this.users.count()) === 0) {
      const admin: User = { ...base, role: "admin", approved: true };
      if (await this.users.tryClaimBootstrapAdmin(admin)) {
        return toPublic(admin);
      }
    }
    const user: User = { ...base, role: "experte", approved: false };
    await this.users.insert(user);
    return toPublic(user);
  }

  // FR-AUTH-03: Login nur mit korrekten, freigegebenen Daten; FR-AUTH-05: Hash-Prüfung.
  async login(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
      throw new AuthError("INVALID_CREDENTIALS", "E-Mail oder Passwort falsch.");
    }
    if (!user.approved) {
      throw new AuthError("NOT_APPROVED", "Konto ist noch nicht freigegeben.");
    }
    const token = this.genToken();
    // Token-at-Rest: nur der Hash wird persistiert; der Klartext geht ausschliesslich an den Client.
    await this.sessions.create({
      token: hashTokenAtRest(token),
      userId: user.id,
      expiresAt: this.now() + SESSION_TTL_MS,
    });
    await this.record(user.id, "auth.login", user.id);
    return { token, user: toPublic(user) };
  }

  // FR-AUTH-07: SSO-Login. Bereits verifizierte OIDC-Claims → Sitzung. Optional
  // Auto-Provisionierung neuer Nutzer (sonst muss der Admin das Konto anlegen).
  // mappedRole: aus OIDC-Claims abgeleitete Rolle (FR-AUTH-07). Wird NUR beim
  // Provisionieren neuer SSO-Konten angewandt. Bestehende Konten behalten ihre
  // vom Admin vergebene Rolle — Claims überschreiben nie still (kein Privilege-Injection).
  async loginWithOidc(
    claims: OidcClaims,
    autoProvision: boolean,
    mappedRole?: Role,
  ): Promise<{ token: string; user: PublicUser }> {
    // JOB 2686 (R2-7): ZUERST DIE IDENTITAET, DANN ERST DIE ADRESSE.
    //
    // Vorher stand hier ein einzelnes `findByEmail(claims.email)` — die Mailadresse WAR die
    // Identitaet. Jetzt ist sie nur noch der Weg, ein Konto EINMAL mit einer Identitaet zu
    // verknuepfen; wiedererkannt wird ausschliesslich ueber (Aussteller, Subjekt).
    let account = await this.users.findByOidcSubject(claims.iss, claims.sub);
    let frischAngelegt = false;
    if (!account) {
      account = await this.verknuepfeUeberAdresse(claims);
    }
    if (!account) {
      if (!autoProvision) {
        throw new AuthError(
          "NOT_APPROVED",
          "Kein Konto für diese E-Mail. Bitte vom Admin anlegen lassen.",
        );
      }
      const base = {
        id: this.genId(),
        name: claims.name,
        email: claims.email,
        passwordSalt: "", // SSO-Konto: kein Passwort-Login möglich.
        passwordHash: "",
        approved: true,
        createdAt: new Date(this.now()).toISOString(),
        // JOB 2686 (R2-7): ein neues SSO-Konto traegt seine Identitaet von der ersten Sekunde an.
        // Wuerde sie erst beim zweiten Anmelden gesetzt, waere das erste Anmelden ungeschuetzt —
        // und ein zweiter Anmelder mit derselben Adresse koennte das frische Konto uebernehmen.
        oidcIssuer: claims.iss,
        oidcSubject: claims.sub,
      };
      // SCRUM-504: identisch abgesichert wie register — Bootstrap-Admin nur bei leerer Tabelle, atomar
      // über den DB-Index. Verlierer eines parallelen Race bekommt die gemappte Rolle (Default viewer).
      let provisioned: User | undefined;
      if ((await this.users.count()) === 0) {
        const admin: User = { ...base, role: "admin" };
        if (await this.users.tryClaimBootstrapAdmin(admin)) {
          provisioned = admin;
        }
      }
      if (!provisioned) {
        provisioned = { ...base, role: mappedRole ?? "viewer" };
        await this.users.insert(provisioned);
      }
      account = provisioned;
      frischAngelegt = true;
      await this.record(account.id, "user.oidc-provisioned", account.id);
    }
    if (!account.approved) {
      throw new AuthError("NOT_APPROVED", "Konto ist noch nicht freigegeben.");
    }
    // JOB 2686 (R2-8): der Rollenabgleich, VOR der Sitzung — sonst traegt die frische Sitzung noch
    // die alte, zu hohe Rolle.
    //
    // NICHT BEI DER ERSTANLAGE, und das ist keine Feinheit: die Rolle wurde eine Zeile weiter oben
    // gerade erst gesetzt — entweder als Bootstrap-Admin (erstes Konto der Instanz, SCRUM-504) oder
    // als die gemappte Rolle selbst. Liefe der Abgleich hier mit, stufte er den frisch angelegten
    // Bootstrap-Admin im selben Aufruf wieder auf `viewer` herab, und die Instanz haette NIE einen
    // Admin. Abgeglichen wird, was VORHER schon da war.
    if (!frischAngelegt) {
      account = await this.gleicheRolleAb(account, claims, mappedRole);
    }
    const token = this.genToken();
    await this.sessions.create({
      token: hashTokenAtRest(token),
      userId: account.id,
      // JOB 2686 (R2-8): eigene Laufzeit fuer SSO-Sitzungen, VORGABE = das heutige Verhalten
      // (14 Tage). Der Befund schlaegt 12 Stunden vor; das ist eine PRODUKTENTSCHEIDUNG — sie
      // aendert, wie oft sich ein Mensch anmelden muss — und gehoert deshalb Pedi, nicht dieser
      // Bahn. Der Schalter ist gebaut, die Frage ist gestellt, der Vorgabewert aendert nichts.
      expiresAt: this.now() + oidcSessionTtlMs(),
    });
    await this.record(account.id, "auth.login", account.id, { method: "oidc" });
    return { token, user: toPublic(account) };
  }

  /**
   * JOB 2686 (R2-7): der EINZIGE Weg, auf dem eine Mailadresse noch ein Konto findet — das ERSTE
   * Verknüpfen. Danach läuft jede Anmeldung über (Aussteller, Subjekt).
   *
   * Die drei Ausgänge sind bewusst verschieden:
   *   · kein Konto zu dieser Adresse  ⇒ `undefined`, der Aufrufer provisioniert (oder lehnt ab).
   *   · Konto ist SCHON verknüpft     ⇒ WURF. Hier steht der eigentliche Angriff: jemand mit
   *     derselben Adresse, aber anderem Subjekt, will ein fremdes Konto übernehmen. Auch eine im
   *     Anbieter neu vergebene alte Adresse (Nachfolger auf dem Postfach) landet hier.
   *   · Konto ist NOCH NICHT verknüpft ⇒ verknüpfen, sofern die Adresse nicht AUSDRÜCKLICH als
   *     unbestätigt gemeldet wurde.
   *
   * DREI ZUSTÄNDE, NICHT ZWEI — Pedis Entscheidung vom 29.08.2026 zu Ownerfrage 3 aus D1
   * (`00_CONTROL/ENTSCHEIDUNGEN/JOB-2686.md`):
   *
   *   `true`      ⇒ verknüpfen, Vermerk `user.oidc-linked`
   *   Claim fehlt ⇒ verknüpfen, Vermerk `user.oidc-linked-unverified`
   *   `false`     ⇒ WURF (401)
   *
   * WARUM D1 HIER FALSCH LAG: Ich hatte `!== true` geprüft und damit den fehlenden Claim wie ein
   * `false` behandelt. Das sperrt ausgerechnet im SICHERSTEN Fall alle aus. Der Angriff aus R2-7
   * braucht eine unverifizierte Adresse — jemanden, der `admin@firma.de` im Anbieter selbst setzen
   * kann. Ein Anbieter, der den Claim gar nicht führt (Entra ID, Keycloak in
   * Standardkonfiguration), vergibt Adressen durch die IT und liefert sie deshalb auch dem
   * Angreifer nicht. Die strengere Auslegung traf also niemanden, der es darauf anlegt, und alle
   * Bestandskonten, die der Fix schützen sollte.
   *
   * DER EIGENE VERMERK IST DER PREIS DAFÜR, und er ist kein Beiwerk: Jede Verknüpfung ohne
   * bestätigte Adresse steht als eigene Aktion im Prüfprotokoll. Wer später feststellt, dass sein
   * Anbieter doch freie Adressen erlaubte, bekommt die Liste — ohne sie wäre die Nachsicht
   * unumkehrbar, weil niemand mehr wüsste, welche Konten sie betraf.
   *
   * `OIDC_REQUIRE_EMAIL_VERIFIED` bleibt unberührt und wirkt weiterhin dort, wo eine Aussage
   * VORLIEGT und `false` lautet (`oidc.ts`, im Verifier).
   */
  private async verknuepfeUeberAdresse(claims: OidcClaims): Promise<User | undefined> {
    const perAdresse = await this.users.findByEmail(claims.email);
    if (!perAdresse) {
      return undefined;
    }
    if (perAdresse.oidcSubject) {
      throw new Error("SSO-Identität passt nicht zum verknüpften Konto.");
    }
    // NUR die ausdrückliche Verneinung sperrt. `undefined` ist keine Verneinung, sondern
    // Schweigen — und Schweigen des Anbieters darf keinen Menschen aussperren.
    if (claims.emailVerified === false) {
      throw new Error("SSO-Verknüpfung: die E-Mail-Adresse ist ausdrücklich unbestätigt.");
    }
    const verknuepft: User = {
      ...perAdresse,
      oidcIssuer: claims.iss,
      oidcSubject: claims.sub,
    };
    await this.users.update(verknuepft);
    await this.record(
      verknuepft.id,
      // Zwei getrennte Aktionen statt eines Merkmals in der Nutzlast: nur so lässt sich die Liste
      // der unbestätigten Verknüpfungen mit einer Filterabfrage ziehen, ohne jeden Eintrag zu
      // öffnen — und genau dafür ist sie da.
      claims.emailVerified === true ? "user.oidc-linked" : "user.oidc-linked-unverified",
      verknuepft.id,
      {
        // Kein `sub` und keine Adresse in der Nutzlast: das Prüfprotokoll belegt, DASS verknüpft
        // wurde, und wird kein zweites Verzeichnis der Identitäten.
        aussteller: claims.iss,
      },
    );
    return verknuepft;
  }

  /**
   * JOB 2686 (R2-8): Rechte NEHMEN, nie GEBEN.
   *
   * Die alte Entscheidung „Claims überschreiben nie" (bis JOB 2686 in loginWithOidc) schützte vor
   * Privilege-Injection nach oben und ließ die Richtung nach unten ebenso liegen: wer im Anbieter
   * aus der Admin-Gruppe flog, blieb hier Admin. Beides zusammen geht — die Richtung ist der
   * ganze Unterschied.
   *
   * NUR SSO-KONTEN (`passwordHash === ""`). Ein vom Admin von Hand angelegtes Passwortkonto folgt
   * keinem Anbieter; dort wäre eine Herabstufung durch fremde Claims selbst der Angriff.
   */
  private async gleicheRolleAb(
    account: User,
    claims: OidcClaims,
    mappedRole?: Role,
  ): Promise<User> {
    if (account.passwordHash !== "") {
      return account;
    }
    // Fehlt der Rollen-Claim GANZ, ist das keine Aussage über die Gruppen des Menschen, sondern
    // eine Lücke in der Anbieterkonfiguration. Sie darf niemanden herabstufen — aber sie darf auch
    // nicht schweigend vorbeigehen, sonst sucht sie später niemand.
    if (!claims.rolesClaimPresent) {
      await this.record(account.id, "user.role-claim-missing", account.id, {
        aussteller: claims.iss,
        rolle: account.role,
      });
      return account;
    }
    const ziel = mappedRole ?? "viewer";
    if (ROLLEN_RANG[ziel] >= ROLLEN_RANG[account.role]) {
      return account; // gleich oder höher: nie anheben.
    }
    const herabgestuft: User = { ...account, role: ziel };
    await this.users.update(herabgestuft);
    await this.record(account.id, "user.role-synced", account.id, {
      von: account.role,
      nach: ziel,
      aussteller: claims.iss,
    });
    return herabgestuft;
  }

  // WP-VIP2-GATE-2 (bens Fix 2, Deploy-Vertrag): UEBERGANGSWEISER DUAL-READ der Session-Suche.
  // Erst der Hash-Lookup; bei Miss — und NUR wenn der Client-Wert selbst KEIN sha256:-Praefix
  // traegt (dann waere es kein Klartext-Token, sondern jemand reicht einen Hash ein) — der
  // Alt-Lookup ueber den Klartext-Schluessel. Ein Treffer wird SOFORT in-place auf den Hash
  // umgezogen (delete Klartext-Zeile + create Hash-Zeile) — damit ist auch ein PARALLELER
  // Altprozess waehrend eines Rolling-Deploys harmlos (er schreibt Klartext-Zeilen, die der
  // neue Prozess beim ersten Zugriff findet und rehasht; kein Lockout).
  // AUSLAUF: nach der VIP2-Phase entfernbar — sobald kein Altprozess mehr laeuft und die
  // Start-Migration (migrateAuthTokensAtRest) einmal durch ist, existieren keine
  // Klartext-Zeilen mehr; dann bleibt allein der Hash-Lookup.
  private async findSessionDualRead(token: string): Promise<Session | undefined> {
    const stored = hashTokenAtRest(token);
    const byHash = await this.sessions.find(stored);
    if (byHash) {
      return byHash;
    }
    if (token.startsWith(TOKEN_HASH_PREFIX)) {
      return undefined; // kein Klartext-Token — kein Alt-Lookup
    }
    const legacy = await this.sessions.find(token);
    if (!legacy) {
      return undefined;
    }
    // In-Place-Rehashing: die Zeile zieht auf den Hash-Schluessel um (kein Klartext-Neuschreiben).
    await this.sessions.delete(token);
    const rehashed: Session = { ...legacy, token: stored };
    await this.sessions.create(rehashed);
    return rehashed;
  }

  // FR-AUTH-04: Logout beendet die Sitzung serverseitig.
  async logout(token: string): Promise<void> {
    // Dual-Read (s. findSessionDualRead): nach dem Lookup liegt die Zeile sicher unter dem Hash.
    const session = await this.findSessionDualRead(token);
    await this.sessions.delete(hashTokenAtRest(token));
    if (session) {
      await this.record(session.userId, "auth.logout", session.userId);
    }
  }

  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK C — DIE KENNTNISNAHME DES HINWEISES, AM KONTO.
  // ==============================================================================================
  //
  // WARUM NICHT IM BROWSERSPEICHER: Im Browserspeicher zu merken, dass jemand den Hinweis ÜBER den
  // Browserspeicher gelesen hat, wäre zirkulär — und beim Gerätewechsel wäre der Vermerk weg, der
  // Hinweis käme wieder, und die Quittung wäre wertlos. Sie gehört deshalb an das Konto.
  //
  // Der Vorgang wird im Prüfprotokoll festgehalten, in dem ohnehin Anmeldung und Abmeldung stehen.
  // Die Nutzlast trägt AUSSCHLIESSLICH die gelesene Textfassung — keine IP, keine Browserkennung.
  // ==============================================================================================
  // AUFTRAG-mega62 BLOCK B — DER VERMERK UND SEIN NACHWEIS ENTSTEHEN GEMEINSAM ODER GAR NICHT.
  // ==============================================================================================
  //
  // BIS mega61 lief hier erst `users.update`, danach `record`. Scheiterte das Protokollieren, war
  // der Vermerk am Konto trotzdem geschrieben: Die Route antwortete mit Fehler, der Banner war beim
  // nächsten Laden weg, und der Satz „die Kenntnisnahme steht im Prüfprotokoll" war unwahr. Ein
  // Nachweis, der im Fehlerfall lautlos zur Hälfte entsteht, ist als Nachweis wertlos.
  //
  // GEWÄHLTER WEG: die ECHTE gemeinsame Transaktion über den bestehenden opaken Vertrag
  // (services/db-tx), den die Kompositionswurzel ohnehin schon an KoService und AskService bindet.
  // Kein Umbau der Wurzel: `withTx` kommt als optionale Abhängigkeit herein, `UserRepo.update`
  // nimmt den opaken Kontext additiv entgegen (wie AuditRepo.append seit SCRUM-523). Kein
  // Nachholvertrag — der wäre eine zweite Wahrheit über denselben Nachweis, und ein Nachholer, den
  // niemand beobachtet, ist selbst nur eine Zusage ohne Deckung.
  //
  // UND DIE REIHENFOLGE DREHT SICH TROTZDEM UM: Protokoll ZUERST, Konto danach. Das ist die
  // Absicherung für JEDEN Persistenzweg, auch den ohne `withTx` (InMemory, Dev-Journal) — dort
  // gibt es keine Transaktion, die etwas zurückrollen könnte. Von den beiden möglichen halben
  // Zuständen ist nur EINER erträglich:
  //
  //   · Protokolleintrag ohne Konto-Vermerk → der Hinweis erscheint erneut, die Nutzerin quittiert
  //     ein zweites Mal, das Protokoll trägt zwei Zeilen. Unschön, aber wahr.
  //   · Konto-Vermerk ohne Protokolleintrag → der Banner ist weg, und es gibt keinen Nachweis,
  //     dass informiert wurde. Genau der Zustand, gegen den dieser Block gebaut ist.
  //
  // Die Reihenfolge schließt den zweiten aus, die Transaktion (wo es sie gibt) zusätzlich den
  // ersten. Beides zusammen, nicht eins statt des anderen.
  async acknowledgeNotice(userId: string, version: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AuthError("NOT_FOUND", "Konto nicht gefunden.");
    }
    const updated: User = {
      ...user,
      noticeAckAt: new Date(this.now()).toISOString(),
      noticeAckVersion: version,
    };
    const schreiben = async (tx?: TxContext): Promise<void> => {
      await this.record(user.id, "notice.acknowledged", user.id, { version }, tx);
      await this.users.update(updated, tx);
    };
    if (this.withTx) {
      await this.withTx(schreiben);
    } else {
      await schreiben();
    }
    return toPublic(updated);
  }

  /** Der vermerkte Stand eines Kontos — die Grundlage der Entscheidung „Hinweis zeigen?“. */
  async noticeAck(
    userId: string,
  ): Promise<{ acknowledgedAt?: string; acknowledgedVersion?: string }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AuthError("NOT_FOUND", "Konto nicht gefunden.");
    }
    return {
      ...(user.noticeAckAt ? { acknowledgedAt: user.noticeAckAt } : {}),
      ...(user.noticeAckVersion ? { acknowledgedVersion: user.noticeAckVersion } : {}),
    };
  }

  async authenticate(token: string): Promise<PublicUser | undefined> {
    // Lookup ueber den Hash — das Repo kennt den Klartext nie; Dual-Read nur als Deploy-Uebergang.
    const session = await this.findSessionDualRead(token);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt <= this.now()) {
      await this.sessions.delete(hashTokenAtRest(token)); // abgelaufen → beim Zugriff aufraeumen
      return undefined;
    }
    const user = await this.users.findById(session.userId);
    return user ? toPublic(user) : undefined;
  }

  // SCRUM-450: reine Passwort-Prüfung eines Nutzers (Re-Authentifizierung vor kritischen,
  // unwiderruflichen Aktionen wie dem Werksreset). Keine Sitzung, keine Nebenwirkung.
  // Unbekannter Nutzer oder Konto ohne Passwort (z. B. SSO) → false.
  async verifyUserPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user || !user.passwordHash) {
      return false;
    }
    return verifyPassword(password, user.passwordSalt, user.passwordHash);
  }

  // FR-AUTH-02 / FR-RBAC-02: Admin gibt Konto frei.
  async approveUser(userId: string, actorId: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    user.approved = true;
    await this.users.update(user);
    await this.record(actorId, "user.approve", userId);
    return toPublic(user);
  }

  // FR-RBAC-02 / FR-RBAC-03 + SCRUM-443: Rolle ändern — jetzt serverseitig geprüft.
  async changeRole(userId: string, role: Role, actorId: string): Promise<PublicUser> {
    const actor = await this.requireUser(actorId);
    // FR-RBAC-03: injizierte Regel durchsetzen (u. a. kein Selbst-Entzug der Admin-Rolle).
    if (!this.canChangeRolePolicy({ id: actor.id, role: actor.role }, userId, role)) {
      throw new AuthError(
        "FORBIDDEN",
        "Rollenänderung nicht erlaubt: Ein Admin kann sich die Admin-Rolle nicht selbst entziehen.",
      );
    }
    const user = await this.requireUser(userId);
    // SCRUM-443 (Last-Admin-Schutz): der letzte aktive Admin darf nicht herabgestuft werden —
    // sonst gäbe es niemanden mehr mit Verwaltungsrecht (System ausgesperrt).
    if (user.role === "admin" && role !== "admin" && (await this.isLastApprovedAdmin(userId))) {
      throw new AuthError(
        "FORBIDDEN",
        "Der letzte aktive Admin kann nicht herabgestuft werden — sonst wäre niemand mehr verwaltungsberechtigt.",
      );
    }
    user.role = role;
    await this.users.update(user);
    await this.record(actorId, "user.role-change", userId, { role });
    return toPublic(user);
  }

  // FR-AUTH-06: Admin-Passwort-Reset; bestehende Sitzungen des Nutzers werden ungültig.
  async resetPassword(userId: string, newPassword: string, actorId: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const user = await this.requireUser(userId);
    const { salt, hash } = await hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(userId);
    await this.record(actorId, "user.password-reset", userId);
  }

  // Self-Service: angemeldeter Nutzer ändert sein eigenes Passwort (altes Passwort nötig).
  // Andere Sitzungen werden ungültig; die aktuelle bleibt erhalten (Caller setzt sie neu, falls nötig).
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const user = await this.requireUser(userId);
    if (!(await verifyPassword(oldPassword, user.passwordSalt, user.passwordHash))) {
      throw new AuthError("INVALID_CREDENTIALS", "Aktuelles Passwort ist falsch.");
    }
    const { salt, hash } = await hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(userId);
    await this.record(userId, "user.password-changed", userId);
  }

  // FR-AUTH-08: Reset anfordern — erzeugt einen kurzlebigen Token. Unbekannte E-Mail → undefined
  // (Existenz wird nicht verraten). Der Versand der E-Mail erfolgt in der Route über den Mailer.
  async requestPasswordReset(
    email: string,
  ): Promise<{ token: string; user: PublicUser } | undefined> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return undefined;
    }
    const token = this.genToken();
    // Auch Reset-Tokens nur als Hash at rest — der Klartext lebt allein im Mail-Link.
    await this.resetTokens.create({
      token: hashTokenAtRest(token),
      userId: user.id,
      expiresAt: this.now() + RESET_TTL_MS,
    });
    return { token, user: toPublic(user) };
  }

  // FR-AUTH-08: Reset einlösen — Token muss gültig (nicht abgelaufen) sein.
  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const stored = hashTokenAtRest(token);
    // WP-VIP2-GATE-2 (bens Fix 2): Dual-Read auch fuer Reset-Tokens — erst der Hash, bei Miss
    // (und nur ohne sha256:-Praefix im Client-Wert) der Alt-Lookup ueber den Klartext-Schluessel
    // mit sofortigem In-Place-Rehashing. AUSLAUF: nach der VIP2-Phase entfernbar (s.
    // findSessionDualRead — dieselbe Uebergangs-Begruendung).
    let entry = await this.resetTokens.find(stored);
    if (!entry && !token.startsWith(TOKEN_HASH_PREFIX)) {
      const legacy = await this.resetTokens.find(token);
      if (legacy) {
        await this.resetTokens.delete(token);
        entry = { ...legacy, token: stored };
        await this.resetTokens.create(entry);
      }
    }
    if (!entry || entry.expiresAt <= this.now()) {
      if (entry) {
        await this.resetTokens.delete(stored); // abgelaufen → beim Zugriff aufraeumen
      }
      throw new AuthError("INVALID_CREDENTIALS", "Reset-Token ungültig oder abgelaufen.");
    }
    const user = await this.requireUser(entry.userId);
    const { salt, hash } = await hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(user.id);
    await this.resetTokens.delete(stored);
    await this.record(user.id, "user.password-reset-email", user.id);
  }

  // FR-RBAC-02 + SCRUM-443: Admin löscht Nutzer; Sitzungen verfallen. Der letzte aktive Admin
  // ist geschützt (kein Selbst-Aussperren des Systems).
  async deleteUser(userId: string, actorId: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (user.role === "admin" && user.approved && (await this.isLastApprovedAdmin(userId))) {
      throw new AuthError(
        "FORBIDDEN",
        "Der letzte aktive Admin kann nicht gelöscht werden — sonst wäre niemand mehr verwaltungsberechtigt.",
      );
    }
    await this.users.delete(userId);
    await this.sessions.deleteByUser(userId);
    await this.record(actorId, "user.delete", userId);
  }

  // SCRUM-443: Ist dieser Nutzer der letzte freigegebene Admin? (Grundlage des Last-Admin-Schutzes.)
  private async isLastApprovedAdmin(userId: string): Promise<boolean> {
    const users = await this.users.list();
    const approvedAdmins = users.filter((u) => u.role === "admin" && u.approved);
    return approvedAdmins.length <= 1 && approvedAdmins.some((u) => u.id === userId);
  }

  // FR-RBAC-02: Audit-Eintrag je Admin-Aktion (sofern Audit verdrahtet).
  // AUFTRAG-mega62 Block B: `tx` optional und durchgereicht — nur acknowledgeNotice setzt ihn, alle
  // übrigen Aufrufer rufen unverändert ohne. Ohne Audit-Verdrahtung passiert wie bisher nichts.
  private async record(
    actor: string,
    action: string,
    target: string,
    payload?: Record<string, unknown>,
    tx?: TxContext,
  ): Promise<void> {
    if (this.audit) {
      await this.audit.record(
        payload ? { actor, action, target, payload } : { actor, action, target },
        tx,
      );
    }
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AuthError("NOT_FOUND", "Nutzer nicht gefunden.");
    }
    return user;
  }
}
