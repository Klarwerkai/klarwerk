// ================================================================================================
// R-1176 · WAS EIN TEXT ALS BESCHRIFTUNG ZITIERT, STEHT SO AUF DER OBERFLÄCHE — IN DE, EN UND NL.
// ================================================================================================
//
// Auftrag gesamt-sprache-begriffe, K16. Bens Befund (Nacharbeit 4): der bisherige Beleg E-1 in
// `tests/sprache-begriffe/fachbegriffe-k1.test.ts` prüfte genau EINEN Hinweis. Dieser Wächter
// prüft den ganzen Katalog zur Laufzeit (Grundbestand + Textmodule, wie i18next ihn ausliefert):
//
//   1. Jedes deutsche Zitat „…" (höchstens 60 Zeichen) eines Textes, das WORTGLEICH der deutsche
//      Wert eines ANDEREN Schlüssels ist (höchstens 60 Zeichen, ohne Platzhalter), gilt als
//      zitierte Beschriftung.
//   2. Die englische und die niederländische Fassung desselben Textes müssen die englische bzw.
//      niederländische Fassung mindestens EINES solchen Schlüssels zeichengleich enthalten.
//
// Was er NICHT kann, ehrlich: Er erkennt ein Zitat nur, wenn der deutsche Wortlaut mit einer
// Beschriftung übereinstimmt. Ein deutsches Zitat, das schon im Deutschen vom Knopf abweicht, fällt
// durch (Beispiel unten: `capture.file.connectHint` zitiert „Übernehmen", der Knopf heißt
// „Ausgewählte übernehmen"). Und ein zufällig gleich lautendes Wort, das gar keinen Knopf meint,
// wird als Zitat gelesen — die Liste BEKANNT trennt beides und nennt den Grund je Eintrag.
// Prüfkarten liegen nicht in diesem Repository; Anleitungen unter `docs/` sind nur deutsch und
// werden hier nicht gelesen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { reviewHelp } from "../../apps/web/src/lib/reviewHelp";

type Katalog = Record<string, unknown>;

const ZITAT = /[„“"‚‘«»]([^„“"”‚‘’«»]+)[“”"‘’«»]/g;
const HOECHSTLAENGE = 60;

/** Deutscher Wortlaut → alle Schlüssel, die genau so beschriftet sind. */
function beschriftungsIndex(de: Katalog): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [key, wert] of Object.entries(de)) {
    if (typeof wert !== "string" || wert.length === 0 || wert.length > HOECHSTLAENGE) {
      continue;
    }
    if (wert.includes("{{")) {
      continue;
    }
    index.set(wert, [...(index.get(wert) ?? []), key]);
  }
  return index;
}

function enthaelt(text: string, beschriftung: unknown): boolean {
  return typeof beschriftung === "string" && beschriftung !== "" && text.includes(beschriftung);
}

/** Jede Abweichung als „Schlüssel · Sprache · deutsches Zitat", sortiert und ohne Doppel. */
function zitatAbweichungen(
  de: Katalog,
  fremd: Record<string, Katalog>,
  ausgenommen: ReadonlySet<string> = new Set(),
): string[] {
  const index = beschriftungsIndex(de);
  const funde = new Set<string>();
  for (const [key, wert] of Object.entries(de)) {
    if (typeof wert !== "string" || ausgenommen.has(key)) {
      continue;
    }
    for (const treffer of wert.matchAll(ZITAT)) {
      const zitat = treffer[1] ?? "";
      const knoepfe = (index.get(zitat) ?? []).filter((k) => k !== key);
      if (zitat.length > HOECHSTLAENGE || knoepfe.length === 0) {
        continue;
      }
      for (const [lng, katalog] of Object.entries(fremd)) {
        const text = katalog[key];
        if (typeof text !== "string") {
          continue;
        }
        if (!knoepfe.some((k) => enthaelt(text, katalog[k]))) {
          funde.add(`${key} · ${lng} · ${zitat}`);
        }
      }
    }
  }
  return [...funde].sort();
}

const katalog = (lng: string): Katalog => i18n.getResourceBundle(lng, "translation") as Katalog;

