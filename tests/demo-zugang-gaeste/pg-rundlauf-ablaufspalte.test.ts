// ================================================================================================
// JOB 3665 R2 · D — NULL UND LEERER STRING SIND NICHT DASSELBE, UND DIE SPALTE MUSS DAS TRAGEN
// ================================================================================================
//
// DER BEFUND AUS RUNDE 1. Die Zeilenabbildung schrieb `row.access_expires_at ? … : {}` — eine
// Prüfung auf Wahrheitswert. Damit fiel ein leerer String in dieselbe Kerbe wie NULL, und ein
// vorhandener, aber kaputter Wert VERSCHWAND lautlos auf dem Weg aus der Datenbank. Ausgerechnet
// die Diagnose, die ihn finden soll (`user.access-expiry-unreadable`), lief dann nie.
//
// Die beiden Zustände bedeuten Verschiedenes, und der Dienst behandelt sie verschieden:
//
//     NULL  ⇒ Feld fehlt ⇒ „nie befristet"  ⇒ Anmeldung normal, kein Vermerk
//     ""    ⇒ Feld da    ⇒ unlesbarer Wert  ⇒ Anmeldung normal, ABER Vermerk im Prüfprotokoll
//
// AUSDRÜCKLICHE REICHWEITENGRENZE, und sie ist dieselbe wie in
// `tests/auth/job2413-nutzlast-user-update.test.ts`: Geprüft wird, WAS `PgUserRepo` sendet und WIE
// es eine gelieferte Zeile abbildet — mit einem Pool-Doppel. **Was PostgreSQL daraus macht, ist
// hier NICHT gemessen** und bleibt bis zu einem echten Integrationslauf eine unbewiesene
// Hypothese. Der Weg von der abgebildeten Zeile bis zur Wirkung am Menschen (Anmeldung, Vermerk)
// ist dagegen echt gefahren — über den Dienst, Fall D3.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgUserRepo } from "../../services/auth";
// Tief importiert und nicht über `index.ts`: D5 braucht ein Passwort, das `login` wirklich prüfen
// kann. Ein selbst erfundenes Salz-Hash-Paar würde die Anmeldung scheitern lassen, und der Fall
// bewiese dann nur, dass falsche Passwörter abgewiesen werden.
import { hashPassword } from "../../services/auth/src/password";
import { GAST_PASSWORT, adminUndGast, baueKreis, befriste, vorgaenge } from "./aufbau";

interface Anweisung {
  text: string;
  params: readonly unknown[];
}

/** Ein Pool-Doppel, das schreibt mit und liest eine vorgegebene Zeile zurück. */
function poolDoppel(zeilen: readonly Record<string, unknown>[]): {
  pool: Pool;
  anweisungen: Anweisung[];
} {
  const anweisungen: Anweisung[] = [];
  const query = async (text: string, params?: readonly unknown[]) => {
    anweisungen.push({ text, params: params ?? [] });
    return { rows: /^\s*SELECT/i.test(text) ? zeilen : [], rowCount: 1 };
  };
  return { pool: { query } as unknown as Pool, anweisungen };
}

const GRUNDZEILE = {
  id: "WERT-ID",
  name: "WERT-NAME",
  email: "WERT-EMAIL",
  password_salt: "WERT-SALZ",
  password_hash: "WERT-HASH",
  role: "experte",
  approved: true,
  created_at: "2026-01-01T00:00:00.000Z",
  notice_ack_at: null,
  notice_ack_version: null,
  oidc_issuer: null,
  oidc_subject: null,
};

