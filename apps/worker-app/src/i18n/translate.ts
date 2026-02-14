/**
 * Deep get value from object using dot notation
 * @example getNestedValue(obj, 'auth.error.emptyPhone') => 'Phone number required'
 */
export function getNestedValue(obj: Record<string, any>, path: string): string {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Return the key itself as fallback
      return path;
    }
  }

  return typeof value === 'string' ? value : path;
}

/**
 * Simple template interpolation
 * @example interpolate('Hello {name}', { name: 'John' }) => 'Hello John'
 */
export function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export type TranslateFunction = (key: string, vars?: Record<string, string | number>) => string;

export function createTranslator(messages: Record<string, any>): TranslateFunction {
  return (key: string, vars?: Record<string, string | number>) => {
    const value = getNestedValue(messages, key);
    return interpolate(value, vars);
  };
}
