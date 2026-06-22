# Konsolidiertes Master-Dokument: KI-gestützte Software-Entwicklung nach dem Tielke-Ansatz

Dieses Dokument fasst die rekonstruierten Erkenntnisse aus der Prozessanalyse und dem Nachbau-Blueprint zu einem einzigen, praktisch nutzbaren Playbook zusammen. Es beschreibt nicht primär die gebaute Fachanwendung, sondern den wiederholbaren Entwicklungsprozess, die Architektur des Setups, den Harness-Ansatz und einen konkreten Nachbaupfad für eigene Teams.[cite:2][cite:4]

## Zielbild

Der Ansatz zielt auf eine kontrollierte Entwicklungsumgebung, in der KI nicht isoliert „Code schreibt", sondern innerhalb eines klaren Betriebsmodells arbeitet: mit Spezifikationen als Quelle der Wahrheit, automatisierten Checks, Tests, Versionierung, Deployments und Rückkopplung aus dem Betrieb.[cite:2][cite:4] Der Mensch liefert Idee, Richtung, Spezifikation und Qualitätsmaßstab; die KI liefert Umsetzung innerhalb eines strukturierten Rahmens.[cite:2][cite:4]

Die Kernaussage des Vortrags ist, dass KI mit dem richtigen Setup von punktuellem Helferwerkzeug zu einem produktiven Entwicklungssystem wird. Leitfragen dabei sind Machbarkeit, Geschwindigkeit, Qualität und Kosten.[cite:4]

## Ergebnisbild und Nutzenversprechen

Die Analyse rekonstruiert einen deutlichen Produktivitäts- und Qualitätsanspruch des gezeigten Ansatzes. Im Vortrag werden ein klassisches Mensch-Team und ein KI-getriebener Entwicklungsansatz gegenübergestellt, mit stark reduziertem Aufwand, deutlich geringeren Kosten, höherer Dokumentationsquote und höherer Testabdeckung auf KI-Seite.[cite:4]

| Kennzahl | Menschen-Team | KI |
|---|---:|---:|
| Aufwand | ~4.180 Tage [cite:4] | ~45 Tage [cite:4] |
| Kosten | ~2.000.000 € [cite:4] | ~25.000 € [cite:4] |
| Technische Schuld | ~13 % [cite:4] | 0 % [cite:4] |
| Dokumentation | ~33 % [cite:4] | 100 % [cite:4] |
| Testabdeckung | ~60 % [cite:4] | 85 % [cite:4] |
| Token-Verbrauch | – [cite:4] | ~27 Milliarden [cite:4] |

Diese Zahlen sind als Vortragsrekonstruktion zu verstehen, nicht als universell garantierbare Benchmarks. Für den Nachbau sind sie vor allem als Hinweis relevant, dass Prozessdisziplin, Prompt-Caching, Testautomatisierung und ein starker Harness wichtiger sind als ein einzelnes Modell oder Framework.[cite:4][cite:2]

## Zielarchitektur der Anwendung

Das rekonstruierte Zielsystem ist als Microservice-Architektur organisiert. Frontends und Clients greifen über ein API Gateway auf fachlich getrennte Services zu, während n8n als Workflow- und Integrationsschicht zwischen internen Diensten und externen Systemen arbeitet.[cite:4]

Die Analyse nennt als sichtbare Bestandteile eine öffentliche Homepage, eine CustomerUI und ein BackOffice auf React-Basis sowie ein zentrales API Gateway, n8n als Workflow Engine, mehrere Fachservices und externe Integrationen wie Google, Trello, Teams, Telegram und E-Mail.[cite:4] Der Blueprint abstrahiert diese Logik korrekt zu einer übertragbaren Zielarchitektur mit Microservices, je eigener Datenbank, API Gateway und Workflow Engine.[cite:2]

Wesentlich ist die Trennung in zwei Ebenen: deterministischer, testbarer Code in den Services einerseits und prozessuale Orchestrierung in versionierbaren Workflows andererseits. Diese Aufteilung macht das System für KI besser beschreibbar, überprüfbar und wartbar.[cite:4][cite:2]

## Entwicklungsumgebung

