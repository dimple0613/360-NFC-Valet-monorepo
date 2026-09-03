# Requirements

## 1. Overview

This platform is a **generic, enterprise-grade, API-first, plugin-driven, multi-tenant SaaS boilerplate**. It is the foundation for *any* SaaS product. The core contains **zero business-domain functionality**: no terminology or features tied to any industry (e.g. marketing, CRM, ERP, inventory, healthcare, HRMS, POS, education, finance, booking, or commerce). Such capabilities may only exist as optional modules or plugins.

Scale requirements: unlimited organizations (tenants), users, modules, plugins, integrations, resource types, payment providers, authentication providers, notification providers, and feature extensions.

## 2. Functional Requirements

### 2.1 Multi-Tenancy and Isolation
- FR-100: Every organization is an isolated tenant; one tenant's data must never be readable or writable by another tenant.
- FR-101: Tenant scoping is enforced automatically at the persistence layer (global query scopes + tenant context), never left to individual controllers.
- FR-102: The following are all tenant-scoped automatically: database queries, cache entries, file uploads/storage paths, API endpoints, scheduled jobs, queue workers/jobs, notifications, reports, search indexes, webhooks, domain events, audit logs, and integrations.
- FR-103: Tenant context is resolved per request (session current-organization for web, header/token scope for API) and per job (serialized with queued payloads).
- FR-104: Cross-tenant access attempts return 404 (not 403) to avoid information leaks and are audit-logged.
- FR-105: Users may belong to multiple organizations and switch the active organization.
- FR-106: Organizations have a flat membership model — users belong directly to an organization via a single membership record; there is no nested team/workspace sub-structure. (An earlier nested Team/Workspace design was built in Phase 1A and removed as unnecessary complexity — see TASKS.md.)

### 2.2 Super Admin Portal (Platform Operations)
- FR-110: A dedicated portal, fully independent from tenant UI, for operating the SaaS platform itself.
- FR-111: Manages: organizations, subscriptions, plans, billing, invoices, users, platform administrators, roles, permissions, reports, resources, currencies, taxes, settings, integrations, plugins, notifications, payment providers, authentication providers, audit logs, licensing, feature flags, update management, API management, webhooks, monitoring, backups, storage providers, queues, scheduled jobs, and analytics.
- FR-112: Super Admins can impersonate any organization administrator without a password; impersonation is time-boxed, visibly indicated, and fully audit-logged.
- FR-113: Platform administrators have their own RBAC (platform roles are distinct from tenant roles).

### 2.3 Tenant Admin Portal (Organization Administration)
- FR-120: A dedicated portal scoped to exactly one organization.
- FR-121: Manages: organization profile, users, custom roles, subscriptions, invoices, billing information, reports, API keys, integrations, automation, resources, settings, notifications, and organization configuration.
- FR-122: Tenant admins can create custom roles from the permissions exposed by installed modules.

### 2.4 Organization (Customer) Management
- FR-130: Customers are organizations, not individual users.
- FR-131: An organization record contains: company information, branding, contact information, billing information, tax information, users, roles, permissions, subscriptions, invoices, resources, integrations, custom metadata, audit history, activity logs, API credentials, and configurable settings.
- FR-132: Organizations can be created, suspended, reactivated, archived, and deleted (with grace period and export).
- FR-133: Organization lifecycle events (created, suspended, plan changed, etc.) are published on the event bus for modules/plugins.

### 2.5 Modules and Plugins
- FR-140: Every capability ships as a module. A module contains its own: database migrations, models, repositories, services, validation, policies, permissions, events, listeners, notifications, scheduled jobs, APIs, UI components, tests, localization, documentation, and configuration.
- FR-141: Modules are installable, removable, upgradeable, enableable/disableable per organization, and independently versioned (semver) with declared dependencies.
- FR-142: Plugins can register: routes, menus, modules, permissions, widgets, resources, settings, integrations, APIs, webhooks, notification channels, scheduled jobs, event listeners, reports, dashboard widgets, and UI components without modifying the core.
- FR-143: A module/plugin registry tracks installed versions, migration state, and health; failed installs roll back cleanly.
- FR-144: Nothing is hardcoded: menus, navigation, permissions, resource limits, dashboard widgets, integrations, settings, providers, features, plans, currencies, taxes, payment gateways, authentication providers, notification channels, and business rules are configuration-driven (admin UI or configuration database).

