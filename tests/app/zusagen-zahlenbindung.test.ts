// ================================================================================================
// JOB 1255 — DIE SICHTBARE AUFBEWAHRUNGSFRIST IST AN `TRASH_RETENTION_DAYS` GEBUNDEN.
// ================================================================================================
//
// DER BEFUND, gegen den dieser Wächter steht (gemessen, nicht vermutet):
// Das Produkt sagt dem Nutzer eine Aufbewahrungsfrist zu — „28 Tage" —, und es verhält sich nach
// `TRASH_RETENTION_DAYS` (`services/knowledge-object/src/service.ts:115`). Beide Seiten sind
// einzeln festgenagelt, aber NICHT miteinander verbunden:
//
//   · `tests/ko/trash-e2e.test.ts` prüft das Ablaufverhalten und benutzt die Konstante SYMBOLISCH
//     (`:9` Import, `:198` `clock += (TRASH_RETENTION_DAYS - 1) * 86_400_000`). Wird die Konstante
//     auf 30 gesetzt, rechnet dieser Test mit 30 weiter und bleibt grün.
//   · `tests/app/a18-ansagen-ereignisse.test.tsx:513` hat den deutschen Satz als Zeichenkette FEST
//     EINGETIPPT. Er bleibt ebenfalls grün, weil der Text sich ja nicht geändert hat.
//
// Ergebnis: Man kann die Aufbewahrungsfrist ändern, und das Produkt sagt dem Nutzer weiterhin die
// alte Zahl — ohne dass ein einziger Fall rot wird. Genau diese Lücke schließt diese Datei.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// WARUM ER DIE ZAHL ABLEITET UND NICHT DEN SATZ VERGLEICHT:
// `00_CONTROL/ENTSCHEIDUNGEN/JOB-682.md` entscheidet die Ownerfrage zu I12 mit „C — das
// tatsächliche Verhalten" und verwirft ausdrücklich „A — der exakte Wortlaut". Ein Wächter, der
// den Satz festnagelt, wäre A und bräche bei jeder Umformulierung. Dieser hier zieht die ZAHL aus
// dem Text und hält sie gegen die Konstante, die das Verhalten steuert. Der Satz darf umgeschrieben
// werden; nur die zugesagte Frist muss stimmen.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// NEUN STELLEN, NICHT SECHS — und warum das hier steht:
// Die Vorlage aus `RUECKGABE-BASIC6-JOB-1245-D1-ENTWARNUNG-JOB-1095.md` (5.4) nennt sechs Stellen:
// `ko.deleteQ` und `adm.trash.help`, je in de/en/nl. Beim Bauen kam eine dritte Zusage dazu, die
// dieselbe Frist trägt, aber als WORT statt als Ziffer:
//
//   `adm.sich.trash.b` — „…die endgültige Löschung erfolgt erst nach VIER WOCHEN." (de :772)
//                        „…final deletion happens only after FOUR WEEKS."          (en :5424)
//                        „…de definitieve verwijdering gebeurt pas na VIER WEKEN." (nl :9574)
//
// Vier Wochen sind 28 Tage — solange `TRASH_RETENTION_DAYS` 28 ist. Wird die Konstante auf 30
// gesetzt, ist dieser Satz FALSCH, und ein Wächter, der nur nach Ziffern sucht, sieht es nicht.
// Deshalb prüft die zweite Fallgruppe unten `wochen * 7 === TRASH_RETENTION_DAYS`.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BLINDHEITEN DIESES WÄCHTERS — ausdrücklich, weil eine verschwiegene Grenze zur Falle wird:
//
//  1. ER SIEHT NUR `apps/web/src/i18n.ts`. Die beiden Word-Add-in-Fassungen der Oberfläche — die
//     ausgelieferte unter `apps/web/public/word-addin/` und der Parallelpfad unter
//     `services/app/addin-static/` — sind eigene Textquellen und hier nicht geprüft. Sagt eine von
//     ihnen dieselbe Frist zu, ist sie weiterhin ungebunden.
//
//     WARUM HIER DIE VERZEICHNISSE STEHEN UND NICHT DIE DATEINAMEN — offen, damit es niemand für
//     einen Zufall hält: `tests/app/klara-regressionsinventar.test.ts` sammelt seine Menge über
//     Inhaltsachsen ein, darunter die Achse für die Word-Fläche (dort `:66-73`; ihr Muster ist der
//     Dateiname jener beiden Oberflächendateien, deshalb steht er hier nicht ausgeschrieben).
//     Stand der volle Dateiname in diesen zwei Zeilen, zog sie DIESE Datei ins Inventar —
//     gemessen, nicht vermutet: mit Dateinamen wurde `K2` rot („neu im Baum, aber nicht im
//     gepinnten Inventar"), ohne sie ist er grün. Der Treffer entstand ausschließlich an dieser
//     Blindheitsangabe, also an einer Stelle, die sagt, was hier NICHT geprüft wird. Dieser
//     Wächter prüft die Aufbewahrungsfrist in `i18n.ts` und keine Zeile der Word-Fläche; ein
//     Inventareintrag würde ihn bei jeder Klara-Regression mitfahren lassen, ohne dass er über
//     Klara etwas aussagt. Die Information ist vollständig erhalten (beide Verzeichnisse stehen
//     oben), nur der Achsentreffer fällt weg. Wer das anders sieht, hat den kürzeren Weg: den
//     Pfad in `INVENTAR` (`:120`) eintragen und diesen Absatz streichen — dann darf der Dateiname
//     hier wieder stehen.
//  2. ER SIEHT NUR DIESE DREI SCHLÜSSEL — plus den Sammler unten, der jede WEITERE Fristangabe
//     meldet. Eine Zusage ohne Zahl und ohne Zahlwort („bis zum Monatsende") entgeht beiden.
//  3. ER SIEHT ZIFFERN IN TAGEN UND ZAHLWÖRTER IN WOCHEN. „vierentwintig dagen" oder „28d" nicht.
//  4. ER BINDET DIE ZAHL, NICHT DIE BEDEUTUNG. Stünde „28 Tage" in einem Satz, der etwas ganz
//     anderes zusagt, bliebe er grün. Gegen falsche Sätze hilft nur Lesen, nicht Rechnen.
//  5. ER MACHT `a18-ansagen-ereignisse.test.tsx:513` NICHT ROT. Jener Fall nagelt den Wortlaut fest
//     (Weg A) und bleibt bei einer Konstantenänderung grün — das ist die in der Vorlage benannte
//     Falle. Sie wird hier NICHT geheilt, sondern nur nicht mehr allein gelassen: ändert jemand die
//     Konstante, wird DIESE Datei rot und weist auf die Textstellen hin.
// ================================================================================================
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { TRASH_RETENTION_DAYS } from "../../services/knowledge-object";

