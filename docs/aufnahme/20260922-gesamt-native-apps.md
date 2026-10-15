# Aufnahme 20260922 · Gesamt-Native-Apps: Umfangsfrage, Einordnung, Stand

Auftrag `aufnahme:20260922:gesamt-native-apps` („Aufgenommenen Ausbau zu nativen Mobil-Apps
konkretisieren“), Lauf 1 vom 13.10.2026 auf Basis `81f9152d` (`1.0.0-beta.1.952`). Die Fassung, in
der dieser Lauf ausgeliefert wird, steht erst nach der Veröffentlichung fest. Bis dahin ist mit
„dieser Lauf“ der Kandidat auf dieser Basis gemeint.

Die Anliegen stammen aus `QUELLEN.json` des Auftrags (`original_points`): **R-1052** (einziger
Punkt nur dieses Auftrags) und **R-2193** (Sammelpunkt, den sich sieben Aufträge teilen).

Dieser Lauf baut nichts. Er dokumentiert die Frage und den Stand. Die Entscheidung trifft er nicht.

## 1. Abgrenzung

- **Nicht in diesem Auftrag:** Aus R-2193 gehören Drittsystem-Konnektoren, BI,
  Selbstbedienungs-Mandanten und Gamification zu den gesonderten Aufträgen
  `aufnahme:20260922:gesamt-adoption`, `…-anlagendaten-abgleich`, `…-bi-anbindung`,
  `…-chat-import`, `…-email-eingang` und `…-instanztrennung`. Hier wird nur der Teil „Native
  Store-Apps“ behandelt. Bestellt wird damit nichts neu.
- **Vorhandene, abgeschlossene Teilumfänge** (die installierbare Web-App) stammen aus früheren
  Aufträgen (SCRUM-222 Service Worker, gesonderter Auftrag mobile-erfassung). Dieser Lauf nutzt sie
  als Bestand, baut sie aber nicht neu (siehe §4).

## 2. Offene Geltungs-/Umfangsfrage (K1)

**Frage:** Bleiben eigene Apps für den Apple App Store und Google Play ausgeschlossen, oder sind sie
ein späterer Ausbau über die installierbare Web-App hinaus?

Jüngste Belege, die im Produktbaum nachprüfbar sind:

- `specs/reference/Pflichtenheft.md` §1 nennt unter „Out of Scope (Stand v1)“ ausdrücklich „native
  App-Store-Apps“. §6 „Out of Scope (v1)“ beginnt mit „Native Store-Apps“.
- `specs/stories/mobile.md` führt unter „Nicht-Ziele (v1)“: „Native Store-Apps (Out of Scope §6)“.
- Die laufende Produktlinie ist `1.0.0-beta.1.952`, also noch v1. Damit gilt der v1-Ausschluss für
  den heutigen Stand weiter.
- R-2193 (Register 05.09.2026, `pruefstatus: geprueft`, Beleg „entscheidung“): „Bewusst außerhalb
  v1“. Der Hinweis dazu lautet: „Gilt nur für den im Wortlaut genannten Umfang beziehungsweise v1;
  kein generelles Verbot späterer Erweiterung.“
- R-1052 / Altbestand F-1052 (Herkunft 14.06.2026): Status `VERWORFEN`, Begründung „Die
  installierbare Web-App deckt den mobilen Bedarf ab.“ Im heutigen Register steht der Punkt auf
  `zustand: angedacht` und `pruefstatus: nur_altquelle`.

Konkrete Alternativen:

| | Alternative | Folge |
|---|---|---|
| A | **Dauerhaft verworfen:** Die Web-App bleibt der einzige mobile Weg, wie F-1052 sagt. | R-1052 wird als verworfen geschlossen. Es entsteht kein Ausbauauftrag. |
| B | **Nur für v1 ausgeschlossen, als späterer Ausbau vorgemerkt:** So liest sich R-2193. | R-1052 bleibt ein angedachter Punkt nach v1. Umgesetzt wird jetzt nichts. Ein späterer Auftrag bräuchte dann eigene Zielzustände, etwa welche Plattformen, welche Funktionen über die Web-App hinaus und wie verteilt wird. |
| C | **Schon jetzt in den Umfang:** Eigene Store-Apps werden Teil der laufenden Lieferung. | Dafür müssten Pflichtenheft §1/§6 und `specs/stories/mobile.md` geändert werden. Diese Alternative widerspricht dem geltenden v1-Ausschluss. |

**Noch erforderliche Entscheidung (Pedi):** zwischen A, B und C wählen. Alternative B ist
zusätzlich davon abhängig, welcher Bedarf über die Web-App hinausgeht. Die Quellen nennen diesen
Bedarf nicht.

**Eindeutig bestellter Anteil:** nur diese Dokumentation. Keine der drei Alternativen bestellt eine
Umsetzung, solange die Entscheidung fehlt. Dieser Lauf baut deshalb keine App, keine App-Hülle und
keine Store-Anbindung.

## 3. Klärung R-1052 (K2)

R-1052 lautet: „Eigene Apps für Apple App Store und Google Play statt der installierbaren Web-App.“
Zu klären war „Altbestand: Einordnung offen“.

