// ================================================================================================
// JOB 3956 · Q9-ENTWURFSFEHLER — DIE DREI LETZTEN ROHEN DEUTSCHEN SÄTZE, AM ECHTEN DRAHT.
// ================================================================================================
//
// DIE LAGE, DIE DIESE DATEI BEENDET. Wer die Oberfläche auf Englisch oder Niederländisch gestellt
// hat und einen Entwurf über einen alten Link fortsetzen will, las bis hierher „Entwurf nicht
// gefunden." — auf Deutsch, mitten in einer englischen Sitzung. Dasselbe beim fremden Entwurf
// („Entwurf nicht verfuegbar.", `capture-routes.ts`) und am RBAC-Wächter („Keine Berechtigung.",
// `services/rbac/src/guard.ts`). Drei Stellen, drei Katalogschlüssel, ein Weg — derselbe, den
// JOB 3792 für den 403-Satz des Rechtetors gebaut hat.
//
// GEPRÜFT WIRD AM DRAHT, NICHT AM DIFF (Bauart: `tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts`):
// eine echte App aus `buildApp(buildServices())`, echte Konten über die echten Routen, echte
// Anmeldung, `app.inject` mit echtem `accept-language`-Kopf. Dass `meldung(...)` im Quelltext
// steht, ist kein Nutzen; dass drei Sprachen aus einer echten Antwort kommen, ist einer.
//
// DREI STELLEN, DREI ZUGÄNGE — und warum der dritte anders aussieht:
//   E  unbekannte Entwurfskennung   → `GET /api/drafts/:id` → 404 NOT_FOUND  (DRAFT_NOT_FOUND)
//   F  fremder, lebender Entwurf    → `GET /api/drafts/:id` → 403 FORBIDDEN  (DRAFT_NOT_VISIBLE)
//   G  der RBAC-Wächter             → eigene Fastify-Instanz → 403 FORBIDDEN (PERMISSION_DENIED)
// `services/rbac`s `requirePermission` hat im Produkt heute KEINEN Aufrufer (gemessen: nur
// `services/rbac/index.ts` exportiert ihn, die Routen fahren das Rechtetor aus
// `services/app/src/http.ts`). Es gibt also keine echte Route, an der sein 403 entsteht. Statt eine
// zu erfinden, wird der Wächter so gefahren, wie ihn ein Einbau fahren WÜRDE — als `preHandler`
// einer echten Fastify-Route, wörtlich wie `tests/q9-fremde-flaechen/wachter-sprache.test.ts:86-93`.
// Das ist der ehrliche Zuschnitt: eine echte HTTP-Antwort eines echten Wächters, und keine
// Behauptung über einen Weg, den es im Produkt nicht gibt.
//
// H1–H3 HALTEN DEN DRAHT NACH AUSSEN FEST. Status und `error`-Code sind Vertrag und ändern sich
// NICHT, weil der Satz übersetzt wird: `toEqual` statt `toMatchObject`, damit auch ein
// hinzugekommenes Feld auffällt.
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { requirePermission } from "../../services/rbac";

type App = ReturnType<typeof buildApp>;
type Koerper = { error?: unknown; message?: unknown };
interface Antwort {
  status: number;
  koerper: Koerper;
}

const PASSWORT = "geheim12345";
/** Eine Kennung, die es auf diesem Server nie gab — der Fall „der Link ist alt, der Entwurf weg". */
const UNBEKANNT = "diese-entwurfskennung-gibt-es-nicht";

let app: App;
let waechter: FastifyInstance;
let tokenEignerin = "";
let tokenFremde = "";
let eigeneKennung = "";

async function anmelden(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return (res.json() as { token: string }).token;
}

/** E und F: derselbe Abruf, nur mit anderem Token und anderer Kennung. */
async function entwurfsabruf(token: string, id: string, sprache?: string): Promise<Antwort> {
  const res = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: {
      authorization: `Bearer ${token}`,
      ...(sprache ? { "accept-language": sprache } : {}),
    },
  });
  return { status: res.statusCode, koerper: res.json() as Koerper };
}

/**
 * G: der RBAC-Wächter mit einer Rolle, die das Recht NICHT hat. `viewer` trägt nur `ko.read`
 * (`services/rbac/src/policy.ts`), also läuft `can(role, "users.manage")` auf `false` und der
 * 403-Zweig antwortet — derselbe Zweig, den ein Einbau bekäme.
 */
