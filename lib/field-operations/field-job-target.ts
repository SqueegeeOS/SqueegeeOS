/** Use the staffing assignment for native technicians, even on a member visit. */
export function fieldJobTarget(input: {
  propertyId?: string | null;
  appointmentId?: string | null;
  fieldAssignmentId?: string | null;
}) {
  return input.fieldAssignmentId
    ? { fieldAssignmentId: input.fieldAssignmentId }
    : { propertyId: input.propertyId, appointmentId: input.appointmentId };
}
