// ==================================================================================================
// JOB 3787 — DIE FAQ VERSPRICHT KEIN ZUSAMMENFÜHREN MEHR.
// ==================================================================================================
//
// WARUM ES DIESEN WÄCHTER GIBT. `OverlapService.resolve` kennt GENAU DREI Ausgänge
// (`services/conflicts/src/overlap-service.ts`: `kept_separate` → `keepSeparate`,
// `linked_related` → `linkRelated`, `dismissed` → `dismiss`), und alle drei laufen in dieselbe
// private Methode `close`. Die schreibt `status: "geschlossen"`, `resolution`, `closedAt`, ruft
// `this.repo.update(saved)` und `this.audit?.record(...)` — und NICHTS SONST. Kein Eintrag wird
// gelöscht, keiner umgeschrieben, kein Inhalt wandert von einem Objekt ins andere. Ein
// Zusammenführen gibt es in KLARWERK nicht, auch nicht „von Hand".
//
// Die FAQ-Antwort `faq.konflikte.6` behauptete es trotzdem — und das wiegt hier schwerer als ein
// falscher Knopftext: jede FAQ-Antwort wird über `allFaqEntries` (`apps/web/src/lib/klaraRegistry.ts`)
// zum `KlaraEntry` `kind: "faq"` und ist damit Grundlage der KI-Auskunft. Eine erfundene Fähigkeit
// in dieser Quelle wird von Klara ZITIERT.
//
// DER HISTORISCHE WORTLAUT (Basisstand be5c09b, `faqContent.ts:393`/`:395`) steht unten in
// `HISTORISCH` und ist hier das MESSMITTEL, nicht Zierde: er läuft durch dieselben Prüffunktionen
// wie der echte Bestand und MUSS rot machen. Wer die Verbotsliste später verwässert, wird dadurch
// rot, auch wenn die Datei gerade sauber ist (Bauart wie S11 in `tests/seitenhilfe-dubletten`).
//
// WAS DIESER WÄCHTER NICHT IST: eine Doppelung der drei vorhandenen `FAQ_CONTENT`-Leser.
// `tests/app/chain-claims.test.ts` prüft absolute Ketten-Behauptungen, `faq-anzeigeweg.test.tsx`
// den Anzeigeweg und `faq-export-rollenausnahme.test.ts` die Export-Regeln — KEINER von ihnen
// pinnt den Wortlaut der Duplikat-Antwort. Genau diese Lücke wird hier geschlossen.

import { describe, expect, it } from "vitest";
import { FAQ_CONTENT, type FaqItem } from "../../apps/web/src/lib/faqContent";
import { allFaqEntries, rankKlara, searchKlara } from "../../apps/web/src/lib/klaraRegistry";

