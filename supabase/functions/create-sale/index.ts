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

    const { customer_name = 'Cash', school_id, items } = await req.json()

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Items array is required and must not be empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Start transaction by creating the sale first
    let total_amount = 0
    const sale_items_data = []

    // Process each item and calculate totals
    for (const item of items) {
      const { product_id, quantity } = item

      // Get product details
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('*, commissions!inner(commission_rate)')
        .eq('id', product_id)
        .single()

      if (productError || !product) {
        return new Response(
          JSON.stringify({ error: `Product ${product_id} not found` }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check stock availability
      if (product.stock_quantity < quantity) {
        return new Response(
          JSON.stringify({ 
            error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${quantity}` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Calculate item total
      const item_total = product.selling_price * quantity
      total_amount += item_total

      // Check if this item has commission for the selected school
      let is_commissioned = false
      if (school_id && product.commissions && product.commissions.length > 0) {
        const commission = product.commissions.find(c => c.school_id === school_id)
        is_commissioned = !!commission
      }

      sale_items_data.push({
        product_id,
        quantity,
        unit_price: product.selling_price,
        is_commissioned
      })

      // Update stock quantity
      const { error: updateError } = await supabaseClient
        .from('products')
        .update({ stock_quantity: product.stock_quantity - quantity })
        .eq('id', product_id)

      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Failed to update stock for ${product.name}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Create the sale record
    const { data: sale, error: saleError } = await supabaseClient
      .from('sales')
      .insert({
        customer_name,
        school_id,
        total_amount
      })
      .select()
      .single()

    if (saleError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create sale' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create sale items
    const sale_items_with_sale_id = sale_items_data.map(item => ({
      ...item,
      sale_id: sale.id
    }))

    const { error: itemsError } = await supabaseClient
      .from('sale_items')
      .insert(sale_items_with_sale_id)

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create sale items' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sale,
        message: 'Sale created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error creating sale:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 