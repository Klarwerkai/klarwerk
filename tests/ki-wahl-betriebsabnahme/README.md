# KI-WAHL-Betriebsabnahme — Stand je Originalpunkt

Auftrag `aufnahme:20260922:ki-wahl-betriebsabnahme` (Revision 3), Basis `2b1131ad` (1.0.0-beta.1.713).
Quelle der Punkte: `QUELLEN.json` → `original_points` (Auftragsquelle `b292a21b…`, Stand 22.09.2026).

Diese Datei hält fest, was **dieser Lauf** geändert und mit Tests unterlegt hat, was aus früheren
Lieferungen **übernommen** wird (mit Fassung laut Quelle, hier nicht erneut geprüft) und was **offen**
bleibt — mit der konkreten Voraussetzung. Sie ist keine Erfüllungsbehauptung: welche Tests auf diesem
Bau wirklich grün sind, steht im Prüfbericht des Adapters, nicht hier.

## Was dieser Lauf geändert hat

| Änderung | Datei | Kriterium |
|---|---|---|
| `normalizeLocale` der KI-Route kennt jetzt `nl` (vorher `nl` → `de`, dieselbe Lücke, die JOB 3980 in `help-routes.ts` geschlossen hatte); Body-Typen `locale` auf `ReasonerLocale` | `services/app/src/routes/reasoner-routes.ts` | K3 |
| Niederländischer Satz der Vertraulichkeitssperre (409), den der Code-Kommentar für den Fall „Route öffnet sich für nl“ ausdrücklich verlangte | `services/app/src/routes/reasoner-routes.ts` | K3, K6 |
| B2 erwartet für `nl` jetzt den niederländischen statt des deutschen Satzes | `services/app/src/routes/reasoner-routes.test.ts` | K3 |
| nl-Kette getrennt gemessen: `nl-NL` → `nl` (Client) → Reasoner-Argument → niederländische Ausgaberegel im Rumpf an `/chat/completions`; Antwort nur als Durchreichung | `nl-erreicht-das-modell.test.ts` | K3 |
| Nacharbeit 3 · echter Prozesswechsel (W7): Klarwerk als eigener OS-Prozess gegen dieselbe PostgreSQL; Anbieterkanten im Prozess über ein Vorlademodul auf einen lokalen Ersatz umgeleitet | `en-wahl-pg-neustart.integration.test.ts`, `anbieterkante-vorladen.ts` | K1, K8 |
| Nacharbeit 3 · N-0087: `Reasoner.interview` liefert `fallbackReason`; Erfassen → Interview zeigt Grund und nächsten Schritt (DE/EN/NL) | `services/reasoner/src/service.ts`, `services/reasoner/src/types.ts`, `apps/web/src/api/types.ts`, `apps/web/src/lib/interviewFlow.ts`, `apps/web/src/pages/Capture.tsx`, Wörterbücher; Test `interview-ersatzgrund.test.ts` | K7, K9 |
| Nacharbeit 3 · N-0070: Zeile „Führt aus: …“ in der KI-Palette der Editorleiste | `apps/web/src/components/AiAusfuehrerZeile.tsx`, `apps/web/src/lib/aiAusfuehrer.ts`, `apps/web/src/app/RoleContext.tsx` (`useRoleOptional`), `apps/web/src/components/erfassen/Blatt.tsx`, Wörterbücher; Test `ausfuehrer-vor-dem-klick.test.tsx` | K5, K9 |
| EN-Fläche in Chromium wählt Claude per Tastatur; Zeile `reasoner_policy` direkt in PostgreSQL gelesen; Probe und echte Aufgabe gehen nur an Anthropic; Neuaufbau von Pool/Diensten/Reasoner/Server gegen dieselbe DB → Quelle `persisted`, Anzeige und Empfänger unverändert; Gegenprobe „auto“ → OpenAI | `en-wahl-pg-neustart.integration.test.ts` | K1, K5, K8 |

## Stand je Originalpunkt

Legende: **geliefert (Quelle)** = laut datierter Quelle geliefert, in diesem Lauf nicht erneut
geprüft · **dieser Lauf** = hier geändert/gemessen · **offen** = braucht echte Bedienung,
Produktivmittel oder eine Entscheidung.

