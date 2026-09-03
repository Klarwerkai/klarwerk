// ================================================================================================
// ASK 7/8 · AUFTRAG 160 — DIE HERMETISCHE SKALIERUNGSGEGENPROBE
// ================================================================================================
//
// WOHER DIESE DATEI KOMMT. `CLAUDE_LIVENESS_SNAPSHOT.json` führt unter
// `architecture_context/scaling_ask_targeted_test` den Befund:
//
//     „7/8 · ROT: ask-retrieval-topk-e2e erwartet gesichert, erhalten ungeprueft"
//
// BASIC 158 hat ihn lokalisiert: betroffen ist der Fall „relevantes validiertes KO wird trotz
// vieler Störer als Quelle bevorzugt" aus `ask-retrieval-topk-e2e.test.ts`. Dort stehen 40 Störer
// neben einem validierten Ziel-KO UND einer inhaltsgleichen, OFFENEN Zweitfassung. Der Befund ist
// heute nicht reproduzierbar — aber sein Laufkontext hieß `scaling_…`, und über die tatsächliche
// Bestandsgröße jenes Laufs ist nichts überliefert.
//
// WAS DIESE DATEI TUT. Sie MISST denselben Aufbau bei drei deterministischen Bestandsgrößen
// (40 / 200 / 1000) und macht sichtbar, ob und ab wann die offene Zweitfassung mitträgt.
//
// DIE ERSTE ZUSICHERUNG ist die fail-closed-Kopplung selbst (`services/reasoner/src/provider.ts:56`):
//
//     knowledgeClass = carrying.every(status === "validiert") ? "gesichert" : "ungeprueft"
//
// Diese Kopplung muss bei JEDER Bestandsgröße gelten. Genau sie ist der Vertrag, an dem der rote
// Befund hing — nicht die Frage, welches KO das Ranking gerade vorne sieht. Kippt die Klasse ohne
// dass die tragende Menge das erklärt, ist das ein echter Defekt; kippt sie MIT, hat das Produkt
// ehrlich geantwortet.
//
// ------------------------------------------------------------------------------------------------
// DIE ZWEITE ZUSICHERUNG (JOB 3042, NEU) — UND WARUM SIE HIER AUSDRÜCKLICH DASTEHT
// ------------------------------------------------------------------------------------------------
// Bis JOB 3042 stand über dieser Datei „Sie stellt KEINE neue Produktzusage auf". Das stimmte für
// den INHALT — und war für die LAUFZEIT eine Selbsttäuschung: die drei Vitest-Zeitdeckel `120_000`
// waren faktisch eine Prüfaussage, nur eine über den Rechner statt über das Produkt. Pedi hat es am
// 03.09.2026 gemessen (Eingang `EINGANG-20260903-1820-lasttest.md`): auf UNVERÄNDERTEM Code brauchte
// der 1000-Störer-Fall 62 s, 72 s, 75 s, 120 s, 132 s, 150 s — je nach Last des geteilten Rechners.
// Die Jobs 3021, 3022, 3025, 3026, 3036 und 3037 liefen daran rot, und nur bei 3022 lag ein echter
// Rückgang vor.
//
// SEIT JOB 3042 TRIFFT DIESE DATEI GENAU EINE NEUE ZUSAGE, und hier steht sie:
//
//     Die Dauer des EINEN `POST /api/ask` wächst mit dem Bestand höchstens mit n^1,5.
//     Lineares Wachstum besteht, quadratisches fällt.
//
// Die Grenze steht damit auf der logarithmischen Skala GENAU zwischen den beiden Ordnungen, um die
// es geht (25 gegen 625, Mitte 125) — die Herleitung samt Zahlen bei `BUDGETFAKTOR` unten.
//
// Geprüft wird ein VERHÄLTNIS (`askMs(1000)` gegen `askMs(40)`, Datenfaktor 25), keine
// Sekundenzahl. Ein dreimal langsamerer Rechner streckt beide Dauern gleich — das Verhältnis und
// damit das Urteil bleiben unverändert. Eine überproportionale Ask-Auswahl streckt nur die zweite
// Dauer — das Urteil kippt. Das Urteil selbst ist eine reine Funktion ohne Uhr
// (`tests/ask/skalierungsbudget.ts`) und wird in vier SELBSTPROBEN unten mit synthetischen Zahlen
// gegengeprüft — an GENAU DENSELBEN Konstanten (`VORGABE`), mit denen der 1000-Störer-Fall urteilt.
//
// EINE GRENZE DIESER ZUSAGE, ausdrücklich: Unterhalb eines Bodenwerts für die Referenzdauer wird
// NICHT geurteilt (`geurteilt: false`), weil das Verhältnis dort Rauschen wäre. Die Lastinvarianz
// gilt oberhalb des Bodens uneingeschränkt; die vollständige Regel und ihre Kanten stehen im Kopf
// von `skalierungsbudget.ts`.
//
// WAS AUSDRÜCKLICH WEITERHIN NICHT ZUGESAGT WIRD: dass bei 1000 Störern „gesichert" herauskommen
// MUSS. Eine solche Erwartung wäre eine erfundene Zusage und ein verkappter Ranking-Auftrag.
//
// HERMETISCH: kein echtes Modell, kein Netz — alles läuft über `app.inject` gegen die echten
// HTTP-Routen und den echten Bestand, wie im Bestandstest. Auch die Zeitmessung geht über denselben
// Weg; es gibt keine Attrappe und keinen zweiten Messpfad.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { beurteileSkalierung } from "./skalierungsbudget";

