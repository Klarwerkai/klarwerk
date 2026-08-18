// ================================================================================================
// JOB 1127 · D1 — EINFÜHRUNGSTEXTE VERSPRECHEN KEINE UNBELEGTE MODELLVERBESSERUNG.
// ================================================================================================
//
// HERKUNFT. JOB 962 (PRO3) hat das Lehrlingsbild inventarisiert und gemessen, dass die tragende
// Hälfte („fragt nach") gedeckt ist, die versprechende Hälfte („wird durch Korrektur besser") aber
// NICHT: `finetune` 0 Dateien, „verbessert sich" 0, eine Lernschleife existiert nicht. Daraus wurde
// der Kommunikationsvertrag mit vier Missverständnisfällen M1–M4 und den Zusicherungen V1–V3.
// BEN3 hat daraus zwei Sätze wörtlich verlangt:
//
//     Prüflücke 1: „bei Umsetzung einen Guard über `apps/web/src/i18n.ts` und
//     `docs/onboarding/user-quickstart.md`, Fall: Begriffe `lernt dazu|wird besser|trainier*` im
//     Systemkontext, erwartetes Ergebnis: Test schlägt fehl."
//
//     Promptverbesserung: „Baue zuerst einen Textwächter, der Verbesserungs-/Trainingsversprechen
//     im Systemkontext rot macht; Gegenmutation mit mindestens einem M-Satz muss fehlschlagen."
//
// DAS SCHWIERIGE DARAN IST NICHT DAS FINDEN, SONDERN DAS NICHT-FINDEN. Ein Wächter, der schlicht
// auf `lernt|trainier|besser` sucht, ist am heutigen Bestand sofort rot — und zwar zu Unrecht.
// Gemessen am gebundenen Stand tragen diese Wörter durchweg MENSCHLICHE Subjekte oder fremde
// Objekte:
//
//   · `:435`  „Klarwerk sammelt, was deine Kolleginnen und Kollegen im Betrieb gelernt haben"
//   · `:3930` „ohne sie kann der Autor nichts lernen und nichts korrigieren"
//   · `:547`  „Verbessert die gemeinsame Wissensbasis"   (Objekt = Wissensbasis, nicht das Modell)
//   · `:480`  „Offene Lernpfad-Schritte"                  (ein Leseweg für Menschen)
//   · `:3711` „Schulung" / `:8012` „Training"             (ein Dokumententyp)
//   · `user-quickstart.md:72` „Verbesserungswünsche … an den Betreiber"
//
// Ein Wortfilter würde all das rot machen, und der erste, der ihn wartet, würde ihn abschalten —
// „was von Disziplin abhängt, überlebt keine Nacht" (I39, zitiert in JOB 962 §5.4). Der Wächter
// muss deshalb das SUBJEKT binden: verboten ist nicht das Wort, sondern die Zusage, dass DAS
// SYSTEM durch Benutzung besser wird. Genau das meint BEN3 mit „im Systemkontext".
//
// DER ECHTE PRODUKTPFAD, keine Quelltextkopie: die i18n-Fälle lesen die Ressourcen aus dem
// initialisierten `i18n`-Objekt (`apps/web/src/i18n.ts:12877` — `resources: {de, en, nl}`), also
// exakt die Strings, die die Oberfläche zur Laufzeit ausliefert. Der Onboarding-Fall liest die
// ausgelieferte Datei selbst. Beides ist die Wirkung, nicht ihre Beschreibung.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// ------------------------------------------------------------------------------------------------
// DIE REGEL
// ------------------------------------------------------------------------------------------------
// Drei Familien, weil der Kommunikationsvertrag drei verschiedene Fehler kennt. A und B sind
// BEN3s „Systemkontext" wörtlich; C fängt M2/M3, die kein Lernwort enthalten und einem reinen
// Verbesserungswächter deshalb entgehen würden.

/** Wer im Text „das System" ist — in allen drei ausgelieferten Sprachen. */
const SYSTEM =
  "(?:klarwerk|klara|die ki|der ki|das ki|die künstliche intelligenz|das system|das modell|der lehrling|the ai|the system|the model|the apprentice|het systeem|de ai|het model|de leerling)";

