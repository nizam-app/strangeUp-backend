import { onUserAccountRestricted } from "../messaging-realtime/messaging-realtime.lifecycle.js";

/**
 * Side effects when an account becomes ineligible for realtime messaging (suspension, deletion, etc.).
 * Call from staff/admin account restriction flows once those writers exist.
 */
export async function applyAccountRestrictionSideEffects(userId: string): Promise<void> {
  await onUserAccountRestricted(userId);
}
