// ================================================================================================
// G27 — DIE REINE REGEL DER SUCHPROJEKTION
// ================================================================================================
//
// Diese Datei prüft AUSSCHLIESSLICH die reine Ableitung (keine Persistenz, keine HTTP-Schicht):
// sichtbarer Text aus bodyHtml, deterministische Normalisierung, kanonischer content_hash und die
// explizite projection_version. Alles, was hier steht, ist eine reine Funktion — gleiche Eingabe,
// gleiche Ausgabe, auf jeder Maschine.
//
// UNSICHTBARE ZEICHEN STEHEN HIER IMMER ALS ESCAPE (\u….), nie als echtes Zeichen im Quelltext:
// ein Test, dessen Eingabe man nicht lesen kann, ist ein Test, dessen Verlust niemand bemerkt.
import { describe, expect, it } from "vitest";
import {
  type KnowledgeObject,
  MAX_SEARCH_TEXT_LENGTH,
  SEARCH_PROJECTION_FIELDS,
  SEARCH_PROJECTION_LANGUAGE,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  normalizeSearchFragment,
  searchProjectionContentHash,
  visibleTextFromBodyHtml,
} from "../../services/knowledge-object";

const AT = "2026-08-01T10:00:00.000Z";

// Unsichtbare Zeichen als benannte Konstanten (aus Codepoints gebaut — im Quelltext lesbar).
const NBSP = String.fromCharCode(0x00a0);
const ZWSP = String.fromCharCode(0x200b);
const BEL = String.fromCharCode(0x0007);
const COMBINING_DIAERESIS = String.fromCharCode(0x0308);
const U_UMLAUT = String.fromCharCode(0x00fc);

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Dosierpumpe warten",
    statement: "Regelmäßig entlüften.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: AT,
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

describe("G27 · sichtbarer Text aus bodyHtml", () => {
  it("Skripte, Styles und ihr Inhalt gelangen NICHT in den Suchtext", () => {
    const body =
      "<p>Sichtbarer Absatz</p><script>const geheim = 'SKRIPTWORT';</script>" +
      "<style>.x { color: STYLEWORT; }</style><p>Zweiter Absatz</p>";
    const text = normalizeSearchFragment(visibleTextFromBodyHtml(body));
    expect(text).toContain("Sichtbarer Absatz");
    expect(text).toContain("Zweiter Absatz");
    expect(text).not.toContain("SKRIPTWORT");
    expect(text).not.toContain("STYLEWORT");
  });

  it("versteckte Fragmente (hidden, aria-hidden, display:none, visibility:hidden, template) fallen weg", () => {
    const body = [
      "<p>SICHTBAR</p>",
      "<div hidden><p>VERSTECKT_ATTRIBUT</p></div>",
      '<div aria-hidden="true">VERSTECKT_ARIA</div>',
      '<div style="display:none">VERSTECKT_DISPLAY</div>',
      '<span style="visibility: hidden">VERSTECKT_VISIBILITY</span>',
      "<template>VERSTECKT_TEMPLATE</template>",
    ].join("");
    const text = normalizeSearchFragment(visibleTextFromBodyHtml(body));
    expect(text).toContain("SICHTBAR");
    for (const wort of [
      "VERSTECKT_ATTRIBUT",
      "VERSTECKT_ARIA",
      "VERSTECKT_DISPLAY",
      "VERSTECKT_VISIBILITY",
      "VERSTECKT_TEMPLATE",
    ]) {
      expect(text, `${wort} darf nicht im Suchtext stehen`).not.toContain(wort);
    }
  });

  it("verschachtelter Inhalt eines versteckten Elements fällt vollständig weg, danach zählt wieder alles", () => {
    const body =
      "<div hidden><section><p><em>TIEF_VERSTECKT</em></p></section></div><p>DANACH_SICHTBAR</p>";
    const text = normalizeSearchFragment(visibleTextFromBodyHtml(body));
    expect(text).not.toContain("TIEF_VERSTECKT");
    expect(text).toContain("DANACH_SICHTBAR");
  });

  it("Attributwerte (auch megabyte-große base64-Bilddaten) landen NIE im Suchtext", () => {
    const marker = "QURCQ0FCQ0Q";
    const body = `<figure><img src="data:image/png;base64,${marker.repeat(50_000)}" alt="ALTTEXT"><p>Bildabsatz</p></figure>`;
    const text = normalizeSearchFragment(visibleTextFromBodyHtml(body));
    expect(text).toBe("Bildabsatz");
    expect(text).not.toContain(marker);
    expect(text).not.toContain("ALTTEXT");
  });

  it("Tag-Grenzen sind Wortgrenzen — aus zwei Absätzen wird nie ein Wort", () => {
    expect(normalizeSearchFragment(visibleTextFromBodyHtml("<p>a</p><p>b</p>"))).toBe("a b");
  });

  it("HTML-Kommentare tragen keinen sichtbaren Text", () => {
    const text = normalizeSearchFragment(
      visibleTextFromBodyHtml("<p>A</p><!-- KOMMENTARWORT --><p>B</p>"),
    );
    expect(text).not.toContain("KOMMENTARWORT");
    expect(text).toBe("A B");
  });
});

