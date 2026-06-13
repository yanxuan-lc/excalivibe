// TanStack Query keys + fetchers. Centralise query keys here so screens
// reference them through one source of truth. Use the factory pattern
// (key-factory) so refetch / invalidation across screens stays type-safe.
//
// Example:
//   export const queryKeys = {
//     contacts: {
//       all:    ["contacts"] as const,
//       detail: (id: string) => ["contacts", id] as const,
//     },
//     inbox: {
//       all:    ["inbox"] as const,
//     },
//   };
//
//   export const fetchContacts = async () => fetch("/api/contacts").then(r => r.json());
//
// In a screen:
//   const q = useQuery({ queryKey: queryKeys.contacts.all, queryFn: fetchContacts });
//
// During UED prototyping, fetchers should hit stub data in src/stub/* — no
// real backend. The query-key surface is what survives into the engineering
// handoff; the stub implementations get replaced post-port.

export const queryKeys = {
  // (add per-feature keys here)
} as const;
