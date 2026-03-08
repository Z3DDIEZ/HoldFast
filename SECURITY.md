# Security Policy

## Supported Versions

Holdfast is actively maintained as an exploration into client/server validation pipelines and idle game architectures. Security updates and patches are solely applied to the currently active production iteration.

| Version | Supported          |
| ------- | ------------------ |
| v1.x.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

As this is a portfolio project and not a commercial application, vulnerability reporting is straightforward. I welcome notifications regarding systemic vulnerabilities, specifically in relation to:

- The client untrusted boundary evaluations.
- CQRS snapshot pipeline tampering that bypasses Domain invariants.
- Database traversal or EF Core SQL injection exposures.

If you identify a vulnerability within Holdfast, please **do not** create a public GitHub issue.

Instead, please email me directly with the following details:

1.  A concise summary of the vulnerability.
2.  The specific endpoint, vector, or pipeline component affected.
3.  Step-by-step instructions or an exploitation script to reliably reproduce the scenario.


Security reports will be acknowledged immediately upon receipt. Due to non-commercial operational constraints, there is no formal bug bounty, but constructive disclosures will be formally credited within the project structure should you wish.
