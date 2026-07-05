# KLARWERK Hilfe-Register — Überschriften-Abdeckung + Voll-Inventur der Hilfe-Texte

> **Zweck (Pedi 05.07.):** Jede Überschrift (wo möglich) hat eine Erklärung — und dieses Register dokumentiert, WAS wo erklärt wird, damit bei App-Änderungen die Erklärungen nachgezogen werden.
> **Pflege-Regel:** Dieses Dokument ist AUS DEM CODE GENERIERT (Quellen: alle `pages/*.tsx` + `i18n.ts`). Es wird nicht von Hand editiert — nach jedem UI-Batch, der Überschriften oder Hilfen ändert, generiert Paul es neu und liefert es mit. Stand: 05.07.2026.
> **Doppelnutzen:** Teil 2 ist zugleich die vollständige Inventur für den Berater (Lieferung 2: Audit aller Kurzhilfen).

## Teil 1 · Überschriften-Abdeckung (SectionLabel je Seite)

**Bilanz: 79 Überschriften · 30 mit ?-Hilfe · 49 ohne.** Priorisierung: Beta-sichtbare Seiten zuerst (~24 Lücken); Stufe-2-Seiten (Output/Import/Graph/Kapital/Management — Admin+Schalter, fürs Beta unsichtbar) danach.

| Seite | Überschrift (i18n-Key) | DE-Text | ?-Hilfe |
|---|---|---|---|
| Admin | `adm.seedTitle` | Demodaten laden | ❌ |
| Admin | `adm.factory.title` | Werkseinstellungen | ✅ |
| Admin | `adm.val.title` | Prüfungen | ✅ |
| Admin | `adm.upload.title` | Upload-Grenzen | ✅ |
| Admin | `adm.trash.title` | Papierkorb | ✅ |
| Admin | `adm.ai.title` | KI-Verwaltung | ✅ |
| Admin | `adm.presets.title` | Eigene KI-Funktionen | ✅ |
| Admin | `adm.ai.accessTitle` | Verfügbare KIs | ✅ |
| Admin | `adm.ext.title` | Externe Wissensabfrage | ✅ |
| Admin | `adm.dup.title` | Duplikat-Erkennung | ✅ |
| Admin | `adm.createTitle` | Nutzer anlegen | ❌ |
| Admin | `adm.auditTitle` | Letzte Nutzer-/Auth-Aktivitäten (Audit) | ❌ |
| Admin | `adm.sich.auditTitle` | Prüfprotokoll — manipulationssicher | ✅ |
| Admin | `adm.sich.dataTitle` | Datenschutz & Sicherheit | ✅ |
| Admin | `adm.ready.title` | VIP-Bereitschaft | ✅ |
| Analytics | `ana.exec.title` | Executive-Blick | ✅ |
| Analytics | `health.title` | Knowledge Health | ✅ |
| Analytics | `ana.byType` | Verteilung nach Wissensart | ❌ |
| Analytics | `ana.impact` | Wirkung | ✅ |
| Analytics | `ana.weekly` | Validiert je Woche | ❌ |
| Analytics | `ana.audit` | Audit-Log (unveränderlich) | ✅ |
| Ask | `ask.steps` | Argumentationsschritte | ❌ |
| Ask | `ask.sources` | Quellen | ❌ |
| Capture | `capture.resumeTitle` | Entwürfe fortsetzen | ❌ |
| Capture | `capture.raw` | Erfahrungsnotiz | ✅ |
| Capture | `ext.title` | Externe Quelle suchen | ❌ |
| Capture | `capture.readyTitle` | Speicher-Check | ✅ |
| Capture | `capture.readyTitle` | Speicher-Check | ✅ |
| ExternalKnowledge | `extpage.resultsTitle` | {{n}} Treffer | ❌ |
| KnowledgeDetail | `ko.statement` | Aussage | ❌ |
| KnowledgeDetail | `ko.conditions` | Bedingungen | ❌ |
| KnowledgeDetail | `ko.measures` | Maßnahme | ❌ |
| KnowledgeDetail | `ko.conflictTitle` | Widerspruch zu einem anderen Wissensobjekt melden | ✅ |
| KnowledgeDetail | `ko.helpfulTitle` | Bewährung | ✅ |
| KnowledgeDetail | `ko.sourcesTitle` | Quellen | ✅ |
| KnowledgeDetail | `ext.title` | Externe Quelle suchen | ✅ |
| KnowledgeDetail | `ko.sourceTitle` | Quelle/Beitrag melden | ✅ |
| KnowledgeDetail | `ko.provenance` | Herkunft | ❌ |
| KnowledgeDetail | `ko.couple.title` | Anlagen-Kopplung | ✅ |
| KnowledgeDetail | `ext.validity.title` | Gültigkeit & Schutz | ✅ |
| KnowledgeDetail | `ko.lineageTitle` | Herkunft & Verlauf | ❌ |
| KnowledgeDetail | `ko.relatedTitle` | Verwandte Wissensobjekte | ❌ |
| KnowledgeDetail | `ko.history` | Versionen | ❌ |
| KnowledgeDetail | `ko.evidenceTitle` | Evidenz | ❌ |
| KnowledgeDetail | `ko.snapshotsTitle` | Versions-Snapshots | ❌ |
| KnowledgeDetail | `ko.comments` | Kommentare | ❌ |
| KnowledgeDetail | `ko.attachments` | Anhänge / Fotos | ❌ |
| Lifecycle | `lcy.assetTitle` | Anlagenänderung melden | ❌ |
| Lifecycle | `lcy.pendingTitle` | Zur Re-Validierung | ❌ |
| Lifecycle | `lcy.pathTitle` | Lernpfad · {{role}} | ❌ |
| Risk | `risk.summary` | Cockpit-Übersicht | ✅ |
| Risk | `risk.cockpit` | Risiko-Cockpit nach Domäne | ✅ |
| Risk | `risk.busfactor` | Bus-Faktor (Einzelquellen-Risiko) | ✅ |
| Risk | `risk.gaps` | Offene Wissenslücken | ✅ |
| Stufe2 | `out.kindTitle` | Output-Typ | ❌ |
| Stufe2 | `out.sourcesTitle` | Validierte Quellen | ❌ |
| Stufe2 | `out.composeTitle` | Reihenfolge & Komposition | ❌ |
| Stufe2 | `out.previewTitle` | Vorschau (Markdown) | ❌ |
| Stufe2 | `out.provenanceTitle` | Herkunft & Nachweis | ❌ |
| Stufe2 | `imp.uploadTitle` | JSON-Re-Import | ❌ |
| Stufe2 | `ext.pipeline.title` | Import-Pipeline & Befunde | ❌ |
| Stufe2 | `imp.queueTitle` | Source-Review-Queue | ❌ |
| Stufe2 | `mgmt.jumpTitle` | Abschnitte | ❌ |
| Stufe2 | `mgmt.overview` | Operativer Snapshot | ❌ |
| Stufe2 | `mgmt.capital` | Knowledge Capital Score | ❌ |
| Stufe2 | `mgmt.valuation` | Knowledge Valuation | ❌ |
| Stufe2 | `mgmt.statement` | Knowledge Statement | ❌ |
| Stufe2 | `mgmt.maturity` | Maturity Journey | ❌ |
| Stufe2 | `mgmt.house` | Knowledge House | ❌ |
| Stufe2 | `mgmt.recommendations` | Hero Assist — Empfehlungen | ❌ |
| Stufe2 | `mgmt.priorities` | Wissens-Priorisierung (9 Faktoren) | ❌ |
| Stufe2 | `mgmt.pilot` | Pilot-Bericht 30/60/90 | ❌ |
| Stufe2 | `mrun.title` | Reasoner-Läufe (zuletzt) | ❌ |
| Stufe2 | `rcfg.title` | Reasoner-Konfiguration | ❌ |
| Stufe2 | `evx.title` | Evidence-Index (QM) | ❌ |
| Stufe2 | `prov.title` | Provenance-Index (QM) | ❌ |
| Stufe2 | `readiness.title` | Knowledge-OS Readiness | ❌ |
| Stufe2 | `kos.hintsTitle` | Knowledge-OS QM-Hinweise | ❌ |
| Stufe2 | `evFresh.title` | Evidence-Aktualität (QM) | ❌ |