/** Die drei Sprachfassungen, die `i18n.ts` unter `resources` registriert. */
const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

/** Zahlwörter je Sprache; der Index IST die Zahl. Reicht bis acht — mehr Wochen sagt kein Text zu. */
const ZAHLWOERTER: Record<Sprache, readonly string[]> = {
  de: ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"],
  nl: ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht"],
};

/** Die Einheit „Tag" je Sprache, so wie sie im Fließtext steht. */
const TAGWORT: Record<Sprache, string> = { de: "Tagen?", en: "days?", nl: "dagen?" };

/** Die Einheit „Woche" je Sprache. */
const WOCHENWORT: Record<Sprache, string> = { de: "Wochen?", en: "weeks?", nl: "weken?" };

function bundle(lng: Sprache): Record<string, string> {
  return i18n.getResourceBundle(lng, "translation") as Record<string, string>;
}

/** Zieht „<Ziffer> Tage" aus einem Text. `null`, wenn keine Tagesfrist darin steht. */
function tageAusText(text: string, lng: Sprache): number | null {
  const treffer = new RegExp(`(\\d+)\\s+${TAGWORT[lng]}`, "i").exec(text);
  return treffer?.[1] === undefined ? null : Number(treffer[1]);
}

/** Zieht „<Zahlwort> Wochen" aus einem Text. `null`, wenn keine Wochenfrist darin steht. */
function wochenAusText(text: string, lng: Sprache): number | null {
  const woerter = ZAHLWOERTER[lng].join("|");
  const treffer = new RegExp(`\\b(${woerter})\\s+${WOCHENWORT[lng]}`, "i").exec(text);
  const wort = treffer?.[1]?.toLowerCase();
  if (wort === undefined) {
    return null;
  }
  const zahl = ZAHLWOERTER[lng].indexOf(wort);
  return zahl < 0 ? null : zahl;
}

