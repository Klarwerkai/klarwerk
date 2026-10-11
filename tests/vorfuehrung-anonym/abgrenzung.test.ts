import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { VORFUEHRUNG_AUS } from "../../services/app/src/routes/vorfuehrung-routes";
import { INHALTE, KENNZEICHNUNG } from "../../services/app/src/vorfuehrung/inhalte";

// ================================================================================================
// R-0570 · ANONYME VORFÜHRUNG JA, UNTERNEHMENSWISSEN NEIN — BEIDES GEMESSEN, GETRENNT.
// ================================================================================================
//
// Entscheidung zu Frage 14 (Peter, 11.10.2026): „Firmenwissen authentifiziert; anonyme Demo nur
// öffentlich/fiktiv." Der Originalpunkt R-0570 („Wissen ohne Anmeldung lesen oder Fragen stellen")
// gilt damit für die Vorführung — und nur für sie.
//
// DIE PRÜFUNG UNTERSCHEIDET, WAS SIE UNTERSCHEIDEN MUSS (BEN-Befund Nacharbeit 3):
//   E · ERLAUBT: Ohne Anmeldung lesen (E1) und fragen (E2) an der Vorführung, mit Kennzeichnung,
//       in der Sprache der Anfrage (E3). Kalibriert gegen den ausgeschalteten Zustand (S1/S2).
//   A · AUSGESCHLOSSEN: Ein echtes Wissensobjekt, angelegt mit unverwechselbarem Titel, ist ohne
//       Anmeldung weder über die Vorführung (A1, A2 — auch wenn genau danach gefragt wird) noch
//       über die Wissenswege (A3: Liste, Einzelobjekt, Frageweg) erreichbar. A0 kalibriert: mit
//       Anmeldung ist es da.
//   I · ISOLATION AM QUELLTEXT: Die Vorführung importiert nichts aus dem Wissens- oder Frageweg.
//
// `tests/demo-zugang-gaeste/kein-offener-zugang.test.ts` bleibt daneben unverändert gültig: er misst,
// dass GELADENER Demobestand (der im echten Wissensspeicher liegt) nie öffentlich wird. Das ist
// Unternehmenswissen im Sinne der Entscheidung und bleibt hinter der Anmeldung.

const SCHALTER = "KLARWERK_VORFUEHRUNG_ANONYM";
/** Ein Titel, den es im erfundenen Bestand sicher nicht gibt. */
const GEHEIMER_TITEL = "Kalibrierwert Spindel Q7 nur fuer Belegschaft";

let vorher: string | undefined;
beforeEach(() => {
  vorher = process.env[SCHALTER];
  delete process.env[SCHALTER];
});
afterEach(() => {
  if (vorher === undefined) {
    delete process.env[SCHALTER];
  } else {
    process.env[SCHALTER] = vorher;
  }
});

async function alsAdmin(app: FastifyInstance): Promise<Record<string, string>> {
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
  return { authorization: `Bearer ${login.json().token}` };
}

