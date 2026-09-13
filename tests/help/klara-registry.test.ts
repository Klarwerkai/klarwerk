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
});
