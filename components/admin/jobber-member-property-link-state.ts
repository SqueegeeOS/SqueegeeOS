export function memberPropertyFilterChange(nextFilter: string) {
  return {
    memberFilter: nextFilter,
    selectedMembershipId: "",
    samePropertyConfirmed: false,
  } as const;
}
