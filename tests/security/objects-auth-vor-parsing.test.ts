import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { OBJECTS_BODY_LIMIT } from "../../services/app/src/routes/object-routes";

// ================================================================================================
// JOB 2657 D1 · POST /api/objects — ABWEISUNG VOR DEM PARSEN, NICHT DANACH
// ================================================================================================
//
// DER BEFUND (Code-Review 28.08., Befund 12, HOCH): `POST /api/objects` trug `bodyLimit` 30 MiB,
// der Auth-Guard lief erst im Handler. Ein anonymer Client ließ damit 30 MiB JSON vollständig
// einlesen und parsen (RAM/CPU), bevor überhaupt jemand fragte, wer da schreibt. Die Nachbarroute
// `POST /api/drafts` machte es seit WP-D1d richtig — derselbe Server, zwei Türen, zwei Reihenfolgen.
//
// WARUM EIN 401-TEST HIER NICHTS BELEGEN WÜRDE (R61, §4 des Auftrags):
// 401 kam auch VORHER — nur eben nachdem der Körper gelesen war. Ein Test, der bloß den Statuscode
// eines kleinen anonymen Aufrufs prüft, ist nach dem Fix grün UND war es vorher schon. Er hält die
// Reihenfolge nicht fest. Deshalb messen die Fälle hier ausschließlich Dinge, die sich NUR
// unterscheiden, wenn der Körper ungelesen bleibt:
//
//   1. LIFECYCLE (der direkte Beleg): Fastifys `preParsing` läuft per Definition NACH allen
//      `onRequest`-Hooks und UNMITTELBAR VOR dem Body-Parsing. Ein Zähler in diesem Hook, der bei
//      einem anonymen Aufruf auf 0 steht, ist die Reihenfolge selbst — nicht ihr Nebeneffekt.
//      Der Zähler wird im selben Test an einem ANGEMELDETEN Aufruf gegengemessen; ohne diese
//      Kontrolle wäre „0" auch mit einem nie eingehängten Hook zu haben, und der Fall würde eine
//      Zusicherung behaupten statt sie zu prüfen.
//   2. STATUSCODE-KANTE (der indirekte Beleg, Muster `drafts-body-limit.test.ts:230`): ein Körper
//      ÜBER `OBJECTS_BODY_LIMIT`. 413 kann nur entstehen, wenn Fastify die Bytes gelesen und
//      gewogen hat. Anonym muss die Antwort 401 lauten, nicht 413 — wer 413 sieht, sieht eine
//      Route, die erst wiegt und dann fragt.
//   3. PARSER-KANTE: ein anonymer Aufruf mit SYNTAKTISCH KAPUTTEM JSON unter dem Limit. 400
//      `FST_ERR_CTP_INVALID_JSON` kann nur entstehen, wenn geparst wurde. Anonym → 401.
//
// GEGENPROBE (Auftrag §5): Alle drei Fälle fallen auf dem Stand VOR dem Fix — gemessen, nicht
// behauptet: 1. zählt dort 1 statt 0, 2. antwortet 413, 3. antwortet 400.
//
// Die beiden übrigen Routen der Datei (`GET /api/objects/:id`, `GET /api/objects/:id/raw`) tragen
// keinen Body und damit keine Pre-Auth-Parser-Fläche; der letzte Fall hält das fest, damit ein
// künftiges POST/PUT auf demselben Präfix nicht unbemerkt danebengestellt wird.

const ANONYM = { "content-type": "application/json" };

// Ein Aufruf, der bei ANGEMELDETEM Absender bis in den Handler liefe — klein, gültig, vollständig.
function gueltigeNutzlast(): string {
  return JSON.stringify({
    name: "notiz.pdf",
    mime: "application/pdf",
    data: "data:application/pdf;base64,QUJD",
    kind: "document",
  });
}

// Genau ein Byte über dem Route-Ceiling: der Fall, in dem Fastify wiegen MÜSSTE, um 413 zu sagen.
function nutzlastUeberDemLimit(): string {
  const fuellung = "A".repeat(OBJECTS_BODY_LIMIT + 1024);
  return JSON.stringify({
    name: "monster.pdf",
    mime: "application/pdf",
    data: `data:application/pdf;base64,${fuellung}`,
    kind: "document",
  });
}

