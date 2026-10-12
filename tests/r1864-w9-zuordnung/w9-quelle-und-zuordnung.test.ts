// ================================================================================================
// R-1864 „ENTSCHEIDUNGEN“ — DIE QUELLE W9 LIEGT IM ARBEITSBAUM, UND IHRE ZUORDNUNG STIMMT.
// ================================================================================================
//
// Pedis Entscheidung `entscheidung:759dd154` (Rev. 2) hat R-1864 ausgegliedert: „Entscheidungsquelle
// R-1864 beschaffen und zuordnen“. Das Kriterium war nur ein Wort, weil der Registereintrag die
// ZUSTANDSSPALTE der Zeile `OFFEN.md` W9 als Satz uebernommen hat. Diese Datei haelt fest:
//   · Q   die Zeile W9 steht genau einmal in `OFFEN.md`, mit Zustand ENTSCHEIDUNGEN und dem Wortlaut,
//         den die Auftragsquelle als Herkunft von R-1864 festhaelt;
//   · D   `docs/entscheidungen/r1864-w9-zwei-wege.md` zitiert diese Zeile ZEICHENGLEICH — wird die
//         Quelle geaendert, faellt die Zuordnung hier auf, statt still zu veralten;
//   · Z   jede Zuordnung des Dokuments zeigt auf eine Stelle, die es im Bestand gibt.
//
// WAS DIESE DATEI NICHT BELEGT: dass die Stufen sich richtig VERHALTEN. Das messen die im Dokument
// genannten Verhaltenstests; hier wird nur geprueft, dass die Zuordnung auf Vorhandenes zeigt.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { panelQuelleAus } from "../support/panelquelle";

const OFFEN = "OFFEN.md";
const DOKUMENT = "docs/entscheidungen/r1864-w9-zwei-wege.md";
const TASKPANE = "apps/web/public/word-addin/taskpane.html";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

function w9Zeilen(): string[] {
  return lies(OFFEN)
    .split("\n")
    .filter((zeile) => zeile.startsWith("| W9 |"));
}

function w9Zeile(): string {
  const [zeile] = w9Zeilen();
  if (zeile === undefined) throw new Error("OFFEN.md traegt keine Zeile W9");
  return zeile;
}

function zwischen(text: string, start: string, ende: string): string {
  const von = text.indexOf(start);
  const bis = text.indexOf(ende, von);
  if (von === -1 || bis === -1) throw new Error(`Block ${start} … ${ende} fehlt`);
  return text.slice(von, bis);
}

describe("R-1864 · Q — die Quelle W9 im Arbeitsbaum", () => {
  it("Q1: genau eine Zeile W9, Zustand ENTSCHEIDUNGEN, Termin NACH-VORTEST", () => {
    expect(w9Zeilen()).toHaveLength(1);
    const spalten = w9Zeile()
      .split(" | ")
      .map((s) => s.trim());
    expect(spalten.slice(0, 3)).toEqual(["| W9", "ENTSCHEIDUNGEN", "NACH-VORTEST"]);
  });

  it("Q2: der Wortlaut traegt die Aussagen, die das Dokument zuordnet", () => {
    const zeile = w9Zeile();
    for (const teil of [
      "**Das Zwei-Wege-Konzept liegt: `_relay/kopf/KLARA-Zwei-Wege-Konzept.md` (30.07. nachts, Denkauftrag von Pedi).**",
      "**1** „Gibt es das schon?“-Knopf (check-text nach S5-Logik, null Egress)",
      "**2** Text verifizieren — gedeckt / im Widerspruch / Lücke (Rahmung des Vorhandenen, klein)",
      "**3** Output Factory bekommt eine Tür nach Word über den vorhandenen Einfügeweg (mittel)",
      "bietet die vorhandene `interview`-Aufgabe das Lehrlings-Gespräch an (K5)",
      "**Kein Baustein braucht neuen Egress; die Retrieval-only-Grenze bleibt bei allen drei Stufen unangetastet.**",
      "Jede Stufe hat deshalb eine benannte Reizschwelle. |",
    ]) {
      expect(zeile).toContain(teil);
    }
  });
});