async function waechterabruf(sprache?: string): Promise<Antwort> {
  const res = await waechter.inject({
    method: "GET",
    url: "/probe",
    ...(sprache ? { headers: { "accept-language": sprache } } : {}),
  });
  return { status: res.statusCode, koerper: res.json() as Koerper };
}

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Verwaltung", email: "verwaltung@q9entwurf.test", password: PASSWORT },
  });
  const admin = await anmelden("verwaltung@q9entwurf.test");
  for (const email of ["eignerin@q9entwurf.test", "fremde@q9entwurf.test"]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: email, email, password: PASSWORT, role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  tokenEignerin = await anmelden("eignerin@q9entwurf.test");
  tokenFremde = await anmelden("fremde@q9entwurf.test");

  // `canSeeDraft` trennt nach EIGENTUM, nicht nach Recht: beide Konten tragen `ko.create`, nur
  // eines legt den Entwurf an. Ohne diesen Unterschied gäbe es den 403-Fall gar nicht.
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${tokenEignerin}` },
    payload: {
      title: "Ventilwartung Nordstrang",
      statement: "Vor jedem Anlauf die Schmierstellen pruefen.",
      type: "best_practice",
      category: "Fertigung",
      confidentiality: "intern",
      bodyHtml: "<p>Kesselhaus Nordstrang Schmierstellenliste 3956</p>",
    },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Entwurf nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  eigeneKennung = (angelegt.json() as { id: string }).id;

  waechter = Fastify();
  waechter.get("/probe", {
    preHandler: requirePermission("users.manage", () => "viewer"),
    handler: async (_request, reply) => reply.send({ durchgelassen: true }),
  });
});

afterAll(async () => {
  await app?.close();
  await waechter?.close();
});

// ------------------------------------------------------------------------------------------------
// E · DIE UNBEKANNTE KENNUNG
// ------------------------------------------------------------------------------------------------
describe("E · `Entwurf nicht gefunden.` spricht die Sprache der Sitzung", () => {
  it("E1 EN · unbekannte Entwurfskennung: 404 NOT_FOUND mit englischem Satz", async () => {
    const antwort = await entwurfsabruf(tokenEignerin, UNBEKANNT, "en");
    expect(antwort.status).toBe(404);
    expect(antwort.koerper.error).toBe("NOT_FOUND");
    // WÖRTLICH: ein deutscher oder schiefer Satz im `en`-Feld des Katalogs fällt hier auf.
    expect(antwort.koerper.message).toBe("Draft not found.");
    // AUS DEM KATALOG: ein zweites Literal im Code oder ein verstellter Schlüssel fällt hier auf.
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_NOT_FOUND.en);
    expect(String(antwort.koerper.message)).not.toMatch(/Entwurf|gefunden|Unerwarteter/);
  });

  it("E2 NL · unbekannte Entwurfskennung: 404 NOT_FOUND mit niederländischem Satz", async () => {
    const antwort = await entwurfsabruf(tokenEignerin, UNBEKANNT, "nl");
    expect(antwort.status).toBe(404);
    expect(antwort.koerper.error).toBe("NOT_FOUND");
    expect(antwort.koerper.message).toBe("Concept niet gevonden.");
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_NOT_FOUND.nl);
    expect(String(antwort.koerper.message)).not.toMatch(/Entwurf|gefunden|Unerwarteter/);
  });

  it("E3 DE · unbekannte Entwurfskennung: zeichengleicher deutscher Wortlaut", async () => {
    // DER WÄCHTER GEGEN DIE EIGENE ABLÖSUNG: mehrere Bestandstests pinnen genau diesen Satz
    // (u. a. `tests/entwurf-fortsetzen-fehlersatz/serversatz-bis-blatt.test.tsx:173`,
    // `tests/capture/job2690-entwurf-gestaltpruefung.test.tsx:381`).
    for (const sprache of [undefined, "de", "fr"]) {
      const antwort = await entwurfsabruf(tokenEignerin, UNBEKANNT, sprache);
      expect(antwort.status, String(sprache)).toBe(404);
      expect(antwort.koerper, String(sprache)).toEqual({
        error: "NOT_FOUND",
        message: "Entwurf nicht gefunden.",
      });
    }
  });
});

// ------------------------------------------------------------------------------------------------
// F · DER FREMDE ENTWURF
// ------------------------------------------------------------------------------------------------
describe("F · `Entwurf nicht verfuegbar.` spricht die Sprache der Sitzung", () => {
  it("F1 EN · fremder Entwurf: 403 FORBIDDEN mit englischem Satz", async () => {
    const antwort = await entwurfsabruf(tokenFremde, eigeneKennung, "en");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("This draft is not available to you.");
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_NOT_VISIBLE.en);
    expect(String(antwort.koerper.message)).not.toMatch(/Entwurf|verfuegbar|Unerwarteter/);
  });

  it("F2 NL · fremder Entwurf: 403 FORBIDDEN mit niederländischem Satz", async () => {
    const antwort = await entwurfsabruf(tokenFremde, eigeneKennung, "nl");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("Dit concept is niet voor jou beschikbaar.");
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_NOT_VISIBLE.nl);
    expect(String(antwort.koerper.message)).not.toMatch(/Entwurf|verfuegbar|Unerwarteter/);
  });

  it("F3 DE · fremder Entwurf: zeichengleicher deutscher Wortlaut", async () => {
    for (const sprache of [undefined, "de", "fr"]) {
      const antwort = await entwurfsabruf(tokenFremde, eigeneKennung, sprache);
      expect(antwort.status, String(sprache)).toBe(403);
      expect(antwort.koerper, String(sprache)).toEqual({
        error: "FORBIDDEN",
        message: "Entwurf nicht verfuegbar.",
      });
    }
  });

  it("F4 · es sind ZWEI Sätze und nicht einer doppelt — in jeder Sprache", async () => {
    // Ohne diesen Fall bliebe ein Katalog grün, in dem beide Schlüssel denselben Text tragen: die
    // Unterscheidung „gibt es nicht" gegen „gehört jemand anderem" wäre für den Menschen weg.
    for (const sprache of ["de", "en", "nl"] as const) {
      expect(MELDUNGEN.DRAFT_NOT_FOUND[sprache]).not.toBe(MELDUNGEN.DRAFT_NOT_VISIBLE[sprache]);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// G · DER RBAC-WÄCHTER
// ------------------------------------------------------------------------------------------------
describe("G · `Keine Berechtigung.` spricht die Sprache der Sitzung", () => {
  it("G1 EN · der RBAC-Wächter: 403 FORBIDDEN mit englischem Satz", async () => {
    const antwort = await waechterabruf("en");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("You do not have permission.");
    expect(antwort.koerper.message).toBe(MELDUNGEN.PERMISSION_DENIED.en);
    expect(String(antwort.koerper.message)).not.toMatch(/Berechtigung|Unerwarteter/);
  });

  it("G2 NL · der RBAC-Wächter: 403 FORBIDDEN mit niederländischem Satz", async () => {
    const antwort = await waechterabruf("nl");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("Je hebt geen toestemming.");
    expect(antwort.koerper.message).toBe(MELDUNGEN.PERMISSION_DENIED.nl);
    expect(String(antwort.koerper.message)).not.toMatch(/Berechtigung|Unerwarteter/);
  });

  it("G3 DE · der RBAC-Wächter: zeichengleicher deutscher Wortlaut", async () => {
    for (const sprache of [undefined, "de", "fr"]) {
      const antwort = await waechterabruf(sprache);
      expect(antwort.status, String(sprache)).toBe(403);
      expect(antwort.koerper, String(sprache)).toEqual({
        error: "FORBIDDEN",
        message: "Keine Berechtigung.",
      });
    }
  });

  it("G4 · der zusammengesetzte Sprachkopf wird beachtet", async () => {
    // Der Browser schickt selten ein nacktes `en`. Ohne diesen Fall wäre eine Sprachermittlung
    // grün, die nur den einfachsten Kopf versteht.
    for (const kopf of ["en-GB,en;q=0.9", "de;q=0.2,en;q=0.9", "nl;q=0,en;q=0.5"]) {
      const antwort = await waechterabruf(kopf);
      expect(antwort.status, kopf).toBe(403);
      expect(antwort.koerper.message, kopf).toBe(MELDUNGEN.PERMISSION_DENIED.en);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// H · DER DRAHT NACH AUSSEN IST KEIN TEIL DIESER ÄNDERUNG
// ------------------------------------------------------------------------------------------------
// Diese drei Fälle nennen KEINEN Satz: sie halten Status und Fehlercode fest, und zwar in allen
// drei Sprachen. Eine Übersetzung, die nebenbei den Vertrag nach aussen verschiebt (403 → 404,
// `FORBIDDEN` → etwas anderes, ein zusätzliches Feld), wird hier rot und nicht erst beim Verbraucher.
describe("H · Status und Fehlercode bleiben buchstäblich stehen", () => {
  it("H1 · der Draht der unbekannten Kennung bleibt 404 NOT_FOUND in allen drei Sprachen", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      const antwort = await entwurfsabruf(tokenEignerin, UNBEKANNT, sprache);
      expect(antwort.status, sprache).toBe(404);
      expect(Object.keys(antwort.koerper).sort(), sprache).toEqual(["error", "message"]);
      expect(antwort.koerper.error, sprache).toBe("NOT_FOUND");
    }
  });

  it("H2 · der Draht des fremden Entwurfs bleibt 403 FORBIDDEN in allen drei Sprachen", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      const antwort = await entwurfsabruf(tokenFremde, eigeneKennung, sprache);
      expect(antwort.status, sprache).toBe(403);
      expect(Object.keys(antwort.koerper).sort(), sprache).toEqual(["error", "message"]);
      expect(antwort.koerper.error, sprache).toBe("FORBIDDEN");
    }
  });

  it("H3 · der Draht des RBAC-Wächters bleibt 403 FORBIDDEN in allen drei Sprachen", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      const antwort = await waechterabruf(sprache);
      expect(antwort.status, sprache).toBe(403);
      expect(Object.keys(antwort.koerper).sort(), sprache).toEqual(["error", "message"]);
      expect(antwort.koerper.error, sprache).toBe("FORBIDDEN");
    }
  });
});
