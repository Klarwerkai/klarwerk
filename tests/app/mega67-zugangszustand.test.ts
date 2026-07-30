// ================================================================================================
// AUFTRAG-mega67 BLOCK C — DER ZUGANGS-ZUSTAND, UND DASS ER KEIN GEHEIMNIS TRÄGT.
// ================================================================================================
//
// Zwei Sorten Fälle:
//  1. die Ableitung selbst (steht/steht nicht, der HTTPS-Riegel, die leere Variable),
//  2. der VERTRAG der Antwort — geprüft an der ANTWORT, nicht an der Absicht: die serialisierte
//     Antwort darf KEINEN gesetzten Zugangswert enthalten, und die Route darf nicht antworten,
//     ohne `users.manage` gesehen zu haben. Das ist derselbe Bauart-Beleg wie der Schalter-Sammler
//     aus mega46 — eine Zusicherung, die man nicht durch Umbau versehentlich verliert.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { confluenceCredentialState } from "../../services/confluence";

const VOLLSTAENDIG = {
  KLARWERK_CONFLUENCE_BASE_URL: "https://firma.atlassian.net/wiki",
  KLARWERK_CONFLUENCE_USER: "pedi@firma.de",
  KLARWERK_CONFLUENCE_TOKEN: "geheim-abcdefghijklmnop",
  KLARWERK_CONFLUENCE_SPACE: "WISSEN",
};

describe("mega67 C · confluenceCredentialState — Zustand, nie der Wert", () => {
  it("keine Variable gesetzt → alle vier benannt, alle nein", () => {
    const s = confluenceCredentialState({});
    expect(s.vars.map((v) => v.name)).toEqual([
      "KLARWERK_CONFLUENCE_BASE_URL",
      "KLARWERK_CONFLUENCE_USER",
      "KLARWERK_CONFLUENCE_TOKEN",
      "KLARWERK_CONFLUENCE_SPACE",
    ]);
    expect(s.vars.every((v) => v.present === false)).toBe(true);
    expect(s.usable).toBe(false);
    expect(s.blocker).toBe("missing");
  });

  it("alle vier gesetzt (https) → usable, kein Blocker", () => {
    const s = confluenceCredentialState(VOLLSTAENDIG);
    expect(s.vars.every((v) => v.present === true)).toBe(true);
    expect(s.usable).toBe(true);
    expect(s.blocker).toBeNull();
  });

  it("eine fehlt → genau die eine ist nein, die anderen ja", () => {
    const s = confluenceCredentialState({
      ...VOLLSTAENDIG,
      KLARWERK_CONFLUENCE_TOKEN: undefined,
    });
    expect(s.vars.find((v) => v.name === "KLARWERK_CONFLUENCE_TOKEN")?.present).toBe(false);
    expect(s.vars.filter((v) => v.present).length).toBe(3);
    expect(s.blocker).toBe("missing");
  });

  // Eine gesetzte, aber LEERE Variable ist nicht gesetzt. Meldete die Fläche hier „steht", wäre sie
  // genau in dem Fall falsch, in dem jemand `export KLARWERK_CONFLUENCE_TOKEN=` geschrieben hat —
  // und der Import scheiterte trotzdem (confluenceClientFromEnv prüft ebenfalls auf truthy).
  it("gesetzt, aber leer zählt als NICHT gesetzt", () => {
    const s = confluenceCredentialState({ ...VOLLSTAENDIG, KLARWERK_CONFLUENCE_SPACE: "" });
    expect(s.vars.find((v) => v.name === "KLARWERK_CONFLUENCE_SPACE")?.present).toBe(false);
    expect(s.usable).toBe(false);
  });

  // Der stille Fall: alle vier stehen, und es geht trotzdem nicht. Ohne eigene Auskunft wäre er von
  // einem Fehler ununterscheidbar — und die Fläche hätte die Frage nicht beantwortet, für die sie
  // gebaut wurde.
  it("alle vier gesetzt, aber Basis-URL ist http → nicht nutzbar, eigener Grund", () => {
    const s = confluenceCredentialState({
      ...VOLLSTAENDIG,
      KLARWERK_CONFLUENCE_BASE_URL: "http://firma.intern/wiki",
    });
    expect(s.vars.every((v) => v.present === true)).toBe(true);
    expect(s.usable).toBe(false);
    expect(s.blocker).toBe("insecure-base-url");
  });

  it("unparsbare Basis-URL → derselbe ehrliche Grund, kein Absturz", () => {
    const s = confluenceCredentialState({
      ...VOLLSTAENDIG,
      KLARWERK_CONFLUENCE_BASE_URL: "kein-url",
    });
    expect(s.usable).toBe(false);
    expect(s.blocker).toBe("insecure-base-url");
  });

  // DER TRAGENDE FALL: der Rückgabewert darf den Wert nicht enthalten — auch nicht als Maske mit
  // Länge, denn eine Maske verrät die Länge. Geprüft an der SERIALISIERTEN Form, damit kein neu
  // hinzugefügtes Feld ihn still durchreichen kann.
  it("VERTRAG: kein gesetzter Wert und keine Länge erscheint in der Ausgabe", () => {
    const roh = JSON.stringify(confluenceCredentialState(VOLLSTAENDIG));
    for (const wert of Object.values(VOLLSTAENDIG)) {
      expect(roh).not.toContain(wert);
    }
    // Auch kein Fragment: der Host der Basis-URL wäre schon zu viel.
    expect(roh).not.toContain("firma");
    expect(roh).not.toContain("geheim");
    // Keine Maske, keine Länge: die einzigen Nicht-Namen-Werte sind Booleans/null.
    expect(roh).not.toMatch(/\*{2,}/);
    expect(roh).not.toContain(String(VOLLSTAENDIG.KLARWERK_CONFLUENCE_TOKEN.length));
  });
});

