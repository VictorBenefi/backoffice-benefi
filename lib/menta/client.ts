import "server-only";

import {
  getPosShiftDataSource,
  isPosIntegrationEnvironment,
  MENTA_TEST_MERCHANT_ID,
} from "@/lib/pos/shift-data-source";

const MENTA_API_URL =
  process.env.MENTA_API_URL ||
  "https://api.menta.global/api";

// Tiempo máximo de espera por solicitud a MENTA.
const MENTA_REQUEST_TIMEOUT_MS = 30000;

type MentaLoginResponse = {
  token?: {
    access_token?: string;
  };
};

type MentaRequestOptions = {
  method?:
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";
  body?: unknown;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

const TOKEN_CACHE_TIME_MS =
  10 * 60 * 1000;

function getCredentials() {
  const user = process.env.MENTA_API_USER;
  const password =
    process.env.MENTA_API_PASSWORD;

  if (!user || !password) {
    throw new Error(
      "Faltan configurar MENTA_API_USER y/o MENTA_API_PASSWORD."
    );
  }

  return { user, password };
}

async function getAccessToken(
  forceRefresh = false
) {
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAt > Date.now()
  ) {
    return cachedToken.accessToken;
  }

  const { user, password } =
    getCredentials();


const response = await fetch(
  `${MENTA_API_URL}/v1/login`,
  {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user,
      password,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(
      MENTA_REQUEST_TIMEOUT_MS
    ),
  }
);


  let data: MentaLoginResponse | null =
    null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `MENTA login respondió ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  const accessToken =
    data?.token?.access_token;

  if (!accessToken) {
    throw new Error(
      "MENTA no devolvió token.access_token."
    );
  }

  cachedToken = {
    accessToken,
    expiresAt:
      Date.now() + TOKEN_CACHE_TIME_MS,
  };

  return accessToken;
}

async function executeRequest<T>(
  path: string,
  options: MentaRequestOptions,
  accessToken: string
): Promise<{
  response: Response;
  data: unknown;
}> {

const response = await fetch(
  `${MENTA_API_URL}${path}`,
  {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(
      MENTA_REQUEST_TIMEOUT_MS
    ),
  }
);

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    response,
    data,
  };
}

function validateMentaIntegrationRequest(
  path: string,
  options: MentaRequestOptions
): void {
  if (!isPosIntegrationEnvironment()) {
    return;
  }

  if (getPosShiftDataSource() !== "MENTA_TEST") {
    throw new Error(
      "La conexión a MENTA no está habilitada en integración."
    );
  }

  if (
    (options.method || "GET") !== "GET" ||
    options.body !== undefined
  ) {
    throw new Error(
      "Integración POS solo permite consultas de lectura."
    );
  }

  const [pathname, query] = path.split("?");

  if (
    pathname !== "/v2/transaction-reports" ||
    !query ||
    path.split("?").length !== 2
  ) {
    throw new Error(
      "Endpoint MENTA no autorizado en integración."
    );
  }

  const params = new URLSearchParams(query);

  const allowedParams = new Set([
    "page",
    "size",
    "start",
    "end",
    "merchantId",
  ]);

  for (const key of params.keys()) {
    if (
      !allowedParams.has(key) ||
      params.getAll(key).length !== 1
    ) {
      throw new Error(
        "Parámetros MENTA no autorizados en integración."
      );
    }
  }

  if (
    params.get("merchantId") !==
    MENTA_TEST_MERCHANT_ID
  ) {
    throw new Error(
      "Comercio MENTA no autorizado en integración."
    );
  }
}

export async function mentaRequest<T>(
  path: string,
  options: MentaRequestOptions = {}
): Promise<T> {
  validateMentaIntegrationRequest(path, options);

  let accessToken =
    await getAccessToken();

  let result =
    await executeRequest<T>(
      path,
      options,
      accessToken
    );

  if (
    result.response.status === 401
  ) {
    cachedToken = null;

    accessToken =
      await getAccessToken(true);

    result =
      await executeRequest<T>(
        path,
        options,
        accessToken
      );
  }

  if (!result.response.ok) {
    throw new Error(
      `MENTA respondió ${result.response.status}: ${JSON.stringify(
        result.data
      )}`
    );
  }

  return result.data as T;
}