Die Entwicklungsumgebung besteht aus mehreren Coding-Agent-Maschinen, einer lokalen Dev-Umgebung, einem Harness als Steuergerüst, Spezifikationen als Vorgabe und einer zentralen Git-/CI-Infrastruktur. In der rekonstruierten Darstellung arbeiten zwei Entwicklungsmaschinen parallel; der Blueprint verallgemeinert das sinnvoll auf 1 bis N Maschinen.[cite:4][cite:2]

Zur zentralen Infrastruktur gehören ein selbst gehostetes Git-System wie Gitea, ein Build Runner für CI, getrennte Test- und Produktionsumgebungen sowie containerisierte Laufzeitumgebungen. Der Codefluss läuft von Agent und Dev-Umgebung in Git, durch die CI-Pipeline, in die Testumgebung und danach in Produktion.[cite:4][cite:2]

Diese Trennung ist nicht nur operativ sinnvoll, sondern auch für KI-Arbeit zentral: Die Umgebung muss reproduzierbar, maschinenlesbar und regelbasiert sein. Containerisierung, klare Skriptbefehle und geschützte Merge-Regeln sind hier Teil der eigentlichen KI-Architektur, nicht bloß DevOps-Beiwerk.[cite:2][cite:4]

## Der Harness als Kernkonzept

Der Harness ist das entscheidende Steuerungsgerüst um den Coding Agent. Im Blueprint wird er treffend als Kombination aus Ordnerstruktur, Regeldateien, Spezifikationen, Tooling und Tests beschrieben; die Analyse ergänzt die Phasenlogik, in der dieser Harness schrittweise erweitert wird.[cite:2][cite:4]

Praktisch bedeutet das: Die KI arbeitet nicht frei gegen ein leeres Repository, sondern gegen ein System aus dauerhaften Regeln, expliziten Eingabedokumenten und verbindlichen Prüfschritten. Der Harness enthält mindestens Architekturregeln, Definition of Done, Befehle für Lint/Build/Test, Spezifikationen pro Feature oder Service sowie versionierte Workflows und Tests.[cite:2]

Die empfohlene Repo-Struktur aus dem Blueprint ist dafür eine gute operative Form. Sie umfasst unter anderem `AGENTS.md` oder `CLAUDE.md`, einen `/specs`-Ordner, Service-Code mit zugehörigen Tests, versionierte Workflows, E2E-Tests, ausführbare Tools und automatisch erzeugte Dokumentation.[cite:2]

## Reifegradmodell der Zusammenarbeit mit KI

Die Zusammenarbeit mit der KI entwickelt sich in diesem Ansatz über fünf Reifestufen. Die Analyse beschreibt diese Stufen detailliert als Micromanagement, Quality Driven, Spec Driven, Test Driven, Idea Driven und Voice Driven; der Blueprint überführt sie in einen praxisnahen Einführungsfahrplan.[cite:4][cite:2]

### Phase 1: Micromanagement

In der ersten Phase steuert der Mensch die KI kleinteilig, Prompt für Prompt. Diese Phase ist nützlich zum Lernen, skaliert aber schlecht und erzeugt hohe manuelle Abhängigkeit.[cite:4]

### Phase 2: Quality Driven

Hier kommen feste Tools und ein Qualitätsloop hinzu. Codeerzeugung, Review, erneute Überarbeitung und Tooling wie Linting, Formatierung und Build-Prüfungen bilden den ersten stabilen Kontrollrahmen.[cite:4][cite:2]

### Phase 3: Spec Driven

Ab hier ist die schriftliche Spezifikation die Quelle der Wahrheit. Die KI baut nicht mehr primär gegen freie Prompts, sondern gegen dokumentierte Ziele, Akzeptanzkriterien, Schnittstellen, Datenmodell und Nicht-Ziele.[cite:2][cite:4]

### Phase 3+: Test Driven

In dieser Stufe werden Tests zum objektiven Akzeptanzkriterium. Die KI muss nicht nur Code erzeugen, sondern nachweisen, dass der Code definierte API- und Workflow-Tests besteht.[cite:4][cite:2]

### Phase 4: Idea Driven

Der Loop schließt sich: Idee, Spezifikation, Code, Tests, Checks und Tooling werden zu einem weitgehend autonomen Kreislauf. CI-Ergebnisse und Prüfergebnisse fließen zurück in den Agent-Kontext, sodass die KI iterativ bis zu einem grünen Zustand arbeiten kann.[cite:2][cite:4]

