export function getByPath(value, path) {
  if (!path) return value;

  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (current == null) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, value);
}

export function firstByPaths(value, paths) {
  for (const path of paths) {
    const found = getByPath(value, path);
    if (found !== undefined && found !== null && found !== "") return found;
  }

  return undefined;
}