/** Die Zusagen, die die Frist als Ziffer in Tagen nennen. */
const TAGES_ZUSAGEN = ["ko.deleteQ", "adm.trash.help"] as const;

/** Die Zusage, die dieselbe Frist als Zahlwort in Wochen nennt. */
const WOCHEN_ZUSAGEN = ["adm.sich.trash.b"] as const;

/**
 * Schlüssel, die eine Frist tragen, aber NICHTS mit dem Papierkorb zu tun haben. Sie stehen hier
 * namentlich, damit der Sammler unten beidseitig gepinnt ist: Kommt eine neue Fristzusage ins
 * Produkt, wird er rot und jemand muss entscheiden, wohin sie gehört. Verschwindet eine von diesen,
 * wird er ebenfalls rot — eine tote Ausnahme ist ein Fehler, keine Bequemlichkeit.
 */
const KEINE_AUFBEWAHRUNGSFRIST: Record<string, string> = {
  "lib.facet.ageBucket.d30":
    "Altersfacette des Suchfilters („≤ 30 Tage“). Die Zahl steht im Schlüsselnamen und hat mit " +
    "der Aufbewahrung im Papierkorb nichts zu tun.",
  "lib.facet.ageBucket.d180": "Dieselbe Facette, zweite Stufe („≤ 180 Tage“).",
};

