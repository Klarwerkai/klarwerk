// Klara v1 (Pedi 05.07.: „Klammer 2.0 — go wild"): EINE konsolidierte, DOM-freie Registry über
// alle Hilfe-Quellen der App — Seiten-Erklärungen, Kurzhilfen des Erfassen-Wegs (chelp.*),
// Kurzhilfen des Prüfbereichs (vhelp.*) und die Hilfeseiten-Kapitel (help.*). Klara antwortet
// AUSSCHLIESSLICH hieraus (Ehrlichkeits-Prinzip: nichts erfinden — was fehlt, ist eine sichtbare
// Hilfe-Lücke). Suche und Auflösung sind bewusst testbar ohne React/DOM.
import { CAPTURE_HELP_TOPICS } from "./captureHelp";
import { FAQ_CONTENT } from "./faqContent";
import { HELP_TOPICS } from "./helpTopics";
import { REVIEW_HELP_ROUTE, REVIEW_HELP_TOPICS } from "./reviewHelp";

export type KlaraKind = "page" | "field" | "topic" | "faq" | "artikel";

export interface KlaraEntry {
  // Stabile ID mit Quell-Präfix: page:<id> | cap:<id> | rev:<id> | topic:<id>.
  id: string;
  kind: KlaraKind;
  titleKey: string;
  bodyKey: string;
  // Echte App-Route, auf der das Thema lebt (für den Absprung aus dem Panel).
  route: string;
}

export interface ResolvedKlaraEntry extends KlaraEntry {
  title: string;
  body: string;
}

// Seiten-Erklärungen („Du bist hier"): Route → nav-Label + Klara-Text.
interface KlaraPage {
  id: string;
  route: string;
  titleKey: string;
  bodyKey: string;
}

export const KLARA_PAGES: readonly KlaraPage[] = [
  { id: "start", route: "/start", titleKey: "nav.start", bodyKey: "klara.page.start" },
  { id: "tasks", route: "/aufgaben", titleKey: "nav.tasks", bodyKey: "klara.page.tasks" },
  { id: "capture", route: "/erfassen", titleKey: "nav.capture", bodyKey: "klara.page.capture" },
  { id: "ask", route: "/fragen", titleKey: "nav.ask", bodyKey: "klara.page.ask" },
  { id: "library", route: "/bibliothek", titleKey: "nav.library", bodyKey: "klara.page.library" },
  { id: "external", route: "/extern", titleKey: "nav.external", bodyKey: "klara.page.external" },
  {
    id: "validation",
    route: "/validierung",
    titleKey: "nav.validation",
    bodyKey: "klara.page.validation",
  },
  {
    id: "conflicts",
    route: "/konflikte",
    titleKey: "nav.conflicts",
    bodyKey: "klara.page.conflicts",
  },
  {
    id: "duplicates",
    route: "/duplikate",
    titleKey: "nav.duplicates",
    bodyKey: "klara.page.duplicates",
  },
  { id: "risk", route: "/risiko", titleKey: "nav.risk", bodyKey: "klara.page.risk" },
  {
    id: "lifecycle",
    route: "/lebenszyklus",
    titleKey: "nav.lifecycle",
    bodyKey: "klara.page.lifecycle",
  },
  {
    id: "analytics",
    route: "/analytics",
    titleKey: "nav.analytics",
    bodyKey: "klara.page.analytics",
  },
  { id: "admin", route: "/admin", titleKey: "nav.admin", bodyKey: "klara.page.admin" },
  // R-1030: die vier Bereiche der zweiten Stufe — Seitenerklärung je Bereich, alle vier gleich.
  // Die Texte stehen im Textmodul `texte/zweitestufe.ts` (neue Texte gehören nicht mehr in die
  // Grundwörterbücher).
  {
    id: "output",
    route: "/output",
    titleKey: "nav.output",
    bodyKey: "zweitestufe.klara.output",
  },
  {
    id: "import",
    route: "/import",
    titleKey: "nav.import",
    bodyKey: "zweitestufe.klara.import",
  },
  { id: "graph", route: "/graph", titleKey: "nav.graph", bodyKey: "zweitestufe.klara.graph" },
  {
    id: "kapital",
    route: "/kapital",
    titleKey: "nav.capital",
    bodyKey: "zweitestufe.klara.kapital",
  },
  { id: "help", route: "/hilfe", titleKey: "nav.help", bodyKey: "klara.page.help" },
  { id: "profile", route: "/profil", titleKey: "nav.profile", bodyKey: "klara.page.profile" },
  // KO-Detail hat keine Nav-Position — eigener Eintrag für /wissen/:id.
  { id: "koDetail", route: "/wissen", titleKey: "nav.library", bodyKey: "klara.page.koDetail" },
] as const;

