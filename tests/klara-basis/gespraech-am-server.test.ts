// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) · DAS PERSÖNLICHE GESPRÄCH AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`).
// Jeder Schritt geht über HTTP. Nur der Antwortdatensatz, auf den sich eine Antwort beruft, wird über
// die vorhandene Antwortablage angelegt (wie in `tests/interaktionsgedaechtnis/`); den ganzen Weg mit
// echtem Frageweg misst `klara-echt-am-server.test.tsx`.
//
//   S1  Beginnen, Fragen, Antworten, letzter Schritt — mit Objektbezug, nach erneutem Lesen gleich.
//   S2  Eigentum: eine fremde Person liest, schreibt, löscht nichts; fremd und unbekannt sind gleich.
//   S3  Einwilligung: ohne sie keine Frage und keine Antwort aus dem Frageweg; Widerruf wirkt sofort.
//   S4  Eine Antwort aus dem Frageweg braucht eine EIGENE Antwortkennung.
//   S5  Prüfprotokoll mit Ereignissen, nie mit Frage, Antwort oder Objektbezug; ohne Anmeldung zu.
//   S6  KI-Abschaltung: derselbe Rumpf, den Klara an `/api/ask` schickt, wird mit 503 abgewiesen.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  InMemoryKlaraGespraechRepo,
  type KlaraGespraech,
  KlaraGespraechDienst,
} from "../../services/app/src/klara-gespraech";
import {
  KLARA_GESPRAECH_BEGONNEN,
  KLARA_GESPRAECH_EINWILLIGUNG,
  KLARA_GESPRAECH_GELOESCHT,
} from "../../services/app/src/routes/klara-gespraech-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const BASIS = "/api/me/klara";
const GEHEIME_FRAGE = "Wie lautet der Notcode der Presse 4?";
const GEHEIME_ANTWORT = "Der Notcode steht im Schichtbuch.";
const BEZUG = {
  pfad: "/erfassen",
  seitenName: "Erfassung",
  objekt: "Entwurf „Ölwechsel Presse 4“",
};
const ANDERER_BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

type Sicht = Omit<KlaraGespraech, "kontoId" | "fassung">;

