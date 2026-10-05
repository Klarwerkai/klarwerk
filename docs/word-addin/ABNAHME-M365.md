# Klara in Word — Abnahme mit einem Microsoft-365-Testkonto (gemeinsamer Teil)

> Aufnahme `m365-anmeldung`, Lauf 1, Runden 1–3 (25.09.2026), Basis `61a09266`
> (1.0.0-beta.1.606). Lauf 2 (26.09.2026, Aufgabenrevision 5): die Lieferung aus Lauf 1 unverändert
> auf die Basis `c38f2d71` (1.0.0-beta.1.608) übernommen und dort erneut geprüft — Abschnitt 4.
> Die zwei realen Hostwege stehen **getrennt**:
>
> - Word für das Web (Chrome): `docs/operations/word-web-hostabnahme/README.md`
> - Word für Mac: `docs/operations/word-mac-hostabnahme/README.md`
>
> Anleitungen: `SIDELOAD-CHROME.md` (Web) und `SIDELOAD-ANLEITUNG.md` (Mac). Manifest:
> `klara-manifest.xml` (eine Datei für beide Hosts, `<Version>1.0.0.1</Version>`).
>
> **Bis zu diesem Stand ist in keinem der beiden Hosts ein Lauf mit dem heutigen Produktweg
> belegt.** Alles unter „automatisch belegt" ist ohne Microsoft-Konto gemessen — am Code, am
> Server-Draht oder im Prüfstand, nicht in Word.

**Keine Geheimnisse in diese Belege.** Keine Kennwörter, Einmalcodes, Sitzungs- oder
Übergabewerte, keine Mandanten- oder Konto-IDs, keine vollständigen E-Mail-Adressen.

## 1. Stammdaten und Zustimmung

**Testkonto-Stammdaten (zentrale Quelle, abgeglichen am 25.09.2026):** Nutzerangabe von Pedi,
zentral registriert in der Steuerung als Quelle `71aaa2ff…` (Datei
`M365-TESTUMGEBUNG-20260921.json`, SHA-256 `35edc697…`, Fassung `20260921-pedi-v1`), zugeordnet dem
Restpunkt `rest:m365-host-belegbedarf-20260919`. Konto- und Mandantenkennungen stehen dort und werden
hier bewusst **nicht** wiederholt.

| Stammdatum | Stand laut Quelle | Art des Belegs |
| --- | --- | --- |
| Kontotyp | Microsoft 365 **Business Basic**, einmonatige Testversion seit 21.09.2026 in einem **eigenen Testmandanten**; eine Lizenz dem Testbenutzer zugewiesen | Nutzerangabe |
| Ablauf der Testversion | 20.10.2026 (Übersicht) bzw. 21.10.2026 (Abrechnung) — **die Hostläufe müssen davor liegen** | Nutzerangabe |
| Rolle des Testbenutzers | Globaler Administrator — darf eigene Add-ins hochladen und zentral bereitstellen | Nutzerangabe |
| Word im Browser | im OneDrive-Erstellungsmenü verfügbar | Nutzerangabe, nicht von der Maschine geprüft |
| Nutzungsfreigabe | nur Testdaten, nur in diesem Testmandanten | Nutzerangabe |
| Zugang für die Maschine | **keiner**: Kennwort nicht übergeben (richtig so), keine nutzbare Sitzung für Assistenten | Quelle, Abschnitt „verbleibende Arbeit" |

Daraus folgt: die Stammdaten sind vorhanden, der **Lauf** ist es nicht. Ihn kann nur eine Person mit
dem Kennwort des Testbenutzers führen; die Felder zur Laufzeit (Chrome-/Word-Version, Dokumentrecht,
Bereitstellung) stehen in den beiden Host-Belegen.

**Was am Produkt feststeht:**

| Punkt | Stand | Beleg |
| --- | --- | --- |
| Microsoft-Entra-/Graph-Zustimmung | **Nicht nötig.** Kein `WebApplicationInfo` im Manifest, kein Office-SSO, keine Graph-Rechte. Angemeldet wird mit dem **KLARWERK-Konto** (Kennwort oder SSO des KLARWERK-Servers). | `klara-manifest.xml` |
| Dokumentrecht | `ReadWriteDocument` — nötig für „Antwort in Word einfügen". Wie Word es beim Hinzufügen anzeigt, ist nicht belegt. | `klara-manifest.xml` |
| Add-in-Bereitstellung | Web: „Mein Add-In hochladen". Mac: wef-Ordner (Weg A) oder Hochladen (Weg B). Zentrale Bereitstellung durch die Microsoft-365-Administration: nicht beschrieben, nicht belegt. | Anleitungen |
| Hochladen eigener Add-ins im Mandanten | Der Testbenutzer ist Globaler Administrator (Nutzerangabe); ob das Hochladen im Testmandanten tatsächlich zugelassen ist, zeigt erst der Lauf. | Web-Beleg, Voraussetzungen |
| Rückfrage „neues Fenster anzeigen" (Web) | Muss zugelassen werden; wird sie ignoriert, zeigt Klara sofort einen Satz dazu. | Abschnitt 2 |
| Host-Versionen | Nur der Mac-Sideload 16.111 vom 24.07.2026 ist belegt (vor dem heutigen Anmeldeweg). | `SIDELOAD-ANLEITUNG.md` |

