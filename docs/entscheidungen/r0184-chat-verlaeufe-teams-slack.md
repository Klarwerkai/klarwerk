# R-0184 · Teams- und Slack-Gespräche als Wissenskandidaten — offene Umfangsfrage

*Aufnahme 20260922 · gesamt-chat-import (`aufnahme:20260922:gesamt-chat-import`, Revision 1).
Abgeglichene Fassung: Basis `81f9152d` (Produktversion `1.0.0-beta.1.952`). Diese Seite ordnet
die Quellen dem Originalpunkt zu und benennt die offene Entscheidung. Sie ändert weder dessen
Wortlaut noch die Kriterien des Auftrags und **trifft keine Entscheidung**.*

## Ergebnis in einem Satz

Aus den zugeordneten Quellen ist **keine Umsetzung eindeutig bestellt**. Der Originalpunkt ist ein
Vorschlag, dessen Altbestand verworfen ist und dessen heutige Einordnung ausdrücklich offen ist.
Geliefert wird deshalb nur diese Klärung. Einen Teams- oder Slack-Anschluss baut dieser Auftrag nicht.

## Die Quellen, wörtlich und unverändert

| Quelle | Wortlaut | Stand |
| --- | --- | --- |
| Originalpunkt R-0184 (Register-Schnappschuss `$.eintraege[183]`, Alias F-0184), Bereich „Erfassen“ | „Ein Gespraechsfaden aus Teams oder Slack wird als Vorschlag fuer ein Wissensobjekt uebernommen - immer als Kandidat, nie automatisch geprueft.“ | `zustand: angedacht`, `pruefstatus: nur_altquelle`, `entscheidung: null`, `entscheidungen: []` |
| Hinweis zu R-0184 | „Altbestand: Einordnung offen. Der damalige Zustand ist kein aktueller Funktionsnachweis. Auch eine alte Pedi-Auswahl bleibt unten als historische Entscheidung erhalten.“ | Aufnahme 22.09.2026 |
| Altbestand F-0184 (Funktionsregister, `FUNKTIONSREGISTER.json:4311`, Herkunft `EXT-FUNKTIONSLANDKARTE-20260829.md`, 29.08.2026) | Status **VERWORFEN**. Begründung: „Codex: ohne belegten Auftrag streichen. Marktbeleg waere Guru Slack Cards oder Tettra Summarize and Save.“ Belegstatus: „Landkarte v3 Zeilen E11/E12: gestrichen; Streichliste v3 und Codex-Streichliste (ohne Auftrag).“ Notiz: „Landkartenstaende: v1 Welle 3, v2 und v3 gestrichen.“ | `pedi_override: null`, `kundenrelevant: true` |
| R-2193 (`CODEX-ANALYSE-1.md:126`, n:m mit sieben Aufträgen) | „**Bewusst außerhalb v1.** Das Pflichtenheft nennt sie ausdrücklich als Nichtumfang; deshalb sind Teams/Slack, Mail-Eingang und ähnliche Roadmap-Vorschläge nicht automatisch vergessene v1-Lieferpflichten“. Hinweis: „Gilt nur für den im Wortlaut genannten Umfang beziehungsweise v1; kein generelles Verbot späterer Erweiterung.“ | `zustand: verworfen` (für v1), `pruefstatus: geprueft` |
| Pflichtenheft §6 (`specs/reference/Pflichtenheft.md:236-239`) | „Native Store-Apps; Drittsystem-Konnektoren über JSON hinaus; Self-Service-Mandantenprovisionierung; erweiterte BI; Gamification“ | Out of Scope v1 |

Die im Altbestand genannte „alte Pedi-Auswahl“ ist im Datensatz nicht ausgefüllt
(`pedi_override: null`, `override_am: null`). Eine jüngere Nutzerentscheidung zu R-0184 liegt in
den zugeordneten Quellen **nicht** vor.

## Heutiger Stand im Produkt (Quelleninspektion an Basis `81f9152d`)

