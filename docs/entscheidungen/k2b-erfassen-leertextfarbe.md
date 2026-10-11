# K2b Teil 4 — die Leertextfarbe der Klara-Erfassen-Fläche

*Aufnahme 20260922 · `k2b-konkreter-rest` (Arbeitsart Klärung), Basis `863a0974`. Dieses Dokument
legt den verbliebenen Umfang fest; es führt ihn nicht aus. Am Produkt ist nichts geändert. Den
Abgleich hält `tests/k2b-restabgleich/leertextfarbe-abgleich.test.ts` (A–D) fest.*

## Ergebnis in einem Satz

`#9AA2B1` ist als Token `--hint` schon vorhanden. Die Erfassen-Fläche nutzt ihn nur nicht: der
eine Satz ohne Markierung steht in `--muted`. Die Bedingung aus Entscheidung 2 ist durch die
LIVE-Strecken 3801 und 4337 erfüllt. Offen bleibt ein Umfang aus einer Zeile CSS, zwei
Testanpassungen und einer menschlichen Sichtung (R1–R5 unten), dazu die Kontrastfrage (E1).

## 1. Originalanforderung, Oberfläche, Farbwert (K1)

| Gegenstand | Belegstelle | Befund |
|---|---|---|
| Originalzeile | `PRIORITAETEN.md:14312` (`PRIORITAETEN:14311:K2b`, Zeilen-SHA `1209c846…`), im Produktbaum wiedergegeben in `tests/erfassung-einstieg/README.md`, Zeile `priority:K2b` | „Klara Erfassen nach Mockup: Bereich-Zeile, „?"-Menü, Dokumentlink, Leertextfarbe `#9AA2B1`". Teile 1–3 sind geliefert (JOB 3555 `tests/k2b-bereich-zeile`, JOB 3506 `tests/k2b-erfassen-reste`), Teil 4 ist offen. |
| Sollwert | Mockup `design/klara/Erfassen.dc.html`, Auftrag JOB 3057 §5.1; im Produktbaum `tests/design/zielbild-k2-erfassen.test.ts:730-735` | Der eine Satz ohne Markierung, 15px, Farbe `#9AA2B1`. Bisher als OFFENER Wert gemessen, nicht angeglichen. |
| Nutzerweg | Word → Klara-Panel → Reiter „Erfassen“, **ohne Markierung**: `taskpane.js:4009` `renderCapture` zeigt `#capture-leer` (`taskpane.html:262`) | Wortlaut `captureEmpty`: DE „Markiere Text in Word.“ (`taskpane.js:1561`), EN `:2025`, NL `:2365`. Das ist die einzige Bedienanweisung im leeren Zustand. |
| Istfarbe | `taskpane.css:403` | `#capture-leer { … color: var(--muted); }` → `#525B6B` (`taskpane.css:22`). |
| Vorhandener Wert | `taskpane.css:25` | `--hint: #9AA2B1` existiert schon (JOB 3056) und wird von `#ask-ruhe-satz` (`:204`), `#ask-input::placeholder` (`:287`), `.einst-wert svg` (`:678`) und `#kw-stand-zeile` (`:710`) genutzt. Er ist als Mockup-Ausnahme gebunden: `tests/app/mega43-klara-werkbank-palette.test.ts:339-348`. |
| Kontrast | Test C (nachgerechnet aus denselben Token) | Auf dem Kartengrund `--surface` `#FFFFFF` (`.card`, `taskpane.css:136`): `--hint` ≈ 2,57:1 (unter AA 4,5:1), `--muted` über AA. |

**Berichtigung:** In `tests/erfassung-einstieg/README.md` (Zeile `priority:K2b`) steht als Ort von
`--hint` noch `taskpane.html:48`. Seit der Stil ausgelagert ist, liegt der Wert in `taskpane.css:25`.
Dort ist jetzt ein Nachtrag angefügt.

**Nicht Teil von Teil 4:**
- Der Chevron der Bereich-Zeile (`taskpane.css:411-417`) ist ein natives `<select>`. Die Farbe des
  Chevrons zeichnet der Host.
- Der Platzhalter des Web-Blatts (`placeholder:text-muted-2/60`, H3) folgt
  `design/klarwerk/Erfassen.dc.html` und nicht dem Klara-Mockup.

## 2. Vorbehalt aus Entscheidung 2 und der LIVE-Nachweis (K2)

