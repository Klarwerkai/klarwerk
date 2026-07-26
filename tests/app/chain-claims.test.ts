import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { FAQ_CONTENT } from "../../apps/web/src/lib/faqContent";
import { SECURITY_POINTS } from "../../apps/web/src/lib/securityStatements";

// AUFTRAG-mega15 Block A (bens SB-1, ZWEITER Durchgang) — der Ehrlichkeitstest über die SICHTBARE
// FLÄCHE, nicht über ein Schlüsselpräfix.
//
// Die Lehre aus mega14: dort prüfte `tests/app/audit-verify-honesty.test.ts` ausschließlich
// `adm.sich.verify.*`. Der Ergebnistext war damit sauber — und direkt daneben stand auf DERSELBEN
// Admin-Seite weiter „Prüfprotokoll — manipulationssicher", „Manipulationssicheres Protokoll",
// „fälschungssicher", „forgery-proof", „manipulatiebestendig", „vervalsingsbestendig". Ein Präfix
// ist kein Prüfumfang. Wenn eine Auflage lautet „diese Aussage darf NIRGENDS mehr stehen", muss der
// Test genau das prüfen.
//
// Deshalb zwei Stufen:
//
//  STUFE 1 — die absoluten Behauptungen. Geprüft über den GESAMTEN Sprachbestand (alle Schlüssel,
//  DE/EN/NL) UND die FAQ-Antworten. Diese Wörter sind an KEINER Stelle des Produkts belegbar; ein
//  NEUER Schlüssel mit „manipulationssicher" macht diesen Test rot, egal wie er heißt. Genau das
//  ist der Punkt — sonst wiederholt sich der Fehler beim nächsten Text.
//
//  STUFE 2 — die weicheren Über-Aussagen („unveränderlich", „immutable", „onveranderlijk",
//  „unversehrt" …). Sie sind außerhalb der Kette manchmal legitim (eine unveränderliche Datei-ID
//  ist etwas anderes), deshalb gilt Stufe 2 auf der KETTEN-/SICHERHEITSFLÄCHE. Auch diese Auswahl
//  ist eine REGEL, kein Aufzählungsstand: jeder neue Schlüssel mit „audit" im Namen und jeder neue
//  `adm.sich.*`-Schlüssel fällt automatisch hinein.
//
// Warum überhaupt: die Kette hat keinen extern verankerten Kopf (lib/auditVerifyState.ts:14-16).
// Wer die Datenbank beherrscht, kann einen Eintrag samt aller Folgehashes neu bilden. Belegbar ist
// genau eine Eigenschaft — jede nachträgliche Änderung ist rechnerisch auffällig. Das ist stark,
// und die Oberfläche darf es sagen. „Sicher" ist sie nicht.

const LANGS = ["de", "en", "nl"] as const;
type Lang = (typeof LANGS)[number];

type Bundle = Record<string, string>;

function bundle(lang: Lang): Bundle {
  return i18n.getResourceBundle(lang, "translation") as Bundle;
}

// ---------------------------------------------------------------------------------------------
// STUFE 1: nirgends, in keiner Sprache, unter keinem Schlüssel.
// ---------------------------------------------------------------------------------------------
const ABSOLUTE_BEHAUPTUNGEN = [
  // DE
  "manipulationssicher",
  "manipulationssicherheit",
  "fälschungssicher",
  "faelschungssicher",
  "unfälschbar",
  "revisionssicher",
  // EN
  "tamper-proof",
  "tamperproof",
  "tamper proof",
  "forgery-proof",
  "forgeryproof",
  "forgery proof",
  // NL
  "manipulatiebestendig",
  "manipulatieveilig",
  "vervalsingsbestendig",
  "vervalsingsveilig",
] as const;

// ---------------------------------------------------------------------------------------------
// STUFE 2: auf der Ketten-/Sicherheitsfläche. „Es kann nichts passieren" in weicherer Form.
// ---------------------------------------------------------------------------------------------
const UEBER_AUSSAGEN = [
  // DE
  "unveränderlich",
  "unveränderbar",
  "unabänderlich",
  "unversehrt",
  "garantiert",
  "ausgeschlossen",
  // EN
  "immutable",
  "unalterable",
  "unaltered",
  "guaranteed",
  "cannot be changed",
  "can not be changed",
  // NL
  "onveranderlijk",
  "onveranderbaar",
  "ongeschonden",
  "gegarandeerd",
  "uitgesloten",
] as const;

