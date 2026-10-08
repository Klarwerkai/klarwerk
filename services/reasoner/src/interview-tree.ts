import type {
  InterviewAnswerRef,
  InterviewNodeId,
  InterviewOptions,
  InterviewResearchPoint,
  InterviewResearchSource,
  InterviewResult,
  ReasonerLocale,
  StructureResult,
} from "./types";

// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW — DER FRAGEBAUM.
// ================================================================================================
//
// DER BEFUND (R-0113, Codex-Antwort 29.08. zu E1): „kein Messkriterium; nötig: Fragebäume,
// Restlücken-Score, menschliche Abschlussbestätigung". Das bisherige Interview stellte vier feste
// Fragen und beendete sich selbst, sobald Kernaussage, Bedingung und Maßnahme dastanden.
//
// WAS HIER STEHT:
//   · ein Baum aus Knoten mit Gewicht. Pflicht sind Kernaussage, Bedingung, Maßnahme; danach bohrt
//     er nach Schwellen und Ausnahmen (R-0043) und nach Warum, verworfenen Alternativen,
//     Geltungsbereich, Risiken und der Herkunft des Wissens (Argus-Recherche).
//   · eine Verzweigung: nennt die Bedingung schon einen Schwellenwert (`nenntSchwelle`), ist die
//     Schwelle damit belegt und wird nicht noch einmal erfragt.
//   · ein Restlückenwert: der Anteil des Gewichts, der noch nicht mit einer Antwort belegt ist.
//   · `sufficient` sagt nur, dass der Mensch abschließen DARF. Abgeschlossen wird nie von selbst —
//     die Bestätigung gibt der Mensch in der Oberfläche.
//
// STATELESS WIE BISHER: die Antwortliste ist der ganze Zustand. Antwort i gehört zum i-ten Knoten
// des Pfads, der sich aus den vorherigen Antworten ergibt. Eine LEERE Antwort heißt „übersprungen"
// — der Knoten zählt dann weiter als Lücke.
//
// NICHTS WIRD ERFUNDEN: Entwurf, Spiegel und Vertiefung sind wörtlich die Antworten des Menschen.

interface TreeNode {
  id: InterviewNodeId;
  weight: number;
  required: boolean;
  question: Record<ReasonerLocale, string>;
  // Gilt der Knoten nach den bisher gegebenen Antworten? false = durch eine frühere Antwort belegt.
  applies?: (given: ReadonlyMap<InterviewNodeId, string>) => boolean;
}

// BENS BEFUND (nacharbeit-4): hier stand `/\d/` — jede Ziffer galt als Schwelle. „Bei Anlage 2 im
// Handbetrieb" nennt aber keinen Grenzwert; die Schwellenfrage entfiel trotzdem und der
// Restlückenwert fiel zu niedrig aus. Als Schwelle zählt jetzt nur, was eine ist:
//   · ein Vergleich vor einer Zahl („ab 6", „über 80", „< 5", „mindestens 3", „above 10") oder
//   · eine Zahl mit Messeinheit („6 bar", „5 °C", „30 min", „80 %", „1500 U/min").
// Anlagen-, Linien- und Teilekennungen („Anlage 2", „Linie 4", „P-12") sind keine Schwelle.
//
// BENS BEFUND (nacharbeit-6): „Bei Anlage 2A im Handbetrieb" traf noch Zahl + Einheit „a" (Ampere).
// Daraus folgt die Regel „im Zweifel weiter fragen": Einbuchstabige Einheiten (a, v, w, s, h, m, n,
// g, t, l, k) sind von Kennungsendungen nicht zu unterscheiden („2A", „3V", „4 S") — sie zählen
// allein NIE als Schwelle, nur zusammen mit einem Vergleichswort („ab 16 A" trifft über VERGLEICH).
// Und eine Zahl, die an Buchstaben oder Bindestrich hängt („P2bar", „KT-3 mm"), ist Teil einer
// Kennung. Bleibt es unklar, bleibt die Schwellenfrage — und die Schwelle eine offene Lücke.
const VERGLEICH =
  "(?:ab|über|ueber|unter|bis|oberhalb|unterhalb|mehr als|weniger als|größer als|groesser als|kleiner als|mindestens|höchstens|hoechstens|maximal|minimal|max\\.?|min\\.?|above|below|over|under|at least|at most|more than|less than|greater than|exceeds?|vanaf|boven|onder|meer dan|minder dan|minimaal|maximaal|tot)";
