import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, GraduationCap, ArrowRight, LogIn, LogOut, User as UserIcon, Trophy, X, UserCircle } from 'lucide-react';
import { auth, signInWithGoogle, logout, loginAnonymously, db, handleFirestoreError, OperationType, getLeaderboard } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

// --- Types ---
interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface SchoolItem {
  id: string;
  label: string;
  isHappy: boolean;
  cost: number;
  image?: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    question: "Onde devemos jogar o papel de bala?",
    options: ["No chão", "No lixo", "Embaixo da mesa", "No pátio"],
    correctIndex: 1
  },
  {
    question: "O que fazemos quando um amigo precisa de um lápis?",
    options: ["Escondemos o lápis", "Gritamos com ele", "Emprestamos", "Quebramos o lápis"],
    correctIndex: 2
  },
  {
    question: "Como devemos entrar na sala de aula?",
    options: ["Correndo muito", "Em silêncio e calma", "Empurrando", "Gritando"],
    correctIndex: 1
  },
  {
    question: "O que dizemos quando recebemos uma ajuda?",
    options: ["Nada", "Sai daqui", "Obrigado!", "Me dá mais"],
    correctIndex: 2
  },
  {
    question: "Como devemos tratar os nossos colegas?",
    options: ["Com brigas", "Com respeito", "Ignorando", "Fazendo careta"],
    correctIndex: 1
  },
  {
    question: "O que fazemos quando a professora está falando?",
    options: ["Dormimos", "Ouvimos com atenção", "Conversamos", "Brincamos"],
    correctIndex: 1
  },
  {
    question: "Como deixamos a nossa mesa na escola?",
    options: ["Toda riscada", "Cheia de lixo", "Organizada e limpa", "Bagunçada"],
    correctIndex: 2
  },
  {
    question: "Qual dessas opções ajuda a manter a escola bem cuidada?",
    options: ["Ser gentil", "Jogar lixo", "Estragar brinquedos", "Falar alto"],
    correctIndex: 0
  },
  {
    question: "O que devemos fazer antes de falar na sala de aula?",
    options: ["Gritar muito alto", "Levantar a mão", "Subir na cadeira", "Chorar"],
    correctIndex: 1
  },
  {
    question: "Como devemos usar os brinquedos ou materiais da escola?",
    options: ["Quebrar tudo", "Esconder na mochila", "Dividir com os amigos", "Jogar no lixo"],
    correctIndex: 2
  },
  {
    question: "O que é legal fazer quando chegamos na escola?",
    options: ["Ficar de cara amarrada", "Dar bom dia", "Ignorar todo mundo", "Sair correndo"],
    correctIndex: 1
  },
  {
    question: "Se machucarmos um colega sem querer, o que devemos dizer?",
    options: ["Bem feito!", "Eu não ligo", "Desculpa", "Sai da frente"],
    correctIndex: 2
  },
  {
    question: "Quando usamos o banheiro da escola, o que devemos fazer depois?",
    options: ["Deixar a torneira aberta", "Lavar as mãos", "Riscar a parede", "Sair correndo"],
    correctIndex: 1
  },
  {
    question: "Como devemos tratar as outras pessoas que trabalham na escola (porteiro, tia da cantina)?",
    options: ["Com falta de educação", "Fingir que não existem", "Com carinho e respeito", "Fazer bagunça para eles limparem"],
    correctIndex: 2
  },
  {
    question: "O que é mais legal fazer na hora do recreio?",
    options: ["Brigar por espaço", "Incluir todos nas brincadeiras", "Ficar emburrado", "Pegar o lanche do colega"],
    correctIndex: 1
  },
  {
    question: "Se encontrarmos um casaco ou estojo perdido na escola, o que fazemos?",
    options: ["Levamos para nossa casa", "Escondemos", "Entregamos para a professora", "Jogamos no lixo"],
    correctIndex: 2
  },
  {
    question: "Na hora do lanche, como devemos nos comportar?",
    options: ["Jogar comida no colega", "Comer sentado e não desperdiçar", "Gritar com a boca cheia", "Derrubar o prato no chão"],
    correctIndex: 1
  },
  {
    question: "O que fazemos quando a aula acaba e vamos embora?",
    options: ["Deixamos a sala toda suja", "Arrumamos nossas coisas e damos tchau", "Saímos correndo e empurrando", "Esquecemos a mochila de propósito"],
    correctIndex: 1
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'quiz' | 'school'>('quiz');
  const [magicPoints, setMagicPoints] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [pendingNext, setPendingNext] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [items, setItems] = useState<SchoolItem[]>([
    { id: 'renovacao', label: 'Nova Sala (Reforma Geral)', isHappy: false, cost: 3 },
    { id: 'carteiras', label: 'Carteiras Escolares', isHappy: false, cost: 2, image: 'carteiras_escolares.png' },
    { id: 'lousa', label: 'Lousa Acadêmica', isHappy: false, cost: 2, image: 'lousa.png' },
    { id: 'iniciar_aulas', label: 'Manutenção Concluída', isHappy: false, cost: 5 },
  ]);

  // Auth & State Sync
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMagicPoints(data.magicPoints ?? 0);
        setQuizIndex(data.quizIndex ?? 0);
        const transformedIds = data.transformedItems || [];
        setItems(prev => prev.map(item => ({
          ...item,
          isHappy: transformedIds.includes(item.id)
        })));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const fetchLeaderboard = async () => {
    if (loadingLeaderboard) return;
    setLoadingLeaderboard(true);
    try {
      const data = await getLeaderboard();
      setLeaderboardData(data);
      setShowLeaderboard(true);
    } catch (e) {
      console.error("Error fetching leaderboard", e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const saveToFirebase = async (points: number, index: number, updatedItems: SchoolItem[]) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const hasFinishedClass = updatedItems.find(i => i.id === 'iniciar_aulas')?.isHappy || false;
    try {
      await setDoc(userRef, {
        magicPoints: points,
        quizIndex: index,
        transformedItems: updatedItems.filter(i => i.isHappy).map(i => i.id),
        hasFinished: hasFinishedClass,
        lastUpdated: serverTimestamp(),
        displayName: user.displayName || (user.isAnonymous ? "Curioso Anônimo" : "Explorador"),
        photoURL: user.photoURL || ""
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const playUISound = (type: 'click' | 'success') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1567.98, now + 0.05);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0.05, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context blocked", e);
    }
  };

  const handleQuizAnswer = (index: number) => {
    if (pendingNext) return;
    playUISound('click');

    if (index === QUESTIONS[quizIndex].correctIndex) {
      setPendingNext(true);
      playUISound('success');
      const newPoints = magicPoints + 1;
      let nextIndex = quizIndex + 1;
      if (nextIndex >= QUESTIONS.length) nextIndex = 0;

      setMagicPoints(newPoints);
      setFeedback({ type: 'success', message: 'Ótima atitude! +1 Ponto de Cuidado ❤️' });
      
      saveToFirebase(newPoints, nextIndex, items);

      setTimeout(() => {
        setFeedback(null);
        setPendingNext(false);
        setQuizIndex(nextIndex);
      }, 1500);
    } else {
      setMagicPoints(0);
      saveToFirebase(0, quizIndex, items);
      setFeedback({ type: 'error', message: 'Cuidado! Pontos zerados! 🌸' });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const playSiren = () => {
    const audio = new Audio('/sirene.mp3');
    audio.play().catch(e => console.error("Audio play failed:", e));
  };

  const transformItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.isHappy) return;

    const isCleaned = items.find(i => i.id === 'renovacao')?.isHappy;
    if (id !== 'renovacao' && !isCleaned) {
      setFeedback({ type: 'error', message: 'Limpe a sala primeiro! ✨' });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const otherItemsRestored = items.filter(i => i.id !== 'iniciar_aulas').every(i => i.isHappy);
    if (id === 'iniciar_aulas' && !otherItemsRestored) {
      playUISound('click');
      setFeedback({ type: 'error', message: 'Restaure tudo antes de começar! 🏫' });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    if (magicPoints >= item.cost) {
      const newPoints = magicPoints - item.cost;
      const newItems = items.map(i => i.id === id ? { ...i, isHappy: true } : i);
      
      setMagicPoints(newPoints);
      setItems(newItems);
      saveToFirebase(newPoints, quizIndex, newItems);
      
      if (id === 'iniciar_aulas') {
        playSiren();
        setFeedback({ type: 'success', message: `MISSÃO CUMPRIDA! Escola pronta para o uso! 🔔` });
      } else {
        playUISound('success');
        setFeedback({ type: 'success', message: `${item.label} realizado com sucesso! ❤️` });
      }
      
      setTimeout(() => setFeedback(null), 1500);
    } else {
      setFeedback({ type: 'error', message: `Você precisa de ${item.cost} Pontos de Cuidado!` });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const isCleaned = items.find(i => i.id === 'renovacao')?.isHappy;
  const isClassStarted = items.find(i => i.id === 'iniciar_aulas')?.isHappy;

  if (loadingAuth) {
    return (
      <div className="fixed inset-0 bg-[#E0F2F1] flex items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-[#E0F2F1] bg-gradient-to-b from-[#E0F2F1] to-[#E3F2FD] flex flex-col items-center justify-center font-sans p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-white border-4 border-black p-8 rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="w-24 h-24 bg-emerald-400 border-4 border-black rounded-full mx-auto flex items-center justify-center text-5xl mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            🏫
          </div>
          <h1 className="text-3xl font-black mb-2 leading-none uppercase italic tracking-tight">
            A Escola Mágica
          </h1>
          <p className="font-bold text-stone-500 mb-8 uppercase text-xs tracking-widest">
            Aprenda a cuidar do que é nosso!
          </p>
          
          <div className="flex flex-col gap-4">
            <button
              onClick={signInWithGoogle}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-4 border-black py-4 rounded-3xl font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <LogIn className="w-6 h-6" /> ENTRAR COM GOOGLE
            </button>

            <button
              onClick={async () => {
                try {
                  await loginAnonymously();
                } catch (e: any) {
                  if (e.code === 'auth/admin-restricted-operation') {
                    setFeedback({ type: 'error', message: 'Habilite o Modo Anônimo no Firebase Console!' });
                  } else {
                    setFeedback({ type: 'error', message: 'Erro ao entrar como convidado.' });
                  }
                }
              }}
              className="w-full bg-white hover:bg-stone-50 text-stone-900 border-4 border-black py-4 rounded-3xl font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <UserCircle className="w-6 h-6" /> JOGAR COMO CONVIDADO
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#E0F2F1] bg-gradient-to-b from-[#E0F2F1] to-[#E3F2FD] flex flex-col items-center justify-start font-sans overflow-hidden p-4 select-none">
      
      {/* Header HUD */}
      <div className="w-full max-w-md bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-3 mb-3 sm:mb-6 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-400 border-2 border-black p-1 rounded-lg">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-black text-lg tracking-tight">CUIDADO: {magicPoints}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchLeaderboard}
            disabled={loadingLeaderboard}
            className={`p-1 hover:bg-amber-50 rounded-lg transition-colors border-2 border-transparent hover:border-black ${loadingLeaderboard ? 'opacity-50 cursor-wait' : ''}`}
            title="Ranking"
          >
            <Trophy className={`w-5 h-5 text-amber-500 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
          </button>

          <button 
            onClick={logout}
            className="p-1 hover:bg-red-50 rounded-lg transition-colors border-2 border-transparent hover:border-black"
            title="Sair"
          >
            <LogOut className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-sky-500 border-2 border-black p-1 rounded-lg">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">{items.filter(i => i.isHappy).length}/{items.length}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentScreen === 'quiz' ? (
          <motion.div 
            key="quiz"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="w-full max-w-md flex-1 flex flex-col gap-4 overflow-hidden"
          >
            <div className="bg-white border-4 border-black p-4 sm:p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-x justify-between items-center mb-3 hidden sm:flex">
                <div className="flex items-center gap-2">
                   {user.photoURL ? (
                     <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border-2 border-black" referrerPolicy="no-referrer" />
                   ) : (
                     <UserIcon className="w-6 h-6" />
                   )}
                   <span className="font-black text-[10px] uppercase">{user.displayName || "Convidado"}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <h2 className="text-xl sm:text-2xl font-black mb-4 sm:mb-8 leading-tight text-center">
                  {QUESTIONS[quizIndex].question}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {QUESTIONS[quizIndex].options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuizAnswer(idx)}
                      disabled={pendingNext}
                      className={`bg-white hover:bg-yellow-50 border-4 border-black py-3 sm:py-4 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center flex items-center justify-center min-h-[60px] sm:min-h-[80px] ${pendingNext ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                playUISound('click');
                setCurrentScreen('school');
              }}
              className="bg-emerald-500 hover:bg-emerald-600 border-4 border-black py-3 sm:py-4 rounded-3xl font-black text-lg sm:text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 shrink-0 text-white"
            >
              CUIDAR DA ESCOLA <Heart className="fill-white" />
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="school"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="w-full max-w-md flex-1 flex flex-col gap-4 overflow-hidden"
          >
            {/* Visual Classroom Scene */}
            <div className="relative bg-stone-800 border-4 border-black rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-1 min-h-0 overflow-hidden">
              
              <img 
                src={isCleaned ? "sala_depois.png" : "sala_antes.png"} 
                alt="Escola" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              {!isCleaned && (
                <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
                   <div className="text-white text-center">
                     <span className="font-black text-4xl block mb-2 transform -rotate-6">SALA ANTIGA</span>
                     <span className="text-sm font-bold opacity-70">Aguardando reforma...</span>
                   </div>
                </div>
              )}

              {items.map(item => (
                item.image && item.isHappy && (
                  <motion.img
                    key={item.id}
                    src={item.image}
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )
              ))}

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-20">
                <div className="flex flex-wrap gap-2 justify-center">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => transformItem(item.id)}
                      disabled={item.isHappy || (item.id !== 'renovacao' && !isCleaned) || (item.id === 'iniciar_aulas' && !items.filter(i => i.id !== 'iniciar_aulas').every(i => i.isHappy))}
                      className={`px-3 py-2 rounded-xl border-2 border-black font-black text-[10px] uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 ${
                        item.isHappy 
                          ? 'bg-emerald-400 opacity-50 cursor-default' 
                          : ((item.id !== 'renovacao' && !isCleaned) || (item.id === 'iniciar_aulas' && !items.filter(i => i.id !== 'iniciar_aulas').every(i => i.isHappy)))
                            ? 'bg-stone-500 opacity-30 cursor-not-allowed'
                            : 'bg-white hover:bg-sky-50'
                      }`}
                    >
                      {item.isHappy ? `✓ ${item.label}` : `${item.label} (${item.cost} ❤️)`}
                    </button>
                  ))}
                </div>
              </div>

              {isClassStarted && (
                <motion.div 
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center text-center p-6"
                 >
                   <div className="w-24 h-24 bg-emerald-400 border-4 border-black rounded-full flex items-center justify-center text-5xl mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                     🏫
                   </div>
                   <h2 className="text-4xl font-black text-emerald-600 leading-none mb-2 uppercase italic">AULA INICIADA!</h2>
                   <p className="font-bold text-stone-700 leading-tight mb-6">Nossa escola está impecável. Cuidar dela é dever de todos!</p>
                   <button 
                     onClick={() => {
                       const resetItems = items.map(i => ({ ...i, isHappy: false }));
                       setItems(resetItems);
                       setMagicPoints(0);
                       setQuizIndex(0);
                       saveToFirebase(0, 0, resetItems);
                       setCurrentScreen('quiz');
                     }}
                     className="bg-sky-500 text-white border-4 border-black px-6 py-3 rounded-full font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                   >
                     RECOMEÇAR JORNADA
                   </button>
                 </motion.div>
               )}
            </div>

            <button
               onClick={() => {
                 playUISound('click');
                 setCurrentScreen('quiz');
               }}
               className="bg-sky-300 hover:bg-sky-400 border-4 border-black py-3 sm:py-4 rounded-3xl font-black text-base sm:text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all shrink-0"
             >
               VOLTAR PARA AS PERGUNTAS
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaderboard(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white border-8 border-black rounded-[40px] p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-h-[80vh] flex flex-col"
            >
              <button 
                onClick={() => setShowLeaderboard(false)}
                className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center justify-center gap-3 mb-6">
                <Trophy className="w-8 h-8 text-amber-500" />
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Ranking</h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {leaderboardData.length > 0 ? (
                  leaderboardData.map((leader, i) => (
                    <div 
                      key={leader.id}
                      className={`flex items-center gap-3 p-3 border-4 border-black rounded-2xl ${
                        leader.id === user.uid ? 'bg-amber-100' : 'bg-white'
                      }`}
                    >
                      <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-black text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="font-black truncate uppercase text-sm text-stone-800">
                          {leader.displayName || "Curioso"}
                        </p>
                        {leader.hasFinished && (
                          <div className="bg-emerald-500 text-white rounded-full p-1" title="Escola Renovada!">
                            <GraduationCap className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 bg-red-400 border-2 border-black px-2 py-0.5 rounded-full">
                         <Heart className="w-3 h-3 text-white fill-current" />
                         <span className="text-xs font-black text-white">{leader.magicPoints}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-stone-50 border-4 border-dashed border-stone-300 rounded-[30px] p-8 text-center">
                    <div className="text-4xl mb-4 opacity-50">✨</div>
                    <p className="font-bold text-stone-500 text-sm leading-relaxed">
                      Para aparecer no ranking é preciso cuidar da escola e fazer melhorias na escola!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-auto py-2">
        <p className="text-black/40 text-[10px] font-black uppercase tracking-[0.2em] text-center">
          Nossa Escola, Nosso Cuidado • {user.displayName || "MODO CONVIDADO"}
        </p>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-10 px-6 py-3 border-4 border-black rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 ${
              feedback.type === 'success' ? 'bg-emerald-400 text-black' : 'bg-orange-400 text-white'
            }`}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
