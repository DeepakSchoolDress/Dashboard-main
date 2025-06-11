import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '../../lib/supabase'

export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          schools (id, name),
          sale_items (
            id,
            quantity,
            unit_price,
            is_commissioned,
            products (id, name, cost_price, selling_price)
          ),
          bill_cancellations (
            id,
            cancelled_at,
            reason
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    items: [],
    loading: false,
    error: null,
    cart: [],
    selectedSchool: null,
    customerName: 'Cash',
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    addToCart: (state, action) => {
      const { product, quantity } = action.payload
      const existingItem = state.cart.find(item => item.product.id === product.id)
      
      if (existingItem) {
        existingItem.quantity += quantity
      } else {
        state.cart.push({ product, quantity })
      }
    },
    removeFromCart: (state, action) => {
      const productId = action.payload
      state.cart = state.cart.filter(item => item.product.id !== productId)
    },
    updateCartQuantity: (state, action) => {
      const { productId, quantity } = action.payload
      const item = state.cart.find(item => item.product.id === productId)
      if (item) {
        item.quantity = quantity
      }
    },
    clearCart: (state) => {
      state.cart = []
    },
    setSelectedSchool: (state, action) => {
      state.selectedSchool = action.payload
    },
    setCustomerName: (state, action) => {
      state.customerName = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const {
  clearError,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  setSelectedSchool,
  setCustomerName,
} = salesSlice.actions

export default salesSlice.reducer 