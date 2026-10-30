import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraDNormAuftragsPort } from "../../services/app/src/klara-d-normauftrag-vertrag";
import type { FristenQuelle } from "../../services/app/src/klara-fristen-erkennung";
import { KlaraFristenQuellen } from "../../services/app/src/klara-fristen-quellen";
import { erkenneNormBekanntmachung } from "../../services/app/src/klara-normereignisse";
import { KlaraNormereignisDienst } from "../../services/app/src/klara-normereignisse-dienst";
import { KlaraNotizDienst } from "../../services/app/src/klara-notiz";
import { neuesKonto } from "../klara-quellen-nutzerweg/kette";

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const negative = [
  "kein Inkrafttreten am 2027-01-01",
  "keine Veröffentlichung am 2027-01-01",
  "von keiner Veröffentlichung am 2027-01-01 auszugehen",
  "bei keinem Inkrafttreten am 2027-01-01",
  "Inkrafttreten am 2027-01-01 ausgesetzt",
  "Inkrafttreten am 2027-01-01 entfällt",
  "Übergangsfrist bis 2027-01-01 verschoben",
  "Veröffentlichung am 2027-01-01 ist entfallen",
];

describe("FNR-4: eigene Normereignis-Negation und Entfall", () => {
  it.each(negative)("%s bleibt im echten Dienst ohne Prüfnotiz und G-Eingang", async (satz) => {
    const s = buildServices();
    app = buildApp(s);
    await app.ready();
    const admin = await neuesKonto(app, "fnr4-admin");
    const ich = await neuesKonto(app, "fnr4-expert", admin);
    const kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
    const quelle = await s.ko.create({
      title: "Fiktive begrenzte Normbekanntmachung",
      statement: `Norm N-17 v2: ${satz}; Geltung: Werk A.`,
      type: "technik",
      category: "Synthetische Normprüfung",
      author: kontoId,
      confidentiality: "intern",
    });
    const eingang = vi.fn(async () => {
      throw new Error("Kein G-Eingang für ungeklärtes Datum");
    });
    const original = vi.fn(async () => {
      throw new Error("Kein G-Original für ungeklärtes Datum");
    });
    const ausfuehren = vi.fn(async () => {
      throw new Error("Keine G-Anlage für ungeklärtes Datum");
    });
    const port: KlaraDNormAuftragsPort = { eingang, original, ausfuehren };
    const dienst = new KlaraNormereignisDienst({
      repo: s.klaraFristen,
      auth: s.auth,
      ko: s.ko,
      belege: s.audit,
      aufgaben: s.klaraAufgaben,
      gespraeche: s.klaraGespraeche,
      pruefNotizen: new KlaraNotizDienst({ repo: s.klaraNotizen, gespraeche: s.klaraGespraeche }),
      normPruefauftrag: () => port,
      quellen: new KlaraFristenQuellen({
        auth: s.auth,
        ko: s.ko,
        notizen: s.klaraNotizen,
        gespraeche: s.klaraGespraeche,
        spaces: s.spaces,
      }),
    });
    const v = await dienst.beobachten(
      kontoId,
      [quelle.id],
      { gilt: () => true, sql: () => ({ und: ["true"], params: [] }) },
      {
        erinnerungId: "fiktive-bestellte-routine",
        erinnerungFassung: 1,
        routineFassung: 1,
        vorkommenId: "fiktives-gehaltenes-vorkommen",
        besitzer: "fiktiver-eigener-ausfuehrer",
        pruefeAktuell: async () => {},
      },
    );
    expect(v.ereignisse).toHaveLength(1);
    const normen = (await s.klaraFristen.hole(kontoId))?.normereignisse ?? [];
    expect(normen).toHaveLength(1);
    expect(normen[0]?.annahmen).toEqual([]);
    expect(normen[0]?.ereignisse).toHaveLength(1);
    const e = normen[0]?.ereignisse[0];
    expect(e?.datum).toBeNull();
    expect(e?.belege[0]?.datum).toBeNull();
    expect(e?.belege[0]?.klaerung.join()).toContain("unbestätigt");
    expect(e?.pruefeingang).toBeUndefined();
    expect(e?.pruefauftrag).toBeUndefined();
    expect(eingang).not.toHaveBeenCalled();
    expect(original).not.toHaveBeenCalled();
    expect(ausfuehren).not.toHaveBeenCalled();
    expect(await s.klaraNotizen.liste(kontoId, { woerter: [], art: null, limit: 100 })).toEqual([]);
    expect(await s.klaraAufgaben.liste(kontoId, null, 100)).toEqual([]);
  });

  it.each([
    ["Veröffentlichung am 2026-11-01; kein Inkrafttreten am 2027-01-01", "veroeffentlicht"],
    ["kein Inkrafttreten am 2027-01-01; Veröffentlichung am 2026-11-01", "veroeffentlicht"],
    ["Inkrafttreten am 2026-11-01; keine Veröffentlichung am 2027-01-01", "inkrafttreten"],
    ["keine Veröffentlichung am 2027-01-01; Inkrafttreten am 2026-11-01", "inkrafttreten"],
  ] as const)("getrennte Nachbarbelege: %s", (satz, positiveArt) => {
    const text = `Vorbemerkung\nNorm N-17 v2: ${satz}; Geltung: Werk A.`;
    const quelle: FristenQuelle = {
      art: "notiz",
      id: "synthetische-nachbarn",
      fassung: "1",
      belegId: "notiz:nachbarn",
      text,
      verantwortlich: null,
    };
    const n = erkenneNormBekanntmachung(quelle, true, "2026-10-30T00:00:00.000Z").geschichten[0];
    expect(n?.ereignisse).toHaveLength(2);
    const positiv = n?.ereignisse.find((e) => e.art === positiveArt);
    const negiert = n?.ereignisse.find((e) => e.art !== positiveArt);
    if (!positiv || !negiert) throw new Error("Getrennte Ereignisse fehlen");
    expect(positiv.datum).toBe("2026-11-01");
    expect(positiv.geltung).toBe("Werk A");
    expect(positiv.belege[0]?.klaerung).toEqual([]);
    expect(negiert.datum).toBeNull();
    expect(negiert.belege[0]?.datum).toBeNull();
    expect(negiert.belege[0]?.klaerung.join()).toContain("unbestätigt");
    for (const e of n?.ereignisse ?? []) {
      for (const b of e.belege) {
        const marker = e.art === "veroeffentlicht" ? "Veröffentlichung" : "Inkrafttreten";
        expect(b.ereignis.von).toBe(text.indexOf(marker));
        expect(b.ereignis.wortlaut).toContain(e.datum ?? "2027-01-01");
        expect(b.norm.von).toBe(text.indexOf("Norm N-17 v2"));
        expect(b.geltung?.von).toBe(text.indexOf("Geltung: Werk A"));
        for (const f of [b.norm, b.ereignis, b.geltung]) {
          if (!f) throw new Error("Originalfundstelle fehlt");
          expect(text.slice(f.von, f.bis)).toBe(f.wortlaut);
        }
      }
    }
  });
});
