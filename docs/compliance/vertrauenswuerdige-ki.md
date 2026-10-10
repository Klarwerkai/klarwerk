# Vertrauenswürdige KI — Transparenz, Aufsicht, Nachvollziehbarkeit

*Aufnahme 20260922 · gesamt-ki-freigaberegeln · R-2066 (Pflichtenheft NFR-TAI-03, SOLL):
„Ausrichtung an Anforderungen vertrauenswürdiger KI (Transparenz, Aufsicht, Nachvollziehbarkeit) als
unterstützender Markttrend (EU AI Act). AK: Prinzipien dokumentiert nachgewiesen."*

Dieses Dokument ordnet jedem der drei Prinzipien die Stellen im Produkt zu, an denen es umgesetzt ist,
und den Test, der es misst. Jede genannte Datei liegt im Repository; das prüft
`tests/ki-freigaberegeln/prinzipien-beleg.test.ts`.

**Grenze:** Das ist eine technische Zuordnung am Code, keine rechtliche Konformitätsbewertung nach der
KI-Verordnung und keine Abnahme durch einen Menschen. Die Unterrichtungspflicht nach Artikel 4 steht
gesondert in `docs/compliance/unterrichtung-artikel-4.md`.

## Transparenz

| Was der Mensch erfährt | Umsetzung | Beleg |
| --- | --- | --- |
| Dass er mit einem KI-System arbeitet (Art. 50 Abs. 1) | Hinweisband | `apps/web/src/legal/NoticeBanner.tsx` |
| Dass ein Inhalt von einer KI erzeugt ist, auch maschinenlesbar (Art. 50 Abs. 2 und 5) | Kennzeichnung an der Fläche und im Laufdatensatz | `apps/web/src/components/AiGeneratedNotice.tsx`, `services/model-runs/src/types.ts` |
| Welches Modell einen Lauf bedient hat | Modell am Lauf, nur wenn es wirklich gerufen wurde | `tests/ki-lauf-modell/lauf-nennt-modell.test.ts` |
| Welcher Anbieter eingerichtet ist und ob öffentliche KI freigegeben ist | Adminfläche nennt Anbieter und Freigabestand, auch ohne Freigabe | `apps/web/src/pages/AdminKiDetails.tsx`, `tests/admin-ki-oberflaeche/freigabe-texte-und-einziger-weg.test.tsx` |
| Wohin der Server überhaupt verbinden kann | Deklarierte Zielliste | `services/app/src/ausgehende-ziele.json`, `tests/ki-freigaberegeln/ausgehende-ziele.test.ts` |

## Menschliche Aufsicht

| Wer entscheidet | Umsetzung | Beleg |
| --- | --- | --- |
| Der Administrator, ob öffentliche KI überhaupt und ob sie auch für Vertrauliches benutzt werden darf (Vorgabe: gesperrt) | Zwei getrennte Freigaben, eine Entscheidungsstelle im Kern | `services/reasoner/src/types.ts` (`ReasonerKiFreigabe`), `services/reasoner/src/service.ts` (`oeffentlicheKiErlaubt`), `tests/admin-ki-freigabe/freigabe-kern.test.ts` |
| Der Administrator bestätigt ausdrücklich, bevor Vertrauliches nach draussen darf | Warn- und Bestätigungsdialog | `apps/web/src/pages/AdminKiDetails.tsx`, `tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx` |
| Der Administrator, ob externe Quellen gesucht und angehängt werden | Vierstufiger Regler, serverseitig wirksam | `services/external-search/src/policy.ts`, `tests/app/external-policy-e2e.test.ts` |
| Ein Controller gibt jeden ausgehenden KI-Aufruf einzeln frei (wenn eingeschaltet) | Ausgangsprüfung am Chokepoint | `services/reasoner/src/ausgangspruefung.ts`, `tests/ausgangspruefung/chokepoint.test.ts` |
| Der Nutzer im Word-Dokument stimmt je Dokument zu | Klara-Zustimmung je Dokument und Anbieter | `services/app/src/services/klara-session-service.ts`, `tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts` |
| Menschen validieren Wissen und lösen Wahrheitskonflikte; die KI entscheidet keine Wahrheit (NFR-TAI-02) | Validierung, Konfliktregel | `services/validation/src/service.ts`, `specs/stories/conflicts.md` |

## Nachvollziehbarkeit

| Was nachvollziehbar ist | Umsetzung | Beleg |
| --- | --- | --- |
| Jede Änderung der KI-Freigabe mit Administrator, Zeit und Umfang | Eintrag im Prüfprotokoll | `tests/admin-ki-freigabe/rollen-und-protokoll.test.ts` |
| Jede Zustimmung und ihr Ende im Word-Weg | Eintrag in der Hash-Kette, unabhängig vom Fortschreiben der Zustimmungszeile | `services/app/src/services/klara-consent-protokoll.test.ts` |
| Manipulation am Protokoll | Hash-Kette, versionsgebunden | `services/audit/src/chain.ts`, `services/audit/src/chain-v2.test.ts`, `docs/entscheidungen/gesamt-auditprotokoll.md` |
| Jeder KI-Lauf mit Aufgabe, Anbieter, Modell, Verbrauch und Fehlerursache | Laufprotokoll | `services/model-runs/src/types.ts` |
| Jede Antwort mit ihren Quellen; ohne Quelle keine „belegte" Antwort (NFR-TAI-01) | Quellenpflicht im Frageweg | `services/ask/src/service.ts` |
| Dass externer KI-Verkehr nur über die bewachten Clients läuft | Architekturwächter | `tests/security/egress-chokepoint.test.ts` |

## Sichtbarkeit der Freigabe für alle Nutzer

Der wirksame Stand der zentralen Adminfreigabe steht über der Kopfzeile („Extern: Blockiert" /
„Extern: Freigegeben" / „… auch Vertrauliches"): `apps/web/src/shell/ExternStatus.tsx`, gemessen in
`tests/ki-freigaberegeln/extern-kopfzeile.test.tsx`. Dass die zweite Freigabe bis zum Anbieter wirkt und
eine fehlende Dokumentzustimmung trotzdem sperrt, misst
`tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts`. Offene Belege nennt
`docs/entscheidungen/gesamt-ki-freigaberegeln.md`.
