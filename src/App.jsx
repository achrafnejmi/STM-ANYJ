import ImportSTM from './screens/ImportSTM.jsx'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">
          Notification des offres non linéaires — PoC
        </h1>
        <p className="text-sm text-slate-500">STM → Digital</p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <ImportSTM />
      </main>
    </div>
  )
}

export default App
