const MENTA_API_URL =
  process.env.MENTA_API_URL ||
  "https://api.menta.global/api";

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
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        user,
        password,
      }),
      cache: "no-store",
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
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
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

export async function mentaRequest<T>(
  path: string,
  options: MentaRequestOptions = {}
): Promise<T> {
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