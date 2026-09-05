// ================================================================================================
// FREEZE-144 — DER WÄCHTER ÜBER SECHS EINGEFRORENE DATEIEN, UND ÜBER SEINE EIGENE FREIGABE.
// ================================================================================================
//
// WOZU ES IHN GIBT. Sechs Dateien des Moduls `library-analytics` sind eingefroren. Wer eine davon
// ändert, muss das ausweisen — nicht stillschweigend tun. Der Wächter macht die Suite rot, sobald
// eine der sechs von ihrem festgehaltenen Inhalt abweicht.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESER DURCHGANG (D5) ANDERS MACHT ALS D4 — UND WARUM
// ------------------------------------------------------------------------------------------------
//
// BEN5 hat den D4-Stand als PRODUKT ROT beurteilt, und der Kern seiner Rüge ist eine einzige, sehr
// konkrete Lücke:
//
//   > „Ein bereits dauerhaft gesetzter `freigabe: FREEZE-144`-Marker verhindert nicht, dass bei
//   > einer späteren Dateiänderung nur der Sollhash nachgezogen wird."
//
// Das trifft zu, und es ist der ganze Unterschied zwischen einer Zusage und einem Wächter: Ein
// KONSTANTER Marker steht an jedem Eintrag und muss bei einem Hashwechsel nicht angefasst werden.
// Er kann eine Änderung deshalb nicht autorisieren — er war schon da, bevor sie geschah.
//
// DIE ANTWORT DARAUF, und sie ist der fachliche Kern dieses Durchgangs: **Die Freigabe trägt den
// Hash, den sie autorisiert.** Ein Eintrag ist nur dann gültig, wenn
//
//     freigabe.autorisiertHash === eintrag.hash
//
// Wer den Sollhash allein nachzieht, lässt `autorisiertHash` auf dem ALTEN Wert stehen — und der
// Wächter wird rot. Wer grün werden will, muss die Freigabe MIT ändern; damit stehen Dateiänderung,
// neuer Sollhash und neue Freigabe zwangsläufig in EINEM überprüfbaren Änderungssatz. Genau das
// verlangt BEN5s Prüflücke 2.
//
// Dazu zwei Sperren gegen die naheliegenden Umgehungen:
//   · Freigabe-IDs sind JE EINTRAG eindeutig. Ein einziger Sammelmarker für alle sechs ist damit
//     ausgeschlossen — er war der D4-Defekt.
//   · Widerrufene IDs sind namentlich gesperrt und autorisieren nie wieder etwas. `FREEZE-144` als
//     konstanter Marker steht in dieser Liste: die alte Form darf keinen neuen Hash decken.
//
// ------------------------------------------------------------------------------------------------
// § GRENZE — WAS DIESER WÄCHTER NICHT KANN, UND ZWAR AUSDRÜCKLICH
// ------------------------------------------------------------------------------------------------
//
// Er prüft die FORM der Freigabe, nicht ihre AUTORITÄT. Er kann nicht wissen, ob ein Mensch sie
// erteilt hat; eine ID ist Text in einer Datei. Was er leistet, ist die Unmöglichkeit einer
// unbemerkten Änderung: Jede Hashänderung erzwingt eine sichtbare, neue Freigabezeile im selben
// Diff. Das ist eine VERSEHENTLICHKEITSSPERRE und ein Prüfanker für die Durchsicht — keine
// Zugangskontrolle.
//
// WER die Freigaben zeichnet, ist eine offene Ownerfrage. Sie wird hier NICHT entschieden und
// nicht geraten (siehe Rückgabe, Restgrenzen).
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ------------------------------------------------------------------------------------------------
// DIE REPOSITORY-WURZEL KOMMT AUS DEM DATEIORT, NICHT AUS DEM PROZESS-VERZEICHNIS.
//
// `process.cwd()` ist eine Eigenschaft des AUFRUFS, nicht des Repositories. Ein Lauf aus einem
// Unterverzeichnis fände die sechs Dateien nicht mehr — und der Wächter wäre grün, ohne etwas
// geprüft zu haben. Diese Datei liegt in `tests/`, die Wurzel ist also genau eine Ebene darüber.
// ------------------------------------------------------------------------------------------------
const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Freigabe {
  /** Eindeutige Kennung dieses Freigabevorgangs. Ein Sammelmarker ist ausgeschlossen. */
  readonly id: string;
  /** Der Hash, den GENAU DIESE Freigabe autorisiert. Er muss zum Eintrag passen. */
  readonly autorisiertHash: string;
}

