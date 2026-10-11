// ================================================================================================
// Aufnahme gesamt-sprachassistent · R-0104 — DIE DOM-FREIE HÄLFTE DES AUFNAHMEWEGS.
// ================================================================================================
//
// `apps/web/src/lib/sprachaufnahme.ts` baut aus einer fertigen Aufnahme den Rumpf für
// `POST /api/media/transcribe` und deutet die Antwort. Gemessen wird, WAS hinausgeht (Data-URL ohne
// Codec-Parameter, Sprache, Stufe nur wenn gewählt) und dass ohne Transkript nichts erfunden wird.
import { describe, expect, it } from "vitest";
import {
  AUFNAHME_FORMATE,
  type AufnahmeRumpf,
  aufnahmeDataUrl,
  aufnahmeMoeglich,
  aufnahmeSprache,
  base64AusDataUrl,
  basisMime,
  verschrifteAufnahme,
  verschriftungAus,
  waehleAufnahmeFormat,
} from "../../apps/web/src/lib/sprachaufnahme";
import { decodeDataUrl } from "../../services/object-store/src/service";

describe("R-0104 · Format und Data-URL", () => {
  it("A1 · das erste unterstützte Format gewinnt; ein Wurf zählt als „nicht unterstützt“", () => {
    expect(waehleAufnahmeFormat((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(waehleAufnahmeFormat(() => true)).toBe(AUFNAHME_FORMATE[0]);
    expect(waehleAufnahmeFormat(() => false)).toBeNull();
    expect(
      waehleAufnahmeFormat((m) => {
        if (m.includes("webm")) {
          throw new Error("kaputt");
        }
        return m === "audio/ogg";
      }),
    ).toBe("audio/ogg");
  });

  it("A2 · Codec-Parameter fallen weg — sonst liest der Server die Data-URL nicht", () => {
    expect(basisMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(basisMime(" Audio/MP4 ")).toBe("audio/mp4");
    const url = aufnahmeDataUrl("audio/webm;codecs=opus", "dG9u");
    expect(url).toBe("data:audio/webm;base64,dG9u");
    // GEGENPROBE AM ECHTEN LESER DES SERVERS: mit Parameter wäre die Aufnahme unlesbar.
    expect(decodeDataUrl(url)?.mime).toBe("audio/webm");
    expect(decodeDataUrl("data:audio/webm;codecs=opus;base64,dG9u")).toBeNull();
    expect(aufnahmeDataUrl("", "dG9u")).toBe("data:audio/webm;base64,dG9u");
    expect(base64AusDataUrl("data:audio/webm;codecs=opus;base64,dG9u")).toBe("dG9u");
    expect(base64AusDataUrl("kaputt")).toBe("");
  });

  it("A3 · der Server kennt de und en; alles andere wird deutsch verschriftlicht", () => {
    expect(aufnahmeSprache("en-GB")).toBe("en");
    expect(aufnahmeSprache("de-CH")).toBe("de");
    expect(aufnahmeSprache("nl")).toBe("de");
  });

  it("A4 · aufnehmen kann nur, wer Rekorder UND Mikrofonzugang hat", () => {
    const rekorder = class MediaRecorder {};
    const zugang = { mediaDevices: { getUserMedia: () => undefined } };
    expect(aufnahmeMoeglich({ MediaRecorder: rekorder, navigator: zugang })).toBe(true);
    expect(aufnahmeMoeglich({ MediaRecorder: rekorder, navigator: {} })).toBe(false);
    expect(aufnahmeMoeglich({ navigator: zugang })).toBe(false);
    expect(aufnahmeMoeglich(null)).toBe(false);
  });
});

describe("R-0104 · was hinausgeht und was zurückkommt", () => {
  it("V1 · gesendet wird die Data-URL samt Sprache — die Stufe nur, wenn sie gewählt ist", async () => {
    const gesendet: AufnahmeRumpf[] = [];
    const senden = async (rumpf: AufnahmeRumpf) => {
      gesendet.push(rumpf);
      return {
        transcript: "  Ventil  V3\nentlüften ",
        engineActive: true,
        engine: "e",
        note: "n",
      };
    };
    const mitStufe = await verschrifteAufnahme(
      {
        mime: "audio/webm;codecs=opus",
        base64: "dG9u",
        sprache: "de",
        vertraulichkeit: "intern",
      },
      senden,
    );
    expect(mitStufe).toEqual({ art: "text", text: "Ventil V3 entlüften", engine: "e" });
    expect(gesendet[0]).toEqual({
      data: "data:audio/webm;base64,dG9u",
      locale: "de",
      confidentiality: "intern",
    });
    await verschrifteAufnahme({ mime: "audio/mp4", base64: "dG9u", sprache: "en" }, senden);
    expect(Object.hasOwn(gesendet[1] as object, "confidentiality")).toBe(false);
    expect(gesendet[1]?.locale).toBe("en");
  });

  it("V2 · eine leere Aufnahme geht gar nicht erst hinaus", async () => {
    let aufrufe = 0;
    const ergebnis = await verschrifteAufnahme(
      { mime: "audio/webm", base64: "", sprache: "de" },
      async () => {
        aufrufe += 1;
        return { transcript: "x", engineActive: true, engine: null, note: "" };
      },
    );
    expect(ergebnis).toBeNull();
    expect(aufrufe).toBe(0);
  });

  it("V3 · ohne Transkript kein Text, sondern der Satz des Servers — erfunden wird nichts", () => {
    const note = "Die öffentliche KI ist vom Administrator nicht freigegeben.";
    expect(verschriftungAus({ transcript: null, engineActive: false, engine: "e", note })).toEqual({
      art: "hinweis",
      note,
    });
    // Auch ein leeres Transkript eines aktiven Dienstes ist kein Text.
    expect(verschriftungAus({ transcript: "  ", engineActive: true, engine: "e", note })).toEqual({
      art: "hinweis",
      note,
    });
  });
});
