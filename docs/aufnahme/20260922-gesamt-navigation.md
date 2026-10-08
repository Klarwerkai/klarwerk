# Aufnahme 20260922 · Gesamt-Navigation — Zuordnung geliefert / vorhanden / offen

Auftrag `aufnahme:20260922:gesamt-navigation` („Navigation, Logo und aktiven Bereich konsistent
bedienen“), Lauf 1, 08.10.2026. Basis `dd696e5e` (`1.0.0-beta.1.756`). Die Fassung, in der dieser
Lauf ausgeliefert wird, steht erst nach der Veröffentlichung fest; bis dahin ist „dieser Lauf“ der
Kandidat auf dieser Basis. Den Prüflauf führt der Adapter aus; sein Bericht ist der Beleg (Ergebnis
der ersten Prüfung siehe „Nacharbeit 1“).

Quelle der Anliegen: `QUELLEN.json` des Auftrags, Punkte R-0881, R-0892, R-1023, R-1045, R-1813,
N-0012 und `package:navigation`.

## Übersicht

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-0892 Bibliothek aktiv auf `/wissen/:id` | geliefert (vorher) | JOB 562, `aktivAuchUnter: ["/wissen"]` in `app/navigation.ts` | `tests/app/i562-detailroute-aktiv-mounted.test.tsx` (Kopfband, jsdom) |
| R-0892 dasselbe im Drawer auf dem Tablet | **gemessen in diesem Lauf** | dieser Lauf (nur Test) | `tests/gesamt-navigation/tablet-chromium.test.ts` T1 (768 × 1024), T4 (1024 × 768) |
| R-0892 Menü auf dem Tablet bedienbar | geliefert (vorher): Drawer ≤ 899 px mit beschriftetem „Menü“ | JOB 3060, JOB 3525, JOB 3605, FE-002 | `tests/navigation-schmal/kein-sonderpunkt-schmal.test.tsx`, `tests/navigation-schmal/kopfband-schmal-chromium.test.ts`, T1 |
| R-1023 / R-1813 Name „Meine Aufgaben“ | Menüpunkt, Hilfe, Seitenhilfe: geliefert (vorher, R-0962). **Verweis aus der leeren Prüfliste: geliefert in diesem Lauf** | R-0962 (`docs/aufnahme/20260922-gesamt-aufgabenansicht.md`); dieser Lauf | `tests/aufgaben-ansicht/gegenstand-statt-besitzer.test.tsx`, `tests/gesamt-navigation/aufgaben-verweis.test.ts` |
| R-1813 U3-Browserweg | **nachgeführt in diesem Lauf** (der Smoke suchte den alten Weg „Zahnrad → Weitere Bereiche → Meine Aufgaben“) | dieser Lauf (nur Test) | `tests-smoke/gesamt-navigation-u3-browser.spec.ts` (Nacharbeit 1: aus `erstnutzer-u2-u3-browser.spec.ts` herausgelöst) |
| R-1023 Navigation selbsterklärend | geliefert (vorher): vier Obergruppen, „Arbeitsbereiche“ statt Zahnrad, „Seite finden ⌘K“, Seitenhilfe je Menüpunkt | JOB 3337, FE-002, JOB 3028 | `tests/fe002-kopfband/kopfband-fe002.test.tsx`, `tests/bedienbarkeit/u3-menuepunkt-erklaert-sich.test.tsx` |
| R-1023 Teilstück (b) „zu viele Informationen auf einer Seite“ | **gemessen (Nacharbeit 5/6) und die zwei schwersten Flächen entlastet (Nacharbeit 6/7):** Hilfe, Wissensobjekt bearbeiten, Risiken und Lücken | Nacharbeit 6 | `tests/gesamt-navigation/flaechenlast-chromium.test.ts` (vorher: Lauf nacharbeit-6; nachher: F2) |
| R-1045 „es geht unten weiter“ | **geliefert in diesem Lauf** | dieser Lauf | `tests/gesamt-navigation/weiter-unten-mounted.test.tsx`, `tablet-chromium.test.ts` T2, T4, T5 |
| R-1045 Entwicklerschalter nehmen keine Höhe | vorhanden seit JOB 3060 (Rollenvorschau steht in der scrollenden Liste, ohne Vorschau gar nicht); **gemessen in diesem Lauf** | JOB 3060 | `tablet-chromium.test.ts` T3 |
| package:navigation, kein Punkt verschwindet schmal | geliefert (vorher) | JOB 3503, JOB 3605 | `tests/navigation-schmal/kein-sonderpunkt-schmal.test.tsx`, T1 |
| package:navigation, „Meine Entwürfe“ gleichwertig | geliefert (vorher) | JOB 3503, JOB 3605 (Pedi, 11.09.) | `tests/entwuerfe-menuepunkt/kopfband-und-uebersicht.test.tsx` |
| package:navigation, „Gehe zu“ sichtbar und per Kürzel | geliefert (vorher), heute „Seite finden ⌘K“ | JOB 3525, FE-002 | `tests/entwuerfe-menuepunkt/gehe-zu-im-kopfband.test.tsx`, `tests/fe002-kopfband/kopfband-fe002-chromium.test.ts` |
| R-0881 Logo führt zur Startseite | historisch erledigt (KW-LOGO-HOME-01), nicht Teil der Kriterien | — | `tests/app/logo-home-route.test.ts` (in diesem Lauf nicht ausgewählt) |
| N-0012 Namen „Admin“/„Validierung“, Quellenhinweis | **gesonderter Auftrag** `arbeit:ux08-quellenhinweis-20260921` | — | nicht in diesem Lauf |