| Punkt | Inhalt (kurz) | Stand | Beleg / verbleibende Entscheidung |
|---|---|---|---|
| R-0684 | Admin bestimmt global und je Aufgabe Cloud/lokal/Ersatz; Schlüssel nur serverseitig | geliefert (Quelle) + dieser Lauf (global, EN, PG) | JOB 3134 R3 LIVE 1.0.0-beta.1.165; `tests/ki-anbieterwahl/**`; K1-Lauf prüft, dass kein Schlüssel in Admin-Antwort oder Anbieterrumpf steht. Je-Aufgabe-Wahl im echten Browser hier nicht gefahren. |
| R-0685 | Lokales Modell als zweites Backend, Kette Cloud → lokal → Ersatz | Code vorhanden, Betrieb **offen** | `createLocalClientFromEnv` (`model-client.ts:721`). Ohne Maschine nicht abnehmbar → R-1787. |
| R-0689 | Schlüssel-Test mit echtem kleinem Aufruf, echter Fehlergrund | geliefert (Quelle) + dieser Lauf (EN-Knopf → Anthropic) | `POST /api/reasoner/test`, `test-local`; Fehlergrund JOB 3420 LIVE 1.0.0-beta.1.254 (`tests/ki-fehlerhilfe/**`). Echter Fehlgrund gegen echten Anbieter: Betriebsprobe. |
| R-0693 | Beide Zugänge beim Start aus ENV/Schlüsselbund; nie Schlüssel in der Oberfläche | Code vorhanden | `createCappedCloudClientFromEnv(process.env, …)` in `build-app.ts`. **Quellenwiderspruch** mit R-0799 (s. u.). |
| R-0699 | Quelloffenes Modell für Eigenbetrieb auswählen, „verbindlich erst nach Test vor Ort“ | **offen** (Entscheidung) | Kein Ortstest belegt. Hängt an R-1787. |
| R-0799 | KI-Verwaltung: Schlüssel eintragen, testen, wirksamen Zustand sehen, Kopfzeile, steuert Word mit | Teil geliefert (Quelle) | Test/Zustand: JOB 3134/3420. „Schlüssel eintragen“ widerspricht R-0693 und JOB 3134 („Env-Name, nie ein Schlüssel“). Word-Mitsteuerung im echten Word: **offen**. |
| R-0802 | Lokaler Modell-Server als gleichberechtigter Anbieter; es fehlt Maschine und Entscheidung | **offen** (Entscheidung) | Auswahlwert `local` sichtbar, ohne Server ausgegraut (`AdminKiDetails.tsx` `WahlOptionen`). Hardware/Kosten/erste Aufgabe: Pedis Entscheidung. |
| R-0804 | Betreiber stellt Modell ein, nicht der Nutzer, nicht der Anbieter | Code vorhanden | Modell nur aus ENV (`OPENAI_MODEL`/`ANTHROPIC_MODEL`/`REASONER_MODEL`), Wahl nur mit `users.manage` (`persistenz-und-migration.test.ts` C7). |
| R-0818 | Weboberfläche zum Laden/Löschen lokaler Modelle | **offen** | Im Produktbaum kein solcher Weg gefunden. Setzt R-1787 voraus. |
| R-1138 | Notiz zum Antwort-/Kostenverhalten der Modelle | **offen** | Laufprotokoll mit Kosten existiert (`ki-lauf-*`); eine Auswertungsnotiz je Modell ist nicht vorhanden und braucht echte Läufe. |
| R-1787 | ENTSCHEIDUNG: Maschine für hausinternes Modell — ja/nein, welche Aufgabe zuerst | **offen** (Entscheidung Pedi) | Unverändert. Kein Bau ohne Entscheidung. |
| N-0026 | Cloud-Auswahl mit tatsächlichem Anbieter beschriften; HTTP 400 nicht pauschal als Schlüsselwechsel | Teil (Beschriftung) dieser Lauf; Fehlerhilfe verwandt geliefert | Quelle: „Gegenprüfung offen, keine bestätigte Behebung dieses Einzelbefunds“. Verwandte Lieferungen JOB 3120/3420 (UX-10, UX-10b, 1.0.0-beta.1.254). Dieser Lauf prüft die EN-Beschriftung „External · Claude (Anthropic) · …“ und die Statuszeile; die Fehlerhilfe im ausgelieferten Web gegen einen echten 400 bleibt Betriebsprobe. |
| N-0066 | KI-Schreibaktionen liefern unveränderten Text statt Bearbeitung | **offen** | Braucht echte Modellantwort; in diesem Lauf nicht gemessen. Aktueller Erfüllungsstand ungeklärt. |
| N-0070 | Zugang an der Editorleiste, Anbieter vor Ausführen zeigen | Zugang geliefert (Bestand) + **Anbieterzeile dieser Lauf**; Namensanzeige für Nicht-Admins **offene Entscheidung** | Abgleich am Produkt: Das Menü „KI“ im Blatt (`Blatt.tsx`, Editorleiste) trägt Strukturieren, Werksaktionen, freie Anweisung und Vorlagen (JOB 3062/3584/3769; Chromium-Belege `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`, `tests/ki-palette-320/…`, `tests/ki-palette-fingertipp/…`). Eine Anbieterangabe vor dem Ausführen fehlte dort — alle anderen KI-Flächen tragen sie über `AiModelInfo`. Neu: Satz „Führt aus: …“ in der Palette, beim Öffnen sichtbar, unter freier Eingabe und Ausführen-Knopf (Nacharbeit 4: oben schob er am 390-px-Telefon die freie Eingabe 31,3 px unter den Rand, B5a) (`AiAusfuehrerZeile`, Ableitung `lib/aiAusfuehrer.ts`, dieselbe wie `AiModelInfo`): Admins sehen Stufe und Anbieter/Modell je Aufgabe (bei abweichender Zuordnung getrennt), alle anderen „hier nicht bekannt (einsehbar in der KI-Verwaltung)“ — Nacharbeit 5 (BEN): die erste Fassung zeigte Nicht-Admins die HAUSWEITE Stufe des öffentlichen Status als Ausführer jeder Aufgabe und behauptete so bei lokal oder regelbasiert gestellter Aufgabe „Cloud-KI“; eine aufgabenbezogene Auskunft gibt es für Nicht-Admins nicht (der öffentliche Status nennt die Stufe je Aufgabe bewusst nicht, vip2-gate/mega67), Gegenprobe A3b. Beleg `ausfuehrer-vor-dem-klick.test.tsx`. **Entscheidung getroffen (Antwort 13, über BEN, Nacharbeit 7):** normale Anwender sollen den tatsächlich arbeitenden Dienst, seine Verfügbarkeit und Einschränkungen erkennen. Umgesetzt: neuer Weg `GET /api/reasoner/ausfuehrung` (ko.read, geheimnisfrei — Anbieterkennung, Verfügbarkeit, Einschränkungscodes, „Keine KI“-Stufen; keine Modellkennung, kein Schlüssel, keine Adresse), `Reasoner.ausfuehrung()` aus der freigabegeprüften Kette JE AUFGABE; die Palettenzeile zeigt Nicht-Admins daraus z. B. „Führt aus: Claude (Anthropic) · verfügbar · vertrauliche Texte ohne Cloud-KI“. Der öffentliche Status (ohne Anmeldung) bleibt abstrakt. Belege `ausfuehrer-vor-dem-klick.test.tsx` A6–A8/A4 und `keine-ki-je-schutzstufe.test.ts` S6. Dass freie Anweisung und Vorlagen bereits an der Leiste liegen, entkräftet den Ist-Befund „hinter Datei → Formular (Experten)“ vom 08.09. für den Haupteditor. |
| N-0087 | Interview-Ersatzfragen verständlich einordnen | Beschriftung geliefert (Bestand) + **Grund und nächster Schritt dieser Lauf** | Bestand: „Feste Ersatzfragen, ohne Antwort der KI“ statt „Deterministischer Fallback“, DE/EN/NL (JOB 3276, `tests/ki-assist-leer/interview-fallback-beschriftung.test.ts`). Dort war festgehalten, dass die Fläche den Grund nicht kennt (`demo` allein). Neu: `Reasoner.interview` trägt bei Ersatzfragen `fallbackReason` (kein Modell/nicht freigegeben, Zeitüberschreitung, Fehler, Vertraulichkeit — dieselbe Unterscheidung wie `structure`, PII-frei); `Capture.tsx` zeigt unter der Beschriftung den Grund und den sicheren nächsten Schritt (weiter antworten, jede Antwort fragt die KI erneut, Zugang unter KI-Verwaltung „Key testen“). Ein aus einem Entwurf wiederhergestellter Stand ohne Grund sagt „nicht bekannt“ statt zu raten. Beleg `interview-ersatzgrund.test.ts` (Reasoner echt, lokaler Anbieter, ohne öffentliche KI). Offen: dieselbe Anzeige mit einem echten Anbieter im Betrieb (K2). |
| P-KI-WAHL | ChatGPT/Claude getrennt, Wahl bestimmt Empfänger, kein heimlicher Wechsel | geliefert DE (07.09., JOB 3134 R3, 1.0.0-beta.1.165) + **dieser Lauf EN/PG/Neustart** | Rest laut Quelle war „EN-Anzeige und echter Anbieterweg getrennt offen“: EN-Anzeige und Empfänger sind jetzt im Chromium-PG-Lauf gemessen (gestellter Transport). Echter Anthropic-Anbieterweg: **offen** (K2). |
| P-KI-OPENAI-400 | OpenAI sendet `max_completion_tokens`, Abnahme = nichtleere Text- UND Bildausgabe | geliefert (Quelle) | JOB 3222 R2 LIVE 1.0.0-beta.1.171; **echte Probe 07.09. 15:34 bestanden** (Codex 616faf45, `openai-text-bild-live.json`: vier nichtleere Text-/Bildantworten DE/EN). Diese API-Teilprobe bleibt der Beleg und wird nicht wiederholt. |
| P-KI-OPENAI-400-R | Usage-only-Testfall | geliefert (Quelle) | geschlossen 07.09. (JOB 3239 §5.5, BEN M3). |
| P-KI-OPENAI-400-R3 | Zwei Meldungen bei zwei Aufrufen, fremde `finish_reason`, Extract-Rettung | geliefert (Quelle) | JOB 3248; `tests/ki-abgeschnittene-antwort/**`. „Echter Anbieter/Word ungemessen“ bleibt **offen** (K4). |
| P-N12b | `OPENAI_API_KEY`/`OPENAI_BASE_URL` in Compose durchreichen | geliefert | `docker-compose.prod.yml:111-130` reicht beide und `REASONER_MODEL` (leerer Vorgabewert) durch. Prämisse der Zeile von der Quelle selbst korrigiert (Compose ist nicht Coolifys Deploy-Quelle). |
| P-N12c | Bildaufträge auch über ChatGPT (`completeVision`) | geliefert (Code) | `openAiCompatibleClient` trägt `completeVision` (`model-client.ts:686`); echte Bildantwort: s. P-KI-OPENAI-400 (OpenAI). Für Anthropic: **offen** (K2). |
| P-N12d / UX-10 / UX-10b | Anbieter und Fehlerhilfe stimmen überein; kein pauschaler Schlüsseltipp | geliefert (Quelle) | JOB 3122 (1.0.0-beta.1.143), JOB 3420 (1.0.0-beta.1.254). |
| TEST-A07 / TEST-A13 | Testgruppen „Klara: Fragen, Antworten, Quellen“ / „KI-Verwaltung und lokale Modelle“ | ungeklärt | In der Quelle „noch nicht beurteilt“; kein eigener Bau. |