// Abgelöst in dieser Runde: der Grundbestand steht unter Prüfsumme
// (`tests/i18n-textmodule/bestand-unveraendert.test.ts`), die berichtigte Fassung liegt in
// `apps/web/src/texte/knopfzitat.ts`; der alte Schlüssel wird nicht mehr gelesen.
const ABGELOEST: ReadonlyArray<{ alt: string; neu: string; datei: string; knopf: string }> = [
  {
    alt: "pilot.check.maintain",
    neu: "knopfzitat.pilot.pflegen",
    datei: "lib/pilotChecklist.ts",
    knopf: "cycle.maintain.label",
  },
  {
    alt: "pilot.obs.outdated.map",
    neu: "knopfzitat.pilot.veraltet",
    datei: "lib/pilotObservationGuide.ts",
    knopf: "cycle.maintain.label",
  },
  {
    alt: "stage2.gate.body",
    neu: "knopfzitat.stufe2.hinweis",
    datei: "components/Stage2Notice.tsx",
    knopf: "start.menu.stufe2",
  },
  {
    alt: "seitenhilfe.admin.audit.text",
    neu: "knopfzitat.admin.audit",
    datei: "pages/AdminDatenDetails.tsx",
    knopf: "adm.sec.sicherheit",
  },
  {
    alt: "seitenhilfe.admin.bereitschaft.text",
    neu: "knopfzitat.admin.bereitschaft",
    datei: "pages/AdminSicherheitDetails.tsx",
    knopf: "einst.wert.nichtAbrufbar",
  },
  {
    alt: "wb.grenze.widerspricht",
    neu: "knopfzitat.wb.widerspricht",
    datei: "components/WissensbeziehungenBereich.tsx",
    knopf: "wb.art.widerspricht",
  },
  {
    alt: "wb.grenze.ersetzt",
    neu: "knopfzitat.wb.ersetzt",
    datei: "components/WissensbeziehungenBereich.tsx",
    knopf: "wb.art.ersetzt",
  },
  {
    alt: "vhelp.reject.body",
    neu: "knopfzitat.vhelp.reject",
    datei: "lib/reviewHelp.ts",
    knopf: "ko.reportConflict",
  },
  {
    alt: "vhelp.assign.body",
    neu: "knopfzitat.vhelp.assign",
    datei: "lib/reviewHelp.ts",
    knopf: "val.filterMine",
  },
  {
    alt: "vhelp.contribution.body",
    neu: "knopfzitat.vhelp.contribution",
    datei: "lib/reviewHelp.ts",
    knopf: "vhelp.sourceAdd.title",
  },
];

// Was nach dieser Runde bleibt — je Eintrag an Schlüssel, Sprache und deutsches Zitat gebunden.
// Ein neuer Fund, der hier nicht steht, macht den Wächter rot.
const BEKANNT: Record<string, string> = {
  // ---- ECHTE ABWEICHUNGEN, hier nicht berichtigt -------------------------------------------
  "help.lifecycle.body · en · Anlage geändert …":
    "OFFEN, Produktentscheidung: der Knopf heißt englisch „Asset changed …“ (lcy.assetToggle); die englische Hilfe vermeidet „asset“ bewusst als Fachwort (Altkapitel-Wächter). Welches Wort gilt, ist nicht entschieden.",
  "help.capture.body · en · Prüfen & einreichen":
    "OFFEN, gesperrt: englisch „the final check“ statt „Review & submit“. Der Grundwert steht unter Prüfsumme, und der Kapitelschlüssel ist auf help.<id>.body festgelegt (seitenhilfe-navkapitel, Altkapitel-Wächter) — umhängen bräche beide.",
  "capture.file.connectHint · en · Übernehmen":
    "OFFEN, schon deutsch ungenau: der Knopf heißt „Ausgewählte übernehmen“ (capture.file.applyCta); „Übernehmen“ trifft zufällig andere Knöpfe. Englisch „Take over“ — richtiger Wortlaut erst nach deutscher Klärung.",
  // ---- ZUFALLSTREFFER: das zitierte Wort ist kein Knopf dieses Namens ----------------------
  "topbar.plain.reasoner · en · Ungeprüft":
    "Zufallstreffer: gemeint ist der Zustand „KI-Modell ungeprüft“ (topbar.reasonerUnverified), nicht die Wissensklasse ask.knowledgeClass.ungeprueft. Deutsch zitiert verkürzt.",
  "topbar.plain.reasoner · nl · Ungeprüft":
    "Zufallstreffer: wie EN — gemeint ist topbar.reasonerUnverified, nicht die Wissensklasse.",
  "vhelp.sourcesLevel2.body · en · Stufe 2":
    "Zufallstreffer: gemeint ist das Quellen-Badge der Stufe-2-Quelle, nicht der Menüpunkt start.menu.stufe2 („Stage 2“).",
  "vhelp.sourcesLevel2.body · nl · Stufe 2":
    "Zufallstreffer: wie EN — Quellen-Badge, nicht der Menüpunkt („Stap 2“).",
  "vhelp.sourceSearch.body · en · Anhängen":
    "Zufallstreffer: gemeint ist der Knopf der Quellensuche, nicht capture.ai.append („Append“) der KI-Werkbank.",
  "vhelp.sourceSearch.body · nl · Anhängen":
    "Zufallstreffer: wie EN — nicht capture.ai.append („Toevoegen“).",
  "chelp.submitReview.body · en · in Prüfung":
    "Zufallstreffer: gemeint ist der Status nach dem Einreichen, nicht die Legende des Wissensnetzes (wissensnetz.farbe.offen „under review“).",
  "einstieg.knopf.einreichen · en · in Prüfung":
    "Zufallstreffer: wie chelp.submitReview — Status nach dem Einreichen, nicht die Wissensnetz-Legende.",
  "einstieg.knopf.einreichen · nl · in Prüfung":
    "Zufallstreffer: wie EN — nicht die Wissensnetz-Legende („in beoordeling“).",
};

