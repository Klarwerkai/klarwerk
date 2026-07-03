# KLARWERK — Leitfaden für den VIP-Vortest am 05.07.2026

Perspektive: Investor / externer Partner. Er testet selbst und beurteilt — dieser Leitfaden
liefert dir (Pedi) die Vorbereitung, einen geführten Einstieg mit Sprechtext, einen
Selbst-Test-Rundgang für den Gast und ehrliche Antworten auf absehbare Nachfragen.

---

## 1. Vorbereitung am Vortag (Checkliste, ca. 30 Minuten)

- [ ] **Stand einfrieren:** Paul-Runner laufen lassen — Schlusszeile muss ALLE GATES GRÜN
      zeigen. Danach Boss-Commit + KLARWERK Sync. Ab jetzt KEINE neuen Features mehr
      einspielen; nur noch dieser Stand wird gezeigt.
- [ ] **Version prüfen:** oben rechts in der App (aktuell 0.9.33-beta). Wirkt professionell,
      wenn du sie nennen kannst, ohne nachzusehen.
- [ ] **Frische Demodaten:** Admin → Daten → erst Demodaten entfernen, dann neu laden.
      Ergebnis: saubere, glaubwürdige Industrie-Beispiele (alle fünf Wissensarten belegt),
      keine Testreste, keine halbfertigen Entwürfe.
- [ ] **KI-Schlüssel-Test:** Admin → KI → Key-Test muss grün sein. Ohne funktionierende KI
      wirken Interview und Extraktion nicht — das ist der wichtigste einzelne Handgriff.
- [ ] **Gast-Zugang anlegen:** Admin → Konten → eigener Nutzer für den Gast (voller Name,
      Rolle **experte** — so erlebt er den Alltag, kann aber nichts verstellen). Zugangsdaten
      auf einen Zettel, nicht per Mail.
- [ ] **Standard-Prüferanzahl setzen:** Admin → Daten → Prüfungen auf **2** — im Vortest mit
      wenigen Nutzern ist ein Beitrag so schneller „validiert" und der Kreislauf sichtbar.
- [ ] **Test-PDF bereitlegen:** ein kurzes (1–3 Seiten), sauberes Wartungs-/Protokoll-PDF für
      die Extraktion. KEIN 40-Seiten-Dokument — bei sehr langen PDFs kann die Liste als
      „gekürzt" markiert werden (ehrlich, aber im Vortest unnötig).
- [ ] **Rechner vorbereiten:** Bildschirmruhe/Benachrichtigungen aus, Browser-Zoom 100 %,
      ein Fenster, keine fremden Tabs.
- [ ] **Generalprobe:** den Rundgang aus Abschnitt 3 einmal selbst durchspielen (15 Min).

## 2. Geführter Einstieg (5 Minuten, du sprichst)

**Das Problem (Sprechtext):**
„Wenn bei uns ein erfahrener Kollege geht, geht sein Wissen mit — Grenzwerte, Handgriffe,
Ausnahmen, die in keinem Handbuch stehen. KLARWERK sichert genau dieses Erfahrungswissen:
Es wird erzählt, von KI strukturiert, von Kollegen geprüft — und ist dann für alle
auffindbar und belastbar."

**Die drei Prinzipien (Sprechtext):**
„Drei Dinge unterscheiden uns: Erstens — die KI erfindet nichts. Jeder extrahierte Punkt
braucht eine wörtliche Belegstelle im Dokument, sonst fliegt er raus. Zweitens — nichts gilt
ungeprüft. Jeder Beitrag durchläuft eine Peer-Validierung mit sichtbarem Vertrauenswert.
Drittens — alles ist nachvollziehbar: Versionen, Prüfungen und Änderungen stehen im
Audit-Log."

Danach übergibst du Maus und Tastatur.

## 3. Selbst-Test-Rundgang für den Gast (15–20 Minuten)

Gib ihm diese fünf Aufgaben — sie führen an den Stärken entlang:

1. **Anmelden & umsehen.** Arbeitsbereich: was liegt an, was ist neu.
2. **Wissen erfassen → Erzählen:** einen Erfahrungssatz eintippen (z. B. „Wenn die
   Dosierpumpe nach dem Anfahren klackert, zehn Sekunden warten, dann entlüften — sonst
   zieht sie Luft"). KI strukturiert → Wissensseite prüfen → unter Erweiterte Details eine
   Prüferin vorschlagen → einreichen.
3. **Wissen erfassen → Aus Datei:** das bereitgelegte PDF hochladen, „Nach Wissen suchen"
   drücken (Spinner läuft), Punkte ansehen — jeder trägt seine Belegstelle aus dem Dokument.
   Ein bis zwei Punkte übernehmen.
4. **Fragen:** eine Frage stellen, die die Demodaten abdecken (z. B. zum Schweißnaht- oder
   Dosierpumpen-Wissen) — Antwort MIT Quellenangaben. Danach bewusst eine Frage, die
   NICHT abgedeckt ist: KLARWERK sagt ehrlich, dass die Wissensbasis das nicht hergibt,
   und bietet an, die Lücke zu schließen. **Das ist der stärkste Moment — nicht überspringen.**
5. **Validierung & Kennzahlen:** als du (Admin/Controller) seinen Beitrag im Board öffnen,
   bestätigen, Trust-Anstieg zeigen; dann Management-Sicht mit Bus-Faktor („bei welchem
   Wissen hängen wir an einer einzigen Person?").

## 4. Was du meidest — und warum

- **Sehr lange PDFs (>20 Seiten) bei der Extraktion.** Funktioniert, kann aber mit dem
  ehrlichen Hinweis „Liste möglicherweise unvollständig" enden — korrekt, aber
  erklärungsbedürftig. Kurzes PDF = sauberes Erlebnis.
- **Externe Wissensabfrage.** Der Admin-Regler dafür ist in Abstimmung (bewusste
  Produktentscheidung, welche Stufen es gibt). Nicht vorführen; auf Nachfrage: „Kommt als
  Admin-Regler von komplett blockiert bis offen — Standard ist restriktiv."
- **Neue Einstellungen live verstellen.** Admin-Bereich nur an den zwei vorbereiteten
  Stellen zeigen (Key-Test, Verfügbare KIs) — nicht durch alle Regler klicken.

## 5. Absehbare Fragen — ehrliche, kurze Antworten

- **„Wie reif ist das?"** — „Beta 0.9.x. Der Kern — Erfassen, Validieren, Fragen, Audit —
  läuft stabil und ist durchgehend automatisiert getestet (über 1300 Tests, jede Lieferung
  nur bei grünem Gesamtlauf). Pilotkunde in Vorbereitung."
- **„Was, wenn die KI Unsinn erzählt?"** — „Sie darf nicht. Antworten entstehen nur aus
  validierten Quellen und werden mit ihnen belegt; Dokument-Extraktion nur mit wörtlicher
  Belegstelle; reicht die Basis nicht, sagt das System das offen — es rät nicht."
- **„Wo laufen die Daten?"** — „Heute Cloud-Modell über einen serverseitigen Schlüssel, der
  nie den Server verlässt; keine Kundendaten in Tests oder Auswertungen. Ein lokaler
  LLM-Betrieb (on-premises) ist als nächste Ausbaustufe geplant — für Kunden, deren Wissen
  das Haus nicht verlassen darf."
- **„Machen die Mitarbeiter da mit?"** — „Dafür gibt es ein eigenes Adoptions-Playbook:
  erfahrene Kollegen werden als Wissensgeber geehrt, nicht kontrolliert — bewusst kein
  Leistungs-Tracking; Einführung über Betriebsrat und Pilotteam."
- **„Vertraulichkeit einzelner Inhalte?"** — „Kennzeichnung in Stufen (etwa Intern /
  Vertraulich / Streng vertraulich) ist spezifiziert und in der Umsetzung."
- **„Was kostet der Betrieb?"** — nur wenn du eine belastbare Zahl hast; sonst: „Hängt am
  Modellverbrauch; die Architektur ist bewusst schlank — ein Server, eine Datenbank."

## 6. Wenn etwas schiefgeht (Plan B)

- **KI antwortet nicht / Key-Fehler:** ruhig benennen („Der Cloud-Zugang hakt gerade"),
  weiter zu Validierung, Bibliothek, Fragen (deterministische Antworten mit Quellen gehen
  weiter) und Kennzahlen — der Prüf-Kreislauf trägt die Demo auch ohne Modell.
- **Unerwartete Fehlermeldung:** nicht wegklicken und nicht entschuldigen — KLARWERK meldet
  Fehler bewusst ehrlich statt still zu raten. Ein Satz dazu („genau so soll es sein:
  lieber ehrlich als erfunden") macht aus dem Moment ein Feature.
- **Notizzettel führen:** jede Beobachtung des Gasts wird ein Ticket — das zeigst du ihm
  ruhig („Ihr Feedback von heute ist morgen im Board").

---

*Erstellt von Paul (Cloud-Worker), 03.07.2026 — Stand v0.9.33-beta. Vor dem Termin bitte
einmal gegenlesen: Zahlen (Version, Testanzahl) und den Demodaten-Stand aktualisieren,
falls bis dahin weitere Lieferungen kommen.*
