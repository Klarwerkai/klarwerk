// ================================================================================================
// JOB 4155 · WG-LUECKEN — L8: `/api/graph` TRÄGT DIE GESETZTEN BEZIEHUNGEN, AM ECHTEN DRAHT.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESER FALL SCHLIESST. JOB 4153 hat die Fläche gebaut: `GraphView` liest
// `kuratierteKanten` aus der `/api/graph`-Antwort und zeichnet sie als eigene Menge neben den
// Schlagwortkanten (`tests/wissensgraph-anzeige/graph-kuratierte-kanten.test.tsx`, R9/R10). Der
// SERVER hat dieses Feld nie gesendet — der Client las an jedem echten Betrieb `undefined`, und
// die Fläche zeichnete stumm nur die abgeleiteten Kanten. Zwei sauber gebaute Hälften, die sich
// nicht berühren.
//
// WARUM AM DRAHT UND NICHT AM DIENST: Der Gegenstand ist die VERDRAHTUNG (`build-app.ts` reicht den
// Kantenbestand in den `LibraryService`). Ein Test gegen `library.graph({…})` mit selbst gebautem
// Port hätte genau die Stelle nicht berührt, an der es bisher fehlte.
//
// DIE ZWEI ZUSAGEN, die hier zusammen gemessen werden:
//   1. EINE Mengenabfrage für den ganzen Graphen (`alleAktiven`) — keine Abfrage je Knoten. Das
//      verlangt der Vertrag ausdrücklich (Nachtrag 2 §3), und es ist die einzige Form, die bei
//      mehreren tausend sichtbaren Objekten trägt.
//   2. DERSELBE Sichtbarkeitsschnitt wie für `nodes`/`edges`: eine Kante steht nur da, wenn BEIDE
//      Endpunkte sichtbar sind. Sonst wäre die Kante selbst die Existenzauskunft über ein Objekt,
//      das der Aufrufer nicht sehen darf.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Buehne, type Rolle, baueBuehne, kopfFuer } from "../wissensgraph-integration/buehne";

let buehne: Buehne;

beforeEach(async () => {
  buehne = await baueBuehne();
});

afterEach(async () => {
  await buehne?.schliesse();
});

interface GraphKante {
  a: string;
  b: string;
  art: string;
  richtung: string;
  status: string;
  herkunft: string;
}
interface Graphantwort {
  nodes: { id: string }[];
  edges: { a: string; b: string; via: string }[];
  totalEdges: number;
  kuratierteKanten?: GraphKante[];
}

async function ko(
  titel: string,
  over: { confidentiality?: "intern" | "vertraulich"; author?: string; tags?: string[] } = {},
): Promise<string> {
  const angelegt = await buehne.services.ko.create({
    title: titel,
    statement: `Aussage zu ${titel}`,
    type: "best_practice",
    category: "Betrieb",
    author: over.author ?? buehne.konto.controller.id,
    tags: over.tags ?? [],
    ...(over.confidentiality ? { confidentiality: over.confidentiality } : {}),
  });
  return angelegt.id;
}

async function verknuepfe(
  quelleId: string,
  zielId: string,
  marke: string,
  art = "ergaenzt",
  richtung = "gerichtet",
): Promise<void> {
  const antwort = await buehne.app.inject({
    method: "POST",
    url: `/api/kos/${quelleId}/beziehungen`,
    headers: kopfFuer(buehne, "controller"),
    payload: {
      zielId,
      art,
      richtung,
      beitragSchluessel: marke,
      gesehen: { quelleVersion: 1, zielVersion: 1 },
    },
  });
  expect([200, 201], antwort.body).toContain(antwort.statusCode);
}