// --------------------------------------------------------------------------------------------
// DIE VERBOTSLISTE — und warum genau diese sechs Stämme.
// --------------------------------------------------------------------------------------------
// Deutsche Verben mit Ablaut brauchen zwei Einträge, sonst rutscht die halbe Formenreihe durch:
//   · „verschmelz" fängt verschmelzen/verschmelzt/Verschmelzung — NICHT aber das Partizip.
//   · „verschmolz" fängt verschmolzen/verschmolz. Genau diese Form stand im alten Satz
//     („automatisch verschmolzen wird nichts"), der Stamm „verschmelz" allein hätte sie verfehlt.
//   · „zusammenführ" fängt zusammenführen/Zusammenführung/zusammenführt.
//   · „zusammenzuführ" fängt den erweiterten Infinitiv („um zwei Einträge zusammenzuführen") —
//     er enthält „zusammenführ" NICHT als Teilkette, das „zu" steht dazwischen.
//   · „zusammengeführ" fängt das Partizip (dasselbe Problem, diesmal durch das Präfix „ge").
//   · „merg" (nicht „merge") fängt merge/merging/merged/Merger — der englische Rückfall, den die
//     Fläche über „Merge-Button" schon einmal hatte.
// Der Abgleich ist bewusst SUBSTRING auf dem kleingeschriebenen Text: es gibt keinen Kontext, in
// dem einer dieser Stämme in einer ehrlichen Duplikat-Antwort stehen dürfte — auch nicht verneint.
// Das ist der springende Punkt: „Ein automatisches Zusammenführen gibt es bewusst nicht" stellt ein
// MANUELLES in Aussicht und ist deshalb ebenso rot (derselbe Fehler, den JOB 3771 an `dup.intro`
// gefunden hat).
//
// JOB 3844 ERGÄNZT SECHS STÄMME (Codex an JOB 3787, Prüfpunkt 6). Die sechs oben fangen nur die
// Wörter, die 2026-09 auf der Fläche standen; eine Verschmelzungszusage in ANDEREN Wörtern rutschte
// durch — gemessen an den Texten in `U2_SYNONYME` (vor dieser Ergänzung: `verbotsfunde` leer).
//   · „verein" fängt vereinen/vereint/vereinst/Vereinigung — das nächstliegende deutsche Synonym.
//     Bewusst der kurze Stamm: „vereinig" allein verfehlte „zu einem Eintrag vereint".
//   · „fusion" fängt fusionieren/fusioniert/Fusion — der kaufmännische Rückfall.
//   · „in einen eintrag" und „zu einem eintrag" fangen die UMSCHREIBUNG ohne Verb („in EINEN
//     Eintrag überführt", „zu einem Eintrag gemacht"). Das Verb allein zu verbieten hilft nicht:
//     es gibt beliebig viele („überführen", „machen", „gießen"); das ZIEL dagegen ist endlich.
//   · „zusammenleg" fängt zusammenlegen/zusammenlegst, „zusammengeleg" das Partizip
//     („zusammengelegt") — dieselbe „ge"-Falle wie bei „zusammengeführ"; der Schwesterwächter
//     `tests/seitenhilfe-dubletten` führt „zusammengelegt" schon seit JOB 3771.
// BEWUSST NICHT AUFGENOMMEN: „überführ" und „zusammenfass" — beide stehen in ehrlichen Sätzen
// („in die Bibliothek überführt", „die Karte fasst zusammen, wie stark sich zwei Einträge
// decken") und würden den Bestand falsch röten. Ihre Verschmelzungsbedeutung wird über das ZIEL
// gefangen („in einen eintrag"/„zu einem eintrag"), nicht über das Verb.
const VERBOTENE_STAEMME = [
  "verschmelz",
  "verschmolz",
  "zusammenführ",
  "zusammenzuführ",
  "zusammengeführ",
  "merg",
  "verein",
  "fusion",
  "in einen eintrag",
  "zu einem eintrag",
  "zusammenleg",
  "zusammengeleg",
] as const;

/** Alle Verbotsstämme, die in `text` stecken — leer heißt sauber. */
function verbotsfunde(text: string): string[] {
  const klein = text.toLowerCase();
  return VERBOTENE_STAEMME.filter((stamm) => klein.includes(stamm));
}

