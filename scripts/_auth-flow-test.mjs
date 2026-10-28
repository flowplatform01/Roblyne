import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (fs.existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

const api = process.env.API_ORIGIN ?? "http://127.0.0.1:8085";
const testEmail = `auth-test-${Date.now()}@roblyne.local`;
const password = "TestPass123!";

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function register(email) {
  const res = await fetch(`${api}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
    credentials: "include",
    body: JSON.stringify({ email, password, name: "Auth Test User" }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, cookie: parseSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie")) };
}

async function login(email) {
  const res = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, cookie: parseSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie")) };
}

async function me(cookie) {
  const res = await fetch(`${api}/api/auth/me`, {
    headers: { cookie, origin: "http://127.0.0.1:5173" },
    credentials: "include",
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

console.log("API:", api);
console.log("Register:", testEmail);
const reg = await register(testEmail);
console.log("register status", reg.status, JSON.stringify(reg.body));
console.log("register cookie present", Boolean(reg.cookie));

if (reg.status === 201 && reg.cookie) {
  const authMe = await me(reg.cookie);
  console.log("me after register", authMe.status, JSON.stringify(authMe.body));

  const badLogin = await login(testEmail + "x");
  console.log("login wrong email", badLogin.status, JSON.stringify(badLogin.body));

  const badPass = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
    body: JSON.stringify({ email: testEmail, password: "wrong-password" }),
  });
  console.log("login wrong pass", badPass.status, await badPass.text());

  const goodLogin = await login(testEmail);
  console.log("login good", goodLogin.status, JSON.stringify(goodLogin.body));
}

// Retry duplicate register
const dup = await register(testEmail);
console.log("duplicate register", dup.status, JSON.stringify(dup.body));