### Phase 5: Voice Driven

Die höchste Stufe beginnt mit gesprochener oder freiform formulierter Idee. Die KI recherchiert, strukturiert, spezifiziert, implementiert und testet auf Basis zusätzlicher Wissens- oder Recherchedokumente.[cite:4][cite:2]

## Spezifikationen als operative Wahrheit

Ein zentrales Prinzip des Nachbaus ist, dass Spezifikationen nicht nur Dokumentation sind, sondern die operative Wahrheit für Agent und Team. Der Blueprint schlägt dafür ein klares Spec-Template mit Ziel, Akzeptanzkriterien, API/Schnittstellen, Datenmodell, Nicht-Zielen und offenen Fragen vor.[cite:2]

Diese Struktur ist deshalb wirksam, weil sie direkt in automatisierbare Artefakte übersetzt werden kann. Akzeptanzkriterien werden zu Tests, Schnittstellen zu API-Kontrakten und Nicht-Ziele begrenzen Halluzinationen oder unnötige Implementierungen.[cite:2][cite:4]

Für Teams empfiehlt sich zusätzlich eine Eingangslogik mit drei Artefakttypen: Ideen-Notizen, Spezifikationen und transkribierte Spracheingaben. Der Agent sollte nie direkt von einer vagen Idee zu Produktivcode springen, sondern den Zwischenschritt zur überprüfbaren Spec erzwingen.[cite:2][cite:4]

## Teststrategie

Die Teststrategie ist im rekonstruierten Vortrag ein tragender Pfeiler der Autonomie. Die Analyse beschreibt zwei Hauptarten: API-Tests pro Service gegen echte Datenbanken und Workflow-/End-to-End-Tests über n8n und mehrere Services hinweg, jeweils mit TestContainers beziehungsweise echter containerisierter Laufzeitnähe.[cite:4]

Der Blueprint übernimmt diese Testlogik korrekt als Akzeptanz-Gate. Ein Feature gilt erst dann als fertig, wenn die zugehörigen Akzeptanzkriterien als grüne Tests vorliegen.[cite:2]

Diese Entscheidung ist fundamental: Tests ersetzen nicht den Menschen, aber sie schaffen das objektive Sicherheitsnetz, das KI überhaupt erst verlässlich autonom arbeiten lässt. Ohne diesen Testrahmen bleibt die Entwicklung in Micromanagement oder bestenfalls Quality Driven stecken.[cite:4][cite:2]

## Monitoring und Feedback-Loop

Eine der wichtigsten Ergänzungen aus der Analyse gegenüber dem reinen Blueprint ist der explizite Feedback-Loop vom Betrieb zurück in den Harness. In der rekonstruierten Architektur gibt es einen Monitoring-/Ergebnis-Baustein, dessen Output wieder in die Steuerung der KI zurückfließt.[cite:4]

Für einen belastbaren Nachbau sollte Monitoring deshalb als eigener Architekturbaustein behandelt werden. Sinnvoll sind mindestens Logs, Fehlerraten, Durchlaufzeiten von Workflows, Testresultate aus der CI, Dokumentationsstatus und Token-/Kostenmetriken des LLM-Einsatzes.[cite:4][cite:2]

Operativ empfiehlt sich ein zusätzlicher Abschnitt im Setup:

- Sammle Betriebsdaten aus Services, API Gateway, n8n und CI zentral.[cite:4]
- Erzeuge standardisierte Fehler- und Health-Reports als Markdown oder JSON für den Agent-Kontext.[cite:2][cite:4]
- Übergib fehlgeschlagene Tests, Log-Ausschnitte und betroffene Spezifikationen gesammelt an den nächsten Agent-Run.[cite:2][cite:4]
- Lasse den Agent Verbesserungsvorschläge oder konkrete Fixes nur innerhalb der bestehenden Harness-Regeln erzeugen.[cite:2]

Erst mit dieser Rückkopplung entsteht aus einer KI-unterstützten Build-Pipeline ein lernfähiger, weitgehend autonomer Entwicklungsprozess.[cite:4][cite:2]

## Technologiewahl und austauschbare Bausteine

