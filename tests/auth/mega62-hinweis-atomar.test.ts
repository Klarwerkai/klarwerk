// ================================================================================================
// AUFTRAG-mega62 BLOCK B — DER VERMERK UND SEIN NACHWEIS SIND EINE EINHEIT.
// ================================================================================================
//
// mega61 belegte NUR den Erfolgsweg (tests/auth/mega61-hinweis-vermerk.test.ts): Quittieren, lesen,
// Protokollzeile da. Der Fehlerfall war ungeprüft — und genau dort lag das Loch: `acknowledgeNotice`
// schrieb erst das Konto, danach das Prüfprotokoll, beide ohne gemeinsamen Kontext. Scheiterte das
// Protokollieren, antwortete die Route mit Fehler, der Konto-Vermerk war aber schon geschrieben:
// Der Banner war beim nächsten Laden weg, und der Satz „die Kenntnisnahme steht im Prüfprotokoll"
// war unwahr. Ein Nachweis, der lautlos zur Hälfte entsteht, ist als Nachweis wertlos.
//
// GEPRÜFT WIRD DESHALB DER FEHLERFALL, IN BEIDEN AUSBAUSTUFEN:
//
//   B1  OHNE Transaktion (InMemory, Dev-Journal): das Protokoll wird ZUERST geschrieben. Scheitert
//       es, ist am Konto NICHTS vermerkt — der Hinweis erscheint erneut. Das ist der halbe Zustand,
//       der erträglich ist; der andere ist ausgeschlossen.
//   B2  Die Gegenrichtung: scheitert das Kontoschreiben, entsteht KEIN Konto-Vermerk (der
//       Protokolleintrag darf stehen — eine Zeile zu viel ist wahr, ein fehlender Nachweis nicht).
//   B3  MIT Transaktion (echter Pg-Pool): beide Schreiber bekommen DENSELBEN opaken Kontext und
//       laufen INNERHALB von `withTx`. Was `withPgTx` daraus macht — BEGIN/COMMIT/ROLLBACK —, ist
//       der Vertrag von services/db-tx und dort belegt; hier wird belegt, dass dieser Dienst ihn
//       wirklich benutzt und nicht daran vorbeischreibt.
//   B4  Ein Fehler im Rumpf verlässt `withTx` und wird nicht geschluckt — sonst käme die Route mit
//       200 zurück, während gar nichts geschrieben wurde.
//
// KALIBRIERUNG: Jeder Fehlerfall steht neben seinem Erfolgsfall. Ein Test, der nur „nichts
// geschrieben" prüft, wäre auch dann grün, wenn dieser Dienst überhaupt nichts mehr schriebe.
import { describe, expect, it } from "vitest";
import { type AuditEntry, AuditService } from "../../services/audit";
import type { AuditRepo } from "../../services/audit/src/repo";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { AuthService } from "../../services/auth/src/service";
import type { User } from "../../services/auth/src/types";
import type { TxContext } from "../../services/db-tx";

const FASSUNG = "2026-07-30.1";

function konto(): User {
  return {
    id: "u1",
    name: "Nutzerin",
    email: "n@x.de",
    passwordSalt: "s",
    passwordHash: "h",
    role: "experte",
    approved: true,
    createdAt: new Date(0).toISOString(),
  };
}

/** Ein Prüfprotokoll-Speicher, dessen Schreiben man gezielt scheitern lassen kann. */
class SteuerbaresAuditRepo implements AuditRepo {
  readonly zeilen: AuditEntry[] = [];
  scheitert = false;

  append(entry: AuditEntry): Promise<void> {
    if (this.scheitert) {
      return Promise.reject(new Error("Prüfprotokoll nicht erreichbar"));
    }
    this.zeilen.push(entry);
    return Promise.resolve();
  }

  appendOnce(entry: AuditEntry): Promise<boolean> {
    this.zeilen.push(entry);
    return Promise.resolve(true);
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.zeilen]);
  }

  last(): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.zeilen[this.zeilen.length - 1]);
  }
}

/** Ein Konto-Speicher, dessen `update` man gezielt scheitern lassen kann. */
class SteuerbaresUserRepo extends InMemoryUserRepo {
  scheitert = false;

  override update(user: User, tx?: TxContext): Promise<void> {
    if (this.scheitert) {
      return Promise.reject(new Error("Konto nicht schreibbar"));
    }
    return super.update(user, tx);
  }
}

async function aufbauen(): Promise<{
  users: SteuerbaresUserRepo;
  auditRepo: SteuerbaresAuditRepo;
  auth: AuthService;
}> {
  const users = new SteuerbaresUserRepo();
  await users.insert(konto());
  const auditRepo = new SteuerbaresAuditRepo();
  const auth = new AuthService({
    users,
    sessions: new InMemorySessionRepo(),
    audit: new AuditService({ repo: auditRepo }),
  });
  return { users, auditRepo, auth };
}

async function kontoVermerk(users: SteuerbaresUserRepo): Promise<User | undefined> {
  return (await users.list()).find((u) => u.id === "u1");
}

