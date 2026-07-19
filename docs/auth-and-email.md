# Auth providers and branded emails

## Branded account emails

Templates live in `supabase/templates/`:

| File | Supabase template |
| --- | --- |
| `confirm-signup.html` | Confirm signup |
| `recovery.html` | Reset password |
| `magic-link.html` | Magic link |
| `email-change.html` | Change email address |

They are plain HTML with Supabase's Go template variables (`{{ .ConfirmationURL }}`,
`{{ .Email }}`, `{{ .NewEmail }}`), styled with the Todoer red header so the mails match the app.

To apply them on prod, open the Supabase dashboard for project `lmzwafwjersclyvjustk`,
go to Authentication > Emails > Templates, pick each template, and paste the matching file's
contents into the message body. Subjects worth setting at the same time:

- Confirm signup: `Confirm your Todoer account`
- Reset password: `Reset your Todoer password`
- Magic link: `Your Todoer login link`
- Change email: `Confirm your new Todoer email`

Two limits worth knowing before relying on these:

- The built-in email service is rate limited (a handful of messages per hour) and sends from a
  Supabase address. Custom branding of the *sender* needs SMTP: add a provider such as Resend,
  Postmark, or SendGrid under Authentication > Emails > SMTP Settings, with a domain you own.
  Until then the mail body is branded but the From address is not.
- For local development, wire the same files up in `supabase/config.toml` under
  `[auth.email.template.<type>]` with `content_path`.

## Sign in with Google

Supported, and the code is already in place: the login and signup screens show a
"Continue with Google" button when `NEXT_PUBLIC_GOOGLE_AUTH=1` is set. It is off by default
because the redirect fails until the provider is configured.

To turn it on:

1. In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web application).
2. Add `https://lmzwafwjersclyvjustk.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. In the Supabase dashboard under Authentication > Providers > Google, paste the client ID and
   secret, and enable the provider.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH=1` in the Vercel project environment and redeploy.

Google accounts have no Todoer username, so username login stays password-only for them; the
greeting falls back to the Google display name.

## Sign in with Proton

Not feasible today. Proton does not publish a consumer OAuth or OpenID Connect provider that
third-party apps can integrate with (Proton's SSO offering is for organisations signing in *to*
Proton, not the other way round), and Supabase Auth has no Proton provider. The options if
Proton users are the goal:

- Keep email and password, which already works with any Proton Mail address.
- Add a provider Supabase does support and that privacy-minded users tend to have: GitHub, Apple,
  or magic links (no password at all). Magic links are the closest thing to what Proton sign-in
  would give, and need no third-party account.
