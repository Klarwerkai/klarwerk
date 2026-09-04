// ================================================================================================
// JOB 3063 · H4 — DIE HANDGRIFFE AN DER GEMOUNTETEN BIBLIOTHEKS-FLÄCHE.
// ================================================================================================
//
// Die Bibliothek ist seit H4 eine Fläche aus Liste (links) und Lesefläche (rechts); Filter,
// Sortierung, Sichten und Export liegen in Menüs. Die gemounteten Tests dieses Ordners bedienen sie
// alle auf DIESELBE Weise — und damit es genau EINE Fassung dieser Handgriffe gibt (und nicht in
// fünfzehn Dateien fünfzehn leicht verschiedene), stehen sie hier.
//
// BEWUSST KEINE ZUSICHERUNGEN HIER DRIN: Diese Datei greift, sie urteilt nicht. Was richtig ist,
// entscheidet der jeweilige Test.
import { act } from "../../../apps/web/node_modules/react";
import i18n from "../../../apps/web/src/i18n";

/** Die Titel der Einträge in der LINKEN Liste — nicht der Titel auf der Lesefläche. */
export function zeilenTitel(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="bib-zeile"]')].map((z) =>
    (z.querySelector('[data-bib-text="zeile-titel"]')?.textContent ?? "").trim(),
  );
}

/** Die Kennung des gewählten Eintrags (die Zeile mit `aria-current`). */
export function gewaehlteId(container: HTMLElement): string | null {
  const z = container.querySelector('[data-testid="bib-zeile"][aria-current="true"]');
  return z?.getAttribute("data-bib-id") ?? null;
}

/** Der Titel auf der Lesefläche rechts. */
export function leseTitel(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="bib-titel"]')?.textContent?.trim() ?? null;
}

/**
 * Der Zähler im Listenfuß, als Zahl. `null`, wenn er „–" zeigt — das ist der ehrliche Zustand
 * „kein frischer Abruf", nicht die Zahl 0.
 */
export function listenZaehler(container: HTMLElement): number | null {
  const text = (container.querySelector('[data-testid="bib-fuss"]')?.textContent ?? "").trim();
  if (text === String(i18n.getResource("de", "translation", "lib.liste.eintraegeUnbekannt"))) {
    return null;
  }
  for (const form of ["lib.liste.eintraege_one", "lib.liste.eintraege_other"]) {
    const label = String(i18n.getResource("de", "translation", form));
    const hit = new RegExp(label.replace("{{count}}", "(\\d+)")).exec(text);
    if (hit?.[1]) {
      return Number(hit[1]);
    }
  }
  throw new Error(`Listenfuß nicht lesbar: „${text}"`);
}

/**
 * Ein Menü öffnen und ALLE Untermenüs darin aufklappen. Das Aufklappen ist nötig, weil die
 * Untermenüs `<details>` sind — im Browser klappt sie ein Klick auf, in jsdom setzt der Test das
 * Attribut direkt (dieselbe Wirkung, kein zweiter Weg).
 */
export function menueOeffnen(container: HTMLElement, testId: string): HTMLElement {
  const knopf = container.querySelector(`[data-testid="${testId}"]`);
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Menüknopf „${testId}" fehlt`);
  }
  if (knopf.getAttribute("aria-expanded") !== "true") {
    act(() => {
      knopf.click();
    });
  }
  const menue = knopf.parentElement?.querySelector('[role="menu"]');
  if (!(menue instanceof HTMLElement)) {
    throw new Error(`Menü „${testId}" hat sich nicht geöffnet`);
  }
  act(() => {
    for (const d of menue.querySelectorAll("details")) {
      d.open = true;
    }
  });
  return menue;
}

export function menueSchliessen(container: HTMLElement, testId: string): void {
  const knopf = container.querySelector(`[data-testid="${testId}"]`);
  if (knopf instanceof HTMLButtonElement && knopf.getAttribute("aria-expanded") === "true") {
    act(() => {
      knopf.click();
    });
  }
}

