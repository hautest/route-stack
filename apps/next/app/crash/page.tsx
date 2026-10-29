import { connection } from "next/server";

// No error.tsx on the way up, so this reaches global-error.tsx.
export default async function Crash(): Promise<never> {
  await connection();
  throw new Error("/crash 렌더 중 오류");
}
