import ListaVuelos from './components/Vuelos/ListaVuelos.jsx';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-bold text-slate-800">Sky Rout Operations</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ListaVuelos />
      </main>
    </div>
  );
}

export default App;
