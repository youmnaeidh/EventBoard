import { useEffect } from "react";

export function useDocTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · EventBoard` : "EventBoard · فعاليات المدينة المنورة";
  }, [title]);
}
