import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { lokalVon } from "../../services/app/src/klara-erinnerung-zeit";
import type { PflegeVorlage } from "../../services/app/src/klara-wissenspflege";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";

let app: FastifyInstance;
let services: ReturnType<typeof buildServices>;
let ich: Konto;
let admin: Konto;
let lauf: () => Promise<KlaraErinnerungLaufbericht>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T06:59:00.000Z"));
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  services = buildServices();
  app = buildApp(services, {
    klaraErinnerungen: (fn) => {
      lauf = fn;
      return 65_000;
    },
  });
  await app.ready();
  admin = await neuesKonto(app, "pflege-admin");
  ich = await neuesKonto(app, "pflege-expert", admin);
});
afterEach(async () => {
  await app?.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function wissen() {
  const me = await app.inject({ url: "/api/auth/me", headers: ich.kopf });
  return services.ko.create({
    title: "Fiktive Anleitung A-4",
    statement: "Synthetische Pflegequelle.",
    type: "technik",
    category: "Fiktive Routinenprobe",
    author: me.json().id,
    confidentiality: "intern",
  });
}
function auftrag(vorlage: PflegeVorlage, id: string) {
  return { vorlage, quellen: [id] };
}
async function einrichten(vorlage: PflegeVorlage, id: string) {
  const l = lokalVon(Date.now() + 60_000, "Europe/Berlin");
  const r = await app.inject({
    method: "POST",
    url: "/api/me/klara/erinnerungen",
    headers: ich.kopf,
    payload: {
      vorgang: `pflege-server-${crypto.randomUUID()}`,
      titel: "Fiktive Wissenspflege",
      aktion: "routine_bericht",
      zeitzone: "Europe/Berlin",
      zeitplan: { art: "einmalig", datum: l.datum, uhrzeit: l.uhrzeit },
      routine: { wissenspflege: auftrag(vorlage, id) },
      verpasst: { regel: "nachholen", grenzeMinuten: 30 },
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().erinnerung;
}

describe("AW20 · tatsächlicher autorisierter Produktanschluss", () => {
  it.each(["offene_pruefungen", "aktualitaet", "quellaenderung"] as const)(
    "%s liest aktuelle KO-/Lebenszyklusdaten und erzeugt erst im bestehenden Lauf ein Originalergebnis",
    async (vorlage) => {
      const ko = await wissen();
      await services.lifecycle.requestRevalidation(ko.id, ko.author);
      const v = await app.inject({
        method: "POST",
        url: "/api/me/klara/erinnerungen/wissenspflege/vorschau",
        headers: ich.kopf,
        payload: { wissenspflege: auftrag(vorlage, ko.id) },
      });
      expect(v.statusCode, v.body).toBe(200);
      expect(v.json().wirkung).toBe("keine");
      expect(
        (await app.inject({ url: "/api/me/klara/erinnerungen", headers: ich.kopf })).json()
          .erinnerungen,
      ).toEqual([]);
      const e = await einrichten(vorlage, ko.id);
      expect(
        (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json().notizen,
      ).toEqual([]);
      if (vorlage === "quellaenderung")
        await services.ko.revise(
          ko.id,
          { statement: "Tatsächlicher synthetischer zweiter Quellstand." },
          ko.author,
        );
      vi.setSystemTime(Date.now() + 120_000);
      await lauf();
      const n = (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json()
        .notizen;
      expect(n).toHaveLength(1);
      expect(n[0].inhalt).toContain("Fiktive Anleitung A-4");
      expect(n[0].inhalt).toContain("Dies bestätigt keine fachliche Gültigkeit");
      const result = (await app.inject({ url: "/api/me/klara/erinnerungen", headers: ich.kopf }))
        .json()
        .erinnerungen.find((x: { id: string }) => x.id === e.id);
      expect(result.laeufe[0].ergebnis.routine).toMatchObject({
        notizId: n[0].id,
        wissenspflege: { stand: "vorbereitet", vorlage },
      });
      await lauf();
      expect(
        (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json().notizen,
      ).toHaveLength(1);
      expect(await services.lifecycle.revalidierungAnstehtFuer([ko.id])).toEqual(new Set([ko.id]));
    },
  );

  it("heutiger Quellrechteentzug verhindert vorbereiteten Text und pausiert den vorhandenen Auftrag", async () => {
    const ko = await wissen();
    const e = await einrichten("aktualitaet", ko.id);
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [] }, ko.author);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/me/klara/erinnerungen/wissenspflege/vorschau",
          headers: ich.kopf,
          payload: { wissenspflege: auftrag("aktualitaet", ko.id) },
        })
      ).statusCode,
    ).toBe(404);
    vi.setSystemTime(Date.now() + 120_000);
    await lauf();
    expect(
      (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json().notizen,
    ).toEqual([]);
    const r = (await app.inject({ url: "/api/me/klara/erinnerungen", headers: ich.kopf })).json()
      .erinnerungen[0];
    expect(r.id).toBe(e.id);
    expect(r.status).toBe("pausiert");
    expect(r.laeufe[0].ergebnis.wissenspflege.stand).toBe("ungeprueft");
    expect(await services.klaraErinnerungen.meldungen.fuerKonto(ko.author, 20)).toEqual([]);
  });

  it("Vorschau braucht eigene aktuelle Sitzung und Quelle; kein fremder Empfänger oder fremde Auftragsschreibwirkung", async () => {
    const ko = await wissen();
    const payload = { wissenspflege: auftrag("aktualitaet", ko.id) };
    const url = "/api/me/klara/erinnerungen/wissenspflege/vorschau";
    expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(401);
    const fremd = await app.inject({
      method: "POST",
      url,
      headers: ich.kopf,
      payload: { wissenspflege: { ...payload.wissenspflege, empfaenger: "fremde-person" } },
    });
    expect(fremd.statusCode).toBe(400);
    const e = await einrichten("aktualitaet", ko.id);
    const uebergriff = await app.inject({
      method: "POST",
      url: `/api/me/klara/erinnerungen/${e.id}/routine`,
      headers: admin.kopf,
      payload: {
        fassung: e.fassung,
        routine: { wissenspflege: payload.wissenspflege },
        anwenden: true,
      },
    });
    expect(uebergriff.statusCode).toBe(404);
    const aenderung = await app.inject({
      method: "POST",
      url: `/api/me/klara/erinnerungen/${e.id}/routine`,
      headers: ich.kopf,
      payload: {
        fassung: e.fassung,
        routine: { wissenspflege: auftrag("offene_pruefungen", ko.id) },
        anwenden: true,
      },
    });
    expect(aenderung.statusCode, aenderung.body).toBe(200);
    expect(aenderung.json().erinnerung.routine).toMatchObject({
      fassung: 2,
      wissenspflege: { vorlage: "offene_pruefungen" },
    });
    expect(
      (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json().notizen,
    ).toEqual([]);
  });
});
