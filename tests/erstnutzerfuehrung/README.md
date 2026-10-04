# Aufnahme 20260922 · Gesamt-Erstnutzerführung — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-erstnutzerfuehrung`: Aufgabenrevision 2, Lauf 1, Runden 1–3,
Stand der Fassung **1.0.0-beta.1.632** (Basis `8f0ec01c`), abgeglichen am 29.09.2026. Fortgesetzt in
Aufgabenrevision 9, Lauf 3, Runde 1 (01.10.2026, Basis `21ee1ef0`); siehe „Lauf 3“ unten.

## Folgeauftrag `…-quellen` (Option B, Revision 4): Zuordnung und Umsetzung

Auftrag `aufnahme:20260922:gesamt-erstnutzerfuehrung-quellen`, Basis `2042438a`, 03.10.2026. Hier
geht es um die fünf Zielzustände, die Pedi mit `entscheidung:622a6ae6` (Option B) aus dem
Ursprungsauftrag ausgelagert hat. Die Zeilen weiter unten (Lauf 1) bleiben als älterer Abgleich
stehen. **Quellenlage:** Die Auftragsquelle enthält zu R-0455, R-0928, R-0939, R-1012 und R-1675 nur
den Kurzwortlaut und Verweise auf die Quellenpakete (`aufnahmepunkte-004.json` `$[68]`,
`aufnahmepunkte-008.json` `$[21]`, `$[32]`, `$[105]`, `aufnahmepunkte-021.json` `$[10]`). Den
Originalwortlaut dieser Pakete gibt es weder in der Auftragsquelle noch im Repository. Die Zuordnung
unten stützt sich daher auf Repository, Git-Historie und `OFFEN.md`.

| Zielzustand | Stand heute | Beleg |
|---|---|---|
| **R-0455** Erstbesucher findet ohne Erklärung, wonach er sucht (Inventar, Anschlusspaket, Rotvertrag, Klarheitsvertrag, Ownerpaket) | Artefakte **nicht auffindbar** · Zielzustand **als prüfbares Kriterium abgeleitet**, teilweise belegt | Gesucht wurde in Repository und `git log --all` (Nachrichten), auch nach Schreibvarianten. **Ownerpaket, Klarheitsvertrag:** kein Treffer. **Rotvertrag:** nur als allgemeiner Prüfbegriff des Hauses (z. B. `tests/capture/frontdoor-bedeutung-mounted.test.tsx:28`), kein Erstbesucher-Artefakt. **Anschlusspaket:** nur `dbe0e182` (JOB 4156, „Anschlusspaket WIKI-GESAMTANWEISUNG-ANSCHLUSS“), das ist ein anderes Thema. **Inventar:** Es gibt die Funktionsinventare `tests/design/h1…h6-funktionsinventar.test.ts`. Ob eines davon das genannte Inventar ist, lässt sich nicht belegen. **Abgeleitetes Kriterium:** (a) Jede Funktion, die von der Startfläche verschwunden ist, hat einen benannten, bedienbaren Ort (`tests/design/h5-funktionsinventar.test.ts`, Chromium). (b) Die Startfläche trägt keinen Erklärtext über 40 Zeichen (`tests/design/zielbild-h5-kein-erklaertext.test.ts`). (c) **Neu:** Ein Blatt nennt alle Kernbereiche mit Namen, Zweck und Weg (R-1012 unten). Ob ein Mensch damit „ohne Erklärung findet“, belegt erst ein Nachtest mit Menschen. |
| **R-0928** Kurze thematische Einstiegsseiten (Erfassen, Validieren, Fragen, Bibliothek) → volle Konsole | **Nacharbeit 10: gebaut** — vier Einstiegsansichten `/einstieg/{erfassen,pruefen,fragen,bibliothek}` (`pages/Einstieg.tsx`, `lib/einstiege.ts`), je Zweck, erster Schritt und Übergabe an die Vollfunktion, benannt im Blatt „Über KLARWERK“; Tests `einstiege.test.tsx` E0–E4, Chromium I13. Menschliche Orientierung offen. (Vorher: eigene Einstiegsseiten offen, Teilersatz geliefert.) | Eigene Seiten gab es nie. `routes.tsx` hat keine Einstiegsroute, und unter `apps/web/src/pages` gibt es keine Missionsseite (Stand `bf9fcf1c` bestätigt). Seit diesem Auftrag führt das Blatt „Über KLARWERK“ zu allen vier Themen, je mit einem Satz und einem Weg in die volle Funktion (`lib/faehigkeiten.ts`, Test F0c/F1/F4). Das ist **keine** eigene Seite je Thema. Ein Neubau ist ohne Entscheidung nicht erfolgt (Frage 1 unten). |
| **R-1675** „Missions“-Einstiegsseiten → Vollfunktion (**optional** laut Quelle) | **geliefert, dann abgelöst** (Kachelform) | Geliefert in `9be7466b` (26.06., `lib/missions.ts`, Kacheln auf Start). Zurückgenommen mit mega38 G2 (Pedi 27.07.: „eine zweite Navigation in Kachelform“) und gelöscht in `5150cd5a` (28.07.). Beide Commits sind in der Historie geprüft. Die Ablösung bleibt wirksam. Nichts wurde zurückgebaut oder neu gebaut. |
| **R-0939** Kernschleife erfassen → prüfen → finden, erhoben und priorisiert | **Nachweis fehlte** · Erhebung **hier geliefert** (s. u.) | Im Repository gab es keine Dokumentation der Erhebung oder Priorisierung. Deshalb ist die Erhebung unten das Ergebnis dieses Auftrags. Die Übersicht ordnet die Bereiche in genau dieser Schleife (F0b). |
| **R-1012** Einstiegsfläche: umfassendes Bild, was das System kann | **zugeordnet** (`OFFEN.md:123` U4 / SCRUM-474) · **geliefert** als Fähigkeitsübersicht im Blatt „Über KLARWERK“ | Das Blatt hat jetzt unter dem Zwecksatz den Abschnitt „Was KLARWERK kann“: drei Schritte, acht Bereiche, je Name, Satz und Weg, dazu der Weg zur Hilfe. Der Ort ist das „…“-Menü und nicht das Sichtfeld. So bleiben H5 (Pedi 04.09., ≤ 40 Zeichen Erklärtext) und mega38 G2 (keine Kacheln auf der Fläche) unberührt. Namen und Ziele kommen aus `app/navigation.ts`, es gibt kein zweites Register. Bereiche außerhalb der Rolle bleiben als Auskunft stehen (`RoleLink`). Test: `faehigkeitsuebersicht.test.tsx` F0–F5. Der Startziel-Sammler `tests/app/mega51-startziele-erreichbar-sammler.test.ts` ist nachgeführt (`/duplikate` als Lage für viewer/experte). |

