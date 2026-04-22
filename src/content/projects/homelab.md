---
title: "Homelab Infrastructure as Code"
description: "Hybrid Cloud environment with Proxmox, Azure Arc and MikroTik."
date: "2026-03-24"
repoURL: "https://github.com/dwoitzik/homelab-infrastructure"
---

This project manages the lifecycle of local hardware and integrated cloud services through automated workflows. It serves as my primary sandbox for testing enterprise-grade configurations in a home environment.

### Infrastructure Stack
- **Hypervisor:** Proxmox VE (Ryzen 7 5725U)
- **Networking:** MikroTik RB5009 (RouterOS) with strict VLAN-based segmentation.
- **Edge Nodes:** 2x Raspberry Pi 4B (Debian) for lightweight services.
- **Cloud Governance:** Microsoft Azure (Arc-enabled) for a true Hybrid Cloud experience.

### Core Concepts
- **Zone Isolation:** Every service is isolated in its own VLAN.
- **Security:** DNS-01 SSL challenges via Cloudflare; WireGuard for secure remote administration.
- **Automation:** Fully automated via Terraform (Provisioning) and Ansible (Configuration Management).
- **CI/CD:** GitHub Actions for linting, validation, and automated deployment triggers.

### Repository Structure
I've organized the project into logical modules:
- `/network`: Logical topology and RouterOS definitions.
- `/terraform`: Provisioning logic for Proxmox and Cloudflare.
- `/ansible`: Node and application configuration.
- `/docker`: Container specs organized by network zone.