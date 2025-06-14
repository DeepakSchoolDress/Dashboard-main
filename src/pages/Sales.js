import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Minus, ShoppingCart, Trash2, Search, DollarSign, Percent, Printer, Save, X } from 'lucide-react'
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
  const [commissionRates, setCommissionRates] = useState({})
  
  // Length-based product modal
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [customQuantity, setCustomQuantity] = useState('')

  const cartTotal = cart.reduce((total, item) => 
    total + (item.product.selling_price * item.quantity), 0
  )

  // Calculate total commission for the cart
  const cartCommission = cart.reduce((total, item) => {
    const commissionAmount = commissionRates[item.product.id] || 0
    return total + (commissionAmount * item.quantity)
  }, 0)

  // Keep cartCost calculation for backend use but don't display it
  const cartCost = cart.reduce((total, item) => 
    total + (item.product.cost_price * item.quantity), 0
  )

  useEffect(() => {
    dispatch(fetchProducts())
    dispatch(fetchSchools())
  }, [dispatch])

  // Fetch commission rates when school is selected
  useEffect(() => {
    const fetchCommissionRates = async () => {
      if (selectedSchool) {
        const { data } = await supabase
          .from('commissions')
          .select('product_id, commission_amount')
          .eq('school_id', selectedSchool.id)

        if (data) {
          const rates = data.reduce((acc, curr) => {
            acc[curr.product_id] = curr.commission_amount || 0
            return acc
          }, {})
          setCommissionRates(rates)
        }
      } else {
        setCommissionRates({})
      }
    }

    fetchCommissionRates()
  }, [selectedSchool])

  // Update amount paid whenever cart total changes
  useEffect(() => {
    setAmountPaid(cartTotal.toString())
  }, [cartTotal])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const discount = cartTotal - parseFloat(amountPaid || 0)
  const profit = parseFloat(amountPaid || 0) - cartCost - cartCommission

  const handleAddToCart = (product, quantity = 1) => {
    // Check if it's a length-based product
    if (product.optional_fields?.is_length_based) {
      setSelectedProduct(product)
      setCustomQuantity('')
      setShowQuantityModal(true)
      return
    }
    
    if (product.stock_quantity < quantity) {
      toast('Low stock: Only ' + product.stock_quantity + ' items available', {
        icon: '⚠️',
        style: {
          background: '#fff7ed',
          color: '#9a3412',
          border: '1px solid #fdba74'
        }
      })
    }
    dispatch(addToCart({ product, quantity }))
    toast.success(`${product.name} added to cart`)
  }

  const handleLengthBasedAddToCart = () => {
    if (!selectedProduct || !customQuantity) {
      toast.error('Please enter a valid quantity')
      return
    }

    const quantity = parseFloat(customQuantity)
    const minQuantity = parseFloat(selectedProduct.optional_fields?.min_quantity || 0.1)
    
    if (quantity < minQuantity) {
      toast.error(`Minimum quantity is ${minQuantity} ${selectedProduct.optional_fields?.unit_name || 'units'}`)
      return
    }

    dispatch(addToCart({ product: selectedProduct, quantity }))
    toast.success(`${quantity} ${selectedProduct.optional_fields?.unit_name || 'units'} of ${selectedProduct.name} added to cart`)
    
    setShowQuantityModal(false)
    setSelectedProduct(null)
    setCustomQuantity('')
  }

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      dispatch(removeFromCart(productId))
      return
    }
    
    const product = products.find(p => p.id === productId)
    if (product && product.stock_quantity < newQuantity) {
      toast('Low stock: Only ' + product.stock_quantity + ' items available', {
        icon: '⚠️',
        style: {
          background: '#fff7ed',
          color: '#9a3412',
          border: '1px solid #fdba74'
        }
      })
    }
    
    dispatch(updateCartQuantity({ productId, quantity: newQuantity }))
  }

  const handleCreateSale = async (shouldPrint = false) => {
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

      // Prepare sale data for printing
      const saleForPrint = {
        ...sale,
        schools: selectedSchool,
        sale_items: []
      }

      // Create sale items and update stock
      for (const item of cart) {
        // Check if this item should be commissioned
        let is_commissioned = false
        let commission_amount = 0
        if (selectedSchool) {
          const { data: commission } = await supabase
            .from('commissions')
            .select('commission_amount')
            .eq('school_id', selectedSchool.id)
            .eq('product_id', item.product.id)
            .single()
          
          is_commissioned = !!commission
          commission_amount = commission?.commission_amount || 0
        }

        // Create sale item
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.selling_price,
            is_commissioned,
            commission_amount
          })

        if (itemError) throw itemError

        // Add to print data
        saleForPrint.sale_items.push({
          quantity: item.quantity,
          unit_price: item.product.selling_price,
          is_commissioned,
          commission_amount,
          products: {
            name: item.product.name
          }
        })

        // Update product stock (allow negative)
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.product.stock_quantity - item.quantity 
          })
          .eq('id', item.product.id)

        if (stockError) throw stockError
      }

      toast.success('Sale created successfully!')
      
      // Print if requested
      if (shouldPrint) {
        printBill(saleForPrint)
      }
      
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

  const printBill = (sale) => {
    const totalAmount = parseFloat(sale.total_amount)
    const amountPaid = parseFloat(sale.amount_paid || sale.total_amount)
    const discount = totalAmount - amountPaid
    
    // Calculate total items
    const totalItems = sale.sale_items?.reduce((total, item) => total + item.quantity, 0) || 0
    
    // Format date safely
    const saleDate = new Date(sale.created_at)
    const formattedDate = saleDate.toLocaleDateString('en-GB')
    const formattedTime = saleDate.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    })
    
    // Build plain text receipt
    let receipt = ''
    receipt += '        DEEPAK SCHOOL DRESS\n'
    receipt += '       CHOWK BAZAAR KAIRANA\n'
    receipt += '================================\n'
    receipt += `Bill No: ${sale.bill_number || 'N/A'}\n`
    receipt += `Date: ${formattedDate} ${formattedTime}\n`
    receipt += `Customer: ${sale.customer_name}\n`
    
    if (sale.schools) {
      receipt += `School: ${sale.schools.name}\n`
    }
    
    receipt += '================================\n'
    
    // Add items
    if (sale.sale_items && sale.sale_items.length > 0) {
      sale.sale_items.forEach(item => {
        const itemName = item.products.name || 'Unknown Item'
        const quantity = item.quantity || 0
        const unitPrice = parseFloat(item.unit_price) || 0
        const itemTotal = quantity * unitPrice
        
        receipt += `${itemName}\n`
        receipt += `${quantity} x Rs.${unitPrice.toFixed(2)}`.padEnd(20) + `Rs.${itemTotal.toFixed(2)}\n`
      })
    }
    
    receipt += '================================\n'
    receipt += `Total Items: ${totalItems}\n`
    receipt += `Subtotal: Rs.${totalAmount.toFixed(2)}\n`
    
    if (discount > 0) {
      receipt += `Discount: -Rs.${discount.toFixed(2)}\n`
    }
    
    receipt += `TOTAL: Rs.${amountPaid.toFixed(2)}\n`
    receipt += '================================\n'
    receipt += '     Thank you for your business!\n'
    receipt += '        Please visit again\n'
    
    // Create print window with darker styling
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 14.5px;
            font-weight: bold;
            line-height: 1.3;
            margin: 10px;
            white-space: pre-wrap;
            background: white;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .receipt-content {
            filter: contrast(250%) brightness(0.7);
            font-weight: 900;
          }
          
          @media print {
            body { 
              margin: 0; 
              font-size: 12.5px;
              font-weight: 900;
              color: #000000 !important;
            }
            
            .receipt-content {
              filter: contrast(400%) brightness(0.4);
              -webkit-filter: contrast(400%) brightness(0.4);
            }
            
            * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-content">${receipt}</div>
      </body>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          }, 1000);
        };
      </script>
      </html>
    `)
    
    printWindow.document.close()
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

          {/* Products List - Replacing Grid */}
          <div className="card">
            <div className="card-body p-0">
              <div className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0 mr-4">
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <div className="flex items-center mt-1">
                        {product.optional_fields?.is_length_based ? (
                          <p className="text-sm text-blue-600">
                            Length-based • Min: {product.optional_fields?.min_quantity || 0.1} {product.optional_fields?.unit_name || 'unit'}
                          </p>
                        ) : (
                          <p className={`text-sm ${product.stock_quantity < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            Stock: {product.stock_quantity}
                            {product.stock_quantity < 0 && ' (Warning: Negative Stock)'}
                          </p>
                        )}
                        {product.optional_fields && (
                          <div className="flex flex-wrap gap-1 ml-3">
                            {Object.entries(product.optional_fields)
                              .filter(([key]) => !['is_length_based', 'rate_per_unit', 'unit_name', 'min_quantity'].includes(key))
                              .map(([key, value]) => (
                                <span key={key} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                  {key}: {value}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-green-600 min-w-[80px] text-right">
                        ₹{product.selling_price}{product.optional_fields?.is_length_based ? `/${product.optional_fields?.unit_name || 'unit'}` : ''}
                      </span>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="btn btn-sm btn-primary whitespace-nowrap"
                      >
                        {product.optional_fields?.is_length_based ? 'Select Qty' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    No products found
                  </div>
                )}
              </div>
            </div>
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
                  School *
                </label>
                <select
                  className="input"
                  required
                  value={selectedSchool ? selectedSchool.id : selectedSchool === null ? 'direct' : ''}
                  onChange={(e) => {
                    const school = e.target.value === 'direct' ? null : schools.find(s => s.id === e.target.value)
                    dispatch(setSelectedSchool(school))
                  }}
                >
                  <option value="">Select School</option>
                  <option value="direct">Direct Sale</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
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
                  {cart.map((item) => {
                    const isLengthBased = item.product.optional_fields?.is_length_based
                    const unitName = item.product.optional_fields?.unit_name || 'unit'
                    const minQuantity = parseFloat(item.product.optional_fields?.min_quantity || 0.1)
                    
                    return (
                      <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-sm text-gray-500">
                            ₹{item.product.selling_price} {isLengthBased ? `per ${unitName}` : 'each'}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, isLengthBased ? Math.max(minQuantity, item.quantity - minQuantity) : item.quantity - 1)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          
                          <span className="w-12 text-center font-medium">
                            {isLengthBased ? item.quantity.toFixed(2) : item.quantity}
                            {isLengthBased && <span className="text-xs text-gray-500 block">{unitName}</span>}
                          </span>
                          
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, isLengthBased ? item.quantity + minQuantity : item.quantity + 1)}
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
                    )
                  })}
                  
                  {/* Financial Summary */}
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleCreateSale(true)}
                        disabled={loading || !amountPaid || parseFloat(amountPaid) <= 0}
                        className="w-full btn btn-primary flex items-center justify-center"
                      >
                        {loading ? (
                          'Processing...'
                        ) : (
                          <>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleCreateSale(false)}
                        disabled={loading || !amountPaid || parseFloat(amountPaid) <= 0}
                        className="w-full btn btn-secondary flex items-center justify-center"
                      >
                        {loading ? (
                          'Processing...'
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Modal for Length-Based Products */}
      {showQuantityModal && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowQuantityModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Select Quantity</h3>
                  <button
                    onClick={() => setShowQuantityModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-medium text-blue-900">{selectedProduct.name}</p>
                    <p className="text-sm text-blue-700">
                      Rate: ₹{selectedProduct.selling_price} per {selectedProduct.optional_fields?.unit_name || 'unit'}
                    </p>
                    <p className="text-xs text-blue-600">
                      Minimum quantity: {selectedProduct.optional_fields?.min_quantity || 0.1} {selectedProduct.optional_fields?.unit_name || 'units'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity ({selectedProduct.optional_fields?.unit_name || 'units'}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedProduct.optional_fields?.min_quantity || 0.1}
                      className="input"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder={`Enter quantity (min: ${selectedProduct.optional_fields?.min_quantity || 0.1})`}
                      autoFocus
                    />
                  </div>
                  
                  {customQuantity && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Total: </span>
                        {customQuantity} {selectedProduct.optional_fields?.unit_name || 'units'} × ₹{selectedProduct.selling_price} = 
                        <span className="font-semibold text-green-600 ml-1">
                          ₹{(parseFloat(customQuantity || 0) * selectedProduct.selling_price).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleLengthBasedAddToCart}
                  disabled={!customQuantity || parseFloat(customQuantity) < parseFloat(selectedProduct.optional_fields?.min_quantity || 0.1)}
                  className="w-full inline-flex justify-center btn btn-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => setShowQuantityModal(false)}
                  className="mt-3 w-full inline-flex justify-center btn btn-secondary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sales 