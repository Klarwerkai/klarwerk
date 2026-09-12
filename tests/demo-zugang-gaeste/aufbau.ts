// ================================================================================================
// JOB 3665 T1 — DER GEMEINSAME AUFBAU DER DREI PRÜFDATEIEN
// ================================================================================================
//
// Drei Dateien prüfen denselben Kern von drei Seiten: die Anmeldung (`ablauf-sperrt-anmeldung`),
// die schon ausgestellte Sitzung (`ablauf-sperrt-sitzung`) und das Setzen der Befristung
// (`ablauf-setzen`). Sie teilen sich deshalb GENAU EINEN Aufbau — läge er dreimal da, könnte eine
// Datei später still gegen eine andere Uhr oder ein anderes Prüfprotokoll messen, und zwei
// Aussagen über dasselbe Verhalten wären nicht mehr vergleichbar.
//
// DIE UHR IST INJIZIERT UND NICHT ECHT. `AuthService` liest die Zeit ausschließlich über
// `deps.now` (services/auth/src/service.ts). Ein Test, der `Date.now()` abwarten müsste, könnte
// „abgelaufen" nur mit echtem Warten belegen — und ein Grenzfall („exakt jetzt") wäre gar nicht
// ansteuerbar. Das Prüfprotokoll bekommt DIESELBE Uhr: sonst trügen seine Einträge eine andere
// Zeit als der Vorgang, den sie belegen.
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  type OidcClaims,
  type PublicUser,
  type Session,
  type SessionRepo,
  type UserRepo,
} from "../../services/auth";

/** Ein fester Startpunkt statt `Date.now()`: derselbe Lauf ergibt dieselben Zeitstempel. */
export const START = Date.parse("2026-09-11T12:00:00.000Z");
export const STUNDE = 60 * 60 * 1000;

export interface Kreis {
  /**
   * JOB 3665 R3: ebenfalls als Vertrag getypt — so kann ein Fall den ECHTEN `PgUserRepo` einsetzen
   * und den Weg von der Datenbankzeile bis zur Anmeldung durchgehend fahren (D5), statt Abbildung
   * und Dienst getrennt zu prüfen und die Lücke dazwischen anzunehmen.
   */
  users: UserRepo;
  /**
   * JOB 3665 R2: als Vertrag getypt, nicht als Speicherfassung — so kann ein Fall eine störende
   * Ablage einsetzen (s. `StoerendeSitzungsablage`), ohne dass ein zweiter Aufbau danebensteht.
   */
  sessions: SessionRepo;
  audit: AuditService;
  service: AuthService;
  jetzt: () => number;
  /** Stellt die eine Uhr vor, die Dienst UND Prüfprotokoll lesen. */
  vorstellen: (ms: number) => void;
}

export function baueKreis(ablagen: { sessions?: SessionRepo; users?: UserRepo } = {}): Kreis {
  let uhr = START;
  const users = ablagen.users ?? new InMemoryUserRepo();
  const sessions = ablagen.sessions ?? new InMemorySessionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => uhr });
  const service = new AuthService({ users, sessions, audit, now: () => uhr });
  return {
    users,
    sessions,
    audit,
    service,
    jetzt: () => uhr,
    vorstellen: (ms) => {
      uhr += ms;
    },
  };
}

export const GAST_PASSWORT = "secret123";

/**
 * Admin (erstes Konto der leeren Instanz, damit `isLastApprovedAdmin` einen Träger hat) und ein
 * freigegebener Gast mit Passwort. Bewusst ZWEI Konten: ein Gast, der zugleich der letzte Admin
 * wäre, träfe den Aussperrschutz und würde jede Aussage über den Ablauf überdecken.
 */
export async function adminUndGast(k: Kreis): Promise<{ admin: PublicUser; gast: PublicUser }> {
  const admin = await k.service.register({
    name: "Admin",
    email: "admin@x.de",
    password: GAST_PASSWORT,
  });
  const gast = await k.service.register({
    name: "Gast",
    email: "gast@x.de",
    password: GAST_PASSWORT,
  });
  await k.service.approveUser(gast.id, admin.id);
  return { admin, gast };
}

