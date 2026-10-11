# Vorlage — Unterrichtung nach Artikel 4 KI-Verordnung für Ihren Betrieb

**Mitgeliefert mit KLARWERK · abgeleitet aus `docs/compliance/unterrichtung-artikel-4.md`, Teil 2 und 3 ·
Bezugsfassung des Produkthinweises: `2026-07-30.1`**

## Vorweg — für die Person, die diese Vorlage anpasst

Wer KLARWERK im eigenen Betrieb einsetzt, ist **Betreiber** im Sinne von Artikel 3 Nummer 4 der
KI-Verordnung und unterliegt Artikel 4 (KI-Kompetenz) in eigener Verantwortung — für das eigene
Personal und für Personen, die im eigenen Auftrag mit dem System arbeiten. Diese Pflicht kann der
Hersteller nicht für Sie erfüllen. Diese Vorlage nimmt Ihnen das Schreiben ab; Anpassen,
Aushändigen und Nachweisen bleibt bei Ihnen.

**So benutzen Sie die Vorlage:**

1. Ersetzen Sie jede Stelle `[[ANPASSEN: …]]` durch die Angabe Ihres Betriebs. Setzen Sie nichts
   ein, was nicht stimmt — ein erfundener Nachweis ist schlechter als keiner.
2. Prüfen Sie den Abschnitt „Wohin Ihre Eingaben gehen" gegen Ihre Installation: ob ein
   Cloud-Modell aktiv ist und bei welchem Anbieter, entscheidet Ihr Betrieb, nicht diese Vorlage.
3. Ergänzen Sie, wo nötig, Ihre eigenen Regeln (zum Beispiel interne Freigabewege). Streichen Sie
   nichts aus den Abschnitten „Woran Sie eine schwache Antwort erkennen", „Was nicht in eine Frage
   gehört" und „Wenn Sie einen Fehler finden" — sie tragen den Kern der Pflicht.
4. Händigen Sie den Abschnitt „Die Unterrichtung" vor der ersten eigenen Nutzung aus und lassen Sie
   den Nachweis ausfüllen. Bewahren Sie ihn auf.

**Die Bezugsfassung:** Der Hinweis, den KLARWERK jeder Person beim Einstieg zeigt, trägt eine
Fassungskennung (oben genannt). Steigt diese Kennung mit einem Produktupdate, hat sich der Hinweis
geändert — prüfen Sie dann, ob Ihre angepasste Unterrichtung noch passt, und unterrichten Sie
gegebenenfalls neu.

**Grenze:** Diese Vorlage ist keine Rechtsberatung. Ob eine gelesene und gegengezeichnete
Unterrichtung für Ihren Betrieb genügt oder eine Schulung mit Wissenskontrolle erwartet wird, klären
Sie mit Ihrer eigenen Rechtsberatung.

---

## Die Unterrichtung

*Ab hier wird die unterrichtete Person angesprochen.*

### Worum es geht

In [[ANPASSEN: Name Ihres Betriebs]] arbeiten wir mit KLARWERK. KLARWERK enthält künstliche
Intelligenz. Sie hilft beim Beantworten von Fragen, beim Führen eines Interviews und beim
Beschreiben von Bildern, und sie unterstützt bei kleineren Handgriffen wie dem Ordnen oder Auswählen
von Vorschlägen. Sie sollen wissen, was diese KI tut, was sie nicht tut, und woran Sie merken, dass
Sie besser nachsehen.

### Was das System tut

Es beantwortet Fragen **aus dem Wissen, das Ihre Kolleginnen und Kollegen eingetragen haben** — und
nur daraus. Es greift nicht auf allgemeines Modellwissen zurück. Fehlt die Grundlage im Bestand,
sagt es das, statt zu raten. Zu jeder Antwort sehen Sie, welche Quellen herangezogen wurden und
welche davon die Antwort getragen haben.

### Wo seine Grenzen liegen

Es prüft nicht, ob eine Quelle **sachlich richtig** ist. Es zeigt Ihnen, wie belastbar eine Quelle
ist — validiert oder offen, mit einem Vertrauenswert —, und schreibt dazu ausdrücklich hin:
Vertrauen und Nutzbarkeit sind **kein Wahrheitsversprechen**. Es kann sich irren, wenn eine Quelle
mehrdeutig ist oder zwei Quellen einander widersprechen. Und es kann eine Lücke melden, obwohl die
Antwort im Bestand liegt — etwa weil ein Wort anders geschrieben ist als in Ihrer Frage.

### Woran Sie eine schwache Antwort erkennen