// Die Fläche als REGEL, nicht als Aufzählung: der gesamte Vertrauen-&-Sicherheit-Block
// `adm.sich.*` und jeder Audit-Schlüssel der Admin-, Analytics- und Abschnittshilfe-Flächen. Jeder
// NEUE Schlüssel in einer dieser Familien fällt automatisch hinein.
//
// Bewusst NICHT über ein blosses /audit/ im Namen: `imp.cleanup.auditPendingCandidates` gehört zur
// Import-Aufräumung („von der Aufräumung ausgeschlossen") und behauptet nichts über die Kette. Ein
// Prüfumfang, der solche Fremdtreffer einsammelt, wird abgestumpft oder ausgehöhlt — beides ist
// schlechter als eine benannte, enge Familie. Die ABSOLUTEN Behauptungen (Stufe 1) gelten davon
// unberührt global.
const FLAECHEN_REGELN: readonly RegExp[] = [
  /^adm\.sich\./,
  /^adm\.audit/,
  /^ana\.[^.]*audit/i,
  /^ana\.help\.audit$/,
  /^shelp\..*audit/i,
];

const FLAECHE_EXTRA = ["klara.page.analytics"] as const;

function istKettenFlaeche(key: string): boolean {
  return (
    FLAECHEN_REGELN.some((re) => re.test(key)) || (FLAECHE_EXTRA as readonly string[]).includes(key)
  );
}

function flaechenEintraege(lang: Lang): [string, string][] {
  return Object.entries(bundle(lang)).filter(
    ([key, text]) => istKettenFlaeche(key) && typeof text === "string",
  );
}

// Der eigentliche Prüfer — als reine Funktion, damit derselbe Code sowohl auf den ECHTEN
// Sprachbestand als auch auf einen absichtlich vergifteten Bestand angesetzt werden kann. Genau
// das ist der Nachweis, dass die Prüfung greift und nicht ins Leere läuft.
interface Fund {
  key: string;
  wort: string;
  text: string;
}

function findeBehauptungen(
  eintraege: readonly (readonly [string, string])[],
  woerter: readonly string[],
): Fund[] {
  const funde: Fund[] = [];
  for (const [key, text] of eintraege) {
    const haystack = text.toLowerCase();
    for (const wort of woerter) {
      if (haystack.includes(wort)) {
        funde.push({ key, wort, text });
      }
    }
  }
  return funde;
}

function alleEintraege(lang: Lang): [string, string][] {
  return Object.entries(bundle(lang)).filter(([, text]) => typeof text === "string");
}

// Die FAQ liegt bewusst NICHT in i18n (DE-only bis Lieferung 3b, s. faqContent.ts) — sie ist
// trotzdem sichtbarer Text auf `/admin` und `/hilfe` und gehört deshalb in denselben Prüfumfang.
function faqEintraege(): [string, string][] {
  return FAQ_CONTENT.flatMap(
    (item) =>
      [
        [`${item.id}.question`, item.question],
        [`${item.id}.answer`, item.answer],
      ] as [string, string][],
  );
}

describe("Block A: absolute Ketten-Behauptungen stehen NIRGENDS mehr", () => {
  it("kein i18n-Schlüssel in DE/EN/NL behauptet Manipulations-/Fälschungssicherheit", () => {
    for (const lang of LANGS) {
      const funde = findeBehauptungen(alleEintraege(lang), ABSOLUTE_BEHAUPTUNGEN);
      expect(
        funde,
        funde.map((f) => `${lang} ${f.key}: „${f.wort}" in „${f.text}"`).join("\n"),
      ).toEqual([]);
    }
  });

  it("keine FAQ-Antwort behauptet Manipulations-/Fälschungssicherheit", () => {
    const funde = findeBehauptungen(faqEintraege(), ABSOLUTE_BEHAUPTUNGEN);
    expect(funde, funde.map((f) => `${f.key}: „${f.wort}"`).join("\n")).toEqual([]);
  });

  // DER NACHWEIS, dass die Prüfung greift: derselbe Prüfer, angesetzt auf den ECHTEN Bestand plus
  // EINEN eingeschmuggelten Schlüssel, muss anschlagen. Ohne diesen Fall wäre nicht belegt, dass
  // ein grüner Lauf etwas bedeutet.
  it("GEGENPROBE — ein neu eingefuegter Schluessel mit dem Wort manipulationssicher macht die Pruefung rot", () => {
    for (const lang of LANGS) {
      const vergiftet: [string, string][] = [
        ...alleEintraege(lang),
        // Bewusst ein Schlüssel OHNE „audit"/„sich" im Namen und in einer ganz anderen Fläche:
        // Stufe 1 hängt nicht am Namen, sondern am Wort.
        ["lib.someNewCard.title", "Unser Protokoll ist manipulationssicher."],
      ];
      const funde = findeBehauptungen(vergiftet, ABSOLUTE_BEHAUPTUNGEN);
      expect(funde).toHaveLength(1);
      expect(funde[0]?.key).toBe("lib.someNewCard.title");
      expect(funde[0]?.wort).toBe("manipulationssicher");
    }
    // Und derselbe Trick in EN und NL.
    for (const [wort, text] of [
      ["forgery-proof", "The trail is forgery-proof."],
      ["vervalsingsbestendig", "Het log is vervalsingsbestendig."],
      ["tamper-proof", "A tamper-proof record."],
    ] as const) {
      const funde = findeBehauptungen([["lib.someNewCard.body", text]], ABSOLUTE_BEHAUPTUNGEN);
      expect(funde.map((f) => f.wort)).toContain(wort);
    }
  });
});

