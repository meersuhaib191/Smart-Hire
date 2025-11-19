// src/services/linkedinService.js
// small wrapper functions for linkedinController when you want to implement DB integration
import axios from "axios";
import qs from "querystring";

export async function exchangeCodeForToken(code) {
  const res = await axios.post(
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
  return res.data;
}
