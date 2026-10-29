import { Suspense } from "react";
import { Header } from "../ui";
import { LoginForm } from "./login-form";

// A logged-in visitor is sent to `next` by proxy.ts.
export default function Login() {
  return (
    <div className="page">
      <Header title="로그인" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
