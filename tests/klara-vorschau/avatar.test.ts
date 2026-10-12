// ================================================================================================
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau) · K1 — der freigegebene Avatar liegt IM BAU.
// ================================================================================================
//
// Der Auftrag nennt die Datei mit Prüfsumme und verlangt, dass die Vorschau sie unabhängig vom
// lokalen Ursprungsordner lädt. Geprüft wird deshalb dreierlei:
//   1. die Datei liegt unter `apps/web/public/klara/` — Vite legt sie unverändert ins Bündel;
//   2. ihre SHA-256 ist genau die freigegebene (ein anderes Bild wäre ein anderes Maskottchen);
//   3. kein Quelltext der Vorschau verweist auf einen lokalen absoluten Pfad oder `file://`.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KLARA_AVATAR_DATEI,
  KLARA_AVATAR_SHA256,
  klaraAvatarUrl,
} from "../../apps/web/src/components/klara-vorschau/avatar";
import { repoPfad } from "../support/repoPfad";

const FREIGEGEBEN = "c2327f5bf84dc67706d1f4f11dc471671c78f3183f729a0c2b1b52303ab2f87b";

describe("K1 · Klara-Avatar im Bau", () => {
  it("die Datei liegt im Bauverzeichnis und trägt die freigegebene Prüfsumme", () => {
    expect(KLARA_AVATAR_SHA256).toBe(FREIGEGEBEN);
    const datei = repoPfad(`apps/web/public/${KLARA_AVATAR_DATEI}`);
    expect(existsSync(datei), `${datei} fehlt — der Avatar ist nicht im Bau`).toBe(true);
    const summe = createHash("sha256").update(readFileSync(datei)).digest("hex");
    expect(summe).toBe(FREIGEGEBEN);
  });

  it("das Produkt lädt ihn über eine relative Produktadresse", () => {
    expect(klaraAvatarUrl()).toBe("/klara/klara-avatar-v1.png");
  });

  it("kein Quelltext der Vorschau verweist auf einen lokalen absoluten Pfad", () => {
    const quellen = [
      ...readdirSync(repoPfad("apps/web/src/components/klara-vorschau")).map((n) =>
        join("apps/web/src/components/klara-vorschau", n),
      ),
      "apps/web/src/pages/KlaraVorschau.tsx",
    ];
    for (const q of quellen) {
      const text = readFileSync(repoPfad(q), "utf8");
      expect(text, q).not.toMatch(/\/Users\/|file:\/\/|[A-Z]:\\\\/);
    }
  });
});
