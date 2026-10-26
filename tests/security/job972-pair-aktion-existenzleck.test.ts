// ================================================================================================
// JOB 972 · D3 — PRÜFLÜCKE 6: VERRÄT EINE PAIR-AKTION, OB ES DAS PAAR GIBT?
// ================================================================================================
//
// Das Vollurteil zu D2 (`cf0d81e8…`) führt als Prüflücke 6: „Pair-Aktionen eines Autors ohne
// existenzbestätigende Fehlerdifferenz abweisen." Diese Zusage hängt NICHT an B4 — sie betrifft die
// heute vorhandenen Konflikt- und Dublettenrouten, nicht den erst zu entscheidenden Signalweg.
// Deshalb ist sie hier messbar, während alles andere gesperrt bleibt.
//
// DER BEFUND, DER DIESE DATEI TRÄGT: Die LESEWEGE beider Routen prüfen `paarSichtbar` und liefern
// einheitlich `404` — `overlap-routes.ts:97-100` sagt es im Kommentar selbst: „nicht sichtbar sieht
// aus wie nicht vorhanden". Die PAIR-AKTIONEN darunter (`dismiss`, `keep-separate`, `link-related`
// und seit JOB 3061 `status`)
// prüfen ausschliesslich die Rolle und rufen den Dienst direkt. Ob dabei ein Unterschied zwischen
// „gibt es nicht" und „darfst du nicht sehen" nach aussen dringt, ist genau die Frage.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job972d3.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job972d3.test", "geheim12345");
  for (const [email, role] of [
    ["leser@job972d3.test", "viewer"],
    ["autor@job972d3.test", "experte"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
  }
  return { app, admin };
}

// JOB 3061 · H2: `status` („Status setzen" im „···"-Menü) ist seit dieser Runde die VIERTE
// Pair-Aktion und gehört damit unter dieselbe Zusage wie die drei anderen.
const AKTIONEN = ["dismiss", "keep-separate", "link-related", "status"] as const;

// Der Rumpf je Aktion. Die drei Abschlüsse tragen ihren Grund im PFAD und kommen mit `{}` aus;
// `status` trägt den Zielzustand im RUMPF und würde mit `{}` schon an der Eingabeprüfung enden
// (400 INVALID_STATUS) — dann hätte die Probe die Existenzfrage gar nicht erst gestellt. Sie
// bekommt deshalb eine WOHLGEFORMTE Anfrage; nur so erreicht sie denselben Nachschlagepunkt wie
// die anderen drei, und nur so misst diese Datei bei ihr wirklich, was sie zu messen vorgibt.
const RUMPF: Record<(typeof AKTIONEN)[number], Record<string, unknown>> = {
  dismiss: {},
  "keep-separate": {},
  "link-related": {},
  status: { status: "in_bearbeitung" },
};

describe("JOB972 D3 · Prüflücke 6 — die Pair-Aktion verrät keine Existenz", () => {
  it("P6: eine unbekannte Kennung wird abgewiesen, ohne dass die Antwort etwas über sie aussagt", async () => {
    const { app, admin } = await setup();
    const antworten = [];
    for (const aktion of AKTIONEN) {
      const res = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: admin,
        payload: RUMPF[aktion],
      });
      antworten.push({ aktion, status: res.statusCode, body: res.body });
    }
    // Der Befund wird SICHTBAR gemacht, nicht geraten: die Antwort steht in der Meldung.
    for (const a of antworten) {
      expect(
        a.status,
        `Aktion ${a.aktion} auf unbekannte Kennung: ${a.status} ${a.body.slice(0, 200)}`,
      ).toBeGreaterThanOrEqual(400);
    }
  });

  it("P6c: Rollenrecht ersetzt kein Freigabeniveau — unsichtbare und unbekannte Paare antworten gleich", async () => {
    // P1: Rollenrecht und Freigabeniveau bleiben getrennt. Die Controllerin darf kuratieren,
    // ein streng vertrauliches Paar aber erst mit persönlichem Niveau sehen und verändern.
    const dienste = buildServices();
    const app = buildApp(dienste);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@job972c.test", password: "geheim12345" },
    });
    const admin = await login(app, "a@job972c.test", "geheim12345");
    const kontoIds: Record<string, string> = {};
    for (const [email, role] of [
      ["c@job972c.test", "controller"],
      ["v@job972c.test", "viewer"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name: email, email, password: "geheim12345", role },
      });
      if (res.statusCode !== 201) {
        throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
      }
      kontoIds[email] = (res.json() as { id: string }).id;
    }
    const controller = await login(app, "c@job972c.test", "geheim12345");
    const leser = await login(app, "v@job972c.test", "geheim12345");

    // Zwei KOs des Admins auf hoechster Vertraulichkeitsstufe.
    const ids: string[] = [];
    for (const titel of ["Alpha", "Beta"]) {
      const ko = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: admin,
        payload: {
          confidentiality: "intern",
          title: titel,
          statement: `${titel} Aussage zum Vorgang.`,
          type: "best_practice",
          category: "Instandhaltung",
          author: "a@job972c.test",
        },
      });
      const id = ko.json().id as string;
      await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: { action: "confidentiality", level: "streng_vertraulich" },
      });
      ids.push(id);
    }
    const eintrag = await dienste.overlaps.createAuto(
      {
        koA: ids[0] as string,
        koB: ids[1] as string,
        relation: "moeglich",
        aspects: [],
        eigenanteilA: "Alpha",
        eigenanteilB: "Beta",
        recommendation: "pruefen",
      } as never,
      "heuristik" as never,
    );

    // aufnahme:20260922:gesamt-leserechte (Variante B, Entscheidung 15): `ko.validate` allein ist
    // Freigaberang 1 — die Controllerin OHNE persönliches Niveau darf handeln, sieht das streng
    // vertrauliche Paar aber nicht. Genau diesen Akteur schloss die Annahme oben aus. Seither prüfen
    // die Aktionen das Paar vorab: für sie antwortet jede Aktion am vorhandenen Paar exakt wie an
    // einem erfundenen, und nichts wird geschrieben.
    for (const aktion of AKTIONEN) {
      const vorhanden = await app.inject({
        method: "POST",
        url: `/api/duplicates/${eintrag.id}/${aktion}`,
        headers: controller,
        payload: RUMPF[aktion],
      });
      const erfunden = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: controller,
        payload: RUMPF[aktion],
      });
      expect(
        `${vorhanden.statusCode}|${vorhanden.body}`,
        `Controller ohne Niveau, Aktion ${aktion}: vorhanden=${vorhanden.statusCode}`,
      ).toBe(`${erfunden.statusCode}|${erfunden.body}`);
    }
    expect((await dienste.overlaps.get(eintrag.id))?.status).toBe(eintrag.status);
    const ohneNiveau = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: controller,
    });
    expect(ohneNiveau.statusCode, `Controller ohne Niveau: ${ohneNiveau.statusCode}`).toBe(404);

    // Mit persönlichem Niveau „streng vertraulich“ (gesetzt von der Verwaltung) gilt die Zusage
    // wieder: wer handeln darf, sieht das Paar auch.
    const niveau = await app.inject({
      method: "PUT",
      url: `/api/users/${kontoIds["c@job972c.test"]}`,
      headers: admin,
      payload: { freigabe: "streng_vertraulich" },
    });
    expect(niveau.statusCode, niveau.body).toBe(200);

    // HAELFTE 1 — wer handeln darf, sieht das Paar auch. Damit kann er nichts erfahren, was er
    // nicht ohnehin sehen duerfte.
    const sicht = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: controller,
    });
    expect(sicht.statusCode, `Controller-Sicht: ${sicht.statusCode}`).toBe(200);
    // Und die Gegenrichtung, ohne die der Satz nur halb gemessen waere: Wer NICHT handeln darf,
    // sieht das Paar auch nicht — und zwar als `404`, nicht als `403`. Ohne diese Zeile bliebe die
    // Zusicherung auch dann gruen, wenn die Sichtpruefung im Leseweg ganz entfiele.
    const keineSicht = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: leser,
    });
    expect(keineSicht.statusCode, `Lesersicht: ${keineSicht.statusCode}`).toBe(404);

    // HAELFTE 2 — wer NICHT handeln darf, bekommt fuer ein vorhandenes und fuer ein erfundenes
    // Paar exakt dieselbe Antwort. Ein Unterschied waere die Auskunft „es gibt da etwas".
    for (const aktion of AKTIONEN) {
      const vorhanden = await app.inject({
        method: "POST",
        url: `/api/duplicates/${eintrag.id}/${aktion}`,
        headers: leser,
        payload: RUMPF[aktion],
      });
      const erfunden = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: leser,
        payload: RUMPF[aktion],
      });
      expect(
        `${vorhanden.statusCode}|${vorhanden.body}`,
        `Aktion ${aktion}: vorhanden=${vorhanden.statusCode} | erfunden=${erfunden.statusCode}`,
      ).toBe(`${erfunden.statusCode}|${erfunden.body}`);
    }
    await app.close();
  });

  it("P6b: alle Pair-Aktionen antworten auf dieselbe unbekannte Kennung GLEICH", async () => {
    const { app, admin } = await setup();
    const koerper: string[] = [];
    for (const aktion of AKTIONEN) {
      const res = await app.inject({
        method: "POST",
        url: `/api/duplicates/gibt-es-nicht-0000/${aktion}`,
        headers: admin,
        payload: RUMPF[aktion],
      });
      koerper.push(`${res.statusCode}|${res.body}`);
    }
    // Unterschiedliche Antworten je Aktion wären für sich schon eine Auskunft über den Zustand.
    expect(new Set(koerper).size, `Antworten: ${koerper.join("  ||  ")}`).toBe(1);
  });
});