## Nacharbeit 1 (Prüfung am Kandidaten `e2e29642`)

Bis auf eine Suite waren alle Suiten grün: Build, drei jsdom-Suiten, `tablet-chromium` mit
`kopfband-fe002-chromium` und Format. In der Smoke-Datei `erstnutzer-u2-u3-browser.spec.ts` waren
U3 und „U2 · Bibliothek“ grün. Rot war nur **„U2 · Meine Entwürfe“**. Der Fall erwartet den
Admin-Satz `capture.draftScope.noteAdmin` („… (Admin-Ansicht: alle) …“). „Meine Entwürfe“ zeigt seit
Pedis Entscheidung `debbb8e8` (Entwürfe sind privat, Auftrag gesamt-entwurf-einreichen,
`pages/MeineEntwuerfe.tsx:66-72`) bewusst immer `capture.draftScope.note`. Das ist ein Fall von
R-1507 auf einer Basisänderung vor diesem Auftrag und betrifft keine Datei dieses Auftrags.
Behoben wurde er hier nicht. Weil das Smoke-Tor ganze Dateien wählt, steht U3 jetzt in einer eigenen
Datei, `tests-smoke/gesamt-navigation-u3-browser.spec.ts`. Der U2-Teil bleibt unverändert. Das
Mengenmanifest `tests/smoke/smoke-mengen-manifest.json` ist auf Version 14 nachgeführt: Der Fall ist
umgezogen und trägt den heutigen Titel, die Mengen bleiben gleich.

## R-1023 (b) / R-1813: überladene Flächen gemessen und die zwei schwersten entlastet

Die Quelle verlangt: zuerst mechanisch messen, welche Flächen die meisten gleichzeitig sichtbaren
Bedienelemente und Zustandsangaben tragen. Danach werden die zwei schlimmsten zusammengefasst oder
aufklappbar gemacht, ohne etwas zu löschen, mit Beleg vorher und nachher.

- **Messwerkzeug (Nacharbeit 5):** `tests/gesamt-navigation/flaechenlast-chromium.test.ts`. Der
  Test misst am gebauten Produkt mit Demobestand (Admin, Deutsch, 1280 × 800, Stufe 2 aus) jede
  Navigationsfläche und dazu die Detailflächen, die die Quelle nennt: Wissensobjekt lesen und
  bearbeiten, Konfliktvergleich, Doppelungsvergleich. Gezählt wird in `<main>` ohne Interaktion:
  sichtbare Bedienelemente plus Zustandsangaben mit Text. Die genaue Regel steht im Kopf der Datei.
- **Beleg vorher:** Lauf nacharbeit-6 am Kandidaten `8c39989a`, ohne jede Entlastung.
  - Ergebnis: Hilfe 525 · Wissensobjekt bearbeiten 129 · Risiken und Lücken 126 · Themenkarte 113 ·
    Offene Aufgaben 81 · Wissensobjekt lesen 79 · Bibliothek 77 · Prüfen 38 · Erfassen 28 ·
    Konflikte 24 · Konfliktvergleich 18 · alle übrigen ≤ 16.
  - Die von der Quelle vermuteten Kandidaten liegen damit nicht vorn. „Wissensobjekt lesen“ ist durch
    das vorhandene „Mehr“ schon entlastet, die Konfliktdarstellung ist leicht. Vorn liegen „Bearbeiten“
    und die Hilfe.