/** Die sichtbare Beschriftung eines Menüeintrags — ohne Haken und Pfeil (beide `aria-hidden`). */
export function eintragText(el: Element): string {
  return [...el.childNodes]
    .map((n) =>
      n.nodeType === 1 && (n as Element).getAttribute("aria-hidden") === "true"
        ? ""
        : (n.textContent ?? ""),
    )
    .join("")
    .trim();
}

/** Ein Eintrag im offenen Menü, gefunden über den Anfang seiner Beschriftung. */
export function menueEintrag(menue: HTMLElement, beschriftung: string): HTMLButtonElement {
  const treffer = [...menue.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].find(
    (e) => eintragText(e).startsWith(beschriftung),
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(
      `Menüeintrag „${beschriftung}" fehlt. Vorhanden: ${[
        ...menue.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]'),
      ]
        .map((e) => eintragText(e))
        .join(" · ")}`,
    );
  }
  return treffer;
}

/** Einen Facettenwert im Menü an- oder abwählen. `menue` ist der Testanker des Menüs. */
export function waehleImMenue(container: HTMLElement, testId: string, beschriftung: string): void {
  const menue = menueOeffnen(container, testId);
  const eintrag = menueEintrag(menue, beschriftung);
  act(() => {
    eintrag.click();
  });
  menueSchliessen(container, testId);
}

/** Ist ein Menüeintrag angehakt? Öffnet das Menü und lässt es offen. */
export function istGehakt(container: HTMLElement, testId: string, beschriftung: string): boolean {
  const menue = menueOeffnen(container, testId);
  return menueEintrag(menue, beschriftung).getAttribute("aria-checked") === "true";
}

/**
 * Die Zeile „Mehr" der Lesefläche aufklappen und einen ihrer dreizehn Abschnitte öffnen.
 *
 * Das `open`-Attribut allein genügt nicht: der Abschnitt zeichnet seinen Inhalt erst, wenn React
 * das Aufklappen MITBEKOMMT (`onToggle`) — und jsdom stellt das `toggle`-Ereignis in die
 * Warteschlange, statt es sofort zu liefern. Der Test schickt es deshalb selbst, direkt am
 * Element (`toggle` steigt nicht auf).
 */
export function abschnittOeffnen(container: HTMLElement, schluessel: string): HTMLElement {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (!(mehr instanceof HTMLButtonElement)) {
    throw new Error(`Zeile „Mehr" fehlt; DOM: ${container.textContent}`);
  }
  if (mehr.getAttribute("aria-expanded") !== "true") {
    act(() => {
      mehr.click();
    });
  }
  const abschnitt = container.querySelector(`[data-bib-abschnitt="${schluessel}"]`);
  if (!(abschnitt instanceof HTMLDetailsElement)) {
    throw new Error(`Abschnitt „${schluessel}" fehlt; DOM: ${container.textContent}`);
  }
  act(() => {
    abschnitt.open = true;
    abschnitt.dispatchEvent(new Event("toggle"));
  });
  return abschnitt;
}

/** Den Umschalter bedienen. */
export function segment(container: HTMLElement, wert: "alle" | "validiert" | "offen"): void {
  const knopf = container.querySelector(`[data-testid="bib-segment-${wert}"]`);
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Segment „${wert}" fehlt`);
  }
  act(() => {
    knopf.click();
  });
}

/**
 * Eine kontrollierte React-Eingabe treiben: der native value-Setter umgeht den Value-Tracker,
 * sonst schluckt React die Änderung (Repo-Muster, s. caption-form-mounted).
 */
export function tippe(el: HTMLInputElement, wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Ins Suchfeld der Bibliothek tippen. */
export function suche(container: HTMLElement, wert: string): void {
  const feld = container.querySelector('[data-testid="bib-suche"]');
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  tippe(feld, wert);
}
