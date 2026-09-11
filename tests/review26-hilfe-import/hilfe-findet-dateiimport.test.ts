// ================================================================================================
// JOB 3468 · REVIEW26-HILFE-IMPORT — die Hilfe kennt den Dateiimport (DOM-freier Teil).
// ================================================================================================
//
// DER GEMELDETE BEFUND (`gespraech/advisor-freitag/NUTZERBEFUNDE-AN-CLAUDE-20260908.md:163-171`):
// „Hilfesuche import bleibt leer, obwohl Erfassen → Datei → Datei importieren vorhanden ist."
// Die Funktion IST gebaut (`lib/captureFromFile.ts`, `components/CaptureFileImport.tsx`); nur ihre
// Auffindbarkeit fehlte. Wer in der Hilfe nichts findet, schliesst daraus, es gäbe sie nicht.
//
// WAS HIER GEMESSEN WIRD und was nicht: dieser Lauf ist DOM-frei und prüft die Suchregel, die
// Kapiteldaten, die drei Sprachfassungen und die Erhebung der Dateiarten AUS DER QUELLE. Dass das
// Kapitel auf der echten Seite ankommt (Karte, Link, Grenzen-Zusatz), misst der gemountete Zwilling
// `hilfe-karte-dateiimport.test.tsx` — der Filter allein bliebe auch dann grün, wenn das Kapitel im
// Suchraum der SEITE gar nicht erschiene (der teuerste Fehler dieses Projekts: gebaut und nie
// gerufen, vgl. Kopf von `tests/iso-hilfe/iso-hilfe-flaeche.test.tsx`).
//
// DIE GEGENPROBEN, mit denen diese Datei ihre Aussagekraft belegt — alle vier GEMESSEN, keine
// gerechnet (Läufe und Kennungen stehen in RUECKGABE.md):
//   1. Merkmal `upload` aus `helpTopics.ts` entfernen       → B1 und B2 rot.
//   2. `help.fileimport.body` (EN) auf den DE-Text setzen   → C2 und C3 rot.
//   3. `to` des Kapitels auf `/erfassen` setzen             → R1, R2 und V3 rot, und zusätzlich
//      `tests/bedienbarkeit/u3-navhilfe-regeln.test.ts` (7 statt 8 Menüpunkte mit Hinweis) — der
//      Beleg dafür, dass die Route kein Schönheitsgriff ist.
//   4. `FileKind` in `extract.ts` um `"rtf"` erweitern      → Q1 und Q2 rot.
//
// AUSDRÜCKLICH NICHT: das Merkmal `import` oder `pptx` zu entfernen macht A1 bzw. Q2 NICHT rot — der
// Kapiteltext selbst nennt „Datei importieren" und „(.pptx)", und `filterHelpTopics` sucht auch im
// Text. Dass A1 überhaupt etwas misst, belegt der Ausgangsstand: dort lieferte
// `filterHelpTopics(items, "import")` wörtlich `[]` (Rot-Lauf, Kennung in RUECKGABE.md).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_ITEMS } from "../../apps/web/src/app/navigation";
import { BLATT_WEG_DATEI, BLATT_WEG_PARAMETER } from "../../apps/web/src/components/erfassen/wege";
import i18n from "../../apps/web/src/i18n";
import { detectFileKind } from "../../apps/web/src/lib/extract";
import {
  HELP_TOPICS,
  type HelpSearchItem,
  filterHelpTopics,
} from "../../apps/web/src/lib/helpTopics";
import { ISO_HELP_TOPICS, isoHelpSprache } from "../../apps/web/src/lib/helpTopics.iso";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";

const WURZEL = join(__dirname, "..", "..");
const lies = (p: string): string => readFileSync(join(WURZEL, p), "utf8");

/** Die eine Kennung, um die es geht. Sie steht hier, damit jeder Fall dieselbe meint. */
const KAPITEL = "fileimport";

