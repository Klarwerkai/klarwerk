// ==================================================================================================
// R-1101 — DIE SUCHGÜTE WIRD BEI JEDEM TORLAUF GEGEN EINE FESTE GRUNDLINIE GEMESSEN.
// ==================================================================================================
//
// DER ANLASS (Auftrag „Suchqualität wiederholbar gegen schleichende Verschlechterung prüfen“): ein
// wiederkehrender Lauf soll zeigen, ob die Trefferqualität der Suche über die Zeit abrutscht —
// bevor Kunden es merken. Im Bestand gab es dafür kein Testset: `tests/ask/reasoner-eval.ts` prüft
// Quellenbindung und Halluzinationsschutz, die übrigen Suchtests prüfen je eine Regel. Keiner
// rechnet eine GESAMTZAHL über einen festen Fragenkatalog, an der ein Rückgang sichtbar würde.
//
// WAS HIER GEMESSEN WIRD, am ECHTEN Produktweg (echter `KoService` mit In-Memory-Ablagen, echter
// `AskService`, echter deterministischer `Reasoner`, echte `LibraryService.search`):
//   klara.trefferAn1             Anteil der Trefferfragen, deren tragende Quelle die richtige ist
//   klara.stoererfrei            Anteil der Fragen ohne Antwort im Bestand, die ehrlich leer bleiben
//   klara.offeneGrenzen          Zahl der benannten Produktgrenzen, die heute noch nicht tragen
//   bibliothek.vollstaendigkeit  Anteil der Sollobjekte, die die Bibliothekssuche liefert
//   bibliothek.reinheit          Anteil der gelieferten Objekte, die zur Sollmenge gehören
//
// WIEDERKEHREND: die Datei liegt unter `tests/**` und wird damit von `vitest.config.ts`
// (`BESTAND_INCLUDE`) in JEDEM Torlauf mitgefahren — kein eigener Zeitplan, kein eigener Dienst.
//
// WARUM TOLERANZ NULL UND WARUM EINE FESTE GRUNDLINIE: der Suchweg ist deterministisch, es gibt kein
// Rauschen, das eine Toleranz auffangen müsste. Jede Abweichung ist eine Codeänderung. Und die
// Grundlinie gleitet NICHT mit dem letzten Lauf mit: viele kleine, einzeln „noch tolerierbare“
// Schritte ergäben genau den schleichenden Verfall, den dieser Wächter sichtbar machen soll.
// Verbesserungen werden ebenfalls gemeldet — sonst fiele ein späterer Rückfall auf den alten Stand
// nicht mehr auf.
//
// WAS ER AUSDRÜCKLICH NICHT MISST: Güte im Betrieb an echten Kundendaten, den PostgreSQL-Adapter
// (dessen Gleichlauf mit dem Speicher-Adapter haben `tests/suchraum-deckel/deckel-paritaet-pg.test.ts`
// und die Integrationstests), den Modellweg und eine zeitliche Reihe über Läufe hinweg — die Reihe
// ist die Torhistorie selbst, eine eigene Ablage gibt es nicht.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import { LibraryService } from "../../services/library-analytics/src/service";
import { Reasoner } from "../../services/reasoner";
import { BIBLIOTHEKS_FAELLE, KLARA_FAELLE, KORPUS } from "./pruefset";

const KENNZAHLEN = [
  "klara.trefferAn1",
  "klara.stoererfrei",
  "klara.offeneGrenzen",
  "bibliothek.vollstaendigkeit",
  "bibliothek.reinheit",
] as const;
type Kennzahl = (typeof KENNZAHLEN)[number];

interface Fallzahlen {
  klara: number;
  bibliothek: number;
}

interface Grundlinie {
  faelle: Fallzahlen;
  werte: Record<Kennzahl, number>;
}

interface Messung {
  faelle: Fallzahlen;
  werte: Record<Kennzahl, number>;
  /** Je Fall, der vom Sollbild abweicht, eine Zeile — beginnend mit dem Fallnamen. */
  abweichungen: string[];
}

// Vitest läuft mit der Repo-Wurzel als Arbeitsverzeichnis (`vitest.config.ts`).
const GRUNDLINIE_PFAD = join(process.cwd(), "tests/suchguete-drift/grundlinie.json");
const GRUNDLINIE: Grundlinie = JSON.parse(readFileSync(GRUNDLINIE_PFAD, "utf8"));

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Pruefset",
  author: "anna",
};

