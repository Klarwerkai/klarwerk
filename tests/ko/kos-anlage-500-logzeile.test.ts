// ================================================================================================
// arbeit:kos-anlage-500-pg-20260930 · K1 — DER AUFFANGZWEIG VON `sendError` IST NICHT MEHR SPURLOS.
// ================================================================================================
//
// DER BEFUND (services/app/src/http.ts, Stand 5e44e7e6, Zeile 194–196): ein Fehler ohne Domänencode
// — etwa ein PostgreSQL-SQLSTATE — wurde mit der generischen 500 beantwortet, ohne eine einzige
// Logzeile. Nur der Maskierungszweig (`SEARCH_PROJECTION_NOT_READY`) schrieb eine. Der 500 aus
// `POST /api/kos` im Prüfauftrag pa-1790659426-c146cfc5 war im Betrieb deshalb nicht nachlesbar.
//
// GEMESSEN AN DER ECHTEN ROUTE: `POST /api/kos` über `buildApp` mit dem Haus-Logger (Serializer,
// Feld- und Meldungspositivliste — genau die Kette, die im Betrieb schreibt). Der Fehler entsteht im
// Dienst (`ko.create`), so wie ein Datenbankfehler dort ankäme: als `Error` mit SQLSTATE in `code`
// und einer rohen Datenbankmeldung.
//
// RÜCKNAHME: mit dem alten Auffangzweig (ohne `reply.log.error`) gibt es keine Zeile mit der
// Meldung unten — `toHaveLength(1)` schlägt fehl.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ERR_OHNE_CODE,
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  buildApp,
  buildServices,
  senkeUeberWert,
} from "../../services/app/src/build-app";

const MELDUNG = "Unerwarteter Fehler ohne Domänencode (HTTP 500 INTERNAL).";
// Bytegleich die Antwort, die der Auffangzweig seit jeher sendet (de, ohne Sprachkopf).
const GENERISCHE_ANTWORT = JSON.stringify({ error: "INTERNAL", message: "Unerwarteter Fehler." });
// Eine rohe Datenbankmeldung, wie `pg` sie in `message` trägt — sie darf nirgends hin.
const ROHE_DB_MELDUNG =
  'deadlock detected: Process 4711 waits for ShareLock on transaction 815; relation "kos" Detail: Anna Meier';

interface Zeile {
  level: number;
  msg?: string;
  reqId?: string;
  code?: string;
  stapel?: unknown;
  err?: Record<string, unknown>;
  res?: { status?: number };
}

function logPuffer() {
  const stuecke: string[] = [];
  return {
    senke: {
      write(zeile: string): void {
        stuecke.push(zeile);
      },
    },
    zeilen: (): Zeile[] =>
      stuecke
        .join("")
        .split("\n")
        .filter((z) => z.trim().length > 0)
        .map((z) => JSON.parse(z) as Zeile),
    roh: () => stuecke.join(""),
  };
}

const KO = {
  confidentiality: "intern",
  title: "Dichtung prüfen",
  statement: "Vor jedem Anlauf die Dichtung prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
};

async function aufbau(puffer: ReturnType<typeof logPuffer>) {
  const services = buildServices();
  const app = buildApp(services, { log: { senke: puffer.senke, stufe: "info" } });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "k1-logzeile@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "k1-logzeile@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { services, app, headers };
}

