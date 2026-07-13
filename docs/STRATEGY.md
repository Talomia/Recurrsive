# Product and Deployment Strategy

Recurrsive is distributed as self-hosted Apache-2.0 software. The product strategy is to make repository analysis trustworthy and operable before expanding into automated execution or managed hosting.

## Product boundary

The production product analyzes registered projects, stores evidence and derived opportunities, and lets authenticated teams inspect, govern, schedule, export, and integrate those results. It does not claim to operate customer cloud infrastructure or to execute changes in source repositories.

## Deployment boundary

One deployment is one administrative and data boundary. Projects and users share that deployment's configured database. There is no customer-tenant isolation layer. Organizations that require hard isolation should deploy separate stacks and databases.

Local development may use SQLite. Production requires PostgreSQL with Apache AGE and validated secrets. Docker Compose and EasyPanel are the supported deployment targets in this repository.

## Commercial boundary

The software is not feature-paywalled in this repository. Paid work, if offered, covers production support, deployment review, custom integration, and implementation services. There is no currently operated managed Recurrsive cloud.

## Trust principles

1. Evidence is preserved from collector to finding to opportunity.
2. Empty data and unavailable services are shown as such; clients do not silently invent success.
3. Forecasts are labeled projections, use recorded health scores, and require sufficient history.
4. Security-sensitive configuration fails closed in production.
5. A surface is removed when its name implies execution, isolation, or guarantees the implementation does not provide.

## Expansion criteria

A new execution or hosted capability is production-ready only when it has real provider integration, scoped authorization, durable state, failure recovery, audit evidence, observability, tests, and an operator runbook.
