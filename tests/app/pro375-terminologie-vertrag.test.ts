import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AUFTRAG-PRO-375 · Terminologie-Vertrag „On-Premise Enterprise AI" (Terminologie V1 §1).
//
// Grundlage ist die in PRO 373 gemessene sichtbare Matrix. Sie trennt zwei Dinge, und diese
// Trennung IST der Vertrag:
//
//   K-A  Der Text benennt die KONFIGURATION des Betreibers — eine Auswahl, einen eingestellten
//        Modus, einen Verbindungszustand, eine Möglichkeit. Er gibt wieder, was eingerichtet
//        wurde. Der Produktbegriff ist hier belegbar (ReasonerStatus.mode / .tasks).
//   K-B  Der Text behauptet eine FOLGE daraus — Betriebsort, eigene Hardware, Datenverbleib,
//        DSGVO-Ja, privater Tunnel. Dafür gibt es im Code KEIN Signal: `local` hängt allein an
//        KLARWERK_LOCAL_LLM_URL, einer beliebigen OpenAI-kompatiblen Basis-URL, und
//        kiOrigin.ts leitet nur das Herkunftsland des MODELLS ab, nicht den Betriebsort.
//        Diese Texte bleiben fail-closed unverändert — der Produktbegriff darf sie NICHT
//        erreichen, weil er dort aus einer Bezeichnung eine Zusage machen würde.
//
// Zusätzlich gesperrt: K-C `adm.ai.choice.local` (offene Ownerfrage zum Zusatz „(On-Prem)")
// und A-6 `adm.ai.choice.localUnavailable`, das ohne diese Entscheidung nicht geschrieben
// werden darf — sonst stünden zwei Bezeichnungen im selben Auswahlfeld untereinander.
//
// Geltungsbereich: ausschließlich die beiden Träger sichtbarer Laufzeittexte im erlaubten
// Schnitt. Kein Tor durchsucht tests/, test-results/, docs/ oder specs/ — historische Evidenz
// wird nicht rückwirkend umgeschrieben (Terminologie §5).

const BEGRIFF = "On-Premise Enterprise AI";

const i18nSrc = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/i18n.ts", import.meta.url)),
  "utf8",
);
const addinSrc = readFileSync(
  fileURLToPath(new URL("../../apps/web/public/word-addin/taskpane.html", import.meta.url)),
  "utf8",
);

