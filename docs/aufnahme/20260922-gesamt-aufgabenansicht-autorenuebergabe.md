# Aufnahme 20260922 · Autorenübergabe als wartende Aufgabe — Quellenlage, Entscheidung, Umsetzung

Auftrag: `aufnahme:20260922:gesamt-aufgabenansicht:autorenuebergabe`, Revision 1. Folgeauftrag aus
Pedis `entscheidung:8bace44d-d7b0-421a-83a5-b28cec95283d` (30.09.2026). Basis: `3264ad7d`
(`1.0.0-beta.1.718`).

Kurzfassung:

- K2 verlangt, vor dem Bau festzuhalten, **was** eine Autorenübergabe als anstehende Aufgabe
  auslöst, **wem** sie angezeigt wird und **wann** sie als erledigt gilt.
- Empfänger und Abschluss waren aus den Quellen ableitbar, der Auslöser nicht. Er ging deshalb als
  Frage mit Optionen an Pedi (Abschnitt „Frage an Pedi“, jetzt **beantwortet**).
- Peter hat am 11.10.2026 entschieden (Fragen 23 und 24, Abschnitt „Entscheidung“ unten).
- Seit Nacharbeit 5 ist die wartende Autorenübergabe auf der Fläche gebaut (Abschnitt
  „Nacharbeit 5“).

## Was die Quellen sagen

| Quelle | Wortlaut / Inhalt | Was daraus folgt |
|---|---|---|
| R-0961 (24.06., Funktionsregister; Auftragsquelle `26c0077d…`) | „Eine Seite bündelt alle offenen Aufgaben einer Person: Entwurf fortsetzen, einreichen, Validierung, Rückfrage, Konflikt, Wissenslücke, Re-Validierung, Autorenübergabe. Sortiert nach Kritisch, Heute und Später, mit Filtern und direktem Absprung zum Objekt.“ | Die Autorenübergabe ist eine Aufgabenart. Auslöser, Empfänger und Abschluss nennt der Eintrag nicht. |
| `UI:UX/design_handoff_klarwerk_frontend/BRIEF.md:154` (§2a) | Dieselbe Liste der Arten, „Sortiert nach Priorität Kritisch · Heute · Später; Filter (Typ, Priorität, Domäne); … direkte CTA mit Sprung zum Objekt“ | Nur Art und Darstellung, kein Auslöser. |
| `BRIEF.md:162` (§10), `BRIEF.md:198`, `Frontend-Anforderungsbeschreibung.md:45` und `:183` (§7.14) | „Autorenübergabe (nur Admin; Autor ändert sich, Originalautor bleibt in Fußnote)“; „R-Admin. Zusätzlich: … Autorenübergabe“ | **Empfänger ableitbar:** Nur der Admin darf übergeben. |
| `Frontend-Gesamtuebersicht.md:170` | „Autoren-Übergabe (`reassignAuthor`) — bei Personalwechsel.“ | Ein Anlass wird genannt („Personalwechsel“). Das System kennt aber keinen Zustand „Personalwechsel“. Siehe unten. |
| `Frontend-Anforderungsbeschreibung.md:217` (W-5) | „Pflegen: … Autorenübergabe unter Wahrung des Originalautors.“ | Teil des Pflegeablaufs, ohne Auslöser. |
| R-0962 / D-003 (13.08.) | Die Fläche hat fünf Arten: „zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken und Re-Validierungen“. | Jüngere Quelle **ohne** Autorenübergabe. Siehe „Quellenwiderspruch“. |
| `entscheidung:8bace44d…` (Pedi, 30.09.) | „Nein, aber gesondert: Die Autorenübergabe als Aufgabe kommt in einen eigenen späteren Auftrag.“ | Pedi will die Aufgabe grundsätzlich. Auslöser, Empfänger und Abschluss legt die Entscheidung nicht fest. |

