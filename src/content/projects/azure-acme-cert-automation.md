---
title: "Azure ACME Certificate Automation"
description: "Terraform wrapper that deploys Acmebot on Azure: Let's Encrypt certificates issued and renewed automatically, stored in Key Vault, VNet-isolated."
date: "2026-02-10"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-acme-cert"
---

VNet-isolated certificate automation for Azure. The module deploys the open-source Acmebot engine plus the Terraform infrastructure around it: Storage, Key Vault, IAM, and a Function App on its own App Service Plan. Storage, Key Vault, and the Function App sit behind Private Endpoints.

### What's included

- Automated issuance and renewal via Let's Encrypt (DNS-01)
- Certificates stored directly in Azure Key Vault
- System-Assigned Managed Identity, no hardcoded credentials
- Full Private Link isolation: Storage, Key Vault, and Function App all behind Private Endpoints
- Default-deny network rules, public network access disabled
- Optional zone balancing on the App Service Plan

Free and MIT licensed. See the [full module](/templates/).
