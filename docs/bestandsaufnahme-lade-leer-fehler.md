# Bestandsabgleich R-0953 / R-0956 — Rückmeldungen, Leerzustände, Eingabeerhalt

Auftrag `aufnahme:20260922:gesamt-lade-leer-fehler`, Nacharbeit 4 (Ben: „Abgleich des
Originalumfangs bleibt auf einzelne beanstandete Stellen begrenzt“). Stand: Kandidat nach
`7652df9c`, Web-Oberfläche `apps/web/src`.

**Art des Belegs.** Alles in diesem Dokument ist **Quelleninspektion** (gezielte Suche über den
ganzen Quellbaum, Fundstellen unten). Ausgeführte Prüfungen stehen getrennt in den
Prüfberichten unter `HISTORIE/` und im Prüfplan des Auftrags; wo eine Stelle durch einen
vorhandenen oder neuen Test belegt ist, steht der Testpfad dabei.

## 1. R-0953 — Erfolge und Fehler von Speicheraktionen

**Methode.** Jede `useMutation`-Stelle im Web-Quellbaum (130 Stellen in 38 Dateien, ohne Tests)
wurde darauf geprüft, ob ihr Fehler sichtbar wird (`onError` mit Einblendung/Meldung oder eine
gerenderte `.isError`/`.error`-Anzeige) und ob ihr Erfolg sichtbar wird.

**Bewertungsregel.** „Still“ heißt: ein Fehler (oder Erfolg) ändert nur Zustand, ohne dass der
Mensch es erfährt. Das ist der Mangel, den R-0953 benennt. Eine Meldung an der Stelle der Aktion
ist sichtbar, aber keine Einblendung über den Bus; solche Stellen sind unten als „Meldung vor Ort“
geführt, nicht als still.

### 1a. Behoben (vorher still)

| Stelle | vorher | jetzt | Beleg |
|---|---|---|---|
| `pages/Risk.tsx` Lücke zuweisen / priorisieren / löschen | Fehler still, Auswahl sprang zurück | Erfolg + Fehler als Einblendung | `tests/luecke-schliessen/schliessen-mit-bezug-mounted.test.tsx` E1–E3 |
| `pages/Risk.tsx` Lücke schließen | Fehler nur an der Zeile | zusätzlich Einblendung (Erfolg + Fehler) | dieselbe Datei, S2 + E4 |
| `pages/Lifecycle.tsx` „Noch gültig“ | Fehler still | Fehler als Einblendung (Erfolg hatte schon seine Quittung) | `tests/app/lifecycle-bestand-zuerst-mounted.test.tsx` F1 |
| `pages/Lifecycle.tsx` Lernschritt abhaken | Erfolg nur als Haken, Fehler still | Erfolg + Fehler als Einblendung | Quelleninspektion |
| `components/start/LiveWallValidiert.tsx` Namenszustimmung umschalten, Foto widerrufen | Fehler still (Kästchen sprang zurück, Foto blieb) | Meldung vor Ort, `role="alert"` (wie die vorhandene Foto-Fehlerzeile derselben Komponente) | Quelleninspektion |
| `components/BereichsprofilPflege.tsx` Ruhestand, Bereichsprofil | (Nacharbeit 2/3) | Einblendungen, Eingabeerhalt | `tests/analytics/risiko-horizont-mounted.test.tsx` P2–P5 |

### 1b. Bereits über den Bus (Einblendung)

`Validation.tsx` (Bus; Freigabe- und Rückfragefehler zusätzlich vor Ort), `Stufe2.tsx` (4), `MehrAbschnitte.tsx` (15, `fehlerToast`), `AdminKiDetails.tsx`
(Speicherwege), `AdminDatenDetails.tsx`, `AdminSicherheitDetails.tsx`, `AdminKontenDetails.tsx`
(`fail`), `MeineEntwuerfe.tsx` (4), `ScormUebergabe.tsx`, `BibliothekLesen.tsx` (Teile),
`Mobile.tsx` (Teile).

### 1c. Meldung vor Ort (sichtbar, nicht über den Bus)