// --------------------------------------------------------------------------------------------
// DER POSITIVE TEIL — ohne ihn wäre der Wächter durch LÖSCHEN der Antwort erfüllbar.
// --------------------------------------------------------------------------------------------
// Jede Pflicht hängt an einer gemessenen Eigenschaft des Dienstes bzw. an dem, was die Fläche
// wirklich anbietet. Die Wortwahl folgt dem Katalog (`dup.*`, Stand JOB 3771): „getrennt",
// „verwandt", „Fehlalarm", „beide bleiben".
//
// JOB 3844 — DIE BEDEUTUNGSUMKEHR HÄNGT AN DER PFLICHT, DIE SIE UMKEHRT (Codex an JOB 3787: „Die
// Positivmuster :79/:83 erkennen zudem Wörter, nicht jede mögliche Bedeutungsumkehr."). Deshalb
// KEINE zweite Wortliste und kein zweiter Prüfweg, sondern ein Feld MEHR an derselben Pflicht:
// `muster` sagt „das Wort steht da", `umkehr` sagt „es steht da und sagt das Gegenteil". Beides
// läuft durch `fehlendePflicht` — wer die Pflicht erfüllt sieht, muss auch an der Umkehr vorbei.
// Die Fenster (`[^.]{0,40}`) enden am Satzpunkt: eine Verneinung im NÄCHSTEN Satz gehört zu einer
// anderen Aussage und darf den Bestand nicht röten.
const POSITIV_PFLICHT: readonly {
  readonly was: string;
  readonly muster: RegExp;
  readonly umkehr?: RegExp;
}[] = [
  // Bleibt aus dem alten Satz erhalten: die Erkennung ist echt (`OverlapService` findet die Fälle).
  // Umkehr: „erkennt Überschneidungen NICHT automatisch" bzw. „nicht automatisch erkannt".
  {
    was: "automatische Erkennung",
    muster: /erkennt[^.]*automatisch/i,
    umkehr:
      /erkennt[^.]{0,40}\bnicht\b[^.]{0,20}automatisch|\bnicht\b[^.]{0,20}automatisch[^.]{0,20}erkann/i,
  },
  // Der Deckungsgrad wird auf der Karte wirklich gezeigt (`dup.lead.*`).
  { was: "Deckungsgrad", muster: /decken/i },
  // Die Kernaussage: `close` fasst `repo.update` auf EINEN Eintrag — der andere bleibt unberührt.
  // Umkehr: die Verneinung steht hinter dem Pflichtwort („beide bleiben nicht bestehen") oder
  // davor („nicht beide bleiben"). `\bnicht\b` und nicht `nicht`: „es wird nichts gelöscht" ist
  // eine ehrliche Aussage und darf nicht röten.
  {
    was: "beide Einträge bleiben",
    muster: /beide bleiben/i,
    umkehr: /beide bleiben[^.]{0,40}\bnicht\b|\bnicht\b[^.]{0,20}beide bleiben/i,
  },
  // `resolution.reason` — der Abschlussgrund ist das Einzige, was ein Abschluss festhält.
  // Umkehr: das Pflichtwort in der FREMDEN Aussage („ohne Grund", „kein Grund").
  { was: "festgehaltener Grund", muster: /grund/i, umkehr: /ohne grund|kein(?:en)? grund/i },
  // Die drei Ausgänge von `resolve`, in der Sprache der Fläche.
  { was: "die drei Abschlüsse", muster: /getrennt[\s\S]*verwandt[\s\S]*fehlalarm/i },
  // `resolution.by`/`.at` und `audit.record` — der Grund bleibt nachlesbar am Vorgang.
  // Umkehr: „kein Protokoll", „ohne Protokoll", „ein Prüfprotokoll gibt es nicht".
  {
    was: "Grund bleibt nachlesbar",
    muster: /protokoll/i,
    umkehr: /protokoll[^.]{0,40}\bnicht\b|(?:kein|ohne)[^.]{0,20}protokoll/i,
  },
];

/**
 * Welche Pflichtaussagen in `answer` fehlen ODER ins Gegenteil verkehrt sind — leer heißt sauber.
 * Die Umkehr meldet den GEMESSENEN Fund, nicht den Sollwert: man liest in der Fehlermeldung, welche
 * Stelle des Textes angeschlagen hat.
 */
function fehlendePflicht(answer: string): string[] {
  const beanstandet: string[] = [];
  for (const p of POSITIV_PFLICHT) {
    if (!p.muster.test(answer)) {
      beanstandet.push(p.was);
      continue;
    }
    const fund = p.umkehr?.exec(answer)?.[0];
    if (fund !== undefined) {
      beanstandet.push(`${p.was} — umgekehrt: „${fund}“`);
    }
  }
  return beanstandet;
}

// Der Wortlaut am Basisstand be5c09b, Zeichen für Zeichen. Messmittel, siehe Kopf.
const HISTORISCH = {
  question: "Was ist ein Duplikat, und soll ich zwei ähnliche Artikel zusammenführen?",
  answer:
    "Ein Duplikat liegt vor, wenn zwei Einträge inhaltlich dasselbe sagen — die App erkennt Überschneidungen automatisch und zeigt, wie stark sich zwei Einträge decken, samt Empfehlung. Zusammenführen ist dann meist sinnvoll: ein Eintrag statt zwei halber. Das Zusammenführen bleibt ein bewusster menschlicher Schritt — automatisch verschmolzen wird nichts.",
} as const;

