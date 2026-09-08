// ================================================================================================
// JOB 3290 · B — EINE ÄNDERUNG, DIE EIN MENSCH AUSLÖST, TRÄGT „system" ALS HANDELNDEN.
// ================================================================================================
//
// DER BEFUND (Codex, seiteninventar 2, Live 1.185–1.187, Beleg 32-prioritaet-einzeln.png): zwei
// SELBST ausgelöste Prioritätsänderungen an derselben Wissenslücke erscheinen im Protokoll unter
// dem Handelnden „system". Der Filter auf das eigene Konto findet sie nicht — der Verantwortliche
// einer kuratierenden Entscheidung ist damit nicht mehr feststellbar, und das Protokoll behauptet
// obendrein etwas Falsches: eine automatische Änderung, die es nicht gab.
//
// DIE URSACHE, gemessen: `AskService.setGapPriority` schreibt `actor: "system"` FEST
// (`services/ask/src/service.ts`, `await this.audit?.record({ actor: "system", … })`). Es gibt in
// diese Methode aber gar keinen automatischen Weg aus dem Betrieb: der einzige Aufrufer ist
// `PUT /api/gaps/:id` hinter der Berechtigung `ko.assign` (`services/app/src/routes/ask-routes.ts`),
// und dort liegt der angemeldete Nutzer bereits in der Hand (`user.id`). Aufruferlos ist allein der
// Demo-Seed (`services/app/src/seed-demo.ts:723`) — und der IST automatisch.
//
// ================================================================================================
// WARUM DIESE DATEI DEN MANGEL MISST UND NICHT BEHEBT
// ================================================================================================
//
// Die Behebung sind zwei Zeilen: ein optionaler `actor` an `setGapPriority`, dort durch die
// VORHANDENE Modulregel `aufruferAus` geschickt (`service.ts`, JOB 541 D3 — ABWESENHEIT ist das
// Signal für Systemausführung, nie ein Wort), und `user.id` am Aufruf in `ask-routes.ts`. Beide
// Dateien stehen NICHT in den Zielpfaden dieses Auftrags; die Zielpfade nennen `gap-routes.ts` und
// `review-routes.ts`, die es im Produkt nicht gibt. Runde 1 hat sie trotzdem geändert und wurde
// dafür ROT (ZIELPFAD-VERSTOSS). Die Rückgabe nennt die Zielpfad-Korrektur, die der Auftrag braucht.
//
// Die Bauform ist dieselbe wie in `filter-inhalt.test.ts`: `it(...)` für den heutigen, zu
// erhaltenden Zustand und für die KALIBRIERUNG, `it.fails(...)` für den gewünschten, noch nicht
// gebauten. Gemessen wird über die ECHTEN HTTP-Routen — Registrieren, Anmelden, Fragen,
// `PUT /api/gaps/:id`, `GET /api/audit` —, kein Service-Direktaufruf und keine Repo-Manipulation.
//
// EIN GLEICHARTIGES EREIGNIS, BEWUSST NICHT ALS SOLLVERTRAG AUFGENOMMEN: `gap.created` trägt
// ebenfalls fest „system", obwohl eine Lücke entsteht, WEIL ein Mensch gefragt hat (der Fragende
// liegt als `createdBy` schon an der Lücke). Es hier zu fordern hiesse, einen ausdrücklichen Pin
// eines anderen Auftrags zu überstimmen — `services/app/src/addon-principal.test.ts:417`
// („Attribution unverändert", SCRUM-490 D1). Diese Entscheidung gehört Codex und Pedi, nicht
// dieser Bahn; die Rückgabe legt sie vor.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { stelleSuchprojektionBereit } from "../../services/app/src/search-projection-startup";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;
type Eintrag = { actor: string; action: string; target: string };

/** Ein angemeldetes Konto am ECHTEN Registrier-/Anmeldeweg. Das erste Konto wird Administrator. */
async function konto(
  app: App,
  name: string,
  email: string,
): Promise<{ headers: Kopf; id: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  const body = login.json();
  return { headers: { authorization: `Bearer ${body.token}` }, id: body.user.id as string };
}

/** Eine Frage ohne jede Deckung im Bestand → das Produkt legt eine ehrliche Wissenslücke an. */
async function offeneLuecke(app: App, headers: Kopf, frage: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: frage },
  });
  const gap = res.json().gap;
  if (!gap?.id) {
    throw new Error(`Keine Wissenslücke zu „${frage}" — der Prüfstand misst dann nichts.`);
  }
  return gap.id as string;
}

async function protokoll(
  app: App,
  headers: Kopf,
  suche: { action: string; actor?: string },
): Promise<Eintrag[]> {
  const query = suche.actor
    ? `action=${suche.action}&actor=${encodeURIComponent(suche.actor)}`
    : `action=${suche.action}`;
  const res = await app.inject({ method: "GET", url: `/api/audit?${query}`, headers });
  expect(res.statusCode).toBe(200);
  return res.json();
}

