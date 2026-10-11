# Lesewahl bei verzögertem Bibliotheksbestand

*Aufnahme 20260922 · `aufnahme:20260922:ux02-lesewahl` (Revision 2). Gilt für die Bibliotheksfläche
`apps/web/src/components/bibliothek/BibliothekFlaeche.tsx` auf `/bibliothek` und `/wissen/:id`.
Zugeordnete Originalpunkte: N-0006, N-0016, N-0020, P-UX-02 (dazu `priority:UX-02:c9dd9537e889`
als doppelte Quellenfassung derselben Zeile) und `priority:UX-02b:659cd265321b`.*

## Die Frage

Die Bibliothek prüft einen Filter aus der Adresse (etwa `?tag=…` vom Themenkarten-Link) gegen den
Bestand (`GET /api/kos`). Seit JOB 3115 (UX-02b) wartet diese Prüfung auf einen für die Montage
**bestätigten** Bestand; solange zeichnet die Liste keine Zeile (F9), und ein Erstfehler des
Bestandsabrufs landet im Listenfehler (F10). Offen war, was in dieser Zeit **rechts** steht:
bleibt ein ausdrücklich adressierter Eintrag sichtbar, und darf die Fläche selbst einen Bericht
vorwählen?

## Entscheidung

Die Lesefläche hängt an der **Wahl**, nicht am Listenbestand. Die Fläche wird nicht pauschal
ausgeblendet. Eine Vorwahl entsteht nur aus einer Liste, die selbst Zeilen zeigt.

| Lage | Sollverhalten | Ort | Nachweis |
| --- | --- | --- | --- |
| **Ausdrückliche Wahl** (`/wissen/:id` oder `?eintrag=<id>`) während ungeklärtem Bestand | Bleibt sichtbar und in der Adresse; sie wird nicht vom Listenbestand abhängig gemacht. Kein Hinweis „nicht unter den Treffern“, solange die Auswahl ungeprüft ist. | `gewaehlt`, `auswahlAusserhalbTreffer` | `tests/themenlink-tag/…` L2, L4 |
| **Automatische Vorwahl** (breit, keine Wahl in der Adresse) | Nur aus einer zeichnenden Liste: schweigt die Liste (`listeSchweigt`), steht rechts kein Bericht, bis die Liste antwortet; danach der erste Treffer. Wird nie in die Adresse geschrieben. Schmal und Tablet gibt es keine Vorwahl (JOB 3121/3335). | `vorwahl` | L1, L3; `tests/ablage-kontext/…` A3, B0 |
| **Gefilterter Eintrag** (ausdrückliche Wahl außerhalb der Treffer) | Wahl und Lesetext bleiben; der Satz „nicht unter den Treffern“ steht nur bei frischem Abruf und geprüfter Auswahl. Kein stiller Ersatz durch den ersten Treffer. | `auswahlAusserhalbTreffer` (N-0074) | A3b, Z1 |
| **Ladefehler** | Liste: gescheiterter Erstabruf → Listenfehler samt Wiederholknopf, keine Rückfall-Liste (F10). Eintrag: gescheiterter Erstabruf → „Der Eintrag ließ sich nicht laden.“ mit Wiederholknopf, kein fremder Bericht, keine behauptete Ursache. Gescheiterte **Auffrischung** mit vorhandenem Stand → Stand bleibt, mit „Stand von <Zeit> · Auffrischung fehlgeschlagen“ (JOB 3034 R2, `lib/abfrageBestand.ts`). | `BibliothekLesen`, `BibliothekListe` | F5, F10, A5, A5b, B3c |
| **Rechteentzug** | Die Wahl bleibt in der Adresse; der Server entscheidet. Ohne geholten Stand (Neuladen, neue Sitzung, direkter Link) läuft 403/404 in denselben Fehlerzweig wie eine tote Kennung, ohne Ursache „gesperrt“/„gelöscht“ zu behaupten und ohne Ersatzbericht. Ein in dieser Sitzung schon berechtigt geholter Stand bleibt nach gescheiterter Auffrischung mit Stand-Hinweis stehen (Hausregel JOB 3034 R2/4224: aus dem Stand wird keine fortbestehende Berechtigung abgeleitet; Schreibwege prüft der Server, `rechtEntzogen`). Selbst gelöscht → `eintrag` verlässt die Adresse (A7). | `BibliothekLesen` | A5, A5b, A7, B3c; Sitzungsfall s. offene Punkte |

## Zuordnung der Lieferungen

