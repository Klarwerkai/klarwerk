// ================================================================================================
// JOB 3833 — DER SATZ ÜBER DEN SPEICHERADAPTER HÄNGT AB JETZT AN SEINEM GEMESSENEN VERHALTEN.
// ================================================================================================
//
// WELCHEN SATZ DIESE DATEI BEWACHT. In `services/ask/src/service.ts` steht über der Konstante
// `ASK_PREFILTER_TERM_LIMIT` ein Erklärabsatz, der begründet, warum die Härtung der Vorauswahl
// heute noch nötig ist. Zwei Zeilen dieses Absatzes zählen je einen Adapter auf; diese Datei
// bewacht GENAU EINE davon — die über `InMemoryKoRepo` (heute `services/ask/src/service.ts:60`):
//
//     · InMemoryKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und schneidet danach,
//
// WOMIT SIE IHN BINDET: mit dem AUSGEFÜHRTEN Adapter, nicht mit einer zweiten Abschrift seines
// Quelltextes. `InMemoryKoRepo` braucht keine Datenbank; er ist im Prüfstand direkt aufrufbar.
// Die Fälle A1–A4 stellen ihm je einen eigenen, benannten Bestand und lesen die zurückgegebene
// Reihenfolge ab. Fall B liest die obige Zeile aus der Datei, gewinnt daraus die BEHAUPTETE
// Stufenfolge und hält jede Stufe und jedes Stufenpaar gegen eine eigene Messung am Adapter.
// Der Vergleichswert kommt damit aus dem Lauf, nicht aus einer Kette im Testquelltext (Lehre
// LEHREN.md 2026-09-13T00:13:38, JOB 3798 R1: nicht am Literal prüfen). Was diese Datei als
// Literal führt, ist ausschließlich das VOKABULAR der drei Stufen (welches Wort welche Stellschraube
// meint) und die Forderung, dass die Zeile alle drei nennt — WELCHE Stufe vorn steht und in welche
// RICHTUNG sie zeigt, sagt allein die Messung. Ohne die Vollzähligkeitsforderung wäre eine auf
// „(Trust ↓)" gekürzte Zeile widerspruchsfrei, weil eine einstufige Kette kein Paar mehr hätte.
//
// GANZE AUSSAGEN, KEINE STICHWÖRTER (BENs Korrekturpflicht 1 zu Runde 1). In Runde 1 erkannte der
// Leser eine Stufe an ihrem Kernwort — „nicht validiert ↓" galt ihm als „validiert ↓", und
// „und schneidet danach nicht, sondern vorher" als „und schneidet danach". Beide Verstellungen
// blieben gemessen GRÜN. Seither muss die Zeile ALS GANZES einer verstandenen Form entsprechen:
// Aufbau, jede einzelne Stufe samt Richtung und die Deckelaussage. Was diese Datei nicht versteht —
// ein eingeschobenes Wort, eine Verneinung, ein Zusatz —, macht B rot und wird mit dem
// vorgefundenen Wortlaut gemeldet. Die sieben Kalibrierungen K1 bis K7 IM Fall B halten das
// dauerhaft fest; sie verstellen dafür KOPIEN des Dateitextes im Speicher, nie die Datei. Dass sie
// in B stehen und nicht als eigene Fälle daneben, ist Absicht und am Fall selbst begründet.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT ZUSICHERT (Lieferung C des Auftrags):
//   · NICHTS über `PgKoRepo`, über die SQL-Kette in `services/knowledge-object/src/repo-pg.ts`
//     und nichts über einen echten PostgreSQL-Lauf. Sie erhebt die Pg-Kette kein zweites Mal;
//     das ist und bleibt Gegenstand von W1/W2/W3 in
//     `tests/ask-rangfolge-kommentar/erklaerung-und-abfrage-stimmen-ueberein.test.ts` und von
//     JOB 3583.
//   · NICHTS über das Laufzeitverhalten im Produkt, über Klara, Textprüfung oder Wissensprüfung,
//     nichts über Englisch/Niederländisch, keinen Browser, kein `dist`.
//
// DER BEFUND, DER ZUR EHRLICHKEIT GEHÖRT: `services/knowledge-object/src/repo.ts` hält an dieser
// Methode selbst fest, dass sie KEINEN PRODUKTAUFRUFER hat (JOB 3607) — der Suchweg läuft über
// `KoService.findCandidates` → `findSearchHits` → `KoSearchProjectionRepo.findActive`. Was die
// Reihenfolge hier entscheidet, entscheidet sie für Tests, nicht für die Produktflächen. Diese
// Datei behauptet deshalb KEINE Oberflächenwirkung. Ihr Wert ist eng und benannt: eine
// geschriebene Zusage in einer Produktionsdatei kann nicht mehr still falsch werden.
//
// ABGRENZUNG ZUR NACHBARWACHE (Lieferung D). `tests/ask-rangfolge-kommentar/…:333-342` (`pruefeService`)
// liest DENSELBEN Absatz — dort aber nur die `PgKoRepo`-Zeile, gehalten gegen die aus `PgKoRepo`
// gelesene SQL-Kette. Inhaltlich gehörten beide Messungen in eine Datei. Sie stehen trotzdem
// getrennt, weil `tests/ask-rangfolge-kommentar/**` Zielpfad des gleichzeitig laufenden JOB 3826
// ist und zwei Bahnen an derselben Datei ausgeschlossen sind. Die Vereinigung beider Wachen ist
// als REST bestellt, sobald 3826 LIVE ist.
//
// BEIDE ZEILEN TRAGEN HEUTE DENSELBEN WORTLAUT `(Term-Trefferzahl ↓, validiert ↓, Trust ↓)`. Eine
// Suche, die die falsche erwischt, wäre derselbe Fehler wie ein Wortlautvergleich. B wählt deshalb
// über den Adapternamen aus, verlangt GENAU EINE Stelle im Absatz, die `InMemoryKoRepo` überhaupt
// nennt (eine zweite könnte eine zweite, andere Rangfolge behaupten), und belegt in B-K7 an einer
// Textkopie, dass eine allein in der Pg-Zeile verstellte Datei die gelesene Zeile nicht verändert.
// Die tragende Kalibrierung bleibt die Gegenprobe (d) des Auftrags — dort wird auf der Platte
// allein die Speicherzeile verstellt, und die unveränderte Pg-Zeile hält B nicht grün.
//
// WENN B ROT WIRD, WEIL DER ABSATZ UMFORMULIERT WURDE: dann wird der Absatz nachgezogen, nicht der
// Test aufgeweicht. Die Zeile muss weiterhin die Form `· InMemoryKoRepo sortiert (<Stufen>)
// <Deckelaussage>` haben, in der Klammer die drei Stufen in ihrer WIRKLICHEN Reihenfolge und
// Richtung nennen und sagen, dass der Deckel danach schneidet. Wer sie anders formulieren will,
// erweitert `STUFEN`/`DECKELFORMEN` um die neue Form — bewusst, sichtbar und mit einer eigenen
// Kalibrierung. Ändert sich dagegen die Sortierung selbst, ist das ein Befund für eine eigene
// Zeile — diese Datei repariert `repo.ts` nicht.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject } from "../../services/knowledge-object";

