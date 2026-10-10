// ================================================================================================
// R-0710 (aufnahme:20260922:gesamt-webhooks) — WISSENSEREIGNISSE KONTROLLIERT AN FREMDWERKZEUGE.
// ================================================================================================
//
// „Andere Werkzeuge werden von selbst benachrichtigt, sobald ein Wissensobjekt validiert wurde,
// abgelaufen ist oder ein Widerspruch offen steht."
//
// UNGEMOCKT: echte `buildServices()`-Verdrahtung — Validierung, Lebenszyklus, Widersprüche und die
// Auditkette sind die echten Dienste. Eingesetzt ist nur der Zusteller (Fälle A–H); Fall I stellt
// über den echten `fetch` an einen echten HTTP-Empfänger auf 127.0.0.1 zu.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  AKTION_ABGEBROCHEN,
  AKTION_ERKANNT,
  AKTION_GESCHEITERT,
  AKTION_GRUNDSTAND,
  AKTION_VERSUCH,
  AKTION_ZUGESTELLT,
  EREIGNIS_HEADER,
  KENNUNG_HEADER,
  MAX_VERSUCHE,
  type Meldung,
  SIGNATUR_HEADER,
  type WebhookZiel,
  WissensereignisMelder,
  type ZustellAnfrage,
  ladeWebhookZiele,
  resolveWebhookTaktMs,
  signiere,
} from "../../services/app/src/wissensereignisse";

const GEHEIMNIS = "geheimnis-0123456789abcdef0123456789abcdef";

const ALLE: WebhookZiel = {
  id: "werkzeug",
  url: "https://werkzeug.example/hook",
  ereignisse: ["wissen.validiert", "wissen.revalidierung_faellig", "widerspruch.offen"],
  geheimnis: GEHEIMNIS,
};

async function bestand(): Promise<AppServices> {
  const services = buildServices();
  await buildApp(services).ready();
  return services;
}

async function anlegen(services: AppServices, titel: string): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: `${titel}: vertraulicher Inhalt, der nie in einer Meldung stehen darf.`,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  } as never);
  return ko.id;
}

function melderFuer(
  services: AppServices,
  ziele: readonly WebhookZiel[],
  antwort: (a: ZustellAnfrage) => number | null | Promise<number | null> = () => 204,
) {
  const gesendet: ZustellAnfrage[] = [];
  const melder = new WissensereignisMelder({
    quellen: {
      wissensobjekte: () => services.ko.list({}),
      revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
      offeneWidersprueche: () => services.conflicts.unresolved(),
      wissensobjekt: (id) => services.ko.get(id),
    },
    audit: services.audit,
    ziele,
    zusteller: async (anfrage) => {
      gesendet.push(anfrage);
      return { status: await antwort(anfrage) };
    },
  });
  return { melder, gesendet };
}

const rumpf = (a: ZustellAnfrage): Meldung => JSON.parse(a.body) as Meldung;