describe("G27 · deterministische Normalisierung", () => {
  it("echter Leerraum (Umbruch, Tabulator, NBSP) kollabiert zu EINEM Leerzeichen", () => {
    expect(normalizeSearchFragment(`a\n\n b\t\tc${NBSP}${NBSP}d`)).toBe("a b c d");
  });

  it("Zero-Width-Zeichen werden ERSATZLOS entfernt — ein Wort bleibt ein Wort", () => {
    // Der Umbruchhinweis mitten im Kompositum darf das Wort nicht in zwei Indexwörter zerlegen.
    expect(normalizeSearchFragment(`Donau${ZWSP}dampfschiff`)).toBe("Donaudampfschiff");
  });

  it("Steuerzeichen werden ERSATZLOS entfernt", () => {
    expect(normalizeSearchFragment(`Ven${BEL}til`)).toBe("Ventil");
  });

  it("Unicode wird kanonisch (NFKC): zerlegtes und vorkomponiertes ü sind dasselbe Wort", () => {
    const zerlegt = `Ventilu${COMBINING_DIAERESIS}berdruck`;
    const vorkomponiert = `Ventil${U_UMLAUT}berdruck`;
    // Kalibrierung: die Eingaben sind wirklich verschieden (sonst prüfte der Test nichts).
    expect(zerlegt).not.toBe(vorkomponiert);
    expect(normalizeSearchFragment(zerlegt)).toBe(normalizeSearchFragment(vorkomponiert));
  });

  it("HTML-Entities werden aufgelöst (ein Index, nicht zwei)", () => {
    expect(normalizeSearchFragment("Ventil&uuml;berdruck")).toBe(`Ventil${U_UMLAUT}berdruck`);
  });

  it("ist idempotent — zweimal normalisieren ändert nichts", () => {
    const einmal = normalizeSearchFragment("  a   b\n");
    expect(normalizeSearchFragment(einmal)).toBe(einmal);
  });
});