Was der Code heute kann (Quelleninspektion, Basis `3264ad7d`):

- `services/knowledge-object/src/service.ts:6297–6310` `setAuthor`: setzt `author`, behält
  `originalAuthor` und schreibt das Audit `ko.author-transferred` mit `payload: { author }`.
- `services/lifecycle/src/service.ts:143–146` `transferAuthor`: ruft nur `setAuthor` auf.
- `services/app/src/routes/ko-routes.ts:3556–3566`: Aktion `transfer-author`, Recht `users.manage`
  (Admin).
- Die Bedienung erfolgt über `apps/web/src/components/bibliothek/MehrAbschnitte.tsx:480`.
- Die Übergabe ist eine **sofortige** Handlung. Es gibt keinen Datensatz und kein Feld für eine
  „anstehende“ Übergabe, also keine Anfrage, keine Markierung und keinen Wartezustand.
- `services/auth/src/service.ts:1080–1091` `deleteUser`: Das Löschen eines Kontos löst bei den
  Objekten dieses Autors nichts aus. Dort bleibt `author` auf die gelöschte Kennung gesetzt.
- Konten können außerdem befristet sein und ablaufen (`isLastApprovedAdmin`, JOB 3665).

## Festgehalten (K2)

| Frage | Stand | Quelle |
|---|---|---|
| **Wem** wird sie angezeigt? | **Ableitbar: Admins** (Recht `users.manage`), denn nur sie dürfen die Übergabe ausführen. Eine Aufgabe für andere Rollen endete am Rollentor. | BRIEF §10 und Rollenliste, Anforderungsbeschreibung §7.14 und R-Admin, `ko-routes.ts:3557` |
| **Wann** gilt sie als erledigt? | **Ableitbar: sobald für dieses Objekt `setAuthor` ausgeführt ist.** Dann ist `author` geändert, `originalAuthor` bleibt, und das Audit `ko.author-transferred` steht. Dasselbe verlangt K3 („Nach ausgeführter Übergabe verschwindet die Aufgabe“). | Anforderungsbeschreibung §7.14, `service.ts:6297–6310`, Kriterium K3 |
| **Was** löst sie aus? | Bis 10.10. **nicht ableitbar** (nur „bei Personalwechsel“). Seit 11.10. **entschieden** durch Peter (Frage 24), siehe „Entscheidung“. | QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011, Frage 24 |

## Entscheidung (Peter, 11.10.2026) — Auslöser, Berechtigte, Anzeige, Priorität, Abschluss

Quelle: `QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json` (Auftragsunterlagen), Faden
`icloud/01a1254c-582a-76c2-895b-bbefc2c2553f`. Beide Antworten übernehmen die Empfehlung.

- **Frage 23** — „Was passiert, wenn der Verantwortliche eines Wissensbereichs gelöscht wird oder
  ausscheidet?“ Antwort: „deine empfehlung, das wissen gehoert der firma, nicht der person“.
  Beschluss: Die Verantwortlichkeit wird übertragen. Firmenwissen bleibt der Firma, private Notizen
  gesondert. Gemeinsam genutztes Wissen soll einen **erreichbaren** Verantwortlichen behalten.
- **Frage 24** — „Wann entsteht eine wartende Autorenübergabe, wer darf sie verlangen und welche
  Priorität erhält sie?“ Antwort: „deine empfaehlung“. Beschluss: Eine wartende Autorenübergabe
  entsteht
  - bei gelöschten oder dauerhaft ausgeschiedenen Autoren und
  - auf ausdrückliche Anforderung von Autor oder zuständiger Verwaltungsrolle.

  Standardpriorität ist „Heute“, bei kritischem Wissen höher.

Abbildung auf den Bestand (Regel: `apps/web/src/lib/autorenuebergabe.ts`, eine Stelle für Server
und Oberfläche):

