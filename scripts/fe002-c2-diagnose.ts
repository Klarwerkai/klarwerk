// ================================================================================================
// FE-002 · DIAGNOSE DES C2-FEHLKLICKS (Lauf 3, Runde 4) — NUR MESSEN, NICHTS ÄNDERN.
// ================================================================================================
//
// ANLASS: Der Volllauf `pa-1790597147-03157850` am Kandidaten `7ed5ada0` war rot in genau einem Fall,
// `tests/wiki-orientierung/gliederung-mit-tastatur-chromium.test.ts` C2: der echte Mausklick,
// gezielt auf den Gliederungsknopf „Drei", kam als `click` an „EinsZwei" an. Die Einzelwiederholung
// am selben Commit war grün (Griff x=1000, y=377,2, Knopfhöhe 18,75 px). „EinsZwei" liegt zwei
// Zeilen über „Drei" — der Knopf muss sich zwischen Messung und Klick um rund 28–47 px nach UNTEN
// verschoben haben, oder etwas anderes hat den Klickpunkt verändert. Die Konsolenzeile mit dem
// Griff des roten Laufs ist in der gekürzten Vollausgabe NICHT erhalten; die Lage lässt sich aus
// den Belegen allein nicht bestimmen.
//
// WAS DIESES SKRIPT MISST — derselbe Weg wie C2, dieselbe Vorrichtung (`tests/design/h4-harness.ts`),
// derselbe Bestand (`VERSCHACHTELT_LANG`), derselbe Klick (`zeigerKlick`), je Durchlauf frisch geladen:
//   1. SCHICHTVERSCHIEBUNGEN: `PerformanceObserver` vom Typ `layout-shift` ab Seitenstart, mit den
//      verschobenen Elementen (`sources`: Knoten, vorher/nachher). So steht da, WAS die Leiste
//      bewegt hat — und ob es aus dem Kopfband (FE-002) kam.
//   2. DIE LAGE VON „Drei" je Bildaufbau, von „Leiste im Baum" bis 3 s danach.
//   3. DIE STUFE DES KOPFBANDS (`data-stufe`, FE-002) und die Höhe des Kopfbands je Wechsel.
//   4. DER KLICK SELBST: Griff, Zeitpunkt (Seitenzeit) und wo `pointerdown`/`click` ankamen.
// Bewertet wird nichts; der Bericht nennt je Durchlauf die Rohwerte und fasst zusammen.
//
// NICHT TEIL VON `tools/check`: die Datei liegt unter `scripts/`, ausserhalb der Vitest-Sammlung
// (`vitest.config.ts`, BESTAND_INCLUDE). Sie ändert weder Produkt noch bestehende Tests.
//
// AUFRUF (braucht `apps/web/dist` und Playwright-Chromium; ein Browser):
//   ./tools/build
//   ./tools/browserdeckel.sh browser npx tsx scripts/fe002-c2-diagnose.ts \
//       --durchlaeufe 30 --bericht <pfad>/fe002-c2-diagnose.json
// Dieselbe Testumgebung wie jeder Vitest-Lauf (`vitest.config.ts`, setupFiles) — ZUERST, vor dem
// Laden der App: Selbstregistrierung an, externe Suche aus, Protokoll still.
import "../tests/setup-env";
import { writeFileSync } from "node:fs";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../tests/design/h4-harness";
import { VERSCHACHTELT_LANG, zeigerKlick } from "../tests/wiki-orientierung/gliederung-zeiger";