/** Die drei Sprachen, die `i18n.ts` führt. `nl` hat einen eigenen Block, fällt also NICHT auf DE. */
const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Der Suchraum der Hilfe, aufgelöst — dieselbe Zusammenstellung wie `pages/Help.tsx:39-56`:
 * i18n-Kapitel plus ISO-Kapitel, EIN Filter darüber. Sie steht hier nur, damit dieser Lauf ohne
 * React auskommt; dass die Seite wirklich denselben Raum baut, belegt der gemountete Zwilling.
 */
function items(): (HelpSearchItem & { to: string })[] {
  const isoLng = isoHelpSprache(i18n.language);
  return [
    ...HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: i18n.t(topic.titleKey),
      body: i18n.t(topic.bodyKey),
      tags: topic.tags,
      to: topic.to,
    })),
    ...ISO_HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: topic.title[isoLng],
      body: topic.body[isoLng],
      tags: topic.tags,
      to: topic.to,
    })),
  ];
}

const treffer = (frage: string): string[] => filterHelpTopics(items(), frage).map((i) => i.id);

function kapitel(): (typeof HELP_TOPICS)[number] {
  const def = HELP_TOPICS.find((t) => t.id === KAPITEL);
  if (!def) {
    throw new Error(`HELP_TOPICS führt kein Kapitel \`${KAPITEL}\``);
  }
  return def;
}

// ------------------------------------------------------------------------------------------------
// DIE DATEIARTEN WERDEN ERHOBEN, NICHT ABGESCHRIEBEN (Lieferung 6, Lehre aus JOB 3449).
// ------------------------------------------------------------------------------------------------
// Quelle ist `lib/extract.ts` — dort steht die Wahrheit über die unterstützten Arten (`FileKind`,
// `detectFileKind`). Ein Wächter, der die Arten daneben noch einmal auflistet, sichert nichts: er
// bliebe grün, wenn eine Art hinzukäme. Darum zwei Schritte:
//   (1) die Union `FileKind` aus dem Quelltext lesen, `unsupported` ist keine unterstützte Art;
//   (2) jede erhobene Art mit einer Probe durch `detectFileKind` belegen — die Erhebung ist damit
//       am VERHALTEN geprüft und nicht nur am Text. Eine neue Art ohne Probe macht Q1 rot.
const EXTRACT = lies("apps/web/src/lib/extract.ts");

function erhobeneDateiarten(): string[] {
  const roh = /export type FileKind =([^;]+);/.exec(EXTRACT)?.[1];
  if (!roh) {
    throw new Error("`export type FileKind` steht nicht mehr in apps/web/src/lib/extract.ts");
  }
  return roh
    .split("|")
    .map((teil) => teil.trim().replace(/^"|"$/g, ""))
    .filter((art) => art.length > 0 && art !== "unsupported");
}

/** Eine Probe je Art — der Beleg, dass die erhobene Art wirklich entsteht. */
const PROBEN: Readonly<Record<string, { name: string; type?: string }>> = {
  text: { name: "notiz.txt" },
  docx: { name: "bericht.docx" },
  pdf: { name: "anleitung.pdf" },
  pptx: { name: "folien.pptx" },
  image: { name: "foto.png", type: "image/png" },
};

beforeAll(async () => {
  await i18n.changeLanguage("de");
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

describe("JOB 3468 · A — die GEMELDETE Suche findet den vorhandenen Weg", () => {
  it("A1: „import“ führt zu genau einem Kapitel `fileimport`", () => {
    const gefunden = treffer("import");
    expect(
      gefunden.filter((id) => id === KAPITEL),
      "die gemeldete Suche „import“ findet den Dateiimport nicht",
    ).toEqual([KAPITEL]);
  });

  it("A2: Groß-/Kleinschreibung ist egal — „IMPORT“ und „Import“ treffen genauso", () => {
    for (const frage of ["IMPORT", "Import", "ImPoRt"]) {
      expect(treffer(frage), `„${frage}“ findet den Dateiimport nicht`).toContain(KAPITEL);
    }
  });

  it("A3: in allen drei Sprachen, nicht nur auf Deutsch", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      expect(treffer("import"), `„import“ wirkt in ${lng} nicht`).toContain(KAPITEL);
    }
  });
});

