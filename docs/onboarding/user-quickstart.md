# Klarwerk — Nutzer-Schnellstart (Onboarding)

> Kurzanleitung für **Endnutzer**, um selbstständig mit Klarwerk zu starten.
> Technische Doku (Build/Betrieb): `README.md`, `SETUP.md`, `docs/operations/*`.
> Geführter Demo-/Review-Pfad: `docs/demo/stage-1-demo-path.md`.

---

## Was ist Klarwerk?

Klarwerk ist **kein Chatbot**, sondern ein **Wissenssystem** für den ganzen Betrieb: Erfahrungswissen wird erfasst, im Team validiert, quellengebunden genutzt und durch Revalidierung aktuell gehalten. Antworten stammen ausschließlich aus **validiertem Wissen mit Quelle, Vertrauen und Status** — gibt es keine Grundlage, wird die **Wissenslücke ehrlich benannt** statt eine Antwort zu erfinden.

> **The AI may change. Your knowledge never does.**

### Das Bild dahinter: ein Lehrling, der nachfragt

Beim Erfassen fragt Klarwerk nach wie ein Lehrling — du antwortest, statt zu dokumentieren. Was du erklärst, bleibt im Haus, auch wenn du mal nicht da bist.

Wofür das Bild steht und wofür nicht:

- **Gedeckt:** Der Interviewweg beim Erfassen stellt dir Rückfragen. In den Bestand kommt nur, was du selbst einreichst, und erst die Prüfung im Team macht es zu gesichertem Wissen.
- **Nicht gedeckt:** Korrekturen fließen nicht in ein Modell zurück. Was mit der Zeit wächst, ist der geprüfte Bestand, den ihr gemeinsam pflegt — nicht die Software selbst.

---

## In 5 Minuten starten

1. **Anmelden.** Mit deinem Konto einloggen (E-Mail + Passwort) oder per SSO/OIDC, falls vom Betreiber aktiviert. Neue Konten müssen ggf. von einem Admin **freigegeben** werden.
2. **Erste Orientierung auf `/start`.** Die Startseite zeigt den **Wissenskreis** (Erfassen → Validieren → Nutzen → Aktuell halten), einen empfohlenen nächsten Einstieg und Kennzahlen.
3. **Mit Demo-Daten ausprobieren** (für Review/Test): Ein **Admin** kann über `/admin` den **Demo-Datensatz** laden (idempotent, produktionsgeschützt). Danach sind Beispiel-Wissensobjekte, eine Wissenslücke, ein Konflikt und eine fällige Revalidierung sichtbar.
4. **Hilfe öffnen.** Die **Hilfe-Seite** (`/hilfe`) ist der zentrale Einstieg: durchsuchbare Kapitel zu jedem Bereich, jeweils mit Direktlink in die App.

---

## Der Arbeitskreis & wer was darf

| Schritt | Route | Was passiert | Wer darf (Rolle) |
| --- | --- | --- | --- |
| **Capture / Erfassen** | `/erfassen` | Erfahrung formlos festhalten → KI strukturiert einen Entwurf → du prüfst & reichst ein | Experte+ |
| **Validate / Validieren** | `/validierung` | Im Team bewerten: Freigeben / Rückfrage / Ablehnen (Rückfrage & Ablehnung mit Pflichtbegründung) | Controller+ |
| **Use / Nutzen** | `/fragen`, `/bibliothek` | Quellengebundene Antworten; nutzbares Wissen finden und nutzen | alle (Viewer+) |
| **Maintain / Aktuell halten** | `/lebenszyklus` | Bei Anlagenänderungen Revalidierung anfordern und bestätigen | Controller+ |

Lesen/Fragen/Bibliothek stehen allen offen; Erfassen ab **Experte**; Validierung/Konflikte/Risiko/Lifecycle ab **Controller**; Nutzerverwaltung nur **Admin**. Die Sichtbarkeit der Navigation richtet sich nach deiner Rolle; die eigentliche Durchsetzung erfolgt serverseitig.

---

## In-App-Hilfe (zentraler Einstieg)

Unter **`/hilfe`** findest du durchsuchbare Kapitel u. a. zu: Erststart/Demodaten, Erfassen, Fragen, Bibliothek, Validierung, Aufgaben, Risiko/Lücken, Lebenszyklus, Stufe-2 und Mobile/Offline. Jedes Kapitel verlinkt direkt in den passenden App-Bereich. Die Suche arbeitet über Titel, Text und Schlagwörter; bei keinem Treffer wird ein ehrlicher Leerzustand gezeigt.

---

## Beispiele

- **Geführter Demo-Pfad:** `docs/demo/stage-1-demo-path.md` — ein 7–10-Minuten-Klickpfad durch Capture → Validate → Use → Maintain mit konkreten Beispieldaten (Ventil X / Überdruck, Filter F3, Linie L4 / Dosierwert).
- **In der App:** Capture hat „Beispiel laden", Ask hat anklickbare Beispielfragen (mit Erwartung „findet passendes Wissen" vs. „zeigt Wissenslücke").

---

## Grenzen (ehrlich)

- **Quellenbindung statt Bluff:** Antworten kommen nur aus validiertem Wissen mit Quelle/Vertrauen/Status. Ohne Grundlage entsteht eine **Wissenslücke** (kein erfundener Text).
- **KI-Modus:** Ohne konfigurierten Modell-Schlüssel läuft ein **deterministischer Modus** (Antworten = belegte Wissensobjekt-Aussagen, klar als Modus markiert). Mit Modell-Schlüssel der **Modellmodus**. Das Modus-Badge auf `/fragen` zeigt den aktuellen Stand.
- **Demo-Sprache:** Der Demo-Datensatz wird in der Oberflächensprache des ladenden Admins angelegt (Deutsch, Englisch oder Niederländisch). Kategorien und Schlagwörter der Beispiele bleiben deutsch.
- **Mensch entscheidet:** Die KI strukturiert/formuliert nur — Erfassen, Prüfen, Freigeben und Revalidieren bleiben menschliche Entscheidungen.

