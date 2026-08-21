// ================================================================================================
// JOB 1531 · D2 (M-5, Anker S2) — „KLEP" FINDET „VENTIL" UEBER DEN ECHTEN ADAPTERWEG.
// ================================================================================================
//
// D1 hat die deklarierte Zuordnung gebaut und einzeln geprueft. **Sie war wirkungslos**, weil
// niemand sie aufrief — der Chef am 21.08. um 16:42: „S2 braucht einen Folgeauftrag, der die
// beiden Adapter die neue Synonymzuordnung AUFRUFEN laesst."
//
// Diese Datei prueft genau den Unterschied: **nicht die Funktion, sondern den Weg.**
//
// WARUM DAS EINE ANDERE AUSSAGE IST ALS `s2-synonyme.test.ts`:
// Jener Test ruft `expandSearchTerms` direkt auf. Er bliebe gruen, wenn kein einziger Adapter die
// Funktion aufriefe — genau der Zustand vor diesem Durchgang. **Hier faellt der Kernfall rot,
// sobald der Aufruf im Adapter fehlt**; die Gegenmutation in der Rueckgabe belegt es.
//
// DER STAPEL IST DER ECHTE, keine Abkuerzung: `activateSearchProjectionV2()` faehrt die
// vorgeschriebene Folge UNINITIALIZED → V2_BUILDING → V2_READY → V2_ACTIVE ueber den Produktweg,
// samt der fuenf Freigabepruefungen. Dasselbe Vorgehen wie `tests/app/a30-suchraum-grenze.test.ts:68-79`.
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";

type Stapel = Awaited<ReturnType<typeof stapel>>;

async function stapel() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, ko };
}

/**
 * Der sichtbare Text traegt das deutsche Wort — nie das niederlaendische.
 *
 * Feldmenge nach dem Hausmuster (`services/knowledge-object/src/asset.test.ts:25-34`); `category`
 * ist Pflicht, sonst uebersetzt `CreateKoInput` nicht (gemessen: `error TS2345`).
 */
const EINGABE: CreateKoInput = {
  title: "Wartung der Anlage",
  statement: "Das Ventil wird jaehrlich geprueft.",
  type: "best_practice",
  category: "Anlage 1",
  author: "anna",
};

let s: Stapel;
let koId: string;

beforeEach(async () => {
  s = await stapel();
  const angelegt = await s.ko.create(EINGABE);
  koId = angelegt.id;
});

/** Die Kennungen der Treffer einer Suche ueber den echten Adapterweg. */
async function suche(...terms: string[]): Promise<string[]> {
  const treffer = await s.projections.findActive({ terms });
  return treffer.map((t) => t.koId);
}

describe("S2 · A — der Adapterweg ruft die Zuordnung auf", () => {
  it('A1 · KERNFALL: die Suche nach „klep" findet das Objekt mit „Ventil"', async () => {
    // Der Fall, der dem Anker den Namen gibt — und der ohne den Adapteraufruf rot faellt.
    expect(await suche("klep")).toContain(koId);
  });

  it('A2 · die Gegenrichtung ebenso: „ventil" findet es weiterhin', async () => {
    // Die Zuordnung darf den geraden Weg nicht verstellen.
    expect(await suche("ventil")).toContain(koId);
  });

  it("A3 · ein Wort ohne Zuordnung findet es nicht", async () => {
    // Ohne diesen Fall koennte A1 auch dann gruen sein, wenn der Adapter alles fiende.
    expect(await suche("dichtung")).not.toContain(koId);
  });

  it("A4 · die Ergaenzung ersetzt die Bereinigung nicht", async () => {
    // `normalizeSearchTerms` bleibt davor. Wer sie ERSETZT statt sie zu ergaenzen, verliert die
    // Kleinschreibung — und „  KLEP  " faende nichts mehr.
    expect(await suche("  KLEP  ")).toContain(koId);
  });

  it("A5 · eine leere Anfrage bleibt leer", async () => {
    // Die Leermengenentscheidung steht HINTER dem Aufruf; `expandSearchTerms([])` ist `[]`.
    expect(await suche()).toEqual([]);
    expect(await suche("   ")).toEqual([]);
  });

  it("A6 · der Treffer nennt das Feld, in dem das Wort steht", async () => {
    // Belegt, dass wirklich der Suchweg gelaufen ist und nicht bloss eine Liste zurueckkam.
    const treffer = await s.projections.findActive({ terms: ["klep"] });
    const ventil = treffer.find((t) => t.koId === koId);
    expect(ventil?.matched.statement).toBe(true);
  });

  it("A7 · der zweite deklarierte Fall geht denselben Weg", async () => {
    // Nicht nur das namensgebende Paar: die Zuordnung wirkt fuer jeden belegten Eintrag.
    const zweites = await s.ko.create({
      ...EINGABE,
      title: "Abwesenheiten",
      statement: "Die Urlaubszeiten stehen im Handbuch.",
    });
    expect(await suche("urlaubsregelung")).toContain(zweites.id);
  });
});
