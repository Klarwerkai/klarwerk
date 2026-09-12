// ================================================================================================
// JOB 3741 · SEITENHILFE-LUECKEN — WER DAS ZAHNRAD OEFFNET, LIEST DORT, WAS DIESE SEITE IST.
// ================================================================================================
//
// DER BEFUND, der diesen Lauf verlangt: die Mechanik war vollstaendig gebaut und die KAPITEL
// fehlten. `shell/ZahnradMenue.tsx:39-48` holt zu der Seite, auf der man steht, den Erklaersatz
// ihres Hilfekapitels (`lib/navHilfe.ts:54-64`); gibt es keines, steht dort die Leermeldung
// `menue.seitenhilfe.leer`. Genau die sah ein Neuling auf zehn Menuepunkten.
//
// WAS HIER GEMESSEN WIRD und was nicht: dieser Lauf ist DOM-frei. Er prueft die ERHEBUNG der
// Sollmenge, die Zuordnung, die drei Sprachfassungen, die Eindeutigkeit je Route und die Suche auf
// `/hilfe`. Dass der Satz auf der Flaeche wirklich ankommt, misst der gemountete Zwilling
// `zahnrad-zeigt-den-erklaersatz.test.tsx` — ein gruener `navHilfeFor`-Lauf allein bewiese nur,
// dass ein Objekt entsteht, nicht dass es gezeichnet wird.
//
// WARUM ZWEI DATEIEN UND NICHT EINE: der Zwilling montiert React und braucht jsx + DOM-lib. Der
// Root-Typcheck ist Node-rein und schliesst `tests/**/*.tsx` aus (`tsconfig.json`); ein `.ts` mit
// `createRoot` waere dort nicht typisierbar. Die Grenze verlaeuft also am Werkzeug, nicht an der
// Aussage.
//
// DIE SOLLMENGE WIRD ERHOBEN, NICHT ABGESCHRIEBEN (Lieferung 1). `navHilfe.ts:13-16` schreibt aus,
// warum: „Eine Tabelle ‚Route → Text' waere eine zweite Wahrheit neben HELP_TOPICS." Dasselbe gilt
// fuer einen Waechter: eine hier abgetippte Routenliste bliebe gruen, sobald ein neuer Menuepunkt
// dazukaeme. Deshalb kommt die Menge aus `app/navigation.ts` und nur die AUSNAHMEN stehen als
// Liste da — jede mit ihrem Grund.
import { describe, expect, it } from "vitest";
import {
  ALL_ITEMS,
  EXTRA_GUARDED_ITEMS,
  FOOT_ITEMS,
  GUARDED_ITEMS,
  NAV_GROUPS,
  type NavItem,
  anzeigeNameKey,
  istAktiverEintrag,
} from "../../apps/web/src/app/navigation";
import {
  HELP_TOPICS,
  type HelpSearchItem,
  filterHelpTopics,
} from "../../apps/web/src/lib/helpTopics";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";
import { sprachbestand } from "../support/i18nBestand";

/** Die drei Sprachen, die `i18n.ts` fuehrt. `nl` hat einen eigenen Block, faellt also NICHT auf DE. */
const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

/**
 * Der Sprachbestand, wie ihn die Oberflaeche wirklich hat — NICHT ueber `i18n.t()`.
 *
 * `t()` faellt bei einem fehlenden `nl`-Schluessel auf Deutsch zurueck (`i18n.ts:15867`
 * `fallbackLng: "de"`). Ein Fall ueber `t()` bliebe also gruen, wenn genau eine Sprachfassung
 * fehlte — und das ist die Gegenprobe (b) dieses Auftrags. `getResourceBundle` gibt den Block
 * dieser einen Sprache zurueck, ohne Rueckfall.
 */
const BESTAND: Readonly<Record<Sprache, Record<string, string>>> = {
  de: sprachbestand("de"),
  en: sprachbestand("en"),
  nl: sprachbestand("nl"),
};

// ------------------------------------------------------------------------------------------------
// DIE DREI ROUTEN, DIE HIER AUSDRUECKLICH KEIN KAPITEL BEKOMMEN — jede mit ihrem Grund.
// ------------------------------------------------------------------------------------------------
const OHNE_KAPITEL: Readonly<Record<string, string>> = {
  // `navHilfe.ts:29-43`: auf `/admin` liegt `firststart`, und das beantwortet eine ANDERE Frage
  // („wie richte ich das System das erste Mal ein"). Die Zeile `OHNE_HINWEIS` bleibt stehen.
  "/admin": "begruendete Ausnahme seit JOB 3028 (navHilfe.ts:29-43)",
  // JOB 3669 baut auf diesen beiden Seiten die andere Haelfte der Seitenhilfe (Tipps IN der Seite).
  // Zwei Bahnen an derselben Aussage sind verboten — deshalb bleiben sie hier offen.
  "/start": "gehoert zu JOB 3669 (Seitentipps), nicht zu diesem Schnitt",
  "/entwuerfe": "gehoert zu JOB 3669 (Seitentipps), nicht zu diesem Schnitt",
};

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 1 — DIE ERHEBUNG. Aus der Navigationsquelle, nicht aus einer Liste in dieser Datei.
// ------------------------------------------------------------------------------------------------

