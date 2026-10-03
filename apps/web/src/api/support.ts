import { useEffect, useState } from "react";
import { api } from "./client";

// ================================================================================================
// R-1064 · DER SUPPORTWEG DIESER INSTALLATION — der Leseweg der Oberfläche.
// ================================================================================================
//
// Die Quelle ist `GET /api/support` (services/app/src/routes/support-routes.ts): der Betreiber legt
// den Weg je Installation fest, der Server prüft ihn und liefert einen von drei Zuständen. Hier
// kommen zwei Lagen dazu, die nur der Client kennt — „lädt" und „Abruf gescheitert".
//
// ZWEITE PRÜFUNG, BEWUSST: Das Ziel wird `href`. Die Oberfläche setzt es deshalb nur, wenn sie es
// SELBST als `https:` ohne Zugangsdaten oder als `mailto:` mit genau einer schlichten Adresse
// erkennt — dieselbe Regel wie am Server. Eine Antwort, die das nicht erfüllt, ist kein Kontakt,
// sondern ein unbrauchbarer Abruf ("fehler"); es wird nichts daraus verlinkt.
//
// WARUM KEIN React Query: Die Hilfeseite hängt an keinem Abruf und wird in mehreren Prüfständen
// ganz ohne Abfragekontext montiert (Kopf von `pages/Help.tsx`, JOB 3468/4022). Ein `useQuery`
// würfe dort. Ein schlichter Effekt über den vorhandenen `api`-Client bleibt in jeder Lage lesbar.

type SupportKontakt =
  | {
      zustand: "eingerichtet";
      art: "https" | "mailto";
      ziel: string;
      anzeige: string;
      bezeichnung: string | null;
    }
  | { zustand: "nicht_eingerichtet" }
  | { zustand: "ungueltig" };

export type SupportLage = SupportKontakt | { zustand: "laedt" } | { zustand: "fehler" };

const MAIL_ADRESSE =
  /^[A-Za-z0-9._+-]{1,64}@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function sicheresZiel(art: unknown, ziel: unknown): boolean {
  if (typeof ziel !== "string" || ziel.length === 0 || ziel.length > 500 || /\s/.test(ziel)) {
    return false;
  }
  if (art === "mailto") {
    return ziel.startsWith("mailto:") && MAIL_ADRESSE.test(ziel.slice("mailto:".length));
  }
  if (art !== "https") {
    return false;
  }
  try {
    const url = new URL(ziel);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/** Die Serverantwort in einen der drei Zustände — oder "fehler", wenn sie keiner davon ist. */
function leseSupportAntwort(roh: unknown): SupportLage {
  const a = (roh ?? {}) as Record<string, unknown>;
  if (a.zustand === "nicht_eingerichtet" || a.zustand === "ungueltig") {
    return { zustand: a.zustand };
  }
  if (a.zustand !== "eingerichtet" || !sicheresZiel(a.art, a.ziel)) {
    return { zustand: "fehler" };
  }
  const anzeige = typeof a.anzeige === "string" ? a.anzeige.trim() : "";
  const bezeichnung = typeof a.bezeichnung === "string" ? a.bezeichnung.trim() : null;
  // Ein Kontakt ohne lesbaren Zieltext wäre ein unsichtbarer Link — der zählt nicht als Erfolg.
  if (anzeige === "" || (bezeichnung !== null && (bezeichnung === "" || bezeichnung.length > 80))) {
    return { zustand: "fehler" };
  }
  return {
    zustand: "eingerichtet",
    art: a.art as "https" | "mailto",
    ziel: a.ziel as string,
    anzeige,
    bezeichnung,
  };
}

// Über `Promise.resolve().then(…)`: auch ein SYNCHRON geworfener Fehler wird zur Lage "fehler"
// und bricht das Rendern der Hilfeseite nie ab.
const supportKontaktLaden = (): Promise<SupportLage> =>
  Promise.resolve()
    .then(() => api.get<unknown>("/support"))
    .then(leseSupportAntwort);

/** Der Supportweg für die Hilfeseite. Scheitert der Abruf, heisst die Lage "fehler" — nie leer. */
export function useSupportKontakt(): SupportLage {
  const [lage, setLage] = useState<SupportLage>({ zustand: "laedt" });
  useEffect(() => {
    let aktiv = true;
    supportKontaktLaden()
      .then((ergebnis) => {
        if (aktiv) {
          setLage(ergebnis);
        }
      })
      .catch(() => {
        if (aktiv) {
          setLage({ zustand: "fehler" });
        }
      });
    return () => {
      aktiv = false;
    };
  }, []);
  return lage;
}
