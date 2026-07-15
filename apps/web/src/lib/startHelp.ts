// SCRUM-488 (Nullschulung): Zentrale, DOM-freie Karte der ?-Hilfen auf dem START-Screen — dem ersten
// Screen, den ein ungeschulter Self-Service-Tester überhaupt sieht (Blindspot-Inventur: 0 HelpTips).
// Gegenstück zu captureHelp (Erfassen) / reviewHelp (Prüfbereich): eine Quelle für Komponente UND Test,
// stabiler Themen-Schlüssel + i18n-Paar (Titel + Text nach „Was ist das? · Wann hilft es? · Was NICHT
// automatisch?"). Eigener Namensraum shelp.<id>.title / shelp.<id>.body.

export const START_HELP_IDS = [
  // Der Knowledge-OS-Kreis (die vier Startkacheln: Erfassen → Validieren → Nutzen → Aktuell halten).
  "cycle",
  // Die Arbeitsübersicht (echte offene Signale, keine erfundene To-do-Liste).
  "work",
  // Die farbigen Dringlichkeits-Punkte (rot/gelb/grau).
  "severity",
  // Die vier Kennzahlen (Gesamt/Offen/Validiert/Lücken).
  "kpis",
] as const;

export type StartHelpId = (typeof START_HELP_IDS)[number];

export interface StartHelpTopic {
  id: StartHelpId;
  titleKey: string;
  bodyKey: string;
}

// Schlüssel-Schema wie in captureHelp/reviewHelp, eigener Namensraum: shelp.<id>.title / shelp.<id>.body.
export function startHelp(id: StartHelpId): StartHelpTopic {
  return { id, titleKey: `shelp.${id}.title`, bodyKey: `shelp.${id}.body` };
}

export const START_HELP_TOPICS: readonly StartHelpTopic[] = START_HELP_IDS.map(startHelp);
