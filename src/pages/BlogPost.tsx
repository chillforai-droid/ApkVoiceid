import { Link, useParams, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Breadcrumbs, { breadcrumbJsonLd } from '../components/seo/Breadcrumbs';
import { useSEO } from '../hooks/useSEO';
import { blogPosts } from '../data/blogPosts';
import { keywordClusters } from '../data/seoContent';

const clusterSlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) return <Navigate to="/blog" replace />;

  const relatedCluster = keywordClusters.find((k) => clusterSlug(k.cluster) === post.clusterSlug || k.cluster === post.cluster);
  const related = blogPosts.filter((p) => p.slug !== post.slug && p.clusterSlug === post.clusterSlug).slice(0, 3);
  const canonical = `https://voiceid.online/blog/${post.slug}`;

  useSEO({
    title: `${post.title} | VoiceID Blog`,
    description: post.metaDescription,
    canonical,
    ogType: 'article',
    jsonLd: [
      breadcrumbJsonLd([{ label: 'Blog', path: '/blog' }, { label: post.title, path: `/blog/${post.slug}` }]),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.metaDescription,
        datePublished: post.date,
        dateModified: post.date,
        author: { '@type': 'Organization', name: post.author },
        publisher: { '@type': 'Organization', name: 'VoiceID', logo: { '@type': 'ImageObject', url: 'https://voiceid.online/favicon.svg' } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      },
    ],
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Blog', path: '/blog' }, { label: post.title, path: `/blog/${post.slug}` }]} />
      <main className="flex-grow pb-16 sm:pb-20 px-4 sm:px-6 max-w-3xl mx-auto w-full">
        <article className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
            <Link to={`/blog/topic/${post.clusterSlug}`} className="hover:underline">{post.cluster}</Link>
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-4">{post.title}</h1>
          <p className="text-gray-500 mb-8 italic">
            {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {post.author}
          </p>
          <div className="space-y-6">
            {post.paragraphs.map((p, i) => (
              <p key={i} className="text-lg text-gray-700 leading-relaxed">{p}</p>
            ))}
          </div>
        </article>

        {relatedCluster && (
          <aside className="mt-14 p-6 bg-gray-50 rounded-2xl">
            <h2 className="font-bold text-lg mb-2">Want to see this in action?</h2>
            <p className="text-gray-600 mb-4">Explore how VoiceID puts {relatedCluster.cluster.toLowerCase()} into practice.</p>
            <Link to={relatedCluster.targetPage} className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">
              Learn about {relatedCluster.cluster}
            </Link>
          </aside>
        )}

        {related.length > 0 && (
          <section className="mt-14" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-bold mb-6">More on {post.cluster}</h2>
            <ul className="space-y-4">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link to={`/blog/${r.slug}`} className="font-semibold hover:underline">{r.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link to="/blog" className="inline-block mt-14 text-sm font-semibold text-blue-600 hover:underline">← Back to all articles</Link>
      </main>
      <Footer />
    </div>
  );
}