interface FreezeEintrag {
  /** Repository-relativ. Absolute Pfade und `..` sind verboten — sie wären nicht portabel. */
  readonly pfad: string;
  readonly hash: string;
  readonly freigabe: Freigabe;
}

/** Freigabe-IDs, die verbraucht sind und nie wieder etwas autorisieren dürfen. */
const WIDERRUFENE_FREIGABEN: readonly string[] = [
  // Der konstante Sammelmarker aus D4. BEN5: er verhindert das blosse Nachziehen eines Hashes
  // nicht, weil er bei der Änderung gar nicht angefasst werden muss.
  "FREEZE-144",
  // JOB 3022: verbraucht. Diese Freigabe autorisierte den `types.ts`-Stand VOR der additiven
  // Erweiterung von `Graph` (totalEdges/truncated/edgeLimit/excludedTags) — sie darf den neuen
  // Inhalt nicht nachträglich decken. Ihre Nachfolgerin steht am Eintrag.
  "FREEZE-144/D5-20260817/types",
  // JOB 3022 (Zwischenstand): verbraucht. Autorisierte `types.ts` NUR mit der `Graph`-Erweiterung,
  // noch ohne den JOB-3023-Port (`DublettenBefund`/`DublettenPruefung`, `ImportResult.uebersprungen`).
  // Beide Änderungen liegen jetzt im selben Stand; die Nachfolgerin deckt ihn gemeinsam.
  "FREEZE-144/JOB3022-20260903/types",
  // JOB 3050: verbraucht. Diese drei Freigaben autorisierten den Stand VOR der Dublettenprüfung am
  // KANDIDATENWEG (`KandidatDublettenbefund`/`Dublettentreffer` in types.ts, deren Ausleitung in
  // index.ts, und der Pflicht-Port an `createImportCandidates`, den service.test.ts nun übergibt).
  // Sie dürfen den neuen Inhalt nicht nachträglich decken; ihre Nachfolgerinnen stehen am Eintrag.
  "FREEZE-144/JOB3023-20260903/index",
  "FREEZE-144/JOB3023-20260903/types",
  "FREEZE-144/JOB3023-20260903/service-test",
  // JOB 3081: verbraucht. Diese Freigabe autorisierte den `types.ts`-Stand VOR dem fuenften Ausgang
  // von `KandidatDublettenbefund` (`im_papierkorb`) — sie darf den neuen Inhalt nicht nachtraeglich
  // decken. Ihre Nachfolgerin steht am Eintrag.
  "FREEZE-144/JOB3050-20260904/types",
];

const ERWARTETE_ANZAHL = 6;

/**
 * DAS MANIFEST — sechs Dateien, sechs Hashes, sechs eigene Freigaben.
 *
 * Die Hashes sind am gebundenen Stand `9208d494b99ba9f93233b0e951354d65582ba03e` gemessen. Drei
 * von ihnen (`types.ts`, `repo.ts`, `repo-pg.ts`) unterscheiden sich von den Werten, die D4 an
 * seiner damaligen Base festgehalten hat: die Dateien haben sich zwischen den Basen geändert. Das
 * ist kein Fehler des Wächters, sondern genau der Vorgang, für den er da ist — und deshalb trägt
 * jeder Eintrag hier eine eigene, auf seinen Hash lautende Freigabe.
 */
