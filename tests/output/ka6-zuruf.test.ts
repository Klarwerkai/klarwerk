// ================================================================================================
// KA6 STUFE 1 · DER ZURUF, DER NICHTS SCHREIBT — die Zusicherungen am Verhalten.
// ================================================================================================
//
// Der Abnahmesatz aus OFFEN.md lautet: „Ein leeres Dokument wird per Zuruf zu einem
// gekennzeichneten Entwurf, ohne einen einzigen ungefragten Schreibzugriff."
//
// Diese Datei belegt den Teil, den die Serverseite tragen kann. Sie prueft NICHT, dass das Panel
// erst auf Klick einfuegt — das ist Sache der Oberflaeche und dort verankert. Sie prueft die
// staerkere Aussage darunter: **Der Erzeuger hat gar keinen Schreibweg.** Wenn der Server keinen
// anbietet, kann kein Aufrufer ihn versehentlich nehmen — auch keiner, den es heute noch nicht gibt.
//
// DER SPION IST DER KERN. `Formulierer` ist injiziert, deshalb ist hier beweisbar, ob ueberhaupt
// etwas nach draussen ging — und WAS. Eine Zusage „ohne Einwilligung passiert nichts" ist ohne
// diesen Zaehler eine Behauptung.

import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import {
  type Formulierer,
  type ZurufAuftrag,
  ZurufError,
  ZurufService,
} from "../../services/output";

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  } as KnowledgeObject;
}

/** Zaehlt jeden Aufruf und haelt fest, was uebergeben wurde. */
function spion(antwort = "Ein Vorschlag.") {
  const auftraege: ZurufAuftrag[] = [];
  const f: Formulierer = {
    async formuliere(auftrag) {
      auftraege.push(auftrag);
      return antwort;
    },
  };
  return { formulierer: f, auftraege };
}

async function setup(kos: KnowledgeObject[], antwort?: string) {
  const repo = new InMemoryKoRepo();
  for (const k of kos) {
    await repo.insert(k);
  }
  const koService = new KoService({ repo });
  const s = spion(antwort);
  const zuruf = new ZurufService({
    koService,
    formulierer: s.formulierer,
    now: () => Date.parse("2026-08-20T23:45:00Z"),
  });
  return { zuruf, koService, ...s };
}

describe("KA6 Stufe 1 · A · ohne Einwilligung geht NICHTS nach draussen", () => {
  it("der Formulierer wird nicht ein einziges Mal gerufen", async () => {
    const t = await setup([]);
    await expect(
      t.zuruf.schlageVor({ art: "erstellen", text: "Ein Thema", einwilligung: false }),
    ).rejects.toThrow(ZurufError);
    // Das ist die eigentliche Zusicherung: nicht „ein Fehler kam", sondern „nichts ging hinaus".
    expect(t.auftraege).toHaveLength(0);
  });

  it("der Fehler nennt den Grund und nicht irgendeinen", async () => {
    const t = await setup([]);
    try {
      await t.zuruf.schlageVor({ art: "erstellen", text: "Ein Thema", einwilligung: false });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect(e).toBeInstanceOf(ZurufError);
      expect((e as ZurufError).code).toBe("CONSENT_MISSING");
    }
  });

  it("auch mit ausgewaehlten Quellen bleibt es bei null Aufrufen", async () => {
    const t = await setup([ko({ id: "K1" })]);
    await expect(
      t.zuruf.schlageVor({
        art: "umformulieren",
        text: "Alter Text",
        einwilligung: false,
        koIds: ["K1"],
      }),
    ).rejects.toThrow(ZurufError);
    expect(t.auftraege).toHaveLength(0);
  });
});

describe("KA6 Stufe 1 · B · das Ergebnis ist ein Vorschlag, keine Schreibanweisung", () => {
  it("der Abnahmesatz, soweit die Serverseite ihn traegt: leeres Dokument -> gekennzeichneter Entwurf", async () => {
    const t = await setup([], "Sehr geehrte Damen und Herren, ...");
    const v = await t.zuruf.schlageVor({
      art: "erstellen",
      text: "Anschreiben zur Wartung",
      einwilligung: true,
    });

    expect(v.vorschlag).toBe("Sehr geehrte Damen und Herren, ...");
    // GEKENNZEICHNET: dasselbe Feld, an dem mega81 die Anzeige der KI-Behauptung festmacht.
    expect(v.aiGenerated).toBe(true);
    expect(v.herkunft).toBe("frei");
    expect(v.art).toBe("erstellen");
  });

  it("es gibt kein Feld, das eine Schreibung ausdrueckt", async () => {
    const t = await setup([], "Text");
    const v = await t.zuruf.schlageVor({ art: "erstellen", text: "Thema", einwilligung: true });

    // Wer hier ein Ziel, eine Position oder einen Einfuegebefehl einbaut, roetet diesen Fall.
    // Das ist die strukturelle Fassung von „Klara schreibt NIE selbsttaetig ins Dokument".
    expect(Object.keys(v).sort()).toEqual(
      ["aiGenerated", "art", "generatedAt", "herkunft", "provenance", "vorschlag"].sort(),
    );
    for (const verboten of ["insert", "apply", "target", "range", "write", "document"]) {
      expect(v).not.toHaveProperty(verboten);
    }
  });

  it("alle drei Zurufe liefern einen Vorschlag und keiner eine Aktion", async () => {
    for (const art of ["erstellen", "vervollstaendigen", "umformulieren"] as const) {
      const t = await setup([], "Vorschlag");
      const v = await t.zuruf.schlageVor({ art, text: "Ein Text", einwilligung: true });
      expect(v.art).toBe(art);
      expect(v.vorschlag).toBe("Vorschlag");
      expect(t.auftraege).toHaveLength(1);
      expect(t.auftraege[0]?.art).toBe(art);
    }
  });
});

