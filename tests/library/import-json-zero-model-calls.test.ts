// ================================================================================================
// AUFTRAG-mega28 BLOCK D — DIE ENTSCHEIDUNG FESTNAGELN, BEVOR SIE JEMAND VERSEHENTLICH AUFHEBT.
// ================================================================================================
//
// Der gesamte Jahresring (Pedis Kostenentscheidung zum Confluence-Bestand) hängt an EINER Aussage:
// `POST /api/library/import` erzeugt NULL Modellaufrufe. Heute stimmt sie — belegt durch statisches
// Lesen der Kette Route → LibraryService.importJson → KoService.create (mega27; ben hat zusätzlich
// geprüft, ob irgendwo dahinter ein Lauf nachgeholt wird: Re-Enqueue, Validation-Board, Retry-Route,
// Revision — nirgends).
//
// Statisches Lesen verfällt aber. Ein späterer Haken im Create-Weg — ein Prüf-Job, ein Prefilter-
// Index, eine „nur eine kleine Erkennung" — würde die Aussage STILLSCHWEIGEND aufheben, und es
// fiele erst bei einer sehr großen Rechnung auf. Dieser Test kostet wenig und ist genau dort scharf.
//
// SPIONE (alle vier Kanten, an denen ein Modellaufruf entstehen könnte):
//   1. Reasoner  — ein ModelClient, der JEDEN complete()-Aufruf zählt (Konflikt- wie Duplikat-Urteil).
//   2. Embedder  — createEmbeddingProviderFromEnv liefert einen zählenden Wrapper; der Prefilter ist
//                  für diesen Test ausdrücklich EINGESCHALTET, damit er überhaupt feuern KÖNNTE.
//   3. Erkennung — conflicts.detectForSubject / overlaps.detectForSubject, gezählt am Service.
//   4. Warteschlange — der aiCheck-Worker (Spy VOR buildApp gesetzt, dokumentierter Test-Haken).
// Jeder Zähler muss NULL sein. Kein neuer Egress: der Stub-Embedder rechnet lokal, der Spy-Client
// spricht mit niemandem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Embedder-Zähler muss vor der (gehoisteten) Modul-Attrappe existieren.
const embedSpy = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../services/embedding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/embedding")>();
  return {
    ...actual,
    createEmbeddingProviderFromEnv: (env?: Record<string, string | undefined>) => {
      const provider = actual.createEmbeddingProviderFromEnv(env ?? process.env);
      if (!provider) {
        return provider;
      }
      return {
        ...provider,
        embed: async (texts: readonly string[]) => {
          embedSpy.calls += 1;
          return provider.embed(texts);
        },
      };
    },
  };
});

