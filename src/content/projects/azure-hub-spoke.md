---
title: "Azure Hub & Spoke Network (Base Edition)"
description: "Production-ready Terraform template for a standard Hub & Spoke topology in Azure — VNet peering, centralized routing, free to use."
date: "2026-01-15"
repoURL: "https://github.com/dwoitzik/azure-network-hub-spoke"
---

A clean, deployable Hub & Spoke foundation for Azure. Establishes isolated Spoke VNets connected via bidirectional VNet peering to a central Hub — ready for workload deployment in minutes.

### What's included
- Central Hub VNet for shared services (Firewall, DNS, Bastion)
- Two pre-configured Spoke VNets with bidirectional peering
- `allow_forwarded_traffic` enabled for Hub-routed flows
- Clean variable structure — customize via `terraform.tfvars`

### Limitations (Base Edition)
No NSGs, no Azure Firewall, no Private DNS Zones. The [Enterprise Edition](/templates/) adds zero-trust NSGs, centralized Private DNS, and DINE-policy bypass logic.
