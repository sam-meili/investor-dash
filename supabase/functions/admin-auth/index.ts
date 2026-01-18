import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null, allowedDomains: string[]): HeadersInit {
  const headers: HeadersInit = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400", // 24 hours
  };

  // If no allowed domains specified, allow all origins
  if (allowedDomains.length === 0) {
    headers["Access-Control-Allow-Origin"] = origin || "*";
    return headers;
  }

  // Check if origin is allowed
  if (origin) {
    const isAllowed = allowedDomains.some((domain) => {
      const trimmedDomain = domain.trim();
      // Check if origin matches domain (with or without protocol)
      return origin.includes(trimmedDomain) || 
             origin === `http://${trimmedDomain}` || 
             origin === `https://${trimmedDomain}`;
    });
    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      return headers;
    }
  }

  // Default: allow all if origin check fails (for development)
  headers["Access-Control-Allow-Origin"] = origin || "*";
  return headers;
}

serve(async (req) => {
  // Log immediately - this should appear if function is invoked at all
  console.log(`[${new Date().toISOString()}] Function invoked - Method: ${req.method}`);
  
  const origin = req.headers.get("origin");
  const method = req.method;
  
  // Log headers (convert to object for logging)
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  console.log("Request headers:", JSON.stringify(headersObj));
  console.log("Origin:", origin);
  
  // Handle CORS preflight requests FIRST - before any other logic
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    // Get allowed domains from environment variable (comma-separated)
    const allowedDomains = Deno.env.get("ALLOWED_DOMAINS")?.split(",").map(d => d.trim()) || [];
    console.log("Allowed domains:", JSON.stringify(allowedDomains));
    
    // For OPTIONS, be very permissive to ensure it works
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Max-Age": "86400",
    };
    
    console.log("Returning OPTIONS response with headers:", JSON.stringify(corsHeaders));
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders
    });
  }

  // Get allowed domains from environment variable (comma-separated)
  const allowedDomains = Deno.env.get("ALLOWED_DOMAINS")?.split(",").map(d => d.trim()) || [];

  try {
    // Get origin and referer from request
    const referer = req.headers.get("referer");

    // Check if origin is in allowed domains
    const isAllowed =
      allowedDomains.length === 0 ||
      (origin && allowedDomains.some((domain) => origin.includes(domain))) ||
      (referer && allowedDomains.some((domain) => referer.includes(domain)));

    // Get CORS headers for this request
    const corsHeaders = getCorsHeaders(origin, allowedDomains);

    if (!isAllowed && allowedDomains.length > 0) {
      return new Response(
        JSON.stringify({ error: "Domain not allowed" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request body parsed:", JSON.stringify(requestBody));
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { password } = requestBody;

    if (!password) {
      console.log("No password provided in request");
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Password received, checking database...");

    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey,
      });
      throw new Error(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables not set"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query investor_password table to find matching password
    console.log("Querying investor_password table with password:", password);
    console.log("Password length:", password.length);
    console.log("Password bytes:", JSON.stringify(Array.from(new TextEncoder().encode(password))));
    
    // Use .maybeSingle() instead of .single() to avoid errors when no row found
    const { data, error } = await supabase
      .from("investor_password")
      .select("*")
      .eq("password", password)
      .maybeSingle();

    console.log("Database query result:", {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
    });

    if (error) {
      console.error("Database error:", JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({ 
          error: "Database error", 
          details: error.message,
          authenticated: false 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!data) {
      console.log("No matching password found in database");
      console.log("Searching for password with length:", password.length);
      
      // Debug: Check what passwords exist (without exposing actual passwords)
      const { data: allPasswords, error: listError } = await supabase
        .from("investor_password")
        .select("id, name, is_artemis_management, password");
      
      if (listError) {
        console.error("Error listing passwords:", listError);
      } else {
        console.log("Total passwords in database:", allPasswords?.length || 0);
        // Log password lengths for debugging (without exposing actual passwords)
        if (allPasswords && allPasswords.length > 0) {
          const passwordLengths = allPasswords.map(p => ({
            id: p.id,
            name: p.name,
            passwordLength: p.password?.length || 0,
          }));
          console.log("Password lengths in database:", JSON.stringify(passwordLengths, null, 2));
          
          // Check if any password matches when trimmed (compare securely)
          const trimmedInput = password.trim();
          const inputBytes = Array.from(new TextEncoder().encode(password));
          const trimmedBytes = Array.from(new TextEncoder().encode(trimmedInput));
          
          let exactMatch = false;
          let trimmedMatch = false;
          
          for (const pwd of allPasswords) {
            if (pwd.password === password) {
              exactMatch = true;
              break;
            }
            if (pwd.password === trimmedInput) {
              trimmedMatch = true;
            }
          }
          
          console.log("Input password length:", password.length);
          console.log("Input password bytes:", inputBytes);
          console.log("Trimmed input length:", trimmedInput.length);
          console.log("Trimmed input bytes:", trimmedBytes);
          console.log("Exact match found:", exactMatch);
          console.log("Trimmed match found:", trimmedMatch);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Invalid password", 
          authenticated: false,
          debug: "Check function logs for details"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Password match found! User:", data.name, "Is management:", data.is_artemis_management);

    // Return success with management flag
    return new Response(
      JSON.stringify({
        authenticated: true,
        isArtemisManagement: data.is_artemis_management || false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-auth function:", error);
    const corsHeaders = getCorsHeaders(origin, allowedDomains);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        authenticated: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