// P1: Rollenrecht, Paarsicht und Feldfreigabe sind drei verschiedene Prüfungen.
const P1_GEHEIM = [
  "P1-BESCHREIBUNG-GEHEIM",
  "P1-BEGRUENDUNG-GEHEIM",
  "P1-ZITAT-GEHEIM",
  "P1-EIGENANTEIL-GEHEIM",
  "P1-ASPEKT-GEHEIM",
] as const;

async function konfliktRahmen() {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const registriert = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@p1.test", password: "geheim12345" },
    });
    expect(registriert.statusCode, registriert.body).toBe(201);
    const admin = await login(app, "admin@p1.test", "geheim12345");
    for (const [email, role] of [
      ["ctrl@p1.test", "controller"],
      ["viewer@p1.test", "viewer"],
    ] as const) {
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name: email, email, role, password: "geheim12345" },
      });
      expect(angelegt.statusCode, angelegt.body).toBe(201);
    }
    const controller = await login(app, "ctrl@p1.test", "geheim12345");
    const leser = await login(app, "viewer@p1.test", "geheim12345");
    const koAnlegen = async (
      confidentiality: "intern" | "vertraulich" | "streng_vertraulich" = "intern",
    ) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: admin,
        payload: {
          title: "P1 Beitrag",
          statement: "P1 vollständige Aussage.",
          type: "best_practice",
          category: "P1",
          confidentiality,
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json().id as string;
    };
    const konflikt = (koA: string, koB: string) =>
      services.conflicts.createAuto(
        { koA, koB, type: "truth", description: P1_GEHEIM[0] },
        {
          trigger: "validation",
          method: "model",
          rationale: P1_GEHEIM[1],
          quotes: { a: P1_GEHEIM[2], b: "Öffentliches Zitat B" },
        },
      );
    const ueberschneidung = (koA: string, koB: string) =>
      services.overlaps.createAuto(
        {
          koA,
          koB,
          relation: "teilweise",
          aspects: [
            { beschreibung: P1_GEHEIM[4], zitatA: P1_GEHEIM[2], zitatB: "Öffentliches Zitat B" },
          ],
          eigenanteilA: P1_GEHEIM[3],
          eigenanteilB: "Öffentlicher Eigenanteil B",
          recommendation: "zusammenfuehren_pruefen",
        },
        { trigger: "validation", method: "model", lexicalScore: 0.9, rationale: P1_GEHEIM[1] },
      );
    return { app, services, admin, controller, leser, koAnlegen, konflikt, ueberschneidung };
  } catch (error) {
    await app.close();
    throw error;
  }
}

