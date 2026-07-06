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
      
      const threshold80 = Number(budget.budget_limit) * 0.8;
      const threshold100 = Number(budget.budget_limit);

      if (newTotal >= threshold80) {
        let is100Percent = newTotal >= threshold100;
        let message = is100Percent 
          ? `Budget for ${category} exceeded 100%!` 
          : `Budget for ${category} exceeded 80%`;

        // Send email via Resend if >= 100%
        if (is100Percent) {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey) {
              // Fetch project owner id
              const { data: project } = await supabaseClient
                .from('projects')
                .select('user_id')
                .eq('id', projectId)
                .single();
              
              if (project?.user_id) {
                // Fetch the user's email using auth admin API
                const { data: authData } = await supabaseClient.auth.admin.getUserById(project.user_id);
                const ownerEmail = authData?.user?.email;

                if (ownerEmail) {
                  await fetch('https://api.resend.com/emails', {
                      method: 'POST',
                      headers: {
                          'Authorization': `Bearer ${resendApiKey}`,
                          'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                          from: 'TrackYourBudget <onboarding@resend.dev>', // Resend testing domain
                          to: ownerEmail,
                          subject: `🚨 Budget Alert: ${category} is at 100% capacity!`,
                          html: `<p>You have reached your budget limit for <strong>${category}</strong>.</p>
                                 <p>Current spent: ${newTotal}</p>
                                 <p>Budget limit: ${budget.budget_limit}</p>`
                      })
                  });
                }
              }
          }
        }
        
        return new Response(JSON.stringify({ alertTriggered: true, message }), {
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
