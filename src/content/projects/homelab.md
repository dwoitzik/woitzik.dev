---
title: "Homelab Infrastructure as Code"
description: "Full-stack homelab managed through Terraform and Ansible: Proxmox, a three-node k3s cluster, MikroTik, and GitOps via Atlantis."
date: "2026-03-24"
repoURL: "https://github.com/dwoitzik/homelab-infrastructure"
---

Production infrastructure patterns on consumer hardware. Proxmox, the MikroTik router, and the k3s cluster are defined in Git and changed through Atlantis and ArgoCD, not by hand.

### Stack

- **Hypervisor:** Proxmox VE on Ryzen 7 5825U
- **Orchestration:** k3s, three nodes (one server, two agents) with ArgoCD GitOps
- **Networking:** MikroTik RB5009 with a default-drop firewall and VLAN segmentation
- **Edge:** 2× Raspberry Pi 4B for lightweight DNS and monitoring
- **Provisioning:** Terraform (Proxmox, MikroTik, Cloudflare)
- **Configuration:** Ansible with Vault-encrypted secrets
- **GitOps:** Atlantis for Terraform, ArgoCD for Kubernetes workloads

### Running Services

- MetalLB + Traefik for ingress with wildcard TLS (cert-manager + Cloudflare DNS-01)
- Authelia SSO with OIDC for all internal services
- Headscale (self-hosted Tailscale) for remote access
- Prometheus + Loki + Grafana for observability
- Velero + Garage S3 for cluster backups
- Unbound + AdGuard Home with Keepalived for HA DNS

The Ansible layer that orchestrates this stack is documented in [Architecting an Enterprise-Grade Homelab](/blog/enterprise-homelab-architecture-ansible/), and the network security controls are covered in the [Zero-Trust MikroTik firewall](/blog/mikrotik-zero-trust-firewall-terraform/) and [VLAN filtering](/blog/mikrotik-vlan-filtering-terraform-proxmox/) posts.
