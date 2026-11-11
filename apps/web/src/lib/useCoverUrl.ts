import { useEffect, useState } from "react";
import { api } from "./api";
import { assetUrl } from "./assets";

export function useCoverUrl(image: string | null) {
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);
  const internal = image?.startsWith("/api/media/");
  useEffect(() => {
    if (!image || !internal) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    api.image(image, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path: image, url: objectUrl });
    }).catch(() => { /* Keep the generated cover on failed image requests. */ });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image, internal]);
  return internal ? loaded?.path === image ? loaded.url : null : image ? assetUrl(image) : null;
}
