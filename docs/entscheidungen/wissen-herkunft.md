# Originalautor und Herkunft über Änderungen — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-wissen-herkunft` (Revision 1). Leitgedanke G-4 /
FR-LIF-04: „Herkunft bleibt sichtbar, der Originalautor geht nie verloren.“ Basisstand `fadddf37`
(`1.0.0-beta.1.770`). Das Verhalten prüfen die unten genannten Tests; dieses Dokument selbst liest
kein Test.*

Die Auftragsquelle führt die meisten Punkte nur mit Altquellen („Historische Aussage, heutige
Erfüllung nicht erneut geprüft“). Dieses Dokument ordnet jeden Punkt dem heutigen Bestand zu.
„Belegt durch“ nennt Verhaltenstests; ob sie auf diesem Stand grün sind, sagt erst ihr Lauf, nicht
dieses Dokument. „Nicht nachgemessen“ heißt: in diesem Auftrag weder gebaut noch am Code geprüft —
der heutige Erfüllungsstand bleibt ungeklärt.

## In diesem Auftrag geliefert: „gelöscht“ als eigener Zustand der Autorenzeile (K3)

Vorher hatte die Autorenzeile vier Zustände (Name, „Unbekannte Person (ref)“, „wird geladen“,
„nicht abrufbar“; mega62 H / mega63 B, R-0874 / R-1946). Ein **gelöschtes** Konto fiel auf
„Unbekannte Person“ — ein Mensch, den es nachweislich gab, sah aus wie eine Kennung, die nie eine
Person war. Jetzt:

- **Dienst** (`AuthService.listDeletedUserIds`): die Kennungen gelöschter Konten stammen aus dem
  Prüfprotokoll (`user.delete`, Ziel = Kennung). Eine Kennung, die heute wieder ein Konto ist, zählt
  nicht. Ohne verdrahtetes Protokoll gibt es keinen Beleg und damit keine gelöschten Kennungen.
- **Route** (`GET /api/directory`, `requireUser`): hinter den Konten stehen gelöschte Konten als
  `{ id, geloescht: true }` — **ohne Namen**. Den Namen von damals liest weiterhin nur die
  Verwalteransicht aus dem Prüfprotokoll (N-0027). Damit gilt „Namen nur mit geltenden Leserechten
  auflösen“ auch für Gelöschte.
- **Client**: `endpoints.directory.list` trennt die Marken ab (`lib/geloeschteKonten.ts`);
  Zuweisungslisten sehen nur Konten. `useAuthorName` reicht die Kennungen an den einen Auflöser
  (`lib/koAuthor.ts`), der „Gelöschtes Konto (ref)“ / „Deleted account (ref)“ / „Verwijderd account
  (ref)“ zeigt. Ein gepflegter Name gewinnt immer; Laden und Fehler bleiben unverändert und sagen
  nichts über die Person.

Belegt durch: `tests/wissen-herkunft/geloeschtes-konto-in-der-autorenzeile.test.ts` (neu),
`tests/ko/mega62-autor-verzeichnis.test.ts` (Bestand).

## Zuordnung je Originalpunkt

