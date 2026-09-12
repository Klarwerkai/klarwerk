// ================================================================================================
// JOB 3784 — DER GEMEINSAME AUFBAU DER NEBENLÄUFIGKEITS-FÄLLE
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, ist nicht „eine Transaktion ist eingebaut", sondern: es gibt keinen
// Ablauf mehr, nach dem null unbefristete, freigegebene Admins übrig bleiben, obwohl vorher einer
// da war. Der Aussperrschutz las bis JOB 3784 die Kontoliste und schrieb danach — zwischen beiden
// Schritten liegt eine `await`-Grenze, an der die Ereignisschleife eine zweite Anfrage bedient.
// Zwei Admins, die im selben Moment je einen anderen Admin herabstufen, kamen deshalb beide durch.
//
// ------------------------------------------------------------------------------------------------
// WIE MAN EIN I/O-FENSTER OHNE ECHTES I/O AUFSTELLT
// ------------------------------------------------------------------------------------------------
// Der `Treffpunkt` hält die LESUNG des Aussperrschutzes an, bis beide Aufrufer gelesen haben. Damit
// steht das Fenster fest und deterministisch offen — kein `setTimeout`-Glück, keine Testcontainer.
//
// UND ER MUSS EINEN NOTAUSGANG HABEN. Nach der Änderung kann der zweite Aufrufer die Lesung gar
// nicht mehr erreichen: er wartet vor der Sperre. Ein Treffpunkt, der nur bei zwei Ankünften
// öffnet, würde dann für immer zuhalten und der Testlauf liefe in die Zeitgrenze statt eine Aussage
// zu treffen. Die Fälle lassen die Ereignisschleife deshalb erst leerlaufen (`stillstand`) und
// öffnen den Treffpunkt danach von Hand. Wie viele bis dahin angekommen sind, IST die Messung:
// zwei heisst „ungeschützt", einer heisst „die Sperre hält".
//
// EINMAL GEÖFFNET, BLEIBT OFFEN. Sonst hinge die abschliessende Bestandsaufnahme (`listUsers`, die
// ebenfalls über `list()` geht) an derselben Schranke wie der Vorgang, den sie nachzählen soll.
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { AuthService } from "../../services/auth/src/service";
import type { User } from "../../services/auth/src/types";
import type { TxContext } from "../../services/db-tx";

/** Ein fester Startpunkt statt `Date.now()`: derselbe Lauf ergibt dieselben Zeitstempel. */
export const START = Date.parse("2026-09-12T12:00:00.000Z");
export const STUNDE = 60 * 60 * 1000;

/** Eine gültige Befristung in der Zukunft — lesbar, also zählt sie als „befristet". */
export const SPAETER = new Date(START + 48 * STUNDE).toISOString();

export class Treffpunkt {
  /** Wie viele Aufrufer die Lesung des Aussperrschutzes tatsächlich erreicht haben. */
  angekommen = 0;
  private offen = false;
  private readonly wartende: (() => void)[] = [];

  constructor(private readonly erwartet: number) {}

  betreten(): Promise<void> {
    this.angekommen += 1;
    if (this.offen || this.angekommen >= this.erwartet) {
      this.freigeben();
      return Promise.resolve();
    }
    return new Promise<void>((aufloesen) => {
      this.wartende.push(aufloesen);
    });
  }

  /** Der Notausgang (s. Kopf): danach hält der Treffpunkt niemanden mehr an. */
  freigeben(): void {
    this.offen = true;
    for (const wartender of this.wartende.splice(0)) {
      wartender();
    }
  }
}

/**
 * Ein Kontospeicher, der die Lesung des Aussperrschutzes anhält — VOR der Änderung `list()`, nach
 * ihr `listAdminsForGuard()`. Beide Wege laufen über denselben Treffpunkt, damit derselbe Fall am
 * unveränderten und am geänderten Produkt dasselbe Fenster aufstellt.
 */
export class AnhaltendesUserRepo extends InMemoryUserRepo {
  constructor(readonly treffpunkt: Treffpunkt) {
    super();
  }

