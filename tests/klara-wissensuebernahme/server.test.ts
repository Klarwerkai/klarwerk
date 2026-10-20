import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

let s: AppServices;
let app: ReturnType<typeof buildApp>;
let token: string;
let fremd: string;
let aid: string;
const basis = "/api/me/klara";
const ziel = {
  art: "artikel",
  confidentiality: "intern",
  type: "technik",
  category: "Wartung",
  conditions: ["Nur bei Stillstand", "Nur durch Fachpersonal"],
};
function auf(method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown, t = token) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${t}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}
async function notiz(weg = "geschrieben") {
  const r = await auf("POST", `${basis}/notizen`, {
    vorgang: `f-${crypto.randomUUID()}`,
    weg,
    titel: "Presse 4",
    inhalt: "Ölstand nur bei stehender Presse prüfen.",
    offeneFragen: ["Gilt das bei Presse 5?"],
    objektbezug: { pfad: "/klara", seitenName: "Klara", objekt: "Servicebericht" },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().notiz;
}
async function vorschau(n: { id: string; fassung: number }, z = ziel) {
  const r = await auf("POST", `${basis}/notizen/${n.id}/wissen/vorschau`, {
    fassung: n.fassung,
    ziel: z,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}
async function uebernehmen(n: { id: string; fassung: number }, v: { stempel: string }, z = ziel) {
  return auf("POST", `${basis}/notizen/${n.id}/wissen/uebernehmen`, {
    fassung: n.fassung,
    stempel: v.stempel,
    ziel: z,
    bewusst: true,
  });
}
beforeEach(async () => {
  s = assembleServices(inMemoryRepos());
  app = buildApp(s);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: "ada@f.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ada@f.test", password: "secret123" },
  });
  token = login.json().token;
  aid = (await s.auth.listUsers())[0]?.id ?? "";
  await auf("POST", "/api/users", {
    name: "Bert",
    email: "bert@f.test",
    password: "secret123",
    role: "experte",
  });
  fremd = (
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bert@f.test", password: "secret123" },
    })
  ).json().token;
});
afterEach(async () => {
  await app.close();
});
describe("F08 · bewusste Übernahme", () => {
  it("erhält Original/Zweibedingungen, legt genau einen tatsächlichen offenen Beitrag samt Rücklink an", async () => {
    const n = await notiz();
    const vor = await vorschau(n);
    expect((await s.ko.list()).length).toBe(0);
    expect((await auf("GET", `${basis}/notizen/${n.id}`, undefined, fremd)).statusCode).toBe(404);
    const [a, b] = await Promise.all([uebernehmen(n, vor), uebernehmen(n, vor)]);
    expect(a.statusCode, a.body).toBe(200);
    expect(b.statusCode, b.body).toBe(200);
    expect(a.json().beitrag.id).toBe(b.json().beitrag.id);
    const ks = await s.ko.list();
    expect(ks).toHaveLength(1);
    expect(ks[0]).toMatchObject({ status: "offen", author: aid, conditions: ziel.conditions });
    expect(ks[0]?.bodyHtml).toContain(n.id);
    expect((await auf("GET", `${basis}/notizen/${n.id}`)).json().notiz).toEqual(n);
  });
  it("zeigt die Zielwahl und lehnt abgebrochene, alte und geänderte Vorschauen ohne Beitrag ab", async () => {
    const n = await notiz("diktiert");
    const v = await vorschau(n);
    expect(v.verantwortlich).toBe(aid);
    expect(v.ziel.art).toBe("artikel");
    const unbewusst = await auf("POST", `${basis}/notizen/${n.id}/wissen/uebernehmen`, {
      fassung: n.fassung,
      stempel: v.stempel,
      ziel,
      bewusst: false,
    });
    expect(unbewusst.statusCode).toBe(400);
    await auf("PUT", `${basis}/notizen/${n.id}`, {
      fassung: n.fassung,
      inhalt: "Neue korrigierte Notiz",
    });
    expect((await uebernehmen(n, v)).statusCode).toBe(409);
    expect(await s.ko.list()).toHaveLength(0);
  });
  it("wählt Space bewusst, prüft echte Rechte und schreibt über den vorhandenen Spaceweg", async () => {
    const n = await notiz();
    const spaceR = await auf("POST", "/api/spaces", {
      name: "Werkstatt",
      zweck: "Servicewissen",
      verantwortlich: aid,
      zugang: "mitglieder",
      mitglieder: [],
      ansichten: [],
    });
    expect(spaceR.statusCode, spaceR.body).toBe(201);
    const space = spaceR.json();
    const z = { ...ziel, art: "space", spaceId: space.id };
    const v = await vorschau(n, z);
    const r = await uebernehmen(n, v, z);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().beitrag.spaceId).toBe(space.id);
    expect((await auf("GET", `/api/kos/${r.json().beitrag.id}`, undefined, fremd)).statusCode).toBe(
      404,
    );
    expect(
      (
        await auf("POST", `${basis}/notizen/${n.id}/wissen/vorschau`, {
          fassung: n.fassung,
          ziel: { ...z, spaceId: "fremd-unbekannt" },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("importiert nur den gewählten Abschnitt, wiederholt ohne Dublette, korrigiert nachvollziehbar", async () => {
    const x = {
      titel: "Antwort",
      inhalt: "Ölstand prüfen. Empfehlung: Pause.",
      projekt: "Presse 4",
      abschnitt: "chat-gewählt/antwort-2",
      antwortFassung: "1",
      aussagen: [
        { text: "Ölstand prüfen.", art: "behauptung", quellen: [] },
        { text: "Empfehlung: Pause.", art: "empfehlung", quellen: [] },
      ],
    };
    const a = await auf("POST", `${basis}/wissen/import`, x);
    expect(a.statusCode, a.body).toBe(201);
    const n = a.json().notiz;
    const b = await auf("POST", `${basis}/wissen/import`, {
      ...x,
      nachbarchats: ["NICHT AUSGEWÄHLT"],
    });
    expect(b.statusCode, b.body).toBe(200);
    expect(b.json().notiz.id).toBe(n.id);
    expect(n.wissensHerkunft).toMatchObject({ projekt: "Presse 4", anbieter: null, modell: null });
    const c = await auf("POST", `${basis}/wissen/import`, {
      ...x,
      antwortFassung: "2",
      vorherigeNotiz: n.id,
    });
    expect(c.statusCode, c.body).toBe(201);
    expect(c.json().notiz.id).not.toBe(n.id);
    expect(c.json().notiz.wissensHerkunft.vorherigeNotiz).toBe(n.id);
    const p = await auf("POST", `${basis}/notizen/${n.id}/wissen/pruefen`, {});
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json().ergebnis.status).toBe("nicht_pruefbar");
    expect(p.body).not.toContain("NICHT AUSGEWÄHLT");
    const v = await vorschau(n);
    const r = await uebernehmen(n, v);
    expect(r.statusCode, r.body).toBe(200);
    expect((await s.ko.get(r.json().beitrag.id))?.bodyHtml).toContain("empfehlung");
  });
  it("fehlgeschlagener Beitrag bleibt privat und Wiederholung nach verlorener Antwort erstellt keine Dublette", async () => {
    const n = await notiz();
    const v = await vorschau(n);
    const vorher = s.ko.create.bind(s.ko);
    let fehler = true;
    s.ko.create = async (...args) => {
      if (fehler) {
        fehler = false;
        throw new Error("synthetischer Speicherfehler");
      }
      return vorher(...args);
    };
    expect((await uebernehmen(n, v)).statusCode).not.toBe(200);
    expect(await s.ko.list()).toHaveLength(0);
    expect((await uebernehmen(n, v)).statusCode).toBe(200);
    expect((await uebernehmen(n, v)).statusCode).toBe(200);
    expect(await s.ko.list()).toHaveLength(1);
    expect((await auf("GET", `${basis}/notizen/${n.id}`)).json().notiz).toEqual(n);
  });
  it("Quellrechteentzug sperrt private Suche/Original/Prüfung und bewusste Übernahme", async () => {
    const bert = (await s.auth.listUsers()).find((u) => u.email === "bert@f.test");
    if (!bert) throw new Error("synthetisches Konto fehlt");
    const q = await s.ko.create({
      title: "Quelle",
      statement: "Ölstand nur bei stehender Presse prüfen.",
      author: bert.id,
      type: "technik",
      category: "Wartung",
      confidentiality: "intern",
    });
    const imp = await auf("POST", `${basis}/wissen/import`, {
      titel: "Geschützter Import",
      inhalt: q.statement,
      projekt: "Presse4",
      abschnitt: "antwort-q",
      antwortFassung: "1",
      aussagen: [
        { text: q.statement, art: "behauptung", quellen: [{ id: q.id, fassung: q.version }] },
      ],
    });
    expect(imp.statusCode, imp.body).toBe(201);
    const n = imp.json().notiz;
    const v = await vorschau(n);
    const p = await auf("POST", `${basis}/notizen/${n.id}/wissen/pruefen`, {});
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json().beleg.aussagen[0].deckung).toBe("belegt");
    // Wortdeckung ist kein unabhängiges Urteil: ohne freigegebenen Prüfer bleibt die Prüfung offen.
    expect(p.json().ergebnis.status).toBe("nicht_pruefbar");
    await s.ko.setConfidentiality(q.id, "streng_vertraulich", bert.id);
    expect((await auf("GET", `${basis}/notizen/${n.id}`)).statusCode).toBe(404);
    expect((await auf("GET", `${basis}/notizen?q=Geschützter`)).body).not.toContain(
      "Geschützter Import",
    );
    expect((await uebernehmen(n, v)).statusCode).toBe(404);
    expect((await auf("POST", `${basis}/notizen/${n.id}/wissen/pruefen`, {})).statusCode).toBe(404);
  });
  it("Link ohne Passage besteht nicht; Quellenänderung entwertet alte Vorschau", async () => {
    const q = await s.ko.create({
      title: "Passende URL",
      statement: "Die Maschine ist blau.",
      author: aid,
      type: "technik",
      category: "Wartung",
      confidentiality: "intern",
    });
    const imp = await auf("POST", `${basis}/wissen/import`, {
      titel: "Unbelegt",
      inhalt: "Das Lizenzende ist am 31.12.2026. https://erfunden.example.test/beleg",
      projekt: "Presse4",
      abschnitt: "antwort-url",
      antwortFassung: "1",
      aussagen: [
        {
          text: "Das Lizenzende ist am 31.12.2026.",
          art: "behauptung",
          quellen: [{ id: q.id, fassung: q.version }],
        },
      ],
    });
    expect(imp.statusCode, imp.body).toBe(201);
    const n = imp.json().notiz;
    const v = await vorschau(n);
    const p = await auf("POST", `${basis}/notizen/${n.id}/wissen/pruefen`, {});
    expect(p.json().beleg.fehlendeDeckung.length).toBeGreaterThan(0);
    expect(p.json().ergebnis.status).toBe("nicht_pruefbar");
    await s.ko.revise(q.id, { statement: "Die Maschine ist grün." }, aid);
    expect((await uebernehmen(n, v)).statusCode).toBe(409);
    expect((await s.ko.list()).length).toBe(1);
  });
  it("eine ausdrücklich freigegebene Firmenfassung bleibt von privater Löschung getrennt", async () => {
    const n = await notiz();
    const v = await vorschau(n);
    const r = await uebernehmen(n, v);
    expect(r.statusCode, r.body).toBe(200);
    expect((await auf("DELETE", `${basis}/notizen/${n.id}`)).statusCode).toBe(200);
    expect((await auf("GET", `${basis}/notizen/${n.id}`)).statusCode).toBe(404);
    expect(await s.ko.get(r.json().beitrag.id)).toMatchObject({
      id: r.json().beitrag.id,
      status: "offen",
    });
    expect((await auf("GET", `/api/kos/${r.json().beitrag.id}`, undefined, fremd)).statusCode).toBe(
      200,
    );
  });
  it("Originalleerraum bleibt beim gewählten Chatimport zeichengetreu erhalten", async () => {
    const inhalt = "  Gewählter Originalabschnitt.  \nZweite Zeile.  ";
    const r = await auf("POST", `${basis}/wissen/import`, {
      titel: "Original",
      inhalt,
      projekt: "Projekt",
      abschnitt: "Auswahl mit Leerraum",
      antwortFassung: "1",
      aussagen: [{ text: "Gewählter Originalabschnitt.", art: "behauptung", quellen: [] }],
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().notiz.inhalt).toBe(inhalt);
  });
  it("bearbeitete Importfassung erhält keine alte Herkunftsbestätigung", async () => {
    const r = await auf("POST", `${basis}/wissen/import`, {
      titel: "Import",
      inhalt: "Original.",
      projekt: "Projekt",
      abschnitt: "Antwort geändert",
      antwortFassung: "1",
      anbieter: "angegeben",
      modell: "nur-manifest",
      aussagen: [{ text: "Original.", art: "behauptung", quellen: [] }],
    });
    expect(r.statusCode, r.body).toBe(201);
    const n = r.json().notiz;
    const geändert = await auf("PUT", `${basis}/notizen/${n.id}`, {
      fassung: n.fassung,
      inhalt: "Korrigierter Text.",
    });
    expect(geändert.statusCode).toBe(200);
    const p = await auf("POST", `${basis}/notizen/${n.id}/wissen/pruefen`, {});
    expect(p.json().herkunftUnveraendert).toBe(false);
    expect(p.json().ergebnis.status).toBe("nicht_pruefbar");
    expect(p.json().ergebnis.rollen.antwort).toBeNull();
    const v = await auf("POST", `${basis}/notizen/${n.id}/wissen/vorschau`, {
      fassung: geändert.json().notiz.fassung,
      ziel,
    });
    expect(v.statusCode).toBe(409);
  });
  it("verlorene Antwort nach tatsächlichem Insert wird ohne zweiten Beitrag wiederaufgenommen", async () => {
    const n = await notiz();
    const v = await vorschau(n);
    const create = s.ko.create.bind(s.ko);
    let verloren = true;
    s.ko.create = async (...args) => {
      const ko = await create(...args);
      if (verloren) {
        verloren = false;
        throw new Error("Antwort nach Commit verloren");
      }
      return ko;
    };
    expect((await uebernehmen(n, v)).statusCode).not.toBe(200);
    expect(await s.ko.list()).toHaveLength(1);
    const wieder = await uebernehmen(n, v);
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().wiederholt).toBe(true);
    expect(await s.ko.list()).toHaveLength(1);
  });
});