describe("mega67 C · GET /api/import/confluence/zugang — die Tür", () => {
  it("ohne Anmeldung: keine Auskunft", async () => {
    const app = buildApp(await buildServices());
    const res = await app.inject({ method: "GET", url: "/api/import/confluence/zugang" });
    expect([401, 403]).toContain(res.statusCode);
    expect(res.body).not.toContain("KLARWERK_CONFLUENCE");
    await app.close();
  });

  // Der Import ist ohnehin admin-gebunden (jede Confluence-Route verlangt users.manage). Eine
  // weichere Tür für seinen ZUSTAND wäre eine Rechte-Ausweitung durch die Hintertür.
  it("angemeldet ohne users.manage: keine Auskunft", async () => {
    const app = buildApp(await buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Erste", email: "admin@x.de", password: "secret123" },
    });
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const adminHeaders = {
      authorization: `Bearer ${(adminLogin.json() as { token: string }).token}`,
    };
    // Eine Expertin — sie darf importierte Kandidaten prüfen, aber keine Zugänge einsehen.
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name: "Zweite", email: "expertin@x.de", password: "secret123", role: "experte" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "expertin@x.de", password: "secret123" },
    });
    const token = (login.json() as { token: string }).token;
    const res = await app.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain("KLARWERK_CONFLUENCE");
    await app.close();
  });

  // DER GRUND, WARUM DIESE ROUTE NICHT HINTER DEM SCHALTER LIEGT: sie muss „ausgeschaltet" melden
  // können. Läge sie dahinter, gäbe es bei ausgeschaltetem Import einen 404 — ununterscheidbar von
  // „kaputt", exakt der Fehler, den mega46 für die Schalter beseitigt hat.
  it("als Admin bei AUSGESCHALTETEM Import: antwortet und meldet enabled:false", async () => {
    const vorher = process.env.KLARWERK_CONFLUENCE_IMPORT;
    process.env.KLARWERK_CONFLUENCE_IMPORT = "0";
    try {
      const app = buildApp(await buildServices());
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@x.de", password: "secret123" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@x.de", password: "secret123" },
      });
      const token = (login.json() as { token: string }).token;
      const res = await app.inject({
        method: "GET",
        url: "/api/import/confluence/zugang",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        enabled: boolean;
        credentials: { name: string; present: boolean }[];
        lastConnectedAt: null;
      };
      expect(body.enabled).toBe(false);
      // Die Variablen sind trotzdem benannt — „was bräuchte es" ist auch dann die Antwort auf
      // „warum geht das nicht", wenn der Schalter aus ist.
      expect(body.credentials.length).toBe(4);
      expect(body.credentials.every((c) => typeof c.present === "boolean")).toBe(true);
      // Ohne ablesbaren Bestand wird nichts erfunden.
      expect(body.lastConnectedAt).toBeNull();
      await app.close();
    } finally {
      if (vorher === undefined) {
        process.env.KLARWERK_CONFLUENCE_IMPORT = undefined;
        delete process.env.KLARWERK_CONFLUENCE_IMPORT;
      } else {
        process.env.KLARWERK_CONFLUENCE_IMPORT = vorher;
      }
    }
  });
});
