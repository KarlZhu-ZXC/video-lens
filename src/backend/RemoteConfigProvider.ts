export interface RemoteConfigProvider {
  loadRemoteConfig(): Promise<null>;
}
