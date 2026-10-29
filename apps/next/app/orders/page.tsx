import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrders } from "@/lib/data";
import { SESSION_COOKIE } from "@/lib/session";
import { Header } from "../ui";

export default async function Orders({ searchParams }: PageProps<"/orders">) {
  const params = await searchParams;
  const loggedIn = (await cookies()).get(SESSION_COOKIE)?.value === "1";
  const result = await getOrders({
    delay: Number(params.delay ?? 1200),
    loggedIn,
  });
  if (result.status === "unauthorized") {
    const search =
      typeof params.delay === "string" ? `?delay=${params.delay}` : "";
    redirect(`/login?next=${encodeURIComponent(`/orders${search}`)}`);
  }
  return (
    <div className="page">
      <Header title="주문 내역" />
      <ul className="list">
        {result.orders.map((order) => (
          <li key={order.id}>
            {order.id} · {order.name} · {order.price.toLocaleString()}원
          </li>
        ))}
      </ul>
    </div>
  );
}
