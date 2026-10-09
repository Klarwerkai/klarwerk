// ================================================================================================
// aufnahme:20260922:confluence-import-hierarchie — VERSCHACHTELTE TESTSEITEN STATT FLACHER LISTE
// ================================================================================================
//
// HERKUNFT: R-0153 (Unterseiten samt Eltern-Kind-Struktur übernehmen, keine flache Liste), R-1126 /
// R-1172 / R-1800 E6 (die bisherigen Confluence-Testseiten waren flach und haben den Import
// verschachtelter Strukturen nie geprüft).
//
// BESTAND VOR DIESER DATEI: `adapter.test.ts` arbeitet mit zwei Seiten ohne Elternkette. Die
// Ahnenlogik selbst ist im Mapper (`confluenceSourcePath`, `confluenceAncestorIds`) und im Adapter
// (`hierarchieBefund`) gebaut und dort einzeln geprüft — aber nie an einem ganzen, verschachtelten
// Space, der durch den echten REST-Client, die Cursor-Pagination und den Import-Kern läuft.
//
// DER TESTRAUM: ein Space „K" mit einer Startseite, drei Untergruppen (Produktion, IT-Betrieb,
// Verwaltung), darunter weitere Untergruppen bis Tiefe 4. Die Antwortform ist die der Confluence-
// REST-API (`ancestors`: Wurzel zuerst, ohne die Seite selbst). Geliefert wird über ZWEI
// Cursor-Seiten und NICHT in Baumreihenfolge — Kinder kommen vor ihren Eltern an, wie es die
// Content-API je nach Sortierung tut.
//
// GRENZE: das ist ein Fixture der API-Antwort, kein echter Confluence-Space. Ob angelegte Seiten in
// einer realen Instanz genau so geliefert werden, misst diese Datei nicht.

import { describe, expect, it } from "vitest";
import { adapterFromConfig } from "../../../tests/support/confluence-adapter";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { LibraryService, toPreviewEntry } from "../../library-analytics";
import { hierarchieBefund } from "./adapter";
import type { ConfluencePage } from "./rest-client";

type Ahne = { id: string; title: string };

const START: Ahne = { id: "1", title: "Betriebshandbuch" };
const PRODUKTION: Ahne = { id: "10", title: "Produktion" };
const HALLE7: Ahne = { id: "11", title: "Halle 7" };
const SICHERHEIT7: Ahne = { id: "12", title: "Arbeitssicherheit Halle 7" };
const HALLE9: Ahne = { id: "16", title: "Halle 9" };
const IT: Ahne = { id: "20", title: "IT-Betrieb" };
const SICHERUNG: Ahne = { id: "21", title: "Datensicherung" };
const VERWALTUNG: Ahne = { id: "30", title: "Verwaltung" };

function seite(id: string, title: string, ancestors: Ahne[], restricted = false): ConfluencePage {
  return {
    id,
    title,
    body: { storage: { value: `<p>Inhalt der Seite ${title}.</p>` } },
    version: { number: 1, when: "2026-09-30T08:00:00.000Z" },
    _links: { webui: `/spaces/K/pages/${id}` },
    ...(ancestors.length > 0 ? { ancestors: ancestors.map((a) => ({ ...a })) } : {}),
    ...(restricted
      ? { restrictions: { read: { restrictions: { group: { results: [{}] } } } } }
      : {}),
  };
}

