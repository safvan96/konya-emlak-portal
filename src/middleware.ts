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
    if (path.startsWith("/my-listings") || path.startsWith("/favorites") || path.startsWith("/profile") || path.startsWith("/preferences") || path.startsWith("/compare") || path.startsWith("/notifications")) {
      if (token?.role === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // IP adresini header olarak ilet (API route'larda loglama için)
    const response = NextResponse.next();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    response.headers.set("x-client-ip", ip);
    return response;
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
    "/analytics/:path*",
    "/settings/:path*",
    "/my-listings/:path*",
    "/favorites/:path*",
    "/profile/:path*",
    "/api/listings/:path*",
    "/api/customers/:path*",
    "/api/assignments/:path*",
    "/api/scraper/:path*",
    "/api/logs/:path*",
    "/api/cities/:path*",
    "/api/blacklist/:path*",
    "/api/dashboard/:path*",
    "/api/favorites/:path*",
    "/api/profile/:path*",
    "/api/preferences/:path*",
    "/api/notes/:path*",
    "/preferences/:path*",
    "/compare/:path*",
    "/notifications/:path*",
    "/api/notifications/:path*",
    "/api/analytics/:path*",
    "/api/sessions/:path*",
    "/api/images/:path*",
    "/api/listings/bulk/:path*",
  ],
};
