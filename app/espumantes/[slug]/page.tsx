import CatalogListingPage from '@/components/catalog/CatalogListingPage';

export default function SparklingPage({
  params,
}: {
  params: { slug: string };
}) {
  return <CatalogListingPage mode="sparkling" slug={params.slug} />;
}