const FREEZE_MANIFEST: readonly FreezeEintrag[] = [
  {
    pfad: "services/library-analytics/index.ts",
    // JOB 3023: der Port der Dublettenregel (`DublettenPruefung`, `DublettenBefund`,
    // `UebersprungenGrund`, `UebersprungenerImport`) wird hier heraus exportiert — ohne ihn koennte
    // die Kompositionswurzel die Pruefung nicht typisiert uebergeben.
    // JOB 3050 · AUSGEWIESENE ÄNDERUNG: zusätzlich ist `KandidatDublettenbefund` ausgeleitet — der
    // Befund derselben Frage am Review-Kandidaten, den das Antwort-DTO der Route ausweist.
    hash: "e56fc11f9e6e6af4c8ed26d89d0c5b3649e9762bbe3fe286d0808cbb82509f24",
    freigabe: {
      id: "FREEZE-144/JOB3050-20260904/index",
      autorisiertHash: "e56fc11f9e6e6af4c8ed26d89d0c5b3649e9762bbe3fe286d0808cbb82509f24",
    },
  },
  // JOB 3022 · AUSGEWIESENE ÄNDERUNG. `Graph` (types.ts:185-204) trägt seit dem Umbau von
  // `graph()` seine Grenzen mit: `totalEdges`, `truncated`, `edgeLimit`, `excludedTags` — additiv,
  // `nodes`/`edges` unverändert. Zusätzlich ist der Kommentar über `Neighborhood` nachgeführt, der
  // den globalen Graphen noch als „O(n²), bleibt unangetastet (Register H5)" beschrieb; genau das
  // ist er nicht mehr. Sollhash UND Freigabe sind in EINEM Änderungssatz neu gesetzt, die alte
  // Freigabe steht in WIDERRUFENE_FREIGABEN.
  {
    pfad: "services/library-analytics/src/types.ts",
    // JOB 3023 (nach Rebase auf JOB 3022): der Stand trägt jetzt BEIDE Änderungen — die additive
    // `Graph`-Erweiterung aus JOB 3022 UND den Port der Dublettenregel aus JOB 3023
    // (`DublettenBefund`/`DublettenPruefung`, `ImportResult.uebersprungen`). Der Hash ist neu aus der
    // zusammengeführten Datei gemessen, nicht aus einer der beiden Einzeländerungen übernommen.
    // JOB 3050 · AUSGEWIESENE ÄNDERUNG: `Dublettentreffer` und `KandidatDublettenbefund` sind neu
    // (der Befund derselben Frage am Review-Kandidaten, vier Ausgänge statt zwei), `ImportCandidate`
    // trägt das additive Feld `dublettenbefund`, und der überholte Kommentar am Feld `duplicate`
    // („Gleiche title|statement existiert bereits") ist berichtigt.
    // JOB 3081 · AUSGEWIESENE ÄNDERUNG: `KandidatDublettenbefund` hat einen FÜNFTEN Ausgang —
    // `{ ergebnis: "im_papierkorb"; treffer: Dublettentreffer }`. Er gehört dem externalId-/Anker-
    // Strang und sagt vor der Review-Entscheidung, dass dieses Wissen im Papierkorb liegt und
    // welches Objekt gemeint ist (Codex' Live-Befund R-0192, 05.09.2026). REIN ADDITIV: keine
    // vorhandene Variante ist geändert, `Dublettentreffer` ist unangetastet (es entsteht KEINE
    // neue Trefferform), und `nicht_gestellt` bleibt für den aktiven Re-Sync. Sollhash UND
    // Freigabe sind in EINEM Änderungssatz neu gesetzt, die alte steht in WIDERRUFENE_FREIGABEN.
    hash: "32bb256089c89e382b3c2c47f36c293c835e134e142198a45f4c5e36ab2badcd",
    freigabe: {
      id: "FREEZE-144/JOB3081-20260905/types",
      autorisiertHash: "32bb256089c89e382b3c2c47f36c293c835e134e142198a45f4c5e36ab2badcd",
    },
  },
  {
    pfad: "services/library-analytics/src/repo.ts",
    hash: "37b3000538fd6fb0274b1ad6f8f4a8660720d6b595c2fa7819f21804d3714510",
    freigabe: {
      id: "FREEZE-144/D5-20260817/repo",
      autorisiertHash: "37b3000538fd6fb0274b1ad6f8f4a8660720d6b595c2fa7819f21804d3714510",
    },
  },
  {
    pfad: "services/library-analytics/src/repo-pg.ts",
    hash: "a965c371f00aee7ba2e32648e8c02c5d8151458862d6adeb042f6efb6ff93ed9",
    freigabe: {
      id: "FREEZE-144/D5-20260817/repo-pg",
      autorisiertHash: "a965c371f00aee7ba2e32648e8c02c5d8151458862d6adeb042f6efb6ff93ed9",
    },
  },
  {
    pfad: "services/library-analytics/src/service.test.ts",
    // JOB 3023: `importJson` nimmt den Port als PFLICHT entgegen; die drei Aufrufer dieser Datei
    // uebergeben ihn ausdruecklich und der Bestandsfall prueft die neue `uebersprungen`-Liste.
    // JOB 3050 · AUSGEWIESENE ÄNDERUNG: `createImportCandidates` nimmt den Port jetzt ebenfalls
    // entgegen, und OHNE ihn gilt jeder Eintrag fail-closed als nicht prüfbar (kein `accept` legt
    // dann an). FÜNF Fälle dieser Datei messen genau das Anlegen; sie übergeben den Port darum
    // ausdrücklich — die schon vorhandene, nie treffende `OHNE_AEHNLICHKEIT` aus JOB 3023, damit
    // ihre Zusicherungen unverändert das messen, was sie vorher gemessen haben (Pass 1, exakte
    // Zeichengleichheit). Kein weiterer Aufrufer dieser Datei ist angefasst.
    hash: "1b0779a403ddede006ff78a6289d94016fdb50b4bc40c3fd246a644ed94d49f9",
    freigabe: {
      id: "FREEZE-144/JOB3050-20260904/service-test",
      autorisiertHash: "1b0779a403ddede006ff78a6289d94016fdb50b4bc40c3fd246a644ed94d49f9",
    },
  },
  {
    pfad: "services/library-analytics/src/repo-pg.integration.test.ts",
    hash: "d415952ea7cffc493e33adec0d5e736374a524c0883a0ef2191cebd29bb2e5e4",
    freigabe: {
      id: "FREEZE-144/D5-20260817/repo-pg-integration",
      autorisiertHash: "d415952ea7cffc493e33adec0d5e736374a524c0883a0ef2191cebd29bb2e5e4",
    },
  },
];

