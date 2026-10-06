// ================================================================================================
// AUFNAHME gesamt-entwurf-einreichen (Ben Lauf :3 Runde 2, B3-R) — DIESELBE MESSUNG AN DER
// NORMALEN ÜBERSICHT `/entwuerfe`.
// ================================================================================================
//
// Ben: „Die vorhandene Chromium-Titelmessung untersucht die andere Blatt-Menüliste." Die Übersicht
// trug am Zeilenträger `truncate`; der Titel-`<span>` darin war inline und hätte für sich gemessen
// `clientWidth = 0` gezeigt. Gemessen wird deshalb der Titelträger UND sein Zeilenträger, und
// gemeldet wird der schlechtere der beiden — eine Kürzung am Behälter ist dieselbe Kürzung.
//
// Ben Lauf :3 Runde 3, B3-R2: `\\s` steht hier DOPPELT maskiert wie in `TITELMASSE`. Einfach
// geschrieben wurde daraus beim Auswerten `/s+/g`, und „Ausgabe“ kam als „Au gabe“ zurück. Das
// prüft `titelmasse-seite.test.ts` ohne Browser.
export const TITELMASSE_SEITE = `() => {
  const zeilen = [...document.querySelectorAll('[data-testid="page-entwuerfe"] [data-testid="entwurfsliste-eintrag"]')];
  return zeilen.map((z) => {
    const el = z.querySelector('[data-testid="entwurfsliste-eintrag-titel"]');
    const kandidaten = [el, el.parentElement];
    const masse = kandidaten.map((k) => {
      const stil = getComputedStyle(k);
      return {
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
        sichtbreite: k.clientWidth,
        textbreite: k.scrollWidth,
        sichthoehe: k.clientHeight,
        texthoehe: k.scrollHeight,
        umbruch: stil.whiteSpace,
        kuerzung: stil.textOverflow,
      };
    });
    const ueberhang = (m) => Math.max(m.textbreite - m.sichtbreite, m.texthoehe - m.sichthoehe);
    const ellipse = masse.find((m) => m.kuerzung === 'ellipsis');
    if (ellipse) {
      return ellipse;
    }
    return masse.reduce((a, b) => (ueberhang(b) > ueberhang(a) ? b : a));
  });
}`;
