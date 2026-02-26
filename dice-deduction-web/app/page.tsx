'use client';

import React, { useState, useRef, useEffect } from 'react';

// --- 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU ---
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
  locked: boolean; // Nếu là mảnh setup sẵn của level thì không được di chuyển
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

// --- 2. DỮ LIỆU GAME TĨNH ---
const ALL_PIECES: Piece[] = [
  { id: 'p1', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-200/80' },
  { id: 'p2', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-300/80' },
  { id: 'p3', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-400/80' },
  { id: 'p4', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-500/80' },
  { id: 'p5', shape: [[1, 1]], dots: [[1, 1]], color: 'bg-green-300/80' },
  { id: 'p6', shape: [[1, 1, 1]], dots: [[1, 0, 1]], color: 'bg-yellow-300/80' },
  { id: 'p7', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-purple-300/80' },
  { id: 'p8', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-pink-300/80' },
  { id: 'p9', shape: [[1, 1, 1, 1]], dots: [[1, 0, 0, 1]], color: 'bg-teal-300/80' },
  { id: 'p10', shape: [[1, 1], [1, 1]], dots: [[0, 1], [0, 0]], color: 'bg-orange-300/80' },
  { id: 'p11', shape: [[1, 1], [1, 1]], dots: [[1, 0], [0, 1]], color: 'bg-red-300/80' },
  { id: 'p12', shape: [[1, 1, 1], [1, 1, 1]], dots: [[0, 1, 0], [0, 0, 0]], color: 'bg-indigo-300/80' },
];

// Mô phỏng Challenge 1 từ sách luật
const CHALLENGES: Challenge[] = [
  {
    level: 1,
    difficulty: 'Starter',
    hints: [
      { type: 'col', index: 1, value: 4 }, // Mũi tên dưới chỉ lên cột index 1
      { type: 'col', index: 4, value: 8 }, // Mũi tên dưới chỉ lên cột index 4
      { type: 'row', index: 1, value: 5 }, // Mũi tên phải chỉ vào hàng index 1
      { type: 'row', index: 4, value: 7 }, // Mũi tên phải chỉ vào hàng index 4
    ],
    setupPieces: [
      // Giả lập set sẵn 2 mảnh cho level 1
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
  // --- STATE QUẢN LÝ TRÒ CHƠI ---
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [board, setBoard] = useState<(Cell | null)[][]>(Array(6).fill(null).map(() => Array(6).fill(null)));
  const [availablePieces, setAvailablePieces] = useState<Piece[]>([]);
  
  // Quản lý kéo thả & offset
  const [draggedPiece, setDraggedPiece] = useState<{ piece: Piece, source: 'tray' | 'board', startRow?: number, startCol?: number } | null>(null);
  const dragOffset = useRef({ r: 0, c: 0 }); // Lưu vị trí ô vuông người chơi cầm vào

  // Lịch sử (Undo)
  const [history, setHistory] = useState<{ board: (Cell | null)[][], availablePieces: Piece[] }[]>([]);

  // --- HÀM KHỞI TẠO LEVEL ---
  const loadLevel = (levelIndex: number) => {
    const challenge = CHALLENGES.find(c => c.level === levelIndex) || CHALLENGES[0];
    const newBoard = Array(6).fill(null).map(() => Array(6).fill(null));
    let usedPieceIds: string[] = [];

    // Đặt mảnh setup vào bảng
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
              color: 'bg-slate-400', // Mảnh cố định có màu tối hơn
              locked: true
            };
          }
        }
      }
    });

    setBoard(newBoard);
    setAvailablePieces(ALL_PIECES.filter(p => !usedPieceIds.includes(p.id)));
    setHistory([]); // Xóa lịch sử
  };

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel]);

  // --- HÀM TIỆN ÍCH ---
  const saveHistory = () => {
    setHistory(prev => [...prev, { 
      board: board.map(row => [...row]), 
      availablePieces: [...availablePieces] 
    }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setBoard(previousState.board);
    setAvailablePieces(previousState.availablePieces);
    setHistory(prev => prev.slice(0, -1));
  };

  // --- LOGIC KÉO THẢ TỪ KHAY ---
  const handleDragStartFromTray = (e: React.DragEvent<HTMLDivElement>, piece: Piece, rOffset: number, cOffset: number) => {
    dragOffset.current = { r: rOffset, c: cOffset };
    setDraggedPiece({ piece, source: 'tray' });
    e.dataTransfer.effectAllowed = "move";
  };

  // --- LOGIC BỐC MẢNH GHÉP TỪ BẢNG LÊN ---
  const handleDragStartFromBoard = (e: React.DragEvent<HTMLDivElement>, pieceId: string, clickRow: number, clickCol: number) => {
    const isLocked = board[clickRow][clickCol]?.locked;
    if (isLocked) { e.preventDefault(); return; }

    // Tìm toàn bộ tọa độ của mảnh này trên bảng
    let minR = 6, minC = 6, maxR = -1, maxC = -1;
    const dots: {r: number, c: number}[] = [];

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board[r][c]?.id === pieceId) {
          if (r < minR) minR = r;
          if (c < minC) minC = c;
          if (r > maxR) maxR = r;
          if (c > maxC) maxC = c;
          if (board[r][c]?.hasDot) dots.push({r, c});
        }
      }
    }

    // Tái tạo lại Shape và Dots
    const shape = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
    const dotsMatrix = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
    
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (board[r][c]?.id === pieceId) {
          shape[r - minR][c - minC] = 1;
          if (board[r][c]?.hasDot) dotsMatrix[r - minR][c - minC] = 1;
        }
      }
    }

    const reconstructedPiece: Piece = {
      id: pieceId,
      shape: shape,
      dots: dotsMatrix,
      color: board[minR][minC]?.color || 'bg-blue-200'
    };

    saveHistory(); // Lưu lịch sử trước khi nhấc lên
    
    // Xóa mảnh khỏi bảng hiện tại
    const newBoard = board.map(row => [...row]);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (newBoard[r][c]?.id === pieceId) newBoard[r][c] = null;
      }
    }
    setBoard(newBoard);

    // Tính toán offset
    dragOffset.current = { r: clickRow - minR, c: clickCol - minC };
    setDraggedPiece({ piece: reconstructedPiece, source: 'board', startRow: minR, startCol: minC });
  };

  // --- LOGIC THẢ XUỐNG BẢNG ---
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropRow: number, dropCol: number) => {
    e.preventDefault();
    if (!draggedPiece) return;

    // Trừ đi offset để lấy tọa độ gốc của mảnh ghép
    const targetRow = dropRow - dragOffset.current.r;
    const targetCol = dropCol - dragOffset.current.c;

    const { piece, source, startRow, startCol } = draggedPiece;
    const pShape = piece.shape;
    
    // Kiểm tra hợp lệ
    let isValid = true;
    if (targetRow < 0 || targetCol < 0 || targetRow + pShape.length > 6 || targetCol + pShape[0].length > 6) {
      isValid = false;
    } else {
      for (let r = 0; r < pShape.length; r++) {
        for (let c = 0; c < pShape[0].length; c++) {
          if (pShape[r][c] === 1 && board[targetRow + r][targetCol + c] !== null) isValid = false;
        }
      }
    }

    if (!isValid) {
      // Nếu không hợp lệ và bốc từ bảng, trả về vị trí cũ
      if (source === 'board' && startRow !== undefined && startCol !== undefined) {
         const restoredBoard = board.map(row => [...row]);
         for (let r = 0; r < pShape.length; r++) {
           for (let c = 0; c < pShape[0].length; c++) {
             if (pShape[r][c] === 1) restoredBoard[startRow + r][startCol + c] = { id: piece.id, hasDot: piece.dots[r][c] === 1, color: piece.color, locked: false };
           }
         }
         setBoard(restoredBoard);
      }
      setDraggedPiece(null);
      return;
    }

    if (source === 'tray') saveHistory();

    // Đặt vào bảng
    const newBoard = board.map(row => [...row]);
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          newBoard[targetRow + r][targetCol + c] = { id: piece.id, hasDot: piece.dots[r][c] === 1, color: piece.color, locked: false };
        }
      }
    }

    setBoard(newBoard);
    if (source === 'tray') setAvailablePieces(prev => prev.filter(p => p.id !== piece.id));
    setDraggedPiece(null);
  };

  // Trả mảnh ghép về khay nếu thả ra ngoài bảng
  const handleDropToTray = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedPiece && draggedPiece.source === 'board') {
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
    <div className="min-h-screen bg-slate-800 p-8 font-sans text-slate-800 flex justify-center" onDragOver={e => e.preventDefault()} onDrop={handleDropToTray}>
      <div className="flex gap-12 w-full max-w-6xl">
        
        {/* CỘT TRÁI: BẢNG CHƠI & ĐIỀU KHIỂN */}
        <div className="flex-none">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Dice Deduction</h1>
              <div className="flex gap-2">
                <select 
                  className="px-3 py-1 rounded bg-slate-700 text-white border border-slate-500"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(Number(e.target.value))}
                >
                  {CHALLENGES.map(c => <option key={c.level} value={c.level}>Level {c.level} - {c.difficulty}</option>)}
                </select>
                <button onClick={() => loadLevel(currentLevel)} className="px-3 py-1 bg-red-500/80 text-white rounded hover:bg-red-500">Reset</button>
                <button onClick={undo} disabled={history.length === 0} className="px-3 py-1 bg-slate-600 text-white rounded hover:bg-slate-500 disabled:opacity-50">Undo</button>
              </div>
            </div>
          </div>
          
          <div className="relative bg-[#2D3748] p-4 rounded-2xl inline-block shadow-2xl border-4 border-slate-900">
            {/* LƯỚI 6x6 CÓ PHÂN CHIA 2x2 CÁC KHU VỰC 3x3 */}
            <div className="grid grid-cols-6 grid-rows-6 gap-1 bg-slate-500 border-4 border-slate-900 rounded-lg overflow-hidden relative">
              
              {/* Vẽ đường chéo (cross) phân cách 4 khu vực 3x3 */}
              <div className="absolute top-0 bottom-0 left-1/2 w-2 -ml-1 bg-slate-900 pointer-events-none z-10"></div>
              <div className="absolute left-0 right-0 top-1/2 h-2 -mt-1 bg-slate-900 pointer-events-none z-10"></div>

              {board.map((row, rowIndex) => 
                row.map((cell, colIndex) => {
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                      onDragOver={e => e.preventDefault()}
                      draggable={cell !== null && !cell.locked}
                      onDragStart={(e) => cell && handleDragStartFromBoard(e, cell.id, rowIndex, colIndex)}
                      className={`
                        w-16 h-16 flex items-center justify-center transition-colors
                        ${cell ? (cell.locked ? 'bg-slate-400 cursor-not-allowed' : cell.color + ' cursor-grab active:cursor-grabbing border border-white/20') : 'bg-slate-200 hover:bg-slate-300'}
                      `}
                    >
                      {cell && cell.hasDot && <div className="w-5 h-5 bg-slate-900 rounded-full shadow-md pointer-events-none"></div>}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Render Mũi tên Gợi ý động theo Level */}
            {CHALLENGES.find(c => c.level === currentLevel)?.hints.map((hint, idx) => {
              if (hint.type === 'row') {
                return (
                  <div key={idx} className="absolute -right-14 bg-white border-4 border-slate-800 font-bold px-3 py-1 rounded-l-full shadow-md flex items-center gap-1 z-20"
                       style={{ top: `${(hint.index * 16.6) + 5}%` }}>
                    <span>◄</span> {hint.value}
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="absolute -bottom-12 bg-white border-4 border-slate-800 font-bold px-2 py-2 rounded-t-full shadow-md flex flex-col items-center z-20"
                       style={{ left: `${(hint.index * 16.6) + 4}%` }}>
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
          <p className="text-slate-300 text-sm mb-6 italic">💡 Click để xoay. Thả ra ngoài bảng để cất lại.</p>
          
          <div className="flex flex-wrap gap-6 items-start">
            {availablePieces.map(piece => (
              <div 
                key={piece.id}
                onClick={() => rotatePieceInTray(piece.id)}
                className="cursor-pointer hover:scale-105 transition-transform origin-center p-2 bg-slate-800 rounded-lg border border-slate-600 shadow-md"
              >
                <div className="flex flex-col gap-1">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx}
                          draggable={cell === 1}
                          onDragStart={(e) => cell === 1 && handleDragStartFromTray(e, piece, rIdx, cIdx)}
                          className={`w-10 h-10 flex items-center justify-center rounded-sm ${cell ? piece.color + ' border border-white/30 backdrop-blur-sm cursor-grab' : 'bg-transparent'}`}
                        >
                          {cell === 1 && piece.dots[rIdx][cIdx] === 1 && (
                            <div className="w-3.5 h-3.5 bg-slate-900 rounded-full pointer-events-none"></div>
                          )}
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
