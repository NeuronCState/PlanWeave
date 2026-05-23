import type { DesktopBridgeApi } from "@planweave/runtime";
import { vi } from "vitest";

export function createDesktopBridgeMock(overrides: Partial<DesktopBridgeApi> = {}): DesktopBridgeApi {
  const defaults: Partial<DesktopBridgeApi> = {
    onPackageFileChanged: () => () => undefined
  };

  return new Proxy({ ...defaults, ...overrides } as Record<PropertyKey, unknown>, {
    get(target, property) {
      if (!(property in target)) {
        target[property] = vi.fn().mockResolvedValue(null);
      }
      return target[property];
    }
  }) as DesktopBridgeApi;
}