### R-0939 · Erhebung der Kernschleife (Stand `2042438a`, am Code)

Der Weg in Schritten, mit dem Übergang, der im Code existiert:

| Nr. | Übergang | Im Code | Lage |
|---|---|---|---|
| S1 | Start → Finden | Feld „Was möchtest du wissen?“ → `/fragen?q=…&ask=1` (`pages/Start.tsx:113`) | geschlossen |
| S2 | Start (leerer Bestand) → Erfassen | Zeile „Noch kein Wissen im Bestand — das erste erfassen“ → `/erfassen` (`pages/Start.tsx:331-349`) | geschlossen |
| S3 | Finden ohne Treffer → Erfassen | Bibliothek „Nichts gefunden.“ + „Erfassen“ (`BibliothekListe.tsx`) · Fragen ohne Modell: Bibliothek/Erfassen (`components/fragen/Antwortbausteine.tsx:78-87`) · Palette/Hilfe → Fragen (Lauf 1) | geschlossen; für „viewer“ ist Erfassen Auskunft statt Weg (Rolle) |
| S4 | Erfassen → Prüfen | Nach dem Einreichen: „Eingereicht“ + Objektlink + „Validierung öffnen“ (`components/erfassen/Blatt.tsx:3444-3454`) | für Experten **Auskunft, kein Weg** (`/validierung` verlangt „controller“) |
| S5 | Prüfen → zurück an die Autorin | Rückgabe erscheint als Aufgabe „Nacharbeit“ in „Meine Aufgaben“ (`lib/taskFilters.ts:13`, `task.returned`) | geschlossen für die Rückgabe |
| S6 | Prüfen → Finden | Prüfseite öffnet das Objekt (`pages/Validation.tsx:1337`, `:1469`) | geschlossen |
| S7 | Freigabe → Autorin erfährt es | `NotificationKind` kennt nur `conflict`, `duplicate`, `gap`, `assignment`, `impact` (`api/types.ts:2500`) | **Abbruchstelle**: keine eigene Meldung bei Freigabe |

