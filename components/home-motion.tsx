'use client';

import {useEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';

type Props = ComponentPropsWithoutRef<'section'> & {quiet?: boolean};

/** Only decorative CSS animation runs here; content remains visible without JS. */
export function MotionSection({quiet = false, children, ...props}: Props) {
  const section = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [foreground, setForeground] = useState(false);

  useEffect(() => {
    const visibility = () => setForeground(document.visibilityState === 'visible');
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {threshold: 0.01})
      : null;
    if (section.current && observer) observer.observe(section.current);
    else setInView(true);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return <section {...props} ref={section} data-motion={inView && foreground && !quiet ? 'on' : 'off'}>{children}</section>;
}
