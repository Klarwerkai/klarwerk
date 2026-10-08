// Reine, DOM-freie Selektoren für den Ask-Response-Wrapper (SCRUM-138).
// Backend `POST /api/ask` liefert `{ result: AnswerResult, gap: Gap | null }`.
import type { AbsatzBeleg, AnswerResult, AskResponse, Gap } from "../api/types";

// ================================================================================================
// Aufnahme 20260922 · antwort-quellenanzeige (R-0310, Ben zu 6cc581b4) — NUR BELEGTE ABSÄTZE.
// ================================================================================================
//
// „Jeder sachliche Absatz einer Antwort endet mit einer kleinen nummerierten Quellenmarke; ein
// Absatz ohne Beleg wird gar nicht erst ausgegeben." Der Server liefert die ausdrückliche Zuordnung
// `absaetze` (services/app/src/absatz-belege.ts). Sie wird HIER angewandt, an der einen Stelle, an
// der die Antwort in die Flächen kommt: Fragenseite und Mobilseite und damit jeder ihrer
// Ausgabewege (Anzeige, Kopieren, Export, Druck, Vorlesen, Arbeitsstand) lesen denselben Stand.
//   · Ausgegeben werden nur Absätze, die mindestens eine TRAGENDE Quelle (`citedSources`) belegt.
//   · Bei mehreren Absätzen trägt jeder die Marke `[n]` seiner Quellen (n = Stelle in `sources`,
//     dieselbe Nummer wie der Chip), sofern sie nicht schon im Absatz steht. Ein einzelner Absatz
//     bleibt wörtlich — seine Marken setzt die Fläche wie bisher an das Textende.
//   · Ist kein Absatz belegt, gibt es keine Antwort: die Wissenslücke.
// Ohne das Feld (älterer Server, Lücke) bleibt die Antwort unverändert.
const MARKE = /\[([0-9\s,]+)\]/g;

function markenIn(text: string): Set<number> {
  const nummern = new Set<number>();
  for (const m of text.matchAll(MARKE)) {
    for (const teil of (m[1] ?? "").split(",")) {
      const n = Number.parseInt(teil.trim(), 10);
      if (Number.isInteger(n)) nummern.add(n);
    }
  }
  return nummern;
}

function belegteAntwort(result: AnswerResult, absaetze: AbsatzBeleg[] | undefined): AnswerResult {
  if (!result.answered || !Array.isArray(absaetze)) {
    return result;
  }
  const tragend = new Set((result.citedSources ?? []).filter((id) => result.sources.includes(id)));
  const belegt = absaetze
    .map((a) => ({ text: a.text.trim(), quellen: a.quellen.filter((id) => tragend.has(id)) }))
    .filter((a) => a.text !== "" && a.quellen.length > 0);
  if (belegt.length === 0) {
    return { ...result, answered: false, answer: null, knowledgeClass: "unbekannt" };
  }
  const text =
    belegt.length === 1
      ? (belegt[0]?.text ?? "")
      : belegt
          .map((a) => {
            const da = markenIn(a.text);
            const fehlen = a.quellen
              .map((id) => result.sources.indexOf(id) + 1)
              .filter((n) => n > 0 && !da.has(n));
            return fehlen.length > 0 ? `${a.text} [${fehlen.join(", ")}]` : a.text;
          })
          .join("\n\n");
  return { ...result, answer: text };
}

export function selectAnswer(response: AskResponse): AnswerResult {
  return belegteAntwort(response.result, response.absaetze);
}

export function selectGap(response: AskResponse): Gap | null {
  return response.gap;
}