/** Ein Leser gibt den Inhalt zurück oder `undefined`, wenn die Datei nicht existiert. */
type Leser = (pfad: string) => string | undefined;

/**
 * Der echte Leser. `ENOENT` heisst „fehlt" und wird als `undefined` gemeldet; JEDER ANDERE Fehler
 * wird GEWORFEN.
 *
 * Die Unterscheidung ist der Punkt: Ein Rechtefehler als „fehlt" zu melden hiesse, ein Leseproblem
 * in eine Aussage über den Bestand zu verwandeln — und der Wächter meldete dann den falschen
 * Mangel.
 */
const echterLeser: Leser = (pfad) => {
  try {
    return readFileSync(join(REPO_WURZEL, pfad), "utf8");
  } catch (fehler) {
    if ((fehler as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw fehler;
  }
};

function sha256(inhalt: string): string {
  return createHash("sha256").update(inhalt).digest("hex");
}

/**
 * Prüft das MANIFEST selbst — bevor irgendeine Datei gelesen wird.
 *
 * Ohne diese Stufe wäre der Wächter durch Streichen seiner eigenen Einträge abschaltbar: eine
 * leere Liste prüft nichts und ist grün.
 */
function pruefeManifest(manifest: readonly FreezeEintrag[]): string[] {
  const fehler: string[] = [];
  if (manifest.length !== ERWARTETE_ANZAHL) {
    fehler.push(
      `Freeze-144 Manifest: ${ERWARTETE_ANZAHL} Eintraege erwartet, ${manifest.length} gefunden.`,
    );
  }
  const pfade = new Set<string>();
  const freigabeIds = new Set<string>();
  for (const eintrag of manifest) {
    if (pfade.has(eintrag.pfad)) {
      fehler.push(`Freeze-144 Manifest: Pfad doppelt: ${eintrag.pfad}`);
    }
    pfade.add(eintrag.pfad);
    if (isAbsolute(eintrag.pfad) || eintrag.pfad.includes("..")) {
      fehler.push(`Freeze-144 Manifest: Pfad nicht repository-relativ: ${eintrag.pfad}`);
    }
    if (!/^[0-9a-f]{64}$/.test(eintrag.hash)) {
      fehler.push(`Freeze-144 Manifest: kein SHA-256: ${eintrag.pfad}`);
    }
    // --- die Freigabepflichten ---
    if (eintrag.freigabe.id.trim().length === 0) {
      fehler.push(`Freeze-144 Manifest: Freigabe ohne Kennung: ${eintrag.pfad}`);
    }
    if (WIDERRUFENE_FREIGABEN.includes(eintrag.freigabe.id)) {
      fehler.push(
        `Freeze-144 Manifest: widerrufene Freigabe ${eintrag.freigabe.id} autorisiert nichts mehr: ${eintrag.pfad}`,
      );
    }
    if (freigabeIds.has(eintrag.freigabe.id)) {
      fehler.push(
        `Freeze-144 Manifest: Freigabe ${eintrag.freigabe.id} deckt mehr als einen Eintrag: ${eintrag.pfad}`,
      );
    }
    freigabeIds.add(eintrag.freigabe.id);
    // DIE ENTSCHEIDENDE REGEL: die Freigabe autorisiert GENAU diesen Hash.
    if (eintrag.freigabe.autorisiertHash !== eintrag.hash) {
      fehler.push(
        [
          `Freeze-144 Manifest: Freigabe deckt diesen Hash nicht: ${eintrag.pfad}`,
          `  Sollhash im Eintrag:  ${eintrag.hash}`,
          `  von der Freigabe autorisiert: ${eintrag.freigabe.autorisiertHash}`,
          `  Freigabe: ${eintrag.freigabe.id}`,
          "  Ein nachgezogener Hash ohne neue Freigabe ist keine autorisierte Aenderung.",
        ].join("\n"),
      );
    }
  }
  return fehler;
}

/** Die Fehlmeldung einer einzelnen Datei — Pfad, erwartet, gemessen. Nie ein roher Stacktrace. */
function meldung(eintrag: FreezeEintrag, gemessen: string | undefined): string {
  return [
    `Freeze-144 verletzt: ${eintrag.pfad}`,
    `  erwartet: ${eintrag.hash}`,
    `  gemessen: ${gemessen ?? "FEHLT"}`,
  ].join("\n");
}

/** Prüft die sechs Dateien gegen ihre Sollhashes. Der Leser ist einspeisbar. */
function pruefeFreeze(manifest: readonly FreezeEintrag[], leser: Leser): string[] {
  const fehler: string[] = [];
  for (const eintrag of manifest) {
    const inhalt = leser(eintrag.pfad);
    const gemessen = inhalt === undefined ? undefined : sha256(inhalt);
    if (gemessen !== eintrag.hash) {
      fehler.push(meldung(eintrag, gemessen));
    }
  }
  return fehler;
}

/** Ein Leser aus einer Tabelle — für Negativfälle, ohne eine einzige Datei anzulegen. */
function tabellenLeser(tabelle: Readonly<Record<string, string>>): Leser {
  return (pfad) => (pfad in tabelle ? tabelle[pfad] : undefined);
}

/** Der heile Bestand als Tabelle: jeder Eintrag trägt genau den Inhalt, der seinen Sollhash ergibt. */
function heileTabelle(): Record<string, string> {
  const tabelle: Record<string, string> = {};
  for (const eintrag of FREEZE_MANIFEST) {
    const inhalt = echterLeser(eintrag.pfad);
    if (inhalt === undefined) {
      throw new Error(`Kalibrierung unmoeglich: ${eintrag.pfad} fehlt im Arbeitsbaum.`);
    }
    tabelle[eintrag.pfad] = inhalt;
  }
  return tabelle;
}

describe("Freeze-144 · 1 · das Manifest traegt sich selbst", () => {
  it("das gebundene Manifest ist sauber", () => {
    expect(pruefeManifest(FREEZE_MANIFEST)).toEqual([]);
  });

  it("eine LEERE Sollliste faellt auf — sonst waere der Waechter abschaltbar", () => {
    expect(pruefeManifest([])).not.toEqual([]);
  });

  it("eine VERKUERZTE Liste faellt auf", () => {
    expect(pruefeManifest(FREEZE_MANIFEST.slice(0, 5))).not.toEqual([]);
  });

  it("ein doppelter Pfad faellt auf", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    expect(pruefeManifest([...FREEZE_MANIFEST, erster])).not.toEqual([]);
  });

  it("ein absoluter Pfad faellt auf — er waere nicht portabel", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    const kaputt = [
      { ...erster, pfad: "/tmp/library-analytics/index.ts" },
      ...FREEZE_MANIFEST.slice(1),
    ];
    expect(pruefeManifest(kaputt)).not.toEqual([]);
  });
});

