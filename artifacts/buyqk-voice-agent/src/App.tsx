import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Headphones,
  Laptop,
  Mic,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Watch,
  Zap,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Role = 'agent' | 'you';
type VoiceLanguage = 'english' | 'hindi' | 'hinglish';

type Product = {
  id: string;
  name: string;
  detail: string;
  price: number;
  rating: string;
  art: 'green' | 'orange' | 'blue';
  icon: typeof Headphones;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Message = {
  id: number;
  role: Role;
  text: string;
  time: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type BrowserRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type BrowserRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

const voiceLanguages: Record<VoiceLanguage, { label: string; recognitionLang: string; speechLang: string }> = {
  english: { label: 'English', recognitionLang: 'en-IN', speechLang: 'en-IN' },
  hindi: { label: 'हिन्दी', recognitionLang: 'hi-IN', speechLang: 'hi-IN' },
  hinglish: { label: 'Hinglish', recognitionLang: 'en-IN', speechLang: 'hi-IN' },
};

const responseCopy: Record<
  VoiceLanguage,
  { listening: string; paused: string; headphone: string; cart: string; fallback: string }
> = {
  english: {
    listening: 'I’m listening. Tell me what you need, in your own words.',
    paused: 'I’ve paused the session. Tap the signal when you’re ready to continue.',
    headphone: 'That sounds like the QuietCore Studio match I remembered. I’ve kept your ₹20,000 ceiling and comfort preference in view.',
    cart: 'Your cart is ready. I’ll ask before placing any order.',
    fallback: 'Got it. I’ll use that as context while I narrow down the next best options.',
  },
  hindi: {
    listening: 'मैं सुन रही हूँ। अपनी ज़रूरत के बारे में बताइए।',
    paused: 'मैंने सेशन रोक दिया है। दोबारा शुरू करने के लिए माइक बटन दबाइए।',
    headphone: 'QuietCore Studio आपके लिए एक अच्छा विकल्प है। मैंने आपका ₹20,000 का बजट और आराम की पसंद ध्यान में रखी है।',
    cart: 'आपका कार्ट तैयार है। ऑर्डर करने से पहले मैं आपकी अनुमति लूँगी।',
    fallback: 'समझ गई। अगले बेहतर विकल्प ढूँढ़ते समय मैं इस जानकारी को ध्यान में रखूँगी।',
  },
  hinglish: {
    listening: 'Main sun rahi hoon. Aap apni zaroorat ke baare mein bataiye.',
    paused: 'Maine session pause kar diya hai. Dobara shuru karne ke liye mic button tap kijiye.',
    headphone: 'QuietCore Studio aapke liye ek accha option hai. Aapka ₹20,000 ka budget aur comfort preference maine note kar li hai.',
    cart: 'Aapka cart ready hai. Order place karne se pehle main aapki permission loongi.',
    fallback: 'Samajh gayi. Agle best options dhoondhte waqt main is information ko dhyan mein rakhungi.',
  },
};

const queryClient = new QueryClient();

const products: Product[] = [
  {
    id: 'quietcore',
    name: 'QuietCore Studio',
    detail: 'Adaptive noise-canceling headphones',
    price: 15999,
    rating: '4.8',
    art: 'green',
    icon: Headphones,
  },
  {
    id: 'airbook',
    name: 'AirBook 14',
    detail: 'Lightweight laptop · 16GB memory',
    price: 69999,
    rating: '4.7',
    art: 'blue',
    icon: Laptop,
  },
  {
    id: 'tempo',
    name: 'Tempo Loop',
    detail: 'Minimal fitness watch · graphite',
    price: 10999,
    rating: '4.6',
    art: 'orange',
    icon: Watch,
  },
];

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function nowTime() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={Home} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function Home() {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [language, setLanguage] = useState<VoiceLanguage>('english');
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resultProducts, setResultProducts] = useState<Product[]>(products);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [toast, setToast] = useState('');
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const languageRef = useRef<VoiceLanguage>('english');
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsObjectUrlRef = useRef('');
  const ttsRequestRef = useRef(0);
  const isSpeakingRef = useRef(false);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addMessage = (role: Role, text: string) => {
    setMessages((current) => [...current, { id: Date.now(), role, text, time: nowTime() }]);
  };

  const stopGeneratedSpeech = () => {
    isSpeakingRef.current = false;
    ttsRequestRef.current += 1;
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = '';
    }
    window.speechSynthesis?.cancel();
  };

  const speakWithGemini = async (text: string) => {
    stopGeneratedSpeech();
    const requestId = ttsRequestRef.current;
    isSpeakingRef.current = true;
    setToast('BuyQK is generating audio...');

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || requestId !== ttsRequestRef.current) {
        throw new Error('Gemini TTS request failed');
      }

      const audioUrl = URL.createObjectURL(await response.blob());
      if (requestId !== ttsRequestRef.current) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;
      ttsObjectUrlRef.current = audioUrl;
      audio.onended = () => {
        if (ttsObjectUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          ttsObjectUrlRef.current = '';
          ttsAudioRef.current = null;
        }
        window.setTimeout(() => {
          isSpeakingRef.current = false;
        }, 500);
      };
      audio.onerror = () => {
        isSpeakingRef.current = false;
      };
      await audio.play();
    } catch {
      if (requestId !== ttsRequestRef.current) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLanguages[languageRef.current].speechLang;
      utterance.rate = 1.03;
      utterance.pitch = 1;
      utterance.onend = () => {
        window.setTimeout(() => {
          isSpeakingRef.current = false;
        }, 500);
      };
      utterance.onerror = () => {
        isSpeakingRef.current = false;
      };
      window.speechSynthesis?.speak(utterance);
      setToast('Gemini voice unavailable — using browser fallback');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
      stopGeneratedSpeech();
      addMessage('agent', responseCopy[language].paused);
      setToast('Voice session paused');
      return;
    }
    if (!speechSupported || !recognitionRef.current) {
      setToast('Live voice is not supported here — use text fallback');
      return;
    }

    keepListeningRef.current = true;
    setIsListening(true);
    addMessage('agent', responseCopy[language].listening);
    setToast('BuyQK is listening');
    try {
      recognitionRef.current.start();
    } catch {
      keepListeningRef.current = false;
      setIsListening(false);
      setToast('The microphone is already in use — try again in a moment');
    }
  };

  const sendMessage = (value: string, fromVoice = false) => {
    const clean = value.trim();
    if (!clean) return;
    addMessage('you', clean);
    setDraft('');
    const respond = (text: string, speechText = text) => {
      addMessage('agent', text);
      if (fromVoice) {
        void speakWithGemini(speechText);
      }
    };
    const lower = clean.toLowerCase();
    const currentLanguage = languageRef.current;
    const normalizedRequest = lower.replace(/[^a-z0-9]+/g, '');
    const productMatch = products.find((product) => {
      const normalizedName = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const productWords = product.name.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
      return normalizedRequest.includes(normalizedName) || productWords.some((word) => lower.includes(word));
    });

    if (productMatch) {
      setResultProducts([productMatch]);
      setSearchTerm(productMatch.name);
      if (currentLanguage === 'hindi') {
        respond(`${productMatch.name} आपके लिए शेल्फ पर दिखा दिया है। आप इसे कार्ट में जोड़ सकते हैं।`);
      } else if (currentLanguage === 'hinglish') {
        respond(
          `${productMatch.name} shelf par show kar diya hai. Aap ise cart mein add kar sakte hain.`,
          `${productMatch.name} शेल्फ पर शो कर दिया है। आप इसे कार्ट में ऐड कर सकते हैं।`,
        );
      } else {
        respond(`${productMatch.name} is now showing on the shelf. You can add it to your cart when you’re ready.`);
      }
    } else if (lower.includes('headphone') || lower.includes('flight') || lower.includes('quiet')) {
      respond(responseCopy[currentLanguage].headphone);
      setSearchTerm('comfortable noise-canceling headphones');
      setResultProducts(products.filter((product) => product.id === 'quietcore'));
    } else if (lower.includes('cart') || lower.includes('checkout')) {
      respond(responseCopy[currentLanguage].cart);
      setCheckoutRequested(true);
    } else {
      respond(responseCopy[currentLanguage].fallback);
    }
  };

  useEffect(() => {
    const recognitionConstructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!recognitionConstructor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new recognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLanguages[language].recognitionLang;
    recognition.onresult = (event) => {
      if (isSpeakingRef.current) {
        setInterimTranscript('');
        return;
      }
      let interim = '';
      let finalText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }

      setInterimTranscript(interim.trim());
      if (finalText.trim()) {
        const textToSend = finalText.trim();
        setInterimTranscript('');
        // Stop microphone immediately so laptop speaker audio is never re-captured!
        isSpeakingRef.current = true;
        keepListeningRef.current = false;
        setIsListening(false);
        try {
          recognition.stop();
        } catch {}
        sendMessage(textToSend, true);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        keepListeningRef.current = false;
        setIsListening(false);
        setToast('Microphone access is blocked — use text fallback');
      } else if (event.error === 'audio-capture') {
        keepListeningRef.current = false;
        setIsListening(false);
        setToast('No microphone input was detected — check your mic and try again');
      } else if (event.error === 'language-not-supported') {
        keepListeningRef.current = false;
        setIsListening(false);
        setToast('This browser does not support the selected voice language');
      } else {
        setToast('Voice input had a hiccup — keep speaking or try again');
      }
    };
    recognition.onend = () => {
      if (keepListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // The browser may still be closing the previous audio session.
        }
      } else {
        setIsListening(false);
        setInterimTranscript('');
      }
    };
    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      recognition.stop();
      stopGeneratedSpeech();
    };
  }, []);

  const changeLanguage = (nextLanguage: VoiceLanguage) => {
    languageRef.current = nextLanguage;
    setLanguage(nextLanguage);
    if (recognitionRef.current) {
      recognitionRef.current.lang = voiceLanguages[nextLanguage].recognitionLang;
    }
    setToast(`${voiceLanguages[nextLanguage].label} voice selected`);
  };

  const runSearch = () => {
    if (!searchTerm.trim()) {
      setSearchError('Tell me what to look for first.');
      return;
    }
    setSearching(true);
    setSearchError('');
    window.setTimeout(() => {
      if (searchTerm.toLowerCase().includes('error')) {
        setSearching(false);
        setSearchError('I couldn’t reach the product shelf. Try that search again.');
        return;
      }
      setResultProducts(products);
      setSearching(false);
      addMessage('agent', `I found ${products.length} matches and sorted them around your saved preferences.`);
      setToast('Search refreshed');
    }, 680);
  };

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
    addMessage('agent', `${product.name} is in your cart. I’ll wait for your confirmation before checkout.`);
    setToast(`${product.name} added to cart`);
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const requestCheckout = () => {
    if (!cart.length) {
      setToast('Your cart is empty');
      return;
    }
    setCheckoutRequested(true);
    setOrderConfirmed(false);
    addMessage('agent', 'This is the moment where I need your okay. Review the order, then confirm when it looks right.');
  };

  const confirmOrder = () => {
    setCheckoutRequested(false);
    setOrderConfirmed(true);
    addMessage('agent', 'Confirmed. Your order request is ready to place. Nothing was submitted without your approval.');
    setToast('Order confirmed for review');
  };

  const clearSession = () => {
    keepListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
    stopGeneratedSpeech();
    setMessages([]);
    setCart([]);
    setSearchTerm('');
    setResultProducts(products);
    setSearchError('');
    setCheckoutRequested(false);
    setOrderConfirmed(false);
    setToast('Session cleared');
  };

  return (
    <div className="app-shell flex">
      <aside className="app-sidebar p-5">
        <div className="flex items-center gap-3 px-2">
          <div className="brand-mark" aria-hidden="true">
            <div className="brand-wave"><i /><i /><i /><i /><i /></div>
          </div>
          <div>
            <div className="text-[18px] font-extrabold tracking-[-0.04em] text-white">BuyQK</div>
            <div className="sidebar-label mt-1">voice commerce</div>
          </div>
        </div>

        <div className="sidebar-label mt-12 px-2">Live voice agent</div>
        <div className="nav-item active mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold">
          <Mic size={16} strokeWidth={1.8} />
          <span>Voice workspace</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        </div>

        <div className="sidebar-bottom mt-auto">
          <div className="status-card p-3.5">
            <div className="flex items-center gap-2">
              <span className="signal-dot" />
              <span className="text-[12px] font-bold text-[#d6fff3]">Live loop ready</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#9eb3b1]">
              Speak naturally and see the transcript update in real time. No account required.
            </p>
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar flex items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-8 w-8 place-items-center rounded-lg bg-[#e2e4fb] text-[#555681] sm:grid">
              <Mic size={15} />
            </div>
            <div className="min-w-0">
              <div className="eyebrow truncate">BuyQK / live voice</div>
              <h1 className="mt-1 truncate text-[16px] font-extrabold tracking-[-0.03em] text-[#282c45]">Real-time voice agent</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="language-switcher flex items-center gap-1 rounded-full border border-[#dce1ec] bg-white/65 p-1" role="group" aria-label="Voice language">
              {(Object.keys(voiceLanguages) as VoiceLanguage[]).map((option) => (
                <button
                  className={`language-option rounded-full px-2.5 py-1.5 text-[10px] font-bold ${language === option ? 'active' : ''}`}
                  data-testid={`button-language-${option}`}
                  key={option}
                  onClick={() => changeLanguage(option)}
                  type="button"
                >
                  {voiceLanguages[option].label}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[#dce1ec] bg-white/65 px-3 py-1.5 text-[10px] font-bold text-[#657087] sm:flex">
              <span className="signal-dot scale-75" />
              {speechSupported ? 'LIVE AUDIO READY' : 'TEXT FALLBACK'}
            </div>
          </div>
        </header>

        <WorkspaceView
          isListening={isListening}
          toggleListening={toggleListening}
          interimTranscript={interimTranscript}
          speechSupported={speechSupported}
          language={language}
          onLanguageChange={changeLanguage}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          sendMessage={sendMessage}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searching={searching}
          searchError={searchError}
          runSearch={runSearch}
          resultProducts={resultProducts}
          addToCart={addToCart}
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          changeQuantity={changeQuantity}
          checkoutRequested={checkoutRequested}
          orderConfirmed={orderConfirmed}
          requestCheckout={requestCheckout}
          confirmOrder={confirmOrder}
          setCheckoutRequested={setCheckoutRequested}
          clearSession={clearSession}
          toast={toast}
        />
      </main>
    </div>
  );
}

type WorkspaceProps = {
  isListening: boolean;
  toggleListening: () => void;
  interimTranscript: string;
  speechSupported: boolean;
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  messages: Message[];
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  searching: boolean;
  searchError: string;
  runSearch: () => void;
  resultProducts: Product[];
  addToCart: (product: Product) => void;
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  changeQuantity: (productId: string, delta: number) => void;
  checkoutRequested: boolean;
  orderConfirmed: boolean;
  requestCheckout: () => void;
  confirmOrder: () => void;
  setCheckoutRequested: (value: boolean) => void;
  clearSession: () => void;
  toast: string;
};

function WorkspaceView(props: WorkspaceProps) {
  const hasProductContext = props.searchTerm.trim().length > 0;

  return (
    <div className="view-wrap">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Understand · remember · decide · act</div>
          <h2 className="mt-2 max-w-xl text-[clamp(27px,3.1vw,42px)] font-extrabold leading-[1.02] tracking-[-0.065em] text-[#252a42]">
            A better way to shop,<br className="hidden sm:block" /> one thought at a time.
          </h2>
        </div>
        <button className="ghost-button flex items-center gap-2 self-start rounded-xl px-3 py-2 text-[12px] font-bold sm:self-auto" data-testid="button-clear-session" onClick={props.clearSession}>
          <Trash2 size={14} /> Clear session
        </button>
      </div>

      <div className="workspace-grid grid grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="min-w-0 space-y-5">
          <section className="session-hero min-h-[272px] p-6 sm:p-8">
            <div className="relative z-[1] flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-[450px]">
                <div className="glass-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px] font-bold">
                  <span className={`h-1.5 w-1.5 rounded-full ${props.isListening ? 'animate-pulse bg-[#f7c96a]' : 'bg-[#48e0b0]'}`} />
                  {props.isListening ? 'LIVE LISTENING' : 'READY WHEN YOU ARE'}
                </div>
                <h3 className="mt-5 text-[26px] font-extrabold leading-[1.08] tracking-[-0.055em] text-white sm:text-[31px]">
                  Speak naturally.<br /><span className="text-[#75e7c4]">I’ll keep up.</span>
                </h3>
                <p className="mt-3 max-w-[390px] text-[12px] leading-5 text-[#afb6ca]">
                  Ask for a product, change your mind, or pick up where you left off. Your context stays in the conversation.
                </p>
              </div>
              <div className="flex flex-col items-center self-center md:mr-8">
                <button
                  className={`voice-orb ${props.isListening ? 'listening' : ''}`}
                  data-testid="button-voice-session"
                  aria-label={props.isListening ? 'Stop voice session' : 'Start voice session'}
                  aria-pressed={props.isListening}
                  onClick={props.toggleListening}
                >
                  <div className="orb-bars"><span /><span /><span /><span /><span /></div>
                </button>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-[#aeb6cf]">
                  {props.isListening ? <Square size={10} fill="currentColor" /> : <Mic size={11} />}
                  {props.isListening ? 'TAP TO PAUSE' : 'TAP TO SPEAK'}
                </div>
              </div>
            </div>
            <div className="relative z-[1] mt-7 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-[10px] text-[#98a2bd]">
              <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-[#70e7c2]" /> Confirmation gates on</span>
              <span className="text-[#626b87]">·</span>
              <span className="flex items-center gap-1.5"><Volume2 size={12} /> {props.speechSupported ? 'Gemini voice + browser fallback' : 'Text fallback ready'}</span>
            </div>
          </section>

          <section className="content-card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Live transcript</div>
                <h3 className="mt-1 text-[16px] font-extrabold tracking-[-0.03em] text-[#2c3048]">The conversation so far</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#9098ab]">
                <Clock3 size={13} /> Today
              </div>
            </div>
            <div className="mt-5 max-h-[315px] space-y-4 overflow-y-auto pr-1">
              {props.messages.length ? props.messages.map((message) => (
                <div className={`transcript-row ${message.role === 'you' ? 'you' : ''}`} key={message.id} data-testid={`transcript-message-${message.id}`}>
                  <div className={`transcript-avatar ${message.role === 'you' ? 'you' : 'agent'}`}>
                    {message.role === 'you' ? 'AM' : 'BQ'}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-[#4f5870]">{message.role === 'you' ? 'You' : 'BuyQK'}</span>
                      <span className="text-[10px] text-[#a0a7b7]">{message.time}</span>
                    </div>
                    <div className="transcript-bubble px-3.5 py-2.5 text-[12px] leading-5">{message.text}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-[#d8dce8] p-8 text-center" data-testid="empty-transcript">
                  <Sparkles className="mx-auto text-[#9ea6bc]" size={21} />
                  <p className="mt-2 text-[12px] font-bold text-[#68728a]">A clean slate</p>
                  <p className="mt-1 text-[11px] text-[#9aa2b3]">Start speaking or type a thought below.</p>
                </div>
              )}
              {props.interimTranscript && (
                <div className="transcript-row" data-testid="transcript-interim">
                  <div className="transcript-avatar you">YOU</div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-[#4f5870]">Listening live</span>
                      <span className="live-wave" aria-hidden="true"><i /><i /><i /></span>
                    </div>
                    <div className="transcript-bubble interim-bubble px-3.5 py-2.5 text-[12px] leading-5">
                      {props.interimTranscript}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <form className="composer mt-5 flex items-center gap-2 rounded-xl p-1.5 pl-3" onSubmit={(event) => { event.preventDefault(); props.sendMessage(props.draft); }}>
              <input
                className="min-w-0 flex-1 px-1 text-[12px] text-[#3f465f] placeholder:text-[#a4abba]"
                data-testid="input-message-fallback"
                value={props.draft}
                onChange={(event) => props.setDraft(event.target.value)}
                placeholder="Type a message instead of speaking…"
                aria-label="Type a message instead"
              />
              <button className="primary-button grid h-9 w-9 place-items-center rounded-lg" data-testid="button-send-message" aria-label="Send message" type="submit">
                <Send size={14} />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Find travel headphones', 'What’s in my cart?', 'Remember this preference'].map((suggestion) => (
                <button
                  className="suggestion rounded-full px-3 py-1.5 text-[10px] font-semibold"
                  data-testid={`button-suggestion-${suggestion.toLowerCase().replace(/\W+/g, '-')}`}
                  key={suggestion}
                  onClick={() => props.sendMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>

          <section className="content-card p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="eyebrow">Act · product shelf</div>
                <h3 className="mt-1 text-[16px] font-extrabold tracking-[-0.03em] text-[#2c3048]">
                  {hasProductContext ? 'Matches for your current context' : 'Browse the product shelf'}
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[#9098ab]">
                {hasProductContext ? 'Updated just now' : 'Ready when you are'}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e0e3ed] bg-[#fafbfe] p-1.5">
              <Search className="ml-2 text-[#929bb0]" size={15} />
              <input
                className="min-w-0 flex-1 bg-transparent px-1 text-[12px] text-[#3f465f] outline-none placeholder:text-[#a4abba]"
                data-testid="input-product-search"
                value={props.searchTerm}
                onChange={(event) => props.setSearchTerm(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') props.runSearch(); }}
                placeholder="Search the shelf…"
                aria-label="Search products"
              />
              <button className="ghost-button rounded-lg px-3 py-2 text-[11px] font-bold" data-testid="button-search-products" onClick={props.runSearch}>
                Search
              </button>
            </div>
            {props.searchError && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#f4c6b6] bg-[#fff4ef] px-3 py-2 text-[11px] text-[#a7553d]" data-testid="status-search-error">
                <span>{props.searchError}</span><CircleHelp size={14} />
              </div>
            )}
            {props.searching ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="status-search-loading">
                {[1, 2, 3].map((item) => <div className="skeleton h-[224px] rounded-2xl" key={item} />)}
              </div>
            ) : props.resultProducts.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {props.resultProducts.map((product) => {
                  const Icon = product.icon;
                  return (
                    <article className="product-card p-2.5" key={product.id} data-testid={`card-product-${product.id}`}>
                      <div className={`product-art ${product.art === 'orange' ? 'orange' : product.art === 'blue' ? 'blue' : ''}`}>
                        <Icon size={41} strokeWidth={1.15} />
                      </div>
                      <div className="px-1 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[12px] font-extrabold leading-4 text-[#323750]">{product.name}</h4>
                          <span className="whitespace-nowrap text-[11px] font-extrabold text-[#303650]">{formatPrice(product.price)}</span>
                        </div>
                        <p className="mt-1 min-h-[30px] text-[10px] leading-4 text-[#7b8499]">{product.detail}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#b08743]">★ {product.rating}</span>
                          <button className="product-action rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold" data-testid={`button-add-${product.id}`} onClick={() => props.addToCart(product)}>
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#d8dce8] p-8 text-center" data-testid="empty-product-results">
                <Package className="mx-auto text-[#9ea6bc]" size={22} />
                <p className="mt-2 text-[12px] font-bold text-[#68728a]">No matches yet</p>
                <p className="mt-1 text-[11px] text-[#9aa2b3]">Try a broader phrase and I’ll keep your context.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="cart-panel min-w-0">
          <div className="content-card overflow-hidden lg:sticky lg:top-5">
            <div className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e6f9f2] text-[#2a8a6c]"><ShoppingBag size={15} /></div>
                <div>
                  <div className="eyebrow">Act · cart</div>
                  <h3 className="mt-1 text-[15px] font-extrabold text-[#2c3048]">Your cart</h3>
                </div>
              </div>
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#e7e8ff] px-1.5 text-[10px] font-extrabold text-[#555681]" data-testid="text-cart-count">{props.cartCount}</span>
            </div>
            <div className="px-5">
              {props.cart.length ? props.cart.map((item) => (
                <div className="cart-line flex gap-3 py-4" key={item.product.id} data-testid={`cart-item-${item.product.id}`}>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf8f4] text-[#3b8673]"><Headphones size={22} strokeWidth={1.2} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-[12px] font-extrabold text-[#343950]">{item.product.name}</span>
                      <span className="text-[12px] font-extrabold text-[#343950]">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#8a93a8]">Ships by Thursday</span>
                      <div className="qty-control flex items-center gap-2 rounded-lg px-1 py-0.5">
                        <button className="grid h-5 w-5 place-items-center rounded" data-testid={`button-decrease-${item.product.id}`} onClick={() => props.changeQuantity(item.product.id, -1)} aria-label={`Decrease ${item.product.name}`}><Minus size={11} /></button>
                        <span className="min-w-3 text-center text-[10px] font-bold">{item.quantity}</span>
                        <button className="grid h-5 w-5 place-items-center rounded" data-testid={`button-increase-${item.product.id}`} onClick={() => props.changeQuantity(item.product.id, 1)} aria-label={`Increase ${item.product.name}`}><Plus size={11} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center" data-testid="empty-cart">
                  <ShoppingBag className="mx-auto text-[#a2a9bb]" size={24} />
                  <p className="mt-3 text-[12px] font-bold text-[#68728a]">Your cart is waiting</p>
                  <p className="mt-1 text-[11px] text-[#9aa2b3]">Add a match to keep shopping.</p>
                </div>
              )}
              {props.cart.length > 0 && (
                <>
                  <div className="space-y-2 border-t border-[#edf0f5] py-4 text-[11px]">
                    <div className="flex justify-between text-[#7d869a]"><span>Subtotal</span><span>{formatPrice(props.cartTotal)}</span></div>
                    <div className="flex justify-between text-[#7d869a]"><span>Delivery</span><span className="font-bold text-[#298465]">Free</span></div>
                    <div className="flex justify-between pt-1 text-[14px] font-extrabold text-[#30354e]"><span>Total</span><span>{formatPrice(props.cartTotal)}</span></div>
                  </div>
                  {!props.checkoutRequested && !props.orderConfirmed && (
                    <button className="primary-button mb-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[12px] font-extrabold" data-testid="button-review-checkout" onClick={props.requestCheckout}>
                      Review & confirm <ArrowRight size={14} />
                    </button>
                  )}
                </>
              )}
              {props.checkoutRequested && (
                <div className="gate-card mb-5 rounded-xl p-3.5" data-testid="card-confirmation-gate">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 text-[#b27b20]"><ShieldCheck size={17} /></div>
                    <div>
                      <div className="text-[12px] font-extrabold text-[#55431f]">Your confirmation is needed</div>
                      <p className="mt-1 text-[10px] leading-4 text-[#8b754a]">BuyQK will not place this order until you say yes.</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="primary-button rounded-lg py-2 text-[10px] font-extrabold" data-testid="button-confirm-order" onClick={props.confirmOrder}>Confirm order</button>
                    <button className="ghost-button rounded-lg py-2 text-[10px] font-bold" data-testid="button-cancel-order" onClick={() => props.setCheckoutRequested(false)}>Not yet</button>
                  </div>
                </div>
              )}
              {props.orderConfirmed && (
                <div className="mb-5 rounded-xl border border-[#bcebdc] bg-[#edfcf7] p-3.5" data-testid="status-order-confirmed">
                  <div className="flex items-center gap-2 text-[12px] font-extrabold text-[#26755f]"><Check size={16} /> Ready for your final review</div>
                  <p className="mt-1 pl-6 text-[10px] leading-4 text-[#5d8b7e]">No payment was made. You’re in control of the next step.</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#dfe2f0] bg-[#f0f0ff] p-3.5 text-[#62668c]">
            <Zap className="mt-0.5 shrink-0 text-[#7678b1]" size={15} />
            <p className="text-[10px] leading-4"><span className="font-extrabold text-[#515477]">BuyQK tip:</span> You can change or cancel anything before confirmation. Try saying “add the second one too.”</p>
          </div>
        </aside>
      </div>
      {props.toast && <div className="toast-note fixed bottom-5 right-5 z-20 rounded-xl bg-[#20243a] px-4 py-3 text-[11px] font-bold text-white shadow-2xl" data-testid="status-toast">{props.toast}</div>}
    </div>
  );
}

function ActivityView({ sessionCount, setSessionCount, toast, setToast }: { sessionCount: number; setSessionCount: (value: number) => void; toast: string; setToast: (value: string) => void }) {
  const activityRows = [
    { title: 'Travel headphones shortlist', detail: '3 matches · 1 item added', time: 'Today, 09:42', color: 'bg-[#d7f7ec]', icon: Headphones },
    { title: 'Home office refresh', detail: 'Remembered: compact footprint', time: 'Yesterday, 18:16', color: 'bg-[#e5e5ff]', icon: Laptop },
    { title: 'Fitness watch comparison', detail: 'Saved for later', time: 'Mon, 12:08', color: 'bg-[#ffeadc]', icon: Watch },
  ];
  return (
    <div className="view-wrap">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">A quiet record of your intent</div>
          <h2 className="mt-2 text-[clamp(27px,3.1vw,42px)] font-extrabold leading-[1.02] tracking-[-0.065em] text-[#252a42]">Activity, not noise.</h2>
          <p className="mt-3 max-w-lg text-[12px] leading-5 text-[#778197]">Pick up a thread without repeating yourself. BuyQK keeps the useful parts of your shopping conversations close.</p>
        </div>
        <button className="ghost-button flex items-center gap-2 self-start rounded-xl px-3 py-2 text-[12px] font-bold sm:self-auto" data-testid="button-export-activity" onClick={() => setToast('Activity export is ready in the MVP preview')}>
          <ArrowRight size={14} /> Export summary
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Voice sessions', value: sessionCount, note: '+3 this month', icon: Activity, color: 'text-[#238364]', bg: 'bg-[#e2f8f0]' },
          { label: 'Saved preferences', value: 8, note: '2 recently updated', icon: Sparkles, color: 'text-[#6467a5]', bg: 'bg-[#e8e8ff]' },
          { label: 'Confirmed by you', value: '100%', note: 'BuyQK never assumes', icon: ShieldCheck, color: 'text-[#a06d27]', bg: 'bg-[#fff1dc]' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="content-card p-5" key={stat.label} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between"><div className={`grid h-9 w-9 place-items-center rounded-xl ${stat.bg} ${stat.color}`}><Icon size={17} /></div><MoreHorizontal size={16} className="text-[#a4acbb]" /></div>
              <div className="mt-5 text-[27px] font-extrabold tracking-[-0.05em] text-[#30354e]">{stat.value}</div>
              <div className="mt-1 text-[12px] font-bold text-[#68728a]">{stat.label}</div>
              <div className="mt-2 text-[10px] font-semibold text-[#9aa2b3]">{stat.note}</div>
            </div>
          );
        })}
      </div>
      <section className="content-card mt-5 p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-[#edf0f5] pb-4">
          <div><div className="eyebrow">Recent threads</div><h3 className="mt-1 text-[16px] font-extrabold text-[#2c3048]">Continue where you left off</h3></div>
          <button className="text-[11px] font-bold text-[#288565] transition hover:text-[#1e624e]" data-testid="button-clear-activity" onClick={() => { setSessionCount(0); setToast('Activity cleared from this preview'); }}>Clear all</button>
        </div>
        <div className="divide-y divide-[#edf0f5]">
          {activityRows.map((row, index) => {
            const Icon = row.icon;
            return (
              <button className="group flex w-full items-center gap-3 py-4 text-left transition hover:translate-x-1" data-testid={`button-activity-${index}`} key={row.title} onClick={() => setToast(`Reopened ${row.title}`)}>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${row.color} text-[#5a6280]`}><Icon size={18} strokeWidth={1.5} /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-extrabold text-[#343950]">{row.title}</div><div className="mt-1 truncate text-[10px] text-[#8992a6]">{row.detail}</div></div>
                <div className="hidden text-right sm:block"><div className="text-[10px] font-semibold text-[#858ea2]">{row.time}</div><ArrowRight className="ml-auto mt-2 text-[#b1b7c5] transition group-hover:text-[#378c70]" size={14} /></div>
              </button>
            );
          })}
        </div>
      </section>
      {toast && <div className="toast-note fixed bottom-5 right-5 z-20 rounded-xl bg-[#20243a] px-4 py-3 text-[11px] font-bold text-white shadow-2xl" data-testid="status-activity-toast">{toast}</div>}
    </div>
  );
}

function SettingsView({ memoryEnabled, setMemoryEnabled, autoRead, setAutoRead }: { memoryEnabled: boolean; setMemoryEnabled: (value: boolean) => void; autoRead: boolean; setAutoRead: (value: boolean) => void }) {
  return (
    <div className="view-wrap">
      <div className="mb-7">
        <div className="eyebrow">Make it feel like yours</div>
        <h2 className="mt-2 text-[clamp(27px,3.1vw,42px)] font-extrabold leading-[1.02] tracking-[-0.065em] text-[#252a42]">Assistant settings.</h2>
        <p className="mt-3 max-w-lg text-[12px] leading-5 text-[#778197]">Simple controls for how BuyQK remembers, speaks, and asks for your trust.</p>
      </div>
      <div className="grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="content-card divide-y divide-[#edf0f5]">
          <SettingRow icon={Sparkles} label="Remember useful preferences" description="Keep size, budget, style, and delivery preferences in future sessions." enabled={memoryEnabled} onToggle={() => setMemoryEnabled(!memoryEnabled)} testId="button-toggle-memory" />
          <SettingRow icon={Volume2} label="Read responses aloud" description="Hear BuyQK responses automatically while a voice session is active." enabled={autoRead} onToggle={() => setAutoRead(!autoRead)} testId="button-toggle-auto-read" />
          <SettingRow icon={ShieldCheck} label="Confirmation gates" description="Always ask before checkout, sharing details, or changing an important preference." enabled={true} onToggle={() => undefined} testId="button-toggle-confirmation" locked />
        </div>
        <div className="space-y-4">
          <div className="content-card p-5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5f9f2] text-[#2a8a6c]"><ShieldCheck size={17} /></div>
            <h3 className="mt-4 text-[14px] font-extrabold text-[#30354e]">Your control is the feature.</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#7a8499]">BuyQK can prepare actions, but it never quietly completes the important ones.</p>
          </div>
          <div className="content-card p-5">
            <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#3d4660]"><CircleHelp size={14} className="text-[#7c82ad]" /> What gets remembered?</div>
            <p className="mt-2 text-[11px] leading-5 text-[#8992a6]">Only shopping context that helps next time. Payment details are never part of memory.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, enabled, onToggle, testId, locked = false }: { icon: typeof Sparkles; label: string; description: string; enabled: boolean; onToggle: () => void; testId: string; locked?: boolean }) {
  return (
    <div className="flex items-center gap-4 p-5 sm:p-6">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0f1fb] text-[#6a6d9c]"><Icon size={17} /></div>
      <div className="min-w-0 flex-1"><div className="text-[12px] font-extrabold text-[#343950]">{label}</div><p className="mt-1 max-w-xl text-[11px] leading-4 text-[#8992a6]">{description}</p></div>
      <button className={`toggle-track shrink-0 ${enabled ? 'on' : ''} ${locked ? 'cursor-not-allowed opacity-75' : ''}`} data-testid={testId} aria-pressed={enabled} aria-label={label} onClick={onToggle} disabled={locked}><div className="toggle-knob" /></button>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export default App;