// ================================================================================================
// JOB 920 / D4 — DAS KLARA-REGRESSIONSINVENTAR: REPRODUZIERBAR STATT BEHAUPTET.
// ================================================================================================
//
// DER BEFUND (`_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-920-D3.md`):
//
//   `:11` · „Sichtbar wird die Luecke bei jeder spaeteren Wiederholung: Das Paket allein erlaubt
//    weder dieselbe Dateimenge noch dieselbe Kettenaussage zu rekonstruieren."
//   Prüflücke 2 · „Inventarkalibrierung: Fuer jede der fuenf Suchachsen mindestens eine erwartete
//    Positivdatei und eine Gegenprobe binden; erwartet wird, dass der Wegfall einer Achse die
//    Kalibrierung rot macht."
//
// D3 hat die Dateimenge in einer Rueckgabe BESCHRIEBEN. Eine Beschreibung laesst sich nicht
// nachfahren. Diese Datei leitet die Menge deshalb AUS DEM BAUM AB und haelt sie gegen ein
// gepinntes Inventar — wer sie morgen wiederholt, bekommt dieselbe Menge oder ein rotes Ergebnis
// mit der Differenz im Klartext.
//
// DIE METHODISCHE MITTE, die BENs Ruege am D2-Verfahren traf: Ein Inventar nach DATEINAMEN misst
// die Benennungsdisziplin, nicht die Abdeckung. Gemessen auf diesem Stand: die Namenssuche findet
// 22 Dateien, die semantischen Achsen führen auf 51 — 29 einschlaegige Testdateien tragen „klara"
// nirgends im Pfad. Fall K5 haelt genau diese Zahl fest.
//
// WAS DIESE DATEI NICHT TUT: Sie bewertet die gefundenen Tests nicht und ersetzt keinen von ihnen.
// Sie sichert die MENGE, gegen die eine Klara-Regression gefahren wird — nicht deren Inhalt.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const FLAECHEN = ["tests", "services", "apps"];

/**
 * Die eigene Datei nimmt sich aus: sie nennt die Suchbegriffe aller sechs Achsen als DATEN und
 * wuerde sich sonst selbst einsammeln. Genau eine Ausnahme, hier benannt, in K6 dagegen kalibriert.
 */
const SELBST = "tests/app/klara-regressionsinventar.test.ts";

// ------------------------------------------------------------------------------------------------
// DIE SECHS ACHSEN. Fuenf semantische (Inhalt) plus die Dateinamenssuche des D2-Verfahrens (Pfad).
// ------------------------------------------------------------------------------------------------
//
// `positiv` und `gegenprobe` sind BENs Prüflücke 2: Ohne die Positivdatei kann die Achse nicht
// greifen, und ohne die Gegenprobe waere „greift" auch dann wahr, wenn sie ALLES faende. Wer eine
// Achse kaputtmacht oder entfernt, wird an ihrer Positivdatei rot.
type Achse = {
  kennung: string;
  wo: "pfad" | "inhalt";
  muster: RegExp;
  zweck: string;
  positiv: string;
  gegenprobe: string;
};

