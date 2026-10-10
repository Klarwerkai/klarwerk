// ================================================================================================
// R-0791 · R-1975 (I27) — JEDER SCHALTER, DEN DER SERVER MELDET, HAT EINEN BENANNTEN LESER.
// ================================================================================================
//
// DER BEFUND (OFFEN.md, I27): „Ein Schalter ohne Leser: `confluenceImport`. Der Name wird von
// `/api/features` gemeldet und ist in `api/types.ts` typisiert, aber kein Frontend-Code liest ihn.
// […] Er kostet nichts, solange ihn niemand für wirksam hält — und genau das wird irgendwann
// jemand tun." mega69 Block H hat `confluenceImport` aus `FeatureName` genommen. Nachgesehen am
// Stand dieses Auftrags stand dieselbe Lage noch zweimal da: `herkunft` und `expertMatching` waren
// typisiert, und keine Zeile in `apps/web/src` las sie. Beide sind jetzt aus `FeatureName` entfernt.
//
// WAS DIESE DATEI FESTHÄLT: ein Register, das für JEDEN Schalter der Auskunft sagt, wie die
// Oberfläche seine Stellung erfährt — und das an Quelltext geprüft wird, nicht an der Absicht:
//
//   auskunft        — liest `/api/features` (`FeatureGate` oder `useFeatures().data?.features?.x`).
//                     Der Leser muss in der genannten Datei im CODE stehen (nicht im Kommentar).
//   eigeneAuskunft  — die Fläche liest eine fachliche Zugangsauskunft, die mehr sagt als Ja/Nein
//                     (freigegeben, vom Betreiber ausgeschaltet, Zugangsdaten). Der Anker muss im
//                     Code der genannten Datei stehen; der Name darf NICHT in `FeatureName` stehen.
//   abwesenheit     — die Fläche erfährt den Schalter an der fehlenden Route (404 → `null`,
//                     JOB 577). Ebenso: Anker im Code, Name nicht in `FeatureName`.
//   ohneFlaeche     — es gibt in `apps/web` keine Fläche, die die geschaltete Route aufruft. Das ist
//                     eine Aussage, und sie wird geprüft: ruft künftig Code die Route auf, ist dieser
//                     Fall rot und verlangt einen echten Leser.
//
// DIE DREI RICHTUNGEN, in denen das Register rot wird:
//   R1 — der Server meldet einen Schalter, den das Register nicht einordnet (neuer Schalter).
//   R2 — `FeatureName` führt einen Namen, der keinen `auskunft`-Leser hat (die I27-Lage).
//   R3 — ein eingetragener Leseweg stimmt nicht mehr (Leser entfernt, Anker weg, Route gebaut).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schalterZustand } from "../../services/app/src/feature-flags";
import { repoPfad } from "../support/repoPfad";

type Leseweg =
  | { readonly art: "auskunft"; readonly datei: string }
  | {
      readonly art: "eigeneAuskunft" | "abwesenheit";
      readonly datei: string;
      readonly anker: string;
      readonly grund: string;
    }
  | { readonly art: "ohneFlaeche"; readonly route: RegExp; readonly grund: string };

