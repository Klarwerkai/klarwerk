// SCRUM-219: produktnahe Hilfekapitel + DOM-freie Suche. Die Kapitel verweisen nur auf echte
// App-Routen (kein Fremd-Link). Titel/Text liegen als i18n-Keys vor; die Suche arbeitet auf den
// bereits aufgelösten Texten (DOM-frei, testbar ohne i18n/React).

export interface HelpTopicDef {
  id: string;
  titleKey: string;
  bodyKey: string;
  to: string; // echte App-Route (aus navigation/routes)
  tags: readonly string[];
}

// Reihenfolge = Anzeigereihenfolge. `to` ist bewusst nur eine vorhandene interne Route.
export const HELP_TOPICS: readonly HelpTopicDef[] = [
  {
    id: "firststart",
    titleKey: "help.firststart.title",
    bodyKey: "help.firststart.body",
    to: "/admin",
    tags: ["admin", "demodaten", "seed", "erststart", "onboarding", "setup"],
  },
  {
    id: "capture",
    titleKey: "help.capture.title",
    bodyKey: "help.capture.body",
    to: "/erfassen",
    tags: ["erfassen", "wissen", "entwurf", "draft", "interview", "diktat", "ko"],
  },
  {
    id: "ask",
    titleKey: "help.ask.title",
    bodyKey: "help.ask.body",
    to: "/fragen",
    tags: ["fragen", "ask", "antwort", "wissenslücke", "gap"],
  },
  {
    id: "library",
    titleKey: "help.library.title",
    bodyKey: "help.library.body",
    to: "/bibliothek",
    tags: ["bibliothek", "library", "suche", "filter", "ko-detail", "wissensobjekt"],
  },
  {
    id: "validation",
    titleKey: "help.validation.title",
    bodyKey: "help.validation.body",
    to: "/validierung",
    tags: ["validierung", "peer", "bewerten", "freigabe", "vertrauen"],
  },
  {
    id: "tasks",
    titleKey: "help.tasks.title",
    bodyKey: "help.tasks.body",
    to: "/aufgaben",
    tags: ["aufgaben", "mytasks", "zuweisung", "todo"],
  },
  {
    id: "risk",
    titleKey: "help.risk.title",
    bodyKey: "help.risk.body",
    to: "/risiko",
    tags: ["risiko", "lücken", "gaps", "konflikte", "bus-faktor", "priorität"],
  },
  {
    id: "lifecycle",
    titleKey: "help.lifecycle.title",
    bodyKey: "help.lifecycle.body",
    to: "/lebenszyklus",
    tags: ["lebenszyklus", "lernpfad", "revalidierung", "asset", "reife"],
  },
  {
    id: "stufe2",
    titleKey: "help.stufe2.title",
    bodyKey: "help.stufe2.body",
    to: "/kapital",
    tags: ["stufe 2", "qm", "kapital", "management", "output", "evidence", "provenance"],
  },
  {
    id: "mobile",
    titleKey: "help.mobile.title",
    bodyKey: "help.mobile.body",
    to: "/mobile",
    tags: ["mobile", "offline", "pwa", "unterwegs"],
  },
];

// Bereits aufgelöste, durchsuchbare Repräsentation eines Kapitels.
export interface HelpSearchItem {
  id: string;
  title: string;
  body: string;
  tags: readonly string[];
}

// DOM-freie Suche über Titel, Text und Tags. Leere/whitespace-Query → alle Kapitel.
export function filterHelpTopics<T extends HelpSearchItem>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...items];
  }
  return items.filter((item) => {
    const haystack = `${item.title} ${item.body} ${item.tags.join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}
