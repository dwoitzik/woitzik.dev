import productsData from "./products.json";

export type Product = {
  slug: string;
  badge: string;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  compareAtPrice?: string;
  href: string;
  articleHref: string;
  tags: string[];
  bullets: string[];
  available: boolean;
};

export const products: Product[] = productsData as Product[];

export function getProduct(slug: string): Product {
  return products.find((p) => p.slug === slug) ?? products[0];
}
