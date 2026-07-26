import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  SOURCE_ATTACH_HINT_KEYS,
  canAttachExternalResult,
  canSearchExternal,
  sourceAttachHint,
} from "../../apps/web/src/lib/externalAttachGate";
import { classifySourceReach } from "../../services/external-search";

// AUFTRAG-mega16 Block A (bens SB-4) — DIE OBERFLÄCHEN-HÄLFTE DES VERTRAGS.
//
// Die Auflage: „Die Oberfläche muss den Nutzer VORHER wissen lassen, dass auf dieser Stufe keine
// Web-Quelle angehängt werden kann, mit sichtbarem Grund und dem Weg zur Änderung — nicht erst
// nach dem Absenden." Ein Formular, das erst als 403 antwortet, ist keine Erklärung.
//
// Die Entscheidung selbst bleibt beim SERVER (attach-policy.ts). Diese Datei belegt nur, dass die
// Oberfläche ihm nicht widerspricht und dass sie nichts behauptet, was sie nicht wissen kann.

const LANGS = ["de", "en", "nl"] as const;

describe("mega16 Block A: der Hinweis steht VOR dem Absenden", () => {
  it("auf den offenen Stufen gibt es keinen Hinweis — dort ist alles erlaubt", () => {
    for (const stage of ["search_attach", "open"] as const) {
      expect(sourceAttachHint(stage, "https://de.wikipedia.org/wiki/X")).toBeNull();
      expect(sourceAttachHint(stage, "")).toBeNull();
    }
  });

  it("solange die Stufe nicht geladen ist, wird nichts behauptet", () => {
    // Kein Wissen ist kein Grund für eine Warnung — sonst blinkt bei jedem Seitenaufbau eine
    // Meldung auf, die sich gleich darauf selbst zurücknimmt.
    for (const url of ["", "https://x.example/a", "Unsinn"]) {
      expect(sourceAttachHint(null, url)).toBeNull();
      expect(sourceAttachHint(undefined, url)).toBeNull();
    }
  });

  it("restriktive Stufe + öffentliche Adresse → der Grund nennt die Web-Adresse", () => {
    for (const stage of ["blocked", "search_on_click"] as const) {
      for (const url of [
        "https://de.wikipedia.org/wiki/X",
        "https://wikiwand.com/de/X",
        "http://irgendwas.example/a",
        // Auch eine INTERNE Adresse bekommt diesen Hinweis: ob der Betreiber sie eingetragen
        // hat, weiß nur der Server. Die Oberfläche nennt deshalb die REGEL, nicht ein Urteil
        // über genau diesen Host — und sie täuscht keine Kenntnis vor, die sie nicht hat.
        "https://confluence.werk.local/x",
      ]) {
        expect(sourceAttachHint(stage, url), `${stage} ${url}`).toBe("public-url");
      }
    }
  });

  it("restriktive Stufe + keine Adresse und kein Anker → der Grund nennt den fehlenden Beleg", () => {
    for (const stage of ["blocked", "search_on_click"] as const) {
      for (const url of ["", "   ", "kein-url", "/relativ/x", "javascript:alert(1)"]) {
        expect(sourceAttachHint(stage, url), `${stage} ${url}`).toBe("unanchored");
      }
    }
  });

  it("restriktive Stufe + keine Adresse, ABER ein Anker → kein Hinweis", () => {
    for (const stage of ["blocked", "search_on_click"] as const) {
      expect(sourceAttachHint(stage, "", true)).toBeNull();
      expect(sourceAttachHint(stage, "kein-url", true)).toBeNull();
      // Der Anker hilft NUR der adresslosen Quelle. Eine öffentliche Adresse bleibt gesperrt —
      // sonst wäre ein hochgeladenes Dokument der Generalschlüssel für jeden Weblink.
      expect(sourceAttachHint(stage, "https://de.wikipedia.org/X", true)).toBe("public-url");
    }
  });

  // DIE ENTSCHEIDENDE ZUSICHERUNG: die Oberfläche darf dem Server nicht widersprechen. Wo sie
  // schweigt, muss der Server durchlassen; wo sie warnt, muss er (mindestens ohne Anker) sperren.
  it("die Oberfläche widerspricht dem Server nicht — dieselbe Einstufung, dieselbe Grenze", () => {
    const KEINE_ALLOWLIST: string[] = [];
    for (const url of [
      "",
      "   ",
      "kein-url",
      "/relativ/x",
      "//host/x",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "https://de.wikipedia.org/wiki/X",
      "http://10.0.0.5/x",
      "https://x.example:8443/a",
    ]) {
      const serverReach = classifySourceReach(url, KEINE_ALLOWLIST);
      const hint = sourceAttachHint("search_on_click", url);
      expect(hint, url).toBe(serverReach === "public" ? "public-url" : "unanchored");
    }
  });

  it("Suchen und Anhängen bleiben getrennt — die Stufe search_on_click ist genau diese Trennung", () => {
    expect(canSearchExternal("search_on_click")).toBe(true);
    expect(canAttachExternalResult("search_on_click")).toBe(false);
    expect(canSearchExternal("blocked")).toBe(false);
  });
});

describe("mega16 Block A: der Grund ist in DE/EN/NL da und nennt den Weg zur Änderung", () => {
  it("jeder Hinweis hat in jeder Sprache einen echten Text", () => {
    for (const lang of LANGS) {
      const bundle = i18n.getResourceBundle(lang, "translation") as Record<string, string>;
      for (const keys of Object.values(SOURCE_ATTACH_HINT_KEYS)) {
        for (const key of [keys.body, keys.how]) {
          const text = bundle[key];
          expect(text, `${lang}: ${key} fehlt`).toBeTruthy();
          // Kein Platzhalter, kein zurückgefallener Schlüsselname.
          expect(text, `${lang}: ${key}`).not.toBe(key);
          expect(String(text).length, `${lang}: ${key} zu kurz`).toBeGreaterThan(40);
        }
      }
    }
  });

  it("der Weg zur Änderung steht wirklich drin — Verwaltung → Externes Wissen", () => {
    const WEG: Record<(typeof LANGS)[number], string> = {
      de: "Verwaltung",
      en: "Administration",
      nl: "Beheer",
    };
    for (const lang of LANGS) {
      const bundle = i18n.getResourceBundle(lang, "translation") as Record<string, string>;
      expect(String(bundle["ext.gate.how"]), lang).toContain(WEG[lang]);
    }
  });
});
