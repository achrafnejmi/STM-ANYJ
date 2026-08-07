import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { lireRole, deconnecter } from './lib/session.js'
import Login from './screens/Login.jsx'
import ImportSTM from './screens/ImportSTM.jsx'
import Inbox from './screens/Inbox.jsx'
import Dashboard from './screens/Dashboard.jsx'

const ONGLETS_PAR_ROLE = {
  PROGRAMMATION: [
    { id: 'PRINCIPAL', label: 'Émetteur' },
    { id: 'DASHBOARD', label: 'Dashboard' },
  ],
  DIGITAL: [
    { id: 'PRINCIPAL', label: 'Inbox' },
    { id: 'DASHBOARD', label: 'Dashboard' },
  ],
}

function App() {
  const [role, setRole] = useState(() => lireRole())
  const [onglet, setOnglet] = useState('PRINCIPAL')

  if (!role) {
    return <Login onChoix={setRole} />
  }

  function handleDeconnexion() {
    deconnecter()
    setRole(null)
    setOnglet('PRINCIPAL')
  }

  const onglets = ONGLETS_PAR_ROLE[role]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              Notification des offres non linéaires — PoC
            </h1>
            <p className="text-sm text-slate-500">STM → Digital</p>
          </div>
          <button
            type="button"
            onClick={handleDeconnexion}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Changer de rôle
          </button>
        </div>
        <nav className="mx-auto mt-4 flex max-w-4xl gap-1">
          {onglets.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOnglet(o.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                onglet === o.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {onglet === 'DASHBOARD' && <Dashboard />}
        {onglet === 'PRINCIPAL' && role === 'PROGRAMMATION' && <ImportSTM />}
        {onglet === 'PRINCIPAL' && role === 'DIGITAL' && <Inbox />}
      </main>
    </div>
  )
}

export default App