// ================================================================================================
// 2 · DER FREIGABEVERTRAG — BEN5s Kernrüge, in Fällen.
// ================================================================================================
describe("Freeze-144 · 2 · die Freigabe autorisiert genau ihren Hash", () => {
  it("GEGENFALL · nur den Sollhash nachziehen wird ROT — die Freigabe deckt ihn nicht", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    // Genau der von BEN5 beschriebene Griff: neuer Hash, Freigabe unangetastet.
    const nachgezogen = [
      { ...erster, hash: `${erster.hash.slice(0, 63)}0` },
      ...FREEZE_MANIFEST.slice(1),
    ];
    const fehler = pruefeManifest(nachgezogen);
    expect(fehler.length).toBeGreaterThan(0);
    expect(fehler.join("\n")).toContain("Freigabe deckt diesen Hash nicht");
    expect(fehler.join("\n")).toContain("keine autorisierte Aenderung");
  });

  it("GEGENFALL · allein die Freigabe aendern wird ebenfalls ROT", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    const nurFreigabe = [
      {
        ...erster,
        freigabe: {
          id: "FREEZE-144/D5-20260817/anders",
          autorisiertHash: `${erster.hash.slice(0, 63)}0`,
        },
      },
      ...FREEZE_MANIFEST.slice(1),
    ];
    expect(pruefeManifest(nurFreigabe)).not.toEqual([]);
  });

  it("GEGENFALL · EIN Sammelmarker fuer alle sechs wird ROT — das war der D4-Defekt", () => {
    const sammel = FREEZE_MANIFEST.map((e) => ({
      ...e,
      freigabe: { id: "FREEZE-144-SAMMEL", autorisiertHash: e.hash },
    }));
    const fehler = pruefeManifest(sammel);
    expect(fehler.length).toBeGreaterThan(0);
    expect(fehler.join("\n")).toContain("deckt mehr als einen Eintrag");
  });

  it("GEGENFALL · eine WIDERRUFENE Freigabe autorisiert nichts mehr", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    const alt = [
      { ...erster, freigabe: { id: "FREEZE-144", autorisiertHash: erster.hash } },
      ...FREEZE_MANIFEST.slice(1),
    ];
    const fehler = pruefeManifest(alt);
    expect(fehler.join("\n")).toContain("widerrufene Freigabe");
  });

  it("Eine Freigabe OHNE Kennung faellt auf", () => {
    const erster = FREEZE_MANIFEST[0];
    if (!erster) {
      throw new Error("Manifest leer.");
    }
    const ohne = [
      { ...erster, freigabe: { id: "   ", autorisiertHash: erster.hash } },
      ...FREEZE_MANIFEST.slice(1),
    ];
    expect(pruefeManifest(ohne)).not.toEqual([]);
  });
});