// Sektions-Erklärungen (Berater-Lieferung 05.07., shelp.*): je Abschnitts-Überschrift EIN
// Erklärtext. Titel = die Überschrift selbst; route = wo der Abschnitt lebt. Diese Einträge
// sind zugleich Teil der KI-Wissensdatenbank (Klara Stufe 2) und Ziel der data-help-Anker.
// `bodyKey` nur, wo der Text vom Schema `shelp.<key>` abweicht (eingefrorener Altwert, berichtigte
// Fassung in einem Textmodul) — dann sagen Seitenhilfe und Klara dasselbe.
//
// R-0908: `titel` nur dort, wo die Fläche ihre Überschrift inzwischen aus `texte/fachwort.ts`
// liest. Kennung (`sec:<key>`) und Erklärtext (`shelp.<key>`) bleiben am alten Schlüssel; Klara
// zeigt dieselbe Überschrift wie die Fläche, statt „Reasoner-Läufe" oder „Evidence-Index".
type KlaraSektion = { key: string; route: string; bodyKey?: string; titel?: string };
const KLARA_SECTIONS: readonly KlaraSektion[] = [
  { key: "adm.seedTitle", route: "/admin" },
  { key: "adm.createTitle", route: "/admin" },
  { key: "adm.auditTitle", route: "/admin" },
  { key: "ana.byType", route: "/analytics" },
  { key: "ana.weekly", route: "/analytics" },
  { key: "ask.steps", route: "/fragen" },
  { key: "ask.sources", route: "/fragen" },
  // Nacharbeit 15 (Ben): dieselbe berichtigte Fassung wie an der Fläche (`CaptureDraftList.tsx`) —
  // `shelp.capture.resumeTitle` kannte den gemeinsamen Entwurfspool nicht.
  {
    key: "capture.resumeTitle",
    route: "/erfassen",
    bodyKey: "abschnittshilfe.capture.resumeTitle",
  },
  { key: "ext.title", route: "/erfassen" },
  { key: "extpage.resultsTitle", route: "/extern" },
  { key: "ko.statement", route: "/bibliothek" },
  { key: "ko.conditions", route: "/bibliothek" },
  { key: "ko.measures", route: "/bibliothek" },
  { key: "ko.provenance", route: "/bibliothek" },
  { key: "ko.lineageTitle", route: "/bibliothek" },
  // AUFTRAG-mega68: die Nachbarschafts-Fläche ersetzt die SCRUM-130-Liste — der Hilfe-Eintrag
  // wandert mit (Titel = neue Abschnitts-Überschrift, Text erklärt das Netz statt der Liste).
  { key: "nb.title", route: "/bibliothek" },
  { key: "ko.history", route: "/bibliothek" },
  { key: "ko.evidenceTitle", route: "/bibliothek" },
  { key: "ko.snapshotsTitle", route: "/bibliothek" },
  { key: "ko.comments", route: "/bibliothek" },
  { key: "ko.attachments", route: "/bibliothek" },
  { key: "lcy.assetTitle", route: "/lebenszyklus" },
  { key: "lcy.pendingTitle", route: "/lebenszyklus" },
  { key: "lcy.pathTitle", route: "/lebenszyklus" },
  { key: "out.kindTitle", route: "/output" },
  { key: "out.sourcesTitle", route: "/output" },
  { key: "out.composeTitle", route: "/output" },
  { key: "out.previewTitle", route: "/output" },
  { key: "out.provenanceTitle", route: "/output" },
  { key: "imp.uploadTitle", route: "/import" },
  { key: "ext.pipeline.title", route: "/import" },
  { key: "imp.queueTitle", route: "/import" },
  { key: "mgmt.jumpTitle", route: "/kapital" },
  { key: "mgmt.overview", route: "/kapital" },
  { key: "mgmt.capital", route: "/kapital" },
  { key: "mgmt.valuation", route: "/kapital" },
  { key: "mgmt.statement", route: "/kapital" },
  { key: "mgmt.maturity", route: "/kapital" },
  { key: "mgmt.house", route: "/kapital" },
  { key: "mgmt.recommendations", route: "/kapital" },
  { key: "mgmt.priorities", route: "/kapital" },
  { key: "mgmt.pilot", route: "/kapital" },
  { key: "mrun.title", route: "/kapital", titel: "fachwort.kiLaeufe.titel" },
  { key: "rcfg.title", route: "/kapital", titel: "fachwort.kiEinstellung.titel" },
  { key: "evx.title", route: "/kapital", titel: "fachwort.belegIndex.titel" },
  { key: "prov.title", route: "/kapital", titel: "fachwort.herkunft.titel" },
  { key: "readiness.title", route: "/kapital", titel: "fachwort.bereitschaft.titel" },
  { key: "kos.hintsTitle", route: "/kapital", titel: "fachwort.qm.titel" },
  { key: "evFresh.title", route: "/kapital", titel: "fachwort.belegFrische.titel" },
] as const;

