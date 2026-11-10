import React, { useState } from 'react';
import { useAuthenticatedImage } from './useAuthenticatedImage';

type EventPosterProps = {
  src?: string | null;
  alt?: string;
  className: string;
};

export default function EventPoster({ src: source, alt = '', className }: EventPosterProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const { src, failed } = useAuthenticatedImage(source);

  if (source && !src && !failed) {
    return <div role="img" aria-label="Caricamento immagine…" aria-busy="true" className={`block bg-[#eef3f7] ${className}`} />;
  }
  if (!src || failed || src === failedSource) {
    return <div role="img" aria-label="Immagine non disponibile" className={`block bg-[#eef3f7] ${className}`} />;
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailedSource(src)} />;
}
