// ================================================================================================
// AUFTRAG-mega76 BLOCK A — DER WÄCHTER, DER DAS ANTWORTVERHALTEN PINNT.
// ================================================================================================
//
// BENS MERKSATZ, an dem dieser Test gebaut ist: „Ein Wächter, dessen Liste, Suchmuster oder
// optionaler Guard nur die eigene Annahme wiederholt, prüft nicht das System, sondern sich selbst."
//
// Deshalb steht hier KEIN Quelltext-Scan nach `kos?:` und keine Namensliste. Dieser Test BAUT die
// vier Lesewege OHNE ihre Schutzabhängigkeit und schaut, was am Draht herauskommt. Er ist damit
// unabhängig davon, wie die Abhängigkeit heißt, ob sie optional deklariert ist und ob irgendein
// Kommentar sie erwähnt.
//
// WAS ER BEWEIST. Die Kompositionswurzel verdrahtet die vier Zugänge heute — der laufende Aufbau
// ist geschützt. Der VERTRAG war es nicht: ein zweiter Aufbau, ein Testaufbau oder ein späterer
// Umbau durfte den Schutz typgültig weglassen, und die Route lieferte dann nicht fail-closed,
// sondern das ALTE, UNGEFILTERTE Ergebnis.
//
// Nach mega76 sind alle vier Zugänge Pflichtparameter. Ein Aufrufer, der sie weglässt, wird vom
// Compiler gestoppt — der `as never`-Cast unten UMGEHT genau diesen Compiler und stellt damit den
// Fall her, den der Typ allein nicht abdeckt: JavaScript-Aufrufer, `JSON.parse`-Konfigurationen,
// ein späteres `Partial<Deps>`. Auch DA muss die Antwort fail-closed sein.
//
// ROT-ZUERST-KALIBRIERUNG: gegen die Fassung vor mega76 fällt jeder der vier Fälle, weil die Route
// dort ihr ungefiltertes Ergebnis herausgibt. Die Ausgaben stehen wörtlich im Bericht.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { conflictRoutes } from "../../services/app/src/routes/conflicts-routes";
import { notificationsRoutes } from "../../services/app/src/routes/notifications-routes";
import { objectRoutes } from "../../services/app/src/routes/object-routes";
import { overlapRoutes } from "../../services/app/src/routes/overlap-routes";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

// Der Betrachter dieses Tests: ein Leser OHNE `ko.validate`. Er darf ein vertrauliches Objekt
// weder öffnen noch seinen Inhalt über einen Nebenweg lesen.
const LESER: SessionUser = { id: "leser-1", role: "viewer" };

const guards: Guards = {
  requireUser: async () => LESER,
  requirePermission: async () => LESER,
};

// Ein Konflikt/eine Überschneidung zwischen zwei Objekten, von denen KEINES sichtbar ist. Beide
// tragen wörtliche Belegzitate — genau das, was der Nebenweg ausplaudert.
const KONFLIKT = {
  id: "c-1",
  koA: "ko-vertraulich",
  koB: "ko-vertraulich-2",
  description: "GEHEIMZITAT-KONFLIKT",
  status: "open",
  createdAt: "2026-07-31T06:00:00.000Z",
};

const UEBERSCHNEIDUNG = {
  id: "d-1",
  koA: "ko-vertraulich",
  koB: "ko-vertraulich-2",
  rationale: "GEHEIMZITAT-DUPLIKAT",
  aspects: ["GEHEIMZITAT-ASPEKT"],
  status: "open",
  confidence: 0.9,
  createdAt: "2026-07-31T06:00:00.000Z",
};

// `as never` ist hier das eigentliche Werkzeug: es liefert dem Pflichtparameter einen Wert, den
// der Typ verbietet, und stellt damit den Aufrufer nach, den der Compiler nicht sieht.
const OHNE_ZUGANG = undefined as never;

let offen: FastifyInstance[] = [];

async function app(register: (instance: FastifyInstance) => void): Promise<FastifyInstance> {
  const instance = Fastify();
  register(instance);
  await instance.ready();
  offen.push(instance);
  return instance;
}

afterEach(async () => {
  for (const instance of offen) {
    await instance.close();
  }
  offen = [];
});

