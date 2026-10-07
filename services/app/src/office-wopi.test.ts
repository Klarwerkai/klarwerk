// ================================================================================================
// OFFICE IM ARTIKEL · DER WOPI-KERN, OHNE NETZ GEPRÜFT.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-machbarkeit`. Geprüft wird die TEILPROBE `office-wopi.ts` — die
// Entscheidungen des Hosts. Kein Editor, kein Microsoft-Konto, keine Route: ob Collabora oder
// Microsoft 365 diese Antworten im Browser so verarbeiten, belegt erst der Bedienlauf aus dem Plan
// (`docs/entscheidungen/office-im-artikel-integrationsweg.md`, Abschnitt 7).
//
//   F1–F3  Word, Excel und PowerPoint werden erkannt; Altformate nur lesend; Widerspruch → keiner.
//   R1–R5  Schreibweg aus den vorhandenen Rechten, wie `revise`/`PROPOSAL_REQUIRED` sie setzen.
//   M1–M7  Zugangsmarke: gebunden an Anhang, signiert, läuft ab, schwacher Schlüssel abgewiesen.
//   C1     CheckFileInfo spiegelt den Schreibweg, kein „Speichern unter" neben dem Artikel.
//   S1–S7  Sperrregeln mit 409 und bestehender Sperre im `X-WOPI-Lock`.
//   P1–P5  PutFile nur mit eigener Sperre und Schreibmarke; Größengrenze = Objektspeicher.
//   U1–U4  Sitzungsbasis: eigene Übernahmen nacheinander ohne Konflikt, fremde Änderung = Konflikt.
//   V1     Versionsrückweg: zwei Speicherungen sind zwei Objekte, das erste bleibt lesbar.
//   D1     Plan und Formattabelle nennen dieselben Formate.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { InMemoryObjectRepo, MAX_OBJECT_BYTES, ObjectStore } from "../../object-store";
import {
  OFFICE_FORMATE,
  type OfficeFormat,
  type OfficeRechte,
  SPERRE_DAUER_MS,
  SPERRE_MAX_LAENGE,
  type Sperre,
  ZUGANGSMARKE_GUELTIG_MS,
  checkFileInfo,
  entscheidePutFile,
  entscheideSitzungsbeginn,
  entscheideUebernahme,
  officeFormatFuer,
  officeSchreibweg,
  passtInObjektspeicher,
  pruefeZugangsmarke,
  stelleZugangsmarkeAus,
  wendeSperreAn,
} from "./office-wopi";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const JETZT = Date.UTC(2026, 9, 7, 12, 0, 0);
const SCHLUESSEL = Buffer.alloc(32, 7);

function format(endung: string): OfficeFormat {
  const f = OFFICE_FORMATE.find((x) => x.endung === endung);
  if (!f) {
    throw new Error(`Format ${endung} fehlt`);
  }
  return f;
}

describe("Formate — Word, Excel, PowerPoint", () => {
  it("F1: docx, xlsx und pptx sind je einer Anwendung zugeordnet und bearbeitbar", () => {
    expect(officeFormatFuer("Anleitung.docx", DOCX)).toMatchObject({
      anwendung: "word",
      bearbeitbar: true,
    });
    expect(officeFormatFuer("Kalkulation.XLSX", XLSX)).toMatchObject({
      anwendung: "excel",
      bearbeitbar: true,
    });
    expect(officeFormatFuer("Schulung.pptx", "application/octet-stream")).toMatchObject({
      anwendung: "powerpoint",
      bearbeitbar: true,
    });
  });

  it("F2: Binärformate bis Office 2003 sind erkannt, aber nur lesend", () => {
    for (const [name, mime] of [
      ["alt.doc", "application/msword"],
      ["alt.xls", "application/vnd.ms-excel"],
      ["alt.ppt", "application/vnd.ms-powerpoint"],
    ] as const) {
      expect(officeFormatFuer(name, mime)?.bearbeitbar).toBe(false);
    }
  });

  it("F3: widersprechender Medientyp, fehlende oder fremde Endung → kein Office-Anhang", () => {
    expect(officeFormatFuer("bericht.docx", "image/png")).toBeUndefined();
    expect(officeFormatFuer("bericht.docx", XLSX)).toBeUndefined();
    expect(officeFormatFuer(".docx", DOCX)).toBeUndefined();
    expect(officeFormatFuer("bericht", DOCX)).toBeUndefined();
    expect(officeFormatFuer("bericht.pdf", "application/pdf")).toBeUndefined();
  });
});

