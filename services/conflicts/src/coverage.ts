// ================================================================================================
// AUFTRAG-mega28 BLOCK A / mega29 BLOCK B — DIE ABDECKUNG EINES ERKENNUNGSLAUFS, EHRLICH PROTOKOLLIERT.
// ================================================================================================
//
// Pedi 26.07. (kehrt seine Festlegung „jeder gegen jeden" vom 04.07. bewusst um): beide Live-
// Erkennungswege bekommen eine harte Obergrenze für die Kandidatenmenge. Ein gedeckelter Lauf
// darf danach NICHT mehr aussehen wie ein vollständiger — sonst hätten wir die Fehlerklasse
// getauscht statt sie zu beheben: „geprüft" hieße dann „gegen 20 von 12.479 geprüft", und ein
// leeres Ergebnis läse sich als „konfliktfrei".
//
// Diese Datei trägt deshalb den ERGEBNIS-VERTRAG der Deckelung, nicht den Deckel selbst. Der WERT
// des Deckels ist eine Betriebs-Entscheidung und steht im App-Root (services/app/src/detection-cap.ts,
// EIN Wert für beide Wege); das Modul conflicts liefert nur die Mechanik und meldet ehrlich, was
// es tatsächlich angesehen hat.
//
// WARUM EIN VOM AUFRUFER GESTELLTES, FORTGESCHRIEBENES OBJEKT (und kein Rückgabewert):
// Der Duplikatweg reicht einen ModelCapacityError bewusst DURCH (SCRUM-498 B2 — Rückstau darf nicht
// still zu einem falsch-negativen Ergebnis degradieren). Ein Rückgabewert wäre in genau diesem Fall
// verloren — und das ist der Fall, in dem die Ehrlichkeit am meisten zählt (A3). Der Aufrufer legt
// das Protokoll deshalb VOR dem Lauf an, der Lauf schreibt es fort, und der Aufrufer kann es auch
// nach einem geworfenen Fehler auslesen.
//
// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega29 B1 (bens M28-2) — WARUM AUS EINER ZAHL SIEBEN GEWORDEN SIND.
// ------------------------------------------------------------------------------------------------
// mega28 hatte EIN Feld `examined` mit dem Anspruch „die Kandidaten, die dem Urteil tatsächlich
// vorgelegt wurden". Gesetzt wurde es VOR der Schleife auf die gesamte Auswahl — und in der Schleife
// wurden bereits offene Paare ohne neuen Vergleich übersprungen. Zwanzig Ausgewählte mit fünf offenen
// Befunden ergaben `examined=20` bei fünfzehn Vergleichen. Eine einzige Zahl musste vier verschiedene
// Fragen zugleich beantworten und hat deshalb bei jeder gelogen.
//
// Die Begriffe sind jetzt getrennt. Sie beantworten je EINE Frage, und ihr Verhältnis ist die Aussage:
//   available  ⊇ selected ⊇ (alreadyOpen + attempted) ⊇ completed
// Nicht alle stehen in der Oberfläche — aber ohne sie kann kein Text der Wahrheit entsprechen.
export interface DetectionCoverage {
  // Wie viele Kandidaten standen im Bestand überhaupt zur Wahl (ohne das Subjekt selbst)?
  available: number;
  // Wie viele Ränge der (deterministisch sortierten) Kandidatenliste hat der Lauf ANGESEHEN, bevor
  // er stoppte? Das ist die Menge, über die er überhaupt eine Aussage macht — Vorauswahl UND Deckel
  // haben sie erzeugt. Alles dahinter blieb unberührt.
  selected: number;
  // Davon übersprungen, weil zu dem Paar bereits ein OFFENER Befund steht: kein neuer Vergleich
  // nötig, der Befund liegt ja vor. AUFTRAG-mega29 B2: diese Ränge verbrauchen KEINEN Deckelplatz
  // mehr — der Deckel begrenzt, was geprüft wird, nicht was übersprungen wird.
  alreadyOpen: number;
  // Davon dem Vergleich TATSÄCHLICH vorgelegt. Genau diese Zahl deckelt DETECTION_CANDIDATE_CAP.
  attempted: number;
  // Davon mit einem GÜLTIGEN URTEIL zu Ende verglichen.
  //
  // AUFTRAG-mega32 BLOCK B (bens GELB-2) — DIE GLEICHUNG, DIE HIER STAND, WAR FALSCH.
  // Hier stand bis mega31: „Je EINZELNEM Lauf gilt: attempted = completed + skipped". Das stimmt
  // NUR für Läufe, die nicht abgebrochen sind. Beim Kapazitätsabbruch wird der abbrechende Kandidat
  // gezählt, BEVOR das Urteil versucht wird (overlap-service.ts: `attempted += 1` vor
  // compareCandidate) — er steht danach in `attempted`, aber weder in `completed` noch in `skipped`.
  // Die ZAHLEN waren immer richtig; der Kommentar behauptete eine Rechnung, die sie nicht erfüllen.
  //
  // Die Gleichung gilt deshalb ab jetzt nur noch in der eingeschränkten Fassung — und sie wird
  // nicht mehr nur behauptet, sondern von singleRunBalances() geprüft und von einem Test gepinnt:
  //
  //   !aborted  ⇒  attempted === completed + skipped
  //    aborted  ⇒  attempted === completed + skipped + 1   (der EINE terminal abgebrochene Versuch)
  //
  // Nach mergeCoverage gilt beides NICHT mehr — s. dort.
  //
  // AUFTRAG-mega31 A1: „ohne Fehler zurückgekehrt" ist NICHT dasselbe wie „hat geurteilt" — s.
  // comparisonOutcome(). Genau diese Gleichsetzung war bens ROT-1.
  completed: number;
  // Versuchte Vergleiche, die wegen eines Urteilsfehlers ausgelassen wurden (der Konfliktweg schluckt
  // jeden Kandidatenfehler einzeln und läuft weiter — genau die Stelle, an der bens JR-2 einen
  // Teilausfall unsichtbar fand).
  skipped: number;
  // selected < available ⇒ der Lauf ist KEIN vollständiger Abgleich. Bewusst aus beiden Ursachen
  // gespeist (Deckel UND fachliche Vorauswahl): der Leser fragt „wurde alles angesehen?", nicht
  // „welcher Mechanismus hat gekürzt?". Ein „nein" aus zwei Gründen bleibt ein „nein".
  capped: boolean;
  // Der Lauf brach vorzeitig ab (heute: Modell-Kapazität/Rückstau). Alles nach dem Abbruch wurde
  // NICHT angesehen — die Zahlen nennen den Stand zum Abbruchzeitpunkt.
  aborted: boolean;
}