`Capture.tsx` und `erfassen/Blatt.tsx` (Fehlerkasten des Formulars), `Conflicts.tsx`,
`Duplicates.tsx`, `DuplicateMerge.tsx`, `Profile.tsx`, `auth/*` (Anmeldung, Zurücksetzen),
`Firmenwoerterbuch.tsx`, `Spaces.tsx`, `SpaceZeile.tsx`, `Ausgangspruefung.tsx`,
`ExternalKnowledge.tsx`, `kenntnisnahme/KenntnisnahmeBereich.tsx`, `SharePointImportBereich.tsx`,
`BodyExtractPanel.tsx`, `AppendToArticleModal.tsx`, `ImportAccessPanel.tsx`,
`PublicAiEnrichPanel.tsx`, `KlaraAssistant.tsx`, `WissensbeziehungenBereich.tsx`,
`gesamtanweisung/*` (`fehlerSchluessel` am Formular), `Lifecycle.tsx` Anlagenänderung (Quittung).

**Offene Entscheidung (nicht selbst gewählt).** Ob diese Meldungen vor Ort zusätzlich als
Einblendung erscheinen sollen, ist eine Gestaltungsfrage: bei Formularen (Erfassen, Anmeldung)
ist die Meldung am Feld der übliche Ort, und eine zweite Einblendung wäre doppelt. Der Auftrag
verlangt „statt stiller Zustandsänderung“; still ist keine dieser Stellen.

### 1d. Bewusst ohne eigene Meldung

`legal/NoticeBanner.tsx` (Quittieren): der Fehlerzustand liegt laut Kommentar in der
Sitzungshaltung und wirkt dort (`NoticeBanner.tsx:210`).

## 2. R-0956 — leere Listen

**Methode.** Alle Leersätze im Web-Quellbaum (Schlüssel mit `empty`/`leer`/`none`/`NoMatch`/
`noResults`, rund 120 Fundstellen) wurden einer von drei Klassen zugeordnet.

**Klassen — die Auslegung ist eine Abgrenzung, keine neue Anforderung:**

- **A · Hauptlisten des Wissenskreises.** Listen, über die ein Mensch den Kreis Erfassen →
  Validieren → Nutzen → Aktuell halten betritt. Für sie gilt R-0956 wörtlich: Leersatz,
  Einordnung (Story, Kreis-Phase, flächeneigene Erklärung), nächster Schritt.
- **B · Eingegrenzte Bestände** (Filter, Suche: `…NoMatch`, `…emptyFiltered`, `…leerSuche`,
  `noResults`). Der Bestand ist nicht leer; richtig ist hier „keine Treffer“ und der Weg aus der
  Eingrenzung. Diese Trennung verlangt R-0963 ausdrücklich.
- **C · Teil- und Werkzeuglisten** (Kommentare, Anhänge, Quellen, Fassungen eines einzelnen
  Beitrags; Admin-Listen wie Sicherungen, Papierkorb, Vorlagen; Werkzeugergebnisse wie OCR,
  Bildsuche, Befehlspalette, Klara). Hier steht ein sachlicher Satz; eine Kreis-Einordnung an
  jedem Kommentarfeld wäre Rauschen. **Diese Klasse ist eine Auslegung und zur Bestätigung
  offen.**

### 2a. Klasse A — Stand je Liste

| Liste | Stelle | Stand | Beleg |
|---|---|---|---|
| Meine Aufgaben | `MyTasks.tsx` | eingeordnet (`EmptyStateCtas` „tasks“) | `tests/demo-leerbestand/aufgaben-leerbestand.test.tsx` |
| Validierung | `Validation.tsx` | eingeordnet („validation“) | Bestand |
| Risiko · Bus-Faktor | `Risk.tsx` | eingeordnet („risk“, Nacharbeit 2) | `tests/analytics/risiko-busfaktor-mounted.test.tsx` B5 |
| Risiko · Cockpit | `Risk.tsx` | **jetzt** eingeordnet („risk“) | Quelleninspektion; derselbe Baustein wie B5 |
| Risiko · offene Lücken | `Risk.tsx` | **jetzt** eingeordnet („gaps“, Weg zum Fragen) | `risiko-busfaktor-mounted` B6 |
| Lebenszyklus | `Lifecycle.tsx` | **jetzt** eingeordnet („lifecycle“), Leersatz wörtlich erhalten | `lifecycle-bestand-zuerst-mounted` LEER |
| Dubletten | `Duplicates.tsx` | **jetzt** eingeordnet („duplicates“), unter der Brettfläche | `tests/validation/ai-check-coverage-surfaces-mounted.test.tsx` |
| Schlagwort-Nachbarschaft | `KnowledgeNeighborhood.tsx` | eingeordnet („neighborhood“, Nacharbeit 3) | `tests/app/mega68-nachbarschaft-flaeche-mounted.test.tsx` |
| Audit-Protokoll | `Analytics.tsx` | **jetzt** eingeordnet („audit“), Filter-Leerzustand getrennt | `tests/seitenhilfe-navkapitel/lesekapitel-am-seitenverhalten.test.tsx` A2a-LEER, A2a-FILTER |
| Konflikte | `Conflicts.tsx` | erklärt (eigene Fassung: `con.emptyWhat`, `con.emptyHow`, Beispiel-Aktion) | Bestand |
| Start | `StartKarten.tsx`, Start-Leerinstanz | erklärt (`start.leer.ersterSchritt`, Einstieg) | `tests/demo-leerbestand/start-leere-instanz.test.tsx` |
| Arbeitsanleitungen | `GesamtanweisungBereich.tsx` | erklärt mit nächstem Schritt (`ga.liste.leer`) | Bestand |
| Bibliothek | `BibliothekListe.tsx` | Leersatz + Erfassen-Aktion, **ohne** Kreis-Einordnung | siehe 2c |

