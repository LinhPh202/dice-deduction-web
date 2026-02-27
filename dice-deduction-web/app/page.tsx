'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';

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
  const [history, setHistory] = useState<{ board: (Cell | null)[][], availablePieces: Piece[] }[]>([]);

  const boardCellRef = useRef<HTMLDivElement>(null);

  // --- THÊM boardRow & boardCol ĐỂ LƯU VỊ TRÍ GỐC TRÊN BẢNG ---
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    piece: Piece | null;
    source: 'tray' | 'board' | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    clickR: number; 
    clickC: number; 
    boardRow?: number;
    boardCol?: number;
    startTime: number;
    cellWidth: number;
  }>({ isDragging: false, piece: null, source: null, startX: 0, startY: 0, currentX: 0, currentY: 0, clickR: 0, clickC: 0, startTime: 0, cellWidth: 48 });

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

  const handlePointerDown = (e: React.PointerEvent, piece: Piece, source: 'tray' | 'board', clickR: number, clickC: number, boardRow?: number, boardCol?: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; 
    e.preventDefault();
    e.stopPropagation();

    let targetCellWidth = 48; 
    if (boardCellRef.current) {
      targetCellWidth = boardCellRef.current.getBoundingClientRect().width;
    }

    if (source === 'board') {
      saveHistory();
      const newBoard = board.map(row => [...row]);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (newBoard[r][c]?.id === piece.id) newBoard[r][c] = null;
        }
      }
      setBoard(newBoard);
    } else {
      setAvailablePieces(prev => prev.filter(p => p.id !== piece.id));
    }

    setDragState({
      isDragging: true, piece, source,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      clickR, clickC, boardRow, boardCol,
      startTime: Date.now(),
      cellWidth: targetCellWidth
    });
  };

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      setDragState(prev => ({ ...prev, currentX: e.clientX, currentY: e.clientY }));
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dt = Date.now() - dragState.startTime;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      // Phân biệt Click nhanh (để xoay hoặc trả về chỗ cũ) vs Drag kéo thả (ngưỡng 15px)
      if (dt < 250 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        if (dragState.source === 'tray') {
          // Xoay mảnh 90 độ
          const p = dragState.piece!;
          const newShape = p.shape[0].map((_, index) => p.shape.map(row => row[index]).reverse());
          const newDots = p.dots[0].map((_, index) => p.dots.map(row => row[index]).reverse());
          setAvailablePieces(prev => [...prev, { ...p, shape: newShape, dots: newDots }]);
        } else if (dragState.source === 'board' && dragState.boardRow !== undefined && dragState.boardCol !== undefined) {
          // Nhấn nhầm trên bảng -> Trả về đúng vị trí cũ
          const newBoard = board.map(row => [...row]);
          const pShape = dragState.piece!.shape;
          for (let r = 0; r < pShape.length; r++) {
            for (let c = 0; c < pShape[0].length; c++) {
              if (pShape[r][c] === 1) {
                newBoard[dragState.boardRow! + r][dragState.boardCol! + c] = { id: dragState.piece!.id, hasDot: dragState.piece!.dots[r][c] === 1, color: dragState.piece!.color, locked: false };
              }
            }
          }
          setBoard(newBoard);
        }
        resetDrag();
        return;
      }

      // Xử lý kéo thả vào bảng
      const dropEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]') as HTMLElement;
      let isDroppedSuccess = false;

      if (dropEl) {
        const dropRow = parseInt(dropEl.getAttribute('data-row') || '-1', 10);
        const dropCol = parseInt(dropEl.getAttribute('data-col') || '-1', 10);

        if (dropRow >= 0 && dropCol >= 0) {
          const targetRow = dropRow - dragState.clickR;
          const targetCol = dropCol - dragState.clickC;
          const pShape = dragState.piece!.shape;

          let isValid = true;
          if (targetRow < 0 || targetCol < 0 || targetRow + pShape.length > 6 || targetCol + pShape[0].length > 6) isValid = false;
          else {
            for (let r = 0; r < pShape.length; r++) {
              for (let c = 0; c < pShape[0].length; c++) {
                if (pShape[r][c] === 1 && board[targetRow + r][targetCol + c] !== null) isValid = false;
              }
            }
          }

          if (isValid) {
            if (dragState.source === 'tray') saveHistory();
            const newBoard = board.map(row => [...row]);
            for (let r = 0; r < pShape.length; r++) {
              for (let c = 0; c < pShape[0].length; c++) {
                if (pShape[r][c] === 1) {
                  newBoard[targetRow + r][targetCol + c] = { id: dragState.piece!.id, hasDot: dragState.piece!.dots[r][c] === 1, color: dragState.piece!.color, locked: false };
                }
              }
            }
            setBoard(newBoard);
            isDroppedSuccess = true;
          }
        }
      }

      // Thả không thành công (Ra ngoài bảng hoặc bị cấn) -> Trả về khay
      if (!isDroppedSuccess) {
        setAvailablePieces(prev => [...prev, dragState.piece!]);
      }

      resetDrag();
    };

    const resetDrag = () => {
      setDragState({ isDragging: false, piece: null, source: null, startX: 0, startY: 0, currentX: 0, currentY: 0, clickR: 0, clickC: 0, boardRow: undefined, boardCol: undefined, startTime: 0, cellWidth: 48 });
    };

    const preventTouchScroll = (e: TouchEvent) => e.preventDefault();

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', preventTouchScroll, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [dragState, board]);

  const extractPieceFromBoard = (pieceId: string): { piece: Piece, r: number, c: number } | null => {
    let minR = 6, maxR = -1, minC = 6, maxC = -1;
    let color = '';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board[r][c]?.id === pieceId) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
          color = board[r][c]!.color;
        }
      }
    }
    if (minR === 6) return null;
    
    const shape = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
    const dots = Array(maxR - minR + 1).fill(0).map(() => Array(maxC - minC + 1).fill(0));
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (board[r][c]?.id === pieceId) {
          shape[r - minR][c - minC] = 1;
          if (board[r][c]?.hasDot) dots[r - minR][c - minC] = 1;
        }
      }
    }
    return { piece: { id: pieceId, shape, dots, color }, r: minR, c: minC };
  };

  return (
    <div className="min-h-screen bg-slate-800 p-2 sm:p-4 md:p-8 font-sans text-slate-800 flex justify-center relative select-none touch-none">
      
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

      {/* DRAG OVERLAY: Mảnh ghép đang bay theo ngón tay */}
      {dragState.isDragging && dragState.piece && (
        <div 
          className="fixed z-[9999] pointer-events-none drop-shadow-2xl opacity-90 transition-transform scale-105"
          style={{
            left: dragState.currentX - dragState.clickC * (dragState.cellWidth + 4) - dragState.cellWidth / 2,
            top: dragState.currentY - dragState.clickR * (dragState.cellWidth + 4) - dragState.cellWidth / 2,
          }}
        >
          <div className="flex flex-col gap-1">
            {dragState.piece.shape.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-1">
                {row.map((cell, cIdx) => (
                  <div key={cIdx} 
                       className={`flex items-center justify-center rounded-md ${cell ? dragState.piece!.color : 'bg-transparent'}`}
                       style={{ width: dragState.cellWidth, height: dragState.cellWidth }} 
                  >
                    {cell === 1 && dragState.piece!.dots[rIdx][cIdx] === 1 && <div className="w-4 h-4 md:w-5 md:h-5 bg-slate-900 rounded-full"></div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 w-full max-w-6xl items-center lg:items-start">
        
        {/* BẢNG CHƠI */}
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
                      ref={rowIndex === 0 && colIndex === 0 ? boardCellRef : null} 
                      data-cell="true"
                      data-row={rowIndex}
                      data-col={colIndex}
                      onPointerDown={(e) => {
                        if (cell && !cell.locked) {
                          const extracted = extractPieceFromBoard(cell.id);
                          // Bắt thêm tọa độ gốc trên bảng (extracted.r, extracted.c)
                          if (extracted) handlePointerDown(e, extracted.piece, 'board', rowIndex - extracted.r, colIndex - extracted.c, extracted.r, extracted.c);
                        }
                      }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center transition-colors
                        ${cell ? (cell.locked ? 'bg-slate-600 border border-white/10 shadow-inner' : cell.color + ' border border-white/30 cursor-pointer') : 'bg-slate-100/90'}
                      `}
                    >
                      {cell && cell.hasDot && <div className="w-3.5 h-3.5 md:w-5 md:h-5 bg-slate-900 rounded-full shadow-md pointer-events-none z-20"></div>}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* MŨI TÊN GỢI Ý ĐÃ ĐƯỢC CHỈNH XUỐNG THẤP */}
            {CHALLENGES.find(c => c.level === currentLevel)?.hints.map((hint, idx) => {
              if (hint.type === 'row') {
                return (
                  <div key={idx} className="absolute -right-8 md:-right-12 bg-white border-2 md:border-4 border-slate-800 font-bold px-1.5 py-0.5 md:px-3 md:py-1 rounded-l-full shadow-md flex items-center gap-1 z-20 text-sm md:text-lg" style={{ top: hint.index === 0 ? '18%' : '68%' }}>
                    <span>◄</span> {hint.value}
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="absolute -bottom-12 md:-bottom-16 bg-white border-2 md:border-4 border-slate-800 font-bold px-1.5 py-1 md:px-2 md:py-2 rounded-t-full shadow-md flex flex-col items-center z-20 text-sm md:text-lg" style={{ left: hint.index === 0 ? '20%' : '70%' }}>
                    <span>▲</span> {hint.value}
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* KHAY MẢNH GHÉP */}
        <div className="w-full lg:flex-1 bg-slate-700 p-4 rounded-2xl shadow-inner mt-4 md:mt-0">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg md:text-xl font-bold text-white">Khay mảnh ghép</h2>
            <select className="px-2 py-1 text-sm rounded bg-slate-800 text-white border border-slate-500 font-medium cursor-pointer" value={currentLevel} onChange={(e) => setCurrentLevel(Number(e.target.value))}>
              {CHALLENGES.map(c => <option key={c.level} value={c.level}>Lv {c.level} - {c.difficulty}</option>)}
            </select>
          </div>
          <p className="text-slate-300 text-xs md:text-sm mb-4 italic">💡 Chạm nhanh để xoay. Nhấn giữ để bốc lên.</p>
          
          <div className="flex flex-wrap gap-2 md:gap-4 justify-center items-center bg-slate-800/50 p-3 rounded-xl min-h-[150px]">
            {availablePieces.map(piece => (
              <div key={piece.id} className="p-1 md:p-2 bg-slate-800 rounded-lg border border-slate-600 shadow-md">
                <div className="flex flex-col gap-[2px] md:gap-1">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-[2px] md:gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx}
                          onPointerDown={(e) => { if(cell) handlePointerDown(e, piece, 'tray', rIdx, cIdx) }}
                          className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-sm ${cell ? piece.color + ' border border-white/30 cursor-pointer' : 'bg-transparent'}`}
                        >
                          {cell === 1 && piece.dots[rIdx][cIdx] === 1 && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-slate-900 rounded-full pointer-events-none"></div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availablePieces.length === 0 && !isWon && <p className="text-slate-400 font-medium text-sm">Đang suy luận...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
