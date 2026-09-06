// ================================================================================================
// JOB 3101 · UX-04 — DIE ANSICHT DER AUFGABENLISTE ÜBERLEBT DAS ÖFFNEN EINER AUFGABE.
// ================================================================================================
//
// DER BEFUND: Der Aufgabenfilter lebte in `useState<TaskFilterKey>("all")` (`MyTasks.tsx:202`). Jede
// Aufgabenzeile navigiert per `<Link>` fort; die Seite wird dabei ausgehängt und beim Zurückkommen
// neu gemountet. Damit war BEIDES weg: die getroffene Auswahl und die Stelle, an der der Reviewer
// gerade arbeitete. Er suchte seine Arbeitsstelle nach jeder entschiedenen Aufgabe neu.
//
// Dieses Modul hält die beiden Rechenwege DOM-frei und einzeln prüfbar. `MyTasks.tsx` liest und
// setzt nur — es rechnet hier nichts nach.
//
// ── (1) DER FILTER STEHT IN DER ADRESSE, NICHT IN EINEM ZUSTAND ──────────────────────────────────
//
// Der Weg ist nicht neu erfunden: die Bibliothek hat dieselbe Frage schon entschieden
// (`lib/libraryUrlFilters.ts:1-18`). Ihre Begründung gilt hier wörtlich — „ein Filterzustand in der
// URL ist TEILBAR und überlebt jeden Reload". Ein Browser-Speicher könnte das erste, aber nicht das
// zweite und schon gar nicht den geteilten Link.
//
// Und ihre WERTGRENZE gilt hier ebenso (`libraryUrlFilters.ts:115-138`): ein unbekannter Wert aus
// der Adresszeile fällt WEG, er wird nicht zu einem echten Auswahlzustand. `?art=erfunden` ist ein
// ungültiger Eingang, kein Filter, der auf nichts passt — sonst hätte eine fremde Adresszeile die
// Macht, dem Nutzer eine leere Liste als Bestandsaussage vorzusetzen.
//
// ── (2) DIE LISTENPOSITION HÄNGT AM VERLAUFSEINTRAG, NICHT AM PFAD ───────────────────────────────
//
// `<ScrollRestoration>` von React Router steht in unserem Aufbau NICHT zur Verfügung: die App fährt
// einen BrowserRouter, nicht den Data-Router (ausdrücklich belegt in `app/navHistory.ts:4-5`).
//
// Der Schlüssel trägt deshalb den vom Router gestempelten Verlaufsindex (`navHistory.ts:297-301`)
// ZUSAMMEN mit dem Pfad — nicht den bloßen Pfad. Am Pfad allein trüge der zweite Besuch der Seite
// die Position des ersten: wer die Liste zweimal in derselben Sitzung öffnet, landete beim zweiten
// Mal an der Stelle des ersten Besuchs, an der er nie war.
//
// ── (2b) UND ER TRÄGT DIE KENNUNG DES EINTRAGS · KORREKTURPFLICHT 1 (BEN, RUNDE 2) ───────────────
//
// Pfad + Index REICHEN NICHT. Ein Verlaufsindex ist keine dauerhafte Identität eines Eintrags: er
// wird nach einem Zurück und einem neuen PUSH ERNEUT VERGEBEN. BENs gemessener Ablauf (Runde 2):
//
//     Liste (idx 2) · bei 820 gearbeitet → weg → Browser-Zurück (idx 1) → neu zur Liste (idx 2)
//
// Der letzte Eintrag ist ein FRISCHER Besuch — der vorwärts liegende alte Eintrag wurde vom PUSH
// abgeschnitten. Unter „Pfad + Index" trug er trotzdem denselben Schlüssel und erbte die 820: die
// Seite sprang an eine Stelle, an der dieser Besuch nie war. Genau der Fehler, den (2) für den Pfad
// allein beschreibt, eine Ebene tiefer.
//
// Die Identität ist deshalb die Eintragskennung, die der Router selbst stempelt (`history.state.key`,
// an der Fläche als `useLocation().key`). Sie überlebt Zurück und Vorwärts — ein POP auf denselben
// Eintrag liefert dieselbe Kennung —, aber ein neuer PUSH bekommt eine neue. Der Index bleibt
// trotzdem Teil des Schlüssels: an ihm hängt das VERWERFEN (`verwirfUeberholtePositionen`), das den
// toten Zwilling desselben Verlaufsplatzes wirklich aus dem Speicher nimmt, statt ihn liegen zu
// lassen.
//
// Fehlt Stempel ODER Kennung, gibt es KEINEN Schlüssel (`null`) — dann wird nichts gemerkt und
// nichts angefahren. Das ist dieselbe fail-closed-Haltung wie beim Zurück-Wächter
// (`navHistory.ts:107-112`, Kante 9): ohne belastbaren Eintrag wird nicht geraten, denn ein
// geratener Sprung landet irgendwo.
import { TASK_FILTERS, type TaskFilterKey } from "./taskFilters";

