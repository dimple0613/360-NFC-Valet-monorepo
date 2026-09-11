// FR-220: authentication is provider-based. Phase 1 implements only Local
// (email+password, this directory); OAuth2/OIDC/SAML/LDAP/social/passkeys are
// future adapters implementing this same interface — core auth flow (session
// creation, MFA, tenant context) never needs to know which provider ran.
//
// Deliberately minimal: a provider's job is "given credentials, resolve which
// user this is (or fail)." Everything downstream of that — session creation,
// MFA challenge, audit logging — is provider-agnostic and lives outside any
// one provider's adapter.

export interface AuthResult {
  userId: string;
}

export interface AuthProvider<Credentials> {
  /** Stable identifier, e.g. "local", "google" — used in audit logs and provider selection. */
  readonly id: string;
  authenticate(credentials: Credentials): Promise<AuthResult>;
}
