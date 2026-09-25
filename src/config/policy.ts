/**
 * Evidence policy for the field test.
 *
 * While false, indicators marked `requiresPhoto` only *recommend* a photo:
 * the friction sheet saves without one and QC does not block submission.
 * Flip to true to enforce photos everywhere at once.
 */
export const PHOTOS_REQUIRED = false;