/** Ein echtes Wissensobjekt — Unternehmenswissen im Sinne der Entscheidung. */
async function unternehmenswissenAnlegen(app: FastifyInstance): Promise<string> {
  const admin = await alsAdmin(app);
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: GEHEIMER_TITEL,
      statement: "Die Spindel Q7 wird auf 0,02 mm kalibriert.",
      type: "best_practice",
      category: "Fertigung",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

describe("R-0570 · S — der Schalter: Vorgabe aus, dann liefert die Vorführung nichts", () => {
  it("S1 · ohne Schalter antworten beide Wege 404 mit VORFUEHRUNG_AUS und ohne Inhalt", async () => {
    const app = buildApp(buildServices());
    for (const url of ["/api/vorfuehrung", "/api/vorfuehrung/frage?q=Druckluft"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(404);
      expect(res.json(), url).toEqual({ error: VORFUEHRUNG_AUS });
    }
    await app.close();
  });

  it("S2 · ein anderer Wert als 1/true schaltet NICHT ein (fail-closed)", async () => {
    process.env[SCHALTER] = "ja";
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/vorfuehrung" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("R-0570 · E — erlaubt: lesen und fragen ohne Anmeldung, an erfundenem Inhalt", () => {
  it("E1 · lesen: ohne Anmeldung kommt der erfundene Bestand mit Kennzeichnung", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/vorfuehrung" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.fiktiv).toBe(true);
    expect(body.kennzeichnung).toBe(KENNZEICHNUNG.de);
    expect(body.eintraege).toEqual(INHALTE.de);
    // Jeder einzelne Eintrag trägt die Kennzeichnung im Titel — auch weitergegeben bleibt sie dran.
    for (const e of body.eintraege as { titel: string }[]) {
      expect(e.titel).toMatch(/fiktiv/);
    }
    await app.close();
  });

  it("E2 · fragen: ohne Anmeldung findet die Frage den passenden erfundenen Eintrag", async () => {
    process.env[SCHALTER] = "true";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "GET",
      url: `/api/vorfuehrung/frage?q=${encodeURIComponent("Wie mache ich die Druckluftanlage drucklos?")}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.fiktiv).toBe(true);
    expect(body.treffer.length).toBeGreaterThan(0);
    expect(body.treffer[0].id).toBe("v1");
    // Kalibrierung: eine Frage ohne Bezug findet NICHTS — sonst wäre E2 trivial.
    const leer = await app.inject({ method: "GET", url: "/api/vorfuehrung/frage?q=Raumfahrt" });
    expect(leer.statusCode).toBe(200);
    expect(leer.json().treffer).toEqual([]);
    // Keine Frage ist keine Formkritik wert: 200 mit leerer Trefferliste, kein 400.
    const ohne = await app.inject({ method: "GET", url: "/api/vorfuehrung/frage" });
    expect(ohne.statusCode).toBe(200);
    expect(ohne.json().treffer).toEqual([]);
    await app.close();
  });

  it("E3 · die Sprache der Anfrage gilt: EN und NL bekommen ihre Fassung", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    for (const l of ["en", "nl"] as const) {
      const res = await app.inject({
        method: "GET",
        url: "/api/vorfuehrung",
        headers: { "accept-language": l },
      });
      expect(res.json().kennzeichnung, l).toBe(KENNZEICHNUNG[l]);
      expect(res.json().eintraege, l).toEqual(INHALTE[l]);
    }
    await app.close();
  });
});

describe("R-0570 · A — ausgeschlossen: Unternehmenswissen bleibt hinter der Anmeldung", () => {
  it("A0 · KALIBRIERUNG: angemeldet ist das Wissensobjekt wirklich da", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    const id = await unternehmenswissenAnlegen(app);
    const admin = await alsAdmin(app);
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(GEHEIMER_TITEL);
    await app.close();
  });

  it("A1 · der Bestand der Vorführung enthält es nicht — auch bei eingeschalteter Vorführung", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    await unternehmenswissenAnlegen(app);
    const res = await app.inject({ method: "GET", url: "/api/vorfuehrung" });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(GEHEIMER_TITEL);
    expect(res.body).not.toContain("Spindel");
    await app.close();
  });

  it("A2 · auch wer genau danach fragt, bekommt es über die Vorführung nicht", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    await unternehmenswissenAnlegen(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/vorfuehrung/frage?q=${encodeURIComponent(GEHEIMER_TITEL)}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().treffer).toEqual([]);
    expect(res.body).not.toContain("Spindel");
    await app.close();
  });

  it("A3 · die Wissenswege selbst bleiben ohne Anmeldung zu — mit eingeschalteter Vorführung", async () => {
    process.env[SCHALTER] = "1";
    const app = buildApp(buildServices());
    const id = await unternehmenswissenAnlegen(app);
    const wege = [
      { method: "GET" as const, url: "/api/kos" },
      { method: "GET" as const, url: `/api/kos/${id}` },
      { method: "POST" as const, url: "/api/ask", payload: { question: GEHEIMER_TITEL } },
    ];
    for (const weg of wege) {
      const res = await app.inject(weg);
      expect(res.statusCode, `${weg.method} ${weg.url}`).toBe(401);
      expect(res.body, `${weg.method} ${weg.url}`).not.toContain(GEHEIMER_TITEL);
    }
    await app.close();
  });
});

describe("R-0570 · I — die Vorführung hat keinen Weg zum Wissensspeicher", () => {
  const WURZEL = join(__dirname, "..", "..");
  const dateien = [
    "services/app/src/routes/vorfuehrung-routes.ts",
    "services/app/src/vorfuehrung/inhalte.ts",
  ];

  function importe(datei: string): string[] {
    const text = readFileSync(join(WURZEL, datei), "utf8");
    return [...text.matchAll(/^import[^;]*?from\s+"([^"]+)";/gms)].map((m) => m[1] ?? "");
  }

  it("I0 · KALIBRIERUNG: die Erhebung liest die Importe wirklich", () => {
    expect(importe(dateien[0] as string)).toContain("../feature-flags");
  });

  it("I1 · der Inhalt ist ein Blatt: er importiert gar nichts", () => {
    expect(importe(dateien[1] as string)).toEqual([]);
  });

  it("I2 · die Routen importieren nur Sprache, Schalter und den erfundenen Inhalt", () => {
    expect(importe(dateien[0] as string).sort()).toEqual(
      ["../../../auth", "../feature-flags", "../vorfuehrung/inhalte", "fastify"].sort(),
    );
  });
});
