import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role to read arbitrary user emails
    )

    const { projectId, amount, category } = await req.json()
    
    // Fetch budget for category
    const { data: budget } = await supabaseClient
      .from('category_budgets')
      .select('budget_limit')
      .eq('project_id', projectId)
      .eq('category', category)
      .single()

    if (budget && budget.budget_limit) {
      // Calculate total spent in this category
      const { data: transactions } = await supabaseClient
        .from('transactions')
        .select('amount')
        .eq('project_id', projectId)
        .eq('category', category)
        
      const totalSpent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const newTotal = totalSpent + Number(amount);
      
      const threshold = Number(budget.budget_limit) * 0.8; // 80% threshold

      if (newTotal >= threshold) {
        // Send email via Resend
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
            // Fetch project owners
            const { data: members } = await supabaseClient
              .from('project_members')
              .select('user_id')
              .eq('project_id', projectId)
            
            // This is a simplified skeleton - in reality, you'd fetch user emails from auth.users via an RPC or Admin API
            // and trigger an email to them using Resend.
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'alerts@trackyourbudget.com',
                    to: 'user@example.com', // Replace with real fetched email
                    subject: `Budget Alert: ${category} is at ${Math.round((newTotal/budget.budget_limit)*100)}% capacity`,
                    html: `<p>You are approaching your budget limit for ${category}.</p>`
                })
            })
        }
        
        return new Response(JSON.stringify({ alertTriggered: true, message: `Budget for ${category} exceeded 80%` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ alertTriggered: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
