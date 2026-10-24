import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { KlaraBesprechungsDienst } from "../../services/app/src/klara-besprechung";
import { MediaAnalysisService } from "../../services/media";
import { liesPcmWav } from "../../services/media/src/wav-abschnitte";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { markerAntwort, pcmQuelle } from "./segment-fixture";
let container: StartedTestContainer;
let url = "";
let token = "";
const pools = new Map<Pool, () => Promise<void>>();
const apps: ReturnType<typeof buildApp>[] = [];
type Adapter = (marker: number, signal?: AbortSignal) => Promise<ReturnType<typeof markerAntwort>>;
function instanz(adapter: Adapter) {
  const pool = createPool(url);
  const schliessen = poolAbschluss(pool);
  pools.set(pool, schliessen);
  const s = buildPgServices(pool);
  s.media = new MediaAnalysisService({
    objects: s.objects,
    transcriber: {
      name: "kontrollierter-lokaler-Segmentadapter",
      lokal: true,
      transcribe: async () => {
        throw Error("kein Ausweichweg");
      },
      transcribeTimed: async (bytes, _m, _l, _c, signal) =>
        adapter(liesPcmWav(bytes).daten.readInt16LE(0), signal),
    },
  });
  const app = buildApp(s);
  apps.push(app);
  return { app, s, pool, schliessen };
}
function api(
  i: ReturnType<typeof instanz>,
  method: "POST" | "GET" | "DELETE",
  path: string,
  payload?: unknown,
) {
  return i.app.inject({
    method,
    url: `/api/me/klara${path}`,
    headers: { authorization: `Bearer ${token}` },
    ...(payload ? { payload: payload as Record<string, unknown> } : {}),
  });
}
async function quelle(i: ReturnType<typeof instanz>) {
  const upload = await i.app.inject({
    method: "POST",
    url: "/api/objects",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: "synthetische-marker.wav",
      kind: "video",
      mime: "audio/wav",
      purpose: "klara_audio",
      data: `data:audio/wav;base64,${pcmQuelle().toString("base64")}`,
    },
  });
  expect(upload.statusCode, upload.body).toBe(201);
  const r = await api(i, "POST", "/besprechungen/import", {
    titel: "Synthetische Teilprobe",
    meetingId: `segment-${randomUUID()}`,
    berechtigt: true,
    transkription: true,
    segmentiert: true,
    audioId: upload.json().id,
  });
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().verarbeitung.stand).toBe("bereit");
  return r.json().notiz;
}
const b = (n: {
  wissensHerkunft: {
    besprechung: {
      verarbeitung: { stand: string; teile: { fertig: boolean }[] };
      segmente: { id: string; startMs: number }[];
      transkriptFassung: number;
    };
  };
}) => n.wissensHerkunft.besprechung;
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withName(`klara-f15-seg-${randomUUID()}`)
    .withLabels({ "klarwerk.owner": "klara-f15-seg-20261020" })
    .withEnvironment({ POSTGRES_PASSWORD: "f15-synthetic", POSTGRES_DB: "klara_f15_seg" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  console.log(
    JSON.stringify({
      ressource: "F15-Segment-PG",
      ereignis: "begonnen",
      at: new Date().toISOString(),
      containerId: container.getId(),
    }),
  );
  url = `postgresql://postgres:f15-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/klara_f15_seg`;
  const p = createPool(url);
  const schliessen = poolAbschluss(p);
  pools.set(p, schliessen);
  try {
    await migrate(p);
  } finally {
    await schliessen();
  }
  const i = instanz(async (m) => markerAntwort(m));
  expect(
    (
      await i.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "F15 Segment", email: "segment@f15.test", password: "synthetisch123" },
      })
    ).statusCode,
  ).toBe(201);
  token = (
    await i.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "segment@f15.test", password: "synthetisch123" },
    })
  ).json().token;
}, 120000);
afterAll(async () => {
  for (const a of apps) await a.close();
  for (const schliessen of pools.values()) await schliessen();
  await container?.stop();
  console.log(
    JSON.stringify({
      ressource: "F15-Segment-PG",
      ereignis: "beendet",
      at: new Date().toISOString(),
    }),
  );
});
it("echte PG-Teilfassung überlebt Fehler und neue App/Pools: nur offener Rest, gleiche Quelle/Fassung und keine doppelte Passage", async () => {
  const calls: number[] = [];
  let fehlversuch = true;
  const i = instanz(async (m) => {
    calls.push(m);
    if (m === 200 && fehlversuch) {
      fehlversuch = false;
      throw Error("kontrollierter Teilfehler");
    }
    return markerAntwort(m);
  });
  let n = await quelle(i);
  const id = n.id;
  const audioId = n.wissensHerkunft.besprechung.audioId;
  for (const weg of ["uebernehmen", "fristquelle"])
    expect(
      (
        await api(i, "POST", `/besprechungen/${id}/${weg}`, {
          fassung: n.fassung,
          bewusst: true,
          auswahl: ["teil-1-asr-0"],
          eigeneAufgaben: true,
        })
      ).statusCode,
    ).toBe(409);
  expect(
    (
      await api(i, "POST", `/notizen/${id}/wissen/vorschau`, {
        fassung: n.fassung,
        ziel: {
          art: "artikel",
          confidentiality: "intern",
          type: "technik",
          category: "Wartung",
          conditions: [],
        },
      })
    ).statusCode,
  ).toBe(409);
  const step = async (x: typeof i) => {
    const r = await api(x, "POST", `/besprechungen/${id}/teilschritt`, {
      fassung: n.fassung,
      aktion: "fortsetzen",
    });
    expect(r.statusCode, r.body).toBe(200);
    n = r.json().notiz;
  };
  await step(i);
  expect(b(n).verarbeitung.stand).toBe("teilweise");
  expect(b(n).segmente).toHaveLength(1);
  const gespeichert = (await i.pool.query("SELECT data FROM klara_notizen WHERE id=$1", [id]))
    .rows[0].data;
  expect(gespeichert.wissensHerkunft.besprechung.segmente[0].id).toBe("teil-1-asr-0");
  await step(i);
  expect(b(n).verarbeitung.stand).toBe("fehlgeschlagen");
  expect(b(n).segmente).toHaveLength(1);
  await i.app.close();
  await i.schliessen();
  apps.splice(apps.indexOf(i.app), 1);
  pools.delete(i.pool);
  const j = instanz(async (m) => {
    calls.push(m);
    return markerAntwort(m);
  });
  n = (await api(j, "POST", `/besprechungen/${id}/lesen`)).json().notiz;
  expect(b(n).verarbeitung.stand).toBe("fehlgeschlagen");
  await step(j);
  await step(j);
  expect(calls).toEqual([100, 200, 200, 300]);
  expect(b(n).verarbeitung.stand).toBe("abgeschlossen");
  expect(b(n).segmente.map((s) => [s.id, s.startMs])).toEqual([
    ["teil-1-asr-0", 0],
    ["teil-2-asr-0", 30000],
    ["teil-3-asr-0", 60000],
  ]);
  expect(n.id).toBe(id);
  expect(n.wissensHerkunft.besprechung.audioId).toBe(audioId);
  expect(b(n).transkriptFassung).toBe(1);
  await step(j);
  expect(calls).toHaveLength(4);
  console.log(
    JSON.stringify({
      beleg: "F15-persistente-Teilprobe",
      notizId: id,
      audioId,
      fassung: n.fassung,
      transkriptFassung: 1,
      segmente: b(n).segmente.map((s) => s.id),
      aufrufe: calls,
      stand: b(n).verarbeitung.stand,
    }),
  );
});
it("konkurrierender Schritt, echte Pause/AbortSignal und KeineKI: fertiger Rest bleibt erhalten, Abbruch ist terminal", async () => {
  let start: () => void = () => {};
  const gestartet = new Promise<void>((r) => {
    start = r;
  });
  let aborted = false;
  let calls = 0;
  const i = instanz(async (m, signal) => {
    calls++;
    if (m === 200) {
      start();
      await new Promise<void>((_r, reject) =>
        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(Error("kontrolliert abgebrochen"));
          },
          { once: true },
        ),
      );
    }
    return markerAntwort(m);
  });
  let n = await quelle(i);
  const id = n.id;
  n = (
    await api(i, "POST", `/besprechungen/${id}/teilschritt`, {
      fassung: n.fassung,
      aktion: "fortsetzen",
    })
  ).json().notiz;
  const fassung = n.fassung;
  const lauf = api(i, "POST", `/besprechungen/${id}/teilschritt`, {
    fassung,
    aktion: "fortsetzen",
  });
  await gestartet;
  const j = instanz(async () => {
    throw Error("zweiter Provider darf nicht starten");
  });
  const busy = (await api(j, "POST", `/besprechungen/${id}/lesen`)).json().notiz;
  expect(
    (
      await api(j, "POST", `/besprechungen/${id}/teilschritt`, {
        fassung: busy.fassung,
        aktion: "fortsetzen",
      })
    ).statusCode,
  ).toBe(409);
  const pause = await api(i, "POST", `/besprechungen/${id}/teilschritt`, {
    fassung,
    aktion: "pausieren",
  });
  expect(pause.statusCode, pause.body).toBe(200);
  expect((await lauf).statusCode).toBe(200);
  expect(aborted).toBe(true);
  n = pause.json().notiz;
  expect(b(n).verarbeitung.stand).toBe("pausiert");
  expect(b(n).segmente).toHaveLength(1);
  const vorher = i.s.reasoner.kiAbschaltung.bind(i.s.reasoner);
  i.s.reasoner.kiAbschaltung = () => ({ ...vorher(), abgeschaltet: true });
  const noKi = await api(i, "POST", `/besprechungen/${id}/teilschritt`, {
    fassung: n.fassung,
    aktion: "fortsetzen",
  });
  expect(noKi.statusCode, noKi.body).toBe(200);
  n = noKi.json().notiz;
  expect(n.wissensHerkunft.besprechung.verarbeitung.grund).toBe("keine_ki");
  expect(calls).toBe(2);
  const ende = await api(i, "POST", `/besprechungen/${id}/teilschritt`, {
    fassung: n.fassung,
    aktion: "abbrechen",
  });
  expect(ende.statusCode, ende.body).toBe(200);
  n = ende.json().notiz;
  expect(b(n).verarbeitung.stand).toBe("abgebrochen");
  expect(
    (
      await api(i, "POST", `/besprechungen/${id}/teilschritt`, {
        fassung: n.fassung,
        aktion: "fortsetzen",
      })
    ).statusCode,
  ).toBe(409);
  expect(calls).toBe(2);
});
it("neue Instanz nach abgelaufener Laufberechtigung übernimmt nur offenen Teil; verspäteter alter Adapter darf nicht überschreiben", async () => {
  let jetzt = Date.now();
  let started: () => void = () => {};
  let release: () => void = () => {};
  const start = new Promise<void>((r) => {
    started = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const i = instanz(async (m) => {
    started();
    await gate;
    return markerAntwort(m, "Aufgabe: Veraltete Antwort.");
  });
  const n = await quelle(i);
  const konto = n.kontoId;
  const dienst = (x: typeof i) =>
    new KlaraBesprechungsDienst(
      x.s.klaraNotizen,
      x.s.klaraNotizenRoh!,
      x.s.klaraAufgaben,
      x.s.objects,
      x.s.media,
      () => false,
      () => jetzt,
    );
  const alt = dienst(i).teilschritt(konto, n.id, { fassung: n.fassung, aktion: "fortsetzen" });
  await start;
  jetzt += 120001;
  const j = instanz(async (m) => markerAntwort(m, "Aufgabe: Neue gültige Antwort."));
  const gelesen = (await api(j, "POST", `/besprechungen/${n.id}/lesen`)).json().notiz;
  const neu = await dienst(j).teilschritt(konto, n.id, {
    fassung: gelesen.fassung,
    aktion: "fortsetzen",
  });
  release();
  await alt;
  const ende = (await api(j, "POST", `/besprechungen/${n.id}/lesen`)).json().notiz;
  expect(ende.fassung).toBe(neu.notiz.fassung);
  expect(b(ende).segmente).toHaveLength(1);
  expect(ende.inhalt).toContain("Neue gültige Antwort");
  expect(ende.inhalt).not.toContain("Veraltete Antwort");
});
it("Quellnotizlöschung beendet den eigenen laufenden Abschnitt; selbst ein Abort ignorierender Adapter speichert danach kein Ergebnis", async () => {
  let began: () => void = () => {};
  let release: () => void = () => {};
  const start = new Promise<void>((r) => {
    began = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let abgebrochen = false;
  let aufrufe = 0;
  const i = instanz(async (m, signal) => {
    aufrufe++;
    signal?.addEventListener(
      "abort",
      () => {
        abgebrochen = true;
      },
      { once: true },
    );
    began();
    await gate;
    return markerAntwort(m);
  });
  const n = await quelle(i);
  const lauf = api(i, "POST", `/besprechungen/${n.id}/teilschritt`, {
    fassung: n.fassung,
    aktion: "fortsetzen",
  });
  await start;
  const d = await api(i, "DELETE", `/notizen/${n.id}`);
  expect(d.statusCode, d.body).toBe(200);
  expect(abgebrochen).toBe(true);
  release();
  expect((await lauf).statusCode).toBe(404);
  expect((await api(i, "POST", `/besprechungen/${n.id}/lesen`)).statusCode).toBe(404);
  expect((await i.pool.query("SELECT id FROM klara_notizen WHERE id=$1", [n.id])).rowCount).toBe(0);
  expect(await i.s.objects.read(n.wissensHerkunft.besprechung.audioId)).toBeUndefined();
  expect(aufrufe).toBe(1);
});
