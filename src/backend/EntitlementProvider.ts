export interface EntitlementProvider {
  canUseFeature(feature: string): Promise<boolean>;
}
