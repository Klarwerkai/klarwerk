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
// JOB 3916 — DIE BELEGGRENZE DER UMKEHRERKENNUNG. Gemessen ist ab jetzt: die Verneinung trägt mehr
// als ein Wort („nicht", „nie", „niemals", „keineswegs", „keinerlei", „kein(e/m/n/r/s)", dazu „ohne"
// in derselben Rolle), und sie wirkt nur innerhalb IHRER Teilaussage — ein ehrlicher Satz mit
// benachbarter Verneinung („Beide bleiben bestehen und werden nicht gelöscht") wird nicht mehr
// beanstandet. NICHT GEMESSEN ZUM STAND JOB 3916: sprachliche Allgemeingültigkeit über die Sätze in
// `KALIBRIERUNG` hinaus (damals: zwölf) — der Wächter kennt Wörter und Abstände, keine
// Grammatik; die EN/NL-Fassungen der FAQ (dieser Wächter liest nur `FAQ_CONTENT`, also DE); und jede
// Verneinung, die über die Grenze ihrer Teilaussage hinaus wirkt. Die dritte dieser Grenzen ist für
// den `dass`-Satz seit JOB 3952 aufgehoben und dort neu kalibriert; die beiden anderen gelten
// unverändert weiter.
//
// JOB 3939 — DIE GRENZE DER TEILAUSSAGE TRENNTE ZU VIEL, UND AN EINER STELLE ZU WENIG. BEN hat den
// kalibrierten Stand nachgemessen (`archiv/3916/runde-1/ben.md:29`) und drei Sätze gefunden, an
// denen der Wächter falsch urteilte. ZUSÄTZLICH GEMESSEN ist ab jetzt: eine adversative Partikel
// („aber", „doch", „jedoch") INNERHALB desselben Prädikats beendet die Teilaussage nicht mehr —
// „beide bleiben aber nicht bestehen" und „beide bleiben doch keineswegs erhalten" werden
// beanstandet (V8, V9); und „nicht nur …, sondern …" gilt als das, was es ist — eine Steigerung,
// die X behauptet, keine Verneinung von X (E6 an „beide bleiben", E9 an „festgehaltener Grund").
// Die Grenzen `und`, `oder`, `sondern` und die Satzzeichen bleiben unverändert Grenze (E1–E3, E7,
// E8). NICHT GEMESSEN ZUM STAND JOB 3939 (achtzehn Sätze in `KALIBRIERUNG`): jede Verneinung über
// die Grenze ihrer Teilaussage hinaus, die EN/NL-Fassungen der FAQ, und jede sprachliche
// Allgemeingültigkeit über die aufgezählten Sätze hinaus. Den ersten Punkt löst JOB 3952 ein.
//
// JOB 3952 — DIE VERNEINUNG DES HAUPTSATZES REICHT IN DEN `dass`-SATZ HINEIN. BEN hat den Stand aus
// JOB 3939 nachgemessen und die Grenze, die dieser Kopf seit JOB 3916 selbst benannte, als Auftrag
// zurückgegeben (`archiv/3939/runde-1/ben.md:29`): „Es stimmt nicht, dass beide bleiben." passierte,
// weil das Fenster am Komma endet. ZUSÄTZLICH GEMESSEN ist ab jetzt: ein Fenster, das VON einer
// Verneinung ZU ihrem Pflichtwort läuft, überschreitet GENAU EIN Komma — aber nur, wenn unmittelbar
// dahinter `dass` steht (`nahMitDassSatz`, Begründung dort; kein zweiter Prüfweg, keine zweite
// Wortliste). V10 („beide bleiben") und V11 („festgehaltener Grund") messen die Regel an zwei
// Pflichten; E10–E13 messen, dass sie nichts anderes mitnimmt: der Gedankenstrich bleibt Grenze
// (E10), `dass` allein ohne Verneinung löst nichts aus (E11), und wo kein `dass` folgt, bleibt das
// Komma Grenze (E12, E13). „jedoch" steht seit diesem Job als eigener Tabellenfall (V12) statt nur
// in der Wortliste, und die „nicht nur"-Ausnahme ist nach beiden Seiten kalibriert (E6/E9
// durchlässig, V13 nicht).
//
// WEITERHIN NICHT GEMESSEN: die EN/NL-Fassungen der FAQ (dieser Wächter liest nur `FAQ_CONTENT`,
// also DE); jede sprachliche Allgemeingültigkeit über die jetzt sechsundzwanzig Sätze in
// `KALIBRIERUNG` hinaus. NEU BENANNT, weil beim Bauen aufgefallen: die Regel hängt allein am Wort
// `dass`. Jede ANDERE Einleitung derselben Bauform bleibt unerkannt — `ob` („Es ist nicht belegt, ob
// beide bleiben."), der Relativsatz („… ein Eintrag, der nicht bleibt"), die indirekte Rede und der
// Fragesatz; ebenso eine Verneinung, die über ZWEI Kommata hinweg wirkt. Wer eine dieser Grenzen
// verschiebt, kalibriert sie hier neu.
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
// Die Fenster enden an der Grenze der Teilaussage (siehe `SELBE_AUSSAGE`): eine Verneinung in einer
// anderen Aussage gehört zu einer anderen Behauptung und darf den Bestand nicht röten.
//
// JOB 3916 — DIE VERNEINUNG HAT MEHR ALS EIN WORT, UND SIE REICHT NICHT BELIEBIG WEIT.
// BEN hat den Wächter aus JOB 3844 nachgemessen (`archiv/3844/runde-1/ben.md:30`) und beide Enden
// desselben Fehlers gefunden. Deshalb genau ZWEI Bausteine, die ALLE VIER Umkehrmuster benutzen —
// keine zweite Wortliste, kein zweiter Prüfweg:
//
//   `VERNEINUNG`    welche Wörter eine Verneinung tragen. Nur „nicht" zu prüfen ließ „beide bleiben
//                   keineswegs erhalten" durch (BENs Probe a) — gemessen am Stand 18765d2 gab
//                   `fehlendePflicht` dafür `[]` zurück. Die Wortgrenzen `\b` bleiben der Grund,
//                   warum „es wird nichts gelöscht" NICHT rötet: `\bnicht\b` schlägt in „nichts"
//                   nicht an, und „nie" steckt nicht in „nichts".
//   `SELBE_AUSSAGE` wie weit eine Verneinung reicht. Sie gehört zu IHREM Prädikat: „Beide bleiben
//                   bestehen und werden nicht gelöscht" ist wahr (BENs Probe b) und wurde trotzdem
//                   beanstandet, weil das alte Fenster `[^.]{0,40}` erst am Satzpunkt endete und so
//                   über „und werden" hinweg griff. Ein Fenster endet daher zusätzlich an Komma,
//                   Semikolon, Doppelpunkt, Frage-/Ausrufezeichen, Gedankenstrich und an einer
//                   nebenordnenden Konjunktion.
//
// AN WELCHEM FALL DIESER DATEI BEIDES HÄNGT: der Rahmen selbst (`:179`, „wird dabei nie einer:
// beide bleiben unverändert bestehen") trägt „nie" zwölf Zeichen vor dem Pflichtwort — ohne die
// Grenze am Doppelpunkt röte die Verneinungsliste den eigenen Messrahmen und mit ihm den echten
// Bestand, dessen Antwort dieselbe Bauform hat („schreibt keinen um — beide bleiben unverändert
// bestehen", `faqContent.ts:395`). Kalibriert ist beides in der Tabelle `KALIBRIERUNG` (V1–V7
// verkehrt, E1–E5 ehrlich), E3 mit genau dieser Bauform des Bestandes.
//
// JOB 3939 — DIESELBEN ZWEI BAUSTEINE, AN DER VON BEN GEMESSENEN STELLE GENAUER. Keine dritte
// Konstante, keine zweite Wortliste: beide Änderungen sitzen dort, wo die alte Regel stand, und
// wirken dadurch weiter über ALLE VIER Umkehrmuster.
//
//   WELCHES WORT EINE NEUE TEILAUSSAGE EINLEITET. `und`, `oder` und `sondern` ordnen zwei Aussagen
//   mit je eigenem Prädikat nebeneinander — was dahinter verneint wird, gehört zu einer ANDEREN
//   Behauptung („Beide bleiben bestehen und werden nicht gelöscht", E1). `aber`, `doch` und
//   `jedoch` können dagegen als Partikel MITTEN im selben Prädikat stehen und verneinen dann genau
//   das Pflichtwort davor: „beide bleiben aber nicht bestehen" (V8), „beide bleiben doch keineswegs
//   erhalten" (V9). Die alte Liste behandelte beides gleich und liess damit zwei Löschzusagen
//   durch. Die drei Partikel sind deshalb KEINE Grenze mehr. Leiten sie doch eine zweite
//   Teilaussage ein, steht davor ein Komma („…, gelöscht wird aber nie etwas", E7; dasselbe an der
//   Pflicht „Grund bleibt nachlesbar", E8) — und das Komma bleibt Grenze. Daran, und nur daran,
//   hängt die Lockerung.
//
//   WARUM „NICHT NUR" KEINE VERNEINUNG IST. „nicht nur X" verneint X nicht, es BEHAUPTET X und
//   steigert darüber hinaus: „Beide bleiben nicht nur sichtbar, sondern unverändert bestehen" (E6)
//   sagt genau das, was `close` tut — und wurde trotzdem beanstandet, weil „nicht" unmittelbar
//   hinter dem Pflichtwort stand. `VERNEINUNG` erkennt „nicht" daher nicht mehr, wenn direkt „nur"
//   folgt. Die Ausnahme sitzt in der EINEN Wortliste; E9 misst sie an einer zweiten Pflicht
//   („Du schließt den Fund nicht nur mit einem Grund ab, sondern …").
const VERNEINUNG = String.raw`\b(?:nicht(?!\s+nur\b)|niemals|nie|keineswegs|keinerlei|kein(?:e|em|en|er|es)?)\b`;

