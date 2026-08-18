import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未登入" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "登入無效" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 開發者白名單（請改成你的 email）
    const DEVELOPER_EMAILS = [
      "tomlin530@yahoo.com.tw",
      "n_950143@hotmail.com",
    ]
    const email = (userData.user.email || "").toLowerCase()
    const meta = userData.user.user_metadata || {}
    const isDev =
      DEVELOPER_EMAILS.includes(email) ||
      meta.is_developer === true ||
      meta.role === "admin"

    if (!isDev) {
      return new Response(JSON.stringify({ error: "僅開發者可建立臨時帳號" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const loginId = String(body.login_id || "").toLowerCase().replace(/[^a-z0-9_]/g, "")
    const password = String(body.password || "")
    const displayName = String(body.display_name || loginId)

    if (!loginId || loginId.length < 3) {
      return new Response(JSON.stringify({ error: "login_id 無效" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "密碼至少 6 碼" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tempEmail = loginId + "@temp.safereunion.local"

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: tempEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        full_name: displayName,
        temp_account: true,
        created_by: userData.user.id,
      },
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email: tempEmail,
        user_id: data.user?.id,
        display_name: displayName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
