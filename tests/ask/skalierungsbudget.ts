// ================================================================================================
// JOB 3042 · DAS SKALIERUNGSURTEIL — EINE REINE FUNKTION, DIE KEINE UHR KENNT
// ================================================================================================
//
// WOZU. Ein Lasttest, der eine absolute Sekundenzahl erwartet, misst den Rechner und nicht das
// Produkt. Pedi hat das am 03.09.2026 belegt: derselbe unveränderte Code brauchte für den
// 1000-Störer-Fall der Skalierungsgegenprobe 62 s, 72 s, 75 s, 120 s, 132 s, 150 s — je nachdem,
// wie viele Bahnen gerade sonst noch bauten. Sechs Tore liefen deshalb rot, ohne dass am Produkt
// etwas fehlte.
//
// DIE ANTWORT DARAUF ist nicht ein höherer Deckel (der macht den Wächter still), sondern ein
// VERHÄLTNIS: Wie viel teurer wird die Ask-Antwort, wenn der Bestand um den Datenfaktor wächst?
// Ein dreimal langsamerer Rechner streckt Referenz- und Messdauer um denselben Faktor — das
// Verhältnis bleibt gleich, das Urteil auch. Eine überproportionale Ask-Auswahl streckt nur die
// Messdauer — das Verhältnis steigt, das Urteil kippt.
//
// DIESE DATEI IST BEWUSST EIN REINES TESTMODUL unter `tests/` und keine Produktquelle: sie trifft
// keine Produktzusage und hat im Betrieb nichts zu suchen. (Der Aufrufer-Wächter,
// `tests/capture/aufrufer-waechter.test.ts:91`, überwacht `services/**` und `apps/web/src` — ein
// Export hier würde ihn nicht sinnentleeren, weil er diese Fläche gar nicht führt.)
//
// KEINE UHR, KEIN NETZ, KEIN GLOBALER ZUSTAND: Die Funktion bekommt Zahlen und gibt ein Urteil.
// Genau deshalb ist sie ohne Bestand und ohne Wartezeit selbst prüfbar (SELBSTPROBE in
// `ask-7von8-skalierungsgegenprobe.test.ts`).
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DIE BODENREGEL, NACHDEM BEN SIE ZERLEGT HAT
// ------------------------------------------------------------------------------------------------
// BENs Befund an Runde 1, wörtlich: „`Math.max(referenzMs, bodenMs)` bricht die behauptete
// Lastinvarianz unterhalb beziehungsweise beim Überschreiten des Bodens." Er hat es an einem Paar
// belegt, das ich hätte selbst finden müssen: der Bodenfall `1 ms → 200 ms` war GRÜN, dieselbe
// Messung auf einem dreimal langsameren Rechner (`3 ms → 600 ms`) wurde ROT. Genau das darf dieser
// Datei nicht passieren — sie ist gebaut, um solche Kipp-Punkte abzuschaffen.
//
// DIE URSACHE ist nicht der Boden, sondern der Versuch, UNTERHALB des Bodens trotzdem zu urteilen.
// Ein Boden ist eine Zahl auf der ms-Skala; eine Lastskalierung verschiebt Messwerte auf dieser
// Skala. Jede feste Grenze auf einer skalierenden Achse hat eine Kante. Man kann die Kante nicht
// wegrechnen — man kann nur entscheiden, was an ihr geschieht.
//
// DIE ENTSCHEIDUNG (BENs Option b, „ausdrücklich geänderte, begründete Vertragsgrenze"):
// Unterhalb des Bodens URTEILT DIESE FUNKTION NICHT. Sie rechnet das Verhältnis weiterhin aus —
// mit dem Boden als Bezug, damit eine Zahl dasteht und niemand durch null teilt —, meldet aber
// `geurteilt: false` und `ok: true`, und die Begründung beginnt mit „KEIN URTEIL". Das ist kein
// stilles Grün: der Aufrufer sieht am Feld, dass nichts geprüft wurde, und die Meldung sagt es.
//
// DER VERTRAG, den diese Datei damit hält, und NUR dieser:
//
//   (1) OBERHALB DES BODENS ist das Urteil vollständig lastinvariant. Werden `referenzMs` und
//       `messMs` mit demselben Faktor multipliziert und bleibt die Referenz über dem Boden,
//       sind `verhaeltnis`, `ok` und `geurteilt` bitgleich.
//   (2) UNTERHALB DES BODENS gibt es kein Urteil, und zwar auf beiden Seiten jeder Skalierung, die
//       den Boden nicht überschreitet. BENs Paar `1/200` und `3/600` fällt beidseitig hierunter und
//       hat deshalb denselben Ausgang.
//   (3) DER EINZIGE ÜBERGANG, den eine Verlangsamung auslösen kann, führt vom Nicht-Urteil zum
//       Urteil — nie von einem grünen Urteil zu einem roten. Eine Verlangsamung hebt die Referenz;
//       sie kann sie nur über den Boden schieben, nie darunter. Ist sie oben angekommen, ist das
//       Verhältnis erstmals belastbar, und ein rotes Urteil ist dann ein Befund, keine Last.
//
// Eine ALLGEMEINE Invarianzbehauptung („das Urteil ändert sich unter jeder Skalierung nie") steht
// hier ausdrücklich NICHT mehr. Sie wäre bei jedem Boden falsch, und sie war in Runde 1 falsch.

