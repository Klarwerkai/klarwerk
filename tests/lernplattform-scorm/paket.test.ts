// produkt:wettbewerb:20261003:lernplattform — DAS SCORM-1.2-PAKET SELBST, Datei für Datei.
//
// Erzeugt wird über den echten `LmsExportService` mit neutralen Beispieldaten (beispiel.ts); das
// ZIP wird mit jszip entpackt und jede Aussage an den entpackten Dateien gemessen. Zuordnung zu den
// Originalkriterien: K1 Format/Manifest, K2 Reihenfolge/Sprache/Text/Bild/Herkunft, K4 Fassungen,
// K5 Fehlerfälle, K6 Netzabhängigkeit, K7 Schutz/Empfänger.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SCORM_FORMAT, leseLmsEmpfaenger, leseScormEingabe } from "../../services/output";
import { PNG_1X1, beispielKo, bestand, eingabe, entpacke, paketOderFehler } from "./beispiel";
import { xml } from "./scorm12-attrappe";

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

const BILD_HTML =
  '<p>Vor dem Öffnen prüfen.</p><figure data-image-id="b1"><img src="/api/objects/OBJ-BILD/raw" alt="Ventil" data-image-id="b1"><figcaption data-image-id="b1">Bild 1: Ventil</figcaption></figure>';

function standardBestand() {
  return bestand(
    [
      beispielKo({
        id: "KO-A",
        title: 'Ventil <prüfen> & "sichern"',
        statement: "Vor jedem Eingriff den Druck prüfen.",
        conditions: ["Druck > 6 bar"],
        measures: ["Manometer ablesen", "Ventil schließen"],
        bodyHtml: BILD_HTML,
        attachments: [
          {
            id: "ANH-1",
            name: "ventil.png",
            mime: "image/png",
            objectId: "OBJ-BILD",
            author: "beispiel-autor",
            at: "2026-09-15T08:00:00.000Z",
          },
        ],
        sources: [
          {
            id: "Q-1",
            label: "Herstellerhandbuch Ventil",
            url: "https://hersteller.example/handbuch",
            excerpt: "GESCHUETZTER-FREMDAUSZUG-777",
            kind: "external",
            peerValidated: false,
            provider: "Hersteller",
            sourceVersion: 4,
            author: "beispiel-autor",
            at: "2026-09-15T08:00:00.000Z",
          },
        ],
      }),
      beispielKo({ id: "KO-B", title: "Druck ablassen", version: 3 }),
    ],
    { "OBJ-BILD": { mime: "image/png", data: PNG_1X1 } },
  );
}

