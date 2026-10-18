import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SignInScreen } from "@/components/studio/sign-in-screen";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="min-h-dvh bg-paper" />;
  if (user) return <Navigate to="/" search={{ page: undefined, view: "page" }} />;
  return <SignInScreen />;
}
