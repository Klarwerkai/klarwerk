// Derselbe DOM-Ausgang im Browser und im DOM-Gegenfall; keine PG-/Browser-Importkette.
export const ANKER_SPEICHERQUITTUNG = 'output[data-testid="toast-meldung"]';

export const AUSGANG = `() => {
  if (document.querySelector('[data-testid="bib-speichern"][aria-busy="true"]')) { return ""; }
  const lage = document.querySelector('[data-testid="bib-speichern-lage"]');
  if (lage) { return "lage:" + lage.getAttribute("data-lage"); }
  const fehler = document.querySelector('[data-testid="bib-speichern-fehler"]');
  if (fehler) { return "fehlerkasten: " + (fehler.textContent || "").trim().slice(0, 200); }
  const pflicht = document.querySelector('[data-testid="bib-einreichen-pflicht"]');
  if (pflicht) { return "einreichpflicht"; }
  const quittung = document.querySelector(${JSON.stringify(ANKER_SPEICHERQUITTUNG)});
  if (quittung) { return "quittung: " + (quittung.textContent || "").trim().slice(0, 120); }
  return "";
}`;