// ================================================================================================
// AUFTRAG-mega31 A1 (bens ROT-1) — DIE UMKEHR: EIN VERGLEICH IST ERST ABGESCHLOSSEN, WENN ER GEURTEILT HAT.
// ================================================================================================
//
// DER BEFUND. Beide Schleifen zählten `completed += 1`, sobald der judge-Aufruf NORMAL zurückkam.
// Der Reasoner liefert einen 429, ein `no-model`, ein `confidential` oder einen Parsefehler aber
// nicht als geworfenen Fehler, sondern als `null`-Urteil (services/reasoner/src/service.ts,
// judgeConflictOutcome/judgeDuplicateOutcome). Ein normal zurückgekehrter Aufruf ohne Urteil galt
// damit als fehlerfrei verglichen: der Status des Objekts wurde korrekt `failed`, und dieselben
// Kandidaten standen in der Abdeckung als geprüft. `skipped` blieb null.
//
// DIE REGEL IST NICHT NUR VORSICHTIG, SIE IST EXAKT. Der Reasoner-Vertrag hält ausdrücklich fest:
// „ein echtes `kein_konflikt`/`verschieden` ist ein NICHT-null-verdict — nie eine Verwechslung"
// (services/reasoner/src/types.ts, ebenso service.ts an judgeConflictOutcome). Ein gültiges
// Nicht-Treffer-Urteil ist ein Urteil und kommt als OBJEKT (relation: "kein_konflikt" bzw.
// "verschieden"). `null` ist ausnahmslos ein Fehlerausgang. Deshalb gilt ohne Grauzone:
//
//   Urteil vorhanden  → completed    (auch das gültige „kein Treffer")
//   null              → skipped      (kein Urteil gefallen — es GIBT kein gültiges null)
//   geworfen          → skipped bzw. aborted (s. die Schleifen)
//
// WARUM HIER UND NICHT JE SCHLEIFE: dieselbe Regel zweimal auszulegen ist genau der Weg, auf dem
// die beiden Wege auseinanderlaufen — und der Grund, aus dem dieser Befund zweimal repariert und
// zweimal wiedergefunden wurde. Eine Regel, eine Umsetzung, beide Wege rufen sie auf.
export type ComparisonOutcome = "completed" | "skipped";