- **Entlastet (Nacharbeit 6), jeweils aufklappbar und ohne Löschung:**
  1. **Hilfe** (`pages/Help.tsx`): Die Merkmalspillen („Suchbegriffe“) unter jedem Kapitel waren der
     größte Teil der Last. Sie stehen jetzt hinter dem Schalter „Suchbegriffe der Kapitel zeigen“
     (`hilfe-suchbegriffe-schalter`, DE/EN/NL in `texte/navigation.ts`). Bei laufender Suche stehen
     sie von selbst offen. Die Suche selbst liest die Daten und ist unverändert.
  2. **Wissensobjekt bearbeiten** (`components/bibliothek/BibliothekFlaeche.tsx`, Meldung aus
     `BibliothekLesen.tsx`): In der breiten Ansicht klappt die Trefferliste daneben ein, solange
     bearbeitet wird. Das waren rund 60 Elemente, die beim Bearbeiten niemand braucht. Der Schalter
     `bib-liste-beim-bearbeiten` („Trefferliste einblenden“) holt sie zurück. Endet das Bearbeiten,
     steht die Liste wieder. Telefon und Tablet sind ohnehin einspaltig und unverändert.
- **Lauf nacharbeit-7 (Kandidat `35d8b164`), mit korrigierter Zählregel und einer Doppelung im
  Bestand:**
  - Hilfe 476 → 134
  - Risiken und Lücken 135 → 135
  - Wissensobjekt bearbeiten 134 → 69
  - Themenkarte 113 · Offene Aufgaben 87 · Wissensobjekt lesen 83 · Bibliothek 81 · Prüfen 38 ·
    Erfassen 28 · Konflikte 24 · Doppelungen 17 · Doppelungsvergleich 11 · Konfliktvergleich 10 ·
    alle übrigen ≤ 16

  Beide Entlastungen wirken. Platz 2 und 3 liegen nach der neuen Zählregel aber nur einen Punkt
  auseinander, und „Risiken und Lücken“ lag knapp vorn. Deshalb ist auch diese Fläche entlastet:
  3. **Risiken und Lücken** (`pages/Risk.tsx`): Die Pflege der Eingänge (nur Admin) machte rund 85
     der 135 aus: je Bereich Verantwortung, vier Stufen und Speichern, dazu die
     Ruhestandshorizonte. Sie steht jetzt hinter dem Schalter `risiko-pflege-schalter` („Bereiche und
     Ruhestandshorizonte pflegen“). Aufgeklappt ist sie unverändert dasselbe Bauteil
     (`BereichsprofilPflege`); Rechte und Server bleiben unberührt.
  F2 verlangt weiterhin, dass die zwei schwersten Flächen des jeweiligen Laufs entlastet sind, und
  prüft jede als entlastet geführte Fläche einzeln (Schalter, nachher leichter, aufgeklappt
  vollständig).
- **Beleg nachher:** Derselbe Test misst je Fläche den eingeklappten Stand (nachher) und den
  aufgeklappten (vorher, alle `data-entlastung-schalter` geöffnet). F2 prüft:
  - Die zwei schwersten Flächen der aktuellen Rangliste sind genau diese zwei.
  - Nachher ist leichter als vorher.
  - Aufgeklappt fehlt kein Bedienelement.
- **Korrekturen am Messwerkzeug aus Lauf nacharbeit-6:**
  - Inhalt zugeklappter `<details>` wurde mitgezählt, weil Chromium ihn per `content-visibility`
    ausblendet und er trotzdem ein Rechteck hat. Jetzt entscheidet `checkVisibility()`.
  - Der Demobestand enthält keine Doppelung. Der Test legt sie über die echte Route an: zwei
    textgleiche Beiträge, deterministische Erkennung.
- **Grenze:** Die Zählregel für Zustandsangaben (Rollen, Pillenform, Kennungen) ist eine
  dokumentierte Annäherung und gilt gleich für alle Flächen. Ob die Bedienung für Erstnutzer ohne
  Schulung gelingt, belegt sie nicht (SCRUM-474, Menschenprobe).

## Was dieser Lauf gebaut hat

