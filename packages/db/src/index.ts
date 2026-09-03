export { db, prismaWithoutTenantScoping } from "./client";

export { ImmutableRecordError } from "./tenant-scoping";

export {
  runWithTenant,
  unsafeRunWithoutTenantScoping,
  getTenantContext,
  MissingTenantContextError,
} from "./tenant-context";

export { listRecentAuditLogs, listAuditLogsForOrganizationPage, writeAuditLog, listAllAuditLogsSearch } from "./audit-log";
export type { AuditLogInput, PlatformAuditLogRow } from "./audit-log";

export { auditIfCrossTenantAttempt } from "./cross-tenant";
export type { CrossTenantAuditContext } from "./cross-tenant";

export { registerPermissions, PermissionKeyConflictError } from "./permission-registry";
export type { PermissionDefinition } from "./permission-registry";

export { EventBus, eventBus } from "./event-bus";
export type { EventHandler } from "./event-bus";

export {
  createOrganization,
  listOrganizationsSearch,
  listOrganizationsWithSummarySearch,
  suspendOrganization,
  reactivateOrganization,
  archiveOrganization,
  scheduleOrganizationDeletion,
  cancelScheduledDeletion,
  exportOrganizationData,
  executeDueOrganizationDeletions,
  OrganizationNotFoundError,
  InvalidOrganizationTransitionError,
} from "./organization-lifecycle";
export type { LifecycleActionContext, OrganizationExport, OrganizationSummaryRow } from "./organization-lifecycle";

export {
  getUserOrganizationPermissions,
  userHasOrganizationPermission,
  requireOrganizationPermission,
  getUserPlatformPermissions,
  userHasPlatformPermission,
  requirePlatformPermission,
  listPlatformAdminsSearch,
  ForbiddenError,
} from "./authorization";
export type { PlatformAdminRow } from "./authorization";

export {
  setPlatformSetting,
  getPlatformSetting,
  listPlatformSettings,
  setOrganizationSetting,
  getOrganizationSetting,
  listOrganizationSettings,
  setUserSetting,
  getUserSetting,
  listUserSettings,
  resolveSetting,
} from "./settings";
export type { SetSettingInput, SettingSummary, ResolvedSetting } from "./settings";

export {
  getBrandingSettings,
  setBrandingSettings,
  getAccessSettings,
  setAccessSettings,
  isRegistrationEnabled,
  getInvoiceNumberFormat,
  setInvoiceNumberFormat,
  formatInvoiceNumber,
  getSecurityDefaultSettings,
  setSecurityDefaultSettings,
  DEFAULT_INVOICE_NUMBER_FORMAT,
  CAPTCHA_PROVIDERS,
} from "./platform-config";
export type {
  BrandingSettings,
  AccessSettings,
  SecurityDefaultSettings,
  SetSecurityDefaultSettingsInput,
  CaptchaProvider,
} from "./platform-config";

export { encrypt, decrypt, MissingEncryptionKeyError } from "./encryption";

export type { AuthProvider, AuthResult } from "./auth/provider";

export { hashPassword, verifyPassword, assertPasswordStrength, WeakPasswordError } from "./auth/password";

export {
  createVerificationToken,
  consumeVerificationToken,
  InvalidOrExpiredTokenError,
} from "./auth/verification-tokens";

export { consoleEmailSender } from "./auth/email-sender";
export type { EmailSender } from "./auth/email-sender";

export {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  verifyMfaCode,
  verifyAndConsumeRecoveryCode,
  InvalidMfaCodeError,
  MfaNotPendingError,
} from "./auth/mfa";

export {
  createSession,
  resolveSession,
  getDefaultOrganizationId,
  switchSessionOrganization,
  listUserSessions,
  listUserSessionsSearch,
  listSessionsForOrganizationPage,
  revokeSession,
  revokeSessionForOrganization,
  revokeAllUserSessions,
  InvalidSessionError,
  NotAMemberError,
  SessionNotFoundError,
} from "./auth/session";
export type { CreateSessionInput, CreatedSession, ResolvedSession } from "./auth/session";

export {
  isGoogleConfigured,
  isAppleConfigured,
  beginGoogleAuth,
  beginAppleAuth,
  completeGoogleAuth,
  completeAppleAuth,
  resolveOAuthSignIn,
  listLinkedOAuthAccounts,
  UnverifiedEmailConflictError,
} from "./auth/oauth-provider";
export type { OAuthProfile, ResolvedOAuthSignIn, BeginOAuthResult } from "./auth/oauth-provider";

