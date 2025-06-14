import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Edit, Trash2, Calculator, IndianRupee, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchSchools, createSchool, updateSchool, deleteSchool } from '../store/slices/schoolsSlice'
import { fetchProducts } from '../store/slices/productsSlice'
import { supabase } from '../lib/supabase'

const Schools = () => {
  const dispatch = useDispatch()
  const { items: schools, loading } = useSelector(state => state.schools)
  const { items: products } = useSelector(state => state.products)
  
  const [showModal, setShowModal] = useState(false)
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [editingSchool, setEditingSchool] = useState(null)
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [formData, setFormData] = useState({ name: '' })
  const [commissions, setCommissions] = useState([])
  const [schoolCommissions, setSchoolCommissions] = useState([])
  const [newCommission, setNewCommission] = useState({ product_id: '', commission_rate: '' })
  const [schoolEarnings, setSchoolEarnings] = useState({})

  useEffect(() => {
    dispatch(fetchSchools())
    dispatch(fetchProducts())
    fetchAllCommissions()
    fetchSchoolEarnings()
  }, [dispatch])

  const fetchAllCommissions = async () => {
    try {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          schools (id, name),
          products (id, name, selling_price)
        `)
      
      if (error) throw error
      setCommissions(data || [])
    } catch (error) {
      console.error('Error fetching commissions:', error)
    }
  }

  const fetchSchoolCommissions = async (schoolId) => {
    try {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          products (id, name, selling_price)
        `)
        .eq('school_id', schoolId)
      
      if (error) throw error
      setSchoolCommissions(data || [])
    } catch (error) {
      console.error('Error fetching school commissions:', error)
    }
  }

  const fetchSchoolEarnings = async () => {
    try {
      // Get all sales with commissioned items and their commission data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          school_id,
          schools (id, name),
          sale_items!inner (
            quantity,
            unit_price,
            is_commissioned,
            product_id,
            products (id, name)
          ),
          bill_cancellations (id)
        `)
        .eq('sale_items.is_commissioned', true)
        .not('school_id', 'is', null)

      if (salesError) throw salesError

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

      const earnings = {}
      salesData?.forEach(sale => {
        // Skip if sale is cancelled
        if (sale.bill_cancellations && sale.bill_cancellations.length > 0) {
          return
        }

        const schoolId = sale.school_id
        if (schoolId && sale.schools) {
          sale.sale_items.forEach(item => {
            if (item.is_commissioned) {
              const commissionKey = `${schoolId}_${item.product_id}`
              const commissionRate = commissionMap[commissionKey] || 0
              const commissionAmount = commissionRate * item.quantity

              if (!earnings[schoolId]) {
                earnings[schoolId] = {
                  school_name: sale.schools.name,
                  total_commission: 0,
                  total_sales: 0
                }
              }
              earnings[schoolId].total_commission += commissionAmount
              earnings[schoolId].total_sales += (item.quantity * item.unit_price)
            }
          })
        }
      })
      
      setSchoolEarnings(earnings)
    } catch (error) {
      console.error('Error fetching school earnings:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editingSchool) {
        await dispatch(updateSchool({ id: editingSchool.id, ...formData })).unwrap()
        toast.success('School updated successfully')
      } else {
        await dispatch(createSchool(formData)).unwrap()
        toast.success('School created successfully')
      }
      
      setShowModal(false)
      resetForm()
      fetchSchoolEarnings()
    } catch (error) {
      toast.error(error || 'Operation failed')
    }
  }

  const handleEdit = (school) => {
    setEditingSchool(school)
    setFormData({ name: school.name })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this school? This will also remove all associated commissions.')) {
      try {
        await dispatch(deleteSchool(id)).unwrap()
        toast.success('School deleted successfully')
        fetchAllCommissions()
        fetchSchoolEarnings()
      } catch (error) {
        toast.error(error || 'Delete failed')
      }
    }
  }

  const openCommissionModal = async (school) => {
    setSelectedSchool(school)
    setShowCommissionModal(true)
    await fetchSchoolCommissions(school.id)
  }

  const handleAddCommission = async () => {
    if (!newCommission.product_id || !newCommission.commission_rate) {
      toast.error('Please select a product and enter commission amount')
      return
    }

    const commissionAmount = parseFloat(newCommission.commission_rate)
    if (isNaN(commissionAmount) || commissionAmount < 0 || commissionAmount > 1000000) {
      toast.error('Commission amount must be between ₹0 and ₹10,00,000')
      return
    }

    try {
      // First verify the school and product exist
      const { data: existingCommission, error: checkError } = await supabase
        .from('commissions')
        .select('id')
        .eq('school_id', selectedSchool.id)
        .eq('product_id', newCommission.product_id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw checkError
      }

      if (existingCommission) {
        toast.error('Commission already exists for this product')
        return
      }

      // Create the commission
      const { error } = await supabase
        .from('commissions')
        .insert({
          school_id: selectedSchool.id,
          product_id: newCommission.product_id,
          commission_amount: commissionAmount
        })

      if (error) {
        throw error
      }

      toast.success('Commission added successfully')
      setNewCommission({ product_id: '', commission_rate: '' })
      await fetchSchoolCommissions(selectedSchool.id)
      await fetchAllCommissions()
      await fetchSchoolEarnings()
    } catch (error) {
      console.error('Error adding commission:', error)
      toast.error(error.message || 'Failed to add commission')
    }
  }

  const handleDeleteCommission = async (commissionId) => {
    if (window.confirm('Are you sure you want to remove this commission?')) {
      try {
        const { error } = await supabase
          .from('commissions')
          .delete()
          .eq('id', commissionId)

        if (error) throw error
        
        toast.success('Commission removed successfully')
        await fetchSchoolCommissions(selectedSchool.id)
        await fetchAllCommissions()
        await fetchSchoolEarnings()
      } catch (error) {
        toast.error('Failed to remove commission')
      }
    }
  }

  const resetForm = () => {
    setFormData({ name: '' })
    setEditingSchool(null)
  }

  const availableProducts = products.filter(product => 
    !schoolCommissions.some(commission => commission.product_id === product.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools & Commission Management</h1>
          <p className="text-gray-600">Manage school partnerships and commission rates</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Add School
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading schools...</p>
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No schools found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>School Name</th>
                    <th>Commission Products</th>
                    <th>Total Earnings</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => {
                    const schoolCommissionCount = commissions.filter(c => c.school_id === school.id).length
                    const earnings = schoolEarnings[school.id] || { total_commission: 0, total_sales: 0 }
                    
                    return (
                      <tr key={school.id}>
                        <td className="font-medium">{school.name}</td>
                        <td>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {schoolCommissionCount} products
                          </span>
                        </td>
                        <td className="font-semibold text-green-600">
                          ₹{earnings.total_commission.toFixed(2)}
                        </td>
                        <td>{new Date(school.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openCommissionModal(school)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Manage Commissions"
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(school)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Edit School"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(school.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Delete School"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* School Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingSchool ? 'Edit School' : 'Add New School'}
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center btn btn-primary sm:ml-3 sm:w-auto sm:text-sm">
                    {editingSchool ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center btn btn-secondary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Commission Management Modal */}
      {showCommissionModal && selectedSchool && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCommissionModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Commission Management - {selectedSchool.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Manage commission rates for products sold to this school
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Earnings</p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{(schoolEarnings[selectedSchool.id]?.total_commission || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Add Commission */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Add New Commission</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                      <select
                        className="input"
                        value={newCommission.product_id}
                        onChange={(e) => setNewCommission({ ...newCommission, product_id: e.target.value })}
                      >
                        <option value="">Select a product</option>
                        {availableProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - ₹{product.selling_price}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Commission Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1000000"
                          className="input pl-8"
                          placeholder="e.g., 50"
                          value={newCommission.commission_rate}
                          onChange={(e) => setNewCommission({ ...newCommission, commission_rate: e.target.value })}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Enter amount between ₹0 and ₹10,00,000</p>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleAddCommission}
                        className="w-full btn btn-primary"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Commission
                      </button>
                    </div>
                  </div>
                </div>

                {/* Commission List */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Current Commissions</h4>
                  {schoolCommissions.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No commissions set for this school</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Product Price</th>
                            <th>Commission Amount</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolCommissions.map(commission => {
                            return (
                              <tr key={commission.id}>
                                <td className="font-medium">{commission.products.name}</td>
                                <td>₹{commission.products.selling_price}</td>
                                <td className="font-semibold text-green-600">
                                  <span className="flex items-center">
                                    <IndianRupee className="w-4 h-4 mr-1" />
                                    ₹{commission.commission_amount.toFixed(2)}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    onClick={() => handleDeleteCommission(commission.id)}
                                    className="p-1 text-red-600 hover:text-red-800"
                                    title="Remove Commission"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                <button
                  onClick={() => setShowCommissionModal(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Schools 