// ==================================================================================================
// JOB 3844 — DIE BEDEUTUNGSUMKEHR (Codex an JOB 3787, Prüfpunkt 6: „Die Positivmuster :79/:83
// erkennen zudem Wörter, nicht jede mögliche Bedeutungsumkehr.").
// ==================================================================================================
//
// DER RAHMEN IST DAS MESSMITTEL: vier Sätze in der Bauform des echten Bestandes, die alle sechs
// Pflichten erfüllen und keinen Verbotsstamm tragen. Jede Umkehr tauscht GENAU EINEN dieser Sätze
// aus. Dadurch ist gemessen, dass allein die Umkehrung den Unterschied macht — und nicht ein
// nebenher weggefallenes Pflichtwort.
const RAHMEN = {
  erkennung:
    "Ein Duplikat liegt vor, wenn zwei Einträge inhaltlich dasselbe sagen — die App erkennt Überschneidungen automatisch und zeigt, wie stark sich zwei Einträge decken, samt Empfehlung.",
  bestand: "Aus zwei Einträgen wird dabei nie einer: beide bleiben unverändert bestehen.",
  abschluss:
    "Du schließt den Fund stattdessen mit einem Grund ab: bewusst getrennt gelassen, als verwandt vermerkt oder Fehlalarm.",
  protokoll:
    "Dieser Grund bleibt mit Zeitpunkt und Person am Vorgang stehen, nachlesbar in der Liste und im Prüfprotokoll.",
} as const;

/** Der Rahmen mit ausgetauschtem Satz — die Umkehr, sonst nichts. */
const umkehrtext = (ersatz: Partial<Record<keyof typeof RAHMEN, string>>): string =>
  Object.values({ ...RAHMEN, ...ersatz }).join(" ");

// U1 — DIE VERNEINTE KERNAUSSAGE. `/beide bleiben/i` trifft weiter, die Verneinung steht dahinter.
const U1_KERNAUSSAGE = umkehrtext({
  bestand:
    "Aus zwei Einträgen wird am Ende einer: beide bleiben nicht bestehen, der schwächere Eintrag fällt beim Abschluss weg.",
});

// U2 — DIE VERSCHMELZUNGSZUSAGE MIT ANDEREN WÖRTERN. Jeder Text trägt GENAU EINEN der neuen
// Stämme; damit ist beim Entschärfen eines einzelnen Eintrags eindeutig, welcher Text ihn braucht.
const U2_SYNONYME: readonly { readonly stamm: string; readonly text: string }[] = [
  {
    stamm: "verein",
    text: umkehrtext({
      bestand: "Beide bleiben zunächst stehen, bis du sie am Ende zu EINEM Artikel vereinst.",
    }),
  },
  {
    stamm: "fusion",
    text: umkehrtext({
      bestand: "Beide bleiben sichtbar, bis KLARWERK die Inhalte beim Abschluss fusioniert.",
    }),
  },
  {
    stamm: "in einen eintrag",
    text: umkehrtext({
      bestand: "Beide bleiben stehen, bis der Abschluss ihre Inhalte in einen Eintrag überführt.",
    }),
  },
  {
    stamm: "zu einem eintrag",
    text: umkehrtext({ bestand: "Beide bleiben offen, bis du sie zu einem Eintrag machst." }),
  },
  {
    stamm: "zusammenleg",
    text: umkehrtext({ bestand: "Beide bleiben erhalten, bis du sie zusammenlegst." }),
  },
  {
    stamm: "zusammengeleg",
    text: umkehrtext({
      bestand: "Beide bleiben erhalten, bis sie beim Abschluss zusammengelegt werden.",
    }),
  },
];

// U3 — DIE VERNEINTE ERKENNUNGSZUSAGE.
const U3_ERKENNUNG = umkehrtext({
  erkennung:
    "Ein Duplikat liegt vor, wenn zwei Einträge inhaltlich dasselbe sagen — die App erkennt Überschneidungen nicht automatisch, du musst sie selbst suchen; erst danach zeigt sie, wie stark sich zwei Einträge decken.",
});

