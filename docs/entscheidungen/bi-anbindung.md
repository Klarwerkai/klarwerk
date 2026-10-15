# R-0770 / R-2193 · Fremde BI-Werkzeuge — ausgeschlossen ist die Anbindung, nicht die eigene Auswertung

*Aufnahme 20260922 · gesamt-bi-anbindung (`aufnahme:20260922:gesamt-bi-anbindung`, Revision 1).
Abgleich auf Basis `81f9152d1` (Fassung `1.0.0-beta.1.952`). Diese Seite ordnet die frühere
Entscheidung den Originalpunkten zu und hält die offene Umfangsfrage fest; sie ändert weder deren
Wortlaut noch die Kriterien des Auftrags und trifft keine neue Entscheidung.*

## Die Quellen, wörtlich und unverändert

| Quelle | Wortlaut | Stand |
| --- | --- | --- |
| Originalpunkt R-0770 (Alias F-0770, Bereich Wissen) | „Eigene Auswertungen ueber angebundene Business-Intelligence-Werkzeuge Dritter sind ausdruecklich nicht Teil der ersten Fassung." | Registerzustand `verworfen`, Prüfstatus `geprueft`, aktualisiert 05.09.2026; Herkunft 14.06.2026 |
| Notiz zu F-0770 (Altbestand) | „Ausgeschlossen ist die Anbindung fremder Werkzeuge, nicht die eigene Auswertung; der Datei-Export bleibt der offene Weg nach aussen." | Klarstellung des früheren Registers |
| Begründung zu F-0770 | „Begruendung nicht dokumentiert - im Pflichtenheft als ausserhalb des Umfangs und in der Modulbeschreibung als Nicht-Ziel gefuehrt." | — |
| Originalpunkt R-2193 (Alias REVIEW:B3:126) | „Native Store-Apps, weitergehende Drittsystem-Konnektoren, Selbstbedienungs-Mandanten, erweiterte BI, Gamification" — „**Bewusst außerhalb v1.**" | Registerzustand `verworfen`, aktualisiert 05.09.2026; Hinweis: „Gilt nur für den im Wortlaut genannten Umfang beziehungsweise v1; kein generelles Verbot späterer Erweiterung." |
| Pflichtenheft §1 (`specs/reference/Pflichtenheft.md:15-16`) | „**Out of Scope** (Stand v1, siehe §6): … BI-Dashboards Dritter." | Im Arbeitsbaum unverändert vorhanden |
| Pflichtenheft §6 (`specs/reference/Pflichtenheft.md:236-239`) | „Native Store-Apps; Drittsystem-Konnektoren über JSON hinaus; Self-Service-Mandantenprovisionierung; erweiterte BI; Gamification (ausdrücklich nicht erwünscht)." | Im Arbeitsbaum unverändert vorhanden |
| Modulbeschreibung Bibliothek & Auswertung (`specs/stories/library-analytics.md:46-47`) | „Nicht-Ziele (v1): Erweiterte BI/Drittanbieter-Dashboards (Out of Scope §6)." | Im Arbeitsbaum unverändert vorhanden |

Eine jüngere Nutzerentscheidung zu BI-Werkzeugen ist in den Auftragsquellen nicht zugeordnet. Der
Hinweis zu R-0770 lautet ausdrücklich: „Dokumentierte frühere Entscheidung; nur im zitierten
Umfang. Kein neuer Klick von Pedi."

## Die geltende Einordnung (K2)

Der Satz von R-0770 ist missverständlich: „Eigene Auswertungen" meint Auswertungen, die ein Betrieb
selbst **in einem fremden BI-Werkzeug** baut, das an KLARWERK angebunden ist. Mit der Notiz gilt:

- **Ausgeschlossen (v1):** die Anbindung fremder BI-Werkzeuge und Drittanbieter-Dashboards — also
  ein Zugang, über den ein fremdes Werkzeug Kennzahlen oder Auswertungsdaten laufend aus KLARWERK
  zieht oder in KLARWERK einbettet.
- **Nicht ausgeschlossen:** KLARWERKs eigene Auswertung in der Anwendung.
- **Offener Weg nach außen:** der Datei-Export. Was ein Betrieb mit einer exportierten Datei in
  seinem eigenen Werkzeug tut, liegt außerhalb von KLARWERK und ist von der Sperre nicht berührt.