const REGISTER: Record<string, Leseweg> = {
  rechtsseiten: { art: "auskunft", datei: "apps/web/src/legal/LegalPages.tsx" },
  hinweisbanner: { art: "auskunft", datei: "apps/web/src/legal/NoticeBanner.tsx" },
  demodaten: { art: "auskunft", datei: "apps/web/src/pages/AdminDatenDetails.tsx" },
  // Kein Registry-Schalter, sondern aus dem Host abgeleitet (JOB 4365) — aber ein Feld derselben
  // Auskunft, und deshalb ebenso eingeordnet.
  demoInstanz: { art: "auskunft", datei: "apps/web/src/auth/BrandPanel.tsx" },
  confluenceImport: {
    art: "eigeneAuskunft",
    datei: "apps/web/src/components/ImportAccessPanel.tsx",
    anker: "useImportAccessConfluence(",
    grund:
      "mega69 Block H: `GET /api/import/confluence/zugang` sagt `enabled` (Umgebung UND Betreiber), " +
      "`freigegeben` und den Betreiberschalter — mehr als das Ja/Nein der Auskunft, und auch dann, " +
      "wenn die Importrouten nicht registriert sind.",
  },
  sharepointImport: {
    art: "eigeneAuskunft",
    datei: "apps/web/src/components/sharepoint-import/SharePointImportBereich.tsx",
    anker: "sharepointApi.zugang",
    grund:
      "JOB 4086: `GET /api/import/sharepoint/zugang` steht bewusst VOR dem Schalter und meldet " +
      "„nicht eingeschaltet“, „ohne Zugangsdaten“ oder „eingeschaltet“.",
  },
  expertMatching: {
    art: "abwesenheit",
    datei: "apps/web/src/pages/Risk.tsx",
    anker: "useExpertise(",
    grund:
      "Ohne Schalter ist die Expertise-Route nicht registriert; `useExpertise` macht aus dem 404 " +
      "`null` (JOB 577), und der Bereich wird nicht gerendert. Kein Aufruf ohne Berechtigung " +
      "(`canSeeExpertise`).",
  },
  herkunft: {
    art: "ohneFlaeche",
    route: /\/provenance["'`]/,
    grund:
      "`GET /api/kos/:id/provenance` hat in `apps/web` keinen Aufrufer. Die Herkunftskette am " +
      "Objekt (`MehrAbschnitte.tsx`) kommt aus dem Prüfprotokoll und hängt nicht an diesem Schalter.",
  },
  // R-1136 (aufnahme:20260922:gesamt-rechte-inventar): R-0170 hat `jiraImport` ins Registry gelegt,
  // aber hier nicht eingeordnet — R1 („jeder Schalter, den `/api/features` meldet, ist
  // eingeordnet") stand damit gegen den Stand 41ba0b7f (Quelleninspektion). Die Galerie führt Jira
  // als „bald" (`importSourceGallery.ts`), keine Fläche ruft eine Jira-Route auf.
  jiraImport: {
    art: "ohneFlaeche",
    route: /\/import\/jira\//,
    grund:
      "Die drei Jira-Routen und die Zugangsauskunft `GET /api/import/jira/zugang` haben in " +
      "`apps/web` keinen Aufrufer; die Importgalerie zeigt Jira als „bald“.",
  },
};

/**
 * Kommentare entfernen — ein Leser, der nur im Kommentar steht, liest nichts.
 *
 * Zeilenkommentare ZUERST: eine Zeile wie „// … `services/**` …" (`api/types.ts`) enthielte sonst
 * einen scheinbaren Blockkommentar-Anfang, und alles bis zum nächsten Blockende fiele mit weg.
 */
function ohneKommentare(inhalt: string): string {
  return inhalt.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function quelle(relativ: string): string {
  return ohneKommentare(readFileSync(repoPfad(relativ), "utf8"));
}

/** Liest dieser Code den Schalter `name` aus der Auskunft `/api/features`? */
function liestSchalter(code: string, name: string): boolean {
  const muster = new RegExp(
    `feature=["']${name}["']|features\\??\\.${name}\\b|features\\??\\.?\\[["']${name}["']\\]`,
  );
  return muster.test(ohneKommentare(code));
}

/** Die Namen der Union `FeatureName` aus `apps/web/src/api/types.ts`. */
function featureNamen(): string[] {
  const typen = quelle("apps/web/src/api/types.ts");
  const block = /export type FeatureName =([\s\S]*?);/.exec(typen)?.[1];
  if (block === undefined) {
    throw new Error("`export type FeatureName` nicht gefunden — die Erhebung greift nicht");
  }
  return [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1] as string).sort();
}

/** Alle Produktdateien unter apps/web/src (ohne Tests). */
function webDateien(verzeichnis = "apps/web/src"): string[] {
  const ergebnis: string[] = [];
  for (const eintrag of readdirSync(repoPfad(verzeichnis))) {
    const relativ = join(verzeichnis, eintrag);
    if (statSync(repoPfad(relativ)).isDirectory()) {
      ergebnis.push(...webDateien(relativ));
    } else if (/\.(ts|tsx)$/.test(eintrag) && !/\.test\.(ts|tsx)$/.test(eintrag)) {
      ergebnis.push(relativ);
    }
  }
  return ergebnis;
}

describe("R-0791 · R-1975 · das Leserregister der Betriebsschalter", () => {
  it("KALIBRIERUNG: der Leser-Erkenner erkennt Leser und nur Leser", () => {
    const hookLeser = "useFeatures().data?.features?.rechtsseiten ?? false";
    expect(liestSchalter('<FeatureGate feature="demodaten">', "demodaten")).toBe(true);
    expect(liestSchalter(hookLeser, "rechtsseiten")).toBe(true);
    expect(liestSchalter("auskunft?.features?.demoInstanz === true", "demoInstanz")).toBe(true);
    // Ein Kommentar ist kein Leser — genau die Form, in der I27 jahrelang „gelesen" aussah.
    expect(liestSchalter("// features?.herkunft wird hier gelesen", "herkunft")).toBe(false);
    // Ein längerer Name mit gleichem Anfang ist ein anderer Schalter.
    expect(liestSchalter("features?.herkunftsweg", "herkunft")).toBe(false);
    expect(featureNamen().length).toBeGreaterThan(0);
    expect(webDateien().length).toBeGreaterThan(100);
  });

  it("R1 · jeder Schalter, den `/api/features` meldet, ist eingeordnet — und kein anderer", () => {
    const gemeldet = Object.keys(schalterZustand(undefined)).sort();
    expect(Object.keys(REGISTER).sort()).toEqual(gemeldet);
  });

  it("R2 · `FeatureName` führt nur Schalter mit einem echten Leser der Auskunft (I27)", () => {
    for (const name of featureNamen()) {
      const weg = REGISTER[name];
      expect(
        weg?.art,
        `\`${name}\` ist in FeatureName typisiert, liest aber nicht die Auskunft — eine Zusage ohne Fläche`,
      ).toBe("auskunft");
    }
  });

  it("R3a · jeder `auskunft`-Leser steht im Code der genannten Datei", () => {
    for (const [name, weg] of Object.entries(REGISTER)) {
      if (weg.art !== "auskunft") {
        continue;
      }
      expect(
        liestSchalter(readFileSync(repoPfad(weg.datei), "utf8"), name),
        `${weg.datei} liest \`${name}\` nicht (mehr) aus /api/features`,
      ).toBe(true);
    }
  });

  it("R3b · jede fachliche Auskunft und jede Abwesenheitsprüfung steht im Code — und der Name nicht in FeatureName", () => {
    const typisiert = new Set(featureNamen());
    for (const [name, weg] of Object.entries(REGISTER)) {
      if (weg.art !== "eigeneAuskunft" && weg.art !== "abwesenheit") {
        continue;
      }
      expect(weg.grund.length, `${name}: der Leseweg ist nicht begründet`).toBeGreaterThan(40);
      const fehlt = `${weg.datei}: der Leseweg \`${weg.anker}\` fehlt`;
      expect(quelle(weg.datei), fehlt).toContain(weg.anker);
      expect(
        typisiert.has(name),
        `\`${name}\` ist typisiert, wird aber nicht aus der Auskunft gelesen`,
      ).toBe(false);
    }
  });

  it("R3c · ein Schalter ohne Fläche hat wirklich keine: kein Produktcode ruft seine Route auf", () => {
    for (const [name, weg] of Object.entries(REGISTER)) {
      if (weg.art !== "ohneFlaeche") {
        continue;
      }
      const aufrufer = webDateien().filter((datei) => weg.route.test(quelle(datei)));
      expect(
        aufrufer,
        `\`${name}\`: ${aufrufer.join(", ")} ruft die geschaltete Route auf — dann braucht der Schalter einen echten Leser`,
      ).toEqual([]);
      expect(featureNamen()).not.toContain(name);
    }
  });
});
