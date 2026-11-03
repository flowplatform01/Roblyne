import { useLayoutEffect } from "react";
import { useLocation } from "wouter";

const NOINDEX = "noindex,nofollow,noarchive";

function setRobots(content: string): void {
  let element = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.name = "robots";
    document.head.appendChild(element);
  }
  element.content = content;
}

export function RouteSeoPolicy() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    setRobots(NOINDEX);
  }, [location]);

  return null;
}