function objektAus(src: string, marker: string, ende: string): Record<string, unknown> {
  const start = src.indexOf(marker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${marker}`);
  }
  const auf = src.indexOf("{", start);
  const zu = src.indexOf(ende, auf);
  // Reines Objektliteral mit erhaltenem Escaping → sicher auswertbar.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  // ende schließt mit „;" — das gehört nicht mehr zum Objektliteral.
  return new Function(`return (${src.slice(auf, zu + ende.length - 1)})`)() as Record<
    string,
    unknown
  >;
}

const i18n: Record<string, Record<string, string>> = {
  de: objektAus(i18nSrc, "const de = {", "\n};") as Record<string, string>,
  en: objektAus(i18nSrc, "const en: typeof de = {", "\n};") as Record<string, string>,
  nl: objektAus(i18nSrc, "const nl: typeof de = {", "\n};") as Record<string, string>,
};
const STRINGS = objektAus(addinSrc, "var STRINGS = {", "\n    };") as unknown as Record<
  string,
  Record<string, string>
>;

// ------------------------------------------------------------------------------------------------
// FAIL-CLOSED LESEN — statt siebzehnmal `!`.
// ------------------------------------------------------------------------------------------------
//
// `noUncheckedIndexedAccess` macht jeden Indexzugriff optional. Das ist richtig so: ein FEHLENDER
// Sprachblock und ein LEERER Text sind verschiedene Dinge, und dieser Test lebt genau von dem
// Unterschied. Die Warnung mit `!` wegzudruecken haette sie nicht geloest, sondern verschoben —
// `undefined` waere in ein `toContain` gelaufen und dort mit einer Meldung gestorben, die den
// eigentlichen Grund (Sprachblock fehlt) nicht mehr nennt.
//
// Diese beiden Zugriffe scheitern stattdessen SOFORT und benannt. Sie schwaechen keinen Fall ab:
// jeder Aufruf, der vorher gruen war, ist es weiterhin — nur ein fehlender Schluessel sagt jetzt,
// WAS fehlt.

/** EIN Text. Wirft benannt, wenn Sprachblock oder Schluessel fehlen. */
function textAus(quelle: Record<string, Record<string, string>>, lang: string, key: string): string {
  const wert = blockAus(quelle, lang)[key];
  if (wert === undefined) {
    throw new Error(`Schluessel ${key} fehlt in Sprachblock ${lang}`);
  }
  return wert;
}

/** Der ganze Sprachblock. Wirft benannt, wenn es ihn nicht gibt. */
function blockAus(
  quelle: Record<string, Record<string, string>>,
  lang: string,
): Record<string, string> {
  const block = quelle[lang];
  if (!block) {
    throw new Error(`Sprachblock ${lang} fehlt`);
  }
  return block;
}

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// ---------------------------------------------------------------------------
// TV-1 · Manifest. EINE Quelle für alle folgenden Tore.
// ---------------------------------------------------------------------------

// K-A, vollständiger Zielwert (Wert besteht ganz aus dem Ziel).
const ZIEL_VOLL: Record<string, Record<Sprache, string>> = {
  "adm.sich.localAi.t": {
    de: "On-Premise Enterprise AI möglich",
    en: "On-Premise Enterprise AI possible",
    nl: "On-Premise Enterprise AI mogelijk",
  },
  "adm.firstrun.ki.both": {
    de: "Beide KIs verbunden: Cloud-KI und deine On-Premise Enterprise AI.",
    en: "Both AIs connected: cloud AI and your On-Premise Enterprise AI.",
    nl: "Beide AI's verbonden: cloud-AI en je On-Premise Enterprise AI.",
  },
  "adm.firstrun.ki.cloudOnly": {
    de: "Cloud-KI verbunden. Die On-Premise Enterprise AI ist noch nicht angebunden (Admin → KI).",
    en: "Cloud AI connected. Your On-Premise Enterprise AI is not wired up yet (Admin → AI).",
    nl: "Cloud-AI verbonden. De On-Premise Enterprise AI is nog niet aangesloten (Admin → AI).",
  },
};

// K-A, nur ein Ausschnitt ändert sich — der Rest des Satzes MUSS stehen bleiben. Deshalb wird
// beides geprüft: neuer Ausschnitt vorhanden UND alter Wortlaut verschwunden.
const ZIEL_AUSSCHNITT: Record<string, Record<Sprache, { neu: string; alt: string }>> = {
  "adm.ai.internExtern": {
    de: { neu: "intern (On-Premise Enterprise AI, eigener LLM)", alt: "eigener On-Prem-LLM" },
    en: { neu: "internal (On-Premise Enterprise AI, your own LLM)", alt: "your own on-prem LLM" },
    nl: { neu: "intern (On-Premise Enterprise AI, eigen LLM)", alt: "eigen on-prem-LLM" },
  },
  "shelp.rcfg.title": {
    de: { neu: "eure On-Premise Enterprise AI", alt: "eure eigene lokale KI" },
    en: { neu: "your On-Premise Enterprise AI", alt: "your own local AI" },
    nl: { neu: "jullie On-Premise Enterprise AI", alt: "jullie eigen lokale KI" },
  },
};

// K-A im Microsoft-365-Add-in.
const ZIEL_ADDIN: Record<string, Record<Sprache, string>> = {
  s4ModeInternal: { de: BEGRIFF, en: BEGRIFF, nl: BEGRIFF },
  s4ReasonInternalNotConfigured: {
    de: "Es ist keine On-Premise Enterprise AI eingerichtet.",
    en: "No On-Premise Enterprise AI is configured.",
    nl: "Er is geen On-Premise Enterprise AI ingericht.",
  },
};

// Sperrliste K-B/K-C/A-6. Gepinnt per SHA-256 des WERTES, nicht per abgetipptem Text: die Sätze
// enthalten typografische Anführungszeichen und Gedankenstriche, und ein Abschreibfehler würde
// ein Tor still grün machen statt rot. Jede Byteänderung ändert den Hash.
const PIN: Record<string, Record<Sprache, string>> = {
  "topbar.plain.ki": {
    de: "b10c3880c805d841e2fdf57f5fff3f20e4c626afba4f70a3cfec5a7c31590ec7",
    en: "674d67c12a9ea096074bf7a9c596f68a0340dd8de081cedfcdd838494ca07202",
    nl: "2342710bb8e1420993804daef5c0f6dd3d1119b25d92995750b0b7314d7b7cce",
  },
  "topbar.kiInternal": {
    de: "a12b6db097108177aabe0cce5938d3f9a504faee9489ed15da56a495eacc491f",
    en: "e845cd7637fdbb89e3d680572c39fa684b37fc8ec8a045c86410f3984188a924",
    nl: "a6dcf3e9b494e875a9ea8236037b864a2586c4c49be58ffeffc0b7de80e92efc",
  },
  "topbar.kiMixed": {
    de: "262934df498070350afa0a5b1ce6b074073216b78b918a891b89928932aaa936",
    en: "067340f84673698e52ac522dbd4b5b85e454c5cb8de6a6ce577dbce15fe9f180",
    nl: "417d88f9473da6161ba6301624e167524423ed2985c1aa9840242a3ed67c4fa7",
  },
  // Trägt die Bedingung der DSGVO-Bestätigung. Ein Begriffstausch hier hinge das
  // Datenschutzversprechen an eine Betriebsform, die der Code nicht prüft.
  "topbar.kiExternalHint": {
    de: "a54ecc3cd08576105aec5bbac5ded99281a814d9a263fe8f2aef581571cf6b43",
    en: "d1338d73b73e4e589673baad96f4b91d74136dd63e99958892f2c93a4a618c1f",
    nl: "b8dab0bd5d7139828e60c49effb70adc214efaa837c95c44116e9521b79e1d4c",
  },
  "topbar.kiInternalHint": {
    de: "88207c4449fdb8a789ad54a74584a57a5a747a4852ed1ae8c0a7a874562a2546",
    en: "0fd81440f85d7245187511344b9242d2b95a935b6cc5284a3ecb456f203d61f2",
    nl: "188f2faaf705d9800763d39b72881ac16a254b81ad852df305fa5403e032df5e",
  },
  "topbar.kiMixedHint": {
    de: "a9a01d45b9e4e9e4f956f27010555bf6f7354db9d5ef61759405d6ec0fb3d9c1",
    en: "c793db3ec5698ee62d929337ffed3b15596e55bafc469c7a532d76fb3c679b60",
    nl: "ddbe69a5f0a60787226125fcbebb4880feded76938c5ef57596b5465f084128e",
  },
  // Behauptet eigene Hardware UND dass Inhalte das Haus nicht verlassen — beides ohne Signal.
  "reasoner.taskInfo.bodyLocal": {
    de: "c84a60ef04e1f65886af052e03a8f159119419d39d12fc8b1e0818287dac8f68",
    en: "d6c56af562af55b024fb3d5786f9eb5df375a1ec546a5b09352548be5dbd8dcd",
    nl: "cb72260631d749aff8624435c584ae2ab982f150ec9c9b7add53f65289e50b2e",
  },
  "reasoner.taskInfo.dsgvoInhouseBody": {
    de: "744eea5c068b27ad2d833ac1ae605630de1309d40b98cae564a6531e60147b6f",
    en: "52a5834deac0b52efa8821aaa47675bbea691f8d266ff668a8887337a7cc10c6",
    nl: "d3f0d95937245d66b1e441a990a3f8df6c8283d255952374fa60b368844c2e71",
  },
  // Trägt die Tunnelzusage („nur über einen privaten Tunnel erreichbar, nie öffentlich").
  "adm.sich.localAi.b": {
    de: "ba992367538a008fd1bbc0ba6d98da299b624214d689a5e57b5977cf189dbd5d",
    en: "08a98501ad3a4d809740d6c4332c5ed0657c27733d876ef8c203e864ef6e3ca2",
    nl: "9f5df642ac27daa41e30dbb6ec349a9f1d59f4579d94352a10018fb34157189b",
  },
  // K-C — offene Ownerfrage.
  "adm.ai.choice.local": {
    de: "5885fd84824cc968d5aeccc5853423fe394ebce176f01e22ffdb192878248b92",
    en: "7997df7d1ac636e5f7fb29e9e740cf1aa69ece14261b463c1946c337e1156b7d",
    nl: "69dd13c77acd126c51cac3782e903c037289faea5b009bf8d40f47320faaf4ba",
  },
  // A-6 — an die K-C-Entscheidung gebunden.
  "adm.ai.choice.localUnavailable": {
    de: "37e9fcc768f1ca1c2f281e684b96db4db352ebc0ff4f1c4ac2d37514f40b3f6b",
    en: "4c1c9dfaaaee46294f001496b13a67a1a8f791bf3aee9a9beda9dc8972996ec4",
    nl: "dc4ae5bc6dd0c359286b052488f3c67a01c280f89102d51e145cbf9bb3f2ba3c",
  },
};

const PIN_ADDIN: Record<string, Record<Sprache, string>> = {
  // Zustands- UND Ortsbehauptung; trägt zugleich Klaras Kernsatz.
  aiLageIntern: {
    de: "723e7e0e1e56a96222f70e2738e7cfd8090210aee2768cde19c6a4e3cf409ac2",
    en: "f54a1ddceb45b0bfa9cbb84377f1430026d52c4b998377aa3f7201f73abd368b",
    nl: "3111a6966736bb9ab8649de23210e6c180521a16f6110f8e2b4afed1f006becd",
  },
  trustModeIntern: {
    de: "98f1732547d878c5984dfc6f990ba48bce9ebbe32fec7f3d1a1c0e77f862c2c1",
    en: "ed69262fd3319b6828d25422b61c810731fdbbea456e23e177596ef5a74dba2e",
    nl: "9518d00db4e2181e2fca4fb64e6d1d3409722a8cb5ecfa9633588b5089d71fd8",
  },
};

// Aliasfamilie aus PRO 373, gehärtet: „das Haus" fehlte dort und ließ ausgerechnet
// reasoner.taskInfo.bodyLocal durchrutschen — den Satz mit der Hardware- und Datenbleibe-Zusage.
const ALIAS =
  /interne KI|lokale KI|internal AI|interne AI|On-Prem|on-prem|lokales LLM|hausintern|in-house|eigenen Haus|im Haus|Im Haus|das Haus|eigen huis|in huis|het huis|the house|eigenen Hardware|own hardware|eigen hardware/i;

// Einzige bekannte Redewendung ohne KI-Bezug: „im Haus „Stufe 2" genannt" = betriebsintern.
// Ausdrücklich benannt, damit der Ausschluss nachvollziehbar ist statt stillschweigend.
const AUSNAHMEN = new Set(["stage2.gate.body"]);

const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

describe("PRO 375 · Terminologie-Vertrag On-Premise Enterprise AI", () => {
  // TV-3 · Zielwerte, je Sprache einzeln.
  it("TV-3a setzt die vollständigen K-A-Zielwerte in DE, EN und NL", () => {
    for (const [key, werte] of Object.entries(ZIEL_VOLL)) {
      for (const lang of SPRACHEN) {
        expect(textAus(i18n, lang, key), `${key} · ${lang}`).toBe(werte[lang]);
      }
    }
  });

  it("TV-3b tauscht in Teilsätzen genau den Begriff — alter Wortlaut ist weg", () => {
    for (const [key, werte] of Object.entries(ZIEL_AUSSCHNITT)) {
      for (const lang of SPRACHEN) {
        const wert = textAus(i18n, lang, key);
        expect(wert, `${key} · ${lang} · neu`).toContain(werte[lang].neu);
        expect(wert, `${key} · ${lang} · alt`).not.toContain(werte[lang].alt);
      }
    }
  });

  it("TV-3c setzt die Add-in-Zielwerte in allen drei Sprachblöcken", () => {
    for (const [key, werte] of Object.entries(ZIEL_ADDIN)) {
      for (const lang of SPRACHEN) {
        expect(textAus(STRINGS, lang, key), `${key} · ${lang}`).toBe(werte[lang]);
      }
    }
  });

  // TV-4 · Sperrliste bytegleich.
  it("TV-4 lässt jeden K-B-, K-C- und A-6-Text byteweise unangetastet", () => {
    for (const [key, hashes] of Object.entries(PIN)) {
      for (const lang of SPRACHEN) {
        expect(sha(textAus(i18n, lang, key)), `${key} · ${lang}`).toBe(hashes[lang]);
      }
    }
    for (const [key, hashes] of Object.entries(PIN_ADDIN)) {
      for (const lang of SPRACHEN) {
        expect(sha(textAus(STRINGS, lang, key)), `addin ${key} · ${lang}`).toBe(hashes[lang]);
      }
    }
  });

  // TV-5 · Der Wächter auf der fail-closed-Grenze selbst.
  it("TV-5 lässt den Produktbegriff in keinen gesperrten Text", () => {
    for (const key of Object.keys(PIN)) {
      for (const lang of SPRACHEN) {
        expect(textAus(i18n, lang, key), `${key} · ${lang}`).not.toContain(BEGRIFF);
      }
    }
    for (const key of Object.keys(PIN_ADDIN)) {
      for (const lang of SPRACHEN) {
        expect(textAus(STRINGS, lang, key), `addin ${key} · ${lang}`).not.toContain(BEGRIFF);
      }
    }
  });

  // TV-2 · macht „neu" entscheidbar: jeder Aliastreffer MUSS im Manifest stehen.
  it("TV-2 duldet keinen Aliasbegriff in einem Schlüssel außerhalb des Manifests", () => {
    const bekannt = new Set([
      ...Object.keys(ZIEL_VOLL),
      ...Object.keys(ZIEL_AUSSCHNITT),
      ...Object.keys(PIN),
      ...AUSNAHMEN,
    ]);
    const neu: string[] = [];
    for (const lang of SPRACHEN) {
      for (const [key, wert] of Object.entries(blockAus(i18n, lang))) {
        if (typeof wert === "string" && ALIAS.test(wert) && !bekannt.has(key)) {
          neu.push(`${key} (${lang})`);
        }
      }
    }
    const bekanntAddin = new Set([...Object.keys(ZIEL_ADDIN), ...Object.keys(PIN_ADDIN)]);
    for (const lang of SPRACHEN) {
      for (const [key, wert] of Object.entries(blockAus(STRINGS, lang))) {
        if (typeof wert === "string" && ALIAS.test(wert) && !bekanntAddin.has(key)) {
          neu.push(`addin ${key} (${lang})`);
        }
      }
    }
    expect(neu, "nicht im Manifest geführte Aliasfundstellen").toEqual([]);
  });

  // TV-6 · Die Dreiteilung darf nicht zu einer Zweiteilung verschmelzen.
  it("TV-6 hält Cloud, On-Premise Enterprise AI und regelbasiert getrennt", () => {
    const dritte: Record<Sprache, string> = {
      de: "regelbasierte Modus ganz ohne Modell",
      en: "rule-based mode without any model",
      nl: "op regels gebaseerde modus helemaal zonder model",
    };
    const cloud: Record<Sprache, string> = { de: "Cloud-KI", en: "cloud AI", nl: "cloud-KI" };
    for (const lang of SPRACHEN) {
      const wert = textAus(i18n, lang, "shelp.rcfg.title");
      expect(wert, `cloud · ${lang}`).toContain(cloud[lang]);
      expect(wert, `produkt · ${lang}`).toContain(BEGRIFF);
      expect(wert, `regelbasiert · ${lang}`).toContain(dritte[lang]);
    }
  });

  // TV-7 · Die Grenze zwischen Möglichkeit und Zustand.
  it("TV-7 bewahrt den Erreichbarkeits-Bedingungssatz wörtlich", () => {
    const bedingung: Record<Sprache, string> = {
      de: "Die interne Option erscheint, sobald ein eigener LLM erreichbar ist",
      en: "The internal option appears as soon as an own LLM is reachable",
      nl: "De interne optie verschijnt zodra een eigen LLM bereikbaar is",
    };
    for (const lang of SPRACHEN) {
      expect(textAus(i18n, lang, "adm.ai.internExtern"), lang).toContain(bedingung[lang]);
    }
  });

  // TV-8 · Klaras Vertrauensaussage.
  //
  // Die Gegenmutation zu diesem Auftrag hat hier eine echte Lücke aufgedeckt: der Satz steht
  // nicht nur in aiLageIntern, sondern in ALLEN FÜNF aiLage-Varianten. Ein Wächter, der nur
  // die gepinnte Variante prüft, schützt die Zusage nicht — „immer" ließe sich in den vier
  // Geschwistertexten unbemerkt zu „meist" abschwächen. Deshalb prüft TV-8 alle fünf.
  //
  // Geprüft wird beides: die UNBEDINGTHEIT (sonst wäre „meist ohne KI-Modell" grün) und die
  // Zitatzusage. aiLageKeine formuliert die Unbedingtheit in EN/NL anders („in any case" /
  // „sowieso") — deshalb je Sprache eine Liste zulässiger Formulierungen statt einer einzigen.
  const AI_LAGE = [
    "aiLageLaedt",
    "aiLageUnerreichbar",
    "aiLageExtern",
    "aiLageIntern",
    "aiLageKeine",
  ] as const;

  it("TV-8 bewahrt Klaras Kernsatz in allen fünf aiLage-Texten", () => {
    const unbedingt: Record<Sprache, readonly string[]> = {
      de: ["immer ohne KI-Modell"],
      en: ["always produced without an AI model", "produced without an AI model in any case"],
      nl: ["altijd zonder AI-model", "sowieso zonder AI-model"],
    };
    const zitat: Record<Sprache, string> = {
      de: "regelbasiert, mit wörtlichem Zitat aus validiertem Wissen",
      en: "rule-based, quoting validated knowledge word for word",
      nl: "regelgebaseerd, met een woordelijk citaat uit gevalideerde kennis",
    };
    for (const key of AI_LAGE) {
      for (const lang of SPRACHEN) {
        const wert = textAus(STRINGS, lang, key);
        expect(
          unbedingt[lang].some((f) => wert.includes(f)),
          `${key} · ${lang} · Unbedingtheit fehlt: ${wert}`,
        ).toBe(true);
        expect(wert, `${key} · ${lang} · Zitatzusage`).toContain(zitat[lang]);
      }
    }
  });

  // TV-9 · Ohne dieses Tor bliebe die Umstellung für NL-Nutzer unsichtbar.
  it("TV-9 führt jeden K-A-Schlüssel in DE, EN und NL", () => {
    const kaI18n = [...Object.keys(ZIEL_VOLL), ...Object.keys(ZIEL_AUSSCHNITT)];
    for (const key of kaI18n) {
      for (const lang of SPRACHEN) {
        expect(textAus(i18n, lang, key), `${key} · ${lang}`).toContain(BEGRIFF);
      }
    }
    for (const key of Object.keys(ZIEL_ADDIN)) {
      for (const lang of SPRACHEN) {
        expect(textAus(STRINGS, lang, key), `addin ${key} · ${lang}`).toContain(BEGRIFF);
      }
    }
  });

  // Der Vertrag deckt genau die 21 im erlaubten Schnitt geänderten Texte und die 39 gesperrten.
  it("TV-1 bindet 21 geänderte und 39 gesperrte Texte", () => {
    const geaendert =
      (Object.keys(ZIEL_VOLL).length + Object.keys(ZIEL_AUSSCHNITT).length) * 3 +
      Object.keys(ZIEL_ADDIN).length * 3;
    const gesperrt = (Object.keys(PIN).length + Object.keys(PIN_ADDIN).length) * 3;
    expect(geaendert).toBe(21);
    expect(gesperrt).toBe(39);
  });
});
