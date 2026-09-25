# Prüfnachweise an ihre Quellen- und Kontextbasis binden

*Aufnahme 20260922 · Prüfbasis-Aktualität (Fall 7). Gilt für den KI-Prüfnachweis `aiCheck` am
Wissensobjekt. Umsetzung: `services/knowledge-object/src/pruefbasis.ts`.*

## Die Frage

Ein fertiger Prüfnachweis (`aiCheck` = done/failed) durfte bisher als aktuell erscheinen, obwohl sich
seit dem Lauf etwas geändert hatte, das die Prüfung betrifft. Die vorhandene Sicherung band den Lauf
nur an die Inhaltsfassung (`koVersion`, bedingter Abschluss) — und auch das nur, solange der Lauf noch
wartete. Einordnung, Vertraulichkeit, Quellen und Anhänge ändern sich **ohne** Versionssprung, und
ein schon abgeschlossener Nachweis wurde von niemandem mehr mit dem Objekt verglichen.

Zu entscheiden war: **globale Basisbindung** (jede Änderung der Basis entwertet den ganzen Nachweis)
oder **selektive Wiederverwendung** über einen qualifizierten Abhängigkeitsfingerabdruck (der
Nachweis bleibt gültig, solange nachweislich keine Eingabe geändert wurde, von der das Urteil abhing).

## Entscheidung: globale Basisbindung je Nachweis

Ein Prüfnachweis gilt nur für genau die Basis, unter der sein Lauf **gestartet** ist. Jede Änderung
irgendeines Teils dieser Basis macht den ganzen Nachweis überholt. Es gibt keine selektive
Wiederverwendung.

### Geltungsbereich — was zur Basis gehört

| Teil | Felder | Warum |
| --- | --- | --- |
| Quelle | Inhaltsfassung `version`; Kennungen der Quellen (`sources`) und Anhänge (`attachments`) | Titel, Kernaussage, Bedingungen, Maßnahmen und Fließtext ändern sich nur mit der Fassung. Quellen und Anhänge kommen ohne Versionssprung hinzu oder fallen weg. |
| Kontext | Kategorie, Schlagworte, Anlage (`asset`), Vertraulichkeit | Sie steuern Kandidatenwahl und Modellweg (vertrauliche Paare gehen nie in die Cloud) und ändern sich ohne Versionssprung. |

**Gleicher Text genügt nie:** die Fassungsnummer gehört zur Quelle. Eine neue Fassung mit
zeichengleichem Inhalt ist eine neue Basis.

### Was ausdrücklich nicht zur Basis gehört

- **Ablauf- und Ergebnisfelder** — Prüfstatus, Vertrauenswert, Zuweisungen, Kommentare, Eigentum, der
  Nachweis selbst, abgeleitete Suchfelder. Sie sind *Folgen* von Prüfung und Bewertung. Wären sie
  Basis, entwertete eine Prüfung, die einen Konflikt anlegt und damit den Prüfstatus eines Objekts
  ändert, sich selbst: eine Schleife ohne Ende.
- **Der übrige Bestand** (andere Wissensobjekte). Siehe „Verbleibende Folgen".
- **Der Schreibstand** (`ko_schreibstand`). Er wurde als globale Basis geprüft und verworfen: er
  steigt bei *jedem* Schreiben am Bestand, auch bei Vertrauenswert, Status, Kommentaren und den
  Folgen der Prüfung selbst. Als Basis entwertete er nach jedem Schreiben jeden Nachweis im Bestand,
  jeder Abruf reihte die ganze Prüfliste neu ein, und die Prüfliste bliebe dauerhaft gesperrt.

### Begründung gegen die selektive Wiederverwendung

