'use client';

import React, { useState, useRef, useMemo } from 'react';

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
  index: number;
  value: number;
}

interface Challenge {
  level: number;
  difficulty: string;
  hints: Hint[];
  setupPieces: { id: string; row: number; col: number; rotatedShape: number[][]; rotatedDots: number[][] }[];
}

// --- DỮ LIỆU GAME (12 Mảnh ghép gốc của Dice Deduction) ---
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
      { type: 'col', index: 1, value: 4 }, 
      { type: 'col', index: 4, value: 8 }, 
      { type: 'row', index: 1, value: 5 }, 
      { type: 'row', index: 4, value: 7 }, 
    ],
    setupPieces: [
      { id: 'p10', row: 4, col: 4, rotatedShape: [[1,1],[1,1]], rotatedDots: [[1,0],[0,1]] }, 
      { id: 'p1', row: 0, col: 1, rotatedShape: [[1,1,1]], rotatedDots: [[0,0,0]] }
    ]
  },
  {
    level: 2,
    difficulty: 'Starter',
    hints: [{ type: 'row', index: 0, value: 6 }, { type: 'col', index: 2, value: 8 }],
    setupPieces: []
  }
];

export default function DiceDeduction() {
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [board, setBoard] = useState<(Cell | null)[][]>(Array(6).fill(null).map(() => Array(6).fill(null)));
  const [availablePieces, setAvailablePieces] = useState<Piece[]>([]);
  
  // Quản lý kéo thả
  const [draggedPiece, setDraggedPiece] = useState<{ piece: Piece, source: 'tray' | 'board' } | null>(null);
  const dragOffset = useRef({ r: 0, c: 0 }); 

  // Undo System
  const [history, setHistory] = useState<{ board: (Cell | null)[][], availablePieces: Piece[] }[]>([]);

  // Tái tạo lại các khối trên bảng để làm Ghost Image
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
              color: 'bg-slate-400', 
              locked: true
            };
          }
        }
      }
    });

    setBoard(newBoard);
    setAvailablePieces(ALL_PIECES.filter(p => !usedPieceIds.includes(p.id)));
    setHistory([]); 
  };

  React.useEffect(() => { loadLevel(currentLevel); }, [currentLevel]);

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

  // --- KÉO TỪ KHAY ---
  const handleDragStartFromTray = (e: React.DragEvent<HTMLDivElement>, piece: Piece) => {
    setDraggedPiece({ piece, source: 'tray' });
    e.dataTransfer.effectAllowed = "move";
  };

  // --- KÉO TỪ BẢNG LÊN ---
  const handleDragStartFromBoard = (e: React.DragEvent<HTMLDivElement>, pieceId: string, clickRow: number, clickCol: number) => {
    const isLocked = board[clickRow][clickCol]?.locked;
    if (isLocked) { e.preventDefault(); return; }

    const piece = piecesOnBoard.find(p => p.id === pieceId);
    if (!piece) return;

    // Tìm ô góc trên cùng bên trái của mảnh
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

    // Cài đặt Ghost Image đầy đủ hình dạng
    const ghostEl = document.getElementById(`ghost-${pieceId}`);
    if (ghostEl) {
      // 68px = 64px width + 4px gap. Cộng thêm 32px để con trỏ chuột nằm giữa ô đang cầm.
      e.dataTransfer.setDragImage(ghostEl, colOffset * 68 + 32, rowOffset * 68 + 32);
    }
  };

  // --- THẢ VÀO BẢNG ---
  const handleDropOnBoard = (e: React.DragEvent<HTMLDivElement>, dropRow: number, dropCol: number) => {
    e.preventDefault();
    e.stopPropagation(); // <-- DÒNG MỚI THÊM VÀO ĐỂ CHẶN LỖI NỔI BỌT
    
    if (!draggedPiece) return;

    const targetRow = dropRow - dragOffset.current.r;
    const targetCol = dropCol - dragOffset.current.c;
    const { piece, source } = draggedPiece;
    const pShape = piece.shape;
    
    // Check hợp lệ
    if (targetRow < 0 || targetCol < 0 || targetRow + pShape.length > 6 || targetCol + pShape[0].length > 6) return;
    
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          const existingCell = board[targetRow + r][targetCol + c];
          if (existingCell && existingCell.id !== piece.id) return; // Đâm vào mảnh khác
        }
      }
    }

    saveHistory();
    const newBoard = board.map(row => [...row]);

    // Xóa mảnh ở chỗ cũ
    if (source === 'board') {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (newBoard[r][c]?.id === piece.id) newBoard[r][c] = null;
        }
      }
    } else {
      setAvailablePieces(prev => prev.filter(p => p.id !== piece.id));
    }

    // Đặt mảnh vào vị trí mới
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

  // --- THẢ RA NGOÀI (Cất về khay) ---
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
    <div className="min-h-screen bg-slate-800 p-8 font-sans text-slate-800 flex justify-center" onDragOver={e => e.preventDefault()} onDrop={handleDropOnTray}>
      
      {/* KHU VỰC ẨN: Render Ghost Image cho Drag & Drop từ bảng */}
      <div className="absolute top-[-9999px] left-[-9999px] pointer-events-none">
        {piecesOnBoard.map(piece => (
          <div id={`ghost-${piece.id}`} key={piece.id} className="flex flex-col gap-1 p-2 bg-transparent">
            {piece.shape.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-1">
                {row.map((cell, cIdx) => (
                  <div key={cIdx} className={`w-16 h-16 flex items-center justify-center rounded-md ${cell ? piece.color : 'bg-transparent'}`}>
                    {cell === 1 && piece.dots[rIdx][cIdx] === 1 && <div className="w-5 h-5 bg-slate-900 rounded-full shadow-md"></div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-12 w-full max-w-6xl">
        {/* CỘT TRÁI: BẢNG CHƠI */}
        <div className="flex-none">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Dice Deduction</h1>
              <div className="flex gap-2">
                <select className="px-3 py-1 rounded bg-slate-700 text-white border border-slate-500" value={currentLevel} onChange={(e) => setCurrentLevel(Number(e.target.value))}>
                  {CHALLENGES.map(c => <option key={c.level} value={c.level}>Level {c.level} - {c.difficulty}</option>)}
                </select>
                <button onClick={() => loadLevel(currentLevel)} className="px-3 py-1 bg-red-500/90 text-white rounded shadow hover:bg-red-500">Reset</button>
                <button onClick={undo} disabled={history.length === 0} className="px-3 py-1 bg-slate-600 text-white rounded shadow hover:bg-slate-500 disabled:opacity-50">Undo</button>
              </div>
            </div>
          </div>
          
          <div className="relative bg-[#2D3748] p-4 rounded-2xl inline-block shadow-2xl border-4 border-slate-900">
            {/* LƯỚI 6x6 */}
            <div className="grid grid-cols-6 grid-rows-6 gap-1 bg-slate-500 border-4 border-slate-900 rounded-lg overflow-hidden relative">
              
              {/* VẠCH CHIA 4 KHU VỰC 3x3 RÕ RÀNG */}
              <div className="absolute top-0 bottom-0 left-1/2 w-2 -ml-1 bg-slate-900 pointer-events-none z-10 rounded-full"></div>
              <div className="absolute left-0 right-0 top-1/2 h-2 -mt-1 bg-slate-900 pointer-events-none z-10 rounded-full"></div>

              {board.map((row, rowIndex) => 
                row.map((cell, colIndex) => {
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      onDrop={(e) => handleDropOnBoard(e, rowIndex, colIndex)}
                      onDragOver={e => e.preventDefault()}
                      draggable={cell !== null && !cell.locked}
                      onDragStart={(e) => cell && handleDragStartFromBoard(e, cell.id, rowIndex, colIndex)}
                      className={`w-16 h-16 flex items-center justify-center transition-colors
                        ${cell ? (cell.locked ? 'bg-slate-400 cursor-not-allowed border border-white/10' : cell.color + ' cursor-grab active:cursor-grabbing border border-white/30') : 'bg-slate-100/90 hover:bg-slate-300'}
                      `}
                    >
                      {cell && cell.hasDot && <div className="w-5 h-5 bg-slate-900 rounded-full shadow-md pointer-events-none z-20"></div>}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Gợi ý mũi tên */}
            {CHALLENGES.find(c => c.level === currentLevel)?.hints.map((hint, idx) => {
              if (hint.type === 'row') {
                return (
                  <div key={idx} className="absolute -right-14 bg-white border-4 border-slate-800 font-bold px-3 py-1 rounded-l-full shadow-md flex items-center gap-1 z-20" style={{ top: `${(hint.index * 16.6) + 4}%` }}>
                    <span>◄</span> {hint.value}
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="absolute -bottom-12 bg-white border-4 border-slate-800 font-bold px-2 py-2 rounded-t-full shadow-md flex flex-col items-center z-20" style={{ left: `${(hint.index * 16.6) + 4}%` }}>
                    <span>▲</span> {hint.value}
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* CỘT PHẢI: KHAY CHỨA MẢNH GHÉP */}
        <div className="flex-1 bg-slate-700 p-6 rounded-2xl shadow-inner overflow-y-auto max-h-[85vh]">
          <h2 className="text-xl font-bold text-white mb-2">Khay mảnh ghép</h2>
          <p className="text-slate-300 text-sm mb-6 italic">💡 Click để xoay. Thả ra vùng xám để cất lại.</p>
          
          <div className="flex flex-wrap gap-6 items-start">
            {availablePieces.map(piece => (
              <div 
                key={piece.id}
                onClick={() => rotatePieceInTray(piece.id)}
                draggable
                onDragStart={(e) => handleDragStartFromTray(e, piece)}
                onDragEnd={() => setDraggedPiece(null)}
                className="cursor-pointer hover:scale-105 transition-transform origin-center p-2 bg-slate-800 rounded-lg border border-slate-600 shadow-md"
              >
                <div className="flex flex-col gap-1 pointer-events-none">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx}
                          onMouseDown={() => dragOffset.current = { r: rIdx, c: cIdx }}
                          className={`w-10 h-10 flex items-center justify-center rounded-sm pointer-events-auto ${cell ? piece.color + ' border border-white/30 cursor-grab active:cursor-grabbing' : 'bg-transparent'}`}
                        >
                          {cell === 1 && piece.dots[rIdx][cIdx] === 1 && <div className="w-3.5 h-3.5 bg-slate-900 rounded-full pointer-events-none"></div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availablePieces.length === 0 && <p className="text-slate-400">Không còn khối nào!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
