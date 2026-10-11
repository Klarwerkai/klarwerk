# B41 Teil C – Vorlage zu den app-weiten Folgekandidaten des Rohlink-Sammlers

**Art:** Vorlage. Hier wird nichts gebaut, und kein Produktcode ist geändert (AUFTRAG-mega73,
Block C).
**Kriterium:** K9 / R-1877 B41 Teil C.

## Quellen

Die Quellen liegen im Auftragsordner. Die Prüfsummen stammen aus
`QUELLEN-B41-C-MEGA70-WIEDERGEFUNDEN.json`.

| Quelle | SHA-256 | Inhalt |
|---|---|---|
| `HILFE/…/QUELLEN-B41-C/mega70-vollstaendige-erhebung.txt` | `c8791da9…cf86b` | Historische Erhebung vom 30.07.2026. Sie enthält 75 Link-Vorkommen in Tabellenform, davon 27 mit ⚠︎ markiert. |
| `HILFE/…/QUELLEN-B41-C/mega70-bericht-folgekandidaten-auszug.txt` | `cca8e57e…5dac9` | BERICHT-mega70, Zeilen 189–197. Dort steht „26 Kandidaten“. |
| `HILFE/…/QUELLEN-B41-C/originalauftrag-rohlink-sammler-mega73.txt` | `944aa12c…31715` | Wortlaut von Block C: „Sieh dir die 26 an …“ |

Der Auftrag, der dem B41-Wortlaut entspricht, heißt im Archiv `AUFTRAG-mega73.md`.
`AUFTRAG-mega72.md` betrifft den Modal-Sammler. Der Verweis „mega72“ in OFFEN.md B41 ist deshalb
eine Fehlbenennung.

## Die Zahl: 26 oder 27

- Die Ergebnistabelle der Erhebung markiert **27 Fundstellen**: 22 in Seiten und 5 in Bauteilen.
  Die 5 Bauteil-Stellen sind PublicAiEnrichPanel:84, KlaraAssistant:68, :520 und :542 sowie
  DemoBanner:26.
- Ihre Zusammenfassung behauptet **26**, nämlich „22 Seiten + 4 Komponenten“. Daneben stehen aber
  5 Stellen in 3 Dateien. Weder die Stellenzahl (5) noch die Dateizahl (3) ergibt 4. Die Zahl 26
  lässt sich aus der Tabelle nicht nachrechnen.
- Diese Vorlage zählt deshalb die **27 markierten Stellen**. Keine Stelle ist entfernt worden, um
  auf 26 zu kommen.
- Von den 27 lagen schon damals **10 im Umfang von mega70/71**: Ask ×5, Library ×4, Capture ×1.
  Die Liste ist also keine Liste von 26 zusätzlichen offenen Fehlern.

## Geprüfter Umfang – das ist eine Teilprüfung

- **Geprüft:** alle **27 markierten Stellen**, durch Lesen des Quelltexts am heutigen Arbeitsbaum.
  Zeilenangaben ohne Zusatz beziehen sich auf heute; Angaben mit „damals“ auf die Erhebung.
- **Nicht erneut geprüft:** die **48 unmarkierten Vorkommen** der Erhebung. Sie galten 2026-07-30
  als unbedenklich.
- **Nicht durchgeführt:** eine neue app-weite Erhebung. Link-Stellen, die seit dem 30.07. neu
  entstanden sind, enthält diese Vorlage nicht.
- **Kein Verhaltenstest:** Alle Urteile beruhen auf Quelltext. Die Zeilen 1–15 der Tabelle stützen
  sich zusätzlich auf den grünen Rohlink-Sammler (Suite `b41-sammler-kalibriert`, Nacharbeit 2,
  exit 0).
- **Heutige Bedeutung von „Sackgasse“:** Seit mega70 Block A leitet ein bewachtes Ziel nicht mehr
  still auf `/start` um. `Guarded` zeigt eine erklärende Karte (`RoleNotice` bzw. `Stage2Notice`).
  Eine offene Stelle ist deshalb heute ein **angebotener Weg, den die Rolle nicht gehen darf** und
  der auf einer Sperrkarte endet. Ein stiller Rauswurf ist sie nicht mehr.

## Einordnung der 27 Stellen

