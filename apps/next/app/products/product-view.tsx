"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/data";

export function ProductView({ product }: { product: Product }) {
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
            <Link href={`/products?id=${id}`}>상품 {id}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
