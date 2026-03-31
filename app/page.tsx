import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: worker } = await supabase
    .from('workers')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (worker?.role === 'manager') {
    redirect('/manager')
  } else {
    redirect('/worker')
  }
}