| # | Damals | Heute | Ziel (Schwelle) | Fläche (Schwelle) | Einordnung | Begründung |
|---|---|---|---|---|---|---|
| 1–5 | Ask:435, 778, 834, 1100, 1108 | `pages/Ask.tsx` | /validierung, /konflikte, /risiko (controller); /erfassen (experte) | /fragen (viewer) | **erledigt** | mega71 Block E. Der Rohlink-Sammler trägt `Ask` als Fläche; jedes bewachte Ziel dort läuft über `RoleLink`. |
| 6–9 | Library:568, 641, 867, 1017 | `components/bibliothek/*` (z. B. `BibliothekFlaeche.tsx:2149` RoleLink /import) | /import (admin+Stufe 2), /validierung, /konflikte (controller), /erfassen (experte) | /bibliothek (viewer) | **erledigt** | mega70 Block B. `useCta` ist mit H4 durch `fragenHref` ersetzt. Der Sammler trägt alle fünf Bibliotheksdateien. |
| 10 | Capture:3646 | `pages/Capture.tsx:5642` (RoleLink) | /validierung (controller) | /erfassen (experte) | **erledigt** | mega70 Block B/C. Das Ziel wird jetzt über `ROLES` erhoben. |
| 11–15 | KnowledgeDetail:835, 869, 903, 992, 2011 | `pages/KnowledgeDetail.tsx:141` rendert `BibliothekFlaeche`; `MehrAbschnitte.tsx:1935` RoleLink /graph; `BibliothekLesen.tsx:2652` RoleLink /validierung | /konflikte, /validierung (controller), /graph (admin+Stufe 2) | /wissen/:id (unbewacht, viewer) | **erledigt durch Umbau** | Die Seite enthält kein `to`-Attribut mehr. Ihre Wege liegen in den fünf Bibliotheksdateien, die der Sammler mit derselben viewer-Schwelle prüft. Grenze: Einzeln nachverfolgt sind nur /graph und /validierung. Conflict-Notice und koCta deckt nur die Sammlerzusage über diese Dateien ab, nicht tiefer eingebundene Bauteile (Blindheit 2 im Sammlerkopf). |
| 16 | CaptureFrontDoor:717 | `pages/CaptureFrontDoor.tsx` | /validierung | /capture/frontdoor (experte) | **entfallen** | Die Datei enthält weder einen `<Link>` noch das Ziel /validierung. |
| 17 | PublicAiEnrichPanel:84 | `components/PublicAiEnrichPanel.tsx:88` | /admin (admin) | Einbinder bis viewer | **erledigt** | Der Link läuft heute über `RoleLink`. |
| 18 | Help:44 | `pages/Help.tsx:251` | Pilot-Schritte bis controller | /hilfe (viewer) | **erledigt** | JOB 4022: Der Link wird nur bei `zugang === "offen"` gerendert (Registry-Frage). Sonst steht dort „Kein Zugriff“ mit der verlangten Rolle. |
| 19 | Conflicts:272 | `pages/Conflicts.tsx:276` | /import (admin+Stufe 2) | nur gerendert bei `role === "admin"` | **harmlos** | Nur ein Admin sieht den Link. Ohne Stufe 2 zeigt `Stage2Notice` eine erklärende Karte, mit der der Admin Stufe 2 selbst einschalten kann. Es entsteht keine Sperre ohne Ausweg. |
| 20 | Help:70 | `pages/Help.tsx:289` | `PILOT_OBSERVATIONS`: /risiko, /validierung, /lebenszyklus (controller) | /hilfe (viewer) | **offen – echte Sackgasse** | Ein roher `<Link>` ohne Rollenfrage. Betrachter und Experten bekommen drei Controller-Wege angeboten. |
| 21 | Help:107 | `pages/Help.tsx:414` | `HELP_TOPICS`: bis /admin, /kapital (admin) | /hilfe (viewer) | **offen – echte Sackgasse** | Ein roher `<Link>` an jedem Hilfekapitel. `filterHelpTopics` filtert nach Suchwort, nicht nach Rolle. |
| 22 | Mobile:586 | `pages/Mobile.tsx:1542` | /risiko (controller) | /mobile (unbewacht, viewer) | **offen – echte Sackgasse** | Ein unbedingter roher `GuardedLink` im Lückenzustand. |
| 23 | MyTasks:198 | `pages/MyTasks.tsx:504`, `:565` | Aufgabenziele /konflikte, /lebenszyklus, /risiko (controller) | /aufgaben (experte) | **offen – Einzelprüfung nötig** | Der Client filtert die Aufgabenziele nicht nach Rolle (`MyTasks.tsx:168–226`). Ob ein Experte Konflikt-, Lebenszyklus- und Lückendaten überhaupt vom Server erhält, hängt an der Serverberechtigung. Das ist hier nicht geprüft. |
| 24 | DemoBanner:26 | `components/DemoBanner.tsx:27` | /validierung (controller) aus `demoPilotPath.ts:119, 133` | Einbinder Capture (experte), Bibliothek (viewer) | **offen – Sackgasse nur im Demo-Kontext** | Ein roher `<Link>`. Er wird nur bei `isDemoContext` gerendert, im Demo-Kontext aber jeder Rolle angeboten. |
| 25–27 | KlaraAssistant:68, 520, 542 | `components/KlaraAssistant.tsx:54`, `:603`, `:626` | ganze Klara-Registry bis /admin, /kapital (admin+Stufe 2) | Hülle (global, viewer) | **offen – echte Sackgasse** | `klaraRegistry.ts` kennt keine Rolle. Die Treffer und Quellen von Klara werden jeder Rolle als roher Link angeboten. |