  override async list(): Promise<User[]> {
    const ergebnis = await super.list();
    await this.treffpunkt.betreten();
    return ergebnis;
  }

  override async listAdminsForGuard(tx?: TxContext): Promise<User[]> {
    const ergebnis = await super.listAdminsForGuard(tx);
    await this.treffpunkt.betreten();
    return ergebnis;
  }
}

/** Lässt die Ereignisschleife leerlaufen: alles, was ohne echtes I/O laufen kann, ist danach fertig. */
export async function stillstand(runden = 5): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await new Promise<void>((aufloesen) => {
      setTimeout(aufloesen, 0);
    });
  }
}

/**
 * Ein Vorgang mit Frist. Eine Sperre, die nach einer Ablehnung nicht mehr aufgeht, würde sonst als
 * 60-Sekunden-Zeitgrenze des Testlaufs erscheinen statt als Aussage über das Produkt.
 */
export function mitFrist<T>(vorgang: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    vorgang,
    new Promise<T>((_, ablehnen) => {
      const uhr = setTimeout(() => ablehnen(new Error(`Sperre blieb ${ms} ms zu`)), ms);
      void vorgang.catch(() => undefined).finally(() => clearTimeout(uhr));
    }),
  ]);
}

export interface Kreis {
  users: InMemoryUserRepo;
  sessions: InMemorySessionRepo;
  audit: AuditService;
  service: AuthService;
}

export function baueKreis(users: InMemoryUserRepo = new InMemoryUserRepo()): Kreis {
  const sessions = new InMemorySessionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => START });
  const service = new AuthService({ users, sessions, audit, now: () => START });
  return { users, sessions, audit, service };
}

/**
 * Die Konten werden DIREKT eingelegt, nicht über `register`/`approveUser`/`changeRole`.
 *
 * Der Aufbau darf nicht von denselben drei Türen abhängen, die geprüft werden — sonst prüfte der
 * Fall nur noch, was der Aufbau durchgelassen hat, und ein Fehler in der Tür würde die Vorbedingung
 * mit umbauen.
 */
export function konto(id: string, ueberschreibt: Partial<User> = {}): User {
  return {
    id,
    name: id,
    email: `${id}@x.de`,
    passwordSalt: "salz",
    passwordHash: "hash",
    role: "admin",
    approved: true,
    createdAt: new Date(START).toISOString(),
    ...ueberschreibt,
  };
}

export interface Bestand {
  /** Zwei unbefristete, freigegebene Admins — zusammen die letzte Verwaltung der Instanz. */
  a: User;
  b: User;
  /** Der Handelnde: Admin, aber BEFRISTET — er deckt die Zählung nicht (JOB 3665 R3). */
  h: User;
  /** Ein Konto ohne Verwaltungsrecht, an dem zulässige Vorgänge gemessen werden. */
  gast: User;
}

/**
 * Der Ausgangsstand aller Fälle: genau ZWEI unbefristete, freigegebene Admins.
 *
 * Zwei und nicht drei, und das ist der Kern: bei zwei ist jeder EINZELNE Schritt erlaubt (es bleibt
 * ja einer übrig) und der ZWEITE danach verboten. Genau dieses Paar trennt sequenzielle Arbeit
 * (sicher) von gleichzeitiger (bis JOB 3784 unsicher).
 */
export async function legeBestandAn(k: Kreis): Promise<Bestand> {
  const bestand: Bestand = {
    a: konto("a"),
    b: konto("b"),
    h: konto("h", { accessExpiresAt: SPAETER }),
    gast: konto("gast", { role: "experte" }),
  };
  for (const eintrag of Object.values(bestand)) {
    await k.users.insert({ ...eintrag });
  }
  return bestand;
}

/** Wer zählt für den Aussperrschutz: freigegeben, Admin und ohne jedes Ende. */
export function unbefristeteAdmins(
  alle: readonly { role: string; approved: boolean; accessExpiresAt?: string }[],
) {
  return alle.filter((u) => u.role === "admin" && u.approved && u.accessExpiresAt === undefined);
}
