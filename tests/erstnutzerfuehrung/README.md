# Aufnahme 20260922 · Gesamt-Erstnutzerführung — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-erstnutzerfuehrung` (Aufgabenrevision 2, Lauf 1, Runden 1–2),
Stand der Fassung **1.0.0-beta.1.632** (Basis `8f0ec01c`), abgeglichen am 29.09.2026.

Die Auftragsquelle selbst (Originalwortlaut, Entscheidungen, Erledigungsbelege) liegt **nicht** in
diesem Arbeitsbaum. Keine der Kennungen R-0455 … R-1675, `P-EINSTIEG-HILFE`, `package:start` kommt
im Repository vor. Die Zuordnung unten stützt sich deshalb auf JOB-/AUFTRAG-Vermerke im Code, auf
Commits und auf `OFFEN.md` / `docs/qm/claude-after-report.md`. Wo keine Zuordnung belegbar ist, steht
das ausdrücklich da.

## Was dieser Lauf gebaut hat (nur R-0474)

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
- Beide neuen Testdateien stehen im Klara-Regressionsinventar. Grund: Achse `palette`, derselbe
  Fall wie `navigationsnamen/palette-*`.

## Abgleich je Anliegen

Legende: **geliefert** = im Code vorhanden und getestet · **abgelöst** = früher geliefert, durch eine
jüngere Nutzerentscheidung bewusst umgebaut (bleibt wirksam) · **offen** = nicht gebaut ·
**ungeklärt** = kein Beleg im Repository.