| Punkt | Umsetzung | Grund der Abbildung |
|---|---|---|
| **Auslöser „gelöscht“** | Der Autor des Objekts hat kein Konto mehr (`konto-geloescht`). | `deleteUser` lässt `author` stehen; ein fehlendes Konto ist genau „gelöscht“. |
| **Auslöser „dauerhaft ausgeschieden“** | Das Konto besteht, aber sein Zugang ist abgelaufen (`accessExpiresAt` in der Vergangenheit, `zugang-beendet`). | Einen anderen Zustand „ausgeschieden“ kennt das System nicht. Ein abgelaufener Zugang heißt: kein erreichbarer Verantwortlicher (Frage 23). Der Ruhestandshorizont (24/36 Monate) ist eine Vorausschau und löst nichts aus. |
| **Auslöser „ausdrückliche Anforderung“** | Neue Aktion `request-author-transfer` an `PUT /api/kos/:id`. Sie schreibt nur den Protokolleintrag `ko.author-transfer-requested`. Die Aufgabe steht an, solange danach kein `ko.author-transferred` folgt (`angefordert`). | Kein neues Datenfeld; dieselbe Bauart wie die Rückgaben (Zustand aus dem Protokoll). |
| **Wer darf verlangen** | Der Autor des Objekts und wer `users.manage` trägt (Admin); sonst 403. | „Zuständige Verwaltungsrolle“ = die Rolle, die Konten und die Übergabe verwaltet. |
| **Wem angezeigt** | Admins (`users.manage`): `GET /api/me/author-transfers` und `/summary`. Andere Rollen bekommen 403, und die Oberfläche fragt für sie gar nicht erst ab. | Nur Admins dürfen übergeben (`transfer-author`). |
| **Priorität** | „Heute“. „Kritisch“, wenn das gepflegte Bereichsprofil der Kategorie die Kritikalität „hoch“ trägt (`management/src/profiles.ts`, Faktor `criticality`). | Die vorhandene, ausdrückliche Einschätzung „kritisches Wissen“ im Produkt; ohne Pflege gilt „Heute“. |
| **Erledigt** | Durch die vorhandene Admin-Handlung `transfer-author` (`setAuthor`, Audit `ko.author-transferred`, unverändert). Danach zeigt `author` auf ein erreichbares Konto, und die Übergabe folgt dem Antrag. Die Aufgabe verschwindet aus Liste und Zahl. | K3. |

## Frage an Pedi (vor dem Bau, K2) — **beantwortet am 11.10.2026 (siehe „Entscheidung“)**

Die Frage bleibt hier im Wortlaut stehen. Peters Antwort übernimmt die Empfehlung aus Frage 24.
Sie verbindet A und C und deckt mit „dauerhaft ausgeschieden“ den Kern von B ab. Sie schließt D aus
und legt zusätzlich die Priorität fest.

**Wann soll auf der Fläche „Offene Aufgaben“ eine Autorenübergabe als wartende Aufgabe für Admins
erscheinen?**

- **A · Konto des Autors gelöscht.** Ein Objekt, dessen `author` auf kein vorhandenes Konto mehr
  zeigt, erscheint als Aufgabe.
  - Abgeleitet aus dem Bestand, ohne neue Speicherung.
  - Erfasst nur den Fall, dass ein Konto gelöscht wurde.
- **B · Wie A, zusätzlich bei abgelaufenem oder nicht freigegebenem Konto.**
  - Deckt auch Befristungen und Sperren ab, ohne neue Speicherung.
  - Ein vorübergehend gesperrter Autor erzeugt dann ebenfalls Aufgaben.
- **C · Ausdrückliche Anforderung.** Jemand (der Autor selbst oder ein Controller) meldet an einem
  Objekt „Übergabe nötig“. Die Aufgabe erscheint, bis ein Admin übergibt.
  - Dafür braucht es einen neuen, gespeicherten Anforderungszustand mit eigenem Audit.
  - Das geht über „bestehende Serverlogik wiederverwenden“ hinaus.
