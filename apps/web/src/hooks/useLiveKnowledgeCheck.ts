import { useEffect, useState } from "react";
import { type ReasonerProvenance, endpoints } from "../api/endpoints";
import type { KnowledgeCheckCoverage, KnowledgeCheckResult } from "../api/types";
import {
  mapKnowledgeCheck,
  pruefumfangVon,
} from "../components/capture/intake/useLiveKnowledgeCheck";
import { INTAKE_MIN_LENGTH, type LiveVerdict } from "../lib/intakeSimilarity";

interface LiveCheckState {
  checkStatus: KnowledgeCheckResult["status"] | "idle" | "checking";
  verdict: LiveVerdict;
  // AUFNAHME 20260922 · VORSCHAU-REICHWEITE: der Umfang der LETZTEN Antwort zu genau dieser Frage —
  // `null`, solange keine vorliegt (idle, checking, Transportfehler). Er steht neben dem Verdict,
  // weil auch ein „pending" eine gelaufene Ähnlichkeitsvorschau hat, deren Umfang die Fläche nennt.
  pruefumfang: KnowledgeCheckCoverage | null;
}

// JOB 3556: Die Herkunft gehört zur FRAGE, nicht nur zur Antwort — derselbe Text mit einer anderen
// Einstufung ist eine andere Anfrage. Deshalb hängt der Lauf an einem Schlüssel aus beidem: wechselt
// die Stufe, steht sofort wieder „wird geprüft" da und nicht der Befund zur alten Stufe. Gebildet
// wird er über die PRIMITIVEN Felder, nie über die Objektidentität — `draftProvenance(...)` baut bei
// jedem Rendern ein neues Objekt, und ein Effekt daran hinge in einer Endlosschleife.
//
// JOB 3556 R3 (BEN, Befund 4): DIE `draftId` GEHÖRT IN DEN SCHLÜSSEL. Sie ist kein Beiwerk der
// Antwort, sondern der Anker, an dem der SERVER die gespeicherte Stufe nachschlägt — ein Wechsel der
// Kennung ist eine andere Frage, auch bei gleichem Text und gleicher Deklaration. Sie fehlte hier,
// und ein Kennungswechsel liess deshalb den alten Befund stehen, ohne neu zu fragen.
function herkunftsSchluessel(p: ReasonerProvenance | undefined): string {
  return p === undefined
    ? ""
    : [
        p.source,
        p.confidentiality,
        p.nichtEingestuft === true ? "1" : "",
        p.koId ?? "",
        p.draftId ?? "",
      ].join("|");
}

/** Der Schlüssel EINER Frage: Herkunft, gespeicherter Stand und Text — Begründung eine Zeile höher. */
function liveSchluessel(
  text: string,
  herkunft: ReasonerProvenance | undefined,
  gespeicherterStand: number | undefined,
): string {
  return `${herkunftsSchluessel(herkunft)}\n${gespeicherterStand ?? ""}\n${text.trim()}`;
}