## Kriterien, die dieser Lauf nicht schliessen kann

- **K2 — echte Text-/Bildantwort, Quellenweg, Weltwissen-/Konfliktgrenze je Anbieter.** Für OpenAI
  liegt die echte Probe vom 07.09. vor (s. o.). Für Claude (Anthropic) fehlt in den Quellen jeder
  Echtbeleg. Ein echter Lauf braucht einen freigegebenen Schlüssel auf einem echten Host und
  verursacht Kosten — das Kriterium schliesst eine freie neue Kostenfreigabe aus. Bleibt
  **Betriebsprobe mit vorhandener Freigabe**.
- **K3, zweite Hälfte — tatsächliche Antwortsprache.** Gemessen ist, dass `nl` als Argument und als
  niederländische Ausgaberegel beim Anbieter ankommt. Ob ein echtes Modell niederländisch antwortet,
  braucht einen echten Anbieterlauf.
- **K4 — Abbruch-/Fragmentwarnung im echten Word-WebView.** Komponentenbelege DE/EN bleiben Teilnachweise
  (`tests/ki-fragment-sichtbar/**`). Ein echtes Word (Desktop oder Online) mit geladenem Add-in ist im
  Prüfstand nicht vorhanden → **menschliche Bedienung** nötig.
- **K8 — echter Host.** Belegt ist seit Nacharbeit 3 ein echter PROZESSwechsel: W7 in
  `en-wahl-pg-neustart.integration.test.ts` startet Klarwerk als eigenen Betriebssystemprozess
  (`server.ts`) gegen dieselbe PostgreSQL, prüft Wahl, Freigabe, Anzeige und Aufgabenempfänger und
  weist das Beenden des Prozesses nach. Nicht belegt: ein Neustart der PostgreSQL selbst und ein
  Container-Neustart auf dem Produktionshost — Letzterer ist ein Betriebseingriff mit Betriebszugang,
  der in den Nachweisen nicht vorliegt.

