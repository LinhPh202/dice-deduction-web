'use client';

import React, { useState } from 'react';

// 1. DỮ LIỆU TĨNH
// Định nghĩa một vài mảnh ghép mẫu dựa trên trò chơi
const INITIAL_PIECES = [
  { id: 'p1', shape: [[1, 1, 1]], dots: [[1, 0, 1]], color: 'bg-blue-100' }, // Mảnh 1x3 có 2 chấm ở đầu
  { id: 'p2', shape: [[1, 1], [1, 1]], dots: [[1, 0], [0, 0]], color: 'bg-green-100' }, // Mảnh 2x2 có 1 chấm
  { id: 'p3', shape: [[1], [1], [1]], dots: [[0], [1], [0]], color: 'bg-yellow-100' } // Mảnh 3x1 dọc
];

export default function DiceDeduction() {
  // 2. STATE QUẢN LÝ TRÒ CHƠI
  // Khởi tạo bảng 6x6 trống (chứa giá trị null)
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(6).fill(null)));
  const [availablePieces, setAvailablePieces] = useState(INITIAL_PIECES);
  const [draggedPiece, setDraggedPiece] = useState(null);

  // 3. LOGIC KÉO THẢ (DRAG & DROP)
  const handleDragStart = (e, piece) => {
    setDraggedPiece(piece);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    if (!draggedPiece) return;

    const newBoard = [...board.map(r => [...r])]; // Clone bảng hiện tại
    const pShape = draggedPiece.shape;
    const pDots = draggedPiece.dots;

    // Kiểm tra xem mảnh ghép có bị tràn viền bảng không
    if (row + pShape.length > 6 || col + pShape[0].length > 6) {
      alert("Vị trí không hợp lệ: Tràn viền!");
      return;
    }

    // Đặt mảnh ghép vào bảng (Logic map array 2D)
    for (let r = 0; r < pShape.length; r++) {
      for (let c = 0; c < pShape[0].length; c++) {
        if (pShape[r][c] === 1) {
          // Lưu thông tin mảnh ghép và vị trí chấm đen
          newBoard[row + r][col + c] = { 
            id: draggedPiece.id, 
            hasDot: pDots[r][c] === 1,
            color: draggedPiece.color
          };
        }
      }
    }

    setBoard(newBoard);
    // Xóa mảnh ghép khỏi khay chứa
    setAvailablePieces(availablePieces.filter(p => p.id !== draggedPiece.id));
    setDraggedPiece(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Cho phép thả
  };

  // 4. GIAO DIỆN (UI)
  return (
    <div className="min-h-screen bg-slate-800 p-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto flex gap-8">
        
        {/* CỘT TRÁI: BẢNG CHƠI CHÍNH */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white mb-6">Dice Deduction</h1>
          
          <div className="relative bg-gray-300 p-2 rounded-xl inline-block shadow-2xl">
            <div className="grid grid-cols-6 grid-rows-6 gap-1 border-4 border-gray-400 bg-gray-400">
              {board.map((row, rowIndex) => 
                row.map((cell, colIndex) => {
                  // Phân chia 4 khu vực 3x3 bằng viền đậm
                  const isRightEdge = colIndex === 2;
                  const isBottomEdge = rowIndex === 2;
                  
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                      onDragOver={handleDragOver}
                      className={`
                        w-14 h-14 flex items-center justify-center transition-colors
                        ${cell ? cell.color : 'bg-white hover:bg-gray-100'}
                        ${isRightEdge ? 'mr-1' : ''}
                        ${isBottomEdge ? 'mb-1' : ''}
                      `}
                    >
                      {/* Render chấm đen nếu có */}
                      {cell && cell.hasDot && (
                        <div className="w-5 h-5 bg-black rounded-full shadow-sm"></div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Gợi ý mũi tên ảo (Demo cho màn chơi) */}
            <div className="absolute top-1/4 -right-12 bg-white border-2 border-black font-bold px-3 py-1 rounded-l-full shadow-md">
              &lt; 5
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KHAY CHỨA MẢNH GHÉP */}
        <div className="w-64 bg-slate-700 p-4 rounded-xl shadow-inner h-fit">
          <h2 className="text-xl font-bold text-white mb-4">Mảnh ghép</h2>
          <div className="flex flex-col gap-4">
            {availablePieces.map(piece => (
              <div 
                key={piece.id}
                draggable
                onDragStart={(e) => handleDragStart(e, piece)}
                className="cursor-grab hover:scale-105 transition-transform origin-top-left"
              >
                {/* Render hình dáng mảnh ghép trong khay */}
                <div className="flex flex-col gap-1">
                  {piece.shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1">
                      {row.map((cell, cIdx) => (
                        <div 
                          key={cIdx} 
                          className={`w-10 h-10 flex items-center justify-center ${cell ? piece.color + ' border border-gray-300 rounded' : 'bg-transparent'}`}
                        >
                          {piece.dots[rIdx][cIdx] === 1 && (
                            <div className="w-3 h-3 bg-black rounded-full"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availablePieces.length === 0 && (
              <p className="text-slate-400 italic">Đã sử dụng hết mảnh ghép!</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}