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

| Lieferung | Inhalt laut Code und Tests | Zuordnung zu diesem Fall |
| --- | --- | --- |
| JOB 3104 (UX-02) | Suchbegriff `q` und Wahl `eintrag` stehen in der Adresse (immer `replace`); tote Kennung → ehrlicher Fehlersatz; Löschen räumt die Adresse. | Grundlage für N-0006, N-0016, P-UX-02. Kein Teil des Verzögerungsfalls, aber die Ableitung `gewaehlt`, auf der er steht. |
| JOB 3115 (UX-02b) | Wertprüfung des Adressfilters wartet auf einen bestätigten Bestand; Liste schweigt während des Wartens; Erstfehler → Listenfehler. | Genau der Verzögerungsfall, aber nur für die **Liste**. Die Lesefläche fehlte darin; hier ergänzt (L1–L4). |
| JOB 4263 | Fassungsrückholung im echten Browser (`tests/fassungsrueckholung-echter-browser/`). | Kein Beitrag zum Verzögerungs-/Lesewahlfall. Nutzt nur den direkten Weg `/wissen/:id`. |
| JOB 4330 | Diskussion am Dokument gegen PostgreSQL (`tests/wiki-diskussion-nutzerweg/`), dazu Toast-Aufräumen (`app/ToastContext.tsx`). | Kein Beitrag. Nutzt `/wissen/:id`. |
| JOB 4334 | Einordnungskonflikt gegen PostgreSQL (`tests/wiki-einordnung-konflikt/`). | Kein Beitrag. Öffnet `/bibliothek?eintrag=<id>&edit=1`, also die ausdrückliche Wahl, ohne Adressfilter. |

**Quellenwiderspruch:** Der Auftrag nennt 4263/4330/4334 als Lieferungen zu diesem Fall. Laut Code
und Tests sind es andere Fachfälle. Sie nutzen nur die ausdrückliche Wahl über die Adresse. Eine
Commit-Zuordnung über die Versionsgeschichte wurde in dieser Runde nicht erhoben.

## Pflicht und Vorschlag

- **N-0006, N-0016** sind als `designvorschlag` erfasst („Pedis Entscheidung bleibt offen“). Pflicht
  wurden sie mit der Prioritätszeile **P-UX-02** (Pedi 05.09. 22:14). Die Lieferung JOB 3104 erfüllt
  die URL-Variante; der stabile Dokumentlink bleibt die Alternative und ist unverändert.
- **N-0020** ist als `fehler` erfasst: Suchbegriff, Objekt und Leseposition beim Hin- und
  Zurückwechsel erhalten.
- **UX-02b** ist Pflicht samt ihrer Abnahme (bestehende Sitzung, zwei neue gleiche Schlagworte plus
  fachfremde Kontrolle, Themenwahl, Bibliothekslink, Neuladen; DE/EN, Tastatur).

## Offene Punkte und fehlende Nachweise

1. **UX-02b-Abnahme am echten Bestand.** Die Quelle sagt selbst „NICHT nachgefahren — Beleg ist
   Quelltext“. F1–F10 sind jsdom-Fälle mit gesteuertem Zwischenspeicher. Sie decken weder Neuladen,
   DE/EN noch Tastatur am Wissensnetz ab. Enger Abnahmefall: angemeldet `/bibliothek` öffnen
   (Bestand liegt im Zwischenspeicher) → zwei Einträge mit neuem gleichen Schlagwort plus einen
   fachfremden anlegen → `/wissensnetz` → Themenkarte per Tastatur (Tab/Enter) wählen →
   Bibliothekslink → Liste zeigt genau die 2, Filtermenü „· 1“, `?tag=` in der Adresse → Neuladen →
   unverändert; einmal mit DE, einmal mit EN.
2. **N-0020 Rückweg über den Herkunftsgraphen.** Suchbegriff und Objekt stehen seit JOB 3104 in der
   Adresse, die Browser-Zurück wiederherstellt (B4 belegt den Zurück-Weg nur innerhalb der
   Bibliothek). Die **Leseposition** (Rollstand im Bericht, geöffnete „Mehr“-Abschnitte) wird nicht
   erhalten. Der Graph-Link (`MehrAbschnitte.tsx`, `to="/graph"`) trägt keine Objektkennung.
   Enger Abnahmefall: Admin, `/bibliothek` → Titel suchen → Bericht wählen und rollen → „Mehr“ →
   Herkunftskette → „Im Wissensgraph ansehen“ → Browser-Zurück → Suchfeld, Trefferliste, gewählter
   Bericht und Rollstand wie vorher.
3. **Rechteentzug während offener Lesefläche.** Kein eigener Test belegt den Sitzungsfall (Recht
   entzogen, danach Auffrischung mit 403). Enger Abnahmefall: Eintrag geöffnet → Vertraulichkeit
   so ändern, dass der Leser ihn nicht mehr sehen darf → Auffrischung → Stand-Hinweis, kein neuer
   Schreibweg; Neuladen → Fehlersatz ohne Ursache, kein fremder Bericht.
4. **Lieferbeleg mit Fassung.** Welche ausgelieferte Version JOB 3104/3115 trägt und ob die
   Live-Fassung die Befunde N-0006/N-0016 (beobachtet an 1.0.0-beta.1.101/.107/.112) nicht mehr
   zeigt, ist hier nicht belegt. Nötig ist eine Gegenprüfung an der ausgelieferten Fassung.