describe("Schreibweg aus vorhandenen Rechten", () => {
  const admin: OfficeRechte = {
    darfLesen: true,
    darfBearbeiten: true,
    darfFreigegebenesAendern: true,
  };
  const experte: OfficeRechte = {
    darfLesen: true,
    darfBearbeiten: true,
    darfFreigegebenesAendern: false,
  };
  const leser: OfficeRechte = {
    darfLesen: true,
    darfBearbeiten: false,
    darfFreigegebenesAendern: false,
  };
  const unsichtbar: OfficeRechte = {
    darfLesen: false,
    darfBearbeiten: true,
    darfFreigegebenesAendern: true,
  };

  it("R1: offener Artikel, Bearbeitungsrecht → direkt", () => {
    expect(officeSchreibweg(experte, { status: "offen" }, format("xlsx"))).toBe("direkt");
  });

  it("R2: freigegebener Artikel ohne Freigaberecht → Vorschlag (Editor nur lesend)", () => {
    expect(officeSchreibweg(experte, { status: "validiert" }, format("docx"))).toBe("vorschlag");
  });

  it("R3: freigegebener Artikel mit Freigaberecht → direkt", () => {
    expect(officeSchreibweg(admin, { status: "validiert" }, format("pptx"))).toBe("direkt");
  });

  it("R4: ohne Bearbeitungsrecht oder bei Altformat → nur lesen", () => {
    expect(officeSchreibweg(leser, { status: "offen" }, format("docx"))).toBe("nur-lesen");
    expect(officeSchreibweg(admin, { status: "offen" }, format("ppt"))).toBe("nur-lesen");
  });

  it("R5: nicht sichtbar → kein Zugang, auch mit allen übrigen Rechten", () => {
    expect(officeSchreibweg(unsichtbar, { status: "offen" }, format("docx"))).toBe("kein-zugang");
  });
});

describe("Zugangsmarke", () => {
  const inhalt = {
    koId: "ko-1",
    anhangId: "anh-1",
    nutzerId: "nutzer-1",
    schreiben: true,
    fassung: 3,
  };

  it("M1: eine ausgestellte Marke ist für ihren Anhang gültig und trägt den Inhalt", () => {
    const { marke, bis } = stelleZugangsmarkeAus(inhalt, SCHLUESSEL, JETZT);
    expect(bis).toBe(JETZT + ZUGANGSMARKE_GUELTIG_MS);
    expect(pruefeZugangsmarke(marke, "anh-1", SCHLUESSEL, JETZT + 1000)).toEqual({
      gueltig: true,
      inhalt: { ...inhalt, bis },
    });
  });

  it("M2: dieselbe Marke öffnet keinen anderen Anhang", () => {
    const { marke } = stelleZugangsmarkeAus(inhalt, SCHLUESSEL, JETZT);
    expect(pruefeZugangsmarke(marke, "anh-2", SCHLUESSEL, JETZT)).toEqual({
      gueltig: false,
      grund: "falsche-datei",
    });
  });

  it("M3: abgelaufen genau am Ablaufzeitpunkt", () => {
    const { marke, bis } = stelleZugangsmarkeAus(inhalt, SCHLUESSEL, JETZT);
    expect(pruefeZugangsmarke(marke, "anh-1", SCHLUESSEL, bis - 1).gueltig).toBe(true);
    expect(pruefeZugangsmarke(marke, "anh-1", SCHLUESSEL, bis)).toEqual({
      gueltig: false,
      grund: "abgelaufen",
    });
  });

  it("M4: veränderte Nutzlast (Leserecht zu Schreibrecht) fällt an der Signatur", () => {
    const { marke } = stelleZugangsmarkeAus({ ...inhalt, schreiben: false }, SCHLUESSEL, JETZT);
    const [nutzlast, sig] = marke.split(".") as [string, string];
    const gelesen = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8"));
    const umgeschrieben = JSON.stringify({ ...gelesen, schreiben: true });
    const gefaelscht = Buffer.from(umgeschrieben).toString("base64url");
    expect(pruefeZugangsmarke(`${gefaelscht}.${sig}`, "anh-1", SCHLUESSEL, JETZT)).toEqual({
      gueltig: false,
      grund: "signatur",
    });
  });

  it("M5: anderer Serverschlüssel → Signatur ungültig", () => {
    const { marke } = stelleZugangsmarkeAus(inhalt, SCHLUESSEL, JETZT);
    expect(pruefeZugangsmarke(marke, "anh-1", Buffer.alloc(32, 8), JETZT).gueltig).toBe(false);
  });

  it("M6: unlesbare Formen werden abgewiesen, ohne zu werfen", () => {
    for (const kaputt of ["", "abc", "a.b.c", ".sig", "nutzlast."]) {
      expect(pruefeZugangsmarke(kaputt, "anh-1", SCHLUESSEL, JETZT).gueltig).toBe(false);
    }
  });

  it("M7: ein Schlüssel unter 32 Byte wird weder zum Ausstellen noch zum Prüfen angenommen", () => {
    expect(() => stelleZugangsmarkeAus(inhalt, Buffer.alloc(31), JETZT)).toThrow(/mindestens 32/);
    expect(() => pruefeZugangsmarke("a.b", "anh-1", Buffer.alloc(16), JETZT)).toThrow();
  });
});

