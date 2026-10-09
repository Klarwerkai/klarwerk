// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2), NACHARBEIT 1 — DER INTEGRIERTE PRODUKTWEG.
// ================================================================================================
//
// Bens Befund zu cfc43d4a: der Pflichtendienst hatte keinen produktiven Aufrufer. Gemessen wird
// hier der Weg, den das Produkt nimmt: Route → Planung in der Ablage der App → Hintergrundausführung
// → fassungsgebundener Prüfer → Konfliktprüfung des Reasoners; dazu Rechte, Fassungsbindung, „kein
// Modell" mit Fortsetzen und die Wiederaufnahme nach einem Dev-Neustart (Journal-Wiederaufbau).
// Postgres und Instanzwechsel: produktweg-pg.integration.test.ts. NICHT gemessen: ein echtes
// Modell (der Reasoner-Ausgang ist gestellt), eine Bedienfläche, ein echter Prozessabbruch.
import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  type JournalEntry,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import {
  PAARPFLICHT_MODELLWEG,
  PAARPFLICHT_PRUEFFASSUNG,
  paarpflichtPrueferFuer,
} from "../../services/app/src/paarpflicht-ausfuehrung";
import { paarpflichtAussagenLaden } from "../../services/app/src/paarpflicht-aussagen";
import type { ConflictJudgeOutcome } from "../../services/reasoner";

const KEIN_KONFLIKT: ConflictJudgeOutcome = {
  verdict: {
    relation: "kein_konflikt",
    older: null,
    confidence: 0.9,
    begruendung: "Verschiedene Geltung.",
    zitat_a: "",
    zitat_b: "",
  },
};
const OHNE_MODELL: ConflictJudgeOutcome = { verdict: null, failure: "no-model" };

function urteilt(s: AppServices, ausgang: ConflictJudgeOutcome = KEIN_KONFLIKT) {
  return vi.spyOn(s.reasoner, "judgeConflictOutcome").mockImplementation(async () => ausgang);
}

async function aussagen(s: AppServices, anzahl: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const ko = await s.ko.create({
      title: `Regel ${i}`,
      statement: `Aussage Nummer ${i} gilt im Betrieb.`,
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: i === 0 ? "vertraulich" : "intern",
    });
    ids.push(ko.id);
  }
  return ids;
}

async function anmelden(app: FastifyInstance, email: string): Promise<Record<string, string>> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

// Erste Registrierung ist die Verwaltung (hat `ko.validate`), dazu eine Leserin ohne das Recht.
async function zugaenge(app: FastifyInstance) {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const pruefer = await anmelden(app, "p@x.de");
  await app.inject({
    method: "POST",
    url: "/api/users",
    headers: pruefer,
    payload: { name: "Vera", email: "vera@x.de", password: "secret123", role: "viewer" },
  });
  return { pruefer, leserin: await anmelden(app, "vera@x.de") };
}

