import { describe, expect, it } from "vitest";
import { resolveAccess } from "@/lib/access";

const OWNER = "user_owner";
const EDITOR = "user_editor";
const VIEWER = "user_viewer";
const STRANGER = "user_stranger";

const shares = [
  { userId: EDITOR, role: "EDITOR" as const },
  { userId: VIEWER, role: "VIEWER" as const },
];

describe("resolveAccess", () => {
  it("gives the owner every capability", () => {
    const access = resolveAccess({ viewerId: OWNER, ownerId: OWNER, shares });
    expect(access).toEqual({
      level: "owner",
      canRead: true,
      canWrite: true,
      canManageSharing: true,
      canDelete: true,
    });
  });

  it("lets an editor write but not share or delete", () => {
    const access = resolveAccess({ viewerId: EDITOR, ownerId: OWNER, shares });
    expect(access.level).toBe("editor");
    expect(access.canWrite).toBe(true);
    expect(access.canManageSharing).toBe(false);
    expect(access.canDelete).toBe(false);
  });

  it("lets a viewer read only", () => {
    const access = resolveAccess({ viewerId: VIEWER, ownerId: OWNER, shares });
    expect(access.level).toBe("viewer");
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
  });

  it("denies a user with no share", () => {
    const access = resolveAccess({ viewerId: STRANGER, ownerId: OWNER, shares });
    expect(access.level).toBe("none");
    expect(access.canRead).toBe(false);
  });

  it("denies anonymous callers even when shares exist", () => {
    const access = resolveAccess({ viewerId: null, ownerId: OWNER, shares });
    expect(access.canRead).toBe(false);
  });

  it("prefers ownership over a stale share row for the same user", () => {
    // Defensive: a share pointing at the owner must never downgrade them.
    const access = resolveAccess({
      viewerId: OWNER,
      ownerId: OWNER,
      shares: [{ userId: OWNER, role: "VIEWER" }],
    });
    expect(access.canWrite).toBe(true);
  });
});
