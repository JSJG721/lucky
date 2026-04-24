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
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
    });

    fetchGlobalData();
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    const { data: balance } = await supabase.from('user_balances').select('*').eq('id', userId).maybeSingle();
    if (balance) {
      setTicketCount(balance.ticket_count);
      setAdsToday(balance.ads_watched_today);
    } else {
      await supabase.from('user_balances').insert({ id: userId, ticket_count: 0 });
      setTicketCount(0);
      setAdsToday(0);
    }

    const { data: userDraws } = await supabase.from('lucky_draws').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (userDraws) setHistory(userDraws);
  };

  const fetchGlobalData = async () => {
    const { data: wins } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1);
    if (wins && wins.length > 0) setWinningNumbers(wins[0].numbers);
  };

  const handleAutoSelect = () => {
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setSelectedNumbers(randomNums.sort((a, b) => a - b));
  };

  const handleLogin = () => supabase.auth.signInWithOAuth({ provider: 'google' });
  const handleLogout = () => { supabase.auth.signOut(); setUser(null); setTicketCount(0); setHistory([]); };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { target_user_id: user.id });
    if (data?.success) {
      alert(data.message);
      await fetchUserData(user.id);
    } else alert(data?.message || '오류 발생');
    setLoading(false);
  };

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    else if (selectedNumbers.length < 5) setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
  };

  const handleSubmit = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (ticketCount <= 0) return alert('응모권이 부족합니다.');
    setLoading(true);
    const { error: drawError } = await supabase.from('lucky_draws').insert({ user_id: user.id, selected_numbers: selectedNumbers });
    if (!drawError) {
      await supabase.from('user_balances').update({ ticket_count: ticketCount - 1 }).eq('id', user.id);
      alert('응모 완료!');
      setSelectedNumbers([]);
      fetchUserData(user.id);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline">LOGOUT</button>
          )}
        </header>

        {/* Wallet */}
        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center shadow-xl">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tickets</p>
              <h2 className="text-4xl font-black text-yellow-500 italic">{ticketCount}</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Daily Ads</p>
              <p className="text-lg font-bold text-slate-300">{adsToday} / 20</p>
            </div>
          </div>
        )}

        {/* Ad Button */}
        <section>
           <button 
            onClick={handleWatchAd}
            disabled={loading || !user || adsToday >= 20}
            className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm hover:bg-yellow-400 disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg"
          >
            {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
          </button>
        </section>

        {/* Board */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Pick 5 Numbers</h3>
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
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-xl"
          >
            {ticketCount <= 0 ? 'Collect Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* History (Time-based Logic Applied) */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">My Entry History</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? history.map((h, i) => {
              const entryTime = new Date(h.created_at);
              const now = new Date();
              
              // 회차 기준 시간 계산 (오늘 21시)
              const today21 = new Date(now);
              today21.setHours(21, 0, 0, 0);
              
              // 어제 21시
              const yesterday21 = new Date(today21);
              yesterday21.setDate(yesterday21.getDate() - 1);

              // 대조 가능 기간 판별: 현재가 21시 이전이면 [어제21~오늘21] 응모건이 유효
              // 현재가 21시 이후면 [오늘21~내일21] 응모건이 다음 회차가 됨
              const isCompariable = now < today21 
                ? (entryTime > yesterday21 && entryTime <= today21)
                : (entryTime > today21);

              return (
                <div key={i} className="p-4 bg-slate-950 rounded-3xl border border-slate-800 flex justify-between items-center">
                  <div className="flex gap-2">
                    {h.selected_numbers.map((num: number, idx: number) => {
                      const isMatch = isCompariable && winningNumbers.includes(num);
                      return (
                        <span key={idx} className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${isMatch ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                          {num}
                        </span>
                      );
                    })}
                  </div>
                  <div className="text-right opacity-40">
                    <span className="text-[9px] font-mono block">{entryTime.toLocaleDateString()}</span>
                    <span className="text-[8px] font-mono uppercase">{entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 text-center text-slate-600 text-xs font-bold uppercase tracking-widest">No history found</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}