/** Was gemessen wurde und woran es gemessen wird. Alle Dauern in Millisekunden. */
export interface Skalierungsmessung {
  /** Die Dauer beim kleinen Bestand — der Bezugspunkt. */
  readonly referenzMs: number;
  /** Die Dauer beim großen Bestand — der Prüfling. */
  readonly messMs: number;
  /** Um welchen Faktor der Bestand gewachsen ist (40 → 1000 ist 25). */
  readonly datenfaktor: number;
  /**
   * Der Bodenwert für die Referenzdauer — die Grenze der Urteilsfähigkeit.
   *
   * WOZU: Eine sehr kurze Referenzdauer macht das Verhältnis zu Rauschen — bei 0,4 ms Referenz
   * entscheidet die Auflösung des Zeitgebers über Rot und Grün. Unterhalb des Bodens wird deshalb
   * nicht geurteilt (s. RUNDE 2 im Kopf dieser Datei).
   *
   * Er gehört so tief gewählt, dass er im Betrieb NICHT greift. Greift er regelmäßig, ist die
   * Prüfung heimlich eine absolute Zeitschranke geworden und der Boden gehört korrigiert, nicht
   * das Budget.
   */
  readonly bodenMs: number;
  /**
   * Wie viel mal den Datenfaktor die Messdauer kosten darf: `budget = datenfaktor × budgetfaktor`.
   *
   * Der Wert gehört nicht hierher, sondern zum Aufrufer — er hängt daran, welche Wachstumsordnung
   * noch erlaubt sein soll. Die Herleitung des im Tor benutzten Werts steht in
   * `ask-7von8-skalierungsgegenprobe.test.ts` bei `BUDGETFAKTOR`.
   */
  readonly budgetfaktor: number;
}

/** Das Urteil. */
export interface Skalierungsurteil {
  /**
   * Was der Test behauptet. `false` heißt: das Wachstum ist überproportional ODER die Messung
   * taugt nicht. `true` heißt „nichts einzuwenden" — und das schließt den Fall ein, in dem gar
   * nicht geurteilt wurde (`geurteilt: false`).
   */
  readonly ok: boolean;
  /**
   * Wurde wirklich über die Skalierung geurteilt? `false` bei unbrauchbarer Vorgabe, unbrauchbarer
   * Messdauer und bei einer Referenz unter dem Bodenwert. Dieses Feld ist der Unterschied zwischen
   * „geprüft und in Ordnung" und „nicht prüfbar" — ohne es wäre die Bodenregel ein stilles Grün.
   */
  readonly geurteilt: boolean;
  /** `messMs / bezugsMs` — die Zahl, um die es geht (unterhalb des Bodens rein informativ). */
  readonly verhaeltnis: number;
  /** `datenfaktor * budgetfaktor` — die Grenze, gegen die sie steht. */
  readonly budget: number;
  /** Ein Satz, der Verhältnis, Budget und jede Ersatzrechnung ausdrücklich benennt. */
  readonly begruendung: string;
}

/** Eine Dauer taugt als Messwert nur, wenn sie endlich und echt positiv ist. */
function brauchbar(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0;
}

const zahl = (ms: number): string => (Number.isFinite(ms) ? ms.toFixed(1) : String(ms));

/**
 * Das Urteil über EINE Skalierungsmessung. Rein: gleiche Eingabe, gleiche Ausgabe — immer.
 *
 * Der Vertrag zur Lastinvarianz steht vollständig im Kopf dieser Datei (RUNDE 2, Punkte 1–3) und
 * wird in der SELBSTPROBE an genau den Konstanten nachgerechnet, die das Tor benutzt.
 */
export function beurteileSkalierung(m: Skalierungsmessung): Skalierungsurteil {
  if (!brauchbar(m.datenfaktor) || !brauchbar(m.budgetfaktor) || !brauchbar(m.bodenMs)) {
    return {
      ok: false,
      geurteilt: false,
      verhaeltnis: Number.NaN,
      budget: Number.NaN,
      begruendung: `Budgetvorgabe unbrauchbar (datenfaktor=${m.datenfaktor}, budgetfaktor=${m.budgetfaktor}, bodenMs=${m.bodenMs}) — kein Urteil möglich.`,
    };
  }
  const budget = m.datenfaktor * m.budgetfaktor;
  const grenze = `Budget ${budget.toFixed(2)} (Datenfaktor ${m.datenfaktor} × Budgetfaktor ${m.budgetfaktor})`;
  if (!brauchbar(m.messMs)) {
    // Kein stilles Grün: eine Dauer, die es nicht gibt, ist kein Beleg für gute Skalierung.
    return {
      ok: false,
      geurteilt: false,
      verhaeltnis: Number.NaN,
      budget,
      begruendung: `Messung unbrauchbar (messMs=${m.messMs}) — ${grenze}.`,
    };
  }
  // Die Bodenkante. Sie fängt beides ab: eine kaputte Referenz (0, negativ, nicht endlich) und eine
  // zwar gültige, aber zu kurze. Beide führen zum selben Ausgang, und der ist KEIN Urteil.
  if (!brauchbar(m.referenzMs) || m.referenzMs < m.bodenMs) {
    return {
      ok: true,
      geurteilt: false,
      verhaeltnis: m.messMs / m.bodenMs,
      budget,
      begruendung: `KEIN URTEIL: Referenz ${zahl(m.referenzMs)} ms liegt unter dem Bodenwert ${zahl(m.bodenMs)} ms — zu kurz für ein belastbares Verhältnis. Nachrichtlich mit dem Bodenwert gerechnet: ${(m.messMs / m.bodenMs).toFixed(2)} bei ${grenze}; Messung ${zahl(m.messMs)} ms.`,
    };
  }
  const verhaeltnis = m.messMs / m.referenzMs;
  const ok = verhaeltnis <= budget;
  return {
    ok,
    geurteilt: true,
    verhaeltnis,
    budget,
    begruendung: `Verhältnis ${verhaeltnis.toFixed(2)} ${ok ? "≤" : ">"} ${grenze}; Messung ${zahl(m.messMs)} ms, Referenz ${zahl(m.referenzMs)} ms.`,
  };
}
