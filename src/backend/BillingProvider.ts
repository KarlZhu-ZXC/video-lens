export interface BillingProvider {
  getPlan(): Promise<null>;
}