/** Das System wird von selbst besser. */
const SELBSTVERBESSERUNG =
  "(?:lernt|lernen|lernst|dazulernt|wird besser|werden besser|besser wird|verbessert sich|verbessern sich|klüger|schlauer|learns|learn|gets better|get better|becomes better|improves itself|smarter|leert|leren|wordt beter|slimmer)";

/**
 * Die deutsche Satzklammer, getrennt modelliert: „Klarwerk **wird** mit jeder Korrektur
 * **besser**" trägt sein Prädikat auf zwei Wörter verteilt, zwischen denen beliebig viel stehen
 * darf. Gemessen: ohne diese zweite Form blieb genau der M1-Satz aus JOB 962 §5.2 unentdeckt —
 * der Wächter hätte den namentlich verbotenen Satz durchgelassen (Lauf `lauf-02-korrigiert.log`,
 * B-4 und C-1 rot). Englisch und Niederländisch bilden dieselbe Klammer.
 */
const KOPULA = "(?:wird|werden|ist|sind|wurde|wurden|is|are|becomes|gets|wordt|worden)";
const KOMPARATIV = "(?:besser|klüger|schlauer|better|smarter|beter|slimmer)";

/** Das System ist Gegenstand eines Trainings. */
const TRAINING = "(?:trainier\\w*|train|trains|trained|training|traint|trainen|getraind)";

/**
 * Bindungsfenster: höchstens 40 Zeichen zwischen Subjekt und Prädikat, und darin KEIN Satzzeichen.
 *
 * Das Satzzeichen ist der eigentliche Trennschnitt und nicht bloß Kosmetik: „Klarwerk sammelt,
 * was deine Kolleginnen und Kollegen … gelernt haben" bricht am Komma nach „sammelt" — das
 * Prädikat gehört dort einem anderen Subjekt. Ohne diese Bedingung wäre der Satz rot, obwohl er
 * genau das Richtige sagt.
 */
const BINDUNG = "[^.!?;:,\\n]{0,40}";

const regel = (muster: string): RegExp => new RegExp(muster, "i");

const REGELN: readonly { id: string; was: string; muster: RegExp }[] = [
  {
    id: "A",
    was: "Selbstverbesserung des Systems",
    muster: regel(
      `(?:\\b${SYSTEM}\\b${BINDUNG}\\b${SELBSTVERBESSERUNG}\\b)` +
        `|(?:\\b${SYSTEM}\\b${BINDUNG}\\b${KOPULA}\\b${BINDUNG}\\b${KOMPARATIV}\\b)`,
    ),
  },
  {
    id: "B",
    was: "das System als Trainingsgegenstand",
    // Beide Richtungen: „Klarwerk wird trainiert" und „Trainieren Sie Klarwerk".
    muster: regel(
      `(?:\\b${SYSTEM}\\b${BINDUNG}\\b${TRAINING}\\b)|(?:\\b${TRAINING}\\b${BINDUNG}\\b${SYSTEM}\\b)`,
    ),
  },
  {
    id: "C",
    was: "Autonomie- oder Ersetzungszusage",
    // Phrasengebunden, nicht subjektgebunden — siehe die ausdrückliche Grenze bei C-4 unten.
    muster: regel(
      "(?:kann\\s+(?:er|sie|es)\\s+(?:es|das)\\s+(?:irgendwann\\s+)?selbst" +
        "|kann\\s+(?:es|das)\\s+(?:irgendwann\\s+)?selbst" +
        "|macht\\s+(?:es|das)\\s+(?:irgendwann\\s+)?allein" +
        "|nachfolger\\s+aus" +
        "|bilden\\s+[^.!?;:\\n]{0,20}nachfolger" +
        "|ersetzt\\s+(?:sie|dich|ihre|deine)" +
        "|übernimmt\\s+(?:ihre|deine)\\s+(?:arbeit|stelle|aufgabe)" +
        "|can\\s+do\\s+it\\s+(?:itself|alone|on its own)" +
        "|replaces\\s+you" +
        "|takes\\s+over\\s+your\\s+(?:job|work)" +
        "|leidt\\s+[^.!?;:\\n]{0,20}opvolger\\s+op)",
    ),
  },
] as const;

