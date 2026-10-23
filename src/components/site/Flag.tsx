/** Inline SVG flags (emoji flags don't render on Windows). Simplified but recognisable. */
export function Flag({ c, className = "h-4 w-6" }: { c: string; className?: string }) {
  const cls = `${className} shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10`;
  if (c === "TH") return (<svg viewBox="0 0 30 20" className={cls} aria-label="泰国"><rect width="30" height="20" fill="#A51931" /><rect y="3.33" width="30" height="13.33" fill="#F4F5F8" /><rect y="6.67" width="30" height="6.67" fill="#2D2A4A" /></svg>);
  if (c === "PH") return (<svg viewBox="0 0 30 20" className={cls} aria-label="菲律宾"><rect width="30" height="10" fill="#0038A8" /><rect y="10" width="30" height="10" fill="#CE1126" /><path d="M0 0 L17.3 10 L0 20 Z" fill="#fff" /><circle cx="5.8" cy="10" r="2.2" fill="#FCD116" /></svg>);
  if (c === "MY") return (<svg viewBox="0 0 28 14" className={cls} aria-label="马来西亚"><rect width="28" height="14" fill="#fff" />{[0, 2, 4, 6, 8, 10, 12].map((y) => <rect key={y} y={y} width="28" height="1" fill="#CC0001" />)}<rect width="14" height="8" fill="#010066" /><circle cx="5.6" cy="4" r="2.9" fill="#FC0" /><circle cx="6.4" cy="4" r="2.4" fill="#010066" /><circle cx="10" cy="4" r="1.3" fill="#FC0" /></svg>);
  if (c === "ID") return (<svg viewBox="0 0 30 20" className={cls} aria-label="印尼"><rect width="30" height="10" fill="#CE1126" /><rect y="10" width="30" height="10" fill="#fff" /></svg>);
  if (c === "VN") return (<svg viewBox="0 0 30 20" className={cls} aria-label="越南"><rect width="30" height="20" fill="#DA251D" /><path d="M15 4.5 16.4 8.8H21L17.3 11.4 18.7 15.7 15 13 11.3 15.7 12.7 11.4 9 8.8H13.6Z" fill="#FF0" /></svg>);
  return null;
}
