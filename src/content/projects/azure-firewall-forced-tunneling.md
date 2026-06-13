---
title: "Azure Firewall Forced Tunneling (Base Edition)"
description: "Terraform template for Azure Firewall with forced tunneling — routes all internet-bound traffic through the firewall without breaking Windows VMs or Managed Identities."
date: "2026-02-28"
repoURL: "https://github.com/dwoitzik/azure-firewall-forced-tunneling"
---

Forced tunneling in Azure requires routing all internet-bound traffic through Azure Firewall — but the default Terraform setup hits a cycle error and breaks Windows activation and Azure AD authentication.

This template solves the ordering problem and includes the required bypass routes.

### What's included
- Cycle-error-free resource ordering for forced tunneling deployment
- KMS bypass route — Windows VMs activate correctly
- Azure AD bypass route — Managed Identities and auth flows work
- Basic FQDN rules for Windows Updates and core Microsoft services

### Limitations (Base Edition)
Static subnet binding, hardcoded IP addresses in rules. The [Enterprise Edition](/templates/) adds dynamic `for_each` subnet binding, IP Group-based policies, and full FQDN baseline rulesets.
