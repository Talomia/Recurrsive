# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Recurrsive, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email security@recurrsive.dev with:

1. A description of the vulnerability
2. Steps to reproduce the issue
3. The potential impact
4. Any suggested remediation

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical vulnerabilities.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.4.x   | ✅ Current |
| 0.1.x-0.3.x   | ⚠️ Security patches only |

## Security Design Principles

Recurrsive is designed with security as a core principle:

### Data Governance
- **PII Detection**: Automatic detection and masking of emails, phone numbers, SSNs, API keys, IP addresses, and JWT tokens
- **Field Masking**: Configurable field-level redaction
- **Audit Logging**: All data access operations are logged
- **Path Exclusion**: Glob-based directory filtering to prevent sensitive file ingestion

### Query Safety
- **Parameterized Queries**: All SQL and Cypher queries use parameterized statements — never string interpolation
- **Input Validation**: Filter keys validated against `^[a-zA-Z_][a-zA-Z0-9_]*$` before use in queries
- **No `eval()`**: The policy expression evaluator uses a hand-written recursive descent parser

### Dependencies
- We monitor dependencies for known vulnerabilities
- Third-party packages are selected for security track record
- The `better-sqlite3` driver provides parameterized query execution by default

### Runtime
- **No arbitrary code execution**: Analysis results are data, not executable code
- **Read-only by default**: The MCP server and CLI operate in read-only mode on the target project
- **Least privilege**: Docker containers run as non-root user (UID 1001)

## Security Scanning

We use GitHub's built-in security features:
- **Dependabot** for dependency vulnerability alerts
- **Secret Scanning** to prevent accidental credential commits
- **Code Scanning** via GitHub Actions
