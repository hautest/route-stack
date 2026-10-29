import { connection } from "next/server";

export default async function ErrorPage(): Promise<never> {
  // Request time only, otherwise the build's prerender would hit the throw.
  await connection();
  throw new Error("/error 렌더 중 오류");
}
