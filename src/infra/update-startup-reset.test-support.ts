import type { GatewayScheduler } from "./gateway-scheduler.js";
import { createGatewayUpdateLifecycle } from "./update-check-lifecycle.js";
import { resetUpdateStatusState } from "./update-status-state.js";

export function resetUpdateAvailableStateForTest(scheduler: GatewayScheduler): void {
  resetUpdateStatusState();
  createGatewayUpdateLifecycle(scheduler);
}
