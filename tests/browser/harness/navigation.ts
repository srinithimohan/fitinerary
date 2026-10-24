// The harness has no Next App Router. Only navigation intent is observable here.
export function useRouter() {
  return { push: (path: string) => window.history.pushState({}, '', path) };
}
