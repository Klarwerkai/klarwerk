## [Cloud-Worker] SCRUM-417/418/419/420 — Feedback-Runde 2 (03.07.2026, v0.9.32-beta)

**Anlass:** Pedis zweite Feedback-Runde mit vier Screenshots (03.07. nachmittags).

**SCRUM-417 — Bearbeiten/Löschen direkt im Validierungs-Board.**
Autor des Artikels, Admin und Controller sehen auf jeder Board-Karte jetzt eine Aktionszeile:
Stift öffnet das KO-Detail direkt im Bearbeiten-Modus (neuer Deep-Link `?edit=1`),
Papierkorb löscht nach ruhiger Inline-Rückfrage (neutrale Karte, CI-konform — Rot nur auf
der destruktiven Aktion selbst). Berechtigung: Rolle admin/controller ODER eigene Autorschaft.

**SCRUM-418 — Extraktion: Animation + Robustheit.**
(a) Beide Extraktions-Knöpfe („Nach Wissen suchen") zeigen während der Arbeit einen
drehenden Spinner statt des Funkel-Symbols. (b) Wurzelbehandlung des Abbruch-Fehlers vom
42k-Zeichen-PDF: Antwort-Limit von 4096 auf 8192 Token verdoppelt, der Prompt begrenzt die
Ausgabe ehrlich (höchstens 12 Punkte, Belegstellen unter 300 Zeichen), und aus trotzdem
gekürzten Antworten werden vollständige Punkte GERETTET (Klammer-Reparatur rückwärts;
jeder gerettete Punkt läuft weiter durchs G-2-Belegstellen-Gate). Gekürzte Ergebnisse
tragen einen ehrlichen Hinweis („… möglicherweise unvollständig"). Nur wenn nichts zu
retten ist, erscheint die ehrliche Fehlermeldung aus SCRUM-411. Neue Tests decken Rettung,
G-2-Durchgriff und Leerfall ab.

**SCRUM-419 — Lösch-Rückfragen-Layout.**
Bibliothek: die Rückfrage („Beitrag wirklich löschen?…") sitzt jetzt in einer eigenen,
vollbreiten Zeile mit Trennlinie unter der Beitragszeile statt gequetscht daneben.
KO-Detail: Rückfrage stapelt auf schmalen Breiten (Frage über den Knöpfen), ab
Tablet-Breite einzeilig mit sauberem Abstand.

**SCRUM-420 — Geister-Karten „Re-Validierung".**
Ursache: Re-Validierungs-Vormerkungen überlebten das Löschen ihres KOs und erschienen als
UUID-Karten, die ins Leere führten. `pendingRevalidation()` heilt sich jetzt selbst:
Einträge ohne lebendes KO werden beim Lesen entfernt (Repo aufgeräumt, nicht nur
ausgeblendet). Test: koppeln → Anlagenänderung → KO löschen → Liste leer UND Vormerkung weg.

**Version:** 0.9.31-beta → 0.9.32-beta. **Gates:** laufen über Paul-Runner v7 auf dem Mac.