Ein wichtiger Vorzug des Blueprint-Dokuments ist seine Stack-Unabhängigkeit. Es trennt sauber zwischen Methode und Implementierungsbausteinen und erlaubt den Austausch von Git-System, CI, Backend-Sprache, Frontend, API Gateway, Workflow Engine, Tests und Hosting, ohne den Kernprozess zu verändern.[cite:2]

| Baustein | Im rekonstruierten Vortrag | Austauschbare Optionen |
|---|---|---|
| Coding Agent | Claude / Anthropic [cite:2][cite:4] | Claude Code oder anderer CLI-Agent [cite:2] |
| Git | Gitea [cite:2][cite:4] | GitHub, GitLab, Gitea [cite:2] |
| CI | Build Runner [cite:2][cite:4] | Gitea Actions, GitHub Actions, GitLab CI, Jenkins [cite:2] |
| Workflow Engine | n8n [cite:2][cite:4] | n8n, Temporal, Camunda [cite:2] |
| API Gateway | zentraler Eingang [cite:2][cite:4] | Traefik, Kong, YARP, nginx [cite:2] |
| Hosting | NAS / getrennte Umgebungen [cite:2][cite:4] | NAS, VPS, Cloud, Kubernetes [cite:2] |

Entscheidend ist daher nicht die dogmatische Nachbildung jedes Tools, sondern die Erhaltung der Systemprinzipien: klare Spezifikationen, automatisiertes Tooling, Test-Gates, reproduzierbare Environments und Feedback in den Harness.[cite:2][cite:4]

## Empfohlene Einführungsreihenfolge

Die sinnvollste Einführung erfolgt schrittweise. Der Blueprint formuliert dafür bereits eine gute Startreihenfolge, die sich mit der Analyse deckt und um wenige Präzisierungen ergänzt werden kann.[cite:2][cite:4]

1. Git, CI und containerisierte Dev-/Test-/Prod-Struktur aufsetzen.[cite:2]
2. Einen ersten klar geschnittenen Microservice mit eigener Datenbank und API-Tests etablieren.[cite:2][cite:4]
3. `AGENTS.md`, Spec-Template und ausführbare Tool-Skripte für Lint, Build, Test und Gesamt-Check anlegen.[cite:2]
4. Den ersten Feature-Loop in der Stufe Spec Driven fahren.[cite:2]
5. Danach Test Driven ergänzen, sodass Akzeptanzkriterien systematisch in Tests übersetzt werden.[cite:2][cite:4]
6. Erst bei mehreren Services API Gateway und n8n als Integrations- und Workflow-Ebene einziehen.[cite:2]
7. Danach Monitoring und Feedback-Loop integrieren, um Richtung Idea Driven zu gehen.[cite:2][cite:4]
8. Voice Driven erst zuletzt ergänzen, wenn Specs, Tooling und Test-Gates bereits stabil funktionieren.[cite:2][cite:4]

## Konsolidierte Bewertung

Die beiden Ausgangsdokumente widersprechen sich nicht, sondern ergänzen sich. Die Analyse liefert die rekonstruierten Originalelemente des Vortrags, einschließlich Kennzahlen, konkreter Architekturdeutung, Phasenmodell und Teststrategie; der Blueprint übersetzt diese Erkenntnisse in eine anpassbare operative Struktur mit Repo-Konventionen, Toolbefehlen und Einführungslogik.[cite:4][cite:2]

Als Master-Interpretation ergibt sich daraus ein klarer Nachbaupfad: Nicht die Fachanwendung kopieren, sondern das Entwicklungssystem kopieren. Entscheidend sind Harness, Specs, Tests, CI, getrennte Environments, versionierte Workflows und ein messbarer Feedback-Loop.[cite:2][cite:4]

## Praktische Empfehlung für den ersten Nachbau

Für einen ersten realen Nachbau sollte das Ziel nicht sofort ein vollwertiges Multi-Service-System sein. Erfolgversprechender ist ein schlanker Start mit einem Service, einer Datenbank, einer Spec-Disziplin, einem Agent-Regelwerk und einer Pipeline aus Build, Lint und Tests.[cite:2]

Sobald dieser Kern verlässlich funktioniert, können schrittweise weitere Services, Workflow-Orchestrierung über n8n, parallele Agent-Maschinen und ein echter Feedback-Loop ergänzt werden. Genau diese schrittweise Evolution ist die eigentliche Lehre des Vortrags.[cite:4][cite:2]
