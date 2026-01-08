import { useEffect } from "react";
import { useUIStore } from "@/store/ui-store";

function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
  );
}

export function useKeyboardShortcuts() {
  const { setSearchOpen, setAboutOpen, togglePause } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Meta+K or Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Skip if in input field
      if (isInputFocused()) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePause();
          break;
        case "r":
        case "R":
          // flyToRandomTrain() - to be implemented with train data
          break;
        case "a":
        case "A":
          setAboutOpen(true);
          break;
        case "Escape":
          setSearchOpen(false);
          setAboutOpen(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchOpen, setAboutOpen, togglePause]);
}
