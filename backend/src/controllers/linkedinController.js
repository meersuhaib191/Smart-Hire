// src/controllers/linkedinController.js
import axios from "axios";
import qs from "querystring";

/**
 * Minimal LinkedIn OAuth flow (server-side)
 *
 * Requires these env vars:
 * - LINKEDIN_CLIENT_ID
 * - LINKEDIN_CLIENT_SECRET
 * - LINKEDIN_REDIRECT_URI  (e.g. https://yourdomain.com/api/auth/linkedin/callback)
 *
 * This implementation:
 * - /start -> redirects user to LinkedIn auth URL
 * - /callback -> LinkedIn redirects back with code -> exchange for access_token -> fetch profile -> create or login user
 *
 * IMPORTANT: adapt user creation/login to your authController/userModel
 */
const SCOPE = "r_liteprofile r_emailaddress";

export const linkedinAuthStart = (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const state = Math.random().toString(36).substring(2, 15);
  const url =
    `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&scope=${encodeURIComponent(SCOPE)}`;
  res.redirect(url);
};

export const linkedinAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    // fetch profile
    const profileRes = await axios.get("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const emailRes = await axios.get(
      "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const profile = profileRes.data;
    const email = emailRes.data?.elements?.[0]?.["handle~"]?.emailAddress || null;

    // TODO: find or create user in DB. For now return profile
    res.json({ linkedin_profile: profile, email });
  } catch (err) {
    console.error(err?.response?.data || err);
    res.status(500).json({ message: "LinkedIn auth failed", err: err?.toString() });
  }
};
