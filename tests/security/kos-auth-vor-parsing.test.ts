import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";
import { KOS_BODY_LIMIT, KO_AKTIONEN_MIT_TORURTEIL } from "../../services/app/src/routes/ko-routes";

// ================================================================================================
// JOB 4115 · PUT /api/kos/:id — ABWEISUNG VOR DEM PARSEN, NICHT DANACH
// ================================================================================================
//
// DER ANLASS: Die Route trug keine eigene Annahmegrenze; es galt Fastifys Vorgabe von 1 MiB, und
// ein Word-Absatz mit Fotos passte nicht hindurch (gemessen: 1.520.700 Bytes → 413). JOB 4115 hebt
// die Grenze auf `KOS_BODY_LIMIT` (5 MiB, dieselbe Zahl wie der Entwurfsweg). Damit entsteht eine
// FÜNFFACH grössere Parser-Fläche — und die Frage, wer sie füllen darf. Ohne Riegel: jeder. Genau
// diese Halbheit hat das Haus schon zweimal behoben (`POST /api/drafts`, WP-D1d; `POST /api/objects`,
// JOB 2657 D1), und diese Datei ist nach der zweiten gebaut
// (`tests/security/objects-auth-vor-parsing.test.ts`).
//
// WARUM EIN 401-TEST HIER NICHTS BELEGEN WÜRDE — derselbe Grund wie dort, und er gilt hier
// besonders: 401 kam auch VORHER, nur eben nachdem der Körper gelesen und geparst war
// (`guards.requireUser` stand im Handler, hinter `ZIELOBJEKT_TOR[body.action]` — und `body` gibt es
// erst NACH dem Parsen). Ein Fall, der bloss den Statuscode eines kleinen anonymen Aufrufs prüft,
// wäre nach dem Fix grün UND war es vorher schon. Er hielte die Reihenfolge nicht fest. Gemessen
// wird deshalb ausschliesslich, was sich NUR unterscheidet, wenn der Körper ungelesen bleibt:
//
//   1. LIFECYCLE (der direkte Beleg): Fastifys `preParsing` läuft per Definition NACH allen
//      `onRequest`-Hooks und UNMITTELBAR VOR dem Body-Parsing. Ein Zähler darin, der bei einem
//      anonymen Aufruf auf 0 steht, IST die Reihenfolge. Die Gegenmessung an einem ANGEMELDETEN
//      Aufruf ist Pflicht: ohne sie wäre „0" auch mit einem nie eingehängten Hook zu haben.
//   2. STATUSCODE-KANTE: ein anonymer Körper ÜBER `KOS_BODY_LIMIT`. 413 kann nur entstehen, wenn
//      Fastify die Bytes gelesen und gewogen hat. Anonym muss 401 kommen.
//   3. PARSER-KANTE: ein anonymer Körper mit kaputtem JSON unter dem Limit. 400
//      `FST_ERR_CTP_INVALID_JSON` kann nur entstehen, wenn geparst wurde. Anonym muss 401 kommen.
//
// GEGENPROBE (gefahren, nicht behauptet): mit ausgehängtem `onRequest` fallen alle drei — der
// Zähler steht auf 1, die Kante antwortet 413, das kaputte JSON 400. Siehe RUECKGABE des Jobs.
//
// WAS DIESER RIEGEL NICHT IST: eine Rechteänderung. Er ruft `guards.requireUser` — dieselbe Wache,
// die der Handler für jede Aktion mit Torurteil `"tor"` ohnehin ruft. Dass auch die beiden übrigen
// Aktionen keinen anonymen Weg haben, ist erhoben und steht als eigener Fall unten; ohne diese
// Erhebung wäre der Riegel eine Annahme mit möglicher Betriebsfolge.

const ANONYM = { "content-type": "application/json" };

const KO_ROUTES_DATEI = "services/app/src/routes/ko-routes.ts";

/** Ein kleiner, gültiger Körper: angemeldet liefe er bis in den Handler. */
function gueltigeNutzlast(): string {
  return JSON.stringify({ action: "revalidate" });
}

/** Ein Körper deutlich über dem Ceiling — der Fall, in dem Fastify wiegen MÜSSTE, um 413 zu sagen. */
function nutzlastUeberDemLimit(): string {
  return JSON.stringify({ action: "revalidate", statement: "A".repeat(KOS_BODY_LIMIT + 1024) });
}

/**
 * Der Zähler wird VOR dem ersten `inject()` eingehängt; er zählt jeden Eintritt in die
 * Parsing-Phase auf dieser Route.
 */
function appMitParsingZaehler(): { app: FastifyInstance; parsingLaeufe: () => number } {
  const app = buildApp(buildServices());
  let laeufe = 0;
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url.startsWith("/api/kos/") && request.method === "PUT") {
      laeufe += 1;
    }
    return payload;
  });
  return { app, parsingLaeufe: () => laeufe };
}

