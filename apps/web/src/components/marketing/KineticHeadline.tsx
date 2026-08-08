interface KineticHeadlineProps {
  /** First translated sentence fragment. */
  lead: string;
  /** Second translated sentence fragment, read as a continuation of `lead`. */
  accent: string;
  className?: string;
}

/**
 * The hero headline.
 *
 * `lead` and `accent` arrive as two separate translated strings — next-intl
 * keys, not a hand-split sentence — joined here at render rather than in the
 * translation file, so word order stays whatever the target locale needs.
 */
export function KineticHeadline({
  lead,
  accent,
  className,
}: KineticHeadlineProps): React.ReactElement {
  return (
    <h1 className={className}>
      {lead} {accent}
    </h1>
  );
}
