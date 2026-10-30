import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraDNormAuftragsPort } from "../../services/app/src/klara-d-normauftrag-vertrag";
import type { FristenQuelle } from "../../services/app/src/klara-fristen-erkennung";
import { KlaraFristenQuellen } from "../../services/app/src/klara-fristen-quellen";
import {
  erkenneNormBekanntmachung,
  vereinigeNormgeschichten,
} from "../../services/app/src/klara-normereignisse";
import { KlaraNormereignisDienst } from "../../services/app/src/klara-normereignisse-dienst";
import { KlaraNotizDienst } from "../../services/app/src/klara-notiz";
import { neuesKonto } from "../klara-quellen-nutzerweg/kette";

const AM = "2026-10-30T00:00:00.000Z";
const quelle = (text: string, id = "synthetische-ausgabe"): FristenQuelle => ({
  art: "notiz",
  id,
  fassung: "1",
  belegId: `notiz:${id}`,
  text,
  verantwortlich: null,
});
let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("FNR-4: eine Normausgabe braucht ein ausdrückliches Versionspräfix", () => {
  it.each(["vom", "verbindlich", "vorläufig", "vorrangig"])(
    "%s ist keine Ausgabe und begründet keine Normereignisse",
    (wort) => {
      const text = `Norm N-17 ${wort} 2026-11-01: Veröffentlichung am 2026-12-01; Geltung: Werk A.`;
      expect(erkenneNormBekanntmachung(quelle(text), true, AM).geschichten).toEqual([]);
    },
  );

  it.each([
    ["v2", "2"],
    ["v2.1", "2.1"],
    ["Ausgabe 2.1", "2.1"],
    ["Ausgabe B-2027", "B-2027"],
  ])("%s behält Identität, eigene Ereignisbelege und Kopiestabilität", (label, ausgabe) => {
    const normwort = `Norm N-17 ${label}`;
    const text = `Vorbemerkung\n${normwort}: Ankündigung am 2026-11-01; Veröffentlichung am 2026-12-01; Inkrafttreten am 2027-01-01; Übergangsfrist bis 2027-06-30; Geltung: Werk A.`;
    const r = erkenneNormBekanntmachung(quelle(text), true, AM);
    expect(r.geschichten).toHaveLength(1);
    const n = r.geschichten[0];
    if (!n) throw new Error("Belegte Normausgabe fehlt");
    expect(n).toMatchObject({ kennung: "N-17", ausgabe, annahmen: [] });
    const explizit = erkenneNormBekanntmachung(
      quelle(text.replace(normwort, `Norm N-17 Ausgabe ${ausgabe}`)),
      true,
      AM,
    );
    expect(n.id).toBe(explizit.geschichten[0]?.id);
    expect(n.ereignisse.map((e) => [e.art, e.datum, e.geltung])).toEqual([
      ["angekuendigt", "2026-11-01", "Werk A"],
      ["veroeffentlicht", "2026-12-01", "Werk A"],
      ["inkrafttreten", "2027-01-01", "Werk A"],
      ["uebergangsfrist", "2027-06-30", "Werk A"],
    ]);
    const marker = ["Ankündigung", "Veröffentlichung", "Inkrafttreten", "Übergangsfrist"];
    for (const [i, e] of n.ereignisse.entries()) {
      expect(e.belege).toHaveLength(1);
      const b = e.belege[0];
      if (!b) throw new Error("Eigener Ereignisbeleg fehlt");
      expect(b.norm).toEqual({
        von: text.indexOf(normwort),
        bis: text.indexOf(normwort) + normwort.length,
        wortlaut: normwort,
      });
      expect(b.ereignis.von).toBe(text.indexOf(marker[i] ?? "fehlender Marker"));
      expect(b.datum).toBe(e.datum);
      expect(b.klaerung).toEqual([]);
      expect(b.geltung?.von).toBe(text.indexOf("Geltung: Werk A"));
      for (const f of [b.norm, b.ereignis, b.geltung]) {
        if (!f) throw new Error("Originalfundstelle fehlt");
        expect(text.slice(f.von, f.bis)).toBe(f.wortlaut);
      }
    }
    const kopie = erkenneNormBekanntmachung(quelle(text, "synthetische-kopie"), true, AM);
    const vereinigt = vereinigeNormgeschichten(
      vereinigeNormgeschichten(r.geschichten, r.geschichten),
      kopie.geschichten,
    );
    expect(vereinigt).toHaveLength(1);
    expect(vereinigt[0]?.id).toBe(n.id);
    expect(vereinigt[0]?.ereignisse.map((e) => [e.id, e.pruefVorgang])).toEqual(
      n.ereignisse.map((e) => [e.id, e.pruefVorgang]),
    );
    expect(vereinigt[0]?.ereignisse.map((e) => e.belege.length)).toEqual([2, 2, 2, 2]);
  });

  it("v2.1 übernimmt weder das Nachbardatum noch eine unbelegte Geltung", () => {
    const r = erkenneNormBekanntmachung(
      quelle("Norm N-17 v2.1: Ankündigung am 2026-11-01; Inkrafttreten."),
      true,
      AM,
    );
    expect(r.geschichten[0]?.ereignisse.map((e) => [e.datum, e.geltung])).toEqual([
      ["2026-11-01", null],
      [null, null],
    ]);
  });

  it("Authaufbau → Normdienst → HTTP-Leser: Falschwörter erzeugen keine Folgearbeit", async () => {
    const s = buildServices();
    app = buildApp(s);
    await app.ready();
    const admin = await neuesKonto(app, "ausgabe-admin");
    const ich = await neuesKonto(app, "ausgabe-expert", admin);
    const me = await app.inject({ url: "/api/auth/me", headers: ich.kopf });
    expect(me.statusCode, me.body).toBe(200);
    const kontoId = me.json().id;
    const ids: string[] = [];
    for (const wort of ["vom", "verbindlich"]) {
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: admin.kopf,
        payload: {
          title: `Fiktive begrenzte Bekanntmachung ${wort}`,
          statement: `Norm N-17 ${wort} 2026-11-01: Inkrafttreten am 2027-01-01; Geltung: Werk A.`,
          type: "technik",
          category: "Synthetische Normprüfung",
          confidentiality: "intern",
        },
      });
      expect(angelegt.statusCode, angelegt.body).toBe(201);
      ids.push(angelegt.json().id);
    }
    const eingang = vi.fn(async () => {
      throw new Error("Kein G-Eingang ohne belegte Normausgabe");
    });
    const original = vi.fn(async () => {
      throw new Error("Kein G-Original ohne belegte Normausgabe");
    });
    const ausfuehren = vi.fn(async () => {
      throw new Error("Keine G-Anlage ohne belegte Normausgabe");
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
    expect(await s.klaraFristen.hole(kontoId)).toBeNull();
    const v = await dienst.beobachten(
      kontoId,
      ids,
      { gilt: () => true, sql: () => ({ und: ["true"], params: [] }) },
      {
        erinnerungId: "fiktive-bestellte-ausgaberoutine",
        erinnerungFassung: 1,
        routineFassung: 1,
        vorkommenId: "fiktives-gehaltenes-vorkommen",
        besitzer: "fiktiver-eigener-ausfuehrer",
        pruefeAktuell: async () => {},
      },
    );
    expect(v.ereignisse).toEqual([]);
    expect(await s.klaraFristen.hole(kontoId)).toBeNull();
    for (const [pfad, feld] of [
      ["normereignisse", "normen"],
      ["notizen", "notizen"],
      ["aufgaben", "aufgaben"],
    ] as const) {
      const gelesen = await app.inject({ url: `/api/me/klara/${pfad}`, headers: ich.kopf });
      expect(gelesen.statusCode, gelesen.body).toBe(200);
      expect(gelesen.json()[feld]).toEqual([]);
    }
    expect(eingang).not.toHaveBeenCalled();
    expect(original).not.toHaveBeenCalled();
    expect(ausfuehren).not.toHaveBeenCalled();
  });
});