// Shared OAuth2/OIDC adapter contract (packages/db/src/auth/oauth-adapter.ts)
// + the registry any provider — starting with Microsoft/Entra ID — plugs
// into. MissingOAuthConfigError/OAuthAuthenticationError now live here
// (oauth-provider.ts re-exports the same classes for backward compatibility,
// so this isn't a breaking rename).
export { MissingOAuthConfigError, OAuthAuthenticationError } from "./auth/oauth-adapter";
export type { OAuthAdapter, OAuthAuthorizeResult, OAuthConfigField } from "./auth/oauth-adapter";

export { registerOAuthAdapter, getOAuthAdapter, listOAuthAdapters } from "./auth/oauth-registry";

export {
  oauthConfigSettingKey,
  getOAuthProviderConfigValue,
  setOAuthProviderConfigValue,
  isOAuthProviderEnabled,
  setOAuthProviderEnabled,
  hasRequiredOAuthProviderConfig,
  listOAuthProviderStatuses,
} from "./auth/oauth-provider-config";
export type { OAuthProviderStatus, OAuthProviderFieldStatus } from "./auth/oauth-provider-config";

// Importing this module registers microsoftEntraIdAdapter into the registry
// above (module-scope side effect, see that file's bottom) — every consumer
// of @saasclaude/db gets it for free, same as this file already guarantees
// for every other core registrant.
export { ADAPTER_ID as MICROSOFT_ENTRA_ID_ADAPTER_ID, microsoftEntraIdAdapter } from "./auth/oauth-microsoft-entra-id";

export {
  localAuthProvider,
  signUp,
  verifyEmail,
  login,
  completeMfaLogin,
  requestPasswordReset,
  resetPassword,
  changePassword,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountNotActiveError,
  InvalidMfaChallengeError,
} from "./auth/local-provider";
export type { SignUpInput, LoginResult, ChangePasswordInput } from "./auth/local-provider";

export { startImpersonation, endImpersonation, TargetNotOrganizationMemberError } from "./auth/impersonation";

export { maybeGrantBootstrapSuperAdmin } from "./auth/platform-bootstrap";

export {
  inviteUserToOrganization,
  acceptOrganizationInvite,
  listPendingInvites,
  listPendingInvitesPage,
  revokeInvite,
  cancelInvite,
  listOrganizationMembers,
  listOrganizationMembersPage,
  removeOrganizationMember,
  InvalidOrExpiredInviteError,
  MembershipNotFoundError,
  AlreadyMemberError,
  InviteAlreadyPendingError,
  InviteNotFoundError,
  listOrganizationMembersSearch,
  listPendingInvitesSearch,
  countActiveOrganizationMembers,
  acceptPendingInviteForOAuthUser,
} from "./organization-invites";
export type { InviteUserInput, AcceptInviteInput } from "./organization-invites";

export {
  listRoles,
  listRolesPage,
  getOrganizationOwnerUserId,
  listMemberRoleNames,
  listMemberRoleIds,
  setMemberSingleRole,
  getRoleWithPermissions,
  createRole,
  deleteRole,
  setRolePermissions,
  assignRoleToUser,
  unassignRoleFromUser,
  listRoleAssigneesSearch,
  listAllTenantRolesSearch,
  listRolesVisibleToOrganization,
  listGlobalRolesSearch,
  createGlobalRole,
  updateGlobalRoleDetails,
  getGlobalRoleWithPermissions,
  setGlobalRolePermissions,
  deleteGlobalRole,
  findVisibleRole,
  RoleNotFoundError,
  UserNotAMemberError,
  UserRoleNotFoundError,
  OwnerRoleImmutableError,
  LastOwnerError,
  DuplicateGlobalRoleNameError,
  OWNER_ROLE_SLUG,
  seedDefaultRoles,
} from "./roles";
export type {
  RoleWithPermissionKeys,
  RoleAssigneeRow,
  PlatformRoleRow,
  VisibleRoleRow,
  GlobalRoleRow,
} from "./roles";

