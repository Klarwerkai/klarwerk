# Prüfnachweise an ihre Quellen- und Kontextbasis binden

*Aufnahme 20260922 · Prüfbasis-Aktualität (Fall 7). Gilt für den KI-Prüfnachweis `aiCheck` am
Wissensobjekt. Umsetzung: `services/knowledge-object/src/pruefbasis.ts`. Fortgeschrieben in Runde 2
nach Bens Befunden (Vergleichsquellen, Altbestand, serverseitige Bewertung, Suchkandidatenweg).*

## Die Frage

Ein fertiger Prüfnachweis (`aiCheck` = done/failed) durfte als aktuell erscheinen, obwohl sich seit
dem Lauf etwas geändert hatte, das die Prüfung betrifft. Die vorhandene Sicherung band den Lauf nur
an die Inhaltsfassung des geprüften Objekts (`koVersion`, bedingter Abschluss) — und nur, solange
der Lauf noch wartete. Einordnung, Vertraulichkeit, Quellen und Anhänge ändern sich ohne
Versionssprung; und die Prüfung urteilt nicht über das Objekt allein, sondern über das Objekt
**gegen den Bestand**: jede Vergleichsquelle, die sie gelesen hat, und die Menge, aus der sie ihre
Kandidaten gewählt hat, gehören zu ihrer Grundlage.

Zu entscheiden war: **globale Basisbindung** (jede Änderung der Basis entwertet den ganzen Nachweis)
oder **selektive Wiederverwendung** über einen qualifizierten Abhängigkeitsfingerabdruck (der
Nachweis bleibt gültig, solange nachweislich keine Eingabe geändert wurde, von der das Urteil abhing).

## Entscheidung: globale Basisbindung je Nachweis

Ein Prüfnachweis gilt nur für genau die Basis, unter der sein Lauf **gestartet** ist. Jede Änderung
irgendeines Teils dieser Basis macht den ganzen Nachweis überholt. Es gibt keine selektive
Wiederverwendung.

### Geltungsbereich — die drei Teile der Basis

| Teil | Felder | Warum |
| --- | --- | --- |
| Quelle | Inhaltsfassung `version`; Kennungen der Quellen (`sources`) und Anhänge (`attachments`) des geprüften Objekts | Titel, Kernaussage, Bedingungen, Maßnahmen und Fließtext ändern sich nur mit der Fassung. Quellen und Anhänge kommen ohne Versionssprung hinzu oder fallen weg. |
| Kontext | Kategorie, Schlagworte, Anlage (`asset`), Vertraulichkeit des geprüften Objekts | Sie steuern Kandidatenwahl und Modellweg (vertrauliche Paare gehen nie in die Cloud) und ändern sich ohne Versionssprung. |
| Bestand | Quelle und Kontext **jedes** aktiven Objekts ohne Vorführdaten — derselbe Pool, aus dem `detectConflictsForKo`/`detectDuplicatesForKo` ihre Kandidaten wählen | Das sind die Vergleichsquellen und der Auswahlkontext. Eine neue Fassung, eine Umordnung, ein Zugang oder ein Abgang im Pool kann das Urteil ändern. |

**Gleicher Text genügt nie:** die Fassungsnummer gehört zur Quelle — beim geprüften Objekt wie bei
jeder Vergleichsquelle. Eine neue Fassung mit zeichengleichem Inhalt ist eine neue Basis.

**Unbelegt ist überholt:** ein abgeschlossener Nachweis ohne vollständige gespeicherte Basis
(Altbestand von vor dieser Lieferung, auch mit `koVersion`) belegt keinen Stand und wird als
überholt gelesen. Abruf und Wiederholung erneuern ihn.

### Was ausdrücklich nicht zur Basis gehört

- **Ablauf- und Ergebnisfelder** — Prüfstatus, Vertrauenswert, Zuweisungen, Kommentare, Eigentum, der
  Nachweis selbst, abgeleitete Suchfelder — an keinem Objekt des Bestands. Sie sind *Folgen* von
  Prüfung und Bewertung. Wären sie Basis, entwertete eine Prüfung, die einen Konflikt anlegt und
  damit den Prüfstatus eines Objekts ändert, sich selbst: eine Schleife ohne Ende.