| Teil | Stand | Beleg |
| --- | --- | --- |
| Lesen eines Gesprächsfadens aus Microsoft Teams | **nicht vorhanden**; kein Dienst, keine Route | keine Fundstelle unter `services/`; `docs/operations/integration-workflows.md:5-7` („keine produktive externe Integration … Slack/Teams“) |
| Lesen eines Gesprächsfadens aus Slack | **nicht vorhanden** | wie oben; `slack` erscheint nur im Geheimnis-Scan (`tools/geheimnis-scan.ts:78`) und als Galeriekachel |
| Importgalerie | Kacheln „MS Teams“ und „Slack“ stehen auf **„geplant“** | `apps/web/src/lib/importSourceGallery.ts:325` und `:332`; festgehalten in `tests/app/import-source-gallery-logic.test.ts` („… und die uebrigen geplant“) |
| Grundsatz „immer als Kandidat, nie automatisch geprüft“ | für **alle vorhandenen** Importwege gegeben: jeder Weg endet bei `createImportCandidates` (Prüf-Warteschlange); erst eine Person mit `ko.validate` nimmt an, und auch dann entsteht ein Wissensobjekt im Status „offen“, nicht „validiert“ | `services/app/src/routes/library-routes.ts:1203` (`POST /api/library/import/candidates`), `:1314` (Annahme); gemessen in `services/app/src/import-review-routes.test.ts` (Kandidat `neu`, ohne `ko.validate` abgewiesen, angenommenes Objekt `offen`) |
| Allgemeine Einlieferung | `POST /api/library/import/candidates` nimmt Einträge beliebiger Herkunft an, auch per Dienst-Schlüssel | `services/app/src/integrations-vertrag.ts:153`, `services/app/src/dienst-schluessel.ts:98`, `docs/architektur/integrations-schnittstelle.md` |

Ein früherer Zustand („v1 Welle 3“) ist **kein** Funktionsnachweis; im Arbeitsbaum gibt es keinen
Teams-/Slack-Lesecode.

## Die offene Geltungs- und Umfangsfrage

**Soll Klarwerk Gesprächsfäden aus Teams oder Slack als Wissenskandidaten übernehmen, und wenn ja,
auf welchem Weg?**

| Alternative | Inhalt | Folge für den Bestand |
| --- | --- | --- |
| **A — Streichung bestätigen** | Der Altbestand-Entscheid „VERWORFEN / ohne Auftrag“ gilt weiter. | Die Galeriekacheln „MS Teams“ und „Slack“ widersprechen dann dem Register und müssten in einem eigenen Schritt entfernt oder umbenannt werden (heute „geplant“). |
| **B — Späterer Ausbau mit eigenem Anschluss** | Klarwerk liest einen Faden selbst aus Teams (Microsoft Graph) bzw. Slack (Slack-API) und legt daraus einen Kandidaten an. Nach R-2193 ist das nur außerhalb von v1 möglich. | Neuer Auftrag mit eigenen Kriterien nötig: Zugangsart und Rechte je Quelle, Umgang mit personenbezogenen Gesprächsinhalten (Datenschutz), Betrieb ohne Außenverbindung (Inselbetrieb, vgl. `docs/Berater/BERATER_KONZEPT_WISSENSSCHICHT_KLARWERK-GEHIRN_2026-07-05.md:35`), Auswahl einzelner Fäden statt ganzer Kanäle. Der Kandidatenkern bliebe unverändert. |
| **C — Ohne eigenen Anschluss** | Ein Faden wird außerhalb von Klarwerk ausgewählt und über die vorhandene Einlieferung (`POST /api/library/import/candidates`) oder eine Exportdatei zum Kandidaten. | Ohne Produktänderung technisch möglich. Ob das als Erfüllung von R-0184 gilt, ist offen, ebenso, ob eine Teams-/Slack-Exportdatei als eigener Dateiweg gewünscht ist. |

