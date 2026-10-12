# Klara: vom Nachschlagen zur Führung (Konzept zu R-1038)

Auftrag `aufnahme:20260922:gesamt-hilfen`, Anliegen **R-1038**: „Ein weiterführendes
Assistenten-Konzept soll Klara über das reine Nachschlagen hinaus zur Führung ausbauen.“

Dies ist ein **Konzept**. Es beschreibt keinen gebauten Zustand. Was heute schon gebaut ist, steht in
Abschnitt 1 mit Fundstelle. Alles danach ist Vorschlag mit eigenem Abnahmesatz. Entscheidungen, die
nur das Produkt treffen kann, sind in Abschnitt 5 als offen markiert und hier **nicht** getroffen.

**Herkunft.** Laut Quelle war das Konzept als Berater-Lieferung 4 vorgesehen, „zurückgestellt bis
Bibliothek steht“. Die Bibliothek (R-0890) liegt jetzt in `apps/web/src/lib/hilfeBibliothek.ts`
vor. Eine Lieferung 4 liegt im Repository nicht vor; dieses Konzept ersetzt sie nicht stillschweigend,
sondern ist der Arbeitsstand aus dem Auftrag heraus.

## 1. Ausgangslage: was Klara heute kann (Nachschlagen)

| Fähigkeit | Fundstelle |
|---|---|
| „Du bist hier“: Erklärung der aktuellen Seite | `components/KlaraAssistant.tsx` (`pageEntryFor`), `lib/klaraRegistry.ts` (`KLARA_PAGES`) |
| Aktives Element: Erklärung zum fokussierten `data-help`-Anker | `KlaraAssistant.tsx` (`focusin`-Verfolgung), `lib/captureHelp.ts`, `lib/reviewHelp.ts` |
| Zeige-Modus: Element antippen, Klara erklärt es, ohne die Aktion auszulösen | `KlaraAssistant.tsx` (Capture-Listener) |
| Konkretes Beispiel zur Elementerklärung (R-0941) | `lib/klaraBeispiele.ts`, angezeigt und mit vorgelesen in `KlaraAssistant.tsx` |
| Markierung erklären | `KlaraAssistant.tsx` (`explainSelection`) |
| Vorlesen auf Wunsch | `KlaraAssistant.tsx` (`speakButton`), `lib/vorlesen.ts` |
| Tolerante Suche mit Synonymen über alle Hilfetexte und FAQ | `lib/klaraRegistry.ts` (`searchKlara`, `KLARA_SYNONYMS`, `allFaqEntries`) |
| KI-Antwort nur aus Hilfe-Schnipseln; ohne Grundlage keine Antwort | `KlaraAssistant.tsx` (`aiNoGrounding`) |
| Aufklappende Fläche, Fokus hinein, bedingte Rückkehr (R-0942) | `KlaraAssistant.tsx` |

Alle diese Fähigkeiten **beantworten** eine Frage. Keine führt durch eine Aufgabe.

## 2. Ziel: Führung

Führung heißt hier: Klara sagt nicht nur, *was* ein Element ist, sondern *was als Nächstes sinnvoll
ist* — für diese Person, auf dieser Seite, mit ihren Rechten — und bringt sie dorthin. Klara
**handelt nicht selbst**: Sie öffnet Wege, sie löst keine Aktion aus (dieselbe Regel wie der
Zeige-Modus, der Klicks abfängt statt sie auszuführen).

## 3. Bausteine

Jeder Baustein nutzt vorhandene Inhalte. Keiner braucht ein Sprachmodell; mit Modell kann die
Formulierung freier werden, die Grundlage bleibt dieselbe.

**F1 · Nächster Schritt je Seite.** Die Hilfekapitel enden mit „Nächster Schritt: …“
(`help.<id>.body`). Klara zeigt diesen Satz unter „Du bist hier“ als eigene Zeile mit dem Link,
den das Kapitel ohnehin trägt (`HELP_TOPICS[].to`).
*Abnahme:* Auf jeder Seite mit Kapitel steht unter der Seitenerklärung genau ein nächster Schritt;
sein Link führt auf eine Route, die die Rolle betreten darf (`routePathAllows`).

**F2 · Geführte Wege.** Die Einstiegsführung der Hilfeseite (`lib/pilotChecklist.ts`, Karte auf
`/hilfe`) wird in Klara als Weg angeboten: „Dein erster Arbeitsweg: Schritt 2 von 5“. Klara merkt
sich den Fortschritt nur im Browser, nicht auf dem Server.
*Abnahme:* Ein begonnener Weg zeigt nach einem Seitenwechsel den passenden nächsten Schritt; ein
gesperrter Schritt nennt die nötige Rolle statt eines Links (wie heute auf `/hilfe`).

**F3 · Vertiefung aus der Bibliothek.** Zu einer Seiten- oder Elementerklärung bietet Klara den
Bibliotheksartikel derselben Funktion an (`lib/hilfeBibliothek.ts`) — gezielt den Teil, der zur
Lage passt: „Was passiert danach?“ nach einer Handlung, „Typische Missverständnisse“ bei einer
Rückfrage.
*Abnahme:* Für jede Seite mit Kapitel erreicht man aus Klara mit einem Klick den Artikel; der
angezeigte Teil stammt wörtlich aus dem Artikel.

**F4 · Lage erkennen, ohne zu raten.** Klara liest nur, was die Seite ohnehin zeigt — wie heute
schon den gezeichneten Objektstatus (`lib/statusFreigabe.ts`, `objektstatusAus`). Daraus wird ein
Hinweis wie „Dieser Eintrag ist in Prüfung — validiert ist er erst nach genug Freigaben.“
*Abnahme:* Jeder Hinweis nennt die Stelle, aus der er gelesen wurde; ohne lesbare Lage gibt es
keinen Hinweis.

**F5 · Ehrliche Grenze.** Findet Klara keinen nächsten Schritt, sagt sie das und nennt den
Supportweg der Installation (`api/support.ts`, Karte auf `/hilfe`).
*Abnahme:* Es gibt keinen Zustand, in dem Klara einen Schritt erfindet.

## 4. Reihenfolge

1. F1 und F5 — kleinster Schritt, nur vorhandene Texte.
2. F3 — die Bibliothek ist jetzt vorhanden.
3. F2 — braucht die Fortschrittsablage im Browser.
4. F4 — je Fläche einzeln, nur wo die Seite ihre Lage lesbar auszeichnet.

## 5. Offene Entscheidungen (nicht hier getroffen)

- Darf Klara sich ungefragt melden (etwa beim ersten Besuch einer Seite), oder nur auf Klick? Heute
  öffnet Klara nur auf Klick.
- Soll der Fortschritt eines geführten Wegs geräteübergreifend gelten (Serverablage, Datenschutz)?
- Soll Klara mit KI frei formulierte Führungssätze sagen dürfen, oder nur die Hilfetexte?
- Gilt Führung auch in Klara in Word? Der Web-Einstieg „Klara in Word“ ist eine Vorschau (N-0042);
  ein Word-Auftrag ist ausdrücklich nicht Teil dieses Auftrags (P-UX-16).

## 6. Grenzen dieses Konzepts

- Es ist nicht mit Anwendern erprobt; eine Nutzerprobe mit echten Erstnutzern steht aus.
- Es baut auf Texten auf, deren Wahrheit am Quelltext geprüft ist (Hilfekapitel, Kurzhilfen,
  Bibliothek). Ändert sich eine Fläche, muss der zugehörige Text mitziehen — wie heute.
