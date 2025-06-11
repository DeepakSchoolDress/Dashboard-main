import { configureStore } from '@reduxjs/toolkit'
import productsReducer from './slices/productsSlice'
import schoolsReducer from './slices/schoolsSlice'
import salesReducer from './slices/salesSlice'

export const store = configureStore({
  reducer: {
    products: productsReducer,
    schools: schoolsReducer,
    sales: salesReducer,
  },
}) 