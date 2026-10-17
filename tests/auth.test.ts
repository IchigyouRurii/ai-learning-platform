import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "@/modules/platform/server/auth-config";
import { resolveLoginEmail } from "@/modules/platform/auth/login-identifier";
import { createTestPostgres } from "./helpers/postgres";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let auth: ReturnType<typeof createAuth>;
const password = "Local-test-passphrase-29!";
const email = "learner@example.test";

beforeAll(async () => {
  postgres = await createTestPostgres();
  auth = createAuth(postgres.pool, {
    baseURL: "http://localhost:3000",
    secret: "test-only-7f72ec97300ab32244c8a201d5bc9a009b78",
  });
  await (await getMigrations(auth.options)).runMigrations();
}, 30000);
beforeEach(async () => {
  await postgres.database.exec(
    'truncate table "user", "session", "account", "verification", "rateLimit" cascade',
  );
});
afterAll(async () => {
  if (postgres) await postgres.database.close();
});

function request(
  path: string,
  body: Record<string, unknown>,
  cookie = "",
  origin = "http://localhost:3000",
) {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
async function signup(extra: Record<string, unknown> = {}) {
  return request("sign-up/email", {
    email,
    password,
    name: "学习者",
    ...extra,
  });
}
function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

describe("real authentication with PostgreSQL", () => {
  it.each(["teacher", "student", "admin"] as const)(
    "signs in the %s test alias with its provisioned short password and server role",
    async (role) => {
      const testEmail = `${role}@example.com`;
      await signup({ email: testEmail, name: role });
      const user = await postgres.pool.query(
        'select id from "user" where email = $1',
        [testEmail],
      );
      const id = user.rows[0].id;
      const context = await auth.$context;
      await context.internalAdapter.updatePassword(
        id,
        await context.password.hash(role),
      );
      await postgres.pool.query('update "user" set role = $1 where id = $2', [
        role,
        id,
      ]);
      await postgres.pool.query('delete from "session" where "userId" = $1', [
        id,
      ]);
      const response = await request("sign-in/email", {
        email: resolveLoginEmail(` ${role.toUpperCase()} `),
        password: role,
      });
      expect(response.status).toBe(200);
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: sessionCookie(response) }),
      });
      expect(session?.user.id).toBe(id);
      expect(session?.user.role).toBe(role);
      expect(
        (
          await request("sign-in/email", {
            email: resolveLoginEmail(role),
            password: "wrong-password",
          })
        ).status,
      ).toBe(401);
    },
  );

  it("keeps ordinary email addresses and unknown names separate from test aliases", () => {
    expect(resolveLoginEmail(" Learner@Example.Test ")).toBe(
      "learner@example.test",
    );
    expect(resolveLoginEmail("teacher@another.example")).toBe(
      "teacher@another.example",
    );
    expect(resolveLoginEmail("unknown")).toBe("unknown");
    expect(resolveLoginEmail("constructor")).toBe("constructor");
  });

  it("still requires regular registrations to use passwords of at least 10 characters", async () => {
    expect((await signup({ password: "short" })).status).toBe(400);
  });

  it("creates a student account, hashes the password, and issues a usable session", async () => {
    const response = await signup();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.user.role).toBe("student");
    const stored = await postgres.database.query<{ password: string }>(
      'select password from "account"',
    );
    expect(stored.rows[0].password).not.toBe(password);
    expect(stored.rows[0].password.length).toBeGreaterThan(40);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie(response) }),
    });
    expect(session?.user.email).toBe(email);
  });
  it("does not allow registering as teacher or updating one's role through the public API", async () => {
    const forged = await signup({ role: "teacher" });
    if (forged.ok) {
      expect((await forged.json()).user.role).toBe("student");
      await request("update-user", { role: "teacher" }, sessionCookie(forged));
    } else {
      expect(forged.status).toBe(400);
      expect((await signup()).ok).toBe(true);
    }
    const users = await postgres.database.query<{ role: string }>(
      'select role from "user"',
    );
    expect(users.rows[0].role).toBe("student");
  });
  it("rejects wrong passwords and forged cookies", async () => {
    await signup();
    expect(
      (
        await request("sign-in/email", {
          email,
          password: "Wrong-password-123",
        })
      ).status,
    ).toBe(401);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: "minicourse.session_token=forged" }),
    });
    expect(session).toBeNull();
  });
  it("logs out and invalidates the session", async () => {
    const response = await signup();
    const cookie = sessionCookie(response);
    expect((await request("sign-out", {}, cookie)).ok).toBe(true);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
  });
  it("signs in again using the correct password", async () => {
    const registration = await signup();
    await request("sign-out", {}, sessionCookie(registration));
    const response = await request("sign-in/email", { email, password });
    expect(response.status).toBe(200);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie(response) }),
    });
    expect(session?.user.role).toBe("student");
  });
  it("uses the server-assigned teacher role after revoking old sessions", async () => {
    const registration = await signup();
    const oldCookie = sessionCookie(registration);
    await postgres.pool.query(
      `update "user" set role = 'teacher' where email = $1`,
      [email],
    );
    await postgres.pool.query(`delete from "session"`);
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: oldCookie }),
      }),
    ).toBeNull();
    const response = await request("sign-in/email", { email, password });
    expect(response.status).toBe(200);
    expect(
      (
        await auth.api.getSession({
          headers: new Headers({ cookie: sessionCookie(response) }),
        })
      )?.user.role,
    ).toBe("teacher");
  });
  it("rejects cross-origin registration", async () => {
    const response = await request(
      "sign-up/email",
      { email, password, name: "Test" },
      "",
      "https://untrusted.example",
    );
    expect(response.status).toBe(403);
    expect(
      (await postgres.database.query('select id from "user"')).rows,
    ).toHaveLength(0);
  });
});
