// ================================================================================================
// JOB 4293 · N — DER RUNDLAUF AM ECHTEN SOCKET: N1 bis N4 und die Schutzregeln daneben.
// ================================================================================================
//
// WAS DIESE DATEI MISST und was nicht: Sie fährt die ganze Kette über ECHTE Ports
// (`starteStrecke`, `fetch` mit Keksbeutel) gegen die unveränderte gebaute Anwendung — Export,
// Datei, Produktparser, Prüfwarteschlange, Annehmen, Neuladen, Reexport. Sie braucht KEINEN Browser
// und KEINE Datenbank; die Ablagen sind die Speicherfassungen.
//
// WAS SIE AUSDRÜCKLICH NICHT BELEGT: den BEDIENWEG. Dass ein Mensch die Datei über die sichtbare
// Dateiauswahl übergibt, den Volltext auf der Karte liest und den Knopf drückt, steht in
// `rundlauf-im-echten-browser.test.ts`; dass der Inhalt einen Neustart der Anwendung und eine
// eigene Lesung am PostgreSQL-Pool überlebt, in `rundlauf-pg.integration.test.ts`. Diese Datei
// behauptet davon nichts.
//
// JEDER FALL BEKOMMT EIGENE, FRISCHE INSTANZEN (Auftrag § 7: „auf isolierten eigenen Daten"). Das
// ist nicht Sorgfalt um ihrer selbst willen: der Dublettenschutz des Imports entscheidet über den
// BESTAND der Zielinstanz, und Fälle, die sich einen Bestand teilen, messen einander mit. Die erste
// Fassung dieses Prüfstands hat genau daran gehangen (Arbeitsprüfung 13291110…).
import { afterEach, describe, expect, it } from "vitest";
import { KERNAUSSAGE_MAX } from "../../services/structure";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  BOESE_SPUREN,
  JOB,
  KERNAUSSAGE,
  KERN_MARKE,
  OHNE_VOLLTEXT_MARKE,
  type Rundlaufinstanzen,
  TITEL,
  TITEL_OHNE,
  VOLLTEXT_MARKE,
  auswahlLesen,
  boeserVolltext,
  direktImportieren,
  einreihen,
  entscheiden,
  exportEintrag,
  exportdatei,
  exportiere,
  fahreDenRundlauf,
  freigeben,
  kandidatMitTitel,
  koLesen,
  legeQuellobjektAn,
  mussAntwort,
  pruefeVolltextZusage,
  suchen,
  volltextHtml,
  warteschlange,
} from "./weg";

const ADMIN = "rundlauf@volltext-4293.test";
const LESER = "nur-lesen@volltext-4293.test";
const TAGS = ["dichtung", "presse-7"];

const laufende: Strecke[] = [];

interface Paar extends Rundlaufinstanzen {
  /** Die Strecke der Zielinstanz — nur die Rechtefälle brauchen sie (zweites Profil). */
  zielStrecke: Strecke;
}

/**
 * Zwei frische Anwendungen auf zwei echten Ports: eine, aus der exportiert wird, und die FRISCHE,
 * in die die Datei geht. Warum zwei und nicht eine, steht bei `Rundlaufinstanzen` in `weg.ts`.
 */
async function neuesPaar(): Promise<Paar> {
  const quellStrecke = await starteStrecke();
  const zielStrecke = await starteStrecke();
  laufende.push(quellStrecke, zielStrecke);
  return {
    quelle: (await ersteinrichtung(quellStrecke, ADMIN)).sitzung,
    ziel: (await ersteinrichtung(zielStrecke, ADMIN)).sitzung,
    zielStrecke,
  };
}

afterEach(async () => {
  for (const strecke of laufende.splice(0)) {
    await strecke.schliessen();
  }
}, 60_000);

