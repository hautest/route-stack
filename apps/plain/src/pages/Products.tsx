import { useEffect, useState } from "react";
import { getProduct, type Product } from "../api";
import { Header } from "../Header";
import { Link } from "../router";

export function Products({ id }: { id: number }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    getProduct(id).then((p) => active && setProduct(p));
    return () => {
      active = false;
    };
  }, [id]);

  if (product === undefined) {
    return (
      <div className="page">
        <Header title="" />
        <p className="loading">불러오는 중…</p>
      </div>
    );
  }
  return (
    <div className="page">
      <Header title={product?.name ?? "상품 없음"} />
      {product ? (
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
            {[product.id + 1, product.id + 2].map((other) => (
              <li key={other}>
                <Link href={`/products?id=${other}`}>상품 {other}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="error">상품을 찾을 수 없어요.</p>
      )}
    </div>
  );
}