interface Bestand {
  ko: KoService;
  /** Prüfset-Schlüssel → Produkt-Kennung. */
  kennung: ReadonlyMap<string, string>;
}

// Der Stapel ist der echte (Muster: tests/suchraum-deckel/deckel-waehlt-nach-treffergute.test.ts).
async function bestand(): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const kennung = new Map<string, string>();
  for (const objekt of KORPUS) {
    const angelegt = await ko.create({
      ...VORLAGE,
      title: objekt.title,
      statement: objekt.statement,
      ...(objekt.bodyHtml ? { bodyHtml: objekt.bodyHtml } : {}),
    });
    await ko.setValidationState(angelegt.id, { trust: 80, status: "validiert" });
    kennung.set(objekt.schluessel, angelegt.id);
  }
  return { ko, kennung };
}

function quote(zaehler: number, nenner: number): number {
  return nenner === 0 ? 1 : zaehler / nenner;
}

/** Fährt den ganzen Fragenkatalog über den übergebenen Dienst und rechnet die Kennzahlen. */
async function messen(ko: KoService, kennung: ReadonlyMap<string, string>): Promise<Messung> {
  const idVon = (schluessel: string): string => {
    const id = kennung.get(schluessel);
    if (!id) {
      throw new Error(`Prüfset-Schlüssel ohne Objekt im Korpus: ${schluessel}`);
    }
    return id;
  };
  const schluesselVon = new Map<string, string>();
  for (const [schluessel, id] of kennung) {
    schluesselVon.set(id, schluessel);
  }
  const lesbar = (id: string): string => schluesselVon.get(id) ?? id;

  const ask = new AskService({
    reasoner: new Reasoner(),
    koService: ko,
    gaps: new InMemoryGapRepo(),
  });
  const bibliothek = new LibraryService({ koService: ko });
  const abweichungen: string[] = [];

  let trefferFaelle = 0;
  let treffer = 0;
  let lueckenFaelle = 0;
  let stoererfrei = 0;
  let offeneGrenzen = 0;
  for (const fall of KLARA_FAELLE) {
    const out = await ask.ask(fall.frage, "nutzer-1", "de", { retrievalOnly: true });
    // Klara meldet genau EINE tragende Quelle (`DeterministicProvider.answer`: `sources: [best.id]`).
    const quelle = out.result.answered ? out.result.sources[0] : undefined;
    const bekam = quelle === undefined ? "keine Antwort" : lesbar(quelle);
    if (fall.art === "treffer") {
      trefferFaelle += 1;
      if (quelle === idVon(fall.erwartet)) {
        treffer += 1;
      } else {
        abweichungen.push(`${fall.name}: erwartet ${fall.erwartet}, bekam ${bekam}`);
      }
    } else if (fall.art === "luecke") {
      lueckenFaelle += 1;
      if (quelle === undefined) {
        stoererfrei += 1;
      } else {
        abweichungen.push(`${fall.name}: erwartet keine Antwort, bekam ${bekam}`);
      }
    } else if (quelle === undefined) {
      offeneGrenzen += 1;
    } else {
      const verbessert = quelle === idVon(fall.erwartet);
      const art = verbessert ? "VERBESSERUNG, Sollbild bewusst nachziehen" : "falsche Quelle";
      const zeile = `${fall.name}: bekannte Grenze trägt jetzt — bekam ${bekam} (${art})`;
      abweichungen.push(zeile);
    }
  }

  let erwartet = 0;
  let geliefert = 0;
  let richtig = 0;
  for (const fall of BIBLIOTHEKS_FAELLE) {
    const ids = (await bibliothek.search(fall.suche)).map((k) => k.id);
    const soll = new Set(fall.erwartet.map(idVon));
    const passend = ids.filter((id) => soll.has(id));
    erwartet += soll.size;
    geliefert += ids.length;
    richtig += passend.length;
    const fehlt = fall.erwartet.filter((schluessel) => !ids.includes(idVon(schluessel)));
    const zuviel = ids.filter((id) => !soll.has(id)).map(lesbar);
    if (fehlt.length > 0 || zuviel.length > 0) {
      const zeile = `${fall.name}: fehlt [${fehlt.join(", ")}], zu viel [${zuviel.join(", ")}]`;
      abweichungen.push(zeile);
    }
  }

  return {
    faelle: { klara: KLARA_FAELLE.length, bibliothek: BIBLIOTHEKS_FAELLE.length },
    werte: {
      "klara.trefferAn1": quote(treffer, trefferFaelle),
      "klara.stoererfrei": quote(stoererfrei, lueckenFaelle),
      "klara.offeneGrenzen": offeneGrenzen,
      "bibliothek.vollstaendigkeit": quote(richtig, erwartet),
      "bibliothek.reinheit": quote(richtig, geliefert),
    },
    abweichungen,
  };
}