// Die Regel als TYPWÄCHTER: sie beantwortet „hat der Reasoner geurteilt?" UND verengt den Typ, damit
// der Aufrufer danach ohne zweite Prüfung mit dem Urteil weiterarbeiten kann. Ohne die Verengung
// stünde neben dieser Regel eine zweite `if (!verdict)`-Abfrage — genau die Doppelauslegung, die
// dieser Block beseitigt.
export function isValidVerdict<T>(verdict: T | null | undefined): verdict is T {
  return verdict !== null && verdict !== undefined;
}

export function comparisonOutcome(verdict: unknown): ComparisonOutcome {
  return isValidVerdict(verdict) ? "completed" : "skipped";
}

export function emptyCoverage(): DetectionCoverage {
  return {
    available: 0,
    selected: 0,
    alreadyOpen: 0,
    attempted: 0,
    completed: 0,
    skipped: 0,
    capped: false,
    aborted: false,
  };
}

// Zwei Läufe über DASSELBE Subjekt (Konflikt + Duplikat) zu EINER Aussage zusammenziehen.
//
// AUFTRAG-mega29 B3: das Ergebnis ist ausdrücklich eine KONSERVATIVE MINDESTABDECKUNG, keine
// Gesamtzahl geprüfter eindeutiger Paare — und der Menschentext benennt es auch so („mindestens").
// Die Regel dahinter ist einheitlich: jede REICHWEITEN-Zahl nimmt das Minimum (so weit reicht die
// Aussage, die BEIDE Läufe tragen), jede AUSLASSUNGS-Zahl das Maximum bzw. die Summe (ein Ausfall
// auf einem Weg ist ein echter Ausfall), Flaggen werden verodert. `available` ist das Maximum: so
// groß war der Bestand, gegen den überhaupt geprüft werden konnte.
//
// FOLGE, bewusst in Kauf genommen und deshalb hier notiert: nach dem Zusammenziehen gilt die
// Identität attempted = completed + skipped NICHT mehr (sie gilt je Einzellauf). Deshalb zeigt die
// Oberfläche aus dem zusammengefassten Protokoll nur `completed` gegen `available` — als Mindestwert.
export function mergeCoverage(a: DetectionCoverage, b: DetectionCoverage): DetectionCoverage {
  return {
    available: Math.max(a.available, b.available),
    selected: Math.min(a.selected, b.selected),
    alreadyOpen: Math.max(a.alreadyOpen, b.alreadyOpen),
    attempted: Math.min(a.attempted, b.attempted),
    completed: Math.min(a.completed, b.completed),
    skipped: a.skipped + b.skipped,
    capped: a.capped || b.capped,
    aborted: a.aborted || b.aborted,
  };
}