// U4 — DAS PFLICHTWORT IN FREMDER AUSSAGE: „ohne Grund" erfüllt `/grund/i`, „kein Prüfprotokoll"
// erfüllt `/protokoll/i`.
const U4_OHNE_GRUND = umkehrtext({
  abschluss:
    "Du schließt den Fund ohne Grund ab: ob bewusst getrennt gelassen, als verwandt vermerkt oder Fehlalarm, hält KLARWERK nicht fest.",
});
const U4_KEIN_PROTOKOLL = umkehrtext({
  protokoll: "Ein Prüfprotokoll dazu gibt es nicht; der Grund verschwindet mit dem Abschluss.",
});

// --------------------------------------------------------------------------------------------
// DIE GEGENPROBEN — ausführbar, in der Bauart von `HISTORISCH`.
// --------------------------------------------------------------------------------------------
// Sie hängen NICHT an `faqContent.ts`: wer die Erweiterung später aufweicht, wird hier rot, auch
// wenn der Bestand gerade sauber ist. Gemessen am Stand VOR diesem Job (b20af96) gingen alle elf
// Texte durch beide Prüffunktionen sauber durch (`verbotsfunde` = [], `fehlendePflicht` = []) —
// genau das war Codex' Befund.
describe("JOB 3844: die Bedeutungsumkehr wird beanstandet — vier Bauformen", () => {
  // Ohne diesen Fall messen die vier darunter womöglich den RAHMEN statt die Umkehrung.
  it("der Rahmen ohne Umkehr ist sauber — die Umkehrtexte unterscheiden sich nur im einen Satz", () => {
    expect(verbotsfunde(umkehrtext({}))).toEqual([]);
    expect(fehlendePflicht(umkehrtext({}))).toEqual([]);
  });

  it("U1 — „beide bleiben nicht bestehen“ erfüllt das Pflichtwort und sagt das Gegenteil", () => {
    // Kein Verbotsstamm — genau deshalb hat die Verbotsliste diesen Text nie erreicht.
    expect(verbotsfunde(U1_KERNAUSSAGE)).toEqual([]);
    expect(fehlendePflicht(U1_KERNAUSSAGE)).toEqual([
      "beide Einträge bleiben — umgekehrt: „beide bleiben nicht“",
    ]);
  });

  it("U2 — die Verschmelzungszusage in anderen Wörtern", () => {
    for (const { stamm, text } of U2_SYNONYME) {
      // Der positive Teil ist erfüllt: der Text fällt allein über die Verbotsliste.
      expect(fehlendePflicht(text), stamm).toEqual([]);
      expect(verbotsfunde(text), `„${stamm}“ wird nicht gefangen`).toEqual([stamm]);
    }
  });

  it("U3 — „erkennt Überschneidungen nicht automatisch“", () => {
    expect(verbotsfunde(U3_ERKENNUNG)).toEqual([]);
    expect(fehlendePflicht(U3_ERKENNUNG)).toEqual([
      "automatische Erkennung — umgekehrt: „erkennt Überschneidungen nicht automatisch“",
    ]);
  });

  it("U4 — das Pflichtwort in der fremden Aussage („ohne Grund“, „kein Prüfprotokoll“)", () => {
    expect(verbotsfunde(U4_OHNE_GRUND)).toEqual([]);
    expect(fehlendePflicht(U4_OHNE_GRUND)).toEqual([
      "festgehaltener Grund — umgekehrt: „ohne Grund“",
    ]);
    expect(verbotsfunde(U4_KEIN_PROTOKOLL)).toEqual([]);
    expect(fehlendePflicht(U4_KEIN_PROTOKOLL)).toEqual([
      "Grund bleibt nachlesbar — umgekehrt: „protokoll dazu gibt es nicht“",
    ]);
  });

  // LIEFERUNG 5 — die schärfere Prüfung darf den echten Bestand nicht röten, und das wird EINZELN
  // gezeigt: nicht „die Antwort ist grün", sondern „kein einziges neues Muster schlägt an".
  it("der echte Bestand besteht jede neue Prüfung einzeln", () => {
    const neu = U2_SYNONYME.map((s) => s.stamm);
    for (const item of DUBLETTEN_FAQ) {
      const ganz = `${item.question} ${item.answer}`;
      for (const stamm of neu) {
        expect(ganz.toLowerCase().includes(stamm), `${item.id}: „${stamm}“ schlägt an`).toBe(false);
      }
      for (const p of POSITIV_PFLICHT) {
        expect(
          p.umkehr?.exec(ganz)?.[0],
          `${item.id}: die Umkehrprüfung zu „${p.was}“ hält den echten Satz für verkehrt`,
        ).toBeUndefined();
      }
      expect(fehlendePflicht(item.answer), item.id).toEqual([]);
    }
  });
});

