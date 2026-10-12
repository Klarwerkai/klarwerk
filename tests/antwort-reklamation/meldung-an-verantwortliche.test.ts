// ================================================================================================
// R-1089 / R-1721 · „ANTWORT FALSCH" / „QUELLE PASST NICHT" — AM ECHTEN DRAHT.
// ================================================================================================
//
// Die Originalanforderung: „Jede Antwort lässt sich melden, wenn sie falsch ist oder die Quelle
// nicht passt. Die Meldung soll nicht in einem Sammelbecken landen, sondern direkt beim
// Verantwortlichen des zitierten Wissensobjekts." Geprüft über HTTP mit echten Anmeldungen:
//   M1  Ohne benannten Eigentümer erreicht die Meldung den Autor (benannter Ersatz) — und NUR ihn.
//   M2  Mit benanntem Eigentümer erreicht sie den Eigentümer — nicht den Autor, nicht die Prüfer.
//   M3  Die Quittung nennt Nummer, Zeitpunkt und Zustellart, aber nicht die Kennung der Person.
//   M4  Doppelt gemeldet ist einmal zugestellt; dieselbe Nummer, `bereitsGemeldet`.
//   M4b Wird dazwischen ein Eigentümer benannt, nennt die Wiederholungsquittung die GESPEICHERTE
//       Zustellung (Autor-Ersatz), nicht die heutige Zuständigkeit.
//   M5  Ohne passenden Beleg (fremd, leer, andere Quelle) oder mit unbekanntem Grund wird nichts
//       zugestellt.
//   M6  Erfasst ist die Rückmeldung im Protokoll (`answer.reported`) — Grund, Quelle, Meldender.
//   M7  Keine Kürzung: auch bei mehr als 20 Meldungen bleibt jede im Feed der Person erreichbar.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { deriveReklamationen } from "../../services/app/src/routes/notifications-routes";

type App = ReturnType<typeof buildApp>;
type Konto = { headers: { authorization: string }; id: string };

const KENNWORT = "geheim12345";
const TITEL = "Spindel SP-7 nur im Stillstand schmieren";

