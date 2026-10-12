# Klara 12 · Unterstützung und Eigeninitiative einstellen

Auftrag `produkt:20261008:klara-eigeninitiative`. Die Person entscheidet selbst, wann sich Klara
meldet und welche Arbeit sie übernimmt.

## Die drei Modi

| Modus | Verhalten |
| --- | --- |
| **Nur auf Nachfrage** (`nachfrage`, Vorgabe) | Klara meldet sich nie von selbst. Fragen und Aufträge wirken wie bisher. |
| **Passende Hinweise anbieten** (`hinweise`) | Höchstens ein Hinweis neben der Figur, abgeleitet aus dem tatsächlichen Kontext. Er bietet die vorhandene Hilfe an und führt selbst nichts aus. |
| **Ausdrücklich übertragene Aufgaben** (`auftraege`) | Keine Hinweise. Oben im Gespräch stehen die selbst erteilten Aufträge (Klara 05) mit Stand; die Figur zählt offene. |

Gewählt wird in Klara unter „Wann ich mich melde“. Gespeichert wird im eigenen Assistenzprofil am
Server (`GET/PUT /api/me/assistenz/eigeninitiative`, nur `user.id` aus der Sitzung, fremde Kennung
403). Der Modus gilt deshalb nach Neuladen, nach neuer Anmeldung und auf anderen Geräten. Er ändert
weder Rolle noch Rechte, und er erteilt keiner Aktion eine Erlaubnis.

## Hinweise

- Herkunft (`apps/web/src/lib/klaraEigeninitiative.ts`, `hinweisFuer`), in dieser Rangfolge:
  Anleitung der Seite vorhanden und geschlossen → „Nächsten Schritt zeigen“; gelesenes,
  ungeprüftes Wissensobjekt → „Erklären“; die Hilfe kennt die Seite → „Seite erklären“.
- Ein Hinweis erscheint erst nach 1,5 s Ruhe und nur, wenn niemand gerade mit Klara arbeitet
  (Gespräch offen, Anfrage läuft, Markierung, Mikrofon, laufender Auftrag, Hilfe offen).
- Er ist ein Angebot: Erst der Klick öffnet Klara und startet die vorhandene Klarwerk-Hilfe (ohne KI,
  ohne Änderung am Bestand).
- „Später“ legt ihn vier Stunden ab, „Nicht mehr anbieten“ dreißig Tage
  (`POST /api/me/assistenz/eigeninitiative/hinweise`). Gespeichert wird nur `art:ort`, kein Text.
- Jeder Hinweis erscheint je Browsersitzung höchstens einmal, auch wenn die Person nicht reagiert.

## Ablage

`assistenz_profile.data.eigeninitiative` in derselben Zeile wie das Profil. Ein Moduswechsel ändert die
Profilfassung nicht (`schreibeEigeninitiative`, Vergleich auf den Inhalt). Ein Profilschreiben
übernimmt immer den gespeicherten Stand. Ohne eingerichtetes Profil entsteht dabei kein Profil.

## Belege

`tests/klara-eigeninitiative/` — am Server, Logik, in der echten Klara gegen den echten Server und
gegen PostgreSQL. Nicht belegt sind ein echter Browser mit echtem Neuladen und das Urteil einer
echten Person.
