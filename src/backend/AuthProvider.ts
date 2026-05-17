export interface AuthProvider {
  getUser(): Promise<null>;
}
