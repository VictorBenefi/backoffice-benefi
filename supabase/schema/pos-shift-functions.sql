-- Respaldo de definiciones vigentes. No es una migración.
-- Permisos, tablas y triggers se respaldan por separado.

CREATE OR REPLACE FUNCTION public.confirm_pos_shift_closure_request(p_request_id uuid, p_merchant_id uuid, p_user_id uuid, p_fingerprint text, p_summary jsonb, p_terminals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_request public.pos_shift_closure_requests%ROWTYPE;
    v_result jsonb;
    v_closure_id uuid;
    v_saved_terminal jsonb;
    v_current_terminal jsonb;
BEGIN

    -- Recuperar y bloquear la solicitud.

    SELECT *
    INTO v_request
    FROM public.pos_shift_closure_requests
    WHERE id = p_request_id
        AND merchant_id = p_merchant_id
        AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Solicitud de cierre no encontrada.';
    END IF;

    -- Impedir confirmaciones de solicitudes canceladas.

    IF v_request.status = 'CANCELLED' THEN
        RAISE EXCEPTION
            'La solicitud de cierre fue cancelada.';
    END IF;

    -- Devolver el cierre original ante un reintento.

    IF v_request.status = 'CONFIRMED' THEN

        SELECT jsonb_build_object(
            'ok', true,
            'alreadyRegistered', true,
            'requestId', v_request.id,
            'status', 'CONFIRMED',
            'closureId', c.id,
            'closureNumber', c.closure_number::text,
            'closedAt', c.closed_at
        )
        INTO v_result
        FROM public.pos_shift_closures c
        WHERE c.id = v_request.closure_id;

        IF v_result IS NULL THEN
            RAISE EXCEPTION
                'No se encontró el cierre confirmado.';
        END IF;

        RETURN v_result;

    END IF;

    IF v_request.status <> 'PENDING' THEN
        RAISE EXCEPTION
            'Estado de solicitud inválido.';
    END IF;

    -- Verificar la huella confirmada.

    IF p_fingerprint IS DISTINCT FROM
        v_request.fingerprint
    THEN
        RAISE EXCEPTION
            'El resumen cambió. Debe confirmarlo nuevamente.';
    END IF;

    -- Verificar que el corte permanezca invariable.

    IF (p_summary -> 'period' ->> 'to')::timestamptz
        IS DISTINCT FROM v_request.period_to
    THEN
        RAISE EXCEPTION
            'La fecha de corte fue modificada.';
    END IF;

    -- Verificar que las terminales sean las originales.

    IF jsonb_typeof(p_terminals)
        IS DISTINCT FROM 'array'
    THEN
        RAISE EXCEPTION
            'Terminales inválidas.';
    END IF;

    IF jsonb_array_length(p_terminals)
        <> jsonb_array_length(v_request.terminals)
    THEN
        RAISE EXCEPTION
            'Las terminales seleccionadas fueron modificadas.';
    END IF;

    FOR v_saved_terminal IN
        SELECT value
        FROM jsonb_array_elements(v_request.terminals)
    LOOP

        SELECT value
        INTO v_current_terminal
        FROM jsonb_array_elements(p_terminals)
        WHERE value ->> 'posId' =
            v_saved_terminal ->> 'posId';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Las terminales del cierre no coinciden.';
        END IF;

        IF (v_current_terminal ->> 'periodFrom')::timestamptz
            IS DISTINCT FROM
            (v_saved_terminal ->> 'periodFrom')::timestamptz
        THEN
            RAISE EXCEPTION
                'El período inicial fue modificado.';
        END IF;

        IF (v_current_terminal ->> 'previousClosureTerminalId')
            IS DISTINCT FROM
            (v_saved_terminal ->> 'previousClosureTerminalId')
        THEN
            RAISE EXCEPTION
                'Existe un cierre posterior. Genere una nueva solicitud.';
        END IF;

    END LOOP;

    -- Registrar el cierre utilizando el motor existente.

    v_result := public.register_pos_shift_closure(
        v_request.merchant_id,
        v_request.user_id,
        v_request.requested_pos_id,
        v_request.id,
        v_request.period_to,
        p_summary,
        p_terminals
    );

    IF (v_result ->> 'ok')::boolean
        IS DISTINCT FROM true
        OR v_result ->> 'closureId' IS NULL
    THEN
        RAISE EXCEPTION
            'No se pudo registrar el cierre definitivo.';
    END IF;

    v_closure_id :=
        (v_result ->> 'closureId')::uuid;

    -- Confirmar la solicitud.

    UPDATE public.pos_shift_closure_requests
    SET
        status = 'CONFIRMED',
        closure_id = v_closure_id,
        confirmed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = v_request.id;

    RETURN v_result || jsonb_build_object(
        'requestId', v_request.id,
        'status', 'CONFIRMED',
        'closureNumber', v_result ->> 'closureNumber'
    );

END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_pos_shift_enabled_from()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.shift_closure_enabled_from IS NULL THEN RETURN NEW; END IF;
  ELSE
    IF NEW.shift_closure_enabled_from IS NOT DISTINCT FROM OLD.shift_closure_enabled_from THEN RETURN NEW; END IF;
  END IF;
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'La habilitación requiere una operación administrativa.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pos_shift_closure_terminals WHERE pos_id = NEW.id) THEN
    RAISE EXCEPTION 'La terminal ya tiene cierres registrados.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_pos_shift_closure(p_merchant_id uuid, p_user_id uuid, p_requested_pos_id uuid, p_request_id uuid, p_period_to timestamp with time zone, p_summary jsonb, p_terminals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_closure_id uuid;
    v_closure_number bigint;
    v_terminal_id uuid;
    v_existing_id uuid;
    v_existing_number bigint;
         v_existing_closed_at timestamptz;
         v_existing_merchant_id uuid;
         v_previous_period_from timestamptz;
         v_previous_period_to timestamptz;
         v_previous_last_transaction_at timestamptz;
    v_pos_id uuid;
    v_terminal jsonb;
    v_operation jsonb;
    v_terminal_summary jsonb;
    v_totals jsonb;
    v_period_from timestamptz;
    v_terminal_from timestamptz;
    v_previous_id uuid;
    v_expected_previous_id uuid;
    v_first_transaction_at timestamptz;
    v_last_transaction_at timestamptz;
    v_closed_at timestamptz;
BEGIN

    -- Validaciones iniciales.

    IF p_merchant_id IS NULL
        OR p_user_id IS NULL
        OR p_request_id IS NULL
        OR p_period_to IS NULL
        OR p_period_to > clock_timestamp()
    THEN
        RAISE EXCEPTION 'Datos del cierre inválidos.';
    END IF;

    IF jsonb_typeof(p_terminals)
        IS DISTINCT FROM 'array'
    THEN
        RAISE EXCEPTION 'Terminales inválidas.';
    END IF;

    IF jsonb_array_length(p_terminals) = 0 THEN
        RAISE EXCEPTION 'No se seleccionaron terminales.';
    END IF;

    IF jsonb_typeof(p_summary -> 'totals')
        IS DISTINCT FROM 'object'
    THEN
        RAISE EXCEPTION 'Resumen consolidado inválido.';
    END IF;

    -- Bloqueo de la solicitud para evitar reintentos duplicados.

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'pos-shift-request:' ||
            p_user_id::text || ':' ||
            p_request_id::text,
            0
        )
    );

    SELECT id, closure_number, closed_at, merchant_id
    INTO v_existing_id, v_existing_number,
         v_existing_closed_at, v_existing_merchant_id
    FROM public.pos_shift_closures
    WHERE user_id = p_user_id
        AND request_id = p_request_id;

    IF FOUND THEN

        IF v_existing_merchant_id IS DISTINCT FROM p_merchant_id
        THEN
            RAISE EXCEPTION
                'La solicitud pertenece a otro comercio.';
        END IF;

        RETURN jsonb_build_object(
            'ok', true,
            'alreadyRegistered', true,
            'closureId', v_existing_id,
            'closureNumber', v_existing_number,
            'closedAt', v_existing_closed_at
        );
    END IF;

    -- Verificar terminales duplicadas.

    IF (
        SELECT COUNT(DISTINCT item ->> 'posId')
        FROM jsonb_array_elements(p_terminals) AS item
    ) <> jsonb_array_length(p_terminals)
    THEN
        RAISE EXCEPTION 'Terminales duplicadas o inválidas.';
    END IF;

    -- Bloquear terminales en orden estable.

    FOR v_pos_id IN
        SELECT (item ->> 'posId')::uuid
        FROM jsonb_array_elements(p_terminals) AS item
        ORDER BY 1
    LOOP

        PERFORM pg_advisory_xact_lock(
            hashtextextended(
                'pos-shift-terminal:' || v_pos_id::text,
                0
            )
        );

        PERFORM 1
        FROM public.pos_devices
        WHERE id = v_pos_id
            AND merchant_id = p_merchant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'La terminal no pertenece al comercio.';
        END IF;

    END LOOP;

    -- Verificar continuidad de cada terminal.

    FOR v_terminal IN
        SELECT value
        FROM jsonb_array_elements(p_terminals)
    LOOP

        v_pos_id :=
            (v_terminal ->> 'posId')::uuid;

        v_terminal_from :=
            (v_terminal ->> 'periodFrom')::timestamptz;

        v_expected_previous_id :=
            (v_terminal ->> 'previousClosureTerminalId')::uuid;

        IF v_terminal_from IS NULL
            OR v_terminal_from >= p_period_to
        THEN
            RAISE EXCEPTION 'Período de cierre inválido.';
        END IF;

        SELECT
            ct.id,
            ct.period_from,
            ct.period_to,
            ct.last_transaction_at
        INTO
            v_previous_id,
            v_previous_period_from,
            v_previous_period_to,
            v_previous_last_transaction_at
        FROM public.pos_shift_closure_terminals ct
        INNER JOIN public.pos_shift_closures c
            ON c.id = ct.closure_id
        WHERE ct.pos_id = v_pos_id
        ORDER BY c.closure_number DESC
        LIMIT 1;

        IF v_previous_id IS DISTINCT FROM
            v_expected_previous_id
        THEN
            RAISE EXCEPTION
                'Existe un cierre posterior. Actualice el resumen.';
        END IF;

        -- Validar habilitación administrativa del primer cierre.

        IF v_previous_id IS NULL THEN

            PERFORM 1
            FROM public.pos_devices
            WHERE id = v_pos_id
                AND merchant_id = p_merchant_id
                AND shift_closure_enabled_from IS NOT NULL
                AND shift_closure_enabled_from = v_terminal_from
                AND shift_closure_enabled_from < p_period_to
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'La fecha inicial no coincide con la habilitación administrativa de la terminal.';
            END IF;

        END IF;

        IF v_previous_id IS NOT NULL THEN

            IF v_terminal_from IS DISTINCT FROM
                v_previous_period_to
            THEN
                RAISE EXCEPTION
                    'La fecha inicial no coincide con el cierre anterior.';
            END IF;

            IF p_period_to <= v_previous_period_to THEN
                RAISE EXCEPTION
                    'La fecha final debe ser posterior al cierre anterior.';
            END IF;

        END IF;

        IF jsonb_typeof(v_terminal -> 'operations')
            IS DISTINCT FROM 'array'
        THEN
            RAISE EXCEPTION 'Detalle de operaciones inválido.';
        END IF;

        IF v_period_from IS NULL
            OR v_terminal_from < v_period_from
        THEN
            v_period_from := v_terminal_from;
        END IF;

    END LOOP;

    v_totals := p_summary -> 'totals';
    v_closed_at := clock_timestamp();

    -- Generar número correlativo.

    

    

    -- Validar estructura de operaciones por terminal.

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_terminals) AS item
        WHERE jsonb_typeof(item -> 'operations')
            IS DISTINCT FROM 'array'
    ) THEN
        RAISE EXCEPTION
            'Las operaciones de las terminales son inválidas.';
    END IF;

    -- Impedir cierres sin operaciones reales.

    IF (
        SELECT COALESCE(
            SUM(jsonb_array_length(item -> 'operations')),
            0
        )
        FROM jsonb_array_elements(p_terminals) AS item
    ) = 0 THEN
        RAISE EXCEPTION
            'No existen operaciones pendientes para realizar el cierre de turno.';
    END IF;

    -- Validar cantidad consolidada.

    IF (
        SELECT COALESCE(
            SUM(jsonb_array_length(item -> 'operations')),
            0
        )
        FROM jsonb_array_elements(p_terminals) AS item
    ) IS DISTINCT FROM
        (v_totals ->> 'operationCount')::integer
    THEN
        RAISE EXCEPTION
            'La cantidad consolidada de operaciones no coincide.';
    END IF;

    -- Registrar cabecera consolidada.

    

    INSERT INTO public.pos_shift_closures (
        merchant_id,
        user_id,
        requested_pos_id,
        request_id,
        closed_at,
        period_from,
        period_to,
        currency,
        terminal_count,
        operation_count,
        payment_count,
        annulment_count,
        refund_count,
        rejected_count,
        payment_amount,
        annulment_amount,
        refund_amount,
        net_amount,
        summary
    )
    VALUES (
        p_merchant_id,
        p_user_id,
        p_requested_pos_id,
        p_request_id,
        v_closed_at,
        v_period_from,
        p_period_to,
        'ARS',
        jsonb_array_length(p_terminals),
        (v_totals ->> 'operationCount')::integer,
        (v_totals ->> 'paymentCount')::integer,
        (v_totals ->> 'annulmentCount')::integer,
        (v_totals ->> 'refundCount')::integer,
        (v_totals ->> 'rejectedCount')::integer,
        (v_totals ->> 'paymentAmount')::numeric,
        (v_totals ->> 'annulmentAmount')::numeric,
        (v_totals ->> 'refundAmount')::numeric,
        (v_totals ->> 'netAmount')::numeric,
        p_summary
    )
    RETURNING id, closure_number
        INTO v_closure_id, v_closure_number;

    -- Registrar cada terminal.

    FOR v_terminal IN
        SELECT value
        FROM jsonb_array_elements(p_terminals)
    LOOP

        v_terminal_summary :=
            v_terminal -> 'summary';

        v_terminal_from :=
            (v_terminal ->> 'periodFrom')::timestamptz;

        SELECT
            MIN((item ->> 'datetime')::timestamptz),
            MAX((item ->> 'datetime')::timestamptz)
        INTO
            v_first_transaction_at,
            v_last_transaction_at
        FROM jsonb_array_elements(
            v_terminal -> 'operations'
        ) AS item;

        IF jsonb_array_length(
            v_terminal -> 'operations'
        ) IS DISTINCT FROM
            (v_terminal_summary ->> 'operationCount')::integer
        THEN
            RAISE EXCEPTION
                'La cantidad de operaciones no coincide.';
        END IF;

        INSERT INTO public.pos_shift_closure_terminals (
            closure_id,
            pos_id,
            period_from,
            period_to,
            first_transaction_at,
            last_transaction_at,
            operation_count,
            payment_count,
            annulment_count,
            refund_count,
            rejected_count,
            payment_amount,
            annulment_amount,
            refund_amount,
            net_amount,
            summary
        )
        VALUES (
            v_closure_id,
            (v_terminal ->> 'posId')::uuid,
            v_terminal_from,
            p_period_to,
            v_first_transaction_at,
            v_last_transaction_at,
            (v_terminal_summary ->> 'operationCount')::integer,
            (v_terminal_summary ->> 'paymentCount')::integer,
            (v_terminal_summary ->> 'annulmentCount')::integer,
            (v_terminal_summary ->> 'refundCount')::integer,
            (v_terminal_summary ->> 'rejectedCount')::integer,
            (v_terminal_summary ->> 'paymentAmount')::numeric,
            (v_terminal_summary ->> 'annulmentAmount')::numeric,
            (v_terminal_summary ->> 'refundAmount')::numeric,
            (v_terminal_summary ->> 'netAmount')::numeric,
            v_terminal_summary
        )
        RETURNING id INTO v_terminal_id;

        -- Registrar las operaciones originales.

        FOR v_operation IN
            SELECT value
            FROM jsonb_array_elements(
                v_terminal -> 'operations'
            )
        LOOP

            IF (v_operation ->> 'datetime')::timestamptz
                IS NULL
                OR (v_operation ->> 'datetime')::timestamptz
                    < v_terminal_from
                OR (
                    (v_terminal ->> 'previousClosureTerminalId') IS NOT NULL
                    AND (v_operation ->> 'datetime')::timestamptz
                        = v_terminal_from
                )
                OR (v_operation ->> 'datetime')::timestamptz
                    > p_period_to
            THEN
                RAISE EXCEPTION
                    'Fecha de operación inválida.';
            END IF;

            INSERT INTO public.pos_shift_closure_transactions (
                closure_terminal_id,
                transaction_id,
                menta_transaction_id,
                transaction_datetime,
                operation_id,
                operation_snapshot
            )
            VALUES (
                v_terminal_id,
                NULL,
                NULLIF(TRIM(v_operation ->> 'transaction_id'), ''),
                (v_operation ->> 'datetime')::timestamptz,
                v_operation ->> 'operation_id',
                v_operation
            );

        END LOOP;

    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'alreadyRegistered', false,
        'closureId', v_closure_id,
        'closureNumber', v_closure_number,
        'closedAt', v_closed_at
    );

END;
$function$;
