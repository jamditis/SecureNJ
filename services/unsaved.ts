/**
 * Some tools hold work that is not saved anywhere until the person saves a
 * file (witness notes, the family plan). This module lets such a tool say
 * so, so that the browser and the app ask before the work is lost.
 */
import { useEffect } from 'react';

let unsavedTools = 0;

export function hasUnsavedWork(): boolean {
  return unsavedTools > 0;
}

/** A tool calls this with `true` while it holds work that is not saved. */
export function useUnsavedWork(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    unsavedTools += 1;
    // The browser shows its own question on reload and on close.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => {
      unsavedTools -= 1;
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty]);
}
