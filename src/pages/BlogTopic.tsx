import { Link, useParams, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Breadcrumbs, { breadcrumbJsonLd } from '../components/seo/Breadcrumbs';
import { useSEO } from '../hooks/useSEO';
import { blogPosts } from '../data/blogPosts';
import { blogIdeas, keywordClusters } from '../data/seoContent';

export default function BlogTopic() {
  const { cluster } = useParams<{ cluster: string }>();
  const clusterIdeas = blogIdeas.filter((b) => b.clusterSlug === cluster);

  if (clusterIdeas.length === 0) return <Navigate to="/blog" replace />;

  const clusterName = clusterIdeas[0].cluster;
  const published = blogPosts.filter((p) => p.clusterSlug === cluster);
  const publishedSlugs = new Set(published.map((p) => p.slug));
  const backlog = clusterIdeas.filter((b) => !publishedSlugs.has(b.slug));
  const landingPage = keywordClusters.find((k) => k.cluster === clusterName || k.cluster.toLowerCase().includes(clusterName.split(' ')[0].toLowerCase()));

  useSEO({
    title: `${clusterName} Articles & Guides | VoiceID Blog`,
    description: `Explore VoiceID's articles and guides on ${clusterName.toLowerCase()} — privacy, security, and practical tips for better communication.`,
    canonical: `https://voiceid.online/blog/topic/${cluster}`,
    jsonLd: breadcrumbJsonLd([{ label: 'Blog', path: '/blog' }, { label: clusterName, path: `/blog/topic/${cluster}` }]),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Blog', path: '/blog' }, { label: clusterName, path: `/blog/topic/${cluster}` }]} />
      <main className="flex-grow pb-16 sm:pb-20 px-4 sm:px-6 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-4 mt-6">{clusterName}</h1>
        <p className="text-lg text-gray-600 mb-4 max-w-2xl">
          Everything VoiceID has published on {clusterName.toLowerCase()}.
        </p>
        {landingPage && (
          <Link to={landingPage.targetPage} className="inline-block mb-12 text-sm font-semibold text-blue-600 hover:underline">
            See how VoiceID handles {clusterName.toLowerCase()} →
          </Link>
        )}

        {published.length > 0 && (
          <div className="space-y-10 mb-16">
            {published.map((post) => (
              <article key={post.slug}>
                <h2 className="text-2xl font-bold mb-2">
                  <Link to={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link>
                </h2>
                <p className="text-gray-600">{post.metaDescription}</p>
              </article>
            ))}
          </div>
        )}

        {backlog.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-xl font-bold mb-4">Coming Soon</h2>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-gray-600 list-disc pl-5">
              {backlog.map((idea) => (
                <li key={idea.id}>{idea.title}</li>
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