describe("CheckFileInfo", () => {
  it("C1: Schreibweg wird zu UserCanWrite/ReadOnly; Version ändert sich mit dem Objekt", () => {
    const basis = {
      anhang: { name: "Kalkulation.xlsx", objectId: "obj-9", size: 2048 },
      artikel: { author: "autor-1", version: 4 },
      nutzer: { id: "nutzer-1", name: "Testperson Eins" },
    };
    const schreibend = checkFileInfo({ ...basis, schreiben: true });
    expect(schreibend).toMatchObject({
      BaseFileName: "Kalkulation.xlsx",
      Size: 2048,
      Version: "4-obj-9",
      UserCanWrite: true,
      ReadOnly: false,
      SupportsLocks: true,
      SupportsUpdate: true,
      UserCanNotWriteRelative: true,
      SupportsRename: false,
    });
    const lesend = checkFileInfo({ ...basis, schreiben: false });
    expect(lesend).toMatchObject({ UserCanWrite: false, ReadOnly: true, SupportsUpdate: false });
    const neu = checkFileInfo({
      ...basis,
      anhang: { ...basis.anhang, objectId: "obj-10" },
      schreiben: true,
    });
    expect(neu.Version).not.toBe(schreibend.Version);
  });
});

describe("Sperren (WOPI Lock)", () => {
  const gesperrt: Sperre = { kennung: "sitzung-A", bis: JETZT + 60_000 };

  it("S1: freie Datei sperren → 200, Sperre für 30 Minuten", () => {
    expect(wendeSperreAn(undefined, { art: "LOCK", lock: "sitzung-A" }, JETZT)).toEqual({
      status: 200,
      sperre: { kennung: "sitzung-A", bis: JETZT + SPERRE_DAUER_MS },
    });
  });

  it("S2: fremde Sitzung sperrt → 409 mit der bestehenden Sperre", () => {
    expect(wendeSperreAn(gesperrt, { art: "LOCK", lock: "sitzung-B" }, JETZT)).toEqual({
      status: 409,
      sperre: gesperrt,
      xWopiLock: "sitzung-A",
    });
  });

  it("S3: dieselbe Sitzung sperrt erneut oder erneuert → 200 und neuer Ablauf", () => {
    const spaeter = JETZT + 10_000;
    for (const art of ["LOCK", "REFRESH_LOCK"] as const) {
      expect(wendeSperreAn(gesperrt, { art, lock: "sitzung-A" }, spaeter).sperre?.bis).toBe(
        spaeter + SPERRE_DAUER_MS,
      );
    }
  });

  it("S4: Entsperren nur mit eigener Kennung; ohne Sperre → 409 mit leerer Kennung", () => {
    expect(wendeSperreAn(gesperrt, { art: "UNLOCK", lock: "sitzung-A" }, JETZT)).toEqual({
      status: 200,
      sperre: undefined,
    });
    expect(wendeSperreAn(gesperrt, { art: "UNLOCK", lock: "sitzung-B" }, JETZT).status).toBe(409);
    expect(wendeSperreAn(undefined, { art: "UNLOCK", lock: "sitzung-A" }, JETZT)).toEqual({
      status: 409,
      sperre: undefined,
      xWopiLock: "",
    });
  });

  it("S5: abgelaufene Sperre gilt als frei — eine andere Sitzung darf sperren", () => {
    const abgelaufen: Sperre = { kennung: "sitzung-A", bis: JETZT };
    expect(wendeSperreAn(abgelaufen, { art: "LOCK", lock: "sitzung-B" }, JETZT).status).toBe(200);
    expect(wendeSperreAn(abgelaufen, { art: "GET_LOCK" }, JETZT).xWopiLock).toBe("");
  });

  it("S6: Umsperren nur mit passender alter Kennung", () => {
    expect(
      wendeSperreAn(
        gesperrt,
        { art: "UNLOCK_AND_RELOCK", lock: "sitzung-A2", alterLock: "sitzung-A" },
        JETZT,
      ).sperre?.kennung,
    ).toBe("sitzung-A2");
    expect(
      wendeSperreAn(
        gesperrt,
        { art: "UNLOCK_AND_RELOCK", lock: "sitzung-B", alterLock: "sitzung-X" },
        JETZT,
      ),
    ).toMatchObject({ status: 409, xWopiLock: "sitzung-A" });
  });

  it("S7: leere oder zu lange Sperrkennung → 400, Bestand unverändert", () => {
    expect(wendeSperreAn(gesperrt, { art: "LOCK", lock: "" }, JETZT)).toEqual({
      status: 400,
      sperre: gesperrt,
    });
    const zuLang = "x".repeat(SPERRE_MAX_LAENGE + 1);
    expect(wendeSperreAn(undefined, { art: "LOCK", lock: zuLang }, JETZT).status).toBe(400);
    const geradeNoch = "x".repeat(SPERRE_MAX_LAENGE);
    expect(wendeSperreAn(undefined, { art: "LOCK", lock: geradeNoch }, JETZT).status).toBe(200);
  });
});

