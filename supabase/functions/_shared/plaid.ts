export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function fetchPlaid(endpoint: string, body: any) {
  const env = Deno.env.get('PLAID_ENV') || 'sandbox';
  const url = `https://${env}.plaid.com${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: Deno.env.get('PLAID_CLIENT_ID'),
      secret: Deno.env.get('PLAID_SECRET'),
      ...body
    }),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_message || data.error_code || 'Plaid API error');
  }
  
  return data;
}
