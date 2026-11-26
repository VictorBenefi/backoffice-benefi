const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const MERCHANT =
  "89f03c63-106e-44ca-b2cc-630f6cf8d56f";

const TERMINAL =
  "2f7be4d2-a2e1-439b-a326-d25f3551b0bd";

const OTHER_MERCHANT = "other-merchant";
const OTHER_TERMINAL = "other-terminal";

const START = "2026-11-26T10:00:00.000Z";
const END = "2026-11-26T18:00:00.000Z";

const VALID_PATH =
  "/v2/transaction-reports?" +
  new URLSearchParams({
    page: "0",
    size: "100",
    start: START,
    end: END,
    merchantId: MERCHANT,
  }).toString();

const VALID_OPERATION = {
  merchant_id: MERCHANT,
  terminal_id: TERMINAL,
  operation_id: "TEST-OP-001",
  datetime: "2026-11-26T12:00:00.000Z",
  operation_type: "PAYMENT",
  payment_method: "QR",
  gross_amount: 1000,
  currency: "ARS",
  status: "APPROVED",
};

function createEnvironment(options = {}) {
  const calls = [];
  const modules = new Map();

  const env = {
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "integration-pos",
    VERCEL_GIT_COMMIT_REF:
      "integration/pos-shift-closures",
    NEXT_PUBLIC_SUPABASE_URL:
      "https://opwweoyxwdolwpzqwgan.supabase.co",
    POS_INTEGRATION_ONLY: "true",
    POS_SHIFT_DATA_SOURCE: "MENTA_TEST",
    MENTA_API_URL:
      "https://api.menta.global/api",
    MENTA_API_USER: "fake-test-user",
    MENTA_API_PASSWORD: "fake-test-password",
    ...options.env,
  };

  const operations =
    options.operations ?? [VALID_OPERATION];

  async function fakeFetch(url, config) {
    calls.push({ url, config });

    if (url.endsWith("/v1/login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: {
            access_token: "fake-test-token",
          },
        }),
      };
    }

    if (
      url.includes("/v2/transaction-reports?")
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: operations,
          total_elements: operations.length,
          total_pages: 1,
          number: 0,
        }),
      };
    }

    throw new Error("Unexpected fetch: " + url);
  }

  function loadModule(relativePath) {
    if (modules.has(relativePath)) {
      return modules.get(relativePath);
    }

    const filename = path.resolve(relativePath);

    const source = fs.readFileSync(
      filename,
      "utf8"
    );

    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    const module = { exports: {} };

    function localRequire(name) {
      if (name === "server-only") {
        return {};
      }

      if (
        name ===
        "@/lib/pos/shift-simulated-transactions"
      ) {
        return {
          getSimulatedShiftTransactions: () => [],
        };
      }

      if (name.startsWith("@/")) {
        return loadModule(
          name.slice(2) + ".ts"
        );
      }

      throw new Error(
        "Unexpected import: " + name
      );
    }

    const context = vm.createContext({
      module,
      exports: module.exports,
      require: localRequire,
      process: { env },
      fetch: fakeFetch,
      URLSearchParams,
      AbortSignal,
      console: {
        info: () => {},
      },
    });

    vm.runInContext(compiled, context, {
      filename,
    });

    modules.set(
      relativePath,
      module.exports
    );

    return module.exports;
  }

  return {
    calls,
    client: loadModule(
      "lib/menta/client.ts"
    ),
    shift: loadModule(
      "lib/menta/shift-transactions.ts"
    ),
  };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("OK   " + name);
  } catch (error) {
    failed++;
    console.error(
      "FAIL " + name + ": " + error.message
    );
  }
}

async function blockedRequest(
  requestPath,
  requestOptions = {},
  environmentOptions = {}
) {
  const env = createEnvironment(
    environmentOptions
  );

  await assert.rejects(
    () =>
      env.client.mentaRequest(
        requestPath,
        requestOptions
      )
  );

  assert.equal(env.calls.length, 0);
}