describe("PutFile", () => {
  const marke = {
    koId: "ko-1",
    anhangId: "anh-1",
    nutzerId: "nutzer-1",
    schreiben: true,
    fassung: 3,
    bis: JETZT + ZUGANGSMARKE_GUELTIG_MS,
  };
  const sperre: Sperre = { kennung: "sitzung-A", bis: JETZT + 60_000 };
  const basis = {
    marke,
    sperre,
    xWopiLock: "sitzung-A",
    groesse: 1000,
    mime: DOCX,
    jetzt: JETZT,
  };

  it("P1: eigene Sperre und Schreibmarke → 200", () => {
    expect(entscheidePutFile(basis)).toEqual({ status: 200 });
  });

  it("P2: Lesemarke → 401, auch mit eigener Sperre", () => {
    expect(entscheidePutFile({ ...basis, marke: { ...marke, schreiben: false } })).toEqual({
      status: 401,
      grund: "nur-lesen",
    });
  });

  it("P3: fremde Sperre → 409 mit der bestehenden Kennung; nichts gespeichert", () => {
    expect(entscheidePutFile({ ...basis, xWopiLock: "sitzung-B" })).toEqual({
      status: 409,
      grund: "fremde-sperre",
      xWopiLock: "sitzung-A",
    });
  });

  it("P4: ohne (oder mit abgelaufener) Sperre → 409 mit leerer Kennung", () => {
    for (const s of [undefined, { kennung: "sitzung-A", bis: JETZT }]) {
      expect(entscheidePutFile({ ...basis, sperre: s })).toEqual({
        status: 409,
        grund: "ohne-sperre",
        xWopiLock: "",
      });
    }
  });

  it("P5: Größengrenze ist die des Objektspeichers — am echten ObjectStore gemessen", async () => {
    // Die größte Datei, die `passtInObjektspeicher` annimmt, und die erste, die sie abweist.
    let groesste = Math.floor(((MAX_OBJECT_BYTES - 100) / 4) * 3);
    while (passtInObjektspeicher(groesste + 1, PPTX)) {
      groesste += 1;
    }
    expect(passtInObjektspeicher(groesste + 1, PPTX)).toBe(false);
    expect(entscheidePutFile({ ...basis, groesse: groesste + 1, mime: PPTX })).toEqual({
      status: 413,
    });

    const store = new ObjectStore({ repo: new InMemoryObjectRepo() });
    const alsDatenUrl = (n: number): string =>
      `data:${PPTX};base64,${Buffer.alloc(n, 1).toString("base64")}`;
    const passt = store.put({ name: "gross.pptx", mime: PPTX, data: alsDatenUrl(groesste) });
    await expect(passt).resolves.toMatchObject({ name: "gross.pptx" });
    // Base64 wächst in Schritten von drei Byte: die nächste Stufe passt nicht mehr.
    const zuGross = alsDatenUrl(groesste + 3);
    const abgewiesen = store.put({ name: "zu-gross.pptx", mime: PPTX, data: zuGross });
    await expect(abgewiesen).rejects.toThrow(/zu groß/);
  });
});

