import type { GatewayScheduler } from "./gateway-scheduler.js";
import { createGatewayUpdateLifecycle } from "./update-check-lifecycle.js";
import { setUpdateAvailableCache, setUpdateScheduleCache } from "./update-status-state.js";

export function resetUpdateStatusState(): void {
  setUpdateAvailableCache({ next: null });
  setUpdateScheduleCache({ next: null });
}

export function resetUpdateAvailableStateForTest(scheduler: GatewayScheduler): void {
  resetUpdateStatusState();
  createGatewayUpdateLifecycle(scheduler);
}
