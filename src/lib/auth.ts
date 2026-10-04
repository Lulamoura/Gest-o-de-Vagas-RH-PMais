export const isRhDepartmentName = (departmentName: unknown): boolean =>
  typeof departmentName === 'string' && departmentName.trim().toLowerCase() === 'rh'