export { clampPageLimit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./pagination";
export type { PageParams, PageResult } from "./pagination";

export {
  registerResourceTypes,
  getResourceType,
  listResourceTypes,
  ResourceTypeKeyConflictError,
} from "./billing/resource-types";
export type { ResourceTypeDefinition } from "./billing/resource-types";

export {
  CORE_CURRENCIES,
  seedCoreCurrencies,
  listActiveCurrencies,
  listCurrenciesSearch,
  getCurrency,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  CurrencyNotFoundError,
  DuplicateCurrencyCodeError,
} from "./billing/currencies";
export type { CurrencyInput } from "./billing/currencies";

export {
  getTaxSettings,
  setTaxSettings,
  listTaxRatesByCountry,
  setTaxRateForCountry,
  removeTaxRateForCountry,
  resolveTaxRatePercent,
} from "./billing/tax";
export type { TaxSettings } from "./billing/tax";

export {
  recordResourceUsage,
  getResourceUsage,
  recordResourceUsageWithQuota,
  UnknownResourceTypeError,
  ResourceQuotaExceededError,
} from "./billing/resource-consumption";
export type { RecordUsageInput, GetUsageOptions } from "./billing/resource-consumption";

export {
  createPlanVersion,
  getCurrentPlan,
  getPlanVersion,
  getPlanById,
  listPlans,
  listPlansSearch,
  setPlanVisibility,
  createAddOn,
  listAddOns,
  getAddOn,
} from "./billing/plans";
export type {
  CreatePlanVersionInput,
  PlanResourceAllocation,
  PlanFeatureGrant,
  ListPlansOptions,
  CreateAddOnInput,
  AddOnResourceGrant,
} from "./billing/plans";

export {
  registerFeatures,
  getFeature,
  listFeatures,
  isFeatureEnabled,
  getEnabledFeaturesForContext,
  setOrganizationFeatureOverride,
  clearOrganizationFeatureOverride,
  setUserFeatureOverride,
  clearUserFeatureOverride,
  FeatureKeyConflictError,
  UnknownFeatureError,
} from "./billing/features";
export type { FeatureDefinition, FeatureContext } from "./billing/features";

export { redis } from "./redis-client";

export { checkRateLimit, enforceRateLimit, RateLimitExceededError } from "./rate-limit";
export type { RateLimitOptions, RateLimitResult } from "./rate-limit";

export type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  PaymentProviderConfigField,
  ProviderWebhookEvent,
} from "./billing/payment-provider";

export {
  createStripeProvider,
  MissingStripeConfigError,
  InvalidWebhookSignatureError,
} from "./billing/stripe-provider";
export type { StripeProviderOptions } from "./billing/stripe-provider";

// PayPal adapter (this round's real second PaymentProvider, proving the
// contract above isn't Stripe-shaped-only — see payment-provider.ts's
// header comment) + the generic registry/Settings-config plumbing it proves,
// structurally identical to the OAuth adapter framework's exports above.
export {
  registerPaymentProviderAdapter,
  getPaymentProviderAdapter,
  listPaymentProviderAdapters,
} from "./billing/payment-provider-registry";

export {
  paymentProviderConfigSettingKey,
  getPaymentProviderConfigValue,
  setPaymentProviderConfigValue,
  isPaymentProviderEnabled,
  setPaymentProviderEnabled,
  hasRequiredPaymentProviderConfig,
  listPaymentProviderStatuses,
} from "./billing/payment-provider-config";
export type { PaymentProviderStatus, PaymentProviderFieldStatus } from "./billing/payment-provider-config";

export {
  createPayPalProvider,
  paypalAdapter,
  encodePayPalWebhookHeaders,
  MissingPayPalConfigError,
  PayPalInvalidWebhookSignatureError,
  ADAPTER_ID as PAYPAL_ADAPTER_ID,
} from "./billing/paypal-provider";
export type { PayPalProviderOptions, PayPalWebhookHeaders } from "./billing/paypal-provider";

export {
  createSubscription,
  renewSubscription,
  extendSubscription,
  pauseSubscription,
  resumeSubscription,
  terminateSubscription,
  cancelSubscription,
  upgradeSubscription,
  downgradeSubscription,
  assignSubscriptionPlan,
  manuallyAdjustSubscription,
  executeDueCancellations,
  attachAddOn,
  detachAddOn,
  getActiveSubscription,
  getOrganizationResourceQuota,
  getResourceUsageSummary,
  recordResourceUsageEnforced,
  listSubscriptionsForOrganizationSearch,
  SubscriptionNotFoundError,
  PlanNotFoundError,
  AddOnNotFoundError,
  InvalidSubscriptionTransitionError,
} from "./billing/subscriptions";
export type {
  CreateSubscriptionInput,
  LifecycleActionContext as SubscriptionLifecycleActionContext,
  ManualAdjustmentInput,
  ResourceUsageSummary,
  SubscriptionHistoryRow,
} from "./billing/subscriptions";