describe("K1 · Format, Standardversion und Paketaufbau", () => {
  it("benennt SCORM 1.2, das Referenz-LMS, die Paketart und die Betriebsgrenzen", () => {
    expect(SCORM_FORMAT.standard).toBe("SCORM 1.2");
    expect(SCORM_FORMAT.schemaversion).toBe("1.2");
    expect(SCORM_FORMAT.referenzLms).toContain("Moodle 4.5");
    expect(SCORM_FORMAT.paketart).toContain("genau einem SCO");
    expect(SCORM_FORMAT.rueckkanal).toContain("keiner");
  });

  it("imsmanifest.xml ist wohlgeformt, SCORM 1.2 und listet genau die Dateien des Pakets", async () => {
    const { dienst } = standardBestand();
    const paket = await paketOderFehler(dienst, eingabe(["KO-A", "KO-B"]));
    const { text, bytes } = await entpacke(paket.daten);

    const manifestText = text.get("imsmanifest.xml") ?? "";
    const m = xml(manifestText);
    expect(m.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(m.getElementsByTagName("schema")[0]?.textContent).toBe("ADL SCORM");
    expect(m.getElementsByTagName("schemaversion")[0]?.textContent).toBe("1.2");

    const wurzel = m.getElementsByTagName("manifest")[0];
    expect(wurzel?.getAttribute("identifier")).toBe(paket.fassung.manifestId);
    expect(wurzel?.getAttribute("xmlns")).toBe("http://www.imsproject.org/xsd/imscp_rootv1p1p2");
    expect(m.getElementsByTagName("organizations")[0]?.getAttribute("default")).toBe("ORG-1");

    const ressourcen = Array.from(m.getElementsByTagName("resource"));
    expect(ressourcen).toHaveLength(1);
    expect(ressourcen[0]?.getAttribute("adlcp:scormtype")).toBe("sco");
    expect(ressourcen[0]?.getAttribute("href")).toBe("index.html");
    expect(m.getElementsByTagName("item")[0]?.getAttribute("identifierref")).toBe("RES-SCO");

    const gelistet = Array.from(m.getElementsByTagName("file"))
      .map((f) => f.getAttribute("href") ?? "")
      .sort();
    const imZip = [...bytes.keys()].filter((n) => n !== "imsmanifest.xml").sort();
    expect(gelistet).toEqual(imZip);
    expect(imZip).toContain("index.html");
    expect(imZip).toContain("sco.js");
  });
});

describe("K2 · Reihenfolge, Sprache, Text, Bilder, Quellen- und Fassungsbezug", () => {
  it("hält die gewählte Reihenfolge, die Texte und die Fassung je Einheit", async () => {
    const { dienst } = standardBestand();
    // Bewusst umgekehrt zur Anlage: die AUSWAHL bestimmt die Reihenfolge.
    const paket = await paketOderFehler(dienst, eingabe(["KO-B", "KO-A"]));
    const { text } = await entpacke(paket.daten);
    const html = text.get("index.html") ?? "";

    const reihenfolge = [...html.matchAll(/data-ko-id="([^"]+)" data-ko-version="(\d+)"/g)].map(
      (t) => `${t[1]}@v${t[2]}`,
    );
    expect(reihenfolge).toEqual(["KO-B@v3", "KO-A@v2"]);
    expect(paket.fassung.objekte.map((o) => `${o.koId}@v${o.version}`)).toEqual([
      "KO-B@v3",
      "KO-A@v2",
    ]);
    // Text kommt unverändert, aber sicher maskiert an.
    expect(html).toContain("Ventil &lt;prüfen&gt; &amp; &quot;sichern&quot;");
    expect(html).toContain("Vor jedem Eingriff den Druck prüfen.");
    expect(html).toContain("<li>Druck &gt; 6 bar</li>");
    expect(html).toContain("<li>Manometer ablesen</li><li>Ventil schließen</li>");
    // Fassungsbezug je Einheit und für das ganze Paket.
    expect(html).toContain("Wissensobjekt KO-A · Fassung v2 · Stand 2026-09-15T08:00:00.000Z");
    expect(html).toContain(`content="${paket.fassung.kennung}"`);
  });

  it("legt das Bild byte-gleich ins Paket und verweist nur noch dorthin", async () => {
    const { dienst } = standardBestand();
    const paket = await paketOderFehler(dienst, eingabe(["KO-A"]));
    const { text, bytes } = await entpacke(paket.daten);
    const html = text.get("index.html") ?? "";
    const medien = [...bytes.keys()].filter((n) => n.startsWith("medien/"));
    expect(medien).toHaveLength(1);
    const pfad = medien[0] ?? "";
    expect(pfad).toMatch(/^medien\/[0-9a-f]{16}\.png$/);
    expect(sha(bytes.get(pfad) ?? Buffer.alloc(0))).toBe(sha(PNG_1X1));
    expect(html).toContain(`src="${pfad}"`);
    expect(html).toContain("Bild 1: Ventil");
    expect(html).not.toContain("/api/objects/");
  });

  it("führt die Quelle mit Bezeichnung, Anbieter, Quellfassung und Adresse — ohne Fremdauszug", async () => {
    const { dienst } = standardBestand();
    const paket = await paketOderFehler(dienst, eingabe(["KO-A"]));
    const { text } = await entpacke(paket.daten);
    const html = text.get("index.html") ?? "";
    expect(html).toContain("Herstellerhandbuch Ventil (Hersteller · v4)");
    expect(html).toContain('href="https://hersteller.example/handbuch"');
    const nachweis = JSON.parse(text.get("klarwerk-export.json") ?? "{}");
    expect(nachweis.exportfassung).toBe(paket.fassung.kennung);
    expect(nachweis.objekte[0]).toMatchObject({
      koId: "KO-A",
      version: 2,
      stand: "2026-09-15T08:00:00.000Z",
      quellen: [
        {
          label: "Herstellerhandbuch Ventil",
          url: "https://hersteller.example/handbuch",
          provider: "Hersteller",
          sourceVersion: 4,
        },
      ],
    });
  });

  it("Sprache: deklariert und beschriftet das Paket in der gewählten Sprache (DE/EN)", async () => {
    const { dienst } = standardBestand();
    for (const [sprache, weiter] of [
      ["de", "Weiter"],
      ["en", "Next"],
    ] as const) {
      const paket = await paketOderFehler(dienst, eingabe(["KO-B"], { sprache }));
      const { text } = await entpacke(paket.daten);
      const html = text.get("index.html") ?? "";
      expect(html).toContain(`<html lang="${sprache}">`);
      expect(html).toContain(
        `<section data-einheit="0" data-ko-id="KO-B" data-ko-version="3" lang="${sprache}"`,
      );
      expect(html).toContain(`>${weiter}</button>`);
      expect(paket.fassung.sprache).toBe(sprache);
    }
  });
});