**Noch erforderliche Entscheidung (Pedi als Produktverantwortlicher):** Wahl zwischen A, B und C.
Bei B oder C zusätzlich: Release-Zuordnung (v1 ausgeschlossen nach R-2193), welche der beiden
Quellen zuerst und ob personenbezogene Gesprächsinhalte überhaupt übernommen werden dürfen.
Bis dahin bleibt der Bestand unverändert, auch die Galeriekacheln.

## Abgrenzung zu vorhandenen Lieferungen und anderen Aufträgen

- **Teamverwaltung** (`docs/teams.md`, ADMIN-06, `apps/web/src/pages/AdminTeams.tsx`,
  `tests-smoke/admin-teams.spec.ts`): Teams im Sinn von Personengruppen in Klarwerk. Nur
  Namensgleichheit, kein Microsoft-Teams-Anschluss.
- **Wissensupdate für das Teamgespräch** (`docs/wissensupdate-teamgespraech.md`, Auftrag
  `gesamt-wochenupdate`): Ausgaberichtung (Wissen → Gespräch), nicht Übernahme aus einem Gespräch.
- **SharePoint/OneDrive-Import** (Microsoft Graph, `services/app/src/routes/sharepoint-import-routes.ts`)
  und **Confluence/Jira-Import**: lesen Dateien bzw. Seiten und Vorgänge, keine Chatfäden. Ihr
  Kandidatenkern ist derselbe, den Alternative B oder C nutzen würde.
- **R-2193** gehört gleichzeitig zu den Aufträgen `gesamt-adoption`, `gesamt-anlagendaten-abgleich`,
  `gesamt-bi-anbindung`, `gesamt-email-eingang`, `gesamt-instanztrennung` und `gesamt-native-apps`.
  Hier ist nur der Teams/Slack-Anteil eingeordnet. Mail-Eingang, Apps, BI, Selbstbedienung und
  Gamification bleiben bei diesen Aufträgen.

## Quellenwidersprüche

1. **Angedacht oder verworfen.** R-0184 trägt `zustand: angedacht` und „Einordnung offen“. Der
   Altbestand F-0184 trägt `VERWORFEN` (Landkarte v2 und v3 gestrichen, Codex-Streichliste).
2. **Galerie gegen Register.** Die Importgalerie zeigt Teams und Slack als „geplant“
   (`importSourceGallery.ts:325`, `:332`), das Register als verworfen. Ein Auftrag, der „geplant“
   begründet, ist in diesem Arbeitsbaum nicht auffindbar.
3. **Pflichtenheft-Wortlaut.** R-2193 sagt, das Pflichtenheft nenne Teams/Slack „ausdrücklich“ als
   Nichtumfang. §6 nennt Teams und Slack nicht namentlich, sondern „Drittsystem-Konnektoren über
   JSON hinaus“. Unter diese Klausel fallen auch die gelieferten Confluence-, SharePoint- und
   Jira-Wege. Die v1-Grenze wird also schon heute nicht wörtlich gehandhabt.
4. **Quellzeilen.** Der Belegstatus nennt „Landkarte v3 Zeilen E11/E12“, `quell_ids` nur `E11`
   und „MARKTBLICK-SCHNITTSTELLENIDEE 4“.

## Fehlende Belege

- Altquellen nicht im Arbeitsbaum und hier nicht eingesehen: `FUNKTIONSREGISTER.json:4311`,
  `EXT-FUNKTIONSLANDKARTE-20260829.md`, `CODEX-ANALYSE-1.md:126`,
  `KLARWERK-Funktions-Roadmap.md:211-228`, Landkarte v1–v3 und beide Streichlisten.
- Die „alte Pedi-Auswahl“ ist im Datensatz leer und nicht belegt.
- Die Marktbelege (Guru Slack Cards, Tettra Summarize and Save) sind nicht geprüft.
- Kein gefahrener Teams- oder Slack-Lauf, weil es keinen Anschluss gibt.

## Lieferbeleg

Fassung und Lieferbeleg dieser Klärung entstehen erst mit der Veröffentlichung. Vorher ist nur der
Bestand an Basis `81f9152d` belegt (Quelleninspektion oben, Tests unverändert).