export {
  listOrganizationBillingSummaries,
  listOrganizationBillingSummariesSearch,
  getOrganizationSubscriptionOverview,
  listOrganizationInvoicesSearch,
  listSubscriptionEventsSearch,
  listWebhookEventsSearch,
  listAllInvoicesSearch,
  listAllSubscriptionsSearch,
  listAllWebhookEventsSearch,
  listInvoicesForSubscriptionSearch,
  listSubscriptionEventsForSubscriptionSearch,
} from "./billing/super-admin-billing";
export type {
  BillingSummaryRow,
  PlatformInvoiceRow,
  PlatformSubscriptionRow,
  PlatformWebhookEventRow,
} from "./billing/super-admin-billing";

export { clampListPageSize, clampPage, toSkipTake, toListQueryResult } from "./list-query";
export type { ListQueryParams, ListQueryResult } from "./list-query";

export {
  getOrganizationGrowth,
  getPlanDistribution,
  listRecentActivity,
  listRecentCustomers,
  listRecentSubscriptions,
  countOrganizations,
  countActiveSubscriptions,
  countActiveMembers,
} from "./platform-dashboard";
export type {
  GrowthPoint,
  PlanDistributionEntry,
  RecentActivityRow,
  RecentCustomerRow,
  RecentSubscriptionRow,
} from "./platform-dashboard";

export {
  createDraftInvoice,
  addInvoiceLineItem,
  removeInvoiceLineItem,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
  createCreditNote,
  getInvoice,
  listInvoices,
  listInvoicesPage,
  listCreditNotes,
  InvoiceNotFoundError,
  InvoiceNotDraftError,
  InvalidInvoiceTransitionError,
} from "./billing/invoices";
export type {
  InvoiceLineItemInput,
  CreateDraftInvoiceInput,
  CreateCreditNoteInput,
  ListInvoicesOptions,
} from "./billing/invoices";

export {
  createApiKey,
  verifyApiKey,
  apiKeyHasScope,
  listApiKeys,
  listApiKeysSearch,
  revokeApiKey,
  InvalidApiKeyError,
  ApiKeyNotFoundError,
} from "./api-keys";
export type { CreateApiKeyInput, CreatedApiKey, ResolvedApiKey } from "./api-keys";

// Notification-channel adapter framework (§2.14 / CLAUDE.md's provider-
// adapter rule) — the third instance of the same shape as the OAuth and
// payment-provider adapter frameworks: contract + registry + Settings-backed
// config + registry-driven Super Admin UI, proved with two real channels
// (email/webhook) plus the in-app channel's own storage. Importing
// email-channel.ts/webhook-channel.ts/in-app-channel.ts self-registers all
// three (module-scope side effect, same convention as
// oauth-microsoft-entra-id.ts/paypal-provider.ts) — every consumer of
// @saasclaude/db gets them for free.
export type {
  NotificationChannel,
  NotificationChannelConfigField,
  NotificationMessage,
  NotificationSendResult,
} from "./notifications/channel";

export {
  registerNotificationChannel,
  getNotificationChannel,
  listNotificationChannels,
} from "./notifications/channel-registry";

export {
  notificationChannelConfigSettingKey,
  getNotificationChannelConfigValue,
  setNotificationChannelConfigValue,
  isNotificationChannelEnabled,
  setNotificationChannelEnabled,
  hasRequiredNotificationChannelConfig,
  listNotificationChannelStatuses,
} from "./notifications/channel-config";
export type { NotificationChannelStatus, NotificationChannelFieldStatus } from "./notifications/channel-config";

export {
  registerNotificationKinds,
  getNotificationKind,
  listNotificationKinds,
  NotificationKindKeyConflictError,
} from "./notifications/notification-kind-registry";
export type { NotificationKindDefinition } from "./notifications/notification-kind-registry";

export { sendNotification, renderNotificationTemplate, NotificationKindNotFoundError } from "./notifications/notify";
export type { SendNotificationInput, NotificationDispatchResult } from "./notifications/notify";

export {
  emailNotificationChannel,
  resolveEmailSender,
  createEmailChannel,
  ADAPTER_ID as EMAIL_CHANNEL_ADAPTER_ID,
} from "./notifications/email-channel";

export {
  webhookNotificationChannel,
  WEBHOOK_SIGNATURE_HEADER,
  ADAPTER_ID as WEBHOOK_CHANNEL_ADAPTER_ID,
} from "./notifications/webhook-channel";

export {
  inAppNotificationChannel,
  listInAppNotifications,
  listInAppNotificationsPage,
  ADAPTER_ID as IN_APP_CHANNEL_ADAPTER_ID,
} from "./notifications/in-app-channel";

export { PrismaClient } from "../generated/client";
export type * from "../generated/client";
