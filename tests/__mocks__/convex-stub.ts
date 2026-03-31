// Stub for Convex generated modules and third-party deps used in Jest tests

const noop = () => ({});
const vProxy: Record<string, () => unknown> = new Proxy({}, {
  get: () => noop,
});

export default {};
export const query = noop;
export const mutation = noop;
export const internalMutation = noop;
export const internalAction = noop;
export const v = vProxy;
export const internal = new Proxy({}, { get: () => new Proxy({}, { get: () => '' }) });
export const ApifyClient = class {};
export const GoogleGenerativeAI = class {};
