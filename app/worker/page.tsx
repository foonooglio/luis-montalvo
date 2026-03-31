'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  title: string
  status: string
  farm_id: string | null
}

type Farm = {
  id: string
  name: string
}

type WorkerProfile = {
  id: string
  name: string
  farm_id: string | null
}

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  const ORG_ID = '11111111-0000-0000-0000-000000000001'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: worker } = await supabase
      .from('workers')
      .select('id, name, role, farm_id')
      .eq('user_id', user.id)
      .single()

    if (!worker) { router.push('/login'); return }
    if (worker.role === 'manager') { router.push('/manager'); return }

    setWorkerProfile({ id: worker.id, name: worker.name, farm_id: worker.farm_id })

    // Load farms
    const { data: farmsData } = await supabase
      .from('luis_farms')
      .select('id, name')
      .eq('org_id', ORG_ID)
    setFarms(farmsData || [])

    // Load tasks
    await loadTasks(worker.id)
    setLoading(false)

    // Real-time subscription
    const channel = supabase
      .channel(`tasks-worker-${worker.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `assigned_to=eq.${worker.id}`,
      }, () => {
        loadTasks(worker.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  async function loadTasks(workerId: string) {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, farm_id')
      .eq('assigned_to', workerId)
      .eq('date', today)
      .order('created_at')
    setTasks(data || [])
  }

  async function markDone(taskId: string) {
    setCompleting(taskId)
    await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'done' } : t
    ))
    setCompleting(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getFarmName = (farmId: string | null) => {
    if (!farmId) return ''
    return farms.find(f => f.id === farmId)?.name || ''
  }

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0
  const allDone = totalTasks > 0 && doneTasks === totalTasks

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading your tasks...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <header className="bg-green-700 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">My Tasks</h1>
            <span className="bg-white text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              DEMO #1
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-green-200 hover:text-white underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Worker name + progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="font-semibold text-gray-800 text-lg">{workerProfile?.name}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-500">Progress</span>
              <span className="text-sm font-bold text-green-700">{doneTasks}/{totalTasks} done</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {allDone && totalTasks > 0 && (
            <p className="text-center text-green-700 font-bold mt-3 text-lg">
              🎉 All done for today!
            </p>
          )}
        </div>

        {/* Task list */}
        {totalTasks === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-lg">No tasks assigned for today.</p>
            <p className="text-gray-400 text-sm mt-1">Check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`bg-white rounded-xl border overflow-hidden ${
                  task.status === 'done'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${
                      task.status === 'done'
                        ? 'bg-green-600'
                        : 'border-2 border-gray-300'
                    }`}>
                      {task.status === 'done' && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium text-base leading-tight ${
                        task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'
                      }`}>
                        {task.title}
                      </p>
                      {task.farm_id && (
                        <p className="text-xs text-gray-400 mt-0.5">{getFarmName(task.farm_id)}</p>
                      )}
                    </div>
                  </div>

                  {task.status !== 'done' && (
                    <button
                      onClick={() => markDone(task.id)}
                      disabled={completing === task.id}
                      className="mt-3 w-full bg-green-700 text-white font-semibold py-3.5 rounded-lg text-base hover:bg-green-800 active:bg-green-900 disabled:opacity-50 transition-colors"
                    >
                      {completing === task.id ? 'Marking done...' : '✓ Mark as Done'}
                    </button>
                  )}
                  {task.status === 'done' && (
                    <p className="mt-2 text-center text-green-600 text-sm font-medium">✓ Completed</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
