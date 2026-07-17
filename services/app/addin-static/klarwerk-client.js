/*
 * Klarwerk Companion — reiner (DOM-/Office-freier) Client-Kern für den Live-Call gegen Klarwerks
 * /api/ask. Ausgelagert aus taskpane.ts, damit die Sicherheits-/Ehrlichkeitslogik OHNE Browser/Office
 * deterministisch (injizierter fetch) getestet werden kann. Enthält KEINE DOM-Zugriffe.
 *
 * Ehrlichkeitslinie (SCRUM-490 R2, A1/A2): gelingt der Live-Call nicht (Flag AUS/CORS/Auth/Netz/nicht-ok/
 * ungültige Antwortform), gibt `check` NUR einen klaren „nicht verfügbar"-Status mit LEERER Liste zurück
 * — es gibt KEINE Beispiel-/Demo-Treffer mehr (kein Fake-Wissen, keine Fake-Konfidenz). Und ein Treffer
 * OHNE echte Quelle wird nicht als Wissen ausgegeben (nie eine Quelle „—" vortäuschen).
 */
export const KLARWERK_MAX_CHARS = 4000; // defensiver Deckel für den PoC.
// SCRUM-505: harte Allowlist der erlaubten Klarwerk-Basis-URLs. Eine FREI gesetzte Basis-URL würde sonst
// den Add-in-Key (x-klarwerk-addon-key) UND den Dokumenttext an einen beliebigen (Angreifer-)Server
// senden — Exfiltration. Nur exakte, bekannte HTTPS-Origins sind zulässig; alles andere wird VOR jedem
// fetch abgewiesen. Bei neuen Zielen hier explizit ergänzen (kein Freitext-Ziel).
export const ALLOWED_BASES = ["https://app.klarwerk.ai", "https://localhost:3001"];
/** Header-Name des schmalen Add-in-Zugangs — muss zum Backend (services/app/addon-api.ts) passen. */
export const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
/** true, wenn `base` GENAU einem erlaubten Origin entspricht (Protokoll+Host+Port, ohne Pfad). */
export function isAllowedBase(base) {
    try {
        return ALLOWED_BASES.includes(new URL(base).origin);
    }
    catch {
        return false;
    }
}
function isStringArray(v) {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
}
// SCRUM-490 R2 (A2): RUNTIME-Schema-Validierung der Backend-Antwort (kein bloßer TS-Cast). Passt die Form
// nicht, gibt es null → der Aufrufer behandelt das als „nicht verfügbar" (kein blindes Vertrauen in
// fremdes JSON). Nur die tatsächlich genutzten Felder werden geprüft und übernommen.
export function parseAskResult(raw) {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const r = raw.result;
    if (typeof r !== "object" || r === null) {
        return null;
    }
    const rr = r;
    if (typeof rr.answered !== "boolean") {
        return null;
    }
    if (rr.answer !== null && typeof rr.answer !== "string") {
        return null;
    }
    if (!isStringArray(rr.sources)) {
        return null;
    }
    if (rr.confidence !== undefined && typeof rr.confidence !== "number") {
        return null;
    }
    return {
        result: {
            answered: rr.answered,
            answer: rr.answer,
            sources: rr.sources,
            ...(typeof rr.confidence === "number" ? { confidence: rr.confidence } : {}),
        },
        gap: raw.gap ?? null,
    };
}
/**
 * Echter Klarwerk-Call: POST {base}/api/ask mit dem Dokumenttext als „Frage". Auth: der optionale
 * Add-in-Schlüssel geht als x-klarwerk-addon-key mit (schmaler ask.validated-Retrieval-Pfad des Backends
 * hinter KLARWERK_ADDON_API). `fetchImpl` injizierbar → Tests ohne Netz. Wirft bei nicht-ok ODER bei
 * ungültiger Antwortform (Schema, A2).
 */
export async function callKlarwerkLive(base, text, key, fetchImpl = fetch) {
    // SCRUM-505: letzter Wächter direkt am fetch — niemals Key/Dokumenttext an ein nicht-allowlistetes Ziel.
    if (!isAllowedBase(base)) {
        throw new Error("Nicht erlaubte Basis-URL — nur bekannte Klarwerk-Server sind zulässig.");
    }
    const headers = { "Content-Type": "application/json" };
    if (key) {
        headers[ADDON_KEY_HEADER] = key;
    }
    const res = await fetchImpl(`${base}/api/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: text.slice(0, KLARWERK_MAX_CHARS), locale: "de" }),
        // SCRUM-505 R2: Redirects NICHT folgen (kein Key/Text an ein fremdes Redirect-Ziel).
        redirect: "error",
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const parsed = parseAskResult(await res.json());
    if (!parsed) {
        throw new Error("Ungültige Antwortform von Klarwerk.");
    }
    return parsed;
}
// SCRUM-490 R2 (A2): aus der Antwort NUR belegte Treffer als Wissen ableiten. answered=false ODER kein
// answer-Text → kein Treffer. answered=true, aber KEINE echte Quelle → ebenfalls KEIN Wissen (nie eine
// Quelle „—" vortäuschen). Nur mit mindestens einer echten Quelle wird ein Wissens-Item gebildet.
export function mapAskToItems(ask) {
    const r = ask.result;
    if (!r.answered || !r.answer) {
        return [];
    }
    const sources = r.sources.filter((s) => s.trim().length > 0);
    if (sources.length === 0) {
        return []; // belegter Treffer ohne Quelle gibt es nicht
    }
    return [
        {
            kind: "knowledge",
            statement: r.answer,
            source: sources.join(", "),
            ...(typeof r.confidence === "number" ? { confidence: r.confidence } : {}),
        },
    ];
}
// SCRUM-490 R2 (A1): ehrlicher Inaktiv-Zustand — klarer Grund, LEERE Listen, KEINE erfundenen Treffer.
export function unavailable(reason) {
    return { mode: "unavailable", reason, knowledge: [], conflicts: [], parallels: [] };
}
/**
 * Prüft den Dokumenttext gegen Klarwerk. Gelingt der Live-Call → mode:"live" (echtes, quellengebundenes
 * Wissen; A2: nur belegte Treffer). Schlägt er fehl (Netz/CORS/Auth/Flag AUS/Schema) → mode:"unavailable"
 * mit LEERER Liste — kein Fake-Wissen.
 */
export async function check(base, text, key, fetchImpl = fetch) {
    try {
        const ask = await callKlarwerkLive(base, text, key, fetchImpl);
        const knowledge = mapAskToItems(ask);
        // /api/ask liefert passendes Wissen, aber KEINE Freitext-Konflikte/-Parallelen (kein Endpoint).
        // Diese beiden Blöcke bleiben im Live-Modus leer und werden als „noch nicht verdrahtet" markiert.
        return { mode: "live", knowledge, conflicts: [], parallels: [] };
    }
    catch (err) {
        return unavailable(err instanceof Error ? err.message : String(err));
    }
}
