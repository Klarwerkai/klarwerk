import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type {
  KlaraDNormAuftragsEingabe,
  KlaraDNormAuftragsPort,
} from "../../services/app/src/klara-d-normauftrag-vertrag";
import { KlaraFristenQuellen } from "../../services/app/src/klara-fristen-quellen";
import {
  KlaraNormereignisDienst,
  type NormFolgeversuch,
} from "../../services/app/src/klara-normereignisse-dienst";
import { KlaraNotizDienst } from "../../services/app/src/klara-notiz";
import { neuesKonto } from "../klara-quellen-nutzerweg/kette";

let app: FastifyInstance;
let s: ReturnType<typeof buildServices>;
let kontoId: string;
let gespraechId: string;
let quelleId: string;
let notizen: KlaraNotizDienst;
let erlaubt: boolean;
const lauf = {
  gilt: () => erlaubt,
  sql: () => ({ und: [erlaubt ? "true" : "false"], params: [] }),
};
const text = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const abdruck = "fiktiver-aber-serverseitiger-G-Abdruck";
const versuch = (): NormFolgeversuch => ({
  erinnerungId: "bestellte-routine",
  erinnerungFassung: 1,
  routineFassung: 1,
  vorkommenId: "gehaltenes-vorkommen",
  besitzer: "eigener-ausfuehrer",
  pruefeAktuell: async () => {
    if (!erlaubt) throw new Error("Zusatzbestellung oder Lauf wurde entzogen");
  },
});
beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  erlaubt = true;
  s = buildServices();
  app = buildApp(s, { klaraErinnerungen: () => 65_000 });
  await app.ready();
  const admin = await neuesKonto(app, "folgeport-admin");
  const ich = await neuesKonto(app, "folgeport-expert", admin);
  kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
  // Wirkliches eigenes leeres Testgespräch; die neue G-Setupnaht selbst ist hier ein Vertragsdouble.
  const g = await app.inject({
    method: "POST",
    url: "/api/me/klara/gespraeche",
    headers: ich.kopf,
    payload: {
      objektbezug: {
        pfad: "/kalender",
        seitenName: "Mein Kalender",
        objekt: "Fiktive Normprüfung",
      },
    },
  });
  expect(g.statusCode, g.body).toBe(201);
  gespraechId = g.json().gespraech.id;
  expect(g.json().gespraech.nachrichten).toEqual([]);
  quelleId = (
    await s.ko.create({
      title: "Fiktive begrenzte Normquelle",
      statement: text,
      type: "technik",
      category: "Synthetische Portprüfung",
      author: kontoId,
      confidentiality: "intern",
    })
  ).id;
  notizen = new KlaraNotizDienst({ repo: s.klaraNotizen, gespraeche: s.klaraGespraeche });
});
afterEach(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
function dienst(port?: KlaraDNormAuftragsPort) {
  return new KlaraNormereignisDienst({
    repo: s.klaraFristen,
    auth: s.auth,
    ko: s.ko,
    belege: s.audit,
    aufgaben: s.klaraAufgaben,
    gespraeche: s.klaraGespraeche,
    pruefNotizen: notizen,
    normPruefauftrag: () => port,
    quellen: new KlaraFristenQuellen({
      auth: s.auth,
      ko: s.ko,
      notizen: s.klaraNotizen,
      gespraeche: s.klaraGespraeche,
      spaces: s.spaces,
    }),
  });
}
function portDouble(vorAdmission?: (eingabe: KlaraDNormAuftragsEingabe) => Promise<void>) {
  let anlagen = 0;
  const port: KlaraDNormAuftragsPort = {
    async eingang(e, k) {
      const voll = { ...e, gespraechId };
      await vorAdmission?.(voll);
      await k.pruefe({ phase: "anlegen", eingabe: voll, abdruck, original: null });
      return voll;
    },
    async original(e, k) {
      await k.pruefe({ phase: "lesen", eingabe: e, abdruck, original: null });
      return null;
    },
    async ausfuehren(e, k) {
      await k.pruefe({ phase: "anlegen", eingabe: e, abdruck, original: null });
      anlagen++;
      throw new Error(
        "Kontrollierter Antwortverlust an der G-Vertragsgrenze; keine echte G-Aufgabe in diesem Double",
      );
    },
  };
  return { port, anlagen: () => anlagen };
}

describe("AW21 · D-Normeingang vor dem G-Port (Vertragsdouble, kein G-Ausführungsnachweis)", () => {
  it("fehlender Getter lässt den freigegebenen Normbelegwatch ohne zusätzliche Notiz oder Aufgabe wirksam", async () => {
    const v = await dienst().beobachten(kontoId, [quelleId], lauf, versuch());
    expect(v.folgepruefung).toEqual({ stand: "nicht_verfuegbar" });
    expect((await s.klaraFristen.hole(kontoId))?.normereignisse).toHaveLength(1);
    expect(await s.klaraNotizen.liste(kontoId, { woerter: [], art: null, limit: 100 })).toEqual([]);
    expect(await s.klaraAufgaben.liste(kontoId, null, 100)).toEqual([]);
  });
  it("kanonischer Eingang und G-Abdruck sind vor G-Anlage gespeichert; erneuter unklarer Ausgang erlaubt keinen Ersatz", async () => {
    const f = portDouble();
    await expect(dienst(f.port).beobachten(kontoId, [quelleId], lauf, versuch())).rejects.toThrow(
      "Kontrollierter Antwortverlust",
    );
    const e = (await s.klaraFristen.hole(kontoId))?.normereignisse?.[0]?.ereignisse[0];
    expect(e?.pruefeingang).toMatchObject({
      eingabe: { kontoId, gespraechId, pruefVorgang: e?.pruefVorgang },
      abdruck,
    });
    expect(e?.pruefauftrag).toBeUndefined();
    expect(f.anlagen()).toBe(1);
    await expect(
      dienst(f.port).beobachten(kontoId, [quelleId], lauf, versuch()),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.anlagen()).toBe(1);
    expect(
      await s.klaraNotizen.liste(kontoId, { woerter: [], art: null, limit: 100 }),
    ).toHaveLength(1);
  });
  it.each(["auftrag", "quellfassung", "quellrechte", "notizfassung"] as const)(
    "%s vor Admission verhindert den kanonischen Eingang und jede G-Anlage",
    async (art) => {
      const f = portDouble(async (e) => {
        if (art === "auftrag") erlaubt = false;
        else if (art === "quellfassung")
          await s.ko.revise(
            quelleId,
            { statement: text.replace("2026-11-01", "2026-12-01") },
            kontoId,
          );
        else if (art === "quellrechte")
          await s.ko.setQuellrechte(quelleId, { stufe: "intern", leser: [] }, kontoId);
        else
          await notizen.aendere(kontoId, e.notiz.id, {
            fassung: e.notiz.fassung,
            inhalt: "Fiktive inzwischen bearbeitete andere Notiz.",
          });
      });
      await expect(
        dienst(f.port).beobachten(kontoId, [quelleId], lauf, versuch()),
      ).rejects.toThrow();
      expect(f.anlagen()).toBe(0);
      expect(
        (await s.klaraFristen.hole(kontoId))?.normereignisse?.[0]?.ereignisse[0]?.pruefeingang,
      ).toBeUndefined();
    },
  );
});