## Befund dieses Laufs (nicht geändert, Entscheidung nötig)

**Die Erreichbarkeitssonde pingt jeden eingerichteten Anbieter, unabhängig von Wahl und Freigabe.**
`GET /api/reasoner/status` und `GET /api/ai-status` (öffentlich, `build-app.ts:2564-2571`) rufen
`refreshReachabilityIfStale()`; das schickt höchstens einmal je 60 s einen festen Mini-Ping
(„Antworte mit genau einem Wort: OK“, `provider-model.ts:1764-1767`) an **jeden** eingerichteten
Cloud-Anbieter (`service.ts:1102-1120`) — auch an ChatGPT, wenn Claude gewählt ist, und ohne die
Grundfreigabe `kiFreigabe.oeffentlicheKi` zu prüfen (`probe()` geht direkt an `cloudProvider`, nicht
über `chainForChoice`). Es reist kein Nutzer- oder Dokumenttext mit, wohl aber ein bezahlter Aufruf
nach draussen. Das steht im Spannungsfeld zu Pedis Regel „Ohne ausdrückliche Grundfreigabe geht
nichts hinaus“ (`service.ts:846-851`) und zu „kein heimlicher Wechsel“ (P-KI-WAHL), ist aber als
D-AISTATE-Vertrag (Pedi 23.07.) ausdrücklich so gebaut. Der K1-Lauf trennt deshalb Aufgabenrufe von
diesen Pings über den Inhalt. **Zu entscheiden:** Sonde nur bei erteilter Freigabe und/oder nur für
den gewählten Anbieter — oder bewusst so lassen.

