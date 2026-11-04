---
title: "Azure Hub & Spoke Network"
description: "Terraform template for a standard Hub & Spoke topology in Azure: VNet peering, Zero-Trust NSGs, and centralized Private DNS. Free and MIT licensed."
date: "2026-01-15"
repoURL: "https://github.com/dwoitzik/terraform-azurerm-hub-spoke"
---

A deployable Hub & Spoke foundation for Azure. Two isolated Spoke VNets connect to a central Hub through bidirectional VNet peering, ready for workloads.

### What's included

- Central Hub VNet for shared services (Firewall, DNS, Bastion)
- Two pre-configured Spoke VNets with bidirectional peering
- Zero-Trust NSG baseline bound to every spoke subnet
- Centralized Private DNS Zones with DINE-policy-safe lifecycle rules
- All settings in one place: `terraform.tfvars`

Free and MIT licensed. See the [full module](/templates/).
