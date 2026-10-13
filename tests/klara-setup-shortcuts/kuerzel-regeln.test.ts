// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-03/AA-04) · DIE REGELN DER KLARA-KÜRZEL.
// ================================================================================================
//
// Die reinen Regeln aus `apps/web/src/lib/klaraTastenkuerzel.ts`, ohne Browser:
//
//   R1  Aufnahme: die gedrückte Kombination wird mit physischer Taste und allen vier Modifikatoren
//       erfasst; reine Zusatztasten sind noch keine Kombination; nicht unterstützte Tasten werden
//       benannt. Deutsches und englisches Layout: erkannt wird die physische Taste, beschriftet das
//       gedrückte Zeichen (K3/K6).
//   R2  Abgleich: ein Ereignis passt nur bei GENAU denselben Modifikatoren (K11/K12).
//   R3  Konflikte mit konkretem Grund: ohne ⌘/Strg (Schreiben), ⌃⌥ (VoiceOver/AltGr), ⌘K/Strg+K
//       (Befehlspalette — auch der Kandidat Control+Command+K), einfache Bearbeitungs-/Browserkürzel,
//       bekannte Browser- und macOS-Befehle, Doppelbelegung (K14, K15).
//   R4  Anzeige: Mac-Symbole in Apple-Reihenfolge, sonst ausgeschrieben; Wortform für Screenreader.
import { describe, expect, it } from "vitest";
import {
  type KuerzelEintrag,
  type KuerzelKombination,
  type TastenEreignis,
  aktionFuer,
  aufnahmeAus,
  kuerzelWorte,
  kuerzelZeichen,
  passt,
  pruefeBelegung,
} from "../../apps/web/src/lib/klaraTastenkuerzel";

function ereignis(teil: Partial<TastenEreignis> & { code: string; key: string }): TastenEreignis {
  return { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...teil };
}

function kombi(teil: Partial<KuerzelKombination> & { code: string }): KuerzelKombination {
  return {
    taste: teil.code.replace(/^Key|^Digit/, ""),
    strg: false,
    alt: false,
    umschalt: false,
    meta: false,
    ...teil,
  };
}

const LEER: KuerzelEintrag[] = [];

describe("R1 · Aufnahme der tatsächlich gedrückten Kombination", () => {
  it("erfasst Taste und alle vier Modifikatoren", () => {
    const a = aufnahmeAus(
      ereignis({ code: "KeyE", key: "E", ctrlKey: true, shiftKey: true, metaKey: false }),
    );
    expect(a).toEqual({
      art: "kombination",
      kombination: {
        code: "KeyE",
        taste: "E",
        strg: true,
        alt: false,
        umschalt: true,
        meta: false,
      },
    });
  });

  it("reine Zusatztasten sind noch keine Kombination", () => {
    for (const [code, key] of [
      ["ShiftLeft", "Shift"],
      ["ControlRight", "Control"],
      ["AltLeft", "Alt"],
      ["MetaLeft", "Meta"],
    ] as const) {
      expect(aufnahmeAus(ereignis({ code, key, shiftKey: true })).art).toBe("nurModifikator");
    }
  });

  it("Enter, Leertaste, Pfeile und Tab sind keine unterstützten Tasten", () => {
    for (const [code, key] of [
      ["Enter", "Enter"],
      ["Space", " "],
      ["ArrowLeft", "ArrowLeft"],
      ["Tab", "Tab"],
    ] as const) {
      expect(aufnahmeAus(ereignis({ code, key, metaKey: true })).art).toBe("taste");
    }
  });

  it("deutsches Layout: physische Taste KeyZ, beschriftet „Y“; englisches: „Z“", () => {
    const de = aufnahmeAus(ereignis({ code: "KeyZ", key: "y", ctrlKey: true, shiftKey: true }));
    const en = aufnahmeAus(ereignis({ code: "KeyZ", key: "Z", ctrlKey: true, shiftKey: true }));
    expect(de.art === "kombination" && de.kombination).toMatchObject({ code: "KeyZ", taste: "Y" });
    expect(en.art === "kombination" && en.kombination).toMatchObject({ code: "KeyZ", taste: "Z" });
  });

  it("Option/Alt erzeugt auf dem Mac Sonderzeichen — beschriftet wird die Taste", () => {
    const a = aufnahmeAus(ereignis({ code: "KeyE", key: "€", altKey: true, metaKey: true }));
    expect(a.art === "kombination" && a.kombination.taste).toBe("E");
  });
});

describe("R2 · ein Ereignis passt nur auf genau dieselbe Kombination", () => {
  const k = kombi({ code: "KeyE", strg: true, umschalt: true });
  const eintraege: KuerzelEintrag[] = [
    { aktion: "oeffnen", belegung: k, quelle: "eigen" },
    { aktion: "diktieren", belegung: null, quelle: "entfernt" },
  ];

  it("genau gleich → die zugeordnete Aktion", () => {
    const e = ereignis({ code: "KeyE", key: "E", ctrlKey: true, shiftKey: true });
    expect(passt(e, k)).toBe(true);
    expect(aktionFuer(e, eintraege)).toBe("oeffnen");
  });

  it("ein Modifikator mehr oder weniger → keine Aktion", () => {
    for (const e of [
      ereignis({ code: "KeyE", key: "E", ctrlKey: true }),
      ereignis({ code: "KeyE", key: "E", ctrlKey: true, shiftKey: true, altKey: true }),
      ereignis({ code: "KeyE", key: "E", ctrlKey: true, shiftKey: true, metaKey: true }),
      ereignis({ code: "KeyE", key: "e" }),
    ]) {
      expect(aktionFuer(e, eintraege)).toBeNull();
    }
  });

  it("eine entfernte Belegung löst nichts aus", () => {
    expect(aktionFuer(ereignis({ code: "KeyD", key: "d" }), eintraege)).toBeNull();
  });
});