describe("Freeze-144 · 3 · der Freeze haelt", () => {
  it("alle sechs Dateien tragen ihren eingefrorenen Hash", () => {
    expect(pruefeFreeze(FREEZE_MANIFEST, echterLeser).join("\n")).toBe("");
  });

  it("die Repository-Wurzel wird aus dem DATEIORT abgeleitet, nicht aus dem Prozessverzeichnis", () => {
    // Sie zeigt auf ein echtes Repository, erkennbar an der package.json — und NICHT auf cwd.
    expect(existsSync(join(REPO_WURZEL, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_WURZEL, "services", "library-analytics"))).toBe(true);
  });
});

describe("Freeze-144 · 4 · die Negativfaelle, ohne eine einzige Fixture-Datei", () => {
  it("KALIBRIERUNG · der heile Leser ist gruen — sonst pruefen N1 bis N3 nichts", () => {
    expect(pruefeFreeze(FREEZE_MANIFEST, tabellenLeser(heileTabelle())).join("\n")).toBe("");
  });

  it("N1 · eine VERAENDERTE Datei wird rot, mit Pfad, erwartet und gemessen", () => {
    const tabelle = heileTabelle();
    const ziel = FREEZE_MANIFEST[0];
    if (!ziel) {
      throw new Error("Manifest leer.");
    }
    tabelle[ziel.pfad] = `${tabelle[ziel.pfad]}\n// eine Zeile mehr\n`;
    const text = pruefeFreeze(FREEZE_MANIFEST, tabellenLeser(tabelle)).join("\n");
    expect(text).toContain(ziel.pfad);
    expect(text).toContain(`erwartet: ${ziel.hash}`);
    expect(text).toContain("gemessen: ");
    expect(text).not.toContain("gemessen: FEHLT");
  });

  it("N2 · eine FEHLENDE Datei meldet `gemessen: FEHLT` — ohne rohen Stacktrace", () => {
    const tabelle = heileTabelle();
    const ziel = FREEZE_MANIFEST[1];
    if (!ziel) {
      throw new Error("Manifest zu kurz.");
    }
    delete tabelle[ziel.pfad];
    const text = pruefeFreeze(FREEZE_MANIFEST, tabellenLeser(tabelle)).join("\n");
    expect(text).toContain(ziel.pfad);
    expect(text).toContain("gemessen: FEHLT");
    expect(text).not.toContain("Error");
    expect(text).not.toContain("\n    at ");
  });

  it("N3 · eine UMBENANNTE Datei wird ueber den fehlenden Originalpfad rot", () => {
    const tabelle = heileTabelle();
    const ziel = FREEZE_MANIFEST[2];
    if (!ziel) {
      throw new Error("Manifest zu kurz.");
    }
    const inhalt = tabelle[ziel.pfad];
    delete tabelle[ziel.pfad];
    tabelle[`${ziel.pfad}.umbenannt`] = inhalt ?? "";
    const text = pruefeFreeze(FREEZE_MANIFEST, tabellenLeser(tabelle)).join("\n");
    expect(text).toContain(ziel.pfad);
    expect(text).toContain("gemessen: FEHLT");
  });

  it("ein echter LESEFEHLER wird geworfen, nicht als FEHLT verkleidet", () => {
    const werfenderLeser: Leser = () => {
      const fehler = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
      fehler.code = "EACCES";
      throw fehler;
    };
    // Der Vertrag ist eine Eigenschaft des CODE, nicht des Betriebssystems: ein Rechtefehler darf
    // nicht in eine Aussage ueber den Bestand verwandelt werden. Deshalb eingespeist statt per
    // chmod erzeugt — sonst haenge das Ergebnis daran, ob der Lauf als root faehrt.
    expect(() => pruefeFreeze(FREEZE_MANIFEST, werfenderLeser)).toThrow(/EACCES/);
  });

  // ============================================================================================
  // DER FALL, DEN EINE GEGENMUTATION ERZWUNGEN HAT.
  // ============================================================================================
  //
  // Der Fall darueber speist einen werfenden Leser EIN — er prueft damit `pruefeFreeze`, aber
  // NICHT `echterLeser`. Genau das hat die Gegenmutation GM-4 dieses Durchgangs sichtbar gemacht:
  // `echterLeser` liess sich auf „alles ist FEHLT" umbauen, ohne dass ein einziger Fall rot wurde.
  //
  // Deshalb dieser Fall, und er fasst den ECHTEN Leser an. Er braucht weder Rechte noch root:
  // ein VERZEICHNIS zu lesen scheitert mit `EISDIR` — einem Fehler, der eben NICHT `ENOENT` ist.
  // Wer beides gleich behandelt, verwandelt ein Leseproblem in eine Aussage ueber den Bestand.
  it("echterLeser trennt FEHLT von echtem Fehler — ENOENT ist undefined, alles andere wirft", () => {
    // (a) Wirklich nicht vorhanden -> `undefined`, kein Wurf.
    expect(echterLeser("gibt-es-diesen-pfad-ganz-sicher-nicht.txt")).toBeUndefined();
    // (b) Ein Verzeichnis ist KEINE fehlende Datei -> es muss werfen.
    expect(() => echterLeser("services")).toThrow();
    // (c) Und der heile Fall liest wirklich Inhalt, sonst saehe (a) auch bei totem Leser gut aus.
    expect((echterLeser("package.json") ?? "").length).toBeGreaterThan(0);
  });
});