describe("mega76 A · eine Route ohne ihre Schutzabhängigkeit antwortet fail-closed", () => {
  it("Konfliktliste liefert LEER statt des ungefilterten Bestands", async () => {
    const instance = await app((i) =>
      i.register(
        conflictRoutes(
          { unresolved: async () => [KONFLIKT] } as never,
          guards,
          // DER FALL: kein Sichtbarkeitszugang.
          OHNE_ZUGANG,
        ),
      ),
    );

    const res = await instance.inject({ method: "GET", url: "/api/conflicts" });
    expect(res.statusCode).toBe(200);
    expect(
      res.json(),
      `Ohne Zugang darf die Liste NICHT das alte Ergebnis sein. Antwort: ${res.body}`,
    ).toEqual([]);
    expect(res.body).not.toContain("GEHEIMZITAT-KONFLIKT");
  });

  it("Konfliktdetail liefert 404 statt der wörtlichen Belegzitate", async () => {
    const instance = await app((i) =>
      i.register(conflictRoutes({ get: async () => KONFLIKT } as never, guards, OHNE_ZUGANG)),
    );

    const res = await instance.inject({ method: "GET", url: "/api/conflicts/c-1" });
    expect(res.statusCode, `Antwort: ${res.statusCode} ${res.body}`).toBe(404);
    expect(res.body).not.toContain("GEHEIMZITAT-KONFLIKT");
  });

  it("Überschneidungsliste liefert LEER statt aspects/eigenanteil", async () => {
    const instance = await app((i) =>
      i.register(
        overlapRoutes(
          {
            overlaps: { unresolved: async () => [UEBERSCHNEIDUNG] } as never,
            settings: { get: async () => null } as never,
            kos: OHNE_ZUGANG,
          },
          guards,
        ),
      ),
    );

    const res = await instance.inject({ method: "GET", url: "/api/duplicates" });
    expect(res.statusCode).toBe(200);
    expect(res.json(), `Antwort: ${res.body}`).toEqual([]);
    expect(res.body).not.toContain("GEHEIMZITAT");
  });

  it("Überschneidungsdetail liefert 404", async () => {
    const instance = await app((i) =>
      i.register(
        overlapRoutes(
          {
            overlaps: { get: async () => UEBERSCHNEIDUNG } as never,
            settings: { get: async () => null } as never,
            kos: OHNE_ZUGANG,
          },
          guards,
        ),
      ),
    );

    const res = await instance.inject({ method: "GET", url: "/api/duplicates/d-1" });
    expect(res.statusCode, `Antwort: ${res.statusCode} ${res.body}`).toBe(404);
    expect(res.body).not.toContain("GEHEIMZITAT");
  });

  it("Benachrichtigungsfeed trägt weder Konflikt, Überschneidung noch Zuweisungstitel", async () => {
    const instance = await app((i) =>
      i.register(
        notificationsRoutes(
          {
            conflicts: { unresolved: async () => [KONFLIKT] } as never,
            overlaps: { unresolved: async () => [UEBERSCHNEIDUNG] } as never,
            ask: { listGaps: async () => [] } as never,
            validation: {
              openAssignmentsFor: async () => [
                { id: "a-1", koId: "ko-vertraulich", koTitle: "GEHEIMZITAT-ZUWEISUNG" },
              ],
            } as never,
            audit: { list: async () => [] } as never,
            seen: { seenFor: async () => [] } as never,
            kos: OHNE_ZUGANG,
          },
          guards,
        ),
      ),
    );

    const res = await instance.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(200);
    expect(res.body, `Feed-Antwort: ${res.body}`).not.toContain("GEHEIMZITAT");
  });

  it("Objekt-Metadaten und Rohbytes liefern 404 statt `sichtbar: true`", async () => {
    const store = {
      read: async () => ({
        ref: { id: "obj-1", name: "geheim.png", mime: "image/png" },
        data: "data:image/png;base64,iVBORw0KGgo=",
      }),
    } as never;

    const instance = await app((i) => i.register(objectRoutes(store, guards, OHNE_ZUGANG)));

    const meta = await instance.inject({ method: "GET", url: "/api/objects/obj-1" });
    expect(meta.statusCode, `Metadaten-Antwort: ${meta.statusCode} ${meta.body}`).toBe(404);

    const raw = await instance.inject({ method: "GET", url: "/api/objects/obj-1/raw" });
    expect(raw.statusCode, `Rohbytes-Antwort: ${raw.statusCode}`).toBe(404);
  });
});