/**
 * Freigabeliste nach Pflicht 2: „…sofern kein belegter Mechanismus benannt ist."
 *
 * Ein Verbesserungsversprechen ist nicht für immer verboten — es ist verboten, SOLANGE es keine
 * Deckung hat. Wird eines Tages eine echte Lernschleife gebaut, trägt sie hier ihren Textbeleg
 * ein und der zugehörige Satz wird zulässig. Heute ist die Liste leer, und das ist die Messung
 * aus JOB 962 §3 (`finetune` 0 Dateien, „verbessert sich" 0), nicht eine Meinung. Fall D-1 hält
 * fest, dass sie leer ist — wer sie füllt, muss den Mechanismus mitliefern.
 */
const BELEGTE_MECHANISMEN: readonly string[] = [];

type Fund = { sprache: string; schluessel: string; regel: string; text: string };

const pruefeText = (sprache: string, schluessel: string, text: string): Fund[] => {
  if (BELEGTE_MECHANISMEN.some((m) => text.includes(m))) return [];
  return REGELN.filter((r) => r.muster.test(text)).map((r) => ({
    sprache,
    schluessel,
    regel: r.id,
    text,
  }));
};

const SPRACHEN = ["de", "en", "nl"] as const;

/** Die echten Laufzeitressourcen — nicht der Quelltext. */
const bundle = (lng: string): Record<string, unknown> =>
  i18n.getResourceBundle(lng, "translation") as Record<string, unknown>;

const pruefeBundle = (lng: string): Fund[] =>
  Object.entries(bundle(lng)).flatMap(([k, v]) =>
    typeof v === "string" ? pruefeText(lng, k, v) : [],
  );

const QUICKSTART = join(__dirname, "../../docs/onboarding/user-quickstart.md");
const quickstartText = (): string => readFileSync(QUICKSTART, "utf8");

/** Dieselbe Regel, aber je Zeile — damit ein Fund seine Fundstelle nennt (siehe A-2). */
const quickstartZeilen = (): Fund[] =>
  quickstartText()
    .split("\n")
    .flatMap((zeile, i) => pruefeText("docs", `user-quickstart.md:${i + 1}`, zeile));

const zeige = (funde: readonly Fund[]): string =>
  funde.map((f) => `[${f.sprache}·Regel ${f.regel}] ${f.schluessel}: ${f.text}`).join("\n");

// ------------------------------------------------------------------------------------------------

describe("JOB 1127 · A — der ausgelieferte Bestand verspricht keine Modellverbesserung", () => {
  it.each(SPRACHEN)(
    "A-1 (%s): kein Oberflächentext sagt zu, dass das System selbst besser wird",
    (lng) => {
      const funde = pruefeBundle(lng);
      expect(funde, `Verbesserungszusage ohne belegten Mechanismus:\n${zeige(funde)}`).toEqual([]);
    },
  );

  it("A-2: das Onboarding-Dokument sagt es ebenfalls nicht zu", () => {
    // Die zweite von BEN3 namentlich verlangte Quelle. Sie liegt außerhalb des Bündels und wäre
    // einem reinen i18n-Wächter entgangen — genau das war Prüflücke 1.
    //
    // ZEILENWEISE, und das ist keine Kosmetik: In der ersten Fassung ging das ganze Dokument als
    // EIN Text hinein. Die Gegenmutation GM-5 wurde damit zwar rot, aber die Meldung warf 77
    // Zeilen aus und nannte die schuldige Stelle nicht — ein Wächter, dessen Fehlermeldung man
    // nicht lesen kann, wird beim ersten Rot abgeschaltet. Zeilenweise nennt der Fund die
    // Fundstelle und die Regel kann zudem nicht über Zeilengrenzen hinweg zufällig binden.
    const funde = quickstartZeilen();
    expect(funde, zeige(funde)).toEqual([]);
  });

  it("A-3: der Bestand ist nicht etwa leer — der Wächter hat wirklich etwas zu prüfen", () => {
    // Kalibrierung zu A-1: ohne sie wäre A-1 auch dann grün, wenn `getResourceBundle` nichts
    // zurückgäbe und der Wächter über eine leere Menge liefe.
    for (const lng of SPRACHEN) {
      const werte = Object.values(bundle(lng)).filter((v) => typeof v === "string");
      expect(werte.length, `Sprache ${lng} liefert keine Texte`).toBeGreaterThan(1000);
    }
    expect(quickstartText().length).toBeGreaterThan(3000);
  });
});