describe("Block A: die Ketten-/Sicherheitsfläche verspricht keine Unveränderbarkeit", () => {
  it("die Fläche ist nicht leer und deckt die bekannten Träger ab", () => {
    for (const lang of LANGS) {
      const keys = flaechenEintraege(lang).map(([k]) => k);
      // Die vier von ben benannten Träger + die Analytics-Fläche + der Ergebnistext.
      for (const key of [
        "adm.sich.auditTitle",
        "adm.sich.auditHelp",
        "adm.sich.auditIntro",
        "adm.sich.audit.t",
        "adm.sich.audit.b",
        "adm.sich.verify.ok",
        "ana.audit",
        "ana.help.audit",
        "shelp.adm.auditTitle",
        "klara.page.analytics",
      ]) {
        expect(keys, `${lang}: ${key} fehlt in der geprüften Fläche`).toContain(key);
      }
      // Alle Sicherheits-Bausteine des Admin-Auszugs liegen unter adm.sich.* → mit drin.
      for (const p of SECURITY_POINTS) {
        expect(keys).toContain(p.titleKey);
        expect(keys).toContain(p.bodyKey);
      }
      expect(keys.length).toBeGreaterThanOrEqual(25);
    }
  });

  it("kein Text der Fläche behauptet Unveränderbarkeit oder Garantie", () => {
    for (const lang of LANGS) {
      const funde = findeBehauptungen(flaechenEintraege(lang), UEBER_AUSSAGEN);
      expect(
        funde,
        funde.map((f) => `${lang} ${f.key}: „${f.wort}" in „${f.text}"`).join("\n"),
      ).toEqual([]);
    }
  });

  it("GEGENPROBE — ein neuer Flaechen-Schluessel mit dem Wort unveraenderlich macht die Pruefung rot", () => {
    const vergiftet: [string, string][] = [
      ...flaechenEintraege("de"),
      ["ana.auditFooter", "Das Protokoll ist unveränderlich."],
    ];
    const funde = findeBehauptungen(vergiftet, UEBER_AUSSAGEN);
    expect(funde).toHaveLength(1);
    expect(funde[0]?.key).toBe("ana.auditFooter");
    // Und die Auswahlregel greift wirklich am Namen — ein NEUER Schlüssel dieser Familien ist
    // automatisch mit drin, ohne dass jemand eine Liste pflegen muss.
    expect(istKettenFlaeche("ana.auditFooter")).toBe(true);
    expect(istKettenFlaeche("adm.sich.irgendwasNeues")).toBe(true);
    expect(istKettenFlaeche("shelp.adm.auditHinweis")).toBe(true);
    expect(istKettenFlaeche("cap.title")).toBe(false);
    // Fremdfamilie: die Import-Aufräumung ist keine Aussage über die Kette.
    expect(istKettenFlaeche("imp.cleanup.auditPendingCandidates")).toBe(false);
  });
});