/** Jeder Punkt, den ein Mensch im Menue anfassen kann: die Gruppen plus der Fuss. */
function menuepunkte(): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS];
}

/** Ihre Pfade, ohne Doppelung. */
function menuepunktPfade(): string[] {
  return [...new Set(menuepunkte().map((i) => i.path))];
}

/** Die Antwort der Erhebung: welche Menuepunkte heute OHNE Erklaersatz dastehen. */
function pfadeOhneErklaersatz(): string[] {
  return menuepunktPfade().filter((pfad) => navHilfeFor(pfad) === null);
}

/** Die Sollmenge dieses Auftrags: jeder Menuepunkt ausser den drei begruendeten Ausnahmen. */
function sollPfade(): string[] {
  return menuepunktPfade().filter((pfad) => !(pfad in OHNE_KAPITEL));
}

/**
 * Die elf Kapitel, die es VOR diesem Auftrag gab — in ihrer Anzeigereihenfolge.
 *
 * Sie stehen hier, damit „neu" eine belegte Aussage ist und nicht eine Zaehlung. §10 des Auftrags
 * verbietet ausserdem jede Umbenennung, Umsortierung und Textaenderung an ihnen; der Fall B1 unten
 * haelt das fest.
 */
const GEERBTE_IDS: readonly string[] = [
  "firststart",
  "capture",
  "fileimport",
  "ask",
  "library",
  "validation",
  "tasks",
  "risk",
  "lifecycle",
  "stufe2",
  "mobile",
];

/** Die Kapitel, die dieser Auftrag neu anlegt — erhoben, nicht aufgezaehlt. */
function neueKapitel(): (typeof HELP_TOPICS)[number][] {
  const soll = new Set(sollPfade());
  return HELP_TOPICS.filter((topic) => soll.has(topic.to) && !GEERBTE_IDS.includes(topic.id));
}

/** Der Suchraum der Hilfe aus `HELP_TOPICS`, aufgeloest — dieselbe Zusammenstellung wie `Help.tsx:56-65`. */
function items(lng: Sprache): (HelpSearchItem & { to: string })[] {
  return HELP_TOPICS.map((topic) => ({
    id: topic.id,
    title: BESTAND[lng][topic.titleKey] ?? "",
    body: BESTAND[lng][topic.bodyKey] ?? "",
    tags: topic.tags,
    to: topic.to,
  }));
}

