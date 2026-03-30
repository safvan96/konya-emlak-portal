import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin routes
    if (path.startsWith("/dashboard") || path.startsWith("/api/admin")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/my-listings", req.url));
      }
    }

    // Customer routes
    if (path.startsWith("/my-listings") || path.startsWith("/favorites") || path.startsWith("/profile")) {
      if (token?.role === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/listings/:path*",
    "/customers/:path*",
    "/assignments/:path*",
    "/logs/:path*",
    "/scraper/:path*",
    "/cities/:path*",
    "/my-listings/:path*",
    "/favorites/:path*",
    "/profile/:path*",
    "/api/listings/:path*",
    "/api/customers/:path*",
    "/api/assignments/:path*",
    "/api/scraper/:path*",
    "/api/logs/:path*",
    "/api/cities/:path*",
  ],
};