| Lieferung | Inhalt laut Code und Tests | Fassung (Versionsgeschichte) | Zuordnung zu diesem Fall |
| --- | --- | --- | --- |
| JOB 3104 (UX-02) | Suchbegriff `q` und Wahl `eintrag` stehen in der Adresse (immer `replace`); tote Kennung → ehrlicher Fehlersatz; Löschen räumt die Adresse. | Umsetzung `155c55fb`, Versionscommit `e3fcff4a` → **1.0.0-beta.1.117** | Grundlage für N-0006, N-0016, P-UX-02. Kein Teil des Verzögerungsfalls, aber die Ableitung `gewaehlt`, auf der er steht. Beleg im Repository: `tests/ablage-kontext/` A1–A7, B0–B5. |
| JOB 3115 (UX-02b) | Wertprüfung des Adressfilters wartet auf einen bestätigten Bestand; Liste schweigt während des Wartens; Erstfehler → Listenfehler. | Umsetzung `daaadc61`, Versionscommit `13b4bb56` → **1.0.0-beta.1.130** | Genau der Verzögerungsfall, aber nur für die **Liste**. Beleg: `tests/themenlink-tag/…` F1–F10. Die Lesefläche fehlte darin; ergänzt mit L1–L4. |
| JOB 4263 | Fassungsrückholung im echten Browser (`tests/fassungsrueckholung-echter-browser/`). Darin **K5** (`kalibrierung.test.ts:134–147`): die Liste ist sichtbar, der **Detailabruf** eines Eintrags wird absichtlich verzögert, und der Abnahmeweg darf die Liste nicht für den gelesenen Bericht halten. | nicht erhoben | Berührt den Lesewahlfall nur von der anderen Seite: dort ist der **Bericht** verzögert, hier der **Listenbestand** (`GET /api/kos`), der einen Adressfilter prüft. K5 ist eine Kalibrierung des eigenen Prüfwegs von 4263, keine Lieferung für die Lesewahl bei ungeklärtem Bestand. Bis zur Detailantwort zeigt die Lesefläche ihren leeren Ladezweig (`BibliothekLesen`); daran ändert diese Lieferung nichts. |
| JOB 4330 | Diskussion am Dokument gegen PostgreSQL (`tests/wiki-diskussion-nutzerweg/`), dazu Toast-Aufräumen (`app/ToastContext.tsx`). | nicht erhoben | Kein Beitrag. Nutzt `/wissen/:id`. |
| JOB 4334 | Einordnungskonflikt gegen PostgreSQL (`tests/wiki-einordnung-konflikt/`). | nicht erhoben | Kein Beitrag. Öffnet `/bibliothek?eintrag=<id>&edit=1`, also die ausdrückliche Wahl, ohne Adressfilter. |

**Herkunft der Fassungsangaben:** Die Commits und Versionen für 3104 und 3115 stammen aus Bens
Auswertung der Versionsgeschichte (Prüfrunde Nacharbeit 1). In dieser Runde wurden sie nicht selbst
nachgelesen, weil Git-Aufrufe ohne Freigabe abgelehnt wurden. **Versionszuordnung ist kein
Live-Nachweis:** Dass 1.0.0-beta.1.117 bzw. .130 die Änderung enthalten, sagt nicht, dass die
Live-Fassung die Befunde N-0006/N-0016/UX-02b nicht mehr zeigt. Eine Gegenprüfung an der
ausgelieferten Fassung liegt in den Quellen nicht vor (s. offene Punkte).

**Quellenwiderspruch:** Der Auftrag nennt 4263/4330/4334 als Lieferungen zu diesem Fall. Laut Code
und Tests sind es andere Fachfälle. 4330 und 4334 nutzen nur die ausdrückliche Wahl über die
Adresse. 4263 enthält mit K5 einen verwandten, aber anderen Verzögerungsfall (Detail statt Bestand).

## Pflicht und Vorschlag

- **N-0006, N-0016** sind als `designvorschlag` erfasst („Pedis Entscheidung bleibt offen“). Pflicht
  wurden sie mit der Prioritätszeile **P-UX-02** (Pedi 05.09. 22:14). Die Lieferung JOB 3104 erfüllt
  die URL-Variante; der stabile Dokumentlink bleibt die Alternative und ist unverändert.
- **N-0020** ist als `fehler` erfasst: Suchbegriff, Objekt und Leseposition beim Hin- und
  Zurückwechsel erhalten.
