// ================================================================================================
// JOB 3667 · WORD-RÜCKWEG — DER BEDINGTE SCHREIBZUGRIFF AN `PUT /api/kos/:id`.
// ================================================================================================
//
// PEDIS ZUSAGE (Auftrag §4.3): „Hat sich das Objekt zwischenzeitlich geändert, wird NICHT
// stillschweigend überschrieben." Bis zu diesem Job war `action: "revise"` ein unbedingter Schreib-
// zugriff: der Dienst zählt die Version selbst hoch (`knowledge-object/src/service.ts:3570`), und
// wer einen zehn Minuten alten Stand zurückgab, überschrieb jede Änderung dazwischen — ohne dass
// irgendwo etwas aufschlug. Genau davor warnt der verwandte Entwurfsweg an Ort und Stelle
// („die teuerste Stelle für einen stillen Überschreiber", capture-routes.ts:661).
//
// GEMESSEN WIRD AN DER ROUTE, nicht am Dienst: echtes Login, echtes Rechtegate, echter PUT. Der
// Dienstvertrag sagt nachweislich NICHTS darüber, was die Route durchreicht — an derselben `case`
// wirft sie ein Feld der `ReviseKoInput` ausdrücklich weg (`sources`, ko-routes.ts).
//
// RED-FIRST (auf dem Basisstand a597e3c gemessen, bevor gebaut wurde):
//   · F2 rot: `expected 200 to be 409` — der veraltete Stand ging durch und überschrieb.
//   · F3 rot: `expected 200 to be 400` — ein Unsinnswert schaltete den Schutz still ab.
//   · F5 rot: `expected 200 to be 400` — das Feld wurde an fremden Aktionen stumm geschluckt.
//   · F1/F4 waren grün: sie halten fest, was sich NICHT ändern durfte.
//
// RUNDE 2: Der bedingte Schreibzugriff wird nicht mehr an der Route verglichen, sondern IM Dienst
// (`KoService.revise`, in derselben per-KO serialisierten Transaktion, in der geschrieben wird) —
// aus dem Zeitfenster von Runde 1 ist ein Compare-and-Set geworden. Die Route reicht `expectedVersion`
// nur noch durch und übersetzt `KO_STALE` in den 409 samt jetziger Version; diese Fälle messen
// deshalb unverändert dasselbe Verhalten an derselben Aussenfläche. Pedis ACCOUNTREGEL (wer was
// nach der Änderung gelten lassen darf) steht nebenan in `route-accountregel.test.ts`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

async function angemeldeteFlaeche(): Promise<{ app: App; headers: Record<string, string> }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { app, headers };
}

async function anlegen(
  app: App,
  headers: Record<string, string>,
): Promise<{ id: string; version: number }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as { id: string; version: number };
}

type Antwort = Awaited<ReturnType<App["inject"]>>;

function revise(
  app: App,
  headers: Record<string, string>,
  id: string,
  changes: Record<string, unknown>,
  expectedVersion?: unknown,
): Promise<Antwort> {
  const payload: Record<string, unknown> = { action: "revise", changes };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

describe("JOB 3667 · der Rückweg schreibt bedingt — oder gar nicht", () => {
  it("F1: mit der gesehenen Version trägt DASSELBE Objekt den neuen Stand, und beide Fassungen stehen in der Historie", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers);
    expect(angelegt.version).toBe(1);

    const zurueck = await revise(
      app,
      headers,
      angelegt.id,
      { statement: "Bei Überdruck Ventil X ZUERST entlasten, dann schließen." },
      1,
    );
    expect(zurueck.statusCode).toBe(200);
    const revidiert = zurueck.json() as { id: string; version: number; statement: string };
    // Der ganze Punkt des Auftrags: KEIN zweites Objekt, dieselbe Kennung, eine Version höher.
    expect(revidiert.id).toBe(angelegt.id);
    expect(revidiert.version).toBe(2);
    expect(revidiert.statement).toContain("ZUERST entlasten");

    const fassungen = await app.inject({
      method: "GET",
      url: `/api/kos/${angelegt.id}/versions`,
      headers,
    });
    expect(fassungen.statusCode).toBe(200);
    const stände = (fassungen.json() as { version: number }[]).map((v) => v.version).sort();
    expect(stände).toEqual([1, 2]);
  });

  it("F2: ein zwischenzeitlich fremd geändertes Objekt wird NICHT überschrieben — 409 mit der jetzigen Version", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers);

    // Jemand anderes (Web-Fläche) ändert das Objekt, während Word noch Version 1 in der Hand hält.
    const fremd = await revise(app, headers, angelegt.id, { statement: "Fremde Änderung." });
    expect(fremd.statusCode).toBe(200);
    expect((fremd.json() as { version: number }).version).toBe(2);

    const spaet = await revise(
      app,
      headers,
      angelegt.id,
      { statement: "Word-Stand von vorhin." },
      1,
    );
    expect(spaet.statusCode).toBe(409);
    const koerper = spaet.json() as { error: string; currentVersion: number; message: string };
    expect(koerper.error).toBe("KO_STALE");
    expect(koerper.currentVersion).toBe(2);

    // Und es ist wirklich NICHTS geschrieben worden — nicht einmal ein Versionssprung.
    const jetzt = await app.inject({ method: "GET", url: `/api/kos/${angelegt.id}`, headers });
    const stand = jetzt.json() as { version: number; statement: string };
    expect(stand.version).toBe(2);
    expect(stand.statement).toBe("Fremde Änderung.");
  });

  it("F3: ein unlesbarer Stand schaltet den Schutz NICHT still ab — 400, und nichts ist geschrieben", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers);

    // Jeder dieser Werte ist „Schutz angefordert, aber nicht ausdrückbar" — und `null` ist
    // ausdrücklich KEINE Abwesenheit (sonst wäre ein JSON-`null` der stille Weg am Schutz vorbei).
    for (const unsinn of ["1", 0, -3, 1.5, null, Number.NaN, {}]) {
      const antwort = await revise(app, headers, angelegt.id, { statement: "Neu." }, unsinn);
      expect(antwort.statusCode, JSON.stringify(unsinn)).toBe(400);
      expect((antwort.json() as { error: string }).error).toBe("BAD_REQUEST");
    }
    const jetzt = await app.inject({ method: "GET", url: `/api/kos/${angelegt.id}`, headers });
    expect((jetzt.json() as { version: number }).version).toBe(1);
  });

  it("F4: OHNE das Feld bleibt alles, wie es war — der Web-Editor ist unberührt", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers);
    const ohne = await revise(app, headers, angelegt.id, { statement: "Ohne Stand geschrieben." });
    expect(ohne.statusCode).toBe(200);
    expect((ohne.json() as { version: number }).version).toBe(2);
  });

  it("F5: an einer anderen Aktion wäre der Stand ein Schutz, der nicht greift — 400 statt Ignorieren", async () => {
    const { app, headers } = await angemeldeteFlaeche();
    const angelegt = await anlegen(app, headers);
    const kommentar = await app.inject({
      method: "PUT",
      url: `/api/kos/${angelegt.id}`,
      headers,
      payload: { action: "comment", text: "Bitte um Zweitprüfung.", expectedVersion: 1 },
    });
    expect(kommentar.statusCode).toBe(400);
    expect((kommentar.json() as { message: string }).message).toContain("expectedVersion");
  });
});
