---
title: "Azure Hub & Spoke Network"
description: "Production-ready Terraform template for a standard Hub & Spoke topology in Azure — VNet peering, Zero-Trust NSGs, centralized Private DNS, free to use."
date: "2026-01-15"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-hub-spoke"
---

A clean, deployable Hub & Spoke foundation for Azure. Establishes isolated Spoke VNets connected via bidirectional VNet peering to a central Hub — ready for workload deployment in minutes.

### What's included

- Central Hub VNet for shared services (Firewall, DNS, Bastion)
- Two pre-configured Spoke VNets with bidirectional peering
- Zero-Trust NSG baseline bound to every spoke subnet
- Centralized Private DNS Zones with DINE-policy-safe lifecycle rules
- Clean variable structure — customize via `terraform.tfvars`

Free and MIT licensed — see the [full module](/templates/).
