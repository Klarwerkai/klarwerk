import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type {
  KlaraDNormAuftragsEingabe,
  KlaraDNormAuftragsKontext,
  KlaraDNormAuftragsPort,
} from "../../services/app/src/klara-d-normauftrag-vertrag";
import { bedingungSql } from "../../services/app/src/klara-erinnerung";
import { lokalVon } from "../../services/app/src/klara-erinnerung-zeit";
import { KlaraGespraechFehler } from "../../services/app/src/klara-gespraech";
import { type App, anmelden, draht, registrieren } from "./vorrichtung";

// Eine neue G-SQL-Adapterprobe mit kontrollierter D-Dep, echten D-Auftrags-/Laufzeilen und
// unverändertem bedingungSql. KEIN Nachweis der neuen D-Zweck/UI/Norm-CAS-Implementierung.
// belege_vorbereiten ist hier ausdrücklich kein Produktgrant: nur die kontrollierte Dep wird aufgerufen.
let container: StartedTestContainer;
let url = "";
let app: App;
let pool: ReturnType<typeof createPool>;
let services: ReturnType<typeof buildPgServices>;
let port: KlaraDNormAuftragsPort;
let token = "";
const offen: { app: App; pool: ReturnType<typeof createPool> }[] = [];
async function start() {
  pool = createPool(url);
  services = buildPgServices(pool);
  app = buildApp(services, {
    dNormAuftragsPort: (p) => {
      port = p;
    },
  });
  offen.push({ app, pool });
  await app.ready();
}
async function stop() {
  const i = offen.findIndex((s) => s.app === app);
  const s = offen[i];
  if (s) {
    offen.splice(i, 1);
    await s.app.close();
    await s.pool.end();
  }
}
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) =>
  draht(app, token)(m, p, b);