- **Einordnung:** Der Punkt ist ein Vorschlag aus dem Altbestand. Er war für v1 ausgeschlossen und
  wurde im Juni 2026 verworfen (F-1052). Er ist kein Funktionsversprechen und kein gelieferter
  Stand. Ob er endgültig verworfen ist oder später kommt, ist die offene Entscheidung aus §2.
- **Heutiger Stand im Produktbaum, durch Quelleninspektion in diesem Lauf geprüft:**
  - Es gibt kein natives Projekt. Unter `apps/` liegt nur `apps/web`, ohne `android/`, `ios/` oder
    `capacitor.config.*`.
  - `apps/web/package.json` hat keine Abhängigkeit auf Capacitor, Cordova, React Native oder Expo.
  - Ausgeliefert wird die installierbare Web-App: `apps/web/public/manifest.webmanifest` mit
    `display: standalone` und `apps/web/public/sw.js`.
- **„Alte Pedi-Auswahl“:** In der zugeordneten Quelle gibt es keine. `pedi_override` ist `null`,
  `override_am` ist `null`, `entscheidung` ist `null` und `entscheidungen` ist leer. Die Hinweiszeile
  „Auch eine alte Pedi-Auswahl bleibt unten als historische Entscheidung erhalten“ ist ein
  allgemeiner Textbaustein des Altbestands. Für R-1052 belegt sie keine Pedi-Entscheidung (siehe §5,
  Widerspruch 3).

## 4. Geliefertes Ergebnis und Belege (K3)

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-1052 / R-2193 eigene Store-Apps | **nicht geliefert, nicht bestellt** (§2) | — | Quelleninspektion dieses Laufs (§3). Festgehalten in `tests/gesamt-native-apps/klaerung-am-bestand.test.ts` |
| Installierbar (Manifest, Icons, Service Worker) | geliefert (vorher) | SCRUM-222 | `tests/capture/sw-rules.test.ts` |
| Mobile Erfassung Notiz/Interview/Foto (FR-MOB-02) | geliefert (vorher), gesonderter Auftrag mobile-erfassung | laut `specs/ERFUELLUNGSSTAND.md` | `tests/mobile-erfassung/notiz-interview-foto-mounted.test.tsx` |
| In-App-Bestätigung mobil (FR-MOB-03) | teilweise (laut `specs/ERFUELLUNGSSTAND.md`) | — | `tests/capture/mobile-confirm.test.ts` (prüft nur die Hilfsfunktion) |
| „Zum Home-Bildschirm“ liefert Vollbild-App auf echtem Gerät (FR-MOB-01) | **offen**: braucht Bedienung auf einem echten Gerät | — | fehlt |
| Geräteübergreifender Test (NFR-UX-03) | **offen** (Abnahme außerhalb von Tests) | — | fehlt |
| Diese Klärung | dieser Lauf | erst nach Veröffentlichung | dieses Dokument und der Test oben |

## 5. Quellenwidersprüche und fehlende Belege

1. **Zustand:** R-1052 steht im Register auf `angedacht`, der Altbestand F-1052 auf `VERWORFEN`.
   Aufgelöst wird das erst durch die Entscheidung aus §2.
2. **Auftragstext gegen Nutzwert:** Der Titel lautet „Ausbau … konkretisieren“. Als `user_value`
   trägt der Auftrag aber die Verwerfungsbegründung „Die installierbare Web-App deckt den mobilen
   Bedarf ab.“ Der eine Teil setzt einen Ausbau voraus, der andere spricht dagegen.
3. **Pedi-Auswahl:** Laut Hinweis bleibt eine alte Pedi-Auswahl erhalten. Die Quelle enthält aber
   keine (§3). Es fehlt ein Beleg für eine Pedi-Entscheidung zu R-1052.
4. **Geltungsdauer:** F-1052 sagt „verworfen“ ohne zeitliche Grenze. R-2193 sagt „bewusst
   außerhalb v1“ und „kein generelles Verbot späterer Erweiterung“. Das Pflichtenheft schließt nur
   für v1 aus.
5. **„Die Web-App deckt den mobilen Bedarf ab“ ist nur teilweise belegt.** FR-MOB-01 ist am echten
   Gerät nicht nachgewiesen, und für NFR-UX-03 fehlt der geräteübergreifende Test (§4). Die
   Begründung für die Verwerfung ist also selbst nicht vollständig belegt.
6. **Altquellen außerhalb des Produktbaums sind nicht geprüft:**
   `00_CONTROL/FUNKTIONSREGISTER.json:24359` (R-1052), `CODEX-ANALYSE-1.md:126` und
   `KLARWERK-Funktions-Roadmap.md:211–228` (R-2193). Gelesen wurde nur der Wortlaut, den die Quelle
   zitiert. Die Pflichtenheft-Stelle `236–239`, die R-2193 nennt, stimmt mit dem heutigen
   `specs/reference/Pflichtenheft.md` überein.

## 6. Offen nach diesem Lauf

- Entscheidung zwischen A, B und C (§2). Sie liegt bei Pedi und wird hier nicht ersetzt.
- Bedienung auf einem echten Gerät für FR-MOB-01 und ein geräteübergreifender Test für NFR-UX-03.
  Beide gehören zum vorhandenen PWA-Umfang und werden von diesem Auftrag nicht neu bestellt. Sie
  sind hier nur genannt, weil die Verwerfungsbegründung auf ihnen beruht.