## Abgleich mit dem heutigen Stand (Quelleninspektion dieses Arbeitsbaums)

| Teil | Stand | Herkunft (gesonderter Auftrag / Lieferung) |
| --- | --- | --- |
| Eigene Auswertung | `/analytics` mit Wissenskennzahlen (`GET /api/wissenskennzahlen`, `users.manage`), Bestandsauswertung `GET /api/analytics` und `GET /api/analytics/busfactor` (`ko.read`, mit Sichtbarkeitsfilter), Expertenzuordnung `GET /api/analytics/expertise` hinter Schalter (Vorgabe aus) — `services/app/src/routes/library-routes.ts` | ADMIN-11 `produkt:20261009:admin-wissenskennzahlen` (`docs/entscheidungen/admin-11-wissenskennzahlen.md`) und frühere Bibliotheksaufträge |
| Datei-Export der Auswertung | „Als CSV exportieren" auf der Kennzahlenfläche: Stand, Zeitraum, Auswahl, je Kennzahl Wert, Lage, Zähler, Nenner, Erhebungsbeginn, Trend — keine Titel, keine Fragetexte (`apps/web/src/lib/wissenskennzahlen.ts`, `kennzahlenCsv`) | ADMIN-11 |
| Datei-Export des Wissens | `GET /api/library/export` in den Formaten json, markdown, mediawiki, html und paket (`apps/web/src/lib/libraryExport.ts`) | SCRUM-135, `produkt:20261010:poc-wiederherstellung-export` |
| Maschinenzugang (Dienst-Schlüssel) | Genau acht Routen in `DIENST_ROUTEN` (`services/app/src/dienst-schluessel.ts`): Fragen, Textprüfung, Wissensexport (nur validiert, nicht vertraulich), Kandidatenimport, zwei Statuswege, MCP. **Keine** Auswertungs- oder Kennzahlenroute. Der MCP-Zugang bietet nur das Werkzeug `klara_fragen`. | `gesamt-integrations-api` (R-0677/R-0688/R-0704/R-0698/R-0696/R-0712), `gesamt-mcp` (R-0713) |
| BI-Anbindung | Kein Konnektor, kein Einbettungsweg, kein Dienst-Recht für Auswertungen; in `services/` und `apps/web/src/` kein Bezug auf ein BI-Produkt (Power BI, Tableau, Metabase, Looker u. ä.) | — (ausgeschlossen) |

Die Grenze ist damit heute eingehalten: Kennzahlen verlassen KLARWERK nur als vom Menschen
ausgelöste Datei. Der Wissensexport über Dienst-Schlüssel ist eine bereits gelieferte
Integrationsschnittstelle für Inhalte, keine BI-Anbindung; er gehört nicht zu diesem Auftrag.

Gehalten wird die Grenze von `tests/bi-anbindung/keine-bi-anbindung.test.ts` (kein Dienst-Recht,
keine Dienst-Route, kein Vertragseintrag und kein MCP-Werkzeug für Auswertungen; kein fremdes
BI-Produkt in `services/` und `apps/web/src/`; Klarstellung in Seite und Modulbeschreibung).
`tests/admin-wissenskennzahlen/anzeige-und-export.test.ts` prüft den CSV-Export der eigenen
Auswertung, `tests/library/library-export.test.ts` die Exportformate. Zusätzlich legt
`tests/security/rechte-schalter-inventar.test.ts` je Dienst-Recht genau seine Routen fest; dieselbe
Datei ist auf der Basis `81f9152d1` in ihrem unabhängigen Abschnitt R-1136 (Funktionsschalter
`KLARWERK_VORFUEHRUNG_ANONYM`, `KLARWERK_TLS_PFLICHT` nicht verzeichnet) rot — ein fremder,
von dieser Lieferung unveränderter Basisfehler.

## Die offene Umfangsfrage (K1)

Offen ist **nicht**, ob v1 eine BI-Anbindung hat — das ist entschieden: nein. Offen ist, was **nach
v1** gilt. R-2193 sagt ausdrücklich, der Ausschluss sei „kein generelles Verbot späterer Erweiterung";
der Auftrag nennt das Ziel „Erweiterte Auswertungen über fremde BI-Werkzeuge konkretisieren".

