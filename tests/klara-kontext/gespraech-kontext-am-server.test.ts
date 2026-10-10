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

type App = ReturnType<typeof buildApp>;
type Sicht = Omit<KlaraGespraech, "kontoId" | "fassung">;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };

const BASIS = "/api/me/klara";
const MARKIERUNG = {
  pfad: "/wissen/ko-1",
  seitenName: "Wissen",
  objekt: "„Zylinderkopfdichtung XQ42 wechseln“",
  koId: "ko-1",
  fassung: 3,
  absatz: 2,
  modus: "lesen",
  pruefstatus: "geprueft",
  lesart: "original",
  bezug: "markierung",
  auswahl: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
};
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

async function eigeneAntwort(answerId: string): Promise<void> {
  expect(
    await services.answerSnapshots.createRecord({
      answerId,
      askExecutionId: `exec-${answerId}`,
      createdAt: "2026-10-10T09:30:00.000Z",
      schemaVersion: 1,
      owner: { kind: "user", userId: erik.id },
    }),
  ).toBe(true);
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@klara-kontext.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@klara-kontext.test");
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
});

describe("B1 · K2 — der Bezug einer Markierung bleibt, wie er war", () => {
  it("Frage und Schritt mit Bezug „Markierung“ tragen Objekt, Fassung und Absatz von damals", async () => {
    // Das Gespräch begann auf „Fragen“ — die Markierung stammt aus dem Artikel.
    const g = await gespraechMitEinwilligung();
    const frage = "Was gilt für „Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.“?";
    const s = await auf("PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
      art: "frage",
      text: frage,
      objektbezug: MARKIERUNG,
      stand: "laeuft",
    });
    expect(s.statusCode, s.body).toBe(200);
    const n = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: frage,
      objektbezug: MARKIERUNG,
    });
    expect(n.statusCode, n.body).toBe(201);

    const gelesen = ((await auf("GET", `${BASIS}/gespraech`)).json() as { gespraech: Sicht })
      .gespraech;
    expect(gelesen.objektbezug).toEqual(SEITE_FRAGEN);
    expect(gelesen.nachrichten[0]?.objektbezug).toEqual(MARKIERUNG);
    expect(gelesen.letzterSchritt?.objektbezug).toEqual(MARKIERUNG);
  });
});

describe("B2 · K3 — Quellen mit Titel, Fassung und Prüfstatus", () => {
  it("hält die Angaben fest und weist eine Angabe zu einer nicht genannten Quelle ab", async () => {
    const g = await gespraechMitEinwilligung();
    await eigeneAntwort("ans-k3-1");
    const angaben = [
      { koId: "ko-1", titel: "Zylinderkopfdichtung XQ42 wechseln", fassung: 3, geprueft: true },
      { koId: "ko-2", titel: "Ventil F3", fassung: null, geprueft: null },
    ];
    const ok = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
      objektbezug: MARKIERUNG,
      antwortId: "ans-k3-1",
      quellen: ["ko-1", "ko-2"],
      quellenAngaben: angaben,
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const gelesen = ((await auf("GET", `${BASIS}/gespraech`)).json() as { gespraech: Sicht })
      .gespraech;
    expect(gelesen.nachrichten[0]?.quellenAngaben).toEqual(angaben);

    await eigeneAntwort("ans-k3-2");
    const erfunden = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: "x",
      objektbezug: SEITE_FRAGEN,
      antwortId: "ans-k3-2",
      quellen: ["ko-1"],
      quellenAngaben: [{ koId: "ko-9", titel: "Erfunden", fassung: 1, geprueft: true }],
    });
    expect(erfunden.statusCode).toBe(400);
    // Eine Frage trägt keine Quellenangaben.
    const frage = await auf("POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "x",
      objektbezug: SEITE_FRAGEN,
      quellenAngaben: [],
    });
    expect(frage.statusCode).toBe(400);
  });
});

describe("B3 · K6 — nur bekannte, gültige Bezugsangaben", () => {
  it("weist unbekannte Werte ab; eine Markierung ohne Bezug „Markierung“ ebenso", async () => {
    const g = await gespraechMitEinwilligung();
    const falsch: Record<string, unknown>[] = [
      { ...MARKIERUNG, bezug: "alles" },
      { ...MARKIERUNG, modus: "admin" },
      { ...MARKIERUNG, fassung: 0 },
      { ...MARKIERUNG, pruefstatus: "freigegeben" },
      { ...MARKIERUNG, bezug: "seite" }, // Markierungstext ohne Bezug „Markierung“
      { ...MARKIERUNG, auswahl: "x".repeat(301) },
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
