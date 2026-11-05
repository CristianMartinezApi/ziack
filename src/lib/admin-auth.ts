import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = "ziack-admin-session";
const SESSION_SECONDS = 60 * 60 * 8;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure AUTH_SECRET com pelo menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}

export async function createAdminSession(user: { id: string; email: string }) {
  const token = await new SignJWT({ email: user.email, role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(getSecret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getAdminSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "ADMIN" && typeof payload.sub === "string"
      ? { id: payload.sub, email: typeof payload.email === "string" ? payload.email : "" }
      : null;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin-login");
  return session;
}

export async function clearAdminSession() {
  (await cookies()).delete(COOKIE_NAME);
}
