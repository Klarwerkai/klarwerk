// JOB 3173, 07.09.2026, Kalibrierlauf 00:48 Uhr: Rollenraster-Suite, echtes close():
// Chromium-Abbau · tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts · 24.83ms.
// Gemessen mit performance.now() um die echte Promise, einschließlich Profilbereinigung.
// Faktor 1000 reserviert Scheduling-/I/O-Spielraum auf dem geteilten Tor-Rechner.
// Kein Spitzenlastbeweis: jeder Lauf misst erneut; die Grenze bleibt unter dem 60-s-Hook.
const GEMESSEN_MS = 24.83;
const SICHERHEITSFAKTOR = 1000;
export const ABBAU_GRENZE_MS = GEMESSEN_MS * SICHERHEITSFAKTOR;

/** Misst ausschließlich close(), auch bei Ablehnung oder ausbleibender Bestätigung. */
export async function schliesseChromium(
  datei: string,
  browser: { close(): Promise<void> } | null | undefined,
): Promise<void> {
  if (!browser) {
    console.log(`Chromium-Abbau · ${datei} · nicht gemessen: kein Browser aufgebaut`);
    return;
  }
  const start = performance.now();
  let zustand = "close() unbestätigt";
  let ersterFehler: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(async () => {
        await browser.close();
        zustand = "close() bestätigt";
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Abbaugrenze überschritten")), ABBAU_GRENZE_MS);
      }),
    ]);
    // Auch ein blockierter Eventloop darf eine verspätete Bestätigung nicht grün machen.
    if (performance.now() - start > ABBAU_GRENZE_MS) {
      throw new Error("Abbaugrenze überschritten");
    }
  } catch (e) {
    ersterFehler = String(e).replace(/[\r\n]+/g, " | ");
    throw new Error(
      `Chromium-Abbau · ${datei} · ${(performance.now() - start).toFixed(2)}ms · Grenze ${ABBAU_GRENZE_MS}ms · erster Fehler: ${ersterFehler} · letzter Zustand: ${zustand}`,
      { cause: e },
    );
  } finally {
    clearTimeout(timer);
    console.log(
      `Chromium-Abbau · ${datei} · ${(performance.now() - start).toFixed(2)}ms · Grenze ${ABBAU_GRENZE_MS}ms · letzter Zustand: ${zustand} · erster Fehler: ${ersterFehler ?? "keiner"}`,
    );
  }
}