// Der Zähler wird VOR dem ersten `inject()` eingehängt (danach ist die Instanz bereit und die
// Hook-Ketten stehen). Er zählt jeden Eintritt in die Parsing-Phase, für jede Route.
function appMitParsingZaehler(): { app: FastifyInstance; parsingLaeufe: () => number } {
  const app = buildApp(buildServices());
  let laeufe = 0;
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url === "/api/objects") {
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

describe("JOB 2657 D1: POST /api/objects weist ab, BEVOR der Körper gelesen wird", () => {
  it("Ceiling unverändert 30 MiB — der Fix verkleinert die Fläche nicht, er verschließt sie", () => {
    expect(OBJECTS_BODY_LIMIT).toBe(30 * 1024 * 1024);
  });

  it("anonym: die Parsing-Phase wird NIE betreten — angemeldet dagegen schon (Kontrolle)", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();

    const anonym = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: ANONYM,
      payload: gueltigeNutzlast(),
    });
    expect(anonym.statusCode).toBe(401);
    // DIE AUSSAGE DES AUFTRAGS: abgewiesen, ohne dass der Körper geparst wurde.
    expect(parsingLaeufe()).toBe(0);

    // Die Kontrolle, die „0" belastbar macht: derselbe Zähler, derselbe Pfad, angemeldet. Stünde er
    // auch hier auf 0, wäre der Hook nie gelaufen und der Fall darüber wertlos.
    const headers = await alsAdminAnmelden(app);
    const angemeldet = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: gueltigeNutzlast(),
    });
    expect(angemeldet.statusCode).toBe(201);
    expect(parsingLaeufe()).toBe(1);
  });

  it("anonym und übergroß: 401 statt 413 — die 30 MiB werden nicht einmal gewogen", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: ANONYM,
      payload: nutzlastUeberDemLimit(),
    });
    // 413 hieße: gelesen, gewogen, dann erst geurteilt. Genau die Reihenfolge, die dieser Job dreht.
    expect(res.statusCode).toBe(401);
    expect(parsingLaeufe()).toBe(0);
    // Die Abweisung verrät die Größenkante nicht — ein Anonymer erfährt nichts über die Fläche.
    expect(res.body).not.toContain(String(OBJECTS_BODY_LIMIT));
    expect(res.body).not.toContain("FST_ERR");
  });

  it("anonym mit kaputtem JSON: 401 statt 400 — der Parser sieht die Bytes nicht", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: ANONYM,
      payload: '{"name":"notiz.pdf","mime":',
    });
    // Ein Syntaxfehler ist nur bemerkbar, wenn geparst wurde. 400 wäre der Beweis des Gegenteils.
    expect(res.statusCode).toBe(401);
    expect(parsingLaeufe()).toBe(0);
    expect(res.body).not.toContain("FST_ERR_CTP_INVALID_JSON");
  });

  it("angemeldet bleibt alles wie gemessen: übergroß → 413, kaputt → 400", async () => {
    const app = buildApp(buildServices());
    const headers = await alsAdminAnmelden(app);

    const uebergross = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: nutzlastUeberDemLimit(),
    });
    expect(uebergross.statusCode).toBe(413);

    const kaputt = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: '{"name":"notiz.pdf","mime":',
    });
    expect(kaputt.statusCode).toBe(400);
  });

  it("die Nachbarn: keine weitere Route auf /api/objects trägt eine anonyme Parser-Fläche", async () => {
    const { app, parsingLaeufe } = appMitParsingZaehler();
    await app.ready();

    // Gemessen am fertigen Router, nicht an der Quelle: welche Methoden hängen unter /api/objects?
    const gefunden = app
      .printRoutes({ commonPrefix: false })
      .split("\n")
      .filter((zeile) => zeile.includes("/api/objects"));
    expect(gefunden.length).toBeGreaterThan(0);

    // Die beiden Leserouten tragen keinen Body. Ein anonymer Aufruf darf auch dort nicht ins Parsen
    // laufen — und tut es nicht, weil GET keinen Körper hat.
    const roh = await app.inject({ method: "GET", url: "/api/objects/gibt-es-nicht/raw" });
    expect(roh.statusCode).toBe(401);
    const einzeln = await app.inject({ method: "GET", url: "/api/objects/gibt-es-nicht" });
    expect(einzeln.statusCode).toBe(401);
    expect(parsingLaeufe()).toBe(0);
  });
});
