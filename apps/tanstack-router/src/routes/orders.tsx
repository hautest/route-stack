import { createFileRoute, redirect } from "@tanstack/react-router";
import { getOrders } from "../api";
import { Header } from "../ui";

export const Route = createFileRoute("/orders")({
  validateSearch: (search: Record<string, unknown>): { delay?: number } => ({
    delay: search.delay == null ? undefined : Number(search.delay),
  }),
  loaderDeps: ({ search: { delay } }) => ({ delay }),
  loader: async ({ deps: { delay = 1200 }, location }) => {
    const result = await getOrders({ delay });
    if (result.status === "unauthorized") {
      throw redirect({ to: "/login", search: { next: location.href } });
    }
    return result.orders;
  },
  pendingComponent: () => (
    <div className="page">
      <Header title="주문 내역" />
      <p className="loading">주문 내역을 불러오는 중…</p>
    </div>
  ),
  component: Orders,
});

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
