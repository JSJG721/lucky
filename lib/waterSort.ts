// 액체 따르기 퍼즐 핵심 로직 (UI와 분리된 순수 함수들)
// 병(tube)은 아래 → 위 순서의 색 번호 배열입니다.

export type Tube = number[];
export type Move = { from: number; to: number };

export const CAPACITY = 4;

export const COLORS = [
  '#ef4444', // 빨강
  '#3b82f6', // 파랑
  '#22c55e', // 초록
  '#facc15', // 노랑
  '#a855f7', // 보라
  '#f97316', // 주황
  '#ec4899', // 분홍
  '#14b8a6', // 청록
  '#8b5a2b', // 갈색
  '#e5e7eb', // 흰색
  '#1e3a8a', // 남색
  '#84cc16', // 연두
];

/** 레벨 번호(1부터)에 따른 색 개수 */
export function colorCountForLevel(level: number): number {
  return Math.min(3 + Math.floor((level - 1) / 3), COLORS.length);
}

/** 결정적 난수 (같은 레벨은 항상 같은 배치) */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const top = (t: Tube) => t[t.length - 1];

/** 맨 위에서 같은 색이 몇 칸 연속인지 */
export function topRun(t: Tube): number {
  if (t.length === 0) return 0;
  const c = top(t);
  let n = 0;
  for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
  return n;
}

export function isComplete(t: Tube): boolean {
  return t.length === CAPACITY && topRun(t) === CAPACITY;
}

export function canPour(tubes: Tube[], from: number, to: number): boolean {
  if (from === to) return false;
  const a = tubes[from];
  const b = tubes[to];
  if (!a || !b || a.length === 0 || b.length >= CAPACITY) return false;
  return b.length === 0 || top(b) === top(a);
}

/** 붓기를 적용한 새 상태와 옮겨진 양을 반환 (불가능하면 null) */
export function pour(tubes: Tube[], from: number, to: number): { tubes: Tube[]; amount: number } | null {
  if (!canPour(tubes, from, to)) return null;
  const amount = Math.min(topRun(tubes[from]), CAPACITY - tubes[to].length);
  const next = tubes.map((t) => t.slice());
  const color = top(next[from]);
  next[from].length -= amount;
  for (let i = 0; i < amount; i++) next[to].push(color);
  return { tubes: next, amount };
}

export function isSolved(tubes: Tube[]): boolean {
  return tubes.every((t) => t.length === 0 || isComplete(t));
}

/** 의미 있는 수만 나열 (풀이기용 가지치기 포함) */
function usefulMoves(tubes: Tube[]): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < tubes.length; from++) {
    const a = tubes[from];
    if (a.length === 0 || isComplete(a)) continue;
    const singleColor = topRun(a) === a.length;
    let triedEmpty = false;
    for (let to = 0; to < tubes.length; to++) {
      if (!canPour(tubes, from, to)) continue;
      const b = tubes[to];
      if (b.length === 0) {
        // 한 색뿐인 병을 빈 병에 옮기는 건 의미 없음, 빈 병은 하나만 시도
        if (singleColor || triedEmpty) continue;
        triedEmpty = true;
      }
      moves.push({ from, to });
    }
  }
  return moves;
}

const keyOf = (tubes: Tube[]) =>
  tubes
    .map((t) => t.join(','))
    .sort()
    .join('|');

/**
 * 현재 상태에서의 풀이를 찾습니다. 못 찾으면 null.
 * nodeLimit 이상 탐색하면 포기합니다(브라우저가 멈추지 않도록).
 */
export function solve(start: Tube[], nodeLimit = 200_000): Move[] | null {
  if (isSolved(start)) return [];
  const seen = new Set<string>([keyOf(start)]);
  const path: Move[] = [];
  let nodes = 0;

  const dfs = (tubes: Tube[]): boolean => {
    if (++nodes > nodeLimit) return false;
    const moves = usefulMoves(tubes);
    // 병을 완성시키는 수를 먼저 시도
    moves.sort((m1, m2) => score(tubes, m2) - score(tubes, m1));
    for (const m of moves) {
      const r = pour(tubes, m.from, m.to);
      if (!r) continue;
      const k = keyOf(r.tubes);
      if (seen.has(k)) continue;
      seen.add(k);
      path.push(m);
      if (isSolved(r.tubes) || dfs(r.tubes)) return true;
      path.pop();
      if (nodes > nodeLimit) return false;
    }
    return false;
  };

  return dfs(start) ? path : null;
}

function score(tubes: Tube[], m: Move): number {
  const b = tubes[m.to];
  let s = 0;
  if (b.length > 0) s += 2; // 같은 색 위에 붓기
  if (b.length > 0 && topRun(b) === b.length) s += 2; // 한 색 병에 모으기
  if (topRun(tubes[m.from]) + b.length <= CAPACITY) s += 1; // 전부 옮길 수 있음
  return s;
}

/** 레벨 생성: 섞인 병 + 빈 병 2개, 풀이 가능한 것만 */
export function generateLevel(level: number): Tube[] {
  const colors = colorCountForLevel(level);
  const rand = mulberry32(level * 7919 + 17);
  let last: Tube[] = [];
  for (let attempt = 0; attempt < 500; attempt++) {
    const pool: number[] = [];
    for (let c = 0; c < colors; c++) for (let i = 0; i < CAPACITY; i++) pool.push(c);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const tubes: Tube[] = [];
    for (let c = 0; c < colors; c++) tubes.push(pool.slice(c * CAPACITY, (c + 1) * CAPACITY));
    tubes.push([], []);
    last = tubes;
    // 처음부터 거의 완성된 병이 있는 너무 쉬운 배치는 제외
    if (tubes.some((t) => topRun(t) >= 3)) continue;
    if (solve(tubes, 50_000)) return tubes;
  }
  // 거의 일어나지 않음: 마지막 배치를 반환 (병 추가 기능으로 풀 수 있음)
  return last;
}
