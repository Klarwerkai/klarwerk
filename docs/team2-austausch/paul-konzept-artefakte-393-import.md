## [Cloud-Worker] Konzept — KI-Artefakte: zwei Familien, Import-Entscheidung, SCRUM-393-Verankerung (05.07.2026)

**Anlass:** Pedi will Betriebsregeln/Arbeitsanweisungen über die App füttern und in KI-Artefakte
einbauen; mit Nerd entsteht dazu eine Architektur-Struktur. Beim Sichten des Codes fiel auf:
„KI-Artefakt" meint bei uns **zwei verschiedene Dinge**. Dieses Konzept trennt sie sauber, hält die
Entscheidung zur Seite „Import & Quellen" fest und listet die Verträge, die ich für SCRUM-393 von
Nerd brauche.

---

### 1. Zwei Artefakt-Familien — sauber trennen

**A) Wissens-Artefakte** — validiertes Wissen → Dokument.
Ort: **Output Factory** (`/output`, SCRUM-109/117) — existiert bereits. Auswahl + Reihenfolge
validierter Wissensobjekte → Arbeitsanweisung / Checkliste / Schulung / Management-Summary als
Markdown, mit Live-Vorschau, Copy/Download, rollen-/zielgruppenbewusst. Respektiert die
Vertraulichkeitsstufe (SCRUM-415: vertrauliche Objekte gehen nie in externe Artefakte).

**B) Verhaltens-Regeln / Guardrails** — Regeln, die die KI *steuern* (nicht Wissen ausgeben).
Ort: **SCRUM-393** (Regel-Verwaltung in der App), Nerds Insel-App als UI-Referenz. Beispiel: EXT-2.

> Merksatz: **A = Output aus Wissen. B = Leitplanke fürs KI-Verhalten.** Wenn „Artefakt" fällt,
> immer dazusagen, welche Familie gemeint ist — sonst reden wir aneinander vorbei.

---

### 2. Import & Quellen — Entscheidung: **parken** (Pedi 05.07., Option 1)

- **Ist-Zustand:** `/import` (`ImportReview`, SCRUM-116) = Bulk-JSON-Import + Review-Queue. Liegt in
  der Nav-Gruppe „Erweitert" → sichtbar nur für **Admin UND** aktivierten **Stufe-2-Schalter**
  (Standard: aus; `effectiveStufe2` liefert für Nicht-Admins immer `false`). **Fürs VIP-Beta also
  unsichtbar.**
- **Entscheidung:** so lassen, als Stufe-2-Migrationswerkzeug **parken**. **Nicht** zu einer
  Artefakt-Seite umbauen — das würde die Output Factory duplizieren. Kein Handlungsdruck, weil fürs
  Beta ohnehin verborgen.
- **Offene Option für Nerd:** Der Bulk-JSON-Import könnte perspektivisch der Eingang für
  **Regel-/Fall-Pakete** (Familie B) werden. Bevor wir die Seite entfernen oder umwidmen → deine
  Entscheidung, ob du diesen Fütter-Weg brauchst.

---

### 3. Pipelines — wie Betriebsregeln/Wissen rein- und rauskommen

- **Wissen (Familie A):** *Wissen erfassen* (Capture, Dokument-Ingestion) → *Validierung* →
  *Output Factory*.
- **Verhalten (Familie B):** *Testfälle* (EXT-2 …) → *Regel anlegen mit Live-Gegenprüfung* → *aktiv*;
  wirkt auf die KI-Aufgaben (Extrahieren, Interview, Antworten …).

„Betriebsregeln einspielen" heißt also je nach Zweck **zweierlei**: als Wissen über Capture, oder als
Guardrail-Regel (Familie B). Beide Wege existieren bzw. entstehen — der JSON-Bulk-Import ist ein
möglicher dritter Eingang für Massen-Pakete (siehe 2).

---

### 4. EXT-2 als Referenz für die Live-Gegenprüfung

- **Fall:** Sitzungsprotokoll ohne Fachwissen („Sitzung begann um 14 Uhr, vier Personen, Kaffee …").
- **Bestanden:** exakt `{"punkte":[]}`. **Durchgefallen:** halluzinierte Punkte
  (Filterwechsel/Wartung/Sicherheit).
- **Regel:** „Kein verwertbares Fachwissen (nur Termine/Anwesenheit/Alltag) → exakt `{"punkte":[]}`,
  niemals Punkte erfinden." — Aufgabe *Extrahieren*, Art *Guardrail*, Herkunft *EXT-2*.
- **Live-Gegenprüfung beim Anlegen/Aktivieren:** (1) Zielfall EXT-2 besteht **jetzt**, (2) **kein
  anderer** Fall wird schlechter → erst dann Freigabe. Genau Nerds Insel-Logik, in die App gezogen.

---

### 5. Was ich für SCRUM-393 von Nerd brauche (Datenverträge)

- **a) Testfall-Schema:** Kennung, Aufgabe, Eingabetext, Bestehens-Kriterien (maschinenlesbar +
  Klartext), Lauf-/Fehlhistorie.
- **b) Regel/Artefakt-Schema:** Aufgabe, Art (Guardrail/…), Herkunftsfall, Regeltext, Aktiv-Flag.
- **c) Live-Gegenprüfung:** gegen welche Fall-Suite und welchen Modell-Endpunkt läuft sie bei dir?
  Die KLARWERK-App soll dieselbe Suite gegen den **internen Reasoner (SSH-Tunnel localhost)** fahren.
- **d) Gemeinsame Quelle der Wahrheit:** liegt die Fall-/Regel-Definition in der Insel-App-Datei, oder
  legen wir ein **Schema hier in `docs/team2-austausch`** ab, das beide Seiten lesen? (Empfehlung: d,
  damit App und Insel-App nicht auseinanderlaufen.)

---

### 6. Nächste Schritte

- **Import:** nichts tun — geparkt.
- **SCRUM-393:** nach Pedis Freigabe der Reihenfolge als Bau-Block, gebaut gegen die Verträge (a)–(d).
- **Output Factory:** bleibt der Ort für Wissens-Artefakte; Ausbau (weitere Artefakt-Typen/Templates)
  separat, wenn gewünscht.
- **Constraints unverändert:** LLM nur über SSH-Tunnel localhost, keine Secrets in Code/Repos/Tickets,
  keine Kundendaten in Tests, lokal committen / kein Push / kein Tag bis Dienstag.

— Paul (Cloud-Session KLARWERK)