import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { ModelClient } from "../../services/reasoner";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const ENV_KEYS = [
  "KLARWERK_SKIP_KEYCHAIN",
  "KLARWERK_DUP_PREFILTER",
  "KLARWERK_EMBEDDING_PROVIDER",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  // Kein Keychain-Zugriff im Test (deterministisch, kein Egress).
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  // Der Prefilter ist AN — sonst wäre „Embedder 0" trivial wahr, weil es gar keinen gäbe.
  process.env.KLARWERK_DUP_PREFILTER = "1";
  process.env.KLARWERK_EMBEDDING_PROVIDER = "stub";
  embedSpy.calls = 0;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

// ================================================================================================
// JOB 3023 — DIE FUELLZEILEN MUSSTEN ECHT UNTERSCHEIDBAR WERDEN.
// ================================================================================================
//
// Bis HEAD 7cf92ce hiessen die Objekte `Bulk-Objekt <i>` / `Aussage Nummer <i> mit eigenem Inhalt.`
// Sie unterschieden sich in EINER ZIFFER. Das genuegte, solange `importJson` Dubletten ueber
// Zeichengleichheit entschied — seit JOB 3023 entscheidet die Aehnlichkeitspruefung des Produkts
// (`coreText` + `trigramSimilarity`, Schwelle 0,85), und zwei sonst wortgleiche Kurztexte liegen
// darueber (gemessen in `tests/re-import-dubletten/schwelle-kalibrierung.test.ts`, Fall K3).
//
// DIE VORBEDINGUNG DIESES TESTS BLEIBT DAMIT DIESELBE, sie wird nur ehrlich hergestellt: mega29 D3
// verlangt, dass die 25 Objekte WIRKLICH angelegt werden — sonst waeren die Null-Zaehler trivial
// richtig, weil gar nichts geschah. Genau das leisten unterscheidbare Eintraege. Kein Zaehler, kein
// Spion und keine Zusicherung dieses Tests wurde angefasst; ausschliesslich die Fuelldaten.
const BULK_GERAETE = [
  "Kesselspeisepumpe",
  "Rueckschlagklappe",
  "Sicherheitsventil",
  "Waermetauscher",
  "Foerderband",
  "Ruehrwerk",
  "Schraubenkompressor",
  "Bandtrockner",
  "Filterpresse",
  "Dekanterzentrifuge",
  "Schaltschrank",
  "Frequenzumrichter",
  "Getriebemotor",
  "Klauenkupplung",
  "Hydraulikaggregat",
  "Vakuumpumpe",
  "Dosierpumpe",
  "Oelabscheider",
  "Gasbrenner",
  "Rauchgasgeblaese",
  "Kuehlturm",
  "Speisewasserbehaelter",
  "Kondensatpumpe",
  "Druckluftnetz",
  "Gleitringdichtung",
  "Rohrbuendelkuehler",
  "Absperrschieber",
  "Membranventil",
  "Magnetventil",
  "Stellantrieb",
  "Durchflussmesser",
  "Fuellstandsonde",
  "Temperaturfuehler",
  "Drucktransmitter",
  "Analysenschrank",
  "Probenehmer",
  "Bandwaage",
  "Schneckenfoerderer",
  "Becherwerk",
  "Siebmaschine",
  "Walzenbrecher",
  "Kugelmuehle",
  "Statikmischer",
  "Doppelschneckenextruder",
  "Abfuellanlage",
  "Etikettierer",
  "Palettierroboter",
  "Tauchpumpe",
  "Notstromaggregat",
  "Gaswarnmelder",
] as const;

const BULK_ARBEITEN = [
  "entkalken",
  "abschmieren",
  "kalibrieren",
  "ausrichten",
  "entlueften",
  "spuelen",
  "nachziehen",
  "tauschen",
  "abgleichen",
  "freibrennen",
] as const;

/**
 * `versatz` waehlt einen DISJUNKTEN Ausschnitt aus dem Geraetevorrat. Die zweite Welle nutzt darum
 * andere Gegenstaende als die erste — sonst waere sie die Dublette der ersten, und die
 * Vorbedingung „auch in einen gefuellten Bestand hinein 25 Objekte" waere nicht herstellbar.
 */
function importItems(n: number, versatz = 0) {
  return Array.from({ length: n }, (_, i) => {
    const geraet = BULK_GERAETE[(versatz + i) % BULK_GERAETE.length];
    const arbeit = BULK_ARBEITEN[(versatz + i) % BULK_ARBEITEN.length];
    return {
      title: `${geraet} ${arbeit}`,
      statement: `${geraet} ${arbeit}, Befund vermerken.`,
      type: "best_practice" as const,
      category: "Betrieb",
      confidentiality: "intern" as const,
    };
  });
}

async function setup() {
  const services = buildServices();

  // 1. Reasoner-Spion: zählt JEDEN echten Modellaufruf (Konflikt- wie Duplikat-Urteil).
  const model = { calls: 0 };
  const client = {
    name: "spy",
    complete: async () => {
      model.calls += 1;
      return '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
    },
  } as unknown as ModelClient;
  services.reasoner = new Reasoner(new ModelProvider(client));

  // 3. Erkennungs-Spione: die beiden Einstiege, über die JEDE automatische Prüfung läuft.
  const detection = { conflicts: 0, overlaps: 0 };
  const realConflictDetect = services.conflicts.detectForSubject.bind(services.conflicts);
  services.conflicts.detectForSubject = async (...args) => {
    detection.conflicts += 1;
    return realConflictDetect(...args);
  };
  const realOverlapDetect = services.overlaps.detectForSubject.bind(services.overlaps);
  services.overlaps.detectForSubject = async (...args) => {
    detection.overlaps += 1;
    return realOverlapDetect(...args);
  };

  // 4. Warteschlangen-Spion: der dokumentierte Test-Haken (services.aiCheckWorker VOR buildApp).
  const queue = { enqueued: 0 };
  const worker: AiCheckWorker = {
    enqueue: () => {
      queue.enqueued += 1;
    },
    has: () => false,
    queuedCount: () => 0,
    idle: () => Promise.resolve(),
  };
  services.aiCheckWorker = worker;

  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers, model, detection, queue, services };
}

