# ROBLYNE Render Deployment Guide

Follow `ROBLYNE_PRODUCTION_DEPLOYMENT_RUNBOOK.md` as the operational guide. This file exists at the requested name and the source of truth for service declarations is `render.yaml`.

Before creating the Blueprint, supply the Iven PostgreSQL URL, Iven Redis URL, S3-compatible storage credentials, selected web/API domains, and FlowPay credentials only if payment is enabled. Create all three services, deploy API (migration step), worker, then web. The first administrator is created by normal registration plus the one-time API bootstrap secret; no local database repair or demo seed is required.
