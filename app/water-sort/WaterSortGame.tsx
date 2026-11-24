'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPACITY,
  COLORS,
  type Move,
  type Tube,
  canPour,
  colorCountForLevel,
  generateLevel,
  isComplete,
  isSolved,
  pour,
  solve,
} from '@/lib/waterSort';

const LEVEL_KEY = 'waterSort.level';
const SOUND_KEY = 'waterSort.muted';

// 붓기 애니메이션 단계별 시간(ms)
const MOVE_MS = 260;
const POUR_MS = 420;
const RETURN_MS = 260;

type PourAnim = {
  from: number;
  to: number;
  color: number;
  phase: 'move' | 'pour' | 'return';
  dx: number;
  dy: number;
  tilt: number;
};

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 환경에서도 게임은 계속 */
  }
}

// ── 효과음 (WebAudio로 간단한 물방울 소리) ──────────────────────
let audioCtx: AudioContext | null = null;
function playTone(kind: 'pour' | 'done' | 'win' | 'error') {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const notes: Record<typeof kind, [number, number, number][]> = {
      // [주파수 시작, 주파수 끝, 시작 지연]
      pour: [
        [520, 260, 0],
        [600, 300, 0.09],
        [480, 240, 0.18],
      ],
      done: [
        [660, 660, 0],
        [990, 990, 0.08],
      ],
      win: [
        [523, 523, 0],
        [659, 659, 0.12],
        [784, 784, 0.24],
        [1046, 1046, 0.36],
      ],
      error: [[180, 140, 0]],
    };
    for (const [f0, f1, delay] of notes[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'error' ? 'square' : 'sine';
      osc.frequency.setValueAtTime(f0, now + delay);
      osc.frequency.exponentialRampToValueAtTime(f1, now + delay + 0.12);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.05 : 0.15, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.18);
    }
  } catch {
    /* 소리를 못 내는 환경은 무시 */
  }
}

// ── 바깥 컴포넌트: 저장된 레벨을 불러오고 레벨별로 게임판을 새로 만든다 ──
export default function WaterSortGame() {
  const [level, setLevel] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const saved = Number(readStorage(LEVEL_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소는 마운트 후에만 읽을 수 있음
    setLevel(Number.isInteger(saved) && saved > 0 ? saved : 1);
    setMuted(readStorage(SOUND_KEY) === '1');
  }, []);

  const goTo = useCallback((next: number) => {
    const lv = Math.max(1, next);
    setLevel(lv);
    writeStorage(LEVEL_KEY, String(lv));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      writeStorage(SOUND_KEY, m ? '0' : '1');
      return !m;
    });
  }, []);

  if (level === null) {
    return <div className="flex flex-1 items-center justify-center text-white/60">불러오는 중…</div>;
  }

  return (
    <Board
      key={level}
      level={level}
      muted={muted}
      onToggleMute={toggleMute}
      onNext={() => goTo(level + 1)}
      onPrev={() => goTo(level - 1)}
    />
  );
}