describe("JOB 3468 · B — die weiteren gemeldeten Begriffe treffen ebenfalls", () => {
  it("B1: „datei“, „upload“, „hochladen“, „dokument“ führen zum Kapitel", () => {
    for (const frage of ["datei", "upload", "hochladen", "dokument"]) {
      expect(treffer(frage), `„${frage}“ findet den Dateiimport nicht`).toContain(KAPITEL);
    }
  });

  it("B2: die Merkmale tragen die vom Auftrag verlangte Mindestmenge", () => {
    const tags = kapitel().tags.map((t) => t.toLowerCase());
    for (const pflicht of ["import", "datei", "upload", "hochladen", "dokument"]) {
      expect(tags, `Merkmal \`${pflicht}\` fehlt`).toContain(pflicht);
    }
  });
});

describe("JOB 3468 · C — DE, EN und NL sind drei FASSUNGEN, nicht dreimal derselbe Text", () => {
  it("C1: jede Sprache liefert Titel und Text (kein durchfallender Schlüssel)", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      const titel = i18n.t(kapitel().titleKey);
      const text = i18n.t(kapitel().bodyKey);
      expect(titel, `${lng}: Titel ist der Schlüssel selbst`).not.toBe(kapitel().titleKey);
      expect(text, `${lng}: Text ist der Schlüssel selbst`).not.toBe(kapitel().bodyKey);
      expect(text.length, `${lng}: Text ist kein Kapitel, sondern ein Schlagwort`).toBeGreaterThan(
        200,
      );
    }
  });

  it("C2: die drei Fassungen unterscheiden sich paarweise — Titel UND Text", async () => {
    const titel: string[] = [];
    const texte: string[] = [];
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      titel.push(i18n.t(kapitel().titleKey));
      texte.push(i18n.t(kapitel().bodyKey));
    }
    expect(new Set(titel).size, "zwei Sprachen tragen denselben Titel").toBe(SPRACHEN.length);
    expect(new Set(texte).size, "zwei Sprachen tragen denselben Text").toBe(SPRACHEN.length);
  });

  it("C3: jede Fassung sagt ausdrücklich, was NICHT automatisch passiert", async () => {
    // `captureFromFile.ts:1-4`: „NICHTS wird automatisch gespeichert." Dieser Satz ist der Kern des
    // Versprechens und darf in keiner Sprache wegrutschen.
    const pflicht: Readonly<Record<(typeof SPRACHEN)[number], string>> = {
      de: "ohne dein Zutun",
      en: "without your action",
      nl: "zonder jouw toedoen",
    };
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      expect(i18n.t(kapitel().bodyKey), `${lng}: die Nicht-Zusage fehlt`).toContain(pflicht[lng]);
    }
  });

  it("C4: im Kapiteltext steht KEINE Zahl — Grenzen kommen vom Server, nicht aus dem Text", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      expect(
        i18n.t(kapitel().bodyKey),
        `${lng}: der Text nennt eine Zahl — sie wird beim nächsten Admin-Wechsel zur Falschaussage`,
      ).not.toMatch(/\d/);
      expect(i18n.t(kapitel().titleKey), `${lng}: der Titel nennt eine Zahl`).not.toMatch(/\d/);
    }
  });

  it("C5: keine zeitabhängige oder negative Bestandsaussage (Auftrag §9)", async () => {
    const verboten = [
      "derzeit",
      "aktuell unterstützt",
      "keine weiteren Formate",
      "currently",
      "no other formats",
      "momenteel",
      "geen andere formaten",
    ];
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      const text = `${i18n.t(kapitel().titleKey)} ${i18n.t(kapitel().bodyKey)}`.toLowerCase();
      for (const wort of verboten) {
        expect(text, `${lng}: verbotene Formulierung „${wort}“`).not.toContain(wort);
      }
    }
  });
});