| Punkt | Heute | Belegt durch |
| --- | --- | --- |
| R-0057, R-2100, SOLL:FR-CAP-07 — Originalautor bleibt beim Fortsetzen eines Entwurfs | **Vorhanden vor diesem Auftrag.** Das Wissensobjekt trägt den Entwurfs-Autor, nicht den Bearbeiter. | `services/capture/src/service.test.ts` (FR-CAP-07), `tests/app/ko-author-paths.test.ts` |
| R-0083 — Herkunftskette bleibt über Änderungen | **Vorhanden vor diesem Auftrag.** `revise` übernimmt `author`/`originalAuthor` unverändert, jede Fassung als Schnappschuss. | `tests/ko/ko-lineage.test.ts`, `tests/audit-gesamt/objektkette.test.ts` |
| R-0110 — alle „frontdoor“-Fundstellen umschreiben | **Verworfen (entschiedene Grenze).** In diesem Auftrag keine frontdoor-Stelle geändert. | — |
| R-0114, R-0573, R-1863 (W10) — Weisungs-Fakt / befugte Person setzt Wissen gültig | **Offen — Entscheidung für Pedi.** Es gibt keine Weisungsbefugnis im Rechtemodell (`docs/entscheidungen/konfliktklassifikation.md`, „Grenzen“). Zu entscheiden: wo die Befugnis sitzt (neues Recht, Konto-Eigenschaft oder Controller/Verwalter) und ob eine Weisung nachgelagert gesichtet wird. Ohne diese Entscheidung nicht gebaut. Vorhanden und nahe dran: Verwalter-Freigabe in einem Schritt mit Protokolleintrag (`ko.admin-validated`, R-1093), Vorrang/Geltungsbereich im Konfliktsystem. | — |
| R-0164, R-0178 — Wissen aus extern freigegebenem Dokument ohne Neuprüfung / als externe Referenz | **Offen — Richtungsentscheidung.** Die Quelle selbst nennt „ob das überhaupt so gewollt ist“ als offen (W2, vom Boss zurückgestellt). Nicht gebaut. | — |
| R-0204 — Evidenz je Quelle und Anhang mit Fassung, Herkunft, Zeitpunkt | **Vorhanden vor diesem Auftrag.** `EvidenceRecord` mit `koVersion`, `createdBy`, `createdAt`. | `tests/demo-erster-nutzerweg/promote-traegt-die-herkunft.test.ts` |
| R-0222 — System- und Nutzereigentum am Antwortbeleg | **Vorhanden vor diesem Auftrag** (JOB 541 D3, `owner` am Antwortbeleg; Systemantwort bleibt Systemeigentum). | `services/ask/src/snapshot-ko-version-und-ref.test.ts` |
| R-0218, R-0714 — Platzhalter in der Herkunftskette nicht scharf / inaktiv | **Nicht nachgemessen.** Quelle: „Einbau und Wirkung nicht belegt“. | — |
| R-0225 — Validierungsreferenz am Wissensobjekt | **Nicht nachgemessen.** Quelle: „Einbau nicht belegt“. | — |
| R-0228 — Verifizierungsmarke mit Prüfer und Zeitpunkt | **Nicht nachgemessen.** Quelle stuft auf „Codepfad“ zurück. | — |
| R-0241 — Quell-Autor in der Validierung sichtbar | **Vorhanden vor diesem Auftrag** (Prüfkarte zeigt den Quell-Autor über `originalAuthor`). | `tests/app/ko-author-paths.test.ts` (FIX 4) |
| R-0268 — Herkunftssätze im Editor geschützt | **Historisch erledigt belegt** (27.08.). | — |
| R-0298, SOLL:FR-LIF-04, R-2130 — Herkunftszeile / Autor überall sichtbar | **Vorhanden vor diesem Auftrag** an Bibliothek, Detail, Aufgaben, Fragen, Risiko, Validierung über `useAuthorName`; in diesem Auftrag um „gelöscht“ ergänzt. Ausgabedokumente nennen Autor/Originalautor als **Kennung**, nicht als Namen (`services/output/src/render.ts`) — die Quelle führt Ausgabedokumente als eigene Zeile (Stufe 2), hier nicht geändert. | `tests/ko/mega62-autor-verzeichnis.test.ts`, `services/output/src/service.test.ts` |
| R-0532, R-1837 (G15) — Urheberschaft an Bildern über den Anhangseintrag | **Nicht nachgemessen.** Benannte Restgröße der Quelle („Verfasser einer Fassung ist kein angemeldeter Nutzer“) bleibt eine eigene Scheibe. | — |
| R-0737, R-1744 — Herkunftskette / Lineage-Sicht je Wissen | **Vorhanden vor diesem Auftrag** (`lib/koLineage.ts`, Abschnitt in `MehrAbschnitte.tsx`). Quellenwiderspruch: Frontend-Checkliste FE-ANA-05 „Stufe 2, Haken leer“ gegen Gesamtkonzept „gebaut“. | `tests/ko/ko-lineage.test.ts` |
| R-0874, R-1946 (A22) — Autorenname mit ehrlichen Zuständen | **Historisch erledigt belegt** (Ship 9); in diesem Auftrag um „gelöscht“ ergänzt (s. oben). | s. oben |
| R-0879 — Herkunfts-Kennzeichen am Wissensstück | **Historisch erledigt belegt** (K1.2, Commit `423cc34`). | `apps/web/src/pages/Library.origin-chip.test.tsx` |
| R-1093 — Verwalter-Sonderweg „als wahr kennzeichnen“ | **Codepfad vorhanden** (`ko.admin-validated`); hier nicht erneut geprüft. | — |
| R-1355 — Herkunftsangaben nur aus einer zentralen Stelle | **Nicht nachgemessen.** Quelle: „gebaut, wartet auf Einbau“ (JOB 1451) — im Bestand keine Prüfregel mit dieser Kennung gefunden. | — |
| R-2205, package:herkunft — Herkunft und Vertrauenswerte am Wissen | Sammelpunkt; Teile s. R-0204, R-0222, R-0737. | — |
| P-IMPORT-NACHWEIS-FREIGABE — Import → Nachweis → Freigabe | **Erledigt laut Quelle** (JOB 4013/4077/4095, `1.0.0-beta.1.530`); kein Rest. | `tests/quelle-dateiname-am-nachweis/datei-an-der-pruefkarte.test.tsx`, `tests/bibliothek-quellennachweis/nachweis-im-bibliotheksabschnitt.test.tsx` |
| P-PROMOTE-HERKUNFT — promote trägt die Herkunft | **Erledigt laut Quelle** (JOB 3934/4137, `1.0.0-beta.1.534`). | `tests/demo-erster-nutzerweg/promote-traegt-die-herkunft.test.ts` |
| K1 Importeur / Bearbeiter / Verantwortlicher getrennt; Übergabe schreibt Herkunft nicht um | **Vorhanden vor diesem Auftrag.** `setAuthor` (FR-LIF-02) ändert nur `author`; `originalAuthor` bleibt; Importeur handelt, die Genannte bleibt Urheberin; `ownership.owner` ist getrennt von `author`. Die einzelne Autorenübergabe ist belegt und wird nicht neu gebaut. | `services/lifecycle/src/service.test.ts`, `tests/json-herkunft-rundlauf/urheberschaft-im-rundlauf.test.ts`, `tests/json-herkunft-rundlauf/herkunft-identitaet-importeur.test.ts`, `tests/security/mega82-importeur-handelt.test.ts` |

## Quellenwidersprüche und fehlende Belege

- R-0737 / R-1744: Konzeptpapier (31.07.) „gebaut“ gegen Frontend-Checkliste (23.06.) „Stufe 2“.
- R-0114 / R-0573: beide verweisen auf dieselbe offene W10-Entscheidung; keine jüngere Entscheidung
  in den Quellen.
- R-0164 / R-0178: eine Quelle „offene Richtungsfrage“, die andere „vom Boss zurückgestellt“.
- Für R-0218, R-0225, R-0228, R-0532, R-0714, R-1355 liegt nur „BEN GRÜN, Einbau nicht belegt“ oder
  „Codepfad“ vor; in diesem Auftrag nicht nachgemessen.
- Ein Lieferbeleg mit Fassung für diesen Auftrag entsteht erst mit der Veröffentlichung (K6).