- **Vorbehalt:** Entscheidung 2 (`gespraech/uebernahme-claude-20260920/ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md`,
  SHA `08915cee…`) knüpft Teil 4 an die Bedingung `DEMO-ERSTER-NUTZERWEG` LIVE (Pedi: „nicht vor der
  Vorführung“).
- **Zugeordnete LIVE-Belege:**
  - **JOB 3801**, `archiv/3801/zustand.json` (SHA `5b3d60de…`). Strecke: leer → Konto → Quelle →
    Entwurf → auffindbar, an der API im selben Prozess. Im Produktbaum:
    `tests/demo-erster-nutzerweg/durchstich.test.ts:377`.
  - **JOB 4337**, `archiv/4337/zustand.json` (SHA `42742ca2…`). Strecke: echte PostgreSQL, eigener
    Serverprozess, Chromium mit zwei Profilen, Import → Einreichen → Fremdprüfung → Freigabe →
    Suche → Neustart. Im Produktbaum:
    `tests/demo-nutzerweg-pg-browser/demo-nutzerweg-pg-browser.integration.test.ts:216`.
- **Zuordnung:** Die Bedingung ist erfüllt. Teil 4 ist durch Entscheidung 2 nicht mehr gesperrt.
- **Grenze der Zuordnung:** Beide Strecken fahren die Web-App, nicht das Word-Panel (Test D). Sie
  beweisen deshalb nichts über die Farbe. Umgekehrt kann eine Änderung an `#capture-leer` den
  Demoweg nicht berühren.
- **Herkunft der Angabe LIVE:** Sie stammt aus Auftrag und Quellen (Archivdateien mit SHA). Die
  Archivdateien liegen außerhalb des Produktbaums und sind in diesem Lauf nicht erneut gelesen.

## 3. Verbleibender Umfang mit messbarem Soll (K3)

Erfüllt ist Teil 4 heute nicht: Test B misst `var(--muted)` an `#capture-leer`. Der Rest ist auf
diese Punkte begrenzt.

| Nr. | Änderung | Messbares Soll |
|---|---|---|
| R1 | `taskpane.css:403`: `color: var(--hint)` statt `var(--muted)`. Kein neues Literal, kein neuer Token. | Test A bleibt grün (genau ein `#9AA2B1` im Stil). Test B misst `var(--hint)`, und die Liste der Erfassen-Regeln mit `--hint` ist genau `["#capture-leer"]`. |
| R2 | `tests/app/mega43-klara-werkbank-palette.test.ts` `REGEL_AUSNAHMEN`: Eintrag `#capture-leer` mit Grund (Mockup §5.1, 2,57:1 auf `--surface`, wie `#ask-ruhe-satz`). | Der Kontrastsammler bleibt grün. Ohne den Eintrag schlägt er zu Recht an. |
| R3 | `tests/design/zielbild-k2-erfassen.test.ts`: OFFEN-Zeile „§5.1 Farbe“ wird scharfer Fall J. | `getComputedStyle(#capture-leer).color === "rgb(154, 162, 177)"` in Chromium bei 360 px. |
| R4 | `tests/k2b-restabgleich/leertextfarbe-abgleich.test.ts` B auf das neue Soll umstellen (nicht löschen). | wie R1. |
| R5 | Abnahme durch einen Menschen am installierten Word-Panel, ohne Markierung, DE/EN/NL. | Der Satz ist lesbar, und die Sichtung ist mit Fassung belegt. Das ist nicht maschinell ersetzbar. |

**E1 — offene Entscheidung vor R1.** Gemeint ist kein neuer Farbauftrag, sondern die
Kontrastfrage. `#9AA2B1` liegt auf Weiß unter AA. Der Satz ist die einzige Bedienanweisung des
leeren Zustands und kein Schmucktext. Die anderen `--hint`-Stellen tragen dieselbe Abweichung als
„Eigentümer-Vorgabe“.

- **Empfehlung:** `--muted` beibehalten und Teil 4 als begründete, benannte Abweichung schließen.
  Dann entfallen R1–R4. Soll: Die OFFEN-Zeile in `zielbild-k2-erfassen.test.ts` nennt
  „bewusst abweichend, Entscheidung …“, und Test B bleibt unverändert.
- **Wenn das Mockup gilt:** R1–R5 wie oben.