function dbFehler(code: string): Error & { code: string } {
  return Object.assign(new Error(ROHE_DB_MELDUNG), { code });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("arbeit:kos-anlage-500-pg · K1 · unerwarteter Fehler an POST /api/kos", () => {
  for (const sqlstate of ["40P01", "55P03", "42P01"]) {
    it(`SQLSTATE ${sqlstate}: genau eine Logzeile mit Request-ID, Code und Stapel — Antwort bytegleich generisch`, async () => {
      const puffer = logPuffer();
      const { services, app, headers } = await aufbau(puffer);
      vi.spyOn(services.ko, "create").mockRejectedValueOnce(dbFehler(sqlstate));
      const vorher = puffer.zeilen().length;

      const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: KO });

      // AUSSEN: unverändert die generische INTERNAL-Antwort, bytegleich, ohne Rohtext und Code.
      expect(res.statusCode).toBe(500);
      expect(res.body).toBe(GENERISCHE_ANTWORT);
      expect(res.body).not.toContain(sqlstate);
      expect(res.body).not.toContain("deadlock");

      // INNEN: genau eine Zeile dieses Vorfalls — und keine zweite Fehlerzeile daneben.
      const neu = puffer.zeilen().slice(vorher);
      const vorfall = neu.filter((z) => z.msg === MELDUNG);
      expect(vorfall).toHaveLength(1);
      expect(neu.filter((z) => z.level >= 50)).toHaveLength(1);
      const zeile = vorfall[0] as Zeile;
      expect(zeile.level).toBe(50);
      // Request-ID: dieselbe wie an der Abschlusszeile genau dieser 500er-Antwort.
      expect(typeof zeile.reqId).toBe("string");
      expect(zeile.reqId).toBeTruthy();
      const abschluss = neu.find((z) => z.msg === "request completed" && z.reqId === zeile.reqId);
      expect(abschluss?.res?.status).toBe(500);
      // Technischer Code als eigenes Feld.
      expect(zeile.code).toBe(sqlstate);
      // Stapel: Rahmen `datei:zeile:spalte`, oberster Rahmen ist die Stelle, an der der Fehler
      // entstand (hier: dieser Test).
      expect(Array.isArray(zeile.stapel)).toBe(true);
      const stapel = zeile.stapel as string[];
      expect(stapel.length).toBeGreaterThan(0);
      for (const rahmen of stapel) {
        expect(rahmen).toMatch(/^.+:\d+:\d+$/);
      }
      expect(stapel[0]).toMatch(/^tests\/ko\/kos-anlage-500-logzeile\.test\.ts:\d+:\d+$/);
      // Der Fehler-Serializer hält die Meldung auch intern draussen.
      expect(zeile.err?.message).toBe(ERR_TEXT_UNTERDRUECKT);
      expect(zeile.err?.stack).toBe(ERR_TEXT_UNTERDRUECKT);
      expect(puffer.roh()).not.toContain("deadlock");
      expect(puffer.roh()).not.toContain("Anna Meier");
      expect(puffer.roh()).not.toContain("ShareLock");
      await app.close();
    });
  }

  it("formloser Fehler ohne Code: dieselbe eine Zeile, Code OHNE_CODE", async () => {
    const puffer = logPuffer();
    const { services, app, headers } = await aufbau(puffer);
    vi.spyOn(services.ko, "create").mockRejectedValueOnce(new Error(ROHE_DB_MELDUNG));
    const vorher = puffer.zeilen().length;
    const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: KO });
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe(GENERISCHE_ANTWORT);
    const vorfall = puffer
      .zeilen()
      .slice(vorher)
      .filter((z) => z.msg === MELDUNG);
    expect(vorfall).toHaveLength(1);
    expect(vorfall[0]?.code).toBe(ERR_OHNE_CODE);
    expect((vorfall[0]?.stapel as string[]).length).toBeGreaterThan(0);
    expect(puffer.roh()).not.toContain("deadlock");
    await app.close();
  });

  it("ein Code ausserhalb der SQLSTATE-Form erreicht das Log nicht (UNBEKANNT)", async () => {
    const puffer = logPuffer();
    const { services, app, headers } = await aufbau(puffer);
    // Ziffern drin, also kein Domänencode — aber auch kein SQLSTATE: freier Wert.
    vi.spyOn(services.ko, "create").mockRejectedValueOnce(dbFehler("Meier-1975"));
    const vorher = puffer.zeilen().length;
    const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: KO });
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe(GENERISCHE_ANTWORT);
    const vorfall = puffer
      .zeilen()
      .slice(vorher)
      .filter((z) => z.msg === MELDUNG);
    expect(vorfall).toHaveLength(1);
    expect(vorfall[0]?.code).toBe(ERR_UNBEKANNT);
    expect(puffer.roh()).not.toContain("Meier");
    await app.close();
  });

  it("Gegenprobe: Domänenfehler INVALID_TYPE behält 400 und Meldung — und schreibt keine Auffangzeile", async () => {
    const puffer = logPuffer();
    const { app, headers } = await aufbau(puffer);
    const vorher = puffer.zeilen().length;
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...KO, type: "keine_wissensart" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "INVALID_TYPE", message: "Unbekannte Wissensart." });
    const neu = puffer.zeilen().slice(vorher);
    expect(neu.filter((z) => z.msg === MELDUNG)).toHaveLength(0);
    expect(neu.filter((z) => z.level >= 50)).toHaveLength(0);
    await app.close();
  });

  // Nacharbeit 1: die Senke schwärzte jeden Rahmen mit langem Repo-Pfad (`[redacted].test.ts:87:24`).
  // Die Ausnahme dafür gilt NUR unter `stapel` und NUR für Rahmen in der Form von `stapelRahmen`.
  it("Gegenprobe Senke: Rahmen unter `stapel` bleiben lesbar — sonst greift die Token-Regel weiter", () => {
    const rahmen = "services/knowledge-object/src/search-projection-repo-pg.ts:470:7";
    const token = "QWxhZGRpbjpvcGVuIHNlc2FtZWFiY2RlZmdoaWprbG1u";
    expect(senkeUeberWert({ stapel: [rahmen] }, {})).toEqual({ stapel: [rahmen] });
    // Derselbe Rahmen unter einem anderen Feldnamen: weiterhin geschwärzt.
    const anderesFeld = senkeUeberWert({ herkunftsliste: [rahmen] }, {});
    expect(JSON.stringify(anderesFeld)).toContain("[redacted]");
    // Freier Text unter `stapel` (keine Rahmenform): weiterhin geschwärzt, auch neben echten Rahmen.
    const gemischt = senkeUeberWert({ stapel: [rahmen, `Bearer ${token}`] }, {});
    expect(JSON.stringify(gemischt)).not.toContain(token);
    // Werte secret-benannter Env-Variablen werden auch unter `stapel` entfernt.
    const geheim = "geheimnis-im-pfad-1234";
    const mitGeheimnis = `services/${geheim}/x.ts:1:2`;
    const env = { KLARWERK_TEST_SECRET: geheim };
    const ohneGeheimnis = senkeUeberWert({ stapel: [mitGeheimnis] }, env);
    expect(JSON.stringify(ohneGeheimnis)).not.toContain(geheim);
  });

  it("Gegenprobe: eine gelungene Anlage schreibt keine Auffangzeile", async () => {
    const puffer = logPuffer();
    const { services, app, headers } = await aufbau(puffer);
    const vorher = puffer.zeilen().length;
    const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: KO });
    expect(res.statusCode).toBe(201);
    await services.aiCheckWorker?.idle();
    expect(
      puffer
        .zeilen()
        .slice(vorher)
        .filter((z) => z.msg === MELDUNG),
    ).toHaveLength(0);
    await app.close();
  });
});
