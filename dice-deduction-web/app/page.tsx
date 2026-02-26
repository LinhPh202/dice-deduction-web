'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

// --- ĐỊNH NGHĨA KIỂU DỮ LIỆU ---
interface Piece {
  id: string;
  shape: number[][];
  dots: number[][];
  color: string;
}

interface Cell {
  id: string;
  hasDot: boolean;
  color: string;
  locked: boolean; 
}

interface Hint {
  type: 'row' | 'col';
  index: 0 | 1;
  value: number;
}

interface Challenge {
  level: number;
  difficulty: string;
  hints: Hint[];
  setupPieces: { id: string; row: number; col: number; rotatedShape: number[][]; rotatedDots: number[][] }[];
}

// --- DỮ LIỆU GAME (12 Mảnh ghép gốc) ---
const ALL_PIECES: Piece[] = [
  { id: 'p1', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-400' },
  { id: 'p2', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-400' },
  { id: 'p3', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-400' },
  { id: 'p4', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-400' },
  { id: 'p5', shape: [[1, 1]], dots: [[1, 1]], color: 'bg-green-400' },
  { id: 'p6', shape: [[1, 1, 1]], dots: [[1, 0, 1]], color: 'bg-yellow-400' },
  { id: 'p7', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-purple-400' },
  { id: 'p8', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-pink-400' },
  { id: 'p9', shape: [[1, 1, 1, 1]], dots: [[1, 0, 0, 1]], color: 'bg-teal-400' },
  { id: 'p10', shape: [[1, 1], [1, 1]], dots: [[0, 1], [0, 0]], color: 'bg-orange-400' },
  { id: 'p11', shape: [[1, 1], [1, 1]], dots: [[1, 0], [0, 1]], color: 'bg-red-400' },
  { id: 'p12', shape: [[1, 1, 1], [1, 1, 1]], dots: [[0, 1, 0], [0, 0, 0]], color: 'bg-indigo-400' },
];

const CHALLENGES: Challenge[] = [
  {
    level: 1,
    difficulty: 'Starter',
    hints: [
      { type: 'col', index: 0, value: 6 }, 
      { type: 'col', index: 1, value: 6 }, 
      { type: 'row', index: 0, value: 7 }, 
      { type: 'row', index: 1, value: 5 }, 
    ],
    setupPieces: [
      { id: 'p10', row: 4, col: 4, rotatedShape: [[1,1],[1,1]], rotatedDots: [[1,0],[0,1]] }, 
      { id: 'p1', row: 0, col: 1, rotatedShape: [[1,1,1]], rotatedDots: [[0,0,0]] }
    ]
  }
];

export default function DiceDeduction() {
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [board, setBoard] = useState<(Cell | null)[][]>(Array(6).fill(null).map(() => Array(6).fill(null)));
  const [availablePieces, setAvailablePieces] = useState<Piece[]>([]);
  const [isWon, setIsWon] = useState<boolean>(false);
  
  const [draggedPiece, setDraggedPiece] = useState<{ piece: Piece, source: 'tray' | 'board' } | null>(null);
  const dragOffset = useRef({ r: 0, c: 0 }); 
  const [history, setHistory] = useState<{ board: (Cell | null)[][], availablePieces: Piece[] }[]>([]);

  // Bật Polyfill để cho phép kéo thả mượt trên điện thoại
  useEffect(() => {
    polyfill({ dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride });
    const preventScroll = (e: TouchEvent) => {
      if (document.body.classList.contains('dnd-poly-drag-active')) e.preventDefault();
    };
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => window.removeEventListener('touchmove', preventScroll);
  }, []);

  const piecesOnBoard = useMemo(() => {
    const pieces: Piece[] = [];
    const processedIds = new Set<string>();

    board.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell && !processedIds.has(cell.id)) {
          processedIds.add(cell.id);
          let minR = 6, maxR = -1, minC = 6, maxC = -1;
          for (let ir = 0; ir < 6; ir++) {
            for (let ic = 0; ic < 6; ic++) {
              if (board[ir][ic]?.id === cell.id) {
                if (ir < minR) minR = ir;
                if (ir > maxR) maxR = ir;
                if (ic < minC) minC = ic;
                if (ic > maxC) maxC = ic;
              }
            }
          }
          const shape = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
          const dots = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
          for (let ir = minR; ir <= maxR; ir++) {
            for (let ic = minC; ic <= maxC; ic++) {
              if (board[ir][ic]?.id === cell.id) {
                shape[ir - minR][ic - minC] = 1;
                if (board[ir][ic]?.hasDot) dots[ir - minR][ic - minC] = 1;
              }
            }
          }
          pieces.push({ id: cell.id, shape, dots, color: cell.color });
        }
      });
    });
    return pieces;
  }, [board]);

  const loadLevel = (levelIndex: number) => {
    const challenge = CHALLENGES.find(c => c.level === levelIndex) || CHALLENGES[0];
    const newBoard = Array(6).fill(null).map(() => Array(6).fill(null));
    let usedPieceIds: string[] = [];

    challenge.setupPieces.forEach(setup => {
      const pieceData = ALL_PIECES.find(p => p.id === setup.id);
      if (!pieceData) return;
      usedPieceIds.push(setup.id);

      for (let r = 0; r < setup.rotatedShape.length; r++) {
        for (let c = 0; c < setup.rotatedShape[0].length; c++) {
          if (setup.rotatedShape[r][c] === 1) {
            newBoard[setup.row + r][setup.col + c] = {
              id: pieceData.id,
              hasDot: setup.rotatedDots[r][c] === 1,
              color: 'bg-slate-500', 
              locked: true
            };
          }
        }
      }
    });

    setBoard(newBoard);
    setAvailablePieces(ALL_PIECES.filter(p => !usedPieceIds.includes(p.id)));
    setHistory([]); 
    setIsWon(false);
  };

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel]);

  const getDieValue = (dots3x3: number[][]): number | null => {
    const str = dots3x3.flat().join('');
    const validFaces: Record<string, number> = {
      '000010000': 1, '100000001': 2, '001000100': 2,
      '100010001': 3, '001010100': 3, '101000101': 4,
      '101010101': 5, '101101101': 6, '111000111': 6 
    };
    return validFaces[str] || null;
  };

  useEffect(() => {
    const isFull = board.every(row => row.every(cell => cell !== null));
    if (!isFull) { setIsWon(false); return; }

    const quadrants = [{ r: 0, c: 0 }, { r: 0, c: 3 }, { r: 3, c: 0 }, { r: 3, c: 3 }];
    let diceValues: number[] = [];

    for (let q of quadrants) {
      let dots = [];
      for (let r = 0; r < 3; r++) {
        let row = [];
        for (let c = 0; c < 3; c++) {
          row.push(board[q.r + r][q.c + c]?.hasDot ? 1 : 0);
        }
        dots.push(row);
      }
      let val = getDieValue(dots);
      if (!val) return; 
      diceValues.push(val);
    }

    const currentChallenge = CHALLENGES.find(c => c.level === currentLevel);
    if (!currentChallenge) return;

    let won = true;
    for (let hint of currentChallenge.hints) {
      if (hint.type === 'row') {
        if (hint.index === 0 && diceValues[0] + diceValues[1] !== hint.value) won = false; 
        if (hint.index === 1 && diceValues[2] + diceValues[3] !== hint.value) won = false; 
      } else {
        if (hint.index === 0 && diceValues[0] + diceValues[2] !== hint.value) won = false; 
        if (hint.index === 1 && diceValues[1] + diceValues[3] !== hint.value) won = false; 
      }
    }
    setIsWon(won);
  }, [board, currentLevel]);

  const saveHistory = () => {
    setHistory(prev => [...prev, { board: board.map(row => [...row]), availablePieces: [...availablePieces] }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setBoard(previousState.board);
    setAvailablePieces(previousState.availablePieces);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleDragStartFromTray = (e: React.DragEvent<HTMLDivElement>, piece: Piece) => {
    setDraggedPiece({ piece, source: 'tray' });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartFromBoard = (e: React.DragEvent<HTMLDivElement>, pieceId: string, clickRow: number, clickCol: number) => {
    const isLocked = board[clickRow][clickCol]?.locked;
    if (isLocked) { e.preventDefault(); return; }

    const piece = piecesOnBoard.find(p => p.id === pieceId);
    if (!piece) return;

    let minR = 6, minC = 6;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board[r][c]?.id === pieceId) {
          if (r < minR) minR = r;
          if (c < minC) minC = c;
        }
      }
    }

    const rowOffset = clickRow - minR;
    const colOffset = clickCol - minC;
    dragOffset.current = { r: rowOffset, c: colOffset };
    setDraggedPiece({ piece, source: 'board' });

    // Tính toán lại Offset động theo kích thước màn hình
    const ghostEl = document.getElementById(`ghost-${pieceId}`);
    if (ghostEl) {
      const targetRect = (e.target as HTMLElement).getBoundingClientRect();
      const cellSize = targetRect.width; // Lấy kích thước thực tế của 1 ô
      const gap = 4; // Khoảng cách giữa các ô
      e.dataTransfer.setDragImage(ghostEl, colOffset * (cellSize + gap) + cellSize/2, rowOffset * (cellSize + gap) + cellSize/2);
    }
  };

  const handleDropOnBoard = (e: React.DragEvent<HTMLDivElement>, dropRow: number, dropCol: number) => {
    e.preventDefault();
    e.stopPropagation(); 
    
    if (!draggedPiece) return;

    const targetRow = dropRow - dragOffset.current.r;
    const targetCol = dropCol - dragOffset.current.c;
    const { piece, source } = draggedPiece;
    const pShape = piece.shape;
    
    if (targetRow < 0 || targetCol < 0 || targetRow + pShape.length > 6 || targetCol + pShape[0].length > 6) return;
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          const existingCell = board[targetRow + r][targetCol + c];
          if (existingCell && existingCell.id !== piece.id) return; 
        }
      }
    }

    saveHistory();
    const newBoard = board.map(row => [...row]);

    if (source === 'board') {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (newBoard[r][c]?.id === piece.id) newBoard[r][c] = null;
        }
      }
    } else {
      setAvailablePieces(prev => prev.filter(p => p.id !== piece.id));
    }

    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          newBoard[targetRow + r][targetCol + c] = { id: piece.id, hasDot: piece.dots[r][c] === 1, color: piece.color, locked: false };
        }
      }
    }

    setBoard(newBoard);
    setDraggedPiece(null);
  };

  const handleDropOnTray = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedPiece && draggedPiece.source === 'board') {
      saveHistory();
      const newBoard = board.map(row => [...row]);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (newBoard[r][c]?.id === draggedPiece.piece.id) newBoard[r][c] = null;
        }
      }
      setBoard(newBoard);
      setAvailablePieces(prev => [...prev, draggedPiece.piece]);
      setDraggedPiece(null);
    }
  };

  const rotatePieceInTray = (pieceId: string) => {
    setAvailablePieces(prevPieces => 
      prevPieces.map(piece => {
        if (piece.id === pieceId) {
          const newShape = piece.shape[0].map((_, index) => piece.shape.map(row => row[index]).reverse());
          const newDots = piece.dots[0].map((_, index) => piece.dots.map(row => row[index]).reverse());
          return { ...piece, shape: newShape, dots: newDots };
        }
        return piece;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-800 p-2 sm:p-4 md:p-8 font-sans text-slate-800 flex justify-center relative overflow-hidden" onDragOver={e => e.preventDefault()} onDrop={handleDropOnTray}>
      
      {/* HIỆU ỨNG CHIẾN THẮNG */}
      {isWon && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center transform scale-105 animate-bounce">
            <h2 className="text-4xl md:text-5xl font-extrabold text-green-500 mb-4">CHÍNH XÁC! 🎉</h2>
            <p className="text-slate-600 md:text-xl font-medium mb-6">Tư duy suy luận tuyệt vời!</p>
            <button onClick={() => loadLevel(currentLevel + 1)} className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 shadow-lg">
              Chơi màn tiếp theo
            </button>
          </div>
        </div>
      )}

      {/* KHU VỰC ẨN: Render Ghost Image tự co giãn theo kích thước thực */}
      <div className="absolute top-[-9999px] left-[-9999px] pointer-events-none">
        {piecesOnBoard.map(piece => (
          <div id={`ghost-${piece.id}`} key={piece.id} className="flex flex-col gap-1 p-2 bg-transparent">
            {piece.shape.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-1">
                {row.map((cell, cIdx) => (
                  <div key={cIdx} className={`w-9 h-9 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center rounded-md ${cell ? piece.color : 'bg-transparent'}`}>
                    {cell === 1 && piece.dots[rIdx][cIdx] === 1 && <div className="w-4 h-4 md:w-5 md:h-5 bg-slate-900 rounded-full shadow-md"></div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 w-full max-w-6xl items-center lg:items-start">
        
        {/* PHẦN TRÊN: BẢNG CHƠI */}
        <div className="flex-none w-full max-w-sm sm:max-w-md lg:max-w-lg">
          <div className="flex justify-between items-center mb-3 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Dice Deduction</h1>
            <div className="flex gap-2">
              <button onClick={() => loadLevel(currentLevel)} className="px-3 py-1 bg-red-500/90 text-white rounded text-sm md:text-base font-medium shadow">Reset</button>
              <button onClick={undo} disabled={history.length === 0} className="px-3 py-1 bg-slate-600 text-white rounded text-sm md:text-base font-medium shadow disabled:opacity-50">Undo</button>
            </div>
          </div>
          
          <div className="relative bg-[#2D3748] p-3 md:p-4 rounded-2xl shadow-2xl border-4 border-slate-900 mx-auto w-fit">
            <div className="grid grid-cols-6 grid-rows-6 gap-1 bg-slate-500 border-4 border-slate-900 rounded-lg overflow-hidden relative">
              <div className="absolute top-0 bottom-0 left-1/2 w-1.5 md:w-2 -ml-[3px] md:-ml-1 bg-slate-900 pointer-events-none z-10 rounded-full"></div>
              <div className="absolute left-0 right-0 top-1/2 h-1.5 md:h-2 -mt-[3px] md:-mt-1 bg-slate-900 pointer-events-none z-10 rounded-full"></div>

              {board.map((row, rowIndex) => 
                row.map((cell, colIndex) => {
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      onDrop={(e) => handleDropOnBoard(e, rowIndex, colIndex)}
                      onDragOver={e => e.preventDefault()}
                      draggable={cell !== null && !cell.locked}
                      onDragStart={(e) => cell && handleDragStartFromBoard(e, cell.id, rowIndex, colIndex)}
                      className={`w-9 h-9 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center transition-colors
                        ${cell ? (cell.locked ? 'bg-slate-600 cursor-not-allowed border border-white/10 shadow-inner' : cell.color + ' cursor-grab active:cursor-grabbing border border-white/30') : 'bg-slate-100/90 hover:bg-slate-300'}
                      `}
                    >
                      {cell && cell.hasDot && <div className="w-3.5 h-3.5 md:w-5 md:h-5 bg-slate-900 rounded-full shadow-md pointer-events-none z-20"></div>}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Gợi ý mũi tên bám viền */}
            {CHALLENGES.find(c => c.level === currentLevel)?.hints.map((hint, idx) => {
              if (hint.type === 'row') {
                return (
                  <div key={idx} className="absolute -right-8 md:-right-12 bg-white border-2 md:border-4 border-slate-800 font-bold px-1.5 py-0.5 md:px-3 md:py-1 rounded-l-full shadow-md flex items-center gap-1 z-20 text-sm md:text-lg" style={{ top: hint.index === 0 ? '18%' : '68%' }}>
                    <span>◄</span> {hint.value}
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="absolute -bottom-8 md:-bottom-12 bg-white border-2 md:border-4 border-slate-800 font-bold px-1.5 py-1 md:px-2 md:py-2 rounded-t-full shadow-md flex flex-col items-center z-20 text-sm md:text-lg" style={{ left: hint.index === 0 ? '20%' : '70%' }}>
                    <span>▲</span> {hint.value}
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* PHẦN DƯỚI: KHAY MẢNH GHÉP (Tối ưu để hiển thị gọn trên điện thoại dọc) */}
        <div className="w-full lg:flex-1 bg-slate-700 p-4 rounded-2xl shadow-inner mt-4 md:mt-0">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg md:text-xl font-bold text-white">Khay mảnh ghép</h2>
            <select className="px-2 py-1 text-sm rounded bg-slate-800 text-white border border-slate-500 font-medium" value={currentLevel} onChange={(e) => setCurrentLevel(Number(e.target.value))}>
              {CHALLENGES.map(c => <option key={c.level} value={c.level}>Lv {c.level} - {c.difficulty}</option>)}
            </select>
          </div>
          <p className="text-slate-300 text-xs md:text-sm mb-4 italic">💡 Chạm để xoay. Kéo thả về khay để cất.</p>
          
          <div className="flex flex-wrap gap-2 md:gap-4 justify-center items-center bg-slate-800/50 p-3 rounded-xl min-h-[150px]">
            {availablePieces.map(piece => (
              <div 
                key={piece.id}
                onClick={() => rotatePieceInTray(piece.id)}
                draggable
                onDragStart={(e) => handleDragStartFromTray(e, piece)}
                onDragEnd={() => setDraggedPiece(null)}
                className="cursor-pointer hover:scale-105 transition-transform origin-center p-1 md:p-2 bg-slate-800 rounded-lg border border-slate-600 shadow-md"
              >
                <div className="flex flex-col gap-[2px] md:gap-1 pointer-events-none">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-[2px] md:gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx}
                          onPointerDown={() => dragOffset.current = { r: rIdx, c: cIdx }}
                          className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center rounded-sm pointer-events-auto ${cell ? piece.color + ' border border-white/30 cursor-grab active:cursor-grabbing' : 'bg-transparent'}`}
                        >
                          {cell === 1 && piece.dots[rIdx][cIdx] === 1 && <div className="w-2 h-2 md:w-3.5 md:h-3.5 bg-slate-900 rounded-full pointer-events-none"></div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availablePieces.length === 0 && <p className="text-slate-400 font-medium text-sm">Bảng đã đầy! Đang kiểm tra...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
