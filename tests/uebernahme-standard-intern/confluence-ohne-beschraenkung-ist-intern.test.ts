// ==================================================================================================
// JOB 3089 · N11 — EINE ÜBERNOMMENE CONFLUENCE-SEITE OHNE BESCHRÄNKUNG IST INTERN, NICHT VERTRAULICH.
// ==================================================================================================
//
// PEDIS ENTSCHEIDUNG 23 vom 05.09.2026, 19:23, wörtlich: „Es ist nicht vertraulich … externe KI ist
// überall erlaubt". Sie kehrt SCRUM-511 um, die bis hierher galt und im Mapper ausgeschrieben stand:
// „NIE ‚intern' aus dem Mapper" — eine nicht restringierte Seite lieferte `undefined`, und der
// Import-Kern stufte daraus fail-safe „vertraulich" (`library-analytics/src/service.ts:1568`).
// Folge im Betrieb (OFFEN.md C4): bei JEDEM echten Confluence-Import war jeder Kandidat vertraulich,
// die KI-Gruppierung lief dort nie, und der Mensch las an einem gewöhnlichen Wiki-Artikel ein
// Vertraulichkeitszeichen.
//
// WAS JETZT GILT: restringiert → „vertraulich", nicht restringiert → „intern". Beides ist eine ECHTE
// Einstufung mit einem Erzeuger (die vorhandene bzw. die nicht vorhandene Leseeinschränkung im
// Quellsystem), kein geratener Vorgabewert. Was NICHT gilt: aus dem Nichts wird kein „intern". Ein
// Objekt, das nie jemand eingestuft hat, bleibt „nicht eingestuft" — diese Unterscheidung
// (`knowledge-object/src/confidentiality.ts:99-102`, `apps/web/src/lib/confidentiality.ts:49-79`)
// wird hier nicht eingeebnet, sondern in F5 ausdrücklich mitgemessen: das übernommene Objekt trägt
// die Stufe GESETZT, mit Herkunft „ko".
//
// WARUM DIE KETTE UND NICHT NUR DIE FUNKTION (F5/F6): der Nutzen entsteht am angelegten Objekt, nicht
// an der Mapper-Rückgabe. Zwischen beiden liegen die Ingest-Sanitisierung
// (`service.ts:396-399`) und der Erstanlage-Zweig (`service.ts:1568` → `KoService.create`, dessen
// Speicherbedingung erst JOB 3076 auf „übergeben statt vertraulich" umgestellt hat,
// `knowledge-object/src/service.ts:1726-1728`). Ein Test nur an der Funktion wäre grün, während am
// Objekt nichts ankommt.
//
// DIE FÄLLE HALTEN SICH GEGENSEITIG IN SCHACH: F1/F4/F5 tragen die neue Regel, F2/F3/F6 halten den
// Restriktionsfall fest. Wer den Mapper auf „intern für alles" stellt, macht F2/F3/F6 rot; wer ihn
// zurück auf `undefined` stellt, F1/F4/F5. F7 misst Pedis zweiten Halbsatz an der Stelle, an der er
// wirkt — ohne einen Wächter anzufassen.
import { describe, expect, it } from "vitest";
// tests/ liegt außerhalb der dependency-cruiser-Modulgrenzen; der White-box-Import des echten
// Mappers ist hier dasselbe Muster wie in tests/app/import-group-routes.test.ts:16.
import {
  confluenceGovernanceConfidentiality,
  mapConfluencePageToImportItem,
} from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import {
  InMemoryKoRepo,
  KoService,
  discloseConfidentiality,
} from "../../services/knowledge-object";
import { LibraryService, groupingRequiresConfidential } from "../../services/library-analytics";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