// Die 15 Seiten des Testraums, geordnet wie sie die API liefert (nicht wie der Baum).
const CURSOR_1: ConfluencePage[] = [
  seite("13", "Notausgänge", [START, PRODUKTION, HALLE7, SICHERHEIT7]),
  seite("22", "Rücksicherung testen", [START, IT, SICHERUNG]),
  seite("10", "Produktion", [START]),
  seite("14", "Gefahrstoffe", [START, PRODUKTION, HALLE7, SICHERHEIT7], true),
  seite("31", "Reisekosten", [START, VERWALTUNG]),
  seite("1", "Betriebshandbuch", []),
  seite("17", "Sicherheit Halle 9", [START, PRODUKTION, HALLE9]),
  seite("11", "Halle 7", [START, PRODUKTION]),
];
const CURSOR_2: ConfluencePage[] = [
  seite("23", "Netzzugang", [START, IT]),
  seite("12", "Arbeitssicherheit Halle 7", [START, PRODUKTION, HALLE7]),
  seite("20", "IT-Betrieb", [START]),
  seite("15", "Schichtübergabe", [START, PRODUKTION, HALLE7]),
  seite("16", "Halle 9", [START, PRODUKTION]),
  seite("21", "Datensicherung", [START, IT]),
  seite("30", "Verwaltung", [START]),
];
const ALLE = [...CURSOR_1, ...CURSOR_2];

// Erwartete Elternketten (Titel, Wurzel zuerst) — wörtlich ausgeschrieben, NICHT aus dem Fixture
// abgeleitet, damit der Test nicht seine eigene Konstruktion nachrechnet.
const ERWARTETER_PFAD: Record<string, string[] | undefined> = {
  "1": undefined,
  "10": ["Betriebshandbuch"],
  "11": ["Betriebshandbuch", "Produktion"],
  "12": ["Betriebshandbuch", "Produktion", "Halle 7"],
  "13": ["Betriebshandbuch", "Produktion", "Halle 7", "Arbeitssicherheit Halle 7"],
  "14": ["Betriebshandbuch", "Produktion", "Halle 7", "Arbeitssicherheit Halle 7"],
  "15": ["Betriebshandbuch", "Produktion", "Halle 7"],
  "16": ["Betriebshandbuch", "Produktion"],
  "17": ["Betriebshandbuch", "Produktion", "Halle 9"],
  "20": ["Betriebshandbuch"],
  "21": ["Betriebshandbuch", "IT-Betrieb"],
  "22": ["Betriebshandbuch", "IT-Betrieb", "Datensicherung"],
  "23": ["Betriebshandbuch", "IT-Betrieb"],
  "30": ["Betriebshandbuch"],
  "31": ["Betriebshandbuch", "Verwaltung"],
};