describe("K4 · V2 und V3 bleiben unterscheidbar, nichts wird überschrieben", () => {
  it("eine neue Objektfassung ergibt eine neue Exportfassung mit eigenem Bezeichner und Dateinamen", async () => {
    const { dienst, kos } = standardBestand();
    const v2 = await paketOderFehler(dienst, eingabe(["KO-A"]));
    const v2Erneut = await paketOderFehler(dienst, eingabe(["KO-A"]));
    // Gleicher Inhalt → byte-gleiches Paket: die Fassung ist reproduzierbar, nicht zufällig.
    expect(v2Erneut.sha256).toBe(v2.sha256);

    const alt = kos.get("KO-A");
    if (!alt) {
      throw new Error("KO-A fehlt");
    }
    kos.set("KO-A", {
      ...alt,
      version: 3,
      statement: "Vor jedem Eingriff den Druck prüfen und dokumentieren.",
      history: [
        ...alt.history,
        {
          version: 3,
          at: "2026-10-01T08:00:00.000Z",
          author: "beispiel-autor",
          note: "überarbeitet",
        },
      ],
    });
    const v3 = await paketOderFehler(dienst, eingabe(["KO-A"]));

    expect(v3.fassung.kennung).not.toBe(v2.fassung.kennung);
    expect(v3.fassung.manifestId).not.toBe(v2.fassung.manifestId);
    expect(v3.fassung.dateiname).not.toBe(v2.fassung.dateiname);
    expect(v2.fassung.objekte[0]?.version).toBe(2);
    expect(v3.fassung.objekte[0]?.version).toBe(3);
    // Das zuvor ausgelieferte V2-Paket ist unverändert: dieselben Bytes wie vor dem V3-Export.
    expect(sha(v2.daten)).toBe(v2.sha256);
    const { text } = await entpacke(v2.daten);
    expect(text.get("index.html")).toContain('data-ko-version="2"');
  });
});