**Erstens am Zustand der Quellen:** steht dort „offen" statt „validiert", hat noch niemand bestätigt,
dass es stimmt. **Zweitens an der Zahl darunter:** „drei Quellen herangezogen" heißt herangezogen,
nicht bestätigt — welche die Antwort getragen haben, ist eigens gekennzeichnet. **Drittens daran,
dass eine Zuordnung fehlt:** sagt das System, es habe die tragenden Quellen nicht zuordnen können,
ist die Antwort unbelegt — dann gilt sie als Hinweis, nicht als Auskunft.

Der einfachste Prüfstein: **öffnen Sie die Quelle.** Steht dort nicht, was die Antwort behauptet,
ist die Antwort falsch, egal wie sicher sie klingt.

### Wann Sie nachprüfen müssen

Immer, wenn aus der Antwort eine Handlung folgt, die jemandem schaden kann oder Geld kostet:
Wartungsfristen, Grenzwerte, Reihenfolgen bei sicherheitsrelevanten Arbeiten, Freigaben, Zusagen an
Kunden. [[ANPASSEN: weitere Fälle, in denen in Ihrem Betrieb immer nachzuprüfen ist, oder diesen Satz streichen]]

### Was nicht in eine Frage gehört — verboten

**Gesundheitsdaten, Personaldaten Dritter, Zugangsdaten, Passwörter, Schlüssel.** Vertrauliche
Inhalte gehören ausschließlich in Wissensobjekte, deren Vertraulichkeitsstufe entsprechend gesetzt
ist — das System kennt drei Stufen: intern, vertraulich und streng vertraulich. Eine Frage ist kein
Wissensobjekt und trägt diese Stufe nicht. [[ANPASSEN: weitere in Ihrem Betrieb verbotene Inhalte, oder diesen Satz streichen]]

### Wohin Ihre Eingaben gehen

[[ANPASSEN: Ist in Ihrer Installation ein Cloud-Modell aktiv, nennen Sie hier Anbieter und Ort der Verarbeitung — zum Beispiel: „Der Text Ihrer Frage samt der herangezogenen Quellen verlässt unser System und wird bei <Anbieter> in <Land> verarbeitet." Ist keines aktiv, schreiben Sie das.]]
An jeder KI-Fläche steht ein Satz, der darauf hinweist, und die Stelle, an der ein Klick eine echte,
kostenpflichtige Anfrage auslöst, ist als solche gekennzeichnet. Für Objekte mit gesetzter
Vertraulichkeit gibt es eine Sperre gegen die Übermittlung an ein Cloud-Modell.

### Ein von der KI erzeugter Text bleibt erkennbar

Was die KI formuliert hat, ist gekennzeichnet — auf dem Bildschirm, in der Schnittstellenantwort und
in den Exporten, die dafür einen Weg haben. Geben Sie so einen Text weiter, geben Sie die
Kennzeichnung mit: die nächste Person soll wissen, dass eine fachliche Prüfung noch aussteht.

### Wenn Sie einen Fehler finden — melden

Melden Sie ihn, und zwar an [[ANPASSEN: Person oder Stelle, an die gemeldet wird, und auf welchem Weg]].
Eine falsche Quelle
trägt sonst weiter falsche Antworten — bei allen anderen auch. Das System korrigiert sich nicht von
selbst.

### Der eine Satz, der bleiben soll

**Die KI beschafft Ihnen die Stelle. Ob die Stelle stimmt, entscheiden Sie.**

---

## Nachweis

*Eine Seite, die ausgefüllt und aufbewahrt wird.*

**Gegenstand:** Unterrichtung über den Einsatz künstlicher Intelligenz in KLARWERK nach Artikel 4
der Verordnung (EU) 2024/1689.

**Bezugsfassung des Produkthinweises:** `2026-07-30.1`

**Eigene Fassung dieser Unterrichtung:** [[ANPASSEN: Ihre Fassungs- oder Datumskennung der angepassten Unterrichtung]]

**Betreiber:** [[ANPASSEN: vollständige Firmenbezeichnung]]

**Verantwortlich für die Unterrichtung:** [[ANPASSEN: Name der verantwortlichen Person]]

**Form:** schriftliche Unterrichtung, gelesen vor der ersten eigenen Nutzung; Rückfragen beantwortet
durch [[ANPASSEN: Person oder Stelle]].

**Unterrichteter Kreis** — je Person Name, Rolle, Datum und Bestätigung:

| Name | Rolle | Datum | Unterschrift |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

**Bestätigung der unterrichteten Person:** *Ich habe die Unterrichtung in der oben genannten
Fassung gelesen. Ich weiß, dass Antworten der KI falsch sein können, woran ich das erkenne, wann ich
nachprüfen muss, was nicht in eine Frage gehört und wohin ich Fehler melde.*

**Aufbewahrung:** [[ANPASSEN: Ort und Dauer der Aufbewahrung]]