### 2.6 RBAC (Roles and Permissions)
- FR-150: Roles are never hardcoded; they are data, creatable at platform level and per organization.
- FR-151: Permission granularity: module level, page level, feature level, action level, API level, field level, resource level, and custom permission groups.
- FR-152: Every module auto-registers its permissions with the RBAC registry at install time.
- FR-153: Authorization is enforced server-side on every endpoint via policies; UI visibility is derived from the same permission data.
- FR-154: ABAC-style conditions (e.g. ownership, resource attribute matches) supported where needed.

### 2.7 Subscription Management
- FR-160: Subscriptions are generic (not tied to any provider or domain) and belong to an organization.
- FR-161: A subscription contains: billing information, renewal schedule, expiration date, trial information, usage statistics, resource allocation, resource consumption, invoices, payment history, activity history, audit logs, upgrade history, downgrade history, cancellation history, and add-on purchases.
- FR-162: Administrators can create, renew, extend, pause, resume, terminate, cancel, upgrade, downgrade, and manually adjust subscriptions.
- FR-163: Grace periods, dunning, and expiry behavior are configurable per plan.

### 2.8 Resource Management Engine
- FR-170: Resources are generic, plan-assigned quotas (examples: API Requests, Storage, AI Credits, Team Members, Projects, Records, Transactions, Automation Runs, Devices, Seats, Custom Objects, Integrations, or any custom type).
- FR-171: Developers/modules register new resource types via the registry **without modifying the database schema**.
- FR-172: Resource types declare: unit, aggregation (counter/gauge/metered), reset cycle, overage policy (block/allow/bill), and display metadata.
- FR-173: Consumption is tracked per organization (and optionally per user), enforced at the service layer, and exposed to billing for metered charges.

### 2.9 Plan Management
- FR-180: Plans define: pricing, billing cycles, features, resources, visibility, upgrade policies, downgrade policies, grace periods, trial rules, renewal rules, cancellation rules, integrations, and purchasable add-ons.
- FR-181: Plan types supported: Free, Trial, Monthly, Yearly, Lifetime, Enterprise, Usage-Based, Custom Pricing, Invite Only, and Hidden.
- FR-182: Plans are versioned; existing subscribers stay on their plan version until migrated.
- FR-183: Add-ons are purchasable resource/feature bundles attachable to a subscription.

### 2.10 Feature Flags
- FR-190: Features can be enabled globally, per plan, per organization, or per user, with that precedence.
- FR-191: Modules auto-register their available features at install time.
- FR-192: Flag checks are cached and available to backend, frontend, and API consumers.

### 2.11 Billing
- FR-200: Billing supports: invoices, recurring billing, one-time billing, metered billing, taxes, discounts, coupons, refunds, adjustments, credit notes, partial payments, payment history, multiple currencies, multiple tax profiles, downloadable invoices (PDF), audit logs, and scheduled invoice generation.
- FR-201: Invoices are immutable once issued; corrections use credit notes/adjustments.
- FR-202: Multi-currency: prices, invoices, and payments carry explicit currency; exchange-rate sources configurable.

### 2.12 Payment Providers
- FR-210: Payment processing uses a provider adapter architecture; multiple providers can be active simultaneously.
- FR-211: Target adapters: Stripe, Razorpay, Paddle, Lemon Squeezy, PayPal, Braintree, Authorize.Net, Square, Bank Transfer, Offline Payments, Crypto Payments, and future providers.
- FR-212: Per provider configurable: credentials, webhooks, retry logic, supported currencies, environments (test/live), and payment methods.
- FR-213: Webhooks are signature-verified, idempotent, and replayable.

