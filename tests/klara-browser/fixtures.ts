// Synthetic public test material, not fetched website content or private chats.
// The DOM cases execute selection.js; API cases reuse these exact texts and sources.
export const pages = [
  {
    name: "Perplexity-Beispiel",
    url: "https://www.perplexity.ai/search/browser-b0-test",
    title: "Testchat · Erklärung",
    markup: '<main><section><div id="chosen"></div></section></main>',
    text: `Grüße äöü 😀\n<script>Test</script>\n${"Eine technische Erklärung bleibt ungeprüft. ".repeat(60)}`,
  },
  {
    name: "Technische Erläuterung",
    url: "https://technik.example.test/drucker/erklaerung?modell=test#netzwerk",
    title: "Drucker · Netzwerk und Warteschlange",
    markup: '<article><h1>Drucker</h1><p id="chosen"></p></article>',
    text: `Druckereinrichtung\n\n${"Die Warteschlange übermittelt Aufträge an den gewählten Drucker. ".repeat(50)}\nUmlaute äöü und Zeichen < > & bleiben erhalten.`,
  },
  {
    name: "Strukturierte Schnittstellenanleitung",
    url: "http://schnittstelle.example.test:8080/anleitung",
    title: "Schnittstelle · Einrichtung in drei Schritten",
    markup: '<div class="manual"><h1>Einrichtung</h1><pre><code id="chosen"></code></pre></div>',
    text: `1. Gerät anschließen.\n\n2. Konfiguration prüfen:\n  interface = "usb"\n  label = "Größe äöü 😀"\n  if (ready && count < 3) {\n    connect();\n  }\n\n3. Test durchführen.\n${"Verbindung prüfen und das Ergebnis dokumentieren.\n".repeat(50)}`,
  },
];