const WURZEL = resolve(__dirname, "..", "..");
const ASK = "services/ask/src/service.ts";
const REPO = "services/knowledge-object/src/repo.ts";
const NACHBAR = "tests/ask-rangfolge-kommentar/erklaerung-und-abfrage-stimmen-ueberein.test.ts";

const ASK_TEXT = readFileSync(resolve(WURZEL, ASK), "utf8");
const REPO_TEXT = readFileSync(resolve(WURZEL, REPO), "utf8");

// ------------------------------------------------------------------------------------------------
// DIE ORTE. Jede Meldung nennt Datei und Zeile der bewachten Stelle — eine abstrahierte Rangfolge
// allein schickt den nächsten Leser auf die Suche. Die Zeilen werden GESUCHT, nicht gepinnt: ein
// eingefügter Kommentar darüber verschiebt sie sonst und macht die Meldung falsch. Findet sich ein
// Anker nicht mehr, sagt die Meldung genau das, statt eine Zeilennummer zu erfinden.
// ------------------------------------------------------------------------------------------------

/** `<pfad>:<zeile>` der ersten Zeile ab `ab`, die `fragment` trägt. */
function ort(text: string, pfad: string, fragment: string, ab = 0): string {
  const nr = text.split("\n").findIndex((z, i) => i >= ab && z.includes(fragment));
  return nr < 0 ? `${pfad}:? („${fragment}" steht dort nicht mehr)` : `${pfad}:${nr + 1}`;
}

/** Erste Zeile des Methodenrumpfs — von hier ab wird jeder Anker in `repo.ts` gesucht. */
const RUMPF_AB = Math.max(
  0,
  REPO_TEXT.split("\n").findIndex((z) =>
    z.includes("findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {"),
  ),
);
const ORT_GATE = ort(REPO_TEXT, REPO, ".filter((x) => x.score > 0)", RUMPF_AB);
const ORT_TREFFER = ort(REPO_TEXT, REPO, "b.score - a.score", RUMPF_AB);
const ORT_STATUS = ort(REPO_TEXT, REPO, 'Number(b.ko.status === "validiert")', RUMPF_AB);
const ORT_TRUST = ort(REPO_TEXT, REPO, "b.ko.trust - a.ko.trust", RUMPF_AB);
const ORT_DECKEL = ort(REPO_TEXT, REPO, ".slice(0, limit)", RUMPF_AB);
const ORT_SATZ = ort(ASK_TEXT, ASK, "· InMemoryKoRepo");