/** Vor jedem Seitenaufbau: die Aufzeichnung in der Seite (lebt nur in dieser Seite). */
const AUFZEICHNUNG = `(() => {
  const jetzt = () => Math.round(performance.now() * 10) / 10;
  const name = (n) => {
    if (!n || !n.tagName) return n && n.nodeName ? n.nodeName : '(unbekannt)';
    const id = n.getAttribute && n.getAttribute('data-testid');
    const kl = typeof n.className === 'string' ? n.className.split(' ').filter((k) => k.startsWith('kw-')).join('.') : '';
    return n.tagName + (id ? '#' + id : '') + (kl ? '.' + kl : '') +
      ' „' + (n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50) + '“';
  };
  const imKopf = (n) => !!(n && n.closest && n.closest('header[data-testid="kopfband"]'));
  const rund = (x) => Math.round(x * 10) / 10;
  const rechteck = (r) => r ? { top: rund(r.top), bottom: rund(r.bottom), left: rund(r.left), right: rund(r.right), height: rund(r.height) } : null;
  const log = { verschiebungen: [], stufen: [], drei: [], leisteAb: null, pointerdownAb: null, einfuegungen: [] };
  // Der Zeitpunkt, an dem der Zeiger wirklich ankam (erste echte Zeigerberührung dieser Seite).
  document.addEventListener('pointerdown', (e) => { if (log.pointerdownAb === null && e.isTrusted) log.pointerdownAb = jetzt(); }, true);
  // WAS eingefügt wurde, das den Leseblock verschieben kann: jedes neue Element mit Höhe, ausserhalb
  // des Kopfbands, bis 3 s nach „Leiste im Baum" — mit Lage und Höhe im Moment des Einfügens.
  new MutationObserver((liste) => {
    if (log.leisteAb !== null && jetzt() - log.leisteAb > 3000) return;
    for (const m of liste) {
      for (const k of m.addedNodes) {
        if (!k.tagName || imKopf(k)) continue;
        const r = k.getBoundingClientRect();
        if (r.height <= 0) continue;
        log.einfuegungen.push({ t: jetzt(), knoten: name(k), eltern: name(k.parentElement), lage: rechteck(r) });
      }
    }
  }).observe(document, { childList: true, subtree: true });
  window.__fe002Diagnose = log;
  try {
    new PerformanceObserver((liste) => {
      for (const e of liste.getEntries()) {
        log.verschiebungen.push({
          t: Math.round(e.startTime * 10) / 10,
          wert: Math.round(e.value * 10000) / 10000,
          nachEingabe: e.hadRecentInput,
          quellen: (e.sources || []).map((q) => ({
            knoten: name(q.node),
            imKopfband: imKopf(q.node),
            vorher: rechteck(q.previousRect),
            nachher: rechteck(q.currentRect),
          })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) {
    log.verschiebungen.push({ fehler: String(err) });
  }
  const beobachteKopf = () => {
    const gruppe = document.querySelector('.kw-kopfband-rechts');
    const kopf = document.querySelector('header[data-testid="kopfband"]');
    if (!gruppe || !kopf) { requestAnimationFrame(beobachteKopf); return; }
    const merke = () => log.stufen.push({ t: jetzt(), stufe: gruppe.getAttribute('data-stufe'), kopfHoehe: Math.round(kopf.getBoundingClientRect().height * 10) / 10 });
    merke();
    new MutationObserver(merke).observe(gruppe, { attributes: true, attributeFilter: ['data-stufe'] });
  };
  const folgeDrei = () => {
    const leiste = document.querySelector('[data-testid="bib-gliederung"]');
    if (leiste) {
      if (log.leisteAb === null) log.leisteAb = jetzt();
      const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
      const r = knopf ? knopf.getBoundingClientRect() : null;
      const letzte = log.drei[log.drei.length - 1];
      const top = r ? Math.round(r.top * 10) / 10 : null;
      if (!letzte || letzte.top !== top) log.drei.push({ t: jetzt(), top, scrollY: window.scrollY });
      if (jetzt() - log.leisteAb > 3000) return;
    }
    requestAnimationFrame(folgeDrei);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { beobachteKopf(); folgeDrei(); });
  } else { beobachteKopf(); folgeDrei(); }
})()`;

interface Knopflage {
  t: number;
  top: number | null;
  scrollY: number;
}
interface Aufzeichnung {
  verschiebungen: Array<{
    t: number;
    wert: number;
    nachEingabe: boolean;
    quellen: Array<{
      knoten: string;
      imKopfband: boolean;
      vorher: { top: number; bottom: number; left: number; right: number; height: number } | null;
      nachher: { top: number; bottom: number; left: number; right: number; height: number } | null;
    }>;
  }>;
  stufen: Array<{ t: number; stufe: string | null; kopfHoehe: number }>;
  drei: Knopflage[];
  leisteAb: number | null;
  pointerdownAb: number | null;
  einfuegungen: Array<{ t: number; knoten: string; eltern: string; lage: unknown }>;
}

function argument(name: string, vorgabe: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : vorgabe;
}

