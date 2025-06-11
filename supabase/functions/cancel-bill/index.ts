import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { sale_id, reason } = await req.json()

    // Validate input
    if (!sale_id) {
      return new Response(
        JSON.stringify({ error: 'Sale ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if sale exists and hasn't been cancelled already
    const { data: existingCancellation } = await supabaseClient
      .from('bill_cancellations')
      .select('id')
      .eq('sale_id', sale_id)
      .single()

    if (existingCancellation) {
      return new Response(
        JSON.stringify({ error: 'This sale has already been cancelled' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get sale details with items
    const { data: sale, error: saleError } = await supabaseClient
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          product_id,
          quantity,
          unit_price,
          is_commissioned,
          products (
            id,
            name,
            stock_quantity
          )
        )
      `)
      .eq('id', sale_id)
      .single()

    if (saleError || !sale) {
      return new Response(
        JSON.stringify({ error: 'Sale not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Restore stock for each item
    for (const item of sale.sale_items) {
      const { error: updateError } = await supabaseClient
        .from('products')
        .update({ 
          stock_quantity: item.products.stock_quantity + item.quantity 
        })
        .eq('id', item.product_id)

      if (updateError) {
        console.error(`Failed to restore stock for product ${item.product_id}:`, updateError)
        return new Response(
          JSON.stringify({ 
            error: `Failed to restore stock for ${item.products.name}` 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Create cancellation record
    const { error: cancellationError } = await supabaseClient
      .from('bill_cancellations')
      .insert({
        sale_id,
        reason: reason || 'No reason provided'
      })

    if (cancellationError) {
      console.error('Failed to create cancellation record:', cancellationError)
      return new Response(
        JSON.stringify({ error: 'Failed to create cancellation record' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Note: We're keeping the sale and sale_items records for audit purposes
    // They are linked to the cancellation record via bill_cancellations table

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bill cancelled successfully and stock restored',
        cancelled_sale: sale
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error cancelling bill:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 