## Quellenwidersprüche

1. **R-0693 ↔ R-0799:** „Kein Schlüssel wird je in der Oberfläche eingegeben“ gegen „Schlüssel
   eintragen, testen …“ im Verwaltungsbereich. Der Code folgt R-0693 (Schlüssel nur aus ENV/Schlüsselbund).
2. **R-0685 ↔ P-KI-WAHL:** „wählt selbsttätig zuerst die Cloud, dann das lokale Modell“ gegen „kein
   heimlicher Wechsel“. Der Code trennt das: die Wahl `auto` folgt der Kette, eine ausdrückliche
   Anbieterwahl wechselt nie zu einem anderen externen Anbieter (JOB 3134 R3, `globaleKette`).
3. **FR-I18N-01 „nur DE/EN“ (Kommentar und Test B2 in `reasoner-routes*`) ↔ K3 / JOB 3980:** in
   diesem Lauf zugunsten von K3 aufgelöst.
4. **P-N12b:** die Prämisse („ohne Durchreichung wirkungslos“) ist von der Quelle selbst als
   unzutreffend korrigiert.

## Anbieterwahl je Schutzstufe einschließlich „Keine KI“ (Antwort 29, Nacharbeit 7)

**Befund (BEN):** Der Speicherweg verwarf `proSchutzstufe` mit Antwort 200; `ReasonerTaskConfig`
und seine Normalisierung kannten keine solche Zuordnung — die Abschaltentscheidung erreichte den
Ausführungsweg nicht. Die Originalantwort liegt außerhalb des für diesen Lauf freigegebenen
Bereichs; umgesetzt ist sie nach BENs Wortlaut.

**Umgesetzt:**
- **Speichern/Wiederlesen:** `ReasonerTaskConfig.proSchutzstufe` (Stufen `intern`, `vertraulich`,
  `streng_vertraulich`; Werte wie jede Anbieterwahl, „Keine KI“ = `deterministic`). Normalisiert,
  persistiert (beide Ablagen), über `GET /api/reasoner/config` zurückgelesen, beim Laden wiederhergestellt.
  Weglassen lässt die Regel stehen, `null`/`{}` löscht sie.
- **Nichts still verworfen:** unbekannte Stufe, unbekannter Wert und jedes unbekannte Feld im Rumpf
  von `PUT /api/reasoner/config` → 400, bevor protokolliert oder geschrieben wird.
