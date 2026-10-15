# R-1058 · Klarwerk Lite und die Seiten der Investor-Demo — offene Produktentscheidung

*Aufnahme 20260922 · gesamt-klarwerk-lite (`aufnahme:20260922:gesamt-klarwerk-lite`), Basisstand
`81f9152d` (1.0.0-beta.1.952). Diese Seite hält die offene Frage, ihre Alternativen und den heutigen
Bestand fest. Sie **entscheidet nichts** und ändert weder den Wortlaut des Originalpunkts noch die
Kriterien des Auftrags.*

## Die Quellen, wörtlich und unverändert

| Quelle | Wortlaut | Stand |
| --- | --- | --- |
| Originalpunkt R-1058 (Alias F-1058), Register-Schnappschuss `$.eintraege[1057]` | „Eine bewusst reduzierte Ausgabe der Anwendung mit wenigen Seiten (Fragen, Einblicke, Wissen, Prüfen, Beibringen), die es in der Pitch-Demo gab. Ob sie ins Produkt gehört, ist offen." | Zustand `angedacht`, Prüfstatus `nur_altquelle`, Altbestand-Status `IDEE`, aktualisiert 05.09.2026 |
| Notiz am Altbestand F-1058 | „Ebenso offen: Boardroom-, Pitch- und Hub-Seiten aus der Investor-Demo." | Gehört zum selben Originalpunkt |
| Herkunft (`FUNKTIONSREGISTER.json:24475`, 23.06.2026) | „Frontend-Gesamtübersicht §9 (nur in der Demo) und §12, offene Entscheidung 2: Lite-Variante und Boardroom-/Pitch-Seiten ins Produkt übernehmen oder weglassen — unbeantwortet." | Historisch; heutige Erfüllung dort ausdrücklich nicht erneut geprüft |
| [`Frontend-Gesamtuebersicht.md`](../../Frontend-Gesamtuebersicht.md) §9 | Lite-Bausteine `LiteLayout, LiteAsk, LiteInsights, LiteKnowledge, LiteReview, LiteTeach`; Investor-Front-Door `Pitch`, `site/Site`, `boardroom/Boardroom`, `Hub`, `Highlights`, `Tomorrow`, `MarketAnalysis`, `ProcessFlow`, `flow/FlowApp`; „Entscheidung nötig: Gehört etwas davon ins Produkt (z. B. ‚Lite'-Modus, Boardroom-Ansicht) oder ist es reines Pitch-Material?" | Inventur des Altbestands, 23.06.2026 |
| [`Frontend-Gesamtuebersicht.md`](../../Frontend-Gesamtuebersicht.md) §12 Frage 2 | „‚Lite'-Variante & Boardroom/Pitch-Seiten: ins Produkt übernehmen oder weglassen?" | Unbeantwortet |

Eine Nutzerentscheidung zu dieser Frage ist im Originalpunkt **nicht** enthalten: `entscheidung`
ist `null`, `entscheidungen` ist leer, `pedi_override` und `override_am` sind `null`. Im
Arbeitsbaum gibt es keine weitere Fundstelle zu R-1058/F-1058, zur Lite-Variante oder zur
Boardroom-Ansicht.

## Abgleich mit dem heutigen Bestand (Quelleninspektion am Basisstand)

| Frage | Befund | Wo nachgesehen |
| --- | --- | --- |
| Gibt es Lite-Seiten im Produkt? | **Nein.** Keine Komponente `Lite*`, keine Route, kein Schalter. | `apps/web/src/**`, Routenregister `GUARDED_ITEMS`/`FOOT_ITEMS` in `apps/web/src/app/navigation.ts` |
| Gibt es Boardroom-, Pitch-, Hub- oder andere Investor-Seiten im Produkt? | **Nein.** Keine der in §9 genannten Komponenten und keine passende Route. | wie oben |
| Liegt der Demo-Code im Repository? | **Nein.** `demo/` enthält nur `testimports/`. Die Inventur nennt `Klarwerk/demo/` als Quelle; dieser Bestand ist hier nicht vorhanden. | `demo/` |

Der Befund zu den beiden ersten Zeilen ist zusätzlich als ausführbarer Test festgehalten:
`tests/entscheidungen-r1058/lite-offen.test.ts`. Er prüft nur, dass die Entscheidung im Produkt
**nicht vorweggenommen** ist, und muss bei einer späteren Entscheidung für eine Übernahme bewusst
angepasst werden.

## Was es heute schon in der Nähe gibt (abgegrenzt, keine Lite-Variante)

Die fünf Seitennamen aus R-1058 haben im heutigen Produkt Gegenstücke in der gewöhnlichen
Navigation. Die Zuordnung ist eine **Annahme nach Namen**; belegt ist nur der Hinweis in §5.8 der
Gesamtübersicht, dass der Wissensgraph „auch in ‚Lite → Insights' eingebettet" war.

| Lite-Seite (R-1058 / §9) | Heutiges Gegenstück | Mindestrolle |
| --- | --- | --- |
| Fragen (`LiteAsk`) | `/fragen` | viewer |
| Einblicke (`LiteInsights`) | `/wissensnetz`; Wissensgraph `/graph` und Kennzahlen `/analytics` | viewer bzw. admin (`/graph` hinter Stufe 2) |
| Wissen (`LiteKnowledge`) | `/bibliothek` mit `/wissen/:id` | viewer |
| Prüfen (`LiteReview`) | `/validierung` | controller |
| Beibringen (`LiteTeach`) | `/erfassen` | experte |

Weitere vorhandene Lieferungen, die eine „reduzierte" oder vorführbare Fläche berühren, aber
gesonderte Aufträge bzw. abgeschlossene Teilumfänge sind und hier **nicht** erneut bearbeitet werden:

- **Rollengebundene Navigation:** Jeder Menüpunkt trägt eine Mindestrolle (`minRole` in
  `navigation.ts`); eine Betrachterin sieht damit schon heute nur Start, Fragen, Bibliothek,
  Wissensnetz und Extern in den Menügruppen (dazu Hilfe und Profil). Das ist Rechtevergabe,
  keine vereinfachte Produktausgabe.
- **Stufe-2-Gruppe „erweitert"** (`/output`, `/import`, `/graph`, `/kapital`) trägt
  `stufe2: true` und ist nur für Admins vorgesehen.
- **Anonyme Vorführung** `/vorfuehrung` mit erfundenen Inhalten — R-0570, Auftrag
  `aufnahme:20260922:gesamt-anmeldung-sitzungen`, siehe [`r0570-anonymer-zugang.md`](r0570-anonymer-zugang.md).
- **Geführter Stage-1-Demo-Pfad** für Pedi/Investor — [`docs/demo/stage-1-demo-path.md`](../demo/stage-1-demo-path.md).
- **Investoren-Auszug „Vertrauen & Sicherheit"** — SCRUM-432, `docs/qm/claude-after-report.md`.

## Alternativen, über die zu entscheiden ist

**Frage A — Klarwerk Lite (Fragen, Einblicke, Wissen, Prüfen, Beibringen):**

1. **Weglassen.** Lite bleibt Pitch-Material; R-1058 wird mit dieser Entscheidung als verworfen
   geschlossen. Nichts zu bauen.
2. **Ansichtsmodus im Produkt.** Ein Schalter (je Konto oder je Installation) reduziert die
   Navigation auf die fünf Gegenstücke oben; die Seiten selbst bleiben die heutigen. Offen wären dann:
   wer schaltet, gilt er für alle Rollen, und was geschieht mit Aufgaben, Konflikten und Lebenszyklus.
3. **Eigene Produktausgabe.** Eigene Hülle (`LiteLayout`) mit eigenen, vereinfachten Seiten — eine
   zweite Oberfläche neben der heutigen, mit eigenem Pflegeaufwand für Sprache, Rollen und Tests.
4. **Nur für Vorführungen.** Lite als Teil der Vorführung, nicht als Arbeitsfläche für Kunden.

**Frage B — Boardroom-, Pitch- und Hub-Seiten der Investor-Demo:**

1. **Weglassen** (reines Pitch-Material, gehört in Deck oder Website).
2. **Außerhalb des Produkts** als Website oder Vorführung, getrennt vom Wissensbestand.
3. **Boardroom als Management-Sicht im Produkt** — dann wäre das Verhältnis zu `/kapital` und
   `/analytics` zu klären.

**Frage C — die übrigen in §9 genannten Demo-Teile** (`Site`, `Highlights`, `Tomorrow`,
`MarketAnalysis`, `ProcessFlow`, `FlowApp`, Demo-Charts) stehen in derselben offenen Entscheidung
der Gesamtübersicht, sind aber in R-1058 nicht einzeln genannt. Ob sie mit Frage B fallen, ist
ebenfalls zu entscheiden.

**Noch erforderlich:** eine ausdrückliche Entscheidung des Produktverantwortlichen (Pedi) zu A und
B, sinnvollerweise mit C. Erst danach gibt es einen bestellten Umsetzungsumfang.

## Was diese Lieferung umsetzt und was nicht

- **Umgesetzt:** diese Entscheidungsvorlage, ein Verweis darauf in §9 und §12 der
  Gesamtübersicht und der Test, der den heutigen Befund festhält.
- **Nicht umgesetzt, weil nicht bestellt:** keine Lite-Seite, kein Ansichtsmodus, keine Boardroom-,
  Pitch- oder Hub-Seite. Der Originalpunkt bestellt keinen eindeutigen Bauanteil; jede der
  Alternativen 2–4 bzw. B2–B3 wäre eine vorweggenommene Entscheidung.

## Quellenwidersprüche und fehlende Belege

1. **„Alte Pedi-Auswahl" ohne Inhalt.** Der Hinweis am Originalpunkt sagt: „Auch eine alte
   Pedi-Auswahl bleibt unten als historische Entscheidung erhalten." Der Punkt enthält aber keine
   solche Auswahl (`pedi_override: null`, `override_am: null`, `entscheidung: null`,
   `entscheidungen: []`). Die erwähnte historische Entscheidung ist in den zugeordneten Quellen
   **nicht auffindbar**.
2. **Demo-Code fehlt.** Der damalige Funktionsumfang von Lite und den Investor-Seiten ist nur durch
   die Inventur beschrieben; der Quellcode (`Klarwerk/demo/`) liegt nicht im Repository und konnte
   nicht eingesehen werden. Der damalige Zustand ist ohnehin kein heutiger Funktionsnachweis.
3. **Umfang der Investor-Seiten uneinheitlich.** R-1058 nennt Boardroom, Pitch und Hub; die
   Herkunftszeile nennt „Boardroom-/Pitch-Seiten" (ohne Hub); §9 nennt neun Front-Door-Bausteine plus
   Charts. Siehe Frage C.
4. **Registerbeleg ohne Zeit.** Der einzige Beleg (`art: altquelle`) trägt `zeit: null` und liegt
   außerhalb des Arbeitsbaums (`FUNKTIONSREGISTER.json:24475`); er wurde hier nicht eingesehen.
5. **Lieferbeleg mit Fassung** entsteht erst mit der Veröffentlichung dieses Kandidaten und ist
   hier noch offen.
