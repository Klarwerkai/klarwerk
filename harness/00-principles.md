# 00 — Prinzipien

1. **Drei getrennte Wahrheiten:** Spezifikation (Was) · Harness (Wie) · Evidenz (Ist es korrekt?). Code folgt daraus.
2. **Determinismus vor Meinung:** Maschinell prüfbare Regeln schlagen LLM-Urteil. Was prüfbar ist, wird als Tool implementiert.
3. **Lean zuerst:** Methode kopieren, nicht Topologie. Modularer Monolith vor Microservices; ein vertikaler Anwendungsfall zuerst.
4. **Harness Correction Development:** Jede wiederkehrende Abweichung wird als fehlende Harness-Regel behandelt und in `90-correction-log.md` dokumentiert.
5. **Specs sind operative Wahrheit:** Nie von vager Idee direkt zu Produktivcode. Zwischenschritt zur überprüfbaren Spec ist Pflicht.
6. **Mensch bleibt Stakeholder:** Pedi liefert Idee, Richtung, Freigabe. Finanz-/Kommunikationsaktionen brauchen Freigabe.
