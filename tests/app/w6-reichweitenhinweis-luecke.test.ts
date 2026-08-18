// ================================================================================================
// W6 · DER REICHWEITENHINWEIS `note` — gebaut, aber nur für EINEN der beiden Gründe
// ================================================================================================
//
// JOB 954 · D4. Auftragstext ist das rote Vollurteil BEN-PRUEFUNG-JOB-954-D3 (SHA-256 09eb380e…).
// Auflage 1 verlangt einen Wirevertrag, an dem der Aufrufer ablesen kann, dass eine Prüfung nicht
// die volle Tiefe hatte.
//
// ------------------------------------------------------------------------------------------------
// WAS DIE NACHMESSUNG ERGEBEN HAT — anders, als das Urteil annimmt
// ------------------------------------------------------------------------------------------------
// Der Kanal EXISTIERT bereits. `toResponse` in `services/app/src/routes/check-text-routes.ts:68`
// führt ein Feld `note: string | null`, und die Route füllt es (`:185`):
//
//     const note = wantDeep && confidential ? "… nur deterministisch geprüft …" : null;
//
// Damit ist genau EIN Degradationsgrund gemeldet: vertraulicher Text sperrt Embedder und Judge.
// Die Nachbardatei `check-text-routes.test.ts` sichert ihn dreifach (:450 vertraulicher Draft,
// :469 fehlende Herkunft, :483 Kalibrierung „intern → note null").
//
// DER ZWEITE GRUND FEHLT. Ist `deep` erlaubt und der Prefilter aktiv, der Vektorspeicher aber
// leer, dann fällt die Erkennung auf die lexikalische Kandidatenwahl zurück (belegt in
// `w6-prefilter-zustandsmatrix.test.ts`) — und `note` bleibt `null`. Der Aufrufer bekommt
// dieselbe Antwort wie nach einem echten Tiefenlauf.
//
// Genau das beschreibt Abschnitt 4 des Urteils: „Die UI kann weiterhin eine Tiefe suggerieren,
// die der reale Kandidatenpool nicht deckt." Diese Datei macht es ausführbar nachweisbar, statt
// es zu behaupten.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI IST — und was sie nicht ist
// ------------------------------------------------------------------------------------------------
// Sie ist ein FEHLSTANDSBELEG, keine Zusage. Der letzte Fall hält fest, dass `note` heute im
// Rückfall `null` bleibt. Wer Auflage 1 baut, macht ihn rot; ihn dann nachzuziehen ist der
// bewusste Beleg, dass die Lücke geschlossen wurde. Bis dahin ist er der Nachweis, dass sie offen
// ist. Ein grüner Haken auf einem Mangel wäre ein Scheinbeleg — deshalb steht die Begründung
// direkt an der Zusicherung.
//
// Bauen kann dieser Durchgang die Lücke nicht: der Eingriffsort wäre `check-text-routes.ts`
// (note-Berechnung) und `check-text-detection.ts` (ein Signal, dass der Rückfall griff). Beide
// sind in der Lease dieses Durchgangs NICHT enthalten — sie führt ausschließlich `tests/**`.
// Zudem ist die Form des Hinweises eine Owner-Entscheidung: ein zusätzlicher `note`-Text ist
// nicht dasselbe wie ein maschinenlesbares Feld, und welche von beiden Varianten das Add-in
// tragen soll, entscheidet nicht die Bahn.
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { SemanticPrefilter } from "../../services/app/src/duplicate-detection";
import type { Guards } from "../../services/app/src/http";
import { checkTextRoutes } from "../../services/app/src/routes/check-text-routes";
import { InMemoryOverlapRepo, OverlapService, type OverlapVerdict } from "../../services/conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../services/embedding";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { Reasoner } from "../../services/reasoner";

const TEXT_IDENTISCH = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften und prüfen.";
const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

function mkKo(id: string, statement: string): KnowledgeObject {
  return {
    id,
    title: "Pumpe entlüften",
    statement,
    status: "validiert",
    conditions: [],
    measures: [],
    tags: [],
    category: "Wartung",
    asset: null,
  } as unknown as KnowledgeObject;
}

function spyPrefilter(hits: Array<{ id: string }>) {
  const embed = vi.fn(async () => ({ vectors: [[1, 0, 0]], embeddingVersion: "spy@3", dim: 3 }));
  const nearest = vi.fn(async () => hits);
  const prefilter: SemanticPrefilter = {
    embedder: {
      name: "spy",
      embeddingVersion: "spy@3",
      dim: 3,
      isAvailable: () => true,
      embed,
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest, delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
  return { prefilter, embed, nearest };
}

const teilweiseVerdict: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur A",
  nurInB: "nur B",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};

const fakeGuards = {
  requireUser: async () => ({ id: "u1" }),
  requirePermission: async () => ({ id: "u1" }),
} as unknown as Guards;

/**
 * Wie `stage2App` der Nachbardatei, aber der Vektorspeicher ist EINSTELLBAR — genau darin liegt
 * der Unterschied, den diese Datei misst.
 */
async function app2(speicherTreffer: Array<{ id: string }>) {
  const seed = [mkKo("v2", TEXT_MITTEL), mkKo("noise", "völlig anderer inhalt hier")];
  const { prefilter, embed, nearest } = spyPrefilter(speicherTreffer);
  const findCandidates = vi.fn(async () => seed);
  const ko = {
    list: vi.fn(async () => seed),
    findCandidates,
    get: vi.fn(async (id: string) => seed.find((k) => k.id === id)),
  } as unknown as KoService;
  const judgeDuplicate = vi.fn(async () => teilweiseVerdict);
  const app = Fastify();
  await app.register(
    checkTextRoutes(
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        reasoner: { judgeDuplicate, judgeConflict: vi.fn(async () => null) } as unknown as Reasoner,
        semanticPrefilter: prefilter,
      },
      fakeGuards,
    ),
  );
  const tiefenpruefung = () =>
    app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: {
        text: TEXT_IDENTISCH,
        want: "deep",
        source: "draft",
        confidentiality: "intern",
      },
    });
  return { tiefenpruefung, embed, nearest, findCandidates, judgeDuplicate };
}