describe("JOB 3741 · E — die Luecke wird ERHOBEN, nicht abgeschrieben", () => {
  it("E1: die Erhebung sieht wirklich alle Menuepunkte — Gruppen und Fuss, ohne Rest", () => {
    // Ohne diese Kalibrierung waere jeder Fall darunter auch dann gruen, wenn die Erhebung nichts
    // faende. `ALL_ITEMS` ist dieselbe Menge, aus der das Zahnrad den aktiven Punkt sucht
    // (`ZahnradMenue.tsx:42`).
    expect(
      menuepunkte()
        .map((i) => i.id)
        .sort(),
    ).toEqual(ALL_ITEMS.map((i) => i.id).sort());
    expect(menuepunktPfade().length, "die Erhebung findet keine Menuepunkte").toBeGreaterThan(15);
  });

  it("E2: jeder erhobene Menuepunkt hat einen Erklaersatz — ausser den drei begruendeten Ausnahmen", () => {
    // DAS IST DIE ANTWORT DER ERHEBUNG. Sie ist die Aussage dieses Auftrags: nach dem Bau bleiben
    // genau die Pfade stumm, fuer die ein Grund ausgeschrieben ist.
    expect(pfadeOhneErklaersatz().sort()).toEqual(Object.keys(OHNE_KAPITEL).sort());
  });

  it("E3: die drei Ausnahmen bleiben stumm — sie werden nicht still mitgebaut", () => {
    for (const pfad of Object.keys(OHNE_KAPITEL)) {
      expect(
        navHilfeFor(pfad),
        `${pfad} bekommt einen Erklaersatz, obwohl er ausgenommen ist`,
      ).toBeNull();
    }
  });

  it("E4: die Deep-Links ohne Menueeintrag sind kein stiller Rest — Befund, kein Kapitel", () => {
    // `GUARDED_ITEMS` = `ALL_ITEMS` + drei bewachte Deep-Link-Routen OHNE Navigationseintrag
    // (`navigation.ts:499-536`). Sie sind keine Menuepunkte: zwei tragen ein `:id`-Segment, das
    // `navHilfeFor` (Zeichenvergleich) gar nicht treffen koennte. Das Zahnrad findet auf ihnen
    // seinen Punkt ueber `istAktiverEintrag` — also den ELTERNPUNKT. Genau das steht hier.
    expect(GUARDED_ITEMS.length).toBe(ALL_ITEMS.length + EXTRA_GUARDED_ITEMS.length);
    const elternVon = (pfad: string): string | undefined =>
      menuepunkte().find((i) => istAktiverEintrag(i, pfad))?.path;
    expect(
      elternVon("/duplikate/x/vergleich"),
      "der Vergleich haengt nicht mehr an /duplikate",
    ).toBe("/duplikate");
    expect(
      elternVon("/konflikte/x/vergleich"),
      "der Vergleich haengt nicht mehr an /konflikte",
    ).toBe("/konflikte");
    for (const pfad of ["/duplikate/x/vergleich", "/konflikte/x/vergleich"]) {
      const eltern = elternVon(pfad) ?? "";
      expect(navHilfeFor(eltern), `${pfad} erbt keinen Erklaersatz von ${eltern}`).not.toBeNull();
    }
    // Die dritte (`/capture/frontdoor`) haengt an keinem Menuepunkt und bleibt ehrlich stumm.
    expect(elternVon("/capture/frontdoor")).toBeUndefined();
  });
});

describe("JOB 3741 · N1 — jeder Menuepunkt-Pfad loest zu einem echten Text auf, in DE, EN und NL", () => {
  it("N1a: `navHilfeFor` liefert zu jedem Soll-Pfad ein Objekt, nicht `null`", () => {
    for (const pfad of sollPfade()) {
      expect(
        navHilfeFor(pfad),
        `${pfad} hat kein Hilfekapitel — die Seitenhilfe bleibt dort leer`,
      ).not.toBeNull();
    }
  });

  it("N1b: Titel und Text stehen in ALLEN drei Sprachen — nichtleer und nicht der Schluessel selbst", () => {
    for (const pfad of sollPfade()) {
      const hilfe = navHilfeFor(pfad);
      expect(hilfe, `${pfad} ohne Kapitel`).not.toBeNull();
      if (!hilfe) {
        continue;
      }
      for (const lng of SPRACHEN) {
        for (const key of [hilfe.titleKey, hilfe.bodyKey]) {
          const text = BESTAND[lng][key];
          expect(
            text,
            `${lng}: ${pfad} — der Schluessel \`${key}\` fehlt im Sprachbestand`,
          ).toBeTypeOf("string");
          expect(
            (text ?? "").trim().length,
            `${lng}: ${pfad} — \`${key}\` ist leer`,
          ).toBeGreaterThan(0);
          expect(text, `${lng}: ${pfad} — \`${key}\` loest zum Schluessel selbst auf`).not.toBe(
            key,
          );
        }
      }
    }
  });

  it("N1c: die drei Fassungen sind drei UEBERSETZUNGEN, nicht dreimal derselbe Text", () => {
    for (const topic of neueKapitel()) {
      const texte = SPRACHEN.map((lng) => BESTAND[lng][topic.bodyKey]);
      expect(new Set(texte).size, `${topic.id}: zwei Sprachen tragen denselben Text`).toBe(
        SPRACHEN.length,
      );
    }
  });

  it("N1d: die Erhebung ist kalibriert — dieser Auftrag legt wirklich neue Kapitel an", () => {
    expect(
      neueKapitel().length,
      "kein einziges neues Kapitel — der Fall misst nichts",
    ).toBeGreaterThan(0);
    expect(
      neueKapitel().map((t) => t.id),
      "ein geerbtes Kapitel ist in die Menge der neuen geraten",
    ).not.toContain("capture");
  });
});

