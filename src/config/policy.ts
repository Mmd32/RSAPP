/**
 * Evidence policy for the field test.
 *
 * While false, indicators marked `requiresPhoto` only *recommend* a photo:
 * the friction sheet saves without one and QC does not block submission.
 * Flip to true to enforce photos everywhere at once.
 */
export const PHOTOS_REQUIRED = false;

/**
 * Frictions are recorded as a plain yes/no during the field test. While false,
 * indicators marked `requiresComment` do not block submission when the
 * evaluator adds no description.
 */
export const DESCRIPTIONS_REQUIRED = false;