**Priorisierung (Vorschlag dieses Auftrags, Begründung je Punkt):**

1. **S7 – Freigabe kommt bei der Autorin nicht an (hoch).** Hier fällt der Mensch aus der Schleife.
   Wer erfasst, erfährt nicht, dass sein Wissen jetzt gefunden werden kann. Behebung wäre eine neue
   Meldungsart, also eine neue Funktion, und die schließt U4 aus („keine neue Funktion“). **Nicht
   gebaut**, Frage 2 an Pedi.
2. **S4 – „Validierung öffnen“ ist für Experten kein Weg (mittel).** Das ist bewusst so (mega70 B,
   Rollenrecht) und kein Fehler. Der Mensch sieht aber keinen nächsten Schritt außer „Neuer
   Eintrag“. Nicht geändert, weil das die Rechtelogik berührt (U4-Grenze).
3. **S3 – Nulltreffer für „viewer“ (niedrig).** Der Weg „Erfassen“ erscheint als Auskunft. Das ist
   rollenrichtig, und „Fragen“ bleibt als Alternative.
4. **S1, S2, S5, S6 – geschlossen.** Kein Handlungsbedarf aus dieser Erhebung.

**Grenze der Erhebung:** Sie liest den Code. Gemessene Abbruchquoten echter Nutzer gibt es nicht.
Dafür fehlen Nutzungsdaten oder ein Nachtest mit Menschen.

### Fragen an Pedi (mit Optionen)

1. **R-0928 – eigene thematische Einstiegsseiten?** (A) Das Blatt „Über KLARWERK“ mit Übersicht
   genügt, R-0928 gilt damit als erfüllt. (B) Je Thema eine kurze eigene Seite unter neuer Route,
   was gegen mega38 G2 und H5 abzuwägen wäre. (C) R-0928 als durch mega38 G2 abgelöst schließen.
   Ohne Entscheidung bleibt R-0928 **offen**.
2. **R-0939/S7 – Meldung bei Freigabe an die Autorin?** (A) Neue Meldungsart „freigegeben“ in „FÜR
   DICH“/Glocke, als eigener Auftrag, weil es eine neue Funktion ist. (B) Bewusst nicht. Dann bleibt
   S7 als bekannte Abbruchstelle stehen.
3. **R-0455 – die fünf Artefakte.** Sie sind im Repository nicht auffindbar. (A) Pedi oder die
   Ursprungsquelle (`aufnahmepunkte-004.json` `$[68]`) nennt ihren Ablageort, dann wird nachgeführt.
   (B) Das oben abgeleitete Kriterium (a)–(c) ersetzt sie. (C) R-0455 bleibt offen bis zum
   Nachtest mit Menschen.

## Lauf 3 (Revision 9): U2 und U3 im Browser, Abgrenzung Option B

- **R-1507 / R-1609 gebaut:** `tests-smoke/erstnutzer-u2-u3-browser.spec.ts` misst die Hürden U2 und
  U3 am gebündelten Produkt (Playwright; Projekte chromium, firefox, webkit). Jeder Fall nennt seine
  Hürde im Namen:
  - **U2 · Bibliothek:** Das Suchfeld heißt „Bibliothek durchsuchen“, und zwar als zugänglicher Name
    und als sichtbarer Platzhalter. Die Ortszeile mit genau einem gewählten Bestand steht über dem
    Feld. Eine Suche ohne Treffer zeigt „Nichts gefunden.“ (nicht „Noch keine Einträge.“), und
    „Erfassen“ führt nach `/erfassen`.
  - **U2 · Meine Entwürfe:** Mit einem per API angelegten und danach gelöschten Entwurf zeigt
    `/entwuerfe` den Suchraumsatz „… nur gespeicherte Entwürfe … kein Wissen aus der Bibliothek“.
    Der Weg „Im Klarwerk-Wissen suchen“ nimmt den Tastaturfokus und führt per Enter zum Suchfeld der
    Bibliothek.
  - **U3 · Meine Aufgaben:** Die Kopfband-Punkte tragen kein `title` und kein `aria-describedby`. Der
    Weg Start → Zahnrad → „Weitere Bereiche“ → „Meine Aufgaben“ landet auf `/aufgaben` mit der
    Überschrift „Meine Aufgaben“. Die Erklärung steht erst nach Zahnrad → „Seitenhilfe“ da, mit
    Titel und Satz des Hilfekapitels `tasks`.
  - U1 bleibt bei `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` (unverändert). U4 ist laut
    `OFFEN.md:123` der Sammelauftrag mega90 und keine vierte Hürde.
  - Das Sollmanifest `tests/smoke/smoke-mengen-manifest.json` ist auf Version 11 nachgeführt:
    drei Fälle mehr je chromium, firefox und webkit, gesamt 201.
  - **Grenze:** Die Entwurfssuche im Arbeitsraum von `/erfassen` („Entwürfe anzeigen“) bleibt nur in
    jsdom gemessen (`tests/capture/basic-u2-suchraum-entwuerfe.test.tsx`). Im Browser steht
    stattdessen „Meine Entwürfe“ mit demselben Suchraumsatz. Ob ein Mensch die Hürde nicht mehr
    spürt, belegt erst ein Nachtest mit Menschen.
  - **Nicht ausgeführt:** Die Sonde ist hier nur über `playwright --list` erfasst und per `tsc`
    typgeprüft. Laut Auftrag laufen keine Browser auf dem Produktions-Mac. Ob sie grün läuft,
    zeigt erst `npm run smoke:ui:gate` im Linux-Tor.