describe("JOB 3741 · N3 — genau EIN Kapitel je Route", () => {
  it("N3: keine Route traegt zwei Kapitel — sonst verlöre ihr Menuepunkt still den Erklaersatz", () => {
    // `navHilfe.ts:58-62`: bei mehreren Treffern liefert `navHilfeFor` `null`. Ein zweites Kapitel
    // auf einer belegten Route waere also kein Zusatz, sondern ein VERLUST.
    const proRoute = new Map<string, string[]>();
    for (const topic of HELP_TOPICS) {
      proRoute.set(topic.to, [...(proRoute.get(topic.to) ?? []), topic.id]);
    }
    const doppelt = [...proRoute.entries()].filter(([, ids]) => ids.length > 1);
    expect(doppelt, "diese Routen tragen mehr als ein Kapitel").toEqual([]);
    expect(new Set(HELP_TOPICS.map((t) => t.id)).size, "zwei Kapitel tragen dieselbe Kennung").toBe(
      HELP_TOPICS.length,
    );
  });
});

describe("JOB 3741 · N4 — die Suche auf /hilfe findet die Seite unter ihrem Menuenamen", () => {
  it("N4: der Anzeigename des Menuepunkts fuehrt zum Kapitel DIESER Route — in DE und EN", () => {
    for (const lng of ["de", "en"] as const) {
      for (const topic of neueKapitel()) {
        const punkt = menuepunkte().find((i) => i.path === topic.to);
        expect(punkt, `${topic.to} ist kein Menuepunkt mehr`).toBeDefined();
        if (!punkt) {
          continue;
        }
        const name = BESTAND[lng][anzeigeNameKey(punkt)] ?? "";
        expect(name.length, `${lng}: der Menuepunkt ${punkt.id} hat keinen Namen`).toBeGreaterThan(
          0,
        );
        const treffer = filterHelpTopics(items(lng), name);
        expect(
          treffer.map((i) => i.id),
          `${lng}: die Suche nach „${name}“ findet das Kapitel zu ${topic.to} nicht`,
        ).toContain(topic.id);
      }
    }
  });
});

describe("JOB 3741 · P — die Route ist gegen die Navigationsquelle gepinnt, nicht abgetippt", () => {
  it("P1: jedes neue Kapitel traegt die Kennung UND den Pfad seines Menuepunkts", () => {
    for (const topic of neueKapitel()) {
      const punkt = menuepunkte().find((i) => i.id === topic.id);
      expect(
        punkt,
        `kein Menuepunkt heisst \`${topic.id}\` — die Kennung ist geraten`,
      ).toBeDefined();
      expect(topic.to, `\`${topic.id}\`: der Pfad weicht von app/navigation.ts ab`).toBe(
        punkt?.path,
      );
    }
  });

  it("P2: die Schluessel folgen der Kennung — `help.<id>.title` und `help.<id>.body`", () => {
    for (const topic of neueKapitel()) {
      expect(topic.titleKey).toBe(`help.${topic.id}.title`);
      expect(topic.bodyKey).toBe(`help.${topic.id}.body`);
    }
  });

  it("P3: kein neuer Kapiteltext behauptet eine Zahl (Auftrag §9 — Zahlen kommen vom Server)", () => {
    for (const topic of neueKapitel()) {
      for (const lng of SPRACHEN) {
        expect(
          BESTAND[lng][topic.titleKey],
          `${lng}/${topic.id}: der Titel nennt eine Zahl`,
        ).not.toMatch(/\d/);
        expect(
          BESTAND[lng][topic.bodyKey],
          `${lng}/${topic.id}: der Text nennt eine Zahl`,
        ).not.toMatch(/\d/);
      }
    }
  });
});

describe("JOB 3741 · B — der bestehende Bestand bleibt unberuehrt (§10)", () => {
  it("B1: die elf geerbten Kapitel stehen unveraendert und in ihrer Reihenfolge am Anfang", () => {
    expect(HELP_TOPICS.slice(0, GEERBTE_IDS.length).map((t) => t.id)).toEqual([...GEERBTE_IDS]);
  });

  it("B2: `/admin`, `/bibliothek`, `/validierung` und `/aufgaben` tragen weiter genau ihr Kapitel", () => {
    const kapitelAuf = (route: string): string[] =>
      HELP_TOPICS.filter((t) => t.to === route).map((t) => t.id);
    expect(kapitelAuf("/admin")).toEqual(["firststart"]);
    expect(kapitelAuf("/bibliothek")).toEqual(["library"]);
    expect(kapitelAuf("/validierung")).toEqual(["validation"]);
    expect(kapitelAuf("/aufgaben")).toEqual(["tasks"]);
  });

  it("B3: jede Route bleibt intern und jedes Kapitel traegt Merkmale", () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.to.startsWith("/"), `${topic.id}: keine interne Route`).toBe(true);
      expect(topic.to, `${topic.id}: externer Link`).not.toMatch(/^https?:/);
      expect(topic.tags.length, `${topic.id}: ohne Merkmale`).toBeGreaterThan(0);
    }
  });
});
