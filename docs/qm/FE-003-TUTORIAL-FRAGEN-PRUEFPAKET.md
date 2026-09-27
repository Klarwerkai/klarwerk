# FE-003 · Interaktives Seitentutorial „Fragen“ — Prüfpaket

> **FE-003: menschliche Tutorial-Abnahme durch Pedi noch offen.**
> Technische Tests belegen Funktion, Demo-Grenze und Bedienbarkeit. Ob eine neue Person die Seite
> danach versteht und selbst anwenden kann, belegt kein Test. Diese Abnahme ist erst mit einem
> tatsächlichen Befund aus der gemeinsamen Verständlichkeits- und Bedienprobe mit Pedi erteilt.

Auftrag: `arbeit:fe-003-tutorial-fragen-20260926`, Revision 1 (Fachpriorität 1). Produkt: KLARWERK
(Webanwendung). KLARA (Microsoft-365-Erweiterung) ist nicht Teil dieses Auftrags.

## Stand, der geprüft wird

- **Kandidatencommit:** der Commit, den die Steuerung nach diesem Bauauftrag festhält (Branch
  `lauf/lauf_b3_arbeit_fe-003-tutorial-fragen-20260926_2`). Diese Datei nennt ihn nicht selbst — sie
  wird mit ihm eingefroren. Welcher Commit tatsächlich läuft, meldet der Server unter `/health`
  (`commit`, `version`); die Version steht zusätzlich im Zahnrad-Menü.
- **Öffentliche Bereitstellung:** `https://klarwerk.ai/fragen` zählt erst, wenn `/health` dort den
  Kandidatencommit meldet. Ausgeliefert wird nur über CI/CD, nicht aus diesem Auftrag.

## Vorschau für die Probe mit Pedi

Die Vorschau ist GENAU der ausgecheckte Kandidat, lokal auf dem Mac, ohne Modell, ohne Datenbank und
ohne Netz nach aussen (KI-aus-Fall; keine Live-Daten):

1. Den Kandidatencommit auschecken (sauberer Arbeitsbaum, auch ohne unversionierte Dateien).
2. `tools/fe003-vorschau` — baut `apps/web/dist` aus diesem Stand und startet den Server In-Memory
   auf Port 3123 (`KLARWERK_VORSCHAU_PORT` ändert ihn). Der Server bekommt eine LEERE Umgebung plus
   `PATH`, `HOME`, `TMPDIR`, `LANG` und die Vorschau-Schalter (`KLARWERK_BUILD_COMMIT` =
   `git rev-parse HEAD`, `KLARWERK_SKIP_KEYCHAIN=1`, kein lokales Modell, `EXTERNAL_SEARCH=off`):
   Cloud-Zugangsdaten, `DATABASE_URL` oder eine KI-Zuordnung aus der aufrufenden Shell erreichen ihn
   nicht. Die globale KI-Konfiguration bleibt unberührt.
3. Das Skript PRÜFT danach und bricht mit Exit ≠ 0 ab, wenn eine Zusage nicht hält: `/health`
   antwortet mit gültigem JSON und meldet genau den ausgecheckten Commit und die Version aus
   `package.json`; `/api/reasoner/status` meldet `active=false`, `reachable=none`; `/fragen` liefert
   die Oberfläche aus. Dieselben Prüfungen laufen bei `tools/fe003-vorschau status` und bei einem
   erneuten `start` auf eine schon laufende Instanz — eine Instanz eines anderen Stands oder ein
   schmutziger Arbeitsbaum wird abgelehnt, nicht wiederverwendet (dann `tools/fe003-vorschau stop`).
4. Im Browser `http://127.0.0.1:3123/` öffnen. Beim ersten Aufruf die Ersteinrichtung ausfüllen
   (das erste Konto wird Admin; In-Memory, beim Beenden verworfen), dann `/fragen`.

Belegt durch `tests/fe003-tutorial-fragen/vorschau-skript.test.ts` (Wegwerf-Repository mit
Stellvertreter-Server: anderer Stand, schmutziger Baum, nicht erreichbares `/health`, aktives Modell,
Cloud-Zugangsdaten in der Aufrufer-Umgebung).