describe("KA6 Stufe 1 · C · Vertrauliches wird abgestreift, bevor es hinausgeht", () => {
  it("ein vertrauliches KO erscheint weder im Auftrag noch in der Herkunft", async () => {
    const t = await setup([
      ko({ id: "OFFEN1", statement: "darf hinaus" }),
      ko({ id: "GEHEIM", statement: "darf NICHT hinaus", confidentiality: "vertraulich" }),
    ]);

    const v = await t.zuruf.schlageVor({
      art: "vervollstaendigen",
      text: "Anfang",
      einwilligung: true,
      koIds: ["OFFEN1", "GEHEIM"],
    });

    const hinaus = t.auftraege[0];
    expect(hinaus?.belege.map((b) => b.koId)).toEqual(["OFFEN1"]);
    // Der vertrauliche Text steht in KEINER Form im Auftrag.
    expect(JSON.stringify(hinaus)).not.toContain("darf NICHT hinaus");
    expect(JSON.stringify(hinaus)).not.toContain("GEHEIM");
    expect(v.provenance.map((p) => p.koId)).toEqual(["OFFEN1"]);
  });

  it("auch `streng_vertraulich` bleibt draussen", async () => {
    const t = await setup([
      ko({ id: "STRENG", statement: "hoechste Stufe", confidentiality: "streng_vertraulich" }),
    ]);
    const v = await t.zuruf.schlageVor({
      art: "erstellen",
      text: "Thema",
      einwilligung: true,
      koIds: ["STRENG"],
    });
    expect(t.auftraege[0]?.belege).toHaveLength(0);
    expect(v.provenance).toHaveLength(0);
    expect(v.herkunft).toBe("frei");
  });

  it("nicht validierte Quellen werden ausgelassen, nicht mitgesendet", async () => {
    // `KoStatus` kennt genau zwei Werte: "offen" und "validiert"
    // (`knowledge-object/src/types.ts:17`). "offen" ist der ungeprüfte Stand.
    const t = await setup([
      ko({ id: "OFFENER", status: "offen", statement: "noch nicht geprueft" }),
      ko({ id: "GUT", statement: "validiert" }),
    ]);
    const v = await t.zuruf.schlageVor({
      art: "erstellen",
      text: "Thema",
      einwilligung: true,
      koIds: ["OFFENER", "GUT"],
    });
    expect(t.auftraege[0]?.belege.map((b) => b.koId)).toEqual(["GUT"]);
    expect(v.herkunft).toBe("bestand");
    expect(v.provenance).toHaveLength(1);
  });
});

describe("KA6 Stufe 1 · D · Herkunft ist Pflicht", () => {
  it("mit validierter Quelle: herkunft = bestand, Provenance traegt die Quelle", async () => {
    const t = await setup([ko({ id: "K1", title: "Wartungsplan" })]);
    const v = await t.zuruf.schlageVor({
      art: "umformulieren",
      text: "Alter Satz",
      einwilligung: true,
      koIds: ["K1"],
    });
    expect(v.herkunft).toBe("bestand");
    expect(v.provenance).toHaveLength(1);
    expect(v.provenance[0]?.title).toBe("Wartungsplan");
    expect(v.provenance[0]?.status).toBe("validiert");
    // Auch mit Bestandsbezug bleibt der Text KI-formuliert — beides ist wahr, beides steht da.
    expect(v.aiGenerated).toBe(true);
  });

  it("ohne Quelle: herkunft = frei, und das wird nicht verschwiegen", async () => {
    const t = await setup([]);
    const v = await t.zuruf.schlageVor({ art: "erstellen", text: "Thema", einwilligung: true });
    expect(v.herkunft).toBe("frei");
    expect(v.provenance).toEqual([]);
    expect(v.aiGenerated).toBe(true);
  });
});

describe("KA6 Stufe 1 · E · erfunden wird nichts", () => {
  it("ein leerer Formuliererlauf wird NICHT als Vorschlag ausgegeben", async () => {
    const t = await setup([], "   ");
    try {
      await t.zuruf.schlageVor({ art: "erstellen", text: "Thema", einwilligung: true });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect((e as ZurufError).code).toBe("NO_BASIS");
    }
  });

  it("ohne Text und ohne Markierung wird gar nicht erst gefragt", async () => {
    const t = await setup([]);
    try {
      await t.zuruf.schlageVor({ art: "erstellen", text: "   ", einwilligung: true });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect((e as ZurufError).code).toBe("NO_INPUT");
    }
    expect(t.auftraege).toHaveLength(0);
  });

  it("ein unbekannter Zuruf wird abgewiesen, bevor die Einwilligung geprueft wird", async () => {
    const t = await setup([]);
    try {
      await t.zuruf.schlageVor({
        art: "loeschen" as never,
        text: "Thema",
        einwilligung: true,
      });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect((e as ZurufError).code).toBe("UNKNOWN_ART");
    }
    expect(t.auftraege).toHaveLength(0);
  });

  it("ohne verdrahteten Formulierer entsteht kein halber Vorschlag", async () => {
    const repo = new InMemoryKoRepo();
    const zuruf = new ZurufService({ koService: new KoService({ repo }) });
    try {
      await zuruf.schlageVor({ art: "erstellen", text: "Thema", einwilligung: true });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect((e as ZurufError).code).toBe("NO_FORMULIERER");
    }
  });
});
