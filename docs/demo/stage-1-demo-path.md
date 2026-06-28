# Klarwerk — Stage-1 Demo-Pfad (Capture → Validate → Use → Maintain)

> Geführter, seed-gestützter Demo-/Review-Pfad für die aktuelle Stage-1-Oberfläche.
> Zielgruppe: Pedi / Investor. Dauer: 7–10 Minuten. Quelle der Demo-Daten: `services/app/src/seed-demo.ts`.

---

## 1. Demo-Ziel

Klarwerk ist **kein Chatbot**, sondern ein **Knowledge OS**: Erfahrungswissen wird erfasst, im Team validiert, quellengebunden genutzt und durch Revalidierung aktuell gehalten. Antworten stammen ausschließlich aus validiertem Wissen mit Quelle, Vertrauen und Status — und wo keine Grundlage existiert, wird die Lücke ehrlich benannt statt erfunden. Leitsatz der Demo:

> **The AI may change. Your knowledge never does.**

Die Demo zeigt genau diesen Kreis an realen, industrienahen Daten: **Capture → Validate → Use → Maintain**.

---

## 2. Vorbedingungen

- **Frisch geseedete Instanz.** Der Demo-Seed läuft nur, wenn die Wissensbasis leer/uneingerichtet ist (idempotent, produktionsgeschützt). Zwei Wege:
  - CLI/Dev: erste, noch nicht eingerichtete Instanz → Seed beim Start (`seedDemo`).
  - Admin-UI/HTTP: als eingerichteter Admin `POST /api/admin/demo-seed` (SCRUM-181).
- **Rollen/User aus dem Seed** (Passwörter sind reine Demo-Fixtures aus dem Repo):
  - **Demo Admin** — `admin@demo.klarwerk` / `demo-admin-pass` (Admin; erstes Konto = freigegeben).
  - **Carla Controller** — `carla@demo.klarwerk` / `demo-pass-carla` (Controller; sieht/entscheidet Validierung).
  - **Erik Experte** — `erik@demo.klarwerk` / `demo-pass-erik` (Experte; erfasst Wissen).
  - Empfehlung für die Demo: als **Admin** anmelden (sieht alle Boards inkl. Validierung & Lifecycle).
- **Reasoner-Modus (ehrlich anzeigen):** ohne `ANTHROPIC_API_KEY` läuft der **deterministische Fallback** (Antworten sind belegte KO-Aussagen, klar als Modus markiert); mit `ANTHROPIC_API_KEY` der **Modellmodus**. Das Modus-Badge auf der Ask-Seite zeigt dies transparent.
- **Demo-Sprache:** Der Seed ist **deutsch**. Beispielfragen bleiben auch im EN-UI seed-sicher (technische Begriffe wie *Ventil X / Überdruck* bleiben erhalten), die KO-Inhalte selbst sind aber deutsch → Demo bevorzugt auf Deutsch zeigen.

---

## 3. Klickpfad (7–10 Minuten)

Jeder Schritt: **Screen/Route · Aktion · sichtbarer Beleg · Sprecherhinweis.**

### Schritt 0 — Einstieg
- **Route:** `/start`
- **Aktion:** Als Admin anmelden, auf Start landen.
- **Beleg:** Begrüßung + Kennzahlen + Arbeitsübersicht sind gefüllt (nicht leer).
- **Sprecher:** „Das ist kein Chat-Eingabefeld — das ist ein Arbeitssystem für Werkswissen."