- **D · Keine wartende Aufgabe.** Es bleibt bei R-0962 (fünf Arten). Die Autorenübergabe bleibt eine
  Admin-Handlung, und dieser Auftrag wird ohne Bau geschlossen.

Ohne diese Antwort wird K1 nicht gebaut und K3 nicht in seinem zweiten Teil („verschwindet von der
Fläche, Zählung stimmt“).

Folgen für den Bau nach Option A oder B, zur Einschätzung:

- Sechste Quelle in `pages/MyTasks.tsx` und im Kopfband-Zähler (`useNavBadges`).
- Absprung auf das Objekt mit der vorhandenen Übergabe-Bedienung.
- Einordnung in Kritisch/Heute/Später nach einer Regel, die Pedi ebenfalls bestätigen müsste, etwa
  „Kritisch, solange das Objekt validiert und in Nutzung ist“. Auch diese Regel steht in keiner
  Quelle.

## Quellenwiderspruch R-0961 / R-0962 (Satz unter der Überschrift)

- R-0961 (24.06.) nennt die Autorenübergabe als Aufgabenart.
- R-0962 / D-003 (13.08.) beschreibt die Fläche mit fünf Arten ohne sie.
- Der Satz unter der Überschrift (`apps/web/src/texte/aufgaben.ts`, `aufgaben.leitsatz`, DE/EN/NL)
  folgt R-0962 und nennt die fünf Arten.
- Bis Nacharbeit 4 war nichts gebaut, und der Satz stimmte mit der tatsächlichen Fläche überein.
- **Seit Nacharbeit 5** steht die Autorenübergabe auf der Fläche. Der Satz nennt sie deshalb in allen
  drei Sprachen als sechste Art, mit dem Zusatz, dass nur die Verwaltung sie sieht (DE: „… und – für
  die Verwaltung – anstehende Autorenübergaben“).
- Damit weicht er bewusst von D-003 (fünf Arten) ab. Die Abweichung ist Pedis Entscheidung
  (`entscheidung:8bace44d`, 30.09.; Fragen 23/24, 11.10.) und im Kopf von `texte/aufgaben.ts`
  vermerkt, nicht stillschweigend aufgelöst.
- Belegt durch `tests/aufgaben-ansicht/gegenstand-statt-besitzer.test.tsx` (G2: die fünf Arten
  stehen weiter da; G2b: die Autorenübergabe in DE/EN/NL).

## Nacharbeit 1 (07.10.2026): Zählgleichheit Kopfband und Liste (K3, Bens Befund)

Bens Befund (Kandidat `0928a8f0`): Die Aufgabenliste führt die an mich zurückgegebenen Entwürfe
(`pages/MyTasks.tsx`, `returnedToAuthor`), der Kopfband-Zähler (`app/useNavBadges.ts`) zählte sie
nicht. Ein eigener zurückgegebener Entwurf bei sonst leeren Quellen ergab Liste=1, Badge=0. Das ist
ein Fehler aus dem Bestand. Er hängt nicht am offenen Auslöser der Autorenübergabe.

Behoben:

- Neue textfreie Zählquelle `GET /api/me/returned-tasks/summary` → `{ open }`
  (`services/app/src/routes/aufgaben-zaehler-routes.ts`). Sie gilt für den angemeldeten Betrachter,
  hat dieselbe Tür (`ko.read`) und dieselbe sichtbare Grundmenge wie `GET /api/kos`
  (`sqlSichtbarkeitFuer`, `sichtbareFuer`).
- Gerechnet wird mit derselben Funktion `returnedToAuthor` wie auf der Seite. Sie wird importiert,
  nicht nachgebaut. Gelesen werden nur die Protokollaktionen, aus denen die Regel rechnet
  (`RUECKGABE_REGEL_AKTIONEN`).
