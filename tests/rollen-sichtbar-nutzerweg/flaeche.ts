// ================================================================================================
// JOB 4326 · WAS EIN MENSCH WIRKLICH SIEHT — die Messgriffe dieses Ordners, an einer Stelle.
// ================================================================================================
//
// WARUM DIESE DATEI HIER STEHT UND NICHT IN `tests/gast-nutzerweg/`. Der Auftrag hält
// `browserweg.ts` und `strecke.ts` ausdrücklich unverändert (§4; JOB 4322 hält `browserweg.ts`).
// Die BROWSERHÜLLE wird deshalb IMPORTIERT (`starteChromium`, `profil`, `mitFlaeche`, `warte`,
// `fn`) — es entsteht keine zweite. Was hier dazukommt, sind genau die drei Griffe, die es dort
// nicht gibt und die dieser Auftrag braucht:
//
//   1. `sichtbarkeit` — SICHTBARKEIT statt Anwesenheit (REGELN.md 9). Gemessen wird
//      `Element.checkVisibility({checkOpacity, checkVisibilityCSS})` PLUS Textfarbe PLUS Kasten.
//      `querySelector !== null` und `textContent` sind ausdrücklich KEIN Nachweis; wo der Browser
//      `checkVisibility` nicht kennt, meldet der Befund das (`verfahren: "fehlt"`) statt still
//      „unsichtbar" zu behaupten — ein fehlendes Messverfahren ist keine Messung.
//   2. `textTraeger` — der Satz wird an dem Element gemessen, das ihn WIRKLICH TRÄGT (eigene
//      Textknoten), nicht am Container darum. REGELN.md 9: „Ein sichtbarer Container belegt nicht,
//      dass sein gesamter `innerText` sichtbar ist."
//   3. `amDraht` — der Versuch AUS DER SEITE HERAUS, mit den Keksen genau dieses Profils
//      (dasselbe Muster wie `browserweg.ts:489-491`, nur mit Methode und Rumpf).
//
// Gesucht wird IMMER über `textContent`, geurteilt IMMER über `checkVisibility`. Das ist Absicht:
// ein ausgeblendeter Knopf hat in Chromium ein leeres `innerText` — wer über `innerText` SUCHT,
// findet ihn nicht mehr und meldet „kein Knopf", statt „Knopf da, aber unsichtbar" zu unterscheiden.
// Genau diesen Unterschied braucht die Kalibrierung (Lieferung 5b).
import { type Seite, fn, warte } from "../gast-nutzerweg/browserweg";

/** Ein Fenster, auf dem das Kopfband seine Punkte wirklich zeigt (kein Drawer-Fall). */
export const BREIT = { width: 1440, height: 900 };

export interface Sichtbefund {
  /** Steht das Element im DOM? (Für sich genommen KEIN Nachweis.) */
  da: boolean;
  /** Sieht ein Mensch es? `checkVisibility` + Textfarbe + Kasten. */
  sichtbar: boolean;
  /** Der gerenderte Text (`innerText`), gekürzt — leer, wenn nichts zu sehen ist. */
  text: string;
  /** Woran es hing: „sichtbar" oder die Aufzählung der Gründe. Für Fehlermeldungen. */
  grund: string;
  /** „checkVisibility" — oder „fehlt", wenn dieser Browser das Verfahren nicht kennt. */
  verfahren: string;
}

/**
 * Der eine Urteilsspruch über EIN Element, als Quelltext für den Browser.
 *
 * Drei Gründe, die zusammen „unsichtbar" ergeben, jeder einzeln benannt:
 *   · `checkVisibility` deckt `display:none`, `visibility:hidden`, `opacity:0` und
 *     `content-visibility` — auch an jedem Vorfahren.
 *   · `color: transparent` deckt REGELM.md 9 („color: transparent" am texttragenden Element).
 *   · Ein Kasten von 0×0 deckt den eingeklappten Träger, den `checkVisibility` durchgehen lässt.
 */
const BEFUND_QUELLE = `function befund(e) {
  if (typeof e.checkVisibility !== "function") {
    return { da: true, sichtbar: false, text: "", grund: "dieser Browser kennt Element.checkVisibility nicht", verfahren: "fehlt" };
  }
  var stil = getComputedStyle(e);
  var kasten = e.getBoundingClientRect();
  var cssSichtbar = e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  var farbeWeg = stil.color === "transparent" || stil.color === "rgba(0, 0, 0, 0)";
  var flaeche = kasten.width > 0 && kasten.height > 0;
  var gruende = [];
  if (!cssSichtbar) { gruende.push("checkVisibility=false (display/visibility/opacity/content-visibility, eigene oder geerbte)"); }
  if (farbeWeg) { gruende.push("color=" + stil.color); }
  if (!flaeche) { gruende.push("Kasten " + Math.round(kasten.width) + "x" + Math.round(kasten.height)); }
  return {
    da: true,
    sichtbar: cssSichtbar && !farbeWeg && flaeche,
    text: String(e.innerText || "").trim().slice(0, 200),
    grund: gruende.length === 0 ? "sichtbar" : gruende.join(" · "),
    verfahren: "checkVisibility"
  };
}`;

