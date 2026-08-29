import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  KLARA_SESSION_AUFBEWAHRUNG_MS,
  KLARA_SESSION_INACTIVITY_MS,
  KLARA_TOUCH_MINDESTABSTAND_MS,
  type KlaraDocumentDescriptor,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "../../services/app/src/services/klara-session-service";
import { InMemoryKlaraSessionRepo, PgKlaraSessionRepo } from "../../services/reasoner";

// ================================================================================================
// JOB 2688 D1 — JEDES HINSEHEN IST EIN SCHREIBVORGANG (Befund R2-13)
// ================================================================================================
//
// Vor diesem Durchgang schrieb jeder Statusabruf des Panels `last_activity_at`/`expires_at` per
// UPDATE fort, auch wenn der letzte Abruf Sekunden her war. Und es gab keinen Weg, eine
// abgelaufene Sitzung je wieder aus dem Bestand zu entfernen. Die Faelle hier zaehlen Schreib-
// vorgaenge und Zeilen — sie pruefen nicht, dass der Code tut, was er tut, sondern dass er
// weniger tut als vorher (Teil 1) und etwas tut, was es vorher nicht gab (Teil 2).

const T0 = Date.parse("2026-08-29T09:00:00.000Z");
const SEK = 1000;
const MIN = 60 * SEK;
const TAG = 24 * 60 * MIN;

const GESPEICHERT: KlaraDocumentDescriptor = { kind: "saved", hostDocumentId: "word-doc-1" };

/** Zaehlt die UPDATE-Schreibvorgaenge des Touch — der Spion aus §3 des Auftrags. */
class ZaehlRepo extends InMemoryKlaraSessionRepo {
  touches = 0;

  override touchSession(
    ...args: Parameters<InMemoryKlaraSessionRepo["touchSession"]>
  ): Promise<boolean> {
    this.touches++;
    return super.touchSession(...args);
  }
}

function aufbau(over: Partial<KlaraPolicyQuelle> = {}) {
  let jetzt = T0;
  let zaehler = 0;
  const quelle: KlaraPolicyQuelle = {
    choice: "deterministic",
    source: "default",
    effectiveAnswerProvider: "deterministic",
    cloudConfigured: false,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    localProviderLabel: "Lokaler Anbieter",
    ...over,
  };
  const repo = new ZaehlRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => jetzt,
    newId: () => `id-${++zaehler}`,
  });
  return {
    dienst,
    repo,
    vorspulen: (ms: number) => {
      jetzt += ms;
    },
    setze: (ms: number) => {
      jetzt = ms;
    },
  };
}