describe("mega62 B · ohne Transaktion trägt die Schreibreihenfolge", () => {
  it("KALIBRIERUNG · Erfolgsweg: Konto-Vermerk UND Protokollzeile", async () => {
    const { users, auditRepo, auth } = await aufbauen();
    await auth.acknowledgeNotice("u1", FASSUNG);
    expect((await kontoVermerk(users))?.noticeAckVersion).toBe(FASSUNG);
    expect(auditRepo.zeilen.map((z) => z.action)).toContain("notice.acknowledged");
  });

  it("B1 · scheitert das Protokollieren, ist am Konto NICHTS vermerkt", async () => {
    const { users, auditRepo, auth } = await aufbauen();
    auditRepo.scheitert = true;

    await expect(auth.acknowledgeNotice("u1", FASSUNG)).rejects.toThrow(
      /Prüfprotokoll nicht erreichbar/,
    );

    // DAS IST DIE ZUSAGE: kein Vermerk ohne Nachweis. Der Hinweis erscheint beim nächsten Laden
    // erneut — unschön, aber wahr. Der umgekehrte Zustand (Banner weg, kein Nachweis) wäre die
    // Halbwahrheit, gegen die dieser Block gebaut ist.
    const nachher = await kontoVermerk(users);
    expect(nachher?.noticeAckAt).toBeUndefined();
    expect(nachher?.noticeAckVersion).toBeUndefined();
    expect(auditRepo.zeilen).toHaveLength(0);
  });

  it("B2 · scheitert das Kontoschreiben, entsteht ebenfalls KEIN Konto-Vermerk", async () => {
    const { users, auditRepo, auth } = await aufbauen();
    users.scheitert = true;

    await expect(auth.acknowledgeNotice("u1", FASSUNG)).rejects.toThrow(/Konto nicht schreibbar/);

    const nachher = await kontoVermerk(users);
    expect(nachher?.noticeAckAt).toBeUndefined();
    // Die Protokollzeile darf hier stehen bleiben (ohne Transaktion gibt es nichts, was sie
    // zurücknähme). Sie ist eine Zeile zu viel — und eine Zeile zu viel ist wahr, ein fehlender
    // Nachweis nicht. Genau diese Richtung schließt die echte Transaktion unten zusätzlich.
    expect(auditRepo.zeilen.map((z) => z.action)).toContain("notice.acknowledged");
  });
});

describe("mega62 B · mit Transaktion committen beide gemeinsam", () => {
  it("B3 · beide Schreiber laufen INNERHALB von withTx und teilen DENSELBEN Kontext", async () => {
    const auditRepo = new SteuerbaresAuditRepo();

    const gesehen: Array<TxContext | undefined> = [];
    let offen = false;
    let geoeffnet = 0;
    const marke = { brand: "TxContext" } as TxContext;

    // Ein Beobachter des ECHTEN Vertrags, nicht sein Nachbau: er merkt sich, ob der Rumpf noch
    // läuft (`offen`), und welchen Kontext die beiden Schreiber gesehen haben.
    const withTx = async <T>(fn: (tx: TxContext) => Promise<T>): Promise<T> => {
      geoeffnet += 1;
      offen = true;
      try {
        return await fn(marke);
      } finally {
        offen = false;
      }
    };

    class BeobachteterUserRepo extends SteuerbaresUserRepo {
      override update(user: User, tx?: TxContext): Promise<void> {
        gesehen.push(tx);
        expect(offen, "das Kontoschreiben läuft innerhalb der Transaktion").toBe(true);
        return super.update(user, tx);
      }
    }
    const beobachtet = new BeobachteterUserRepo();
    await beobachtet.insert(konto());

    const auth = new AuthService({
      users: beobachtet,
      sessions: new InMemorySessionRepo(),
      audit: new AuditService({
        repo: {
          append: (entry: AuditEntry, tx?: TxContext) => {
            gesehen.push(tx);
            expect(offen, "das Protokollieren läuft innerhalb der Transaktion").toBe(true);
            return auditRepo.append(entry);
          },
          appendOnce: (entry: AuditEntry) => auditRepo.appendOnce(entry),
          all: () => auditRepo.all(),
          last: () => auditRepo.last(),
        },
      }),
      withTx,
    });

    await auth.acknowledgeNotice("u1", FASSUNG);

    expect(geoeffnet, "genau EINE Transaktion, nicht zwei").toBe(1);
    expect(gesehen).toHaveLength(2);
    // Derselbe Kontext heißt bei withPgTx: derselbe Pg-Client, also wirklich EINE Transaktion.
    expect(gesehen[0]).toBe(marke);
    expect(gesehen[1]).toBe(marke);
    // Und der Erfolg ist echt: der Vermerk steht am Konto, die Protokollzeile im Bestand.
    expect((await kontoVermerk(beobachtet))?.noticeAckVersion).toBe(FASSUNG);
    expect(auditRepo.zeilen.map((z) => z.action)).toContain("notice.acknowledged");
  });

  it("B4 · ein Fehler im Rumpf verlässt withTx — die Route erfährt ihn", async () => {
    const users = new SteuerbaresUserRepo();
    await users.insert(konto());
    const auditRepo = new SteuerbaresAuditRepo();
    auditRepo.scheitert = true;

    let zurueckgerollt = false;
    const withTx = async <T>(fn: (tx: TxContext) => Promise<T>): Promise<T> => {
      try {
        return await fn({ brand: "TxContext" } as TxContext);
      } catch (fehler) {
        // Das ist, was withPgTx an dieser Stelle tut (ROLLBACK + weiterwerfen, s. db-tx/src/tx.ts).
        zurueckgerollt = true;
        throw fehler;
      }
    };

    const auth = new AuthService({
      users,
      sessions: new InMemorySessionRepo(),
      audit: new AuditService({ repo: auditRepo }),
      withTx,
    });

    await expect(auth.acknowledgeNotice("u1", FASSUNG)).rejects.toThrow(
      /Prüfprotokoll nicht erreichbar/,
    );
    expect(zurueckgerollt, "der Fehler erreicht die Transaktionsklammer").toBe(true);
    expect((await kontoVermerk(users))?.noticeAckAt).toBeUndefined();
  });
});
