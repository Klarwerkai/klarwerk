// ==================================================================================================
// JOB 3022 · DIE ANTWORT SAGT SELBST, WO SIE AUFGEHÖRT HAT ZU ANTWORTEN.
// ==================================================================================================
//
// DER MANGEL, GEGEN DEN DIESER TEST STEHT: `GET /api/graph` trug bis JOB 3022 nur `nodes`/`edges`.
// Eine Antwort mit 5.000 Kanten sah damit exakt so aus wie ein vollständiger Graph mit 5.000
// Kanten — die Fläche konnte gar nicht wissen, dass gedeckelt wurde, und ein weggelassenes
// Schlagwort (`pilot-demo`) verschwand spurlos. Jetzt reisen `totalEdges`, `truncated`, `edgeLimit`
// und `excludedTags` mit.
//
// DURCH DIE ECHTE ROUTE, nicht am Dienst vorbei (Muster: tests/wissensnetz/h3-aufrufer-route.test.ts):
// die Felder nützen nur, wenn sie die Kette Route → Serialisierung wirklich überstehen. Der Dienst
// allein war schon zweimal grün, während der Weg nach draußen fehlte.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "netz@klarwerk.de", password: "secret123" };

// Sechs Objekte: `pilot-demo` auf ALLEN (Zähler 6 ≥ UBIQUITY_MIN_COUNT, Anteil 100 % >
// UBIQUITY_MAX_SHARE → ubiquitär), dazu zwei echte Schlagwortpaare, die je EINE Kante tragen.
const BESTAND: [string, string[]][] = [
  ["Ventil entlueften", ["pilot-demo", "ventil"]],
  ["Ventil pruefen", ["pilot-demo", "ventil"]],
  ["Pumpe schmieren", ["pilot-demo", "pumpe"]],
  ["Pumpe tauschen", ["pilot-demo", "pumpe"]],
  ["Kessel reinigen", ["pilot-demo"]],
  ["Filter wechseln", ["pilot-demo"]],
];

async function bestueckteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  for (const [title, tags] of BESTAND) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: `${title} — Kurzfassung fuer den Pruefstand.`,
        type: "best_practice",
        category: "Wartung",
        tags,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  return { app, headers };
}

interface GraphAntwort {
  nodes: { id: string; title: string }[];
  edges: { a: string; b: string; via: string }[];
  totalEdges: number;
  truncated: boolean;
  edgeLimit: number;
  excludedTags: string[];
}

describe("JOB 3022 · GET /api/graph trägt seine Grenzen mit", () => {
  it("die Antwort nennt totalEdges, truncated, edgeLimit und excludedTags", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await app.inject({ method: "GET", url: "/api/graph", headers });

    expect(res.statusCode, res.body).toBe(200);
    const g = res.json() as GraphAntwort;
    const titel = new Map(g.nodes.map((n) => [n.id, n.title]));

    expect(g.nodes).toHaveLength(BESTAND.length);
    // Zwei echte Kanten: ventil und pumpe. Der Marker verbindet niemanden.
    // Die Kanten werden über TITEL verglichen und alphabetisch geordnet: die Ids vergibt der
    // Server (uuid), und die Kantenreihenfolge folgt ihnen — sie ist deterministisch, aber für
    // diesen Bestand nicht vorhersagbar. Geprüft wird der Inhalt, nicht die Id-Lotterie.
    const kanten = g.edges
      .map((e) => `${[titel.get(e.a), titel.get(e.b)].sort().join(" ~ ")} (${e.via})`)
      .sort();
    expect(kanten).toEqual([
      "Pumpe schmieren ~ Pumpe tauschen (pumpe)",
      "Ventil entlueften ~ Ventil pruefen (ventil)",
    ]);
    expect(g.totalEdges).toBe(2);
    expect(g.truncated).toBe(false);
    expect(typeof g.edgeLimit).toBe("number");
    expect(g.edgeLimit).toBeGreaterThan(0);
  });

  it("ein allgegenwärtiges Schlagwort erzeugt keine Kante und wird ausgewiesen", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await app.inject({ method: "GET", url: "/api/graph", headers });
    const g = res.json() as GraphAntwort;

    expect(g.excludedTags).toEqual(["pilot-demo"]);
    expect(g.edges.some((e) => e.via === "pilot-demo")).toBe(false);
    // Ohne die Regel wären es alle 15 Paare der sechs Objekte — die Zahl belegt, dass der Filter
    // VOR der Zählung wirkt und `totalEdges` nicht heimlich die verworfenen Kanten mitzählt.
    expect(g.totalEdges).toBe(2);
  });
});
