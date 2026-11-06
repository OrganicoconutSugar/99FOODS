import { supabase } from './supabase'
import { createTransactionService } from './transactionService'

export const saveTransaction = createTransactionService(supabase)