describe("K5 · fehlende Medien, nicht Unterstütztes, fehlende Rechte — vor der Übergabe gemeldet", () => {
  const mitBild = (attachments = [] as Parameters<typeof beispielKo>[0]["attachments"]) =>
    beispielKo({ id: "KO-M", bodyHtml: BILD_HTML, ...(attachments ? { attachments } : {}) });

  it("fehlendes Bild blockiert mit MEDIA_MISSING; es entsteht kein Paket", async () => {
    const { dienst } = bestand([mitBild()], {});
    const p = await dienst.pruefe(eingabe(["KO-M"]));
    expect(p.exportierbar).toBe(false);
    expect(p.befunde).toContainEqual(
      expect.objectContaining({
        code: "MEDIA_MISSING",
        schwere: "blockiert",
        bereich: "medien",
        koId: "KO-M",
      }),
    );
    const r = await dienst.exportiere(eingabe(["KO-M"]));
    expect("daten" in r).toBe(false);
  });

  it("nicht unterstütztes Medienformat blockiert mit MEDIA_UNSUPPORTED und nennt das Format", async () => {
    const { dienst } = bestand([mitBild()], {
      "OBJ-BILD": { mime: "application/pdf", data: Buffer.from("%PDF-1.4") },
    });
    const p = await dienst.pruefe(eingabe(["KO-M"]));
    expect(p.exportierbar).toBe(false);
    const b = p.befunde.find((x) => x.code === "MEDIA_UNSUPPORTED");
    expect(b?.detail).toContain("application/pdf");
  });

  it("Bild aus einem Fremdsystem (ohne geklärte Rechte) blockiert mit MEDIA_FOREIGN", async () => {
    const { dienst } = bestand(
      [
        mitBild([
          {
            id: "ANH-F",
            name: "fremd.png",
            mime: "image/png",
            objectId: "OBJ-BILD",
            author: "import",
            at: "2026-09-15T08:00:00.000Z",
            quelle: { provider: "confluence", externalId: "att-1", abruf: "/download/att-1" },
          },
        ]),
      ],
      { "OBJ-BILD": { mime: "image/png", data: PNG_1X1 } },
    );
    const p = await dienst.pruefe(eingabe(["KO-M"]));
    expect(p.befunde).toContainEqual(
      expect.objectContaining({
        code: "MEDIA_FOREIGN",
        schwere: "blockiert",
        detail: "fremd.png (confluence)",
      }),
    );
  });

  it("nicht validiert und unbekannt blockieren mit eigenem Code; kein Paket", async () => {
    const { dienst } = bestand([beispielKo({ id: "KO-O", status: "offen" })]);
    const p = await dienst.pruefe(eingabe(["KO-O", "KO-GIBT-ES-NICHT"]));
    expect(p.exportierbar).toBe(false);
    expect(p.fassung).toBeNull();
    expect(p.befunde.map((b) => b.code).sort()).toEqual(["NOT_VALIDATED", "UNKNOWN_KO"]);
  });

  it("nicht übernommene Anhänge und interne Verweise werden als Hinweis genannt, nicht verschwiegen", async () => {
    const { dienst } = bestand([
      beispielKo({
        id: "KO-H",
        bodyHtml: '<p>Siehe <a href="/wissen/KO-X">Nachbarwissen</a>.</p>',
        attachments: [
          {
            id: "ANH-PDF",
            name: "pruefprotokoll.pdf",
            mime: "application/pdf",
            objectId: "OBJ-PDF",
            author: "beispiel-autor",
            at: "2026-09-15T08:00:00.000Z",
          },
        ],
      }),
    ]);
    const paket = await paketOderFehler(dienst, eingabe(["KO-H"]));
    const codes = paket.pruefung.befunde.map((b) => `${b.schwere}:${b.code}`).sort();
    expect(codes).toEqual(["hinweis:ATTACHMENTS_NOT_INCLUDED", "hinweis:LINK_INTERNAL_REMOVED"]);
    const { text } = await entpacke(paket.daten);
    expect(text.get("index.html")).toContain("<a>Nachbarwissen</a>");
    const nachweis = JSON.parse(text.get("klarwerk-export.json") ?? "{}");
    expect(nachweis.nichtEnthalten.map((b: { code: string }) => b.code).sort()).toEqual([
      "ATTACHMENTS_NOT_INCLUDED",
      "LINK_INTERNAL_REMOVED",
    ]);
  });

  it("ein unlesbarer Rumpf ist BAD_REQUEST, keine halbe Prüfung", () => {
    const code = (rumpf: unknown): string | undefined => {
      try {
        leseScormEingabe(rumpf);
      } catch (e) {
        return (e as { code?: string }).code;
      }
      return undefined;
    };
    expect(code({ koIds: "KO-A", sprache: "de", empfaenger: "x" })).toBe("BAD_REQUEST");
    expect(code({ koIds: ["KO-A"], sprache: "fr", empfaenger: "x" })).toBe("BAD_REQUEST");
    expect(code({})).toBe("BAD_REQUEST");
    expect(code({ koIds: ["KO-A"], sprache: "en", empfaenger: "x" })).toBeUndefined();
  });
});

