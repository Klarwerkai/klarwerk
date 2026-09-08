// ================================================================================================
// JOB 3268 · D1-R — DER VERSIONSWÄCHTER: EIN ALTER TAB MERKT, DASS ER ALT IST.
// ================================================================================================
//
// DIE BELEGTE LAGE (Codex d4db9b3e/c5418bcc, 08.09.2026, Live 1.0.0-beta.1.184): Pedis seit Stunden
// offener Tab auf /erfassen hatte den Knopf „Meine Entwürfe" nicht, ein frischer Tab desselben
// Profils schon. Die alte Oberfläche lief weiter — sie ist nicht abgestürzt, sie war nur alt, und
// nichts in ihr sagte das.
//
// WARUM `lib/staleChunk.ts` DAS NICHT DECKT (und hier nichts dupliziert wird): der dortige Hinweis
// hängt an einem LADEFEHLER — `import()` eines Chunks scheitert, weil die alten Chunk-Adressen nach
// einem Deploy weg sind. Eine alte Oberfläche, die NICHT nachlädt, wirft nie einen solchen Fehler.
// Das sind zwei verschiedene Zustände, und dieser Wächter deckt den zweiten.
//
// DER ABRUF IST ABSICHTLICH KARG (§5.1/§8.7): `/health` liefert seit JOB 1113 die ausgelieferte
// Version (`services/app/src/build-app.ts:1604`). Gefragt wird EINMAL beim Aufbau, danach alle fünf
// Minuten und beim Sichtbarwerden des Tabs — NIE bei ausgeblendetem Tab, und nie mehr, sobald die
// Abweichung einmal feststeht. Das sind bei einem Tag offenem Tab rund 100 Anfragen ohne Körper,
// nicht ein Sekundentakt.
//
// EHRLICHKEIT VOR OPTIK (§5.5): Ist der Live-Stand nicht zu erfahren, entsteht KEIN Zustand „neue
// Version". Ein Hinweis auf Verdacht würde beim nächsten Netzhänger jeden Tab zum Neuladen
// auffordern; das wäre schlimmer als das Schweigen, das dieser Auftrag beseitigen soll.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — BENS BEFUND: „UNBEKANNT" IST KEINE NEUE VERSION.
// ------------------------------------------------------------------------------------------------
//
// Runde 1 nahm JEDE nichtleere abweichende Zeichenkette als neue Lieferung. Der Server gibt aber
// einen ausdrücklichen ERSATZWERT aus, wenn er seine eigene Version nicht lesen kann:
// `buildVersion()` liefert dann `BUILD_UNBEKANNT` = `"unbekannt"`
// (`services/app/src/build-app.ts:966-979`). Aus „ich weiss es nicht" wurde so „es gibt eine neue
// Version" — und weil der Wächter nach dem ersten Ja aufhört zu fragen, hätte auch eine spätere
// gültige Antwort das nicht mehr geradegerückt. Bens Gegenbeispiel: `version: "unbekannt"` →
// Hinweis erschien.
//
// DIE REGEL IST DESHALB EINE FORMPRÜFUNG, KEINE WORTLISTE, und sie ist im Haus nicht neu: derselbe
// `build-app.ts` prüft den Deploy-Commit gegen `COMMIT_RE` mit genau dieser Begründung — „eine halb
// verdrahtete Auslieferungskette reicht gern einen Branchnamen, ein `latest` oder einen
// uneingesetzten `$SOURCE_COMMIT` durch" (`build-app.ts:931-945`). Eine Versionsangabe dieses
// Produkts beginnt mit einer Ziffer (`apps/web/src/version.ts`, `package.json`, gegeneinander
// gepinnt in `tests/app/health-version-commit.test.ts`). Was nicht so aussieht, ist kein Stand,
// sondern ein Platzhalter — `"unbekannt"` heute und jeder andere morgen.
//
// DER WERT WIRD NICHT ABGESCHRIEBEN: `apps/web` darf `services/**` nicht importieren
// (dependency-cruiser). Statt eine zweite Wahrheit anzulegen, prüft
// `tests/d1r-neue-version-im-alten-tab/unbekannt-ist-keine-version.test.tsx` den ECHTEN
// Serverkonstanten `BUILD_UNBEKANNT` gegen diese Regel — zwei Wege, ein Ergebnis. Die Endung ist
// `.tsx` ohne JSX, damit die Node-reine Wurzel-Typprüfung diese Datei nicht einsammelt (Begründung
// im Kopf jener Datei). Runde 2 schrieb hier `.ts` — den toten Verweis fing
// `tests/structure/testverweise-aufloesbar.test.ts`.
//
// BENANNTE BLINDHEIT: Gäbe das Produkt seiner Version eines Tages ein Präfix („v2.0.0"), hielte
// diese Regel sie für einen Platzhalter, und der Hinweis bliebe still aus. Das ist die gewollte
// Richtung — Schweigen statt Fehlalarm —, aber es ist eine Richtung, kein Zufall.
import { useEffect, useState } from "react";
import { APP_VERSION } from "../version";

/** Fünf Minuten (§5.1). Eine Quelle für den Takt — auch für den, der ihn später ändern will. */
export const VERSIONSABRUF_INTERVALL_MS = 5 * 60 * 1000;