- Client: `endpoints.me.returnedSummary` und `useReturnedTasksSummary`. Im Aufgaben-Badge ist die
  Quelle in Summe, Ladezustand, Fehler, Frische (Fristtimer) und Wiederholen eingebunden.
- Die Inventare kennen die Route: Rollenabnahme, Guard-Audit, HTTP-API-Referenz und Abrufmitschnitt
  der Chromium-Abnahme.

Gegenproben:

- `tests/aufgaben-ansicht/rueckgabe-zaehler-kopfband.test.ts` (Server):
  - 0 bzw. 1, nur die Zahl;
  - ein fremder Entwurf zählt nicht;
  - nach `ko.revised` ist die Rückgabe abgearbeitet;
  - ein Entwurf im Papierkorb zählt nicht;
  - Gleichheit mit der Listenrechnung aus `GET /api/kos` und dem Protokoll;
  - ohne Anmeldung 401.
- `apps/web/src/app/useNavBadges.badges.test.ts` und
  `tests/app/nav-badges-sidebar-mounted.test.tsx`: der Gegenfall Liste=1 ⇒ Badge 1, dazu Laden und
  Fehler ohne Teilsumme.
- `tests/app/nav-badges-stale-mounted.test.tsx`: Die Quelle fällt beim Neuabruf aus, die Zahl
  verschwindet und kommt wieder.

Damals nicht behoben, in Nacharbeit 3 behoben (siehe unten):

- Die Aufgabenliste liest die Protokolleinträge über `GET /api/audit`, und das verlangt
  `ko.validate`.
- Für die Rolle Experte scheitert dieser Abruf. Die Liste kann deren zurückgegebene Entwürfe
  deshalb nicht zeigen (`ladephase` „error“), obwohl sie sich gerade an Autorinnen richten.
- Der Zähler rechnet serverseitig und ist davon nicht betroffen.
- Diese Lücke der Liste gehört nicht zu Bens Befund. Ihre Behebung ist eine eigene Entscheidung,
  etwa ob die Liste dieselbe Serverquelle mit Kennungen bekommt.

## Nacharbeit 2 (Prüflauf am Kandidaten `ed5fa535`): rote globale Inventare, fremder Bestand

Drei globale Inventartests waren rot:

- `http-api-referenz` A2/A4,
- `jede-gruppe-steht-in-der-tabelle` W2/W8,
- `jede-registrierte-route-ist-abgenommen` E2/E8.

Ihre Fehlerlisten nennen nur Routen anderer Lieferungen:

- `begriffeRoutes`,
- die Kenntnisnahmen,
- `/api/audit/export` und `/api/audit/ko/:koId/findings`,
- `/api/admin/import/knowledge/:koId`,
- die Gesamtanweisungs-Bausteine,
- die Belegstelle von `PUT /api/drafts/:id/pool`.

`/api/me/returned-tasks/summary` steht in keiner dieser Listen. `rollen-am-draht`,
`route-guard-audit` und `mega74-lesewege-sammler` waren mit der neuen Route grün. Der fremde Bestand
wird hier nicht nachgetragen, und die Prüfauswahl dieses Auftrags ist entsprechend korrigiert.

## Nacharbeit 3 (Kandidat `f5eadfb4`): Liste der Rückgaben ohne `/api/audit` (K3, Bens Befund)

Bens Befund: Der Zähler zählte die Rückgaben für Experten, die Liste brauchte aber
`GET /api/audit` (`ko.validate`), und das ist für Experten gesperrt
(`services/rbac/src/policy.ts`). Zählgleichheit gab es damit nicht. Die frühere Gleichheitsprobe las
das Protokoll direkt über den Dienst und umging so genau diese Tür.

Behoben:

- Neue Route `GET /api/me/returned-tasks` → `[{ koId, at, verdict }]`
  (`services/app/src/routes/aufgaben-zaehler-routes.ts`).
  - Sie braucht nur `ko.read`.
  - Sie gilt für den angemeldeten Betrachter, über dieselbe sichtbare Grundmenge wie `GET /api/kos`.
  - Gerechnet wird mit derselben Funktion `returnedToAuthor` wie bei der Summary.
  - Kein Protokolleintrag, kein Titel verlässt dafür den Server.
- `GET /api/audit` bleibt unverändert bei `ko.validate`.
- `pages/MyTasks.tsx` liest die persönlichen Rückgaben über `useReturnedTasks`
  (`["me", "returned-tasks", "list"]`). `useAudit` ist aus der Seite und aus den Lade-, Fehler- und
  Wiederholquellen entfernt.
- Kennung `rw-<id>`, `reworkHref`, Autorauflösung über `/api/kos`, Filter und Rückweg bleiben
  unverändert.

Gegenprobe über HTTP (`tests/aufgaben-ansicht/rueckgabe-zaehler-kopfband.test.ts`):

- Anna und Bert sind Expertinnen bzw. Experte. Jede Person liest mit ihrer eigenen Anmeldung Liste,
  `/api/kos` und Summary.
- Anna erhält genau a1/a2 und `open: 2`, Bert genau b1 und `open: 1`.
- `GET /api/audit` bleibt für beide 403.

## Nacharbeit 4 (Kandidat `c3e04138`): Auffrischung nach der Übergabe (K3/K4, Bens Befund)

Bens Befund:

- Nach einer erfolgreichen Autorenübergabe (`MehrAbschnitte.tsx`, `transfer`) wurden Liste und
  Zahl der an mich zurückgegebenen Entwürfe (`["me", "returned-tasks", …]`) nicht entwertet.
- Beide gelten im Produkt 30 s als frisch (`main.tsx`, `staleTime: ZAEHLER_FRISCHE_MS`).
- Wer übergab und sofort zurückging, sah die alte eigene Rückgabe weiter.

Behoben:

- Der gemeinsame Erfolgshelfer `invalidate()` in `MehrAbschnitte.tsx` entwertet zusätzlich den
  Präfix `["me", "returned-tasks"]`. Die aktive Zahl im Kopfband holt sofort neu, die beim Absprung
  inaktive Liste beim Rückweg.
- Dieselbe Lücke bestand beim Überarbeiten: `ko.revised` beendet eine Rückgabe. Deshalb entwertet
  auch `invalidate()` in `BibliothekLesen.tsx` diesen Präfix.
- Audit, Rollenrechte und die bisherigen Entwertungen sind unverändert.

Gegenprobe (`tests/aufgaben-ansicht/uebergabe-frischt-rueckgaben-auf.test.tsx`):

- Aufbau:
  - ein QueryClient mit der produktiven Frist, über den ganzen Weg derselbe;
  - echte Lese-Hooks und echte Flächen (Kopfbandzeile, Aufgabenseite, Detailseite).
- Der Weg:
  - echter Absprung über die Aufgabenzeile;
  - tatsächliche Übergabe über „Mehr“ → „Provenienz“;
  - sofortiger Rückweg.
- Ergebnis R1: Die Rückgabe ist aus der Liste weg, die Zahl im Kopfband ist weg, der Filter
  `?art=returned` steht noch in der Adresse.
- Ergebnis R2: Scheitert die Übergabe, bleiben Rückgabe und Zahl stehen.
- Der Test entwertet nichts selbst.
- Für die Überarbeitung gibt es keine eigene Gegenprobe; dort ist die Änderung nur aus dem Quelltext
  begründet.

## Nacharbeit 5 (Kandidat `85498be9`): die wartende Autorenübergabe ist gebaut (K1–K4)

Anlass: Peters Entscheidung vom 11.10.2026 (siehe „Entscheidung“). Bens Befunde verlangten:

- den Bau der wartenden Autorenübergabe;
- die Dokumentation der Entscheidung, mit der alten Frage als beantwortet gekennzeichnet;
- passende Prüfungen.

