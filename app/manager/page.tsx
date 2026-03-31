'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Farm = {
  id: string
  name: string
}

type Worker = {
  id: string
  name: string
  role: string
  farm_id: string | null
}

type Task = {
  id: string
  title: string
  status: string
  assigned_to: string | null
  farm_id: string | null
  date: string
}

export default function ManagerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [farms, setFarms] = useState<Farm[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [addLoading, setAddLoading] = useState(false)

  // New task form state
  const [newTitle, setNewTitle] = useState('')
  const [newWorker, setNewWorker] = useState('')
  const [newFarm, setNewFarm] = useState('')

  const ORG_ID = '11111111-0000-0000-0000-000000000001'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    checkAuth()
    loadData()
    // Real-time subscription
    const channel = supabase
      .channel('tasks-manager')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `org_id=eq.${ORG_ID}`,
      }, () => {
        loadTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: worker } = await supabase
      .from('workers')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (!worker || worker.role !== 'manager') {
      router.push('/worker')
    }
  }

  async function loadData() {
    setLoading(true)
    await Promise.all([loadFarms(), loadWorkers(), loadTasks()])
    setLoading(false)
  }

  async function loadFarms() {
    const { data } = await supabase
      .from('luis_farms')
      .select('id, name')
      .eq('org_id', ORG_ID)
      .order('name')
    setFarms(data || [])
  }

  async function loadWorkers() {
    const { data } = await supabase
      .from('workers')
      .select('id, name, role, farm_id')
      .eq('org_id', ORG_ID)
      .order('name')
    setWorkers((data || []).filter(w => w.role === 'worker'))
  }

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_to, farm_id, date')
      .eq('org_id', ORG_ID)
      .eq('date', today)
      .order('created_at')
    setTasks(data || [])
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newWorker) return
    setAddLoading(true)

    const selectedWorker = workers.find(w => w.id === newWorker)
    const farmId = newFarm || selectedWorker?.farm_id || null

    await supabase.from('tasks').insert({
      org_id: ORG_ID,
      farm_id: farmId,
      assigned_to: newWorker,
      title: newTitle.trim(),
      status: 'todo',
      date: today,
    })

    setNewTitle('')
    setNewWorker('')
    setNewFarm('')
    await loadTasks()
    setAddLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length

  const getWorkerName = (workerId: string | null) => {
    if (!workerId) return 'Unassigned'
    return workers.find(w => w.id === workerId)?.name || 'Unknown'
  }

  const getFarmName = (farmId: string | null) => {
    if (!farmId) return ''
    return farms.find(f => f.id === farmId)?.name || ''
  }

  const getWorkerTasks = (workerId: string) =>
    tasks.filter(t => t.assigned_to === workerId)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <header className="bg-green-700 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">Iglesias Tasks</h1>
            <span className="bg-white text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              DEMO #1
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-100">Manager View</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-green-200 hover:text-white underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Today&apos;s Progress</h2>
            <span className="text-2xl font-bold text-green-700">
              {doneTasks}/{totalTasks}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: totalTasks > 0 ? `${(doneTasks / totalTasks) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {totalTasks - doneTasks} tasks remaining · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Add Task Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Add Task</h2>
          <form onSubmit={addTask} className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task description..."
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            />
            <div className="flex gap-2">
              <select
                value={newWorker}
                onChange={e => setNewWorker(e.target.value)}
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                <option value="">Assign to...</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select
                value={newFarm}
                onChange={e => setNewFarm(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                <option value="">Farm (optional)</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={addLoading}
              className="w-full bg-green-700 text-white font-semibold py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {addLoading ? 'Adding...' : 'Add Task'}
            </button>
          </form>
        </div>

        {/* Tasks by Worker */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">All Workers</h2>
          {workers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No workers found.</p>
          ) : (
            workers.map(worker => {
              const workerTasks = getWorkerTasks(worker.id)
              const done = workerTasks.filter(t => t.status === 'done').length
              return (
                <div key={worker.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-green-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{worker.name}</p>
                      <p className="text-xs text-gray-500">{getFarmName(worker.farm_id)}</p>
                    </div>
                    <span className={`text-sm font-bold ${done === workerTasks.length && workerTasks.length > 0 ? 'text-green-700' : 'text-gray-600'}`}>
                      {done}/{workerTasks.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {workerTasks.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No tasks today</p>
                    ) : (
                      workerTasks.map(task => (
                        <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                            task.status === 'done'
                              ? 'bg-green-600'
                              : 'border-2 border-gray-300'
                          }`}>
                            {task.status === 'done' && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </span>
                          {task.farm_id && (
                            <span className="text-xs text-gray-400">{getFarmName(task.farm_id)}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Unassigned tasks */}
        {tasks.filter(t => !t.assigned_to).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-yellow-50 border-b border-gray-200 px-4 py-3">
              <p className="font-semibold text-gray-800">Unassigned</p>
            </div>
            <div className="divide-y divide-gray-100">
              {tasks.filter(t => !t.assigned_to).map(task => (
                <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                    task.status === 'done' ? 'bg-green-600' : 'border-2 border-gray-300'
                  }`}>
                    {task.status === 'done' && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
