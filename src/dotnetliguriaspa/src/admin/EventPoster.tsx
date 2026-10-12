import React, { useState } from 'react';

type EventPosterProps = {
  src?: string | null;
  alt?: string;
  className: string;
};

export default function EventPoster({ src, alt = '', className }: EventPosterProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!src || src === failedSource) {
    return <div role="img" aria-label="Immagine non disponibile" className={`block bg-[#eef3f7] ${className}`} />;
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailedSource(src)} />;
}