/**
 * Der Parametername in der Adresszeile. Deutsch wie die Zeile UX-04 („Aufgabenart"), und benannt,
 * damit Seite und Test denselben Namen benutzen statt zweier gleichlautender Zeichenketten.
 */
export const TASK_FILTER_PARAM = "art";

/** Der neutrale Zustand: kein Filter. Er steht NIE in der Adresszeile (s. `writeTaskFilterToParams`). */
const NEUTRAL: TaskFilterKey = "all";

/**
 * Die Aufgabenart aus der Adresszeile.
 *
 * Die erlaubte Wertmenge kommt aus `TASK_FILTERS` (`lib/taskFilters.ts:10-17`) — der gemeinsamen
 * Wahrheit der Filterschlüssel. Eine zweite Liste hier wäre genau der zweite Wahrheitsort, gegen den
 * jenes Modul gebaut ist.
 *
 * Fehlend, leer oder unbekannt ⇒ `"all"`. Kein Filter, keine stille Ausblendung.
 */
export function taskFilterFromParams(params: URLSearchParams): TaskFilterKey {
  const roh = params.get(TASK_FILTER_PARAM);
  if (roh === null) {
    return NEUTRAL;
  }
  const treffer = TASK_FILTERS.find((f) => f.key === roh);
  return treffer ? treffer.key : NEUTRAL;
}

/**
 * Die Aufgabenart in die Adresszeile schreiben. Fremde Parameter (`?q=…`) bleiben unberührt — es
 * wird genau EIN Parameter angefasst.
 *
 * `"all"` ENTFERNT den Parameter, statt ihn zu schreiben: der neutrale Zustand ist keine getroffene
 * Wahl und darf im geteilten Link nicht wie eine aussehen. Dieselbe Entscheidung wie beim Segment
 * der Bibliothek (`BibliothekFlaeche.tsx:200-203`: „Der Standard steht NICHT in der Adresse").
 */
export function writeTaskFilterToParams(
  prev: URLSearchParams,
  key: TaskFilterKey,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (key === NEUTRAL) {
    next.delete(TASK_FILTER_PARAM);
  } else {
    next.set(TASK_FILTER_PARAM, key);
  }
  return next;
}

// ── Die Listenposition ───────────────────────────────────────────────────────────────────────────

/**
 * Der EINE Verlaufseintrag, an dem eine Listenposition hängt.
 *
 * `index` ist der Platz im Verlauf (`history.state.idx`), `eintrag` die Kennung DIESES Eintrags
 * (`history.state.key`, an der Fläche `useLocation().key`). Beides zusammen, weil beides eine eigene
 * Aufgabe hat: die Kennung entscheidet, WEM eine Position gehört; der Platz entscheidet, WELCHE
 * Position durch einen neuen Eintrag überholt und damit verworfen wird.
 */
export type Verlaufsort = {
  pfad: string;
  index: number | null;
  eintrag: string | null;
};

/**
 * Der Schlüssel, unter dem eine Listenposition liegt: Pfad + Verlaufsplatz + Eintragskennung.
 *
 * `null` heißt „kein belastbarer Schlüssel" — ohne Stempel ODER ohne Kennung wird weder gemerkt noch
 * angefahren.
 *
 * BEWUSST NICHT EXPORTIERT: die Schlüsselform ist Innenleben dieses Moduls. Nach außen zählt das
 * VERHALTEN (was findet ein Ort wieder, was nicht), und genau daran hängen die Tests — ein Export
 * ohne Aufrufer außerhalb der Tests wäre zudem ein Fall für den Aufrufer-Wächter.
 */
