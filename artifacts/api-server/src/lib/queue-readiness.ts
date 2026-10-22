export function isQueueReady(input: {
  required: boolean;
  enabled: boolean;
  workerHealthy: boolean | null;
}): boolean {
  if (!input.required) return true;
  return input.enabled && input.workerHealthy === true;
}
