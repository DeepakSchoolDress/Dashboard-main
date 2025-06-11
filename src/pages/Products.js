import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus, Edit, Trash2, Search, Edit2, AlertCircle, AlertTriangle, Eraser } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../store/slices/productsSlice'
import { fetchSchools } from '../store/slices/schoolsSlice'
import { supabase } from '../lib/supabase'

// In a real application, these should be in environment variables and properly hashed
const ADMIN_PASSWORD = 'admin123'
const ERASE_PASSWORD = 'erase123'

const Products = () => {
  const dispatch = useDispatch()
  const { items: products, loading } = useSelector(state => state.products)
  const { items: schools } = useSelector(state => state.schools)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [showEraseAllModal, setShowEraseAllModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [erasePassword, setErasePassword] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)
  const [erasingAll, setErasingAll] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    school_id: '',
    optional_fields: {}
  })

  useEffect(() => {
    dispatch(fetchProducts())
    dispatch(fetchSchools())
  }, [dispatch])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const productData = {
      ...formData,
      cost_price: parseFloat(formData.cost_price),
      selling_price: parseFloat(formData.selling_price),
      stock_quantity: parseInt(formData.stock_quantity),
      school_id: formData.school_id || null,
    }

    try {
      if (editingProduct) {
        await dispatch(updateProduct({ id: editingProduct.id, ...productData })).unwrap()
        toast.success('Product updated successfully')
      } else {
        await dispatch(createProduct(productData)).unwrap()
        toast.success('Product created successfully')
      }
      
      setShowModal(false)
      resetForm()
    } catch (error) {
      toast.error(error || 'Operation failed')
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      cost_price: product.cost_price.toString(),
      selling_price: product.selling_price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      school_id: product.school_id || '',
      optional_fields: product.optional_fields || {}
    })
    setShowModal(true)
  }

  const handleRestore = async (productId) => {
    try {
      const { error } = await dispatch(updateProduct({ 
        id: productId, 
        is_active: true 
      })).unwrap()

      if (error) throw error
      toast.success('Product restored successfully')
    } catch (error) {
      console.error('Error restoring product:', error)
      toast.error('Failed to restore product')
    }
  }

  const handleDelete = async (productId) => {
    try {
      // First check if product has any sales records
      const { data: saleItems, error: checkError } = await supabase
        .from('sale_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (checkError) throw checkError

      if (saleItems.length > 0) {
        // Product has sales records, perform soft delete
        const { error } = await dispatch(updateProduct({ 
          id: productId, 
          is_active: false 
        })).unwrap()

        if (error) throw error
        toast.success('Product has been archived')
      } else {
        // No sales records, safe to delete
        await dispatch(deleteProduct(productId)).unwrap()
        toast.success('Product deleted successfully')
      }
    } catch (error) {
      console.error('Error handling product:', error)
      toast.error('Failed to delete product')
    }
  }

  const handleDeleteAll = async () => {
    if (deletePassword !== ADMIN_PASSWORD) {
      toast.error('Incorrect password')
      return
    }

    try {
      setDeletingAll(true)

      // Get products with sales
      const { data: productsWithSales, error: checkError } = await supabase
        .from('sale_items')
        .select('product_id')
        .not('product_id', 'is', null)

      if (checkError) throw checkError

      // Create a unique set of product IDs
      const uniqueProductIds = [...new Set(productsWithSales.map(item => item.product_id))]

      if (uniqueProductIds.length > 0) {
        // Archive products with sales
        const { error: archiveError } = await supabase
          .from('products')
          .update({ is_active: false })
          .in('id', uniqueProductIds)

        if (archiveError) throw archiveError

        // Get all products
        const { data: allProducts, error: fetchError } = await supabase
          .from('products')
          .select('id')

        if (fetchError) throw fetchError

        // Filter out products that have sales
        const productsToDelete = allProducts
          .filter(product => !uniqueProductIds.includes(product.id))
          .map(product => product.id)

        if (productsToDelete.length > 0) {
          // Delete products without sales
          const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .in('id', productsToDelete)

          if (deleteError) throw deleteError
        }
      } else {
        // If no products have sales, delete all products
        const { error: deleteError } = await supabase
          .from('products')
          .delete()

        if (deleteError) throw deleteError
      }

      toast.success('All products have been processed. Products with sales history have been archived.')
      setShowDeleteAllModal(false)
      setDeletePassword('')
      dispatch(fetchProducts())
    } catch (error) {
      console.error('Error deleting all products:', error)
      toast.error('Failed to process all products')
    } finally {
      setDeletingAll(false)
    }
  }

  const handleEraseAll = async () => {
    if (erasePassword !== ERASE_PASSWORD) {
      toast.error('Incorrect password')
      return
    }

    try {
      setErasingAll(true)

      // Delete all data from all relevant tables in the correct order
      const tables = [
        'sale_items',    // Delete child records first
        'sales',         // Then delete parent sales
        'commissions',   // Independent tables
        'statistics',
        'dashboard_data',
        'products',      // Then delete products
        'schools'        // Finally delete schools
      ]

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .not('id', 'is', null) // This will match all rows with non-null IDs

        if (error && error.code !== '42P01') { // Ignore "table does not exist" errors
          throw error
        }
      }

      toast.success('All dashboard data has been completely erased')
      setShowEraseAllModal(false)
      setErasePassword('')
      dispatch(fetchProducts())
      dispatch(fetchSchools())
    } catch (error) {
      console.error('Error erasing all data:', error)
      toast.error('Failed to erase all data')
    } finally {
      setErasingAll(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      cost_price: '',
      selling_price: '',
      stock_quantity: '',
      school_id: '',
      optional_fields: {}
    })
    setEditingProduct(null)
  }

  const handleModalClose = () => {
    setShowModal(false)
    resetForm()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product inventory</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowEraseAllModal(true)}
            className="btn btn-danger bg-red-700 hover:bg-red-800"
          >
            <Eraser className="w-5 h-5 mr-2" />
            Erase Everything
          </button>
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="btn btn-danger"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Delete All
          </button>
          <button
            onClick={() => {
              setFormData({
                name: '',
                cost_price: '',
                selling_price: '',
                stock_quantity: '',
                school_id: '',
                optional_fields: {}
              })
              setShowModal(true)
            }}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Product
          </button>
        </div>
      </div>

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

      {/* Products Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                    <th>Stock</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className={!product.is_active ? 'bg-gray-50' : ''}>
                      <td>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.optional_fields && Object.keys(product.optional_fields).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(product.optional_fields).map(([key, value]) => (
                                <span key={key} className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>₹{parseFloat(product.cost_price).toFixed(2)}</td>
                      <td>₹{parseFloat(product.selling_price).toFixed(2)}</td>
                      <td>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.stock_quantity < 10 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {product.stock_quantity}
                        </span>
                      </td>
                      <td>{product.schools ? product.schools.name : '-'}</td>
                      <td>
                        {!product.is_active && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                            Archived
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {product.is_active ? (
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Restore Product"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => {
                setShowDeleteAllModal(false)
                setDeletePassword('')
              }}
            ></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg font-medium text-gray-900">
                      Delete All Products
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        This action will:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-sm text-gray-500">
                        <li>Delete all products without sales history</li>
                        <li>Archive products that have sales records</li>
                        <li>This action cannot be undone</li>
                      </ul>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Enter Admin Password to Confirm
                        </label>
                        <input
                          type="password"
                          className="input"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Enter password"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={deletingAll || !deletePassword}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {deletingAll ? 'Processing...' : 'Delete All'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAllModal(false)
                    setDeletePassword('')
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Erase All Confirmation Modal */}
      {showEraseAllModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => {
                setShowEraseAllModal(false)
                setErasePassword('')
              }}
            ></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg font-medium text-gray-900">
                      Erase All Dashboard Data
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-red-600 font-semibold">
                        ⚠️ DANGER: This action cannot be undone!
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        This will permanently erase:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-sm text-gray-500">
                        <li>All products (including archived)</li>
                        <li>All sales records</li>
                        <li>All commission data</li>
                        <li>All schools data</li>
                        <li>All statistics and dashboard data</li>
                      </ul>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Enter Erase Password to Confirm
                        </label>
                        <input
                          type="password"
                          className="input"
                          value={erasePassword}
                          onChange={(e) => setErasePassword(e.target.value)}
                          placeholder="Enter password"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleEraseAll}
                  disabled={erasingAll || !erasePassword}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-700 text-base font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {erasingAll ? 'Erasing...' : 'Erase Everything'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEraseAllModal(false)
                    setErasePassword('')
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleModalClose}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="input"
                          value={formData.cost_price}
                          onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Selling Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="input"
                          value={formData.selling_price}
                          onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Quantity *
                      </label>
                      <input
                        type="number"
                        required
                        className="input"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Associated School
                      </label>
                      <select
                        className="input"
                        value={formData.school_id}
                        onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                      >
                        <option value="">No specific school</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center btn btn-primary sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingProduct ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleModalClose}
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
    </div>
  )
}

export default Products 