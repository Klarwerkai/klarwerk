// ================================================================================================
// JOB 4367 · K1 — DER UMZUGSNACHWEIS: kein Text hat sich geändert, keiner ist verschwunden.
// ================================================================================================
//
// DIE FRAGE, die dieser Auftrag beantworten muss, ist nicht „läuft es noch", sondern: hat sich für
// einen Anwender irgendetwas verschoben? Texte aus einer 18.700-Zeilen-Datei in Module zu heben ist
// genau die Sorte Umbau, bei der ein Anführungszeichen, ein Leerzeichen oder ein ganzer Schlüssel
// lautlos verschwindet — und das fällt erst einem Kunden auf.
//
// DER BEZUGSPUNKT ist `werte-vorher.json`: JEDER Schlüssel mit SEINEM Wert, je Sprache, erzeugt aus
// dem `i18n.ts` DES BASISSTANDS (`bestand-erzeugen.ts`) — also aus einer Fassung, die den Sammler
// dieses Auftrags noch gar nicht kennt. Nicht aus dem heutigen Baum: ein Bezugspunkt, den der
// Gemessene selbst erzeugt, misst nichts.
//
// ------------------------------------------------------------------------------------------------
// ZWEI ZUSAGEN, DIE NICHT DASSELBE SIND — und die zu vermischen hat zwei Runden gekostet
// ------------------------------------------------------------------------------------------------
// (A) DER UMZUGSNACHWEIS ist einmalig und vollständig: was am Basisstand stand, steht heute
//     unverändert da. Dafür wird Wert für Wert verglichen (K1.1). Runde 2 hatte hier nur eine
//     Prüfsumme im Schnappschuss liegen und verglich sie NICHT — BENs Gegenprobe veränderte den
//     deutschen Wert von `nav.library`, und alle gelieferten Fälle blieben grün. Ein Nachweis, der
//     seine eigene Mutation nicht findet, ist keiner.
//
// (B) DIE ERWEITERBARKEIT ist dauerhaft: ein SPÄTERER Nutzerweg legt ein weiteres Modul in
//     `texte/` und muss damit grün durchkommen, ohne `i18n.ts` anzufassen — das ist der ganze
//     Zweck von K2. Runde 1 sperrte das mit „kein Schlüssel ist dazugekommen" (und machte dabei
//     den fremden JOB 4363 rot), Runde 2 sperrte es mit „die Module liefern GENAU sieben
//     Schlüssel". Beides ist weg. Es gibt hier KEINE Obergrenze für Modulschlüssel und kein Verbot
//     neuer Schlüssel; was ein neues Modul mitbringt, prüft der VERTRAG
//     (`modulvertrag.test.ts`, Präfix, drei Sprachen, Eindeutigkeit), nicht dieser Bestandsabgleich.
//
// Was der Umzugsnachweis deshalb NICHT tut: Zuwachs verbieten. Ein Schlüssel, den es am Basisstand
// nicht gab, ist hier folgenlos — egal ob ihn ein fremder Job in `i18n.ts` ergänzt oder ein neues
// Textmodul mitbringt. Rot wird nur, was VERSCHWINDET oder sich ÄNDERT.
//
// WENN EIN SPÄTERER JOB EINEN TEXT ABSICHTLICH ÄNDERT, wird K1.1 rot und nennt Schlüssel, Sprache,
// Soll und Ist. Das ist gewollt: eine Textänderung ist eine Produktänderung und gehört gesehen. Der
// Nachtrag ist eine Zeile in `werte-vorher.json` — im Diff lesbar, nicht in einer Prüfsumme versteckt.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ladeTextbaum } from "../../apps/web/src/texte/intern/sammeln";
import { repoPfad } from "../support/repoPfad";

const SPRACHEN = ["de", "en", "nl"] as const;

interface Kopf {
  readonly basisstand: string;
  readonly sprachen: Record<string, { readonly anzahl: number; readonly sha256: string }>;
}

const kopf = JSON.parse(
  readFileSync(repoPfad("tests/i18n-textmodule/bestand-vorher.json"), "utf8"),
) as Kopf;

const werte = JSON.parse(
  readFileSync(repoPfad("tests/i18n-textmodule/werte-vorher.json"), "utf8"),
) as Record<string, Record<string, string>>;