describe("R-1864 · D — das Zuordnungsdokument zitiert die Quelle zeichengleich", () => {
  it("D1: die ganze Zeile W9 steht unveraendert im Dokument", () => {
    expect(lies(DOKUMENT).split("\n")).toContain(w9Zeile());
  });

  it("D2: das Kriterium steht woertlich und unveraendert im Dokument", () => {
    const fliesstext = lies(DOKUMENT).replace(/\s+/g, " ");
    expect(fliesstext).toContain("„Aufgenommener Zielzustand (R-1864): ENTSCHEIDUNGEN“");
  });
});

describe("R-1864 · Z — jede Zuordnung zeigt auf Vorhandenes", () => {
  // R-1611 (Drei-Datei-Schnitt): das Fenster liegt in `taskpane.html`/`.css`/`.js`; die Marken
  // stehen in `taskpane.js`. `panelQuelleAus` fügt die drei Dateien zu genau dem einen Dokument
  // zusammen, das hier bisher gelesen wurde.
  const panel = panelQuelleAus(TASKPANE);

  it("Z1: Stufe 1 — check-text hat einen Aufrufer im Panel", () => {
    expect(lies("services/app/src/routes/check-text-routes.ts")).toContain('"/api/check-text"');
    const block = zwischen(panel, "KW-KLARA-W6-CHECKTEXT-START", "KW-KLARA-W6-CHECKTEXT-END");
    expect(block).toContain("function w6DublettenAusCheckText(");
    expect(block).toContain('"/api/check-text"');
    expect(panel).toContain('<div id="capture-dubletten"');
  });

  it("Z2: Stufe 2 — der Word-Vergleich mit Knopf und den vier Aussagen", () => {
    const block = zwischen(panel, "// KW-WORDVERGLEICH-START", "// KW-WORDVERGLEICH-END");
    expect(block).toContain('knopf.id = "wv-btn"');
    for (const aussage of ['„woertlich belegt"', '„aehnlich"', '„kein Fund"', '„Widerspruch"']) {
      expect(block).toContain(aussage);
    }
  });

  // Ben (Nacharbeit 2): Stufe 3 nennt die Output Factory. Der Memo-Weg ruft den Zuruf, nicht die
  // Factory. Z3a/Z3b halten beide Wege GETRENNT fest, Z3c bindet die Einstufung im Dokument daran.
  it("Z3a: Output Factory hat Route und Web-Aufrufer, keinen im Word-Panel", () => {
    const app = lies("services/app/src/build-app.ts");
    expect(app).toContain("app.register(outputRoutes(services.output, guards));");
    expect(lies("apps/web/src/api/endpoints.ts")).toContain('"/output/generate"');
    expect(panel).not.toContain("/api/output/");
  });

  it("Z3b: der Memo-Weg ruft den Zuruf, und der Zuruf ist nicht die Output Factory", () => {
    const sitzung = lies("services/app/src/routes/klara-session-routes.ts");
    expect(sitzung).toContain('"/api/klara/sessions/:sessionId/zuruf"');
    expect(sitzung).not.toContain("OutputService");
    const zuruf = lies("services/output/src/zuruf.ts");
    expect(zuruf).not.toMatch(/from "\.\/service"/);
    expect(zuruf).not.toContain(".generate(");
    const block = zwischen(panel, "// KW-KA6-MEMO-START", "// KW-KA6-MEMO-END");
    expect(block).toContain("function ka6MemoAnfordern(");
    expect(block).toContain('knopf.id = "ka6-memo-btn"');
    expect(block).toContain('"/zuruf"');
  });

  it("Z3c: Stufe 3 ist „Nicht nachgewiesen“, solange das Panel die Factory nicht ruft", () => {
    const dokument = lies(DOKUMENT);
    const zeile = /\| \*\*Stufe 3\*\* Output Factory → Word[^|]*\| \*\*Nicht nachgewiesen\.\*\*/;
    expect(zeile.test(dokument)).toBe(!panel.includes("/api/output/"));
    // Der Memo-Weg darf nur als verwandter Bestand stehen, nie als Stufe 3 selbst.
    expect(dokument).toMatch(/\| \*Verwandter heutiger Bestand zu Stufe 3\* \(kein Nachweis/);
    expect(dokument).not.toMatch(/\| \*\*Stufe 3\*\*[^|]*\| Memo aus einer Quelle/);
  });

  it("Z4: K5 steht nur so lange als „Nicht zugeordnet“, wie die Luecke kein interview anbietet", () => {
    const luecke = zwischen(panel, "KW-D2-LUECKE-START", "KW-D2-LUECKE-END");
    const zeile = /\| Rückkopplung Lücke → `interview` \(K5\) \| \*\*Nicht zugeordnet\.\*\*/;
    const nichtZugeordnet = zeile.test(lies(DOKUMENT));
    expect(nichtZugeordnet).toBe(!luecke.includes("interview"));
  });

  it("Z5: jeder im Dokument genannte Verhaltenstest existiert", () => {
    const genannt = [...lies(DOKUMENT).matchAll(/`(tests\/[^`]+\.test\.ts)`/g)].map(
      (m) => m[1] ?? "",
    );
    expect(genannt.length).toBeGreaterThanOrEqual(5);
    for (const pfad of genannt) {
      expect(existsSync(pfad), pfad).toBe(true);
    }
  });
});

// Ben (Nacharbeit 3): Konzeptquelle samt Abschnitt 7 abgleichen und den Egress-Abgleich abschliessen.
// Die Konzeptdatei selbst liegt ausserhalb des Arbeitsbaums und ist hier nicht lesbar; gepinnt wird,
// dass jede Aussage des Egress-Abgleichs auf eine Stelle zeigt, die es im Bestand gibt, und dass
// die offene Hardwarefrage (S6) nur so lange als offen dasteht, wie OFFEN.md sie offen fuehrt.
describe("R-1864 · E — Egress-Abgleich nach Konzept §7", () => {
  const dokument = lies(DOKUMENT);

  it("E1: die Egress-Zeile ist abgeschlossen und unterscheidet Korrektur von Entscheidung", () => {
    expect(dokument).not.toContain("Bewertung, die dieses Dokument nicht trifft");
    expect(dokument).toContain("## Abgleich mit der Konzeptquelle");
    expect(dokument).toContain("## Egress-Abgleich");
    expect(dokument).toContain("schützt gegen **Egress, nicht gegen KI**");
    expect(dokument).toContain("**Korrektur, keine Entscheidung.**");
  });

  // Nachgeführt (Auftrag gesamt-ki-freigaberegeln, Ben Nacharbeit 2): Pedis Entscheidung vom 10.09.
  // lässt Vertrauliches mit der zweiten zentralen Adminfreigabe auch in den tiefen Zweig. Die
  // fehlende Dokumenteinwilligung sperrt unverändert immer — sie ist jetzt ein eigener Grund.
  it("E2: tiefer Zweig ohne Vertraulichkeit oder mit zweiter Adminfreigabe; ohne Dokumenteinwilligung nie", () => {
    const route = lies("services/app/src/routes/check-text-routes.ts");
    expect(route).toContain(
      "const deepAllowed = wantDeep && (!confidential || vertraulichFreigegeben);",
    );
    // Ben Nacharbeit 3: neben der fehlenden Einwilligung sperrt auch eine unbelegte Herkunft.
    expect(route).toContain(
      "const ausleitungGesperrt = (gebunden && !dokumentZustimmung) || herkunftUnbelegt;",
    );
    expect(route).toContain("const confidential = ausleitungGesperrt || eingestuftVertraulich;");
    expect(route).toMatch(/const vertraulichFreigegeben =\s*eingestuftVertraulich &&/);
    expect(route).toContain("await ka4Freigabe(");
  });

  it("E3: Zustimmung nur fuer extern, lokal ist intern, Satz vom 10.09. im Code", () => {
    const policy = lies("services/reasoner/src/klara-policy.ts");
    expect(policy).toContain('const externalConsentRequired = effectiveMode === "external";');
    expect(policy).toMatch(/case "local":\s*return "internal";/);
    expect(policy).toContain("Keine Freigabe, kein Egress");
    expect(lies("services/reasoner/src/model-client.ts")).toContain(
      "export function createLocalClientFromEnv(",
    );
    const app = lies("services/app/src/build-app.ts");
    expect(app).toContain('if (flag !== "1" && flag !== "true") {');
  });

  it("E4: S6 heisst im Dokument offen, solange OFFEN.md sie als Entscheidung fuehrt", () => {
    const kopf = "| S6 | ENTSCHEIDUNG | NACH-VORTEST | **Eine Maschine für ein hausinternes";
    const s6Offen = lies(OFFEN)
      .split("\n")
      .some((z) => z.startsWith(kopf));
    const dokumentSagtOffen = dokument.includes(
      "steht auf `ENTSCHEIDUNG`/`NACH-VORTEST`. Hier wird **nichts** entschieden",
    );
    expect(dokumentSagtOffen).toBe(s6Offen);
  });
});
