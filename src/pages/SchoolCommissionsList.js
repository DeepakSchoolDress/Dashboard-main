import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { School, IndianRupee } from 'lucide-react'

const SchoolCommissionsList = () => {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSchools()
  }, [])

  const fetchSchools = async () => {
    try {
      setLoading(true)
      // First get all schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('*')
        .order('name')

      if (schoolsError) throw schoolsError

      // Get all commission rates
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('school_id, product_id, commission_amount')

      if (commissionsError) throw commissionsError

      // Create commission lookup map
      const commissionMap = {}
      commissionsData.forEach(commission => {
        const key = `${commission.school_id}_${commission.product_id}`
        commissionMap[key] = commission.commission_amount
      })

      // Then for each school, get their sales and commission data
      const schoolsWithCommissions = await Promise.all(
        schoolsData.map(async (school) => {
          // Get all commissioned sale items for this school
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select(`
              id,
              sale_items!inner (
                quantity,
                unit_price,
                is_commissioned,
                product_id
              ),
              bill_cancellations (id)
            `)
            .eq('school_id', school.id)
            .eq('sale_items.is_commissioned', true)

          if (salesError) {
            console.error('Error fetching sales for school:', school.id, salesError)
            return { ...school, totalCommission: 0 }
          }

          // Calculate total commission
          let totalCommission = 0
          salesData?.forEach(sale => {
            // Skip if sale is cancelled
            if (sale.bill_cancellations && sale.bill_cancellations.length > 0) {
              return
            }

            sale.sale_items.forEach(item => {
              if (item.is_commissioned) {
                const commissionKey = `${school.id}_${item.product_id}`
                const commissionRate = commissionMap[commissionKey] || 0
                totalCommission += item.quantity * commissionRate
              }
            })
          })

          return {
            ...school,
            totalCommission
          }
        })
      )

      setSchools(schoolsWithCommissions)
    } catch (error) {
      console.error('Error fetching schools:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading schools...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">School Commissions</h1>
        <p className="text-gray-600">Select a school to view detailed commission information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school) => (
          <Link
            key={school.id}
            to={`/school-commissions/${school.id}`}
            className="card hover:shadow-lg transition-shadow duration-200"
          >
            <div className="card-body">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <School className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{school.name}</h3>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center space-x-2 text-gray-600">
                  <IndianRupee className="w-5 h-5" />
                  <span className="text-xl font-bold text-green-600">
                    ₹{school.totalCommission.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Total commission earned</p>
              </div>

              {school.address && (
                <p className="text-sm text-gray-500 mt-2">
                  {school.address}
                </p>
              )}
              
              <div className="mt-4 text-sm text-blue-600">
                Click to view detailed commission report →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default SchoolCommissionsList 