const ACHSEN: Achse[] = [
  {
    kennung: "name",
    wo: "pfad",
    muster: /klara/i,
    zweck:
      "Das D2-Verfahren: Dateiname traegt „klara“. Bleibt drin, damit die Zahl der davon " +
      "verfehlten Dateien messbar bleibt.",
    positiv: "tests/help/klara-registry.test.ts",
    gegenprobe: "tests/app/mega40-token-disziplin.test.ts",
  },
  {
    kennung: "taskpane",
    wo: "inhalt",
    muster: /taskpane/,
    zweck: "Taskpane-Auslieferung: alles, was die Word-Flaeche selbst ausliefert oder prueft.",
    positiv: "services/app/src/routes/addin-static-routes.test.ts",
    gegenprobe: "tests/app/mega40-token-disziplin.test.ts",
  },
  {
    kennung: "manifest",
    wo: "inhalt",
    muster: /SourceLocation|manifest\.xml|manifest\.prod/,
    zweck:
      "Manifest und SourceLocation: der Vertrag, ueber den Word die Flaeche ueberhaupt findet.",
    positiv: "tests/app/word-addin-taskpane-cache.test.ts",
    gegenprobe: "tests/app/contrast-tokens-d5.test.ts",
  },
  {
    kennung: "version",
    wo: "inhalt",
    muster: /\?v=|version\.ts|Cache-Control/,
    zweck:
      "Versionsschritt und Cacheentwertung: ohne sie kommt eine Aenderung nicht beim Kunden an.",
    positiv: "services/app/src/web-static.test.ts",
    gegenprobe: "tests/app/mega40-theme-invarianz.test.ts",
  },
  {
    kennung: "komponente",
    wo: "inhalt",
    muster: /KlaraAssistant|KlaraPathTeaser|KlaraPanel/,
    zweck: "Klara-Bauteile, die „klara“ nicht im Pfad tragen — der blinde Fleck der Namenssuche.",
    positiv: "tests/library/mega59-nullzustand-mounted.test.tsx",
    gegenprobe: "tests/app/word-addin-csp.test.ts",
  },
  {
    kennung: "palette",
    wo: "inhalt",
    muster: /themes\.css|--ai:|Farbdrift|palette/,
    zweck: "Palette und Farbtreue: Klara schreibt die Werkbank-Palette ein zweites Mal auf.",
    positiv: "tests/app/contrast-tokens-d5.test.ts",
    gegenprobe: "tests/app/word-addin.test.ts",
  },
];

