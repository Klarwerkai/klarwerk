# Persönliches bewusst in Wissen übernehmen (Klara 08)

Die persönliche Notiz bleibt unverändert und privat. Unter „Meine Funktionen → Meine Notizen“ lässt sich ein gewählter berechtigter KI-Chatabschnitt mit Projekt, Antwortfassung, tatsächlich vorhandenen Herkunftsangaben und getrennten Aussagearten privat importieren. Es wird kein Chatkonto ausgelesen. Andere Abschnitte werden nicht geladen. Ein korrigierter Import erhält eine eigene Fassung und kann auf die vorherige persönliche Notiz zeigen.

An der gespeicherten Notiz öffnet „Bewusst als Wissen übernehmen“ die Zielwahl. Artikel und Space sind unterschiedliche Ziele. Sichtbarkeit, Kategorie, Bedingungen und eine verfügbare Vorlage werden bewusst gewählt; offene Fragen bleiben offen. Die eigene Person ist für den neuen Beitrag verantwortlich. Ein Beitrag ist zunächst fachlich offen, keine automatische Validierung.

Der bestehende Referenzdienst prüft gebundene Aussagen gegen tatsächlich aufgelöste Passagen und die heutige Quellfassung. Ein Link allein ist kein Beleg. Ohne verfügbaren unabhängigen Prüfer bleibt die Prüfung offen. Importangaben zu Anbieter/Modell sind Herkunftsangaben des ausgewählten Exports, keine unabhängig verifizierte Anbieteridentität. Eine bearbeitete Importnotiz kann keine alte Aussagezuordnung als aktuelle Fassung übernehmen.

## Schnittstelle für F15, E und G

Alle Wege verwenden die authentifizierte Person aus der Sitzung. Ein fremdes persönliches Original ist 404; ein Quellrechteentzug sperrt das abgeleitete private Original auch beim Nachschlagen, Suchen und Weiterverarbeiten.

- `POST /api/me/klara/wissen/import`: `{titel, inhalt, projekt, abschnitt, antwortFassung, anbieter?, modell?, vorherigeNotiz?, aussagen:[{text, art, quellen:[{id, fassung}]}]}`. Aussagearten: `behauptung`, `empfehlung`, `kreativ`, `nutzerentscheidung`. Jeder Wortlaut muss im ausgewählten Text stehen. Rückgabe: private `notiz`, `wiederholt`. Keine Benennung einer tatsächlichen Nutzerperson aus KI-Inhalt.
- `GET /api/me/klara/wissen/ziele`: aktuell berechtigt les- und beschreibbare Spaces. Eine Liste ist keine dauerhafte Schreibfreigabe.
- `POST /api/me/klara/notizen/:id/wissen/pruefen`: frische Quellenauflösung und vorhandener Referenzdienst; Ergebnis und Deckung sind getrennt. Es wird kein neuer Prüfer/Anbieter eingerichtet.
- `POST /api/me/klara/notizen/:id/wissen/vorschau`: `{fassung, ziel:{art:"artikel"|"space", spaceId?, confidentiality, type, category, conditions, vorlage?:{id,version}}}`. Die Antwort bindet Originalfassung, Inhalt, Herkunft, Ziel-/Spacefassung und aktuelle Kontoregel in `stempel`. Unbekannte Details werden nicht erfunden.
- `POST /api/me/klara/notizen/:id/wissen/uebernehmen`: dieselbe `{fassung,ziel}`, der exakt gesehene `stempel`, `bewusst:true`. Keine Ausführung aus fremdem Quelltext. Die Antwort enthält den tatsächlich zurückgelesenen `beitrag:{id,version,status,spaceId,verantwortlich,ruecklink}` und `wiederholt`.

Die tatsächliche Erstanlage und ihre Dublettenabwehr liegen im vorhandenen `KoService`. Ein serverseitig geprüfter führender Space wird bereits mit dem ersten Objektinsert gesetzt; es entsteht kein zwischenzeitlich breiter sichtbarer Beitrag. Space/Vorlagenprüfung und Zuordnung nutzen dieselbe bestehende Space-Sperre und denselben Vorlagenport. Pro privater Notizfassung wird genau ein Übernahmevorgang verwendet, auch bei geändertem Ziel oder verlorener Antwort. Ein anderer Inhalt unter demselben Vorgang wird abgewiesen.

Persönliches Gedächtnis ist keine Firmenwissensquelle. Erst die ausdrückliche Übernahme begründet eine eigenständige gemeinsame Fassung. Die Löschung des privaten Originals löscht keinen bereits bewusst übernommenen Firmenbeitrag; dessen fachliche Prüfung, Berechtigung, Aufbewahrung und Löschung folgen dem vorhandenen Wissensweg. Dieser Baustein richtet kein zusätzliches Gedächtnis, keinen Kalender oder Scheduler ein.

## Nachweisgrenzen

Gezielte API-, PostgreSQL-/Neustart-/DumpRestore- und Chromium-Prüfungen verwenden ausschließlich synthetische Konten und Daten. Das ist keine persönliche Mac-/Diktat-/Word-Bedienprobe und kein tatsächlicher produktiver Modell-/Referenzprüferlauf. Eine Rücksicherung eines älteren Backups nach späterer Privatlöschung benötigt weiterhin den vorhandenen produktiven Löschmarken-/Restoreweg; aus einem Restore innerhalb eines synthetischen Prüfbestands folgt diese Zusage nicht. Unabhängige Prüfung, Integration, Veröffentlichung und Livebeleg übernimmt die Führung am fest gebundenen Kandidaten. Die 20 Originalkriterien bleiben vollständig erhalten.