- **Prüfregeln** (Duplikat-Schwelle, Kandidatendeckel) — siehe „Verbleibende Folgen".

### Begründung gegen die selektive Wiederverwendung

Selektive Wiederverwendung („nur ein nicht verglichenes Objekt hat sich geändert, das Urteil gilt
weiter") verlangt einen **qualifizierten** Nachweis, von welchen Eingaben das Urteil abhing. Den
gibt es nicht: die Erkennung wählt ihre Vergleichskandidaten gedeckelt (`DETECTION_CANDIDATE_CAP`)
aus dem ganzen Pool, die Wahl hängt von Kategorie, Schlagworten und Text jedes Poolobjekts ab, und
das Abdeckungsprotokoll hält nur Zahlen fest, keine Kennungen. Auch „welche Objekte tatsächlich
verglichen wurden" wäre allein nicht qualifiziert: ein Zugang zum Pool kann die Auswahl ändern.
Ohne diesen Nachweis wäre jede selektive Weitergeltung eine Behauptung. Die globale Bindung ist
konservativ: sie kostet im schlechtesten Fall Läufe zu viel, nie ein falsches „aktuell".

## Umsetzung im bestehenden AiCheck-Weg

- **Gespeichert** wird die Basis als drei Fingerabdrücke (`aiCheck.basis = { quelle, kontext,
  bestand }`), kein Inhalt. `markAiCheckPending` bindet die angeforderte Basis; der Worker liest die
  Basis beim **Laufstart** und schreibt das Ergebnis an sie gebunden (`resolveAiCheck(…, basis)`).
  Die Import-Annahme (synchroner Lauf) bindet ebenfalls die Basis beim Laufstart.
- **Schreibstand wiederverwendet:** der Bestandsfingerabdruck braucht den ganzen aktiven Bestand.
  `KoService.pruefbestandStempel()` merkt ihn am Schreibstand der Ablage (`ko_schreibstand`,
  JOB 2706 D1): solange der Stand gleich ist, hat niemand am Bestand geschrieben, und der gemerkte
  Stempel gilt. Der Stand wird vor dem Bestand gelesen; ein Schreiben dazwischen erhöht ihn, und der
  nächste Leser rechnet neu. Prüf-Vermerke erhöhen den Stand nicht; Ablaufschreiben (Vertrauen,
  Status) erhöhen ihn, ändern den Stempel aber nicht. Der Schreibstand ist damit Merk-Schlüssel,
  nicht Basis — als Basis entwertete er nach jedem Ablaufschreiben jeden Nachweis.
- **koVersion-Sicherung wiederverwendet:** der bedingte Abschluss in SQL (`resolveAiCheck` mit
  `expectedKoVersion`) bleibt unverändert die harte Schreibbedingung; die Basisbindung kommt hinzu.
- **Gelesen** wird `aiCheck.ueberholt` bei jedem Lesen neu aus der gespeicherten Basis gegen das
  jetzige Objekt und den jetzigen Bestand abgeleitet — nie gespeichert, nie geglaubt. Lesepfade:
  `KoService.get`, `list`, `listForSearch`, `findCandidates` (Suchkandidaten, Ask/Klara),
  `findByImportCandidateId` und die Rückgabewerte der Mutationspfade (`mutateKo`, `mutateKoTx`,
  `mutateKoMetadata`). Prüfliste, Detailabruf, Erfassen-Karte, Antwort-Einstufung (Web und Server),
  Deckungslage am eigenen Objekt und Abdeckungs-Zusammenfassung lesen damit dieselbe gespeicherte
  Bindung; ein Neuladen ändert nichts daran.
- **Änderung zwischen Start und Ergebnis:** der Worker vergleicht vor dem Schreiben die Basis
  (einschließlich Bestand) mit der Startbasis. Ist sie gewandert — auch weil eine Vergleichsquelle
  während des Urteils neu gefasst wurde —, wird **kein** Ergebnis eingetragen; der Lauf wird für
  die neue Basis frisch vermerkt und (gedeckelt, `MAX_AI_CHECK_AUTO_RETRIES` je Zielbasis) neu
  eingereiht. Das enge Restfenster zwischen Probe und Schreiben deckt die Bindung selbst: das
  Ergebnis trägt die Startbasis und wird deshalb als überholt gelesen.
- **Abruf und Wiederholung:** der Abruf der Prüfliste reiht überholte (und unbelegte) Nachweise neu
  ein (`shouldReEnqueueAiCheck`); die Antwort zeigt sofort den frischen, laufenden Vermerk statt des
  alten Ergebnisses. Der Wiederholen-Knopf (`POST /api/kos/:id/ai-check`) nimmt überholte und
  unbelegte Nachweise an; ein aktueller fertiger Nachweis bleibt `409 AI_CHECK_NOT_RETRYABLE`.
  Doppelaufträge verhindert die bestehende Dedupe des Workers (Warteschlange + laufender Job).
- **Anzeige:** Badge der Prüfliste „Prüfung überholt" mit Wiederholen-Knopf vor jedem done-/failed-
  Zustand; Erfassen-Karte mit Hinweis statt „geprüft"; Antwort-Einstufung (Web **und**
  `services/ask/src/answer-evidence.ts`), Deckungslage (`deckungAus`) und Abdeckungs-Zusammenfassung
  zählen überholt als unvollständig. Texte in DE/EN/NL (`apps/web/src/texte/pruefbasis.ts`).