/** fetch-Fixture: zwei Cursor-Seiten, merkt sich jede angefragte URL. */
function verschachtelterSpace(cursor1: ConfluencePage[], cursor2: ConfluencePage[]) {
  const urls: string[] = [];
  const fetchFn = (async (input: string) => {
    urls.push(String(input));
    const zweite = String(input).includes("start=8");
    return {
      ok: true,
      status: 200,
      json: async () =>
        zweite
          ? { results: cursor2 }
          : { results: cursor1, _links: { next: "/rest/api/content?spaceKey=K&start=8" } },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, urls };
}

const config = (fetchFn: typeof fetch) => ({
  baseUrl: "https://acme.atlassian.net/wiki",
  email: "svc@acme.example",
  apiToken: "read-only-tok",
  spaceKey: "K",
  fetchFn,
});

describe("Confluence-Import · verschachtelter Testraum mit Untergruppen", () => {
  it("H-1: alle 15 Seiten aus beiden Cursor-Seiten kommen an; jede Anfrage verlangt die Elternkette", async () => {
    const { fetchFn, urls } = verschachtelterSpace(CURSOR_1, CURSOR_2);
    const result = await adapterFromConfig(config(fetchFn)).collectAll();

    expect(urls).toHaveLength(2);
    // Die Folge-URL stammt aus dem `next`-Cursor des Fixtures; geprüft wird die ERSTE Anfrage, die
    // der Client selbst baut — sie bestimmt, ob Confluence `ancestors` überhaupt liefert.
    expect(decodeURIComponent(urls[0] ?? "")).toMatch(/expand=[^&]*\bancestors\b/);
    expect(urls[1]).toContain("start=8");
    expect(result.truncated).toBe(false);
    expect(result.failed).toEqual([]);
    expect(result.items.map((i) => i.externalId).sort()).toEqual(
      Object.keys(ERWARTETER_PFAD).sort(),
    );
  });

  it("H-2: jede Unterseite trägt ihre vollständige Elternkette — auch wenn das Kind vor dem Elternteil kommt", async () => {
    const { fetchFn } = verschachtelterSpace(CURSOR_1, CURSOR_2);
    const { items } = await adapterFromConfig(config(fetchFn)).collectAll();
    for (const item of items) {
      expect(item.sourcePath, `Pfad von Seite ${item.externalId}`).toEqual(
        ERWARTETER_PFAD[item.externalId ?? ""],
      );
      expect(item.sourceScope).toBe("K");
    }
    // Die Startseite hat KEINEN Pfad — kein leeres Array, kein erfundener Ordner.
    const start = items.find((i) => i.externalId === "1");
    expect(start && Object.hasOwn(start, "sourcePath")).toBe(false);
  });

  it("H-3: KEINE FLACHE LISTE — Tiefen 0 bis 4 und drei getrennte Untergruppen unter der Startseite", async () => {
    const { fetchFn } = verschachtelterSpace(CURSOR_1, CURSOR_2);
    const { items } = await adapterFromConfig(config(fetchFn)).collectAll();

    const tiefen: Record<number, number> = {};
    for (const item of items) {
      const tiefe = item.sourcePath?.length ?? 0;
      tiefen[tiefe] = (tiefen[tiefe] ?? 0) + 1;
    }
    expect(tiefen).toEqual({ 0: 1, 1: 3, 2: 5, 3: 4, 4: 2 });

    // Die direkten Kinder der Startseite sind genau die drei Untergruppen.
    const ersteEbene = items
      .filter((i) => i.sourcePath?.length === 1)
      .map((i) => i.title)
      .sort();
    expect(ersteEbene).toEqual(["IT-Betrieb", "Produktion", "Verwaltung"]);

    // Geschwister in derselben Untergruppe teilen ihren Pfad; Seiten in verschiedenen
    // Untergruppen nicht.
    const pfadVon = (id: string) => items.find((i) => i.externalId === id)?.sourcePath;
    expect(pfadVon("13")).toEqual(pfadVon("14"));
    expect(pfadVon("15")).not.toEqual(pfadVon("17"));
  });

  it("H-4: der Hierarchie-Befund sieht einen intakten Baum — eine Wurzel, Tiefe 4, keine Mängel", async () => {
    const { fetchFn } = verschachtelterSpace(CURSOR_1, CURSOR_2);
    const { hierarchie } = await adapterFromConfig(config(fetchFn)).collectAll();
    expect(hierarchie).toEqual({
      seiten: 15,
      mitKette: 14,
      wurzeln: 1,
      maximaleTiefe: 4,
      fehlendeId: [],
      zyklus: [],
      doppelteId: [],
      verwaisterElternteil: [],
    });
  });

  it("H-5: KALIBRIERUNG — dieselben Seiten FLACH (wie die alten Testdaten) zeigen keine Struktur", async () => {
    // Ohne diesen Gegenfall wäre nicht belegt, dass H-2 bis H-4 die Verschachtelung messen und nicht
    // nur „irgendwelche Seiten kommen an". Flache Testdaten — der frühere Zustand — ergeben 15
    // Wurzeln, Tiefe 0 und keinen einzigen Pfad.
    const flach = (pages: ConfluencePage[]) => pages.map((p) => seite(p.id, p.title, []));
    expect(hierarchieBefund(flach(ALLE))).toMatchObject({
      wurzeln: 15,
      mitKette: 0,
      maximaleTiefe: 0,
    });

    const { fetchFn } = verschachtelterSpace(flach(CURSOR_1), flach(CURSOR_2));
    const { items } = await adapterFromConfig(config(fetchFn)).collectAll();
    expect(items).toHaveLength(15);
    expect(items.every((i) => i.sourcePath === undefined)).toBe(true);
  });

  it("H-6: die Struktur überlebt den Import-Kern bis in Kandidat und Vorschau", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const { fetchFn } = verschachtelterSpace(CURSOR_1, CURSOR_2);
    const { items } = await adapterFromConfig(config(fetchFn)).collectAll();

    await library.createImportCandidates(items, "importer");
    const kandidaten = await library.listImportCandidates();
    expect(kandidaten).toHaveLength(15);
    for (const kandidat of kandidaten) {
      const id = kandidat.item.externalId ?? "";
      expect(kandidat.item.sourcePath, `Kandidat ${id}`).toEqual(ERWARTETER_PFAD[id]);
      const vorschau = toPreviewEntry(kandidat.item);
      expect(vorschau.sourceScope).toBe("K");
      expect(vorschau.sourcePath, `Vorschau ${id}`).toEqual(ERWARTETER_PFAD[id]);
    }

    // Die Leseeinschränkung bleibt je Seite erhalten, auch tief in einer Untergruppe:
    // „Gefahrstoffe" ist eingeschränkt, ihr Geschwister „Notausgänge" nicht.
    const stufe = (id: string) =>
      kandidaten.find((k) => k.item.externalId === id)?.item.confidentiality;
    expect(stufe("14")).toBe("vertraulich");
    expect(stufe("13")).toBe("intern");
  });

  // ----------------------------------------------------------------------------------------------
  // NACHARBEIT 1 (Befund K1 / service.ts:1650, :1751): H-6 endete VOR dem Annehmen. Die Elternkette
  // blieb am Kandidaten; `acceptToKo`/`buildSource` legten sie nicht ins Wissensobjekt. Die beiden
  // Fälle unten nehmen REGULÄR an (`reviewImportCandidate(…, "accept", …)`), laden die erzeugten
  // Wissensobjekte über den KoService und lesen die Struktur AUSSCHLIESSLICH dort ab — nicht am
  // Kandidaten, nicht an der Vorschau.
  // ----------------------------------------------------------------------------------------------

  // Erwarteter direkter Elternteil je Seite (Seitenanker), wörtlich — nicht aus dem Fixture gerechnet.
  const ERWARTETER_ELTERNTEIL: Record<string, string | undefined> = {
    "1": undefined,
    "10": "1",
    "11": "10",
    "12": "11",
    "13": "12",
    "14": "12",
    "15": "11",
    "16": "10",
    "17": "16",
    "20": "1",
    "21": "20",
    "22": "21",
    "23": "20",
    "30": "1",
    "31": "30",
  };

  /** Alle Kandidaten regulär annehmen und die erzeugten Wissensobjekte frisch laden. */
  async function annehmenUndLaden(pages1: ConfluencePage[], pages2: ConfluencePage[]) {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const { fetchFn } = verschachtelterSpace(pages1, pages2);
    const { items } = await adapterFromConfig(config(fetchFn)).collectAll();
    const kandidaten = await library.createImportCandidates(items, "importer");
    expect(kandidaten).toHaveLength(15);
    for (const kandidat of kandidaten) {
      const ergebnis = await library.reviewImportCandidate(kandidat.id, "accept", "importer");
      expect(ergebnis.koId, `Kandidat ${kandidat.item.externalId} ohne Wissensobjekt`).toBeTruthy();
    }
    // Ab hier nur noch das, was der Bestand liefert.
    const geladen = await koService.list();
    const jeAnker = new Map<string, { titel: string; spaceKey?: string; pfad?: string[] }>();
    for (const ko of geladen) {
      const anker = ko.sources.find((s) => s.provider === "Confluence" && s.externalId);
      if (anker?.externalId) {
        jeAnker.set(anker.externalId, {
          titel: ko.title,
          ...(anker.spaceKey ? { spaceKey: anker.spaceKey } : {}),
          ...(anker.sourcePath ? { pfad: anker.sourcePath } : {}),
        });
      }
    }
    return jeAnker;
  }

  /**
   * Den Elternteil eines Wissensobjekts IM ZIELBESTAND auflösen: das Objekt desselben Space, dessen
   * Titel das letzte Pfadsegment ist und dessen eigener Pfad dem Rest entspricht (Confluence hält
   * Titel je Space eindeutig). `undefined`, wenn das Objekt keinen Pfad trägt.
   */
  function elternteilImBestand(
    bestand: Map<string, { titel: string; spaceKey?: string; pfad?: string[] }>,
    anker: string,
  ): string | undefined {
    const kind = bestand.get(anker);
    const pfad = kind?.pfad;
    if (!kind || !pfad || pfad.length === 0) {
      return undefined;
    }
    const treffer = [...bestand.entries()].filter(
      ([, ko]) =>
        ko.spaceKey === kind.spaceKey &&
        ko.titel === pfad[pfad.length - 1] &&
        JSON.stringify(ko.pfad ?? []) === JSON.stringify(pfad.slice(0, -1)),
    );
    expect(treffer, `Elternteil von ${anker} muss eindeutig im Bestand liegen`).toHaveLength(1);
    return treffer[0]?.[0];
  }

  it("H-7: nach regulärer Annahme tragen die GELADENEN Wissensobjekte den Baum — 1 Wurzel, 3 Untergruppen, getrennte Zweige, Tiefe 4", async () => {
    const bestand = await annehmenUndLaden(CURSOR_1, CURSOR_2);
    expect([...bestand.keys()].sort()).toEqual(Object.keys(ERWARTETER_PFAD).sort());

    // Vollständige Elternkette je Objekt, aus dem Bestand gelesen.
    for (const [anker, ko] of bestand) {
      expect(ko.spaceKey).toBe("K");
      expect(ko.pfad, `Elternkette am Wissensobjekt ${anker}`).toEqual(ERWARTETER_PFAD[anker]);
    }
    // Die Wurzel hat KEIN Feld — kein leeres Array.
    expect(bestand.get("1") && Object.hasOwn(bestand.get("1")!, "pfad")).toBe(false);

    // Zielbeziehungen: jedes Objekt findet seinen Elternteil als anderes Objekt im Bestand.
    for (const anker of bestand.keys()) {
      expect(elternteilImBestand(bestand, anker), `Elternteil von ${anker}`).toBe(
        ERWARTETER_ELTERNTEIL[anker],
      );
    }
    const alle = [...bestand.keys()];
    const wurzeln = alle.filter((a) => elternteilImBestand(bestand, a) === undefined);
    expect(wurzeln).toEqual(["1"]);
    const untergruppen = alle.filter((a) => elternteilImBestand(bestand, a) === "1").sort();
    expect(untergruppen).toEqual(["10", "20", "30"]);
    expect(Math.max(...[...bestand.values()].map((ko) => ko.pfad?.length ?? 0))).toBe(4);

    // Getrennte Zweige: „Notausgänge" (Produktion › Halle 7 › …) und „Rücksicherung testen"
    // (IT-Betrieb › Datensicherung) teilen nur die Wurzel.
    const kette = (anker: string): string[] => {
      const out: string[] = [];
      for (let a = elternteilImBestand(bestand, anker); a; a = elternteilImBestand(bestand, a)) {
        out.unshift(a);
      }
      return out;
    };
    expect(kette("13")).toEqual(["1", "10", "11", "12"]);
    expect(kette("22")).toEqual(["1", "20", "21"]);
    expect(kette("17")).toEqual(["1", "10", "16"]);
  });

  it("H-8: GEGENPROBE — dieselben Seiten OHNE ancestors angenommen: keine Elternbeziehung wird erfunden", async () => {
    const flach = (pages: ConfluencePage[]) => pages.map((p) => seite(p.id, p.title, []));
    const bestand = await annehmenUndLaden(flach(CURSOR_1), flach(CURSOR_2));
    expect(bestand.size).toBe(15);
    for (const [anker, ko] of bestand) {
      expect(ko.pfad, `Wissensobjekt ${anker} darf keine Elternkette tragen`).toBeUndefined();
      expect(elternteilImBestand(bestand, anker)).toBeUndefined();
    }
  });
});
