/** HTTP responses that must not carry a body, even when the upstream body is empty. */
export function mustOmitResponseBody(method: string, status: number): boolean {
  return method.toUpperCase() === 'HEAD' || status === 204 || status === 205 || status === 304;
}