const EINHEIT =
  "(?:mbar|bar|psi|kpa|mpa|°\\s?[cf]|°|grad|kelvin|%|‰|ppm|µm|mm|cm|km|mg|kg|ml|m³|m3|minuten|min|sekunden|sek|stunden|std|tage|kv|mv|ka|ma|kw|mw|khz|hz|nm|kn|u\\/min|rpm|db|lux)";
const SCHWELLE_VERGLEICH = new RegExp(`(?:^|[^a-zäöüß])${VERGLEICH}\\s*\\d`, "i");
const SCHWELLE_SYMBOL = /[<>≤≥]=?\s*\d/;
const SCHWELLE_EINHEIT = new RegExp(
  `(?<![a-zäöüß0-9\\-])\\d+(?:[.,]\\d+)?\\s*${EINHEIT}(?![a-zäöüß0-9])`,
  "i",
);

/** Nennt der Text einen echten Schwellenwert (nicht nur irgendeine Ziffer)? */
export function nenntSchwelle(text: string | undefined): boolean {
  const t = text ?? "";
  return SCHWELLE_VERGLEICH.test(t) || SCHWELLE_SYMBOL.test(t) || SCHWELLE_EINHEIT.test(t);
}

const KERN: TreeNode = {
  id: "kern",
  weight: 3,
  required: true,
  question: {
    de: "Worum geht es? Formuliere die Kernaussage in einem Satz.",
    en: "What is this about? State the core message in one sentence.",
    nl: "Waar gaat het over? Formuleer de kernboodschap in één zin.",
  },
};

const BEDINGUNG: TreeNode = {
  id: "bedingung",
  weight: 2,
  required: true,
  question: {
    de: "Unter welchen Bedingungen oder ab wann gilt das?",
    en: "Under what conditions or from when does this apply?",
    nl: "Onder welke voorwaarden of vanaf wanneer geldt dat?",
  },
};

const MASSNAHME: TreeNode = {
  id: "massnahme",
  weight: 2,
  required: true,
  question: {
    de: "Welche Maßnahme oder Konsequenz folgt daraus?",
    en: "What action or consequence follows from it?",
    nl: "Welke maatregel of consequentie volgt daaruit?",
  },
};