// ------------------------------------------------------------------------------------------------
// DER GESTELLTE BESTAND. Drei Stellschrauben, sonst nichts: wie viele Fragebegriffe ein Objekt
// abdeckt, ob es validiert ist und welchen Trust es trägt. Alles andere ist über alle Objekte
// gleich, damit eine gemessene Reihenfolge nur an der verstellten Schraube hängen kann.
// ------------------------------------------------------------------------------------------------

const BEGRIFF_A = "quarzader";
const BEGRIFF_B = "zinnober";
const TERME: readonly string[] = [BEGRIFF_A, BEGRIFF_B];

interface Form {
  /** 2 = deckt beide Fragebegriffe ab, 1 = nur den ersten. Beides ergibt einen Wert > 0. */
  readonly treffer: 1 | 2;
  readonly validiert: boolean;
  readonly trust: number;
}

/** Die Ausprägung, die in einer Messung NICHT befragt wird: über beide Objekte identisch. */
const NEUTRAL: Form = { treffer: 1, validiert: false, trust: 5 };

interface Eintrag {
  readonly id: string;
  readonly form: Form;
}

function eintrag(id: string, form: Form): Eintrag {
  return { id, form };
}

function baueKo(id: string, form: Form): KnowledgeObject {
  return {
    id,
    // `koCandidateText` sucht als TEILSTRING über Titel, Aussage, Schlagworte und Kategorie.
    // Die Begriffe stehen deshalb ausschließlich im Titel; Aussage und Kategorie tragen keinen.
    title: form.treffer === 2 ? `${BEGRIFF_A} ${BEGRIFF_B}` : BEGRIFF_A,
    statement: "Fester Begleittext ohne Fragebegriffe.",
    conditions: [],
    measures: [],
    type: "technik",
    category: "Pruefstand",
    tags: [],
    confidence: 0,
    trust: form.trust,
    status: form.validiert ? "validiert" : "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-13T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  };
}

/** Ein Lauf am ECHTEN Adapter: frischer Bestand, Einlagerung in der gegebenen Reihenfolge. */
async function reihenfolge(bestand: readonly Eintrag[], limit: number): Promise<string[]> {
  const repo = new InMemoryKoRepo();
  for (const e of bestand) {
    await repo.insert(baueKo(e.id, e.form));
  }
  const treffer = await repo.findCandidates({ terms: TERME, limit });
  return treffer.map((ko) => ko.id);
}

/**
 * Zustandsmodell (Auftrag §9): keine Aussage über eine Rangfolge ohne einen Lauf, der wirklich
 * Kandidaten geliefert hat. Erst wird ungedeckelt gemessen — dort MUSS jedes gestellte Objekt
 * auftauchen, sonst hat es den Wert 0 erzielt und wäre schon am Gate weggefallen. Ein leeres oder
 * lückenhaftes Ergebnis ist ein roter Fall mit eigenem Text, nie ein stillschweigend bestandener.
 */
async function messe(fall: string, bestand: readonly Eintrag[], limit: number): Promise<string[]> {
  const gestellt = bestand.map((e) => e.id);
  const voll = await reihenfolge(bestand, bestand.length);
  expect(
    [...voll].sort(),
    `${fall}: der ungedeckelte Lauf liefert nicht jedes gestellte Objekt — ${ORT_GATE} wirft alles mit Wert 0 weg. Geliefert: [${voll.join(", ")}]; gestellt: [${gestellt.join(", ")}]. Ohne vollständige Kandidatenmenge ist die Reihenfolge keine Aussage.`,
  ).toEqual([...gestellt].sort());
  const geschnitten = await reihenfolge(bestand, limit);
  expect(
    geschnitten.length,
    `${fall}: der Lauf mit limit ${limit} lieferte NICHTS — über eine leere Menge ist keine Rangfolge zu messen (${ORT_DECKEL}).`,
  ).toBeGreaterThan(0);
  return geschnitten;
}

function fehltext(
  fall: string,
  stelle: string,
  was: string,
  geliefert: readonly string[],
  erwartet: readonly string[],
): string {
  return `${fall}: ${stelle} — ${was}. Geliefert: [${geliefert.join(", ")}]; erwartet: [${erwartet.join(", ")}]. Bewacht wird der Satz in ${ORT_SATZ}.`;
}

describe("A · die drei Stufen und der Deckel, einzeln am ausgeführten InMemoryKoRepo gemessen", () => {
  it("A1 — die Term-Trefferzahl schlägt validiert UND Trust", async () => {
    // Das beste Objekt ist in JEDER anderen Hinsicht das schwächere: Entwurf, niedriger Trust.
    // Es liegt vorn im Bestand, damit dieser Fall allein an der SORTIERUNG hängt und nicht daran,
    // wann der Deckel schneidet — das misst A4.
    const bestand = [
      eintrag("zwei-begriffe-entwurf-trust2", { treffer: 2, validiert: false, trust: 2 }),
      eintrag("ein-begriff-validiert-trust9", { treffer: 1, validiert: true, trust: 9 }),
    ];
    const geliefert = await messe("A1", bestand, 1);
    expect(
      geliefert,
      fehltext(
        "A1",
        ORT_TREFFER,
        "die erste Stufe entscheidet nicht: der Treffer über ZWEI Fragebegriffe unterliegt einem validierten Treffer über EINEN mit höherem Trust",
        geliefert,
        ["zwei-begriffe-entwurf-trust2"],
      ),
    ).toEqual(["zwei-begriffe-entwurf-trust2"]);
  });

  it("A2 — bei gleicher Trefferzahl steht validiert vor höherem Trust", async () => {
    const bestand = [
      eintrag("validiert-trust2", { treffer: 1, validiert: true, trust: 2 }),
      eintrag("entwurf-trust9", { treffer: 1, validiert: false, trust: 9 }),
    ];
    const geliefert = await messe("A2", bestand, 2);
    expect(
      geliefert,
      fehltext(
        "A2",
        ORT_STATUS,
        "die zweite Stufe entscheidet nicht vor der dritten: bei gleicher Trefferzahl steht nicht das validierte Objekt vorn, sondern das mit dem höheren Trust",
        geliefert,
        ["validiert-trust2", "entwurf-trust9"],
      ),
    ).toEqual(["validiert-trust2", "entwurf-trust9"]);
  });

  it("A3 — bei gleicher Trefferzahl und gleichem Status entscheidet der höhere Trust", async () => {
    const bestand = [
      eintrag("entwurf-trust9", { treffer: 1, validiert: false, trust: 9 }),
      eintrag("entwurf-trust2", { treffer: 1, validiert: false, trust: 2 }),
    ];
    const geliefert = await messe("A3", bestand, 2);
    expect(
      geliefert,
      fehltext(
        "A3",
        ORT_TRUST,
        "die dritte Stufe steht falsch herum: bei gleicher Trefferzahl und gleichem Status kommt nicht der höhere Trust zuerst",
        geliefert,
        ["entwurf-trust9", "entwurf-trust2"],
      ),
    ).toEqual(["entwurf-trust9", "entwurf-trust2"]);
  });

  it("A4 — der Deckel schneidet NACH dem Sortieren", async () => {
    // Der beste Treffer wird als LETZTES eingelagert und ist in jeder Stufe der stärkste. Damit
    // hängt dieser Fall allein an der REIHENFOLGE von Sortieren und Schneiden: würde vor dem
    // Sortieren geschnitten, käme der erstbeste Einfügetreffer.
    const stoerer: Form = { treffer: 1, validiert: false, trust: 2 };
    const bestand = [
      eintrag("stoerer-1", stoerer),
      eintrag("stoerer-2", stoerer),
      eintrag("stoerer-3", stoerer),
      eintrag("bester-zuletzt-eingelagert", { treffer: 2, validiert: true, trust: 9 }),
    ];
    const geliefert = await messe("A4", bestand, 1);
    expect(
      geliefert,
      fehltext(
        "A4",
        ORT_DECKEL,
        "der Deckel schneidet VOR dem Sortieren: der zuletzt eingelagerte beste Treffer fällt weg, obwohl er in jeder Stufe vorn läge",
        geliefert,
        ["bester-zuletzt-eingelagert"],
      ),
    ).toEqual(["bester-zuletzt-eingelagert"]);
  });
});

// ------------------------------------------------------------------------------------------------
// B · DIE BINDUNG DES SATZES — UND WARUM DER LESER GANZE AUSSAGEN LIEST, NICHT STICHWÖRTER.
// ------------------------------------------------------------------------------------------------
//
// BENS BEFUND ZU RUNDE 1 (Korrekturpflicht 1). Der Leser erkannte eine Stufe an ihrem Kernwort. Zwei
// gemessene Folgen: aus „validiert ↓" wurde „nicht validiert ↓" und aus „und schneidet danach" wurde
// „und schneidet danach nicht, sondern vorher" — beide Male blieb die Wache GRÜN, obwohl die Zeile
// nun das Gegenteil behauptete. Ein Kernworttreffer ist keine Aussage.
//
// DIE REGEL SEITHER: Die Zeile wird ALS GANZES gelesen. Ihr Aufbau, jede Stufe in der Klammer und
// die Deckelaussage dahinter müssen VOLLSTÄNDIG einer verstandenen Form entsprechen. Alles, was
// diese Datei nicht versteht — ein eingeschobenes Wort, eine Verneinung, ein Zusatz —, macht B rot
// und wird mit dem vorgefundenen Wortlaut gemeldet. Lieber ein rotes „das verstehe ich nicht" als
// ein grünes „da stand ja das Wort".
//
// WAS DABEI GEMESSEN UND WAS GELESEN WIRD, sauber getrennt:
//   · Die REIHENFOLGE der Stufen und die RICHTUNG jeder Stufe werden gemessen (`messbefunde`); im
//     Testquelltext steht dazu kein Sollwert, nur das Vokabular „welches Wort meint welche
//     Stellschraube". Ein „Trust ↑" in der Prosa wird rot, weil der Lauf „↓" liefert.
//   · Die DECKELAUSSAGE („und schneidet danach") wird nur GELESEN, streng: sie muss genau einer
//     verstandenen Form entsprechen, und die verstandene Form muss die sein, die nach dem Sortieren
//     schneidet. Das Verhalten dahinter misst A4. Diese Trennung ist Absicht: sonst wäre jede
//     Verstellung am Deckel doppelt rot und A4 nicht mehr der Fall, der sie allein trägt.

interface Stufe {
  readonly kennung: string;
  /** findet die Stufe, um die eine Marke überhaupt geht — bewusst grob. */
  readonly kern: RegExp;
  /** die EINZIGE verstandene Schreibweise dieser Marke, samt Richtung. Alles andere ist rot. */
  readonly form: RegExp;
  /** Datei und Zeile der Stufe in `repo.ts` */
  readonly ort: string;
  stark(f: Form): Form;
  schwach(f: Form): Form;
}

const STUFEN: readonly Stufe[] = [
  {
    kennung: "Trefferzahl",
    kern: /Trefferzahl/i,
    form: /^(?:Term-)?Trefferzahl (↓|↑)$/,
    ort: ORT_TREFFER,
    stark: (f) => ({ ...f, treffer: 2 }),
    schwach: (f) => ({ ...f, treffer: 1 }),
  },
  {
    kennung: "validiert",
    kern: /validiert/i,
    form: /^validiert (↓|↑)$/,
    ort: ORT_STATUS,
    stark: (f) => ({ ...f, validiert: true }),
    schwach: (f) => ({ ...f, validiert: false }),
  },
  {
    kennung: "Trust",
    kern: /\btrust\b/i,
    form: /^Trust (↓|↑)$/,
    ort: ORT_TRUST,
    stark: (f) => ({ ...f, trust: 9 }),
    schwach: (f) => ({ ...f, trust: 2 }),
  },
];

/**
 * Die verstandenen Deckelaussagen. `nachSortieren: false` heisst nicht „unverstanden", sondern
 * „verstanden und falsch" — auch die Pg-Form steht hier, damit ein vertauschter Schwanz auffällt
 * und nicht als Unbekanntes durchrutscht.
 */
const DECKELFORMEN: readonly { readonly form: RegExp; readonly nachSortieren: boolean }[] = [
  { form: /^und schneidet danach$/, nachSortieren: true },
  { form: /^und schneidet erst danach$/, nachSortieren: true },
  { form: /^und schneidet davor$/, nachSortieren: false },
  { form: /^und schneidet vorher$/, nachSortieren: false },
  { form: /^und schneidet zuerst$/, nachSortieren: false },
  { form: /^und deckelt in der Abfrage$/, nachSortieren: false },
];

/**
 * Der einzige verstandene Aufbau der Zeile. Er ist bewusst starr: zwischen „sortiert" und der
 * Klammer darf NICHTS stehen (sonst käme „sortiert NICHT (…)" durch), und hinter der Klammer folgt
 * genau eine Deckelaussage, die unten einzeln geprüft wird.
 */
const ZEILENFORM = /^· InMemoryKoRepo(?:\.findCandidates)? sortiert \(([^()]+)\) (.+?)\s*[,.]?$/;

interface GelesenerSatz {
  readonly zeile: string;
  readonly ort: string;
  readonly stufen: readonly { marke: string; stufe: Stufe; richtung: string }[];
}

/**
 * Liest die Zeile über den SPEICHERadapter aus dem übergebenen Dateitext. Jeder Textmangel wirft —
 * mit Datei, Zeile und dem vorgefundenen Wortlaut. Diese Funktion misst NICHTS; genau deshalb lässt
 * sie sich unten an verstellten Textkopien kalibrieren, ohne die Datei auf der Platte anzufassen.
 */
function liesSpeicherzeile(text: string): GelesenerSatz {
  const stelle = ort(text, ASK, "· InMemoryKoRepo");
  const erwaehnungen = prosaBlock(text)
    .split("\n")
    .filter((z) => z.includes("InMemoryKoRepo"));
  const roh = erwaehnungen[0];
  if (erwaehnungen.length !== 1 || roh === undefined) {
    throw new Error(
      `${stelle}: der Absatz nennt den Speicheradapter nicht genau einmal (gefunden: ${erwaehnungen.length}). Eine zweite Stelle könnte eine zweite, andere Rangfolge behaupten; dann sagt der Absatz zweierlei und diese Wache bewacht nur eine Hälfte.`,
    );
  }
  const zeile = roh.trim();
  const treffer = ZEILENFORM.exec(zeile);
  if (treffer === null) {
    throw new Error(
      `${stelle}: die Zeile hat nicht die verstandene Form „· InMemoryKoRepo sortiert (<Stufen>) <Deckelaussage>". Vorgefunden: „${zeile}". Ein Zusatz zwischen „sortiert" und der Klammer — etwa eine Verneinung — wird hier absichtlich NICHT überlesen.`,
    );
  }
  const marken = (treffer[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const stufen = marken.map((marke) => {
    const passend = STUFEN.filter((s) => s.kern.test(marke));
    const stufe = passend[0];
    if (passend.length !== 1 || stufe === undefined) {
      throw new Error(
        `${stelle}: die Stufe „${marke}" gehört zu keiner oder zu mehreren bekannten Stellschrauben (getroffen: ${passend.length}). Bekannt sind ${STUFEN.map((s) => s.kennung).join(", ")} (${ORT_TREFFER}, ${ORT_STATUS}, ${ORT_TRUST}). Vorgefunden: „${zeile}".`,
      );
    }
    const genau = stufe.form.exec(marke);
    const richtung = genau?.[1];
    if (genau === null || richtung === undefined) {
      throw new Error(
        `${stelle}: die Stufe „${marke}" ist nicht in der verstandenen Form geschrieben (erwartet „${stufe.kennung} ↓" oder „${stufe.kennung} ↑", nichts davor, nichts danach). Ein Zusatz wie eine Verneinung kehrt die Aussage um und darf nicht als Treffer auf „${stufe.kennung}" durchgehen. Vorgefunden: „${zeile}".`,
      );
    }
    return { marke, stufe, richtung };
  });
  const kennungen = stufen.map((s) => s.stufe.kennung).sort();
  const erwartet = STUFEN.map((s) => s.kennung).sort();
  if (kennungen.join("|") !== erwartet.join("|")) {
    throw new Error(
      `${stelle}: die Zeile nennt nicht alle drei Stufen genau einmal (gelesen: ${kennungen.join(", ") || "keine"}; der Adapter sortiert in drei Stufen: ${ORT_TREFFER}, ${ORT_STATUS}, ${ORT_TRUST}). Vorgefunden: „${zeile}". Eine gekürzte Kette hätte kein Stufenpaar mehr zu vergleichen und wäre still widerspruchsfrei.`,
    );
  }
  const schwanz = (treffer[2] ?? "").trim();
  const deckel = DECKELFORMEN.find((d) => d.form.test(schwanz));
  if (deckel === undefined) {
    throw new Error(
      `${stelle}: die Deckelaussage „${schwanz}" ist keine verstandene Aussage. Verstanden werden nur „und schneidet danach", „und schneidet erst danach", „und schneidet davor/vorher/zuerst" und „und deckelt in der Abfrage". Vorgefunden: „${zeile}". Was diese Datei nicht versteht, gilt als unbewacht und damit als rot.`,
    );
  }
  if (!deckel.nachSortieren) {
    throw new Error(
      `${stelle}: die Zeile sagt mit „${schwanz}", dass NICHT erst sortiert und dann geschnitten wird. Gemessen wird das Gegenteil — der Deckel steht hinter der Sortierung (${ORT_DECKEL}), belegt von Fall A4. Vorgefunden: „${zeile}".`,
    );
  }
  return { zeile, ort: stelle, stufen };
}

/**
 * Wer von zwei Ausprägungen vorn landet — GEMESSEN, und zwar zweimal: einmal mit `a` vorn im
 * Bestand, einmal mit `b` vorn. Nur wenn beide Läufe denselben Sieger nennen, hat wirklich die
 * Sortierung entschieden. Sonst lag die Einlagerungsreihenfolge zugrunde, und das ist kein Urteil.
 */
async function werGewinnt(a: Form, b: Form): Promise<string> {
  const vorn = await reihenfolge([eintrag("erster", a), eintrag("zweiter", b)], 2);
  const hinten = await reihenfolge([eintrag("zweiter", b), eintrag("erster", a)], 2);
  const s1 = vorn[0];
  const s2 = hinten[0];
  if (vorn.length !== 2 || hinten.length !== 2 || s1 === undefined || s2 === undefined) {
    return `unvollständig (${vorn.length}/${hinten.length} Kandidaten)`;
  }
  return s1 === s2 ? s1 : "unentschieden (die Einlagerungsreihenfolge entschied, nicht die Stufe)";
}

/**
 * Hält den GELESENEN Satz gegen den ausgeführten Adapter: je Stufe die Richtung, je Stufenpaar die
 * Vorfahrt. Der Sollwert ist immer die Prosa, der Istwert immer ein Lauf — kein Vergleich gegen eine
 * im Test aufgeschriebene Kette. Liefert die Liste der Widersprüche; leer heisst „stimmt überein".
 */
async function messbefunde(gelesen: GelesenerSatz): Promise<string[]> {
  const befunde: string[] = [];
  for (const { marke, stufe, richtung } of gelesen.stufen) {
    const gewinner = await werGewinnt(stufe.stark(NEUTRAL), stufe.schwach(NEUTRAL));
    const gemessen = gewinner === "erster" ? "↓" : gewinner === "zweiter" ? "↑" : gewinner;
    if (gemessen !== richtung) {
      befunde.push(
        `${gelesen.ort} behauptet „${marke}". Gemessen an ${stufe.ort} (alle anderen Stellschrauben gleich): ${gemessen}.`,
      );
    }
  }
  for (let i = 0; i < gelesen.stufen.length; i += 1) {
    for (let j = i + 1; j < gelesen.stufen.length; j += 1) {
      const vorne = gelesen.stufen[i];
      const hinten = gelesen.stufen[j];
      if (vorne === undefined || hinten === undefined) {
        continue;
      }
      const gewinner = await werGewinnt(
        hinten.stufe.schwach(vorne.stufe.stark(NEUTRAL)),
        vorne.stufe.schwach(hinten.stufe.stark(NEUTRAL)),
      );
      if (gewinner !== "erster") {
        befunde.push(
          `${gelesen.ort} stellt „${vorne.marke}" vor „${hinten.marke}". Gemessen an ${vorne.stufe.ort} gegen ${hinten.stufe.ort}: vorn steht „${gewinner}" — das Objekt, das nur „${hinten.marke}" für sich hat, gewinnt.`,
        );
      }
    }
  }
  return befunde;
}

/** Der Erklärabsatz über `ASK_PREFILTER_TERM_LIMIT` — über den Syntaxbaum, keine Volltextsuche. */
function prosaBlock(text: string): string {
  const datei = ts.createSourceFile(ASK, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const treffer = datei.statements.filter(
    (n) =>
      ts.isVariableStatement(n) &&
      n.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === "ASK_PREFILTER_TERM_LIMIT",
      ),
  );
  const knoten = treffer[0];
  if (treffer.length !== 1 || knoten === undefined) {
    throw new Error(
      `${ASK}: der Kommentaranker ASK_PREFILTER_TERM_LIMIT fehlt oder ist mehrdeutig; gefunden: ${treffer.length}`,
    );
  }
  return (ts.getLeadingCommentRanges(text, knoten.getFullStart()) ?? [])
    .map((r) => text.slice(r.pos, r.end))
    .join("\n")
    .replace(/^\s*\/\/ ?/gm, "");
}

// ------------------------------------------------------------------------------------------------
// DIE DAUERHAFTEN KALIBRIERUNGEN. Jede verstellt eine KOPIE des Dateitextes im Speicher — die Datei
// auf der Platte wird nie angefasst — und verlangt, dass der Leser die Verstellung ABWEIST. Die
// ersten beiden sind wörtlich BENs Gegenproben aus Runde 1, die in Runde 1 grün blieben.
// ------------------------------------------------------------------------------------------------

/** Ersetzt in der Speicherzeile — und NUR dort — ein Stück Text. Wirft, wenn nichts ersetzt wurde. */
function verstelleSpeicherzeile(text: string, suche: string, ersatz: string): string {
  const zeile = prosaBlock(text)
    .split("\n")
    .find((z) => z.includes("InMemoryKoRepo"))
    ?.trim();
  if (zeile === undefined || !zeile.includes(suche)) {
    throw new Error(`Kalibrierung nicht möglich: „${suche}" steht nicht in der Speicherzeile`);
  }
  const verstellt = text.replace(zeile, zeile.replace(suche, ersatz));
  if (verstellt === text) {
    throw new Error("Kalibrierung nicht möglich: die Speicherzeile blieb unverändert");
  }
  return verstellt;
}

/** Gibt die Meldung des Lesers zurück — oder wird selbst laut, wenn er die Verstellung annimmt. */
function abgewiesen(text: string, was: string): string {
  try {
    liesSpeicherzeile(text);
  } catch (fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
  }
  throw new Error(
    `B Kalibrierung „${was}": der Leser hat die verstellte Speicherzeile ANGENOMMEN. Eine falsche Behauptung in ${ORT_SATZ} bliebe damit grün — genau BENs Befund aus Runde 1.`,
  );
}

describe("B · der Satz in service.ts und der gemessene Adapter stimmen überein", () => {
  // EIN Fall, nicht acht. Die Kalibrierungen K1–K7 gehören in denselben Fall wie die Prüfung, die
  // sie kalibrieren: sie gehen vom ECHTEN Dateitext aus (keine positive Ersatzfassung, Lehre
  // JOB 3617), und eine falsch gewordene Speicherzeile macht sie damit zwangsläufig mit rot. Als
  // eigene Fälle wären sie ein zweiter, dritter, vierter roter Fall neben B und würden die klare
  // Aussage der Pflichtgegenprobe (d) — „GENAU B rot" — zerstören.
  it("B — die ganze Zeile wird verstanden, jede Stufe hält der Messung stand", async () => {
    const gelesen = liesSpeicherzeile(ASK_TEXT);
    expect(
      await messbefunde(gelesen),
      `B: die Erklärung in ${gelesen.ort} und das gemessene Verhalten von InMemoryKoRepo gehen auseinander. Gelesen: „${gelesen.zeile}".`,
    ).toEqual([]);

    // K1 — BENs Gegenprobe 1 aus Runde 1: „nicht validiert ↓" blieb damals grün.
    const k1 = abgewiesen(
      verstelleSpeicherzeile(ASK_TEXT, "validiert ↓", "nicht validiert ↓"),
      "nicht validiert ↓",
    );
    expect(k1, "B K1: die Meldung nennt nicht Datei und Zeile").toContain(ORT_SATZ);
    expect(k1, "B K1: die Meldung nennt nicht den vorgefundenen Wortlaut").toContain(
      "nicht validiert ↓",
    );

    // K2 — BENs Gegenprobe 2 aus Runde 1: „schneidet danach nicht, sondern vorher" blieb grün.
    const k2 = abgewiesen(
      verstelleSpeicherzeile(
        ASK_TEXT,
        "und schneidet danach",
        "und schneidet danach nicht, sondern vorher",
      ),
      "und schneidet danach nicht, sondern vorher",
    );
    expect(k2, "B K2: die Meldung nennt nicht Datei und Zeile").toContain(ORT_SATZ);
    expect(k2, "B K2: die Meldung nennt nicht den vorgefundenen Wortlaut").toContain(
      "und schneidet danach nicht, sondern vorher",
    );

    // K3 — eine VERSTANDENE, aber falsche Deckelaussage. Sie darf nicht als „unbekannt" abgetan
    // werden, sondern muss auf das gemessene Gegenteil zeigen.
    const k3 = abgewiesen(
      verstelleSpeicherzeile(ASK_TEXT, "und schneidet danach", "und schneidet davor"),
      "und schneidet davor",
    );
    expect(k3, "B K3: die Meldung nennt nicht Datei und Zeile").toContain(ORT_SATZ);
    expect(k3, "B K3: die Meldung verweist nicht auf den gemessenen Deckel").toContain(ORT_DECKEL);

    // K4 — eine Verneinung VOR der Klammer. Der Klammerinhalt bliebe dabei wortgleich richtig.
    const k4 = abgewiesen(
      verstelleSpeicherzeile(ASK_TEXT, "sortiert (", "sortiert NICHT ("),
      "sortiert NICHT (…)",
    );
    expect(k4, "B K4: die Meldung nennt nicht Datei und Zeile").toContain(ORT_SATZ);
    expect(k4, "B K4: die Meldung nennt nicht den vorgefundenen Wortlaut").toContain(
      "sortiert NICHT (",
    );

    // K5 — eine gekürzte Kette. Ohne diese Forderung hätte eine einstufige Kette kein Paar mehr.
    const k5 = abgewiesen(
      verstelleSpeicherzeile(ASK_TEXT, "Term-Trefferzahl ↓, ", ""),
      "Kette ohne die Trefferzahl",
    );
    expect(k5, "B K5: die Meldung nennt nicht Datei und Zeile").toContain(ORT_SATZ);
    expect(k5, "B K5: die Meldung nennt die Zahl der Stufen nicht").toContain("drei Stufen");

    // K6 — greift HINTER den Leser: „Trust ↑" ist eine verstandene Schreibweise und kommt durch;
    // scheitern muss sie am ausgeführten Adapter. Damit ist belegt, dass die Richtung gemessen und
    // nicht nur gelesen wird.
    const k6 = await messbefunde(
      liesSpeicherzeile(verstelleSpeicherzeile(ASK_TEXT, "Trust ↓", "Trust ↑")),
    );
    expect(
      k6.join(" | "),
      'B K6: die behauptete Richtung „Trust ↑" blieb bei der Messung unbeanstandet',
    ).toContain("Trust ↑");

    // K7 — der Leser trifft die Speicherzeile, nicht die wortgleiche PgKoRepo-Zeile: eine NUR dort
    // verstellte Textkopie darf die gelesene Zeile nicht verändern.
    const pgZeilen = prosaBlock(ASK_TEXT)
      .split("\n")
      .filter((z) => /^\s*·\s*PgKoRepo(?:\.findCandidates)?\s+sortiert\b/.test(z))
      .map((z) => z.trim());
    expect(
      pgZeilen.length,
      `B K7: ${ASK} führt keine eindeutige PgKoRepo-Zeile mehr — ohne sie ist nicht zu belegen, dass B die richtige der beiden gleichlautenden Zeilen liest.`,
    ).toBe(1);
    const pg = pgZeilen[0] ?? "";
    const nurPgVerstellt = ASK_TEXT.replace(pg, pg.replace("Term-Trefferzahl ↓, ", ""));
    expect(nurPgVerstellt, "B K7: die Pg-Zeile liess sich nicht verstellen").not.toBe(ASK_TEXT);
    expect(
      liesSpeicherzeile(nurPgVerstellt).zeile,
      `B K7: eine NUR in der PgKoRepo-Zeile verstellte Textkopie verändert die gelesene Zeile — B liest die falsche der beiden (${ORT_SATZ}). Die Pg-Zeile gehört der Nachbarwache ${NACHBAR}; hier wird über sie nichts zugesichert.`,
    ).toBe(gelesen.zeile);
  });
});