- **Abgrenzung (Pedi, `entscheidung:622a6ae6`, Option B):** R-0455, R-0928, R-0939, R-1012 und
  R-1675 gehören nicht mehr zu diesem Auftrag, sondern zu
  `aufnahme:20260922:gesamt-erstnutzerfuehrung-quellen`. Ihre Zeilen unten bleiben als Abgleich aus
  Lauf 1 stehen und sind entsprechend markiert. Nichts davon wurde zurückgebaut.
- **„.503 prüfen“ (P-EINSTIEG-HILFE):** `1.0.0-beta.1.503` (`b0315de8`, JOB 3954) ist Vorfahre
  dieses Stands. Damit sind SEITENHILFE-LUECKEN (zuletzt JOB 3980, `.500`) und DEMO-ZUGANG-START
  (JOB 3935 D1) enthalten. Ihre Tests wurden in diesem Lauf nicht erneut ausgeführt.
- **Erledigter Widerspruch:** Der frühere Quellenwiderspruch „drei Hürden U1–U4“ ist in Revision 9
  aufgelöst: R-1609 nennt jetzt U1–U3 und U4 als Sammelauftrag.

Die Auftragsquelle selbst (Originalwortlaut, Entscheidungen, Erledigungsbelege) liegt **nicht** in
diesem Arbeitsbaum. Keine der Kennungen R-0455 … R-1675, `P-EINSTIEG-HILFE`, `package:start` kommt
im Repository vor. Die Zuordnung unten stützt sich deshalb auf JOB-/AUFTRAG-Vermerke im Code, auf
Commits und auf `OFFEN.md` / `docs/qm/claude-after-report.md`. Wo keine Zuordnung belegbar ist, steht
das ausdrücklich da.

## Was Lauf 1 gebaut hat (nur R-0474)

Die Bibliothek erfüllt R-0474 schon (s. u.). Zwei Suchen hatten aber keinen nächsten Schritt:

| Stelle | Vorher | Jetzt |
|---|---|---|
| „Gehe zu …“ (`shell/CommandPalette.tsx`) | „Kein Treffer.“ | „Kein Treffer.“ plus Knopf „„…“ im Wissen fragen“ → `/fragen?q=…`. Enter im Feld macht dasselbe. Angeboten wird der Knopf nur, wenn „Fragen“ unter den Zielen der Rolle steht; sonst steht dort „Versuch einen anderen Seitennamen.“ |
| Hilfesuche (`pages/Help.tsx`) | „Keine Hilfe zu diesem Stichwort gefunden.“ | Derselbe Satz plus Link „„…“ als Frage an das Wissen stellen“ → `/fragen?q=…`. Der Link erscheint nur bei einer Rolle aus einer Sitzung und wenn `routePathAllows("/fragen", rolle)` gilt; sonst steht dort „Versuch ein kürzeres oder anderes Stichwort.“ |

- Die neuen Texte (DE/EN/NL) liegen im Textmodul `apps/web/src/texte/erstnutzer.ts` (Präfix
  `erstnutzer.`). Vorhandene Texte sind nicht geändert; `werte-vorher.json` bleibt unberührt.
- Test: `nulltreffer-naechster-schritt.test.tsx` (N1a–N1d Palette mit Klick, Enter und Gegenprobe
  mit Treffer; N2 Hilfe mit Sitzungsrolle; N3 Hilfe ohne Rollenquelle; N4 drei Sprachen).
