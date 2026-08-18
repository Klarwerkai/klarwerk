// ================================================================================================
// JOB 955 / D4 — DIE DREI GRAPHKETTEN AM DRAHT, NICHT AM QUELLTEXT.
// ================================================================================================
//
// BEN4 hat an D2 geruegt: *„Quelltext- und Typformpruefungen beweisen weder Route, Rechtefilter,
// Datenquelle, Clientabruf noch das Ausbleiben von Kantenlecks."* Diese Datei misst deshalb
// VERHALTEN: echte Dienste aus `buildServices()`, echte App aus `buildApp()`, echte Anmeldung,
// echte Rollen, echte Routen. Kein Mock, keine Regex auf Produktcode.
//
// WARUM DIESE DATEI ERNEUT ENTSTEHT: Der D3-Stand lag ausschliesslich im D3-Clone unter
// `/private/tmp` und ist mit dessen Raeumung verloren (Ernte, `00_CONTROL/ERNTE_VERLORENE_
// STAENDE_20260817.md`). BEN4 hat an D3 zu Recht beanstandet, dass der unabhaengige Codebericht
// NULL geaenderte Dateien misst, waehrend die Rueckgabe zwei Testpfade auswies. Diese Datei stellt
// den Teststand in GENAU DEM CLONE her, den der Codepruefer misst — das ist Korrekturpflicht 2.
//
// DIE DREI KETTEN, wie sie auf dieser Base tatsaechlich stehen (nachgemessen, nicht uebernommen):
//
//   A Taggraph    services/library-analytics  →  GET /api/graph            (library-routes.ts:405)
//                 →  Graph {nodes, edges{a,b,via}}  →  Client  →  GraphView
//   B Provenienz  services/provenance         →  GET /api/kos/:id/provenance
//                 →  NUR bei gesetztem Schalter registriert (build-app.ts:1325)
//   C Konflikt    services/conflicts          →  GET /api/conflicts        (conflicts-routes.ts:26)
//
// KETTE B IST IM VORGABEZUSTAND ABGESCHALTET. Das ist ein Produktbefund, kein Nachweisproblem:
// `build-app.ts:1325` registriert die Route nur bei `provenanceEnabled()`, gespeist aus
// `KLARWERK_PROVENANCE_ENABLED` (`feature-flags.ts:30`). V4 haelt den Vorgabezustand fest, V4b den
// echten Rechtefall bei gesetztem Schalter — damit die Luecke nicht stillschweigend verschwindet.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Confidentiality } from "../../services/knowledge-object";

type TestApp = ReturnType<typeof buildApp>;
type TestServices = Awaited<ReturnType<typeof buildServices>>;

interface Aufbau {
  readonly app: TestApp;
  readonly services: TestServices;
  kopfFuer(email: string): Promise<Record<string, string>>;
}

const KENNWORT = "secret123";

/**
 * Echte App mit echten Konten. `schalter` wird VOR `buildServices`/`buildApp` gesetzt —
 * die Provenienzroute wird beim Bau registriert, nicht beim Aufruf.
 */
async function aufbauen(schalter?: { readonly provenienz: boolean }): Promise<Aufbau> {
  const vorher = process.env.KLARWERK_PROVENANCE_ENABLED;
  if (schalter?.provenienz) {
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
  } else {
    process.env.KLARWERK_PROVENANCE_ENABLED = undefined as unknown as string;
    delete process.env.KLARWERK_PROVENANCE_ENABLED;
  }
  let services: TestServices;
  let app: TestApp;
  try {
    services = await buildServices();
    app = buildApp(services);
  } finally {
    // Der Schalter gehoert dem Prozess, nicht dieser Datei — sofort zuruecknehmen.
    if (vorher === undefined) {
      delete process.env.KLARWERK_PROVENANCE_ENABLED;
    } else {
      process.env.KLARWERK_PROVENANCE_ENABLED = vorher;
    }
  }

  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: KENNWORT },
  });
  const kopfFuer = async (email: string): Promise<Record<string, string>> => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  };
  const adminKopf = await kopfFuer("admin@x.de");
  for (const [name, email, role] of [
    ["Expertin", "expertin@x.de", "experte"],
    ["Controllerin", "controllerin@x.de", "controller"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminKopf,
      payload: { name, email, password: KENNWORT, role },
    });
  }
  return { app, services, kopfFuer };
}

async function saeen(
  services: TestServices,
  title: string,
  tags: string[],
  confidentiality: Confidentiality = "intern",
): Promise<string> {
  const ko = await services.ko.create({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    tags,
    confidentiality,
  });
  return ko.id;
}

interface Graphkoerper {
  nodes: { id: string; title?: string }[];
  edges: { a: string; b: string; via: string }[];
}

async function graphFuer(aufbau: Aufbau, email: string): Promise<Graphkoerper> {
  const antwort = await aufbau.app.inject({
    method: "GET",
    url: "/api/graph",
    headers: await aufbau.kopfFuer(email),
  });
  expect(antwort.statusCode, `GET /api/graph fuer ${email}`).toBe(200);
  return antwort.json() as Graphkoerper;
}

const kanteZwischen = (g: Graphkoerper, a: string, b: string) =>
  g.edges.filter((k) => (k.a === a && k.b === b) || (k.a === b && k.b === a));

