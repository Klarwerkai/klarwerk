# Persönlicher Arbeitsüberblick

In Klara öffnet **Mein Arbeitsüberblick** die eigenen offenen persönlichen Aufgaben,
anstehenden oder pausierten Erinnerungen, Notizen und wartenden Entscheidungen aus
Erinnerungsläufen und dem vorhandenen Kalenderabgleich. Bewusst übernommene Erinnerungen
erscheinen mit ihrem berechtigten reduzierten Inhalt. Fremde private Bestände werden nicht
hinzugemischt. Die Hilfe nennt den erfassten Entscheidungsumfang ausdrücklich.

**Aktualisieren** liest dieselben bestehenden persönlichen APIs unter der aktuellen Sitzung.
Eine erledigte Aufgabe verschwindet aus der offenen Liste; geänderte Termine zeigen den
neuen lokalen Zeitpunkt mit der ursprünglichen IANA-Zeitzone. Ein tatsächlicher Leerbestand
und ein fehlgeschlagener Abruf haben verschiedene Anzeigen. Bei einer nicht lesbaren
Entscheidungsquelle steht ausdrücklich, dass die Liste unvollständig ist.

Aufgaben und Erinnerungen öffnen ihre bestehenden Originalansichten mit derselben Kennung.
Notizen öffnen den bestehenden Klara-Editor und werden dort mit ihrer Fassung bearbeitet.
Der Kalenderverweis fokussiert die ursprüngliche Zuordnung nach deren Laden; er trifft noch
keine Entscheidung. Ein erkannter Wechsel des bestehenden Rechtekontexts verwirft Listen
und verspätete Antworten; erneutes Öffnen liest neu.

Die Fläche ist eine Ansicht, keine neue Aufgabenablage und kein neuer Scheduler. Es gibt
keinen Hintergrundtakt, keinen Modellaufruf und keine externen Schreibaktionen beim Öffnen.
Nicht enthalten sind eine Behauptung aller denkbaren Entscheidungsarten oder Ergebnisse
fehlender Kalenderprovider. Der Dienst- und Veröffentlichungspfad der Originalobjekte gilt
weiter. Die Änderung ergänzt keine Datenbanktabellen; Rücknahme erfolgt durch Rücknahme
des begrenzten Commits ohne Änderung der gespeicherten Originalobjekte.

Prüfung: `tests/klara-arbeitsueberblick/ueberblick-am-server.test.tsx` benutzt die echte App
über app.inject und tatsächliche Konten; nur Transport/gezieltes Rechteereignis werden
kontrolliert. `tests-smoke/klara-arbeitsueberblick-browser.spec.ts` fährt Anmeldung, Lesen,
Originalnotiz-Bearbeitung und Originalaufgaben-Erledigung im isolierten Chromium. Der
Fehlerfall speist ausdrücklich eine Netzwerkstörung ein. Das ersetzt keine Office- oder
Providerabnahme und keine unabhängige Produktionsfreigabe.