describe(`${JOB} · der JSON-Rundlauf mit Volltext, am echten Socket`, () => {
  it("N1 · der Dateiweg rein: der Parser reicht einen vom Anriss abweichenden Volltext durch", () => {
    const volltext = volltextHtml();
    // Die Datei ist die eines Menschen: Pflichtfelder plus der lange Text. Dass beide VERSCHIEDEN
    // sind, ist hier die Voraussetzung und wird deshalb zuerst gemessen — sonst könnte die
    // Kernaussage den Volltext vertreten, und der Fall bewiese nichts.
    expect(KERNAUSSAGE, "die Kernaussage traegt die Volltextmarke").not.toContain(VOLLTEXT_MARKE);
    expect(volltext, "der Volltext traegt die Kernaussagenmarke").not.toContain(KERN_MARKE);
    expect(
      KERNAUSSAGE.length,
      "die Kernaussage dieses Prüfstands ist laenger als der Anriss ueberhaupt sein darf",
    ).toBeLessThanOrEqual(KERNAUSSAGE_MAX);

    const items = auswahlLesen(
      JSON.stringify([
        {
          title: TITEL,
          statement: KERNAUSSAGE,
          type: "best_practice",
          category: "Wartung",
          tags: TAGS,
          bodyHtml: volltext,
        },
      ]),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.bodyHtml, `${JOB}: N1 · der Parser hat den Volltext fallen lassen.`).toBe(
      volltext,
    );
    // Und die Pflichtfelder bleiben, wie sie waren — kein Feld ist unterwegs verrutscht.
    expect(items[0]?.statement).toBe(KERNAUSSAGE);
    expect(items[0]?.tags).toEqual(TAGS);
  });

  it("N1b · eine Datei OHNE Volltext bleibt gültig, und es wird keiner erfunden", () => {
    const items = auswahlLesen(
      JSON.stringify([
        {
          title: TITEL_OHNE,
          statement: `Kurznotiz ${OHNE_VOLLTEXT_MARKE} ohne jeden Fliesstext.`,
          type: "technik",
          category: "Wartung",
        },
      ]),
    );
    expect(items).toHaveLength(1);
    // KEIN Pflichtfeld: die Datei kommt durch. Und `bodyHtml` steht NICHT da — nicht als leerer
    // String und ausdrücklich nicht aus `statement` gebaut (Auftrag § 5.3).
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(["category", "statement", "title", "type"]);
    // Auch ein leerer oder nur aus Leerraum bestehender Volltext ist keiner.
    for (const leer of ["", "   ", "\n\t"]) {
      const gelesen = auswahlLesen(
        JSON.stringify([
          {
            title: TITEL_OHNE,
            statement: "x",
            type: "technik",
            category: "Wartung",
            bodyHtml: leer,
          },
        ]),
      );
      expect(
        gelesen[0]?.bodyHtml,
        `leerer Volltext ${JSON.stringify(leer)} wurde uebernommen`,
      ).toBe(undefined);
    }
  });

  it("L2 · der Export selbst trägt den Volltext — gemessen, nicht angenommen", async () => {
    const { quelle } = await neuesPaar();
    const titel = `${TITEL} · Exportmessung`;
    const koId = await legeQuellobjektAn(quelle, {
      titel,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    });
    // VOR der Freigabe steht das Objekt NICHT im Export — das ist die Egress-Regel (SCRUM-506) und
    // zugleich die Vorprobe, dass dieser Export wirklich filtert und nicht einfach alles ausgibt.
    const vorher = await exportiere(quelle);
    expect(
      vorher.eintraege.some((e) => e.title === titel),
      `${JOB}: L2 · ein nicht freigegebenes Objekt steht im Export.`,
    ).toBe(false);
    await freigeben(quelle, koId);
    const eintrag = exportEintrag(await exportiere(quelle), titel);
    expect(
      eintrag.bodyHtml,
      `${JOB}: L2 · der Export liefert den Volltext des Quellobjekts nicht.`,
    ).toContain(VOLLTEXT_MARKE);
    expect(eintrag.statement).toBe(KERNAUSSAGE);
  });

  it("N2/N4 · Export → Dateiauswahl → Kandidat → Annehmen → Neuladen → Reexport", async () => {
    const instanzen = await neuesPaar();
    const plan = {
      titel: `${TITEL} · Kette`,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    };
    const befund = await fahreDenRundlauf(instanzen, plan);
    // Das Zielobjekt ist ein NEUES Objekt — neue Kennung, Version 1, vor der Freigabe Status
    // „offen". Genau das ist laut Auftrag § 5.8 KEIN Defekt und wird hier festgehalten, damit
    // niemand später eine Identitätswiederherstellung hineinliest.
    expect(befund.zielKo.version, `${JOB}: das Zielobjekt ist nicht Version 1.`).toBe(1);
    pruefeVolltextZusage(befund, plan);
  });

  it("N2b · die konservative Einstufung des Importwegs bleibt — sie wird NICHT angeglichen", async () => {
    const instanzen = await neuesPaar();
    const befund = await fahreDenRundlauf(instanzen, {
      titel: `${TITEL} · Einstufung`,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    });
    // Die Quelle ist „intern", das Ziel „vertraulich": der Re-Import ist ein Bulk-Pfad und stuft
    // ohne Governance-Signal konservativ ein (SCRUM-509 R3). Die Abweichung ist DOKUMENTIERT und
    // wird ausdrücklich nicht durch Absenken eines Schutzes „behoben" (Auftrag § 5.8/§ 10). Dieser
    // Fall ist der Riegel dagegen: wer sie angleicht, macht ihn rot.
    expect(befund.quellExport.confidentiality).toBe("intern");
    expect(
      befund.zielKo.confidentiality,
      `${JOB}: die Einstufung des Importziels wurde abgesenkt.`,
    ).toBe("vertraulich");
  });

  it("N3 · derselbe Inhaltsvertrag auf dem direkten API-Weg POST /api/library/import", async () => {
    const { quelle, ziel } = await neuesPaar();
    const titel = `${TITEL} · direkter Weg`;
    // Die Datei entsteht wie beim sichtbaren Weg — aus einem echten Export, durch den echten
    // Parser. Nur die Oberfläche fehlt: eingespielt wird ohne Warteschlange und ohne Prüfkarte.
    const quellId = await legeQuellobjektAn(quelle, {
      titel,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    });
    await freigeben(quelle, quellId);
    const quellEintrag = exportEintrag(await exportiere(quelle), titel);
    const items = auswahlLesen(exportdatei([quellEintrag]));
    const befund = await direktImportieren(ziel, items);
    expect(
      befund.imported,
      `${JOB}: N3 · der direkte Weg hat nichts eingespielt (skipped ${befund.skipped}).`,
    ).toBe(1);
    // Das angelegte Objekt unabhängig suchen und lesen — nicht die Antwort des Schreibwegs glauben.
    // Sie nennt ohnehin keine Kennung (`ImportResult` zählt nur), und das ist ihr Vertrag.
    const zielObjekt = await koLesen(ziel, await kennungAusDemBestand(ziel, titel));
    expect(
      zielObjekt.bodyHtml,
      `${JOB}: N3 · der direkte Importweg hat den Volltext verloren.`,
    ).toContain(VOLLTEXT_MARKE);
    expect(
      zielObjekt.bodyHtml,
      `${JOB}: N3 · der Volltext ist nicht zeichengleich angekommen.`,
    ).toBe(quellEintrag.bodyHtml);
    expect(zielObjekt.statement).toBe(KERNAUSSAGE);
  });

  it("L7a · bösartiges HTML im Volltext kommt nicht ausführbar an", async () => {
    const { ziel } = await neuesPaar();
    const titel = `${TITEL} · boeses HTML`;
    const items = auswahlLesen(
      JSON.stringify([
        {
          title: titel,
          statement: KERNAUSSAGE,
          type: "best_practice",
          category: "Wartung",
          bodyHtml: boeserVolltext(),
        },
      ]),
    );
    // Der Parser reicht durch, was in der Datei steht — er ist kein Sanitizer und soll keiner sein.
    expect(
      items[0]?.bodyHtml,
      `${JOB}: L7a · der Parser hat den boesen Volltext verworfen.`,
    ).toContain("<script");
    const kandidat = kandidatMitTitel(await einreihen(ziel, items), titel);
    const angenommen = await entscheiden(ziel, kandidat.id, "accept");
    expect(
      angenommen.koId,
      `${JOB}: L7a · der Sicherheitsfall hat kein Zielobjekt.`,
    ).not.toBeNull();
    const zielObjekt = await koLesen(ziel, angenommen.koId as string);
    const gespeichert = String(zielObjekt.bodyHtml ?? "");
    // Der harmlose Teil ist angekommen — der Schutz hat nicht einfach alles verworfen.
    expect(gespeichert, `${JOB}: L7a · auch der harmlose Teil ist weg.`).toContain(VOLLTEXT_MARKE);
    for (const spur of BOESE_SPUREN) {
      expect(
        gespeichert.toLowerCase(),
        `${JOB}: L7a · „${spur}" steht im gespeicherten Volltext.`,
      ).not.toContain(spur);
    }
  });

  it("L7b · Wiederholimport legt kein zweites Objekt an, Ablehnung legt keines an", async () => {
    const instanzen = await neuesPaar();
    const plan = {
      titel: `${TITEL} · Wiederholung`,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    };
    const erste = await fahreDenRundlauf(instanzen, plan);
    // DIESELBE Datei ein zweites Mal in DIESELBE Zielinstanz: der Kandidat wird als Dublette
    // erkannt, und das Annehmen legt kein zweites Objekt an (JOB 3050,
    // `kandidatErzeugtWissensobjekt`). Genau dieser Schutz ist es, der zwei Instanzen nötig macht.
    const zweite = kandidatMitTitel(
      await einreihen(instanzen.ziel, auswahlLesen(erste.dateiInhalt)),
      plan.titel,
    );
    expect(zweite.duplicate, `${JOB}: L7b · der Wiederholimport gilt nicht als Dublette.`).toBe(
      true,
    );
    const wieder = await entscheiden(instanzen.ziel, zweite.id, "accept");
    expect(
      wieder.koId,
      `${JOB}: L7b · der Wiederholimport hat ein zweites Objekt angelegt.`,
    ).toBeNull();
    // Und die Ablehnung: ein eigener, frischer Eintrag, abgelehnt — kein Objekt.
    const abgelehnterTitel = `${plan.titel} · abgelehnt`;
    const kandidat = kandidatMitTitel(
      await einreihen(
        instanzen.ziel,
        auswahlLesen(
          JSON.stringify([
            {
              title: abgelehnterTitel,
              statement: `Ablehnfall ${KERN_MARKE}: dieser Eintrag wird bewusst nicht uebernommen.`,
              type: "best_practice",
              category: "Wartung",
              bodyHtml: volltextHtml(),
            },
          ]),
        ),
      ),
      abgelehnterTitel,
    );
    const abgelehnt = await entscheiden(instanzen.ziel, kandidat.id, "reject");
    expect(abgelehnt.status).toBe("abgelehnt");
    expect(abgelehnt.koId, `${JOB}: L7b · eine Ablehnung hat ein Objekt angelegt.`).toBeNull();
  });

  it("L7c · die Grenze der Suchantwort bleibt: sie trägt weiterhin keinen Volltext", async () => {
    const instanzen = await neuesPaar();
    await fahreDenRundlauf(instanzen, {
      titel: `${TITEL} · Suchgrenze`,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    });
    // Gesucht wird nach der KERNaussagenmarke: sie steht im Suchraum (title/statement), die
    // Volltextmarke ausdrücklich nicht (WP-BILD-1f, `tests/library/search-transport.test.ts`).
    const treffer = await suchen(instanzen.ziel, KERN_MARKE);
    expect(treffer.length, `${JOB}: L7c · die Suche findet das Objekt nicht.`).toBeGreaterThan(0);
    for (const objekt of treffer) {
      expect(
        Object.hasOwn(objekt, "bodyHtml"),
        `${JOB}: L7c · die Suchantwort traegt bodyHtml — die Grenze ist gefallen.`,
      ).toBe(false);
    }
    expect(JSON.stringify(treffer)).not.toContain(VOLLTEXT_MARKE);
  });

  it("L7d · das Rechtetor des Importwegs bleibt: ein Leser reiht nichts ein und nimmt nichts an", async () => {
    const { ziel, zielStrecke } = await neuesPaar();
    const angelegt = await gastAnlegen(ziel, { name: "Nur Lesen", email: LESER, role: "viewer" });
    expect(angelegt.status, angelegt.text).toBe(201);
    const leser = zielStrecke.profil("leser");
    const an = await leser.sende("POST", "/api/auth/login", { email: LESER, password: PASSWORT });
    expect(an.status, an.text).toBe(200);
    const titel = `${TITEL} · fremde Hand`;
    const items = auswahlLesen(
      JSON.stringify([
        {
          title: titel,
          statement: KERNAUSSAGE,
          type: "best_practice",
          category: "Wartung",
          bodyHtml: volltextHtml(),
        },
      ]),
    );
    // BEIDE Türen, getrennt geprüft — und ausdrücklich als ERWARTETE Rechteverweigerung gegen den
    // festgelegten Vertrag, nicht als „Bestand gelesen": `ko.create` fürs Einreihen und für den
    // direkten Weg, `ko.validate` fürs Annehmen (`library-routes.ts`).
    const einreihversuch = await leser.sende("POST", "/api/library/import/candidates", { items });
    expect(
      einreihversuch.status,
      `${JOB}: L7d · ein Leser durfte einreihen: ${einreihversuch.text.slice(0, 200)}`,
    ).toBe(403);
    const direktversuch = await leser.sende("POST", "/api/library/import", { items });
    expect(
      direktversuch.status,
      `${JOB}: L7d · ein Leser durfte direkt importieren: ${direktversuch.text.slice(0, 200)}`,
    ).toBe(403);
    // Ein vom Admin eingereihter Kandidat lässt sich vom Leser nicht annehmen.
    const kandidat = kandidatMitTitel(await einreihen(ziel, items), titel);
    const annahmeversuch = await leser.sende(
      "PUT",
      `/api/library/import/candidates/${kandidat.id}`,
      { action: "accept" },
    );
    expect(
      annahmeversuch.status,
      `${JOB}: L7d · ein Leser durfte annehmen: ${annahmeversuch.text.slice(0, 200)}`,
    ).toBe(403);
    // Und der Kandidat steht unverändert offen da — die abgewiesene Aktion hat nichts bewegt.
    const danach = kandidatMitTitel(await warteschlange(ziel), titel);
    expect(danach.status).toBe("neu");
    expect(danach.koId).toBeNull();
  });

  it("L8 · ehrliche Grenze: ohne Volltext in der Datei steht keiner im Kandidaten und keiner im Ziel", async () => {
    const { ziel } = await neuesPaar();
    const titel = `${TITEL_OHNE} · Kette`;
    const items = auswahlLesen(
      JSON.stringify([
        {
          title: titel,
          statement: `Kurznotiz ${OHNE_VOLLTEXT_MARKE} ohne Fliesstext.`,
          type: "technik",
          category: "Wartung",
        },
      ]),
    );
    const kandidat = kandidatMitTitel(await einreihen(ziel, items), titel);
    // NICHTS wird erfunden: kein `bodyHtml`, und ausdrücklich nicht die Kernaussage als Ersatz.
    expect(
      kandidat.item.bodyHtml,
      `${JOB}: L8 · der Kandidat traegt einen Volltext, den die Datei nicht hatte.`,
    ).toBeUndefined();
    const angenommen = await entscheiden(ziel, kandidat.id, "accept");
    expect(
      angenommen.koId,
      `${JOB}: L8 · der Eintrag ohne Volltext wurde nicht uebernommen.`,
    ).not.toBeNull();
    const zielObjekt = await koLesen(ziel, angenommen.koId as string);
    expect(
      zielObjekt.bodyHtml === undefined || zielObjekt.bodyHtml === null,
      `${JOB}: L8 · das Zielobjekt traegt einen Volltext: ${String(zielObjekt.bodyHtml).slice(0, 200)}`,
    ).toBe(true);
    expect(zielObjekt.statement).toContain(OHNE_VOLLTEXT_MARKE);
  });
});

/**
 * Die Kennung dessen, was der direkte Importweg angelegt hat.
 *
 * Er gibt keine zurück (`ImportResult` zählt nur), und das ist sein Vertrag. Gesucht wird deshalb
 * über die öffentliche Liste — eine unabhängige Lesung, kein Umweg über einen Dienst.
 */
async function kennungAusDemBestand(wer: Sitzung, titel: string): Promise<string> {
  const liste = mussAntwort("GET /api/kos", await wer.sende("GET", "/api/kos")) as {
    id: string;
    title: string;
  }[];
  const treffer = liste.filter((k) => k.title === titel);
  expect(
    treffer.length,
    `${JOB}: „${titel}" steht nicht genau einmal im Zielbestand (${treffer.length}). Enthalten: ${liste
      .map((k) => k.title)
      .join(" · ")}`,
  ).toBe(1);
  return treffer[0]?.id as string;
}