describe("JOB 3468 · Q — der Wächter gegen das stille Auseinanderlaufen der Dateiarten", () => {
  it("Q1: die Erhebung aus `extract.ts` ist am Verhalten belegt — jede Art hat ihre Probe", () => {
    const arten = erhobeneDateiarten();
    // Ohne diese Kalibrierung wäre Q2 auch dann grün, wenn die Erhebung nichts fände.
    expect(arten.length, "die Erhebung aus extract.ts findet keine Dateiarten").toBeGreaterThan(4);
    expect(
      [...arten].sort(),
      "Erhebung und Probenliste laufen auseinander — neue Dateiart ohne Probe?",
    ).toEqual(Object.keys(PROBEN).sort());
    for (const art of arten) {
      const probe = PROBEN[art];
      if (!probe) {
        throw new Error(`keine Probe für die erhobene Dateiart \`${art}\``);
      }
      expect(detectFileKind(probe), `die Probe für \`${art}\` ergibt eine andere Art`).toBe(art);
    }
  });

  it("Q2: jede erhobene Dateiart ist im neuen Kapitel auffindbar", () => {
    for (const art of erhobeneDateiarten()) {
      expect(
        treffer(art),
        `die Dateiart \`${art}\` aus extract.ts ist in der Hilfe nicht auffindbar`,
      ).toContain(KAPITEL);
    }
  });

  it("Q3: `unsupported` ist keine Dateiart und wird auch nicht als Merkmal geführt", () => {
    expect(erhobeneDateiarten(), "`unsupported` gilt plötzlich als unterstützt").not.toContain(
      "unsupported",
    );
    expect(kapitel().tags.map((t) => t.toLowerCase())).not.toContain("unsupported");
  });
});

describe("JOB 3468 · R — die Route ist belegt, nicht geraten", () => {
  it("R1: `to` ist genau die vorhandene Adresse des Weges „Datei importieren“", () => {
    // Beide Hälften sind GELESEN: die Route aus der Registry (`app/navigation.ts`), der Wegwert aus
    // `components/erfassen/wege.ts` — dieselben zwei Quellen, aus denen `ImportSourceGallery.tsx`
    // (Zeile 77-79) dieselbe Adresse baut. Verschiebt sich eine von beiden, wird dieser Fall rot.
    const erfassen = ALL_ITEMS.find((item) => item.id === "erfassen")?.path;
    expect(erfassen, "die Registry kennt den Eintrag `erfassen` nicht mehr").toBe("/erfassen");
    expect(BLATT_WEG_DATEI, "`datei` ist kein Weg des Menüs mehr").toBe("datei");
    expect(kapitel().to).toBe(
      `${erfassen}?${BLATT_WEG_PARAMETER}=${encodeURIComponent(BLATT_WEG_DATEI ?? "")}`,
    );
  });

  it("R2: es ist eine interne Route, kein externer Link und kein erfundener Parameter", () => {
    expect(kapitel().to.startsWith("/")).toBe(true);
    expect(kapitel().to).not.toMatch(/^https?:/);
    // Genau EIN Parameter, und es ist der vorhandene.
    const [, abfrage = ""] = kapitel().to.split("?");
    expect([...new URLSearchParams(abfrage).keys()]).toEqual([BLATT_WEG_PARAMETER]);
  });
});

describe("JOB 3468 · V — der bestehende Bestand bleibt unberührt", () => {
  it("V1: HELP_TOPICS führt elf Kapitel mit eindeutigen IDs und internen Routen", () => {
    expect(HELP_TOPICS).toHaveLength(11);
    expect(new Set(HELP_TOPICS.map((t) => t.id)).size).toBe(11);
    for (const topic of HELP_TOPICS) {
      expect(topic.to.startsWith("/"), `${topic.id}: keine interne Route`).toBe(true);
      expect(topic.tags.length, `${topic.id}: ohne Merkmale`).toBeGreaterThan(0);
    }
  });

  it("V2: eine bestehende Suche liefert weiterhin GENAU ihre bisherigen Kapitel", () => {
    // Ein zu breites Merkmal (etwa `wissen`) würde fremde Suchen verwässern. „bibliothek“ ist die
    // Stichprobe dafür: sie traf vor diesem Job genau `library` und muss es danach wieder tun.
    expect(treffer("bibliothek")).toEqual(["library"]);
    expect(treffer("pwa")).toEqual(["mobile"]);
    expect(treffer("zzz-gibt-es-nicht")).toEqual([]);
  });

  it("V3: die Seitenhilfe des Zahnrads bleibt eindeutig — kein zweites Kapitel je Menü-Route", () => {
    // `navHilfeFor` rechnet „genau EIN Kapitel je Route" (JOB 3028). Ein Kapitel mit `to:
    // "/erfassen"` hätte dem Erfassen-Menüpunkt still seinen Erklärsatz gekostet.
    for (const item of ALL_ITEMS) {
      expect(
        HELP_TOPICS.filter((t) => t.to === item.path).length,
        `${item.path} trägt jetzt mehr als ein Kapitel`,
      ).toBeLessThanOrEqual(1);
    }
    expect(navHilfeFor("/erfassen")).toEqual({
      titleKey: "help.capture.title",
      bodyKey: "help.capture.body",
    });
  });

  it("V4: kein ISO-Kapitel, keine zweite Kapitelquelle", () => {
    expect(ISO_HELP_TOPICS.map((t) => t.id)).not.toContain(KAPITEL);
    expect(lies("apps/web/src/lib/helpTopics.iso.ts")).not.toContain(KAPITEL);
  });
});

