import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '../../lib/supabase'

// Async thunks
export const fetchSchools = createAsyncThunk(
  'schools/fetchSchools',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const createSchool = createAsyncThunk(
  'schools/createSchool',
  async (schoolData, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .insert([schoolData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateSchool = createAsyncThunk(
  'schools/updateSchool',
  async ({ id, ...updateData }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const deleteSchool = createAsyncThunk(
  'schools/deleteSchool',
  async (id, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const schoolsSlice = createSlice({
  name: 'schools',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch schools
      .addCase(fetchSchools.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSchools.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchSchools.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Create school
      .addCase(createSchool.fulfilled, (state, action) => {
        state.items.push(action.payload)
        state.items.sort((a, b) => a.name.localeCompare(b.name))
      })
      .addCase(createSchool.rejected, (state, action) => {
        state.error = action.payload
      })
      // Update school
      .addCase(updateSchool.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        state.items.sort((a, b) => a.name.localeCompare(b.name))
      })
      .addCase(updateSchool.rejected, (state, action) => {
        state.error = action.payload
      })
      // Delete school
      .addCase(deleteSchool.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload)
      })
      .addCase(deleteSchool.rejected, (state, action) => {
        state.error = action.payload
      })
  },
})

export const { clearError } = schoolsSlice.actions
export default schoolsSlice.reducer 