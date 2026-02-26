'use client';

import React, { useState } from 'react';

// 1. DỮ LIỆU TĨNH: 12 MẢNH GHÉP CHUẨN CỦA DICE DEDUCTION
// 1 đại diện cho ô có khối nhựa, 0 đại diện cho ô trống (nếu là khối phức tạp)
// dots: 1 là có chấm đen, 0 là không có
const INITIAL_PIECES = [
  { id: 'p1', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-200/60' },          // 1x2 trống
  { id: 'p2', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-200/60' },          // 1x2 trống
  { id: 'p3', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-200/60' },          // 1x2 trống
  { id: 'p4', shape: [[1, 1]], dots: [[0, 0]], color: 'bg-blue-200/60' },          // 1x2 trống
  { id: 'p5', shape: [[1, 1]], dots: [[1, 1]], color: 'bg-green-200/60' },         // 1x2 có 2 chấm
  { id: 'p6', shape: [[1, 1, 1]], dots: [[1, 0, 1]], color: 'bg-yellow-200/60' },  // 1x3 có 2 chấm 2 đầu
  { id: 'p7', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-purple-200/60' },  // 1x3 có 1 chấm
  { id: 'p8', shape: [[1, 1, 1]], dots: [[1, 0, 0]], color: 'bg-pink-200/60' },    // 1x3 có 1 chấm
  { id: 'p9', shape: [[1, 1, 1, 1]], dots: [[1, 0, 0, 1]], color: 'bg-teal-200/60' }, // 1x4 có 2 chấm 2 đầu
  { id: 'p10', shape: [[1, 1], [1, 1]], dots: [[0, 1], [0, 0]], color: 'bg-orange-200/60' }, // 2x2 có 1 chấm góc
  { id: 'p11', shape: [[1, 1], [1, 1]], dots: [[1, 0], [0, 1]], color: 'bg-red-200/60' },    // 2x2 có 2 chấm chéo
  { id: 'p12', shape: [[1, 1, 1], [1, 1, 1]], dots: [[0, 1, 0], [0, 0, 0]], color: 'bg-indigo-200/60' }, // 2x3 có 1 chấm cạnh
];

export default function DiceDeduction() {
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(6).fill(null)));
  const [availablePieces, setAvailablePieces] = useState(INITIAL_PIECES);
  const [draggedPiece, setDraggedPiece] = useState(null);

  // LOGIC XOAY MA TRẬN 90 ĐỘ (Thuật toán Transpose & Reverse)
  const rotatePiece = (pieceId) => {
    setAvailablePieces(prevPieces => 
      prevPieces.map(piece => {
        if (piece.id === pieceId) {
          // Xoay shape 90 độ theo chiều kim đồng hồ
          const newShape = piece.shape[0].map((_, index) => 
            piece.shape.map(row => row[index]).reverse()
          );
          // Xoay vị trí chấm đen (dots) tương ứng
          const newDots = piece.dots[0].map((_, index) => 
            piece.dots.map(row => row[index]).reverse()
          );
          return { ...piece, shape: newShape, dots: newDots };
        }
        return piece;
      })
    );
  };

  // LOGIC KÉO THẢ
  const handleDragStart = (e, piece) => {
    setDraggedPiece(piece);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    if (!draggedPiece) return;

    const newBoard = [...board.map(r => [...r])]; 
    const pShape = draggedPiece.shape;
    const pDots = draggedPiece.dots;

    // Kiểm tra tràn viền
    if (row + pShape.length > 6 || col + pShape[0].length > 6) {
      alert("Vị trí không hợp lệ: Bị tràn ra ngoài bảng!");
      return;
    }

    // Kiểm tra đè lên mảnh khác
    let isOverlap = false;
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1 && newBoard[row + r][col + c] !== null) {
          isOverlap = true;
        }
      }
    }
    if (isOverlap) {
      alert("Vị trí không hợp lệ: Đè lên mảnh ghép khác!");
      return;
    }

    // Cập nhật bảng
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          newBoard[row + r][col + c] = { 
            id: draggedPiece.id, 
            hasDot: pDots[r][c] === 1,
            color: draggedPiece.color
          };
        }
      }
    }

    setBoard(newBoard);
    setAvailablePieces(availablePieces.filter(p => p.id !== draggedPiece.id));
    setDraggedPiece(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  return (
    <div className="min-h-screen bg-slate-800 p-8 font-sans text-slate-800 flex justify-center">
      <div className="flex gap-12 w-full max-w-6xl">
        
        {/* CỘT TRÁI: BẢNG CHƠI */}
        <div className="flex-none">
          <h1 className="text-3xl font-bold text-white mb-2">Dice Deduction</h1>
          <p className="text-slate-400 mb-6">Kéo thả mảnh ghép vào bảng lưới 6x6.</p>
          
          <div className="relative bg-[#2D3748] p-3 rounded-2xl inline-block shadow-2xl border-4 border-slate-900">
            <div className="grid grid-cols-6 grid-rows-6 gap-1 bg-[#2D3748]">
              {board.map((row, rowIndex) => 
                row.map((cell, colIndex) => {
                  const isRightEdge = colIndex === 2;
                  const isBottomEdge = rowIndex === 2;
                  
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                      onDragOver={handleDragOver}
                      className={`
                        w-16 h-16 flex items-center justify-center transition-colors rounded-md
                        ${cell ? cell.color + ' border border-white/20' : 'bg-slate-100 hover:bg-slate-300'}
                        ${isRightEdge ? 'mr-2' : ''}
                        ${isBottomEdge ? 'mb-2' : ''}
                      `}
                    >
                      {cell && cell.hasDot && (
                        <div className="w-5 h-5 bg-slate-900 rounded-full shadow-md"></div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Gợi ý ảo */}
            <div className="absolute top-[18%] -right-14 bg-white border-4 border-slate-800 font-bold px-3 py-1 rounded-l-full shadow-md text-xl flex items-center gap-1">
              <span>◄</span> 5
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KHAY CHỨA MẢNH GHÉP */}
        <div className="flex-1 bg-slate-700 p-6 rounded-2xl shadow-inner overflow-y-auto max-h-[80vh]">
          <h2 className="text-xl font-bold text-white mb-2">Khay mảnh ghép (12)</h2>
          <p className="text-slate-300 text-sm mb-6 italic">💡 Mẹo: Click chuột vào khối để xoay 90 độ.</p>
          
          <div className="flex flex-wrap gap-6 items-start">
            {availablePieces.map(piece => (
              <div 
                key={piece.id}
                draggable
                onDragStart={(e) => handleDragStart(e, piece)}
                onClick={() => rotatePiece(piece.id)} // Gắn hàm xoay vào sự kiện Click
                className="cursor-pointer hover:scale-105 transition-transform origin-center p-2 bg-slate-800 rounded-lg border border-slate-600 shadow-md"
              >
                <div className="flex flex-col gap-1">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx} 
                          className={`w-10 h-10 flex items-center justify-center rounded-sm ${cell ? piece.color + ' border border-white/30 backdrop-blur-sm' : 'bg-transparent'}`}
                        >
                          {cell === 1 && piece.dots[rIdx][cIdx] === 1 && (
                            <div className="w-3.5 h-3.5 bg-slate-900 rounded-full"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}