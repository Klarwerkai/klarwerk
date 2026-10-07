# Aufnahme 20260922 · Autorenübergabe als wartende Aufgabe — Quellenlage und offene Frage an Pedi

Auftrag: `aufnahme:20260922:gesamt-aufgabenansicht:autorenuebergabe`, Revision 1. Folgeauftrag aus
Pedis `entscheidung:8bace44d-d7b0-421a-83a5-b28cec95283d` (30.09.2026). Basis: `3264ad7d`
(`1.0.0-beta.1.718`).

Kurzfassung: Das Kriterium K2 verlangt, vor dem Bau festzuhalten, **was** eine Autorenübergabe als
anstehende Aufgabe auslöst, **wem** sie angezeigt wird und **wann** sie als erledigt gilt. Zwei der
drei Punkte lassen sich aus den Quellen ableiten. Der Auslöser lässt sich nicht ableiten. Nach K2 wird
er deshalb nicht selbst entschieden, sondern unten als Frage mit Optionen an Pedi gestellt. Bis zur
Antwort ist an der Aufgabenfläche und an `setAuthor` **nichts gebaut** worden. Am Kopfband ist in
Nacharbeit 1 nur Bens Zählbefund behoben (siehe unten). Die Autorenaufgabe selbst ist das nicht.

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
| **Was** löst sie aus? | **Nicht ableitbar.** Die einzige Angabe ist „bei Personalwechsel“. Woran das System einen Personalwechsel erkennen soll, steht in keiner Quelle, und einen Wartezustand gibt es im Code nicht. Jede der Optionen unten wäre eine eigene fachliche Festlegung. | — |

## Frage an Pedi (vor dem Bau, K2)

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
- Weil nichts gebaut wurde, stimmt der Satz **heute mit der tatsächlichen Fläche überein**.
- Kommt die Autorenübergabe nach Pedis Antwort (A, B oder C) auf die Fläche, weicht der Satz von
  R-0962 ab. Dann ist er in allen drei Sprachen mitzuändern, und die Abweichung zu D-003 wird als
  Pedis Entscheidung vermerkt, nicht stillschweigend.

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

Nicht behoben, getrennt benannt (Quelleninspektion, unverändert aus dem Bestand):

- Die Aufgabenliste liest die Protokolleinträge über `GET /api/audit`, und das verlangt
  `ko.validate`.
- Für die Rolle Experte scheitert dieser Abruf. Die Liste kann deren zurückgegebene Entwürfe
  deshalb nicht zeigen (`ladephase` „error“), obwohl sie sich gerade an Autorinnen richten.
- Der Zähler rechnet serverseitig und ist davon nicht betroffen.
- Diese Lücke der Liste gehört nicht zu Bens Befund. Ihre Behebung ist eine eigene Entscheidung,
  etwa ob die Liste dieselbe Serverquelle mit Kennungen bekommt.

## Unverändert (K3, K4)

- `setAuthor`, `transferAuthor`, die Route `transfer-author` und das Audit `ko.author-transferred`
  sind nicht angefasst. Die vorhandenen Tests dazu sind im Prüfplan dieses Auftrags aufgeführt.
- Aufgabenfläche, Filter, Sortierung, Absprung und Rückweg (N-0015) sind nicht angefasst. Beleg sind
  die vorhandenen Tests unter `tests/aufgaben-ansicht/` und `tests/app/work-center.test.ts`.
