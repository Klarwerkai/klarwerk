// ================================================================================================
// JOB 4271 · DER BAUPLAN DES GROSSBESTANDS — IM TOR PRÜFBAR, OHNE DATENBANK UND OHNE BROWSER.
// ================================================================================================
//
// WAS DIESE DATEI IST. Der ausgeführte Nutzerweg braucht eine echte PostgreSQL, einen echten
// Chromium und eine gebaute Fläche; er steht deshalb in
// `findet-im-grossbestand.integration.test.ts` und läuft NUR im Cloud-/Integrationslauf (die
// Begründung dieser Aufteilung steht dort im Kopf). Das Tor fährt bewusst ohne Docker und ohne
// Datenbank (`vitest.config.ts:31-32`) — ein 10.000er-Seed hat dort nichts zu suchen.
//
// WAS SICH TROTZDEM IM TOR PRÜFEN LÄSST, und das ist nicht wenig: der BAUPLAN. Er ist eine reine
// Funktion, und an ihm hängt jede Aussage des grossen Laufs. Ist der Zielbegriff versehentlich auch
// im Titel, misst der grosse Lauf nicht mehr den Volltextfund. Tragen die Ablenker den Begriff,
// misst er nicht mehr die Abgrenzung. Ist die Decoy-Zahl über den Bibliotheksdeckel gerutscht,
// misst er einen Verlust statt eines Fundes. Diese Datei hält genau diese Eigenschaften fest — und
// sie sagt auf stderr LAUT, dass der ausgeführte Lauf hier NICHT stattgefunden hat.
//
// SIE BEHAUPTET AUSDRÜCKLICH NICHT, dass der Nutzerweg funktioniert. Wer das wissen will, liest die
// Ausgabe des Integrationslaufs.
import { describe, expect, it } from "vitest";
import { LIBRARY_SEARCH_HIT_LIMIT } from "../../services/library-analytics/src/service";
import {
  ABLENKER,
  DECKEL_ABLENKUNG,
  FREMDE_VERTRAULICHE,
  FUELLBESTAND,
  GEHEIMWORT,
  GESAMT,
  GRUPPEN_REIHENFOLGE,
  HERKUNFT,
  HERKUNFTSGRUPPE,
  VOLLTEXT_BEGRIFF,
  ZIEL_KENNUNG,
  ZIEL_TITEL,
  bauplan,
  gruppenzaehlung,
  kennungsHash,
  kennungsHashAusGruppen,
  kennungsanzahl,
  manifestAusZeilen,
  manifestZeilen,
} from "./bestand";

const JOB = "[KLARWERK] JOB 4271";

/**
 * Das Anzeigefenster der Fläche — 200 (`apps/web/src/lib/libraryDisplay.ts:3`,
 * `LIBRARY_RESULT_LIMIT`). BEWUSST NICHT IMPORTIERT: der Root-Typcheck dieses Baums ist Node-rein
 * (`tsconfig.json`, `lib: ["ES2022"]`, `include: ["services", "tests"]`), ein Import aus
 * `apps/web/src` zöge DOM-Typen herein. Die Zahl steht deshalb mit ihrer Fundstelle hier — und der
 * SERVERdeckel daneben wird importiert, nicht abgeschrieben.
 */
const ANZEIGEFENSTER = 200;

