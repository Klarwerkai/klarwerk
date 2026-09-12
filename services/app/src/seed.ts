import { type AppServices, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";
import { TERMINAL, amTerminalUebergeben } from "./kennwort-uebergabe";
// G27 R2 (Entscheidung 15 §A): derselbe kanonische Startupvertrag, den auch App-Ready fährt.
import { stelleSuchprojektionBereit } from "./search-projection-startup";
import { type SeedResult, seedDemo } from "./seed-demo";
// JOB 3776: derselbe Startvertrag, den auch `server.ts` am Einstiegspunkt fährt.
import { pruefeStartvertrag } from "./start-vertrag";

// SCRUM-156/181: CLI-Runner für den Demo-Seed. Die eigentliche Seed-Logik liegt in `seed-demo.ts`
// (bewusst ohne build-app-Import, um Zyklen zu vermeiden). Hier nur die Service-Verdrahtung.
export { seedDemo, seedDemoForAdmin, type SeedResult, type DemoSeedServices } from "./seed-demo";

// CLI-Runner: mit DATABASE_URL gegen Postgres (persistent), sonst In-Memory (nur Smoke).
// In Produktion gesperrt, außer SEED_ALLOW_PROD=1 wird bewusst gesetzt.
export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
    console.error("[seed:demo] In Produktion deaktiviert. Nur bewusst mit SEED_ALLOW_PROD=1.");
    process.exitCode = 1;
    return;
  }
  // ==============================================================================================
  // JOB 3776 — DER STARTVERTRAG GILT AUCH FÜR DIESEN EINSTIEGSPUNKT.
  // ==============================================================================================
  //
  // WARUM ER HIER STEHT: Bis JOB 3776 hing die Vertragsprüfung am Modulrumpf von `build-app.ts`
  // und griff für diesen Runner nur als Nebenwirkung des Imports. Mit dem Umzug nach `server.ts`
  // wäre sie hier ersatzlos entfallen — ein Seed-Lauf in Produktion (`SEED_ALLOW_PROD=1`) liefe
  // dann ohne jede Vertragsprüfung gegen eine unvollständig ausgestattete Instanz.
  //
  // UND WARUM ERST HIER, eine Zeile NACH der Produktionssperre: Die Sperre darüber ist eine
  // Absage an den Lauf überhaupt. Stünde der Vertrag davor, bekäme wer `seed:demo` versehentlich
  // in Produktion aufruft eine Auskunft über fehlende Pflichtwerte — für einen Lauf, der ohnehin
  // nicht stattfindet. Die Sperre ist die richtige Antwort; der Vertrag ist die erste Anweisung
  // des Laufs, der wirklich beginnt, und steht VOR jeder Verbindung und jedem Dienst.
  pruefeStartvertrag(process.env);
  const databaseUrl = process.env.DATABASE_URL;
  let services: AppServices;
  if (databaseUrl) {
    const pool = createPool(databaseUrl);
    await migrate(pool);
    services = buildPgServices(pool);
  } else {
    console.warn(
      "[seed:demo] Kein DATABASE_URL — In-Memory-Lauf, Daten NICHT persistent. Für sichtbaren Review DATABASE_URL setzen.",
    );
    services = buildServices();
  }
  // ============================================================================================
  // G27 R2 (KW-ARCH-G27-SEED-UND-SCHEMAVERTRAG-15 §A) — DER SEED NIMMT DIE INSTANZ IN BETRIEB.
  // ============================================================================================
  //
  // WAS HIER FEHLTE. `runSeed` baut seine Dienste selbst und lief damit an der
  // Startorchestrierung der App vorbei. Der Control-State blieb auf dem migrierten Seed
  // `UNINITIALIZED` stehen; `seedDemo()` braucht aber die Standardsuche (Duplikat-/Bestandsprüfung),
  // und die ist seit G27 R1 fail-closed. Der ausgelieferte CLI-Seed brach deshalb mit
  // `SEARCH_PROJECTION_NOT_READY (UNINITIALIZED)` ab — ein echter Betriebsfehler, kein Testartefakt.
  //
  // DERSELBE HELPER WIE APP-READY, nicht ein zweiter Weg (15 §A, No-Gos: keine zweite
  // Seed-Zustandsmaschine, kein unbedingter Aktivierungs-Sonderpfad). Er führt genau dieselbe
  // zustandsabhängige Folge aus und wirft, wenn die Instanz nicht `V2_ACTIVE` erreicht.
  //
  // UND ER STEHT VOR `seedDemo()`. Ein Fehler beendet den Lauf hier — es gibt keinen partiellen
  // Seed-Erfolg. Demodaten auf einer nicht suchbereiten Instanz sähen aus wie ein gelungener Lauf
  // und wären beim ersten Suchversuch wertlos. Gemeldet wird die Ursache ohne Zugangsdaten; der
  // Exitcode macht den Fehlschlag für Aufrufer und CI sichtbar.
  try {
    await stelleSuchprojektionBereit(services.ko);
  } catch (error) {
    console.error(
      `[seed:demo] Abbruch vor dem Laden der Demodaten: ${
        error instanceof Error ? error.message : "Suchprojektion nicht betriebsbereit."
      }`,
    );
    process.exitCode = 1;
    return;
  }
  const result: SeedResult = await seedDemo(services);
  if (result.skipped) {
    console.warn("[seed:demo] Übersprungen: Instanz ist nicht leer (Bestand/Nutzer vorhanden).");
    return;
  }
  // ============================================================================================
  // AUFTRAG-mega65 BLOCK A — DIE KENNZAHLEN GEHEN INS PROTOKOLL, DIE KENNWÖRTER GAR NICHT ERST
  // AUF DIESEN KANAL.
  // ============================================================================================
  //
  // HIER STAND BIS mega64 EINE ZUSAGE, DIE DIESER CODE SELBST GEBROCHEN HAT, und ben hat sie
  // belegt (sammel62, ROT-1). Der Kommentar erklärte richtig, dass `JSON.stringify(result)` „in
  // jedem CI-Mitschnitt, jeder Terminalhistorie und jedem Container-Log" landet — und gab die
  // Kennwörter danach mit `console.warn` über GENAU DENSELBEN Kanal aus, denn `console.warn`
  // schreibt nach `stderr`. Die Unterscheidung „Protokoll gegen Ausgabe" gibt es technisch nicht.
  // Getragen wurde sie von dem Satz „wer diesen Befehl aufruft, sitzt davor": eine Annahme über
  // den Bedienenden, wo eine Eigenschaft des Kanals hätte stehen müssen.
  //
  // DIE TRENNUNG BLEIBT, DER ZWEITE KANAL WECHSELT. Die Kennzahlen dürfen und sollen ins
  // Protokoll — sie sind der Grund, den Lauf überhaupt mitzuschreiben. Die Zugangsdaten gehen auf
  // das kontrollierende Terminal (`kennwort-uebergabe.ts`), das eine Umleitung und ein CI-Lauf
  // nicht einfangen. Gibt es keines, wird NICHTS ausgegeben und der Befehl sagt das — der Verweis
  // auf den Adminweg ist ein bedienbares Problem, ein Kennwort im Log ist keines.
  const { einmalkennwoerter, ...kennzahlen } = result;
  console.warn(`[seed:demo] Fertig: ${JSON.stringify(kennzahlen)}`);
  if (einmalkennwoerter.length === 0) {
    return;
  }
  const uebergeben = amTerminalUebergeben([
    "",
    "[seed:demo] Einmalkennwörter der neu angelegten Demo-Konten. Sie stehen nirgends im",
    "[seed:demo] Quelltext, in keinem Protokoll und werden NICHT erneut ausgegeben:",
    ...einmalkennwoerter.map((zugang) => `[seed:demo]   ${zugang.email}  ${zugang.kennwort}`),
    "",
  ]);
  if (!uebergeben) {
    // ==========================================================================================
    // AUFTRAG-mega66 BLOCK A — DIE MELDUNG GILT FÜR BEIDE FEHLRICHTUNGEN, SONST IST SIE DIE
    // ZWEITE FALSCHE ZUSAGE.
    // ==========================================================================================
    //
    // Bis mega65 nannte dieser Zweig nur EINEN Grund: „kein kontrollierendes Terminal". Seit die
    // Übergabe auch dann `false` liefert, wenn der Kanal den Text nicht VOLLSTÄNDIG annimmt
    // (bens ROT-1, sammel63), wäre das eine Diagnose, die im zweiten Fall nicht stimmt — und im
    // Teil-Write-Fall steht am Terminal bereits ein Präfix, das die Meldung nicht verschweigen
    // darf. Ehrlich statt hilfsbereit heißt hier: beide Wege benennen, kein Ausweichen auf
    // `stdout`/`stderr`, keine Datei. Die Konten sind angelegt, ihre Kennwörter sind mit diesem
    // Lauf verloren — auch die, die es teilweise durch den Kanal geschafft haben, denn ein halbes
    // Kennwort ist keines.
    console.warn(
      [
        `[seed:demo] Die Übergabe am kontrollierenden Terminal (${TERMINAL}) hat NICHT`,
        "stattgefunden: entweder gibt es keines — typisch für CI, Container und Pipelines — oder",
        "der Kanal hat den Text nicht vollständig angenommen. Die Einmalkennwörter der angelegten",
        "Demo-Konten gelten deshalb als nicht übergeben; sie werden hier NICHT nachgereicht, sie",
        "würden sonst in einem Protokoll landen. Steht am Terminal ein abgeschnittener Anfang der",
        "Liste, ist er unvollständig und nicht zu verwenden. Die Konten existieren: ein Kennwort",
        "setzt ein Administrator über POST /api/auth/users/:id/reset (das beendet gleichzeitig",
        "alle Sitzungen des Kontos). Für die Übergabe hier: den Befehl in einem Terminal starten.",
      ].join(" "),
    );
    // Der Bestand steht, die Übergabe nicht — und die Übergabe ist Teil des Auftrags. Ein
    // Rückgabewert 0 hieße hier „alles erledigt". Der CLI-Seed läuft in keiner Automatisierung
    // dieses Repos (`package.json` „seed:demo" ist der einzige Aufrufer, CI ruft ihn nicht).
    process.exitCode = 1;
  }
}

// Nur ausführen, wenn die Datei direkt gestartet wird (nicht beim Import in Tests).
if (process.argv[1]?.endsWith("seed.ts")) {
  // JOB 3776 — DERSELBE FÄNGER WIE IN `server.ts`, UND AUS DEMSELBEN GRUND.
  //
  // `void runSeed()` liess einen Wurf als unbehandelte Zurückweisung stehen: Node schreibt dann
  // eine Stapelspur und beendet mit 1. Für den Startvertrag wäre das exakt der Mangel, gegen den
  // JOB 3776 steht — eine lesbare Auskunft, die wie ein Programmabsturz aussieht. Hier steht
  // deshalb die gewohnte Form, mit dem Präfix dieses Befehls.
  runSeed().catch((error) => {
    console.error(`[seed:demo] Abbruch: ${String(error)}`);
    process.exitCode = 1;
  });
}
