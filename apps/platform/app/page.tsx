import { redirect } from "next/navigation";
import { hasPlatformSession } from "@/server/api-client";
import { LoginForm } from "@/features/login-form";

/**
 * Platform sign-in. If a platform_session cookie is already present the operator
 * is sent to the dashboard; otherwise the login form is shown.
 */
export default async function PlatformLogin() {
  if (await hasPlatformSession()) {
    redirect("/dashboard");
  }
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--ui-space-6)",
      }}
    >
      <LoginForm />
    </div>
  );
}