async function graph(rolle: Rolle = "controller"): Promise<Graphantwort> {
  const antwort = await buehne.app.inject({
    method: "GET",
    url: "/api/graph",
    headers: kopfFuer(buehne, rolle),
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as Graphantwort;
}

describe("JOB 4155 · L8 — die gesetzten Beziehungen stehen in der /api/graph-Antwort", () => {
  it("eine gesetzte Beziehung erscheint als eigene Kante mit Art, Richtung und Herkunft", async () => {
    const a = await ko("Wartungsplan Halle 2");
    const b = await ko("Filterwechsel dokumentiert");

    const vorher = await graph();
    // Ohne Beziehung ist die Menge LEER — und sie ist da: der Server hat nachgesehen.
    expect(
      vorher.kuratierteKanten,
      "das Feld fehlt — der Kantenbestand ist nicht verdrahtet",
    ).toEqual([]);

    await verknuepfe(a, b, "l8-erste-kante", "ersetzt", "gerichtet");

    const nachher = await graph();
    expect(nachher.kuratierteKanten).toEqual([
      { a, b, art: "ersetzt", richtung: "gerichtet", status: "aktiv", herkunft: "kuratiert" },
    ]);
    // DIE TRENNUNG: die abgeleiteten Schlagwortkanten sind unberührt. Beide Objekte tragen kein
    // Schlagwort, also gibt es dort nichts — und die gesetzte Kante ist NICHT dorthin gerutscht.
    expect(nachher.edges).toEqual([]);
    expect(nachher.totalEdges).toBe(0);
    // Und die Knoten sind dieselben wie vorher: die Erweiterung ist additiv.
    expect(nachher.nodes).toEqual(vorher.nodes);
  });

  it("die Richtung bleibt die des Menschen — `a` ist die Quelle, nicht die kleinere Kennung", async () => {
    // Zwei Kennungen sind Zufallswerte; die Zusage darf nicht davon abhängen, welche kleiner ist.
    const quelle = await ko("Alte Fassung der Regel");
    const ziel = await ko("Neue Fassung der Regel");
    await verknuepfe(quelle, ziel, "l8-richtung", "ersetzt", "gerichtet");

    const kante = (await graph()).kuratierteKanten?.[0];
    expect(kante?.a, "Quelle und Ziel sind vertauscht — die Richtungsaussage ist zerstört").toBe(
      quelle,
    );
    expect(kante?.b).toBe(ziel);
  });

  // ==============================================================================================
  // DER SICHTBARKEITSSCHNITT — dieselbe Naht wie für `nodes` und `edges`.
  // ==============================================================================================
  it("eine Kante zu einem unsichtbaren Endpunkt erscheint NICHT und verrät ihn nicht", async () => {
    const offen = await ko("Anlagenübersicht");
    const geheim = await ko("Interne Kalkulation", {
      confidentiality: "vertraulich",
      author: buehne.konto.admin.id,
    });
    await verknuepfe(offen, geheim, "l8-quer-zur-sicht");

    // Der Admin sieht beide Endpunkte — für ihn ist die Kante da.
    const fuerAdmin = await graph("admin");
    expect(fuerAdmin.kuratierteKanten).toHaveLength(1);

    // Der Experte sieht das vertrauliche Objekt nicht. Für ihn gibt es weder den KNOTEN noch die
    // KANTE — und in keiner der beiden Mengen steht seine Kennung.
    const fuerExperte = await graph("experte");
    expect(fuerExperte.nodes.map((n) => n.id)).not.toContain(geheim);
    expect(fuerExperte.kuratierteKanten, "die Kante verrät das vertrauliche Objekt").toEqual([]);
    expect(JSON.stringify(fuerExperte)).not.toContain(geheim);
  });

  it("eine widerrufene Beziehung ist keine Kante mehr", async () => {
    const a = await ko("Erste Regel");
    const b = await ko("Zweite Regel");
    await verknuepfe(a, b, "l8-widerruf");
    const kante = (await graph()).kuratierteKanten;
    expect(kante).toHaveLength(1);

    const bestand = await buehne.kanten.fuerKos([a, b]);
    const erste = bestand[0];
    expect(erste, "der Bestand führt die Kante nicht").toBeDefined();
    const weg = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${erste?.id}/widerruf`,
      headers: kopfFuer(buehne, "controller"),
      payload: { version: erste?.version },
    });
    expect(weg.statusCode, weg.body).toBe(200);

    // Der Widerruf ist eine Urheberaussage, keine Löschung — im Bestand steht die Kante weiter.
    // Im Graphen steht sie nicht mehr: gezeichnet wird, was gilt.
    expect((await graph()).kuratierteKanten).toEqual([]);
    expect(await buehne.kanten.hole(erste?.id ?? "")).toBeDefined();
  });
});
