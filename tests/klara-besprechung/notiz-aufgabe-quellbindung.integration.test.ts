import { randomUUID } from "node:crypto";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { pcmQuelle } from "./segment-fixture";
let container: StartedTestContainer | undefined;
let eigeneDb: { verwaltung: string; name: string } | undefined;
let url = "";
let admin = "";
let token = "";
const poolAbschluesse: (() => Promise<void>)[] = [];
const apps: ReturnType<typeof buildApp>[] = [];
function instanz() {
  const pool = createPool(url);
  poolAbschluesse.push(poolAbschluss(pool));
  const services = buildPgServices(pool);
  const app = buildApp(services);
  apps.push(app);
  return { pool, services, app };
}
let i: ReturnType<typeof instanz>;
function api(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: unknown,
  x = i,
  auth = token,
) {
  return x.app.inject({
    method,
    url: `/api${path}`,
    headers: { authorization: `Bearer ${auth}` },
    ...(payload ? { payload: payload as Record<string, unknown> } : {}),
  });
}
async function audio(segmentiert = false) {
  const r = await api("POST", "/objects", {
    name: "synthetische-quelle.wav",
    mime: "audio/wav",
    kind: "video",
    purpose: "klara_audio",
    data: `data:audio/wav;base64,${segmentiert ? pcmQuelle(1).toString("base64") : "UklGRg=="}`,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
}
async function meeting(audioId?: string, segmentiert = false) {
  const r = await api("POST", "/me/klara/besprechungen/import", {
    titel: "Synthetische F15-Privatmarke",
    meetingId: `caller-${randomUUID()}`,
    berechtigt: true,
    ...(segmentiert
      ? { audioId, segmentiert: true, transkription: true }
      : audioId
        ? {
            audioId,
            vtt: "WEBVTT\n\na\n00:00:00.000 --> 00:00:01.000\nBeschluss: Synthetische F15-Privatmarke erhalten.",
          }
        : { text: "Beschluss: Synthetische F15-Privatmarke erhalten." }),
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().notiz;
}
async function normaleNotiz(
  titel = "Gewöhnlicher eigener Ergebniszettel",
  inhalt = "Gewöhnliches eigenes Ergebnis ohne F15-Quelle.",
) {
  const r = await api("POST", "/me/klara/notizen", {
    vorgang: `note-${randomUUID()}`,
    weg: "geschrieben",
    titel,
    inhalt,
    objektbezug: { pfad: "/start", seitenName: "Start", objekt: titel },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().notiz;
}
// Genau der normale sichtbare Als-Aufgabe-Caller: kein interner dritter Parameter/Bindungsflag.
function ausNotiz(notizId: string, extra: Record<string, unknown> = {}) {
  return api("POST", "/me/klara/aufgaben", {
    vorgang: `aufgabe-aus-notiz-${notizId.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 100),
    weg: "notiz",
    quelle: { notizId },
    ...extra,
  });
}
async function taskSicht(id: string, x = i) {
  const [einzeln, liste] = await Promise.all([
    api("GET", `/me/klara/aufgaben/${id}`, undefined, x),
    api("GET", "/me/klara/aufgaben", undefined, x),
  ]);
  return { einzeln, liste, ids: liste.json().aufgaben.map((a: { id: string }) => a.id) };
}
/** Nur den Datenbankpfad ersetzen: Authority, Query und Socket-Optionen bleiben erhalten. */
async function frischeDatenbank(lokal: string): Promise<string> {
  const teile = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(lokal);
  if (!teile) {
    throw new Error("KLARWERK_PG_TEST_URL ist nicht lesbar — keine eigene F15-Datenbank anlegbar.");
  }
  const name = `klarwerk_f15_test_${randomUUID().replace(/-/g, "")}`;
  const verwaltung = createPool(lokal);
  const schliessen = poolAbschluss(verwaltung);
  poolAbschluesse.push(schliessen);
  const fehler: unknown[] = [];
  try {
    await verwaltung.query(`CREATE DATABASE "${name}"`);
    eigeneDb = { verwaltung: lokal, name };
  } catch (cause) {
    fehler.push(
      new Error("Auf KLARWERK_PG_TEST_URL lässt sich keine eigene F15-Testdatenbank anlegen.", {
        cause,
      }),
    );
  } finally {
    try {
      await schliessen();
    } catch (cause) {
      fehler.push(cause);
    }
  }
  if (fehler.length) throw new AggregateError(fehler, "F15-Datenbankaufbau fehlgeschlagen.");
  return `${teile[1]}${name}${teile[3]}`;
}
beforeAll(async () => {
  const lokal = guardedLocalPgTestUrl();
  if (lokal) {
    url = await frischeDatenbank(lokal);
  } else if (process.env.KLARWERK_PG_TEST_URL) {
    throw new Error("KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall.");
  } else {
    container = await new GenericContainer("postgres:16-alpine")
      .withName(`klara-f15-quellbindung-${randomUUID()}`)
      .withLabels({ "klarwerk.owner": "klara-f15-quellbindung-20261020" })
      .withEnvironment({
        POSTGRES_PASSWORD: "f15-synthetic",
        POSTGRES_DB: "klara_f15_quellbindung",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:f15-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/klara_f15_quellbindung`;
  }
  console.log(
    JSON.stringify({
      ressource: "F15-1-PG",
      ereignis: "begonnen",
      at: new Date().toISOString(),
      backend: container ? "container" : "ci-url",
      datenbank: eigeneDb?.name ?? "klara_f15_quellbindung",
    }),
  );
  const p = createPool(url);
  const schliessen = poolAbschluss(p);
  poolAbschluesse.push(schliessen);
  const fehler: unknown[] = [];
  try {
    await migrate(p);
  } catch (cause) {
    fehler.push(cause);
  } finally {
    try {
      await schliessen();
    } catch (cause) {
      fehler.push(cause);
    }
  }
  if (fehler.length) throw new AggregateError(fehler, "F15-Migration fehlgeschlagen.");
  const x = instanz();
  expect(
    (
      await x.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "F15 Prüfbetrieb",
          email: "admin@f15-quellbindung.test",
          password: "synthetisch123",
        },
      })
    ).statusCode,
  ).toBe(201);
  admin = (
    await x.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@f15-quellbindung.test", password: "synthetisch123" },
    })
  ).json().token;
}, 120000);
beforeEach(async () => {
  i = instanz();
  const email = `f-${randomUUID()}@f15-quellbindung.test`;
  expect(
    (
      await api(
        "POST",
        "/users",
        { name: "F15 fiktiver Caller", email, role: "experte", password: "synthetisch123" },
        i,
        admin,
      )
    ).statusCode,
  ).toBe(201);
  token = (
    await i.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "synthetisch123" },
    })
  ).json().token;
});
afterAll(async () => {
  const fehler: unknown[] = [];
  for (const a of apps) {
    try {
      await a.close();
    } catch (cause) {
      fehler.push(cause);
    }
  }
  for (const schliessen of poolAbschluesse) {
    try {
      await schliessen();
    } catch (cause) {
      fehler.push(cause);
    }
  }
  if (eigeneDb) {
    try {
      if (!/^klarwerk_f15_test_[a-f0-9]{32}$/.test(eigeneDb.name)) {
        throw new Error("F15-Cleanup verweigert einen fremden Datenbanknamen.");
      }
      const verwaltung = createPool(eigeneDb.verwaltung);
      const schliessen = poolAbschluss(verwaltung);
      poolAbschluesse.push(schliessen);
      try {
        await verwaltung.query(`DROP DATABASE IF EXISTS "${eigeneDb.name}" WITH (FORCE)`);
      } finally {
        try {
          await schliessen();
        } catch (cause) {
          fehler.push(cause);
        }
      }
    } catch (cause) {
      fehler.push(cause);
    }
  }
  try {
    await container?.stop();
  } catch (cause) {
    fehler.push(cause);
  }
  console.log(
    JSON.stringify({
      ressource: "F15-1-PG",
      ereignis: fehler.length ? "ende-mit-fehler" : "beendet",
      at: new Date().toISOString(),
    }),
  );
  if (fehler.length)
    throw new AggregateError(fehler, "F15-Prüfplatz nicht vollständig geschlossen.");
});
it("normaler Notiz→Aufgabe-Caller verweigert echte Teilfassung auch bei abweichendem Text/Clientflag vor jeder Kopie", async () => {
  const n = await meeting(await audio(true), true);
  const r = await ausNotiz(n.id, {
    titel: "Eigener behaupteter Ersatztext",
    inhalt: "Teilfassung trotzdem kopieren",
    privatNotizGebunden: false,
  });
  console.log(
    JSON.stringify({
      beleg: "F15-1-Teilfassung",
      notizId: n.id,
      status: r.statusCode,
      taskId: r.json().aufgabe?.id ?? null,
    }),
  );
  expect(r.statusCode, r.body).toBe(409);
  expect(
    (await i.pool.query("SELECT id FROM klara_aufgaben WHERE konto_id=$1", [n.kontoId])).rowCount,
  ).toBe(0);
  expect((await ausNotiz(n.id, { privatNotizGebunden: true })).statusCode).toBe(409);
});
it("fertige Audio/VTT-Notiz wird im normalen Caller persistent gebunden; heutiger Quellenentzug sperrt Einzel-, Listen- und Wiederholungsweg", async () => {
  const audioId = await audio();
  const n = await meeting(audioId);
  const r = await ausNotiz(n.id);
  expect(r.statusCode, r.body).toBe(201);
  const task = r.json().aufgabe;
  expect(task.inhalt).toBe(n.inhalt);
  expect(task.titel).toBe(n.titel);
  const wieder = await ausNotiz(n.id);
  expect(wieder.statusCode, wieder.body).toBe(200);
  expect(wieder.json().aufgabe.id).toBe(task.id);
  const gespeichert = (await i.pool.query("SELECT data FROM klara_aufgaben WHERE id=$1", [task.id]))
    .rows[0].data;
  const neu = instanz();
  expect((await taskSicht(task.id, neu)).einzeln.statusCode).toBe(200);
  await neu.services.objects.delete(audioId);
  const sicht = await taskSicht(task.id, neu);
  const erneut = await ausNotiz(n.id);
  console.log(
    JSON.stringify({
      beleg: "F15-1-Quellentzug",
      taskId: task.id,
      notizId: n.id,
      privatNotizGebunden: gespeichert.privatNotizGebunden ?? false,
      einzeln: sicht.einzeln.statusCode,
      inListe: sicht.ids.includes(task.id),
      wiederholung: erneut.statusCode,
    }),
  );
  expect(sicht.einzeln.statusCode, sicht.einzeln.body).toBe(404);
  expect(sicht.ids).not.toContain(task.id);
  expect(sicht.liste.body).not.toContain("Synthetische F15-Privatmarke");
  expect(erneut.statusCode).toBe(404);
  expect(gespeichert.privatNotizGebunden).toBe(true);
});
it("normale Aufgaben aus fertigem Transkript und privater Übergabe verschwinden nach Quellbesprechungslöschung auch aus realer PG-Ablage", async () => {
  const n = await meeting();
  const ue = await api("POST", `/me/klara/besprechungen/${n.id}/uebernehmen`, {
    fassung: n.fassung,
    bewusst: true,
    auswahl: ["zeile-1"],
  });
  expect(ue.statusCode, ue.body).toBe(200);
  const ids: string[] = [];
  for (const id of [n.id, ue.json().notizId]) {
    const r = await ausNotiz(id);
    expect(r.statusCode, r.body).toBe(201);
    ids.push(r.json().aufgabe.id);
  }
  expect((await api("DELETE", `/me/klara/notizen/${n.id}`)).statusCode).toBe(200);
  const rest = await i.pool.query("SELECT id FROM klara_aufgaben WHERE id=ANY($1::text[])", [ids]);
  const sicht = await Promise.all(ids.map((id) => taskSicht(id)));
  console.log(
    JSON.stringify({
      beleg: "F15-1-Privatloeschung",
      notizId: n.id,
      taskIds: ids,
      pgReste: rest.rowCount,
      einzeln: sicht.map((s) => s.einzeln.statusCode),
    }),
  );
  expect(rest.rowCount).toBe(0);
  for (let j = 0; j < ids.length; j++) {
    expect(sicht[j]?.einzeln.statusCode).toBe(404);
    expect(sicht[j]?.ids).not.toContain(ids[j]);
  }
});
it("gewöhnliche eigene Notizen/Ergebnisse behalten ihren bisherigen unabhängigen Aufgabenweg; Clientflag erzeugt keine falsche Bindung", async () => {
  const n = await normaleNotiz();
  const r = await ausNotiz(n.id, { privatNotizGebunden: true });
  expect(r.statusCode, r.body).toBe(201);
  const task = r.json().aufgabe;
  const row = (await i.pool.query("SELECT data FROM klara_aufgaben WHERE id=$1", [task.id])).rows[0]
    .data;
  expect(row.privatNotizGebunden).toBe(false);
  expect((await api("DELETE", `/me/klara/notizen/${n.id}`)).statusCode).toBe(200);
  const sicht = await taskSicht(task.id);
  expect(sicht.einzeln.statusCode, sicht.einzeln.body).toBe(200);
  expect(sicht.ids).toContain(task.id);
  expect(sicht.einzeln.json().aufgabe.inhalt).toBe(n.inhalt);
});
it("Wiederholung eines ungebundenen anderen Vorgangs wird nicht als quellengebundene Besprechungsaufgabe ausgegeben", async () => {
  const n = await meeting();
  const normal = await normaleNotiz(n.titel, n.inhalt);
  const vorgang = `idempotenz-${randomUUID()}`;
  expect((await ausNotiz(normal.id, { vorgang })).statusCode).toBe(201);
  const r = await ausNotiz(n.id, { vorgang });
  expect(r.statusCode, r.body).toBe(409);
});
it("F15-1-R · geschützte bearbeitete Aufgabe wird nach Entzug nicht über gewöhnliche Notiz und gleichen Vorgang zurückgegeben", async () => {
  const audioId = await audio();
  const n = await meeting(audioId);
  const erzeugt = await ausNotiz(n.id);
  expect(erzeugt.statusCode, erzeugt.body).toBe(201);
  const a = erzeugt.json().aufgabe;
  const titel = "Bearbeiteter privater F15-Titel";
  const inhalt = "Bearbeiteter privater F15-Inhalt mit eigener synthetischer Markierung.";
  const bearbeitet = await api("PUT", `/me/klara/aufgaben/${a.id}`, {
    fassung: a.fassung,
    titel,
    inhalt,
  });
  expect(bearbeitet.statusCode, bearbeitet.body).toBe(200);
  expect(bearbeitet.json().aufgabe.fassung).toBeGreaterThan(1);
  const erlaubt = await ausNotiz(n.id);
  expect(erlaubt.statusCode, erlaubt.body).toBe(200);
  expect(erlaubt.json().aufgabe).toMatchObject({
    id: a.id,
    titel,
    inhalt,
    fassung: bearbeitet.json().aufgabe.fassung,
  });
  const normal = await normaleNotiz();
  const normalAufgabe = await ausNotiz(normal.id);
  expect(normalAufgabe.statusCode, normalAufgabe.body).toBe(201);
  const normalReplay = await ausNotiz(normal.id);
  expect(normalReplay.statusCode, normalReplay.body).toBe(200);
  expect(normalReplay.json().aufgabe.id).toBe(normalAufgabe.json().aufgabe.id);
  await i.services.objects.delete(audioId);
  const verborgen = await taskSicht(a.id);
  expect(verborgen.einzeln.statusCode).toBe(404);
  expect(verborgen.ids).not.toContain(a.id);
  expect(verborgen.liste.body).not.toContain(inhalt);
  const umgekehrt = await ausNotiz(normal.id, { vorgang: a.vorgang });
  console.log(
    JSON.stringify({
      beleg: "F15-1-R-umgekehrter-Replay",
      notizId: n.id,
      geschuetzteTaskId: a.id,
      bearbeiteteFassung: bearbeitet.json().aufgabe.fassung,
      erlaubtVorEntzug: erlaubt.statusCode,
      direkteSichtNachEntzug: verborgen.einzeln.statusCode,
      inListe: verborgen.ids.includes(a.id),
      normalReplay: normalReplay.statusCode,
      umgekehrterReplay: umgekehrt.statusCode,
      gibtAufgabenkoerperZurueck: !!umgekehrt.json().aufgabe,
    }),
  );
  expect(umgekehrt.statusCode, umgekehrt.body).toBe(409);
  expect(umgekehrt.json().aufgabe).toBeUndefined();
  for (const privat of [a.id, titel, inhalt]) expect(umgekehrt.body).not.toContain(privat);
});