// ================================================================================================
// 5 · SYMLINK — BEN5s Prüflücke 6. Hier mit ECHTEM Dateisystem, weil sie sonst nichts aussagt.
// ================================================================================================
describe("Freeze-144 · 5 · ein Symlink umgeht die sechs Pfade nicht", () => {
  it("ein Symlink auf einen anderen Inhalt wird rot — der Hash misst das ZIEL", () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), "freeze144-"));
    try {
      const echt = join(verzeichnis, "echt.ts");
      const anders = join(verzeichnis, "anders.ts");
      const verweis = join(verzeichnis, "verweis.ts");
      writeFileSync(echt, "export const a = 1;\n", "utf8");
      writeFileSync(anders, "export const a = 2;\n", "utf8");
      symlinkSync(anders, verweis);
      // Der Verweis IST ein Symlink — sonst prueft der Fall etwas anderes als er behauptet.
      expect(lstatSync(verweis).isSymbolicLink()).toBe(true);

      const sollhash = sha256(readFileSync(echt, "utf8"));
      const manifest: FreezeEintrag[] = [
        {
          pfad: "verweis.ts",
          hash: sollhash,
          freigabe: { id: "TEMP/symlink", autorisiertHash: sollhash },
        },
      ];
      const leser: Leser = (pfad) => readFileSync(join(verzeichnis, pfad), "utf8");
      const text = pruefeFreeze(manifest, leser).join("\n");
      // Gelesen wird durch den Symlink hindurch — also der FREMDE Inhalt, und der passt nicht.
      expect(text).toContain("verweis.ts");
      expect(text).toContain(`erwartet: ${sollhash}`);
      expect(text).not.toContain("gemessen: FEHLT");
    } finally {
      rmSync(verzeichnis, { recursive: true, force: true });
    }
  });
});

// ================================================================================================
// 6 · CI-AUFNAHME — BEN5s Prüflücke 5. Der Wächter belegt selbst, dass er im Pflichttor läuft.
// ================================================================================================
describe("Freeze-144 · 6 · der Waechter laeuft im verpflichtenden Tor", () => {
  it("die CI faehrt `./tools/check`, und dessen Teststufe schliesst `tests/**` ein", () => {
    const ci = echterLeser(".github/workflows/ci.yml");
    expect(ci, "die CI-Beschreibung fehlt").toBeDefined();
    expect(ci ?? "").toContain("./tools/check");

    const vitest = echterLeser("vitest.config.ts");
    expect(vitest, "die Vitest-Konfiguration fehlt").toBeDefined();
    expect(vitest ?? "").toContain('"tests/**/*.test.{ts,tsx}"');

    // Und diese Datei liegt unter `tests/` — sie faellt damit unter genau dieses Muster.
    const eigenerPfad = fileURLToPath(import.meta.url);
    expect(eigenerPfad.startsWith(join(REPO_WURZEL, "tests"))).toBe(true);
  });
});
