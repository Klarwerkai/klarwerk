// @vitest-environment jsdom
// ================================================================================================
// JOB 3438 · BILDVERKLEINERUNG-SICHTBAR — WAS MIT PEDIS BILDERN GESCHAH, STEHT IM PANEL.
// ================================================================================================
//
// PEDIS FALL (Auftrag §1): er uebernimmt ueber Klara „Ganzes Dokument" eine .docx mit Bildern.
// Der Server verkleinert sie seit JOB 3400 und sagt in DERSELBEN Antwort, was er getan und was er
// gelassen hat (`imagesShrunk`, `imagesKeptOriginal`, `imageSkipReasons` —
// `services/app/src/routes/capture-routes.ts:1066-1068`). Das Panel las davon bis zu dieser Runde
// NICHTS: `sendeDocxDatei` fuetterte den zweiten Platz von `bilderSatz` buchstaeblich mit `0`.
//
// WIE GEMESSEN WIRD: `createKlaraPanel` (tests/app/klara-panel-fixture.ts) baut den AUSGELIEFERTEN
// Rumpf von `apps/web/public/word-addin/taskpane.html` ins jsdom-DOM und fuehrt das vollstaendige
// Inline-Skript aus — kein zweiter Quelltext, keine Attrappe. Die Option `docxDatei` schaltet
// `getFileAsync`/`Office.FileType` im Office-Fake frei. ERST DAMIT erreicht `sendDocument()`
// ueberhaupt den `.docx`-Weg; ohne sie fiel `holeGanzeDatei` in JEDEM gemounteten Test sofort auf
// den alten Auswahl-Weg zurueck — `sendeDocxDatei` war unbetreten. Jeder Fall unten belegt den
// wirklich gegangenen Weg ueber den aufgezeichneten Abruf auf `/api/drafts/from-docx`.
//
// DIE ANTWORTKOERPER tragen genau die Form, die `capture-routes.ts:1054-1069` erzeugt.
//
// NACHBARSCHAFTSPROBE (dieselbe Regel wie in tests/m3-dokumentweg-panel/quellenfund-im-panel.test.tsx:22-24):
// die erwarteten Saetze stehen WOERTLICH hier, nicht als `p.t("schluessel")`. Ein Test, der das
// Woerterbuch des Produkts gegen sich selbst haelt, ist gruen, auch wenn beide falsch sind.
//
// ------------------------------------------------------------------------------------------------
// DIE KORREKTUR DER RUNDE 2 (BEN §1/§4/§6, HINWEIS.md der Steuerung) — was diese Datei jetzt anders
// misst als in Runde 1:
//
//   1. `imagesKeptOriginal` IST NICHT DIE ZAHL DER PROBLEME. Der Wert ist die Laenge von
//      `uebersprungen` (capture-routes.ts:1067-1068), und die Liste mischt Erfolge und Ausfaelle.
//      Runde 1 sagte pauschal „3 Bilder blieben in Originalgroesse", auch wenn zwei davon schon
//      klein genug waren. Jetzt zerlegt das Panel die LISTE je Bild — Fall M ist der Mischfall,
//      den BEN selbst gemessen hat.
//   2. KEIN ERHALT AUS DEM VERARBEITUNGSZAEHLER. „blieb in Originalgroesse" behauptete, das Bild
//      stehe so im Entwurf; der Bericht des Verkleinerers belegt das nicht (Fall D2: Word gibt
//      Bilder gar nicht heraus, und der Zaehler zaehlt trotzdem). Jeder Satz spricht jetzt von der
//      VERARBEITUNG.
//   3. WORTTREUE KENNUNGEN. `t()` setzte den Wert als Zeichenkette ein — `String.replace` deutete
//      darin `$&`, `$$`, `` $` `` und `$'` als Ersatzmuster und verbog fremde Kennungen (Fall U).
// ------------------------------------------------------------------------------------------------
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

let panel: KlaraPanel | null = null;

afterEach(() => {
  panel?.restore();
  panel = null;
});