describe("JOB 3665 D · die Ablaufspalte zwischen Datenbank und Dienst", () => {
  it("D1 — NULL ergibt ein fehlendes Feld, nicht `null` und nicht einen leeren String", async () => {
    const { pool } = poolDoppel([{ ...GRUNDZEILE, access_expires_at: null }]);

    const konto = await new PgUserRepo(pool).findById("WERT-ID");

    expect(konto).toBeDefined();
    expect(konto?.accessExpiresAt).toBeUndefined();
    // Nicht bloß „ist undefiniert": der Schlüssel darf gar nicht erst da sein, sonst gäbe es ein
    // drittes „ausdrücklich leer", das nur die Datenhaltung kennt.
    expect(Object.hasOwn(konto ?? {}, "accessExpiresAt")).toBe(false);
  });

  it("D1b — eine Bestandsinstanz OHNE die Spalte wird wie NULL gelesen", async () => {
    // Die Migration ist additiv; zwischen Start und `ALTER TABLE` kann eine Zeile die Spalte noch
    // gar nicht führen. Eine fehlende Spalte darf keinen Zugang sperren.
    const { pool } = poolDoppel([{ ...GRUNDZEILE }]);

    const konto = await new PgUserRepo(pool).findById("WERT-ID");

    expect(Object.hasOwn(konto ?? {}, "accessExpiresAt")).toBe(false);
  });

  it("D2 — ein leerer String überlebt den Lesepfad als vorhandener, unlesbarer Wert", async () => {
    const { pool } = poolDoppel([{ ...GRUNDZEILE, access_expires_at: "" }]);

    const konto = await new PgUserRepo(pool).findById("WERT-ID");

    expect(Object.hasOwn(konto ?? {}, "accessExpiresAt")).toBe(true);
    expect(konto?.accessExpiresAt).toBe("");
  });

  it("D3 — und am Dienst wirkt er richtig: Anmeldung gelingt, der Vermerk steht", async () => {
    // Der zweite Halbsatz ist der eigentliche Punkt. Ein leerer Wert darf niemanden aussperren —
    // aber er darf auch nicht schweigend verschwinden, sonst sucht ihn nie jemand.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, "");

    const angemeldet = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });
    expect(angemeldet.token).toBeTruthy();

    const vermerke = await k.audit.list({
      action: "user.access-expiry-unreadable",
      target: gast.id,
    });
    expect(vermerke).toHaveLength(1);
    expect(vermerke[0]?.payload).toMatchObject({ accessExpiresAt: "" });
    // Und er sperrt auch nicht über die Hintertür: kein Ablauf-Vorgang, keine beendete Sitzung.
    expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(0);
    expect(await k.service.authenticate(angemeldet.token)).toBeDefined();
  });

  it("D5 — durchgehend: der von PgUserRepo GELESENE Wert trägt bis zur Anmeldung und zur Diagnose", async () => {
    // JOB 3665 R3 (BENs Prüflücke aus Runde 2): D2 und D3 prüften Abbildung und Dienst GETRENNT —
    // D3 setzte den leeren Wert in den Speicherbestand statt ihn aus der Datenbankzeile zu
    // beziehen. Zwischen beiden lag eine angenommene Verbindung, und angenommene Verbindungen sind
    // genau die Stellen, an denen dieses Produkt schon zweimal eine Lücke hatte. Hier hängt der
    // echte `PgUserRepo` am Dienst: die Zeile geht durch `toUser`, durch `login`, bis ins
    // Prüfprotokoll.
    const { salt, hash } = await hashPassword(GAST_PASSWORT);
    const { pool } = poolDoppel([
      {
        ...GRUNDZEILE,
        email: "gast@x.de",
        password_salt: salt,
        password_hash: hash,
        access_expires_at: "",
      },
    ]);
    const k = baueKreis({ users: new PgUserRepo(pool) });

    const angemeldet = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    expect(angemeldet.token).toBeTruthy();
    expect(angemeldet.user.accessExpiresAt).toBe("");
    const vermerke = await k.audit.list({
      action: "user.access-expiry-unreadable",
      target: "WERT-ID",
    });
    expect(vermerke).toHaveLength(1);
    expect(vermerke[0]?.payload).toMatchObject({ accessExpiresAt: "" });
  });

  it("D5b — und mit NULL in derselben Strecke entsteht KEIN Vermerk", async () => {
    // Die Gegenrichtung zu D5: sonst wäre der Vermerk auch von einem Dienst erfüllt, der ihn bei
    // jeder Anmeldung schreibt.
    const { salt, hash } = await hashPassword(GAST_PASSWORT);
    const { pool } = poolDoppel([
      {
        ...GRUNDZEILE,
        email: "gast@x.de",
        password_salt: salt,
        password_hash: hash,
        access_expires_at: null,
      },
    ]);
    const k = baueKreis({ users: new PgUserRepo(pool) });

    const angemeldet = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    expect(angemeldet.token).toBeTruthy();
    expect(angemeldet.user.accessExpiresAt).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expiry-unreadable", "WERT-ID")).toBe(0);
  });

  it("D5c — ein ECHTES, abgelaufenes Datum aus derselben Strecke sperrt", async () => {
    // Und die dritte Richtung: die Strecke soll nicht nur nachsichtig sein können. Ein lesbares,
    // vergangenes Datum aus der Datenbankzeile weist die Anmeldung ab.
    const { salt, hash } = await hashPassword(GAST_PASSWORT);
    const { pool } = poolDoppel([
      {
        ...GRUNDZEILE,
        email: "gast@x.de",
        password_salt: salt,
        password_hash: hash,
        access_expires_at: "2020-01-01T00:00:00.000Z",
      },
    ]);
    const k = baueKreis({ users: new PgUserRepo(pool) });

    await expect(
      k.service.login({ email: "gast@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    expect(await vorgaenge(k, "user.access-expired", "WERT-ID")).toBe(1);
  });

  it('D4 — der Schreibweg trennt beides ebenfalls: `""` bleibt `""`, fehlend wird NULL', async () => {
    // Ohne diesen Fall wäre D2 wertlos: ein Lesepfad, der `""` unterscheidet, während der
    // Schreibpfad es zu NULL macht, könnte den Zustand nie erzeugen, den D2 prüft.
    const { pool, anweisungen } = poolDoppel([]);
    const repo = new PgUserRepo(pool);
    const basis = {
      id: "WERT-ID",
      name: "WERT-NAME",
      email: "WERT-EMAIL",
      passwordSalt: "WERT-SALZ",
      passwordHash: "WERT-HASH",
      role: "experte" as const,
      approved: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    await repo.update({ ...basis, accessExpiresAt: "" });
    await repo.update(basis);
    await repo.insert({ ...basis, accessExpiresAt: "" });

    const stelle = (a: Anweisung): unknown => {
      const treffer = /\baccess_expires_at=\$(\d+)/.exec(a.text);
      if (treffer === null) {
        throw new Error(`access_expires_at fehlt im gesendeten SQL:\n${a.text}`);
      }
      return a.params[Number(treffer[1]) - 1];
    };
    const updates = anweisungen.filter((a) => /^\s*UPDATE\s+users\b/i.test(a.text));
    expect(stelle(updates[0] as Anweisung), '`""` wurde beim Schreiben zu NULL').toBe("");
    expect(stelle(updates[1] as Anweisung), "ein fehlendes Feld wurde nicht NULL").toBeNull();

    const einfuegung = anweisungen.find((a) => /^\s*INSERT\s+INTO\s+users\b/i.test(a.text));
    expect(einfuegung?.params.at(-1), "der INSERT trägt den leeren Wert nicht").toBe("");
  });
});
