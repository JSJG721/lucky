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
    // 세션 초기화 및 감시
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      updateUserState(session?.user ?? null);
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUserState(session?.user ?? null);
    });

    fetchWinningNumbers();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
  }, []);

  // 유저 상태에 따른 데이터 관리
  const updateUserState = (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      fetchHistory(currentUser.id);
    } else {
      // 로그아웃 시 모든 데이터 즉시 비우기
      setHistory([]);
      setSelectedNumbers([]);
    }
  };

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

  const fetchWinningNumbers = async () => {
    const { data } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1).maybeSingle();
    if (data) setWinningNumbers(data.numbers);
  };

  const fetchHistory = async (userId: string) => {
    const { data } = await supabase.from('lucky_draws').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert('로그아웃 되었습니다.');
  };

  const toggleNumber = (n: number) => {
    if (!user) return alert('로그인 후 이용 가능합니다!');
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  const handleAutoSelect = () => {
    if (!user) return alert('로그인이 필요합니다!');
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
    // user_id를 명시적으로 전달
    const { error } = await supabase.from('lucky_draws').insert([{ 
      selected_numbers: selectedNumbers,
      user_id: user.id 
    }]);

    if (error) {
      console.error('Submit Error:', error);
      alert('저장 실패! Supabase에서 lucky_draws 테이블의 RLS 정책을 다시 확인해주세요.');
    } else {
      alert('행운의 번호가 등록되었습니다!');
      setSelectedNumbers([]);
      fetchHistory(user.id);
    }
    setLoading(false);
  };

  // 날짜별 그룹화 로직 (기존 유지)
  const groupedHistory = history.reduce((groups: any, record: any) => {
    const date = new Date(record.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* 상단 로그인 바 */}
        <div className="flex justify-end items-center gap-3 py-2">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400">{user.email}</span>
              <button onClick={handleLogout} className="text-[10px] font-black text-red-500 uppercase">Logout</button>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} className="bg-white text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Login with Google</button>
          )}
        </div>

        {/* 타이머 및 제목 */}
        <header className="text-center">
          <h1 className="text-4xl font-black italic text-yellow-500 tracking-tighter uppercase">Lucky Draw</h1>
          <div className="mt-4 inline-flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-1">Next Draw In</span>
            <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full">
              <span className="text-xl font-mono font-black text-white tracking-widest">{timeLeft || '00:00:00'}</span>
            </div>
          </div>
        </header>

        {/* 당첨 번호 결과 (image_85a33d.png 디자인 반영) */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 text-center shadow-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] block mb-6">Today's Results</span>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? winningNumbers.map((n, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(234,179,8,0.4)]">{n}</div>
            )) : <p className="text-slate-600 text-sm italic">Waiting...</p>}
          </div>
        </section>

        {/* 번호 선택 그리드 */}
        <section className="space-y-6">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select 5 Numbers</span>
            <button onClick={handleAutoSelect} className="text-[10px] font-black text-yellow-500 border border-yellow-500/30 px-3 py-1.5 rounded-full">AUTO SELECT</button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => toggleNumber(n)} className={`aspect-square rounded-2xl text-sm font-bold transition-all ${selectedNumbers.includes(n) ? 'bg-yellow-500 text-black' : 'bg-slate-900/80 text-slate-500 border border-slate-800'}`}>{n}</button>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={loading || selectedNumbers.length !== 5} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black tracking-widest active:scale-95 shadow-xl">
            {loading ? 'SENDING...' : `DRAW WITH ${selectedNumbers.length}/5`}
          </button>
        </section>

        {/* 내 기록 (로그인 시에만 노출) */}
        {user && (
          <section className="space-y-8 pt-4">
            <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">My Fortune History</h2>
            {Object.keys(groupedHistory).length > 0 ? Object.keys(groupedHistory).map(date => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-800">
                  <div className="h-px flex-1 bg-slate-900"></div>
                  <span>{date}</span>
                  <div className="h-px flex-1 bg-slate-900"></div>
                </div>
                {groupedHistory[date].map((record: any, i: number) => (
                  <div key={i} className="bg-[#111622] border border-slate-800/40 rounded-3xl p-5 flex justify-between items-center">
                    <div className="flex gap-2.5">
                      {record.selected_numbers?.map((n: number, j: number) => (
                        <span key={j} className={`text-sm font-black ${winningNumbers.includes(n) ? 'text-yellow-500' : 'text-slate-600'}`}>{n}</span>
                      ))}
                    </div>
                    <span className="text-[9px] text-slate-700 font-mono font-bold">{new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )) : <p className="text-center text-slate-700 text-xs py-10">No history yet.</p>}
          </section>
        )}
      </div>
    </div>
  );
}