function ohneP1Klartext(body: string) {
  for (const wort of P1_GEHEIM) {
    expect(body, `gesperrter Konflikttext in der HTTP-Antwort: ${wort}`).not.toContain(wort);
  }
}

describe("P1 · Konfliktpaare am echten HTTP-Vertrag", () => {
  it("P1 Anlage: fremdes koA, fehlendes oder unsichtbares koB und unbekannter Pfad bleiben ohne Konflikt-/KO-Wirkung", async () => {
    const f = await konfliktRahmen();
    try {
      const geheim = await f.koAnlegen("streng_vertraulich");
      const b = await f.koAnlegen();
      const pfad = await f.koAnlegen();
      const validiert = await f.app.inject({
        method: "PUT",
        url: `/api/kos/${geheim}`,
        headers: f.admin,
        payload: { action: "admin-validate", expectedVersion: 1, duplicateAcknowledged: true },
      });
      expect(validiert.statusCode, validiert.body).toBe(200);
      const vorher = JSON.stringify(await f.services.ko.get(geheim));
      for (const [id, koA, koB] of [
        [pfad, geheim, b],
        [pfad, b, geheim],
        [pfad, pfad, geheim],
        [pfad, pfad, "fehlt-p1"],
        ["fehlt-p1", pfad, b],
      ] as const) {
        const res = await f.app.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: f.controller,
          payload: {
            action: "conflict",
            conflict: { koA, koB, type: "truth", description: "Kein fremdes Paar" },
          },
        });
        expect(res.statusCode, res.body).toBe(404);
      }
      expect(await f.services.conflicts.unresolved()).toEqual([]);
      expect(JSON.stringify(await f.services.ko.get(geheim))).toBe(vorher);
      expect((await f.services.ko.get(geheim))?.status).toBe("validiert");
    } finally {
      await f.app.close();
    }
  });

  it.each(["escalate", "dismiss", "second-opinion", "arbeitsart"] as const)(
    "P1 %s: fehlende und unsichtbare Paare antworten neutral, ohne einen Stand zu ändern",
    async (aktion) => {
      const f = await konfliktRahmen();
      try {
        const geheim = await f.koAnlegen("streng_vertraulich");
        const b = await f.koAnlegen();
        const verborgen = await f.konflikt(geheim, b);
        const ohneKo = await f.konflikt(b, "fehlt-p1");
        const stand = await f.services.conflicts.escalate(verborgen.id);
        const phantomStand = await f.services.conflicts.escalate(ohneKo.id);
        const koStand = JSON.stringify(await f.services.ko.get(geheim));
        const payload = { note: "P1 Vermerk", opinion: "P1 Zweitmeinung", arbeitsart: "regel" };
        const antworten = [];
        for (const id of [verborgen.id, ohneKo.id, "fehlt-p1"]) {
          const res = await f.app.inject({
            method: "POST",
            url: `/api/conflicts/${id}/${aktion}`,
            headers: f.controller,
            payload,
          });
          expect(res.statusCode, res.body).toBe(404);
          ohneP1Klartext(res.body);
          antworten.push(res.body);
        }
        expect(new Set(antworten).size).toBe(1);
        expect(await f.services.conflicts.get(verborgen.id)).toEqual(stand);
        expect(await f.services.conflicts.get(ohneKo.id)).toEqual(phantomStand);
        expect(JSON.stringify(await f.services.ko.get(geheim))).toBe(koStand);
      } finally {
        await f.app.close();
      }
    },
  );

  it("P1 Entscheidung: ein anderes sichtbares Pfadobjekt, ein fehlender Pfad und eine unsichtbare Gegenseite entscheiden kein fremdes Paar", async () => {
    const f = await konfliktRahmen();
    try {
      const a = await f.koAnlegen();
      const b = await f.koAnlegen();
      const fremderPfad = await f.koAnlegen();
      const geheim = await f.koAnlegen("streng_vertraulich");
      const offen = await f.konflikt(a, b);
      const stand = await f.services.conflicts.escalate(offen.id);
      const verborgen = await f.konflikt(a, geheim);
      const geheimerStand = await f.services.conflicts.escalate(verborgen.id);
      for (const [id, conflictId] of [
        [fremderPfad, offen.id],
        ["fehlt-p1", offen.id],
        [a, verborgen.id],
        [a, "fehlt-p1"],
      ] as const) {
        const res = await f.app.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: f.controller,
          payload: {
            action: "resolve-conflict",
            conflictId,
            decision: "Keine fremde Entscheidung",
          },
        });
        expect(res.statusCode, res.body).toBe(404);
      }
      expect(await f.services.conflicts.get(offen.id)).toEqual(stand);
      expect(await f.services.conflicts.get(verborgen.id)).toEqual(geheimerStand);
    } finally {
      await f.app.close();
    }
  });

  it("P1 berechtigt: Anlage, Wahrheitsfolge, Einordnung, Eskalation, Zweitmeinung und Entscheidung bleiben wirksam und protokolliert", async () => {
    const f = await konfliktRahmen();
    try {
      const a = await f.koAnlegen();
      const b = await f.koAnlegen();
      expect(
        (
          await f.app.inject({
            method: "PUT",
            url: `/api/kos/${a}`,
            headers: f.admin,
            payload: { action: "admin-validate", expectedVersion: 1, duplicateAcknowledged: true },
          })
        ).statusCode,
      ).toBe(200);
      const created = await f.app.inject({
        method: "PUT",
        url: `/api/kos/${a}`,
        headers: f.controller,
        payload: {
          action: "conflict",
          conflict: { koA: a, koB: b, type: "truth", description: "Interner Konflikt" },
        },
      });
      expect(created.statusCode, created.body).toBe(201);
      expect(created.json()).toMatchObject({ koA: a, koB: b, description: "Interner Konflikt" });
      expect((await f.services.ko.get(a))?.status).toBe("offen");
      const id = created.json().id as string;
      for (const [aktion, payload, zustand] of [
        ["arbeitsart", { arbeitsart: "regel" }, "offen"],
        ["escalate", {}, "eskaliert"],
        ["second-opinion", { opinion: "Erlaubte Zweitmeinung" }, "zweitmeinung"],
      ] as const) {
        const res = await f.app.inject({
          method: "POST",
          url: `/api/conflicts/${id}/${aktion}`,
          headers: f.controller,
          payload,
        });
        expect(res.statusCode, res.body).toBe(200);
        expect(res.json()).toMatchObject({ status: zustand, description: "Interner Konflikt" });
      }
      const entschieden = await f.app.inject({
        method: "PUT",
        url: `/api/kos/${b}`,
        headers: f.controller,
        payload: { action: "resolve-conflict", conflictId: id, decision: "Erlaubte Entscheidung" },
      });
      expect(entschieden.statusCode, entschieden.body).toBe(200);
      expect(entschieden.json()).toMatchObject({
        status: "geloest",
        decision: "Erlaubte Entscheidung",
        description: "Interner Konflikt",
      });
      const audit = await f.services.audit.list({ target: id });
      expect(audit.map((e) => e.action)).toEqual(
        expect.arrayContaining([
          "conflict.created",
          "conflict.classified",
          "conflict.escalated",
          "conflict.second-opinion",
          "conflict.resolved",
        ]),
      );
    } finally {
      await f.app.close();
    }
  });

  it("P1 Feldschutz: alle Konflikt-Schreibantworten behalten den erlaubten Vorgang und redigieren die vertraulichen Belege", async () => {
    const f = await konfliktRahmen();
    try {
      const a = await f.koAnlegen("vertraulich");
      const b = await f.koAnlegen();
      for (const aktion of [
        "escalate",
        "dismiss",
        "second-opinion",
        "arbeitsart",
        "resolve-conflict",
      ] as const) {
        const c = await f.konflikt(a, b);
        if (aktion === "second-opinion" || aktion === "resolve-conflict") {
          await f.services.conflicts.escalate(c.id);
        }
        const res =
          aktion === "resolve-conflict"
            ? await f.app.inject({
                method: "PUT",
                url: `/api/kos/${a}`,
                headers: f.controller,
                payload: { action: aktion, conflictId: c.id, decision: "Erlaubte Entscheidung" },
              })
            : await f.app.inject({
                method: "POST",
                url: `/api/conflicts/${c.id}/${aktion}`,
                headers: f.controller,
                payload: { note: "Vermerk", opinion: "Zweitmeinung", arbeitsart: "regel" },
              });
        expect(res.statusCode, res.body).toBe(200);
        ohneP1Klartext(res.body);
        expect(res.json()).toMatchObject({ id: c.id, redacted: true, description: "" });
        expect((await f.services.conflicts.get(c.id))?.description).toBe(P1_GEHEIM[0]);
      }
    } finally {
      await f.app.close();
    }
  });

  it("P1 Feldschutz: Glocke, Herkunft und wiederholte Duplikat-Schreibantworten geben keinen vertraulichen Klartext heraus", async () => {
    vi.stubEnv("KLARWERK_PROVENANCE_ENABLED", "1");
    const f = await konfliktRahmen();
    try {
      const a = await f.koAnlegen("vertraulich");
      const b = await f.koAnlegen();
      const c = await f.konflikt(a, b);
      const o = await f.ueberschneidung(a, b);
      for (const url of ["/api/notifications", `/api/kos/${b}/provenance`]) {
        const res = await f.app.inject({ method: "GET", url, headers: f.controller });
        expect(res.statusCode, res.body).toBe(200);
        expect(res.body).toContain(c.id);
        ohneP1Klartext(res.body);
      }
      const erlaubt = await f.app.inject({
        method: "GET",
        url: `/api/kos/${b}/provenance`,
        headers: f.admin,
      });
      expect(erlaubt.statusCode, erlaubt.body).toBe(200);
      expect(erlaubt.body).toContain(P1_GEHEIM[0]);
      const leser = await f.app.inject({
        method: "GET",
        url: `/api/kos/${b}/provenance`,
        headers: f.leser,
      });
      expect(leser.statusCode, leser.body).toBe(200);
      ohneP1Klartext(leser.body);
      for (let i = 0; i < 2; i++) {
        const res = await f.app.inject({
          method: "POST",
          url: `/api/duplicates/${o.id}/status`,
          headers: f.controller,
          payload: { status: "in_bearbeitung" },
        });
        expect(res.statusCode, res.body).toBe(200);
        ohneP1Klartext(res.body);
        expect(res.json()).toMatchObject({
          redacted: true,
          eigenanteilA: "",
          eigenanteilB: "Öffentlicher Eigenanteil B",
        });
      }
      for (const aktion of ["dismiss", "keep-separate", "link-related", "status"] as const) {
        const eintrag = await f.ueberschneidung(a, b);
        const res = await f.app.inject({
          method: "POST",
          url: `/api/duplicates/${eintrag.id}/${aktion}`,
          headers: f.controller,
          payload:
            aktion === "status"
              ? { status: "geschlossen", reason: "dismissed" }
              : { note: "Erlaubter Vermerk" },
        });
        expect(res.statusCode, res.body).toBe(200);
        ohneP1Klartext(res.body);
        expect(res.json()).toMatchObject({ redacted: true, eigenanteilA: "" });
      }
    } finally {
      await f.app.close();
      vi.unstubAllEnvs();
    }
  });
});
