import productsData from "./products.json";

export type Product = {
  slug: string;
  badge: string;
  title: string;
  description: string;
  repoHref: string;
  articleHref: string;
  tags: string[];
  bullets: string[];
  available: boolean;
};

export const products: Product[] = productsData as Product[];

export function getProduct(slug: string): Product {
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    throw new Error(
      `Product "${slug}" not found in products.json - fix the ProductCTA slug`,
    );
  }
  return product;
}
