// ================================================================================================
// JOB 4155 · RUNDE 3 — L9: DIE KURATIERTEN KANTEN STEHEN UNTER DERSELBEN ANTWORTBEGRENZUNG.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI FESTHÄLT, IST NICHT MEINER — BEN hat ihn am unveränderten Produkt
// der Runde 2 reproduziert, und er war ein echter Vertragsbruch:
//
//     102 sichtbare Objekte, 5.151 verschiedene aktive Beziehungen
//     → „BEN Grenze: 5151 kuratierte Kanten, edgeLimit=5000, truncated=false"
//
// 5.151 ist das vollständige Paarprodukt von 102 Objekten (102·101/2). Runde 2 hatte den Deckel
// AUSDRÜCKLICH weggelassen, mit der Begründung, kuratierte Kanten würden „von Menschen gesetzt"
// und wüchsen nicht quadratisch. Diese Begründung ist durch genau diesen Bestand widerlegt: nichts
// hindert eine Beziehungsmenge daran, quadratisch zu werden. Und der verbindliche Vertrag sagt es
// ohnehin wörtlich — die kuratierten Kanten gehen hinaus „unter demselben Sichtbarkeitsfilter und
// derselben Antwortbegrenzung" (`jobs/4151/HINWEIS.md`, „Mengenabfrage und globaler Graph").
//
// WAS HIER GEMESSEN WIRD, und warum in dieser Staffelung:
//   · UNTER dem Deckel   — nichts wird gekürzt, und die Kürzungsauskunft sagt das auch.
//   · ÜBER dem Deckel    — genau `edgeLimit` Kanten kommen an, die Zahl VOR dem Deckel steht
//                          daneben, und `kuratierteKantenGekuerzt` ist wahr. Das ist BENs Fall,
//                          Objekt für Objekt und Kante für Kante nachgebaut.
//   · DETERMINISTISCH    — zwei Abrufe auf demselben Bestand liefern DIESELBEN 5.000 Kanten. Ohne
//                          diese Zusage wäre der Deckel eine Zufallsauswahl, und die Zeichnung
//                          änderte sich bei jedem Neuladen.
//   · GETRENNTE BUDGETS  — die abgeleiteten Schlagwortkanten und ihre Grenzauskünfte
//                          (`edges`, `totalEdges`, `truncated`, `edgeLimit`) bleiben unberührt.
//                          Ein gemeinsames Budget hätte die eine Menge der anderen Kanten
//                          wegnehmen lassen, und zwar bestandsabhängig.
//
// DER BESTAND ENTSTEHT ÜBER DEN REPO-WEG, nicht über den Schreibdienst: 5.151 echte HTTP-Setzungen
// wären Minuten Laufzeit für eine Zusage, die mit dem Schreibweg nichts zu tun hat. Dass der
// Schreibweg trägt, steht an seiner eigenen Stelle (`tests/wissensgraph-integration/**`). Hier
// zählt allein, was `GET /api/graph` aus einem vorhandenen Bestand macht.
import { describe, expect, it } from "vitest";
import { kante } from "../wissensgraph-integration/bestandsvertrag";
import { type Buehne, baueBuehne, kopfFuer } from "../wissensgraph-integration/buehne";

/** Derselbe Wert wie `GRAPH_EDGE_LIMIT` in `services/library-analytics/src/service.ts`. */
const DECKEL = 5_000;

interface Graphantwort {
  nodes: { id: string }[];
  edges: { a: string; b: string; via: string }[];
  totalEdges: number;
  truncated: boolean;
  edgeLimit: number;
  kuratierteKanten?: { a: string; b: string; art: string }[];
  kuratierteKantenGesamt?: number;
  kuratierteKantenGekuerzt?: boolean;
}

/**
 * `anzahl` sichtbare Objekte und ALLE Paare zwischen ihnen als aktive Beziehung.
 *
 * Die Kennungen werden auf gleiche Länge gepolstert (`ko-0007`), damit die Sortierung des Dienstes
 * (`localeCompare` über `a`, dann `b`) dieselbe Ordnung ergibt wie hier — sonst prüfte der
 * Determinismusfall unten eine Ordnung, die schon im Prüfstand eine andere ist.
 */
async function bestandMitAllenPaaren(
  buehne: Buehne,
  anzahl: number,
): Promise<{ ids: string[]; paare: number }> {
  const ids: string[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const ko = await buehne.services.ko.create({
      title: `Grenzobjekt ${String(i).padStart(4, "0")}`,
      statement: `Aussage des Grenzobjekts ${i}.`,
      type: "best_practice",
      category: "Betrieb",
      author: buehne.konto.controller.id,
      // OHNE Schlagwort: so entsteht KEINE abgeleitete Schlagwortkante. Die beiden Mengen müssen
      // hier auseinandergehalten werden, und der sauberste Weg dazu ist ein Bestand, in dem die
      // eine leer ist.
      tags: [],
      confidentiality: "intern",
    });
    ids.push(ko.id);
  }
  ids.sort((a, b) => a.localeCompare(b));

  let paare = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const quelleId = ids[i] as string;
      const zielId = ids[j] as string;
      await buehne.kanten.setze(
        kante({ id: `k-${i}-${j}`, quelleId, zielId, art: "ergaenzt", richtung: "ungerichtet" }),
      );
      paare += 1;
    }
  }
  return { ids, paare };
}