const FEHLT: Sichtbefund = {
  da: false,
  sichtbar: false,
  text: "",
  grund: "kein Element zu diesem Selektor",
  verfahren: "checkVisibility",
};

const SICHTBARKEIT = `(sel) => {
  ${BEFUND_QUELLE}
  var e = document.querySelector(sel);
  if (!e) { return ${JSON.stringify(FEHLT)}; }
  return befund(e);
}`;

/** Sieht ein Mensch DIESES Element? */
export function sichtbarkeit(seite: Seite, selektor: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(SICHTBARKEIT), selektor);
}

/**
 * Das BEDIENELEMENT mit dieser Beschriftung — gesucht über `textContent`, geurteilt über
 * `checkVisibility`.
 *
 * `raum` grenzt auf eine Karte ein (z. B. `[data-testid="detail-papierkorb"]`), damit nicht ein
 * gleichnamiger Knopf einer Nachbarkarte den Nachweis trägt. Gibt es mehrere Treffer, entscheidet
 * der ERSTE SICHTBARE — und wenn keiner sichtbar ist, der erste überhaupt (dann trägt sein `grund`
 * die Auskunft, woran es lag).
 */
const KNOPF_MIT_TEXT = `([gesucht, raum]) => {
  ${BEFUND_QUELLE}
  var wurzel = raum ? document.querySelector(raum) : document.body;
  if (!wurzel) { return { da: false, sichtbar: false, text: "", grund: "der Raum " + raum + " steht nicht auf der Seite", verfahren: "checkVisibility" }; }
  var alle = Array.prototype.slice.call(wurzel.querySelectorAll('button, a[href], [role="button"], [role="menuitem"]'));
  var treffer = alle.filter(function (e) { return String(e.textContent || "").trim().indexOf(gesucht) >= 0; });
  if (treffer.length === 0) { return ${JSON.stringify(FEHLT)}; }
  var befunde = treffer.map(befund);
  var sichtbarer = befunde.filter(function (b) { return b.sichtbar; });
  return sichtbarer.length > 0 ? sichtbarer[0] : befunde[0];
}`;

export function knopfMitText(seite: Seite, text: string, raum?: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(KNOPF_MIT_TEXT), [text, raum ?? null]);
}

/**
 * Der Satz, gemessen an dem Element, das ihn WIRKLICH trägt.
 *
 * Gesammelt werden ausschliesslich Elemente, deren EIGENE Textknoten den Satz enthalten. Ein
 * Vorfahre, der ihn nur umschliesst, zählt nicht: sein `innerText` wäre der Text seines Kindes,
 * und ein ausgeblendetes Kind in einem sichtbaren Rahmen ergäbe sonst „sichtbar".
 */
const TEXT_TRAEGER = `(gesucht) => {
  ${BEFUND_QUELLE}
  var alle = Array.prototype.slice.call(document.querySelectorAll("*"));
  var traeger = alle.filter(function (e) {
    var eigen = "";
    for (var i = 0; i < e.childNodes.length; i += 1) {
      if (e.childNodes[i].nodeType === 3) { eigen += e.childNodes[i].textContent || ""; }
    }
    return eigen.trim().indexOf(gesucht) >= 0;
  });
  if (traeger.length === 0) { return { da: false, sichtbar: false, text: "", grund: "kein Element traegt diesen Satz in eigenen Textknoten", verfahren: "checkVisibility" }; }
  var befunde = traeger.map(befund);
  var sichtbare = befunde.filter(function (b) { return b.sichtbar; });
  return sichtbare.length > 0 ? sichtbare[0] : befunde[0];
}`;

/** Sieht ein Mensch DIESEN SATZ — an dem Element, das ihn trägt? */
export function textTraeger(seite: Seite, satz: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(TEXT_TRAEGER), satz);
}

export interface Drahtantwort {
  status: number;
  rumpf: string;
  /** Das Feld `error` des JSON-Rumpfs — oder „(kein JSON)". */
  error: string;
  /** Das Feld `message` des JSON-Rumpfs — oder "". */
  message: string;
}

/**
 * Der Versuch AM DRAHT, aus der Seite heraus — mit den Keksen genau dieses Profils.
 *
 * Dasselbe Muster wie `browserweg.ts:489-491` (`credentials: "include"`), nur mit Methode und
 * Rumpf. Der Weg muss AUS DER SEITE gehen und nicht aus dem Testprozess: nur so trägt er die
 * Sitzung, die die Anmeldung an DIESER Fläche gesetzt hat — ein Bearer aus dem Testprozess wäre
 * eine zweite Identität und bewiese über den Menschen nichts.
 */