/**
 * Schreibt die Befristung DIREKT an das Konto, am Dienst vorbei.
 *
 * Warum nicht über `setAccessExpiry`: Fall A5 braucht einen UNLESBAREN Wert in der Datenhaltung,
 * und genau den lässt der Dienst nicht hinein (Lieferung 6). Käme die Vorbedingung über den
 * Dienst, prüften die Sperr-Fälle nur noch, was der Setzer durchgelassen hat — und der kaputte
 * Bestand, gegen den Lieferung 3 gebaut ist, wäre nie herstellbar.
 */
export async function befriste(k: Kreis, userId: string, wert: string): Promise<void> {
  const konto = await k.users.findById(userId);
  if (!konto) {
    throw new Error(
      `Konto ${userId} ist nicht angelegt — der Aufbau ist kaputt, nicht das Produkt.`,
    );
  }
  await k.users.update({ ...konto, accessExpiresAt: wert });
}

/** Die SSO-Behauptungen eines Anbieters, in der Form, die `loginWithOidc` erwartet. */
export function gastClaims(): OidcClaims {
  return {
    sub: "gast-subjekt",
    email: "gast@x.de",
    name: "Gast",
    roles: [],
    iss: "https://idp.example.com",
    rolesClaimPresent: false,
  };
}

/** Wie oft steht dieser Vorgang für dieses Konto im Prüfprotokoll? */
export async function vorgaenge(k: Kreis, action: string, target: string): Promise<number> {
  return (await k.audit.list({ action, target })).length;
}

/**
 * JOB 3665 R2: Zwei Admins, von denen einer eine Befristung trägt.
 *
 * DAS IST DAS SZENARIO, AN DEM DER AUSSPERRSCHUTZ IN RUNDE 1 SCHEITERTE. Solange der erste Admin
 * nur „irgendwie vorhanden" gezählt wurde, galt der zweite nicht als der letzte — und durfte
 * befristet werden, obwohl danach niemand mehr hereingekommen wäre.
 */
export async function zweiAdmins(
  k: Kreis,
): Promise<{ ersterAdmin: PublicUser; zweiterAdmin: PublicUser }> {
  const ersterAdmin = await k.service.register({
    name: "Admin eins",
    email: "admin1@x.de",
    password: GAST_PASSWORT,
  });
  const zweiterAdmin = await k.service.register({
    name: "Admin zwei",
    email: "admin2@x.de",
    password: GAST_PASSWORT,
  });
  await k.service.approveUser(zweiterAdmin.id, ersterAdmin.id);
  await k.service.changeRole(zweiterAdmin.id, "admin", ersterAdmin.id);
  return { ersterAdmin, zweiterAdmin };
}

/**
 * JOB 3665 R2: Eine Sitzungsablage, deren `deleteByUser` die ersten `fehlschlaege` Aufrufe wirft.
 *
 * Damit wird die Zusage prüfbar, die Runde 1 nur BEHAUPTET hat: Scheitert das Beenden der
 * Sitzungen, schlägt der ganze Vorgang fehl — und der nächste Versuch holt es nach, ohne einen
 * zweiten Eintrag ins Prüfprotokoll zu schreiben. Eine konstruktiv begründete Selbstheilung ohne
 * Test ist kein Nachweis, sondern eine Hoffnung.
 */
export class StoerendeSitzungsablage implements SessionRepo {
  private readonly echt = new InMemorySessionRepo();
  private restFehlschlaege: number;
  loeschversuche = 0;

  constructor(fehlschlaege: number) {
    this.restFehlschlaege = fehlschlaege;
  }

  create(session: Session): Promise<void> {
    return this.echt.create(session);
  }

  find(token: string): Promise<Session | undefined> {
    return this.echt.find(token);
  }

  delete(token: string): Promise<void> {
    return this.echt.delete(token);
  }

  deleteByUser(userId: string): Promise<void> {
    this.loeschversuche += 1;
    if (this.restFehlschlaege > 0) {
      this.restFehlschlaege -= 1;
      return Promise.reject(new Error("Sitzungsablage nicht erreichbar."));
    }
    return this.echt.deleteByUser(userId);
  }
}