/** Der Vergleich gegen die Grundlinie — jede Abweichung, in beide Richtungen, ist ein Befund. */
function befundeGegen(grundlinie: Grundlinie, messung: Messung): string[] {
  const befunde: string[] = [];
  for (const art of ["klara", "bibliothek"] as const) {
    if (messung.faelle[art] !== grundlinie.faelle[art]) {
      const zeile = `Fallzahl ${art}: Grundlinie ${grundlinie.faelle[art]}, Prüfset ${messung.faelle[art]} — ein veränderter Katalog ist eine andere Messung`;
      befunde.push(zeile);
    }
  }
  for (const kennzahl of KENNZAHLEN) {
    const soll = grundlinie.werte[kennzahl];
    const ist = messung.werte[kennzahl];
    if (ist === soll) {
      continue;
    }
    // Bei den offenen Grenzen ist WENIGER besser, bei allen Anteilen MEHR.
    const besser = kennzahl === "klara.offeneGrenzen" ? ist < soll : ist > soll;
    const richtung = besser ? "VERBESSERUNG, Grundlinie bewusst nachziehen" : "VERSCHLECHTERUNG";
    const zeile = `${kennzahl}: Grundlinie ${soll}, gemessen ${Number(ist.toFixed(3))} — ${richtung}`;
    befunde.push(zeile);
  }
  return befunde;
}

/**
 * Derselbe Dienst, aber mit ersetzten Suchmethoden — für die Kalibrierung. Alles andere wird an
 * den echten Dienst gebunden durchgereicht; interne Aufrufe des Dienstes laufen damit an der
 * Hülle vorbei und bleiben unverändert.
 */
function umgeleitet(
  dienst: KoService,
  ersatz: Partial<Pick<KoService, "findSearchHits" | "findCandidates">>,
): KoService {
  return new Proxy(dienst, {
    get(ziel, name) {
      const eigen = (ersatz as Record<string | symbol, unknown>)[name];
      if (typeof eigen === "function") {
        return eigen;
      }
      const wert = Reflect.get(ziel, name, ziel);
      if (typeof wert !== "function") {
        return wert;
      }
      return (wert as (...a: unknown[]) => unknown).bind(ziel);
    },
  });
}

let b: Bestand;

beforeAll(async () => {
  b = await bestand();
});

describe("R-1101 · die Suchgüte gegen die feste Grundlinie", () => {
  it("G1 · Prüfset und Grundlinie passen zusammen — kein still geschrumpfter Katalog", () => {
    expect(Object.keys(GRUNDLINIE.werte).sort()).toEqual([...KENNZAHLEN].sort());
    expect(GRUNDLINIE.faelle).toEqual({
      klara: KLARA_FAELLE.length,
      bibliothek: BIBLIOTHEKS_FAELLE.length,
    });

    // Jede Erwartung zeigt auf ein Objekt, das es im Korpus gibt — sonst misst der Fall nichts.
    const schluessel = new Set(KORPUS.map((k) => k.schluessel));
    const verwiesen = [
      ...KLARA_FAELLE.flatMap((f) => (f.art === "luecke" ? [] : [f.erwartet])),
      ...BIBLIOTHEKS_FAELLE.flatMap((f) => f.erwartet),
    ];
    expect(verwiesen.filter((s) => !schluessel.has(s))).toEqual([]);

    // Alle drei Klara-Arten sind vertreten — ohne Lückenfälle wäre `stoererfrei` still 1.
    const arten = new Set(KLARA_FAELLE.map((f) => f.art));
    expect([...arten].sort()).toEqual(["grenze", "luecke", "treffer"]);
  });

  it("G2 · der heutige Produktweg erreicht die Grundlinie — Fall für Fall", async () => {
    const messung = await messen(b.ko, b.kennung);
    expect(messung.abweichungen, "Fälle, die vom Sollbild abweichen").toEqual([]);
    expect(befundeGegen(GRUNDLINIE, messung), "Kennzahlen gegen grundlinie.json").toEqual([]);
  });
});

