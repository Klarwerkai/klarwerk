// ================================================================================================
// JOB 3009 · STATION 4, ZWEITE SERVERHAELFTE — AUCH DER DETAILABRUF SAGT „NICHT EINGESTUFT".
// ================================================================================================
//
// WAS DIESE DATEI MISST. Seit JOB 3003 sagt `GET /api/validation/board` ausdruecklich
// `confidentiality: null` mit `confidentialityProvenance: "unknown"`, wenn der Bestand keine Stufe
// traegt. `GET /api/kos/:id` sagte an derselben Stelle GAR NICHTS: fehlt die Stufe, fehlt der
// Schluessel (gemessen in validation-routes.test.ts, Fall F6). Damit kippte genau die Verwechslung,
// die das Board schliesst, eine Klickebene tiefer wieder zurueck — „dieses Objekt ist nicht
// eingestuft" und „diese Route liefert die Einstufung nicht" waren fuer den Menschen davor wieder
// ununterscheidbar.
//
// DER ROT-FALL IST R1, und er ist derselbe Gedanke wie F1 am Board: nicht das neue Feld ist der
// Kern, sondern sein FEHLZUSTAND. R2 ist die Gegenprobe (eine Route, die pauschal `null` sagt,
// faellt daran durch), R3 haelt das Tor VOR der Auskunft fest, R4 bindet Board und Detail an
// dieselbe Aussage, R5 belegt, dass hier nichts nachgetragen wird.
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Anmeldung und Rollenkonten sind die aus
// `validation-routes.test.ts`. Der Unterschied: die Dienste entstehen ueber `assembleServices(
// inMemoryRepos())` statt ueber `buildServices()`, weil R6 einen UNGUELTIGEN Altwert in den Bestand
// legen muss — ueber den Schreibweg geht das nicht (`KoService.create` speichert die Stufe nur,
// wenn sie tatsaechlich vertraulich ist, service.ts:1650-1654). Das ist kein Umgehen einer Regel,
// sondern der einzige Weg, einen Altbestand herzustellen, wie ihn eine fremd geschriebene Zeile
// erzeugt.
import { describe, expect, it } from "vitest";
import type { Confidentiality } from "../../../knowledge-object";
import { type AppRepos, assembleServices, buildApp, inMemoryRepos } from "../build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
type Antwort = Record<string, unknown>;

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/**
 * Der erste registrierte Nutzer wird Admin (und traegt damit `ko.validate` — die Rolle, die auch
 * vertrauliche Objekte oeffnen darf). Der zweite ist ein Experte OHNE `ko.validate` und
 * ausdruecklich NICHT Autor der Pruefobjekte: er ist die Gegenprobe fuer R3.
 */
async function setup(): Promise<{
  app: App;
  repos: AppRepos;
  services: ReturnType<typeof assembleServices>;
  pruefer: Auth;
  fremd: Auth;
}> {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pruefer", email: "pruefer@j3009.test", password: "geheim12345" },
  });
  const pruefer = await login(app, "pruefer@j3009.test", "geheim12345");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: pruefer,
    payload: {
      name: "Fremd",
      email: "fremd@j3009.test",
      password: "geheim12345",
      role: "experte",
    },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Konto fremd nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  return {
    app,
    repos,
    services,
    pruefer,
    fremd: await login(app, "fremd@j3009.test", "geheim12345"),
  };
}

async function detail(app: App, wer: Auth, id: string): Promise<Antwort> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

