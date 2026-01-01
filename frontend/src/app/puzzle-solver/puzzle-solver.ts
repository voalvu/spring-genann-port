import { Component, ElementRef, ViewChild, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface VectorCommand {
  type: string; // MOVE, LINE, CURVE
  x: number;
  y: number;
  cx?: number;
  cy?: number;
}

interface SwfResponse {
  name: string;
  commands: VectorCommand[];
}

@Component({
  selector: 'app-puzzle-solver',
  standalone: false,
  templateUrl: './puzzle-solver.html',
  styleUrls: ['./puzzle-solver.css']
})
export class PuzzleSolver {
  @ViewChild('mainCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  hasImage = false;
  isDragging = false;
  resultUrl: string | null = null;
  importedShapeName: string | null = null;
  currentVectorData: VectorCommand[] = [];

  constructor(private http: HttpClient) {}

  // --- DRAG AND DROP HANDLERS ---

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.swf')) {
        this.uploadSwf(file);
      } else {
        alert('Please drop an .swf file');
      }
    }
  }

  // --- API CALLS ---

  uploadSwf(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<SwfResponse>('http://localhost:8080/api/swf/upload', formData)
      .subscribe({
        next: (res) => {
          this.importedShapeName = res.name;
          this.currentVectorData = res.commands;
          this.drawVectorOverlay(); // Draw it immediately to prove it works
        },
        error: (err) => console.error(err)
      });
  }

  // --- RENDERING ---

  drawVectorOverlay() {
    const cvs = this.canvasRef.nativeElement;
    const ctx = cvs.getContext('2d')!;

    // Keep existing image if present, else clear
    if (!this.hasImage) {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = "#333";
      ctx.fillRect(0,0,cvs.width, cvs.height);
    }

    ctx.save();
    ctx.strokeStyle = '#00ff00'; // Neon Green for SWF vectors
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Replay the commands from the Backend
    this.currentVectorData.forEach(cmd => {
      if (cmd.type === 'MOVE') {
        ctx.moveTo(cmd.x, cmd.y);
      } else if (cmd.type === 'LINE') {
        ctx.lineTo(cmd.x, cmd.y);
      } else if (cmd.type === 'CURVE') {
        // Quadratic curve (Standard for SWF)
        ctx.quadraticCurveTo(cmd.cx!, cmd.cy!, cmd.x, cmd.y);
      }
    });

    ctx.stroke();
    ctx.restore();
  }

  // 1. Handle Paste
  @HostListener('window:paste', ['$event'])
  handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        this.loadImage(blob!);
        break;
      }
    }
  }

  loadImage(file: Blob) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const cvs = this.canvasRef.nativeElement;
      const ctx = cvs.getContext('2d')!;
      // Fit to canvas
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      this.hasImage = true;
    };
    img.src = url;
  }

  // 2. Send to Backend
  solvePuzzle() {
    // Convert Canvas to Blob
    this.canvasRef.nativeElement.toBlob((blob) => {
      const formData = new FormData();
      formData.append('screenshot', blob!, 'screen.png');

      // Upload to endpoint
      this.http.post('http://localhost:8080/api/puzzle/solve', formData)
        .subscribe(() => {
          // Poll for result or wait (using timestamp cache bust)
          setTimeout(() => {
            this.resultUrl = 'http://localhost:8080/custom/puzzle_solved.png?t=' + Date.now();
          }, 5000); // Wait for training
        });
    });
  }
}