// ------------------------------------------------------------------------------------------------
// DAS GEPINNTE INVENTAR — die Menge, gegen die eine Klara-Regression gefahren wird.
// Gemessen auf Base 9208d494b99ba9f93233b0e951354d65582ba03e,
// nachgefuehrt am 18.08.2026 nach der Integration von 35 Nachtstaenden: drei Dateien
// kamen neu in den Baum und wurden von der Erhebung gefunden. Genau dafuer ist K2
// gebaut -- es meldet, was das Inventar noch nicht kennt, statt still zu wachsen.
// JOB 1113 (18.08.2026): eine weitere Datei kam hinzu -- der /health-Waechter, gefunden
// ueber die Achse `version`. K2 hat sie gemeldet, nicht das Inventar sie stillschweigend
// aufgenommen; nachgefuehrt wurde genau dieser eine Eintrag.
// ------------------------------------------------------------------------------------------------
const INVENTAR: readonly string[] = [
  "apps/web/src/components/KlaraPathTeaser.test.tsx",
  "services/app/src/klara-answer-explanation.test.ts",
  "services/app/src/routes/addin-static-routes.test.ts",
  "services/app/src/routes/klara-ai-routes.test.ts",
  "services/app/src/services/klara-session-service.test.ts",
  "services/app/src/web-static.test.ts",
  "services/reasoner/src/klara-policy.test.ts",
  "tests/app/contrast-tokens-d5.test.ts",
  "tests/app/csp-upgrade-insecure-requests.test.ts",
  // G24 (JOB 1601/1610): neu im Baum und von der Erhebung gefunden. Der Waechter der
  // KI-Kennzeichnung gehoert sachlich in die Klara-Regression — er haelt fest, dass die
  // Erzeugungsbehauptung nur am echten Serververtrag haengt. K2 hat ihn gemeldet, das Inventar
  // hat ihn nicht stillschweigend aufgenommen.
  "tests/app/g24-ki-kennzeichnung-laufzeitpruefung.test.ts",
  "tests/app/g27-klara-library-current-truth.test.ts",
  // JOB 1113: neu und von der Achse `version` gefunden (Muster `version\.ts`) — der Wächter für
  // /health mit Version und Deploy-Commit gehört sachlich zum Versionsschritt.
  "tests/app/health-version-commit.test.ts",
  // JOB 2244 D1 (A19b): der Plattformvertrag des Command-Palette-Kuerzels. Von der Achse
  // `palette` gefunden (Muster `palette`, Zeile 103) — die Datei mountet `CommandPalette` und
  // nennt sie durchgaengig. K2 hat sie gemeldet, das Inventar nimmt sie nicht still auf.
  "tests/app/job2244-a19b-kuerzel-plattformvertrag-mounted.test.tsx",
  "tests/app/k1-word-addin-origin-panel.test.ts",
  // KA2 (JOB 1571 · D5): neu im Baum und von der Erhebung gefunden. Der Vertragswaechter gehoert
  // sachlich in die Klara-Regression — er haelt Regel A fest (das Panel besitzt
  // `window.klaraBestandsblick` unbedingt), und KA3 sowie W6 setzen auf genau diese Zusage auf.
  // K2 hat ihn gemeldet, das Inventar hat ihn nicht stillschweigend aufgenommen.
  "tests/app/ka2-vertrag-bestandsblick.test.ts",
  // JOB 1720 D1 (KA3): der erste Vertrag fuer die Angebotskarten. Er laedt das ausgelieferte
  // Aufgabenfenster und misst Pedis Auflage am VERHALTEN — Inhaltsachse `taskpane`, deshalb
  // verlangt K2 diesen Eintrag. Nachgefuehrt in JOB 1571 D9, nachdem K2 ihn gemeldet hat.
  "tests/app/ka3-fokusverhalten.test.tsx",
  "tests/app/klara-ai-header.test.ts",
  "tests/app/klara-ai-session-consent.test.ts",
  "tests/app/klara-ai-status-contract.test.ts",
  "tests/app/klara-retrieval-only-remains-safe.test.ts",
  "tests/app/klara-session-consent-ui.test.ts",
  "tests/app/mega34-word-einstufung.test.ts",
  "tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx",
  "tests/app/mega36-word-ausgaenge.test.tsx",
  "tests/app/mega38-word-ziehweg.test.tsx",
  "tests/app/mega40-kontrast-modern.test.ts",
  "tests/app/mega40-theme-invarianz.test.ts",
  "tests/app/mega40-token-disziplin.test.ts",
  "tests/app/mega43-klara-werkbank-palette.test.ts",
  "tests/app/mega45-word-textrueckfall.test.ts",
  "tests/app/mega52-vertrauenswert-sammler.test.ts",
  // JOB 504 D3: die Fallmatrix des fortgesetzten Entwurfs. Sie trägt „klara" nicht im Namen, wohl
  // aber im Inhalt — der geprüfte Deep-Link `/capture/frontdoor?draft=…` ist genau der, den das
  // Klara-Taskpane baut. Damit greift die Inhaltsachse `taskpane`, und K2 verlangt diesen Eintrag.
  "tests/app/mega69-capture-draft-resume.test.tsx",
  "tests/app/mega69-klara-auslieferung.test.ts",
  "tests/app/mega69-klara-merkmale.test.ts",
  "tests/app/mega69-klara-waechter.test.ts",
  "tests/app/mega71-onsend-synchron.test.ts",
  "tests/app/mega74-klara-bilder.test.ts",
  "tests/app/mega75-klara-ki-status.test.ts",
  "tests/app/mega77-klara-wortlaut-und-frist.test.ts",
  "tests/app/mega79-klara-antwort-ohne-modell.test.ts",
  "tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts",
  "tests/app/mobile-drawer-modality-mounted.test.tsx",
  "tests/app/pro375-terminologie-vertrag.test.ts",
  "tests/app/theme-deckungsregister.test.ts",
  "tests/app/w1-klara-lifecycle-taskpane.test.tsx",
  "tests/app/w1-klara-vertrauenskopf.test.ts",
  // W5 (JOB 1591 D2): der Pruefstand zu „vorhanden, aber ungeprueft" — gemeldet, nie behauptet.
  // K2 hat ihn gemeldet, statt ihn still aufzunehmen; nachgefuehrt in JOB 1571 D9.
  "tests/app/w5-ungeprueft-gemeldet.test.ts",
  // W6 (JOB 1621): neu im Baum und von der Erhebung ueber die Achse `taskpane` gefunden. Der
  // Waechter des Dublettenwegs gehoert sachlich in die Klara-Regression — er haelt fest, dass der
  // Aufruf von `POST /api/check-text` fail-closed bleibt und nichts ueber den Bestand erfindet.
  // K2 hat ihn gemeldet, das Inventar hat ihn nicht stillschweigend aufgenommen.
  "tests/app/w6-dublettenweg-checktext.test.ts",
  "tests/app/word-addin-ask.test.ts",
  "tests/app/word-addin-csp.test.ts",
  "tests/app/word-addin-taskpane-cache.test.ts",
  "tests/app/word-addin-taskpane-version-contract.test.ts",
  "tests/app/word-addin.test.ts",
  "tests/ask/g27-klara-volltext.test.ts",
  "tests/capture/basic-u2-suchraum-bibliothek.test.tsx",
  "tests/capture/mega69-bildweg-mounted.test.tsx",
  // JOB 2384 D1: die Nutzlast von `rebindSession` — welcher Wert in welche Spalte von
  // `klara_sessions` geht. Sachlich Klara-Regression: eine Vertauschung von
  // `document_context_id` und `resolution_id` schreibt Klaras Sitzungsbindung still falsch.
  "tests/db/i10-klara-rebind-nutzlast.test.ts",
  // JOB 2376 D1: die Transaktionsklammer, die eine Fassung des Klara-Regelwerks schreibt
  // (`klara-policy-store.ts:667`). Sachlich Klara-Regression: bricht der Schreibweg auf halbem
  // Weg ab, sieht ein Leser eine Sitzung, deren Regelwerk und Zustimmung nicht zusammenpassen.
  "tests/db/i10-klara-regelwerk-klammer.test.ts",
  "tests/help/klara-registry.test.ts",
  "tests/i18n/mega35-word-wortliste.test.ts",
  "tests/legal/mega61-ki-satz.test.ts",
  "tests/legal/mega62-kontrast-pflichtflaechen.test.ts",
  "tests/library/mega59-nullzustand-mounted.test.tsx",
  "tests/security/mega74-anhang-vertraulich.test.ts",
];

