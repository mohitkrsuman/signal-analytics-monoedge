import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta(
  "Create account",
  "Create an account to watch mill RM-01 and review stored signals and alerts.",
  "/signup",
);

export default function SignupPage() {
  return <AuthForm mode="sign-up" />;
}
