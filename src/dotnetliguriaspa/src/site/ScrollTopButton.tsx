import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { Icon } from './icons';

/** Floating "back to top" control, shown after the reader has scrolled down. */
export default function ScrollTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <Button
      onPress={() => window.scrollTo({ top: 0 })}
      className="fixed bottom-6 right-6 z-30 inline-flex size-12 cursor-pointer items-center justify-center rounded-full bg-navy text-white shadow-lift outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700"
      aria-label="Torna all'inizio della pagina"
    >
      <Icon name="arrow" className="size-5 -rotate-90" />
    </Button>
  );
}
