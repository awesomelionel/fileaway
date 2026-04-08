import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { SharePageContent } from "@/components/SharePageContent";

export default async function SharePage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return <SharePageContent />;
}
