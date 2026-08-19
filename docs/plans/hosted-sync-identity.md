# Moat — Sign in with Google, Microsoft or Apple

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Plan, not started |
| Owner | Piira |
| Last Updated | 2026-08-19 |
| Scope | How a user gets a sync account without being handed a token by hand |

Today the only way onto hosted sync is a token minted on the server and pasted
into settings. That is fine for one developer and no good for anyone else.

## The rule that decides the design

**Signing in gets you an account. It does not get you your data.**

The device key never leaves the device except inside an encrypted backup.
Records are sealed with a key derived from it before they are pushed, so the
server holds ciphertext. If signing in with Google also unlocked the ledger,
then Google, or anyone who takes over that Google account, could read every
transaction. Sign-in is for *who you are*, not *what you can read*.

The cost is real and worth stating up front: signing in on a second device
gets you your synced records but not the key to open them. The user still
needs their PIN and their backup file. Anything that removes that step also
removes the encryption.

## What shapes the flow

The web app is a static export. There are no route handlers and no server on
the web side. The only server is the sync server, which already runs as one
Node process next to the database. So the sync server is where sign-in has to
live.

## Recommended flow

OIDC Authorization Code with PKCE, with the sync server exchanging the code.

1. The app sends the browser to the provider's authorize URL with PKCE.
2. The provider sends the browser back to the app with a code.
3. The app posts the code and the PKCE verifier to `POST /v1/auth/callback`.
4. The server exchanges the code with the provider, then verifies the ID token
   against that provider's JWKS: signature, `iss`, `aud`, `exp`, `nonce`.
5. The server maps `(issuer, subject)` to a user in a new `sync_identities`
   table, creating one on first sign-in.
6. The server mints a row in `sync_credentials`, exactly as `mint` does now,
   and returns the token once.
7. The app stores it and uses it as the bearer, unchanged from today.

Why the exchange is server-side and not in the browser:

- Apple cannot be done from a browser at all. Its client secret is a JWT you
  sign yourself, so it needs a private key the browser must never hold.
- One code path for every provider instead of two.
- The app never touches a provider refresh token.
- Revocation stays in your own table, not the provider's.

Steps 6 and 7 mean nothing downstream changes. The bearer token, the tenancy
check and the sealed payloads all stay as they are.

## Match on subject, never on email

`(iss, sub)` is the identity. Email changes, gets reassigned inside a company,
and is not unique across providers. Matching on it is how one person becomes
two accounts, or worse, how two people become one.

Because each provider gives a different `sub` for the same human, linking a
second provider to an existing account has to be an explicit, signed-in action.
It cannot be inferred.

## The three providers, and what each costs

**Google.** The easiest. Standard OIDC discovery, a web client id and secret
from the Cloud console, no rotation. Covers most people. Start here.

**Microsoft.** Entra ID via the `common` endpoint, which covers both work and
personal accounts. Client id and secret, secret expires and must be rotated —
by default in 6 to 24 months depending on how it is created.

**Apple.** The awkward one, and worth knowing before promising it. There is no
"iCloud login"; the product is Sign in with Apple. The client secret is an
ES256 JWT you sign with a key downloaded from Apple, and it is valid for at
most 6 months, so rotation is not optional, it is scheduled work. Apple returns
the user's name and email only on the very first authorization, so if you do
not store it then, it is gone. The redirect must be HTTPS, and requesting
scopes forces `response_mode=form_post`.

I have not re-checked Apple's current limits against their documentation, and
they have changed before. Confirm the secret lifetime and the first-login-only
behaviour before building against them.

## Environment variables

One provider is two variables. Three providers is six, plus a key file for
Apple, which is more configuration than this deployment should carry for a
feature nobody has asked for yet.

Start with Google alone:

```
MOAT_OIDC_GOOGLE_CLIENT_ID=
MOAT_OIDC_GOOGLE_CLIENT_SECRET=
```

Add a provider only when someone needs it. If it ever reaches three, move them
into one `MOAT_OIDC_PROVIDERS` JSON value rather than growing the list.

## Token lifetime

Keep what exists: long-lived tokens, one per device, revocable from the
credentials table. Short-lived tokens with refresh would be right for a service
users sit inside all day. Moat syncs occasionally and works offline, so a
device token with a revoke button is simpler and fails better.

Sign-out on a device should revoke that device's token, not every token.

## Ordering

1. `sync_identities` table and the `(iss, sub)` mapping.
2. ID token verification against a JWKS, with cached keys.
3. `POST /v1/auth/callback`, Google only.
4. Sign-in screen and the second-device story, which is the part that needs
   design work rather than plumbing: sign in, then restore the backup.
5. Rate limiting on the callback and on push and pull.
6. Microsoft.
7. Apple, only if wanted, budgeting for the key rotation.

## What is not decided

- Whether an account can exist without a provider, for someone who wants sync
  without handing an identity to Google or Microsoft. A minted token already
  does this; the question is whether it stays a supported path or a back door.
- What happens to synced records when a user deletes their account, and whether
  that is the same button as "delete everything on this device".