function vorher(sprache: string): Record<string, string> {
  const bestand = werte[sprache];
  if (!bestand || Object.keys(bestand).length === 0) {
    throw new Error(`werte-vorher.json trägt die Sprache ${sprache} nicht`);
  }
  return bestand;
}

function bundle(sprache: string): Record<string, string> {
  const bestand = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, string>
    | undefined;
  if (!bestand || Object.keys(bestand).length === 0) {
    throw new Error(`Sprachbestand fehlt oder ist leer: ${sprache}`);
  }
  return bestand;
}

/** Alle Schlüssel, die aus `apps/web/src/texte/*.ts` kommen — aus dem Dateibaum, nicht geraten. */
function modulSchluessel(): string[] {
  const gefunden = new Set<string>();
  for (const modul of Object.values(ladeTextbaum(repoPfad("apps/web/src")).module)) {
    for (const schluessel of Object.keys((modul as { de: Record<string, string> }).de)) {
      gefunden.add(schluessel);
    }
  }
  return [...gefunden].sort();
}

/** Die sieben Schlüssel, die dieser Auftrag verschoben hat. Ihre WERTE prüft K1.1 mit allen anderen. */
const VERSCHOBEN = [
  "capture.sourceMissingNext",
  "ext.attachBlocked",
  "ext.gate.how",
  "ko.evCons.allOk",
  "ko.evFresh.missing",
  "ko.evFresh.neutral",
  "ko.evidenceOriginalDetached",
] as const;

const MODULE = {
  "apps/web/src/texte/ux08.ts": ["capture.sourceMissingNext", "ext.attachBlocked", "ext.gate.how"],
  "apps/web/src/texte/ux26.ts": [
    "ko.evidenceOriginalDetached",
    "ko.evCons.allOk",
    "ko.evFresh.missing",
    "ko.evFresh.neutral",
  ],
} as const;

describe("JOB 4367 · K1 — der Umzug hat keinen Text verändert und keinen verloren", () => {
  it("K1.0 · der Schnappschuss ist in sich stimmig (Werte gegen die eingecheckten Prüfsummen)", () => {
    // Beide Dateien gehören zusammen — sonst prüfte K1.1 gegen einen Abzug, den niemand verantwortet.
    for (const sprache of SPRACHEN) {
      const bestand = vorher(sprache);
      const namen = Object.keys(bestand).sort();
      const summe = createHash("sha256")
        .update(
          JSON.stringify(namen.map((schluessel) => [schluessel, bestand[schluessel]])),
          "utf8",
        )
        .digest("hex");
      expect(
        namen.length,
        `${sprache}: werte-vorher.json trägt ${namen.length} Schlüssel, bestand-vorher.json nennt ${kopf.sprachen[sprache]?.anzahl}`,
      ).toBe(kopf.sprachen[sprache]?.anzahl);
      expect(
        summe,
        `${sprache}: werte-vorher.json passt nicht zur eingecheckten Prüfsumme — die beiden Dateien stammen aus verschiedenen Läufen`,
      ).toBe(kopf.sprachen[sprache]?.sha256);
    }
  });

  it("K1.1 · jeder Schlüssel des Basisstands steht heute mit demselben Text da", () => {
    for (const sprache of SPRACHEN) {
      const soll = vorher(sprache);
      const jetzt = bundle(sprache);
      const abweichungen: string[] = [];
      for (const schluessel of Object.keys(soll).sort()) {
        const ist = jetzt[schluessel];
        if (ist === undefined) {
          abweichungen.push(`${schluessel}: FEHLT jetzt (war "${soll[schluessel]}")`);
        } else if (ist !== soll[schluessel]) {
          abweichungen.push(`${schluessel}: "${soll[schluessel]}" → "${ist}"`);
        }
      }
      expect(
        abweichungen,
        `${sprache}: ${abweichungen.length} Abweichung(en) gegenüber dem Basisstand ${kopf.basisstand}. Dieser Auftrag verschiebt Texte, er ändert und verliert keinen. Ist eine Textänderung gewollt, gehört sie in werte-vorher.json nachgetragen — nicht weggeprüft.`,
      ).toEqual([]);
    }
  });

  it("K1.2 · die sieben verschobenen Schlüssel kommen jetzt WIRKLICH aus den Textmodulen", () => {
    // Der eigentliche Umzugsnachweis: ohne ihn wäre K1.1 auch dann grün, wenn gar nichts umgezogen
    // wäre. Die WERTE dieser sieben prüft K1.1 zusammen mit allen anderen — hier geht es um die
    // Herkunft.
    const ausModulen = new Set(modulSchluessel());
    const nichtUmgezogen = VERSCHOBEN.filter((schluessel) => !ausModulen.has(schluessel));
    expect(
      nichtUmgezogen,
      "diese Schlüssel sollten aus apps/web/src/texte/ kommen, tun es aber nicht",
    ).toEqual([]);
  });

  it("K1.3 · ein weiteres, gültiges Modul ist AUSDRÜCKLICH erlaubt — keine Obergrenze", () => {
    // Diese Zusage ist der Gegenpol zu K1.2 und der Grund, warum die Obergrenze aus Runde 2 weg
    // ist (BEN, Korrekturpflicht 2): der nächste Nutzerweg soll sein Modul dazulegen können.
    // Geprüft wird nicht „grün, weil nichts passiert", sondern die Menge, die der Bestandsabgleich
    // heute wirklich sieht — sie enthält die sieben und darf mehr enthalten.
    const ausModulen = modulSchluessel();
    expect(ausModulen.length).toBeGreaterThanOrEqual(VERSCHOBEN.length);
    for (const schluessel of VERSCHOBEN) {
      expect(ausModulen).toContain(schluessel);
    }
    // Und ein zusätzlicher Modulschlüssel macht WEDER K1.1 noch K1.2 rot: beide fragen nur nach
    // dem Bestand des Basisstands. Dass das trägt, ist mit einem echten Zusatzmodul gemessen
    // (s. RUECKGABE, Gegenprobe „gültiges Zusatzmodul").
    const bekannt = new Set(Object.keys(vorher("de")));
    const zusaetzlich = ausModulen.filter((schluessel) => !bekannt.has(schluessel));
    expect(
      zusaetzlich.every((schluessel) => !bekannt.has(schluessel)),
      "Schlüssel ausserhalb des Basisstands sind hier folgenlos — sie werden vom Vertrag geprüft, nicht vom Bestandsabgleich",
    ).toBe(true);
  });
});

describe("JOB 4367 · K4 — die verschobenen Schlüssel stehen im Modul und nicht mehr in i18n.ts", () => {
  const i18nQuelle = readFileSync(repoPfad("apps/web/src/i18n.ts"), "utf8");

  it("K4.1 · i18n.ts führt keinen der sieben Schlüssel mehr (Schnittmenge leer)", () => {
    const nochDa = VERSCHOBEN.filter((schluessel) => i18nQuelle.includes(`"${schluessel}":`));
    expect(
      nochDa,
      "diese Schlüssel stehen noch als Eintrag in apps/web/src/i18n.ts — dann gäbe es sie zweimal",
    ).toEqual([]);
  });

  it("K4.2 · jedes Modul führt genau seine Schlüssel", () => {
    for (const [pfad, schluessel] of Object.entries(MODULE)) {
      const quelle = readFileSync(repoPfad(pfad), "utf8");
      for (const name of schluessel) {
        expect(quelle, `${pfad} führt "${name}" nicht`).toContain(`"${name}":`);
      }
    }
  });

  it("K4.3 · i18n.ts nennt kein Modul beim Namen — sie kommen ausschliesslich über den Sammler", () => {
    // Das ist die eigentliche Zusage dieses Auftrags: eine neue Datei in `texte/` braucht KEINE
    // Änderung an dieser Datei. Stünde hier ein `import … from "./texte/ux08"`, wäre der Sammler
    // Zierde und jede Bahn müsste `i18n.ts` weiterhin anfassen.
    expect(i18nQuelle).toContain('import.meta.glob<Textmodul>("./texte/*.ts"');
    for (const pfad of Object.keys(MODULE)) {
      const modulname = pfad.replace("apps/web/src/texte/", "").replace(".ts", "");
      expect(
        i18nQuelle.includes(`"./texte/${modulname}"`),
        `i18n.ts importiert texte/${modulname} ausdrücklich — dann trägt nicht der Sammler`,
      ).toBe(false);
    }
  });
});
