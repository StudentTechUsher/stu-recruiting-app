# Recruiter Approve Edge Function

Use this function as the target for the "Approve recruiter" button in the Resend email.

Recommended flow:

1. The Next.js app creates a recruiter approval email with `sendRecruiterApprovalRequestEmail(...)`.
2. The email button points at `RECRUITER_APPROVAL_FUNCTION_URL`.
3. The button URL should include a short-lived signed payload, not just a raw `profile_id`.
4. The edge function verifies the signature and expiration, then sets `public.recruiters.onboarded_at` to the current UTC timestamp.
5. The database trigger in `202603130002_recruiters.sql` copies that timestamp into `public.profiles.onboarding_completed_at`, so the recruiter is immediately routed into the product on their next magic-link sign-in.

Suggested secrets for the edge function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RECRUITER_APPROVAL_SIGNING_SECRET`
- `APP_URL` if you want to redirect back into the app after success

Suggested request shape:

- Query params: `profile_id`, `expires`, `signature`
- `expires` should be an ISO timestamp or unix timestamp with a short TTL, for example 24 hours
- `signature` should be an HMAC over `profile_id + "." + expires`

Minimal outline:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const subtle = crypto.subtle;

async function sign(value: string, secret: string) {
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profile_id");
  const expires = url.searchParams.get("expires");
  const signature = url.searchParams.get("signature");

  if (!profileId || !expires || !signature) {
    return new Response("Missing approval parameters", { status: 400 });
  }

  const expiresAt = new Date(expires);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return new Response("Approval link expired", { status: 400 });
  }

  const signingSecret = Deno.env.get("RECRUITER_APPROVAL_SIGNING_SECRET") ?? "";
  const expectedSignature = await sign(`${profileId}.${expires}`, signingSecret);
  if (expectedSignature !== signature) {
    return new Response("Invalid approval signature", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { error } = await supabase
    .from("recruiters")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("onboarded_at", null);

  if (error) {
    return new Response("Failed to approve recruiter", { status: 500 });
  }

  return Response.redirect(`${Deno.env.get("APP_URL") ?? ""}/login/recruiter?approved=1`, 302);
});
```

Deployment notes:

- Local secrets: `supabase functions serve recruiter-approve --env-file supabase/functions/.env`
- Remote secrets: `supabase secrets set --env-file supabase/functions/.env`
- Deploy: `supabase functions deploy recruiter-approve --no-verify-jwt`

Important:

- Do not use `NEXT_PUBLIC_RESEND_API_KEY`. Keep the Resend API key server-only as `RESEND_API_KEY`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` outside the edge function.
- Keep approval links short-lived and signed so a forwarded email cannot be reused indefinitely.