// ================================================================================================

describe("W6 · der gebaute Teil von Auflage 1 — Vertraulichkeit wird gemeldet", () => {
  it("vertraulicher Text: kein Egress, und `note` sagt es dem Aufrufer", async () => {
    // Kalibrierung: der Kanal funktioniert. Ohne diesen Fall stuende der Fehlstand unten ohne
    // Vergleich da — man koennte ihn fuer „`note` ist immer null" halten.
    const seed = [mkKo("v2", TEXT_MITTEL)];
    const { prefilter, embed } = spyPrefilter([{ id: "v2" }]);
    const judgeDuplicate = vi.fn(async () => teilweiseVerdict);
    const app = Fastify();
    await app.register(
      checkTextRoutes(
        {
          ko: {
            list: vi.fn(async () => seed),
            findCandidates: vi.fn(async () => seed),
            get: vi.fn(async (id: string) => seed.find((k) => k.id === id)),
          } as unknown as KoService,
          overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
          reasoner: {
            judgeDuplicate,
            judgeConflict: vi.fn(async () => null),
          } as unknown as Reasoner,
          semanticPrefilter: prefilter,
        },
        fakeGuards,
      ),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: {
        text: TEXT_IDENTISCH,
        want: "deep",
        source: "draft",
        confidentiality: "vertraulich",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(embed).not.toHaveBeenCalled();
    expect(judgeDuplicate).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });
});

describe("W6 · DER FEHLSTAND — der leere Vektorspeicher wird NICHT gemeldet", () => {
  it("Speicher befuellt: der semantische Weg traegt, `note` bleibt zu Recht null", async () => {
    const { tiefenpruefung, embed, findCandidates } = await app2([{ id: "v2" }]);
    const res = await tiefenpruefung();

    // Zustand 3: embed lief, kein lexikalischer Rueckfall. Hier IST die Tiefe gedeckt, `note`
    // darf leer sein. Dieser Fall ist der Massstab fuer den naechsten.
    expect(embed).toHaveBeenCalled();
    expect(findCandidates).not.toHaveBeenCalled();
    expect(res.json().note).toBeNull();
  });

  it("Speicher LEER: lexikalischer Rueckfall — und der Aufrufer erfaehrt es nicht", async () => {
    const { tiefenpruefung, embed, nearest, findCandidates } = await app2([]);
    const res = await tiefenpruefung();

    // Der semantische Weg wurde versucht und trug nicht.
    expect(embed).toHaveBeenCalledTimes(1);
    expect(nearest).toHaveBeenCalledTimes(1);
    // Gearbeitet wurde lexikalisch — dieselbe Deckelung wie ohne Prefilter.
    expect(findCandidates).toHaveBeenCalledTimes(1);

    // FEHLSTANDSBELEG, KEINE ZUSAGE: `note` bleibt leer. Die Antwort ist damit von der des
    // vorigen Falls nicht zu unterscheiden, obwohl die Reichweite eine voellig andere war.
    // Wer Auflage 1 baut, macht diese Zeile rot — das ist beabsichtigt und ist dann der Beleg,
    // dass der Mangel behoben wurde.
    expect(res.json().note).toBeNull();
  });

  it("die Antwort fuehrt ueberhaupt kein Feld, das Reichweite ausdrueckt", async () => {
    const voll = (await (await app2([{ id: "v2" }])).tiefenpruefung()).json();
    const leer = (await (await app2([])).tiefenpruefung()).json();

    // Gleiche Schluessel, gleiche Semantik — und keiner davon sagt etwas ueber die Abruftiefe.
    // Das ist der Kern von Auflage 1: nicht „der Hinweis ist falsch", sondern „es gibt kein Feld,
    // an dem ein Add-in die Degradierung ueberhaupt festmachen koennte".
    expect(Object.keys(leer).sort()).toEqual(Object.keys(voll).sort());
    expect(Object.keys(leer).sort()).toEqual([
      "answer",
      "conflicts",
      "duplicates",
      "note",
      "persisted",
    ]);
    expect([voll.note, leer.note]).toEqual([null, null]);

    // NEBENBEFUND, ehrlich eingeordnet: die Trefferlisten sind NICHT gleich — der lexikalische
    // Rueckfall reicht mehr und schlechter vorgefilterte Kandidaten an den Judge weiter.
    expect(leer.duplicates.length).toBeGreaterThan(voll.duplicates.length);
    // Wie VIELE davon in Wahrheit Duplikate waeren, sagt dieser Test NICHT: der Judge ist hier ein
    // Fake, der jeden Kandidaten bejaht. Belegt ist nur, dass der Rueckfall dem Modell mehr Arbeit
    // vorlegt — die Bewertung dieser Kosten braucht einen echten Judge und gehoert nicht hierher.
  });
});