describe("JOB 1127 · B — der Wächter ist scharf, nicht bloß still", () => {
  // Diese Gruppe ist der Kern. Ein Wächter, der nichts findet, ist wertlos, wenn er auch nichts
  // finden KANN. Und einer, der zu viel findet, wird abgeschaltet. B misst beide Ränder.

  it("B-1: ein naiver Wortfilter wäre am heutigen Bestand vielfach rot — der Wächter ist es nicht", () => {
    // Der Schärfenachweis als Differenz: dasselbe Material, zwei Regeln, gemessener Unterschied.
    const naiv = /lernt|lernen|gelernt|trainier|training|verbessert|besser|learn|improve/i;
    const naivTreffer = SPRACHEN.flatMap((lng) =>
      Object.entries(bundle(lng)).filter(([, v]) => typeof v === "string" && naiv.test(v)),
    );
    expect(
      naivTreffer.length,
      "Ohne viele naive Treffer wäre dieser Vergleich wertlos",
    ).toBeGreaterThan(20);
    expect(SPRACHEN.flatMap(pruefeBundle)).toEqual([]);
  });

  it("B-2: die gemessenen Bestandssätze mit menschlichem Subjekt bleiben zulässig", () => {
    // Namentlich, mit den echten Sätzen aus dem gebundenen Stand — nicht mit erfundenen Beispielen.
    const erlaubt = [
      "Klarwerk sammelt, was deine Kolleginnen und Kollegen im Betrieb gelernt haben, damit du danach fragen kannst.",
      "Klarwerk collects what your colleagues have learned on the job, so that you can ask about it.",
      "Ohne sie kann der Autor nichts lernen und nichts korrigieren.",
      "Verbessert die gemeinsame Wissensbasis",
      "Improves the shared knowledge base",
      "Offene Lernpfad-Schritte",
      "Verbesserungswünsche/Fehler an den jeweiligen Klarwerk-Betreiber/Admin der Instanz.",
    ];
    for (const satz of erlaubt) {
      expect(pruefeText("probe", "erlaubt", satz), `fälschlich rot: ${satz}`).toEqual([]);
    }
  });

  it("B-3: das Komma ist der tragende Schnitt — dieselben Wörter ohne Komma sind rot", () => {
    // Die schärfste Probe auf die Bindungsregel: ein Zeichen Unterschied, zwei Urteile. Ohne
    // diesen Fall wäre B-2 auch dann grün, wenn der Wächter Regel A gar nicht anwendet.
    const mitKomma = "Klarwerk sammelt, was die Kollegen gelernt haben.";
    const ohneKomma = "Klarwerk lernt aus dem, was die Kollegen erklären.";
    expect(pruefeText("probe", "mit-komma", mitKomma)).toEqual([]);
    expect(pruefeText("probe", "ohne-komma", ohneKomma).map((f) => f.regel)).toEqual(["A"]);
  });

  it("B-4: die Bindung greift auch über Distanz — aber nur innerhalb eines Satzglieds", () => {
    expect(pruefeText("probe", "nah", "Klarwerk wird mit jeder Korrektur besser.").length).toBe(1);
    // Dasselbe Prädikat, aber durch ein Satzende getrennt: kein Fund, weil es dann nicht mehr
    // dem System zugeschrieben ist.
    expect(
      pruefeText("probe", "getrennt", "Klarwerk zeigt Quellen. Ihre Kollegen werden besser."),
    ).toEqual([]);
  });
});