async function graph(buehne: Buehne): Promise<Graphantwort> {
  const antwort = await buehne.app.inject({
    method: "GET",
    url: "/api/graph",
    headers: kopfFuer(buehne, "controller"),
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as Graphantwort;
}

describe("JOB 4155 · L9 — die kuratierten Kanten stehen unter derselben Antwortbegrenzung", () => {
  it("UNTER dem Deckel: nichts wird gekürzt, und die Auskunft sagt genau das", async () => {
    const buehne = await baueBuehne();
    try {
      // 20 Objekte ⇒ 190 Paare. Weit unter dem Deckel, aber gross genug, dass eine versehentliche
      // Kürzung auffiele.
      const { paare } = await bestandMitAllenPaaren(buehne, 20);
      expect(paare).toBe(190);

      const antwort = await graph(buehne);
      expect(antwort.kuratierteKanten).toHaveLength(190);
      expect(antwort.kuratierteKantenGesamt).toBe(190);
      expect(antwort.kuratierteKantenGekuerzt, "unter dem Deckel wird nichts gekürzt").toBe(false);
    } finally {
      await buehne.schliesse();
    }
  }, 120_000);

  // ==============================================================================================
  // BENs FALL, NACHGEBAUT: 102 Objekte, 5.151 Beziehungen, Deckel 5.000.
  // ==============================================================================================
  it("ÜBER dem Deckel: genau edgeLimit Kanten, die Zahl davor steht daneben, und die Kürzung ist angesagt", async () => {
    const buehne = await baueBuehne();
    try {
      const { paare } = await bestandMitAllenPaaren(buehne, 102);
      // Die Zahl aus BENs Messung, hier gerechnet statt abgeschrieben: 102·101/2.
      expect(paare, "der Prüfstand baut nicht den Bestand, um den es geht").toBe(5_151);
      expect(paare).toBeGreaterThan(DECKEL);

      const antwort = await graph(buehne);

      // DER KERN DER KORREKTURPFLICHT: nicht mehr alle 5.151 gehen hinaus.
      expect(
        antwort.kuratierteKanten,
        "die kuratierte Kantenmenge umgeht die Antwortbegrenzung",
      ).toHaveLength(DECKEL);
      expect(antwort.edgeLimit, "der Deckel dieser Antwort ist ein anderer geworden").toBe(DECKEL);

      // UND DIE KÜRZUNG IST LESBAR. Ohne diese beiden Felder zeichnete eine Fläche 5.000 von 5.151
      // Beziehungen und behauptete dabei, den Bestand zu zeigen.
      expect(antwort.kuratierteKantenGesamt, "die Zahl vor dem Deckel fehlt").toBe(5_151);
      expect(antwort.kuratierteKantenGekuerzt, "die Kürzung wird verschwiegen").toBe(true);

      // DIE ABGELEITETEN KANTEN UND IHRE GRENZAUSKÜNFTE SIND UNBERÜHRT. Kein Objekt trägt ein
      // Schlagwort, also gibt es dort nichts — und die 5.000 kuratierten Kanten haben sich nicht
      // aus dem Budget der anderen Menge bedient.
      expect(antwort.edges).toEqual([]);
      expect(antwort.totalEdges).toBe(0);
      expect(antwort.truncated).toBe(false);
      // Die Knoten selbst sind NICHT gedeckelt (der Deckel liegt auf den Kanten, `types.ts`).
      expect(antwort.nodes).toHaveLength(102);
    } finally {
      await buehne.schliesse();
    }
  }, 180_000);

  it("der Schnitt ist deterministisch: zwei Abrufe liefern DIESELBEN Kanten", async () => {
    const buehne = await baueBuehne();
    try {
      await bestandMitAllenPaaren(buehne, 102);
      const erste = await graph(buehne);
      const zweite = await graph(buehne);

      // Ohne diese Zusage wäre der Deckel eine Zufallsauswahl: die Zeichnung zeigte bei jedem
      // Neuladen andere Beziehungen, und niemand könnte sagen, welche fehlen.
      expect(zweite.kuratierteKanten, "der Schnitt ist nicht wiederholbar").toEqual(
        erste.kuratierteKanten,
      );
      // Und er schneidet wirklich am Ende ab, statt irgendwo: die erste Kante ist die kleinste.
      const sortiert = [...(erste.kuratierteKanten ?? [])].sort(
        (x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.art.localeCompare(y.art),
      );
      expect(erste.kuratierteKanten).toEqual(sortiert);
    } finally {
      await buehne.schliesse();
    }
  }, 180_000);

  it("ohne verdrahteten Kantenbestand fehlen alle drei Felder — keine 0, kein `false`", async () => {
    // Die Gegenprobe zur Ehrlichkeit der Auskunft: „nicht erhoben" darf nicht aussehen wie
    // „nachgesehen und nichts gefunden". Gemessen am Dienst, weil die Kompositionswurzel den
    // Bestand immer verdrahtet — genau das ist ja der Sinn von Lieferung 1.
    const { LibraryService } = await import("../../services/library-analytics/src/service");
    const buehne = await baueBuehne();
    try {
      await bestandMitAllenPaaren(buehne, 5);
      const ohnePort = new LibraryService({ koService: buehne.services.ko });
      const antwort = await ohnePort.graph({ sichtbar: () => true });

      expect(Object.hasOwn(antwort, "kuratierteKanten")).toBe(false);
      expect(Object.hasOwn(antwort, "kuratierteKantenGesamt")).toBe(false);
      expect(Object.hasOwn(antwort, "kuratierteKantenGekuerzt")).toBe(false);
      // Die abgeleitete Menge antwortet trotzdem vollständig — die Erweiterung ist additiv.
      expect(antwort.edgeLimit).toBe(DECKEL);
    } finally {
      await buehne.schliesse();
    }
  }, 120_000);
});
