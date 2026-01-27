import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PBKDF2 password verification function
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    
    const [iterationsStr, saltBase64, hashBase64] = parts;
    const iterations = parseInt(iterationsStr, 10);
    if (isNaN(iterations)) return false;
    
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const storedHashBytes = Uint8Array.from(atob(hashBase64), c => c.charCodeAt(0));
    
    const passwordBuffer = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveBits"]);
    
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
      key,
      32 * 8
    );
    
    const hashBytes = new Uint8Array(hashBuffer);
    if (hashBytes.length !== storedHashBytes.length) return false;
    
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < hashBytes.length; i++) {
      diff |= hashBytes[i] ^ storedHashBytes[i];
    }
    
    return diff === 0;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [];
  const allowOrigin = allowedOrigins.length === 0 
    ? (origin || "*")
    : (origin && allowedOrigins.some(o => origin.includes(o.trim()))) 
      ? origin 
      : "null";
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// Rate limiting (in-memory, per function instance)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Rate limiting by IP (10 attempts per 5 minutes)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, 10, 5 * 60 * 1000)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later.", authenticated: false }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Input validation
    const { password } = await req.json().catch(() => ({}));

    if (!password || typeof password !== "string" || password.length < 1 || password.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Invalid password format", authenticated: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all password records (we need to check each hash)
    const { data: passwords, error } = await supabase
      .from("investor_password")
      .select("id, name, is_artemis_management, password_hash, password");

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Authentication failed", authenticated: false }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to verify password against each stored hash
    let matchedUser = null;
    
    for (const user of passwords || []) {
      // First try password_hash (PBKDF2)
      if (user.password_hash) {
        const isValid = await verifyPassword(password, user.password_hash);
        if (isValid) {
          matchedUser = user;
          break;
        }
      }
      // Fallback to plain text password (for migration period only)
      else if (user.password && user.password === password) {
        matchedUser = user;
        console.warn("User authenticated with plain text password. Please migrate to hashed passwords.");
        break;
      }
    }

    if (!matchedUser) {
      return new Response(
        JSON.stringify({ error: "Invalid password", authenticated: false }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        authenticated: true,
        isArtemisManagement: matchedUser.is_artemis_management || false,
        userName: matchedUser.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-auth function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        authenticated: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

