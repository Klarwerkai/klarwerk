// ================================================================================================
// SPÄTER GEÄNDERTE WÖRTERBUCHWERTE — je Sprache und Schlüssel an Vorher- UND Nachherwert gebunden.
// ================================================================================================
//
// Gesamtcheck R-1329, Nacharbeit 61 (Ben zu da61b6ce): W1 darf eine Wertänderung nur anerkennen,
// wenn genau DIESE Änderung belegt ist. Ein bloß benannter Schlüssel ließ jeden neuen Wert und sogar
// das Entfernen durch. Deshalb steht hier jede Änderung einzeln — Sprache, Schlüssel, der Wert im
// Bezugspunkt `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt` und der Wert, den der belegte Auftrag
// gesetzt hat. Beide sind WÖRTLICH übernommen (gelesen am Bezugspunkt und in
// `apps/web/src/woerterbuch/{de,en,nl}.ts` am Kandidaten da61b6ce), nicht aus dem geprüften Baum
// abgeleitet. `spaetereAenderungen` verlangt je Eintrag genau einen passenden Eintrag auf beiden
// Seiten; ein anderer Wert, ein fehlender oder doppelter Schlüssel und eine andere Sprache bleiben rot.

export interface SpaetereWertaenderung {
  readonly beleg: string;
  readonly sprache: "de" | "en" | "nl";
  readonly schluessel: string;
  /** Der Wert im Bezugspunkt, wörtlich. */
  readonly vorher: string;
  /** Der vom belegten Auftrag gesetzte Wert, wörtlich. */
  readonly nachher: string;
}

const R0962 = "R-0962 „Offene Aufgaben“ (tests-smoke/gesamt-navigation-u3-browser.spec.ts)";
const P08 = "PETER-20261011-P08 Firmenreset";