async function main(): Promise<void> {
  const durchlaeufe = Number(argument("durchlaeufe", "30"));
  const bericht = argument("bericht", "fe002-c2-diagnose.json");
  let stand: H4Stand | null = null;
  const ergebnisse: Array<Record<string, unknown>> = [];
  try {
    // Derselbe Bestand wie C2 (`gliederung-mit-tastatur-chromium.test.ts:162-199`, erster Eintrag).
    stand = await h4Stand("/wissen/:frei", "pedi@fe002-diagnose.test", async (z) => {
      await z.services.ko.revise(z.freiId, { bodyHtml: VERSCHACHTELT_LANG }, z.autorId);
    });
    const s = stand.seite;
    await s.addInitScript(AUFZEICHNUNG);
    for (let i = 1; i <= durchlaeufe; i++) {
      // Wie `frisch()` in C2: laden, auf die Leiste warten, sofort klicken.
      await s.goto(`${ORIGIN}/wissen/${stand.koId}`, { waitUntil: "load", timeout: 60_000 });
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="bib-gliederung"]')`),
        undefined,
        { timeout: 30_000 },
      );
      const tVor = await s.evaluate<number>(fn("() => performance.now()"));
      let klick: unknown;
      let klickFehler: string | null = null;
      try {
        klick = await zeigerKlick(s, "Drei");
      } catch (e) {
        klickFehler = String(e).split("\n")[0] ?? "";
      }
      const tNach = await s.evaluate<number>(fn("() => performance.now()"));
      // Die Aufzeichnung läuft bis 3 s nach „Leiste im Baum" weiter — dann abholen.
      await s.waitForTimeout(3200);
      const a = await s.evaluate<Aufzeichnung>(fn("() => window.__fe002Diagnose"));
      // Das Klickfenster: vom Beginn der Griffmessung bis zur ersten echten Zeigerberührung.
      const klickAb = a.pointerdownAb ?? tNach;
      const imFenster = a.drei.filter((d) => d.t >= tVor && d.t <= klickAb);
      const vorFenster = a.drei.filter((d) => d.t < tVor);
      const topBeimGriff =
        vorFenster.length > 0 ? (vorFenster[vorFenster.length - 1]?.top ?? null) : null;
      const klickTreffer = (
        (klick as { ereignisse?: Array<{ art: string; knopf: string }> } | undefined)?.ereignisse ??
        []
      ).map((e) => `${e.art}:${e.knopf}`);
      // Lag der Griff auf der Lage, die „Drei" beim Zeigerdruck wirklich hatte? Abweichung in px
      // zwischen Griff-Mittelpunkt und Knopfmitte im letzten Bild vor `pointerdown`.
      const griff = (klick as { griff?: { y: number; hoehe: number } } | undefined)?.griff;
      const beimDruck = a.drei.filter((d) => d.t <= klickAb).pop();
      const griffAbweichungPx =
        griff && beimDruck?.top != null
          ? Math.round((griff.y - (beimDruck.top + griff.hoehe / 2)) * 10) / 10
          : null;
      const nachLeiste = a.verschiebungen.filter((v) => a.leisteAb !== null && v.t >= a.leisteAb);
      ergebnisse.push({
        durchlauf: i,
        leisteAb: a.leisteAb,
        griffBisKlick: {
          von: Math.round(tVor),
          pointerdown: a.pointerdownAb,
          bis: Math.round(tNach),
        },
        topDreiBeimGriff: topBeimGriff,
        griffAbweichungPx,
        bewegungDreiZwischenGriffUndKlick: imFenster,
        klickFehler,
        klick,
        klickTreffer,
        fehlklick: klickFehler === null && !klickTreffer.includes("click:Drei"),
        verschiebungenNachLeiste: nachLeiste,
        einfuegungenNachLeiste: a.einfuegungen.filter(
          (x) => a.leisteAb !== null && x.t >= a.leisteAb - 50,
        ),
        verschiebungenAusDemKopfband: a.verschiebungen.filter((v) =>
          v.quellen?.some((q) => q.imKopfband),
        ),
        kopfbandStufen: a.stufen,
        dreiVerlauf: a.drei,
      });
      console.info(
        `FE-002 C2-Diagnose · ${i}/${durchlaeufe} · Treffer ${klickTreffer.join(",") || klickFehler} · Verschiebungen nach Leiste ${nachLeiste.length} · Drei bewegt im Klickfenster ${imFenster.length}`,
      );
    }
  } finally {
    const zusammenfassung = {
      durchlaeufe: ergebnisse.length,
      fehlklicks: ergebnisse.filter((e) => e.fehlklick).length,
      klickFehler: ergebnisse.filter((e) => e.klickFehler !== null).length,
      mitVerschiebungNachLeiste: ergebnisse.filter(
        (e) => (e.verschiebungenNachLeiste as unknown[]).length > 0,
      ).length,
      mitVerschiebungAusDemKopfband: ergebnisse.filter(
        (e) => (e.verschiebungenAusDemKopfband as unknown[]).length > 0,
      ).length,
      griffAufVeralteterLage: ergebnisse.filter(
        (e) => typeof e.griffAbweichungPx === "number" && Math.abs(e.griffAbweichungPx) > 1,
      ).length,
      mitBewegungImKlickfenster: ergebnisse.filter(
        (e) => (e.bewegungDreiZwischenGriffUndKlick as unknown[]).length > 0,
      ).length,
      // Welche Elemente nach „Leiste im Baum" eingefügt wurden, und wie oft (über alle Durchläufe).
      einfuegungenNachLeiste: Object.entries(
        ergebnisse
          .flatMap((e) =>
            (e.einfuegungenNachLeiste as Array<{ knoten: string }>).map((x) => x.knoten),
          )
          .reduce<Record<string, number>>((z, k) => {
            z[k] = (z[k] ?? 0) + 1;
            return z;
          }, {}),
      ),
      kopfbandHoehen: [
        ...new Set(
          ergebnisse.flatMap((e) =>
            (e.kopfbandStufen as Array<{ kopfHoehe: number }>).map((k) => k.kopfHoehe),
          ),
        ),
      ],
    };
    writeFileSync(
      bericht,
      `${JSON.stringify(
        {
          erzeugt: new Date().toISOString(),
          chromium: stand?.version ?? null,
          seitenfehler: stand?.seitenfehler ?? [],
          zusammenfassung,
          ergebnisse,
        },
        null,
        2,
      )}\n`,
    );
    console.info(`FE-002 C2-Diagnose · Zusammenfassung ${JSON.stringify(zusammenfassung)}`);
    console.info(`FE-002 C2-Diagnose · Bericht ${bericht}`);
    await stand?.browser.close();
    await stand?.app.close();
  }
}

main().catch((e) => {
  console.error(`FE-002 C2-Diagnose · abgebrochen: ${String(e)}`);
  process.exit(1);
});
