'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [adsToday, setAdsToday] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      }
    };
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else {
        setUser(null);
        setTicketCount(0);
        setHistory([]);
      }
    });

    fetchGlobalData();
    return () => authListener.subscription.unsubscribe();
  }, []);

  // --- 헬퍼 함수들 (내부 선언으로 빨간줄 방지) ---
  
  const fetchUserData = async (userId: string) => {
    const { data: balance } = await supabase
      .from('user_balances')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (balance) {
      setTicketCount(balance.ticket_count);
      setAdsToday(balance.ads_watched_today);
    }

    const { data: userDraws } = await supabase
      .from('lucky_draws')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (userDraws) setHistory(userDraws);
  };

  const fetchGlobalData = async () => {
    const { data: wins } = await supabase
      .from('winning_numbers')
      .select('*')
      .order('draw_date', { ascending: false })
      .limit(1);
    if (wins && wins.length > 0) setWinningNumbers(wins[0].numbers);
  };

  const handleLogin = () => supabase.auth.signInWithOAuth({ provider: 'google' });

  const handleAutoSelect = () => {
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setSelectedNumbers(randomNums.sort((a, b) => a - b));
  };

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { 
      target_user_id: user.id 
    });

    if (data?.success) {
      alert(data.message);
      setTimeout(async () => {
        await fetchUserData(user.id);
      }, 500);
    } else {
      alert(data?.message || '광고 보상 지급 실패');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || ticketCount <= 0 || selectedNumbers.length !== 5) return;
    
    setLoading(true);
    const { error: drawError } = await supabase.from('lucky_draws').insert({ 
      user_id: user.id, 
      selected_numbers: selectedNumbers 
    });

    if (!drawError) {
      await supabase.from('user_balances').update({ 
        ticket_count: ticketCount - 1 
      }).eq('id', user.id);
      
      alert('응모 완료!');
      setSelectedNumbers([]);
      await fetchUserData(user.id);
    }
    setLoading(false);
  };

  const checkIsWinning = (entryCreatedAt: string, num: number) => {
    if (!winningNumbers.length) return false;
    const entryDate = new Date(entryCreatedAt);
    const now = new Date();
    const today9PM = new Date(now);
    today9PM.setHours(21, 0, 0, 0);
    const yesterday9PM = new Date(today9PM);
    yesterday9PM.setDate(yesterday9PM.getDate() - 1);

    const isTargetSession = entryDate > yesterday9PM && entryDate <= today9PM;
    return isTargetSession && winningNumbers.includes(num);
  };

  // --- 화면 렌더링 ---
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 font-bold underline">LOGOUT</button>
          )}
        </header>

        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">My Tickets</p>
              <h2 className="text-4xl font-black text-yellow-500 italic tracking-tighter">{ticketCount} EA</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Today Ads</p>
              <p className="text-lg font-bold text-slate-300">{adsToday} / 20</p>
            </div>
          </div>
        )}

        <button 
          onClick={handleWatchAd}
          disabled={loading || !user || adsToday >= 20}
          className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg"
        >
          {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
        </button>

        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Pick 5 Numbers</h3>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 underline uppercase">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`aspect-square rounded-xl text-xs font-black transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-110' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0}
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all"
          >
            {ticketCount <= 0 ? 'Need Tickets' : 'Submit Entry'}
          </button>
        </section>

        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">History</h3>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? history.map((h, i) => (
              <div key={i} className="p-4 bg-slate-950 rounded-3xl border border-slate-800 flex justify-between items-center">
                <div className="flex gap-2">
                  {h.selected_numbers.map((num: number, idx: number) => {
                    const matched = checkIsWinning(h.created_at, num);
                    return (
                      <span 
                        key={idx} 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${
                          matched 
                            ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {num}
                      </span>
                    );
                  })}
                </div>
                <div className="text-right text-[8px] text-slate-700 font-mono">
                  {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-slate-600 text-xs font-bold uppercase">No entries</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}