describe("R3 · Konflikte mit konkretem Grund", () => {
  const grund = (k: KuerzelKombination, eintraege: KuerzelEintrag[] = LEER) =>
    pruefeBelegung(k, "oeffnen", eintraege)?.grund ?? null;

  it("ohne Befehlstaste oder Strg wäre es normales Schreiben", () => {
    expect(grund(kombi({ code: "KeyE" }))).toBe("ohneModifikator");
    expect(grund(kombi({ code: "KeyE", umschalt: true }))).toBe("ohneModifikator");
    expect(grund(kombi({ code: "KeyE", alt: true }))).toBe("ohneModifikator");
  });

  it("Control + Option ist VoiceOver (Mac) bzw. AltGr (Windows) — auch mit Befehlstaste", () => {
    expect(grund(kombi({ code: "KeyE", strg: true, alt: true }))).toBe("voiceover");
    expect(grund(kombi({ code: "KeyE", strg: true, alt: true, meta: true }))).toBe("voiceover");
  });

  it("jede ⌘/Strg-Kombination mit K öffnet die Befehlspalette — auch Control+Command+K", () => {
    expect(grund(kombi({ code: "KeyK", strg: true, meta: true }))).toBe("palette");
    expect(grund(kombi({ code: "KeyK", meta: true, umschalt: true }))).toBe("palette");
    expect(grund(kombi({ code: "KeyK", strg: true, umschalt: true }))).toBe("palette");
  });

  it("⌘/Strg mit nur einer Taste ist Bearbeiten oder Browser (Kopieren, Fett, neuer Tab …)", () => {
    for (const code of ["KeyC", "KeyV", "KeyB", "KeyT", "KeyE", "Digit1"]) {
      expect(grund(kombi({ code, meta: true })), code).toBe("einfach");
      expect(grund(kombi({ code, strg: true })), code).toBe("einfach");
    }
  });

  it("bekannte Browser- und macOS-Befehle", () => {
    expect(grund(kombi({ code: "KeyT", meta: true, umschalt: true }))).toBe("browser");
    expect(grund(kombi({ code: "KeyN", strg: true, umschalt: true }))).toBe("browser");
    expect(grund(kombi({ code: "Digit4", meta: true, umschalt: true }))).toBe("macos");
    expect(grund(kombi({ code: "KeyQ", strg: true, meta: true }))).toBe("macos");
    expect(grund(kombi({ code: "KeyF", strg: true, meta: true }))).toBe("macos");
    expect(grund(kombi({ code: "KeyH", meta: true, alt: true }))).toBe("macos");
    expect(grund(kombi({ code: "F5", meta: true, umschalt: true }))).toBe("browser");
  });

  it("Redo auf deutschem Layout (physisch KeyY, beschriftet Z) wird erkannt", () => {
    expect(grund(kombi({ code: "KeyY", taste: "Z", meta: true, umschalt: true }))).toBe("browser");
  });

  it("dieselbe Kombination für eine andere Aktion ist eine Doppelbelegung", () => {
    const k = kombi({ code: "KeyE", strg: true, umschalt: true });
    const eintraege: KuerzelEintrag[] = [{ aktion: "diktieren", belegung: k, quelle: "eigen" }];
    expect(pruefeBelegung(k, "oeffnen", eintraege)).toEqual({
      grund: "doppelt",
      belegtVon: "diktieren",
    });
    // Für dieselbe Aktion ist sie keine Doppelbelegung.
    expect(pruefeBelegung(k, "diktieren", eintraege)).toBeNull();
  });

  it("freie Kombinationen im unterstützten Rahmen sind zulässig", () => {
    for (const k of [
      kombi({ code: "KeyE", strg: true, umschalt: true }),
      kombi({ code: "KeyU", meta: true, umschalt: true }),
      kombi({ code: "KeyE", strg: true, meta: true }),
      kombi({ code: "Digit8", meta: true, alt: true }),
      kombi({ code: "F7", strg: true, umschalt: true }),
    ]) {
      expect(grund(k), JSON.stringify(k)).toBeNull();
    }
  });
});

describe("R4 · Anzeige mit Mac-Symbolen und ausgeschrieben", () => {
  const k = kombi({ code: "KeyZ", taste: "Y", strg: true, umschalt: true, meta: true });
  const namen = { strg: "Control", alt: "Option", umschalt: "Umschalt", meta: "Befehl" };

  it("Apple: ⌃ ⌥ ⇧ ⌘ in Apple-Reihenfolge, dann die gedrückte Taste", () => {
    expect(kuerzelZeichen(k, "apple", "de")).toBe("⌃⇧⌘Y");
    expect(kuerzelZeichen(kombi({ code: "KeyE", alt: true, meta: true }), "apple", "en")).toBe(
      "⌥⌘E",
    );
  });

  it("andere Systeme: ausgeschrieben in der Sprache der Oberfläche", () => {
    const strg = kombi({ code: "KeyE", strg: true, umschalt: true });
    expect(kuerzelZeichen(strg, "andere", "de")).toBe("Strg+Umschalt+E");
    expect(kuerzelZeichen(strg, "andere", "en")).toBe("Ctrl+Shift+E");
  });

  it("die Wortform für Screenreader und Tooltip", () => {
    expect(kuerzelWorte(k, "apple", namen)).toBe("Control Umschalt Befehl Y");
    expect(
      kuerzelWorte(kombi({ code: "KeyE", strg: true, umschalt: true }), "andere", {
        strg: "Strg",
        alt: "Alt",
        umschalt: "Umschalt",
        meta: "Windows",
      }),
    ).toBe("Strg + Umschalt + E");
  });
});