Gebaut:

- **Regel** `apps/web/src/lib/autorenuebergabe.ts` (rein, eine Stelle): Auslöser, Grund und
  Dringlichkeit je Objekt.
- **Server** `services/app/src/routes/aufgaben-zaehler-routes.ts`:
  - `GET /api/me/author-transfers` → `[{ koId, grund, kritisch }]`;
  - `GET /api/me/author-transfers/summary` → `{ open }`;
  - beide nur `users.manage`. Grundlage sind die sichtbare Grundmenge wie `GET /api/kos`, die
    Konten (`AuthService.listUsers`), das Protokoll und die Bereichsprofile.
- **Antrag** `PUT /api/kos/:id` mit `action: "request-author-transfer"` (`ko-routes.ts`):
  - Autor oder Admin, sonst 403;
  - Protokoll `ko.author-transfer-requested`;
  - `transfer-author`/`setAuthor` und das Audit `ko.author-transferred` bleiben unverändert.
- **Fläche** `pages/MyTasks.tsx`:
  - eigene Art „Autorenübergabe“ (`task.authorTransfer`), mit Grund in der Metazeile;
  - Einordnung Heute bzw. Kritisch (`severityForAuthorTransfer`, `lib/workCenter.ts`);
  - eigener Filter `?art=authorTransfer` (`lib/taskFilters.ts`), nur für die Verwaltung sichtbar;
  - Absprung direkt zum Objekt (`/wissen/:id`), dort „Mehr“ → „Provenienz“ → Übergabe;
  - Erklärsatz und Handlung in `lib/taskAction.ts`.
- **Kopfband** `app/useNavBadges.ts`: Für die Verwaltung zählt die Zahl der wartenden Übergaben im
  Aufgaben-Zähler mit. Für andere Rollen gibt es diese Quelle nicht (`null`), sie hält also weder
  Lade- noch Fehlerzustand.
- **Bedienung** `MehrAbschnitte.tsx`:
  - Knopf „Übergabe anfordern“ für Autor und Admin.
  - Übergabe und Antrag entwerten `["me", "author-transfers"]`. Liste und Zahl stimmen damit auch
    beim unmittelbaren Rückweg innerhalb der Frischefrist.
- **Texte** DE/EN/NL in `woerterbuch/*.ts`; Leitsatz in `texte/aufgaben.ts` (siehe
  Quellenwiderspruch).
- **Inventare**: Rollenabnahme, Guard-Audit, Lesewege-Sammler, HTTP-API-Referenz, mega80 (Antrag).

Gegenproben:

- `tests/aufgaben-ansicht/autorenuebergabe-aufgabe.test.ts` (HTTP), Fälle A1–A8:
  - jeder Auslöser;
  - wer verlangen darf;
  - Anzeige nur für Admins;
  - Priorität aus dem Bereichsprofil;
  - Abschluss durch die vorhandene Übergabe samt Audit;
  - gescheiterte Übergabe;
  - in jedem Schritt Liste = Zahl.
- `tests/aufgaben-ansicht/uebergabe-frischt-rueckgaben-auf.test.tsx`, Fälle U1–U3 (gemountet,
  produktive Frischefrist, tatsächliche Übergabe):
  - Art, Grund, „Heute“/„Kritisch“, Filter, Absprung;
  - nach der Übergabe beim Rückweg aus Liste und Kopfband weg, Filter bleibt;
  - gescheitert: bleibt stehen.
- Zähler und Filter: `apps/web/src/app/useNavBadges.badges.test.ts`,
  `tests/app/nav-badges-sidebar-mounted.test.tsx` (f), `tests/foundation/task-filters.test.ts`.

Grenzen:

- „Dauerhaft ausgeschieden“ ist auf den abgelaufenen Zugang abgebildet. Ein Ausscheiden ohne
  Löschung und ohne Befristung kennt das System nicht; dafür steht der ausdrückliche Antrag offen.
