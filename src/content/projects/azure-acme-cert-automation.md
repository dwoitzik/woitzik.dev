---
title: "Azure ACME Certificate Automation (Base Edition)"
description: "Terraform wrapper to deploy Acmebot on Azure — automated Let's Encrypt certificates stored in Key Vault, zero-maintenance, serverless."
date: "2026-02-10"
repoURL: "https://github.com/dwoitzik/azure-acme-cert-automation"
---

Serverless certificate automation for Azure. Deploys the open-source Acmebot engine with the surrounding Terraform infrastructure — Storage, Key Vault, IAM, and App Service on the Consumption tier.

### What's included
- Automated issuance and renewal via Let's Encrypt (DNS-01)
- Certificates stored directly in Azure Key Vault
- System-Assigned Managed Identity — no hardcoded credentials
- Consumption tier — effectively $0/month compute cost

### Limitations (Base Edition)
Public endpoint, no VNet integration, no Private Link. The [Enterprise Edition](/templates/) adds full Private Link isolation and Managed Identity hardening for ISO 27001 / NIS2 environments.