// Alle Klara-Einträge — Seiten zuerst, dann Feld-Hilfen, dann Sektions-Erklärungen, dann Kapitel.
export function allKlaraEntries(): readonly KlaraEntry[] {
  const pages: KlaraEntry[] = KLARA_PAGES.map((p) => ({
    id: `page:${p.id}`,
    kind: "page",
    titleKey: p.titleKey,
    bodyKey: p.bodyKey,
    route: p.route === "/wissen" ? "/bibliothek" : p.route,
  }));
  const capture: KlaraEntry[] = CAPTURE_HELP_TOPICS.map((t) => ({
    id: `cap:${t.id}`,
    kind: "field",
    titleKey: t.titleKey,
    bodyKey: t.bodyKey,
    route: "/erfassen",
  }));
  const review: KlaraEntry[] = REVIEW_HELP_TOPICS.map((t) => ({
    id: `rev:${t.id}`,
    kind: "field",
    titleKey: t.titleKey,
    bodyKey: t.bodyKey,
    // Nacharbeit 13: dorthin, wo die Handlung heute lebt (`REVIEW_HELP_ROUTE`, `lib/reviewHelp.ts`).
    route: REVIEW_HELP_ROUTE[t.id] ?? "/validierung",
  }));
  const sections: KlaraEntry[] = KLARA_SECTIONS.map((s) => ({
    id: `sec:${s.key}`,
    kind: "field",
    titleKey: s.titel ?? s.key,
    bodyKey: s.bodyKey ?? `shelp.${s.key}`,
    route: s.route,
  }));
  const topics: KlaraEntry[] = HELP_TOPICS.map((t) => ({
    id: `topic:${t.id}`,
    kind: "topic",
    titleKey: t.titleKey,
    bodyKey: t.bodyKey,
    route: t.to,
  }));
  return [...pages, ...capture, ...review, ...sections, ...topics];
}

// Seiten-Eintrag zur aktuellen Route („Du bist hier“) — exakter Treffer, /wissen/:id als Präfix.
export function pageEntryFor(pathname: string): KlaraEntry | null {
  const entries = allKlaraEntries();
  if (pathname.startsWith("/wissen/") || pathname === "/wissen") {
    return entries.find((e) => e.id === "page:koDetail") ?? null;
  }
  const page = KLARA_PAGES.find((p) => p.route === pathname);
  return page ? (entries.find((e) => e.id === `page:${page.id}`) ?? null) : null;
}

// Eintrag zu einem data-help-Anker (z. B. rev:originFilter) — null statt raten.
export function klaraEntryById(id: string): KlaraEntry | null {
  return allKlaraEntries().find((e) => e.id === id) ?? null;
}

// Auflösung der i18n-Keys zu Texten — der Aufrufer reicht t() herein (DOM-/i18n-frei testbar).
export function resolveKlaraEntries(
  entries: readonly KlaraEntry[],
  t: (key: string) => string,
): ResolvedKlaraEntry[] {
  return entries.map((e) => ({ ...e, title: t(e.titleKey), body: t(e.bodyKey) }));
}