## Teil 2 · Voll-Inventur aller Hilfe-Texte (255 Einträge, DE)

> Familien: `chelp.*` Erfassen-Hilfen · `vhelp.*` Prüfbereich-Hilfen · `klara.*` Klara-Panel · `help.*`/`pilot.*` Hilfeseite · `reasoner.taskInfo.*` KI-(!)-Infos · übrige `*.help*` Karten-Hilfen (Admin/Risiko/Analytics …). Alle Texte existieren paritätisch in EN.

| i18n-Key | Ort | DE-Text |
|---|---|---|
| `adm.ai.accessHelp` | Admin | Zeigt alle KI-Zugänge dieser Instanz mit ehrlichem Status: das konfigurierte Cloud-Modell (Schlüssel nur serverseitig), den deterministischen Ersatzmodus, der ohne Modell einspringt, und den geplanten lokalen LLM-Server aus Team 2. Welcher Zugang je Einsatz wirklich wirkt, steht oben in der KI-Verwaltung (Spalte „wirkt“). |
| `adm.ai.help` | Admin | Bestimme global oder je Einsatz, welche KI arbeitet. „Auto“ nutzt das Modell, wenn ein Schlüssel hinterlegt ist; „Deterministisch“ arbeitet bewusst ohne Modell. Schlüssel bleiben ausschließlich auf dem Server — nie im Browser. |
| `adm.dup.help` | Admin | Ab welcher KI-Wahrscheinlichkeit ein vermutliches Duplikat angezeigt wird. Niedriger heißt mehr Treffer, aber auch mehr Fehlalarme zum Wegklicken. |
| `adm.ext.help` | Admin | Steuert, ob die App externe Quellen (Web) und die Public-KI zur Anreicherung nutzen darf. Vier Stufen von komplett gesperrt bis offen. Standard bewusst restriktiv. Änderungen landen im Audit-Log. |
| `adm.factory.help` | Admin | Setzt die lokale Instanz vollständig zurück: alle Wissensobjekte, Anwender, Konflikte, Lücken und Einstellungen werden gelöscht. Danach beendet sich das Programm; beim nächsten Start beginnt die Ersteinrichtung und der erste Anwender wird wieder Admin. Nur in der lokalen Desktop-Version verfügbar. |
| `adm.presets.help` | Admin | Die KI-Palette im Editor bietet Werks-Funktionen (Klarer, Strukturieren, Erweitern, Rechtschreibung, Formatieren). Hier legst du ZUSÄTZLICHE, eigene Funktionen für deine Organisation an — ein Name für den Knopf und die Anweisung, die die KI bekommt (z. B. „Fasse für die Schichtübergabe in 5 Stichpunkten zusammen“). Die Anweisung ist in der Palette am ?-Zeichen offen sichtbar; wie immer gilt: Die KI macht nur einen Vorschlag zur Vorschau, übernommen wird bewusst per Klick. Werks-Funktionen lassen sich nicht löschen. |
| `adm.ready.help` | Admin | Ein ehrlicher Ein-Blick-Status vor dem Test: was steht, was fehlt. Jede Zeile aus echten Zahlen, nichts geschönt. |
| `adm.sich.auditHelp` | Admin | Jede sicherheitsrelevante Aktion wird nur angefügt und über eine Hash-Kette verkettet. Nachträglich lässt sich kein Eintrag ändern oder löschen, ohne dass die Kette bricht — das macht das Protokoll überprüfbar (tamper-evident). |
| `adm.sich.dataHelp` | Admin | Ein ehrlicher Auszug der Systemeigenschaften — keine Versprechen, sondern wie KLARWERK gebaut ist. |
| `adm.trash.help` | Admin | Gelöschte Beiträge landen hier und bleiben 28 Tage wiederherstellbar. Danach werden sie automatisch endgültig gelöscht. Demo-Daten erscheinen hier nie — sie werden immer sofort endgültig gelöscht. |
| `adm.upload.help` | Admin | Legt fest, wie viele Anhänge ein Objekt haben darf und wie groß ein einzelner Anhang sein darf. Gilt für neue Anhänge; bestehende bleiben. Änderungen landen im Audit-Log. |
| `adm.val.help` | Admin | Die Standard-Prüferanzahl gilt für neue Einreichungen ohne eigene Angabe. Erlaubt sind 1 bis 5. Bestehende Beiträge bleiben unverändert; Änderungen landen im Audit-Log. |
| `ana.help.audit` | Analytics | Das Audit-Log protokolliert unveränderlich jede relevante Aktion — wer (Actor), was (Aktion) und woran (Ziel). Über die Filter grenzen Sie schnell auf eine Person, eine Aktionsart oder ein Objekt ein; nachträglich lässt sich nichts ändern. |
| `ana.help.exec` | Analytics | Vier Kern-Kennzahlen aus Live-Daten: validiertes Wissen, offene Prüfungen, Bus-Faktor-Risiko und gerettete Lücken. Ein ruhiger Überblick für Entscheider — je höher der Validierungsgrad und je niedriger das Risiko, desto gesünder die Wissensbasis. |
| `ana.help.health` | Analytics | Der Health-Score (0–100) fasst Validierungsgrad, Aktualität und Quellenbreite zusammen. Das Band (z. B. gut oder kritisch) zeigt den Zustand auf einen Blick; darunter sehen Sie, welche Faktoren den Wert heben oder senken. |
| `ana.help.impact` | Analytics | Wirkung zeigt, was das System real leistet: validierte Objekte gesamt, gestellte Fragen, ohne Lücke beantwortete Fragen und die daraus errechnete Antwortquote. Der Wochenverlauf macht sichtbar, ob validiertes Wissen wächst. |
| `ask.helpful` | Ask | Hat geholfen |
| `capture.ai.customHelp` | AiAssistBox | Eigene KI-Funktion deiner Organisation (vom Admin angelegt). Anweisung an die KI: „{{instruction}}“. Wie bei allen KI-Aktionen entsteht nur ein Vorschlag zur Vorschau — übernommen wird ausschließlich, was du bewusst per Klick übernimmst. |
| `capture.ai.help.clarify` | (indirekt) | Formuliert verständlicher und präziser — der Sinn bleibt gleich. |
| `capture.ai.help.expand` | (indirekt) | Formuliert ausführlicher — erfindet dabei keine neuen Fakten. |
| `capture.ai.help.format` | (indirekt) | Verbessert nur die Lesbarkeit (Absätze, Zeichensetzung) — ohne Markdown-Zeichen; der Inhalt bleibt wörtlich. |
| `capture.ai.help.spelling` | (indirekt) | Korrigiert nur Rechtschreibung und Grammatik, sonst nichts. |
| `capture.ai.help.structure` | (indirekt) | Ordnet den Text in knappe Sätze bzw. Stichpunkte. |
| `capture.file.queryHelp.body` | captureFromFile | Ohne Angabe listet die KI alle Wissenspunkte im Dokument auf. Mit Suchauftrag beschränkt sie sich auf deinen Fokus. Erfunden wird in beiden Fällen nichts — jeder Punkt trägt eine wörtliche Belegstelle aus dem Dokument. |
| `capture.file.queryHelp.title` | captureFromFile | Gezielt suchen |
| `capture.help.category.body` | Capture | Die Kategorie ist eine frei vergebbare fachliche Einordnung (z. B. „Instandhaltung“, „Qualität“, „Einkauf“). Tags sind freie Schlagworte zur Auffindbarkeit. |
| `capture.help.category.title` | Capture | Kategorie & #Tags |
| `capture.help.validations.body` | Capture | Wie viele unabhängige Bestätigungen das Objekt braucht, bevor es als „validiert“ gilt (1–5, Standard 3). Mehr = höhere Hürde, belastbarer. |
| `capture.help.validations.title` | Capture | Nötige Validierungen |
| `capture.reviewers.helpBody` | Capture | Wähle Kolleginnen und Kollegen, die deinen Beitrag prüfen sollen. Sie bekommen die Prüfung als offene Zuweisung und eine Benachrichtigung. Ohne Auswahl bleibt der Beitrag offen für alle Prüfer. |
| `capture.reviewers.helpTitle` | Capture | Prüfer vorschlagen |
| `capture.wizard.helpers` | captureWizard | Hilfen, Vorlagen & Anhänge-Kontext |
| `capture.wizard.helpersHint` | captureWizard | Optionale Unterstützung — nichts davon ist Pflicht. |
| `chelp.advancedDetails.body` | Erfassen (captureHelp) | Alles hier ist OPTIONAL — dein Wissen wird auch ohne eingereicht. Es lohnt sich trotzdem: Kategorie und Schlagwörter machen es auffindbar, die Anlage koppelt es an Maschinen/Objekte, die Prüf-Anzahl steuert das Validierungs-Quorum, Dokumente und Bilder liefern Beweismaterial. Das Badge zeigt, wie viel schon ausgefüllt ist. |
| `chelp.advancedDetails.title` | Erfassen (captureHelp) | Erweiterte Details |
| `chelp.assetField.body` | Erfassen (captureHelp) | Koppelt dein Wissen an eine konkrete Anlage, Maschine oder ein Objekt („Presse 3“, „Mandant XY“). Ändert sich später etwas an dieser Anlage, findet der Lebenszyklus genau die gekoppelten Wissensobjekte zur Überprüfung. Freitext genügt — Hauptsache, Kollegen erkennen die Anlage wieder. |
| `chelp.assetField.title` | Erfassen (captureHelp) | Anlage / Objekt |
| `chelp.captureTitle.body` | Erfassen (captureHelp) | Der Titel ist das Erste, was Kollegen in Bibliothek und Antworten sehen — er entscheidet, ob dein Wissen gefunden wird. Gut: konkret und handlungsnah („Schweißnaht bei Aluminium unter 5 mm prüfen“). Du kannst ihn jederzeit ändern, auch der KI-Vorschlag ist nur ein Startpunkt. |
| `chelp.captureTitle.title` | Erfassen (captureHelp) | Der Titel |
| `chelp.dictate.body` | Erfassen (captureHelp) | Sprechen statt tippen: Dein Browser wandelt Sprache lokal in Text um, der hier ins Feld fließt. Starte und stoppe bewusst; danach kannst du den Text ganz normal korrigieren. Wenn dein Browser keine Spracherkennung kann, sagt dir die App das ehrlich, statt still zu scheitern. |
| `chelp.dictate.title` | Erfassen (captureHelp) | Diktieren |
| `chelp.discardHelp.body` | Erfassen (captureHelp) | Verwirft den aktuellen Entwurf endgültig — Text, Struktur und Anhänge dieser Erfassung. Es betrifft NUR deinen Entwurf: Bereits eingereichte oder gespeicherte Wissensobjekte bleiben unberührt. Vorher fragt die App bewusst nach; wer nur einen Schritt zurück will, nutzt die Schritt-Leiste statt Verwerfen. |
| `chelp.discardHelp.title` | Erfassen (captureHelp) | Verwerfen |
| `chelp.docsImages.body` | Erfassen (captureHelp) | Hängt Beweismaterial an dein Wissen: Fotos vom Ergebnis, das Prüfprotokoll, die Arbeitsanweisung. Anhänge wandern beim Einreichen mit ans Wissensobjekt und sind dort für Prüfer sichtbar. Ihr Inhalt wird nicht automatisch zu Wissen — was in den Text soll, entscheidest du. |
| `chelp.docsImages.title` | Erfassen (captureHelp) | Dokumente & Bilder |
| `chelp.expertForm.body` | Erfassen (captureHelp) | Hier trägst du alle Felder direkt ein: Titel, Wissensart, Inhalt, Kernaussage, Bedingungen (wann gilt es?) und Maßnahmen (was ist zu tun?). Es gelten dieselben Regeln wie im geführten Weg — gleicher Speicher-Check, gleiche Prüfung. Die KI hilft auf Wunsch am Text, entscheidet aber nichts. |
| `chelp.expertForm.title` | Erfassen (captureHelp) | Das Experten-Formular |
| `chelp.expertPath.body` | Erfassen (captureHelp) | Das klassische Formular mit allen Feldern auf einen Blick — für alle, die genau wissen, was sie eintragen wollen. Es ist derselbe Datenstand wie der geführte Weg, kein Extra-Feature und keine Abkürzung an der Prüfung vorbei. Der Rückweg auf den geführten Weg ist jederzeit einen Klick entfernt. |
| `chelp.expertPath.title` | Erfassen (captureHelp) | Formular direkt (Expertenpfad) |
| `chelp.filePoints.body` | Erfassen (captureHelp) | Du lädst ein Dokument hoch, die KI extrahiert daraus einzelne Wissenspunkte — jeder MIT wörtlicher Belegstelle aus dem Dokument (erfundene Punkte sind damit ausgeschlossen; findet sie nichts Belastbares, sagt sie das ehrlich). Du wählst per Häkchen aus, was übernommen wird: Nur ausgewählte Punkte werden Entwürfe. Alternativ kannst du einen Suchauftrag an einen Experten formulieren. |
| `chelp.filePoints.title` | Erfassen (captureHelp) | Wissen aus Datei |
| `chelp.interview.body` | Erfassen (captureHelp) | Die KI stellt dir eine Frage nach der anderen und bohrt gezielt nach — nach Grenzwerten, Ausnahmen, Gründen. Antworte in deinen Worten (tippen oder diktieren); die Frage kannst du dir vorlesen lassen. Erst wenn du das Interview abschließt, wird aus allen Antworten ein Entwurf für die Wissensseite gebaut — nichts davon ist vorher gespeichert. |
| `chelp.interview.title` | Erfassen (captureHelp) | Das Wissens-Interview |
| `chelp.knowledgeType.body` | Erfassen (captureHelp) | Ordnet dein Wissen ein: Erfahrungswissen, Prozesswissen, Faktenwissen — und besonders wertvoll: NEGATIVWISSEN („das haben wir probiert, es funktioniert NICHT, weil …“). Die Wissensart hilft Prüfern und Suchenden, dein Wissen richtig einzuordnen; sie ändert nichts am Prüfweg. |
| `chelp.knowledgeType.title` | Erfassen (captureHelp) | Wissensart |
| `chelp.loadExample.body` | Erfassen (captureHelp) | Füllt die Felder mit einem Demo-Beispiel, damit du den kompletten Weg gefahrlos ausprobieren kannst. Achtung: Es überschreibt deine aktuellen Eingaben — nutze es auf leerer Seite. Eingereicht wird auch ein Beispiel erst, wenn du es bewusst einreichst. |
| `chelp.loadExample.title` | Erfassen (captureHelp) | Beispiel laden |
| `chelp.modes.body` | Erfassen (captureHelp) | Vier Wege führen zum selben Ziel: FREITEXT (einfach drauflos schreiben), DIKTAT (sprechen statt tippen), INTERVIEW (die KI stellt dir gezielte Fragen) und AUS DATEI (Wissenspunkte aus einem Dokument ziehen). Wähle, was sich für dich natürlich anfühlt — alle Wege münden in denselben Entwurf auf der Wissensseite, und beim Wechseln geht nichts verloren. |
| `chelp.modes.title` | Erfassen (captureHelp) | Die vier Erzähl-Wege |
| `chelp.readiness.body` | Erfassen (captureHelp) | Zeigt ehrlich, was zum Einreichen noch fehlt: Pflichtfelder (ohne sie bleibt der Knopf aus) und Optionales, das dein Wissen stärkt (z. B. Kategorie oder Anhänge). Grün heißt bereit — nicht perfekt: Verbessern kannst du auch nach dem Einreichen noch, dann als neue Version. |
| `chelp.readiness.title` | Erfassen (captureHelp) | Speicher-Check |
| `chelp.saveDraftHelp.body` | Erfassen (captureHelp) | Sichert deinen Zwischenstand lokal in deinem Browser — du kannst jederzeit weitermachen, auch nach einem Neustart. Ein Entwurf ist NICHT eingereicht: Niemand sieht ihn, er taucht in keiner Prüfung und keiner Antwort auf. Oben auf der Seite findest du gespeicherte Entwürfe zum Fortsetzen. |
| `chelp.saveDraftHelp.title` | Erfassen (captureHelp) | Entwurf speichern |
| `chelp.savedNext.body` | Erfassen (captureHelp) | Dein Wissen ist als Objekt angelegt und wartet auf die Peer-Prüfung — es ist SICHTBAR, aber ehrlich als offen markiert, nicht als gesichert. Du musst nichts weiter tun: Prüfer finden es auf dem Validierungs-Board. Willst du es ansehen oder ergänzen, führt der Link direkt hin. |
| `chelp.savedNext.title` | Erfassen (captureHelp) | Gespeichert — was jetzt? |
| `chelp.sourcesPanel.body` | Erfassen (captureHelp) | Hängt externe Belege an dein Wissen — Norm, Handbuch, Herstellerseite. Von Hand (Bezeichnung, Link, Auszug) oder über die Quellen-Suche, genau wie im Prüfbereich. Beim Erfassen sammelst du sie in einer sichtbaren Warteliste; angehängt werden sie erst beim Einreichen, zusammen mit deinem Wissensobjekt. Wichtig: Externe Quellen sind Stufe 2 — sie gelten nie als peer-validiert und ersetzen keine Prüfung durch Kollegen. Nichts wird automatisch übernommen. |
| `chelp.sourcesPanel.title` | Erfassen (captureHelp) | Externe Quellen (Stufe 2) |
| `chelp.structureNow.body` | Erfassen (captureHelp) | Die KI liest deinen Rohtext und schlägt Titel, Kernaussage, Bedingungen und Maßnahmen vor — als ENTWURF auf der Wissensseite, violett gekennzeichnet. Sie erfindet nichts dazu; ohne KI-Schlüssel arbeitet ein ehrlicher, regelbasierter Ersatz und sagt das klar. Du prüfst, änderst und entscheidest — automatisch gespeichert wird nie. |
| `chelp.structureNow.title` | Erfassen (captureHelp) | Struktur vorschlagen |
| `chelp.submitReview.body` | Erfassen (captureHelp) | Macht aus deinem Entwurf ein Wissensobjekt und gibt es in die Peer-Prüfung: Kollegen prüfen, stellen Rückfragen oder geben frei. Ab jetzt ist es für andere sichtbar — aber ehrlich als „in Prüfung“ markiert, NICHT als gesichert. Validiert wird es erst durch genug Freigaben; für Antworten zählt es erst danach. |
| `chelp.submitReview.title` | Erfassen (captureHelp) | Prüfen & einreichen |
| `chelp.tagsField.body` | Erfassen (captureHelp) | Kurze Stichworte, über die dein Wissen in Suche und Filtern auftaucht („aluminium“, „frist“, „hygiene“). Nutze Begriffe, nach denen Kollegen wirklich suchen würden, und bleib konsistent mit vorhandenen Schlagwörtern. Sie sind jederzeit änderbar und beeinflussen die Prüfung nicht. |
| `chelp.tagsField.title` | Erfassen (captureHelp) | Schlagwörter |
| `chelp.tellRaw.body` | Erfassen (captureHelp) | Schreib dein Wissen so auf, wie du es einem neuen Kollegen erzählen würdest — unsortiert ist völlig in Ordnung. Struktur (Titel, Kernaussage, Bedingungen, Maßnahmen) macht im nächsten Schritt die KI als VORSCHLAG, den du prüfst und änderst. Nichts wird automatisch gespeichert oder eingereicht. |
| `chelp.tellRaw.title` | Erfassen (captureHelp) | Einfach erzählen |
| `chelp.tellUpload.body` | Erfassen (captureHelp) | Lädst du hier Dokumente hoch (PDF, Word, Text), fließt ihr Text direkt in dein Erzählfeld; Bilder und Videos werden Anhänge des späteren Wissensobjekts. Bei Bildern startet Texterkennung (OCR) nur auf deinen Klick. Es wird nichts hochgeladen, das du nicht siehst — alles bleibt Teil deines Entwurfs. |
| `chelp.tellUpload.title` | Erfassen (captureHelp) | Datei anhängen beim Erzählen |
| `chelp.wizardSteps.body` | Erfassen (captureHelp) | Erfassen läuft in drei Schritten: ERZÄHLEN (Rohwissen loswerden), WISSENSSEITE (prüfen und verfeinern, mit KI-Hilfe), EINREICHEN (in die Peer-Prüfung geben). Fertige Schritte kannst du anklicken und zurückgehen — dabei geht nichts verloren. Erst „Prüfen & einreichen“ macht aus deinem Entwurf ein Wissensobjekt für die Kollegen. |
| `chelp.wizardSteps.title` | Erfassen (captureHelp) | Die drei Schritte |
| `conf.help` | Capture | Wie vertraulich ist dieses Wissen? Öffentlich-intern ist der Standard (keine Einschränkung). Vertraulich und Streng vertraulich markieren sensibles Wissen: solche Objekte werden nie in externe Kontexte gegeben (Output Factory/Export). Die Stufe ist ab dem Erfassen setzbar und später jederzeit änderbar — jede Änderung wird im Audit-Log festgehalten. Hinweis: Diese Kennzeichnung schränkt (noch) nicht ein, WER das Objekt sieht. |
| `editor.template.applyHelp` | BodyTemplateChooser | Fügt die gezeigte Startstruktur in die Wissensseite ein: Ist die Seite leer, wird sie eingesetzt; steht schon etwas drin, wird sie UNTEN angehängt — nichts wird ersetzt oder gespeichert. Die Platzhalter („… ergänzen“) ersetzt du danach durch dein Wissen. |
| `enrich.help` | PublicAiEnrichPanel | Hole zusätzliche Hintergrund-Infos von der Public KI — entweder aus dem Modellwissen oder aus einer belegten Web-Suche. Ergebnisse sind extern und ungeprüft; sie werden nur auf deinen Klick in den Entwurf übernommen und nie automatisch validiert. |
| `help.ask.body` | Hilfeseite | Antworten stammen nur aus validiertem Wissen, mit Quellen und Vertrauen. Ohne Grundlage entsteht eine Wissenslücke. |
| `help.ask.title` | Hilfeseite | Fragen stellen |
| `help.capture.body` | Hilfeseite | Halte Erfahrungswissen formlos fest — per Text, Diktat oder Foto. Die KI strukturiert es, du prüfst und reichst ein. |
| `help.capture.title` | Hilfeseite | Wissen erfassen |
| `help.conflict.body` | Hilfeseite | Widersprüche werden sichtbar gemacht und geführt aufgelöst. Nur Wahrheitskonflikte eskalieren an einen Menschen. |
| `help.conflict.title` | Hilfeseite | Konflikte |
| `help.firststart.body` | Hilfeseite | Frische Instanzen sind zunächst leer. Als Admin kannst du unter Admin 'Demodaten laden', um Beispiel-Wissen, Validierung, Lücken und Konflikte sichtbar zu machen — ideal für Review und Einarbeitung. |
| `help.firststart.title` | Hilfeseite | Erststart & Demodaten |
| `help.intro` | Hilfeseite | Kurze Einstiegshilfe zu den wichtigsten Klarwerk-Abläufen. Suche nach Stichwort oder springe direkt in den passenden Bereich. |
| `help.kicker` | Hilfeseite | Hilfe |
| `help.library.body` | Hilfeseite | Die Bibliothek durchsucht und filtert den Bestand (Art, Status, Kategorie, Tag). Ein Klick öffnet das Wissensobjekt mit Aussage, Quellen/Anhängen, Versionen und Evidenz. |
| `help.library.title` | Hilfeseite | Bibliothek & Wissensobjekt |
| `help.lifecycle.body` | Hilfeseite | Lebenszyklus zeigt fällige Revalidierungen (z. B. nach Asset-Änderungen) und rollenspezifische Lernpfade zum Abhaken. Nach dem Demo-Seed ist ein Beispiel-Lernpfad sichtbar. |
| `help.lifecycle.title` | Hilfeseite | Lebenszyklus & Lernpfade |
| `help.mobile.body` | Hilfeseite | Die mobile Ansicht bündelt Erfassen, Fragen und Nachschlagen. Entwürfe lassen sich offline anlegen und werden synchronisiert, sobald wieder Verbindung besteht. |
| `help.mobile.title` | Hilfeseite | Mobil & Offline |
| `help.noResults` | Hilfeseite | Keine Hilfe zu diesem Stichwort gefunden. |
| `help.open` | Hilfeseite | Hilfe öffnen |
| `help.openCenter` | Hilfeseite | Im Hilfe-Center öffnen |
| `help.openRoute` | Hilfeseite | Bereich öffnen |
| `help.risk.body` | Hilfeseite | Risiko zeigt Wissenslücken, Bus-Faktor und Single-Source-Bereiche. Lücken lassen sich priorisieren, zuweisen oder schließen; Widersprüche werden als Konflikte geführt aufgelöst. |
| `help.risk.title` | Hilfeseite | Risiko, Lücken & Konflikte |
| `help.roles.body` | Hilfeseite | Viewer liest und fragt, Experte erfasst, Controller validiert und klärt, Admin verwaltet. Du siehst nur, was deine Rolle erlaubt. |
| `help.roles.title` | Hilfeseite | Rollen |
| `help.search` | Hilfeseite | Hilfe durchsuchen … |
| `help.stufe2.body` | Hilfeseite | Die erweiterten QM-Sichten (Kapital/Management, Evidence- und Provenance-Index, ModelRun-Protokoll) sind read-only und fensterbasiert. Output erzeugt Dokumente nur aus validiertem Wissen. |
| `help.stufe2.title` | Hilfeseite | Stufe 2: QM, Kapital & Output |
| `help.tasks.body` | Hilfeseite | Hier sammeln sich die dir zugewiesenen Validierungs- und Rückfrage-Aufgaben. Von dort springst du direkt ins jeweilige Wissensobjekt zur Bearbeitung. |
| `help.tasks.title` | Hilfeseite | Meine Aufgaben |
| `help.trust.body` | Hilfeseite | Jede Aussage trägt einen Reifegrad aus Validierung und Nutzung. Vertrauen ist Evidenz, nicht Wahrheit. |
| `help.trust.title` | Hilfeseite | Vertrauen |
| `help.validate.body` | Hilfeseite | Bewerte Objekte grün/gelb/rot. Ab der Schwelle gilt ein Objekt als validiert; rote Bewertungen gehen zurück an den Autor. |
| `help.validate.title` | Hilfeseite | Validieren |
| `help.validation.body` | Hilfeseite | Bewerte Objekte grün/gelb/rot. Ab der Schwelle gilt ein Objekt als validiert; gelb/rot erfordern einen Kommentar und gehen an den Autor zurück. |
| `help.validation.title` | Hilfeseite | Validierung |
| `klara.fieldHint` | Klara-Panel | Tippe in ein Feld oder einen Bereich mit ?-Hilfe — dann erkläre ich ihn hier automatisch. |
| `klara.fieldLabel` | Klara-Panel | Aktives Element |
| `klara.intro` | Klara-Panel | Ich erkläre dir Seiten, Felder und Begriffe. Meine Antworten kommen aus der Hilfe-Bibliothek — was dort fehlt, erfinde ich nicht. |
| `klara.moreHelp` | Klara-Panel | Zur Hilfeseite |
| `klara.noResults` | Klara-Panel | Dazu habe ich noch keinen Eintrag — eine ehrliche Hilfe-Lücke. Die Bibliothek wächst gerade; auf der Hilfeseite findest du die geführten Einstiege. |
| `klara.open` | Klara-Panel | Klara öffnen — Hilfe zu dieser Seite |
| `klara.page.admin` | Klara-Panel | Konten, KI-Zuordnung, Daten und Sicherheit an einem Ort. Nur für Admins sichtbar. |
| `klara.page.analytics` | Klara-Panel | Kennzahlen aus echten Daten plus das unveränderliche Audit-Log — wer hat was wann getan. |
| `klara.page.ask` | Klara-Panel | Stell eine Frage. Die Antwort kommt ausschließlich aus validiertem Wissen mit Quellen — gibt es keins, entsteht eine ehrliche Wissenslücke. |
| `klara.page.capture` | Klara-Panel | Hier sicherst du Erfahrungswissen: erzählen, diktieren, im Interview oder aus einer Datei. Die KI strukturiert nur — du prüfst und reichst ein. |
| `klara.page.conflicts` | Klara-Panel | Widersprüche zwischen Wissensobjekten: sichten, zweite Meinung holen, auflösen — damit die Bibliothek eindeutig bleibt. |
| `klara.page.duplicates` | Klara-Panel | Mögliche Doppelungen: prüfen und zusammenführen, damit Wissen nicht zersplittert. |
| `klara.page.external` | Klara-Panel | Externes Wissen (z. B. Web-Quellen) — immer Stufe 2: nie peer-validiert und klar getrennt vom geprüften Bestand. |
| `klara.page.help` | Klara-Panel | Geführte Einstiege, Themen und Suche. Ich bin der schnelle Weg — für die Tiefe lohnt sich diese Seite. |
| `klara.page.koDetail` | Klara-Panel | Die Detailseite eines Wissensobjekts: Inhalt, Versionen, Quellen, Anhänge, Prüf-Historie und Aktionen je nach Rolle. |
| `klara.page.library` | Klara-Panel | Alle Wissensobjekte mit Status, Vertrauen und Filtern. Von hier geht es in jedes Detail. |
| `klara.page.lifecycle` | Klara-Panel | Wissen altert: Hier siehst du fällige Re-Validierungen und Lernpfade, damit Geprüftes geprüft bleibt. |
| `klara.page.profile` | Klara-Panel | Dein Konto: Name, Sprache, Abmelden. |
| `klara.page.risk` | Klara-Panel | Wo ist Wissen dünn oder hängt an einer Person? Offene Lücken, Bus-Faktor und Domänen-Risiko — mit Links zu den betroffenen Objekten. |
| `klara.page.start` | Klara-Panel | Dein Überblick: was frisch gesichert wurde, was heute geholfen hat und was auf dich wartet. Von hier springst du direkt in jeden Bereich. |
| `klara.page.tasks` | Klara-Panel | Deine offenen Aufgaben: zugewiesene Prüfungen, Lücken und Fälligkeiten — mit direktem Absprung zur jeweiligen Arbeit. |
| `klara.page.validation` | Klara-Panel | Das Prüf-Board: Du bewertest eingereichtes Wissen. Erst mit genug grünen Freigaben (und ohne rote) gilt ein Objekt als validiert. |
| `klara.pageLabel` | Klara-Panel | Du bist hier |
| `klara.resultsFor` | Klara-Panel | Treffer für: {{q}} |
| `klara.searchPlaceholder` | Klara-Panel | Hilfe durchsuchen … z. B. Validierung, Bus-Faktor, Entwurf |
| `klara.selectionEmpty` | Klara-Panel | Markiere zuerst einen Begriff auf der Seite — dann suche ich die passende Erklärung. |
| `klara.selectionExplain` | Klara-Panel | Markierung erklären |
| `klara.subtitle` | Klara-Panel | Deine Hilfe in KLARWERK |
| `klara.title` | Klara-Panel | Klara |
| `ko.couple.help` | KnowledgeDetail | Koppelst du dieses Wissen an eine Anlage, wird es bei „Anlage geändert“ (Lebenszyklus) automatisch zur Prüfung markiert — Wissen bleibt aktuell. |
| `ko.helpful` | KnowledgeDetail | Hat geholfen |
| `ko.helpfulDone` | KnowledgeDetail | Danke für dein Signal! |
| `ko.helpfulHint` | KnowledgeDetail | Hat dir dieses Wissen in der Praxis geholfen? |
| `ko.helpfulThanks` | KnowledgeDetail | Danke — als hilfreich vermerkt. |
| `ko.helpfulTitle` | KnowledgeDetail | Bewährung |
| `nav.help` | Help,Topbar,klaraRegistry,navigation | Hilfe |
| `pilot.check.capture` | Hilfeseite (Pilot-Checkliste) | Erfassen speichert offen: frisch erfasstes Wissen ist noch nicht validiert. |
| `pilot.check.gap` | Hilfeseite (Pilot-Checkliste) | Keine Grundlage? Die Lücke wird ehrlich benannt und führt in die Erfassung — kein erfundenes Wissen. |
| `pilot.check.maintain` | Hilfeseite (Pilot-Checkliste) | Revalidierung ist „Aktuell halten“: fällige Objekte erneut prüfen, keine automatische Dauergültigkeit. |
| `pilot.check.use` | Hilfeseite (Pilot-Checkliste) | Fragen/Bibliothek nutzen Wissen quellen- und statusbewusst: eine Antwort ist nur so belastbar wie ihre Quelle. |
| `pilot.check.validation` | Hilfeseite (Pilot-Checkliste) | Validierung ist Review/Entscheidung: Peers bewerten, bis es gesichert ist — keine automatische Freigabe. |
| `pilot.next.ask` | Hilfeseite (Pilot-Checkliste) | Beispiel-Frage öffnen |
| `pilot.next.checklist` | Hilfeseite (Pilot-Checkliste) | Pilot-Checkliste öffnen |
| `pilot.next.hint` | Hilfeseite (Pilot-Checkliste) | Demodaten sind Beispiele, kein produktiver Beweis. Jetzt Stage-1 ansehen oder die Pilot-Checkliste öffnen. |
| `pilot.next.start` | Hilfeseite (Pilot-Checkliste) | Stage-1 starten (Start öffnen) |
| `pilot.next.title` | Hilfeseite (Pilot-Checkliste) | Nächster Schritt |
| `pilot.obs.mapLabel` | Hilfeseite (Pilot-Checkliste) | Gehört in |
| `pilot.obs.missing.label` | Hilfeseite (Pilot-Checkliste) | Wissen fehlt ganz (keine Grundlage zur Frage). |
| `pilot.obs.missing.map` | Hilfeseite (Pilot-Checkliste) | Risiko/Lücke — priorisieren und erfassen. |
| `pilot.obs.openFlow` | Hilfeseite (Pilot-Checkliste) | Fluss öffnen |
| `pilot.obs.outdated.label` | Hilfeseite (Pilot-Checkliste) | Wissen wirkt veraltet oder nicht mehr gültig. |
| `pilot.obs.outdated.map` | Hilfeseite (Pilot-Checkliste) | Lebenszyklus — Revalidierung, „Aktuell halten“. |
| `pilot.obs.source.label` | Hilfeseite (Pilot-Checkliste) | Quelle, Trust oder Nutzbarkeit ist unklar. |
| `pilot.obs.source.map` | Hilfeseite (Pilot-Checkliste) | Bibliothek/KO-Detail — Status, Trust, Version, Quelle prüfen. |
| `pilot.obs.subtitle` | Hilfeseite (Pilot-Checkliste) | Beobachtete Reibung schnell dem passenden bestehenden Klarwerk-Fluss zuordnen. Nichts wird gespeichert; reine UX-Notizen gehören außerhalb des Produkts. |
| `pilot.obs.title` | Hilfeseite (Pilot-Checkliste) | Pilot-Befund einordnen |
| `pilot.obs.unverified.label` | Hilfeseite (Pilot-Checkliste) | Wissen ist unfertig oder noch nicht geprüft. |
| `pilot.obs.unverified.map` | Hilfeseite (Pilot-Checkliste) | Validierung — bewerten, bis es gesichert ist. |
| `pilot.obs.uxnote.label` | Hilfeseite (Pilot-Checkliste) | Reine UX-/Pilotnotiz (Bedienung, Wording, Ablauf). |
| `pilot.obs.uxnote.map` | Hilfeseite (Pilot-Checkliste) | Organisatorisch notieren — wird nicht im Produkt gespeichert, kein Workflow. |
| `pilot.subtitle` | Hilfeseite (Pilot-Checkliste) | Worauf im ersten echten Lauf achten — Stage-1, ehrlich. Jeder Punkt führt in den passenden Bereich. |
| `pilot.title` | Hilfeseite (Pilot-Checkliste) | Pilot-Checkliste: erster Nutzerlauf |
| `reasoner.taskInfo.bodyCloud` | (!)-Info an KI-Knöpfen | Diese Aufgabe läuft über eine Cloud-KI. Inhalte werden dafür an den externen Anbieter gesendet. |
| `reasoner.taskInfo.bodyLocal` | (!)-Info an KI-Knöpfen | Diese Aufgabe läuft über ein lokales Modell auf eurer eigenen Hardware — die Inhalte verlassen das Haus nicht. |
| `reasoner.taskInfo.bodyRule` | (!)-Info an KI-Knöpfen | Diese Aufgabe läuft rein regelbasiert, ohne KI-Sprachmodell — deterministisch und ohne externen Versand. |
| `reasoner.taskInfo.bodyUnknown` | (!)-Info an KI-Knöpfen | Die aktuelle KI-Zuordnung wird geladen. Details stehen in der KI-Verwaltung. |
| `reasoner.taskInfo.cloud` | (!)-Info an KI-Knöpfen | Cloud-KI |
| `reasoner.taskInfo.dsgvoExternal` | (!)-Info an KI-Knöpfen | Externe Verarbeitung |
| `reasoner.taskInfo.dsgvoExternalBody` | (!)-Info an KI-Knöpfen | Nutzt einen externen Cloud-Anbieter — die DSGVO-Konformität hängt vom Auftragsverarbeitungsvertrag (AVV) mit dem Anbieter ab. |
| `reasoner.taskInfo.dsgvoInhouse` | (!)-Info an KI-Knöpfen | DSGVO-konform |
| `reasoner.taskInfo.dsgvoInhouseBody` | (!)-Info an KI-Knöpfen | Läuft im Haus (lokal bzw. regelbasiert) — die Daten bleiben hier und werden nicht an Dritte übermittelt. |
| `reasoner.taskInfo.local` | (!)-Info an KI-Knöpfen | Lokales Modell |
| `reasoner.taskInfo.modelLabel` | (!)-Info an KI-Knöpfen | Modell |
| `reasoner.taskInfo.rule` | (!)-Info an KI-Knöpfen | Regelbasiert (ohne KI-Modell) |
| `reasoner.taskInfo.title` | (!)-Info an KI-Knöpfen | Welche KI arbeitet hier? |
| `reasoner.taskInfo.unknown` | (!)-Info an KI-Knöpfen | Wird ermittelt … |
| `risk.help.busfactor` | Risk | Wie stark hängt eine Domäne an einzelnen Personen? Ein roter Balken heißt: Das Wissen kommt nur aus EINER Quelle — fällt sie aus, ist es verloren. Grün = mehrere Quellen, also robuster. Der Balken zeigt zusätzlich die Wissensmenge der Domäne. |
| `risk.help.cockpit` | Risk | Risiko je Domäne (Kategorie): KRITISCH/MITTEL/GUT fasst zusammen, wie gut die Domäne abgesichert ist. Objekte = wie viel Wissen; validiert % = wie viel davon geprüft ist; offen = noch ungeprüft; Experten = wie viele Personen die Domäne tragen. Ein Experte + wenig validiert = hohes Risiko. |
| `risk.help.gaps` | Risk | Offene Wissenslücken sind gestellte Fragen, auf die es (noch) keine gesicherte Antwort gibt. Priorisiere sie, weise sie einer Person zu oder erfasse selbst geprüfte Erfahrung dazu. Aus datenschutzgründen keine sensiblen Details in die Frage schreiben. |
| `risk.help.summary` | Risk | Überblick in Zahlen: Offene Lücken (Fragen ohne gesichertes Wissen), Hohe Priorität (dringend), Unzugewiesen/Zugewiesen (ob jemand die Lücke bearbeitet), Offene Konflikte (widersprüchliche Aussagen) und Geschlossene Lücken (bereits beantwortet). Rote Zahlen zeigen Handlungsbedarf. |
| `start.livewall.helped` | Start | Hat geholfen |
| `start.livewall.helpedEmpty` | Start | Noch keine „hat geholfen“-Rückmeldung. |
| `start.livewall.helpedToday` | Start | heute geholfen: {{n}} |
| `val.feedback.helpHint` | KnowledgeDetail,Validation | Dein Feedback hilft dem Autor, die nächste Version gezielt nachzuarbeiten. |
| `vhelp.approve.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du bestätigst nach eigener Prüfung: Diese Aussage ist fachlich richtig und so anwendbar. Nutze das erst, wenn du Kernaussage, Bedingungen und Maßnahmen wirklich beurteilt hast — deine Freigabe zählt als eine von mehreren nötigen Prüfstimmen. Danach steigt das Vertrauen des Objekts; VALIDIERT wird es erst, wenn genug Prüfer freigegeben haben. Nichts wird automatisch veröffentlicht oder verändert — deine Stimme wird gezählt, mehr nicht. |
| `vhelp.approve.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Freigeben |
| `vhelp.assign.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du bittest eine bestimmte Kollegin oder einen Kollegen um die Prüfung dieses Objekts. Die Person sieht es danach in ihrer persönlichen Review-Liste („Mir zugewiesen“) und bekommt eine Benachrichtigung über die Glocke. Die Zuweisung ist eine Einladung, keine Bewertung: Sie ändert weder Status noch Vertrauen, und geprüft wird erst, wenn die Person selbst entscheidet. |
| `vhelp.assign.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Prüfer zuweisen |
| `vhelp.conflictEscalate.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Hebt einen offenen Sach-Konflikt eine Stufe höher, wenn die Beteiligten ihn nicht selbst klären können — dann entscheidet die fachlich zuständige Instanz. Nutze das, wenn zwei validierte Aussagen einander hart widersprechen und keine Seite nachgeben kann. Der Konflikt bleibt offen und sichtbar, bis eine dokumentierte Entscheidung fällt. |
| `vhelp.conflictEscalate.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Eskalieren |
| `vhelp.conflictForm.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Drei Angaben machen die Meldung auflösbar: das GEGEN-Objekt (womit widerspricht sich dieses Wissen?), die KONFLIKTART (z. B. Widerspruch in der Sache oder in der Zuständigkeit) und eine kurze BESCHREIBUNG des Widerspruchs mit deinem Kontext. Nach dem Absenden entsteht ein offener Konfliktfall — beide Objekte bleiben nutzbar markiert, bis der Konflikt bewusst aufgelöst ist. |
| `vhelp.conflictForm.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Konflikt beschreiben |
| `vhelp.conflictResolve.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Hält die Entscheidung fest, wie mit dem Widerspruch umzugehen ist — welche Aussage gilt, unter welchen Bedingungen, und warum. Die Auflösung DOKUMENTIERT nur: Sie ändert keines der beteiligten Wissensobjekte automatisch. Wenn ein Objekt danach überarbeitet oder neu bestätigt werden sollte, zeigt die App eine Revalidierungs-Empfehlung — auch das bleibt eine bewusste menschliche Handlung. |
| `vhelp.conflictResolve.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Konflikt auflösen |
| `vhelp.conflictSecondOpinion.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Bittet eine weitere fachkundige Person um ihre Einschätzung zum Konflikt und hält sie schriftlich fest. Eine gute Zweitmeinung nennt Fakten und Quellen, nicht nur ein Bauchgefühl. Sie entscheidet den Konflikt nicht automatisch — sie ist Material für die spätere Auflösung. |
| `vhelp.conflictSecondOpinion.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Zweitmeinung einholen |
| `vhelp.contribution.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du kennst eine Ergänzung, Korrektur oder Fundstelle, willst aber nicht selbst am Objekt arbeiten? Beschreibe sie hier — dein Hinweis wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Anders als „Quelle hinzufügen“ entsteht dabei KEIN Quellen-Eintrag; es ist eine Nachricht an die Menschen, kein Beleg am Objekt. |
| `vhelp.contribution.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Beitrag oder Fundstelle melden |
| `vhelp.deleteKo.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Entfernt dieses Wissensobjekt endgültig — erlaubt nur für den Autor selbst sowie Controller und Admin; der Server erzwingt dieselbe Regel. Vor dem Löschen fragt die Inline-Bestätigung bewusst nach. Die Löschung wird im Audit protokolliert. Wenn das Wissen nur veraltet ist, ist Überarbeiten oder ein Konflikt der ehrlichere Weg als Löschen. |
| `vhelp.deleteKo.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Wissensobjekt löschen |
| `vhelp.feedbackForm.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Rückfrage und Ablehnung brauchen immer eine Begründung — sie wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Schreib konkret, was fehlt oder falsch ist und was der Autor nachtragen soll. Erst mit Text lässt sich absenden; Abbrechen verwirft nur deine Eingabe, keine Bewertung. |
| `vhelp.feedbackForm.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Begründung (Pflicht) |
| `vhelp.filters.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Grenzt die Prüfliste nach Volltext, Wissensart, Kategorie oder Schlagwort ein. Nutze das, wenn die Liste lang ist und du gezielt dein Fachgebiet prüfen willst. Es geht nichts verloren: Filter ändern nur, was du gerade siehst — alle Objekte bleiben in der Prüfung. |
| `vhelp.filters.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Suchen & filtern |
| `vhelp.helpful.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Ein Bewährungssignal aus der Praxis: Du hast dieses Wissen angewendet, und es hat funktioniert. Das stärkt das Vertrauen des Objekts ein Stück und wird im Verlauf vermerkt. Es ist KEINE Prüfstimme — Validierung entsteht weiterhin nur durch bewusste Prüfentscheidungen von Kollegen. |
| `vhelp.helpful.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Hat geholfen |
| `vhelp.markTrue.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Als Admin schließt du die Validierung dieses Objekts in einem Schritt ab — unabhängig von den Peer-Bewertungen. Der Status wird auf „validiert“ gesetzt und das Vertrauen auf die höchste Stufe gehoben. Nutze das bewusst und nur, wenn du die Aussage wirklich verantworten kannst, denn du überspringst damit die mehrfache Gegenprüfung durch andere. Der Vorgang wird im Audit-Log mit deinem Namen festgehalten und lässt sich später über eine erneute Bearbeitung/Revision wieder in die Prüfung zurückholen. |
| `vhelp.markTrue.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Als wahr kennzeichnen (nur Admin) |
| `vhelp.mineOnly.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Zeigt deine persönliche Review-Liste: Objekte, die dir jemand bewusst zugewiesen hat. Nutze sie, um zuerst die Arbeit zu erledigen, auf die Kollegen warten. Die Zuweisung ist eine Bitte, keine Pflichtprüfung — entschieden wird erst, wenn du selbst bewertest. |
| `vhelp.mineOnly.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Nur mir zugewiesene |
| `vhelp.originFilter.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Blendet die Liste nach Herkunft ein: Demo-Beispiele oder eigenes Wissen deiner Organisation. Das ist nur eine Ansicht zum Auffinden — es ändert keinen Prüfstatus und verwirft nichts. Die Zahl hinter jedem Filter zeigt, wie viele Einträge er enthält. |
| `vhelp.originFilter.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Herkunft filtern |
| `vhelp.query.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du hältst das Wissen für brauchbar, aber etwas ist unklar, unvollständig oder nur unter Bedingungen richtig. Ein kurzer Kommentar ist Pflicht — er ist deine Hilfe an den Autor: Was genau fehlt, was soll er nachtragen? Danach bleibt das Objekt in Prüfung und der Autor sieht deine Rückfrage als Kommentar am Wissensobjekt. Es wird nichts abgelehnt, nichts freigegeben und nichts automatisch geändert — die Überarbeitung macht der Autor bewusst selbst. |
| `vhelp.query.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Rückfrage stellen |
| `vhelp.reject.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du hältst die Aussage für falsch, veraltet oder riskant. Auch hier ist die Begründung Pflicht — ohne sie kann der Autor nichts lernen und nichts korrigieren. Danach fließt deine Ablehnung in den Prüfstand des Objekts ein; es wird dadurch NICHT gelöscht und NICHT gesperrt, sondern bleibt sichtbar in Prüfung, bis Autor oder Controller reagieren. Wenn zwei gesicherte Aussagen einander widersprechen, ist „Konflikt melden“ der bessere Weg als eine Ablehnung. |
| `vhelp.reject.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Ablehnen |
| `vhelp.reportConflict.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du zeigst an, dass dieses Wissen einem ANDEREN Wissensobjekt widerspricht — etwa zwei unterschiedliche Grenzwerte für denselben Fall. Danach erscheint der Fall auf der Konflikte-Seite und wird dort bewusst aufgelöst (Zweitmeinung, Eskalation, dokumentierte Entscheidung). Beide Objekte bleiben unverändert bestehen — es wird nichts automatisch korrigiert, überschrieben oder gelöscht. |
| `vhelp.reportConflict.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Konflikt melden |
| `vhelp.reviewFocus.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Unterscheidet neue Einreichungen von überarbeiteten (Version größer 1). Überarbeitete Objekte lohnen einen gezielten Blick auf die Änderung — was war die Rückfrage, was wurde angepasst? Auch das ist nur eine Ansicht: Es ändert keinen Status und ersetzt keine Entscheidung. |
| `vhelp.reviewFocus.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Review-Fokus |
| `vhelp.signals.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Die Zeile zeigt, wie belastbar das Objekt JETZT ist: Vertrauensbalken und Trust-Wert (aus Prüfstimmen und Bewährung), Version, „Ziel n“ (so viele Freigaben braucht es bis VALIDIERT), dazu Marker wie ÜBERTRAGEN (Autor gewechselt — extra Blick) oder ZUGEWIESEN. Nichts davon ist eine Bewertung durch dich — es ist die ehrliche Ausgangslage für deine Entscheidung. |
| `vhelp.signals.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Review-Signale lesen |
| `vhelp.sourceAdd.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Hängt die beschriebene Quelle als Stufe-2-Beleg an dieses Wissensobjekt. Sie bleibt über Versionen hinweg erhalten und ist für alle sichtbar. Es passiert nichts weiter automatisch: Der Inhalt der Quelle wird nicht ins Wissen übernommen, nicht geprüft und nicht bewertet — sie steht als Beleg daneben. |
| `vhelp.sourceAdd.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Quelle hinzufügen |
| `vhelp.sourceFields.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Drei Angaben machen eine Quelle brauchbar: Die BEZEICHNUNG sagt, was es ist („DIN EN 1090, Abschnitt 7“), die URL führt hin (leer lassen bei Papier- oder internen Quellen), der AUSZUG zitiert die eine entscheidende Stelle wörtlich — so muss niemand das ganze Dokument lesen, um die Aussage zu prüfen. Je konkreter der Auszug, desto mehr hilft die Quelle den Prüfern. |
| `vhelp.sourceFields.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Quelle beschreiben |
| `vhelp.sourceSearch.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Sucht nach externen Belegen zu diesem Thema. Die Suche läuft über den KLARWERK-Server — deine Anfrage geht nicht direkt von deinem Browser an externe Dienste. Die Treffer sind unverbindliche Vorschläge: Nichts davon wird automatisch angehängt. Prüfe Titel und Ausschnitt, öffne im Zweifel den Link — und erst „Anhängen“ übernimmt einen Treffer bewusst als Stufe-2-Quelle. |
| `vhelp.sourceSearch.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Quellen suchen |
| `vhelp.sourcesLevel2.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Hier hängen externe Belege am Wissensobjekt: Normen, Handbücher, Artikel, interne Dokumente. Das Badge „Stufe 2“ bedeutet ehrlich: Diese Quelle wurde NICHT von Kollegen peer-geprüft — sie stützt das Wissen, ersetzt aber keine einzige Prüfstimme. Antworten der Fragen-Seite bauen auf validiertem Wissen auf, nicht auf Stufe-2-Quellen allein. Das X entfernt nur die Verknüpfung — Wissen, Status und Vertrauen bleiben unverändert. |
| `vhelp.sourcesLevel2.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Externe Quellen (Stufe 2) |
| `vhelp.stillValid.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Du bestätigst, dass dieses bereits geprüfte Wissen aus deiner Sicht weiterhin stimmt — ein Frische-Signal, kein neues Prüfverfahren. Nutze es, wenn du das Wissen gerade angewendet oder bewusst gegengelesen hast. Danach wird die Bestätigung mit Datum vermerkt und das Objekt gilt als kürzlich bestätigt. Es ersetzt keine Peer-Prüfung und hebt keine Rückfragen oder Konflikte auf. |
| `vhelp.stillValid.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Noch gültig |
| `vhelp.transfer.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Übergibt die Verantwortung für dieses Wissen an eine andere Person — etwa wenn jemand das Unternehmen verlässt oder die Zuständigkeit wechselt. Der ursprüngliche Autor bleibt dauerhaft sichtbar (Herkunft geht nie verloren). Übertragene Objekte bekommen im Review einen Extra-Blick, weil das Wissen nun jemand verantwortet, der es nicht selbst erfasst hat. |
| `vhelp.transfer.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Autor übertragen |
| `vhelp.validity.body` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Diese Werte werden ehrlich aus dem aktuellen Zustand ABGELEITET, nicht gespeichert: Frische (wann zuletzt bestätigt oder geändert), Output-Eignung (dürfte dieses Wissen in erzeugte Dokumente?) und eine Empfehlung, was als Nächstes sinnvoll ist. Ändern kannst du sie nur indirekt — durch Prüfen, Bestätigen oder Überarbeiten des Wissens selbst. |
| `vhelp.validity.title` | Prüfbereich/KO-Detail/Konflikte (reviewHelp) | Gültigkeit & Schutz |
| `xtr.help.body` | bodyExtract | Die KI liest ein von dir hochgeladenes Dokument und schlägt Wissenspunkte vor — jeder Punkt trägt seine Belegstelle aus dem Dokument (ohne Beleg keine Übernahme). Du wählst per Häkchen aus; Ausgewähltes wird als Abschnitt an deinen Artikel ANGEHÄNGT, nichts wird ersetzt oder überschrieben. Die Herkunft (Dateiname + Belegstelle) wird als Stufe-2-Quelle am Wissensobjekt vermerkt — sie gilt nicht als peer-validiert und ersetzt keine Prüfung. |
| `xtr.help.title` | bodyExtract | Aus Dokument ergänzen |