| Anliegen | Stand | Beleg / Abgrenzung |
|---|---|---|
| R-0455 Erstbesucher findet ohne Erklärung (Inventar, Anschlusspaket, Rotvertrag, Klarheitsvertrag, Ownerpaket) | **ungeklärt** | Keines der fünf Artefakte ist im Repository auffindbar. Inhaltlich nahe: die Funktionsinventare `tests/design/h1…h6-funktionsinventar.test.ts` und die Wächter `zielbild-*-kein-erklaertext.test.ts`. Ob sie das genannte Ownerpaket sind, lässt sich hier nicht belegen. |
| R-0474 Hilfreicher Satz statt leerer Fläche | **geliefert** (Bibliothek, Fragen) · **in diesem Lauf ergänzt** (Palette, Hilfe; Übergabe ins Fragefeld Runde 2) | Bibliothek: `BibliothekListe.tsx:410-416` „Nichts gefunden.“ plus Knopf „Erfassen“ (JOB 3063 H4 kürzt bewusst auf einen Satz, JOB 3788). Tests: `tests/capture/basic-u2-suchraum-bibliothek.test.tsx`, `tests/library/mega59-nullzustand-mounted.test.tsx`, `tests/bibliothek-leer-oder-eingegrenzt/`. Fragen: Lückenkarte mit nächstem Schritt (`Ask.tsx`, `lib/askAnswerContract.ts`), Test `tests/app/job3064-fragen-zustaende-mounted.test.tsx`. Palette und Hilfe: siehe oben. Klara-Hilfesuche (`klara.noResults`) ist unverändert und nicht nachgemessen. |
| R-0917 Zwecksatz oben auf der Startseite, bejahend | **abgelöst** | Geliefert ganz oben auf Start mit AUFTRAG-mega38 BLOCK G1 (Pedi 27.07., Commit `5150cd5a`, 28.07.; `start.purpose`, DE/EN/NL). Seit JOB 3064 H5 (Pedi 04.09.: „Text über Text … Absolut unmöglich.“, Commit `72724284`) steht er im „…“-Menü → „Über KLARWERK“ (`components/start/StartPanel.tsx:95-105`), nicht mehr im Sichtfeld. Wächter: `tests/design/zielbild-h5-kein-erklaertext.test.ts` (≤ 40 Zeichen Erklärtext) und `tests/design/h5-funktionsinventar.test.ts` (I2-ueber). **Quellenwiderspruch:** „ganz oben auf der Startseite“ gegen die jüngere H5-Entscheidung. Nicht zurückgebaut. |
| R-0928 / R-1675 „Missions“-Einstiegsseiten (Erfassen, Validieren, Fragen, Bibliothek) → volle Konsole | **Missions-Block: geliefert, dann abgelöst** · **eigene Einstiegsseiten: nie gebaut, Stand offen** | Runde 2 (Ben B2); Runde 1 hatte nur den älteren Stand „offen / optional“ (`docs/qm/claude-after-report.md:923–931`) gelesen. Drei Belege, zeitlich geordnet: **(1) Geliefert am 26.06.2026** (`docs/qm/claude-after-report.md:1863–1883`, Commit `9be7466b` „add role-based mission entrypoints“). Pedi hatte Option A freigegeben, einen „minimalen echten Missions-Block“. Geliefert wurden `lib/missions.ts` `missionsForRole(role, stufe2)` und auf Start eine rollenbewusste Sektion „Missionen“ mit 2–4 Kacheln als `<Link>` auf `/erfassen`, `/validierung`, `/risiko`, `/fragen`, `/bibliothek`, dazu `tests/app/missions.test.ts` (5 Fälle). Ausdrücklich „keine neuen Routen, keine Platzhalterseiten“: es waren Kacheln auf der Startseite, keine eigenen thematischen Einstiegsseiten. **(2) Von der Startseite genommen** durch AUFTRAG-mega38 BLOCK G2 (Pedi 27.07.): „Vier Empfehlungen sind keine Empfehlung … eine zweite Navigation in Kachelform“. **(3) Code gelöscht** in mega39 BLOCK F: `lib/missions.ts` und `tests/app/missions.test.ts` entfernt, beides in Commit `5150cd5a` (Sammellieferung mega26–mega42, 28.07.). Die Begründung steht im entfernten Kommentar dieses Commits in `pages/Start.tsx`. Danach hat JOB 3064 H5 die Startseite weiter auf Frage, Feld, „FÜR DICH“ und „ZULETZT“ reduziert. **Heute:** kein Missions-Code und keine Einstiegsroute (`routes.tsx`). `/erfassen/vordertuer` (JOB 3062 H3) zeigt dieselbe Fläche wie `/erfassen` und ist keine Einstiegsseite. **Abgrenzung:** Die Kachel-Form (R-1675 „führen in Vollfunktion“) war geliefert und ist durch mega38 G2 bewusst abgelöst; diese Entscheidung bleibt wirksam. Kurze thematische Einstiegsseiten im Sinn von R-0928 hat es nie gegeben. Einen Beleg, dass sie verworfen wurden, gibt es im Repository nicht, ebenso keinen Auftrag, sie zu bauen. Ob sie noch gewollt sind, ist ungeklärt; daraus folgt hier kein Neubauauftrag. **Quellenwiderspruch:** R-1675 und die Quelle der Runde 1 führen die Missionen als „optional / offen“, obwohl sie am 26.06. geliefert und am 27./28.07. zurückgenommen wurden. |
| R-0939 Geschlossene Schleife erfassen → prüfen → finden, erhoben und priorisiert | **teilweise geliefert** · Priorisierung **ungeklärt** | Übergänge im Code: Start-Feld → `/fragen?q=`; Wissenslücke → Erfassen; Bibliothek-Nulltreffer → Erfassen; Einreichen → Prüfen (U1, `KnopfUnterschied.tsx`); Prüfaufgaben in „FÜR DICH“. Neu in diesem Lauf: Palette/Hilfe-Nulltreffer → Fragen, seit Runde 2 auch bei schon geöffneter Fragen-Seite bis ins Fragefeld (Ben B1). Eine Dokumentation, in der der Weg „erhoben und in Prioritäten geordnet“ ist, ist im Repository nicht auffindbar. |
| R-0947 Wissenskreis auf der Startseite mit echten Links | **abgelöst** | `lib/knowledgeCycle.ts:22-49` (SCRUM-261) hat vier Schritte mit echten, rollengeprüften Zielen. Seit H5 im „…“-Menü → „Wissenskreis“ (`StartPanel.tsx:110-146`). Tests: `tests/app/knowledge-cycle.test.ts`, `tests/design/h5-funktionsinventar.test.ts` (I2-kreis). Quellenwiderspruch zu H5 wie bei R-0917. |
| R-0984 Rollengruß, Hauptknopf, „Heute zu tun“, 2–3 Kennzahlen | **abgelöst** | Früher geliefert (FE-FND-09-Vermerk: „rollenabhängiger CTA … + KPIs + Heute-zu-tun“). Der zweite Kennzahlenblock fiel mit AUFTRAG-mega38 BLOCK G2 (`5150cd5a`). Heute steht „FÜR DICH“, aus echten Arbeitssignalen nach Dringlichkeit geordnet (`components/start/forYou.ts`, Test `tests/app/job3064-zustandsmodell-mounted.test.tsx`). Kennzahlen: „…“-Menü → „Wissenskapital“. Kein Gruß: H5 hat „Guten Tag, {{name}}.“ gestrichen, der Name steht in der Seitenleiste (`i18n.ts`, Vermerk JOB 3015 D5). Kein Hauptknopf je Rolle (`lib/workCenter.ts` `primaryWorkItem` ist vorhanden, Start nutzt es nicht). Quellenwiderspruch zu H5. |
| R-1012 Einstiegsfläche mit umfassendem Bild, was das System kann | **offen** (Teile vorhanden) | Herkunft: `OFFEN.md` U4 (SCRUM-474, Nataschas zweite Bedingung). Vorhanden sind „Über KLARWERK“ (zwei Sätze), der Wissenskreis, die rollenbezogene Einstiegsführung auf `/hilfe` (`lib/pilotChecklist.ts`, JOB 4022) und das Fragen-Tutorial (FE-003, nur `/fragen`, Pedi-Abnahme offen). Eine einzelne Fähigkeitsübersicht gibt es nicht. Auf Start ist eine Tour ausdrücklich nicht gebaut (`Start.tsx`, Vermerk JOB 3669). Braucht eine Entscheidung zu Ort und Form wegen H5. |
| R-1041 Konsole: Frage, breites Feld mit Tastenkürzel, drei Karten (Suchen / Prüfen mit Zähler / Hinzufügen), Zusicherung und Version unten | **abgelöst** | Gebaut in JOB 3015 D4/D5 (`c11f3684`, 03.09.). JOB 3064 D11 (`72724284`, 05.09.) hat die Karten zurückgebaut. Heute: „Was möchtest du wissen?“ und das 640-px-Feld (`Start.tsx`). Kartenziele liegen im Kopfband, der offene Zähler ist die Prüf-Plakette (`shell/KopfbandPunkte.tsx`). Die Zusicherung steht unter „Über KLARWERK“, die Version im Zahnradmenü (`shell/ZahnradMenue.tsx`). Tastenkürzel: ⌘K/Strg+K öffnet „Gehe zu …“, das Startfeld selbst hat keins. |
| R-1590 Zielbild „KonsoleStart“ — „noch nicht gebaut“ | **veraltete Aussage** | Die Aussage ist durch `c11f3684` überholt: gebaut, danach durch `72724284` (H5, Zielbild `Main.dc.html`) abgelöst. Das Zielbild `design/klarwerk/*.dc.html` liegt nicht in diesem Arbeitsbaum. |
| R-1507 / R-1609 Hürden U1–U3 (bzw. „drei Hürden U1–U4“) einzeln am gebauten Bildschirm messen und schließen | **geliefert (jsdom)** · Browser-Messung **offen** | U1: JOB 3029, `tests/erstnutzer-u1/knopf-unterschied.test.tsx`. U2: `tests/capture/basic-u2-suchraum*.test.ts(x)`, `tests/app/u2-suchraum-vertrag.test.ts`. U3: JOB 3028/3060, `tests/bedienbarkeit/u3-*`. U4 (Ladezeit, JOB 3030): `tests/erstladezeit/eintritt-ohne-seiten.test.ts`. U1–U3 laufen in jsdom. Es gibt keine Chromium-Messung am gebauten Bildschirm und keinen zusammenhängenden Erstnutzerlauf. **Quellenwiderspruch:** R-1609 nennt „drei Hürden U1–U4“, das sind vier Kennungen. In `OFFEN.md` ist U4 der Sammelauftrag mega90. JOB 3007 selbst hat keine Dateien im Repository. |
| R-1515 / R-1528 Reste früherer Prüfungen (kein eigener Gesamtlauf, Screenreader, nativer Tooltip) | **nicht nachgeholt** | Laut Auftrag bestellt die Nennung keinen Prüflauf. `help.firststart.title/body` sind in DE/EN/NL vorhanden (`i18n.ts`) und werden nur im Hilfekapitel `firststart` genutzt (`lib/helpTopics.ts`). Tests: `tests/analytics/help-topics.test.ts`, `tests/bedienbarkeit/u3-menuepunkt-erklaert-sich.test.tsx` (U3-4). Reale Screenreader-Ausgabe und nativer Tooltip bleiben ungeprüft; dafür fehlt hier ein Prüfmittel. |
| P-EINSTIEG-HILFE / package:start (Erfassen, Entwürfe, Bibliothek finden; Hilfe vom Import zum geprüften Wissen; DE/EN/NL; Fehlerhilfe mit nächstem Schritt) | **geliefert** (mit Rest) | Kopfband mit Erfassen/Bibliothek (`shell/Kopfband.tsx`). „Meine Entwürfe“ auf Start (JOB 3266 D1, `tests/d1-meine-entwuerfe/`) und `/entwuerfe` (JOB 3503). Seitenhilfe über das Zahnrad (`tests/seitenhilfe-luecken/erster-weg-hat-seitenhilfe.test.tsx`, drei Sprachen; `tests/seitenhilfe-navkapitel/`). Hilfe-Einstiegsführung Start → Bibliothek → Erfassen → Validieren → Nutzen (`lib/pilotChecklist.ts`) und Importkapitel (`tests/review26-hilfe-import/`, `tests/import-hilfe-widerspruch/`). Fehlerhilfe mit nächstem Schritt: `tests/ki-fehlerhilfe/` (JOB 3420). DEMO-ZUGANG-START: `tests/demo-zugang-start/`. Rest: Die ISO-Hilfekapitel gibt es nur in DE/EN, NL fällt auf DE zurück (`Help.tsx`). Der Vermerk „.503 prüfen“ wurde hier nicht nachgeprüft. |

## Nicht geprüft in diesem Lauf

- Kein eigener `tools/check`, kein UI-Smoke, keine Chromium-Tests. Maßgeblich ist das Linux-Tor
  nach dem Lauf.
- Nicht ausgeführt: `tests/design/job3337-palette-flaches-fenster-chromium.test.ts` (Chromium).
  Nach Lesen tippt dieser Test nichts ein und erreicht den Nulltreffer daher nicht. Eine Wirkung
  wird nicht erwartet, ist aber nicht gemessen.
