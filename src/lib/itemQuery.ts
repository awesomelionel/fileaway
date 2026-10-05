/** Feed URL with the detail-modal `item` param removed. Other params stay. */
export function hrefWithoutItemParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("item");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
