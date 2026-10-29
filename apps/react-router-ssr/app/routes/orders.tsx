import { Suspense } from "react";
import { Await, Navigate, useLocation } from "react-router";
import { getOrders, isLoggedIn } from "../data.server";
import { Header } from "../ui";
import type { Route } from "./+types/orders";

export function loader({ request }: Route.LoaderArgs) {
  const delay = Number(new URL(request.url).searchParams.get("delay") ?? 1200);
  return { orders: getOrders({ delay, loggedIn: isLoggedIn(request) }) };
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  return (
    <div className="page">
      <Header title="주문 내역" />
      <Suspense fallback={<p className="loading">주문 내역을 불러오는 중…</p>}>
        <Await resolve={loaderData.orders}>
          {(result) =>
            result.status === "unauthorized" ? (
              <Navigate
                replace
                to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
              />
            ) : (
              <ul className="list">
                {result.orders.map((order) => (
                  <li key={order.id}>
                    {order.id} · {order.name} · {order.price.toLocaleString()}원
                  </li>
                ))}
              </ul>
            )
          }
        </Await>
      </Suspense>
    </div>
  );
}
