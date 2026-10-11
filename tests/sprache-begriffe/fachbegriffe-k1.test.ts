// ================================================================================================
// AUFNAHME gesamt-sprache-begriffe · K1 (R-0908) / K8 (R-0988) — FACHWÖRTER IN DER OBERFLÄCHE.
// ================================================================================================
//
// R-0908 verlangt: „Control Room, Query Console, Expert Studio, Dokument-Canvas, Knowledge Object,
// Trust, Ask, Reasoner, Output Factory, Quorum, Bus-Faktor — alles, was ein Fachmann liebt und eine
// Erstnutzerin bremst, wird übersetzt oder beim ersten Auftreten in einem Halbsatz erklärt."
//
// Diese Datei hält vier Dinge fest:
//
//   A  Der Hinweis der Web-Suche-Pille in der Kopfzeile sagt nicht mehr „Reasoner"
//      (`texte/websuche.ts`), am ECHTEN Pfad: Ableitung der Pille und initialisiertes i18next.
//   B  Kein ausgelieferter Text, den eine Fläche liest, trägt einen Produktnamen aus R-0908 oder
//      „Reasoner"/„KO(s)" — in DE, EN und NL, ohne Ausnahmeliste.
//   C  Die ABGELÖSTEN Schlüssel (deren alte Werte unverändert im Grundbestand stehen, weil
//      Umzugsnachweis und Byte-Abgleich sie festhalten) liest keine Fläche mehr. Das ist der Grund,
//      warum B sie überspringen darf — und C macht diesen Grund prüfbar statt behauptet.
//   D  „Bus-Faktor 1" erscheint nur noch MIT Erklärung (`fachwort.einzelperson.*`).
//
// AUSDRÜCKLICH NICHT HIER: „Trust" und „Ask" sind im Englischen gewöhnliche Wörter und stecken in
// Platzhaltern (`{{trust}}`); „Trust" bewacht `tests/app/mega52-vertrauenswert-sammler.test.ts`.
// „Evidence" ist im Englischen das Wort selbst; im Deutschen ist es an den abgelösten Stellen durch
// „Beleg" ersetzt, ein eigener Wortwächter dafür ist nicht Gegenstand von R-0908.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { externalStagePill } from "../../apps/web/src/lib/externalStagePill";
import websuche from "../../apps/web/src/texte/websuche";
import { repoPfad } from "../support/repoPfad";

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const HINWEIS = "websuche.hinweis";

/** Die echten Laufzeitressourcen — dieselben Strings, die die Oberfläche ausliefert. */
function bundle(lng: Sprache): Record<string, unknown> {
  const b = i18n.getResourceBundle(lng, "translation") as Record<string, unknown> | undefined;
  if (!b || Object.keys(b).length === 0) {
    throw new Error(`Sprachbestand fehlt oder ist leer: ${lng}`);
  }
  return b;
}

const MODUL: Record<Sprache, Record<string, string>> = {
  de: websuche.de,
  en: websuche.en,
  nl: websuche.nl,
};

/** Was das KI-Modell in der jeweiligen Sprache heißt — so wie die übrige Kopfzeile es nennt. */
const KI_MODELL: Record<Sprache, string> = { de: "KI-Modell", en: "AI model", nl: "AI-model" };

describe("K1 · A — der Hinweis der Web-Suche-Pille sagt nicht mehr „Reasoner“", () => {
  it("A-1: jede Stufe der Pille verweist auf den neuen Hinweis", () => {
    const stufen = ["blocked", "open", "search_on_click", "search_attach", undefined] as const;
    for (const stufe of stufen) {
      expect(externalStagePill(stufe).hintKey, String(stufe)).toBe(HINWEIS);
    }
  });

  it.each(SPRACHEN)("A-2 (%s): der ausgelieferte Hinweis ist Text ohne das Fachwort", (lng) => {
    const text = i18n.getFixedT(lng)(HINWEIS);
    expect(text, `${lng}: roher Schlüssel statt Text`).not.toBe(HINWEIS);
    expect(text.length).toBeGreaterThan(40);
    expect(text).not.toMatch(/reasoner/i);
    // Positiv statt nur „nicht": der Satz nennt das KI-Modell mit dem Wort der übrigen Kopfzeile.
    expect(text).toContain(KI_MODELL[lng]);
  });

  it.each(SPRACHEN)("A-3 (%s): die Laufzeit liefert den Wortlaut des Textmoduls", (lng) => {
    // Sonst wäre A-2 auch grün, wenn ein anderer Bestand denselben Schlüssel überdeckte.
    expect(bundle(lng)[HINWEIS]).toBe(MODUL[lng][HINWEIS]);
  });

  it("A-4: die drei Sprachen sind wirklich drei Sätze — keiner fiel auf Deutsch zurück", () => {
    const werte = SPRACHEN.map((lng) => i18n.getFixedT(lng)(HINWEIS));
    expect(new Set(werte).size).toBe(3);
  });
});

