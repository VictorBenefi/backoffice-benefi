-- BENEFÍ - Estructura de autenticación POS
-- Respaldo estructural del ambiente integration-pos. Sin datos ni credenciales.
BEGIN;

CREATE TABLE public.pos_api_credentials (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pos_id uuid NOT NULL,
    merchant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    credential_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz,
    CONSTRAINT pos_api_credentials_pkey PRIMARY KEY (id),
    CONSTRAINT pos_api_credentials_credential_hash_key UNIQUE (credential_hash),
    CONSTRAINT pos_api_credentials_hash_check CHECK (credential_hash ~ '^[0-9a-f]{64}$'::text),
    CONSTRAINT pos_api_credentials_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id),
    CONSTRAINT pos_api_credentials_pos_id_fkey FOREIGN KEY (pos_id) REFERENCES public.pos_devices(id),
    CONSTRAINT pos_api_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);

CREATE UNIQUE INDEX idx_pos_api_credentials_active
    ON public.pos_api_credentials USING btree (pos_id)
    WHERE (is_active = true);

ALTER TABLE public.pos_api_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_api_credentials FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.pos_api_credentials TO service_role;

COMMIT;
