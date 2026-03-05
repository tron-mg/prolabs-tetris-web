"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Cell = number;
type PieceKey = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

type Piece = {
  key: PieceKey;
  shape: number[][];
  x: number;
  y: number;
};

const PIECES: Record<PieceKey, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const PIECE_COLOR: Record<PieceKey, Cell> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

const DIFFICULTY = {
  easy: 700,
  medium: 450,
  hard: 220,
} as const;

const BOARD_SIZE = {
  small: { width: 8, height: 16 },
  medium: { width: 10, height: 20 },
  max: { width: 12, height: 24 },
} as const;

function rotate(shape: number[][]) {
  return shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
}

function createBoard(width: number, height: number) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

function randomPiece(width: number): Piece {
  const keys = Object.keys(PIECES) as PieceKey[];
  const key = keys[Math.floor(Math.random() * keys.length)];
  const shape = PIECES[key];
  const x = Math.floor((width - shape[0].length) / 2);
  return { key, shape, x, y: 0 };
}

function collides(board: Cell[][], piece: Piece, dx = 0, dy = 0, testShape?: number[][]) {
  const shape = testShape ?? piece.shape;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= board[0].length || ny >= board.length) return true;
      if (ny >= 0 && board[ny][nx] !== 0) return true;
    }
  }
  return false;
}

function merge(board: Cell[][], piece: Piece) {
  const next = board.map((r) => [...r]);
  const color = PIECE_COLOR[piece.key];
  piece.shape.forEach((row, y) => {
    row.forEach((v, x) => {
      if (!v) return;
      const by = piece.y + y;
      const bx = piece.x + x;
      if (by >= 0 && by < next.length && bx >= 0 && bx < next[0].length) next[by][bx] = color;
    });
  });
  return next;
}

function clearLines(board: Cell[][]) {
  const width = board[0].length;
  const kept = board.filter((row) => row.some((c) => c === 0));
  const lines = board.length - kept.length;
  const fresh = Array.from({ length: lines }, () => Array(width).fill(0));
  return { board: [...fresh, ...kept], lines };
}

