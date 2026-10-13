// "Subs, Client" for the groups an item is limited to, or null if it's
// visible to everyone.
export function restrictionLabel(
  visibleGroupIds: string[] | null,
  groups: { id: string; name: string }[]
): string | null {
  if (!visibleGroupIds) return null;
  return visibleGroupIds
    .map((id) => groups.find((group) => group.id === id)?.name ?? "a deleted group")
    .join(", ");
}
