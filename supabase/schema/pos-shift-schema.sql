-- BENEFÍ POS: respaldo estructural de referencia, 24/11/2026.

-- No ejecutar sobre producción. No incluye datos, ACL de secuencias ni opciones de identidad no exportadas.

-- Requiere tablas preexistentes y roles Supabase. Funciones en pos-shift-functions.sql.

BEGIN;

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE public.pos_devices ADD COLUMN shift_closure_enabled_from timestamp with time zone;

CREATE TABLE public.pos_menta_merchant_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_id uuid NOT NULL,
    merchant_id uuid NOT NULL,
    menta_terminal_id text NOT NULL,
    menta_merchant_id text NOT NULL,
    first_operation_at timestamp with time zone,
    last_operation_at timestamp with time zone,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    source text DEFAULT 'historical_transactions'::text NOT NULL,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pos_shift_closures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    closure_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    merchant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    requested_pos_id uuid,
    request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone NOT NULL,
    period_from timestamp with time zone NOT NULL,
    period_to timestamp with time zone NOT NULL,
    currency text DEFAULT 'ARS'::text NOT NULL,
    terminal_count integer DEFAULT 0 NOT NULL,
    operation_count integer DEFAULT 0 NOT NULL,
    payment_count integer DEFAULT 0 NOT NULL,
    annulment_count integer DEFAULT 0 NOT NULL,
    refund_count integer DEFAULT 0 NOT NULL,
    rejected_count integer DEFAULT 0 NOT NULL,
    payment_amount numeric(18,2) DEFAULT 0 NOT NULL,
    annulment_amount numeric(18,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.pos_shift_closure_terminals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    closure_id uuid NOT NULL,
    pos_id uuid NOT NULL,
    period_from timestamp with time zone NOT NULL,
    period_to timestamp with time zone NOT NULL,
    first_transaction_at timestamp with time zone,
    last_transaction_at timestamp with time zone,
    operation_count integer DEFAULT 0 NOT NULL,
    payment_count integer DEFAULT 0 NOT NULL,
    annulment_count integer DEFAULT 0 NOT NULL,
    refund_count integer DEFAULT 0 NOT NULL,
    rejected_count integer DEFAULT 0 NOT NULL,
    payment_amount numeric(18,2) DEFAULT 0 NOT NULL,
    annulment_amount numeric(18,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.pos_shift_closure_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    closure_terminal_id uuid NOT NULL,
    transaction_id uuid,
    transaction_datetime timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    operation_id text NOT NULL,
    operation_snapshot jsonb NOT NULL,
    menta_transaction_id text
);

CREATE TABLE public.pos_shift_closure_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    requested_pos_id uuid,
    period_to timestamp with time zone NOT NULL,
    terminals jsonb NOT NULL,
    summary jsonb NOT NULL,
    fingerprint text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    closure_id uuid
);

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_assignment_dates_check CHECK (((valid_to IS NULL) OR ((valid_from IS NOT NULL) AND (valid_to > valid_from))));

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_assignment_unique UNIQUE (pos_id, merchant_id, menta_terminal_id, menta_merchant_id);

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_merchant_assignments_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchants(id);

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_merchant_assignments_pkey PRIMARY KEY (id);

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_merchant_assignments_pos_id_fkey FOREIGN KEY (pos_id) REFERENCES pos_devices(id);

ALTER TABLE public.pos_menta_merchant_assignments ADD CONSTRAINT pos_menta_merchant_assignments_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'inactive'::text])));

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_closure_number_key UNIQUE (closure_number);

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchants(id);

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_period_check CHECK ((period_to >= period_from));

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_pkey PRIMARY KEY (id);

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_request_unique UNIQUE (user_id, request_id);

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_requested_pos_id_fkey FOREIGN KEY (requested_pos_id) REFERENCES pos_devices(id);

ALTER TABLE public.pos_shift_closures ADD CONSTRAINT pos_shift_closures_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id);

ALTER TABLE public.pos_shift_closure_terminals ADD CONSTRAINT pos_shift_closure_terminal_unique UNIQUE (closure_id, pos_id);

ALTER TABLE public.pos_shift_closure_terminals ADD CONSTRAINT pos_shift_closure_terminals_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES pos_shift_closures(id);

ALTER TABLE public.pos_shift_closure_terminals ADD CONSTRAINT pos_shift_closure_terminals_pkey PRIMARY KEY (id);

ALTER TABLE public.pos_shift_closure_terminals ADD CONSTRAINT pos_shift_closure_terminals_pos_id_fkey FOREIGN KEY (pos_id) REFERENCES pos_devices(id);

ALTER TABLE public.pos_shift_closure_terminals ADD CONSTRAINT pos_shift_terminal_period_check CHECK ((period_to >= period_from));

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_operation_id_unique UNIQUE (operation_id);

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_operation_id_valid CHECK ((btrim(operation_id) <> ''::text));

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_snapshot_valid CHECK ((jsonb_typeof(operation_snapshot) = 'object'::text));

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_transactions_closure_terminal_id_fkey FOREIGN KEY (closure_terminal_id) REFERENCES pos_shift_closure_terminals(id);

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_transactions_pkey PRIMARY KEY (id);

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_closure_transactions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES menta_transactions(id);

