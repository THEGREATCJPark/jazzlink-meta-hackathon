/** A model status is not consent. Public disclosure requires a separate opt-in. */
export function mayPublish(item: { status: string; edited: boolean; manual: boolean; publishConfirmed?: boolean }): boolean {
  return (item.status === "stated" && !item.edited && !item.manual) || item.publishConfirmed === true;
}

/** Do not trust a stored edit flag when the displayed value itself differs. */
export function valueWasEdited(originalDisplay: string, currentDisplay: string, edited: boolean): boolean {
  return edited || originalDisplay.trim() !== currentDisplay.trim();
}
