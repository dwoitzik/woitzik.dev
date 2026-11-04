---
title: "Azure Firewall Forced Tunneling"
description: "Terraform template for Azure Firewall with forced tunneling. Routes all internet-bound traffic through the firewall without breaking Windows VMs or Managed Identities."
date: "2026-02-28"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-firewall-forced-tunneling"
---

Forced tunneling in Azure sends all internet-bound traffic through Azure Firewall. Wired up the obvious way in Terraform, it hits a cycle error, and the default route breaks Windows activation and Azure AD authentication.

This template fixes the resource ordering and adds the bypass routes those services need.

### What's included

- Resource ordering that avoids the cycle error on forced tunneling deployments
- KMS bypass route, so Windows VMs activate
- Azure AD bypass route, so Managed Identities and sign-in flows keep working
- Dynamic IP Group fed from spoke CIDRs, no hardcoded IP addresses in rules
- FQDN application policy for Windows Updates and core Microsoft services

Free and MIT licensed. See the [full module](/templates/).