---

## Datenschutz & Nachvollziehbarkeit (Hinweis, keine Rechtsberatung)

- **Lückenloses Audit-Log:** Jede relevante Aktion (wer/wann/Aktion/Ziel) wird in einem **append-only, hash-verketteten** Log protokolliert; eine nachträgliche Abweichung ist rechnerisch prüfbar (tamper-evident), nicht technisch verhindert — die Kette hat keinen extern verankerten Kopf. Einsicht haben Controller/Admin (Bereich Analytics/Audit).
- **Zugriffsschutz:** Rollen-/Rechtekonzept (RBAC) wird serverseitig erzwungen; keine Geheimnisse/Schlüssel im Browser.
- **Offene Betreiber-Pflichten:** DSGVO-Betroffenenrechte (Auskunft, Löschung, Verarbeitungsverzeichnis) sind **organisatorisch beim Betreiber** umzusetzen und (noch) nicht als Selbstbedienungs-Funktion im Produkt enthalten — siehe Restlücken. Das Audit-Log ist bewusst append-only und hash-verkettet: nachträgliche Abweichungen sind rechnerisch prüfbar (tamper-evident), aber nicht verhindert — die Kette hat keinen extern verankerten Kopf.

---

## FAQ / Support / Feedback

- **Erster Anlaufpunkt:** die **Hilfe-Seite** (`/hilfe`) mit Suche. Ihre Kapitel sind zugleich die FAQ des Produkts; daran ändert der Supportkontakt nichts.
- **Supportkontakt dieser Installation (R-1064):** Die Hilfe-Seite zeigt oben die Karte **„Support dieser Installation“**. Der Support-Weg wird weiterhin **pro Instanz organisatorisch festgelegt** — das Produkt bringt keine Adresse mit und belegt keine vor. Die Karte zeigt genau einen von vier Zuständen:
  - **eingerichtet** — der vom Betreiber hinterlegte Weg als Link, darunter das Ziel im Klartext;
  - **nicht eingerichtet** — der Satz, dass für diese Installation noch kein Supportweg hinterlegt ist (kein Ersatzkontakt);
  - **ungültig** — ein Wert ist gesetzt, wird aber nicht ausgeliefert (siehe Regeln unten);
  - **nicht ladbar** — der Abruf ist gescheitert; die übrige Hilfe und die Suche bleiben bedienbar.
- **Rückmeldung:** Verbesserungswünsche/Fehler an den jeweiligen Klarwerk-Betreiber/Admin der Instanz — bzw. über den dort hinterlegten Supportweg.

### Für Betreiber: Supportkontakt hinterlegen

Zwei **optionale** Umgebungswerte der App. Keiner ist Pflicht für den Start; ohne sie zeigt die Hilfe „nicht eingerichtet“.

| Variable | Inhalt | Pflicht |
|---|---|---|
| `KLARWERK_SUPPORT_URL` | Ziel des Supportwegs: eine `https://…`-Adresse **oder** `mailto:<adresse>` | nein |
| `KLARWERK_SUPPORT_LABEL` | sichtbarer Name des Wegs, z. B. „IT-Servicedesk“ (höchstens 80 Zeichen) | nein |

- **Gesetzt wird auf dem bestehenden Weg der übrigen Betreiberwerte:** im Coolify-Betrieb als Environment-Variable der App-Ressource (`docs/operations/deploy-hetzner.md` §2, Punkt 3). Wirksam erst mit einem neuen App-Prozess (Neustart/Redeploy) — gelesen wird beim Aufbau der App.
- **Ein-Befehl-Weg (`docker-compose.prod.yml`):** Diese Datei reicht Werte nur über ihren `environment`-Block durch. Ein Eintrag in der `.env` wirkt dort nur, wenn beide Namen in diesem Block durchgereicht werden.
- **Erlaubt sind nur:** `https:`-Adressen ohne eingebettete Zugangsdaten und `mailto:` mit genau einer schlichten Adresse (Buchstaben, Ziffern, `._+-` vor dem `@`; keine `?subject=`/`?bcc=`-Zusätze, keine Empfängerliste). Alles andere — z. B. `http:`, `javascript:`, `data:`, relative Pfade, Leer- oder Steuerzeichen, eine Bezeichnung über 80 Zeichen — ergibt den Zustand **ungültig**; der gesetzte Wert wird dann weder angezeigt noch ausgeliefert, und das Startprotokoll enthält einen Hinweis ohne den Wert.
- **Wer sieht es:** jede angemeldete Rolle, die die Hilfe-Seite sieht (Auskunft `GET /api/support`, angemeldete Nutzung genügt; kein Adminrecht). Ausgeliefert wird nur der geprüfte Kontakt — keine anderen Umgebungswerte.
- **Was das Produkt nicht tut:** Es versendet nichts, legt kein Supportkonto an und sagt nichts über Erreichbarkeit oder Antwortzeiten. Ob hinter dem hinterlegten Weg ein besetzter Support steht, entscheidet und verantwortet der Betreiber.

---

*Read-only Onboarding-Dokument. Verweist nur auf vorhandene App-Routen und Doku. Quellen: in-App `Help`/`helpTopics.ts`, `docs/demo/stage-1-demo-path.md`, `README.md`/`SETUP.md`, `docs/operations/*`.*
