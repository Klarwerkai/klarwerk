## [Cloud-Worker] SCRUM-425 — Validierung optisch an die Bibliothek angleichen (03.07.2026, v0.9.37-beta)

**Anlass:** Pedi 03.07.: Die Bibliothek sieht gut aus; die Validierung sollte optisch
angeglichen werden.

**Befund:** Beide Seiten teilen bereits dieselben Design-Tokens (Pills, Trust-Farben,
StatusPill, identische Filter-Pills). Sichtbare Abweichungen der Board-Karte gegenüber der
Bibliotheks-Liste: größerer Titel (text-[17px] statt text-[15px]), abweichender Titel-Hover
(zusätzlicher Farbwechsel auf „ink") und größerer Pill-Abstand (gap-2 statt gap-1.5).

**Angleichung (konservativ, ohne Funktionsverlust):**
- Board-Titel `text-[17px]` → `text-[15px]` (exakt wie die Bibliothek), gleiche
  Zeilenhöhe/Gewicht.
- Titel-Hover: nur noch Unterstreichung (wie die Bibliothek), kein zusätzlicher Farbwechsel.
- Badge-Zeile `gap-2` → `gap-1.5` (wie die Bibliothek).

Bewusst NICHT geändert: die prüf-relevante Badge-Auswahl der Karte (Status + Trust +
Review-Signale) und alle Funktionen aus SCRUM-416/417 (ganze Karte klickbar, Aufklappung,
Bearbeiten/Löschen). Die Reife-Pill der Bibliothek beruht auf einer eigenen
Maturity-Berechnung und wurde bewusst nicht ins Board dupliziert (das Board führt Trust).

**Version:** 0.9.36-beta → 0.9.37-beta. **Gates:** Paul-Runner v12 (Gesamtbestand).