describe("R-1101 · Kalibrierung: der Wächter sieht einen Rückgang wirklich", () => {
  it("C1 · fällt EIN Objekt still aus dem Suchweg, wird es rot", async () => {
    // Die Lage aus dem Anlass im Kleinen: nichts bricht, nur EIN Treffer fehlt plötzlich.
    const ohne = b.kennung.get("PRESSE") ?? "";
    expect(ohne).not.toBe("");
    const verschlechtert = umgeleitet(b.ko, {
      findSearchHits: async (query, trim) => {
        const hits = await b.ko.findSearchHits(query, trim);
        return hits.filter((hit) => hit.koId !== ohne);
      },
      findCandidates: async (query) => {
        const objekte = await b.ko.findCandidates(query);
        return objekte.filter((objekt) => objekt.id !== ohne);
      },
    });

    const messung = await messen(verschlechtert, b.kennung);
    // Genau die zwei Fälle, die an diesem Objekt hängen — nicht mehr und nicht weniger.
    expect(messung.abweichungen.map((zeile) => zeile.split(":")[0])).toEqual([
      "K-T6 Spezialpresse",
      "B-1 Titelwort",
    ]);
    const befunde = befundeGegen(GRUNDLINIE, messung);
    expect(befunde).toHaveLength(2);
    const klara = befunde.find((z) => z.startsWith("klara.trefferAn1:"));
    const bibliothek = befunde.find((z) => z.startsWith("bibliothek.vollstaendigkeit:"));
    expect(klara).toContain("VERSCHLECHTERUNG");
    expect(bibliothek).toContain("VERSCHLECHTERUNG");
  });

  it("C2 · liefert die Bibliothek zu breit, fällt die Reinheit — und nur sie", async () => {
    // Eine Suche, die jeden Begriff durch „e“ ersetzt, trifft den ganzen Korpus: alle Sollobjekte
    // sind dabei (Vollständigkeit bleibt), aber die Liste ist voller Fremdtreffer.
    const zuBreit = umgeleitet(b.ko, {
      findSearchHits: (query, trim) => b.ko.findSearchHits({ ...query, terms: ["e"] }, trim),
    });

    const messung = await messen(zuBreit, b.kennung);
    expect(messung.werte["bibliothek.vollstaendigkeit"]).toBe(1);
    expect(messung.werte["bibliothek.reinheit"]).toBeLessThan(1);
    const befunde = befundeGegen(GRUNDLINIE, messung);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toMatch(/^bibliothek\.reinheit: .*VERSCHLECHTERUNG$/);
  });

  it("C3 · eine Verbesserung wird gemeldet, nicht verschluckt", () => {
    // Trüge eine bekannte Grenze plötzlich, muss die Grundlinie nachgezogen werden — sonst fiele
    // ein späterer Rückfall auf den heutigen Stand nicht mehr auf.
    const grenzen = GRUNDLINIE.werte["klara.offeneGrenzen"];
    const besser: Messung = {
      faelle: GRUNDLINIE.faelle,
      werte: { ...GRUNDLINIE.werte, "klara.offeneGrenzen": grenzen - 1 },
      abweichungen: [],
    };
    const erwartet = `klara.offeneGrenzen: Grundlinie ${grenzen}, gemessen ${grenzen - 1} — VERBESSERUNG, Grundlinie bewusst nachziehen`;
    expect(befundeGegen(GRUNDLINIE, besser)).toEqual([erwartet]);
    // Und die Gegenrichtung derselben Kennzahl ist eine Verschlechterung.
    const schlechter: Messung = {
      ...besser,
      werte: { ...GRUNDLINIE.werte, "klara.offeneGrenzen": grenzen + 1 },
    };
    expect(befundeGegen(GRUNDLINIE, schlechter)[0]).toContain("VERSCHLECHTERUNG");
  });
});
