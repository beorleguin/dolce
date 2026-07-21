import CatalogListingPage from '@/components/catalog/CatalogListingPage';

export default function WineVarietalPage({
  params,
}: {
  params: { slug: string };
}) {
  return <CatalogListingPage mode="wine-varietal" slug={params.slug} />;
}