const DRAHT = `([methode, route, rumpf]) => {
  var init = { method: methode, credentials: "include" };
  if (rumpf !== null) { init.headers = { "content-type": "application/json" }; init.body = rumpf; }
  return fetch(route, init).then(function (r) {
    return r.text().then(function (t) {
      var error = "(kein JSON)";
      var message = "";
      try { var j = JSON.parse(t); error = j && j.error !== undefined ? String(j.error) : "(kein Feld error)"; message = j && j.message !== undefined ? String(j.message) : ""; } catch (e) {}
      return { status: r.status, rumpf: String(t).slice(0, 2000), error: error, message: message };
    });
  }).catch(function (e) {
    return { status: -1, rumpf: "FETCH-FEHLER: " + String(e), error: "(kein JSON)", message: "" };
  });
}`;

export function amDraht(
  seite: Seite,
  methode: string,
  route: string,
  rumpf: Record<string, unknown> | null,
): Promise<Drahtantwort> {
  return seite.evaluate<Drahtantwort>(fn(DRAHT), [
    methode,
    route,
    rumpf === null ? null : JSON.stringify(rumpf),
  ]);
}

/**
 * Anmeldung über die ECHTE Maske — dieselben Selektoren wie `browserweg.ts:449-462`.
 *
 * Sie steht hier und nicht dort, weil `anmelden` in `browserweg.ts` nicht exportiert ist und der
 * Auftrag jene Datei unverändert lässt (§4). Die TASTATURBEDIENUNG ist hier ausdrücklich NICHT der
 * Gegenstand — sie ist in JOB 4223/4265 gemessen; gemessen wird hier, was eine ANGEMELDETE Rolle
 * sieht. Deshalb `fill` (es fokussiert das Feld) und ein echtes `Enter` auf dem Passwortfeld.
 */
export async function anmeldenAnDerMaske(
  seite: Seite,
  basis: string,
  email: string,
  passwort: string,
): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await seite.fill("#auth-email", email);
  await seite.fill("#auth-password", passwort);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
  );
}

/**
 * Das eine Bedienelement einer Tür — entweder über einen Selektor oder über seine Beschriftung.
 *
 * Zwei Formen, weil das Produkt zwei Formen hat: `[data-testid="detail-nutzer-neu"]` trägt eine
 * Kennung, „Endgültig löschen" im Papierkorb und „Demodaten laden" tragen keine. Die Beschriftung
 * kommt in beiden Fällen aus `i18n.ts` und wird nie abgeschrieben (§5.3: „den Sollwert liest du aus
 * `i18n.ts` … keine zweite Textquelle").
 */
export type Knopf =
  | { art: "selektor"; sel: string; name: string }
  | { art: "text"; text: string; raum?: string; name: string };

/** Sieht ein Mensch das Bedienelement dieser Tür? */
export function knopfBefund(seite: Seite, knopf: Knopf): Promise<Sichtbefund> {
  return knopf.art === "selektor"
    ? sichtbarkeit(seite, knopf.sel)
    : knopfMitText(seite, knopf.text, knopf.raum);
}

/**
 * Eine Tür aufrufen und warten, bis die Fläche ENTSCHIEDEN hat.
 *
 * Gewartet wird auf genau eines von dreien: das Bedienelement (Zugang), den Satz der Sperrkarte
 * (Sperre) oder die Anmeldemaske (anonym). Ein blosses `domcontentloaded` genügte nicht — die Rolle
 * kommt aus `/auth/me` (`RoleContext.tsx:45`), und bis sie da ist, zeigt `App.tsx:79` den Splash.
 * Wer in diesem Fenster misst, misst den Ladezustand und nicht die Rolle. Ebenso laden Papierkorb-
 * und Prüfliste ihre Einträge erst nach — der Knopf entsteht dann Sekundenbruchteile später.
 *
 * Läuft die Frist ab (weder Knopf noch Sperrkarte noch Maske), wirft `warte` mit dem Seitentext.
 * Das ist Absicht: ein Fall, der an einer dritten, unbekannten Lage still weiterliefe, würde
 * hinterher „kein Knopf" melden und damit eine Sperre behaupten, die er nie gemessen hat.
 */
export async function oeffneTuer(
  seite: Seite,
  url: string,
  knopf: Knopf,
  sperrsatz: string,
  was: string,
): Promise<void> {
  await seite.goto(url, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `([k, satz]) => {
      if (document.querySelector("#auth-email")) { return true; }
      if (String(document.body.innerText || "").indexOf(satz) >= 0) { return true; }
      if (k.art === "selektor") { return !!document.querySelector(k.sel); }
      var wurzel = k.raum ? document.querySelector(k.raum) : document.body;
      if (!wurzel) { return false; }
      var alle = Array.prototype.slice.call(wurzel.querySelectorAll('button, a[href], [role="button"], [role="menuitem"]'));
      return alle.some(function (e) { return String(e.textContent || "").indexOf(k.text) >= 0; });
    }`,
    `${was}: die Fläche hat entschieden (Bedienelement, Sperrkarte oder Anmeldemaske)`,
    [knopf, sperrsatz],
  );
}