ALTER TABLE public.pos_shift_closure_transactions ADD CONSTRAINT pos_shift_transaction_unique UNIQUE (transaction_id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES pos_shift_closures(id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_closure_id_key UNIQUE (closure_id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchants(id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_requested_pos_id_fkey FOREIGN KEY (requested_pos_id) REFERENCES pos_devices(id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT pos_shift_closure_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id);

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_status_consistency CHECK ((((status = 'PENDING'::text) AND (closure_id IS NULL) AND (confirmed_at IS NULL) AND (cancelled_at IS NULL)) OR ((status = 'CONFIRMED'::text) AND (closure_id IS NOT NULL) AND (confirmed_at IS NOT NULL) AND (cancelled_at IS NULL)) OR ((status = 'CANCELLED'::text) AND (closure_id IS NULL) AND (confirmed_at IS NULL) AND (cancelled_at IS NOT NULL))));

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_valid_cutoff CHECK ((period_to <= created_at));

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_valid_fingerprint CHECK ((fingerprint ~ '^[0-9a-f]{64}$'::text));

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_valid_status CHECK ((status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'CANCELLED'::text])));

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_valid_summary CHECK ((jsonb_typeof(summary) = 'object'::text));

ALTER TABLE public.pos_shift_closure_requests ADD CONSTRAINT shift_request_valid_terminals CHECK (((jsonb_typeof(terminals) = 'array'::text) AND (jsonb_array_length(terminals) > 0)));

CREATE INDEX idx_pos_menta_assignments_merchant ON public.pos_menta_merchant_assignments USING btree (merchant_id);

CREATE INDEX idx_pos_menta_assignments_pos ON public.pos_menta_merchant_assignments USING btree (pos_id);

ALTER TABLE public.pos_menta_merchant_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_menta_merchant_assignments FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON TABLE public.pos_menta_merchant_assignments TO service_role;

CREATE INDEX idx_shift_closures_merchant_date ON public.pos_shift_closures USING btree (merchant_id, closed_at DESC);

CREATE INDEX idx_shift_closures_user_date ON public.pos_shift_closures USING btree (user_id, closed_at DESC);

ALTER TABLE public.pos_shift_closures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_shift_closures FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON TABLE public.pos_shift_closures TO service_role;

CREATE INDEX idx_shift_closure_terminals_pos ON public.pos_shift_closure_terminals USING btree (pos_id, period_to DESC);

ALTER TABLE public.pos_shift_closure_terminals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_shift_closure_terminals FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON TABLE public.pos_shift_closure_terminals TO service_role;

CREATE INDEX idx_shift_menta_transaction_id ON public.pos_shift_closure_transactions USING btree (menta_transaction_id);

CREATE INDEX idx_shift_transactions_terminal ON public.pos_shift_closure_transactions USING btree (closure_terminal_id);

ALTER TABLE public.pos_shift_closure_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_shift_closure_transactions FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON TABLE public.pos_shift_closure_transactions TO service_role;

CREATE INDEX idx_shift_requests_merchant_status ON public.pos_shift_closure_requests USING btree (merchant_id, status, created_at DESC);

CREATE INDEX idx_shift_requests_user ON public.pos_shift_closure_requests USING btree (user_id, created_at DESC);

ALTER TABLE public.pos_shift_closure_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_shift_closure_requests FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON TABLE public.pos_shift_closure_requests TO service_role;

-- Instalar las funciones antes del siguiente bloque (archivo separado).

COMMIT;

-- Bloque posterior a pos-shift-functions.sql (referencia):

REVOKE ALL ON FUNCTION public.confirm_pos_shift_closure_request(p_request_id uuid, p_merchant_id uuid, p_user_id uuid, p_fingerprint text, p_summary jsonb, p_terminals jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.confirm_pos_shift_closure_request(p_request_id uuid, p_merchant_id uuid, p_user_id uuid, p_fingerprint text, p_summary jsonb, p_terminals jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.guard_pos_shift_enabled_from() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.guard_pos_shift_enabled_from() TO PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.register_pos_shift_closure(p_merchant_id uuid, p_user_id uuid, p_requested_pos_id uuid, p_request_id uuid, p_period_to timestamp with time zone, p_summary jsonb, p_terminals jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_pos_shift_closure(p_merchant_id uuid, p_user_id uuid, p_requested_pos_id uuid, p_request_id uuid, p_period_to timestamp with time zone, p_summary jsonb, p_terminals jsonb) TO service_role;

CREATE TRIGGER guard_pos_shift_enabled_from BEFORE INSERT OR UPDATE ON public.pos_devices FOR EACH ROW EXECUTE FUNCTION guard_pos_shift_enabled_from();