/**
 * Ein Zeichen, das noch zur SELBEN Teilaussage gehört. Beendet wird sie von den Satzzeichen und von
 * den nebenordnenden Konjunktionen `und`/`oder`/`sondern` — NICHT von „aber"/„doch"/„jedoch"
 * (JOB 3939: Partikel im selben Prädikat, siehe Begründung oben).
 */
const SELBE_AUSSAGE = String.raw`(?:(?!\b(?:und|oder|sondern)\b)[^.,;:!?—–])`;

/** Ein Fenster von höchstens `zeichen` Zeichen INNERHALB derselben Teilaussage. */
const nah = (zeichen: number): string => `${SELBE_AUSSAGE}{0,${zeichen}}`;

/**
 * JOB 3952 — DASSELBE FENSTER, das zusätzlich GENAU EIN Komma überschreiten darf: dann und nur dann,
 * wenn unmittelbar dahinter der Nebensatzeinleiter `dass` steht. Gebaut aus denselben Teilen wie
 * `nah`, daneben statt darin — `SELBE_AUSSAGE` bleibt unangetastet, und alle Grenzen (`und`, `oder`,
 * `sondern`, Punkt, Semikolon, Doppelpunkt, Frage- und Ausrufezeichen, Gedankenstrich) gelten
 * unverändert weiter.
 *
 * WARUM ÜBERHAUPT. „Es stimmt nicht, dass beide bleiben." ist EINE Behauptung: der Hauptsatz verneint
 * genau den `dass`-Satz, der ihm folgt. Das Komma trennt hier keine zweite Aussage ab, es ist die
 * Naht INNERHALB derselben. Bis JOB 3939 endete das Fenster trotzdem dort, das zweite Umkehrmuster
 * erreichte das Pflichtwort nie, und `fehlendePflicht` hielt den Satz für ehrlich (V10, V11).
 *
 * WARUM NUR IN DER MUSTERHÄLFTE „VERNEINUNG VOR DEM PFLICHTWORT". Der Hauptsatz steht VOR seinem
 * Nebensatz; die Verneinung reicht nach RECHTS hinein, nie nach links. Ein Fenster, das umgekehrt vom
 * Pflichtwort aus nach rechts eine Verneinung sucht (`beide bleiben${nah(40)}${VERNEINUNG}`), behält
 * das Komma deshalb als harte Grenze — sonst würde „Beide bleiben bestehen, gelöscht wird nie etwas."
 * rot (E2, E7, E13), und mit ihr die Bauform des ausgelieferten Bestandes. E12 misst genau diese
 * Asymmetrie an einem Satz, der beides zugleich trägt.
 *
 * `\bdass\b` und nicht `dass`: „dasselbe" steht im Erkennungssatz des echten Bestandes
 * (`faqContent.ts:395`) und dürfte das Fenster nicht öffnen. Ein ZWEITES Komma bleibt Grenze — die
 * Regel überschreitet eines, nicht beliebig viele.
 */