describe("Block A: was die Kette KANN, sagt die Oberfläche weiterhin — in allen drei Sprachen", () => {
  const HASH_WORT: Record<Lang, string> = {
    de: "hash-verkettet",
    en: "hash-chained",
    nl: "hash-geschakeld",
  };

  it("Titel und Sicherheitsbaustein nennen die Hash-Verkettung", () => {
    for (const lang of LANGS) {
      const b = bundle(lang);
      for (const key of ["adm.sich.auditTitle", "adm.sich.audit.t", "ana.audit"]) {
        expect(String(b[key]).toLowerCase(), `${lang} ${key}`).toContain(HASH_WORT[lang]);
      }
    }
  });

  it("die Erklärtexte nennen tamper-evident — die belegbare Eigenschaft", () => {
    for (const lang of LANGS) {
      const b = bundle(lang);
      expect(String(b["adm.sich.auditHelp"]), lang).toContain("tamper-evident");
      expect(String(b["adm.sich.audit.b"]), lang).toContain("tamper-evident");
    }
  });

  it("der Hilfetext benennt die REICHWEITENGRENZE (kein extern verankerter Kettenkopf)", () => {
    const GRENZE: Record<Lang, string> = {
      de: "keinen extern verankerten Kopf",
      en: "no externally anchored head",
      nl: "geen extern verankerd begin",
    };
    for (const lang of LANGS) {
      expect(String(bundle(lang)["adm.sich.auditHelp"]), lang).toContain(GRENZE[lang]);
    }
  });
});

// =============================================================================================
// AUFTRAG-mega16 Block C (bens SB-1, DRITTER Durchgang) — DIE DOKUMENTE SAGEN DASSELBE WIE DIE
// OBERFLÄCHE.
//
// Der Befund: die Produkttexte waren nach mega15 grün, aber aktive Spezifikations-, Onboarding-,
// Betriebs- und Compliance-Texte behaupteten weiter mehr, als die Kette belegt — ein Pflichtenheft
// mit „Manipulationsversuch nicht möglich", eine Story mit „Manipulation unmöglich", ein
// Compliance-Runbook mit „Manipulationssicherheit". bens Argument, warum das kein Formalismus ist:
// „Diese Texte koennen Betreiber- und Abnahmepraxis steuern." Ein Runbook, das
// Manipulationssicherheit zusichert, wird bei einer Prüfung vorgelegt.
//
// bens Einwand an der bestehenden Bremse war zugleich: sie liest keine Markdown-Dateien. Sie tut
// es jetzt — mit DERSELBEN Prüffunktion (`findeBehauptungen`) und DERSELBEN Wortliste (Stufe 1,
// die sechzehn absoluten Begriffe). Ausdrücklich KEINE zweite Prüfmechanik: die Erweiterung ist
// eine neue QUELLE für denselben Prüfer, kein neuer Prüfer.
//
// BEWUSST NUR STUFE 1. Die weicheren Über-Aussagen („unveränderlich", „immutable") sind in
// Fließtext außerhalb der Kette oft legitim — eine unveränderliche Datei-ID, ein append-only
// Entscheidungsprotokoll. Eine Volltextsuche danach über alle Dokumente würde Fremdtreffer
// einsammeln und den Prüfer abstumpfen; genau davor warnt der Kommentar zu FLAECHEN_REGELN oben.
// Die von ben namentlich benannten Stufe-2-Stellen sind in mega16 von Hand harmonisiert.
//
// HISTORISCHE DOKUMENTE BEHALTEN IHR DAMALIGES WORT. Datierte Lieferungen, After-Reports und
// Entscheidungsprotokolle beschreiben einen Stand, nicht eine Zusage; ein späterer Korrekturvermerk
// ist besser als rückwirkendes Umschreiben. Die drei Ablagen unten sind deshalb ausgenommen — und
// zwar NAMENTLICH und mit Begründung, damit die Ausnahme sichtbar bleibt statt stillschweigend zu
// wachsen.

const AKTIVE_WURZELN = ["specs", "docs"] as const;

const HISTORISCHE_ABLAGEN: readonly { pfad: string; grund: string }[] = [
  { pfad: "docs/qm", grund: "After-Reports und datierte Berater-/Hilfe-Lieferungen" },
  { pfad: "docs/team2-austausch", grund: "datierte Lieferungen und Abstimmungsstände mit Team 2" },
  { pfad: "docs/knowledge-os", grund: "datiertes Zustands-Dossier (current-state, 26.06.2026)" },
];

function istHistorisch(relPfad: string): boolean {
  return HISTORISCHE_ABLAGEN.some((a) => relPfad === a.pfad || relPfad.startsWith(`${a.pfad}/`));
}

const WURZEL = join(__dirname, "..", "..");