// ================================================================================================
// AUFTRAG-mega77 BLOCK D — DIESELBE FAIL-OPEN-KLASSE, EINE EBENE TIEFER.
// ================================================================================================
//
// DER BEFUND, den die Hand in mega76 selbst gemeldet hat: der mega76-Auftrag nannte die Vierer-
// Liste für ROUTEN vollständig — das stimmte. Aber `LibraryService.graph()` und `neighbors()`
// trugen ihren Sichtbarkeitsfilter EBENFALLS optional, nur an DIENSTMETHODEN statt an Routen:
//
//   · `graph(opts = {})` — ohne Filter der volle Bestand, samt aller Titel. Und an der Route ließe
//     sich das nicht nachholen: ein Knoten ist nur noch `{id, title}`, die Stufe ist dort weg, und
//     die KANTEN verraten ein verborgenes Objekt ohnehin über die Struktur.
//   · `neighbors(id, opts)` — ohne `sichtbar` fiel es auf den milderen `includeConfidential`-Zweig
//     zurück (kein Autor-Begriff, kein Zentrums-Tor).
//
// `neighbors()` ist seit Ship 10 LIVE. Die Route reicht den Filter heute durch — der laufende Stand
// ist geschützt —, aber der VERTRAG erlaubte weiterhin, ihn wegzulassen. Genau die Klasse aus
// Block A, eine Ebene tiefer.
//
// WARUM DIESER WÄCHTER HIER STEHT UND NICHT IM DIENST-MODUL: er prüft dasselbe, was oben geprüft
// wird — geschütztes ANTWORTVERHALTEN bei fehlender Schutzabhängigkeit —, nur an der anderen
// Ebene. Zwei Dateien für eine Frage wären die zweite Wahrheit, gegen die mega76 gebaut ist.
//
// Und auch hier KEIN Quelltext-Scan und keine Namensliste: der Dienst wird mit echtem Bestand
// gebaut und OHNE seine Schutzabhängigkeit gerufen. Der `as never`-Cast umgeht den Compiler und
// stellt den Aufrufer her, den der Typ allein nicht abdeckt (JavaScript, `JSON.parse`-Deps,
// `Partial<Opts>`).
//
// ROT-ZUERST-KALIBRIERUNG: gegen die Fassung vor mega77 liefert `graph()` alle Knoten inklusive des
// vertraulichen Titels und `neighbors()` seine Nachbarschaft. Die Ausgaben stehen im Bericht.
describe("mega77 D · eine Dienstmethode ohne ihren Sichtbarkeitsfilter antwortet fail-closed", () => {
  const GEHEIMER_TITEL = "GEHEIMZITAT-KNOTEN";

  // ================================================================================================
  // JOB 901 · D5 — DIE KALIBRIERUNG, DIE DEN SCHUTZBEWEIS VON DER OFFENEN OWNERFRAGE LÖST.
  // ================================================================================================
  //
  // DER BEFUND (BEN4 zu D4): Dieser Bestand trug bis hier ZWEI Objekte, beide mit demselben
  // Schlagwort. Das ist genau der Kleinstbestandsfall, über den die offene Ownerentscheidung **F2**
  // streitet: „Sollen bei zwei, drei und vier ausschliesslich gleich getaggten sichtbaren Objekten
  // null Kanten oder Kanten entstehen?"
  //
  // Solange der Wächter auf dieser Kante steht, entscheidet F2 mit, ob er überhaupt noch misst:
  // Wird F2 mit „null Kanten" beantwortet, verschwindet die Kante — und die Gegenprobe
  // (`mitFilter` MUSS den vertraulichen Nachbarn sehen) fällt, obwohl am Schutz nichts kaputt ist.
  // **Ein Wächter, der an einer offenen Produktentscheidung hängt, bewacht sie mit, statt den
  // Schutz zu bewachen.** Gemessen: unter dem bindenden 2/3/4-Vertrag fiel der alte Bestand mit
  // `expected [] to include 'GEHEIMZITAT-KNOTEN'`.
  //
  // DIE KALIBRIERUNG: fünf sichtbare Objekte, aber nur ZWEI Träger des Schlagworts
  // `ventil-spezial`. Drei Fülleobjekte tragen eigene Schlagwörter und eigene Kategorien, damit
  // keine zusätzlichen Nachbarn entstehen und die Nachbarschaftsprobe scharf bleibt.
  //
  // Damit steht die Kante aus zwei Gründen, die F2 BEIDE nicht berührt:
  //   · **Kein Kleinstbestand mehr** — bei fünf Objekten greift die 2/3/4-Regel nicht, gleich wie
  //     sie entschieden wird.
  //   · **Nicht ubiquitär** — die Ausschlussregel verlangt `count >= UBIQUITY_MIN_COUNT` (5) UND
  //     `count / total > UBIQUITY_MAX_SHARE` (0,5); hier sind es 2 von 5
  //     (`services/library-analytics/src/service.ts:1551`).
  //
  // Der Schutzbeweis ist damit von der Ownerfrage entkoppelt: F2 kann später in JEDE Richtung
  // fallen, ohne dass dieser Wächter blind wird.
  async function bestand() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const offen = await koService.create({
      title: "Offener Knoten",
      statement: "Sichtbar für jeden.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
      tags: ["ventil-spezial"],
    });
    await koService.create({
      title: GEHEIMER_TITEL,
      statement: "Nur für Berechtigte.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
      tags: ["ventil-spezial"],
      confidentiality: "vertraulich",
    });
    // Die drei Füllobjekte: sie heben den Bestand über die Kleinstbestandsgrenze und drücken den
    // Anteil des geteilten Schlagworts auf 2/5 — unter beide Ausschlussschwellen. Eigene
    // Schlagwörter UND eigene Kategorien, damit sie weder Nachbarn noch Kanten erzeugen.
    for (const [nr, tag] of [
      [1, "dichtung"],
      [2, "lager"],
      [3, "welle"],
    ] as const) {
      await koService.create({
        title: `Fuellobjekt ${nr}`,
        statement: "Hebt den Bestand, ohne die Nachbarschaft zu berühren.",
        type: "best_practice",
        category: `Anlage ${nr + 1}`,
        author: "bert",
        tags: [tag],
      });
    }
    return { library: new LibraryService({ koService }), offenId: offen.id };
  }

  it("graph() liefert einen LEEREN Graphen statt aller Knotentitel", async () => {
    const { library } = await bestand();

    // DIE GEGENPROBE ZUERST — sonst bewiese der Test nur, dass der Graph leer ist.
    const mitFilter = await library.graph({ sichtbar: () => true });
    expect(
      mitFilter.nodes.map((n) => n.title),
      "Mit Filter muss der vertrauliche Titel erreichbar sein — sonst ist die Gegenprobe blind",
    ).toContain(GEHEIMER_TITEL);
    expect(mitFilter.edges.length).toBeGreaterThan(0);

    // DER FALL: kein Sichtbarkeitsfilter.
    const ohne = await library.graph(undefined as never);
    expect(
      ohne.nodes,
      `Ohne Filter darf der Graph NICHT den alten Bestand sein. Knoten: ${JSON.stringify(ohne.nodes)}`,
    ).toEqual([]);
    expect(ohne.edges).toEqual([]);
    expect(JSON.stringify(ohne)).not.toContain(GEHEIMER_TITEL);
  });

  it("neighbors() liefert NOT_FOUND statt der Nachbarschaft", async () => {
    const { library, offenId } = await bestand();

    // Gegenprobe: mit Filter ist das Zentrum auffindbar und hat einen Nachbarn.
    const mitFilter = await library.neighbors(offenId, { sichtbar: () => true });
    expect(mitFilter.neighbors.map((n) => n.title)).toContain(GEHEIMER_TITEL);

    // DER FALL: ohne Filter ist schon das ZENTRUM unsichtbar — die Auskunft endet, bevor sie
    // beginnt. Ein 404 ist hier die richtige fail-closed-Antwort: ein unsichtbares Zentrum sieht
    // aus wie ein fehlendes.
    await expect(
      library.neighbors(offenId, undefined as never),
      "Ohne Filter darf keine Nachbarschaft herausgehen",
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("analytics() und busFactor() zählen ohne Filter NICHTS — auch nicht die Gesamtzahl", async () => {
    // mega76 Block D hat diese beiden zu Pflichtparametern gemacht, ihnen aber keine Rückfallebene
    // unter dem Compiler gegeben. Seit mega77 laufen alle vier Auskünfte durch dieselbe eine
    // Stelle (`erzwingeSichtbar`) — das gilt hier genauso.
    const { library } = await bestand();

    const mitFilter = await library.analytics({ sichtbar: () => true });
    // JOB 901 D5: hier stand `2`. Der Wert folgt der oben kalibrierten Bestandsgröße und ist von
    // 2 auf 5 gestiegen — die ZUSAGE des Falls ist unverändert („mit Filter wird gezählt"),
    // gezählt wird nur ein größerer Bestand. Ausdrücklich benannt, weil eine stillschweigend
    // angepasste Zahl in einem Sicherheitstest genau die Art Änderung ist, die später niemand mehr
    // zuordnen kann.
    expect(mitFilter.total, "Gegenprobe: mit Filter wird gezählt").toBe(5);

    const ohne = await library.analytics(undefined as never);
    expect(
      ohne.total,
      `Ohne Filter darf nichts gezählt werden. Antwort: ${JSON.stringify(ohne)}`,
    ).toBe(0);
    expect(JSON.stringify(ohne)).not.toContain(GEHEIMER_TITEL);

    expect((await library.busFactor({ sichtbar: () => true })).length).toBeGreaterThan(0);
    expect(await library.busFactor(undefined as never)).toEqual([]);
  });
});
