# KLARWERK — Pflichtenheft

*Version 1.0 · 14. Juni 2026. Verbindliche Anforderungen für den Neubau der KLARWERK-Anwendung.
Ergänzt durch 01-Funktionsbeschreibung und 03-Technischer-Anhang.*

---

## 1. Zweck, Geltungsbereich, Abgrenzung

**Zweck:** Neuentwicklung einer mehrbenutzerfähigen Anwendung zur Erfassung, Strukturierung,
Validierung, Pflege und Abfrage industriellen Erfahrungswissens mit einem austauschbaren
KI-Reasoner. **Primärmarkt:** industrielle Organisationen. Der fachliche Umfang ist durch die
Referenz-Implementierung definiert; technische Umsetzung ist frei.

**Out of Scope** (Stand v1, siehe §6): native App-Store-Apps, externe Drittsystem-Konnektoren
(Confluence/SharePoint-Import) über JSON hinaus, BI-Dashboards Dritter.

## 2. Konventionen

- **Priorität:** **MUSS** (verbindlich), **SOLL** (stark erwünscht), **KANN** (optional).
- **IDs:** `FR-<Bereich>-<Nr>` (funktional), `NFR-<Bereich>-<Nr>` (nichtfunktional).
- Jede Anforderung hat **Beschreibung**, **Priorität**, **Abnahmekriterium (AK)**.
- „Reasoner" = die gekapselte KI-Schicht; „KO" = Wissensobjekt.

---

## 3. Funktionale Anforderungen

### 3.1 Authentifizierung & Onboarding (AUTH)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-AUTH-01 | Ersteinrichtung: erstes Konto einer leeren Instanz wird Admin. | MUSS | Leere Instanz → Setup-Maske; erstes Konto hat Admin-Rechte. |
| FR-AUTH-02 | Selbstregistrierung (Name, E-Mail, Passwort ≥ 8 Zeichen), Konto bis Admin-Freigabe gesperrt. | MUSS | Registrierter Nutzer kann sich erst nach Freigabe anmelden; vorher Hinweis-Bildschirm. |
| FR-AUTH-03 | Login per E-Mail+Passwort; sichere, ablaufende Sitzung. | MUSS | Korrekte Daten → Sitzung; falsche/nicht freigegebene → klare Abweisung. |
| FR-AUTH-04 | Logout beendet Sitzung serverseitig. | MUSS | Nach Logout kein Zugriff mit altem Token. |
| FR-AUTH-05 | Passwörter nur **gehasht** speichern (kein Klartext, kein reversibles Verfahren). | MUSS | Datenbank enthält ausschließlich Salt+Hash. |
| FR-AUTH-06 | Admin-Passwort-Reset; bestehende Sitzungen des Nutzers werden ungültig. | MUSS | Reset → alter Login ungültig, neues Passwort gültig. |
| FR-AUTH-07 | **SSO/OIDC**-Anbindung (z. B. Azure AD/SAML) als Alternative zum lokalen Login. | SOLL | Konfigurierbarer SSO-Login; Rollen-Mapping möglich. |
| FR-AUTH-08 | Self-Service-Passwort-Reset per E-Mail. | KANN | Nutzer setzt Passwort über E-Mail-Link zurück. |

### 3.2 Rollen & Rechte (RBAC)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-RBAC-01 | Rollen Viewer / Experte / Controller / Admin mit definierter Rechtematrix (Anhang §4). | MUSS | Aktionen sind exakt gemäß Matrix sichtbar/ausführbar. |
| FR-RBAC-02 | Admin verwaltet Nutzer: anlegen, freigeben, Rolle ändern, Passwort-Reset, löschen. | MUSS | Alle fünf Aktionen im Admin-Bereich; Audit-Eintrag je Aktion. |
| FR-RBAC-03 | Admin kann sich nicht selbst die Admin-Rolle entziehen. | MUSS | Versuch wird abgewiesen. |
| FR-RBAC-04 | Serverseitige Rechteprüfung bei **jeder** schützenswerten Operation (nicht nur UI). | MUSS | Direkter API-Aufruf ohne Recht → 403. |

