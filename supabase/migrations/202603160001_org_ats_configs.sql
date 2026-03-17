CREATE TABLE org_ats_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('greenhouse', 'lever')),
  api_key     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);

ALTER TABLE org_ats_configs ENABLE ROW LEVEL SECURITY;

-- Only org_admin of the matching org can read/write their config
CREATE POLICY "org_admin_own_org_ats_configs" ON org_ats_configs
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      WHERE p.role = 'org_admin'
        AND (p.user_metadata->>'org_id')::text = org_id::text
    )
  );
