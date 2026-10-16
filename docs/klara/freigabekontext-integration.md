# Persönliches Freigabeniveau im Fähigkeiten-Kontextpfad

Auftrag `produkt:20261015:rechte-freigabekontext-integration` (Basis `500cb5c64`, Live 1.0.0-beta.1.987).

## Was übernommen wurde

Selektiv der bestehende Ein-Datei-Fix aus dem Rechtekandidaten `9315fa9fcc2d7eea418f4cf232ef37f8e4f76a86`
(rechteentzug-gespraeche-belege, Nacharbeit 43) in `services/app/src/assistenz-faehigkeiten-anbindung.ts`:

- `Freigabestufe` wird aus `services/auth` importiert.
- `FaehigkeitenAnbindungDeps.konten` trägt das bestehende optionale `freigabe` des Kontos.
- `betrachter()` übernimmt `freigabe` aus dem je Schritt frisch gelesenen Konto in den `SessionUser`.

Produktiv liefert `build-app.ts` die Konten über `services.auth.listUsers()`; der `User` trägt `freigabe`
bereits (`services/auth/src/types.ts`, gelesen in `repo-pg.ts`). Ausgewertet wird allein in
`sichtbarkeit.ts` (`freigaberang`, `darfSehen`) — keine neue Policy. Space- und Quellleserechte bleiben
unabhängige UND-Bedingungen; ohne persönlichen Wert gilt weiter der Rollenstandard.

Weil `produktKontextPruefung` für Ausführung, Hintergrundfortsetzung, Unterschritte und
Ergebniszugriff denselben `betrachter()` nutzt, wirkt eine Begrenzung oder ihr Entzug beim nächsten
Schritt auf allen diesen Wegen.

## Gegenproben

- `tests/assistenz-faehigkeiten/freigabekontext-integration.test.ts` (neu, F1–F3): fiktive Konten und
  Objekte; begrenztes Admin-Konto, Erhöhung, Space-/Quellrechtentzug, Freigabeentzug, Rollenstandard.
- `tests/assistenz-faehigkeiten/produktweg.test.ts` (unverändert, N1–N9): bestehende Rechtegrenzen
  des Produktwegs.

## Grenzen

Kalender-, Job- und Referenzfähigkeiten sowie der umfassende Vertrag
`produkt:20261010:rechteentzug-gespraeche-belege` bleiben offen und sind hier nicht abgenommen.
