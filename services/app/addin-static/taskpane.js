/*
 * Klarwerk Companion — Word Task Pane (PoC).
 * Liest den Dokumenttext über Office.js und prüft ihn gegen validiertes Firmenwissen aus Klarwerk.
 *
 * Ehrlichkeitslinie: Ergebnisse sind KI-gestützt und quellengebunden — nichts wird erfunden. Wenn der
 * Live-Call (noch) blockiert ist (CORS/Auth/Mixed-Content/Flag AUS), zeigt das Panel eine KLAR als
 * „Mock" gekennzeichnete Beispielantwort, damit die End-to-End-UX sichtbar ist — nichts wird gefälscht.
 *
 * Die Sicherheits-/Fallback-Logik (Allowlist, Live-Call, Mock) lebt DOM-frei in ./klarwerk-client.ts
 * (dort getestet). Diese Datei ist nur die Office/DOM-Verdrahtung.
 */
import { ALLOWED_BASES, check } from "./klarwerk-client.js";
function el(id) {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`Element #${id} nicht gefunden`);
    }
    return node;
}
/** Normalisiert die Eingabe auf ihren Origin und prüft die 505-Allowlist. Nicht erlaubt → null. */
function allowedBaseUrl() {
    const raw = el("baseUrl").value.trim().replace(/\/+$/, "");
    try {
        const origin = new URL(raw).origin;
        return ALLOWED_BASES.includes(origin) ? origin : null;
    }
    catch {
        return null;
    }
}
/** Optionaler Add-in-Schlüssel (x-klarwerk-addon-key). Leer → kein Header → Session-/Mock-Weg. */
function apiKey() {
    return el("apiKey").value.trim();
}
function setStatus(text) {
    const s = el("status");
    if (text === null) {
        s.hidden = true;
        s.textContent = "";
    }
    else {
        s.hidden = false;
        s.textContent = text;
    }
}
/** Dokumenttext über Office.js lesen. */
async function readDocumentText() {
    return Word.run(async (context) => {
        const body = context.document.body;
        body.load("text");
        await context.sync();
        return body.text ?? "";
    });
}
function pill(text, cls) {
    return `<span class="pill ${cls}">${escapeHtml(text)}</span>`;
}
function renderItem(item) {
    const meta = [pill(`Quelle ${item.source}`, "pill-source")];
    if (typeof item.confidence === "number") {
        meta.push(pill(`Konfidenz ${Math.round(item.confidence * 100)} %`, "pill-conf"));
    }
    if (item.kind === "conflict") {
        meta.push(pill("Widerspruch", "pill-conflict"));
    }
    if (item.kind === "parallel") {
        meta.push(pill("Parallele", "pill-parallel"));
    }
    return `<div class="item">
      <p class="item-statement">${escapeHtml(item.statement)}</p>
      <div class="item-meta">${meta.join("")}</div>
    </div>`;
}
function renderBlock(title, items, emptyText) {
    const inner = items.length > 0
        ? items.map(renderItem).join("")
        : `<p class="empty">${escapeHtml(emptyText)}</p>`;
    return `<div class="block"><p class="block-title">${escapeHtml(title)}</p>${inner}</div>`;
}
function render(outcome) {
    const results = el("results");
    const parts = [];
    // SCRUM-490 R2 (A1): kein Mock/Fake mehr — bei „unavailable" nur ein ehrlicher Status + LEERE Listen.
    if (outcome.mode === "unavailable") {
        parts.push(`<div class="mock-banner"><strong>Klarwerk-Prüfung nicht verfügbar.</strong>
       Kein Ergebnis (${escapeHtml(outcome.reason ?? "unbekannt")}) — Backend nicht erreichbar,
       Add-in-Schlüssel fehlt/ungültig oder <code>KLARWERK_ADDON_API</code> ist aus. Es werden KEINE
       Beispiel-/Ersatztreffer angezeigt. Basis-URL + Schlüssel prüfen (siehe README).</div>`);
    }
    const unavailableEmpty = "Nicht verfügbar (kein Live-Ergebnis).";
    parts.push(renderBlock("Passendes validiertes Wissen", outcome.knowledge, outcome.mode === "live"
        ? "Kein passendes validiertes Wissen gefunden (ehrliche Wissenslücke)."
        : unavailableEmpty));
    parts.push(renderBlock("Erkannte Widersprüche", outcome.conflicts, outcome.mode === "live"
        ? "Freitext-Konfliktprüfung ist noch nicht verdrahtet (kein Endpoint) — siehe README."
        : unavailableEmpty));
    parts.push(renderBlock("Parallelen / mögliche Duplikate", outcome.parallels, outcome.mode === "live"
        ? "Freitext-Duplikatprüfung ist noch nicht verdrahtet (kein Endpoint) — siehe README."
        : unavailableEmpty));
    results.innerHTML = parts.join("");
    results.hidden = false;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
async function onCheck() {
    const btn = el("checkBtn");
    btn.disabled = true;
    el("results").hidden = true;
    setStatus("Lese Dokumenttext …");
    try {
        const text = await readDocumentText();
        if (!text.trim()) {
            setStatus("Das Dokument enthält keinen Text.");
            return;
        }
        // SCRUM-505: die Basis-URL gegen die Allowlist auflösen, BEVOR irgendetwas gesendet wird.
        // Nicht erlaubt → klarer Abbruch, kein fetch mit Key/Dokumenttext an ein fremdes Ziel.
        const base = allowedBaseUrl();
        if (!base) {
            setStatus("Ungültige oder nicht erlaubte Basis-URL. Erlaubt sind nur bekannte Klarwerk-Server.");
            return;
        }
        setStatus("Prüfe gegen validiertes Firmenwissen …");
        const outcome = await check(base, text, apiKey());
        setStatus(outcome.mode === "live" ? "Live-Antwort von Klarwerk." : "Klarwerk-Prüfung nicht verfügbar.");
        render(outcome);
    }
    catch (err) {
        setStatus(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    }
    finally {
        btn.disabled = false;
    }
}
Office.onReady((info) => {
    if (info.host !== Office.HostType.Word) {
        setStatus("Dieses Add-in ist für Word gedacht.");
        return;
    }
    el("checkBtn").addEventListener("click", () => {
        void onCheck();
    });
    for (const chip of Array.from(document.querySelectorAll(".chip"))) {
        chip.addEventListener("click", () => {
            el("baseUrl").value = chip.dataset.url ?? "";
        });
    }
});
