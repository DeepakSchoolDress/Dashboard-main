import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Search, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchSales } from '../store/slices/salesSlice'
import { supabase } from '../lib/supabase'

const SalesHistory = () => {
  const dispatch = useDispatch()
  const { items: sales, loading } = useSelector(state => state.sales)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSale, setSelectedSale] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    dispatch(fetchSales())
  }, [dispatch])

  const filteredSales = sales.filter(sale =>
    sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.schools && sale.schools.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleCancelBill = async () => {
    if (!selectedSale || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation')
      return
    }

    setCancelling(true)
    try {
      // Check if sale exists and hasn't been cancelled already
      const { data: existingCancellation } = await supabase
        .from('bill_cancellations')
        .select('id')
        .eq('sale_id', selectedSale.id)
        .single()

      if (existingCancellation) {
        throw new Error('This sale has already been cancelled')
      }

      // Get sale details with items
      const { data: saleData, error: saleError } = await supabase
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
        .eq('id', selectedSale.id)
        .single()

      if (saleError) throw saleError

      // Restore stock for each item
      for (const item of saleData.sale_items) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.products.stock_quantity + item.quantity 
          })
          .eq('id', item.product_id)

        if (updateError) {
          throw new Error(`Failed to restore stock for ${item.products.name}`)
        }
      }

      // Create cancellation record
      const { error: cancellationError } = await supabase
        .from('bill_cancellations')
        .insert({
          sale_id: selectedSale.id,
          reason: cancelReason
        })

      if (cancellationError) throw cancellationError

      toast.success('Bill cancelled successfully! Stock restored and earnings/commissions adjusted.')
      setShowCancelModal(false)
      setCancelReason('')
      setSelectedSale(null)
      
      // Refresh sales data to update the UI
      dispatch(fetchSales())
      
      // Note: Dashboard and Schools components will automatically reflect the changes
      // when their data is next fetched, as they now exclude cancelled sales
      
    } catch (error) {
      console.error('Error cancelling bill:', error)
      toast.error(error.message || 'Failed to cancel bill')
    } finally {
      setCancelling(false)
    }
  }

  const openDetailsModal = (sale) => {
    setSelectedSale(sale)
    setShowDetailsModal(true)
  }

  const openCancelModal = (sale) => {
    setSelectedSale(sale)
    setShowCancelModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
        <p className="text-gray-600">View and manage all sales transactions</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer name or school..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading sales...</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No sales found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>School</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Discount</th>
                    <th>Profit</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const totalAmount = parseFloat(sale.total_amount)
                    const amountPaid = parseFloat(sale.amount_paid || sale.total_amount)
                    const discount = totalAmount - amountPaid
                    
                    // Calculate profit from sale items
                    let profit = 0
                    if (sale.sale_items) {
                      profit = sale.sale_items.reduce((total, item) => {
                        const itemRevenue = item.quantity * amountPaid * (item.unit_price / totalAmount)
                        const itemCost = item.quantity * (item.products?.cost_price || 0)
                        return total + (itemRevenue - itemCost)
                      }, 0)
                    }
                    
                    return (
                      <tr key={sale.id}>
                        <td className="font-medium">{sale.customer_name}</td>
                        <td>{sale.schools ? sale.schools.name : 'Direct Sale'}</td>
                        <td className="font-semibold">₹{totalAmount.toFixed(2)}</td>
                        <td className="font-semibold text-green-600">₹{amountPaid.toFixed(2)}</td>
                        <td className={`font-semibold ${discount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          {discount > 0 ? `₹${discount.toFixed(2)}` : '-'}
                        </td>
                        <td className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{profit.toFixed(2)}
                        </td>
                        <td>{new Date(sale.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            sale.bill_cancellations?.length 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {sale.bill_cancellations?.length ? 'Cancelled' : 'Completed'}
                          </span>
                        </td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openDetailsModal(sale)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {!sale.bill_cancellations?.length && (
                              <button
                                onClick={() => openCancelModal(sale)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="Cancel Bill"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDetailsModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Sale Details</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Customer</p>
                      <p className="text-gray-900">{selectedSale.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">School</p>
                      <p className="text-gray-900">{selectedSale.schools ? selectedSale.schools.name : 'Direct Sale'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Amount</p>
                      <p className="text-gray-900 font-semibold">₹{parseFloat(selectedSale.total_amount).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Amount Paid</p>
                      <p className="text-green-600 font-semibold">₹{parseFloat(selectedSale.amount_paid || selectedSale.total_amount).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Discount Given</p>
                      <p className="text-orange-600 font-semibold">
                        ₹{(parseFloat(selectedSale.total_amount) - parseFloat(selectedSale.amount_paid || selectedSale.total_amount)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Date</p>
                      <p className="text-gray-900">{new Date(selectedSale.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Profit Summary */}
                  {selectedSale.sale_items && selectedSale.sale_items.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">Profit Analysis</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-blue-600">Total Cost:</p>
                          <p className="font-semibold">
                            ₹{selectedSale.sale_items.reduce((total, item) => 
                              total + (item.quantity * (item.products?.cost_price || 0)), 0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-600">Revenue:</p>
                          <p className="font-semibold">
                            ₹{parseFloat(selectedSale.amount_paid || selectedSale.total_amount).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-600">Profit:</p>
                          <p className={`font-semibold ${
                            (parseFloat(selectedSale.amount_paid || selectedSale.total_amount) - 
                             selectedSale.sale_items.reduce((total, item) => 
                               total + (item.quantity * (item.products?.cost_price || 0)), 0
                             )) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ₹{(parseFloat(selectedSale.amount_paid || selectedSale.total_amount) - 
                              selectedSale.sale_items.reduce((total, item) => 
                                total + (item.quantity * (item.products?.cost_price || 0)), 0
                              )).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSale.sale_items && selectedSale.sale_items.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Items</p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full table-auto">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSale.sale_items.map((item) => (
                              <tr key={item.id} className="border-b border-gray-200">
                                <td className="px-3 py-2 text-sm">{item.products.name}</td>
                                <td className="px-3 py-2 text-sm">{item.quantity}</td>
                                <td className="px-3 py-2 text-sm">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm">₹{(item.products?.cost_price || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm">₹{(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    item.is_commissioned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {item.is_commissioned ? 'Yes' : 'No'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedSale.bill_cancellations?.length > 0 && (
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-1">Cancelled</p>
                      <p className="text-sm text-red-700">
                        Reason: {selectedSale.bill_cancellations[0].reason}
                      </p>
                      <p className="text-xs text-red-600">
                        Cancelled on: {new Date(selectedSale.bill_cancellations[0].cancelled_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCancelModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Bill</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      Are you sure you want to cancel this bill for <strong>{selectedSale.customer_name}</strong>?
                    </p>
                    <p className="text-sm text-gray-600">
                      Amount: <strong>₹{parseFloat(selectedSale.total_amount).toFixed(2)}</strong>
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for cancellation *
                    </label>
                    <textarea
                      required
                      className="input"
                      rows="3"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Enter the reason for cancelling this bill..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleCancelBill}
                  disabled={cancelling || !cancelReason.trim()}
                  className="w-full inline-flex justify-center btn btn-danger sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Bill'}
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="mt-3 w-full inline-flex justify-center btn btn-secondary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Keep Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesHistory 