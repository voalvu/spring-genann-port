import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, Output, EventEmitter } from '@angular/core';

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-polygon-canvas',
  standalone: false,
  templateUrl: './polygon-canvas.html',
  styleUrls: ['./polygon-canvas.css']
})
export class PolygonCanvas implements AfterViewInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Emits data to parent when user clicks "Send"
  @Output() onPolygonComplete = new EventEmitter<Point[]>();

  private ctx!: CanvasRenderingContext2D;
  private points: Point[] = [];
  public isClosed = false;
  private mousePos: Point | null = null;
  private readonly SNAP_RADIUS = 15; // Pixels to snap to start point

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    // Set internal resolution match CSS size for crisp rendering
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.draw();
  }

  // --- Interaction Handlers ---

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isClosed) return;
    this.mousePos = this.getMousePos(event);
    this.draw();
  }

  @HostListener('mousedown', ['$event'])
  onClick(event: MouseEvent) {
    if (this.isClosed) return;

    const clickPos = this.getMousePos(event);

    // 1. Check if clicking near start point to close the polygon
    if (this.points.length > 2 && this.isNearStart(clickPos)) {
      this.isClosed = true;
      this.mousePos = null;
      this.draw();
      console.log('Polygon Closed. Points:', this.points);
      return;
    }

    // 2. Add new point
    this.points.push(clickPos);
    this.draw();
  }

  // --- Drawing Logic ---

  private draw() {
    const w = this.canvasRef.nativeElement.width;
    const h = this.canvasRef.nativeElement.height;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, w, h);

    // Draw Grid (Optional, for visual aid)
    this.drawGrid(w, h);

    if (this.points.length === 0) return;

    // Begin Path
    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0].x, this.points[0].y);

    // Draw lines to all existing points
    for (let i = 1; i < this.points.length; i++) {
      this.ctx.lineTo(this.points[i].x, this.points[i].y);
    }

    // Dynamic Logic
    if (this.isClosed) {
      this.ctx.closePath();
      this.ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#007bff';
    } else if (this.mousePos) {
      // Rubber-band line to mouse
      this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
      this.ctx.strokeStyle = '#666';
    }

    this.ctx.stroke();

    // Draw Vertices
    this.ctx.fillStyle = '#007bff';
    this.points.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw Snap Indicator (Green circle around start)
    if (!this.isClosed && this.points.length > 2 && this.mousePos && this.isNearStart(this.mousePos)) {
      this.ctx.beginPath();
      this.ctx.arc(this.points[0].x, this.points[0].y, this.SNAP_RADIUS, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(40, 167, 69, 0.8)';
      this.ctx.stroke();
    }
  }

  private drawGrid(w: number, h: number) {
    this.ctx.strokeStyle = '#eee';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= w; x += 20) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += 20) { this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); }
    this.ctx.stroke();
    this.ctx.lineWidth = 2; // Reset
  }

  // --- Utilities ---

  private getMousePos(evt: MouseEvent): Point {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  private isNearStart(pos: Point): boolean {
    if (this.points.length === 0) return false;
    const dx = pos.x - this.points[0].x;
    const dy = pos.y - this.points[0].y;
    return Math.sqrt(dx * dx + dy * dy) < this.SNAP_RADIUS;
  }

  reset() {
    this.points = [];
    this.isClosed = false;
    this.draw();
  }

  // API Ready: Returns points normalized between 0.0 and 1.0
  exportData() {
    const width = this.canvasRef.nativeElement.width;
    const height = this.canvasRef.nativeElement.height;

    const payload = this.points.map(p => ({
      x: parseFloat((p.x / width).toFixed(4)),
      y: parseFloat((p.y / height).toFixed(4))
    }));

    console.log("Ready for API:", payload);
    this.onPolygonComplete.emit(payload);
  }
}