describe("Sitzungsbasis — eigene Übernahme und fremde Änderung getrennt (Nacharbeit 1)", () => {
  it("U1: eine Sitzung beginnt nur auf der aktuellen Fassung", () => {
    expect(entscheideSitzungsbeginn(3, 3)).toEqual({ erlaubt: true, basisFassung: 3 });
    expect(entscheideSitzungsbeginn(3, 4)).toEqual({
      erlaubt: false,
      markenFassung: 3,
      artikelFassung: 4,
    });
  });

  it("U2: zwei eigene Übernahmen nacheinander — die zweite prüft gegen die nachgezogene Basis", () => {
    // Die Marke trägt weiterhin Fassung 3; geprüft wird gegen die Basis der Sitzung.
    const erste = entscheideUebernahme({
      basisFassung: 3,
      artikelFassung: 3,
      hatArbeitsstand: true,
    });
    expect(erste).toEqual({ art: "uebernehmen", expectedVersion: 3 });
    // Nach der ersten Übernahme steht der Artikel auf 4, und der Host hat die Basis auf 4 gezogen.
    const zweite = entscheideUebernahme({
      basisFassung: 4,
      artikelFassung: 4,
      hatArbeitsstand: true,
    });
    expect(zweite).toEqual({ art: "uebernehmen", expectedVersion: 4 });
  });

  it("U3: eine fremde Änderung außerhalb der Sitzung ist ein Konflikt, keine neue Basis", () => {
    const fremd = entscheideUebernahme({
      basisFassung: 4,
      artikelFassung: 5,
      hatArbeitsstand: true,
    });
    expect(fremd).toEqual({ art: "fremde-aenderung", basisFassung: 4, artikelFassung: 5 });
  });

  it("U4: ohne Sitzung oder ohne gespeicherten Arbeitsstand wird nichts übernommen", () => {
    const ohneSitzung = entscheideUebernahme({
      basisFassung: undefined,
      artikelFassung: 4,
      hatArbeitsstand: true,
    });
    expect(ohneSitzung).toEqual({ art: "ohne-sitzung" });
    const ohneStand = entscheideUebernahme({
      basisFassung: 4,
      artikelFassung: 4,
      hatArbeitsstand: false,
    });
    expect(ohneStand).toEqual({ art: "ohne-arbeitsstand" });
  });
});

describe("Versionsrückweg im Objektspeicher", () => {
  it("V1: zwei Speicherungen sind zwei Objekte; das erste bleibt unverändert lesbar", async () => {
    const store = new ObjectStore({ repo: new InMemoryObjectRepo() });
    const fassung1 = `data:${DOCX};base64,${Buffer.from("Fassung eins").toString("base64")}`;
    const fassung2 = `data:${DOCX};base64,${Buffer.from("Fassung zwei").toString("base64")}`;
    const a = await store.put({ name: "Anleitung.docx", mime: DOCX, data: fassung1 });
    const b = await store.put({ name: "Anleitung.docx", mime: DOCX, data: fassung2 });
    expect(a.id).not.toBe(b.id);
    expect((await store.read(a.id))?.data).toBe(fassung1);
    expect((await store.read(b.id))?.data).toBe(fassung2);
  });
});

describe("Plan und Code nennen dieselben Formate", () => {
  it("D1: jede Endung der Formattabelle steht im Plan, mit ihrem Bearbeitungsstand", () => {
    const pfad = "../../../docs/entscheidungen/office-im-artikel-integrationsweg.md";
    const plan = readFileSync(fileURLToPath(new URL(pfad, import.meta.url)), "utf8");
    for (const f of OFFICE_FORMATE) {
      const zeile = plan.split("\n").find((z) => z.startsWith(`| \`.${f.endung}\``));
      expect(zeile, `Planzeile für .${f.endung}`).toBeDefined();
      expect(zeile).toContain(f.bearbeitbar ? "bearbeiten" : "nur lesen");
    }
  });
});