- **Durchsetzung bis vor den Modellaufruf:** `resolveProvenance` bestimmt die Stufe serverseitig
  (Deklaration, gespeicherter Entwurf/KO — die höhere gewinnt; nicht vertraulich = intern) und trägt sie
  in einen Rahmen je Anfrage (`schutzstufe-kontext.ts`); `Reasoner.wahlFuerLauf` liest sie vor jeder
  Laufkette (`runTask`, Ursachenbestimmung, Auswahl, Konflikt-/Dublettenurteil, Anreicherung) und vor dem
  direkten Zuruf-Weg (`build-app.ts`, `laufWahlFuer`). Anzeige- und Statuswege bleiben bei der Aufgabenwahl.
- **Hintergrund ohne bekannte Stufe:** fail-safe nach dem Vertraulichkeits-Bit — nicht vertraulich →
  Regel für „intern“, vertraulich → die strengere vertrauliche Regel („Keine KI“ gewinnt).
- **Belege:** `keine-ki-je-schutzstufe.test.ts` S1–S5 (gezählte Modellaufrufe: gesperrte Stufe 0,
  erlaubte Stufen je 1, Hintergrund vertraulich 0 / nicht vertraulich > 0, Zurücknehmen gibt frei).

**Grenzen:** Eine Bedienfläche in der KI-Verwaltung für diese Regel ist in diesem Lauf **nicht** gebaut —
gesetzt wird sie über den Adminweg `PUT /api/reasoner/config`. Wege ohne serverseitig bestimmte Stufe
(z. B. `/api/ask`, Textprüfung) folgen der Bit-Regel, nicht der exakten Stufe.

**Nacharbeit 10 (BEN):** (1) Die KI-Karte der Verwaltung (`AdminKiDetails.tsx`, `KiDetail`) hat jetzt
den Abschnitt „KI je Vertraulichkeitsstufe" — je Stufe eine Auswahl „Wie die Aufgabenwahl" / Modelle /
„Keine KI", gespeist aus dem bestätigten Stand, geschrieben über denselben Kanal wie Zuordnung,
Freigabe und Zweitmeinung (`proSchutzstufe`, `null` ohne belegte Stufe). Frontendtypen
(`taskConfig.proSchutzstufe`) und `endpoints.reasoner.updateConfig` kennen das Feld. Beleg:
`admin-schutzstufe-mounted.test.tsx` (echte Karte gegen echten Server: auswählen, speichern,
wiederöffnen, zurücknehmen). (2) Die Ausführungsauskunft nutzt dieselbe Auflösung wie der Lauf
(`wahlFuerStufe`/`laufKetteFuerStufe`) und nennt je Aufgabe `jeStufe` und `stufenAbweichend`; gehen die
Stufen auseinander, zeigt die Palettenzeile jede Stufe mit ihrem Ausführer (Nicht-Admins) bzw. die
Verteilung neben der Aufgabenwahl (Admins). Belege: `keine-ki-je-schutzstufe.test.ts` S8 (Auskunft je
Stufe = gezählte Modellaufrufe am Lauf), `ausfuehrer-vor-dem-klick.test.tsx` A9/A10.

**Integration mit main (Nacharbeit 8):** main brachte parallel die Zweitmeinung (R-0305/R-1099) mit
eigenem Konfigurationsfeld `zweitmeinung` und gelenkter Kette (`lenkung.kette`), den Wissens-Fragebaum
im Interview (`imageContext`, `options`, R-0604-Kennzeichnung) und die KI-Bremse im Blatt. Aufgelöst
so, dass beides gilt: `proSchutzstufe` und `zweitmeinung` stehen nebeneinander in Typen, Normalisierung,
Ablage und Schreibweg; `zweitmeinung` ist in der Feldliste von `PUT /api/reasoner/config` erlaubt (sonst
wiese die 400-Prüfung dieser Runde den Zweitmeinungs-Schreibweg ab). `runTask` nimmt eine gelenkte Kette
unverändert, sonst `laufKette`. **Konkrete Auswirkung geschlossen:** die gelenkte Kette ginge an der
Stufenregel vorbei — `zweitmeinungsModell` meldet deshalb `nicht_freigegeben`, wenn die Stufe des Laufs
„Keine KI“ trägt (Beleg S7: vertraulich 0 Modellaufrufe, nicht vertraulich gefragt). Das Interview
liefert weiter `fallbackReason` (N-0087) und trägt die KI-Marke nur bei echter Modellantwort (R-0604).

