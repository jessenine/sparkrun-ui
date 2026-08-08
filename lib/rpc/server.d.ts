// Augment the server module to provide correct types
// `any` is deliberate: a module-augmentation escape hatch for the ORPC client
// whose generated types have an inference limitation (see page imports which
// also cast through `as any` with a @ts-ignore).
declare module "@/lib/rpc/server" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ORPC type-inference escape hatch
  export const serverClient: any;
}
