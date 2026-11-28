// ================================================================================================
// KLARA 03 (produkt:20261007:klara-kontext-tutorial) · BEZUG UND QUELLENANGABEN IN DER ABLAGE.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`),
// dieselbe Bauform wie `tests/klara-basis/gespraech-am-server.test.ts`.
//
//   B1 (K2)  Ein Schritt mit Bezug „Markierung“ hält Objekt, Fassung, Absatz und den Anfang der
//            Markierung fest — und liefert sie nach erneutem Lesen unverändert (kein Umdeuten).
//   B2 (K3)  Eine Antwort hält Titel, Fassung und Prüfstatus ihrer Quellen fest; eine Angabe zu einer
//            Quelle, die die Antwort nicht nennt, wird abgewiesen (keine erfundene Quelle).
//   B3 (K6)  Unbekannte Werte werden abgewiesen; eine Markierung ohne Bezug „Markierung“ ebenso.
//            Ein Gespräch aus Klara 01 (ohne die neuen Felder) bleibt gültig.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KlaraGespraech } from "../../services/app/src/klara-gespraech";
import type { AskResult } from "../../services/ask";

type App = ReturnType<typeof buildApp>;
type Sicht = Omit<KlaraGespraech, "kontoId" | "fassung">;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let quelleId: string;
let adminToken: string;

const BASIS = "/api/me/klara";
const TITEL = "Zylinderkopfdichtung XQ42 wechseln";
const AUSSAGE = "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.";
const markierung = (koId: string) => ({
  pfad: `/wissen/${koId}`,
  seitenName: "Wissen",
  objekt: `„${TITEL}“`,
  koId,
  fassung: 3,
  absatz: 2,
  modus: "lesen",
  pruefstatus: "geprueft",
  lesart: "original",
  bezug: "markierung",
  auswahl: AUSSAGE,
});
const SEITE_FRAGEN = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

const auf = (methode: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${erik.token}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function gespraechMitEinwilligung(bezug: unknown = SEITE_FRAGEN): Promise<Sicht> {
  const r = await auf("POST", `${BASIS}/gespraeche`, { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  const g = (r.json() as { gespraech: Sicht }).gespraech;
  const e = await auf("PUT", `${BASIS}/gespraeche/${g.id}/einwilligung`, { erteilt: true });
  expect(e.statusCode, e.body).toBe(200);
  return g;
}

async function pruefen(id: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { action: "admin-validate" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@klara-kontext.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@klara-kontext.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: "Erik Experte",
      email: "erik@klara-kontext.test",
      password: "secret123",
      role: "experte",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  erik = {
    id: (angelegt.json() as { id: string }).id,
    token: await anmelden("erik@klara-kontext.test"),
  };
  const quelle = await services.ko.create({
    title: TITEL,
    statement: "Zylinderkopfdichtung XQ42.",
    type: "best_practice",
    category: "Werkstatt",
    confidentiality: "intern",
    author: erik.id,
  });
  quelleId = quelle.id;
  await services.ko.revise(
    quelleId,
    { statement: "Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten." },
    erik.id,
  );
  const fassung = await services.ko.revise(quelleId, { statement: AUSSAGE }, erik.id);
  expect(fassung.version).toBe(3);
  await pruefen(quelleId);
});

describe("B1 · K2 — der Bezug einer Markierung bleibt, wie er war", () => {
  it("Frage und Schritt mit Bezug „Markierung“ tragen Objekt, Fassung und Absatz von damals", async () => {
    // Das Gespräch begann auf „Fragen“ — die Markierung stammt aus dem Artikel.
    const g = await gespraechMitEinwilligung();
    const frage = "Was gilt für „Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.“?";
    const s = await auf("PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
      art: "frage",
      text: frage,
      objektbezug: markierung(quelleId),
      stand: "laeuft",
    });
    expect(s.statusCode, s.body).toBe(200);
    const n = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: frage,
      objektbezug: markierung(quelleId),
    });
    expect(n.statusCode, n.body).toBe(201);

    const gelesen = ((await auf("GET", `${BASIS}/gespraech`)).json() as { gespraech: Sicht })
      .gespraech;
    expect(gelesen.objektbezug).toEqual(SEITE_FRAGEN);
    expect(gelesen.nachrichten[0]?.objektbezug).toEqual(markierung(quelleId));
    expect(gelesen.letzterSchritt?.objektbezug).toEqual(markierung(quelleId));
  });
});

