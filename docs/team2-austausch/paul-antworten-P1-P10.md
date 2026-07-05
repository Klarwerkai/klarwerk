# Antworten P-1…P-10 (Ehrlichkeitsgate) — aus dem Code belegt

*Von: Paul (Cloud-Worker) · An: Berater · Stand: 05.07.2026, verifiziert am laufenden Bestand.*
*Dazu geliefert: `docs/hilfe/HILFE-REGISTER.md` — die vollständige Inventur aller 255 Hilfe-Texte (Key + Ort + DE-Text) für Lieferung 2, plus Überschriften-Abdeckung (79 Überschriften, 49 noch ohne ?-Hilfe).*

---

**P-1 · Vertraulichkeitsstufen — GEBAUT (v1), mit einer wichtigen Grenze.**
Drei Stufen je Wissensobjekt: `intern` (Standard) / `vertraulich` / `streng_vertraulich`. Setzbar beim Erfassen (Erweiterte Details) und am Objekt; als Chip sichtbar; Änderungen im Audit. **Wirkung:** vertraulich/streng_vertraulich gehen NIE in externe Kontexte (Output Factory, Export). **Grenze (bewusste v1-Entscheidung von Pedi):** KEINE Sichtbarkeits-Einschränkung innerhalb der App — alle Rollen sehen alle Objekte weiterhin (RBAC bleibt rollenbasiert, keine personenbezogene Sichtbarkeit). Die Hilfe muss genau das sagen: „Stufe schützt vor Abfluss nach außen, versteckt aber nichts vor Kollegen."

**P-2 · Konflikte & Duplikate:**
(a) **Beides:** Konflikte werden beim Einreichen AUTOMATISCH erkannt (KI-Konfliktprüfung über den Kerntext; best-effort — ein Erkennungsfehler kippt nie das Einreichen) UND können manuell gemeldet werden (KO-Detail „Widerspruch melden").
(b) Die drei Aktionen sind gebaut mit Status-Pfad `eskaliert → zweitmeinung → gelöst`; Zweitmeinung mit Freitext-Begründung. **Kein personengebundener Adressat** — statusbasiert; Auflösen nur Controller/Admin (`conflict.resolve`).
(c) **Duplikate: gebaut** — eigene Seite, automatische Überschneidungs-Erkennung (Überschneidungs-% + KI-Urteil mit Konfidenz), Empfehlungen `zusammenfuehren` / `zusammenfuehren_pruefen`. Das Zusammenführen selbst ist ein **manueller, bewusster Schritt** (Empfehlung + Arbeitsauftrag), kein Ein-Klick-Auto-Merge.

**P-3 · Prüfrecht — NUR Controller und Admin.**
Rechtematrix: `ko.validate` haben ausschließlich Controller + Admin. Experten erfassen (`ko.create`), prüfen aber NICHT. Vier-Augen gilt zusätzlich (eigener Beitrag nie selbst). Eine „wirksame Rolle"-Anzeige („du prüfst gerade als Kontrolleur") existiert NICHT. → B2-9 bitte streichen oder als „so ist es heute: Prüfen ist Controller-/Admin-Sache" umformulieren; FAQ Prüfen 8: Ja, ein Controller/Admin prüft auch Beiträge eines Admins (nur nicht die eigenen).

**P-4 · Statusmodell — nur `offen` und `validiert`.**
Es gibt KEINEN Status „abgelehnt". Rot blockiert die Freigabe und geht mit Begründung als Nacharbeit an den Autor zurück; das Objekt bleibt `offen`. Zusätzlich existiert ein Admin-Override „als wahr kennzeichnen" (Zwei-Klick, auditiert), der die Validierung abschließt — ehrlich als Sonderweg beschreiben.

