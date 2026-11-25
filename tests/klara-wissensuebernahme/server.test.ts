import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

let s: AppServices;
let repos: ReturnType<typeof inMemoryRepos>;
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
  repos = inMemoryRepos();
  s = assembleServices(repos);
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
  it.each(["best_practice", "bauchgefuehl", "lernkurve", "negativwissen", "technik"])(
    "bindet die gewählte Wissensart %s in Vorschau und angelegtem Beitrag",
    async (type) => {
      const n = await notiz();
      const auswahl = { ...ziel, type };
      const v = await vorschau(n, auswahl);
      expect(v.input.type).toBe(type);
      const schreiben = await uebernehmen(n, v, auswahl);
      expect(schreiben.statusCode, schreiben.body).toBe(200);
      const ko = await auf("GET", `/api/kos/${schreiben.json().beitrag.id}`);
      expect(ko.statusCode, ko.body).toBe(200);
      expect(ko.json().type).toBe(type);
    },
  );
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
  it("zusätzliche Quellleser und unbekannte Schutzstufe erlauben keine breitere Übernahme", async () => {
    const q = await s.ko.create(
      {
        title: "Leserliste",
        statement: "Nur für den berechtigten Quellleser.",
        author: aid,
        type: "technik",
        category: "Wartung",
        confidentiality: "intern",
      },
      undefined,
      { stufe: "intern", leser: [aid], version: 1 },
    );
    expect((await auf("GET", `/api/kos/${q.id}`, undefined, fremd)).statusCode).toBe(404);
    const imp = await auf("POST", `${basis}/wissen/import`, {
      titel: "Quellauszug",
      inhalt: q.statement,
      projekt: "Projekt",
      abschnitt: "Quellleser",
      antwortFassung: "1",
      aussagen: [
        { text: q.statement, art: "behauptung", quellen: [{ id: q.id, fassung: q.version }] },
      ],
    });
    expect(imp.statusCode, imp.body).toBe(201);
    const n = imp.json().notiz;
    expect(
      (await auf("POST", `${basis}/notizen/${n.id}/wissen/vorschau`, { fassung: n.fassung, ziel }))
        .statusCode,
    ).toBe(403);
    expect(await s.ko.list()).toHaveLength(1);
    const offen = await s.ko.create({
      title: "Ungeklärt",
      statement: "Unbekannte Schutzklasse.",
      author: aid,
      type: "technik",
      category: "Wartung",
      confidentiality: "intern",
    });
    const { confidentiality: _stufe, ...ohneStufe } = offen;
    await repos.koRepo.update(ohneStufe);
    const no = await auf("POST", `${basis}/notizen`, {
      vorgang: "f-ungeklaert-quellklasse",
      weg: "geschrieben",
      inhalt: offen.statement,
      objektbezug: {
        pfad: `/wissen/${offen.id}`,
        seitenName: "Quelle",
        objekt: "Quelle",
        koId: offen.id,
        fassung: offen.version,
      },
    });
    expect(no.statusCode, no.body).toBe(201);
    expect(
      (
        await auf("POST", `${basis}/notizen/${no.json().notiz.id}/wissen/vorschau`, {
          fassung: 1,
          ziel,
        })
      ).statusCode,
    ).toBe(403);
    const erlaubt = await s.ko.create({
      title: "Explizit intern",
      statement: "Offenes Quellenwissen.",
      author: aid,
      type: "technik",
      category: "Wartung",
      confidentiality: "intern",
    });
    const norm = await auf("POST", `${basis}/notizen`, {
      vorgang: "f-explizit-intern",
      weg: "geschrieben",
      inhalt: erlaubt.statement,
      objektbezug: {
        pfad: `/wissen/${erlaubt.id}`,
        seitenName: "Quelle",
        objekt: "Quelle",
        koId: erlaubt.id,
        fassung: erlaubt.version,
      },
    });
    expect(norm.statusCode, norm.body).toBe(201);
    expect(
      (
        await auf("POST", `${basis}/notizen/${norm.json().notiz.id}/wissen/vorschau`, {
          fassung: 1,
          ziel,
        })
      ).statusCode,
    ).toBe(200);
  });
});