/**
 * Ein Sendelauf ueber den ECHTEN `.docx`-Weg des ausgelieferten Panels: Office gibt eine Datei
 * heraus, das Panel sammelt sie ein, schickt sie an `/api/drafts/from-docx` und bekommt `koerper`
 * zurueck. `id` steht fest — der Deep-Link ist hier nicht der Gegenstand.
 */
async function sendeDokument(koerper: Record<string, unknown>): Promise<KlaraPanel> {
  const p = createKlaraPanel({
    docxDatei: { bytes: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00], scheibenBytes: 4 },
    routes: { "/api/drafts/from-docx": reply(201, { id: "draft-3438", ...koerper }) },
  });
  panel = p;
  await p.flush();
  p.sendDocument();
  await p.flush();
  // Ohne diesen Beleg misst der Fall den Auswahl-Weg statt `sendeDocxDatei` — genau die Luecke,
  // die diese Runde schliesst.
  expect(
    p.calls.filter((c) => c.url === "/api/drafts/from-docx"),
    "der Lauf ist NICHT ueber den .docx-Weg gegangen",
  ).toHaveLength(1);
  return p;
}

/** Der sichtbare Bilder-Satz der Karte — die eine Stelle, an der die Auskunft ankommt. */
function bilderSatz(p: KlaraPanel): string {
  return p.text("#capture-bilder-satz");
}

/** Ist die Bilder-Zeile ueberhaupt im Bild? `hidden` = kein Satz, ruhige Anzeige. */
function bilderZeileSichtbar(p: KlaraPanel): boolean {
  return p.q("#capture-bilder-ergebnis")?.className !== "hidden";
}