- **Rechte:** unverändert. Die Prüfliste filtert weiterhin vor dem Neu-Einreihen nach Sichtbarkeit;
  die Wiederholung verlangt weiterhin `ko.validate`.

## Verbleibende Folgen

1. **Deutlich mehr Läufe.** Jede basisrelevante Änderung irgendwo im Bestand — neue Fassung,
   Einordnung, Vertraulichkeit, Quelle, Anhang, Anlegen, Löschen, Wiederherstellen — macht **alle**
   fertigen Nachweise überholt. Neu gelaufen wird beim nächsten Abruf der Prüfliste (nur deren
   sichtbare Einträge) oder per Wiederholung; die übrigen stehen bis dahin sichtbar als überholt da.
   Ein neu eingereihter Eintrag ist in der Prüfliste bis zum Abschluss als „läuft" gesperrt — wie
   nach einer Überarbeitung. Bei regem Schreiben und vielen offenen Einträgen kann die Liste dadurch
   länger gesperrt sein (ein Lauf zur Zeit, `AI_CHECK_CONCURRENCY = 1`). Entlastung wäre erst mit
   einem qualifizierten Abhängigkeitsnachweis möglich (Kandidatenkennungen samt Basis und die
   Auswahlregel im Protokoll) — nicht Teil dieser Lieferung.
2. **Lesekosten.** Nach jedem Schreiben am Bestand rechnet der erste Leser eines fertigen Nachweises
   den Bestandsstempel neu (`repo.list({})` über den ganzen Bestand, zwei SHA-256 je Objekt).
   Zwischen zwei Schreibvorgängen gilt der gemerkte Stempel. Eine schlanke Datenbankabfrage nur der
   Basisfelder wäre die nächste Ausbaustufe.
3. **Prüfregeln sind nicht Teil der Basis.** Eine geänderte Duplikat-Schwelle oder ein anderer
   Kandidatendeckel entwerten vorhandene Nachweise nicht; sie gelten für künftige Läufe.
4. **Altbestand** wird ab dieser Lieferung vollständig als überholt gelesen und beim nächsten Abruf
   bzw. per Wiederholung erneuert.
5. **Draht:** `aiCheck.basis` (drei Fingerabdrücke) ist ein neues Feld am Drahtvertrag,
   `aiCheck.ueberholt` ein abgeleitetes. Beide tragen keinen Inhalt.