// ------------------------------------------------------------------------------------------------
// Erhebung
// ------------------------------------------------------------------------------------------------

function testDateienUnter(dir: string): string[] {
  const raus: string[] = [];
  if (!existsSync(dir)) {
    return raus;
  }
  for (const eintrag of readdirSync(dir)) {
    const pfad = join(dir, eintrag);
    if (eintrag === "node_modules") {
      continue;
    }
    if (statSync(pfad).isDirectory()) {
      raus.push(...testDateienUnter(pfad));
    } else if (/\.test\.tsx?$/.test(eintrag)) {
      raus.push(pfad);
    }
  }
  return raus;
}

const ALLE: readonly string[] = FLAECHEN.flatMap((f) => testDateienUnter(join(WURZEL, f)))
  .map((p) => relative(WURZEL, p))
  .filter((p) => p !== SELBST)
  .sort();

/** Trifft die Achse diese Datei? Pfadachsen lesen den Pfad, Inhaltsachsen die Quelle. */
function trifft(achse: Achse, kurz: string): boolean {
  if (achse.wo === "pfad") {
    return achse.muster.test(kurz);
  }
  return achse.muster.test(readFileSync(join(WURZEL, kurz), "utf8"));
}

function mengeVon(achsen: readonly Achse[]): string[] {
  return ALLE.filter((kurz) => achsen.some((a) => trifft(a, kurz)));
}

const GEFUNDEN = mengeVon(ACHSEN);

/**
 * Der Git-Blob-SHA-1 einer Datei, ohne `git` aufzurufen.
 *
 * Git hasht nicht den blossen Inhalt, sondern `blob <Bytelaenge>` + NUL-Byte + Inhalt. Das NUL
 * gehoert zum Kopf und ist kein Leerzeichen; K6 rechnet deshalb an der leeren Datei gegen — ein
 * falsch gebauter Kopf faellt dort sofort um, statt 51 falsche Pins zu liefern.
 */
