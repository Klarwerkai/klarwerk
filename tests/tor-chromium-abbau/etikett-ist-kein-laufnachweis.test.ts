// ================================================================================================
// JOB 3573 · 11.09.2026 — WARUM „Chromium-Abbau · <Datei> · 45028.67ms" KEIN BEFUND ÜBER <Datei> IST.
// ================================================================================================
//
// DER ANLASS, gezählt statt geschätzt: 63 Torprotokolle unter `jobs/` und `archiv/` tragen die Zeile
//
//     Chromium-Abbau · tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx
//       · 45028.67ms · Grenze 45028.665ms · letzter Zustand: close() unbestätigt
//
// (dieselbe Zeile mit `tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts`). Sie sieht
// aus wie ein hängender Browserabbau in diesen beiden Dateien und wurde 36 Jobs lang so gelesen.
// SIE IST ES NICHT. Die Zeile entsteht in der Probe von `tests/tor-bereitschaft/t1b-hooks.test.ts`
// („dauerhaft fehlender Abschluss bleibt als Dateifehler rot", dort Z. 151): die Probe legt unter
// `mkdtempSync` zwei Wegwerfdateien `abbau-0.test.ts`/`abbau-1.test.ts` an, splittet mit `t1bAbbau()`
// das ECHTE `afterAll` der beiden Produktdateien hinein, gibt ihm einen Attrappenbrowser, dessen
// `close()` nie auflöst, und dreht eine VIRTUELLE Uhr um `ABBAU_GRENZE_MS + 1` weiter. Der Unterlauf
// ist absichtlich rot; `t1b-hooks` prüft genau das und ist dabei selbst grün. Weil `t1b-hooks` die
// Ausgabe des Unterlaufs weiterreicht (`console.log(ausgabe)`, dort Z. 137), steht sie im Torprotokoll
// zwischen den echten Läufen — mit dem echten Dateipfad als Etikett.
//
// WAS DIESE DATEI PRÜFT, und was `t1d-vollstaendig.test.tsx` NICHT prüft: t1d pinnt, dass der
// Negativfall rot wird und welchen Text er trägt. Hier geht es um die Gegenrichtung, die niemand
// belegte — WAS MAN AUS SO EINER ZEILE ÜBER EINE DATEI SCHLIESSEN DARF. Nämlich nichts:
//   F1 · der Dateipfad ist ein freier Beschriftungsparameter, keine Herkunftsangabe;
//   F2 · die Dauer 45028.67 ist die GRENZE SELBST, keine gemessene Laufzeit — sie entsteht in
//        Nullzeit an einer virtuellen Uhr, weshalb sie in allen 63 Protokollen identisch ist;
//   F3 · dieselbe Messstelle unterscheidet den echten Abbau davon sichtbar („close() bestätigt");
//   F4 · die beiden verdächtigten Dateien warten ihr Herunterfahren sehr wohl ab.
// Wird eine dieser vier Zusagen gebrochen, ist die Fehlanzeige von JOB 3573 neu zu prüfen.
import { existsSync, readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { ABBAU_GRENZE_MS, schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import { t1bAbbau } from "../tor-bereitschaft/t1b-original";

/** Die beiden Dateien, die 36 Jobs lang für den Hänger gehalten wurden. */
const VERDAECHTIGT = [
  "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx",
  "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
] as const;

const HOOKS = "tests/tor-bereitschaft/t1b-hooks.test.ts";

/**
 * Das Etikett der eigenen Proben. KEIN Dateipfad — diese Datei schreibt die Zeile, die 36 Jobs
 * fehlgeleitet hat, nicht ein weiteres Mal mit einem echten Pfad ins Torprotokoll.
 */
const PROBE_ETIKETT = "JOB 3573 · Etikettprobe, keine Datei";

/** Ein `close()`, das nie auflöst — die Attrappe der Probe, hier ohne Unterprozess. */
const NIE_FERTIG = { close: () => new Promise<void>(() => {}) };

/**
 * Fährt `schliesseChromium` an einer virtuellen Uhr in den Zeitablauf und gibt die geworfene
 * Meldung zurück. Vergangene ECHTE Zeit: praktisch null — genau das ist der Punkt von F2.
 */
async function inDenZeitablauf(etikett: string): Promise<string> {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  try {
    const ergebnis = schliesseChromium(etikett, NIE_FERTIG).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(ABBAU_GRENZE_MS + 1);
    return String(await ergebnis);
  } finally {
    vi.useRealTimers();
  }
}

// ------------------------------------------------------------------------------------------------
// F1 · Das Etikett ist ein freier Parameter. Eine Zeile mit Dateipfad X beweist nicht, dass X lief.
// ------------------------------------------------------------------------------------------------
it("F1 · der Dateipfad in der Abbauzeile ist eine Beschriftung, kein Herkunftsnachweis", async () => {
  // ABSICHTLICH ein Pfad, den es NICHT gibt: diese Datei darf die irreführende Zeile nicht selbst
  // mit einem echten Pfad ins Torprotokoll schreiben — genau daran hat sich JOB 3573 entzündet.
  const erfunden = "tests/gibt-es-nicht/frei-erfunden.test.ts";
  expect(existsSync(erfunden), "der Beleg: diese Datei gibt es nicht").toBe(false);

  const fehler = await inDenZeitablauf(erfunden);
  // Trotzdem trägt die Meldung den Pfad wörtlich — in derselben Form wie im Torprotokoll.
  expect(fehler, "das Etikett steht wörtlich in der Meldung").toContain(erfunden);
  expect(fehler).toContain("close() unbestätigt");
  expect(fehler).toContain("Abbaugrenze überschritten");
  // Damit ist die Kernaussage belegt: aus dem Pfad in so einer Zeile folgt NICHT, dass er lief.
});

it("F1b · die Probe von t1b-hooks beschriftet ihre Wegwerfdateien mit genau diesen zwei Pfaden", () => {
  const quelle = readFileSync(HOOKS, "utf8");
  // Der Grund, warum die echten Pfade überhaupt in einem Unterlauf auftauchen.
  for (const datei of VERDAECHTIGT) {
    expect(quelle, `${HOOKS} führt ${datei} als Probenetikett`).toContain(JSON.stringify(datei));
  }
  // Und die Dateien, die dabei wirklich laufen, heißen anders — sie sind Wegwerfware.
  expect(quelle).toContain("`abbau-${i}.test.ts`");
  expect(quelle).toContain("mkdtempSync");
  // Der Negativfall hat kein echtes close() und keine echte Uhr.
  expect(quelle).toContain("await new Promise(() => {})");
  expect(quelle).toContain("vi.useFakeTimers");
  expect(quelle).toContain("advanceTimersByTimeAsync(ABBAU_GRENZE_MS + 1)");
});

// ------------------------------------------------------------------------------------------------
// F2 · Die Zahl ist die Grenze, nicht eine Messung. Deshalb steht in allen 63 Protokollen dieselbe.
// ------------------------------------------------------------------------------------------------
it("F2 · die protokollierte Dauer ist die Grenze selbst und entsteht ohne echte Wartezeit", async () => {
  const begonnen = Date.now();
  const fehler = await inDenZeitablauf(PROBE_ETIKETT);
  const echtVerstrichen = Date.now() - begonnen;

  // Die Dauer in der Meldung ist exakt der auf zwei Stellen gerundete Grenzwert — kein Messwert.
  const dauer = /· (\d+\.\d+)ms · Grenze/.exec(fehler)?.[1];
  expect(dauer, "die Meldung nennt eine Dauer").toBeDefined();
  expect(dauer).toBe(ABBAU_GRENZE_MS.toFixed(2));

  // Der Beleg, dass keine 45 Sekunden vergangen sind: es waren real weniger als zwei.
  expect(
    echtVerstrichen,
    `die 45-Sekunden-Zeile entstand in ${echtVerstrichen} ms echter Zeit`,
  ).toBeLessThan(2_000);
});

it("F2b · genau diese Zahl steht in den Torprotokollen — 45028.67 gegen Grenze 45028.665", () => {
  // Der Stand vom 11.09.2026. Ändert sich die Kalibrierung, wird dieser Fall rot: dann sind die
  // 63 Altbefunde mit der NEUEN Zahl nachzuzählen, bevor die Fehlanzeige weitergilt.
  expect(String(ABBAU_GRENZE_MS)).toBe("45028.665");
  expect(ABBAU_GRENZE_MS.toFixed(2)).toBe("45028.67");
});

// ------------------------------------------------------------------------------------------------
// F3 · Der echte Abbau ist von der Probe unterscheidbar — an „bestätigt", nicht am Dateinamen.
// ------------------------------------------------------------------------------------------------
it("F3 · ein auflösendes close() derselben Messstelle meldet den bestätigten Abbau und wirft nicht", async () => {
  const zeilen: string[] = [];
  const protokoll = vi.spyOn(console, "log").mockImplementation((s: string) => void zeilen.push(s));
  try {
    await expect(
      schliesseChromium(PROBE_ETIKETT, { close: async () => {} }),
    ).resolves.toBeUndefined();
  } finally {
    protokoll.mockRestore();
  }
  const zeile = zeilen.find((z) => z.startsWith("Chromium-Abbau · "));
  expect(zeile, "die Messstelle schreibt auch im Gutfall eine Zeile").toBeDefined();
  expect(zeile).toContain("close() bestätigt");
  expect(zeile).not.toContain("close() unbestätigt");
  // Das ist das Merkmal, an dem ein Protokollleser die beiden Lagen trennen muss.
  expect(zeile).toContain("erster Fehler: keiner");
});

// ------------------------------------------------------------------------------------------------
// F4 · Die Ausgangsfrage des Auftrags: warten die beiden Dateien ihr Herunterfahren ab? Ja.
// ------------------------------------------------------------------------------------------------
for (const datei of VERDAECHTIGT) {
  it(`F4 · ${datei} wartet ihren Abbau ab (genau ein afterAll, mit await und eigenem Rahmen)`, () => {
    // Dieselbe Quelle, die die Probe hineinsplittet — keine Abschrift.
    const hook = t1bAbbau(datei);
    expect(hook).toContain("await schliesseChromium(");
    expect(hook, "der Abbau ist mit dem eigenen Pfad beschriftet").toContain(JSON.stringify(datei));
    // Eigener Hook-Rahmen: Vitest gäbe sonst 10 s, und der Abbau wäre rot, bevor die Grenze greift.
    expect(hook).toMatch(/,\s*60_000\s*\)\s*;?\s*$/);
  });
}
