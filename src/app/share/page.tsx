import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { SharePageContent } from "@/components/SharePageContent";

export default async function SharePage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <ConvexClientProvider>
      <SharePageContent />
    </ConvexClientProvider>
  );
}