function blobSha1Von(inhalt: Buffer): string {
  return createHash("sha1").update(`blob ${inhalt.length}\0`).update(inhalt).digest("hex");
}

function blobSha1(kurz: string): string {
  return blobSha1Von(readFileSync(join(WURZEL, kurz)));
}

describe("JOB 920 · K — das Klara-Regressionsinventar ist ableitbar, nicht behauptet", () => {
  it("K1 · der Sammler erreicht den ganzen Baum und laeuft nicht ins Leere", () => {
    // Selbstschutz: eine leere Grundmenge machte jede Aussage darunter wertlos.
    expect(ALLE.length, "keine Testdateien gefunden").toBeGreaterThan(500);
    expect(GEFUNDEN.length).toBeGreaterThan(0);
  });

  it("K2 · die abgeleitete Menge ist exakt das gepinnte Inventar", () => {
    const neu = GEFUNDEN.filter((p) => !INVENTAR.includes(p));
    const weg = INVENTAR.filter((p) => !GEFUNDEN.includes(p));
    // KEIN Defekt, sondern die Nachfuehrpflicht: wer eine Klara-relevante Testdatei anlegt oder
    // entfernt, aendert die Regressionsmenge — und das muss im Inventar ankommen, nicht still
    // geschehen. Genau die Wiederholbarkeit, die BEN3 `:11` vermisst hat.
    expect(neu, "neu im Baum, aber nicht im gepinnten Inventar — Inventar nachfuehren").toEqual([]);
    expect(weg, "im Inventar gepinnt, aber im Baum nicht mehr gefunden").toEqual([]);
  });

  it("K3 · jede Achse ist kalibriert: Positivdatei greift, Gegenprobe greift NICHT", () => {
    const befunde: string[] = [];
    for (const achse of ACHSEN) {
      if (!existsSync(join(WURZEL, achse.positiv))) {
        befunde.push(`${achse.kennung}: Positivdatei ${achse.positiv} existiert nicht`);
        continue;
      }
      if (!existsSync(join(WURZEL, achse.gegenprobe))) {
        befunde.push(`${achse.kennung}: Gegenprobe ${achse.gegenprobe} existiert nicht`);
        continue;
      }
      if (!trifft(achse, achse.positiv)) {
        befunde.push(
          `${achse.kennung}: die Achse findet ihre eigene Positivdatei ${achse.positiv} NICHT — sie ist ausgefallen oder ihr Muster ist zerstoert`,
        );
      }
      if (trifft(achse, achse.gegenprobe)) {
        befunde.push(
          `${achse.kennung}: die Achse greift auf ihre Gegenprobe ${achse.gegenprobe} — sie ist zu weit und misst nicht mehr, was sie behauptet`,
        );
      }
    }
    expect(befunde, "Achse ohne tragende Kalibrierung").toEqual([]);
    expect(ACHSEN, "weniger als sechs Achsen — eine ist weggefallen").toHaveLength(6);
  });

  it("K4 · der Eigenbeitrag jeder Achse ist gemessen, nicht angenommen", () => {
    // Was traegt eine Achse allein bei? Gemessen als Differenz zur Menge OHNE sie.
    const eigen = new Map<string, number>();
    for (const achse of ACHSEN) {
      const ohne = mengeVon(ACHSEN.filter((a) => a.kennung !== achse.kennung));
      eigen.set(achse.kennung, GEFUNDEN.length - ohne.length);
    }
    // Fuenf der sechs Achsen tragen heute mindestens eine Datei allein.
    const alleine = [...eigen.entries()].filter(([, n]) => n > 0).map(([k]) => k);
    expect(alleine.length, `Eigenbeitraege: ${JSON.stringify([...eigen])}`).toBeGreaterThanOrEqual(
      5,
    );
    // UND DIE AUSNAHME WIRD BENANNT STATT VERSCHWIEGEN: `manifest` ist auf diesem Stand
    // vollstaendig von anderen Achsen ueberdeckt. Ihr Wegfall verkleinerte die Menge also NICHT —
    // die Achse bleibt trotzdem gebunden, weil sie ein eigenes Risiko traegt (Word findet die
    // Flaeche ueber SourceLocation) und morgen die einzige sein kann, die eine Datei einfaengt.
    // Genau deshalb haengt ihre Wirksamkeit an K3, nicht an dieser Zahl.
    expect(eigen.get("manifest"), "manifest traegt jetzt allein bei — Kommentar nachfuehren").toBe(
      0,
    );
  });

  it("K5 · die Dateinamenssuche allein verfehlt den groesseren Teil der Menge", () => {
    const nurName = mengeVon(ACHSEN.filter((a) => a.kennung === "name"));
    const verfehlt = GEFUNDEN.filter((p) => !nurName.includes(p));
    // Der methodische Kern von BENs Ruege am D2-Verfahren, als Zahl statt als Satz.
    // 22 -> 23 am 18.08.2026: `word-addin-taskpane-version-contract.test.ts` kam mit der
    // Integration der Nachtstaende dazu und traegt "klara" nicht im Namen, wohl aber im Inhalt.
    // Die Zahl ist der Ist-Stand; der methodische Kern ist die Zeile darunter -- die
    // Dateinamenssuche verfehlt weiterhin den groesseren Teil der Menge.
    // 23 -> 24 am 26.08.2026 (JOB 2384 D1): `tests/db/i10-klara-rebind-nutzlast.test.ts` traegt
    // "klara" im Namen und wird deshalb von der Namensachse selbst gefunden.
    // 24 -> 25 am 26.08.2026 (JOB 2376 D1, zugestellt in JOB 2435):
    // `tests/db/i10-klara-regelwerk-klammer.test.ts` traegt "klara" ebenfalls im Namen.
    // ZUR ZAHL: In JOB 2376 D1 selbst lautete die Nachfuehrung 23 -> 24, weil JOB 2384 damals
    // noch nicht im Baum war. Es ist dieselbe Nachfuehrung auf einem inzwischen weitergezogenen
    // Stand, keine zweite Aenderung.
    expect(nurName.length).toBe(25);
    expect(verfehlt.length).toBeGreaterThanOrEqual(25);
    expect(verfehlt.length + nurName.length).toBe(GEFUNDEN.length);
  });

  it("K6 · jede Inventardatei traegt einen wohlgeformten Git-Blob-SHA-1 (Bericht)", () => {
    const zeilen: string[] = [];
    for (const kurz of INVENTAR) {
      const sha = blobSha1(kurz);
      expect(sha, `${kurz}: kein wohlgeformter Blob-SHA-1`).toMatch(/^[0-9a-f]{40}$/);
      const achsen = ACHSEN.filter((a) => trifft(a, kurz)).map((a) => a.kennung);
      expect(
        achsen.length,
        `${kurz} ist im Inventar, aber von keiner Achse gedeckt`,
      ).toBeGreaterThan(0);
      zeilen.push(`${sha}  ${achsen.join(",").padEnd(36)} ${kurz}`);
    }
    // KALIBRIERUNG DURCH DIESELBE FUNKTION, nicht daneben: Die erste Fassung rechnete den
    // bekannten Wert mit einem eigenen, inline gebauten Kopf nach — eine Gegenmutation am Kopf von
    // `blobSha1Von` blieb dadurch gruen. Der Fall pruefte die Formel, nicht den Code. Jetzt laeuft
    // die leere Eingabe durch genau die Funktion, die auch die Pins oben erzeugt.
    expect(blobSha1Von(Buffer.alloc(0))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    // Der Sammler nimmt genau eine Datei aus — und findet trotzdem jede andere.
    expect(ALLE).not.toContain(SELBST);
    expect(GEFUNDEN).toContain("tests/app/w1-klara-lifecycle-taskpane.test.tsx");
    console.log(
      `\nJOB 920 D4 — Klara-Regressionsinventar (${INVENTAR.length} Dateien, Git-Blob-SHA-1):\n${zeilen.join("\n")}\n`,
    );
  });
});