### 3.3 Erfassung (CAP)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-CAP-01 | Erfassen per Freitext, geführtem Formular, Diktat und KI-Interview. | MUSS | Alle vier Modi führen zu strukturierbarem Input. |
| FR-CAP-02 | KI-Interview als „Redakteur": eine Frage pro Schritt, Abschluss bei ausreichendem Inhalt. | MUSS | Interview liefert nach ~4–5 Antworten ein KO. |
| FR-CAP-03 | Live-Diktat (Sprache→Text sofort sichtbar); plattformrobust (iOS-Fallback Tastatur-Mikro). | MUSS | Diktat zeigt Text live; iOS friert nicht ein. |
| FR-CAP-04 | Fotoanhang aus **Kamera** und **Mediathek**; entfernbar. | MUSS | Beide Quellen wählbar; Thumbnails entfernbar. |
| FR-CAP-05 | Dokumentanhang (txt/md/pdf/docx/Bilder) mit Auto-OCR als Kontext. | SOLL | OCR-Text fließt in Strukturierung/Interview ein. |
| FR-CAP-06 | Entwürfe parken/fortsetzen; **gemeinsamer Pool** mit Autoranzeige. | MUSS | Entwurf eines Nutzers ist für alle Schreibberechtigten sichtbar und fortsetzbar. |
| FR-CAP-07 | Beim Fortsetzen bleibt der **Originalautor** des Entwurfs erhalten. | MUSS | Strukturiertes KO trägt den Entwurfs-Autor, nicht den Bearbeiter. |
| FR-CAP-08 | Metadaten bei Erstellung: Domäne, Kategorie, Tags, **nötige Validierungen (1–5, Std. 3)**. | MUSS | Werte werden gesetzt und am KO gespeichert. |
| FR-CAP-09 | Offline-Warteschlange für mobile Entwürfe (Erfassen ohne Netz, späteres Sync). | KANN | Mobil ohne Netz erfasste Entwürfe synchronisieren bei Wiederverbindung. |

### 3.4 Strukturierung & Editor (STR)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-STR-01 | Reasoner strukturiert Roh-Input zu KO (Titel als Aussage, Aussage, Bedingungen, Maßnahmen, Tags, Konfidenz, Wissensart). | MUSS | Strukturierungsergebnis enthält alle Felder. |
| FR-STR-02 | WYSIWYG-Editor (Überschriften, Listen, Hervorhebung, Panels, Links, Bilder, Datei-Anhänge). | MUSS | Alle Elemente erzeugbar; Ergebnis als HTML gespeichert. |
| FR-STR-03 | Angehängte Bilder im Dokument frei platzierbar (Klick-Palette, Drag&Drop, Einfügen). | SOLL | Bild lässt sich an Cursorposition einfügen. |
| FR-STR-04 | KI-Schreibhilfe (klarer, strukturieren, erweitern, Rechtschreibung) mit Übernehmen/Einfügen. | SOLL | Aktionen liefern Vorschlag; Übernahme funktioniert. |
| FR-STR-05 | Vorschau/Bearbeiten-Umschaltung **ohne Verlust** des Zwischenstands. | MUSS | Wechsel hin/zurück behält Edits inkl. Bilder. |
| FR-STR-06 | Einreichen erzeugt KO im Status „offen"; verbundener Entwurf wird entfernt. | MUSS | Nach Einreichen erscheint KO im Board; Entwurf weg. |

### 3.5 Wissensobjekt & Wissensarten (KO)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-KO-01 | KO-Datenmodell gemäß Anhang §1 (inkl. version/history/originalAuthor/needed/assignments/asset). | MUSS | Persistiertes KO enthält alle Pflichtfelder. |
| FR-KO-02 | Fünf Wissensarten (Bauchgefühl/Best Practice/Lernkurve/Technik/Negativwissen). | MUSS | Art setzbar und filterbar. |
| FR-KO-03 | Freie Kategorie + #Tags, nachträglich änderbar. | MUSS | Kategorie/Tags in Bibliothek/Board editierbar. |
| FR-KO-04 | Versionierung mit Historie; Überarbeiten setzt Bewertungen zurück. | MUSS | Revision erhöht Version, setzt ratings zurück, History-Eintrag. |

