# Moat — Sign in with Google, Microsoft or Apple

| Field | Value |
| --- | --- |
| Document Version | 1.3 |
| Status | Plan — key vault in Drive landed 2026-08-19, sign-in not started |
| Owner | Piira |
| Last Updated | 2026-08-19 |
| Scope | How a user gets a sync account without being handed a token by hand |

Today the only way onto hosted sync is a token minted on the server and pasted
into settings. That is fine for one developer and no good for anyone else.

## Decided 2026-08-19: how a new device gets the key

Seamless on any device and a server that cannot read the ledger only fit
together if the key reaches the new device by a route that is not the server.
Three ways were on the table; **passkey first, recovery passphrase as the
fallback** was chosen. Letting the server hold the key was rejected.

Both wrap the same device key, and either one opens it:

- **Passkey.** A passkey synced by the platform gives the same PRF secret on the
  new device, so signing in and touching the sensor is the whole flow. No
  typing and no file. This needs platform PRF support, which is why it cannot
  be the only way in.
- **Recovery passphrase.** Typed once per new device, works everywhere. It is
  deliberately not the unlock PIN: six digits is a million guesses, and the
  wrapped key has to be somewhere a new device can fetch it, so an offline
  attack on it is the threat to design against. At least 12 characters and not
  all digits.

`lib/security/key-vault.ts` holds both wraps in one small file.

**The vault lives in Drive `appdata`, and the passphrase is asked for at backup
time.** Every user on either path already has a Google account, so Drive reaches
both, and it keeps key material off the sync server entirely — a sync server
breach yields ciphertext and no wrapped key to attack. The cost is that losing
the Google account loses the vault, so the vault is also worth exporting to a
file; that is not built yet.

Asking at backup time rather than at onboarding means the question arrives when
the user has already decided they want their data to survive this device, which
is the only moment the answer is worth anything to them. It also means a purely
local user is never asked at all.

The file is one `moat-key-vault.json`, updated in place. Dated vault files would
leave a new device guessing which one still wraps the current key. A vault this
build cannot parse is left alone rather than overwritten, since it may be the
only thing another device can open.

The passkey wrap is copied from the device's own stored material rather than
re-derived: it already wraps this DEK under the PRF-derived KEK, so copying it
makes the wrap portable without a second biometric prompt.

## The rule that decides the design

**Signing in gets you an account. It does not get you your data.**

The device key never leaves the device except inside an encrypted backup.
Records are sealed with a key derived from it before they are pushed, so the
server holds ciphertext. If signing in with Google also unlocked the ledger,
then Google, or anyone who takes over that Google account, could read every
transaction. Sign-in is for *who you are*, not *what you can read*.

The cost is real and worth stating up front: signing in on a second device
gets you your synced records but not the key to open them. The key comes from
the vault, which means a passkey the platform carries or a recovery passphrase
the user remembers. Anything that removes that step also removes the
encryption.

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
   table. Which user, and whether it is a new one, is the next section.
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

## Signing up, and linking a ledger that already exists

**The local user id is already the account id.** Onboarding creates it with
`createId()`, a cuid2, and every record references it. `migrateIdsToCuid2` only
renumbers ids that are not already cuid2, so it leaves it alone. Google is
linked *to* that id. It never replaces it, and nothing has to be renumbered or
re-uploaded to sign up.

That leaves three cases, and they behave differently.

**A. Fresh install, nothing stored yet.** No identity exists for `(iss, sub)`,
and the device has no user id to offer. The server mints one and the device
adopts it as its profile id. This is sign-up, and it is the only case that
creates a user id.

**B. A ledger on this device, never synced.** The common case, and the one the
question is about. The device sends the user id it already has along with the
auth code. The server links `(iss, sub)` to that id and mints a token.

The condition that makes this safe: the server accepts a proposed user id only
if it is **unclaimed** — no `sync_identities` row and no `sync_records` for it.
Without that check anyone could attach their own Google account to someone
else's user id and pull their ledger. cuid2s are unguessable, but that should
not be the only thing standing between two accounts.

Nothing is renumbered, nothing is re-uploaded, and the ledger is untouched.

**C. A ledger on this device, and this Google account already syncs a different
one.** Two ledgers, one person. Refuse, and say which: "This Google account is
already syncing another Moat ledger." The way onto that account is to restore
its backup on this device, which brings the records and the key together.

Do not merge. Merging two ledgers means deciding which near-identical
transactions are the same event, and there is no honest way to do that
automatically. A wrong guess either doubles someone's spending or hides it.

**Linking does not move the key.** After signing in on a second device the
records arrive sealed. What opens them is the key vault: the passkey if the
platform carries one, the recovery passphrase otherwise. A full backup restore
is no longer the only way through, but something the user holds still is.

## Match on subject, never on email

`(iss, sub)` is the identity. Email changes, gets reassigned inside a company,
and is not unique across providers. Matching on it is how one person becomes
two accounts, or worse, how two people become one.

Because each provider gives a different `sub` for the same human, linking a
second provider to an existing account has to be an explicit, signed-in action.
It cannot be inferred.

## Do you need an auth vendor

No, not for Google. Google's OIDC endpoints cost nothing; what you add is a
library on the sync server, not a service:

- `jose` for verifying the ID token against Google's JWKS. Enough on its own if
  the redirect and code exchange are done by hand, which is roughly 150 lines.
- `openid-client` if you would rather not hand-roll the OIDC dance.

Both are open source with no third party in the request path. Check the current
API against their documentation before building; this note is not a spec.

A hosted service (Auth0, Clerk, Firebase, Supabase and the like) writes less
code but puts a third party in the middle of identity for a personal finance
app, and adds a vendor to the deployment. For one provider that trade is not
worth it. Reconsider if this ever needs many providers, SSO or SCIM.

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

1. ~~Key vault: both wraps, the passphrase policy, and the file format.~~ Done.
2. ~~Store and fetch the vault from Drive `appdata`, and ask for a recovery
   passphrase at backup time.~~ Done. What is not built yet: opening a vault on
   a second device, which is step 6's screen, and exporting the vault to a file
   for someone who loses their Google account.
3. `sync_identities` table, the `(iss, sub)` mapping, and the unclaimed check
   that cases A, B and C turn on.
4. ID token verification against a JWKS, with cached keys.
5. `POST /v1/auth/callback`, Google only.
6. Sign-in screen and the second-device story, which is the part that needs
   design work rather than plumbing: sign in, then restore the backup.
   Case C's wall needs wording a person can act on.
7. Rate limiting on the callback and on push and pull.
8. Microsoft.
9. Apple, only if wanted, budgeting for the key rotation.

## What is not decided

- Whether an account can exist without a provider, for someone who wants sync
  without handing an identity to Google or Microsoft. A minted token already
  does this; the question is whether it stays a supported path or a back door.
- What happens to synced records when a user deletes their account, and whether
  that is the same button as "delete everything on this device".
- When to ask. Sign-in is worth nothing to a user who has not decided they want
  sync, so it should follow that decision rather than greet them at onboarding.