export const GEAENDERTE_WERTE: readonly SpaetereWertaenderung[] = [
  {
    beleg: "Sprachprüfung, Hilfe nennt die englische Beschriftung von lcy.assetToggle",
    sprache: "en",
    schluessel: "ko.couple.help",
    vorher:
      "Couple this knowledge to an asset and “asset changed” (lifecycle) will automatically flag it for review — knowledge stays current.",
    nachher:
      "Couple this knowledge to an asset and “Asset changed …” (lifecycle) will automatically flag it for review — knowledge stays current.",
  },
  // ---------------------------------------------------------------------------------------- de
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "nav.tasks",
    vorher: "Meine Aufgaben",
    nachher: "Offene Aufgaben",
  },
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "seitenhilfe.aufgaben.title",
    vorher: "Meine Aufgaben: was von dir erledigt werden will",
    nachher: "Offene Aufgaben: was hier zu erledigen ist",
  },
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "seitenhilfe.aufgaben.body",
    vorher:
      "Hier steht deine Arbeit an einer Stelle: Prüfungen, Konflikte, fällige Revalidierungen, offene Wissenslücken und Objekte, die zur Nacharbeit an dich zurückgingen. Der farbige Punkt zeigt die Dringlichkeit (rot „Kritisch“, gelb „Heute“, grün „Später“), die Knopfreihe oben filtert nach Art und nennt die Anzahl, und das „i“ an einer Zeile sagt dir, was dort zu tun ist. Nächster Schritt: Klick die oberste Zeile an — sie führt an die Stelle, an der die Aufgabe erledigt wird, sofern diese Fläche für deine Rolle freigegeben ist; sonst bleibt der Weg zu (Konflikte, Risiko und Lebenszyklus sind nicht für jede Rolle offen). Steht „Nichts offen.“, zeigt „Wie geht es weiter?“ die möglichen nächsten Wege.",
    nachher:
      "Hier steht die offene Arbeit an einer Stelle: Prüfungen, Konflikte, fällige Revalidierungen, offene Wissenslücken und Objekte, die zur Nacharbeit an dich zurückgingen. Der farbige Punkt zeigt die Dringlichkeit (rot „Kritisch“, gelb „Heute“, grün „Später“), die Knopfreihe oben filtert nach Art und nennt die Anzahl, und das „i“ an einer Zeile sagt dir, was dort zu tun ist. Nächster Schritt: Klick die oberste Zeile an — sie führt an die Stelle, an der die Aufgabe erledigt wird, sofern diese Fläche für deine Rolle freigegeben ist; sonst bleibt der Weg zu (Konflikte, Risiko und Lebenszyklus sind nicht für jede Rolle offen). Steht „Nichts offen.“, zeigt „Wie geht es weiter?“ die möglichen nächsten Wege.",
  },
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "klara.page.tasks",
    vorher:
      "Deine offenen Aufgaben: zugewiesene Prüfungen, Lücken und Fälligkeiten — mit direktem Absprung zur jeweiligen Arbeit.",
    nachher:
      "Offene Aufgaben: fällige Prüfungen, Lücken und Fälligkeiten — mit direktem Absprung zur jeweiligen Arbeit.",
  },
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "help.tasks.title",
    vorher: "Meine Aufgaben",
    nachher: "Offene Aufgaben",
  },
  {
    beleg: R0962,
    sprache: "de",
    schluessel: "help.tasks.body",
    vorher:
      "Hier steht deine eigene Arbeit an einer Stelle: Objekte, die auf deine Prüfung in der Validierung warten, Rückfragen an dich, gemeldete Widersprüche, offene Wissenslücken und Objekte, die nach einer Anlagenänderung noch einmal bestätigt werden sollen. Ein farbiger Punkt zeigt die Dringlichkeit, die Knopfreihe darüber grenzt die Liste auf eine Art ein, und das „i“ an einer Zeile sagt, was dort zu tun ist. Jede Zeile führt genau dorthin, wo die Sache erledigt wird — sofern deine Rolle diesen Bereich sehen darf. Nächster Schritt: die oberste Zeile anklicken und sie abarbeiten.",
    nachher:
      "Hier steht die offene Arbeit an einer Stelle: Objekte, die auf deine Prüfung in der Validierung warten, Rückfragen an dich, gemeldete Widersprüche, offene Wissenslücken und Objekte, die nach einer Anlagenänderung noch einmal bestätigt werden sollen. Ein farbiger Punkt zeigt die Dringlichkeit, die Knopfreihe darüber grenzt die Liste auf eine Art ein, und das „i“ an einer Zeile sagt, was dort zu tun ist. Jede Zeile führt genau dorthin, wo die Sache erledigt wird — sofern deine Rolle diesen Bereich sehen darf. Nächster Schritt: die oberste Zeile anklicken und sie abarbeiten.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "adm.factory.help",
    vorher:
      "Setzt die lokale Instanz vollständig zurück: alle Wissensobjekte, Anwender, Konflikte, Lücken und Einstellungen werden gelöscht. Danach beendet sich das Programm; beim nächsten Start beginnt die Ersteinrichtung und der erste Anwender wird wieder Admin. Nur in der lokalen Desktop-Version verfügbar.",
    nachher:
      "Setzt den Bestand der lokalen Instanz zurück: Wissensobjekte, offene Fragen, Konflikte, Entwürfe und Einstellungen werden gelöscht, alle Anmeldungen enden. Benutzerkonten, Firmenwörterbuch und Prüfprotokoll bleiben erhalten. Danach beendet sich das Programm; nach dem Neustart meldest du dich mit deinem bestehenden Konto an. Nur in der lokalen Desktop-Version verfügbar.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "adm.factory.hint",
    vorher:
      "Für wiederholte Tests: alles löschen und das Programm beenden. Nach dem Neustart ist wieder alles wie bei der ersten Einrichtung.",
    nachher:
      "Für wiederholte Tests: den Bestand löschen und das Programm beenden. Konten und Firmenwörterbuch bleiben.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "adm.factory.confirm1",
    vorher: "Wirklich ALLE Daten löschen und das Programm beenden?",
    nachher: "Prüfe, was entfernt wird und was erhalten bleibt.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "adm.factory.warnBody",
    vorher:
      "ALLE Wissensobjekte, Konten und Einstellungen werden gelöscht und das Programm beendet. Das lässt sich nicht rückgängig machen.",
    nachher:
      "Der Bestand aus der Vorschau wird gelöscht und das Programm beendet. Benutzerkonten, Firmenwörterbuch und Prüfprotokoll bleiben. Das lässt sich nicht rückgängig machen.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "adm.factory.restartHint",
    vorher:
      "Zurückgesetzt. Das Programm wird beendet — bitte die KLARWERK-App neu starten. Der erste Anwender wird dann wieder Admin.",
    nachher:
      "Zurückgesetzt. Das Programm wird beendet — bitte die KLARWERK-App neu starten und mit dem bestehenden Konto anmelden.",
  },
  {
    beleg: P08,
    sprache: "de",
    schluessel: "seitenhilfe.admin.werk.text",
    vorher:
      "Der Werksreset löscht alle Daten und beendet danach den Server; die Anwendung muss von Hand neu gestartet werden. Deshalb zwei Stufen: erst dein eigenes Passwort, dann die ausdrückliche Warnung. Es gibt ihn nicht in jeder Installation — steht hier „In dieser Installation nicht verfügbar“, ist der Weg auf diesem Server nicht eingebaut, und daran ändert kein Schalter etwas. Nur die Vorführdaten wirst du stattdessen unter Vorführdaten los.",
    nachher:
      "Der Werksreset löscht den Bestand und beendet danach den Server; die Anwendung muss von Hand neu gestartet werden. Benutzerkonten, Firmenwörterbuch und Prüfprotokoll bleiben erhalten. Deshalb zwei Stufen: erst die Vorschau mit Bestätigungshaken und zweimal dein eigenes Passwort, dann die ausdrückliche Warnung. Es gibt ihn nicht in jeder Installation — steht hier „In dieser Installation nicht verfügbar“, ist der Weg auf diesem Server nicht eingebaut, und daran ändert kein Schalter etwas. Nur die Vorführdaten wirst du stattdessen unter Vorführdaten los.",
  },
  // ---------------------------------------------------------------------------------------- en
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "nav.tasks",
    vorher: "My Tasks",
    nachher: "Open tasks",
  },
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "seitenhilfe.aufgaben.title",
    vorher: "My Tasks: what is waiting for you to do",
    nachher: "Open tasks: what is waiting to be done here",
  },
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "seitenhilfe.aufgaben.body",
    vorher:
      "This is your work in one place: validations, conflicts, due revalidations, open knowledge gaps and objects that came back to you for rework. The coloured dot shows the urgency (red “Critical”, yellow “Today”, green “Later”), the row of buttons above filters by type and states the count, and the “i” on a line tells you what has to be done there. Next step: click the topmost line — it takes you to where the task gets done, provided that area is enabled for your role; otherwise the way stays closed (conflicts, risk and lifecycle are not open to every role). If it says “Nothing open.”, “What happens next?” shows the possible next moves.",
    nachher:
      "This is the open work in one place: validations, conflicts, due revalidations, open knowledge gaps and objects that came back to you for rework. The coloured dot shows the urgency (red “Critical”, yellow “Today”, green “Later”), the row of buttons above filters by type and states the count, and the “i” on a line tells you what has to be done there. Next step: click the topmost line — it takes you to where the task gets done, provided that area is enabled for your role; otherwise the way stays closed (conflicts, risk and lifecycle are not open to every role). If it says “Nothing open.”, “What happens next?” shows the possible next moves.",
  },
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "klara.page.tasks",
    vorher:
      "Your open tasks: assigned reviews, gaps and due items — each with a direct jump to the work.",
    nachher: "Open tasks: due reviews, gaps and due items — each with a direct jump to the work.",
  },
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "help.tasks.title",
    vorher: "My tasks",
    nachher: "Open tasks",
  },
  {
    beleg: R0962,
    sprache: "en",
    schluessel: "help.tasks.body",
    vorher:
      "Your own work stands here in one place: objects waiting for you to check them on Validation, queries directed at you, reported contradictions, open knowledge gaps and objects that should be confirmed once more after a change to a machine or process. A coloured dot shows the urgency, the row of buttons above narrows the list down to one kind, and the “i” on a row tells you what is to be done there. Every row leads exactly to where the matter gets settled — as far as your role is allowed to see that area. Next step: click the top row and work it off.",
    nachher:
      "The open work stands here in one place: objects waiting for you to check them on Validation, queries directed at you, reported contradictions, open knowledge gaps and objects that should be confirmed once more after a change to a machine or process. A coloured dot shows the urgency, the row of buttons above narrows the list down to one kind, and the “i” on a row tells you what is to be done there. Every row leads exactly to where the matter gets settled — as far as your role is allowed to see that area. Next step: click the top row and work it off.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "adm.factory.help",
    vorher:
      "Fully resets the local instance: all knowledge objects, users, conflicts, gaps and settings are deleted. The program then quits; on the next start the initial setup runs and the first user becomes admin again. Only available in the local desktop version.",
    nachher:
      "Resets the content of the local instance: knowledge objects, open questions, conflicts, drafts and settings are deleted, all sign-ins end. User accounts, the company dictionary and the audit trail are kept. The program then quits; after the restart you sign in with your existing account. Only available in the local desktop version.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "adm.factory.hint",
    vorher:
      "For repeated testing: wipe everything and quit the program. After a restart it's all fresh, just like first setup.",
    nachher:
      "For repeated testing: delete the content and quit the program. Accounts and the company dictionary are kept.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "adm.factory.confirm1",
    vorher: "Really delete ALL data and quit the program?",
    nachher: "Check what will be removed and what will be kept.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "adm.factory.warnBody",
    vorher:
      "ALL knowledge objects, accounts and settings will be deleted and the program will quit. This cannot be undone.",
    nachher:
      "The content shown in the preview will be deleted and the program will quit. User accounts, the company dictionary and the audit trail are kept. This cannot be undone.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "adm.factory.restartHint",
    vorher:
      "Reset done. The program is quitting — please restart the KLARWERK app. The first user will become admin again.",
    nachher:
      "Reset done. The program is quitting — please restart the KLARWERK app and sign in with your existing account.",
  },
  {
    beleg: P08,
    sprache: "en",
    schluessel: "seitenhilfe.admin.werk.text",
    vorher:
      "The factory reset deletes all data and then shuts the server down; the application has to be restarted by hand. Hence two stages: first your own password, then the explicit warning. It does not exist in every installation — if this card says “Not available in this installation”, the path is not built into this server, and no switch changes that. Demo data alone is what you remove under demo and sample data instead.",
    nachher:
      "The factory reset deletes the content and then shuts the server down; the application has to be restarted by hand. User accounts, the company dictionary and the audit trail are kept. Hence two stages: first the preview with a confirmation tick and your own password twice, then the explicit warning. It does not exist in every installation — if this card says “Not available in this installation”, the path is not built into this server, and no switch changes that. Demo data alone is what you remove under demo and sample data instead.",
  },
  // ---------------------------------------------------------------------------------------- nl
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "nav.tasks",
    vorher: "Mijn taken",
    nachher: "Open taken",
  },
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "seitenhilfe.aufgaben.title",
    vorher: "Mijn taken: wat er van jou wordt verwacht",
    nachher: "Open taken: wat hier te doen is",
  },
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "seitenhilfe.aufgaben.body",
    vorher:
      "Hier staat je werk op één plek: validaties, conflicten, openstaande hervalidaties, open kennishiaten en objecten die voor nawerk bij jou terugkwamen. De gekleurde stip toont de urgentie (rood “Kritiek”, geel “Vandaag”, groen “Later”), de knoppenrij erboven filtert op soort en noemt het aantal, en de “i” bij een regel zegt wat daar te doen is. Volgende stap: klik de bovenste regel aan — die brengt je naar de plek waar de taak wordt afgerond, voor zover dat gebied is vrijgegeven voor jouw rol; anders blijft de weg dicht (conflicten, risico en levenscyclus zijn niet voor elke rol open). Staat er “Niets open.”, dan toont “Hoe gaat het verder?” de mogelijke volgende wegen.",
    nachher:
      "Hier staat het openstaande werk op één plek: validaties, conflicten, openstaande hervalidaties, open kennishiaten en objecten die voor nawerk bij jou terugkwamen. De gekleurde stip toont de urgentie (rood “Kritiek”, geel “Vandaag”, groen “Later”), de knoppenrij erboven filtert op soort en noemt het aantal, en de “i” bij een regel zegt wat daar te doen is. Volgende stap: klik de bovenste regel aan — die brengt je naar de plek waar de taak wordt afgerond, voor zover dat gebied is vrijgegeven voor jouw rol; anders blijft de weg dicht (conflicten, risico en levenscyclus zijn niet voor elke rol open). Staat er “Niets open.”, dan toont “Hoe gaat het verder?” de mogelijke volgende wegen.",
  },
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "klara.page.tasks",
    vorher:
      "Jouw open taken: toegewezen beoordelingen, hiaten en vervaldata — met een directe sprong naar het bijbehorende werk.",
    nachher:
      "Open taken: openstaande beoordelingen, hiaten en vervaldata — met een directe sprong naar het bijbehorende werk.",
  },
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "help.tasks.title",
    vorher: "Mijn taken",
    nachher: "Open taken",
  },
  {
    beleg: R0962,
    sprache: "nl",
    schluessel: "help.tasks.body",
    vorher:
      "Hier staat je eigen werk op één plek: objecten die op jouw controle in de Validatie wachten, terugvragen aan jou, gemelde tegenstrijdigheden, open kennishiaten en objecten die na een wijziging aan een installatie of proces nog eens bevestigd moeten worden. Een gekleurde stip toont de urgentie, de knoppenrij erboven perkt de lijst in tot één soort, en de „i“ bij een regel zegt wat daar te doen is. Elke regel leidt precies naar de plek waar de zaak wordt afgehandeld — voor zover jouw rol dat onderdeel mag zien. Volgende stap: de bovenste regel aanklikken en afwerken.",
    nachher:
      "Hier staat het openstaande werk op één plek: objecten die op jouw controle in de Validatie wachten, terugvragen aan jou, gemelde tegenstrijdigheden, open kennishiaten en objecten die na een wijziging aan een installatie of proces nog eens bevestigd moeten worden. Een gekleurde stip toont de urgentie, de knoppenrij erboven perkt de lijst in tot één soort, en de „i“ bij een regel zegt wat daar te doen is. Elke regel leidt precies naar de plek waar de zaak wordt afgehandeld — voor zover jouw rol dat onderdeel mag zien. Volgende stap: de bovenste regel aanklikken en afwerken.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "adm.factory.help",
    vorher:
      "Zet de lokale instantie volledig terug: alle kennisobjecten, gebruikers, conflicten, hiaten en instellingen worden verwijderd. Daarna sluit het programma zich af; bij de volgende start begint de eerste installatie en wordt de eerste gebruiker weer admin. Alleen beschikbaar in de lokale desktopversie.",
    nachher:
      "Zet de inhoud van de lokale instantie terug: kennisobjecten, open vragen, conflicten, concepten en instellingen worden verwijderd, alle aanmeldingen eindigen. Gebruikersaccounts, het bedrijfswoordenboek en het auditlog blijven behouden. Daarna sluit het programma zich af; na de herstart meld je je aan met je bestaande account. Alleen beschikbaar in de lokale desktopversie.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "adm.factory.hint",
    vorher:
      "Voor herhaalde tests: alles verwijderen en het programma afsluiten. Na de herstart is alles weer zoals bij de eerste installatie.",
    nachher:
      "Voor herhaalde tests: de inhoud verwijderen en het programma afsluiten. Accounts en het bedrijfswoordenboek blijven.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "adm.factory.confirm1",
    vorher: "Weet je zeker dat je ALLE gegevens wilt verwijderen en het programma wilt afsluiten?",
    nachher: "Controleer wat wordt verwijderd en wat behouden blijft.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "adm.factory.warnBody",
    vorher:
      "ALLE kennisobjecten, accounts en instellingen worden verwijderd en het programma wordt afgesloten. Dit kan niet ongedaan worden gemaakt.",
    nachher:
      "De inhoud uit het overzicht wordt verwijderd en het programma wordt afgesloten. Gebruikersaccounts, het bedrijfswoordenboek en het auditlog blijven. Dit kan niet ongedaan worden gemaakt.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "adm.factory.restartHint",
    vorher:
      "Teruggezet. Het programma wordt afgesloten — start de KLARWERK-app opnieuw. De eerste gebruiker wordt dan weer admin.",
    nachher:
      "Teruggezet. Het programma wordt afgesloten — start de KLARWERK-app opnieuw en meld je aan met je bestaande account.",
  },
  {
    beleg: P08,
    sprache: "nl",
    schluessel: "seitenhilfe.admin.werk.text",
    vorher:
      "De fabrieksreset verwijdert alle gegevens en sluit daarna de server af; de toepassing moet met de hand opnieuw worden gestart. Vandaar twee trappen: eerst je eigen wachtwoord, dan de uitdrukkelijke waarschuwing. Hij bestaat niet in elke installatie — staat hier „In deze installatie niet beschikbaar“, dan is de weg op deze server niet ingebouwd, en geen enkele schakelaar verandert daar iets aan. Alleen de demogegevens raak je in plaats daarvan kwijt onder demogegevens.",
    nachher:
      "De fabrieksreset verwijdert de inhoud en sluit daarna de server af; de toepassing moet met de hand opnieuw worden gestart. Gebruikersaccounts, het bedrijfswoordenboek en het auditlog blijven behouden. Vandaar twee trappen: eerst het overzicht met bevestigingsvinkje en twee keer je eigen wachtwoord, dan de uitdrukkelijke waarschuwing. Hij bestaat niet in elke installatie — staat hier „In deze installatie niet beschikbaar“, dan is de weg op deze server niet ingebouwd, en geen enkele schakelaar verandert daar iets aan. Alleen de demogegevens raak je in plaats daarvan kwijt onder demogegevens.",
  },
];
