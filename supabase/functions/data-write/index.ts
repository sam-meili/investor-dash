import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PBKDF2 password verification
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

// CORS headers
function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [];
  const allowOrigin = allowedOrigins.length === 0 
    ? (origin || "*")
    : (origin && allowedOrigins.some(o => origin.includes(o.trim()))) 
      ? origin 
      : "null";
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// Rate limiting
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

// Authenticate admin password
async function authenticateAdmin(password: string, supabase: any): Promise<boolean> {
  const { data: passwords, error } = await supabase
    .from("investor_password")
    .select("password_hash, password");

  if (error) {
    console.error("Database error during auth:", error);
    return false;
  }

  for (const user of passwords || []) {
    if (user.password_hash) {
      const isValid = await verifyPassword(password, user.password_hash);
      if (isValid) return true;
    } else if (user.password && user.password === password) {
      return true;
    }
  }

  return false;
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
    // Rate limiting (30 write operations per minute)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, 30, 60 * 1000)) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get admin password from header
    const adminPassword = req.headers.get("x-admin-password");
    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
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

    // Authenticate admin
    const isAuthenticated = await authenticateAdmin(adminPassword, supabase);
    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { operation, table, id, data } = await req.json();

    // Validate operation
    const allowedOperations = ["create", "update", "delete"];
    if (!allowedOperations.includes(operation)) {
      return new Response(
        JSON.stringify({ error: "Invalid operation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Whitelist allowed tables
    const allowedTables = [
      "cash_position",
      "monthly_burn",
      "customer",
      "employee_count",
      "pipeline_client",
      "quarter_goal"
    ];

    if (!table || !allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ error: "Invalid table" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Field whitelist for each table
    const allowedFields: Record<string, string[]> = {
      cash_position: ["id", "amount", "date", "notes"],
      monthly_burn: ["id", "amount", "month", "notes"],
      customer: ["id", "name", "is_pilot", "contract_value", "arr", "start_date", "status"],
      employee_count: ["id", "count", "date", "is_full_time"],
      pipeline_client: ["id", "name", "segment", "stage", "estimated_contract_size", "engagement_start_date", "status", "notes"],
      quarter_goal: ["id", "name", "target_value", "current_value", "quarter", "year", "metric_type", "order"],
    };

    // Handle CREATE operation
    if (operation === "create") {
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Missing data" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Filter data to only allowed fields
      const whitelistedData: Record<string, any> = {};
      const tableFields = allowedFields[table] || [];
      
      for (const field of tableFields) {
        if (data[field] !== undefined) {
          whitelistedData[field] = data[field];
        }
      }

      // Input validation
      if (Object.keys(whitelistedData).length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid fields provided" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: result, error } = await supabase
        .from(table)
        .insert(whitelistedData)
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Database operation failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ data: result }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle UPDATE operation
    if (operation === "update") {
      if (!id || !data) {
        return new Response(
          JSON.stringify({ error: "Missing id or data" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Filter data to only allowed fields (exclude id from update data)
      const whitelistedData: Record<string, any> = {};
      const tableFields = allowedFields[table] || [];
      
      for (const field of tableFields) {
        if (field !== "id" && data[field] !== undefined) {
          whitelistedData[field] = data[field];
        }
      }

      if (Object.keys(whitelistedData).length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid fields to update" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: result, error } = await supabase
        .from(table)
        .update(whitelistedData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Database operation failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ data: result }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle DELETE operation
    if (operation === "delete") {
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Database operation failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Error in data-write function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