describe("B2 · K3 — Quellen mit Titel, Fassung und Prüfstatus", () => {
  it("hält die Angaben fest und weist eine Angabe zu einer nicht genannten Quelle ab", async () => {
    const g = await gespraechMitEinwilligung();
    const ventil = await services.ko.create({
      title: "Ventil F3",
      statement: "Ventil F3 entlastet die Zylinderkopfdichtung XQ42 vor dem Wechsel.",
      type: "best_practice",
      category: "Werkstatt",
      confidentiality: "intern",
      author: erik.id,
    });
    await pruefen(ventil.id);
    const frage = await auf("POST", "/api/ask", {
      question: "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?",
    });
    expect(frage.statusCode, frage.body).toBe(200);
    const { result: antwort, answerId } = frage.json<AskResult>();
    expect(antwort.answered).toBe(true);
    expect(answerId).toEqual(expect.any(String));
    expect([...antwort.sources].sort(), frage.body).toEqual([quelleId, ventil.id].sort());
    const angaben = [
      { koId: quelleId, titel: TITEL, fassung: 3, geprueft: true },
      { koId: ventil.id, titel: ventil.title, fassung: ventil.version, geprueft: null },
    ];
    const ok = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: antwort.answer,
      objektbezug: markierung(quelleId),
      antwortId: answerId,
      quellen: antwort.sources,
      quellenAngaben: angaben,
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const gelesen = ((await auf("GET", `${BASIS}/gespraech`)).json() as { gespraech: Sicht })
      .gespraech;
    expect(gelesen.nachrichten[0]?.quellenAngaben).toEqual(angaben);

    const ohneFassung = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: antwort.answer,
      objektbezug: SEITE_FRAGEN,
      antwortId: answerId,
      quellen: [ventil.id],
      quellenAngaben: [{ koId: ventil.id, titel: ventil.title, fassung: null, geprueft: null }],
    });
    expect(ohneFassung.statusCode, ohneFassung.body).toBe(201);
    const erneut = (await auf("GET", `${BASIS}/gespraech`)).json<{ gespraech: Sicht }>();
    expect(erneut.gespraech.nachrichten[1]).toMatchObject({
      grund: "inhalt_nicht_verfuegbar",
      antwortId: null,
      quellen: [],
      quellenAngaben: [],
    });

    const erfunden = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: "x",
      objektbezug: SEITE_FRAGEN,
      antwortId: answerId,
      quellen: [quelleId],
      quellenAngaben: [{ koId: "ko-9", titel: "Erfunden", fassung: 1, geprueft: true }],
    });
    expect(erfunden.statusCode).toBe(400);
    // Eine Frage trägt keine Quellenangaben.
    const mitQuellen = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "x",
      objektbezug: SEITE_FRAGEN,
      quellenAngaben: [],
    });
    expect(mitQuellen.statusCode).toBe(400);
  });
});

describe("B3 · K6 — nur bekannte, gültige Bezugsangaben", () => {
  it("weist unbekannte Werte ab; eine Markierung ohne Bezug „Markierung“ ebenso", async () => {
    const g = await gespraechMitEinwilligung();
    const falsch: Record<string, unknown>[] = [
      { ...markierung(quelleId), bezug: "alles" },
      { ...markierung(quelleId), modus: "admin" },
      { ...markierung(quelleId), fassung: 0 },
      { ...markierung(quelleId), pruefstatus: "freigegeben" },
      { ...markierung(quelleId), bezug: "seite" }, // Markierungstext ohne Bezug „Markierung“
      { ...markierung(quelleId), auswahl: "x".repeat(301) },
    ];
    for (const bezug of falsch) {
      const r = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
        von: "du",
        modus: "frage",
        text: "x",
        objektbezug: bezug,
      });
      expect(r.statusCode, JSON.stringify(bezug)).toBe(400);
    }
    // Klara 01: ohne jedes neue Feld bleibt alles gültig.
    const alt = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: SEITE_FRAGEN,
    });
    expect(alt.statusCode, alt.body).toBe(201);
    expect((alt.json() as { nachricht: { objektbezug: unknown } }).nachricht.objektbezug).toEqual(
      SEITE_FRAGEN,
    );
  });
});

describe("B4 · Nacharbeit 6 — der gesendete Seitenkontext bleibt am Schritt erhalten", () => {
  it("Erfassung, Fragen ohne und mit Beitrag: Art und Wortlaut kommen unverändert zurück", async () => {
    const g = await gespraechMitEinwilligung();
    const faelle: Record<string, unknown>[] = [
      {
        pfad: "/erfassen",
        seitenName: "Erfassung",
        objekt: "Entwurf „Ölwechsel Presse Vier“",
        modus: "bearbeiten",
        bezug: "seite",
        kontextArt: "entwurf",
        kontextText: "Ölwechsel Presse Vier",
      },
      {
        ...SEITE_FRAGEN,
        bezug: "seite",
        kontextArt: "frage",
        kontextText: "Wann ist die Wartung fällig?",
      },
      {
        ...SEITE_FRAGEN,
        koId: quelleId,
        fassung: 2,
        bezug: "seite",
        kontextArt: "frage",
        kontextText: "Wann ist die Wartung fällig?",
      },
    ];
    for (const objektbezug of faelle) {
      const s = await auf("PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
        art: "frage",
        text: "Wie lange dauert das?",
        objektbezug,
        stand: "fehlgeschlagen",
      });
      expect(s.statusCode, s.body).toBe(200);
      const gelesen = ((await auf("GET", `${BASIS}/gespraech`)).json() as { gespraech: Sicht })
        .gespraech;
      expect(gelesen.letzterSchritt?.objektbezug).toEqual(objektbezug);
    }
    // Ungültig: unbekannte Art, Wortlaut ohne Art, Seitenkontext am freien Gespräch, zu lang.
    const falsch: Record<string, unknown>[] = [
      { ...SEITE_FRAGEN, bezug: "seite", kontextArt: "alles" },
      { ...SEITE_FRAGEN, bezug: "seite", kontextText: "ohne Art" },
      { ...SEITE_FRAGEN, bezug: "frei", kontextArt: "frage", kontextText: "x" },
      { ...SEITE_FRAGEN, bezug: "seite", kontextArt: "frage", kontextText: "x".repeat(301) },
    ];
    for (const objektbezug of falsch) {
      const r = await auf("PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
        art: "frage",
        text: "x",
        objektbezug,
        stand: "fehlgeschlagen",
      });
      expect(r.statusCode, JSON.stringify(objektbezug)).toBe(400);
    }
  });
});