- „Kritisches Wissen“ ist die gepflegte Kritikalität „hoch“ des Bereichs. Ohne Pflege gilt „Heute“.
- Den Antrag gibt es nur über den Knopf am Objekt und die API. Eine Aufgabe für die Person, die den
  Antrag stellt, entsteht nicht; angezeigt wird sie der Verwaltung.

## Nacharbeit 7 (Kandidat `ac6f378f`): Prüflaufbefunde nach der Integration

- `apps/web/src/api/hooks.ts` liest keinen React-Kontext mehr. Grund war TS6142: das Modul ist
  aus Node-Prüfungen erreichbar und darf kein `.tsx` laden. Ob die Verwaltung die Übergaben sieht,
  entscheidet der Aufrufer aus der Rolle (`shell/KopfbandPunkte.tsx`, `pages/MyTasks.tsx`). Die
  Rolle steht im Abfrageschlüssel, damit eine vor der Sitzung gemountete Fläche nach der Anmeldung
  neu lädt.
- `autorenuebergabe-aufgabe.test.ts` A1/A2: mains neue Kontoendesperre
  (`produkt:20261007:ownership-uebergabe`, 409 `BESTAND_OFFEN`) verbietet Löschen und Befristen
  eines Kontos, das noch Verantwortung trägt. Die Tests ändern das Konto deshalb vor dem Anlegen
  des Objekts. Statt eines künftigen Ablaufs wird der Ablauf entfernt (`null`), was die Sperre
  zulässt. An der Fachregel ändert sich nichts.
- Fremde rote Prüfungen aus mains Bestand sind nicht mehr im Prüfplan:
  - `g10-herkunft-zentrum-vertraulich`, `route-guard-audit` und `mega74-lesewege-sammler`
    scheitern an mains neuen Routen (Office/WOPI, `POST /api/gaps/:id/zurueckweisen`,
    `GET /api/library/import/candidates/befunde`, Ausgangsstellen `standardDiscovery` und
    `einbetten`).
  - `KnowledgeDetail.owner-chain` scheitert in mains `VerstaendnisfragenBereich.tsx`.
  - Die Einträge dieses Auftrags in diesen Inventaren bleiben bestehen.

## Nacharbeit 8 (Kandidat `c1eb0ecd`): gemountete Admin-Fälle

- Rot waren nur die gemounteten Admin-Fälle: `uebergabe-frischt-rueckgaben-auf` R1/R2/U1–U3 und
  `h1-gesamtinventar` „admin · geladen“. Die Quelle der Verwaltung startet erst nach der Kette
  Status → `/auth/me` → Rolle → Abruf. Bis sie geladen ist, zeigen Kopfband und Liste ehrlich
  „lädt“ statt einer Teilsumme.
- Die beiden Testaufbauten haben zu wenige `act`-Runden abgewartet. Der grüne Admin-Fall
  `nav-badges-sidebar-mounted` (f) wartet sie ab. Jetzt warten auch die beiden Testaufbauten diese
  Runden ab. Produktcode und Sollwerte sind unverändert.

## Unverändert (K3, K4)

- `setAuthor`, `transferAuthor`, die Route `transfer-author` und das Audit `ko.author-transferred`
  sind nicht angefasst. Die vorhandenen Tests dazu sind im Prüfplan dieses Auftrags aufgeführt.
- Die bestehenden Aufgabenarten, ihre Sortierung, Filter, Absprünge und der Rückweg (N-0015) sind
  unverändert. Die Fläche ist nur um die sechste Art erweitert (Nacharbeit 5). Beleg sind die
  vorhandenen Tests unter `tests/aufgaben-ansicht/` und `tests/app/work-center.test.ts`; ihre
  Hook-Mocks kennen die neue Quelle als „nicht vorhanden“ (`null`, Expertensitzung).
