import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher(["/", "/login", "/signup", "/auth/verify", "/terms", "/privacy"]);

export default convexAuthNextjsMiddleware(
  async (request: NextRequest) => {
    if (!isPublicRoute(request) && !(await isAuthenticatedNextjs())) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }, // 30 days
);

export const config = {
  // Run middleware on all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
