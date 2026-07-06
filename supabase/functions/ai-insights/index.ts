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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { projectId, action, transactions } = await req.json()

    // Ensure user has access to this project
    const { data: member, error: memberError } = await supabaseClient
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .single()

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'Unauthorized access to project' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY') || ''

    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API Key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = `You are a helpful personal finance advisor. Analyze the following transactions and provide:
1. Key spending insights and patterns
2. Anomaly detection (unusual spending compared to patterns)
3. Smart categorization suggestions for uncategorized items
4. Actionable tips to save money

Transactions: ${JSON.stringify(transactions)}

Respond in a friendly, concise manner in plain text (no markdown headers).`

    // Call Groq API (OpenAI-compatible endpoint)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a helpful personal finance advisor.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    const aiData = await response.json()

    if (!response.ok) {
      throw new Error(aiData?.error?.message || 'Groq API error')
    }

    const insight = aiData?.choices?.[0]?.message?.content || 'No insights generated.'

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
