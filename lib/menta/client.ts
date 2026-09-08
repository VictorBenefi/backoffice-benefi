const MENTA_API_URL =
  process.env.MENTA_API_URL || "https://api.menta.global/api";

type MentaLoginResponse = {
  token?: {
    access_token?: string;
  };
};

type MentaRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

function getCredentials() {
  const user = process.env.MENTA_API_USER;
  const password = process.env.MENTA_API_PASSWORD;

  if (!user || !password) {
    throw new Error(
      "Faltan configurar MENTA_API_USER y/o MENTA_API_PASSWORD."
    );
  }

  return { user, password };
}

async function getAccessToken() {
  const { user, password } = getCredentials();

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
    }
  );

  let data: MentaLoginResponse | null = null;

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

  const accessToken = data?.token?.access_token;

  if (!accessToken) {
    throw new Error(
      "MENTA no devolvió token.access_token."
    );
  }

  return accessToken;
}

export async function mentaRequest<T>(
  path: string,
  options: MentaRequestOptions = {}
): Promise<T> {
  const accessToken = await getAccessToken();

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
    }
  );

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `MENTA respondió ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data as T;
}