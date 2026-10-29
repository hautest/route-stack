import { createFileRoute, redirect } from "@tanstack/react-router";
import { getOrders } from "../api";
import { Header } from "../ui";

export const Route = createFileRoute("/orders")({
  validateSearch: (search: Record<string, unknown>): { delay?: number } => ({
    delay: Number(search.delay) || undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, location }) => {
    const result = await getOrders({ data: deps.delay ?? 1200 });
    if (result.status === "unauthorized") {
      throw redirect({ to: "/login", search: { next: location.href } });
    }
    return result.orders;
  },
  pendingComponent: OrdersPending,
  component: Orders,
});

function OrdersPending() {
  return (
    <div className="page">
      <Header title="주문 내역" />
      <p className="loading">주문 내역을 불러오는 중…</p>
    </div>
  );
}

function Orders() {
  const orders = Route.useLoaderData();
  return (
    <div className="page">
      <Header title="주문 내역" />
      <ul className="list">
        {orders.map((order) => (
          <li key={order.id}>
            {order.id} · {order.name} · {order.price.toLocaleString()}원
          </li>
        ))}
      </ul>
    </div>
  );
}