### 2b. Rollenfreie Fläche `/analytics`

`/analytics` ist reine Admin-Fläche (`navigation.ts`, minRole „admin“), und ihr Seitentest
verlangt ausdrücklich, dass kein Nachkomme die Rolle liest. Der Audit-Leerzustand nutzt deshalb
den gemeinsamen Rahmen `leerzustandsRahmen` (`components/EmptyStateCtas.tsx`) mit den Schritten
derselben Liste (`emptyStateActions("audit", "admin", …)`) — gleicher Wortlaut, gleiche Bauform,
kein Rollenzweig.

### 2c. Offene Entscheidung: Bibliothek

`BibliothekFlaeche.tsx:1955-1957` hält fest, dass der Leerzustand der Bibliothek **bewusst** „ohne
die Karte mit zwei Erklärsätzen darüber“ gebaut wurde (Beta Own-Knowledge Work Queue v0). Er
nennt einen nächsten Schritt (Erfassen), aber keine Kreis-Einordnung. Das widerspricht R-0956 im
Wortlaut; die frühere Gestaltungsentscheidung wird hier **nicht** selbst überstimmt.

## 3. R-0956 — Fehler kosten keine Eingaben

**Methode.** Für jede Speicheraktion mit Eingabe wurde geprüft, ob die Eingabe nur im Erfolgszweig
geleert wird (Quelleninspektion), und wo vorhanden der Test genannt.

| Weg | Eingabeerhalt bei Fehler | Beleg |
|---|---|---|
| Erfassen, Blatt, Mobil (Entwürfe) | Entwurf bleibt; Offline-Warteschlange, Verlassen-Schutz | vorhandene Testfamilien `tests/entwurf-*`, `tests/review26-mobil-fortsetzen/` |
| Fragen | Frage bleibt (Arbeitsstand) | `tests/fragen-arbeitsstand/` |
| Bereichsprofil, Ruhestand | Eingabe bleibt, erneut senden | `risiko-horizont-mounted` P3–P5 |
| Lebenszyklus · Anlagenänderung | Feld wird nur im Erfolg geleert (`setAssetRef("")` in `onSuccess`) | Quelleninspektion |
| Kenntnisnahme anfordern | Auswahl/Frist nur im Erfolg geleert | Quelleninspektion |
| Arbeitsanleitung anlegen | „der Titel bleibt stehen“ (`GesamtanweisungBereich.tsx:543-544`) | Quelleninspektion |
| Anmeldung, Zurücksetzen, Passwort ändern | Felder sind lokaler Zustand; Fehler setzt nur die Meldung | Quelleninspektion |
| QueryState-Flächen (Lesezustände) | gescheiterte Auffrischung behält den Bestand | `tests/querystate-ehrlich/querystate-zustaende.test.tsx` |

## 4. Abgrenzung

- Die Bibliothek-Pakete „Bibliothek durchsuchen und bereinigen“ (`package:bibliothek`) sind
  zugleich den Aufträgen `gesamt-bibliothek-loeschen` und `gesamt-suche-filter` zugeordnet;
  hier ist nur ihr Leerzustand berührt.
- Kein globaler `MutationCache`-Handler: das wäre eine Grundsatzentscheidung über alle
  Speicherwege und war nicht verlangt.