### 3.6 Validierung (VAL)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-VAL-01 | Peer-Bewertung ✅/⚠️/❌ durch Berechtigte; daraus Status & Trust (Anhang §3). | MUSS | Bewertungen ändern Status/Trust gemäß Formel. |
| FR-VAL-02 | **Konfigurierbares Limit** „nötige Validierungen" je KO entscheidet über „validiert". | MUSS | Bei *n* grünen, 0 roten → validated. |
| FR-VAL-03 | Validation Board zeigt nur **offene** KOs (validierte ausgeblendet). | MUSS | Validierte erscheinen nicht im Board, aber in Bibliothek. |
| FR-VAL-04 | Board-Filter: Status, Volltext, Domäne, Kategorie, Tags, „Mir zugewiesen". | MUSS | Alle Filter wirken kombinierbar. |
| FR-VAL-05 | Zuweisung eines KO an ≥1 Person; In-App-Benachrichtigung + Badge; Erledigung durch Bewertung. | MUSS | Zugewiesene sehen Aufgabe; Bewertung setzt sie auf erledigt. |
| FR-VAL-06 | Zuweisungs-Status sichtbar in Analytics und Admin/Management (erledigt/offen pro Person). | MUSS | Übersicht zeigt pro Person offen/erledigt. |
| FR-VAL-07 | **E-Mail-/Push-Zustellung** von Zuweisungen. | SOLL | Zugewiesene erhalten Benachrichtigung außerhalb der App. |

### 3.7 Konflikte (CON)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-CON-01 | Widersprüche erzeugen klassifizierte Konflikte (Truth/Experience/Context/Temporal/Role) statt stillen Überschreibens. | MUSS | Widerspruch → Konflikt mit Art + Beschreibung. |
| FR-CON-02 | **Nur Wahrheitskonflikte** eskalieren an einen Menschen. | MUSS | Nur Truth löst Eskalationspfad aus. |
| FR-CON-03 | Auflösung: Eskalation → Zweitmeinung → Controller-Entscheidung → gelöst, Trust erholt sich. | MUSS | Vollständiger Ablauf je Wahrheitskonflikt durchführbar. |
| FR-CON-04 | Konflikt-Seite listet alle **ungelösten** Konflikte (jeder Status) mit Link zur Klärung; Sidebar-Badge. | MUSS | Ungelöster Konflikt erscheint dort; Zähler stimmt. |

### 3.8 Abfrage & Wissenslücken (ASK)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-ASK-01 | Frage→begründete Antwort mit Trust, Quelle(n), Argumentationsschritten, ggf. Konflikt-Hinweis. | MUSS | Antwort enthält alle Bestandteile. |
| FR-ASK-02 | **Semantische** Auswahl des relevanten Wissens (Keyword-Fallback). | MUSS | Sinngemäß passende Frage findet das KO trotz anderer Worte. |
| FR-ASK-03 | Ehrliche Verweigerung bei fehlender Grundlage; Ablage als Wissenslücke. | MUSS | Unbeantwortbare Frage erzeugt Lücke, keine erfundene Antwort. |
| FR-ASK-04 | „Hat geholfen" erhöht Trust leicht und erzeugt Audit-Eintrag. | MUSS | Klick wirkt auf Trust + Audit. |
| FR-ASK-05 | Wissenslücken einem Experten zuweisbar; schließbar; mit Bestätigung löschbar. | MUSS | Zuweisen/Schließen/Löschen funktioniert. |
| FR-ASK-06 | Antwort zeigt **Belegstelle/Snippet** der Quelle. | KANN | Antwort verweist auf konkrete Textstelle. |

### 3.9 Bibliothek, Risiko, Graph, Analytics, Audit (LIB/ANA)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-LIB-01 | Bibliothek mit Suche, KI-Suche, Filtern (Domäne/Status/Kategorie/Tags). | MUSS | Filter/Suche liefern korrekte Treffer. |
| FR-LIB-02 | Export der Auswahl als JSON, MediaWiki, PDF; Import per JSON ohne Duplikate. | MUSS | Export/Import erzeugt/merged korrekt. |
| FR-LIB-03 | Risiko & Lücken inkl. **Bus-Faktor** (Domänen mit Einzelquelle). | SOLL | Bus-Faktor-Ansicht zeigt Einzelquellen. |
| FR-LIB-04 | Wissensgraph der Zusammenhänge. | SOLL | Graph stellt Relationen dar. |
| FR-ANA-01 | Analytics: Bestände nach Status/Art, Validierungs-Aufgaben pro Person, Kategorie-Verteilung. | MUSS | Kennzahlen korrekt aggregiert. |
| FR-ANA-02 | **Wirkungs-Dashboard**: validierte Objekte/Woche, Antwortquote ohne Lücke. | SOLL | Zwei Kernmetriken über Zeit sichtbar. |
| FR-AUD-01 | Lückenloses Audit-Log aller relevanten Aktionen (wer/was/wann). | MUSS | Jede in §12.3 (Funktionsbeschr.) genannte Aktion erzeugt Eintrag. |
| FR-AUD-02 | Audit **append-only**, nicht änder-/löschbar. | MUSS | Manipulationsversuch nicht möglich. |

