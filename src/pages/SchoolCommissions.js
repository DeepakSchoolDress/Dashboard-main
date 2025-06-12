import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, ArrowLeft } from 'lucide-react'

const SchoolCommissions = () => {
  const { schoolId } = useParams()
  const [school, setSchool] = useState(null)
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: '2020-01-01', // Set a very early start date to include all sales
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (schoolId) {
      fetchSchoolData()
      fetchCommissions()
    }
  }, [schoolId, dateRange])

  const fetchSchoolData = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()
      
      if (error) throw error
      
      setSchool(data)
    } catch (error) {
      console.error('Error fetching school:', error)
    }
  }

  const fetchCommissions = async () => {
    setLoading(true)
    try {
      // First get commission rates for this school
      const { data: commissionData, error: commissionError } = await supabase
        .from('commissions')
        .select('product_id, commission_amount')
        .eq('school_id', schoolId)

      if (commissionError) throw commissionError

      // Create a map of product_id to commission_amount for easier lookup
      const commissionMap = commissionData.reduce((acc, curr) => {
        acc[curr.product_id] = curr.commission_amount || 0
        return acc
      }, {})

      // Then get sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          bill_cancellations (id),
          sale_items!inner (
            id,
            quantity,
            unit_price,
            is_commissioned,
            product_id,
            products (
              id,
              name
            )
          )
        `)
        .eq('school_id', schoolId)
        .eq('sale_items.is_commissioned', true)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })

      if (salesError) throw salesError

      // Group by product and calculate totals
      const productCommissions = {}
      
      salesData.forEach(sale => {
        // Skip if sale is cancelled
        if (sale.bill_cancellations?.length) return
        
        sale.sale_items.forEach(item => {
          const productId = item.product_id
          const commissionRate = commissionMap[productId] || 0
          
          if (!productCommissions[productId]) {
            productCommissions[productId] = {
              product: item.products,
              total_quantity: 0,
              total_sales_amount: 0,
              commission_rate: commissionRate,
              total_commission: 0,
              sales_count: 0
            }
          }
          
          productCommissions[productId].total_quantity += item.quantity
          productCommissions[productId].total_sales_amount += (item.quantity * item.unit_price)
          productCommissions[productId].total_commission += (item.quantity * commissionRate)
          productCommissions[productId].sales_count += 1
        })
      })

      // Convert to array and sort by commission earned (highest first)
      const validCommissions = Object.values(productCommissions)
        .sort((a, b) => b.total_commission - a.total_commission)

      setCommissions(validCommissions)
    } catch (error) {
      console.error('Error fetching commissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalCommission = commissions.reduce((sum, item) => sum + item.total_commission, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-4 mb-2">
          <Link 
            to="/school-commissions" 
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Schools
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">School Commissions</h1>
        <p className="text-gray-600">
          {school ? `Commission details for ${school.name}` : 'Loading school details...'}
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-gray-900">Date Range Filter</h4>
            <button
              onClick={() => setDateRange({
                start: '2020-01-01',
                end: new Date().toISOString().split('T')[0]
              })}
              className="btn btn-secondary btn-sm"
            >
              Show All Time
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="input"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                className="input"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Currently showing: {dateRange.start} to {dateRange.end}
          </p>
        </div>
      </div>

      {/* Commission Summary */}
      <div className="card bg-blue-50">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Commission Summary</h3>
          <p className="text-2xl font-bold text-blue-600">₹{totalCommission.toFixed(2)}</p>
          <p className="text-sm text-blue-700">
            Total commission earned for the selected period
          </p>
        </div>
      </div>

      {/* Commissions Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading commission data...</p>
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No commissions found for the selected period</p>
              <p className="text-xs text-gray-400 mt-2">
                Check the browser console for debug information
              </p>
              <p className="text-xs text-gray-400">
                Date range: {dateRange.start} to {dateRange.end}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total Quantity</th>
                    <th>Total Sales Amount</th>
                    <th>Commission Rate</th>
                    <th>Total Commission</th>
                    <th>Sales Count</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((item) => (
                    <tr key={item.product.id}>
                      <td>{item.product.name}</td>
                      <td>{item.total_quantity}</td>
                      <td>₹{item.total_sales_amount.toFixed(2)}</td>
                      <td>₹{item.commission_rate}</td>
                      <td className="font-semibold text-green-600">
                        ₹{item.total_commission.toFixed(2)}
                      </td>
                      <td>{item.sales_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SchoolCommissions 