async function login(app: App, email: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const headers = { authorization: `Bearer ${res.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@r1089.test", password: KENNWORT },
  });
  const admin = await login(app, "admin@r1089.test");
  for (const [email, role] of [
    ["autor@r1089.test", "experte"],
    ["eignerin@r1089.test", "controller"],
    ["frager@r1089.test", "experte"],
    ["dritte@r1089.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name: email, email, password: KENNWORT, role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const autor = await login(app, "autor@r1089.test");
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor.headers,
    payload: {
      confidentiality: "intern",
      title: TITEL,
      statement: "Schmierung bei Drehung verteilt Fett in die Lager.",
      type: "best_practice",
    },
  });
  expect(created.statusCode).toBe(201);
  // Geantwortet wird nur aus geprüftem Wissen (R-0584, aus main): ohne Freigabe endete jede Frage in
  // einer Wissenslücke, und es gäbe keine Antwort, die man melden könnte. Die Freigabe benennt
  // keinen Eigentümer — die Zustellung bleibt beim Autor-Ersatz, bis M2/M4b einen benennen.
  const freigabe = await app.inject({
    method: "PUT",
    url: `/api/kos/${created.json().id as string}`,
    headers: admin.headers,
    payload: { action: "admin-validate" },
  });
  expect(freigabe.statusCode).toBe(200);
  return {
    services,
    app,
    admin,
    autor,
    eignerin: await login(app, "eignerin@r1089.test"),
    frager: await login(app, "frager@r1089.test"),
    dritte: await login(app, "dritte@r1089.test"),
    koId: created.json().id as string,
  };
}

async function belegFuer(app: App, wer: Konto, koId: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: wer.headers,
    payload: { question: TITEL },
  });
  const body = res.json() as { receipt?: string; result?: { citedSources?: string[] } };
  // Kalibrierung: ohne diese Quelle im Beleg mässe jeder folgende Schritt nur die 403.
  expect(body.result?.citedSources ?? []).toContain(koId);
  expect(typeof body.receipt).toBe("string");
  return body.receipt as string;
}

const melden = (app: App, wer: Konto, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/ask/report", headers: wer.headers, payload });

type Glockeneintrag = {
  id: string;
  kind: string;
  koId?: string;
  grund?: string;
  meldungId?: string;
};
const glocke = (app: App, wer: Konto) =>
  app
    .inject({ method: "GET", url: "/api/notifications", headers: wer.headers })
    .then((r) => (r.json() as Glockeneintrag[]).filter((n) => n.kind === "reklamation"));

describe("R-1089 · Meldung einer falschen Antwort an die verantwortliche Person", () => {
  it("M1/M3 · ohne Eigentümer: zugestellt beim Autor, und nur dort; Quittung ohne Personenkennung", async () => {
    const { app, admin, autor, eignerin, frager, dritte, koId } = await setup();
    const res = await melden(app, frager, {
      koId,
      receipt: await belegFuer(app, frager, koId),
      grund: "antwort-falsch",
    });
    expect(res.statusCode).toBe(200);
    const quittung = res.json();
    expect(quittung).toMatchObject({
      koId,
      koTitle: TITEL,
      grund: "antwort-falsch",
      zugestelltAn: "author-fallback",
      bereitsGemeldet: false,
    });
    expect(quittung.meldungId).toMatch(/^M-[0-9A-F]{10}$/);
    expect(Number.isNaN(Date.parse(quittung.at))).toBe(false);
    expect(res.body, "die Quittung nennt die verantwortliche Person nicht").not.toContain(autor.id);

    const beimAutor = await glocke(app, autor);
    expect(beimAutor).toHaveLength(1);
    expect(beimAutor[0]).toMatchObject({
      koId,
      grund: "antwort-falsch",
      meldungId: quittung.meldungId,
    });
    // Kein Sammelbecken: weder der Meldende noch Administration, Prüfer oder Unbeteiligte.
    for (const andere of [frager, admin, eignerin, dritte]) {
      expect(await glocke(app, andere)).toEqual([]);
    }
  });

  it("M2 · mit benanntem Eigentümer: zugestellt bei ihr — nicht beim Autor", async () => {
    const { app, admin, autor, eignerin, frager, dritte, koId } = await setup();
    const vergeben = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "ownership", ownership: { owner: eignerin.id } },
    });
    expect(vergeben.statusCode).toBe(200);

    const res = await melden(app, frager, {
      koId,
      receipt: await belegFuer(app, frager, koId),
      grund: "quelle-passt-nicht",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ zugestelltAn: "owner", grund: "quelle-passt-nicht" });
    expect(res.body).not.toContain(eignerin.id);

    const beiIhr = await glocke(app, eignerin);
    expect(beiIhr).toHaveLength(1);
    expect(beiIhr[0]).toMatchObject({ koId, grund: "quelle-passt-nicht" });
    for (const andere of [autor, frager, admin, dritte]) {
      expect(await glocke(app, andere)).toEqual([]);
    }
  });

  it("M4 · zweimal derselbe Klick aus derselben Antwort: einmal zugestellt, dieselbe Nummer", async () => {
    const { app, autor, frager, koId } = await setup();
    const receipt = await belegFuer(app, frager, koId);
    const erst = await melden(app, frager, { koId, receipt, grund: "antwort-falsch" });
    const zweit = await melden(app, frager, { koId, receipt, grund: "antwort-falsch" });
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().meldungId).toBe(erst.json().meldungId);
    expect(zweit.json().at).toBe(erst.json().at);
    expect(zweit.json().bereitsGemeldet).toBe(true);
    expect(await glocke(app, autor)).toHaveLength(1);
  });

  it("M4b · Eigentümer zwischen Erst- und Wiederholungsmeldung benannt: die Quittung nennt die gespeicherte Zustellung", async () => {
    const { app, admin, autor, eignerin, frager, koId } = await setup();
    const receipt = await belegFuer(app, frager, koId);
    const erst = await melden(app, frager, { koId, receipt, grund: "antwort-falsch" });
    expect(erst.json()).toMatchObject({ zugestelltAn: "author-fallback", bereitsGemeldet: false });

    const vergeben = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "ownership", ownership: { owner: eignerin.id } },
    });
    expect(vergeben.statusCode).toBe(200);

    const zweit = await melden(app, frager, { koId, receipt, grund: "antwort-falsch" });
    expect(zweit.statusCode).toBe(200);
    // Die Meldung liegt weiterhin beim Autor — und genau das sagt auch die zweite Quittung.
    expect(zweit.json()).toMatchObject({
      meldungId: erst.json().meldungId,
      at: erst.json().at,
      koTitle: TITEL,
      zugestelltAn: "author-fallback",
      bereitsGemeldet: true,
    });
    expect(await glocke(app, autor)).toHaveLength(1);
    expect(await glocke(app, eignerin)).toEqual([]);
  });

  it("M5 · ohne passenden Beleg oder mit unbekanntem Grund: abgewiesen, nichts zugestellt", async () => {
    const { app, autor, frager, dritte, koId } = await setup();
    const fremderBeleg = await belegFuer(app, dritte, koId);
    const eigenerBeleg = await belegFuer(app, frager, koId);
    const faelle: Array<[Record<string, unknown>, number]> = [
      [{ koId, receipt: "", grund: "antwort-falsch" }, 403],
      [{ koId, receipt: fremderBeleg, grund: "antwort-falsch" }, 403],
      [{ koId: "nicht-im-beleg", receipt: eigenerBeleg, grund: "antwort-falsch" }, 403],
      [{ koId, receipt: eigenerBeleg, grund: "gefaellt-mir-nicht" }, 400],
      [{ koId, receipt: eigenerBeleg }, 400],
    ];
    for (const [payload, status] of faelle) {
      expect((await melden(app, frager, payload)).statusCode, JSON.stringify(payload)).toBe(status);
    }
    const ohneSitzung = await app.inject({
      method: "POST",
      url: "/api/ask/report",
      payload: { koId, receipt: eigenerBeleg, grund: "antwort-falsch" },
    });
    expect(ohneSitzung.statusCode).toBe(401);
    expect(await glocke(app, autor)).toEqual([]);
  });

  it("M6 · die Rückmeldung ist erfasst: Protokolleintrag mit Meldendem, Quelle und Grund", async () => {
    const { services, app, autor, frager, koId } = await setup();
    const res = await melden(app, frager, {
      koId,
      receipt: await belegFuer(app, frager, koId),
      grund: "antwort-falsch",
    });
    const eintraege = await services.audit.list({ action: "answer.reported", target: koId });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatchObject({
      actor: frager.id,
      target: koId,
      payload: {
        meldungId: res.json().meldungId,
        grund: "antwort-falsch",
        koTitle: TITEL,
        responsible: autor.id,
        responsibleKind: "author-fallback",
      },
    });
    // Genau diese fünf Felder — kein Fragetext, kein Freitext reist ins Protokoll der Meldung.
    expect(Object.keys(eintraege[0]?.payload ?? {}).sort()).toEqual([
      "grund",
      "koTitle",
      "meldungId",
      "responsible",
      "responsibleKind",
    ]);
  });

  it("M7 · mehr als 20 Meldungen vor dem nächsten Abruf: alle stehen im Feed, auch die erste", async () => {
    const { services, app, autor, koId } = await setup();
    // 25 zugestellte Meldungen in genau der Form, die `reportAnswer` schreibt — direkt ins
    // Protokoll, weil 25 unterscheidbare Antwortbelege über HTTP keine zusätzliche Aussage trügen.
    for (let i = 0; i < 25; i++) {
      await services.audit.record({
        actor: `frager-${i}`,
        action: "answer.reported",
        target: koId,
        payload: {
          meldungId: `M-TEST${String(i).padStart(4, "0")}`,
          grund: "antwort-falsch",
          koTitle: TITEL,
          responsible: autor.id,
          responsibleKind: "author-fallback",
        },
      });
    }
    const beimAutor = await glocke(app, autor);
    expect(beimAutor).toHaveLength(25);
    expect(beimAutor.map((n) => n.meldungId)).toContain("M-TEST0000");
  });

  it("deriveReklamationen: nur eigene, vollständige Einträge — und alle davon, keine Kürzung", () => {
    const mk = (i: number, responsible: string, grund = "antwort-falsch") => ({
      target: `ko-${i}`,
      at: `2026-09-0${(i % 9) + 1}T10:00:00Z`,
      payload: { responsible, koTitle: `T${i}`, meldungId: `M-${i}`, grund },
    });
    const liste = deriveReklamationen(
      [
        ...Array.from({ length: 25 }, (_, i) => mk(i, "u-a")),
        mk(90, "u-b"),
        mk(91, "u-a", "unbekannt"),
        { target: "alt", at: "2026-09-01T00:00:00Z", payload: { responsible: "u-a" } },
      ],
      "u-a",
    );
    // Alle 25 eigenen Meldungen — auch die erste ist noch erreichbar (Ben, Nacharbeit 3).
    expect(liste).toHaveLength(25);
    expect(liste.map((r) => r.meldungId)).toEqual(Array.from({ length: 25 }, (_, i) => `M-${i}`));
    expect(liste.every((r) => r.title.startsWith("T") && r.grund === "antwort-falsch")).toBe(true);
  });
});