### Schritt 1 — Start: Knowledge-OS-Kreis & bester nächster Einstieg
- **Route:** `/start`
- **Aktion:** Auf die Sektion „Der Klarwerk-Wissenskreis" zeigen; danach auf „Bester nächster Einstieg".
- **Beleg:** Vier Schritt-Karten **Erfassen → Validieren → Nutzen → Aktuell halten** (jeder Schritt verlinkt eine echte Route, „Nutzen" führt mit vorbefüllter Frage nach Ask). Darunter die priorisierte Arbeitsübersicht + KPIs (Gesamt/Offen/Validiert/Lücken).
- **Sprecher:** „Der gesamte Lebenszyklus von Wissen — sichtbar als Arbeitsführung, nicht als Blackbox."

### Schritt 2 — Capture: Erfahrungswissen erfassen
- **Route:** `/erfassen`
- **Aktion:** „Beispiel laden" klicken (industrielle Erfahrungsnotiz Linie L4 / Dosierpumpe DP-4) → „Mit KI strukturieren" → Entwurf prüfen → „Prüfen & einreichen".
- **Beleg:** Speicher-Check (Titel/Inhalt/Kategorie/Typ/Anhänge), nach dem Einreichen eine **Success-Card** „Wissensobjekt gespeichert" mit nächsten Schritten **Objekt ansehen** und **Zur Validierung** (kein Auto-Redirect, nichts wird automatisch validiert).
- **Sprecher:** „Der Mensch bringt die Erfahrung, die KI strukturiert nur — und der nächste Schritt ist sofort sichtbar."

### Schritt 3 — Validate: Review-Entscheidung
- **Route:** `/validierung`
- **Aktion:** Auf einer Karte (z. B. *Pumpe P2 …*, offen/zugewiesen) eine klare Entscheidung treffen: **Freigeben** / **Rückfrage** / **Ablehnen**. Bei Rückfrage/Ablehnen ist eine **Begründung Pflicht**.
- **Beleg:** Trust/Status/Version/Ziel je Karte; nach der Entscheidung eine **Next-Step-Card** „Bewertung erfasst" mit **Objekt ansehen** und (bei Freigabe) **Wissen nutzen (fragen)**.
- **Sprecher:** „Wissen wird im Team belastbar gemacht — mit Pflichtbegründung bei Rückfrage und Ablehnung."

### Schritt 4 — Use: Fragen mit Quellenbindung
- **Route:** `/fragen`
- **Aktion:** Beispielchip mit Erwartung **„findet validiertes Wissen"** klicken (seed-sicher: *Ventil X / Überdruck*) → „Fragen".
- **Beleg:** Antwort mit **Status (gesichert vs. ungeprüft)**, **Vertrauen**, **Belegschritten** und **Quellen als Links** (KO-Titel statt roher ID) — fokussiert auf das tatsächlich genutzte KO. Modus-Badge zeigt den Reasoner-Modus.
- **Sprecher:** „Die Antwort ist quellengebunden und nachvollziehbar — kein generativer Bluff."

### Schritt 5 — Library / KO-Detail: Reife, Trust, Quellen, Version
- **Route:** `/bibliothek` → Treffer → `/wissen/:id`
- **Aktion:** In der Bibliothek den **Reife-Filter „Nutzbar"** setzen; einen Treffer öffnen.
- **Beleg:** Pro Treffer **Reife-Plakette** (Nutzbar/In Prüfung/Zu prüfen) + **„Fragen"-CTA**. Im KO-Detail das **Übersichtsbanner** (Nutzbarkeit/Status/Trust/Version/Quellen/Anhänge) + ehrliche **Next-Action-CTA** (validiert → „In Fragen nutzen" mit vorbefüllter KO-Frage; Quellen-Anker).
- **Sprecher:** „Auf einen Blick: Ist dieses Wissen nutzbar, woher kommt es, wie aktuell ist es?"

### Schritt 6 — Risk/Gaps: offene Wissenslücke
- **Route:** `/risiko`
- **Aktion:** In der Gap-Liste die offene Lücke zeigen: **„Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?"** (Priorität hoch). „Wissen erfassen" klicken.
- **Beleg:** Pro Lücke Priorität, nächster Schritt und CTA **„Wissen erfassen"** → springt mit der Frage als Kontext zurück nach `/erfassen` (Frage klar als **offene Frage**, nicht als fertiges Wissen).
- **Sprecher:** „Eine Frage ohne Basis ist kein Fehler — sie wird zur sichtbaren Wissenslücke und führt direkt zurück ins Erfassen. Der Kreis schließt sich."

### Schritt 7 — Maintain: Revalidierung
- **Route:** `/lebenszyklus`
- **Aktion:** Im Bereich „Zur Re-Validierung" das fällige Objekt zeigen (gekoppelt an Anlage **ANL-01**, durch Anlagenänderung markiert). „Noch gültig → neue Version" bestätigen.
- **Beleg:** Pending-Karte mit Titel/Anlagenbezug/nächstem Schritt + CTA in die Validierung; nach der Bestätigung eine **Success-Card** „Revalidierung erfasst" mit **Objekt ansehen** und (falls auflösbar) **Wissen nutzen**.
- **Sprecher:** „Wenn sich die Anlage ändert, fordert Klarwerk aktiv die Prüfung an — Wissen bleibt aktuell, statt stillschweigend zu veralten."

