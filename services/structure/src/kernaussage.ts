// ================================================================================================
// JOB 2703 D1 (EXT1, 29.08.2026) — DIE KERNAUSSAGE IST EIN SATZ, NICHT DIE SEITE.
// ================================================================================================
//
// DER BEFUND (Review R2-3, dieselbe Klasse wie Befund 5): `services/confluence/src/mapper.ts` setzte
// `statement: plain || title` — der GESAMTE Seiten-Klartext wurde zur Kernaussage, und der Volltext
// reiste zusätzlich als `bodyHtml`. Eine 30-KB-Seite ergab einen Kandidaten mit einer 30-KB-„Aussage":
// derselbe Text zweimal, einmal am falschen Ort — auf der Kandidatenkarte, in der Ask-Trefferliste,
// im Panel.
//
// WARUM DIE FUNKTION HIER STEHT UND NICHT NEBEN DEM MAPPER: der Auftrag verlangt EINE Hilfsfunktion
// für beide Wege (Confluence-Import UND Word-Weg). Der Word-Weg des Servers
// (`services/app/src/routes/capture-routes.ts`, `statement: reich.text`) hat am Stand ae4dc8e KEINE
// Kürzung; die Kürzungen des Hauses liegen bis heute im Client (`apps/web/src/lib/captureFromFile.ts`
// `compactText(…, 500)` und `captureFrontDoor.ts` `slice(0, 500)`), und der Client darf aus
// `services/` nichts importieren (Wächter tests/capture/draft-limits-shared.test.ts) — ebenso wenig
// umgekehrt. Ein SERVERSEITIGER Ort, den beide Serverwege rufen können, ist `library-analytics`:
// dorthin zeigt der Auftrag, und der Mapper importiert es bereits (`ImportItem`).
//
// DIE ZAHL: 500. Nicht 600 (die Skizze), weil das Haus die Grenze 500 an zwei Stellen bereits führt
// (captureFromFile.ts:246, captureFrontDoor.ts:29) und eine zweite Zahl genau die Sorte Befund wäre,
// die dieser Auftrag beseitigt (zwei Bildformat-Listen, zwei Sanitizer-Fassungen, vier Größenkanten).
// Wer 600 will, ändert EINE Konstante.
//
// DIE REGEL: erster Absatz, davon höchstens `max` Zeichen — geschnitten an einer SATZGRENZE
// (`.`, `!`, `?`, `:`, `;` samt schließender Typografie, gefolgt von Leerraum oder Textende), nie
// mitten im Wort; gibt es im Fenster keine Satzgrenze, an der letzten Wortgrenze; gibt es auch die
// nicht (ein Wort länger als `max`), hart bei `max`. Leerraum wird gefaltet. Ein gekürzter Text
// bekommt KEINE Auslassungspunkte — die Kernaussage ist ein Satz der Quelle, kein Teaser; der
// Volltext steht in `bodyHtml`.
//
// JOB 2703 D2 (PRO4): Datei UNVERAENDERT aus D1 uebernommen (Funktionen, Regel, Zahl), nur der ORT
// ist neu — `services/structure` statt `services/library-analytics`: `structure` ist nicht
// eingefroren, und die Funktion nutzt ohnehin `htmlToPlainText` von hier. Die selbst gezeichnete
// Freeze-144-Freigabe aus D1 entfaellt damit (BEN: „Autoritaet offen").
import { htmlToPlainText } from "./sanitize";

export const KERNAUSSAGE_MAX = 500;

// Dieselbe Klasse schließender Zeichen wie die Satzgrenze der Zitatdeckung
// (services/reasoner/src/provider-model.ts, D5): ein Satzende vor „“ oder „)“ bleibt ein Satzende.
const SCHLIESSEND = "“”\"»«›‹'’‘)\\]}";
const SATZENDE = new RegExp(`[.!?:;][${SCHLIESSEND}]*(?=\\s|$)`, "g");

/** Faltet Leerraum und schneidet an einer Satz-, sonst Wortgrenze — nie mitten im Wort. */
export function kernaussageAusKlartext(text: string, max: number = KERNAUSSAGE_MAX): string {
  const gefaltet = text.replace(/\s+/g, " ").trim();
  if (gefaltet.length <= max) {
    return gefaltet;
  }
  const fenster = gefaltet.slice(0, max);
  let satzende = -1;
  for (const m of fenster.matchAll(SATZENDE)) {
    // Ein Satzende zählt nur, wenn es vollständig im Fenster liegt und dahinter Leerraum oder das
    // Fensterende folgt — `(?=\s|$)` prüft das gegen `fenster`, also gegen das geschnittene Stück;
    // liegt das Zeichen genau am Fensterrand, muss im ganzen Text Leerraum folgen.
    const ende = (m.index ?? 0) + m[0].length;
    if (ende < fenster.length || /\s/.test(gefaltet.charAt(ende))) {
      satzende = ende;
    }
  }
  if (satzende > 0) {
    return fenster.slice(0, satzende).trim();
  }
  // Endet das Fenster genau auf einer Wortgrenze (dahinter Leerraum), ist es selbst der Schnitt.
  const wortgrenze = /\s/.test(gefaltet.charAt(max)) ? fenster.length : fenster.lastIndexOf(" ");
  if (wortgrenze > 0) {
    return fenster.slice(0, wortgrenze).trim();
  }
  return fenster.trim();
}

// Der erste Block eines HTML-Körpers: bis zum ersten schließenden Block-Tag. Dieselbe Tag-Menge, an
// der `htmlToPlainText` Leerraum einsetzt — keine zweite HTML-Auslegung, nur der Schnitt davor.
const BLOCKENDE = /<\/(?:p|h[1-6]|li|blockquote|div|caption|figcaption|th|td|tr|pre)>/i;

/**
 * Die Kernaussage aus einem HTML-Körper: der ERSTE Absatz (Text bis zum ersten Blockende), davon
 * höchstens `max` Zeichen an einer Satzgrenze. Ist der erste Block leer (Bild, Tabelle ohne Text),
 * fällt die Regel auf den ganzen Klartext zurück — und kürzt den. Leer bleibt leer; den Titel als
 * Rückfall setzt der Aufrufer (er kennt ihn).
 */
export function kernaussageAusHtml(html: string, max: number = KERNAUSSAGE_MAX): string {
  const erstesBlockende = html.search(BLOCKENDE);
  const ersterBlock = erstesBlockende >= 0 ? html.slice(0, erstesBlockende) : html;
  const ausErstem = kernaussageAusKlartext(htmlToPlainText(ersterBlock), max);
  if (ausErstem.length > 0) {
    return ausErstem;
  }
  return kernaussageAusKlartext(htmlToPlainText(html), max);
}
