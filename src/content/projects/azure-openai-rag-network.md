---
title: "Azure OpenAI RAG Network"
description: "Terraform template for a zero-trust Azure OpenAI + AI Search deployment — VNet injection, Private DNS, and RBAC identity chaining."
date: "2026-03-10"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-openai-rag"
---

Network foundation for a production AI RAG stack on Azure. Deploys Azure OpenAI and AI Search with VNet injection and Private DNS — no public endpoint exposure.

### What's included

- Azure OpenAI + AI Search with VNet injection
- Private Endpoints for both services (no public network access)
- Private DNS Zones for both services
- System Managed Identities with RBAC chaining — no shared keys, no manual Portal approval steps

Free and MIT licensed — see the [full module](/templates/).