const nahMitDassSatz = (zeichen: number): string =>
  `${nah(zeichen)}(?:,\\s*dass\\b${nah(zeichen)})?`;

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
    umkehr: new RegExp(
      `erkennt${nah(40)}${VERNEINUNG}${nahMitDassSatz(20)}automatisch|${VERNEINUNG}${nahMitDassSatz(20)}automatisch${nah(20)}erkann`,
      "i",
    ),
  },
  // Der Deckungsgrad wird auf der Karte wirklich gezeigt (`dup.lead.*`).
  { was: "Deckungsgrad", muster: /decken/i },
  // Die Kernaussage: `close` fasst `repo.update` auf EINEN Eintrag — der andere bleibt unberührt.
  // Umkehr: die Verneinung steht hinter dem Pflichtwort („beide bleiben keineswegs bestehen") oder
  // davor („es können niemals beide bleiben") — und zwar in DERSELBEN Teilaussage. Sonst wäre
  // „Beide bleiben bestehen und werden nicht gelöscht" beanstandet, obwohl der Satz genau das sagt,
  // was `close` tut (E1 der Kalibrierung).
  {
    was: "beide Einträge bleiben",
    muster: /beide bleiben/i,
    umkehr: new RegExp(
      `beide bleiben${nah(40)}${VERNEINUNG}|${VERNEINUNG}${nahMitDassSatz(20)}beide bleiben`,
      "i",
    ),
  },
  // `resolution.reason` — der Abschlussgrund ist das Einzige, was ein Abschluss festhält.
  // Umkehr: das Pflichtwort in der FREMDEN Aussage („ohne Grund", „keinerlei Grund"). „ohne" steht
  // neben der Verneinungsliste, weil es kein Verneinungswort ist, hier aber dieselbe Rolle trägt.
  {
    was: "festgehaltener Grund",
    muster: /grund/i,
    umkehr: new RegExp(`(?:\\bohne\\b|${VERNEINUNG})${nahMitDassSatz(20)}grund`, "i"),
  },
  // Die drei Ausgänge von `resolve`, in der Sprache der Fläche.
  { was: "die drei Abschlüsse", muster: /getrennt[\s\S]*verwandt[\s\S]*fehlalarm/i },
  // `resolution.by`/`.at` und `audit.record` — der Grund bleibt nachlesbar am Vorgang.
  // Umkehr: „kein Protokoll", „ohne Protokoll", „ein Prüfprotokoll gibt es niemals".
  {
    was: "Grund bleibt nachlesbar",
    muster: /protokoll/i,
    umkehr: new RegExp(
      `protokoll${nah(40)}${VERNEINUNG}|(?:\\bohne\\b|${VERNEINUNG})${nahMitDassSatz(20)}protokoll`,
      "i",
    ),
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
  //
  // JOB 3939 ZIEHT DIESEN FALL AUF DIE GEÄNDERTEN MUSTER: die vier Umkehrmuster werden aus
  // `VERNEINUNG` und `SELBE_AUSSAGE` gebaut, also misst die Schleife unten die gelockerte Grenze
  // und die „nicht nur"-Ausnahme am echten Bestand mit — einzeln, Pflicht für Pflicht. Damit die
  // Messung nicht leer läuft, steht davor der Nachweis, dass die ausgelieferten Antworten überhaupt
  // Verneinungen tragen (`faqContent.ts:395`: „nie", dreimal „keinen"). Ohne ihn wäre „kein Muster
  // schlägt an" auch dann wahr, wenn gar nichts zu treffen da wäre.
  //
  // JOB 3952 KOMMT OHNE ZUTUN MIT: `nahMitDassSatz` sitzt in denselben vier Umkehrmustern, also
  // misst diese Schleife auch die neue `dass`-Regel am echten Bestand — Pflicht für Pflicht, ohne
  // eine Zeile Code hier. Das ist der Riegel gegen die teuerste Art, recht zu haben: eine zu breite
  // Regel würde die ausgelieferte Antwort selbst röten. Sie trägt „dass" nur als Teil von
  // „dasselbe" und nirgends hinter einem Komma — genau darauf zielt `\bdass\b` im Baustein.
  it("der echte Bestand besteht jede neue Prüfung einzeln", () => {
    const neu = U2_SYNONYME.map((s) => s.stamm);
    const verneinungenImBestand = DUBLETTEN_FAQ.flatMap((item) => [
      ...item.answer.matchAll(new RegExp(VERNEINUNG, "gi")),
    ]).length;
    expect(
      verneinungenImBestand,
      "ohne eine einzige Verneinung im Bestand misst dieser Fall nichts",
    ).toBeGreaterThan(0);
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

// ==================================================================================================
// JOB 3916 — DIE KALIBRIERUNG IN BEIDE RICHTUNGEN (BEN an JOB 3844, Prüfpunkt 6).
// ==================================================================================================
//
// BEN hat den Wächter aus JOB 3844 mit eigenen Proben nachgemessen und ZWEI Fehler gefunden
// (`archiv/3844/runde-1/ben.md:30`): „Beide bleiben keineswegs erhalten" passiert — eine
// Verschmelzungszusage ohne das Wort „nicht" rutscht durch; „Beide bleiben bestehen und werden nicht
// gelöscht" wird fälschlich beanstandet — ein ehrlicher Satz scheitert am Tor. Beides ist derselbe
// Fehler an zwei Enden: die Umkehrmuster hingen an EINEM Verneinungswort und an einem Fenster, das
// nur am Satzpunkt endete, also quer über mehrere Teilaussagen reichte.
//
// Jeder Satz steht hier EINZELN mit seinem erwarteten Befund. Alle sind über `umkehrtext` gebaut:
// allein der ausgetauschte Satz macht den Unterschied, der Rahmen bleibt derselbe.
//
// JOB 3939 SETZT DIE TABELLE FORT (V8, V9, E6–E9) — BENs drei nachgemessene Sätze aus
// `archiv/3916/runde-1/ben.md:29` und die ehrlichen Gegenstücke über getrennte Prädikate. Die
// Begründung zu beiden Bausteinen steht oben bei `VERNEINUNG`/`SELBE_AUSSAGE`.
const KALIBRIERUNG: readonly {
  readonly name: string;
  readonly text: string;
  readonly erwartet: readonly string[];
}[] = [
  // V1 = R1 des Auftrags, BENs Satz (a): rutschte durch, weil „keineswegs" kein „nicht" ist.
  {
    name: "V1 verkehrt · „beide bleiben keineswegs bestehen“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben keineswegs bestehen, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben keineswegs“"],
  },
  // V2 · „nie" ist das Wort, das der RAHMEN selbst benutzt (`:179`) — hier trägt es die Umkehr.
  {
    name: "V2 verkehrt · „beide bleiben nie bestehen“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben nie bestehen, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben nie“"],
  },
  // V3 · dieselbe Umkehr VORANGESTELLT: fällt bei einem Rückfall an der zweiten Musterhälfte auf.
  {
    name: "V3 verkehrt · „es können niemals beide bleiben“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: es können niemals beide bleiben, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „niemals beide bleiben“"],
  },
  // V4 · „kein" in der Rolle der Verneinung, mit Einschub — prüft Wortform UND Abstand zugleich.
  {
    name: "V4 verkehrt · „beide bleiben auf keinen Fall bestehen“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben auf keinen Fall bestehen, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben auf keinen“"],
  },
  // V5 · dieselbe Lücke an der PFLICHT „automatische Erkennung" — nicht nur an „beide bleiben".
  {
    name: "V5 verkehrt · „erkennt Überschneidungen keineswegs automatisch“",
    text: umkehrtext({
      erkennung:
        "Ein Duplikat liegt vor, wenn zwei Einträge inhaltlich dasselbe sagen — die App erkennt Überschneidungen keineswegs automatisch und zeigt erst nach deiner Suche, wie stark sich zwei Einträge decken.",
    }),
    erwartet: [
      "automatische Erkennung — umgekehrt: „erkennt Überschneidungen keineswegs automatisch“",
    ],
  },
  // V6 · dieselbe Lücke an der Pflicht „festgehaltener Grund": „keinerlei" ist kein „kein(en)".
  {
    name: "V6 verkehrt · „keinerlei Grund“",
    text: umkehrtext({
      abschluss:
        "Du schließt den Fund ab, hältst dabei aber keinerlei Grund fest: ob bewusst getrennt gelassen, als verwandt vermerkt oder Fehlalarm, bleibt offen.",
    }),
    erwartet: ["festgehaltener Grund — umgekehrt: „keinerlei Grund“"],
  },
  // V7 · dieselbe Lücke an der Pflicht „Grund bleibt nachlesbar" — das vierte Umkehrmuster.
  {
    name: "V7 verkehrt · „ein Prüfprotokoll gibt es niemals“",
    text: umkehrtext({
      protokoll:
        "Ein Prüfprotokoll dazu gibt es niemals; der Grund verschwindet mit dem Abschluss.",
    }),
    erwartet: ["Grund bleibt nachlesbar — umgekehrt: „protokoll dazu gibt es niemals“"],
  },
  // E1 = R2 des Auftrags, BENs Satz (b): ehrlich, die Verneinung trägt ein ANDERES Prädikat („und").
  {
    name: "E1 ehrlich · „Beide bleiben bestehen und werden nicht gelöscht.“",
    text: umkehrtext({ bestand: "Beide bleiben bestehen und werden nicht gelöscht." }),
    erwartet: [],
  },
  // E2 · ehrlich, diesmal durch KOMMA getrennt statt durch „und" — die zweite Grenzart.
  {
    name: "E2 ehrlich · „Beide bleiben unverändert bestehen, gelöscht wird nie etwas.“",
    text: umkehrtext({
      bestand: "Beide bleiben unverändert bestehen, gelöscht wird nie etwas.",
    }),
    erwartet: [],
  },
  // E3 · die Bauform des ECHTEN Bestands (`faqContent.ts:395`): drei „kein" vor „beide bleiben",
  // getrennt durch Komma, „und" und Gedankenstrich. Wird dieser Fall rot, rötet der Wächter die
  // ausgelieferte FAQ-Antwort selbst.
  {
    name: "E3 ehrlich · „… schreibt keinen um — beide bleiben unverändert bestehen.“",
    text: umkehrtext({
      bestand:
        "KLARWERK legt keinen gemeinsamen Eintrag an, löscht keinen der beiden und schreibt keinen um — beide bleiben unverändert bestehen.",
    }),
    erwartet: [],
  },
  // E4 · ehrlich an einer ZWEITEN Pflicht („Grund bleibt nachlesbar"): die Einschränkung gilt nicht
  // nur an „beide bleiben".
  {
    name: "E4 ehrlich · „Dieser Grund bleibt im Prüfprotokoll stehen und geht nicht verloren.“",
    text: umkehrtext({
      protokoll: "Dieser Grund bleibt im Prüfprotokoll stehen und geht nicht verloren.",
    }),
    erwartet: [],
  },
  // E5 · der unveränderte Rahmen. Ohne ihn misst die Tabelle womöglich den Rahmen statt den Satz.
  { name: "E5 ehrlich · der unveränderte Rahmen", text: umkehrtext({}), erwartet: [] },
  // ------------------------------------------------------------------------------------------
  // JOB 3939 — BENs drei Sätze aus `archiv/3916/runde-1/ben.md:29`, einzeln.
  // ------------------------------------------------------------------------------------------
  // V8 · die adversative Partikel steht MITTEN im Prädikat („bleiben aber nicht bestehen").
  // Vor JOB 3939 brach das Fenster an „aber" ab und erreichte das „nicht" nie — die Lüge passierte.
  {
    name: "V8 verkehrt · „beide bleiben aber nicht bestehen“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben aber nicht bestehen, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben aber nicht“"],
  },
  // V9 · derselbe Mechanismus über „doch", dazu eine Verneinung ohne das Wort „nicht".
  {
    name: "V9 verkehrt · „beide bleiben doch keineswegs erhalten“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben doch keineswegs erhalten, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben doch keineswegs“"],
  },
  // E6 · die Steigerungsform: „nicht nur X" BEHAUPTET X. Vor JOB 3939 schlug die erste
  // Musterhälfte auf „beide bleiben nicht" an und beanstandete einen ehrlichen Satz.
  {
    name: "E6 ehrlich · „Beide bleiben nicht nur sichtbar, sondern unverändert bestehen.“",
    text: umkehrtext({
      bestand: "Beide bleiben nicht nur sichtbar, sondern unverändert bestehen.",
    }),
    erwartet: [],
  },
  // E7 · die Gegenrichtung zu V8: „aber" steht in der ZWEITEN Teilaussage, die Verneinung gehört
  // zu deren eigenem Prädikat. Das Komma bleibt Grenze — die Lockerung darf sie nicht mitnehmen.
  {
    name: "E7 ehrlich · „Beide bleiben bestehen, gelöscht wird aber nie etwas.“",
    text: umkehrtext({ bestand: "Beide bleiben bestehen, gelöscht wird aber nie etwas." }),
    erwartet: [],
  },
  // E8 · dasselbe an einer ZWEITEN Pflicht („Grund bleibt nachlesbar"): die gelockerte Grenze wird
  // nicht nur an „beide bleiben" gemessen.
  {
    name: "E8 ehrlich · „… bleibt im Prüfprotokoll stehen, gelöscht wird er aber nie.“",
    text: umkehrtext({
      protokoll: "Dieser Grund bleibt im Prüfprotokoll stehen, gelöscht wird er aber nie.",
    }),
    erwartet: [],
  },
  // E9 · die „nicht nur"-Ausnahme an einer ZWEITEN Pflicht („festgehaltener Grund"). Vor JOB 3939
  // meldete `(?:ohne|VERNEINUNG){nah(20)}grund` hier „nicht nur mit einem Grund“.
  {
    name: "E9 ehrlich · „Du schließt den Fund nicht nur mit einem Grund ab, sondern …“",
    text: umkehrtext({
      abschluss:
        "Du schließt den Fund nicht nur mit einem Grund ab, sondern wählst dabei zwischen bewusst getrennt gelassen, als verwandt vermerkt und Fehlalarm.",
    }),
    erwartet: [],
  },
  // ------------------------------------------------------------------------------------------
  // JOB 3952 — DIE VERNEINUNG DES HAUPTSATZES REICHT IN DEN `dass`-SATZ (BEN an JOB 3939, `:29`).
  // ------------------------------------------------------------------------------------------
  // V10 · genau der Satz, den der Kopf dieser Datei seit JOB 3916 selbst als ungemessen führte.
  // Vor JOB 3952 gab `fehlendePflicht` dafür `[]` zurück: zwischen „nicht" und dem Pflichtwort
  // steht das Komma, an dem das Fenster endete — die Lüge passierte unbeanstandet ins Klara-Wissen.
  {
    name: "V10 verkehrt · „Es stimmt nicht, dass beide bleiben.“",
    text: umkehrtext({
      bestand:
        "Es stimmt nicht, dass beide bleiben. Der schwächere Eintrag fällt beim Abschluss weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „nicht, dass beide bleiben“"],
  },
  // V11 · DIESELBE Bauform an einer ZWEITEN Pflicht („festgehaltener Grund"). Eine Regel, die nur
  // an „beide bleiben" wirkt, ist keine Regel, sondern ein Sonderfall — dieselbe Begründung trägt
  // schon E4 und E8. Der Rest des Rahmensatzes bleibt stehen, damit allein die Umkehr den
  // Unterschied macht und nicht ein nebenher weggefallenes Pflichtwort (die drei Abschlüsse).
  {
    name: "V11 verkehrt · „Es stimmt nicht, dass ein Grund festgehalten wird.“",
    text: umkehrtext({
      abschluss:
        "Es stimmt nicht, dass ein Grund festgehalten wird: ob bewusst getrennt gelassen, als verwandt vermerkt oder Fehlalarm, bleibt offen.",
    }),
    erwartet: ["festgehaltener Grund — umgekehrt: „nicht, dass ein Grund“"],
  },
  // V12 · „jedoch" als EIGENER Tabellenfall (BENs Zusatzprobe, `archiv/3939/runde-1/ben.md:12`).
  // Dieser Fall ist seit JOB 3939 grün und deshalb kein Rotnachweis, sondern ein Riegel: „jedoch"
  // hing bis heute allein an der Wortliste in `SELBE_AUSSAGE` und am Kommentar darüber, gemessen
  // hatte es nur ein Prüfer von Hand. Nimmt jemand „jedoch" in die Grenzliste zurück, wird genau
  // dieser Satz rot — V8 („aber") und V9 („doch") merken davon nichts.
  {
    name: "V12 verkehrt · „beide bleiben jedoch nicht bestehen“",
    text: umkehrtext({
      bestand:
        "Aus zwei Einträgen wird am Ende einer: beide bleiben jedoch nicht bestehen, der schwächere Eintrag fällt weg.",
    }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „beide bleiben jedoch nicht“"],
  },
  // V13 · BENs zweite Zusatzprobe (`ben.md:12`): die Lüge mit DOPPELTER Verneinung. „nicht nur nicht
  // sichtbar, sondern verschwinden" steigert nichts, es kündigt das Verschwinden an. Damit ist die
  // „nicht nur"-Ausnahme nach BEIDEN Seiten kalibriert: E6/E9 zeigen, was sie durchlässt, V13 zeigt,
  // was sie NICHT durchlassen darf. WICHTIG beim Gegenproben: V13 ist auch OHNE die Ausnahme
  // beanstandet — den Fund trägt das ZWEITE „nicht" —, er ist deshalb KEIN Zeuge für sie.
  {
    name: "V13 verkehrt · „Beide bleiben nicht nur nicht sichtbar, sondern verschwinden.“",
    text: umkehrtext({ bestand: "Beide bleiben nicht nur nicht sichtbar, sondern verschwinden." }),
    erwartet: ["beide Einträge bleiben — umgekehrt: „Beide bleiben nicht nur nicht“"],
  },
  // E10 · die Verneinung steckt im `dass`-Satz, das Pflichtwort steht HINTER dem Gedankenstrich, also
  // in einem anderen Satzteil. Der Gedankenstrich bleibt Grenze. Ehrlich gemessen: hier sperren ZWEI
  // Dinge zugleich — der Gedankenstrich UND die Fensterweite (vom `dass` bis „beide" sind es 26
  // Zeichen, `nah(20)` reicht zwanzig). Der Fall belegt die Grenze also gemeinsam mit der Weite,
  // nicht die Grenze allein; deshalb bleibt er auch dann grün, wenn das Komma pauschal fällt.
  {
    name: "E10 ehrlich · „Es stimmt nicht, dass ein Eintrag verschwindet — beide bleiben …“",
    text: umkehrtext({
      bestand:
        "Es stimmt nicht, dass ein Eintrag verschwindet — beide bleiben unverändert bestehen.",
    }),
    erwartet: [],
  },
  // E11 · `dass` OHNE Verneinung davor. Pinnt, dass allein das Wort `dass` nichts auslöst: die Regel
  // hängt an der Verneinung, die in den Nebensatz hineinreicht, nicht am Nebensatz. Die Verneinung
  // im Satz danach („nie") gehört zu ihrem eigenen Prädikat und darf nicht herangezogen werden.
  {
    name: "E11 ehrlich · „Es stimmt, dass beide bleiben. Gelöscht wird nie etwas.“",
    text: umkehrtext({ bestand: "Es stimmt, dass beide bleiben. Gelöscht wird nie etwas." }),
    erwartet: [],
  },
  // E12 · das Pflichtwort steht IM `dass`-Satz, die Verneinung folgt in einer eigenen Teilaussage
  // hinter dem NÄCHSTEN Komma. Dieser Fall fordert die ERSTE Musterhälfte heraus
  // (`beide bleiben` → Verneinung): sie sucht nach rechts und darf das Komma weiterhin nicht
  // überschreiten. Gäbe jemand das Komma pauschal als Grenze auf, wäre dieser ehrliche Satz rot.
  {
    name: "E12 ehrlich · „KLARWERK sorgt dafür, dass beide bleiben, gelöscht wird nie etwas.“",
    text: umkehrtext({
      bestand: "KLARWERK sorgt dafür, dass beide bleiben, gelöscht wird nie etwas.",
    }),
    erwartet: [],
  },
  // E13 · „jedoch" ehrlich — das Gegenstück zu V12 und die dritte Partikel neben E7 („aber") und
  // V9/E8. Sie leitet hier eine ZWEITE Teilaussage ein, davor steht ein Komma, und das Komma bleibt
  // Grenze. BEN hat genau diesen Satz gemessen (`archiv/3939/runde-1/ben.md:12`).
  {
    name: "E13 ehrlich · „Beide bleiben bestehen, gelöscht wird jedoch nie etwas.“",
    text: umkehrtext({ bestand: "Beide bleiben bestehen, gelöscht wird jedoch nie etwas." }),
    erwartet: [],
  },
];

describe("JOB 3916/3939: der Umkehrwächter ist in beide Richtungen kalibriert", () => {
  for (const fall of KALIBRIERUNG) {
    it(fall.name, () => {
      // Keiner dieser Sätze trägt einen Verbotsstamm: sie messen allein die Umkehrerkennung.
      expect(verbotsfunde(fall.text), `${fall.name} · Verbotsliste`).toEqual([]);
      expect(fehlendePflicht(fall.text), fall.name).toEqual(fall.erwartet);
    });
  }
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