Selektive Wiederverwendung („nur die Schlagworte haben sich geändert, das Urteil gilt weiter")
verlangt einen **qualifizierten** Nachweis, von welchen Eingaben das Urteil abhing. Den gibt es
nicht: die Erkennung wählt ihre Vergleichskandidaten gedeckelt aus dem Bestand
(`DETECTION_CANDIDATE_CAP`), die Auswahl hängt selbst von Kategorie und Schlagworten ab, und das
Abdeckungsprotokoll hält nur Zahlen fest, keine Kennungen. Ohne diesen Nachweis wäre jede selektive
Weitergeltung eine Behauptung. Die globale Bindung ist konservativ: sie kostet im schlechtesten Fall
einen Lauf zu viel, nie ein falsches „aktuell".

## Umsetzung im bestehenden AiCheck-Weg

- **Gespeichert** wird die Basis als zwei Fingerabdrücke (`aiCheck.basis = { quelle, kontext }`),
  kein Inhalt. `markAiCheckPending` bindet die angeforderte Basis; der Worker liest die Basis beim
  **Laufstart** und schreibt das Ergebnis an sie gebunden (`resolveAiCheck(…, basis)`). Die
  Import-Annahme (synchroner Lauf) bindet ebenfalls die Basis beim Laufstart.
- **Gelesen** wird `aiCheck.ueberholt` bei jedem `KoService.get`/`list` neu aus der gespeicherten
  Basis gegen das jetzige Objekt abgeleitet — nie gespeichert, nie geglaubt. Prüfliste,
  Detailabruf, Erfassen-Karte, Fragen-Einstufung und Abdeckungs-Zusammenfassung lesen damit dieselbe
  gespeicherte Bindung; ein Neuladen ändert nichts daran.
- **Änderung zwischen Start und Ergebnis:** der Worker vergleicht vor dem Schreiben die Basis mit
  der Startbasis. Ist sie gewandert, wird **kein** Ergebnis eingetragen; der Lauf wird für die neue
  Basis frisch vermerkt und (gedeckelt, `MAX_AI_CHECK_AUTO_RETRIES` je Zielbasis) neu eingereiht.
  Das enge Restfenster zwischen Probe und Schreiben deckt die Bindung selbst: das Ergebnis trägt die
  Startbasis und wird deshalb als überholt gelesen. Die vorhandene `koVersion`-Sicherung
  (bedingter Abschluss in SQL) bleibt unverändert als harte Schreibbedingung stehen.
- **Abruf und Wiederholung:** der Abruf der Prüfliste reiht überholte Nachweise neu ein
  (`shouldReEnqueueAiCheck`), die Antwort zeigt sofort den frischen, laufenden Vermerk statt des
  alten Ergebnisses. Der Wiederholen-Knopf (`POST /api/kos/:id/ai-check`) nimmt überholte Nachweise
  an; ein aktueller fertiger Nachweis bleibt wie bisher `409 AI_CHECK_NOT_RETRYABLE`. Doppelaufträge
  verhindert die bestehende Dedupe des Workers (Warteschlange + laufender Job).
- **Anzeige:** Das Badge der Prüfliste zeigt „Prüfung überholt" mit Wiederholen-Knopf vor jedem
  done-/failed-Zustand; die Erfassen-Karte zeigt den Hinweis statt „geprüft"; die Antwort-Einstufung
  und die Abdeckungs-Zusammenfassung zählen überholt als unvollständig. Texte in DE/EN/NL
  (`apps/web/src/texte/pruefbasis.ts`).
- **Rechte:** unverändert. Die Prüfliste filtert weiterhin vor dem Neu-Einreihen nach Sichtbarkeit;
  die Wiederholung verlangt weiterhin `ko.validate`.

## Verbleibende Folgen

1. **Bestandsänderungen anderer Objekte entwerten einen Nachweis nicht.** Ändert sich Objekt B, wird
   *Bs* Nachweis überholt und neu gelaufen; dieser Lauf beurteilt das Paar (A, B) neu, und
   bestehende Paarbefunde sind bereits an beide Fassungen gebunden (`onKoRevised`). As Nachweis
   bleibt stehen. Grenze: wählt Bs Lauf A wegen des Kandidatendeckels nicht aus, wird das Paar nicht
   neu beurteilt — das zeigt Bs Abdeckungsprotokoll als gedeckelt an. Eine Bestandsbindung ist erst
   mit einem qualifizierten Abhängigkeitsnachweis (Kandidatenkennungen samt Fassungen im Protokoll)
   sinnvoll möglich.
2. **Prüfregeln sind nicht Teil der Basis.** Eine geänderte Anzeige-Schwelle für Duplikate oder ein
   geänderter Kandidatendeckel entwerten vorhandene Nachweise nicht; sie gelten für künftige Läufe.
3. **Altbestand ohne gespeicherte Basis** wird an der Fassung gemessen, die er trägt (`koVersion`).
   Änderungen an Einordnung, Vertraulichkeit, Quellen oder Anhängen *vor* dieser Lieferung sind an
   ihm nicht erkennbar. Ein Nachweis ganz ohne Bindung wird nicht als überholt behauptet. Mit dem
   nächsten Lauf (Überarbeitung, Wiederholung) trägt er die volle Basis.
4. **Mehr Läufe:** jede Einordnungs-, Vertraulichkeits-, Quellen- oder Anhangsänderung eines
   Objekts mit Prüfnachweis führt beim nächsten Abruf der Prüfliste zu einem neuen Lauf, und das
   Objekt ist bis zu dessen Abschluss in der Prüfliste als „läuft" gesperrt — wie nach einer
   Überarbeitung.
5. **Nur-Lese-Merker am Draht:** `aiCheck.basis` (zwei Fingerabdrücke) ist ein neues Feld am
   Drahtvertrag, `aiCheck.ueberholt` ein abgeleitetes. Beide tragen keinen Inhalt.