// FAQ (Berater-Lieferung 3a) als fertige, bereits aufgelöste Einträge der Wissensdatenbank.
// Ehrliches Sprach-Gate: Die Inhalte sind DE — im englischen UI bleiben sie draußen, bis die
// EN-Fassung (Lieferung 3b) eintrifft. Frage = Titel, Antwort = Text, route = Absprungziel.
export function allFaqEntries(language: string): ResolvedKlaraEntry[] {
  if (!language.startsWith("de")) {
    return [];
  }
  return FAQ_CONTENT.map((f) => ({
    id: `faq:${f.id}`,
    kind: "faq" as const,
    titleKey: "",
    bodyKey: "",
    route: f.route,
    title: f.question,
    body: f.answer,
  }));
}

// Die Bibliotheksartikel (R-0890 / R-0935, Art „artikel“) stehen NICHT hier, sondern in
// `lib/klaraBibliothek.ts`: diese Registry liegt im ersten geladenen Brocken, die Artikel werden
// erst beim Öffnen des Panels nachgeladen (Deckel R-0801).

// Kleine Synonym-Karte für die tolerante Suche: Alltagswort → Wortstamm aus den Hilfetexten.
// Bewusst klein und wartbar; wächst mit echten Anwenderfragen (Hilfe-Lücken-Schleife).
// Exportiert für den Ehrlichkeitswächter in `tests/help/klara-registry.test.ts`: jeder Zielstamm
// muss in mindestens einem aufgelösten deutschen Klara-Eintrag vorkommen — ein Stamm, den kein
// Eintrag trägt, täuscht Hilfe vor, die es nicht gibt. EINE Karte, kein zweites Abbild.
export const KLARA_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  freigeben: ["validier"],
  freigabe: ["validier"],
  genehmigen: ["validier"],
  artikel: ["wissensobjekt", "objekt"],
  beitrag: ["wissensobjekt", "objekt"],
  löschen: ["papierkorb", "entfern"],
  frage: ["antwort", "wissenslücke"],
  // JOB 3798: die Alltagswörter eines ABGESCHAFFTEN Versprechens. KLARWERK führt zwei Einträge nie
  // zu einem zusammen — JOB 3771 hat „du entscheidest bewusst, was verschmolzen wird" von der
  // Dublettenfläche genommen, JOB 3787 „Artikel zusammenführen" aus der FAQ. Wer diese Wörter
  // gelesen hat, tippt sie weiter; ohne Synonym läuft er ins Leere (gemessen: 0 Treffer). Das
  // Synonym belebt das Versprechen nicht wieder — es führt auf die Fläche, die sagt, was WIRKLICH
  // passiert. Zielstamm ist überall `duplikat` (trägt über `nav.duplicates` = „Duplikate").
  verschmelzen: ["duplikat"], // 3771, Infinitiv der Fläche
  verschmolzen: ["duplikat"], // 3771, Partizip des gestrichenen Satzes
  mergen: ["duplikat"], // das englische Alltagswort, das im Katalog nirgends steht
  zusammenführen: ["duplikat"], // 3787, Wortlaut der alten FAQ-Frage — siehe Nachführ-Pin im Test
  zusammenführung: ["duplikat"], // dasselbe als Substantiv; die Teilkette trägt es NICHT von selbst
};

