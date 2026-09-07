# Klara im Browser · B0 und späterer Rückweg

Stand: JOB 3203, Runde 2, Paket 0.1.1. Grundlage sind Pedis Entscheidung 47 und die Anlagen `KLARA-BROWSER-KONZEPT-1.md` und `KLARA-BROWSER-POC-AUFTRAG-1.md`, einschließlich der Präzisierung vom 07.09.2026, 04:32. Diese Produktfassung berichtigt die Perplexity-Beschränkung der ersten Runde.

B0 erfasst bewusst markierten Klartext auf normalen HTTP(S)-Webseiten: technische Erklärungen, Drucker- und Schnittstellenanleitungen sowie KI-Chats. Perplexity ist ein Beispiel. Nach einer Vorschau mit vollständigem Text, Titel, Kontext, tatsächlicher Domain/URL, Seitentitel, Zeit und Vertraulichkeitswahl bestätigt der Mensch die Übernahme als ungeprüften Klarwerk-Entwurf. Er öffnet ihn über den bestehenden Frontdoor-Link und findet den vollständigen Inhalt wieder.

Der vorhandene Weg bleibt ein einziger: Nutzeraktion → einmaliges Inhaltsskript unter `activeTab` → Service Worker → Erweiterungsansicht → bestehende Bearer-Anmeldung → `POST /api/drafts` → `/capture/frontdoor?draft=…`. Quellenfelder nennen die tatsächliche Herkunft. `bodyHtml` bewahrt den maskierten Originaltext samt Kontext und Herkunft; die serverseitig gekürzte Kernaussage und der kurze Quellenauszug sind kein Volltextspeicher. Weder Erfassung noch Speicherung ruft ein Modell auf, validiert oder veröffentlicht Wissen.

Das Kontextmenü erscheint für HTTP(S)-Auswahl, ohne dauerhaften Zugriff auf fremde Seiten. Der einzige dauerhafte Hostzugriff gilt `https://app.klarwerk.ai`. Keine Anbieterparser, Vollseitenfreigabe, Hintergrundarchivierung oder allgemeine Netzweiterleitung. Browser-Systemseiten, Dateien, Rahmen und Sonderdarstellungen sind kein Universalimport. Auswahl und Sitzung bleiben flüchtig; Browserneustart kann sie löschen. Ein unklarer Speicherausgang bleibt unklar, bis die Anlage bestätigt ist; eine unveränderte Wiederholung nutzt denselben kontogebundenen Vorgangsschlüssel.

Klara bleibt ein zusätzlicher Zugang zu Klarwerk, mit derselben Ablage und denselben Rechten. Eine Herstellerseite oder ein KI-Chat ist Herkunft, kein unabhängiger Faktenbeleg. Fehlende Vertraulichkeit bleibt offen und erlaubt keine Weitergabe. Ein eigener Weblogin kann zum Öffnen nötig sein; Token gelangen niemals in Quellen, Seiten-DOM oder Links.

## Bidirektionaler Ausbau · geplant, nicht Teil von B0

| Stufe | Nutzen | Voraussetzung |
| --- | --- | --- |
| B1 | Komfort für einzelne Chat-Anbieter | Generische Textauswahl gehört bereits zu B0; automatische Antworterkennung braucht eigene Abnahme. |
| B2 | Frage, Antwort, Zitate und Gesprächsausschnitte zusammen bewahren | Zusammengehörigkeit und Herkunft sichtbar prüfen; keine automatische Komplettarchivierung. |
| B3 | Firmenwissen in einem ausgewählten externen Chat nutzen | Vorab-Freigabe für konkreten Empfänger, Nutzer, Inhalt und Version anhand aktueller Serverrechte; unbekannt sperrt. Lesen oder Exportieren allein genügt nicht. |
| B4 | Weiterentwickelte Ergebnisse nach Klarwerk zurückführen | Ausgangswissen verknüpfen, neue Schlussfolgerungen unterscheiden und erneut prüfen; Konflikte und Dubletten sichtbar behandeln. |
| B5 | Bilder, Videos und komplexe Anleitungen einbeziehen | Originalbezug, Nutzungsrechte und Qualität der Extraktion gesondert prüfen. |

Der spätere Rückweg führt erst nach empfängerbezogener Freigabe aus Klarwerk in den externen Chat. Bereits das Einfügen kann Wissen offenlegen. Ziel- oder Inhaltswechsel entwertet eine Freigabe. B0 implementiert diesen Weg nicht und übermittelt kein Klarwerk-Wissen an fremde Webseiten.

Die lokale Lieferung ist **TEILWEISE abgenommen**: DOM- und API-Prüfungen ersetzen nicht den echten Chrome-Rundweg auf Perplexity und zwei technischen Seiten, davon einer strukturierten Anleitung. Paketinstallation, DE/EN, Tastaturbedienung und Wiederöffnen mit Testkonto sind im [Abnahmeplan](README.md#noch-ausstehende-echte-abnahme--required-live-acceptance) konkret beschrieben. Keine Web-Store-Veröffentlichung, kein Word-Umbau, keine zweite Web-App und keine Backend-Herkunftserweiterung.
