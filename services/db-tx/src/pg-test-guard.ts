// WP-SHIP8-CLOSE-6 (bens GELB): die Pg-Integrationssuite DROPPT Tabellen — sie darf NIE eine
// echte Datenbank treffen. Eine per KLARWERK_PG_TEST_URL angebotene lokale Instanz wird deshalb
// HART abgesichert: freigegeben nur, wenn der Datenbankname erkennbar eine TESTdatenbank ist
// (enthält „test", case-insensitiv) ODER zusätzlich KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1 gesetzt
// wurde. Abgelehnte oder unlesbare URLs führen zu einem expliziten Skip mit Klartext-Grund auf
// stderr — nie zu einem stillen Lauf gegen unbekannte Daten.
export function guardedLocalPgTestUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const url = env.KLARWERK_PG_TEST_URL;
  if (!url) {
    return undefined;
  }
  if (env.KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE === "1") {
    return url;
  }
  // Datenbankname = Pfadsegment nach der Authority. BEWUSST per Muster statt new URL():
  // WHATWG-URL lehnt Socket-Verbindungsstrings (postgres://user@/db?host=/run/pg — leerer Host
  // mit Userinfo) als ungültig ab; genau die nutzen die Docker-losen Evidence-Läufe.
  const match = /^[^:]+:\/\/[^/?#]*\/([^/?#]*)/.exec(url);
  let dbName = "";
  try {
    dbName = decodeURIComponent(match?.[1] ?? "");
  } catch {
    dbName = "";
  }
  if (dbName.toLowerCase().includes("test")) {
    return url;
  }
  process.stderr.write(
    `[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL zeigt auf die Datenbank ${
      dbName || "(Name nicht lesbar)"
    } — der Name enthält nicht „test". Die Suite droppt Tabellen; bitte eine Wegwerf-Testdatenbank verwenden oder ausdrücklich KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1 setzen.\n`,
  );
  return undefined;
}
