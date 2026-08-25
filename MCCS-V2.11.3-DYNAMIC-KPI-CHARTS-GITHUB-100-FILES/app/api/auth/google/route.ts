import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSuperAdmin } from "@/lib/mccs/auth";
import { ensureConfiguredGoogleRoot, saveGoogleRefreshToken } from "@/lib/google/drive";

export const runtime = "nodejs";

function redirectUri(request: Request) {
  return `${new URL(request.url).origin}/api/auth/google/`;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    if (!code) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");
      const state = randomBytes(24).toString("hex");
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", redirectUri(request));
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file");
      auth.searchParams.set("access_type", "offline");
      auth.searchParams.set("prompt", "consent");
      auth.searchParams.set("state", state);

      const response = NextResponse.redirect(auth);
      response.cookies.set("mccs_google_oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }

    const cookieHeader = request.headers.get("cookie") || "";
    const savedState = cookieHeader.split(";").map(x => x.trim()).find(x => x.startsWith("mccs_google_oauth_state="))?.split("=")[1];
    if (!returnedState || !savedState || returnedState !== savedState) throw new Error("Google authorization state validation failed. Please try connecting again.");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured.");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(request),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) throw new Error(`Google authorization failed (${tokenResponse.status}): ${tokenText}`);
    const tokens = JSON.parse(tokenText) as { refresh_token?: string };
    if (!tokens.refresh_token) throw new Error("Google did not issue a refresh token. Reconnect and approve access again.");
    await saveGoogleRefreshToken(tokens.refresh_token);
    await ensureConfiguredGoogleRoot();

    const response = NextResponse.redirect(new URL("/admin/google-drive?connected=1", request.url));
    response.cookies.delete("mccs_google_oauth_state");
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/google-drive?error=${encodeURIComponent(error instanceof Error ? error.message : "Google Drive connection failed")}`, request.url));
  }
}
