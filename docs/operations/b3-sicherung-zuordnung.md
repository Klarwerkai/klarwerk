# B3 · Kundenbestand sichern, zurückholen, aktualisieren — Zuordnung der Anforderungen

Stand: 27.09.2026, Lauf 3 Runde 1 (Aufgabenrevision 7, Basis-Commit `ab0d1e30`) · Auftrag
`aufnahme:20260922:b3-sicherung-wiederherstellung`. Übernommen ist die Lieferung aus Lauf 2 (Runden 1–3,
zuletzt `0813dea5`, geprüft als `a361ad54`), die dort an der Nacharbeitsgrenze stand und nicht in
`main` eingegangen war; sie enthält ihrerseits Lauf 1 (`f9fbb44b`). Die Befunde aus Lauf 1 Runde 3
stehen in Abschnitt 8, aus Lauf 2 Runde 1 in Abschnitt 9, Runde 3 in Abschnitt 10, die Befunde der
unabhängigen Prüfung von Lauf 2 Runde 3 in Abschnitt 11.

Diese Seite hält fest, **was zu jeder diesem Auftrag zugeordneten Anforderung tatsächlich vorliegt** —
mit Fassung (Commit/JOB) und Beleg — und was **offen** ist. „Offen" heißt hier: weder in diesem
Auftrag geliefert noch durch einen jüngeren Abschlussbeleg gedeckt. Historische Aussagen der Quellen
(„heute fehlt …") beziehen sich auf deren Datum.

## 1. Was dieser Auftrag liefert (Runde 1 und 2)

| Baustein | Pfad | Beleg |
| --- | --- | --- |
| Compose-Adapter `pg_dump` / `pg_restore --list` (im DB-Container, ohne Kennwort, fail-closed) | `scripts/backup/compose/pg_dump`, `…/pg_restore` | `tests/kundenbetrieb-compose/compose-drill.test.ts` A1–A3 |
| Rahmen für Sichern (mit Herkunftsnachweis), Zweitkopie, Übung, Ernstfall, Aktualisieren, Neustart, Prüfen, Gegenprobe, Rückweg, Ablauf; Instanzbindung | `scripts/backup/compose-drill.sh` | `compose-drill.test.ts`, `ernstfall-bindung-auslagerung.test.ts` |
| Prüfwerkzeug (App-Abbild + `postgresql-client-16` + Testabhängigkeiten) | `scripts/backup/compose/pruefwerkzeug.Dockerfile` | nur auf dem Prüfplatz baubar — **ungemessen** bis zum Lauf |
| Kundenbestand über die echte Anwendung anlegen und vergleichen | `scripts/backup/compose/nutzlast.mjs` | `tests/kundenbetrieb-compose/nutzlast.test.ts` N1/N2 (HTTP, In-Memory) |
| Anleitungen | `docs/operations/restore-drill.md` („Compose-Kundeninstanz"), `docs/operations/backup-disaster-recovery.md` §13 | `tests/kundenbetrieb-compose/anleitung.test.ts` |

`scripts/backup/backup.sh` und `scripts/backup/restore-drill.sh` sind **unverändert** (Vorgabe aus
P-F-BEZIEHUNGEN-RESTORE: keine Änderung der Backupskripte aus JOB 4227).

## 2. Die Kriterien K1–K7

| Kriterium | Geliefert | Offen |
| --- | --- | --- |
| K1 Sicherung auf `pruefplatz-b3` über `docker compose exec`, Prüfsumme, `BACKUP_KEEP` | Schritt `sichern` (3 Läufe, `BACKUP_KEEP=2`), Beleg mit Name/Größe/SHA-256/Bestand je Lauf, Kennwortprüfung des Protokolls, `/health`-Stand und DB-Systemkennung | Lauf auf dem Prüfplatz |
| K2 Wiederherstellung in frische DB desselben Stacks, Anwendung dagegen, W1–W4 ohne Skip | Schritte `wiederherstellen` (Drill unverändert + Produktabbild + Byte-Vergleich) und `pruefen` (Skip = Exit 141) | Lauf auf dem Prüfplatz |
| K3 Aktualisierung (build + up, Volumes bleiben, neue Version in `/health`) | Schritt `aktualisieren` (Vorab-Sicherung, `SOURCE_COMMIT`, `--no-deps`, Commit-Prüfung, Inhaltsprüfsumme, Zeiten) | Lauf auf dem Prüfplatz |
| K4 Rückweg bei fehlgeschlagener Aktualisierung | Schritt `rueckweg` (kaputtes Abbild → 122, fehlende Pflichtvariable → 121, danach Inhaltsprüfsumme und Bestandsvergleich); Datenhälfte über `zurueckspielen` mit Rückweg an jedem Schritt | Lauf auf dem Prüfplatz |
| K5 Aussagekraft: manipulierter Dump, veränderte Prüfsumme, ausgelassener DB-Neustart → rot | Schritt `gegenprobe` (11 / 22 mit Tabellennamen / 130; Hash der echten Sicherung vorher = nachher) | Lauf auf dem Prüfplatz |
| K6 Anleitungen DE, exakt der gefahrene Weg, kein Text in der App | §13 und Abschnitt „Compose-Kundeninstanz"; keine Änderung an `i18n.ts` | — |
| K7 Prüfplatz upcloud25 / `pruefplatz-b3`, Belege mit Prüfstand-Commit, BEN, Übernahme | Ablauf und Befehle der Betriebsseite in `restore-drill.md` (E); jeder Beleg trägt `pruefstand`; `COMPOSE_DATEIEN` wird gegen die laufende Instanz geprüft | **gesamter Lauf**, grünes Cloud-Tor und Übernahme-Prüfung derselben Revision: die Bahn darf den Prüfplatz nicht bedienen (`AUSFUEHRUNGSWEG.md`); Belege folgen per `HINWEIS.md` |

## 3. Aufgenommene Zielzustände

| Kennung | Stand | Fassung / Beleg |
| --- | --- | --- |
| R-0808 Prüfsumme je Sicherung, sonst kein Restore | **erledigt** vor diesem Auftrag | JOB 517 (Sidecar, Drill-Glied 1, Exit 10/11); `tests/backup-drill/restore-drill.test.ts`; hier zusätzlich Gegenprobe G1 (Prüfplatz offen) |
| R-0810 Rückfall durch erneutes Ausrollen des alten Abbilds | **geliefert (Compose)**, Prüfplatz offen | `compose-drill.sh aktualisieren/rueckweg` (R1/R3/R4); Datenhälfte: `zurueckspielen` (E2–E6, Rückweg an jedem Schritt). Inselweg (`--daten-zurueck`, JOB 4107) ist B4 und unberührt |
| R-0811 Wiederherstellung an nachweisbare Instanzidentität gebunden | **geliefert** (dockerfrei gemessen), Prüfplatz offen | Instanzkennung `<ARBEIT>/instanz.id`; Herkunftsnachweis je Sicherung; `wiederherstellen`/`zurueckspielen` verweigern fremde, ungebundene oder nicht passende Nachweise mit 161 (I1–I4); Gegenprobe gegen das falsche Ziel im Prüfplatz-Ablauf (G4/G5). Bewusster Umzug nur mit `FREMDE_SICHERUNG_BESTAETIGT=<Kennung>` |
| R-0838 Sicherungskonzept für die abgeschottete Installation | **abgegrenzt** — Inselpaket (B4), nicht Teil dieses Auftrags | — |
| R-0839 täglich, verschlüsselt, zweiter Ort, gestaffelt | **Werkzeug geliefert und gemessen** (Z1–Z4, echtes `openssl`); **beim Kunden nicht eingerichtet** | Schritt `taeglich` = Sicherung + `auslagern` (AES-256, tage/wochen/monate, Zweitkopie entschlüsselt nachgeprüft), Zeitplanzeile in §13.2. Am Prüfplatz liegt der „zweite Ort" auf demselben Knoten — die räumliche Trennung ist dort **nicht** belegbar |
| R-0848 Drill wirklich durchgespielt und mit Zeiten protokolliert | **Werkzeug geliefert**, Lauf offen | Belege tragen Sekunden je Schritt (`ablauf.json`, `wiederherstellen.json`); gegen echte PG bisher nur über Testcontainer (JOB 4010/4097, `echter-wiederanlauf.integration.test.ts`) |
| R-0850 Stand je Sicherung belegbar | **geliefert** für jeden Sicherungsweg dieses Werkzeugs | `<dump>.herkunft.json` (Instanz, `/health`-Version/Commit, Instanzstand, PG-Systemkennung, SHA-256, Zeit) für `sicherung`/`taeglich`, `sichern` und die Vorab-Sicherung (H1/H2). Ein **direkter** Aufruf von `backup.sh` ohne Rahmen erzeugt keinen Nachweis — die Anleitung führt ihn deshalb nicht mehr als täglichen Weg, und Drill/Ernstfall verweigern solche Sicherungen (161) |
| R-0863 RPO/RTO je Kundenklasse festgelegt und gemessen | **Messung geliefert, Festlegung offen** (Entscheidung Pedi) | `zurueckspielen` misst Ausfallzeit (RTO) und Alter des eingespielten Stands (RPO) und prüft gegen `RTO_ZIEL_SEKUNDEN`/`RPO_ZIEL_SEKUNDEN` (164, E8). Verbindliche Werte je Kundenklasse legt die Bahn nicht fest — sie sind eine Kundenzusage (`backup-disaster-recovery.md` §13.6) |
| R-2070 / SOLL:NFR-OPS-02 Backups + getestetes Restore, RPO/RTO | Restore-Test vorhanden (W1–W4, Testcontainer); Compose-Lauf offen; RPO/RTO: Messung da, Festlegung offen | wie oben |
| R-2185 Wiederherstellung praktisch nachweisen · R-2217 Wiederanlauf vorführen | **Werkzeug geliefert** (`wiederherstellen`, `neustart`), Lauf offen | — |
| P-F-BEZIEHUNGEN-RESTORE | **erledigt** vor diesem Auftrag | JOB 4275 D3 (`265e3276`), JOB 4305 D2 (`e17a85ea`, Chromium), `tests/beziehungs-restore-nutzerweg/**`; `pruefen` fährt den Nicht-Browser-Teil gegen die Prüfplatz-PG, den Browser-Teil **nicht** (kein Chromium im Prüfwerkzeug) |
| P-B3-SICHERUNG-PARALLEL | **erledigt** vor diesem Auftrag | JOB 4227 D4 (`65ef0eae`), `tests/backup-parallel/**` (zwei echte Prozesse); `pruefen` fährt beide Teile |
| P-SICHERUNGSLISTE-SUFFIXNAMEN | **erledigt** vor diesem Auftrag | JOB 4109 D1 (`7d653aae`), `tests/kundenbetrieb-sicherung/sicherungen-suffixnamen.test.ts`, Text `adm.backup.seq` |
| P-RESTORE-DRILL-SCHEMA | **erledigt** vor diesem Auftrag | JOB 3401 D1 (`bcbf168d`: `audit` statt `audit_events`, Start wie produktiv, Exit 31), JOB 4097 D2 (`d0bd44d4`: voller Pflichtsatz, Exit 22 mit Namen) |
| TEST-A15 Backup und Restore | gedeckt durch die Zeilen oben | — |
| priority:KUNDENBETRIEB-BACKUP (Sichern, Wiederherstellen, Aktualisieren mit echtem Ergebnis) | **Werkzeug geliefert**, echter Lauf offen | dieser Auftrag |
| package:betrieb | nur „Sicherung und Wiederherstellung beschrieben" gehört hierher (§13, `restore-drill.md`); Modul-Links, Netzunterbrechung, doppelte Aktionen sind **keine** Sicherungsfragen und hier **abgegrenzt** | — |
| question:K09 | unverändert gültig: eine Hashprüfung beweist keinen Restore jedes Paars. B3 stellt die **jüngste** Sicherung wieder her; `beide-dumps-lassen-sich-restaurieren` stellt beide Dumps eines Parallellaufs wieder her; mehr als zwei Prozesse, Netzspeicher, SIGKILL bleiben **nicht** abgenommen | — |

## 4. Wächter gegen die reale PostgreSQL-Strecke

Benannt hat sie die unabhängige Prüfung von JOB 4010 Runde 2 (Punkt 6 „Prüflücken": Datenverfälschung
gegen echte PostgreSQL, „dauerhafte Tests für den neuen URL-Wächter und einen vorzeitig sterbenden
Launcher beziehungsweise die SIGKILL-Eskalation"). Vorhandenes ist übernommen; was nur mit Attrappen
gemessen war, fährt seit Lauf 3 zusätzlich an echter PostgreSQL mit der echten Anwendung und den
**unveränderten** `backup.sh`/`restore-drill.sh`. `pruefen` fährt alle Integrationsträger im
Prüfwerkzeug gegen die PostgreSQL des Stacks.

| Wächter | Träger an echter PostgreSQL | Träger ohne Datenbank (bleibt) |
| --- | --- | --- |
| Datenverfälschung (Byte gekippt, Anhang unbrauchbar, Beleg ohne Anhang) | `echter-wiederanlauf.integration.test.ts` W1 (Gegenprobe), W2 (73), W4 (73) | `restore-drill.test.ts` |
| URL-Wächter der Suite (nur Namen mit `test`) | `waechter-echte-pg.integration.test.ts` U1 | — |
| ungültige DB-URL an der Sicherung: Datenbank gibt es nicht / Rolle gibt es nicht | `waechter-echte-pg.integration.test.ts` U2, U3 (nichts veröffentlicht, Spur „fehler", kein Kennwort in der Ausgabe) | `tests/sicherung-dauerbetrieb/**` (keine URL); Compose-Adapter A1 (Kennwort/Form) |
| ungültige Anmeldung am Drill | `waechter-echte-pg.integration.test.ts` U4 (20 vor `pg_restore`, keine Zieldatenbank) | — |
| vorzeitig sterbender Launcher | `waechter-echte-pg.integration.test.ts` L1 (echter Restore, dann stirbt die echte Anwendung am Startvertrag: 30, Gruppe leer, Port frei) | — |
| Prozessabbau, SIGKILL-Eskalation, fremde PID | `waechter-echte-pg.integration.test.ts` K1 (SIGTERM-taube echte Anwendung: Drill 0, SIGKILL greift, Gruppe leer, Port frei) | `prozesszuordnung.test.ts` P1/P2 (echter npx/tsx-Baum, Attrappen der PG-Werkzeuge) |
| Werkzeugfehler, Tippfehler in `BACKUP_KEEP`, Ergebnisspur | — | `tests/sicherung-dauerbetrieb/**` |

## 5. Quellenwidersprüche und fehlende Belege

1. `backup-disaster-recovery.md` §11 („Sandbox-verifiziert ist nur ein logischer Export", „13
   Modul-Schemas") ist überholt: seit JOB 4010/4097 gibt es einen PG-Restore-Nachweis über
   Testcontainer, und der Pflichtsatz umfasst 45 Tabellen. Der Abschnitt ist als historischer Stand
   stehen geblieben; §13.6 nennt den heutigen Stand.
2. P-RESTORE-DRILL-SCHEMA nennt 39 Tabellen (Messung 09.09.); der Pflichtsatz hat heute 45 (JOB 4309
   ergänzte drei). Kein Fehler, sondern Zeitstand.
3. Der Auftrag nennt „W1–W3"; die Suite hat seit JOB 4097 R2 **W1–W4**. `pruefen` fährt alle vier.
4. `PRUEFPLATZ-B.sh einrichten` legt nur `/home/runner/pruefplatz/…` an; für B3 sind die Ordner und
   die eigene `.env` von Hand anzulegen (README-Nachtrag 21.09. 18:0x) — in `restore-drill.md` (D)
   aufgenommen.
5. Belege eines früheren echten Drills gegen Produktionsdaten (Codex/Root 09.09. 14:37, 39 Tabellen,
   `audit` 2742 Zeilen) sind in P-RESTORE-DRILL-SCHEMA zitiert, liegen aber **nicht** im Repository;
   ihr Pfad ist hier nicht belegbar.

## 6. Nacharbeit Runde 2 — die Befunde der unabhängigen Prüfung einzeln

| Befund | Was geändert ist | Beleg |
| --- | --- | --- |
| B1 Ernstfall-Befehlsblock arbeitete nach Fehlern weiter | Befehlsblock entfernt; Schritt `zurueckspielen`: Bestätigung, Prüfsumme, Bindung, dann jeder Schritt geprüft, Leere des Ziels festgestellt, `--exit-on-error`, Rückweg an jedem Schritt (162/163) | E1–E8; `anleitung.test.ts` A5 |
| B2 gescheiterte Inhaltsmessung galt als „gleich" | `inhalt_pruefsumme` liefert bei Fehler/leer ≠ 0; Aktualisierung und Neustart brechen VORHER mit 111 ab, NACHHER ist es 111 — auch nach einem Rückweg | `compose-drill.test.ts` B2 (zwei Fälle) |
| B3 Override-Datei ging beim Update verloren | instanzeigene Compose-Dateien (alle aus `COMPOSE_DATEIEN` außer `docker-compose.prod.yml`) und `B3_ERHALTEN` bleiben in der Fassung der Instanz; fehlt danach eine, Exit 121 | B3 (zwei Fälle) |
| B4 Prüfcontainer mit schreibgeschütztem `/app/tests` | Baum unter `/b3quelle` (ro) eingehängt und beim Start in `/app` kopiert; Skip = 141 | B4 (zwei Fälle, Attrappe). Ein **Docker-Lauf** des Prüfschritts steht weiter aus (Prüfplatz) |
| B5 OVERRIDE vs. übergebene Datei | Anleitung E erklärt, dass `vorbereiten` die `OVERRIDE`-Datei unter `docker-compose.pruefplatz.override.yml` ablegt und `hochfahren` genau diese nutzt; das Skript prüft `COMPOSE_DATEIEN` gegen das Compose-Kennzeichen des laufenden Containers | B5; `anleitung.test.ts` A6 |
| B6 echter B3-Lauf, Cloud-Tor, Übernahme fehlen | **nicht durch die Bahn behebbar**: der Prüfplatz ist Betriebsseite (`AUSFUEHRUNGSWEG.md`), Tor und Übernahme laufen nach dem Ende der Bahn | offen |
| B7 keine Instanzbindung | siehe R-0811 | I1–I4, G4/G5 |
| B8 keine verschlüsselte Zweitkopie | siehe R-0839 | Z1–Z4 |
| B9 Herkunft nicht für jeden Weg | siehe R-0850 | H1/H2 |
| B10 RPO/RTO nicht festgelegt | Messung und Zielprüfung geliefert; die **Festlegung** je Kundenklasse ist eine Zusage an Kunden und bleibt Pedis Entscheidung | E8; §13.6 |

## 7. Nacharbeit Runde 3 — die Befunde R2-1 bis R2-7

| Befund | Was geändert ist | Beleg |
| --- | --- | --- |
| R2-1 parallele Erstläufe erzeugten zwei Instanzkennungen | `einmal_veroeffentlichen`: vollständig schreiben, dann `ln` (atomar, ersetzt nie); alle Läufe lesen den veröffentlichten Wert. Gilt auch für das Drill-Kennwort | `parallel-und-rueckweg.test.ts` R2-1: zwei echte parallele Prozesse, an dieser Stelle synchronisiert; beide Dumps tragen die Kennung aus `instanz.id` und werden zum Zurückspielen angenommen |
| R2-2 paralleler Erstlauf ersetzte den Schlüssel | derselbe Weg für `auslagerung.schluessel`; außerdem lagert `taeglich` seine **eigene** Sicherung aus (vorher beide „die jüngste" — dieselbe Datei doppelt) und schreibt Zwischendateien je Prozess | R2-2: nach Ende beider Prozesse jede Tageskopie unabhängig entschlüsselt, Dump gleich; genau eine Wochen- und Monatskopie |
| R2-3 gescheitertes `cp` der Stufenkopie übergangen | jedes `cp`/`mv`/Sidecar geprüft; ein nicht belegbarer Zeitraum ist rot; Gesamterfolg erst nach Prüfung jeder neuen Kopie | R2-3 (zwei Fälle, 170) |
| R2-4 Sidecar mit falschem Dateinamen | Sidecar trägt den Namen der Stufenkopie | R2-4: `sha256sum -c` in tage/, wochen/, monate/ |
| R2-5 gescheiterter Wiederanlauf war 162 | nach dem Rückweg `up` **und** „healthy" geprüft; sonst 163 mit „WIEDERANLAUF GESCHEITERT" | R2-5 (163 und Gegenseite 162) |
| R2-6 echter B3-Lauf, Docker-Prüfschritt, Cloud-Tor, Übernahme | **nicht durch die Bahn herstellbar** — Prüfplatz ist Betriebsseite (`AUSFUEHRUNGSWEG.md`), Tor und Übernahme laufen nach dem Ende der Bahn; der Serverlauf lief zweimal in die Wartefrist | offen |
| R2-7 RPO/RTO je Kundenklasse | **offen** — die Zusage ist eine Entscheidung von Pedi; geliefert sind Messung und Zielprüfung (164) | offen |

## 8. Lauf 2 — die Befunde R3-1 bis R3-4 der unabhängigen Prüfung (Lauf 1, Runde 3)

| Befund | Was geändert ist | Beleg |
| --- | --- | --- |
| R3-1 gescheiterte Wochenkopie hinterließ `.2026-W39.belegt`, der nächste Lauf meldete Exit 0 ohne Wochenkopie | `schritt_auslagern`: ein Zeitraum gilt nur als erledigt, wenn dort eine **gültige Kopie samt passendem Sidecar** liegt (`periodenkopie_gueltig`). Scheitert die Kopie, räumt der Lauf seine Teilkopie weg und gibt seine Reservierung frei. Eine Reservierung ohne gültige Kopie wartet `AUSLAGERUNG_WARTEN` Sekunden (Vorgabe 60) auf einen gleichzeitigen Lauf und ist danach **170** mit dem Pfad der Reservierung — sie wird nie geraten und nie weggeräumt | `parallel-und-rueckweg.test.ts` R3-1 (vier Fälle) |
| R3-2 der Kopierfehlertest prüfte nur den ersten Lauf | derselbe Zeitraum wird nach aufgehobener Störung erneut ausgelagert: Exit 0 **und** genau eine Kopie, an der `sha256sum -c` gelingt — für `wochen/` **und** `monate/`; dazu eine liegen gebliebene Reservierung (170, Marke bleibt) und eine verfälschte Periodenkopie (170) | Gegenprobe: die vier R3-1-Fälle gegen `compose-drill.sh` aus `f9fbb44b` → **alle vier rot**; gegen die geänderte Fassung grün |
| R3-3 echter B3-Lauf, Docker-Prüfschritt, grünes Cloud-Tor, Übernahme derselben Revision | **nicht durch die Bahn herstellbar** (Prüfplatz ist Betriebsseite, `AUSFUEHRUNGSWEG.md`; Tor und Übernahme laufen nach dem Ende der Bahn). Gemessen ist in Lauf 2 die reale PostgreSQL-Strecke mit den **unveränderten** `backup.sh`/`restore-drill.sh`: Testserver-Prüfauftrag `pa-1790405999-5088f3e4`, Commit `c38f2d71` (HEAD auf dem Server bestätigt), PostgreSQL-16-Wegwerfcluster, `tests/backup-drill/echter-wiederanlauf.integration.test.ts` → **W1–W4 bestanden, 4/4, kein Skip**, Exit 0. Das ist **kein** Compose-Lauf auf `pruefplatz-b3` | Compose-Lauf, Cloud-Tor und Übernahme offen |
| R3-4 RPO/RTO je Kundenklasse | **offen** — eine Zusage an Kunden, die Pedi festlegt; weder Bahn noch Prüfer erfinden Werte. Geliefert sind Messung (`ausfall_sekunden`, `stand_alter_sekunden`) und Zielprüfung (164) | offen |

## 9. Lauf 2 Runde 2 — die Befunde B1 bis B4 der unabhängigen Prüfung

| Befund | Was geändert ist | Beleg |
| --- | --- | --- |
| B1 `nachher_health: unbound variable` (Zeile 906) auf Linux: R1 1 statt 122, R2 1 statt 121, R4 150 statt 0 | Ursache: `local name` ohne Wert lässt die Variable ab bash 4 ungesetzt; unter `set -u` bricht jeder Fehlerzweig ab, der sie vor der ersten Zuweisung liest. macOS-bash 3.2 behandelt sie als leer — deshalb lokal grün. **Jede** lokale Variable in `compose-drill.sh` hat jetzt einen Anfangswert (nicht nur die gemeldete) | Reproduziert im Container `node:20-bookworm` (bash 5.2.15) mit der Fassung aus Runde 1: wörtlich `line 906: nachher_health: unbound variable`, R1/R2/R4 rot. Neue Fassung dort: 4 Dateien, 61/61 grün. Dauerwächter L1 (`compose-drill.test.ts`) verbietet blanke `local`-Deklarationen an der Datei, unabhängig von der Bash-Fassung |
| B2 abweichender Anwendungsvergleich nach kaputtem Abbild blieb bei 122, `rueckweg` meldete 0 | ein gescheiterter (111) oder abweichender (110) Vergleich überstimmt jetzt auch 120/121/122/124/125, nicht mehr nur 0; nur 123 bleibt stehen. Damit endet `rueckweg` mit 150, sobald einer der beiden Rückfallvergleiche rot ist — ein späterer grüner Schlussvergleich hebt das nicht auf | `compose-drill.test.ts` „B2 (Lauf 2)“ (vier Fälle; Attrappenschalter `STUB_VERGLEICH_ROT_NUR` stört genau einen benannten Vergleich). Gegenprobe gegen die Fassung aus Runde 1: alle vier rot |
| B3 Compose-Lauf auf `pruefplatz-b3` (K1–K5, K7), Zusatzprüfung, grünes Cloud-Tor | **nicht durch die Bahn herstellbar**: den Prüfplatz fährt die Betriebsseite (`AUSFUEHRUNGSWEG.md`), die Bahn hat keinen SSH-Zugang; Tor und Übernahme laufen nach dem Ende der Bahn. Behoben ist, was das Tor dieser Strecke rot machte (B1) | offen — Betriebsseite |
| B4 RPO/RTO je Kundenklasse | **offen, Entscheidung Pedi**. Gesucht in Repository und Steuerungsablage: es gibt **keine** Festlegung, nur den Vorschlag „RPO ≤ 24 h / RTO ≤ 4 h, vom Betreiber zu bestätigen“ (`backup-disaster-recovery.md` §4, `docs/qm/claude-after-report.md`). Keine Werte erfunden. Die Messung am echten Lauf (`zurueckspielen` → `ausfall_sekunden`, `stand_alter_sekunden`; Zielprüfung 164) wartet auf den Prüfplatzlauf | offen |

**Quellenwiderspruch (neu benannt):** `docs/operations/server-hardening-readiness.md:79` führt
„RTO ≤ 4 h“ wie einen festen Wert; `backup-disaster-recovery.md` §4/§13.6 führt denselben Wert als
unbestätigten Vorschlag. Maßgeblich bis zu Pedis Entscheidung ist „Vorschlag“.

## 10. Lauf 2 Runde 3 — B3, B4 und der Torbefund

| Befund | Was geändert oder gefahren ist | Beleg |
| --- | --- | --- |
| B3 vollständiger Compose-Ablauf nicht gefahren | Der Prüfplatz upcloud25 bleibt der Bahn verschlossen (kein SSH, `AUSFUEHRUNGSWEG.md`). **Gefahren** ist derselbe `ablauf` auf einem isolierten Compose-Stack unter Docker Desktop (Projekt `b3lokal`, eigene Volumes, kein Host-Port), von der älteren Ausgabe `c38f2d71` auf die neue, mit echter PostgreSQL 16 und dem echten App-Abbild aus `Dockerfile`. Erster Lauf: 140 — **echter Befund**: im Werkzeugcontainer war `npx vitest` PID 1, die abgeräumte Anwendung blieb als Zombie stehen, jeder Drill im Schritt `pruefen` endete mit 80. Korrektur: `docker run --init` für jeden Werkzeugcontainer (Test R3 in `compose-drill.test.ts`). Zweiter Lauf von einer leeren Instanz: **exit 0, alle zehn Schritte 0**. Anleitung `restore-drill.md` E2 beschreibt genau diesen Weg | `docs/operations/b3-belege/lokal-docker-20260926/` (zwei Archive, `SHA256SUMS`, Lesehilfe mit K1–K5); Test A7 in `anleitung.test.ts` hält Archiv und Prüfsumme |
| B3 (Rest) | K7 — Lauf auf upcloud25 `pruefplatz-b3`, Belege dort, Übernahmeprüfung derselben Revision — ist **weiter offen**; Caddy/TLS lag im lokalen Lauf nicht davor, der zweite Ort lag auf demselben Rechner | offen — Betriebsseite |
| B4 RPO/RTO je Kundenklasse | **weiter offen, Entscheidung Pedi.** Neu ist die erste echte Messung an einer kleinen Probeinstanz (Ausfallzeit 8 s, Stand 184 s alt, Drill 7 s) — ausdrücklich keine Zusage (`backup-disaster-recovery.md` §13.6) | offen |
| Torbefund `tests/insel-update/sicherung-eindeutig.test.ts` S1/S2 („input file does not appear to be a valid archive") | **Ursache in der Testvorrichtung, nicht im Produkt:** die `pg_dump`-Attrappe schreibt Text; `backup.sh` liest mit `pg_restore --list`, wenn es auf dem PATH liegt — auf dem Linux-Tor ja, auf einem Rechner ohne PostgreSQL-Werkzeuge nein (dann Ersatzprüfung, grün). Die Vorrichtung bekommt eine passende `pg_restore`-Attrappe (`PG_RESTORE_ATTRAPPE` in `tests/insel-update/insel-probe.ts`, nur `--list`, leere Datei bleibt unlesbar). `backup.sh` und das Inselpaket (`scripts/insel/`) sind unverändert | Reproduziert mit einem strengen `pg_restore` auf dem PATH: ohne Korrektur S1/S2 rot mit wörtlich derselben Meldung; mit Korrektur `tests/insel-update` 80/80, mit und ohne `pg_restore`. Auf Linux (`node:20-bookworm` + Debian-`postgresql-client`, echtes `/usr/bin/pg_restore`): Fassung Runde 2 S1/S2 rot mit derselben Meldung, neue Fassung 2/2 grün |

