// ================================================================================================
// produkt:20261010:assistenz-name-avatar · DIE DREIZEHN MOTIVE: KATALOG, KENNUNGEN, ORIGINAL.
// ================================================================================================
//
//   M1  Server und Oberfläche führen dieselben dreizehn stabilen Kennungen in derselben Ordnung.
//   M2  Genau die freigegebenen Motive; keine Porträts oder Büsten; zwei Gruppen, Original vorn.
//   M3  „Original" ist DIESELBE Datei wie die bisherige Figur (keine zweite Kopie), Adresse relativ.
//   M4  Jedes Motiv hat einen verständlichen Namen in DE, EN und NL; neutrale Bezeichnung ohne
//       „Klara"; die Texte der beweglichen Assistenz nennen keinen festen Produktnamen mehr.
//   M5  Namensprüfung im Browser = Namensprüfung am Server (keine Sperrliste).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KLARA_AVATAR_DATEI,
  klaraAvatarUrl,
} from "../../apps/web/src/components/klara-vorschau/avatar";
import i18n from "../../apps/web/src/i18n";
import {
  ASSISTENZ_AVATAR_KATALOG,
  AVATAR_GRUPPEN,
  STANDARD_AVATAR,
  avatarMotiv,
} from "../../apps/web/src/lib/assistenzAvatare";
import { pruefeName } from "../../apps/web/src/lib/assistenzName";
import {
  ASSISTENZ_AVATARE,
  AssistenzProfilFehler,
  pruefeAssistenzName,
} from "../../services/app/src/assistenz-profil";
import { repoPfad } from "../support/repoPfad";

const FREIGEGEBEN = [
  "original",
  "lichtwesen",
  "roboter",
  "eule",
  "fuchs",
  "pinguin",
  "wolke",
  "kompass",
  "prisma",
  "wissensbuch",
  "verbindungsknoten",
  "monolith",
  "leuchtkreis",
];

describe("M1 · dieselben dreizehn Kennungen am Server und in der Oberfläche", () => {
  it("Server-Liste und Oberflächenkatalog sind gleich, in derselben Ordnung", () => {
    expect([...ASSISTENZ_AVATARE]).toEqual(FREIGEGEBEN);
    expect(ASSISTENZ_AVATAR_KATALOG.map((m) => m.id)).toEqual(FREIGEGEBEN);
    expect(new Set(FREIGEGEBEN).size).toBe(13);
  });
});

describe("M2 · nur die freigegebenen Motive, gruppiert, Original leicht auffindbar", () => {
  it("keine Porträts oder menschlichen Büsten unter den Kennungen und Dateien", () => {
    for (const m of ASSISTENZ_AVATAR_KATALOG) {
      expect(`${m.id} ${m.datei}`).not.toMatch(/portr|buest|büst|person|mensch|gesicht|frau|mann/i);
    }
  });

  it("zwei Gruppen — ausdrucksstark (mit dem Original zuerst) und sachlich", () => {
    expect(AVATAR_GRUPPEN).toEqual(["ausdrucksstark", "sachlich"]);
    const gruppe = (g: string) => ASSISTENZ_AVATAR_KATALOG.filter((m) => m.gruppe === g);
    expect(gruppe("ausdrucksstark").map((m) => m.id)).toEqual([
      "original",
      "lichtwesen",
      "roboter",
      "eule",
      "fuchs",
      "pinguin",
      "wolke",
    ]);
    expect(gruppe("sachlich").map((m) => m.id)).toEqual([
      "kompass",
      "prisma",
      "wissensbuch",
      "verbindungsknoten",
      "monolith",
      "leuchtkreis",
    ]);
    expect(STANDARD_AVATAR).toBe("original");
    expect(avatarMotiv("nicht-mehr-angeboten")).toBeNull();
  });
});