describe("K6 · portabel: keine Netzabhängigkeit im Paket", () => {
  it("kein Skript, Stil, Bild oder Rahmen lädt von ausserhalb; die CSP erlaubt nur eigene Dateien", async () => {
    const { dienst } = standardBestand();
    const paket = await paketOderFehler(dienst, eingabe(["KO-A", "KO-B"]));
    const { text } = await entpacke(paket.daten);
    const html = text.get("index.html") ?? "";

    expect(html).toContain(
      `content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'"`,
    );
    // Jede Ladeanweisung zeigt auf eine Datei im Paket.
    const lader = [
      ...html.matchAll(/<(script|img|link|iframe|source|video|audio|embed|object)\b[^>]*>/gi),
    ].map((t) => t[0]);
    for (const tag of lader) {
      const ziel = /\s(?:src|href|data)="([^"]*)"/i.exec(tag)?.[1] ?? "";
      expect(ziel, tag).not.toMatch(/^(https?:)?\/\//i);
      if (!ziel.startsWith("data:")) {
        expect(text.has(ziel) || ziel.startsWith("medien/"), `${tag} zeigt nicht ins Paket`).toBe(
          true,
        );
      }
    }
    // Die einzigen Netzadressen im HTML sind Verweise, die erst auf Klick öffnen.
    for (const t of html.matchAll(/https?:\/\/[^"'\s<]+/g)) {
      const vorher = html.slice(Math.max(0, (t.index ?? 0) - 9), t.index);
      expect(vorher === '<a href="' || vorher.endsWith('">') || vorher.endsWith("— "), t[0]).toBe(
        true,
      );
    }
    // Skript und Stil sprechen mit keinem Server.
    for (const datei of ["sco.js", "sco.css"]) {
      const inhalt = text.get(datei) ?? "";
      expect(inhalt, datei).not.toMatch(
        /https?:\/\/|XMLHttpRequest|fetch\(|sendBeacon|WebSocket|@import|url\(/,
      );
    }
  });
});

describe("K7 · keine geschützten Inhalte, Empfängerfreigabe getrennt, Kontoregel wirksam", () => {
  it("vertrauliches Objekt, Schutzdaten und zugriffsbeschränkte Quelle blockieren", async () => {
    const { dienst } = bestand([
      beispielKo({ id: "KO-V", confidentiality: "vertraulich" }),
      beispielKo({
        id: "KO-S",
        schutzdatenQuarantaene: { arten: ["kontodaten"], seit: "2026-09-01" },
      }),
      beispielKo({
        id: "KO-R",
        sources: [
          {
            id: "Q-R",
            label: "Interne Wiki-Seite",
            url: null,
            excerpt: null,
            kind: "external",
            peerValidated: false,
            sourceRestrictions: { users: ["konto-1"], groups: [] },
            author: "import",
            at: "2026-09-15T08:00:00.000Z",
          },
        ],
      }),
    ]);
    for (const [id, code] of [
      ["KO-V", "CONFIDENTIAL"],
      ["KO-S", "SCHUTZDATEN"],
      ["KO-R", "SOURCE_RESTRICTED"],
    ] as const) {
      const p = await dienst.pruefe(eingabe([id]));
      expect(p.exportierbar, id).toBe(false);
      expect(
        p.befunde.map((b) => b.code),
        id,
      ).toContain(code);
      expect("daten" in (await dienst.exportiere(eingabe([id]))), id).toBe(false);
    }
  });

  it("vertraulich eingestuftes Bild blockiert mit MEDIA_CONFIDENTIAL", async () => {
    const { dienst } = bestand([beispielKo({ id: "KO-B2", bodyHtml: BILD_HTML })], {
      "OBJ-BILD": { mime: "image/png", data: PNG_1X1, confidentiality: "streng_vertraulich" },
    });
    const p = await dienst.pruefe(eingabe(["KO-B2"]));
    expect(p.befunde.map((b) => b.code)).toContain("MEDIA_CONFIDENTIAL");
  });

  it("der Fremdauszug einer Quelle steht in keiner Paketdatei", async () => {
    const { dienst } = standardBestand();
    const paket = await paketOderFehler(dienst, eingabe(["KO-A"]));
    const { text } = await entpacke(paket.daten);
    for (const [name, inhalt] of text) {
      expect(inhalt, name).not.toContain("GESCHUETZTER-FREMDAUSZUG-777");
    }
  });

  it("Empfängerfreigabe ist eine eigene Prüfung: freigegebener Inhalt geht trotzdem nicht an einen fremden Empfänger", async () => {
    const { dienst } = standardBestand();
    const fremd = await dienst.pruefe(eingabe(["KO-B"], { empfaenger: "fremdes-lms" }));
    expect(fremd.exportierbar).toBe(false);
    expect(fremd.befunde).toEqual([
      expect.objectContaining({ code: "RECIPIENT_NOT_ALLOWED", bereich: "empfaenger" }),
    ]);
    // Der INHALT ist dabei freigegeben — die Fassung ist berechnet, nur die Übergabe ist gesperrt.
    expect(fremd.fassung?.objekte[0]?.koId).toBe("KO-B");

    const { dienst: ohneListe } = bestand([beispielKo({ id: "KO-B" })], {}, []);
    const keine = await ohneListe.pruefe(eingabe(["KO-B"]));
    expect(keine.befunde.map((b) => b.code)).toEqual(["RECIPIENTS_NOT_CONFIGURED"]);
    expect("daten" in (await ohneListe.exportiere(eingabe(["KO-B"])))).toBe(false);
  });

  it("die Betreiberliste nimmt nur gültige Kennungen an (im Zweifel kein Empfänger)", () => {
    expect(leseLmsEmpfaenger(undefined)).toEqual([]);
    expect(leseLmsEmpfaenger("")).toEqual([]);
    expect(leseLmsEmpfaenger("moodle-referenz=Moodle Referenz; UNGUELTIG=x;=leer")).toEqual([
      { id: "moodle-referenz", label: "Moodle Referenz" },
    ]);
  });
});
