import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { AddPageContent } from "@/components/AddPageContent";

export default async function AddPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return <AddPageContent />;
}