const TREE: readonly TreeNode[] = [
  KERN,
  BEDINGUNG,
  MASSNAHME,
  {
    id: "schwelle",
    weight: 1,
    required: false,
    question: {
      de: "Gibt es einen Grenz- oder Schwellenwert, ab dem du anders handelst? Woran erkennst du ihn?",
      en: "Is there a limit or threshold at which you act differently? How do you notice it?",
      nl: "Is er een grens- of drempelwaarde waarbij je anders handelt? Waaraan herken je die?",
    },
    applies: (given) => !nenntSchwelle(given.get("bedingung")),
  },
  {
    id: "ausnahme",
    weight: 1,
    required: false,
    question: {
      de: "Wann gilt das ausdrücklich nicht? Welche Ausnahmen kennst du?",
      en: "When does this explicitly not apply? Which exceptions do you know?",
      nl: "Wanneer geldt dit uitdrukkelijk niet? Welke uitzonderingen ken je?",
    },
  },
  {
    id: "warum",
    weight: 1,
    required: false,
    question: {
      de: "Warum ist das so? Was passiert, wenn man es anders macht?",
      en: "Why is that so? What happens if it is done differently?",
      nl: "Waarom is dat zo? Wat gebeurt er als je het anders doet?",
    },
  },
  {
    id: "alternativen",
    weight: 1,
    required: false,
    question: {
      de: "Welche anderen Wege wurden versucht oder verworfen – und warum?",
      en: "Which other approaches were tried or rejected – and why?",
      nl: "Welke andere manieren zijn geprobeerd of verworpen – en waarom?",
    },
  },
  {
    id: "geltung",
    weight: 1,
    required: false,
    question: {
      de: "Wofür gilt das genau – welche Anlage, welcher Bereich, welche Rolle?",
      en: "What exactly does this apply to – which equipment, area or role?",
      nl: "Waarvoor geldt dit precies – welke installatie, welk gebied, welke rol?",
    },
  },
  {
    id: "risiko",
    weight: 1,
    required: false,
    question: {
      de: "Welches Risiko bleibt – und was droht, wenn man es vergisst?",
      en: "Which risk remains – and what happens if it is forgotten?",
      nl: "Welk risico blijft er – en wat dreigt er als je het vergeet?",
    },
  },
  {
    id: "herkunft",
    weight: 1,
    required: false,
    question: {
      de: "Woher weißt du das – eigene Erfahrung, seit wann, in welcher Rolle?",
      en: "How do you know this – own experience, since when, in which role?",
      nl: "Hoe weet je dit – eigen ervaring, sinds wanneer, in welke rol?",
    },
  },
  {
    id: "stichworte",
    weight: 1,
    required: false,
    question: {
      de: "Welche Stichworte helfen beim Wiederfinden? (kommagetrennt)",
      en: "Which keywords help to find it again? (comma-separated)",
      nl: "Welke trefwoorden helpen bij het terugvinden? (komma-gescheiden)",
    },
  },
];

// R-0091: das Lücken-Interview — drei Fragen, ein Entwurf. Das Thema steht fest; gefragt wird nur
// nach dem, was ein prüfbarer Entwurf mindestens braucht.
const GAP_TREE: readonly TreeNode[] = [KERN, BEDINGUNG, MASSNAHME];

export const MAX_INTERVIEW_TOPIC_LENGTH = 200;

/** Das Thema, so wie es in Frage und Prompt eingeht: getrimmt, eine Zeile, begrenzt. */
export function normalizeInterviewTopic(topic: string | undefined): string {
  return (topic ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_INTERVIEW_TOPIC_LENGTH);
}

// ================================================================================================
// R-0088 — DIE THEMENBEZOGENE RECHERCHE (Bens Befund nacharbeit-4: „die gezielte Fachrecherche fehlt").
// ================================================================================================
//
// Mit gültigem KI-Schlüssel wertet das Modell die zum Fachthema (Lücken-Thema, sonst die
// Kernaussage) abgerufenen Quellen zu höchstens drei Prüfpunkten aus: Grenzwerte, Ausnahmen, Ursachen,
// verworfene Wege, Geltung, Risiken — jeweils einem Baumknoten zugeordnet. Die Rückfrage zu diesem
// Knoten hakt dann gezielt daran nach. Die Punkte sind UNGEPRÜFT: sie stehen sichtbar als solche da
// und gehen nie in den Entwurf (der besteht weiter nur aus den Antworten des Menschen).
// Die reinen Teile (Prüfen, Kappen, Antwort lesen) stehen hier, der Modellaufruf im ModelProvider.

export const MAX_INTERVIEW_RESEARCH_POINTS = 3;
export const MAX_INTERVIEW_RESEARCH_HINT_LENGTH = 200;
const RESEARCH_NODES: ReadonlySet<InterviewNodeId> = new Set<InterviewNodeId>([
  "schwelle",
  "ausnahme",
  "warum",
  "alternativen",
  "geltung",
  "risiko",
]);