**Schluss-Satz:** „Capture → Validate → Use → Maintain — ein geschlossener Kreis. Das Modell darf sich ändern; das geprüfte Wissen bleibt."

---

## 4. Demo-Daten / Begriffe aus dem Seed

| Begriff | Wo in der Demo | Bedeutung |
| --- | --- | --- |
| **Ventil X / Überdruck** | KO „Ventil X bei Überdruck manuell schließen." (validiert) | beantwortbare Ask-Frage, quellengebundene Antwort |
| **Filter F3** | KO „Filter F3 monatlich auf Verschmutzung prüfen." (validiert) | zweites validiertes, nutzbares KO |
| **Kaltstart / Vorwärmung** | zwei widersprüchliche KOs | **Konflikt** (truth) im Konflikt-Board |
| **Linie L4 / Dosierwert / Schichtwechsel** | offene Wissenslücke (Priorität hoch) | Use→Gap→Capture-Pfad |
| **Pumpe P2** | KO offen, Carla zugewiesen | offenes Prüfobjekt im Validierungsboard |
| **ANL-01** | Anlagenkopplung von „Ventil X" | Auslöser der **fälligen Revalidierung** |
| **Quelle „Anlagenhandbuch Abschnitt 4.2" + Anhang „skizze.png"** | am KO „Ventil X" | beide **Evidence-Arten** (Quelle + Anhang) sichtbar |

Seed-Mindestsignale (durch `seed.test.ts` abgesichert): ≥3 User, ≥5 KOs, ≥2 validiert, ≥1 Wissenslücke (industriell, keine Test-Lücke), ≥1 Konflikt, ≥1 fällige Revalidierung, ≥1 Anhang, ≥1 Quelle.

---

## 5. P2-Hinweise (transparent, in dieser Demo nicht lösen)

- **EN/DE-Seed-Mix:** Im englischen UI bleiben Beispielfragen treffsicher (technische Seed-Begriffe erhalten), die KO-Inhalte sind aber deutsch → Demo bevorzugt auf Deutsch zeigen oder Sprachhinweis geben.
- **Deterministischer Reasoner wirkt „dünner":** Ohne API-Key sind Antworten belegte KO-Aussagen (ehrlich, aber nicht generativ-flüssig). Für eine „KI-stärkere" Demo optional Modellmodus mit API-Key.
- **Informationsdichte:** `/risiko` (Cockpit + Busfaktor + Domänenrisiko + Lücken) und `/lebenszyklus` (Anlagenänderung + Pending + Lernpfad) sind inhaltsreich — für den Investorenblick ggf. nur die relevante Sektion zeigen.

---

## 6. Abschluss / Entscheidungsfragen

**Was Pedi nach der Demo entscheiden soll:**
- Ist der Stage-1-Kernzyklus (Capture → Validate → Use → Maintain) für Investor/Kunde **überzeugend und verständlich** — oder fehlt eine Station?
- Soll die Demo **standardmäßig deterministisch** laufen (ehrlich, ohne Kosten) oder für Pitches im **Modellmodus** (API-Key)?
- Reicht der **deutsche Demo-Seed**, oder braucht es einen **EN-konsistenten Demo-Datensatz**?

**Sinnvoller nächster Produktblock, falls die Demo passt (genau einer):**
- Entweder **EN-konsistenter Demo-Seed + kleiner Sprach-/Leerzustands-Feinschliff** (Demo-Politur, kein neues Feature), **oder** — falls die Kernfunktion bereits trägt — der **erste produktnahe Stage-1.5-Schritt** außerhalb dieses Demo-Pfads (von Codex/Pedi zu definieren). Bewusst **kein** automatisches Folge-Work-Item aus diesem Dokument.

---

*Read-only Demo-Dokument. Kein Produktcode geändert. Quelle der Daten: `services/app/src/seed-demo.ts`; Review-Grundlage: SCRUM-279 (`docs/qm/claude-after-report.md`).*
