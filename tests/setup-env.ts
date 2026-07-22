// WP-VIP2-GATE (bens P1): die öffentliche Selbstregistrierung ist in Produktion FAIL-CLOSED
// hinter KLARWERK_SELF_REGISTRATION (Default AUS). Die Test-Suite ist ein Dev-Setup und schaltet
// den Schalter hier EXPLIZIT frei — hunderte Bestandstests legen ihre Nutzer über
// POST /api/auth/register an (das ist der dokumentierte Dev-/Test-Weg, kein stiller Default).
// Tests, die das AUS-Verhalten prüfen, löschen die Variable lokal und stellen sie danach wieder her.
process.env.KLARWERK_SELF_REGISTRATION = "1";