## 2. Zustände — was der Mensch sieht, und was ohne Microsoft-Konto gemessen ist

| Zustand | Was der Mensch sieht | Automatisch belegt | Realbeleg |
| --- | --- | --- | --- |
| Cookie-/Speichertrennung (Web) | Anmeldung kommt über das Anmelde-Fenster, nicht über ein Cookie im Rahmen; der Zugang liegt nur im Arbeitsspeicher | `tests/office-web-anmeldung/uebergabe-ohne-cookie.test.ts`, `seitenfenster-empfang.test.tsx` | Web W5, W15 |
| Kein pauschales `SameSite=None` | — | Cookie bleibt `SameSite=Lax` (`services/app/src/security-headers.ts`) | — |
| Einbettung nur für belegte Office-Hosts | — | `services/app/src/office-host.ts`, `einbettung-am-draht.test.ts` | Web W3 |
| Warten auf Anmeldung, Abbruch nach 5 Minuten | „Warte auf die Anmeldung …", danach Ursachensatz bzw. „Keine Anmeldung erkannt" | `tests/app/word-addin.test.ts` (Poll-Lifecycle), `seitenfenster-ehrlicher-ausgang.test.tsx` | Web W19, Mac M9 |
| Anmeldung per SSO | geht nach dem Anbieter von selbst weiter, kein zweiter Druck; der Hinweis im Anmelde-Fenster sagt das in drei Sprachen | `sso-rueckweg-zur-dialogseite.test.ts` (Runde 2), `dialogseite.test.ts` (Zweig „schon angemeldet", S4b4b sichtbarer Hinweis, Runde 3) | Web W6 |
| Anmelde-Fenster abgelehnt (Web) | sofort „Das Anmelde-Fenster ließ sich nicht öffnen …", Knopf frei | `seitenfenster-abgelehnter-dialog.test.tsx` (Runde 1) | Web W14 |
| Popup blockiert (Mac/Browsertab) | „Das Anmelde-Fenster wurde blockiert (Popup-Blocker) …" | ebd., Gegenprobe A3 | — |
| Übergabe abgelehnt | „Die Übergabe der Anmeldung wurde abgelehnt …" | `seitenfenster-empfang.test.tsx` (S5d), `uebergabe-vertrag.test.ts` | — |
| Sitzungsablauf beim Arbeiten | „Nicht angemeldet — bitte zuerst bei KLARWERK anmelden." mit genau einem Knopf **Anmelden**; Sitzungszeile „nicht angemeldet"; nichts wird als angelegt behauptet; der Knopf öffnet das Anmelde-Fenster, danach geht dieselbe Markierung mit dem neuen Zugang | `sitzungsablauf-im-seitenfenster.test.tsx` (Runde 3, ausgeliefertes Seitenfenster), `tests/app/word-addin.test.ts` (401 → Anmeldeweg), `schluessel-faellt-bei-abmeldung.test.tsx` (S7b) | — |
| Abmelden | Panel „nicht angemeldet"; auch die Anmeldung im Anmelde-Fenster ist beendet | `schluessel-faellt-bei-abmeldung.test.tsx` (S7a), `kontowechsel-am-draht.test.ts` (K1) | Web W16 |
| Kontowechsel | neues Konto wird übergeben, das alte nicht; fremde Entwürfe unsichtbar | `kontowechsel-am-draht.test.ts` (K2), `bestaetigte-arbeit-ueberlebt-sitzungswechsel.test.ts` | Web W17, Mac M7 |
| **Bestätigte Arbeit** | ein Entwurf mit „Entwurf angelegt" ist nach Sitzungsablauf, Sitzungsende von außen, Kontowechsel, Wiederanmeldung und Abmelden **unverändert** da | `sitzungsablauf-am-draht.test.ts` (Runde 3, echte 14-Tage-Frist mit gestellter Uhr), `bestaetigte-arbeit-ueberlebt-sitzungswechsel.test.ts` (Runde 2) — beide am vollen App-Aufbau, nur mit dem übergebenen Schlüssel | Web W18, Mac M8 |

Der **natürliche Ablauf** ist mit der echten Frist gemessen (`SESSION_TTL_MS`, 14 Tage; gestellt
wird nur die Uhr): eine Minute vorher trägt der Zugang, eine Minute danach nicht mehr; der
Sendeversuch legt nichts an, das Anmelde-Fenster übergibt das alte Konto nicht still, und nach der
Wiederanmeldung ist der Entwurf unverändert und der einzige. Das **Sitzungsende von außen** ist als
Kennwort-Reset durch die Verwaltung gemessen (er beendet alle Sitzungen des Kontos). In einem
echten Host ist keiner der beiden Fälle gemessen.

## 3. Zuordnung der Anliegen

| Anliegen | Geliefert (Fassung) | Beleg | Offen |
| --- | --- | --- | --- |
| **R-0355** eigenes Anmeldefenster, Panel wartet, erkennt von selbst, 5-Minuten-Abbruch, Anmeldung im Panel | WP-KLARA-1c (`aee94197`, 21.07.2026); Übergabe für Web JOB 4076 (1.0.0-beta.1.520); **SSO-Restfall geschlossen** in Runde 2 dieser Aufnahme, sichtbarer Hinweis im Anmelde-Fenster in Runde 3 | Abschnitt 2 | Realbeleg in beiden Hosts |
| **R-0501** Anmeldung im Seitenbereich statt toter Zustand | wie R-0355; abgelehntes Anmelde-Fenster endet nicht mehr in fünf Minuten Warten (Runde 1) | Abschnitt 2 | Realbeleg |
| **TEST-A10** Microsoft 365 in Chrome / Word für das Web | Anleitung JOB 4016 (1.0.0-beta.1.507), Anmeldeweg JOB 4076, Host-Beleg `docs/operations/word-web-hostabnahme/` | — | **Der Lauf selbst** |
| **OFFICE-WEB-ANMELDUNG** | Übergabe ohne Drittanbieter-Cookie, kein `SameSite=None`, Host-Erkennung, enge Einbettung (JOB 4016/4076); Abmelden/Kontowechsel/Sitzungsablauf/bestätigte Arbeit am Draht und im Seitenfenster (Runden 1–3) | Abschnitt 2 | **Realbeleg im Office-Web-Host** für Anmeldung und ganzen Arbeitsweg (Web W7–W13) |

**Abgegrenzt (eigene, bestehende Aufträge, hier nicht neu gebaut):** JOB 3667 (Rückweg aus Word,
1.0.0-beta.1.512); JOB 4085 OFFICE-PG-ABNAHME (Rückweg gegen eine echte `.docx` durch das
ausgelieferte Seitenfenster im Prüfstand und PostgreSQL, 1.0.0-beta.1.522 — **nicht** im echten
Word-Host); die Freigabe des Word-Rückwegs nur für Admins (1.0.0-beta.1.606).

**Quellenwidersprüche:**

1. `SIDELOAD-CHROME.md` sagte bis Runde 1, der Satz „Klara erkennt die Anmeldung von selbst" sei
   seit JOB 4076 ersetzt; das Seitenfenster und die Mac-Anleitung sagen ihn weiter. Am Code gilt
   jetzt: mit Übergabe erkennt das Panel die Anmeldung in beiden Hosts von selbst — auch nach SSO
   (Runde 2); nicht, wenn die Übergabe scheitert (dann steht der Grund da).
2. `SIDELOAD-CHROME.md` nennt JOB 4011 „Sitzung am Server"; der Auftrag JOB 4011 heißt im Verlauf
   „Einen Gast in EINEM Schritt befristet anlegen". Nicht aufgelöst.
3. Der Restpunkt `rest:m365-host-belegbedarf-20260919` führte bis 21.09.2026 „Testkonto
   unbekannt"; seit der Quelle `71aaa2ff…` ist nur diese Teilvoraussetzung überholt — Sitzung und
   Hostläufe fehlen weiter. Die Quelle nennt zudem zwei Ablaufdaten der Testversion (20. und
   21.10.2026); beide stehen oben.

**Fehlende Belege:** jede Word-/Chrome-Version außer dem Mac-Sideload vom
24.07.2026; jeder Lauf in einem echten Host mit dem heutigen Weg (beide Host-Belege, alle Zeilen);
Mandanteneinstellung zum Hochladen eigener Add-ins; SSO gegen einen echten Identitätsanbieter; ein
Lauf mit mehreren Serverinstanzen (Übergabecodes liegen im Arbeitsspeicher einer Instanz).

## 4. Lauf 2 (26.09.2026, Aufgabenrevision 5)

**Was sich gegenüber Lauf 1 geändert hat:** am Produkt nichts. Lauf 1 endete ohne Übernahme in den
Hauptstand (Grenze der Nacharbeitsrunden); die unabhängige Prüfung von Lauf 1, Runde 3, hatte die
technische Lieferung anerkannt und nur die realen Hostläufe als offen benannt. Lauf 2 übernimmt
diese Lieferung — Seitenfenster, Anmelde-Fenster, SSO-Rücksprung, Prüfstandfälle, die zwei
Host-Belege und diese Datei — auf die heutige Basis, statt sie neu zu bauen. Die Übernahme lief
ohne Konflikt; die Prüfstandfälle sind auf der neuen Basis erneut grün.

**Stammdaten erneut abgeglichen (26.09.2026):** die zentrale Quelle ist seit dem 21.09.2026
unverändert (SHA-256 `35edc697…` wie in Abschnitt 1). Sie enthält weiterhin **kein Kennwort und
keine nutzbare Sitzung** für Assistenten. Damit gilt für jeden Realbeleg dasselbe wie in Lauf 1:
ihn kann nur eine Person mit dem Kennwort des Testbenutzers führen, in Word für das Web vor dem
20.10.2026. Der Testserver fährt Prüfbefehle, Chromium und PostgreSQL — Word, einen
Microsoft-Mandanten und Word für Mac kann er nicht bedienen.

**Fünfter zugeordneter Punkt `package:installation` („Klara auf dem Mac einrichten"):**

| Planvorschlag aus der Quelle | Stand | Beleg |
| --- | --- | --- |
| Sichtbare Versionsnummer und Updatehinweis | geliefert (JOB 1077): das Seitenfenster kennt die geladene Fassung aus der Auslieferung und vergleicht sie mit der verfügbaren; ein Wechsel wird nur bei bekannter, abweichender Fassung angeboten | `tests/app/word-addin-taskpane-version-contract.test.ts` — im Prüfstand, nicht in Word |
| Browser-Anmeldung bleibt nachvollziehbar | **abgegrenzt**: die Browser-Erweiterung ist ein eigener Weg mit eigener Anleitung und eigenem offenen Livebeleg | `docs/browser-extension/README.md` |
| Word Desktop auf Mac eingerichtet | Anleitung vorhanden, Sideload 16.111 am 24.07.2026 (vor dem heutigen Anmeldeweg) | `SIDELOAD-ANLEITUNG.md`; Realbeleg: Mac M1–M10 offen |
| Word im Browser separat eingerichtet und abgenommen | Anleitung vorhanden | `SIDELOAD-CHROME.md`; Realbeleg: Web W1–W19 offen |

**Weitere Quellenwidersprüche (Auftragsquelle gegen Code):**

4. R-0355 und R-0501 stehen in der Auftragsquelle als „angedacht", Prüfstatus „nur Altquelle";
   die Juli-Quelle zu R-0355 nennt den Weg dagegen „eingebaut" (WP-KLARA-1c, 21.07.2026). Am Code
   ist der Weg vorhanden und im Prüfstand gemessen (Abschnitt 2); „angedacht" ist überholt,
   „abgenommen" wäre falsch.
5. TEST-A10 steht in der Quelle als „verschoben — Pedi meldet sich bei Vorbereitung an"; eine
   Beurteilung ist dem Punkt nicht zugeordnet (Qualifikation „noch nicht beurteilt", keine
   Belege). Der Punkt bleibt offen.
6. OFFICE-WEB-ANMELDUNG steht in der Quelle als „erledigt (Teil 1 + Teil 2) 15.09.2026", mit
   dem Rest „Realbeleg im echten Office-Web-Host". Das „erledigt" gilt nur für den Bau; der Rest
   ist der Kern dieses Auftrags und weiterhin nicht erbracht.

**Stand je Kriterium nach Lauf 2:** automatisch belegt und auf der heutigen Basis grün sind die
Übergabe ohne Drittanbieter-Cookie, `SameSite=Lax`, Host-Erkennung und enge Einbettung, das
abgelehnte Anmelde-Fenster, der Sitzungsablauf, Abmelden, Kontowechsel und der Erhalt bestätigter
Arbeit (Abschnitt 2). **Nicht erbracht** — und von der Baubahn nicht erbringbar — sind alle
Realbelege: Chrome-/Word-Version, Bearbeitungsrecht und Mandanteneinstellung zur Laufzeit, Klara
in einem echten Dokument aus einem frischen Chrome-Profil, der getrennte Lauf in Word für Mac und
der ganze Arbeitsweg im Office-Web-Host bis zum 3667-Rückweg.
