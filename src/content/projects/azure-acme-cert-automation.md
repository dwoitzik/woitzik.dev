---
title: "Azure ACME Certificate Automation"
description: "Terraform wrapper to deploy Acmebot on Azure — automated Let's Encrypt certificates stored in Key Vault, VNet-isolated, zero-maintenance."
date: "2026-02-10"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-acme-cert"
---

VNet-isolated certificate automation for Azure. Deploys the open-source Acmebot engine with the surrounding Terraform infrastructure — Storage, Key Vault, IAM, and a hardened App Service Plan, all behind Private Endpoints.

### What's included

- Automated issuance and renewal via Let's Encrypt (DNS-01)
- Certificates stored directly in Azure Key Vault
- System-Assigned Managed Identity — no hardcoded credentials
- Full Private Link isolation: Storage, Key Vault, and Function App all behind Private Endpoints
- Default-deny network rules, public network access disabled
- Zone-balanced production App Service Plan

Free and MIT licensed — see the [full module](/templates/).