// ------------------------------------------------------------------------------------------------
// Die abgelösten Schlüssel — ihre alten Werte bleiben im Grundbestand stehen, gelesen werden sie
// von keiner Fläche mehr (Fall C). Ersatz in `texte/fachwort.ts`, `texte/websuche.ts`,
// `texte/beispielfragen.ts`.
// ------------------------------------------------------------------------------------------------

const QM_HINWEISE = [
  "modelrun-errors",
  "modelrun-fallbacks",
  "reasoner-demo",
  "provenance-no-evidence",
  "evidence-outdated",
  "evidence-missing",
  "provenance-lineage",
  "evidence-empty",
  "health-detection-unproven",
  "health-critical",
  "health-mittel",
  "all-clear",
] as const;

const ABGELOEST: readonly string[] = [
  "conf.help",
  "adm.seedHint",
  "topbar.external.hint",
  "ask.placeholder",
  "ask.example.filter",
  "ask.example.dosing",
  "mrun.title",
  "mrun.empty",
  "rcfg.title",
  "kos.hintsTitle",
  ...QM_HINWEISE.flatMap((id) => [`kos.hint.${id}.title`, `kos.hint.${id}.detail`]),
  "evx.title",
  "evx.empty",
  "evx.koRef",
  "prov.title",
  "prov.total",
  "prov.withEvidence",
  "prov.noEvidence",
  "prov.counts",
  "prov.badge.no-evidence",
  "evFresh.title",
  "evFresh.subtitle",
  "evFresh.empty",
  // Schon vor dieser Aufnahme von keiner Fläche gelesen („KO öffnen").
  "evFresh.openKo",
  "ext.finding.acceptedKo",
  "risk.horizon.busFactorOne",
  "mgmt.prio.filter.busFactorOne",
  "mgmt.prio.flag.busFactorOne",
  "readiness.title",
  "shelp.cycle.title",
  "health.title",
];
const ABGELOEST_MENGE = new Set(ABGELOEST);

// ------------------------------------------------------------------------------------------------
// B — die Fachwörter aus R-0908
// ------------------------------------------------------------------------------------------------

interface Begriff {
  readonly id: string;
  readonly muster: RegExp;
  /** In welchen Sprachen das Wort fremd ist. „knowledge object" ist im Englischen das Wort selbst. */
  readonly sprachen: readonly Sprache[];
}