### 2.13 Authentication Providers
- FR-220: Authentication uses a provider architecture supporting: Local Authentication, OAuth2, OpenID Connect, SAML, LDAP, Active Directory, Microsoft Entra ID, Google, Microsoft, Apple, Facebook, GitHub, GitLab, LinkedIn, Twitter, Passkeys, Magic Links, Multi-Factor Authentication, and future providers.
- FR-221: Providers are enabled/configured per platform and optionally per organization (e.g. enterprise SSO for one tenant).
- FR-222: MFA supports TOTP, recovery codes, and passkeys; MFA can be enforced per role/organization.
- FR-223: Session management: active session/device list, revocation, IP restrictions, configurable session lifetimes.

### 2.14 Notification Framework
- FR-230: Channels: Email, SMS, Push, WhatsApp, Slack, Microsoft Teams, Discord, Telegram, In-App, Webhooks, and custom channels via adapters.
- FR-231: Configurable: templates, variables, branding, localization, scheduling, retry logic, priorities, categories, and delivery rules (per channel, per category, per user preference).
- FR-232: Template rendering supports per-organization branding and locale fallback.

### 2.15 Integration Framework
- FR-240: Standardized adapter contracts for: Payment Providers, AI Providers, Authentication Providers, Storage Providers, Analytics Platforms, Communication Platforms, ERP Systems, CRM Systems, Accounting Platforms, Document Providers, Webhooks, REST APIs, GraphQL APIs, Message Queues, Search Providers, and future integrations. (Adapters for external systems are integration points, not domain features in core.)
- FR-241: Integrations are configured per platform or per organization with encrypted credentials, health checks, and logs.
- FR-242: Outbound webhooks: subscribable events, signed payloads, retries with backoff, delivery logs.

### 2.16 Localization
- FR-250: Multiple languages, currencies, countries, regions, tax profiles, timezones, date formats, number formats, calendars, translations, locale fallbacks, RTL languages, and regional formatting.
- FR-251: Translations are file-based per module with database overrides; missing keys fall back by locale chain.
- FR-252: Users and organizations each have locale/timezone/format preferences (user overrides org, org overrides platform).

### 2.17 Tax Management
- FR-260: Supports VAT, GST, Sales Tax, Digital Taxes, Withholding Taxes, Country Tax Rules, Regional Tax Rules, Tax Categories, Tax Profiles, Exemptions, Reverse Charge, Inclusive Tax, Exclusive Tax, and pluggable/configurable tax engines.
- FR-261: Tax resolution: organization tax profile + jurisdiction rules -> applied rates on invoices, with audit trail of the calculation.

### 2.18 Settings Management
- FR-270: Centralized settings service with categories: General, Branding, Appearance, Security, Authentication, Billing, Localization, Notifications, Email Providers, Storage Providers, Payment Providers, Integrations, API, Queues, Cache, Scheduled Jobs, Monitoring, Logging, Licensing, Feature Flags, Maintenance Mode, Backups, Update Manager, Audit Configuration, Compliance, and Advanced.
- FR-271: Settings have scopes (platform, organization, user) with inheritance and override rules; sensitive values are encrypted at rest.
- FR-272: Modules/plugins register their own settings schemas (type, validation, UI hints) so settings UIs are generated, not hardcoded.

### 2.19 Audit Logging
- FR-280: Every important action is recorded with: user, organization, module, resource, timestamp, IP address, browser/user agent, previous values, new values, request information, and system events.
- FR-281: Audit logs support filtering, searching, exporting, and rollback where the action is reversible.
- FR-282: Audit records are immutable and retention is configurable (compliance).

### 2.20 Reporting Engine
- FR-290: Reports support filtering, grouping, charting, exporting, scheduling, custom dashboards, drill-down analytics, and API access.
- FR-291: Export formats: CSV, Excel, PDF.
- FR-292: A reusable report-builder abstraction lets modules define reports declaratively; scheduled reports deliver via the notification framework.

