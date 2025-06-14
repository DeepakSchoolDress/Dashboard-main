import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ShoppingCart, Package, School, DollarSign, TrendingUp, Percent, Calendar } from 'lucide-react'
import { fetchProducts } from '../store/slices/productsSlice'
import { fetchSchools } from '../store/slices/schoolsSlice'
import { fetchSales } from '../store/slices/salesSlice'
import { supabase } from '../lib/supabase'

const Dashboard = () => {
  const dispatch = useDispatch()
  const { items: products } = useSelector(state => state.products)
  const { items: schools } = useSelector(state => state.schools)
  const { items: sales } = useSelector(state => state.sales)
  
  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalCommissions: 0,
    totalDiscounts: 0,
    commissionsThisMonth: 0,
    activeCommissionPartners: 0,
    topSchools: []
  })
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0], // Today
    end: new Date().toISOString().split('T')[0]     // Today
  })
  const [filteredSales, setFilteredSales] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
          dispatch(fetchProducts()),
          dispatch(fetchSchools()),
          dispatch(fetchSales())
        ])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dispatch])

  // Filter sales based on date range
  useEffect(() => {
    if (sales.length > 0) {
      const filtered = sales.filter(sale => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0]
        return saleDate >= dateRange.start && saleDate <= dateRange.end
      })
      setFilteredSales(filtered)
      calculateFinancialStats(filtered)
    }
  }, [sales, dateRange])

  const calculateFinancialStats = async (salesData) => {
    try {
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()
      
      let totalRevenue = 0
      let totalProfit = 0
      let totalCommissions = 0
      let totalDiscounts = 0
      let commissionsThisMonth = 0
      const schoolCommissions = {}
      const activeSchools = new Set()

      salesData.forEach(sale => {
        // Skip cancelled sales
        if (sale.bill_cancellations?.length) return

        const amountPaid = parseFloat(sale.amount_paid || 0)
        const totalAmount = parseFloat(sale.total_amount || 0)
        
        totalRevenue += amountPaid
        totalDiscounts += totalAmount - amountPaid

        sale.sale_items?.forEach(item => {
          if (!item.products) return // Skip if no product data

          const itemRevenue = item.quantity * amountPaid * (item.unit_price / totalAmount)
          const itemCost = item.quantity * item.products.cost_price
          
          // Calculate commission if applicable - use commission_amount from sale_items
          let itemCommission = 0
          if (item.is_commissioned && sale.school_id && item.commission_amount) {
            itemCommission = item.commission_amount * item.quantity
            
            totalCommissions += itemCommission
            
            // Check if commission is from current month
            const saleDate = new Date(sale.created_at)
            if (saleDate.getMonth() === currentMonth && 
                saleDate.getFullYear() === currentYear) {
              commissionsThisMonth += itemCommission
            }

            // Track school commissions
            if (sale.schools) {
              activeSchools.add(sale.school_id)
              if (!schoolCommissions[sale.school_id]) {
                schoolCommissions[sale.school_id] = {
                  school_name: sale.schools.name,
                  total_commission: 0
                }
              }
              schoolCommissions[sale.school_id].total_commission += itemCommission
            }
          }
          
          // Calculate profit (Revenue - Cost - Commission)
          totalProfit += itemRevenue - itemCost - itemCommission
        })
      })

      // Sort schools by commission amount
      const topSchools = Object.values(schoolCommissions)
        .sort((a, b) => b.total_commission - a.total_commission)
        .slice(0, 5)

      setFinancialStats({
        totalRevenue,
        totalProfit,
        totalCommissions,
        totalDiscounts,
        commissionsThisMonth,
        activeCommissionPartners: activeSchools.size,
        topSchools
      })
    } catch (error) {
      console.error('Error calculating financial stats:', error)
    }
  }

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const setTodayRange = () => {
    const today = new Date().toISOString().split('T')[0]
    setDateRange({ start: today, end: today })
  }

  const setWeekRange = () => {
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    setDateRange({
      start: weekAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    })
  }

  const setMonthRange = () => {
    const today = new Date()
    const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1)
    setDateRange({
      start: monthAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard data...</div>
      </div>
    )
  }

  const stats = [
    {
      title: 'Total Revenue',
      value: `₹${financialStats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Expenditure',
      value: `₹${financialStats.totalProfit.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Total Commissions',
      value: `₹${financialStats.totalCommissions.toFixed(2)}`,
      icon: Percent,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Partner Schools',
      value: schools.length.toString(),
      icon: School,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      title: 'Active Orders',
      value: filteredSales.filter(sale => !sale.bill_cancellations || sale.bill_cancellations.length === 0).length.toString(),
      icon: ShoppingCart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Products',
      value: products.length.toString(),
      icon: Package,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your inventory and sales</p>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="input"
              />
              <span className="text-gray-500 self-center">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={setTodayRange} className="btn btn-sm btn-secondary">Today</button>
              <button onClick={setWeekRange} className="btn btn-sm btn-secondary">Week</button>
              <button onClick={setMonthRange} className="btn btn-sm btn-secondary">Month</button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.bgColor} mr-4`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Earning Schools */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Top Earning Schools
            </h3>
          </div>
          <div className="card-body">
            {financialStats.topSchools.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No commission data available</p>
            ) : (
              <div className="space-y-3">
                {financialStats.topSchools.map((school, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">{school.school_name}</p>
                        <p className="text-sm text-gray-500">Commission earnings</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-600">
                      ₹{school.total_commission.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
              Recent Sales
            </h3>
          </div>
          <div className="card-body">
            {filteredSales.filter(sale => !sale.bill_cancellations || sale.bill_cancellations.length === 0).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent sales</p>
            ) : (
              <div className="space-y-3">
                {filteredSales
                  .filter(sale => !sale.bill_cancellations || sale.bill_cancellations.length === 0)
                  .slice(0, 5)
                  .map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{sale.customer_name}</p>
                        <p className="text-sm text-gray-500">
                          {sale.schools ? sale.schools.name : 'Direct Sale'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ₹{parseFloat(sale.amount_paid || sale.total_amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Financial Summary
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                ₹{financialStats.totalRevenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Total Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                ₹{financialStats.totalProfit.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Profit</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                ₹{financialStats.totalCommissions.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Total Commissions</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">
                ₹{financialStats.totalDiscounts.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Total Discounts Given</p>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  ₹{financialStats.commissionsThisMonth.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">This Month's Commissions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {financialStats.activeCommissionPartners}
                </p>
                <p className="text-sm text-gray-500">Active Commission Partners</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {products.filter(product => product.stock_quantity < 10).length > 0 && (
        <div className="card border-l-4 border-red-500">
          <div className="card-body">
            <div className="flex items-center">
              <Package className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Low Stock Alert</h3>
                <p className="text-red-600">
                  {products.filter(product => product.stock_quantity < 10).length} product
                  {products.filter(product => product.stock_quantity < 10).length !== 1 ? 's' : ''} running low on stock (less than 10 units)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard 
