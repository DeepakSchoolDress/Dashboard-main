import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Minus, ShoppingCart, Trash2, Search, DollarSign, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchProducts } from '../store/slices/productsSlice'
import { fetchSchools } from '../store/slices/schoolsSlice'
import { 
  addToCart, 
  removeFromCart, 
  updateCartQuantity, 
  clearCart, 
  setSelectedSchool, 
  setCustomerName 
} from '../store/slices/salesSlice'
import { supabase } from '../lib/supabase'

const Sales = () => {
  const dispatch = useDispatch()
  const { items: products } = useSelector(state => state.products)
  const { items: schools } = useSelector(state => state.schools)
  const { cart, selectedSchool, customerName } = useSelector(state => state.sales)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')

  const cartTotal = cart.reduce((total, item) => 
    total + (item.product.selling_price * item.quantity), 0
  )

  // Keep cartCost calculation for backend use but don't display it
  const cartCost = cart.reduce((total, item) => 
    total + (item.product.cost_price * item.quantity), 0
  )

  useEffect(() => {
    dispatch(fetchProducts())
    dispatch(fetchSchools())
  }, [dispatch])

  // Update amount paid when cart total changes
  useEffect(() => {
    if (amountPaid === '' || parseFloat(amountPaid) === cartTotal) {
      setAmountPaid(cartTotal.toString())
    }
  }, [cartTotal, amountPaid])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const discount = cartTotal - parseFloat(amountPaid || 0)
  // eslint-disable-next-line no-unused-vars
  const profit = parseFloat(amountPaid || 0) - cartCost

  const handleAddToCart = (product, quantity = 1) => {
    if (product.stock_quantity < quantity) {
      toast.error('Insufficient stock available')
      return
    }
    dispatch(addToCart({ product, quantity }))
    toast.success(`${product.name} added to cart`)
  }

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      dispatch(removeFromCart(productId))
      return
    }
    
    const product = products.find(p => p.id === productId)
    if (product && newQuantity > product.stock_quantity) {
      toast.error('Insufficient stock available')
      return
    }
    
    dispatch(updateCartQuantity({ productId, quantity: newQuantity }))
  }

  const handleCreateSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const finalAmountPaid = parseFloat(amountPaid || 0)
    if (finalAmountPaid <= 0) {
      toast.error('Amount paid must be greater than 0')
      return
    }

    if (finalAmountPaid > cartTotal) {
      toast.error('Amount paid cannot be greater than total amount')
      return
    }

    setLoading(true)
    try {
      // Check stock availability for all items
      for (const item of cart) {
        const { data: currentProduct } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product.id)
          .single()

        if (currentProduct.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product.name}`)
        }
      }

      // Create the sale record with amount_paid
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_name: customerName,
          school_id: selectedSchool?.id || null,
          total_amount: cartTotal,
          amount_paid: finalAmountPaid
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Create sale items and update stock
      for (const item of cart) {
        // Check if this item should be commissioned
        let is_commissioned = false
        if (selectedSchool) {
          const { data: commission } = await supabase
            .from('commissions')
            .select('id')
            .eq('school_id', selectedSchool.id)
            .eq('product_id', item.product.id)
            .single()
          
          is_commissioned = !!commission
        }

        // Create sale item
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.selling_price,
            is_commissioned
          })

        if (itemError) throw itemError

        // Update product stock
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.product.stock_quantity - item.quantity 
          })
          .eq('id', item.product.id)

        if (stockError) throw stockError
      }

      toast.success('Sale created successfully!')
      dispatch(clearCart())
      dispatch(setCustomerName('Cash'))
      dispatch(setSelectedSchool(null))
      setAmountPaid('')
      
      // Refresh products to get updated stock
      dispatch(fetchProducts())
      
    } catch (error) {
      console.error('Error creating sale:', error)
      toast.error(error.message || 'Failed to create sale')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        <p className="text-gray-600">Create new sales and manage your cart</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <div className="card">
            <div className="card-body">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const productProfit = product.selling_price - product.cost_price
              const profitMargin = ((productProfit / product.selling_price) * 100).toFixed(1)
              
              return (
                <div key={product.id} className="card">
                  <div className="card-body">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">Stock: {product.stock_quantity}</p>
                        <p className="text-xs text-green-600">
                          Profit: ${productProfit.toFixed(2)} ({profitMargin}%)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          ₹{product.selling_price}
                        </span>
                        <p className="text-xs text-gray-500">
                          Cost: ₹{product.cost_price}
                        </p>
                      </div>
                    </div>
                    
                    {product.optional_fields && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(product.optional_fields).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock_quantity === 0}
                      className={`w-full btn ${
                        product.stock_quantity === 0 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'btn-primary'
                      }`}
                    >
                      {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cart Section */}
        <div className="space-y-6">
          {/* Sale Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Sale Details</h3>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={customerName}
                  onChange={(e) => dispatch(setCustomerName(e.target.value))}
                  placeholder="Enter customer name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School (Optional - Select for Commission)
                </label>
                <select
                  className="input"
                  value={selectedSchool?.id || ''}
                  onChange={(e) => {
                    const school = schools.find(s => s.id === e.target.value)
                    dispatch(setSelectedSchool(school || null))
                  }}
                >
                  <option value="">None (Direct Sale)</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                {selectedSchool && (
                  <p className="text-xs text-green-600 mt-1">
                    Commission will be calculated for {selectedSchool.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Cart</h3>
                <ShoppingCart className="w-5 h-5 text-gray-500" />
              </div>
            </div>
            <div className="card-body">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product.name}</p>
                        <p className="text-sm text-gray-500">
                          ₹{item.product.selling_price} each
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => dispatch(removeFromCart(item.product.id))}
                          className="p-1 text-red-500 hover:text-red-700 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Financial Summary - Remove cost display */}
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Subtotal:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₹{cartTotal.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Amount Paid Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount Paid
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={cartTotal}
                          className="input pl-9"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    {/* Discount Display */}
                    {discount > 0 && (
                      <div className="flex justify-between items-center text-orange-600">
                        <span className="text-sm font-medium flex items-center">
                          <Percent className="w-4 h-4 mr-1" />
                          Discount:
                        </span>
                        <span className="text-sm font-semibold">
                          ₹{discount.toFixed(2)} ({((discount / cartTotal) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span className="text-gray-900">Final Total:</span>
                      <span className="text-green-600">
                        ₹{parseFloat(amountPaid || 0).toFixed(2)}
                      </span>
                    </div>
                    
                    <button
                      onClick={handleCreateSale}
                      disabled={loading || !amountPaid || parseFloat(amountPaid) <= 0}
                      className="w-full btn btn-success"
                    >
                      {loading ? 'Processing...' : 'Complete Sale'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sales 