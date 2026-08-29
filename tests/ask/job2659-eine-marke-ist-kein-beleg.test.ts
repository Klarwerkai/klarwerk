// ================================================================================================
// JOB 2659 · D1/D2 — EINE MARKE IST KEIN BELEG (Review EXT1-20260828, Befunde 4, 6, 7).
// ================================================================================================
//
// DER BEFUND: „eine Marke „[1]" genuegt als Beleg." `citedSourceIds` prüfte nur, ob die Zahl im
// Kandidatenbereich liegt — ein halluzinierter Satz mit „[1]" galt als belegt und wurde über
// `answerStanding` „gesichert". Dazu: ohne Marken ging der Text trotzdem als Antwort hinaus, und
// eine Absage („die Wissensbasis deckt das nicht ab") war gewöhnlicher Text mit `answered:true`.
//
// D2 (BEN-PRUEFUNG-JOB-2659-D1 ROT + Entscheidung 00_CONTROL/ENTSCHEIDUNGEN/JOB-2659.md): D1 mass
// mit einem Tokenanteil (60 %) und liess „Ventil tauschen [1]" gegen „Ventil schliessen" passieren
// (M3) sowie Text nach der letzten Marke unbewertet (M8). EXT1 zeigte dazu, dass JEDES Tokenmass
// blind ist: `nicht`, `kein`, `muss`, `vor` sind Stoppwoerter — „Ventil nicht schliessen" waere zu
// 100 % gedeckt. Gewaehlte Form: ZITATDECKUNG — die Aussage muss ein zusammenhaengender Ausschnitt
// EINER markierten Quelle sein. M3/M8 sind UMGEDREHT; BENs Prueflücken stehen als N1/N2 (N3 in
// `job2659-ask-seite-mounted.test.tsx`), EXT1s Pflichtfall als P1.
//
//   M · DAS MASS (`pruefeDeckung`): Zitat oder Rueckfall.
//   P · EXT1s Pflichtfall: Negation.
//   N · BENs Prueflücken 1 und 2 auf Serviceebene.
//   B4 · Halluzination MIT Marke: hinaus geht der Wortlaut der Quelle.
//   B6 · Keine Marke, keine Antwort.
//   B7 · Die Absage ist strukturiert und wird zur Wissensluecke.
//   K · DIE VOLLKETTE: echte Services (KoService → AskService → Reasoner mit Fake-Modell).
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type KnowledgeRef, type ModelClient, Reasoner } from "../../services/reasoner";
import {
  ABSAGE_MARKE,
  ModelProvider,
  istAbsage,
  pruefeDeckung,
  zitatWoerter,
} from "../../services/reasoner/src/provider-model";

function ref(
  id: string,
  title: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 90,
): KnowledgeRef {
  return { id, title, statement, status, trust };
}

const QUELLE = ref("ventil", "Ventil X bei Überdruck schließen", "Bei Überdruck über 6 bar Ventil X schließen");
const ZWEITE = ref("wartung", "Ventil X Wartung", "Ventil X bei Überdruck einmal jährlich prüfen", "offen", 40);
const KANDIDATEN = [QUELLE, ZWEITE];
const FRAGE = "Was tun bei Überdruck am Ventil X?";

function fake(text: string): ModelClient {
  return { name: "fake", complete: async () => text };
}