function listenpositionsSchluessel(ort: Verlaufsort): string | null {
  if (ort.index === null || !Number.isFinite(ort.index)) {
    return null;
  }
  if (ort.eintrag === null || ort.eintrag === "") {
    return null;
  }
  return `${ort.pfad}#${ort.index}@${ort.eintrag}`;
}

type Merkposten = { pfad: string; index: number; y: number };

/**
 * Die gemerkten Positionen dieser Sitzung. Bewusst NUR im Arbeitsspeicher: eine Scrollstelle ist
 * kein Zustand, der ein Neuladen überleben soll — nach einem Neuladen sind auch die Verlaufsindizes
 * neu gestempelt, und die Liste kann eine ganz andere sein. Was das Neuladen überleben MUSS, ist der
 * Filter, und der steht in der Adresszeile.
 *
 * Jeder Posten trägt Pfad und Platz mit, damit `verwirfUeberholtePositionen` sie ohne Zerlegen des
 * Schlüssels vergleichen kann (eine Eintragskennung ist eine beliebige Zeichenkette — an ihr wird
 * nicht herumgeschnitten).
 */
const positionen = new Map<string, Merkposten>();

/**
 * Den toten Zwilling DIESES Verlaufsplatzes wegwerfen · Korrekturpflicht 1 (BEN, Runde 2).
 *
 * Steht auf Platz `index` jetzt ein Eintrag mit der Kennung k, dann ist jede früher gemerkte
 * Position, die auf demselben Pfad UND demselben Platz unter einer ANDEREN Kennung liegt, endgültig
 * unerreichbar: zwei Einträge können denselben Verlaufsplatz nicht gleichzeitig besetzen, der alte
 * wurde vom PUSH abgeschnitten. Nur dieser Fall wird gelöscht — über Einträge auf ANDEREN Plätzen
 * wird nichts vermutet, denn die können vorwärts noch erreichbar sein.
 */
export function verwirfUeberholtePositionen(ort: Verlaufsort): void {
  const schluessel = listenpositionsSchluessel(ort);
  if (schluessel === null) {
    return;
  }
  for (const [k, posten] of positionen) {
    if (k !== schluessel && posten.pfad === ort.pfad && posten.index === ort.index) {
      positionen.delete(k);
    }
  }
}

/** Position zum Verlaufseintrag merken. Ohne Schlüssel oder mit unsinnigem Wert: nichts merken. */
export function merkeListenposition(ort: Verlaufsort, y: number): void {
  const schluessel = listenpositionsSchluessel(ort);
  if (schluessel === null || ort.index === null || !Number.isFinite(y) || y < 0) {
    return;
  }
  positionen.set(schluessel, { pfad: ort.pfad, index: ort.index, y });
}

/** Die gemerkte Position — `null`, wenn zu diesem Verlaufseintrag nichts vorliegt. */
export function leseListenposition(ort: Verlaufsort): number | null {
  const schluessel = listenpositionsSchluessel(ort);
  if (schluessel === null) {
    return null;
  }
  return positionen.get(schluessel)?.y ?? null;
}

/**
 * Die anzufahrende Position, begrenzt auf das aktuell MACHBARE.
 *
 * Eine Aufgabe kann inzwischen erledigt sein; die Liste ist dann kürzer, und die gemerkte Stelle
 * gibt es nicht mehr. Statt ins Leere zu springen wird auf das Ende des tatsächlich Scrollbaren
 * begrenzt. Auf einen späteren, längeren Stand wird ausdrücklich NICHT gewartet — das wäre eine
 * Wette auf Daten, die noch gar nicht da sind.
 */
export function begrenzteListenposition(gemerkt: number | null, machbar: number): number | null {
  if (gemerkt === null) {
    return null;
  }
  const grenze = Number.isFinite(machbar) && machbar > 0 ? machbar : 0;
  return Math.max(0, Math.min(gemerkt, grenze));
}
