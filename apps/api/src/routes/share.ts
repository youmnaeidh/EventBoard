import { Router } from "express";
import { config } from "../config.js";
import { handler, notFound } from "../middleware/errors.js";
import { getEventByRef } from "../services/events.js";
import { mediaPathPattern } from "../services/imageStorage.js";

export const shareRouter = Router();
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
shareRouter.get("/share/:slug", handler(async (req, res) => {
  // Deliberately anonymous: owners cannot create public previews of drafts.
  const event = await getEventByRef(String(req.params.slug));
  if (!event || event.publicationStatus !== "published") throw notFound();
  const web = new URL(config.PUBLIC_WEB_URL);
  const base = web.href.replace(/\/$/, "") + "/";
  const eventUrl = config.WEB_HASH_ROUTER === "true"
    ? `${base}#/events/${encodeURIComponent(event.slug)}`
    : new URL(`events/${encodeURIComponent(event.slug)}`, base).href;
  const canonical = new URL(`/api/share/${encodeURIComponent(event.slug)}`, config.PUBLIC_API_URL).href;
  const image = event.image ? (mediaPathPattern.test(event.image)
    ? new URL(event.image, config.PUBLIC_API_URL).href
    : event.image.startsWith("/assets/") ? new URL(event.image.slice(1), base).href
    : /^https:\/\//.test(event.image) ? event.image : null) : null;
  const title = escape(event.title), description = escape(event.summary);
  res.set("Cache-Control", "private, no-store").type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · EventBoard</title><meta name="description" content="${description}">
<link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="ar_SA">
<meta property="og:site_name" content="EventBoard"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escape(canonical)}">
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">
${image ? `<meta property="og:image" content="${escape(image)}"><meta name="twitter:image" content="${escape(image)}">` : ""}
<style>body{margin:0;background:#faf6ef;color:#24172c;font:18px/1.8 system-ui,sans-serif}main{max-width:680px;margin:8vh auto;padding:24px}img{width:100%;max-height:420px;object-fit:cover;border-radius:16px}h1{line-height:1.4}a{display:inline-block;background:#512f59;color:white;padding:12px 24px;border-radius:10px;text-decoration:none}small{color:#65586a}</style></head>
<body><main><small>EventBoard · فعاليات المدينة</small>${image ? `<img src="${escape(image)}" alt="">` : ""}<h1>${title}</h1><p>${description}</p><p>${escape(event.venue)} · ${escape(event.district)}</p><a href="${escape(eventUrl)}">عرض تفاصيل الفعالية</a></main></body></html>`);
}));