/** Eine gewöhnliche Wiki-Seite: das Feld `restrictions` fehlt ganz (der häufigste Confluence-Fall). */
const offeneSeite: ConfluencePage = {
  id: "2001",
  title: "Allgemeine Hinweise zur Anlage",
  body: { storage: { value: "<p>Hinweis zur Anlage 3.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/2001/Hinweise" },
};

/** Leseeinschränkung auf Benutzer. */
const userRestringiert: ConfluencePage = {
  id: "2002",
  title: "Notfallplan Pumpe",
  body: { storage: { value: "<p>Bei Überdruck Ventil X schließen.</p>" } },
  version: { number: 3 },
  _links: { webui: "/spaces/K/pages/2002/Notfallplan" },
  restrictions: {
    read: { restrictions: { user: { results: [{ x: 1 }] }, group: { results: [] } } },
  },
};

/** Leseeinschränkung auf eine Gruppe — dieselbe Beschränkung, andere Trägerliste. */
const groupRestringiert: ConfluencePage = {
  id: "2003",
  title: "Gehaltsbänder",
  body: { storage: { value: "<p>Nur für die Personalabteilung.</p>" } },
  version: { number: 2 },
  _links: { webui: "/spaces/K/pages/2003/Gehalt" },
  restrictions: {
    read: { restrictions: { user: { results: [] }, group: { results: [{ name: "hr" }] } } },
  },
};

/**
 * Der Fall, den Confluence tatsächlich liefert, wenn jemand den Beschränkungsdialog geöffnet und
 * wieder geschlossen hat: die Struktur steht da, beide Listen sind LEER. Eine leere Liste ist keine
 * Beschränkung — sonst wäre eine offene Seite je nach Antwortform verschieden eingestuft.
 */
const leereRestriktionslisten: ConfluencePage = {
  id: "2004",
  title: "Onboarding-Leitfaden",
  body: { storage: { value: "<p>Erste Schritte.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/2004/Onboarding" },
  restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
};

/**
 * Die echte Übernahme-Kette bis zum angelegten Objekt: Mapper → Review-Queue → `accept` → KO.
 * `externalUpsert: true` ist der Confluence-Strang (quellneutraler externalId-Anker), wie in
 * `services/library-analytics/src/service.test.ts:79`.
 */
async function uebernimm(seite: ConfluencePage) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const library = new LibraryService({ koService, externalUpsert: true });
  const item = mapConfluencePageToImportItem(seite, OPTS);
  const [kandidat] = await library.createImportCandidates([item], "importeur");
  const ergebnis = await library.reviewImportCandidate(kandidat!.id, "accept", "reviewerin");
  const ko = (await koService.list()).find((k) => k.id === ergebnis.koId);
  expect(ko, "Der Accept legt ein Wissensobjekt an — sonst misst der Fall nichts.").toBeDefined();
  return ko!;
}

describe("JOB 3089 · Übernahme-Standard „intern“ (Pedis Entscheidung 23)", () => {
  it("F1 · nicht restringierte Seite → ausdrücklich „intern“ (bis hierher: undefined)", () => {
    expect(confluenceGovernanceConfidentiality(offeneSeite)).toBe("intern");
    // Und das Item trägt das Feld wirklich — nicht bloß die Funktion.
    const item = mapConfluencePageToImportItem(offeneSeite, OPTS);
    expect(item.confidentiality).toBe("intern");
    expect(Object.hasOwn(item, "confidentiality")).toBe(true);
  });

  it("F2 · user-restringierte Seite → weiterhin „vertraulich“", () => {
    expect(confluenceGovernanceConfidentiality(userRestringiert)).toBe("vertraulich");
    expect(mapConfluencePageToImportItem(userRestringiert, OPTS).confidentiality).toBe(
      "vertraulich",
    );
  });

  it("F3 · group-restringierte Seite → weiterhin „vertraulich“", () => {
    expect(confluenceGovernanceConfidentiality(groupRestringiert)).toBe("vertraulich");
    expect(mapConfluencePageToImportItem(groupRestringiert, OPTS).confidentiality).toBe(
      "vertraulich",
    );
  });

  it("F4 · vorhandene, aber LEERE Restriktionslisten sind keine Beschränkung → „intern“", () => {
    expect(confluenceGovernanceConfidentiality(leereRestriktionslisten)).toBe("intern");
    expect(mapConfluencePageToImportItem(leereRestriktionslisten, OPTS).confidentiality).toBe(
      "intern",
    );
  });

  it("F5 · die Kette: offene Seite übernommen → das ANGELEGTE Objekt trägt „intern“, gesetzt", async () => {
    const ko = await uebernimm(offeneSeite);
    expect(ko.confidentiality).toBe("intern");
    // Feldpräsenz UND Wert: „fehlend“ ist ein anderer Zustand als „intern“ (JOB 3076). Genau daran
    // hängt, ob der Mensch „Öffentlich-intern“ oder „Nicht eingestuft“ liest.
    expect(Object.hasOwn(ko, "confidentiality")).toBe(true);
    expect(ko.confidentiality).not.toBeUndefined();
    // Die Auskunft, die die Fläche liest: eine Einstufung MIT Erzeuger, nicht „niemand hat je“.
    expect(discloseConfidentiality(ko.confidentiality)).toEqual({
      confidentiality: "intern",
      confidentialityProvenance: "ko",
    });
  });

  it("F6 · Gegenfall: restringierte Seite übernommen → das Objekt trägt „vertraulich“", async () => {
    const ko = await uebernimm(userRestringiert);
    expect(ko.confidentiality).toBe("vertraulich");
    expect(discloseConfidentiality(ko.confidentiality)).toEqual({
      confidentiality: "vertraulich",
      confidentialityProvenance: "ko",
    });
  });

  it("F7 · Pedis zweiter Halbsatz: ein Batch aus offenen Seiten sperrt die externe KI nicht mehr", () => {
    const offen = [offeneSeite, leereRestriktionslisten].map((s) =>
      mapConfluencePageToImportItem(s, OPTS),
    );
    // Bis hierher: jeder echte Confluence-Batch war „unklar“ und damit vertraulich (OFFEN.md C4).
    expect(groupingRequiresConfidential(offen)).toBe(false);
    // Der Riegel selbst bleibt unangetastet: EINE restringierte Seite im Batch sperrt weiterhin.
    expect(
      groupingRequiresConfidential([
        ...offen,
        mapConfluencePageToImportItem(groupRestringiert, OPTS),
      ]),
    ).toBe(true);
  });
});