// BENS BEFUND (nacharbeit-6): „Der Prompt ‚Du recherchierst' ersetzt keinen Recherchezugriff."
// Seither ist die Recherche QUELLENGEBUNDEN: die Route ruft zum Thema echte Quellen ab (die
// vorhandene Quellensuche `services/external-search`, mit Admin-Stufe und nie für vertrauliche
// Inhalte), das Modell leitet Prüfpunkte AUSSCHLIESSLICH aus diesen Quellen ab, und jeder Punkt
// trägt seine Quelle. Ein Punkt ohne gültige Quelle wird verworfen; ohne Quellen gibt es keine
// Recherche — kein Ersatz aus bloßem Modellwissen.
export const MAX_INTERVIEW_RESEARCH_SOURCES = 3;
const MAX_SOURCE_TITLE_LENGTH = 200;
const MAX_SOURCE_URL_LENGTH = 500;
const MAX_SOURCE_SNIPPET_LENGTH = 400;

function knapp(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function quelleAus(value: unknown): InterviewResearchSource | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const title = knapp(raw.title, MAX_SOURCE_TITLE_LENGTH);
  const url = knapp(raw.url, MAX_SOURCE_URL_LENGTH);
  // Nur echte Webadressen — keine javascript:/data:-Verweise in die Oberfläche.
  if (!title || !/^https?:\/\//i.test(url)) {
    return null;
  }
  const snippet = knapp(raw.snippet, MAX_SOURCE_SNIPPET_LENGTH);
  return { title, url, ...(snippet ? { snippet } : {}) };
}

/** Abgerufene Quellen prüfen und kappen (Titel, http(s)-Adresse, Auszug). */
export function normalizeInterviewSources(value: unknown): InterviewResearchSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sources: InterviewResearchSource[] = [];
  for (const raw of value) {
    const source = quelleAus(raw);
    if (source) {
      sources.push(source);
    }
    if (sources.length >= MAX_INTERVIEW_RESEARCH_SOURCES) {
      break;
    }
  }
  return sources;
}

/**
 * Recherchepunkte prüfen und kappen. Jeder Punkt braucht eine Quelle: entweder als Nummer in die
 * abgerufenen `sources` (Modellantwort, „quelle": 1 …) oder als mitgereichtes Quellenobjekt (vom
 * Client zurückgereichte Recherche eines früheren Turns). Ohne gültige Quelle fällt er weg.
 */
export function normalizeInterviewResearch(
  value: unknown,
  sources: readonly InterviewResearchSource[] = [],
): InterviewResearchPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const points: InterviewResearchPoint[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const entry = raw as Record<string, unknown>;
    const node = entry.node ?? entry.knoten;
    const hint = knapp(entry.hint ?? entry.hinweis, MAX_INTERVIEW_RESEARCH_HINT_LENGTH);
    if (typeof node !== "string" || !RESEARCH_NODES.has(node as InterviewNodeId) || !hint) {
      continue;
    }
    const nummer = entry.quelle ?? entry.sourceIndex;
    const source =
      typeof nummer === "number" && Number.isInteger(nummer)
        ? (sources[nummer - 1] ?? null)
        : quelleAus(entry.source);
    if (!source) {
      continue;
    }
    points.push({ node: node as InterviewNodeId, hint, source });
    if (points.length >= MAX_INTERVIEW_RESEARCH_POINTS) {
      break;
    }
  }
  return points;
}

/** Die Modellantwort der Recherche lesen: das erste JSON-Objekt mit `punkte`; sonst nichts. */
export function parseInterviewResearch(
  raw: string,
  sources: readonly InterviewResearchSource[],
): InterviewResearchPoint[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return normalizeInterviewResearch(parsed.punkte ?? parsed.points, sources);
  } catch {
    return [];
  }
}

/** Worüber recherchiert wird: das Lücken-Thema, sonst die Kernaussage; leer = noch nichts. */
export function interviewResearchSubject(
  answers: readonly string[],
  options: InterviewOptions,
): string {
  return normalizeInterviewTopic(options.topic) || normalizeInterviewTopic(answers[0]);
}

