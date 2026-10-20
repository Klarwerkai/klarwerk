# Private Besprechungsaufbereitung (Klara 15)

In „Meine Funktionen → Meine Notizen“ importiert die Person eine bereitgestellte Notiz oder berechtigte VTT-Datei. Optional wird das Originalaudio als persönliches Objekt mit Zweck `klara_audio` hochgeladen. Diese Bytes lesen ausschließlich die eigene Person und ihr ausdrücklich erlaubter Verarbeitungspfad; weder eine Verwaltungsrolle noch eine interne Schutzstufe öffnet sie anderen.

Die Aufnahmeberechtigung gilt nicht als gemeinsamer Freigabeauftrag. Ein Text-/VTT-Import funktioniert ohne Recorder und ohne Modell. Audio ohne VTT wird nur mit ausdrücklichem Verarbeitungsauftrag und aktiver vorhandener KI-Regel an den bestehenden Transkriptionsdienst gereicht. „Keine KI“ sperrt diesen Schritt auch für einen lokalen Transkriptionsdienst. Ein Anbieterausfall startet keinen anderen Anbieter.

Der vorhandene Whisper-/kompatible lokale Adapter kann `verbose_json` mit Segmentzeitwerten anfordern. Es werden ausschließlich tatsächliche `segments.start/end/text` übernommen. Fehlende, doppelte und ungültige Zeitsegmente werden abgewiesen; ein bloßer Textblock bekommt keine erfundenen Zeitwerte. Quelle für dieses Format: [offizielle OpenAI-Dokumentation, Zeitstempel](https://developers.openai.com/api/docs/guides/speech-to-text#timestamps), gelesen am 20.10.2026. Der konfigurierte Anbieter und das Modell werden dadurch nicht gewechselt. Eine Adapterprobe mit kontrollierter Antwort ist ausdrücklich kein tatsächlicher ASR-Erkennungsnachweis.

Die Auswertung kopiert die Quellenstellen und trennt ausdrücklich gekennzeichnete `Beschluss:`, `Entscheidung:`, `Vorschlag:`, `Abgelehnt:`, `Verworfen:`, `Widerspruch:`, `Offen:`, `Frage:` und `Aufgabe:`. Ungekennzeichnete, mehrdeutige, verrauschte oder überlappende Inhalte bleiben Klärung. Dies ist eine deterministische manuelle Kennzeichnung, keine KI-Zusammenfassung und keine unabhängige semantische Referenzbestätigung. Sprecherangaben aus der VTT bleiben Importangaben; aus einer Stimme wird keine Person abgeleitet.

Zeitstellen binden private Notiz, Transkriptfassung, Segment und echte Start-/Endzeit; ohne Zeitwerte bleibt die Quellzeile sichtbar. Bei verbundenem Originalaudio führt die Wiedergabe zur Zeitstelle. Eine Hörfehlerkorrektur erzeugt eine neue private Notizfassung mit Rückverweis. Der alte Wortlaut bleibt unverändert. Generisches Überschreiben einer Quelltranskript-Notiz ist gesperrt; Korrekturen gehen über den Fassungsweg.

Die Person wählt Ergebnisse aus und kann Folgeaufgaben ausdrücklich selbst übernehmen. Fehlende Meetingzuständigkeit bleibt damit ungeklärt: die eigene Zuständigkeit ist eine bewusste neue Nutzerentscheidung, keine aus dem Meeting erfundene Zuweisung. Aufgaben landen in der vorhandenen persönlichen Aufgabenablage, die Übergabe in der vorhandenen privaten Notizablage. Doppelklick und erneute Verarbeitung verwenden stabile Vorgänge. Bei einer Korrektur bleibt eine vorhandene Aufgabe erhalten; Abweichungen werden gemeldet und manuelle Änderungen nicht überschrieben. Die Übergabenotiz kann danach über F08 bewusst gemeinsam übernommen werden.

Privates Löschen einer Quellbesprechung entfernt ihre privaten Fassungen, Übergaben, gebundenen Aufgaben und hochgeladenen privaten Audioobjekte. Ein Quellenentzug sperrt nachfolgende Ausgabe und die gebundenen Aufgabenwege. Eine schon eigenständig bewusst übernommene Firmenfassung bleibt im bestehenden Firmenwissensweg; persönlicher Gedächtniswiderruf ist keine Firmenlöschung.

## Bestehende Schnittstellen

- `POST /api/me/klara/besprechungen/import`: `titel`, `berechtigt:true`, `text` oder `vtt`, optional `audioId`, `transkription:true` für tatsächliche Audiotranskription, `meetingDatum` mit tatsächlichem Offset, `zeitzone`, `meetingId`, `vorherigeNotiz` und Herkunftsweg. Ohne ID bindet der Server die gewählte Quellfassung; Wiederholung legt keine zweite Passage an. Rückgabe nennt `notiz`, `ergebnisse`, tatsächlichen Verarbeitungsstand/ASR-Weg und offenen Fristenanschluss.
- `POST /api/me/klara/besprechungen/:notizId/lesen`: aktuelle berechtigte private Quellfassung und Ergebnisse.
- `POST .../:notizId/korrektur`: aktuelle `fassung`, `segmentId`, korrigierter `text`; neue Transkriptfassung mit altem Original.
- `POST .../:notizId/uebernehmen`: aktuelle `fassung`, `bewusst:true`, ausgewählte Segmentkennungen in `auswahl`, optional `eigeneAufgaben:true`. Tatsächliche Aufgaben-/Notizkennungen und Abweichungen werden zurückgelesen.
- `GET .../:notizId/audio`: eigene Originalbytes mit `no-store, private`.
- `DELETE /api/me/klara/notizen/:notizId`: bestehender persönlicher Löschweg einschließlich der privaten Besprechungsableitungen; keine Firmenlöschung.

## Offene Originalgrenzen

D’s freigegebener Fristen-/Normanschluss ist noch nicht konkret gebunden. Meetingdatum und Zeitzone bleiben erhalten; es werden hier keine relativen Fristen erfunden, keine Normphase als fachliche Ablösung ausgegeben, keine Kalendertermine/Erinnerungen angelegt und keine Außenaktionen ausgelöst. Die Originalkriterien BPA-09-AC03–09 bleiben bis zum tatsächlich gelieferten und geprüften Anschluss einzeln offen.

Ein tatsächlicher erlaubter ASR-/Hörnachweis an gesprochener synthetischer Aufnahme, modellbasierte Sprechertrennung, vollständige semantische Referenzprüfung, persistente Segment-Teiljobs mit Pause/Abbruch/Wiederanlauf und der aktive Transportabbruch nach Rechte-/KI-Entzug sind noch nicht vollständig belegt. Ausgabe nach beobachtetem Quellentzug wird verworfen; das ist kein Nachweis, dass bereits laufender Providertransport gestoppt wurde. Kosten und Erkennungsqualität werden nicht erfunden. Ein altes Backup nach späterer Privatlöschung braucht weiterhin den tatsächlichen produktiven Löschmarken-/Restoreweg. Auch Audioaufbewahrung und Einbindung in den produktiven Referenz-/Waisensweep sind nicht aus einem synthetischen Kurztest abgenommen.

Diese Grenzen sind Teil der Kriterienbilanz und keine Freigabe zur produktiven Aktivierung einer unbewiesenen Automatik. Die Führung verwendet die bestehende unabhängige Prüferrolle und den normalen Integrations-/Veröffentlichungsweg.
