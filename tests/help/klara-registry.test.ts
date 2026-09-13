import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KLARA_PAGES,
  KLARA_SYNONYMS,
  allFaqEntries,
  allKlaraEntries,
  klaraEntryById,
  pageEntryFor,
  pageTitleKeyForRoute,
  rankKlara,
  resolveKlaraEntries,
  searchKlara,
} from "../../apps/web/src/lib/klaraRegistry";

// Klara v1 (Pedi 05.07.): EINE Registry über alle Hilfe-Quellen — Seiten, chelp.*, vhelp.*,
// Hilfeseiten-Kapitel. Getestet: Vollständigkeit, DE+EN-Auflösung, Kontext-Zuordnung, Suche.
describe("Klara v1: konsolidierte Hilfe-Registry", () => {
  it("bündelt alle Quellen mit eindeutigen IDs (Seiten + chelp + vhelp + Kapitel)", () => {
    const entries = allKlaraEntries();
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    // 16 Seiten + 23 Erfassen + 26 Prüfbereich + 49 Sektionen (Berater 05.07.) + 10 Kapitel ≥ 124.
    expect(entries.length).toBeGreaterThanOrEqual(124);
    for (const prefix of ["page:", "cap:", "rev:", "sec:", "topic:"]) {
      expect(
        entries.some((e) => e.id.startsWith(prefix)),
        `Quelle fehlt: ${prefix}`,
      ).toBe(true);
    }
    // Jeder Eintrag verweist auf eine echte interne Route (Absprung aus dem Panel).
    for (const e of entries) {
      expect(e.route.startsWith("/"), `${e.id} ohne Route`).toBe(true);
    }
  });

  it("löst jeden Titel und Text in DE und EN auf (keine rohen Keys, keine Alibi-Texte)", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const entry of allKlaraEntries()) {
        const title = i18n.t(entry.titleKey);
        const body = i18n.t(entry.bodyKey);
        expect(title, `${lng}:${entry.titleKey}`).not.toBe(entry.titleKey);
        expect(body, `${lng}:${entry.bodyKey}`).not.toBe(entry.bodyKey);
        expect(body.length, `${lng}:${entry.bodyKey}`).toBeGreaterThan(30);
      }
    }
  });

  it("ordnet Routen dem richtigen Seiten-Kontext zu (inkl. /wissen/:id, unbekannt = null)", () => {
    expect(pageEntryFor("/validierung")?.id).toBe("page:validation");
    expect(pageEntryFor("/erfassen")?.id).toBe("page:capture");
    expect(pageEntryFor("/wissen/abc-123")?.id).toBe("page:koDetail");
    expect(pageEntryFor("/gibtsnicht")).toBeNull();
    // Jede Klara-Seite (außer dem /wissen-Sondereintrag) ist über ihre Route erreichbar.
    for (const p of KLARA_PAGES.filter((x) => x.id !== "koDetail")) {
      expect(pageEntryFor(p.route)?.id, p.route).toBe(`page:${p.id}`);
    }
  });

  it("findet Anker-Einträge per ID und rät nie (unbekannt = null)", () => {
    expect(klaraEntryById("rev:originFilter")?.route).toBe("/validierung");
    expect(klaraEntryById("cap:modes")?.route).toBe("/erfassen");
    expect(klaraEntryById("gibt:esnicht")).toBeNull();
  });

  it("sucht tolerant: Groß/Klein, Mehrwort und Synonyme (freigeben → validieren)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    expect(searchKlara(resolved, "BUS-FAKTOR").length).toBeGreaterThan(0);
    expect(searchKlara(resolved, "wissenslücke").length).toBeGreaterThan(0);
    // Synonym: Alltagswort „freigeben" trifft Validierungs-Einträge.
    const syn = searchKlara(resolved, "freigeben");
    expect(syn.length).toBeGreaterThan(0);
    expect(syn.some((e) => e.id === "page:validation" || e.route === "/validierung")).toBe(true);
    // Leere Suche liefert bewusst nichts (Panel zeigt dann den Seiten-Kontext).
    expect(searchKlara(resolved, "   ")).toEqual([]);
  });

  it("rankt ganze FRAGEN tolerant für die KI-Grundlage (Füllwörter kippen nichts)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Die strikte Suche findet für diese Frage nichts — das Ranking sehr wohl.
    const question = "Warum brauche ich mehrere grüne Freigaben bis zur Validierung?";
    expect(searchKlara(resolved, question)).toEqual([]);
    const ranked = rankKlara(resolved, question, 6);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(6);
    expect(ranked.some((e) => e.route === "/validierung")).toBe(true);
    // Ohne verwertbare Wörter ehrlich leer — dann gibt es auch keinen Modellaufruf.
    expect(rankKlara(resolved, "ä ü ö")).toEqual([]);
  });

  it("Satzzeichen kippen die Suche nicht mehr (Pedi-Bug: Frage mit Fragezeichen)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Vor dem Fix fand „Validierung?" NICHTS — das Fragezeichen klebte am Suchwort.
    expect(searchKlara(resolved, "Validierung?").length).toBeGreaterThan(0);
    expect(searchKlara(resolved, "Bus-Faktor?!").length).toBeGreaterThan(0);
    expect(rankKlara(resolved, "Was ist der Bus-Faktor?").length).toBeGreaterThan(0);
  });

  it("liefert das Seiten-Label je Route (für den Zum-Bereich-Link der KI-Antwort)", () => {
    expect(pageTitleKeyForRoute("/validierung")).toBe("nav.validation");
    expect(pageTitleKeyForRoute("/gibtsnicht")).toBeNull();
  });

  it("FAQ (Berater 3a): 77 Antworten in der Wissensdatenbank — nur im deutschen UI, bis EN folgt", async () => {
    const de = allFaqEntries("de");
    expect(de.length).toBeGreaterThanOrEqual(77);
    expect(new Set(de.map((e) => e.id)).size).toBe(de.length);
    for (const e of de) {
      expect(e.id.startsWith("faq:"), e.id).toBe(true);
      expect(e.title.length, e.id).toBeGreaterThan(10);
      expect(e.body.length, e.id).toBeGreaterThan(60);
      expect(e.route.startsWith("/"), e.id).toBe(true);
    }
    // Ehrliches Sprach-Gate: EN bleibt leer, bis Lieferung 3b die Übersetzung bringt.
    expect(allFaqEntries("en")).toEqual([]);
    // Die FAQ ist durchsuchbar Teil des Korpus: „ChatGPT" steht NUR in der FAQ.
    await i18n.changeLanguage("de");
    const corpus = [
      ...resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k)),
      ...allFaqEntries("de"),
    ];
    const hit = searchKlara(corpus, "ChatGPT");
    expect(hit.some((e) => e.id === "faq:faq.grund.1")).toBe(true);
    expect(rankKlara(corpus, "Wem gehört das Wissen, das ich eingebe?").length).toBeGreaterThan(0);
  });

  // ================================================================================================
  // JOB 3798 — DIE ALLTAGSWÖRTER EINES ABGESCHAFFTEN VERSPRECHENS.
  // ================================================================================================
  // JOB 3771 hat „du entscheidest bewusst, was verschmolzen wird" von der Dublettenfläche genommen,
  // JOB 3787 „Artikel zusammenführen" aus der FAQ. Die Wörter verschwinden aus dem Produkt, nicht
  // aus den Köpfen: wer sie gelesen hat, tippt sie weiter in Klara. GEMESSEN am Basisstand 98bd88a,
  // DE, über `resolveKlaraEntries(allKlaraEntries(), i18n.t)` — vor der Synonymzeile:
  //   verschmelzen 0 · mergen 0 · verschmolzen 0 · zusammenführung 0 · zusammenführen 1
  // Nur `zusammenführen` traf, und zwar LITERAL über `klara.page.duplicates` — siehe Nachführ-Pin.
  // Das Synonym belebt das Versprechen nicht wieder: es führt auf die Fläche, die sagt, was
  // wirklich passiert. Zielstamm überall `duplikat`.
  const FUEHRT_AUF_DUPLIKATE = (treffer: readonly { id: string; route: string }[]): boolean =>
    treffer.some((e) => e.id === "page:duplicates" || e.route === "/duplikate");

  it("Synonym: „verschmelzen“ führt auf die Duplikatefläche (JOB 3771 hat das Versprechen abgeschafft)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    const treffer = searchKlara(resolved, "verschmelzen");
    expect(treffer.length).toBeGreaterThan(0);
    expect(FUEHRT_AUF_DUPLIKATE(treffer)).toBe(true);
  });

  it("Synonym: „verschmolzen“ — das Partizip aus dem gestrichenen Satz — führt ebenso dorthin", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    const treffer = searchKlara(resolved, "verschmolzen");
    expect(treffer.length).toBeGreaterThan(0);
    expect(FUEHRT_AUF_DUPLIKATE(treffer)).toBe(true);
  });

  it("Synonym: „mergen“ — das englische Alltagswort, das im Katalog nirgends steht", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    const treffer = searchKlara(resolved, "mergen");
    expect(treffer.length).toBeGreaterThan(0);
    expect(FUEHRT_AUF_DUPLIKATE(treffer)).toBe(true);
  });

  it("Synonym: „Zusammenführung“ als Substantiv — die Teilkette trägt es NICHT von selbst", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Vor JOB 3798 lieferte dieses Wort 0 Treffer, obwohl „zusammenführen" 1 lieferte:
    // `searchKlara` sucht per Teilkette, und „zusammenführung" steckt nicht in „zusammenführen".
    const treffer = searchKlara(resolved, "Zusammenführung");
    expect(treffer.length).toBeGreaterThan(0);
    expect(FUEHRT_AUF_DUPLIKATE(treffer)).toBe(true);
  });

  it("NACHFÜHR-PIN · „zusammenführen“ ist heute DOPPELT getragen: literal im Katalog UND über das Synonym", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Teil 1 — die Zusage, die IMMER gilt: das Wort führt auf die Duplikatefläche.
    const treffer = searchKlara(resolved, "zusammenführen");
    expect(treffer.length).toBeGreaterThan(0);
    expect(FUEHRT_AUF_DUPLIKATE(treffer)).toBe(true);

    // Teil 2 — DER PIN, und er geht bewusst rot, wenn jemand den Katalog richtigstellt.
    // `klara.page.duplicates` lautet am Basisstand 98bd88a: „Mögliche Doppelungen: prüfen und
    // zusammenführen, damit Wissen nicht zersplittert." Dieser Satz trägt das abgeschaffte
    // Versprechen weiter (EN `i18n.ts:10122` „review and merge", NL `:15153`) und gehört
    // richtiggestellt — `i18n.ts` ist Zielpfad fremder Aufträge und war für JOB 3798 gesperrt.
    // Solange er so dasteht, ist der Treffer oben ZWEIFACH getragen, und dieser Fall hält fest,
    // welcher der beiden Träger wegfällt, wenn der Satz fällt.
    const seite = resolved.find((e) => e.id === "page:duplicates");
    expect(seite, "page:duplicates fehlt in der Registry").toBeDefined();
    const literal = `${seite?.title} ${seite?.body}`.toLowerCase().includes("zusammenführen");
    expect(
      literal,
      "NACHFÜHRUNG: `klara.page.duplicates` verspricht weiter „zusammenführen“; wird dieser Satz " +
        "richtiggestellt, ist das Synonym der einzige Träger. Dann diesen Teil-2-Pin löschen — " +
        "Teil 1 dieses Falls bleibt und misst weiter, dass das Wort ankommt.",
    ).toBe(true);
  });

  // KORREKTURPFLICHT 1 (BEN, Runde 1): Der Nachführ-Pin oben misst „zusammenführen" bei WEITERHIN
  // vorhandenem Literal — ein falsches, aber lebendes Synonymziel (`zusammenführen → validier`)
  // bliebe dabei unentdeckt, weil der Literaltreffer allein schon auf die Duplikatefläche führt.
  // Dieser Fall entzieht dem Wort seinen Literalträger und misst NUR noch das Synonym.
  it("Synonymträger allein: „zusammenführen“ führt auch OHNE das Literal im Katalog auf die Duplikatefläche", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Die Zukunft, auf die der Nachführ-Pin zeigt: `klara.page.duplicates` ist richtiggestellt, das
    // Wort steht nirgends mehr im Katalog. Nachgestellt an einer KOPIE der ECHTEN aufgelösten
    // Texte — der Katalog selbst bleibt unberührt (`i18n.ts` ist nach §10 gesperrt). Entfernt wird
    // genau die Zeichenkette, über die der Literaltreffer läuft, in Titel UND Text.
    const ohneLiteral = resolved.map((e) => ({
      ...e,
      title: e.title.replace(/zusammenführen/gi, " "),
      body: e.body.replace(/zusammenführen/gi, " "),
    }));
    // Die Kopie ist wirklich literalfrei — sonst misst dieser Fall wieder den Literaltreffer.
    expect(
      ohneLiteral.some((e) => `${e.title} ${e.body}`.toLowerCase().includes("zusammenführen")),
      "die Kopie trägt das Literal noch — dann beweist dieser Fall nichts",
    ).toBe(false);
    // Kalibrierung: OHNE Synonym wäre die Kopie für dieses Wort leer. Das belegt, dass der
    // folgende Treffer ausschließlich aus `KLARA_SYNONYMS` stammt und nicht aus einem Restwort.
    expect(
      ohneLiteral.filter((e) => `${e.title} ${e.body}`.toLowerCase().includes("zusammenführ")),
    ).toEqual([]);
    const treffer = searchKlara(ohneLiteral, "zusammenführen");
    expect(
      treffer.length,
      "ohne Literal trägt NUR das Synonym — es trägt nicht: `zusammenführen` fehlt in KLARA_SYNONYMS",
    ).toBeGreaterThan(0);
    expect(
      FUEHRT_AUF_DUPLIKATE(treffer),
      `ohne Literal führt das Synonym woandershin als auf /duplikate: ${treffer
        .map((e) => e.id)
        .join(", ")} — der Zielstamm von „zusammenführen“ ist falsch gesetzt`,
    ).toBe(true);
  });

  it("Klara erfindet nichts: ein Fantasiewort ohne Synonym bleibt ehrlich leer", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Der EINE Zustand, den die Synonymkarte berühren könnte: „erfolgreich leer". Eine Karte darf
    // nie dazu dienen, irgendeine Antwort zu erzwingen.
    expect(searchKlara(resolved, "quimbolzer")).toEqual([]);
    expect(searchKlara(resolved, "verschmelzen quimbolzer")).toEqual([]);
  });

  // ================================================================================================
  // DER EHRLICHKEITSWÄCHTER ÜBER DIE KARTE SELBST — sie lügt nie über sich.
  // ================================================================================================
  // Ein Synonym, dessen Zielstamm in KEINEM Klara-Eintrag vorkommt, tut nichts und täuscht Hilfe
  // vor, die es nicht gibt. Gemessen wird am ECHTEN aufgelösten Bestand, nicht über ein zweites
  // Abbild der Karte — `KLARA_SYNONYMS` ist dafür exportiert.
  //
  // KORREKTURPFLICHT 2 (BEN, Runde 1): Der erste Lauf maß über `searchKlara(resolved, stamm)` und
  // gab den Stamm damit als neue ANFRAGE hinein — die wird normalisiert (kleingeschrieben) und
  // synonym-erweitert. Ein großgeschriebener Zielstamm wie `DUPLIKAT` galt so als tragfähig,
  // obwohl die echte Verwendung den UNVERÄNDERTEN Kartenwert gegen den normalisierten Text hält
  // (`klaraRegistry.ts:280`: `haystack.includes(v)`, `v` roh aus der Karte). Deshalb misst dieser
  // Wächter jetzt genau das: roher Kartenwert gegen normalisierten Titel+Text, keine
  // Anfrage-Normalisierung, keine Synonymerweiterung.
  //
  // DER ALTBESTAND: Stämme, die schon vor JOB 3798 nichts trugen. Sie stehen hier namentlich, mit
  // Grund — kein Freibrief, sondern eine Schranke in BEIDE Richtungen (Bauart wie
  // `tests/chr-navigation-sprachen/sprachweg-waechter.test.ts`):
  //   · Ein Stamm, der NICHT hier steht und nichts trägt, macht diesen Fall rot.
  //   · Ein Stamm, der hier steht und wieder trägt, macht ihn ebenfalls rot — dann gehört die
  //     Zeile weg, sonst verwaltet das Register Gespenster.
  // Ihre Behebung bräuchte `apps/web/src/i18n.ts` (Hilfe-Lücke, in der Rückgabe gemeldet).
  const ALTBESTAND: ReadonlyMap<string, string> = new Map([
    [
      "löschen → papierkorb",
      "ECHTER FUND des ersten Laufs (JOB 3798, 12.09.2026), nicht weggeschaut: der Stamm trifft 0 " +
        "von allen aufgelösten Klara-Einträgen. Der Grund ist eine HILFE-LÜCKE, kein Tippfehler — " +
        "der einzige Klara-Eintrag zum Löschen eines Wissensobjekts (`vhelp.deleteKo.body`, " +
        "`i18n.ts:5430`) sagt „Entfernt dieses Wissensobjekt endgültig“ und kennt weder Papierkorb " +
        "noch Wiederherstellung, während die Löschabfrage der Fläche (`i18n.ts:996`) sagt, der " +
        "Beitrag wandere in den Papierkorb und sei dort 28 Tage wiederherstellbar. Der ZWEITE " +
        "Stamm desselben Schlüssels (`entfern`) trägt mit 5 Treffern — das Synonym „löschen“ läuft " +
        "also nicht ins Leere; tot ist genau dieser eine Stamm. Behebung: Klaras Löschhilfe muss " +
        "den Papierkorb nennen; das bräuchte `i18n.ts` und war für JOB 3798 gesperrt (§10).",
    ],
  ]);

  // Die Normalisierung, der `searchKlara` den Text unterwirft, BEVOR es den rohen Kartenwert darin
  // sucht (`klaraRegistry.ts:248-254`). Bewusst hier nachgebildet und nicht importiert:
  // `normalizeForSearch` ist nach §10 des Auftrags nicht anzufassen, ein reiner Test-Export würde
  // den Aufrufer-Wächter reißen. Gegen Drift ist die Nachbildung unten an der ECHTEN Suche
  // kalibriert — weicht sie je ab, wird dieser Fall rot.
  const wieImText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  it("Ehrlichkeitswächter: jeder Zielstamm der Synonymkarte kommt in echten Klara-Einträgen vor", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    const korpus = resolved.map((e) => wieImText(`${e.title} ${e.body}`));
    const tot: string[] = [];
    const auferstanden: string[] = [];
    for (const [schluessel, staemme] of Object.entries(KLARA_SYNONYMS)) {
      for (const stamm of staemme) {
        const zeile = `${schluessel} → ${stamm}`;
        // Kein Kettensynonym: die Mechanik löst genau EINE Stufe auf (`klaraRegistry.ts:279`).
        // Wäre ein Zielstamm selbst ein Schlüssel, misse dieser Wächter sein eigenes Synonym statt
        // des Stamms — und wäre grün, obwohl der Stamm tot ist.
        expect(
          Object.hasOwn(KLARA_SYNONYMS, stamm),
          `${zeile}: Zielstamm ist selbst ein Schlüssel der Karte — Kettensynonym, das die Suche nie auflöst`,
        ).toBe(false);
        // Genau der Vergleich, den die Suche zur Laufzeit anstellt: ROHER Kartenwert in
        // normalisiertem Titel+Text. Ein Stamm, der dabei nirgends steckt, ist totes Gewicht —
        // auch dann, wenn er als Suchanfrage (kleingeschrieben) zufällig getroffen hätte.
        const traegt = korpus.some((h) => h.includes(stamm));
        // KALIBRIERUNG gegen Drift der Nachbildung: solange die Anfrage-Normalisierung den Stamm
        // nicht verändert und kein Kettensynonym vorliegt, MUSS das Urteil dem der echten Suche
        // entsprechen. Läuft `normalizeForSearch` je auseinander, bricht dieser Vergleich.
        if (stamm === wieImText(stamm)) {
          expect(
            traegt,
            `${zeile}: die hier nachgebildete Normalisierung weicht von searchKlara ab`,
          ).toBe(searchKlara(resolved, stamm).length > 0);
        }
        const grund = ALTBESTAND.get(zeile);
        if (!traegt && grund === undefined) {
          // Ursache oft: Großbuchstaben/Satzzeichen im Kartenwert. Der Text ist kleingeschrieben
          // und satzzeichenfrei, der Kartenwert wird NICHT normalisiert.
          tot.push(
            `${zeile} — Zielstamm „${stamm}“ (Schlüssel „${schluessel}“) steckt SO, unverändert, in KEINEM normalisierten Titel+Text der aufgelösten Klara-Einträge: totes Gewicht`,
          );
        }
        if (traegt && grund !== undefined) {
          auferstanden.push(`${zeile} — trägt wieder, die ALTBESTAND-Zeile gehört gelöscht`);
        }
      }
    }
    expect(tot, `Synonyme ohne Ziel:\n${tot.join("\n")}`).toEqual([]);
    expect(auferstanden, `ALTBESTAND-Gespenster:\n${auferstanden.join("\n")}`).toEqual([]);
    // Der Wächter misst wirklich etwas: die Karte ist nicht leer.
    expect(Object.keys(KLARA_SYNONYMS).length).toBeGreaterThanOrEqual(12);
  });

  // ================================================================================================
  // JOB 3874 — DIESELBE KARTE IM ENGLISCHEN UND NIEDERLÄNDISCHEN UI.
  // ================================================================================================
  // BEN zu JOB 3798 (`archiv/3798/runde-2/ben.md:28`, Prüfpunkt 6): „EN/NL-Wirkung … bleiben
  // ungedeckt … ein ergänzender Folgeauftrag könnte die sprachabhängige Synonymwirkung separat
  // prüfen." Der Wächter darüber (`:301`) beginnt mit `changeLanguage("de")`, und JEDER Synonymfall
  // dieser Datei tut dasselbe — was die Karte in EN und NL tut, war bis hierher ungemessen.
  //
  // `searchKlara` und `rankKlara` nehmen KEINEN Sprachparameter (`klaraRegistry.ts:264`, `:289`) und
  // ziehen die Ersetzung unverändert aus derselben Karte; die TEXTE dagegen kommen über das
  // hereingereichte `t()` (`:194-199`) und sind sehr wohl übersetzt. Genau in dieser Fuge liegt das
  // Thema dieses Blocks.
  //
  // GEMESSEN am Basisstand d8f15d5, 13.09.2026, über `resolveKlaraEntries(allKlaraEntries(), i18n.t)`
  // und die Regel des Wächters oben (roher Kartenwert gegen normalisierten Titel+Text). Korpus in
  // allen drei Sprachen 135 Einträge. Zielstämme × Sprache, Trefferzahlen:
  //
  //   Stamm            de    en    nl
  //   validier         21     0     0
  //   wissensobjekt    38     0     0
  //   objekt           61     0     0
  //   papierkorb        0     0     0   (der DE-Altbestand oben — fehlt in ALLEN drei Sprachen)
  //   entfern           5     0     0
  //   antwort          14     0     0
  //   wissenslücke      3     0     0
  //   duplikat          2     0     0
  //
  // ACHT von acht Zielstämmen tragen in EN und NL NICHTS. Das ist kein Übersetzungsfehler: der
  // Katalog ist in beiden Sprachen vollständig und sagt dasselbe mit seinen eigenen Wörtern
  // („Duplicates", „Validation", „knowledge gap"). Tot ist der DEUTSCHE KARTENWERT.
  const FREMDSPRACHEN = ["en", "nl"] as const;

  // Alle Zielstämme, ABGELEITET aus der Karte selbst — kein zweites Abbild (wie `:307`).
  const ZIELSTAEMME: readonly string[] = [...new Set(Object.values(KLARA_SYNONYMS).flat())];

  // DIE SCHRANKE IN BEIDE RICHTUNGEN, Bauart wie `ALTBESTAND` oben (`:274`), nur über die Achse
  // Sprache × Zielstamm:
  //   · Ein Paar, das NICHT hier steht und nichts trägt, macht den Fall rot.
  //   · Ein Paar, das hier steht und wieder trägt, macht ihn ebenfalls rot — sonst verwaltet das
  //     Register Gespenster.
  // `statt` ist KEIN Kommentar, sondern eine zweite gemessene Behauptung: das fremdsprachige Wort,
  // das an der Stelle des toten Stamms WIRKLICH im Korpus steht. Steht es nicht da, ist der Grund
  // erfunden und der Fall wird rot. Das ist zugleich die Datengrundlage für die negative Aussage:
  // „dieser Stamm trägt hier nicht" wird nur über einem Korpus behauptet, der in dieser Sprache
  // nachweislich gefüllt und aufgelöst ist.
  //
  // `statt: null` heisst: es gibt kein Ersatzwort, weil der BEGRIFF fehlt — die einzige echte
  // Hilfe-Lücke dieser Matrix.
  //
  // DIE BEHEBUNG, EINMAL FÜR ALLE ZEILEN MIT `statt !== null`: nicht der Katalog ist schuld, er
  // sagt dasselbe mit seinen eigenen Wörtern. Tot ist der deutsche KARTENWERT. Es bräuchte also
  // eine sprachabhängige Synonymkarte oder ein ehrliches Sprachgate wie bei `allFaqEntries`
  // (`klaraRegistry.ts:204-207`) — beides eine Produktentscheidung mit Wirkung auf alle Aufrufer,
  // und `klaraRegistry.ts` ist nach §10 KEIN Zielpfad dieses Auftrags. In der Rückgabe gemeldet.
  // NUR die zwei `papierkorb`-Zeilen liegen anders; ihr abweichender Weg steht bei ihnen selbst.
  interface Luecke {
    readonly statt: string | null;
    readonly grund: string;
  }
  const FREMDSPRACHIGE_LUECKEN: ReadonlyMap<string, Luecke> = new Map([
    [
      "en → validier",
      {
        statt: "validat",
        grund:
          "Der EN-Katalog ist in Ordnung: `nav.validation` (`i18n.ts:6395`) lautet „Validation“, " +
          "`klara.page.validation` (`:10136`) „The review board … counts as validated“. Der " +
          "deutsche Stamm „validier“ steckt in keinem dieser Wörter.",
      },
    ],
    [
      "nl → validier",
      {
        statt: "validat",
        grund:
          "Der NL-Katalog ist in Ordnung: `nav.validation` (`i18n.ts:11450`) lautet „Validatie“, " +
          "`klara.page.validation` (`:15171`) „geldt een object als gevalideerd“. Auch hier fehlt " +
          "dem deutschen Stamm das „ier“.",
      },
    ],
    [
      "en → wissensobjekt",
      {
        statt: "knowledge object",
        grund:
          "`klara.page.library` (`i18n.ts:10133`) sagt „All knowledge objects with status, trust " +
          "and filters“ — der Begriff ist da, nur auf Englisch.",
      },
    ],
    [
      "nl → wissensobjekt",
      {
        statt: "kennisobject",
        grund:
          "`klara.page.library` (`i18n.ts:15168`) sagt „Alle kennisobjecten met status, vertrouwen " +
          "en filters“.",
      },
    ],
    [
      "en → objekt",
      {
        statt: "object",
        grund:
          "Der zweite Stamm desselben Schlüssels scheitert an EINEM Buchstaben: EN schreibt " +
          "„object“ mit c (`i18n.ts:10133`), die Karte „objekt“ mit k.",
      },
    ],
    [
      "nl → objekt",
      {
        statt: "object",
        grund:
          "Dasselbe eine c: `klara.page.validation` NL (`i18n.ts:15172`) sagt „geldt een object " +
          "als gevalideerd“.",
      },
    ],
    [
      "en → papierkorb",
      {
        statt: null,
        grund:
          "KEIN Ersatzwort, und das ist der Unterschied zu allen anderen Zeilen hier: dieser Stamm " +
          "trägt auch in DE nichts (siehe `ALTBESTAND` oben, `:274`). Klaras Löschhilfe " +
          "`vhelp.deleteKo.body` sagt EN (`i18n.ts:10737`) „Removes this knowledge object " +
          "permanently“ und kennt wie die deutsche Fassung weder Papierkorb noch " +
          "Wiederherstellung, obwohl die Löschabfrage der Fläche 28 Tage verspricht. Das ist eine " +
          "echte HILFE-LÜCKE in allen drei Sprachen; ihre Behebung bräuchte `apps/web/src/i18n.ts` " +
          "und ist nach §10 draussen.",
      },
    ],
    [
      "nl → papierkorb",
      {
        statt: null,
        grund:
          "Wie EN: kein Ersatzwort, weil der BEGRIFF fehlt. `vhelp.deleteKo.body` NL " +
          "(`i18n.ts:15778`) sagt „Verwijdert dit kennisobject definitief“ — kein Papierkorb, " +
          "keine Wiederherstellung. Dieselbe Hilfe-Lücke wie in DE und EN, Behebung über " +
          "`i18n.ts`, §10.",
      },
    ],
    [
      "en → entfern",
      {
        statt: "remove",
        grund:
          "`vhelp.deleteKo.body` EN (`i18n.ts:10737`) beginnt mit „Removes“; in DE trägt dieser " +
          "Stamm mit 5 Treffern und rettet dort den Schlüssel „löschen“. In EN rettet ihn niemand.",
      },
    ],
    [
      "nl → entfern",
      {
        statt: "verwijder",
        grund: "`vhelp.deleteKo.body` NL (`i18n.ts:15778`) sagt „Verwijdert … definitief“.",
      },
    ],
    [
      "en → antwort",
      {
        statt: "answer",
        grund: "`klara.page.ask` EN (`i18n.ts:10131`) sagt „The answer is source-bound“.",
      },
    ],
    [
      "nl → antwort",
      {
        statt: "antwoord",
        grund:
          "`klara.page.ask` NL (`i18n.ts:15166`) sagt „Het antwoord is brongebonden“ — ein " +
          "einziger Buchstabe Unterschied, und die Karte greift trotzdem nicht.",
      },
    ],
    [
      "en → wissenslücke",
      {
        statt: "knowledge gap",
        grund:
          "`klara.page.ask` EN (`i18n.ts:10131`) sagt „an honest knowledge gap is created“ — " +
          "Klaras Kernversprechen steht da, nur nicht unter dem deutschen Wort.",
      },
    ],
    [
      "nl → wissenslücke",
      {
        statt: "kennishiaat",
        grund: "`klara.page.ask` NL (`i18n.ts:15166`) sagt „dan ontstaat een eerlijk kennishiaat“.",
      },
    ],
    [
      "en → duplikat",
      {
        statt: "duplicat",
        grund:
          "Wieder das eine c: `nav.duplicates` EN (`i18n.ts:6397`) lautet „Duplicates“. Das trifft " +
          "ALLE FÜNF Schlüssel, die JOB 3798 für das abgeschaffte Merge-Versprechen eingetragen " +
          "hat — darunter „mergen“, das englische Alltagswort.",
      },
    ],
    [
      "nl → duplikat",
      {
        statt: "duplicat",
        grund: "Dasselbe c: `nav.duplicates` NL (`i18n.ts:11452`) lautet „Duplicaten“.",
      },
    ],
  ]);

  it("Sprachweiter Ehrlichkeitswächter: was jeder Zielstamm in EN und NL tut, steht namentlich fest", async () => {
    // BELEGT STATT GERATEN (Lieferung 1) und zugleich die Schranke gegen eine vierte Sprache: die
    // geführten Sprachen kommen aus der i18n-Konfiguration selbst (`i18n.ts:16412`), nicht aus einer
    // Liste im Test. Käme morgen `fr` dazu, ohne dass jemand FREMDSPRACHEN nachführt, liefe dieser
    // Wächter stillschweigend an ihr vorbei — genau die Lücke, die dieser Auftrag für EN/NL
    // schliesst. Deshalb wird sie hier laut (Hinweis BEN, Runde 1).
    const gefuehrt = Object.keys(i18n.options.resources ?? {}).sort();
    expect(gefuehrt, "i18n führt andere Sprachen als der Wächter kennt").toEqual(
      ["de", ...FREMDSPRACHEN].sort(),
    );
    const tot: string[] = [];
    const auferstanden: string[] = [];
    const erfundeneGruende: string[] = [];
    // Was dieser Fall WIRKLICH angefasst hat — die Grundlage der Matrixprüfung unten. Nicht zu
    // verwechseln mit der Zahl der bekannten Lücken: geprüft wird jedes Paar, gelistet nur das tote.
    const geprueft: string[] = [];
    for (const lng of FREMDSPRACHEN) {
      await i18n.changeLanguage(lng);
      const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
      // KEINE NEGATIVE AUSSAGE OHNE DATENGRUNDLAGE: bevor hier „trägt nicht" behauptet wird, steht
      // fest, dass der Bestand dieser Sprache überhaupt da und aufgelöst ist. Ein Katalog, der auf
      // rohe Schlüssel zurückfiele, würde sonst jeden Stamm scheinbar bestätigen.
      expect(resolved.length, `${lng}: leerer Klara-Bestand`).toBeGreaterThanOrEqual(124);
      for (const e of resolved) {
        expect(e.title, `${lng}: roher Schlüssel statt Text (${e.titleKey})`).not.toBe(e.titleKey);
        expect(e.body, `${lng}: roher Schlüssel statt Text (${e.bodyKey})`).not.toBe(e.bodyKey);
      }
      const korpus = resolved.map((e) => wieImText(`${e.title} ${e.body}`));
      for (const stamm of ZIELSTAEMME) {
        const zeile = `${lng} → ${stamm}`;
        geprueft.push(zeile);
        // Dieselbe Regel wie der DE-Wächter oben (`:320`): ROHER Kartenwert in normalisiertem
        // Titel+Text — genau das, was `klaraRegistry.ts:280` zur Laufzeit tut.
        const traegt = korpus.some((h) => h.includes(stamm));
        const eintrag = FREMDSPRACHIGE_LUECKEN.get(zeile);
        if (!traegt && eintrag === undefined) {
          tot.push(
            `${zeile} — Zielstamm „${stamm}“ steckt in KEINEM normalisierten Titel+Text des ${lng}-Bestands und steht in keiner Zeile von FREMDSPRACHIGE_LUECKEN: unbenannte Hilfe-Lücke`,
          );
        }
        if (traegt && eintrag !== undefined) {
          auferstanden.push(
            `${zeile} — trägt wieder, die Zeile in FREMDSPRACHIGE_LUECKEN gehört gelöscht`,
          );
        }
        // Der Grund lügt nicht: das benannte Ersatzwort muss im selben Korpus wirklich stehen.
        if (eintrag?.statt != null && !korpus.some((h) => h.includes(eintrag.statt as string))) {
          erfundeneGruende.push(
            `${zeile} — als Ersatz ist „${eintrag.statt}“ benannt, das steckt aber selbst in keinem ${lng}-Text: der Grund stimmt nicht mehr`,
          );
        }
      }
    }
    expect(tot, `Unbenannte fremdsprachige Lücken:\n${tot.join("\n")}`).toEqual([]);
    expect(auferstanden, `Gespenster im Lückenregister:\n${auferstanden.join("\n")}`).toEqual([]);
    expect(
      erfundeneGruende,
      `Lückenregister mit überholtem Grund:\n${erfundeneGruende.join("\n")}`,
    ).toEqual([]);
    // Die dritte Art Gespenst: eine Registerzeile für ein Paar, das es gar nicht mehr gibt — weil
    // der Stamm aus der Karte entfernt wurde. Die Schleife oben käme daran nie vorbei, sie läuft
    // über ZIELSTAEMME. Ohne diese Prüfung bliebe so eine Zeile stehen und nähme später ein
    // gleichnamiges, neu eingetragenes Synonym stillschweigend unter ihren Schirm.
    const gueltigePaare = new Set(
      FREMDSPRACHEN.flatMap((lng) => ZIELSTAEMME.map((stamm) => `${lng} → ${stamm}`)),
    );
    const verwaist = [...FREMDSPRACHIGE_LUECKEN.keys()].filter((z) => !gueltigePaare.has(z));
    expect(
      verwaist,
      `Registerzeilen ohne Paar in der Karte (Stamm entfernt?):\n${verwaist.join("\n")}`,
    ).toEqual([]);
    // Der Fall misst wirklich die volle Matrix und nicht ein Einzelwort.
    //
    // KORREKTURPFLICHT 1 (BEN, Runde 1): Hier stand
    // `expect(FREMDSPRACHIGE_LUECKEN.size).toBe(ZIELSTAEMME.length * FREMDSPRACHEN.length)`. Das
    // setzte die Zahl der BEKANNTEN LÜCKEN mit der Zahl der UNTERSUCHTEN PAARE gleich und verlangte
    // damit, dass JEDES Paar tot ist. Ein Zielstamm, der in EN oder NL wirklich trägt, hat richtig
    // KEINE Lückenzeile — und hätte den Fall trotzdem gerötet („expected 16 to be 18"). Falscher
    // Alarm genau in dem Zustand, auf den diese Zeile hinarbeitet: eine Karte, die dort ankommt.
    // Gleiches galt für die Gegenrichtung — eine behobene und darum gelöschte Lückenzeile hätte den
    // Fall ebenso gerötet, obwohl die Matrix vollständig geprüft war.
    //
    // Gezählt wird jetzt, was der Fall tatsächlich angefasst hat: jedes Paar Sprache × Zielstamm
    // genau einmal, keins doppelt, keins ausgelassen. Das hält die Vollständigkeit der Messung fest,
    // ohne über ihr ERGEBNIS etwas vorzuschreiben. Ob ein Paar trägt oder tot ist, entscheiden
    // allein die drei Sammler oben — und die decken alle vier Zustände ab:
    //   tot + ungelistet  → rot (`tot`)            · tot + gelistet     → grün
    //   trägt + gelistet  → rot (`auferstanden`)   · trägt + ungelistet → grün
    expect(
      [...geprueft].sort(),
      "die Matrix wurde nicht vollständig durchlaufen (Paar doppelt oder ausgelassen)",
    ).toEqual([...gueltigePaare].sort());
    expect(ZIELSTAEMME.length).toBeGreaterThanOrEqual(8);
    expect(FREMDSPRACHEN.length).toBeGreaterThanOrEqual(2);
  });

  // ================================================================================================
  // DIE ZWEITE ACHSE: WAS DER NUTZER ERLEBT, WENN ER DEN SCHLÜSSEL TIPPT.
  // ================================================================================================
  // Nicht dieselbe Frage wie oben: ein SCHLÜSSEL kann literal treffen, obwohl sein Zielstamm tot
  // ist — er steht dann zufällig selbst im fremdsprachigen Text. GEMESSEN am Basisstand d8f15d5
  // über `searchKlara(resolved, schluessel)`, alle 12 Schlüssel × EN/NL:
  //   EN: alle zwölf 0 Treffer.
  //   NL: elf mal 0 — und „artikel" mit 3 Treffern, die AUS EINEM ANDEREN GRUND kommen.
  // Zum Vergleich DE: freigeben 21 · freigabe 23 · genehmigen 21 · artikel 63 · beitrag 63 ·
  // löschen 5 · frage 28 · verschmelzen/verschmolzen/mergen/zusammenführen/zusammenführung je 2.
  const FREMDSPRACHIGE_WIRKUNG: ReadonlyMap<string, readonly string[]> = new Map([
    [
      // Der EINE Schlüssel der Karte, der zufällig ein niederländisches Wort IST. Er trifft rein
      // LITERAL — beide Zielstämme („wissensobjekt", „objekt") sind in NL tot, siehe oben. Und er
      // trifft etwas anderes als in DE: `shelp.ext.title` (`i18n.ts:15238`) meint mit „vakartikel"
      // eine externe Fachquelle, `shelp.nb.title` (`:15252`) „het artikel dat je leest" das gelesene
      // Objekt. Die Bibliotheksfläche `page:library`, die derselbe Schlüssel in DE trifft, ist NICHT
      // dabei: `klara.page.library` NL (`:15168`) sagt „kennisobjecten", nicht „artikel".
      "nl → artikel",
      ["rev:sourcesLevel2", "sec:ext.title", "sec:nb.title"],
    ],
  ]);

  it("Sprachweite Wirkungsschranke: kein Kartenschlüssel wirkt in EN/NL ungezählt", async () => {
    const unerwartet: string[] = [];
    const verloren: string[] = [];
    for (const lng of FREMDSPRACHEN) {
      await i18n.changeLanguage(lng);
      const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
      expect(resolved.length, `${lng}: leerer Klara-Bestand`).toBeGreaterThanOrEqual(124);
      for (const schluessel of Object.keys(KLARA_SYNONYMS)) {
        const zeile = `${lng} → ${schluessel}`;
        const ids = searchKlara(resolved, schluessel).map((e) => e.id);
        const erwartet = FREMDSPRACHIGE_WIRKUNG.get(zeile);
        if (erwartet === undefined && ids.length > 0) {
          unerwartet.push(
            `${zeile} — findet ${ids.length} Treffer [${ids.join(", ")}], steht aber in keiner Zeile von FREMDSPRACHIGE_WIRKUNG: ungezählte Wirkung, die niemand geprüft hat`,
          );
        }
        if (
          erwartet !== undefined &&
          [...ids].sort().join("|") !== [...erwartet].sort().join("|")
        ) {
          verloren.push(
            `${zeile} — erwartet [${[...erwartet].sort().join(", ")}], gemessen [${[...ids].sort().join(", ")}]`,
          );
        }
      }
    }
    expect(unerwartet, `Ungezählte fremdsprachige Wirkung:\n${unerwartet.join("\n")}`).toEqual([]);
    expect(verloren, `Verschobene fremdsprachige Wirkung:\n${verloren.join("\n")}`).toEqual([]);
  });

  it("Wirkung EN: „mergen“ und „freigeben“ kommen im englischen UI nirgends an", async () => {
    await i18n.changeLanguage("en");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // „mergen" ist DER Fall, an dem beide Wege gleichzeitig reissen (`klaraRegistry.ts:240`):
    // literal, weil der englische Text „merge" schreibt und „merge" das längere „mergen" nicht
    // enthält (`haystack.includes` sucht die Teilkette in DIESER Richtung) — und über das Synonym,
    // weil der Zielstamm „duplikat" gegen „Duplicates" am c scheitert.
    expect(searchKlara(resolved, "mergen")).toEqual([]);
    const duplikate = resolved.find((e) => e.id === "page:duplicates");
    expect(duplikate, "page:duplicates fehlt im englischen Bestand").toBeDefined();
    // Die Fläche IST da und redet sogar vom Mergen — erreichbar ist sie über dieses Wort trotzdem
    // nicht. Genau das macht die Lücke zu einer Lücke und nicht zu einem fehlenden Thema.
    const enText = wieImText(`${duplikate?.title} ${duplikate?.body}`);
    expect(enText).toContain("merge");
    expect(enText).toContain("duplicates");
    expect(
      enText.includes("mergen"),
      "dann trüge das Wort literal und der Fall bewiese nichts",
    ).toBe(false);
    // Und der Altbestand der Karte, „freigeben → validier": dieselbe Geschichte an der
    // Validierungsfläche (`i18n.ts:10136`).
    expect(searchKlara(resolved, "freigeben")).toEqual([]);
    const validierung = resolved.find((e) => e.id === "page:validation");
    expect(wieImText(`${validierung?.title} ${validierung?.body}`)).toContain("validat");
    // Gegenprobe derselben Anfrage in DE: dort führt sie sehr wohl auf die Validierung. Der
    // Unterschied liegt also an der Sprache und nicht an der Anfrage.
    await i18n.changeLanguage("de");
    const de = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    expect(searchKlara(de, "freigeben").some((e) => e.route === "/validierung")).toBe(true);
    expect(searchKlara(de, "mergen").some((e) => e.id === "page:duplicates")).toBe(true);
  });

  it("Wirkung NL: „artikel“ trifft literal — und landet woanders als in DE", async () => {
    await i18n.changeLanguage("nl");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    const treffer = searchKlara(resolved, "artikel");
    // Der Schlüssel trägt, seine BEIDEN Zielstämme sind tot: der Treffer stammt ausschliesslich aus
    // dem Wort selbst. Belegt an einer Kopie ohne das Literal — dieselbe Bauart wie der
    // literalfreie Fall oben (`:208`), nur umgekehrt gelesen.
    expect(treffer.length).toBeGreaterThan(0);
    const ohneLiteral = resolved.map((e) => ({
      ...e,
      title: e.title.replace(/artikel/gi, " "),
      body: e.body.replace(/artikel/gi, " "),
    }));
    expect(
      searchKlara(ohneLiteral, "artikel"),
      "ohne das Literal bliebe ein Synonymträger übrig — dann wäre die Messung oben falsch",
    ).toEqual([]);
    // Und es ist NICHT dieselbe Wirkung wie in DE: die Bibliothek fehlt. Wer im NL-UI „artikel"
    // tippt, bekommt externe Quellen und die Nachbarschaft, nicht den Bestand.
    expect(treffer.some((e) => e.id === "page:library")).toBe(false);
    await i18n.changeLanguage("de");
    const de = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    expect(searchKlara(de, "artikel").some((e) => e.id === "page:library")).toBe(true);
  });
});