// ── 게임판 ─────────────────────────────────────────────────────
function Board({
  level,
  muted,
  onToggleMute,
  onNext,
  onPrev,
}: {
  level: number;
  muted: boolean;
  onToggleMute: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const initial = useMemo(() => generateLevel(level), [level]);
  const [tubes, setTubes] = useState<Tube[]>(initial);
  const [history, setHistory] = useState<Tube[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [extraUsed, setExtraUsed] = useState(false);
  const [anim, setAnim] = useState<PourAnim | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<number | null>(null);

  const tubeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef<number[]>([]);

  const won = useMemo(() => isSolved(tubes), [tubes]);

  const sound = useCallback(
    (kind: Parameters<typeof playTone>[0]) => {
      if (!muted) playTone(kind);
    },
    [muted],
  );

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const flash = (text: string) => {
    setMessage(text);
    later(() => setMessage(null), 1800);
  };

  const doPour = (from: number, to: number) => {
    const result = pour(tubes, from, to);
    if (!result) return;

    const src = tubeRefs.current[from]?.getBoundingClientRect();
    const dst = tubeRefs.current[to]?.getBoundingClientRect();
    const toRight = dst && src ? dst.left >= src.left : true;
    // 병 입구가 대상 병 바로 위에 오도록 위치와 기울기 계산
    const dx = src && dst ? dst.left - src.left + (toRight ? -src.width * 0.55 : src.width * 0.55) : 0;
    // 선택된 병은 18px 떠 있으므로 그만큼 보정
    const lift = selected === from ? 18 : 0;
    const dy = src && dst ? dst.top - src.top - lift - src.height * 0.55 : 0;
    const tilt = toRight ? 72 : -72;
    const color = tubes[from][tubes[from].length - 1];

    setSelected(null);
    setHint(null);
    setAnim({ from, to, color, phase: 'move', dx, dy, tilt });

    later(() => {
      setAnim((a) => (a ? { ...a, phase: 'pour' } : a));
      setHistory((h) => [...h, tubes]);
      setTubes(result.tubes);
      setMoves((m) => m + 1);
      sound('pour');
    }, MOVE_MS);

    later(() => setAnim((a) => (a ? { ...a, phase: 'return' } : a)), MOVE_MS + POUR_MS);

    later(() => {
      setAnim(null);
      if (isSolved(result.tubes)) {
        sound('win');
      } else if (isComplete(result.tubes[to])) {
        sound('done');
        setJustCompleted(to);
        later(() => setJustCompleted(null), 900);
      }
    }, MOVE_MS + POUR_MS + RETURN_MS);
  };

  const onTubeClick = (i: number) => {
    if (anim || won) return;
    if (selected === null) {
      if (tubes[i].length === 0 || isComplete(tubes[i])) return;
      setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (canPour(tubes, selected, i)) {
      doPour(selected, i);
    } else if (tubes[i].length > 0 && !isComplete(tubes[i])) {
      // 부을 수 없으면 선택을 그 병으로 옮긴다
      setSelected(i);
    } else {
      sound('error');
      setShake(i);
      later(() => setShake(null), 400);
    }
  };

  const undo = () => {
    if (anim || history.length === 0) return;
    setTubes(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setSelected(null);
    setHint(null);
  };

  const restart = () => {
    if (anim) return;
    setTubes(initial);
    setHistory([]);
    setMoves(0);
    setSelected(null);
    setHint(null);
    setExtraUsed(false);
  };

  const addTube = () => {
    if (anim || extraUsed) return;
    setHistory((h) => [...h, tubes]);
    setTubes((t) => [...t, []]);
    setExtraUsed(true);
    setSelected(null);
    setHint(null);
  };

  const showHint = () => {
    if (anim || won) return;
    const path = solve(tubes);
    if (!path || path.length === 0) {
      flash(extraUsed ? '막혔어요! 되돌리기를 해보세요' : '막혔어요! 되돌리기나 병 추가를 해보세요');
      return;
    }
    setSelected(null);
    setHint(path[0]);
  };

  // 병 수에 따라 크기와 줄 수를 정한다
  const n = tubes.length;
  const rows = n <= 6 ? 1 : n <= 12 ? 2 : 3;
  const perRow = Math.ceil(n / rows);
  const seg = rows === 3 ? 26 : rows === 2 ? 32 : 38;
  const tubeW = perRow > 6 ? 38 : 46;
  const headroom = 14;
  const rowsOfTubes: number[][] = [];
  for (let r = 0; r < rows; r++) {
    rowsOfTubes.push(
      Array.from({ length: perRow }, (_, k) => r * perRow + k).filter((i) => i < n),
    );
  }

  const colorCount = colorCountForLevel(level);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6 pt-4 select-none">
      {/* 상단 정보 */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">Water Sort</p>
          <h1 className="text-2xl font-bold text-white">레벨 {level}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
            {colorCount}색 · {moves}수
          </span>
          <button
            onClick={onToggleMute}
            className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 active:scale-95"
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <p className="mt-2 h-5 text-center text-sm text-amber-200/90">
        {message ?? (selected !== null ? '부을 병을 골라주세요' : '같은 색끼리 한 병에 모아보세요')}
      </p>

      {/* 병들 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        {rowsOfTubes.map((row, r) => (
          <div key={r} className="flex items-end justify-center gap-2.5">
            {row.map((i) => (
              <TubeView
                key={i}
                index={i}
                tube={tubes[i]}
                seg={seg}
                width={tubeW}
                headroom={headroom}
                selected={selected === i}
                hintFrom={hint?.from === i}
                hintTo={hint?.to === i}
                shaking={shake === i}
                completed={isComplete(tubes[i])}
                celebrate={justCompleted === i}
                anim={anim}
                refCb={(el) => {
                  tubeRefs.current[i] = el;
                }}
                onClick={() => onTubeClick(i)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 하단 버튼 */}
      <div className="grid grid-cols-4 gap-2">
        <ToolButton label="되돌리기" icon="↶" onClick={undo} disabled={history.length === 0 || !!anim} />
        <ToolButton label="다시하기" icon="⟳" onClick={restart} disabled={!!anim} />
        <ToolButton label="병 추가" icon="＋" onClick={addTube} disabled={extraUsed || !!anim} />
        <ToolButton label="힌트" icon="💡" onClick={showHint} disabled={!!anim || won} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-white/40">
        <button onClick={onPrev} disabled={level <= 1} className="disabled:opacity-30">
          ← 이전 레벨
        </button>
        <span>병 추가는 레벨마다 1번</span>
      </div>

      {/* 클리어 화면 */}
      {won && !anim && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="ws-pop w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl ring-1 ring-white/10">
            <div className="text-5xl">🎉</div>
            <h2 className="mt-3 text-2xl font-bold text-white">레벨 {level} 클리어!</h2>
            <p className="mt-1 text-white/60">{moves}수 만에 완성했어요</p>
            <button
              onClick={onNext}
              className="mt-6 w-full rounded-2xl bg-amber-400 py-3 text-lg font-bold text-slate-900 active:scale-95"
            >
              다음 레벨 →
            </button>
            <button onClick={restart} className="mt-3 text-sm text-white/50">
              이 레벨 다시하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/10 py-2.5 text-white transition active:scale-95 disabled:opacity-30"
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

// ── 병 하나 ─────────────────────────────────────────────────────
function TubeView({
  index,
  tube,
  seg,
  width,
  headroom,
  selected,
  hintFrom,
  hintTo,
  shaking,
  completed,
  celebrate,
  anim,
  refCb,
  onClick,
}: {
  index: number;
  tube: Tube;
  seg: number;
  width: number;
  headroom: number;
  selected: boolean;
  hintFrom: boolean;
  hintTo: boolean;
  shaking: boolean;
  completed: boolean;
  celebrate: boolean;
  anim: PourAnim | null;
  refCb: (el: HTMLDivElement | null) => void;
  onClick: () => void;
}) {
  const height = seg * CAPACITY + headroom;
  const isSource = anim?.from === index;
  const isTarget = anim?.to === index;

  let transform = selected ? 'translateY(-18px)' : 'translateY(0)';
  let transition = 'transform 180ms ease-out';
  if (isSource && anim) {
    if (anim.phase === 'move' || anim.phase === 'pour') {
      transform = `translate(${anim.dx}px, ${anim.dy}px) rotate(${anim.tilt}deg)`;
      transition = `transform ${MOVE_MS}ms ease-in-out`;
    } else {
      transform = 'translate(0, 0) rotate(0deg)';
      transition = `transform ${RETURN_MS}ms ease-in-out`;
    }
  }

  const ring = hintFrom
    ? 'ring-2 ring-amber-300 ws-blink'
    : hintTo
      ? 'ring-2 ring-emerald-300 ws-blink'
      : '';

  return (
    <div className="relative" style={{ width, height }}>
      {/* 붓는 물줄기 */}
      {isTarget && anim?.phase === 'pour' && (
        <div
          className="ws-stream pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full"
          style={{
            width: 6,
            top: -height * 0.35,
            height: height * 0.35 + headroom + seg * (CAPACITY - tube.length) + 4,
            background: COLORS[anim.color],
          }}
        />
      )}
      <div
        ref={refCb}
        role="button"
        tabIndex={0}
        aria-label={`병 ${index + 1}`}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={`absolute inset-0 cursor-pointer ${shaking ? 'ws-shake' : ''}`}
        style={{
          transform,
          transition,
          transformOrigin: '50% 15%',
          zIndex: isSource ? 20 : 1,
        }}
      >
        <div
          className={`relative h-full w-full overflow-hidden border-2 bg-white/5 ${ring} ${
            completed ? 'border-amber-200/70' : 'border-white/40'
          }`}
          style={{
            borderRadius: `8px 8px ${width / 2}px ${width / 2}px`,
            boxShadow: completed ? '0 0 18px rgba(253, 230, 138, 0.35)' : 'inset 0 0 8px rgba(255,255,255,0.06)',
          }}
        >
          {/* 액체 */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
            {Array.from({ length: CAPACITY }, (_, s) => {
              const c = tube[s];
              const filled = c !== undefined;
              return (
                <div
                  key={s}
                  style={{
                    height: filled ? seg : 0,
                    background: filled ? COLORS[c] : 'transparent',
                    transition: `height ${POUR_MS}ms ease-in-out`,
                  }}
                />
              );
            })}
          </div>
          {/* 유리 광택 */}
          <div className="pointer-events-none absolute inset-y-2 left-1.5 w-1.5 rounded-full bg-white/25" />
        </div>
        {completed && (
          <div
            className={`absolute -top-2.5 left-1/2 h-3 -translate-x-1/2 rounded-sm bg-amber-700 ${celebrate ? 'ws-pop' : ''}`}
            style={{ width: width * 0.7 }}
          />
        )}
      </div>
      {celebrate && <div className="ws-sparkle pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 text-xl">✨</div>}
    </div>
  );
}
