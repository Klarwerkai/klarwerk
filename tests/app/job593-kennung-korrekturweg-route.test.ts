// JOB 593 · D9 — DIE KENNUNG IST ÜBER DIE AUSSENFLÄCHE BERICHTBAR.
//
// BEN-Auflage 1 zu D8 lautet wörtlich: „Ein gebundener Korrektur-/Änderungsweg für
// `KnowledgeObject.asset` fehlt; die kanonische Kennung ist nach der Anlage nicht BERICHTBAR."
//
// Berichtbar heißt über die Fläche, an der wirklich jemand steht — nicht nur über den Dienst.
// Diese Datei ist deshalb bewusst nicht der zweite Dienstvertrag, sondern der ERSTE Routenbeleg:
// echtes Login, echtes Rechtegate, echter `PUT /api/kos/:id`.
//
// WARUM DAS NICHT ÜBERFLÜSSIG IST. Genau an dieser Stelle wirft die Route ein Feld der
// `ReviseKoInput` ausdrücklich weg: `const { sources: _ignoredSources, ...changes } = ...`
// (services/app/src/routes/ko-routes.ts:1273). Dass ein Feld im Dienstvertrag steht, sagt also
// nachweislich NICHTS darüber, ob die Route es durchreicht. Ohne diesen Beleg wäre Auflage 1
// mit einem Vertrag beantwortet, dessen Wirksamkeit an der Außenfläche ungeprüft bliebe.
//
// RED-FIRST: alle drei Fälle waren auf der Base rot (Protokoll `redfirst-route.txt` in der
// Arbeitsspur) — R1 und R2, weil `ReviseKoInput` die Kennung nicht führte, R3, weil sie ohne
// Normalform am Anlegen roh im Bestand lag.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

async function angemeldeteFlaeche() {
  const app = buildApp(buildServices());
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
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { app, headers };
}

async function anlegen(
  app: Awaited<ReturnType<typeof angemeldeteFlaeche>>["app"],
  headers: Record<string, string>,
  asset: string,
): Promise<{ id: string; asset: string | null }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      asset,
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as { id: string; asset: string | null };
}

describe("JOB 593 · Die Anlagenkennung über die HTTP-Route", () => {
  it("R1: eine falsche Kennung ist über PUT /api/kos/:id korrigierbar", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers, "Presse 33");
    expect(angelegt.asset).toBe("Presse 33");

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${angelegt.id}`,
      headers,
      payload: { action: "revise", changes: { asset: "Presse 3" } },
    });
    expect(revidiert.statusCode).toBe(200);
    // Das ist der ganze Punkt von Auflage 1: der Tippfehler ist nicht unsterblich.
    expect((revidiert.json() as { asset: string | null }).asset).toBe("Presse 3");
  });

  it("R2: die Route reicht die Kennung durch — und normalisiert sie mit derselben Regel", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers, "Presse 33");

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${angelegt.id}`,
      headers,
      payload: { action: "revise", changes: { asset: "  Presse   4  " } },
    });
    expect(revidiert.statusCode).toBe(200);
    expect((revidiert.json() as { asset: string | null }).asset).toBe("Presse 4");
  });

  it("R3: zwei Schreibweisen derselben Anlage kommen als DIESELBE Kennung im Bestand an", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const a = await anlegen(app, headers, "Presse 3");
    const b = await anlegen(app, headers, " Presse   3 ");
    // `selectCandidates` vergleicht zeichengenau (conflicts/detect.ts:126). Erst wenn diese
    // beiden Werte gleich sind, kann die Konflikterkennung die Doppelpflege überhaupt finden.
    expect(b.asset).toBe(a.asset);
    expect(b.asset).toBe("Presse 3");
  });
});
