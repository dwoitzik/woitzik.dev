---
title: "Azure OpenAI RAG Network (Base Edition)"
description: "Terraform template for a zero-trust Azure OpenAI + AI Search deployment — VNet injection, Private DNS, and RBAC identity chaining."
date: "2026-03-10"
repoURL: "https://github.com/dwoitzik/azure-openai-rag-network"
---

Network foundation for a production AI RAG stack on Azure. Deploys Azure OpenAI and AI Search with VNet injection and Private DNS — no public endpoint exposure.

### What's included
- Azure OpenAI + AI Search with VNet injection
- Private DNS Zones for both services
- System Managed Identities with RBAC chaining
- Public Network Access disabled by default

### Limitations (Base Edition)
Manual Shared Private Link approval required via the Azure Portal. The [Enterprise Edition](/templates/) adds automated AzAPI-based link approval, eliminating all manual Portal steps.
