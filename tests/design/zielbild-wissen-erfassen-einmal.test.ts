// @vitest-environment jsdom
// ================================================================================================
// JOB 2620 · D5/D6 — EINE BILDER-AUSSAGE, NICHT ZWEI: der Inhaltsfall gegen die echte taskpane.html,
// und zwar SINNGLEICH, nicht wortgleich.
// ================================================================================================
//
// PEDIS FRAGE: „Steht der Bilder-Hinweis jetzt wirklich nur einmal da — auch wenn ihn jemand beim
// naechsten Mal anders formuliert?"
//
// BEN an D5: „Ein Regex auf Bild, image oder afbeelding gilt nicht als semantischer Nachweis.
// Belege je Sprache zusaetzlich mit einer sinngleichen Gegenmutation ohne diesen Wortstamm, dass
// eine zweite Aussage erkannt wird." — und: ein Satz, der etwas ANDERES ueber Bilder sagt, ist
// keine Doppelung.
//
// DAS VERFAHREN (in einem Satz): Ein gepflegter Begriffsraum je Sprache — die Aussage des Kastens
// („Bilder werden von Word (nicht) uebergeben/uebernommen") ist SINNGLEICH doppelt, wenn ein
// weiterer SATZ des sichtbaren Tab-2-Texts zugleich einen BILD-Begriff (Bild, Foto, Grafik,
// Abbildung, Illustration, Zeichnung, Screenshot …) und ein UEBERGABE-Praedikat (uebernehmen,
// uebergeben, hergeben, herausgeben, mitkommen, ankommen, liefern, fehlen …) traegt.
// DIE GRENZE (in einem Satz): Erkannt wird nur, was im Begriffsraum steht — ein neues Wort
// („Visuals", „Bildmaterial") muss nachgepflegt werden, Verneinung und Satzstellung werden nicht
// verstanden, und ein Satz ueber Bilder OHNE Uebergabe-Praedikat („Fotos sollten scharf sein")
// gilt absichtlich NICHT als Doppelung.
//
// WIE GEMESSEN WIRD — an der Stelle, wo der Mensch liest: das AUSGELIEFERTE Aufgabenfenster
// (apps/web/public/word-addin/taskpane.html: Markup + Skript, ausgefuehrt in jsdom ueber
// tests/app/klara-panel-fixture.ts), je Sprache `setLang`, Tab 2 (`setTab("capture")`), dann der
// Text von `#section-capture` (ohne den Kasten `#capture-bilder-hinweis`) und der Hilfe-Karte
// (`[data-t=helpCan1]` … `helpNot2`), SATZWEISE. Der Kasten selbst muss die Aussage tragen.
//
// JE SPRACHE EINE EIGENE ASSERTION — eine Gegenmutation in einer Sprache kippt genau ihren Fall.
// Die Kalibrierfaelle (K) arbeiten auf Zeichenketten und haengen nicht an der Produktdatei.
import { describe, expect, it } from "vitest";
import { createKlaraPanel } from "../app/klara-panel-fixture";

interface Begriffsraum {
  code: string;
  name: string;
  /** BILD-Begriffe (Wortstaemme, Wortgrenze links, beliebige Endung). */
  bild: RegExp;
  /** UEBERGABE-Praedikate — was Word mit den Bildern tut oder nicht tut. */
  uebergabe: RegExp;
}

/**
 * Ein Wort aus dem Begriffsraum, an UNICODE-Wortgrenzen. JavaScripts `\b` kennt nur ASCII —
 * vor „übernommen" oder nach „Foto's" gaebe es damit keine Grenze, und ein Umlautwort fiele
 * still durch (gemessen in D6: „Fotos werden nicht übernommen." blieb mit `\b` unerkannt).
 */