### 3.10 Lebenszyklus & Governance (LIF)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-LIF-01 | Anlagen-/Prozesskopplung; Re-Validierung „Stimmt das noch?" bei Änderung; Bestätigung erzeugt Version. | SOLL | Anlagenänderung markiert KOs; Bestätigen versioniert. |
| FR-LIF-02 | Admin-**Autor-Übergabe** mit Erhalt des Originalautors in der Fußnote. | MUSS | Übergabe ändert Autor, Originalautor bleibt sichtbar. |
| FR-LIF-03 | **Lernpfade**: rollenspezifische Einarbeitung mit Abhaken (Konsum-/Onboarding-Seite). | SOLL | Pfad darstellbar; Fortschritt speicherbar. |
| FR-LIF-04 | Vermächtnis-Framing: Wissen trägt sichtbar den Autorennamen. | MUSS | Autor überall sichtbar. |

### 3.11 Reasoner (RSN)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-RSN-01 | Aufgaben: Strukturieren, Beantworten, Interview, semantische Suche/Auswahl, Zweitmeinung, Schreibhilfe. | MUSS | Alle Aufgaben über die Reasoner-Schicht verfügbar. |
| FR-RSN-02 | **Modell-/anbieteragnostisch**: Modell/Endpunkt konfigurierbar und austauschbar ohne Codeänderung der Fachlogik. | MUSS | Modellwechsel per Konfiguration; Fachlogik unverändert. |
| FR-RSN-03 | Anti-Halluzination: keine Rateantworten; Trennung gesichert/ungeprüft/Meinung/extern/Annahme; Unwissen benennen. | MUSS | Ohne belastbares Wissen keine erfundene Antwort. |
| FR-RSN-04 | Deterministischer Fallback ohne Modell; System bleibt bedienbar. | MUSS | Ohne Modell laufen alle Seiten; Antworten als Demo erkennbar. |
| FR-RSN-05 | **Server-echte Statusanzeige** „Reasoner aktiv/offline". | MUSS | Anzeige spiegelt tatsächliche Modell-Verfügbarkeit. |
| FR-RSN-06 | KI-Schlüssel/Zugang ausschließlich **serverseitig**; nie im Client. | MUSS | Kein Schlüssel im Frontend-Bundle. |

### 3.12 Mobile / PWA (MOB)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-MOB-01 | Mobil-Ansicht mit Aufnehmen/Fragen/Entwürfe/Wissen; als PWA installierbar (Vollbild, Icon, Offline-Start). | MUSS | „Zum Home-Bildschirm" liefert Vollbild-App. |
| FR-MOB-02 | Notiz/Interview im Mobile; Entwurf als **Primäraktion**. | MUSS | Beide Modi vorhanden; Entwurf-Button dominant. |
| FR-MOB-03 | Destruktive Aktionen mobil über **In-App-Bestätigung** (keine nativen Dialoge). | MUSS | Löschen verlangt Inline-Bestätigung. |

### 3.13 Internationalisierung (I18N)

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-I18N-01 | Vollständig DE/EN inkl. Reasoner-Antworten/Interview; Umschalter. | MUSS | Komplette Oberfläche + KI in beiden Sprachen. |
| FR-I18N-02 | Architektur für weitere Sprachen erweiterbar. | SOLL | Neue Sprache ohne Code-Umbau ergänzbar. |

### 3.14 Strategische Erweiterungen (EXT)

> Status: in Demo und App als interaktive Screens umgesetzt; produktive Import-/Extraktions-
> Pipeline = Roadmap. Klar als „Demo/Konzept" gekennzeichnet.

