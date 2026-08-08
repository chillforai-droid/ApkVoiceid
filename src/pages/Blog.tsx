import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Breadcrumbs, { breadcrumbJsonLd } from '../components/seo/Breadcrumbs';
import { useSEO } from '../hooks/useSEO';
import { blogPosts } from '../data/blogPosts';
import { blogTopicClusterNames, blogIdeas } from '../data/seoContent';

const clusterSlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function Blog() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);

  useSEO({
    title: 'VoiceID Blog — Secure Messaging, Privacy & Voice Communication',
    description: 'Guides and insights on secure messaging, private communication, voice messages, online chat, and real-time messaging from the VoiceID team.',
    canonical: 'https://voiceid.online/blog',
    jsonLd: [
      breadcrumbJsonLd([{ label: 'Blog', path: '/blog' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'VoiceID Blog',
        url: 'https://voiceid.online/blog',
        description: 'Secure messaging, privacy, and voice communication insights from the VoiceID team.',
      },
    ],
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return blogPosts;
    const needle = q.trim().toLowerCase();
    return blogPosts.filter(
      (p) => p.title.toLowerCase().includes(needle) || p.cluster.toLowerCase().includes(needle) || p.metaDescription.toLowerCase().includes(needle)
    );
  }, [q]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Blog', path: '/blog' }]} />
      <main className="flex-grow pb-16 sm:pb-20 px-4 sm:px-6 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-4 mt-6">VoiceID Blog</h1>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl">Guides and insights on secure messaging, private communication, voice messages, and real-time chat.</p>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) setParams({ q: query.trim() });
            else setParams({});
          }}
          className="mb-10 flex gap-2"
        >
          <label htmlFor="blog-search" className="sr-only">Search the blog</label>
          <input
            id="blog-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="flex-grow border border-gray-200 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">Search</button>
        </form>

        <nav aria-label="Blog topics" className="flex flex-wrap gap-2 mb-14">
          {blogTopicClusterNames.map((name) => (
            <Link
              key={name}
              to={`/blog/topic/${clusterSlug(name)}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              {name}
            </Link>
          ))}
        </nav>

        {filtered.length === 0 ? (
          <p className="text-gray-500">No articles matched “{q}”. Try a different search, or browse the topics above.</p>
        ) : (
          <div className="space-y-14">
            {filtered.map((post) => (
              <article key={post.slug}>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                  <Link to={`/blog/topic/${post.clusterSlug}`} className="hover:underline">{post.cluster}</Link>
                </p>
                <h2 className="text-2xl sm:text-4xl font-bold mb-3">
                  <Link to={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link>
                </h2>
                <p className="text-gray-500 mb-4 italic">{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-lg text-gray-700 leading-relaxed">{post.metaDescription}</p>
                <Link to={`/blog/${post.slug}`} className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:underline">Read article →</Link>
              </article>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-400 mt-16">
          {blogIdeas.length - blogPosts.length} more articles are in progress across our topic clusters — browse them by topic above.
        </p>
      </main>
      <Footer />
    </div>
  );
}