Im Browserlauf auf dem Testserver (Smoke-Sonde, Chromium) wird derselbe In-Memory-Start ohne Modell
genutzt; dort gilt dieselbe Zuordnung über den HEAD-Nachweis des Prüfauftrags.

## Was gebaut ist

| Teil | Ort |
| --- | --- |
| Knopf „Tutorial“ in einer Leiste direkt unter dem schwarzen Kopfband, links unter dem Schriftzug, Markenfarbe (orange) | `apps/web/src/tutorial/TutorialRahmen.tsx`, eingebunden in `apps/web/src/shell/AppShell.tsx` |
| Aufklappender Bereich oben auf derselben Seite: „Tutorial: Fragen“, Lernziel, Kapitel, Fortschritt, Erklärung, „Mehr dazu“, Vorführung in Teilen, Demo | `apps/web/src/tutorial/TutorialBereich.tsx` |
| Rahmen/Register für spätere Seiten — heute nur `/fragen` eingetragen | `apps/web/src/tutorial/rahmen.ts`, `typen.ts` |
| Unterrichtsfolge (7 Schritte) mit Zielen je Teil | `apps/web/src/tutorial/fragen/lektion.ts` |
| Demo aus den echten Bausteinen, Übung, Übergang „Eigene Frage stellen“ | `apps/web/src/tutorial/fragen/FragenDemo.tsx` |
| Texte DE/EN/NL | `apps/web/src/texte/tutorial.ts` |
| Aus `pages/Ask.tsx` herausgelöste gemeinsame Bausteine (Seite und Demo nutzen dieselben) | `apps/web/src/components/fragen/FrageFeld.tsx`, `Quellenplaketten.tsx`, `QuellenListe.tsx`, `Antwortbausteine.tsx`, `ziele.ts` |
| Vorlesen über die Browser-Sprachausgabe (gemeinsam mit Klara) | `apps/web/src/lib/vorlesen.ts` |

Gemeinsam genutzte Bausteine von echter Seite und Demo: `FrageFeld`, `AntwortPlatzhalter`,
`AntwortText`, `AiGeneratedNotice`, `QuellenChipInhalt` (Punkt-Regel `chipPunkt`), `OverflowMenu`
(„…“ an der Antwortkarte), `Seitenblatt` („Mehr zu dieser Antwort“), `QuellenListe` (darin
`VerwendungsPlakette`, `PruefstandPlakette`, `AnswerSourceDetails`), `KiNichtVerfuegbar`.

**Quellenweg (Runde 2, Bens Befunde 1 und 2):** Die Demo führt den tatsächlichen Weg der Seite vor
und macht ihn bedienbar: Chip an der Antwort, dann „…“ an der Antwortkarte → „Mehr …“ → Blatt mit
der Quellenliste. Auf der echten Seite öffnet der Chip das Wissensobjekt; die erfundene
Demo-Quelle hat keines — ihr Chip sagt das in einer auf- und zuklappbaren Erklärung, statt auf eine
nicht vorhandene Seite zu zeigen. Die Quellenliste der Demo entsteht aus denselben Ableitungen wie
auf der Seite und hat keinen Titel-Link und kein „Danke“. „Drucken“ und „Als Markdown“ im
Demo-Menü drucken und speichern nichts und sagen das. Escape im Blatt schließt nur das Blatt.

**Laufende Vorführung im Blatt (Runde 3, Bens Befund):** Läuft „Vorführen“ im Kapitel „Quelle“ in
das modale Blatt „Mehr“, sperrt dessen Modalgrenze — die der echten Seite, unverändert — den
Tutorial-Bereich. Deshalb steht im Blatt eine Tutorial-Begleitung: der gerade gezeigte Teil,
„Vorführen“/„Pause“, die Teile des Schritts zum direkten Anwählen und die Erklärung des Schritts.
Sie steuert dieselbe Vorführung wie der Rahmen. Schließen des Blatts hält an und stellt die
Erklärung zurück auf „…“, weil die Teile ab „Liste“ nur im offenen Blatt sichtbar sind.