| ID | Anforderung | Prio | Abnahmekriterium |
|---|---|---|---|
| FR-EXT-01 | **Knowledge Import**: Quellen (Video, Anleitung, SOP, Servicebericht, Excel, Wiki, PDF, Foto) → prüfbare Wissensobjekt-Kandidaten; Pipeline Upload→Extrahieren→Strukturieren→Validieren→Freigeben→Wiederverwenden. | KANN | Screen zeigt Pipeline, Beispiel-Importe und Ergebnis-Befunde (Kandidaten/Konflikte/fehlend/veraltet/Dubletten/IP). |
| FR-EXT-02 | Importiertes Objekt initial `unvalidated/imported/draft`, der Validierung zugewiesen; Originalquelle verlinkt. | KANN | Status/Verlinkung im Konzept/Datenmodell vorgesehen. |
| FR-EXT-03 | **Output Factory**: aus validiertem Wissen Inhalte (Arbeitsanweisung, SOP, Checkliste, Training, FAQ …) mit Quelle, Trust, Validierungsstatus, Version, Gültigkeit, Rolle, Unsicherheiten. | KANN | Screen erzeugt Vorschau nur aus validiertem Objekt + vollständige Provenance. |
| FR-EXT-04 | **Wissens-Priorisierung**: Score aus 9 Faktoren (Bus-Faktor, Kritikalität, Prozessnähe, Alter, Quellenqualität, Konfliktdichte, Wiederholhäufigkeit, Schadenspotenzial, IP-Wert); Filter & Detail. | KANN | Gerankte Liste mit Score, Flags, Faktor-Detail. |
| FR-EXT-05 | **Knowledge House / Company Memory**: visuelles Gedächtnis (Domänen = Stockwerke, gesichert vs. fragil; Import→Haus→Output). | KANN | Screen zeigt Haus mit Domänen-Füllgrad + KPIs. |
| FR-EXT-06 | **Validity & Protection**: Aktualität (frisch/altert/fällig/veraltet) und IP-Sensitivität (öffentlich…streng vertraulich) → Deployment-Empfehlung. | KANN | Zwei Sichten je Objekt mit Maßnahme/Deployment-Empfehlung. |
| FR-EXT-07 | Wissensobjekt-Felder für Import/Output (Konzept): `source_type`, `import_status`, `validity_until`, `freshness_status`, `ip_sensitivity`, `output_eligible`, `generated_outputs` u. a. | SOLL | In Konzept/Funktionsbeschreibung dokumentiert. |

---

## 4. Nichtfunktionale Anforderungen

### 4.1 Sicherheit (SEC)
- **NFR-SEC-01 (MUSS):** Passwörter nur als Salt+Hash (etabliertes Verfahren, hohe Iteration). AK: kein Klartext in DB/Logs.
- **NFR-SEC-02 (MUSS):** Transport durchgängig TLS; sichere, HttpOnly-Sitzungscookies bzw. sichere Token. AK: kein Klartext-Transport.
- **NFR-SEC-03 (MUSS):** Serverseitige Autorisierung bei jeder Operation; keine reine UI-Absicherung. AK: Pen-Test ohne Rechteumgehung.
- **NFR-SEC-04 (MUSS):** Schutz gegen OWASP-Top-10 (Injection, XSS im WYSIWYG-HTML, CSRF, IDOR). AK: Security-Review bestanden.
- **NFR-SEC-05 (SOLL):** Secrets-Management (Vault/Cloud-Secret-Store); Schlüsselrotation. AK: kein Secret im Repo/Build.

### 4.2 Datenschutz & Datenresidenz (PRV)
- **NFR-PRV-01 (MUSS):** Drei Deployment-Modelle mit **transparentem** Datenfluss (Anhang §5). AK: Doku/Verhalten je Modell konsistent.
- **NFR-PRV-02 (MUSS):** Aussage „keine Daten verlassen das Haus" **nur** für On-Premises. AK: Marketing/Produkt�exte korrekt.
- **NFR-PRV-03 (MUSS):** Bei Cloud/Private AI vertragliche **No-Training**-Zusicherung und EU-Datenresidenz, wo zutreffend; Subauftragsverträge. AK: Nachweis dokumentiert.
- **NFR-PRV-04 (MUSS):** DSGVO-Konformität (Auskunft, Löschung, Verarbeitungsverzeichnis). AK: Betroffenenrechte umsetzbar.