const BEGRIFFE: readonly Begriff[] = [
  { id: "control room", muster: /control\s+room/i, sprachen: SPRACHEN },
  { id: "query console", muster: /query\s+console/i, sprachen: SPRACHEN },
  { id: "expert studio", muster: /expert\s+studio/i, sprachen: SPRACHEN },
  { id: "dokument-canvas", muster: /dokument-canvas|document\s+canvas/i, sprachen: SPRACHEN },
  { id: "output factory", muster: /output\s+factory/i, sprachen: SPRACHEN },
  { id: "quorum", muster: /\bquorum\b/i, sprachen: SPRACHEN },
  // `\b` hält Umgebungsnamen wie KLARWERK_REASONER_POLICY heraus: der Unterstrich ist ein Wortzeichen.
  { id: "reasoner", muster: /\breasoner\b/i, sprachen: SPRACHEN },
  // „KO" ist die Abkürzung von „Knowledge Object" — als ganzes Wort, mit „KOs" und „KO's".
  { id: "ko", muster: /\bKO(?:'s|s)?\b/, sprachen: SPRACHEN },
  { id: "knowledge object", muster: /knowledge\s+object/i, sprachen: ["de"] },
  // Dieselbe Familie auf der QM-Fläche und der Starthilfe: Produkt-Innensprache, kein Anwenderwort.
  { id: "knowledge-os", muster: /\bknowledge[- ]os\b/i, sprachen: SPRACHEN },
  { id: "knowledge-health", muster: /\bknowledge[- ]health\b/i, sprachen: SPRACHEN },
  { id: "foundation-signal", muster: /\bfoundation[- ]signal/i, sprachen: SPRACHEN },
];

/** Platzhalter tragen Bezeichner, keine Anzeigewörter (`{{trust}}`) — sie zählen nicht. */
const ohnePlatzhalter = (text: string): string => text.replace(/\{\{[^}]*\}\}/g, "");

function funde(lng: Sprache, quelle: Record<string, unknown>): string[] {
  const treffer: string[] = [];
  for (const [schluessel, wert] of Object.entries(quelle)) {
    if (typeof wert !== "string" || ABGELOEST_MENGE.has(schluessel)) continue;
    const text = ohnePlatzhalter(wert);
    for (const b of BEGRIFFE) {
      if (b.sprachen.includes(lng) && b.muster.test(text)) {
        treffer.push(`${lng}:${schluessel}:${b.id}`);
      }
    }
  }
  return treffer;
}

describe("K1 · B — kein gelesener Text trägt ein Fachwort aus R-0908", () => {
  it("B-1: über alle drei Laufzeitbestände — keine Ausnahme", () => {
    const alle = SPRACHEN.flatMap((lng) => funde(lng, bundle(lng))).sort();
    expect(alle, alle.join("\n")).toEqual([]);
  });

  it("B-2: Kalibrierung — der Bestand ist nicht leer, der Wächter prüft wirklich etwas", () => {
    for (const lng of SPRACHEN) {
      const texte = Object.values(bundle(lng)).filter((v) => typeof v === "string");
      expect(texte.length, `Sprache ${lng} liefert kaum Texte`).toBeGreaterThan(1000);
    }
    // Und die abgelösten Werte SIND im Bestand — ohne Fall C wäre B an ihnen blind.
    expect(String(bundle("de")["conf.help"])).toContain("Output Factory");
    expect(String(bundle("de")["mrun.title"])).toContain("Reasoner");
  });

  it("B-3: Rotnachweis — jeder Begriff würde in seiner Sprache gefunden", () => {
    for (const b of BEGRIFFE) {
      for (const lng of b.sprachen) {
        const wort = b.id === "ko" ? "KOs" : b.id.toUpperCase();
        const probe = { "probe.schluessel": `Weiter zu ${wort} — jetzt.` };
        const erwartet = [`${lng}:probe.schluessel:${b.id}`];
        expect(funde(lng, probe), `${b.id} in ${lng}`).toEqual(erwartet);
      }
    }
  });

  it("B-4: keine Fehltreffer an Platzhaltern, Umgebungsnamen und Wortteilen", () => {
    const probe = {
      "probe.platzhalter": "Stand {{quorum}} erreicht",
      "probe.umgebung": "per Deploy-Konfiguration (KLARWERK_REASONER_POLICY) festgelegt",
      "probe.wortteil": "Kosten und Koordination",
    };
    expect(funde("de", probe)).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// C — die abgelösten Schlüssel liest keine Fläche mehr
// ------------------------------------------------------------------------------------------------

/** Alle Quelltexte der Oberfläche ausser Wörterbüchern, Textmodulen und Tests. */
function oberflaechenQuellen(): { datei: string; zeilen: string[] }[] {
  const wurzel = repoPfad("apps/web/src");
  const gefunden: { datei: string; zeilen: string[] }[] = [];
  const gehe = (relativ: string): void => {
    for (const e of readdirSync(join(wurzel, relativ), { withFileTypes: true })) {
      const pfad = relativ === "" ? e.name : `${relativ}/${e.name}`;
      if (e.isDirectory()) {
        if (pfad !== "woerterbuch" && pfad !== "texte") gehe(pfad);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) {
        gefunden.push({
          datei: pfad,
          zeilen: readFileSync(join(wurzel, pfad), "utf8").split("\n"),
        });
      }
    }
  };
  gehe("");
  return gefunden;
}

const istKommentar = (zeile: string): boolean => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(zeile);

describe("K1 · C — die abgelösten Schlüssel liest keine Fläche mehr", () => {
  it("C-1: kein Quelltext der Oberfläche nennt einen abgelösten Schlüssel als Zeichenkette", () => {
    const quellen = oberflaechenQuellen();
    expect(quellen.length, "die Oberfläche hat keine Quelltexte — falscher Ordner").toBeGreaterThan(
      100,
    );
    const treffer: string[] = [];
    for (const { datei, zeilen } of quellen) {
      for (let i = 0; i < zeilen.length; i += 1) {
        const zeile = zeilen[i] ?? "";
        if (istKommentar(zeile)) continue;
        for (const schluessel of ABGELOEST) {
          if (!zeile.includes(`"${schluessel}"`) && !zeile.includes(`'${schluessel}'`)) continue;
          // Die Hilfe-Registry führt den alten Schlüssel als KENNUNG (`sec:<key>`, `shelp.<key>`)
          // weiter — zulässig nur mit einem Anzeigetitel aus `texte/fachwort.ts` daneben.
          if (datei === "lib/klaraRegistry.ts" && zeile.includes('titel: "fachwort.')) continue;
          treffer.push(`${datei}:${i + 1} ${schluessel}`);
        }
      }
    }
    expect(treffer, treffer.join("\n")).toEqual([]);
  });

  it("C-2: die Ersatzschlüssel sind wirklich verdrahtet (Stichprobe je Fläche)", () => {
    const quelle = (datei: string): string => readFileSync(repoPfad(datei), "utf8");
    expect(quelle("apps/web/src/components/erfassen/hilfe.ts")).toContain(
      '"fachwort.vertraulichkeit.hilfe"',
    );
    expect(quelle("apps/web/src/pages/AdminDatenDetails.tsx")).toContain(
      '"fachwort.demodaten.hinweis"',
    );
    expect(quelle("apps/web/src/pages/Stufe2.tsx")).toContain('"fachwort.kiLaeufe.titel"');
    expect(quelle("apps/web/src/pages/Stufe2.tsx")).toContain('"fachwort.fund.angelegt"');
    expect(quelle("apps/web/src/lib/knowledgeOsHints.ts")).toContain(
      '"fachwort.qm.reasoner-demo.titel"',
    );
    expect(quelle("apps/web/src/components/RisikoHorizont.tsx")).toContain(
      '"fachwort.einzelperson.risiko"',
    );
    expect(quelle("apps/web/src/lib/startHelp.ts")).toContain('"fachwort.kreis.titel"');
    expect(quelle("apps/web/src/pages/Stufe2.tsx")).toContain('"fachwort.bereitschaft.titel"');
    expect(quelle("apps/web/src/pages/Analytics.tsx")).toContain('"fachwort.gesundheit.titel"');
  });

  it("C-3: Kalibrierung — ein noch gelesener Altschlüssel würde gefunden", () => {
    const zeile = '          {t("mrun.title")}';
    expect(istKommentar(zeile)).toBe(false);
    expect(ABGELOEST.some((k) => zeile.includes(`"${k}"`))).toBe(true);
    expect(istKommentar('  // früher t("mrun.title")')).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// E — K16 (R-1176) für die neuen Texte: ein zitierter Knopf heißt zeichengleich so
// ------------------------------------------------------------------------------------------------

describe("K16 · E — der neue Demodaten-Hinweis zitiert den Knopf zeichengleich", () => {
  it.each(SPRACHEN)("E-1 (%s): der Hinweis zitiert den Entfernen-Knopf zeichengleich", (lng) => {
    const t = i18n.getFixedT(lng);
    const knopf = t("adm.purgeButton");
    expect(knopf, `${lng}: roher Schlüssel`).not.toBe("adm.purgeButton");
    expect(t("fachwort.demodaten.hinweis")).toContain(knopf);
  });
});

// ------------------------------------------------------------------------------------------------
// D — „Bus-Faktor 1" nur mit Erklärung
// ------------------------------------------------------------------------------------------------

describe("K1 · D — „Bus-Faktor 1“ steht nur noch mit Erklärung da", () => {
  it.each(SPRACHEN)("D-1 (%s): Filter und Risikozeile erklären den Begriff zuerst", (lng) => {
    const t = i18n.getFixedT(lng);
    const erklaerung: Record<Sprache, RegExp> = {
      de: /^Nur eine Person/,
      en: /^Only one person/,
      nl: /^Slechts één persoon/,
    };
    for (const key of ["fachwort.einzelperson.filter", "fachwort.einzelperson.risiko"]) {
      expect(t(key), `${lng}:${key}`).toMatch(erklaerung[lng]);
      expect(t(key), `${lng}:${key}`).toMatch(/bus[- ]?fa[ck]tor 1/i);
    }
    expect(t("fachwort.einzelperson.markierung")).not.toMatch(/bus/i);
  });
});