async function alsAdminAnmelden(app: FastifyInstance): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${login.json().token}`, "content-type": "application/json" };
}

describe("JOB 4115: PUT /api/kos/:id weist ab, BEVOR der Körper gelesen wird", () => {
  it("die Annahmegrenze ist benannt, exportiert und so breit wie die des Entwurfswegs", () => {
    expect(KOS_BODY_LIMIT).toBe(5 * 1024 * 1024);
    // Die Begründung der Zahl ist „dieselbe wie am Entwurfsweg" — wer eine der beiden verschiebt,
    // ohne die andere zu bedenken, macht aus einer Begründung eine Behauptung.
    expect(KOS_BODY_LIMIT).toBe(DRAFTS_BODY_LIMIT);
  });

  it("anonym: die Parsing-Phase wird NIE betreten — angemeldet dagegen schon (Kontrolle)", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();

    const anonym = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers: ANONYM,
      payload: gueltigeNutzlast(),
    });
    expect(anonym.statusCode).toBe(401);
    // DIE AUSSAGE DES AUFTRAGS: abgewiesen, ohne dass der Körper geparst wurde.
    expect(parsingLaeufe()).toBe(0);

    // Die Kontrolle, die „0" belastbar macht: derselbe Zähler, dieselbe Route, angemeldet. Stünde
    // er auch hier auf 0, wäre der Hook nie gelaufen und der Fall darüber wertlos. Gemessen wird
    // zusätzlich die ANTWORT: „Unbekannte Aktion" kann nur sagen, wer `body.action` gelesen hat.
    const headers = await alsAdminAnmelden(app);
    const angemeldet = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers,
      payload: JSON.stringify({ action: "gibt-es-nicht" }),
    });
    expect(angemeldet.statusCode).toBe(400);
    expect(angemeldet.json()).toMatchObject({ message: "Unbekannte Aktion: gibt-es-nicht" });
    expect(parsingLaeufe()).toBe(1);
  });

  it("anonym und übergross: 401 statt 413 — die 5 MiB werden nicht einmal gewogen", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();
    const res = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers: ANONYM,
      payload: nutzlastUeberDemLimit(),
    });
    // 413 hiesse: gelesen, gewogen, dann erst geurteilt. Genau die Reihenfolge, die dieser Job dreht.
    expect(res.statusCode).toBe(401);
    expect(parsingLaeufe()).toBe(0);
    // Die Abweisung verrät die Grössenkante nicht — ein Anonymer erfährt nichts über die Fläche.
    expect(res.body).not.toContain(String(KOS_BODY_LIMIT));
    expect(res.body).not.toContain("FST_ERR");
  });

  it("anonym mit kaputtem JSON: 401 statt 400 — der Parser sieht die Bytes nicht", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();
    const res = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers: ANONYM,
      payload: '{"action":"revalidate"',
    });
    // Ein Syntaxfehler ist nur bemerkbar, wenn geparst wurde. 400 wäre der Beweis des Gegenteils.
    expect(res.statusCode).toBe(401);
    expect(parsingLaeufe()).toBe(0);
    expect(res.body).not.toContain("FST_ERR_CTP_INVALID_JSON");
  });

  it("angemeldet bleibt jede Kante, wie sie war: übergross → 413, kaputt → 400", async () => {
    const app = buildApp(buildServices());
    const headers = await alsAdminAnmelden(app);

    const uebergross = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers,
      payload: nutzlastUeberDemLimit(),
    });
    expect(uebergross.statusCode).toBe(413);
    expect(uebergross.json()).toMatchObject({ code: "FST_ERR_CTP_BODY_TOO_LARGE" });

    const kaputt = await app.inject({
      method: "PUT",
      url: "/api/kos/egal",
      headers,
      payload: '{"action":"revalidate"',
    });
    expect(kaputt.statusCode).toBe(400);
  });

  // ==============================================================================================
  // DIE ERHEBUNG, DIE DEN RIEGEL ERST ERLAUBT — UND SIE BLEIBT MESSBAR.
  // ==============================================================================================
  //
  // Der Riegel darf kein fachliches Recht ändern. Das stimmt nur, solange KEINE Aktion dieser
  // Route ohne angemeldeten Absender auskommt. Heute ist das so (erhoben an allen `case`-Zweigen,
  // s. den Kommentar über `requireAuthedBeforeParse`), und genau das hält dieser Fall fest: käme
  // morgen eine bewusst anonyme Aktion hinzu, wäre der Riegel eine stille Betriebsänderung — der
  // Fall wird dann rot und zwingt zur Entscheidung, statt sie zu verschweigen.
  it("keine Aktion dieser Route kommt ohne Anmeldung durch — an allen case-Zweigen erhoben", () => {
    const quelle = readFileSync(join(process.cwd(), KO_ROUTES_DATEI), "utf8");
    const aktionen = Object.keys(KO_AKTIONEN_MIT_TORURTEIL);
    expect(aktionen.length).toBeGreaterThan(15);

    // Die beiden Aktionen, die am Sichtbarkeitstor vorbeilaufen — benannt, nicht gezählt.
    const ohneTor = aktionen.filter((a) => KO_AKTIONEN_MIT_TORURTEIL[a] !== "tor");
    expect(ohneTor.sort()).toEqual(["conflict", "resolve-conflict"]);

    // Jeder `case` verlangt in seinen ersten Zeilen eine Wache. Gemessen am Quelltext des Zweigs
    // bis zum nächsten `case` — nicht am ganzen Handler, sonst bürgte ein fremder Zweig mit.
    for (const aktion of aktionen) {
      const start = quelle.indexOf(`case "${aktion}": {`);
      expect(start, `kein case-Zweig für ${aktion}`).toBeGreaterThan(0);
      const naechster = quelle.indexOf('case "', start + 8);
      const block = quelle.slice(start, naechster > 0 ? naechster : quelle.length);
      expect(
        /guards\.require(?:Permission\("[a-z.]+"\s*,|User\()/.test(block),
        `die Aktion ${aktion} prüft keine Anmeldung — dann ist der Riegel eine Rechteänderung`,
      ).toBe(true);
    }
  });
});