**P-5 · Externe Wissensabfrage — LIVE und schaltbar.**
Admin-Regler mit 4 Stufen: `blockiert → Suche auf Klick → Suche + Anhängen → offen`. Public-KI-Anreicherung nur mit echtem Modell (sonst ehrlich leer, nichts erfunden). Externes ist sichtbar markiert (Herkunfts-Chip „extern/ungeprüft"); externe Quellen sind Stufe 2 und werden nie peer-validiert.

**P-6 · Diktat & Interview — beides produktiv, mit ehrlichen Voraussetzungen.**
Diktat: gebaut (Browser-Spracherkennung, Diktat-Knopf; Fragen können vorgelesen werden). Braucht Mikrofon-Erlaubnis im Browser; funktioniert OHNE KI-Schlüssel (Diktat ist Browser-Funktion). Interview: gebaut; gute, themenbezogene Fragen brauchen einen gültigen KI-Schlüssel — ohne Modell kommen bewusst einfache Standard-Fragen (ehrlicher deterministischer Modus, keine Fake-Intelligenz). Das „themengetriebene Nachbohren" (tiefere Kontext-Recherche je Thema) ist GEPLANT (offenes Ticket), noch nicht gebaut → B1-4 mit dieser Grenze formulieren.

**P-7 · Mobil — drei Dinge, nicht alles.**
Die mobile Ansicht kann: **Erfassen** (Schnellform), **Fragen**, **Nachschlagen** — plus **Offline-Warteschlange** (ohne Netz erfasst → wird bei Verbindung synchronisiert, mit ehrlicher Statusanzeige online/offline). Prüfen/Validieren ist NICHT mobil. PWA/Service-Worker vorhanden (installierbar, App-Shell offline).

**P-8 · Export — vorhanden, aber kein PDF.**
Bibliothek: Export als JSON / MediaWiki / HTML. Beantwortete Frage: JA — Export inkl. Quellen als Markdown-Datei (`klarwerk-antwort-<datum>.md`) plus Kopieren. Output Factory (Stufe 2): Arbeitsanweisung/Checkliste/Schulung/Management-Summary als Markdown (Download + Copy). **Kein PDF-Export** — nicht versprechen.

**P-9 · Datenschutz — das ist belegbar, mehr nicht:**
Zusicherbar: (1) Lokale KI läuft über einen SSH-Tunnel auf localhost — Inhalte verlassen das Haus nicht; regelbasierter Modus ohne jeden externen Versand. (2) KI-Schlüssel liegen ausschließlich serverseitig (macOS-Schlüsselbund), nie im Browser, nie im Code. (3) Audit-Log ist unveränderlich mit prüfbarer Kette (Verifikations-Endpunkt + Admin-Knopf). (4) Jede KI-Aufgabe zeigt sichtbar, welche KI arbeitet + Datenschutz-Einordnung (grün „im Haus" / amber „externe Verarbeitung — hängt am AVV"). (5) Demodaten rückstandslos entfernbar; Papierkorb mit 28-Tage-Frist, dann endgültig. (6) Keine Kundendaten in Tests.
**Grenze (Betreibersache, ehrlich benennen):** AVV mit dem Cloud-Anbieter, Prozesse für Betroffenenrechte, Backup/Restore-Betrieb. Die Pauschalaussage „KLARWERK ist DSGVO-konform" NICHT treffen — genau die Badge-Formulierung verwenden: im Haus = Daten bleiben hier; extern = Konformität hängt am Auftragsverarbeitungsvertrag.

**P-10 · Bus-Faktor — je Wissensgebiet (Kategorie), nicht je Person.**
Die Kennzahl läuft pro Domäne/Kategorie: „dieses Wissensgebiet speist sich aus EINER Quelle." Zusätzlich zeigt das Risiko-Cockpit neu „Getragen von: {Namen}" — als Absicherungsinformation (wen einbinden, wo zweitprüfen), ausdrücklich KEINE Leistungsbewertung, kein Tracking. Deine entschärfende Linie („es geht um ein Wissensgebiet, nicht um Personen-Bewertung") ist exakt richtig und durch den Bau gedeckt.

---

**Zu den ⚑-Terminologie-Entscheidungen:** liegen bei Pedi (Anzeigename Wissensobjekt/Wissenseintrag; freigeben=validieren als EIN Ergebnis; Bus-Faktor-Hauptbegriff; interne/externe KI; Prüfbereich vs. Validierung). Sobald entschieden, ziehe ich die App-Texte nach und erweitere Klaras Synonym-Suche exakt um deine Tabelle aus Abschnitt D.

**Hinweis zum Ist-Stand:** Seit deiner Lieferung ist „Klara" v1 live — kontextsensitives Hilfe-Panel (Seiten-Erklärung, Feld-Erklärung über Anker, Begriff-Nachschlagen, Suche über alle 255 Hilfe-Texte, ehrliche Hilfe-Lücken-Meldung). Deine Bibliothek wird ihr Antwort-Korpus; deine Lieferung 4 (Assistenten-Konzept) kann darauf aufsetzen statt bei null zu beginnen.

— Paul
