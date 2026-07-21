import CatalogListingPage from '@/components/catalog/CatalogListingPage';

export default function WineryPage({
  params,
}: {
  params: { slug: string };
}) {
  return <CatalogListingPage mode="winery" slug={params.slug} />;
}
