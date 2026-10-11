// ================================================================================================
// JOB 3038 — DIE EINE DIKTAT-WAHRHEIT.
// ================================================================================================
//
// Bis JOB 3038 stand die Rekorder-Fabrik samt ihrer Web-Speech-Typen INLINE in
// `pages/Capture.tsx` (dort `:310-332` und `:2564-2583`). Solange nur das Erfassen diktierte, war
// das tragbar. Mit dem Mikrofon im Fragefeld (`pages/Ask.tsx`) wäre daraus eine zweite Kopie
// derselben Logik geworden — und zwei Kopien driften. Die Bausteine sind deshalb hierher
// VERSCHOBEN, nicht kopiert: `Capture.tsx` hat sie nicht mehr, es importiert sie.
//
// Die Feature-Detection bleibt ausdrücklich, wo sie ist (`lib/speechSupport.ts`): sie ist DOM-frei,
// getestet und wird hier importiert — nicht verdoppelt und nicht verschoben.
//
// Es entsteht KEIN neuer Ausgangsweg: die Erkennung bleibt beim Browser, es wird nichts
// hochgeladen. Das Versprechen aus `speechSupport.ts:3` („kein Cloud-STT, kein Backend") gilt
// unverändert.

// Web-Speech-API (Diktat) — minimale Typen statt any.
export interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  /** Der Browser reicht ein Ereignis mit `error` („not-allowed“, „no-speech“ …) — wer will, liest es. */
  onerror: ((e?: { error?: string }) => void) | null;
  /**
   * produkt:20261010:assistenz-name-avatar: Der Browser bestätigt, dass er tatsächlich Ton aufnimmt
   * (`audiostart`, erst nach erteilter Mikrofonberechtigung) bzw. damit aufgehört hat (`audioend`).
   * `start()` ist nur die Anforderung. Optional — wer die Ereignisse nicht braucht, setzt sie nicht.
   */
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
}
type SpeechCtor = new () => SpeechRec;

/**
 * Der echte Konstruktor der Browser-API.
 *
 * `globalThis` statt `window` — und das ist kein Stilentscheid: der Root-Typcheck
 * (`tsconfig.json:6`, `lib: ["ES2022"]`) ist NODE-REIN und kennt den Bezeichner `window` nicht.
 * Diese Datei wird von einem `.ts`-Test unter `tests/` importiert und fällt damit in genau diesen
 * Check. `speechSupport.ts` löst dasselbe Problem, indem es DOM-frei bleibt; hier ist der Weg
 * derselbe. Im Browser ist `globalThis` das `window`, in jsdom ebenso — es wird nichts anderes
 * gelesen als vorher.
 */
