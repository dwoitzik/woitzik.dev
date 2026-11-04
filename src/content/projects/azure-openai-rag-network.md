---
title: "Azure OpenAI RAG Network"
description: "Terraform template for a zero-trust Azure OpenAI and AI Search deployment: Private Endpoints, Private DNS, and Managed Identity RBAC instead of keys."
date: "2026-03-10"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-openai-rag"
---

Network foundation for a RAG stack on Azure. Deploys Azure OpenAI and AI Search behind Private Endpoints with matching Private DNS zones. Neither service has a public endpoint.

### What's included

- Azure OpenAI and AI Search with Private Endpoints on a dedicated subnet
- Public network access disabled on both services
- Private DNS Zones for both services, linked to the VNet
- AI Search calls Azure OpenAI with its System-Assigned Managed Identity and the `Cognitive Services OpenAI User` role: no shared keys, no manual Private Endpoint approval

Free and MIT licensed. See the [full module](/templates/).