describe("JOB 4271 · der Bauplan des Großbestands", () => {
  const plan = bauplan();
  const zaehlung = gruppenzaehlung(plan);
  const ziel = plan.find((e) => e.gruppe === "ziel");

  it("B1 · zehntausend Einträge, in genau den geplanten Gruppen", () => {
    expect(plan).toHaveLength(GESAMT);
    expect(zaehlung).toEqual({
      ziel: 1,
      ablenker: ABLENKER,
      deckel: DECKEL_ABLENKUNG,
      "fremd-vertraulich": FREMDE_VERTRAULICHE,
      herkunftsgruppe: HERKUNFTSGRUPPE,
      fuellbestand: FUELLBESTAND,
    });
    // Die Summe ist unabhängig gerechnet, nicht vom Ergebnis abgeschrieben.
    expect(
      1 + ABLENKER + DECKEL_ABLENKUNG + FREMDE_VERTRAULICHE + HERKUNFTSGRUPPE + FUELLBESTAND,
    ).toBe(GESAMT);
  });

  it("B2 · der gesuchte Begriff steht im Ziel NUR im Fliesstext — in keinem Kurzfeld", () => {
    expect(ziel, "der Bauplan hat kein Zieldokument").toBeTruthy();
    const e = (ziel as NonNullable<typeof ziel>).eingabe;
    expect(
      e.title,
      "der Begriff steht im Titel — dann misst der grosse Lauf keinen Volltextfund",
    ).not.toContain(VOLLTEXT_BEGRIFF);
    expect(e.statement).not.toContain(VOLLTEXT_BEGRIFF);
    expect(e.category).not.toContain(VOLLTEXT_BEGRIFF);
    expect((e.tags ?? []).join(" ")).not.toContain(VOLLTEXT_BEGRIFF);
    expect(e.bodyHtml ?? "", "im Fliesstext fehlt der Begriff").toContain(VOLLTEXT_BEGRIFF);
    // Und die drei Suchwege sind wirklich drei verschiedene Felder.
    expect(e.title).toBe(ZIEL_TITEL);
    expect(e.statement, "die Kennung steht nicht in der sichtbaren Aussage").toContain(
      ZIEL_KENNUNG,
    );
    expect(e.tags ?? [], "die Herkunft steht nicht im Schlagwort").toContain(HERKUNFT);
  });

  it("B3 · genau ein Eintrag trägt die Zielkennung, und kein Ablenker trägt den Begriff", () => {
    const mitKennung = plan.filter((p) => p.eingabe.statement.includes(ZIEL_KENNUNG));
    expect(mitKennung, "die Zielkennung ist nicht eindeutig").toHaveLength(1);
    expect(mitKennung[0]?.gruppe).toBe("ziel");

    const ablenker = plan.filter((p) => p.gruppe === "ablenker");
    for (const a of ablenker) {
      const alles = `${a.eingabe.title} ${a.eingabe.statement} ${a.eingabe.bodyHtml ?? ""}`;
      expect(alles, "ein Ablenker trägt den gesuchten Begriff").not.toContain(VOLLTEXT_BEGRIFF);
      expect(a.eingabe.title, "ein Ablenker trägt den Zieltitel").not.toBe(ZIEL_TITEL);
    }
    // Sie sind trotzdem NAHE: gleicher Titelanfang, benachbarte Dokumentnummern.
    expect(
      ablenker.every((a) => a.eingabe.title.startsWith("Betriebsanweisung Kaltstart Presse")),
      "die Ablenker heissen gar nicht ähnlich — dann grenzt der grosse Lauf nichts ab",
    ).toBe(true);
    expect(ablenker.every((a) => a.eingabe.statement.includes("BA-4271-077"))).toBe(true);
  });

  it("B4 · die fremden vertraulichen Einträge sind eine echte Negativkontrolle", () => {
    const fremde = plan.filter((p) => p.gruppe === "fremd-vertraulich");
    expect(fremde).toHaveLength(FREMDE_VERTRAULICHE);
    for (const f of fremde) {
      expect(f.eingabe.confidentiality, "ein fremder Eintrag ist nicht vertraulich").toBe(
        "vertraulich",
      );
      // Sie tragen den Begriff im TITEL und in der AUSSAGE — sie hätten also die STÄRKSTE
      // Treffergüte. Bleiben sie trotzdem draussen, liegt das an der Abschirmung und nicht am Rang.
      expect(f.eingabe.title).toContain(VOLLTEXT_BEGRIFF);
      expect(f.eingabe.statement).toContain(VOLLTEXT_BEGRIFF);
      expect(f.eingabe.statement, "die Spur fehlt — dann ist die Vorschau nicht messbar").toContain(
        GEHEIMWORT,
      );
      expect(f.eingabe.author).not.toBe((ziel as NonNullable<typeof ziel>).eingabe.author);
    }
    // Das Geheimwort steht NIRGENDWO sonst — sonst wäre sein Auftauchen keine Aussage.
    const anderswo = plan.filter(
      (p) =>
        p.gruppe !== "fremd-vertraulich" &&
        `${p.eingabe.title} ${p.eingabe.statement} ${p.eingabe.bodyHtml ?? ""}`.includes(
          GEHEIMWORT,
        ),
    );
    expect(anderswo, "das Geheimwort steht auch ausserhalb der fremden Einträge").toHaveLength(0);
  });

  it("B5 · die Decoy-Zahl liegt UNTER dem Deckel — der grosse Lauf misst einen Fund, keinen Verlust", () => {
    // Die Ungleichung, an der der ganze Aufbau hängt, mit den ECHTEN Zahlen des Hauses:
    //   · der SERVERdeckel der Bibliothekssuche (importiert, nicht abgeschrieben),
    //   · das Anzeigefenster der Fläche (Fundstelle im Kopf dieser Datei).
    const anwaerter = 1 + DECKEL_ABLENKUNG;
    expect(LIBRARY_SEARCH_HIT_LIMIT, "der Serverdeckel ist nicht mehr 200").toBe(200);
    expect(
      anwaerter,
      `${anwaerter} Anwärter auf ${LIBRARY_SEARCH_HIT_LIMIT} Plätze — der Bestand drückt das Ziel selbst heraus`,
    ).toBeLessThanOrEqual(LIBRARY_SEARCH_HIT_LIMIT);
    expect(anwaerter, "die Trefferliste passt nicht ins Anzeigefenster").toBeLessThanOrEqual(
      ANZEIGEFENSTER,
    );
    // Und er ist trotzdem gross genug, um den KANDIDATENdeckel des Fragewegs (50) zu überfüllen.
    expect(DECKEL_ABLENKUNG).toBeGreaterThan(50);
  });

  it("B6 · der Bauplan ist deterministisch — sonst wäre der Kennungshash eine Aussage über nichts", () => {
    const zweiter = bauplan();
    expect(JSON.stringify(zweiter)).toBe(JSON.stringify(plan));
    expect(kennungsHash(["a", "b"])).toBe(kennungsHash(["a", "b"]));
    expect(kennungsHash(["a", "b"])).not.toBe(kennungsHash(["b", "a"]));
    expect(kennungsHash(["a"])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("B8 · der Kalibrierbestand ist derselbe Bauplan, nur ohne Füllbestand", () => {
    // RUNDE 2: die Kalibrierung fährt DIESELBEN Prüfungen wie der Hauptlauf (`zusagen.ts`) und
    // braucht dafür DENSELBEN Bestand — dasselbe Ziel, dieselben Ablenker, dieselben fremden
    // vertraulichen Einträge. Nur die Länge braucht sie nicht. Liefe der Bauplan hier auseinander,
    // kalibrierte sie etwas anderes, als der Hauptlauf misst.
    const klein = bauplan({ fuellbestand: 0 });
    expect(klein).toHaveLength(GESAMT - FUELLBESTAND);
    expect(gruppenzaehlung(klein)).toEqual({
      ziel: 1,
      ablenker: ABLENKER,
      deckel: DECKEL_ABLENKUNG,
      "fremd-vertraulich": FREMDE_VERTRAULICHE,
      herkunftsgruppe: HERKUNFTSGRUPPE,
      fuellbestand: 0,
    });
    // Zeichen für Zeichen dieselben Einträge wie im grossen Plan — nur die Füllzeilen fehlen.
    expect(JSON.stringify(klein)).toBe(
      JSON.stringify(plan.filter((e) => e.gruppe !== "fuellbestand")),
    );

    // UND DIE RECHNUNG DER DECKELKALIBRIERUNG (KZ3a), hier im Tor nachgerechnet: 240 Ablenker plus
    // ein Ziel liegen ÜBER dem Serverdeckel; 41 davon im Papierkorb bringen sie exakt darauf.
    const deckelAblenker = 240;
    const wegzuraeumen = deckelAblenker + 1 - LIBRARY_SEARCH_HIT_LIMIT;
    expect(wegzuraeumen, "die Zahl der wegzuräumenden Ablenker stimmt nicht").toBe(41);
    expect(deckelAblenker + 1, "die Familie liegt gar nicht über dem Deckel").toBeGreaterThan(
      LIBRARY_SEARCH_HIT_LIMIT,
    );
    expect(deckelAblenker - wegzuraeumen + 1, "nach dem Wegräumen passt sie nicht genau").toBe(
      LIBRARY_SEARCH_HIT_LIMIT,
    );
  });

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // B9 — DER TRANSPORT DES MANIFESTS. RUNDE 3, BENs EINZIGE KORREKTURPFLICHT.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Nicht gemessen wird hier, ob DIE CLOUD das Archiv mitbringt — das zeigt erst der ausgeführte
  // Lauf. Gemessen wird das, woran es in Runde 2 wirklich gescheitert ist: dass ein Manifest mit
  // 10.000 Kennungen den Weg über das Protokoll UNVERSEHRT und VOLLSTÄNDIG übersteht, dass sein
  // Hash aus seinen eigenen Gruppen nachrechenbar ist — und dass eine Lücke im Transport wirklich
  // auffällt, statt still geglättet zu werden.
  it("B9 · das vollständige Manifest übersteht den Protokollweg — und eine Lücke fällt auf", () => {
    // Die Gruppenreihenfolge ist Teil des Hashvertrags: sie muss jede Gruppe des Bauplans genau
    // einmal nennen, sonst fiele beim Nachrechnen eine ganze Gruppe unter den Tisch.
    expect([...GRUPPEN_REIHENFOLGE].sort()).toEqual(Object.keys(zaehlung).sort());
    expect(new Set(GRUPPEN_REIHENFOLGE).size, "eine Gruppe steht doppelt").toBe(
      GRUPPEN_REIHENFOLGE.length,
    );

    // Ein Manifest in der Grösse des echten: 10.000 Kennungen, verteilt wie im Bauplan.
    let laufend = 0;
    const naechste = (): string => {
      laufend += 1;
      return `4271-${String(laufend).padStart(5, "0")}-aaaabbbbccccdddd`;
    };
    const kennungenJeGruppe = {
      ziel: Array.from({ length: 1 }, naechste),
      ablenker: Array.from({ length: ABLENKER }, naechste),
      deckel: Array.from({ length: DECKEL_ABLENKUNG }, naechste),
      "fremd-vertraulich": Array.from({ length: FREMDE_VERTRAULICHE }, naechste),
      herkunftsgruppe: Array.from({ length: HERKUNFTSGRUPPE }, naechste),
      fuellbestand: Array.from({ length: FUELLBESTAND }, naechste),
    };
    expect(kennungsanzahl(kennungenJeGruppe)).toBe(GESAMT);

    const manifest = {
      erwartet: {
        zielKennung: ZIEL_KENNUNG,
        zielTitel: ZIEL_TITEL,
        volltextBegriff: VOLLTEXT_BEGRIFF,
        herkunft: HERKUNFT,
        geheimwort: GEHEIMWORT,
        anzahl: GESAMT,
        gruppen: zaehlung,
      },
      zielKoId: kennungenJeGruppe.ziel[0] as string,
      gespeicherteAnzahl: GESAMT,
      kennungsHash: kennungsHashAusGruppen(kennungenJeGruppe),
      dauerMs: { anlegen: 1, validieren: 1 },
      erzeugtAm: "2026-09-17T00:00:00.000Z",
      kennungenJeGruppe,
      gezaehlteGruppen: zaehlung,
    };

    // ── DER RUNDWEG: hinaus in Stücke, zurück zu genau demselben Manifest ──────────────────────
    const zeilen = manifestZeilen(manifest);
    expect(
      zeilen.length,
      "das Manifest passt in eine Zeile — dann misst der Fall nichts",
    ).toBeGreaterThan(50);
    const zurueck = manifestAusZeilen(zeilen);
    expect(JSON.stringify(zurueck)).toBe(JSON.stringify(manifest));
    expect(kennungsanzahl(zurueck.kennungenJeGruppe), "Kennungen gingen unterwegs verloren").toBe(
      GESAMT,
    );
    // Der Hash ist aus dem zurückgelesenen Manifest ALLEIN nachrechenbar — das ist BENs Zusage.
    expect(kennungsHashAusGruppen(zurueck.kennungenJeGruppe)).toBe(manifest.kennungsHash);

    // Und er hängt wirklich an den Kennungen: eine einzige geänderte Kennung ändert ihn.
    const verbogen = { ...kennungenJeGruppe, ziel: ["4271-99999-aaaabbbbccccdddd"] };
    expect(kennungsHashAusGruppen(verbogen)).not.toBe(manifest.kennungsHash);

    // ── DIE GEGENPROBE AM TRANSPORT: fehlt ein Stück, wird es GEMELDET, nicht geglättet ────────
    const ohneStueck = zeilen.filter((_, i) => i !== 5);
    expect(() => manifestAusZeilen(ohneStueck)).toThrow(/unvollständig|fehlt/);
    // Und ein VERSTELLTES Stück fällt an der Prüfsumme auf, obwohl die Zahl der Stücke stimmt.
    const verstellt = zeilen.map((z, i) => (i === 5 ? z.replace(/.$/, "X") : z));
    expect(() => manifestAusZeilen(verstellt)).toThrow(/Prüfsumme|verstümmelt/);
  });

  it("B7 · und es wird LAUT gesagt, dass der ausgeführte Lauf hier nicht stattgefunden hat", () => {
    // Lieferung 10: kein stiller Skip. Diese Datei ist grün, weil der BAUPLAN stimmt — nicht, weil
    // der Nutzerweg gemessen wurde. Wer die Ausgabe des Torlaufs liest, soll das nicht verwechseln.
    process.stderr.write(
      `${JOB} HINWEIS: hier läuft NUR die Bauplanprüfung. Der ausgeführte Großbestand-Nutzerweg (10.000 Einträge, echte PostgreSQL, echter Chromium) steht in tests/wiki-grossbestand-nutzerweg/findet-im-grossbestand.integration.test.ts, seine Kalibrierung in tests/wiki-grossbestand-nutzerweg/kalibrierung.integration.test.ts; beide brauchen KLARWERK_PG_TEST_URL. Aufruf: npx vitest run --config vitest.integration.config.ts tests/wiki-grossbestand-nutzerweg. In diesem Lauf wurden sie WEDER ausgeführt NOCH bestanden.\n`,
    );
    expect(GESAMT).toBe(10_000);
  });
});