- **Runde 2 (Ben B1): die Frage kommt im Fragefeld an, nicht nur in der Adresse.** War `/fragen`
  schon offen (etwa `/fragen?q=Alte Frage`), wechselte nur die Adresse, und im Feld blieb die alte
  Frage stehen. Der Router montiert `Ask` bei einem reinen Adresswechsel nicht neu, und `Ask` las
  `?q=` nur als Anfangswert. Jetzt übernimmt `pages/Ask.tsx` bei jeder Navigation mit `?q=` die
  Frage ins Feld (gebunden an `location.key`). Weiterhin wird nur vorbefüllt, nichts automatisch
  gefragt (SCRUM-272); ohne `?q=` bleibt das Feld unverändert. Das gilt auch für jeden anderen Weg,
  der `/fragen?q=` auf die offene Seite schickt.
  Test: `uebergabe-ins-fragefeld.test.tsx` misst am echten Fragefeld von `Ask`:
  - Ü1: Ausgang `/start`.
  - Ü2 (Klick) und Ü3 (Enter): Ausgang `/fragen?q=Alte Frage`.
  - Ü4: eigene Eingabe; Gegenprobe ohne Übergabe.
  - Ü5: Weg aus der Hilfe.
  - Ü6: keine Anfrage an den Fragendienst.

  Gegenprobe mit dem `Ask.tsx` von `HEAD`: Ü2, Ü3 und Ü4 rot, Ü1 und Ü5 grün (frische Montage).
- **Runde 3 (Ben B3): Antwortlink mit `ask=1` auf der schon offenen Seite sendet die neue Frage.**
  Nach dem Fix aus B1 kam `/fragen?q=Neu&ask=1` auf der offenen Seite in einem Durchlauf an, in dem
  die Adresse schon neu, der Feldzustand aber noch alt war. Der Auto-Ask (ein Schuss je Montage,
  gelesen aus dem Feld) verschoss sich dabei mit der ALTEN Frage. Jetzt lesen Vorbefüllung und
  Auto-Ask dieselbe Quelle (`readAskQuestion(params)`). Der Schuss gilt je Navigation
  (`location.key`) und wartet, solange eine Anfrage läuft. Ohne `ask=1` wird weiterhin nichts
  gesendet; ohne nutzbares Modell ebenfalls nicht (unverändert über `submitAsk`).
  Tests A1–A4 in `uebergabe-ins-fragefeld.test.tsx`:
  - A1: Wechsel auf der offenen Seite sendet genau die neue Frage.
  - A2: frische Montage einmal, danach der Wechsel zusätzlich genau einmal.
  - A3: Gegenprobe ohne `ask=1`, nichts gesendet.
  - A4: kein zweiter Schuss beim Weitertippen.

  Gegenprobe mit dem `Ask.tsx` der Runde 2: A1, A2 und A4 rot mit `expected [ 'Alte Frage' ] to deeply
  equal [ 'Neue Frage' ]`, also Bens Protokoll.
  Eine Änderung gegenüber früher: Ein Antwortlink mit `ask=1` auf die schon offene Seite sendet jetzt
  (bisher nur bei frischer Montage). Das ist genau Bens Soll.
- Beide neuen Testdateien stehen im Klara-Regressionsinventar. Grund: Achse `palette`, derselbe
  Fall wie `navigationsnamen/palette-*`.

## Abgleich je Anliegen

Legende: **geliefert** = im Code vorhanden und getestet · **abgelöst** = früher geliefert, durch eine
jüngere Nutzerentscheidung bewusst umgebaut (bleibt wirksam) · **offen** = nicht gebaut ·
**ungeklärt** = kein Beleg im Repository.

