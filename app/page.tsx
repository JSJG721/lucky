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
  const handleLogout = () => {
    supabase.auth.signOut();
    setUser(null);
    setTicketCount(0);
    setHistory([]);
  };

  const handleWatchAd = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    setLoading(true);
    // 실제 광고 SDK 연동 전까지는 이 RPC 함수가 테스트용 응모권을 지급합니다.
    const { data, error }: any = await supabase.rpc('reward_ad_tickets', { target_user_id: user.id });
    if (data?.success) {
      alert(data.message);
      fetchUserData(user.id);
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
        
        <header className="flex justify-between items-center py-2">
          <h1 className="text-xl font-black text-yellow-500 italic uppercase tracking-tighter">Lucky 5/28</h1>
          {!user ? (
            <button onClick={handleLogin} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full shadow-lg">LOGIN</button>
          ) : (
            <button onClick={handleLogout} className="text-xs text-slate-500 font-bold underline decoration-slate-700">LOGOUT</button>
          )}
        </header>

        {user && (
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl flex justify-between items-center transition-all">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Available Tickets</p>
              <h2 className="text-4xl font-black text-yellow-500 italic leading-none">{ticketCount} <span className="text-sm not-italic text-slate-600">EA</span></h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Daily Limit</p>
              <p className="text-lg font-bold text-slate-300">{adsToday} <span className="text-slate-600">/ 20</span></p>
            </div>
          </div>
        )}

        <section className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-inner">
           <button 
            onClick={handleWatchAd}
            disabled={loading || !user || adsToday >= 20}
            className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm hover:bg-yellow-400 transition-all disabled:bg-slate-800 disabled:text-slate-600 shadow-lg"
          >
            {adsToday >= 20 ? 'DAILY LIMIT REACHED' : 'WATCH AD (+5 TICKETS)'}
          </button>
        </section>

        <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Select 5 Numbers</h3>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 underline uppercase">Auto Select</button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`aspect-square rounded-xl text-xs font-black transition-all duration-200 ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-slate-950 text-slate-600 border border-slate-800 hover:border-slate-600'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5 || ticketCount <= 0}
            className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-xl active:scale-95"
          >
            {ticketCount <= 0 ? 'Collect Tickets' : 'Submit Entry'}
          </button>
        </section>

        {/* 내 응모 내역 섹션 - 크게 확장됨 */}
        <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">My Entry History</h3>
            <span className="text-[10px] font-bold text-slate-500">{history.length} Entries</span>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? history.map((h, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-slate-800/50">
                <div className="flex gap-2">
                  {h.selected_numbers.map((num: number, idx: number) => (
                    <span key={idx} className="text-xs font-bold text-yellow-500/80">#{num}</span>
                  ))}
                </div>
                <span className="text-[9px] text-slate-600 font-mono">
                  {new Date(h.created_at).toLocaleDateString()}
                </span>
              </div>
            )) : (
              <div className="py-10 text-center">
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">No history yet</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}