describe("JOB 3468 · S — EIN Suchraum, EINE Suchregel, kein Sonderfall", () => {
  const HELP_TSX = lies("apps/web/src/pages/Help.tsx");

  it("S1: `filterHelpTopics` wird genau einmal gerufen und kennt keinen Sonderfall", () => {
    expect(HELP_TSX.match(/filterHelpTopics\(/g) ?? []).toHaveLength(1);
    const filterQuelle = lies("apps/web/src/lib/helpTopics.ts");
    expect(
      filterQuelle.slice(filterQuelle.indexOf("export function filterHelpTopics")),
      "der Filter kennt jetzt eine Kapitel-Kennung — das wäre ein Sonderfall",
    ).not.toContain(KAPITEL);
  });

  it("S2: die Seite kennt die Kennung des Kapitels nicht — der Zusatz hängt an den DATEN", () => {
    // Wie beim ISO-Kapitel („erkennt man an seinen externen Quellen — nicht an seiner ID",
    // `Help.tsx:127`): der Grenzen-Zusatz hängt am Merkmal `uploadLimits` des Kapitels, nicht an
    // einem in die Seite geschriebenen `fileimport`.
    expect(HELP_TSX, "die Seite führt einen Sonderfall auf die Kennung").not.toContain(
      `"${KAPITEL}"`,
    );
    expect(kapitel().uploadLimits, "das Kapitel fordert den Grenzen-Zusatz nicht an").toBe(true);
    expect(
      HELP_TOPICS.filter((t) => t.uploadLimits === true).map((t) => t.id),
      "mehr als ein Kapitel verlangt den Grenzen-Zusatz",
    ).toEqual([KAPITEL]);
  });

  it("S3: die Kartenklassen bleiben LITERAL — keine dritte, zur Laufzeit gebaute Klasse", () => {
    // `Help.tsx:206-235` schreibt aus, warum: der Klassenbindungs-Sammler
    // (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) kann eine erst zur Laufzeit entstehende
    // Klasse nicht auflösen und wird rot. Zweig statt bedingter Klassenname.
    expect(HELP_TSX).toContain('className="flex flex-col"');
    expect(HELP_TSX).toContain('className="flex flex-col sm:col-span-2"');
  });

  it("S4: der Kapiteltext nennt keine Grenzenzahl, weil die Anzeige sie vom Server holt", () => {
    // Die EINE Anzeige dafür ist `UploadLimitsHint` (`components/UploadLimitsHint.tsx:8-15`:
    // fest verdrahtete Zahlen im Frontend sind verboten). Die Seite benutzt sie, statt eine
    // zweite Darstellung derselben Werte zu bauen.
    expect(HELP_TSX).toContain("<UploadLimitsHint");
    expect(HELP_TSX, "die Seite rechnet selbst an den Grenzen").not.toContain("useUploadLimits");
    expect(HELP_TSX, "die Seite baut einen zweiten Grenzen-Text").not.toContain(
      "capture.uploadLimits",
    );
  });
});
