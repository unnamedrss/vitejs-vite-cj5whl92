import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  Users,
  Sparkles,
  Camera,
  FileText,
  CheckCircle2,
  Trash2,
  Edit3,
  ChevronRight,
  ArrowLeft,
  Plus,
  Search,
  TrendingUp,
  RefreshCw,
  Settings,
} from 'lucide-react';

// --- KONFIGURACJA FIREBASE (LASIEWICKA STUDIO) ---
const firebaseConfig = {
  apiKey: 'AIzaSyAh024TinzcrI2nNJadCxb_Pm_FZarCaBc',
  authDomain: 'lasiewicka-studio.firebaseapp.com',
  projectId: 'lasiewicka-studio',
  storageBucket: 'lasiewicka-studio.firebasestorage.app',
  messagingSenderId: '757279326376',
  appId: '1:757279326376:web:5b72c96495af43d7cd829d',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'lasiewicka-studio-crm';

const DEFAULT_SALON_SETTINGS = {
  brandMain: 'Lasiewicka',
  brandAccent: 'Studio',
  subtitle: 'Salon Manager CRM',
  logoDataUrl: '',
  pinEnabled: false,
  pinCode: '1234',
  rodoText:
    'Wyrażam dobrowolną zgodę na wykonanie zabiegu stylizacji rzęs / brwi / paznokci w salonie. Oświadczam, że zostałam poinformowana o przebiegu zabiegu, możliwych reakcjach alergicznych oraz zaleceniach pielęgnacyjnych po zabiegu. Potwierdzam brak znanych mi przeciwwskazań zdrowotnych oraz wyrażam zgodę na przetwarzanie moich danych osobowych (RODO) na potrzeby realizacji usług i prowadzenia karty klientki.',
};

const compressImage = (
  file,
  maxWidth = 900,
  quality = 0.65,
  isDocument = false
) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (isDocument) {
          ctx.filter = 'contrast(1.35) brightness(1.05) grayscale(0.2)';
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');

  const [clients, setClients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [salonSettings, setSalonSettings] = useState(DEFAULT_SALON_SETTINGS);

  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [hasCheckedInitialLock, setHasCheckedInitialLock] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientSubTab, setClientSubTab] = useState('visits');
  const [searchQuery, setSearchQuery] = useState('');

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error('Błąd autoryzacji Firebase:', err);
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const clientsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'clients'
    );
    const visitsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'visits'
    );
    const docsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'documents'
    );
    const settingsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'settings'
    );

    const unsubClients = onSnapshot(clientsRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClients(list);
      setLoading(false);
    });

    const unsubVisits = onSnapshot(visitsRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setVisits(list);
    });

    const unsubDocs = onSnapshot(docsRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setDocuments(list);
    });

    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      const brandingDoc = snapshot.docs.find((d) => d.id === 'branding');
      if (brandingDoc) {
        const data = { ...DEFAULT_SALON_SETTINGS, ...brandingDoc.data() };
        setSalonSettings(data);
        if (!hasCheckedInitialLock) {
          if (data.pinEnabled && data.pinCode) setIsLocked(true);
          setHasCheckedInitialLock(true);
        }
      } else {
        setHasCheckedInitialLock(true);
      }
    });

    return () => {
      unsubClients();
      unsubVisits();
      unsubDocs();
      unsubSettings();
    };
  }, [user, hasCheckedInitialLock]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.instagram && c.instagram.toLowerCase().includes(q)) ||
        (c.lashNotes && c.lashNotes.toLowerCase().includes(q)) ||
        (c.nailNotes && c.nailNotes.toLowerCase().includes(q))
      );
    });
  }, [clients, searchQuery]);

  const getClientStats = (clientId) => {
    const clientVisits = visits.filter((v) => v.clientId === clientId);
    const totalSpent = clientVisits.reduce(
      (sum, v) => sum + (Number(v.price) || 0),
      0
    );
    return { visitCount: clientVisits.length, totalSpent };
  };

  const handleDeleteExecute = async () => {
    if (!deleteConfirm || !user) return;
    try {
      const { type, id } = deleteConfirm;
      if (type === 'client') {
        await deleteDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'clients', id)
        );
        if (selectedClientId === id) setSelectedClientId(null);
      } else if (type === 'visit') {
        await deleteDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'visits', id)
        );
      } else if (type === 'document') {
        await deleteDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'documents', id)
        );
      }
      setDeleteConfirm(null);
      showToast('Usunięto pomyślnie');
    } catch (err) {
      console.error('Błąd usuwania:', err);
    }
  };

  const handleSaveSalonSettings = async (newSettings) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'branding'),
        newSettings
      );
      setSalonSettings(newSettings);
      showToast('Zapisano ustawienia salonu!');
    } catch (err) {
      console.error('Błąd zapisu ustawień:', err);
    }
  };

  const handleUnlockPin = (e) => {
    e.preventDefault();
    if (pinInput === salonSettings.pinCode) {
      setIsLocked(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-3xl p-8 shadow-xl border border-rose-100 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
            {salonSettings.logoDataUrl ? (
              <img
                src={salonSettings.logoDataUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <Sparkles className="w-9 h-9" />
            )}
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-800">
            {salonSettings.brandMain}{' '}
            <span className="text-rose-500 italic font-normal">
              {salonSettings.brandAccent}
            </span>
          </h1>
          <p className="text-xs text-stone-400 uppercase tracking-widest mt-1 mb-6">
            Autoryzacja dostępu CRM
          </p>
          <form onSubmit={handleUnlockPin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="••••"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              className={`w-full text-center text-2xl tracking-[0.5em] font-bold py-3.5 rounded-2xl border bg-stone-50 focus:bg-white focus:outline-none ${
                pinError ? 'border-red-400 text-red-600' : 'border-stone-200'
              }`}
            />
            {pinError && (
              <p className="text-xs text-red-500 font-semibold">
                Nieprawidłowy kod PIN
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-md"
            >
              Odblokuj aplikację
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-stone-800 flex flex-col md:flex-row font-sans">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-rose-100/80 flex flex-col justify-between shrink-0 sticky top-0 z-20 md:h-screen">
        <div>
          <div className="p-5 md:p-6 flex items-center justify-between border-b border-rose-50">
            <div
              className="flex items-center gap-3.5 cursor-pointer"
              onClick={() => {
                setActiveTab('clients');
                setSelectedClientId(null);
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center text-white shadow-md overflow-hidden shrink-0">
                {salonSettings.logoDataUrl ? (
                  <img
                    src={salonSettings.logoDataUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-xl font-bold tracking-tight text-stone-900 truncate">
                  {salonSettings.brandMain}{' '}
                  <span className="text-rose-500 font-normal italic">
                    {salonSettings.brandAccent}
                  </span>
                </h1>
                <p className="text-[11px] text-stone-400 uppercase tracking-widest font-medium truncate">
                  {salonSettings.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => {
                  setEditingClient(null);
                  setIsClientModalOpen(true);
                }}
                className="bg-rose-500 text-white p-2.5 rounded-xl shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex md:flex-col p-2 md:p-4 gap-1 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('clients');
                setSelectedClientId(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'clients'
                  ? 'bg-rose-50/90 text-rose-700 font-semibold'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Baza Klientek</span>
              <span className="ml-auto bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full hidden md:inline-block">
                {clients.length}
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab('gallery');
                setSelectedClientId(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'gallery'
                  ? 'bg-rose-50/90 text-rose-700 font-semibold'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Portfolio</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('finances');
                setSelectedClientId(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'finances'
                  ? 'bg-rose-50/90 text-rose-700 font-semibold'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Finanse</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('settings');
                setSelectedClientId(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-rose-50/90 text-rose-700 font-semibold'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Ustawienia (Logo / Nazwa)</span>
            </button>
          </nav>
        </div>

        <div className="hidden md:block p-4 border-t border-rose-50 space-y-3">
          <button
            onClick={() => {
              setEditingClient(null);
              setIsClientModalOpen(true);
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nowa Klientka
          </button>
          <button
            onClick={() => {
              setEditingVisit(null);
              setIsVisitModalOpen(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-stone-900 text-white font-medium text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-rose-300" /> Dodaj Stylizację
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-stone-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-rose-400" />
            <p className="text-sm">Łączenie z bazą Lasiewicka Studio...</p>
          </div>
        ) : (
          <>
            {activeTab === 'clients' && !selectedClient && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900">
                      Karty Klientek
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">
                      Wyszukuj profile, sprawdzaj skręt rzęs, kolory baz, zgody
                      i historię wizyt.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingVisit(null);
                        setIsVisitModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-rose-300" /> Szybka
                      wizyta
                    </button>
                    <button
                      onClick={() => {
                        setEditingClient(null);
                        setIsClientModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Dodaj klientkę
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100/80">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Szukaj po imieniu, telefonie, Instagramie lub notatce..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                </div>

                {filteredClients.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-dashed border-rose-200 p-12 text-center">
                    <Users className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-stone-800">
                      Brak klientek w bazie
                    </h3>
                    <p className="text-sm text-stone-500 mt-1 mb-5">
                      Dodaj pierwszą klientkę, aby prowadzić jej kartę
                      stylizacji i zgód.
                    </p>
                    <button
                      onClick={() => {
                        setEditingClient(null);
                        setIsClientModalOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium"
                    >
                      + Utwórz pierwszą kartę klientki
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.map((client) => {
                      const stats = getClientStats(client.id);
                      return (
                        <div
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setClientSubTab('visits');
                          }}
                          className="group bg-white rounded-2xl p-5 border border-rose-100/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-serif font-bold text-base bg-rose-50 text-rose-700 border border-rose-100">
                                  {(client.name || 'K')
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="font-bold text-stone-900 group-hover:text-rose-600">
                                    {client.name}
                                  </h3>
                                  <p className="text-xs text-stone-500">
                                    {client.phone || 'Brak telefonu'}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-rose-500" />
                            </div>
                            {client.lashNotes && (
                              <p className="text-xs text-stone-600 bg-stone-50 p-2 rounded-lg mb-1 truncate">
                                <b>Rzęsy:</b> {client.lashNotes}
                              </p>
                            )}
                            {client.nailNotes && (
                              <p className="text-xs text-stone-600 bg-stone-50 p-2 rounded-lg truncate">
                                <b>Paznokcie:</b> {client.nailNotes}
                              </p>
                            )}
                          </div>
                          <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                            <span>
                              Wizyt: <b>{stats.visitCount}</b>
                            </span>
                            <span>
                              Suma:{' '}
                              <b className="text-rose-600">
                                {stats.totalSpent} zł
                              </b>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'clients' && selectedClient && (
              <ClientProfileView
                client={selectedClient}
                visits={visits.filter((v) => v.clientId === selectedClient.id)}
                documents={documents.filter(
                  (d) => d.clientId === selectedClient.id
                )}
                subTab={clientSubTab}
                setSubTab={setClientSubTab}
                onBack={() => setSelectedClientId(null)}
                onEditClient={() => {
                  setEditingClient(selectedClient);
                  setIsClientModalOpen(true);
                }}
                onDeleteClient={() =>
                  setDeleteConfirm({
                    type: 'client',
                    id: selectedClient.id,
                    title: selectedClient.name,
                  })
                }
                onAddVisit={() => {
                  setEditingVisit(null);
                  setIsVisitModalOpen(true);
                }}
                onEditVisit={(visit) => {
                  setEditingVisit(visit);
                  setIsVisitModalOpen(true);
                }}
                onDeleteVisit={(visit) =>
                  setDeleteConfirm({
                    type: 'visit',
                    id: visit.id,
                    title: visit.serviceName,
                  })
                }
                onOpenDocModal={() => setIsDocModalOpen(true)}
                onDeleteDoc={(docItem) =>
                  setDeleteConfirm({
                    type: 'document',
                    id: docItem.id,
                    title: docItem.title,
                  })
                }
                onOpenLightbox={setLightboxImage}
              />
            )}

            {activeTab === 'gallery' && (
              <PortfolioAndDocsView
                visits={visits}
                clients={clients}
                onOpenLightbox={setLightboxImage}
              />
            )}

            {activeTab === 'finances' && (
              <FinancesDashboardView visits={visits} />
            )}

            {activeTab === 'settings' && (
              <SalonSettingsView
                settings={salonSettings}
                onSave={handleSaveSalonSettings}
              />
            )}
          </>
        )}
      </main>

      {isClientModalOpen && (
        <ClientFormModal
          initialData={editingClient}
          onClose={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
          }}
          onSave={async (data) => {
            if (!user) return;
            const clientsRef = collection(
              db,
              'artifacts',
              appId,
              'public',
              'data',
              'clients'
            );
            if (editingClient) {
              await updateDoc(doc(clientsRef, editingClient.id), data);
              showToast('Zaktualizowano kartę klientki');
            } else {
              const docRef = await addDoc(clientsRef, {
                ...data,
                createdAt: new Date().toISOString(),
              });
              setSelectedClientId(docRef.id);
              showToast('Dodano nową klientkę');
            }
            setIsClientModalOpen(false);
            setEditingClient(null);
          }}
        />
      )}

      {isVisitModalOpen && (
        <VisitFormModal
          clients={clients}
          defaultClientId={selectedClientId}
          initialData={editingVisit}
          onClose={() => {
            setIsVisitModalOpen(false);
            setEditingVisit(null);
          }}
          onSave={async (data) => {
            if (!user) return;
            const visitsRef = collection(
              db,
              'artifacts',
              appId,
              'public',
              'data',
              'visits'
            );
            if (editingVisit) {
              await updateDoc(doc(visitsRef, editingVisit.id), data);
              showToast('Zaktualizowano wizytę');
            } else {
              await addDoc(visitsRef, {
                ...data,
                createdAt: new Date().toISOString(),
              });
              showToast('Zapisano stylizację');
            }
            setIsVisitModalOpen(false);
            setEditingVisit(null);
          }}
        />
      )}

      {isDocModalOpen && selectedClient && (
        <DocumentScannerModal
          client={selectedClient}
          onClose={() => setIsDocModalOpen(false)}
          onSave={async (docData) => {
            if (!user) return;
            const docsRef = collection(
              db,
              'artifacts',
              appId,
              'public',
              'data',
              'documents'
            );
            await addDoc(docsRef, {
              ...docData,
              clientId: selectedClient.id,
              createdAt: new Date().toISOString(),
            });
            setIsDocModalOpen(false);
            showToast('Zapisano dokument w karcie klientki');
          }}
        />
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt="Podgląd"
              className="max-h-[80vh] w-auto rounded-2xl"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="mt-4 px-6 py-2 bg-white rounded-xl text-sm font-bold"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-900 mb-2">
              Potwierdź usunięcie: {deleteConfirm.title}
            </h3>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-sm"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteExecute}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientProfileView({
  client,
  visits,
  documents,
  subTab,
  setSubTab,
  onBack,
  onEditClient,
  onDeleteClient,
  onAddVisit,
  onEditVisit,
  onDeleteVisit,
  onOpenDocModal,
  onDeleteDoc,
  onOpenLightbox,
}) {
  const totalSpent = visits.reduce((acc, v) => acc + (Number(v.price) || 0), 0);
  const allPhotos = visits.flatMap((v) =>
    (v.photos || []).map((url) => ({
      url,
      title: v.serviceName,
      subtitle: v.date,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-rose-600"
        >
          <ArrowLeft className="w-4 h-4" /> Wróć do bazy klientek
        </button>
        <div className="flex gap-2">
          <button
            onClick={onEditClient}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold"
          >
            Edytuj profil
          </button>
          <button
            onClick={onDeleteClient}
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-stone-900">
              {client.name}
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {client.phone} {client.instagram && `• @${client.instagram}`}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-rose-50/70 px-4 py-2 rounded-2xl text-center">
              <p className="text-[11px] uppercase text-rose-400 font-bold">
                Wizyty
              </p>
              <p className="text-lg font-bold text-rose-900">{visits.length}</p>
            </div>
            <div className="bg-stone-50 px-4 py-2 rounded-2xl text-center">
              <p className="text-[11px] uppercase text-stone-400 font-bold">
                Suma
              </p>
              <p className="text-lg font-bold text-stone-900">
                {totalSpent} zł
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-stone-100">
          <div className="bg-rose-50/40 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase text-rose-800 mb-1">
              Mapping Rzęs / Brwi
            </p>
            <p className="text-sm text-stone-700 whitespace-pre-line">
              {client.lashNotes || 'Brak zapisanego mappingu.'}
            </p>
          </div>
          <div className="bg-pink-50/40 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase text-pink-800 mb-1">
              Paznokcie (Baza / Kształt)
            </p>
            <p className="text-sm text-stone-700 whitespace-pre-line">
              {client.nailNotes || 'Brak preferencji.'}
            </p>
          </div>
          <div className="bg-amber-50/50 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase text-amber-900 mb-1">
              Alergie i Przeciwwskazania
            </p>
            <p className="text-sm text-stone-700 whitespace-pre-line">
              {client.allergies || 'Brak zgłoszonych alergii.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-stone-100 p-1 rounded-2xl">
          <button
            onClick={() => setSubTab('visits')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              subTab === 'visits' ? 'bg-white shadow-sm' : 'text-stone-600'
            }`}
          >
            Stylizacje ({visits.length})
          </button>
          <button
            onClick={() => setSubTab('photos')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              subTab === 'photos' ? 'bg-white shadow-sm' : 'text-stone-600'
            }`}
          >
            Zdjęcia ({allPhotos.length})
          </button>
          <button
            onClick={() => setSubTab('docs')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              subTab === 'docs' ? 'bg-white shadow-sm' : 'text-stone-600'
            }`}
          >
            Zgody i Skany ({documents.length})
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenDocModal}
            className="px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" /> Skanuj zgodę
          </button>
          <button
            onClick={onAddVisit}
            className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nowa stylizacja
          </button>
        </div>
      </div>

      {subTab === 'visits' && (
        <div className="space-y-4">
          {visits.map((visit) => (
            <div
              key={visit.id}
              className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col md:flex-row justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-400">
                    {visit.date}
                  </span>
                  <h4 className="text-base font-bold text-stone-900">
                    {visit.serviceName}
                  </h4>
                </div>
                {visit.description && (
                  <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-xl">
                    {visit.description}
                  </p>
                )}
                {visit.photos && visit.photos.length > 0 && (
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {visit.photos.map((photoUrl, idx) => (
                      <img
                        key={idx}
                        src={photoUrl}
                        alt="Stylizacja"
                        onClick={() => onOpenLightbox({ url: photoUrl })}
                        className="w-20 h-20 rounded-xl object-cover cursor-pointer border"
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex md:flex-col items-center md:items-end justify-between">
                <span className="text-xl font-serif font-bold text-stone-900">
                  {visit.price} zł
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onEditVisit(visit)}
                    className="p-2 text-stone-400 hover:text-stone-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteVisit(visit)}
                    className="p-2 text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'photos' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {allPhotos.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.title}
              onClick={() => onOpenLightbox(img)}
              className="aspect-square rounded-2xl object-cover cursor-pointer border border-rose-100"
            />
          ))}
        </div>
      )}

      {subTab === 'docs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((docItem) => (
            <div
              key={docItem.id}
              className="bg-white rounded-2xl p-4 border border-rose-100 flex gap-4 items-center"
            >
              {docItem.imageData && (
                <img
                  src={docItem.imageData}
                  alt={docItem.title}
                  onClick={() => onOpenLightbox({ url: docItem.imageData })}
                  className="w-20 h-24 object-cover rounded-xl border cursor-pointer"
                />
              )}
              <div className="flex-1">
                <h4 className="font-bold text-stone-900 text-sm">
                  {docItem.title}
                </h4>
                <p className="text-xs text-stone-400">{docItem.date}</p>
                <p className="text-xs text-stone-600 mt-1">{docItem.notes}</p>
              </div>
              <button
                onClick={() => onDeleteDoc(docItem)}
                className="text-stone-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioAndDocsView({ visits, clients, onOpenLightbox }) {
  const photos = visits.flatMap((v) => {
    const client = clients.find((c) => c.id === v.clientId);
    return (v.photos || []).map((url) => ({
      url,
      title: v.serviceName,
      subtitle: `${client ? client.name : 'Klientka'} • ${v.date}`,
    }));
  });
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif font-bold text-stone-900">
        Portfolio Stylizacji ({photos.length})
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onOpenLightbox(item)}
            className="aspect-square rounded-2xl overflow-hidden border border-rose-100 cursor-pointer bg-white"
          >
            <img
              src={item.url}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancesDashboardView({ visits }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const filtered = visits.filter((v) =>
    (v.date || '').startsWith(selectedMonth)
  );
  const totalRevenue = filtered.reduce(
    (sum, v) => sum + (Number(v.price) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif font-bold text-stone-900">
          Podsumowanie Finansowe
        </h2>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-200 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-3xl p-6 shadow-md">
          <span className="text-xs uppercase text-rose-100">
            Przychód w miesiącu
          </span>
          <p className="text-3xl font-serif font-bold mt-2">
            {totalRevenue} zł
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-rose-100">
          <span className="text-xs uppercase text-stone-400">
            Liczba stylizacji
          </span>
          <p className="text-3xl font-serif font-bold mt-2">
            {filtered.length}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-rose-100">
          <span className="text-xs uppercase text-stone-400">
            Średni paragon
          </span>
          <p className="text-3xl font-serif font-bold mt-2">
            {filtered.length ? Math.round(totalRevenue / filtered.length) : 0}{' '}
            zł
          </p>
        </div>
      </div>
    </div>
  );
}

function SalonSettingsView({ settings, onSave }) {
  const [form, setForm] = useState(settings);
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file, 400, 0.85, false);
    setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-serif font-bold text-stone-900">
        Ustawienia Salonu (Logo i Nazwa)
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-3xl p-6 border border-rose-100 space-y-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-rose-100 flex items-center justify-center overflow-hidden">
            {form.logoDataUrl ? (
              <img
                src={form.logoDataUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <Sparkles className="w-8 h-8 text-rose-500" />
            )}
          </div>
          <label className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold cursor-pointer">
            Wgraj własne logo
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
              Pierwszy człon nazwy
            </label>
            <input
              type="text"
              value={form.brandMain}
              onChange={(e) => setForm({ ...form, brandMain: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
              Drugi człon (Różowy akcent)
            </label>
            <input
              type="text"
              value={form.brandAccent}
              onChange={(e) =>
                setForm({ ...form, brandAccent: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
          </div>
        </div>
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.pinEnabled}
              onChange={(e) =>
                setForm({ ...form, pinEnabled: e.target.checked })
              }
            />
            Wymagaj kodu PIN przy wejściu
          </label>
          {form.pinEnabled && (
            <input
              type="text"
              value={form.pinCode}
              onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
              placeholder="Kod PIN"
              className="px-3 py-1.5 rounded-xl border text-sm w-32 text-center font-bold"
            />
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-rose-500 text-white text-sm font-semibold"
        >
          Zapisz ustawienia w chmurze
        </button>
      </form>
    </div>
  );
}

function ClientFormModal({ initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    instagram: initialData?.instagram || '',
    lashNotes: initialData?.lashNotes || '',
    nailNotes: initialData?.nailNotes || '',
    allergies: initialData?.allergies || '',
  });
  return (
    <div className="fixed inset-0 z-40 bg-stone-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">
          {initialData ? 'Edytuj Klientkę' : 'Nowa Klientka'}
        </h3>
        <input
          required
          placeholder="Imię i nazwisko"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <input
          placeholder="Telefon"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <input
          placeholder="Instagram"
          value={form.instagram}
          onChange={(e) => setForm({ ...form, instagram: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <textarea
          placeholder="Mapping Rzęs / Brwi (skręt, grubość, długości)"
          value={form.lashNotes}
          onChange={(e) => setForm({ ...form, lashNotes: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border text-sm"
        />
        <textarea
          placeholder="Preferencje Paznokci (kształt, baza, kolory)"
          value={form.nailNotes}
          onChange={(e) => setForm({ ...form, nailNotes: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border text-sm"
        />
        <textarea
          placeholder="Alergie / Przeciwwskazania"
          value={form.allergies}
          onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border text-sm"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-100 text-sm"
          >
            Anuluj
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-5 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitFormModal({
  clients,
  defaultClientId,
  initialData,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    clientId: initialData?.clientId || defaultClientId || clients[0]?.id || '',
    date: initialData?.date || new Date().toISOString().slice(0, 10),
    serviceName: initialData?.serviceName || 'Stylizacja Rzęs',
    price: initialData?.price || '',
    description: initialData?.description || '',
    photos: initialData?.photos || [],
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    const compressed = [];
    for (const file of files) {
      compressed.push(await compressImage(file, 900, 0.65, false));
    }
    setForm((prev) => ({ ...prev, photos: [...prev.photos, ...compressed] }));
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">Dodaj Stylizację</h3>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <input
          placeholder="Nazwa usługi (np. Rzęsy 2-3D, Manicure Hybrydowy)"
          value={form.serviceName}
          onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <input
          type="number"
          placeholder="Kwota (PLN)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold"
        />
        <textarea
          placeholder="Użyte produkty, kolory, mapka..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3.5 py-2 rounded-xl border text-sm"
        />
        <label className="block p-3 border-2 border-dashed border-rose-200 rounded-xl text-center text-xs font-semibold text-rose-600 cursor-pointer">
          + Dodaj zdjęcia stylizacji (Aparat / Galeria)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-100 text-sm"
          >
            Anuluj
          </button>
          <button
            onClick={() => onSave({ ...form, price: Number(form.price) || 0 })}
            className="px-5 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold"
          >
            Zapisz wizytę
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentScannerModal({ client, onClose, onSave }) {
  const [title, setTitle] = useState('Karta Zgody Klientki');
  const [notes, setNotes] = useState('');
  const [scannedImage, setScannedImage] = useState(null);

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannedImage(await compressImage(file, 1000, 0.7, true));
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">Skaner Zgód – {client.name}</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
        />
        <label className="block p-6 border-2 border-dashed border-rose-200 rounded-2xl text-center text-sm font-semibold text-rose-600 cursor-pointer">
          Zrób zdjęcie dokumentu / Wgraj skan
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleScanFile}
            className="hidden"
          />
        </label>
        {scannedImage && (
          <img
            src={scannedImage}
            alt="Skan"
            className="max-h-48 mx-auto rounded-xl border"
          />
        )}
        <textarea
          placeholder="Dodatkowe uwagi..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border text-sm"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-100 text-sm"
          >
            Anuluj
          </button>
          <button
            onClick={() =>
              onSave({
                title,
                date: new Date().toISOString().slice(0, 10),
                notes,
                imageData: scannedImage,
              })
            }
            className="px-5 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold"
          >
            Zapisz dokument
          </button>
        </div>
      </div>
    </div>
  );
}