function speechCtor(): SpeechCtor | undefined {
  const w = globalThis as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Die Erkennungssprache aus dem i18n-Sprachkürzel — BCP-47, wie die Web-Speech-API sie erwartet.
 *
 * DER FEHLER, DEN DAS ABLÖST: `Capture.tsx:2570` setzte `rec.lang = "de-DE"` FEST. Die App führt
 * drei Sprachbündel (`i18n.ts:13348`), also diktierte jede englische und niederländische Oberfläche
 * gegen ein deutsches Modell.
 *
 * ZWEI ENTSCHEIDUNGEN, die hier getroffen und nicht erfragt sind:
 *   · Ein REGIONSKÜRZEL wird auf die Basissprache reduziert. `i18n.language` trägt in echten
 *     Browsern regelmäßig eine Region („de-CH", „en-GB"); ohne die Reduktion fiele jeder dieser
 *     Werte in den Unbekannt-Zweig, und der Fehler wäre nur verschoben.
 *   · UNBEKANNTES fällt auf `de-DE` zurück — den HEUTIGEN Wert. Ein unbekanntes Kürzel darf das
 *     Verhalten nicht still schlechter machen als vor diesem Umbau.
 */
export function diktatSprache(sprache: string): string {
  const basis = sprache.split("-")[0]?.toLowerCase() ?? "";
  if (basis === "en") {
    return "en-US";
  }
  if (basis === "nl") {
    return "nl-NL";
  }
  return "de-DE";
}

/**
 * Die gemeinsame Rekorder-Fabrik für jedes Diktat-Ziel (Erfassen-Freitext, Interview-Antwort,
 * Fragefeld). `append` bekommt den erkannten Text — was damit geschieht, entscheidet die Fläche;
 * `onDone` läuft bei Ende UND bei Fehler, damit kein stiller Dauer-Läuft-Zustand entsteht.
 *
 * `onDone` BEKOMMT DEN REKORDER, DER SICH VERABSCHIEDET — und das ist der Kern von JOB 3038
 * Runde 3. Bis dahin war es ein Rückruf ohne Absender, und die Fläche konnte nicht unterscheiden,
 * WESSEN Ende gemeldet wurde. Die Web-Speech-Spezifikation lässt die Ereignisreihenfolge offen und
 * verlangt ein `end` bei JEDEM Sitzungsende, auch nach einem `error` (§4.1.5). Damit ist diese
 * Folge zulässig:
 *
 *     A starten → A meldet `error` → B starten → A meldet SPÄT sein `end`
 *
 * Ohne Absender räumte das späte `end` von A den Zustand von B ab: der Stoppknopf verschwand,
 * während B weiterlief — ein Mikrofonzugriff ohne sichtbaren Stoppweg. Mit dem Absender kann die
 * Fläche einen fremden, verspäteten Rückruf erkennen und ignorieren; gemessen in
 * `tests/diktat-fragefeld/mikrofon-im-fragefeld.test.tsx` (F8).
 *
 * Der Absender kommt aus dem ABSCHLUSS, nicht vom Browser: der Browser ruft `onend(event)` und
 * weiss nichts von unserem Rekorderobjekt. Deshalb wird hier ein eigener Rückruf gesetzt, der den
 * frisch erzeugten `rec` festhält und weiterreicht.
 *
 * Kann der Browser keine Spracherkennung, gibt es `null` und keinen Rekorder — die Fläche zeigt
 * dann den ehrlichen Hinweis statt eines toten Knopfes.
 *
 * FR-CAP-03 („Diktat zeigt Text live"): Wer `zwischen` mitgibt, bekommt die noch nicht endgültigen
 * Erkennungen sofort zu sehen (`interimResults`). In `append` landet weiterhin NUR Endgültiges —
 * der Zwischenstand ist reine Anzeige und wird beim nächsten Endergebnis und beim Ende geleert, er
 * schreibt nie ins Feld. Ohne `zwischen` bleibt alles wie vorher.
 *
 * Klara 02 (produkt:20261008:klara-sprache): Wer `fehlerGrund` mitgibt, erfährt VOR `onDone` den
 * Grund eines Fehlers aus dem Browser-Ereignis — vor allem „not-allowed“ (Mikrofon abgelehnt), damit
 * die Fläche das sagen kann statt still zu enden. Ohne `fehlerGrund` bleibt alles wie vorher.
 */
export function makeRec(
  append: (text: string) => void,
  onDone: (beendet: SpeechRec) => void,
  lang: string,
  zwischen?: (text: string) => void,
  fehlerGrund?: (grund: string) => void,
): SpeechRec | null {
  const Ctor = speechCtor();
  if (!Ctor) {
    return null;
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = zwischen !== undefined;
  rec.onresult = (e) => {
    let text = "";
    let vorlaeufig = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const ergebnis = e.results[i];
      // Ohne `interimResults` ist jedes Ergebnis endgültig; nur ein ausdrückliches `false` ist es nicht.
      if (ergebnis?.isFinal === false) {
        vorlaeufig += ergebnis[0]?.transcript ?? "";
      } else {
        text += ergebnis?.[0]?.transcript ?? "";
      }
    }
    if (text) {
      append(text);
    }
    zwischen?.(vorlaeufig);
  };
  const beenden = (): void => {
    zwischen?.("");
    onDone(rec);
  };
  rec.onend = beenden;
  rec.onerror = (e) => {
    fehlerGrund?.(typeof e?.error === "string" ? e.error : "");
    beenden();
  };
  return rec;
}