- **UX-02b** ist Pflicht samt ihrer Abnahme (bestehende Sitzung, zwei neue gleiche Schlagworte plus
  fachfremde Kontrolle, Themenwahl, Bibliothekslink, Neuladen; DE/EN, Tastatur).

## N-0020 · Leseposition beim Rückweg aus dem Herkunftsgraphen (umgesetzt in Nacharbeit 1)

Suchbegriff und Bericht stehen seit JOB 3104 in der Adresse und kommen mit Browser-Zurück wieder.
Neu ist der Rest: Beim Klick auf „Im Wissensgraph ansehen“ merkt sich die Lesefläche den
**Rollstand** der Lesespalte und die **offenen Abschnitte** hinter „Mehr“ (`lib/lesekontext.ts`,
Sitzungsspeicher). Der Merker ist gebunden an Pfad, gewählten Eintrag und Verlaufsposition. Kommt
der Mensch per Browser-Zurück an genau diese Stelle, öffnet die Lesefläche „Mehr“ und die
gemerkten Abschnitte und rollt an die alte Stelle, sobald der Bericht geladen ist. Der Merker wird
dabei verbraucht. Ein späteres Öffnen desselben Berichts beginnt wie bisher oben; ein anderer
Bericht erbt nichts. Die Wahl selbst bleibt allein in der Adresse.

Nachweise: `tests/ablage-kontext/adresse-traegt-suche-und-eintrag.test.tsx` R1–R3 („Mehr“,
Herkunftskette, Verbrauch, fremder Bericht) und `tests/ablage-kontext/herkunftsgraph-rueckweg-in-chromium.test.ts`
G1–G4 (echter Link, echtes `history.back()`, Rollstand der Lesespalte, Gegenprobe Neuaufruf).

Nicht Teil dieser Lieferung: Der Graph-Link trägt weiterhin keine Objektkennung; der Graph
fokussiert den Bericht also nicht. Das verlangt N-0020 nicht. Das Original verlangt den
erhaltenen Kontext beim Hin- und Zurückwechsel.

## UX-02b · Originalabnahme als ausführbarer Fall (Nacharbeit 1)

`tests/themenlink-tag/themenkarte-abnahme-chromium.test.ts` fährt die Abnahme der Prioritätszeile
gegen die gebaute Anwendung in Chromium: bestehende Sitzung mit geholtem Bestand → zwei neue
Einträge mit gleichem Schlagwort plus fachfremde Kontrolle am Server → Stand älter als die
Frischefrist → Wissensnetz innerhalb der Anwendung → Themenknoten per Tastatur (Fokus, Enter) →
Bibliothekslink per Tastatur → genau die 2, Schlagwort in der Adresse, Filter gesetzt → Neuladen →
unverändert; einmal DE, einmal EN. Das Ergebnis steht im Prüfbericht des ausführenden Laufs, nicht
hier.

Grenzen des Falls: Die Einträge entstehen über die Dienste, nicht über die Erfassungsoberfläche.
Gemeint ist der Befundfall, in dem der Client von ihnen nichts weiß. Fokus wird per Skript gesetzt,
ausgelöst wird mit echter Enter-Taste; eine vollständige Tab-Reihenfolge ist nicht gemessen. Eine
Abnahme an der Live-Fassung ersetzt der Fall nicht.

## Offene Punkte und fehlende Nachweise

1. **UX-02b und N-0020 an der Live-Fassung.** Die neuen Chromium-Fälle laufen gegen die gebaute
   Anwendung mit Testbestand. Eine Abnahme an der ausgelieferten Fassung mit echtem Konto bleibt
   offen.
2. **N-0020, Graph mit Objektbezug.** Siehe oben; nicht verlangt, nicht gebaut.
3. **Rechteentzug während offener Lesefläche.** Kein eigener Test belegt den Sitzungsfall (Recht
   entzogen, danach Auffrischung mit 403). Enger Abnahmefall: Eintrag geöffnet → Vertraulichkeit
   so ändern, dass der Leser ihn nicht mehr sehen darf → Auffrischung → Stand-Hinweis, kein neuer
   Schreibweg; Neuladen → Fehlersatz ohne Ursache, kein fremder Bericht.
4. **Live-Nachweis zu den Fassungen.** JOB 3104 liegt in 1.0.0-beta.1.117, JOB 3115 in .130
   (Versionszuordnung, s. oben). Ob die Live-Fassung die Befunde N-0006/N-0016 (beobachtet an
   1.0.0-beta.1.101/.107/.112) nicht mehr zeigt, ist nicht belegt. Nötig ist eine Gegenprüfung an
   der ausgelieferten Fassung.