describe("Ask 7/8 · Skalierungsgegenprobe zum Retrieval-Grenzfall", () => {
  type App = ReturnType<typeof buildApp>;

  // Aufbau bewusst WORTGLEICH zum Bestandstest `ask-retrieval-topk-e2e.test.ts:11-46`: nur so misst
  // diese Datei denselben Gegenstand und nicht einen ähnlichen.
  async function adminApp() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  async function createKo(
    app: App,
    headers: Record<string, string>,
    title: string,
    statement: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title, statement, type: "best_practice", category: "Ask", neededValidations: 1 },
    });
    return res.json().id as string;
  }

  const validate = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  const FRAGE = "Wie wird die Spezialpresse SPX9 entlüftet?";
  const ZIEL_TITEL = "Spezialpresse SPX9 entlüften";
  const ZIEL_AUSSAGE =
    "Vor dem Entlüften der Spezialpresse SPX9 den Hydraulikdruck vollständig ablassen.";

  /** Das Beobachtungsergebnis EINES Laufs — reine Messung, keine Bewertung. */
  interface Beobachtung {
    readonly stoerer: number;
    readonly answered: boolean;
    readonly knowledgeClass: string;
    readonly sources: string[];
    readonly zielTraegt: boolean;
    readonly offeneTraegt: boolean;
    /**
     * Nur der Bestandsaufbau: die Störerschleife samt Ziel- und Zweitfassungsanlage.
     *
     * Sie wird gemessen, aber sie geht AUSDRÜCKLICH NICHT in das Skalierungsurteil ein. Bei 1000
     * Störern sind das rund 1500 HTTP-Anlagen; sie würden jede Verhältnisrechnung dominieren, und
     * gemessen wäre wieder die Rechnerlast statt der Ask-Weg.
     */
    readonly aufbauMs: number;
    /** Ausschließlich das eine `POST /api/ask`. Das — und nur das — ist der Prüfling. */
    readonly askMs: number;
  }

  /**
   * WIE OFT `messen(n)` je Größe wirklich lief.
   *
   * RUNDE 2, BENs Prüflücke 6: „Die höchstens einmalige Ausführung von `messen(n)` ist
   * implementiert, aber nicht durch einen Aufrufzähler geschützt." Er trifft — der Zwischenspeicher
   * war eine Bauweise, keine geprüfte Zusage. Ein späterer Umbau, der versehentlich an ihm
   * vorbeiruft, wäre nur an der Laufzeit aufgefallen, und die ist auf diesem Rechner kein Signal.
   * Geprüft wird der Zähler in der SCHLUSSPROBE am Ende der Datei.
   */
  const aufbauZaehler = new Map<number, number>();

  /**
   * Der Aufbau des Grenzfalls bei wählbarer Bestandsgröße.
   *
   * DETERMINISTISCH: Titel und Aussagen sind aus dem Index abgeleitet, es gibt keinen Zufall und
   * keine Zeitabhängigkeit. Derselbe Aufruf liefert denselben Bestand.
   */
  async function messen(stoerer: number): Promise<Beobachtung> {
    aufbauZaehler.set(stoerer, (aufbauZaehler.get(stoerer) ?? 0) + 1);
    const { app, headers } = await adminApp();

    const aufbauBeginn = performance.now();
    // Thematisch unpassende Störer, jeder zweite validiert — wie im Bestandstest.
    for (let i = 0; i < stoerer; i += 1) {
      const id = await createKo(
        app,
        headers,
        `Förderband FB${i} spannen`,
        `Riemen am Förderband FB${i} mit definierter Vorspannung montieren.`,
      );
      if (i % 2 === 0) {
        await validate(app, headers, id);
      }
    }

    // Das validierte Ziel …
    const ziel = await createKo(app, headers, ZIEL_TITEL, ZIEL_AUSSAGE);
    await validate(app, headers, ziel);
    // … und die inhaltsgleiche, OFFENE Zweitfassung. Sie ist der eigentliche Gegenstand: trägt sie
    // mit, fällt die Klasse regelkonform auf „ungeprueft".
    const offen = await createKo(app, headers, ZIEL_TITEL, ZIEL_AUSSAGE);
    const aufbauMs = performance.now() - aufbauBeginn;

    // Die Klammer sitzt eng um den EINEN Aufruf: kein Aufbau, kein Auslesen des Körpers, keine
    // Zuordnung. Nur so trifft die Gegenprobe (eine Bremse im Ask-Weg) genau diese Zahl.
    const askBeginn = performance.now();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: FRAGE },
    });
    const askMs = performance.now() - askBeginn;
    const body = res.json() as {
      result: { answered: boolean; knowledgeClass: string; sources: string[] };
    };

    return {
      stoerer,
      answered: body.result.answered,
      knowledgeClass: body.result.knowledgeClass,
      sources: body.result.sources,
      zielTraegt: body.result.sources.includes(ziel),
      offeneTraegt: body.result.sources.includes(offen),
      aufbauMs,
      askMs,
    };
  }

  /**
   * JOB 3042 · DER AUFBAU LÄUFT JE GRÖSSE HÖCHSTENS EINMAL.
   *
   * Bis hierher bauten die Fälle 40 und 200 Störer JE ZWEIMAL auf (die drei Größenfälle und noch
   * einmal der KIPP-GEGENPFAD) — 1680 KO-Anlagen je Dateilauf für 1240 gebrauchte.
   *
   * Gespeichert wird das VERSPRECHEN, nicht das Ergebnis: rufen zwei Fälle dieselbe Größe, wartet
   * der zweite auf denselben Lauf, statt einen zweiten zu starten. Die vier Fälle bleiben getrennte
   * `it(...)`, damit der Bericht weiterhin zeigt, WELCHE Größe kippt.
   *
   * GETEILTER ZUSTAND, ausdrücklich: Jeder Fall bleibt einzeln lauffähig — wer allein läuft, findet
   * den Zwischenspeicher leer und baut selbst auf. Und kein Fall SCHREIBT in eine Beobachtung; sie
   * ist `readonly` und wird nur gelesen. Ein Fall kann einen anderen deshalb nicht grün färben.
   */
  const zwischenspeicher = new Map<number, Promise<Beobachtung>>();
  function beobachte(stoerer: number): Promise<Beobachtung> {
    const laufend = zwischenspeicher.get(stoerer);
    if (laufend) {
      return laufend;
    }
    const neu = messen(stoerer);
    zwischenspeicher.set(stoerer, neu);
    return neu;
  }

  /**
   * DIE ERSTE INVARIANTE, die bei jeder Bestandsgröße gelten muss.
   *
   * Sie prüft nicht, WELCHE Quelle gewinnt — sondern dass Klasse und tragende Menge zueinander
   * passen. Das ist `provider.ts:56` von außen gesehen, und es ist die Grenze, an der der
   * 7/8-Befund hing. JOB 3042 hat an ihr nichts geändert.
   */
  function pruefeKopplung(b: Beobachtung): void {
    if (!b.answered) {
      // Ohne Antwort gibt es keine tragende Menge — dann darf auch keine Klasse behauptet werden.
      expect(b.sources, `${b.stoerer} Störer: keine Antwort, also keine Quellen`).toEqual([]);
      return;
    }
    expect(
      b.sources.length,
      `${b.stoerer} Störer: eine Antwort braucht eine Quelle`,
    ).toBeGreaterThan(0);
    if (b.offeneTraegt) {
      // Die offene Zweitfassung trägt mit → die Aussage IST ungeprüft. Alles andere wäre der
      // fail-open-Fehler, den provider.ts:37-39 ausdrücklich ausschließt.
      expect(
        b.knowledgeClass,
        `${b.stoerer} Störer: offene Zweitfassung trägt mit — die Klasse muss ungeprueft sein`,
      ).toBe("ungeprueft");
    }
    if (b.knowledgeClass === "gesichert") {
      // Umgekehrt: „gesichert" ist nur zulässig, wenn die offene Fassung NICHT mitträgt.
      expect(
        b.offeneTraegt,
        `${b.stoerer} Störer: „gesichert" schließt die offene Zweitfassung aus`,
      ).toBe(false);
    }
  }

  // ------------------------------------------------------------------------------------------
  // JOB 3042 · DIE ZAHLEN DER SKALIERUNGSSCHRANKE — GEMESSEN, NICHT GERATEN
  // ------------------------------------------------------------------------------------------

  /** 40 → 1000 Störer. Der Bestand wächst um diesen Faktor; höchstens so viel darf die Ask kosten. */
  const DATENFAKTOR = 1000 / 40;

  /**
   * ALLE gemessenen Referenzdauern `askMs(40)` (03.09.2026, dieser Arbeitsbaum, acht Läufe;
   * die vier kleinsten stammen aus Einzelläufen mit `-t "1000 Störer"`, wo der Prozess warm ist
   * und wenig sonst tut).
   */
  const GEMESSENE_REFERENZEN_MS = [3.6, 4.1, 4.1, 7.58, 9.34, 10.7, 11.64, 40.18] as const;

  /**
   * Der Bodenwert für die Referenzdauer `askMs(40)` — die Grenze der Urteilsfähigkeit.
   *
   * ------------------------------------------------------------------------------------------
   * RUNDE 2 · WARUM AUS 5 MS EINE 1 WURDE — GEMESSEN, NICHT GESCHÄTZT
   * ------------------------------------------------------------------------------------------
   * Runde 1 setzte den Boden auf 5 ms mit der Begründung, er liege „unter jedem gemessenen Wert".
   * Das stimmte für die vier Läufe, die ich damals hatte — und war falsch. Beim Einzellauf
   * (`-t "1000 Störer"`) ist der Prozess warm und `askMs(40)` fällt auf 3,6 bis 4,1 ms. Der Boden
   * griff also im NORMALBETRIEB, und weil Runde 2 zwischenzeitlich `geurteilt` hart erwartete, war
   * der Einzellauf reproduzierbar rot — ein Würfelwurf, genau der Fehler, gegen den diese Datei
   * gebaut ist. Er ist mir hier zweimal um die Ohren geflogen, bevor ich ihn gemessen hatte.
   *
   * EIN BODEN IST KEIN KOMFORTABSTAND, SONDERN EINE ENTARTUNGSGRENZE. Er soll allein den Fall
   * abfangen, dass gar nichts gemessen wurde (Division durch nahezu null). 1 ms liegt um das
   * 3,6-fache unter dem kleinsten je gemessenen Wert; dass eine Ask über 42 Objekte unter einer
   * Millisekunde bleibt, hieße, dass die Route nicht gearbeitet hat.
   *
   * Dass er weiterhin unter JEDEM Wert der Messreihe liegt, rechnet die SELBSTPROBE unten nach —
   * damit dieselbe Selbsttäuschung nicht ein drittes Mal möglich ist.
   *
   * Unterhalb dieses Werts urteilt `beurteileSkalierung` NICHT (`geurteilt: false`). Die Regel und
   * ihre Grenzen stehen vollständig im Kopf von `skalierungsbudget.ts` (RUNDE 2).
   */
  const BODEN_MS = 1;

  /**
   * DIE GEMESSENEN VERHÄLTNISSE `askMs(1000)/askMs(40)` auf UNVERÄNDERTEM Produktcode
   * (03.09.2026, Basisstand 9ae6c22). Der vierte Lauf lief absichtlich unter Last (parallel ein
   * zweiter vitest-Lauf über `tests/ask/`) — er ist der Grund für die Streuung.
   *
   *     Lauf 1  askMs 11,64 → 14,55   Verhältnis 1,250
   *     Lauf 2  askMs 40,18 → 46,84   Verhältnis 1,166
   *     Lauf 3  askMs  9,34 → 13,38   Verhältnis 1,433
   *     Lauf 4  askMs  7,58 → 14,64   Verhältnis 1,933   (unter Last)
   *     Lauf 5  askMs 10,70 → 31,40   Verhältnis 2,935   (Einzellauf, Runde 2)
   *     Lauf 6  askMs  4,10 →  8,80   Verhältnis 2,146   (Einzellauf, Runde 2)
   *     Lauf 7  askMs  4,10 →  6,20   Verhältnis 1,512   (Einzellauf, Runde 2)
   *     Lauf 8  askMs  3,60 →  6,40   Verhältnis 1,778   (Einzellauf, Runde 2)
   *
   * WAS DIESE ZAHLEN SAGEN: Die Ask-Antwort wird bei 25-fachem Bestand nicht 25-mal teurer, sondern
   * rund 1,2-mal. Der Ask-Weg ist in der Bestandsgröße nahezu KONSTANT — die Vorauswahl läuft über
   * die gedeckelte Projektionssuche (`services/ask/src/service.ts:497`, `ASK_PREFILTER_TERM_LIMIT`),
   * nicht über eine Schleife durch den Bestand.
   *
   * WOZU SIE HIER STEHEN: Sie setzen dem Budget eine UNTERGRENZE. Ein Budget, das nicht wenigstens
   * das Doppelte der beobachteten Streuung trägt, meldet Rechnerlast statt Skalierung — das ist der
   * Fehler, gegen den diese ganze Datei steht. Sie setzen dem Budget aber KEINE Obergrenze mehr;
   * die kommt aus dem Vertrag (s. `BUDGETFAKTOR`).
   */
  const GEMESSENE_VERHAELTNISSE = [1.25, 1.166, 1.433, 1.933, 2.935, 2.146, 1.512, 1.778] as const;

  /**
   * Der Budgetfaktor: `budget = DATENFAKTOR × BUDGETFAKTOR = 25 × 5 = 125` ist das erlaubte
   * Verhältnis.
   *
   * ------------------------------------------------------------------------------------------
   * RUNDE 2 · WARUM DIESE ZAHL UND NICHT DIE GEMESSENE
   * ------------------------------------------------------------------------------------------
   * Runde 1 setzte das Budget nach Auftrag §5 auf „höchstens das Doppelte des größten gemessenen
   * Verhältnisses" — also 2 × 1,933 = 3,75. BEN hat das zu Recht rot gegeben: Bei einem Budget von
   * 3,75 fällt EXAKT LINEARES Wachstum (Verhältnis 25) durch, und die Meldung nennt es dann
   * „überproportional". Das ist sachlich falsch und wäre wieder ein Rot ohne Befund — nur diesmal
   * nicht wegen der Rechnerlast, sondern wegen einer zu engen Zahl.
   *
   * DIE BEIDEN REGELN SIND RECHNERISCH UNVEREINBAR, und das ist der Kern des Befunds: Auftrag §5
   * ging davon aus, das gemessene Verhältnis liege bei ungefähr 25 (linear); dann wäre „2 × Messwert"
   * ein Budget von 50 gewesen und alles hätte gepasst. Gemessen sind aber 1,2 bis 1,9, weil der
   * Ask-Weg nahezu konstant ist. „2 × 1,933" und „linear muss grün bleiben" können nicht beide
   * gelten. Der Vertrag der Datei („höchstens etwa linear") ist die stärkere Zusage — sie steht im
   * Kopf und wird Pedi berichtet; die Zahl aus §5 war eine Herleitung für eine Wirklichkeit, die
   * die Messung widerlegt hat.
   *
   * DIE GEWÄHLTE GRENZE ist der geometrische Mittelwert zwischen linear und quadratisch:
   *
   *     budget = √(DATENFAKTOR × DATENFAKTOR²) = DATENFAKTOR^1,5 = 25^1,5 = 125
   *
   * Auf der logarithmischen Skala, auf der Wachstumsordnungen leben, liegt sie damit GENAU in der
   * Mitte: Jede Ordnung bis n^1,5 besteht, jede darüber fällt. Sie hängt an keiner gemessenen
   * Millisekunde und wandert deshalb nicht mit dem Rechner.
   *
   * DREI GRENZEN, alle in der SELBSTPROBE unten an DIESEN Konstanten nachgerechnet:
   *   LINEAR MUSS BESTEHEN    budget > DATENFAKTOR (25)         — sonst meldet der Wächter Rot
   *                                                                für ein lineares Produkt.
   *   QUADRATISCH MUSS FALLEN budget < DATENFAKTOR² (625)       — sonst fängt er nichts.
   *   NICHT ENGER ALS DIE     budget ≥ 2 × größter Messwert     — sonst misst er wieder die
   *   GEMESSENE STREUUNG              (2 × 1,933 = 3,87)          Rechnerlast. Hier: 32-fach Luft.
   */
  const BUDGETFAKTOR = 5;

  /**
   * NOTBREMSE, KEIN WÄCHTER — der Wächter ist das Verhältnis.
   *
   * Dieser Deckel darf nur greifen, wenn ein Lauf wirklich hängt. Er sagt nichts über Skalierung;
   * fällt ein Fall an ihm, ist das ein Befund über den Rechner oder einen Stillstand, nicht über
   * das Retrieval — und keine Aussage über das Retrieval darf daraus abgeleitet werden.
   *
   * Bemessen auf mehr als das Dreifache der langsamsten von dieser Bahn gemessenen Laufzeit eines
   * Einzelfalls. Gemessen am 03.09.2026 für „1000 Störer": 24,2 / 44,1 / 83,7 s ruhig und 86,5 s
   * unter Last (paralleler zweiter vitest-Lauf über `tests/ask/`) — 3 × 86,5 s = 260 s.
   * Die frühere Zahl stand hier bei 120 s und lag damit MITTEN in der beobachteten Streuung; sie
   * war kein Notdeckel, sondern die eigentliche Prüfaussage der Datei — genau der Fehler, den
   * JOB 3042 behebt.
   */
  const NOTBREMSE_MS = 300_000;

  // ------------------------------------------------------------------------------------------
  // SELBSTPROBE — ohne Bestand, ohne Uhr, ohne Netz
  // ------------------------------------------------------------------------------------------

  /**
   * DIE VORGABE, MIT DER AUCH DER 1000-STÖRER-FALL RECHNET.
   *
   * RUNDE 2, BENs Korrekturpflicht 3: Die SELBSTPROBE benutzte eigene Testkonstanten
   * (`budgetfaktor: 2`), während das Tor mit `0.15` urteilte — sie bewies also eine Schwelle, die
   * niemand verwendet. Jetzt gibt es genau EIN Vorgabeobjekt, und beide Seiten nehmen es. Wer
   * `BUDGETFAKTOR` auf einen Wert stellt, der lineares Wachstum ablehnt, macht damit sofort die
   * SELBSTPROBE rot — die Kalibrierung kann nicht mehr unbemerkt auseinanderlaufen.
   */
  const VORGABE = { datenfaktor: DATENFAKTOR, bodenMs: BODEN_MS, budgetfaktor: BUDGETFAKTOR };

  it("SELBSTPROBE: linear besteht, quadratisch fällt — mit den Konstanten des Tors", () => {
    // Beide Profile aus DATENFAKTOR abgeleitet, nicht aus einer zweiten Zahl: linear heißt
    // „Verhältnis = Datenfaktor" (25), quadratisch „= Datenfaktor²" (625).
    const linear = (f: number) =>
      beurteileSkalierung({ ...VORGABE, referenzMs: 20 * f, messMs: 20 * DATENFAKTOR * f });
    const quadratisch = (f: number) =>
      beurteileSkalierung({ ...VORGABE, referenzMs: 20 * f, messMs: 20 * DATENFAKTOR ** 2 * f });

    expect(linear(1).verhaeltnis).toBeCloseTo(DATENFAKTOR, 9);
    expect(linear(1).ok, `linear muss bestehen: ${linear(1).begruendung}`).toBe(true);
    expect(linear(1).geurteilt, "linear: es wurde wirklich geurteilt").toBe(true);
    expect(quadratisch(1).verhaeltnis).toBeCloseTo(DATENFAKTOR ** 2, 9);
    expect(quadratisch(1).ok, `quadratisch muss fallen: ${quadratisch(1).begruendung}`).toBe(false);

    // LASTPROBE — die Eigenschaft, um die es in diesem Auftrag geht: derselbe Lauf auf einem
    // dreimal langsameren Rechner streckt BEIDE Dauern und darf das Urteil nicht bewegen.
    // (Gilt oberhalb des Bodens; 20 ms und 60 ms liegen beide darüber.)
    expect(linear(3).ok, "dreimal langsamer: linear bleibt grün").toBe(true);
    expect(quadratisch(3).ok, "dreimal langsamer: quadratisch bleibt rot").toBe(false);
    expect(linear(3).verhaeltnis).toBeCloseTo(linear(1).verhaeltnis, 9);
    expect(quadratisch(3).verhaeltnis).toBeCloseTo(quadratisch(1).verhaeltnis, 9);
  });

  it("SELBSTPROBE: unterhalb des Bodens wird nicht geurteilt — und zwar auf beiden Seiten einer Lastskalierung", () => {
    // RUNDE 2, BENs Korrekturpflicht 2. Sein Gegenbeispiel an Runde 1: der Bodenfall
    // `1 ms → 200 ms` war grün, dieselbe Messung dreimal langsamer (`3 ms → 600 ms`) wurde rot.
    //
    // Seine Zahlen galten gegen den damaligen Boden von 5 ms. Der Boden steht jetzt bei 1 ms
    // (Begründung bei `BODEN_MS`), deshalb steht hier SEIN FALL, auf den heutigen Boden übertragen:
    // dieselbe Lage (Referenz weit unter dem Boden, Verhältnis 200), dieselbe ×3-Streckung.
    // Beide Referenzen liegen unter dem Boden; beide Ausgänge müssen gleich sein.
    const knapp = beurteileSkalierung({ ...VORGABE, referenzMs: 0.2, messMs: 40 });
    const knappMalDrei = beurteileSkalierung({ ...VORGABE, referenzMs: 0.6, messMs: 120 });

    for (const [name, u] of [
      ["0,2/40", knapp],
      ["0,6/120 (dreimal langsamer)", knappMalDrei],
    ] as const) {
      expect(u.geurteilt, `${name}: unter dem Boden wird nicht geurteilt`).toBe(false);
      expect(u.ok, `${name}: ein Nicht-Urteil kippt nicht in Rot — ${u.begruendung}`).toBe(true);
      expect(u.begruendung, `${name}: das Nicht-Urteil steht in der Meldung`).toContain(
        "KEIN URTEIL",
      );
    }
    // Der Ausgang ist derselbe — genau das war in Runde 1 nicht so.
    expect(knappMalDrei.ok).toBe(knapp.ok);
    expect(knappMalDrei.geurteilt).toBe(knapp.geurteilt);

    // DIE EINZIG MÖGLICHE BEWEGUNG einer Verlangsamung führt vom Nicht-Urteil ZUM Urteil, nie von
    // einem grünen Urteil zu einem roten: 0,5 ms liegt unter dem Boden, dreimal langsamer (1,5 ms)
    // darüber. Das Verhältnis ist in beiden Fällen 20 und bleibt unter dem Budget 125.
    //
    // AUSDRÜCKLICH: Überquert eine Verlangsamung den Boden UND liegt das Verhältnis wirklich über
    // dem Budget, wird der Fall rot — dann ist er es aber zu Recht. Vorher war er nicht grün,
    // sondern ungeprüft, und die Verlangsamung hat die Messung erst belastbar gemacht.
    const unterm = beurteileSkalierung({ ...VORGABE, referenzMs: 0.5, messMs: 10 });
    const drueber = beurteileSkalierung({ ...VORGABE, referenzMs: 1.5, messMs: 30 });
    expect(unterm.geurteilt, "0,5 ms: noch kein Urteil").toBe(false);
    expect(drueber.geurteilt, "1,5 ms: jetzt wird geurteilt").toBe(true);
    expect(unterm.ok).toBe(true);
    expect(drueber.ok, `nach der Bodenkante bleibt es grün: ${drueber.begruendung}`).toBe(true);

    // UNBRAUCHBARE MESSDAUER — kein stilles Grün, und ausdrücklich kein Urteil.
    const kaputt = beurteileSkalierung({ ...VORGABE, referenzMs: 20, messMs: Number.NaN });
    expect(kaputt.ok).toBe(false);
    expect(kaputt.geurteilt).toBe(false);
    expect(kaputt.begruendung).toContain("Messung unbrauchbar");
  });

  it("SELBSTPROBE: das Budget liegt im vertraglichen Korridor und über der gemessenen Streuung", () => {
    const budget = DATENFAKTOR * BUDGETFAKTOR;
    const groesster = Math.max(...GEMESSENE_VERHAELTNISSE);
    // LINEAR MUSS BESTEHEN — sonst meldet der Wächter „überproportional" für ein lineares Produkt.
    expect(
      budget,
      `Budget ${budget} muss lineares Wachstum (${DATENFAKTOR}) durchlassen`,
    ).toBeGreaterThan(DATENFAKTOR);
    // QUADRATISCH MUSS FALLEN — sonst fängt der Wächter das nicht, wogegen er steht.
    expect(
      budget,
      `Budget ${budget} muss quadratisches Wachstum (${DATENFAKTOR ** 2}) fangen`,
    ).toBeLessThan(DATENFAKTOR ** 2);
    // NICHT ENGER ALS DIE GEMESSENE STREUUNG — sonst misst der Wächter wieder die Rechnerlast.
    expect(
      budget,
      `Budget ${budget} gegen die gemessene Streuung [${GEMESSENE_VERHAELTNISSE.join(", ")}]`,
    ).toBeGreaterThanOrEqual(2 * groesster);
  });

  it("SELBSTPROBE: der Bodenwert liegt unter jeder gemessenen Referenzdauer", () => {
    // RUNDE 2. Diese Zeile gäbe es nicht, wenn ich in Runde 1 nicht genau hier danebengegriffen
    // hätte: Der Boden stand auf 5 ms, während der Einzellauf 3,6 ms misst — er griff im
    // Normalbetrieb, statt nur die Entartung abzufangen. Ein Boden, der die üblichen Referenzen
    // verschluckt, macht aus der Verhältnisprüfung heimlich wieder eine absolute Zeitschranke
    // (`askMs(1000) ≤ Boden × Budget`).
    //
    // Statisch geprüft und deshalb nicht flackernd: Wer den Boden anhebt oder die Messreihe
    // fortschreibt und dabei einen kleineren Wert einträgt, wird hier gefangen — nicht erst durch
    // ein rotes Tor auf einem zufällig schnellen Rechner.
    const kleinste = Math.min(...GEMESSENE_REFERENZEN_MS);
    expect(
      BODEN_MS,
      `Bodenwert ${BODEN_MS} ms gegen die kleinste gemessene Referenz ${kleinste} ms ` +
        `(Reihe: ${GEMESSENE_REFERENZEN_MS.join(", ")})`,
    ).toBeLessThan(kleinste);
  });

  // ------------------------------------------------------------------------------------------
  // Die drei Bestandsgrößen. Getrennte Fälle statt einer Schleife, damit im Bericht sichtbar ist,
  // WELCHE Größe gegebenenfalls kippt — eine Schleife meldete nur „irgendwo rot".
  // ------------------------------------------------------------------------------------------

  it("40 Störer: Klasse und tragende Menge sind gekoppelt", async () => {
    const b = await beobachte(40);
    pruefeKopplung(b);
    // Die Beobachtung selbst wird festgehalten, nicht bewertet: bei dieser Größe ist der
    // Bestandstest grün, also trägt hier nur das validierte Ziel.
    expect(b.zielTraegt, "40 Störer: das validierte Ziel muss die Antwort tragen").toBe(true);
  });

  it("200 Störer: Klasse und tragende Menge sind gekoppelt", async () => {
    const b = await beobachte(200);
    pruefeKopplung(b);
    expect(b.answered, "200 Störer: der thematische Treffer bleibt auffindbar").toBe(true);
  });

  it(
    "1000 Störer: Klasse und tragende Menge sind gekoppelt, und die Ask bleibt im Budget",
    async () => {
      const klein = await beobachte(40);
      const b = await beobachte(1000);
      pruefeKopplung(b);
      // BEWUSST KEINE Erwartung an `knowledgeClass` oder `zielTraegt`. Ob das Ranking bei dieser
      // Größe noch dasselbe wählt, ist genau die offene Frage hinter „7/8" — sie hier zu einer
      // Zusage zu machen hieße, eine Produktannahme zu erfinden.
      expect(typeof b.knowledgeClass, "1000 Störer: eine Klasse wird geliefert").toBe("string");

      // JOB 3042: die neue, relative Zusage. Keine Sekundenzahl steht in dieser Erwartung — nur
      // das Verhältnis der beiden Ask-Dauern gegen das gemessene Budget.
      // DIESELBE `VORGABE` wie in der SELBSTPROBE — es gibt nur eine Kalibrierung im Haus.
      const urteil = beurteileSkalierung({
        ...VORGABE,
        referenzMs: klein.askMs,
        messMs: b.askMs,
      });
      // Der Aufbau steht in der Meldung, damit ein Leser sieht, wie gross der Unterschied zwischen
      // Aufbau und Ask ist — er geht in das Urteil ausdrücklich NICHT ein.
      const rohwerte = `askMs 40=${klein.askMs.toFixed(1)}, 1000=${b.askMs.toFixed(1)}; Aufbau (nicht im Urteil) 40=${klein.aufbauMs.toFixed(0)}, 1000=${b.aufbauMs.toFixed(0)}`;
      // EIN NICHT-URTEIL DARF NICHT ROT MACHEN — es ist keine Aussage über das Retrieval, sondern
      // über die Messbarkeit. Es darf aber auch nicht unsichtbar bleiben: dann hielte ein Leser das
      // Grün für einen Beleg. Deshalb steht es im Laufprotokoll, und die Kalibrierung des
      // Bodenwerts wird in der SELBSTPROBE statisch gegen die Messreihe geprüft — dort kann sie
      // nicht flackern.
      //
      // (Runde 2 hatte hier zwischenzeitlich ein hartes `expect(urteil.geurteilt).toBe(true)`. Das
      // war zweimal reproduzierbar rot, weil der Einzellauf `askMs(40)` auf 3,6 ms drückt — also
      // genau der Würfelwurf, den dieser Auftrag abschafft. Deshalb steht er hier nicht mehr.)
      if (!urteil.geurteilt) {
        console.warn(`[JOB 3042] 1000 Störer OHNE Skalierungsurteil: ${urteil.begruendung}`);
      }
      expect(
        urteil.ok,
        `1000 Störer: die Ask-Auswahl wächst überproportional. ${urteil.begruendung} (${rohwerte})`,
      ).toBe(true);
    },
    NOTBREMSE_MS,
  );

  // ------------------------------------------------------------------------------------------
  // Gegenpfade
  // ------------------------------------------------------------------------------------------

  it(
    "KIPP-GEGENPFAD: trägt die offene Zweitfassung, ist die Antwort nie gesichert",
    async () => {
      // Der Kippfall wird hier NICHT erzwungen, sondern über alle drei Größen gesucht. Findet er
      // sich, muss die Klasse ungeprüft sein; findet er sich nicht, ist das ebenfalls ein Befund —
      // und der Fall sagt das ehrlich, statt eine Bedingung zu behaupten.
      const beobachtungen = [await beobachte(40), await beobachte(200)];
      const gekippt = beobachtungen.filter((b) => b.offeneTraegt);
      for (const b of gekippt) {
        expect(b.knowledgeClass).toBe("ungeprueft");
      }
      // Auch der Nicht-Kipp ist eine gültige Beobachtung: dann trägt überall nur das validierte Ziel.
      for (const b of beobachtungen.filter((x) => !x.offeneTraegt)) {
        expect(
          b.sources.every((s) => s !== ""),
          `${b.stoerer} Störer: Quellen sind Kennungen`,
        ).toBe(true);
      }
    },
    NOTBREMSE_MS,
  );

  it(
    "WISSENSLÜCKEN-GEGENPFAD: ohne thematischen Treffer keine erfundene Quelle",
    async () => {
      // Eigener Aufbau, kein Zwischenspeicher: dieser Fall stellt eine ANDERE Frage an einen
      // Bestand OHNE thematischen Treffer. Liefe er auf dem Bestand aus `messen(200)`, stünden dort
      // Ziel-KO und Zweitfassung — und der Fall prüfte einen anderen Gegenstand als bisher.
      const { app, headers } = await adminApp();
      for (let i = 0; i < 200; i += 1) {
        const id = await createKo(
          app,
          headers,
          `Förderband FB${i} spannen`,
          `Riemen am Förderband FB${i} mit definierter Vorspannung montieren.`,
        );
        if (i % 2 === 0) {
          await validate(app, headers, id);
        }
      }
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: { question: "Wie hoch ist der aktuelle Wechselkurs?" },
      });
      const body = res.json() as { result: { answered: boolean; sources: string[] } };
      // Der Bestand ist groß — trotzdem darf nichts als Quelle erscheinen, das die Frage nicht trägt.
      expect(body.result.answered).toBe(false);
      expect(body.result.sources).toEqual([]);
    },
    NOTBREMSE_MS,
  );

  it("SCHLUSSPROBE: keine Bestandsgröße wurde zweimal aufgebaut", () => {
    // RUNDE 2, BENs Prüflücke 6. Steht bewusst ZULETZT — Vitest führt die Fälle einer Datei der
    // Reihe nach aus, also hat der Zähler hier alles gesehen, was in diesem Lauf lief.
    //
    // Die Zusicherung ist teilmengenfest: geprüft wird „keine Größe öfter als einmal", nicht „genau
    // diese drei Größen einmal". Damit gilt sie auch bei `-t "1000 Störer"`, wo nur 40 und 1000
    // aufgebaut werden, und sie bleibt aussagekräftig, wenn ein Fall dazukommt.
    const protokoll = [...aufbauZaehler.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([groesse, anzahl]) => `${groesse}:${anzahl}`)
      .join(" ");
    for (const [groesse, anzahl] of aufbauZaehler) {
      expect(anzahl, `Bestandsgröße ${groesse} mehrfach aufgebaut (Protokoll ${protokoll})`).toBe(
        1,
      );
    }
  });
});
