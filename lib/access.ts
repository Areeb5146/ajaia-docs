/**
 * Access resolution for documents.
 *
 * Kept as a pure function so the rule set is unit-testable and so every API
 * route resolves permission the same way. Routes call `resolveAccess` and act on
 * the returned capability flags — no route reimplements the rules.
 */

export type ShareRole = "VIEWER" | "EDITOR";

export type AccessInput = {
  viewerId: string | null;
  ownerId: string;
  /** Shares on the document. Only the viewer's entry matters, but callers may pass all. */
  shares: Array<{ userId: string; role: ShareRole }>;
};

export type Access = {
  /** "owner" | "editor" | "viewer" | "none" */
  level: "owner" | "editor" | "viewer" | "none";
  canRead: boolean;
  /** Edit content and title. */
  canWrite: boolean;
  /** Grant/revoke access. Owner-only by design; see ARCHITECTURE.md. */
  canManageSharing: boolean;
  canDelete: boolean;
};

const DENIED: Access = {
  level: "none",
  canRead: false,
  canWrite: false,
  canManageSharing: false,
  canDelete: false,
};

export function resolveAccess({
  viewerId,
  ownerId,
  shares,
}: AccessInput): Access {
  if (!viewerId) return DENIED;

  if (viewerId === ownerId) {
    return {
      level: "owner",
      canRead: true,
      canWrite: true,
      canManageSharing: true,
      canDelete: true,
    };
  }

  const share = shares.find((s) => s.userId === viewerId);
  if (!share) return DENIED;

  if (share.role === "EDITOR") {
    return {
      level: "editor",
      canRead: true,
      canWrite: true,
      canManageSharing: false,
      canDelete: false,
    };
  }

  return {
    level: "viewer",
    canRead: true,
    canWrite: false,
    canManageSharing: false,
    canDelete: false,
  };
}
