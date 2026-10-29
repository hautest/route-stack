import { useState } from "react";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { getProduct, type Product } from "../api";
import { Header } from "../ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  return { product: await getProduct(id) };
}

export function Component() {
  const { product } = useLoaderData<typeof loader>();
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

function ProductView({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="content stack">
      <p>{product.description}</p>
      <p>{(product.price * quantity).toLocaleString()}원</p>
      <div className="row">
        <button
          className="like"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <span aria-label="수량">{quantity}</span>
        <button className="like" onClick={() => setQuantity((q) => q + 1)}>
          +
        </button>
      </div>
      <h3>다른 상품</h3>
      <ul>
        {[product.id + 1, product.id + 2].map((id) => (
          <li key={id}>
            <Link to={`/products?id=${id}`}>상품 {id}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