describe("JOB 3009 · Station 4 — der Detailabruf nennt die Stufe, auch wenn keine da ist", () => {
  it("R1 · ROT-FALL: ein KO OHNE Stufe sagt das im Detailabruf ausdruecklich (null + unknown)", async () => {
    const { app, services, pruefer } = await setup();
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Niemand hat dieses Objekt je eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });
    expect(ohne.confidentiality, "Vorbedingung: der Bestand traegt die Stufe wirklich nicht").toBe(
      undefined,
    );

    const voll = await detail(app, pruefer, ohne.id);

    // Der Kern des Auftrags: NICHT das Fehlen des Schluessels, sondern die ausdrueckliche Auskunft.
    expect(voll).toHaveProperty("confidentiality", null);
    expect(voll.confidentialityProvenance).toBe("unknown");
  });

  it("R2 · GEGENPROBE: eine gesetzte Stufe kommt mit ihrem Wert und Beleg `ko` an", async () => {
    const { app, services, pruefer } = await setup();
    const mit = await services.ko.create({
      title: "Objekt mit Einstufung",
      statement: "Dieses Objekt ist eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      confidentiality: "vertraulich",
    });
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Niemand hat dieses Objekt je eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    // Beide Faelle in EINER Pruefung: eine Route, die pauschal `null` (oder pauschal einen Wert)
    // sagt, faellt hier durch.
    const eingestuft = await detail(app, pruefer, mit.id);
    expect(eingestuft.confidentiality).toBe("vertraulich");
    expect(eingestuft.confidentialityProvenance).toBe("ko");

    const uneingestuft = await detail(app, pruefer, ohne.id);
    expect(uneingestuft.confidentiality).toBeNull();
    expect(uneingestuft.confidentialityProvenance).toBe("unknown");
  });

  it("R3 · DAS TOR STEHT DAVOR: ein unsichtbares Objekt bleibt 404, nicht 200 mit null-Feldern", async () => {
    const { app, services, pruefer, fremd } = await setup();
    const geheim = await services.ko.create({
      title: "Vertraulicher Pruefling",
      statement: "Sensibler Kerntext, der einen fremden Pruefer nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-jemand-anders",
      confidentiality: "vertraulich",
    });
    const offen = await services.ko.create({
      title: "Internes Alltagswissen",
      statement: "Nichts Geheimes — dieses Objekt darf jeder oeffnen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    // KALIBRIERUNG ZUERST — ohne sie bewiese die Zeile darunter nichts.
    const erlaubt = await app.inject({
      method: "GET",
      url: `/api/kos/${offen.id}`,
      headers: fremd,
    });
    expect(erlaubt.statusCode, erlaubt.body).toBe(200);

    const verwehrt = await app.inject({
      method: "GET",
      url: `/api/kos/${geheim.id}`,
      headers: fremd,
    });
    // Fail-closed heisst FEHLEN. Eine 200er-Antwort mit `null`-Feldern waere hier ein
    // Existenzorakel — schon die Antwort waere eine Auskunft ueber das Objekt.
    expect(verwehrt.statusCode, verwehrt.body).toBe(404);
    expect(verwehrt.body).not.toContain("confidentialityProvenance");
    expect(verwehrt.body).not.toContain("Vertraulicher Pruefling");
    expect(verwehrt.body).not.toContain("Sensibler Kerntext");

    // Und die Gegenprobe: der Kurator oeffnet es sehr wohl, samt Stufe und Beleg.
    const alsPruefer = await detail(app, pruefer, geheim.id);
    expect(alsPruefer.confidentiality).toBe("vertraulich");
    expect(alsPruefer.confidentialityProvenance).toBe("ko");
  });

  it("R4 · EINE REGEL: Board und Detailabruf sagen fuer dasselbe Objekt dasselbe", async () => {
    const { app, services, pruefer } = await setup();
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Niemand hat dieses Objekt je eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });
    const mit = await services.ko.create({
      title: "Objekt mit Einstufung",
      statement: "Dieses Objekt ist eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      confidentiality: "streng_vertraulich",
    });

    const brett = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: pruefer,
    });
    expect(brett.statusCode, brett.body).toBe(200);
    const zeilen = brett.json() as (Antwort & { id: string })[];

    for (const id of [ohne.id, mit.id]) {
      const zeile = zeilen.find((z) => z.id === id);
      if (!zeile) {
        throw new Error(`Kennung ${id} steht nicht auf dem Board (${zeilen.length} Zeilen).`);
      }
      const voll = await detail(app, pruefer, id);
      expect(voll.confidentiality).toBe(zeile.confidentiality);
      expect(voll.confidentialityProvenance).toBe(zeile.confidentialityProvenance);
    }
  });

  it("R5 · KEIN BACKFILL: nach dem Detailabruf steht im Bestand weiterhin KEINE Stufe", async () => {
    const { app, repos, services, pruefer } = await setup();
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Der Lesepfad schreibt nicht.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    const voll = await detail(app, pruefer, ohne.id);
    expect(voll).toHaveProperty("confidentiality", null);

    // Die Anreicherung ist eine LESE-SICHT. Am Bestand fehlt der Schluessel danach genauso wie
    // vorher — kein Nachtrag, keine Wanderung, kein stilles „intern".
    const gespeichert = await repos.koRepo.findById(ohne.id);
    expect(gespeichert, "das Objekt liegt weiterhin im Bestand").toBeDefined();
    expect(Object.hasOwn(gespeichert as object, "confidentiality")).toBe(false);
  });

  it("R6 · ALTWERT: eine ungueltige gespeicherte Stufe wird `null`/`unknown` und NICHT `intern`", async () => {
    const { app, repos, services, pruefer } = await setup();
    const ko = await services.ko.create({
      title: "Objekt mit Altwert",
      statement: "Eine fremd geschriebene Zeile traegt einen Wert, den es nicht gibt.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });
    const zeile = await repos.koRepo.findById(ko.id);
    if (!zeile) {
      throw new Error("Vorbedingung: das Objekt liegt im Bestand.");
    }
    await repos.koRepo.update({ ...zeile, confidentiality: "geheimsache" as Confidentiality });

    const voll = await detail(app, pruefer, ko.id);
    // `isValidConfidentiality` und NICHT `normalizeConfidentiality`: ein unbekannter Wert ist eine
    // UNBEKANNTE Stufe. „intern" waere eine Einstufung, die nie jemand gesetzt hat.
    expect(voll).toHaveProperty("confidentiality", null);
    expect(voll.confidentialityProvenance).toBe("unknown");
    expect(voll.confidentiality).not.toBe("intern");
  });
});
