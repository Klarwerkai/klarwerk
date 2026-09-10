// ================================================================================================
// JOB 3448 · 10.09.2026 — DIE ABBAUGRENZE STAMMT AUS EINER MESSREIHE UNTER LAST.
// ================================================================================================
//
// WAS HIER VORHER STAND und warum es weg ist: ein EINZELNER Bestfall (24,83 ms, Kalibrierlauf JOB
// 3173 am 07.09. um 00:48 Uhr) mal Faktor 1000. Die Zahl 24 830 ms sah nach großzügiger Reserve aus
// und war keine: schon im abgebrochenen JOB 3197 wurden echte close()-Dauern von 1348,71 ms und
// 1527,47 ms gemessen (`archiv/3197/runde-3/code.md`), und die Messreihe unten hat den Bestfall
// endgültig widerlegt.
//
// DIE MESSREIHE, aus der `KALIBRIERREIHE_MS` besteht — 10.09.2026, 00:0x Uhr, auf dem Tor-Rechner
// selbst (12 Kerne), sechs Messungen, `performance.now()` um die echte close()-Promise eines echten
// Chromium mit DENSELBEN Startoptionen wie die Bühne (`tests/design/h6-chromium.ts:277-280`):
//
//     30019,11 · 8,76 · 5557,74 · 9,22 · 6,10 · 10,70 ms      Höchstwert 30019,11 ms
//
// LASTLAGE dieser Reihe, belegt: sechs parallele Vitest-Forks über den echten Bestand
// (`tests/app tests/capture tests/ko tests/library tests/analytics`, 776 Dateien), dazu fünf weitere
// gleichzeitig offene Chromium-Instanzen und zwölf CPU-fressende Fremdprozesse. Die 1-Minuten-Last
// stand bei den sechs Messungen auf 48,21 · 63,18 · 64,21 · 71,78 · 66,01 · 59,47.
//
// DREI VERGLEICHSREIHEN aus demselben Abend, damit die Zahl einzuordnen ist (sie stehen NICHT im
// Code, weil nur EINE Reihe die Grenze bilden darf) — zusammen mit der Reihe oben sind das 24
// Einzelmessungen, und nur mit allen vieren ist der Nebenbefund unten nachrechenbar:
//   · V1, Last 41,56–68,75 (gleicher Aufbau): 21962,44 · 1736,46 · 6,20 · 8,42 · 12,63 · 198,08 ms.
//   · V2, Last 16,01–23,11 (6 CPU-Fresser, 3 Ballastbrowser): 13,21 · 42,50 · 60,11 · 41,71 · 57,91 · 17,10 ms.
//   · V3, Last 8,03–13,56 (nur die Vitest-Forks, kein Ballast): 4,60 · 4,58 · 3,65 · 3,79 · 3,71 · 3,89 ms.
// Die Verteilung ist stark rechtsschief: fast alle Abbauten dauern Millisekunden, unter Überlast
// treten einzelne im Sekunden- bis Zehnersekundenbereich auf. Genau die muss die Grenze aushalten.
//
// DIE RECHNUNG: 30019,11 ms × 1,5 = 45028,665 ms. Bis zum 60-s-Hook-Rahmen bleiben 14971,335 ms.
// WARUM 1,5 UND NICHT MEHR: der Hook-Rahmen deckelt den Faktor. 30019,11 × 2 = 60038,22 ms läge
// ÜBER dem Rahmen — die Grenze wäre wirkungslos und die Meldung käme vom Hook statt von hier.
// 1,5 ist der größte runde Faktor, der noch rund 15 s Melderaum vor dem Hook lässt.
//
// WAS DIE GRENZE NICHT VERSPRICHT, ausdrücklich (der Satz „Kein Spitzenlastbeweis" von JOB 3173
// bleibt damit in geschärfter Form stehen): sie ist KEINE Zusage für beliebige Spitzenlast. Der
// Höchstwert der Reihe ist selbst schon 30 s; ein noch schlechterer Moment kann einen GÜLTIGEN
// Abbau über 45028,665 ms tragen, und kein Wert unterhalb des 60-s-Rahmens könnte das ausschließen.
// Für diesen Fall bleibt der Hook der Auffangbügel. Jeder Lauf misst erneut; die Reihe ist der
// belegte Stand vom 10.09.2026 auf DIESEM Rechner, keine Vorhersage.
//
// NEBENBEFUND, aus den 24 Einzelwerten AUSGEZÄHLT statt geschätzt: GENAU EINE Messung überschreitet
// die bisherige Grenze von 24 830 ms — der Höchstwert 30019,11 ms. Die zweithöchste Dauer, 21962,44 ms
// aus V1, liegt 2867,56 ms DARUNTER, also bei 88,45 % der alten Grenze. Die Reihenfolge lautet:
//
//     30019,11 ms  >  24 830 ms (alte Grenze)  >  21962,44 ms
//
// Der Befund ist damit „einmal gerissen, einmal auf 11,55 % herangekommen" — NICHT „zweimal
// gerissen". (Runde 1 dieses Auftrags hatte hier zwei Überschreitungen behauptet; BEN hat
// nachgerechnet, die Behauptung war falsch.) Er trägt trotzdem: gegenüber dem gemessenen Höchstwert
// hatte die alte Grenze den Faktor 0,827 — also keine Reserve, sondern ein Defizit, und ein gültiger,
// nur langsamer Abbau hat sie einmal rot gemacht. Die neue Grenze hat Faktor 1,5 über demselben
// Höchstwert und beseitigt diese Falschrot-Quelle, statt sie zu vergrößern.
export const KALIBRIERREIHE_MS = [30019.11, 8.76, 5557.74, 9.22, 6.1, 10.7] as const;
export const GEMESSEN_MS = Math.max(...KALIBRIERREIHE_MS);
export const SICHERHEITSFAKTOR = 1.5;
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