// FLÄCHE STATT KATALOG: die geprüfte Menge wird über die ROUTE ermittelt, nicht über die ID.
// Kommt morgen eine zweite Duplikat-Antwort dazu, fällt sie ohne Zutun in denselben Wächter.
const DUBLETTEN_FAQ: readonly FaqItem[] = FAQ_CONTENT.filter((item) => item.route === "/duplikate");

describe("JOB 3787: die FAQ zu Dubletten sagt die gemessene Wirkung", () => {
  it("die Fläche /duplikate ist überhaupt belegt (sonst prüfte der Wächter die leere Menge)", () => {
    expect(DUBLETTEN_FAQ.map((item) => item.id)).toContain("faq.konflikte.6");
  });

  it("keine Frage und keine Antwort der Duplikat-FAQ stellt ein Zusammenführen in Aussicht", () => {
    for (const item of DUBLETTEN_FAQ) {
      expect(verbotsfunde(item.question), `${item.id} · Frage`).toEqual([]);
      expect(verbotsfunde(item.answer), `${item.id} · Antwort`).toEqual([]);
    }
  });

  it("jede Antwort sagt, dass beide Einträge bleiben — und was man stattdessen tun kann", () => {
    for (const item of DUBLETTEN_FAQ) {
      expect(fehlendePflicht(item.answer), `${item.id} · Antwort`).toEqual([]);
    }
  });

  // GEGENPROBE, ausführbar statt als Kommentar: derselbe Prüfer auf dem historischen Wortlaut.
  // Wer die Verbotsliste später aufweicht, wird HIER rot, auch wenn die Datei gerade sauber ist.
  it("GEGENPROBE — der historische Wortlaut macht dieselben Prüffunktionen rot", () => {
    expect(verbotsfunde(HISTORISCH.question)).toEqual(["zusammenführ"]);
    expect(verbotsfunde(HISTORISCH.answer)).toEqual(["verschmolz", "zusammenführ"]);
    // Und er ist nirgends mehr im Bestand: restlos ersetzt, nicht danebengelegt.
    for (const item of FAQ_CONTENT) {
      expect(item.question, item.id).not.toBe(HISTORISCH.question);
      expect(item.answer, item.id).not.toBe(HISTORISCH.answer);
    }
  });

  // GEGENPROBE gegen die LEERE ERFÜLLUNG: eine reine Verbotsliste wäre durch Löschen der Antwort
  // erfüllbar. Der positive Teil schließt das aus — hier gemessen, nicht behauptet.
  it("GEGENPROBE — eine leere Antwort erfüllt zwar die Verbotsliste, fällt aber am positiven Teil", () => {
    expect(verbotsfunde("")).toEqual([]);
    expect(fehlendePflicht("")).toEqual(POSITIV_PFLICHT.map((p) => p.was));
  });

  // GEGENPROBE gegen die HALBHEIT: der Satz, der das Verschmelzen nur als „nicht automatisch"
  // verneint, ist genau der Fehler, den JOB 3771 an `dup.intro` gefunden hat.
  it("GEGENPROBE — „(Ein automatisches Zusammenführen gibt es bewusst nicht.)“ ist ebenso rot", () => {
    expect(verbotsfunde("(Ein automatisches Zusammenführen gibt es bewusst nicht.)")).toEqual([
      "zusammenführ",
    ]);
  });
});