describe("mega28 D: POST /api/library/import erzeugt NULL Modellaufrufe", () => {
  it("Bulk-Import von 25 Objekten: Reasoner, Embedder, Erkennung und Warteschlange bleiben bei null", async () => {
    const { app, headers, model, detection, queue } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: importItems(25) },
    });

    // Der Import hat wirklich stattgefunden — sonst wären die Nullen wertlos.
    expect(res.statusCode).toBe(200);
    // JOB 3023: `uebersprungen` ist additiv hinzugekommen. Die leere Liste wird hier MITGEPRUEFT —
    // sie ist die zweite, unabhaengige Aussage derselben Vorbedingung: nichts wurde zurueckgehalten.
    expect(res.json()).toEqual({ imported: 25, skipped: 0, uebersprungen: [] });

    // … und er hat NICHTS Teures angefasst.
    expect(model.calls).toBe(0);
    expect(embedSpy.calls).toBe(0);
    expect(detection.conflicts).toBe(0);
    expect(detection.overlaps).toBe(0);
    expect(queue.enqueued).toBe(0);
  });

  it("auch ein ZWEITER Import in einen bereits gefüllten Bestand bleibt bei null (kein nachgeholter Lauf)", async () => {
    const { app, headers, model, detection, queue } = await setup();

    await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: importItems(25) },
    });
    // Der Bestand steht jetzt. Genau hier würde ein „nachgeholter" Lauf n−1 Urteile je Objekt kosten.
    const second = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      // JOB 3023: bis hierher trug die zweite Welle nur einen anderen TITEL bei gleicher Aussage.
      // Gegen die Aehnlichkeitspruefung ist das die Dublette der ersten Welle — die Vorbedingung
      // von mega29 D3 waere nicht mehr herstellbar. Sie nutzt darum jetzt den disjunkten zweiten
      // Ausschnitt des Geraetevorrats: 25 andere Gegenstaende, 25 andere Aussagen.
      payload: { items: importItems(25, 25) },
    });

    expect(second.statusCode).toBe(200);
    // AUFTRAG-mega29 D3 (bens M28-4): der Lauf pinnt seine eigene VORBEDINGUNG. Ohne diese Zeile
    // hing die Aussage „auch in einen gefüllten Bestand hinein null Aufrufe" an geänderten Titeln:
    // wären die 25 Objekte als Duplikate abgewiesen worden, wäre die Null trivial richtig gewesen,
    // weil gar nichts angelegt wurde.
    expect(second.json()).toEqual({ imported: 25, skipped: 0, uebersprungen: [] });
    expect(model.calls).toBe(0);
    expect(embedSpy.calls).toBe(0);
    expect(detection.conflicts).toBe(0);
    expect(detection.overlaps).toBe(0);
    expect(queue.enqueued).toBe(0);
  });

  it("Gegenprobe: derselbe Spy-Aufbau ZÄHLT, wenn ein Objekt regulär eingereicht wird", async () => {
    // Ohne diese Probe wäre „alles null" auch dann grün, wenn die Spione gar nicht verdrahtet wären.
    const { services, model, detection } = await setup();
    const a = await services.ko.create({
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    await services.ko.create({
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    const { createAiCheckRunner } = await import("../../services/app/src/ai-check-worker");
    const run = createAiCheckRunner({
      ko: services.ko,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      overlapSettings: services.overlapSettings,
      reasoner: services.reasoner,
    });
    await run(a.id);

    expect(detection.conflicts).toBeGreaterThan(0);
    expect(detection.overlaps).toBeGreaterThan(0);
    expect(model.calls).toBeGreaterThan(0);
  });

  // ==============================================================================================
  // AUFTRAG-mega29 BLOCK D (bens M28-4) — ZWEI ZÄHLER WAREN NICHT KALIBRIERT.
  // ==============================================================================================
  //
  // Die Gegenprobe oben ruft den AI-Runner DIREKT auf. Damit beweist sie Reasoner-, Konflikt- und
  // Duplikatzähler — aber sie UMGEHT die Warteschlange, und sie baut den Runner ohne semantischen
  // Vorfilter. `queue.enqueued` und `embedSpy.calls` blieben also null, ohne dass irgendetwas
  // gezeigt hätte, dass diese beiden Spione überhaupt verdrahtet sind. Ein falsch verdrahteter
  // Nullzähler ist schlechter als keiner: er täuscht Sicherheit vor.
  //
  // Beide Positivproben laufen deshalb über eine REGULÄRE HTTP-Einreichung (POST /api/kos) —
  // denselben Weg, den ein Mensch nimmt, durch dieselbe App, mit denselben Spionen wie der
  // Bulk-Lauf. Kein neuer Egress: der Stub-Embedder rechnet lokal, der Spy-Client spricht mit
  // niemandem.
  it("Kalibrierung Warteschlange: eine reguläre Einreichung über HTTP reiht nachweislich EIN", async () => {
    const { app, headers, queue } = await setup();

    // Vorher ist der Zähler null — sonst bewiese das „danach > 0" nichts über DIESE Einreichung.
    expect(queue.enqueued).toBe(0);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Pumpe P2 Druckverlust",
        statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "intern",
      },
    });

    expect(res.statusCode).toBe(201);
    // DERSELBE Spion, der im Bulk-Pfad null bleibt, zählt hier. Damit ist seine Null dort eine
    // Aussage über den Bulk-Import und nicht über einen toten Spion.
    expect(queue.enqueued).toBeGreaterThan(0);
    await app.close();
  });

  it("Kalibrierung Embedder: dieselbe reguläre Einreichung löst die Prefilter-Indizierung aus", async () => {
    const { app, headers } = await setup();

    expect(embedSpy.calls).toBe(0);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Dichtungswechsel Linie 4",
        statement: "Dichtung vor jedem Anlauf pruefen und bei Bedarf tauschen.",
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
      },
    });

    expect(res.statusCode).toBe(201);
    // Der Einreiche-Pfad bettet das frische KO NACH der Antwort in den Vektor-Store ein
    // (indexKoForDuplicatePrefilter) — genau die Kante, an der embedSpy zählt. Der Bulk-Import
    // tut das nicht, und erst diese Probe macht seine Null zu einer belastbaren Aussage.
    expect(embedSpy.calls).toBeGreaterThan(0);
    await app.close();
  });
});
