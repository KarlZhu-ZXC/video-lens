import type { AuthProvider } from './AuthProvider';
import type { BillingProvider } from './BillingProvider';
import type { EntitlementProvider } from './EntitlementProvider';
import type { RemoteConfigProvider } from './RemoteConfigProvider';

export const nullAuthProvider: AuthProvider = { getUser: async () => null };
export const nullBillingProvider: BillingProvider = { getPlan: async () => null };
export const nullEntitlementProvider: EntitlementProvider = { canUseFeature: async () => true };
export const nullRemoteConfigProvider: RemoteConfigProvider = { loadRemoteConfig: async () => null };
