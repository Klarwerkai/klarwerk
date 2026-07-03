# SCRUM-406 · Hilfetexte-Entwurf (Priorität 1+2) — zum Review durch Pedi

> [Paul / Cloud-Worker], 03.07.2026 · Nächster Schritt laut Ticket: „je Element Hilfetext → Review
> durch Pedi". Deutsch zuerst (Review-Sprache); EN entsteht 1:1 im Umsetzungs-Slice nach dem Freeze.
> Schema je Text: **Was macht das? · Wann nutze ich es? · Was passiert danach (und was NICHT automatisch)?**
> Ton: nüchtern, aktiv, ehrlich (CI-Sprachregeln); „du"-Form wie in der App üblich.
> Referenz: Inventur-Nummern aus `SCRUM-406-INVENTUR-PRUEFBEREICH.md`.

## Priorität 1 · Prüfentscheidung (A12 Board / B1 Detail)

### Freigeben (verdict up)
**Titel:** Freigeben
**Text:** Du bestätigst nach eigener Prüfung: Diese Aussage ist fachlich richtig und so anwendbar. Nutze das erst, wenn du Kernaussage, Bedingungen und Maßnahmen wirklich beurteilt hast — deine Freigabe zählt als eine von mehreren nötigen Prüfstimmen (siehe „Ziel n"). Danach steigt das Vertrauen des Wissensobjekts; VALIDIERT wird es erst, wenn genug Prüfer freigegeben haben. Nichts wird automatisch veröffentlicht oder verändert — deine Stimme wird gezählt, mehr nicht.

### Rückfrage (verdict warn, mit Pflicht-Kommentar)
**Titel:** Rückfrage stellen
**Text:** Du hältst das Wissen für brauchbar, aber etwas ist unklar, unvollständig oder nur unter Bedingungen richtig. Ein kurzer Kommentar ist Pflicht — er ist deine Hilfe an den Autor: Was genau fehlt, was soll er nachtragen? Danach bleibt das Objekt in Prüfung und der Autor sieht deine Rückfrage als Kommentar am Wissensobjekt. Es wird nichts abgelehnt, nichts freigegeben und nichts automatisch geändert — die Überarbeitung macht der Autor bewusst selbst.

### Ablehnen (verdict down, mit Pflicht-Kommentar)
**Titel:** Ablehnen
**Text:** Du hältst die Aussage für falsch, veraltet oder riskant. Auch hier ist die Begründung Pflicht — ohne sie kann der Autor nichts lernen und nichts korrigieren. Danach fließt deine Ablehnung in den Prüfstand des Objekts ein; es wird dadurch NICHT gelöscht und NICHT gesperrt, sondern bleibt sichtbar in Prüfung, bis Autor oder Controller reagieren. Wenn zwei gesicherte Aussagen einander widersprechen, ist „Konflikt melden" der bessere Weg als eine Ablehnung.

### Prüfer zuweisen (A14)
**Titel:** Prüfer zuweisen
**Text:** Du bittest eine bestimmte Kollegin oder einen Kollegen um die Prüfung dieses Objekts. Die Person sieht es danach in ihrer persönlichen Review-Liste („Mir zugewiesen") und bekommt eine Benachrichtigung über die Glocke. Die Zuweisung ist eine Einladung, keine Bewertung: Sie ändert weder Status noch Vertrauen, und geprüft wird erst, wenn die Person selbst entscheidet.

### Noch gültig (B2, Revalidierung)
**Titel:** Noch gültig
**Text:** Du bestätigst, dass dieses bereits geprüfte Wissen aus deiner Sicht weiterhin stimmt — ein Frische-Signal, kein neues Prüfverfahren. Nutze es, wenn du das Wissen gerade angewendet oder bewusst gegengelesen hast. Danach wird die Bestätigung mit Datum vermerkt und das Objekt gilt als kürzlich bestätigt. Es ersetzt keine Peer-Prüfung und hebt keine Rückfragen oder Konflikte auf.

### Konflikt melden (B3/B4)
**Titel:** Konflikt melden
**Text:** Du zeigst an, dass dieses Wissen einem ANDEREN Wissensobjekt widerspricht — etwa zwei unterschiedliche Grenzwerte für denselben Fall. Wähle das Gegen-Objekt, die Konfliktart und beschreibe kurz den Widerspruch. Danach erscheint der Fall auf der Konflikte-Seite und wird dort bewusst aufgelöst (Zweitmeinung, Eskalation, dokumentierte Entscheidung). Beide Objekte bleiben unverändert bestehen — es wird nichts automatisch korrigiert, überschrieben oder gelöscht.

## Priorität 2 · Quellen-Panel (C1–C8)

### Quellen & Stufe-2-Badge (C1)
**Titel:** Externe Quellen (Stufe 2)
**Text:** Hier hängen externe Belege am Wissensobjekt: Normen, Handbücher, Artikel, interne Dokumente. Das Badge „Stufe 2" bedeutet ehrlich: Diese Quelle wurde NICHT von Kollegen peer-geprüft — sie stützt das Wissen, ersetzt aber keine einzige Prüfstimme. Antworten der Fragen-Seite bauen auf validiertem Wissen auf, nicht auf Stufe-2-Quellen allein.

### Bezeichnung / URL / Auszug (C3, drei Felder)
**Titel:** Quelle beschreiben
**Text:** Drei Angaben machen eine Quelle brauchbar: Die **Bezeichnung** sagt, was es ist („DIN EN 1090, Abschnitt 7"), die **URL** führt hin (leer lassen bei Papier- oder internen Quellen), der **Auszug** zitiert die eine entscheidende Stelle wörtlich — so muss niemand das ganze Dokument lesen, um die Aussage zu prüfen. Je konkreter der Auszug, desto mehr hilft die Quelle den Prüfern.

### Quelle hinzufügen (C5)
**Titel:** Quelle hinzufügen
**Text:** Hängt die beschriebene Quelle als Stufe-2-Beleg an dieses Wissensobjekt. Sie bleibt über Versionen hinweg erhalten und ist für alle sichtbar. Es passiert nichts weiter automatisch: Der Inhalt der Quelle wird nicht ins Wissen übernommen, nicht geprüft und nicht bewertet — sie steht als Beleg daneben.

### Quellensuche (C6, Server-Proxy)
**Titel:** Quellen suchen
**Text:** Sucht nach externen Belegen zu diesem Thema. Die Suche läuft über den KLARWERK-Server — deine Anfrage geht nicht direkt von deinem Browser an externe Dienste. Die Treffer sind unverbindliche Vorschläge: Nichts davon wird automatisch angehängt. Prüfe Titel und Ausschnitt, öffne im Zweifel den Link, und übernimm nur, was wirklich passt.

### Treffer anhängen (C7)
**Titel:** Treffer anhängen
**Text:** Übernimmt genau diesen Suchtreffer als Stufe-2-Quelle an das Wissensobjekt — deine bewusste Entscheidung, kein Automatismus. Danach erscheint er oben in der Quellenliste und kann wie jede Quelle wieder entfernt werden.

### Quelle entfernen (C2)
**Titel:** Quelle entfernen
**Text:** Löst nur die Verknüpfung zwischen dieser Quelle und dem Wissensobjekt — das Wissen selbst, sein Status und sein Vertrauen bleiben unverändert. Sinnvoll bei veralteten, doppelten oder versehentlich angehängten Belegen.

### Quelle/Beitrag melden (C8)
**Titel:** Beitrag oder Fundstelle melden
**Text:** Du kennst eine Ergänzung, Korrektur oder Fundstelle, willst aber nicht selbst am Objekt arbeiten? Beschreibe sie hier — dein Hinweis wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Anders als „Quelle hinzufügen" entsteht dabei KEIN Quellen-Eintrag; es ist eine Nachricht an die Menschen, kein Beleg am Objekt.

## Offene Punkte für Pedis Review

1. Stimmt die „du"-Anrede (App-Ton) — oder lieber „Sie" für Pilotkunden?
2. „Ziel n"-Formulierung bei Freigeben: soll der Text das Quorum konkret benennen (z. B. „2 von 2")? Technisch möglich, macht den Text dynamisch.
3. B1-Inkonsistenz (Detail ohne Pflicht-Feedback) — Texte oben beschreiben das SOLL (Pflicht-Kommentar); wenn die Angleichung nicht im selben Slice kommt, muss der B1-Text abgeschwächt werden. Entscheidung siehe Inventur-Frage.
4. Länge: bewusst 3–5 Sätze je Text (Ticket: „AUSFÜHRLICH") — zu lang? Kürzungsfreigabe genügt mir als Kommentar.