**Blatt und Teilwahl (Lauf 2, Bens Befund d0496390):** Im Kapitel „Quelle“ ist das Blatt „Mehr“ genau
dann offen, wenn ein Teil ab „Liste“ gewählt ist — gleich, ob es über „…“ → „Mehr …“, über die
Teilliste oder die Vorführung geöffnet wurde. Wählt man in der Begleitung „Chip“ oder „…“, schließt
sich das Blatt, der Teil bleibt gewählt, und das hervorgehobene Ziel ist sofort bedienbar. Vorher
hielt ein über das Menü geöffnetes Blatt sich offen, und das Ziel blieb hinter der Modalgrenze
gesperrt.

**Blatt und Teilwahl in den übrigen Kapiteln (Lauf 3):** Auch in „Antwort“, „Sonderfälle“ und
„Üben“ öffnet „…“ → „Mehr …“ das Blatt, und die Begleitung darin bietet die Teile an — deren Ziele
liegen aber alle ausserhalb des Blatts. Öffnet man das Blatt dort selbst, hält die Vorführung an;
jede Teilwahl in der Begleitung (auch die des schon gewählten Teils) schliesst das Blatt, und das
gewählte Ziel ist hervorgehoben und bedienbar. Vorher blieb es hinter der Modalgrenze gesperrt.

**Kopf bei schmaler Breite (Lauf 2, Beraterbefund):** Titel und Lernziel haben eine Grundbreite von
16 rem; reicht der Platz daneben nicht, rücken „Vorlesen“ und „Tutorial schließen“ darunter. Vorher
wurde die Textspalte bei 390 px auf etwa 63 px zusammengedrückt.

Bewusst **nicht** als eigener Baustein herausgelöst: der Kopf der Lückenkarte. Der Wächter
`tests/app/mega54-ein-naechster-schritt-sammler.test.ts` verlangt an jeder Fläche mit dem Lückensatz
genau einen nächsten Schritt; die Demo zeigt die Lücke deshalb aus denselben Texten und derselben
Vertragsableitung (`answerContract("gap")`) samt nächstem Schritt. Die Hülle der Demo-Antwortkarte
ist `Card` ohne `print-area` — eine Demoantwort soll nicht als echter Antwortauszug druckbar sein.

## Automatische Belege

| Kriterium | Beleg |
| --- | --- |
| E1 Knopf, Lage, Farbe, Öffnen/Schließen ohne Verlust | `tests/fe003-tutorial-fragen/tutorial-fragen-mounted.test.tsx` (E1, E1/E5); Browser: `tests-smoke/fe003-tutorial-fragen.spec.ts` |
| E2 Unterrichtsfolge vollständig als Text (DE/EN/NL), Beispiel als fiktiv gekennzeichnet | ebd. (E2) |
| E3 Weiter/Zurück, Kapitel, Fortschritt, Vorführen/Pause/Wiederholen, Vorlesen freiwillig und stoppbar | ebd. (E3) |
| E2/E4 Quellenweg wie auf der Seite (Chip wirkt und schließt, „…“ → „Mehr …“ → Liste, gleiche Menüpunkte, gleiche Listenanker, Escape) | ebd., Block „Runde 2“; Browser: Übung in der Smoke-Sonde |
| E3/E6 laufende Vorführung im Blatt „Mehr“: Pause, Teile und Erklärung bedienbar, Rahmen gesperrt | ebd., „laufende Vorführung im Blatt …“ (Echtzeit); Browser: je 1280 und 390 px |
| E6 Blatt über Menü oder Teilliste geöffnet × Rückwahl „Chip“/„…“: Blatt zu, Teil gewählt, Ziel nicht gesperrt | ebd., „Blatt geöffnet über …, Rückwahl auf Teil …“ (4 Fälle) |
| E6 Antwort/Sonderfälle/Üben: Blatt über „…“ geöffnet hält die Vorführung an; jede Teilwahl schliesst es, Ziel nicht gesperrt | ebd., „…: Blatt über „…“ geöffnet, Teilwahl …“ (9 Fälle) |
| E6 Titel/Lernziel nicht zusammengedrückt (Textspalte ≥ min(256 px, 70 % des Bereichs)) | Smoke-Sonde je Breite, `tutorial-kopftext` |
| E4 gemeinsame Bausteine, Änderungsprobe, Ziele über Namen, fehlendes Ziel fällt auf, keine Bilder/Videos | `tests/fe003-tutorial-fragen/aenderungsprobe-mounted.test.tsx`; ebd. (E4) |
| E5 ohne KI, keine Mutation (Netz auf `fetch`-Ebene protokolliert), Übergang ohne Senden, rollenabhängige Alternativen | ebd. (E5); Browser-Netzbeobachtung in der Smoke-Sonde |
| E6 Fokus, Escape, Tastatur, reduzierte Bewegung, 1280/1024/390 px | ebd. (E6); Smoke-Sonde je Breite |
| E7 nur `/fragen` hat ein Tutorial | ebd. (E7); Smoke-Sonde „andere Seiten“ |