// ================================================================================================
// AUFTRAG-mega32 BLOCK A1 (bens GELB-1) — VOLLSTÄNDIGKEIT WIRD BEWIESEN, NICHT VERMUTET.
// ================================================================================================
//
// DER BEFUND. Bis mega31 fragte diese Stelle drei MERKER ab: `!capped && !aborted && skipped === 0`.
// Das ist eine Aussage über gesetzte Flaggen, nicht über die Zahlen. Ein Datensatz mit
// `completed < attempted` oder `selected < available`, bei dem der Merker aus irgendeinem Grund
// NICHT gesetzt wurde, ging damit als „vollständig geprüft" durch — schweigend.
//
// Die heutigen Erzeuger setzen die Merker richtig (overlap-service.ts/service.ts schreiben
// `capped = selected < available` bei jedem Fortschritt). Es ist also KEIN reproduzierter
// Laufzeitfehler. Aber genau daran ist Pedis umgedrehter Vertrag zweimal gescheitert: Er darf nicht
// davon abhängen, dass jemand einen Merker setzt. „Vollständig ist nur, was BELEGT vollständig ist"
// (mega31 BLOCK A) heißt: die ZAHLEN müssen es tragen.
//
// DIE POSITIVE INVARIANTE. Ein Lauf ist genau dann vollständig, wenn ALLE fünf Aussagen gelten:
//   selected === available    — jeder verfügbare Kandidat wurde angesehen (weder Deckel noch
//                               fachliche Vorauswahl haben etwas weggeschnitten)
//   attempted === completed   — jeder vorgelegte Vergleich hat auch geurteilt
//   skipped === 0             — kein Urteilsausfall
//   !capped                   — der Erzeuger sieht selbst keine Verengung
//   !aborted                  — der Lauf ist nicht vorzeitig gestorben
//
// Die ersten beiden sind neu und tragen die Beweislast; die letzten drei bleiben als Merker stehen,
// weil ein Erzeuger eine Verengung kennen kann, die den Zahlen nicht anzusehen ist. Widersprechen
// sich Zahlen und Merker, gewinnt IMMER die unvollständige Lesart — jede Bedingung darf allein
// „nein" sagen, keine kann ein „ja" erzwingen.
//
// `alreadyOpen` zählt weiterhin NICHT als Lücke: zu dem Paar steht ein Befund, es ist angesehen —
// nur eben in einem früheren Lauf. Es geht deshalb in `selected` ein, nicht in `attempted`.
//
// DIE EINE STELLE. Diese Funktion ist die KANONISCHE Auslegung. Es gibt zwei weitere Orte, die
// dieselbe Frage beantworten müssen und `conflicts` aus Modulgründen nicht importieren dürfen
// (knowledge-object kennt conflicts nicht; apps/web importiert keine Services — s. Commit 1881211).
// Beide leiten NICHT selbst ab, sondern spiegeln diese Regel in je EINER benannten Funktion:
//   services/knowledge-object/src/coverage-complete.ts  →  isCompleteAiCheckCoverage()
//   apps/web/src/lib/aiCheckStatusCard.ts               →  aiCheckCoverageComplete()
// Dass keine der drei eigene Wege geht, hält ein WIRKSAMER Paritätswächter fest
// (tests/conflicts/coverage-invariant-parity.test.ts) — dasselbe Wächter-Muster, mit dem
// Commit 1881211 die elf Entwurfs-Grenzwerte über dieselbe Modulgrenze gebracht hat.
//
// AUFTRAG-mega33 C (bens ROT 2): „erschöpfend" hieß bis mega32 neun handgeschriebene Zeilen mit nur
// sieben verschiedenen Wahrheitsvektoren — der Verlust von `skipped === 0` an einem Spiegel wäre
// unbemerkt geblieben. Der Wächter erzeugt seine Fälle jetzt AUS der Bedingungsliste (alle 2^5 = 32)
// und prüft zusätzlich ein Gitter aus 1296 Datensätzen gegen eine unabhängige Referenz. Eine
// künftige SECHSTE Bedingung über diesen acht Feldern kippt ihn damit ebenfalls.
export function isCompleteRun(coverage: DetectionCoverage): boolean {
  return (
    coverage.selected === coverage.available &&
    coverage.attempted === coverage.completed &&
    coverage.skipped === 0 &&
    !coverage.capped &&
    !coverage.aborted
  );
}

// AUFTRAG-mega32 BLOCK B — DIE BUCHHALTUNG EINES EINZELLAUFS, GEPRÜFT STATT BEHAUPTET.
//
// Die Gleichung aus dem `completed`-Kommentar, als ausführbare Aussage. Sie gilt AUSSCHLIESSLICH je
// EINZELLAUF; nach mergeCoverage ist sie bedeutungslos (dort mischen sich Minima und Summen aus zwei
// Läufen), und deshalb steht sie bewusst NICHT in isCompleteRun.
//
// Beim Kapazitätsabbruch zählt der abbrechende Kandidat als `attempted` — er wurde vorgelegt —, aber
// weder als `completed` (er hat nicht geurteilt) noch als `skipped` (der Lauf lief nicht weiter, um
// ihn auszulassen). Er ist ein terminaler Einzelfall, und genau als solcher steht er hier: als die
// EINE Fehlstelle, die ein abgebrochener Lauf haben darf. Zwei wären ein Zählfehler.
export function singleRunBalances(coverage: DetectionCoverage): boolean {
  const accountedFor = coverage.completed + coverage.skipped + (coverage.aborted ? 1 : 0);
  return coverage.attempted === accountedFor;
}
