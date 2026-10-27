/** A model status is not consent. Public disclosure requires a separate opt-in. */
export function mayPublish(item: { status: string; edited: boolean; manual: boolean; publishConfirmed?: boolean }): boolean {
  return (item.status === "stated" && !item.edited && !item.manual) || item.publishConfirmed === true;
}