**Summe:** 10 erledigt im Sammlerumfang (1–10), 5 erledigt durch Umbau (11–15), 1 entfallen (16),
2 erledigt (17, 18), 1 harmlos (19) und **8 offen** (20–27). Von den 8 offenen ist eine
(MyTasks) unter Servervorbehalt und eine (DemoBanner) auf den Demo-Kontext beschränkt.

Ein Produktfehler wurde nicht behoben. Laut Block C und mega73 „NICHT ANFASSEN“ bleiben die
offenen Stellen als Befund stehen.

## Nächste Sammlerflächen, nach Aufwand geordnet

Der Aufwand hängt vor allem davon ab, woher die **Rollenschwelle der Fläche** kommt. Der heutige
Sammler liest sie aus `routes.tsx` (`navIdsVonSeite`). Für Bauteile und unbewachte Routen gibt es
dort keinen Eintrag.

1. **Help (`pages/Help.tsx`) – gering.** Die Seite ist eine Route mit Nav-Eintrag, die Schwelle
   kommt also wie bisher aus `routes.tsx`. Die Zieltabellen `PILOT_OBSERVATIONS`, `HELP_TOPICS`
   und `PILOT_CHECKLIST` sind exportiert und lassen sich als `HERKUNFT` lesen. Eine Zusatzregel
   ist nötig: Stelle 18 ist durch `zugang === "offen"` bedingt gerendert. Entweder bekommt sie eine
   benannte Ausnahme mit Beleg, oder sie wird auf `RoleLink` umgestellt. Der Sammler wird dort
   sofort die Stellen 20 und 21 rot zeigen; das ist der Zweck.
2. **DemoBanner (`components/DemoBanner.tsx`) – gering.** Eine Stelle, die Zieltabelle kommt aus
   `demoSurfaceBanner`. Neu ist eine Schwelle aus den Einbindern: die niedrigste Rolle der fünf
   einbindenden Flächen (Capture, Blatt, Ask, Bibliothek, Validierung), also viewer.
3. **Mobile (`pages/Mobile.tsx`) – gering bis mittel.** Die Route ist unbewacht, braucht also eine
   ausdrücklich benannte Schwelle viewer. Die große Datei hat mehrere `to`-Attribute; jeder
   Ausdruck braucht eine Herkunft, doch heute sind es Literale und Templates.
4. **MyTasks (`pages/MyTasks.tsx`) – mittel.** Die Schwelle kommt aus `routes.tsx` (experte). Die
   Ziele entstehen aber dynamisch aus fünf Aufgabenquellen (`reworkHref`, `fallHref` ×3,
   `/wissen/:id`). Vorher muss geklärt werden, welche dieser Daten der Server einem Experten
   liefert. Davon hängt ab, ob Stelle 23 eine Sackgasse ist.
5. **KlaraAssistant (`components/KlaraAssistant.tsx`) – mittel bis hoch.** Die Fläche ist global
   in der Hülle, mit Schwelle viewer, und hat keinen Seiteneintrag. Die Zielmenge ist die ganze
   Registry (`resolveKlaraEntries`) und ist zur Laufzeit KI-abhängig (`aiTargetEntry`, Quellen).
   Der Sammler bekäme hier die erste Fläche, deren Ziele nur über die vollständige Registry
   erhoben werden können.

## Belegzuordnung

| Aussage | Beleg |
|---|---|
| 75 Vorkommen und 27 markierte Stellen | Erhebung, Tabellen „Seiten“ und „Komponenten“ sowie Zusammenfassung |
| Die Zahl 26 ist nicht nachrechenbar | Erhebung, Zusammenfassung „Components (4)“ gegen 5 Tabellenzeilen |
| Zeilen 1–15 erledigt | `tests/app/mega70-rohlink-sammler.test.ts` (DATEIEN Library/Capture/Ask), HISTORIE/nacharbeit-2/PRUEFUNG, Suite `b41-sammler-kalibriert`, exit 0 |
| Zeilen 16–27 | Quelltext am heutigen Arbeitsbaum, Datei:Zeile wie in der Tabelle; nicht ausgeführt |
| Auftrag „Kein Bau, sondern eine Vorlage“ | `originalauftrag-rohlink-sammler-mega73.txt`, Zeilen 33–37 und 41–43 |