// Pedi 05.07. (Bug): Eine Frage mit Satzzeichen — „Validierung?" — fand nichts, weil das
// Fragezeichen am Wort klebte. Satzzeichen fliegen deshalb VOR der Suche raus (Bindestrich
// bleibt: Bus-Faktor). Gilt für Anfrage UND Text gleichermaßen.
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Seiten-Label zu einer Route (für den „Zum Bereich"-Link unter KI-Antworten).
export function pageTitleKeyForRoute(route: string): string | null {
  const page = KLARA_PAGES.find((p) => p.route === route && p.id !== "koDetail");
  return page ? page.titleKey : null;
}

// Tolerante Suche über aufgelöste Einträge: jedes Suchwort (oder ein Synonym-Stamm) muss im
// Titel+Text vorkommen. Leere Suche = keine Treffer (das Panel zeigt dann den Seiten-Kontext).
export function searchKlara(
  entries: readonly ResolvedKlaraEntry[],
  query: string,
): ResolvedKlaraEntry[] {
  const q = normalizeForSearch(query);
  if (q.length === 0) {
    return [];
  }
  const tokens = q.split(" ").filter((tok) => tok.length > 1);
  if (tokens.length === 0) {
    return [];
  }
  return entries.filter((entry) => {
    const haystack = normalizeForSearch(`${entry.title} ${entry.body}`);
    return tokens.every((tok) => {
      const variants = [tok, ...(KLARA_SYNONYMS[tok] ?? [])];
      return variants.some((v) => haystack.includes(v));
    });
  });
}

// Klara Stufe 2: Ranking für die KI-Grundlage. Ganze FRAGEN („Warum brauche ich zwei
// Freigaben?") enthalten Füllwörter, die die strikte Jedes-Wort-Suche leer laufen lassen.
// Hier zählt stattdessen, WIE VIELE Suchwörter (oder Synonym-Stämme) ein Eintrag trifft —
// die besten k Einträge werden der KI als einzige Antwort-Grundlage mitgegeben.
export function rankKlara(
  entries: readonly ResolvedKlaraEntry[],
  query: string,
  limit = 6,
): ResolvedKlaraEntry[] {
  return bewerteKlara(entries, query)
    .slice(0, limit)
    .map((s) => s.entry);
}

interface BewerteterEintrag {
  entry: ResolvedKlaraEntry;
  score: number;
}

// Die Wortdeckung hinter `rankKlara`, mit Punktzahl — `klaraGrundlage` braucht sie zum Abwägen.
function bewerteKlara(
  entries: readonly ResolvedKlaraEntry[],
  query: string,
): readonly BewerteterEintrag[] {
  const q = normalizeForSearch(query);
  const tokens = q.split(" ").filter((tok) => tok.length > 2);
  if (tokens.length === 0) {
    return [];
  }
  const scored = entries
    .map((entry) => {
      const haystack = normalizeForSearch(`${entry.title} ${entry.body}`);
      const score = tokens.reduce((sum, tok) => {
        const variants = [tok, ...(KLARA_SYNONYMS[tok] ?? [])];
        return sum + (variants.some((v) => haystack.includes(v)) ? 1 : 0);
      }, 0);
      return { entry, score };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// R-0943 (Nacharbeit 7, Ben): höchstens so viele Bibliotheksauszüge kommen in die KI-Grundlage.
export const BIBLIOTHEK_PLAETZE = 3;

// R-0943 · Die KI-Grundlage aus Registry + FAQ (`bestand`) UND Bibliotheksauszügen
// (`lib/klaraBibliothek.ts`). Die Registry-Rangliste bleibt, wie sie war; die besten Auszüge
// (höchstens `BIBLIOTHEK_PLAETZE`) kommen dazu:
//   · ist noch Platz unter `limit`, füllen sie ihn;
//   · ist kein Platz, verdrängt ein Auszug nur einen Eintrag, der WENIGER Suchwörter trifft als er,
//     und dann den schwächsten — NIE eine FAQ-Antwort. So bleibt jede FAQ-Antwort, die heute in den
//     zwölf Schnipseln steht, auch drin (`tests/app/f0304-klara-assistenzflaeche.test.tsx`).
// Ohne passenden Auszug ist das Ergebnis zeichengleich mit `rankKlara(bestand, query, limit)`.
export function klaraGrundlage(
  bestand: readonly ResolvedKlaraEntry[],
  auszuege: readonly ResolvedKlaraEntry[],
  query: string,
  limit = 12,
): ResolvedKlaraEntry[] {
  const grundlage = bewerteKlara(bestand, query).slice(0, limit);
  for (const auszug of bewerteKlara(auszuege, query).slice(0, BIBLIOTHEK_PLAETZE)) {
    if (grundlage.length < limit) {
      grundlage.push(auszug);
      continue;
    }
    const verdraengbar = grundlage
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s.entry.kind !== "faq" && s.entry.kind !== "artikel")
      .filter(({ s }) => s.score < auszug.score);
    if (verdraengbar.length === 0) {
      break; // die Auszüge sind absteigend sortiert — die folgenden verdrängen erst recht nichts
    }
    const schwaechster = verdraengbar.reduce((a, b) => (b.s.score <= a.s.score ? b : a));
    grundlage.splice(schwaechster.index, 1);
    grundlage.push(auszug);
  }
  return grundlage.map((s) => s.entry);
}
