// ================================================================================================
// Aufnahme 20260922 · antwort-quellenanzeige (R-0310) — DIE AUSDRÜCKLICHE ABSATZ-BELEG-ZUORDNUNG.
// ================================================================================================
//
// „Jeder sachliche Absatz einer Antwort endet mit einer kleinen nummerierten Quellenmarke; ein
// Absatz ohne Beleg wird gar nicht erst ausgegeben." Die Auflage aus JOB 2603 (BEN ROT D6): die
// Reihenfolge im Datensatz reicht als Zuordnung NICHT — gefordert ist ein ausdrückliches Feld je
// Absatz. Dieses Feld ist `absaetze` im Antwortkörper von `/api/ask` (neben `result`):
//
//   absaetze: Array<{ text: string; quellen: string[] }>
//
// `quellen` sind Kennungen aus `result.citedSources` (die TRAGENDEN Quellen). Ein Absatz trägt eine
// Quelle NUR aus einem dieser beiden ausdrücklichen Gründen — nie aus Lage oder Nachbarschaft:
//   1. MARKE: der Absatz selbst trägt die Fußnotenmarke `[n]` (n = Stelle in `result.sources`,
//      dieselbe Lesart wie `citedSourceIds` im Reasoner) und die Quelle ist tragend.
//   2. WÖRTLICH: der Absatz steht wörtlich in der Aussage einer tragenden Quelle
//      (`steps[].snippet`, Leerraum zusammengefasst). So trägt der deterministische Weg — die
//      Antwort IST dort die Aussage der einen tragenden Quelle (provider.ts `answer`).
// Ein Absatz ohne beides hat `quellen: []` — unbelegt. Die Fläche gibt ihn NICHT aus.
//
// Das Feld fehlt, wenn es nichts zuzuordnen gibt (keine beantwortete Frage). Der Antworttext in
// `result.answer` bleibt unverändert: die Zuordnung ist eine zusätzliche Aussage, keine Umschrift.

export interface AbsatzBeleg {
  text: string;
  quellen: string[];
}

export interface AbsatzQuelle {
  answered: boolean;
  answer: string | null;
  sources: readonly string[];
  citedSources?: readonly string[] | undefined;
  steps?: ReadonlyArray<{ sourceId: string | null; snippet: string | null }> | undefined;
}

const MARKE = /\[([0-9\s,]+)\]/g;

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Die Absätze einer Antwort — getrennt an Leerzeilen, leere fallen weg. */
function absaetzeVon(antwort: string): string[] {
  return antwort
    .split(/\n[ \t]*\n/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/** Die tragenden Kennungen, die ein Absatz über seine Marken `[n]` nennt — in Lesereihenfolge. */
function markenQuellen(absatz: string, sources: readonly string[], tragend: ReadonlySet<string>) {
  const ids: string[] = [];
  for (const m of absatz.matchAll(MARKE)) {
    for (const teil of (m[1] ?? "").split(",")) {
      const n = Number.parseInt(teil.trim(), 10);
      const id = Number.isInteger(n) && n >= 1 ? sources[n - 1] : undefined;
      if (id !== undefined && tragend.has(id) && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

export function absatzBelege(result: AbsatzQuelle): AbsatzBeleg[] | undefined {
  if (!result.answered || typeof result.answer !== "string" || result.answer.trim() === "") {
    return undefined;
  }
  const tragend = new Set((result.citedSources ?? []).filter((id) => result.sources.includes(id)));
  const aussagen = (result.steps ?? [])
    .filter(
      (s): s is { sourceId: string; snippet: string } =>
        typeof s.sourceId === "string" &&
        tragend.has(s.sourceId) &&
        typeof s.snippet === "string" &&
        s.snippet.trim() !== "",
    )
    .map((s) => ({ id: s.sourceId, text: normal(s.snippet) }));
  return absaetzeVon(result.answer).map((absatz) => {
    const ausMarken = markenQuellen(absatz, result.sources, tragend);
    if (ausMarken.length > 0) {
      return { text: absatz, quellen: ausMarken };
    }
    const wortlaut = normal(absatz);
    const woertlich = aussagen.filter((a) => a.text.includes(wortlaut)).map((a) => a.id);
    return { text: absatz, quellen: [...new Set(woertlich)] };
  });
}