function topicQuestion(topic: string, locale: ReasonerLocale): string {
  if (locale === "en") {
    return `Topic: “${topic}”. What do you know about it from experience? State the core message in one sentence.`;
  }
  if (locale === "nl") {
    return `Onderwerp: „${topic}”. Wat weet je er uit ervaring over? Formuleer de kernboodschap in één zin.`;
  }
  return `Thema: „${topic}“. Was weißt du aus Erfahrung darüber? Formuliere die Kernaussage in einem Satz.`;
}

interface Walk {
  given: Map<InterviewNodeId, string>;
  visited: InterviewAnswerRef[];
  covered: Set<InterviewNodeId>;
  next: TreeNode | null;
}

function walk(tree: readonly TreeNode[], answers: readonly string[]): Walk {
  const given = new Map<InterviewNodeId, string>();
  const visited: InterviewAnswerRef[] = [];
  const covered = new Set<InterviewNodeId>();
  let i = 0;
  for (const node of tree) {
    if (node.applies && !node.applies(given)) {
      covered.add(node.id);
      continue;
    }
    if (i >= answers.length) {
      return { given, visited, covered, next: node };
    }
    const text = (answers[i] ?? "").trim();
    i += 1;
    visited.push({ node: node.id, text });
    if (text.length > 0) {
      given.set(node.id, text);
    }
  }
  return { given, visited, covered, next: null };
}

/**
 * Ein Turn im Fragebaum. Rein deterministisch; ein Modell darf danach nur die Frage umformulieren.
 */
export function treeInterview(
  answers: readonly string[],
  demo: boolean,
  locale: ReasonerLocale = "de",
  options: InterviewOptions = {},
): InterviewResult {
  const topic = normalizeInterviewTopic(options.topic);
  const tree = topic ? GAP_TREE : TREE;
  const { given, visited, covered, next } = walk(tree, answers);

  const total = tree.reduce((sum, n) => sum + n.weight, 0);
  const open = tree.filter((n) => !covered.has(n.id) && !given.has(n.id));
  const openWeight = open.reduce((sum, n) => sum + n.weight, 0);
  const requiredDone = tree.filter((n) => n.required).every((n) => given.has(n.id));
  const depthAnswered = [...given.keys()].some(
    (id) => !tree.find((n) => n.id === id)?.required && id !== "stichworte",
  );
  // FR-CAP-02 („Abschluss bei ausreichendem Inhalt", ~4–5 Antworten): die drei Pflichtknoten und
  // mindestens eine Vertiefung. Im Lücken-Interview reichen die drei Fragen (R-0091).
  const sufficient = requiredDone && (topic.length > 0 || depthAnswered);

  const lastGiven = [...visited].reverse().find((v) => v.text.length > 0) ?? null;
  const question =
    next === null
      ? null
      : next.id === "kern" && topic
        ? topicQuestion(topic, locale)
        : next.question[locale];

  const tags = (given.get("stichworte") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const condition = given.get("bedingung");
  const measure = given.get("massnahme");
  const draft: StructureResult = {
    title: given.get("kern") ?? "",
    statement: given.get("kern") ?? "",
    conditions: condition ? [condition] : [],
    measures: measure ? [measure] : [],
    tags,
    confidence: 0,
    demo,
  };

  return {
    question,
    done: next === null,
    draft,
    demo,
    node: next?.id ?? null,
    sufficient,
    gaps: {
      value: total === 0 ? 0 : Math.round((openWeight / total) * 100),
      open: open.map((n) => n.id),
    },
    mirror: lastGiven,
    depth: visited.filter(
      (v) =>
        v.text.length > 0 &&
        v.node !== "stichworte" &&
        !tree.find((n) => n.id === v.node)?.required,
    ),
  };
}