// JOB 3427: Der Editor braucht ZWEI Auskünfte aus derselben Antwort. Der Prüfstatus darf
// weder hinter einem Treffer verschwinden noch dessen deterministischen Fundort verdrängen.
// Die bestehende Trefferabbildung bleibt zuständig für Titel, Link und nulltreuen Fundort.
//
// JOB 3556: `herkunft` ist das, was die Fläche über den bearbeiteten Text WEISS — mehr nicht.
// `undefined` heisst „unbekannte Einstufung"; dann geht keine hinaus und der Server bleibt
// fail-safe. Der Haken selbst leitet nichts ab, ergänzt nichts und setzt keinen Vorgabewert.
//
// JOB 3556 R3 (BEN, Befund 1/4): `gespeicherterStand` — DIE ANTWORT HÄNGT AN EINEM STAND, DEN DER
// TEXT NICHT VERRÄT. Über den Egress entscheidet der Server am GESPEICHERTEN Entwurf, nicht am
// getippten Text: wer einen vertraulich gespeicherten Entwurf auf „intern" stellt und SICHERT, hat
// dieselbe Frage neu gestellt, ohne ein Zeichen zu ändern. Vorher blieb der alte Befund („nicht
// geprüft") stehen, weil sich am Schlüssel nichts bewegte. Der Zähler ist genau das, was die Fläche
// ehrlich weiß: WIE OFT der gespeicherte Stand dieses Blattes neu gesetzt wurde (Laden, Sichern) —
// keine Behauptung über SEINEN INHALT, nur darüber, dass er nicht mehr derselbe ist.
function useLiveCheckKern(
  text: string,
  herkunft?: ReasonerProvenance,
  gespeicherterStand?: number,
  debounceMs = 500,
  beiAntwort?: (schluessel: string, antwort: KnowledgeCheckResult) => void,
): LiveCheckState {
  const clean = text.trim();
  const schluessel = liveSchluessel(text, herkunft, gespeicherterStand);
  const [state, setState] = useState<LiveCheckState & { schluessel: string }>({
    // Der Schlüssel des leeren Blattes ohne Herkunft und ohne Stand: nichts gefragt, nichts behauptet.
    schluessel: "\n\n",
    checkStatus: "idle",
    verdict: { status: "idle" },
    pruefumfang: null,
  });

  // `herkunft` ist bei jedem Rendern ein NEUES Objekt (`draftProvenance(...)`); als Abhängigkeit
  // liefe der Effekt endlos. Ihre FELDER stehen im `schluessel`, und der steht in der Liste — der
  // Effekt läuft also bei jeder echten Änderung der Herkunft, und nur dann. Der Abschluss trägt
  // dabei immer das Objekt DESSELBEN Rendervorgangs, aus dem auch der Schlüssel stammt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Begründung eine Zeile höher.
  useEffect(() => {
    if (clean.length < INTAKE_MIN_LENGTH) {
      setState({ schluessel, checkStatus: "idle", verdict: { status: "idle" }, pruefumfang: null });
      return;
    }
    setState({
      schluessel,
      checkStatus: "checking",
      verdict: { status: "checking" },
      pruefumfang: null,
    });
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const result = await endpoints.knowledge.check(clean, herkunft);
        if (cancelled) return;
        beiAntwort?.(schluessel, result);
        const checkStatus = result.status;
        // Unvollständige Konflikturteile sind keine belegten Widersprüche. Ähnlichkeit ist
        // unabhängig davon belegt und bleibt erhalten; die Transportantwort bleibt unverändert.
        const verdict = mapKnowledgeCheck(
          checkStatus === "done" ? result : { ...result, conflicts: [] },
        );
        setState({ schluessel, checkStatus, verdict, pruefumfang: pruefumfangVon(result) });
      } catch {
        if (!cancelled) {
          setState({
            schluessel,
            checkStatus: "failed",
            verdict: { status: "unavailable" },
            pruefumfang: null,
          });
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [clean, debounceMs, schluessel]);

  // Ein Ergebnis des vorigen Texts (oder der vorigen Einstufung) gilt schon vor dem nächsten Effekt
  // nicht mehr.
  if (state.schluessel !== schluessel) {
    const status = clean.length < INTAKE_MIN_LENGTH ? "idle" : "checking";
    return { checkStatus: status, verdict: { status }, pruefumfang: null };
  }
  return state;
}

// ================================================================================================
// AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629) — DERSELBE LAUF, EINE AUSKUNFT MEHR.
// ================================================================================================
//
// Der Hinweis auf dokumentierte Fehlschläge kommt aus DERSELBEN Antwort wie Verdict und Prüfumfang
// — kein zweiter Haken auf denselben Endpunkt (siehe JOB 3556 in
// components/capture/intake/useLiveKnowledgeCheck.ts). Er steht NEBEN dem Verdict und nicht in
// ihm: der Verdict zeigt einen Treffer, der Hinweis gilt unabhängig davon, ob Widerspruch,
// Ähnlichkeit oder nichts davon vorne steht.
//
// Die Treffer gelten nur für genau die Frage, die sie beantwortet haben: wechselt Text, Herkunft
// oder gespeicherter Stand, ist die Liste sofort leer, bis die neue Antwort da ist — dieselbe
// Schlüsselregel wie oben, nicht eine zweite.
export type LiveNegativwissen = NonNullable<KnowledgeCheckResult["negativwissen"]>;

export function useLiveKnowledgeCheck(
  text: string,
  herkunft?: ReasonerProvenance,
  gespeicherterStand?: number,
  debounceMs = 500,
): LiveCheckState & { negativwissen: LiveNegativwissen } {
  const [negativ, setNegativ] = useState<{ schluessel: string; treffer: LiveNegativwissen }>({
    schluessel: "",
    treffer: [],
  });
  const zustand = useLiveCheckKern(text, herkunft, gespeicherterStand, debounceMs, (s, antwort) =>
    setNegativ({ schluessel: s, treffer: antwort.negativwissen ?? [] }),
  );
  const aktuell = negativ.schluessel === liveSchluessel(text, herkunft, gespeicherterStand);
  return { ...zustand, negativwissen: aktuell ? negativ.treffer : [] };
}