async function main() {
  await test(
    "01 - Authorized TEST merchant",
    async () => {
      const env = createEnvironment();

      const result =
        await env.client.mentaRequest(
          VALID_PATH
        );

      assert.equal(result.content.length, 1);
      assert.equal(env.calls.length, 2);

      assert.equal(
        env.calls[0].config.redirect,
        "error"
      );

      assert.equal(
        env.calls[1].config.redirect,
        "error"
      );

      assert.equal(
        env.calls[1].config.method,
        "GET"
      );

      assert.equal(
        env.calls[1].config.headers.Authorization,
        "Bearer fake-test-token"
      );
    }
  );

  await test(
    "02 - Other merchant blocked",
    () =>
      blockedRequest(
        VALID_PATH.replace(
          MERCHANT,
          OTHER_MERCHANT
        )
      )
  );

  await test(
    "03 - POST blocked",
    () =>
      blockedRequest(VALID_PATH, {
        method: "POST",
      })
  );

  await test(
    "04 - DELETE blocked",
    () =>
      blockedRequest(VALID_PATH, {
        method: "DELETE",
      })
  );

  await test(
    "05 - Unauthorized endpoint blocked",
    () =>
      blockedRequest("/v1/terminals")
  );

  await test(
    "06 - Duplicate merchant parameter blocked",
    () =>
      blockedRequest(
        VALID_PATH +
          "&merchantId=" +
          OTHER_MERCHANT
      )
  );

  await test(
    "07 - Unknown parameter blocked",
    () =>
      blockedRequest(
        VALID_PATH + "&extra=true"
      )
  );

  await test(
    "08 - Missing required parameter blocked",
    () =>
      blockedRequest(
        VALID_PATH.replace("page=0&", "")
      )
  );

  await test(
    "09 - URL fragment blocked",
    () =>
      blockedRequest(
        VALID_PATH + "#fragment"
      )
  );

  await test(
    "10 - SIMULATED cannot contact MENTA",
    () =>
      blockedRequest(VALID_PATH, {}, {
        env: {
          POS_SHIFT_DATA_SOURCE: "SIMULATED",
        },
      })
  );

  await test(
    "11 - MENTA_DIRECT blocked in integration",
    () =>
      blockedRequest(VALID_PATH, {}, {
        env: {
          POS_SHIFT_DATA_SOURCE: "MENTA_DIRECT",
        },
      })
  );

  await test(
    "12 - Unauthorized MENTA URL blocked",
    () =>
      blockedRequest(VALID_PATH, {}, {
        env: {
          MENTA_API_URL:
            "https://example.invalid",
        },
      })
  );

  await test(
    "13 - Wrong environment blocked",
    () =>
      blockedRequest(VALID_PATH, {}, {
        env: {
          VERCEL_ENV: "production",
        },
      })
  );

  await test(
    "14 - Authorized terminal operations",
    async () => {
      const env = createEnvironment();

      const result =
        await env.shift.getMentaShiftTransactions({
          merchantId: MERCHANT,
          terminalId: TERMINAL,
          start: START,
          end: END,
        });

      assert.equal(result.length, 1);
      assert.equal(env.calls.length, 2);
      assert.equal(
        result[0].terminal_id,
        TERMINAL
      );
    }
  );

  await test(
    "15 - Unauthorized terminal blocked",
    async () => {
      const env = createEnvironment();

      await assert.rejects(() =>
        env.shift.getMentaShiftTransactions({
          merchantId: MERCHANT,
          terminalId: OTHER_TERMINAL,
          start: START,
          end: END,
        })
      );

      assert.equal(env.calls.length, 0);
    }
  );

  await test(
    "16 - Other merchant response rejected",
    async () => {
      const env = createEnvironment({
        operations: [
          {
            ...VALID_OPERATION,
            merchant_id: OTHER_MERCHANT,
          },
        ],
      });

      await assert.rejects(() =>
        env.shift.getMentaShiftTransactions({
          merchantId: MERCHANT,
          terminalId: TERMINAL,
          start: START,
          end: END,
        })
      );

      assert.equal(env.calls.length, 2);
    }
  );

  await test(
    "17 - Other terminal operations excluded",
    async () => {
      const env = createEnvironment({
        operations: [
          VALID_OPERATION,
          {
            ...VALID_OPERATION,
            terminal_id: OTHER_TERMINAL,
            operation_id: "TEST-OP-002",
          },
        ],
      });

      const result =
        await env.shift.getMentaShiftTransactions({
          merchantId: MERCHANT,
          terminalId: TERMINAL,
          start: START,
          end: END,
        });

      assert.equal(result.length, 1);

      assert.equal(
        result[0].terminal_id,
        TERMINAL
      );
    }
  );

  console.log("");
  console.log("Passed: " + passed);
  console.log("Failed: " + failed);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});