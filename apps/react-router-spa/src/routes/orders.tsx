import { Suspense } from "react";
import {
  Await,
  Navigate,
  useLoaderData,
  useLocation,
  type LoaderFunctionArgs,
} from "react-router";
import { getOrders } from "../api";
import { Header } from "../ui";

export function loader({ request }: LoaderFunctionArgs) {
  const delay = Number(new URL(request.url).searchParams.get("delay") ?? 1200);
  return { orders: getOrders({ delay }) };
}

export function Component() {
  const { orders } = useLoaderData<typeof loader>();
  const location = useLocation();
  return (
    <div className="page">
      <Header title="주문 내역" />
      <Suspense fallback={<p className="loading">주문 내역을 불러오는 중…</p>}>
        <Await resolve={orders}>
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
