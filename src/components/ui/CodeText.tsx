import React from 'react';

/** Indicator codes: two to four capitals followed by digits, optionally a range. */
const CODE_PATTERN = /\b([A-Z]{2,5}\d{2,3}(?:-\d{2,3})?)\b/g;

/**
 * Renders prose that mentions indicator codes, keeping those codes Latin.
 *
 * Digits in Persian body text are drawn with Persian glyphs by design, which
 * is right for a quantity and wrong for an identifier: "FFR02" is a lookup key
 * an auditor reads off a checklist, and "FFR۰۲" is not the same string to
 * them. Wrapping the code in the code face restores it.
 */
export const CodeText: React.FC<{ children: string }> = ({ children }) => {
  const parts = children.split(CODE_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        // split() with a capture group puts the matches at the odd indexes.
        i % 2 === 1 ? (
          <code key={i} className="ltr-code">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
};
