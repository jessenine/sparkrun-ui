// Augment the server module to provide correct types
declare module '@/lib/rpc/server' {
  export const serverClient: any;
}
