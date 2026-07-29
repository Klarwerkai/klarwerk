// ================================================================================================
// AUFTRAG-mega45 BLOCK D — DER SCHALTER. VORGABE AUS.
// ================================================================================================
//
// Pedi, 28.07.: „Wenn wir es nicht fertig kriegen, ist okay. Dann koennen wir die Seite wieder
// verstecken." Damit „verstecken" ein SCHALTER ist und kein Rueckbau, entscheidet
// KLARWERK_PROVENANCE_ENABLED ueber die REGISTRIERUNG der Route — nicht ueber eine Antwort. Ohne
// Flag gibt es die Route nicht, und die Oberflaeche rendert den Knopf ebenfalls nicht. Ein
// unfertiger Stand kann so gefahrlos im Baum liegen.
//
// Dieser Test haelt BEIDE Zustaende fest. Nur den einen zu pruefen waere die haeufigste Art, einen
// Schalter kaputtgehen zu lassen, ohne dass es auffaellt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";

// Der Schalter wird je Test EXPLIZIT gesetzt; die Vorgabe hat unten ihren eigenen Fall.
beforeEach(() => {
  delete process.env.KLARWERK_PROVENANCE_ENABLED;
});
afterEach(() => {
  delete process.env.KLARWERK_PROVENANCE_ENABLED;
});

async function angemeldet(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzerin", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

describe("mega45 D · der Betriebsschalter der Herkunftskette", () => {
  it("VORGABE AUS: ohne Flag ist die Route nicht registriert", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/kos/irgendeine/provenance",
      headers,
    });
    // 404 = die Route existiert nicht. Kein 503, kein leerer Graph, keine tote Flaeche.
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("auch ein ANDERER Wert als 1/true schaltet nicht scharf", async () => {
    process.env.KLARWERK_PROVENANCE_ENABLED = "ja";
    const app = buildApp();
    const headers = await angemeldet(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/kos/irgendeine/provenance",
      headers,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("AN: mit Flag ist die Route da — und verlangt eine Anmeldung", async () => {
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
    const app = buildApp();
    // Ohne Anmeldung: 401 (nicht 404) — die Route EXISTIERT, sie ist nur geschuetzt.
    const ohne = await app.inject({ method: "GET", url: "/api/kos/irgendeine/provenance" });
    expect(ohne.statusCode).toBe(401);
    await app.close();
  });

  it("AN: ein unbekanntes Objekt ergibt einen ehrlichen 404 mit Grund", async () => {
    process.env.KLARWERK_PROVENANCE_ENABLED = "true";
    const app = buildApp();
    const headers = await angemeldet(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/provenance",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "NOT_FOUND" });
    await app.close();
  });

  it("AN: die Kette eines vorhandenen Objekts kommt als Graph — ohne Pruefprotokoll", async () => {
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
    const app = buildApp();
    const headers = await angemeldet(app);
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Lieferzeiten Standardteile",
        statement: "Standardteile sind in fuenf Werktagen da.",
        type: "best_practice",
        category: "Logistik",
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const koId = (angelegt.json() as { id: string }).id;

    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}/provenance`, headers });
    expect(res.statusCode).toBe(200);
    const graph = res.json() as Record<string, unknown>;
    expect(graph.root).toBe(`ko:${koId}`);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.truncated).toEqual({ byScope: false, omittedNodes: 0 });

    // A3: das Pruefprotokoll verlaesst den Server NIE — weder als Feld noch als Zahl.
    expect(graph.audit).toBeUndefined();
    expect(JSON.stringify(graph)).not.toContain("redactedByRights");
    await app.close();
  });
});