## Belegabgleich EDITOR09 — Nachtrag (Nacharbeit 6)

Ergänzt `EDITOR09-BELEGABGLEICH.json` und `EDITOR-ORTSBELEG-20261007/` im Auftragsordner; beide
bleiben **unverändert**. Grund ist BENs Befund zu `report.no_model_control`.

**Was dort behauptet wird:** `no_model_control.actual_surface_message` = „Ich kann diese KI-Hilfe
gerade nicht verlässlich ausführen. Originaltext bleibt unverändert.“ als tatsächlich sichtbare
Meldung im Editor, mit Beleg `16-ohne-modell-hinweis.png`.

**Was die Artefakte tatsächlich zeigen** (Hashes laut `EDITOR-ORTSBELEG-20261007/BELEG-HASHES.json`):

| Artefakt | SHA-256 (gekürzt) | Inhalt |
|---|---|---|
| `16-ohne-modell-hinweis.png` | `cf6bff8b…` | Erfassen-Blatt mit dem unveränderten Satz „Der Mitarbeiter kontrolliert die Anlage vor dem Start.“; **keine** Fehlerkarte, **kein** Meldungssatz |
| `16-ohne-modell-hinweis.txt` | `0c5dd507…` | AX-Differenz: nur der Meldungen-Knopf geändert; **kein** Meldungssatz |
| `15-ohne-modell-menue.txt` | `6755053b…` | AX: „no change“, KI-Menü aufgeklappt |
| `belegbericht.py` | `3ba51736…` | Zeile 21 setzt `actual_surface_message` als **festen Text** — keine Messung |
| `OHNE-MODELL-ZAEHLUNG.json` | `f53e6f5b…` | Server: `POST /api/reasoner` → **500**, Grund „Kein KI-Modell hat geantwortet; die deterministische Ersatzform hätte nur den Originaltext zurückgegeben.“; Lauf `assist`/`deterministic`/`error` |
| `OHNE-MODELL-KONFIG.json` | `5b2a913e…` | global `local`, `assist` → `deterministic` |

**Abgrenzung:**
- **Belegt (Server):** Ohne Modell endet die Schreib-Palette mit einem 500 und benanntem Grund, ohne
  Modellaufruf für `assist` und ohne den Originaltext als Vorschlag.
- **Nicht belegt (tatsächliche Editorbeobachtung):** Eine sichtbare Meldung im laufenden Editor zeigt
  kein vorhandener Rohbeleg — weder Bild noch AX-Text. Ein passender Rohbeleg liegt im Auftragsordner
  nicht vor; nachgereicht wird deshalb keiner.
- **Wortlaut:** Die Fehlerkarte des Blattes (`Blatt.tsx`, `blatt-ki-fehler`) zeigt bei einem 500 ohne
  Vertraulichkeitskennung genau `fd.errAssist` („Ich kann diese KI-Hilfe gerade nicht verlässlich
  ausführen.“) mit „Erneut versuchen“. Der zweite Satz „Originaltext bleibt unverändert.“ steht in
  dieser Karte **nicht**; er ist im Bericht hinzugefügt.

**Was stattdessen belegt wird (Prüfauswahl):**
- **Komponentenbeleg, vorhanden und bereits bestanden:** `tests/ki-freie-anweisung/standardeditor-mounted.test.tsx`
  F3 — ein 500 aus `assist` zeigt in `blatt-ki-fehler` den Satz `fd.errAssist`, der Editortext bleibt
  unverändert, „Erneut versuchen“ wiederholt dieselbe Anweisung.
- **Serverhälfte derselben Lage, neu:** `tests/ki-wahl-betriebsabnahme/ohne-modell-fehlerstrecke.test.ts`
  — dieselbe Zuordnung wie im Ortsbeleg an der echten Route: kein 200 mit Originaltext, Grund im
  Körper, keine Vertraulichkeitskennung (daran wählt die Fläche `fd.errAssist`), kein Modellruf;
  Gegenprobe mit „wie global“ → 200 mit Vorschlag.

Zusammen ist das die **modellfreie Fehlerstrecke mit sichtbarer Meldung auf Komponentenebene** — keine
Beobachtung im echten Editor.
