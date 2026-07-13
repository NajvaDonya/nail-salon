import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie'
import { getSessionFromToken } from '@/lib/auth-session'
import { getPostLoginRedirect } from '@/lib/auth-redirect'

const PROTECTED_ROUTES = {
  dashboard: ['/dashboard'],
  staff: ['/staff'],
  account: ['/account'],
} as const

function matchesRoute(pathname: string, routes: readonly string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const session = token ? await getSessionFromToken(token) : null

  if (pathname.startsWith('/auth/login')) {
    if (session) {
      return NextResponse.redirect(new URL(getPostLoginRedirect(session.role), request.url))
    }
    return NextResponse.next()
  }

  if (matchesRoute(pathname, PROTECTED_ROUTES.dashboard)) {
    if (!session) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (session.role !== 'MANAGER' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(getPostLoginRedirect(session.role), request.url))
    }
  }

  if (matchesRoute(pathname, PROTECTED_ROUTES.staff)) {
    if (!session) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (!['STAFF', 'MANAGER', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.redirect(new URL(getPostLoginRedirect(session.role), request.url))
    }
  }

  if (matchesRoute(pathname, PROTECTED_ROUTES.account)) {
    if (!session) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (session.role !== 'CUSTOMER') {
      return NextResponse.redirect(new URL(getPostLoginRedirect(session.role), request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/staff/:path*', '/account/:path*', '/auth/login'],
}