describe("JOB 2659 · M — das Maß: Zitatdeckung, ein Ausschnitt EINER Quelle", () => {
  it("M0 · KALIBRIERUNG: die Normalisierung behält Stoppwörter, Zahlen und Reihenfolge", () => {
    expect(zitatWoerter("Ventil X bei Überdruck NICHT schließen, über 6 bar.")).toEqual([
      "ventil", "x", "bei", "ueberdruck", "nicht", "schliessen", "ueber", "6", "bar",
    ]);
  });

  it("M1 · GEFANGEN: eine erfundene Aussage mit Marke", () => {
    const befund = pruefeDeckung(
      "Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1].",
      KANDIDATEN,
    );
    expect(befund.aussagen).toHaveLength(1);
    expect(befund.aussagen[0]?.quellen).toEqual(["ventil"]);
    expect(befund.aussagen[0]?.zitatVon).toBeNull();
    expect(befund.gedeckt).toBe(false);
  });

  it("M2 · GEFANGEN: eine Zahl, die nicht in der Quelle steht", () => {
    expect(pruefeDeckung("Bei Überdruck über 3 bar Ventil X schließen [1].", KANDIDATEN).gedeckt).toBe(false);
  });

  it("M3 · UMGEDREHT (BEN-Prüflücke 2): ein vertauschtes Verb bei hoher Überlappung wird GEFANGEN", () => {
    // D1 STAND HIER: „DURCHGELASSEN … 67 % ≥ 60 %". Bei einem Ventil ist der Unterschied zwischen
    // schließen und tauschen der ganze Unterschied. „tauschen" steht in keinem Ausschnitt der Quelle.
    const befund = pruefeDeckung("Bei Überdruck über 6 bar Ventil X tauschen [1].", KANDIDATEN);
    expect(befund.aussagen[0]?.zitatVon).toBeNull();
    expect(befund.gedeckt).toBe(false);
  });

  it("M3b · GEDECKT: der Quellsatz selbst, ein Teilsatz, eine gebeugte Form", () => {
    expect(pruefeDeckung("Bei Überdruck über 6 bar Ventil X schließen [1].", KANDIDATEN).gedeckt).toBe(true);
    expect(pruefeDeckung("über 6 bar Ventil X schließen [1]", KANDIDATEN).aussagen[0]?.zitatVon).toBe("ventil");
    // Beugung: „schließt" für „schließen" — gemeinsamer Stamm, Rest höchstens drei Zeichen.
    expect(pruefeDeckung("Bei Überdruck über 6 bar Ventil X schließt [1].", KANDIDATEN).gedeckt).toBe(true);
  });

  it("M3c · PARAPHRASE FÄLLT ZURÜCK — das ist das Versprechen, kein Verlust (EXT1)", () => {
    // Inhaltlich richtig, aber umformuliert: kein Ausschnitt der Quelle. Der Mensch liest dann den
    // Quellenwortlaut. „Der Modelltext darf auswählen und zusammenstellen, nicht umformulieren."
    expect(pruefeDeckung("Bei Überdruck das Ventil schließen [1].", KANDIDATEN).gedeckt).toBe(false);
  });

  it("M3d · UMSTELLUNG im Quellvokabular ist kein Zitat („X vor Y“ gegen „Y vor X“)", () => {
    const q = [ref("r", "Reihenfolge", "Filter vor Pumpe spülen")];
    expect(pruefeDeckung("Filter vor Pumpe spülen [1]", q).gedeckt).toBe(true);
    expect(pruefeDeckung("Pumpe vor Filter spülen [1]", q).gedeckt).toBe(false);
  });

  it("M4 · VERSCHRÄNKUNG zweier wahrer Quellen ist kein Zitat (EXT1, zweites Loch)", () => {
    // Jedes Wort steht in einer der beiden Quellen — der Satz in keiner.
    const befund = pruefeDeckung("Bei Überdruck über 6 bar Ventil X einmal jährlich prüfen [1][2].", KANDIDATEN);
    expect(befund.aussagen[0]?.quellen).toEqual(["ventil", "wartung"]);
    expect(befund.aussagen[0]?.zitatVon).toBeNull();
    expect(befund.gedeckt).toBe(false);
  });

  it("M5 · SEGMENTIERUNG: eine Marke am Ende eines Absatzes markiert den ganzen Absatz", () => {
    const befund = pruefeDeckung(
      "Laut DIN 99999 liegt der Grenzwert bei 1234 bar. Zusätzliche Ursache: kosmische Strahlung. [1]",
      KANDIDATEN,
    );
    expect(befund.aussagen).toHaveLength(1);
    expect(befund.aussagen[0]?.text).toContain("DIN 99999");
    expect(befund.gedeckt).toBe(false);
  });

  it("M6 · zwei Zitate, zwei Quellen — jedes gegen SEINE Quelle; eines fällt, die Antwort fällt", () => {
    const gut = pruefeDeckung(
      "Bei Überdruck über 6 bar Ventil X schließen [1]. Ventil X bei Überdruck einmal jährlich prüfen [2].",
      KANDIDATEN,
    );
    expect(gut.aussagen.map((a) => a.zitatVon)).toEqual(["ventil", "wartung"]);
    expect(gut.gedeckt).toBe(true);
    const schlecht = pruefeDeckung(
      "Bei Überdruck über 6 bar Ventil X schließen [1]. Das Ventil wird täglich vom Hersteller ausgetauscht [2].",
      KANDIDATEN,
    );
    expect(schlecht.aussagen.map((a) => a.gedeckt)).toEqual([true, false]);
    expect(schlecht.gedeckt).toBe(false);
  });

  it("M7 · eine Aussage ohne Wort („[1].“ allein) behauptet nichts und gilt als gedeckt", () => {
    expect(pruefeDeckung("[1].", KANDIDATEN).gedeckt).toBe(true);
  });

  it("M8 · UMGEDREHT (BEN-Prüflücke 1): Text NACH der letzten Marke ist eine ungedeckte Aussage", () => {
    // D1 STAND HIER: „GRENZE, hingeschrieben: … wird nicht bewertet" mit `gedeckt = true`. Das war
    // die Umgehung der ganzen Prüfung: gedeckte Marke voran, dahinter frei erfunden.
    const befund = pruefeDeckung(
      "Bei Überdruck über 6 bar Ventil X schließen [1]. Außerdem hilft kosmische Strahlung.",
      KANDIDATEN,
    );
    expect(befund.aussagen).toHaveLength(2);
    expect(befund.aussagen[1]?.nachlauf).toBe(true);
    expect(befund.aussagen[1]?.quellen).toEqual([]);
    expect(befund.aussagen[1]?.gedeckt).toBe(false);
    expect(befund.gedeckt).toBe(false);
  });

  it("M8b · ein Nachlauf, der nichts sagt (Satzzeichen, Leerraum), kippt nichts", () => {
    expect(pruefeDeckung("Bei Überdruck über 6 bar Ventil X schließen [1] .  ", KANDIDATEN).gedeckt).toBe(true);
  });
});