async function beginne(wer: string, bezug: unknown = BEZUG): Promise<Sicht> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche`, { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: Sicht }).gespraech;
}

async function einwilligen(wer: string, id: string, erteilt = true): Promise<Sicht> {
  const r = await auf(wer, "PUT", `${BASIS}/gespraeche/${id}/einwilligung`, { erteilt });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { gespraech: Sicht }).gespraech;
}

async function eigeneAntwort(userId: string, answerId: string): Promise<void> {
  expect(
    await services.answerSnapshots.createRecord({
      answerId,
      askExecutionId: `exec-${answerId}`,
      createdAt: "2026-10-08T09:30:00.000Z",
      schemaVersion: 1,
      owner: { kind: "user", userId },
    }),
  ).toBe(true);
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@klara-basis.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@klara-basis.test");
  ada = { id: "", token: adminToken };
  erik = await konto(adminToken, "experte", "erik@klara-basis.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@klara-basis.test", "Vera Viewer");
});

describe("S1 · ein Gespräch unter der eigenen Person — mit Verlauf und Objektbezug", () => {
  it("beginnt mit Objektbezug, hält Frage, Antwort und letzten Schritt fest und liefert alles wieder", async () => {
    const g = await beginne(erik.token);
    expect(g.objektbezug).toEqual(BEZUG);
    expect(g.einwilligungAm).toBeNull();
    expect(g.nachrichten).toEqual([]);
    // Die Kontokennung geht nicht hinaus — der Fragende ist sie selbst.
    expect(JSON.stringify(g)).not.toContain(erik.id);

    await einwilligen(erik.token, g.id);
    const schritt = await auf(erik.token, "PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
      art: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
      stand: "laeuft",
    });
    expect(schritt.statusCode, schritt.body).toBe(200);
    const frage = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
    });
    expect(frage.statusCode, frage.body).toBe(201);
    await eigeneAntwort(erik.id, "ans-erik-1");
    const antwort = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ki",
      text: "Etwa 20 Minuten [1].",
      objektbezug: ANDERER_BEZUG,
      antwortId: "ans-erik-1",
      quellen: ["ko-1", "ko-1", "ko-2"],
      wissensklasse: "gesichert",
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    const fertig = await auf(erik.token, "PUT", `${BASIS}/gespraeche/${g.id}/schritt`, {
      art: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
      stand: "beantwortet",
    });
    const nachSchritt = (fertig.json() as { gespraech: Sicht }).gespraech;

    // Neu gelesen — wie nach Neuladen oder neuer Anmeldung: das zuletzt geführte eigene Gespräch.
    const gelesen = await auf(erik.token, "GET", `${BASIS}/gespraech`);
    expect(gelesen.statusCode).toBe(200);
    const sicht = (gelesen.json() as { gespraech: Sicht }).gespraech;
    expect(sicht.id).toBe(g.id);
    expect(sicht.objektbezug).toEqual(BEZUG);
    expect(sicht.nachrichten.map((n) => [n.von, n.modus, n.text])).toEqual([
      ["du", "frage", "Wie lange dauert der Ölwechsel?"],
      ["klara", "ki", "Etwa 20 Minuten [1]."],
    ]);
    expect(sicht.nachrichten[1]).toMatchObject({
      antwortId: "ans-erik-1",
      quellen: ["ko-1", "ko-2"],
      wissensklasse: "gesichert",
      objektbezug: ANDERER_BEZUG,
    });
    expect(sicht.letzterSchritt).toMatchObject({
      art: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
      stand: "beantwortet",
    });
    // Derselbe Schritt behält seinen Beginn — „läuft" und „beantwortet" sind EIN Schritt.
    expect(nachSchritt.letzterSchritt?.begonnenAm).toBe(sicht.letzterSchritt?.begonnenAm);
    const einzeln = await auf(erik.token, "GET", `${BASIS}/gespraeche/${g.id}`);
    expect((einzeln.json() as { gespraech: Sicht }).gespraech).toEqual(sicht);
  });

  it("ein neues Gespräch wird das aktuelle; das alte bleibt einzeln lesbar", async () => {
    const alt = await beginne(erik.token);
    const neu = await beginne(erik.token, ANDERER_BEZUG);
    const aktuell = (await auf(erik.token, "GET", `${BASIS}/gespraech`)).json() as {
      gespraech: Sicht;
    };
    expect(aktuell.gespraech.id).toBe(neu.id);
    const altGelesen = await auf(erik.token, "GET", `${BASIS}/gespraeche/${alt.id}`);
    expect(altGelesen.statusCode).toBe(200);
  });

  it("ohne Gespräch: `null`, kein Fehler", async () => {
    const r = await auf(vera.token, "GET", `${BASIS}/gespraech`);
    expect([r.statusCode, r.json()]).toEqual([200, { gespraech: null }]);
  });

  it("unzulässige Eingaben legen nichts an", async () => {
    const ohneBezug = await auf(erik.token, "POST", `${BASIS}/gespraeche`, {});
    const fremderPfad = await auf(erik.token, "POST", `${BASIS}/gespraeche`, {
      objektbezug: { ...BEZUG, pfad: "https://anderswo.test/" },
    });
    expect([ohneBezug.statusCode, fremderPfad.statusCode]).toEqual([400, 400]);
    expect((await auf(erik.token, "GET", `${BASIS}/gespraech`)).json()).toEqual({
      gespraech: null,
    });
    const g = await beginne(erik.token);
    const falscherModus = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "ki",
      text: "x",
      objektbezug: BEZUG,
    });
    expect(falscherModus.statusCode).toBe(400);
    expect(falscherModus.json()).toMatchObject({ error: "VALIDATION", grund: "eingabe" });
  });
});

describe("S2 · fremde Personen erhalten keinen Zugriff", () => {
  it("lesen, anhängen, Schritt, Einwilligung und Löschen: fremd und unbekannt antworten gleich 404", async () => {
    const g = await beginne(erik.token);
    await einwilligen(erik.token, g.id);

    expect((await auf(vera.token, "GET", `${BASIS}/gespraech`)).json()).toEqual({
      gespraech: null,
    });
    // Auch der Administrator liest kein fremdes Gespräch.
    expect((await auf(ada.token, "GET", `${BASIS}/gespraech`)).json()).toEqual({
      gespraech: null,
    });

    const versuche: [string, "GET" | "POST" | "PUT" | "DELETE", string, unknown][] = [
      ["lesen", "GET", "", undefined],
      [
        "anhängen",
        "POST",
        "/nachrichten",
        { von: "du", modus: "hilfe", text: "Hallo", objektbezug: BEZUG },
      ],
      [
        "schritt",
        "PUT",
        "/schritt",
        { art: "hilfe", text: "x", objektbezug: BEZUG, stand: "beantwortet" },
      ],
      ["einwilligung", "PUT", "/einwilligung", { erteilt: false }],
      ["löschen", "DELETE", "", undefined],
    ];
    for (const [name, methode, rest, payload] of versuche) {
      const fremd = await auf(vera.token, methode, `${BASIS}/gespraeche/${g.id}${rest}`, payload);
      const unbekannt = await auf(
        vera.token,
        methode,
        `${BASIS}/gespraeche/gibt-es-nicht${rest}`,
        payload,
      );
      expect([name, fremd.statusCode], fremd.body).toEqual([name, 404]);
      expect(fremd.body, `${name}: fremd und unbekannt antworten gleich`).toBe(unbekannt.body);
    }

    // Eriks Gespräch ist unverändert: Einwilligung steht, nichts angehängt, nicht gelöscht.
    const erikSicht = (await auf(erik.token, "GET", `${BASIS}/gespraech`)).json() as {
      gespraech: Sicht;
    };
    expect(erikSicht.gespraech.id).toBe(g.id);
    expect(erikSicht.gespraech.einwilligungAm).not.toBeNull();
    expect(erikSicht.gespraech.nachrichten).toEqual([]);
    expect(erikSicht.gespraech.letzterSchritt).toBeNull();
  });

  it("die eigene Person löscht ihr Gespräch; danach ist es auch für sie weg", async () => {
    const g = await beginne(erik.token);
    const weg = await auf(erik.token, "DELETE", `${BASIS}/gespraeche/${g.id}`);
    expect([weg.statusCode, weg.json()]).toEqual([200, { geloescht: 1 }]);
    expect((await auf(erik.token, "GET", `${BASIS}/gespraeche/${g.id}`)).statusCode).toBe(404);
    expect((await auf(erik.token, "GET", `${BASIS}/gespraech`)).json()).toEqual({
      gespraech: null,
    });
  });
});

describe("S3 · Einwilligung: ohne sie hält der Server nichts aus dem Frageweg fest", () => {
  it("Frage und Antwort ohne Einwilligung: 409 einwilligung_fehlt; Hilfe ohne KI geht", async () => {
    const g = await beginne(erik.token);
    await eigeneAntwort(erik.id, "ans-erik-ohne");
    const frage = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: GEHEIME_FRAGE,
      objektbezug: BEZUG,
    });
    const antwort = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "ohne_ki",
      text: GEHEIME_ANTWORT,
      objektbezug: BEZUG,
      antwortId: "ans-erik-ohne",
    });
    expect([frage.statusCode, antwort.statusCode]).toEqual([409, 409]);
    expect(frage.json()).toMatchObject({ error: "CONFLICT", grund: "einwilligung_fehlt" });

    const hilfe = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "klara",
      modus: "hilfetext",
      text: "Diese Seite erfasst Wissen.",
      objektbezug: BEZUG,
    });
    expect(hilfe.statusCode, hilfe.body).toBe(201);

    // Erteilt → geht; widerrufen → sofort wieder 409.
    const erteilt = await einwilligen(erik.token, g.id);
    expect(erteilt.einwilligungAm).not.toBeNull();
    const mit = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "Erlaubte Frage",
      objektbezug: BEZUG,
    });
    expect(mit.statusCode, mit.body).toBe(201);
    const widerrufen = await einwilligen(erik.token, g.id, false);
    expect(widerrufen.einwilligungAm).toBeNull();
    const danach = await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: "Nach dem Widerruf",
      objektbezug: BEZUG,
    });
    expect(danach.statusCode).toBe(409);
    const sicht = (await auf(erik.token, "GET", `${BASIS}/gespraeche/${g.id}`)).json() as {
      gespraech: Sicht;
    };
    expect(sicht.gespraech.nachrichten.map((n) => n.text)).toEqual([
      "Diese Seite erfasst Wissen.",
      "Erlaubte Frage",
    ]);
  });
});

describe("S4 · eine Antwort aus dem Frageweg braucht eine eigene Antwortkennung", () => {
  it("fremde, unbekannte und fehlende Kennung werden abgewiesen; nur ki/ohne_ki tragen sie", async () => {
    const g = await beginne(vera.token);
    await einwilligen(vera.token, g.id);
    await eigeneAntwort(erik.id, "ans-erik-fremd");
    const nachricht = (antwortId: unknown, modus = "ki") =>
      auf(vera.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
        von: "klara",
        modus,
        text: "Behauptete KI-Antwort",
        objektbezug: BEZUG,
        ...(antwortId === undefined ? {} : { antwortId }),
      });
    const fremd = await nachricht("ans-erik-fremd");
    const unbekannt = await nachricht("ans-gibt-es-nicht");
    expect([fremd.statusCode, unbekannt.statusCode]).toEqual([404, 404]);
    expect(fremd.body).toBe(unbekannt.body);
    expect((await nachricht(undefined)).statusCode).toBe(400);
    // Ein Fehlerhinweis darf keine Antwortkennung tragen — sonst sähe er aus wie eine Antwort.
    await eigeneAntwort(vera.id, "ans-vera-1");
    expect((await nachricht("ans-vera-1", "fehler")).statusCode).toBe(400);
    expect((await nachricht("ans-vera-1", "ki")).statusCode).toBe(201);
  });
});

describe("S5 · Prüfprotokoll ohne Inhalt, keine Tür ohne Anmeldung", () => {
  it("Beginn, Einwilligung und Löschen stehen im Protokoll — nie Frage, Antwort oder Objekt", async () => {
    const g = await beginne(erik.token);
    await einwilligen(erik.token, g.id);
    await auf(erik.token, "POST", `${BASIS}/gespraeche/${g.id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text: GEHEIME_FRAGE,
      objektbezug: BEZUG,
    });
    await auf(erik.token, "DELETE", `${BASIS}/gespraeche/${g.id}`);
    const begonnen = await services.audit.list({ action: KLARA_GESPRAECH_BEGONNEN });
    const einwilligung = await services.audit.list({ action: KLARA_GESPRAECH_EINWILLIGUNG });
    const geloescht = await services.audit.list({ action: KLARA_GESPRAECH_GELOESCHT });
    expect(begonnen.map((e) => e.target)).toEqual([`klara-gespraech:${g.id}`]);
    expect(einwilligung[0]?.payload).toEqual({ erteilt: true });
    expect(geloescht).toHaveLength(1);
    expect([...begonnen, ...einwilligung, ...geloescht].every((e) => e.actor === erik.id)).toBe(
      true,
    );
    const protokoll = JSON.stringify([...begonnen, ...einwilligung, ...geloescht]);
    for (const inhalt of [GEHEIME_FRAGE, "Ölwechsel Presse 4", "/erfassen"]) {
      expect(protokoll).not.toContain(inhalt);
    }
  });

  it("ohne Anmeldung ist jede der sieben Türen zu", async () => {
    const versuche = await Promise.all([
      auf("", "GET", `${BASIS}/gespraech`),
      auf("", "POST", `${BASIS}/gespraeche`, { objektbezug: BEZUG }),
      auf("", "GET", `${BASIS}/gespraeche/x`),
      auf("", "POST", `${BASIS}/gespraeche/x/nachrichten`, {}),
      auf("", "PUT", `${BASIS}/gespraeche/x/schritt`, {}),
      auf("", "PUT", `${BASIS}/gespraeche/x/einwilligung`, { erteilt: true }),
      auf("", "DELETE", `${BASIS}/gespraeche/x`),
    ]);
    expect(versuche.map((v) => v.statusCode)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });

  it("der Postgres-Betrieb hängt die haltbare Ablage ein, und `migrate()` legt die Tabelle an", () => {
    const wurzel = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    expect(wurzel).toMatch(/klaraGespraeche: new PgKlaraGespraechRepo\(pool\)/);
    const db = readFileSync(new URL("../../services/app/src/db.ts", import.meta.url), "utf8");
    expect(db).toMatch(/^\s+KLARA_GESPRAECH_SCHEMA,$/m);
  });
});