describe("G27 · content_hash und projection_version", () => {
  // ----------------------------------------------------------------------------------------------
  // WAS „GLEICHE EINGABE" SEIT DETAILENTSCHEIDUNG J HEISST
  // ----------------------------------------------------------------------------------------------
  //
  // Die frühere Fassung baute dieselbe Inhaltsversion mit ZWEI verschiedenen historischen Zeitpunkten
  // und erwartete denselben Hash. Genau das ist der No-Go aus Abschnitt J: `captured_at` gehört zum
  // kanonischen `classification_snapshot` und ist hashwirksam. Zwei Zeilen, die denselben Text mit
  // unterschiedlicher Beleglage tragen, sind NICHT dieselbe historische Aussage — und dürfen deshalb
  // nicht denselben Prüfwert tragen.
  //
  // Die Determinismus-Zusage bleibt vollständig erhalten, nur richtig geschnitten: gleicher Inhalt
  // UND gleiche Beleglage ⇒ derselbe Hash. Der Rebuild leitet die Beleglage nicht neu aus der Uhr ab
  // (s. tests/ko/g27-projektion-persistenz.test.ts), er kann diese Zusage also einhalten.
  it("gleicher Inhalt UND gleiche Beleglage ⇒ byte-gleiche Projektion und derselbe Hash", () => {
    const a = buildSearchProjection(ko({ bodyHtml: "<p>Hydraulikdruck ablassen</p>" }), AT);
    const b = buildSearchProjection(ko({ bodyHtml: "<p>Hydraulikdruck ablassen</p>" }), AT);
    expect(b.classificationSnapshot).toEqual(a.classificationSnapshot);
    expect(b.searchText).toBe(a.searchText);
    expect(b.contentHash).toBe(a.contentHash);
    expect(b).toEqual(a);
  });

  it("anderer historischer Zeitpunkt ⇒ anderer Hash, obwohl der Suchtext derselbe bleibt", () => {
    const frueh = buildSearchProjection(ko({ bodyHtml: "<p>Hydraulikdruck ablassen</p>" }), AT);
    const spaet = buildSearchProjection(
      ko({ bodyHtml: "<p>Hydraulikdruck ablassen</p>" }),
      "2027-01-01T00:00:00.000Z",
    );
    // Der Inhalt ist wortgleich — es unterscheidet sich AUSSCHLIESSLICH die Beleglage.
    expect(spaet.searchText).toBe(frueh.searchText);
    expect(spaet.bodyText).toBe(frueh.bodyText);
    expect(spaet.classificationSnapshot.value).toBe(frueh.classificationSnapshot.value);
    expect(spaet.classificationSnapshot.capturedAt).not.toBe(
      frueh.classificationSnapshot.capturedAt,
    );
    // Abschnitt J: gleicher `content_hash` für unterschiedliche historische Beleglagen ist ein
    // No-Go. Eine bessere/andere Beleglage ist ein ANDERER historischer Datensatz.
    expect(spaet.contentHash).not.toBe(frueh.contentHash);
    expect(spaet.createdAt).not.toBe(frueh.createdAt);
  });

  it("geänderter Inhalt ⇒ anderer Hash", () => {
    const a = buildSearchProjection(ko({ bodyHtml: "<p>Alpha</p>" }), AT);
    const b = buildSearchProjection(ko({ bodyHtml: "<p>Beta</p>" }), AT);
    expect(b.contentHash).not.toBe(a.contentHash);
  });

  it("die projection_version ist explizit und geht in den Hash ein", () => {
    const p = buildSearchProjection(ko(), AT);
    expect(p.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    const mitAndererFassung = searchProjectionContentHash({
      projectionVersion: SEARCH_PROJECTION_VERSION + 1,
      koId: p.koId,
      koVersion: p.koVersion,
      language: p.language,
      status: p.status,
      titleText: p.titleText,
      statementText: p.statementText,
      captionText: p.captionText,
      bodyText: p.bodyText,
      searchText: p.searchText,
      classificationValue: p.classificationSnapshot.value,
      classificationSource: p.classificationSnapshot.source,
    });
    expect(mitAndererFassung).not.toBe(p.contentHash);
  });

  it("die Sprache ist ehrlich unbestimmt (keine geratene Erkennung)", () => {
    expect(buildSearchProjection(ko(), AT).language).toBe(SEARCH_PROJECTION_LANGUAGE);
    expect(SEARCH_PROJECTION_LANGUAGE).toBe("und");
  });
});

describe("G27 · der Feldvertrag", () => {
  it("die Projektion trägt GENAU die kanonischen Felder der Architekturentscheidung (Fassung 2)", () => {
    const p = buildSearchProjection(ko({ tags: ["hydraulik"] }), AT);
    expect(Object.keys(p).sort()).toEqual([...SEARCH_PROJECTION_FIELDS].sort());
    expect(SEARCH_PROJECTION_FIELDS).toEqual([
      "koId",
      "koVersion",
      "projectionVersion",
      "searchText",
      "titleText",
      "statementText",
      "captionText",
      "bodyText",
      "language",
      "contentHash",
      "status",
      "classificationSnapshot",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("Titel, Aussage, Bildunterschriften und Dokumenttext stehen im search_text — Kategorie und Schlagwörter NICHT", () => {
    const p = buildSearchProjection(
      ko({
        title: "TITELWORT",
        statement: "AUSSAGEWORT",
        category: "KATEGORIEWORT",
        tags: ["SCHLAGWORT"],
        bodyHtml: "<figure><figcaption>FUSSNOTENWORT</figcaption></figure><p>DOKUMENTWORT</p>",
      }),
      AT,
    );
    for (const wort of ["TITELWORT", "AUSSAGEWORT", "FUSSNOTENWORT", "DOKUMENTWORT"]) {
      expect(p.searchText, `${wort} fehlt im Suchtext`).toContain(wort);
    }
    // S1-Feldgrenze: versionslose Metadaten gehören nicht in die unveränderliche Inhaltszeile.
    for (const wort of ["KATEGORIEWORT", "SCHLAGWORT"]) {
      expect(
        p.searchText,
        `${wort} darf nicht im Suchtext der Content Projection stehen`,
      ).not.toContain(wort);
    }
    expect(p.titleText).toBe("TITELWORT");
    expect(p.captionText).toBe("FUSSNOTENWORT");
    expect(p.bodyText).toBe("DOKUMENTWORT");
  });

  it("eine Suchanfrage kann nicht ÜBER eine Feldgrenze hinweg treffen", () => {
    const p = buildSearchProjection(ko({ title: "Alpha", statement: "Beta" }), AT);
    expect(p.searchText.toLowerCase()).not.toContain("alpha beta");
    expect(p.searchText).toContain("Alpha");
    expect(p.searchText).toContain("Beta");
  });
});

describe("G27 · der Deckel behauptet keine Vollständigkeit, die er nicht hat", () => {
  it("kurzer Inhalt ⇒ status vollstaendig", () => {
    expect(buildSearchProjection(ko({ bodyHtml: "<p>kurz</p>" }), AT).status).toBe("vollstaendig");
  });

  it("überlanger Inhalt ⇒ geschnitten UND als unvollstaendig ausgewiesen", () => {
    const p = buildSearchProjection(
      ko({ bodyHtml: `<p>${"w".repeat(MAX_SEARCH_TEXT_LENGTH + 5_000)}</p>` }),
      AT,
    );
    expect(p.searchText.length).toBe(MAX_SEARCH_TEXT_LENGTH);
    expect(p.status).toBe("unvollstaendig");
  });
});