describe("Entscheidung am persönlichen Original nachlesen", () => {
  it("trennt Notiz und Firmenbeitrag und zeigt nach Wiederöffnung den aktuellen Prüfentscheid", async () => {
    const regel = await auf("PUT", "/api/validation/settings", { defaultNeededValidations: 1 });
    expect(regel.statusCode, regel.body).toBe(200);
    const n = await notiz();
    const pfad = `${basis}/notizen/${n.id}/wissen/stand`;
    const staende = async () => {
      const response = await auf("GET", pfad);
      expect(response.statusCode, response.body).toBe(200);
      return response.json().beitraege;
    };
    expect(await staende()).toEqual([]);
    const eingereicht = await uebernehmen(n, await vorschau(n));
    expect(eingereicht.statusCode, eingereicht.body).toBe(200);
    const id: string = eingereicht.json().beitrag.id;
    const url = `/api/kos/${id}`;
    const erwarte = async (stand: string, version: number) =>
      expect(await staende()).toEqual([{ id, version, notizFassung: 1, stand }]);
    const prueferKonto = await auf("POST", "/api/users", {
      name: "Prüferin",
      email: "pruefung@service.test",
      password: "secret123",
      role: "controller",
    });
    expect(prueferKonto.statusCode, prueferKonto.body).toBe(201);
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pruefung@service.test", password: "secret123" },
    });
    expect(anmeldung.statusCode, anmeldung.body).toBe(200);
    const prueferin = anmeldung.json().token;
    const fremdePruefung = async (verdict: string) => {
      const r = await auf("PUT", url, { action: "rate", verdict }, prueferin);
      expect(r.statusCode, r.body).toBe(200);
    };
    await erwarte("offen", 1);
    expect((await auf("GET", pfad, undefined, fremd)).statusCode).toBe(404);
    expect((await auf("GET", url, undefined, fremd)).statusCode).toBe(200);

    await fremdePruefung("warn");
    await erwarte("rueckfrage", 1);
    await fremdePruefung("down");
    await erwarte("abgelehnt", 1);
    const fachtext = "Ölstand der Spezialpresse SPX9 nur bei Stillstand prüfen.";
    const revision = await auf("PUT", url, { action: "revise", changes: { statement: fachtext } });
    expect(revision.statusCode, revision.body).toBe(200);
    await erwarte("offen", 2);

    const notizGeaendert = await auf("PUT", `${basis}/notizen/${n.id}`, {
      fassung: 1,
      titel: "Nachtrag zum Wartungsbesuch",
    });
    expect(notizGeaendert.statusCode, notizGeaendert.body).toBe(200);
    await fremdePruefung("up");
    await erwarte("validiert", 2);
    await app.close();
    s = assembleServices(repos, { klaraNotizen: s.klaraNotizenRoh ?? s.klaraNotizen });
    app = buildApp(s);
    await erwarte("validiert", 2);
    const frage = await auf(
      "POST",
      "/api/ask",
      { question: "Wie prüft man den Ölstand der Spezialpresse SPX9?" },
      fremd,
    );
    expect(frage.statusCode, frage.body).toBe(200);
    expect(frage.json().result).toMatchObject({
      answered: true,
      knowledgeClass: "gesichert",
      sources: [id],
    });
    expect((await auf("GET", `${basis}/notizen/${n.id}`, undefined, fremd)).statusCode).toBe(404);

    await s.ko.setQuellrechte(id, { stufe: "intern", leser: [] }, aid);
    expect(await staende()).toEqual([{ notizFassung: 1, stand: "nicht_verfuegbar" }]);
    const erneut = await auf(
      "POST",
      "/api/ask",
      { question: "Wie prüft man den Ölstand der Spezialpresse SPX9?" },
      fremd,
    );
    expect(erneut.statusCode, erneut.body).toBe(200);
    expect(erneut.json().result.sources).not.toContain(id);
  });

  it("stellt nach einem unterbrochenen Audit-Schritt beim Wiederholen genau einen nachlesbaren Beitrag her", async () => {
    const n = await notiz();
    const v = await vorschau(n);
    const schreiben = s.audit.recordOnce.bind(s.audit);
    let unterbrochen = false;
    const stoerung = vi.spyOn(s.audit, "recordOnce").mockImplementation((eventId, eingabe, tx) => {
      if (!unterbrochen && eventId.startsWith("klara.wissen.uebernommen:")) {
        unterbrochen = true;
        return Promise.reject(new Error("Simulierter Ausfall vor der Zuordnung"));
      }
      return schreiben(eventId, eingabe, tx);
    });
    try {
      expect((await uebernehmen(n, v)).statusCode).toBe(500);
    } finally {
      stoerung.mockRestore();
    }
    const erneut = await uebernehmen(n, v);
    expect(erneut.statusCode, erneut.body).toBe(200);
    expect(erneut.json().wiederholt).toBe(true);
    const id = erneut.json().beitrag.id;
    expect((await s.ko.list()).map((ko) => ko.id)).toEqual([id]);
    expect(await s.audit.list({ action: "klara.wissen.uebernommen", target: id })).toHaveLength(1);
    expect((await auf("GET", `${basis}/notizen/${n.id}/wissen/stand`)).json().beitraege).toEqual([
      { notizFassung: 1, id, version: 1, stand: "offen" },
    ]);
  });

  it("liefert beim Zurückziehen des geteilten Beitrags keinen Link und bei gesperrter Notizquelle keine Metadaten", async () => {
    const quelle = await s.ko.create({
      title: "Herkunft",
      statement: "Die Spindel nur im Stillstand warten.",
      category: "Service",
      type: "technik",
      author: aid,
      confidentiality: "intern",
    });
    const original = await auf("POST", `${basis}/notizen`, {
      vorgang: "service-quelle",
      weg: "geschrieben",
      inhalt: quelle.statement,
      objektbezug: {
        pfad: `/wissen/${quelle.id}`,
        seitenName: "Quelle",
        objekt: "Spindel",
        koId: quelle.id,
        fassung: quelle.version,
      },
    });
    expect(original.statusCode, original.body).toBe(201);
    const n = original.json().notiz;
    const pfad = `${basis}/notizen/${n.id}/wissen/stand`;
    const eingereicht = await uebernehmen(n, await vorschau(n));
    expect(eingereicht.statusCode, eingereicht.body).toBe(200);
    const id = eingereicht.json().beitrag.id;
    const entfernt = await auf("DELETE", `/api/kos/${id}`);
    expect(entfernt.statusCode, entfernt.body).toBe(204);
    const gelesen = await auf("GET", pfad);
    expect(gelesen.json().beitraege).toEqual([{ notizFassung: 1, stand: "nicht_verfuegbar" }]);
    await s.ko.setQuellrechte(quelle.id, { stufe: "intern", leser: [] }, aid);
    const gesperrt = await auf("GET", pfad);
    expect(gesperrt.statusCode, gesperrt.body).toBe(404);
    expect(gesperrt.body).not.toContain(id);
  });
});