### 4.3 Vertrauenswürdige KI / Compliance (TAI)
- **NFR-TAI-01 (MUSS):** Nachvollziehbarkeit jeder Antwort (Quelle, Trust, Schritte) und jeder Datenänderung (Audit). AK: Antwort/Änderung rückverfolgbar.
- **NFR-TAI-02 (MUSS):** Menschliche Aufsicht: Validierung/Konfliktauflösung durch Menschen; nur Wahrheitskonflikte eskalieren. AK: kein automatischer „Wahrheits"-Entscheid.
- **NFR-TAI-03 (SOLL):** Ausrichtung an Anforderungen vertrauenswürdiger KI (Transparenz, Aufsicht, Nachvollziehbarkeit) als unterstützender Markttrend (EU AI Act). AK: Prinzipien dokumentiert nachgewiesen.

### 4.4 Performance & Skalierung (PERF)
- **NFR-PERF-01 (SOLL):** UI-Interaktionen < 200 ms; Standard-Listen/Filter < 1 s bei 10.000 KOs. AK: Lasttest.
- **NFR-PERF-02 (SOLL):** Reasoner-Antwort < 5 s (modellabhängig) mit sichtbarem Lade-/Abbruch-Status. AK: Messung + Abbruch funktioniert.
- **NFR-PERF-03 (SOLL):** Skalierung auf ≥ 1.000 Nutzer / ≥ 100.000 KOs pro Mandant. AK: Lasttest/Architekturnachweis.

### 4.5 Verfügbarkeit & Betrieb (OPS)
- **NFR-OPS-01 (SOLL):** Verfügbarkeit ≥ 99,5 % (Cloud); definierte Wartungsfenster. AK: SLA-Nachweis.
- **NFR-OPS-02 (MUSS):** Backups + getestetes Restore; definierte RPO/RTO. AK: Restore-Test bestanden.
- **NFR-OPS-03 (SOLL):** Observability: strukturierte Logs, Metriken, Tracing; KI-Kosten-/Nutzungs-Logging. AK: Dashboards vorhanden.
- **NFR-OPS-04 (SOLL):** CI/CD mit automatisierten Tests; reproduzierbare Deployments je Modell. AK: Pipeline grün, Ein-Klick-Deploy.

### 4.6 Usability & Barrierefreiheit (UX)
- **NFR-UX-01 (MUSS):** Bedienbar ohne Schulung für Experten/Controller; klare Bestätigungen vor destruktiven Aktionen. AK: Usability-Test.
- **NFR-UX-02 (SOLL):** WCAG 2.1 AA (Kontrast, Tastatur, Screenreader). AK: Accessibility-Audit.
- **NFR-UX-03 (SOLL):** Responsive Desktop + Mobile; PWA-Installierbarkeit. AK: Geräteübergreifender Test.

### 4.7 Wartbarkeit & Portabilität (MNT)
- **NFR-MNT-01 (MUSS):** Reasoner als gekapselte, austauschbare Schicht (kein Modell-Lock-in). AK: Modellwechsel per Konfiguration.
- **NFR-MNT-02 (SOLL):** Modularer, getesteter Code (Unit/Integration/E2E); dokumentierte API. AK: Coverage-Ziel + API-Doku.
- **NFR-MNT-03 (SOLL):** Mandantenfähigkeit (Daten-/Konfigurationsisolation pro Kunde). AK: Mandanten sehen keine fremden Daten.

### 4.8 Datenhaltung & Migration (DAT)
- **NFR-DAT-01 (MUSS):** Persistente, transaktionssichere Datenbank; KO als versionierte Datensätze. AK: Konsistenz unter Last.
- **NFR-DAT-02 (SOLL):** Import bestehender Demo-/App-Daten via JSON. AK: Referenzdaten importierbar.

---

## 5. Abnahme

Abnahme erfolgt gegen die **Abnahmekriterien** je Anforderung. **Alle MUSS** sind erfüllt; **SOLL**
sind erfüllt oder begründet zurückgestellt. Zusätzlich: bestandener Security- und
Accessibility-Review, erfolgreicher Restore-Test, lauffähige Referenz je Deployment-Modell,
vollständiges Audit, DE/EN vollständig.

## 6. Out of Scope (v1)

Native Store-Apps; Drittsystem-Konnektoren über JSON hinaus; Self-Service-Mandantenprovisionierung;
erweiterte BI; Gamification (ausdrücklich nicht erwünscht).

## 7. Offene Punkte (vom Auftragnehmer zu klären)

Technologiestack; Mandantenmodell pro Deployment; SSO-Details; konkrete On-Premises-Modelle/Hardware;
Benachrichtigungs-Provider; Umfang Offline-Queue; Migrationsumfang. (Siehe 00-Leitfaden §5.)
