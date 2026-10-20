import type { FastifyInstance } from "fastify";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";

const TEXT="Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
describe("AW21 · tatsächlicher bestehender D-Laufguard vor Norm-Fristen-CAS",()=>{
  let container: StartedTestContainer;
  let pool:ReturnType<typeof createPool>;
  let zweiterPool:ReturnType<typeof createPool>;
  let services:ReturnType<typeof buildPgServices>;
  let andere:ReturnType<typeof buildPgServices>;
  let app:FastifyInstance;
  let andereApp:FastifyInstance;
  let admin:Konto;
  let lauf:()=>Promise<KlaraErinnerungLaufbericht>;
  let vorNorm:(()=>Promise<void>)|undefined;
  let sqlErgebnisse:boolean[]=[];
  beforeAll(async()=>{
    vi.stubEnv("KLARWERK_SKIP_KEYCHAIN","1");vi.stubEnv("KLARWERK_LOCAL_LLM_URL","");vi.stubEnv("ANTHROPIC_API_KEY","");
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-20T06:59:00Z"));
    container=await new GenericContainer("postgres:16-alpine").withEnvironment({POSTGRES_PASSWORD:"test",POSTGRES_DB:"klarwerk_normwatch_test"})
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/,2)).start();
    const url=`postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_normwatch_test`;
    pool=createPool(url);zweiterPool=createPool(url);await migrate(pool);services=buildPgServices(pool);andere=buildPgServices(zweiterPool);
    const echt=services.klaraFristen;services.klaraFristen={hole:id=>echt.hole(id),speichere:async(s,v,b)=>{
      const hook=vorNorm;vorNorm=undefined;await hook?.();const r=await echt.speichere(s,v,b);sqlErgebnisse.push(r);return r;
    }};
    app=buildApp(services,{klaraErinnerungen:fn=>{lauf=fn;return 65_000;}});andereApp=buildApp(andere,{klaraErinnerungen:()=>65_000});
    await app.ready();await andereApp.ready();admin=await neuesKonto(app,"normwatch-pg-admin");
  });
  beforeEach(()=>{vi.setSystemTime(new Date("2026-10-20T06:59:00Z"));vorNorm=undefined;sqlErgebnisse=[];});
  afterAll(async()=>{await app?.close();await andereApp?.close();await pool?.end();await zweiterPool?.end();await container?.stop();vi.useRealTimers();vi.unstubAllEnvs();});
  async function fall(){
    const email=`normwatch-pg-${crypto.randomUUID()}@klarwerk.test`;const password="Normwatch-PG-Synthetisch-2026!";
    const r=await app.inject({method:"POST",url:"/api/users",headers:admin.kopf,payload:{name:"Fiktive Normwatchperson",email,password,role:"experte"}});
    expect(r.statusCode,r.body).toBe(201);const login=await app.inject({method:"POST",url:"/api/auth/login",payload:{email,password}});
    expect(login.statusCode,login.body).toBe(200);const headers={authorization:`Bearer ${login.json().token}`};
    const kontoId:string=(await app.inject({url:"/api/auth/me",headers})).json().id;
    const ko=await services.ko.create({title:"Fiktive Normwatchquelle PG",statement:TEXT,type:"technik",category:"Synthetischer Normwatch",author:kontoId,confidentiality:"intern"});
    const e=await app.inject({method:"POST",url:"/api/me/klara/erinnerungen",headers,payload:{vorgang:`normwatch-pg-${crypto.randomUUID()}`,titel:"Fiktiver Normwatch PG",aktion:"routine_bericht",zeitzone:"Europe/Berlin",
      routine:{wissenspflege:{vorlage:"quellaenderung",quellen:[ko.id],normbekanntmachungen:"belege_vorbereiten"}},
      zeitplan:{art:"serie",datum:"2026-10-20",uhrzeit:"09:00",wiederholung:{takt:"taeglich",intervall:1,bis:"2026-10-23",anzahl:null}},verpasst:{regel:"nachholen",grenzeMinuten:30}}});
    expect(e.statusCode,e.body).toBe(201);return{kontoId,email,password,headers,ko,e:e.json().erinnerung};
  }
  const faellig=(tag="20")=>vi.setSystemTime(new Date(`2026-10-${tag}T07:01:00Z`));
  it.each(["pause","laufabbruch","quellentzug"] as const)("%s an tatsächlicher zweiter Verbindung unmittelbar vor Norm-SQL verhindert jeden Beleg und Bericht",async(art)=>{
    const f=await fall();vorNorm=async()=>{
      if(art==="pause"){
        const r=await andereApp.inject({method:"POST",url:`/api/me/klara/erinnerungen/${f.e.id}/status`,headers:f.headers,payload:{fassung:f.e.fassung,aktion:"pausieren"}});
        expect(r.statusCode,r.body).toBe(200);
      }else if(art==="quellentzug")await andere.ko.setQuellrechte(f.ko.id,{stufe:"intern",leser:[]},f.kontoId);
      else{
        const [l]=await andere.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id,20);if(!l)throw new Error("Gehaltener Lauf fehlt");
        expect(await andere.klaraErinnerungen.brecheLaufAb?.(f.kontoId,f.e.id,l.vorkommenId,f.e.fassung,Date.now(),andere.klaraNotizen)).toBe(true);
      }
    };faellig();await lauf();expect(sqlErgebnisse.length).toBeGreaterThan(0);expect(sqlErgebnisse.every(r=>r===false)).toBe(true);
    expect(await andere.klaraFristen.hole(f.kontoId)).toBeNull();expect(await andere.klaraNotizen.liste(f.kontoId,{woerter:[],art:null,limit:100})).toEqual([]);
    if(art==="quellentzug")expect((await andere.klaraErinnerungen.erinnerungen.hole(f.kontoId,f.e.id))?.erinnerung.status).toBe("pausiert");
    const meldungen=await andere.klaraErinnerungen.meldungen.fuerKonto(f.kontoId,20);
    if(art==="quellentzug") {
      expect(meldungen).toEqual([expect.objectContaining({art:"handlung",laufStatus:"fehlgeschlagen",grund:"quelle_geaendert"})]);
      expect(JSON.stringify(meldungen)).not.toContain(TEXT);
    } else expect(meldungen).toEqual([]);
  });
  it("neuer Pool/App/Anmeldung führt denselben ausdrücklich gespeicherten Watchauftrag mit späterem Publikationsbeleg in derselben Geschichte fort",async()=>{
    const f=await fall();faellig();await lauf();const vorher=await andere.klaraFristen.hole(f.kontoId);
    expect(vorher?.normereignisse).toHaveLength(1);expect(vorher?.normereignisse?.[0]?.ereignisse).toHaveLength(1);
    const neuerPool=createPool(pool.options.connectionString as string);const neu=buildPgServices(neuerPool);let neuerLauf:(()=>Promise<KlaraErinnerungLaufbericht>)|undefined;
    const neueApp=buildApp(neu,{klaraErinnerungen:fn=>{neuerLauf=fn;return 65_000;}});
    try{await neueApp.ready();const login=await neueApp.inject({method:"POST",url:"/api/auth/login",payload:{email:f.email,password:f.password}});
      expect(login.statusCode,login.body).toBe(200);const headers={authorization:`Bearer ${login.json().token}`};
      const original=(await neueApp.inject({url:`/api/me/klara/erinnerungen/${f.e.id}`,headers})).json().erinnerung;
      expect(original.routine.wissenspflege.normbekanntmachungen).toBe("belege_vorbereiten");
      await neu.ko.revise(f.ko.id,{statement:TEXT.replace("; Geltung","; Veröffentlichung am 2026-11-02; Geltung")},f.kontoId);
      faellig("21");if(!neuerLauf)throw new Error("Vorhandener Laufcallback fehlt");await neuerLauf();
      const nachher=await neu.klaraFristen.hole(f.kontoId);expect(nachher?.normereignisse).toHaveLength(1);
      expect(nachher?.normereignisse?.[0]?.id).toBe(vorher?.normereignisse?.[0]?.id);
      expect(nachher?.normereignisse?.[0]?.ereignisse.map(e=>e.art)).toEqual(["angekuendigt","veroeffentlicht"]);
      await neuerLauf();expect(await neu.klaraFristen.hole(f.kontoId)).toEqual(nachher);
      expect(await neu.klaraNotizen.liste(f.kontoId,{woerter:[],art:null,limit:100})).toHaveLength(1);
    }finally{await neueApp.close();await neuerPool.end();}
  });
});