// ================================================================================================
// A–C — DIE NEUE AUSKUNFT: verkleinert, nicht noetig, und wann Ruhe herrscht.
// ================================================================================================
describe("JOB 3438 · der Bilder-Satz nach dem Dokument-Import", () => {
  it("A · alles verkleinert → die Zahl steht da, kein Wort von Verlust, keine Warnung", async () => {
    const p = await sendeDokument({
      imagesTotal: 3,
      imagesEmbedded: 3,
      imagesDropped: 0,
      imagesShrunk: 3,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
    expect(bilderSatz(p)).toBe("3 Bilder wurden verkleinert.");
    expect(bilderZeileSichtbar(p)).toBe(true);
    // Der Verlusthinweis hat hier keinen Anlass — nichts fehlt.
    expect(bilderSatz(p)).not.toContain("nicht herausgegeben");
    expect(bilderSatz(p)).not.toContain("schlug die Verkleinerung fehl");
    // Die Erfolgszeile steht wie bisher daneben.
    expect(p.text("#capture-ergebnis")).toContain("Entwurf gesendet");
  });

  it("B · teils übersprungen, mit echtem Grund → die Zahl UND der Grund im Klartext", async () => {
    // Genau die Form, die JOB 3400 in seinem Fall F gemessen hat (archiv/3400/runde-2:28).
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesDropped: 0,
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
    expect(bilderSatz(p)).toBe(
      "1 Bild wurde verkleinert. Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
    // Die Kennung des Servers wird UEBERSETZT, nicht durchgereicht.
    expect(bilderSatz(p)).not.toContain("nicht-dekodierbar");
  });

  it("C · nichts verkleinert, aber alles in Ordnung → KEINE Warnung, KEIN Grund, KEINE Kennung", async () => {
    // DIE GEGENRICHTUNG gegen die naheliegende Ueberschreitung „jeder uebersprungene Grund ist ein
    // Problem": „schon-klein-genug" und „ableitung-nicht-kleiner" sind ERFOLGE
    // (services/app/src/import/bildverkleinerung.ts:136-139). Ein Warnhinweis dafuer waere ein
    // Fehlalarm bei jedem zweiten Dokument und machte die echten Faelle unsichtbar.
    //
    // DIESER FALL PRUEFT AUSSCHLIESSLICH DIE STILLE. Er nennt bewusst KEINEN erwarteten Wortlaut:
    // damit haelt er auch dann, wenn die Bildbilanz gar nicht gelesen wird (Gegenprobe a) — und
    // faellt genau dann, wenn die Trennung Erfolg/Ausfall fehlt (Gegenprobe b). Der Wortlaut steht
    // im Nachbarfall C-Text. So haengen die zwei Gegenproben an zwei verschiedenen Faellen.
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 2,
      imageSkipReasons: ["schon-klein-genug", "ableitung-nicht-kleiner"],
    });
    const satz = bilderSatz(p);
    expect(satz).not.toContain("schlug die Verkleinerung fehl");
    expect(satz).not.toContain("nennt der Server");
    expect(satz).not.toContain("schon-klein-genug");
    expect(satz).not.toContain("ableitung-nicht-kleiner");
    expect(satz).not.toContain("nicht lesbar");
    expect(satz).not.toContain("zu groß");
    expect(satz).not.toContain("Zeitgrenze");
  });

  it("C-Text · derselbe Stand nennt, was wirklich geschah: nicht nötig, nicht kaputt", async () => {
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 2,
      imageSkipReasons: ["schon-klein-genug", "ableitung-nicht-kleiner"],
    });
    expect(bilderSatz(p)).toBe("2 Bilder mussten nicht verkleinert werden.");
    expect(bilderZeileSichtbar(p)).toBe(true);
  });

  it("C2 · „keine-data-quelle“ ist ebenfalls kein Ausfall — dort liegt gar kein eingebettetes Bild vor", async () => {
    const p = await sendeDokument({
      imagesTotal: 1,
      imagesEmbedded: 1,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["keine-data-quelle"],
    });
    expect(bilderSatz(p)).toBe("1 Bild musste nicht verkleinert werden.");
    expect(bilderSatz(p)).not.toContain("schlug die Verkleinerung fehl");
  });

  it("C3 · Dokument OHNE Bilder → gar kein Satz; nie „0 Bilder verkleinert“", async () => {
    const p = await sendeDokument({
      imagesTotal: 0,
      imagesEmbedded: 0,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
    expect(bilderSatz(p)).toBe("");
    expect(bilderZeileSichtbar(p)).toBe(false);
    expect(p.text("#capture-ergebnis")).toContain("Entwurf gesendet");
  });
});

// ================================================================================================
// M — DER MISCHFALL. Der Befund, an dem Runde 1 gescheitert ist (BEN §1).
// ================================================================================================
describe("JOB 3438 · Erfolge und Ausfälle stehen getrennt, jedes Bild in genau einem Eimer", () => {
  it("M · zweimal schon klein genug, einmal nicht lesbar → 2 und 1, nicht pauschal 3", async () => {
    // BENS EIGENE MESSUNG an Runde 1 lieferte hier „3 Bilder blieben in Originalgröße. Nicht
    // verkleinert: nicht lesbar." — eine Zahl, die zwei heile Bilder und ein zerbrochenes in
    // denselben Topf warf, und eine Grundliste, die offenliess, auf wie viele Bilder sie zutrifft.
    const p = await sendeDokument({
      imagesTotal: 3,
      imagesEmbedded: 3,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 3,
      imageSkipReasons: ["schon-klein-genug", "schon-klein-genug", "nicht-dekodierbar"],
    });
    expect(bilderSatz(p)).toBe(
      "2 Bilder mussten nicht verkleinert werden. Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
    // Die pauschale Zahl darf NIRGENDS mehr auftauchen: 3 ist die Summe, nicht der Befund.
    expect(bilderSatz(p)).not.toContain("3 ");
  });

  it("B2 · alle drei Ausfallgründe mit ihren Zahlen, in der Reihenfolge der Antwort", async () => {
    const p = await sendeDokument({
      imagesTotal: 5,
      imagesEmbedded: 5,
      imagesDropped: 0,
      imagesShrunk: 1,
      imagesKeptOriginal: 4,
      imageSkipReasons: [
        "zeitgrenze",
        "eingabe-zu-gross",
        "zeitgrenze",
        "nicht-dekodierbar",
        "schon-klein-genug",
      ],
    });
    // 1 verkleinert · 1 Erfolg · 4 Ausfaelle, davon zweimal die Zeitgrenze — die Zahl je Grund
    // ist der Punkt: ohne sie bliebe offen, welcher der drei Gruende das vierte Bild traegt.
    expect(bilderSatz(p)).toBe(
      "1 Bild wurde verkleinert. 1 Bild musste nicht verkleinert werden. " +
        "Bei 4 Bildern schlug die Verkleinerung fehl: 2× Zeitgrenze erreicht, zu groß, nicht lesbar.",
    );
  });
});

// ================================================================================================
// D/E — WAS NICHT KAPUTTGEHEN DARF: der Verlusthinweis, der alte Server, die Wissenslücke.
// ================================================================================================
describe("JOB 3438 · der vorhandene Verlusthinweis und die Wissenslücke", () => {
  it("D · fehlende Bilder UND Bildbilanz → der Verlustsatz steht WORTGLEICH zuerst, die Bilanz dahinter", async () => {
    const p = await sendeDokument({
      imagesTotal: 3,
      imagesEmbedded: 1,
      imagesDropped: 0,
      imagesShrunk: 1,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
    expect(bilderSatz(p)).toBe(
      "Word hat 2 Bilder nicht herausgegeben — der Text ist vollständig. 1 Bild wurde verkleinert.",
    );
    // Der schwerere Befund zuerst: der Verlusthinweis eroeffnet die Zeile.
    expect(
      bilderSatz(p).indexOf("Word hat 2 Bilder nicht herausgegeben"),
      "der Verlusthinweis steht nicht an erster Stelle",
    ).toBe(0);
  });

  it("D2 · verlorene Bilder trotz Übersprungenen → kein Satz behauptet, ein Bild liege im Entwurf", async () => {
    // BEN §5: Runde 1 stellte „2 Bilder blieben in Originalgröße" NEBEN „Word hat 2 Bilder nicht
    // herausgegeben" — eine Aussage ueber den ENTWURF, die der Verarbeitungsbericht nicht deckt.
    // Der Bericht sagt nur, was der Verkleinerer getan hat; ob das Bild im gespeicherten Entwurf
    // steht, weiss er nicht.
    const p = await sendeDokument({
      imagesTotal: 3,
      imagesEmbedded: 1,
      imagesDropped: 0,
      imagesShrunk: 1,
      imagesKeptOriginal: 2,
      imageSkipReasons: ["schon-klein-genug", "nicht-dekodierbar"],
    });
    expect(bilderSatz(p)).toBe(
      "Word hat 2 Bilder nicht herausgegeben — der Text ist vollständig. " +
        "1 Bild wurde verkleinert. 1 Bild musste nicht verkleinert werden. " +
        "Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
    // Kein Wort ueber den Verbleib im Entwurf — weder „Originalgröße" noch „im Entwurf".
    expect(bilderSatz(p)).not.toContain("Originalgröße");
    expect(bilderSatz(p)).not.toContain("blieb in");
  });

  it("D3 · Word gibt GAR KEIN Bild heraus, der Bericht zählt trotzdem — in DE, EN und NL", async () => {
    // BENS PROMPTVERBESSERUNG: `imagesEmbedded: 0` bei positivem `imagesKeptOriginal`. Der
    // Verkleinerer hat gearbeitet, im Entwurf steht davon nichts — genau der Fall, in dem ein Satz
    // ueber „Originalgröße" dem Menschen ein Bild verspraeche, das nicht da ist. Beide Befunde
    // stehen nebeneinander, der schwerere zuerst, und keiner behauptet den anderen weg.
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 0,
      imagesDropped: 0,
      imagesShrunk: 0,
      imagesKeptOriginal: 2,
      imageSkipReasons: ["schon-klein-genug", "nicht-dekodierbar"],
    });
    const de = bilderSatz(p);
    expect(de).toBe(
      "Word hat 2 Bilder nicht herausgegeben — der Text ist vollständig. " +
        "1 Bild musste nicht verkleinert werden. Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
    p.setLang("en");
    const en = bilderSatz(p);
    expect(en).toBe(
      "Word did not release 2 images — the text is complete. " +
        "1 image did not need resizing. Resizing failed for 1 image: not readable.",
    );
    p.setLang("nl");
    const nl = bilderSatz(p);
    expect(nl).toBe(
      "Word heeft 2 afbeeldingen niet vrijgegeven — de tekst is volledig. " +
        "1 afbeelding hoefde niet te worden verkleind. Verkleinen mislukte bij 1 afbeelding: niet leesbaar.",
    );
    for (const satz of [de, en, nl]) {
      expect(satz).not.toMatch(/sendImage/);
      // Die pauschale Zahl der Übersprungenen taucht in KEINER Sprache auf: 1 und 1, nicht 2.
      // Die einzige „2" des Satzes gehört dem Verlusthinweis und steht an dessen Anfang.
      expect(satz.split("2").length - 1, "die pauschale Zahl 2 steht mehrfach da").toBe(1);
    }
    expect(new Set([de, en, nl]).size, "zwei Sprachen sagen dasselbe").toBe(3);
  });

  it("E(i) · eine Antwort OHNE die drei neuen Felder liest sich EXAKT wie heute", async () => {
    const p = await sendeDokument({ imagesTotal: 3, imagesEmbedded: 1, imagesDropped: 0 });
    expect(bilderSatz(p)).toBe("Word hat 2 Bilder nicht herausgegeben — der Text ist vollständig.");
  });

  it("E(i-b) · ein alter Server ohne JEDE Bildzahl sagt gar nichts — keine erfundene Null", async () => {
    const p = await sendeDokument({});
    expect(bilderSatz(p)).toBe("");
    expect(bilderZeileSichtbar(p)).toBe(false);
  });

  it.each([
    ["die Zahl ist eine Zeichenkette", { imagesShrunk: "2", imagesKeptOriginal: 0 }],
    ["die Zahl ist null", { imagesShrunk: null, imagesKeptOriginal: 0 }],
    ["die Zahl ist negativ", { imagesShrunk: -1, imageSkipReasons: [] }],
    ["die Zahl ist keine Zahl", { imagesShrunk: Number.NaN, imageSkipReasons: [] }],
  ])(
    "E(i-c) · %s → KEINE Verkleinerungszahl; es wird nie „0 Bilder verkleinert“ behauptet, weil ein Feld fehlte",
    async (_name, felder) => {
      const p = await sendeDokument({ imagesTotal: 1, imagesEmbedded: 1, ...felder });
      expect(bilderSatz(p)).toBe("");
      expect(bilderZeileSichtbar(p)).toBe(false);
    },
  );

  it("E(vi) · die Liste fehlt, die Zahl ist da → die neutrale Tatsache, weder Erfolg noch Schaden", async () => {
    // Ohne `imageSkipReasons` ist die ZUSAMMENSETZUNG der Uebersprungenen unbekannt. Die Zahl
    // trotzdem wegzulassen hiesse, eine Auskunft des Servers still zu verschlucken; sie als Erfolg
    // ODER als Ausfall auszugeben hiesse, etwas zu erfinden. Also: die blanke Tatsache.
    const p = await sendeDokument({
      imagesTotal: 4,
      imagesEmbedded: 4,
      imagesShrunk: 1,
      imagesKeptOriginal: 3,
    });
    expect(bilderSatz(p)).toBe("1 Bild wurde verkleinert. 3 Bilder wurden nicht verkleinert.");
    expect(bilderSatz(p)).not.toContain("mussten nicht");
    expect(bilderSatz(p)).not.toContain("schlug die Verkleinerung fehl");
  });

  it("E(vi-b) · die Liste ist da, die Summe fehlt → die Liste ist die Grundlage", async () => {
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesShrunk: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
    expect(bilderSatz(p)).toBe(
      "1 Bild wurde verkleinert. Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
  });

  it("E(ii) · ein Grund, den diese Fassung nicht kennt, steht MIT SEINER KENNUNG da — und gilt nicht als Ausfall", async () => {
    // Dieselbe Hausdoktrin wie bei den Nutzlastklassen (taskpane.html:2420-2422): eine kuerzere
    // Liste als vollstaendig auszugeben waere die Luege, nicht die unbekannte Kennung.
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["ein-neuer-grund"],
    });
    expect(bilderSatz(p)).toBe(
      "1 Bild wurde verkleinert. " +
        "Bei 1 Bild nennt der Server einen Grund, den diese Fassung nicht kennt: ein-neuer-grund.",
    );
    // Er wird NICHT als Ausfall behauptet — der Satz sagt, dass ein Grund unbekannt ist.
    expect(bilderSatz(p)).not.toContain("schlug die Verkleinerung fehl");
  });

  it("E(iii) · bekannte und unbekannte Gründe stehen getrennt, jeder mit seiner Zahl", async () => {
    const p = await sendeDokument({
      imagesTotal: 4,
      imagesEmbedded: 4,
      imagesShrunk: 0,
      imagesKeptOriginal: 4,
      imageSkipReasons: ["zeitgrenze", "ein-neuer-grund", "ein-neuer-grund", "noch-einer"],
    });
    expect(bilderSatz(p)).toBe(
      "Bei 1 Bild schlug die Verkleinerung fehl: Zeitgrenze erreicht. " +
        "Bei 3 Bildern nennt der Server Gründe, die diese Fassung nicht kennt: 2× ein-neuer-grund, noch-einer.",
    );
  });

  it("E(iv) · ein Fehlschlag der Route zeigt NIE eine Bildaussage — nur den Fehlersatz", async () => {
    const p = createKlaraPanel({
      docxDatei: {},
      routes: { "/api/drafts/from-docx": reply(413, {}) },
    });
    panel = p;
    await p.flush();
    p.sendDocument();
    await p.flush();
    expect(p.text("#send-status")).toContain("Zu groß für die Übertragung");
    expect(bilderSatz(p)).toBe("");
    expect(bilderZeileSichtbar(p)).toBe(false);
  });

  it("E(v) · ein NEUER Sendelauf setzt die alte Aussage zurück — sie steht nie über den nächsten Import hinweg", async () => {
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesShrunk: 2,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
    expect(bilderSatz(p)).toBe("2 Bilder wurden verkleinert.");
    p.sendDocument();
    // Waehrend des Sendens steht `sendBusy` — und KEINE vorweggenommene Bildaussage.
    expect(bilderSatz(p)).toBe("");
    await p.flush();
    expect(bilderSatz(p)).toBe("2 Bilder wurden verkleinert.");
  });
});

// ================================================================================================
// U — DIE KENNUNG STEHT WÖRTLICH DA. Auch wenn sie wie ein Ersatzmuster aussieht (BEN §4).
// ================================================================================================
describe("JOB 3438 · unbekannte Kennungen werden nicht gedeutet", () => {
  it("U · „$&“, „$$“, „$`“ und „$'“ überstehen den Weg durch t() unverändert", async () => {
    // BENS BEFUND an Runde 1: `t()` setzte den Wert ueber `String.replace(muster, ersatz)` ein.
    // Als Zeichenkette deutet der ERSATZ die Muster `$&` (der ganze Treffer, hier „{liste}"),
    // `$$` (ein Dollar), `` $` `` (davor) und `$'` (danach) — aus „ein-$&-grund" wurde
    // „ein-{liste}-grund". Der Server ist die Quelle dieser Kennungen; sie zu verbiegen hiesse,
    // dem Menschen eine Kennung zu zeigen, die es nicht gibt.
    const kennungen = ["ein-$&-grund", "a$$b", "c$`d", "e$'f"];
    const p = await sendeDokument({
      imagesTotal: 4,
      imagesEmbedded: 4,
      imagesShrunk: 0,
      imagesKeptOriginal: 4,
      imageSkipReasons: kennungen,
    });
    expect(bilderSatz(p)).toBe(
      "Bei 4 Bildern nennt der Server Gründe, die diese Fassung nicht kennt: " +
        "ein-$&-grund, a$$b, c$`d, e$'f.",
    );
    for (const k of kennungen) {
      expect(bilderSatz(p), `die Kennung ${k} kam nicht wörtlich an`).toContain(k);
    }
    expect(bilderSatz(p)).not.toContain("{liste}");
  });

  it("U2 · eine Kennung, die wie ein Platzhalter dieses Satzes aussieht, bleibt Text", async () => {
    // `{n}` steht im Satz `sendImagesUnknownMany` selbst. Wuerde die Liste VOR der Zahl eingesetzt,
    // fraesse die Zahl das `{n}` aus der Kennung — der Mensch laese „Bei 2 Bildern … 2".
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesShrunk: 0,
      imagesKeptOriginal: 2,
      imageSkipReasons: ["{n}", "{liste}"],
    });
    expect(bilderSatz(p)).toBe(
      "Bei 2 Bildern nennt der Server Gründe, die diese Fassung nicht kennt: {n}, {liste}.",
    );
  });
});

// ================================================================================================
// F — DIE SPRACHPROBE. Derselbe Stand, die Sprache des Fensters.
// ================================================================================================
describe("JOB 3438 · der Bilder-Satz spricht die Sprache des Fensters", () => {
  it("F · Fall B in DE, EN und NL: drei vollständige Sätze, keine durchgereichte Schlüsselkennung", async () => {
    const p = await sendeDokument({
      imagesTotal: 2,
      imagesEmbedded: 2,
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
    const de = bilderSatz(p);
    expect(de).toBe(
      "1 Bild wurde verkleinert. Bei 1 Bild schlug die Verkleinerung fehl: nicht lesbar.",
    );
    p.setLang("en");
    const en = bilderSatz(p);
    expect(en).toBe("1 image was resized. Resizing failed for 1 image: not readable.");
    p.setLang("nl");
    const nl = bilderSatz(p);
    expect(nl).toBe(
      "1 afbeelding is verkleind. Verkleinen mislukte bij 1 afbeelding: niet leesbaar.",
    );
    // Faellt ein Schluessel weg, gibt `t()` den SCHLUESSELNAMEN zurueck — der ist nicht leer und
    // haette eine reine Laengenpruefung bestanden (JOB 2551, BEN `:16`).
    for (const satz of [de, en, nl]) {
      expect(satz).not.toMatch(/sendImage/);
    }
    expect(new Set([de, en, nl]).size, "zwei Sprachen sagen dasselbe").toBe(3);
  });

  it("F2 · der Mischfall in DE, EN und NL — die Trennung überlebt den Sprachwechsel", async () => {
    const p = await sendeDokument({
      imagesTotal: 4,
      imagesEmbedded: 4,
      imagesShrunk: 1,
      imagesKeptOriginal: 3,
      imageSkipReasons: ["schon-klein-genug", "zeitgrenze", "zeitgrenze"],
    });
    const de = bilderSatz(p);
    expect(de).toBe(
      "1 Bild wurde verkleinert. 1 Bild musste nicht verkleinert werden. " +
        "Bei 2 Bildern schlug die Verkleinerung fehl: 2× Zeitgrenze erreicht.",
    );
    p.setLang("en");
    const en = bilderSatz(p);
    expect(en).toBe(
      "1 image was resized. 1 image did not need resizing. " +
        "Resizing failed for 2 images: 2× time limit reached.",
    );
    p.setLang("nl");
    const nl = bilderSatz(p);
    expect(nl).toBe(
      "1 afbeelding is verkleind. 1 afbeelding hoefde niet te worden verkleind. " +
        "Verkleinen mislukte bij 2 afbeeldingen: 2× tijdslimiet bereikt.",
    );
    for (const satz of [de, en, nl]) {
      expect(satz).not.toMatch(/sendImage/);
      // Der Erfolg bleibt in JEDER Sprache aus der Ausfallzeile heraus: 2 Ausfaelle, nicht 3.
      expect(satz).not.toMatch(/3/);
    }
    expect(new Set([de, en, nl]).size, "zwei Sprachen sagen dasselbe").toBe(3);
  });
});