describe("JOB 2659 · P — EXT1s Pflichtfall: Negation", () => {
  const Q = [ref("v", "Ventil", "Ventil bei Überdruck schließen.")];

  it("P1 · Quelle „Ventil bei Überdruck schließen.“ · Modell „Ventil bei Überdruck nicht schließen [1]“ → Rückfall auf den Quellenwortlaut", async () => {
    // Bei jedem Tokenmaß zu 100 % gedeckt, weil `nicht` Stoppwort ist. Hier: „nicht" steht in keinem
    // Ausschnitt der Quelle.
    const befund = pruefeDeckung("Ventil bei Überdruck nicht schließen [1]", Q);
    expect(befund.gedeckt).toBe(false);
    const ergebnis = await new ModelProvider(fake("Ventil bei Überdruck nicht schließen [1]")).answer(
      "Was tun bei Überdruck am Ventil?",
      Q,
    );
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe("Ventil bei Überdruck schließen.");
    expect(ergebnis.answer).not.toContain("nicht");
  });

  it("P2 · GEGENPROBE: dieselbe Aussage ohne „nicht“ ist das Zitat und geht durch", async () => {
    const ergebnis = await new ModelProvider(fake("Ventil bei Überdruck schließen [1]")).answer(
      "Was tun bei Überdruck am Ventil?",
      Q,
    );
    expect(ergebnis.answer).toBe("Ventil bei Überdruck schließen [1]");
  });

  it("P3 · die Umkehrung in der QUELLE wird ebenso gefangen: „nicht öffnen“ darf nicht zu „öffnen“ werden", () => {
    const q = [ref("v", "Ventil", "Ventil bei Überdruck nicht öffnen.")];
    expect(pruefeDeckung("Ventil bei Überdruck öffnen [1]", q).gedeckt).toBe(false);
    expect(pruefeDeckung("Ventil bei Überdruck nicht öffnen [1]", q).gedeckt).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// R — D3: DIESELBEN WÖRTER, EINE ANDERE BEDEUTUNG (BEN-PRUEFUNG-JOB-2659-D2, Prüflücke 1; §3.2).
// ------------------------------------------------------------------------------------------------
//
// BEN: „Ein Modell kann ausschließlich vorhandene Inhaltswörter verwenden und dennoch Handlung und
// Objekt vertauschen." Eine Menge kennt keine Reihenfolge — ein Ausschnitt schon. Diese Fälle
// bestehen NUR mit dem Ausschnitt-Vergleich (Reihenfolge, zusammenhängend, EINE Quelle); jedes
// Mengenmaß ließe sie zu 100 % gedeckt passieren.
describe("JOB 2659 · R — Rollenwechsel aus denselben Wörtern", () => {
  it("R1 · BENs Fall: Quelle „Ventil A öffnen. Ventil B schließen.“ · Modell „Ventil A schließen [1].“ → Quellenwortlaut", async () => {
    const Q = [ref("ab", "Anlage 7", "Ventil A öffnen. Ventil B schließen.")];
    const befund = pruefeDeckung("Ventil A schließen [1].", Q);
    // KALIBRIERUNG: jedes Wort steht in der Quelle — ein Mengenmaß wäre hier gedeckt.
    for (const w of zitatWoerter("Ventil A schließen")) {
      expect(zitatWoerter(Q[0]?.statement ?? "")).toContain(w);
    }
    expect(befund.aussagen[0]?.zitatVon).toBeNull();
    expect(befund.gedeckt).toBe(false);
    const ergebnis = await new ModelProvider(fake("Ventil A schließen [1].")).answer(
      "Was ist mit Ventil A und Ventil B in Anlage 7?",
      Q,
    );
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe("Ventil A öffnen. Ventil B schließen.");
    expect(ergebnis.answer).not.toContain("Ventil A schließen");
    // GEGENPROBE: die richtige Zuordnung ist ein Ausschnitt und geht durch.
    expect(pruefeDeckung("Ventil B schließen [1].", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("Ventil A öffnen [1]", Q).gedeckt).toBe(true);
  });

  it("R2 · §3.2: Quelle „Ventil bei Überdruck schließen.“ · Modell „Überdruck bei Ventil schließen [1]“ → Quellenwortlaut", async () => {
    const Q = [ref("v", "Ventil", "Ventil bei Überdruck schließen.")];
    expect(pruefeDeckung("Überdruck bei Ventil schließen [1]", Q).gedeckt).toBe(false);
    expect(pruefeDeckung("Ventil schließen bei Überdruck [1]", Q).gedeckt).toBe(false);
    const ergebnis = await new ModelProvider(fake("Überdruck bei Ventil schließen [1]")).answer(
      "Was tun bei Überdruck am Ventil?",
      Q,
    );
    expect(ergebnis.answer).toBe("Ventil bei Überdruck schließen.");
    // GEGENPROBE: das Zitat in Quellreihenfolge geht durch (P2).
    expect(pruefeDeckung("Ventil bei Überdruck schließen [1]", Q).gedeckt).toBe(true);
  });

  it("R3 · EXT1 (Zweitinstanz D2): eine Quelle MIT Volltext deckt nicht alles, was irgendwo im Dokument steht", () => {
    // Am Produkt ist die Quelle Pedis Dokument mit `bodyText` (Station 2). Ein Mengenmaß über den
    // ganzen Text wäre trivial erfüllt („nicht" und „tauschen" stehen irgendwo). Der Ausschnitt
    // muss ZUSAMMENHÄNGEND in Titel/Aussage/Volltext stehen — ein Wort aus Satz 1 und eines aus
    // Satz 9 ergeben kein Zitat.
    const Q: KnowledgeRef[] = [
      {
        ...ref("doc", "Wartung Kesselhaus", "Ventil bei Überdruck schließen."),
        bodyText:
          "Den Filter nicht tauschen, solange der Druck steht. Der Prüfplan wird jährlich fortgeschrieben.",
      },
    ];
    expect(pruefeDeckung("Ventil bei Überdruck nicht schließen [1]", Q).gedeckt).toBe(false);
    expect(pruefeDeckung("Ventil bei Überdruck tauschen [1]", Q).gedeckt).toBe(false);
    expect(pruefeDeckung("Filter bei Überdruck tauschen [1]", Q).gedeckt).toBe(false);
    // GEGENPROBE: ein echtes Zitat aus dem Volltext ist gedeckt — der Volltext ist Quelle.
    expect(pruefeDeckung("Den Filter nicht tauschen, solange der Druck steht [1]", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("Der Prüfplan wird jährlich fortgeschrieben [1]", Q).gedeckt).toBe(true);
  });

  it("R4 · KALIBRIERUNG: die Reihenfolge ist Teil des Zitats — gleiche Wörter, andere Folge, nicht gedeckt", () => {
    const Q = [ref("r", "Reihenfolge", "Erst Pumpe abschalten, dann Ventil öffnen.")];
    expect(pruefeDeckung("Erst Pumpe abschalten, dann Ventil öffnen [1]", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("Erst Ventil öffnen, dann Pumpe abschalten [1]", Q).gedeckt).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// G — D4: ZWEI SÄTZE SIND NICHT EIN SATZ (BEN-PRUEFUNG-JOB-2659-D3, Prüflücke 1; §3.2).
// ------------------------------------------------------------------------------------------------
//
// BEN: aus „Pruefen Sie Ventil A. Schliessen Sie Ventil B." machte `zitatWoerter` den Strom
// „pruefen sie ventil a schliessen sie ventil b" — darin ist „Ventil A schliessen" ein
// zusammenhängender Ausschnitt ÜBER DIE SATZGRENZE, obwohl die Quelle A nur prüfen und B
// schließen lässt. Dasselbe an Feldgrenzen (Titel|Aussage|Bildtext|Volltext), die `refMatchText`
// mit Leerzeichen verkettet. D4: die Quelle wird in SEGMENTE zerlegt (je Feld, je Satz), und ein
// Ausschnitt darf kein Segment verlassen.
describe("JOB 2659 · G — die Satzgrenze überlebt die Normalisierung", () => {
  const AB = [ref("ab", "Anlage 7", "Pruefen Sie Ventil A. Schliessen Sie Ventil B.")];

  it("G1 · BENs Pflichtfall: Quelle „Pruefen Sie Ventil A. Schliessen Sie Ventil B.“ · Modell „Ventil A schliessen [1].“ → Rückfall", async () => {
    // KALIBRIERUNG: im flachen Wortstrom der Quelle WÄRE die Aussage ein zusammenhängender
    // Ausschnitt — genau die Umgehung.
    const flach = zitatWoerter(AB[0]?.statement ?? "");
    expect(flach.join(" ")).toContain("ventil a schliessen");
    const befund = pruefeDeckung("Ventil A schliessen [1].", AB);
    expect(befund.aussagen[0]?.zitatVon).toBeNull();
    expect(befund.gedeckt).toBe(false);
    const ergebnis = await new ModelProvider(fake("Ventil A schliessen [1].")).answer(
      "Was tun mit Ventil A in Anlage 7?",
      AB,
    );
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe("Pruefen Sie Ventil A. Schliessen Sie Ventil B.");
    expect(ergebnis.answer).not.toContain("Ventil A schliessen");
  });

  it("G1b · GEGENPROBE (BEN): „Schliessen Sie Ventil B [1].“ steht in EINEM Satz der Quelle und bleibt gedeckt", async () => {
    expect(pruefeDeckung("Schliessen Sie Ventil B [1].", AB).gedeckt).toBe(true);
    expect(pruefeDeckung("Pruefen Sie Ventil A [1]", AB).gedeckt).toBe(true);
    const ergebnis = await new ModelProvider(fake("Schliessen Sie Ventil B [1].")).answer(
      "Was tun mit Ventil B in Anlage 7?",
      AB,
    );
    expect(ergebnis.answer).toBe("Schliessen Sie Ventil B [1].");
  });

  it("G2 · FELDGRENZE: das Ende des Titels und der Anfang der Aussage ergeben kein Zitat", () => {
    const Q = [ref("t", "Ventil A pruefen", "Ventil B schliessen.")];
    // flach: „ventil a pruefen ventil b schliessen" — „pruefen Ventil B" wäre darin zusammenhängend.
    expect(pruefeDeckung("pruefen Ventil B [1]", Q).gedeckt).toBe(false);
    expect(pruefeDeckung("Ventil A pruefen [1]", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("Ventil B schliessen [1]", Q).gedeckt).toBe(true);
  });

  it("G3 · VOLLTEXT: auch dort gilt die Satzgrenze; ein echter Satz des Volltexts bleibt Zitat", () => {
    const Q: KnowledgeRef[] = [
      {
        ...ref("doc", "Wartung", "Kesselhaus."),
        bodyText: "Pruefen Sie Ventil A. Schliessen Sie Ventil B. Der Pruefplan gilt jaehrlich.",
      },
    ];
    expect(pruefeDeckung("Ventil A schliessen [1]", Q).gedeckt).toBe(false);
    // Ohne Punkt ist „Ventil B Der Pruefplan" EIN Satz, der zwei Segmente überspannt → kein Zitat.
    expect(pruefeDeckung("Ventil B Der Pruefplan [1]", Q).gedeckt).toBe(false);
    // Mit Punkt sind es zwei Teilzitate aus je einem Segment — erlaubt (G4).
    expect(pruefeDeckung("Ventil B. Der Pruefplan [1]", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("Der Pruefplan gilt jaehrlich [1]", Q).gedeckt).toBe(true);
  });

  it("G4 · ZWEI SÄTZE DERSELBEN QUELLE dürfen zitiert werden — jeder Satz für sich ein Segment", () => {
    // Die Aussage wird ebenso satzweise gelesen; beide Sätze sind je ein Ausschnitt EINER Quelle.
    expect(pruefeDeckung("Pruefen Sie Ventil A. Schliessen Sie Ventil B. [1]", AB).gedeckt).toBe(true);
    // Aber nicht aus zwei QUELLEN zusammengesetzt (M4 bleibt).
    const zwei = [ref("a", "A", "Pruefen Sie Ventil A."), ref("b", "B", "Schliessen Sie Ventil B.")];
    expect(pruefeDeckung("Pruefen Sie Ventil A. Schliessen Sie Ventil B. [1][2]", zwei).gedeckt).toBe(false);
  });

  it("G5 · KALIBRIERUNG des Satzsplitters: Zahlen mit Punkt trennen nicht, Satzzeichen ohne Leerraum auch nicht", () => {
    const Q = [ref("z", "Druck", "Ueber 6.5 bar Ventil X schliessen.")];
    expect(pruefeDeckung("Ueber 6.5 bar Ventil X schliessen [1]", Q).gedeckt).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// H — D5: EIN ANFÜHRUNGSZEICHEN HEBT DIE SATZGRENZE AUF (BEN-PRUEFUNG-JOB-2659-D4, Prüflücke 1).
// ------------------------------------------------------------------------------------------------
//
// BEN: `saetze` trennte an `.!?:;` nur, wenn UNMITTELBAR Leerraum folgt. Bei der gewöhnlichen
// Quelle „Pruefen Sie Ventil A.“ Schliessen Sie Ventil B. steht zwischen Punkt und Leerraum ein
// schließendes Anführungszeichen — beide Sätze blieben EIN Segment, und „ventil a schliessen" war
// darin wieder ein Ausschnitt. D5: zwischen Satzendezeichen und Leerraum dürfen beliebig viele
// SCHLIESSENDE Zeichen stehen (Anführungszeichen, Apostroph, Klammer) — die Grenze bleibt.
describe("JOB 2659 · H — schließende Zeichen zwischen Satzende und Leerraum", () => {
  const FAELLE: Array<[string, string]> = [
    ["typografisches Anführungszeichen “", "„Pruefen Sie Ventil A.“ Schliessen Sie Ventil B."],
    ["gerades Anführungszeichen \"", '"Pruefen Sie Ventil A." Schliessen Sie Ventil B.'],
    ["Apostroph '", "'Pruefen Sie Ventil A.' Schliessen Sie Ventil B."],
    ["typografischer Apostroph ’", "‘Pruefen Sie Ventil A.’ Schliessen Sie Ventil B."],
    ["runde Klammer )", "(Pruefen Sie Ventil A.) Schliessen Sie Ventil B."],
    ["eckige Klammer ]", "[Pruefen Sie Ventil A.] Schliessen Sie Ventil B."],
    ["Guillemet »", "«Pruefen Sie Ventil A.» Schliessen Sie Ventil B."],
    ["zwei schließende Zeichen “)", "(„Pruefen Sie Ventil A.“) Schliessen Sie Ventil B."],
  ];

  for (const [name, quelle] of FAELLE) {
    it(`H1 · ${name}: „Ventil A schliessen [1].“ fällt — und der Satz IN den Zeichen bleibt Zitat`, async () => {
      const Q = [ref("q", "Anlage 7", quelle)];
      // KALIBRIERUNG: im flachen Wortstrom WÄRE die falsche Zuordnung zusammenhängend.
      expect(zitatWoerter(quelle).join(" ")).toContain("ventil a schliessen");
      expect(pruefeDeckung("Ventil A schliessen [1].", Q).gedeckt).toBe(false);
      const ergebnis = await new ModelProvider(fake("Ventil A schliessen [1].")).answer(
        "Was tun mit Ventil A in Anlage 7?",
        Q,
      );
      expect(ergebnis.answer).toBe(quelle);
      expect(ergebnis.answer).not.toContain("Ventil A schliessen");
      // GEGENRICHTUNG (wie G1b): der Satz innerhalb der Zeichen und der zweite Satz sind Zitate.
      expect(pruefeDeckung("Pruefen Sie Ventil A [1]", Q).gedeckt).toBe(true);
      expect(pruefeDeckung("Schliessen Sie Ventil B [1].", Q).gedeckt).toBe(true);
    });
  }

  it("H2 · die Klasse vollständig: jedes schließende Zeichen hält die Grenze, auch am Textende", () => {
    const schliessend = ["“", "”", '"', "'", "’", "‘", "»", "«", ")", "]", "}", "›", "‹"];
    for (const z of schliessend) {
      const Q = [ref("q", "Anlage", `Pruefen Sie Ventil A.${z} Schliessen Sie Ventil B.${z}`)];
      expect(pruefeDeckung("Ventil A schliessen [1]", Q).gedeckt, `Zeichen ${z}`).toBe(false);
      expect(pruefeDeckung("Schliessen Sie Ventil B [1]", Q).gedeckt, `Zeichen ${z}`).toBe(true);
    }
  });

  it("H3 · GRENZE, hingeschrieben: ein Satzzeichen IN einem Zitat trennt jetzt zu früh — Kosten in Richtung Sicherheit", () => {
    // „Er sagte „Stopp.“ und ging." ist EIN Satz; die Regel sieht Punkt + schließendes Zeichen +
    // Leerraum und trennt. Ein Zitat über diese Stelle hinweg fällt zurück (auf den Quellsatz) —
    // lieber ein zu früh getrennter Satz als ein verschmolzener.
    const Q = [ref("q", "Bericht", "Er sagte „Stopp.“ und ging.")];
    expect(pruefeDeckung("Er sagte Stopp und ging [1]", Q).gedeckt).toBe(false);
    expect(pruefeDeckung("Er sagte Stopp [1]", Q).gedeckt).toBe(true);
    expect(pruefeDeckung("und ging [1]", Q).gedeckt).toBe(true);
  });
});

describe("JOB 2659 · N — BENs Prüflücken auf Serviceebene, wörtlich", () => {
  it("N1 · `Gedeckter Satz [1]. Ventil sofort tauschen.` — der Nachlauf geht nicht hinaus", async () => {
    const provider = new ModelProvider(
      fake("Bei Überdruck über 6 bar Ventil X schließen [1]. Ventil sofort tauschen."),
    );
    const ergebnis = await provider.answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe(QUELLE.statement);
    expect(ergebnis.answer).not.toContain("tauschen");
    expect(ergebnis.citedSources).toEqual(["ventil"]);
  });

  it("N2 · Quelle „Ventil schließen“, Modell „Ventil tauschen [1]“ — Rückfall auf den Quellenwortlaut", async () => {
    const ergebnis = await new ModelProvider(
      fake("Bei Überdruck über 6 bar Ventil X tauschen [1]."),
    ).answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe(QUELLE.statement);
    expect(ergebnis.answer).not.toContain("tauschen");
    expect(ergebnis.knowledgeClass).toBe("gesichert");
  });
});

describe("JOB 2659 · B4 — Halluzination MIT Marke: der Modelltext geht nicht hinaus", () => {
  it("die Antwort ist der Wortlaut der markierten Quelle; Klasse und Wert kommen aus ihr", async () => {
    const provider = new ModelProvider(
      fake("Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1]."),
    );
    const ergebnis = await provider.answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe(QUELLE.statement);
    expect(ergebnis.answer).not.toContain("Schichtleiter");
    expect(ergebnis.citedSources).toEqual(["ventil"]);
    // B3 (mega52): `sources` bleibt die Transparenzliste der herangezogenen Kandidaten.
    expect(ergebnis.sources).toEqual(["ventil", "wartung"]);
    expect(ergebnis.knowledgeClass).toBe("gesichert");
    expect(ergebnis.trust).toBe(90);
  });

  it("GEGENPROBE: ein gedecktes Zitat geht unverändert hinaus — mit seiner Marke", async () => {
    const text = "Bei Überdruck über 6 bar Ventil X schließen [1].";
    const ergebnis = await new ModelProvider(fake(text)).answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).toBe(text);
    expect(ergebnis.citedSources).toEqual(["ventil"]);
    expect(ergebnis.sources).toEqual(["ventil", "wartung"]);
  });
});

describe("JOB 2659 · B6 — keine Marke, keine Antwort", () => {
  it("ein flüssiger Text ohne Marke ist keine Quellaussage — answered:false, nichts im Gepäck", async () => {
    const ergebnis = await new ModelProvider(fake("Bei Überdruck das Ventil schließen.")).answer(
      FRAGE,
      KANDIDATEN,
    );
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.answer).toBeNull();
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.citedSources).toEqual([]);
    expect(ergebnis.knowledgeClass).toBe("unbekannt");
  });

  it("eine Marke außerhalb des Kandidatenbereichs zählt nicht als Marke", async () => {
    const ergebnis = await new ModelProvider(fake("Bei Überdruck das Ventil schließen [7].")).answer(
      FRAGE,
      KANDIDATEN,
    );
    expect(ergebnis.answered).toBe(false);
  });
});

describe("JOB 2659 · B7 — eine Absage ist eine Absage", () => {
  it("der Prompt verlangt die strukturierte Absage (DE und EN)", async () => {
    const gesehen: string[] = [];
    const client: ModelClient = {
      name: "capture",
      complete: async (system) => {
        gesehen.push(system);
        return ABSAGE_MARKE;
      },
    };
    await new ModelProvider(client).answer(FRAGE, KANDIDATEN, "de");
    await new ModelProvider(client).answer(FRAGE, KANDIDATEN, "en");
    expect(gesehen[0]).toContain(`AUSSCHLIESSLICH mit dem Wort ${ABSAGE_MARKE}`);
    expect(gesehen[1]).toContain(`ONLY with the word ${ABSAGE_MARKE}`);
  });

  it("die Absage wird answered:false — keine Quellen, keine Klasse", async () => {
    const ergebnis = await new ModelProvider(fake(ABSAGE_MARKE)).answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.answer).toBeNull();
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.knowledgeClass).toBe("unbekannt");
  });

  it("auch eine Absage mit Höflichkeit drumherum ist eine Absage; ein Wortteil ist keine", () => {
    expect(istAbsage(`${ABSAGE_MARKE}.`)).toBe(true);
    expect(istAbsage(`Leider: ${ABSAGE_MARKE}`)).toBe(true);
    expect(istAbsage(`${ABSAGE_MARKE}_ABER_DOCH [1]`)).toBe(false);
    expect(istAbsage("Bei Überdruck Ventil X schließen [1].")).toBe(false);
  });

  it("die alte Fließtext-Absage ohne Marke fällt jetzt über B6 — ebenfalls keine Antwort", async () => {
    const ergebnis = await new ModelProvider(
      fake("Die Wissensbasis deckt das nicht ab."),
    ).answer(FRAGE, KANDIDATEN);
    expect(ergebnis.answered).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// K — DIE VOLLKETTE: dort, wo der Mensch handelt. Kein Fake-Reasoner, echte Services; nur das
// Modell ist ein Fake, das genau das tut, was das Review beschreibt.
// ------------------------------------------------------------------------------------------------
async function kette(modell: ModelClient) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const ventil = await koService.create({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck das Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  await koService.setValidationState(ventil.id, { trust: 92, status: "validiert" });
  const ask = new AskService({
    reasoner: new Reasoner(new ModelProvider(modell)),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, ventil };
}

describe("JOB 2659 · K — die Vollkette bis zur Wissenslücke", () => {
  it("K1 · GEGENPROBE: das zitierende Modell antwortet — kein Gap", async () => {
    const { ask, ventil } = await kette(fake("Bei Überdruck das Ventil X manuell schließen [1]."));
    const { result, gap } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.citedSources).toEqual([ventil.id]);
    expect(gap).toBeNull();
  });

  it("K2 · die Halluzination mit Marke erreicht den Menschen nicht — er liest die Quelle", async () => {
    const { ask, ventil } = await kette(
      fake('Laut DIN 99999 liegt der Grenzwert bei 1234 bar. "Zitat aus Quelle 7". [1]'),
    );
    const { result } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.answer).not.toContain("DIN 99999");
    expect(result.answer).not.toContain("1234");
    expect(result.answer).toBe("Bei Überdruck das Ventil X manuell schließen.");
    expect(result.citedSources).toEqual([ventil.id]);
  });

  it("K3 · die Absage des Modells wird zur Wissenslücke — keine Antwort, ein Gap", async () => {
    const { ask } = await kette(fake(ABSAGE_MARKE));
    const { result, gap } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(false);
    expect(result.answer).toBeNull();
    expect(result.sources).toEqual([]);
    expect(gap).not.toBeNull();
    expect(gap?.question).toBe("Was tun bei Überdruck am Ventil?");
  });

  it("K4 · der Text ohne Marke wird zur Wissenslücke — nicht zur Antwort mit acht Quellen", async () => {
    const { ask } = await kette(fake("Bei Überdruck das Ventil schließen."));
    const { result, gap } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(false);
    expect(result.sources).toEqual([]);
    expect(gap).not.toBeNull();
  });
});
