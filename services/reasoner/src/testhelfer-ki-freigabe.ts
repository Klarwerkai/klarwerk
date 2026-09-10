// ================================================================================================
// JOB 3550 · DIE KI-FREIGABE IM TESTAUFBAU — EINE STELLE, NICHT 267.
// ================================================================================================
//
// WOZU. JOB 3549 baut die zentrale Adminfreigabe für öffentliche KI: ohne sie geht nichts hinaus
// (PRIORITAETEN.md, Pedi: „Voreinstellung bleibt ohne ausdrückliche Adminfreigabe gesperrt").
// Bestandstests, die einen ECHTEN Weg nach draußen messen, bauen ihren Reasoner heute ohne jede
// Freigabe — sie würden mit dem neuen Kern rot, obwohl das Produkt sich richtig verhält. Sie
// brauchen im Aufbau dieselbe Freigabe, die ein Administrator im Betrieb setzt.
//
// WARUM HIER UND NICHT IN JEDER TESTDATEI. JOB 3500 hat die Alternative gemessen: 267 rote Fälle in
// 65 Dateien (`archiv/3500/runde-3/code.md`). Dieselben drei Zeilen 267-mal zu kopieren heißt, sie
// 267-mal nachzuziehen, sobald der Vertrag sich rührt. Deshalb genau eine Stelle, und deshalb ein
// NAME, der beim Lesen einer Testdatei sofort sagt, was dort erlaubt wurde.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT IST. Sie ändert kein Produktverhalten und entscheidet nichts:
// sie trägt einen Wert in eine Konfigurationseingabe, mehr nicht. Die Entscheidungsstelle liegt in
// `service.ts` und gehört JOB 3549 (Auftrag 3550 §3.5). Sie ist ein Testhelfer und hat deshalb
// bewusst keinen Produktaufrufer — dieselbe Bauart und derselbe Grund wie
// `resetModelSemaphoreForTests` in `model-concurrency.ts`; beide stehen im Register des
// Aufrufer-Wächters (`tests/capture/aufrufer-waechter.test.ts`, REGISTER 1).
//
// DIE GRENZE, DIE HIER EINGEBAUT IST. Die Schalter sind auf `true` verengt (`?: true`, nicht
// `?: boolean`). Damit lässt sich mit diesem Helfer keine Freigabe auf `false` behaupten, und der
// Vertrag aus Auftrag §4 („nur `true` zählt") kann nicht versehentlich unterlaufen werden: wer eine
// Freigabe NICHT will, lässt den Schalter weg. Das ist derselbe Unterschied, den das Produkt macht —
// `false` und „fehlt" sperren gleich.
//
// DER VERTRAG, gegen den hier gebaut wird, steht in der Rückgabe von JOB 3500 (Runde 3, Abschnitt
// „VERTRAG FÜR 3501/3502") und im Auftrag 3550 §4:
//
//     taskConfig.kiFreigabe.oeffentlicheKi        — darf überhaupt etwas an eine öffentliche KI
//     taskConfig.kiFreigabe.vertraulicheInhalte   — darf auch VERTRAULICHES dorthin
//     Schreibweg: `setTaskConfig`; ein weggelassenes `kiFreigabe` lässt die Freigabe unverändert.
//
// Solange der Kern (JOB 3549) nicht eingebaut ist, kennt `ReasonerTaskConfigEingabe` das Feld noch
// nicht und `normalizeTaskConfig` verwirft es beim Bauen der wirksamen Zuordnung
// (`service.ts`: `config: { global, perTask }`). Das ist der GEWOLLTE Zwischenzustand: die Tests
// laufen heute unverändert grün und tragen die Freigabe schon, wenn der Kern sie liest. Deshalb
// steht das Feld hier als ZUSATZ am Rückgabetyp und nicht als Änderung an `types.ts` — die Datei
// gehört JOB 3549 und wird von diesem Auftrag nicht angefasst.
import type { ReasonerTaskConfig, ReasonerTaskConfigEingabe } from "./types";

/**
 * Die beiden Schalter der Adminfreigabe — je einzeln, je nur als `true` setzbar.
 *
 * Sie sind ABSICHTLICH nicht ein Schalter: „darf öffentliche KI" und „darf VERTRAULICHES an
 * öffentliche KI" sind zwei Fragen, und die zweite ist die teurere. Ein Test, der den ersten
 * Schalter braucht, bekommt nicht stillschweigend den zweiten dazu.
 */
export interface KiFreigabeSchalter {
  readonly oeffentlicheKi?: true;
  readonly vertraulicheInhalte?: true;
}

/**
 * Die Vorgabe: die GRUNDFREIGABE allein.
 *
 * Nicht exportiert, damit es keinen zweiten Weg gibt, sie zu setzen — wer mehr will, nennt es am
 * Aufrufort und macht damit sichtbar, dass er mehr wollte.
 */
const GRUNDFREIGABE: KiFreigabeSchalter = { oeffentlicheKi: true };

/**
 * Hängt die Freigabe an eine Zuordnungs-EINGABE, ohne sie sonst zu verändern.
 *
 * Für jede Teststelle, die ohnehin `setTaskConfig({ … })` ruft:
 *
 *     await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
 *
 * Der Wert wird KOPIERT, nicht geteilt: zwei Aufbauten dürfen sich nicht über eine gemeinsame
 * Objektreferenz beeinflussen.
 */
export function mitKiFreigabe<T extends ReasonerTaskConfigEingabe>(
  eingabe: T,
  freigabe: KiFreigabeSchalter = GRUNDFREIGABE,
): T & { readonly kiFreigabe: KiFreigabeSchalter } {
  return { ...eingabe, kiFreigabe: { ...freigabe } };
}

/**
 * Setzt die Freigabe auf einem bereits gebauten Reasoner, OHNE seine Zuordnung anzurühren.
 *
 * Für die Teststellen, die gar kein `setTaskConfig` rufen, weil sie gerade die VORGABE messen
 * (z. B. `global: "auto"`): sie sollen die Vorgabe behalten und trotzdem hinausdürfen. Deshalb wird
 * die aktuelle Zuordnung gelesen und unverändert zurückgeschrieben — nur um die Freigabe erweitert.
 *
 * Der Parameter ist strukturell getippt und nicht auf `Reasoner` festgelegt: der Helfer soll keine
 * Modulkante erzeugen, die es ohne ihn nicht gäbe.
 */
export async function erteileKiFreigabe(
  empfaenger: {
    getTaskConfig(): ReasonerTaskConfig;
    setTaskConfig(next: ReasonerTaskConfigEingabe): Promise<ReasonerTaskConfig>;
  },
  freigabe: KiFreigabeSchalter = GRUNDFREIGABE,
): Promise<void> {
  const aktuell = empfaenger.getTaskConfig();
  await empfaenger.setTaskConfig(
    mitKiFreigabe({ global: aktuell.global, perTask: { ...aktuell.perTask } }, freigabe),
  );
}