/** Der ganze Weg in einem Griff: Konto, Lücke, n Prioritätsänderungen — alles über HTTP. */
async function lage(stufen: readonly string[]): Promise<{
  app: App;
  admin: { headers: Kopf; id: string };
  gapId: string;
}> {
  const app = buildApp(buildServices());
  const admin = await konto(app, "Admin", "admin@x.de");
  const gapId = await offeneLuecke(
    app,
    admin.headers,
    "Wieviel Drehmoment hält eine Zwölfkantschraube?",
  );
  for (const stufe of stufen) {
    const res = await app.inject({
      method: "PUT",
      url: `/api/gaps/${gapId}`,
      headers: admin.headers,
      payload: { priority: stufe },
    });
    expect(res.statusCode, `PUT priority=${stufe} kam nicht durch`).toBe(200);
  }
  return { app, admin, gapId };
}

// ------------------------------------------------------------------------------------------------
// K — DIE KALIBRIERUNG, ausserhalb jedes erwarteten Fehlschlags.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 B/K · der Weg und die Messfläche funktionieren", () => {
  it("K1 · die Prioritätsänderung kommt an und erzeugt GENAU EINEN Protokolleintrag", async () => {
    const { app, admin, gapId } = await lage(["hoch"]);
    const alle = await protokoll(app, admin.headers, { action: "gap.priority-changed" });
    expect(alle).toHaveLength(1);
    expect(alle[0]?.target).toBe(gapId);
  });

  it("K2 · der Actor-Filter des Protokolls funktioniert überhaupt — belegt an `ask.query`", async () => {
    // Ohne diesen Fall wäre jedes leere Ergebnis unten mehrdeutig: fehlender Eintrag ODER kaputter
    // Filter. `ask.query` trägt den Aufrufer seit FR-ANA-02 und stammt aus DERSELBEN Anfrage, die
    // die Lücke erzeugt hat.
    const { app, admin } = await lage([]);
    const meine = await protokoll(app, admin.headers, { action: "ask.query", actor: admin.id });
    expect(meine.length).toBeGreaterThan(0);
    expect(await protokoll(app, admin.headers, { action: "ask.query", actor: "system" })).toEqual(
      [],
    );
  });

  it("K3 · DER BEFUND, als Tatsache festgehalten: der Eintrag steht heute unter „system“", async () => {
    const { app, admin } = await lage(["hoch", "niedrig"]);
    const alle = await protokoll(app, admin.headers, { action: "gap.priority-changed" });
    expect(alle).toHaveLength(2);
    expect(alle.map((e) => e.actor)).toEqual(["system", "system"]);
  });

  it("K4 · eine automatische Änderung OHNE Aufrufer steht unter „system“ — und soll es bleiben", async () => {
    // Der Weg des Demo-Seeds (`seed-demo.ts:723`): kein Aufrufer, also Systemausführung. Dieser
    // Fall gilt HEUTE und MUSS auch nach der Behebung gelten — sonst wäre sie eine Umbenennung
    // statt einer Unterscheidung. Er ist der einzige hier, der beide Zustände überlebt.
    const dienste = buildServices();
    // Derselbe EINE Starteinstieg, den App und CLI-Seed nehmen — ohne ihn ist die Standardsuche
    // fail-closed (`SEARCH_PROJECTION_NOT_READY`) und die Frage käme gar nicht bis zur Lücke.
    await stelleSuchprojektionBereit(dienste.ko);
    const { gap } = await dienste.ask.ask("Welche Farbe hat eine Zwölfkantschraube?", "u-fragend");
    if (!gap) {
      throw new Error("Lücke erwartet — ohne sie misst der Fall nichts.");
    }
    await dienste.ask.setGapPriority(gap.id, "hoch");
    const eintraege = await dienste.audit.list({ action: "gap.priority-changed" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe("system");
  });
});

// ------------------------------------------------------------------------------------------------
// B — DER SOLLVERTRAG. Heute kausal rot, nach der Behebung grün.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 B/S · SOLLVERTRAG: der Handelnde steht am Lücken-Ereignis", () => {
  it.fails(
    "B1 · der Filter auf das EIGENE Konto findet die eigene Prioritätsänderung",
    async () => {
      // Genau das, was Codex vergeblich versucht hat. Voraussetzungen ausserhalb dieses
      // Fehlschlags: K1 (der Eintrag existiert) und K2 (der Actor-Filter funktioniert).
      const { app, admin, gapId } = await lage(["hoch"]);
      const meine = await protokoll(app, admin.headers, {
        action: "gap.priority-changed",
        actor: admin.id,
      });
      expect(meine).toHaveLength(1);
      expect(meine[0]?.target).toBe(gapId);
    },
  );

  it.fails("B2 · derselbe Eintrag steht NICHT mehr unter dem Systemkontext", async () => {
    const { app, admin } = await lage(["niedrig"]);
    expect(
      await protokoll(app, admin.headers, { action: "gap.priority-changed", actor: "system" }),
    ).toEqual([]);
  });

  it.fails(
    "B3 · Codex' Fall wörtlich: ZWEI selbst ausgelöste Änderungen, beide unter dem Konto",
    async () => {
      const { app, admin, gapId } = await lage(["hoch", "niedrig"]);
      const meine = await protokoll(app, admin.headers, {
        action: "gap.priority-changed",
        actor: admin.id,
      });
      expect(meine).toHaveLength(2);
      expect(meine.every((e) => e.target === gapId)).toBe(true);
    },
  );
});
