// ==================================================================================================
// JOB 3429 (Q3 c) — DIE STUFENPFLICHT AM DIREKTEN SCHREIBWEG.
// ==================================================================================================
//
// WAS DIESE DATEI IST. Der vermessene Vertrag von `POST /api/kos` in Sachen Vertraulichkeitsstufe.
//
// DIE LAGE, DREI ANLAGEWEGE — seit dieser Runde sind alle drei zu:
//   1. Oberfläche       — `apps/web/src/pages/Capture.tsx`, `requestSubmit` kehrt ohne Wahl um.
//   2. Entwurfs-Promote — `services/capture/src/service.ts`, `toKoInput` → INCOMPLETE (JOB 3082).
//   3. `POST /api/kos`  — diese Datei: fehlt die Stufe, gibt es 400 `MISSING_CONFIDENTIALITY`.
//
// WARUM DIE GRENZE AN DER ROUTE SITZT UND NICHT IM DIENST. `ko.create` ist auch der Weg von Import,
// Seed und Altbestand; ein bewusst UNEINGESTUFTES Objekt muss herstellbar bleiben, sonst gäbe es
// keine Fixtures mehr für den Zustand „nie eingestuft" (`confidentialityProvenance: "unknown"`).
// Der letzte Fall unten hält genau das fest.
//
// DIE ZUSAGE DER OBERFLÄCHE steht NICHT hier, sondern in
// `oberflaeche-sendet-die-stufe-mounted.test.tsx` — mit gedrücktem Knopf und gelesenem Rumpf. Ein
// Quelltext-Pin an dieser Stelle hat in Runde 2 nichts gesichert (bens Gegenprobe: die gesuchte
// Zeichenkette steht dreimal in `Capture.tsx`, das Entfernen der entscheidenden Zeile blieb grün).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

async function appMitNutzer() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

/** Der Rumpf ohne die Stufe — jeder Fall setzt (oder unterschlägt) sie ausdrücklich. */
const RUMPF = {
  title: "Direkt über die Schnittstelle",
  statement: "s",
  type: "best_practice",
  category: "K",
} as const;

describe("JOB 3429 (Q3 c): was der direkte Schreibweg heute garantiert", () => {
  it("MIT Stufe legt an — und die Stufe steht am Objekt (kein Verlust auf dem Weg)", async () => {
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...RUMPF, confidentiality: "vertraulich" },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { confidentiality?: string }).confidentiality).toBe("vertraulich");
  });

  it("ausdrückliches „intern“ legt an und wird GESPEICHERT — nicht als Leerwert verworfen", async () => {
    // Die Ablösung aus JOB 3076: ein bewusst gewähltes „intern“ fiel früher in den Leerzweig und war
    // danach von „niemand hat gewählt“ nicht mehr zu unterscheiden. Dieser Fall hält das fest.
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...RUMPF, confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { confidentiality?: string }).confidentiality).toBe("intern");
  });

  it("UNGÜLTIGER Wert wird abgewiesen — die Stufe ist nicht mit einem Tippfehler zu setzen", async () => {
    const { app, headers } = await appMitNutzer();
    for (const wert of ["geheim", "INTERN", "", "vertraulich "]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers,
        payload: { ...RUMPF, confidentiality: wert },
      });
      expect(res.statusCode, `Wert ${JSON.stringify(wert)}`).toBe(400);
      expect((res.json() as { error: string }).error, `Wert ${JSON.stringify(wert)}`).toBe(
        "INVALID_CONFIDENTIALITY",
      );
    }
  });

  it("`confidentiality: null` wird abgewiesen — ein Leerwert ist keine Einstufung", async () => {
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...RUMPF, confidentiality: null },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("INVALID_CONFIDENTIALITY");
  });

  it("der Rumpf der Oberfläche geht unverändert durch", async () => {
    // Feldgleich zu `createPayload` in apps/web/src/pages/Capture.tsx (dort um `reviewerIds` ergänzt).
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Aus dem Formular",
        statement: "s",
        conditions: ["c"],
        measures: ["m"],
        tags: ["t"],
        type: "best_practice",
        category: "K",
        asset: null,
        bodyHtml: "<p>x</p>",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

// ==================================================================================================
// DIE GRENZE — ohne Stufe entsteht kein Wissensobjekt.
// ==================================================================================================
describe("JOB 3429 (Q3 c): ohne Stufe legt der direkte Weg nichts an", () => {
  it("OHNE Stufe wird abgewiesen — benannter Eingabefehler, NICHT 500, und kein Objekt entsteht", async () => {
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: RUMPF });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; message: string };
    expect(body.error).toBe("MISSING_CONFIDENTIALITY");
    // Der Fehler ist BENANNT und trägt einen lesbaren Satz — keine maskierte Interna-Meldung.
    expect(body.message).toContain("Vertraulichkeitsstufe");
    expect(body.error).not.toBe("INTERNAL");
    // Fail-closed: der Bestand bleibt leer. Ein 400 MIT angelegtem Objekt wäre das Schlimmste
    // von beidem — deshalb wird der Endzustand beim Server erfragt, nicht aus dem Status geraten.
    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(liste.json()).toHaveLength(0);
  });

  it("der Fehler kommt VOR jeder Wirkung — auch Prüfer-Vorschläge lösen nichts aus", async () => {
    // Die Route würde nach dem Anlegen `validation.assign` und eine Meldung auslösen. Bricht sie
    // zu spät ab, entstünden Zuweisungen ohne Objekt. Die Grenze steht deshalb vor `ko.create`.
    const { app, headers } = await appMitNutzer();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...RUMPF, reviewerIds: ["irgendwer"] },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("MISSING_CONFIDENTIALITY");
    expect((await app.inject({ method: "GET", url: "/api/kos", headers })).json()).toHaveLength(0);
  });

  it("der Dienstweg bleibt offen — bewusst uneingestufte Objekte sind weiter herstellbar", async () => {
    // Die Grenze sitzt an der ROUTE, nicht im Dienst: Altbestand, Import und Seed dürfen weiterhin
    // ohne Stufe entstehen, sonst gäbe es keinen Weg mehr, „nie eingestuft" abzubilden — und die
    // Prüfung dieses Zustands (`confidentialityProvenance: "unknown"`) verlöre ihre Fixtures.
    const services = buildServices();
    const app = buildApp(services);
    const ohne = await services.ko.create({
      title: "Altbestand",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "u1",
    });
    expect(Object.hasOwn(ohne as object, "confidentiality")).toBe(false);
    expect(app).toBeDefined();
  });
});
