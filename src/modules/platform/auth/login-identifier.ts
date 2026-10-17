// Short names for the three provisioned test accounts. Resolving an identifier
// only selects an account; Better Auth still verifies its password and role.
const testAccountEmails: Record<string, string> = {
  teacher: "teacher@example.com",
  student: "student@example.com",
  admin: "admin@example.com",
};

export function resolveLoginEmail(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return Object.hasOwn(testAccountEmails, normalized)
    ? testAccountEmails[normalized]
    : normalized;
}