function externAufbau() {
  return aufbau({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" });
}

async function sitzung(dienst: KlaraSessionService, instanz = "instanz-1") {
  const s = await dienst.createSession("anna", instanz, GESPEICHERT);
  return {
    sicht: s,
    bindung: { actorId: "anna", addinInstanceId: instanz, documentContextId: s.documentContextId },
  };
}

// ================================================================================================
// TEIL 1 — TOUCH NUR BEI BEDARF
// ================================================================================================

describe("JOB 2688 D1 · Teil 1: zwei Statusabrufe binnen fuenf Sekunden sind EIN Schreibvorgang", () => {
  it("S1 · der Mindestabstand ist 60 s und liegt weit unter der Gleitfrist von 15 min", () => {
    expect(KLARA_TOUCH_MINDESTABSTAND_MS).toBe(60 * SEK);
    expect(KLARA_TOUCH_MINDESTABSTAND_MS * 15).toBe(KLARA_SESSION_INACTIVITY_MS);
  });

  it("S2 · Abruf nach 61 s schreibt; der zweite Abruf 5 s spaeter schreibt NICHT (1 statt 2)", async () => {
    const { dienst, repo, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    expect(repo.touches).toBe(0);

    vorspulen(61 * SEK);
    const a = await dienst.getSession(sicht.sessionId, bindung);
    expect(repo.touches).toBe(1);

    vorspulen(5 * SEK);
    const b = await dienst.getSession(sicht.sessionId, bindung);
    // Der Beweis aus §3: bis 2688 stand hier 2.
    expect(repo.touches).toBe(1);
    // Und der zweite Abruf traegt den Stand des ersten — nichts wurde fortgeschrieben.
    expect(b.expiresAt).toBe(a.expiresAt);
    expect((await repo.findSession(sicht.sessionId))?.revision).toBe(
      (await repo.findSession(sicht.sessionId))?.revision,
    );
  });

  it("S3 · Gegenprobe des Spions: zwei Abrufe im Abstand von je 61 s schreiben zweimal", async () => {
    const { dienst, repo, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    vorspulen(61 * SEK);
    await dienst.getSession(sicht.sessionId, bindung);
    vorspulen(61 * SEK);
    await dienst.getSession(sicht.sessionId, bindung);
    expect(repo.touches).toBe(2);
  });

  it("S4 · Panel-Polling alle 5 s ueber 10 Minuten: 120 Abrufe, hoechstens 10 Schreibvorgaenge", async () => {
    const { dienst, repo, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    for (let i = 0; i < 120; i++) {
      vorspulen(5 * SEK);
      await dienst.getSession(sicht.sessionId, bindung);
    }
    // 600 s / 60 s = 10 Fenster; im ersten Fenster faellt der Touch bei 60 s.
    expect(repo.touches).toBeLessThanOrEqual(10);
    expect(repo.touches).toBeGreaterThanOrEqual(9);
  });

  it("S5 · KEIN vorzeitiger Ablauf unter Nutzung: Abrufe alle 30 s ueber 2 h bleiben gueltig", async () => {
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    for (let i = 0; i < 240; i++) {
      vorspulen(30 * SEK);
      await expect(dienst.getSession(sicht.sessionId, bindung)).resolves.toBeTruthy();
    }
  });

  it("S6 · die Grenze des Vorschlags, ausgesprochen: nach der letzten Nutzung kann die Sitzung bis zu 60 s frueher ablaufen als bisher", async () => {
    const { dienst, repo, vorspulen, setze } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    // Touch bei +61 s (schreibt) — Ablauf = 61 s + 15 min.
    vorspulen(61 * SEK);
    const nachTouch = await dienst.getSession(sicht.sessionId, bindung);
    expect(Date.parse(nachTouch.expiresAt)).toBe(T0 + 61 * SEK + KLARA_SESSION_INACTIVITY_MS);
    // Letzte Nutzung bei +90 s (schreibt NICHT).
    vorspulen(29 * SEK);
    const letzte = await dienst.getSession(sicht.sessionId, bindung);
    expect(letzte.expiresAt).toBe(nachTouch.expiresAt);
    expect(repo.touches).toBe(1);
    // Bei der geschriebenen Frist: abgelaufen — 29 s vor „letzte Nutzung + 15 min". Das ist der
    // Preis des Vorschlags; er ist durch den Mindestabstand auf 60 s begrenzt. (Ein Abruf kurz
    // vorher waere selbst eine Nutzung und wuerde beruehren — deshalb gibt es hier keinen.)
    setze(T0 + 61 * SEK + KLARA_SESSION_INACTIVITY_MS);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      message: "Sitzung ist abgelaufen.",
    });
  });

  it("S7 · auch grantConsent beruehrt binnen 60 s nicht ein zweites Mal", async () => {
    const { dienst, repo, vorspulen } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    vorspulen(61 * SEK);
    await dienst.getSession(sicht.sessionId, bindung);
    vorspulen(3 * SEK);
    await dienst.grantConsent(sicht.sessionId, bindung);
    // Der Grant selbst ist ein fachlicher Schreibvorgang (eigener Uebergang) — aber kein Touch.
    expect(repo.touches).toBe(1);
  });
});

// ================================================================================================
// TEIL 2 — AUFRAEUMEN NACH 30 TAGEN
// ================================================================================================

describe("JOB 2688 D1 · Teil 2: eine seit 30 Tagen abgelaufene Sitzung ist weg", () => {
  it("A1 · die Aufbewahrung betraegt 30 Tage nach Ablauf", () => {
    expect(KLARA_SESSION_AUFBEWAHRUNG_MS).toBe(30 * TAG);
  });

  it("A2 · drei Sitzungen, eine davon seit 31 Tagen abgelaufen: vorher 3, nachher 2 — samt Zustimmung", async () => {
    const { dienst, repo, setze } = externAufbau();
    // s1: angelegt bei T0, laeuft T0+15min ab, bekommt eine Zustimmung.
    const s1 = await sitzung(dienst, "instanz-1");
    await dienst.grantConsent(s1.sicht.sessionId, s1.bindung);
    expect(await repo.alleConsents(s1.sicht.sessionId)).toHaveLength(1);
    // s2: angelegt bei T0+2 Tage, laeuft T0+2d+15min ab (erst 29 Tage alt am Stichtag).
    setze(T0 + 2 * TAG);
    const s2 = await sitzung(dienst, "instanz-2");
    // s3: angelegt am Stichtag, aktiv.
    setze(T0 + 31 * TAG);
    const s3 = await sitzung(dienst, "instanz-3");

    let vorher = 0;
    for (const s of [s1, s2, s3]) {
      if (await repo.findSession(s.sicht.sessionId)) vorher++;
    }
    expect(vorher).toBe(3);

    setze(T0 + 31 * TAG + 15 * MIN + SEK);
    const entfernt = await dienst.raeumeAbgelaufeneAuf();

    expect(entfernt).toBe(1);
    expect(await repo.findSession(s1.sicht.sessionId)).toBeUndefined();
    expect(await repo.alleConsents(s1.sicht.sessionId)).toHaveLength(0);
    expect(await repo.findSession(s2.sicht.sessionId)).toBeDefined();
    expect(await repo.findSession(s3.sicht.sessionId)).toBeDefined();
  });

  it("A3 · idempotent: ein zweiter Lauf entfernt nichts mehr", async () => {
    const { dienst, setze } = aufbau();
    await sitzung(dienst);
    setze(T0 + 40 * TAG);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(0);
  });

  it("A4 · eine seit 29 Tagen abgelaufene Sitzung bleibt", async () => {
    const { dienst, repo, setze } = aufbau();
    const s = await sitzung(dienst);
    setze(T0 + 15 * MIN + 29 * TAG);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(0);
    expect(await repo.findSession(s.sicht.sessionId)).toBeDefined();
  });
});

// ================================================================================================
// TEIL 3 — DAS SQL DES PG-REPOS, GEGEN EINEN POOL-DOPPEL
// ================================================================================================

type Abgesetzt = { sql: string; params: unknown[] };

function poolDoppel(rowCount: number, fehlerBei?: string) {
  const abgesetzt: Abgesetzt[] = [];
  let freigegeben = 0;
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      abgesetzt.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (fehlerBei && sql.includes(fehlerBei)) {
        throw new Error("Datenbank sagt nein");
      }
      return { rowCount: sql.startsWith("DELETE FROM klara_sessions") ? rowCount : 0, rows: [] };
    },
    release: () => {
      freigegeben++;
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, abgesetzt, freigegebenZaehler: () => freigegeben };
}

describe("JOB 2688 D1 · Teil 3: PgKlaraSessionRepo.purgeExpiredSessions", () => {
  it("P1 · Zustimmungen und Sitzungen in EINER Transaktion, beide mit derselben Grenze gebunden", async () => {
    const { pool, abgesetzt, freigegebenZaehler } = poolDoppel(3);
    const repo = new PgKlaraSessionRepo(pool);
    const grenze = "2026-07-30T09:00:00.000Z";

    expect(await repo.purgeExpiredSessions(grenze)).toBe(3);

    expect(abgesetzt.map((a) => a.sql.split(" ")[0])).toEqual([
      "BEGIN",
      "DELETE",
      "DELETE",
      "COMMIT",
    ]);
    expect(abgesetzt[1]?.sql).toContain("DELETE FROM klara_session_consents");
    expect(abgesetzt[1]?.sql).toContain(
      "WHERE session_id IN (SELECT session_id FROM klara_sessions WHERE expires_at < $1)",
    );
    expect(abgesetzt[1]?.params).toEqual([grenze]);
    expect(abgesetzt[2]?.sql).toBe("DELETE FROM klara_sessions WHERE expires_at < $1");
    expect(abgesetzt[2]?.params).toEqual([grenze]);
    expect(freigegebenZaehler()).toBe(1);
  });

  it("P2 · scheitert das Loeschen der Sitzungen, wird zurueckgerollt und der Client freigegeben", async () => {
    const { pool, abgesetzt, freigegebenZaehler } = poolDoppel(0, "DELETE FROM klara_sessions");
    const repo = new PgKlaraSessionRepo(pool);

    await expect(repo.purgeExpiredSessions("2026-07-30T09:00:00.000Z")).rejects.toThrow(
      "Datenbank sagt nein",
    );

    expect(abgesetzt.map((a) => a.sql.split(" ")[0])).toEqual([
      "BEGIN",
      "DELETE",
      "DELETE",
      "ROLLBACK",
    ]);
    expect(freigegebenZaehler()).toBe(1);
  });
});
