# 70 — Sicherheit & Berechtigungen

- **Kein** direkter Schreibzugriff von Coding-Agenten auf Produktion. Deployment ausschließlich über CI/CD.
- Produktionslogs read-only; personenbezogene Daten maskiert.
- **Secrets nie** im Harness, Repo oder Spec. Nur über Secret-Store/ENV.
- **MCP-/Tool-Zugriffe:** Allowlist, definierte Schemas, Idempotenz, Audit-Log.
- **Human Approval** verpflichtend für: Rechnungen, Zahlungen, externe Nachrichten, Löschoperationen.
- Agent arbeitet standardmäßig in reproduzierbarer Docker-Testumgebung mit weitreichenden Rechten dort, eingeschränkt in Produktion.