describe("R-0710 · Wissensereignisse an Fremdwerkzeuge", () => {
  it("A · der vorgefundene Bestand ist Grundstand und wird nicht gemeldet", async () => {
    const services = await bestand();
    const alt = await anlegen(services, "Altbestand");
    await services.validation.adminValidate(alt, "admin");
    const { melder, gesendet } = melderFuer(services, [ALLE]);

    const lauf = await melder.lauf();

    expect(lauf.erkannt).toBe(0);
    expect(gesendet).toEqual([]);
    const grundstand = await services.audit.list({ action: AKTION_GRUNDSTAND });
    expect(grundstand).toHaveLength(1);
    expect(grundstand[0]?.payload.kennungen).toContain(`wissen.validiert:${alt}:1`);
  });

  it("B · Validierung danach: genau eine signierte Meldung, nur Kennungen, kein Inhalt", async () => {
    const services = await bestand();
    const { melder, gesendet } = melderFuer(services, [ALLE]);
    await melder.lauf();

    const id = await anlegen(services, "Ventil X schließen");
    const offen = await melder.lauf();
    expect(offen.erkannt).toBe(0);

    await services.validation.adminValidate(id, "admin");
    const lauf = await melder.lauf();

    expect(lauf).toMatchObject({ erkannt: 1, zugestellt: 1, ausstehend: 0 });
    expect(gesendet).toHaveLength(1);
    const [anfrage] = gesendet;
    if (!anfrage) {
      throw new Error("keine Zustellung");
    }
    expect(anfrage.url).toBe(ALLE.url);
    expect(anfrage.headers[EREIGNIS_HEADER]).toBe("wissen.validiert");
    expect(anfrage.headers[KENNUNG_HEADER]).toBe(`wissen.validiert:${id}:1`);
    const meldung = rumpf(anfrage);
    expect(meldung).toMatchObject({
      format: "klarwerk-wissensereignis",
      formatVersion: 1,
      ereignis: "wissen.validiert",
      kennung: `wissen.validiert:${id}:1`,
      wissensobjekt: { id, version: 1 },
    });
    // Kein Titel, keine Aussage, kein Geheimnis im Rumpf.
    expect(anfrage.body).not.toContain("Ventil");
    expect(anfrage.body).not.toContain("vertraulicher Inhalt");
    expect(anfrage.body).not.toContain(GEHEIMNIS);
    // Die Signatur lässt sich mit dem Geheimnis des Ziels nachrechnen.
    const t = Number(/^t=(\d+),/.exec(anfrage.headers[SIGNATUR_HEADER] ?? "")?.[1]);
    expect(anfrage.headers[SIGNATUR_HEADER]).toBe(signiere(GEHEIMNIS, t, anfrage.body));
    expect(anfrage.headers[SIGNATUR_HEADER]).not.toBe(signiere("anderes", t, anfrage.body));

    // Erkennung und Zustellung stehen im Prüfprotokoll.
    expect(await services.audit.list({ action: AKTION_ERKANNT, target: id })).toHaveLength(1);
    const zugestellt = await services.audit.list({ action: AKTION_ZUGESTELLT, target: id });
    expect(zugestellt[0]?.payload).toMatchObject({ ziel: "werkzeug", status: 204, versuche: 1 });

    // Ein weiterer Takt meldet dasselbe nicht noch einmal.
    expect((await melder.lauf()).erkannt).toBe(0);
    expect(gesendet).toHaveLength(1);
  });

  it("C · fällige Revalidierung und offener Widerspruch werden gemeldet", async () => {
    const services = await bestand();
    const a = await anlegen(services, "Pumpe A");
    const b = await anlegen(services, "Pumpe B");
    const { melder, gesendet } = melderFuer(services, [ALLE]);
    await melder.lauf();

    await services.lifecycle.couple("ANL-7", a);
    await services.lifecycle.assetChanged("ANL-7");
    const konflikt = await services.conflicts.create(
      { koA: a, koB: b, type: "truth", description: "Drehzahl widerspricht sich." },
      "anna",
    );
    await melder.lauf();

    const ereignisse = gesendet.map((g) => rumpf(g));
    expect(ereignisse).toHaveLength(2);
    expect(ereignisse).toContainEqual(
      expect.objectContaining({
        ereignis: "wissen.revalidierung_faellig",
        wissensobjekt: { id: a, version: 1 },
      }),
    );
    expect(ereignisse).toContainEqual(
      expect.objectContaining({
        ereignis: "widerspruch.offen",
        kennung: `widerspruch.offen:${konflikt.id}`,
        widerspruch: { id: konflikt.id, art: "truth", wissensobjekte: [a, b] },
      }),
    );
    expect(JSON.stringify(ereignisse)).not.toContain("Drehzahl");
  });

  it("D · vertrauliches Wissen wird nicht gemeldet — auch nicht als Seite eines Widerspruchs", async () => {
    const services = await bestand();
    const geheim = await anlegen(services, "Rezeptur");
    const offen = await anlegen(services, "Rezeptur öffentlich");
    await services.ko.setConfidentiality(geheim, "vertraulich", "anna");
    const { melder, gesendet } = melderFuer(services, [ALLE]);
    await melder.lauf();

    await services.validation.adminValidate(geheim, "admin");
    await services.conflicts.create(
      { koA: geheim, koB: offen, type: "truth", description: "Menge weicht ab." },
      "anna",
    );
    await melder.lauf();

    expect(gesendet).toEqual([]);
    expect(await services.audit.list({ action: AKTION_ERKANNT })).toEqual([]);
  });

  it("E · jedes Ziel bekommt nur die Ereignisse, die es abonniert hat", async () => {
    const services = await bestand();
    const a = await anlegen(services, "Lager A");
    const b = await anlegen(services, "Lager B");
    const nurWiderspruch: WebhookZiel = {
      ...ALLE,
      id: "tickets",
      url: "https://tickets.example/hook",
      ereignisse: ["widerspruch.offen"],
    };
    const { melder, gesendet } = melderFuer(services, [ALLE, nurWiderspruch]);
    await melder.lauf();

    await services.validation.adminValidate(a, "admin");
    await services.conflicts.create(
      { koA: a, koB: b, type: "truth", description: "Ort weicht ab." },
      "anna",
    );
    await melder.lauf();

    const an = (url: string) => gesendet.filter((g) => g.url === url).map((g) => rumpf(g).ereignis);
    expect(an(ALLE.url).sort()).toEqual(["widerspruch.offen", "wissen.validiert"]);
    expect(an(nurWiderspruch.url)).toEqual(["widerspruch.offen"]);
  });

  it("F · ein nicht erreichbares Ziel wird erneut versucht und danach als gescheitert protokolliert", async () => {
    const services = await bestand();
    let status: number | null = null;
    const { melder, gesendet } = melderFuer(services, [ALLE], () => status);
    await melder.lauf();
    const id = await anlegen(services, "Filter wechseln");
    await services.validation.adminValidate(id, "admin");

    const erster = await melder.lauf();
    expect(erster).toMatchObject({ erkannt: 1, zugestellt: 0, ausstehend: 1 });
    status = 503;
    for (let i = 2; i < MAX_VERSUCHE; i++) {
      expect((await melder.lauf()).ausstehend).toBe(1);
    }
    const letzter = await melder.lauf();

    expect(letzter).toMatchObject({ gescheitert: 1, ausstehend: 0 });
    expect(gesendet).toHaveLength(MAX_VERSUCHE);
    // Alle Versuche tragen dieselbe Kennung — der Empfänger kann doppelte Zustellungen erkennen.
    expect(new Set(gesendet.map((g) => g.headers[KENNUNG_HEADER])).size).toBe(1);
    const gescheitert = await services.audit.list({ action: AKTION_GESCHEITERT, target: id });
    expect(gescheitert[0]?.payload).toMatchObject({ versuche: MAX_VERSUCHE, status: 503 });
    expect(await services.audit.list({ action: AKTION_ZUGESTELLT })).toEqual([]);

    // Ein späterer Erfolg schließt den Vorgang, ohne alte Meldungen zu wiederholen.
    status = 200;
    expect(await melder.lauf()).toMatchObject({ erkannt: 0, zugestellt: 0, ausstehend: 0 });
  });

  it("G · zwei Instanzen und ein Neustart melden jedes Ereignis genau einmal", async () => {
    const services = await bestand();
    const eins = melderFuer(services, [ALLE]);
    const zwei = melderFuer(services, [ALLE]);
    await eins.melder.lauf();
    await zwei.melder.lauf();
    expect(await services.audit.list({ action: AKTION_GRUNDSTAND })).toHaveLength(1);

    const id = await anlegen(services, "Kühlung prüfen");
    await services.validation.adminValidate(id, "admin");
    await Promise.all([eins.melder.lauf(), zwei.melder.lauf()]);
    expect(eins.gesendet.length + zwei.gesendet.length).toBe(1);

    const neustart = melderFuer(services, [ALLE]);
    expect((await neustart.melder.lauf()).erkannt).toBe(0);
    expect(neustart.gesendet).toEqual([]);
  });

  it("H · die Ziele kommen fail-closed aus KLARWERK_WEBHOOKS", () => {
    expect(ladeWebhookZiele({})).toEqual({ ziele: [], fehler: [] });
    expect(ladeWebhookZiele({ KLARWERK_WEBHOOKS: "{kaputt" }).ziele).toEqual([]);

    const eintrag = (teil: Record<string, unknown>) => ({
      id: "n8n",
      url: "https://n8n.example/webhook/abc",
      ereignisse: ["wissen.validiert"],
      geheimnis: GEHEIMNIS,
      ...teil,
    });
    const lage = ladeWebhookZiele({
      KLARWERK_WEBHOOKS: JSON.stringify([
        eintrag({}),
        eintrag({ id: "n8n" }),
        eintrag({ id: "klartext", url: "http://intern.example/hook" }),
        eintrag({ id: "zugang", url: "https://nutzer:pw@ziel.example/hook" }),
        eintrag({ id: "lokal", url: "http://127.0.0.1:5678/hook" }),
        eintrag({ id: "unbekannt", ereignisse: ["wissen.geloescht"] }),
        eintrag({ id: "leer", ereignisse: [] }),
        eintrag({ id: "kurz", geheimnis: "zu-kurz" }),
        eintrag({ id: "Gross" }),
      ]),
    });

    expect(lage.ziele.map((z) => z.id)).toEqual(["n8n", "lokal"]);
    expect(lage.fehler).toHaveLength(7);
    const text = lage.fehler.join("\n");
    expect(text).not.toContain(GEHEIMNIS);
    expect(text).not.toContain("zu-kurz");
    expect(text).not.toContain("nutzer:pw");
    expect(text).not.toContain("intern.example");

    expect(resolveWebhookTaktMs(undefined)).toBe(60_000);
    expect(resolveWebhookTaktMs("abc")).toBe(60_000);
    expect(resolveWebhookTaktMs("1")).toBe(10_000);
    expect(resolveWebhookTaktMs("30")).toBe(30_000);
  });

  it("J1 · wird ein Objekt zwischen zwei Versuchen vertraulich, geht seine Kennung nicht mehr hinaus", async () => {
    const services = await bestand();
    let status: number | null = null;
    const { melder, gesendet } = melderFuer(services, [ALLE], () => status);
    await melder.lauf();
    const id = await anlegen(services, "Einstellwerte Presse");
    await services.validation.adminValidate(id, "admin");
    expect(await melder.lauf()).toMatchObject({ erkannt: 1, zugestellt: 0, ausstehend: 1 });
    expect(gesendet).toHaveLength(1);

    await services.ko.setConfidentiality(id, "vertraulich", "anna");
    status = 204;
    const lauf = await melder.lauf();

    expect(lauf).toMatchObject({ abgebrochen: 1, zugestellt: 0, ausstehend: 0 });
    expect(gesendet).toHaveLength(1);
    const abbruch = await services.audit.list({ action: AKTION_ABGEBROCHEN, target: id });
    expect(abbruch[0]?.payload).toMatchObject({
      ziel: "werkzeug",
      kennung: `wissen.validiert:${id}:1`,
      versuche: 1,
      grund: "nicht-mehr-meldbar",
    });
    // Auch ein Neustart nimmt den abgebrochenen Vorgang nicht wieder auf.
    const neustart = melderFuer(services, [ALLE]);
    expect((await neustart.melder.lauf()).ausstehend).toBe(0);
    expect(neustart.gesendet).toEqual([]);
  });

  it("J2 · wird eine Seite eines Widerspruchs vertraulich, gehen beide Kennungen nicht mehr hinaus", async () => {
    const services = await bestand();
    const a = await anlegen(services, "Drehmoment A");
    const b = await anlegen(services, "Drehmoment B");
    let status: number | null = 503;
    const { melder, gesendet } = melderFuer(services, [ALLE], () => status);
    await melder.lauf();
    const konflikt = await services.conflicts.create(
      { koA: a, koB: b, type: "truth", description: "Wert weicht ab." },
      "anna",
    );
    expect(await melder.lauf()).toMatchObject({ erkannt: 1, ausstehend: 1 });

    await services.ko.setConfidentiality(b, "vertraulich", "anna");
    status = 204;
    expect(await melder.lauf()).toMatchObject({ abgebrochen: 1, ausstehend: 0 });
    expect(gesendet).toHaveLength(1);
    expect(
      await services.audit.list({ action: AKTION_ABGEBROCHEN, target: konflikt.id }),
    ).toHaveLength(1);
  });

  const ZWEITES: WebhookZiel = { ...ALLE, id: "zweites", url: "https://zweites.example/hook" };

  it("J3 · Rechteentzug WÄHREND der Zustellung an Ziel A: Ziel B im selben Takt bekommt nichts", async () => {
    const services = await bestand();
    let id = "";
    const { melder, gesendet } = melderFuer(services, [ALLE, ZWEITES], async (anfrage) => {
      if (anfrage.url === ALLE.url) {
        // Während Ziel A noch auf seine Antwort wartet, wird das Objekt vertraulich.
        await services.ko.setConfidentiality(id, "vertraulich", "anna");
      }
      return 204;
    });
    await melder.lauf();
    id = await anlegen(services, "Grenzwerte Ofen");
    await services.validation.adminValidate(id, "admin");

    const lauf = await melder.lauf();

    expect(lauf).toMatchObject({ erkannt: 1, zugestellt: 1, abgebrochen: 1, ausstehend: 0 });
    expect(gesendet.map((g) => g.url)).toEqual([ALLE.url]);
    const abbruch = await services.audit.list({ action: AKTION_ABGEBROCHEN, target: id });
    expect(abbruch.map((e) => e.payload.ziel)).toEqual(["zweites"]);
  });

  it("J4 · Rechteentzug an einer Widerspruchsseite während der Zustellung an Ziel A", async () => {
    const services = await bestand();
    const a = await anlegen(services, "Haltezeit A");
    const b = await anlegen(services, "Haltezeit B");
    const { melder, gesendet } = melderFuer(services, [ALLE, ZWEITES], async (anfrage) => {
      if (anfrage.url === ALLE.url) {
        await services.ko.setConfidentiality(b, "vertraulich", "anna");
      }
      return 204;
    });
    await melder.lauf();
    const konflikt = await services.conflicts.create(
      { koA: a, koB: b, type: "truth", description: "Zeit weicht ab." },
      "anna",
    );

    expect(await melder.lauf()).toMatchObject({ zugestellt: 1, abgebrochen: 1, ausstehend: 0 });
    expect(gesendet.map((g) => g.url)).toEqual([ALLE.url]);
    const abbruch = await services.audit.list({ action: AKTION_ABGEBROCHEN, target: konflikt.id });
    expect(abbruch.map((e) => e.payload.ziel)).toEqual(["zweites"]);
  });

  it("K1 · ein Neustart nach erfolglosem Versuch stellt zu, sobald das Ziel wieder erreichbar ist", async () => {
    const services = await bestand();
    const vorher = melderFuer(services, [ALLE], () => null);
    await vorher.melder.lauf();
    const id = await anlegen(services, "Schmierplan");
    await services.validation.adminValidate(id, "admin");
    expect(await vorher.melder.lauf()).toMatchObject({ erkannt: 1, ausstehend: 1 });
    const versuch = await services.audit.list({ action: AKTION_VERSUCH, target: id });
    expect(versuch[0]?.payload).toMatchObject({ ziel: "werkzeug", versuch: 1, status: null });

    const nachher = melderFuer(services, [ALLE], () => 204);
    const lauf = await nachher.melder.lauf();

    expect(lauf).toMatchObject({ erkannt: 0, zugestellt: 1, ausstehend: 0 });
    expect(nachher.gesendet.map((g) => g.headers[KENNUNG_HEADER])).toEqual([
      `wissen.validiert:${id}:1`,
    ]);
    const zugestellt = await services.audit.list({ action: AKTION_ZUGESTELLT, target: id });
    expect(zugestellt[0]?.payload).toMatchObject({ versuche: 2, status: 204 });
    expect((await nachher.melder.lauf()).zugestellt).toBe(0);
  });

  it("K2 · ein Neustart direkt nach der Erkennung verliert die Meldung nicht", async () => {
    const services = await bestand();
    const vorher = new WissensereignisMelder({
      quellen: {
        wissensobjekte: () => services.ko.list({}),
        revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
        offeneWidersprueche: () => services.conflicts.unresolved(),
        wissensobjekt: (id) => services.ko.get(id),
      },
      audit: services.audit,
      ziele: [ALLE],
      // Der Prozess endet mitten im ersten Versuch — nichts ist zugestellt, kein Versuch gezählt.
      zusteller: () => Promise.reject(new Error("Prozess beendet")),
    });
    await vorher.lauf();
    const id = await anlegen(services, "Kettenspannung");
    await services.validation.adminValidate(id, "admin");
    await expect(vorher.lauf()).rejects.toThrow("Prozess beendet");
    expect(await services.audit.list({ action: AKTION_ERKANNT, target: id })).toHaveLength(1);

    const nachher = melderFuer(services, [ALLE]);
    expect(await nachher.melder.lauf()).toMatchObject({ erkannt: 0, zugestellt: 1 });
    expect(rumpf(nachher.gesendet[0]!)).toMatchObject({
      kennung: `wissen.validiert:${id}:1`,
      wissensobjekt: { id, version: 1 },
    });
  });

  it("K3 · die Versuche zählen über den Neustart weiter; ein neues Ziel bekommt keine alten Vorgänge", async () => {
    const services = await bestand();
    const vorher = melderFuer(services, [ALLE], () => 500);
    await vorher.melder.lauf();
    const id = await anlegen(services, "Kühlmittel");
    await services.validation.adminValidate(id, "admin");
    for (let i = 1; i < MAX_VERSUCHE; i++) {
      await vorher.melder.lauf();
    }
    expect(vorher.gesendet).toHaveLength(MAX_VERSUCHE - 1);

    const neu: WebhookZiel = { ...ALLE, id: "neu", url: "https://neu.example/hook" };
    const nachher = melderFuer(services, [ALLE, neu], () => 500);
    const lauf = await nachher.melder.lauf();

    expect(lauf).toMatchObject({ gescheitert: 1, ausstehend: 0 });
    expect(nachher.gesendet.map((g) => g.url)).toEqual([ALLE.url]);
    const gescheitert = await services.audit.list({ action: AKTION_GESCHEITERT, target: id });
    expect(gescheitert[0]?.payload).toMatchObject({ ziel: "werkzeug", versuche: MAX_VERSUCHE });
  });

  describe("I · am echten Draht (fetch → HTTP-Empfänger auf 127.0.0.1)", () => {
    const schliessen: Array<() => Promise<void>> = [];
    afterEach(async () => {
      for (const s of schliessen.splice(0)) {
        await s();
      }
    });

    async function empfaenger(status: (pfad: string) => number) {
      const eingang: { pfad: string; headers: Record<string, unknown>; body: string }[] = [];
      const server = createServer((req, res) => {
        let body = "";
        req.on("data", (teil) => {
          body += teil;
        });
        req.on("end", () => {
          const pfad = req.url ?? "";
          eingang.push({ pfad, headers: req.headers, body });
          const code = status(pfad);
          res.writeHead(code, code >= 300 && code < 400 ? { location: "/umgeleitet" } : {});
          res.end();
        });
      });
      await new Promise<void>((fertig) => server.listen(0, "127.0.0.1", fertig));
      schliessen.push(() => new Promise<void>((fertig) => server.close(() => fertig())));
      const { port } = server.address() as AddressInfo;
      return { eingang, basis: `http://127.0.0.1:${port}` };
    }

    function melderMitZiel(services: AppServices, url: string) {
      const lage = ladeWebhookZiele({
        KLARWERK_WEBHOOKS: JSON.stringify([
          { id: "lokal", url, ereignisse: ["wissen.validiert"], geheimnis: GEHEIMNIS },
        ]),
      });
      expect(lage.fehler).toEqual([]);
      return new WissensereignisMelder({
        quellen: {
          wissensobjekte: () => services.ko.list({}),
          revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
          offeneWidersprueche: () => services.conflicts.unresolved(),
          wissensobjekt: (id) => services.ko.get(id),
        },
        audit: services.audit,
        ziele: lage.ziele,
      });
    }

    it("I1 · die Meldung kommt als signierter POST an", async () => {
      const { eingang, basis } = await empfaenger(() => 202);
      const services = await bestand();
      const melder = melderMitZiel(services, `${basis}/hook`);
      await melder.lauf();
      const id = await anlegen(services, "Dichtung tauschen");
      await services.validation.adminValidate(id, "admin");

      expect(await melder.lauf()).toMatchObject({ erkannt: 1, zugestellt: 1 });

      expect(eingang).toHaveLength(1);
      const [ankunft] = eingang;
      expect(ankunft?.pfad).toBe("/hook");
      expect(ankunft?.headers["content-type"]).toBe("application/json");
      expect(ankunft?.headers[EREIGNIS_HEADER]).toBe("wissen.validiert");
      const signatur = String(ankunft?.headers[SIGNATUR_HEADER]);
      const t = Number(/^t=(\d+),/.exec(signatur)?.[1]);
      expect(signatur).toBe(signiere(GEHEIMNIS, t, ankunft?.body ?? ""));
      expect(JSON.parse(ankunft?.body ?? "{}")).toMatchObject({
        ereignis: "wissen.validiert",
        wissensobjekt: { id, version: 1 },
      });
    });

    it("I2 · eine Weiterleitung wird nicht verfolgt und zählt als nicht zugestellt", async () => {
      const { eingang, basis } = await empfaenger((pfad) => (pfad === "/hook" ? 302 : 200));
      const services = await bestand();
      const melder = melderMitZiel(services, `${basis}/hook`);
      await melder.lauf();
      const id = await anlegen(services, "Riemen spannen");
      await services.validation.adminValidate(id, "admin");

      expect(await melder.lauf()).toMatchObject({ erkannt: 1, zugestellt: 0, ausstehend: 1 });
      expect(eingang.map((e) => e.pfad)).toEqual(["/hook"]);
    });
  });
});