describe("S5b · zwei gleichzeitige Schreiber überschreiben einander nicht", () => {
  it("beide Nachrichten bleiben erhalten (Standvergleich mit Wiederholung)", async () => {
    const repo = new InMemoryKlaraGespraechRepo();
    const dienst = new KlaraGespraechDienst({ repo });
    const g = await dienst.beginne("konto-1", BEZUG);
    await dienst.setzeEinwilligung("konto-1", g.id, true);
    await Promise.all([
      dienst.fuegeHinzu("konto-1", g.id, {
        von: "du",
        modus: "frage",
        text: "aus Tab A",
        objektbezug: BEZUG,
      }),
      dienst.fuegeHinzu("konto-1", g.id, {
        von: "du",
        modus: "frage",
        text: "aus Tab B",
        objektbezug: BEZUG,
      }),
    ]);
    const nachher = await dienst.hole("konto-1", g.id);
    expect(nachher.nachrichten.map((n) => n.text).sort()).toEqual(["aus Tab A", "aus Tab B"]);
  });
});

describe("S6 · die KI-Abschaltung wirkt auf Klaras Frageweg", () => {
  it("Klaras Rumpf an `/api/ask` bekommt bei abgeschalteter KI 503 KI_ABGESCHALTET — kein Inhalt", async () => {
    const aus = await auf(ada.token, "PUT", "/api/reasoner/config", { global: "deterministic" });
    expect(aus.statusCode, aus.body).toBe(200);
    const status = await auf(erik.token, "GET", "/api/reasoner/status");
    expect((status.json() as { kiAbgeschaltet?: boolean }).kiAbgeschaltet).toBe(true);
    // Derselbe Rumpf wie `klaraGespraechApi.frage`: Frage, Sprache, Faden der vorigen Fragen.
    const frage = await auf(erik.token, "POST", "/api/ask", {
      question: GEHEIME_FRAGE,
      locale: "de",
      thread: ["Vorige Frage"],
    });
    expect(frage.statusCode).toBe(503);
    expect(frage.json()).toMatchObject({ error: "KI_ABGESCHALTET" });
    expect(frage.body).not.toContain("Presse 4");
  });
});
