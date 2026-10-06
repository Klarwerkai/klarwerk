// ================================================================================================
// R-1126 / R-1172 / R-1800 (E6) — EIN VERSCHACHTELTER CONFLUENCE-BEREICH ALS TESTDATEN
// ================================================================================================
//
// Der Befund: die bisherigen Confluence-Testseiten waren flach, der Import verschachtelter
// Strukturen wurde damit nie wirklich gemessen. Dieser Bereich ist bewusst so gebaut, wie ein
// Werks-Wiki aussieht — zwei Wurzeln, Untergruppen bis in die fünfte Ebene, gleichnamige Seiten in
// verschiedenen Zweigen, ein restringierter Teilbaum, eine Seite mit Labels und Bild.
//
// DIE WAHRHEIT STEHT IM BAUM, NICHT IN DEN `ancestors`: jede Seite nennt nur ihren direkten
// Elternteil (`eltern`). Die Elternkette, die Confluence liefern würde, wird daraus ERZEUGT
// (`alsConfluenceSeiten`) — und der Test rechnet die erwartete Ordnerlage UNABHÄNGIG davon aus
// dem Baum nach (`erwarteterPfad`). So misst er den Import und nicht seine eigene Fixture.
//
// Die Lieferreihenfolge ist absichtlich NICHT Baumreihenfolge: Kinder kommen teils vor ihren
// Eltern, genau wie bei der Confluence-Suche nach Änderungsdatum.
import type { ConfluencePage } from "../../services/confluence/src/rest-client";

export const BEREICH = "BAA";

export interface BaumSeite {
  id: string;
  titel: string;
  /** Direkter Elternteil, `null` für eine Wurzelseite des Bereichs. */
  eltern: string | null;
  labels?: string[];
  /** Leserestriktion auf eine Gruppe (Confluence-Gruppenname). */
  gruppe?: string;
  html?: string;
}

// Lieferreihenfolge (nicht Baumreihenfolge).
export const BAUM: readonly BaumSeite[] = [
  { id: "11111", titel: "Schmierplan", eltern: "1111", labels: ["wartung", "linie-a"] },
  { id: "100", titel: "Handbuch", eltern: null },
  { id: "1111", titel: "Wartung", eltern: "111" },
  { id: "111", titel: "Linie A", eltern: "110" },
  { id: "110", titel: "Produktion", eltern: "100" },
  { id: "11112", titel: "Checkliste", eltern: "1111" },
  { id: "1112", titel: "Störungen", eltern: "111" },
  { id: "112", titel: "Linie B", eltern: "110" },
  { id: "1121", titel: "Wartung", eltern: "112" },
  { id: "11211", titel: "Checkliste", eltern: "1121" },
  {
    id: "120",
    titel: "Qualität",
    eltern: "100",
    html: '<p>Prüfen nach Plan.</p><ac:image><ri:attachment ri:filename="ablauf.png"/></ac:image>',
  },
  { id: "121", titel: "Prüfpläne", eltern: "120" },
  { id: "1211", titel: "Wareneingang", eltern: "121", labels: ["qs"] },
  { id: "200", titel: "Organisation", eltern: null },
  { id: "210", titel: "Personal", eltern: "200", gruppe: "confluence-hr" },
  { id: "211", titel: "Onboarding", eltern: "210", gruppe: "confluence-hr" },
];

const nachId = new Map(BAUM.map((s) => [s.id, s]));

/** Die Ahnen einer Seite, Wurzel zuerst, ohne die Seite selbst — aus dem Baum erzeugt. */
function ahnen(seite: BaumSeite): BaumSeite[] {
  const kette: BaumSeite[] = [];
  let eltern = seite.eltern;
  while (eltern !== null) {
    const e = nachId.get(eltern);
    if (!e) {
      throw new Error(`Fixture kaputt: Elternteil ${eltern} fehlt`);
    }
    kette.unshift(e);
    eltern = e.eltern;
  }
  return kette;
}

/** Die erwartete Ordnerlage einer Seite, rein aus `eltern` nachgerechnet. */
export function erwarteterPfad(id: string): string[] {
  const seite = nachId.get(id);
  if (!seite) {
    throw new Error(`unbekannte Seite ${id}`);
  }
  const pfad: string[] = [];
  for (let e = seite.eltern; e !== null; e = nachId.get(e)?.eltern ?? null) {
    pfad.unshift(nachId.get(e)?.titel ?? "?");
  }
  return pfad;
}

/** Die Seiten in der Antwortform der Confluence-REST-API (wie `rest-client.ts` sie anfordert). */
export function alsConfluenceSeiten(): ConfluencePage[] {
  return BAUM.map((s) => ({
    id: s.id,
    title: s.titel,
    type: "page",
    status: "current",
    body: { storage: { value: s.html ?? `<p>Inhalt von ${s.titel}.</p>` } },
    version: { number: 1, when: "2026-09-01T08:00:00.000Z", by: { displayName: "Wiki Pflege" } },
    _links: { webui: `/spaces/${BEREICH}/pages/${s.id}` },
    metadata: { labels: { results: (s.labels ?? []).map((name) => ({ name })) } },
    ancestors: ahnen(s).map((a) => ({ id: a.id, title: a.titel })),
    restrictions: {
      read: {
        restrictions: {
          user: { results: [] },
          group: { results: s.gruppe ? [{ type: "group", name: s.gruppe }] : [] },
        },
      },
    },
  }));
}

/**
 * Ein fetch, der den Bereich wie Confluence in Ergebnisseiten zu `jeSeite` Einträgen ausliefert
 * und über `_links.next` weiterblättert (Cloud-Form: next relativ zum Kontextpfad).
 */
export function blaetternderFetch(jeSeite: number): { fetchFn: typeof fetch; aufrufe: string[] } {
  const seiten = alsConfluenceSeiten();
  const aufrufe: string[] = [];
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    aufrufe.push(url.pathname + url.search);
    const start = Number(url.searchParams.get("start") ?? "0");
    const teil = seiten.slice(start, start + jeSeite);
    const weiter = start + jeSeite < seiten.length;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: teil,
        _links: weiter
          ? { next: `/rest/api/content?spaceKey=${BEREICH}&start=${start + jeSeite}` }
          : {},
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, aufrufe };
}
