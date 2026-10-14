// Svelte 5 in legacy mode (App.svelte) treats any object as a new `{#key}` value each time the expression is
// evaluated, so keying a component on an object rebuilds it on every update (issue #105: the terminal was torn down
// and rebuilt on every agent state change). A number per object is stable: same object, same key.
const ids = new WeakMap<object, number>();
let next = 0;

export function identityOf(value: object | null | undefined): number {
  if (!value) return 0;
  let id = ids.get(value);
  if (id === undefined) ids.set(value, (id = ++next));
  return id;
}
