// ==================================================================================================
// JOB 3063 · H4 — DER FRAGEN-KNOPF DER LESEFLÄCHE: EINE ADRESSE, OHNE ABZWEIG ÜBER DEN ZUSTAND.
// ==================================================================================================
//
// DER BEFUND (Codex an Runde 4): die Lesefläche hat ihre verbindliche Aktion weiter aus
// `lib/libraryMaturity.ts::libraryUseCta` gezogen. Diese Regel verzweigt über die REIFE: nur ein
// validierter Eintrag bekam „Fragen" (→ `/fragen?q=…`), alles andere „Prüfen" (→ `/validierung`).
// Der Auftrag verlangt das Gegenteil (§5.3/§5a): auf JEDEM gewählten Eintrag steht „Fragen", und
// der Knopf führt nach `/fragen` MIT dem Herkunftsbezug auf genau diesen Eintrag (`ko=<id>` — was
// dieser Marker leistet und was nicht, steht unten bei `FRAGEN_KO_PARAM`).
//
// DESHALB IST DIESE FUNKTION OHNE STATUS-PARAMETER GEBAUT, und das ist die eigentliche Zusage: sie
// kann gar nicht über den Zustand verzweigen, weil sie ihn nicht kennt. Was ein Eintrag ist
// (validiert · offen · in Prüfung), sagt die Pille daneben — nicht der Knopf.
//
// WAS AUSDRÜCKLICH BLEIBT: die Vertraulichkeitskante aus WP-POLISH-CLOSE (bens Punkt 1). Für alles,
// was nicht sicher als nicht-vertraulich bekannt ist, wird die Frage nur VORBELEGT (`vertraulich=1`,
// kein `ask=1`) — der Mensch sendet bewusst selbst. Das ist keine Verzweigung über die Reife,
// sondern über die Vertraulichkeit, und sie war schon vor diesem Umbau die Regel des Hauses.
import { askAnswerHref, askConfidentialQuestionHref } from "../../lib/askQuestion";
import { isKnownNonConfidential } from "../../lib/confidentiality";

// ==================================================================================================
// WAS `ko` IST — UND WAS ES NICHT IST (Runde 6, bens Prüflücke 6 zur Runde 5).
// ==================================================================================================
//
// `ko` ist ein HERKUNFTSMARKER: er sagt, WOHER die Frage kommt — welcher Eintrag offen war, als
// jemand „Fragen" drückte. Er schränkt die Antwort NICHT ein. Die Ask-Seite liest aus der Adresse
// ausschliesslich `q`, `ask` und `vertraulich` (`Ask.tsx:137-138`, `lib/askQuestion.ts`), und der
// Anfragevertrag, der wirklich hinausgeht, ist `endpoints.ask.ask(frage, sprache)`
// (`Ask.tsx:307-308`) — die Kennung reist dort in KEINEM Argument mit.
//
// HIER STAND VORHER „der Parameter, der die Frage an genau diesen Eintrag BINDET". Das war eine
// Zusage über eine Wirkung, die es nicht gibt; ehrlich ist der Marker, nicht die Bindung. Gemessen
// wird die heutige Wahrheit am ganzen Weg (Klick in der Bibliothek → echte Ask-Seite → Anfrage) in
// `tests/app/h4-ko-marker-vertrag-mounted.test.tsx`; jener Fall wird rot, sobald jemand die
// stärkere Aussage behauptet, ohne sie zu bauen.
//
// EINE ECHTE BINDUNG wäre eine Änderung an `pages/Ask.tsx` und an seinem Anfragevertrag. Diese
// Datei liegt ausserhalb der Zielpfade dieses Auftrags (§4); die Bindung gehört deshalb in einen
// eigenen Auftrag und nicht als Nebenwirkung in eine Umbau-Runde der Bibliothek.
export const FRAGEN_KO_PARAM = "ko";

/**
 * Die Adresse hinter „Fragen": `/fragen?q=<Vorbelegung>&(ask|vertraulich)=1&ko=<id>`.
 *
 * `vorbelegung` ist der aktuelle Suchtext der Bibliothek; ohne Suche steht dort der Titel des
 * gewählten Eintrags (die abgelöste Karte „Antwort statt nur Treffer?" hat genau das getan — eine
 * leere Frage wäre hier ein toter Knopf, kein ehrlicherer).
 */
export function fragenHref(koId: string, vorbelegung: string, confidentiality: unknown): string {
  const frage = vorbelegung.trim();
  const basis = isKnownNonConfidential(confidentiality)
    ? askAnswerHref(frage)
    : askConfidentialQuestionHref(frage);
  return `${basis}&${FRAGEN_KO_PARAM}=${encodeURIComponent(koId)}`;
}