function wort(alternativen: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternativen})(?![\\p{L}\\p{N}])`, "iu");
}

const BEGRIFFSRAUM: readonly Begriffsraum[] = [
  {
    code: "de",
    name: "DE",
    bild: wort(
      "bild(er|ern|es)?|foto(s|grafie|grafien)?|grafik(en)?|abbildung(en)?|illustration(en)?|zeichnung(en)?|screenshot(s)?|bildschirmfoto(s)?",
    ),
    uebergabe: wort(
      "(ue|ü)bernommen|(ue|ü)bernimmt|(ue|ü)bernehmen|(ue|ü)bergeben|(ue|ü)bergibt|hergibt|herausgibt|heraus|mitkommen|komm(en|t) .{0,30}(mit|an)|ankommen|liefert|geliefert|fehlen|fehlt|mitgenommen|weitergegeben|ausgelassen|verloren",
    ),
  },
  {
    code: "en",
    name: "EN",
    bild: wort(
      "images?|pictures?|photos?|photographs?|graphics?|figures?|illustrations?|drawings?|screenshots?",
    ),
    uebergabe: wort(
      "provided?|provides|handed over|hands over|carried over|carries over|transferred|transfers|arrives?|included|includes|delivered|delivers|missing|omitted|lost|dropped|comes? .{0,20}with",
    ),
  },
  {
    code: "nl",
    name: "NL",
    bild: wort(
      "afbeelding(en)?|foto'?s?|plaatje(s)?|figu(u)?r(en)?|illustratie(s)?|tekening(en)?|schermafbeelding(en)?|prent(en)?",
    ),
    uebergabe: wort(
      "overgenomen|overneemt|overnemen|geleverd|levert|leveren|meekomen|kom(en|t) .{0,30}(mee|aan)|vrijgeeft|vrijgegeven|vrij|aankomen|ontbreken|ontbreekt|doorgegeven|weggelaten|verloren",
    ),
  },
];

/** Saetze eines sichtbaren Texts — geteilt an Satzzeichen, Leerraum eingedampft. */
function saetze(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Die SINNGLEICHEN Bilder-Aussagen eines Texts: Saetze mit Bild-Begriff UND Uebergabe-Praedikat. */
function bilderAussagen(text: string, raum: Begriffsraum): string[] {
  return saetze(text).filter((s) => raum.bild.test(s) && raum.uebergabe.test(s));
}

const raumFuer = (code: string): Begriffsraum => {
  const r = BEGRIFFSRAUM.find((b) => b.code === code);
  if (!r) throw new Error(`kein Begriffsraum fuer ${code}`);
  return r;
};

// ================================================================================================
// K · KALIBRIERUNG DES VERFAHRENS — auf Zeichenketten, unabhaengig von der Produktdatei.
// ================================================================================================
describe("JOB 2620 · D6 · das Verfahren erkennt Sinngleiches und laesst Anderes durch", () => {
  const DOPPELT: Record<string, string> = {
    de: "Fotos werden nicht übernommen.",
    en: "Photos are not carried over.",
    nl: "Foto's komen niet mee.",
  };
  const ANDERES: Record<string, string> = {
    de: "Fotos sollten mindestens 300 dpi haben.",
    en: "Photos should have at least 300 dpi.",
    nl: "Foto's moeten minstens 300 dpi hebben.",
  };
  for (const r of BEGRIFFSRAUM) {
    it(`K-${r.name} · eine sinngleiche zweite Aussage OHNE den Wortstamm wird erkannt: „${DOPPELT[r.code]}"`, () => {
      const stamm = { de: /bild/i, en: /image/i, nl: /afbeelding/i }[r.code] as RegExp;
      expect(stamm.test(DOPPELT[r.code] ?? "")).toBe(false); // wirklich ohne den Wortstamm
      expect(bilderAussagen(DOPPELT[r.code] ?? "", r)).toEqual([DOPPELT[r.code]]);
    });
    it(`K-${r.name} · GEGENPROBE ZUR GEGENPROBE: ein Satz, der etwas ANDERES ueber Bilder sagt, geht durch: „${ANDERES[r.code]}"`, () => {
      expect(r.bild.test(ANDERES[r.code] ?? "")).toBe(true); // er spricht von Bildern …
      expect(bilderAussagen(ANDERES[r.code] ?? "", r)).toEqual([]); // … sagt aber nichts ueber die Uebergabe
    });
  }
});

// ================================================================================================
// DER INHALTSFALL — gegen die ECHTE taskpane.html, je Sprache eine Assertion.
// ================================================================================================
describe("JOB 2620 · D6 · Tab 2 traegt die Bilder-Aussage genau einmal — sinngleich, an der echten taskpane.html", () => {
  for (const r of BEGRIFFSRAUM) {
    it(`${r.name} · #capture-bilder-hinweis traegt die Bilder-Aussage; kein weiterer Satz in Tab 2 sagt Sinngleiches`, async () => {
      const panel = createKlaraPanel({ withOffice: true });
      try {
        await panel.flush();
        panel.setLang(r.code);
        panel.setTab("capture");
        const kasten = panel.text("#capture-bilder-hinweis");
        const abschnitt = panel.text("#section-capture");
        const hilfe = ["helpCan1", "helpCan2", "helpCan3", "helpNot1", "helpNot2"]
          .map((k) => panel.q(`[data-t="${k}"]`)?.textContent ?? "")
          .join("\n");
        const uebrig = `${abschnitt.replace(kasten, "")}\n${hilfe}`;
        const belege = {
          kasten: bilderAussagen(kasten, raumFuer(r.code)),
          uebrig: bilderAussagen(uebrig, raumFuer(r.code)),
        };
        console.info(
          `JOB 2620 D6 · ${r.name} · Kasten: ${JSON.stringify(belege.kasten)} · uebriger Tab-2-Text (sinngleiche Saetze): ${JSON.stringify(belege.uebrig)}`,
        );
        // (1) Der Kasten traegt die Aussage — Selektor #capture-bilder-hinweis, gefundene Saetze:
        expect(
          belege.kasten.length,
          `${r.name}: der Kasten traegt keine Bilder-Aussage (Text: ${kasten.trim().slice(0, 80)})`,
        ).toBeGreaterThan(0);
        // (2) Sonst kein sinngleicher Satz in Tab 2 — #section-capture ohne den Kasten (trifft
        //     sendHint, Karte, Umfangs-Wahl, Hinweise) und die Hilfe-Karte:
        expect(
          belege.uebrig,
          `${r.name}: die Bilder-Aussage steht in Tab 2 ein zweites Mal — sinngleiche Saetze`,
        ).toEqual([]);
      } finally {
        await panel.flush();
        panel.restore();
      }
    });
  }
});