describe("JOB 1255: die zugesagte Aufbewahrungsfrist ist an TRASH_RETENTION_DAYS gebunden", () => {
  // ─── Kalibrierung ─────────────────────────────────────────────────────────────────────────────
  // Ohne sie wäre ein grüner Lauf wertlos: Käme aus `getResourceBundle` ein leeres Objekt, liefen
  // alle Fälle unten über Nichts und meldeten Erfolg. Diese drei Fälle belegen, dass der Wächter
  // wirklich in die Texte greift und dass sein Zahlgriff in beide Richtungen funktioniert.
  it("Kalibrierung: alle drei Sprachbündel tragen alle drei geprüften Schlüssel", () => {
    for (const lng of SPRACHEN) {
      const werte = bundle(lng);
      expect(Object.keys(werte).length, `Sprachbündel ${lng} ist leer`).toBeGreaterThan(100);
      for (const key of [...TAGES_ZUSAGEN, ...WOCHEN_ZUSAGEN]) {
        expect(typeof werte[key], `${lng}.${key} fehlt im Sprachbündel`).toBe("string");
      }
    }
  });

  it("Kalibrierung: der Zahlgriff findet eine Frist und schweigt, wo keine steht", () => {
    expect(tageAusText("bleibt dort 12 Tage liegen", "de")).toBe(12);
    expect(tageAusText("restored for 9 days", "en")).toBe(9);
    expect(tageAusText("blijft 5 dagen staan", "nl")).toBe(5);
    expect(tageAusText("ohne jede Frist", "de")).toBeNull();
    expect(wochenAusText("erst nach drei Wochen", "de")).toBe(3);
    expect(wochenAusText("only after six weeks", "en")).toBe(6);
    expect(wochenAusText("pas na twee weken", "nl")).toBe(2);
    expect(wochenAusText("ohne jede Frist", "de")).toBeNull();
  });

  it("Kalibrierung: die Konstante ist eine brauchbare Frist", () => {
    expect(Number.isInteger(TRASH_RETENTION_DAYS)).toBe(true);
    expect(TRASH_RETENTION_DAYS).toBeGreaterThan(0);
  });

  // ─── Die Bindung selbst ───────────────────────────────────────────────────────────────────────
  for (const lng of SPRACHEN) {
    for (const key of TAGES_ZUSAGEN) {
      it(`${lng}.${key} sagt genau TRASH_RETENTION_DAYS Tage zu`, () => {
        const text = bundle(lng)[key] as string;
        const zugesagt = tageAusText(text, lng);
        expect(
          zugesagt,
          `${lng}.${key} nennt keine Tagesfrist mehr. Entweder ist die Zusage entfallen — dann gehört dieser Schlüssel aus TAGES_ZUSAGEN heraus — oder sie steht jetzt in einer Form, die dieser Wächter nicht liest. Text: ${JSON.stringify(text)}`,
        ).not.toBeNull();
        expect(
          zugesagt,
          `${lng}.${key} verspricht dem Nutzer ${zugesagt} Tage, das Produkt hält aber ${TRASH_RETENTION_DAYS} (services/knowledge-object/src/service.ts, TRASH_RETENTION_DAYS). Eine der beiden Seiten ist zu berichtigen.`,
        ).toBe(TRASH_RETENTION_DAYS);
      });
    }

    for (const key of WOCHEN_ZUSAGEN) {
      it(`${lng}.${key} sagt dieselbe Frist in Wochen zu`, () => {
        const text = bundle(lng)[key] as string;
        const wochen = wochenAusText(text, lng);
        expect(
          wochen,
          `${lng}.${key} nennt keine Wochenfrist mehr. Text: ${JSON.stringify(text)}`,
        ).not.toBeNull();
        expect(
          (wochen as number) * 7,
          `${lng}.${key} verspricht ${wochen} Wochen (= ${(wochen as number) * 7} Tage), das Produkt hält aber ${TRASH_RETENTION_DAYS} Tage. Genau dieser Satz ist die Stelle, die eine reine Ziffernsuche übersieht.`,
        ).toBe(TRASH_RETENTION_DAYS);
      });
    }
  }

  // ─── Der Sammler ──────────────────────────────────────────────────────────────────────────────
  // Er sorgt dafür, dass die Liste oben nicht veraltet. Kommt morgen eine vierte Fristzusage ins
  // Produkt, ist sie ohne Zutun Teil der Prüfung — und zwingt zu einer Entscheidung, statt still
  // ungebunden zu bleiben. Das ist die Reichweite, an der die Vorgängerrunden gescheitert sind:
  // dort wurde je eine einzelne Stelle benannt, und die nächste Sprache riss dieselbe Lücke neu auf.
  it("Sammler: jede Fristangabe in i18n.ts ist entweder gebunden oder namentlich ausgenommen", () => {
    const bekannt = new Set<string>([...TAGES_ZUSAGEN, ...WOCHEN_ZUSAGEN]);
    const unbekannt: string[] = [];
    for (const lng of SPRACHEN) {
      const woerter = ZAHLWOERTER[lng].slice(1).join("|");
      const frist = new RegExp(
        `\\d+\\s+${TAGWORT[lng]}|\\b(?:${woerter})\\s+${WOCHENWORT[lng]}`,
        "i",
      );
      for (const [key, wert] of Object.entries(bundle(lng))) {
        if (typeof wert !== "string" || !frist.test(wert)) {
          continue;
        }
        if (bekannt.has(key) || key in KEINE_AUFBEWAHRUNGSFRIST) {
          continue;
        }
        unbekannt.push(`${lng}.${key} = ${JSON.stringify(wert)}`);
      }
    }
    expect(
      unbekannt,
      `Diese i18n-Texte nennen eine Frist, sind aber weder an TRASH_RETENTION_DAYS gebunden noch in KEINE_AUFBEWAHRUNGSFRIST als fremder Gegenstand ausgewiesen. Beides ist zu entscheiden, keines still zu lassen:\n  ${unbekannt.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Sammler: jede namentliche Ausnahme existiert noch", () => {
    for (const key of Object.keys(KEINE_AUFBEWAHRUNGSFRIST)) {
      const vorhanden = SPRACHEN.some((lng) => typeof bundle(lng)[key] === "string");
      expect(
        vorhanden,
        `${key} steht in KEINE_AUFBEWAHRUNGSFRIST, existiert aber in keiner Sprache mehr — die Ausnahme ist tot und gehört entfernt.`,
      ).toBe(true);
    }
  });
});
