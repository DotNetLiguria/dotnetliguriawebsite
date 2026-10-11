import React from 'react';

/** Embeds schema.org structured data; search engines read it anywhere in the document. */
export default function JsonLd({ data }: { data: object }) {
  // "<" is escaped so that no value can close the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
