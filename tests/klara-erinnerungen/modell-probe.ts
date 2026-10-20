// Testinterne Beobachtung am tatsächlichen Reasoner-Aufruf im Serverprozess. Kein externes Modell.
import { appendFileSync } from "node:fs";
import { Reasoner } from "../../services/reasoner";
const ziel = process.env.KLARWERK_TEST_ERINNERUNG_MODELL_BELEG;
if (!ziel) throw new Error("Modellbelegpfad für isolierte Probe fehlt.");
Reasoner.prototype.assistText = async () => {
  appendFileSync(ziel, "assistText\n");
  return { text: "F1: tatsächlicher erlaubter Reasoner-Aufruf (Testadapter)", demo: false };
};