// ==================================================================================================
// DIE KETTE ZU KLARA — gemessen, nicht angenommen (Lieferung 4).
// ==================================================================================================
// `allFaqEntries` baut den Eintrag aus der KONSTANTEN `FAQ_CONTENT` (kein Abruf, kein Cache, kein
// Netz): der Text ist in jedem Zustand — laden, leer, Fehler, gescheiterte Auffrischung, offline —
// derselbe. Trotzdem ist der Weg belegpflichtig, denn er ist der UNSICHTBARE Zweig: was hier steht,
// zitiert die KI-Auskunft, nicht nur die Liste unter `/hilfe`.
describe("JOB 3787: die korrigierte Antwort erreicht die Klara-Wissensdatenbank", () => {
  const eintrag = () => allFaqEntries("de").find((e) => e.id === "faq:faq.konflikte.6");
  const quelle = FAQ_CONTENT.find((f) => f.id === "faq.konflikte.6");

  it("der Klara-Eintrag trägt Frage und Antwort wortgleich weiter", () => {
    const e = eintrag();
    expect(e, "faq:faq.konflikte.6 fehlt in der Wissensdatenbank").toBeDefined();
    expect(e?.kind).toBe("faq");
    expect(e?.route).toBe("/duplikate");
    expect(e?.title).toBe(quelle?.question);
    expect(e?.body).toBe(quelle?.answer);
  });

  it("die Verbotsliste und der positive Teil greifen auch auf dem Klara-Weg", () => {
    const e = eintrag();
    expect(verbotsfunde(`${e?.title} ${e?.body}`)).toEqual([]);
    expect(fehlendePflicht(String(e?.body))).toEqual([]);
  });

  // LIEFERUNG 2, gemessen: die NEUE Frage ist der Text, über den Klara diesen Eintrag findet
  // (`klaraRegistry.ts`: `title: f.question`). Sie muss denselben Suchweg tragen wie die alte.
  // `searchKlara` verlangt JEDES Suchwort in Titel+Text; `rankKlara` zählt die Treffer.
  it("die neue Frage trägt denselben Suchweg — über die echte Klara-Suche gemessen", () => {
    const alle = allFaqEntries("de");
    for (const anfrage of ["duplikat", "duplikat ähnliche artikel", "zwei ähnliche artikel"]) {
      expect(
        searchKlara(alle, anfrage).map((e) => e.id),
        `Suche „${anfrage}“`,
      ).toContain("faq:faq.konflikte.6");
    }
    // Stufe 2 (Grundlage der KI-Antwort): die ganze Nutzerfrage, mit Füllwörtern.
    expect(
      rankKlara(alle, "Was ist ein Duplikat und was mache ich mit zwei ähnlichen Artikeln?").map(
        (e) => e.id,
      ),
    ).toContain("faq:faq.konflikte.6");
  });

  // DIE STELLE, AN DER DIE KORREKTUR NOCH VERLOREN GEHEN KÖNNTE — gemessen am echten Schnitt.
  // `KlaraAssistant.tsx` reicht der KI NICHT den ganzen Eintrag, sondern `title.slice(0, 160)` und
  // `body.slice(0, 700)`. Der ehrliche Teil der Antwort steht am ENDE (beide bleiben · Grund ·
  // Protokoll) — wüchse sie über 700 Zeichen, bekäme die KI nur noch den Erkennungssatz und
  // antwortete wieder ohne die Einschränkung. Deshalb laufen Verbotsliste UND positiver Teil hier
  // gegen den GESCHNITTENEN Text, nicht gegen den vollen.
  const KI_TITEL_SCHNITT = 160;
  const KI_TEXT_SCHNITT = 700;
  it("der KI-Ausschnitt trägt die Korrektur ungekürzt (title 160 / body 700 aus KlaraAssistant)", () => {
    for (const item of DUBLETTEN_FAQ) {
      const titel = item.question.slice(0, KI_TITEL_SCHNITT);
      const text = item.answer.slice(0, KI_TEXT_SCHNITT);
      expect(text, `${item.id}: die Antwort wird für die KI beschnitten`).toBe(item.answer);
      expect(verbotsfunde(`${titel} ${text}`), `${item.id} · KI-Ausschnitt`).toEqual([]);
      expect(fehlendePflicht(text), `${item.id} · KI-Ausschnitt`).toEqual([]);
    }
  });
});
