// BPA-03 · Der Seitenausführer für berechtigte Browseraktionen (produkt:20261011:assistenz-browser-aktionen).
//
// Läuft in Chromes isolierter Welt und nur auf ausdrücklichen Aufruf aus einem bestehenden
// Auftrag: kein Seitenlistener, keine eigene Anfrage, kein Zugriff auf die Sitzung der Erweiterung.
// Er entscheidet NICHTS. Was erlaubt ist, steht im Register und im Auftrag am Server
// (`services/app/src/klara-browser-aktion.ts`); hier wird nur gelesen, eingetragen und geklickt —
// und jedes Mal zuerst geprüft, ob das Formular noch denselben Aufbau hat.
//
// SEMANTISCH, NICHT NACH KOORDINATEN: Formulare über ihren zugänglichen Namen, Felder über ihre
// Beschriftung, Knöpfe über ihren Namen. Eine Beschriftung, die fehlt oder doppelt ist, ist eine
// Klärung — nie ein Griff nach dem „ähnlichsten" Feld. Ein `title` (Tooltip) ist Seiteninhalt und
// wird nie als Name gelesen.
//
// GEHEIMNISSE: Kennwort-, Einmalcode- und Dateifelder werden weder gelesen noch gefüllt; ihr Wert
// verlässt die Seite nie. CAPTCHA, MFA und Anmeldung werden nur erkannt und gemeldet.
(() => {
  if ("KlaraBrowserAktion" in globalThis) return;
  const FASSUNG = "aktion.js@1.0.0";
  const MAX_WERT = 4000;
  const MAX_EINTRAG = 500;
  const geseheneWerte = new WeakMap();
  const freigegebeneWerte = new WeakMap();

  /** @param {unknown} s */
  const norm = (s) =>
    String(s ?? "")
      .replace(/\s+/g, " ")
      .trim();

  /** Text eines Knotens ohne den Text eingebetteter Steuerelemente. @param {Node} knoten */
  function textOhneSteuerung(knoten) {
    let text = "";
    for (const kind of Array.from(knoten.childNodes)) {
      if (kind.nodeType === Node.TEXT_NODE) {
        text += kind.textContent ?? "";
      } else if (kind instanceof Element && !kind.matches("input, textarea, select, button")) {
        text += textOhneSteuerung(kind);
      }
    }
    return text;
  }

  /** @param {Element} el */
  function ueberIds(el) {
    const ids = el.getAttribute("aria-labelledby");
    if (!ids) return null;
    return norm(
      ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
  }

  /** Der zugängliche Name — bewusst ohne `title`. @param {Element} el */
  function name(el) {
    const ueber = ueberIds(el);
    if (ueber) return ueber;
    const aria = el.getAttribute("aria-label");
    if (aria) return norm(aria);
    if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button")) {
      return norm(el.value);
    }
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return norm(
        Array.from(el.labels ?? [])
          .map(textOhneSteuerung)
          .join(" "),
      );
    }
    return norm(textOhneSteuerung(el));
  }

  /** Formulare tragen ihren Namen nur über ARIA. @param {Element} el */
  function formName(el) {
    return ueberIds(el) ?? norm(el.getAttribute("aria-label"));
  }

  /** @param {Element} el */
  function sichtbar(el) {
    return el instanceof HTMLElement && !el.hidden && el.getClientRects().length > 0;
  }

  /** @param {string} formular */
  function formulare(formular) {
    return Array.from(document.querySelectorAll("form")).filter((f) => formName(f) === formular);
  }

  const OHNE_WERT = ["hidden", "submit", "button", "reset", "image"];

  /** @typedef {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} Steuerelement */

  /** @param {HTMLFormElement} f */
  function felder(f) {
    const alle = /** @type {Steuerelement[]} */ (
      Array.from(f.querySelectorAll("input, textarea, select"))
    );
    return alle.filter(
      (el) => !(el instanceof HTMLInputElement && OHNE_WERT.includes(el.type)) && sichtbar(el),
    );
  }

  /** @param {HTMLFormElement} f */
  function knoepfe(f) {
    const alle = /** @type {HTMLElement[]} */ (
      Array.from(f.querySelectorAll("button, input[type='submit'], input[type='button']"))
    );
    return alle.filter(sichtbar);
  }

  /** @param {Element} el */
  function typ(el) {
    return el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
  }

  /** Kennwort, Einmalcode, Datei: nie lesen, nie füllen. @param {Element} el */
  function gesperrt(el) {
    return (
      el instanceof HTMLInputElement &&
      (el.type === "password" ||
        el.type === "file" ||
        /^(?:cc-|current-password|new-password|one-time-code)/i.test(
          el.getAttribute("autocomplete") ?? "",
        ) ||
        /\b(?:kennwort|passwort|password|pin|tan|otp|cvc|cvv|pr[üu]fziffer|kartennummer|card\s*number)\b/i.test(
          name(el),
        ))
    );
  }

  /** @param {Element} el */
  function inaktiv(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.disabled || el.readOnly;
    }
    if (el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) return el.disabled;
    return false;
  }

  /** Zwei FNV-1a-Durchläufe (64 Bit) über eine Zeichenkette. @param {string} text */
  function hash(text) {
    let a = 0x811c9dc5;
    let b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }

  /** Fingerabdruck des AUFBAUS — Namen, Typen, Feldnamen, Knöpfe; keine Werte. @param {HTMLFormElement} f */
  function fingerabdruck(f) {
    const teile = [
      formName(f),
      ...felder(f).map((el) => `${name(el)}|${typ(el)}|${el.getAttribute("name") ?? ""}`),
      "#",
      ...knoepfe(f).map(name),
    ];
    return hash(teile.join("\n"));
  }

  function hindernisse() {
    /** @type {string[]} */
    const gefunden = [];
    const captcha = document.querySelector(
      ".g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey], iframe[src*='recaptcha'], iframe[src*='hcaptcha'], iframe[src*='turnstile'], iframe[title*='captcha' i]",
    );
    if (captcha) gefunden.push("captcha");
    const code = Array.from(document.querySelectorAll("input[autocomplete='one-time-code']"));
    if (code.some(sichtbar)) gefunden.push("mfa");
    const kennwort = Array.from(document.querySelectorAll("input[type='password']"));
    if (kennwort.some(sichtbar)) gefunden.push("anmeldung");
    return gefunden;
  }

  /** @param {{ name: string, kennung: string }} liste */
  function listen(liste) {
    if (!/^data-[a-z0-9-]{1,40}$/.test(liste.kennung)) return [];
    return Array.from(document.querySelectorAll("ul, ol, [role='list']")).filter(
      (el) => norm(el.getAttribute("aria-label")) === liste.name,
    );
  }

  /** @param {{ name: string, kennung: string }} liste */
  function eintraege(liste) {
    const treffer = listen(liste);
    if (treffer.length !== 1) return [];
    return Array.from(treffer[0].querySelectorAll(`[${liste.kennung}]`)).map((el) => ({
      id: el.getAttribute(liste.kennung) ?? "",
      text: norm(textOhneSteuerung(el)).slice(0, MAX_EINTRAG),
    }));
  }

  /** Das Formular nur, wenn es genau einmal da ist UND denselben Aufbau hat. @param {string} formular @param {string} abdruck */
  function gebunden(formular, abdruck) {
    const treffer = formulare(formular);
    if (treffer.length !== 1) return null;
    return fingerabdruck(treffer[0]) === abdruck ? treffer[0] : null;
  }

  /**
   * Über den nativen Setter, damit auch Seiten mit eigener Zustandshaltung den Wert sehen.
   * @param {Steuerelement} el
   * @param {string} wert
   */
  function setze(el, wert) {
    const art =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement
          : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(art.prototype, "value")?.set;
    el.focus();
    if (setter) {
      setter.call(el, wert);
    } else {
      el.value = wert;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const api = {
    fassung: FASSUNG,

    /** @param {{ formular: string, liste: { name: string, kennung: string } | null, lesefreigabe?: string }} a */
    lage(a) {
      const treffer = formulare(a.formular);
      const f = treffer.length === 1 ? treffer[0] : null;
      if (f) for (const el of felder(f)) geseheneWerte.set(el, String(el.value));
      return {
        origin: location.origin,
        pfad: location.pathname,
        hindernisse: hindernisse(),
        formularTreffer: treffer.length,
        formular: f
          ? {
              name: a.formular,
              fingerabdruck: fingerabdruck(f),
              felder: felder(f).map((el) => ({
                label: name(el),
                typ: typ(el),
                wert:
                  typeof a.lesefreigabe === "string" &&
                  freigegebeneWerte.get(el)?.freigabe === a.lesefreigabe &&
                  freigegebeneWerte.get(el)?.wert === String(el.value)
                    ? String(el.value)
                    : "",
                gesperrt: gesperrt(el),
              })),
              knoepfe: knoepfe(f).map(name),
            }
          : null,
        entwuerfe: a.liste ? eintraege(a.liste) : [],
      };
    },

    /**
     * `erwartet`: nur eintragen, wenn das Feld jetzt genau diesen Wert zeigt (Rücknahme).
     * @param {{ formular: string, fingerabdruck: string, label: string, wert: string, erwartet?: string, lesefreigabe?: string }} a
     */
    fuelle(a) {
      const f = gebunden(a.formular, a.fingerabdruck);
      if (!f) return { ok: false, grund: "ziel_geaendert" };
      const passend = felder(f).filter((el) => name(el) === a.label);
      if (passend.length === 0) return { ok: false, grund: "feld_fehlt" };
      if (passend.length > 1) return { ok: false, grund: "feld_mehrdeutig" };
      const el = passend[0];
      if (gesperrt(el) || inaktiv(el)) return { ok: false, grund: "feld_gesperrt" };
      const erwartet = geseheneWerte.has(el) ? geseheneWerte.get(el) : a.erwartet;
      if (typeof erwartet === "string" && String(el.value) !== erwartet) {
        return { ok: false, grund: "wert_geaendert" };
      }
      const wert = String(a.wert).slice(0, MAX_WERT);
      setze(el, wert);
      if (String(el.value) !== wert) return { ok: false, grund: "wert_geaendert" };
      freigegebeneWerte.set(el, { wert, freigabe: a.lesefreigabe });
      return { ok: true, wert: { wert } };
    },

    /**
     * `werte`: nur klicken, wenn jedes genannte Feld jetzt genau einmal da ist und genau diesen
     * Wert zeigt — der letzte Abgleich unmittelbar vor einer Wirkung.
     * @param {{ formular: string, fingerabdruck: string, knopf: string, werte?: { label: string, wert: string }[] }} a
     */
    klicke(a) {
      const f = gebunden(a.formular, a.fingerabdruck);
      if (!f) return { ok: false, grund: "ziel_geaendert" };
      const passend = knoepfe(f).filter((k) => name(k) === a.knopf);
      if (passend.length !== 1 || inaktiv(passend[0])) return { ok: false, grund: "knopf_fehlt" };
      for (const soll of a.werte ?? []) {
        const ist = felder(f).filter((el) => name(el) === soll.label);
        if (ist.length !== 1 || String(ist[0].value) !== soll.wert) {
          return { ok: false, grund: "wert_geaendert" };
        }
      }
      passend[0].click();
      return { ok: true, wert: null };
    },

    /** @param {{ liste: { name: string, kennung: string }, id: string, knopf: string }} a */
    loesche(a) {
      const treffer = listen(a.liste);
      if (treffer.length !== 1) return { ok: false, grund: "eintrag_fehlt" };
      const eintrag = Array.from(treffer[0].querySelectorAll(`[${a.liste.kennung}]`)).filter(
        (el) => el.getAttribute(a.liste.kennung) === a.id,
      );
      if (eintrag.length !== 1) return { ok: false, grund: "eintrag_fehlt" };
      const knopf = Array.from(eintrag[0].querySelectorAll("button")).filter(
        (k) => name(k) === a.knopf && !k.disabled,
      );
      if (knopf.length !== 1) return { ok: false, grund: "knopf_fehlt" };
      knopf[0].click();
      return { ok: true, wert: null };
    },
  };

  Object.defineProperty(globalThis, "KlaraBrowserAktion", {
    value: Object.freeze(api),
    writable: false,
    configurable: false,
  });
})();