| Anliegen | Stand | Beleg / Abgrenzung |
|---|---|---|
| *(seit Revision 9 im Folgeauftrag `…-quellen`, Option B)* R-0455 Erstbesucher findet ohne Erklärung (Inventar, Anschlusspaket, Rotvertrag, Klarheitsvertrag, Ownerpaket) | **ungeklärt** | Keines der fünf Artefakte ist im Repository auffindbar. Inhaltlich nahe: die Funktionsinventare `tests/design/h1…h6-funktionsinventar.test.ts` und die Wächter `zielbild-*-kein-erklaertext.test.ts`. Ob sie das genannte Ownerpaket sind, lässt sich hier nicht belegen. |
| R-0474 Hilfreicher Satz statt leerer Fläche | **geliefert** (Bibliothek, Fragen) · **in diesem Lauf ergänzt** (Palette, Hilfe; Übergabe ins Fragefeld Runde 2) | Bibliothek: `BibliothekListe.tsx:410-416` „Nichts gefunden.“ plus Knopf „Erfassen“ (JOB 3063 H4 kürzt bewusst auf einen Satz, JOB 3788). Tests: `tests/capture/basic-u2-suchraum-bibliothek.test.tsx`, `tests/library/mega59-nullzustand-mounted.test.tsx`, `tests/bibliothek-leer-oder-eingegrenzt/`. Fragen: Lückenkarte mit nächstem Schritt (`Ask.tsx`, `lib/askAnswerContract.ts`), Test `tests/app/job3064-fragen-zustaende-mounted.test.tsx`. Palette und Hilfe: siehe oben. Klara-Hilfesuche (`klara.noResults`) ist unverändert und nicht nachgemessen. |
| R-0917 Zwecksatz oben auf der Startseite, bejahend | **abgelöst** | Geliefert ganz oben auf Start mit AUFTRAG-mega38 BLOCK G1 (Pedi 27.07., Commit `5150cd5a`, 28.07.; `start.purpose`, DE/EN/NL). Seit JOB 3064 H5 (Pedi 04.09.: „Text über Text … Absolut unmöglich.“, Commit `72724284`) steht er im „…“-Menü → „Über KLARWERK“ (`components/start/StartPanel.tsx:95-105`), nicht mehr im Sichtfeld. Wächter: `tests/design/zielbild-h5-kein-erklaertext.test.ts` (≤ 40 Zeichen Erklärtext) und `tests/design/h5-funktionsinventar.test.ts` (I2-ueber). **Quellenwiderspruch:** „ganz oben auf der Startseite“ gegen die jüngere H5-Entscheidung. Nicht zurückgebaut. |
| *(seit Revision 9 im Folgeauftrag `…-quellen`, Option B)* R-0928 / R-1675 „Missions“-Einstiegsseiten (Erfassen, Validieren, Fragen, Bibliothek) → volle Konsole | **Missions-Block: geliefert, dann abgelöst** · **eigene Einstiegsseiten: nie gebaut, Stand offen** | Runde 2 (Ben B2); Runde 1 hatte nur den älteren Stand „offen / optional“ (`docs/qm/claude-after-report.md:923–931`) gelesen. Drei Belege, zeitlich geordnet: **(1) Geliefert am 26.06.2026** (`docs/qm/claude-after-report.md:1863–1883`, Commit `9be7466b` „add role-based mission entrypoints“). Pedi hatte Option A freigegeben, einen „minimalen echten Missions-Block“. Geliefert wurden `lib/missions.ts` `missionsForRole(role, stufe2)` und auf Start eine rollenbewusste Sektion „Missionen“ mit 2–4 Kacheln als `<Link>` auf `/erfassen`, `/validierung`, `/risiko`, `/fragen`, `/bibliothek`, dazu `tests/app/missions.test.ts` (5 Fälle). Ausdrücklich „keine neuen Routen, keine Platzhalterseiten“: es waren Kacheln auf der Startseite, keine eigenen thematischen Einstiegsseiten. **(2) Von der Startseite genommen** durch AUFTRAG-mega38 BLOCK G2 (Pedi 27.07.): „Vier Empfehlungen sind keine Empfehlung … eine zweite Navigation in Kachelform“. **(3) Code gelöscht** in mega39 BLOCK F: `lib/missions.ts` und `tests/app/missions.test.ts` entfernt, beides in Commit `5150cd5a` (Sammellieferung mega26–mega42, 28.07.). Die Begründung steht im entfernten Kommentar dieses Commits in `pages/Start.tsx`. Danach hat JOB 3064 H5 die Startseite weiter auf Frage, Feld, „FÜR DICH“ und „ZULETZT“ reduziert. **Heute:** kein Missions-Code und keine Einstiegsroute (`routes.tsx`). `/erfassen/vordertuer` (JOB 3062 H3) zeigt dieselbe Fläche wie `/erfassen` und ist keine Einstiegsseite. **Abgrenzung:** Die Kachel-Form (R-1675 „führen in Vollfunktion“) war geliefert und ist durch mega38 G2 bewusst abgelöst; diese Entscheidung bleibt wirksam. Kurze thematische Einstiegsseiten im Sinn von R-0928 hat es nie gegeben. Einen Beleg, dass sie verworfen wurden, gibt es im Repository nicht, ebenso keinen Auftrag, sie zu bauen. Ob sie noch gewollt sind, ist ungeklärt; daraus folgt hier kein Neubauauftrag. **Quellenwiderspruch:** R-1675 und die Quelle der Runde 1 führen die Missionen als „optional / offen“, obwohl sie am 26.06. geliefert und am 27./28.07. zurückgenommen wurden. |
| *(seit Revision 9 im Folgeauftrag `…-quellen`, Option B)* R-0939 Geschlossene Schleife erfassen → prüfen → finden, erhoben und priorisiert | **teilweise geliefert** · Priorisierung **ungeklärt** | Übergänge im Code: Start-Feld → `/fragen?q=`; Wissenslücke → Erfassen; Bibliothek-Nulltreffer → Erfassen; Einreichen → Prüfen (U1, `KnopfUnterschied.tsx`); Prüfaufgaben in „FÜR DICH“. Neu in diesem Lauf: Palette/Hilfe-Nulltreffer → Fragen, seit Runde 2 auch bei schon geöffneter Fragen-Seite bis ins Fragefeld (Ben B1). Eine Dokumentation, in der der Weg „erhoben und in Prioritäten geordnet“ ist, ist im Repository nicht auffindbar. |
| R-0947 Wissenskreis auf der Startseite mit echten Links | **abgelöst** | `lib/knowledgeCycle.ts:22-49` (SCRUM-261) hat vier Schritte mit echten, rollengeprüften Zielen. Seit H5 im „…“-Menü → „Wissenskreis“ (`StartPanel.tsx:110-146`). Tests: `tests/app/knowledge-cycle.test.ts`, `tests/design/h5-funktionsinventar.test.ts` (I2-kreis). Quellenwiderspruch zu H5 wie bei R-0917. |
| R-0984 Rollengruß, Hauptknopf, „Heute zu tun“, 2–3 Kennzahlen | **abgelöst** | Früher geliefert (FE-FND-09-Vermerk: „rollenabhängiger CTA … + KPIs + Heute-zu-tun“). Der zweite Kennzahlenblock fiel mit AUFTRAG-mega38 BLOCK G2 (`5150cd5a`). Heute steht „FÜR DICH“, aus echten Arbeitssignalen nach Dringlichkeit geordnet (`components/start/forYou.ts`, Test `tests/app/job3064-zustandsmodell-mounted.test.tsx`). Kennzahlen: „…“-Menü → „Wissenskapital“. Kein Gruß: H5 hat „Guten Tag, {{name}}.“ gestrichen, der Name steht in der Seitenleiste (`i18n.ts`, Vermerk JOB 3015 D5). Kein Hauptknopf je Rolle (`lib/workCenter.ts` `primaryWorkItem` ist vorhanden, Start nutzt es nicht). Quellenwiderspruch zu H5. |
| *(seit Revision 9 im Folgeauftrag `…-quellen`, Option B)* R-1012 Einstiegsfläche mit umfassendem Bild, was das System kann | **offen** (Teile vorhanden) | Herkunft: `OFFEN.md` U4 (SCRUM-474, Nataschas zweite Bedingung). Vorhanden sind „Über KLARWERK“ (zwei Sätze), der Wissenskreis, die rollenbezogene Einstiegsführung auf `/hilfe` (`lib/pilotChecklist.ts`, JOB 4022) und das Fragen-Tutorial (FE-003, nur `/fragen`, Pedi-Abnahme offen). Eine einzelne Fähigkeitsübersicht gibt es nicht. Auf Start ist eine Tour ausdrücklich nicht gebaut (`Start.tsx`, Vermerk JOB 3669). Braucht eine Entscheidung zu Ort und Form wegen H5. |
| R-1041 Konsole: Frage, breites Feld mit Tastenkürzel, drei Karten (Suchen / Prüfen mit Zähler / Hinzufügen), Zusicherung und Version unten | **abgelöst** | Gebaut in JOB 3015 D4/D5 (`c11f3684`, 03.09.). JOB 3064 D11 (`72724284`, 05.09.) hat die Karten zurückgebaut. Heute: „Was möchtest du wissen?“ und das 640-px-Feld (`Start.tsx`). Kartenziele liegen im Kopfband, der offene Zähler ist die Prüf-Plakette (`shell/KopfbandPunkte.tsx`). Die Zusicherung steht unter „Über KLARWERK“, die Version im Zahnradmenü (`shell/ZahnradMenue.tsx`). Tastenkürzel: ⌘K/Strg+K öffnet „Gehe zu …“, das Startfeld selbst hat keins. |
| R-1590 Zielbild „KonsoleStart“ — „noch nicht gebaut“ | **veraltete Aussage** | Die Aussage ist durch `c11f3684` überholt: gebaut, danach durch `72724284` (H5, Zielbild `Main.dc.html`) abgelöst. Das Zielbild `design/klarwerk/*.dc.html` liegt nicht in diesem Arbeitsbaum. |
| R-1507 / R-1609 Hürden U1–U3 einzeln am gebauten Bildschirm messen und schließen | **geliefert (jsdom)** · Browser-Fälle **seit Lauf 3 vorhanden** (U1 `demo-ux-v1-capture-frontdoor.spec.ts`, U2/U3 `erstnutzer-u2-u3-browser.spec.ts`), Lauf im Linux-Tor **ausstehend** | Stand Lauf 1: U1: JOB 3029, `tests/erstnutzer-u1/knopf-unterschied.test.tsx`. U2: `tests/capture/basic-u2-suchraum*.test.ts(x)`, `tests/app/u2-suchraum-vertrag.test.ts`. U3: JOB 3028/3060, `tests/bedienbarkeit/u3-*`. U4 (Ladezeit, JOB 3030): `tests/erstladezeit/eintritt-ohne-seiten.test.ts`. U1–U3 laufen in jsdom. Es gibt keine Chromium-Messung am gebauten Bildschirm und keinen zusammenhängenden Erstnutzerlauf. **Quellenwiderspruch:** R-1609 nennt „drei Hürden U1–U4“, das sind vier Kennungen. In `OFFEN.md` ist U4 der Sammelauftrag mega90. JOB 3007 selbst hat keine Dateien im Repository. |
| R-1515 / R-1528 Reste früherer Prüfungen (kein eigener Gesamtlauf, Screenreader, nativer Tooltip) | **nicht nachgeholt** | Laut Auftrag bestellt die Nennung keinen Prüflauf. `help.firststart.title/body` sind in DE/EN/NL vorhanden (`i18n.ts`) und werden nur im Hilfekapitel `firststart` genutzt (`lib/helpTopics.ts`). Tests: `tests/analytics/help-topics.test.ts`, `tests/bedienbarkeit/u3-menuepunkt-erklaert-sich.test.tsx` (U3-4). Reale Screenreader-Ausgabe und nativer Tooltip bleiben ungeprüft; dafür fehlt hier ein Prüfmittel. |
| P-EINSTIEG-HILFE / package:start (Erfassen, Entwürfe, Bibliothek finden; Hilfe vom Import zum geprüften Wissen; DE/EN/NL; Fehlerhilfe mit nächstem Schritt) | **geliefert** (mit Rest) | Kopfband mit Erfassen/Bibliothek (`shell/Kopfband.tsx`). „Meine Entwürfe“ auf Start (JOB 3266 D1, `tests/d1-meine-entwuerfe/`) und `/entwuerfe` (JOB 3503). Seitenhilfe über das Zahnrad (`tests/seitenhilfe-luecken/erster-weg-hat-seitenhilfe.test.tsx`, drei Sprachen; `tests/seitenhilfe-navkapitel/`). Hilfe-Einstiegsführung Start → Bibliothek → Erfassen → Validieren → Nutzen (`lib/pilotChecklist.ts`) und Importkapitel (`tests/review26-hilfe-import/`, `tests/import-hilfe-widerspruch/`). Fehlerhilfe mit nächstem Schritt: `tests/ki-fehlerhilfe/` (JOB 3420). DEMO-ZUGANG-START: `tests/demo-zugang-start/`. Rest: Die ISO-Hilfekapitel gibt es nur in DE/EN, NL fällt auf DE zurück (`Help.tsx`). Der Vermerk „.503 prüfen“ wurde hier nicht nachgeprüft. |

## Nicht geprüft in diesem Lauf

- Kein eigener `tools/check`, kein UI-Smoke, keine Chromium-Tests. Maßgeblich ist das Linux-Tor
  nach dem Lauf.
- Nicht ausgeführt: `tests/design/job3337-palette-flaches-fenster-chromium.test.ts` (Chromium).
  Nach Lesen tippt dieser Test nichts ein und erreicht den Nulltreffer daher nicht. Eine Wirkung
  wird nicht erwartet, ist aber nicht gemessen.