describe("Produktweg · Route, Hintergrundausführung, Reasoner", () => {
  it("K1–K3: ein gewählter Lauf mit fünf Aussagen wird gespeichert und im Hintergrund vollständig geurteilt", async () => {
    const s = buildServices();
    const judge = urteilt(s);
    const app = buildApp(s);
    const { pruefer } = await zugaenge(app);
    const ids = await aussagen(s, 5);

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/paarpflichten/laeufe",
      headers: pruefer,
      payload: { aussagen: ids },
    });
    expect(angelegt.statusCode).toBe(202);
    const { laufId } = angelegt.json() as { laufId: string };
    expect(angelegt.json().bilanz.gesamt).toBe(10);

    await s.paarpflichtAusfuehrung?.leerlauf();
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/paarpflichten/laeufe/${laufId}`,
      headers: pruefer,
    });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.json().bilanz).toMatchObject({ gesamt: 10, geurteilt: 10, rest: 0 });
    expect(gelesen.json().bilanz.abgeschlossen).toBe(true);
    expect(judge).toHaveBeenCalledTimes(10);
    // Die vertrauliche Aussage reist als Paarmarke an den Reasoner (er entscheidet den Modellweg).
    expect(judge.mock.calls.filter((c) => c[3] === true)).toHaveLength(4);

    const stempel = await s.ko.pruefbestandStempel();
    for (const p of await s.paarpflichten.liste(laufId)) {
      const ko = await s.ko.get(p.a.refId);
      expect(p.a.version).toBe(ko?.version);
      expect(p.kontext).toEqual({ bestand: stempel, pruefFassung: PAARPFLICHT_PRUEFFASSUNG });
      expect(p.urteil).toMatchObject({ ergebnis: "kein_konflikt", modell: PAARPFLICHT_MODELLWEG });
    }
    // Nichts mehr offen: nach einem Start gäbe es nichts wiederaufzunehmen.
    expect(await s.paarpflichten.offeneLaeufe()).toEqual([]);
  });

  it("Rechte und Auswahl: ohne ko.validate 403, ungültige Auswahl 400, unbekannte Aussage 404 — nichts angelegt", async () => {
    const s = buildServices();
    const judge = urteilt(s);
    const app = buildApp(s);
    const { pruefer, leserin } = await zugaenge(app);
    const ids = await aussagen(s, 3);
    const post = (payload: object, headers = pruefer) =>
      app.inject({ method: "POST", url: "/api/paarpflichten/laeufe", headers, payload });

    expect((await post({ aussagen: ids }, leserin)).statusCode).toBe(403);
    expect((await post({ aussagen: [ids[0]] })).statusCode).toBe(400);
    expect((await post({ aussagen: [ids[0], ids[0]] })).statusCode).toBe(400);
    expect((await post({})).statusCode).toBe(400);
    expect((await post({ aussagen: [ids[0], "gibt-es-nicht"] })).statusCode).toBe(404);
    const fremd = await app.inject({
      method: "GET",
      url: "/api/paarpflichten/laeufe/unbekannt",
      headers: pruefer,
    });
    expect(fremd.statusCode).toBe(404);

    await s.paarpflichtAusfuehrung?.leerlauf();
    expect(await s.paarpflichten.offeneLaeufe()).toEqual([]);
    expect(judge).not.toHaveBeenCalled();
  });

  it("K4: ohne Modell bleibt alles offen und nicht abgeschlossen; Fortsetzen urteilt, sobald ein Modell da ist", async () => {
    const s = buildServices();
    const judge = urteilt(s, OHNE_MODELL);
    const app = buildApp(s);
    const { pruefer } = await zugaenge(app);
    const ids = await aussagen(s, 3);
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/paarpflichten/laeufe",
      headers: pruefer,
      payload: { aussagen: ids },
    });
    const { laufId } = angelegt.json() as { laufId: string };
    await s.paarpflichtAusfuehrung?.leerlauf();
    // Eine Runde ohne Modell beendet den Durchgang — keine Endlosschleife, nichts als Urteil gezählt.
    expect(judge).toHaveBeenCalledTimes(3);
    expect(await s.paarpflichten.bilanz(laufId)).toMatchObject({
      geurteilt: 0,
      ohneModell: 3,
      rest: 3,
      abgeschlossen: false,
    });

    judge.mockImplementation(async () => KEIN_KONFLIKT);
    const weiter = await app.inject({
      method: "POST",
      url: `/api/paarpflichten/laeufe/${laufId}/fortsetzen`,
      headers: pruefer,
    });
    expect(weiter.statusCode).toBe(202);
    await s.paarpflichtAusfuehrung?.leerlauf();
    expect(judge).toHaveBeenCalledTimes(6);
    expect(await s.paarpflichten.bilanz(laufId)).toMatchObject({ geurteilt: 3, rest: 0 });
  });
});

describe("Fassungsbindung des Prüfers", () => {
  it("eine geänderte oder entfernte Aussage wird nicht unter dem alten Stand beurteilt", async () => {
    const s = buildServices();
    const judge = urteilt(s);
    const ids = await aussagen(s, 3);
    const { aussagen: gespeichert } = await paarpflichtAussagenLaden(s.ko, ids, "v");
    const [a, b, c] = gespeichert;
    if (!a || !b || !c) {
      throw new Error("drei Aussagen erwartet");
    }
    const pruefer = paarpflichtPrueferFuer({ ko: s.ko, reasoner: s.reasoner });
    const kontext = { bestand: "x", pruefFassung: "v" };

    expect(await pruefer(a, b, kontext)).toMatchObject({ art: "urteil" });
    expect(judge).toHaveBeenCalledTimes(1);

    // Einordnung ändert sich ohne Versionssprung → anderer Kontext → nicht mehr dieselbe Fassung.
    await s.ko.updateCategory(b.refId, "Anders", "u1");
    expect(await pruefer(a, b, kontext)).toEqual({ art: "fehler", grund: "fassung_ueberholt" });
    await s.ko.delete(c.refId, "u1");
    expect(await pruefer(a, c, kontext)).toEqual({ art: "fehler", grund: "aussage_fehlt" });
    expect(judge).toHaveBeenCalledTimes(1);
  });
});

describe("Wiederaufnahme nach einem Dev-Neustart (Journal)", () => {
  it("K3: ein begonnener Lauf überlebt den Wiederaufbau und wird beim Start ohne Doppelurteil fortgesetzt", async () => {
    const zeilen: JournalEntry[] = [];
    const vorher = assembleServices(journaledRepos(inMemoryRepos(), (e) => zeilen.push(e)));
    const ids = await aussagen(vorher, 3);
    const { aussagen: gewaehlt, kontext } = await paarpflichtAussagenLaden(
      vorher.ko,
      ids,
      PAARPFLICHT_PRUEFFASSUNG,
    );
    await vorher.paarpflichten.planen("lauf-neustart", gewaehlt, kontext);
    const erstes = urteilt(vorher);
    const pruefer = paarpflichtPrueferFuer({ ko: vorher.ko, reasoner: vorher.reasoner });
    await vorher.paarpflichten.abarbeiten("lauf-neustart", pruefer, { limit: 1 });
    expect(erstes).toHaveBeenCalledTimes(1);
    expect(zeilen.some((z) => z.repo === "paarpflichten" && z.method === "planen")).toBe(true);

    const repos = inMemoryRepos();
    await replayJournal(
      repos,
      zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    const nachher = assembleServices(repos);
    const zweites = urteilt(nachher);
    buildApp(nachher);
    await nachher.paarpflichtAusfuehrung?.leerlauf();

    expect(zweites).toHaveBeenCalledTimes(2);
    const pflichten = await nachher.paarpflichten.liste("lauf-neustart");
    expect(pflichten.filter((p) => p.urteil)).toHaveLength(3);
    expect(pflichten.every((p) => p.vorlagen === 1)).toBe(true);
    expect(await nachher.paarpflichten.bilanz("lauf-neustart")).toMatchObject({
      gesamt: 3,
      geurteilt: 3,
      rest: 0,
      abgeschlossen: true,
    });
  });
});