describe("JOB 955 D4 · Kette A — der Taggraph am Draht", () => {
  it("V1 · zwei Objekte mit demselben Tag ergeben GENAU EINE Kante, und `via` ist der Tag", async () => {
    const aufbau = await aufbauen();
    const eins = await saeen(aufbau.services, "Ventilwartung", ["wartung-955"]);
    const zwei = await saeen(aufbau.services, "Ventilpruefung", ["wartung-955"]);

    const graph = await graphFuer(aufbau, "controllerin@x.de");
    const kanten = kanteZwischen(graph, eins, zwei);

    expect(kanten.length, `Kanten zwischen den beiden: ${JSON.stringify(kanten)}`).toBe(1);
    expect((kanten[0] as { via: string }).via).toBe("wartung-955");
  });

  it("V2 · RECHTE-GEGENFALL: wird ein Objekt vertraulich, verschwinden Knoten UND Kante", async () => {
    const aufbau = await aufbauen();
    const offen = await saeen(aufbau.services, "Offener Vorgang", ["wartung-955"]);
    const heikel = await saeen(aufbau.services, "Heikler Vorgang", ["wartung-955"]);

    // KALIBRIERUNG: vorher sieht die Expertin beides UND die Kante. Ohne diesen Schritt koennte
    // der Fall aus dem falschen Grund gruen sein — etwa weil die Kante nie existierte.
    const vorher = await graphFuer(aufbau, "expertin@x.de");
    expect(
      vorher.nodes.some((n) => n.id === heikel),
      "Kalibrierung: vorher sichtbar",
    ).toBe(true);
    expect(kanteZwischen(vorher, offen, heikel).length, "Kalibrierung: Kante vorhanden").toBe(1);

    await aufbau.services.ko.setConfidentiality(heikel, "vertraulich", "u1");

    const nachher = await graphFuer(aufbau, "expertin@x.de");
    expect(
      nachher.nodes.some((n) => n.id === heikel),
      "der Knoten muss verschwinden",
    ).toBe(false);
    expect(
      kanteZwischen(nachher, offen, heikel).length,
      "auch die Kante muss verschwinden — sonst leckt die Existenz",
    ).toBe(0);

    // GEGENPROBE: wer `ko.validate` traegt, sieht es weiter. Sonst waere der Fall eine
    // Totalausblendung und nicht der Rechtefilter.
    const controller = await graphFuer(aufbau, "controllerin@x.de");
    expect(
      controller.nodes.some((n) => n.id === heikel),
      "Gegenprobe: Controllerin sieht es",
    ).toBe(true);
  });

  it("V3 · NICHT-LECKEN: jede Kante traegt exakt `a`, `b`, `via` — kein fremdes Feld", async () => {
    const aufbau = await aufbauen();
    await saeen(aufbau.services, "Erstes", ["wartung-955"]);
    await saeen(aufbau.services, "Zweites", ["wartung-955"]);
    await saeen(aufbau.services, "Drittes", ["betrieb-955"]);

    const graph = await graphFuer(aufbau, "controllerin@x.de");
    expect(graph.edges.length, "es muss ueberhaupt Kanten geben").toBeGreaterThan(0);

    for (const kante of graph.edges) {
      // Ein fremdes Feld hier hiesse: zwei Ketten sind in einen Wirevertrag verschmolzen.
      expect(Object.keys(kante).sort(), `Kante: ${JSON.stringify(kante)}`).toEqual([
        "a",
        "b",
        "via",
      ]);
    }
  });
});

describe("JOB 955 D4 · Kette B — die Provenienz, in beiden Schalterstellungen", () => {
  it("V4 · im VORGABEZUSTAND ist die Route nicht gemountet — Routing-404, nicht Sichtbarkeits-404", async () => {
    const aufbau = await aufbauen();
    const id = await saeen(aufbau.services, "Beliebig", ["wartung-955"]);

    const antwort = await aufbau.app.inject({
      method: "GET",
      url: `/api/kos/${id}/provenance`,
      headers: await aufbau.kopfFuer("controllerin@x.de"),
    });

    expect(antwort.statusCode).toBe(404);
    // DIE UNTERSCHEIDUNG IST DER PUNKT: Fastify meldet eine NICHT REGISTRIERTE Route mit dem
    // Routentext. Eine Sichtbarkeits-404 aus der Route selbst saehe anders aus. Ohne diese
    // Trennung wuerde „404" beide Faelle verdecken.
    expect(antwort.body, `Antwortkoerper: ${antwort.body}`).toContain("not found");
    expect(antwort.body).toContain("/provenance");
  });

  it("V4b · mit gesetztem Schalter traegt Kette B IHREN EIGENEN Rechtefall", async () => {
    const aufbau = await aufbauen({ provenienz: true });
    const id = await saeen(
      aufbau.services,
      "Vertraulicher Vorgang",
      ["wartung-955"],
      "vertraulich",
    );

    // KALIBRIERUNG: mit Schalter ist die Route ueberhaupt erreichbar. Genau diese Zusicherung hat
    // in D3 den eigenen Fehler aufgedeckt — eine weiche Erwartung `[200, 404]` haette den
    // Rechtefall aus dem falschen Grund gruen gemacht.
    const controller = await aufbau.app.inject({
      method: "GET",
      url: `/api/kos/${id}/provenance`,
      headers: await aufbau.kopfFuer("controllerin@x.de"),
    });
    expect(
      controller.statusCode,
      `Kalibrierung: mit Schalter erreichbar — ${controller.body}`,
    ).toBe(200);

    const expertin = await aufbau.app.inject({
      method: "GET",
      url: `/api/kos/${id}/provenance`,
      headers: await aufbau.kopfFuer("expertin@x.de"),
    });
    expect(expertin.statusCode, "ohne ko.validate ist das vertrauliche Objekt nicht da").toBe(404);
    // Und es ist eine SICHTBARKEITS-404, keine Routing-404 — die Route ist ja registriert.
    expect(expertin.body).not.toContain("Route GET:");
  });
});
