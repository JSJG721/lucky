'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // 1. 현재 로그인 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. 로그인 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchData();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
  }, []);

  // 타이머 계산 함수
  const calculateTimeLeft = () => {
    const now = new Date();
    const target = new Date();
    target.setHours(21, 0, 0, 0); 
    if (now > target) target.setDate(target.getDate() + 1);
    const diff = target.getTime() - now.getTime();
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);
    setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  };

  const fetchData = async () => {
    const { data: winData } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1).maybeSingle();
    if (winData) setWinningNumbers(winData.numbers);

    const { data: drawData } = await supabase.from('lucky_draws').select('*').order('created_at', { ascending: false });
    if (drawData) setHistory(drawData);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  const handleAutoSelect = () => {
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setSelectedNumbers(randomNums.sort((a, b) => a - b));
  };

  const handleSubmit = async () => {
    if (!user) return alert('로그인이 필요합니다!');
    if (selectedNumbers.length !== 5) return alert('5개 번호를 선택해주세요!');
    setLoading(true);
    const { error } = await supabase.from('lucky_draws').insert([{ 
      selected_numbers: selectedNumbers,
      user_id: user.id 
    }]);
    if (!error) {
      alert('행운이 등록되었습니다!');
      setSelectedNumbers([]);
      fetchData();
    }
    setLoading(false);
  };

  const groupedHistory = history.reduce((groups: any, record: any) => {
    const date = new Date(record.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* 상단 사용자 바 */}
        <div className="flex justify-end items-center gap-3 py-2">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400">{user.email}</span>
              <button onClick={handleLogout} className="text-[10px] font-black text-red-500 uppercase">Logout</button>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} className="bg-white text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase">
              Login with Google
            </button>
          )}
        </div>

        <header className="text-center">
          <h1 className="text-4xl font-black italic text-yellow-500 tracking-tighter">LUCKY DRAW</h1>
          <div className="mt-4 inline-flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-1">Next Draw In</span>
            <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full shadow-inner">
              <span className="text-xl font-mono font-black text-white tracking-widest">{timeLeft || '00:00:00'}</span>
            </div>
          </div>
        </header>

        <section className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-red-500 text-[9px] font-bold tracking-tighter">LIVE RESULTS</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] block mb-6">Last Winning Numbers</span>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? winningNumbers.map((n, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-500/30">{n}</div>
            )) : <p className="text-slate-600 text-sm italic">추첨 대기 중...</p>}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select 5 Numbers</span>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 border border-yellow-500/30 px-3 py-1.5 rounded-full hover:bg-yellow-500 hover:text-black transition-all">AUTO SELECT</button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => toggleNumber(n)} className={`aspect-square rounded-2xl text-sm font-bold transition-all duration-200 ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/40 scale-90' : 'bg-slate-900/80 text-slate-500 border border-slate-800'}`}>{n}</button>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={loading || selectedNumbers.length !== 5} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all active:scale-95 shadow-xl shadow-white/5">
            {loading ? 'SENDING...' : `DRAW WITH ${selectedNumbers.length}/5`}
          </button>
        </section>

        <section className="space-y-8 pt-4">
          <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">My Fortune History</h2>
          {Object.keys(groupedHistory).length > 0 ? Object.keys(groupedHistory).map(date => {
            const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            const isToday = date === todayStr;
            return (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-800">
                  <div className="h-px flex-1 bg-slate-900"></div>
                  <span className="whitespace-nowrap">{date} {isToday && "(추첨 전)"}</span>
                  <div className="h-px flex-1 bg-slate-900"></div>
                </div>
                <div className="space-y-3">
                  {groupedHistory[date].map((record: any, i: number) => (
                    <div key={i} className="bg-[#111622] border border-slate-800/40 rounded-3xl p-5 flex justify-between items-center group">
                      <div className="flex gap-2.5">
                        {record.selected_numbers?.map((n: number, j: number) => {
                          const isWin = !isToday && winningNumbers.includes(n);
                          return (
                            <span key={j} className={`text-sm font-black transition-colors ${isWin ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'text-slate-600'}`}>{n}</span>
                          );
                        })}
                      </div>
                      <span className="text-[9px] text-slate-700 font-mono font-bold">{new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-20 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-800/50">
              <p className="text-slate-700 text-xs font-medium">No draw history yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}