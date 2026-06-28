# Klarwerk — Nutzer-Schnellstart (Onboarding)

> Kurzanleitung für **Endnutzer**, um selbstständig mit Klarwerk zu starten.
> Technische Doku (Build/Betrieb): `README.md`, `SETUP.md`, `docs/operations/*`.
> Geführter Demo-/Review-Pfad: `docs/demo/stage-1-demo-path.md`.

---

## Was ist Klarwerk?

Klarwerk ist **kein Chatbot**, sondern ein **Knowledge OS**: Erfahrungswissen wird erfasst, im Team validiert, quellengebunden genutzt und durch Revalidierung aktuell gehalten. Antworten stammen ausschließlich aus **validiertem Wissen mit Quelle, Vertrauen und Status** — gibt es keine Grundlage, wird die **Wissenslücke ehrlich benannt** statt eine Antwort zu erfinden.

> **The AI may change. Your knowledge never does.**

---

## In 5 Minuten starten

1. **Anmelden.** Mit deinem Konto einloggen (E-Mail + Passwort) oder per SSO/OIDC, falls vom Betreiber aktiviert. Neue Konten müssen ggf. von einem Admin **freigegeben** werden.
2. **Erste Orientierung auf `/start`.** Die Startseite zeigt den **Knowledge-OS-Kreis** (Erfassen → Validieren → Nutzen → Aktuell halten), den **„besten nächsten Einstieg"** und Kennzahlen.
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
- **In der App:** Capture hat „Beispiel laden", Ask hat anklickbare Beispielfragen (mit Erwartung „findet validiertes Wissen" vs. „zeigt Wissenslücke").

---

## Grenzen (ehrlich)

- **Quellenbindung statt Bluff:** Antworten kommen nur aus validiertem Wissen mit Quelle/Trust/Status. Ohne Grundlage entsteht eine **Wissenslücke** (kein erfundener Text).
- **KI-Modus:** Ohne konfigurierten Modell-Schlüssel läuft ein **deterministischer Modus** (Antworten = belegte Wissensobjekt-Aussagen, klar als Modus markiert). Mit Modell-Schlüssel der **Modellmodus**. Das Modus-Badge auf `/fragen` zeigt den aktuellen Stand.
- **Demo-Sprache:** Der mitgelieferte Demo-Datensatz ist **deutsch**; im englischen UI sind Beispiele weiterhin treffsicher, die Demo-Inhalte aber deutsch.
- **Mensch entscheidet:** Die KI strukturiert/formuliert nur — Erfassen, Prüfen, Freigeben und Revalidieren bleiben menschliche Entscheidungen.

---

## Datenschutz & Nachvollziehbarkeit (Hinweis, keine Rechtsberatung)

- **Lückenloses Audit-Log:** Jede relevante Aktion (wer/wann/Aktion/Ziel) wird in einem **append-only, manipulationssicheren** Log (Hash-Kette) protokolliert. Einsicht haben Controller/Admin (Bereich Analytics/Audit).
- **Zugriffsschutz:** Rollen-/Rechtekonzept (RBAC) wird serverseitig erzwungen; keine Geheimnisse/Schlüssel im Browser.
- **Offene Betreiber-Pflichten:** DSGVO-Betroffenenrechte (Auskunft, Löschung, Verarbeitungsverzeichnis) sind **organisatorisch beim Betreiber** umzusetzen und (noch) nicht als Selbstbedienungs-Funktion im Produkt enthalten — siehe Restlücken. Das Audit-Log ist bewusst unveränderlich (Manipulationsschutz).

---

## FAQ / Support / Feedback

- **Erster Anlaufpunkt:** die **Hilfe-Seite** (`/hilfe`) mit Suche.
- **Rückmeldung:** Verbesserungswünsche/Fehler an den jeweiligen Klarwerk-Betreiber/Admin der Instanz.
- **Restlücke:** Ein dedizierter, im Produkt hinterlegter **Support-Kontakt/FAQ-Block** ist aktuell nicht eingebaut (siehe `docs/qm/claude-after-report.md`, SCRUM-210) — der Support-Weg wird pro Instanz organisatorisch festgelegt.

---

*Read-only Onboarding-Dokument. Verweist nur auf vorhandene App-Routen und Doku. Quellen: in-App `Help`/`helpTopics.ts`, `docs/demo/stage-1-demo-path.md`, `README.md`/`SETUP.md`, `docs/operations/*`.*