### 2.21 Dynamic Dashboards
- FR-300: Dashboards are composed of reusable widgets; admins can add, remove, resize, reorder, configure, enable, disable, and create widgets without code changes.
- FR-301: Widget types: statistics, KPI cards, charts, reports, recent activities, notifications, quick actions, usage summaries, billing summaries, resource monitoring, and custom extensions registered by modules/plugins.
- FR-302: Dashboard layouts are persisted per portal, per role, and per user.

### 2.22 UI Standards
- FR-310: Every list page supports: searching, sorting, filtering, pagination, saved views, bulk actions, column selection, export, import, keyboard shortcuts, responsive layouts, empty states, loading states, and API-backed pagination.
- FR-311: Every form includes: client-side validation, server-side validation, reusable components, autosave where appropriate, confirmation dialogs, optimistic updates, undo support, accessibility, keyboard navigation, localization, and audit tracking.

### 2.23 APIs
- FR-320: REST APIs (GraphQL optional) exist for every module.
- FR-321: APIs support: versioning, OpenAPI documentation, authentication, authorization, rate limiting, pagination, filtering, sorting, field selection, webhooks, API tokens, OAuth scopes, and SDK generation.
- FR-322: API keys are managed per organization with scopes, expiry, and per-key rate limits.

## 3. Non-Functional Requirements

- NFR-1 Architecture: Clean Architecture, SOLID, DDD where appropriate, Repository Pattern, Service Layer, Dependency Injection, Event-Driven Architecture, Background Workers, Queues, Scheduled Jobs, Caching, Transactions, CQRS where beneficial.
- NFR-2 Security: RBAC + ABAC, MFA, passkeys, session and device management, IP restrictions, rate limiting, CSRF/XSS protection, CSP, encryption at rest and in transit, secure secret management, audit trails, compliance logging, security monitoring.
- NFR-3 Performance: API p95 < 300 ms for standard endpoints; tenant-scoped queries always indexed.
- NFR-4 Availability: 99.9% target; stateless web/API workers, horizontal scaling.
- NFR-5 Privacy/Compliance: GDPR-ready (export, deletion, consent logging), configurable data retention, compliance audit trails.
- NFR-6 Localization: i18n across web, mobile, API errors, notifications, and documents; RTL support.
- NFR-7 Accessibility: WCAG 2.1 AA for both portals.
- NFR-8 Observability: structured logs, metrics, health checks, error tracking, queue/job monitoring, backup monitoring.
- NFR-9 Testing: unit + feature tests per module; tenant-isolation regression suite; critical-path E2E.
- NFR-10 Documentation: OpenAPI kept in sync; each module ships its own docs; ADRs for decisions.
- NFR-11 Maintainability: consistent naming, small components, no business logic in controllers, module boundaries enforced.

## 4. Explicit Non-Goals (Core)

- No business-domain features in core (only modules/plugins).
- No hardcoded providers, plans, limits, menus, roles, or business rules.
- No cross-tenant data access paths, even for convenience.

## 5. Assumptions

- Local development uses PostgreSQL (local database) with Prisma ORM and Redis for caching, queues, and real-time features.
- Production uses Neon PostgreSQL with the same Prisma schema and migrations.
- Monorepo layout: `web/` (Next.js + React + shadcn/ui), `packages/` (shared libraries, types, and utilities), `plugins/`, and `mobile/`.
- The web application is built with Next.js using the App Router, TypeScript, Tailwind CSS, and shadcn/ui components.
- Web and mobile applications consume versioned REST APIs.
- Environment-specific configuration is managed through environment variables, allowing seamless deployment from local PostgreSQL to Neon PostgreSQL without code changes.

# Documentation Rules

Always use Context7 whenever:

- generating code
- configuring libraries
- writing API integrations
- using frameworks
- debugging library errors

# Coding Rules

Always use Context7 before:

- Laravel development
- React development
- Next.js development
- Rust crates
- PostgreSQL
- Docker
- Redis
- GraphQL
- OpenAI APIs
- Anthropic APIs
- MCP integrations