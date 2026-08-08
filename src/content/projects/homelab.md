---
title: "Homelab Infrastructure as Code"
description: "Full-stack homelab managed entirely through Terraform and Ansible — Proxmox, k3s, MikroTik, and GitOps via Atlantis."
date: "2026-03-24"
repoURL: "https://github.com/dwoitzik/homelab-infrastructure"
---

Production-grade infrastructure patterns running on consumer hardware. Everything is code — no manual clicks, no configuration drift.

### Stack

- **Hypervisor:** Proxmox VE on Ryzen 7 5725U
- **Orchestration:** k3s (single-node) with ArgoCD GitOps
- **Networking:** MikroTik RB5009 — zero-trust firewall, VLAN segmentation, WireGuard VPN
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