const SRC = join(process.cwd(), "apps/web/src");

function quelldateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      return name === "woerterbuch" ? [] : quelldateien(pfad);
    }
    return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
  });
}

describe("R-1176 · zitierte Beschriftungen stimmen in allen drei Sprachen", () => {
  const ausgenommen = new Set(ABGELOEST.map((a) => a.alt));
  const funde = zitatAbweichungen(
    katalog("de"),
    { en: katalog("en"), nl: katalog("nl") },
    ausgenommen,
  );

  it("Z-1 kein Text zitiert eine Beschriftung anders, als sie dasteht — außer den benannten Resten", () => {
    expect(funde.filter((f) => !(f in BEKANNT))).toEqual([]);
  });

  it("Z-2 jeder benannte Rest ist an ein echtes deutsches Zitat gebunden und begründet", () => {
    const index = beschriftungsIndex(katalog("de"));
    for (const [eintrag, grund] of Object.entries(BEKANNT)) {
      const [key = "", lng = "", zitat = ""] = eintrag.split(" · ");
      expect(["en", "nl"], eintrag).toContain(lng);
      expect(String(katalog("de")[key] ?? ""), eintrag).toContain(zitat);
      expect(index.has(zitat), eintrag).toBe(true);
      expect(grund.length, eintrag).toBeGreaterThan(40);
    }
  });

  it("Z-3 die berichtigten Texte zitieren den Knopf in DE, EN und NL zeichengleich", () => {
    for (const { neu, knopf } of ABGELOEST) {
      for (const lng of ["de", "en", "nl"]) {
        const t = i18n.getFixedT(lng);
        expect(t(neu), `${neu} (${lng})`).not.toBe(neu);
        expect(t(neu), `${neu} (${lng}) zitiert ${knopf}`).toContain(t(knopf));
      }
      expect(funde.filter((f) => f.startsWith(`${neu} · `))).toEqual([]);
    }
  });

  it("Z-4 der alte Schlüssel wird nicht mehr gelesen, der neue an genau der Verbraucherstelle", () => {
    const dateien = quelldateien(SRC).map((pfad) => ({ pfad, inhalt: readFileSync(pfad, "utf8") }));
    for (const { alt, neu, datei } of ABGELOEST) {
      for (const { pfad, inhalt } of dateien) {
        expect(inhalt.includes(`"${alt}"`), `${pfad} liest noch ${alt}`).toBe(false);
      }
      expect(readFileSync(join(SRC, datei), "utf8")).toContain(`"${neu}"`);
    }
    expect(reviewHelp("reject").bodyKey).toBe("knopfzitat.vhelp.reject");
    expect(reviewHelp("assign").bodyKey).toBe("knopfzitat.vhelp.assign");
    expect(reviewHelp("contribution").bodyKey).toBe("knopfzitat.vhelp.contribution");
    expect(reviewHelp("approve").bodyKey).toBe("vhelp.approve.body");
  });

  it("Z-5 deutsch bleibt zeichengleich — einzige Ausnahme: „im Haus“ wird „intern“ (R-0975)", () => {
    const de = i18n.getFixedT("de");
    for (const { alt, neu } of ABGELOEST) {
      if (alt === "stage2.gate.body") {
        expect(de(alt)).toContain("im Haus „Stufe 2“ genannt");
        expect(de(neu)).toBe(de(alt).replace("im Haus „Stufe 2“", "intern „Stufe 2“"));
        continue;
      }
      expect(de(neu), neu).toBe(de(alt));
    }
  });

  it("Z-6 Rotprobe: ein klein geschriebenes englisches Zitat wird gefunden, das richtige nicht", () => {
    const de = {
      "probe.knopf": "Konflikt melden",
      "probe.hilfe": "Dann ist „Konflikt melden“ der bessere Weg.",
      "probe.frei": "Ein „Beispiel“ ohne Knopf und ein „{{name}}“ mit Platzhalter.",
      "probe.platzhalter": "{{name}}",
    };
    const nl = {
      "probe.knopf": "Conflict melden",
      "probe.hilfe": "Dan is „Conflict melden“ beter.",
    };
    const falsch = {
      "probe.knopf": "Report conflict",
      "probe.hilfe": "Then „report conflict“ is better.",
    };
    const richtig = {
      "probe.knopf": "Report conflict",
      "probe.hilfe": "Then “Report conflict” is better.",
    };
    const erwartet = ["probe.hilfe · en · Konflikt melden"];
    expect(zitatAbweichungen(de, { en: falsch, nl })).toEqual(erwartet);
    expect(zitatAbweichungen(de, { en: richtig, nl })).toEqual([]);
    // Ein ausgenommener (abgelöster) Text wird nicht mehr gelesen.
    expect(zitatAbweichungen(de, { en: falsch, nl }, new Set(["probe.hilfe"]))).toEqual([]);
  });
});
