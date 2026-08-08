import { useEffect } from 'react';

export interface SEOOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string;
  robots?: string; // e.g. 'index,follow' | 'noindex,nofollow'
  jsonLd?: Record<string, any> | Record<string, any>[];
}

function upsertMeta(selector: string, attr: string, attrValue: string, contentAttr: string, content: string) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute(contentAttr, content);
  return el;
}

/**
 * Applies per-page SEO metadata: title, description, canonical, Open Graph,
 * Twitter Card, robots directive, and one or more JSON-LD structured data
 * blocks. Cleans up injected JSON-LD scripts and restores the previous
 * title/robots value on unmount so navigating between routes never leaves
 * stale metadata behind.
 */
export const useSEO = ({ title, description, canonical, ogImage, ogType, keywords, robots, jsonLd }: SEOOptions) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    // Description
    upsertMeta('meta[name="description"]', 'name', 'description', 'content', description);

    // Keywords (low ranking value, but harmless + still requested/used by some verticals)
    if (keywords) {
      upsertMeta('meta[name="keywords"]', 'name', 'keywords', 'content', keywords);
    }

    // Canonical
    upsertMeta('link[rel="canonical"]', 'rel', 'canonical', 'href', canonical);

    // Robots
    const robotsMeta = upsertMeta('meta[name="robots"]', 'name', 'robots', 'content', robots || 'index, follow');

    // Open Graph
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', 'content', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', 'content', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', 'content', canonical);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'content', ogType || 'website');

    // Twitter
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', 'content', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', 'content', description);

    if (ogImage) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', 'content', ogImage);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', 'content', ogImage);
    }

    // JSON-LD structured data — one <script> per object, tagged so we can clean up.
    const scripts: HTMLScriptElement[] = [];
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      blocks.forEach((block) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.seoInjected = 'true';
        script.text = JSON.stringify(block);
        document.head.appendChild(script);
        scripts.push(script);
      });
    }

    return () => {
      document.title = prevTitle;
      robotsMeta.setAttribute('content', 'index, follow');
      scripts.forEach((s) => s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonical, ogImage, ogType, keywords, robots, JSON.stringify(jsonLd)]);
};