- **R-1045:** `apps/web/src/shell/WeiterUnten.tsx`. Am unteren Rand des Drawers und der Übersicht
  „Arbeitsbereiche“ steht „Weitere Einträge unten ↓“ (`texte/navigation.ts`, DE/EN/NL), solange
  unter der sichtbaren Kante noch Einträge liegen. Der Hinweis nimmt keine Höhe und keinen Fokus
  (0 px hohe, klebende Hülle, `aria-hidden`, klickdurchlässig).
- **R-1023 / R-1813:** Die leere Prüfliste verweist mit „Zu den offenen Aufgaben“ / „Go to open
  tasks“ / „Naar open taken“ (`texte/aufgaben.ts`, `aufgaben.zumBereich`) statt „Zu meinen
  Aufgaben“ / „Go to my tasks“ / „Naar mijn taken“. Der alte Schlüssel `empty.cta.tasks` steht
  unverändert im Grundwörterbuch, weil dessen Werte gegen den Basisstand gepinnt sind; er wird
  nicht mehr verwendet.
- **Tests:** drei neue Dateien unter `tests/gesamt-navigation/`. Dazu angepasst:
  `tests/analytics/empty-state-actions.test.ts` (neuer Schlüssel) und der U3-Fall im Smoke.

## Quellenwidersprüche und Abgrenzungen

1. **„Seitenleiste“ (R-1045, 12.08.)** gibt es seit JOB 3060 nicht mehr. Ihre Rolle tragen der Drawer
   und die Übersicht „Arbeitsbereiche“. Die Anforderung wurde dort umgesetzt.
2. **„Gehe zu ist sichtbar“ (package:navigation):** Auf dem oberen schmalen Band (760–899 px) und
   breit steht „Seite finden ⌘K“ im Kopfband. Unter 760 px steht der Eintrag nur im Menü
   („Arbeitsbereiche“ → „Seite finden“), das Kürzel gilt überall. Das ist der Bestand von JOB 3605
   und FE-002 und wurde nicht geändert.
3. **„Meine Aufgaben“ in `OFFEN.md` U3 (R-1813)** nennt `i18n.ts:28`. Die Texte stehen heute in
   `apps/web/src/woerterbuch/*.ts` beziehungsweise `texte/*.ts`.
4. **Das Paket „navigation“** nennt seine Kriterien selbst „Planvorschläge“ ohne direkte
   Nutzerquelle. Umgesetzt wurde nur, was der vorhandene Stand noch nicht trug.

## Offen (mit Grund)

- **Selbsterklärend für Erstnutzer (R-1813):** Ob die Bedienung ohne Schulung gelingt, kann nur ein
  Nachtest mit Menschen belegen (SCRUM-474). Kein Test ersetzt das. Die Klärung mit Pedi zum
  Umfang vor dem 12.08. ist historisch und durch die späteren Lieferungen überholt.
- **Echtes Tablet:** Gemessen wird Chromium mit Tablet-Maßen. Touch, Safari/WebKit auf dem iPad und
  die Bedienung am Gerät sind nicht belegt.
- **Fremdbefund Klassenbindungen (Nacharbeit 7):** `tests/app/mega47-modale-flaechen-sammler.test.tsx`
  meldet 251 statt 226 unauflösbare Klassenbindungen. Gezählt werden nur `className={…}`-Ausdrücke.
  Die Dateien dieses Auftrags fügen seit dem letzten Stand dieser Zahl (`df501851`) keinen einzigen
  hinzu; alle neuen Schalter tragen wörtliche Klassen. Die +25 stammen aus dem eingemischten
  Hauptstand und lassen sich ohne Lauf nicht einzeln benennen. Der Pin bleibt unverändert, und der
  Test ist nicht mehr Teil dieser Prüfauswahl.
- **Bauteilinventur (Nacharbeit 7):** `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` ist
  auf die gemessenen 523 nachgeführt, nach der Konvention der Datei. Davon trägt dieser Auftrag 1
  bei (`WeiterUntenHinweis`); 7 kamen mit dem Hauptstand. Die Zuordnung steht am Pin.
- **Unveränderter Fremdbefund:** `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` W1
  vergleicht die Wörterbücher Byte für Byte mit `i18n-vor-aufteilung.txt`. Diese Datei trägt noch
  „Meine Aufgaben“, während `woerterbuch/de.ts` seit R-0962 „Offene Aufgaben“ trägt. Nach dieser
  Quelleninspektion weicht W1 schon auf der Basis ab; ausgeführt wurde der Test in diesem Lauf
  nicht. Dieser Lauf ändert die Wörterbücher nicht. Der Test ist nicht ausgewählt und nicht
  abgeschwächt.