async function fixture(art: string) {
  const u = await services.auth.authenticate(token);
  if (!u) throw new Error("Fiktive Anmeldung fehlt.");
  const n = await auf("POST", "/api/me/klara/notizen", {
    vorgang: `dg-pg-notiz-${art}`,
    weg: "geschrieben",
    titel: `Fiktives DG-PG-Original ${art}`,
    inhalt: `Normbeleg ${art}; fachlich offen.`,
    objektbezug: { pfad: "/start", seitenName: "Fiktiver PG-Adapter", objekt: art },
  });
  expect(n.statusCode, n.body).toBe(201);
  const ko = await auf("POST", "/api/kos", {
    title: `Fiktive DG-PG-Quelle ${art}`,
    statement: "Synthetischer offener Quellenstand.",
    type: "technik",
    category: "PG-Adapter",
    confidentiality: "intern",
  });
  expect(ko.statusCode, ko.body).toBe(201);
  const l = lokalVon(Date.now(), "Europe/Berlin");
  const r = await auf("POST", "/api/me/klara/erinnerungen", {
    vorgang: `dg-pg-erinnerung-${art}`,
    titel: `Fiktive Quellenpflege ${art}`,
    aktion: "routine_bericht",
    zeitzone: "Europe/Berlin",
    zeitplan: { art: "einmalig", datum: l.datum, uhrzeit: l.uhrzeit },
    routine: {
      wissenspflege: {
        vorlage: "quellaenderung",
        quellen: [ko.json().id],
        normbekanntmachungen: "belege_vorbereiten",
      },
    },
    verpasst: { regel: "nachholen", grenzeMinuten: 30 },
  });
  expect(r.statusCode, r.body).toBe(201);
  const e = r.json().erinnerung;
  const vorkommenId = `dg-pg-vorkommen-${art}`;
  const besitzer = "dg-pg-eigener-halter";
  const lauf = await services.klaraErinnerungen.laeufe.uebernimm({
    vorkommenId,
    erinnerungId: e.id,
    kontoId: u.id,
    geplantFuer: Date.now(),
    besitzer,
    jetzt: Date.now(),
    leaseMs: 120000,
    art: "erinnerung",
    meldungId: `dg-pg-meldung-${art}`,
  });
  expect(lauf?.status).toBe("laeuft");
  const roh: Omit<KlaraDNormAuftragsEingabe, "gespraechId"> = {
    kontoId: u.id,
    erinnerungId: e.id,
    erinnerungFassung: e.fassung,
    routineFassung: e.routine.fassung,
    normId: `norm-pg-${art}`,
    ereignisId: `ne-pg-${art}`,
    pruefVorgang: `normp-pg-${art}`,
    notiz: { id: n.json().notiz.id, fassung: 1 },
    titel: `Persönliche Adapterprüfung ${art}`,
  };
  const sql = (start: number) =>
    bedingungSql(
      {
        erinnerungId: e.id,
        fassung: e.fassung,
        empfaenger: { kontoId: u.id, jetzt: Date.now() },
        quellenStand: [],
        laeufe: [{ id: vorkommenId, besitzer, status: ["laeuft"] }],
      },
      start,
    );
  let bindung: { id: string; abdruck: string } | null = null;
  const k: KlaraDNormAuftragsKontext = {
    vorkommenId,
    besitzer,
    bedingung: { sql },
    async pruefe(p) {
      if (p.eingabe.kontoId !== u.id)
        throw new KlaraGespraechFehler(409, "herkunft_gesperrt", "Fremde Probe.");
      if (p.phase === "lesen") return;
      const s = sql(1);
      const current = await pool.query<{ gilt: boolean }>(
        `SELECT ${s.und.map((x) => `(${x})`).join(" AND ")} AS gilt`,
        s.params,
      );
      if (!current.rows[0]?.gilt)
        throw new KlaraGespraechFehler(
          409,
          "herkunft_gesperrt",
          "Aktuelle kontrollierte D-Bedingung verweigert.",
        );
      if (bindung && (bindung.id !== p.eingabe.gespraechId || bindung.abdruck !== p.abdruck))
        throw new KlaraGespraechFehler(409, "konflikt", "Andere kontrollierte Admission.");
      bindung ??= { id: p.eingabe.gespraechId, abdruck: p.abdruck };
    },
  };
  expect(k.bedingung.gilt).toBeUndefined();
  return { eingabe: await port.eingang(roh, k), kontext: k };
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test_g_dnorm" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test_g_dnorm`;
  const p = createPool(url);
  try {
    await migrate(p);
  } finally {
    await p.end();
  }
  await start();
  token = await registrieren(app);
}, 180000);
afterAll(async () => {
  vi.restoreAllMocks();
  for (const s of [...offen]) {
    await s.app.close();
    await s.pool.end();
    offen.splice(offen.indexOf(s), 1);
  }
  await container?.stop();
});
it("DG-PG1 · echte SQL-only-D-Bedingung/Original nach App-Poolneustart; G-Stopp, Notizfassung und D-Pause direkt vor wirklichem Task-INSERT verhindern neue Wirkung", async () => {
  const positiv = await fixture("positiv");
  const baseline = Number(
    (await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sessions")).rows[0]?.n,
  );
  const original = await port.ausfuehren(positiv.eingabe, positiv.kontext);
  const id = original.schritt?.ergebnis?.id;
  expect(id).toBeTypeOf("string");
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(1);
  expect(
    Number(
      (await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sessions")).rows[0]?.n,
    ),
  ).toBe(baseline);
  await stop();
  await start();
  token = await anmelden(app);
  const restored = await port.original(positiv.eingabe, positiv.kontext);
  expect(restored?.referenz).toEqual(original.referenz);
  expect(restored?.schritt?.ergebnis?.id).toBe(id);
  const replay = await port.ausfuehren(positiv.eingabe, positiv.kontext);
  expect(replay.schritt?.ergebnis?.id).toBe(id);
  for (const art of ["g-stopp", "notizfassung", "d-pause"]) {
    const f = await fixture(art);
    let frei!: () => void;
    let erreicht!: () => void;
    const halte = new Promise<void>((r) => {
      frei = r;
    });
    const da = new Promise<void>((r) => {
      erreicht = r;
    });
    let einmal = false;
    const wirklich = services.klaraAufgaben.lege.bind(services.klaraAufgaben);
    const spy = vi.spyOn(services.klaraAufgaben, "lege").mockImplementation(async (a, b) => {
      if (!einmal) {
        einmal = true;
        expect(b?.sql).toBeTypeOf("function");
        expect(b?.gilt).toBeUndefined();
        erreicht();
        await halte;
      }
      return wirklich(a, b);
    });
    const lauf = port.ausfuehren(f.eingabe, f.kontext);
    const beendet = lauf.catch((fehler) => ({ fehler }));
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          da,
          lauf.then(() => {
            throw new Error("INSERT-Haltepunkt nicht erreicht");
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Echter INSERT-Haltepunkt fehlt")), 10000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const a = (
        await auf("GET", `/api/me/klara/gespraeche/${f.eingabe.gespraechId}/auftraege`)
      ).json().auftraege[0];
      if (art === "g-stopp")
        expect(
          (
            await auf(
              "PUT",
              `/api/me/klara/gespraeche/${f.eingabe.gespraechId}/auftraege/${a.id}/abbruch`,
              {},
            )
          ).statusCode,
        ).toBe(200);
      else if (art === "notizfassung")
        expect(
          (
            await auf("PUT", `/api/me/klara/notizen/${f.eingabe.notiz.id}`, {
              fassung: 1,
              inhalt: "Tatsächliche neue Notizfassung vor INSERT",
            })
          ).statusCode,
        ).toBe(200);
      else
        expect(
          (
            await auf("POST", `/api/me/klara/erinnerungen/${f.eingabe.erinnerungId}/status`, {
              fassung: f.eingabe.erinnerungFassung,
              aktion: "pausieren",
            })
          ).statusCode,
        ).toBe(200);
      frei();
      await beendet;
      expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(1);
      const final = (
        await auf("GET", `/api/me/klara/gespraeche/${f.eingabe.gespraechId}/auftraege`)
      ).json().auftraege[0];
      expect(final.schritte[0].ergebnis).toBeNull();
      expect(final.schritte[0].stand).not.toBe("gespeichert");
    } finally {
      frei();
      await beendet;
      spy.mockRestore();
    }
  }
  expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(200);
  const persistent = await port.original(positiv.eingabe, positiv.kontext);
  expect(persistent?.schritt?.ergebnis?.id).toBe(id);
});