## Schritte für die menschliche Probe (Pedi)

Je Breite einmal: Desktop 1280 px, Laptop 1024 px, schmal 390 px (Browser, Rolle, URL und Commit
im Protokoll notieren).

1. `/fragen` öffnen. Eine eigene Frage ins Feld tippen, **nicht** absenden.
2. Unter dem schwarzen Kopfband links auf **„Tutorial“** klicken. Der Bereich klappt oben auf; die
   getippte Frage steht weiter im Feld.
3. Schritt 1–7 mit „Weiter“ durchgehen. Je Schritt: Erklärung lesen, „Mehr dazu“ aufklappen,
   Vorführung ansehen, „Pause“ und „Schritt wiederholen“ ausprobieren, einen Teil der Vorführung
   direkt anklicken.
4. Einmal ein Kapitel direkt wählen (z. B. „5. Quelle“) und „Zurück“ benutzen.
5. Optional „Vorlesen“ starten und wieder stoppen.
6. In Schritt 5 und 7 den Quellenweg bedienen: Chip anklicken (Erklärung auf/zu), dann „…“ an der
   Demo-Antwortkarte → „Mehr …“ → Quellenliste lesen, Blatt schließen. In Schritt 7 vorher eine
   Übungsfrage in der Demo stellen und die Übungsantwort lesen.
7. „Eigene Frage stellen“: der Cursor steht im echten Feld, die Frage aus Punkt 1 ist unverändert,
   nichts wurde gesendet.
8. Nur mit Tastatur wiederholen: Tab zum Knopf, Eingabetaste, Tab/Eingabetaste durch die Schritte,
   Escape schließt und der Fokus steht wieder auf „Tutorial“.
9. Mit eingeschalteter „Bewegung reduzieren“ (Betriebssystem) Schritt 2 ansehen: die Frage steht
   sofort vollständig da.
10. Eine andere Seite (z. B. Bibliothek) öffnen: dort gibt es keinen Tutorial-Knopf.

**Verständlichkeitsfrage an Pedi (offen):** Könnte eine neue Person nach dem Tutorial selbst eine
gute Frage stellen, die Antwort einordnen und eine Aussage an ihrer Quelle prüfen? Was fehlt, was ist
zu viel?

## Grenzen und offene Punkte

- **Menschliche Abnahme offen** (siehe oben).
- Die Erklärtexte ändern sich nicht von selbst mit der Seite. Die Bausteine der Demo tun es; Texte,
  Reihenfolge und Verweise auf Bedienelemente müssen bei Änderungen an `/fragen` mitgeprüft werden.
  Ein verlorenes Ziel meldet die Demo sichtbar, und der Test über alle Ziele wird rot.
- FE-002 (Header-Orientierung) ist nicht bearbeitet. Die Tutorial-Leiste steht unter dem heutigen
  Kopfband; bei Integration von FE-002 ist die Lage des Knopfs am dann gültigen Kopfband erneut zu
  prüfen.
- Die Demo-Quelle nutzt denselben Quellenbaustein wie die Seite; dieser fragt beim Anzeigen der
  Quellenliste die Lesevarianten-Übersicht ab (reiner Lesezugriff `GET`), wie auf der echten Seite.
  Verändernde Anfragen gibt es keine.