Mögliche Alternativen, ohne Wertung als Entscheidung:

1. **Dauerhaft beim Datei-Export bleiben.** Kein Maschinenzugang zu Kennzahlen; Betriebe führen
   CSV-/JSON-Dateien selbst in ihr Werkzeug ein. Kein zusätzlicher Bau.
2. **Lesender Kennzahlenzugang über die vorhandene Integrationsschnittstelle.** Ein neues
   Dienst-Recht (etwa für `GET /api/wissenskennzahlen` ohne Titel und Fragetexte) mit eigener Grenze,
   Protokoll und OpenAPI-Eintrag. Wäre eine Anbindung fremder Werkzeuge und damit eine Aufhebung der
   v1-Sperre.
3. **Fertige Anbindung an ein bestimmtes BI-Produkt** (Konnektor oder eingebettetes Dashboard). Größter
   Umfang; braucht zusätzlich die Wahl des Produkts.

Für 2 und 3 wäre vorher zu klären: welche Kennzahlen hinausgehen dürfen (keine Fragetexte, keine
Personen; die Expertenzuordnung ist nach `library-routes.ts` erst nach Freigabe durch Betriebsrat und
Datenschutz scharf), welche Rolle den Zugang freischaltet und ob er je Instanz abschaltbar ist.

**Noch erforderliche Entscheidung:** ob und in welcher der drei Formen nach v1 ein Zugang für fremde
BI-Werkzeuge entsteht. Sie liegt bei Pedi. Bis dahin gilt die frühere Entscheidung im zitierten
Umfang. Eindeutig bestellt und mit dieser Seite umgesetzt ist nur die Dokumentation von Grenze,
Stand und offener Frage — kein Bau.

## Abgrenzung

- R-2193 ist zugleich den Aufträgen `gesamt-adoption`, `gesamt-anlagendaten-abgleich`,
  `gesamt-chat-import`, `gesamt-email-eingang`, `gesamt-instanztrennung` und `gesamt-native-apps`
  zugeordnet. Diese Seite behandelt davon nur „erweiterte BI"; Store-Apps, Konnektoren,
  Selbstbedienungs-Mandanten und Gamification bleiben dort.
- Eigene Auswertung (ADMIN-11), Wissensexport und Integrationsschnittstelle sind gesonderte, bereits
  gelieferte Aufträge; sie werden hier weder geändert noch neu gebaut.

## Quellenwidersprüche und fehlende Belege (K3)

- **Zustand:** Beide Punkte stehen im Register als `verworfen`, im Auftrag als `klaerung`. Kein
  inhaltlicher Widerspruch: verworfen ist die Anbindung für v1, zu klären ist die Zeit danach.
- **Wortlaut R-0770:** „Eigene Auswertungen" lässt sich als KLARWERKs eigene Auswertung lesen; erst
  die Notiz stellt klar, dass diese nicht ausgeschlossen ist.
- **Begründung fehlt:** Für den Ausschluss gibt es laut Register keine dokumentierte Begründung.
- **Zeitangaben fehlen:** Alle Belegeinträge tragen `zeit: null`; R-2193 hat kein Herkunftsdatum.
- **Altquellen nicht eingesehen:** `FUNKTIONSREGISTER.json:17938` und `CODEX-ANALYSE-1.md:126` liegen
  außerhalb des Arbeitsbaums und wurden nicht geöffnet; ihr Wortlaut ist nur über die Auftragsquelle
  bekannt. Die zitierten Pflichtenheft- und Modulstellen stimmen mit diesem Arbeitsbaum überein.
- **Exportformate:** Die Modulbeschreibung (`FR-LIB-02`) nennt JSON/MediaWiki/PDF; geliefert sind
  json, markdown, mediawiki, html und paket. Ob ein PDF-Export anderswo besteht, ist hier nicht
  geprüft; er gehört nicht zu diesem Auftrag.
- **Lieferbeleg:** Der Beleg mit ausgelieferter Fassung entsteht erst mit Veröffentlichung und
  Livefassung; diese Seite ist kein Erfüllungsbeleg für den Betrieb.
