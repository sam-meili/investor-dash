import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PBKDF2 password verification
async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;

    const [iterationsStr, saltBase64, hashBase64] = parts;
    const iterations = parseInt(iterationsStr, 10);
    if (isNaN(iterations)) return false;

    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
    const storedHashBytes = Uint8Array.from(atob(hashBase64), (c) =>
      c.charCodeAt(0),
    );

    const passwordBuffer = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
      key,
      32 * 8,
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
  const allowOrigin =
    allowedOrigins.length === 0
      ? origin || "*"
      : origin && allowedOrigins.some((o) => origin.includes(o.trim()))
        ? origin
        : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-admin-password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// Rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
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
async function authenticateAdmin(
  password: string,
  supabase: any,
): Promise<boolean> {
  const { data: passwords, error } = await supabase
    .from("investor_password")
    .select("password_hash");

  if (error) {
    console.error("Database error during auth:", error);
    return false;
  }

  for (const user of passwords || []) {
    if (user.password_hash) {
      const isValid = await verifyPassword(password, user.password_hash);
      if (isValid) return true;
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
      headers: corsHeaders,
    });
  }

  try {
    // Rate limiting (60 requests per minute)
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip, 60, 60 * 1000)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin password from header
    const adminPassword = req.headers.get("x-admin-password");
    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { operation, table, id, filters } = await req.json();

    // Validate operation
    const allowedOperations = ["getKPIs", "list", "get"];
    if (!allowedOperations.includes(operation)) {
      return new Response(JSON.stringify({ error: "Invalid operation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Whitelist allowed tables
    const allowedTables = [
      "cash_position",
      "monthly_burn",
      "customer",
      "employee_count",
      "pipeline_client",
      "quarter_goal",
      "pipeline_note",
    ];

    // Handle getKPIs operation (aggregated data)
    if (operation === "getKPIs") {
      const { data: cashPositions } = await supabase
        .from("cash_position")
        .select("*")
        .order("date", { ascending: false })
        .limit(1);

      const { data: monthlyBurns } = await supabase
        .from("monthly_burn")
        .select("*")
        .order("month", { ascending: false })
        .limit(1);

      const { data: customers } = await supabase.from("customer").select("*");

      const { data: employeeCounts } = await supabase
        .from("employee_count")
        .select("*")
        .order("date", { ascending: false });

      const { data: pipelineClients } = await supabase
        .from("pipeline_client")
        .select("*");

      const { data: pipelineNotes } = await supabase
        .from("pipeline_note")
        .select("*")
        .order("order", { ascending: true });

      const customerCount = customers?.length || 0;
      const totalARR =
        customers?.reduce((sum, customer) => sum + (customer.arr || 0), 0) || 0;
      const totalContractValue =
        customers?.reduce(
          (sum, customer) => sum + (customer.contract_value || 0),
          0,
        ) || 0;

      const latestFullTimeCount =
        employeeCounts
          ?.filter((ec) => ec.is_full_time === true)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )[0]?.count || 0;
      const latestContractorCount =
        employeeCounts
          ?.filter((ec) => ec.is_full_time === false)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )[0]?.count || 0;

      // Format pipeline clients
      const formatPipelineClient = (p: any) => ({
        id: p.id,
        name: p.name,
        segment: p.segment,
        stage: p.stage || "initial_meeting",
        estimatedContractSize: p.estimated_contract_size || 0,
        engagementStartDate: p.engagement_start_date,
        status: p.status,
        notes: p.notes,
        daysSinceEngagement: p.engagement_start_date
          ? Math.floor(
              (new Date().getTime() -
                new Date(p.engagement_start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0,
      });

      const formattedClients = (pipelineClients || []).map(
        formatPipelineClient,
      );

      // Group pipeline by segment and stage
      const segments = ["smb", "mid_market", "large_cap"];
      const stages = [
        "initial_meeting",
        "pilot_scoping",
        "pilot",
        "contracting",
      ];

      const pipelineMatrix: any = {};
      segments.forEach((segment) => {
        pipelineMatrix[segment] = {};
        stages.forEach((stage) => {
          const clients = formattedClients.filter(
            (p) => p.segment === segment && p.stage === stage,
          );
          pipelineMatrix[segment][stage] = {
            count: clients.length,
            clients: clients,
            totalValue: clients.reduce(
              (sum, c) => sum + (c.estimatedContractSize || 0),
              0,
            ),
          };
        });
      });

      return new Response(
        JSON.stringify({
          cashPosition: cashPositions?.[0]?.amount || 0,
          cashPositionDate: cashPositions?.[0]?.date || null,
          monthlyBurn: monthlyBurns?.[0]?.amount || 0,
          monthlyBurnMonth: monthlyBurns?.[0]?.month || null,
          customerCount,
          totalARR,
          totalContractValue,
          fullTimeEmployeeCount: latestFullTimeCount,
          contractorCount: latestContractorCount,
          customers: (customers || []).map((c) => ({
            id: c.id,
            name: c.name,
            is_pilot: c.is_pilot,
            contract_value: c.contract_value || 0,
            arr: c.arr || 0,
            start_date: c.start_date,
            status: c.status,
          })),
          pipelineClients: formattedClients,
          pipelineMatrix: pipelineMatrix,
          pipelineNotes: pipelineNotes || [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle list operation
    if (operation === "list") {
      if (!table || !allowedTables.includes(table)) {
        return new Response(JSON.stringify({ error: "Invalid table" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase.from(table).select("*");

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply default ordering
      if (table === "cash_position") {
        query = query.order("date", { ascending: false });
      } else if (table === "monthly_burn") {
        query = query.order("month", { ascending: false });
      } else if (table === "employee_count") {
        query = query.order("date", { ascending: false });
      } else if (
        table === "quarter_goal" &&
        filters?.quarter &&
        filters?.year
      ) {
        query = query.order("order", { ascending: true });
      } else if (table === "pipeline_note") {
        query = query.order("order", { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Database operation failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle get operation (single record)
    if (operation === "get") {
      if (!table || !allowedTables.includes(table) || !id) {
        return new Response(
          JSON.stringify({ error: "Invalid table or missing id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Database error:", error);
        return new Response(JSON.stringify({ error: "Record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in data-read function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
