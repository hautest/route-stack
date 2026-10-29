import { Header } from "../../ui";
import { ItemProvider } from "./item-context";
import { loadItem } from "./item";

// Shared by the detail page and the edit form.
export default async function ItemLayout({
  params,
  children,
}: LayoutProps<"/items/[id]">) {
  const item = await loadItem((await params).id);
  return (
    <div className="page">
      <Header title={item.title} />
      <ItemProvider item={item}>{children}</ItemProvider>
    </div>
  );
}