describe("JOB 1127 · C — jeder verbotene M-Satz beißt", () => {
  // Pflicht 3 wörtlich: „Gegenmutation mit jedem verbotenen M-Satz muss beißen." Hier einzeln und
  // benannt; als Produktmutation zusätzlich in den Gegenmutationen GM-1..GM-4 der Rückgabe.

  it("C-1 (M1): „Der Lehrling lernt dazu“ / „wird mit jeder Korrektur besser“", () => {
    expect(pruefeText("de", "m1a", "Der Lehrling lernt dazu.").map((f) => f.regel)).toEqual(["A"]);
    expect(
      pruefeText("de", "m1b", "Klarwerk wird mit jeder Korrektur besser.").map((f) => f.regel),
    ).toEqual(["A"]);
  });

  it("C-2 (M4): „Trainieren Sie Klarwerk“ — beide Wortstellungen", () => {
    expect(pruefeText("de", "m4a", "Trainieren Sie Klarwerk.").map((f) => f.regel)).toEqual(["B"]);
    expect(
      pruefeText("de", "m4b", "Klarwerk wird mit Ihren Antworten trainiert.").map((f) => f.regel),
    ).toEqual(["B"]);
  });

  it("C-3 (M2/M3): Autonomie und Ersetzung beißen, obwohl sie kein Lernwort enthalten", () => {
    // Der Grund, warum Regel C überhaupt existiert: ein reiner Verbesserungswächter ist hier blind.
    expect(pruefeText("de", "m2", "Irgendwann kann er es selbst.").map((f) => f.regel)).toEqual([
      "C",
    ]);
    expect(pruefeText("de", "m3", "Sie bilden Ihren Nachfolger aus.").map((f) => f.regel)).toEqual([
      "C",
    ]);
  });

  it("C-4: die Sprachgrenze hält — die M-Sätze beißen auch auf Englisch und Niederländisch", () => {
    // Sonst wäre der Wächter durch eine Übersetzung zu umgehen; das Bündel liefert drei Sprachen.
    expect(pruefeText("en", "m1-en", "The apprentice learns from every correction.").length).toBe(
      1,
    );
    expect(pruefeText("en", "m4-en", "Train Klarwerk with your answers.").length).toBe(1);
    expect(pruefeText("nl", "m1-nl", "Het systeem wordt beter met elke correctie.").length).toBe(1);
  });

  it("C-5: das ZULÄSSIGE Lehrlingsbild bleibt zulässig — der Wächter verbietet Zusagen, nicht Bilder", () => {
    // Pflicht 3, positive Hälfte: „fragt nach und speichert nur ausdrücklich bestätigtes Wissen".
    // Das sind die drei Positivsätze P1–P3 aus JOB 962 §5.1, wörtlich übernommen.
    const p = [
      "Klarwerk fragt nach wie ein Lehrling — Sie antworten, statt zu dokumentieren.",
      "Was Sie erklären, bleibt im Haus — auch wenn Sie mal nicht da sind.",
      "Sie geben Ihr Wissen weiter, ohne Formulare auszufüllen.",
      "Klarwerk speichert nur, was Sie ausdrücklich bestätigt haben.",
    ];
    for (const satz of p) {
      expect(pruefeText("probe", "positiv", satz), `P-Satz fälschlich rot: ${satz}`).toEqual([]);
    }
  });
});

describe("JOB 1127 · D — die Ausnahme ist benannt und heute leer", () => {
  it("D-1: es ist kein belegter Lernmechanismus eingetragen", () => {
    // Pflicht 2: verboten „sofern kein belegter Mechanismus benannt ist". Die Ausnahme ist damit
    // Teil der Regel, nicht ihre Umgehung — und ihr heutiger Zustand ist eine Messung aus
    // JOB 962 §3, kein Vorbehalt.
    expect(BELEGTE_MECHANISMEN).toEqual([]);
  });

  it("D-2: wäre ein Mechanismus belegt, ließe die Ausnahme genau den zugehörigen Satz durch", () => {
    // Die Ausnahme wird hier ausgeführt, nicht nur behauptet — sonst wäre D-1 eine Zusage über
    // toten Code. Der Freigabetext wird lokal gesetzt; die Produktliste bleibt leer.
    const satz = "Klarwerk lernt aus Ihren Korrekturen (belegter Mechanismus: FEEDBACK-LOOP-XY).";
    expect(pruefeText("probe", "ohne-freigabe", satz).map((f) => f.regel)).toEqual(["A"]);
    const mitFreigabe = (text: string): boolean =>
      ["FEEDBACK-LOOP-XY"].some((m) => text.includes(m));
    expect(mitFreigabe(satz), "die Freigabe erkennt den Beleg im selben Text").toBe(true);
  });
});
