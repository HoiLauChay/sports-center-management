export const pickDefined = <T extends object, K extends keyof T>(source: T | undefined, keys: readonly K[]) => {
  if (!source) return undefined;
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
};
