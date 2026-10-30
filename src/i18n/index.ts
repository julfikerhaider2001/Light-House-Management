import { en, type Dictionary } from './en';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Dictionary>;

const dictionary: Dictionary = en;

/** Looks up a message and fills `{placeholders}`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary);
  return String(value).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}