/**
 * Die Form einer echten Versionsangabe: beginnt mit einer Ziffer, danach nur Versionszeichen.
 * `1.0.0-beta.1.194` erfüllt sie, `unbekannt` nicht (s. Kopf).
 */
const VERSIONSFORM = /^\d[\w.+-]*$/;

/** Was der Abruf über den Live-Stand ergeben hat. Genau drei Lagen, keine vierte. */
export type Versionsbefund =
  | { lage: "neu"; live: string }
  | { lage: "gleich" }
  /** Nichts gelernt. `grund` ist Diagnosetext, nie Anzeigetext. */
  | { lage: "unbekannt"; grund: string };

/**
 * Das Urteil über eine gemeldete Live-Version — die einzige Stelle, an der „neue Version" entsteht.
 *
 * Ohne Text, mit fremder Form oder mit dem Ersatzwert des Servers ist über den Live-Stand nichts
 * bekannt; „unbekannt" ist ausdrücklich KEINE Abweichung (Runde 2, s. Kopf).
 */
export function versionsbefund(geladen: string, live: unknown): Versionsbefund {
  if (typeof live !== "string" || live.trim() === "") {
    return { lage: "unbekannt", grund: "Antwort ohne Versionsfeld" };
  }
  const wert = live.trim();
  if (!VERSIONSFORM.test(wert)) {
    return { lage: "unbekannt", grund: `Versionsangabe ohne Zahlform: ${wert}` };
  }
  return wert === geladen ? { lage: "gleich" } : { lage: "neu", live: wert };
}

/**
 * Das Versionsfeld aus `/health`. Wirft, wenn schon die Antwort nichts taugt — der Aufrufer hat
 * genau einen Weg für „nichts gelernt".
 */
async function liveVersionsfeld(): Promise<unknown> {
  // `no-store`: der Zwischenspeicher des Browsers dürfte sonst genau die alte Antwort liefern, die
  // dieser Abruf entlarven soll. `/health` liegt nicht unter `/api` und braucht deshalb nicht den
  // Client aus `api/client.ts`.
  const antwort = await fetch("/health", { cache: "no-store", credentials: "same-origin" });
  if (!antwort.ok) {
    throw new Error(`/health antwortete mit ${antwort.status}`);
  }
  const daten = (await antwort.json()) as { version?: unknown };
  return daten.version;
}

/**
 * Diagnose, aber JE GRUND NUR EINMAL je geladener Oberfläche.
 *
 * Runde 1 schrieb jede fehlgeschlagene Prüfung einzeln ins Protokoll; im Torlauf standen dadurch
 * dieselben vier Wörter dutzendfach (jede gemountete Testdatei ohne echten Server erzeugt sie).
 * Ein Protokoll, das man wegen Wiederholungen überliest, meldet nichts mehr. Der Grund ist die
 * Auskunft, die Anzahl ist es nicht.
 */
const gemeldeteGruende = new Set<string>();
function meldeEinmal(schluessel: string, grund: unknown): void {
  if (gemeldeteGruende.has(schluessel)) {
    return;
  }
  gemeldeteGruende.add(schluessel);
  console.debug("[KLARWERK] Versionsabruf ohne Ergebnis:", grund);
}

/**
 * Läuft in diesem Tab eine überholte Oberfläche?
 *
 * `false` heisst „nichts bekannt oder gleicher Stand" — nie „bestimmt nicht". Steht die Abweichung
 * einmal fest, hört der Wächter auf zu fragen: die Lage kann sich für diesen Tab nicht mehr ändern,
 * und der Hinweis steht ohnehin schon da. Bleibt sie unbekannt, wird WEITER gefragt (Runde 2): eine
 * spätere gültige Antwort muss den Hinweis noch auslösen können.
 */
export function useNeueVersionVerfuegbar(): boolean {
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    if (neu) {
      return undefined;
    }
    let abgemeldet = false;
    let laeuft = false;
    const pruefe = async (): Promise<void> => {
      // §5.1: kein Abruf bei ausgeblendetem Tab. Ein Hintergrundtab, den niemand ansieht, soll
      // weder Netz noch Server kosten — und der Hinweis wäre dort ohnehin unsichtbar.
      if (document.visibilityState === "hidden" || laeuft) {
        return;
      }
      laeuft = true;
      try {
        const befund = versionsbefund(APP_VERSION, await liveVersionsfeld());
        if (befund.lage === "unbekannt") {
          meldeEinmal(befund.grund, befund.grund);
        } else if (befund.lage === "neu" && !abgemeldet) {
          setNeu(true);
        }
      } catch (fehler) {
        // §5.5: kein Fehlalarm. Der Fehlschlag ist eine Diagnosezeile, keine Aussage über den
        // Live-Stand — und der Wächter fragt beim nächsten Takt wieder.
        meldeEinmal("abruf", fehler);
      } finally {
        laeuft = false;
      }
    };

    void pruefe();
    const uhr = setInterval(() => void pruefe(), VERSIONSABRUF_INTERVALL_MS);
    const beimSichtwechsel = (): void => void pruefe();
    document.addEventListener("visibilitychange", beimSichtwechsel);
    return () => {
      abgemeldet = true;
      clearInterval(uhr);
      document.removeEventListener("visibilitychange", beimSichtwechsel);
    };
  }, [neu]);

  return neu;
}
