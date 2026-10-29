import { getProduct } from "@/lib/data";
import { Header } from "../ui";
import { ProductView } from "./product-view";

export default async function Products({
  searchParams,
}: PageProps<"/products">) {
  const product = await getProduct(Number((await searchParams).id));
  return (
    <div className="page">
      <Header title={product?.name ?? "상품 없음"} />
      {product ? (
        <ProductView key={product.id} product={product} />
      ) : (
        <p className="error">상품을 찾을 수 없어요.</p>
      )}
    </div>
  );
}