export default function Home() {
  const [sizeKey, setSizeKey] = useState<keyof typeof BOARD_SIZE>("medium");
  const { width, height } = BOARD_SIZE[sizeKey];

  const [difficulty, setDifficulty] = useState<keyof typeof DIFFICULTY>("medium");
  const [board, setBoard] = useState<Cell[][]>(() => createBoard(width, height));
  const [piece, setPiece] = useState<Piece>(() => randomPiece(width));
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const boardShellRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(24);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const gameOverRef = useRef(gameOver);
  const pausedRef = useRef(paused);

  useEffect(() => {
    boardRef.current = board;
    pieceRef.current = piece;
    gameOverRef.current = gameOver;
    pausedRef.current = paused;
  }, [board, piece, gameOver, paused]);

  useEffect(() => {
    const shell = boardShellRef.current;
    if (!shell) return;

    const compute = () => {
      const { clientWidth, clientHeight } = shell;
      if (!clientWidth || !clientHeight) return;
      const next = Math.floor(Math.min(clientWidth / width, clientHeight / height));
      const clamped = Math.max(12, Math.min(next, 48));
      setCellSize((prev) => (prev === clamped ? prev : clamped));
    };

    compute();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    observer?.observe(shell);
    window.addEventListener("resize", compute);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [width, height]);

  const resetGame = useCallback(() => {
    const b = createBoard(width, height);
    setBoard(b);
    setPiece(randomPiece(width));
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  }, [width, height]);


  const settlePiece = useCallback(() => {
    const merged = merge(boardRef.current, pieceRef.current);
    const { board: cleaned, lines } = clearLines(merged);

    if (lines > 0) {
      setScore((s) => s + lines * 100);
      setLevel((l) => Math.min(20, l + lines));
    }

    const nextPiece = randomPiece(width);
    if (collides(cleaned, nextPiece)) {
      setBoard(cleaned);
      setGameOver(true);
      return;
    }

    setBoard(cleaned);
    setPiece(nextPiece);
  }, [width]);

  const moveDown = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, pieceRef.current, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
    } else {
      settlePiece();
    }
  }, [settlePiece]);

  const moveHorizontal = useCallback((dx: number) => {
    if (gameOverRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, pieceRef.current, dx, 0)) {
      setPiece((p) => ({ ...p, x: p.x + dx }));
    }
  }, []);

  const rotatePiece = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const r = rotate(pieceRef.current.shape);
    if (!collides(boardRef.current, pieceRef.current, 0, 0, r)) {
      setPiece((p) => ({ ...p, shape: r }));
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space", " ", "KeyP"].includes(e.code) || ["ArrowLeft", "ArrowRight", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "ArrowLeft") moveHorizontal(-1);
      if (e.key === "ArrowRight") moveHorizontal(1);
      if (e.key === "ArrowDown") moveDown();
      if (e.key === " " || e.code === "Space") rotatePiece();
      if (e.key.toLowerCase() === "p") setPaused((v) => !v);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveHorizontal, moveDown, rotatePiece]);

  useEffect(() => {
    if (gameOver || paused) return;
    const base = DIFFICULTY[difficulty];
    const speed = Math.max(70, base - (level - 1) * 12);
    const id = window.setInterval(moveDown, speed);
    return () => window.clearInterval(id);
  }, [difficulty, level, moveDown, gameOver, paused]);

  const display = useMemo(() => {
    const view = board.map((r) => [...r]);
    const color = PIECE_COLOR[piece.key];
    piece.shape.forEach((row, y) => {
      row.forEach((v, x) => {
        if (!v) return;
        const by = piece.y + y;
        const bx = piece.x + x;
        if (by >= 0 && by < height && bx >= 0 && bx < width) view[by][bx] = color;
      });
    });
    return view;
  }, [board, piece, height, width]);

  const boardStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
    gridAutoRows: `${cellSize}px`,
  }), [width, cellSize]);

  return (
    <main className="tetris-app">
      <header className="top">
        <h1>Prolabs Tetris Web</h1>
        <p>Minecraft / Demons skin · strzałki + spacja</p>
      </header>

      <section className="layout">
        <div className="play-area">
          <div className="board-shell" ref={boardShellRef}>
            <div className={`board board-${sizeKey}`} style={boardStyle}>
              {display.flatMap((row, y) =>
                row.map((c, x) => <div key={`${x}-${y}`} className={`cell c${c}`} />)
              )}
            </div>
          </div>
        </div>

        <aside className="panel">
          <div className="card"><strong>Score:</strong> {score}</div>
          <div className="card"><strong>Level:</strong> {level}</div>
          <label className="card">Poziom trudności
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as keyof typeof DIFFICULTY)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="card">Rozmiar gry
            <select
              value={sizeKey}
              onChange={(e) => {
                const next = e.target.value as keyof typeof BOARD_SIZE;
                setSizeKey(next);
                const dims = BOARD_SIZE[next];
                setBoard(createBoard(dims.width, dims.height));
                setPiece(randomPiece(dims.width));
                setScore(0);
                setLevel(1);
                setGameOver(false);
                setPaused(false);
              }}
            >
              <option value="small">Mała (wąska)</option>
              <option value="medium">Średnia</option>
              <option value="max">Maksymalna</option>
            </select>
          </label>

          <div className="card controls">
            <div>← / → : ruch</div>
            <div>↓ : szybciej w dół</div>
            <div>Spacja: obrót</div>
            <div>P: pauza</div>
          </div>

          <button onClick={resetGame}>Nowa gra</button>
          <button onClick={() => setPaused((v) => !v)}>{paused ? "Wznów" : "Pauza"}</button>
          {gameOver && <div className="game-over">GAME OVER</div>}
        </aside>
      </section>
    </main>
  );
}
