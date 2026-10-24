import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta(
  "Sign in",
  "Sign in to watch mill RM-01, review signal history, and open incidents.",
  "/login",
);

export default function LoginPage() {
  return <AuthForm mode="sign-in" />;
}