describe("M3 · das Original ist die vorhandene Figur — keine zweite Kopie, relative Adresse", () => {
  it("dieselbe Datei wie bisher; alle Motive liegen im Bau unter einer relativen Adresse", () => {
    expect(avatarMotiv("original")?.datei).toBe(KLARA_AVATAR_DATEI);
    expect(klaraAvatarUrl()).toBe("/klara/klara-avatar-v1.png");
    for (const m of ASSISTENZ_AVATAR_KATALOG.filter((x) => x.id !== "original")) {
      expect(m.datei).toBe(`assistenz/erstauswahl-v1/${m.id}.png`);
      expect(klaraAvatarUrl(m.datei)).toBe(`/assistenz/erstauswahl-v1/${m.id}.png`);
    }
    // Kein Quelltext der Auswahl verweist auf einen fremden Bilddienst oder einen lokalen Pfad.
    for (const q of [
      "apps/web/src/lib/assistenzAvatare.ts",
      "apps/web/src/components/assistenz/AvatarBild.tsx",
      "apps/web/src/components/assistenz/AvatarAuswahl.tsx",
    ]) {
      expect(readFileSync(repoPfad(q), "utf8"), q).not.toMatch(/https?:\/\/|\/Users\/|file:\/\//);
    }
  });
});

describe("M4 · verständliche Namen in allen Sprachen, neutral ohne festen Produktnamen", () => {
  it("jedes Motiv trägt in DE, EN und NL einen Namen; neutral heisst es „Assistenz“", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      const t = i18n.getFixedT(sprache);
      for (const id of FREIGEGEBEN) {
        const name = t(`assistenz.avatar.name.${id}`);
        expect(name, `${sprache}/${id}`).not.toBe(`assistenz.avatar.name.${id}`);
        expect(name.length).toBeGreaterThan(1);
      }
      expect(t("assistenz.neutral.name")).not.toMatch(/klara/i);
      expect(t("assistenz.neutral.titel")).not.toMatch(/klara/i);
    }
    const de = i18n.getFixedT("de");
    expect(de("assistenz.neutral.name")).toBe("Assistenz");
    expect(de("assistenz.neutral.titel")).toBe("Deine Assistenz");
    expect(de("assistenz.einrichtung.frage")).toBe("Wie soll deine Assistenz heißen?");
  });

  it("die Texte der beweglichen Assistenz nennen keinen festen Namen — der Name kommt als Wert", () => {
    for (const modul of ["klaravorschau", "klaragespraech", "klarasprache", "klarakontext"]) {
      const quelle = readFileSync(repoPfad(`apps/web/src/texte/${modul}.ts`), "utf8");
      // Nur die Werte zählen, nicht die Kommentare und Schlüssel.
      const werte = [...quelle.matchAll(/^\s+(?:"[^"]+":\s*)?"(.*)",?$/gm)].map((m) => m[1] ?? "");
      const mitName = werte.filter((w) => /\bKlara(?!werk)/.test(w));
      expect(mitName, modul).toEqual([]);
    }
    const t = i18n.getFixedT("de");
    expect(t("klaravorschau.figur.label", { assistenz: "Mia" })).toBe(
      "Mia – Gespräch öffnen oder schließen",
    );
    expect(t("klaravorschau.panel.titel", { assistenzTitel: "Deine Assistenz" })).toBe(
      "Deine Assistenz",
    );
  });
});

describe("M5 · eine Regel für den Namen — im Browser wie am Server, ohne Sperrliste", () => {
  it.each([
    ["Mia", null],
    ["Klara", null],
    ["Siri", null],
    ["<b>Fett</b>", null],
    ["", "nameLeer"],
    ["   ", "nameLeer"],
    ["x".repeat(41), "nameLang"],
    ["Mia\nAdmin", "nameZeile"],
    ["Tab\tName", "nameZeile"],
  ] as const)("„%s“ → %s", (name, erwartet) => {
    expect(pruefeName(name)).toBe(erwartet);
    if (erwartet === null) {
      expect(pruefeAssistenzName(name)).toBe(name.trim());
    } else {
      expect(() => pruefeAssistenzName(name)).toThrow(AssistenzProfilFehler);
    }
  });
});