function markdownDateien(start: string): string[] {
  const gefunden: string[] = [];
  const gehe = (dir: string): void => {
    for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
      const voll = join(dir, eintrag.name);
      const rel = relative(WURZEL, voll).split("\\").join("/");
      if (eintrag.isDirectory()) {
        if (eintrag.name === "node_modules" || istHistorisch(rel)) {
          continue;
        }
        gehe(voll);
      } else if (eintrag.name.endsWith(".md") && !istHistorisch(rel)) {
        gefunden.push(rel);
      }
    }
  };
  gehe(join(WURZEL, start));
  return gefunden;
}

function aktiveDokumente(): [string, string][] {
  return AKTIVE_WURZELN.flatMap((wurzel) =>
    markdownDateien(wurzel).map(
      (rel) => [rel, readFileSync(join(WURZEL, rel), "utf8")] as [string, string],
    ),
  );
}

describe("Block C: aktive Dokumente behaupten nichts, was die Kette nicht belegt", () => {
  it("die Fläche ist nicht leer und deckt die von ben benannten Träger ab", () => {
    const pfade = aktiveDokumente().map(([p]) => p);
    // Ohne diese Zusicherung könnte ein kaputter Sammler still eine leere Menge prüfen — und der
    // grüne Lauf hieße gar nichts.
    expect(pfade.length).toBeGreaterThan(30);
    for (const pfad of [
      "specs/stories/library-analytics.md",
      "specs/reference/Pflichtenheft.md",
      "docs/onboarding/user-quickstart.md",
      "docs/operations/monitoring-logging.md",
      "docs/compliance/data-protection-requirements.md",
      "docs/compliance/gdpr-compliance-runbook.md",
      "docs/hilfe/HILFE-REGISTER.md",
    ]) {
      expect(pfade, `${pfad} fehlt im Prüfumfang`).toContain(pfad);
    }
    // Und die Ausnahme greift wirklich: kein einziges historisches Dokument ist mit drin.
    expect(pfade.filter(istHistorisch)).toEqual([]);
  });

  it("kein aktives Dokument behauptet Manipulations-/Fälschungssicherheit", () => {
    const funde = findeBehauptungen(aktiveDokumente(), ABSOLUTE_BEHAUPTUNGEN);
    expect(
      funde.map((f) => `${f.key}: „${f.wort}"`),
      funde.map((f) => `${f.key}: „${f.wort}"`).join("\n"),
    ).toEqual([]);
  });

  it("die historischen Ablagen sind namentlich ausgenommen und tragen ihr damaliges Wort weiter", () => {
    // Kein Selbstzweck: dieser Fall belegt, dass die Ausnahme eine ENTSCHEIDUNG ist und nicht ein
    // Versehen — in den ausgenommenen Ablagen stehen die alten Formulierungen nachweislich noch.
    const historisch: [string, string][] = HISTORISCHE_ABLAGEN.flatMap((a) => {
      const sammle = (dir: string): [string, string][] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const voll = join(dir, e.name);
          if (e.isDirectory()) {
            return sammle(voll);
          }
          return e.name.endsWith(".md")
            ? ([[relative(WURZEL, voll), readFileSync(voll, "utf8")]] as [string, string][])
            : [];
        });
      return sammle(join(WURZEL, a.pfad));
    });
    expect(findeBehauptungen(historisch, ABSOLUTE_BEHAUPTUNGEN).length).toBeGreaterThan(0);
    for (const ablage of HISTORISCHE_ABLAGEN) {
      expect(ablage.grund.length, `${ablage.pfad} ohne Begründung`).toBeGreaterThan(10);
    }
  });

  // DER NACHWEIS, dass die Ausweitung greift — derselbe Prüfer, dieselbe Wortliste, ein
  // eingeschmuggeltes Dokument. Ohne diesen Fall wäre nicht belegt, dass ein grüner Lauf oben
  // etwas bedeutet.
  it("GEGENPROBE — ein neues aktives Dokument mit dem Wort manipulationssicher macht die Pruefung rot", () => {
    const vergiftet: [string, string][] = [
      ...aktiveDokumente(),
      ["docs/operations/neues-runbook.md", "Das Audit-Log ist manipulationssicher."],
      ["specs/stories/neue-story.md", "Der Betreiber erhaelt ein revisionssicheres Protokoll."],
    ];
    const funde = findeBehauptungen(vergiftet, ABSOLUTE_BEHAUPTUNGEN);
    expect(funde).toHaveLength(2);
    expect(funde.map((f) => f.key)).toEqual([
      "docs/operations/neues-runbook.md",
      "specs/stories/neue-story.md",
    ]);
    expect(funde.map((f) => f.wort)).toEqual(["manipulationssicher", "revisionssicher"]);
  });
});
